"use client";

import { useMemo, useRef } from "react";
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
}) {
  const { gl, camera, size, viewport } = useThree();

  const progressSmoothRef = useRef(0);

  const bgScene = useMemo(() => new THREE.Scene(), []);
  const portalScene = useMemo(() => new THREE.Scene(), []);

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
  const rtPortal = useFBO(fboWidth, fboHeight, { stencilBuffer: false, depthBuffer: true, samples: 0 });

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

    gl.setRenderTarget(rtBg);
    gl.clear();
    gl.render(bgScene, camera);

    // The portal scene (transmission material + its own lights) is the
    // expensive half of this — skip actually rendering it while the
    // shockwave hasn't started opening yet (the whole 200vh camera arc)
    // and it wouldn't be visible in the composite anyway (see
    // ShockwaveQuad's mixFactor, which is 0 while uScroll is 0).
    if (progressRef.current > 0.001 || progressSmoothRef.current > 0.001) {
      gl.setRenderTarget(rtPortal);
      gl.clear();
      gl.render(portalScene, camera);
    }

    gl.setRenderTarget(null);
  });

  return (
    <>
      {createPortal(children, bgScene)}
      {createPortal(portalSceneContent, portalScene)}
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
