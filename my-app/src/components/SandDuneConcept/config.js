import * as THREE from "three";

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------
// The Blender monolith is expected at these paths. The loader looks for a
// node named `MonolithRoot` (the stone) and an Empty named `CubeAnchor`
// (the centre of the logo bridge). Without `CubeAnchor` the metadata JSON
// is used — this matches blender/monolith/hyperiux-monolith-metadata.json:
//
// {
//   "orientation": { "up": "+Y", "front": "+Z (logo face …)" },
//   "cube": { "position": [x, y, z],          // MonolithRoot space, metres
//             "recommendedEdge_m": [1.0, 1.1] // or "size": n
//   },
//   "targetHeight": 63                        // optional auto-scale override
// }
// (`cubeAnchor.localPosition`, `front` and `upAxis` are accepted too.)
export const ASSETS = {
  monolithGlb: "/models/hyperiux-monolith.glb",
  monolithMeta: "/models/hyperiux-monolith-metadata.json",
};

// Explicit development flag. When the GLB above is missing, a stand-in
// monolith is extruded from the coordinates of public/hyperiux-icon.svg so
// the rest of the sequence can be built and reviewed. The page shows a
// visible "placeholder" badge whenever this stand-in is in use; it is NOT
// the final Blender geometry. Set to false to render no monolith instead.
export const ALLOW_PLACEHOLDER_MONOLITH = true;

// Monolith world sizing. A delivered GLB is uniformly scaled so its height
// matches this value, so the camera choreography stays valid regardless of
// the units used in Blender.
export const MONOLITH_TARGET_HEIGHT = 63;
export const MONOLITH_SINK = 5; // metres buried in the sand
export const CUBE_SIZE = 5.0; // placeholder only; a GLB uses its metadata

// ---------------------------------------------------------------------------
// Scroll timeline
// ---------------------------------------------------------------------------
export const JOURNEY_VH = 1050;

// Ten visual anchor states as normalized ranges of the single master
// timeline. Everything in between is interpolated, not cut.
export const STATES = [
  { id: "hero", n: "01", label: "Hero", start: 0.0, end: 0.055 },
  { id: "approach", n: "02", label: "Approach", start: 0.055, end: 0.165 },
  { id: "enter", n: "03", label: "Enter", start: 0.165, end: 0.245 },
  { id: "core", n: "04", label: "Core", start: 0.245, end: 0.335 },
  { id: "fracture", n: "05", label: "Fracture", start: 0.335, end: 0.405 },
  { id: "field", n: "06", label: "Energy", start: 0.405, end: 0.475 },
  { id: "emerge", n: "07", label: "Emerge", start: 0.475, end: 0.545 },
  { id: "journey", n: "08", label: "Journey", start: 0.545, end: 0.775 },
  { id: "dissolve", n: "09", label: "Dissolve", start: 0.775, end: 0.885 },
  { id: "white", n: "10", label: "Website", start: 0.885, end: 1.0 },
];

// Labels shown on the bottom progress rail (subset of STATES).
export const RAIL = [
  { label: "Hero", at: 0.0 },
  { label: "Enter", at: 0.165 },
  { label: "Core", at: 0.245 },
  { label: "Journey", at: 0.545 },
  { label: "About", at: 0.7 },
  { label: "Dissolve", at: 0.775 },
  { label: "Website", at: 1.0 },
];

// Journey camera pacing inside state 08. The landmark positions are derived
// from these numbers so each marker is in frame when its caption shows.
export const JOURNEY_TIMING = {
  trailStart: 0.48, // camera starts following the trail
  trailLinearEnd: 0.665, // constant speed until here...
  trailEnd: 0.7, // ...then eases into the About composition
  linearS: 0.93, // trail param reached at trailLinearEnd
  captions: [0.553, 0.585, 0.617, 0.649],
  captionLength: 0.028,
  about: { in: 0.7, out: 0.768 },
};

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------
export const PALETTE = {
  orange: "#FF5F00",
  basalt: "#3a332e",
  sand: "#b4683c",
  white: "#FFFFFF",
};

// Low sunset sun, behind the monolith and to the right of the hero view.
export const SUN_DIR = new THREE.Vector3(0.47, 0.075, -0.88).normalize();
// Direction the wind blows TOWARDS on the ground plane (x, z).
export const WIND_DIR = new THREE.Vector2(-0.8, -0.6).normalize();
// HDR white used for the in-scene white-out; tone-maps to ~#FEFEFE before
// the DOM layer finishes on exact #FFFFFF.
export const WHITE_LEVEL = 6.0;

// ---------------------------------------------------------------------------
// Quality tiers
// ---------------------------------------------------------------------------
export const TIERS = {
  high: {
    name: "high",
    dpr: [1, 1.5],
    terrainSegments: 360,
    dissolveParticles: 60000,
    dissolveChunks: 520,
    energyParticles: 3600,
    fractureParticles: 2600,
    shards: 260,
    streaks: 420,
    dust: 700,
    sandGrains: 42000,
    shadowMap: 2048,
    post: true,
    multisampling: 2,
  },
  medium: {
    name: "medium",
    dpr: [1, 1.4],
    terrainSegments: 260,
    dissolveParticles: 34000,
    dissolveChunks: 320,
    energyParticles: 2400,
    fractureParticles: 1600,
    shards: 180,
    streaks: 300,
    dust: 450,
    sandGrains: 24000,
    shadowMap: 1024,
    post: true,
    multisampling: 0,
  },
  low: {
    name: "low",
    dpr: [1, 1],
    terrainSegments: 170,
    dissolveParticles: 14000,
    dissolveChunks: 160,
    energyParticles: 1200,
    fractureParticles: 800,
    shards: 110,
    streaks: 180,
    dust: 220,
    sandGrains: 0, // no hover on touch
    shadowMap: 0,
    post: false,
    multisampling: 0,
  },
};

export function detectTier() {
  if (typeof window === "undefined") return TIERS.medium;
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("quality");
  if (forced && TIERS[forced]) return TIERS[forced];

  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (coarse || small) return TIERS.low;
  const cores = navigator.hardwareConcurrency || 4;
  if (cores <= 4) return TIERS.medium;
  return TIERS.high;
}

export function detectWebGL() {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
