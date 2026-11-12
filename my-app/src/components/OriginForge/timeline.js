// The Origin Forge's one timeline.
//
// The whole opening runs on a single clock, `t`, from 0 to TOTAL. GSAP owns
// it: a paused master timeline, scrubbed by the pinned section's
// ScrollTrigger, tweens S.t and every DOM overlay (HyperiuxExperience.jsx).
// Each frame, the scene derives all of its named channels from S.t with
// `evaluateChannels` below, so camera, models, particles, lights and text
// all answer to the same scroll position and reverse with it, and jumping
// anywhere renders that moment exactly.

import { PILLARS, STEPS } from "./content";

export const TOTAL = 100;
// scroll length of one timeline unit (in viewport heights)
export const VH_PER_UNIT = 30;

// the shared clock (written by GSAP, read by the scene)
export const S = { t: 0 };

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const lerp = (a, b, k) => a + (b - a) * k;
export const io = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eo = (x) => 1 - Math.pow(1 - x, 3);
export const ss = (x) => x * x * (3 - 2 * x);
// up over [a, a+e], down over [b-e, b]
export const bell = (t, a, b, e = 1.2) => seg(t, a, a + e) * (1 - seg(t, b - e, b));

// ---------------------------------------------------------------------------
// Chapters (the rail) and beats (the overlays). Beat times are in t units.

export const CHAPTERS = [
  { name: "Awakening", a: 0, b: 18 },
  { name: "Four forces", a: 18, b: 42 },
  { name: "The forge", a: 42, b: 63 },
  { name: "The gateway", a: 63, b: 81 },
  { name: "The ascent", a: 81, b: 100 },
];

const P = PILLARS;
export const BEATS = [
  { n: "01", label: "The Awakening", a: 0, b: 4.2, kind: "hero" },
  { n: "02", label: "A Forgotten Realm", a: 4.2, b: 9, body: "The origin of ideas, craft and creation." },
  { n: "03", label: "The Core Signal", a: 9, b: 13.5, body: "A dormant energy begins to awaken." },
  { n: "04", label: "The Resonance", a: 13.5, b: 18, body: "Energy ripples across the space." },
  { n: "05", label: "The Four Forces", a: 18, b: 22.6, body: "Four fundamental forces come to life." },
  ...P.map((p, i) => ({ n: p.n, label: p.name, a: 22.6 + i * 4, b: 26.6 + i * 4, kind: "pillar", title: p.name, body: p.line })),
  { n: "10", label: "Aligning the Forces", a: 38.6, b: 42, body: "Four disciplines. One connected system." },
  { n: "11", label: "The Convergence", a: 42, b: 46.5, body: "Ideas, design, technology and growth come together." },
  { n: "12", label: "Energy in Motion", a: 46.5, b: 50.5, body: "A unified force begins to form." },
  { n: "13", label: "The Formation", a: 50.5, b: 54.5, body: "Structure emerges from raw energy." },
  { n: "14", label: "Structure Takes Shape", a: 54.5, b: 58.6, body: "Every edge is deliberate." },
  { n: "15", label: "The Hyperiux Mark", a: 58.6, b: 63, kind: "mark", body: "Four forces. One identity." },
  { n: "16", label: "The Activation", a: 63, b: 66.2, body: "The identity becomes a gateway." },
  { n: "17", label: "The Gate Opens", a: 66.2, b: 69.6, body: "Behind the mark, a passage." },
  { n: "18", label: "Entering Hyperiux", a: 69.6, b: 73.2, body: "Through the identity, into the work." },
  { n: "19", label: "The Inner Realm", a: 73.2, b: 77.2, body: "A space where ideas take form." },
  { n: "20", label: "The Journey Ahead", a: 77.2, b: 81, body: "From darkness into light." },
  { n: "21", label: "Our Process", a: 81, b: 84.2, kind: "process", body: "A focused, end-to-end journey from idea to scale." },
  ...STEPS.map((s, i) => ({ n: String(22 + i), label: `Step ${s.n} — ${s.name}`, a: 84.2 + i * 3, b: 87.2 + i * 3, kind: "step", step: s })),
  { n: "26", label: "The Ascent", a: 96.2, b: 98.4, body: "A culmination of ideas, execution and growth." },
  { n: "27", label: "The Summit", a: 98.4, b: 100, kind: "summit" },
];

// the overlay text turns dark once the staircase's light takes over
export const LIGHT_TONE_AT = 79.6;

// Stage of the staircase each process step lights (and where the camera
// stops for it), as arc-length positions along the stair (world/stair.js).
export const STAGE_U = [0.2, 0.42, 0.64, 0.86];
export const STAGE_T = STEPS.map((_, i) => 84.2 + i * 3);

// ---------------------------------------------------------------------------
// Channels: every animated quantity of the scene, as a function of t.

export const C = {
  t: 0,
  rise: [0, 0, 0, 0],
  pillar: [0, 0, 0, 0],
  stage: [0, 0, 0, 0],
};

export function evaluateChannels(t, c = C) {
  c.t = t;
  // Chapter 1: awakening
  c.horizon = 0.35 + 0.65 * io(seg(t, 0, 8));
  c.core = io(seg(t, 9.4, 13.4));
  c.markings = io(seg(t, 10.8, 15.5));
  c.rings = seg(t, 12.8, 16) * (1 - seg(t, 46, 52));
  c.attract = io(seg(t, 14, 18.5)) * (1 - io(seg(t, 40, 44.5)));

  // Chapter 2: the four forces
  for (let i = 0; i < 4; i++) {
    c.rise[i] = eo(seg(t, 18 + i * 0.85, 21.4 + i * 0.85));
    const a = 22.6 + i * 4;
    const spot = bell(t, a + 0.2, a + 4.2, 1.3); // its own beat
    const after = 0.38 * seg(t, a + 3, a + 4); // stays awake afterwards
    const align = io(seg(t, 38.6, 41)); // all four at once
    c.pillar[i] = Math.max(0.1 * c.rise[i], spot, after, align);
  }

  // Chapter 3: convergence and the forging
  c.links = io(seg(t, 40.8, 45)) * (1 - seg(t, 49.5, 53));
  c.orbit = io(seg(t, 42, 47)) * (1 - io(seg(t, 58.5, 63)));
  c.gather = io(seg(t, 46.5, 54));
  c.detach = seg(t, 47.5, 54.5);
  c.absorb = io(seg(t, 51.5, 56.6));
  c.forge = seg(t, 48.5, 57.5);
  c.trace = io(seg(t, 50.8, 57));
  c.mark = io(seg(t, 53, 58.6));
  c.cube = io(seg(t, 54.6, 59));
  c.coreLift = io(seg(t, 51.5, 57.5));

  // Chapter 4: the gateway
  c.hot = io(seg(t, 62.6, 66));
  c.corridorRise = io(seg(t, 59.5, 66));
  c.open = io(seg(t, 66.2, 70));
  c.disperse = seg(t, 66, 73.5);
  c.corridorLight = seg(t, 63, 77.5);
  c.light = io(seg(t, 77.4, 81.4));

  // Chapter 5: the ascent
  c.stairReveal = seg(t, 77.4, 81.2); // done before the climb begins
  for (let i = 0; i < 4; i++) c.stage[i] = io(seg(t, STAGE_T[i] + 0.2, STAGE_T[i] + 1.9));
  c.summit = io(seg(t, 95, 99.2));
  c.rail = seg(t, 96.4, 99.4);
  return c;
}

// which chapter / beat a time falls in
export function chapterAt(t) {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (t >= CHAPTERS[i].a) return i;
  return 0;
}
