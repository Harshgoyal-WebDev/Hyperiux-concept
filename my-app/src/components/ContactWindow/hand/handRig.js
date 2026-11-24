import * as THREE from "three";
import { WRIST_BONE } from "./bones";

// The hand's skeleton (hand/handModel.js: the model's armature on 17 bones):
// each bone turns about its joint, flexing its finger towards the palm,
// carried by its parent. The 17 bone matrices go to the shaders (uBones),
// which skin the rest-pose points with them (scene/shaders/common.js SKIN).
// Its angles are each joint's bend from a straight finger; the model's own
// bend at rest (anatomy.rest) is taken off, so its rest pose is where they
// are measured from.

// Joint angles (rad), per finger: base, middle, end joint.
// (relaxed: the index reaching out, the others curving in naturally, each a
// little more than the one before)
const RELAXED = {
  thumb: [0.2, 0.28, 0.22],
  index: [0.34, 0.4, 0.22],
  middle: [0.6, 0.92, 0.52],
  ring: [0.74, 1.05, 0.56],
  little: [0.88, 1.15, 0.6],
};
const POINTING = [0.05, 0.07, 0.04];
const ORDER = ["thumb", "index", "middle", "ring", "little"];


// The angles for a pose: `extend` 0 → 1 straightens the index out to point;
// `curl` adds to (or eases) the other fingers' curl; `thumb` scales the
// thumb's (tucked under the hand, or out); `t` breathes them a little.
export function poseAngles(out, { extend = 0, curl = 0, t = 0, seed = 0, thumb = 1, wrist = 0 }) {
  out[0] = 0;
  // (the hand bent on the forearm at the wrist: + towards the palm)
  out[WRIST_BONE] = wrist;
  for (let f = 0; f < 5; f++) {
    const name = ORDER[f];
    const r = RELAXED[name];
    for (let j = 0; j < 3; j++) {
      let a = r[j];
      if (name === "index") a = THREE.MathUtils.lerp(r[j], POINTING[j], extend);
      else if (name === "thumb") a *= thumb;
      else a *= 1 + curl;
      // (alive: each finger moving on its own, ever so slightly)
      a += Math.sin(t * 0.7 + f * 1.3 + j * 0.6 + seed) * (name === "index" ? 0.012 : 0.035);
      out[1 + f * 3 + j] = a;
    }
  }
  return out;
}

export function createRig(anatomy) {
  const { bones: BONES, rest, wristBone, indexDistalBone } = anatomy;
  // (each bone after its parent: the forearm, the hand, then the fingers)
  const UPDATE_ORDER = [0, wristBone, ...BONES.map((_, i) => i).filter((i) => i !== 0 && i !== wristBone)];
  const matrices = BONES.map(() => new THREE.Matrix4());
  const angles = new Float32Array(BONES.length);
  const tmp = new THREE.Matrix4();
  const rot = new THREE.Matrix4();
  const axis = new THREE.Vector3();
  const tipRest = new THREE.Vector3(...anatomy.indexTip);
  const dirRest = new THREE.Vector3(...anatomy.indexDir);
  const tip = new THREE.Vector3();
  const dir = new THREE.Vector3();

  // the bone matrices for the current angles
  const palmN = new THREE.Vector3();
  function update() {
    for (const i of UPDATE_ORDER) {
      const b = BONES[i];
      const m = matrices[i];
      if (b.parent < 0) {
        m.identity();
        continue;
      }
      // T(pivot) · R(axis, angle) · T(−pivot), under its parent
      axis.set(...b.axis);
      rot.makeRotationAxis(axis, angles[i] - rest[i]);
      tmp.makeTranslation(b.pivot[0], b.pivot[1], b.pivot[2]).multiply(rot);
      rot.makeTranslation(-b.pivot[0], -b.pivot[1], -b.pivot[2]);
      tmp.multiply(rot);
      m.multiplyMatrices(matrices[b.parent], tmp);
    }
    const md = matrices[indexDistalBone];
    tip.copy(tipRest).applyMatrix4(md);
    dir.copy(dirRest).transformDirection(md);
    // (which way the palm faces, as the hand is bent at the wrist)
    palmN.set(0, 0, 1).transformDirection(matrices[wristBone]);
  }
  return { matrices, angles, update, tip, dir, palmN };
}

// Where a hand goes: its posed index fingertip exactly on `tipAt`, its index
// pointing along `dir`, its palm turned towards `palm` (all in the world).
// `mirror` makes it a left hand (the same anatomy, mirrored).
const e1 = new THREE.Vector3();
const e2 = new THREE.Vector3();
const e3 = new THREE.Vector3();
const f1 = new THREE.Vector3();
const f2 = new THREE.Vector3();
const f3 = new THREE.Vector3();
const local = new THREE.Matrix4();
const world = new THREE.Matrix4();
const mirrorM = new THREE.Matrix4().makeScale(-1, 1, 1);
const scaleM = new THREE.Matrix4();
const tipLocal = new THREE.Vector3();
export function placeHand(rig, { tipAt, dir, palm, mirror = false, scale = 1 }, out) {
  // (in the hand's own space, mirrored first if it is the left hand)
  e1.copy(rig.dir);
  e2.copy(rig.palmN);
  tipLocal.copy(rig.tip);
  if (mirror) {
    e1.x = -e1.x;
    e2.x = -e2.x;
    tipLocal.x = -tipLocal.x;
  }
  e1.normalize();
  e2.addScaledVector(e1, -e2.dot(e1)).normalize();
  e3.crossVectors(e1, e2);
  f1.copy(dir).normalize();
  f2.copy(palm).addScaledVector(f1, -palm.dot(f1)).normalize();
  f3.crossVectors(f1, f2);
  local.makeBasis(e1, e2, e3).transpose();
  world.makeBasis(f1, f2, f3).multiply(local);
  tipLocal.multiplyScalar(scale).applyMatrix4(world);
  out.copy(world);
  if (mirror) out.multiply(mirrorM);
  if (scale !== 1) out.multiply(scaleM.makeScale(scale, scale, scale));
  out.setPosition(tipAt.x - tipLocal.x, tipAt.y - tipLocal.y, tipAt.z - tipLocal.z);
  return out;
}
