"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { P } from "../config";
import { T } from "../tuning";

// The passage from the desert into the garden. The two worlds share
// coordinates but are never drawn together: the camera flies into the light
// of the forged logo's cube outline until it fills the frame (J.flash, a
// screen layer in ForgingConcept), and at that point on the timeline — the
// frame all light — the desert is hidden and the garden shown, with its own
// fog and sky light. The light then fades to the garden. It reverses
// exactly scrolling back.
export default function WorldSwitch({ J, worlds, desertRef }) {
  const { scene, gl } = useThree();
  const state = useMemo(() => ({ desertFog: null, desertEnv: null, wasGarden: false }), []);

  useFrame(() => {
    const desert = desertRef.current;
    const garden = worlds.garden;
    if (!desert || !garden) return;
    const inGarden = J.progress >= P.through;
    J.inGarden = inGarden;
    worlds.gardenActive = inGarden;
    // the desert's own fog / environment (UniformSync keeps them up to date)
    if (scene.fog !== garden.fog) state.desertFog = scene.fog;
    if (scene.environment !== garden.env) state.desertEnv = scene.environment;

    // the garden's shadows never move (its sway is vertex-only): drawn once
    // on the way in (the desert's are drawn as they change: Lights, Rig.jsx)
    if (inGarden !== state.wasGarden) {
      gl.shadowMap.needsUpdate = true;
      state.wasGarden = inGarden;
    }
    desert.visible = !inGarden;
    garden.group.visible = inGarden;
    if (inGarden) {
      scene.fog = garden.fog;
      scene.environment = garden.env;
      scene.environmentIntensity = T.gardenEnvIntensity;
    } else {
      scene.fog = state.desertFog;
      scene.environment = state.desertEnv;
    }
  });

  return null;
}
