"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { T } from "../../tuning";
import { OUTCROPS, buildRuins, fragmentGeometry } from "../../world/ruins";
import { CONTACT_SLOTS } from "../../world/materials";

// The ruins (world/ruins.js): one merged mesh of sandstone pillars, broken
// slabs and the arch, standing on the dunes; and low outcrops of broken
// sandstone in the foreground. Static: they cast their shadows
// into the sun's map once, and leave soft contact shadows on the sand
// (the sand material's uContact).
export default function Ruins({ J, shared, terrain, material, rockMaterial }) {
  const ruins = useMemo(() => buildRuins(terrain), [terrain]);
  useEffect(
    () => () => {
      ruins.geometry.dispose();
      ruins.arch.dispose();
    },
    [ruins]
  );

  useEffect(() => {
    if (ruins.contacts.length > CONTACT_SLOTS) console.warn("[forging-vid] more ruins than contact-shadow slots");
    // (their shadows drawn into the sun's map: Rig.jsx Lights)
    J.sceneVersion += 1;
  }, [ruins, J]);
  // their contact shadows on the sand, while they are shown (T.showRuins)
  const shown = useRef(null);
  useFrame(() => {
    const on = !!T.showRuins;
    if (shown.current === on) return;
    shown.current = on;
    shared.uContact.value.forEach((v, i) => {
      const c = on && ruins.contacts[i];
      if (c) v.set(c[0], c[1], c[2], c[3]);
      else v.set(0, 0, 1, 0);
    });
  });

  return (
    <>
      <mesh geometry={ruins.geometry} material={material} castShadow receiveShadow />
      <mesh geometry={ruins.arch} material={material} receiveShadow />
      <Outcrops J={J} terrain={terrain} material={rockMaterial} />
    </>
  );
}

// Low outcrops of broken sandstone in the foreground: craggy pieces
// (world/ruins.js fragmentGeometry) half sunk in the sand, flattened and
// leaning, in small groups. Instanced, one draw per shape.
function Outcrops({ J, terrain, material }) {
  const groups = useMemo(() => {
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    return [0, 1].map((shape) => {
      const list = OUTCROPS.filter((o) => o[5] % 2 === shape);
      const geometry = fragmentGeometry(907 + shape * 31);
      geometry.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1));
      geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(list.map((_, i) => 0.3 + i * 0.17 + shape * 0.5)), 1));
      const matrices = list.map(([x, z, s, squash, turn]) =>
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, terrain.height(x, z) - s * squash * 0.3, z),
          q.setFromEuler(e.set((turn % 1) * 0.3, turn, ((turn * 7) % 1) * 0.25)),
          new THREE.Vector3(s * 1.3, s * squash * 1.4, s)
        )
      );
      return { geometry, matrices };
    });
  }, [terrain]);
  useEffect(() => () => groups.forEach((g) => g.geometry.dispose()), [groups]);
  return groups.map((g, i) => <OutcropGroup key={i} J={J} geometry={g.geometry} material={material} matrices={g.matrices} />);
}

function OutcropGroup({ J, geometry, material, matrices }) {
  const ref = useRef();
  useLayoutEffect(() => {
    if (!ref.current) return;
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m));
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
    J.sceneVersion += 1;
  }, [matrices, J]);
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} castShadow receiveShadow />;
}
