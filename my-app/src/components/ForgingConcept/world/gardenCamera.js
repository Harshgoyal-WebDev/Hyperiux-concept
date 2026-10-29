import * as THREE from "three";
import { GARDEN, GARDEN_ORIGIN, P, sectionAt } from "../config";
import { T } from "../tuning";

// The camera in the garden: one continuous path, a pure function of the
// scroll. Out of the light (already at its own height over the meadow) and
// in towards the pond;
// then one whole revolution round it, always looking at its middle, where the
// particle body takes its forms (the mark, the cube, the infinity, the torus);
// back where it came in, square to the ring, it flies through it into the
// light.
//
// The path is kept in polar terms about the body's centre (C): the angle
// round it (0 = the entrance side, +z), the distance from it (negative =
// beyond it, on the way through), the camera's height, where it looks (a
// height over C, how far past C, and how far to the camera's left, which
// puts the body right of the copy), and the lens. Each key is a moment on
// the scroll; between keys every channel follows a cubic Hermite curve whose
// tangents come from the neighbouring keys *and their timing* (a time-aware
// Catmull-Rom), so the camera's speed changes smoothly through every key —
// it never stops and starts — and it sweeps round the circle instead of
// cutting across it. Keys marked orbit take T.gardenOrbitRadius and
// T.gardenOrbitHeight, widen a little with the pond, and rise over the
// ridges round it: how far it has to rise to stay CLEAR over the ground is
// worked out along the whole path once (the path is fixed by the scroll),
// then widened and smoothed out along it, so it glides up over a ridge and
// down again instead of following every bump under it.
//
// Clearances (garden metres, pond widened 1.9×): the nearest trunks stand
// ~25 m from C; the revolution keeps 18–21 m out, about 4.6 m up (over the
// bushes on the bank).

const C = GARDEN.shapes.mark;
const CLEAR = 2.6;
// the ground's height under (x, z) (garden metres), set by Garden
let ground = null;
export const setGardenGround = (sample) => {
  ground = sample;
  lift = null;
};
// the rise over the ridges along the path: LIFT_N samples from P.through to
// the end, rebuilt when the ground or the orbit's controls change
const LIFT_N = 720;
const LIFT_SPREAD = 24; // samples: how far ahead and behind a ridge it starts / stays up
let lift = null;
let liftKey = "";
const DEG = Math.PI / 180;
// p, angle (deg), distance, height, aim: height, past C, left; lens, orbit
const K = (p, angle, r, y, aimY, ahead, left, fov, orbit) => ({ p, angle: angle * DEG, r, y, aimY, ahead, left, fov, orbit });
let keys = null;
function build() {
  return [
    // where the light lets go (the desert's last shot is all light, so the
    // garden opens straight onto its own height: up, looking out over it)
    // (the orbit's widening applies all the way in, so the camera only ever
    // closes in on the mark: never in, then back out to the orbit)
    K(P.through, 0, 32, 4.6, 5.4, 8.3, 0, 44, 1),
    K(P.out, 0, 25.5, 4.6, 5.8, 0, 0, 48, 1),
    // one revolution, a quarter of it to each form, at an even pace (the
    // camera at the middle of its quarter halfway through the section); it
    // runs anticlockwise from above
    // 1 the mark, square to the camera, the copy beneath it
    K(P.formed, 0, 19, 4.6, 6.0, 0, 0, 46, 1),
    K(sectionAt("mark", 0.5), 45, 17.2, 4.6, 6.0, 0, 0, 46, 1),
    // 2 the cube right of the copy
    K(sectionAt("cube", 0.5), 135, 17, 4.6, 6.1, 0, 1.8, 46, 1),
    // 3 the infinity, its particles flowing round its loops
    K(sectionAt("cloud", 0.5), 225, 17, 4.6, 7.2, 0, 1.8, 46, 1),
    // 4 the torus, coming round square to it
    K(sectionAt("ring", 0.5), 315, 17, 4.6, 6.3, 0, 0, 46, 1),
    K(sectionAt("portal", 0), 360, 17, 4.6, 6.4, 0, 0, 46, 1),
    // into the ring and through it
    K(sectionAt("portal", 0.55), 360, 5, 6.3, 6.4, 4, 0, 50, 0),
    K(1, 360, -1.5, 6.4, 6.4, 12, 0, 56, 0),
  ];
}

// time-aware tangent at key i, for one channel
const tangent = (ks, i, get) => {
  const a = ks[Math.max(i - 1, 0)];
  const b = ks[Math.min(i + 1, ks.length - 1)];
  return (get(b) - get(a)) / Math.max(b.p - a.p, 1e-6);
};

function hermite(ks, i, s, dt, get) {
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * get(ks[i]) +
    (s3 - 2 * s2 + s) * dt * tangent(ks, i, get) +
    (-2 * s3 + 3 * s2) * get(ks[i + 1]) +
    (s3 - s2) * dt * tangent(ks, i + 1, get)
  );
}

const liftPos = new THREE.Vector3();
const liftAim = new THREE.Vector3();
function buildLift() {
  const raw = new Float32Array(LIFT_N);
  for (let i = 0; i < LIFT_N; i++) {
    const p = P.through + (i / (LIFT_N - 1)) * (1 - P.through);
    const orbit = path(p, liftPos, liftAim);
    const g = ground(liftPos.x, liftPos.z);
    raw[i] = Number.isFinite(g) ? Math.max(g + CLEAR - liftPos.y, 0) * orbit : 0;
  }
  // widened (each ridge's rise held over its neighbours), then smoothed twice
  // (so it is at least as high as it must be, and eases in and out)
  const wide = new Float32Array(LIFT_N);
  for (let i = 0; i < LIFT_N; i++) {
    let m = 0;
    for (let j = Math.max(i - LIFT_SPREAD, 0); j <= Math.min(i + LIFT_SPREAD, LIFT_N - 1); j++) m = Math.max(m, raw[j]);
    wide[i] = m;
  }
  const blur = (src) => {
    const out = new Float32Array(LIFT_N);
    for (let i = 0; i < LIFT_N; i++) {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(i - LIFT_SPREAD, 0); j <= Math.min(i + LIFT_SPREAD, LIFT_N - 1); j++, n++) sum += src[j];
      out[i] = sum / n;
    }
    return out;
  };
  return blur(blur(wide));
}
function liftAt(p) {
  if (!ground || p < P.through) return 0;
  const key = `${T.gardenOrbitRadius}|${T.gardenOrbitHeight}|${T.pondSize}`;
  if (!lift || key !== liftKey) {
    lift = buildLift();
    liftKey = key;
  }
  const x = THREE.MathUtils.clamp((p - P.through) / (1 - P.through), 0, 1) * (LIFT_N - 1);
  const i = Math.min(Math.floor(x), LIFT_N - 2);
  return lift[i] + (lift[i + 1] - lift[i]) * (x - i);
}

// world position / aim at scroll p into pos / aim; returns the lens (deg)
export function gardenCamera(p, pos, aim) {
  path(p, pos, aim);
  pos.y += liftAt(p);
  pos.add(GARDEN_ORIGIN);
  aim.add(GARDEN_ORIGIN);
  return path.fov;
}

// the path itself (garden metres, before the rise over the ridges): into
// pos / aim; returns how far into the orbit it is (0..1), and leaves the lens
// in path.fov
function path(p, pos, aim) {
  if (!keys) keys = build();
  const ks = keys;
  let i = 0;
  while (i < ks.length - 2 && p > ks[i + 1].p) i++;
  const dt = Math.max(ks[i + 1].p - ks[i].p, 1e-6);
  const s = THREE.MathUtils.clamp((p - ks[i].p) / dt, 0, 1);
  const at = (get) => hermite(ks, i, s, dt, get);
  const orbit = THREE.MathUtils.clamp(at((k) => k.orbit), 0, 1);
  const angle = at((k) => k.angle);
  const wide = T.gardenOrbitRadius * (1 + (T.pondSize - 1.5) * 0.3);
  const r = at((k) => k.r) * (1 + (wide - 1) * orbit);
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  pos.set(C.x + sin * r, at((k) => k.y) + T.gardenOrbitHeight * orbit, C.z + cos * r);
  // looking at C (forward is -(sin, 0, cos), left is (-cos, 0, sin))
  const ahead = at((k) => k.ahead);
  const left = at((k) => k.left);
  aim.set(C.x - sin * ahead - cos * left, at((k) => k.aimY), C.z - cos * ahead + sin * left);
  path.fov = at((k) => k.fov) + T.gardenFovOffset;
  return orbit;
}
