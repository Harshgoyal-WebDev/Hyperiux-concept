import * as THREE from "three";
import { GARDEN, GARDEN_ORIGIN } from "../config";
import { T } from "../tuning";

// The camera in the garden: one continuous path, a pure function of the
// scroll (J.gardenT, 0 as the camera comes through the light → 1 at the end).
// It carries straight on out of the light past the GardenEntrance, then
// revolves round the pond along its edges — out to the right, round the back
// of the logo while the particles gather and form, and back round the left
// to a three-quarter view of the finished mark. It always looks at the logo
// once it is in the garden. The path is rebuilt only when its controls
// (T.gardenCam*) change.
//
// Clearances (garden metres, around the logo's foot at (0, -2)): the nearest
// trees stand ~15 m out (at 44°, 154° and -16°) and only knee-high bushes
// and rocks lie closer, so an orbit ~12.5 m out (wider only right at the
// front) keeps clear of every trunk at ~4 m eye height.

const LOGO = GARDEN.logo;
const DEG = Math.PI / 180;
let cache = null;

function build() {
  const base = T.gardenCamRadius;
  const height = T.gardenCamHeight;
  const sweep = T.gardenCamSweep;
  // radius round the logo: wider at the front (the entrance side)
  const at = (deg) => {
    const s = Math.max(Math.sin(deg * DEG), 0);
    const r = base * (1 + 0.5 * Math.pow(s, 6));
    return new THREE.Vector3(Math.cos(deg * DEG) * r, height + 0.25 * Math.sin(deg * DEG * 2), LOGO.z + Math.sin(deg * DEG) * r);
  };
  const pts = [
    new THREE.Vector3(0, GARDEN.entrance.y, GARDEN.entrance.z + 6), // where the light lets go
    new THREE.Vector3(0, GARDEN.entrance.y + 0.3, GARDEN.entrance.z - 1.5),
  ];
  // round the pond: from just right of the front, the long way round
  for (let a = 72; a >= 90 - sweep; a -= 30) pts.push(at(a));
  if ((90 - sweep - 72) % 30 !== 0) pts.push(at(90 - sweep));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  return { key: `${base}|${height}|${sweep}`, curve };
}

// speed along the path: full pace out of the light, easing off into the
// final view over the last `settle` of it
const ease = (x, settle) => {
  const v = 1 / (1 - settle / 2);
  return x <= 1 - settle ? v * x : 1 - (v * (1 - x) * (1 - x)) / (2 * settle);
};

const ahead = new THREE.Vector3();
const logo = new THREE.Vector3();

// world position / aim / lens at garden time t (0..1), into p / q; returns fov
export function gardenCamera(t, p, q) {
  const key = `${T.gardenCamRadius}|${T.gardenCamHeight}|${T.gardenCamSweep}`;
  if (!cache || cache.key !== key) cache = build();
  const u = ease(Math.min(Math.max(t, 0), 1), 0.3);
  cache.curve.getPointAt(u, p);
  // looking down the corridor out of the light, then at the logo
  ahead.set(0, GARDEN.entrance.y - 0.6, GARDEN.entrance.z - 34);
  logo.set(LOGO.x, LOGO.y - 0.3, LOGO.z);
  q.copy(ahead).lerp(logo, THREE.MathUtils.smoothstep(u, 0, 0.14));
  p.add(GARDEN_ORIGIN);
  q.add(GARDEN_ORIGIN);
  return THREE.MathUtils.lerp(44, T.gardenCamFov, THREE.MathUtils.smoothstep(u, 0, 0.12));
}
