// The master clock of the journey. One GSAP timeline, scrubbed by one
// ScrollTrigger, tweens S.t from 0 to TOTAL; every frame the scene derives
// all of its named channels from it (evaluateChannels), so the whole world
// is a pure function of the scroll position: forward, backward or a jump
// always shows the same state.

export const TOTAL = 100;
export const S = { t: 0 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const lerp = (a, b, k) => a + (b - a) * k;
export const io = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const ss = (x) => x * x * (3 - 2 * x);
const keys = (t, pts) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1];
      const [t1, v1] = pts[i];
      return lerp(v0, v1, ss((t - t0) / (t1 - t0)));
    }
  }
  return pts[pts.length - 1][1];
};

// the six chapters (0–100); the last holds the walk round the tree, the
// drop and the ripple that hands over to the page
export const CHAPTER_RANGES = [
  [0, 14],
  [14, 30],
  [30, 46],
  [46, 62],
  [62, 78],
  [78, 100],
];
export const chapterAt = (t) => {
  for (let i = CHAPTER_RANGES.length - 1; i >= 0; i--) if (t >= CHAPTER_RANGES[i][0]) return i;
  return 0;
};

// when each chapter's words are on screen: in a little after its visual has
// begun to arrive, out before the next one's
export const BEATS = CHAPTER_RANGES.map(([a, b], i) => ({ a: i === 0 ? 0 : a + 1.8, b: i === CHAPTER_RANGES.length - 1 ? 93.5 : b - 0.6 }));

// the finale: a drop falls into the planter's water, and its ripple opens
// the page from the centre of the screen
export const DROP_FROM = 94.6;
export const DROP_HIT = 96.8;

// Every channel the world reads.
export const C = {
  t: 0,
  gap: 0, // how broken the orange path is (the challenge)
  soft: 0, // how softly it glows (the courtyard)
  panel: [0, 0, 0, 0], // each glass panel rising, in place
  panelLight: 0, // their edges lit
  gallery: [0, 0, 0, 0], // each project plane revealed
  tree: 0, // the courtyard's tree appearing
  drop: 0, // the drop's fall (0–1, hits the water at 1)
  white: 0, // the ripple opening onto the page (0–1)
  bright: 0,
  sun: 1,
  fog: 0.01,
  contrast: 0,
};

export function evaluateChannels(t, c = C) {
  c.t = t;
  c.gap = io(seg(t, 31.5, 37)) * (1 - io(seg(t, 47, 54)));
  for (let i = 0; i < 4; i++) c.panel[i] = io(seg(t, 47 + i * 1.6, 50 + i * 1.6));
  c.panelLight = io(seg(t, 53.5, 58));
  for (let i = 0; i < 4; i++) c.gallery[i] = io(seg(t, 63 + i * 1.9, 65.6 + i * 1.9));
  c.tree = io(seg(t, 77, 82));
  c.soft = io(seg(t, 78, 82));
  c.drop = seg(t, DROP_FROM, DROP_HIT);
  c.white = seg(t, DROP_HIT + 0.15, 100);
  c.bright = 0; // (night until the ripple opens the page)
  // light through the journey: calm and hazy, harder in the challenge,
  // open and bright under the courtyard's sky
  c.sun = keys(t, [
    [0, 1.7],
    [30, 2.0],
    [37, 2.6],
    [62, 2.3],
    [78, 2.3],
    [100, 2.7],
  ]);
  c.contrast = io(seg(t, 31, 38)) * (1 - io(seg(t, 47, 55)));
  c.fog = keys(t, [
    [0, 0.011],
    [14, 0.0085],
    [46, 0.0075],
    [78, 0.007],
    [100, 0.0065],
  ]);
  return c;
}
