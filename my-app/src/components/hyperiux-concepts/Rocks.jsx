"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { createTerrainSampler } from "./terrainNoise";
import { mulberry32, scatterOnTerrain } from "./scatter";

const dummy = new THREE.Object3D();

function createRockGeometry(seed) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const noise3D = createNoise3D(() => seed);
  const pos = geo.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    vertex.fromBufferAttribute(pos, i);
    const bump = noise3D(vertex.x * 1.5, vertex.y * 1.5, vertex.z * 1.5);
    vertex.multiplyScalar(1 + bump * 0.35);
    pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  geo.computeVertexNormals();
  return geo;
}

// One InstancedMesh per geometry variant instead of a separate <mesh> +
// material per rock — this is what actually matters for performance: with
// `count` individual meshes, every rock is its own draw call, re-issued
// again for the water's reflection render and again for the shadow map
// (3 full passes x count draws). Bucketing by variant collapses that down
// to `variantCount` draw calls total, regardless of how many rocks there are.
function RockVariant({ geometry, material, items }) {
  const meshRef = useRef(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    items.forEach((item, i) => {
      dummy.position.set(item.worldX, item.worldY - item.scale * item.sinkIn, item.worldZ);
      dummy.rotation.set(item.tiltX, item.rotationY, item.tiltZ);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [items]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, items.length]}
      castShadow
      receiveShadow
    />
  );
}

// Chunkier, irregular boulders — distinct from the pointy shard Pebbles —
// scattered on the same height field so they sit flush with the ground.
export default function Rocks({
  count = 26,
  variantCount = 6,
  width = 80,
  depth = 80,
  height = 3.2,
  basinRadius = 15,
  basinDepth = 2.4,
  ruggedness = 0.35,
  ridgeSharpness = 1.3,
  warpStrength = 2,
  transitionWidth = 15,
  // Must match Terrain's own values (see terrainNoise.js) or scattered
  // rocks drift off the surface they're supposed to be sitting on.
  rollingFrequency = 0.018,
  ridgedFrequency = 0.028,
  waterLevel = -basinDepth + 0.35,
  seed = 21,
  color = "#1c1c1a",
  roughness = 0.5,
  clearcoat = 0.55,
  clearcoatRoughness = 0.18,
  normalScale = 0.5,
  minScale = 0.5,
  maxScale = 1.6,
  wetnessMaps,
  position = [0, 1.5, 0],
}) {
  const variants = useMemo(
    () => Array.from({ length: variantCount }, (_, i) => createRockGeometry(seed + i * 13)),
    [variantCount, seed]
  );

  const instances = useMemo(() => {
    const getElevation = createTerrainSampler({
      seed,
      height,
      basinRadius,
      basinDepth,
      ruggedness,
      ridgeSharpness,
      warpStrength,
      transitionWidth,
      rollingFrequency,
      ridgedFrequency,
    });
    const random = mulberry32(seed * 5171 + 3);

    const points = scatterOnTerrain({
      count,
      width,
      depth,
      getElevation,
      waterLevel,
      margin: 0.6,
      random,
    });

    return points.map((point) => ({
      ...point,
      variant: Math.floor(random() * variants.length),
      scale: minScale + random() * (maxScale - minScale),
      rotationY: random() * Math.PI * 2,
      tiltX: (random() - 0.5) * 0.3,
      tiltZ: (random() - 0.5) * 0.3,
      sinkIn: 0.15 + random() * 0.25,
    }));
  }, [
    count,
    width,
    depth,
    height,
    basinRadius,
    basinDepth,
    ruggedness,
    ridgeSharpness,
    warpStrength,
    transitionWidth,
    rollingFrequency,
    ridgedFrequency,
    waterLevel,
    seed,
    variants.length,
    minScale,
    maxScale,
  ]);

  const buckets = useMemo(() => {
    const groups = variants.map(() => []);
    instances.forEach((item) => groups[item.variant].push(item));
    return groups;
  }, [instances, variants]);

  const { roughnessMap, normalMap } = useMemo(() => {
    if (!wetnessMaps) return {};

    const roughnessMap = wetnessMaps.roughnessMap.clone();
    const normalMap = wetnessMaps.normalMap.clone();
    roughnessMap.repeat.set(1.5, 1.5);
    normalMap.repeat.set(1.5, 1.5);
    roughnessMap.needsUpdate = true;
    normalMap.needsUpdate = true;

    return { roughnessMap, normalMap };
  }, [wetnessMaps]);

  // All variants look identical material-wise, so share a single material
  // instance across every InstancedMesh instead of one per variant.
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness,
        roughnessMap,
        normalMap,
        normalScale: new THREE.Vector2(normalScale, normalScale),
        clearcoat,
        clearcoatRoughness,
        metalness: 0.05,
      }),
    [color, roughness, roughnessMap, normalMap, normalScale, clearcoat, clearcoatRoughness]
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <group position={position}>
      {variants.map((geometry, i) => (
        <RockVariant key={i} geometry={geometry} material={material} items={buckets[i]} />
      ))}
    </group>
  );
}
