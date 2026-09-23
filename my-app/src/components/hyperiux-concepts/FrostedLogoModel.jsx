"use client";

import { useMemo } from "react";
import { useGLTF, Center, MeshTransmissionMaterial } from "@react-three/drei";
import { DoubleSide } from "three";

const MODEL_PATH = "/assets/models/hyperiexLogoNo2.glb";

export default function FrostedLogoModel({
  position = [0, 0, 0],
  modelScale = 0.5,
  // Anisotropic stretch along the model's own depth (Z) axis — the
  // reference scales its group as [scale, scale, scale * thickness],
  // distinct from the material's own `thickness` (Beer-Lambert path
  // length) below. Defaults to 1 (uniform scale, no stretch): this model
  // isn't perfectly axis-aligned the way the reference's was, so any
  // non-1 value here shears it rather than just "thickening" it — which
  // is what was reading as the model sitting slightly tilted. Same model,
  // rendered with plain uniform scale, sits straight (see
  // HyperiuxLogoModel.jsx, which never applies this stretch at all).
  depthScale = 1,
  color = "#ffffff",
  reflectivity = 0,
  transmission = 1,
  glassRoughness = 0,
  thickness = 2.5,
  ior = 1,
  chromaticAberration = 2.5,
  anisotropy = 0.2,
  distortion = 2.4,
  distortionScale = 0.35,
  temporalDistortion = 0,
  backside = true,
  samples = 8,
  resolution = 512,
}) {
  const { scene } = useGLTF(MODEL_PATH);

  // Flattened list of world-space-baked geometries (parent transforms
  // baked in, then reset to identity) instead of `<primitive object=.../>`
  // — MeshTransmissionMaterial has to be attached declaratively per mesh
  // (it's a real R3F component with its own per-frame backdrop capture,
  // not something that can be assigned imperatively like a plain
  // THREE.Material instance), so each mesh needs to be its own JSX <mesh>.
  const meshes = useMemo(() => {
    const model = scene.clone(true);
    model.updateMatrixWorld(true);
    const list = [];
    model.traverse((child) => {
      if (!child.isMesh) return;
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      list.push({ id: child.uuid, geometry });
    });
    return list;
  }, [scene]);

  return (
    <group position={position}>
      <Center scale={[modelScale, modelScale, modelScale * depthScale]}>
        {meshes.map((mesh) => (
          <mesh key={mesh.id} geometry={mesh.geometry} castShadow={false} receiveShadow={false}>
            <MeshTransmissionMaterial
              color={color}
              reflectivity={reflectivity}
              transmission={transmission}
              roughness={glassRoughness}
              thickness={thickness}
              ior={ior}
              chromaticAberration={chromaticAberration}
              anisotropy={anisotropy}
              distortion={distortion}
              distortionScale={distortionScale}
              temporalDistortion={temporalDistortion}
              backside={backside}
              samples={samples}
              resolution={resolution}
              transparent
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
        ))}
      </Center>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
