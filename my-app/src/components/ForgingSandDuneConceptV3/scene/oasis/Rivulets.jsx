"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { T } from "../../tuning";
import { OASIS_RECT, TREE, WATER_Y } from "../../world/oasis";
import { NO_MIRROR_LAYER } from "../../config";
import { REVEAL_GLSL } from "../../world/revealMap";
import { mulberry32 } from "../../world/layout";

// The light that runs out over the sand ahead of the oasis — after the
// reference (hyperiux-orb-bloom's surface, frame by frame): not lines but
// threads, tens of thousands of short glowing streaks of light flowing
// over the ground.
//   streams   along each of world/revealMap.js's rivulets: a braid of a few
//             strands of threads, with loose drops beside it, flowing on
//             outwards all the while (in real time) behind a front that
//             reaches further as the scroll goes on, brightest at the front
//   swirls    round the tree: bands of thread-light turning slowly round it,
//             spreading out over the ground with the reveal, broken into
//             arcs — the swirling rings the reference's ground is laced with
// Each is a soft capsule from where the thread was a moment ago to where it
// is now (so it reads as moving light, not dots), and they dim as the oasis
// comes up under them (the map's own timing).
// Every thread's place is a pure function of the reveal's clock (J.revealR)
// and the time, worked out in the vertex shader: scrolling back plays it back.

const PN = 128; // points along each rivulet (+1: its timing)
const STRANDS = 5;
const PER_STREAM = 640; // threads in each rivulet
const SWIRLS = 22000; // threads in the swirls
const BANDS = 18;
const WINDOW = 150; // a rivulet's threads run in the last this many metres behind its front
const HCELL = 5; // m, the height map's

const VERTEX = /* glsl */ `
precision highp float;
attribute vec4 aM; // role (0 stream, 1 swirl), row / band, where it starts (0..1), speed
attribute vec4 aN; // offset across (m), width (m), brightness, seed
uniform sampler2D uPaths;
uniform sampler2D uHeight;
uniform vec4 uHRect;
uniform float uClock;
uniform float uTime;
uniform float uAspect;
uniform float uPx;
uniform float uGain;
uniform vec2 uParts; // on/off: the rivulets running out (x), the swirls round the tree (y)
uniform float uWindow;
uniform float uEnd;
uniform vec3 uC;
uniform vec3 uColor;
uniform vec3 uHot;
${REVEAL_GLSL}
varying vec3 vCol;
varying vec2 vQ;
varying float vL;
const float PN = ${PN.toFixed(1)};

float groundAt(vec2 xz) {
  vec2 uv = clamp((xz - uHRect.xy) * uHRect.zw, 0.0, 1.0);
  return texture2D(uHeight, uv).r;
}
// a rivulet at arc length s: where, and which way it runs
vec3 pathAt(int row, float s, float L, out vec2 dir) {
  float u = clamp(s / L, 0.0, 1.0) * (PN - 1.0);
  float i = min(floor(u), PN - 2.0);
  float f = u - i;
  vec4 a = texelFetch(uPaths, ivec2(int(i), row), 0);
  vec4 b = texelFetch(uPaths, ivec2(int(i) + 1, row), 0);
  float da = b.w - a.w;
  da -= 6.2831853 * floor(da / 6.2831853 + 0.5);
  float ang = a.w + da * f;
  dir = vec2(cos(ang), sin(ang));
  return mix(a.xyz, b.xyz, f);
}
// where the thread is at clock c and time t, and how lit
vec3 threadAt(float c, float t, bool needLit, out float lit) {
  float seed = aN.w;
  vec3 p;
  if (aM.x < 0.5) {
    // a rivulet: it reaches further as the clock goes (fast at first, then
    // slowing), its threads flowing on along its last stretch behind the front
    int row = int(aM.y);
    vec4 m = texelFetch(uPaths, ivec2(int(PN), row), 0); // t0, dur, L
    float x = clamp((c - m.x) / m.y, 0.0, 1.0);
    float reach = m.z * (1.0 - (1.0 - x) * (1.0 - x));
    float s = reach - uWindow * (1.0 - fract(aM.z + t * aM.w / uWindow));
    float vis = step(0.0, s) * smoothstep(0.0, 0.01, x);
    // (not running yet, or behind its run: nothing more to work out)
    if (vis <= 0.0) { lit = 0.0; return vec3(0.0); }
    float front = exp(-pow((reach - s) / 7.0, 2.0)) * (1.0 - 0.6 * x);
    // (the far end of its run thins away)
    float tail = smoothstep(0.0, 0.35, (s - (reach - uWindow)) / uWindow);
    lit = vis * tail * (0.7 + 2.4 * front * smoothstep(20.0, 80.0, reach)) * (1.0 - 0.55 * smoothstep(0.85, 1.0, x));
    // (coming in as they reach out from under the orb — its falling sparks
    // carry the first spread — not a bright disc with a hard edge at first)
    lit *= smoothstep(5.0, 60.0, reach);
    vec2 dir;
    p = pathAt(row, max(s, 0.0), m.z, dir);
    p.xz += vec2(-dir.y, dir.x) * (aN.x + sin(s * 0.35 + seed * 30.0 + t * 0.9) * 0.35);
  } else {
    // a swirl: a band of thread-light round the tree, turning slowly, spread
    // out with the clock, broken into arcs that drift round it
    float band = aM.y;
    float F = max(c, 0.0);
    float rho = F * (0.18 + 0.82 * band / ${BANDS.toFixed(1)}) + aN.x;
    rho += sin(seed * 20.0 + t * 0.35) * 1.5;
    float dirn = mod(band, 2.0) < 0.5 ? 1.0 : -1.0;
    float th = aM.z * 6.2831853 + dirn * t * aM.w / max(rho, 20.0) + 0.25 * sin(rho * 0.02 + t * 0.2);
    p = uC + vec3(cos(th), 0.0, sin(th)) * rho;
    float arc = smoothstep(0.35, 0.85, 0.5 + 0.5 * sin(th * (3.0 + mod(band, 3.0)) + band * 1.7 + t * 0.05));
    lit = arc * smoothstep(8.0, 40.0, F) * (1.0 - smoothstep(uEnd * 0.6, uEnd, F)) * 0.85;
    if (lit <= 0.002) return p;
  }
  p.y = groundAt(p.xz) + 0.18;
  // (dimming as the oasis comes up under it; the tail end of the streak
  // needs only its place)
  if (needLit) lit *= 1.0 - 0.7 * ncReveal(p.xz);
  return p;
}

void main() {
  float lit;
  vec3 p1 = threadAt(uClock, uTime, true, lit);
  float bright = aN.z * lit * uGain * (aM.x < 0.5 ? uParts.x : uParts.y) * (0.78 + 0.22 * sin(uTime * (2.0 + 3.0 * aN.w) + aN.w * 40.0));
  if (bright < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float lit0;
  vec3 p0 = threadAt(uClock, uTime - 0.3, false, lit0);
  if (lit0 <= 0.0) p0 = p1;
  // (a wrap back to the start of its run: no streak drawn back along it)
  if (distance(p0, p1) > 12.0) p0 = p1;
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 c1 = vp * vec4(p1, 1.0);
  vec4 c0 = vp * vec4(p0, 1.0);
  if (c1.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (c0.w < 0.05) c0 = c1;
  vec2 s1 = c1.xy / c1.w;
  vec2 s0 = c0.xy / c0.w;
  vec2 d = (s1 - s0) * vec2(uAspect, 1.0);
  float len = length(d);
  // (never longer than a short stroke on screen, however near it passes)
  if (len > 0.05) { s0 = s1 - (s1 - s0) * (0.05 / len); d *= 0.05 / len; len = 0.05; }
  vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  // its width: its own size at that distance, never under a pixel (and then
  // dimmer, so far off it doesn't brighten for being drawn coarser)
  float wr = aN.y * projectionMatrix[1][1] / c1.w;
  // (close by, no wider than a short stroke: no blobs passing the lens)
  wr = min(wr, 0.012);
  float w = max(wr, uPx * 0.9);
  bright *= clamp(wr / w, 0.5, 1.0);
  float x = position.x;
  float y = position.y;
  vec4 cc = mix(c0, c1, x);
  vec2 off2 = (nrm * y + dir * (x * 2.0 - 1.0)) * w;
  off2.x /= uAspect;
  gl_Position = vec4((mix(s0, s1, x) + off2) * cc.w, cc.z, cc.w);
  vL = len / w;
  vQ = vec2(mix(-1.0, vL + 1.0, x), y);
  // (orange, only the brightest — the fronts — going pale)
  vCol = mix(uColor, uHot, clamp(0.12 * lit, 0.0, 0.6)) * bright / (1.0 + 0.1 * vL);
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
  float a = 1.0 - smoothstep(0.15, 1.0, r);
  float head = mix(0.35, 1.0, clamp(vQ.x / max(vL, 1e-3), 0.0, 1.0));
  gl_FragColor = vec4(vCol * a * a * head * 0.65, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// the rivulets' lines, PN points each (x, y on the sand, z, heading), and
// their timing (t0, dur, L) in the last column (shared with CoreOrb.jsx: the
// orb's poured light runs out along them)
export const RIVULET_PN = PN;
export function pathTexture(rivulets, terrain) {
  const groundAt = (x, z) => Math.max(terrain.height(x, z), WATER_Y + 0.25);
  const W = PN + 1;
  const data = new Float32Array(W * rivulets.length * 4);
  rivulets.forEach(({ pts, cum, L, t0, dur }, row) => {
    let k = 0;
    for (let j = 0; j < PN; j++) {
      const s = (j / (PN - 1)) * L;
      while (k < cum.length - 2 && cum[k + 1] < s) k++;
      const f = (s - cum[k]) / Math.max(cum[k + 1] - cum[k], 1e-6);
      const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f;
      const z = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f;
      const ang = Math.atan2(pts[k + 1][1] - pts[k][1], pts[k + 1][0] - pts[k][0]);
      data.set([x, groundAt(x, z), z, ang], (row * W + j) * 4);
    }
    data.set([t0, dur, L, 0], (row * W + PN) * 4);
  });
  const t = new THREE.DataTexture(data, W, rivulets.length, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// the ground's height (on a dry bed, the sand filling it: world/materials.js)
function heightTexture(groundAt) {
  const { x0, z0, x1, z1 } = OASIS_RECT;
  const nx = Math.round((x1 - x0) / HCELL);
  const nz = Math.round((z1 - z0) / HCELL);
  const data = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) data[j * nx + i] = groundAt(x0 + (i + 0.5) * HCELL, z0 + (j + 0.5) * HCELL);
  const t = new THREE.DataTexture(data, nx, nz, THREE.RedFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return { texture: t, rect: new THREE.Vector4(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0)) };
}

function threadGeometry(rivulets, density) {
  const rnd = mulberry32(4421);
  const per = Math.round(PER_STREAM * density);
  const swirls = Math.round(SWIRLS * density);
  const n = rivulets.length * per + swirls;
  const M = new Float32Array(n * 4);
  const Nn = new Float32Array(n * 4);
  let k = 0;
  rivulets.forEach((_, row) => {
    // (a braid of a few strands close together, so it reads as one bright
    // rivulet, and a few loose drops beside it)
    const strands = Array.from({ length: STRANDS }, (_, i) => (i === 0 ? 0 : (rnd() - 0.5) * (0.8 + i * 0.7)));
    const sp = 9 + 6 * rnd();
    for (let i = 0; i < per; i++, k++) {
      const drop = rnd() < 0.14;
      const off = drop ? (rnd() - 0.5) * 9 : strands[i % STRANDS] + (rnd() - 0.5) * 0.3;
      M.set([0, row, (i + rnd() * 0.6) / per, sp * (drop ? 0.4 : 0.85 + 0.3 * rnd())], k * 4);
      // (widths for this scale: seen from tens to hundreds of metres)
      Nn.set([off, drop ? 0.12 + 0.08 * rnd() : 0.16 + 0.24 * rnd() * rnd(), 0.5 + 0.5 * rnd(), rnd()], k * 4);
    }
  });
  for (let i = 0; i < swirls; i++, k++) {
    const band = Math.floor(rnd() * BANDS);
    M.set([1, band, rnd(), 4 + 8 * rnd()], k * 4);
    Nn.set([(rnd() - 0.5) * 6, 0.18 + 0.25 * rnd() * rnd(), 0.4 + 0.6 * rnd(), rnd()], k * 4);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute("aM", new THREE.InstancedBufferAttribute(M, 4));
  g.setAttribute("aN", new THREE.InstancedBufferAttribute(Nn, 4));
  g.instanceCount = n;
  return g;
}

export default function Rivulets({ J, reveal, paths, terrain, shared, tier }) {
  const mesh = useRef();
  const { gl, size } = useThree();
  const built = useMemo(() => {
    // (on a dry bed, on the sand filling it, level with the floor round it)
    const groundAt = (x, z) => Math.max(terrain.height(x, z), WATER_Y + 0.25);
    const height = heightTexture(groundAt);
    const geometry = threadGeometry(reveal.rivulets, tier?.veg ?? 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uPaths: { value: paths },
        uHeight: { value: height.texture },
        uHRect: { value: height.rect },
        uClock: { value: 0 },
        uTime: shared.uTime,
        uAspect: { value: 1 },
        uPx: { value: 0.002 },
        uGain: { value: 1 },
        uParts: { value: new THREE.Vector2(1, 0) },
        uWindow: { value: WINDOW },
        uEnd: { value: reveal.end },
        uC: { value: new THREE.Vector3(TREE.x, 0, TREE.z) },
        uColor: { value: new THREE.Color("#ff7a1f") },
        uHot: { value: new THREE.Color("#ffd9a0") },
        uOasisReveal: shared.uOasisReveal,
        uRevealMap: shared.uRevealMap,
        uRevealRect: shared.uRevealRect,
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    // (the swirls follow the rivulets in the buffer: left out of the draw when off)
    const streams = reveal.rivulets.length * Math.round(PER_STREAM * (tier?.veg ?? 1));
    return { geometry, material, height, streams, all: geometry.instanceCount };
  }, [reveal, paths, terrain, shared, tier]);
  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
      built.height.texture.dispose();
    },
    [built]
  );
  useFrame(() => {
    const u = built.material.uniforms;
    u.uClock.value = J.revealR;
    u.uGain.value = T.revealRing;
    u.uParts.value.set(T.revealRivulets ? 1 : 0, T.revealSwirls ? 1 : 0);
    built.geometry.instanceCount = T.revealSwirls ? built.all : built.streams;
    u.uColor.value.set(T.rivuletColor);
    u.uAspect.value = size.width / Math.max(size.height, 1);
    // (one pixel, in clip space)
    u.uPx.value = 2 / Math.max(size.height * gl.getPixelRatio(), 1);
    if (mesh.current) mesh.current.visible = J.revealR > 0.5 && J.revealR < reveal.end + 250 && T.revealRing > 0.001;
  });
  // (kept out of the water's mirror: drawn twice, they were the reveal's lag)
  return (
    <mesh
      ref={(el) => {
        mesh.current = el;
        el?.layers.set(NO_MIRROR_LAYER);
      }}
      geometry={built.geometry}
      material={built.material}
      renderOrder={6}
      frustumCulled={false}
      visible={false}
    />
  );
}
