// The hand both of The Window's hands are made from: the scanned hand in
// public/human_hand.glb (a left hand, its rest pose already reaching, skinned
// to a 26-joint armature), brought into the frame the rig and the shaders
// work in — a right hand in centimetres, the wrist at the origin, the fingers
// along +y, the palm facing +z, the thumb on the +x side — and its armature
// folded onto the rig's 17 bones (hand/handRig.js):
//   0          the forearm
//   1 + f·3 + j  finger f (FINGERS), joint j (base, middle, end)
//   WRIST_BONE the hand itself, turning on the forearm at the wrist
//
// From its surface, the two materials' geometry, each point skinned to its
// two strongest bones:
//   particles  n points spread evenly over the whole surface (by area), with
//              their normals (the particle hand)
//   wire       the same surface simplified to a few thousand triangles: its
//              edges as line segments, and its vertices (the wireframe hand)
// Built once per page, off the main thread (hand/hand.worker.js).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptSimplifier } from "meshoptimizer";

import { BONE_COUNT, INDEX_DISTAL_BONE, WRIST_BONE } from "./bones";

// (its size: the wrist to the middle knuckle, as a real hand has it)
const PALM_LENGTH = 10.1;
// (the thumb's base joint has no line to measure its bend from: the model's
// own is taken as the relaxed hand's — hand/handRig.js RELAXED.thumb[0])
const THUMB_BASE_REST = 0.2;
// (the thumb flexes across the palm; the fingers straight into it)
const THUMB_FLEX = new THREE.Vector3(-0.55, 0, 0.83).normalize();
const PALM_N = new THREE.Vector3(0, 0, 1);
// (the wireframe's density)
const WIRE_TRIANGLES = 3400;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a bone's chain: it, then on down its first child bone to the end
function chainFrom(bone) {
  const out = [bone];
  for (let b = bone; ; ) {
    b = b.children.find((c) => c.isBone);
    if (!b) return out;
    out.push(b);
  }
}

// the signed bend from segment a to segment b, about axis k (+: towards the palm)
const cr = new THREE.Vector3();
function bendAbout(a, b, k) {
  cr.crossVectors(a, b);
  return Math.atan2(cr.dot(k), a.dot(b));
}

// ---- the anatomy ----------------------------------------------------------------
// The frame (the model's world → the rig's), and every bone's joint, the axis
// it flexes about and its bend at rest — the rig's angles are bends, so the
// pose it is given is measured from a straight finger, as before.
function anatomyOf(skeleton) {
  const bones = skeleton.bones;
  // (the forearm: the bone the five chains hang from)
  const forearm = bones.find((b) => b.children.filter((c) => c.isBone).length === 5);
  if (!forearm) throw new Error("hand model: no forearm bone with five chains");
  const chains = forearm.children.filter((c) => c.isBone).map(chainFrom);
  // the thumb has a joint fewer; the fingers in order away from it
  chains.sort((a, b) => a.length - b.length);
  const thumb = chains.shift();
  // (a joint, mirrored)
  const head = (b) => {
    const p = b.getWorldPosition(new THREE.Vector3());
    p.x = -p.x;
    return p;
  };
  const thumbBase = head(thumb[1]);
  chains.sort((a, b) => head(a[1]).distanceTo(thumbBase) - head(b[1]).distanceTo(thumbBase));
  const [index, middle, , little] = chains;

  // the frame (mirrored first: the model is a left hand)
  const wrist = head(chains[0][0]);
  const y = head(middle[1]).sub(wrist);
  const scale = PALM_LENGTH / y.length();
  y.normalize();
  const xa = head(index[1]).sub(head(little[1])).normalize();
  const z = new THREE.Vector3().crossVectors(xa, y).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const frame = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeBasis(x, y, z).transpose())
    .multiply(new THREE.Matrix4().makeTranslation(-wrist.x, -wrist.y, -wrist.z))
    .multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
  const at = (b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(frame);

  // every joint of the model → its rig bone (end joints carry nothing)
  const boneOf = new Map(bones.map((b) => [b, 0]));
  const rig = Array.from({ length: BONE_COUNT }, () => null);
  const rest = new Float32Array(BONE_COUNT);
  rig[0] = { parent: -1, pivot: [0, 0, 0], axis: [1, 0, 0] };
  rig[WRIST_BONE] = { parent: 0, pivot: [0, 0, 0], axis: [1, 0, 0], wrist: true };
  const ordered = [thumb, ...chains];
  let indexTipInfo = null;
  for (const [fi, chain] of ordered.entries()) {
    const isThumb = fi === 0;
    // (a finger's metacarpal moves with the hand; the thumb's is its first joint)
    const joints = isThumb ? chain.slice(0, 3) : chain.slice(1, 4);
    if (!isThumb) boneOf.set(chain[0], WRIST_BONE);
    const pts = chain.map(at);
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push(pts[i + 1].clone().sub(pts[i]));
    const axis = new THREE.Vector3().crossVectors(segs[0], isThumb ? THUMB_FLEX : PALM_N).normalize();
    for (let j = 0; j < 3; j++) {
      const bi = 1 + fi * 3 + j;
      rig[bi] = { parent: j === 0 ? WRIST_BONE : bi - 1, pivot: at(joints[j]).toArray(), axis: axis.toArray(), finger: fi, joint: j };
      boneOf.set(joints[j], bi);
      // (a finger's joints bend between its four segments, metacarpal first;
      // the thumb's last two between its three)
      rest[bi] = isThumb ? (j === 0 ? THUMB_BASE_REST : bendAbout(segs[j - 1], segs[j], axis)) : bendAbout(segs[j], segs[j + 1], axis);
    }
    for (const b of chain.slice(isThumb ? 3 : 4)) boneOf.set(b, 1 + fi * 3 + 2);
    if (chain === index) indexTipInfo = { base: pts[3], dir: segs[3].clone().normalize() };
  }
  boneOf.set(forearm, 0);
  return { frame, rig, rest, boneOf, indexTipInfo };
}

// ---- the surface ----------------------------------------------------------------
// Every vertex of the model in its rest pose, in the rig's frame, with its
// normal and its two strongest rig bones; welded where the model was split.
function surfaceOf(meshes, anat) {
  const { frame, boneOf } = anat;
  const total = meshes.reduce((s, m) => s + m.geometry.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const bones = new Float32Array(total * 2);
  const weights = new Float32Array(total * 2);
  const tris = [];
  const weld = new Map();
  const welded = new Uint32Array(total);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const accN = new THREE.Vector3();
  let base = 0;
  for (const mesh of meshes) {
    const g = mesh.geometry;
    const sk = mesh.skeleton;
    // (each joint's rest transform, then the frame: rest skinning in one step)
    const mats = sk.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[i]).premultiply(frame));
    const nmats = mats.map((m) => new THREE.Matrix3().getNormalMatrix(m));
    const rigBone = sk.bones.map((b) => boneOf.get(b) ?? 0);
    const P = g.attributes.position;
    const N = g.attributes.normal;
    const J = g.attributes.skinIndex;
    const W = g.attributes.skinWeight;
    const per = new Float32Array(BONE_COUNT);
    for (let i = 0; i < P.count; i++) {
      acc.set(0, 0, 0);
      accN.set(0, 0, 0);
      per.fill(0);
      for (let k = 0; k < 4; k++) {
        const w = W.getComponent(i, k);
        if (w <= 0) continue;
        const j = J.getComponent(i, k);
        acc.addScaledVector(v.fromBufferAttribute(P, i).applyMatrix4(mats[j]), w);
        if (N) accN.addScaledVector(n.fromBufferAttribute(N, i).applyMatrix3(nmats[j]), w);
        per[rigBone[j]] += w;
      }
      const o = base + i;
      acc.toArray(pos, o * 3);
      accN.normalize().toArray(nor, o * 3);
      topTwo(per, bones, weights, o);
      // (welded by position: the model's seams and its split into two)
      const key = `${Math.round(acc.x * 2000)},${Math.round(acc.y * 2000)},${Math.round(acc.z * 2000)}`;
      let w = weld.get(key);
      if (w === undefined) weld.set(key, (w = o));
      welded[o] = w;
    }
    const I = g.index;
    for (let i = 0; i < I.count; i++) tris.push(base + I.getX(i));
    base += P.count;
  }
  return { count: total, pos, nor, bones, weights, tris: Uint32Array.from(tris), welded };
}

// the two strongest of a vertex's rig bones, their weights summing to one
function topTwo(per, bones, weights, o) {
  let b0 = 0;
  let b1 = 0;
  let w0 = -1;
  let w1 = -1;
  for (let b = 0; b < per.length; b++) {
    const w = per[b];
    if (w > w0) {
      b1 = b0;
      w1 = w0;
      b0 = b;
      w0 = w;
    } else if (w > w1) {
      b1 = b;
      w1 = w;
    }
  }
  w1 = Math.max(w1, 0);
  const s = w0 + w1 || 1;
  bones[o * 2] = b0;
  bones[o * 2 + 1] = b1;
  weights[o * 2] = w0 / s;
  weights[o * 2 + 1] = w1 / s;
}

// ---- the particle hand ------------------------------------------------------------
// Points scattered over the triangles by their area: as many to a square
// centimetre everywhere. Each takes its skin from its triangle's corners.
function particlesOf(S, count, seed = 7) {
  const rng = mulberry32(seed);
  const { pos, nor, tris } = S;
  const tc = tris.length / 3;
  const cdf = new Float64Array(tc);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let sum = 0;
  for (let t = 0; t < tc; t++) {
    a.fromArray(pos, tris[t * 3] * 3);
    b.fromArray(pos, tris[t * 3 + 1] * 3).sub(a);
    c.fromArray(pos, tris[t * 3 + 2] * 3).sub(a);
    sum += b.cross(c).length() * 0.5;
    cdf[t] = sum;
  }
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const bones = new Float32Array(count * 2);
  const weights = new Float32Array(count * 2);
  const per = new Float32Array(BONE_COUNT);
  const n = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // (a triangle, by area)
    const r = rng() * sum;
    let lo = 0;
    let hi = tc - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    // (a point in it, evenly)
    let u = rng();
    let v = rng();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const bary = [1 - u - v, u, v];
    per.fill(0);
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      const vi = tris[lo * 3 + k];
      for (let d = 0; d < 3; d++) {
        position[i * 3 + d] += pos[vi * 3 + d] * bary[k];
      }
      n.x += nor[vi * 3] * bary[k];
      n.y += nor[vi * 3 + 1] * bary[k];
      n.z += nor[vi * 3 + 2] * bary[k];
      per[S.bones[vi * 2]] += S.weights[vi * 2] * bary[k];
      per[S.bones[vi * 2 + 1]] += S.weights[vi * 2 + 1] * bary[k];
    }
    n.normalize().toArray(normal, i * 3);
    topTwo(per, bones, weights, i);
  }
  return { count, position, normal, bones, weights };
}

// ---- the wireframe hand -----------------------------------------------------------
// The welded surface simplified (its vertices are the model's own, so each
// keeps its skin), its edges as line segments, and its vertices.
async function wireframeOf(S, targetTris = WIRE_TRIANGLES) {
  await MeshoptSimplifier.ready;
  const { pos, tris, welded } = S;
  const idx = new Uint32Array(tris.length);
  for (let i = 0; i < tris.length; i++) idx[i] = welded[tris[i]];
  // (Permissive: the model's mesh is closed but its patches meet at creases
  // the simplifier otherwise refuses to collapse across, stalling at ~15k
  // triangles; Regularize: even triangles, a cleaner wireframe)
  const [simple] = MeshoptSimplifier.simplify(idx, pos, 3, targetTris * 3, 1, ["Permissive", "Regularize"]);
  // (each edge once)
  const edges = new Set();
  const verts = new Map();
  for (let t = 0; t < simple.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = simple[t + k];
      const b = simple[t + ((k + 1) % 3)];
      if (a === b) continue;
      edges.add(a < b ? a * 2 ** 21 + b : b * 2 ** 21 + a);
      if (!verts.has(a)) verts.set(a, verts.size);
    }
  }
  const n = edges.size;
  const lines = { count: n, position: new Float32Array(n * 6), bones: new Float32Array(n * 4), weights: new Float32Array(n * 4) };
  let i = 0;
  for (const e of edges) {
    const ends = [Math.floor(e / 2 ** 21), e % 2 ** 21];
    for (let k = 0; k < 2; k++) {
      const v = ends[k];
      lines.position.set(pos.subarray(v * 3, v * 3 + 3), i * 6 + k * 3);
      lines.bones.set(S.bones.subarray(v * 2, v * 2 + 2), i * 4 + k * 2);
      lines.weights.set(S.weights.subarray(v * 2, v * 2 + 2), i * 4 + k * 2);
    }
    i++;
  }
  const vc = verts.size;
  const vertices = { count: vc, position: new Float32Array(vc * 3), bones: new Float32Array(vc * 2), weights: new Float32Array(vc * 2) };
  for (const [v, j] of verts) {
    vertices.position.set(pos.subarray(v * 3, v * 3 + 3), j * 3);
    vertices.bones.set(S.bones.subarray(v * 2, v * 2 + 2), j * 2);
    vertices.weights.set(S.weights.subarray(v * 2, v * 2 + 2), j * 2);
  }
  return { lines, vertices };
}

function extentOf(S) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < S.count; i++) {
    lo = Math.min(lo, S.pos[i * 3 + 1]);
    hi = Math.max(hi, S.pos[i * 3 + 1]);
  }
  return [lo, hi];
}

// ---- it all, from the file's bytes ----------------------------------------------------
export async function buildHand(buffer, { particles }) {
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  gltf.scene.updateMatrixWorld(true);
  const meshes = [];
  gltf.scene.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o);
  });
  if (!meshes.length) throw new Error("hand model: no skinned mesh");
  const anat = anatomyOf(meshes[0].skeleton);
  const S = surfaceOf(meshes, anat);

  // the index fingertip: the furthest the skin of its last joint reaches
  // along it, on its axis
  const { base, dir } = anat.indexTipInfo;
  let reach = 0;
  for (let i = 0; i < S.count; i++) {
    if (S.bones[i * 2] !== INDEX_DISTAL_BONE || S.weights[i * 2] < 0.6) continue;
    const d = (S.pos[i * 3] - base.x) * dir.x + (S.pos[i * 3 + 1] - base.y) * dir.y + (S.pos[i * 3 + 2] - base.z) * dir.z;
    reach = Math.max(reach, d);
  }
  const anatomy = {
    bones: anat.rig,
    rest: anat.rest,
    wristBone: WRIST_BONE,
    indexDistalBone: INDEX_DISTAL_BONE,
    indexTip: base.clone().addScaledVector(dir, reach).toArray(),
    indexDir: dir.toArray(),
    // (its whole length, the end of the arm to the highest fingertip, at rest)
    extent: extentOf(S),
  };
  return { anatomy, particles: particlesOf(S, particles), wire: await wireframeOf(S) };
}

// everything in it that can be handed from the worker without a copy
export function transferables(h) {
  const p = h.particles;
  const w = h.wire;
  return [p.position, p.normal, p.bones, p.weights, w.lines.position, w.lines.bones, w.lines.weights, w.vertices.position, w.vertices.bones, w.vertices.weights, h.anatomy.rest].map((a) => a.buffer);
}
