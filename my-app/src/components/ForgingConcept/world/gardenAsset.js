import * as THREE from "three";
import { GARDEN } from "../config";
import { mulberry32 } from "./layout";
import { buildHeightGrid, createRidges, reshapeTerrain, widenPond } from "./gardenTerrain";

// The garden from hyperiux-garden-environment.glb (its own metres: pond
// centred on the origin at water level, the camera arriving from +z; see
// hyperiux-garden-metadata.json).
//
// The GLB places every tree, bush, grass clump, rock, flower and plant as its
// own node (4,884 of them) but each variant's parts share one mesh. Here every
// (mesh, material) pair becomes one InstancedMesh carrying all its placements,
// so the whole garden draws in a couple of hundred calls (its flower clusters
// are left out: GardenFlowers grows the garden's own). More bushes are
// planted from the GLB's own variants (on the terrain, clear of the water and
// the trunks). The terrain stays a single mesh,
// reshaped (a wider pond, low ridges beyond the clearing; gardenTerrain.js),
// and everything placed on it moves with it.
//
// Grass, leaves and flowers sway in the wind, and the pointer makes wind of
// its own: as it moves over the garden it brushes a wind field (windField.js)
// along its path — the plants there are pushed along its motion and parted
// from its line, harder the faster it goes, and ease back as the wind
// relaxes behind it, leaving a soft wake. A click sends a ring of air out
// across the meadow. Bushes, plants and flowers glow where it has just
// passed — only while it moves.

// (the GLB's FlowerClusters are left out: the garden grows its own flowers, GardenFlowers)
const GROUPS = ["GardenTerrain", "GrassPatches", "PlacedTrees", "PlacedBushes", "PlacedRocks", "PlacedPlants"];
export const RIPPLES = 4; // rings of air from clicks
// Small, dense things (grass, flowers) live on this layer, which the pond's
// reflection leaves out: they would cost a second lawn and barely show.
export const GRASS_LAYER = 1;

// Shared by every swaying material (and the lawn and the flowers). All
// positions are in world space; Garden.jsx keeps them up to date.
export function createSwayUniforms(time) {
  return {
    uTime: time,
    uWindField: { value: null }, // the pointer's wind (windField.js)
    uFieldRect: { value: new THREE.Vector4(0, 0, 1, 1) }, // its extent (world minX, minZ, sizeX, sizeZ)
    uFieldOn: { value: 0 }, // 0 once it has died away (skip it)
    uRipple: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector4()) }, // where (x, z), age (s), strength
    uRippleCount: { value: 0 },
    uPushAmount: { value: 1 },
    uWindAmount: { value: 1 },
    uGlowStrength: { value: 1 },
    uGlowColor: { value: new THREE.Color("#ffb45c") },
  };
}

export const SWAY_DECLS = /* glsl */ `
uniform float uTime;
uniform sampler2D uWindField;
uniform vec4 uFieldRect;
uniform float uFieldOn;
uniform vec4 uRipple[${RIPPLES}];
uniform float uRippleCount;
uniform float uPushAmount;
uniform float uWindAmount;
varying float vSwGlow;
`;

// GLSL: the wind a plant at world xz feels from the pointer (its wind field
// + click ripples), as a horizontal offset (m) for its tip; and how lit it
// is by the pointer's passing (0..1).
export const POINTER_WIND_GLSL = /* glsl */ `
float pwHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
float pwNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pwHash(i), pwHash(i + vec2(1.0, 0.0)), u.x), mix(pwHash(i + vec2(0.0, 1.0)), pwHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec4 pwField(vec2 xz) {
  vec2 uv = (xz - uFieldRect.xy) / uFieldRect.zw;
  if (uFieldOn < 0.5 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return texture2D(uWindField, uv);
}
vec2 pointerWind(vec2 xz, float seed) {
  vec2 acc = pwField(xz).rg;
  for (int i = 0; i < ${RIPPLES}; i++) {
    if (float(i) >= uRippleCount) break;
    vec4 r = uRipple[i];
    vec2 rel = xz - r.xy;
    float d = length(rel);
    float x = (d - r.z * 2.6) / (0.35 + r.z * 0.4);
    if (abs(x) > 3.0) continue;
    acc += rel / max(d, 1e-3) * exp(-x * x) * cos(x * 2.0 + 0.5) * r.w * exp(-r.z * 1.2) * smoothstep(0.0, 0.3, d);
  }
  if (dot(acc, acc) < 1e-8) return vec2(0.0);
  // never quite uniform, with a flutter across the wind
  acc *= 0.8 + 0.4 * pwNoise(xz * 1.9 + uTime * 0.45 + seed * 3.0);
  acc += vec2(-acc.y, acc.x) * sin(uTime * 7.5 + seed * 19.0) * 0.12;
  return acc * uPushAmount;
}
// (only near the height of what the pointer touched: within ~2.5 m of it —
// on the ground the grass, the flowers, the bushes there, not the canopy
// above; on a tree, its blossom there, not the grass beneath)
float pointerGlow(vec3 world) {
  vec4 f = pwField(world.xz);
  float dy = max(abs(world.y - f.a) - 1.0, 0.0) / 1.5;
  return f.b * exp(-dy * dy);
}
`;

// kinds: 0 grass (bends from the root, uv.y = 0 there), 1 tree leaves,
// 2 bush / plant leaves (+ glow)
const GLOWS = (kind) => kind >= 2;
// (the trees' leaves take none of it: only the breeze — it saves the most)
const POINTER_SHARE = [1, 0, 0.4];
const swayGlsl = (kind) => /* glsl */ `
#ifdef USE_INSTANCING
{
  mat4 swM = modelMatrix * instanceMatrix;
  vec3 swPivot = (swM * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 swWorld = (swM * vec4(transformed, 1.0)).xyz;
  ${
    kind === 0
      ? "float swW = pow(clamp(uv.y, 0.0, 1.0), 1.7);"
      : "float swW = clamp(length(swWorld - swPivot) / 1.6, 0.0, 1.0);"
  }
  float swSeed = fract(sin(dot(swPivot.xz, vec2(12.9898, 78.233))) * 43758.5453);
  // the breeze: slow gusts rolling across the garden, a quicker flutter
  float swGust = 0.6 + 0.4 * sin(uTime * 0.9 + swPivot.x * 0.21 + swPivot.z * 0.17);
  float swFlutter = sin(uTime * ${kind === 1 ? "3.1" : "2.3"} + swSeed * 6.2831 + swWorld.y * 0.6);
  vec3 swDisp = vec3(0.8, 0.0, 0.6) * (swGust * ${kind === 1 ? "0.05" : "0.08"} + swFlutter * 0.033) * uWindAmount;
  ${
    POINTER_SHARE[kind] > 0
      ? `// the pointer's own wind (only where the plant can bend)
  if (swW > 0.01) {
    vec2 swPw = pointerWind(swPivot.xz, swSeed) * ${POINTER_SHARE[kind].toFixed(2)};
    swDisp += vec3(swPw.x, ${kind === 0 ? "-length(swPw) * 0.25" : "0.0"}, swPw.y);
  }`
      : ""
  }
  ${GLOWS(kind) ? "vSwGlow = pointerGlow(swWorld);" : ""}
  // world offset → this instance's own space (rotation about y + uniform scale)
  mat3 swR = mat3(swM);
  transformed += (transpose(swR) * swDisp) / dot(swR[0], swR[0]) * swW;
}
#endif
`;

// Patches a material to sway (kind as above); grass blades pass extra
// vertex code to run before it (their own shape).
export function patchSway(material, uniforms, kind, { before = "", fragment = null, key = "" } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${SWAY_DECLS}\n${POINTER_WIND_GLSL}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${before}\nvSwGlow = 0.0;\n${swayGlsl(kind)}`);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying float vSwGlow;
      uniform float uGlowStrength;
      uniform vec3 uGlowColor;`
    );
    if (GLOWS(kind)) {
      // lit from within where the pointer passes
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += (diffuseColor.rgb * 2.4 + uGlowColor * 0.9) * vSwGlow * uGlowStrength;"
      );
    }
    if (fragment) shader.fragmentShader = fragment(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => `garden-sway-${kind}${key}`;
}

const kindOf = (group, materialName) => {
  if (group === "GrassPatches" && materialName === "M_Grass") return 0;
  if (group === "PlacedTrees" && materialName === "M_Foliage") return 1;
  if ((group === "PlacedBushes" || group === "PlacedPlants") && materialName === "M_Foliage") return 2;
  return -1;
};

// gltf scene → { root, terrain, height, materials, anchors, textures }
// lawnRadius: inside it the lawn's own blades cover the ground, so the GLB's
// grass clumps there are left out. pondScale widens the pond; ridges is the
// height of the ridges' crests (m).
export function prepareGarden(gltfScene, { grassShare = 1, extraBushes = 0, lawnRadius = 0, pondScale = 1, ridges = 0, sway }) {
  const scene = gltfScene;
  const top = scene.getObjectByName("HyperiuxGarden");
  const missing = top ? GROUPS.filter((n) => !top.getObjectByName(n)) : ["HyperiuxGarden"];
  if (missing.length) return { missing };
  scene.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(top.matrixWorld).invert();

  // the anchors the code is built around (config GARDEN) must match the GLB
  const at = (name) => {
    const n = top.getObjectByName(name);
    return n ? new THREE.Vector3().setFromMatrixPosition(n.matrixWorld).applyMatrix4(toLocal) : null;
  };
  const anchors = { entrance: at("GardenEntrance"), pond: at("PondCenter"), logo: at("PondLogoAnchor") };
  for (const [k, v] of Object.entries(anchors)) {
    if (v && v.distanceTo(GARDEN[k]) > 0.05) console.warn(`[forging-concept] garden anchor ${k} moved in the GLB: ${v.toArray().map((n) => n.toFixed(2))}; update GARDEN in config.js`);
  }

  // one copy of each GLB material per kind, set up per the metadata's notes
  const materials = new Map();
  const material = (src, kind) => {
    const key = `${src.uuid}|${kind}`;
    if (materials.has(key)) return materials.get(key);
    const m = src.clone();
    if (m.name === "M_Foliage") {
      m.alphaTest = 0.5;
      m.transparent = false;
      m.side = THREE.DoubleSide;
    } else if (m.name === "M_Grass") m.side = THREE.DoubleSide;
    if (kind >= 0) patchSway(m, sway, kind);
    materials.set(key, m);
    return m;
  };

  // the terrain, reshaped, and its height grid for planting
  const terrainSrc = top.getObjectByName("GardenTerrain").getObjectByProperty("isMesh", true);
  const terrain = new THREE.Mesh(terrainSrc.geometry, material(terrainSrc.material, -1));
  terrain.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, terrainSrc.matrixWorld));
  const ridgeAt = createRidges(ridges, pondScale);
  reshapeTerrain(terrain, pondScale, ridgeAt);
  terrain.receiveShadow = true;
  terrain.name = "Terrain";
  const height = buildHeightGrid(terrain);

  // gather placements: (mesh, material) → matrices (garden space)
  const rng = mulberry32(4711);
  const batches = new Map();
  const add = (groupName, mesh, matrix) => {
    const kind = kindOf(groupName, mesh.material.name);
    const key = `${mesh.geometry.uuid}|${mesh.material.uuid}|${kind}`;
    if (!batches.has(key)) batches.set(key, { geometry: mesh.geometry, material: mesh.material, kind, group: groupName, matrices: [] });
    batches.get(key).matrices.push(matrix);
  };
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const stood = new THREE.Vector3();
  const moved = { x: 0, z: 0 };
  const shift = new THREE.Matrix4();
  const trunks = [];
  // each tree's canopy (garden space: centre and half-extents of its leaves),
  // for the pointer to touch
  const canopies = [];
  const leafBox = new THREE.Box3();
  const partBox = new THREE.Box3();
  const templates = { PlacedBushes: [] };
  for (const groupName of GROUPS) {
    if (groupName === "GardenTerrain") continue;
    const group = top.getObjectByName(groupName);
    for (const placed of group.children) {
      // where it stood on the GLB's ground → where that ground is now
      stood.setFromMatrixPosition(placed.matrixWorld).applyMatrix4(toLocal);
      widenPond(stood.x, stood.z, pondScale, moved);
      const lift = ridgeAt(moved.x, moved.z);
      shift.makeTranslation(moved.x - stood.x, lift, moved.z - stood.z);
      if (groupName === "PlacedTrees") trunks.push(new THREE.Vector3(moved.x, stood.y + lift, moved.z));
      // each placed variant's parts relative to it (to plant more of them)
      const parts = templates[groupName] ? [] : null;
      const rootInv = parts ? new THREE.Matrix4().copy(placed.matrixWorld).invert() : null;
      leafBox.makeEmpty();
      placed.traverse((o) => {
        if (!o.isMesh) return;
        m4.multiplyMatrices(toLocal, o.matrixWorld).premultiply(shift);
        if (groupName === "PlacedTrees" && o.material.name === "M_Foliage") {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          leafBox.union(partBox.copy(o.geometry.boundingBox).applyMatrix4(m4));
        }
        if (parts) parts.push({ mesh: o, rel: new THREE.Matrix4().multiplyMatrices(rootInv, o.matrixWorld) });
        if (groupName === "GrassPatches") {
          pos.setFromMatrixPosition(m4);
          // the lawn covers the clearing; the GLB's clumps only beyond it
          if (Math.hypot(pos.x, pos.z - 2) < lawnRadius) return;
          if (grassShare < 1 && rng() > grassShare) return;
        }
        add(groupName, o, m4.clone());
      });
      if (parts?.length) templates[groupName].push(parts);
      if (!leafBox.isEmpty()) {
        const c = leafBox.getCenter(new THREE.Vector3());
        const r = leafBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
        canopies.push({ x: c.x, y: c.y, z: c.z, rx: r.x, ry: r.y, rz: r.z });
      }
    }
  }

  // more bushes round the clearing
  const clearOf = (x, z, water, trunk) => {
    const h = height.sample(x, z);
    if (!Number.isFinite(h) || h < GARDEN.water + water) return null;
    if (trunks.some((t) => Math.hypot(t.x - x, t.z - z) < trunk)) return null;
    return h;
  };
  const plant = (groupName, x, z, h, scale) => {
    const list = templates[groupName];
    const parts = list[Math.floor(rng() * list.length)];
    const base = new THREE.Matrix4().compose(
      new THREE.Vector3(x, h - 0.03, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2),
      new THREE.Vector3(scale, scale, scale)
    );
    for (const { mesh, rel } of parts) add(groupName, mesh, new THREE.Matrix4().multiplyMatrices(base, rel));
  };
  for (let n = 0, tries = 0; n < extraBushes && tries < extraBushes * 20; tries++) {
    const a = rng() * Math.PI * 2;
    const r = 11 * pondScale + rng() * 26;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.85 - 2;
    // keep the camera's way in (the corridor from the entrance) open
    if (Math.abs(x) < 4.5 && z > 8) continue;
    const h = clearOf(x, z, 0.25, 3);
    if (h === null) continue;
    plant("PlacedBushes", x, z, h, 0.7 + rng() * 0.6);
    n++;
  }

  const root = new THREE.Group();
  root.name = "Garden";
  root.add(terrain);
  for (const b of batches.values()) {
    const mesh = new THREE.InstancedMesh(b.geometry, material(b.material, b.kind), b.matrices.length);
    b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    // trees, bushes and rocks throw shadows; everything takes them
    mesh.castShadow = b.group === "PlacedTrees" || b.group === "PlacedBushes" || b.group === "PlacedRocks";
    mesh.receiveShadow = true;
    mesh.name = `${b.group}:${b.material.name}`;
    if (b.group === "GrassPatches") mesh.layers.set(GRASS_LAYER);
    root.add(mesh);
  }

  const textures = new Set();
  for (const m of materials.values()) for (const k of ["map", "normalMap", "roughnessMap", "aoMap", "alphaMap"]) if (m[k]) textures.add(m[k]);

  return { root, terrain, height, trunks, canopies, materials: [...materials.values()], textures: [...textures], anchors };
}
