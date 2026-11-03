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

// The sand's mesh: fine where the camera is — 0.9 × (TERRAIN_SIZE /
// segments) apart within NEAR m of the slab — and coarser out towards the
// horizon (the spacing growing by GROW m per m), where the dunes are far off
// and hazed: about a third of the triangles of an even grid at that detail.
// (Heights come from the terrain itself, not this mesh: see buildHeightField.)
const NEAR = 150;
const GROW = 0.03;
// grid lines along one axis from lo to hi, closest round 0 (the slab)
function gridLines(lo, hi, fine) {
  const spacing = (x) => fine + Math.max(Math.abs(x) - NEAR, 0) * GROW;
  // the running count of lines, at 1 m steps
  const xs = [];
  const run = [];
  let total = 0;
  for (let x = lo; x <= hi; x += 1) {
    xs.push(x);
    run.push(total);
    total += 1 / spacing(x + 0.5);
  }
  const n = Math.max(Math.round(total), 2);
  const lines = [lo];
  let j = 0;
  for (let i = 1; i < n; i++) {
    const want = (i / n) * total;
    while (j < run.length - 1 && run[j + 1] < want) j++;
    const t = run[j + 1] > run[j] ? (want - run[j]) / (run[j + 1] - run[j]) : 0;
    lines.push(xs[j] + t);
  }
  lines.push(hi);
  return lines;
}

export function buildTerrainGeometry(terrain, segments) {
  const fine = (TERRAIN_SIZE / segments) * 0.9;
  const half = TERRAIN_SIZE / 2;
  const gx = gridLines(TERRAIN_CENTER[0] - half, TERRAIN_CENTER[0] + half, fine);
  const gz = gridLines(TERRAIN_CENTER[1] - half, TERRAIN_CENTER[1] + half, fine);
  const nx = gx.length;
  const nz = gz.length;
  const position = new Float32Array(nx * nz * 3);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const k = (iz * nx + ix) * 3;
      position[k] = gx[ix];
      position[k + 1] = terrain.height(gx[ix], gz[iz]);
      position[k + 2] = gz[iz];
    }
  }
  const index = [];
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// The sand's height map, on an even grid of its own: point (ix, iz) at
// x0 + ix * step, z0 + iz * step. `sample` is a fast bilinear lookup for
// CPU ray casts; `texture` serves the same heights to shaders.
export function buildHeightField(terrain, segments) {
  const n = segments + 1;
  const step = TERRAIN_SIZE / segments;
  const x0 = TERRAIN_CENTER[0] - TERRAIN_SIZE / 2;
  const z0 = TERRAIN_CENTER[1] - TERRAIN_SIZE / 2;
  const heights = new Float32Array(n * n);
  const half = new Uint16Array(n * n);
  for (let i = 0; i < n * n; i++) {
    heights[i] = terrain.height(x0 + (i % n) * step, z0 + Math.floor(i / n) * step);
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
