"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../../world/layout";
import { T } from "../../tuning";
import { reducedMotion } from "./heroState";

// Orange embers rising from the sand: each lifts off the ground, drifts up
// wavering on the wind and fades out as it climbs, flickering; then another
// rises in its place. Warm against the night's cool light: few by day, many
// by night (T.embers). Reusable: `spots(rng, i, n)` → [x, z] where each rises
// from, `gate` when they show (a function of the scroll, 0..1).
const COUNT = { high: 320, medium: 220, low: 110 };

const VERTEX = /* glsl */ `
uniform float uTime;
uniform vec2 uWind;
uniform sampler2D uHeight;
uniform vec4 uHMap;
uniform float uScale;
uniform float uLevel;
attribute vec4 aInfo; // phase, rise (m/s), climb (m), size (m)
varying float vA;
float ground(vec2 xz) {
  vec2 uv = ((xz - uHMap.xy) / uHMap.z + 0.5) / uHMap.w;
  return texture2D(uHeight, uv).r;
}
void main() {
  float life = fract(aInfo.x + uTime * aInfo.y / aInfo.z);
  vec3 p = position;
  float ph = aInfo.x * 6.2831853;
  // carried a little downwind as it rises, wavering
  p.xz += uWind * life * aInfo.z * 0.6 + vec2(sin(uTime * 0.9 + ph), cos(uTime * 0.7 + ph * 1.3)) * 0.8 * life;
  p.y = ground(p.xz) + 0.2 + life * aInfo.z;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.1);
  float px = aInfo.w * uScale / dist;
  float a = 1.0;
  if (px < 1.3) { a = px / 1.3; px = 1.3; }
  gl_PointSize = min(px, 12.0);
  // in quickly, out slowly as it climbs; flickering
  a *= smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.45, 1.0, life));
  a *= 0.65 + 0.35 * sin(uTime * (7.0 + aInfo.x * 9.0) + ph * 3.0);
  vA = a * smoothstep(2.0, 6.0, dist) * uLevel;
}
`;
const FRAGMENT = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.0, 0.5, d);
  m *= m;
  gl_FragColor = vec4(vec3(1.0, 0.42, 0.1) * 4.0 * m * vA, m * vA);
}
`;

export default function Embers({ J, tier, shared, heightField, spots, gate, seed = 1601 }) {
  const { gl, camera } = useThree();
  const built = useMemo(() => {
    const n = COUNT[tier.name] ?? COUNT.medium;
    const rng = mulberry32(seed);
    const pos = new Float32Array(n * 3);
    const info = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const [x, z] = spots(rng, i, n);
      pos.set([x, 0, z], i * 3);
      info.set([rng(), 0.5 + rng() * 1.3, 8 + rng() * 22, 0.07 + rng() * rng() * 0.16], i * 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWind: shared.uWind,
        uHeight: { value: heightField.texture },
        uHMap: { value: heightField.params },
        uScale: { value: 500 },
        uLevel: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, [tier, shared, heightField, spots, seed]);
  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  const ref = useRef();
  const buf = useMemo(() => new THREE.Vector2(), []);
  useFrame((_, delta) => {
    const u = built.material.uniforms;
    u.uLevel.value = T.embers * (0.15 + 0.85 * shared.uNight.value) * (gate ? gate(J.progress) : 1);
    if (ref.current) ref.current.visible = u.uLevel.value > 0.001;
    if (u.uLevel.value <= 0.001) return;
    if (!reducedMotion()) u.uTime.value += Math.min(delta, 0.1);
    gl.getDrawingBufferSize(buf);
    u.uScale.value = (buf.y * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  });

  return <points ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} />;
}
