"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { mulberry32 } from "../../world/layout";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { sampleCube, sampleLogo3D, sampleTorus, sampleWordmark } from "../../world/logoParticles";
import { GARDEN, GARDEN_ORIGIN } from "../../config";
import { pointer } from "../../pointer";
import { T } from "../../tuning";
import { GARDEN_SUN } from "./sky";

// The garden's particle body: tens of thousands of glossy bubbles in the
// Hyperiux palette that take one form after another as the visitor scrolls —
// a swirl streaming in over the pond, the Hyperiux mark (a deep solid: the
// four shapes as slabs, the cube outline through the same depth, all one
// body), a cube, an infinity whose particles keep flowing round its loops,
// and a torus the camera flies through into the light — all over the pond's
// middle, the mark, the infinity and the torus turned to the camera as it
// revolves round them. Arriving sets off the swirl's gathering into the mark, and each
// change of section the next morph; each then plays out on its own clock
// (T.logoMorphSpeed), however slowly the visitor scrolls. How hard the
// pointer is stirring the body goes to J.logoStir (its swoosh).
//
// Every bubble is simulated on the GPU (position + glow, velocity + scatter):
//   spring   – pulled towards its place in the current form (the forms blend
//              on a per-bubble delay, so a change of form flows across the
//              body instead of snapping); stiffer the further away it is
//   flow     – carried by a divergence-free noise flow, strong while it
//              travels between forms, a slow churn once it has arrived
//   pointer  – bubbles near the cursor on screen are dragged along with its
//              movement and parted a little; a disturbed bubble "scatters":
//              its spring loosens so it drifts, then it finds its way home
//   fluid    – a light repulsion from its neighbours and a little viscosity
//              (it takes on their velocity), so the body moves as one
//   glow     – it lights up with speed, scatter and the pointer's touch,
//              quickly, and cools slowly
// Drawn as lit spheres (a soft key, a warm rim, a glossy highlight), a warm
// core glowing at the body's centre, disturbed bubbles blowing out to
// white-hot. The pond reflects it all (sizes are worked out per render
// target, so the reflection's bubbles match).

// IQ-style value noise with analytic derivatives, and a divergence-free
// flow from the cross product of two of their gradients
const NOISE_GLSL = /* glsl */ `
float pnHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
vec4 pnNoised(vec3 x) {
  vec3 i = floor(x);
  vec3 w = fract(x);
  vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);
  vec3 du = 30.0 * w * w * (w * (w - 2.0) + 1.0);
  float a = pnHash(i + vec3(0, 0, 0)), b = pnHash(i + vec3(1, 0, 0));
  float c = pnHash(i + vec3(0, 1, 0)), d = pnHash(i + vec3(1, 1, 0));
  float e = pnHash(i + vec3(0, 0, 1)), f = pnHash(i + vec3(1, 0, 1));
  float g = pnHash(i + vec3(0, 1, 1)), h = pnHash(i + vec3(1, 1, 1));
  float k0 = a, k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d;
  float k5 = a - c - e + g, k6 = a - b - e + f, k7 = -a + b + c - d + e - f - g + h;
  return vec4(
    k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
    du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y)
  );
}
vec3 pnFlow(vec3 p) {
  return cross(pnNoised(p).yzw, pnNoised(p + vec3(31.4, 17.7, 9.2)).yzw);
}
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
`;

// where a bubble belongs in form i (garden metres)
const FORMS_GLSL = /* glsl */ `
uniform sampler2D tMark; // the mark (xyz), kind (w)
uniform sampler2D tWord; // the wordmark (the footer's form, in the mark's place)
uniform float uWord; // ...how far the mark has become it
uniform sampler2D tCube;
uniform sampler2D tCloud; // the infinity: place along it (0..1), round its tube (rad), how far out in the tube (0..1), pace
uniform float uInfFlow; // how far round the infinity its particles have flowed (loops)
uniform float uInfSize; // its half-width (m)
uniform float uInfTube; // its tube's radius (m)
uniform float uInfRate; // loops a second the flow runs at
// a point of the infinity (its own space) for particle data F, the flow at flow
vec3 infinityLocal(vec4 F, float flow) {
  // a lemniscate tube, its particles flowing on round its loops (each at
  // its own pace), the crossing passing over itself
  float t = 6.2831853 * (F.x + flow * F.w);
  float s0 = sin(t), c0 = cos(t);
  vec2 c = vec2(c0, s0 * c0) / (1.0 + s0 * s0) * uInfSize;
  float t1 = t + 0.01;
  float s1 = sin(t1), c1 = cos(t1);
  vec2 tg = normalize(vec2(c1, s1 * c1) / (1.0 + s1 * s1) * uInfSize - c);
  vec3 nrm = vec3(-tg.y, tg.x, 0.0);
  float r = uInfTube * F.z;
  return vec3(c, s0 * uInfSize * 0.12) + (nrm * cos(F.y) + vec3(0.0, 0.0, 1.0) * sin(F.y)) * r;
}
uniform sampler2D tRing;
uniform sampler2D tSwirl; // how far out (pond radii), angle, height seed, pace
uniform vec2 uPondAxes; // the pond's semi-axes (m)
uniform vec3 uCentre[5];
uniform float uYaw[5];
uniform float uScale[5];
uniform float uTilt;
uniform float uClock;
uniform float uWaterY;
vec3 formPos(int i, vec2 uv) {
  if (i == 0) {
    // the swirl: a ribbon streaming round over the pond
    // scattered low over the whole pond and the grass round it, drifting
    // slowly, a little higher over the banks (just over the grass)
    vec4 S = texture2D(tSwirl, uv);
    float ang = S.y + uClock * S.w * 0.4 / max(S.x, 0.3);
    vec2 xz = vec2(cos(ang), sin(ang)) * S.x * uPondAxes;
    float bank = smoothstep(0.9, 1.15, S.x);
    float y = uWaterY + 0.35 + S.z * 0.6 + bank * (1.3 + S.z * 0.8) + sin(ang * 3.0 + S.x * 5.0 + uClock) * 0.15;
    return vec3(uCentre[0].x + xz.x, y, uCentre[0].z + xz.y);
  }
  vec3 p;
  if (i == 3) p = infinityLocal(texture2D(tCloud, uv), uInfFlow);
  else if (i == 1) p = mix(texture2D(tMark, uv).xyz, texture2D(tWord, uv).xyz, uWord);
  else p = i == 2 ? texture2D(tCube, uv).xyz : texture2D(tRing, uv).xyz;
  return uCentre[i] + rotY(rotX(p * uScale[i], uTilt), uYaw[i]);
}
// how fast a bubble's place in the infinity is moving (m/s): the flow
vec3 infinityVel(vec2 uv) {
  vec4 F = texture2D(tCloud, uv);
  float h = 0.01;
  vec3 d = (infinityLocal(F, uInfFlow + uInfRate * h) - infinityLocal(F, uInfFlow)) / h;
  return rotY(rotX(d * uScale[3], uTilt), uYaw[3]);
}
`;

const VELOCITY = /* glsl */ `
uniform sampler2D tSeed; // delay, radius, colour, spark
uniform float uDt;
uniform float uTime;
uniform float uShapeT;
uniform float uStagger; // share of a morph the bubbles' starts are spread over
uniform float uWhirl; // how far the whirlwind winds the gathering bubbles round the mark (rad)
uniform float uPull; // extra pull on a bubble far from its place (so a morph lands quickly)
uniform float uSpring;
uniform float uDamping;
uniform float uFlow;
uniform float uFlowScale;
uniform float uViscosity;
uniform float uRepulsion;
uniform float uScatterTime;
uniform mat4 uViewProj; // world → clip
uniform vec3 uOrigin; // garden → world
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTanHalf;
uniform float uAspect;
uniform vec2 uMouseUV;
uniform vec2 uMouseVel; // uv / s
uniform float uHover;
uniform float uHoverRadius; // share of the screen's height
uniform float uHoverForce;
uniform float uDrag;
${NOISE_GLSL}
${FORMS_GLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 P = texture2D(tPos, uv);
  vec4 V = texture2D(tVel, uv);
  vec4 seed = texture2D(tSeed, uv);
  vec3 pos = P.xyz;
  vec3 vel = V.xyz;
  float scatter = V.w;
  float spark = seed.w;
  float dt60 = uDt * 60.0;

  // the target: between two forms, each bubble on its own delay
  float k = clamp(uShapeT, 0.0, 4.0);
  float i0 = min(floor(k), 3.0);
  float fr = k - i0;
  float delay = seed.x * uStagger;
  float m = smoothstep(delay, delay + 1.0 - uStagger, fr);
  vec3 target = mix(formPos(int(i0), uv), formPos(int(i0) + 1, uv), m);
  float travel = sin(3.14159 * m);
  // gathering from the ground into the mark: swept up in a whirlwind round
  // it — wound round its centre (unwinding as it lands) and lifted
  if (int(i0) == 0) {
    vec3 c = uCentre[1];
    float wind = (1.0 - m) * (1.0 - m) * uWhirl + travel * 1.2;
    target = c + rotY(target - c, wind) + vec3(0.0, travel * 3.0, 0.0);
  }
  // in the infinity, carried along with its flow (so it rides the loops
  // instead of trailing behind its moving place)
  float onInf = (int(i0) == 3 ? 1.0 - m : 0.0) + (int(i0) + 1 == 3 ? m : 0.0);
  if (onInf > 0.001) vel = mix(vel, infinityVel(uv), clamp(onInf * 0.35 * dt60, 0.0, 1.0));
  // sparks drift loosely round the body
  target += spark * pnFlow(vec3(seed.x * 9.0, seed.y * 70.0, uTime * 0.05)) * 0.6;

  // the pointer: drag along with its movement, part a little
  float fluid = 0.0;
  vec4 clip = uViewProj * vec4(pos + uOrigin, 1.0);
  if (clip.w > 0.0) {
    vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
    vec2 d = suv - uMouseUV;
    d.x *= uAspect;
    float mask = (1.0 - smoothstep(uHoverRadius * 0.35, uHoverRadius, length(d))) * uHover;
    float worldH = 2.0 * clip.w * uTanHalf; // metres per screen height at this depth
    vec2 mv = vec2(uMouseVel.x * uAspect, uMouseVel.y);
    float mspeed = length(mv);
    fluid = mask * clamp(mspeed * 4.0, 0.0, 1.5);
    vec3 drag = (uCamRight * mv.x + uCamUp * mv.y) * worldH * uDrag;
    vel = mix(vel, drag, clamp(mask * 0.22 * dt60 * clamp(mspeed * 6.0, 0.0, 1.0), 0.0, 1.0));
    vec2 dn = d / max(length(d), 1e-4);
    vel += (uCamRight * dn.x + uCamUp * dn.y) * mask * uHoverForce * 2.2 * uDt;
    fluid *= uHoverForce;
  }

  // the spring (loosened while scattered or stirred)
  vec3 toT = target - pos;
  float dist = length(toT);
  float hold = smoothstep(0.0, 0.5, scatter);
  float loosen = max(max(0.3, 1.0 - fluid * 0.8) * (1.0 - hold * 0.6), 0.2);
  float springK = uSpring * mix(1.0 + dist * 0.25, 1.0, scatter) * loosen * (1.0 - spark * 0.7);
  // far from its place (mid-morph), it is pulled home hard: the heavy
  // damping would otherwise have it crawl the last metres
  springK *= 1.0 + uPull * smoothstep(0.3, 2.5, dist) * (1.0 - hold);
  vel += toT * springK * uDt;

  // the flow: strong in flight and when stirred, a slow churn at rest
  float churn = 0.25 + travel * 2.4 + fluid * 2.6 + (i0 < 0.5 ? (1.0 - m) * 1.2 : 0.0) + spark * 1.5;
  vel += pnFlow(pos * uFlowScale + vec3(0.0, 0.0, uTime * 0.25)) * uFlow * churn * 3.0 * uDt;

  // neighbours: a light repulsion, a little viscosity
  vec2 step2 = 2.0 / resolution.xy;
  vec3 rep = vec3(0.0);
  vec3 vsum = vel;
  for (int n = 0; n < 2; n++) {
    vec2 o = n == 0 ? step2 : -step2;
    vec3 diff = pos - texture2D(tPos, uv + o).xyz;
    float nd = length(diff);
    if (nd > 1e-3 && nd < 1.5) rep += diff / nd / (nd * nd + 0.05);
    vsum += texture2D(tVel, uv + o * 0.5).xyz;
  }
  vel += rep * uRepulsion * uDt;
  vel = mix(vel, vsum / 3.0, uViscosity);

  vel *= pow(uDamping, dt60);
  float sp = length(vel);
  vel *= min(1.0, 24.0 / max(sp, 1e-4));

  // scatter: rises at once when stirred, fades over uScatterTime
  float want = clamp(fluid * 2.5, 0.0, 1.0);
  scatter = want > scatter ? scatter + (want - scatter) * min(1.0, uDt * 15.0) : scatter - uDt / max(uScatterTime, 0.01);
  gl_FragColor = vec4(vel, clamp(scatter, 0.0, 1.0));
}
`;

const POSITION = /* glsl */ `
uniform float uDt;
uniform float uHover;
uniform float uSpeedGlow; // how much speed lights a bubble (low while it gathers from the ground)
uniform float uCarry; // the turn of the camera-facing form this frame (rad, about y)...
uniform vec3 uCarryAt; // ...round its centre
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 P = texture2D(tPos, uv);
  vec4 V = texture2D(tVel, uv);
  // carried round with the form as it turns to follow the camera, rather
  // than flying after it (its edges would light up with the speed)
  vec3 q = P.xyz - uCarryAt;
  float cc = cos(uCarry), cs = sin(uCarry);
  vec3 pos = uCarryAt + vec3(q.x * cc + q.z * cs, q.y, -q.x * cs + q.z * cc) + V.xyz * uDt;
  // glow: up quickly with speed / scatter, down slowly
  float speed = length(V.xyz);
  // (a morph's flight is quick: only the fastest bubbles light up from it)
  float want = clamp(clamp((speed - 6.0) * 0.12, 0.0, 1.0) * uSpeedGlow + V.w * 0.7, 0.0, 1.0);
  float glow = P.w + (want - P.w) * min(1.0, uDt * (want > P.w ? 12.0 : 2.5));
  gl_FragColor = vec4(pos, clamp(glow, 0.0, 1.0));
}
`;

const VERTEX = /* glsl */ `
attribute vec2 aRef; // its texel in the simulation
attribute vec4 aInfo; // radius (m), colour index, spark, delay
uniform sampler2D tPos;
uniform sampler2D tVel;
uniform float uScale; // pixels per metre at 1 m, for the target being drawn
uniform float uSize;
uniform float uAppear;
uniform float uShapeT;
uniform float uTau;
uniform vec3 uSunDir;
uniform vec3 uPalette[5];
uniform vec3 uCore; // the body's centre (garden metres) and how far its core glow reaches
uniform float uCoreReach;
uniform float uCoreGlow;
uniform vec3 uGlowColor;
uniform vec3 uCoreColor;
uniform float uWhiteout;
uniform float uPortal;
uniform float uSpeedGlow;
varying vec3 vColor;
varying vec3 vAdd;
varying float vBlow;
varying float vSpark;
varying vec3 vSun;
void main() {
  vec4 P = texture2D(tPos, aRef);
  vec4 V = texture2D(tVel, aRef);
  vec3 p = P.xyz + V.xyz * uTau; // a touch ahead, so motion reads smooth
  float glow = P.w;
  float scatter = V.w;
  float speed = length(V.xyz);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // a third stream in the swirl; the rest come out of the air as it forms
  float shown = smoothstep(aInfo.w * 0.6, aInfo.w * 0.6 + 0.4, uAppear) * max(step(fract(aInfo.w * 13.7), 0.33), smoothstep(0.0, 0.6, uShapeT));
  float r = aInfo.x * uSize * shown * (1.0 + glow * 0.35);
  gl_PointSize = clamp(2.0 * r * uScale / max(-mv.z, 0.1), 0.0, 96.0);
  vColor = uPalette[int(aInfo.y + 0.5)];
  float core = 1.0 - smoothstep(0.0, uCoreReach, length(p - uCore));
  core *= core;
  vAdd = uGlowColor * glow * 1.5 + uCoreColor * core * uCoreGlow + uGlowColor * smoothstep(5.0, 14.0, speed) * 0.4 * uSpeedGlow + uCoreColor * uPortal * 1.5;
  vBlow = smoothstep(0.25, 0.95, clamp(glow * 0.7 + scatter * 0.45 + smoothstep(8.0, 18.0, speed) * 0.3 * uSpeedGlow + uPortal * 0.6, 0.0, 1.0)) * uWhiteout;
  vSpark = aInfo.z;
  vSun = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uGlow;
uniform float uSpec;
uniform float uRim;
uniform vec3 uRimWarm;
uniform vec3 uRimCool;
varying vec3 vColor;
varying vec3 vAdd;
varying float vBlow;
varying float vSpark;
varying vec3 vSun;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.y = -c.y;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  // a lit sphere: soft key, darker underneath, a little light through it
  // from behind, a warm-to-cool rim, a tight glossy highlight
  vec3 n = vec3(c, sqrt(1.0 - r2));
  float ndl = max(dot(n, vSun), 0.0);
  float key = ndl * 0.4 + 0.6;
  float under = smoothstep(-0.3, 0.4, n.y) * 0.25 + 0.75;
  vec3 col = vColor * key * under * 1.15 * uGlow;
  col += vColor * (1.0 - ndl) * (1.0 - ndl) * 0.18;
  float rim = 1.0 - max(n.z, 0.0);
  col += mix(uRimWarm, uRimCool, rim * rim) * rim * rim * rim * uRim;
  vec3 h = normalize(vSun + vec3(0.0, 0.0, 1.0));
  col += vec3(1.0, 0.97, 0.92) * pow(max(dot(n, h), 0.0), 48.0) * 0.6 * uSpec;
  col += vAdd;
  col = mix(col, vColor * 3.0, vSpark);
  // stirred bubbles blow out to white-hot
  col = mix(col, vec3(1.8, 1.7, 1.55), vBlow);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// the infinity's particles: where along it each starts (0..1), where round
// its tube (rad), how far out in the tube (most near its skin), its pace
function sampleInfinity(count, rng) {
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) out.set([rng(), rng() * Math.PI * 2, Math.sqrt(0.15 + 0.85 * rng()), 0.85 + rng() * 0.3], i * 4);
  return out;
}

function dataTexture(size, data) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
const pack = (count, xyz, w = null) => {
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) out.set([xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2], w ? w[i] : 0], i * 4);
  return out;
};

// The bubbles' data (CPU) and how they are drawn; the simulation itself is
// made by createSim, in an effect, so it lives exactly as long as the mount.
function build(tier) {
  const size = Math.ceil(Math.sqrt(tier.logoPoints));
  const count = size * size;
  const rng = mulberry32(2024);
  // (big and deep: a solid you can see round as the camera circles it)
  const logo = sampleLogo3D(count, { height: 10.5, thickness: 2.6 });
  const forms = {
    mark: pack(count, logo.positions, logo.kinds),
    cube: pack(count, sampleCube(count, { size: 7.2 })),
    cloud: sampleInfinity(count, rng),
    ring: pack(count, sampleTorus(count, { radius: 5.8, tube: 1.5 })),
  };
  const waterY = GARDEN.water;
  const swirl = new Float32Array(count * 4);
  const seed = new Float32Array(count * 4);
  const ref = new Float32Array(count * 2);
  const info = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // scattered over the pond and the grass round it (out to 1.55 pond
    // radii, evenly over the area)
    swirl.set([Math.sqrt(rng()) * 1.55, rng() * Math.PI * 2, rng(), 0.7 + rng() * 0.6], i * 4);
    const spark = rng() < 0.02 ? 1 : 0;
    const delay = rng();
    // bubbles: mostly small, a few big ones; sparks tiny
    const radius = spark ? 0.018 + rng() * 0.012 : 0.035 + Math.pow(rng(), 2.6) * 0.13;
    // the palette (0–3), all through the mark (its cube is part of it)
    const colour = Math.floor(Math.pow(rng(), 1.3) * 4);
    seed.set([delay, radius, colour, spark], i * 4);
    ref.set([((i % size) + 0.5) / size, (Math.floor(i / size) + 0.5) / size], i * 2);
    info.set([radius, colour, spark, delay], i * 4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aRef", new THREE.BufferAttribute(ref, 2));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tPos: { value: null },
      tVel: { value: null },
      uScale: { value: 1000 },
      uSize: { value: 1 },
      uAppear: { value: 0 },
      uShapeT: { value: 0 },
      uTau: { value: 0.016 },
      uSunDir: { value: GARDEN_SUN.clone() },
      uPalette: { value: Array.from({ length: 5 }, () => new THREE.Color()) },
      uCore: { value: new THREE.Vector3() },
      uCoreReach: { value: 4 },
      uCoreGlow: { value: 0.6 },
      uGlowColor: { value: new THREE.Color("#ffb070") },
      uCoreColor: { value: new THREE.Color("#ffd9b0") },
      uWhiteout: { value: 1 },
      uPortal: { value: 0 },
      uSpeedGlow: { value: 1 },
      uGlow: { value: 1 },
      uSpec: { value: 1 },
      uRim: { value: 0.6 },
      uRimWarm: { value: new THREE.Color("#ffb066") },
      uRimCool: { value: new THREE.Color("#ffe6cc") },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  // sizes for whichever target is being drawn (the screen or the pond's
  // reflection, which is smaller)
  const buf = new THREE.Vector2();
  points.onBeforeRender = (renderer, _scene, cam) => {
    const rt = renderer.getRenderTarget();
    const h = rt ? rt.height : renderer.getDrawingBufferSize(buf).y;
    material.uniforms.uScale.value = (h * cam.projectionMatrix.elements[5]) / 2;
    material.uniformsNeedUpdate = true;
  };
  return { size, count, forms, swirl, seed, waterY, geometry, material, points };
}

function createSim(gl, data, time) {
  const { size, count, forms, swirl, seed, waterY, tier } = data;
  const gpu = new GPUComputationRenderer(size, size, gl);
  if (tier.name === "low") gpu.setDataType(THREE.HalfFloatType);
  const pos0 = gpu.createTexture();
  const vel0 = gpu.createTexture();
  // start in the swirl
  for (let i = 0; i < count; i++) {
    const r = swirl[i * 4];
    const a = swirl[i * 4 + 1];
    const hs = swirl[i * 4 + 2];
    const ax = GARDEN.pondGlbAxes[0] * T.pondSize;
    const az = GARDEN.pondGlbAxes[1] * T.pondSize;
    const bank = THREE.MathUtils.smoothstep(r, 0.9, 1.15);
    pos0.image.data.set([GARDEN.pond.x + Math.cos(a) * r * ax, waterY + 0.35 + hs * 0.6 + bank * (1.3 + hs * 0.8), GARDEN.pond.z + Math.sin(a) * r * az, 0], i * 4);
  }
  const velVar = gpu.addVariable("tVel", VELOCITY, vel0);
  const posVar = gpu.addVariable("tPos", POSITION, pos0);
  gpu.setVariableDependencies(velVar, [posVar, velVar]);
  gpu.setVariableDependencies(posVar, [posVar, velVar]);
  const S = GARDEN.shapes;
  const forms_ = {
    tMark: { value: dataTexture(size, forms.mark) },
    // (the mark's own places until the wordmark's SVG has loaded)
    tWord: { value: dataTexture(size, forms.mark) },
    uWord: { value: 0 },
    tCube: { value: dataTexture(size, forms.cube) },
    tCloud: { value: dataTexture(size, forms.cloud) },
    tRing: { value: dataTexture(size, forms.ring) },
    tSwirl: { value: dataTexture(size, swirl) },
    uCentre: { value: [GARDEN.pond.clone(), S.mark.clone(), S.cube.clone(), S.cloud.clone(), S.ring.clone()] },
    uYaw: { value: [0, 0, 0, 0, 0] },
    uScale: { value: [1, 1, 1, 1, 1] },
    uTilt: { value: 0 },
    uClock: { value: 0 },
    uInfFlow: { value: 0 },
    uInfSize: { value: 8 },
    uInfTube: { value: 1.4 },
    uInfRate: { value: 0.06 },
    uWaterY: { value: waterY },
    uPondAxes: { value: new THREE.Vector2(...GARDEN.pondGlbAxes) },
    uWhirl: { value: 5 },
    uSpeedGlow: { value: 1 },
  };
  const simU = {
    ...forms_,
    tSeed: { value: dataTexture(size, seed) },
    uDt: { value: 0.016 },
    uTime: time,
    uShapeT: { value: 0 },
    uSpring: { value: 14 },
    uDamping: { value: 0.9 },
    uFlow: { value: 1 },
    uFlowScale: { value: 0.35 },
    uViscosity: { value: 0.25 },
    uRepulsion: { value: 0.02 },
    uScatterTime: { value: 1.6 },
    uViewProj: { value: new THREE.Matrix4() },
    uOrigin: { value: GARDEN_ORIGIN.clone() },
    uCamRight: { value: new THREE.Vector3(1, 0, 0) },
    uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    uTanHalf: { value: 0.4 },
    uAspect: { value: 1.6 },
    uMouseUV: { value: new THREE.Vector2(-10, -10) },
    uMouseVel: { value: new THREE.Vector2() },
    uHover: { value: 0 },
    uHoverRadius: { value: 0.1 },
    uHoverForce: { value: 1 },
    uDrag: { value: 1 },
    uStagger: { value: 0.3 },
    uPull: { value: 4 },
    uCarry: { value: 0 },
    uCarryAt: { value: new THREE.Vector3() },
  };
  Object.assign(velVar.material.uniforms, simU);
  posVar.material.uniforms.uDt = simU.uDt;
  posVar.material.uniforms.uHover = simU.uHover;
  posVar.material.uniforms.uSpeedGlow = simU.uSpeedGlow;
  posVar.material.uniforms.uCarry = simU.uCarry;
  posVar.material.uniforms.uCarryAt = simU.uCarryAt;
  const error = gpu.init();
  if (error) {
    console.error(`[forging-concept] particle body: ${error}`);
    gpu.dispose();
    return null;
  }
  return { gpu, velVar, posVar, simU };
}

// which forms turn to face the camera (the swirl, the mark, the cube, the
// infinity, the torus)
const FACES_CAMERA = [0, 1, 0, 1, 1];
const WORDMARK_SVG = "/assets/icons/hyperiux-wordmark.svg";

export default function ParticleLogo({ J, tier, time }) {
  const { gl, camera, size } = useThree();
  const built = useMemo(() => build(tier), [tier]);
  const sim = useRef(null);

  useEffect(() => {
    sim.current = createSim(gl, { ...built, tier }, time);
    return () => {
      const s = sim.current;
      sim.current = null;
      if (!s) return;
      s.gpu.dispose();
      for (const k of ["tMark", "tWord", "tCube", "tCloud", "tRing", "tSwirl", "tSeed"]) s.simU[k].value.dispose();
    };
  }, [gl, built, tier, time]);

  // the footer's form: the Hyperiux wordmark, sampled from its SVG
  useEffect(() => {
    let live = true;
    fetch(WORDMARK_SVG)
      .then((r) => r.text())
      .then((text) => {
        const sm = sim.current;
        if (!live || !sm) return;
        const positions = sampleWordmark(built.count, text, SVGLoader, { width: 20 });
        sm.simU.tWord.value.dispose();
        sm.simU.tWord.value = dataTexture(built.size, pack(built.count, positions));
      })
      .catch((e) => console.warn("[forging-concept] wordmark", e));
    return () => {
      live = false;
    };
  }, [built, gl, tier, time]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  const s = useMemo(
    () => ({
      uv: new THREE.Vector2(-10, -10),
      lastUV: new THREE.Vector2(-10, -10),
      vel: new THREE.Vector2(),
      tmp: new THREE.Vector2(),
      hover: 0,
      lean: 0,
      tilt: 0,
      form: 0,
      cam: new THREE.Vector3(),
      ndc: new THREE.Vector3(),
      core: new THREE.Vector3(),
      facing: null,
      age: 0,
      word: 0,
    }),
    []
  );

  useFrame((_, delta) => {
    const sm = sim.current;
    if (!sm || !J.inGarden) return;
    const dt = Math.min(delta, 1 / 30);
    s.age += dt;
    const u = sm.simU;
    u.uDt.value = dt;
    u.uClock.value += dt * T.logoSwirlSpeed;
    u.uInfFlow.value += dt * T.logoInfinitySpeed;
    u.uInfRate.value = T.logoInfinitySpeed;
    u.uInfSize.value = T.logoInfinitySize;
    u.uInfTube.value = T.logoInfinityTube;
    // the form: the scroll gathers the swirl into the mark; past it, the
    // section sets the form and the morph runs at its own pace
    const goal = J.shapeT < 0.12 ? 0 : Math.max(1, Math.round(J.shapeT));
    const step = (s.form < 1 && goal <= 1 ? T.logoGatherSpeed : T.logoMorphSpeed) * dt;
    s.form += THREE.MathUtils.clamp(goal - s.form, -step, step);
    J.formT = s.form;
    u.uShapeT.value = s.form;
    // in the footer the mark flows into the wordmark (and back out of it)
    s.word += ((J.footer > 0.5 ? 1 : 0) - s.word) * (1 - Math.exp(-dt * T.footerMorph));
    u.uWord.value = s.word;
    // (the gathering from the ground runs at its own pace, the bubbles
    // swept up a few at a time, like a gust)
    u.uStagger.value = s.form < 1 ? Math.max(T.logoMorphStagger, T.logoGatherStagger) : T.logoMorphStagger;
    u.uWhirl.value = T.logoGatherWhirl;
    u.uPondAxes.value.set(GARDEN.pondGlbAxes[0] * T.pondSize, GARDEN.pondGlbAxes[1] * T.pondSize);
    u.uPull.value = T.logoMorphPull;
    u.uSpring.value = T.logoSpring;
    u.uDamping.value = T.logoDamping;
    u.uFlow.value = T.logoFlow;
    u.uViscosity.value = T.logoViscosity;
    u.uRepulsion.value = T.logoRepulsion;
    u.uScatterTime.value = T.logoScatterTime;
    u.uHoverRadius.value = T.logoHoverRadius;
    u.uHoverForce.value = T.logoHoverForce;
    u.uDrag.value = T.logoDrag;

    // the camera, for the pointer's screen-space touch
    u.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    u.uCamRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
    u.uCamUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
    u.uTanHalf.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    u.uAspect.value = size.width / Math.max(size.height, 1);

    // the pointer in screen uv, and how fast it is moving (uv / s)
    if (pointer.active) {
      s.uv.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
      if (s.lastUV.x < -5) s.lastUV.copy(s.uv);
      s.tmp.subVectors(s.uv, s.lastUV).divideScalar(Math.max(dt, 1e-3));
      s.lastUV.copy(s.uv);
    } else s.tmp.set(0, 0);
    s.vel.lerp(s.tmp, 1 - Math.exp(-dt * 20));
    u.uMouseUV.value.copy(s.uv);
    u.uMouseVel.value.copy(s.vel);
    s.hover += ((pointer.active ? 1 : 0) - s.hover) * (1 - Math.exp(-dt / 0.2));
    u.uHover.value = s.hover * J.pAppear * (1 - J.portal);

    // the stir (for its swoosh): the pointer moving over the body on screen
    s.ndc.copy(s.core).add(GARDEN_ORIGIN);
    const depth = s.ndc.distanceTo(camera.position);
    s.ndc.project(camera);
    const reach = (5.2 * T.logoScale) / Math.max(depth * u.uTanHalf.value, 1e-3); // the body's radius, in NDC heights
    const off = Math.hypot((pointer.x - s.ndc.x) * u.uAspect.value, pointer.y - s.ndc.y);
    const over = s.ndc.z < 1 ? 1 - THREE.MathUtils.smoothstep(off, reach * 0.6, reach * 1.05) : 0;
    J.logoStir = over * Math.min(s.vel.length() * 1.6, 1) * u.uHover.value;

    // each form turned to its view: the mark faces the camera as it revolves,
    // leaning a little to the pointer; the cube turns slowly; the infinity
    // and the torus face the camera, the torus opening wide as the camera
    // goes through
    const k = 1 - Math.exp(-dt * 3);
    s.lean += ((pointer.active ? pointer.x : 0) * 0.18 - s.lean) * k;
    s.tilt += ((pointer.active ? -pointer.y : 0) * 0.08 - s.tilt) * k;
    s.cam.copy(camera.position).sub(GARDEN_ORIGIN).sub(GARDEN.shapes.mark);
    const facing = Math.atan2(s.cam.x, s.cam.z);
    const yaw = u.uYaw.value;
    yaw[1] = facing + THREE.MathUtils.degToRad(T.logoYaw) + s.lean + Math.sin(time.value * 0.21) * 0.06;
    yaw[2] = time.value * 0.12;
    yaw[3] = facing + s.lean * 0.5;
    yaw[4] = facing + s.lean * 0.5;
    u.uTilt.value = s.tilt;
    // the mark at its size, standing on the same base over the pond
    u.uScale.value[1] = T.logoScale;
    u.uCentre.value[1].y = GARDEN.shapes.mark.y + (T.logoScale - 1) * 5.25;
    u.uScale.value[4] = 1 + J.portal * 1.8;
    // the forms that face the camera (the mark, the infinity, the torus)
    // turn with it as it revolves: the bubbles are carried round by the same
    // turn, so the scroll's revolution never sets them flying
    const turn = s.facing === null ? 0 : Math.atan2(Math.sin(facing - s.facing), Math.cos(facing - s.facing));
    s.facing = facing;
    const f0 = Math.min(Math.floor(Math.max(s.form, 0)), 3);
    const facingW = FACES_CAMERA[f0] + (FACES_CAMERA[f0 + 1] - FACES_CAMERA[f0]) * THREE.MathUtils.smoothstep(s.form - f0, 0.2, 0.8);
    u.uCarry.value = turn * facingW;
    u.uCarryAt.value.copy(s.core);

    sm.gpu.compute();

    const m = built.material.uniforms;
    m.tPos.value = sm.gpu.getCurrentRenderTarget(sm.posVar).texture;
    m.tVel.value = sm.gpu.getCurrentRenderTarget(sm.velVar).texture;
    m.uTau.value = dt * 0.5;
    m.uSize.value = T.logoParticleSize;
    m.uAppear.value = J.pAppear;
    m.uShapeT.value = s.form;
    m.uGlow.value = T.logoParticleGlow;
    m.uSpec.value = T.logoSpecular;
    m.uRim.value = T.logoRim;
    m.uCoreGlow.value = T.logoCoreGlow;
    m.uWhiteout.value = T.logoWhiteout;
    m.uPortal.value = J.portal;
    // (swept up from the ground they stay in their colours: speed only lights
    // them once the mark has formed)
    // (nor while they first settle into a form further on — a deep link, or
    // the scene rebuilt on return — rushing there from the ground)
    // and past the mark the morphs' flights don't light them either: the
    // cube, the infinity and the torus form in their own colours (only the
    // pointer's touch lights them)
    const calm =
      THREE.MathUtils.smoothstep(s.form, 0.9, 1.4) * (1 - THREE.MathUtils.smoothstep(s.form, 1.05, 1.3)) * THREE.MathUtils.smoothstep(s.age, 2, 4);
    m.uSpeedGlow.value = calm;
    u.uSpeedGlow.value = calm;
    // the core glows at the centre of the current form
    const c = u.uCentre.value;
    const i0 = Math.min(Math.floor(Math.max(s.form, 0)), 3);
    s.core.lerpVectors(c[i0], c[i0 + 1], THREE.MathUtils.smoothstep(s.form - i0, 0.2, 0.8));
    m.uCore.value.copy(s.core);
    // (a soft warmth through the whole body, not a hot spot on the cube)
    m.uCoreReach.value = s.form > 2.5 && s.form < 3.5 ? 7 : 8;
    const pal = m.uPalette.value;
    pal[0].set(T.logoColorA);
    pal[1].set(T.logoColorB);
    pal[2].set(T.logoColorC);
    pal[3].set(T.logoColorD);
    pal[4].set(T.crackColor);
  });

  return <primitive object={built.points} />;
}
