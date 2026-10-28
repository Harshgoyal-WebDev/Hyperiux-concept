"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { mulberry32 } from "../../world/layout";
import { sampleLogo3D } from "../../world/logoParticles";
import { GARDEN, GARDEN_ORIGIN } from "../../config";
import { pointer } from "../../pointer";
import { T } from "../../tuning";
import { GARDEN_SUN } from "./sky";

// The Hyperiux mark as a 3D object filled with glossy bubbles of warm
// colours and sizes, over the pond (world/logoParticles.js: the four shapes
// as solid slabs, the cube outline as a real cube).
//
// Every bubble is simulated on the GPU (position + velocity textures): it is
// pulled by a spring towards where it belongs, churned by a flow field and
// pushed by the pointer, with damping — so it moves like something in a
// fluid, overshoots and wobbles back (elastic), and never jumps:
//   swirl – as the garden opens, a stream circling low over the water,
//           gathering into a rising vortex above it (J.pAppear, pGather)
//   mark  – each bubble leaves the vortex on its own delay and flows into
//           its place in the mark (pForm), which settles and turns to face
//           the final view (pSettle)
//   hover – the pointer's line of sight parts the bubbles and drags them
//           along with its movement; they spring back with a wobble.
// A few tiny sparks stay loose, drifting round the mark. The pond reflects
// it all (sizes are worked out per render target, so the reflection's
// bubbles match).

const SIM_SHARED = /* glsl */ `
vec3 flowField(vec3 p, float t) {
  return vec3(
    sin(p.y * 1.1 + t * 0.9) + sin(p.z * 1.7 - t * 0.6),
    sin(p.z * 1.0 + t * 0.7) + sin(p.x * 1.4 + t * 0.5),
    sin(p.x * 1.2 - t * 0.8) + sin(p.y * 1.5 + t * 0.4)
  ) * 0.5;
}
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
`;

const VELOCITY = /* glsl */ `
uniform sampler2D tLogo; // mark position, kind
uniform sampler2D tSwirl; // radius, angle, height seed, pace
uniform sampler2D tSeed; // delay, size, colour, spark
uniform float uDt;
uniform float uTime;
uniform float uClock;
uniform float uGather;
uniform float uForm;
uniform float uSettle;
uniform float uYaw;
uniform float uTilt;
uniform float uSpring;
uniform float uDamping;
uniform float uFlow;
uniform vec3 uRayO;
uniform vec3 uRayD;
uniform vec3 uMouseVel;
uniform float uHover;
uniform float uHoverRadius;
uniform float uHoverForce;
uniform float uDrag;
uniform float uWaterY;
uniform float uPondZ;
${SIM_SHARED}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 p = texture2D(tPos, uv).xyz;
  vec3 v = texture2D(tVel, uv).xyz;
  vec4 L = texture2D(tLogo, uv);
  vec4 S = texture2D(tSwirl, uv);
  vec4 seed = texture2D(tSeed, uv);
  float spark = seed.w;

  // the swirl: a ribbon streaming round over the water, rising and
  // gathering into a vortex above it
  float r = mix(S.x, 1.3 + S.x * 0.32, uGather);
  float ang = S.y + uClock * S.w * (2.2 / max(r, 1.0));
  float y = mix(uWaterY + 1.2 + S.z * 1.4 + sin(ang * 2.0 + S.x * 0.7) * 1.1, -4.6 + S.z * 9.2, uGather);
  vec3 swirl = vec3(cos(ang) * r, y, uPondZ * (1.0 - uGather) + sin(ang) * r * 0.85);
  // the mark, turned
  vec3 mark = rotY(rotX(L.xyz, uTilt), uYaw);
  float f = smoothstep(seed.x * 0.5, seed.x * 0.5 + 0.5, uForm) * (1.0 - spark);
  vec3 target = mix(swirl, mark, f);
  // sparks drift loosely round the mark once it forms
  vec3 drift = flowField(vec3(seed.x * 9.0, seed.y * 7.0, uTime * 0.05), uTime * 0.3) * 2.5;
  target = mix(target, mark + drift, spark * smoothstep(seed.x * 0.5, seed.x * 0.5 + 0.5, uForm));

  // the spring (softer while it travels, firm once it has arrived)
  vec3 acc = (target - p) * uSpring * mix(0.45, 1.0, f) * (1.0 - spark * 0.75);
  // the flow: strong in the swirl, a whisper once the mark has settled
  acc += flowField(p * 0.55 + seed.x * 4.0, uTime * 0.8) * uFlow * mix(3.0, 0.35 + 1.2 * (1.0 - uSettle), f) * (1.0 + spark * 2.0);
  // the pointer: parts them round its line of sight, drags them along
  vec3 rel = p - uRayO;
  vec3 away = rel - uRayD * dot(rel, uRayD);
  float d = length(away);
  float h = uHover * exp(-d * d / (uHoverRadius * uHoverRadius));
  acc += (away / max(d, 1e-3)) * h * uHoverForce * 45.0;
  acc += uMouseVel * h * uDrag * 4.0;

  v += acc * uDt;
  v *= pow(uDamping, uDt * 60.0);
  gl_FragColor = vec4(v, 1.0);

}
`;

const POSITION = /* glsl */ `
uniform float uDt;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 p = texture2D(tPos, uv);
  vec3 v = texture2D(tVel, uv).xyz;
  gl_FragColor = vec4(p.xyz + v * uDt, 1.0);
}
`;

const VERTEX = /* glsl */ `
attribute vec2 aRef; // its texel in the simulation
attribute vec4 aInfo; // radius (m), colour index, spark, delay
uniform sampler2D tPos;
uniform float uScale; // pixels per metre at 1 m, for the target being drawn
uniform float uSize;
uniform float uAppear;
uniform vec3 uSunDir;
uniform vec3 uPalette[5];
uniform float uForm;
uniform float uGather;
varying vec3 vColor;
varying float vSpark;
varying vec3 vSun;
void main() {
  vec3 p = texture2D(tPos, aRef).xyz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // a third of them stream in the ribbon; the rest join as it gathers
  float shown = smoothstep(aInfo.w * 0.6, aInfo.w * 0.6 + 0.4, uAppear) * max(step(fract(aInfo.w * 13.7), 0.33), smoothstep(0.0, 0.6, uGather));
  // finer while streaming in the swirl, full size in the mark
  float r = aInfo.x * uSize * shown * mix(0.5, 1.0, smoothstep(aInfo.w * 0.5, aInfo.w * 0.5 + 0.5, uForm));
  gl_PointSize = clamp(2.0 * r * uScale / max(-mv.z, 0.1), 0.0, 128.0);
  vColor = uPalette[int(aInfo.y + 0.5)];
  vSpark = aInfo.z;
  vSun = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uGlow;
uniform float uSpec;
uniform float uRim;
varying vec3 vColor;
varying float vSpark;
varying vec3 vSun;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.y = -c.y;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  // a sphere, lit: a soft key from the sun, a glossy highlight, a warm rim
  // and a glow from inside
  vec3 n = vec3(c, sqrt(1.0 - r2));
  float key = max(dot(n, vSun), 0.0) * 0.6 + 0.4;
  vec3 hv = normalize(vSun + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, hv), 0.0), 70.0) * uSpec + pow(max(dot(n, normalize(vec3(-0.4, 0.5, 1.0))), 0.0), 24.0) * uSpec * 0.25;
  float rim = pow(1.0 - n.z, 2.4) * uRim;
  vec3 col = vColor * key * uGlow + vColor * (0.25 + 0.45 * n.z) * uGlow * 0.6 + rim * mix(vColor, vec3(1.0, 0.8, 0.5), 0.4) * 1.4 + spec * vec3(1.0, 0.96, 0.9);
  col = mix(col, vColor * 3.2, vSpark);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function dataTexture(size, data) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// The bubbles' data (CPU) and how they are drawn; the simulation itself is
// made by createSim, in an effect, so it lives exactly as long as the mount.
function build(tier) {
  const size = Math.ceil(Math.sqrt(tier.logoPoints));
  const count = size * size;
  const rng = mulberry32(2024);
  const logo = sampleLogo3D(count, { height: 8.5, thickness: 0.9 });
  const waterY = GARDEN.water - GARDEN.logo.y;
  const pondZ = GARDEN.pond.z - GARDEN.logo.z;

  const logoData = new Float32Array(count * 4);
  const swirlData = new Float32Array(count * 4);
  const seedData = new Float32Array(count * 4);
  const ref = new Float32Array(count * 2);
  const info = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const kind = logo.kinds[i];
    logoData.set([logo.positions[i * 3], logo.positions[i * 3 + 1], logo.positions[i * 3 + 2], kind], i * 4);
    // a ribbon round the pond, 5.5–8.5 m out
    swirlData.set([5.5 + rng() * 3, rng() * Math.PI * 2, rng(), 0.7 + rng() * 0.6], i * 4);
    const spark = rng() < 0.02 ? 1 : 0;
    const delay = rng();
    // bubbles: mostly small, a few big ones; sparks tiny
    const radius = spark ? 0.018 + rng() * 0.012 : 0.035 + Math.pow(rng(), 2.6) * 0.13;
    // the palette (0–3), the cube in the brand colour (4)
    const colour = kind > 0.5 && rng() < 0.85 ? 4 : Math.floor(Math.pow(rng(), 1.3) * 4);
    seedData.set([delay, radius, colour, spark], i * 4);
    ref.set([((i % size) + 0.5) / size, (Math.floor(i / size) + 0.5) / size], i * 2);
    info.set([radius, colour, spark, delay], i * 4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aRef", new THREE.BufferAttribute(ref, 2));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tPos: { value: null },
      uScale: { value: 1000 },
      uSize: { value: 1 },
      uAppear: { value: 0 },
      uForm: { value: 0 },
      uGather: { value: 0 },
      uSunDir: { value: GARDEN_SUN.clone() },
      uPalette: { value: Array.from({ length: 5 }, () => new THREE.Color()) },
      uGlow: { value: 1 },
      uSpec: { value: 1 },
      uRim: { value: 0.6 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  // sizes for whichever target is being drawn (the screen or the pond's
  // reflection, which is smaller)
  const buf = new THREE.Vector2();
  points.onBeforeRender = (renderer, _scene, cam) => {
    const rt = renderer.getRenderTarget();
    const h = rt ? rt.height : renderer.getDrawingBufferSize(buf).y;
    material.uniforms.uScale.value = (h * cam.projectionMatrix.elements[5]) / 2;
    material.uniformsNeedUpdate = true;
  };
  return { size, count, logoData, swirlData, seedData, waterY, pondZ, geometry, material, points };
}

function createSim(gl, data, time) {
  const { size, count, logoData, swirlData, seedData, waterY, pondZ, tier } = data;
  const gpu = new GPUComputationRenderer(size, size, gl);
  if (tier.name === "low") gpu.setDataType(THREE.HalfFloatType);
  const pos0 = gpu.createTexture();
  const vel0 = gpu.createTexture();
  // start where the swirl begins
  for (let i = 0; i < count; i++) {
    const r = swirlData[i * 4];
    const a = swirlData[i * 4 + 1];
    const hs = swirlData[i * 4 + 2];
    pos0.image.data.set([Math.cos(a) * r, waterY + 1.2 + hs * 1.4, pondZ + Math.sin(a) * r * 0.85, 1], i * 4);
  }
  const velVar = gpu.addVariable("tVel", VELOCITY, vel0);
  const posVar = gpu.addVariable("tPos", POSITION, pos0);
  gpu.setVariableDependencies(velVar, [posVar, velVar]);
  gpu.setVariableDependencies(posVar, [posVar, velVar]);
  const simU = {
    tLogo: { value: dataTexture(size, logoData) },
    tSwirl: { value: dataTexture(size, swirlData) },
    tSeed: { value: dataTexture(size, seedData) },
    uDt: { value: 0.016 },
    uTime: time,
    uClock: { value: 0 },
    uGather: { value: 0 },
    uForm: { value: 0 },
    uSettle: { value: 0 },
    uYaw: { value: 0 },
    uTilt: { value: 0 },
    uSpring: { value: 18 },
    uDamping: { value: 0.92 },
    uFlow: { value: 1 },
    uRayO: { value: new THREE.Vector3(0, -1000, 0) },
    uRayD: { value: new THREE.Vector3(0, 0, -1) },
    uMouseVel: { value: new THREE.Vector3() },
    uHover: { value: 0 },
    uHoverRadius: { value: 1.4 },
    uHoverForce: { value: 1 },
    uDrag: { value: 1 },
    uWaterY: { value: waterY },
    uPondZ: { value: pondZ },
  };
  Object.assign(velVar.material.uniforms, simU);
  posVar.material.uniforms.uDt = simU.uDt;
  const error = gpu.init();
  if (error) {
    console.error(`[forging-concept] particle logo: ${error}`);
    gpu.dispose();
    return null;
  }
  return { gpu, velVar, posVar, simU };
}


export default function ParticleLogo({ J, tier, time }) {
  const { gl, camera } = useThree();
  const built = useMemo(() => build(tier), [tier]);
  const sim = useRef(null);

  useEffect(() => {
    sim.current = createSim(gl, { ...built, tier }, time);
    return () => {
      const s = sim.current;
      sim.current = null;
      if (!s) return;
      s.gpu.dispose();
      for (const k of ["tLogo", "tSwirl", "tSeed"]) s.simU[k].value.dispose();
    };
  }, [gl, built, tier, time]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  const s = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      offset: new THREE.Vector3().copy(GARDEN_ORIGIN).add(GARDEN.logo),
      plane: new THREE.Plane(),
      fwd: new THREE.Vector3(),
      hit: new THREE.Vector3(),
      last: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      tmp: new THREE.Vector3(),
      hasLast: false,
      hover: 0,
      yaw: 0,
      tilt: 0,
    }),
    []
  );

  useFrame((_, delta) => {
    const sm = sim.current;
    if (!sm || !J.inGarden) return;
    const dt = Math.min(delta, 1 / 30);
    const u = sm.simU;
    u.uDt.value = dt;
    u.uClock.value += dt * T.logoSwirlSpeed;
    u.uGather.value = J.pGather;
    u.uForm.value = J.pForm;
    u.uSettle.value = J.pSettle;
    u.uSpring.value = T.logoSpring;
    u.uDamping.value = T.logoDamping;
    u.uFlow.value = T.logoFlow;
    u.uHoverRadius.value = T.logoHoverRadius;
    u.uHoverForce.value = T.logoHoverForce;
    u.uDrag.value = T.logoDrag;

    // the pointer's line of sight (in the mark's own frame) and how fast
    // it sweeps across the mark (on the plane through it facing the camera)
    s.ndc.set(pointer.x, pointer.y);
    s.ray.setFromCamera(s.ndc, camera);
    u.uRayO.value.copy(s.ray.ray.origin).sub(s.offset);
    u.uRayD.value.copy(s.ray.ray.direction);
    camera.getWorldDirection(s.fwd);
    s.plane.setFromNormalAndCoplanarPoint(s.fwd, s.offset);
    if (s.ray.ray.intersectPlane(s.plane, s.hit)) {
      if (s.hasLast) s.tmp.subVectors(s.hit, s.last).divideScalar(Math.max(dt, 1e-3));
      else s.tmp.set(0, 0, 0);
      s.last.copy(s.hit);
      s.hasLast = true;
      s.vel.lerp(s.tmp.clampLength(0, 40), 1 - Math.exp(-dt * 12));
    }
    u.uMouseVel.value.copy(s.vel);
    const want = pointer.active ? 1 : 0;
    s.hover += (want - s.hover) * (1 - Math.exp(-dt / 0.2));
    u.uHover.value = s.hover * J.pAppear;

    // the mark turns to face the final view as it settles, then leans a
    // little towards the pointer and sways on its own
    const settle = J.pSettle;
    const base = T.logoYaw * (Math.PI / 180);
    const yawTarget = base - (1 - settle) * 0.9 + settle * (Math.sin(time.value * 0.21) * 0.08 + (pointer.active ? pointer.x : 0) * 0.2);
    const tiltTarget = settle * (pointer.active ? -pointer.y : 0) * 0.1;
    const k = 1 - Math.exp(-dt * 3);
    s.yaw += (yawTarget - s.yaw) * k;
    s.tilt += (tiltTarget - s.tilt) * k;
    u.uYaw.value = s.yaw;
    u.uTilt.value = s.tilt;

    sm.gpu.compute();

    const m = built.material.uniforms;
    m.tPos.value = sm.gpu.getCurrentRenderTarget(sm.posVar).texture;
    m.uSize.value = T.logoParticleSize;
    m.uAppear.value = J.pAppear;
    m.uForm.value = J.pForm;
    m.uGather.value = J.pGather;
    m.uGlow.value = T.logoParticleGlow;
    m.uSpec.value = T.logoSpecular;
    m.uRim.value = T.logoRim;
    const pal = m.uPalette.value;
    pal[0].set(T.logoColorA);
    pal[1].set(T.logoColorB);
    pal[2].set(T.logoColorC);
    pal[3].set(T.logoColorD);
    pal[4].set(T.crackColor);
  });

  return (
    <group position={GARDEN.logo}>
      <primitive object={built.points} />
    </group>
  );
}
