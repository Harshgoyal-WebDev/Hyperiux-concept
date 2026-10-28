import * as THREE from "three";
import { GARDEN } from "../config";
import { mulberry32 } from "./layout";
import { buildHeightGrid } from "./gardenTerrain";

// The garden from hyperiux-garden-environment.glb (its own metres: pond
// centred on the origin at water level, the camera arriving from +z; see
// hyperiux-garden-metadata.json).
//
// The GLB places every tree, bush, grass clump, rock, flower and plant as its
// own node (4,884 of them) but each variant's parts share one mesh. Here every
// (mesh, material) pair becomes one InstancedMesh carrying all its placements,
// so the whole garden draws in a couple of hundred calls. More bushes and
// flower clusters are planted from the GLB's own variants (on the terrain,
// clear of the water and the trunks). The terrain stays a single mesh.
//
// Grass, leaves and flowers sway in the wind and part around the pointer's
// recent path (a short trail of its lines of sight, fading as they age);
// bushes, plants and flowers also glow where it passes (see swayGlsl).

const GROUPS = ["GardenTerrain", "GrassPatches", "PlacedTrees", "PlacedBushes", "PlacedRocks", "FlowerClusters", "PlacedPlants"];
export const TRAIL = 8; // lines of sight remembered
// Small, dense things (grass, flowers) live on this layer, which the pond's
// reflection leaves out: they would cost a second lawn and barely show.
export const GRASS_LAYER = 1;

// Shared by every swaying material (and the dense grass): wind, and the
// pointer's trail (Garden.jsx keeps it up to date).
export function createSwayUniforms(time) {
  return {
    uTime: time,
    uTrailO: { value: Array.from({ length: TRAIL }, () => new THREE.Vector4(0, -1000, 0, 0)) }, // origin, strength
    uTrailD: { value: Array.from({ length: TRAIL }, () => new THREE.Vector4(0, 0, -1, 0)) }, // direction
    uPushRadius: { value: 2.2 },
    uPushAmount: { value: 1 },
    uWindAmount: { value: 1 },
    uGlowRadius: { value: 1.6 },
    uGlowStrength: { value: 1 },
    uGlowColor: { value: new THREE.Color("#ffb45c") },
  };
}

// kinds: 0 grass (bends from the root, uv.y = 0 there), 1 tree leaves,
// 2 bush / plant leaves (+ glow), 3 flowers (bend from the ground, + glow)
const GLOWS = (kind) => kind >= 2;
const swayGlsl = (kind) => /* glsl */ `
#ifdef USE_INSTANCING
{
  mat4 swM = modelMatrix * instanceMatrix;
  vec3 swPivot = (swM * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 swWorld = (swM * vec4(transformed, 1.0)).xyz;
  ${
    kind === 0
      ? "float swW = pow(clamp(uv.y, 0.0, 1.0), 1.7);"
      : kind === 3
        ? "float swW = clamp((swWorld.y - swPivot.y) / 0.5, 0.0, 1.0);"
        : "float swW = clamp(length(swWorld - swPivot) / 1.6, 0.0, 1.0);"
  }
  // wind: slow gusts rolling across the garden, a quicker flutter on top
  float swGust = 0.6 + 0.4 * sin(uTime * 0.9 + swPivot.x * 0.21 + swPivot.z * 0.17);
  float swFlutter = sin(uTime * ${kind === 1 ? "3.1" : "2.3"} + swPivot.x * 1.7 + swPivot.z * 1.3 + swWorld.y * 0.6);
  vec3 swDisp = vec3(0.8, 0.0, 0.6) * (swGust * ${kind === 1 ? "0.05" : "0.08"} + swFlutter * 0.033) * uWindAmount;
  // the pointer's recent path: everything near it leans away (the newest,
  // strongest line of sight wins), and springs back as the trail fades
  float swF = 0.0;
  vec3 swDir = vec3(0.0);
  float swGlowF = 0.0;
  for (int i = 0; i < ${TRAIL}; i++) {
    vec4 o = uTrailO[i];
    if (o.w <= 0.001) continue;
    vec3 d = uTrailD[i].xyz;
    vec3 rel = swWorld - o.xyz;
    vec3 aw = rel - d * max(dot(rel, d), 0.0);
    ${kind === 0 || kind === 3 ? "aw.y = 0.0;" : ""}
    float dd = length(aw);
    float f = o.w * exp(-dd * dd / (uPushRadius * uPushRadius));
    if (f > swF) {
      swF = f;
      swDir = aw / max(dd, 1e-3);
    }
    ${GLOWS(kind) ? "swGlowF = max(swGlowF, o.w * exp(-dd * dd / (uGlowRadius * uGlowRadius)));" : ""}
  }
  swDisp += swDir * swF * uPushAmount * ${kind === 1 ? "0.3" : "0.42"};
  ${kind === 0 ? "swDisp.y -= swF * uPushAmount * 0.12; // pressed down a little as well" : ""}
  ${GLOWS(kind) ? "vSwGlow = swGlowF;" : ""}
  // world offset → this instance's own space (rotation about y + uniform scale)
  mat3 swR = mat3(swM);
  transformed += (transpose(swR) * swDisp) / dot(swR[0], swR[0]) * swW;
}
#endif
`;

export const SWAY_DECLS = /* glsl */ `
uniform float uTime;
uniform vec4 uTrailO[${TRAIL}];
uniform vec4 uTrailD[${TRAIL}];
uniform float uPushRadius;
uniform float uPushAmount;
uniform float uWindAmount;
uniform float uGlowRadius;
varying float vSwGlow;
`;

// Patches a material to sway (kind as above); grass blades pass extra
// vertex code to run before it (their own shape).
export function patchSway(material, uniforms, kind, { before = "", fragment = null, key = "" } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${SWAY_DECLS}`)
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
  if (group === "FlowerClusters") return 3;
  return -1;
};

// gltf scene → { root, terrain, height, materials, anchors, textures }
export function prepareGarden(gltfScene, { grassShare = 1, extraBushes = 0, extraFlowers = 0, sway }) {
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

  // the terrain, and its height grid for planting
  const terrainSrc = top.getObjectByName("GardenTerrain").getObjectByProperty("isMesh", true);
  const terrain = new THREE.Mesh(terrainSrc.geometry, material(terrainSrc.material, -1));
  terrain.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, terrainSrc.matrixWorld));
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
  const trunks = [];
  const templates = { PlacedBushes: [], FlowerClusters: [] };
  for (const groupName of GROUPS) {
    if (groupName === "GardenTerrain") continue;
    const group = top.getObjectByName(groupName);
    for (const placed of group.children) {
      if (groupName === "PlacedTrees") trunks.push(new THREE.Vector3().setFromMatrixPosition(placed.matrixWorld).applyMatrix4(toLocal));
      // each placed variant's parts relative to it (to plant more of them)
      const parts = templates[groupName] ? [] : null;
      const rootInv = parts ? new THREE.Matrix4().copy(placed.matrixWorld).invert() : null;
      placed.traverse((o) => {
        if (!o.isMesh) return;
        m4.multiplyMatrices(toLocal, o.matrixWorld);
        if (parts) parts.push({ mesh: o, rel: new THREE.Matrix4().multiplyMatrices(rootInv, o.matrixWorld) });
        // grass thins out with distance first on smaller tiers
        if (groupName === "GrassPatches" && grassShare < 1) {
          pos.setFromMatrixPosition(m4);
          const near = pos.distanceTo(GARDEN.entrance) < 14 || pos.length() < 14;
          if (!near && rng() > grassShare) return;
        }
        add(groupName, o, m4.clone());
      });
      if (parts?.length) templates[groupName].push(parts);
    }
  }

  // more bushes round the clearing and flowers in drifts through the grass
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
    const r = 11 + rng() * 26;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.85 - 2;
    // keep the camera's way in (the corridor from the entrance) open
    if (Math.abs(x) < 4.5 && z > 8) continue;
    const h = clearOf(x, z, 0.25, 3);
    if (h === null) continue;
    plant("PlacedBushes", x, z, h, 0.7 + rng() * 0.6);
    n++;
  }
  for (let n = 0, tries = 0; n < extraFlowers && tries < extraFlowers * 20; ) {
    // drifts: a centre, then a handful of clusters round it
    const a = rng() * Math.PI * 2;
    const r = 7 + Math.pow(rng(), 0.8) * 30;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r * 0.85;
    const k = 4 + Math.floor(rng() * 6);
    for (let i = 0; i < k && n < extraFlowers; i++, tries++) {
      const x = cx + (rng() - 0.5) * 4;
      const z = cz + (rng() - 0.5) * 4;
      const h = clearOf(x, z, 0.12, 1.2);
      if (h === null) continue;
      plant("FlowerClusters", x, z, h, 0.8 + rng() * 0.5);
      n++;
    }
    tries++;
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
    if (b.group === "GrassPatches" || b.group === "FlowerClusters") mesh.layers.set(GRASS_LAYER);
    root.add(mesh);
  }

  const textures = new Set();
  for (const m of materials.values()) for (const k of ["map", "normalMap", "roughnessMap", "aoMap", "alphaMap"]) if (m[k]) textures.add(m[k]);

  return { root, terrain, height, trunks, materials: [...materials.values()], textures: [...textures], anchors };
}
