"use client";
 

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { T, setColor } from "../tuning";
import { THEME } from "../theme";
import { BASIN, COURT, GALLERY_Z } from "../world/layout";
import { BEIGE, LIMESTONE, limestone, stoneUniforms } from "../world/materials";
import { bendX, curvedWall, oculusCeiling, portalShape, slab } from "../world/geometry";

const deg = THREE.MathUtils.degToRad;

// The architecture that stands still: one limestone world, from the
// sculptural shell of the opening to the courtyard. (The parts that move with
// the story have their own components: the arches of the challenge, the
// glass slabs, the gallery's planes, the tree, the basin's water.)
export default function Architecture({ tier }) {
  const res = useMemo(() => {
    const stone = limestone(LIMESTONE, { key: "wall" });
    const stoneWarm = limestone(BEIGE, { key: "warm", roughness: 0.9 });
    const geos = [];
    const g = (x) => (geos.push(x), x);

    // 01: the shell, a bent wall with an elliptical opening to the sky
    const shell = g(bendX(slab(portalShape({ width: 78, height: 32, half: 11.5, ellipse: { ry: 21.5 }, segments: 96 }), 3.2, 0.3, 96), 58));
    const shellRight = g(curvedWall({ cx: 34, cz: 20, R: 21, thick: 1.6, a0: deg(150), a1: deg(232), height: 27 }));
    const shellLeft = g(curvedWall({ cx: -30, cz: 26, R: 19, thick: 1.4, a0: deg(-42), a1: deg(38), height: 7 }));

    // 02: sweeping walls along the path
    const pathLeft = g(curvedWall({ cx: -34, cz: -50, R: 23.5, thick: 1.5, a0: deg(-58), a1: deg(64), height: 18 }));
    const pathRight = g(curvedWall({ cx: 33, cz: -72, R: 22, thick: 1.5, a0: deg(118), a1: deg(246), height: 23 }));
    const pathLow = g(curvedWall({ cx: 14, cz: -26, R: 9, thick: 0.9, a0: deg(140), a1: deg(250), height: 1.1, bevel: 0.12 }));

    // 03: the passage's long wall (the arches stand across it)
    const passageWall = g(new THREE.BoxGeometry(1.4, 17, 78));

    // 04: the hall, curved walls behind the slabs (a gap toward the gallery)
    const hallA = g(curvedWall({ cx: 4, cz: -198, R: 30, thick: 1.6, a0: deg(198), a1: deg(256), height: 20 }));
    const hallB = g(curvedWall({ cx: 4, cz: -198, R: 30, thick: 1.6, a0: deg(284), a1: deg(338), height: 20 }));

    // 05: the gallery: a long wall and a roof split by a skylight
    const galleryWall = g(new THREE.BoxGeometry(1.2, 11, 70));
    const roofA = g(new THREE.BoxGeometry(12.5, 0.9, 66));
    const roofB = g(new THREE.BoxGeometry(9, 0.9, 66));

    // 06: the courtyard and its great oculus; the tree's basin of water
    const courtA = g(curvedWall({ cx: COURT.cx, cz: COURT.cz, R: COURT.R, thick: 1.8, a0: deg(104), a1: deg(256), height: COURT.height }));
    const courtB = g(curvedWall({ cx: COURT.cx, cz: COURT.cz, R: COURT.R, thick: 1.8, a0: deg(-76), a1: deg(76), height: COURT.height }));
    const courtCeil = g(oculusCeiling({ R: COURT.R + 2.2, r: COURT.oculus, thick: 1.4 }));
    const basin = g(curvedWall({ cx: COURT.cx, cz: COURT.cz, R: BASIN.R, thick: BASIN.wall, a0: 0, a1: Math.PI * 2, height: BASIN.rim, bevel: 0.1, segments: 192 }));
    // its floor, under the water
    const basinFloor = g(new THREE.CircleGeometry(BASIN.R + 0.05, 96));

    return { stone, stoneWarm, geos, shell, shellRight, shellLeft, pathLeft, pathRight, pathLow, passageWall, hallA, hallB, galleryWall, roofA, roofB, courtA, courtB, courtCeil, basin, basinFloor };
  }, []);

  useEffect(
    () => () => {
      res.geos.forEach((x) => x.dispose());
      [res.stone, res.stoneWarm].forEach((m) => m.dispose());
    },
    [res]
  );

  useFrame(() => {
    setColor(res.stone.color, T.stone);
    setColor(res.stoneWarm.color, T.stoneDark);
    stoneUniforms.uStone.value = T.stoneVariation;
  });

  const shadow = { castShadow: tier.shadows, receiveShadow: tier.shadows };
  const S = res.stone;
  const W = res.stoneWarm;
  return (
    <group>
      <Floor tier={tier} />

      {/* 01 */}
      <mesh geometry={res.shell} material={S} {...shadow} />
      <mesh geometry={res.shellRight} material={W} {...shadow} />
      <mesh geometry={res.shellLeft} material={S} {...shadow} />

      {/* 02 */}
      <mesh geometry={res.pathLeft} material={S} {...shadow} />
      <mesh geometry={res.pathRight} material={W} {...shadow} />
      <mesh geometry={res.pathLow} material={S} {...shadow} />

      {/* 03 */}
      <mesh geometry={res.passageWall} material={S} position={[-11.6, 8.5, -134]} {...shadow} />

      {/* 04 */}
      <mesh geometry={res.hallA} material={W} {...shadow} />
      <mesh geometry={res.hallB} material={W} {...shadow} />

      {/* 05 */}
      <mesh geometry={res.galleryWall} material={S} position={[-12.5, 5.5, GALLERY_Z]} {...shadow} />
      <mesh geometry={res.roofA} material={S} position={[-6.5, 11.4, GALLERY_Z]} {...shadow} />
      <mesh geometry={res.roofB} material={S} position={[7.6, 11.4, GALLERY_Z]} {...shadow} />

      {/* 06 */}
      <mesh geometry={res.courtA} material={W} {...shadow} />
      <mesh geometry={res.courtB} material={W} {...shadow} />
      <mesh geometry={res.courtCeil} material={S} position={[COURT.cx, COURT.height, COURT.cz]} {...shadow} />
      <mesh geometry={res.basin} material={S} {...shadow} />
      <mesh geometry={res.basinFloor} rotation-x={-Math.PI / 2} position={[COURT.cx, 0.04, COURT.cz]} receiveShadow={tier.shadows}>
        <meshStandardMaterial color={THEME.name === "dark" ? "#1a1b1e" : "#9c8a78"} roughness={0.9} />
      </mesh>
    </group>
  );
}

// The floor: polished limestone. On desktop it softly mirrors the
// architecture (a blurred planar reflection); elsewhere it is matte.
function Floor({ tier }) {
  const mat = useRef();
  useFrame(() => {
    const m = mat.current;
    if (!m) return;
    setColor(m.color, T.floor);
    if (m.mixStrength !== undefined) m.mixStrength = T.floorReflection * 1.6;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, -160]} receiveShadow={tier.shadows}>
      <planeGeometry args={[240, 470]} />
      {tier.reflections ? (
        <MeshReflectorMaterial
          ref={mat}
          resolution={512}
          blur={[160, 50]}
          mixBlur={0.9}
          mixStrength={0.9}
          mixContrast={1}
          mirror={0.6}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          roughness={THEME.floor.roughness}
          metalness={THEME.floor.metalness}
          color="#0f1013"
        />
      ) : (
        <meshStandardMaterial ref={mat} color="#0f1013" roughness={THEME.floor.roughness * 0.8} metalness={THEME.floor.metalness} />
      )}
    </mesh>
  );
}
