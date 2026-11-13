import * as THREE from "three";
import { T } from "./tuning";

// The journey comes in two versions, one world:
//   dark  (/from-possibility)        night at the last of the light: dark
//                                    stone, a molten horizon, paneled metal
//                                    monoliths and floating sculptures
//   light (/from-possibility/light)  warm limestone in daylight
// Everything that differs between them is here. setTheme() is called by the
// page before the world mounts; scene modules read THEME as they build and
// every frame, and the tuning panel starts from the theme's values.

export const SUN_DIR = new THREE.Vector3(); // set by setTheme

const THEMES = {
  dark: {
    name: "dark",
    sun: [-0.2, 0.17, -0.96],
    sky: "night",
    clear: "#0d0e11",
    structures: true, // the metallic monoliths, rocks and sculptures
    floor: { roughness: 0.55, metalness: 0 },
    gallery: { glass: [0.07, 0.072, 0.08], frame: [0.62, 0.6, 0.58], ink: "243,238,232" },
    water: { deep: "#08090b", shallow: "#1d1c1b", sky: "#1d1f25", glint: [1.0, 0.62, 0.32], glintK: 2.2 },
    tree: { wood: "#2a211b", glow: 0.32 },
    art: "/assets/possibility/dark",
    tuning: {
      exposure: 1.1,
      sun: 1.6,
      sunColor: "#ffbf8f",
      hemi: 1.15,
      hemiSky: "#5c626e",
      hemiGround: "#121214",
      envIntensity: 0.6,
      fog: 1.0,
      fogColor: "#34363c",
      stone: "#3a3b3f",
      stoneDark: "#2a2b2f",
      stoneVariation: 1.6,
      floor: "#0f1013",
      floorReflection: 0.55,
      pathIntensity: 3.0,
      bloom: 1.3,
      bloomThreshold: 1.9,
      vignette: 0.62,
    },
  },
  light: {
    name: "light",
    sun: [0.52, 0.64, 0.42],
    sky: "day",
    clear: "#efe4d6",
    structures: false,
    floor: { roughness: 0.62, metalness: 0.05 },
    gallery: { glass: [0.96, 0.93, 0.89], frame: [1.0, 0.97, 0.93], ink: "23,22,21" },
    water: { deep: "#1f6f86", shallow: "#7fb6b9", sky: "#5aa0e6", glint: [1.0, 0.95, 0.86], glintK: 1.6 },
    tree: { wood: "#5b4636", glow: 0.08 },
    art: "/assets/possibility/light",
    // vivid daylight: warm sandstone under a blue sky that lights the
    // shadows blue, a pale blue haze in the distance
    tuning: {
      exposure: 1.05,
      sun: 1.55,
      sunColor: "#fff0d8",
      hemi: 1.25,
      hemiSky: "#8fc4ff",
      hemiGround: "#e9c79c",
      envIntensity: 0.7,
      fog: 0.32,
      fogColor: "#c6ddf3",
      stone: "#f3dcbd",
      stoneDark: "#e2bf93",
      stoneVariation: 2.4,
      floor: "#efd3ad",
      floorReflection: 0.24,
      pathIntensity: 3.0,
      bloom: 1.1,
      bloomThreshold: 1.7,
      vignette: 0.51,
    },
  },
};

export const THEME = { ...THEMES.dark };

export function setTheme(name) {
  const th = THEMES[name] || THEMES.dark;
  if (THEME.name === th.name && THEME._applied) return THEME;
  Object.assign(THEME, th, { _applied: true });
  SUN_DIR.set(...th.sun).normalize();
  Object.assign(T, th.tuning);
  return THEME;
}
