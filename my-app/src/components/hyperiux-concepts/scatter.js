export function mulberry32(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rejection-samples random points across the terrain footprint, skipping
// anything below the waterline. `getElevation` should be the same height
// sampler the ground mesh uses so results land exactly on the surface.
export function scatterOnTerrain({ count, width, depth, getElevation, waterLevel, margin = 0.4, random }) {
  const items = [];
  let attempts = 0;

  while (items.length < count && attempts < count * 25) {
    attempts++;

    const worldX = (random() - 0.5) * width * 0.92;
    const worldZ = (random() - 0.5) * depth * 0.92;
    // Terrain's plane geometry is rotated -90deg about X, which maps its
    // local Y axis to -worldZ — sample with that same flip to match.
    const worldY = getElevation(worldX, -worldZ);

    if (worldY < waterLevel + margin) continue;

    items.push({ worldX, worldY, worldZ });
  }

  return items;
}
