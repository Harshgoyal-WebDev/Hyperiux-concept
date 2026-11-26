"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects and uniforms are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SUN_DIR } from "@/components/ForgingSandDuneConceptV3/config";
import { C, REBUILD_EVENT } from "../tuning";
import { createSandSim } from "./sandSim";

// The two hands, their index fingers reaching for each other — made of
// particles: the left one of threads of light running over its surface, in
// from the bottom left of the screen; the right one of golden sand, down from
// the top right towards the camera. One rigged hand (public/human_hand.glb,
// hand and forearm), posed — the index straight, the other fingers curled, the
// thumb in — its surface sampled once into points, and mirrored for the other
// side. Where they meet, and how big they are, is worked out from the camera
// every frame: each arm comes in from beyond its corner of the screen, whatever
// its shape. At the touch: a flash where they meet, then light running back
// over both hands from the fingertips (story: flash, glow). Every value: C.

const HAND_URL = "/human_hand.glb";
// (glTF node names, as three.js keeps them: no dots)
const n = (s) => s.replace(/[\s]/g, "_").replace(/[[\].:/]/g, "");
const WRIST = n("Bone_00");
// each finger: its knuckle bone, then its three joints, then its tip
const FINGERS = {
  pinky: ["Bone.001_01", "Bone.006_02", "Bone.007_03", "Bone.008_04", "Bone.008_end_020"],
  ring: ["Bone.002_05", "Bone.009_06", "Bone.010_07", "Bone.011_08", "Bone.011_end_021"],
  middle: ["Bone.003_09", "Bone.012_010", "Bone.013_011", "Bone.014_012", "Bone.014_end_022"],
  index: ["Bone.004_013", "Bone.015_014", "Bone.016_015", "Bone.017_016", "Bone.017_end_023"],
  thumb: ["Bone.005_017", "Bone.018_018", "Bone.019_019", "Bone.019_end_024"],
};
// The pose (as the first contact page had it — its hand rig, the same model):
// each joint's bend from a straight finger (rad; + towards the palm): relaxed,
// the index reaching out, the others curving in, each a little more than the
// one before — and the index, by `extend`, straightened out to point.
const RELAXED = {
  thumb: [0.2, 0.28, 0.22],
  index: [0.34, 0.4, 0.22],
  middle: [0.6, 0.92, 0.52],
  ring: [0.74, 1.05, 0.56],
  pinky: [0.88, 1.15, 0.6],
};
const POINTING = [0.05, 0.07, 0.04];
// (the thumb's base joint has no line to measure its bend from: the model's
// own is taken as relaxed)
const THUMB_BASE_REST = 0.2;

// the signed bend from segment a to segment b, about axis k
const _cr = new THREE.Vector3();
const bendAbout = (a, b, k) => Math.atan2(_cr.crossVectors(a, b).dot(k), a.dot(b));

// The hand's frame at rest, in the model's own space: the fingers' way (wrist
// → middle knuckle), the palm's side (the side its fingers curl to), towards
// the little finger.
function handFrame(root) {
  root.updateMatrixWorld(true);
  const at = (name) => root.getObjectByName(n(name)).getWorldPosition(new THREE.Vector3());
  const wrist = at(FINGERS.middle[0]);
  const y = at(FINGERS.middle[1]).sub(wrist).normalize();
  const xa = at(FINGERS.index[1]).sub(at(FINGERS.pinky[1]));
  let palm = new THREE.Vector3().crossVectors(xa, y).normalize();
  // (the palm is where the fingers curl to, at rest)
  let curl = 0;
  for (const f of ["middle", "ring", "pinky"]) {
    const b = FINGERS[f];
    curl += at(b[4]).sub(at(b[1])).dot(palm);
  }
  if (curl < 0) palm = palm.negate();
  const little = xa.clone().negate();
  little.addScaledVector(y, -little.dot(y)).normalize();
  return { wrist, y, palm, little };
}

// Pose the model's skeleton: every joint turned about its own axis (fixed in
// the hand at rest: across its finger's first segment and the palm's side)
// by the pose's bend less its bend at rest — the same rig, on the model's own
// bones; and the hand bent at the wrist (+ towards the palm).
function poseHand(root, { extend = 1, wrist = 0 } = {}) {
  const F = handFrame(root);
  const bone = (name) => root.getObjectByName(n(name));
  const at = (name) => bone(name).getWorldPosition(new THREE.Vector3());
  // (all of it measured at rest first: turning one joint moves the next)
  const jobs = [];
  for (const [finger, names] of Object.entries(FINGERS)) {
    const thumb = finger === "thumb";
    const pts = names.map(at);
    const segs = [];
    for (let k = 0; k < pts.length - 1; k++) segs.push(pts[k + 1].clone().sub(pts[k]).normalize());
    const flex = thumb ? F.palm.clone().multiplyScalar(0.83).addScaledVector(F.little, 0.55).normalize() : F.palm;
    const axis = new THREE.Vector3().crossVectors(segs[0], flex).normalize();
    const joints = thumb ? names.slice(0, 3) : names.slice(1, 4);
    joints.forEach((name, j) => {
      const rest = thumb ? (j === 0 ? THUMB_BASE_REST : bendAbout(segs[j - 1], segs[j], axis)) : bendAbout(segs[j], segs[j + 1], axis);
      let target = RELAXED[finger][j];
      if (finger === "index") target = THREE.MathUtils.lerp(target, POINTING[j], extend);
      jobs.push({ name, axis, delta: target - rest });
    });
  }
  // the wrist: the hand (its metacarpals, and the thumb's base) on the forearm
  const wristAxis = new THREE.Vector3().crossVectors(F.y, F.palm).normalize();
  const wristBones = ["pinky", "ring", "middle", "index", "thumb"].map((f) => FINGERS[f][0]);
  const turn = (name, axisWorld, angle) => {
    const b = bone(name);
    const parentQ = b.parent.getWorldQuaternion(new THREE.Quaternion());
    const local = axisWorld.clone().applyQuaternion(parentQ.invert());
    b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(local, angle));
    b.updateMatrixWorld(true);
  };
  // (the joints first, from the knuckles out — each turn carried by the joints
  // after it, the axes the hand's at rest, carried with it as the rig has
  // them — then the whole hand on the wrist, round them all)
  for (const { name, axis, delta } of jobs) {
    const b = bone(name);
    // (its axis as the hand now holds it: the rest axis carried by its parent's turn so far)
    const parentNow = b.parent.getWorldQuaternion(new THREE.Quaternion());
    const parentRest = b.parent.userData.restQ ?? parentNow;
    const carried = axis.clone().applyQuaternion(parentRest.clone().invert()).applyQuaternion(parentNow);
    turn(name, carried, delta);
  }
  if (wrist) for (const name of wristBones) turn(name, wristAxis, wrist);
  return F;
}

// the posed hand in its own space: its wrist, its index fingertip, the way
// the index points (its last segment), the back of the hand, its length
function measureHand(root) {
  root.updateMatrixWorld(true);
  const at = (name) => root.getObjectByName(n(name)).getWorldPosition(new THREE.Vector3());
  const wrist = root.getObjectByName(WRIST).getWorldPosition(new THREE.Vector3());
  const tip = at(FINGERS.index[4]);
  const point = tip.clone().sub(at(FINGERS.index[3])).normalize();
  // (the palm as the hand now holds it: across the knuckles and down the hand)
  const y = at(FINGERS.middle[1]).sub(at(FINGERS.middle[0])).normalize();
  const xa = at(FINGERS.index[1]).sub(at(FINGERS.pinky[1]));
  let palm = new THREE.Vector3().crossVectors(xa, y).normalize();
  let curl = 0;
  for (const f of ["middle", "ring", "pinky"]) curl += at(FINGERS[f][4]).sub(at(FINGERS[f][1])).dot(palm);
  if (curl < 0) palm = palm.negate();
  const back = palm.clone().negate();
  back.addScaledVector(point, -back.dot(point)).normalize();
  const across = new THREE.Vector3().crossVectors(back, point).normalize();
  // (the forearm's line: from the arm's end to the wrist)
  const handWrist = at(FINGERS.middle[0]);
  const arm = handWrist.clone().sub(wrist).normalize();
  return { wrist, tip, point, across, back, length: tip.clone().sub(wrist).dot(point), handWrist, arm };
}

// The posed surface, sampled: `count` points over it (by area), each with its
// normal, how far along the hand it is (0 at the arm's end … 1 at the
// fingertip), and the way along the surface towards the fingertip.
const _arm = new THREE.Vector3();
function sampleHand(root, m, count, seed, weighted = true) {
  const stretch = Math.max(C.armLength, 1);
  root.updateMatrixWorld(true);
  const tris = [];
  root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry) return;
    o.skeleton.update();
    const g = o.geometry;
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const P = new Float32Array(pos.count * 3);
    const N = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    const w = new THREE.Vector3();
    const nv = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      w.copy(v).addScaledVector(nv.fromBufferAttribute(nor, i), 0.01);
      o.applyBoneTransform(i, v);
      o.applyBoneTransform(i, w);
      v.applyMatrix4(o.matrixWorld);
      w.applyMatrix4(o.matrixWorld);
      // (the forearm drawn out longer, back from the wrist — so it runs on off
      // the screen's edge, never ending in view: C.armLength ×)
      const back = _arm.subVectors(m.handWrist, v).dot(m.arm);
      if (back > 0 && stretch !== 1) {
        v.addScaledVector(m.arm, -back * (stretch - 1));
        w.addScaledVector(m.arm, -back * (stretch - 1));
      }
      P[i * 3] = v.x;
      P[i * 3 + 1] = v.y;
      P[i * 3 + 2] = v.z;
      w.sub(v).normalize();
      N[i * 3] = w.x;
      N[i * 3 + 1] = w.y;
      N[i * 3 + 2] = w.z;
    }
    const idx = g.index ? g.index.array : null;
    const nt = idx ? idx.length / 3 : pos.count / 3;
    for (let t = 0; t < nt; t++) tris.push([P, N, idx ? idx[t * 3] : t * 3, idx ? idx[t * 3 + 1] : t * 3 + 1, idx ? idx[t * 3 + 2] : t * 3 + 2]);
  });
  // (by area)
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cum = new Float64Array(tris.length);
  let total = 0;
  tris.forEach(([P, , i0, i1, i2], k) => {
    a.fromArray(P, i0 * 3);
    b.fromArray(P, i1 * 3).sub(a);
    c.fromArray(P, i2 * 3).sub(a);
    total += b.cross(c).length() * 0.5;
    cum[k] = total;
  });
  let s = seed;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const dir = new Float32Array(count * 3);
  const info = new Float32Array(count * 4);
  const p = new THREE.Vector3();
  const nn = new THREE.Vector3();
  const d = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  // (denser over the hand and fingers than down the forearm — the part that
  // is seen, and that reaches: a sample on the forearm is mostly passed over)
  let i = 0;
  for (let tries = 0; i < count && tries < count * 8; tries++) {
    const r = rnd() * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const [P, N, i0, i1, i2] = tris[lo];
    let u = rnd();
    let w = rnd();
    if (u + w > 1) {
      u = 1 - u;
      w = 1 - w;
    }
    const w0 = 1 - u - w;
    p.set(0, 0, 0)
      .addScaledVector(a.fromArray(P, i0 * 3), w0)
      .addScaledVector(b.fromArray(P, i1 * 3), u)
      .addScaledVector(c.fromArray(P, i2 * 3), w);
    nn.set(0, 0, 0)
      .addScaledVector(a.fromArray(N, i0 * 3), w0)
      .addScaledVector(b.fromArray(N, i1 * 3), u)
      .addScaledVector(c.fromArray(N, i2 * 3), w)
      .normalize();
    const along = THREE.MathUtils.clamp(tmp.copy(p).sub(m.wrist).dot(m.point) / m.length, 0, 1);
    const keep = weighted ? 0.55 + 0.45 * THREE.MathUtils.smoothstep(along, 0.3, 0.72) : 1;
    if (rnd() > keep) continue;
    // (towards the fingertip, along the surface)
    d.copy(m.point).addScaledVector(nn, -m.point.dot(nn)).normalize();
    p.toArray(pos, i * 3);
    nn.toArray(nor, i * 3);
    d.toArray(dir, i * 3);
    info[i * 4] = rnd();
    info[i * 4 + 1] = along;
    info[i * 4 + 2] = rnd();
    info[i * 4 + 3] = rnd();
    i++;
  }
  return { pos, nor, dir, info, count: i };
}

// The hand's lines: each bone of its posed skeleton as a segment (from its
// joint to the next), pointing out towards the fingertips — and the forearm,
// from the arm's end to the knuckles.
function measureBones(root, m) {
  root.updateMatrixWorld(true);
  const at = (name) => root.getObjectByName(n(name)).getWorldPosition(new THREE.Vector3());
  const segs = [];
  for (const bones of Object.values(FINGERS)) {
    for (let i = 0; i < bones.length - 1; i++) segs.push([at(bones[i]), at(bones[i + 1])]);
  }
  const knuckles = new THREE.Vector3();
  for (const bones of Object.values(FINGERS)) knuckles.add(at(bones[1]));
  knuckles.multiplyScalar(1 / Object.keys(FINGERS).length);
  segs.push([m.wrist.clone(), knuckles]);
  return segs.map(([a, b]) => ({ a, b, d: b.clone().sub(a).normalize(), l2: a.distanceToSquared(b) }));
}
// the way the hand's lines run at a point: its nearest bone's
const _ap = new THREE.Vector3();
function lineAt(segs, p, out) {
  let best = Infinity;
  for (const s of segs) {
    _ap.subVectors(p, s.a);
    const t = THREE.MathUtils.clamp(_ap.dot(s.d) / Math.sqrt(s.l2), 0, 1);
    const d2 = _ap.addScaledVector(s.d, -t * Math.sqrt(s.l2)).lengthSq();
    if (d2 < best) {
      best = d2;
      out.copy(s.d);
    }
  }
  return out;
}

// The threads of light: long lines grown over the surface, each following the
// hand's lines — up the arm, over the back of the hand, along each finger,
// round its curl — kept on the surface step by step (on the plane of the
// surface sampled around it). As segments: each one's two ends, the surface's
// normal there, how far along its thread it is, and how far along the hand.
function buildThreads(root, m, opts) {
  const cloud = sampleHand(root, m, 90000, opts.seed + 7, false);
  const segs = measureBones(root, m);
  const step = opts.step * m.length;
  // (the sampled surface, in a grid of cells a step and a half across)
  const cell = step * 1.5;
  const grid = new Map();
  const key = (x, y, z) => `${x}|${y}|${z}`;
  for (let i = 0; i < cloud.count; i++) {
    const k = key(Math.floor(cloud.pos[i * 3] / cell), Math.floor(cloud.pos[i * 3 + 1] / cell), Math.floor(cloud.pos[i * 3 + 2] / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const c = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const q = new THREE.Vector3();
  // the surface round a point: the mean of the samples within a step and a
  // half, and their mean normal (false: off the surface)
  const surface = (p) => {
    c.set(0, 0, 0);
    nrm.set(0, 0, 0);
    let k = 0;
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    const cz = Math.floor(p.z / cell);
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let z = cz - 1; z <= cz + 1; z++) {
          const list = grid.get(key(x, y, z));
          if (!list) continue;
          for (const i of list) {
            q.fromArray(cloud.pos, i * 3);
            if (q.distanceToSquared(p) > cell * cell) continue;
            c.add(q);
            nrm.x += cloud.nor[i * 3];
            nrm.y += cloud.nor[i * 3 + 1];
            nrm.z += cloud.nor[i * 3 + 2];
            k++;
          }
        }
    if (k < 3) return false;
    c.multiplyScalar(1 / k);
    nrm.normalize();
    return true;
  };
  let s = opts.seed * 7919;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const A = [];
  const TH = [];
  const PK = [];
  const B = [];
  const N = [];
  const I = [];
  const p = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const wander = new THREE.Vector3();
  const line = new THREE.Vector3();
  let made = 0;
  for (let tries = 0; made < opts.count && tries < opts.count * 12; tries++) {
    // (threads start over the whole surface — weighted to the hand, as seen)
    const i0 = Math.floor(rnd() * cloud.count);
    p.fromArray(cloud.pos, i0 * 3);
    const along0 = (p.x - m.wrist.x) * m.point.x + (p.y - m.wrist.y) * m.point.y + (p.z - m.wrist.z) * m.point.z;
    if (rnd() > 0.5 + 0.5 * THREE.MathUtils.smoothstep(along0 / m.length, 0.25, 0.7)) continue;
    // (the fingertips covered: threads that start near the end of a finger
    // run back from it, over its tip, rather than off it)
    const tipward = along0 / m.length > 0.82;
    const pts = [];
    const nms = [];
    if (!surface(p)) continue;
    p.copy(c);
    wander.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    // (back towards the arm a little first, so the thread runs both ways)
    const back = Math.floor(opts.length * (tipward ? 0.85 : 0.2 + 0.4 * rnd()));
    let sign = -1;
    const start = p.clone();
    for (let k = 0; k < opts.length + back + 1; k++) {
      if (k === back + 1) {
        // (then out from the start towards the fingertips — the start itself
        // is already the line's last point: not twice, no zero-length step)
        pts.reverse();
        nms.reverse();
        pts.pop();
        nms.pop();
        p.copy(start);
        sign = 1;
      }
      if (!surface(p)) break;
      p.addScaledVector(nrm, -nrm.dot(q.subVectors(p, c)));
      // (a thread that has stopped getting anywhere — stepping back and forth
      // on the spot, stacking its light into a bright bar — ends there)
      if (pts.length >= 4 && p.distanceToSquared(pts[pts.length - 4]) < step * step * 2.25) break;
      pts.push(p.clone());
      nms.push(nrm.clone());
      lineAt(segs, p, line);
      dir.copy(line).multiplyScalar(sign).lerp(wander.clone().multiplyScalar(0.6), 1 - opts.follow);
      dir.addScaledVector(nrm, -dir.dot(nrm)).normalize();
      if (!Number.isFinite(dir.x)) break;
      p.addScaledVector(dir, step);
      // (on over the fingertips' ends too — the surface itself ends them)
    }
    // (a thread that stopped short — off the surface's edge — is left out: a
    // run of light would light it up whole, a bright dash)
    if (pts.length < Math.max(6, opts.length * 0.3)) continue;
    const thread = made++;
    const seed = rnd();
    const total = (pts.length - 1) / opts.length;
    // (a few of its points, to find it under the pointer by: every few steps)
    for (let k = 0; k < pts.length; k += 5) {
      PK.push(pts[k].x, pts[k].y, pts[k].z, nms[k].x, nms[k].y, nms[k].z, k / opts.length, thread);
    }
    for (let k = 0; k < pts.length - 1; k++) {
      // (and no step too short to have a direction)
      if (pts[k].distanceToSquared(pts[k + 1]) < step * step * 0.09) continue;
      A.push(pts[k].x, pts[k].y, pts[k].z);
      B.push(pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
      const nn = nms[k].clone().add(nms[k + 1]).normalize();
      N.push(nn.x, nn.y, nn.z);
      const al = THREE.MathUtils.clamp(pts[k].clone().sub(m.wrist).dot(m.point) / m.length, 0, 1);
      I.push(seed, k / opts.length, al, total);
      TH.push(thread);
    }
  }
  return { a: new Float32Array(A), b: new Float32Array(B), n: new Float32Array(N), info: new Float32Array(I), thread: new Float32Array(TH), picks: new Float32Array(PK), threads: made, count: A.length / 3 };
}

// The hand itself, unseen: drawn only into the depth, a little inside its own
// surface, before its particles — so the hand's near surface hides whatever of
// it lies behind (the far side, the fingers curled into the palm): only the
// particles on the surface we see are drawn.
// (its forearm drawn out just as its particles' are — C.armLength — or it
// would hide them: the forearm widens towards the elbow)
function occluderMaterial(U, arm) {
  const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uInset = U.uInset;
    shader.uniforms.uStretch = U.uStretch;
    shader.uniforms.uHandWrist = { value: arm.wrist };
    shader.uniforms.uArm = { value: arm.dir };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uInset;\nuniform float uStretch;\nuniform vec3 uHandWrist;\nuniform vec3 uArm;")
      .replace(
        "#include <skinning_vertex>",
        `#include <skinning_vertex>
transformed -= normalize(objectNormal) * uInset;
{
  float back = dot(uHandWrist - transformed, uArm);
  if (back > 0.0) transformed -= uArm * back * (uStretch - 1.0);
}`
      );
  };
  return m;
}

// near and far: the near side of a hand clear, its far side faint, its
// edges (where the surface turns away) lit — so the hand reads as a form
const DEPTH_GLSL = /* glsl */ `
uniform float uBackFade;
uniform float uOutline;
// (x: how much it shows; y: how much it is an edge)
vec2 nearFar(vec3 nrm, vec3 viewPos) {
  vec3 nV = normalize(normalMatrix * nrm);
  float facing = dot(nV, normalize(-viewPos));
  float shows = mix(uBackFade, 1.0, smoothstep(-0.15, 0.25, facing));
  float edge = pow(1.0 - abs(facing), 3.0);
  return vec2(shows, edge);
}`;

// the touch's light on a particle (both hands): a band running back from the
// fingertips, the hand lit softly behind it, the fingertips hot as they meet
const GLOW_GLSL = /* glsl */ `
uniform vec3 uContact;
uniform float uWave;
uniform float uBandW;
uniform float uLit;
uniform float uFlash;
uniform vec3 uGlowColor;
uniform float uGlowBright;
vec3 touchLight(vec3 world) {
  float d = distance(world, uContact);
  float band = exp(-pow((d - uWave) / uBandW, 2.0)) * step(0.001, uWave);
  float behind = 1.0 - smoothstep(uWave - uBandW, uWave + uBandW * 0.5, d);
  float tip = exp(-d / max(uBandW * 0.6, 0.01));
  return uGlowColor * (band * 2.6 + behind * uLit * 0.35 + tip * uFlash * 4.0) * uGlowBright;
}`;

// ---- the left hand: threads of light — long lines over its surface, each
// carrying runs of light along it, warm, hotter towards the fingertip
const STREAK_V = /* glsl */ `
attribute vec3 aA;
attribute vec3 aB;
attribute vec3 aN;
attribute vec4 aInfo; // thread seed, along the thread (steps / threadLength), along the hand, the thread's length (same units)
attribute float aThread;
uniform sampler2D uSpark; // per thread: where on it the pointer lit it, when, how strongly
uniform float uThreads;
uniform float uSparkSpeed;
uniform float uSparkWidth;
uniform float uSparkLife;
varying float vSpark;
uniform float uTime;
uniform float uSpeed;
uniform float uPulse;
uniform float uWidthPx;
uniform vec2 uRes;
varying float vAlong;
varying float vRun;
varying float vEdgeX;
varying vec2 vDepth;
varying vec3 vLight;
${GLOW_GLSL}
${DEPTH_GLSL}
void main() {
  vec4 ma = modelViewMatrix * vec4(aA, 1.0);
  vec4 mb = modelViewMatrix * vec4(aB, 1.0);
  vec4 pa = projectionMatrix * ma;
  vec4 pb = projectionMatrix * mb;
  float aspect = uRes.x / uRes.y;
  vec2 dd = (pb.xy / pb.w - pa.xy / pa.w) * vec2(aspect, 1.0);
  vec2 dn = length(dd) > 1e-6 ? normalize(dd) : vec2(1.0, 0.0);
  vec2 side = vec2(-dn.y, dn.x) / vec2(aspect, 1.0);
  float e = position.x + 0.5;
  vec4 p = mix(pa, pb, e);
  p.xy += side * position.y * uWidthPx * 2.0 / uRes.y * p.w;
  gl_Position = p;
  vAlong = aInfo.z;
  vEdgeX = position.y * 2.0;
  // the runs of light along the thread (measured in its steps: as long on a
  // short thread as on a long one)
  float head = (fract(uTime * uSpeed * (0.6 + 0.8 * aInfo.x) + aInfo.x * 13.0) * 1.3 - 0.15) * aInfo.w;
  float d = aInfo.y - head;
  vRun = exp(-pow(d / max(uPulse, 0.001), 2.0));
  vDepth = nearFar(aN, mix(ma.xyz, mb.xyz, e));
  vLight = touchLight((modelMatrix * vec4(mix(aA, aB, e), 1.0)).xyz);
  // the pointer's light on this thread: lit where it passed, then running on
  // along the thread both ways — strand by strand, never across the hand
  vec4 sp = texture2D(uSpark, vec2((aThread + 0.5) / uThreads, 0.5));
  float age = uTime - sp.y;
  vSpark = 0.0;
  if (sp.z > 0.0 && age >= 0.0 && age < uSparkLife) {
    float dist = abs(aInfo.y - sp.x);
    float reach = age * uSparkSpeed;
    float front = exp(-pow((dist - reach) / uSparkWidth, 2.0));
    float trail = (1.0 - smoothstep(reach - uSparkWidth, reach + uSparkWidth * 0.5, dist)) * 0.35;
    vSpark = (front + trail) * sp.z * (1.0 - smoothstep(uSparkLife * 0.35, uSparkLife, age));
  }
}`;
const STREAK_F = /* glsl */ `
uniform float uAppear;
uniform float uOutline;
uniform float uPulseBright;
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uBright;
varying float vAlong;
varying float vRun;
varying float vEdgeX;
varying vec2 vDepth;
varying vec3 vLight;
varying float vSpark;
uniform float uSparkBright;
void main() {
  float core = 1.0 - smoothstep(0.0, 1.0, abs(vEdgeX));
  // (an even light along the threads, the runs only a gentle swell — no hot
  // dashes; and thinned where the surface turns away from us, where many
  // threads pile up on the screen into bright blobs — a faint outline instead)
  float grazing = 1.0 - 0.7 * vDepth.y;
  vec3 col = mix(uColor, uHot, smoothstep(0.55, 1.0, vAlong)) * uBright * (0.55 + uPulseBright * vRun) * (0.4 + 0.6 * vAlong) * grazing;
  col += uColor * vDepth.y * uOutline * 0.25;
  col += mix(uHot, vec3(1.0, 0.86, 0.66), 0.5) * vSpark * uSparkBright;
  col = (col + vLight) * vDepth.x * core * uAppear;
  gl_FragColor = vec4(col, 1.0);
}`;

// ---- the right hand: golden sand — grains on the surface, lit by the low
// sun, shimmering, some catching the light; a share streaming off it, falling
const TRAIL = 24;
const pp = new THREE.Vector3();
const pn = new THREE.Vector3();
const pq = new THREE.Vector3();
const simInv = new THREE.Matrix4();
const rayA = new THREE.Vector3();
const rayP = new THREE.Vector3();
const rayV = new THREE.Vector3();
const SAND_V = /* glsl */ `
#define TRAIL ${TRAIL}
attribute vec3 aNrm;
attribute vec4 aInfo; // seed, along the hand, tint, drift
uniform float uTime;
uniform float uSize;
uniform float uRefDepth;
uniform float uPixelRatio;
uniform float uDrift;
uniform float uJitter;
uniform float uFall;
uniform vec3 uSun;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uBright;
uniform float uSparkle;
uniform float uNight;
// the pointer's trail (screen, ndc): where it was, how it was moving, how long ago
uniform vec4 uTrail[TRAIL];
uniform float uTrailAge[TRAIL];
uniform float uAspect;
uniform float uStirRadius;
uniform float uStirAmount;
uniform float uStirSwirl;
uniform float uStirMax;
uniform vec2 uCursor;
uniform sampler2D tSimOff;
uniform sampler2D tSimVel;
uniform float uHasSim;
uniform float uStirGlow;
attribute vec2 aRef;
varying vec3 vCol;
varying float vA;
${GLOW_GLSL}
${DEPTH_GLSL}
float h1(float x) { return fract(sin(x * 91.345) * 47453.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float seed = aInfo.x;
  vec3 p = position + aNrm * sin(uTime * 2.3 + seed * 40.0) * uJitter;
  // (where the simulation has it: off its place by the pointer's stir, and
  // how stirred it is — sandSim.js)
  vec4 simOff = texture2D(tSimOff, aRef);
  float stir = clamp(texture2D(tSimVel, aRef).w, 0.0, 1.0) * uHasSim;
  p += simOff.xyz * uHasSim;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vA = 1.0;
  // (the drifting share: off the surface, falling and blowing away, over and over)
  if (aInfo.w < uDrift) {
    float life = fract(uTime * (0.12 + 0.1 * h1(seed * 3.1)) + seed * 9.7);
    world.xyz += vec3(0.6, -1.0, 0.15) * life * life * uFall + normalize(mat3(modelMatrix) * aNrm) * life * uFall * 0.15;
    vA = 1.0 - smoothstep(0.55, 1.0, life);
  }
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (uRefDepth / max(-mv.z, 0.1)) * (0.6 + 0.8 * h1(seed * 7.7));
  vec3 nW = normalize(mat3(modelMatrix) * aNrm);
  // (by day the low sun on it; by night the moon, fainter — and a little light
  // of its own, so the hand still reads in the dark)
  float lit = max(dot(nW, uSun), 0.0);
  float lam = mix(0.42 + 0.75 * lit, 0.22 + 0.4 * lit, uNight) + 0.18 * uNight;
  float sparkle = pow(h1(seed * 13.0 + floor(uTime * 6.0 + seed * 5.0)), 30.0) * uSparkle * 4.0;
  // (the near side clear, the far side faint, the edges lit pale)
  vec2 nf = nearFar(aNrm, mv.xyz);
  vCol = (mix(uColor2, uColor, aInfo.z) * (lam + sparkle + stir * uStirGlow) * uBright + vec3(1.0, 0.93, 0.78) * nf.y * uOutline) + touchLight(world.xyz);
  // (the far side faint — a volume of sand, not a shell — and any grain the
  // pointer has stirred, near side or far, fully there as it streams)
  vA *= mix(nf.x, 1.0, min(stir * 1.5, 1.0));
}`;
const SAND_F = /* glsl */ `
uniform float uAppear;
varying vec3 vCol;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vCol, (1.0 - smoothstep(0.65, 1.0, r)) * vA * uAppear);
}`;

// the flash where the fingertips meet (a soft point of light, always facing us)
const SPARK_V = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * length(modelMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_F = /* glsl */ `
uniform float uFlash;
uniform vec3 uGlowColor;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float core = exp(-r * r * 30.0);
  float halo = exp(-r * r * 5.0) * 0.35;
  vec3 col = mix(uGlowColor, vec3(1.0, 0.92, 0.8), core) * (core * 6.0 + halo * 2.0) * uFlash;
  gl_FragColor = vec4(col, 1.0);
}`;

// a point on the screen (ndc x, y) at a depth in front of the camera
function screenPoint(cam, x, y, depth, out) {
  const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  return out.set(x * t * cam.aspect * depth, y * t * depth, -depth).applyMatrix4(cam.matrixWorld);
}

// the two sides, and which way the back of each hand faces (the camera's
// right, up, towards us) before its roll (C)
// (as the first contact page had them: the left hand the model as made — a
// left hand — the right one mirrored; their palms down and away from us)
// — and the way each index points (the camera's right, up, towards us): the
// left one across the screen, a little up and away; the right one back, a
// little down and towards us — nearly along one line, as in the Creation of Adam
const SIDES = [
  { key: "left", mirror: false, dorsal: [0.0, 0.76, 0.65], aim: [0.957, 0.239, -0.139], seed: 11 },
  { key: "right", mirror: true, dorsal: [0.08, 0.84, 0.54], aim: [-0.897, -0.381, 0.225], seed: 23 },
];

function streakObject(t, U) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index;
  g.setAttribute("position", quad.attributes.position);
  g.setAttribute("aA", new THREE.InstancedBufferAttribute(t.a, 3));
  g.setAttribute("aB", new THREE.InstancedBufferAttribute(t.b, 3));
  g.setAttribute("aN", new THREE.InstancedBufferAttribute(t.n, 3));
  g.setAttribute("aInfo", new THREE.InstancedBufferAttribute(t.info, 4));
  g.setAttribute("aThread", new THREE.InstancedBufferAttribute(t.thread, 1));
  g.instanceCount = t.count;
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: STREAK_V, fragmentShader: STREAK_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return mesh;
}

function sandObject(sample, U, sim) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("aRef", new THREE.BufferAttribute(sim ? sim.ref : new Float32Array(sample.pos.length / 3 * 2), 2));
  g.setAttribute("position", new THREE.BufferAttribute(sample.pos, 3));
  g.setAttribute("aNrm", new THREE.BufferAttribute(sample.nor, 3));
  g.setAttribute("aInfo", new THREE.BufferAttribute(sample.info, 4));
  g.setDrawRange(0, sample.count);
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SAND_V, fragmentShader: SAND_F, transparent: true, depthWrite: false });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  return pts;
}

export default function Hands({ story, anchor, night, pointer }) {
  const gltf = useGLTF(HAND_URL);
  const { camera, size, gl } = useThree();
  // (re-made when a count is changed in the panel)
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((x) => x + 1);
    window.addEventListener(REBUILD_EVENT, bump);
    return () => window.removeEventListener(REBUILD_EVENT, bump);
  }, []);

  // the uniforms: the touch's light (shared), and each hand's own
  const glow = useMemo(
    () => ({
      uContact: { value: new THREE.Vector3() },
      uWave: { value: 0 },
      uBandW: { value: 1 },
      uLit: { value: 0 },
      uFlash: { value: 0 },
      uGlowColor: { value: new THREE.Color() },
      uGlowBright: { value: 1 },
    }),
    []
  );
  const streakU = useMemo(
    () => ({
      uSpark: { value: null },
      uThreads: { value: 1 },
      uSparkSpeed: { value: 0.4 },
      uSparkWidth: { value: 0.04 },
      uSparkLife: { value: 2.5 },
      uSparkBright: { value: 2 },
      uAppear: { value: 0 },
      ...glow,
      uTime: { value: 0 },
      uSpeed: { value: 0.3 },
      uPulse: { value: 0.08 },
      uPulseBright: { value: 0.6 },
      uWidthPx: { value: 1.4 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uBackFade: { value: 0.12 },
      uOutline: { value: 1 },
      uColor: { value: new THREE.Color() },
      uHot: { value: new THREE.Color() },
      uBright: { value: 1 },
    }),
    [glow]
  );
  const sandU = useMemo(
    () => ({
      uTrail: { value: Array.from({ length: TRAIL }, () => new THREE.Vector4(9, 9, 0, 0)) },
      uTrailAge: { value: new Array(TRAIL).fill(1) },
      uAspect: { value: 1.6 },
      uStirRadius: { value: 0.12 },
      uStirAmount: { value: 1 },
      uStirSwirl: { value: 0.6 },
      uStirMax: { value: 0.035 },
      uCursor: { value: new THREE.Vector2(9, 9) },
      tSimOff: { value: null },
      tSimVel: { value: null },
      uHasSim: { value: 0 },
      uAppear: { value: 0 },
      uStirGlow: { value: 0.9 },
      ...glow,
      uTime: { value: 0 },
      uSize: { value: 2 },
      uRefDepth: { value: 32 },
      uPixelRatio: { value: 1 },
      uDrift: { value: 0.1 },
      uJitter: { value: 0.003 },
      uFall: { value: 1 },
      uSun: { value: SUN_DIR.clone() },
      uColor: { value: new THREE.Color() },
      uColor2: { value: new THREE.Color() },
      uBright: { value: 1 },
      uSparkle: { value: 0.5 },
      uBackFade: { value: 0.12 },
      uOutline: { value: 1 },
      uNight: night,
    }),
    [glow, night]
  );

  const occlusion = useMemo(() => ({ uInset: { value: 0.006 }, uStretch: { value: 1 } }), []);

  // two posed hands, sampled into their particles (the model itself is only
  // measured and sampled — the particles stand in for it)
  const hands = useMemo(
    () =>
      SIDES.map((side) => {
        const model = cloneSkinned(gltf.scene);
        model.updateMatrixWorld(true);
        model.traverse((o) => {
          if (o.isBone || o.isObject3D) o.userData.restQ = o.getWorldQuaternion(new THREE.Quaternion());
        });
        poseHand(model, { extend: C.extend, wrist: C[`${side.key}WristBend`] });
        const inner = new THREE.Group();
        inner.add(model);
        inner.scale.set(side.mirror ? -1 : 1, 1, 1);
        const outer = new THREE.Group();
        outer.add(inner);
        const m = measureHand(outer);
        let threads = null;
        let spark = null;
        if (side.key === "left") {
          threads = buildThreads(outer, m, { count: Math.max(Math.round(C.threadCount), 10), length: Math.max(Math.round(C.threadLength), 4), step: C.threadStep, follow: C.threadFollow, seed: side.seed });
          // (each thread's spark of the pointer's light: where on it, when, how bright)
          const n = Math.max(threads.threads, 1);
          spark = new THREE.DataTexture(new Float32Array(n * 4), n, 1, THREE.RGBAFormat, THREE.FloatType);
          spark.needsUpdate = true;
        }
        let sim = null;
        let particles;
        if (threads) particles = streakObject(threads, streakU);
        else {
          const sample = sampleHand(outer, m, Math.max(Math.round(C.sandCount), 100), side.seed);
          sim = createSandSim(gl, sample);
          particles = sandObject(sample, sandU, sim);
        }
        const holder = new THREE.Group();
        holder.add(particles);
        // (the hand model stays, unseen: its depth hides what is behind it —
        // its forearm drawn out as the particles' is, in its own space)
        model.updateMatrixWorld(true);
        let occluder = null;
        model.traverse((o) => {
          if (!o.isSkinnedMesh) return;
          if (!occluder) {
            const inv = o.matrixWorld.clone().invert();
            const wrist = m.handWrist.clone().applyMatrix4(inv);
            const dir = m.handWrist.clone().add(m.arm).applyMatrix4(inv).sub(wrist).normalize();
            occluder = occluderMaterial(occlusion, { wrist, dir });
          }
          o.material = occluder;
          o.frustumCulled = false;
          o.castShadow = false;
          o.receiveShadow = false;
          o.renderOrder = 1;
        });
        outer.add(holder);
        return { side, outer, inner, holder, particles, m, occluder, threads, spark, sim };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the rebuild trigger
    [gltf, streakU, sandU, occlusion, gl, version]
  );
  useEffect(
    () => () =>
      hands.forEach((h) => {
        h.particles.geometry.dispose();
        h.particles.material.dispose();
        h.occluder?.dispose();
        h.spark?.dispose();
        h.sim?.dispose();
      }),
    [hands]
  );

  const sparkMat = useMemo(
    () => new THREE.ShaderMaterial({ uniforms: glow, vertexShader: SPARK_V, fragmentShader: SPARK_F, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }),
    [glow]
  );
  useEffect(() => () => sparkMat.dispose(), [sparkMat]);
  const spark = useRef(null);
  const trail = useRef({ items: [], lastX: 0, lastY: 0, lastT: 0, still: 0, vx: 0, vy: 0, p: new THREE.Vector3(), hasP: false, force: 0, moved: -9, simT: 0 });

  const v = useMemo(
    () => ({
      T: new THREE.Vector3(),
      wrist: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      toUs: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      dorsal: new THREE.Vector3(),
      across: new THREE.Vector3(),
      tip: new THREE.Vector3(),
      A: new THREE.Matrix4(),
      B: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      roll: new THREE.Quaternion(),
    }),
    []
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // (placed against the camera's resting pose — anchor — so the pointer's
    // parallax moves them over the land, as near things move)
    const cam = anchor.current ?? camera;
    cam.updateMatrixWorld();
    const T = screenPoint(cam, C.touchX, C.touchY, C.touchDepth, v.T);
    glow.uContact.value.copy(T);
    v.right.set(1, 0, 0).transformDirection(cam.matrixWorld);
    v.up.set(0, 1, 0).transformDirection(cam.matrixWorld);
    v.toUs.set(0, 0, 1).transformDirection(cam.matrixWorld);
    let longest = 0;
    for (let i = 0; i < hands.length; i++) {
      const { side, outer, inner, holder, m } = hands[i];
      const k = side.key;
      screenPoint(cam, C[`${k}WristX`], C[`${k}WristY`], C.touchDepth + C[`${k}Back`], v.wrist);
      // (its size from how far its arm comes from — off the screen's edge)
      const reach = v.dir.subVectors(T, v.wrist).length();
      // the way its index points: as set, turned by its aim (degrees)
      const dir = v.dir.set(0, 0, 0).addScaledVector(v.right, side.aim[0]).addScaledVector(v.up, side.aim[1]).addScaledVector(v.toUs, side.aim[2]).normalize();
      dir.applyAxisAngle(v.up, THREE.MathUtils.degToRad(C[`${k}AimYaw`]));
      dir.applyAxisAngle(v.right, THREE.MathUtils.degToRad(C[`${k}AimPitch`]));
      const s = (reach / m.length) * C[`${k}Size`];
      longest = Math.max(longest, reach);
      // the back of the hand as set, square to the way it points, turned by its roll
      const dorsal = v.dorsal.set(0, 0, 0).addScaledVector(v.right, side.dorsal[0]).addScaledVector(v.up, side.dorsal[1]).addScaledVector(v.toUs, side.dorsal[2]);
      dorsal.addScaledVector(dir, -dorsal.dot(dir)).normalize();
      dorsal.applyQuaternion(v.roll.setFromAxisAngle(dir, THREE.MathUtils.degToRad(C[`${k}Roll`])));
      const across = v.across.crossVectors(dorsal, dir).normalize();
      v.A.makeBasis(m.point, m.across, m.back);
      v.B.makeBasis(dir, across, dorsal);
      v.q.setFromRotationMatrix(v.B.multiply(v.A.invert()));
      outer.quaternion.copy(v.q);
      holder.scale.setScalar(s);
      inner.scale.set(side.mirror ? -s : s, s, s);
      // (the sand hand shows what lies behind it, faintly: C.sandOcclude)
      inner.visible = k === "right" ? C.sandOcclude : C.occlude;
      // its fingertip at the touch — held back along its reach until they meet
      // (and a breath of life while it waits)
      // (from far: the right hand from well beyond its corner and back from
      // the camera — C.enterFrom × its reach — so it never pops into view)
      const from = k === "right" ? C.enterFrom : 0.9;
      const away = (1 - story.reach) * reach * from + 0.02 * s;
      // ...and the sand fading in as it comes
      if (k === "right") sandU.uAppear.value = THREE.MathUtils.smoothstep(story.reach, 0, C.enterFade);
      else streakU.uAppear.value = THREE.MathUtils.smoothstep(story.reach, 0, 0.12);
      const sway = (1 - story.glow) * 0.004 * s;
      v.tip.copy(T).addScaledVector(dir, -away).addScaledVector(v.up, Math.sin(time * 0.9 + i * 2.1) * sway).addScaledVector(v.right, Math.cos(time * 0.7 + i) * sway);
      outer.position.copy(v.tip).sub(m.tip.clone().multiplyScalar(s).applyQuaternion(v.q));
      outer.visible = story.reach > 0.001;
      // (the particles' own sizes, in the hand's units)
      if (k === "right") {
        sandU.uJitter.value = C.sandJitter * m.length;
        sandU.uFall.value = C.sandFall * reach;
      }
    }
    occlusion.uInset.value = C.occluderInset;
    occlusion.uStretch.value = Math.max(C.armLength, 1);
    // (the hands in their own light all along; their glow — the edges' light,
    // the runs of light along the threads — at C.preTouch of it until they
    // touch, then up to C.touchGlow ×)
    const wake = THREE.MathUtils.lerp(C.preTouch, C.touchGlow, story.wake);
    // ---- the pointer over the hands
    const ptr = pointer ?? { x: 9, y: 9 };
    const aspect = size.width / Math.max(size.height, 1);
    // the trail (sand): a point where it has moved to, with how it moved
    const tr = trail.current;
    const dx = ptr.x - tr.lastX;
    const dy = ptr.y - tr.lastY;
    const dtp = Math.max(time - tr.lastT, 1e-3);
    if (Math.hypot(dx * aspect, dy) > 0.004 && tr.lastT > 0) {
      // (its motion eased: a smooth wake, not a jolt with every twitch)
      const k = 1 - Math.exp(-dtp * 10);
      tr.vx += (THREE.MathUtils.clamp(dx / dtp, -4, 4) - tr.vx) * k;
      tr.vy += (THREE.MathUtils.clamp(dy / dtp, -4, 4) - tr.vy) * k;
      tr.items.unshift({ x: ptr.x, y: ptr.y, vx: tr.vx * aspect, vy: tr.vy, t: time });
      if (tr.items.length > TRAIL) tr.items.length = TRAIL;
    }
    tr.lastX = ptr.x;
    tr.lastY = ptr.y;
    tr.lastT = time;
    for (let k = 0; k < TRAIL; k++) {
      const it = tr.items[k];
      const age = it ? (time - it.t) / Math.max(C.stirSettle, 0.05) : 1;
      sandU.uTrail.value[k].set(it ? it.x : 9, it ? it.y : 9, it ? it.vx : 0, it ? it.vy : 0);
      sandU.uTrailAge.value[k] = Math.min(age, 1);
    }
    // ---- the sand: the pointer's ray in the hand's own space, its motion
    // there, and how strongly it holds the sand (eased in as it moves, out as
    // it rests) — then a step of the simulation
    const right = hands.find((h) => h.sim);
    if (right) {
      const sim = right.sim;
      const S = sim.U;
      const dts = Math.min(Math.max(time - (tr.simT || time), 0), 0.05);
      tr.simT = time;
      const inv = simInv.copy(right.holder.matrixWorld).invert();
      const inside = ptr.x > -1.5 && ptr.x < 1.5;
      if (inside) {
        rayA.set(ptr.x, ptr.y, 0.5).unproject(camera);
        S.uRayO.value.copy(camera.position).applyMatrix4(inv);
        S.uRayD.value.copy(rayA).applyMatrix4(inv).sub(S.uRayO.value).normalize();
        // (its point on the ray at the hand's depth, and how that moves)
        // (measured before it is moved: along the ray to the hand's depth)
        const along = rayP.copy(sim.centre).sub(S.uRayO.value).dot(S.uRayD.value);
        rayP.copy(S.uRayO.value).addScaledVector(S.uRayD.value, along);
        if (tr.hasP && dts > 0) {
          rayV.subVectors(rayP, tr.p).divideScalar(dts);
          // (a jump — the pointer arriving from elsewhere — is not a stroke)
          if (rayV.length() < 25) S.uPVel.value.lerp(rayV, 1 - Math.exp(-11 * dts));
        }
        tr.p.copy(rayP);
        tr.hasP = true;
      } else {
        tr.hasP = false;
        S.uPVel.value.multiplyScalar(Math.exp(-6 * dts));
      }
      const sp = S.uPVel.value.length();
      if (sp > 4) S.uPVel.value.multiplyScalar(4 / sp);
      if (Math.abs(dx) + Math.abs(dy) > 0.0005) tr.moved = time;
      const live = inside && story.reach > 0.05 && time - (tr.moved || -9) < 1.6;
      const target = live ? 1 : 0;
      tr.force = THREE.MathUtils.damp(tr.force || 0, target, live ? 6.4 : 1.6, dts || 0.016);
      S.uForce.value = tr.force;
      S.uTime.value = time;
      S.uDt.value = dts || 0.016;
      S.uReach2.value = C.stirRadius * C.stirRadius;
      S.uPush.value = C.stirAmount;
      S.uLoose.value = C.stirSwirl;
      // (how fast a grain calms: higher, sooner)
      S.uSettle.value = Math.max(C.stirSettle, 0.05);
      S.uGravity.value = C.stirGravity;
      S.uMax.value = C.stirMax;
      S.uSpring.value = C.stirSpring;
      S.uDown.value.set(0, -1, 0).transformDirection(inv);
      sim.step();
      sandU.tSimOff.value = sim.offset();
      sandU.tSimVel.value = sim.velocity();
      sandU.uHasSim.value = 1;
      sandU.uStirGlow.value = C.stirGlow;
    }
    sandU.uAspect.value = aspect;
    sandU.uStirRadius.value = C.stirRadius;
    sandU.uStirAmount.value = story.reach > 0.001 ? C.stirAmount : 0;
    sandU.uStirSwirl.value = C.stirSwirl;
    sandU.uStirMax.value = C.stirMax;
    sandU.uCursor.value.set(ptr.x, ptr.y);
    // the sparks (threads): the threads under the pointer — on the side we see
    // — lit where it is over them, the light then running along each one
    const left = hands.find((h) => h.threads);
    if (left && left.outer.visible && (Math.abs(dx) + Math.abs(dy) > 0.0005 || tr.still++ < 1)) {
      if (Math.abs(dx) + Math.abs(dy) > 0.0005) tr.still = 0;
      const pk = left.threads.picks;
      const data = left.spark.image.data;
      const mw = left.holder.matrixWorld;
      const r2 = C.sparkRadius * C.sparkRadius;
      let changed = false;
      for (let k = 0; k < pk.length; k += 8) {
        pp.set(pk[k], pk[k + 1], pk[k + 2]).applyMatrix4(mw);
        pn.set(pk[k + 3], pk[k + 4], pk[k + 5]).transformDirection(mw);
        // (its near side only)
        if (pn.dot(pq.subVectors(camera.position, pp)) <= 0) continue;
        pp.project(camera);
        const ex = (pp.x - ptr.x) * aspect;
        const ey = pp.y - ptr.y;
        const d2 = ex * ex + ey * ey;
        if (d2 > r2) continue;
        const th = pk[k + 7];
        const o = th * 4;
        // (lit afresh — unless it was lit just now, close by)
        if (time - data[o + 1] < 0.35 && Math.abs(data[o] - pk[k + 6]) < 0.1) continue;
        data[o] = pk[k + 6];
        data[o + 1] = time;
        data[o + 2] = 1 - Math.sqrt(d2 / r2) * 0.5;
        changed = true;
      }
      if (changed) left.spark.needsUpdate = true;
    }
    // (from the hand on screen: React may build the hands twice, keeping one)
    if (left) {
      streakU.uSpark.value = left.spark;
      streakU.uThreads.value = Math.max(left.threads.threads, 1);
    }
    streakU.uSparkSpeed.value = C.sparkSpeed;
    streakU.uSparkWidth.value = C.sparkWidth;
    streakU.uSparkLife.value = C.sparkLife;
    streakU.uSparkBright.value = C.sparkBright;

    // the light at the touch, and back over the hands
    glow.uFlash.value = story.flash;
    glow.uWave.value = story.glow * longest * 1.15;
    glow.uBandW.value = longest * C.glowWidth;
    glow.uLit.value = Math.min(story.glow * 3, 1);
    glow.uGlowColor.value.set(C.glowColor);
    glow.uGlowBright.value = C.glowBright;
    // the streaks
    const pr = gl.getPixelRatio();
    streakU.uTime.value = time;
    streakU.uSpeed.value = C.streakSpeed;
    streakU.uWidthPx.value = C.streakWidth * pr;
    streakU.uRes.value.set(size.width * pr, size.height * pr);
    streakU.uPulse.value = C.pulseLength;
    streakU.uPulseBright.value = C.pulseBright * wake;
    streakU.uBackFade.value = C.backFade;
    streakU.uOutline.value = C.outline * wake;
    sandU.uBackFade.value = C.sandBackFade;
    sandU.uOutline.value = C.outline * wake;
    streakU.uColor.value.set(C.streakColor);
    streakU.uHot.value.set(C.streakHot);
    streakU.uBright.value = C.streakBright;
    // the sand
    sandU.uTime.value = time;
    sandU.uSize.value = C.sandSize;
    sandU.uRefDepth.value = C.touchDepth;
    sandU.uPixelRatio.value = pr;
    sandU.uDrift.value = C.sandDrift;
    sandU.uColor.value.set(C.sandColor);
    sandU.uColor2.value.set(C.sandColor2);
    sandU.uBright.value = C.sandBright;
    sandU.uSparkle.value = C.sandSparkle;
    if (spark.current) {
      spark.current.position.copy(T);
      spark.current.visible = story.flash > 0.002;
      spark.current.scale.setScalar(longest * C.flashSize * (0.6 + 0.4 * story.flash));
    }
  });

  return (
    <>
      {hands.map((h) => (
        <primitive key={`${h.side.key}-${version}`} object={h.outer} />
      ))}
      <mesh ref={spark} material={sparkMat} frustumCulled={false} renderOrder={10}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </>
  );
}

useGLTF.preload(HAND_URL);
