"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RIBBON_VERTEX } from "../world/ribbons";
import { mulberry32 } from "../world/layout";
import { T } from "../tuning";
import { motion } from "./Rig";

// After the cube breaks, hot particles hang in the air around the camera
// and rise slowly. They are points at rest; only when you scroll with some
// intensity do they stretch into streaks along the shot's motion (the tail
// points back along the camera's travel, so scrolling down and back up
// smear them in opposite directions).
const MAX_STREAKS = 1500;
const BOX = 34;

const STREAK_VERTEX = /* glsl */ `
attribute vec4 aSeed; // box position (0..1)^3, seed
attribute float aSide;
attribute float aT; // 0 head, 1 tail
uniform vec3 uCam;
uniform vec3 uVel;
uniform float uTime;
uniform float uLength;
uniform float uIntensityGate; // scroll intensity: points at rest, streaks when scrolling hard
uniform float uPixel;
varying float vT;
varying float vSide;
varying float vA;
${RIBBON_VERTEX}
void main() {
  float seed = aSeed.w;
  vec3 base = aSeed.xyz * ${BOX.toFixed(1)};
  base.y += uTime * (0.5 + seed * 1.6);
  base.x += sin(uTime * 0.4 + seed * 30.0) * 1.2;
  vec3 p = mod(base - uCam + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam;
  // a static point seen from a moving camera smears back along the travel
  vec3 trail = uVel * uLength * (0.025 + seed * 0.03) * uIntensityGate;
  float tl = length(trail);
  // a fast flick shouldn't turn them into beams
  float cap = 2.2 * uLength;
  if (tl > cap) { trail *= cap / tl; tl = cap; }
  vec3 dir = tl > 0.02 ? trail / tl : vec3(0.0, 1.0, 0.0);
  float len = max(tl, 0.08 + seed * 0.1);
  vec3 q = p + dir * len * aT;
  vec4 mv0 = modelViewMatrix * vec4(q, 1.0);
  float dist = max(-mv0.z, 0.3);
  float w = max(0.025 + seed * 0.04, 1.2 * uPixel * dist);
  vec4 mv = ncRibbon(q, dir, aSide, w);
  gl_Position = projectionMatrix * mv;
  vT = aT;
  vSide = aSide;
  // fade in away from the lens, out towards the box edge
  vA = smoothstep(0.8, 3.0, dist) * (1.0 - smoothstep(${(BOX * 0.32).toFixed(1)}, ${(BOX * 0.5).toFixed(1)}, length(p - uCam)));
  // longer streaks spread the same light thinner
  vA *= mix(1.0, 0.45, smoothstep(0.3, 4.0, tl));
}
`;
const STREAK_FRAGMENT = /* glsl */ `
uniform float uIntensity;
varying float vT;
varying float vSide;
varying float vA;
void main() {
  float core = exp(-vSide * vSide * 5.0);
  float fall = 1.0 - vT * 0.85;
  float I = core * fall * vA * uIntensity;
  if (I < 0.002) discard;
  vec3 col = mix(vec3(1.0, 0.3, 0.03) * 1.6, vec3(1.0, 0.72, 0.4) * 2.4, core * (1.0 - vT));
  gl_FragColor = vec4(col * I, 1.0);
}
`;

export default function BreakStreaks({ J, shared }) {
  const { camera, size } = useThree();
  const ref = useRef();

  const built = useMemo(() => {
    const rng = mulberry32(8080);
    const n = MAX_STREAKS;
    const seed = new Float32Array(n * 4 * 4);
    const side = new Float32Array(n * 4);
    const t = new Float32Array(n * 4);
    const index = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const s = [rng(), rng(), rng(), rng()];
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        seed.set(s, v * 4);
        side[v] = k % 2 === 0 ? -1 : 1;
        t[v] = k < 2 ? 0 : 1;
      }
      const b = i * 4;
      index.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    geometry.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    geometry.setAttribute("aT", new THREE.BufferAttribute(t, 1));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uVel: { value: new THREE.Vector3() },
        uTime: shared.uTime,
        uLength: { value: 1 },
        uIntensityGate: { value: 0 },
        uPixel: { value: 0.001 },
        uIntensity: { value: 0 },
      },
      vertexShader: STREAK_VERTEX,
      fragmentShader: STREAK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    return { geometry, material };
  }, [shared]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  useFrame(() => {
    const u = built.material.uniforms;
    u.uCam.value.copy(camera.position);
    u.uVel.value.copy(motion.velocity);
    u.uLength.value = T.streakLength;
    u.uIntensityGate.value = motion.intensity;
    u.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / size.height;
    u.uIntensity.value = J.streaks * T.streakIntensity * (1 - J.white);
    const count = Math.min(Math.round(T.streakCount), MAX_STREAKS);
    built.geometry.setDrawRange(0, count * 6);
    if (ref.current) ref.current.visible = count > 0 && u.uIntensity.value > 0.002;
  });

  return <mesh ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} visible={false} renderOrder={9} />;
}
