"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildStrands } from "@/components/ForgingSandDuneConceptV3/scene/ForgeBeam";
import { STRAND_FRAGMENT, STRAND_VERTEX, streakUniforms } from "@/components/ForgingSandDuneConceptV3/scene/saber";
import { mulberry32 } from "./util";
import { A } from "../tuning";

// The light in the land, all of it the forging-sand-dune-concept-v3 beam's
// own streaks (ForgeBeam.jsx's buildStrands, saber.js's streak shader: fine
// strands of light, bright dashes streaming along them):
//   - the centre beam, after mont-fort.com/fort-energy: hundreds of fibres
//     running in over the ground from all round and sweeping up together
//     into one tall column at the centre, the light streaming along them in
//     and up — always there
//   - the falling streaks: each a single strand, coming down out of the sky
//     onto its own point of the land, many at once with the scroll, flaring
//     where they land
// Look values: tuning.js (A), live from the Leva panel.
//   uFall  0 → 1 over the fall (EnergyBeams' own clock, from the scroll)

const SKY_Y = 420;
export const BEAM_CENTRE = new THREE.Vector3(0, 0, -14);

// (V3's streak vertex shader, with each strand's own fall)
const VERTEX = STRAND_VERTEX.replace("uniform float uSpread;", "uniform float uSpread;\nattribute vec2 aFall;\nuniform float uFall;\nvarying float vHead;").replace(
  "vec3 p = position + aOffset * uSpread;",
  "vHead = clamp((uFall - aFall.x) / aFall.y, 0.0, 1.0);\n  vec3 p = position + aOffset * uSpread;"
);
// ...its fragment shader with each strand's own head; the streaks come out of
// the dark of the sky (their path runs sky → ground)
// (and kept off the team member: where their silhouette covers a strand on
// screen, it gives way — the person stands in front of the light)
const HOLD_GLSL = /* glsl */ `
uniform sampler2D uHoldMap;
uniform vec4 uHoldRect; // the portrait on screen (0..1): min x, min y, max x, max y
uniform float uHold;
uniform vec2 uResolution;
float holdout() {
  if (uHold <= 0.001) return 1.0;
  vec2 m = (gl_FragCoord.xy / uResolution - uHoldRect.xy) / (uHoldRect.zw - uHoldRect.xy);
  if (m.x < 0.0 || m.y < 0.0 || m.x > 1.0 || m.y > 1.0) return 1.0;
  return 1.0 - smoothstep(0.06, 0.4, texture2D(uHoldMap, m).a) * uHold;
}
`;
const withHold = (src) => src.replace("varying float vHead;", "varying float vHead;\n" + HOLD_GLSL).replace("if (I < 0.002) discard;", "I *= holdout();\n  if (I < 0.002) discard;");
const holdUniforms = (U) => ({ uHoldMap: U.uMap, uHoldRect: U.uHoldRect, uHold: U.uHold, uResolution: U.uResolution });
const STREAK_FRAGMENT = withHold(STRAND_FRAGMENT.replace("uniform float uHead;", "varying float vHead;"))
  .replaceAll("uHead", "vHead")
  .replace("float I = vStrand.y * (", "float I = smoothstep(0.0, 0.35, vU) * vStrand.y * (");
// ...and the fibres (ground → sky): in out of the distance over the land,
// thinning away up the column; the whole bundle's brightness uK. Each fibre
// carries its own soft glow either side (uGlowPx screen pixels wide, so it
// reads the same far off as close to — where it is finer than a pixel, the
// glow is most of what shows): the look it has up close, from the start.
const FIBRE_VERTEX = VERTEX.replace("uniform float uWidthMul;", "uniform float uWidthMul;\nuniform float uGlowPx;\nvarying float vCore;").replace(
  "float w = max(sw, length(toCam) * uPixel * 1.3);\n  vWidthFix = sw / w;",
  "float wc = max(sw, length(toCam) * uPixel * 1.3);\n  vWidthFix = sw / wc;\n  float w = wc + length(toCam) * uPixel * uGlowPx * 2.0;\n  vCore = wc / w;"
);
const FIBRE_FRAGMENT = withHold(STRAND_FRAGMENT.replace("uniform float uHead;", "varying float vHead;\nuniform float uK;\nuniform float uGlowAmt;\nvarying float vCore;"))
  .replaceAll("uHead", "vHead")
  .replace(
    "float across = 1.0 - smoothstep(0.2, 1.0, abs(vSide));",
    "float sx = abs(vSide);\n  float across = 1.0 - smoothstep(0.2 * vCore, vCore, sx);\n  float halo = pow(max(1.0 - sx, 0.0), 3.0) * (1.0 - across);"
  )
  .replace("float I = vStrand.y * (", "float I = uK * smoothstep(0.0, 0.08, vU) * (1.0 - smoothstep(0.55, 1.0, vU)) * vStrand.y * (")
  .replace("* across * start * vWidthFix * uIntensity", "* (across * pow(vWidthFix, 0.4) + halo * uGlowAmt / max(uIntensity, 0.001)) * start * uIntensity");
if (!FIBRE_VERTEX.includes("vCore = wc / w") || !FIBRE_FRAGMENT.includes("halo * uGlowAmt")) console.warn("[about] fibre glow: V3 strand shader changed");

// Where each falling streak lands and when: over the whole land in view, out
// to the horizon and in round the foot of the view; many at once.
const VIEW_Z = 240; // (about where the hero camera stands)
const VIEW_HALF = 0.56; // (half the view's width per metre out, with a margin)
export function planStreaks(height, count, avoid) {
  const rand = mulberry32(73);
  const list = [];
  while (list.length < count) {
    const D = 45 + Math.pow(rand(), 1.35) * 620;
    const z = VIEW_Z - D;
    const x = (rand() * 2 - 1) * VIEW_HALF * D;
    // (clear of the team's stage at the centre, and of the camera's way in)
    if (Math.hypot(x, z) < 48 || (z > -10 && Math.abs(x) < 9)) continue;
    // (nor close round the team's stage)
    if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < 40) continue;
    const j = rand();
    const w = rand();
    const b = rand();
    list.push({
      x,
      z,
      s: rand(), // when, as a share of the fall's spread
      dur: 0.12 + j * 0.14,
      // (as V3's own strands: a few broad, white-hot ones, the rest finer,
      // dimmer, barely hot; a few pixels across at any distance)
      width: D * 0.001 * (w < 0.11 ? 3.0 : 1.2 + w * 1.4),
      bright: w < 0.11 ? 1.0 : 0.3 + b * 0.55,
      hot: w < 0.11 ? 1 : b * 0.3,
    });
  }
  for (const s of list) s.y = height(s.x, s.z) + 0.05;
  return list;
}

// The fibres of the centre beam: out over the land, in along the ground,
// round a bend and up into the column.
function buildFibres(height, { fibers, reach, column, bend, top, width }) {
  const rand = mulberry32(900);
  const c = BEAM_CENTRE;
  const parts = [];
  for (let i = 0; i < fibers; i++) {
    const a = rand() * Math.PI * 2;
    // (out all round over the land, some short, some running far: a few more
    // towards the viewer, so the spread opens to us)
    const toward = Math.cos(a) * 0.5 + 0.5;
    const R = column + bend + 4 + reach * (0.2 + Math.pow(rand(), 1.5) * 1.9) * (0.75 + 0.25 * toward);
    const wander = rand() * 6.28;
    const swirl = (rand() - 0.5) * 0.5;
    const cr = column * Math.sqrt(rand());
    const ca = a + swirl + (rand() - 0.5) * 0.6;
    const pts = [];
    // along the ground, in towards the bend: lying on the dunes (sampled
    // close, so it runs over every rise and hollow), wandering a little
    const steps = Math.max(Math.ceil((R - cr - bend) / 2.5), 4);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const r = THREE.MathUtils.lerp(R, cr + bend, t);
      const aa = THREE.MathUtils.lerp(a, ca, t * t) + Math.sin(t * 7 + wander) * 0.06 * (1 - t);
      const x = c.x + Math.sin(aa) * r;
      const z = c.z + Math.cos(aa) * r;
      pts.push(new THREE.Vector3(x, height(x, z) + 0.15, z));
    }
    // round the bend and up
    const g = pts[pts.length - 1].y;
    for (let k = 1; k <= 6; k++) {
      const q = (k / 6) * (Math.PI / 2);
      const r = cr + bend - Math.sin(q) * bend;
      pts.push(new THREE.Vector3(c.x + Math.sin(ca) * r, g + (1 - Math.cos(q)) * bend, c.z + Math.cos(ca) * r));
    }
    const hTop = top * (0.45 + 0.55 * rand());
    for (let k = 1; k <= 6; k++) {
      const y = g + bend + (hTop - bend) * (k / 6);
      pts.push(new THREE.Vector3(c.x + Math.sin(ca) * cr, y, c.z + Math.cos(ca) * cr));
    }
    const path = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const w = rand();
    const { geometry, length } = buildStrands(path, { count: 1, spacing: 2.5, seed: 1000 + i, width: width * (0.5 + w) });
    const st = geometry.attributes.aStrand.array;
    const phase = rand() * 10;
    const bright = 0.35 + rand() * 0.65;
    const hot = w > 0.85 ? 1 : rand() * 0.35;
    for (let k = 0; k < st.length; k += 4) st.set([width * (0.5 + w), bright, phase, hot], k);
    const n = geometry.attributes.position.count;
    const fall = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) fall.set([-10, 1], k * 2);
    geometry.setAttribute("aFall", new THREE.BufferAttribute(fall, 2));
    parts.push({ geometry, length });
  }
  const geometry = mergeGeometries(parts.map((p) => p.geometry));
  parts.forEach((p) => p.geometry.dispose());
  return { geometry, length: parts.reduce((s, p) => s + p.length, 0) / parts.length };
}

// (A's streak look into a material's uniforms)
function syncLook(u, k, pixel, look) {
  u.uIntensity.value = look.intensity * k;
  u.uFlow.value = look.flow;
  u.uSpread.value = 0.22;
  u.uWidthMul.value = look.width;
  u.uDashFreq.value = 1 / Math.max(A.streakDashSpacing, 0.5);
  u.uDashLength.value = A.streakDashLength;
  u.uBase.value = A.streakBase;
  u.uPixel.value = pixel;
  u.uColor.value.set(A.streakColor);
  u.uHot.value.set(A.streakHot);
}

export function EnergyBeams({ U, streaks, fibres: fibreSpec, height }) {
  const { gl, camera } = useThree();

  const streakMesh = useMemo(() => {
    const parts = streaks.map((s, i) => {
      const path = new THREE.LineCurve3(new THREE.Vector3(s.x, SKY_Y, s.z), new THREE.Vector3(s.x, s.y, s.z));
      const { geometry, length } = buildStrands(path, { count: 1, spacing: 3, seed: 11 + i, width: s.width });
      const n = geometry.attributes.position.count;
      const st = geometry.attributes.aStrand.array;
      const phase = mulberry32(500 + i)() * 10;
      for (let k = 0; k < st.length; k += 4) st.set([s.width, s.bright, phase, s.hot], k);
      // (when it falls: its share of the spread, set live — aFall.x is
      // rewritten from A.streakFallEnd below)
      const fall = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) fall.set([s.s, s.dur], k * 2);
      geometry.setAttribute("aFall", new THREE.BufferAttribute(fall, 2));
      return { geometry, length };
    });
    const geometry = mergeGeometries(parts.map((p) => p.geometry));
    parts.forEach((p) => p.geometry.dispose());
    const material = new THREE.ShaderMaterial({
      uniforms: { ...streakUniforms(parts[0].length), uTime: U.uTime, uFall: { value: 0 }, ...holdUniforms(U) },
      vertexShader: VERTEX,
      fragmentShader: STREAK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { geometry, material };
  }, [streaks, U]);

  const fibreMesh = useMemo(() => {
    const { geometry, length } = buildFibres(height, fibreSpec);
    const material = new THREE.ShaderMaterial({
      uniforms: { ...streakUniforms(length), uTime: U.uTime, uFall: { value: 0 }, uK: { value: 1 }, uGlowPx: { value: 6 }, uGlowAmt: { value: 0.5 }, ...holdUniforms(U) },
      vertexShader: FIBRE_VERTEX,
      fragmentShader: FIBRE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { geometry, material };
  }, [fibreSpec, height, U]);

  // the flare where each streak lands, then a glow at its foot
  const feet = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(streaks.flatMap((s) => [s.x, s.y + 0.4, s.z])), 3));
    g.setAttribute("aLand", new THREE.BufferAttribute(new Float32Array(streaks.flatMap((s) => [s.s, s.dur, 2.2 + s.width * 3])), 3));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uFall: { value: 0 }, uSpread: { value: 1 }, uPixel: U.uPixel, uK: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 aLand;
        uniform float uFall;
        uniform float uSpread;
        uniform float uPixel;
        varying float vA;
        varying float vFlash;
        void main() {
          float since = uFall - (aLand.x * uSpread + aLand.y);
          vFlash = step(0.0, since) * exp(-max(since, 0.0) * 30.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aLand.z * (0.6 + vFlash * 2.5) / (uPixel * max(-mv.z, 0.01)), 2.0, 500.0);
          vA = step(0.0, since);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uK;
        varying float vA;
        varying float vFlash;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float g = pow(max(1.0 - d, 0.0), 3.0) * (0.25 + vFlash * 1.6) + pow(max(1.0 - d, 0.0), 16.0) * 0.8;
          vec3 col = mix(vec3(1.0, 0.114, 0.0), vec3(1.0, 0.28, 0.05), vFlash);
          gl_FragColor = vec4(col * g * vA * uK, 1.0);
        }
      `,
    });
    return { geometry: g, material };
  }, [streaks, U]);

  useEffect(
    () => () => {
      streakMesh.geometry.dispose();
      streakMesh.material.dispose();
      fibreMesh.geometry.dispose();
      fibreMesh.material.dispose();
      feet.geometry.dispose();
      feet.material.dispose();
    },
    [streakMesh, fibreMesh, feet]
  );

  useFrame(() => {
    const pixel = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / gl.domElement.height;
    const k = U.uBeams.value * (1 - U.uWhite.value);
    // the falling streaks: each starts at its share of A.streakFallEnd
    const su = streakMesh.material.uniforms;
    syncLook(su, k, pixel, { intensity: A.streakIntensity, flow: A.streakFlow, width: A.streakWidth });
    // (uFall rescaled so a streak's stored share s falls at s × spread)
    const spread = Math.max(A.streakFallEnd, 0.01);
    su.uFall.value = U.uFall.value / spread;
    // (and its length of fall with it: aFall.y is in the same units)
    feet.material.uniforms.uSpread.value = 1;
    feet.material.uniforms.uFall.value = su.uFall.value;
    feet.material.uniforms.uK.value = k * A.streakFootGlow;
    // the fibres of the centre beam
    const fu = fibreMesh.material.uniforms;
    syncLook(fu, 1, pixel, { intensity: A.beamIntensity, flow: A.beamFlow, width: A.streakWidth });
    // (the centre beam at its full strength throughout the hero — only the
    // white at the very end takes it)
    fu.uK.value = (1 - U.uWhite.value) * U.uCenterBeam.value;
    fu.uGlowPx.value = A.beamStreakGlowPx;
    fu.uGlowAmt.value = A.beamStreakGlow;
  });

  return (
    <>
      <BeamGlow U={U} spec={fibreSpec} height={height} />
      <mesh geometry={fibreMesh.geometry} material={fibreMesh.material} frustumCulled={false} renderOrder={6} />
      <mesh geometry={streakMesh.geometry} material={streakMesh.material} frustumCulled={false} renderOrder={7} />
      <points geometry={feet.geometry} material={feet.material} frustumCulled={false} renderOrder={8} />
    </>
  );
}

// The light the centre beam pools on the land at its foot, lying on the
// dunes round it and fading out over them.
function BeamGlow({ U, spec, height }) {
  const base = useMemo(() => height(BEAM_CENTRE.x, BEAM_CENTRE.z), [height]);
  const pool = useMemo(() => {
    // (rings out from the foot, each point set on the land)
    const rings = 40;
    const around = 72;
    const R = spec.pool;
    const position = [];
    const radius = [];
    position.push(BEAM_CENTRE.x, base + 0.3, BEAM_CENTRE.z);
    radius.push(0);
    for (let i = 1; i <= rings; i++) {
      const r = R * Math.pow(i / rings, 1.6);
      for (let j = 0; j < around; j++) {
        const a = (j / around) * Math.PI * 2;
        const x = BEAM_CENTRE.x + Math.sin(a) * r;
        const z = BEAM_CENTRE.z + Math.cos(a) * r;
        position.push(x, height(x, z) + 0.3, z);
        radius.push(r / R);
      }
    }
    const index = [];
    for (let j = 0; j < around; j++) index.push(0, 1 + j, 1 + ((j + 1) % around));
    for (let i = 1; i < rings; i++) {
      for (let j = 0; j < around; j++) {
        const a = 1 + (i - 1) * around + j;
        const b = 1 + (i - 1) * around + ((j + 1) % around);
        index.push(a, a + around, b, b, a + around, b + around);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute("aR", new THREE.Float32BufferAttribute(radius, 1));
    geometry.setIndex(index);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -6,
      uniforms: { uPool: { value: 1 }, uTime: U.uTime, uColor: { value: new THREE.Color() }, uHot: { value: new THREE.Color() } },
      vertexShader: /* glsl */ `
        attribute float aR;
        varying float vR;
        varying vec2 vXZ;
        void main() {
          vR = aR;
          vXZ = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uPool;
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uHot;
        varying float vR;
        varying vec2 vXZ;
        void main() {
          // a wide soft pool, a bright core at the foot, and faint rays out
          // along the land (where the fibres run in)
          float wide = exp(-vR * 4.5) * (1.0 - smoothstep(0.75, 1.0, vR));
          float core = exp(-vR * vR * 400.0);
          float a = atan(vXZ.x, vXZ.y + 14.0);
          float rays = pow(0.5 + 0.5 * sin(a * 23.0 + sin(a * 7.0) * 2.0), 6.0) * exp(-vR * 3.0) * (1.0 - smoothstep(0.6, 1.0, vR));
          float pulse = 0.85 + 0.15 * sin(uTime * 1.3 - vR * 18.0);
          vec3 col = mix(uColor, uHot, core * 0.7);
          gl_FragColor = vec4(col * (wide * 0.55 * pulse + core * 1.6 + rays * 0.35) * uPool, 1.0);
        }
      `,
    });
    return { geometry, material };
  }, [spec.pool, height, base, U]);

  useEffect(
    () => () => {
      pool.geometry.dispose();
      pool.material.dispose();
    },
    [pool]
  );

  useFrame(() => {
    const k = (1 - U.uWhite.value) * U.uCenterBeam.value;
    const pu = pool.material.uniforms;
    pu.uPool.value = A.beamPool * k;
    pu.uColor.value.set(A.streakColor);
    pu.uHot.value.set(A.streakHot);
  });

  return (
    <>
      <mesh geometry={pool.geometry} material={pool.material} frustumCulled={false} renderOrder={5} />
    </>
  );
}
