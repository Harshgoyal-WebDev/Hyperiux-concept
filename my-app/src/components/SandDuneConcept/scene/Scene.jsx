"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { createSharedUniforms } from "../world/materials";
import { buildLandmarks, buildScatter, createTerrainSampler } from "../world/layout";
import { buildPathA, buildPathC, getTrailS0, validatePathA } from "../world/cameraPath";
import { T } from "../tuning";
import { buildPlaceholderMonolith } from "../world/monolithGeometry";
import { isometricQuaternion } from "../world/fracture";
import Sky from "./Sky";
import Terrain, { buildHeightField, buildTerrainGeometry } from "./Terrain";
import SandField from "./SandField";
import { GltfMonolith, PlaceholderMonolith } from "./Monolith";
import EnergyCube from "./EnergyCube";
import EnergyBeams from "./EnergyBeams";
import EnergyField from "./EnergyField";
import BreakStreaks from "./BreakStreaks";
import Trail from "./Trail";
import Rocks, { buildRockSet } from "./Rocks";
import DissolveParticles from "./DissolveParticles";
import { CameraRig, Dust, Lights, Post, UniformSync } from "./Rig";
import { getAudio } from "../audio";

// Feeds the journey state to the score and sound effects every frame.
function SoundDriver({ J }) {
  useFrame((_, delta) => getAudio()?.update(J, Math.min(delta, 0.1)));
  return null;
}

// Everything that depends on the resolved monolith (cube anchor, faces).
function buildWorld(monolith, terrain) {
  const quaternion = isometricQuaternion();
  const pathA = buildPathA(monolith, T.heroCamPosition);
  const s0 = getTrailS0();
  const landmarks = buildLandmarks(s0);
  const scatter = buildScatter(landmarks);
  const rockSet = buildRockSet(landmarks, scatter, terrain);
  const pathC = buildPathC(terrain);
  if (process.env.NODE_ENV !== "production") {
    const c = monolith.cube.position;
    console.info(
      `[sand-dune-concept] monolith: ${monolith.isPlaceholder ? "placeholder" : "GLB"}, cube anchor from ${monolith.anchorSource || "SVG hexagon centre"} at (${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}), faces z ${monolith.frontZ.toFixed(2)} / ${monolith.backZ.toFixed(2)}`
    );
  }
  if (process.env.NODE_ENV !== "production" && monolith.meshes.length) {
    const hits = validatePathA(pathA, monolith);
    if (!hits.length) console.info("[sand-dune-concept] camera path clears the monolith geometry");
  }
  return { quaternion, pathA, pathC, landmarks, rockSet };
}

export default function Scene({ J, tier, asset }) {
  const shared = useMemo(() => createSharedUniforms(), []);
  const terrain = useMemo(() => createTerrainSampler(), []);
  const envSky = useMemo(() => ({ uWhite: { value: 0 }, uWhiteLevel: { value: 1 }, uNight: { value: 0 } }), []);
  const terrainGeometry = useMemo(() => buildTerrainGeometry(terrain, tier.terrainSegments), [terrain, tier]);
  const heightField = useMemo(() => buildHeightField(terrainGeometry, tier.terrainSegments), [terrainGeometry, tier]);
  useEffect(
    () => () => {
      terrainGeometry.dispose();
      heightField.texture.dispose();
    },
    [terrainGeometry, heightField]
  );
  const [monolith, setMonolith] = useState(null);
  const onReady = useCallback((m) => setMonolith((prev) => (prev === m ? prev : m)), []);

  // With no GLB and the placeholder disabled, the choreography still needs
  // the monolith's dimensions — use the placeholder's numbers, render no stone.
  const virtual = useMemo(() => {
    if (asset.kind !== "none") return null;
    const m = buildPlaceholderMonolith();
    return { ...m, meshes: [] };
  }, [asset.kind]);
  const resolved = monolith || virtual;
  const world = useMemo(() => (resolved ? buildWorld(resolved, terrain) : null), [resolved, terrain]);

  return (
    <>
      <Sky shared={shared} />
      {/* sunset reflections for the stone, rendered locally. Its sky has
          its own fixed uniforms: drei re-captures on re-render, and the
          snapshot must never pick up the white-out. */}
      <Environment frames={1} resolution={64}>
        <Sky shared={envSky} />
      </Environment>
      <Terrain shared={shared} geometry={terrainGeometry} />
      <Suspense fallback={null}>
        {asset.kind === "glb" && <GltfMonolith meta={asset.meta} shared={shared} onReady={onReady} J={J} />}
        {asset.kind === "placeholder" && <PlaceholderMonolith shared={shared} onReady={onReady} J={J} />}
      </Suspense>

      {world && (
        <>
          <UniformSync J={J} shared={shared} cubePosition={resolved.cube.position} />
          <SoundDriver J={J} />
          <Lights J={J} tier={tier} shared={shared} cubePosition={resolved.cube.position} />
          <CameraRig J={J} pathA={world.pathA} pathC={world.pathC} terrain={terrain} />
          <EnergyCube monolith={resolved} quaternion={world.quaternion} J={J} tier={tier} shared={shared} />
          <EnergyBeams monolith={resolved} J={J} tier={tier} shared={shared} />
          <EnergyField pathA={world.pathA} pathC={world.pathC} J={J} tier={tier} terrain={terrain} />
          <BreakStreaks J={J} shared={shared} />
          <Trail terrain={terrain} heightField={heightField} monolith={resolved} J={J} shared={shared} />
          <Rocks rockSet={world.rockSet} landmarks={world.landmarks} shared={shared} J={J} />
          <DissolveParticles monolith={resolved} rockSet={world.rockSet} J={J} tier={tier} shared={shared} />
          {tier.sandGrains > 0 && <SandField J={J} tier={tier} shared={shared} heightField={heightField} />}
          <Dust J={J} tier={tier} shared={shared} />
        </>
      )}
      {tier.post && <Post J={J} tier={tier} />}
    </>
  );
}
