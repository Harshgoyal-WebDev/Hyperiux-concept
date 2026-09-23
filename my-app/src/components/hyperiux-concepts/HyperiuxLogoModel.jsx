"use client";

import { useEffect, useMemo } from "react";
import { useGLTF, Center } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/assets/models/hyperiexLogoNo2.glb";

// The actual Hyperiux logo mesh, self-lit (emissive, for Bloom) and with
// its own point light — no beams/smoke/dust motes around it (removed:
// dead weight, since they'd been toggled off by default anyway, and one
// less thing dragging on frame time during the scroll sequence).
export default function HyperiuxLogoModel({
  position = [0, 1.0, 0],
  modelScale = 0.45,
  colorA = "#ff3500",
  colorB = "#ff5f00",
  mix = 0.3,
  emissiveIntensity = 1.4,
  roughness = 0.35,
  metalness = 0.1,
  lightIntensity = 12,
  lightDistance = 30,
}) {
  const { scene } = useGLTF(MODEL_PATH);

  const color = useMemo(
    () => new THREE.Color(colorA).lerp(new THREE.Color(colorB), mix),
    [colorA, colorB, mix]
  );

  // Clone per-instance so mutating materials below never touches drei's
  // cached GLTF scene (which would otherwise leak into any other place
  // this same model gets loaded).
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = false;
      child.material = new THREE.MeshStandardMaterial({
        // Kept dark/neutral on purpose: this is meant to read as a
        // self-lit glowing sign, not a lit orange plastic object. If the
        // base color matched the emissive tint, strong scene lighting hit
        // it as ordinary diffuse reflectance and the whole thing read as
        // flat, evenly-lit orange with no real glow — none of the emissive
        // component's brightness ever stood out enough to cross Bloom's
        // threshold. A near-black base plus a strong, independent emissive
        // is what actually produces a bloom halo.
        color: "#0a0a0a",
        emissive: color,
        emissiveIntensity,
        roughness,
        metalness,
        side: THREE.DoubleSide,
      });
    });
  }, [model, color, emissiveIntensity, roughness, metalness]);

  return (
    <group position={position} rotation={[0, Math.PI, 0]} >
      <Center scale={modelScale}>
        <primitive object={model} />
      </Center>

      <pointLight color={color} intensity={lightIntensity} distance={lightDistance} decay={2} />
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
