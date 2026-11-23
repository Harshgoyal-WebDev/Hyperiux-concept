"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BEAM_POINTS } from "../../world/materials";
import { mulberry32 } from "../../world/layout";
import { S_END, WATER_Y, meander, route } from "../../world/oasis";
import { descentAt, routeDistance } from "../../world/oasisCamera";
import { T } from "../../tuning";
import { reducedMotion } from "../hero/heroState";

// The energy trail's light in the valley (scene/oasis/Streaks.jsx draws the
// trail itself): where it runs now — from just behind the camera to its
// head, a set lead ahead (the same lead Streaks keeps) — as a polyline the
// sand lights up round (world/materials.js uBeamPath: a tight bright pool
// under it, a soft spill a few metres out), and sparks of its energy
// running along it at their own pace, a little over and either side of
// it, wavering as they go.
const SPARKS = { high: 260, medium: 170, low: 90 };
const UP = new THREE.Vector3(0, 1, 0);

const VERTEX = /* glsl */ `
uniform vec3 uPath[${BEAM_POINTS}];
uniform float uTime;
uniform float uScale;
uniform float uLevel;
attribute vec4 aInfo; // where along it (0..1), pace (runs a second), side offset (m), height (m)
varying float vA;
void main() {
  float u = fract(aInfo.x + uTime * aInfo.y);
  float f = u * ${(BEAM_POINTS - 1).toFixed(1)};
  int i = int(min(floor(f), ${(BEAM_POINTS - 2).toFixed(1)}));
  vec3 a = uPath[i];
  vec3 b = uPath[i + 1];
  vec3 p = mix(a, b, f - float(i));
  vec3 dir = normalize(b - a + vec3(1e-4, 0.0, 0.0));
  vec3 side = normalize(vec3(-dir.z, 0.0, dir.x));
  p += side * aInfo.z * (1.0 + 0.35 * sin(uTime * 2.3 + aInfo.x * 40.0));
  p.y += aInfo.w + 0.12 * sin(uTime * 3.1 + aInfo.x * 60.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.1);
  float px = (0.07 + 0.09 * fract(aInfo.x * 17.0)) * uScale / dist;
  float a0 = 1.0;
  if (px < 1.3) { a0 = px / 1.3; px = 1.3; }
  gl_PointSize = min(px, 14.0);
  // (in at the trail's start, out towards its head; none at the lens)
  vA = a0 * smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.75, 1.0, u)) * smoothstep(1.5, 5.0, dist) * uLevel;
}
`;
const FRAGMENT = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.0, 0.5, d);
  m *= m;
  gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * 3.0 * m * vA, m * vA);
}
`;

export default function TrailLight({ J, tier, shared, gate }) {
  const built = useMemo(() => {
    const n = SPARKS[tier.name] ?? SPARKS.medium;
    const rng = mulberry32(1409);
    const info = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) info.set([rng(), 0.05 + rng() * 0.12, (rng() * 2 - 1) * (0.2 + rng() * 0.9), 0.15 + rng() * rng() * 1.6], i * 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
    const material = new THREE.ShaderMaterial({
      uniforms: { uPath: shared.uBeamPath, uTime: { value: 0 }, uScale: { value: 500 }, uLevel: { value: 0 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, [tier, shared]);
  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  const ref = useRef();
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), side: new THREE.Vector3(), buf: new THREE.Vector2() }), []);
  useFrame(({ gl, camera }, delta) => {
    const k = gate();
    shared.uBeamSpill.value = T.trailSpill * k;
    const u = built.material.uniforms;
    u.uLevel.value = T.trailSparks * k;
    if (ref.current) ref.current.visible = u.uLevel.value > 0.001;
    if (k <= 0.001) return;
    if (!reducedMotion()) u.uTime.value += Math.min(delta, 0.1);
    gl.getDrawingBufferSize(tmp.buf);
    u.uScale.value = (tmp.buf.y * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    // where the trail runs now: behind the camera to its head (Streaks.jsx's lead)
    const camS = routeDistance(J.progress);
    const head = camS + 150 * T.oasisBeamLead * (0.45 + 0.55 * descentAt(camS));
    const s0 = camS - 15;
    const path = shared.uBeamPath.value;
    const box = shared.uBeamBox.value.set(Infinity, Infinity, -Infinity, -Infinity);
    for (let i = 0; i < path.length; i++) {
      const s = Math.min(s0 + ((head - s0) * i) / (path.length - 1), S_END);
      route.getPointAt(Math.max(s, 0) / S_END, tmp.p);
      route.getTangentAt(Math.max(s, 0) / S_END, tmp.t);
      tmp.side.crossVectors(tmp.t, UP).normalize();
      const lat = meander(s);
      path[i].set(tmp.p.x + tmp.side.x * lat, WATER_Y + 0.75, tmp.p.z + tmp.side.z * lat);
      box.set(Math.min(box.x, path[i].x), Math.min(box.y, path[i].z), Math.max(box.z, path[i].x), Math.max(box.w, path[i].z));
    }
    box.x -= 14;
    box.y -= 14;
    box.z += 14;
    box.w += 14;
  });

  return <points ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} />;
}
