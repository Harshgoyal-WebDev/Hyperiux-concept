import * as THREE from "three";
import { T } from "./tuning";

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
  // the GLB is Draco-compressed; the decoder is served from here (copied
  // from three/examples/jsm/libs/draco/gltf), not fetched from a CDN
  draco: "/draco/",
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
//   it in a burst of its light and comes on down into the oasis beyond
//   (world/oasis.js), the energy streaks running on ahead of it:
//   passage  – straight out of the cut (scene/CutTransition.jsx): the oasis
//              rises out of the desert behind a line of light
//   glow     – on along the stream, an amber glow ahead
//   reveal   – the last curve: the tree
//   canopy   – the beam runs into its core; the tree fills with light
//   outro    – the camera rises as the light opens onto the site
export const SCROLL_VH = {
  hero: 72,
  ground: 112,
  climb: 72,
  event: 200,
  after: 112,
  approach: 136,
  pass: 72,
  passage: 20, // straight out of the cut (inside it, mostly): the second scene is only its two lines
  glow: 70, // on along the stream, an amber glow ahead ("From concept to conversion")
  reveal: 110, // the last curve: the tree ("Potential deserves a place to grow")
  canopy: 233.1, // over the lake: the beam runs on into the cube at its heart
  grow: 283.0, // the cube turns out; the Yggdrasil grows out of it, the camera round it ("Growth you can see")
  outro: 100, // the camera rises as the light opens onto the site
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
  out: ends.pass, // clear of the slab
  passage: ends.passage,
  glow: ends.glow,
  reveal: ends.reveal,
  canopy: ends.canopy,
  grow: ends.grow,
};
// p of a point (0..1) inside the event
export const eventAt = (e) => P.core + e * (P.forged - P.core);
// p of a point (0..1) inside the orbit / hold stretch
export const afterAt = (e) => P.forged + e * (P.held - P.forged);
// p of a point (0..1) inside one of the zones past the mark
const ZONES_PAST = ["passage", "glow", "reveal", "canopy", "grow", "outro"];
const ZONE_START = Object.fromEntries(ZONES_PAST.map((z, i) => [z, i ? P[ZONES_PAST[i - 1]] : P.out]));
const ZONE_END = Object.fromEntries(ZONES_PAST.map((z) => [z, z === "outro" ? 1 : P[z]]));
export const zoneAt = (name, e) => ZONE_START[name] + e * (ZONE_END[name] - ZONE_START[name]);

// The cut from the logo to the valley (scene/CutTransition.jsx): by default
// from a third of the way through the approach — the logo still ahead — to
// a little way into the passage (tuning.js tlCutStart / tlCutEnd). Both
// shots keep moving at the same pace through it (world/oasisCamera.js); the
// valley camera takes over at CUT_TO.
export const CUT_FROM = () => Math.min(T.tlCutStart, T.tlCutEnd - 0.002);
export const CUT_TO = () => Math.max(T.tlCutEnd, P.through + 0.002);

// Where the camera goes through the forged mark, as composed in the
// timeline (world metres). The camera rig corrects the shots by the real
// opening's offset from this (the slab's placement depends on the sand).
export const OPENING_NOMINAL = new THREE.Vector3(0, 31, 6);

// The render layer the forge's world is on (the slab and the forged mark,
// the beam into it, the broken rock and its sand and embers): the logo shot
// sees it, the valley beyond the cut never does (scene/CutTransition.jsx,
// CameraRig), so nothing of it carries over into the oasis.
export const FORGE_LAYER = 2;
// ...and the one only the valley sees: the beam running on through it
// (it never shows leaving the logo before the cut)
export const VALLEY_LAYER = 3;
// ...and one the water's mirror leaves out: the low plants (grass, reeds,
// bushes) — barely seen in a reflection, a lot to draw twice
export const NO_MIRROR_LAYER = 4;

// The run at the opening starts from the event's still shot at this z;
// past the mark the camera carries on at the speed the run reaches the
// opening with (world/oasisCamera.js).
export const RUN_FROM_Z = 114; // camera z of the still shot (timeline.js EVENT_SHOT)

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
  { id: "o-rise", n: "15", label: "The oasis rises", start: P.out, end: P.passage },
  { id: "o-stream", n: "16", label: "Along the stream", start: P.passage, end: P.glow },
  { id: "o-tree", n: "17", label: "The tree", start: P.glow, end: P.reveal },
  { id: "o-cube", n: "18", label: "The cube", start: P.reveal, end: P.canopy },
  { id: "o-growth", n: "19", label: "Growth", start: P.canopy, end: P.grow },
  { id: "o-outro", n: "20", label: "Into the light", start: P.grow, end: 1 },
];


// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------
export const PALETTE = {
  basalt: "#3a332e",
  sand: "#b4683c",
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
    veg: 1, // the oasis's vegetation (share of its full density)
    reflections: true, // the water mirrors the oasis and the tree
    dust: 700,
    // soil swirl: most grains / dust it can draw (Leva picks how many)
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
    veg: 0.7,
    reflections: true,
    dust: 450,
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
    veg: 0.4,
    reflections: false,
    dust: 220,
    maxCrumble: 10000,
    maxGravel: 600,
    sandGrains: 0, // no hover on touch
    shadowMap: 0,
    post: false,
    multisampling: 0,
  },
};

// The graphics card's name, as the browser reports it ("ANGLE (Intel, Intel(R)
// UHD Graphics 620 Direct3D11 …)"), or "".
function gpuName() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return name;
  } catch {
    return "";
  }
}

// The quality the device starts at (the frame-rate governor, quality.js, can
// still step it down as it runs). ?quality=high|medium|low forces it.
export function detectTier() {
  if (typeof window === "undefined") return TIERS.medium;
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("quality");
  if (forced && TIERS[forced]) return TIERS[forced];

  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (coarse || small) return TIERS.low;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8; // GB (Chromium only; capped at 8)
  const gpu = gpuName();
  // software rendering, old and everyday integrated graphics (Intel HD / UHD,
  // the typical older Windows laptop), very few cores or little memory: low
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return TIERS.low;
  if (/intel/i.test(gpu) && /(hd|uhd) graphics|gma/i.test(gpu)) return TIERS.low;
  if (cores <= 2 || memory <= 2) return TIERS.low;
  // better integrated graphics (Intel Iris, AMD's Radeon / Vega in a laptop
  // chip), four cores or 4 GB: medium
  if (/intel/i.test(gpu) || /radeon\(tm\)? (graphics|vega|r[2-7])|vega \d/i.test(gpu)) return TIERS.medium;
  if (cores <= 4 || memory <= 4) return TIERS.medium;
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
