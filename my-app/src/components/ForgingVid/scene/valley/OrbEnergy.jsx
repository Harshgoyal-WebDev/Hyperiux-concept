"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TREE } from "../../world/oasis";
import { cubeY } from "../../world/oasisCamera";
import { mulberry32 } from "../../world/layout";
import { T } from "../../tuning";
import { reducedMotion } from "../hero/heroState";

// Scene 03's energy orb, on top of the core's own (scene/oasis/CoreOrb.jsx:
// its threads of motes, its halo, the cube in it): so it reads as a
// concentrated source of energy, not a flat glowing ball —
//   plasma – a shell of churning energy over it: bands of light sliding and
//            folding through it, white-hot at its heart, orange at its rim,
//            its edge wavering a little (surface distortion), its
//            brightness flickering slowly
//   glow   – a wide soft glow round it
//   sparks – fine sparks circulating round it on tilted orbits
//   light  – its light on the ground round it (world/materials.js uOrbLight)
// All with the core's own showing and bursting (CoreOrb's timing).
const sm = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const SPARKS = { high: 420, medium: 280, low: 140 };
const AMBER = new THREE.Color("#ff8a35");

const SHELL_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uR;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  vec3 p = position;
  // (its edge wavering)
  p *= 1.0 + 0.035 * sin(p.x * 3.1 + uTime * 1.7) * sin(p.y * 2.7 - uTime * 1.3) * sin(p.z * 3.3 + uTime * 1.1);
  vec4 mv = modelViewMatrix * vec4(p * uR, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  vP = position;
  gl_Position = projectionMatrix * mv;
}
`;
const SHELL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
float h3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float n3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main() {
  vec3 n = vN / max(length(vN), 1e-4);
  vec3 v = vV / max(length(vV), 1e-4);
  float facing = clamp(abs(dot(n, v)), 0.0, 1.0);
  // bands of energy sliding and folding through it
  vec3 q = vP * 2.4;
  float w = n3(q + vec3(0.0, uTime * 0.35, uTime * 0.2));
  float bands = abs(sin((vP.y * 5.0 + w * 4.0 - uTime * 0.9) * 1.3));
  float filaments = pow(1.0 - bands, 6.0) * (0.6 + 0.4 * n3(q * 2.0 - uTime * 0.4));
  // white-hot at its heart, orange towards its rim
  vec3 hot = vec3(1.0, 0.88, 0.66);
  vec3 col = mix(uColor, hot, pow(facing, 3.0));
  float flicker = 0.88 + 0.12 * sin(uTime * 2.1) * sin(uTime * 0.77 + 1.0);
  float a = (filaments * 0.9 + pow(facing, 4.0) * 0.35 + pow(1.0 - facing, 3.0) * 0.5) * flicker * uLevel;
  gl_FragColor = vec4(col * a * 3.0, a);
}
`;

const SPARK_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec3 uC;
uniform float uR;
uniform float uScale;
uniform float uLevel;
attribute vec4 aOrbit; // radius (× R), speed (rad/s), phase, tilt seed
varying float vA;
void main() {
  float a = aOrbit.z + uTime * aOrbit.y;
  float r = aOrbit.x * uR;
  vec3 p = vec3(cos(a) * r, sin(a * 2.0 + aOrbit.w * 6.0) * r * 0.12, sin(a) * r);
  // (each on its own tilted orbit)
  float t1 = aOrbit.w * 3.14159;
  float t2 = fract(aOrbit.w * 7.3) * 1.2 - 0.6;
  p = vec3(p.x, p.y * cos(t2) - p.z * sin(t2), p.y * sin(t2) + p.z * cos(t2));
  p = vec3(p.x * cos(t1) - p.z * sin(t1), p.y, p.x * sin(t1) + p.z * cos(t1));
  vec4 mv = modelViewMatrix * vec4(uC + p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.1);
  float px = 0.12 * uScale / dist;
  float a0 = 1.0;
  if (px < 1.2) { a0 = px / 1.2; px = 1.2; }
  gl_PointSize = min(px, 10.0);
  vA = a0 * (0.5 + 0.5 * sin(uTime * 3.0 + aOrbit.z * 9.0)) * uLevel;
}
`;
const SPARK_FRAGMENT = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vec3(1.0, 0.65, 0.32) * 2.6 * m * vA, m * vA);
}
`;

function glowTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.3, "rgba(255,255,255,0.35)");
  g.addColorStop(0.65, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function OrbEnergy({ J, tier, shared }) {
  const { gl, camera } = useThree();
  const built = useMemo(() => {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uR: { value: 6 }, uLevel: { value: 0 }, uColor: { value: new THREE.Color("#ff6a1a") } },
        vertexShader: SHELL_VERTEX,
        fragmentShader: SHELL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    shell.renderOrder = 6;
    const map = glowTexture();
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: new THREE.Color("#ff7a2a"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.renderOrder = 5;
    const n = SPARKS[tier.name] ?? SPARKS.medium;
    const rng = mulberry32(1433);
    const orbit = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) orbit.set([1.15 + rng() * rng() * 1.3, (0.25 + rng() * 0.6) * (rng() < 0.5 ? -1 : 1), rng() * Math.PI * 2, rng()], i * 4);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    sg.setAttribute("aOrbit", new THREE.BufferAttribute(orbit, 4));
    const sparks = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uC: { value: new THREE.Vector3() }, uR: { value: 6 }, uScale: { value: 500 }, uLevel: { value: 0 } },
        vertexShader: SPARK_VERTEX,
        fragmentShader: SPARK_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    sparks.frustumCulled = false;
    return { shell, glow, map, sparks };
  }, [tier]);
  useEffect(
    () => () => {
      built.shell.geometry.dispose();
      built.shell.material.dispose();
      built.glow.material.dispose();
      built.map.dispose();
      built.sparks.geometry.dispose();
      built.sparks.material.dispose();
    },
    [built]
  );

  const clock = useRef(0);
  const buf = useMemo(() => new THREE.Vector2(), []);
  useFrame((_, delta) => {
    const p = J.progress;
    // (the core's own timing: shown from T.tlOrbShow, gone as it bursts)
    const show = sm(T.tlOrbShow - 0.01, T.tlOrbShow, p);
    const burst = THREE.MathUtils.clamp((p - T.tlBeamToTreeEnd) / Math.max(T.orbBurstSpan, 0.002), 0, 1);
    const whole = 1 - sm(0, 0.35, burst);
    // (by night the brightest thing in the desert: brighter, warmer)
    const night = shared.uNight.value;
    const level = show * whole * T.orbEnergy * (1 + night * 0.6);
    const on = level > 0.001;
    built.shell.visible = built.glow.visible = built.sparks.visible = on;
    shared.uOrbLight.value.w = on ? level * T.orbSandLight * (1 + night * 1.4) : 0;
    if (!on) return;
    if (!reducedMotion()) clock.current += Math.min(delta, 0.1);
    const t = clock.current;
    const R = T.orbRadius;
    const c = shared.uOrbLight.value;
    c.x = TREE.x;
    c.y = cubeY();
    c.z = TREE.z;
    const centre = built.shell.position.set(c.x, c.y, c.z);
    const su = built.shell.material.uniforms;
    su.uTime.value = t;
    su.uR.value = R * 1.02;
    su.uLevel.value = level;
    su.uColor.value.set(T.orbColor).lerp(AMBER, night * 0.6);
    built.glow.position.copy(centre);
    built.glow.scale.setScalar(R * 10 * (1 + 0.05 * Math.sin(t * 1.3)));
    built.glow.material.opacity = Math.min(0.5 * level, 0.85);
    built.glow.material.color.set(T.orbColor).lerp(AMBER, night * 0.6);
    const pu = built.sparks.material.uniforms;
    pu.uTime.value = t;
    pu.uC.value.copy(centre);
    pu.uR.value = R;
    pu.uLevel.value = level;
    gl.getDrawingBufferSize(buf);
    pu.uScale.value = (buf.y * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  });

  return (
    <>
      <primitive object={built.glow} />
      <primitive object={built.shell} />
      <primitive object={built.sparks} />
    </>
  );
}
