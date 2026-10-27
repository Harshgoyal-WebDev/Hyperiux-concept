"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { mulberry32 } from "../world/layout";
import { createStoneMaterial } from "../world/materials";
import { makeDissolveConfig } from "../world/dissolve";
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

function boulderGeometry(seed) {
  const rng = mulberry32(seed);
  const n3 = createNoise3D(rng);
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = 1 + n3(v.x * 1.3, v.y * 1.3, v.z * 1.3) * 0.32 + n3(v.x * 4, v.y * 4, v.z * 4) * 0.08;
    v.multiplyScalar(d);
    v.y = Math.max(v.y, -0.35);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const flat = g.index ? g.toNonIndexed() : g;
  if (flat !== g) g.dispose();
  flat.computeVertexNormals();
  return flat;
}

function landmarkMatrix(l, terrain) {
  const m = new THREE.Matrix4();
  const y = terrain.height(l.position[0], l.position[2]) - 1.2;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(l.lean, l.seed * 0.7, -l.lean * 0.6));
  m.compose(new THREE.Vector3(l.position[0], y, l.position[2]), q, new THREE.Vector3(l.width, l.height, l.width * 0.8));
  return m;
}

function scatterMatrix(r, terrain) {
  const m = new THREE.Matrix4();
  const y = terrain.height(r.position[0], r.position[2]) - r.scale * 0.15;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.rotation, 0));
  m.compose(new THREE.Vector3(r.position[0], y, r.position[2]), q, new THREE.Vector3(r.scale, r.scale * r.squash, r.scale * 1.1));
  return m;
}

// Builds every rock as world-space matrices over a few shared geometries.
// Returned so the dissolve particle system can sample the same surfaces.
export function buildRockSet(landmarks, scatter, terrain) {
  const shardGeos = [0, 1, 2, 3].map((i) => shardGeometry(301 + i * 17));
  const boulderGeos = [0, 1, 2].map((i) => boulderGeometry(503 + i * 11));
  const groups = [
    ...shardGeos.map((geometry) => ({ geometry, matrices: [], landmarkIndex: [] })),
    ...boulderGeos.map((geometry) => ({ geometry, matrices: [], landmarkIndex: [] })),
  ];
  landmarks.forEach((l, i) => {
    const g = groups[i % 4];
    g.matrices.push(landmarkMatrix(l, terrain));
    g.landmarkIndex.push(i);
  });
  scatter.forEach((r) => {
    const g = groups[4 + r.variant];
    g.matrices.push(scatterMatrix(r, terrain));
    g.landmarkIndex.push(-1);
  });
  return groups.filter((g) => g.matrices.length);
}

export default function Rocks({ rockSet, landmarks, shared, J }) {
  const stone = useMemo(() => createStoneMaterial(shared, makeDissolveConfig("rocks"), { fissure: 0 }), [shared]);
  // Journey markers get their own material so their fissures can glow as
  // the camera passes each one.
  const markerStones = useMemo(
    () =>
      landmarks.map((l) =>
        l.kind === "marker" ? createStoneMaterial(shared, makeDissolveConfig("rocks"), { fissure: 0 }) : null
      ),
    [landmarks, shared]
  );

  useEffect(
    () => () => {
      stone.material.dispose();
      stone.depthMaterial.dispose();
      markerStones.forEach((s) => {
        s?.material.dispose();
        s?.depthMaterial.dispose();
      });
      rockSet.forEach((g) => g.geometry.dispose());
    },
    [stone, markerStones, rockSet]
  );

  useFrame(() => {
    for (const m of [stone.material, ...markerStones.map((s) => s?.material)]) {
      if (!m) continue;
      if (m.userData.hex !== T.stoneColor) {
        m.color.set(T.stoneColor);
        m.userData.hex = T.stoneColor;
      }
      m.roughness = T.stoneRoughness;
    }
    landmarks.forEach((l, i) => {
      const s = markerStones[i];
      if (!s) return;
      const near = 1 - THREE.MathUtils.smoothstep(Math.abs(J.camB - l.s), 0.0, 0.09);
      s.uniforms.uFissure.value = (0.15 + near * 1.1) * J.landmarks * (1 - J.dissolve);
    });
  });

  return (
    <>
      {rockSet.map((group, gi) => (
        <RockGroup key={gi} group={group} stone={stone} markerStones={markerStones} />
      ))}
    </>
  );
}

function RockGroup({ group, stone, markerStones }) {
  const ref = useRef();
  const { markers, instanced } = useMemo(() => {
    const markers = group.landmarkIndex
      .map((li, k) => ({ li, k }))
      .filter(({ li }) => li >= 0 && markerStones[li]);
    const instanced = group.matrices.filter((_, k) => !markers.some((m) => m.k === k));
    return { markers, instanced };
  }, [group, markerStones]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    instanced.forEach((m, i) => ref.current.setMatrixAt(i, m));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [instanced]);

  return (
    <>
      {instanced.length > 0 && (
        <instancedMesh
          ref={ref}
          args={[group.geometry, stone.material, instanced.length]}
          customDepthMaterial={stone.depthMaterial}
          castShadow
          receiveShadow
        />
      )}
      {markers.map(({ li, k }) => (
        <mesh
          key={li}
          geometry={group.geometry}
          material={markerStones[li].material}
          customDepthMaterial={markerStones[li].depthMaterial}
          matrix={group.matrices[k]}
          matrixAutoUpdate={false}
          castShadow
          receiveShadow
        />
      ))}
    </>
  );
}
