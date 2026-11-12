"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { C, S, evaluateChannels } from "../timeline";
import { AssetsContext, createAssets } from "../world/assets";
import Atmosphere from "./Atmosphere";
import SceneCamera from "./SceneCamera";
import RuinedWorld from "./RuinedWorld";
import EnergyCore from "./EnergyCore";
import PillarStrategy from "./pillars/PillarStrategy";
import PillarDesign from "./pillars/PillarDesign";
import PillarDevelopment from "./pillars/PillarDevelopment";
import PillarMarketing from "./pillars/PillarMarketing";
import EnergyConvergence from "./EnergyConvergence";
import HyperiuxMark from "./HyperiuxMark";
import ParticleField from "./ParticleField";
import ForgeCorridor from "./ForgeCorridor";
import ProcessStaircase from "./ProcessStaircase";
import PostFX from "./PostFX";
import Water from "./Water";

// Runs first every frame: reads the master clock and derives every channel.
function Director() {
  useFrame(() => {
    evaluateChannels(S.t, C);
  }, -2);
  return null;
}

// Tells the shell once the first frames are on screen (shaders compiled).
function FirstFrame({ onReady }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    // compile everything up front, visible or not, so nothing hitches later
    try {
      gl.compile(scene, camera);
    } catch {
      /* not fatal */
    }
    const tick = () => {
      if (++frames > 3) onReady?.();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gl, scene, camera, onReady]);
  return null;
}

export default function HyperiuxScene({ tier, onReady }) {
  const assets = useMemo(() => createAssets(tier), [tier]);
  useEffect(() => () => assets.dispose(), [assets]);

  return (
    <AssetsContext.Provider value={assets}>
      <Director />
      <SceneCamera />
      <Atmosphere tier={tier} />
      <RuinedWorld />
      <Water tier={tier} />
      <EnergyCore />
      <PillarStrategy />
      <PillarDesign />
      <PillarDevelopment />
      <PillarMarketing />
      <EnergyConvergence />
      <HyperiuxMark />
      <ParticleField tier={tier} />
      <ForgeCorridor />
      <ProcessStaircase tier={tier} />
      {tier.post && <PostFX />}
      <FirstFrame onReady={onReady} />
    </AssetsContext.Provider>
  );
}
