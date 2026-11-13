// The dark version's clock: nine chapters on the same master clock (S.t,
// 0–100) and the same channel object (C) as the light one, with its own
// channels: the spark, the floating blocks, the arcs aligning and
// assembling into rings, the core, the reveal and the light it ends in.
import { C, io, lerp, seg, ss } from "../timeline";

export const NIGHT_RANGES = [
  [0, 11],
  [11, 22],
  [22, 33],
  [33, 44],
  [44, 55],
  [55, 66],
  [66, 77],
  [77, 88],
  [88, 100],
];
export const nightChapterAt = (t) => {
  for (let i = NIGHT_RANGES.length - 1; i >= 0; i--) if (t >= NIGHT_RANGES[i][0]) return i;
  return 0;
};
export const NIGHT_BEATS = NIGHT_RANGES.map(([a, b], i) => ({ a: i === 0 ? 0 : a + 1.4, b: i === NIGHT_RANGES.length - 1 ? 96.4 : b - 0.6 }));
// the page opens from the light at the centre of the reveal's ring
export const NIGHT_WHITE_FROM = 96.5;

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

export function evaluateNight(t, c = C) {
  c.t = t;
  c.spark = io(seg(t, 11.5, 17)) * (1 - 0.55 * io(seg(t, 26, 34)));
  c.float = io(seg(t, 22.5, 31));
  c.align = io(seg(t, 33.5, 43));
  c.assemble = io(seg(t, 44, 54));
  c.core = io(seg(t, 56, 64));
  c.coreGlow = io(seg(t, 64, 74)) * (1 - io(seg(t, 79, 85)));
  c.coreFade = io(seg(t, 79, 85.5));
  c.reveal = io(seg(t, 77.5, 84));
  c.light = io(seg(t, 89, 97));
  c.white = seg(t, NIGHT_WHITE_FROM, 100);
  c.gap = 0;
  c.soft = 0;
  c.bright = 0;
  // the low sun: strong at the origin, a glow in the rings, gone in the light
  c.sun = keys(t, [
    [0, 2.4],
    [22, 2.6],
    [44, 2.2],
    [66, 1.8],
    [100, 1.6],
  ]);
  c.contrast = 0.4;
  // thin: the mountains, 500 m off, must stay in view
  c.fog = keys(t, [
    [0, 0.0024],
    [22, 0.0029],
    [55, 0.0034],
    [88, 0.003],
    [100, 0.006],
  ]);
  return c;
}
