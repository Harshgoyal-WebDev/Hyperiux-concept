import * as THREE from "three";
import { BASIN, OASIS_RECT, WATER_Y, oasisAt } from "../../world/oasis";

// The oasis's ground, as a map over OASIS_RECT (world/oasis.js) for the
// sand's shader (wet sand by the water, grass on the banks, darker soil
// where it is alive) and the water's (its depth):
//   r wet · g grass · b soil · a depth below the water (÷ 6 m)
const TEXEL = 2; // metres

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

export function buildGroundMap(terrain) {
  const { x0, z0, x1, z1 } = OASIS_RECT;
  const w = Math.round((x1 - x0) / TEXEL);
  const h = Math.round((z1 - z0) / TEXEL);
  const data = new Uint8Array(w * h * 4);
  const o = {};
  for (let j = 0; j < h; j++) {
    const z = z0 + (j + 0.5) * TEXEL;
    for (let i = 0; i < w; i++) {
      const x = x0 + (i + 0.5) * TEXEL;
      oasisAt(x, z, o);
      const k = (j * w + i) * 4;
      if (!o.inside || o.carve <= 0) continue;
      const ground = terrain.height(x, z);
      const floor = smooth(14, -4, o.e); // the level floor (and the walls' foot)
      const wet = smooth(4.5, 0, o.w) * o.carve;
      // (the island under the tree is dark, root-bound mud, grass only at its rim)
      const island = smooth(BASIN.island - 3, BASIN.island - 9, o.ri);
      const grass = o.life * smooth(18, 1.5, o.w) * smooth(-0.4, 0.6, o.w) * floor * (1 - island);
      const soil = o.life * smooth(36, 2, o.w) * floor;
      const depth = Math.min(Math.max((WATER_Y - ground) / 6, 0), 1);
      data[k] = Math.round(Math.max(wet, island * 0.8) * 255);
      data[k + 1] = Math.round(grass * 255);
      data[k + 2] = Math.round(soil * 255);
      data[k + 3] = Math.round(depth * 255);
    }
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return { texture, rect: new THREE.Vector4(x0, z0, x1 - x0, z1 - z0) };
}
