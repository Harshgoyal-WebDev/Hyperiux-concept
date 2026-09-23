import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

// Procedural blotchy roughness map (simulates puddles/wet patches breaking
// up an otherwise uniform surface) plus a matching normal map derived from
// the same height field, so specular highlights and the roughness
// variation line up. Generated once and reused across terrain + rocks so
// everything reads as the same rained-on surface.
export function createWetnessMaps({ size = 256, scale = 6, seed = 3, contrast = 1.4 } = {}) {
  const noise2D = createNoise2D(() => seed);
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * scale;
      const ny = (y / size) * scale;

      let value = 0;
      let amplitude = 1;
      let frequency = 1;
      let norm = 0;

      for (let o = 0; o < 4; o++) {
        value += noise2D(nx * frequency, ny * frequency) * amplitude;
        norm += amplitude;
        amplitude *= 0.5;
        frequency *= 2.1;
      }

      value = value / norm / 2 + 0.5;
      heights[y * size + x] = Math.pow(value, contrast);
    }
  }

  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = size;
  roughnessCanvas.height = size;
  const roughnessCtx = roughnessCanvas.getContext("2d");
  const roughnessData = roughnessCtx.createImageData(size, size);

  for (let i = 0; i < heights.length; i++) {
    const v = Math.round(heights[i] * 255);
    roughnessData.data[i * 4 + 0] = v;
    roughnessData.data[i * 4 + 1] = v;
    roughnessData.data[i * 4 + 2] = v;
    roughnessData.data[i * 4 + 3] = 255;
  }
  roughnessCtx.putImageData(roughnessData, 0, 0);

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext("2d");
  const normalData = normalCtx.createImageData(size, size);
  const strength = 1.6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const left = heights[y * size + ((x - 1 + size) % size)];
      const right = heights[y * size + ((x + 1) % size)];
      const up = heights[((y - 1 + size) % size) * size + x];
      const down = heights[((y + 1) % size) * size + x];

      const dx = (left - right) * strength;
      const dy = (up - down) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);

      const idx = (y * size + x) * 4;
      normalData.data[idx + 0] = (-dx / len) * 0.5 * 255 + 127.5;
      normalData.data[idx + 1] = (-dy / len) * 0.5 * 255 + 127.5;
      normalData.data[idx + 2] = (1 / len) * 0.5 * 255 + 127.5;
      normalData.data[idx + 3] = 255;
    }
  }
  normalCtx.putImageData(normalData, 0, 0);

  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  const normalMap = new THREE.CanvasTexture(normalCanvas);

  [roughnessMap, normalMap].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
  });

  return { roughnessMap, normalMap };
}
