import gsap from "gsap";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import { BEATS } from "./content";

// The one source of the story's progress. A single ScrollTrigger (Intro.jsx)
// measures the opening, from its top to the moment the first white section
// (16, Arrival) is centred; every frame the ticker turns the scroll into the
// master timeline's time, and the timeline writes STATE: what the particles,
// the sculpture, the energy point, the light and the copy read. Nothing
// else animates those properties, and nothing goes through React state.

// (registered here, before any component makes a trigger)
gsap.registerPlugin(ScrollTrigger);

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// the beats on the timeline: one unit of `w` = one unit of time; Arrival
// (16) closes it
const ARRIVAL_W = 1.2;
export const SPANS = [];
{
  let t = 0;
  for (const b of [...BEATS, { n: 16, w: ARRIVAL_W }]) {
    SPANS[b.n] = { start: t, end: t + b.w, mid: t + b.w / 2, w: b.w };
    t += b.w;
  }
}
export const DURATION = SPANS[16].end;
// a time inside beat n (0 its start, 1 its end)
export const at = (n, f = 0) => SPANS[n].start + SPANS[n].w * f;

export const STORY = {
  p: 0, // the opening's scroll, 0 → 1 (and past it, below the arrival)
  t: 0, // the timeline's time
  after: 0, // screens scrolled past the arrival's centre
  boot: 0, // the first darkness lifting, on load
  reduced: false,
  mobile: false,
  camera: null, // the scene's camera, for copy pinned to the world (07)
  trigger: null,
};

// what the timeline animates
export const STATE = {
  stage: 0, // particle state (world/states.js), fractional while moving on
  reveal: 0.02, // share of the particles present
  flow: 0.6, // the currents' strength
  links: 0, // the network's lines
  sculpt: 0, // the glass sculpture
  spread: 0, // its layers drawn apart (engineering)
  dissolve: 0, // its surface returning to particles
  light: 0, // dark → white
  shift: 0, // the scene's offset across the screen (copy on the left)
  energy: 0.5, // the idea's brightness
  ring: 0, // its halo (05)
  labels: 0, // the disciplines (07)
};

function buildTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "sine.inOut" } });
  const to = (vars, n0, f0, n1, f1) => tl.to(STATE, { ...vars, duration: Math.max(at(n1, f1) - at(n0, f0), 1e-3) }, at(n0, f0));

  // ACT 01 — curiosity
  to({ reveal: 0.05 }, 1, 0, 1, 1);
  to({ stage: 1, reveal: 0.4 }, 2, 0, 2, 1);
  to({ stage: 2, reveal: 1 }, 3, 0, 3, 1);
  to({ shift: 0.34, flow: 0.42, energy: 0.6 }, 4, 0, 4, 0.35);
  to({ shift: 0, energy: 1, ring: 1 }, 5, 0, 5, 0.35);
  to({ ring: 0 }, 5, 0.8, 6, 0.1);
  // ACT 02 — connection
  to({ stage: 3, links: 1, shift: 0.22, flow: 0.5 }, 6, 0, 6, 0.75);
  to({ stage: 4, shift: 0 }, 7, 0, 7, 0.6);
  to({ labels: 1 }, 7, 0.3, 7, 0.5);
  to({ labels: 0 }, 7, 0.85, 8, 0.05);
  to({ stage: 5, links: 0.35 }, 8, 0, 8, 0.9);
  to({ stage: 6, sculpt: 1, links: 0, flow: 0.3 }, 9, 0, 9, 1);
  // ACT 03 — creation
  to({ shift: 0.33 }, 10, 0, 10, 0.4);
  to({ spread: 1, links: 0.55 }, 11, 0, 11, 0.5);
  to({ spread: 0, links: 0 }, 11, 0.7, 12, 0.3);
  to({ shift: 0.14 }, 12, 0.2, 12, 0.9);
  to({ stage: 7, dissolve: 1, shift: 0, flow: 0.55 }, 13, 0, 13, 1);
  // ACT 04 — impact
  to({ light: 0.55, energy: 1.4 }, 14, 0.2, 14, 1);
  to({ stage: 8, light: 1, energy: 1, flow: 0.35 }, 15, 0, 15, 1);
  to({ stage: 9 }, 16, 0, 16, 1);
  tl.set({}, {}, DURATION);
  return tl;
}

let tl = null;
const listeners = new Set();
export const onStory = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function tick() {
  const st = STORY.trigger;
  if (st) {
    const span = Math.max(st.end - st.start, 1);
    STORY.p = (window.scrollY - st.start) / span;
    STORY.after = Math.max(0, window.scrollY - st.end) / window.innerHeight;
  }
  STORY.t = clamp(STORY.p) * DURATION;
  tl.time(STORY.t);
  listeners.forEach((fn) => fn(STORY, STATE));
}

// start the clock (once per page; returns its stop)
let running = 0;
let bootTween = null;
export function startStory({ reduced, mobile }) {
  STORY.reduced = reduced;
  STORY.mobile = mobile;
  if (!tl) tl = buildTimeline();
  bootTween?.kill();
  STORY.boot = reduced ? 1 : 0;
  if (!reduced) bootTween = gsap.to(STORY, { boot: 1, duration: 2.6, ease: "power2.inOut", delay: 0.2 });
  if (running++ === 0) gsap.ticker.add(tick);
  return () => {
    bootTween?.kill();
    if (--running === 0) gsap.ticker.remove(tick);
  };
}

// a beat's own progress at the current time (0 before it, 1 after it)
export const beatQ = (n) => clamp((STORY.t - SPANS[n].start) / SPANS[n].w);

// the scroll at which beat n is at fraction f (for the CTA, the nav)
export function scrollFor(n, f = 0.5) {
  const st = STORY.trigger;
  if (!st) return 0;
  return st.start + (at(n, f) / DURATION) * (st.end - st.start);
}
