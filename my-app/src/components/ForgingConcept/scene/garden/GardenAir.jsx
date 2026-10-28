"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GARDEN } from "../../config";
import { mulberry32 } from "../../world/layout";
import { T } from "../../tuning";

// The garden's air: leaves and blossom petals drifting across on the wind,
// turning over as they go, and small warm motes hanging in the light. A box of air round the pond
// that the wind carries through and wraps round, so it never empties.
// Pure vertex animation (no simulation): position = start + wind · time,
// wrapped, plus a flutter.

const BOX = new THREE.Vector3(70, 16, 60); // size of the box of air (m)

const VERTEX = /* glsl */ `
attribute vec4 aSeed; // phase, size, kind (0 leaf, 1 mote), tint
attribute float aPetal; // a petal (a leaf's sibling: rounder, pink, lighter)
uniform float uTime;
uniform vec3 uBox;
uniform vec3 uCentre;
uniform vec2 uWind;
uniform float uScale;
uniform float uLeafSize;
uniform float uMoteSize;
uniform float uFade;
uniform float uPetals;
varying float vKind;
varying float vTint;
varying float vSpin;
varying float vA;
varying float vPetal;
void main() {
  float mote = aSeed.z;
  float t = uTime * mix(1.0, 0.25, mote);
  vec3 p = position;
  // carried by the wind, wrapped round the box; leaves sink slowly, petals
  // more slowly still
  p.xz += uWind * t * (0.7 + aSeed.x * 0.6);
  p.y -= t * mix(0.25, 0.14, aPetal) * (1.0 - mote);
  p += vec3(sin(t * 0.9 + aSeed.x * 20.0), sin(t * 1.3 + aSeed.x * 11.0) * 0.6, cos(t * 0.7 + aSeed.x * 17.0)) * mix(0.8, 0.4, mote);
  p = mod(p + uBox * 0.5, uBox) - uBox * 0.5;
  p += uCentre;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = aSeed.y * mix(uLeafSize, uMoteSize, mote) * mix(1.0, 0.75, aPetal);
  vPetal = aPetal;
  gl_PointSize = clamp(size * uScale / max(-mv.z, 0.5), 0.0, 14.0);
  vKind = mote;
  vTint = aSeed.w;
  vSpin = t * (1.5 + aSeed.x * 2.0) + aSeed.x * 40.0;
  // fade near the camera and with distance
  vA = smoothstep(3.0, 9.0, -mv.z) * (1.0 - smoothstep(60.0, 90.0, -mv.z)) * uFade * mix(1.0, uPetals, aPetal);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uLeafA;
uniform vec3 uLeafB;
uniform vec3 uMote;
uniform vec3 uPetal;
varying float vKind;
varying float vTint;
varying float vSpin;
varying float vA;
varying float vPetal;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (vKind > 0.5) {
    // a mote: a soft warm glow
    float g = exp(-dot(c, c) * 22.0);
    if (g * vA < 0.02) discard;
    gl_FragColor = vec4(uMote * 2.2, g * vA);
  } else {
    // a leaf: a pointed oval turning over (it narrows as it turns edge-on);
    // a petal: a rounder one, pale pink, lit through
    float a = vSpin;
    vec2 q = vec2(c.x * cos(a) - c.y * sin(a), c.x * sin(a) + c.y * cos(a));
    float edgeOn = 0.25 + 0.75 * abs(cos(vSpin * 0.7));
    q.x /= edgeOn * mix(0.42, 0.5, vPetal);
    q.y /= mix(0.5, 0.4, vPetal);
    float d = dot(q, q);
    if (d > 1.0 || vA < 0.02) discard;
    vec3 col = vPetal > 0.5
      ? mix(uPetal, vec3(1.0), vTint * 0.4) * (0.9 + 0.3 * edgeOn)
      : mix(uLeafA, uLeafB, vTint) * (0.75 + 0.25 * edgeOn);
    gl_FragColor = vec4(col, vA);
  }
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default function GardenAir({ time }) {
  const { gl, camera } = useThree();
  const built = useMemo(() => {
    const rng = mulberry32(6060);
    const leaves = 140;
    const petals = 180;
    const motes = 260;
    const n = leaves + petals + motes;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    const petal = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const mote = i >= leaves + petals ? 1 : 0;
      pos.set([(rng() - 0.5) * BOX.x, (rng() - 0.5) * BOX.y, (rng() - 0.5) * BOX.z], i * 3);
      seed.set([rng(), mote ? 0.05 + rng() * 0.06 : 0.05 + rng() * 0.08, mote, rng()], i * 4);
      petal[i] = i >= leaves && !mote ? 1 : 0;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    geometry.setAttribute("aPetal", new THREE.BufferAttribute(petal, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: time,
        uBox: { value: BOX.clone() },
        uCentre: { value: new THREE.Vector3(GARDEN.pond.x, GARDEN.pond.y + BOX.y * 0.5 + 0.3, GARDEN.pond.z) },
        uWind: { value: new THREE.Vector2(0.9, 0.35) },
        uScale: { value: 1000 },
        uLeafSize: { value: 1 },
        uMoteSize: { value: 1 },
        uFade: { value: 1 },
        uLeafA: { value: new THREE.Color("#2f3f1c") },
        uLeafB: { value: new THREE.Color("#6b5a2a") },
        uMote: { value: new THREE.Color("#ffd8a0") },
        uPetal: { value: new THREE.Color("#f5a9c4") },
        uPetals: { value: 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return { geometry, material, points };
  }, [time]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  useFrame(() => {
    const u = built.material.uniforms;
    u.uScale.value = (gl.domElement.height * camera.projectionMatrix.elements[5]) / 2;
    u.uLeafSize.value = T.gardenLeafSize;
    u.uMoteSize.value = T.gardenMoteSize;
    u.uFade.value = T.gardenAir;
    u.uWind.value.set(0.9, 0.35).multiplyScalar(T.gardenWind);
    // petals off the trees in flower
    u.uPetal.value.set(T.treeBlossomPink);
    u.uPetals.value = Math.min(T.treeBlossomShare * 1.5, 1);
  });

  return <primitive object={built.points} />;
}
