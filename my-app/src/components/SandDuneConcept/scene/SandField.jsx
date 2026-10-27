"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../world/layout";
import { STIR_SLOTS } from "../world/materials";
import { attachPointer, pointer } from "../pointer";
import { T } from "../tuning";
import { getAudio } from "../audio";

// Hovering the dunes digs into the sand. The pointer ray is marched against
// the height field; each new touch point becomes a "stir" (position, age,
// strength) that (a) throws a spray of grains up out of the surface here,
// and (b) presses a dent and a spreading ripple ring into the sand
// material. Every grain belongs to one stir slot and sits under the sand
// until its slot is dug: it then launches from the crater on a ballistic
// arc, lands and settles back in.
const GRAVITY = 9.8;

const GRAIN_VERTEX = /* glsl */ `
attribute vec4 aGrain; // crater offset xz (unit disc), launch seeds
attribute float aSlot;
uniform sampler2D uHeight;
uniform vec4 uHMap; // x0, z0, step, n
uniform vec4 uStir[${STIR_SLOTS}];
uniform float uFlatten;
uniform float uScale;
uniform float uVis;
uniform float uStrength;
uniform float uRadius;
uniform float uSize;
varying float vA;
varying float vAir;
float ncGround(vec2 xz) {
  vec2 uv = ((xz - uHMap.xy) / uHMap.z + 0.5) / uHMap.w;
  return texture2D(uHeight, uv).r * (1.0 - uFlatten);
}
void main() {
  vec4 s = uStir[int(aSlot + 0.5)];
  float t = s.z - aGrain.w * 0.14; // grains leave the crater in a short burst
  if (s.w <= 0.001 || t <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vA = 0.0;
    vAir = 0.0;
    return;
  }
  float r = length(aGrain.xy);
  vec2 dir = r > 1e-3 ? aGrain.xy / r : vec2(1.0, 0.0);
  float power = 0.4 + 0.2 * uStrength;
  // grains from the middle of the crater fly highest
  float up = (1.2 + aGrain.z * 3.6) * power * (1.15 - 0.5 * r);
  float out_ = (0.5 + aGrain.w * 2.0) * power * (0.4 + r);
  float land = 2.0 * up / ${GRAVITY.toFixed(1)};
  float ta = min(t, land);
  vec2 xz = s.xy + aGrain.xy * uRadius * 0.9 + dir * out_ * ta;
  float y = max(up * ta - 0.5 * ${GRAVITY.toFixed(1)} * ta * ta, 0.0);
  vec3 p = vec3(xz.x, ncGround(xz) + 0.02 + y, xz.y);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  vAir = smoothstep(0.0, 0.25, y);
  // emerge from the surface, settle back into it after landing
  vA = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(land, land + 0.45, t)) * uVis;
  vA *= smoothstep(1.5, 4.0, dist) * (1.0 - smoothstep(45.0, 75.0, dist));
  gl_PointSize = max((0.018 + aGrain.z * 0.022) * uSize * uScale / max(dist, 0.5), 1.2) * step(0.001, vA);
}
`;
// Grains have their own day and night colours (lighter than the dunes, so
// the spray reads against them), blended with night mode; a touch brighter
// in the air where they catch the light.
const GRAIN_FRAGMENT = /* glsl */ `
uniform vec3 uSand;
varying float vA;
varying float vAir;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.3, 0.5, d);
  if (m * vA < 0.01) discard;
  vec3 col = uSand * mix(0.8, 1.15, vAir);
  gl_FragColor = vec4(col, clamp(m * vA, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default function SandField({ J, tier, shared, heightField }) {
  const { camera, gl } = useThree();
  const ref = useRef();
  useEffect(() => attachPointer(), []);

  const built = useMemo(() => {
    const rng = mulberry32(4242);
    const n = tier.sandGrains;
    const grain = new Float32Array(n * 4);
    const slot = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // uniform over the crater disc
      const r = Math.sqrt(rng());
      const a = rng() * Math.PI * 2;
      grain.set([Math.cos(a) * r, Math.sin(a) * r, rng(), rng()], i * 4);
      slot[i] = i % STIR_SLOTS;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geometry.setAttribute("aGrain", new THREE.BufferAttribute(grain, 4));
    geometry.setAttribute("aSlot", new THREE.BufferAttribute(slot, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uHeight: { value: heightField.texture },
        uHMap: { value: heightField.params },
        uStir: shared.uStir,
        uFlatten: shared.uFlatten,
        uScale: { value: 500 },
        uVis: { value: 1 },
        uStrength: { value: 1 },
        uRadius: { value: 1 },
        uSize: { value: 1 },
        uSand: { value: new THREE.Color() },
      },
      vertexShader: GRAIN_VERTEX,
      fragmentShader: GRAIN_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    return { geometry, material };
  }, [tier, shared, heightField]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  const s = useMemo(
    () => ({
      raycaster: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      p: new THREE.Vector3(),
      night: new THREE.Color(),
      ptr: new THREE.Vector2(),
      last: new THREE.Vector2(1e9, 1e9),
      lastAt: 0,
      next: 0,
    }),
    []
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const stir = shared.uStir.value;

    // age and fade every stir
    for (const v of stir) {
      if (v.w <= 0) continue;
      v.z += dt;
      // the line merges back into the sand over lineMerge seconds; the
      // slot stays alive until its grains have landed too
      const merge = Math.max(T.lineMerge, 0.1);
      const f = 1 - Math.min(v.z / merge, 1);
      v.w = v.z < Math.max(merge, 2.2) ? Math.max(f * f * (3 - 2 * f), 0.002) : 0;
    }

    // The sand only reacts in the open desert (not in the core / white).
    const interactive = pointer.active && J.energy < 0.05 && J.field < 0.05 && J.white < 0.4;
    // pointer speed over the dunes drives one continuous wind of sand
    const ps = Math.hypot(pointer.x - s.ptr.x, pointer.y - s.ptr.y) / dt;
    s.ptr.set(pointer.x, pointer.y);
    let sandLevel = 0;
    if (interactive) {
      s.ndc.set(pointer.x, pointer.y);
      s.raycaster.setFromCamera(s.ndc, camera);
      const { origin, direction } = s.raycaster.ray;
      let t = 1;
      let hit = false;
      let prev = 0;
      for (let i = 0; i < 160 && t < 420; i++) {
        s.p.copy(origin).addScaledVector(direction, t);
        if (s.p.y < heightField.sample(s.p.x, s.p.z) * (1 - J.flatten)) {
          // refine between prev and t
          let lo = prev;
          let hi = t;
          for (let k = 0; k < 8; k++) {
            const mid = (lo + hi) / 2;
            s.p.copy(origin).addScaledVector(direction, mid);
            if (s.p.y < heightField.sample(s.p.x, s.p.z) * (1 - J.flatten)) hi = mid;
            else lo = mid;
          }
          s.p.copy(origin).addScaledVector(direction, hi);
          hit = true;
          break;
        }
        prev = t;
        t += Math.max(0.5, t * 0.03);
      }
      const now = performance.now();
      const moved = Math.hypot(s.p.x - s.last.x, s.p.z - s.last.y);
      // points close enough together that the line reads as one stroke
      if (hit && now - pointer.movedAt < 120 && (moved > Math.max(1.2, T.lineWidth * 3) || now - s.lastAt > 90)) {
        const slot = stir[s.next];
        slot.set(s.p.x, s.p.z, 0, 1);
        s.next = (s.next + 1) % stir.length;
        s.last.set(s.p.x, s.p.z);
        s.lastAt = now;
      }
      if (hit && now - pointer.movedAt < 150) sandLevel = Math.min(ps / 1.1, 1);
    }
    getAudio()?.sandHover(sandLevel, pointer.x);

    const u = built.material.uniforms;
    u.uScale.value = gl.domElement.height * 0.5;
    u.uVis.value = T.grainOpacity * (1 - J.white) * (J.energy < 0.05 && J.field < 0.05 ? 1 : 0);
    u.uStrength.value = T.stirStrength;
    u.uSize.value = T.grainSize;
    u.uSand.value.set(T.grainColorDay).lerp(s.night.set(T.grainColorNight), shared.uNight.value);
    u.uRadius.value = T.stirRadius;
    const anyStir = stir.some((v) => v.w > 0);
    shared.uStirActive.value = anyStir ? 1 : 0;
    if (ref.current) ref.current.visible = u.uVis.value > 0.001 && anyStir;
  });

  return <points ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} />;
}
