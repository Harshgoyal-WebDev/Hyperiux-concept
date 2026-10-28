"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { GARDEN, GARDEN_ORIGIN } from "../../config";
import { pointer } from "../../pointer";
import { T } from "../../tuning";
import { GARDEN_SUN, SKY_GLSL } from "./sky";

// The pond: a real mirror of the garden (a planar reflection — the trees, the
// sky and the particle logo, upside down in the water; the lawn's blades are
// left out of it), broken up by
//   currents – a slow circulation round the pond, its surface ripples
//              flowing along it (two phases of a flow map, so they never
//              smear), and
//   ripples  – a wave simulation on a grid over the pond: the pointer drops
//              rings into it as it moves over the water, which spread,
//              cross, bounce off nothing and die away.
// Fresnel decides how much is mirror and how much is water: deep green-blue
// in the middle, the shallows clearer towards the banks.

const SIM = 256; // ripple grid
const HALF = [GARDEN.pondAxes[0] * 1.3, GARDEN.pondAxes[1] * 1.3]; // the grid's half extent (m)

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
// height in r, velocity in g
const SIM_FRAGMENT = /* glsl */ `
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec3 uDrop; // uv x, y, strength
uniform float uDropRadius; // in uv
uniform float uDamping;
uniform float uSpeed;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uPrev, vUv);
  float avg = (
    texture2D(uPrev, vUv + vec2(uTexel.x, 0.0)).r + texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)).r +
    texture2D(uPrev, vUv + vec2(0.0, uTexel.y)).r + texture2D(uPrev, vUv - vec2(0.0, uTexel.y)).r
  ) * 0.25;
  float v = (c.g + (avg - c.r) * uSpeed) * uDamping;
  float h = c.r + v;
  float d = length(vUv - uDrop.xy) / uDropRadius;
  h += uDrop.z * exp(-d * d * 3.0);
  // fade out at the grid's edge
  vec2 e = min(vUv, 1.0 - vUv);
  h *= smoothstep(0.0, 0.03, min(e.x, e.y));
  gl_FragColor = vec4(h, v, 0.0, 1.0);
}
`;

const WATER_VERTEX = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 vReflect;
varying vec3 vWorld;
varying vec2 vLocal;
void main() {
  vLocal = position.xy; // the reflector is a plane in its own xy
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vReflect = textureMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const WATER_FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 color;
uniform sampler2D uRipples;
uniform vec2 uHalf;
uniform vec2 uAxes;
uniform float uTime;
uniform vec3 uSunDir;
uniform float uReflect;
uniform float uDistort;
uniform float uCurrentSpeed;
uniform float uCurrentScale;
uniform float uRippleStrength;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uClarity;
uniform float uHasReflection;
varying vec4 vReflect;
varying vec3 vWorld;
varying vec2 vLocal;
${SKY_GLSL}
// smooth noise and its gradient (for the surface's small waves)
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 wNoiseD(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = wHash(i), b = wHash(i + vec2(1.0, 0.0)), c = wHash(i + vec2(0.0, 1.0)), d = wHash(i + vec2(1.0, 1.0));
  return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y,
              du * vec2(b - a + (a - b - c + d) * u.y, c - a + (a - b - c + d) * u.x));
}
vec2 waves(vec2 p) {
  vec2 g = wNoiseD(p).yz * 0.6;
  g += wNoiseD(p * 2.1 + 7.0).yz * 0.3;
  g += wNoiseD(p * 4.3 + 13.0).yz * 0.15;
  return g;
}
void main() {
  // the pond, from its own centre (the reflector's xy is world x, -z)
  vec2 xz = vec2(vLocal.x, -vLocal.y);
  float shore = length(xz / uAxes);
  // currents: a slow circulation round the pond; the waves are carried
  // along it in two phases blended so the stretching never shows
  vec2 flow = vec2(-xz.y, xz.x) / max(length(xz), 0.5) * (0.6 + 0.4 * smoothstep(0.2, 0.9, shore));
  float t = uTime * uCurrentSpeed * 0.25;
  float ph0 = fract(t);
  float ph1 = fract(t + 0.5);
  vec2 p = xz * uCurrentScale;
  vec2 g0 = waves(p - flow * ph0 * 1.6);
  vec2 g1 = waves(p - flow * ph1 * 1.6 + 3.7);
  vec2 g = mix(g0, g1, abs(0.5 - ph0) * 2.0) * 0.05;
  // the pointer's ripples
  vec2 ruv = xz / (2.0 * uHalf) + 0.5;
  vec2 rt = vec2(1.0 / ${SIM}.0);
  float hx = texture2D(uRipples, ruv + vec2(rt.x, 0.0)).r - texture2D(uRipples, ruv - vec2(rt.x, 0.0)).r;
  float hz = texture2D(uRipples, ruv + vec2(0.0, rt.y)).r - texture2D(uRipples, ruv - vec2(0.0, rt.y)).r;
  g += vec2(hx, hz) * uRippleStrength;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(cameraPosition - vWorld);
  float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
  // the mirror image, displaced by the surface
  vec4 r = vReflect;
  r.xy += n.xz * uDistort * r.w;
  vec3 refl = uHasReflection > 0.5 ? texture2DProj(tDiffuse, r).rgb : gardenSky(reflect(-v, n), uSunDir);
  vec3 body = mix(uDeep, uShallow, smoothstep(0.45, 1.0, shore));
  vec3 col = mix(body, refl, clamp(mix(0.35, 1.0, fresnel) * uReflect, 0.0, 1.0));
  // the sun glinting on the ripples
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-uSunDir, n), v), 0.0), 220.0) * 1.6;
  // clear over the shallows (the bed shows through), denser in the middle
  float a = mix(0.96, uClarity, smoothstep(0.75, 1.08, shore));
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const WATER_UNIFORMS = () => ({
  tDiffuse: { value: null },
  color: { value: new THREE.Color() },
  textureMatrix: { value: new THREE.Matrix4() },
  uRipples: { value: null },
  uHalf: { value: new THREE.Vector2(...HALF) },
  uAxes: { value: new THREE.Vector2(...GARDEN.pondAxes) },
  uTime: { value: 0 },
  uSunDir: { value: GARDEN_SUN.clone() },
  uReflect: { value: 1 },
  uDistort: { value: 0.04 },
  uCurrentSpeed: { value: 1 },
  uCurrentScale: { value: 1.2 },
  uRippleStrength: { value: 1 },
  uDeep: { value: new THREE.Color("#0b2a2c") },
  uShallow: { value: new THREE.Color("#3a5a3f") },
  uClarity: { value: 0.45 },
  uHasReflection: { value: 1 },
});

export default function GardenPond({ tier, time }) {
  const { gl, camera, size } = useThree();
  const built = useMemo(() => {
    // the water: an ellipse a little larger than the pond (the banks hide
    // the excess), lying flat at water level
    const geometry = new THREE.CircleGeometry(1, 128).scale(GARDEN.pondAxes[0] * 1.22, GARDEN.pondAxes[1] * 1.22, 1);
    const shader = { name: "GardenPond", uniforms: WATER_UNIFORMS(), vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT };
    let water;
    const reflect = tier.pondReflection > 0;
    if (reflect) {
      water = new Reflector(geometry, { textureWidth: 512, textureHeight: 512, clipBias: 0.003, shader, multisample: 0 });
      // the reflection leaves out the lawn's blades (layer 1)
      const get = water.getReflectionCamera.bind(water);
      water.getReflectionCamera = (cam) => {
        const rc = get(cam);
        rc.layers.set(0);
        return rc;
      };
    } else {
      water = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ ...shader, uniforms: shader.uniforms }));
      water.material.uniforms.uHasReflection.value = 0;
    }
    water.material.transparent = true;
    water.material.depthWrite = false;
    water.rotation.x = -Math.PI / 2;
    water.position.copy(GARDEN.pond);
    water.renderOrder = 3;

    // the ripple simulation (ping-pong)
    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    const targets = [new THREE.WebGLRenderTarget(SIM, SIM, opts), new THREE.WebGLRenderTarget(SIM, SIM, opts)];
    const simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: null },
        uTexel: { value: new THREE.Vector2(1 / SIM, 1 / SIM) },
        uDrop: { value: new THREE.Vector3(0, 0, 0) },
        uDropRadius: { value: 0.02 },
        uDamping: { value: 0.985 },
        uSpeed: { value: 1.6 },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: SIM_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const simScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    quad.frustumCulled = false;
    simScene.add(quad);
    const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { water, geometry, targets, simMaterial, simScene, simCamera, quad, read: 0, cleared: false, reflect };
  }, [tier]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      if (built.reflect) built.water.dispose();
      else built.water.material.dispose();
      built.targets.forEach((t) => t.dispose());
      built.simMaterial.dispose();
      built.quad.geometry.dispose();
    },
    [built]
  );

  // reflection resolution follows the canvas
  useEffect(() => {
    if (!built.reflect) return;
    const k = tier.pondReflection * Math.min(gl.getPixelRatio(), 1.5);
    built.water.getRenderTarget().setSize(Math.max(256, Math.round(size.width * k)), Math.max(256, Math.round(size.height * k)));
  }, [built, gl, size, tier]);

  const s = useMemo(
    () => ({ ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit: new THREE.Vector3(), last: new THREE.Vector3(1e9, 0, 0) }),
    []
  );

  useFrame(() => {
    const u = built.water.material.uniforms;
    u.uTime.value = time.value;
    u.uReflect.value = T.pondReflect;
    u.uDistort.value = T.pondDistortion;
    u.uCurrentSpeed.value = T.pondCurrentSpeed;
    u.uCurrentScale.value = T.pondCurrentScale;
    u.uRippleStrength.value = T.pondRippleStrength;
    u.uDeep.value.set(T.pondDeep);
    u.uShallow.value.set(T.pondShallow);
    u.uClarity.value = T.pondClarity;

    // the pointer over the water drops rings, more the faster it moves
    const sim = built.simMaterial.uniforms;
    sim.uDrop.value.z = 0;
    sim.uDamping.value = T.pondRippleDamping;
    sim.uDropRadius.value = T.pondRippleRadius / (2 * HALF[0]);
    if (pointer.active && performance.now() - pointer.movedAt < 150) {
      s.ndc.set(pointer.x, pointer.y);
      s.ray.setFromCamera(s.ndc, camera);
      s.plane.constant = -(GARDEN.water + GARDEN_ORIGIN.y);
      if (s.ray.ray.intersectPlane(s.plane, s.hit)) {
        const x = s.hit.x - GARDEN_ORIGIN.x - GARDEN.pond.x;
        const z = s.hit.z - GARDEN_ORIGIN.z - GARDEN.pond.z;
        const inside = Math.hypot(x / GARDEN.pondAxes[0], z / GARDEN.pondAxes[1]) < 1.05;
        const moved = s.hit.distanceTo(s.last);
        s.last.copy(s.hit);
        // (the sim's grid: uv x along +x, uv y along +z)
        if (inside && moved < 3) sim.uDrop.value.set(x / (2 * HALF[0]) + 0.5, z / (2 * HALF[1]) + 0.5, Math.min(moved * 0.06, 0.05) * T.pondRippleForce);
      }
    }

    // two sim steps a frame
    const prevTarget = gl.getRenderTarget();
    for (let k = 0; k < 2; k++) {
      const src = built.targets[built.read];
      const dst = built.targets[1 - built.read];
      if (!built.cleared) {
        gl.setRenderTarget(src);
        gl.clear();
        built.cleared = true;
      }
      sim.uPrev.value = src.texture;
      gl.setRenderTarget(dst);
      gl.render(built.simScene, built.simCamera);
      built.read = 1 - built.read;
      if (k === 0) sim.uDrop.value.z = 0;
    }
    gl.setRenderTarget(prevTarget);
    u.uRipples.value = built.targets[built.read].texture;
  });

  return <primitive object={built.water} />;
}
