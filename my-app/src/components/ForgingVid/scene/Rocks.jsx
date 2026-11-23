"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { mulberry32 } from "../world/layout";
import { STONE_UNIFORMS, createStoneMaterial } from "../world/materials";
import { useRockModels } from "../world/rockModels";
import { T } from "../tuning";

// Faceted basalt shard: a subdivided box tapered towards the top, leaned
// and broken up with noise, flat shaded so the facets catch the low sun.
export function shardGeometry(seed, { taper = 0.55, noise = 0.16 } = {}) {
  const rng = mulberry32(seed);
  const n3 = createNoise3D(rng);
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 9, 3);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const twist = (rng() - 0.5) * 0.6;
  const top = 0.15 + rng() * 0.3;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y = v.y + 0.5; // 0..1
    const w = THREE.MathUtils.lerp(1, top, Math.pow(y, 1.4) * taper * 1.6);
    const a = twist * y;
    const x = (v.x * Math.cos(a) - v.z * Math.sin(a)) * w;
    const z = (v.x * Math.sin(a) + v.z * Math.cos(a)) * w;
    const d = n3(v.x * 2.1, v.y * 2.1, v.z * 2.1) * noise + n3(v.x * 6, v.y * 6, v.z * 6) * noise * 0.3;
    v.set(x * (1 + d), y + d * 0.25, z * (1 + d));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  return flat;
}

function shardMatrix(l, terrain) {
  const m = new THREE.Matrix4();
  const y = terrain.height(l.position[0], l.position[2]) - 1.2;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(l.lean, l.seed * 0.7, -l.lean * 0.6));
  m.compose(new THREE.Vector3(l.position[0], y, l.position[2]), q, new THREE.Vector3(l.width, l.height, l.width * 0.8));
  return m;
}

function scatterMatrix(r, terrain) {
  const m = new THREE.Matrix4();
  // (standing on its base, its buried skirt in the sand — a little deeper
  // on a slope, so no edge lifts off it)
  const h = terrain.height(r.position[0], r.position[2]);
  const g = Math.min(Math.hypot(terrain.height(r.position[0] + 1, r.position[2]) - h, terrain.height(r.position[0], r.position[2] + 1) - h), 1);
  const y = h - r.scale * (0.04 + g * 0.3);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.rotation, 0));
  m.compose(new THREE.Vector3(r.position[0], y, r.position[2]), q, new THREE.Vector3(r.scale, r.scale * r.squash, r.scale * 1.1));
  return m;
}

// Basalt shards and boulders scattered over the dunes, as world-space
// matrices over a few shared geometries (one instanced mesh per geometry).
export function buildRockSet(shards, scatter, terrain) {
  const groups = [
    ...[0, 1, 2, 3].map((i) => ({ geometry: shardGeometry(301 + i * 17), matrices: [] })),
    // (the boulders: the Blender rocks, world/rockModels.js — their
    // geometry filled in by Rocks once the model has loaded)
    ...[0, 1, 3].map((model) => ({ geometry: null, model, matrices: [] })),
  ];
  shards.forEach((l, i) => groups[i % 4].matrices.push(shardMatrix(l, terrain)));
  scatter.forEach((r) => groups[4 + r.variant].matrices.push(scatterMatrix(r, terrain)));
  return groups.filter((g) => g.matrices.length);
}

// (`finish`, optional: a function giving the boulders' material from the
// models' own — world/rockFinish.js — so one set of rocks can be dressed
// without the others)
// (light: the light copies of the Blender rocks — the valley's many small ones)
export default function Rocks({ rockSet, shared, finish, light = false }) {
  const stone = useMemo(() => createStoneMaterial(shared), [shared]);
  const models = useRockModels();
  const boulderMaterial = useMemo(() => (finish ? finish(models.material) : models.material), [finish, models]);
  useEffect(() => () => boulderMaterial !== models.material && boulderMaterial.dispose(), [boulderMaterial, models]);

  useEffect(
    () => () => {
      stone.material.dispose();
      // (the model's geometries are shared: not ours to dispose)
      rockSet.forEach((g) => g.geometry?.dispose());
    },
    [stone, rockSet]
  );

  useFrame(() => {
    const m = stone.material;
    if (m.userData.hex !== T.stoneColor) {
      m.color.set(T.stoneColor);
      m.userData.hex = T.stoneColor;
    }
    m.roughness = T.stoneRoughness;
    // (the Blender rocks' tint, over their baked colour: every one of them)
    if (models.material.userData.tint !== T.rockTint) {
      models.material.color.set(T.rockTint);
      models.material.userData.tint = T.rockTint;
    }
    if (boulderMaterial !== models.material) boulderMaterial.color.copy(models.material.color);
    // (every stone's moss: the oasis's too)
    if (STONE_UNIFORMS.uMoss.userData !== T.stoneMoss) {
      STONE_UNIFORMS.uMoss.value.set(T.stoneMoss);
      STONE_UNIFORMS.uMoss.userData = T.stoneMoss;
    }
    STONE_UNIFORMS.uMossAmount.value = T.stoneMossAmount;
  });

  return (
    <>
      {rockSet.map((group, gi) =>
        group.model == null ? (
          <RockGroup key={gi} group={group} geometry={group.geometry} material={stone.material} />
        ) : (
          <RockGroup key={gi} group={group} geometry={(light ? models.bouldersLight : models.boulders)[group.model]} material={boulderMaterial} />
        )
      )}
    </>
  );
}

function RockGroup({ group, geometry, material }) {
  const ref = useRef();
  useLayoutEffect(() => {
    if (!ref.current) return;
    group.matrices.forEach((m, i) => ref.current.setMatrixAt(i, m));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [group]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, group.matrices.length]}
      castShadow
      receiveShadow
    />
  );
}
