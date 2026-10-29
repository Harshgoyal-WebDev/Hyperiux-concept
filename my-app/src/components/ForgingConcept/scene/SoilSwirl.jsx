"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../world/layout";
import { ORBIT_GLSL, ORBIT_UNIFORMS, makeOrbits, syncOrbit } from "../world/swirl";
import { T } from "../tuning";

// The fine soil the excess rock crumbles into. Every grain
// belongs to one broken piece: it appears at that piece as it crumbles
// (forge.swirlSource: its world position + how far it has crumbled), drifts
// out into its own orbit in the wind swirl around the mark, and keeps
// revolving there. Scrolling back flies it back into its piece.
//
// Each layer is allocated once at its tier's maximum, shuffled so any
// first-N slice spans every lane; the Leva counts only choose how many are
// drawn, so they can be dragged live.

const vertexShader = (pieces) => /* glsl */ `
${ORBIT_GLSL}
attribute vec4 aGrain; // size, brightness, tint, delay (when it leaves its piece)
attribute vec4 aSource; // piece index, offset from the piece (unit ball)
uniform vec4 uChunk[${pieces}];
uniform float uScale;
uniform float uSizeScale;
uniform float uMaxSize;
varying float vA;
varying float vTint;
varying float vBright;
void main() {
  vec4 src = uChunk[int(aSource.x)];
  // released as its piece crumbles, then carried out on the wind
  float born = smoothstep(0.0, 0.06, src.w - aGrain.w * 0.4);
  float g = clamp((src.w - aGrain.w) / max(1.0 - aGrain.w, 0.05), 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  vec3 from = src.xyz + aSource.yzw * 3.0;
  vec3 p = mix(from, orbitPos(), g);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = aGrain.x * uSizeScale * uScale / max(-mv.z, 1.0);
  gl_PointSize = clamp(px, 1.0, uMaxSize);
  // anything smaller than a pixel is dimmed rather than drawn too big
  vA = born * min(px, 1.0);
  vTint = aGrain.z;
  vBright = aGrain.y;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform float uLight;
varying float vA;
varying float vTint;
varying float vBright;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.3, 0.5, d);
  float a = m * vA * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(uColorA, uColorB, vTint) * vBright * uLight, min(a, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function layer(n, pace, rng, sources, { size, bright, colorA, colorB, maxSize }, center, shared) {
  const orbits = makeOrbits(n, pace, rng);
  // pieces shed in proportion to their size
  const weights = sources.map((c) => c.dim ** 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const pickSource = () => {
    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) <= 0) return i;
    return weights.length - 1;
  };
  const orbit = new Float32Array(n * 4);
  const plane = new Float32Array(n * 4);
  const grain = new Float32Array(n * 4);
  const source = new Float32Array(n * 4);
  const v = new THREE.Vector3();
  orbits.forEach((o, i) => {
    orbit.set(o.orbit, i * 4);
    plane.set(o.plane, i * 4);
    grain.set([size[0] + rng() * (size[1] - size[0]), bright[0] + rng() * (bright[1] - bright[0]), rng(), rng() * 0.55], i * 4);
    v.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(2 * Math.cbrt(rng()));
    source.set([pickSource(), v.x, v.y, v.z], i * 4);
  });
  const geometry = new THREE.BufferGeometry();
  // positions are computed in the shader; this only sizes the draw
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geometry.setAttribute("aOrbit", new THREE.BufferAttribute(orbit, 4));
  geometry.setAttribute("aPlane", new THREE.BufferAttribute(plane, 4));
  geometry.setAttribute("aGrain", new THREE.BufferAttribute(grain, 4));
  geometry.setAttribute("aSource", new THREE.BufferAttribute(source, 4));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: center.clone() },
      uClock: { value: 0 },
      uOpen: { value: 0 },
      ...ORBIT_UNIFORMS,
      uTime: shared.uTime,
      uChunk: { value: null }, // forge.swirlSource, by reference
      uScale: { value: 500 },
      uSizeScale: { value: 1 },
      uMaxSize: { value: maxSize },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uOpacity: { value: 1 },
      uLight: { value: 1 },
    },
    vertexShader: vertexShader(sources.length),
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  return { geometry, material };
}

export default function SoilSwirl({ J, tier, shared, forge }) {
  const { gl } = useThree();
  const grainsRef = useRef();
  const clock = useRef(0);

  const built = useMemo(() => {
    const rng = mulberry32(211);
    // fine soil: light sunlit sand to darker earth
    const grains = layer(tier.maxGrains, 1.25, rng, forge.chunks, {
      size: [0.18, 0.45],
      bright: [0.7, 1.15],
      colorA: "#6e4b2e",
      colorB: "#c99d6a",
      maxSize: 4,
    }, forge.world.logo, shared);
    grains.material.uniforms.uChunk.value = forge.swirlSource;
    return { grains };
  }, [tier, shared, forge]);

  useEffect(
    () => () => {
      built.grains.geometry.dispose();
      built.grains.material.dispose();
    },
    [built]
  );

  useFrame((_, delta) => {
    // (hidden for now unless switched on: the broken rock's own sand and
    // gravel revolve round the mark instead)
    const on = T.soilSwirl && J.fracture > 0 && !J.inGarden;
    if (grainsRef.current) grainsRef.current.visible = on;
    if (!on) return;
    syncOrbit();
    // The swirl turns in time (it keeps moving while the page rests on the
    // forged logo); the breakup brings it up to speed.
    clock.current += Math.min(delta, 0.1) * J.orbitSpeed * T.swirlSpeed * T.sandSpeed;
    // gone in the light before the worlds switch
    const fade = 1 - THREE.MathUtils.smoothstep(J.flash, 0.3, 0.9);
    const { geometry, material } = built.grains;
    const u = material.uniforms;
    u.uClock.value = clock.current;
    u.uOpen.value = J.swirlOpen;
    u.uScale.value = gl.domElement.height * 0.5;
    u.uSizeScale.value = T.sandSize;
    u.uOpacity.value = 0.95 * fade;
    u.uLight.value = (1 - shared.uNight.value * 0.6) * T.sandBrightness;
    geometry.setDrawRange(0, Math.min(Math.round(T.sandCount), geometry.attributes.position.count));
  });

  return <points ref={grainsRef} geometry={built.grains.geometry} material={built.grains.material} frustumCulled={false} renderOrder={6} />;
}
