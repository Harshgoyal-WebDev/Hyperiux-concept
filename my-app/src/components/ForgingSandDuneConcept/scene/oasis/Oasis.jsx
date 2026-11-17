"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { T } from "../../tuning";
import { REVEAL_ORIGIN, TREE } from "../../world/oasis";
import { buildGroundMap } from "./groundMap";
import Water from "./Water";
import Vegetation from "./Vegetation";
import Yggdrasil from "./Yggdrasil";
import Streaks from "./Streaks";

// Past the mark: the passage through the dunes and the oasis it opens onto
// (its shape: world/oasis.js; the camera: world/oasisCamera.js). The
// terrain is carved for it already (world/layout.js); here are its ground
// (tinting the sand), its water, its plants, the Yggdrasil, and the energy
// streaks running on from the logo's core into the tree's.
export default function Oasis({ J, tier, shared, terrain, forge }) {
  const ground = useMemo(() => buildGroundMap(terrain), [terrain]);
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
  const { camera } = useThree();
  useFrame(() => {
    if (J.warmup > 0) J.warmup -= 1;
    // (the plants growing: redraw the shadows as the front spreads — only
    // while it is near enough to be seen, every so many metres)
    const near = Math.abs(Math.hypot(camera.position.x - REVEAL_ORIGIN.x, camera.position.z - REVEAL_ORIGIN.y) - J.revealR) < 220;
    if (near && Math.abs(J.revealR - shadowAt.current) > 14) {
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
      <Vegetation J={J} tier={tier} shared={shared} terrain={terrain} />
      <Yggdrasil J={J} tier={tier} onReady={onTree} />
      {forge && <Streaks J={J} forge={forge} terrain={terrain} shared={shared} />}
    </>
  );
}
