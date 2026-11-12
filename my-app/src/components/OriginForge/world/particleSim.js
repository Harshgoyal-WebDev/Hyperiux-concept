import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { PARTICLE_PATH_GLSL, PARTICLE_PATH_UNIFORMS } from "./shaders";

// The pointer's touch on the particle field, simulated per particle on the
// GPU the way the garden's particle body is (ForgingConcept ParticleLogo):
//   pointer – particles near the cursor on screen are dragged along with its
//             movement and parted a little; a disturbed particle "scatters":
//             its spring loosens so it drifts on a divergence-free flow,
//             then it finds its way home
//   spring  – home is its place on the choreographed path (world/shaders.js
//             PARTICLE_PATH_GLSL), so the film's motion is never disturbed:
//             the simulation only holds an offset from it
//   glow    – it lights up with speed and scatter, quickly, and cools slowly
//
// tOff: offset (xyz, metres), glow (w).  tVel: velocity (xyz, m/s), scatter (w).

export const STIR = {
  hoverRadius: 0.1, // share of the screen's height round the pointer that it stirs
  hoverForce: 4.0, // how hard it parts them
  drag: 2.84, // how much they are carried along with its movement
  spring: 60, // how firmly they hold their place
  damping: 0.85, // how quickly their wobble dies (per 1/60 s)
  flow: 0.67, // how much the flow churns them while stirred
  flowScale: 0.32,
  scatterTime: 3.2, // seconds a stirred particle drifts loose before finding its way home
};

const NOISE_GLSL = /* glsl */ `
  float pnHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  vec4 pnNoised(vec3 x) {
    vec3 i = floor(x);
    vec3 w = fract(x);
    vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);
    vec3 du = 30.0 * w * w * (w * (w - 2.0) + 1.0);
    float a = pnHash(i + vec3(0, 0, 0)), b = pnHash(i + vec3(1, 0, 0));
    float c = pnHash(i + vec3(0, 1, 0)), d = pnHash(i + vec3(1, 1, 0));
    float e = pnHash(i + vec3(0, 0, 1)), f = pnHash(i + vec3(1, 0, 1));
    float g = pnHash(i + vec3(0, 1, 1)), h = pnHash(i + vec3(1, 1, 1));
    float k0 = a, k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d;
    float k5 = a - c - e + g, k6 = a - b - e + f, k7 = -a + b + c - d + e - f - g + h;
    return vec4(
      k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
      du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y)
    );
  }
  // divergence-free: the cross product of two noise gradients
  vec3 pnFlow(vec3 p) {
    return cross(pnNoised(p).yzw, pnNoised(p + vec3(31.4, 17.7, 9.2)).yzw);
  }
`;

const VELOCITY = /* glsl */ `
  uniform sampler2D tHome; // home (xyz), group (w)
  uniform sampler2D tSeed;
  uniform sampler2D tTarget;
  uniform float uDt;
  uniform mat4 uViewProj;
  uniform vec3 uCamRight, uCamUp;
  uniform float uTanHalf, uAspect;
  uniform vec2 uMouseUV, uMouseVel; // uv, uv / s
  uniform float uHover, uHoverRadius, uHoverForce, uDrag;
  uniform float uSpring, uDamping, uFlow, uFlowScale, uScatterTime;
  ${PARTICLE_PATH_GLSL}
  ${NOISE_GLSL}
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 O = texture2D(tOff, uv);
    vec4 V = texture2D(tVel, uv);
    vec4 H = texture2D(tHome, uv);
    float fade, glowK, alpha;
    vec3 base = particlePath(H.xyz, texture2D(tSeed, uv), texture2D(tTarget, uv).xyz, H.w, fade, glowK, alpha);
    vec3 off = O.xyz;
    vec3 pos = base + off;
    vec3 vel = V.xyz;
    float scatter = V.w;
    float dt60 = uDt * 60.0;

    // the pointer: drag along with its movement, part a little
    float fluid = 0.0;
    vec4 clip = uViewProj * vec4(pos, 1.0);
    if (clip.w > 0.05 && fade * alpha > 0.02) {
      vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
      vec2 d = suv - uMouseUV;
      d.x *= uAspect;
      float mask = (1.0 - smoothstep(uHoverRadius * 0.35, uHoverRadius, length(d))) * uHover;
      float worldH = 2.0 * clip.w * uTanHalf; // metres per screen height at this depth
      vec2 mv = vec2(uMouseVel.x * uAspect, uMouseVel.y);
      float mspeed = length(mv);
      fluid = mask * clamp(mspeed * 4.0, 0.0, 1.5);
      vec3 drag = (uCamRight * mv.x + uCamUp * mv.y) * worldH * uDrag;
      vel = mix(vel, drag, clamp(mask * 0.22 * dt60 * clamp(mspeed * 6.0, 0.0, 1.0), 0.0, 1.0));
      vec2 dn = d / max(length(d), 1e-4);
      // (parting scaled to the depth, so it reads the same near and far)
      vel += (uCamRight * dn.x + uCamUp * dn.y) * mask * uHoverForce * 2.2 * uDt * clamp(worldH * 0.08, 0.15, 4.0);
      fluid *= uHoverForce;
    }

    // the spring home (loosened while scattered or stirred)
    float hold = smoothstep(0.0, 0.5, scatter);
    float loosen = max(max(0.3, 1.0 - fluid * 0.8) * (1.0 - hold * 0.6), 0.2);
    vel -= off * uSpring * loosen * uDt;

    // the flow: only while stirred (at rest, the film's own drift is enough)
    float churn = fluid * 2.6 + scatter * 1.2;
    if (churn > 0.001) vel += pnFlow(pos * uFlowScale + vec3(0.0, 0.0, uTime * 0.25)) * uFlow * churn * 3.0 * uDt;

    vel *= pow(uDamping, dt60);
    float sp = length(vel);
    vel *= min(1.0, 24.0 / max(sp, 1e-4));

    // scatter: rises at once when stirred, fades over uScatterTime
    float want = clamp(fluid * 2.5, 0.0, 1.0);
    scatter = want > scatter ? scatter + (want - scatter) * min(1.0, uDt * 15.0) : scatter - uDt / max(uScatterTime, 0.01);
    gl_FragColor = vec4(vel, clamp(scatter, 0.0, 1.0));
  }
`;

const OFFSET = /* glsl */ `
  uniform float uDt;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 O = texture2D(tOff, uv);
    vec4 V = texture2D(tVel, uv);
    vec3 off = O.xyz + V.xyz * uDt;
    // never wander off for good
    float l = length(off);
    off *= min(1.0, 9.0 / max(l, 1e-4));
    // glow: up quickly with speed and scatter, down slowly
    float want = clamp(clamp((length(V.xyz) - 0.6) * 0.18, 0.0, 1.0) * 0.6 + V.w * 0.8, 0.0, 1.0);
    float glow = O.w + (want - O.w) * min(1.0, uDt * (want > O.w ? 12.0 : 2.2));
    gl_FragColor = vec4(off, clamp(glow, 0.0, 1.0));
  }
`;

const dataTexture = (size, data) => {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  t.needsUpdate = true;
  return t;
};

// geometry: the particle field's BufferGeometry (aHome, aSeed, aTarget,
// aGroup); material: its drawing material, whose choreography uniforms the
// simulation shares by reference. Adds aRef to the geometry.
export function createParticleSim(gl, geometry, material, { light = false } = {}) {
  const count = geometry.getAttribute("aHome").count;
  const size = Math.ceil(Math.sqrt(count));
  const n = size * size;
  const home = new Float32Array(n * 4);
  const seed = new Float32Array(n * 4);
  const target = new Float32Array(n * 4);
  const ref = new Float32Array(count * 2);
  const H = geometry.getAttribute("aHome").array;
  const S = geometry.getAttribute("aSeed").array;
  const Tg = geometry.getAttribute("aTarget").array;
  const G = geometry.getAttribute("aGroup").array;
  for (let i = 0; i < count; i++) {
    home.set([H[i * 3], H[i * 3 + 1], H[i * 3 + 2], G[i]], i * 4);
    seed.set([S[i * 4], S[i * 4 + 1], S[i * 4 + 2], S[i * 4 + 3]], i * 4);
    target.set([Tg[i * 3], Tg[i * 3 + 1], Tg[i * 3 + 2], 0], i * 4);
    ref[i * 2] = ((i % size) + 0.5) / size;
    ref[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
  }
  geometry.setAttribute("aRef", new THREE.BufferAttribute(ref, 2));

  const gpu = new GPUComputationRenderer(size, size, gl);
  const zero = gpu.createTexture();
  const offVar = gpu.addVariable("tOff", OFFSET, zero);
  const velVar = gpu.addVariable("tVel", VELOCITY, gpu.createTexture());
  gpu.setVariableDependencies(offVar, [offVar, velVar]);
  gpu.setVariableDependencies(velVar, [offVar, velVar]);

  const textures = { tHome: dataTexture(size, home), tSeed: dataTexture(size, seed), tTarget: dataTexture(size, target) };
  const vu = velVar.material.uniforms;
  Object.assign(vu, {
    tHome: { value: textures.tHome },
    tSeed: { value: textures.tSeed },
    tTarget: { value: textures.tTarget },
    uDt: { value: 0 },
    uViewProj: { value: new THREE.Matrix4() },
    uCamRight: { value: new THREE.Vector3(1, 0, 0) },
    uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    uTanHalf: { value: 0.4 },
    uAspect: { value: 1 },
    uMouseUV: { value: new THREE.Vector2(-10, -10) },
    uMouseVel: { value: new THREE.Vector2() },
    uHover: { value: 0 },
    uHoverRadius: { value: STIR.hoverRadius },
    uHoverForce: { value: STIR.hoverForce },
    uDrag: { value: STIR.drag },
    uSpring: { value: STIR.spring },
    uDamping: { value: STIR.damping },
    uFlow: { value: STIR.flow },
    uFlowScale: { value: STIR.flowScale },
    uScatterTime: { value: STIR.scatterTime },
  });
  // the choreography's uniforms: the very same objects the drawing uses
  for (const k of PARTICLE_PATH_UNIFORMS) vu[k] = material.uniforms[k];
  if (light) velVar.material.defines.LIGHT = 1;
  offVar.material.uniforms.uDt = vu.uDt;

  const error = gpu.init();
  if (error) {
    console.warn("[origin-forge] particle simulation unavailable:", error);
    gpu.dispose();
    Object.values(textures).forEach((t) => t.dispose());
    zero.dispose?.();
    return null;
  }

  return {
    uniforms: vu,
    step(dt) {
      vu.uDt.value = dt;
      gpu.compute();
      material.uniforms.tOff.value = gpu.getCurrentRenderTarget(offVar).texture;
      material.uniforms.tVel.value = gpu.getCurrentRenderTarget(velVar).texture;
      material.uniforms.uSim.value = 1;
    },
    dispose() {
      gpu.dispose();
      Object.values(textures).forEach((t) => t.dispose());
      material.uniforms.uSim.value = 0;
    },
  };
}
