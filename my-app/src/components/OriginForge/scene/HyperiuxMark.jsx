"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C, lerp } from "../timeline";
import { useAssets } from "../world/assets";
import { HOT, MOLTEN, ORANGE, traceMaterial } from "../world/shaders";
import { CUBE_EDGE, CUBE_LOCAL, CUBE_ROTATION, MARK_CENTER, PIECE_CENTERS, PIECE_IDS, pieceGeometry, traceEdges } from "../world/logo";

// The Hyperiux mark, forged. Its four pieces are the actual logo geometry
// (world/logo.js) extruded into obsidian: glowing edges trace each outline
// first, then the solid grows inside the trace, molten, and cools to dark
// stone with veins of light. The core settles in the joint as the cube.
//
// Then the mark becomes a gateway: the left and right halves part, the cube
// flares and dissolves, and the camera passes through the joint.

const OPEN_X = { A: -1, C: -1, B: 1, D: 1 };
const OPEN_DIST = 4.2;

export default function HyperiuxMark() {
  const { tex, keep } = useAssets();
  const group = useRef();
  const pieces = useRef({});
  const lines = useRef({});
  const cube = useRef();
  const cubeLines = useRef();
  const light = useRef();

  const res = useMemo(() => {
    const geos = Object.fromEntries(PIECE_IDS.map((id) => [id, keep(pieceGeometry(id))]));
    const edges = Object.fromEntries(PIECE_IDS.map((id) => [id, keep(traceEdges(geos[id]))]));
    const obsidian = keep(
      new THREE.MeshStandardMaterial({
        color: "#120f0d",
        metalness: 0.75,
        roughness: 0.22,
        emissive: ORANGE,
        emissiveMap: tex.cracks,
        emissiveIntensity: 0,
      })
    );
    const traceMat = keep(traceMaterial(MOLTEN.clone().multiplyScalar(2.6)));
    const cubeGeo = keep(new THREE.BoxGeometry(CUBE_EDGE, CUBE_EDGE, CUBE_EDGE));
    const cubeEdges = keep(traceEdges(cubeGeo, 1));
    const cubeMat = keep(new THREE.MeshBasicMaterial({ color: HOT.clone(), toneMapped: false, transparent: true }));
    const cubeTrace = keep(traceMaterial(HOT.clone().multiplyScalar(3)));
    return { geos, edges, obsidian, traceMat, cubeGeo, cubeEdges, cubeMat, cubeTrace };
  }, [tex.cracks, keep]);

  useEffect(() => {
    group.current.position.copy(MARK_CENTER);
  }, []);

  useFrame((state) => {
    const t = C.t;
    const visible = C.trace > 0.001 && t < 73.5;
    group.current.visible = visible;
    light.current.visible = visible;
    if (!visible) return;
    const time = state.clock.elapsedTime;
    const mark = C.mark;
    const open = C.open;
    const pulse = 0.92 + 0.08 * Math.sin(time * 2.4);

    for (const id of PIECE_IDS) {
      const m = pieces.current[id];
      const c = PIECE_CENTERS[id];
      const grow = Math.max(mark, 0.0001);
      m.scale.set(lerp(0.4, 1, grow), lerp(0.7, 1, grow), grow);
      m.visible = mark > 0.001;
      const ox = OPEN_X[id] * OPEN_DIST * open;
      m.position.set(c.x + ox, c.y, c.z);
      m.rotation.y = OPEN_X[id] * open * 0.22;
      const l = lines.current[id];
      l.position.copy(m.position);
      l.rotation.copy(m.rotation);
    }
    // molten while forming, cooling to obsidian, then re-lit for the gateway
    const forming = Math.sin(Math.PI * Math.min(1, mark)) * 4.5;
    res.obsidian.emissiveIntensity = (0.35 * mark + forming + C.hot * 2.6 + open * 2) * pulse;
    res.traceMat.uniforms.uProgress.value = C.trace * 1.02;
    res.traceMat.uniforms.uIntensity.value = (1 + C.hot * 1.4 + open) * (1 - C.disperse * 0.6);

    // the cube: the core, arrived and set in the joint; flares as the gate opens
    const cs = C.cube * (1 + open * 1.6) * (1 - Math.max(0, open - 0.6) / 0.4);
    cube.current.visible = cs > 0.001;
    cube.current.scale.setScalar(Math.max(cs, 0.0001));
    cube.current.rotation.set(CUBE_ROTATION.x, CUBE_ROTATION.y + open * 1.4, CUBE_ROTATION.z);
    res.cubeMat.color.copy(HOT).multiplyScalar((1.6 + C.hot * 2.5 + open * 5) * pulse);
    res.cubeMat.opacity = 0.85;
    res.cubeTrace.uniforms.uProgress.value = C.cube * 1.02;

    light.current.intensity = (mark * 50 + C.hot * 120 + open * 160) * pulse;
  });

  return (
    <group ref={group}>
      {PIECE_IDS.map((id) => (
        <group key={id}>
          <mesh ref={(el) => (pieces.current[id] = el)} geometry={res.geos[id]} material={res.obsidian} />
          <lineSegments ref={(el) => (lines.current[id] = el)} geometry={res.edges[id]} material={res.traceMat} />
        </group>
      ))}
      <group position={CUBE_LOCAL} ref={cube}>
        <mesh geometry={res.cubeGeo} material={res.cubeMat} scale={0.82} />
        <lineSegments ref={cubeLines} geometry={res.cubeEdges} material={res.cubeTrace} />
      </group>
      <pointLight ref={light} position={[0, 0, 3.5]} color="#ff7a18" distance={45} decay={2} intensity={0} />
    </group>
  );
}
