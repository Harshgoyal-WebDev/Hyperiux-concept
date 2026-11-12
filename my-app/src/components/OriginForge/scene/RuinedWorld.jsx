"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "../timeline";
import { useAssets } from "../world/assets";
import { mulberry32 } from "../world/textures";
import { ORANGE } from "../world/shaders";
import { T, setColor } from "../tuning";

// The forgotten civilisation: a ruined ring-arch of cut blocks framing the
// glow, monoliths and broken columns in the fog, fallen stones on a dark
// polished floor, and debris suspended in the air. Everything repeated is
// instanced: a handful of draw calls for the whole field.

const dummy = new THREE.Object3D();

// a ring of blocks standing upright, some missing, some slipped
function archBlocks(rand, cx, cy, cz, R, count, { missing = [], slipped = [], scale = 1, yaw = 0 } = {}) {
  const out = [];
  for (let k = 0; k < count; k++) {
    if (missing.includes(k)) continue;
    const a = (k / count) * Math.PI * 2;
    const x = Math.cos(a) * R;
    const y = Math.sin(a) * R;
    if (cy + y < -0.5) continue;
    const slip = slipped.includes(k) ? 1 : 0;
    const local = new THREE.Vector3(x + slip * (rand() - 0.5) * 0.8, y - slip * 0.6, slip * (rand() - 0.5) * 1.2);
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    out.push({
      p: [cx + local.x, cy + local.y, cz + local.z],
      r: [slip * (rand() - 0.5) * 0.3, yaw, a + Math.PI / 2 + slip * (rand() - 0.5) * 0.4],
      s: [((2 * Math.PI * R) / count) * 0.94 * scale, 2.2 * scale, 2.6 * scale],
    });
  }
  return out;
}

export default function RuinedWorld() {
  const { mat, tex } = useAssets();
  const group = useRef();
  const debrisRef = useRef();
  const arcGlowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(1.6), map: tex.runes, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    [tex.runes]
  );

  const data = useMemo(() => {
    const rand = mulberry32(2026);
    const blocks = [
      // the great arch, broken at its upper right
      ...archBlocks(rand, 0, 8.4, 24, 8.4, 30, { missing: [4, 5, 6], slipped: [3, 7, 11, 27] }),
      // distant arches, half sunk
      ...archBlocks(rand, -46, 5, -40, 11, 30, { missing: [7, 8, 9, 10, 20], slipped: [6, 11], scale: 1.3, yaw: 0.9 }),
      ...archBlocks(rand, 52, 3, -18, 9, 26, { missing: [3, 4, 14, 15, 16], slipped: [2, 5, 13], scale: 1.2, yaw: -1.1 }),
      ...archBlocks(rand, 18, 7, -90, 13, 34, { missing: [9, 10, 11], slipped: [8, 12], scale: 1.4, yaw: 0.2 }),
    ];
    // fallen blocks under the great arch
    for (let k = 0; k < 6; k++) {
      blocks.push({
        p: [4 + rand() * 7, 0.7, 20 + rand() * 7],
        r: [rand() * 0.6, rand() * Math.PI, rand() * 0.6],
        s: [1.6 + rand(), 1.4 + rand() * 0.8, 2.2],
      });
    }

    // monoliths and wall fragments: around the plaza, kept off the camera's path
    const slabs = [];
    let guard = 0;
    while (slabs.length < 70 && guard++ < 2000) {
      const a = rand() * Math.PI * 2;
      const r = 22 + Math.pow(rand(), 0.7) * 70;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 6;
      if (Math.abs(x) < 13 && z > -8 && z < 70) continue; // the approach
      if (Math.abs(x) < 16 && z < -6 && z > -80) continue; // the corridor
      const h = 7 + Math.pow(rand(), 1.6) * 30;
      const wall = rand() < 0.35;
      slabs.push({
        p: [x, h / 2 - 0.5 - rand() * 2, z],
        r: [(rand() - 0.5) * 0.12, rand() * Math.PI, (rand() - 0.5) * (rand() < 0.2 ? 0.5 : 0.1)],
        s: wall ? [5 + rand() * 9, h * 0.7, 1.2 + rand()] : [1.6 + rand() * 2.6, h, 1.6 + rand() * 2.6],
      });
    }

    // broken columns
    const columns = [];
    guard = 0;
    while (columns.length < 26 && guard++ < 1000) {
      const x = (rand() - 0.5) * 120;
      const z = (rand() - 0.5) * 120;
      if (Math.abs(x) < 14 && z > -80 && z < 70) continue;
      if (Math.hypot(x, z) < 18) continue;
      const h = 3 + rand() * 12;
      const fallen = rand() < 0.25;
      columns.push({
        p: [x, fallen ? 1 : h / 2, z],
        r: fallen ? [Math.PI / 2, rand() * Math.PI, 0] : [0, rand() * Math.PI, (rand() - 0.5) * 0.08],
        s: [1, fallen ? h * 0.6 : h, 1],
      });
    }

    // stones on the floor
    const rubble = [];
    for (let k = 0; k < 220; k++) {
      const a = rand() * Math.PI * 2;
      const r = 8 + rand() * 60;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r + 6;
      if (Math.abs(x) < 4 && z > 10 && z < 64) continue;
      const s = 0.15 + Math.pow(rand(), 3) * 1.4;
      rubble.push({ p: [x, s * 0.3, z], r: [rand() * 3, rand() * 3, rand() * 3], s: [s, s * 0.7, s * 1.1] });
    }

    // debris suspended in the air (animated)
    const debris = [];
    for (let k = 0; k < 140; k++) {
      const a = rand() * Math.PI * 2;
      const r = 10 + rand() * 48;
      const s = 0.12 + Math.pow(rand(), 2.5) * 1.1;
      debris.push({
        base: [Math.cos(a) * r, 4 + rand() * 22, Math.sin(a) * r - 4],
        rot: [rand() * 6, rand() * 6, rand() * 6],
        spin: [(rand() - 0.5) * 0.2, (rand() - 0.5) * 0.2],
        bob: rand() * 6,
        s: [s, s * (0.6 + rand() * 0.8), s * (0.7 + rand())],
      });
    }
    return { blocks, slabs, columns, rubble, debris };
  }, []);

  const blocksRef = useRef();
  const slabsRef = useRef();
  const columnsRef = useRef();
  const rubbleRef = useRef();

  useEffect(() => {
    const meshes = { blocks: blocksRef.current, slabs: slabsRef.current, columns: columnsRef.current, rubble: rubbleRef.current };
    for (const name of Object.keys(meshes)) {
      const mesh = meshes[name];
      data[name].forEach((d, i) => {
        dummy.position.set(...d.p);
        dummy.rotation.set(...d.r);
        dummy.scale.set(...d.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [data]);

  useFrame((state) => {
    const t = C.t;
    // the world falls away behind the corridor and the light
    group.current.visible = t < 77;
    if (!group.current.visible) return;
    const time = state.clock.elapsedTime;
    mat.floor.emissiveIntensity = 0.05 + 0.5 * C.markings + 0.25 * C.pillar[0] * (1 - C.gather);
    setColor(mat.ruinStone.color, T.stoneColor);
    mat.ruinStone.emissiveIntensity = (0.04 + 0.25 * C.core) * T.stoneGlow;
    arcGlowMat.opacity = 0.25 + 0.75 * C.horizon;
    // debris: a slow drift (only while it can be seen)
    const mesh = debrisRef.current;
    data.debris.forEach((d, i) => {
      dummy.position.set(d.base[0], d.base[1] + Math.sin(time * 0.3 + d.bob) * 0.35, d.base[2]);
      dummy.rotation.set(d.rot[0] + time * d.spin[0], d.rot[1] + time * d.spin[1], d.rot[2]);
      dummy.scale.set(...d.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group}>
      {/* the floor of the plaza is water (Water.jsx) */}
      <instancedMesh ref={blocksRef} args={[null, null, data.blocks.length]} material={mat.ruinStone}>
        <boxGeometry />
      </instancedMesh>
      {/* the light inside the great arch's ring */}
      <mesh position={[0, 8.4, 22.6]} material={arcGlowMat}>
        <ringGeometry args={[7.0, 7.25, 96, 1, Math.PI * 0.62, Math.PI * 1.72]} />
      </mesh>
      <instancedMesh ref={slabsRef} args={[null, null, data.slabs.length]} material={mat.ruinStone}>
        <boxGeometry />
      </instancedMesh>
      <instancedMesh ref={columnsRef} args={[null, null, data.columns.length]} material={mat.ruinStone}>
        <cylinderGeometry args={[0.9, 1.0, 1, 8]} />
      </instancedMesh>
      <instancedMesh ref={rubbleRef} args={[null, null, data.rubble.length]} material={mat.ruinStone}>
        <dodecahedronGeometry args={[1, 0]} />
      </instancedMesh>
      <instancedMesh ref={debrisRef} args={[null, null, data.debris.length]} material={mat.ruinStone} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
      </instancedMesh>
    </group>
  );
}
