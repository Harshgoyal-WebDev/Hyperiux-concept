"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import ShockwaveQuad from "./ShockwaveQuad";

// Renders two independent THREE.Scenes — the normal hero environment
// (`children`) and a second scene revealed through it (`portalScene`) —
// each into its own render target every frame using the SAME live camera,
// then composites the two textures on a fullscreen screen-space quad with
// a radial shockwave wipe driven by `progressRef` (0..1). Both scenes share
// one camera on purpose: whatever the live camera is looking at is exactly
// where the portal scene appears too, so the reveal reads as "there was
// something else here all along" rather than a shaped window that has to
// be framed and aimed at a second, disconnected scene.
//
// Ported from the ChromaticShockwavePortalR3F reference (createPortal +
// dual useFBO + gl.autoClear=false + a fullscreen NDC quad, see
// ShockwaveQuad.jsx) rather than drei's MeshPortalMaterial, which reads as
// a floating mesh-shaped object instead of an actual portal.
export default function PortalRenderer({
  children,
  portalScene: portalSceneContent,
  progressRef,
  smoothness = 12,
  chromatic = 0.18,
  warp = 0.38,
  edge = 10.0,
  ringPow = 20.0,
  ringGap = 0.01,
  ring2Strength = 0.05,
  portalWarp = 1,
  portalChromatic = 1.5,
  // Anti-aliasing for the portal (ridge) scene's own render target. The
  // canvas's `antialias: true` only covers the default framebuffer — NOT
  // offscreen targets — so without these the ridge scene (thin wireframe
  // lines, text edges, glass rims) rendered with no AA at all, at a capped
  // 1x pixel ratio, then got stretched onto the screen: very pixelated.
  // `portalResolution` multiplies the canvas's own dpr; `portalMsaa` is the
  // hardware multisample count (0 = off, 4 is the usual sweet spot).
  portalResolution = 1,
  portalMsaa = 4,
}) {
  const { gl, camera, size, viewport } = useThree();

  const progressSmoothRef = useRef(0);

  const bgScene = useMemo(() => new THREE.Scene(), []);
  const portalScene = useMemo(() => new THREE.Scene(), []);

  // The portal scene gets its OWN camera instead of sharing the hero's.
  // The two scenes are built at very different scales, so a single camera
  // can't frame both at once: at the start of the reveal the shared
  // camera was still wherever the hero arc left it (close to the logo),
  // which in the ridge scene's units sits right up against the glass
  // panel, so the new scene appeared hugely zoomed-in and then visibly
  // shrank as the camera flew back out to its proper framing. Injected
  // into the portal via createPortal's state below, so everything inside
  // it (useFrame's state.camera, Parallax, MeshTransmissionMaterial's
  // backdrop capture) sees this camera rather than the hero's. fov 55
  // matches the standalone RidgePlane page's own camera.
  const portalCamera = useMemo(() => new THREE.PerspectiveCamera(55, 1, 0.5, 500), []);
  const portalState = useMemo(() => ({ camera: portalCamera }), [portalCamera]);

  // Capped well below the canvas's own device-pixel-ratio target (up to 2x
  // on retina displays) — two full extra scene renders a frame is already
  // 3x the fill-rate cost of the old single-scene render, and the portal
  // scene's transmission (frosted glass) material is itself expensive
  // (three.js gives transmission its own internal refraction render pass).
  // The composited result still gets upscaled onto a normal full-res quad,
  // and the traveling ring mostly hides the softer edge under motion, so
  // this is a much better trade than dropping the canvas's own dpr.
  const fboDpr = Math.min(viewport.dpr, 1);
  const fboWidth = Math.round(size.width * fboDpr);
  const fboHeight = Math.round(size.height * fboDpr);

  const rtBg = useFBO(fboWidth, fboHeight, { stencilBuffer: false, depthBuffer: true, samples: 0 });

  // The ridge scene is what stays on screen for the whole rest of the page
  // (and the hero bg render is skipped by then — see below), so it gets
  // the full canvas dpr + MSAA rather than the hero's capped 1x/no-AA.
  const portalDprScaled = viewport.dpr * portalResolution;
  const rtPortal = useFBO(
    Math.round(size.width * portalDprScaled),
    Math.round(size.height * portalDprScaled),
    { stencilBuffer: false, depthBuffer: true, samples: portalMsaa }
  );
  // useFBO only applies `samples` at creation (and never back to 0) — set
  // it directly and free the GPU buffers so three.js re-creates them with
  // the new sample count on the next render, keeping the Leva slider live.
  useEffect(() => {
    if (rtPortal.samples !== portalMsaa) {
      rtPortal.samples = portalMsaa;
      rtPortal.dispose();
    }
  }, [rtPortal, portalMsaa]);

  // NOTE: autoClear is deliberately left at its default (true), not
  // switched off. It was disabled here previously so our own manual
  // gl.render() calls below wouldn't get auto-cleared mid-sequence — but
  // disabling it applies to the WHOLE renderer for as long as this
  // component is mounted, including every OTHER component's own internal
  // gl.render() calls that happen to fire during the same frame.
  // MeshTransmissionMaterial (used by the portal scene's glass panels) is
  // exactly that: it renders its own backdrop into a private FBO every
  // frame via gl.render() with no explicit clear of its own, relying
  // entirely on the renderer's normal auto-clear. With autoClear forced
  // off, that buffer never got cleared between frames and just kept
  // accumulating brightness, frame after frame, until it washed out to
  // solid white. Each of our own gl.render() calls below already clears
  // explicitly (see gl.clear() before each one), so autoClear=true is
  // simply redundant for them, not harmful — it only actually matters (and
  // fixes something) for other components' own render passes we don't
  // control.

  useFrame((_, delta) => {
    const target = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1);
    const a = 1 - Math.exp(-smoothness * delta);
    progressSmoothRef.current = THREE.MathUtils.lerp(progressSmoothRef.current, target, a);

    // Skip the hero bg-scene render entirely once the portal is fully
    // open — ShockwaveQuad's mixFactor saturates to 1 across the whole
    // frame well before t actually reaches 1 (the ring's edge falloff
    // means the interior is already fully "portal" once the ring has
    // passed), so rtBg's contents stop reaching the screen at all. Once
    // the ridge scene's own 300vh scroll stretch begins (well after the
    // portal itself has finished), this is the difference between paying
    // for the full hero environment's render every single frame for that
    // entire stretch versus not at all — pure waste otherwise, since
    // nothing from it is ever visible again past this point.
    if (progressRef.current < 0.98 || progressSmoothRef.current < 0.98) {
      gl.setRenderTarget(rtBg);
      gl.clear();
      gl.render(bgScene, camera);
    }

    // The portal scene (transmission material + its own lights) is the
    // expensive half of this — skip actually rendering it while the
    // shockwave hasn't started opening yet (the whole 200vh camera arc)
    // and it wouldn't be visible in the composite anyway (see
    // ShockwaveQuad's mixFactor, which is 0 while uScroll is 0).
    // 0.03, not 0.001: ShockwaveQuad's mixFactor only actually turns
    // non-negligible once the ring radius (sqrt(2)*t) has grown past its
    // own edge falloff — worked out against `edge`'s default (~12.5), that
    // doesn't happen until t is a few percent in, so gating this later
    // costs nothing visible while skipping a real stretch of frames where
    // the portal render was firing for content nobody could see yet.
    if (progressRef.current > 0.03 || progressSmoothRef.current > 0.03) {
      const aspect = size.width / size.height;
      if (portalCamera.aspect !== aspect) {
        portalCamera.aspect = aspect;
        portalCamera.updateProjectionMatrix();
      }
      gl.setRenderTarget(rtPortal);
      gl.clear();
      gl.render(portalScene, portalCamera);
    }

    gl.setRenderTarget(null);
  });

  return (
    <>
      {createPortal(children, bgScene)}
      {createPortal(portalSceneContent, portalScene, portalState)}
      <ShockwaveQuad
        tBg={rtBg.texture}
        tPortal={rtPortal.texture}
        scrollRef={progressSmoothRef}
        chromatic={chromatic}
        warp={warp}
        edge={edge}
        ringPow={ringPow}
        ringGap={ringGap}
        ring2Strength={ring2Strength}
        portalWarp={portalWarp}
        portalChromatic={portalChromatic}
      />
    </>
  );
}
