import * as THREE from "three";
import { createContext, useContext } from "react";
import { engraveDesign, engraveDevelopment, engraveMarketing, engraveStrategy, makeCoreRings, makeCracks, makeIcon, makeRunes, makeStone } from "./textures";
import { ORANGE } from "./shaders";

// Textures and base materials for the whole forge, created once when the
// canvas mounts and disposed when it unmounts (after the white transition).

const repeat = (tex, x, y) => {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
};

export function createAssets(tier) {
  const disposables = [];
  const keep = (x) => {
    disposables.push(x);
    return x;
  };

  const stone = makeStone(tier.textureSize, 11);
  const cracks = keep(makeCracks(512, 3, 22));
  keep(stone.color);
  keep(stone.data);

  const tex = {
    stone,
    cracks,
    engraving: {
      strategy: keep(engraveStrategy()),
      design: keep(engraveDesign()),
      development: keep(engraveDevelopment()),
      marketing: keep(engraveMarketing()),
    },
    icons: Object.fromEntries(["strategy", "design", "development", "marketing"].map((k) => [k, keep(makeIcon(k))])),
    runes: keep(makeRunes()),
    coreRings: keep(makeCoreRings()),
  };

  // dark weathered stone (ruins, arch, corridor); faint molten cracks
  const ruinStone = keep(
    new THREE.MeshStandardMaterial({
      color: "#3a332d",
      map: keep(repeat(stone.color, 2, 2)),
      roughnessMap: keep(repeat(stone.data, 2, 2)),
      bumpMap: keep(repeat(stone.data, 2, 2)),
      bumpScale: 2.5,
      roughness: 0.92,
      metalness: 0.08,
      emissive: ORANGE,
      emissiveMap: keep(repeat(cracks, 1, 1)),
      emissiveIntensity: 0.0,
    })
  );

  // polished obsidian floor: dark, slick, with glowing seams
  const floor = keep(
    new THREE.MeshStandardMaterial({
      color: "#16130f",
      map: keep(repeat(stone.color, 26, 26)),
      roughnessMap: keep(repeat(stone.data, 26, 26)),
      roughness: 0.42,
      metalness: 0.45,
      emissive: ORANGE,
      emissiveMap: keep(repeat(cracks, 9, 9)),
      emissiveIntensity: 0.0,
    })
  );

  // the stair hall: ivory stone and brushed copper
  const ivory = keep(
    new THREE.MeshStandardMaterial({
      color: "#f2ece3",
      roughnessMap: keep(repeat(stone.data, 3, 3)),
      roughness: 0.42,
      metalness: 0.0,
    })
  );
  const ivoryFloor = keep(
    new THREE.MeshStandardMaterial({
      color: "#efe8de",
      roughnessMap: keep(repeat(stone.data, 30, 30)),
      roughness: 0.3,
      metalness: 0.05,
    })
  );
  const copper = keep(
    new THREE.MeshStandardMaterial({
      color: "#C87543",
      metalness: 0.92,
      roughness: 0.3,
      envMapIntensity: 1.2,
    })
  );

  // the staircase's metals: cast bronze for the stone of the flight, a darker
  // patinated bronze for its walls, polished brass for rail and inlay
  // (colours and finish are live from the tuning panel)
  const metal = (color, roughness) => keep(new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, envMapIntensity: 1.15 }));
  const bronze = metal("#8a5a34", 0.36);
  const bronzeWall = metal("#4b3322", 0.42);
  const brass = metal("#d0a85a", 0.22);

  return {
    tex,
    mat: { ruinStone, floor, ivory, ivoryFloor, copper, bronze, bronzeWall, brass },
    // a dark pillar stone carrying one force's engraving
    pillarMaterial(engraving) {
      return keep(
        new THREE.MeshStandardMaterial({
          color: "#2e2823",
          map: stone.color,
          roughnessMap: stone.data,
          bumpMap: stone.data,
          bumpScale: 2,
          roughness: 0.78,
          metalness: 0.22,
          emissive: ORANGE,
          emissiveMap: engraving,
          emissiveIntensity: 0,
        })
      );
    },
    keep,
    dispose() {
      disposables.forEach((d) => d.dispose?.());
    },
  };
}

export const AssetsContext = createContext(null);
export const useAssets = () => useContext(AssetsContext);

// Box-project UVs onto a geometry by its normals: every face gets the full
// 0–1 range across its extent, so engravings read the same on any pillar.
export function boxProjectUVs(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const size = new THREE.Vector3().subVectors(b.max, b.min);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = (pos.getX(i) - b.min.x) / (size.x || 1);
    const y = (pos.getY(i) - b.min.y) / (size.y || 1);
    const z = (pos.getZ(i) - b.min.z) / (size.z || 1);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    if (ny > nx && ny > nz) {
      uv[i * 2] = x;
      uv[i * 2 + 1] = z;
    } else if (nx > nz) {
      uv[i * 2] = z;
      uv[i * 2 + 1] = y;
    } else {
      uv[i * 2] = x;
      uv[i * 2 + 1] = y;
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
