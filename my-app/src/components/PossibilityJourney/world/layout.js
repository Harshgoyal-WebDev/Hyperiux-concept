import * as THREE from "three";

// Where everything stands in the one continuous world (metres; y up; the
// journey runs toward -z). Each chapter's architecture begins as the last
// one's ends, so the camera never leaves one space for an unrelated one.
//
//   01 opening      z   44 →    0   the sculptural shell and its great opening
//   02 the path     z    0 →  -92   sweeping curved walls, the path appears
//   03 challenge    z  -96 → -172   a passage of arches; the path breaks
//   04 approach     z -176 → -230   a hall; four glass slabs rise
//   05 impact       z -242 → -305   a gallery of the work, under a skylight
//   06 possibility  z -321 → -363   a courtyard open to the sky, a tree in
//                                   a basin of water; a drop, a ripple, the page

export const COURT = { cx: 0, cz: -342, R: 21, height: 15, oculus: 11 };
// the basin round the tree: its rim, and the water inside it
export const BASIN = { R: 6.6, wall: 0.55, rim: 0.95, water: 0.72 };

// chapter 03: the arches across the passage
export const ARCHES = Array.from({ length: 12 }, (_, i) => ({ z: -100 - i * 6.2 }));

// chapter 04: the four glass slabs, staggered in depth, turned to the camera
export const PANEL = { w: 4.2, h: 6.0, d: 0.22, yaw: -0.5 };
export const PANELS = [0, 1, 2, 3].map((i) => new THREE.Vector3(-8 + i * 5.6, 0, -192 - i * 4.4));

// chapter 05: the planes of the work
export const PLANE = { w: 8.4, h: 5.25, y: 3.4, yaw: -0.55 };
export const PLANES = [0, 1, 2, 3].map((i) => new THREE.Vector3(5.6 + i * 1.1, PLANE.y, -254 - i * 12.5));
export const GALLERY_Z = -276; // the gallery's long wall and roof, centred

// chapter 06: the walk round the tree ends looking down at the water from
// this side (angle round the courtyard), where the drop falls
export const FINALE = (() => {
  const a = THREE.MathUtils.degToRad(30);
  const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const centre = new THREE.Vector3(COURT.cx, 0, COURT.cz);
  const spot = centre.clone().addScaledVector(dir, 3.4).setY(BASIN.water);
  return { a, dir, centre, spot };
})();

const front = (p, yaw, d) => new THREE.Vector3(p.x + Math.sin(yaw) * d, 0, p.z + Math.cos(yaw) * d);

// The orange path: one line through the whole journey, on the floor
const P = (x, z) => new THREE.Vector3(x, 0.05, z);
export const PATH_POINTS = [
  // 02: it rises out of the floor beyond the opening and curves away
  P(0, -4),
  P(0.3, -12),
  P(2.6, -28),
  P(-3.2, -48),
  P(1.8, -68),
  P(0, -86),
  // 03: straight down the passage of arches (broken there)
  P(0, -100),
  P(0.4, -132),
  P(0, -164),
  // 04: across the hall, joining the foot of each slab
  P(-2.4, -178),
  P(-6.4, -187),
  ...PANELS.map((p) => front(p, PANEL.yaw, 1.4).setY(0.05)),
  P(6.4, -209),
  P(2.6, -220),
  P(1.2, -232),
  P(2.6, -244),
  // 05: along the foot of each plane of the gallery
  ...PLANES.map((p) => front(p, PLANE.yaw, 1.0).setY(0.05)),
  P(6.0, -298),
  P(2.0, -308),
  // 06: into the courtyard, straight to the basin, where it meets the water
  P(0.2, -318),
  P(0, -326),
  P(0, COURT.cz + BASIN.R + 0.7),
];

export const pathCurve = new THREE.CatmullRomCurve3(PATH_POINTS, false, "centripetal");
pathCurve.arcLengthDivisions = 2000;
export const PATH_LENGTH = pathCurve.getLength();

// the stretch of the path (0–1) that the challenge breaks up
export const PATH_GAPS = (() => {
  let a = 0;
  let b = 1;
  const N = 600;
  for (let i = 0; i <= N; i++) {
    const p = pathCurve.getPointAt(i / N);
    if (a === 0 && p.z < -96) a = i / N;
    if (p.z < -170) {
      b = i / N;
      break;
    }
  }
  return [a, b];
})();

// the sun's direction depends on the version (theme.js): low ahead at dusk
// for the dark one, high behind the right shoulder for the light one
export { SUN_DIR } from "../theme";
