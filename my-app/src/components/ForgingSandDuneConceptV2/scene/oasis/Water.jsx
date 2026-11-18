"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { NO_MIRROR_LAYER, P, SUN_DIR } from "../../config";
import { T } from "../../tuning";
import { OASIS_RECT, WATER_Y } from "../../world/oasis";
import { REVEAL_GLSL } from "../../world/revealMap";
import { createWaterRipples } from "../../world/waterRipples";
import { waterHits } from "../../pointer";

// The oasis's water: the stream down the passage and the lake round the
// tree — one sheet at WATER_Y over the oasis, the ground rising through it
// wherever it is dry. A mirror (the dunes, the palms, the tree, the streaks
// and the low sun in it), broken up by small wind-driven waves; turquoise
// in the shallows and over the sand, deep teal where it is deep, the sand
// showing through at its edges. Without the mirror (the low tier) it
// reflects a sky of its own.
//
// It answers the cursor as the garden's pond does: wherever the pointer
// passes over the water (SandField's pointer ray lands on it, and the sand
// stays quiet) rings drop into a wave simulation (world/waterRipples.js)
// over a square of the water ahead of the camera; they spread, cross and
// die away at a steady pace, bending the reflections as they go, however
// fast or far the cursor moves.
const RIPPLE_SIZE = 220; // metres the ripples' square covers
const RIPPLE_RES = 768;

const VERTEX = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vMirror;
varying vec3 vWorld;
#include <common>
#include <fog_pars_vertex>
void main() {
  vMirror = textureMatrix * vec4(position, 1.0);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 color;
uniform float uTime;
uniform sampler2D uOasisMap;
uniform vec4 uOasisRect;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uShore;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyLow;
uniform vec3 uSkyHigh;
uniform float uMirror;
uniform float uWaves;
uniform vec3 uAmberPos;
uniform float uAmber;
uniform sampler2D uRipple;
uniform vec4 uRippleRect;
uniform float uRippleOn;
uniform float uRippleK;
${REVEAL_GLSL}
varying vec4 vMirror;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// the surface's slope: a few wind-driven wave trains and a fine chop
vec2 wSlope(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 d1 = normalize(vec2(-0.8, -0.6));
  vec2 d2 = normalize(vec2(-0.3, -0.95));
  vec2 d3 = normalize(vec2(0.7, -0.7));
  g += d1 * cos(dot(p, d1) * 0.9 + t * 1.6) * 0.06;
  g += d2 * cos(dot(p, d2) * 1.7 + t * 2.3) * 0.04;
  g += d3 * cos(dot(p, d3) * 2.9 + t * 3.1) * 0.025;
  float e = 0.35;
  vec2 q = p * 1.6 + vec2(t * 0.6, -t * 0.4);
  float n = wNoise(q);
  g += vec2(wNoise(q + vec2(e, 0.0)) - n, wNoise(q + vec2(0.0, e)) - n) * 0.16;
  return g;
}
void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  // waves settle with distance (no shimmer on the far lake)
  vec2 g = wSlope(vWorld.xz, uTime) * uWaves * (1.0 - smoothstep(40.0, 420.0, dist) * 0.8);
  // the cursor's ripples
  if (uRippleOn > 0.5) {
    vec2 ruv = (vWorld.xz - uRippleRect.xy) / uRippleRect.zw;
    if (ruv.x > 0.0 && ruv.y > 0.0 && ruv.x < 1.0 && ruv.y < 1.0) {
      vec2 tx = vec2(1.0 / ${RIPPLE_RES.toFixed(1)}, 0.0);
      float hx = texture2D(uRipple, ruv + tx.xy).r - texture2D(uRipple, ruv - tx.xy).r;
      float hz = texture2D(uRipple, ruv + tx.yx).r - texture2D(uRipple, ruv - tx.yx).r;
      g += vec2(hx, hz) * uRippleK;
    }
  }
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  float fres = 0.025 + 0.975 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec4 om = texture2D(uOasisMap, (vWorld.xz - uOasisRect.xy) / uOasisRect.zw);
  float depth = om.a * 6.0;
  // the water itself, and the sand showing through where it is shallow
  vec3 body = mix(uShallow, uDeep, smoothstep(0.15, 3.8, depth));
  body = mix(uShore, body, smoothstep(0.0, 0.7, depth));
  vec3 R = reflect(-V, N);
  #ifdef MIRROR
    vec2 uv = vMirror.xy / vMirror.w + N.xz * 0.6 / (1.0 + dist * 0.02);
    vec3 refl = texture2D(tDiffuse, uv).rgb;
  #else
    vec3 refl = mix(uSkyLow, uSkyHigh, smoothstep(0.0, 0.5, R.y));
    refl += uSunColor * 0.05 * pow(max(dot(R, uSunDir), 0.0), 8.0);
  #endif
  vec3 col = mix(body, refl, clamp(fres * uMirror, 0.0, 1.0));
  // the sun's glitter on the waves
  col += uSunColor * pow(max(dot(R, uSunDir), 0.0), 420.0) * 1.4;
  // the tree's amber glow on the lake
  float a = uAmber / (1.0 + pow(length(vWorld.xz - uAmberPos.xz) / 70.0, 2.0));
  col += vec3(1.0, 0.42, 0.1) * a * 0.12 * (0.6 + fres);
  // ...and at its edge it thins away over the sand under it: no line where
  // the ground comes up through it (the map's depth is smooth, the mesh's
  // crossing of the surface is not)
  float edge = smoothstep(0.02, 0.55, depth);
  // (and none of it until the oasis has come up here)
  float rv = ncRevealWater(vWorld.xz);
  // (the water comes in once the sand filling its bed has sunk away:
  // world/materials.js)
  gl_FragColor = vec4(col, edge * smoothstep(0.55, 1.0, rv));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export default function Water({ J, tier, shared, ground, treePos }) {
  const mirror = tier.reflections;
  const water = useMemo(() => {
    const { x0, z0, x1, z1 } = OASIS_RECT;
    const geometry = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        tDiffuse: { value: null },
        color: { value: new THREE.Color(1, 1, 1) },
        textureMatrix: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uOasisMap: { value: null },
        uOasisRect: { value: new THREE.Vector4() },
        uShallow: { value: new THREE.Color() },
        uDeep: { value: new THREE.Color() },
        uShore: { value: new THREE.Color() },
        uSunDir: { value: SUN_DIR.clone() },
        uSunColor: { value: new THREE.Color() },
        uSkyLow: { value: new THREE.Color(0.9, 0.48, 0.24) },
        uSkyHigh: { value: new THREE.Color(0.3, 0.33, 0.4) },
        uMirror: { value: 1 },
        uWaves: { value: 1 },
        uAmberPos: { value: new THREE.Vector3() },
        uAmber: { value: 0 },
        uRipple: { value: null },
        uRippleRect: { value: new THREE.Vector4() },
        uRippleOn: { value: 0 },
        uRippleK: { value: 9 },
        uOasisReveal: { value: new THREE.Vector4() },
        uRevealMap: { value: null },
        uRevealRect: { value: new THREE.Vector4() },
      },
    ]);
    const shader = { name: "OasisWater", uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT };
    let mesh;
    if (mirror) {
      const size = new THREE.Vector2();
      mesh = new Reflector(geometry, {
        shader,
        textureWidth: 1024,
        textureHeight: 512,
        clipBias: 0.02,
      });
      mesh.material.defines = { MIRROR: "" };
      // the mirror at half the screen's resolution
      const rt = mesh.getRenderTarget();
      mesh.userData.resize = (gl) => {
        gl.getDrawingBufferSize(size);
        const w = Math.max(Math.round(size.x * 0.3), 256);
        const h = Math.max(Math.round(size.y * 0.3), 128);
        if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      };
    } else {
      mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ name: "OasisWater", uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT }));
    }
    mesh.material.fog = true;
    mesh.material.transparent = true;
    const u = mesh.material.uniforms;
    u.uTime = shared.uTime;
    u.uOasisReveal = shared.uOasisReveal;
    u.uRevealMap = shared.uRevealMap;
    u.uRevealRect = shared.uRevealRect;
    u.uOasisMap.value = ground.texture;
    u.uOasisRect.value.copy(ground.rect);
    u.uAmberPos.value.copy(treePos);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, WATER_Y, (z0 + z1) / 2);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    return mesh;
  }, [mirror, shared, ground, treePos]);

  const ripples = useMemo(() => createWaterRipples(new THREE.Vector4(0, 0, RIPPLE_SIZE, RIPPLE_SIZE), RIPPLE_RES), []);
  const rip = useMemo(() => ({ last: null, centre: new THREE.Vector2(1e9, 1e9), fwd: new THREE.Vector3(), drops: [] }), []);
  useEffect(() => () => ripples.dispose(), [ripples]);

  useEffect(
    () => () => {
      water.geometry.dispose();
      water.material.dispose();
      water.getRenderTarget?.().dispose();
      water.dispose?.();
    },
    [water]
  );

  useFrame(({ gl, camera }, delta) => {
    // only past the mark (the mirror costs a render of the scene)
    water.visible = J.progress > P.pass || J.warmup > 0;
    if (!water.visible) {
      waterHits.length = 0;
      return;
    }
    // the ripples' square: ahead of the camera, moved on once the rings have
    // died away (or, if the camera has gone on far past it, regardless)
    camera.getWorldDirection(rip.fwd);
    rip.fwd.y = 0;
    rip.fwd.normalize();
    const cx = camera.position.x + rip.fwd.x * RIPPLE_SIZE * 0.3;
    const cz = camera.position.z + rip.fwd.z * RIPPLE_SIZE * 0.3;
    const away = Math.hypot(cx - rip.centre.x, cz - rip.centre.y);
    if ((away > 25 && ripples.idle()) || away > RIPPLE_SIZE * 0.42) {
      rip.centre.set(cx, cz);
      ripples.recentre(cx, cz);
    }
    // the pointer's path over the water → rings every ~0.6 m along it,
    // stronger and wider the faster it moves
    const now = performance.now();
    const drops = rip.drops;
    drops.length = 0;
    for (const h of waterHits) {
      const prev = rip.last && now - rip.last.t < 220 ? rip.last : null;
      const moved = prev ? Math.hypot(h.x - prev.x, h.z - prev.z) : 0.8;
      if (prev && moved < 0.6) continue;
      const [u, v] = ripples.uv(h.x, h.z);
      if (u > 0.01 && v > 0.01 && u < 0.99 && v < 0.99) {
        const fast = Math.min(moved / 3, 1);
        drops.push([u, v, (0.14 + 0.22 * fast) * T.waterRipple, (0.8 + 0.7 * fast) * T.waterRippleRadius]);
      }
      rip.last = h;
    }
    waterHits.length = 0;
    // (a long flick: keep an even spread of its rings)
    if (drops.length > 24) {
      const every = drops.length / 24;
      for (let i = 0; i < 24; i++) drops[i] = drops[Math.floor(i * every)];
      drops.length = 24;
    }
    const tex = ripples.step(gl, drops, Math.min(delta, 0.1), { damping: T.waterRippleDamping, speed: T.waterRippleSpeed });
    const u0 = water.material.uniforms;
    u0.uRipple.value = tex;
    u0.uRippleRect.value.copy(ripples.rect);
    u0.uRippleOn.value = ripples.idle() ? 0 : 1;
    water.userData.resize?.(gl);
    // the mirror's camera sees what the camera sees, less the low plants
    // (Reflector clones the camera once: its layers are kept in step here)
    if (water.getReflectionCamera) {
      const rc = water.getReflectionCamera(camera);
      rc.layers.mask = camera.layers.mask;
      rc.layers.disable(NO_MIRROR_LAYER);
    }
    const u = water.material.uniforms;
    u.uShallow.value.set(T.waterShallow);
    u.uDeep.value.set(T.waterDeep);
    u.uShore.value.set(T.waterShore);
    u.uSunColor.value.set(T.sunColor).multiplyScalar(T.sunIntensity * 1.6);
    u.uMirror.value = T.waterMirror;
    u.uWaves.value = T.waterWaves;
    u.uAmber.value = J.treeGlow * T.treeGlow;
  });

  return <primitive object={water} />;
}
