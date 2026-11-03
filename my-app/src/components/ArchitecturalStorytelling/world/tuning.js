// Live-tunable values of the world. The Leva panel (TuningPanel.jsx) writes
// straight into these objects; the scene reads them every frame (LOOK,
// DEBUG), the camera rig rebuilds when a key changes (KEYS, in layout.js),
// and the world is rebuilt when its layout changes (LAYOUT). Defaults are the
// shipped look.

// the look: the theme's colours and tones, the lines, fog, parallax
export const LOOK = {
  darkBg: "#111111",
  darkInk: "#ffffff",
  lightBg: "#ffffff",
  lightInk: "#111111",
  accent: "#ff5f00",
  guide: "#777777",
  // alpha of ink, guide, accent, faint — in the dark, and in the light
  darkToneInk: 0.92,
  darkToneGuide: 0.62,
  darkToneFaint: 0.22,
  lightToneInk: 0.88,
  lightToneGuide: 0.62,
  lightToneFaint: 0.3,
  toneAccent: 1,
  // the dark ground turns light over this window of world time (08 → 09)
  lightFrom: 8.05,
  lightTo: 8.6,
  lineWidth: 1, // × every line's weight
  // fog round the camera's subject: from near × framing to far × framing
  fogNear: 2.4,
  fogFar: 6.5,
  // the camera leaning after the mouse
  leanYaw: 3.2,
  leanPitch: 2.2,
  leanShift: 0.025,
  leanEase: 3,
  // the scroll's inertia (higher follows the wheel more tightly)
  scrollEase: 7,
  labelOpacity: 1,
  markFill: 1,
};

// the layout of the scenes (a change rebuilds the world)
export const LAYOUT = {
  // 06 the structure: the mark as a floor plan round the core, risen
  planScale: 0.02, // world units per logo unit
  planUprightH: 2.2, // the two uprights' height
  planBridgeH: 1.1, // the two bridges' height
  planStart: 5.0, // when its plan is drawn on the ground
  planRise: 0.55, // how long it takes to rise
  // 07 who we are: the five connections, and the ring that closes them
  nodeOut: 5.5, // how far the nodes stand from the plan
  nodeH: 2, // their height in levels
  ringAt: 6.36, // when the ring closes
  growthAt: 6.68, // when Growth lights and the thread leaves
  // 08 human first: a scale figure in the journey's ring
  humanX: 20,
  humanZ: 9.5,
  humanRing: 3.2,
  humanHeight: 1.8,
  humanFacing: -18, // degrees: the figure faces the camera as 08 opens
  touchSize: 0.6,
  touchStep: 0.28, // each touchpoint this much taller than the last
  // 17 impact: the clients' cubes, logos on their tops
  clientSize: 1.5,
  clientGapX: 2.05,
  clientGapZ: 2.5,
  clientBase: 1, // the first cube's height in levels
  clientStep: 0.35, // the wave: each diagonal this much taller
  clientStart: 15.72,
  clientStagger: 0.045,
  logoSize: 0.8, // of the top face
  logoTurn: -20, // degrees: logos turned to read upright from the camera
};

// debug: hold the world at one time
export const DEBUG = { lock: false, W: 5 };

const layoutListeners = new Set();
export function onLayout(fn) {
  layoutListeners.add(fn);
  return () => layoutListeners.delete(fn);
}
let pending = 0;
// (debounced: a slider dragged rebuilds once it rests)
export function layoutChanged() {
  clearTimeout(pending);
  pending = setTimeout(() => layoutListeners.forEach((fn) => fn()), 120);
}
