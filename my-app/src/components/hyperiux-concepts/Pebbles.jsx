"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createTerrainSampler } from "./terrainNoise";
import { mulberry32, scatterOnTerrain } from "./scatter";

const dummy = new THREE.Object3D();

export default function Pebbles({
  count = 260,
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
  // pebbles drift off the surface they're supposed to be sitting on.
  rollingFrequency = 0.018,
  ridgedFrequency = 0.028,
  waterLevel = -basinDepth + 0.35,
  seed = 7,
  color = "#141613",
  roughness = 0.55,
  clearcoat = 0.5,
  clearcoatRoughness = 0.2,
  position = [0, 0.9, 0],
}) {
  const meshRef = useRef(null);

  // Low-poly icosahedron (detail 0) — flat triangular facets give sharp
  // edges without the single-point spike a cone reads as.
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);

  const instances = useMemo(() => {
    // Same height field the ground mesh uses, so pebbles sit exactly on
    // the surface instead of floating or sinking.
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
    const random = mulberry32(seed * 7349 + 11);

    const points = scatterOnTerrain({ count, width, depth, getElevation, waterLevel, random });

    return points.map((point) => {
      const size = 0.12 + random() * 0.22;
      return {
        ...point,
        scaleX: size * (0.85 + random() * 0.3),
        scaleY: size * (0.45 + random() * 0.25),
        scaleZ: size * (0.85 + random() * 0.3),
        tiltX: (random() - 0.5) * 0.6,
        tiltZ: (random() - 0.5) * 0.6,
        rotationY: random() * Math.PI * 2,
      };
    });
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
  ]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    instances.forEach((item, i) => {
      dummy.position.set(item.worldX, item.worldY - item.scaleY * 0.3, item.worldZ);
      dummy.rotation.set(item.tiltX, item.rotationY, item.tiltZ);
      dummy.scale.set(item.scaleX, item.scaleY, item.scaleZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [instances]);

  if (instances.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, instances.length]}
      position={position}
      castShadow
      receiveShadow
    >
      <meshPhysicalMaterial
        color={color}
        roughness={roughness}
        clearcoat={clearcoat}
        clearcoatRoughness={clearcoatRoughness}
        metalness={0.05}
      />
    </instancedMesh>
  );
}
