"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { createSharedUniforms } from "../world/materials";
import { buildScatter, buildShards, createTerrainSampler } from "../world/layout";
import { RESHAPE_EVENT } from "../world/oasis";
import * as THREE from "three";
import { FORGE, FORGE_LAYER, NO_MIRROR_LAYER, VALLEY_LAYER } from "../config";
import Sky from "./Sky";
import Terrain, { buildHeightField, buildTerrainGeometry } from "./Terrain";
import SandField from "./SandField";
import Forge from "./Forge";
import ForgeBeam from "./ForgeBeam";
import Oasis from "./oasis/Oasis";
import CrumbleSand from "./CrumbleSand";
import Gravel from "./Gravel";
import BreakupStir from "./BreakupStir";
import Rocks, { buildRockSet } from "./Rocks";
import { CameraRig, Dust, Lights, Post, UniformSync } from "./Rig";
import { getAudio } from "../audio";
import { Q, QUALITY_EVENT } from "../quality";
import Governor from "./Governor";

// Everything of the forge's world, on its own render layer (config.js
// FORGE_LAYER): things arrive in it later (the forge's model loads), so it
// is re-tagged now and then.
function ForgeLayer({ children }) {
  const group = useRef();
  const tick = useRef(0);
  useFrame(() => {
    if (!group.current || tick.current++ % 20) return;
    group.current.traverse((o) => o.layers.set(FORGE_LAYER));
  });
  return <group ref={group}>{children}</group>;
}

// ...and the valley's (the oasis: its water, plants, tree, threads): only the
// valley camera sees it — the logo shot, which used to draw it all far off
// (and its water's mirror with it) through the approach and the cut, no
// longer does. (What is already kept out of the mirror stays so.)
function ValleyLayer({ children }) {
  const group = useRef();
  const tick = useRef(0);
  useFrame(() => {
    if (!group.current || tick.current++ % 20) return;
    group.current.traverse((o) => {
      if (o.layers.mask !== 1 << NO_MIRROR_LAYER) o.layers.set(VALLEY_LAYER);
    });
  });
  return <group ref={group}>{children}</group>;
}

// Feeds the journey state to the score and sound effects every frame.
function SoundDriver({ J }) {
  useFrame((_, delta) => getAudio()?.update(J, Math.min(delta, 0.1)));
  return null;
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
  // (rebuilt when the oasis is reshaped from the tuning panel: the stream's
  // width is carved into the land, its water map, plants and beam)
  const [shape, setShape] = useState(0);
  useEffect(() => {
    let t;
    const reshape = () => {
      clearTimeout(t);
      t = setTimeout(() => setShape((v) => v + 1), 450);
    };
    window.addEventListener(RESHAPE_EVENT, reshape);
    return () => {
      clearTimeout(t);
      window.removeEventListener(RESHAPE_EVENT, reshape);
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- shape is the rebuild trigger
  const terrain = useMemo(() => createTerrainSampler(), [shape]);
  const envSky = useMemo(() => ({ uNight: { value: 0 }, uWhite: { value: 0 }, uWhiteLevel: { value: 1 } }), []);
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
        <ForgeLayer>
        {withForge && (
          <Suspense fallback={null}>
            <Forge J={J} shared={shared} groundY={groundY} onReady={onReady} />
          </Suspense>
        )}
        {forge && (
          <>
            <ForgeBeam terrain={terrain} forge={forge} J={J} shared={shared} />
            <CrumbleSand J={J} tier={tier} shared={shared} forge={forge} />
            {tier.maxGravel > 0 && <Gravel J={J} tier={tier} shared={shared} forge={forge} />}
            <BreakupStir J={J} />
          </>
        )}
        </ForgeLayer>

        <Lights J={J} tier={tier} shared={shared} />
        {/* past the mark: the passage, the oasis and the Yggdrasil */}
        <ValleyLayer>
          <Oasis J={J} tier={tier} shared={shared} terrain={terrain} forge={forge} />
        </ValleyLayer>
        {tier.sandGrains > 0 && <SandField J={J} tier={tier} shared={shared} heightField={heightField} />}
        <Dust J={J} tier={tier} shared={shared} />
      </group>

      <UniformSync J={J} shared={shared} shockCenter={forge?.world.origin} />
      <SoundDriver J={J} />
      <Governor />
      <CameraRig J={J} opening={forge?.world.opening} />

      {tier.post && post && <Post J={J} tier={tier} />}
    </>
  );
}
