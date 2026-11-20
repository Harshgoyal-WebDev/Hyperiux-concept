"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { T } from "../../tuning";
import { TREE, WATER_Y } from "../../world/oasis";
import { cubeY } from "../../world/oasisCamera";
import { NO_MIRROR_LAYER } from "../../config";

// The orb's burst as a rain of sparks (after the reference, hyperiux-concepts
// V6, and the user's frames of it): as the beam touches it, the ball lets go
// in a dense curtain of fine glowing streaks of light that fall off it —
// its underside first, the rest after — and as each hits the ground it skids
// on outwards, a short glowing streak slowing as it goes, so the light
// spreads from under the orb out over the whole island and on over the
// water: a wide disc of it, densest at its middle and thinning away at its
// edge (no ring, no patch), fading as the tree comes up.
//
// Every spark's place is a pure function of the burst's clock (the scroll:
// from tuning.js tlBeamToTreeEnd over T.orbBurstSpan) worked out in the
// vertex shader — scrolling back plays it back; only a faint flicker runs on
// real time. Each spark is drawn as a short streak from where it was a
// moment of the clock before, so even a still frame reads as motion.

// tunables (local: tuning.js is someone else's)
export const RAIN = {
  count: { low: 12000, medium: 22000, high: 34000 },
  from: 0.0, // first sparks leave as the beam touches (share of the burst)
  spread: 0.42, // ...and the last this much of the burst later (most of them early: the curtain is densest as the reveal sets off)
  fall: 0.2, // how long a spark takes to fall from the top of the orb to the ground (share of the burst)
  skid: 0.34, // how long it skids on over the ground, slowing, before it is gone (share of the burst; ± 30%)
  drift: 4.5, // how far out it drifts as it falls (m, at most)
  reach: 40, // the skidded sparks' spread over the ground (m: the disc's soft radius, a gaussian's sigma)
  glow: 2.4, // brightness
  width: 0.07, // a spark's width (m)
};

const VERTEX = /* glsl */ `
attribute vec4 aO; // where it leaves the orb: direction (xyz), share of the radius (w)
attribute vec4 aT; // when it leaves (share of the burst), fall time factor, skid time factor, seed
attribute vec4 aG; // drift out as it falls (m), how far out it skids (m), its curl, brightness
uniform float uTime;
uniform vec3 uC;
uniform float uR;
uniform float uBurst;
uniform float uFall;
uniform float uSkid;
uniform float uWidth;
uniform float uGain;
uniform float uAspect;
uniform float uPx;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec3 vCol;
varying vec2 vQ;
varying float vL;

// the island's ground (world/oasis.js floorHeight: barely above the lake,
// rising to the trunk's foot), and the water's skin beyond it
float groundY(float r) {
  return max(${WATER_Y.toFixed(3)} + 0.08 + 0.7 * (1.0 - smoothstep(6.0, 42.0, r)), ${WATER_Y.toFixed(3)} + 0.22) + 0.14;
}

// where the spark is at burst b, and how lit
vec3 sparkAt(float b, out float lit) {
  float age = b - aT.x;
  if (age <= 0.0) { lit = 0.0; return uC; }
  vec3 o = uC + aO.xyz * uR * aO.w;
  vec2 rd = aO.xz;
  float rl = length(rd);
  vec2 dir = rl > 1e-3 ? rd / rl : vec2(cos(aT.w * 6.2831), sin(aT.w * 6.2831));
  // where it lands: a little further out than where it left
  float r0 = rl * uR * aO.w;
  float rL = r0 + aG.x;
  float gL = groundY(rL);
  // (falling from rest: the higher it leaves, the longer it falls)
  float h = max(o.y - gL, 0.3);
  float tf = uFall * aT.y * sqrt(h / 14.0);
  float k = age / tf;
  if (k < 1.0) {
    vec3 p;
    p.xz = uC.xz + dir * mix(r0, rL, k);
    p.y = mix(o.y, gL, k * k);
    // (lighting up as it leaves the ball, brightest as it comes down)
    lit = smoothstep(0.0, 0.25, k) * (0.8 + 0.7 * k);
    return p;
  }
  // skidding out over the ground, fast at first and slowing, curling a little
  float x = clamp((age - tf) / (uSkid * aT.z), 0.0, 1.0);
  float rF = max(aG.y, rL + 3.0);
  float e = 1.0 - pow(1.0 - x, 3.0);
  float r = mix(rL, rF, e);
  float a = atan(dir.y, dir.x) + aG.z * e;
  vec3 p = vec3(uC.x + cos(a) * r, groundY(r), uC.z + sin(a) * r);
  // (a flash as it hits, then a glow dimming as it slows, gone by its stop)
  lit = (1.9 * exp(-9.0 * x) + 0.75) * (1.0 - smoothstep(0.4, 1.0, x));
  return p;
}

void main() {
  float lit;
  vec3 p1 = sparkAt(uBurst, lit);
  float bright = aG.w * lit * uGain * (0.8 + 0.2 * sin(uTime * (3.0 + 4.0 * aT.w) + aT.w * 50.0));
  if (bright < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // where it was a moment of the clock before: a streak along its motion
  // (longer while it falls — the curtain's rain — shorter as it skids)
  float lit0;
  vec3 p0 = sparkAt(max(uBurst - 0.012, aT.x + 1e-4), lit0);
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 c1 = vp * vec4(p1, 1.0);
  vec4 c0 = vp * vec4(p0, 1.0);
  if (c1.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (c0.w < 0.05) c0 = c1;
  vec2 s1 = c1.xy / c1.w;
  vec2 s0 = c0.xy / c0.w;
  vec2 d = (s1 - s0) * vec2(uAspect, 1.0);
  float len = length(d);
  if (len > 0.06) { s0 = s1 - (s1 - s0) * (0.06 / len); d *= 0.06 / len; len = 0.06; }
  vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float wr = uWidth * (0.6 + 0.8 * fract(aT.w * 13.7)) * projectionMatrix[1][1] / c1.w;
  wr = min(wr, 0.008);
  float w = max(wr, uPx * 0.9);
  bright *= clamp(wr / w, 0.45, 1.0);
  float x = position.x;
  float y = position.y;
  vec4 cc = mix(c0, c1, x);
  vec2 off2 = (nrm * y + dir * (x * 2.0 - 1.0)) * w;
  off2.x /= uAspect;
  gl_Position = vec4((mix(s0, s1, x) + off2) * cc.w, cc.z, cc.w);
  vL = len / w;
  vQ = vec2(mix(-1.0, vL + 1.0, x), y);
  // amber: hot and pale where it is brightest (falling, and as it hits)
  vCol = mix(uColor, uHot, clamp(0.6 + 0.25 * lit, 0.0, 1.0)) * bright / (1.0 + 0.06 * vL);
}
`;
const FRAGMENT = /* glsl */ `
varying vec3 vCol;
varying vec2 vQ;
varying float vL;
void main() {
  // a soft capsule, brightest at its head
  float dx = max(-vQ.x, 0.0) + max(vQ.x - vL, 0.0);
  float r = length(vec2(dx, vQ.y));
  if (r > 1.0) discard;
  float a = 1.0 - smoothstep(0.1, 1.0, r);
  float head = mix(0.25, 1.0, clamp(vQ.x / max(vL, 1e-3), 0.0, 1.0));
  gl_FragColor = vec4(vCol * a * a * head * 0.5, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// a final radius over the ground: a disc, densest in the middle and thinning
// away (per area: a gaussian of sigma `reach`, cut off far out)
export function skidRadius(u, reach) {
  return reach * Math.sqrt(-2 * Math.log(1 - u * 0.985));
}

function buildSparks(n) {
  const O = new Float32Array(n * 4);
  const Tm = new Float32Array(n * 4);
  const G = new Float32Array(n * 4);
  let seed = 4242;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    // off the ball, more from its lower half (it drains downwards)
    do v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    while (v.lengthSq() > 1 || v.lengthSq() < 1e-4);
    v.normalize();
    if (v.y > 0 && rnd() < 0.45) v.y = -v.y;
    const depth = 0.55 + 0.45 * Math.sqrt(rnd());
    O.set([v.x, v.y, v.z, depth], i * 4);
    // when it leaves: its underside first, the rest after, over the burst
    const low = (v.y * depth + 1) / 2;
    const u = rnd();
    const leave = RAIN.from + RAIN.spread * Math.min(Math.max(0.55 * Math.pow(u, 1.6) + 0.45 * low * (0.6 + 0.4 * u), 0), 1);
    Tm.set([leave, 0.8 + 0.45 * rnd(), 0.7 + 0.6 * rnd(), rnd()], i * 4);
    // where it skids to: anywhere on the disc, a soft edge
    const out = Math.pow(rnd(), 0.7) * RAIN.drift;
    const far = skidRadius(rnd(), RAIN.reach);
    const curl = (rnd() - 0.5) * 0.35;
    G.set([out, far, curl, 0.45 + 0.55 * rnd()], i * 4);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute("aO", new THREE.InstancedBufferAttribute(O, 4));
  g.setAttribute("aT", new THREE.InstancedBufferAttribute(Tm, 4));
  g.setAttribute("aG", new THREE.InstancedBufferAttribute(G, 4));
  g.instanceCount = n;
  return g;
}

export default function OrbRain({ J, shared, tier }) {
  const { gl, size } = useThree();
  const parts = useMemo(() => {
    const n = RAIN.count[tier?.name] ?? RAIN.count.high;
    const u = {
      uTime: shared.uTime,
      uC: { value: new THREE.Vector3() },
      uR: { value: 6 },
      uBurst: { value: 0 },
      uFall: { value: RAIN.fall },
      uSkid: { value: RAIN.skid },
      uWidth: { value: RAIN.width },
      uGain: { value: 0 },
      uAspect: { value: 1 },
      uPx: { value: 0.002 },
      uColor: { value: new THREE.Color() },
      uHot: { value: new THREE.Color() },
    };
    const mesh = new THREE.Mesh(
      buildSparks(n),
      new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    // (kept out of the water's mirror: tens of thousands of streaks drawn twice)
    mesh.layers.set(NO_MIRROR_LAYER);
    return { mesh, u };
  }, [shared, tier]);
  useEffect(
    () => () => {
      parts.mesh.geometry.dispose();
      parts.mesh.material.dispose();
    },
    [parts]
  );

  useFrame(() => {
    const p = J.progress;
    const touch = T.tlBeamToTreeEnd;
    const burst = (p - touch) / Math.max(T.orbBurstSpan, 0.002);
    const on = (burst > 0 && burst < 1.0 && p > T.tlOrbShow) || J.warmup > 0;
    parts.mesh.visible = on;
    if (!on) return;
    const u = parts.u;
    u.uC.value.set(TREE.x, cubeY(), TREE.z);
    // (gathered: it has drawn in a little by the touch, CoreOrb.jsx)
    u.uR.value = T.orbRadius * 0.88;
    u.uBurst.value = Math.max(burst, 0);
    u.uFall.value = RAIN.fall;
    u.uSkid.value = RAIN.skid;
    u.uWidth.value = RAIN.width;
    // (fading out over the burst's last stretch, whatever is left)
    u.uGain.value = RAIN.glow * T.orbGlow * (1 - THREE.MathUtils.smoothstep(burst, 0.85, 1.0));
    u.uAspect.value = size.width / Math.max(size.height, 1);
    u.uPx.value = 2 / Math.max(gl.domElement.height, 1);
    u.uColor.value.set(T.orbColor);
    u.uHot.value.set(T.orbHotColor);
  });

  return <primitive object={parts.mesh} />;
}
