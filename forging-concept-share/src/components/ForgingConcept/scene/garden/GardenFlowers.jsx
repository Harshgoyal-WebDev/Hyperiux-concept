"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { GARDEN } from "../../config";
import { mulberry32 } from "../../world/layout";
import { GRASS_LAYER, POINTER_WIND_GLSL, SWAY_DECLS } from "../../world/gardenAsset";
import { T } from "../../tuning";
import { Q } from "../../quality";
import { GARDEN_SUN } from "./sky";

// Flowers through the lawn, three kinds, one instanced draw each, all
// shaped in the vertex shader from a few vertices:
//   tulips  – cupped six-pointed blooms on straight stems with two blue-green
//             leaves at the foot, in clumps of one colour (red, pink, yellow,
//             orange, white, purple); glossy, lit through from behind
//   daisies – white rays round a gold centre, drawn in the shader on a single
//             quad (so a whole drift costs almost nothing)
//   spires  – slender stems carrying tiny florets up their top half, in
//             lavender and rose (crossed quads, florets drawn in the shader)
// Every stem bends with the breeze and with the pointer's own wind (a
// smaller share than the grass takes), keeping its length; heads nod on
// their own; blooms glow where the pointer passes.

// aPart: 0 stem, 1 tulip cup, 2 tulip leaf, 3 daisy head, 4 spire florets.
// lite: the tulips far from the pond (see LITE_FROM), where a cup is a few
// pixels: 6 round and 4 rings up (56 triangles a flower, not 116)
function geometry(kind, lite = false) {
  const pos = [];
  const nrm = [];
  const part = [];
  const petal = [];
  const index = [];
  const vert = (p, n, k, u, v) => {
    pos.push(...p);
    nrm.push(...n);
    part.push(k);
    petal.push(u, v);
    return pos.length / 3 - 1;
  };
  // the stem: 3 rings of 3 (position.xz radial, y = 0..1 up the stem)
  const stem = pos.length / 3;
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      vert([Math.cos(a), r / 2, Math.sin(a)], [Math.cos(a), 0, Math.sin(a)], 0, r / 2, 0);
    }
  }
  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < 3; k++) {
      const a = stem + r * 3 + k;
      const b = stem + r * 3 + ((k + 1) % 3);
      index.push(a, a + 3, b, b, a + 3, b + 3);
    }
  }
  if (kind === "tulip") {
    // the cup: a lathe of 12 round, 5 rings up; the rim rises to six points
    const seg = lite ? 6 : 12;
    const rings = lite ? 4 : 5;
    // (lite: drawn in to a closed bud with six points, not left an open
    // six-sided cup — which looked like a glass)
    const profile = lite ? [0.18, 0.47, 0.42, 0.22] : [0.18, 0.4, 0.5, 0.48, 0.38];
    const cup = pos.length / 3;
    for (let j = 0; j < rings; j++) {
      const t = j / (rings - 1);
      const top = j === rings - 1;
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const point = top && i % 2 === 0;
        const r = profile[j] * (point ? 1.05 : 1);
        const y = t * 1.35 + (top ? (point ? 0.16 : -0.02) : 0);
        vert([Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(a), 0.25 - t * 0.3, Math.sin(a)], 1, t, i / seg);
      }
    }
    for (let j = 0; j < rings - 1; j++) {
      for (let i = 0; i < seg; i++) {
        const a = cup + j * seg + i;
        const b = cup + j * seg + ((i + 1) % seg);
        index.push(a, b, a + seg, b, b + seg, a + seg);
      }
    }
    // two leaves at the foot, arching out (x out, y up; length 1)
    for (const side of [-1, 1]) {
      const leaf = pos.length / 3;
      for (let r = 0; r < 3; r++) {
        const t = r / 2;
        const w = 0.13 * (1 - t) + 0.02;
        const out = (t * 0.45 + t * t * 0.15) * side;
        const y = t * 0.9 - t * t * 0.2;
        for (const s of [-1, 1]) vert([out, y, s * w], [side * 0.5, 1, 0], 2, t, s);
      }
      for (let r = 0; r < 2; r++) {
        const a = leaf + r * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  } else if (kind === "daisy") {
    const h = pos.length / 3;
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) vert([x, 0, z], [0, 1, 0], 3, x, z);
    index.push(h, h + 2, h + 1, h, h + 3, h + 2);
  } else {
    // two crossed strips up the top part of the stem (z: which one)
    for (let q = 0; q < 2; q++) {
      const h = pos.length / 3;
      for (const [x, y] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) vert([x, y, q], [0, 0, 1], 4, x, y);
      index.push(h, h + 1, h + 2, h, h + 2, h + 3);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("aPart", new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute("aPetal", new THREE.Float32BufferAttribute(petal, 2));
  g.setIndex(index);
  return g;
}

const VERTEX = /* glsl */ `
${SWAY_DECLS}
${POINTER_WIND_GLSL}
attribute float aPart;
attribute vec2 aPetal;
attribute vec3 iPos; // root (garden metres)
attribute vec4 iShape; // yaw, stem height (m), head size (m), turn to camera
attribute vec3 iColor;
attribute vec4 iRand; // seed, tilt, stiffness, lean
uniform float uHeight;
uniform float uSize;
uniform vec3 uCamera; // (world)
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vPetal;
varying float vPart;
#include <fog_pars_vertex>
void main() {
  vec3 root = (modelMatrix * vec4(iPos, 1.0)).xyz;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 facing = vec3(cos(iShape.x), 0.0, sin(iShape.x));
  vec3 side = cross(up, facing);
  float sh = iShape.y * uHeight;
  float headS = iShape.z * uSize;
  // bent by the breeze and the pointer's wind, keeping its length
  float sway = sin(uTime * (1.1 + iRand.x * 0.8) + iRand.x * 6.2831 + root.x * 0.4 + root.z * 0.3);
  vec2 breeze = vec2(0.8, 0.6) * (0.06 + 0.04 * sway) * iRand.z * uWindAmount;
  vec2 pw = pointerWind(root.xz, iRand.x) * 0.45;
  vec3 bend = facing * iRand.w * sh + vec3(breeze.x + pw.x, 0.0, breeze.y + pw.y) * sh * 1.6;
  float bl = length(bend);
  float maxB = sh * 0.8;
  if (bl > maxB) { bend *= maxB / bl; bl = maxB; }
  float tipH = sqrt(max(sh * sh - bl * bl, sh * sh * 0.1));
  vec3 p1 = root + up * sh * 0.55;
  vec3 p2 = root + up * tipH + bend;

  vec3 pos;
  vec3 nrm;
  if (aPart < 0.5 || aPart > 3.5) {
    // along the stem (spire florets ride its top half)
    float t = aPart < 0.5 ? position.y : mix(0.45, 1.06, position.y);
    float it = 1.0 - t;
    vec3 spine = it * it * root + 2.0 * it * t * p1 + t * t * p2;
    if (aPart < 0.5) {
      vec3 radial = position.x * side + position.z * facing;
      pos = spine + radial * max(headS * 0.08, 0.004) * mix(1.0, 0.7, t);
      nrm = radial;
    } else {
      vec3 across = position.z < 0.5 ? side : facing;
      pos = spine + across * position.x * headS * 0.55 * (1.0 - 0.5 * position.y);
      nrm = normalize(cross(across, normalize(p2 - p1)));
    }
  } else if (aPart > 1.5 && aPart < 2.5) {
    // tulip leaves, rooted at the foot, swaying a little
    vec3 lp = position * sh * 0.6;
    pos = root + side * lp.x + up * lp.y + facing * lp.z + bend * 0.35 * position.y;
    nrm = normalize(side * normal.x + up * normal.y);
  } else {
    // the head: up (tulips almost straight up), partly to the camera, its
    // own tilt, nodding
    vec3 tipT = normalize(p2 - p1);
    vec3 toCam = uCamera - p2;
    toCam -= up * dot(toCam, up);
    toCam /= max(length(toCam), 1e-4);
    vec3 hUp = normalize(tipT + toCam * iShape.w + side * (iRand.y - 0.5) * 0.5);
    vec3 hx = normalize(facing - hUp * dot(facing, hUp));
    float nod = sin(uTime * (0.9 + iRand.x) + iRand.x * 30.0) * (0.05 + length(pw) * 0.6);
    hUp = normalize(hUp + hx * nod);
    vec3 hz = cross(hx, hUp);
    vec3 lp = position * headS;
    pos = p2 + hx * lp.x + hUp * lp.y + hz * lp.z;
    nrm = hx * normal.x + hUp * normal.y + hz * normal.z;
  }
  vWorld = pos;
  vNormal = nrm;
  vColor = iColor;
  vPetal = aPetal;
  vPart = aPart;
  vSwGlow = (aPart > 0.5 && aPart < 1.5) || aPart > 2.5 ? pointerGlow(p2) : 0.0;
  vec4 mvPosition = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uSunDir;
uniform float uSun;
uniform vec3 uSunColor;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uStem;
uniform vec3 uLeaf;
uniform vec3 uCentre;
uniform float uGlowStrength;
uniform vec3 uGlowColor;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec2 vPetal;
varying float vPart;
varying float vSwGlow;
#include <fog_pars_fragment>
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  bool inside = dot(N, V) < 0.0;
  if (inside) N = -N;
  vec3 albedo;
  float trans = 0.4;
  float gloss = 0.25;
  if (vPart < 0.5) {
    albedo = uStem * mix(0.5, 1.0, vPetal.x);
  } else if (vPart < 1.5) {
    // tulip: gold at the very base, deeper below, lighter at the rim, faint
    // seams between the petals; darker seen from inside the cup
    float t = vPetal.x;
    albedo = mix(vColor * vColor * 1.2, vColor, smoothstep(0.0, 0.6, t));
    albedo = mix(albedo, mix(vColor, vec3(1.0), 0.3), smoothstep(0.7, 1.0, t) * 0.5);
    albedo = mix(vec3(0.75, 0.62, 0.18), albedo, smoothstep(0.0, 0.18, t));
    albedo *= 1.0 - pow(abs(cos(vPetal.y * 37.7)), 12.0) * 0.18;
    if (inside) albedo *= 0.55;
    trans = 1.0;
    gloss = 0.7;
  } else if (vPart < 2.5) {
    albedo = uLeaf * mix(0.6, 1.05, vPetal.x);
    gloss = 0.35;
  } else if (vPart < 3.5) {
    // daisy: rays round a gold centre
    vec2 q = vPetal;
    float r = length(q);
    float a = atan(q.y, q.x);
    float rays = 0.62 + 0.38 * pow(abs(cos(a * 7.0)), 0.6);
    if (r > rays * 0.98) discard;
    float centre = 1.0 - smoothstep(0.26, 0.3, r);
    float speck = fract(sin(dot(floor(q * 20.0), vec2(12.9, 78.2))) * 437.5);
    albedo = mix(vColor * mix(0.85, 1.0, smoothstep(0.3, 0.9, r)), uCentre * (0.85 + 0.3 * speck), centre);
    trans = 0.8;
    gloss = 0.3;
  } else {
    // spire: tiny florets up the stem, thinning to the tip
    vec2 c = vec2(vPetal.x, fract(vPetal.y * 9.0) * 2.0 - 1.0);
    float w = 1.0 - vPetal.y * 0.6;
    if (length(c / vec2(w, 1.0)) > 0.95 || vPetal.y < 0.04) discard;
    albedo = vColor * (0.8 + 0.25 * vPetal.y);
    trans = 0.7;
  }
  float ndl = dot(N, uSunDir);
  vec3 sun = uSunColor * uSun / 3.14159;
  vec3 col = albedo * (sun * max(ndl, 0.0) + mix(uGround, uSky, N.y * 0.5 + 0.5) * 0.55);
  // light through the bloom from behind
  col += albedo * sun * trans * pow(max(dot(-V, uSunDir), 0.0), 2.0) * 0.8;
  col += sun * gloss * pow(max(dot(N, normalize(uSunDir + V)), 0.0), 48.0) * 0.3;
  // kept under the bloom's threshold (white daisies in the sun would glow
  // like lamps), so only the pointer's glow makes them shine
  col *= min(0.6 / max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 1e-4), 1.0);
  // lit from within where the pointer passes
  col += (albedo * 2.4 + uGlowColor * 0.9) * vSwGlow * uGlowStrength;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Where each kind grows, how tall, how big its head, and its colours (shares
// of its palette; a clump shares one colour).
const KINDS = {
  tulip: { count: "gardenTulips", stem: [0.35, 0.5], head: [0.04, 0.055], face: [0, 0.15], clump: [6, 16], spread: 1.4, radius: [6, 44], lean: 0.15, colours: [0.22, 0.2, 0.18, 0.16, 0.12, 0.12] },
  daisy: { count: "gardenDaisies", stem: [0.25, 0.42], head: [0.035, 0.05], face: [0.1, 0.35], clump: [1, 4], spread: 2.5, radius: [6, 47], lean: 0.35, colours: [1] },
  spire: { count: "gardenSpikes", stem: [0.45, 0.7], head: [0.025, 0.035], face: [0, 0], clump: [4, 10], spread: 1.1, radius: [10, 47], lean: 0.3, colours: [0.6, 0.4] },
};
const palette = (kind) =>
  kind === "tulip"
    ? [T.tulipRed, T.tulipPink, T.tulipYellow, T.tulipOrange, T.tulipWhite, T.tulipPurple]
    : kind === "daisy"
      ? [T.daisyColor]
      : [T.spireLavender, T.spireRose];

// tulips this far from the pond (m) or more take the lite cup
const LITE_FROM = 22;

function plant(kind, tier, garden, seed) {
  const spec = KINDS[kind];
  const count = tier[spec.count];
  const rng = mulberry32(seed);
  const noise = createNoise2D(mulberry32(seed + 1));
  const iPos = new Float32Array(count * 3);
  const iShape = new Float32Array(count * 4);
  const iColor = new Float32Array(count * 3);
  const iRand = new Float32Array(count * 4);
  const colourOf = new Uint8Array(count);
  const far = new Uint8Array(count);
  const range = (a) => a[0] + rng() * (a[1] - a[0]);
  let n = 0;
  for (let tries = 0; n < count && tries < count * 6; tries++) {
    // a clump round a centre, leaving bare patches
    const a = rng() * Math.PI * 2;
    const r = range(spec.radius);
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r * 0.9 + 2;
    if (noise(cx * 0.08, cz * 0.08) < -0.35) continue;
    let pick = rng();
    let colour = 0;
    for (; colour < spec.colours.length - 1 && (pick -= spec.colours[colour]) > 0; colour++);
    const k = Math.round(range(spec.clump));
    for (let j = 0; j < k && n < count; j++) {
      const x = cx + (rng() - 0.5) * spec.spread * 2;
      const z = cz + (rng() - 0.5) * spec.spread * 2;
      const h = garden.height.sample(x, z);
      if (!Number.isFinite(h) || h < GARDEN.water + 0.05) continue;
      if (garden.trunks.some((t) => Math.abs(t.x - x) < 0.8 && Math.abs(t.z - z) < 0.8)) continue;
      iPos.set([x, h - 0.02, z], n * 3);
      iShape.set([rng() * Math.PI * 2, range(spec.stem), range(spec.head), range(spec.face)], n * 4);
      iRand.set([rng(), rng(), 0.6 + rng() * 0.8, (rng() - 0.5) * spec.lean], n * 4);
      colourOf[n] = colour;
      far[n] = r >= LITE_FROM ? 1 : 0;
      n++;
    }
  }
  // (tulips: near and far, each its own draw; the others need no lighter form)
  const sets = kind === "tulip" ? [0, 1] : [null];
  return sets.map((lite) => {
    const pick = [];
    for (let i = 0; i < n; i++) if (lite === null || far[i] === lite) pick.push(i);
    const take = (src, size) => {
      const out = new Float32Array(Math.max(pick.length, 1) * size);
      pick.forEach((i, j) => out.set(src.subarray(i * size, i * size + size), j * size));
      return out;
    };
    const geo = geometry(kind, lite === 1);
    geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(take(iPos, 3), 3));
    geo.setAttribute("iShape", new THREE.InstancedBufferAttribute(take(iShape, 4), 4));
    geo.setAttribute("iColor", new THREE.InstancedBufferAttribute(take(iColor, 3), 3));
    geo.setAttribute("iRand", new THREE.InstancedBufferAttribute(take(iRand, 4), 4));
    geo.instanceCount = pick.length;
    return { kind, geo, planted: pick.length, colourOf: Uint8Array.from(pick, (i) => colourOf[i]), key: "" };
  });
}

export default function GardenFlowers({ tier, garden, sway, light }) {
  const built = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsLib.fog,
        ...sway,
        uHeight: { value: 1 },
        uSize: { value: 1 },
        uCamera: { value: new THREE.Vector3() },
        uSunDir: { value: GARDEN_SUN.clone() },
        uSun: { value: 3 },
        uSunColor: { value: new THREE.Color("#fff0d8") },
        uSky: { value: new THREE.Color("#bcd5ee") },
        uGround: { value: new THREE.Color("#5d6b3e") },
        // (the garden's light, by day and night: Garden.jsx)
        ...light,
        uStem: { value: new THREE.Color("#4a7428") },
        uLeaf: { value: new THREE.Color("#4d7a5a") },
        uCentre: { value: new THREE.Color("#f2b81e") },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.DoubleSide,
      fog: true,
    });
    const kinds = [...plant("tulip", tier, garden, 7171), ...plant("daisy", tier, garden, 8181), ...plant("spire", tier, garden, 9191)];
    const meshes = kinds.map((k) => {
      const m = new THREE.Mesh(k.geo, material);
      m.frustumCulled = false;
      m.layers.set(GRASS_LAYER);
      return m;
    });
    return { material, kinds, meshes };
  }, [tier, garden, sway, light]);

  useEffect(
    () => () => {
      built.kinds.forEach((k) => k.geo.dispose());
      built.material.dispose();
    },
    [built]
  );

  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame(({ camera }) => {
    const u = built.material.uniforms;
    u.uCamera.value.copy(camera.position);
    // stems keep pace with the lawn, so the blooms stand just above it
    // (sized as they were among the old lawn's blades, 2.19 m)
    u.uHeight.value = T.flowerHeight * 2.19 * 0.9;
    u.uSize.value = T.flowerSize * Math.sqrt(2.19);
    for (const k of built.kinds) {
      const kindShare = k.kind === "tulip" ? T.tulipDensity : k.kind === "daisy" ? T.daisyDensity : T.spireDensity;
      k.geo.instanceCount = Math.min(Math.round(k.planted * T.flowerDensity * kindShare * Q.density), k.planted);
      // the colours (live from the panel)
      const pal = palette(k.kind);
      const key = pal.join();
      if (key === k.key) continue;
      k.key = key;
      const cols = pal.map((c) => tmp.set(c).toArray());
      const attr = k.geo.attributes.iColor;
      for (let i = 0; i < k.planted; i++) attr.array.set(cols[k.colourOf[i]], i * 3);
      attr.needsUpdate = true;
    }
  });

  return (
    <>
      {built.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}
