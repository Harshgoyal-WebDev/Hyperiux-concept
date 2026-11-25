"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./util";
import { A } from "../tuning";

// The team member as a lit point sculpture (after lusion.co/about's team):
// each person baked (scripts/bake-team-points.py) into the same number of
// points spread evenly over them — denser on the face — every one with its
// depth, its surface normal and its shade. Lit live (a light that follows
// the pointer, a rim towards the edges), so the face reads as a solid in 3D
// as the camera moves; amber dots on the dark, the dark left empty.
//   forming (uReveal): gathering in from all round, landing together
//   changing member (uMorph): one head morphing into the next, point k to
//     point k (the bake orders them along a Hilbert curve, so point k is in
//     the same region of both faces), each on its own beat, arcing in 3D
//   dissolving (uDissolve): drifting up and away into the light
// Points file: uint32 count, then per point u, v, depth, nx, ny, nz, shade.

export const POINT_COUNT = 12000;
const STRIDE = 7;

export async function loadPoints(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const n = new DataView(buf).getUint32(0, true);
    return { count: n, data: new Float32Array(buf, 4, n * STRIDE) };
  } catch {
    return null;
  }
}

// (a set's points into a pair of attributes: u, v, depth, shade · normal)
function fill(set, a, nrm) {
  const n = Math.min(set.count, POINT_COUNT);
  const d = set.data;
  const av = a.array;
  const nv = nrm.array;
  for (let i = 0; i < n; i++) {
    const k = i * STRIDE;
    av[i * 4] = d[k];
    av[i * 4 + 1] = d[k + 1];
    av[i * 4 + 2] = d[k + 2];
    av[i * 4 + 3] = d[k + 6];
    nv[i * 3] = d[k + 3];
    nv[i * 3 + 1] = d[k + 4];
    nv[i * 3 + 2] = d[k + 5];
  }
  a.needsUpdate = true;
  nrm.needsUpdate = true;
}

export function PortraitPoints({ U, S, sets, width, height }) {
  const geometry = useMemo(() => {
    const rand = mulberry32(141);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(POINT_COUNT * 3), 3));
    g.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(POINT_COUNT * 4), 4));
    g.setAttribute("aNA", new THREE.BufferAttribute(new Float32Array(POINT_COUNT * 3), 3));
    g.setAttribute("aB", new THREE.BufferAttribute(new Float32Array(POINT_COUNT * 4), 4));
    g.setAttribute("aNB", new THREE.BufferAttribute(new Float32Array(POINT_COUNT * 3), 3));
    const rnd = new Float32Array(POINT_COUNT * 4);
    for (let i = 0; i < rnd.length; i++) rnd[i] = rand();
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 4));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uMorph: U.uMorph,
          uReveal: U.uReveal,
          uRevealFly: U.uRevealFly,
          uDissolve: U.uDissolve,
          uLight: U.uLight,
          uWhite: U.uWhite,
          uTime: U.uTime,
          uPixel: U.uPixel,
          uW: { value: width },
          uH: { value: height },
          uHas: { value: 0 },
          uDepthAmt: { value: 1.2 },
          uSize: { value: 1 },
          uGain: { value: 1.4 },
          uAmbient: { value: 0.18 },
          uDiffuse: { value: 1.2 },
          uRim: { value: 0.5 },
          uLightDir: { value: new THREE.Vector3(-0.4, 0.35, 0.85).normalize() },
          uColor: { value: new THREE.Color() },
          uHot: { value: new THREE.Color() },
          uSwirl: { value: 0.6 },
          uScatter: { value: 0.35 },
          uShimmer: { value: 0.3 },
        },
        vertexShader: /* glsl */ `
          attribute vec4 aA; // u, v, depth, shade — the one there now
          attribute vec3 aNA;
          attribute vec4 aB; // ...and the one it is becoming
          attribute vec3 aNB;
          attribute vec4 aRnd;
          uniform float uMorph;
          uniform float uReveal;
          uniform float uRevealFly;
          uniform float uDissolve;
          uniform float uTime;
          uniform float uPixel;
          uniform float uW;
          uniform float uH;
          uniform float uHas;
          uniform float uDepthAmt;
          uniform float uSize;
          uniform float uAmbient;
          uniform float uDiffuse;
          uniform float uRim;
          uniform vec3 uLightDir;
          uniform float uSwirl;
          uniform float uScatter;
          uniform float uShimmer;
          varying float vB;
          varying float vA;
          vec3 placed(vec4 a) { return vec3((a.x - 0.5) * uW, (a.y - 0.5) * uH, (a.z - 0.5) * uDepthAmt); }
          void main() {
            // changing member: each point on its own beat, arcing through 3D
            // from its place on the one face to its place on the next
            float t = clamp((uMorph - aRnd.x * 0.35) / 0.65, 0.0, 1.0);
            float e = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
            float arc = sin(3.14159 * t);
            vec3 p = mix(placed(aA), placed(aB), e);
            p += vec3((aRnd.y - 0.5) * 1.2, (aRnd.z - 0.5) * 0.8, 0.4 + aRnd.w * 1.2) * arc * uSwirl;
            vec3 n = normalize(mix(aNA, aNB, e));
            float shade = mix(aA.w, aB.w, e);
            // forming: gathering in from round about, all landing together
            float fly = uRevealFly * (0.65 + aRnd.w * 0.35);
            float r0 = 0.86 - fly;
            float re = 1.0 - pow(1.0 - clamp((uReveal - r0) / fly, 0.0, 1.0), 3.0);
            vec3 from = p + vec3((aRnd.x - 0.5) * 9.0, (aRnd.y - 0.5) * 6.0, 1.0 + aRnd.z * 5.0) * uScatter;
            p = mix(from, p, re);
            // at rest: breathing a touch
            p += vec3(sin(uTime * 0.7 + aRnd.x * 40.0), cos(uTime * 0.6 + aRnd.y * 40.0), 0.0) * 0.004 * uShimmer;
            // dissolving: up and away into the light
            float dk = clamp(uDissolve * 1.5 - aRnd.x * 0.5, 0.0, 1.0);
            dk *= dk;
            p += vec3((aRnd.y - 0.5) * 1.6, 1.0 + aRnd.z * 4.0, aRnd.w * 2.0) * dk;
            vec4 wp = modelMatrix * vec4(p, 1.0);
            vec4 mv = viewMatrix * wp;
            gl_Position = projectionMatrix * mv;
            // lit: a key light (following the pointer), a little fill, and a
            // rim where the surface turns away — over its own shade
            vec3 N = normalize(mat3(modelMatrix) * n);
            vec3 V = normalize(cameraPosition - wp.xyz);
            float diff = max(dot(N, uLightDir), 0.0);
            float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
            float b = shade * (uAmbient + uDiffuse * diff) + rim * uRim * sqrt(shade);
            // (further back, a touch dimmer)
            b *= mix(0.6, 1.0, mix(aA.z, aB.z, e));
            b *= 1.0 - uShimmer * 0.2 * (0.5 + 0.5 * sin(uTime * (1.0 + aRnd.z * 2.0) + aRnd.w * 60.0));
            vB = b;
            // (a brighter dot a little bigger: a halftone; bigger in flight)
            float size = uSize * 0.03 * (0.55 + 0.45 * sqrt(clamp(b, 0.0, 1.5))) * (1.0 + max(arc, 1.0 - re) * 0.4);
            gl_PointSize = clamp(size / (uPixel * max(-mv.z, 0.01)), 1.0, 20.0);
            // (fading out towards the frame's foot and sides, as the body does)
            vec4 ab = mix(aA, aB, e);
            float edge = smoothstep(0.0, 0.2, ab.y) * smoothstep(0.0, 0.08, ab.x) * smoothstep(1.0, 0.92, ab.x);
            vA = uHas * edge * smoothstep(r0 - 0.06, r0 + 0.04, uReveal) * (1.0 - dk);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uGain;
          uniform float uLight;
          uniform float uWhite;
          uniform vec3 uColor;
          uniform vec3 uHot;
          varying float vB;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float disc = 1.0 - smoothstep(0.55, 1.0, d);
            float a = disc * vA * (1.0 - uWhite);
            if (a * vB < 0.003) discard;
            // amber, warming to near-white where it's brightest
            vec3 col = mix(uColor, uHot, smoothstep(0.45, 1.3, vB));
            col = mix(col, vec3(1.0, 0.9, 0.8), uLight * 0.6);
            gl_FragColor = vec4(col * vB * uGain * a, 1.0);
          }
        `,
      }),
    [U, width, height]
  );

  // the person's body behind the dots: their outline, solid and dark, so
  // they stand in front of what's behind them (not a cloud it shows through)
  const body = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uMaskA: U.uImageMask, uMaskB: U.uImageMaskB, uMorph: U.uMorph, uReveal: U.uReveal, uDissolve: U.uDissolve, uWhite: U.uWhite, uShade: { value: 0.92 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMaskA;
          uniform sampler2D uMaskB;
          uniform float uMorph;
          uniform float uReveal;
          uniform float uDissolve;
          uniform float uWhite;
          uniform float uShade;
          varying vec2 vUv;
          void main() {
            float m = mix(texture2D(uMaskA, vUv).r, texture2D(uMaskB, vUv).r, smoothstep(0.2, 0.8, uMorph));
            // (fading out towards the frame's foot and sides: never a hard edge)
            float edge = smoothstep(0.0, 0.22, vUv.y) * smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
            float a = smoothstep(0.3, 0.7, m) * edge * uShade * smoothstep(0.7, 0.86, uReveal) * (1.0 - uDissolve) * (1.0 - uWhite);
            if (a < 0.003) discard;
            gl_FragColor = vec4(vec3(0.0025, 0.0012, 0.0007), a);
          }
        `,
      }),
    [U]
  );
  const bodyRef = useMemo(() => ({ current: null }), []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      body.dispose();
    },
    [geometry, material, body]
  );

  // which faces are in the attributes now
  const held = useMemo(() => ({ a: -1, b: -1, setA: null, setB: null }), []);
  const light = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const all = sets.current || [];
    const at = geometry.attributes;
    const sA = all[S.member];
    if (sA && (held.a !== S.member || held.setA !== sA)) {
      fill(sA, at.aA, at.aNA);
      held.a = S.member;
      held.setA = sA;
      // (until a change begins, the one it becomes is itself)
      fill(sA, at.aB, at.aNB);
      held.b = S.member;
      held.setB = sA;
    }
    const sB = all[S.morphTo];
    if (S.morph > 0 && sB && (held.b !== S.morphTo || held.setB !== sB)) {
      fill(sB, at.aB, at.aNB);
      held.b = S.morphTo;
      held.setB = sB;
    }
    const u = material.uniforms;
    u.uHas.value = sA ? 1 : 0;
    u.uDepthAmt.value = A.portraitParticleDepth;
    u.uSize.value = A.dotSize;
    u.uGain.value = A.dotGain;
    u.uAmbient.value = A.dotAmbient;
    u.uDiffuse.value = A.dotDiffuse;
    u.uRim.value = A.dotRim;
    u.uSwirl.value = A.dotMorphSwirl;
    u.uScatter.value = A.revealScatter;
    u.uShimmer.value = A.portraitShimmer;
    u.uColor.value.set(A.dotColor);
    u.uHot.value.set(A.dotHot);
    // (the key light, moving with the pointer: the light plays over the face)
    light.set(-0.45 + U.sway.x * A.dotLightFollow, 0.35 + U.sway.y * A.dotLightFollow * 0.6, 0.85).normalize();
    u.uLightDir.value.copy(light);
    body.uniforms.uShade.value = A.dotBody;
    // (just behind the furthest of the dots)
    if (bodyRef.current) bodyRef.current.position.z = -0.5 * A.portraitParticleDepth - 0.03;
  });

  return (
    <>
      <mesh ref={(m) => (bodyRef.current = m)} material={body} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <points geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />
    </>
  );
}
