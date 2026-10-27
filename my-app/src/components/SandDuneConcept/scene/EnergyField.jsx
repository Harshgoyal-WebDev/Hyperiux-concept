"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RIBBON_VERTEX } from "../world/ribbons";
import { mulberry32 } from "../world/layout";
import { cameraPose, getTrailS0 } from "../world/cameraPath";
import { buildMasterTimeline, createJourneyState } from "../timeline";
import { PALETTE } from "../config";
import { T } from "../tuning";
import { motion } from "./Rig";

// From the break until the white-out the camera flies down a tunnel of
// glowing particles. The tunnel is laid along the camera's real
// trajectory (sampled by running the scroll timeline offline), so we
// always travel down its middle; each particle is tagged with the scroll
// progress at which the camera passes it, and only the stretch just around
// the camera is shown. At rest the particles are round points; scrolling
// with some intensity stretches them into streaks along the tunnel.
// A burst of dark stone fragments drifts past right after the break.
const TUNNEL_FROM = 0.34;
const TUNNEL_TO = 0.83;
const SAMPLES = 480;
export const MAX_TUNNEL = 4000;

const STREAK_VERTEX = /* glsl */ `
attribute vec3 aTangent;
attribute vec3 aOffset; // unit direction out from the camera's path
attribute float aSide;
attribute float aT;
attribute vec4 aInfo; // length, width, radius seed, progress tag
uniform float uRadiusMin;
uniform float uRadiusMax;
uniform float uSize;
uniform float uStretch;
uniform float uProgress;
uniform float uTunnel;
uniform float uPixel;
varying float vT;
varying float vSide;
varying float vA;
varying float vLen;
varying float vW;
${RIBBON_VERTEX}
void main() {
  float len = aInfo.x * uStretch;
  // spread evenly over the ring between the two radii
  float rMin = min(uRadiusMin, uRadiusMax);
  float radius = sqrt(mix(rMin * rMin, uRadiusMax * uRadiusMax, aInfo.z));
  vec3 c = position + aOffset * radius;
  vec4 mv0 = modelViewMatrix * vec4(c, 1.0);
  float w = max(aInfo.y * uSize, 1.6 * uPixel * max(-mv0.z, 0.5));
  // quad covers the streak plus a round cap of radius w at each end
  vec3 p = c + aTangent * (aT - 0.5) * (len + 2.0 * w);
  vec4 mv = ncRibbon(p, aTangent, aSide, w);
  vT = aT;
  vSide = aSide;
  vLen = len;
  vW = w;
  // visible just around the camera: appear ahead, gone once passed
  float d = aInfo.w - uProgress;
  vA = uTunnel * smoothstep(-0.02, -0.004, d) * (1.0 - smoothstep(0.035, 0.06, d));
  vA *= smoothstep(1.5, 4.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const STREAK_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uIntensity;
varying float vT;
varying float vSide;
varying float vA;
varying float vLen;
varying float vW;
void main() {
  // capsule distance (in units of the radius): a dot at rest, a streak
  // with round ends when stretched
  float x = (vT - 0.5) * (vLen + 2.0 * vW);
  float dx = max(abs(x) - vLen * 0.5, 0.0) / vW;
  float r = length(vec2(dx, vSide));
  float core = exp(-r * r * 4.0) * (1.0 - smoothstep(0.85, 1.0, r));
  // a longer streak spreads the same light out
  float I = core * vA * uIntensity * mix(1.0, 0.55, smoothstep(0.0, 6.0, vLen / vW));
  if (I < 0.002) discard;
  gl_FragColor = vec4(mix(uColor * 1.4, uHot * 1.8, core * 0.6) * I, 1.0);
}
`;

export default function EnergyField({ pathA, pathC, J, tier, terrain }) {
  const { camera, size } = useThree();
  const chunksRef = useRef();
  const streaksRef = useRef();

  const uniforms = useMemo(
    () => ({
      uStretch: { value: 0 },
      uRadiusMin: { value: 4 },
      uRadiusMax: { value: 18 },
      uSize: { value: 1 },
      uProgress: { value: 0 },
      uTunnel: { value: 0 },
      uPixel: { value: 0.001 },
      uIntensity: { value: 1 },
      uColor: { value: new THREE.Color(PALETTE.orange) },
      uHot: { value: new THREE.Color("#ffc890") },
    }),
    []
  );

  const built = useMemo(() => {
    const rng = mulberry32(2024);

    // Camera trajectory from the break to the white-out, by progress.
    const Js = createJourneyState();
    const tl = buildMasterTimeline(Js, {}, { s0: getTrailS0() });
    const track = [];
    const pos = new THREE.Vector3();
    const tgt = new THREE.Vector3();
    for (let i = 0; i <= SAMPLES; i++) {
      const p = THREE.MathUtils.lerp(TUNNEL_FROM, TUNNEL_TO, i / SAMPLES);
      tl.progress(p);
      cameraPose(Js, pathA, pathC, terrain, pos, tgt);
      track.push({ p, pos: pos.clone() });
    }
    tl.kill();
    // cumulative length, so particles spread evenly in space
    const cum = [0];
    for (let i = 1; i < track.length; i++) cum.push(cum[i - 1] + track[i].pos.distanceTo(track[i - 1].pos));
    const total = cum[cum.length - 1] || 1;
    const sampleAt = (dist, outPos, outDir) => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < dist) i++;
      const a = track[i - 1];
      const b = track[i];
      const f = (dist - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-6);
      outPos.lerpVectors(a.pos, b.pos, f);
      outDir.subVectors(b.pos, a.pos);
      // the camera holds still in places: borrow the next real heading
      for (let k = i + 1; outDir.lengthSq() < 1e-8 && k < track.length; k++) outDir.subVectors(track[k].pos, a.pos);
      if (outDir.lengthSq() < 1e-8) outDir.set(0, 0, -1);
      outDir.normalize();
      return THREE.MathUtils.lerp(a.p, b.p, f);
    };

    const n = MAX_TUNNEL;
    const verts = n * 4;
    const position = new Float32Array(verts * 3);
    const tangent = new Float32Array(verts * 3);
    const offset = new Float32Array(verts * 3);
    const side = new Float32Array(verts);
    const along = new Float32Array(verts);
    const info = new Float32Array(verts * 4);
    const index = new Uint32Array(n * 6);
    const p = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const ux = new THREE.Vector3();
    const uy = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const progress = sampleAt(rng() * total, p, dir);
      const a = rng() * Math.PI * 2;
      ux.set(0, 1, 0);
      if (Math.abs(dir.y) > 0.9) ux.set(1, 0, 0);
      uy.crossVectors(dir, ux).normalize();
      ux.crossVectors(uy, dir).normalize();
      // radial direction; the radius itself is applied in the shader
      ux.multiplyScalar(Math.cos(a)).addScaledVector(uy, Math.sin(a));
      const lenWorld = 2 + rng() * 7;
      const width = 0.035 + rng() * 0.06;
      const radiusSeed = rng();
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        position.set([p.x, p.y, p.z], v * 3);
        tangent.set([dir.x, dir.y, dir.z], v * 3);
        offset.set([ux.x, ux.y, ux.z], v * 3);
        side[v] = k % 2 === 0 ? -1 : 1;
        along[v] = k < 2 ? 0 : 1;
        info.set([lenWorld, width, radiusSeed, progress], v * 4);
      }
      const b = i * 4;
      index.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute("position", new THREE.BufferAttribute(position, 3));
    streakGeo.setAttribute("aTangent", new THREE.BufferAttribute(tangent, 3));
    streakGeo.setAttribute("aOffset", new THREE.BufferAttribute(offset, 3));
    streakGeo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    streakGeo.setAttribute("aT", new THREE.BufferAttribute(along, 1));
    streakGeo.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
    streakGeo.setIndex(new THREE.BufferAttribute(index, 1));
    const streakMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: STREAK_VERTEX,
      fragmentShader: STREAK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // Dark stone fragments drifting past the camera just after the break.
    const chunkCount = Math.round(tier.streaks / 9);
    const chunks = [];
    const breakLength = cum[track.findIndex((s) => s.p >= 0.47)] || total * 0.2;
    for (let i = 0; i < chunkCount; i++) {
      const base = new THREE.Vector3();
      const t = rng();
      sampleAt(t * breakLength, base, dir);
      const a = rng() * Math.PI * 2;
      const r = 3.2 + rng() * 7;
      chunks.push({
        base: base.add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)),
        drift: new THREE.Vector3(Math.cos(a), Math.sin(a), -0.6).normalize().multiplyScalar(2 + rng() * 5),
        axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        spin: 1 + rng() * 3,
        size: 0.07 + Math.pow(rng(), 3) * 0.38,
        t,
      });
    }
    const chunkGeo = new THREE.DodecahedronGeometry(1, 0);
    const chunkMat = new THREE.MeshStandardMaterial({ color: "#151210", roughness: 0.8, flatShading: true });
    return { streakGeo, streakMat, chunks, chunkGeo, chunkMat };
  }, [pathA, pathC, tier, terrain, uniforms]);

  useEffect(
    () => () => {
      built.streakGeo.dispose();
      built.streakMat.dispose();
      built.chunkGeo.dispose();
      built.chunkMat.dispose();
    },
    [built]
  );

  const m = useMemo(() => ({ obj: new THREE.Object3D() }), []);

  useFrame(() => {
    uniforms.uStretch.value = motion.intensity * T.streakLength;
    uniforms.uProgress.value = J.progress;
    uniforms.uTunnel.value = J.tunnel * (1 - J.white);
    uniforms.uIntensity.value = T.tunnelIntensity;
    uniforms.uRadiusMin.value = T.tunnelRadiusMin;
    uniforms.uRadiusMax.value = T.tunnelRadiusMax;
    uniforms.uSize.value = T.tunnelSize;
    uniforms.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.height;
    uniforms.uColor.value.set(T.cubeColor);
    uniforms.uHot.value.set(T.cubeHotColor);
    const cap = tier.name === "low" ? 0.5 : 1;
    built.streakGeo.setDrawRange(0, Math.min(Math.round(T.tunnelCount * cap), MAX_TUNNEL) * 6);
    if (streaksRef.current) streaksRef.current.visible = uniforms.uTunnel.value > 0.001 && T.tunnelCount > 0;

    const mesh = chunksRef.current;
    if (!mesh) return;
    const visible = J.field > 0.001;
    mesh.visible = visible;
    if (!visible) return;
    const drift = THREE.MathUtils.smoothstep(J.progress, 0.4, 0.5);
    built.chunks.forEach((ch, i) => {
      const k = THREE.MathUtils.smoothstep(J.field * 1.2, ch.t * 0.6, ch.t * 0.6 + 0.3);
      m.obj.position.copy(ch.base).addScaledVector(ch.drift, drift);
      m.obj.quaternion.setFromAxisAngle(ch.axis, drift * ch.spin * 4);
      m.obj.scale.setScalar(ch.size * k);
      m.obj.updateMatrix();
      mesh.setMatrixAt(i, m.obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh ref={streaksRef} geometry={built.streakGeo} material={built.streakMat} frustumCulled={false} visible={false} />
      <instancedMesh
        ref={chunksRef}
        args={[built.chunkGeo, built.chunkMat, built.chunks.length]}
        frustumCulled={false}
        visible={false}
      />
    </>
  );
}
