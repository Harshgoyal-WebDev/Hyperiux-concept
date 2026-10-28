import * as THREE from "three";
import { T } from "../tuning";

// The wind swirl around the forged mark that the broken rock's sand and
// gravel are carried into (placed in the vertex shader): up to MAX_LANES
// orbits — level, diagonal, counter-rotating — that breathe in and out and
// ride a slow vertical wave. All of it is live in the panel: how many
// orbits, the innermost one's radius and the gap between neighbours, how
// thick each orbit's tube is, how far the particles fill in towards the
// mark, a lean / roll / turn for the whole swirl, and each orbit's own
// angles, height, squash and speed.
//
// Every particle carries only its place in the swirl (which orbit, by a
// seed; its phase and pace; where it sits in the tube's cross-section and
// how far it fills in); the orbits themselves are uniforms, so the controls
// rearrange the swirl without rebuilding anything.
export const MAX_LANES = 8;
const DEG = Math.PI / 180;
export const WAVE = 1.5; // m, vertical wave amplitude
export const BREATHE = 0.06; // share of the radius the swirl breathes in and out

// n particles' places in the swirl: per particle the aOrbit / aPlane
// attribute values (see ORBIT_GLSL). `pace` scales the layer's speed.
export function makeOrbits(n, pace, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    // a uniform point in the tube's round cross-section
    const r = Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    out.push({
      orbit: [rng(), rng() * Math.PI * 2, pace * (0.85 + rng() * 0.3), rng() * 2 - 1],
      plane: [Math.cos(a) * r, Math.sin(a) * r, rng(), rng()],
    });
  }
  return out;
}

// One set of orbit uniforms shared by every layer in the swirl (sand,
// soil, gravel); syncOrbit() writes the panel's values into it.
export const ORBIT_UNIFORMS = {
  uLaneA: { value: Array.from({ length: MAX_LANES }, () => new THREE.Vector4()) }, // radius, squash, tilt, roll
  uLaneB: { value: Array.from({ length: MAX_LANES }, () => new THREE.Vector4()) }, // turn, height, speed
  uLaneCount: { value: 5 },
  uOrbitTilt: { value: 0 },
  uOrbitRoll: { value: 0 },
  uOrbitTurn: { value: 0 },
  uOrbitSpread: { value: 0 },
  uOrbitThick: { value: 0 },
};
export function syncOrbit() {
  const u = ORBIT_UNIFORMS;
  for (let i = 0; i < MAX_LANES; i++) {
    const k = `orbit${i + 1}`;
    u.uLaneA.value[i].set(T.orbitRadius + i * T.orbitGap, T[`${k}Squash`], T[`${k}Tilt`] * DEG, T[`${k}Roll`] * DEG);
    u.uLaneB.value[i].set(T[`${k}Turn`] * DEG, T[`${k}Height`], T[`${k}Speed`], 0);
  }
  u.uLaneCount.value = Math.min(Math.max(Math.round(T.orbitCount), 1), MAX_LANES);
  u.uOrbitTilt.value = T.orbitTilt * DEG;
  u.uOrbitRoll.value = T.orbitRoll * DEG;
  u.uOrbitTurn.value = T.orbitTurn * DEG;
  u.uOrbitSpread.value = T.orbitSpread;
  u.uOrbitThick.value = T.orbitThickness;
}

// The orbit, reading attributes:
//   aOrbit: orbit seed, phase, pace, radius jitter (-1..1)
//   aPlane: place in the tube's cross-section (unit disc), fill-in, spare
export const ORBIT_GLSL = /* glsl */ `
attribute vec4 aOrbit;
attribute vec4 aPlane;
uniform vec3 uCenter;
uniform float uClock;
uniform float uTime;
uniform float uOpen;
uniform vec4 uLaneA[${MAX_LANES}]; // radius (m), squash, tilt, roll (rad)
uniform vec4 uLaneB[${MAX_LANES}]; // turn (rad), height (m), speed (rad/s)
uniform float uLaneCount;
uniform float uOrbitTilt; // the whole swirl's lean about x, roll about z, turn about y (rad)
uniform float uOrbitRoll;
uniform float uOrbitTurn;
uniform float uOrbitSpread; // 0: on the orbits; 1: filled in all the way to the mark
uniform float uOrbitThick; // the orbit tube's diameter (m)
vec3 orbitPos() {
  int li = int(min(floor(aOrbit.x * uLaneCount), uLaneCount - 1.0));
  vec4 A = uLaneA[li];
  vec4 B = uLaneB[li];
  float breathe = (1.0 + ${BREATHE.toFixed(3)} * sin(uTime * 0.37 + aOrbit.y * 3.0)) * (1.0 + uOpen * 0.9);
  float r = A.x * (1.0 + aOrbit.w * 0.02) * breathe * (1.0 - uOrbitSpread * aPlane.z);
  float th = aOrbit.y + B.z * aOrbit.z * uClock;
  vec2 tube = aPlane.xy * 0.5 * uOrbitThick;
  vec3 p = vec3(cos(th) * (r + tube.x), sin(th * 2.0 + aOrbit.y + uTime * 0.5) * ${WAVE.toFixed(2)} + tube.y, sin(th) * (r + tube.x) * A.y);
  float c = cos(A.z + uOrbitTilt), s = sin(A.z + uOrbitTilt);
  p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  c = cos(A.w + uOrbitRoll); s = sin(A.w + uOrbitRoll);
  p = vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
  c = cos(B.x + uOrbitTurn); s = sin(B.x + uOrbitTurn);
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  // a little individual drift on the wind
  p += vec3(sin(uTime * 0.31 + aOrbit.y * 7.0), sin(uTime * 0.23 + aOrbit.y * 11.0), cos(uTime * 0.27 + aOrbit.y * 5.0)) * 0.4;
  return p + uCenter + vec3(0.0, B.y, 0.0);
}
`;
