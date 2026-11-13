"use client";

import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { C, S, evaluateChannels } from "../timeline";
import Atmosphere from "./Atmosphere";
import CameraRig from "./CameraRig";
import Architecture from "./Architecture";
import Arches from "./Arches";
import Rocks from "./Rocks";
import Sculptures from "./Sculptures";
import Panels from "./Panels";
import Gallery from "./Gallery";
import Tree from "./Tree";
import BasinWater from "./BasinWater";
import StrandBeam from "./StrandBeam";
import PostFX from "./PostFX";
import { THEME } from "../theme";

// Runs first every frame: reads the master clock, derives every channel.
function Director() {
  useFrame(() => {
    evaluateChannels(S.t, C);
  }, -2);
  return null;
}

// Tells the page once the first frames are on screen (shaders compiled).
export function FirstFrame({ onReady }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
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

// The one world: every chapter's architecture in one scene, in one place,
// the camera travelling through it.
export default function World({ tier, onReady }) {
  return (
    <>
      <Director />
      <CameraRig />
      <Atmosphere tier={tier} />
      <Architecture tier={tier} />
      {THEME.structures && <Rocks tier={tier} />}
      {THEME.structures && <Sculptures tier={tier} />}
      <Arches tier={tier} />
      <Panels tier={tier} />
      <Gallery />
      <Tree tier={tier} />
      <BasinWater tier={tier} />
      <StrandBeam />
      {tier.post && <PostFX />}
      <FirstFrame onReady={onReady} />
    </>
  );
}
