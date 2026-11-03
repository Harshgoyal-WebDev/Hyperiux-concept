import { Lines } from "./lines";
import { CORE_CENTRE, CUBE_D, CUBE_H, LOGO_PITCH, LOGO_YAW, MARK_CENTRE, MARK_HALF, markToWorld } from "./space";
import { CONNECTIONS, JOURNEY, PROCESS, SERVICES } from "../content";

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

const mulberry = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------
// The places along the thread (grid coordinates)
// ---------------------------------------------------------------------------
const STREET_Z = 4.5;
const STREET = [7, 43]; // the journey's street, x from → to
const GATES = [12, 18, 24, 30, 36];
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

// the windows of the page's frames (world time)
// (each built as its section comes up the screen: done as it is centred)
const STATION_T = { strategy: 8.6, design: 9.6, technology: 10.6, marketing: 11.6 };

export function buildWorld(mark) {
  const L = new Lines();
  SOLIDS = [];
  const solids = SOLIDS;
  const labels = [];
  const label = (p, text, t0, t1, accent = false, dense = false) => labels.push({ p, text, t0, t1, accent, dense });

  // ---- the ground: the grid, drawn outward from the core on load --------
  const X0 = -40;
  const X1 = 132;
  const Z0 = -44;
  const Z1 = 60;
  const piece = 3;
  const gridT = (x, z) => -0.95 + Math.min(Math.hypot(x, z) / 42, 1) * 0.75;
  for (let x = X0 + 0.5; x <= X1; x += 3) {
    for (let z = Z0; z < Z1; z += piece) {
      const near = Math.abs(z) < Math.abs(z + piece) ? z : z + piece;
      const far = near === z ? z + piece : z;
      const t = gridT(x, near);
      L.seg(P(x, 0, near), P(x, 0, far), { t0: t, t1: t + 0.12, tone: "faint" });
    }
  }
  for (let z = Z0 + 0.5; z <= Z1; z += 3) {
    for (let x = X0; x < X1; x += piece) {
      const near = Math.abs(x) < Math.abs(x + piece) ? x : x + piece;
      const far = near === x ? x + piece : x;
      const t = gridT(near, z);
      L.seg(P(near, 0, z), P(far, 0, z), { t0: t, t1: t + 0.12, tone: "faint" });
    }
  }

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
  nests(4.25, [5.6, 6.0]);
  nests(18.05, [18.95, 19.25]); // and again on coming home (19)
  for (let i = -3; i <= 4; i++) {
    const t0 = 4.45 + (i + 3) * 0.02;
    L.seg(P(i, 0.01, -4), P(i, 0.01, 3), { t0, t1: t0 + 0.3, tone: "guide", out: [6.4, 6.8] });
    L.seg(P(-3, 0.01, i - 1), P(4, 0.01, i - 1), { t0, t1: t0 + 0.3, tone: "guide", out: [6.4, 6.8] });
  }

  // ---- 06 structure: modules round the core, wired face to face ---------
  const mods = [
    [-2, -3, 2], [0, -3, 1], [2, -3, 3],
    [-2, -1, 1], [2, -1, 1],
    [-2, 1, 1], [0, 1, 2], [2, 1, 1],
  ];
  mods.forEach(([x, z, n], k) => {
    for (let y = 0; y < n; y++) {
      const t0 = 5.05 + k * 0.04 + y * 0.08;
      box(L, cellBox(x, z, 1, 1, 1, y), { t0, t1: t0 + 0.3, w: 1.1, out: [6.55, 6.95] });
    }
  });
  const wy = H / 2;
  const wires = [
    [[1, -0.5], [2, -0.5]], [[0, -0.5], [-1, -0.5]], [[0.5, -1], [0.5, -2]], [[0.5, 0], [0.5, 1]],
    [[-1, -2.5], [0, -2.5]], [[1, -2.5], [2, -2.5]], [[-1, 1.5], [0, 1.5]], [[1, 1.5], [2, 1.5]],
    [[-1.5, -2], [-1.5, -1]], [[2.5, -2], [2.5, -1]], [[-1.5, 0], [-1.5, 1]], [[2.5, 0], [2.5, 1]],
  ];
  wires.forEach(([a, b], k) => L.seg(P(a[0], wy, a[1]), P(b[0], wy, b[1]), { t0: 5.4 + k * 0.025, t1: 5.55 + k * 0.025, out: [6.55, 6.9], tone: k < 4 ? "accent" : "ink" }));

  // ---- 07 the five connections leave it; Growth becomes the thread ------
  const nodes = [
    { at: [-8, -6], route: [[0, -0.5], [-7.5, -0.5], [-7.5, -5]] },
    { at: [-5, -10], route: [[0.5, -1], [0.5, -4], [-4.5, -4], [-4.5, -9]] },
    { at: [3, -10], route: [[0.5, -1], [0.5, -4], [3.5, -4], [3.5, -9]] },
    { at: [8, -6], route: [[1, -0.5], [8.5, -0.5], [8.5, -5]] },
    { at: [6, 4], route: null },
  ];
  nodes.forEach((n, k) => {
    const t0 = 6.05 + k * 0.06;
    if (n.route) L.path(ground(n.route), { t0, t1: t0 + 0.4, out: [18.6, 18.95] });
    box(L, cellBox(n.at[0], n.at[1], 1, 1, 2), { t0: t0 + 0.3, t1: t0 + 0.6, w: 1.2, out: [18.6, 18.95] });
    label(P(n.at[0] + 0.5, lv(2) + 0.35, n.at[1] + 0.5), CONNECTIONS[k], t0 + 0.4, 7.25, k === 4);
  });

  // ---- the thread --------------------------------------------------------
  // [grid point, the time its head passes it]
  const thread = [
    [[0.5, 0], 6.05],
    [[0.5, STREET_Z], 6.3],
    [[6, STREET_Z], 6.5],
    [[STREET[0], STREET_Z], 7.02],
    [[STREET[1], STREET_Z], 7.95],
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
  for (const t of [thread, thread2]) {
    for (let i = 1; i < t.length; i++) {
      const [a, ta] = t[i - 1];
      const [b, tb] = t[i];
      L.seg(P(a[0], 0.03, a[1]), P(b[0], 0.03, b[1]), { t0: ta, t1: tb, tone: "accent", w: 2.2 });
    }
  }

  // ---- 08 the journey: the street, its five gates -------------------------
  GATES.forEach((x, k) => {
    const t = 7.02 + ((x - STREET[0]) / (STREET[1] - STREET[0])) * 0.93; // when the head reaches it
    const o = { t0: t - 0.16, t1: t - 0.02, w: 1.3 };
    const g = 0.22;
    const gh = 2.5;
    box(L, [P(x, 0, 2.8), P(x + g, gh, 2.8 + g)], o);
    box(L, [P(x, 0, 6.2 - g), P(x + g, gh, 6.2)], o);
    box(L, [P(x, gh, 2.8), P(x + g, gh + g, 6.2)], { ...o, tone: k === 4 ? "accent" : "ink" });
    label(P(x + 0.11, gh + 0.55, 4.5), `${JOURNEY[k].n} ${JOURNEY[k].label}`, t - 0.14, t + 0.12, true);
  });

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
  {
    const [x0, x1] = HALL.x;
    const [z0, z1] = HALL.z;
    const h = HALL.h;
    const at = (x) => 13.7 + ((x - x0) / (x1 - x0)) * 0.9;
    for (let x = x0; x <= x1; x += 1) {
      L.seg(P(x, 0.02, z0), P(x, 0.02, z1), { t0: at(x), t1: at(x) + 0.12, tone: "guide" });
      if ((x - x0) % 2 === 0) L.seg(P(x, h, z0), P(x, h, z1), { t0: at(x), t1: at(x) + 0.12, tone: "guide" });
    }
    for (let z = z0; z <= z1; z += 1) {
      L.seg(P(x0, 0.02, z), P(x1, 0.02, z), { t0: 13.7, t1: 14.6, tone: "guide" });
      if ((z - z0) % 2 === 0) L.seg(P(x0, h, z), P(x1, h, z), { t0: 13.7, t1: 14.6, tone: "guide" });
    }
    for (let x = x0; x <= x1; x += 4) {
      for (const z of [z0, z1 - 0.4]) box(L, [P(x, 0, z), P(x + 0.4, h, z + 0.4)], { t0: at(x), t1: at(x) + 0.2, w: 1.2 });
      L.seg(P(x + 0.2, h, z0), P(x + 0.2, h, z1), { t0: at(x) + 0.1, t1: at(x) + 0.25 });
    }
    // frames on its walls, and the one at its end
    const frame = (xa, xb, ya, yb, z, o) => L.path([P(xa, ya, z), P(xb, ya, z), P(xb, yb, z), P(xa, yb, z), P(xa, ya, z)], o);
    [74, 82, 90].forEach((x) => {
      frame(x + 0.6, x + 3.4, 1.2, 3.6, z0 + 0.05, { t0: at(x) + 0.15, t1: at(x) + 0.35, w: 1.3 });
      frame(x + 0.6, x + 3.4, 1.2, 3.6, z1 - 0.05, { t0: at(x) + 0.15, t1: at(x) + 0.35, w: 1.3 });
    });
    L.path([P(x1, 0.8, z0 + 1.2), P(x1, 0.8, z1 - 1.2), P(x1, 4.0, z1 - 1.2), P(x1, 4.0, z0 + 1.2), P(x1, 0.8, z0 + 1.2)], { t0: 14.5, t1: 14.9, w: 1.5 });
  }

  // ---- 17 the clients: twelve modules on one plinth ----------------------
  {
    const [x, z] = CLIENTS_AT;
    L.path(ground([[x, z], [x + 8, z], [x + 8, z + 8], [x, z + 8], [x, z]], 0.01), { t0: 16.0, t1: 16.3, w: 1.2 });
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        const t0 = 16.1 + (i + j * 4) * 0.035;
        box(L, cellBox(x + 0.75 + i * 1.9, z + 1.25 + j * 2.25, 1, 1, 1), { t0, t1: t0 + 0.25, w: 1.2 });
      }
    }
  }

  // ---- 18 the bigger picture: the places, named from above ---------------
  [
    [P(0.5, 0.5, -6), "Origin"],
    [P(25, 0.5, STREET_Z), "Journey"],
    [P(44, 0.5, 4.5 - 12), "Capabilities"],
    [P(52, 0.5, PROC_Z), "Process"],
    [P(84, 0.5, PROC_Z), "Work"],
    [P(106, 0.5, PROC_Z), "Clients"],
  ].forEach(([p, text], k) => label(p, text, 17.1 + k * 0.05, 18.05, k === 0));

  // ---- the city: rising round the street as the journey runs through it --
  const keep = [
    [-12, -14, 12, 8],
    [-28, 0, 0, 30], // (the line of sight to the mark)
    [6, 1.5, 47, 7.5],
    [39, -1, 49, 10],
    [31, -11, 41, -1],
    [47, -11, 57, -1],
    [47, 10, 57, 20],
    [31, 10, 41, 20],
    [34, -3, 54, 0.5],
    [34, 7, 54, 10],
    [34, 18, 70, 36],
    [68, 18, 100, 30],
    [100, 18, 118, 30],
    [113, -18, 119, 30],
    [-2, -18, 119, -14],
    [-1, -18, 2, -1],
  ];
  const rand = mulberry(7);
  for (let x = -36; x < 128; x += 3) {
    for (let z = -40; z < 56; z += 3) {
      if (rand() > 0.56) continue;
      const r = rand();
      const sx = r < 0.6 ? 1 : 2;
      const sz = r < 0.75 ? 1 : 2;
      if (keep.some(([a, b, c, d]) => x + sx > a - 0.5 && x < c + 0.5 && z + sz > b - 0.5 && z < d + 0.5)) continue;
      const far = Math.min(Math.hypot(x - 25, z - STREET_Z) / 50, 1);
      const street = x > 4 && x < 48 && Math.abs(z - STREET_Z) < 12; // lining the journey
      const tall = rand() < (street ? 0.16 : 0.07);
      const levels = tall ? 8 + Math.floor(rand() * 7) : (street ? 3 : 1) + Math.floor(rand() * (street ? 5 : 2 + far * 5));
      // rising just ahead of the camera as it runs the street
      const t0 = 6.6 + Math.min(Math.max((x + 6) / 60, 0), 1) * 0.62 + rand() * 0.1;
      tower(L, x, z, sx, sz, levels, t0, 0.22 + levels * 0.015, { tone: "guide", w: 1 });
    }
  }

  return { lines: L, solids, labels };
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
  { t: 5.55, target: [0.5, 1.2, -0.5], yaw: -24, pitch: 30, size: 4.6, fov: 36, sx: 0.3, my: -0.3 },
  { t: 6.5, target: [0.5, 0, -2.5], yaw: -30, pitch: 56, size: 11.5, fov: 36, sx: 0.3, my: -0.25 },
  { t: 7.12, target: [12, 1.6, STREET_Z], yaw: -90, pitch: 17, size: 3.6, fov: 50, sx: 0.12 },
  { t: 7.92, target: [42, 1.6, STREET_Z], yaw: -90, pitch: 17, size: 3.6, fov: 50, sx: 0.12 },
  { t: 8.6, target: [44, 0.5, 4.5], yaw: -34, pitch: 50, size: 12, fov: 38, sx: 0.28, my: -0.2 },
  { t: 8.95, target: [44, 0.5, 4.5], yaw: -30, pitch: 52, size: 12.5, fov: 38, sx: 0.28, my: -0.2 },
  { t: 9.5, target: site("strategy", 1.2), yaw: -36, pitch: 34, size: 4.8, fov: 34, sx: 0.42 },
  { t: 10.5, target: site("design", 2.2), yaw: -24, pitch: 16, size: 6, fov: 34, sx: -0.45 },
  { t: 11.5, target: [52, 2.6, 15 * CUBE_D], yaw: -36, pitch: 20, size: 5.8, fov: 34, sx: 0.45 },
  { t: 12.5, target: site("marketing", 3.6), yaw: -46, pitch: 18, size: 6.6, fov: 34, sx: -0.45 },
  { t: 13.5, target: [52, 1.2, PROC_Z * CUBE_D], yaw: 0, pitch: 28, size: 6.4, fov: 34, sy: -0.28, my: -0.2 },
  { t: 14.15, target: [73, 2.1, PROC_Z], yaw: -90, pitch: 2, size: 1.3, fov: 66 },
  { t: 15.05, target: [90, 2.1, PROC_Z], yaw: -90, pitch: 2, size: 1.3, fov: 66 },
  { t: 15.55, target: [98, 2.4, PROC_Z], yaw: -90, pitch: 3, size: 2.6, fov: 48, sx: -0.35 },
  { t: 16.5, target: [CLIENTS_AT[0] + 4, 0.6, (PROC_Z) * CUBE_D], yaw: -42, pitch: 40, size: 5, fov: 34, sx: 0.4 },
  { t: 17.5, target: [42, 0, 6], yaw: -28, pitch: 58, size: 44, fov: 32 },
  { t: 18.5, target: [0.5, 1.6, -0.5], yaw: -62, pitch: 22, size: 4.6, fov: 34, sx: 0.4 },
  { t: 19.5, ...MARK, size: MARK_HALF * 2, sx: -0.5 },
  { t: 21, ...MARK, size: MARK_HALF * 2, sx: -0.5 },
];
