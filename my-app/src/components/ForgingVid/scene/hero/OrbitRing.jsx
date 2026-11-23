"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { T } from "../../tuning";
import { heroBlast, reducedMotion } from "./heroState";

// A thin ring of light circling the slab: a circle round the core, its plane
// leaning towards the camera and rolled (so it reads as a tilted ellipse,
// passing in front of the slab low on the left and behind it high on the
// right — the slab hides its far side). Drawn as a ribbon a constant few
// pixels wide whatever its distance (each point pushed out across the line
// on screen), with a soft falloff either side: crisp, never aliased. A
// brighter light runs round it trailing a fading wake, its brightness
// wanders along it and shimmers; the plane sways a little. The blast takes
// it out with the fragments (heroState.js).
const SEGMENTS = 720;

const VERTEX = /* glsl */ `
uniform vec3 uCenter;
uniform vec3 uU;
uniform vec3 uV;
uniform float uR;
uniform vec2 uRes;
uniform float uHalf;
attribute float aT;
attribute float aSide;
varying float vT;
varying float vSide;
vec3 ringAt(float t) {
  float a = t * 6.2831853;
  return uCenter + (uU * cos(a) + uV * sin(a)) * uR;
}
void main() {
  vec4 c0 = projectionMatrix * viewMatrix * vec4(ringAt(aT), 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(ringAt(aT + 0.002), 1.0);
  vec2 s0 = c0.xy / c0.w * uRes;
  vec2 s1 = c1.xy / c1.w * uRes;
  vec2 d = s1 - s0;
  d /= max(length(d), 1e-5);
  // (across the line on screen, uHalf pixels either side)
  c0.xy += vec2(-d.y, d.x) * aSide * uHalf / uRes * c0.w;
  vT = aT;
  vSide = aSide;
  gl_Position = c0;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uGlow;
uniform float uLevel;
uniform float uWidth;
uniform float uHalf;
uniform float uHead;
uniform float uTime;
varying float vT;
varying float vSide;
void main() {
  // pixels from the line's middle: a crisp core and a soft glow
  float d = abs(vSide) * uHalf;
  float line = 1.0 - smoothstep(uWidth * 0.5 - 0.5, uWidth * 0.5 + 0.7, d);
  float halo = exp(-d * 0.8) * 0.3;
  // the running light: a bright head and its wake fading behind it, and
  // a fainter one opposite
  float behind = fract(uHead - vT);
  float wake = exp(-behind * 9.0) * 1.4 + exp(-behind * 2.2) * 0.5;
  float behind2 = fract(uHead + 0.5 - vT);
  wake += exp(-behind2 * 6.0) * 0.4;
  // brightness wandering along it, drifting round, and a faint shimmer
  float x = vT * 6.2831853 - uTime * 0.05;
  float vary = 0.55 + 0.25 * sin(x * 3.0 + 1.3) + 0.2 * sin(x * 7.0 + uTime * 0.31);
  float shimmer = 0.88 + 0.12 * sin(vT * 190.0 + uTime * 2.3);
  float a = (line + halo) * (0.42 * vary + wake) * shimmer * uLevel;
  gl_FragColor = vec4(uColor * a * uGlow, a);
}
`;

export default function OrbitRing({ J, shared, core }) {
  const { gl, size } = useThree();
  const built = useMemo(() => {
    const n = (SEGMENTS + 1) * 2;
    const aT = new Float32Array(n);
    const aSide = new Float32Array(n);
    const index = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      aT[i * 2] = aT[i * 2 + 1] = i / SEGMENTS;
      aSide[i * 2] = -1;
      aSide[i * 2 + 1] = 1;
      if (i < SEGMENTS) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geometry.setAttribute("aT", new THREE.BufferAttribute(aT, 1));
    geometry.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
    geometry.setIndex(index);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector3() },
        uU: { value: new THREE.Vector3(1, 0, 0) },
        uV: { value: new THREE.Vector3(0, 0, 1) },
        uR: { value: 56 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uHalf: { value: 4 },
        uWidth: { value: 1.3 },
        uColor: { value: new THREE.Color("#ff7a26") },
        uGlow: { value: 2 },
        uLevel: { value: 1 },
        uHead: { value: 0 },
        uTime: shared.uTime,
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      // (the ribbon's winding flips with the line's direction on screen)
      side: THREE.DoubleSide,
    });
    return { geometry, material };
  }, [shared]);
  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  const mesh = useRef();
  const clock = useRef(0);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), e: new THREE.Euler(), buf: new THREE.Vector2() }), []);
  useFrame((_, delta) => {
    const blast = heroBlast(J.progress);
    const u = built.material.uniforms;
    u.uLevel.value = (1 - blast) * (1 - shared.uNight.value * 0.4);
    if (mesh.current) mesh.current.visible = u.uLevel.value > 0.001 && T.ringGlow > 0;
    if (!mesh.current?.visible) return;
    if (!reducedMotion()) clock.current += Math.min(delta, 0.1);
    const t = clock.current;
    // the plane: leaning towards the camera (its near side down), rolled,
    // swaying a little
    const deg = THREE.MathUtils.DEG2RAD;
    tmp.e.set((T.ringTilt + Math.sin(t * 0.07) * 1.2) * deg, Math.sin(t * 0.05) * 2 * deg, (T.ringRoll + Math.sin(t * 0.06 + 1) * 0.8) * deg, "ZYX");
    tmp.q.setFromEuler(tmp.e);
    u.uU.value.set(1, 0, 0).applyQuaternion(tmp.q);
    u.uV.value.set(0, 0, 1).applyQuaternion(tmp.q);
    u.uCenter.value.copy(core);
    // (the blast flings it outwards as it fades)
    u.uR.value = T.ringRadius * (1 + blast * 0.9);
    u.uHead.value = (t * T.ringSpeed) % 1;
    u.uGlow.value = T.ringGlow;
    if (u.uColor.value.userData !== T.crackColor) {
      u.uColor.value.set(T.crackColor).lerp(new THREE.Color("#ffb070"), 0.3);
      u.uColor.value.userData = T.crackColor;
    }
    // pixels: the drawing buffer (device pixels), the width in CSS pixels
    gl.getDrawingBufferSize(tmp.buf);
    const dpr = tmp.buf.y / Math.max(size.height, 1);
    u.uRes.value.set(tmp.buf.x * 0.5, tmp.buf.y * 0.5);
    u.uWidth.value = T.ringWidth * dpr;
    u.uHalf.value = T.ringWidth * dpr * 0.5 + 4 * dpr;
  });

  return <mesh ref={mesh} geometry={built.geometry} material={built.material} frustumCulled={false} renderOrder={5} />;
}
