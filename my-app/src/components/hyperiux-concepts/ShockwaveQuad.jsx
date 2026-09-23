"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

// A fullscreen quad drawn directly in clip space (its vertex shader skips
// the camera entirely), composited last (renderOrder 9999, no depth
// test/write) so it always covers the whole frame regardless of what the
// live camera is doing. `radius = sqrt(2) * t` guarantees the traveling
// ring has covered every corner of the screen by t=1 on a normalized quad,
// automatically — no aspect-ratio bookkeeping needed. Ported verbatim from
// the ChromaticShockwavePortalR3F reference's ShockwaveQuad.jsx.
export default function ShockwaveQuad({
  tBg,
  tPortal,
  scrollRef,
  chromatic,
  warp,
  edge,
  ringPow,
  ringGap,
  ring2Strength,
  portalWarp,
  portalChromatic,
}) {
  const matRef = useRef();
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTextureBg: { value: null },
      uTexturePortal: { value: null },
      uScroll: { value: 0.0 },
      uAspect: { value: 1.0 },
      uBaseOpacity: { value: 1.0 },
      uChromatic: { value: chromatic },
      uWarp: { value: warp },
      uEdge: { value: edge },
      uRingPow: { value: ringPow },
      uRingGap: { value: ringGap },
      uRing2Strength: { value: ring2Strength },
      uPortalWarp: { value: portalWarp },
      uPortalChromatic: { value: portalChromatic },
    }),
    []
  );

  useEffect(() => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uTextureBg.value = tBg;
    u.uTexturePortal.value = tPortal;
    u.uChromatic.value = chromatic;
    u.uWarp.value = warp;
    u.uEdge.value = edge;
    u.uRingPow.value = ringPow;
    u.uRingGap.value = ringGap;
    u.uRing2Strength.value = ring2Strength;
    u.uPortalWarp.value = portalWarp;
    u.uPortalChromatic.value = portalChromatic;
  }, [
    tBg,
    tPortal,
    chromatic,
    warp,
    edge,
    ringPow,
    ringGap,
    ring2Strength,
    portalWarp,
    portalChromatic,
  ]);

  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;
    const s = THREE.MathUtils.clamp(scrollRef.current ?? 0, 0, 1);
    mat.uniforms.uScroll.value = s;
    mat.uniforms.uAspect.value = size.width / size.height;
  });

  return (
    <mesh frustumCulled={false} renderOrder={9999}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          precision highp float;
          varying vec2 vUv;

          uniform sampler2D uTextureBg;
          uniform sampler2D uTexturePortal;
          uniform float uScroll;
          uniform float uAspect;
          uniform float uBaseOpacity;
          uniform float uChromatic;
          uniform float uWarp;
          uniform float uEdge;
          uniform float uRingPow;
          uniform float uRingGap;
          uniform float uRing2Strength;
          uniform float uPortalWarp;
          uniform float uPortalChromatic;

          void main() {
            vec2 uv = vUv;
            vec2 origin = vec2(0.5, 0.5);

            vec2 uvC = uv; uvC.x *= uAspect;
            vec2 oC  = origin; oC.x *= uAspect;

            float t = uScroll;
            float radius = sqrt(2.0) * t;
            float dist = length(oC - uvC);

            float circle = radius - dist;
            float factor = sin(t * 3.14159) *
              pow(clamp(1.0 - abs(circle), 0.0, 1.0), uRingPow);

            float circle2 = (radius - uRingGap) - dist;
            float factor2 = sin(t * 3.14159) *
              pow(clamp(1.0 - abs(circle2), 0.0, 1.0), uRingPow);

            factor += factor2 * uRing2Strength;

            vec2 dir = normalize(oC - uvC);

            float base = (uWarp * 0.7) * factor;
            vec2 off = base * dir;

            float chroma = uChromatic;
            vec2 offR = off * (1.0 + 0.05 * chroma);
            vec2 offG = off * (1.0 + 0.00 * chroma);
            vec2 offB = off * (1.0 + 0.05 * chroma);

            vec3 bg;
            bg.r = texture2D(uTextureBg, uv + offR).r;
            bg.g = texture2D(uTextureBg, uv + offG).g;
            bg.b = texture2D(uTextureBg, uv + offB).b;

            // The background above bends INWARD toward the ring (dir points
            // from the pixel toward center) as the shockwave passes it —
            // that's the "outer environment warping" that already reads
            // well. The portal/inner scene now bends the SAME way (inward,
            // like it's being sucked toward the ring/center rather than
            // bulging out at the screen), plus its own, stronger chromatic
            // split — proper prism-style dispersion, not just a faint tint
            // — so the reveal itself reads as a warped portal instead of a
            // flat cut sitting underneath the bent background.
            vec2 offPortal = off * uPortalWarp;
            float portalChroma = uPortalChromatic;
            vec2 offPortalR = offPortal * (1.0 + 0.18 * portalChroma);
            vec2 offPortalG = offPortal;
            vec2 offPortalB = offPortal * (1.0 - 0.18 * portalChroma);

            vec3 portal;
            portal.r = texture2D(uTexturePortal, uv + offPortalR).r;
            portal.g = texture2D(uTexturePortal, uv + offPortalG).g;
            portal.b = texture2D(uTexturePortal, uv + offPortalB).b;

            float mixFactor = clamp(t + circle * uEdge, 0.0, 1.0);

            vec3 color = mix(bg, portal, mixFactor);
            gl_FragColor = vec4(color, uBaseOpacity);
          }
        `}
      />
    </mesh>
  );
}
