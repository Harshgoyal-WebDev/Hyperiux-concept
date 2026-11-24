"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects and uniforms are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise2D, createNoise3D } from "simplex-noise";
import { NOISE, PALETTE } from "./shaders/common";
import { mulberry32 } from "./rand";

// The world the hands meet in: a desert at the edge of night.
//   Sky       – night overhead, the Milky Way crossing it from the top
//               towards the upper right, stars; peach and orange low down,
//               strongest where the sun is setting, small, on the right
//   Dunes     – dark rippled dunes running to the horizon, their crests lit
//               warm by the low sun, hazing into the glow far off
//   Mountains – low ranges along the horizon, the sun between them
//   Rivers    – streams of molten light winding over the dunes from near
//               the hands towards the sun, a branch running off right, the
//               sand glowing round them
//   Rocks     – dark shards hanging in the air round the hands; rocks on
//               the dunes with glowing cracks
// The hands meet at the origin; the camera looks down −z, the ground well
// below them (GROUND_Y).

export const GROUND_Y = -34;
// the sun: low on the horizon, right of the way the camera looks
const SUN_AZ = THREE.MathUtils.degToRad(12);
const SUN_EL = THREE.MathUtils.degToRad(0.45);
export const SUN_DIR = new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ) * Math.cos(SUN_EL));
const dirAt = (azDeg, elDeg) => {
  const a = THREE.MathUtils.degToRad(azDeg);
  const e = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
};
// the Milky Way's great circle: from high in the middle of the sky down
// towards the upper right
// (crossing the upper sky in frame: from the top middle towards the upper right)
const MW_POLE = new THREE.Vector3().crossVectors(dirAt(-6, 4), dirAt(24, 24)).normalize();
const MW_CORE = dirAt(9, 13);

// ---- the rivers' paths (in the ground's plane) ---------------------------------
const RIVERS = [
  // through the near valley: in from the lower left, snaking across, then
  // along the foot of the great dune on the right and off out of the frame
  [[-180, -58], [-120, -54], [-70, -66], [-36, -100], [-14, -146], [26, -160], [66, -132], [98, -108], [134, -96], [176, -90], [230, -96], [310, -104], [420, -112]],
  // through the middle distance, from the left towards the dune's far side
  [[-110, -250], [-56, -290], [-6, -316], [44, -300], [80, -336], [96, -420], [120, -520]],
  // far off, threading on towards the horizon beyond the dune
  [[196, -470], [236, -560], [262, -680], [330, -820]],
];
const GLOW_BOX = { x0: -260, z0: -1000, w: 900, d: 1040 };

function riverCurves() {
  return RIVERS.map((pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal", 0.5));
}

// ---- the ground's shape (also where rocks and rivers sit) -------------------
const n2 = createNoise2D(mulberry32(5));
function duneShape(x, z) {
  // ridged dunes: smooth rolling flanks up to sharp crests, running across the
  // view at a slant, warped so no two are alike
  const wx = x + n2(x * 0.004, z * 0.004) * 45;
  const wz = z + n2(x * 0.004 + 9, z * 0.004) * 45;
  // (crests rounded a little: |n| softened, so far off they never read as teeth)
  const softAbs = (v) => Math.sqrt(v * v + 0.012);
  const r1 = Math.max(1 - softAbs(n2(wx * 0.0042 + wz * 0.0018, wz * 0.0072 - wx * 0.0014)), 0);
  const r2 = Math.max(1 - softAbs(n2(wx * 0.011 + 5, wz * 0.015 - 3)), 0);
  // (large, smooth, rolling: soft flanks, the crests only gently sharp)
  let h = Math.pow(r1, 1.7) * 15 + Math.pow(r2, 2.2) * 1.8 + (0.5 + 0.5 * n2(x * 0.0021 + 4, z * 0.0021)) * 4;
  // (the big dunes framing the view: rising either side, near by)
  const side = THREE.MathUtils.smoothstep(Math.abs(x + 6), 34, 115) * (1 - THREE.MathUtils.smoothstep(-z, 240, 640));
  h += side * 19 * (0.7 + 0.3 * n2(x * 0.01, z * 0.01));
  // (the open valley in front, the dunes lower there)
  h *= 1 - 0.45 * Math.exp(-Math.pow((x - 20) / 120, 2)) * (1 - THREE.MathUtils.smoothstep(-z, 120, 360));
  // the great dune on the right: rising from the horizon to above it at the
  // frame's edge, its crest running back from near the right edge towards the sun
  {
    const ax = 150, az = -440, bx = 124, bz = -128;
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    const t = Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / L2, -0.2), 1.25);
    const px = ax + dx * t, pz = az + dz * t;
    const across = (x - px) * (dz / Math.sqrt(L2)) - (z - pz) * (dx / Math.sqrt(L2));
    // (a gentle windward flank on the far side, a steeper face towards us)
    const w = across > 0 ? 70 : 42;
    const rise = THREE.MathUtils.smoothstep(t, -0.15, 0.35) * (1 - THREE.MathUtils.smoothstep(t, 1.0, 1.22));
    h += Math.exp(-Math.pow(across / w, 2)) * (12 + 27 * THREE.MathUtils.smoothstep(t, 0.2, 1.0)) * rise;
  }
  // (a broad low basin through the middle, the rivers winding through it, the
  // dunes rising round it)
  const basin = Math.exp(-Math.pow((x - 120) / 210, 2)) * (1 - THREE.MathUtils.smoothstep(-z, 380, 650));
  h *= 1 - 0.4 * basin;
  // (lower still along the rivers' way to the horizon: they show, winding off)
  const corridor = Math.exp(-Math.pow((x - 70 - (-z - 150) * 0.25) / 110, 2)) * THREE.MathUtils.smoothstep(-z, 120, 220) * (1 - THREE.MathUtils.smoothstep(-z, 700, 950));
  h *= 1 - 0.55 * corridor;
  // (the near ground low and open: we look down across it, the rivers in view)
  const near = (1 - THREE.MathUtils.smoothstep(-z, 70, 230)) * (1 - THREE.MathUtils.smoothstep(Math.abs(x + 8), 70, 160));
  h *= 1 - 0.55 * near;
  return GROUND_Y + h + n2(x * 0.03, z * 0.03) * 0.3;
}


// The rivers run in channels: the dunes carved down round them (a spatial
// hash of points along them, for the distance to the nearest).
const RIVER_PTS = new Map();
const CELL = 40;
for (const c of riverCurves()) {
  for (const p of c.getSpacedPoints(Math.ceil(c.getLength() / 3))) {
    const k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!RIVER_PTS.has(k)) RIVER_PTS.set(k, []);
    RIVER_PTS.get(k).push(p.x, p.z);
  }
}
function riverDistance(x, z) {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  let best = Infinity;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const list = RIVER_PTS.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (let k = 0; k < list.length; k += 2) best = Math.min(best, (list[k] - x) ** 2 + (list[k + 1] - z) ** 2);
    }
  }
  return Math.sqrt(best);
}
export function duneHeight(x, z) {
  const h = duneShape(x, z);
  const d = riverDistance(x, z);
  if (!Number.isFinite(d)) return h;
  // (a valley either side, its floor near level, the river along its middle)
  const k = Math.exp(-Math.pow(d / 22, 2));
  const floor = GROUND_Y + 0.5 + n2(x * 0.01, z * 0.01) * 0.3;
  return THREE.MathUtils.lerp(h, Math.min(h, floor), k);
}

// ---- the sky's colour (shared by the sky, and the haze over the ground) -----
const SKY = /* glsl */ `
uniform vec3 uSun;
vec3 horizonGlow(vec3 d) {
  vec2 a = normalize(d.xz + 1e-5);
  vec2 s = normalize(uSun.xz);
  float toSun = max(dot(a, s), 0.0);
  // dusky rose-brown low down all round, peach and orange towards the sun
  // (colours in linear light: they brighten a good deal on screen)
  vec3 away = vec3(0.012, 0.0045, 0.0045);
  vec3 near = vec3(0.32, 0.075, 0.018);
  return mix(away, near, pow(toSun, 8.0)) + vec3(0.9, 0.3, 0.06) * pow(toSun, 70.0) * 0.45;
}
vec3 skyBase(vec3 d) {
  float h = d.y;
  vec3 zen = vec3(0.0009, 0.001, 0.0022);
  vec3 mid = vec3(0.004, 0.0022, 0.0028);
  vec3 col = mix(mid, zen, smoothstep(0.06, 0.6, h));
  // (the glow hugging the horizon: higher towards the sun)
  vec2 a = normalize(d.xz + 1e-5);
  float toSun = max(dot(a, normalize(uSun.xz)), 0.0);
  col = mix(horizonGlow(d), col, smoothstep(-0.01, mix(0.06, 0.2, pow(toSun, 4.0)), h));
  return col;
}
`;

const SKY_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  gl_Position.z = gl_Position.w;
}
`;
const SKY_FRAGMENT = /* glsl */ `
${PALETTE}
${NOISE}
${SKY}
uniform float uTime;
uniform vec3 uMwN;
uniform vec3 uMwC;
varying vec3 vWorld;
float starLayer(vec3 d, float cells, float chance, float size) {
  vec3 g = d * cells;
  vec3 c = floor(g);
  float r = h13(c);
  vec3 o = vec3(h13(c + 1.7), h13(c + 3.1), h13(c + 5.3)) - 0.5;
  float dist = length(fract(g) - 0.5 - o * 0.6);
  float tw = 0.8 + 0.2 * sin(uTime * (1.0 + 2.0 * h13(c + 7.7)) + r * 40.0);
  return step(1.0 - chance, r) * (1.0 - smoothstep(0.0, size, dist)) * mix(0.35, 2.2, pow(h13(c + 9.0), 3.0)) * tw;
}
float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  float h = d.y;
  vec3 col = skyBase(d);
  float s = max(dot(d, uSun), 0.0);
  // the sun's glow
  col += vec3(1.0, 0.4, 0.1) * pow(s, 40.0) * 0.07 + vec3(1.0, 0.55, 0.25) * pow(s, 600.0) * 0.45;
  // the sun: a small bright disc on the horizon
  float disc = 1.0 - smoothstep(0.0085, 0.0102, acos(clamp(s, -1.0, 1.0)));
  col = mix(col, vec3(1.0, 0.74, 0.46) * 2.6, disc);
  // the night: the Milky Way and stars, fading out into the glow low down
  float up = smoothstep(0.04, 0.32, h);
  float b = dot(d, uMwN) + (fbm3(d * 3.0) - 0.5) * 0.05;
  float body = exp(-pow(b / 0.03, 2.0));
  float core = exp(-pow(b / 0.012, 2.0));
  float bulge = pow(max(dot(d, uMwC), 0.0), 5.0);
  float clouds = smoothstep(0.34, 0.78, fbm3(d * 60.0 + 2.0)) * (0.35 + 0.65 * smoothstep(0.32, 0.72, fbm3(d * 200.0)));
  float dust = clamp((1.0 - smoothstep(0.0, 0.06, abs(fbm3(d * 14.0 + 4.0) - 0.5))) * 0.7 * body + exp(-pow((b - 0.004) / 0.012, 2.0)) * 0.85 * smoothstep(0.3, 0.6, fbm3(d * 8.0)), 0.0, 0.92);
  // (rose and violet at its heart, pale blue at its edges, dark lanes of dust)
  vec3 tone = mix(vec3(0.2, 0.22, 0.48), vec3(0.85, 0.42, 0.6), clamp(core * 1.2 + bulge * 0.6, 0.0, 1.0));
  tone = mix(tone, vec3(1.0, 0.86, 0.9), clamp(core * clouds * (0.4 + bulge) * 1.4, 0.0, 0.8));
  vec3 mw = tone * body * clouds * (1.0 - dust) * (0.5 + 2.2 * bulge) * 0.26;
  mw += vec3(0.006, 0.006, 0.014) * exp(-pow(b / 0.09, 2.0)) * (0.5 + bulge);
  col += mw * up;
  float stars = starLayer(d, 150.0, 0.07 + 0.3 * body, 0.12) + starLayer(d, 380.0, 0.1 + 0.85 * body, 0.16) * 0.75 + starLayer(d, 900.0, 0.14 + 0.9 * body, 0.22) * 0.55 + starLayer(d, 1800.0, 0.05 + 0.95 * body, 0.28) * 0.4;
  col += vec3(0.85, 0.88, 1.0) * stars * up * 0.7;
  gl_FragColor = vec4(col, 1.0);
}
`;

const DUNE_VERTEX = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const DUNE_FRAGMENT = /* glsl */ `
${PALETTE}
${NOISE}
${SKY}
uniform float uTime;
uniform sampler2D uGlow;
uniform vec4 uGlowBox; // x0, z0, width, depth of the rivers' glow map
uniform float uFade;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = vWorld - cameraPosition;
  float dist = length(v);
  // wind ripples over the sand, fading with distance
  float rf = 1.0 - smoothstep(40.0, 220.0, dist);
  if (rf > 0.0) {
    vec2 rd = normalize(vec2(0.82, 0.57));
    float r = dot(vWorld.xz, rd) * 3.4 + vnoise(vec3(vWorld.xz * 0.06, 0.0)) * 6.0;
    vec3 t = normalize(vec3(rd.x, 0.0, rd.y));
    n = normalize(n + t * cos(r) * 0.16 * rf);
  }
  // the low sun from the right: the slopes facing it lit warm, the rest in shade
  float sunL = max(dot(n, normalize(uSun + vec3(0.0, 0.12, 0.0))), 0.0);
  vec3 sand = vec3(0.05, 0.028, 0.018);
  vec3 col = sand * (vec3(1.0, 0.48, 0.2) * pow(sunL, 1.4) * 2.4 + vec3(0.06, 0.045, 0.06));
  // the crests rimmed with light: where the sand turns away from us towards the
  // sun behind, it catches the glow
  float grazing = pow(1.0 - max(dot(normalize(vNormal), normalize(-v)), 0.0), 3.0);
  col += vec3(0.75, 0.22, 0.04) * grazing * smoothstep(0.0, 0.5, sunL) * 1.3;
  // the rivers' light on the sand round them
  vec2 guv = (vWorld.xz - uGlowBox.xy) / uGlowBox.zw;
  if (guv.x > 0.0 && guv.x < 1.0 && guv.y > 0.0 && guv.y < 1.0) {
    float g = texture2D(uGlow, guv).r;
    col += ORANGE * g * g * 0.8 + AMBER * pow(g, 4.0) * 0.45;
  }
  // haze: far off, the dunes go into the glow of the horizon
  // (thin near, thickening only towards the horizon)
  vec3 dir = v / dist;
  float fog = 1.0 - exp(-pow(dist * 0.0008, 1.4));
  col = mix(col, horizonGlow(dir) * 0.5, fog);
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

const MOUNTAIN_FRAGMENT = /* glsl */ `
${PALETTE}
${SKY}
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 v = vWorld - cameraPosition;
  vec3 dir = normalize(v);
  // silhouettes, a little lighter than the dunes, hazed into the glow
  vec3 col = mix(vec3(0.006, 0.0032, 0.0035), horizonGlow(dir) * 0.6, 0.55);
  gl_FragColor = vec4(col, 1.0);
}
`;

const RIVER_VERTEX = /* glsl */ `
attribute vec2 aRiver; // across (−1..1), along (m)
varying vec2 vR;
varying float vDist;
void main() {
  vR = aRiver;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vDist = length(w.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const RIVER_FRAGMENT = /* glsl */ `
${PALETTE}
uniform float uTime;
uniform float uLen;
uniform float uLevel;
varying vec2 vR;
varying float vDist;
void main() {
  float x = vR.x;
  float core = exp(-x * x * 9.0);
  float hot = exp(-x * x * 60.0);
  // (light pulsing along it, flowing away towards the sun)
  float flow = 0.75 + 0.25 * sin(vR.y * 0.18 - uTime * 1.6) * sin(vR.y * 0.047 + uTime * 0.5);
  float ends = smoothstep(0.0, 18.0, vR.y) * (1.0 - smoothstep(uLen - 60.0, uLen, vR.y));
  vec3 col = (ORANGE * core * 2.8 + AMBER * hot * 3.2) * flow * ends;
  // (far off, it fades into the haze)
  col *= mix(1.0, 0.6, smoothstep(200.0, 1400.0, vDist));
  gl_FragColor = vec4(col * uLevel, 1.0);
}
`;

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

// ---- the sky -----------------------------------------------------------------
export function Sky({ uniforms }) {
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(4000, 64, 32),
      new THREE.ShaderMaterial({
        uniforms: { uTime: uniforms.uTime, uSun: { value: SUN_DIR }, uMwN: { value: MW_POLE }, uMwC: { value: MW_CORE } },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    m.frustumCulled = false;
    m.renderOrder = -20;
    return m;
  }, [uniforms]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
    [mesh]
  );
  useFrame(({ camera }) => mesh.position.copy(camera.position));
  return <primitive object={mesh} />;
}

function glowTexture(curves) {
  const W = 1024;
  const H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const toPx = (p) => [((p.x - GLOW_BOX.x0) / GLOW_BOX.w) * W, ((p.z - GLOW_BOX.z0) / GLOW_BOX.d) * H];
  for (const [blur, width, alpha] of [
    [22, 30, 0.3],
    [9, 11, 0.5],
    [3, 3.5, 0.85],
  ]) {
    ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    for (const curve of curves) {
      ctx.beginPath();
      curve.getSpacedPoints(400).forEach((p, i) => {
        const [x, y] = toPx(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}

// ---- the dunes, the mountains, the rivers -------------------------------------
function duneGeometry(segX, segZ) {
  const pos = [];
  const idx = [];
  // (denser near the camera and down the middle, sparse far off)
  for (let j = 0; j <= segZ; j++) {
    const tz = j / segZ;
    const z = 120 - Math.pow(tz, 1.9) * 3400;
    for (let i = 0; i <= segX; i++) {
      const u = (i / segX) * 2 - 1;
      const x = Math.sign(u) * Math.pow(Math.abs(u), 1.7) * (700 + 2600 * tz);
      pos.push(x, duneHeight(x, z), z);
    }
  }
  for (let j = 0; j < segZ; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * (segX + 1) + i;
      const b = a + 1;
      const c = a + segX + 1;
      const d = c + 1;
      // (wound to face up)
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function mountainGeometry() {
  const pos = [];
  const idx = [];
  const N = 360;
  const R = 2900;
  for (let i = 0; i <= N; i++) {
    const az = THREE.MathUtils.degToRad(-95 + (i / N) * 190);
    // (low near the sun, between two ranges)
    const nearSun = Math.exp(-Math.pow((az - SUN_AZ) / 0.09, 2));
    const ridge = 0.5 + 0.5 * n2(az * 6, 3) + 0.25 * n2(az * 19, 7);
    const top = GROUND_Y + 10 + ridge * 52 * (1 - nearSun * 0.8) + Math.abs(n2(az * 3, 11)) * 32;
    const x = Math.sin(az) * R;
    const z = -Math.cos(az) * R;
    pos.push(x, GROUND_Y - 20, z, x, top, z);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function riverGeometry(curve) {
  const N = 900;
  const pts = curve.getSpacedPoints(N);
  const len = curve.getLength();
  const pos = [];
  const attr = [];
  const idx = [];
  const side = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const p = pts[i];
    const q = pts[Math.min(i + 1, N)];
    const o = pts[Math.max(i - 1, 0)];
    side.set(-(q.z - o.z), 0, q.x - o.x).normalize();
    // (wider far off, so it still reads as a line of light at the horizon)
    const w = 0.6 + Math.hypot(p.x, p.z) * 0.0035;
    for (const s of [-1, 1]) {
      const x = p.x + side.x * w * s;
      const z = p.z + side.z * w * s;
      // (lifted a touch: the ground's mesh rides a little above its valley floor)
      pos.push(x, duneHeight(x, z) + 0.9 + Math.hypot(x, z) * 0.002, z);
      attr.push(s, (i / N) * len);
    }
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aRiver", new THREE.Float32BufferAttribute(attr, 2));
  g.setIndex(idx);
  return { geometry: g, length: len };
}

export function Ground({ uniforms, tier }) {
  const built = useMemo(() => {
    const curves = riverCurves();
    const glow = glowTexture(curves);
    const seg = tier.name === "low" ? [160, 150] : [300, 260];
    const dunes = new THREE.Mesh(
      duneGeometry(seg[0], seg[1]),
      new THREE.ShaderMaterial({
        uniforms: { uTime: uniforms.uTime, uSun: { value: SUN_DIR }, uGlow: { value: glow }, uGlowBox: { value: new THREE.Vector4(GLOW_BOX.x0, GLOW_BOX.z0, GLOW_BOX.w, GLOW_BOX.d) }, uFade: { value: 1 } },
        vertexShader: DUNE_VERTEX,
        fragmentShader: DUNE_FRAGMENT,
      })
    );
    const mountains = new THREE.Mesh(
      mountainGeometry(),
      new THREE.ShaderMaterial({ uniforms: { uSun: { value: SUN_DIR } }, vertexShader: DUNE_VERTEX, fragmentShader: MOUNTAIN_FRAGMENT, side: THREE.DoubleSide })
    );
    const rivers = curves.map((c, i) => {
      const { geometry, length } = riverGeometry(c);
      const m = new THREE.Mesh(
        geometry,
        new THREE.ShaderMaterial({ uniforms: { uTime: uniforms.uTime, uLen: { value: length }, uLevel: { value: i === 0 ? 1 : 1.25 } }, vertexShader: RIVER_VERTEX, fragmentShader: RIVER_FRAGMENT, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, ...additive })
      );
      m.renderOrder = 1;
      return m;
    });
    for (const o of [dunes, mountains, ...rivers]) o.frustumCulled = false;
    return { dunes, mountains, rivers, glow };
  }, [uniforms, tier.name]);
  useEffect(
    () => () => {
      built.glow.dispose();
      for (const o of [built.dunes, built.mountains, ...built.rivers]) {
        o.geometry.dispose();
        o.material.dispose();
      }
    },
    [built]
  );
  return (
    <>
      <primitive object={built.mountains} />
      <primitive object={built.dunes} />
      {built.rivers.map((r, i) => (
        <primitive key={i} object={r} />
      ))}
    </>
  );
}

// ---- the rocks -------------------------------------------------------------------
function rockGeometry(seed, stretch) {
  const n3 = createNoise3D(mulberry32(seed));
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + n3(v.x * 1.1, v.y * 1.1, v.z * 1.1) * 0.32 + n3(v.x * 3, v.y * 3, v.z * 3) * 0.08);
    v.multiply(stretch);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
// (floating: [x, y, z, size, seed]; on the ground: [x, z, size, seed])
const FLOATING = [
  [-17, 9.5, -5, 0.95, 11],
  [-26, 4.6, -5, 0.8, 12],
  [-24, 1.2, -3, 1.05, 13],
  [22, -2.6, -10, 0.38, 14],
  [24, -3.6, -12, 0.32, 15],
  [26.5, -1.4, -14, 0.18, 16],
  [20.5, -4.6, -9, 0.14, 17],
  [28, -3.0, -16, 0.12, 18],
];
const GROUNDED = [
  [60, -112, 7.2, 21],
  [-4, -64, 1.9, 22],
  [46, -56, 2.4, 23],
  [-70, -150, 2.6, 24],
];

export function Rocks({ uniforms }) {
  const built = useMemo(() => {
    const base = new THREE.MeshStandardMaterial({ color: new THREE.Color("#2d211b"), roughness: 0.92, metalness: 0, flatShading: true });
    // the ground rocks: the same stone, cracked through with molten light
    const cracked = base.clone();
    cracked.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vRockP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvRockP = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nuniform float uTime;\nvarying vec3 vRockP;\n${NOISE}`)
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          float cr = abs(vnoise(vRockP * 3.2) - 0.5) + abs(vnoise(vRockP * 7.0 + 3.0) - 0.5) * 0.5;
          float crack = 1.0 - smoothstep(0.02, 0.07, cr);
          float pulse = 0.8 + 0.2 * sin(uTime * 1.3 + vRockP.x * 3.0);
          totalEmissiveRadiance += vec3(1.0, 0.16, 0.0) * crack * 5.0 * pulse + vec3(1.0, 0.45, 0.07) * pow(crack, 4.0) * 3.0;`
        );
    };
    const rng = mulberry32(77);
    const floating = FLOATING.map(([x, y, z, s, seed]) => {
      const m = new THREE.Mesh(rockGeometry(seed, new THREE.Vector3(1.3, 0.75, 1)), base);
      m.position.set(x, y, z);
      m.scale.setScalar(s);
      m.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      m.userData = { y, spin: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.25), phase: rng() * 6 };
      return m;
    });
    const grounded = GROUNDED.map(([x, z, s, seed]) => {
      const m = new THREE.Mesh(rockGeometry(seed, new THREE.Vector3(1.4, 0.7, 1.1)), cracked);
      m.position.set(x, duneHeight(x, z) + s * 0.25, z);
      m.scale.setScalar(s);
      m.rotation.set(rng() * 0.4, rng() * 6, rng() * 0.4);
      return m;
    });
    return { base, cracked, floating, grounded };
  }, [uniforms]);
  useEffect(
    () => () => {
      built.base.dispose();
      built.cracked.dispose();
      [...built.floating, ...built.grounded].forEach((m) => m.geometry.dispose());
    },
    [built]
  );
  useFrame((_, delta) => {
    const t = uniforms.uTime.value;
    const dt = Math.min(delta, 0.1);
    for (const m of built.floating) {
      const u = m.userData;
      m.position.y = u.y + Math.sin(t * 0.5 + u.phase) * 0.35;
      m.rotation.x += u.spin.x * dt;
      m.rotation.y += u.spin.y * dt;
      m.rotation.z += u.spin.z * dt;
    }
  });
  return (
    <>
      {/* the low sun from the right, and the dusk sky's dim light */}
      <directionalLight position={[SUN_DIR.x * 100, 14, SUN_DIR.z * 100]} color="#ff7a3a" intensity={3.2} />
      <hemisphereLight args={["#3a2c48", "#2a1408", 0.5]} />
      {built.floating.map((m, i) => (
        <primitive key={`f${i}`} object={m} />
      ))}
      {built.grounded.map((m, i) => (
        <primitive key={`g${i}`} object={m} />
      ))}
    </>
  );
}
