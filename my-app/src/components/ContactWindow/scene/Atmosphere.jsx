"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NOISE, PALETTE, SCENE } from "./shaders/common";
import { mulberry32 } from "./rand";

// The space round the hands: fine motes drifting in the air, a sense of depth.

const DUST_VERTEX = /* glsl */ `
${SCENE}
${NOISE}
attribute vec4 aRand;
varying float vA;
varying float vWarm;
void main() {
  vec3 p = position + drift3(position * 0.05 + vec3(0.0, uTime * 0.02, aRand.x * 7.0)) * 3.0;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  gl_PointSize = clamp(mix(0.04, 0.12, aRand.y) * uScale / max(depth, 0.5), 1.0 * uPixelRatio, 4.0 * uPixelRatio);
  float lit = exp(-distance(p, uContact) / 14.0) * uGlow;
  vA = (0.12 + 0.25 * aRand.z + lit * 0.8) * smoothstep(0.5, 6.0, depth) * (1.0 - smoothstep(120.0, 200.0, depth));
  vWarm = clamp(step(0.72, aRand.w) + lit, 0.0, 1.0);
}
`;
const DUST_FRAGMENT = /* glsl */ `
${PALETTE}
varying float vA;
varying float vWarm;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  vec3 col = mix(vec3(0.42), ORANGE * 1.3, vWarm);
  gl_FragColor = vec4(col, (1.0 - smoothstep(0.0, 0.5, d)) * vA);
}
`;

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

export function Dust({ uniforms, count = 900 }) {
  const points = useMemo(() => {
    const rng = mulberry32(71);
    const pos = new Float32Array(count * 3);
    const rand = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos.set([(rng() - 0.5) * 140, (rng() - 0.5) * 90, -110 + rng() * 170], i * 3);
      rand.set([rng(), rng(), rng(), rng()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));
    const p = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms, vertexShader: DUST_VERTEX, fragmentShader: DUST_FRAGMENT, ...additive }));
    p.frustumCulled = false;
    p.renderOrder = 0;
    return p;
  }, [uniforms, count]);
  useEffect(
    () => () => {
      points.geometry.dispose();
      points.material.dispose();
    },
    [points]
  );
  return <primitive object={points} />;
}
