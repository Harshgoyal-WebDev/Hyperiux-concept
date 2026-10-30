"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GARDEN, GARDEN_ORIGIN } from "../../config";
import { GRASS_LAYER } from "../../world/gardenAsset";
import { GARDEN_SUN } from "./sky";
import { T } from "../../tuning";
import { Q } from "../../quality";

// A deep lawn of fine grass over the whole garden: very many thin blades,
// placed on a grid that follows the camera (each blade fixed to its own cell
// of the ground, so they never swim as it moves) in nested rings — fine
// close by, coarser and broader further off — and dropped where they're off
// screen or in the water. Each is lit by the lie of the ground (the slopes
// towards the light bright, the hollows in shadow), darkest at its root and
// brightest at its tip, shorter in patches; waves of wind run across the
// lawn, catching the light as they go; and where the pointer passes, the
// blades are pushed along its path, each turned a little its own way (the
// garden's pointer wind field). Unlit: its light is worked out per blade.
// The blades are on GRASS_LAYER, which the pond's reflection skips.

// the pointer's wind field reaches this far round the pond (m)
export const LAWN_RADIUS = 50;

// rings round the camera: the first's half-width (m), each next twice as wide
const RING0 = 6;
const RINGS = 5;
// blades along each ring's side (at full density): densest in the middle
// rings, where the lawn fills most of the frame (the hills round the pond);
// the outermost is mostly in the haze
const SIDES = [220, 240, 340, 340, 200];
// rows up a blade, per ring: further off, a blade a few pixels tall needs
// fewer bends
const ROWS = [4, 4, 3, 3, 2];
// the height grid's step (m)
const STEP = 0.5;

const VERTEX = /* glsl */ `
uniform sampler2D tHeight;
uniform vec2 uHMin;
uniform vec2 uHSize;
uniform float uSpacing;
uniform vec2 uCellMin; // the first cell drawn (only the patch of the ring in view is)
uniform float uCols; // ...and how many across
uniform vec4 uInner; // the ring inside this one (min x, min z, max x, max z); none if min > max
uniform vec4 uOuter; // this ring's own extent
uniform float uLast; // 1: the outermost ring (its edge fades away)
uniform vec3 uCam; // (garden space)
uniform vec3 uOrigin; // garden → world
uniform float uTime;
uniform float uWind;
uniform float uHeight;
uniform float uWidth;
uniform float uWater;
uniform float uWake;
uniform vec3 uLight;
uniform vec3 uShadow;
uniform vec3 uGrass;
uniform vec3 uHighlight;
uniform float uBright;
uniform float uNight;
uniform sampler2D uWindField;
uniform vec4 uFieldRect;
uniform float uFieldOn;
varying vec3 vColor;
#include <fog_pars_vertex>

float lHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lHash(i), lHash(i + vec2(1.0, 0.0)), u.x), mix(lHash(i + vec2(0.0, 1.0)), lHash(i + vec2(1.0, 1.0)), u.x), u.y) * 2.0 - 1.0;
}
float groundAt(vec2 xz) {
  vec2 uv = (xz - uHMin) / uHSize;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return -100.0;
  return texture2D(tHeight, uv).r;
}
vec4 wakeAt(vec2 world) {
  vec2 uv = (world - uFieldRect.xy) / uFieldRect.zw;
  if (uFieldOn < 0.5 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return texture2D(uWindField, uv);
}
bool inside(vec2 p, vec4 r) { return p.x >= r.x && p.y >= r.y && p.x < r.z && p.y < r.w; }

void main() {
  float id = float(gl_InstanceID);
  float row = floor((id + 0.5) / uCols);
  float col = id - row * uCols;
  vec2 cell = uCellMin + vec2(col, row);
  float seedA = lHash(cell + 0.31);
  float seedB = lHash(cell + 17.7);
  float seedC = lHash(cell + 41.3);
  float seedD = lHash(cell + 73.9);
  vec2 base = (cell + vec2(seedA, seedB)) * uSpacing;
  float ground = groundAt(base);
  // (another ring has it; the water; off the ground)
  bool skip = (uInner.x < uInner.z && inside(base, uInner)) || ground < uWater + 0.06;
  vec3 root = vec3(base.x, ground, base.y);
  float depth = length(uCam - root);

  // patches of shorter grass, each blade its own height
  float clump = lNoise(base * 0.9) * 0.7 + lNoise(base * 2.6) * 0.3;
  float keep = smoothstep(-0.45, -0.15, clump + seedA * 0.3);
  // (a little taller far off: a few pixels of blade still reads as grass)
  float height = uHeight * (0.55 + 0.9 * seedB) * mix(0.3, 1.0, keep) * (1.0 + 0.6 * smoothstep(12.0, 50.0, depth));
  // (the outermost ring fades away at its edge)
  vec2 off = abs(base - (uOuter.xy + uOuter.zw) * 0.5);
  float edge = 1.0 - uLast * smoothstep(0.8, 1.0, max(off.x, off.y) / max((uOuter.z - uOuter.x) * 0.5, 1e-3));
  height *= edge;
  skip = skip || height < 0.01;

  // off screen: dropped (the whole blade, decided at its root)
  vec4 clipRoot = projectionMatrix * viewMatrix * modelMatrix * vec4(root + vec3(0.0, height * 0.5, 0.0), 1.0);
  skip = skip || clipRoot.w < 0.05 || abs(clipRoot.x) > clipRoot.w * 1.2 + height || abs(clipRoot.y) > clipRoot.w * 1.3 + height;
  if (skip) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec3(0.0);
    return;
  }

  // the wind: waves running across the lawn, a flutter in each blade
  float wave = base.x * 0.55 + base.y * 0.2 - uTime * 1.8;
  float gust = sin(wave + sin(base.y * 0.45 + uTime * 0.35) * 1.6) * 0.5 + 0.5;
  float flutter = sin(uTime * 4.0 + seedC * 6.3) * 0.15;
  vec2 sway = vec2(gust * gust * 1.1 + flutter + 0.15, flutter * 0.6) * uWind;
  // the pointer's wake: along its path, each blade turned a little its own
  // way, rocking, the stronger the more of them join in
  vec2 wake = wakeAt(base + uOrigin.xz).rg / 0.6;
  float join = smoothstep(seedB * 0.3, seedB * 0.3 + 0.25, length(wake));
  float turn = (seedC - 0.5) * 0.9;
  vec2 turned = vec2(wake.x * cos(turn) - wake.y * sin(turn), wake.x * sin(turn) + wake.y * cos(turn));
  float rock = sin(uTime * (seedD * 1.4 + 2.2) + seedA * 6.3 - depth * 0.6) * 0.5 + 0.6;
  vec2 push = turned * join * (seedC * 0.8 + 0.5) * rock * 1.3 * uWake;
  float pl = length(push);
  vec2 lean = sway + push * min(pl, 1.1) / (pl + 1e-4);
  vec2 curl = vec2(seedD - 0.5, seedA - 0.5) * 0.5;
  vec2 bend = lean + curl;
  float bendLength = min(length(bend), 1.8);

  // the blade: a thin strip, broadest at its root, facing (more or less)
  // the camera, arching over as it bends; broader further off, so the lawn
  // stays a lawn however coarse the ring
  float t = position.y;
  float width = max(uWidth * (seedC * 0.6 + 0.7), max(depth * 0.0022, uSpacing * 0.3)) * (1.0 - t * 0.9);
  vec2 toCam = normalize(uCam.xz - base + 1e-4);
  float a = (seedD - 0.5) * 1.4;
  vec2 across = vec2(toCam.y, -toCam.x);
  across = vec2(across.x * cos(a) - across.y * sin(a), across.x * sin(a) + across.y * cos(a));
  vec3 pos = root + vec3(across.x, 0.0, across.y) * position.x * width + vec3(bend.x, 0.0, bend.y) * height * t * t;
  pos.y += height * t * (1.0 - bendLength * 0.28 * t);

  // lit by the lie of the ground: towards the light bright, a glint on the
  // brightest slopes; dark at the root; the gusts' sheen; a little dimmer far off
  float e = 0.5;
  vec3 n = normalize(vec3(-(groundAt(base + vec2(e, 0.0)) - ground) / e, 1.0, -(groundAt(base + vec2(0.0, e)) - ground) / e));
  float light = clamp(dot(n, uLight), 0.0, 1.0);
  float lit = smoothstep(0.35, 0.78, light);
  float glow = smoothstep(0.74, 0.97, light);
  float nearness = smoothstep(80.0, 6.0, depth);
  float sheen = gust * uWind * t * 0.45;
  vec3 tint = mix(mix(mix(uShadow, uGrass, lit), uHighlight, glow), uHighlight, clamp(sheen, 0.0, 0.8));
  // far off, a blade is a pixel or two: its dark root and bright tip average
  // out, so it takes the turf's mean shade (not a dark field with lines),
  // and the hollows aren't left in deep shadow
  float far = smoothstep(10.0, 45.0, depth);
  tint = mix(tint, mix(tint, uGrass, 0.4), far);
  float shade = mix(pow(t, 1.4) * 0.9 + 0.04, 0.45 + 0.35 * t, far) * (seedC * 0.5 + 0.75) * mix(0.85, 1.0, nearness);
  vColor = tint * shade * uBright * mix(vec3(1.0), vec3(0.3, 0.4, 0.66), uNight);

  vec4 mvPosition = viewMatrix * modelMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
varying vec3 vColor;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <fog_fragment>
}
`;

// the ground under the blades: turf, not a flat colour — fine streaks of
// darker and lighter grass, in drifting patches (it fills in between the
// blades, so far off the lawn still reads as grass)
const TURF_GLSL = /* glsl */ `
float tfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tfNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tfHash(i), tfHash(i + vec2(1.0, 0.0)), u.x), mix(tfHash(i + vec2(0.0, 1.0)), tfHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float turf(vec2 p) {
  float patches = tfNoise(p * 0.15) * 0.5 + tfNoise(p * 0.6) * 0.3;
  float streaks = tfNoise(p * vec2(9.0, 2.2)) * 0.6 + tfNoise(p * vec2(23.0, 5.0)) * 0.4;
  return 0.55 + patches * 0.5 + (streaks - 0.5) * 0.55;
}
`;

// the garden's ground as a texture of heights (garden metres)
function heightTexture(height) {
  const nx = Math.ceil((height.max.x - height.min.x) / STEP) + 1;
  const nz = Math.ceil((height.max.y - height.min.y) / STEP) + 1;
  const data = new Uint16Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const h = height.sample(height.min.x + i * STEP, height.min.y + j * STEP);
      data[j * nx + i] = THREE.DataUtils.toHalfFloat(Number.isFinite(h) ? h : -100);
    }
  }
  const texture = new THREE.DataTexture(data, nx, nz, THREE.RedFormat, THREE.HalfFloatType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, size: new THREE.Vector2((nx - 1) * STEP, (nz - 1) * STEP) };
}

export default function GardenLawn({ garden, sway, light }) {
  const { camera } = useThree();
  const built = useMemo(() => {
    const { texture, size } = heightTexture(garden.height);
    const shared = {
      ...THREE.UniformsLib.fog,
      tHeight: { value: texture },
      uHMin: { value: garden.height.min.clone() },
      uHSize: { value: size },
      uCam: { value: new THREE.Vector3() },
      uOrigin: { value: GARDEN_ORIGIN.clone() },
      uTime: { value: 0 },
      uWind: { value: 0.6 },
      uHeight: { value: 0.45 },
      uWidth: { value: 0.03 },
      uWater: { value: GARDEN.water },
      uWake: { value: 1 },
      uLight: { value: GARDEN_SUN.clone().add(new THREE.Vector3(0, 0.6, 0)).normalize() },
      uShadow: { value: new THREE.Color() },
      uGrass: { value: new THREE.Color() },
      uHighlight: { value: new THREE.Color() },
      uBright: { value: 1 },
      uNight: light.uGardenNight,
      uWindField: sway.uWindField,
      uFieldRect: sway.uFieldRect,
      uFieldOn: sway.uFieldOn,
    };
    const geometries = [];
    const rings = Array.from({ length: RINGS }, (_, k) => {
      // one blade: a strip two wide, ROWS[k] rows up (y 0..1)
      const rows = ROWS[k];
      const pos = [];
      for (let r = 0; r <= rows; r++) for (const x of [-0.5, 0.5]) pos.push(x, r / rows, 0);
      const index = [];
      for (let r = 0; r < rows; r++) {
        const a = r * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geometry.setIndex(index);
      geometries.push(geometry);
      const uniforms = {
        ...shared,
        uCellMin: { value: new THREE.Vector2() },
        uSpacing: { value: 0.06 },
        uCols: { value: 1 },
        uInner: { value: new THREE.Vector4(1, 1, 0, 0) },
        uOuter: { value: new THREE.Vector4() },
        uLast: { value: k === RINGS - 1 ? 1 : 0 },
      };
      const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, side: THREE.DoubleSide, fog: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.layers.set(GRASS_LAYER);
      return { mesh, uniforms, half: RING0 * 2 ** k };
    });
    const group = new THREE.Group();
    rings.forEach((r) => group.add(r.mesh));

    // the ground between the blades: the turf's own colour (lit like the
    // rest of the ground), all but the shore's mud just above the water
    // (kept on the material: built twice, both builds must drive the same one)
    const ground = garden.terrain.material;
    ground.userData.carpet ??= { uCarpet: { value: new THREE.Color(T.grassGround) }, uCarpetWater: { value: GARDEN.water } };
    const carpet = ground.userData.carpet;
    ground.color.set("#ffffff");
    ground.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, carpet);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vLawnY;\nvarying vec2 vLawnXZ;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLawnY = position.y;\nvLawnXZ = position.xz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uCarpet;\nuniform float uCarpetWater;\nvarying float vLawnY;\nvarying vec2 vLawnXZ;\n" + TURF_GLSL)
        .replace(
          "#include <map_fragment>",
          "#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uCarpet * turf(vLawnXZ), smoothstep(uCarpetWater + 0.1, uCarpetWater + 0.6, vLawnY) * 0.9);"
        );
    };
    ground.customProgramCacheKey = () => "garden-ground-carpet";
    ground.needsUpdate = true;
    return { group, rings, shared, texture, geometries, carpet };
  }, [garden, sway, light]);

  useEffect(
    () => () => {
      built.texture.dispose();
      built.geometries.forEach((g) => g.dispose());
      built.rings.forEach((r) => r.mesh.material.dispose());
    },
    [built]
  );

  const s = useMemo(
    () => ({
      fwd: new THREE.Vector3(),
      cam: new THREE.Vector3(),
      // the view's four corner directions (garden space, unit length)
      corners: [0, 1, 2, 3].map(() => new THREE.Vector3()),
      v: new THREE.Vector3(),
    }),
    []
  );
  useFrame((_, delta) => {
    const u = built.shared;
    u.uTime.value += Math.min(delta, 0.1) * T.grassWindSpeed;
    u.uWind.value = T.grassWind;
    u.uHeight.value = T.grassHeight;
    u.uWidth.value = T.grassWidth;
    u.uWake.value = T.grassWake;
    u.uBright.value = T.grassBrightness;
    u.uShadow.value.set(T.grassShadow);
    u.uGrass.value.set(T.grassColor);
    u.uHighlight.value.set(T.grassHighlight);
    built.carpet.uCarpet.value.set(T.grassGround).multiplyScalar(1 - light.uGardenNight.value * 0.6);
    s.cam.copy(camera.position).sub(GARDEN_ORIGIN);
    u.uCam.value.copy(s.cam);
    camera.getWorldDirection(s.fwd);
    s.fwd.y = 0;
    if (s.fwd.lengthSq() > 1e-6) s.fwd.normalize();
    // blades along a side: fewer on a slower device (the rings keep their size)
    const share = Math.sqrt(Math.max(T.grassDensity * Q.density, 0.05));
    // the corners of the view, as directions from the camera
    s.corners.forEach((c, i) => {
      c.set(i % 2 ? 1 : -1, i < 2 ? -1 : 1, 1).unproject(camera).sub(camera.position).normalize();
    });
    let inner = null;
    built.rings.forEach((r, k) => {
      const ru = r.uniforms;
      const side = Math.max(Math.round(SIDES[k] * share), 40);
      const spacing = (2 * r.half) / side;
      // (centred ahead of the camera: most of each ring is in view)
      const cx = s.cam.x + s.fwd.x * r.half * 0.75;
      const cz = s.cam.z + s.fwd.z * r.half * 0.75;
      ru.uSpacing.value = spacing;
      const c0x = Math.floor(cx / spacing) - Math.floor(side / 2);
      const c0z = Math.floor(cz / spacing) - Math.floor(side / 2);
      ru.uOuter.value.set(c0x * spacing, c0z * spacing, (c0x + side) * spacing, (c0z + side) * spacing);
      if (inner) ru.uInner.value.copy(inner);
      else ru.uInner.value.set(1, 1, 0, 0);
      inner = ru.uOuter.value;
      // only the part of the ring in view: the ground under the view's
      // wedge out to the ring's far corner (with a margin for the blades'
      // height and bend)
      const reach = r.half * 2.9;
      let x0 = s.cam.x;
      let x1 = s.cam.x;
      let z0 = s.cam.z;
      let z1 = s.cam.z;
      for (const c of s.corners) {
        const x = s.cam.x + c.x * reach;
        const z = s.cam.z + c.z * reach;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
      const m = 1.5 + spacing * 2;
      const gx0 = Math.max(Math.floor((x0 - m) / spacing), c0x);
      const gx1 = Math.min(Math.floor((x1 + m) / spacing), c0x + side - 1);
      const gz0 = Math.max(Math.floor((z0 - m) / spacing), c0z);
      const gz1 = Math.min(Math.floor((z1 + m) / spacing), c0z + side - 1);
      const cols = Math.max(gx1 - gx0 + 1, 0);
      const rows = Math.max(gz1 - gz0 + 1, 0);
      ru.uCellMin.value.set(gx0, gz0);
      ru.uCols.value = Math.max(cols, 1);
      // (the outermost ring, mostly in the haze, only while the device keeps up)
      r.mesh.geometry.instanceCount = k === RINGS - 1 && Q.level > 2 ? 0 : cols * rows;
    });
  });

  return <primitive object={built.group} />;
}
