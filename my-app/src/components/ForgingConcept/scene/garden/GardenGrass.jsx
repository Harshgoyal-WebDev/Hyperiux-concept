"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { GARDEN } from "../../config";
import { mulberry32 } from "../../world/layout";
import { GRASS_LAYER, patchSway, releaseAfterUpload } from "../../world/gardenAsset";
import { GARDEN_SUN } from "./sky";
import { T } from "../../tuning";
import { Q } from "../../quality";

// A lawn of real grass over the whole clearing: individual blades (one
// instanced draw per ring), planted on the terrain's height grid everywhere but the
// water — thick round the pond and the camera's path, thinning towards the
// trees. Each blade is a tapered, curved strip: dark at the root, through a
// mid green to a sunlit tip, warmer and drier in drifting patches, each its
// own shade, with a faint vein, a little gloss, the sun glowing through it
// when the camera looks towards the light, and the odd dew glint. It sways in
// the breeze and in the pointer's own wind (the garden's shared sway, see
// gardenAsset.js). The blades live on GRASS_LAYER, which the
// pond's reflection skips.

// The lawn reaches this far from the pond (m); the GLB's own grass clumps
// take over beyond it.
export const LAWN_RADIUS = 50;

// The lawn in rings out from the pond, each with lighter blades: 6 triangles
// within 24 m (the camera's orbit passes over them), 4 to 34 m, 2 beyond
// (never nearer the camera than ~10 m). [outer radius (m), rows]
const RINGS = [
  [24, 4],
  [34, 3],
  [Infinity, 2],
];

// one blade: rows up a tapered strip, 1 m tall, 1 unit wide at the root
// (4 rows near the pond, where the camera comes close; fewer further out,
// where a blade is a few pixels tall — see RINGS)
function bladeGeometry(rows) {
  const pos = [];
  const uv = [];
  const normal = [];
  const index = [];
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const w = 0.5 * (1 - Math.pow(t, 1.4)) + 0.02;
    for (const s of [-1, 1]) {
      pos.push(s * w, t, 0);
      uv.push(s < 0 ? 0 : 1, t);
      // soft, rounded normals leaning up: a lawn reads as one surface
      const n = new THREE.Vector3(s * 0.35, 0.8, 0.6).normalize();
      normal.push(n.x, n.y, n.z);
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    const a = r * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  g.setIndex(index);
  return g;
}

// the blade's own shape before the sway: a curve forward, narrow width
const BLADE_VERTEX = /* glsl */ `
transformed.x *= aBlade.y * uGrassWidth;
transformed.y *= uGrassHeight;
transformed.z += pow(uv.y, 2.0) * aBlade.z * 0.35 * uGrassHeight;
vGrassTint = aBlade.w;
vGrassT = uv.y;
vGrassAcross = uv.x * 2.0 - 1.0;
vGrassSeed = aBlade.x;
vGrassWorld = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
`;

export default function GardenGrass({ tier, garden, sway }) {
  const ref = useRef();
  const built = useMemo(() => {
    const count = tier.gardenBlades;
    const rng = mulberry32(9090);
    const noise = createNoise2D(mulberry32(31));
    // per ring: its blades' matrices and data (seed, width, lean, tint)
    const rings = RINGS.map(() => ({ matrices: [], blade: [] }));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    let n = 0;
    for (let tries = 0; n < count && tries < count * 4; tries++) {
      // densest round the pond, thinning out to the lawn's edge (where the
      // blades grow broader, so it stays a sward from afar)
      const a = rng() * Math.PI * 2;
      const r = 8 + Math.pow(rng(), 1.05) * (LAWN_RADIUS - 8);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.9 + 2;
      const h = garden.height.sample(x, z);
      if (!Number.isFinite(h) || h < GARDEN.water + 0.04) continue;
      if (garden.trunks.some((t) => Math.abs(t.x - x) < 0.6 && Math.abs(t.z - z) < 0.6)) continue;
      // patches: taller, lusher drifts and shorter, drier ones
      const patch = noise(x * 0.07, z * 0.07);
      const tall = 0.32 + 0.38 * (patch * 0.5 + 0.5) + rng() * 0.18;
      // (facing much as their neighbours do, so they lean together)
      q.setFromAxisAngle(up, noise(x * 0.09 + 17, z * 0.09) * Math.PI + (rng() - 0.5) * 1.6);
      m.compose(p.set(x, h - 0.02, z), q, s.set(tall, tall, tall));
      const ring = rings[RINGS.findIndex(([outer]) => r < outer)];
      ring.matrices.push(m.clone());
      // seed, width, lean, tint (0 lush → 1 dry)
      const dry = THREE.MathUtils.clamp(noise(x * 0.05 + 40, z * 0.05) * 0.6 + 0.15 + (rng() < 0.08 ? 0.5 : 0), 0, 1);
      ring.blade.push(rng(), (0.05 + rng() * 0.05) * (1 + Math.max(r - 25, 0) / 30), (rng() - 0.3) * 1.2, dry);
      n++;
    }
    const uniforms = {
      uGrassHeight: { value: 1 },
      uGrassWidth: { value: 1 },
      uGrassBlend: { value: 0.6 },
      uGrassRoot: { value: new THREE.Color("#1f3a12") },
      uGrassMid: { value: new THREE.Color("#3f6b22") },
      uGrassTip: { value: new THREE.Color("#7fae3c") },
      uGrassDry: { value: new THREE.Color("#b5a35a") },
      uGrassSun: { value: GARDEN_SUN.clone() },
      uGrassGlow: { value: 1 },
    };
    // Lambert: a fraction of the cost of the standard material over this
    // many overlapping blades (the sun through them and the dew glints are
    // added by hand below)
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    patchSway(material, { ...sway, ...uniforms }, 0, {
      key: "-blade",
      before: BLADE_VERTEX,
      fragment: (f) =>
        f
          .replace(
            "#include <common>",
            `#include <common>
            uniform vec3 uGrassRoot;
            uniform vec3 uGrassMid;
            uniform vec3 uGrassTip;
            uniform vec3 uGrassDry;
            uniform vec3 uGrassSun;
            uniform float uGrassGlow;
            varying float vGrassTint;
            varying float vGrassT;
            varying float vGrassAcross;
            varying float vGrassSeed;
            varying vec2 vGrassWorld;
            uniform float uGrassBlend;`
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            // root → middle → tip, warmer and drier in patches, each blade its
            // own shade, a faint vein down the middle, shaded at the root
            // (clamped: interpolation can dip a hair below 0 at the root)
            float gT = clamp(vGrassT, 0.0, 1.0);
            vec3 gAlb = mix(uGrassRoot, uGrassMid, smoothstep(0.0, 0.55, gT));
            gAlb = mix(gAlb, uGrassTip, smoothstep(0.4, 1.0, gT) * mix(0.85, 0.45, uGrassBlend));
            gAlb = mix(gAlb, uGrassDry, vGrassTint * 0.75);
            // Blended into one sward (uGrassBlend): neighbours share their
            // shade (drifting with where they grow, not blade by blade), the
            // roots darken less and the vein fades, so the tips stay pointed
            // but the lawn doesn't read as separate spikes
            float gPatch = 0.5 + 0.5 * sin(vGrassWorld.x * 0.31 + sin(vGrassWorld.y * 0.23) * 2.0) * sin(vGrassWorld.y * 0.27 + sin(vGrassWorld.x * 0.19) * 2.0);
            gAlb *= mix(mix(0.68, 1.12, fract(vGrassSeed * 7.31)), mix(0.82, 1.06, gPatch) * mix(0.95, 1.03, fract(vGrassSeed * 7.31)), uGrassBlend);
            gAlb *= 1.0 + 0.12 * (1.0 - uGrassBlend) * (1.0 - smoothstep(0.0, 0.35, abs(vGrassAcross)));
            gAlb *= mix(mix(0.25, 0.6, uGrassBlend), 1.0, smoothstep(0.0, 0.7, gT));
            diffuseColor.rgb = gAlb;`
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            // the sun through the blades when looking towards it, brightest at
            // the tips; and now and then a dew glint
            vec3 gSun = normalize((viewMatrix * vec4(uGrassSun, 0.0)).xyz);
            vec3 gLook = normalize(-vViewPosition);
            totalEmissiveRadiance += gAlb * pow(max(dot(gLook, gSun), 0.0), 3.0) * smoothstep(0.1, 0.9, gT) * 1.3 * uGrassGlow;
            float gDew = step(0.985, fract(vGrassSeed * 97.13)) * smoothstep(0.55, 0.9, gT);
            totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * gDew * pow(max(dot(normal, normalize(gSun - gLook)), 0.0), 120.0) * 2.5;`
          ),
    });
    // the vertex stage needs the blade attribute and the varyings
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prev(shader, renderer);
      shader.vertexShader = shader.vertexShader
        // (blended: every blade lit as the lawn's one surface, facing up)
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), uGrassBlend * 0.85));")
        .replace(
        "#include <common>",
        `#include <common>
        attribute vec4 aBlade;
        uniform float uGrassHeight;
        uniform float uGrassWidth;
        uniform float uGrassBlend;
        varying float vGrassTint;
        varying float vGrassT;
        varying float vGrassAcross;
        varying float vGrassSeed;
        varying vec2 vGrassWorld;`
      );
    };
    // one instanced draw per ring, all sharing the material
    const group = new THREE.Group();
    const meshes = RINGS.map(([, rows], i) => {
      const { matrices, blade } = rings[i];
      const geometry = bladeGeometry(rows);
      geometry.setAttribute("aBlade", new THREE.InstancedBufferAttribute(new Float32Array(blade), 4));
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(matrices.length, 1));
      matrices.forEach((mm, j) => mesh.setMatrixAt(j, mm));
      mesh.count = matrices.length;
      mesh.userData.planted = matrices.length;
      // (never read or changed again: let the JS copies go once uploaded —
      // the renderer's depth sort reads the bounds, so they're found first)
      mesh.computeBoundingSphere();
      releaseAfterUpload(mesh.instanceMatrix, geometry.attributes.aBlade);
      mesh.frustumCulled = false;
      // (no shadow lookups per blade: the roots are shaded by hand instead)
      mesh.layers.set(GRASS_LAYER);
      group.add(mesh);
      return mesh;
    });
    return { group, meshes, material, uniforms, planted: n };
  }, [tier, garden, sway]);

  useEffect(
    () => () => {
      built.meshes.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.dispose();
      });
      built.material.dispose();
    },
    [built]
  );

  useFrame(() => {
    const u = built.uniforms;
    u.uGrassHeight.value = T.grassHeight;
    u.uGrassWidth.value = T.grassWidth;
    u.uGrassBlend.value = T.grassBlend;
    u.uGrassRoot.value.set(T.grassRoot);
    u.uGrassMid.value.set(T.grassMid);
    u.uGrassGlow.value = T.grassTranslucency;
    u.uGrassTip.value.set(T.grassTip);
    u.uGrassDry.value.set(T.grassDry);
    for (const mesh of built.meshes) mesh.count = Math.min(Math.round(mesh.userData.planted * T.grassDensity * Q.density), mesh.userData.planted);
  });

  return <primitive ref={ref} object={built.group} />;
}
