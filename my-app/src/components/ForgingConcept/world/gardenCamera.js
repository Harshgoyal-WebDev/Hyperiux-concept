import * as THREE from "three";
import { GARDEN, GARDEN_ORIGIN, P, sectionAt } from "../config";
import { T } from "../tuning";

// The camera in the garden: one continuous path, a pure function of the
// scroll. Out of the light past the GardenEntrance and in towards the pond;
// then one whole revolution round it, always looking at its middle, where the
// particle body takes its forms (the mark, the cube, the cloud, the ring);
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
// ridges round it (kept at least CLEAR over the ground, easing up onto it).
//
// Clearances (garden metres, pond widened 1.9×): the nearest trunks stand
// ~25 m from C; the revolution keeps 18–21 m out, 3–4.6 m up (over the
// bushes on the bank), and dips lowest under the cloud.

const C = GARDEN.shapes.mark;
const CLEAR = 2.6;
// the ground's height under (x, z) (garden metres), set by Garden
let ground = null;
export const setGardenGround = (sample) => {
  ground = sample;
};
const DEG = Math.PI / 180;
// p, angle (deg), distance, height, aim: height, past C, left; lens, orbit
const K = (p, angle, r, y, aimY, ahead, left, fov, orbit) => ({ p, angle: angle * DEG, r, y, aimY, ahead, left, fov, orbit });
let keys = null;
function build() {
  return [
    // where the light lets go (the desert's last shot, in garden metres)
    K(P.through, 0, 32, 2.685, 2.085, 8.3, 0, 44, 0),
    K(P.out, 0, 25.5, 2.9, 4.6, 0, 0, 48, 0),
    // 1 the mark, square to the camera, the copy beneath it
    K(P.formed, 0, 21, 3.3, 5.7, 0, 0, 46, 1),
    K(sectionAt("mark", 0.7), 18, 19, 3.6, 5.8, 0, 0, 46, 1),
    // 2 on round: the cube right of the copy
    K(sectionAt("cube", 0.5), 100, 17, 4.4, 6.0, 0, 1.8, 46, 1),
    // 3 lower, looking up into the cloud
    K(sectionAt("cloud", 0.5), 190, 16, 3.0, 7.0, 0, 1.8, 52, 1),
    // 4 on round to the way in, square to the ring
    K(sectionAt("ring", 0.3), 290, 17.5, 4.2, 6.2, 0, 0, 46, 1),
    K(sectionAt("ring", 0.75), 360, 17, 4.6, 6.4, 0, 0, 46, 1),
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

// world position / aim at scroll p into pos / aim; returns the lens (deg)
export function gardenCamera(p, pos, aim) {
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
  // over the ridges: never closer than CLEAR to the ground, easing up onto it
  const g = ground?.(pos.x, pos.z);
  if (orbit > 0 && Number.isFinite(g)) {
    const d = pos.y - (g + CLEAR);
    if (d < 1.5) pos.y += (1.5 * Math.exp((d - 1.5) / 1.5) - d) * orbit;
  }
  // looking at C (forward is -(sin, 0, cos), left is (-cos, 0, sin))
  const ahead = at((k) => k.ahead);
  const left = at((k) => k.left);
  aim.set(C.x - sin * ahead - cos * left, at((k) => k.aimY), C.z - cos * ahead + sin * left);
  pos.add(GARDEN_ORIGIN);
  aim.add(GARDEN_ORIGIN);
  return at((k) => k.fov) + T.gardenFovOffset;
}
