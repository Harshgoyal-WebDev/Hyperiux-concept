import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { JOURNEY_TIMING } from "../config";

// Deterministic RNG so every build of the world (and every reload) is
// identical — required for the scroll timeline to always map one progress
// value to one visual state.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Hyperiux icon (public/hyperiux-icon.svg, 500×501 viewBox, y down)
// ---------------------------------------------------------------------------
// The two vertical bars are copied verbatim from the SVG. The bridge is the
// union of the lower-left path, the stroked cube hexagon (outer edge of its
// 7px stroke) and the upper-right path — one continuous cut-out, which is
// how the mark reads when it is carved through stone.
export const LOGO = {
  barTopLeft: [
    [40, 13],
    [106.261, 13],
    [106.261, 222.826],
    [40, 222.826],
  ],
  barBottomRight: [
    [393.394, 278.043],
    [459.654, 278.043],
    [459.654, 487.869],
    [393.394, 487.869],
  ],
  bridge: [
    [40.141, 487.869],
    [106.401, 487.869],
    [106.401, 322.217],
    [197.95, 288.0],
    [246.6, 310.5],
    [298.74, 288.1],
    [460.892, 222.826],
    [460.892, 13.001],
    [393.527, 13.001],
    [393.527, 178.653],
    [292.2, 222.7],
    [257.9, 206.9],
    [249.0, 206.4],
    [197.95, 224.0],
    [40.141, 278.043],
  ],
  // Centre of the cube hexagon — the cube anchor in the placeholder.
  cubeCenter: [248.3, 258.45],
};

// Placeholder monolith proportions (SVG units → metres).
export const PLACEHOLDER = {
  scale: 0.1,
  slab: { left: -14, right: 514, top: -40, bottom: 590 },
  depth: 16,
};

// ---------------------------------------------------------------------------
// Orange trail
// ---------------------------------------------------------------------------
// World origin sits under the cube anchor; the logo faces +Z. The front
// trail runs out of the foreground to the monolith, the back trail leaves
// the far side and loops west and south around to the About vantage in
// front of the monolith, from where the logo face is seen again against
// the sun.
const FRONT_POINTS = [
  [5, 300],
  [-9, 235],
  [8, 165],
  [-5, 100],
  [3, 45],
  [0, 16],
];
const BACK_POINTS = [
  [0, -16],
  [-1.6, -48],
  [-14, -92],
  [-50, -128],
  [-100, -140],
  [-148, -116],
  [-178, -68],
  [-188, -8],
  [-172, 44],
  [-150, 98],
  [-112, 138],
  [-74, 152],
  [-48, 148],
];

function curveFrom(points) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    "centripetal"
  );
}

export const frontTrail = curveFrom(FRONT_POINTS);
export const backTrail = curveFrom(BACK_POINTS);

// Dense 2D polylines for corridor-distance queries (terrain flattening,
// rock rejection).
function polyline(curve, spacing) {
  const n = Math.ceil(curve.getLength() / spacing);
  return curve.getSpacedPoints(n).map((p) => [p.x, p.z]);
}
const TRAIL_POLY = [...polyline(frontTrail, 4), ...polyline(backTrail, 4)];

export function distanceToTrail(x, z) {
  let best = Infinity;
  for (let i = 0; i < TRAIL_POLY.length; i++) {
    const dx = x - TRAIL_POLY[i][0];
    const dz = z - TRAIL_POLY[i][1];
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// ---------------------------------------------------------------------------
// Terrain height field
// ---------------------------------------------------------------------------
// Wind-aligned dunes: crests run across the wind, broad rolling ground
// underneath, flattened around the monolith and softened along the trail
// so the camera can travel low without clipping a crest.
export function createTerrainSampler() {
  const noise = createNoise2D(mulberry32(11));
  const noiseB = createNoise2D(mulberry32(23));
  // Dune frame: u along the wind, v across it.
  const wx = -0.8;
  const wz = -0.6;

  const smooth = (e0, e1, x) => {
    const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return t * t * (3 - 2 * t);
  };

  function raw(x, z) {
    const u = x * wx + z * wz;
    const v = -x * wz + z * wx;
    const warp = noiseB(x * 0.0035, z * 0.0035) * 45;
    const crest = 1 - Math.abs(noise((u + warp) * 0.0105, v * 0.0032));
    // Sharp, slightly asymmetric crests.
    const dunes = Math.pow(crest, 2.4) * 12;
    const rolling = noise(x * 0.0022 + 7.1, z * 0.0022 - 3.3) * 7 + noiseB(x * 0.009, z * 0.009) * 1.6;
    return dunes + rolling;
  }

  function height(x, z) {
    let h = raw(x, z);
    const corridor = smooth(7, 46, distanceToTrail(x, z));
    h = THREE.MathUtils.lerp(h * 0.16 + 0.4, h, corridor);
    const r = Math.hypot(x, z * 0.85);
    const plaza = smooth(34, 125, r);
    h = THREE.MathUtils.lerp(0.2 + raw(x, z) * 0.04, h, plaza);
    return h;
  }

  return { height, raw };
}

// ---------------------------------------------------------------------------
// Landmarks and About forms
// ---------------------------------------------------------------------------
// Trail param the camera is at for a given timeline progress (mirrors the
// camB tween in timeline.js).
export function cameraTrailParam(t, s0) {
  const { trailStart, trailLinearEnd, linearS } = JOURNEY_TIMING;
  const k = THREE.MathUtils.clamp((t - trailStart) / (trailLinearEnd - trailStart), 0, 1);
  return s0 + (linearS - s0) * k;
}

export const ABOUT_VANTAGE = new THREE.Vector3(-48, 0, 148);
export const ABOUT_TARGET = new THREE.Vector3(0, 24, 0);

export function buildLandmarks(s0) {
  // Four journey markers that grow taller along the way — the agency's
  // development — plus the quiet sculptural group at the About vantage.
  const heights = [15, 20, 26, 33];
  const sides = [1, -1, 1, -1];
  const markers = JOURNEY_TIMING.captions.map((t, i) => {
    const s = Math.min(cameraTrailParam(t + 0.012, s0) + 0.045, 0.97);
    const p = backTrail.getPointAt(s);
    const tan = backTrail.getTangentAt(s);
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const pos = p.clone().addScaledVector(right, sides[i] * (21 + i * 4));
    return {
      kind: "marker",
      index: i,
      position: [pos.x, 0, pos.z],
      height: heights[i],
      width: 5.5 + i * 0.9,
      lean: sides[i] * 0.05,
      seed: 31 + i * 7,
      s,
    };
  });

  const fwd = ABOUT_TARGET.clone().sub(ABOUT_VANTAGE).setY(0).normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const place = (along, lateral) =>
    ABOUT_VANTAGE.clone().addScaledVector(fwd, along).addScaledVector(right, lateral);
  // All kept west of the hero sightline (camera at x = 0 looking down -Z)
  // so none of them stands in front of the monolith in State 01.
  const about = [
    { along: 34, lateral: -24, height: 18, width: 6, seed: 71 },
    { along: 16, lateral: 14, height: 16, width: 6, seed: 79 },
    { along: 41, lateral: -33, height: 9, width: 4.5, seed: 83 },
    { along: 78, lateral: -48, height: 13, width: 6.5, seed: 89 },
  ].map((a, i) => {
    const p = place(a.along, a.lateral);
    return {
      kind: "about",
      index: i,
      position: [p.x, 0, p.z],
      height: a.height,
      width: a.width,
      lean: (i % 2 ? 1 : -1) * 0.04,
      seed: a.seed,
    };
  });

  return [...markers, ...about];
}

export function buildScatter(landmarks, count = 46) {
  const rng = mulberry32(97);
  const rocks = [];
  let guard = 0;
  while (rocks.length < count && guard++ < 4000) {
    const x = -260 + rng() * 330;
    const z = -190 + rng() * 420;
    if (Math.hypot(x, z) < 48) continue;
    if (distanceToTrail(x, z) < 11) continue;
    if (landmarks.some((l) => Math.hypot(l.position[0] - x, l.position[2] - z) < 14)) continue;
    const big = rng() < 0.22;
    rocks.push({
      position: [x, 0, z],
      scale: big ? 2.2 + rng() * 2.6 : 0.6 + rng() * 1.4,
      squash: 0.55 + rng() * 0.6,
      rotation: rng() * Math.PI * 2,
      variant: Math.floor(rng() * 3),
    });
  }
  return rocks;
}
