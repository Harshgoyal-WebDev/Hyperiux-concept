"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WIND_DIR } from "@/components/ForgingSandDuneConceptV3/config";
import { mulberry32 } from "@/components/ForgingSandDuneConceptV3/world/layout";
import { T } from "@/components/ForgingSandDuneConceptV3/tuning";
import { A } from "../tuning";

// (The forging-sand-dune-concept-v3 hero's blowing sand — DuneDust.jsx —
// taken over for the about page: as the land turns to light, its dust turns
// to the land's glowing orange, by day and by night. Otherwise as there.)
//
// Sand blowing over the dunes (the first scene, after the reference): soft,
// translucent sheets of dust drifting low over the sand with the wind, and
// streamers lifting off the crests and edges — each a wide, low wisp that
// fades in, streams along downwind, curls a little and thins away, over and
// over. Lit warm by the low sun. Instanced soft quads, cheap.

const COUNT = 260;
const AREA = { x0: -420, x1: 420, z0: -700, z1: 180 };

const VERTEX = /* glsl */ `
attribute vec4 aSpot; // x, ground y, z, seed
attribute vec4 aShape; // width, height, crest (0 floor / 1 crest), life (s)
uniform float uTime;
uniform vec2 uWind;
uniform float uSpeed;
varying vec2 vUv;
varying float vA;
varying float vSeed;
#include <common>
#include <fog_pars_vertex>
void main() {
  float seed = aSpot.w;
  float life = aShape.w;
  float age = fract(uTime / life + seed * 7.13);
  // drifting downwind over its life, lifting a little (more off the crests)
  vec3 base = vec3(aSpot.x, aSpot.y, aSpot.z);
  vec3 drift = vec3(uWind.x, 0.0, uWind.y) * (age * life * uSpeed * (0.6 + 0.8 * fract(seed * 3.1)));
  drift.y = age * (0.6 + aShape.z * 2.4);
  vec3 c = base + drift;
  // a wide, low wisp, turned to the camera about the vertical, along the wind
  vec3 toCam = normalize(cameraPosition - c);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  float w = aShape.x * (0.7 + 0.6 * age);
  float h = aShape.y * (0.8 + 0.7 * age);
  vec3 p = c + right * position.x * w + vec3(0.0, 1.0, 0.0) * (position.y + 0.5) * h;
  vUv = uv;
  vSeed = seed;
  // in, and out again, over its life
  vA = smoothstep(0.0, 0.25, age) * (1.0 - smoothstep(0.55, 1.0, age));
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  // (none right in front of the lens)
  vA *= smoothstep(6.0, 30.0, -mvPosition.z);
  #include <fog_vertex>
}
`;
const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uGain;
uniform vec3 uColor;
varying vec2 vUv;
varying float vA;
varying float vSeed;
#include <fog_pars_fragment>
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * n2(p);
    p = p * 2.1 + 3.7;
    a *= 0.5;
  }
  return s;
}
void main() {
  // streaky: stretched along the wind (across the quad), drifting through it
  vec2 q = vec2(vUv.x * 1.6 - uTime * 0.12 + vSeed * 17.0, vUv.y * 2.6);
  float n = fbm(q + vec2(fbm(q * 0.7 + 4.0), 0.0) * 0.8);
  // soft at its ends, densest low down, feathering up into nothing
  float shape = smoothstep(0.0, 0.35, vUv.x) * (1.0 - smoothstep(0.65, 1.0, vUv.x)) * pow(max(1.0 - vUv.y, 0.0), 1.3) * smoothstep(0.0, 0.06, vUv.y);
  float a = smoothstep(0.25, 0.75, n) * shape * vA * uGain;
  // (lit by the low sun: brighter where it is thickest)
  gl_FragColor = vec4(uColor * (0.85 + 0.4 * n), a);
  #include <fog_fragment>
}
`;

const DUST_DAY = new THREE.Color("#e6b182");
const DUST_NIGHT = new THREE.Color("#7d88a6");

const tint = new THREE.Color();

export default function LightDust({ terrain, shared, S }) {
  const mesh = useRef();
  const built = useMemo(() => {
    const rng = mulberry32(4242);
    const spot = new Float32Array(COUNT * 4);
    const shape = new Float32Array(COUNT * 4);
    let n = 0;
    let guard = 0;
    while (n < COUNT && guard++ < COUNT * 40) {
      const x = AREA.x0 + rng() * (AREA.x1 - AREA.x0);
      const z = AREA.z0 + rng() * (AREA.z1 - AREA.z0);
      // (clear of the mark and the camera's way to it)
      if (Math.abs(x) < 40 && z > -60) continue;
      const y = terrain.height(x, z);
      // crests and edges: higher than the ground round about
      const around = (terrain.height(x + 12, z) + terrain.height(x - 12, z) + terrain.height(x, z + 12) + terrain.height(x, z - 12)) / 4;
      const crest = THREE.MathUtils.clamp((y - around) / 2.5, 0, 1);
      // (most on the crests and slopes, some over the flats)
      if (crest < 0.15 && rng() > 0.35) continue;
      spot.set([x, y - 0.3, z, rng()], n * 4);
      const big = 0.6 + rng() * 0.8;
      shape.set([(40 + rng() * 70) * big, (6 + rng() * 8 + crest * 10) * big, crest, 7 + rng() * 9], n * 4);
      n++;
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute("position", quad.attributes.position);
    geometry.setAttribute("uv", quad.attributes.uv);
    geometry.setAttribute("aSpot", new THREE.InstancedBufferAttribute(spot, 4));
    geometry.setAttribute("aShape", new THREE.InstancedBufferAttribute(shape, 4));
    geometry.instanceCount = n;
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uWind: { value: new THREE.Vector2(WIND_DIR.x, WIND_DIR.y) },
          uSpeed: { value: 4 },
          uGain: { value: 0.22 },
          uColor: { value: new THREE.Color("#e6b182") },
        },
      ]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    return { geometry, material, quad, count: n };
  }, [terrain]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.quad.dispose();
      built.material.dispose();
    },
    [built]
  );

  useFrame(({ clock }) => {
    const on = T.duneDust > 0.001;
    if (mesh.current) mesh.current.visible = on;
    if (!on) return;
    const u = built.material.uniforms;
    u.uTime.value = clock.elapsedTime;
    // (by night: a cool, faint moonlit grey — not the sunset's warm glow)
    const night = shared?.uNight.value ?? 0;
    // ...and as the land turns to light, the land's own glowing orange
    const lit = S?.lit ?? 0;
    u.uGain.value = 0.22 * T.duneDust * THREE.MathUtils.lerp(THREE.MathUtils.lerp(1, 0.45, night), A.dustLitGain, lit);
    u.uColor.value.copy(DUST_DAY).lerp(DUST_NIGHT, night).lerp(tint.set(A.dustColor).multiplyScalar(A.dustLitBright), lit);
    u.uSpeed.value = T.duneDustWind;
    built.geometry.instanceCount = Math.round(built.count * Math.min(T.duneDustAmount, 1));
  });

  return <mesh ref={mesh} geometry={built.geometry} material={built.material} frustumCulled={false} renderOrder={2} />;
}
