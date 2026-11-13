// Live-tunable look of the journey (dev, or ?tune): the Leva panel writes
// into T, the scene reads it every frame. Defaults are the shipped look.
export const T = {
  exposure: 1.25,
  sun: 1.6, // × the chapter's sunlight
  sunColor: "#ff9a5a",
  hemi: 0.9,
  hemiSky: "#3b3f48",
  hemiGround: "#0b0b0d",
  envIntensity: 0.35,
  fog: 1.0, // × the chapter's haze
  fogColor: "#17181c",
  stone: "#3a3b3f",
  stoneDark: "#2a2b2f", // the darker walls
  stoneVariation: 1.6,
  floor: "#0f1013",
  floorReflection: 0.55,
  floorBlur: 0.7, // (desktop reflector)
  pathIntensity: 3.0,
  bloom: 1.4, // only the beam is bright enough to bloom
  bloomThreshold: 1.5,
  vignette: 0.62,
  // the pointer's liquid trail over the scene
  liquid: 0.26, // how strongly it refracts (0 = off)
  liquidDispersion: 0.31, // how far the colours split at its edges
  liquidRadius: 0.02, // its width (share of the screen's height)
  liquidTrail: 0.5, // seconds it lingers before it evaporates
  liquidInk: 0.41, // how thick a film the pointer lays down
  liquidForce: 0.62, // how hard the stroke pushes the flow
  liquidSwirl: 0, // how much it curls
  liquidFollow: 11, // how closely the stroke follows the pointer (lower = lazier, smoother)
  liquidShine: 0, // the light caught on its slopes
  parallaxMove: 0.4,
  parallaxLook: 0.7,
  parallaxSmooth: 0.25,
};
export const DEFAULTS = { ...T };

export const SCHEMA = {
  Light: {
    exposure: [0.4, 2, 0.01],
    sun: [0, 3, 0.01],
    sunColor: "color",
    hemi: [0, 3, 0.01],
    hemiSky: "color",
    hemiGround: "color",
    envIntensity: [0, 2, 0.01],
    fog: [0, 3, 0.01],
    fogColor: "color",
  },
  Materials: {
    stone: "color",
    stoneDark: "color",
    stoneVariation: [0, 3, 0.01],
    floor: "color",
    floorReflection: [0, 1, 0.01],
    pathIntensity: [0, 3, 0.01],
  },
  Post: {
    bloom: [0, 2, 0.01],
    bloomThreshold: [0, 6, 0.01],
    vignette: [0, 1, 0.01],
  },
  Liquid: {
    liquid: [0, 3, 0.01],
    liquidDispersion: [0, 2, 0.01],
    liquidRadius: [0.01, 0.2, 0.001],
    liquidTrail: [0.2, 5, 0.05],
    liquidInk: [0, 3, 0.01],
    liquidForce: [0, 3, 0.01],
    liquidSwirl: [0, 60, 0.5],
    liquidFollow: [2, 60, 0.5],
    liquidShine: [0, 3, 0.01],
  },
  Parallax: {
    parallaxMove: [0, 2, 0.01],
    parallaxLook: [0, 3, 0.01],
    parallaxSmooth: [0.02, 1, 0.01],
  },
};

const parsed = new Map();
export function setColor(target, hex) {
  if (parsed.get(target) !== hex) {
    target.set(hex);
    parsed.set(target, hex);
  }
  return target;
}
