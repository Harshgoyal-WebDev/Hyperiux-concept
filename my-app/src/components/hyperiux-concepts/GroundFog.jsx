"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Wide, dense atmospheric fog hugging the whole terrain, not the scattered
// ridge-line wisps RidgeFog does (see that file). The brief this follows
// (paraphrased from reference notes on why screen-space/volume-box fog
// "cuts" at a visible boundary): don't give the fog a finite edge to be
// seen at all — a fog plane/box that just ends, or a radial mask that
// hits a hard 0, reads as a rectangle or a circle sitting on the terrain.
// Real fog thins out asymptotically and you never actually see where it
// "stops."
//
// This is NOT true raymarched volumetric fog (that reference's 16-32
// sample-per-pixel raymarch) — that's real per-pixel cost across the whole
// screen, working against the "optimize this scene" ask in the same
// breath. Instead: 3 large flat horizontal planes (huge relative to the
// terrain — see GROUND_SIZE_MULTIPLIER below — so their own literal mesh
// edge sits far past where the density falloff has already reached
// effectively 0, meaning the edge is never actually visible), each with
// noise-driven density and an EXPONENTIAL radial falloff (not smoothstep
// to a hard 0 at some fixed radius) from the terrain's own center. Cheap:
// 3 draw calls total versus the 16-32 raymarch samples/pixel a true
// volumetric pass would cost.
const LAYER_COUNT = 3;
const GROUND_SIZE_MULTIPLIER = 2.6;

const vertexShader = /* glsl */ `
  varying vec2 vWorldXZ;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldXZ = worldPosition.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uDensity;
  uniform float uOpacity;
  uniform float uNoiseScale;
  uniform float uFlowSpeed;
  uniform float uSwirl;
  uniform float uCoverageRadius;
  uniform float uSeed;

  varying vec2 vWorldXZ;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1)) + uSeed * 13.0) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      sum += valueNoise(p) * amp;
      p *= 2.05;
      amp *= 0.55;
    }
    return sum;
  }

  // Same curl field as RidgeFog.jsx's curl() — the perpendicular of a
  // noise gradient, so it rolls/swirls in place rather than only ever
  // pushing the pattern one direction like a plain flow offset would.
  vec2 curl(vec2 p) {
    float e = 0.08;
    float n1 = valueNoise(p + vec2(0.0, e));
    float n2 = valueNoise(p - vec2(0.0, e));
    float n3 = valueNoise(p + vec2(e, 0.0));
    float n4 = valueNoise(p - vec2(e, 0.0));
    float dx = (n1 - n2) / (2.0 * e);
    float dy = (n3 - n4) / (2.0 * e);
    return vec2(dy, -dx);
  }

  void main() {
    vec2 uv = vWorldXZ * uNoiseScale;

    // Constant drift plus a curl field sampled at its own slowly-evolving
    // point — same combination RidgeFog uses, so this rolls/swirls in
    // place over time rather than the whole cloud just sliding sideways.
    vec2 flow = vec2(uTime * uFlowSpeed, uTime * uFlowSpeed * 0.35);
    vec2 curlP = uv * 0.9 + flow * 0.5 + vec2(0.0, uTime * uFlowSpeed * 0.2);
    vec2 swirl = curl(curlP) * uSwirl;

    // Domain-warped primary pass (the warp offset itself comes from
    // sampling noise at the warped coordinate) plus a second, much
    // lower-frequency pass on an independent drift — one pass alone still
    // reads as a single blob with a findable silhouette; blending in the
    // second, slower one is what breaks that up into real drifting smoke
    // instead of a texture panning across a flat plane.
    vec2 warpUv = uv * vec2(1.8, 1.1) + flow + swirl;
    vec2 warp = vec2(valueNoise(warpUv), valueNoise(warpUv + 5.0)) - 0.5;
    float cloud = fbm(warpUv * 1.3 + warp * 1.4);

    vec2 softUv = uv * 0.5 + flow * 0.4 + swirl * 0.5;
    float soft = fbm(softUv);

    // A real contrast band (not the near-uniform 0..1 + sqrt flattening
    // this had before) — that combination was tuned for RidgeFog's small
    // close-up cards, where the goal was hiding the card's own edge behind
    // near-constant coverage. At this much bigger scale that same flattening
    // just reads as one solid grey sheet with no visible cloud shapes and
    // a hard silhouette wherever it meets the terrain. A tighter band
    // carves real gaps and wisps into it instead.
    float shaped = smoothstep(0.28, 0.82, mix(cloud, soft, 0.45));

    // exp(), not smoothstep(x, y, 0) — this never actually reaches exactly
    // 0 within any finite distance, so there is no boundary radius for the
    // eye to catch. uCoverageRadius is the distance at which density has
    // dropped to ~37% (1/e), not a cutoff.
    float dist = length(vWorldXZ);
    float radial = exp(-dist / uCoverageRadius);

    float density = uDensity * radial * shaped;
    density = clamp(density, 0.0, 1.0);

    gl_FragColor = vec4(uColor, density * uOpacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// One horizontal fog plane — its own uniforms scratch, synced from props
// every frame (same convention as RidgeFog.jsx's FogLayer), rather than a
// uniforms object mutated during render.
function FogLayer({
  groundSize,
  height,
  noiseScale,
  seed,
  color,
  density,
  opacity,
  flowSpeed,
  swirl,
  coverageRadius,
}) {
  const scratch = useRef(null);
  if (scratch.current === null) {
    scratch.current = {
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uDensity: { value: density },
        uOpacity: { value: opacity },
        uNoiseScale: { value: noiseScale },
        uFlowSpeed: { value: flowSpeed },
        uSwirl: { value: swirl },
        uCoverageRadius: { value: coverageRadius },
        uSeed: { value: seed },
      },
    };
  }
  const uniforms = scratch.current.uniforms;

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uColor.value.set(color);
    uniforms.uDensity.value = density;
    uniforms.uOpacity.value = opacity;
    uniforms.uFlowSpeed.value = flowSpeed;
    uniforms.uSwirl.value = swirl;
    uniforms.uCoverageRadius.value = coverageRadius;
  });

  const size = groundSize * GROUND_SIZE_MULTIPLIER;

  return (
    <mesh
      position={[0, height, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      ref={(node) => {
        // Excluded from the lake's own reflection render, same convention
        // as every other atmospheric layer (RidgeFog, Starfield) — a
        // mirrored fog plane in the water reads as a mistake, not depth.
        if (node) node.layers.set(1);
      }}
    >
      <planeGeometry args={[size, size, 1, 1]} />
      <shaderMaterial
        args={[{ vertexShader, fragmentShader, uniforms }]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function GroundFog({
  groundSize = 200,
  baseHeight = 0.5,
  layerSpread = 1.8,
  density = 0.85,
  opacity = 1,
  // Was 0.02 — at that scale a full noise wavelength spans ~40 world
  // units, wider than most of what's actually in frame at once, so the
  // cloud shapes never resolved into visible wisps within view. This is
  // sized to actually show cloud-scale detail within a typical framing.
  noiseScale = 0.045,
  // Was 0.015 — imperceptibly slow at this plane's scale. Fast enough now
  // to actually read as drifting smoke within a few seconds of watching.
  flowSpeed = 0.05,
  // Same curl-based rolling motion as RidgeFog's own "swirl" — see that
  // file's curl() for why this reads as real movement rather than the
  // whole pattern just sliding sideways.
  swirl = 2.2,
  coverageRadius = 70,
  // Grey/white, matching RidgeFog — not tinted toward the model's glow.
  color = "#484848",
}) {
  const layers = useMemo(
    () =>
      Array.from({ length: LAYER_COUNT }, (_, i) => ({
        key: i,
        height: baseHeight + i * layerSpread,
        noiseScale: noiseScale * (1 + i * 0.35),
        seed: i * 91 + 7,
      })),
    [baseHeight, layerSpread, noiseScale]
  );

  if (density <= 0) return null;

  return (
    <>
      {layers.map((layer) => (
        <FogLayer
          key={layer.key}
          groundSize={groundSize}
          height={layer.height}
          noiseScale={layer.noiseScale}
          seed={layer.seed}
          color={color}
          density={density}
          opacity={opacity}
          flowSpeed={flowSpeed}
          swirl={swirl}
          coverageRadius={coverageRadius}
        />
      ))}
    </>
  );
}
