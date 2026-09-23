"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createTerrainSampler } from "./terrainNoise";
import { mulberry32 } from "./scatter";

// Low, drifting mist clinging to the terrain's outer ridges — light
// grey/white (not the warm orange of CuboidSmoke, which this borrows its
// noise-card technique from), scattered around the rugged band of the
// terrain rather than near the logo, and always scrolling (the noise UV
// keeps sliding sideways every frame, never fully settling) so it reads as
// real moving atmosphere even with the camera still.
//
// Each patch is a small cross of 2+ STATIC, fixed-world-rotation planes
// (the classic "billboard cloud"/cross-prop trick real-time trees and
// grass use) rather than one dynamic camera-facing card — a single card
// that always spins to face you never looks volumetric, and worse, reads
// as an obviously flat plane the moment the camera looks at it from above
// or the side (it either goes edge-on or is locked upright and looks like
// a cardboard cutout). Crossed planes at fixed angles, by contrast, always
// present genuinely different intersecting geometry from every angle, so
// orbiting the camera around it looks like real layered volume instead of
// one plane spinning to track you.

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vFresnel;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Each plane is flat and static (no billboarding), so at some camera
    // angles it's seen almost edge-on — and a flat quad viewed edge-on
    // always reads as a hard, bright line no matter how soft its own
    // texture is, because perspective compresses the whole gradient into
    // a couple of screen pixels. vFresnel (1 = facing the camera head-on,
    // 0 = perfectly edge-on) lets the fragment shader fade the plane out
    // before that happens, the same trick real-time billboard-cloud
    // foliage/fog uses.
    vec3 viewNormal = normalize(normalMatrix * normal);
    vec3 viewDir = normalize(-mvPosition.xyz);
    vFresnel = abs(dot(viewNormal, viewDir));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSeed;
  uniform float uFlowSpeed;
  uniform float uSwirl;

  varying vec2 vUv;
  varying float vFresnel;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1)) + uSeed * 17.0) * 43758.5453123);
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

  // 2 octaves (was 3) — this runs per overdrawn fragment across every
  // patch stacked on every other patch, so every octave here is a real,
  // multiplied cost, not a one-time one.
  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 2; i++) {
      sum += valueNoise(p) * amp;
      p *= 2.1;
      amp *= 0.55;
    }
    return sum;
  }

  // A cheap curl field: the perpendicular of a noise gradient always has
  // zero divergence, i.e. it swirls/rotates rather than pushing everything
  // outward or inward like a plain gradient would — sampling it at a
  // slowly time-shifting point is what turns the drift below into actual
  // rolling, curling motion instead of the whole cloud sliding sideways as
  // one rigid sheet.
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
    vec2 uv = vUv;

    // Constant horizontal drift (with a much slower vertical creep) — this
    // is what makes the fog read as "running" rather than a static painted
    // texture, independent of any camera or scroll motion.
    vec2 flow = vec2(uTime * uFlowSpeed, uTime * uFlowSpeed * 0.12);

    // Sample the curl field at its own slowly-evolving point (not the same
    // point being displaced) so the swirl direction itself keeps changing
    // over time instead of settling into one fixed rotating pattern.
    vec2 curlP = uv * 0.9 + flow * 0.5 + vec2(0.0, uTime * uFlowSpeed * 0.07);
    vec2 swirl = curl(curlP) * uSwirl;

    vec2 warpUv = uv * vec2(1.8, 1.1) + flow + swirl;
    vec2 warp = vec2(valueNoise(warpUv), valueNoise(warpUv + 5.0)) - 0.5;
    float cloud = fbm(warpUv * 1.3 + warp * 0.9);

    // A second, much lower-frequency pass (independent drift speed) breaks
    // up the first pass's own silhouette — without this, "cloud" alone
    // still reads as one blob with a findable boundary, which at a
    // distance looks exactly like a flat sheet with a printed texture on
    // it rather than actual drifting haze.
    vec2 softUv = uv * 0.5 + flow * 0.4 + swirl * 0.5;
    float soft = fbm(softUv);

    // Wide, low-contrast bands (was a near-binary 0.2..0.6 threshold) so
    // the density ramps gradually across a large fraction of the plane
    // instead of snapping from "invisible" to "fully opaque" over a thin
    // band — that hard transition is what reads as a sharp-edged sheet.
    float shaped = smoothstep(0.0, 1.0, mix(cloud, soft, 0.5));

    // No flat full-opacity plateau anywhere — density ramps continuously
    // from the plane's center out to every edge, so the plane's own
    // rectangular bounds are never the thing you're looking at.
    vec2 centered = uv - 0.5;
    float horizontal = 1.0 - smoothstep(0.0, 0.5, abs(centered.x));
    float vertical = smoothstep(0.0, 0.45, uv.y) * smoothstep(1.0, 0.4, uv.y);

    float alpha = shaped * horizontal * vertical;
    // Soften further with its own square root — pushes mid-tones up and
    // trims only the very faintest wisps, so what's left reads as a soft
    // gradient cloud rather than a shape with a clean cutoff.
    alpha = sqrt(clamp(alpha, 0.0, 1.0));

    // Fade out well before true edge-on (0.45, not 0.0) — by the time a
    // plane is only a sliver from this angle it's already thin enough on
    // screen to look like a stray line, so it needs to be gone before it
    // gets that thin, not just at the literal zero-width limit.
    float angleFade = smoothstep(0.0, 0.45, vFresnel);

    gl_FragColor = vec4(uColor, alpha * angleFade * uOpacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// One crossed plane of the cloud — its own uniforms (own noise seed) so
// layers within the same patch don't look like identical stacked copies.
function FogLayer({ rotationY, scale, seed, width, height, flowSpeed, opacity, color, swirl }) {
  const scratch = useRef(null);
  if (scratch.current === null) {
    scratch.current = {
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
        uTime: { value: 0 },
        uSeed: { value: seed },
        uFlowSpeed: { value: flowSpeed },
        uSwirl: { value: swirl },
      },
    };
  }
  const uniforms = scratch.current.uniforms;

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uOpacity.value = opacity;
    uniforms.uFlowSpeed.value = flowSpeed;
    uniforms.uSwirl.value = swirl;
    uniforms.uColor.value.set(color);
  });

  return (
    <mesh
      rotation={[0, rotationY, 0]}
      scale={scale}
      ref={(node) => {
        // Layer 1, same convention as Starfield/AtmosphericDust — kept out
        // of the water's reflection pass; a mirrored fog band in the lake
        // reads as a mistake, not atmosphere.
        if (node) node.layers.set(1);
      }}
    >
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        args={[{ vertexShader, fragmentShader, uniforms }]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        // Additive rather than normal "over" blending — a flat-colored
        // plane composited normally reads as an opaque grey cutout against
        // the bright bloom behind it (exactly the "hard sheet" look this
        // is fixing); additive lets it glow into and spread across
        // whatever is already there instead of occluding it.
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function FogPatch({
  position,
  rotationY,
  scale,
  seed,
  width,
  height,
  flowSpeed,
  opacity,
  color,
  layerCount,
  swirl,
}) {
  // Evenly fan the crossed planes around a half-turn (a full-turn cross
  // would just retrace the same plane orientations) — 2 layers is a
  // classic perpendicular "+" cross, more adds finer angular coverage.
  const layers = useMemo(
    () =>
      Array.from({ length: layerCount }, (_, i) => ({
        key: i,
        rotationY: (i * Math.PI) / layerCount,
        seed: seed + i * 97,
      })),
    [layerCount, seed]
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {layers.map((layer) => (
        <FogLayer
          key={layer.key}
          rotationY={layer.rotationY}
          scale={scale}
          seed={layer.seed}
          width={width}
          height={height}
          flowSpeed={flowSpeed}
          opacity={opacity}
          color={color}
          swirl={swirl}
        />
      ))}
    </group>
  );
}

export default function RidgeFog({
  count = 12,
  groundSize = 200,
  bandInner = 40,
  bandOuter = 95,
  heightOffset = 1.5,
  heightJitter = 3,
  width = 26,
  height = 10,
  flowSpeed = 0.03,
  opacity = 0.22,
  color = "#c7cdd2",
  // How strongly the curl field (see the shader's curl() function) bends
  // the noise sampling each frame — 0 is the old pure sideways drift, up
  // from there and the cloud visibly rolls/curls rather than just sliding.
  swirl = 1.2,
  seed = 71,
  // 2 = a perpendicular "+" cross per patch (the minimum that reads as
  // volume from any horizontal angle instead of a flat card); higher
  // values fan more planes around for finer angular coverage at a
  // proportional fill-rate cost.
  layerCount = 2,
  // Must match Terrain's own values (see terrainNoise.js) or the fog drifts
  // off the ridge line it's meant to be hugging.
  terrainHeight = 14.4,
  basinRadius = 8,
  basinDepth = 7.9,
  ruggedness = 0.38,
  ridgeSharpness = 0,
  warpStrength = 0,
  transitionWidth = 25,
  rollingFrequency = 0.02,
  ridgedFrequency = 0,
  terrainSeed = 7,
}) {
  const patches = useMemo(() => {
    const getElevation = createTerrainSampler({
      seed: terrainSeed,
      height: terrainHeight,
      basinRadius,
      basinDepth,
      ruggedness,
      ridgeSharpness,
      warpStrength,
      transitionWidth,
      rollingFrequency,
      ridgedFrequency,
    });
    const random = mulberry32(seed * 733 + 11);
    // Evenly spaced base angle per patch (+ a jitter within its own slice)
    // instead of a fully random angle — with a small count spread across a
    // full circle, pure randomness reliably leaves one whole side (e.g.
    // the half of the ring facing the camera) thin or empty purely by
    // chance, which reads as "fog on the left but not the right." Slicing
    // the circle into `count` even wedges first guarantees coverage all
    // the way around; the per-slice jitter keeps it from looking like a
    // mechanically perfect ring.
    const angleStep = (Math.PI * 2) / count;

    return Array.from({ length: count }, (_, i) => {
      const angle = i * angleStep + (random() - 0.5) * angleStep;
      const radius = THREE.MathUtils.lerp(bandInner, bandOuter, random());
      const worldX = Math.cos(angle) * radius;
      const worldZ = Math.sin(angle) * radius;
      // Terrain's plane geometry is rotated -90deg about X, which maps its
      // local Y axis to -worldZ — sample with that same flip to match (see
      // scatter.js's scatterOnTerrain, which this mirrors).
      const worldY = getElevation(worldX, -worldZ);

      return {
        key: i,
        position: [worldX, worldY + heightOffset + random() * heightJitter, worldZ],
        // Roughly tangent to the ring, with a little randomness so the
        // band doesn't read as a perfectly even ring of identical cards.
        rotationY: angle + Math.PI / 2 + (random() - 0.5) * 0.8,
        scale: 0.75 + random() * 0.7,
        seed: i + 1,
        flowSpeed: flowSpeed * (0.7 + random() * 0.6),
      };
    });
  }, [
    count,
    bandInner,
    bandOuter,
    heightOffset,
    heightJitter,
    flowSpeed,
    seed,
    terrainHeight,
    basinRadius,
    basinDepth,
    ruggedness,
    ridgeSharpness,
    warpStrength,
    transitionWidth,
    rollingFrequency,
    ridgedFrequency,
    terrainSeed,
  ]);

  if (count === 0) return null;

  return (
    <group position={[0, 0, 0]}>
      {patches.map((patch) => (
        <FogPatch
          key={patch.key}
          position={patch.position}
          rotationY={patch.rotationY}
          scale={patch.scale}
          seed={patch.seed}
          width={width}
          height={height}
          flowSpeed={patch.flowSpeed}
          opacity={opacity}
          color={color}
          layerCount={layerCount}
          swirl={swirl}
        />
      ))}
    </group>
  );
}
