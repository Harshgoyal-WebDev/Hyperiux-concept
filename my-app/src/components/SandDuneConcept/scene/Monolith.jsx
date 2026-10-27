"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { buildPlaceholderMonolith, normalizeGltfMonolith, splitOffset } from "../world/monolithGeometry";
import { createStoneMaterial } from "../world/materials";
import { makeDissolveConfig } from "../world/dissolve";
import { ASSETS } from "../config";
import { T } from "../tuning";

// Applies the dissolving basalt material to the stone meshes. A delivered
// GLB keeps its authored PBR maps (base colour, roughness, normal, emissive
// fissures); the procedural masonry is only used on the placeholder.
function useStone(monolith, shared) {
  const stone = useMemo(() => {
    const center = monolith.bounds.getCenter(new THREE.Vector3());
    const extent = monolith.bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    return createStoneMaterial(shared, makeDissolveConfig("monolith", { center, extent }), {
      procedural: !monolith.hasAuthoredMaps,
    });
  }, [monolith, shared]);

  useEffect(() => {
    for (const mesh of monolith.meshes) {
      const original = mesh.material;
      if (original?.map) {
        stone.material.map = original.map;
        stone.material.color.set("#ffffff");
      }
      if (original?.normalMap) stone.material.normalMap = original.normalMap;
      if (original?.roughnessMap) stone.material.roughnessMap = original.roughnessMap;
      if (original?.emissiveMap) {
        stone.material.emissiveMap = original.emissiveMap;
        stone.material.emissive.set(T.crackColor);
        stone.material.emissiveIntensity = 2.5;
      }
      mesh.material = stone.material;
      mesh.customDepthMaterial = stone.depthMaterial;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    return () => {
      stone.material.dispose();
      stone.depthMaterial.dispose();
    };
  }, [monolith, stone]);

  useFrame(() => {
    const m = stone.material;
    if (!m.map && m.userData.hex !== T.stoneColor) {
      m.color.set(T.stoneColor);
      m.userData.hex = T.stoneColor;
    }
    m.roughness = T.stoneRoughness;
    if (m.emissiveMap) m.emissiveIntensity = T.glbEmissive;
  });
}

// The two halves sit joined (monolithGap, live-tunable).
function useJoin(monolith) {
  useFrame(() => {
    const s = monolith.split;
    if (!s) return;
    const offset = splitOffset(s, T.monolithGap) / s.scale;
    for (const h of s.halves) h.mesh.position.x = h.base.x + h.side * offset;
  });
}

function MonolithObject({ monolith, shared, onReady, J }) {
  useStone(monolith, shared);
  useJoin(monolith);
  useEffect(() => {
    onReady(monolith);
  }, [monolith, onReady]);
  return <primitive object={monolith.object} />;
}

export function GltfMonolith({ meta, shared, onReady, J }) {
  const gltf = useGLTF(ASSETS.monolithGlb);
  const monolith = useMemo(() => normalizeGltfMonolith(gltf.scene, meta), [gltf, meta]);
  return <MonolithObject monolith={monolith} shared={shared} onReady={onReady} J={J} />;
}

export function PlaceholderMonolith({ shared, onReady, J }) {
  const monolith = useMemo(() => buildPlaceholderMonolith(), []);
  useEffect(() => () => monolith.meshes.forEach((m) => m.geometry.dispose()), [monolith]);
  return <MonolithObject monolith={monolith} shared={shared} onReady={onReady} J={J} />;
}
