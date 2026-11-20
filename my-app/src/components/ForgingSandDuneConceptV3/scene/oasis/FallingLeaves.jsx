"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SUN_DIR, WIND_DIR } from "../../config";
import { BASIN, TREE, WATER_Y } from "../../world/oasis";
import { growAt } from "../../world/oasisCamera";

// Leaves let go of the Yggdrasil's crown once it has grown: each one comes
// away from a point in the crown (picked off the crown's own leaf cards, and
// coloured from the cosmic atlas cell under it), falls at a leaf's slow
// terminal speed — swinging side to side under it like a pendulum (gliding
// down through each swing, all but stalling at its ends, tilted into it),
// some tumbling end over end, turning slowly, drifting with a light wind —
// lands on the island or the lake, settles flat, and fades there; then,
// after a while, it falls again from the crown.
//
// All of it is worked out in the vertex shader from the clock: each leaf a
// looping life with its own phase, so there is no per-frame work over the
// leaves. The scroll only sets how many are shedding (none until the crown
// has grown — and only from the parts of it already grown — ramping in as
// it completes).

// tunables
export const LEAVES = {
  count: { low: 180, medium: 360, high: 560 }, // (60% fewer than at first: too many)
  shedFrom: 0.55, // the crown's growth (0 → 1) at which the first leaves let go...
  shedFull: 1.0, // ...and all of them are shedding
  length: 1.45, // a leaf's length (m; ± 30%) — big, to read at 60–140 m
  width: 0.55, // ...its width, a share of its length
  fallSpeed: 2.9, // terminal speed (m/s; ± 25%)
  settle: 0.9, // how long it takes to reach it from rest (s)
  swingRate: 1.9, // the pendulum's swing (rad/s; ± 30%)
  swingAngle: 0.85, // ...its amplitude (rad)
  swingArm: 2.4, // ...its arm (m; ± 40%): the side-to-side sweep is about arm × sin(angle)
  tumble: 0.3, // share of leaves that tumble end over end instead
  tumbleRate: 3.2, // ...how fast (rad/s; ± 40%)
  spin: 0.35, // a slow turn about the vertical as it falls (rad/s, at most)
  wind: 0.75, // drift with the wind (m/s; ± 40%), along config WIND_DIR
  gust: 1.6, // a slow wander on top of it (m)
  rest: 7, // how long it lies on the ground/water before it has faded (s)
  gap: 22, // up to this long before it falls again (s)
  floatDrift: 0.12, // drift over the water once landed (m/s)
  brightness: 0.27, // its colour (the atlas's hue) is scaled to this peak (linear), then lit as the crown is
  soften: 0.18, // how far its colour is greyed toward the crown's duller mass (0: as the atlas)
  warm: 0.08, // share of leaves in the crown's warm pink-amber instead
  outerBias: 0.75, // how strongly spawn points favour the crown's outside (0: anywhere in it)
};

// (the crown's leaf cards' climb, as Yggdrasil.jsx leafMaterial: their height
// on the model's own scale, −4.5 m to 42.9 m, and when they come out)
const leafH = (y) => Math.min(Math.max((y + 4.5) / 47.4, 0), 1);

const WARM = [new THREE.Color("#ff6fae"), new THREE.Color("#ff8a3a"), new THREE.Color("#ff9fd0")];
const FALLBACK = [new THREE.Color("#5b3bd6"), new THREE.Color("#7b3fe0"), new THREE.Color("#4a2a9a"), new THREE.Color("#a050ff")];

// a small copy of the crown's atlas, to read leaf colours off (CPU, once)
function atlasReader(map) {
  try {
    const img = map?.image;
    if (!img || !img.width) return null;
    const N = 64;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, N, N);
    const data = g.getImageData(0, 0, N, N).data;
    // glTF: flipY false — uv (0, 0) is the image's top left
    return (u, v, out) => {
      const x = Math.min(N - 1, Math.max(0, Math.floor((u - Math.floor(u)) * N)));
      const y = Math.min(N - 1, Math.max(0, Math.floor((v - Math.floor(v)) * N)));
      const k = (y * N + x) * 4;
      out.setRGB(data[k] / 255, data[k + 1] / 255, data[k + 2] / 255, THREE.SRGBColorSpace);
      return data[k + 3] / 255;
    };
  } catch {
    return null;
  }
}

function buildLeaves(source, count) {
  source.updateMatrixWorld(true);
  const tris = [];
  let map = null;
  source.traverse((o) => {
    if (!o.isMesh || !(/Leaves/i.test(o.name) || /Leaves/i.test(o.material?.name || ""))) return;
    const g = o.geometry;
    const pos = g.getAttribute("position");
    if (!pos) return;
    map = map || o.material.map || null;
    const n = g.index ? g.index.count / 3 : pos.count / 3;
    tris.push({ o, g, pos, uv: g.getAttribute("uv"), index: g.index, n });
  });
  let s = 1013;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const read = atlasReader(map);
  const total = tris.reduce((a, t) => a + t.n, 0);

  const spawn = new Float32Array(count * 3);
  const a = new Float32Array(count * 4); // phase, seed, size, tumbler
  const b = new Float32Array(count * 4); // climb, crown height (0..1), wind factor, spare
  const col = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const c = new THREE.Color();
  const lin = new THREE.Color();

  for (let i = 0; i < count; i++) {
    let climb = 0.9;
    let h = 0.8;
    let ok = false;
    lin.copy(FALLBACK[i % FALLBACK.length]);
    for (let tries = 0; tries < 24 && total > 0 && !ok; tries++) {
      let at = Math.floor(rnd() * total);
      const t = tris.find((q) => (at < q.n ? true : ((at -= q.n), false)));
      const i0 = t.index ? t.index.getX(at * 3) : at * 3;
      const i1 = t.index ? t.index.getX(at * 3 + 1) : at * 3 + 1;
      const i2 = t.index ? t.index.getX(at * 3 + 2) : at * 3 + 2;
      let r1 = rnd();
      let r2 = rnd();
      if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
      }
      const w0 = 1 - r1 - r2;
      va.fromBufferAttribute(t.pos, i0);
      vb.fromBufferAttribute(t.pos, i1);
      vc.fromBufferAttribute(t.pos, i2);
      v.copy(va).multiplyScalar(w0).addScaledVector(vb, r1).addScaledVector(vc, r2);
      h = leafH(v.y);
      climb = 0.3 + 0.7 * h;
      v.applyMatrix4(t.o.matrixWorld);
      // (favouring the crown's outside: from deep inside it a leaf falls
      // hidden through the foliage)
      const rr = Math.hypot(v.x - TREE.x, v.z - TREE.z) / TREE.canopy;
      if (tries < 20 && rnd() > 1 - LEAVES.outerBias + LEAVES.outerBias * Math.min(rr * rr, 1)) continue;
      // its colour: the atlas under it (a hue: the card's cell)
      if (read && t.uv) {
        const u = w0 * t.uv.getX(i0) + r1 * t.uv.getX(i1) + r2 * t.uv.getX(i2);
        const vv = w0 * t.uv.getY(i0) + r1 * t.uv.getY(i1) + r2 * t.uv.getY(i2);
        const alpha = read(u, vv, c);
        const peak = Math.max(c.r, c.g, c.b);
        if (alpha < 0.25 || peak < 0.004) {
          if (tries < 20) continue;
        } else lin.copy(c);
      }
      ok = true;
    }
    if (!ok && total === 0) v.set(TREE.x + (rnd() - 0.5) * 80, WATER_Y + 60 + rnd() * 30, TREE.z + (rnd() - 0.5) * 80);
    // the hue kept, its brightness evened out (some darker, some brighter)
    if (rnd() < LEAVES.warm) lin.copy(WARM[Math.floor(rnd() * WARM.length)]);
    // (a touch less saturated than the atlas's brightest: closer to the crown's mass)
    const grey = (lin.r + lin.g + lin.b) / 3;
    lin.lerp(c.setRGB(grey, grey, grey), LEAVES.soften);
    const peak = Math.max(lin.r, lin.g, lin.b, 1e-4);
    lin.multiplyScalar((LEAVES.brightness * (0.65 + 0.7 * rnd())) / peak);
    spawn.set([v.x, v.y, v.z], i * 3);
    a.set([rnd(), rnd(), LEAVES.length * (0.7 + 0.6 * rnd()), rnd() < LEAVES.tumble ? 1 : 0], i * 4);
    b.set([climb, h, 0.6 + 0.8 * rnd(), rnd()], i * 4);
    col.set([lin.r, lin.g, lin.b], i * 3);
  }

  const geometry = new THREE.InstancedBufferGeometry();
  const card = new THREE.PlaneGeometry(1, 1);
  geometry.index = card.index;
  geometry.setAttribute("position", card.getAttribute("position"));
  geometry.setAttribute("uv", card.getAttribute("uv"));
  geometry.setAttribute("aSpawn", new THREE.InstancedBufferAttribute(spawn, 3));
  geometry.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4));
  geometry.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4));
  geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(col, 3));
  geometry.instanceCount = count;
  return geometry;
}

const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

const VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec3 aSpawn;
attribute vec4 aA; // phase, seed, length (m), tumbler
attribute vec4 aB; // climb, crown height, wind factor, spare
attribute vec3 aColor;
uniform float uTime;
uniform float uShed;
uniform float uGrow;
uniform float uGrowJitter;
uniform float uFill;
uniform float uLeafBase;
uniform float uLeafLit;
uniform vec3 uLeafColor;
uniform vec3 uGlowColor;
uniform vec3 uSun;
varying vec2 vUv;
varying vec3 vCol;
varying float vAlpha;

float h1(float n) { return fract(sin(n) * 43758.5453123); }

// the island's ground (world/oasis.js floorHeight: barely above the lake,
// rising to the trunk's foot), and the water's skin beyond it
float groundY(vec2 xz) {
  float r = length(xz - vec2(${f(TREE.x)}, ${f(TREE.z)}));
  float island = ${f(WATER_Y)} + 0.08 + 0.7 * (1.0 - smoothstep(6.0, ${f(BASIN.island)}, r));
  return max(r < ${f(BASIN.island)} ? island : ${f(WATER_Y)}, ${f(WATER_Y)}) + 0.06;
}

// a rotation by angle a about the unit axis k (Rodrigues)
vec3 rot(vec3 v, vec3 k, float a) {
  float c = cos(a), s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

void main() {
  float seed = aA.y;
  float vT = ${f(LEAVES.fallSpeed)} * (0.75 + 0.5 * h1(seed * 13.17));
  float tau = ${f(LEAVES.settle)};
  // when it lands (by its fall alone; the swing only ever lifts it)
  float drop = max(aSpawn.y - ${f(WATER_Y)} - 0.3, 1.0);
  float tLand = drop / vT + tau;
  float rest = ${f(LEAVES.rest)};
  float period = tLand + rest + ${f(LEAVES.gap)} * h1(seed * 7.71) + 1.0;
  float tt = uTime + aA.x * period;
  float cyc = floor(tt / period);
  float t = tt - cyc * period;

  // shedding: this fall chosen (the share of leaves set by the crown's
  // growth), and only from where the crown has grown out
  float pick = h1(seed * 91.7 + cyc * 17.13);
  float on = smoothstep(pick, pick + 0.08, uShed * 1.08);
  float grownTo = uGrow * (1.0 + uGrowJitter) - seed * uGrowJitter;
  on *= smoothstep(aB.x + 0.02, aB.x + 0.08, grownTo);
  float fade = smoothstep(0.0, 1.2, t) * (1.0 - smoothstep(tLand + rest * 0.3, tLand + rest, t));
  vAlpha = on * fade;
  if (vAlpha < 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

  float tf = min(t, tLand);
  // falling: from rest up to its terminal speed
  float fallY = vT * (tf - tau * (1.0 - exp(-tf / tau)));
  // the swing: an arm swinging to and fro (its direction turning slowly)
  float w = ${f(LEAVES.swingRate)} * (0.7 + 0.6 * h1(seed * 3.31));
  float th = ${f(LEAVES.swingAngle)} * (0.75 + 0.25 * h1(seed * 5.9)) * sin(w * tf + seed * 21.0);
  float arm = ${f(LEAVES.swingArm)} * (0.6 + 0.8 * h1(seed * 4.43));
  float yawS = seed * 6.2832 + (h1(seed * 8.1) - 0.5) * 0.3 * tf;
  vec2 sd = vec2(cos(yawS), sin(yawS));
  // wind: a steady drift and a slow wander
  vec2 wind = vec2(${f(WIND_DIR.x)}, ${f(WIND_DIR.y)}) * ${f(LEAVES.wind)} * aB.z * tf
    + vec2(sin(tf * 0.31 + seed * 9.0) - sin(seed * 9.0), cos(tf * 0.23 + seed * 5.0) - cos(seed * 5.0)) * ${f(LEAVES.gust)};
  vec3 p = aSpawn;
  p.xz += wind;
  float g = groundY(p.xz);
  p.y = max(p.y - fallY, g);
  // the swing comes in as it gets away and dies down as it comes down
  float flut = smoothstep(0.0, 1.6, tf) * smoothstep(0.0, 2.5, p.y - g);
  float tumbler = aA.w;
  float sw = flut * (1.0 - 0.6 * tumbler);
  p.xz += sd * arm * sin(th) * sw;
  p.y += arm * (1.0 - cos(th)) * sw; // (rising a little to the end of each swing)
  // landed on the water: a slow drift
  if (t > tLand && length(p.xz - vec2(${f(TREE.x)}, ${f(TREE.z)})) > ${f(BASIN.island)}) {
    p.xz += vec2(${f(WIND_DIR.x)}, ${f(WIND_DIR.y)}) * ${f(LEAVES.floatDrift)} * (t - tLand);
  }

  // its turn: flat (in the ground plane), its length turned slowly about
  // the vertical; tilted into its swing; tumblers turning end over end —
  // all of it settling flat (either face up) as it lands
  float yaw = seed * 31.0 + (h1(seed * 2.7) - 0.5) * 2.0 * ${f(LEAVES.spin)} * tf;
  vec3 ax = vec3(cos(yaw), 0.0, sin(yaw));
  float tum = tumbler * ${f(LEAVES.tumbleRate)} * (0.6 + 0.8 * h1(seed * 6.6)) * tf;
  tum = mix(floor(tum / 3.14159 + 0.5) * 3.14159, tum, flut);
  float flick = sin(tf * 6.3 + seed * 40.0) * 0.28 * flut;
  float L = aA.z;
  vec3 local = vec3(position.x * L, 0.0, position.y * L * ${f(LEAVES.width)});
  vec3 nrm = vec3(0.0, 1.0, 0.0);
  // (about its own length first: the flutter and the tumble)
  local = rot(local, vec3(1.0, 0.0, 0.0), tum + flick);
  nrm = rot(nrm, vec3(1.0, 0.0, 0.0), tum + flick);
  // (and a little curl along its length, so it never goes fully edge-on)
  local.y += position.x * position.x * L * 0.18;
  local = rot(local, vec3(0.0, 1.0, 0.0), -yaw);
  nrm = rot(nrm, vec3(0.0, 1.0, 0.0), -yaw);
  vec3 k = normalize(vec3(-sd.y, 0.0, sd.x));
  float tilt = -th * sw * 0.9;
  local = rot(local, k, tilt);
  nrm = rot(nrm, k, tilt);
  vec3 transformed = p + local;

  // its colour: the crown's (lit as the crown is by the tree's light), and
  // flashing a little as it turns its face to the low sun
  float lit = 1.0 - smoothstep(uFill - 0.04, uFill + 0.01, aB.y);
  float face = abs(dot(nrm, uSun));
  vCol = aColor * uLeafColor * (uLeafBase + uLeafLit * lit) * (0.7 + 0.45 * face + 0.6 * pow(face, 12.0));
  // (and the warm glow at the light's front, as it climbs past where it grew)
  float front = exp(-pow((aB.y - uFill) / 0.035, 2.0)) * step(0.001, uFill) * step(uFill, 0.999);
  vCol += uGlowColor * front * uLeafLit * 1.6 * max(max(vCol.r, vCol.g), max(vCol.b, 0.25));
  vUv = uv;

  vec4 mvPosition = viewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
varying vec2 vUv;
varying vec3 vCol;
varying float vAlpha;

void main() {
  // a leaf: a short stem, then a blade swelling and tapering to its tip
  float u = vUv.x;
  float v = (vUv.y - 0.5) * 2.0;
  float b = (u - 0.1) / 0.9;
  float prof = pow(sin(3.14159 * clamp(b, 0.0, 1.0)), 0.7) * (1.0 - 0.3 * b) * step(0.0, b);
  float fw = max(fwidth(v), 1e-3);
  float blade = 1.0 - smoothstep(prof - fw, prof + fw, abs(v));
  float stem = (1.0 - step(0.12, u)) * (1.0 - smoothstep(0.08 - fw, 0.08 + fw, abs(v)));
  float shape = max(blade, stem);
  if (shape < 0.5) discard;
  // a midrib and a darker edge
  vec3 col = vCol * (1.0 - 0.35 * exp(-pow(v / 0.07, 2.0)) * step(0.1, u));
  col *= 0.8 + 0.2 * smoothstep(0.0, 0.5, prof - abs(v));
  gl_FragColor = vec4(col, vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export default function FallingLeaves({ source, J, tier, uniforms }) {
  const count = LEAVES.count[tier?.name] ?? LEAVES.count.medium;
  const geometry = useMemo(() => buildLeaves(source, count), [source, count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          // (the tree's own, shared: its clock, growth and leaf colouring)
          uTime: uniforms.uTime,
          uGrow: uniforms.uGrow,
          uGrowJitter: uniforms.uGrowJitter,
          uFill: uniforms.uFill,
          uLeafBase: uniforms.uLeafBase,
          uLeafLit: uniforms.uLeafLit,
          uLeafColor: uniforms.uLeafColor,
          uGlowColor: uniforms.uGlowColor,
          uSun: { value: SUN_DIR.clone() },
          uShed: { value: 0 },
        },
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: true,
        fog: true,
      }),
    [uniforms]
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  useFrame(() => {
    const g = growAt(J.progress);
    material.uniforms.uShed.value = THREE.MathUtils.smoothstep(g, LEAVES.shedFrom, LEAVES.shedFull);
  });
  // (always drawn — at nothing until the crown sheds — so its program is
  // compiled with the tree's; drawn before the strands, which glow over it)
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
