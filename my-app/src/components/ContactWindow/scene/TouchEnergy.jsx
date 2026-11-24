"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects and uniforms are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE } from "./shaders/common";
import { CONTACT } from "./choreography";

// The touch: the light between the fingertips (CONTACT) — nothing there
// until they collide, then the small, intense flash of the contact, gone as
// the portal opens round it.

const BILLBOARD = /* glsl */ `
uniform vec3 uCenter;
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 mv = viewMatrix * vec4(uCenter, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;
const CORE_FRAGMENT = /* glsl */ `
${PALETTE}
uniform float uLevel;
uniform float uFlashK;
varying vec2 vUv;
void main() {
  float r2 = dot(vUv, vUv);
  vec3 col = ORANGE * exp(-r2 * 7.0) * 0.7 + AMBER * exp(-r2 * 38.0) * 1.6 + vec3(1.0, 0.85, 0.62) * exp(-r2 * 380.0) * 3.0 * uFlashK;
  // (a thin horizontal flare through it at the moment of contact)
  col += ORANGE * exp(-abs(vUv.y) * 90.0) * exp(-abs(vUv.x) * 2.4) * 0.9 * uFlashK;
  gl_FragColor = vec4(col * uLevel, 1.0);
}
`;
const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

export default function TouchEnergy({ look }) {
  const built = useMemo(() => {
    const quad = new THREE.PlaneGeometry(2, 2);
    const core = new THREE.Mesh(
      quad,
      new THREE.ShaderMaterial({ uniforms: { uCenter: { value: CONTACT }, uSize: { value: 3 }, uLevel: { value: 0 }, uFlashK: { value: 0 } }, vertexShader: BILLBOARD, fragmentShader: CORE_FRAGMENT, ...additive })
    );
    core.frustumCulled = false;
    core.renderOrder = 8;
    return { quad, core };
  }, []);
  useEffect(
    () => () => {
      built.quad.dispose();
      built.core.material.dispose();
    },
    [built]
  );

  useFrame(() => {
    const L = look;
    const { core } = built;
    const cu = core.material.uniforms;
    // (small and intense: a point of light between the fingertips; gone
    // as the portal opens round it)
    cu.uLevel.value = L.flash * 0.7 * (1 - Math.min(L.portalT * 4, 1));
    cu.uFlashK.value = Math.min(L.flash * 1.4, 1);
    cu.uSize.value = 0.55 + L.flash * 1.6;
    core.visible = cu.uLevel.value > 0.003 && L.tunnel < 0.5;
  });

  return (
    <>
      <primitive object={built.core} />
    </>
  );
}
