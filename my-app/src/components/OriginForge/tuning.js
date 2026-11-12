import * as THREE from "three";

// Live-tunable look of the Origin Forge. The Leva panel (TuningPanel.jsx)
// writes straight into T; the scene reads it every frame, so dragging a
// control never re-renders React. The defaults here are the shipped look:
// tune in the panel, press "Copy values", and paste them back over these.
export const T = {
  // --- environment (the forge world, before the light)
  exposure: 1.22,
  saturation: 0.8, // under 1 pulls the red out
  warmth: -0.12, // negative cools toward neutral, positive warms
  contrast: 1.0,
  skyTop: "#121314",
  skyMid: "#2c2925",
  skyGlow: "#ffb37e",
  horizon: 0.72, // how strong the horizon's glow is
  fogColor: "#221f1c",
  fogDensity: 0.0135,
  hemiSky: "#9d958c",
  hemiGround: "#2a2520",
  hemiIntensity: 1.25,
  envIntensity: 0.38,
  rimColor: "#ffd6b3",
  rimIntensity: 1.1,
  stoneColor: "#6a625a",
  stoneGlow: 1.0, // the cracks' glow on the ruins

  // --- post
  bloomIntensity: 0.62,
  bloomThreshold: 0.85,
  vignette: 0.42,
  grain: 0.16,

  // --- mouse parallax (the whole scene)
  parallaxMove: 0.55, // metres the camera slides with the pointer
  parallaxLook: 0.9, // metres its gaze leans
  parallaxRoll: 0.6, // degrees it banks
  parallaxSmooth: 0.22, // seconds it lags behind the pointer

  // --- water (the plaza): as the garden's pond (ForgingConcept tuning pond*)
  waterDeep: "#0c0d0e",
  waterShallow: "#1f2326",
  reflectivity: 1.0, // how much of it is mirror
  distortion: 0.2, // how much the surface breaks up the reflection
  currentSpeed: 2.24,
  currentScale: 2.0, // size of the current's waves (higher = finer; the pond's is 4)
  currentStrength: 1.0,
  rippleStrength: 2.02, // how strongly the pointer's rings show
  rippleForce: 1.36, // how big a ring the pointer drops
  rippleRadius: 0.8, // metres
  rippleDamping: 0.98, // how long they run (closer to 1 = longer)
  rippleSpeed: 0.6, // how fast the rings spread
  glint: 1.0,
  glintColor: "#ffe2c4",

  // --- particles
  particleDensity: 0.42, // share of the motes drawn
  particleSize: 0.9,
  particleBrightness: 0.85,
  stirRadius: 0.1, // share of the screen's height round the pointer that it stirs
  stirForce: 4.0, // how hard it parts them
  stirDrag: 2.84, // how much they are carried along with its movement
  stirSpring: 60, // how firmly they hold their place
  stirDamping: 0.85, // how quickly their wobble dies
  stirFlow: 0.67, // how much the flow churns them while stirred
  stirScatter: 3.2, // seconds a stirred mote drifts before finding its way home

  // --- the energy cube over the plate
  coreSize: 1.0,
  coreHeight: 3.4,
  coreGlow: 1.0,
  coreSpin: 1.0,

  // --- the staircase (bronze and brass)
  bronze: "#8a5a34",
  bronzeWall: "#4b3322",
  brass: "#d0a85a",
  stairMetalness: 1.0,
  stairRoughness: 0.36,
  brassRoughness: 0.22,
  stairEnv: 1.15, // how much the hall's light it reflects
  nosingGlow: 1.0,
  eyeHeight: 1.65,
  lookAhead: 7.0, // metres up the flight the gaze rests
  climbSway: 0.0, // a stride's sway (0 = a smooth glide)
};

export const DEFAULTS = { ...T };

// Leva schema: [min, max, step], "color", grouped into folders.
export const SCHEMA = {
  Environment: {
    exposure: [0.4, 2.5, 0.01],
    saturation: [0, 1.5, 0.01],
    warmth: [-1, 1, 0.01],
    contrast: [0.6, 1.6, 0.01],
    skyTop: "color",
    skyMid: "color",
    skyGlow: "color",
    horizon: [0, 2, 0.01],
    fogColor: "color",
    fogDensity: [0, 0.04, 0.0005],
    hemiSky: "color",
    hemiGround: "color",
    hemiIntensity: [0, 4, 0.01],
    envIntensity: [0, 2, 0.01],
    rimColor: "color",
    rimIntensity: [0, 4, 0.01],
    stoneColor: "color",
    stoneGlow: [0, 3, 0.01],
  },
  Post: {
    bloomIntensity: [0, 3, 0.01],
    bloomThreshold: [0, 2, 0.01],
    vignette: [0, 1, 0.01],
    grain: [0, 0.6, 0.01],
  },
  Parallax: {
    parallaxMove: [0, 2, 0.01],
    parallaxLook: [0, 3, 0.01],
    parallaxRoll: [0, 4, 0.05],
    parallaxSmooth: [0.02, 1, 0.01],
  },
  Water: {
    waterDeep: "color",
    waterShallow: "color",
    reflectivity: [0, 1.5, 0.01],
    distortion: [0, 0.6, 0.005],
    currentSpeed: [0, 6, 0.01],
    currentScale: [0.2, 8, 0.05],
    currentStrength: [0, 3, 0.01],
    rippleStrength: [0, 6, 0.01],
    rippleForce: [0, 4, 0.01],
    rippleRadius: [0.1, 3, 0.05],
    rippleDamping: [0.9, 0.998, 0.001],
    rippleSpeed: [0.1, 1.0, 0.01],
    glint: [0, 4, 0.01],
    glintColor: "color",
  },
  Particles: {
    particleDensity: [0, 1, 0.01],
    particleSize: [0.2, 3, 0.01],
    particleBrightness: [0, 3, 0.01],
    stirRadius: [0.02, 0.4, 0.005],
    stirForce: [0, 12, 0.05],
    stirDrag: [0, 8, 0.01],
    stirSpring: [5, 150, 1],
    stirDamping: [0.6, 0.99, 0.005],
    stirFlow: [0, 3, 0.01],
    stirScatter: [0.2, 10, 0.1],
  },
  "Energy cube": {
    coreSize: [0.3, 2.5, 0.01],
    coreHeight: [1.5, 6, 0.01],
    coreGlow: [0, 3, 0.01],
    coreSpin: [0, 4, 0.01],
  },
  Staircase: {
    bronze: "color",
    bronzeWall: "color",
    brass: "color",
    stairMetalness: [0, 1, 0.01],
    stairRoughness: [0.02, 1, 0.01],
    brassRoughness: [0.02, 1, 0.01],
    stairEnv: [0, 3, 0.01],
    nosingGlow: [0, 3, 0.01],
    eyeHeight: [1, 3, 0.01],
    lookAhead: [2, 16, 0.1],
    climbSway: [0, 0.2, 0.005],
  },
};

// THREE.Color.set without re-parsing an unchanged string every frame
const parsed = new Map();
export function setColor(target, hex) {
  if (parsed.get(target) !== hex) {
    target.set(hex);
    parsed.set(target, hex);
  }
  return target;
}
export const color = (hex) => new THREE.Color(hex);
