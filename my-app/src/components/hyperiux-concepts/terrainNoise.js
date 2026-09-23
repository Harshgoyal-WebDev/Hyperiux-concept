import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

function fbm(noise2D, x, y, { octaves, lacunarity, gain, frequency }) {
  let amplitude = 1;
  let freq = frequency;
  let sum = 0;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    sum += noise2D(x * freq, y * freq) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    freq *= lacunarity;
  }

  return sum / norm;
}

// Shared height field so anything scattered across the terrain (rocks,
// pebbles, etc.) can sample the exact same surface the ground mesh
// displaces to, instead of duplicating (and risking drifting from) the
// noise setup. `ruggedness` / `ridgeSharpness` / `warpStrength` are the
// knobs that control how jagged vs. rolling the terrain reads.
export function createTerrainSampler({
  seed = 7,
  height = 3.2,
  basinRadius = 15,
  basinDepth = 2.4,
  ruggedness = 0.35,
  ridgeSharpness = 1.3,
  warpStrength = 2,
  warpFrequency = 0.05,
  // Lower frequency = broader features = fewer, bigger peaks rather than a
  // busy field of small bumps — this is the main knob for "how many peaks"
  // rather than ruggedness/ridgeSharpness, which only control how jagged
  // vs. rolling each individual feature reads.
  rollingFrequency = 0.018,
  ridgedFrequency = 0.028,
  // How many extra units beyond basinRadius the terrain takes to ramp up
  // to full height/ruggedness. Without this, the ground jumps straight
  // from the flat basin to 100% noise right at basinRadius — a visible
  // "cliff" from calm to chaotic. A wider ramp reads as gradually rising
  // ground instead.
  transitionWidth = 15,
} = {}) {
  const noise2D = createNoise2D(() => seed);
  const warp2D = createNoise2D(() => seed + 0.37);

  return function getElevation(x, y) {
    const warpX = warp2D(x * warpFrequency, y * warpFrequency) * warpStrength;
    const warpY = warp2D(x * warpFrequency + 50, y * warpFrequency + 50) * warpStrength;

    // Fewer octaves than before — each extra octave adds a finer layer of
    // detail, which is exactly the "noisy" small-scale bumpiness that made
    // the peaks read as chaotic rather than a handful of clean summits.
    const rolling = fbm(noise2D, x + warpX, y + warpY, {
      octaves: 3,
      lacunarity: 2.1,
      gain: 0.5,
      frequency: rollingFrequency,
    });

    const ridgedRaw =
      1 -
      Math.abs(
        fbm(noise2D, x + warpX + 100, y + warpY + 100, {
          octaves: 2,
          lacunarity: 2.3,
          gain: 0.55,
          frequency: ridgedFrequency,
        })
      );
    // pow() sharpens ridge crests into pointier peaks instead of rolling humps
    const ridged = Math.pow(Math.max(ridgedRaw, 0), ridgeSharpness);

    let elevation = (rolling * (1 - ruggedness) + ridged * ruggedness) * height;

    const distanceFromCenter = Math.sqrt(x * x + y * y);
    const basinFalloff = THREE.MathUtils.smoothstep(
      distanceFromCenter,
      0,
      basinRadius + transitionWidth
    );
    elevation = THREE.MathUtils.lerp(-basinDepth, elevation, basinFalloff);

    return elevation;
  };
}
