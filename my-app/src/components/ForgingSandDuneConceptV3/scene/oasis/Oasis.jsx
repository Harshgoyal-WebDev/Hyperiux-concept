"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { T } from "../../tuning";
import { buildGroundMap } from "./groundMap";
import { buildRevealMap } from "../../world/revealMap";
import SeedCube from "./SeedCube";
import Rocks, { buildRockSet } from "../Rocks";
import { mulberry32 } from "../../world/layout";
import { S_RIM, TREE, floorHalfWidth, oasisAt, route } from "../../world/oasis";
import { S_LAND } from "../../world/oasisCamera";
import Water from "./Water";
import Vegetation from "./Vegetation";
import Yggdrasil from "./Yggdrasil";
import Streaks from "./Streaks";

// Past the mark: the passage through the dunes and the oasis it opens onto
// (its shape: world/oasis.js; the camera: world/oasisCamera.js). The
// terrain is carved for it already (world/layout.js); here are its ground
// (tinting the sand), its water, its plants, the Yggdrasil, and the energy
// streaks running on from the logo's core into the tree's.
// Rocks along the valley the camera travels (the same low boulders as on
// the hero's dunes — none of the tall shards): over its floor and up the
// dunes' feet, out of the stream and clear of the camera's line.
function valleyRocks(terrain, count = 70) {
  const rng = mulberry32(613);
  const rocks = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const o = {};
  const L = route.getLength();
  let guard = 0;
  while (rocks.length < count && guard++ < 20000) {
    const s = S_LAND - 120 + rng() * (S_RIM + 60 - (S_LAND - 120));
    route.getPointAt(Math.min(s / L, 1), p);
    route.getTangentAt(Math.min(s / L, 1), t);
    const lat = (rng() * 2 - 1) * (floorHalfWidth(s) + 18);
    const x = p.x - t.z * lat;
    const z = p.z + t.x * lat;
    oasisAt(x, z, o);
    if (!o.inside || o.w < 1.5 || o.d < 6 || o.basin) continue;
    const big = rng() < 0.08;
    rocks.push({
      position: [x, 0, z],
      scale: big ? 1.6 + rng() * 1.4 : 0.4 + rng() * 0.9,
      squash: 0.5 + rng() * 0.55,
      rotation: rng() * Math.PI * 2,
      variant: Math.floor(rng() * 3),
    });
  }
  return buildRockSet([], rocks, terrain);
}

export default function Oasis({ J, tier, shared, terrain, forge }) {
  const ground = useMemo(() => buildGroundMap(terrain), [terrain]);
  const rocks = useMemo(() => valleyRocks(terrain), [terrain]);
  // when each spot comes up: the sweep out from the cube (world/revealMap.js)
  const reveal = useMemo(() => buildRevealMap(), []);
  useEffect(() => {
    shared.uRevealMap.value = reveal.texture;
    shared.uRevealRect.value.copy(reveal.rect);
    return () => reveal.dispose();
  }, [shared, reveal]);
  useEffect(() => {
    shared.uOasisMap.value = ground.texture;
    shared.uOasisRect.value.copy(ground.rect);
    shared.uOasisOn.value = 1;
    return () => {
      shared.uOasisOn.value = 0;
      shared.uOasisMap.value = null;
      ground.texture.dispose();
    };
  }, [shared, ground]);

  // the tree arriving redraws the shadows
  const onTree = useCallback(() => {
    J.sceneVersion += 1;
  }, [J]);

  const shadowAt = useRef(-1);
  useFrame(() => {
    if (J.warmup > 0) J.warmup -= 1;
    // (the plants growing: redraw the shadows as the oasis comes up, every
    // so often on its clock, while it is still coming up)
    const growing = J.revealR > 0 && J.revealR < reveal.end + 160;
    if (growing && Math.abs(J.revealR - shadowAt.current) > 12) {
      shadowAt.current = J.revealR;
      J.sceneVersion += 1;
    }
    if (shared.uOasisGrass.userData !== T.grassColor) {
      shared.uOasisGrass.value.set(T.grassColor);
      shared.uOasisGrass.userData = T.grassColor;
    }
    if (shared.uOasisSoil.userData !== T.soilColor) {
      shared.uOasisSoil.value.set(T.soilColor);
      shared.uOasisSoil.userData = T.soilColor;
    }
  });

  return (
    <>
      <Water J={J} tier={tier} shared={shared} ground={ground} treePos={TREE.core} />
      <SeedCube J={J} />
      <Rocks rockSet={rocks} shared={shared} />
      <Vegetation J={J} tier={tier} shared={shared} terrain={terrain} />
      <Yggdrasil J={J} tier={tier} onReady={onTree} />
      {forge && <Streaks J={J} forge={forge} terrain={terrain} shared={shared} />}
    </>
  );
}
