"use client";

import { Environment } from "@react-three/drei";
import FrostedLogoModel from "./FrostedLogoModel";
import PortalBackgroundVideo from "./PortalBackgroundVideo";

// The "other side" of the shockwave portal — a much bigger, colorless
// frosted-glass copy of the logo (see FrostedLogoModel.jsx, using drei's
// MeshTransmissionMaterial). Lighting is a direct port of the working
// glass-logo hero reference (HyperiuxGlassHeroModel): nothing but
// `<Environment preset="city" />` — no manual point/directional lights.
// A transmission material reflects/refracts its surroundings, so an actual
// environment map (real reflections on every facet, from every angle)
// reads as convincing glass in a way a handful of point lights aimed at a
// black void never quite does.
export default function PortalInnerScene({
  position,
  modelScale,
  depthScale,
  transmission,
  reflectivity,
  glassRoughness,
  thickness,
  ior,
  chromaticAberration,
  anisotropy,
  distortion,
  distortionScale,
  temporalDistortion,
  backside,
  bgVideoOpacity = 0.3,
}) {
  return (
    <>
      <PortalBackgroundVideo opacity={bgVideoOpacity} />

      <Environment preset="city" />

      <FrostedLogoModel
        position={position}
        modelScale={modelScale}
        depthScale={depthScale}
        transmission={transmission}
        reflectivity={reflectivity}
        glassRoughness={glassRoughness}
        thickness={thickness}
        ior={ior}
        chromaticAberration={chromaticAberration}
        anisotropy={anisotropy}
        distortion={distortion}
        distortionScale={distortionScale}
        temporalDistortion={temporalDistortion}
        backside={backside}
      />
    </>
  );
}
