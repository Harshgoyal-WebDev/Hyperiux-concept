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
//   then the camera approaches the cube outline's opening, passes through
//   it in a burst of its light and flies on over the open dunes beyond,
//   towards the low sun, the beam running on ahead of it over the sand.
//   pillars  – vertical rocks grow up out of the sand on the way; four carry
//              a glowing pin (click: a close-up of the rock and its copy)
//   whiteout – a wave of white spreads out from just ahead of the camera;
//              the land turns white, the dunes left as a black contour
//              drawing, the beam running on over it
//   dissolve – the rocks turn to sand and blow away
//   outro    – the light opens onto the site
export const SCROLL_VH = {
  hero: 90,
  ground: 140,
  climb: 90,
  event: 200,
  after: 140,
  approach: 170,
  pass: 90,
  dunes: 200, // out over the dunes, the beam racing on ahead
  pillars: 720, // the rocks grow up beside the beam
  whiteout: 260, // the land turns white
  dissolve: 280, // the rocks turn to sand
  outro: 150, // the light opens onto the site
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
  held: ends.after, // the forged hero's last frame: the flight through the mark starts here
  pass: ends.approach, // at the opening
  through: ends.approach + (ends.pass - ends.approach) * 0.5, // inside the mark, in its light
  out: ends.pass, // clear of the slab, over the open dunes
  dunes: ends.dunes,
  pillars: ends.pillars,
  whiteout: ends.whiteout,
  dissolve: ends.dissolve,
};
// p of a point (0..1) inside the event
export const eventAt = (e) => P.core + e * (P.forged - P.core);
// p of a point (0..1) inside the orbit / hold stretch
export const afterAt = (e) => P.forged + e * (P.held - P.forged);
// p of a point (0..1) inside one of the zones past the mark
const ZONE_START = { dunes: P.out, pillars: P.dunes, whiteout: P.pillars, dissolve: P.whiteout, outro: P.dissolve };
const ZONE_END = { dunes: P.dunes, pillars: P.pillars, whiteout: P.whiteout, dissolve: P.dissolve, outro: 1 };
export const zoneAt = (name, e) => ZONE_START[name] + e * (ZONE_END[name] - ZONE_START[name]);

// Where the camera goes through the forged mark, as composed in the
// timeline (world metres). The camera rig corrects the shots by the real
// opening's offset from this (the slab's placement depends on the sand).
export const OPENING_NOMINAL = new THREE.Vector3(0, 31, 6);

// The flight on over the dunes (world/duneCamera.js). The run at the opening
// starts from the event's still shot at this z; the flight carries on at
// the speed the run reaches the opening with.
export const DUNES = {
  runFrom: 114, // camera z of the still shot (timeline.js EVENT_SHOT)
  height: 20, // cruising height (clears the crests on the way by ~9 m)
  weave: 16, // the flight's sway from side to side (m)
  weaveLength: 340, // ...over this many metres
  look: 110, // how far ahead it looks
  drop: 7, // ...and how far down (m at that distance)
  fov: 50,
  slowTo: 0.4, // the flight's pace at the end (× cruising), slowing from the whiteout on
  beamLead: 170, // how far ahead of the camera the beam's head runs (m)
  beamHeight: 4.5, // ...and how high over the sand
  whiteAhead: 70, // where the white spreads out from: this far ahead of the camera as it starts
};

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
  // through the mark, on over the dunes
  { id: "d-forged", n: "11", label: "Forged logo", start: P.held, end: P.held + (P.pass - P.held) * 0.35 },
  { id: "d-approach", n: "12", label: "Approach", start: P.held + (P.pass - P.held) * 0.35, end: P.pass },
  { id: "d-pass", n: "13", label: "Pass through", start: P.pass, end: P.out },
  { id: "d-dunes", n: "14", label: "Dunes", start: P.out, end: P.dunes },
  { id: "d-pillars", n: "15", label: "Pillars", start: P.dunes, end: P.pillars },
  { id: "d-whiteout", n: "16", label: "Whiteout", start: P.pillars, end: P.whiteout },
  { id: "d-dissolve", n: "17", label: "Dissolve", start: P.whiteout, end: P.dissolve },
  { id: "d-outro", n: "18", label: "Into the light", start: P.dissolve, end: 1 },
];

// Labels on the bottom progress rail, at their p.
export const RAIL = [
  { label: "Hero", at: 0 },
  { label: "Beam", at: P.hero },
  { label: "Forging", at: eventAt(0.5) },
  { label: "Orbits", at: P.forged },
  { label: "Through", at: P.held },
  { label: "Dunes", at: P.out },
  { label: "Pillars", at: P.dunes },
  { label: "White", at: P.pillars },
  { label: "Dissolve", at: P.whiteout },
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
    dpr: [1, 1.25],
    terrainSegments: 480,
    pillarGrains: 60000, // sand the rocks turn into
    dust: 700,
    // soil swirl: most grains / dust it can draw (Leva picks how many)
    maxGrains: 12000,
    maxCrumble: 60000, // sand the broken rock turns into
    maxGravel: 4000, // ...and gravel
    sandGrains: 16000,
    shadowMap: 2048,
    post: true,
    multisampling: 2,
  },
  medium: {
    name: "medium",
    dpr: [1, 1.2],
    terrainSegments: 350,
    pillarGrains: 32000,
    dust: 450,
    maxGrains: 6000,
    maxCrumble: 30000,
    maxGravel: 2000,
    sandGrains: 10000,
    shadowMap: 1024,
    post: true,
    multisampling: 0,
  },
  low: {
    name: "low",
    dpr: [1, 1],
    terrainSegments: 240,
    pillarGrains: 12000,
    dust: 220,
    maxGrains: 2000,
    maxCrumble: 10000,
    maxGravel: 600,
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
