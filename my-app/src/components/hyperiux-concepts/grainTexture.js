import * as THREE from "three";

// Small tileable texture of independent, uncorrelated per-pixel noise (no
// smoothing between neighbors) — reads as fine sand/film grain rather than
// the soft, large-scale blotches a smoothed noise field produces. Values
// only ever dip below 1 (never above), so tiling it as `map` speckles the
// surface with tiny darker grains instead of shifting its overall
// brightness.
//
// This has to stay a *darkening-only* multiply, not an emissive/additive
// effect: the scene's Bloom uses mipmapBlur, which pools brightness across
// huge screen regions, so even sparse, dim emissive specks scattered over
// a surface this large blur into one big wash instead of reading as grain
// (confirmed by trying it — the whole terrain bloomed white).
export function createGrainTexture({ size = 64, intensity = 0.4, seed = 11 } = {}) {
  let s = seed >>> 0 || 1;
  const random = () => {
    // xorshift32 — cheap, deterministic, good enough for visual grain.
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(size, size);

  for (let i = 0; i < size * size; i++) {
    const v = Math.round((1 - random() * intensity) * 255);
    imageData.data[i * 4 + 0] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  // Used as `map` (albedo), so it needs the same color space as other
  // color textures for the renderer's sRGB pipeline to treat it correctly.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  // No mipmaps: as a bumpMap, the perturbation strength comes from the
  // difference between neighboring texel values (a gradient), and at any
  // real repeat count/viewing distance the GPU's default mip chain blurs
  // that difference toward zero long before it blurs the color you'd
  // actually notice — the bump just silently vanishes. Sampling the raw
  // texel every time (at the cost of some shimmer at a distance) keeps
  // the gradient — and the visible grain — intact.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
