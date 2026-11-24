"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects and uniforms are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createRig, placeHand, poseAngles } from "../hand/handRig";
import { mulberry32 } from "./rand";
import { particleHandFragment, particleHandVertex } from "./shaders/particleHand";
import { vertexDotFragment, vertexDotVertex, wireFragment, wireVertex } from "./shaders/wireframeHand";

// The two hands and their interaction (scene/choreography.js gives where
// each fingertip is, which way each hand reaches, how the fingers are set):
//   Hand A – the white particle hand, a left hand, in the foreground,
//            reaching in from the left, its wrist streaming away in
//            filaments of light (shaders/particleHand.js)
//   Hand B – the orange wireframe hand, a right hand (the same anatomy,
//            mirrored), in the background, reaching down from the upper
//            right, its forearm fading out (shaders/wireframeHand.js)
// Both from the one hand model (public/human_hand.glb, read by
// hand/handModel.js), posed by their own rigs.

function particleGeometry(d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(d.position, 3));
  g.setAttribute("aNormal", new THREE.BufferAttribute(d.normal, 3));
  g.setAttribute("aBone", new THREE.BufferAttribute(d.bones, 2));
  g.setAttribute("aWeight", new THREE.BufferAttribute(d.weights, 2));
  const rng = mulberry32(31);
  const rand = new Float32Array(d.count * 4);
  for (let i = 0; i < rand.length; i++) rand[i] = rng();
  g.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return g;
}
function skinnedGeometry(d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(d.position, 3));
  g.setAttribute("aBone", new THREE.BufferAttribute(d.bones, 2));
  g.setAttribute("aWeight", new THREE.BufferAttribute(d.weights, 2));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return g;
}

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
// (the hands' size in the frame, as the reference has them)
const HAND_SCALE = 1.6;

export default function Hands({ data, look, uniforms, gain = 0.62 }) {
  const built = useMemo(() => {
    const rigA = createRig(data.anatomy);
    const rigB = createRig(data.anatomy);
    const pg = particleGeometry(data.particles);
    // (the hand's length: the particle hand's arm fading out where it ends)
    const spanY = new THREE.Vector2(...data.anatomy.extent);
    // (the touch's shockwave: from the index fingertip, as far as the hand
    // reaches from it — shaders/common.js SHOCK)
    const tip = new THREE.Vector3(...data.anatomy.indexTip);
    let reach = 0;
    const P = data.particles.position;
    for (let i = 0; i < P.length; i += 3) reach = Math.max(reach, Math.hypot(P[i] - tip.x, P[i + 1] - tip.y, P[i + 2] - tip.z));
    const shock = { uTip: { value: tip }, uShockLen: { value: reach } };
    const a = new THREE.Points(
      pg,
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uBones: { value: rigA.matrices }, uSpanY: { value: spanY }, ...shock, uOpacity: { value: gain } },
        vertexShader: particleHandVertex,
        fragmentShader: particleHandFragment,
        ...additive,
      })
    );
    const lg = skinnedGeometry(data.wire.lines);
    const vg = skinnedGeometry(data.wire.vertices);
    const wireMat = (opacity) =>
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uBones: { value: rigB.matrices }, uOpacity: { value: opacity }, ...shock },
        vertexShader: wireVertex,
        fragmentShader: wireFragment,
        ...additive,
      });
    const b = new THREE.Group();
    const lines = new THREE.LineSegments(lg, wireMat(0.42));
    lines.material.depthWrite = true;
    const dots = new THREE.Points(
      vg,
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uBones: { value: rigB.matrices }, uOpacity: { value: 0.38 }, ...shock },
        vertexShader: vertexDotVertex,
        fragmentShader: vertexDotFragment,
        ...additive,
      })
    );
    b.add(lines, dots);
    for (const o of [a, b]) {
      o.matrixAutoUpdate = false;
      o.frustumCulled = false;
    }
    lines.frustumCulled = dots.frustumCulled = false;
    // (drawn behind the portal; the particle hand after it — scene/Portal.jsx)
    b.renderOrder = 1;
    lines.renderOrder = dots.renderOrder = 1;
    a.renderOrder = 5;
    return { rigA, rigB, a, b, lines, dots, pg, lg, vg };
  }, [data, uniforms, gain]);
  useEffect(
    () => () => {
      built.pg.dispose();
      built.lg.dispose();
      built.vg.dispose();
      built.a.material.dispose();
      built.lines.material.dispose();
      built.dots.material.dispose();
    },
    [built]
  );

  const tmp = useMemo(
    () => ({ e: new THREE.Euler(), m: new THREE.Matrix4(), lean: new THREE.Matrix4() }),
    []
  );
  // each hand leaning a little towards the pointer — turning about its own
  // fingertip, so the fingertips stay exactly where they are
  const leanAbout = (matrix, tip, yaw, pitch) => {
    tmp.e.set(pitch, yaw, 0);
    tmp.lean.makeRotationFromEuler(tmp.e);
    tmp.m.makeTranslation(tip.x, tip.y, tip.z).multiply(tmp.lean);
    tmp.lean.makeTranslation(-tip.x, -tip.y, -tip.z);
    tmp.m.multiply(tmp.lean);
    matrix.premultiply(tmp.m);
  };

  useFrame(() => {
    const L = look;
    const { rigA, rigB, a, b } = built;
    // hand A: the first pass's hand, held as it is (on scroll the hands only
    // come closer)
    poseAngles(rigA.angles, { extend: L.extend });
    rigA.update();
    placeHand(rigA, { tipAt: L.tipA, dir: L.dirA, palm: L.palmA, mirror: true, scale: HAND_SCALE }, a.matrix);
    const P = L.pointer;
    leanAbout(a.matrix, L.tipA, P.x * 0.05 * P.z, -P.y * 0.04 * P.z);
    a.matrixWorldNeedsUpdate = true;
    // hand B: the same hand, bent at the wrist (its forearm rising steeply to
    // the top of the frame)
    poseAngles(rigB.angles, { extend: L.extend, wrist: -0.62 });
    rigB.update();
    placeHand(rigB, { tipAt: L.tipB, dir: L.dirB, palm: L.palmB, scale: HAND_SCALE }, b.matrix);
    leanAbout(b.matrix, L.tipB, P.x * 0.035 * P.z, -P.y * 0.03 * P.z);
    b.matrixWorldNeedsUpdate = true;
    a.visible = b.visible = L.handsFade > 0.002;
  });

  return (
    <>
      <primitive object={built.b} />
      <primitive object={built.a} />
    </>
  );
}
