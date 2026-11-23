import { useGLTF } from "@react-three/drei";
import { ASSETS } from "../config";

// The rocks (public/models/rocks.glb, rocks-metadata.json): six photoreal,
// water-worn boulders baked in Blender — one shared textured material
// (base colour, normal, AO / roughness) — rock_01 … rock_04 boulders, large to
// medium; rock_05 small; rock_06 a pebble cluster. Each is built standing on
// its base (y = 0) with a buried skirt below it, so it sits in the sand with
// no gap wherever it is put.
//
// For the scene's placements (made for unit boulders: half-width 1) every
// geometry is scaled so its footprint's larger half-width is 1, its base
// still at y = 0 — so the same scales give the same sizes as before.
export const ROCKS_GLB = "/models/rocks.glb";

const cache = new WeakMap();
const unit = (mesh) => {
  const g = mesh.geometry.clone();
  g.computeBoundingBox();
  const b = g.boundingBox;
  const half = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 || 1;
  g.scale(1 / half, 1 / half, 1 / half);
  g.computeBoundingSphere();
  return g;
};

export function useRockModels() {
  const gltf = useGLTF(ROCKS_GLB, ASSETS.draco);
  let models = cache.get(gltf);
  if (!models) {
    const byName = {};
    let material = null;
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      byName[o.name] = o;
      material ??= o.material;
    });
    // (as baked: matte stone, a faint sheen from the sky at most)
    material.envMapIntensity = 0.45;
    models = {
      // large → medium boulders
      boulders: ["rock_01", "rock_02", "rock_03", "rock_04"].map((n) => unit(byName[n])),
      // the small ones, for pebbles
      pebbles: ["rock_05", "rock_06"].map((n) => unit(byName[n])),
      material,
    };
    cache.set(gltf, models);
  }
  return models;
}

useGLTF.preload(ROCKS_GLB, ASSETS.draco);
