"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./util";
import { A as LOOK } from "../tuning";
import { MAP_H, MAP_W } from "./portraitMap";
import { INVERSE_ACES_GLSL, acesUniforms } from "./aces";

// Changing member, as a ripple of light: a ring runs out from the centre of
// the portrait to its edges, and where it passes the face comes apart into
// particles of light — each carrying the colour of its spot — that lift
// towards the viewer and settle straight back, turning to the next face's
// colour as they land, its image forming under them. (The spots are weighted
// to where either face's light is: the face, its outline, its lines.)
// When: MORPH_GLSL's schedule (shared with the portrait image, which comes
// apart and forms again on the same one): over uMorph 0 → 1 the first face
// goes from its centre out to its edges, and the next forms the same way
// after it. (Before and after the change there are no particles: the image
// is the portrait.)

// (where on the portrait a point comes apart, and forms again: 0 → 1)
export const MORPH_GLSL = /* glsl */ `
  float morphHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float morphValue(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(morphHash(i), morphHash(i + vec2(1.0, 0.0)), f.x), mix(morphHash(i + vec2(0.0, 1.0)), morphHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // (from the centre of the portrait out to its edges, the ring a little
  // uneven)
  float morphOrder(vec2 uv) {
    float r = length((uv - vec2(0.5, 0.55)) * vec2(1.0, 1.25)) / 0.72;
    return clamp(r * 0.85 + (morphValue(uv * vec2(6.0, 7.0)) - 0.5) * 0.18, 0.0, 1.0);
  }
  // a ripple: the ring runs out from the centre at once; where it passes,
  // the face there comes apart...
  float morphLeave(vec2 uv) { return 0.02 + morphOrder(uv) * 0.66; }
  // ...and the next is there a moment behind it
  float morphArrive(vec2 uv) { return morphLeave(uv) + 0.28; }
`;

// Spots over the portrait, more where either face's light is (the face,
// its outline, its lines), N of them, as uv pairs.
function samplePortraits(mapA, mapB, count) {
  const a = mapA.image?.data;
  const b = mapB.image?.data;
  const W = mapA.image?.width || MAP_W;
  const H = mapA.image?.height || MAP_H;
  const out = new Float32Array(count * 2);
  if (!a || !b || a.length < W * H * 4 || b.length < W * H * 4) return out;
  // (weights: some everywhere, more on the person, most where it is bright)
  const N = W * H;
  const cdf = new Float64Array(N);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const w = (d) => (d[i * 4 + 3] / 255) * (0.25 + (d[i * 4] / 255) * 1.4);
    acc += 0.05 + Math.max(w(a), w(b));
    cdf[i] = acc;
  }
  const rand = mulberry32(31);
  for (let k = 0; k < count; k++) {
    // (stratified: one in each equal share of the weight, jittered)
    const t = ((k + rand()) / count) * acc;
    let lo = 0;
    let hi = N - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    const x = lo % W;
    const y = (lo / W) | 0;
    // (rows run up from the foot)
    out.set([(x + rand()) / W, (y + rand()) / H], k * 2);
  }
  return out;
}

export function PortraitParticles({ U, count, width, height }) {
  const geometry = useMemo(() => {
    const rand = mulberry32(83);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aFrom", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    const rnd = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) rnd[i] = rand();
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 4));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uImage: U.uImage,
          uImageB: U.uImageB,
          uMorph: U.uMorph,
          uTime: U.uTime,
          uPixel: U.uPixel,
          uWhite: U.uWhite,
          uW: { value: width },
          uH: { value: height },
          uSize: { value: 1 },
          uGlow: { value: 1 },
          uSpread: { value: 1 },
          ...acesUniforms(),
        },
        vertexShader: /* glsl */ `
          attribute vec2 aFrom;
          attribute vec4 aRnd;
          uniform sampler2D uImage;
          uniform sampler2D uImageB;
          uniform float uMorph;
          uniform float uTime;
          uniform float uPixel;
          uniform float uW;
          uniform float uH;
          uniform float uSize;
          uniform float uSpread;
          varying vec3 vCol;
          varying float vA;
          varying float vArc;
          ${MORPH_GLSL}
          ${INVERSE_ACES_GLSL}
          void main() {
            // leaving its spot of the first face as that comes apart there,
            // landing on its spot of the next as that forms there
            float s0 = morphLeave(aFrom);
            float s1 = morphArrive(aFrom);
            float t = clamp((uMorph - s0) / max(s1 - s0, 0.05), 0.0, 1.0);
            float e = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5;
            float arc = sin(3.14159 * t);
            vec3 p = vec3((aFrom - 0.5) * vec2(uW, uH), 0.0);
            // the ripple lifting it off the face towards the viewer, pushed
            // a little outwards with the ring, and setting it down again (no
            // turning: straight up and back)
            // (barely off the face at its centre — so the features there never
            // swell and smear — a little more out towards the edges)
            vec2 out2 = p.xy / max(length(p.xy), 0.001);
            float lift = pow(arc, 0.7) * mix(0.2, 1.0, smoothstep(0.0, 0.9, morphOrder(aFrom))) * uSpread;
            p += vec3(out2 * (0.04 + aRnd.y * 0.12), 0.07 + aRnd.z * 0.4) * lift;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            // (about the size of its share of the face, a little more in flight)
            float size = uSize * 0.018 * (1.0 + arc * aRnd.w * 0.25);
            gl_PointSize = clamp(size / (uPixel * max(-mv.z, 0.01)), 1.0, 24.0);
            // its colour: the first face's at its spot, the next's at its own
            vec3 ca = srgbToLinear(texture2D(uImage, aFrom).rgb);
            vec3 cb = srgbToLinear(texture2D(uImageB, aFrom).rgb);
            vCol = mix(ca, cb, e);
            vArc = arc;
            // (there only between leaving and landing)
            vA = step(s0, uMorph) * (1.0 - smoothstep(s1, s1 + 0.06, uMorph)) * step(0.0005, uMorph) * (1.0 - step(0.9995, uMorph));
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uWhite;
          uniform float uGlow;
          varying vec3 vCol;
          varying float vA;
          varying float vArc;
          ${INVERSE_ACES_GLSL}
          void main() {
            if (vA < 0.002) discard;
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = (1.0 - smoothstep(0.35, 1.0, d)) * vA * (1.0 - uWhite) * (1.0 - vArc * 0.35);
            if (a < 0.002) discard;
            // shown as the face's own colour; glowing as it flies
            vec3 col = inverseAces(vCol) + vec3(1.0, 0.36, 0.08) * vArc * uGlow * (0.04 + dot(vCol, vec3(0.3, 0.5, 0.2)) * 0.8);
            gl_FragColor = vec4(col, a);
          }
        `,
      }),
    [U, width, height]
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  // (when a change starts: each particle's spot in the face it leaves, and in
  // the face it comes to)
  const pair = useMemo(() => ({ a: null, b: null }), []);
  useFrame(() => {
    const u = material.uniforms;
    u.uSize.value = LOOK.portraitParticleSize;
    u.uGlow.value = LOOK.portraitParticleGlow;
    u.uSpread.value = LOOK.portraitParticleSpread;
    const morphing = U.uMorph.value > 0.0005 && U.uMorph.value < 0.9995;
    const A = U.uMap.value;
    const B = U.uMapB.value;
    if (morphing && A && B && (pair.a !== A || pair.b !== B)) {
      pair.a = A;
      pair.b = B;
      geometry.attributes.aFrom.array.set(samplePortraits(A, B, count));
      geometry.attributes.aFrom.needsUpdate = true;
    }
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
