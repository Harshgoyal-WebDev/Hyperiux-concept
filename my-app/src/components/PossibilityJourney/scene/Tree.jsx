"use client";
 

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { C } from "../timeline";
import { COURT } from "../world/layout";
import { THEME } from "../theme";
import { mulberry32 } from "../../OriginForge/world/textures";

// Chapter 07, the possibilities: one living thing in the courtyard, under
// the open sky. A tree grown from a seed: a trunk dividing into tapering
// limbs, and a crown of warm orange leaves (instanced), which unfold as the
// visitor enters (`tree`).
const UP = new THREE.Vector3(0, 1, 0);

function grow(rand) {
  const limbs = [];
  const tips = [];
  const branch = (from, dir, len, radius, depth) => {
    const to = from.clone().addScaledVector(dir, len);
    limbs.push({ from, to, r0: radius, r1: radius * 0.68 });
    if (depth === 0) {
      tips.push(to);
      return;
    }
    const n = depth > 2 ? 2 : 2 + (rand() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const spread = 0.42 + rand() * 0.38;
      const turn = (k / n) * Math.PI * 2 + rand() * 1.2;
      const axis = new THREE.Vector3(Math.cos(turn), 0, Math.sin(turn)).cross(dir).normalize();
      const d = dir.clone().applyAxisAngle(axis, spread).lerp(UP, 0.18).normalize();
      branch(to, d, len * (0.68 + rand() * 0.14), radius * 0.66, depth - 1);
    }
  };
  // a trunk with a slight lean, dividing low
  branch(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0.06, 1, 0.03).normalize(), 2.6, 0.32, 5);
  return { limbs, tips };
}

function limbGeometry(limbs) {
  const parts = limbs.map(({ from, to, r0, r1 }) => {
    const len = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1, false);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize());
    g.applyQuaternion(q);
    g.translate(from.x, from.y, from.z);
    return g;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return merged;
}

const dummy = new THREE.Object3D();
const LEAF_COLORS = ["#ff6a00", "#ff7e1f", "#ff9133", "#f05a0a", "#ffa54d", "#e9620f"].map((c) => new THREE.Color(c));

export default function Tree({ tier }) {
  const group = useRef();
  const leaves = useRef();
  const grown = useRef(-1);
  const res = useMemo(() => {
    const rand = mulberry32(8);
    const { limbs, tips } = grow(rand);
    const wood = limbGeometry(limbs);
    const woodMat = new THREE.MeshStandardMaterial({ color: THEME.tree.wood, roughness: 0.9 });
    // the crown: clusters of leaves round each tip
    const count = tier.post ? 4200 : 1800;
    const leafGeo = new THREE.IcosahedronGeometry(0.095, 0);
    leafGeo.scale(1, 0.55, 1.25);
    const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, emissive: new THREE.Color("#ff5f00"), emissiveIntensity: THEME.tree.glow });
    const items = [];
    for (let i = 0; i < count; i++) {
      const tip = tips[Math.floor(rand() * tips.length)];
      const r = Math.pow(rand(), 0.6) * 1.35;
      const a = rand() * Math.PI * 2;
      const b = Math.acos(2 * rand() - 1);
      const p = tip.clone().add(new THREE.Vector3(Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r * 0.65 + 0.25, Math.sin(b) * Math.sin(a) * r));
      items.push({ p, rot: [rand() * 6, rand() * 6, rand() * 6], s: 0.75 + rand() * 0.6, delay: rand(), phase: rand() * 6 });
    }
    return { wood, woodMat, leafGeo, leafMat, items };
  }, [tier.post]);

  useEffect(() => {
    const m = leaves.current;
    res.items.forEach((it, i) => m.setColorAt(i, LEAF_COLORS[i % LEAF_COLORS.length]));
    m.instanceColor.needsUpdate = true;
  }, [res]);

  useEffect(
    () => () => {
      res.wood.dispose();
      res.woodMat.dispose();
      res.leafGeo.dispose();
      res.leafMat.dispose();
    },
    [res]
  );

  useFrame(() => {
    const on = C.t > 66;
    group.current.visible = on;
    if (!on) return;
    const k = C.tree;
    // (thousands of leaves: rewritten only when the tree's growth changes)
    if (Math.abs(k - grown.current) < 1e-4) return;
    grown.current = k;
    const m = leaves.current;
    res.items.forEach((it, i) => {
      const g = THREE.MathUtils.smoothstep(k, it.delay * 0.6, it.delay * 0.6 + 0.4);
      dummy.position.copy(it.p);
      dummy.rotation.set(it.rot[0], it.rot[1], it.rot[2]);
      dummy.scale.setScalar(Math.max(0.0001, it.s * g));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group} position={[COURT.cx, 0, COURT.cz]}>
      <mesh geometry={res.wood} material={res.woodMat} castShadow={tier.shadows} receiveShadow={tier.shadows} />
      <instancedMesh ref={leaves} args={[res.leafGeo, res.leafMat, res.items.length]} castShadow={tier.shadows} frustumCulled={false} />
    </group>
  );
}
