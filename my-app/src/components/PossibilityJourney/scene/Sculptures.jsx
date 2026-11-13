"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "../timeline";
import { curvedWall } from "../world/geometry";
import { panelMetal } from "../world/materials";

// The sculptures of the land: great blocks of paneled metal hanging in the
// air, tilted, each burning along an edge (they turn slowly as the visitor
// goes on: their turn is the scroll's, so it reverses exactly), and broad
// arcs of the same metal, curved bands standing and leaning in the dusk,
// their inner edges traced in orange light. Placed where the journey's
// openings frame them, clear of the way.

// floating blocks: position, size (w, h, d), base rotation, how much the scroll turns it
const BLOCKS = [
  { p: [-26, 15, -38], s: [4.2, 9, 3], r: [0.18, 0.4, -0.22], spin: 0.5 },
  { p: [-34, 22, -64], s: [5, 11, 3.6], r: [-0.22, 0.9, 0.26], spin: -0.4 },
  { p: [30, 18, -52], s: [4.6, 10, 3.2], r: [0.12, -0.5, 0.32], spin: 0.45 },
  { p: [40, 26, -80], s: [5.2, 12, 3.6], r: [-0.26, 0.3, -0.16], spin: -0.35 },
  { p: [4, 34, -122], s: [6, 13, 4], r: [0.22, 0.6, 0.12], spin: 0.3 },
  { p: [-22, 27, -150], s: [4.6, 10, 3.2], r: [-0.14, -0.3, 0.3], spin: -0.5 },
  { p: [-30, 26, -208], s: [5, 11, 3.4], r: [0.2, 0.7, -0.18], spin: 0.4 },
  { p: [34, 22, -230], s: [5.6, 12, 3.8], r: [-0.18, -0.6, 0.22], spin: -0.4 },
  { p: [30, 20, -266], s: [5, 11, 3.6], r: [0.24, 0.2, -0.28], spin: 0.35 },
  { p: [42, 30, -292], s: [6, 13, 4.2], r: [-0.1, 0.8, 0.2], spin: -0.3 },
  { p: [-28, 25, -360], s: [5.4, 12, 3.6], r: [0.16, -0.4, -0.24], spin: 0.4 },
  { p: [24, 30, -372], s: [5, 11, 3.4], r: [-0.22, 0.5, 0.18], spin: -0.45 },
];

// arcs: centre, radius, band (thick, height), sweep (deg), turn and lean
const ARCS = [
  { p: [-42, 0.5, -16], R: 9, thick: 1.5, height: 4.8, a0: 30, a1: 300, ry: 0.7, rx: 0.12 },
  { p: [-46, 2, -96], R: 11, thick: 1.6, height: 5.4, a0: 60, a1: 330, ry: -0.4, rx: -0.42 },
  { p: [44, 1, -140], R: 10, thick: 1.5, height: 5, a0: 200, a1: 470, ry: 0.3, rx: 0.3 },
  { p: [38, 0.5, -278], R: 12, thick: 1.8, height: 6, a0: 120, a1: 400, ry: -0.6, rx: 0.18 },
  { p: [52, 4, -310], R: 8, thick: 1.4, height: 4.4, a0: 0, a1: 260, ry: 1.1, rx: -0.5 },
  { p: [-40, 1, -300], R: 10, thick: 1.6, height: 5.2, a0: 250, a1: 520, ry: 0.4, rx: 0.36 },
];

const dummy = new THREE.Object3D();
const deg = THREE.MathUtils.degToRad;

export default function Sculptures({ tier }) {
  const blocks = useRef();
  const res = useMemo(() => {
    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    blockGeo.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(BLOCKS.map((_, i) => (i % 3 === 1 ? 0.5 : 1))), 1));
    const metal = panelMetal("#3a3734", { key: "sculpt" });
    const arcMetal = panelMetal("#36332f", { key: "arc", roughness: 0.3 });
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff5f00").multiplyScalar(4.5), toneMapped: false });
    const arcs = ARCS.map((a) => {
      const geo = curvedWall({ cx: 0, cz: 0, R: a.R, thick: a.thick, a0: deg(a.a0), a1: deg(a.a1), height: a.height, bevel: 0.12, segments: 120 });
      // the inner edge, top and bottom, traced in light
      const edge = (y) => {
        const pts = [];
        for (let i = 0; i <= 140; i++) {
          const t = deg(a.a0 + ((a.a1 - a.a0) * i) / 140);
          pts.push(new THREE.Vector3(Math.cos(t) * (a.R - 0.03), y, Math.sin(t) * (a.R - 0.03)));
        }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 280, 0.1, 8, false);
      };
      return { ...a, geo, top: edge(a.height + 0.1), bottom: edge(0.18) };
    });
    return { blockGeo, metal, arcMetal, glowMat, arcs };
  }, []);

  useEffect(
    () => () => {
      res.blockGeo.dispose();
      res.metal.dispose();
      res.arcMetal.dispose();
      res.glowMat.dispose();
      res.arcs.forEach((a) => [a.geo, a.top, a.bottom].forEach((g) => g.dispose()));
    },
    [res]
  );

  // the floating blocks, turned by the scroll
  useFrame(() => {
    const m = blocks.current;
    const k = C.t * 0.012;
    BLOCKS.forEach((b, i) => {
      dummy.position.set(b.p[0], b.p[1] + Math.sin(k * 2 + i) * 0.6, b.p[2]);
      dummy.rotation.set(b.r[0], b.r[1] + k * b.spin * 6, b.r[2]);
      dummy.scale.set(...b.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={blocks} args={[res.blockGeo, res.metal, BLOCKS.length]} castShadow={tier.shadows} frustumCulled={false} />
      {res.arcs.map((a, i) => (
        <group key={i} position={a.p} rotation={[a.rx, a.ry, 0]}>
          <mesh geometry={a.geo} material={res.arcMetal} castShadow={tier.shadows} receiveShadow={tier.shadows} />
          <mesh geometry={a.top} material={res.glowMat} />
          <mesh geometry={a.bottom} material={res.glowMat} />
        </group>
      ))}
    </group>
  );
}
