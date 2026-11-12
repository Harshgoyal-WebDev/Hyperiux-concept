import * as THREE from "three";

// The ascent: a monumental staircase of ivory stone that sweeps up out of the
// light at the end of the corridor in an S. It is built to human scale (one
// unit is about a metre): risers of ~17 cm, treads of ~42 cm, five flights
// broken by four landings, and on each landing stands one of the process
// plinths. Its centre line is a horizontal curve, sampled by arc length;
// `u` ∈ [0, 1] is the position along that curve.

const PLAN = [
  [0, -80],
  [-3, -90],
  [-8, -99.5],
  [-8.5, -109.5],
  [-2.5, -117.5],
  [6.5, -123],
  [13, -130.5],
  [12.5, -140.5],
  [5.5, -147.5],
  [-3, -152],
];
export const stairCurve = new THREE.CatmullRomCurve3(
  PLAN.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  "centripetal"
);
stairCurve.arcLengthDivisions = 600;
export const STAIR_LENGTH = stairCurve.getLength();

const RISER = 0.17;
const GOING = 0.42;
const LANDING = 6.4; // metres along the line
// landing centres (the process stages); kept in step with timeline STAGE_U
export const LANDING_U = [0.2, 0.42, 0.64, 0.86];
const LANDING_HALF = LANDING / 2 / STAIR_LENGTH;

// The flight plan: alternating flights and landings, each { u0, u1, y0, ... }.
// A flight of n steps: step j covers [u0 + j·du, u0 + (j+1)·du] with its tread
// at y0 + (j+1)·RISER; the landing after it is level with its last tread.
export const SEGMENTS = (() => {
  const segs = [];
  let u = 0;
  let y = 0;
  const bounds = [...LANDING_U.map((c) => [c - LANDING_HALF, c + LANDING_HALF]), [1, 1]];
  bounds.forEach(([l0, l1], k) => {
    const n = Math.max(1, Math.round(((l0 - u) * STAIR_LENGTH) / GOING));
    segs.push({ kind: "flight", u0: u, u1: l0, y0: y, n, du: (l0 - u) / n });
    y += n * RISER;
    if (k < LANDING_U.length) segs.push({ kind: "landing", u0: l0, u1: l1, y0: y, index: k });
    u = l1;
  });
  return segs;
})();

export const STAIR = {
  steps: SEGMENTS.reduce((s, g) => s + (g.kind === "flight" ? g.n : 0), 0),
  rise: SEGMENTS[SEGMENTS.length - 1].y0 + SEGMENTS[SEGMENTS.length - 1].n * RISER,
  riser: RISER,
  width: 7,
};
export const STEP_RISE = RISER;

function segmentAt(u) {
  for (const g of SEGMENTS) if (u < g.u1) return g;
  return SEGMENTS[SEGMENTS.length - 1];
}

// The height of the stone under the centre line at u (the actual tread).
export function treadY(u) {
  if (u < 0) return 0;
  if (u >= 1) return STAIR.rise;
  const g = segmentAt(u);
  if (g.kind === "landing") return g.y0;
  return g.y0 + Math.min(g.n, Math.floor((u - g.u0) / g.du) + 1) * RISER;
}

// A smooth line up the flight through the foot of every riser (half a riser
// below the middle of each tread), level on the landings: what the railing,
// the walls and the camera's gaze follow.
export function pitchY(u) {
  if (u <= 0) return 0;
  if (u >= 1) return STAIR.rise;
  const g = segmentAt(u);
  if (g.kind === "landing") return g.y0;
  return g.y0 + Math.min(g.n, (u - g.u0) / g.du) * RISER;
}

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// Where a climber's feet are at u: the tread height, but stepping up eased
// across each nosing (the body lifts as the foot reaches the next tread),
// plus the stride phase (0–1 within a step) for the sway.
export function walkY(u) {
  if (u < 0 || u >= 1) return { y: treadY(u), phase: 0 };
  for (const g of SEGMENTS) {
    if (g.kind !== "flight") continue;
    // the flight's influence starts half a step before its first riser
    if (u >= g.u0 - g.du * 0.5 && u < g.u1) {
      const s = (u - g.u0) / g.du;
      const f = s - 0.5;
      const lift = Math.floor(f) + smooth(0.25, 0.75, f - Math.floor(f)) + 1;
      return { y: g.y0 + Math.min(g.n, Math.max(0, lift)) * RISER, phase: s };
    }
  }
  return { y: treadY(u), phase: 0 };
}

// Position (centre line, at the pitch line), unit tangent and left normal at
// u. Past the ends it continues straight and level.
export function stairFrame(u, out = { p: new THREE.Vector3(), tan: new THREE.Vector3(), n: new THREE.Vector3() }) {
  const uc = Math.min(1, Math.max(0, u));
  stairCurve.getPointAt(uc, out.p);
  stairCurve.getTangentAt(uc, out.tan);
  out.tan.y = 0;
  out.tan.normalize();
  if (u !== uc) out.p.addScaledVector(out.tan, (u - uc) * STAIR_LENGTH);
  out.p.y = pitchY(u);
  out.n.set(-out.tan.z, 0, out.tan.x);
  return out;
}

// a point beside the stair: `side` along the normal, `up` above the pitch line
export function stairPoint(u, side = 0, up = 0) {
  const f = stairFrame(u);
  return f.p.addScaledVector(f.n, side).add(new THREE.Vector3(0, up, 0));
}

export const SUMMIT = (() => {
  const f = stairFrame(1);
  const landing = f.p.clone();
  const light = f.p.clone().addScaledVector(f.tan, 15).add(new THREE.Vector3(0, 6.5, 0));
  return { landing, light, tan: f.tan.clone(), n: f.n.clone() };
})();
