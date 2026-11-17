"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../../world/layout";
import { POINTER_WIND_GLSL, SWAY_DECLS } from "../../world/gardenAsset";
import { T } from "../../tuning";
import { Q } from "../../quality";
import { GARDEN_SUN } from "./sky";

// Blossom on the trees: small five-petalled flowers dotted over the
// canopies, one colour to a tree (cherry pink, white, rose, lilac), a share
// of the trees in flower. They are scattered over the leaf clusters' own
// cards, only where the leaf atlas is opaque (so none hang in the air),
// stood a little out from the canopy, and ride the same breeze as the
// leaves under them (the trees' sway in gardenAsset.js, repeated here), so
// they never slide over them. One draw of camera-facing points; the petals
// are drawn in the shader, lit by the sun (and through from behind), and
// glow where the pointer passes, like the flowers below.

// shares of the trees: pink, white, rose, lilac
const PALETTE = [0.4, 0.25, 0.15, 0.2];
const palette = () => [T.treeBlossomPink, T.treeBlossomWhite, T.treeBlossomRose, T.treeBlossomLilac];

const VERTEX = /* glsl */ `
attribute vec3 aPivot; // the leaf cluster's origin (its sway's pivot)
attribute vec4 aSeed; // the tree's turn to flower, its own, colour, size
uniform float uScale;
uniform float uSize;
uniform float uShare;
uniform float uDensity;
uniform vec3 uColors[4];
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vTurn;
${SWAY_DECLS}
${POINTER_WIND_GLSL}
#include <fog_pars_vertex>
void main() {
  vSwGlow = 0.0;
  if (aSeed.x > uShare || fract(aSeed.y * 7.31) > uDensity) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec3 w = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 pivot = (modelMatrix * vec4(aPivot, 1.0)).xyz;
  // the trees' breeze, as their leaves feel it
  float swW = clamp(length(w - pivot) / 1.6, 0.0, 1.0);
  float swSeed = fract(sin(dot(pivot.xz, vec2(12.9898, 78.233))) * 43758.5453);
  float swGust = 0.6 + 0.4 * sin(uTime * 0.9 + pivot.x * 0.21 + pivot.z * 0.17);
  float swFlutter = sin(uTime * 3.1 + swSeed * 6.2831 + w.y * 0.6);
  w += vec3(0.8, 0.0, 0.6) * (swGust * 0.05 + swFlutter * 0.033) * uWindAmount * swW;
  vSwGlow = pointerGlow(w);
  vWorld = w;
  vNormal = normal;
  vColor = uColors[int(aSeed.z + 0.5)] * (0.86 + 0.26 * fract(aSeed.y * 13.7));
  vTurn = aSeed.y * 6.2831 + swFlutter * 0.15;
  vec4 mvPosition = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(uSize * aSeed.w * uScale / max(-mvPosition.z, 0.5), 0.0, 48.0);
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uSunDir;
uniform float uSun;
uniform vec3 uSunColor;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uHeart;
uniform float uGlowStrength;
uniform vec3 uGlowColor;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vTurn;
varying float vSwGlow;
#include <fog_pars_fragment>
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float s = sin(vTurn);
  float k = cos(vTurn);
  c = vec2(c.x * k - c.y * s, c.x * s + c.y * k);
  float r = length(c);
  float a = atan(c.y, c.x);
  // five round petals, each with a small notch at its tip
  float petal = abs(cos(a * 2.5));
  float edge = (0.58 + 0.42 * sqrt(petal)) * 0.96 - 0.1 * smoothstep(0.985, 1.0, petal);
  if (r > edge) discard;
  // deeper at the heart, paler towards the tips, a few stamens
  float t = r / edge;
  vec3 albedo = mix(vColor * vec3(0.92, 0.72, 0.8), vColor, smoothstep(0.15, 0.55, t));
  albedo = mix(albedo, mix(vColor, vec3(1.0), 0.45), smoothstep(0.65, 1.0, t) * 0.5);
  albedo *= 1.0 - (1.0 - petal) * 0.12;
  albedo = mix(uHeart, albedo, smoothstep(0.12, 0.2, r));
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 sun = uSunColor * uSun / 3.14159;
  vec3 col = albedo * (sun * (0.3 + 0.55 * max(dot(N, uSunDir), 0.0)) + mix(uGround, uSky, N.y * 0.5 + 0.5) * 0.38);
  // the sun through the petals from behind
  col += albedo * sun * pow(max(dot(-V, uSunDir), 0.0), 2.0) * 0.45;
  // kept under the bloom's threshold (white blossom would sparkle like
  // snow), so only the pointer's glow makes them shine
  col *= min(0.55 / max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 1e-4), 1.0);
  // lit from within where the pointer passes
  col += (albedo * 2.4 + uGlowColor * 0.9) * vSwGlow * uGlowStrength;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// the leaf atlas's opacity at a uv (read back once, small), or null
function opacityOf(texture) {
  const img = texture?.image;
  if (!img || typeof document === "undefined") return null;
  try {
    const S = 256;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, S, S);
    const data = ctx.getImageData(0, 0, S, S).data;
    // (glTF textures aren't flipped: v runs down the image)
    return (u, v) => {
      const x = Math.min(Math.floor((u - Math.floor(u)) * S), S - 1);
      const y = Math.min(Math.floor((v - Math.floor(v)) * S), S - 1);
      return data[(y * S + x) * 4 + 3] / 255;
    };
  } catch {
    return null;
  }
}

// a geometry's triangles, with their running area (to pick by area)
function triangles(geometry) {
  const p = geometry.attributes.position;
  const idx = geometry.index;
  const n = (idx ? idx.count : p.count) / 3;
  const corner = (t, j) => (idx ? idx.getX(t * 3 + j) : t * 3 + j);
  const run = new Float64Array(n);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < n; t++) {
    a.fromBufferAttribute(p, corner(t, 0));
    b.fromBufferAttribute(p, corner(t, 1)).sub(a);
    c.fromBufferAttribute(p, corner(t, 2)).sub(a);
    total += b.cross(c).length() * 0.5;
    run[t] = total;
  }
  return { run, total, corner };
}

// the first index whose running total reaches x
const pick = (run, x) => {
  let lo = 0;
  let hi = run.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (run[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

function scatter(garden, count, seed) {
  const rng = mulberry32(seed);
  const meshes = [];
  garden.root.traverse((o) => o.isInstancedMesh && o.name === "PlacedTrees:M_Foliage" && meshes.push(o));
  // (the trees' data is let go once on the GPU: a remount after that — a hot
  // reload — goes without blossom)
  if (!meshes.length || !count || meshes.some((mesh) => !mesh.geometry.attributes.position.array)) return null;
  const opacity = opacityOf(meshes[0].material.map);

  // each tree: its turn to flower and its colour
  const trees = garden.trunks.map(() => {
    let p = rng();
    let colour = 0;
    for (; colour < PALETTE.length - 1 && (p -= PALETTE[colour]) > 0; colour++);
    return { turn: rng(), colour };
  });
  const treeOf = (x, z) => {
    let best = 0;
    let bestD = Infinity;
    garden.trunks.forEach((t, i) => {
      const d = (t.x - x) ** 2 + (t.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return trees[best];
  };

  // every tree's leaves (each variant's clusters merged), picked by leaf area
  const tris = new Map();
  const clusters = [];
  let total = 0;
  const m = new THREE.Matrix4();
  const col = new THREE.Vector3();
  for (const mesh of meshes) {
    if (!tris.has(mesh.geometry)) tris.set(mesh.geometry, triangles(mesh.geometry));
    const g = tris.get(mesh.geometry);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      total += g.total * col.setFromMatrixColumn(m, 0).lengthSq();
      const pivot = new THREE.Vector3().setFromMatrixPosition(m);
      clusters.push({ geometry: mesh.geometry, g, matrix: m.clone(), pivot, tree: treeOf(pivot.x, pivot.z), at: total });
    }
  }
  const clusterRun = clusters.map((c) => c.at);

  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const pivots = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const out = new THREE.Vector3();
  const piv = new THREE.Vector3();
  let k = 0;
  for (let tries = 0; k < count && tries < count * 8; tries++) {
    const cl = clusters[pick(clusterRun, rng() * total)];
    const { run, corner } = cl.g;
    const t = pick(run, rng() * cl.g.total);
    let u = rng();
    let v = rng();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    const i0 = corner(t, 0);
    const i1 = corner(t, 1);
    const i2 = corner(t, 2);
    // only on the leaves themselves
    const uv = cl.geometry.attributes.uv;
    if (opacity && uv && opacity(uv.getX(i0) * w + uv.getX(i1) * u + uv.getX(i2) * v, uv.getY(i0) * w + uv.getY(i1) * u + uv.getY(i2) * v) < 0.5) continue;
    const pos = cl.geometry.attributes.position;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    p.copy(a).multiplyScalar(w).addScaledVector(b, u).addScaledVector(c, v).applyMatrix4(cl.matrix);
    n.subVectors(b, a).cross(c.sub(a)).transformDirection(cl.matrix);
    // its leaf cluster's own origin (the trees are merged: carried per vertex)
    const ap = cl.geometry.attributes.aPivot;
    const pv = ap ? piv.fromBufferAttribute(ap, i0).applyMatrix4(cl.matrix) : cl.pivot;
    // facing out of the canopy, stood a little off the leaves
    out.subVectors(p, pv).normalize();
    if (n.dot(out) < 0) n.negate();
    p.addScaledVector(n, 0.05);
    n.multiplyScalar(0.4).addScaledVector(out, 0.6).add(a.set(0, 0.2, 0)).normalize();
    position.set([p.x, p.y, p.z], k * 3);
    normal.set([n.x, n.y, n.z], k * 3);
    pivots.set([pv.x, pv.y, pv.z], k * 3);
    seeds.set([cl.tree.turn, rng(), cl.tree.colour, 0.7 + rng() * 0.6], k * 4);
    k++;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position.subarray(0, k * 3), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal.subarray(0, k * 3), 3));
  geometry.setAttribute("aPivot", new THREE.BufferAttribute(pivots.subarray(0, k * 3), 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds.subarray(0, k * 4), 4));
  geometry.computeBoundingSphere();
  return geometry;
}

export default function GardenBlossoms({ tier, garden, sway, light }) {
  const built = useMemo(() => {
    const geometry = scatter(garden, tier.gardenBlossoms || 0, 5150);
    if (!geometry) return null;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsLib.fog,
        ...sway,
        uScale: { value: 1000 },
        uSize: { value: 0.24 },
        uShare: { value: 1 },
        uDensity: { value: 1 },
        uColors: { value: palette().map((c) => new THREE.Color(c)) },
        uHeart: { value: new THREE.Color("#f0c048") },
        uSunDir: { value: GARDEN_SUN.clone() },
        uSun: { value: 3 },
        uSunColor: { value: new THREE.Color("#fff0d8") },
        uSky: { value: new THREE.Color("#bcd5ee") },
        uGround: { value: new THREE.Color("#5d6b3e") },
        // (the garden's light, by day and night: Garden.jsx)
        ...light,
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      fog: true,
    });
    const points = new THREE.Points(geometry, material);
    // the point size per target (the screen, the pond's smaller mirror)
    const buf = new THREE.Vector2();
    points.onBeforeRender = (renderer, _scene, cam) => {
      const rt = renderer.getRenderTarget();
      const h = rt ? rt.height : renderer.getDrawingBufferSize(buf).y;
      material.uniforms.uScale.value = (h * cam.projectionMatrix.elements[5]) / 2;
      material.uniformsNeedUpdate = true;
    };
    return { geometry, material, points, key: "" };
  }, [tier, garden, sway, light]);

  useEffect(
    () => () => {
      built?.geometry.dispose();
      built?.material.dispose();
    },
    [built]
  );

  useFrame(() => {
    if (!built) return;
    const u = built.material.uniforms;
    u.uShare.value = T.treeBlossomShare;
    u.uDensity.value = T.treeBlossomDensity * Q.density;
    u.uSize.value = 0.24 * T.treeBlossomSize;
    const pal = palette();
    const key = pal.join();
    if (key !== built.key) {
      built.key = key;
      pal.forEach((c, i) => u.uColors.value[i].set(c));
    }
  });

  return built ? <primitive object={built.points} /> : null;
}
