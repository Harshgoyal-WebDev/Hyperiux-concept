import { Lines } from "./lines";
import { CORE_CENTRE, CUBE_D, CUBE_H, LOGO_PITCH, LOGO_YAW, MARK_CENTRE, MARK_HALF, markToWorld } from "./space";
import { CLIENTS, CONNECTIONS, JOURNEY, PROCESS, SERVICES } from "../content";
import { LAYOUT } from "./tuning";

// The world: one city of the mark's cube, built along the page.
//
// Everything is placed on the cube's own grid (x across, z deep, both in
// cubes; heights in cube levels) and scheduled in world time W, where frame
// n of the page runs from W = n − 1 to n (the opening's first drawing plays
// on load, from W = −1 to 0). The orange thread is one orthogonal path
// through all of it: it leaves the core, runs the journey's street, wires
// the four disciplines, crosses the process, the work hall and the clients,
// and comes back round to the core, so the bigger picture is a closed loop.
const H = CUBE_H;
const P = (x, y, z) => [x, y, z * CUBE_D]; // grid → world (y in world units)
const lv = (n) => n * H;

// a box's corners, bit 0 = x, 1 = y, 2 = z; its edges: bottom, sides, top
const EDGES = [
  [0, 1], [1, 5], [5, 4], [4, 0],
  [0, 2], [1, 3], [5, 7], [4, 6],
  [2, 3], [3, 7], [7, 6], [6, 2],
];
const corners = (a, b) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]]);

// a box from grid corner (x, z) at level y, sx × sz cubes, sy levels
const cellBox = (x, z, sx = 1, sz = 1, sy = 1, y = 0) => [P(x, lv(y), z), P(x + sx, lv(y + sy), z + sz)];

// Every shape in the world is solid: a body the colour of the ground, rising
// as its edges are drawn (and going as they go), so it hides its own back
// edges and whatever stands behind it — a hidden-line drawing, not a tangle
// of wireframes. (Only guides stay open: the nested cubes round the core,
// the grids, the frames.) Collected per build into SOLIDS.
let SOLIDS = [];
const solid = (a, b, t0, dur, out) => SOLIDS.push({ min: a, size: [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t0, dur, out });

// A box's twelve edges, drawn as it is built: its base, its sides rising,
// then its top; and its body, rising with its sides (`open`: edges only).
function box(L, [a, b], { t0, t1, open = false, ...o }) {
  const c = corners(a, b);
  const d = t1 - t0;
  EDGES.forEach(([i, j], k) => {
    const s = k < 4 ? t0 + d * 0.06 * k : k < 8 ? t0 + d * 0.25 : t0 + d * (0.7 + 0.075 * (k - 8));
    const e = k < 4 ? s + d * 0.2 : k < 8 ? t0 + d * 0.75 : s + d * 0.22;
    // the vertical edges rise from the ground
    const [p, q] = k >= 4 && k < 8 ? (c[i][1] < c[j][1] ? [c[i], c[j]] : [c[j], c[i]]) : [c[i], c[j]];
    L.seg(p, q, { t0: s, t1: e, ...o });
  });
  if (!open) solid(a, b, t0 + d * 0.25, d * 0.5, o.out);
}

// A prism: a polygon on the ground ([x, z] in world units) risen from y0 by
// h — its plan drawn, its corners rising, its top closing; and its body
// (World.jsx), collected into PRISMS.
let PRISMS = [];
function prism(L, poly, y0, h, { t0, t1, out, ...o }) {
  const d = t1 - t0;
  const n = poly.length;
  const at = (k, y) => [poly[k % n][0], y, poly[k % n][1]];
  for (let k = 0; k < n; k++) {
    const s = t0 + d * 0.3 * (k / n);
    L.seg(at(k, y0 + 0.012), at(k + 1, y0 + 0.012), { t0: s, t1: s + d * 0.3, out, ...o });
    L.seg(at(k, y0), at(k, y0 + h), { t0: t0 + d * 0.3, t1: t0 + d * 0.75, out, ...o });
    L.seg(at(k, y0 + h), at(k + 1, y0 + h), { t0: t0 + d * (0.7 + 0.3 * (k / n)), t1: t0 + d * (0.72 + 0.28 * ((k + 1) / n)), out, ...o });
  }
  PRISMS.push({ poly, y0, h, t0: t0 + d * 0.3, dur: d * 0.45, out });
}

// A flat panel standing in a plane of constant z, just behind its outline
// (seen from +z), so what is behind the panel is hidden but its own lines
// are not.
const panel = (x0, y0, x1, y1, z, t0, dur) => solid([x0, y0, z - 0.04], [x1, y1, z - 0.02], t0, dur);

// A tower of `levels` cubes on (x, z): its corners rise, each floor closing
// as they pass it; and its solid body rises with it.
function tower(L, x, z, sx, sz, levels, t0, dur, o = {}) {
  const [a, b] = cellBox(x, z, sx, sz, levels);
  const c = corners(a, b);
  for (const [i, j] of [[0, 2], [1, 3], [5, 7], [4, 6]]) L.seg(c[i], c[j], { t0, t1: t0 + dur, ...o });
  for (let k = 0; k <= levels; k++) {
    const y = lv(k);
    const s = t0 + (dur * k) / levels;
    const ring = [P(x, y, z), P(x + sx, y, z), P(x + sx, y, z + sz), P(x, y, z + sz), P(x, y, z)];
    for (let r = 0; r < 4; r++) L.seg(ring[r], ring[r + 1], { t0: s, t1: s + Math.max(0.03, (dur / levels) * 0.9), ...o });
  }
  solid(a, b, t0, dur, o.out);
}

// an orthogonal route on the ground through grid points [x, z], or in space
// through [x, y, z]
const ground = (pts, y = 0.02) => pts.map((p) => (p.length === 3 ? P(p[0], p[1], p[2]) : P(p[0], y, p[1])));

// a small cross marking a point of the construction
function cross(L, p, r, o) {
  L.seg([p[0] - r, p[1], p[2]], [p[0] + r, p[1], p[2]], o);
  L.seg([p[0], p[1] - r, p[2]], [p[0], p[1] + r, p[2]], o);
  L.seg([p[0], p[1], p[2] - r], [p[0], p[1], p[2] + r], o);
}

// A dimension line from a to b: the line, two ticks across it (along `tick`).
function dim(L, a, b, tick, o) {
  L.seg(a, b, o);
  for (const p of [a, b]) L.seg([p[0] - tick[0], p[1] - tick[1], p[2] - tick[2]], [p[0] + tick[0], p[1] + tick[1], p[2] + tick[2]], o);
}

// ---------------------------------------------------------------------------
// The places along the thread (grid coordinates)
// ---------------------------------------------------------------------------
const STREET_Z = 4.5; // the corridor the thread takes to the hub
const HUB = [43, 3.5]; // 2 × 2
// the four disciplines, round the hub: each an 8 × 8 site (corner x, z),
// entered from the side facing it
const SITES = {
  strategy: { at: [32, -10], entry: [36, -2] },
  design: { at: [48, -10], entry: [52, -2] },
  technology: { at: [48, 11], entry: [52, 11] },
  marketing: { at: [32, 11], entry: [36, 11] },
};
const PROC_Z = 24;
const PROC_X = [40, 46, 52, 58, 64];
const HALL = { x: [70, 98], z: [20, 28], h: 4.6 };
const CLIENTS_AT = [102, 20];
const HALL_Z = ((HALL.z[0] + HALL.z[1]) / 2) * CUBE_D; // its axis, in world z

// the work in the hall (15): [the bay's first column, its wall (−1 the left
// as you walk in, +1 the right)], one per project; each picture as the
// project's imagery (880 × 996) stands, its middle at WORK_Y
const WORK_BAYS = [[74, -1], [78, 1], [82, -1], [86, 1]];
const WORK_ASPECT = 880 / 996;
const WORK_H = 3.2;
const WORK_W = WORK_H * WORK_ASPECT;
const WORK_Y = 2.55;
// the case study on the end wall (16)
const END_H = 3.4;
const END_Y = 2.35;
const END_DZ = -1.6; // its middle, off the hall's axis (grid)
const END_DIST = 5; // how far the camera stands from it
// when the camera passes each project on the walk (world time)
export const WORK_T = [14.35, 14.6, 14.85, 15.1];

// the windows of the page's frames (world time)
// (each built as its section comes up the screen: done as it is centred)
const STATION_T = { strategy: 8.6, design: 9.6, technology: 10.6, marketing: 11.6 };

export function buildWorld(mark) {
  const L = new Lines();
  SOLIDS = [];
  PRISMS = [];
  const solids = SOLIDS;
  const A = LAYOUT;
  const labels = [];
  const label = (p, text, t0, t1, accent = false, dense = false) => labels.push({ p, text, t0, t1, accent, dense });

  // (no grid on the ground: the world stands on a clean surface)

  // ---- 01 the core: the mark's cube, drawn on load ----------------------
  const core = cellBox(0, -1);
  const cc = corners(...core);
  // the order it is drawn in: the front vertical, the base, the sides, the
  // top; the three edges round the back-bottom corner (1) are the ones the
  // mark hides, and they go as the view becomes the mark
  const coreOrder = [[4, 6], [4, 5], [4, 0], [5, 7], [0, 2], [6, 7], [6, 2], [7, 3], [2, 3], [0, 1], [1, 5], [1, 3]];
  coreOrder.forEach(([i, j], k) => {
    const hidden = i === 1 || j === 1;
    const t0 = -0.9 + k * 0.055;
    L.seg(cc[i], cc[j], { t0, t1: t0 + 0.16, w: 1.6, out: hidden ? [2.25, 2.55] : [3.05, 3.3] });
  });
  solid(core[0], core[1], -0.85, 0.6);
  // the orange signal running round its outline
  const loop = [4, 5, 7, 3, 2, 0, 4];
  for (let k = 0; k < 6; k++) L.seg(cc[loop[k]], cc[loop[k + 1]], { t0: -0.3, t1: -0.1, out: [1.85, 2.1], tone: "accent", w: 2.4, run: [k / 6, 1 / 6] });

  // ---- 02 its construction: extended edges, its corners, its sizes -------
  EDGES.forEach(([i, j], k) => {
    const a = cc[i];
    const b = cc[j];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const n = Math.hypot(...d);
    const e = 1.7 / n;
    const t0 = 1.0 + k * 0.03;
    L.seg([a[0] - d[0] * e, a[1] - d[1] * e, a[2] - d[2] * e], [b[0] + d[0] * e, b[1] + d[1] * e, b[2] + d[2] * e], { t0, t1: t0 + 0.35, tone: "guide", out: [2.15, 2.45] });
  });
  cc.forEach((p, k) => cross(L, p, 0.09, { t0: 1.2 + k * 0.03, t1: 1.3 + k * 0.03, out: [2.15, 2.4], tone: k === 4 ? "accent" : "ink", w: 1.2 }));
  const dimO = { t0: 1.3, t1: 1.6, out: [2.1, 2.4], tone: "guide" };
  dim(L, P(0, 0, 0.45), P(1, 0, 0.45), [0, 0, 0.07], dimO);
  dim(L, P(-0.45, 0, -1), P(-0.45, 0, 0), [0.07, 0, 0], dimO);
  dim(L, P(-0.45, 0, 0.45), P(-0.45, H, 0.45), [0.05, 0, -0.05], dimO);
  label(P(0.5, 0, 0.62), "W 66.46", 1.35, 2.25, false, true);
  label(P(-0.62, 0, -0.5), "D 66.37", 1.4, 2.25, false, true);
  label(P(-0.6, H * 0.6, 0.6), "H 65.08", 1.45, 2.25, false, true);

  // ---- 03 – 04 the mark round it (and again at the end, 20) -------------
  // its outlines drawn in the plane where, seen from the mark's direction,
  // they meet the cube exactly; then (World.jsx) its fill
  if (mark) {
    for (const [t0, t1, out] of [
      [2.15, 2.85, [4.05, 4.4]],
      [18.8, 19.2, null],
    ]) {
      mark.outlines.forEach((pts, k) => {
        const w = pts.map(([x, y]) => markToWorld(x, y));
        L.path(w, { t0: t0 + k * 0.04, t1: t1 + k * 0.04 - 0.16, out, w: 1.3 });
      });
    }
    const markO = { t0: 2.45, t1: 2.8, out: [3.3, 3.6], tone: "guide" };
    const up = (y) => markToWorld(250, y);
    dim(L, markToWorld(40, 508), markToWorld(460.89, 508), [up(0)[0] - up(6)[0], up(0)[1] - up(6)[1], up(0)[2] - up(6)[2]], markO);
    const right = (x) => markToWorld(x, 250);
    dim(L, markToWorld(486, 13), markToWorld(486, 487.87), [right(6)[0] - right(0)[0], right(6)[1] - right(0)[1], right(6)[2] - right(0)[2]], markO);
    [
      [198.062, 223.931],
      [198.062, 287.983],
      [291.927, 222.826],
      [291.927, 290.889],
    ].forEach(([x, y], k) => cross(L, markToWorld(x, y), 0.07, { t0: 2.55 + k * 0.04, t1: 2.65 + k * 0.04, out: [3.3, 3.5], tone: "accent", w: 1.4 }));
  }
  label(markToWorld(250, 540), "420.89", 2.55, 3.6, false, true);
  label(markToWorld(512, 250), "474.87", 2.6, 3.6, false, true);
  label(markToWorld(40, -14), "Fig. 01 — The Hyperiux mark", 2.7, 3.95, false, true);
  label(markToWorld(430, -14), "Cube · 66.46 × 66.37 × 65.08", 3.05, 3.95, true, true);

  // ---- 05 the core: orange; nested in larger cubes; a foundation --------
  box(L, core, { t0: 3.95, t1: 4.3, tone: "accent", w: 1.8, out: [18.95, 19.2], open: true });
  const nests = (t0, out) => {
    box(L, cellBox(-1, -2, 3, 3, 3), { t0, t1: t0 + 0.35, w: 1.2, out, open: true });
    box(L, cellBox(-3, -4, 7, 7, 7), { t0: t0 + 0.15, t1: t0 + 0.55, tone: "guide", out, open: true });
  };
  nests(4.25, [A.planStart - 0.05, A.planStart + 0.3]);
  nests(18.05, [18.95, 19.25]); // and again on coming home (19)
  for (let i = -3; i <= 4; i++) {
    const t0 = 4.45 + (i + 3) * 0.02;
    L.seg(P(i, 0.01, -4), P(i, 0.01, 3), { t0, t1: t0 + 0.3, tone: "guide", out: [6.4, 6.8] });
    L.seg(P(-3, 0.01, i - 1), P(4, 0.01, i - 1), { t0, t1: t0 + 0.3, tone: "guide", out: [6.4, 6.8] });
  }

  // ---- 06 structure: the mark itself, as the plan of a building --------
  // Its two uprights and two bridges laid on the ground round the core (the
  // mark's cube is where the core stands), risen into walls, and wired:
  // upright to bridge, bridge into the core. The brand is the structure.
  const mk = (lx, ly) => [0.5 + (lx - 250) * A.planScale, -0.5 + (ly - 250.4) * A.planScale]; // grid
  const mw = (lx, ly) => {
    const [x, z] = mk(lx, ly);
    return [x, z * CUBE_D];
  };
  const PIECES = [
    { h: A.planUprightH, pts: [[40, 13], [106.261, 13], [106.261, 222.826], [40, 222.826]] },
    { h: A.planUprightH, pts: [[393.394, 278.043], [459.654, 278.043], [459.654, 487.869], [393.394, 487.869]] },
    { h: A.planBridgeH, pts: [[40.14, 278.043], [198.062, 223.931], [198.062, 287.983], [106.401, 322.217], [106.401, 487.869], [40.14, 487.869]] },
    { h: A.planBridgeH, pts: [[393.527, 13], [460.892, 13], [460.892, 222.826], [291.927, 290.889], [291.927, 222.826], [393.527, 178.653]] },
  ];
  // (cleared as the thread comes home, before the view becomes the mark)
  const planOut = [17.95, 18.3];
  PIECES.forEach((pc, k) => {
    const t0 = A.planStart + k * 0.07;
    prism(L, pc.pts.map(([x, y]) => mw(x, y)), 0, pc.h, { t0, t1: t0 + A.planRise, w: 1.3, out: planOut });
  });
  // the joints: upright to bridge (ink), bridge into the core (orange)
  const wy = Math.min(A.planBridgeH, H) / 2;
  const wire = (a, b, t0, tone) => L.seg(P(a[0], wy, a[1]), P(b[0], wy, b[1]), { t0, t1: t0 + 0.14, tone, w: tone === "accent" ? 2 : 1.2, out: planOut });
  const tw = A.planStart + A.planRise + 0.12;
  wire(mk(73, 222.826), mk(73, 266.8), tw, "ink");
  wire(mk(426.5, 278.043), mk(426.5, 236.9), tw + 0.04, "ink");
  wire(mk(198.062, 256), [0, mk(198.062, 256)[1]], tw + 0.1, "accent");
  wire(mk(291.927, 256.8), [1, mk(291.927, 256.8)[1]], tw + 0.14, "accent");
  label(P(mk(73, 13)[0], A.planUprightH + 0.35, mk(73, 13)[1]), "The mark, as a plan", A.planStart + 0.4, 6.0, false, true);

  // ---- 07 the five connections leave it, the ring closes, Growth leads ---
  // each from a face of the mark's plan, straight out to its node; then one
  // ring through all five closes the network (a signal runs round it);
  // only then does Growth light and the thread leave from it
  const o = A.nodeOut;
  const SRC = [
    [mk(40, 118), [-1, 0]], // Human behaviour: the left upright's side
    [mk(73, 13), [0, -1]], // Strategy: its top
    [mk(427, 13), [0, -1]], // Design: the right bridge's top
    [mk(459.654, 383), [1, 0]], // Technology: the right upright's side
    [mk(426.5, 487.869), [0, 1]], // Growth: its foot
  ];
  const NODE = SRC.map(([p, d]) => [p[0] + d[0] * o, p[1] + d[1] * o]);
  SRC.forEach(([p, d], k) => {
    const t0 = 6.02 + k * 0.05;
    const c = NODE[k];
    L.path(ground([p, [c[0] - d[0] * 0.5, c[1] - d[1] * 0.5]]), { t0, t1: t0 + 0.2, w: 1.2, out: planOut });
    box(L, cellBox(c[0] - 0.5, c[1] - 0.5, 1, 1, A.nodeH), { t0: t0 + 0.12, t1: t0 + 0.38, w: 1.2, out: planOut, hi: k === 4 ? [A.growthAt, 1e6] : undefined });
    label(P(c[0], lv(A.nodeH) + 0.35, c[1]), CONNECTIONS[k], t0 + 0.25, 7.25, k === 4);
  });
  {
    const [hb, st, de, te, gr] = NODE;
    const left = hb[0];
    const right = te[0];
    const top = st[1];
    const bottom = gr[1];
    const ring = [hb, [left, top], st, de, [right, top], te, [right, bottom], gr, [left, bottom], hb];
    L.path(ground(ring, 0.025), { t0: A.ringAt - 0.24, t1: A.ringAt, w: 1.3, out: planOut });
    // the signal round the closed ring, once it closes
    const lens = ring.slice(1).map((q, i) => Math.hypot(q[0] - ring[i][0], q[1] - ring[i][1]));
    const total = lens.reduce((x, y) => x + y, 0);
    let acc = 0;
    ring.slice(1).forEach((q, i) => {
      L.seg(P(ring[i][0], 0.03, ring[i][1]), P(q[0], 0.03, q[1]), { t0: A.ringAt, t1: A.ringAt + 0.02, out: [A.growthAt + 0.05, A.growthAt + 0.15], tone: "accent", w: 2.2, run: [acc / total, lens[i] / total] });
      acc += lens[i];
    });
  }
  const GROW = NODE[4];

  // ---- the thread --------------------------------------------------------
  // [grid point, the time its head passes it]: from Growth, round the
  // people's ring (08), on to the hub
  const HX = A.humanX;
  const HZ = A.humanZ;
  const HR = A.humanRing;
  const ARC = [7.05, 7.82]; // its run round the ring
  const thread = [
    [[GROW[0], GROW[1] + 0.5], A.growthAt + 0.02],
    [[GROW[0], GROW[1] + 1.2], A.growthAt + 0.08],
    [[HX - HR - 1.2, GROW[1] + 1.2], 6.95],
    [[HX - HR - 1.2, HZ], 7.0],
    [[HX - HR, HZ], 7.05],
  ];
  const thread1b = [
    [[HX + HR, HZ], ARC[1]],
    [[27, HZ], 7.9],
    [[27, STREET_Z], 7.97],
    [[43, STREET_Z], 8.2],
    // through the hub, out to Marketing's side (09: the four wires)
    [[44, STREET_Z], 8.25],
    [[44, 8], 8.4],
    [[36, 8], 8.55],
    [[36, 11], 8.62],
  ];
  // 13 → 14 from Marketing to the process, along it, into the hall (15–16),
  // the clients (17), and the long way home (18 – 19)
  const thread2 = [
    [[36, 19], 12.75],
    [[36, PROC_Z], 12.85],
    [[HALL.x[0], PROC_Z], 13.95],
    [[HALL.x[1] - 1, PROC_Z], 15.9],
    [[CLIENTS_AT[0] + 8, PROC_Z], 16.5],
    [[116, PROC_Z], 16.65],
    [[116, -16], 17.1],
    [[0.5, -16], 18.2],
    [[0.5, -1], 18.55],
  ];
  for (const t of [thread, thread1b, thread2]) {
    for (let i = 1; i < t.length; i++) {
      const [a, ta] = t[i - 1];
      const [b, tb] = t[i];
      L.seg(P(a[0], 0.03, a[1]), P(b[0], 0.03, b[1]), { t0: ta, t1: tb, tone: "accent", w: 2.2 });
    }
  }

  // ---- 08 human first: a person at the centre of the journey ------------
  // An architect's scale figure stands in a ring; the thread walks round it
  // through the five moments of the journey (each a touchpoint, growing),
  // and each is seen: a sight line from the eye to it.
  {
    const ring = [];
    for (let k = 0; k <= 48; k++) {
      const f = (k / 48) * Math.PI * 2;
      ring.push(P(HX + HR * Math.cos(f), 0.012, HZ + HR * Math.sin(f)));
    }
    L.path(ring, { t0: 6.82, t1: 7.02, tone: "guide" });
    // the thread round the far half: φ from 180° to 360°
    const steps = 36;
    for (let k = 0; k < steps; k++) {
      const f0 = Math.PI + (k / steps) * Math.PI;
      const f1 = Math.PI + ((k + 1) / steps) * Math.PI;
      const s0 = ARC[0] + ((ARC[1] - ARC[0]) * k) / steps;
      L.seg(P(HX + HR * Math.cos(f0), 0.03, HZ + HR * Math.sin(f0)), P(HX + HR * Math.cos(f1), 0.03, HZ + HR * Math.sin(f1)), { t0: s0, t1: s0 + (ARC[1] - ARC[0]) / steps, tone: "accent", w: 2.2 });
    }
    // the figure: a standing person, in the plane facing the camera
    const fh = A.humanHeight;
    const yaw = (A.humanFacing * Math.PI) / 180;
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const fig = (x, y) => [HX + rx * x * fh, y * fh, HZ * CUBE_D + rz * x * fh];
    const half = [[0.03, 0.86], [0.11, 0.82], [0.135, 0.72], [0.14, 0.47], [0.115, 0.45], [0.105, 0.6], [0.085, 0.74], [0.08, 0.56], [0.09, 0.5], [0.075, 0.26], [0.07, 0.04], [0.1, 0], [0.02, 0], [0.025, 0.27], [0, 0.45]];
    const body = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => fig(x, y));
    body.push(body[0]);
    L.path(body, { t0: 6.88, t1: 7.12, w: 1.45 });
    const head = [];
    for (let k = 0; k <= 20; k++) {
      const f = (k / 20) * Math.PI * 2;
      head.push(fig(0.065 * Math.sin(f), 0.93 + 0.065 * Math.cos(f)));
    }
    L.path(head, { t0: 7.0, t1: 7.12, w: 1.45 });
    const eye = fig(0, 0.93);
    // its eye level, drawn across the ring
    L.seg([HX - HR, eye[1], HZ * CUBE_D], [HX + HR, eye[1], HZ * CUBE_D], { t0: 7.02, t1: 7.2, tone: "guide" });
    label([HX - HR - 0.2, eye[1] + 0.1, HZ * CUBE_D], "Eye level", 7.1, 7.95, false, true);
    // the five moments, round its far side
    JOURNEY.forEach((j, k) => {
      const f = Math.PI + ((k + 1) / 6) * Math.PI;
      const t = ARC[0] + ((ARC[1] - ARC[0]) * (k + 1)) / 6; // when the thread reaches it
      const cx = HX + HR * Math.cos(f);
      const cz = HZ + HR * Math.sin(f);
      const s2 = A.touchSize / 2;
      const hgt = 0.35 + k * A.touchStep;
      box(L, [P(cx - s2, 0, cz - s2), P(cx + s2, hgt, cz + s2)], { t0: t - 0.14, t1: t, w: 1.25, tone: k === 4 ? "accent" : "ink" });
      L.seg(eye, P(cx, hgt, cz), { t0: t - 0.04, t1: t + 0.08, tone: "guide" });
      label(P(cx, hgt + 0.3, cz), `${j.n} ${j.label}`, t - 0.08, 7.95, k === 4);
    });
  }

  // ---- 09 the hub, the four disciplines' sites, their wires -------------
  box(L, cellBox(HUB[0], HUB[1], 2, 2, 2), { t0: 7.85, t1: 8.2, w: 1.6 });
  const hubWires = [
    [[44, 3.5], [44, -0.5], [36, -0.5], [36, -2]],
    [[44, -0.5], [52, -0.5], [52, -2]],
    [[44, 8], [52, 8], [52, 11]],
  ];
  hubWires.forEach((r, k) => L.path(ground(r, 0.03), { t0: 8.25 + k * 0.05, t1: 8.6 + k * 0.05, tone: "accent", w: 2.2 }));
  SERVICES.forEach((s, k) => {
    const site = SITES[s.id];
    const [x, z] = site.at;
    const t0 = 8.4 + k * 0.06;
    L.path(ground([[x, z], [x + 8, z], [x + 8, z + 8], [x, z + 8], [x, z]], 0.01), { t0, t1: t0 + 0.35, w: 1.1 });
    label(P(x + 0.2, 0.3, z < 0 ? z + 8.7 : z - 0.7), s.name, t0 + 0.2, STATION_T[s.id] + 1.1);
  });

  // ---- 10 Strategy: a planning grid; decision points on one route --------
  {
    const [x, z] = SITES.strategy.at;
    const t = STATION_T.strategy;
    for (let i = 1; i < 8; i++) {
      L.seg(P(x + i, 0.015, z), P(x + i, 0.015, z + 8), { t0: t + 0.02 * i, t1: t + 0.3 + 0.02 * i, tone: "guide" });
      L.seg(P(x, 0.015, z + i), P(x + 8, 0.015, z + i), { t0: t + 0.02 * i, t1: t + 0.3 + 0.02 * i, tone: "guide" });
    }
    const stops = [
      [1.5, 6.5, 1, "01 Research"],
      [1.5, 3.5, 2, "02 Insight"],
      [4.5, 3.5, 3, "03 Opportunity"],
      [6.5, 1.5, 5, "04 Direction"],
    ];
    const route = [[4, 8], [4, 6.5], [1.5, 6.5], [1.5, 3.5], [4.5, 3.5], [4.5, 1.5], [6.5, 1.5]];
    L.path(ground(route.map(([a, b]) => [x + a, z + b]), 0.03), { t0: t + 0.2, t1: t + 0.8, tone: "accent", w: 2.2 });
    stops.forEach(([a, b, n, text], k) => {
      const t0 = t + 0.3 + k * 0.12;
      tower(L, x + a - 0.5, z + b - 0.5, 1, 1, n, t0, 0.25, { w: 1.25, hi: k === 3 ? [t0 + 0.3, 1e6] : undefined });
      label(P(x + a, lv(n) + 0.35, z + b), text, t0 + 0.15, t + 1.45, k === 3);
    });
  }

  // ---- 11 UI/UX Design: an interface exploded into its layers -----------
  {
    const [x, z] = SITES.design.at;
    const t = STATION_T.design;
    const rect = (x0, y0, x1, y1, zz, o) =>
      L.path(
        [P(x0, y0, zz), P(x1, y0, zz), P(x1, y1, zz), P(x0, y1, zz), P(x0, y0, zz)],
        o
      );
    const Z = [z + 2, z + 3.2, z + 4.4, z + 5.6];
    // the layout grid (back), the desktop frame, its content, the phone
    for (let i = 0; i <= 12; i++) {
      const xx = x + 0.8 + (5.2 * i) / 12;
      L.seg(P(xx, 0.7, Z[0]), P(xx, 4.1, Z[0]), { t0: t + 0.05 + i * 0.015, t1: t + 0.3 + i * 0.015, tone: "guide" });
    }
    rect(x + 0.8, 0.7, x + 6, 4.1, Z[1], { t0: t + 0.15, t1: t + 0.45, w: 1.3 });
    L.seg(P(x + 0.8, 3.6, Z[1]), P(x + 6, 3.6, Z[1]), { t0: t + 0.4, t1: t + 0.5 });
    rect(x + 1.2, 2.0, x + 3.8, 3.3, Z[2], { t0: t + 0.35, t1: t + 0.55 });
    [0, 1, 2].forEach((i) => rect(x + 1.2 + i * 1.55, 0.95, x + 2.45 + i * 1.55, 1.75, Z[2], { t0: t + 0.4 + i * 0.05, t1: t + 0.6 + i * 0.05 }));
    rect(x + 6.4, 0.7, x + 7.6, 3.1, Z[3], { t0: t + 0.45, t1: t + 0.65, w: 1.3 });
    // the layers as sheets: each hides what lies behind it
    const zw = (i) => Z[i] * CUBE_D;
    panel(x + 0.8, 0.7, x + 6, 4.1, zw(1), t + 0.15, 0.3);
    panel(x + 1.2, 2.0, x + 3.8, 3.3, zw(2), t + 0.35, 0.2);
    [0, 1, 2].forEach((i) => panel(x + 1.2 + i * 1.55, 0.95, x + 2.45 + i * 1.55, 1.75, zw(2), t + 0.4 + i * 0.05, 0.2));
    panel(x + 6.4, 0.7, x + 7.6, 3.1, zw(3), t + 0.45, 0.2);
    [2.5, 2.2, 1.9].forEach((y, i) => L.seg(P(x + 6.6, y, Z[3]), P(x + 7.4, y, Z[3]), { t0: t + 0.6 + i * 0.03, t1: t + 0.7 + i * 0.03 }));
    // the path: from the entry, up into the interface, across to the phone
    L.path([P(x + 4, 0.03, z + 8), P(x + 4, 0.03, Z[3]), P(x + 4, 1.35, Z[3]), P(x + 7, 1.35, Z[3]), P(x + 7, 1.0, Z[3])], { t0: t + 0.3, t1: t + 0.85, tone: "accent", w: 2.2 });
    // the layers' depth, joined at their corners
    for (const [px, py] of [[0.8, 0.7], [6, 0.7], [6, 4.1], [0.8, 4.1]]) L.seg(P(x + px, py, Z[0]), P(x + px, py, Z[3]), { t0: t + 0.5, t1: t + 0.75, tone: "guide" });
    label(P(x + 0.8, 4.45, Z[1]), "Desktop · 12 columns", t + 0.35, t + 1.45);
    label(P(x + 6.4, 3.45, Z[3]), "Mobile", t + 0.55, t + 1.45);
  }

  // ---- 12 Technology: modules in tiers, wired ----------------------------
  {
    const [x, z] = SITES.technology.at;
    const t = STATION_T.technology;
    const skills = SERVICES[2].skills; // HTML CSS JavaScript React Vue Angular
    const zz = z + 3;
    const mh = lv(1.5); // a module's height
    const base = [0, mh + 0.35, 2 * (mh + 0.35)]; // the tiers' floors
    // [its left, its tier, the skill it carries]
    const mods = [
      [3, 2, 3],
      [1.5, 1, 4],
      [4.5, 1, 5],
      [0, 0, 0],
      [3, 0, 1],
      [6, 0, 2],
    ];
    mods.forEach(([a, tier, s], k) => {
      const t0 = t + 0.1 + k * 0.08;
      box(L, [P(x + a, base[tier], zz), P(x + a + 2, base[tier] + mh, zz + 2)], { t0, t1: t0 + 0.3, w: 1.25, hi: k === 0 ? [t0 + 0.3, 1e6] : undefined });
      label(P(x + a + 1, base[tier] + mh + 0.3, zz + 1), skills[s], t0 + 0.2, t + 1.45, k === 0);
    });
    // wires down the tiers, face to face, and the path in from the entry
    const link = (from, to, tier, t0) => {
      const y0 = base[tier];
      const y1 = base[tier - 1] + mh;
      const ym = (y0 + y1) / 2;
      L.path([P(x + from, y0, zz + 1), P(x + from, ym, zz + 1), P(x + to, ym, zz + 1), P(x + to, y1, zz + 1)], { t0, t1: t0 + 0.18, tone: "accent", w: 1.8 });
    };
    L.path([P(x + 4, 0.03, z), P(x + 4, 0.03, zz)], { t0: t + 0.3, t1: t + 0.4, tone: "accent", w: 2.2 });
    link(4, 2.5, 2, t + 0.55);
    link(4, 5.5, 2, t + 0.55);
    link(2.5, 1, 1, t + 0.65);
    link(2.5, 4, 1, t + 0.65);
    link(5.5, 7, 1, t + 0.68);
  }

  // ---- 13 Marketing: momentum, tower by tower -----------------------------
  {
    const [x, z] = SITES.marketing.at;
    const t = STATION_T.marketing;
    const skills = SERVICES[3].skills;
    const heights = [1, 2, 3, 4, 6, 8];
    const zz = z + 3.5;
    const front = zz + 1.4;
    let prev = 0.03;
    const stair = [P(x + 4, 0.03, z), P(x + 4, 0.03, front), P(x + 0.9, 0.03, front)];
    heights.forEach((n, k) => {
      const xx = x + 0.4 + k * 1.25;
      const t0 = t + 0.12 + k * 0.09;
      tower(L, xx, zz, 1, 1, n, t0, 0.3, { w: 1.25, hi: k === 5 ? [t0 + 0.35, 1e6] : undefined });
      label(P(xx + 0.5, lv(n) + 0.35, zz + 0.5), skills[k], t0 + 0.2, t + 1.45, k === 5);
      stair.push(P(xx + 0.5, prev, front), P(xx + 0.5, lv(n), front));
      prev = lv(n);
    });
    L.path(stair, { t0: t + 0.2, t1: t + 0.85, tone: "accent", w: 2.2 });
  }

  // ---- 14 the process: five stations along the thread, lit in turn ------
  PROCESS.forEach((p, k) => {
    const x = PROC_X[k];
    const t0 = 12.8 + k * 0.08;
    const lit = [13.12 + k * 0.17, k === 4 ? 14.15 : 13.12 + (k + 1) * 0.17];
    const blocks = [
      [[0, 0, 1, 1, 1]],
      [[0, 0, 1, 1, 2]],
      [[-0.5, -0.5, 2, 2, 1]],
      [[-0.5, -0.5, 2, 2, 2]],
      [[-0.5, -0.5, 2, 2, 2], [0, 0, 1, 1, 2, 2]],
    ][k];
    blocks.forEach(([a, b, sx, sz, sy, y = 0]) => box(L, cellBox(x + a, PROC_Z - 0.5 + b, sx, sz, sy, y), { t0, t1: t0 + 0.3, w: 1.3, hi: lit }));
    const top = k === 4 ? 4 : blocks[0][4];
    label(P(x + 0.5, lv(top) + 0.4, PROC_Z), `${p.n} ${p.label}`, t0 + 0.15, 14.2);
  });

  // ---- 15 – 16 the work: a hall, drawn from its door in -----------------
  // Its floor is left clean; its ceiling beams, its columns, and the work
  // itself hung on its walls: a project in each bay, alternating sides
  // (World.jsx paints them), and the featured one on its end wall (16).
  const pictures = [];
  {
    const [x0, x1] = HALL.x;
    const [z0, z1] = HALL.z;
    const h = HALL.h;
    const at = (x) => 13.7 + ((x - x0) / (x1 - x0)) * 0.9;
    for (let x = x0; x <= x1; x += 2) L.seg(P(x, h, z0), P(x, h, z1), { t0: at(x), t1: at(x) + 0.12, tone: "guide" });
    for (let z = z0; z <= z1; z += 2) L.seg(P(x0, h, z), P(x1, h, z), { t0: 13.7, t1: 14.6, tone: "guide" });
    for (let x = x0; x <= x1; x += 4) {
      for (const z of [z0, z1 - 0.4]) box(L, [P(x, 0, z), P(x + 0.4, h, z + 0.4)], { t0: at(x), t1: at(x) + 0.2, w: 1.2 });
      L.seg(P(x + 0.2, h, z0), P(x + 0.2, h, z1), { t0: at(x) + 0.1, t1: at(x) + 0.25 });
    }
    // a frame in the plane of constant z (a side wall) or of constant x (the end)
    const frameZ = (xa, xb, ya, yb, z, o) => L.path([P(xa, ya, z), P(xb, ya, z), P(xb, yb, z), P(xa, yb, z), P(xa, ya, z)], o);
    const frameX = (x, za, zb, ya, yb, o) => L.path([P(x, ya, za), P(x, ya, zb), P(x, yb, zb), P(x, yb, za), P(x, ya, za)], o);
    const m = 0.1; // the frame's margin round its picture
    WORK_BAYS.forEach(([bx, side], i) => {
      const cx = bx + 2.2; // between the bay's columns
      const z = side < 0 ? z0 + 0.05 : z1 - 0.05;
      const t = at(bx);
      frameZ(cx - WORK_W / 2 - m, cx + WORK_W / 2 + m, WORK_Y - WORK_H / 2 - m, WORK_Y + WORK_H / 2 + m, z, { t0: t - 0.05, t1: t + 0.12, w: 1.3 });
      // the picture just behind its frame (seen from the hall), facing in
      const zz = (side < 0 ? z0 + 0.04 : z1 - 0.04) * CUBE_D;
      pictures.push({ kind: "work", i, p: [cx, WORK_Y, zz], w: WORK_W, h: WORK_H, turn: side < 0 ? 0 : Math.PI, t0: t + 0.04, t1: t + 0.2, caption: [cx, WORK_Y - WORK_H / 2 - 0.47, zz] });
    });
    // the end wall: the case study's picture, left of the hall's axis (the
    // camera faces the wall square on, the copy to its right, clear of the
    // columns)
    const zc = (z0 + z1) / 2 + END_DZ;
    const ew = END_H * WORK_ASPECT;
    frameX(x1, zc - ew / 2 - m, zc + ew / 2 + m, END_Y - END_H / 2 - m, END_Y + END_H / 2 + m, { t0: 14.5, t1: 14.9, w: 1.5 });
    pictures.push({ kind: "feature", p: [x1 + 0.02, END_Y, zc * CUBE_D], w: ew, h: END_H, turn: -Math.PI / 2, t0: 15.15, t1: 15.4 });
  }

  // ---- 17 the clients: a grid of cubes rising in a wave, a logo on each top
  const logos = [];
  {
    const [x, z] = CLIENTS_AT;
    const s2 = A.clientSize;
    const w = 0.5 + 3 * A.clientGapX + s2 + 0.5;
    const d = 0.5 + 2 * A.clientGapZ + s2 + 0.5;
    L.path(ground([[x, z], [x + w, z], [x + w, z + d], [x, z + d], [x, z]], 0.01), { t0: A.clientStart - 0.1, t1: A.clientStart + 0.2, w: 1.2 });
    CLIENTS.forEach((c, k) => {
      const i = k % 4;
      const j = Math.floor(k / 4);
      const cx = x + 0.5 + i * A.clientGapX;
      const cz = z + 0.5 + j * A.clientGapZ;
      const levels = A.clientBase + (i + j) * A.clientStep;
      const t0 = A.clientStart + (i + j) * A.clientStagger * 2 + i * 0.012;
      const dur = 0.32;
      box(L, cellBox(cx, cz, s2, s2, levels), { t0, t1: t0 + dur, w: 1.2 });
      logos.push({ src: c.logo, name: c.name, p: P(cx + s2 / 2, lv(levels), cz + s2 / 2), size: s2 * A.logoSize, turn: A.logoTurn, t0: t0 + dur * 0.72, t1: t0 + dur * 1.05 });
    });
  }

  // ---- 18 the bigger picture: the places, named from above ---------------
  [
    [P(0.5, 0.5, -6), "Origin"],
    [P(A.humanX, 0.5, A.humanZ), "People"],
    [P(44, 0.5, 4.5 - 12), "Capabilities"],
    [P(52, 0.5, PROC_Z), "Process"],
    [P(84, 0.5, PROC_Z), "Work"],
    [P(106, 0.5, PROC_Z), "Clients"],
  ].forEach(([p, text], k) => label(p, text, 17.1 + k * 0.05, 18.05, k === 0));

  return { lines: L, solids, prisms: PRISMS, labels, logos, pictures };
}

// ---------------------------------------------------------------------------
// The camera: where it looks (target), from where (yaw and pitch round it,
// degrees), how much it frames (size: half the height it shows), its lens
// (fov, degrees) and where on the screen the subject sits (sx, sy: a shift
// of the image, −1 … 1; mx, my on a phone). One key per moment; the rig
// interpolates them monotonically, so it never overshoots a hold.
// ---------------------------------------------------------------------------
const deg = (r) => (r * 180) / Math.PI;
const C = CORE_CENTRE;
const MARK = { target: MARK_CENTRE, yaw: deg(LOGO_YAW), pitch: deg(LOGO_PITCH), size: MARK_HALF * 1.62, fov: 0.6 };
const site = (id, y) => {
  const [x, z] = SITES[id].at;
  return [x + 4, y, (z + 4) * CUBE_D];
};
export const KEYS = [
  { t: -1, target: C, yaw: -6, pitch: 12, size: 2.4, fov: 34, sx: 0.3, my: -0.3 },
  { t: 0, target: C, yaw: -26, pitch: 20, size: 1.8, fov: 34, sx: 0.3, my: -0.3 },
  { t: 0.8, target: C, yaw: -42, pitch: 23, size: 1.85, fov: 34, sx: 0.3, my: -0.3 },
  { t: 1.6, target: C, yaw: -78, pitch: 17, size: 2.5, fov: 34, sx: 0.3, my: -0.3 },
  { t: 2.05, target: C, yaw: -58, pitch: 24, size: 3.4, fov: 18, sx: 0.3, my: -0.3 },
  { t: 2.75, ...MARK, sx: 0.3, my: -0.3 },
  { t: 3.8, ...MARK, sx: 0.3, my: -0.3 },
  { t: 4.6, target: [0.5, 1.8, -0.5], yaw: -62, pitch: 20, size: 4.3, fov: 34, sx: 0.3, my: -0.3 },
  { t: 5.55, target: [0.5, 1.0, -0.5], yaw: -24, pitch: 40, size: 6.6, fov: 36, sx: 0.3, my: -0.3 },
  { t: 6.5, target: [0.5, 0, -0.5], yaw: -28, pitch: 58, size: 13.5, fov: 36, sx: 0.3, my: -0.25 },
  { t: 6.8, target: [0.5, 0, -0.5], yaw: -26, pitch: 58, size: 13.8, fov: 36, sx: 0.3, my: -0.25 },
  { t: 7.25, target: [LAYOUT.humanX, 1, LAYOUT.humanZ * CUBE_D], yaw: LAYOUT.humanFacing, pitch: 22, size: 3.9, fov: 40, sx: 0.3, my: -0.25 },
  { t: 7.88, target: [LAYOUT.humanX, 1, LAYOUT.humanZ * CUBE_D], yaw: 8, pitch: 26, size: 4.2, fov: 40, sx: 0.3, my: -0.25 },
  { t: 8.6, target: [44, 0, 4.5], yaw: -12, pitch: 68, size: 20.5, fov: 36, sx: 0.24, my: -0.2 },
  { t: 8.95, target: [44, 0, 4.5], yaw: -8, pitch: 70, size: 21, fov: 36, sx: 0.24, my: -0.2 },
  { t: 9.5, target: site("strategy", 1.2), yaw: -36, pitch: 34, size: 4.8, fov: 34, sx: 0.42 },
  { t: 10.5, target: site("design", 2.2), yaw: -24, pitch: 16, size: 6, fov: 34, sx: -0.45 },
  { t: 11.5, target: [52, 2.6, 15 * CUBE_D], yaw: -36, pitch: 20, size: 5.8, fov: 34, sx: 0.45 },
  { t: 12.5, target: site("marketing", 3.6), yaw: -46, pitch: 18, size: 6.6, fov: 34, sx: -0.45 },
  { t: 13.5, target: [52, 1.2, PROC_Z * CUBE_D], yaw: 0, pitch: 28, size: 6.4, fov: 34, sy: -0.28, my: -0.2 },
  // the hall: in at its door, then straight down it, the work passing on
  // the walls either side and the heading in the middle of the screen; then
  // the end wall, held left of the case study's copy
  { t: 14.15, target: [73, 2.3, HALL_Z], yaw: -90, pitch: 2, size: 1.3, fov: 66 },
  ...WORK_BAYS.map(([bx], i) => ({ t: WORK_T[i], target: [bx + 0.4, 2.4, HALL_Z], yaw: -90, pitch: 2, size: 1.3, fov: 66 })),
  { t: 15.55, target: [HALL.x[1], END_Y, HALL_Z], yaw: -90, pitch: 1, size: END_DIST * Math.tan((24 * Math.PI) / 180), fov: 48, mx: 0.55, my: 0.62 },
  { t: 16.5, target: [CLIENTS_AT[0] + 4.3, 1.2, (CLIENTS_AT[1] + 3.5) * CUBE_D], yaw: -20, pitch: 56, size: 5.8, fov: 34, sx: 0.45 },
  { t: 17.5, target: [42, 0, 6], yaw: -28, pitch: 58, size: 44, fov: 32 },
  { t: 18.5, target: [0.5, 1.6, -0.5], yaw: -62, pitch: 22, size: 4.6, fov: 34, sx: 0.4 },
  { t: 19.5, ...MARK, size: MARK_HALF * 2, sx: -0.5 },
  { t: 21, ...MARK, size: MARK_HALF * 2, sx: -0.5 },
];
