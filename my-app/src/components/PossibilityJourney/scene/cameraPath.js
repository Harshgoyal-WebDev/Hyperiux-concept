import * as THREE from "three";
import { COURT, FINALE, PLANES } from "../world/layout";

// The camera's one continuous path: keyframes { t, p: position, l: look-at,
// fov }. Positions and targets run through centripetal Catmull-Rom splines
// (no overshoot) and time maps onto them through a monotone cubic, so the
// camera eases through each key instead of stopping, never snaps, and
// retraces itself exactly when scrolled back. The target moves on its own
// spline, so where the visitor looks is directed separately from where
// they are.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Cc = COURT;

// the walk round the tree: from the courtyard's entrance (+z) once round,
// counter-clockwise, ending on the side the finale looks down from
const ORBIT_R = 12.5;
const orbitKeys = (() => {
  const keys = [];
  const a0 = Math.PI / 2;
  const a1 = FINALE.a + Math.PI * 2;
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const y = 2.6 + Math.sin((i / n) * Math.PI) * 1.4; // rising a little as it goes round
    keys.push({ t: 81.5 + i * 1.6, p: V(Cc.cx + Math.cos(a) * ORBIT_R, y, Cc.cz + Math.sin(a) * ORBIT_R), l: V(Cc.cx, 4.6 + i * 0.05, Cc.cz), fov: 52 });
  }
  return keys;
})();
const W = FINALE.spot;
const D = FINALE.dir;

const KEYS = [
  // 01 opening: wide, inside the shell, the great opening and the sky
  { t: 0, p: V(0, 3.0, 46), l: V(0, 9.5, 0), fov: 52 },
  { t: 6, p: V(0.6, 2.8, 34), l: V(0, 8.5, -6), fov: 50 },
  { t: 12, p: V(0.4, 2.5, 14), l: V(-0.5, 5, -24), fov: 50 },
  // 02 the path: through the opening; the line appears at our feet
  { t: 16.5, p: V(0.2, 2.2, -2), l: V(1.2, 0.6, -30), fov: 50 },
  { t: 22.5, p: V(-1.6, 2.3, -30), l: V(2.6, 1.6, -64), fov: 50 },
  { t: 28.5, p: V(0.4, 2.4, -66), l: V(0, 4, -104), fov: 50 },
  // 03 the challenge: down the passage of arches
  { t: 33, p: V(0, 2.5, -92), l: V(0, 4.4, -126), fov: 48 },
  { t: 38, p: V(0.5, 2.5, -116), l: V(-0.6, 4.6, -148), fov: 48 },
  { t: 44, p: V(0, 2.6, -150), l: V(0, 4, -186), fov: 48 },
  // 04 our approach: into the hall, the slabs rising before us
  { t: 48.5, p: V(-5.5, 2.7, -170), l: V(0.5, 3.4, -197), fov: 48 },
  { t: 53, p: V(-11.5, 3.2, -180), l: V(-4.2, 3.4, -199), fov: 50 },
  { t: 58, p: V(-10.5, 3.3, -184), l: V(-0.8, 3.4, -203), fov: 50 },
  { t: 61.5, p: V(-1, 2.8, -222), l: V(4, 3.4, -250), fov: 48 },
  // 05 impact: along the gallery, the work at our right
  ...PLANES.map((p, i) => ({ t: 64.5 + i * 3.3, p: V(p.x - 7.4, 2.9, p.z + 11.6), l: V(p.x - 4.4, p.y - 0.3, p.z), fov: 46 })),
  // 06 the possibilities: into the courtyard, once round the tree...
  { t: 78.5, p: V(0, 2.4, Cc.cz + 30), l: V(0, 5.2, Cc.cz), fov: 50 },
  ...orbitKeys,
  // ...then up, looking down into the water where the drop will fall
  { t: 96.2, p: W.clone().addScaledVector(D, 5.6).add(V(0, 6.4, 0)), l: W.clone(), fov: 50 },
  { t: 100, p: W.clone().addScaledVector(D, 3.2).add(V(0, 3.6, 0)), l: W.clone(), fov: 48 },
];

const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.p), false, "centripetal");
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.l), false, "centripetal");
const TS = KEYS.map((k) => k.t);
const N = KEYS.length;

// Fritsch–Carlson monotone cubic through (t_k, k), eased at both ends
const slopes = (() => {
  const d = [];
  for (let k = 0; k < N - 1; k++) d.push(1 / (TS[k + 1] - TS[k]));
  const m = new Array(N);
  m[0] = 0;
  m[N - 1] = 0;
  for (let k = 1; k < N - 1; k++) m[k] = (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < N - 1; k++) {
    const a = m[k] / d[k];
    const b = m[k + 1] / d[k];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[k] = tau * a * d[k];
      m[k + 1] = tau * b * d[k];
    }
  }
  return m;
})();

function keyIndexAt(t) {
  if (t <= TS[0]) return 0;
  if (t >= TS[N - 1]) return N - 1;
  let k = 0;
  while (k < N - 2 && t >= TS[k + 1]) k++;
  const h = TS[k + 1] - TS[k];
  const s = (t - TS[k]) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return k * (2 * s3 - 3 * s2 + 1) + h * slopes[k] * (s3 - 2 * s2 + s) + (k + 1) * (-2 * s3 + 3 * s2) + h * slopes[k + 1] * (s3 - s2);
}

// the camera at time t, written into pos and look; returns the fov
export function cameraAt(t, pos, look) {
  const x = Math.min(N - 1, Math.max(0, keyIndexAt(t)));
  const u = x / (N - 1);
  posCurve.getPoint(u, pos);
  if (look) lookCurve.getPoint(u, look);
  const k = Math.min(N - 2, Math.floor(x));
  const f = x - k;
  const ff = f * f * (3 - 2 * f);
  return KEYS[k].fov + (KEYS[k + 1].fov - KEYS[k].fov) * ff;
}

const _p = new THREE.Vector3();
export function cameraZ(t) {
  cameraAt(t, _p, null);
  return _p.z;
}
