"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RIBBON_VERTEX } from "../world/ribbons";
import { mulberry32 } from "../world/layout";
import { T } from "../tuning";
import { setHex } from "./EnergyCube";
import { cubeScale } from "../world/monolithGeometry";

// The cube releasing its energy: long light beams radiating from the core,
// a cloud of embers,
// a glare around the core and dark rock fragments drifting in the light.
// Everything is driven by the scroll timeline (energy, arcs = extraction,
// flow = outward travel) with a slow time drift for life.

const ORANGE = new THREE.Color("#FF5F00");

// Built at these maxima; the tuned counts are drawn as a prefix (draw
// range), so changing them is free.
const MAX_BEAMS = 120;
// Random draws the removed particle streams used to take; still consumed so
// the embers and debris keep the layout they were tuned with.
const RETIRED_STREAM_DRAWS = 120 * 4;

const BEAM_VERTEX = /* glsl */ `
attribute vec3 aDir;
attribute float aSide;
attribute float aT;
attribute vec4 aInfo; // length, near width, seed, delay
uniform float uGrow;
uniform float uStart;
uniform float uPixel;
uniform float uBeamWidth;
varying float vT;
varying float vSide;
varying float vSeed;
varying float vLen;
varying float vDepth;
${RIBBON_VERTEX}
void main() {
  float grow = clamp((uGrow - aInfo.w) / max(1.0 - aInfo.w, 0.05), 0.0, 1.0);
  float len = aInfo.x * grow;
  vec3 p = position + aDir * (uStart + aT * len);
  vec4 mv0 = modelViewMatrix * vec4(p, 1.0);
  float w = max(mix(aInfo.y, aInfo.y * 0.2, aT), 1.4 * uPixel * max(-mv0.z, 0.5)) * uBeamWidth;
  vec4 mv = ncRibbon(p, aDir, aSide, w);
  vT = aT;
  vSide = aSide;
  vSeed = aInfo.z;
  vLen = len;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const BEAM_FRAGMENT = /* glsl */ `
uniform float uIntensity;
uniform float uTime;
uniform float uFlow;
uniform vec3 uColor;
uniform vec3 uHot;
varying float vT;
varying float vSide;
varying float vSeed;
varying float vLen;
varying float vDepth;
uniform float uFadeNear;
uniform float uFadeFar;
void main() {
  if (vLen <= 0.01) discard;
  float core = exp(-vSide * vSide * 18.0);
  float soft = exp(-vSide * vSide * 2.4) * 0.12;
  float fall = pow(clamp(1.0 - vT, 0.0, 1.0), 1.3);
  float pulse = 0.7 + 0.3 * sin(vT * vLen * 0.3 - uTime * 2.6 - uFlow * 9.0 + vSeed * 40.0);
  float I = (core + soft) * fall * pulse * uIntensity * (0.4 + vSeed * 0.8);
  // fade out around the lens as we fly through the core, so it never
  // flashes white
  I *= smoothstep(uFadeNear * 0.3, uFadeFar * 0.5, vDepth);
  vec3 col = mix(uColor * 1.2, mix(uHot, vec3(1.0), 0.25) * 1.6, core * fall);
  gl_FragColor = vec4(col * I, 1.0);
}
`;

const POINT_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = smoothstep(0.5, 0.0, d);
  float hot = smoothstep(0.25, 0.0, d);
  gl_FragColor = vec4(mix(uColor * 1.6, mix(uHot, vec3(1.0), 0.35) * 2.6, hot) * m * vA, 1.0);
}
`;
// Embers streaming off the cube, pulled back through the cut-out by uPull.
const EMBER_VERTEX = /* glsl */ `
attribute vec3 aDir;
attribute vec4 aInfo; // r0, speed, size, seed
uniform float uWave;
uniform float uFlow;
uniform float uTime;
uniform float uPull;
uniform float uScale;
uniform float uFadeNear;
uniform float uFadeFar;
varying float vA;
void main() {
  float R = 36.0;
  float r = mod(aInfo.x * R + (uFlow * 6.0 + uTime * 0.6) * aInfo.y, R) + 0.6;
  vec3 p = aDir * r;
  p.z -= uPull * r * 1.1;
  p += vec3(sin(r * 0.5 + aInfo.w * 30.0), cos(r * 0.45 + aInfo.w * 17.0), 0.0) * r * 0.05;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float fade = smoothstep(0.6, 3.0, r) * (1.0 - smoothstep(R * 0.45, R, r));
  vA = fade * uWave * smoothstep(uFadeNear * 0.3, uFadeFar * 0.5, -mv.z);
  gl_PointSize = max(aInfo.z * uScale / max(-mv.z, 0.4), 1.5) * step(0.001, vA);
}
`;

// Camera-facing glare around the core: soft bloom, a six-point star (the
// hexagonal cube) and a horizontal anamorphic streak.
const GLARE_VERTEX = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;
const GLARE_FRAGMENT = /* glsl */ `
uniform float uIntensity;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float glow = exp(-r * r * 16.0) * 1.1 + exp(-r * 4.5) * 0.3;
  float ang = atan(p.y, p.x);
  float star = pow(abs(cos(ang * 3.0 + 1.5708)), 60.0) * exp(-r * 2.4) * 0.7;
  float streak = exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 1.8) * 0.55;
  float I = (glow + star + streak) * uIntensity * (1.0 - smoothstep(0.85, 1.0, r));
  vec3 col = mix(uColor * 1.3, mix(uHot, vec3(1.0), 0.35) * 2.0, exp(-r * 7.0));
  gl_FragColor = vec4(col * I, 1.0);
}
`;

export default function EnergyBeams({ monolith, J, tier, shared }) {
  const { gl, camera, size: viewport } = useThree();
  const center = monolith.cube.position;
  const cubeSize = monolith.cube.size;
  const nodes = useRef({});

  const uniforms = useMemo(
    () => ({
      uColor: { value: ORANGE.clone() },
      uHot: { value: new THREE.Color("#ffc890") },
      uCenter: { value: center.clone() },
      uStart: { value: cubeSize * 0.72 },
      uReach: { value: 60 },
      uGrow: { value: 0 },
      uIntensity: { value: 0 },
      uFlow: { value: 0 },
      uTime: shared.uTime,
      uPixel: { value: 0.001 },
      uBeamWidth: { value: 1 },
      uScale: { value: 500 },
      uFadeNear: { value: 3 },
      uFadeFar: { value: 14 },
    }),
    [center, cubeSize, shared]
  );
  // per-part intensities (they share the motion uniforms above)
  const local = useMemo(
    () => ({
      ember: { uWave: { value: 0 }, uPull: { value: 0 } },
      glare: { uIntensity: { value: 0 }, uSize: { value: 18 } },
    }),
    []
  );

  const built = useMemo(() => {
    const rng = mulberry32(5150);
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    const dir = new THREE.Vector3();
    const randomDir = (planar) => {
      if (planar) {
        const a = rng() * Math.PI * 2;
        return dir.set(Math.cos(a), Math.sin(a), (rng() - 0.5) * 0.6).normalize().clone();
      }
      const u = rng() * 2 - 1;
      const t = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return dir.set(s * Math.cos(t), s * Math.sin(t), u).clone();
    };

    // --- beams: 2-point ribbons, all starting at the core
    const beamCount = MAX_BEAMS;
    const bv = beamCount * 4;
    const bPos = new Float32Array(bv * 3);
    const bDir = new Float32Array(bv * 3);
    const bSide = new Float32Array(bv);
    const bT = new Float32Array(bv);
    const bInfo = new Float32Array(bv * 4);
    const bIdx = new Uint32Array(beamCount * 6);
    for (let i = 0; i < beamCount; i++) {
      const d = randomDir(rng() < 0.72);
      const info = [25 + Math.pow(rng(), 0.7) * 95, 0.18 + Math.pow(rng(), 2.2) * 0.9, rng(), rng() * 0.55];
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        bPos.set(center.toArray(), v * 3);
        bDir.set(d.toArray(), v * 3);
        bSide[v] = k % 2 === 0 ? -1 : 1;
        bT[v] = k < 2 ? 0 : 1;
        bInfo.set(info, v * 4);
      }
      const b = i * 4;
      bIdx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
    }
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    beamGeo.setAttribute("aDir", new THREE.BufferAttribute(bDir, 3));
    beamGeo.setAttribute("aSide", new THREE.BufferAttribute(bSide, 1));
    beamGeo.setAttribute("aT", new THREE.BufferAttribute(bT, 1));
    beamGeo.setAttribute("aInfo", new THREE.BufferAttribute(bInfo, 4));
    beamGeo.setIndex(new THREE.BufferAttribute(bIdx, 1));
    const beamMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      side: THREE.DoubleSide,
      ...additive,
    });

    for (let i = 0; i < RETIRED_STREAM_DRAWS; i++) rng();

    // --- embers
    const n = tier.energyParticles * 2;
    const eDir = new Float32Array(n * 3);
    const eInfo = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const d = randomDir(rng() < 0.7);
      eDir.set(d.toArray(), i * 3);
      eInfo.set([rng(), 0.5 + rng() * 1.5, 0.03 + Math.pow(rng(), 2) * 0.12, rng()], i * 4);
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    emberGeo.setAttribute("aDir", new THREE.BufferAttribute(eDir, 3));
    emberGeo.setAttribute("aInfo", new THREE.BufferAttribute(eInfo, 4));
    const emberMat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, ...local.ember },
      vertexShader: EMBER_VERTEX,
      fragmentShader: POINT_FRAGMENT.replace("varying float vA;", "varying float vA;"),
      ...additive,
    });

    // --- glare
    const glareGeo = new THREE.PlaneGeometry(2, 2);
    const glareMat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, ...local.glare },
      vertexShader: GLARE_VERTEX,
      fragmentShader: GLARE_FRAGMENT,
      ...additive,
    });

    // --- debris
    const debris = [];
    for (let i = 0; i < 26; i++) {
      const d = randomDir(rng() < 0.8);
      debris.push({
        dir: d,
        r0: cubeSize * 0.9 + rng() * 11,
        speed: 1.5 + rng() * 4,
        axis: randomDir(false),
        spin: 0.4 + rng() * 1.6,
        size: 0.18 + Math.pow(rng(), 2) * 0.9,
      });
    }
    const debrisGeo = new THREE.DodecahedronGeometry(1, 0);
    const debrisMat = new THREE.MeshStandardMaterial({ color: "#16110e", roughness: 0.7, metalness: 0, flatShading: true, envMapIntensity: 0.2 });

    return {
      beamGeo,
      beamMat,
      emberGeo,
      emberMat,
      glareGeo,
      glareMat,
      debris,
      debrisGeo,
      debrisMat,
      maxEmbers: n,
    };
  }, [center, cubeSize, tier, uniforms, local]);

  useEffect(
    () => () => {
      for (const v of Object.values(built)) if (v?.dispose) v.dispose();
    },
    [built]
  );

  const tmp = useMemo(() => ({ o: new THREE.Object3D() }), []);

  useFrame(() => {
    const u = uniforms;
    setHex(u.uColor, T.cubeColor);
    setHex(u.uHot, T.cubeHotColor);
    // counts (low quality keeps fewer beams)
    const cap = tier.name === "low" ? 0.66 : 1;
    const beams = Math.min(Math.round(T.beamCount * cap), MAX_BEAMS);
    built.beamGeo.setDrawRange(0, beams * 6);
    built.emberGeo.setDrawRange(0, Math.min(Math.round(T.emberCount), built.maxEmbers));
    // beams start at the (tuned) cube's surface
    const scale = cubeScale(monolith, J, T);
    u.uStart.value = cubeSize * 0.72 * scale;
    // The light dies down across the whole tear-open (not just at its
    // end), so flying through the core eases from bright to the desert
    // instead of cutting from white.
    const spent = THREE.MathUtils.smoothstep(J.fracture, 0.15, 0.9);
    const energy = J.energy * (1 - spent * 0.85);
    u.uGrow.value = J.arcs;
    u.uIntensity.value = energy * T.beamIntensity;
    u.uFlow.value = J.flow;
    u.uBeamWidth.value = T.beamWidth;
    u.uScale.value = gl.domElement.height * 0.5;
    u.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / viewport.height;
    local.ember.uWave.value = J.wave * T.waveIntensity;
    local.ember.uPull.value = J.pull;
    const glow = (0.12 * J.cubeGlow * (1 - J.fracture) + energy * 0.4 + J.fracture * (1 - J.fracture) * 0.8) * (1 - spent * 0.9);
    // the glare sits on the core: dim it as the camera closes in and
    // passes through, instead of filling the frame and cutting out
    u.uFadeNear.value = T.coreFadeNear;
    u.uFadeFar.value = T.coreFadeFar;
    const toCore = camera.position.distanceTo(center);
    const pass = THREE.MathUtils.smoothstep(toCore, T.coreFadeNear, Math.max(T.coreFadeFar, T.coreFadeNear + 0.1));
    local.glare.uIntensity.value = glow * T.glare * (1 - J.white) * pass;
    local.glare.uSize.value = cubeSize * scale * (1.4 + energy * 0.9);

    const show = (k, on) => nodes.current[k] && (nodes.current[k].visible = on);
    show("beams", beams > 0 && u.uIntensity.value > 0.002 && J.arcs > 0.001);
    show("ember", T.emberCount > 0 && local.ember.uWave.value > 0.002);
    show("glare", local.glare.uIntensity.value > 0.002);

    const mesh = nodes.current.debris;
    if (!mesh) return;
    const vis = THREE.MathUtils.smoothstep(J.energy, 0.15, 0.5) * (1 - THREE.MathUtils.smoothstep(J.field, 0.4, 1));
    mesh.visible = vis > 0.001;
    if (!mesh.visible) return;
    built.debris.forEach((d, i) => {
      const r = d.r0 + J.flow * d.speed;
      tmp.o.position.copy(center).addScaledVector(d.dir, r * scale);
      tmp.o.quaternion.setFromAxisAngle(d.axis, J.flow * d.spin);
      tmp.o.scale.setScalar(d.size * vis);
      tmp.o.updateMatrix();
      mesh.setMatrixAt(i, tmp.o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  const set = nodes.current;
  return (
    <>
      <mesh ref={(el) => (set.beams = el)} geometry={built.beamGeo} material={built.beamMat} frustumCulled={false} visible={false} renderOrder={8} />
      <points ref={(el) => (set.ember = el)} position={center} geometry={built.emberGeo} material={built.emberMat} frustumCulled={false} visible={false} renderOrder={8} />
      <mesh ref={(el) => (set.glare = el)} position={center} geometry={built.glareGeo} material={built.glareMat} frustumCulled={false} visible={false} renderOrder={9} />
      <instancedMesh ref={(el) => (set.debris = el)} args={[built.debrisGeo, built.debrisMat, built.debris.length]} frustumCulled={false} visible={false} />
    </>
  );
}
