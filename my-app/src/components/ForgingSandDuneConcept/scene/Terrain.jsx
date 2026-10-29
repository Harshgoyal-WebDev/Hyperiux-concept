"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createSandMaterial } from "../world/materials";
import { T } from "../tuning";

// Wind-carved dune field. Big forms are real geometry from the shared
// height field (so trail, rocks and camera all agree on the ground); sand
// ripples are shaded in the material.
// (it reaches far beyond the slab: the camera flies on over it, ~770 m past
// the mark, and the beam's strands run off across it)
export const TERRAIN_SIZE = 2400;
export const TERRAIN_CENTER = [-60, -500];

export function buildTerrainGeometry(terrain, segments) {
  const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments);
  g.rotateX(-Math.PI / 2);
  g.translate(TERRAIN_CENTER[0], 0, TERRAIN_CENTER[1]);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrain.height(pos.getX(i), pos.getZ(i)));
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// The terrain grid doubles as a height map: vertex (ix, iz) sits at
// x0 + ix * step, z0 + iz * step. `sample` is a fast bilinear lookup for
// CPU ray casts; `texture` serves the same heights to shaders.
export function buildHeightField(geometry, segments) {
  const n = segments + 1;
  const step = TERRAIN_SIZE / segments;
  const x0 = TERRAIN_CENTER[0] - TERRAIN_SIZE / 2;
  const z0 = TERRAIN_CENTER[1] - TERRAIN_SIZE / 2;
  const pos = geometry.attributes.position;
  const heights = new Float32Array(n * n);
  const half = new Uint16Array(n * n);
  for (let i = 0; i < n * n; i++) {
    heights[i] = pos.getY(i);
    half[i] = THREE.DataUtils.toHalfFloat(heights[i]);
  }
  const texture = new THREE.DataTexture(half, n, n, THREE.RedFormat, THREE.HalfFloatType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  function sample(x, z) {
    const fx = THREE.MathUtils.clamp((x - x0) / step, 0, n - 1.001);
    const fz = THREE.MathUtils.clamp((z - z0) / step, 0, n - 1.001);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const a = heights[iz * n + ix];
    const b = heights[iz * n + ix + 1];
    const c = heights[(iz + 1) * n + ix];
    const d = heights[(iz + 1) * n + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  return { texture, sample, params: new THREE.Vector4(x0, z0, step, n) };
}

export default function Terrain({ shared, geometry }) {
  const { material } = useMemo(() => createSandMaterial(shared), [shared]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    if (material.userData.hex !== T.sandColor) {
      material.color.set(T.sandColor);
      material.userData.hex = T.sandColor;
    }
  });

  return <mesh geometry={geometry} material={material} receiveShadow frustumCulled={false} />;
}
