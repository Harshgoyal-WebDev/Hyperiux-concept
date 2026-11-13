import * as THREE from "three";
import { mulberry32 } from "../../OriginForge/world/textures";

// The dark version's world (metres; y up; the journey runs toward -z), a
// wet plain at dusk ringed by mountains:
//
//   01 the origin      z  46 →  0    the plain, the far ridges, the low sun
//   02 the spark       z   0 → -62   two colossal monoliths and the light between
//   03 movement        z -62 → -180  ranks of monoliths, blocks lifting into the air
//   04 alignment       z -180 → -240 great arcs turning into one rhythm
//   05 assembly        z -190 → -300 the arcs become concentric rings, a tunnel
//   06 convergence     z -240 → -300 inside the rings, a glass cube
//   07 the core        z -270 → -300 the cube, alive with light
//   08 reveal          z -300 → -336 a great ring, dark within, the name
//   09 transition      z -300 → -340 the ring fills with light; the page

const rand = mulberry32(404);

// 02: the spark: two monoliths, a slit of light between them
export const SPARK = {
  z: -62,
  gap: 1.8,
  // (each leans a little away from the slit, so it opens toward the sky)
  left: { w: 16, h: 48, d: 8, lean: 0.018 },
  right: { w: 14, h: 54, d: 8, lean: -0.022 },
};

// 03: the ranks of monoliths either side of the way
export const MONOLITHS = (() => {
  const out = [];
  const add = (x, z, w, h, d, yaw, lean = 0, glow = 0) => out.push({ x, z, w, h, d, yaw, lean, glow });
  // ranks, left and right, from the spark to the arcs
  for (let i = 0; i < 16; i++) {
    const z = -78 - i * 7.5 - rand() * 3;
    const side = i % 2 ? 1 : -1;
    const x = side * (15 + rand() * 9);
    add(x, z, 4 + rand() * 4, 12 + rand() * 22, 3 + rand() * 3, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.06, rand() < 0.45 ? 1 : 0);
  }
  // further out: a second rank, taller, in the haze
  for (let i = 0; i < 22; i++) {
    const z = 20 - i * 17 - rand() * 6;
    const side = rand() < 0.5 ? -1 : 1;
    const x = side * (38 + rand() * 40);
    add(x, z, 5 + rand() * 7, 18 + rand() * 36, 3 + rand() * 4, rand() * Math.PI, (rand() - 0.5) * 0.08, rand() < 0.3 ? 1 : 0);
  }
  // the silhouettes on the horizon at the origin (beyond the spark)
  for (let i = 0; i < 8; i++) add(-60 + rand() * 120, -120 - rand() * 120, 4 + rand() * 6, 20 + rand() * 30, 3 + rand() * 3, rand() * Math.PI, 0, 0);
  return out;
})();

// 03: the blocks that lift into the air
export const FLOATERS = [
  { p: [-14, 3, -96], to: [-12, 16, -100], s: [4.4, 9, 3.2], r: [0.2, 0.5, -0.25] },
  { p: [12, 3, -108], to: [15, 21, -112], s: [5, 11, 3.6], r: [-0.18, -0.4, 0.3] },
  { p: [-20, 3, -128], to: [-22, 24, -130], s: [5.6, 12, 4], r: [0.24, 0.9, 0.18] },
  { p: [20, 3, -140], to: [24, 18, -146], s: [4.6, 10, 3.4], r: [-0.3, 0.2, -0.2] },
  { p: [-6, 3, -152], to: [-9, 28, -158], s: [5, 11, 3.6], r: [0.16, -0.7, 0.28] },
  { p: [8, 3, -166], to: [11, 23, -170], s: [4.2, 9, 3], r: [-0.22, 0.6, -0.3] },
];

// 04–06: the arcs that become rings. Each is a band of paneled metal (a
// ring sector, radius R, `thick` across, `depth` deep), first scattered and
// turned (align 0), then standing face-on but off-centre (align 1), then
// assembled coaxially round the way (assemble 1), opening at `gapAt`.
export const RING_CY = 7; // the rings' common centre height (their feet are in the ground)
export const RINGS = [
  { R: 30, thick: 2.6, depth: 4.2, z: -246, sweep: 300, gapAt: 0.6 },
  { R: 24, thick: 2.4, depth: 3.8, z: -258, sweep: 280, gapAt: 2.9 },
  { R: 19, thick: 2.2, depth: 3.4, z: -270, sweep: 300, gapAt: 4.4 },
  { R: 14.5, thick: 2.0, depth: 3.0, z: -282, sweep: 290, gapAt: 1.6 },
  { R: 11, thick: 1.8, depth: 2.8, z: -292, sweep: 310, gapAt: 3.6 },
].map((r, i) => ({
  ...r,
  // scattered: off to a side, turned to face across the way, tilted
  scattered: { x: (i % 2 ? 1 : -1) * (14 + i * 4), y: -2 - i, z: r.z + 30 - i * 4, rx: (rand() - 0.5) * 0.9, ry: (i % 2 ? -1 : 1) * (1.0 + rand() * 0.4), rz: rand() * 6 },
  // aligned: face-on, still off the axis, at a different turn
  aligned: { x: (i % 2 ? -1 : 1) * (3 + i * 1.4), y: 1.5 - i * 0.6, z: r.z + 8, rx: 0, ry: 0, rz: r.gapAt + 1.4 },
}));

// 06–07: the core, a cube of glass at the centre of the rings
export const CORE = { x: 0, y: 3.6, z: -301, edge: 5.6 };

// 08–09: the reveal: a great ring, dark within, then filling with light
export const REVEAL = { R: 26, thick: 3, depth: 5, z: -336, cy: 9 };

// The orange beam: out of the spark's slit, sweeping across the plain
// through the ranks, then straight down the tunnel of rings to the core
const P = (x, z) => new THREE.Vector3(x, 0.05, z);
export const NIGHT_PATH = new THREE.CatmullRomCurve3(
  [P(0, -63), P(0, -68), P(-7, -80), P(-17, -98), P(-12, -120), P(4, -136), P(14, -150), P(10, -166), P(2, -184), P(0, -205), P(0, -240), P(0, -270), P(0, CORE.z + CORE.edge / 2 + 0.6)],
  false,
  "centripetal"
);
NIGHT_PATH.arcLengthDivisions = 2000;
export const NIGHT_PATH_LENGTH = NIGHT_PATH.getLength();
