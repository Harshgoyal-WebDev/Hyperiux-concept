import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";

// The sand hand's grains as a little physical system, on the GPU (after
// pick-n-petal's particles): every grain keeps an offset from its place on the
// hand, a velocity and an excitement. The pointer — a ray through the scene —
// shoves the grains near it along its motion and out off the surface, and
// stirs them with an eddying flow; an excited grain comes loose: its pull home
// weakens, it drifts on the flow and sinks a little, and as the excitement dies
// away it is drawn back, springing home. All in the hand's own space (its
// length about 1). Each frame: step(...) then the textures (offset, velocity).

const SIM = /* glsl */ `
uniform sampler2D tHome; // xyz: its place on the hand, w: seed
uniform sampler2D tNrm; // xyz: the surface's normal there, w: seed
uniform float uTime;
uniform float uDt;
uniform float uForce; // the pointer's hold on the sand (0 … 1, eased)
uniform float uReach2;
uniform float uPush;
uniform float uLoose;
uniform float uSettle;
uniform float uGravity;
uniform float uMax;
uniform float uSpring;
uniform vec3 uRayO;
uniform vec3 uRayD;
uniform vec3 uPVel;
uniform vec3 uDown;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = mix(hash(i), hash(i + vec3(1, 0, 0)), u.x);
  float b = mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), u.x);
  float c = mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), u.x);
  float d = mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), u.x);
  return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}
vec3 flow(vec3 p) {
  return vec3(vnoise(p), vnoise(p + vec3(31.4, 7.1, 13.7)), vnoise(p + vec3(5.9, 47.3, 23.1))) * 2.0 - 1.0;
}

void simulate(vec2 uv, out vec4 offOut, out vec4 velOut) {
  vec4 home = texture2D(tHome, uv);
  vec4 nr = texture2D(tNrm, uv);
  vec4 o = texture2D(tOff, uv);
  vec4 v = texture2D(tVel, uv);
  vec3 n = nr.xyz;
  vec3 off = o.xyz;
  vec3 vel = v.xyz;
  float exc = v.w;
  vec3 x = home.xyz + off;
  float dt = uDt;

  float speed = length(uPVel);
  float s = clamp(speed / 2.0, 0.0, 1.0);
  // the pointer's reach: how near the grain is to its ray
  vec3 rel = x - uRayO;
  vec3 perp = rel - dot(rel, uRayD) * uRayD;
  float w = exp(-dot(perp, perp) / uReach2) * uForce;

  vec3 acc = w * (uPVel * 2.4 + n * speed * 0.9 + flow(x * 2.0 + vec3(uTime * 0.5)) * speed * 1.2) * uPush;
  acc += w * n * 0.3 * uPush;

  // excited, it comes loose — and settles again as that dies away
  exc = min(exc * exp(-dt * uSettle) + w * s * dt * 3.5 * uPush, 1.5);
  float loose = min(exc, 1.0);
  float k = mix(1.3, 2.8, nr.w) * uSpring;
  acc += flow(x * 1.3 + vec3(home.w * 7.0, uTime * 0.15, 0.0)) * loose * 1.1 * uLoose;
  acc += uDown * loose * 0.35 * uGravity;
  acc -= off * k * (1.0 - 0.7 * loose);

  // (damped with the spring: a stiffer pull home springs back without wobbling)
  vel = vel * exp(-dt * 2.4 * sqrt(max(uSpring, 0.1))) + acc * dt;
  off += vel * dt;
  float ol = length(off);
  if (ol > uMax) off *= uMax / ol;
  offOut = vec4(off, 0.0);
  velOut = vec4(vel, exc);
}
`;
const OFF_SHADER = SIM + /* glsl */ `
void main() {
  vec4 o, v;
  simulate(gl_FragCoord.xy / resolution.xy, o, v);
  gl_FragColor = o;
}`;
const VEL_SHADER = SIM + /* glsl */ `
void main() {
  vec4 o, v;
  simulate(gl_FragCoord.xy / resolution.xy, o, v);
  gl_FragColor = v;
}`;

export function createSandSim(gl, sample) {
  const n = sample.count;
  const size = Math.max(Math.ceil(Math.sqrt(n)), 1);
  const gpu = new GPUComputationRenderer(size, size, gl);
  gpu.setDataType(THREE.HalfFloatType);
  const home = gpu.createTexture();
  const nrm = gpu.createTexture();
  const hd = home.image.data;
  const nd = nrm.image.data;
  // (its centre: where the pointer's ray is measured from)
  const centre = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    hd[i * 4] = sample.pos[i * 3];
    hd[i * 4 + 1] = sample.pos[i * 3 + 1];
    hd[i * 4 + 2] = sample.pos[i * 3 + 2];
    hd[i * 4 + 3] = sample.info[i * 4];
    nd[i * 4] = sample.nor[i * 3];
    nd[i * 4 + 1] = sample.nor[i * 3 + 1];
    nd[i * 4 + 2] = sample.nor[i * 3 + 2];
    nd[i * 4 + 3] = sample.info[i * 4 + 2];
    centre.x += sample.pos[i * 3] / n;
    centre.y += sample.pos[i * 3 + 1] / n;
    centre.z += sample.pos[i * 3 + 2] / n;
  }
  const offVar = gpu.addVariable("tOff", OFF_SHADER, gpu.createTexture());
  const velVar = gpu.addVariable("tVel", VEL_SHADER, gpu.createTexture());
  gpu.setVariableDependencies(offVar, [offVar, velVar]);
  gpu.setVariableDependencies(velVar, [offVar, velVar]);
  const U = {
    tHome: { value: home },
    tNrm: { value: nrm },
    uTime: { value: 0 },
    uDt: { value: 0.016 },
    uForce: { value: 0 },
    uReach2: { value: 0.1 },
    uPush: { value: 1 },
    uLoose: { value: 1 },
    uSettle: { value: 0.65 },
    uGravity: { value: 1 },
    uMax: { value: 0.6 },
    uSpring: { value: 1 },
    uRayO: { value: new THREE.Vector3() },
    uRayD: { value: new THREE.Vector3(0, 0, -1) },
    uPVel: { value: new THREE.Vector3() },
    uDown: { value: new THREE.Vector3(0, -1, 0) },
  };
  Object.assign(offVar.material.uniforms, U);
  Object.assign(velVar.material.uniforms, U);
  const error = gpu.init();
  if (error) {
    console.warn("[contact-v2] sand simulation unavailable:", error);
    gpu.dispose();
    return null;
  }
  // each grain's texel, for the points to read
  const ref = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    ref[i * 2] = ((i % size) + 0.5) / size;
    ref[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
  }
  return {
    U,
    ref,
    centre,
    step() {
      gpu.compute();
    },
    offset: () => gpu.getCurrentRenderTarget(offVar).texture,
    velocity: () => gpu.getCurrentRenderTarget(velVar).texture,
    dispose() {
      gpu.dispose();
      home.dispose();
      nrm.dispose();
    },
  };
}
