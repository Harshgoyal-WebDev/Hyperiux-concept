"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SUN_DIR } from "../../config";
import { mulberry32 } from "../../world/layout";
import { T } from "../../tuning";
import { Q } from "../../quality";
import { reducedMotion } from "./heroState";

// Desert dust held in the air over the whole hero view (the near motes
// round the camera are Rig.jsx Dust): thousands of points in a box over the
// dunes round the slab, drifting with the wind in slow swirls, each its own
// size, pace and opacity. Looking towards the low sun they light up (the
// light scattering forwards through them); near the core they warm to its
// orange and brighten. A share of them skims low over the sand, following
// the dunes' height (the height map): the wind lifting the sand.
// Points smaller than a pixel are held at about a pixel and dimmed by as
// much, so the far ones never sparkle.
const DEFAULT_MIN = new THREE.Vector3(-300, 0, -380);
const DEFAULT_SIZE = new THREE.Vector3(600, 80, 540);
const GROUND = 0.3; // share of the motes skimming the sand
const COUNT = { high: 5200, medium: 3400, low: 1500 };

const VERTEX = /* glsl */ `
uniform float uTime;
uniform vec2 uWind;
uniform vec3 uBoxMin;
uniform vec3 uBoxSize;
uniform sampler2D uHeight;
uniform vec4 uHMap;
uniform vec3 uCore;
uniform vec3 uSun;
uniform float uScale;
uniform float uSize;
uniform float uLevel;
uniform float uNight;
attribute vec4 aInfo; // size (0..1), phase, pace (0..1), skims the sand (0 / 1)
varying float vA;
varying vec3 vCol;
float ground(vec2 xz) {
  vec2 uv = ((xz - uHMap.xy) / uHMap.z + 0.5) / uHMap.w;
  return texture2D(uHeight, uv).r;
}
void main() {
  float t = uTime;
  bool low = aInfo.w > 0.5;
  float ph = aInfo.y * 6.2831853;
  // carried on the wind (the low ones faster, as sand is), in slow swirls
  vec3 p = position;
  p.xz += uWind * t * (0.8 + aInfo.z * 2.2) * (low ? 2.6 : 1.0);
  p += vec3(sin(t * 0.11 + ph), sin(t * 0.083 + ph * 1.7) * 0.5, cos(t * 0.097 + ph * 1.3)) * (2.0 + aInfo.z * 3.0);
  p.xz = uBoxMin.xz + mod(p.xz - uBoxMin.xz, uBoxSize.xz);
  if (low) p.y = ground(p.xz) + position.y;
  else p.y = uBoxMin.y + mod(p.y - uBoxMin.y, uBoxSize.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.1);
  float px = mix(0.06, 0.34, aInfo.x * aInfo.x) * uSize * uScale / dist;
  float a = mix(0.3, 0.7, aInfo.x);
  // (under a pixel: held at about one, dimmer by as much)
  if (px < 1.2) {
    a *= px / 1.2;
    px = 1.2;
  }
  gl_PointSize = min(px, 22.0);
  // none right at the lens; thinning into the haze
  a *= smoothstep(3.0, 14.0, dist) * exp(-dist * 0.0018);
  // the sun's light scattered forwards through them
  vec3 view = normalize(p - cameraPosition);
  float sun = pow(max(dot(view, uSun), 0.0), 6.0);
  // (fewer and fainter high up: against the sky they read as stars)
  a *= 1.0 - smoothstep(18.0, 60.0, p.y) * 0.8;
  // ...and the core's, close to it
  float core = exp(-length(p - uCore) / 15.0);
  vCol = mix(vec3(0.8, 0.5, 0.3), vec3(1.0, 0.66, 0.4) * 1.5, sun);
  // (by night, fine motes catching the moonlight: cool silver)
  vCol = mix(vCol, mix(vec3(0.45, 0.55, 0.75), vec3(0.75, 0.85, 1.0) * 1.4, sun), uNight);
  vCol = mix(vCol, vec3(1.0, 0.42, 0.1) * 3.2, core * 0.85);
  a *= 0.5 + 1.3 * sun + 1.6 * core;
  // turning as they drift: a gentle flicker
  a *= 0.78 + 0.22 * sin(t * 1.3 + ph * 7.0);
  vA = a * uLevel;
}
`;
const FRAGMENT = /* glsl */ `
varying float vA;
varying vec3 vCol;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.1, 0.5, d);
  gl_FragColor = vec4(vCol * m * vA, m * vA);
}
`;

// (reusable: `box` the region it fills ({ min, size }), `gate` when it shows
// (a function of the scroll, 0..1), `core` a glowing point that warms the
// motes near it — the slab's core, the valley's orb)
export default function FieldDust({ J, tier, shared, heightField, core, box, gate, seed = 829 }) {
  const { gl, camera } = useThree();
  const BOX_MIN = box?.min ?? DEFAULT_MIN;
  const BOX_SIZE = box?.size ?? DEFAULT_SIZE;
  const built = useMemo(() => {
    const n = COUNT[tier.name] ?? COUNT.medium;
    const rng = mulberry32(seed);
    const pos = new Float32Array(n * 3);
    const info = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const low = rng() < GROUND;
      pos[i * 3] = BOX_MIN.x + rng() * BOX_SIZE.x;
      // (the low ones: their height over the sand)
      pos[i * 3 + 1] = low ? 0.15 + rng() * rng() * 3.5 : BOX_MIN.y + Math.pow(rng(), 1.6) * BOX_SIZE.y;
      pos[i * 3 + 2] = BOX_MIN.z + rng() * BOX_SIZE.z;
      info.set([Math.pow(rng(), 1.8), rng(), rng(), low ? 1 : 0], i * 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWind: shared.uWind,
        uBoxMin: { value: BOX_MIN },
        uBoxSize: { value: BOX_SIZE },
        uHeight: { value: heightField.texture },
        uHMap: { value: heightField.params },
        uCore: { value: new THREE.Vector3(0, 30, 2) },
        uSun: { value: SUN_DIR.clone() },
        uScale: { value: 500 },
        uSize: { value: 1 },
        uLevel: { value: 1 },
        uNight: shared.uNight,
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material, n };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the box is fixed per use
  }, [tier, shared, heightField, seed]);
  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  const ref = useRef();
  const buf = useMemo(() => new THREE.Vector2(), []);
  useFrame((_, delta) => {
    const u = built.material.uniforms;
    if (!reducedMotion()) u.uTime.value += Math.min(delta, 0.1);
    if (core) u.uCore.value.copy(core);
    gl.getDrawingBufferSize(buf);
    u.uScale.value = (buf.y * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    u.uSize.value = T.fieldDustSize;
    // (thinner by moonlight; through the forging the swirl's sand is enough)
    u.uLevel.value = T.fieldDust * (1 - shared.uNight.value * 0.35) * Math.min(J.dust, 1) * (gate ? gate(J.progress) : 1);
    if (ref.current) ref.current.visible = u.uLevel.value > 0.001;
    // (fewer when the frame rate governor steps down: quality.js)
    built.geometry.setDrawRange(0, Math.round(built.n * Math.max(Q.density, 0.35)));
  });

  return <points ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} />;
}
