"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { createSharedUniforms } from "../world/materials";
import { buildScatter, buildShards, createTerrainSampler } from "../world/layout";
import * as THREE from "three";
import { FORGE } from "../config";
import { buildPillars } from "../world/pillars";
import { lineZ, weaveAt } from "../world/duneCamera";
import Sky from "./Sky";
import Terrain, { buildHeightField, buildTerrainGeometry } from "./Terrain";
import SandField from "./SandField";
import Forge from "./Forge";
import ForgeBeam from "./ForgeBeam";
import DuneBeam from "./DuneBeam";
import Pillars from "./Pillars";
import CrumbleSand from "./CrumbleSand";
import Gravel from "./Gravel";
import BreakupStir from "./BreakupStir";
import Rocks, { buildRockSet } from "./Rocks";
import { CameraRig, Dust, Lights, Post, UniformSync } from "./Rig";
import { getAudio } from "../audio";
import { Q, QUALITY_EVENT } from "../quality";
import Governor from "./Governor";

// Feeds the journey state to the score and sound effects every frame.
function SoundDriver({ J }) {
  useFrame((_, delta) => getAudio()?.update(J, Math.min(delta, 0.1)));
  return null;
}

// Each key pillar's close-up: from the side the flight comes at it from,
// at mid-height, clear of the sand (see CameraRig for the framing).
function buildCloseUps(pillars, terrain) {
  return pillars
    .filter((p) => p.content >= 0)
    .map((p) => {
      const center = new THREE.Vector3(p.x, p.base + p.height * 0.55, p.z);
      const from = new THREE.Vector3(weaveAt(p.d - 80), 0, lineZ(p.d - 80));
      const dir = from.sub(center).setY(0).normalize();
      const dist = 26 + p.width * 1.5;
      const pos = center.clone().addScaledVector(dir, dist);
      pos.y = Math.max(center.y + 1, terrain.height(pos.x, pos.z) + 5);
      return { pos, center, dist };
    });
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

// focus: the pin close-up state (index, k) the journey eases; pins: the
// pins' HTML elements, kept over their rocks by Pillars.
export default function Scene({ J, tier, withForge = true, onMissing, focus, pins }) {
  const shared = useMemo(() => createSharedUniforms(), []);
  const terrain = useMemo(() => createTerrainSampler(), []);
  const envSky = useMemo(() => ({ uNight: { value: 0 }, uWhite: { value: 0 }, uWhiteLevel: { value: 1 } }), []);
  const terrainGeometry = useMemo(() => buildTerrainGeometry(terrain, tier.terrainSegments), [terrain, tier]);
  const heightField = useMemo(() => buildHeightField(terrain, tier.terrainSegments), [terrain, tier]);
  const groundY = useMemo(() => footprintGround(terrain), [terrain]);
  const pillars = useMemo(() => buildPillars(terrain), [terrain]);
  const closeUps = useMemo(() => buildCloseUps(pillars, terrain), [pillars, terrain]);
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

  return (
    <>
      <group>
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
            <DuneBeam terrain={terrain} forge={forge} J={J} shared={shared} />
            <CrumbleSand J={J} tier={tier} shared={shared} forge={forge} />
            {tier.maxGravel > 0 && <Gravel J={J} tier={tier} shared={shared} forge={forge} />}
            <BreakupStir J={J} />
          </>
        )}
        {forge && focus && pins && <Pillars J={J} tier={tier} shared={shared} forge={forge} pillars={pillars} pins={pins} focus={focus} />}
        {tier.sandGrains > 0 && <SandField J={J} tier={tier} shared={shared} heightField={heightField} />}
        <Dust J={J} tier={tier} shared={shared} />
      </group>

      <UniformSync J={J} shared={shared} shockCenter={forge?.world.origin} />
      <SoundDriver J={J} />
      <Governor />
      <CameraRig J={J} opening={forge?.world.opening} focus={focus} closeUps={closeUps} />

      {tier.post && post && <Post J={J} tier={tier} />}
    </>
  );
}
