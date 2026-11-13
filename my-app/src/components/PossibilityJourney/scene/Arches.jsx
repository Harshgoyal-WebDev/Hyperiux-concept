"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ARCHES } from "../world/layout";
import { LIMESTONE, limestone } from "../world/materials";
import { T, setColor } from "../tuning";
import { portalShape, slab } from "../world/geometry";

// Chapter 03, the challenge: a passage of arches, each standing where it
// stands. The disconnection is told by the light, not by the stone: the
// orange path breaks into separate lengths along the passage, and the light
// falls between the arches in hard, separate bands.
const dummy = new THREE.Object3D();

export default function Arches({ tier }) {
  const mesh = useRef();
  const res = useMemo(() => {
    const geo = slab(portalShape({ width: 22, height: 17, half: 4.6, spring: 9 }), 1.5, 0.16);
    const mat = limestone(LIMESTONE, { key: "arch" });
    return { geo, mat };
  }, []);

  // each arch in its place, set once
  useEffect(() => {
    const m = mesh.current;
    ARCHES.forEach((a, i) => {
      dummy.position.set(0, 0, a.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, []);

  useFrame(() => setColor(res.mat.color, T.stone));

  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [res]
  );

  return <instancedMesh ref={mesh} args={[res.geo, res.mat, ARCHES.length]} castShadow={tier.shadows} receiveShadow={tier.shadows} />;
}
