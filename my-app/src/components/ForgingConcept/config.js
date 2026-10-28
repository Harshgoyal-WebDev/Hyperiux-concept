import * as THREE from "three";

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------
// The Blender forging asset (blender/forging/hyperiux_forging.blend). The
// loader verifies the hierarchy described in the metadata JSON before using
// it: MonolithRoot > { BeamOrigin, LogoRoot > { HyperiuxLogoCore,
// CoreSphereAnchor, BeamTarget }, SlabExcessChunks > BreakGroup_0N_* >
// SlabChunk_### }, with every Cracks_* strip parented to the stone it lies on.
export const ASSETS = {
  forgeGlb: "/models/hyperiux-forging-assets.glb",
  forgeMeta: "/models/hyperiux-forging-metadata.json",
  gardenGlb: "/models/hyperiux-garden-environment.glb",
  gardenMeta: "/models/hyperiux-garden-metadata.json",
};

// The asset is authored in metres (10 × 12 × 2.4 m slab). It is scaled up
// uniformly to monument size and its base buried a little in the sand.
export const FORGE = {
  scale: 5,
  sink: 1.2, // world metres below the sand at the slab's base
};

// ---------------------------------------------------------------------------
// Scroll timeline
// ---------------------------------------------------------------------------
// Scroll travel of each part of the hero, in vh. The timeline runs on the
// scroll fraction p (0..1) of the pinned section.
//   hero    – the slab, copy on screen
//   ground  – the beam runs along the sand to the foot of the slab
//   climb   – it rises into the core (scrolled freely and smoothly)
//   event   – core → cracks → breakup → forged logo. Always auto-scrolled
//             (input locked) in either direction; the camera holds still
//   after   – the swirl around the forged hero
//   then the garden: the camera approaches the cube outline's opening,
//   passes through it into daylight, the garden is revealed and settles,
//   the particle logo assembles over the pond, and the final scene holds.
export const SCROLL_VH = {
  hero: 90,
  ground: 140,
  climb: 90,
  event: 200,
  after: 140,
  approach: 170,
  pass: 90,
  reveal: 170,
  settle: 80,
  assemble: 230,
  final: 120,
};
const TOTAL_VH = Object.values(SCROLL_VH).reduce((a, b) => a + b, 0);
// + one screen: the pinned viewport itself
export const JOURNEY_VH = TOTAL_VH + 100;

// p at the end of each zone
const ends = {};
let sum = 0;
for (const [k, v] of Object.entries(SCROLL_VH)) ends[k] = (sum += v) / TOTAL_VH;
export const P = {
  hero: ends.hero,
  climb: ends.ground,
  core: ends.climb,
  forged: ends.event,
  held: ends.after, // the forged hero's last frame: the garden journey starts here
  pass: ends.approach, // at the opening
  through: ends.approach + (ends.pass - ends.approach) * 0.5, // at the window behind the ring
  out: ends.pass, // clear of the mark, in daylight
  revealed: ends.reveal,
  settled: ends.settle,
  assembled: ends.assemble,
};
// p of a point (0..1) inside the event
export const eventAt = (e) => P.core + e * (P.forged - P.core);
// p of a point (0..1) inside the orbit / hold stretch
export const afterAt = (e) => P.forged + e * (P.held - P.forged);
// p of a point (0..1) inside the particle assembly
export const assembleAt = (e) => P.settled + e * (P.assembled - P.settled);

// Where the camera goes through the forged mark, as composed in the
// timeline (world metres). The camera rig corrects the shots by the real
// opening's offset from this (the slab's placement depends on the sand).
export const OPENING_NOMINAL = new THREE.Vector3(0, 31, 6);

// The garden (hyperiux-garden-environment.glb, its own metres: pond centred
// on the origin at water level y = -0.25, the camera arriving from +z). The
// two worlds are never drawn together, so the garden is simply placed where
// the camera comes out of the light: its GardenEntrance a few metres ahead
// of the cube outline's opening, so the flight through the light carries
// straight on into the garden. Anchors from hyperiux-garden-metadata.json
// (checked against the GLB's SceneAnchors when it loads).
export const GARDEN = {
  entrance: new THREE.Vector3(0, 2.6849, 24),
  pond: new THREE.Vector3(0, -0.25, 0),
  water: -0.25,
  logo: new THREE.Vector3(0, 6.2, -2), // the particle logo's centre (~7.6 × 8.5 m)
  pondAxes: [9.5, 6.5], // the pond's semi-axes (x, z)
};
// garden metres → world: the entrance lands 6 m beyond the opening
export const GARDEN_ORIGIN = new THREE.Vector3(OPENING_NOMINAL.x, OPENING_NOMINAL.y - GARDEN.entrance.y, 0.3 - (GARDEN.entrance.z + 6));
export const gardenToWorld = (x, y, z) => [x + GARDEN_ORIGIN.x, y + GARDEN_ORIGIN.y, z + GARDEN_ORIGIN.z];

// Ten visual states as ranges of p. Everything in between is interpolated.
export const STATES = [
  { id: "monolith", n: "01", label: "Monolith", start: 0, end: P.hero },
  { id: "beam", n: "02", label: "Beam", start: P.hero, end: P.climb },
  { id: "core", n: "03", label: "Core", start: P.climb, end: P.core },
  { id: "energy", n: "04", label: "Energy", start: P.core, end: eventAt(0.25) },
  { id: "activation", n: "05", label: "Activation", start: eventAt(0.25), end: eventAt(0.5) },
  { id: "break", n: "06", label: "Break", start: eventAt(0.5), end: eventAt(0.68) },
  { id: "reveal", n: "07", label: "Reveal", start: eventAt(0.68), end: eventAt(0.86) },
  { id: "forged", n: "08", label: "Forged", start: eventAt(0.86), end: P.forged },
  { id: "orbits", n: "09", label: "Orbits", start: P.forged, end: afterAt(0.5) },
  { id: "hold", n: "10", label: "Hold", start: afterAt(0.5), end: P.held },
  // the garden
  { id: "g-forged", n: "11", label: "Forged logo", start: P.held, end: P.held + (P.pass - P.held) * 0.35 },
  { id: "g-approach", n: "12", label: "Approach", start: P.held + (P.pass - P.held) * 0.35, end: P.pass },
  { id: "g-pass", n: "13", label: "Pass through", start: P.pass, end: P.through },
  { id: "g-daylight", n: "14", label: "Daylight", start: P.through, end: P.out },
  { id: "g-landscape", n: "15", label: "Landscape", start: P.out, end: P.revealed },
  { id: "g-settle", n: "16", label: "Settle", start: P.revealed, end: P.settled },
  { id: "g-particles", n: "17", label: "Particles", start: P.settled, end: assembleAt(0.3) },
  { id: "g-forms", n: "18", label: "Logo forms", start: assembleAt(0.3), end: assembleAt(0.75) },
  { id: "g-refine", n: "19", label: "Refine", start: assembleAt(0.75), end: P.assembled },
  { id: "g-final", n: "20", label: "Final", start: P.assembled, end: 1 },
];

// Labels on the bottom progress rail, at their p.
export const RAIL = [
  { label: "Hero", at: 0 },
  { label: "Beam", at: P.hero },
  { label: "Core", at: P.climb },
  { label: "Activation", at: eventAt(0.04) },
  { label: "Forging", at: eventAt(0.5) },
  { label: "Orbits", at: P.forged },
  { label: "Through", at: P.held },
  { label: "Garden", at: P.out },
  { label: "Logo", at: P.settled },
];

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------
export const PALETTE = {
  orange: "#FF5F00",
  basalt: "#3a332e",
  sand: "#b4683c",
  white: "#FFFFFF",
};

// Low sunset sun, behind the slab and to the right of the hero view (the
// sand-dune concept's sun): it backlights the dunes and sits in the shot.
export const SUN_DIR = new THREE.Vector3(0.47, 0.075, -0.88).normalize();
// Direction the wind blows TOWARDS on the ground plane (x, z).
export const WIND_DIR = new THREE.Vector2(-0.8, -0.6).normalize();

// ---------------------------------------------------------------------------
// Quality tiers
// ---------------------------------------------------------------------------
export const TIERS = {
  high: {
    name: "high",
    dpr: [1, 1.5],
    terrainSegments: 300,
    dust: 700,
    // soil swirl: most grains / dust it can draw (Leva picks how many)
    maxGrains: 12000,
    maxCrumble: 60000, // sand the broken rock turns into
    maxGravel: 4000, // ...and gravel
    sandGrains: 16000,
    gardenGrass: 1, // share of the garden's grass clumps drawn
    gardenBlades: 140000, // the lawn's blades
    gardenBushes: 40, // bushes planted beyond the GLB's own
    gardenFlowers: 260, // ...and flower clusters
    pondReflection: 0.5, // the pond's mirror, at this share of the canvas (0: sky only)
    logoPoints: 32400, // the bubble logo
    shadowMap: 2048,
    post: true,
    multisampling: 2,
  },
  medium: {
    name: "medium",
    dpr: [1, 1.4],
    terrainSegments: 220,
    dust: 450,
    maxGrains: 6000,
    maxCrumble: 30000,
    maxGravel: 2000,
    sandGrains: 10000,
    gardenGrass: 0.6,
    gardenBlades: 70000,
    gardenBushes: 28,
    gardenFlowers: 160,
    pondReflection: 0.35,
    logoPoints: 16384,
    shadowMap: 1024,
    post: true,
    multisampling: 0,
  },
  low: {
    name: "low",
    dpr: [1, 1],
    terrainSegments: 150,
    dust: 220,
    maxGrains: 2000,
    maxCrumble: 10000,
    maxGravel: 600,
    sandGrains: 0, // no hover on touch
    gardenGrass: 0.3,
    gardenBlades: 30000,
    gardenBushes: 12,
    gardenFlowers: 60,
    pondReflection: 0,
    logoPoints: 8100,
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
