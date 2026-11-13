import * as THREE from "three";
import { CORE, REVEAL, SPARK } from "./layout";

// The dark version's camera: one continuous, eased path (centripetal
// Catmull-Rom through keys, a monotone time warp), low and cinematic: over
// the wet plain toward the sun, up at the monoliths, through the slit of
// light, among the lifting blocks, toward the arcs, down the tunnel of
// rings to the core, round it, and into the light of the reveal's ring.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Z = SPARK.z;
const K = CORE;
const R = REVEAL;

const KEYS = [
  // 01 the origin
  { t: 0, p: V(0, 2.0, 46), l: V(0, 5.5, -120), fov: 44 },
  { t: 5.5, p: V(0.6, 2.2, 32), l: V(0, 7, -120), fov: 44 },
  { t: 10.5, p: V(2.2, 2.6, 12), l: V(0, 13, Z), fov: 46 },
  // 02 the spark: low, looking up the monoliths; then through the slit
  { t: 15, p: V(2.6, 2.4, -16), l: V(0, 19, Z), fov: 50 },
  { t: 19, p: V(0.8, 3.4, -42), l: V(0, 9, Z), fov: 50 },
  { t: 22, p: V(0, 4.0, Z), l: V(0, 4.2, Z - 30), fov: 54 },
  // 03 movement: out among the ranks, the blocks lifting
  { t: 25.5, p: V(0, 4.4, -82), l: V(-10, 9, -122), fov: 50 },
  { t: 29.5, p: V(-6, 5.2, -108), l: V(10, 14, -146), fov: 50 },
  { t: 33, p: V(4, 5, -138), l: V(0, 9, -196), fov: 50 },
  // 04 alignment: the arcs ahead, turning
  { t: 37.5, p: V(0, 5.6, -160), l: V(0, 8, -240), fov: 50 },
  { t: 42, p: V(-9, 6.4, -176), l: V(0, 8, -250), fov: 50 },
  // 05 assembly: square on to the forming tunnel
  { t: 47, p: V(0, 6.6, -190), l: V(0, 7, -270), fov: 48 },
  { t: 53, p: V(0, 6.6, -210), l: V(0, 6.6, -285), fov: 48 },
  // 06 convergence: into the rings, the cube appearing
  { t: 58, p: V(0, 6.2, -232), l: V(0, 5, -300), fov: 48 },
  { t: 63, p: V(1.5, 5.6, -256), l: V(0, 4.2, K.z), fov: 48 },
  // 07 the core: close, moving round it a little
  { t: 67.5, p: V(-4.5, 5.0, -276), l: V(0, K.y, K.z), fov: 46 },
  { t: 72, p: V(5.5, 4.6, -283), l: V(0, K.y, K.z), fov: 46 },
  { t: 76, p: V(3, 5.4, -284), l: V(0, 6, K.z - 10), fov: 48 },
  // 08 reveal: the cube gives way; the great ring ahead, square on
  { t: 80.5, p: V(0, 6.6, -288), l: V(0, R.cy, R.z), fov: 50 },
  { t: 86, p: V(0, 7.6, -300), l: V(0, R.cy, R.z), fov: 50 },
  // 09 transition: into its light
  { t: 92, p: V(0, 8.2, -314), l: V(0, R.cy, R.z - 10), fov: 52 },
  { t: 100, p: V(0, R.cy, R.z + 4), l: V(0, R.cy, R.z - 40), fov: 58 },
];

const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.p), false, "centripetal");
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.l), false, "centripetal");
const TS = KEYS.map((k) => k.t);
const N = KEYS.length;

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

export function nightCameraAt(t, pos, look) {
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
export function nightCameraZ(t) {
  nightCameraAt(t, _p, null);
  return _p.z;
}
