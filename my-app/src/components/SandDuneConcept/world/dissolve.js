import * as THREE from "three";
import { WIND_DIR } from "../config";

// JS twin of DISSOLVE in glsl.js — keep the two in lockstep.
function wave(x, y, z) {
  return (
    Math.sin(x * 0.37 + Math.sin(z * 0.23) * 1.7) *
    Math.sin(y * 0.41 + Math.sin(x * 0.29) * 1.9) *
    Math.sin(z * 0.33 + Math.sin(y * 0.31) * 1.3)
  );
}
function pattern(x, y, z) {
  return 0.6 * wave(x, y, z) + 0.4 * wave(x * 2.7 + 11, y * 2.7 + 11, z * 2.7 + 11);
}
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

export function threshold(p, cfg) {
  const n = pattern(p.x, p.y, p.z) * 0.5 + 0.5;
  let e;
  if (cfg.mode === 0) {
    const dx = Math.abs(p.x - cfg.center.x) / cfg.extent.x;
    const dy = Math.abs(p.y - cfg.center.y) / cfg.extent.y;
    e = 1 - clamp01(Math.max(dx, dy));
  } else if (cfg.mode === 1) {
    e = 1 - clamp01(p.y / cfg.extent.y);
  } else {
    e = clamp01((p.x * cfg.axis.x + p.z * cfg.axis.y - cfg.extent.x) / (cfg.extent.y - cfg.extent.x));
  }
  return cfg.range[0] + (cfg.range[1] - cfg.range[0]) * clamp01(e * 0.75 + n * 0.25);
}

// Progress windows within the single 0..1 dissolve value: the monolith
// goes first, then the rocks. The dunes never turn to dust — on the white
// they remain as a contour drawing that flattens out (see the sand
// material); the trail hands over to the 2D line.
export const DISSOLVE_RANGES = {
  monolith: [0.0, 0.55],
  rocks: [0.12, 0.72],
  terrain: [2.0, 3.0],
};
// How long (in dissolve units) a released grain of ash drifts before it is gone.
export const PARTICLE_LIFE = 0.26;

// Terrain dissolves from upwind to downwind: axis points against the wind,
// extent.x is the upwind edge (e = 0, first to go), extent.y downwind.
export const TERRAIN_AXIS = new THREE.Vector2(-WIND_DIR.x, -WIND_DIR.y);
export const TERRAIN_EXTENT = new THREE.Vector3(210, -150, 0);

export function makeDissolveConfig(kind, opts = {}) {
  if (kind === "monolith") {
    return {
      mode: 0,
      range: DISSOLVE_RANGES.monolith,
      center: opts.center,
      extent: opts.extent,
      axis: TERRAIN_AXIS,
    };
  }
  if (kind === "rocks") {
    return {
      mode: 1,
      range: DISSOLVE_RANGES.rocks,
      center: new THREE.Vector3(),
      extent: new THREE.Vector3(1, 34, 1),
      axis: TERRAIN_AXIS,
    };
  }
  return {
    mode: 2,
    range: DISSOLVE_RANGES.terrain,
    center: new THREE.Vector3(),
    extent: TERRAIN_EXTENT,
    axis: TERRAIN_AXIS,
  };
}

export function dissolveUniforms(cfg) {
  return {
    uDisRange: { value: new THREE.Vector2(cfg.range[0], cfg.range[1]) },
    uDisCenter: { value: cfg.center.clone() },
    uDisExtent: { value: cfg.extent.clone() },
    uDisAxis: { value: cfg.axis.clone() },
    uDisMode: { value: cfg.mode },
  };
}
