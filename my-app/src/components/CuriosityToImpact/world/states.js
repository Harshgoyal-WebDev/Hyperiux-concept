import * as THREE from "three";

// The particles' states, one shape per chapter of the story. Each is a
// row block of one float texture (TEX_W wide), read in the vertex shader by
// particle index, so a particle knows every place it will be:
//
//   0 VOID         a few particles in an enormous dark space
//   1 EMERGENCE    gathering along one current, small clusters forming
//   2 FLOW         an asymmetric organic form: a dense core, tendrils
//   3 NETWORK      spread into a wide web of filaments (lines join it)
//   4 UNIVERSE     four disciplines' clusters, currents between them
//   5 CONVERGENCE  streams spiralling into one centre
//   6 FORMATION    on the glass sculpture's ribbons: (u, v, ribbon) — the
//                  shader evaluates the ribbon, so they sit on its surface
//   7 DISSOLUTION  the drift each one takes forward off the sculpture
//   8 WHITE        a calm flowing band, in front of the final camera
//   9 GRID         the page's layout grid: (column, height) on screen
//  10 SEEDS        per particle: delay, size, rank (order of appearance), kind
//
// Kind < ORANGE is an orange energy particle; kind > DUST stays scattered
// through the space (the depth of the void) until the white band.

export const TEX_W = 1024;
export const STATES = 11;
export const ORANGE = 0.07;
export const DUST = 0.88;
export const GRID_LINES = 13; // twelve columns

// the disciplines' clusters (07), also where their labels stand
export const CLUSTERS = [
  [-17, 0, -2], // Design
  [-3, 9, -10], // Technology
  [13, 8, -5], // Strategy
  [11, -6, 0], // Engineering
];

function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildStates(count) {
  const rand = mulberry(1907);
  const gauss = () => {
    const u = Math.max(rand(), 1e-7);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const rows = Math.ceil(count / TEX_W);
  const data = new Float32Array(TEX_W * rows * STATES * 4);
  const put = (k, i, x, y, z, w = 1) => {
    const o = ((k * rows + Math.floor(i / TEX_W)) * TEX_W + (i % TEX_W)) * 4;
    data[o] = x;
    data[o + 1] = y;
    data[o + 2] = z;
    data[o + 3] = w;
  };
  const curve = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  const v = new THREE.Vector3();

  // the shapes' fixed parts
  const current = curve([[-44, -7, -34], [-18, -2, -9], [0, 0, 0], [15, 3, -6], [36, 7, -22]]);
  const emergeClusters = Array.from({ length: 14 }, () => current.getPoint(rand()).add(new THREE.Vector3(gauss() * 4, gauss() * 3, gauss() * 4)));
  const core = new THREE.Vector3(3, 0, 0);
  const tendrils = Array.from({ length: 9 }, (_, j) => {
    // a random walk out of the core with momentum, so each one curls
    const pts = [core.clone().add(new THREE.Vector3(gauss(), gauss() * 0.6, gauss()))];
    let dir = new THREE.Vector3(Math.cos(j * 0.9 + 0.4) * (j % 3 === 0 ? -1.4 : 1), Math.sin(j * 1.7) * 0.5, Math.sin(j * 0.9 + 0.4)).normalize();
    for (let s = 0; s < 5; s++) {
      dir = dir.add(new THREE.Vector3(gauss() * 0.5, gauss() * 0.3, gauss() * 0.5)).normalize();
      pts.push(pts[pts.length - 1].clone().addScaledVector(dir, 3.2 + rand() * 2.6));
    }
    return curve(pts.map((p) => p.toArray()));
  });
  const filaments = Array.from({ length: 14 }, () =>
    curve(Array.from({ length: 5 }, (_, s) => [-32 + s * 16 + gauss() * 5, gauss() * 6, -8 + gauss() * 8]))
  );
  const C = CLUSTERS.map((c) => new THREE.Vector3(...c));
  const streams = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]].map(([a, b]) => {
    const mid = C[a].clone().lerp(C[b], 0.5).add(new THREE.Vector3(gauss() * 3, 3 + gauss() * 2, gauss() * 3));
    return new THREE.QuadraticBezierCurve3(C[a], mid, C[b]);
  });

  for (let i = 0; i < count; i++) {
    const delay = rand();
    const size = rand();
    const rank = rand();
    const kind = rand();
    const dust = kind > DUST;
    put(10, i, delay, size, rank, kind);

    // 0 VOID
    const vx = (rand() * 2 - 1) * 90;
    const vy = (rand() * 2 - 1) * 50;
    const vz = -120 + rand() * 180;
    put(0, i, vx, vy, vz);
    const scattered = (k, s = 0.04) => put(k, i, vx * (1 - s), vy * (1 - s), vz * (1 - s));
    const r = rand();

    // 1 EMERGENCE
    if (dust) scattered(1);
    else if (r < 0.55) {
      current.getPoint(rand(), v);
      const s = 0.5 + Math.pow(rand(), 2) * 2.6;
      put(1, i, v.x + gauss() * s, v.y + gauss() * s * 0.6, v.z + gauss() * s);
    } else if (r < 0.85) {
      const c = emergeClusters[Math.floor(rand() * emergeClusters.length)];
      put(1, i, c.x + gauss(), c.y + gauss() * 0.8, c.z + gauss());
    } else put(1, i, gauss() * 15, gauss() * 9, gauss() * 15 - 10);

    // 2 FLOW
    if (dust) scattered(2, 0.08);
    else if (r < 0.2) put(2, i, core.x + gauss() * 2.2, core.y + gauss() * 1.1, core.z + gauss() * 1.6);
    else if (r < 0.95) {
      const t = tendrils[Math.floor(rand() * tendrils.length)];
      const s = Math.pow(rand(), 1.4); // denser near the core
      t.getPoint(s, v);
      const w = (0.9 * Math.pow(1 - s, 1.2) + 0.08) * (rand() < 0.7 ? 0.45 : 1);
      put(2, i, v.x + gauss() * w, v.y + gauss() * w * 0.7, v.z + gauss() * w);
    } else put(2, i, core.x + gauss() * 9, gauss() * 5, gauss() * 9);

    // 3 NETWORK
    if (dust) scattered(3, 0.1);
    else if (r < 0.55) {
      filaments[Math.floor(rand() * filaments.length)].getPoint(rand(), v);
      const w = 0.4 + rand() * 0.8;
      put(3, i, v.x + gauss() * w, v.y + gauss() * w, v.z + gauss() * w);
    } else if (r < 0.9) {
      const x = (rand() * 2 - 1) * 32;
      const z = -22 + rand() * 28;
      put(3, i, x, 3 * Math.sin(0.18 * x + 0.5) * Math.cos(0.14 * z) + gauss() * 0.8, z);
    } else put(3, i, gauss() * 14, gauss() * 8, gauss() * 12 - 6);

    // 4 UNIVERSE
    if (dust) scattered(4, 0.1);
    else if (r < 0.55) {
      const c = C[Math.floor(rand() * 4)];
      // a swirled blob: a little tendril of its own
      const a = rand() * Math.PI * 2;
      const rr = Math.abs(gauss()) * 2.4;
      put(4, i, c.x + Math.cos(a) * rr + gauss() * 0.6, c.y + Math.sin(a * 2) * rr * 0.4 + gauss() * 0.6, c.z + Math.sin(a) * rr + gauss() * 0.6);
    } else if (r < 0.95) {
      streams[Math.floor(rand() * streams.length)].getPoint(rand(), v);
      put(4, i, v.x + gauss() * 0.6, v.y + gauss() * 0.6, v.z + gauss() * 0.6);
    } else put(4, i, gauss() * 20, gauss() * 10, gauss() * 14 - 4);

    // 5 CONVERGENCE
    if (dust) scattered(5, 0.12);
    else if (r < 0.7) {
      const s = rand();
      const rr = 2 + 24 * Math.pow(1 - s, 1.3);
      const th = (Math.floor(rand() * 6) * Math.PI * 2) / 6 + s * 5;
      const sp = 0.4 * (0.3 + (1 - s));
      put(5, i, rr * Math.cos(th) + gauss() * sp, 1.5 * Math.sin(th * 2) * (1 - s) + gauss() * sp, rr * Math.sin(th) * 0.8 + gauss() * sp);
    } else if (r < 0.95) {
      const th = rand() * Math.PI * 2;
      const rr = 5.5 + gauss() * 0.6;
      put(5, i, rr * Math.cos(th), gauss() * 0.6 + Math.sin(th * 3) * 0.6, rr * Math.sin(th) * 0.8);
    } else put(5, i, gauss() * 1.2, gauss() * 1.2, gauss() * 1.2);

    // 6 FORMATION: (u, v, ribbon); dust keeps to the void (ribbon -1)
    if (dust) put(6, i, 0, 0, -1);
    else {
      const ev = rand();
      // silk is densest along its edges
      const vv = ev < 0.5 ? (rand() < 0.5 ? Math.pow(rand(), 3) * 0.18 : 1 - Math.pow(rand(), 3) * 0.18) : rand();
      put(6, i, rand(), vv, Math.floor(rand() * 5));
    }

    // 7 DISSOLUTION: a drift forward (−z, the way the camera goes), wider
    // and further for the orange ones
    const far = kind < ORANGE ? 1.8 : 1;
    put(7, i, gauss() * 5 * far, gauss() * 3.5 * far, -(6 + rand() * 34) * far);

    // 8 WHITE: a band across the final view, heavier on the right
    {
      const x = -28 + Math.pow(rand(), 0.75) * 60;
      const sig = 0.5 + 1.6 * clamp01((x + 10) / 40);
      put(8, i, x, 2.6 * Math.sin(0.16 * x + 0.8) + 1.1 * Math.sin(0.37 * x + 2) + gauss() * sig, -45 + gauss() * 3);
    }

    // 9 GRID: a column line and a height on screen (−1 → 1)
    put(9, i, i % GRID_LINES, rand() * 2 - 1, 0);
  }

  // the network's lines: nearby particles in the NETWORK shape, at most two
  // each, found through a spatial hash
  const pairs = [];
  {
    const cell = 2.2;
    const hash = new Map();
    const pos = (i) => {
      const o = ((3 * rows + Math.floor(i / TEX_W)) * TEX_W + (i % TEX_W)) * 4;
      return [data[o], data[o + 1], data[o + 2]];
    };
    const nodes = [];
    for (let i = 0; i < count; i += 11) {
      const o = ((10 * rows + Math.floor(i / TEX_W)) * TEX_W + (i % TEX_W)) * 4;
      if (data[o + 3] > DUST) continue;
      nodes.push(i);
      const p = pos(i);
      const key = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
      if (!hash.has(key)) hash.set(key, []);
      hash.get(key).push(i);
    }
    for (const i of nodes) {
      const p = pos(i);
      const cx = Math.floor(p[0] / cell);
      const cy = Math.floor(p[1] / cell);
      const cz = Math.floor(p[2] / cell);
      const near = [];
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++)
          for (let c = -1; c <= 1; c++)
            for (const j of hash.get(`${cx + a},${cy + b},${cz + c}`) || []) {
              if (j <= i) continue;
              const q = pos(j);
              const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
              if (d < cell) near.push([d, j]);
            }
      near.sort((x, y) => x[0] - y[0]);
      for (const [, j] of near.slice(0, 2)) pairs.push(i, j);
    }
  }

  const tex = new THREE.DataTexture(data, TEX_W, rows * STATES, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return { tex, rows, pairs: new Float32Array(pairs) };
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
