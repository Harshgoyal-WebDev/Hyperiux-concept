import { C } from "./tuning";

// The page's one scroll story, as plain numbers: everything that moves reads
// it, so the whole page is one continuous, reversible motion.
//
// The pinned track (TRACK_VH) is scrolled through once (p: 0 → 1):
//   hero    the desert, the words over it                       0.00 – 0.08
//   reach   the two hands come in, their index fingers reaching  0.06 – 0.50
//   touch   the fingertips meet: a flash                         0.50
//   glow    the light runs back over both hands                  0.50 – 0.64
//   cut     from the centre, the glass discs open onto the page  0.54 – 0.84
//           (just after the touch, as the glow spreads: tuning.js)
// Past the track, the contact section (under it all along) scrolls on.

export const TRACK_VH = 620;

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const span = (p, a, b) => clamp01((p - a) / (b - a));
const easeOut = (x, k = 2.4) => 1 - Math.pow(1 - x, k);

export const TOUCH_AT = 0.5;
// the cut: from just after the touch — as the glow spreads over the hands
export const cutSpan = () => {
  const a = TOUCH_AT + Math.max(C.cutDelay, 0);
  return [a, Math.min(a + Math.max(C.cutLength, 0.02), 0.995)];
};

export function createStory() {
  return { p: 0, hero: 1, reach: 0, wake: 0, flash: 0, glow: 0, cut: 0, done: false };
}

// the story at scroll progress p (written into s)
export function tell(p, s) {
  s.p = p;
  // (in from the first scroll, easing into the touch — no pause on the way)
  s.reach = easeOut(span(p, 0.06, TOUCH_AT));
  // the hero's words blur away once the hands are a little way in
  // (C.heroOutFrom → C.heroOutTo of their reach)
  s.hero = 1 - clamp01((s.reach - C.heroOutFrom) / Math.max(C.heroOutTo - C.heroOutFrom, 0.01));
  // the moment they meet: in at once, settling to a soft light
  const [c0, c1] = cutSpan();
  const t = span(p, TOUCH_AT - 0.005, TOUCH_AT + 0.08);
  s.flash = p < TOUCH_AT - 0.005 ? 0 : Math.min(t * 12, 1) * (1 - 0.75 * t) * (1 - span(p, c0 + 0.04, c0 + 0.16));
  // (the light runs back over the hands, still going as the cut opens)
  s.glow = span(p, TOUCH_AT, TOUCH_AT + 0.14);
  // (the hands' own light, coming up to full as they meet)
  const w = span(p, TOUCH_AT - 0.01, TOUCH_AT + 0.05);
  s.wake = w * w * (3 - 2 * w);
  // (under way at once — no slow first stretch — easing as it opens out)
  const ct = span(p, c0, c1);
  s.cut = 1 - Math.pow(1 - ct, 1.8);
  s.done = p >= c1;
  return s;
}
