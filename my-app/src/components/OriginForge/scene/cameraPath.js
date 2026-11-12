import * as THREE from "three";
import { STAGE_T, STAGE_U, io, seg } from "../timeline";
import { STAIR, STAIR_LENGTH, pitchY, stairFrame, stairPoint } from "../world/stair";
import { T } from "../tuning";
import { MARK_CENTER } from "../world/logo";

// Camera keyframes up to the end of the corridor: { t, p: position, l: look-at, fov }. Positions and
// targets run through centripetal Catmull-Rom splines (no overshoot); time
// maps to the spline through a monotone cubic, so the camera eases through
// each key instead of stopping, and holds where two keys sit close together.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = MARK_CENTER;

const KEYS = [
  // 01 awakening: far out, the ruined arch against the glow
  { t: 0, p: V(0, 2.3, 62), l: V(0, 7.2, 24), fov: 40 },
  { t: 4, p: V(0, 3.2, 47), l: V(0, 7.6, 20), fov: 40 },
  // 02 forgotten realm: through the arch, looking across the ruins
  { t: 6.6, p: V(0.8, 5.4, 31), l: V(-1, 7, 10), fov: 42 },
  { t: 9, p: V(3, 5.4, 18), l: V(-5, 4.5, -6), fov: 44 },
  // 03 core signal: down onto the dormant core
  { t: 11.2, p: V(6.5, 4.6, 12.5), l: V(0, 2.4, 0), fov: 40 },
  { t: 13.6, p: V(4.2, 3.4, 7.6), l: V(0, 3.0, 0), fov: 38 },
  // 04 resonance: rise, the full circle of markings below
  { t: 16.2, p: V(0, 8.5, 13.5), l: V(0, 1.6, 0), fov: 42 },
  { t: 18.6, p: V(0, 14, 21), l: V(0, 3, -2), fov: 44 },
  // 05 four forces: wide, as they rise
  { t: 21.8, p: V(0, 7.2, 31), l: V(0, 6, -3), fov: 42 },
  // 06–09 each force up close
  { t: 23.6, p: V(-4.5, 5.2, 11), l: V(-10.5, 6.4, -1.5), fov: 40 },
  { t: 25.4, p: V(-6.3, 5.1, 6.4), l: V(-10.5, 6.6, -1.5), fov: 38 },
  { t: 27.6, p: V(-0.6, 4.6, 4.6), l: V(-3.7, 6.6, -5), fov: 40 },
  { t: 29.4, p: V(-0.2, 5.6, 3.6), l: V(-3.7, 7.2, -5), fov: 38 },
  { t: 31.6, p: V(0.6, 4.6, 4.6), l: V(3.7, 6.6, -5), fov: 40 },
  { t: 33.4, p: V(0.2, 5.6, 3.6), l: V(3.7, 7.2, -5), fov: 38 },
  { t: 35.6, p: V(6.5, 5.1, 6.6), l: V(10.5, 6.6, -1.5), fov: 40 },
  { t: 37.4, p: V(6.8, 6.1, 7.6), l: V(10.5, 7.2, -1.5), fov: 38 },
  // 10 aligning: all four, from the front
  { t: 40.4, p: V(0, 6.8, 30), l: V(0, 6.5, -3), fov: 42 },
  // 11–14 convergence and forging: a slow arc in front, following the energy
  { t: 43.4, p: V(-21, 7.5, 13), l: V(0, 7, -3), fov: 42 },
  { t: 46.6, p: V(-13, 12, 22), l: V(0, 7.6, -3), fov: 42 },
  { t: 49.8, p: V(3, 15, 26), l: V(0, 8, -3), fov: 42 },
  { t: 53, p: V(17, 11, 17), l: V(0, 8.4, -3), fov: 42 },
  { t: 56.2, p: V(10, 9, 23), l: V(0, 8.6, -3), fov: 40 },
  // 15 the mark: square on, held
  { t: 59.4, p: V(0, M.y, 27.5), l: V(0, M.y, M.z), fov: 38 },
  { t: 62.4, p: V(0, M.y, 25), l: V(0, M.y, M.z), fov: 38 },
  // 16–18 the gate: approach, open, pass through the joint
  { t: 65.2, p: V(0, M.y, 15), l: V(0, M.y - 0.1, M.z), fov: 40 },
  { t: 68.2, p: V(0, M.y - 0.1, 5.5), l: V(0, M.y - 0.4, -12), fov: 44 },
  { t: 70.4, p: V(0, M.y - 0.4, -4.5), l: V(0, 7.4, -22), fov: 50 },
  { t: 72.6, p: V(0, 7.4, -15), l: V(0, 6.2, -36), fov: 48 },
  // 19 inner realm: down the corridor
  { t: 75.4, p: V(0, 5.6, -36), l: V(0, 5, -62), fov: 46 },
  { t: 77.8, p: V(0, 4.6, -57), l: V(0, 4.6, -80), fov: 46 },
  // 20 journey ahead: into the light
  { t: 79.6, p: V(0, 4.2, -69.5), l: V(-1, 6, -96), fov: 46 },
].sort((a, b) => a.t - b.t);

const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.p), false, "centripetal");
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => k.l), false, "centripetal");
const TS = KEYS.map((k) => k.t);
const N = KEYS.length;

// Fritsch–Carlson monotone cubic through (t_k, k)
const slopes = (() => {
  const d = [];
  for (let k = 0; k < N - 1; k++) d.push(1 / (TS[k + 1] - TS[k]));
  const m = new Array(N);
  m[0] = d[0];
  m[N - 1] = 0; // ease into the last key: the walk takes over from rest
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

function keysAt(t, pos, look) {
  const x = Math.min(N - 1, Math.max(0, keyIndexAt(t)));
  const u = x / (N - 1);
  posCurve.getPoint(u, pos);
  lookCurve.getPoint(u, look);
  const k = Math.min(N - 2, Math.floor(x));
  const f = x - k;
  const ff = f * f * (3 - 2 * f);
  return KEYS[k].fov + (KEYS[k + 1].fov - KEYS[k].fov) * ff;
}

// ---------------------------------------------------------------------------
// The climb. From the corridor's mouth the camera stops flying and walks: at
// eye height, up the flight, gliding on a rail that follows the treads but is
// smoothed over a couple of metres, so it rises evenly instead of bumping
// step by step (T.climbSway adds a stride's sway back, if wanted). It slows
// onto each landing, turns its head to the plinth there, then takes the next
// flight; at the top it walks across the summit and through the gate.
const WALK_FROM = KEYS[N - 1].t; // the walk starts where the keys end
const BLEND = 2.0; // and takes over from the last key over this long
const LAND_IN = 0.026; // how far onto a landing the climber stops (u)

// pace: (t, u) pairs, interpolated monotonically (never walks backwards)
const PACE = [
  [WALK_FROM, -0.075],
  [82.6, -0.022],
  ...STAGE_U.flatMap((u, i) => [
    [STAGE_T[i] + 0.3, u - LAND_IN],
    [STAGE_T[i] + 1.6, u + 0.004],
  ]),
  [96.6, 1.0],
  [98.4, 1.06],
  [100, 1.13],
];
const PT = PACE.map((p) => p[0]);
const PU = PACE.map((p) => p[1]);
const paceSlopes = (() => {
  const n = PACE.length;
  const d = [];
  for (let k = 0; k < n - 1; k++) d.push((PU[k + 1] - PU[k]) / (PT[k + 1] - PT[k]));
  const m = new Array(n);
  m[0] = 0;
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = m[k + 1] = 0;
      continue;
    }
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

export function walkU(t) {
  if (t <= PT[0]) return PU[0];
  const n = PACE.length;
  if (t >= PT[n - 1]) return PU[n - 1];
  let k = 0;
  while (k < n - 2 && t >= PT[k + 1]) k++;
  const h = PT[k + 1] - PT[k];
  const s = (t - PT[k]) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return PU[k] * (2 * s3 - 3 * s2 + 1) + h * paceSlopes[k] * (s3 - 2 * s2 + s) + PU[k + 1] * (-2 * s3 + 3 * s2) + h * paceSlopes[k + 1] * (s3 - s2);
}

// where each plinth's face is (ProcessStaircase places them from this too)
export const PLINTH_AHEAD = 2.3; // metres past the landing's centre
export const PLINTH_SIDE = 1.95; // on the railing side, clear of the overlay text
const plinthFace = STAGE_U.map((u) => stairPoint(u + PLINTH_AHEAD / STAIR_LENGTH, PLINTH_SIDE, 0.95));

// The rail's height: the flight's pitch line (through the foot of every
// riser: continuous, so no step-by-step ripple) averaged over a window, a
// smooth ramp up each flight easing into and out of every landing,
// tabulated once.
const RAIL_U0 = -0.3;
const RAIL_U1 = 1.3;
const RAIL_N = 2400;
const RAIL_WINDOW = 2.4 / STAIR_LENGTH; // metres either side, in u
const RAIL = (() => {
  const out = new Float32Array(RAIL_N + 1);
  const K = 32;
  for (let i = 0; i <= RAIL_N; i++) {
    const u = RAIL_U0 + ((RAIL_U1 - RAIL_U0) * i) / RAIL_N;
    let sum = 0;
    let wsum = 0;
    for (let k = -K; k <= K; k++) {
      const x = k / K;
      const w = 1 - x * x; // a soft (Epanechnikov) window: smooth to the second derivative
      sum += pitchY(u + x * RAIL_WINDOW) * w;
      wsum += w;
    }
    out[i] = sum / wsum;
  }
  return out;
})();
export function railY(u) {
  const x = ((u - RAIL_U0) / (RAIL_U1 - RAIL_U0)) * RAIL_N;
  if (x <= 0) return RAIL[0];
  if (x >= RAIL_N) return STAIR.rise;
  const i = Math.floor(x);
  const f = x - i;
  return RAIL[i] + (RAIL[i + 1] - RAIL[i]) * f;
}

const _f = { p: new THREE.Vector3(), tan: new THREE.Vector3(), n: new THREE.Vector3() };
const _ahead = new THREE.Vector3();
function walkAt(t, pos, look) {
  const u = walkU(t);
  stairFrame(u, _f);
  // an optional stride: a sway between the feet, once every two steps
  const sway = T.climbSway * Math.sin(((u * STAIR_LENGTH) / 0.42) * Math.PI);
  pos.copy(_f.p).addScaledVector(_f.n, -0.6 + sway);
  pos.y = railY(u) + STAIR.riser * 0.5 + T.eyeHeight + Math.abs(sway) * 0.4;

  // gaze: up the flight a few metres ahead (further while still on the
  // ground, so the whole staircase rises in front of you)
  const ground = 1 - THREE.MathUtils.smoothstep(u, -0.06, 0.0);
  const ul = u + T.lookAhead / STAIR_LENGTH + 0.11 * ground;
  stairFrame(ul, _f);
  _ahead.copy(_f.p).addScaledVector(_f.n, 0.1);
  _ahead.y = railY(ul) + 0.95 + 1.6 * ground;
  look.copy(_ahead);

  // on each landing, turn to the plinth
  for (let i = 0; i < STAGE_T.length; i++) {
    const T = STAGE_T[i];
    const w = io(seg(t, T - 0.1, T + 0.6)) * (1 - io(seg(t, T + 1.25, T + 2.1)));
    if (w > 0) look.lerp(plinthFace[i], w * 0.62);
  }
  // at the top, the gaze lifts to the light in the gate
  const top = io(seg(t, 96.2, 99.4));
  if (top > 0) look.y += top * 2.2;
  return 52 + io(seg(t, 98.4, 100)) * 8;
}

const _kp = new THREE.Vector3();
const _kl = new THREE.Vector3();
// the camera at time t, written into the given vectors; returns the fov
export function cameraAt(t, pos, look) {
  if (t <= WALK_FROM) return keysAt(t, pos, look);
  const fov = walkAt(t, pos, look);
  const b = io(seg(t, WALK_FROM, WALK_FROM + BLEND));
  if (b >= 1) return fov;
  const kf = keysAt(t, _kp, _kl);
  pos.lerpVectors(_kp, pos, b);
  look.lerpVectors(_kl, look, b);
  return kf + (fov - kf) * b;
}

// exposed for the debug overlay
export const CAMERA_KEYS = KEYS;
export { stairFrame };
