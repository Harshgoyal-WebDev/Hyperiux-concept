// The world's measure, taken from the mark itself.
//
// The centre cube of the official mark (public/hyperiux-icon-white.svg) is an
// exact orthographic view of a real box: its three edges from the front-top
// corner are the projections of three perpendicular edges, and solving for
// their depth gives a box of 66.46 × 66.37 × 65.08 (logo units), seen from
// 43.0° round and 28.1° up. That box is the world's cube: every cube on the
// page is it, and the camera that looks at it from that exact direction,
// nearly orthographic, sees the mark's cube line for line.
const F = [246.651, 306.756]; // front-bottom corner
const A = [295.242 - 246.651, 228 - 249.33]; // front-top → right-top
const B = [201.373 - 246.651, 226.5 - 249.33]; // front-top → left-top
const H = 306.756 - 249.33; // front-bottom → front-top

const ab = A[0] * B[0] + A[1] * B[1];
const ah = -A[1] * H;
const bh = -B[1] * H;
const zH = Math.sqrt((ah * bh) / -ab);
const eA = [A[0], -A[1], -ah / zH];
const eB = [B[0], -B[1], -bh / zH];
const eH = [0, H, zH];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => v.map((x) => x / len(v));
const uA = unit(eA);
const uB = unit(eB);
const uH = unit(eH);

// logo units per world unit (the cube's width is the world's 1)
export const K = len(eA);
// the cube: 1 wide (x), CUBE_H tall (y), CUBE_D deep (z, away from the
// mark's viewer: the left edge runs to -z)
export const CUBE_H = len(eH) / K;
export const CUBE_D = len(eB) / K;

// the mark's camera, as world directions: its right, its up, and the way
// back towards it from the cube
export const LOGO_RIGHT = [uA[0], uH[0], -uB[0]];
export const LOGO_UP = [uA[1], uH[1], -uB[1]];
export const LOGO_BACK = [uA[2], uH[2], -uB[2]];
export const LOGO_YAW = Math.atan2(LOGO_BACK[0], LOGO_BACK[2]);
export const LOGO_PITCH = Math.asin(LOGO_BACK[1]);

// the origin cube: front-bottom corner at the origin
export const CORE_MIN = [0, 0, -CUBE_D];
export const CORE_MAX = [1, CUBE_H, 0];
export const CORE_CENTRE = [0.5, CUBE_H / 2, -CUBE_D / 2];
const CS = [F[0] + (A[0] + B[0]) / 2, F[1] + (A[1] + B[1] - H) / 2]; // its centre, on the mark

// A point of the mark (logo units, y down) placed in the world: on the plane
// through the cube's centre that faces the mark's camera, so from there the
// mark and the cube line up exactly.
export function markToWorld(x, y) {
  const dx = (x - CS[0]) / K;
  const dy = -(y - CS[1]) / K;
  return [
    CORE_CENTRE[0] + dx * LOGO_RIGHT[0] + dy * LOGO_UP[0],
    CORE_CENTRE[1] + dx * LOGO_RIGHT[1] + dy * LOGO_UP[1],
    CORE_CENTRE[2] + dx * LOGO_RIGHT[2] + dy * LOGO_UP[2],
  ];
}

// the mark's middle (its 500 × 501 box), and its half height, in the world
export const MARK_CENTRE = markToWorld(250, 250.4);
export const MARK_HALF = (487.87 - 13) / 2 / K;
