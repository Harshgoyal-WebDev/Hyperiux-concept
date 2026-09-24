"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./scatter";

// Same technique as the old Concepts page's CuboidDustMotes.jsx (cylindrical
// angle/radius placement, per-particle flicker, additive point sprites) —
// rising bottom-to-top past the logo instead of falling top-to-bottom past
// the cuboid, and each mote picks one of three ember colors at random
// instead of a single uColor.
const SPARKLE_COLORS = ["#ff5f00", "#ff4000", "#ff9900"];

const vertexShader = /* glsl */ `
  attribute vec3 aRandom; // x: orbit angle, y: radius fraction, z: phase
  attribute float aFlickerSeed;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uBaseY;
  uniform float uHeight;
  uniform float uRadius;
  uniform float uSpeed;
  uniform float uSize;

  varying float vLife;
  varying float vFlicker;
  varying vec3 vColor;

  void main() {
    // t sweeps 0..1 over the mote's own loop (aRandom.z staggers where in
    // the loop each one currently starts) — rising, not falling, so y
    // climbs from the bottom of the range to the top as t goes 0 to 1.
    float t = fract(aRandom.z + uTime * uSpeed / uHeight);
    float y = uBaseY + t * uHeight;

    float angle = aRandom.x * 6.28318;
    float radius = aRandom.y * uRadius;
    vec3 pos = vec3(cos(angle) * radius, y, sin(angle) * radius);

    vLife = t;
    vColor = aColor;
    // Each ember glows and fades on its own independent cycle, same as
    // CuboidDustMotes.
    vFlicker = sin(uTime * (2.0 + aFlickerSeed * 3.0) + aFlickerSeed * 20.0) * 0.5 + 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * (300.0 / max(-mvPosition.z, 0.001));
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform float uFadeInLife;
  uniform float uFadeOutLife;

  varying float vLife;
  varying float vFlicker;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    // Hard-edged disc, not a soft falloff — anything inside the point
    // sprite's own circle is fully opaque, anything outside is fully
    // discarded, so each sparkle reads as a crisp dot instead of a fuzzy
    // glow blob.
    if (d > 1.0) discard;
    float alpha = 1.0;

    // Soft fade-in right off the bottom (uFadeInLife, a small fixed
    // fraction of the whole cycle, same as CuboidDustMotes' edge fade) and
    // a fade-out that only starts once the mote has actually reached the
    // logo's own top — uFadeOutLife is where in the 0..1 cycle that top
    // sits, so everything below it stays fully visible and only the last
    // stretch past it (the requested "fades away 20% above the model")
    // rolls off to 0 before the loop wraps back to the bottom.
    float fadeIn = smoothstep(0.0, uFadeInLife, vLife);
    float fadeOut = smoothstep(1.0, uFadeOutLife, vLife);
    float edgeFade = fadeIn * fadeOut;
    float flicker = pow(vFlicker, 2.0);

    gl_FragColor = vec4(vColor, alpha * edgeFade * flicker * uOpacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function LogoSparkles({
  position = [0, 0, 0],
  count = 40,
  radius = 1.2,
  baseOffset = -2.2,
  topOffset = 2.2,
  fadeBeyondTop = 0.2,
  speed = 0.6,
  size = 4,
  opacity = 1,
}) {
  // The cycle's full travel extends `fadeBeyondTop` past topOffset (so the
  // fade-out actually happens ABOVE the model, not before reaching it);
  // uFadeOutLife is where topOffset itself falls within that longer cycle.
  const height = (topOffset - baseOffset) * (1 + fadeBeyondTop);
  const fadeOutLife = (topOffset - baseOffset) / height;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 3);
    const flickerSeeds = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const random = mulberry32(count * 1237 + 5);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      randoms[i * 3 + 0] = random();
      // sqrt() of the raw radius fraction — the shader multiplies this
      // straight through by uRadius, and without the sqrt, uniform random
      // fractions bunch particles up near the center (area shrinks faster
      // than radius does), which reads as a dense core with a thin, sparse
      // outer ring instead of an even scatter across the whole lake.
      randoms[i * 3 + 1] = Math.sqrt(random());
      randoms[i * 3 + 2] = random();
      flickerSeeds[i] = random();

      color.set(SPARKLE_COLORS[Math.floor(random() * SPARKLE_COLORS.length)]);
      colors[i * 3 + 0] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 3));
    geo.setAttribute("aFlickerSeed", new THREE.BufferAttribute(flickerSeeds, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [count]);

  const scratch = useRef(null);
  if (scratch.current === null) {
    scratch.current = {
      uniforms: {
        uTime: { value: 0 },
        uBaseY: { value: baseOffset },
        uHeight: { value: height },
        uRadius: { value: radius },
        uSpeed: { value: speed },
        uSize: { value: size },
        uOpacity: { value: opacity },
        uFadeInLife: { value: 0.08 },
        uFadeOutLife: { value: fadeOutLife },
      },
    };
  }
  const uniforms = scratch.current.uniforms;

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uBaseY.value = baseOffset;
    uniforms.uHeight.value = height;
    uniforms.uRadius.value = radius;
    uniforms.uSpeed.value = speed;
    uniforms.uSize.value = size;
    uniforms.uOpacity.value = opacity;
    uniforms.uFadeOutLife.value = fadeOutLife;
  });

  if (count === 0) return null;

  return (
    <points
      position={position}
      geometry={geometry}
      ref={(node) => {
        // Layer 1 is excluded from the water's reflection render (see
        // LakeSurface.jsx) — same convention as CuboidDustMotes.
        if (node) node.layers.set(1);
      }}
    >
      <shaderMaterial
        args={[{ vertexShader, fragmentShader, uniforms }]}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
