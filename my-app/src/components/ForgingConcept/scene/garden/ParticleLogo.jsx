"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { mulberry32 } from "../../world/layout";
import { sampleCube, sampleLogo3D, sampleSphere, sampleTorus } from "../../world/logoParticles";
import { GARDEN, GARDEN_ORIGIN } from "../../config";
import { pointer } from "../../pointer";
import { T } from "../../tuning";
import { GARDEN_SUN } from "./sky";

// The garden's particle body: tens of thousands of glossy bubbles in the
// Hyperiux palette that take one form after another as the visitor scrolls —
// a swirl streaming in over the pond, the Hyperiux mark (in 3D: the four
// shapes as slabs, the cube outline as a real cube), a cube, a great cloud,
// and a ring the camera flies through into the light — all over the pond's
// middle, the mark and the ring turned to the camera as it revolves round
// them. The swirl gathers into the mark with the scroll; after that, each
// change of section sets off the next morph, which then plays out on its
// own clock (T.logoMorphSpeed), however slowly the visitor scrolls.
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
uniform sampler2D tCube;
uniform sampler2D tCloud;
uniform sampler2D tRing;
uniform sampler2D tSwirl; // radius, angle, height seed, pace
uniform vec3 uCentre[5];
uniform float uYaw[5];
uniform float uScale[5];
uniform float uTilt;
uniform float uClock;
uniform float uWaterY;
vec3 formPos(int i, vec2 uv) {
  if (i == 0) {
    // the swirl: a ribbon streaming round over the pond
    vec4 S = texture2D(tSwirl, uv);
    float ang = S.y + uClock * S.w * (2.2 / max(S.x, 1.0));
    float y = uWaterY + 1.2 + S.z * 1.4 + sin(ang * 2.0 + S.x * 0.7) * 1.1;
    return uCentre[0] + vec3(cos(ang) * S.x, y - uCentre[0].y, sin(ang) * S.x * 0.85);
  }
  vec3 p = i == 1 ? texture2D(tMark, uv).xyz : i == 2 ? texture2D(tCube, uv).xyz : i == 3 ? texture2D(tCloud, uv).xyz : texture2D(tRing, uv).xyz;
  return uCentre[i] + rotY(rotX(p * uScale[i], uTilt), uYaw[i]);
}
`;

const VELOCITY = /* glsl */ `
uniform sampler2D tSeed; // delay, radius, colour, spark
uniform float uDt;
uniform float uTime;
uniform float uShapeT;
uniform float uStagger; // share of a morph the bubbles' starts are spread over
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
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 P = texture2D(tPos, uv);
  vec4 V = texture2D(tVel, uv);
  vec3 pos = P.xyz + V.xyz * uDt;
  // glow: up quickly with speed / scatter, down slowly
  float speed = length(V.xyz);
  // (a morph's flight is quick: only the fastest bubbles light up from it)
  float want = clamp(clamp((speed - 6.0) * 0.12, 0.0, 1.0) + V.w * 0.7, 0.0, 1.0);
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
  vAdd = uGlowColor * glow * 1.5 + uCoreColor * core * uCoreGlow + uGlowColor * smoothstep(5.0, 14.0, speed) * 0.4 + uCoreColor * uPortal * 1.5;
  vBlow = smoothstep(0.25, 0.95, clamp(glow * 0.7 + scatter * 0.45 + smoothstep(8.0, 18.0, speed) * 0.3 + uPortal * 0.6, 0.0, 1.0)) * uWhiteout;
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
  const logo = sampleLogo3D(count, { height: 8.5, thickness: 0.9 });
  const forms = {
    mark: pack(count, logo.positions, logo.kinds),
    cube: pack(count, sampleCube(count, { size: 5.6 })),
    cloud: pack(count, sampleSphere(count, { radius: 5.6 })),
    ring: pack(count, sampleTorus(count, { radius: 4.6, tube: 1.25 })),
  };
  const waterY = GARDEN.water;
  const swirl = new Float32Array(count * 4);
  const seed = new Float32Array(count * 4);
  const ref = new Float32Array(count * 2);
  const info = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    // a ribbon round the pond, 5.5–8.5 m out
    swirl.set([5.5 + rng() * 3, rng() * Math.PI * 2, rng(), 0.7 + rng() * 0.6], i * 4);
    const spark = rng() < 0.02 ? 1 : 0;
    const delay = rng();
    // bubbles: mostly small, a few big ones; sparks tiny
    const radius = spark ? 0.018 + rng() * 0.012 : 0.035 + Math.pow(rng(), 2.6) * 0.13;
    // the palette (0–3), the mark's cube in the brand colour (4)
    const colour = logo.kinds[i] > 0.5 && rng() < 0.85 ? 4 : Math.floor(Math.pow(rng(), 1.3) * 4);
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
    pos0.image.data.set([GARDEN.pond.x + Math.cos(a) * r, waterY + 1.2 + hs * 1.4, GARDEN.pond.z + Math.sin(a) * r * 0.85, 0], i * 4);
  }
  const velVar = gpu.addVariable("tVel", VELOCITY, vel0);
  const posVar = gpu.addVariable("tPos", POSITION, pos0);
  gpu.setVariableDependencies(velVar, [posVar, velVar]);
  gpu.setVariableDependencies(posVar, [posVar, velVar]);
  const S = GARDEN.shapes;
  const forms_ = {
    tMark: { value: dataTexture(size, forms.mark) },
    tCube: { value: dataTexture(size, forms.cube) },
    tCloud: { value: dataTexture(size, forms.cloud) },
    tRing: { value: dataTexture(size, forms.ring) },
    tSwirl: { value: dataTexture(size, swirl) },
    uCentre: { value: [GARDEN.pond.clone(), S.mark.clone(), S.cube.clone(), S.cloud.clone(), S.ring.clone()] },
    uYaw: { value: [0, 0, 0, 0, 0] },
    uScale: { value: [1, 1, 1, 1, 1] },
    uTilt: { value: 0 },
    uClock: { value: 0 },
    uWaterY: { value: waterY },
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
  };
  Object.assign(velVar.material.uniforms, simU);
  posVar.material.uniforms.uDt = simU.uDt;
  posVar.material.uniforms.uHover = simU.uHover;
  const error = gpu.init();
  if (error) {
    console.error(`[forging-concept] particle body: ${error}`);
    gpu.dispose();
    return null;
  }
  return { gpu, velVar, posVar, simU };
}

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
      for (const k of ["tMark", "tCube", "tCloud", "tRing", "tSwirl", "tSeed"]) s.simU[k].value.dispose();
    };
  }, [gl, built, tier, time]);

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
      core: new THREE.Vector3(),
    }),
    []
  );

  useFrame((_, delta) => {
    const sm = sim.current;
    if (!sm || !J.inGarden) return;
    const dt = Math.min(delta, 1 / 30);
    const u = sm.simU;
    u.uDt.value = dt;
    u.uClock.value += dt * T.logoSwirlSpeed;
    // the form: the scroll gathers the swirl into the mark; past it, the
    // section sets the form and the morph runs at its own pace
    if (J.shapeT < 1) s.form = J.shapeT;
    else {
      const step = T.logoMorphSpeed * dt;
      s.form = THREE.MathUtils.clamp(Math.round(J.shapeT) - Math.max(s.form, 1), -step, step) + Math.max(s.form, 1);
    }
    J.formT = s.form;
    u.uShapeT.value = s.form;
    u.uStagger.value = T.logoMorphStagger;
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

    // each form turned to its view: the mark faces the camera as it revolves,
    // leaning a little to the pointer; the cube turns slowly; the cloud
    // drifts round; the ring faces the camera, and opens wide as the camera
    // goes through
    const k = 1 - Math.exp(-dt * 3);
    s.lean += ((pointer.active ? pointer.x : 0) * 0.18 - s.lean) * k;
    s.tilt += ((pointer.active ? -pointer.y : 0) * 0.08 - s.tilt) * k;
    s.cam.copy(camera.position).sub(GARDEN_ORIGIN).sub(GARDEN.shapes.mark);
    const facing = Math.atan2(s.cam.x, s.cam.z);
    const yaw = u.uYaw.value;
    yaw[1] = facing + THREE.MathUtils.degToRad(T.logoYaw) + s.lean + Math.sin(time.value * 0.21) * 0.06;
    yaw[2] = time.value * 0.12;
    yaw[3] = time.value * 0.05;
    yaw[4] = facing + s.lean * 0.5;
    u.uTilt.value = s.tilt;
    u.uScale.value[4] = 1 + J.portal * 1.8;

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
    // the core glows at the centre of the current form
    const c = u.uCentre.value;
    const i0 = Math.min(Math.floor(Math.max(s.form, 0)), 3);
    s.core.lerpVectors(c[i0], c[i0 + 1], THREE.MathUtils.smoothstep(s.form - i0, 0.2, 0.8));
    m.uCore.value.copy(s.core);
    m.uCoreReach.value = s.form > 2.5 && s.form < 3.5 ? 6 : 3.5;
    const pal = m.uPalette.value;
    pal[0].set(T.logoColorA);
    pal[1].set(T.logoColorB);
    pal[2].set(T.logoColorC);
    pal[3].set(T.logoColorD);
    pal[4].set(T.crackColor);
  });

  return <primitive object={built.points} />;
}
