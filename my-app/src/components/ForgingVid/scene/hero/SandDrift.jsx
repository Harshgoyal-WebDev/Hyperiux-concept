"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SUN_DIR } from "../../config";
import { mulberry32 } from "../../world/layout";
import { T } from "../../tuning";
import { reducedMotion } from "./heroState";

// Sand blowing off the dunes: soft, wispy clouds of dust lifted by the wind
// round the slab's base and over the dunes in front of it. Each one drifts
// downwind over its stretch, rising a little, and fades in and out as it
// goes (then starts again upwind), its edge torn up by a churning noise.
// Lit warm, and bright where we look into the sun. Sprites a few metres
// to ~23 m wide and flat, low over the sand (the height map), their lower
// edge faded so they never cut a hard line into the dune behind. Faint: a
// haze of sand, not clouds.
const COUNT = { high: 260, medium: 170, low: 90 };
const STRETCH = 70; // metres each cloud drifts before it starts again

const VERTEX = /* glsl */ `
uniform float uTime;
uniform vec2 uWind;
uniform sampler2D uHeight;
uniform vec4 uHMap;
uniform vec3 uSun;
uniform float uScale;
uniform float uLevel;
uniform float uNight;
attribute vec4 aInfo; // size (m), phase (0..1), pace (m/s), height over the sand (m)
varying float vA;
varying vec3 vCol;
varying float vSeed;
float ground(vec2 xz) {
  vec2 uv = ((xz - uHMap.xy) / uHMap.z + 0.5) / uHMap.w;
  return texture2D(uHeight, uv).r;
}
void main() {
  // where it is along its stretch (0..1), and how far through its life
  float x = fract(aInfo.y + uTime * aInfo.z / ${STRETCH.toFixed(1)});
  vec3 p = position;
  p.xz += uWind * (x - 0.5) * ${STRETCH.toFixed(1)};
  // (a little sideways sway)
  p.xz += vec2(-uWind.y, uWind.x) * sin(uTime * 0.21 + aInfo.y * 31.0) * 3.0;
  // (centred on the sand itself: only its upper half shows, lying on it)
  p.y = ground(p.xz) + aInfo.w * 0.25 + x * 0.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.1);
  gl_PointSize = min(aInfo.x * (0.8 + x * 0.5) * uScale / dist, 420.0);
  // in and out over its life; none right at the lens; thinning into the haze
  float life = sin(x * 3.14159);
  float a = life * life * smoothstep(12.0, 40.0, dist) * exp(-dist * 0.0025);
  // lit warm; bright looking into the sun
  vec3 view = normalize(p - cameraPosition);
  float sun = pow(max(dot(view, uSun), 0.0), 5.0);
  vCol = mix(vec3(0.58, 0.33, 0.18), vec3(0.95, 0.56, 0.3) * 1.1, sun);
  // (by night, a low moonlit mist)
  vCol = mix(vCol, mix(vec3(0.2, 0.26, 0.4), vec3(0.4, 0.5, 0.75), sun), uNight);
  vA = a * (0.26 + 0.3 * sun) * uLevel;
  vSeed = aInfo.y * 17.0;
}
`;
const FRAGMENT = /* glsl */ `
uniform float uTime;
varying float vA;
varying vec3 vCol;
varying float vSeed;
float h2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float n2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 c = gl_PointCoord - 0.5;
  // a low streak of dust, wide and flat, its edge torn by a churning noise
  float r2 = length(c * vec2(1.0, 2.6));
  vec2 q = vec2(c.x * 1.6, c.y * 6.0) + vSeed;
  float w = n2(q + vec2(uTime * 0.12, 0.0)) * 0.65 + n2(q * 2.3 - vec2(0.0, uTime * 0.09)) * 0.35;
  float m = (1.0 - smoothstep(0.08, 0.5, r2)) * smoothstep(0.2, 0.85, w);
  // (its lower edge faded: it never cuts a line into the sand behind)
  m *= 1.0 - smoothstep(0.42, 0.52, gl_PointCoord.y);
  float a = m * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol, a);
}
`;

// where the hero's clouds lie: round the slab's base (blown off its foot)
// and over the dunes in front of it and either side
function heroSpots(rng, i, n) {
  const near = i < n * 0.45;
  if (near) {
    const a = rng() * Math.PI * 2;
    const r = 22 + rng() * 45;
    return [Math.cos(a) * r, Math.sin(a) * r * 0.7, true];
  }
  return [-230 + rng() * 460, -160 + rng() * 290, false];
}

// (reusable: `spots(rng, i, n)` → [x, z, near] places each cloud, `gate`
// when they show — a function of the scroll, 0..1)
export default function SandDrift({ J, tier, shared, heightField, spots = heroSpots, gate, seed = 977 }) {
  const { gl, camera } = useThree();
  const built = useMemo(() => {
    const n = COUNT[tier.name] ?? COUNT.medium;
    const rng = mulberry32(seed);
    const pos = new Float32Array(n * 3);
    const info = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const [x, z, near] = spots(rng, i, n);
      pos.set([x, 0, z], i * 3);
      info.set([near ? 9 + rng() * 14 : 7 + rng() * 14, rng(), 3 + rng() * 5, near ? 0.2 + rng() * 1.2 : 0.1 + rng() * 0.9], i * 4);
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
        uSun: { value: SUN_DIR.clone() },
        uScale: { value: 500 },
        uLevel: { value: 1 },
        uNight: shared.uNight,
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
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
    if (!reducedMotion()) u.uTime.value += Math.min(delta, 0.1);
    gl.getDrawingBufferSize(buf);
    u.uScale.value = (buf.y * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    u.uLevel.value = T.sandDrift * (1 + shared.uNight.value * 0.3) * Math.min(J.dust, 1.2) * (gate ? gate(J.progress) : 1);
    if (ref.current) ref.current.visible = u.uLevel.value > 0.001;
  });

  return <points ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} renderOrder={3} />;
}
