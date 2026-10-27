import * as THREE from "three";
import { ABOUT_TARGET, backTrail } from "./layout";

// Path A in two arc-length curves: the approach (hero → core, one
// continuous dolly) and the passage (core → through the cube's former
// position → trail join). timeline.js tweens `approach` over APPROACH and
// `passage` over PASSAGE; between them the camera holds still at the core
// while the cube charges and breaks.
export const APPROACH = [0, 0.245];
export const PASSAGE = [0.335, 0.5];

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Where path A hands over to trail-follow. Fixed (independent of the
// monolith asset) so the DOM timeline can compute the trail start too.
export const TRAIL_JOIN = v(-2, 13, -58);
let trailS0 = null;
export function getTrailS0() {
  if (trailS0 === null) trailS0 = closestTrailParam(TRAIL_JOIN);
  return trailS0;
}

// Path A, composed around the actual cube anchor and the monolith's
// measured front/back faces, so a delivered GLB of different depth still
// gets a clear passage on the bridge axis.
export function buildPathA(monolith, hero) {
  const c = monolith.cube.position;
  const cy = c.y;
  const fz = monolith.frontZ;
  const bz = monolith.backZ;
  const cubeReach = monolith.cube.size * 0.87; // half body-diagonal
  // Core stop: close enough that the cube dominates, far enough that the
  // logo cut-out still frames it.
  const coreZ = Math.max(fz + 4.5, c.z + cubeReach + 12);
  const core = v(0, cy, coreZ);

  // Approach: one smooth curve that lines up on the cube's axis well
  // before arriving (the last stretch is dead straight), so the camera
  // never swings sideways or re-aims at the end.
  const approach = {
    position: new THREE.CatmullRomCurve3([v(0, 7, 155), v(0, 0, 0), v(0, cy, fz + 34), core.clone()], false, "centripetal"),
    target: new THREE.LineCurve3(v(0, cy - 2, 0), c.clone()),
    cy,
    fz,
  };
  setApproachStart(approach, hero ?? v(0, 7, 155));

  // After the break the gaze tips down to the sand ahead, where the line
  // runs out of the monolith and on along the trail, so it stays in view
  // all the way down to the trail join.
  const passageKeys = [
    [core.clone(), c.clone()],
    [v(0, cy - 0.2, c.z + 1), v(0, cy * 0.45, bz - 22)],
    [v(0, cy - 3.2, bz - 9), v(-2, 4, bz - 48)],
    [TRAIL_JOIN.clone(), v(-9, 5, -110)],
  ];
  const passage = {
    position: new THREE.CatmullRomCurve3(passageKeys.map((k) => k[0]), false, "centripetal"),
    target: new THREE.CatmullRomCurve3(passageKeys.map((k) => k[1]), false, "centripetal"),
  };
  return { approach, passage, end: passageKeys[passageKeys.length - 1] };
}

// Re-seats the approach on a (tunable) hero camera position: the curve
// rises gently from there and is on the cube's axis by the halfway point.
export function setApproachStart(approach, hero) {
  const [p0, p1, p2] = approach.position.points;
  p0.set(hero.x, hero.y, hero.z);
  p1.set(hero.x * 0.35, THREE.MathUtils.lerp(hero.y, approach.cy, 0.62), THREE.MathUtils.lerp(hero.z, p2.z, 0.5));
  approach.position.updateArcLengths();
}

// Trail param closest to a world xz point.
export function closestTrailParam(point) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 400; i++) {
    const s = i / 400;
    const p = backTrail.getPointAt(s);
    const d = (p.x - point.x) ** 2 + (p.z - point.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// Ground height under the back trail, smoothed so the camera glides
// instead of following every dune: a running max (so it never dips into a
// crest beside the line) followed by two wide running averages.
const PROFILE_N = 800;
const profiles = new WeakMap();
function trailProfile(terrain) {
  let prof = profiles.get(terrain);
  if (prof) return prof;
  const length = backTrail.getLength();
  const step = length / PROFILE_N;
  const raw = new Float32Array(PROFILE_N + 1);
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i <= PROFILE_N; i++) {
    const s = i / PROFILE_N;
    backTrail.getPointAt(s, p);
    backTrail.getTangentAt(s, t);
    let h = -Infinity;
    for (const o of [-5, 0, 5]) h = Math.max(h, terrain.height(p.x - t.z * o, p.z + t.x * o));
    raw[i] = h;
  }
  const run = (src, metres, fn) => {
    const r = Math.max(1, Math.round(metres / step));
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) {
      let acc = fn === "max" ? -Infinity : 0;
      let n = 0;
      for (let k = Math.max(0, i - r); k <= Math.min(src.length - 1, i + r); k++) {
        acc = fn === "max" ? Math.max(acc, src[k]) : acc + src[k];
        n++;
      }
      out[i] = fn === "max" ? acc : acc / n;
    }
    return out;
  };
  prof = run(run(run(raw, 14, "max"), 30, "avg"), 30, "avg");
  profiles.set(terrain, prof);
  return prof;
}
function groundOnTrail(terrain, s) {
  const prof = trailProfile(terrain);
  const f = THREE.MathUtils.clamp(s, 0, 1) * PROFILE_N;
  const i = Math.min(Math.floor(f), PROFILE_N - 1);
  return THREE.MathUtils.lerp(prof[i], prof[i + 1], f - i);
}

// Path B: follow the back trail. Writes into outPos / outTarget.
const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _t = new THREE.Vector3();
export function poseOnTrail(s, height, lateral, terrain, outPos, outTarget) {
  const sc = THREE.MathUtils.clamp(s, 0, 1);
  backTrail.getPointAt(sc, _p);
  backTrail.getTangentAt(sc, _t);
  const gy = groundOnTrail(terrain, sc);
  outPos.set(_p.x - _t.z * lateral, gy + height, _p.z + _t.x * lateral);

  const ahead = Math.min(sc + 0.055, 1);
  backTrail.getPointAt(ahead, _a);
  const ay = groundOnTrail(terrain, ahead);
  outTarget.set(_a.x, ay + height * 0.55, _a.z);
  // Near the end of the trail, settle the gaze onto the monolith.
  const settle = THREE.MathUtils.smoothstep(sc, 0.8, 1);
  outTarget.lerp(ABOUT_TARGET, settle);
}

// The camera pose for a journey state J (no mouse parallax): path A,
// blended into trail-follow, then path C. Used by the camera rig and to
// lay the energy tunnel along exactly where the camera will fly.
const _pb = new THREE.Vector3();
const _tb = new THREE.Vector3();
export function cameraPose(J, pathA, pathC, terrain, outPos, outTarget) {
  const leg = J.passage > 0 ? pathA.passage : pathA.approach;
  const u = THREE.MathUtils.clamp(J.passage > 0 ? J.passage : J.approach, 0, 1);
  leg.position.getPointAt(u, outPos);
  leg.target.getPoint(u, outTarget);
  if (J.wB > 0) {
    poseOnTrail(J.camB, J.camH, J.camLat, terrain, _pb, _tb);
    outPos.lerp(_pb, J.wB);
    outTarget.lerp(_tb, J.wB);
  }
  if (J.camC > 0) {
    pathC.position.getPoint(J.camC, outPos);
    pathC.target.getPoint(J.camC, outTarget);
  }
}

// Path C: About composition → rising crane over the dissolving world.
export function buildPathC(terrain) {
  const pos = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  poseOnTrail(1, 9, 0, terrain, pos, tgt);
  const fwd = tgt.clone().sub(pos).setY(0).normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);

  const keys = [
    [pos.clone(), tgt.clone()],
    [pos.clone().addScaledVector(fwd, 6).add(v(0, -1, 0)), ABOUT_TARGET.clone()],
    [
      pos.clone().addScaledVector(fwd, -26).addScaledVector(right, -10).add(v(0, 44, 0)),
      pos.clone().addScaledVector(fwd, 60).setY(6),
    ],
    [
      pos.clone().addScaledVector(fwd, 10).addScaledVector(right, -4).add(v(0, 165, 0)),
      pos.clone().addScaledVector(fwd, 62).setY(0),
    ],
  ];
  return {
    position: new THREE.CatmullRomCurve3(keys.map((k) => k[0]), false, "centripetal"),
    target: new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, "centripetal"),
  };
}

// Dev check: walk path A and raycast between consecutive samples against
// the stone. Any hit means the camera would clip through solid geometry.
export function validatePathA(pathA, monolith) {
  const raycaster = new THREE.Raycaster();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const hits = [];
  const samples = 600;
  for (let i = 0; i < samples * 2; i++) {
    const curve = i < samples ? pathA.approach.position : pathA.passage.position;
    const k = i % samples;
    curve.getPoint(k / samples, a);
    curve.getPoint((k + 1) / samples, b);
    dir.subVectors(b, a);
    const len = dir.length();
    if (len < 1e-5) continue;
    raycaster.set(a, dir.normalize());
    raycaster.near = 0;
    raycaster.far = len + 0.35; // + near-plane / body margin
    const hit = raycaster.intersectObjects(monolith.meshes, false)[0];
    if (hit) hits.push({ leg: i < samples ? "approach" : "passage", u: k / samples, point: hit.point.clone() });
  }
  if (hits.length) {
    console.warn(`[sand-dune-concept] camera path intersects the monolith at ${hits.length} samples`, hits.slice(0, 5));
  }
  return hits;
}
