"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import { createSharedUniforms } from "../world/materials";
import { buildScatter, buildShards, createTerrainSampler } from "../world/layout";
import { ASSETS, FORGE, P } from "../config";
import Sky from "./Sky";
import Terrain, { buildHeightField, buildTerrainGeometry } from "./Terrain";
import SandField from "./SandField";
import Forge from "./Forge";
import ForgeBeam from "./ForgeBeam";
import CrumbleSand from "./CrumbleSand";
import Gravel from "./Gravel";
import BreakupStir from "./BreakupStir";
import Rocks, { buildRockSet } from "./Rocks";
import { CameraRig, Dust, Lights, Post, UniformSync } from "./Rig";
import WorldSwitch from "./WorldSwitch";
import Garden from "./garden/Garden";
import { getAudio } from "../audio";
import { Q, QUALITY_EVENT } from "../quality";
import Governor from "./Governor";
import { gardenFetched } from "../loading";

// Feeds the journey state to the score and sound effects every frame.
function SoundDriver({ J }) {
  useFrame((_, delta) => getAudio()?.update(J, Math.min(delta, 0.1)));
  return null;
}

// The garden (a large GLB) is built once the forge is in and its file has
// arrived (the loader fetches both up front) — or a little later at most, or
// at once if the journey is already heading for it (a deep link, a fast
// scroll) — so it is ready, compiled and hidden behind the loader.
function useGardenGate(J, forgeReady) {
  const [open, setOpen] = useState(false);
  const readyAt = useRef(0);
  useEffect(() => {
    if (!forgeReady) return;
    useGLTF.preload(ASSETS.gardenGlb, ASSETS.draco);
    readyAt.current = performance.now();
  }, [forgeReady]);
  useFrame(() => {
    if (open || !forgeReady) return;
    if (gardenFetched() || J.progress > P.core || performance.now() - readyAt.current > 2500) setOpen(true);
  });
  return open;
}

// Lowest sand under the slab's footprint (50 × 12 m around the origin), so
// the base is buried everywhere rather than floating over a hollow.
function footprintGround(terrain) {
  let min = Infinity;
  const hw = 5.3 * FORGE.scale;
  const hd = 1.4 * FORGE.scale;
  for (let x = -hw; x <= hw; x += 2) {
    for (let z = -hd; z <= hd; z += 2) min = Math.min(min, terrain.height(x, z));
  }
  return min;
}

export default function Scene({ J, tier, withForge = true, onMissing }) {
  const shared = useMemo(() => createSharedUniforms(), []);
  const terrain = useMemo(() => createTerrainSampler(), []);
  const envSky = useMemo(() => ({ uNight: { value: 0 } }), []);
  const terrainGeometry = useMemo(() => buildTerrainGeometry(terrain, tier.terrainSegments), [terrain, tier]);
  const heightField = useMemo(() => buildHeightField(terrain, tier.terrainSegments), [terrain, tier]);
  const groundY = useMemo(() => footprintGround(terrain), [terrain]);
  const rockSet = useMemo(() => {
    const shards = buildShards();
    return buildRockSet(shards, buildScatter(shards), terrain);
  }, [terrain]);
  useEffect(
    () => () => {
      terrainGeometry.dispose();
      heightField.texture.dispose();
    },
    [terrainGeometry, heightField],
  );

  const [forge, setForge] = useState(null);
  // the post passes, while the live quality keeps them (quality.js)
  const [post, setPost] = useState(Q.post);
  useEffect(() => {
    const sync = () => setPost(Q.post);
    window.addEventListener(QUALITY_EVENT, sync);
    return () => window.removeEventListener(QUALITY_EVENT, sync);
  }, []);
  const onReady = useCallback(
    (f, missing) => {
      setForge(f);
      // (J is the journey's plain mutable state, written outside render)
      // eslint-disable-next-line react-hooks/immutability
      J.forgeReady = true;
      if (!f) onMissing?.(missing);
    },
    [onMissing, J],
  );

  // the two worlds (see WorldSwitch)
  const desert = useRef();
  const worlds = useMemo(() => ({ garden: null, gardenActive: false }), []);
  const gardenOpen = useGardenGate(J, !!forge);

  return (
    <>
      <group ref={desert}>
        <Sky shared={shared} />
        {/* sunset reflections for the stone, rendered once. Its sky has its
          own fixed uniforms: drei re-captures on re-render. */}
        <Environment frames={1} resolution={64}>
          <Sky shared={envSky} />
        </Environment>
        <Terrain shared={shared} geometry={terrainGeometry} />
        <Rocks rockSet={rockSet} shared={shared} />
        {withForge && (
          <Suspense fallback={null}>
            <Forge J={J} shared={shared} groundY={groundY} onReady={onReady} />
          </Suspense>
        )}

        <Lights J={J} tier={tier} shared={shared} />
        {forge && (
          <>
            <ForgeBeam terrain={terrain} forge={forge} J={J} shared={shared} />
            <CrumbleSand J={J} tier={tier} shared={shared} forge={forge} />
            {tier.maxGravel > 0 && <Gravel J={J} tier={tier} shared={shared} forge={forge} />}
            <BreakupStir J={J} />
          </>
        )}
        {tier.sandGrains > 0 && <SandField J={J} tier={tier} shared={shared} heightField={heightField} />}
        <Dust J={J} tier={tier} shared={shared} />
      </group>

      {/* camera and shared state first: the world switch reads both */}
      <UniformSync J={J} shared={shared} shockCenter={forge?.world.origin} />
      <SoundDriver J={J} />
      <Governor />
      <CameraRig J={J} opening={forge?.world.opening} />

      {forge && gardenOpen && (
        <Suspense fallback={null}>
          <Garden J={J} tier={tier} worlds={worlds} shared={shared} />
          <WorldSwitch J={J} worlds={worlds} desertRef={desert} shared={shared} />
        </Suspense>
      )}

      {tier.post && post && <Post J={J} tier={tier} />}
    </>
  );
}
