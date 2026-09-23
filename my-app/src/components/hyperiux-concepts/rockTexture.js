import * as THREE from "three";

// Cheap value-noise FBM, stretched vertically — real rock faces (see the
// mountain reference photos) read as long vertical grooves/striations
// carved by water and wind, not uniform grain. Squashing the noise's own X
// frequency relative to Y is what turns generic bumps into that "fluted
// rock face" look.
function makeValueNoise(random) {
  const gridSize = 64;
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = random();

  const sample = (x, y) => {
    const gx = ((x % gridSize) + gridSize) % gridSize;
    const gy = ((y % gridSize) + gridSize) % gridSize;
    return grid[gy * gridSize + gx];
  };

  return function valueNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const a = sample(x0, y0);
    const b = sample(x0 + 1, y0);
    const c = sample(x0, y0 + 1);
    const d = sample(x0 + 1, y0 + 1);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
  };
}

// A grayscale height field (used as an extra, coarser bumpMap layer) plus
// a matching tangent-space normal map derived from that same field's
// gradient — the two stay perfectly consistent with each other since one
// is computed directly from the other, rather than authoring bump and
// normal detail separately and risking them fighting.
export function createRockStriationTextures({
  size = 256,
  seed = 31,
  // How stretched the grooves are — higher reads as tighter, more
  // vertical fluting; lower reads as blockier, more equant bumps.
  stretch = 3.5,
  octaves = 4,
  strength = 1.2,
} = {}) {
  let s = seed >>> 0 || 1;
  const random = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  const noise = makeValueNoise(random);

  const height = new Float32Array(size * size);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let amp = 0.5;
      let freq = 0.06;
      for (let o = 0; o < octaves; o++) {
        sum += noise(x * freq * stretch, y * freq) * amp;
        amp *= 0.55;
        freq *= 2.15;
      }
      height[y * size + x] = sum;
      if (sum < min) min = sum;
      if (sum > max) max = sum;
    }
  }

  const range = Math.max(max - min, 0.0001);
  const at = (x, y) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return (height[wy * size + wx] - min) / range;
  };

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext("2d");
  const bumpData = bumpCtx.createImageData(size, size);

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext("2d");
  const normalData = normalCtx.createImageData(size, size);

  const n = new THREE.Vector3();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const hCenter = at(x, y);
      bumpData.data[i * 4 + 0] = Math.round(hCenter * 255);
      bumpData.data[i * 4 + 1] = Math.round(hCenter * 255);
      bumpData.data[i * 4 + 2] = Math.round(hCenter * 255);
      bumpData.data[i * 4 + 3] = 255;

      const hL = at(x - 1, y);
      const hR = at(x + 1, y);
      const hD = at(x, y - 1);
      const hU = at(x, y + 1);
      n.set((hL - hR) * strength, (hD - hU) * strength, 1).normalize();
      normalData.data[i * 4 + 0] = Math.round((n.x * 0.5 + 0.5) * 255);
      normalData.data[i * 4 + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
      normalData.data[i * 4 + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
      normalData.data[i * 4 + 3] = 255;
    }
  }
  bumpCtx.putImageData(bumpData, 0, 0);
  normalCtx.putImageData(normalData, 0, 0);

  const makeTexture = (canvas, colorSpace) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = colorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  };

  return {
    // Grayscale, used as a coarse roughness/bump multiplier — needs sRGB
    // like any other non-color-data texture consumed as a plain multiply.
    bumpTexture: makeTexture(bumpCanvas, THREE.SRGBColorSpace),
    // Tangent-space normal map — must stay in Linear color space, or the
    // renderer's sRGB decode skews the encoded XYZ vectors.
    normalTexture: makeTexture(normalCanvas, THREE.NoColorSpace),
  };
}
