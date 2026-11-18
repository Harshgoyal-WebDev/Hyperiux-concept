import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { mulberry32 } from "./layout";
import { T } from "../tuning";

// ---------------------------------------------------------------------------
// The oasis past the mark
// ---------------------------------------------------------------------------
// Out of the cube's opening the camera comes down into a narrow, winding
// passage between monumental dunes (three blind bends and a last curve),
// which slowly comes to life — shrubs, rocks, then a stream, grass, palms —
// widening all the while, until the last curve opens onto a great round
// oasis: a lake ringed by palms and green, and on an island at its heart the
// Yggdrasil, where the energy streaks all meet.
//
// Everything about its shape lives here, so the terrain, the water, the
// vegetation, the streaks and the camera all agree on it. World metres; the
// camera comes out of the opening at z ≈ 0 heading towards -z.

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// The water's surface (the stream and the lake).
export const WATER_Y = -0.6;

// The round oasis at the end: its centre, the radius of its level floor
// (the dunes rise beyond it), the lake, and the island the tree stands on.
export const BASIN = { x: 170, z: -1044, floor: 215, lake: 150, island: 26 };

// The Yggdrasil (a placeholder is built until public/models/yggdrasil.glb
// exists): its foot, height, and its core — where the streaks meet, in the
// trunk below the crown.
export const TREE = {
  x: BASIN.x,
  z: BASIN.z,
  height: 108,
  canopy: 62, // crown radius
  core: new THREE.Vector3(BASIN.x, WATER_Y + 24, BASIN.z),
};

// The route: the passage's centreline (x, z), and on into the oasis over
// the lake to the camera's last stop before the tree.
const ROUTE_POINTS = [
  [0, 0.3], // inside the opening (oasisCamera START_Z)
  [0, -80],
  [4, -160], // the entrance: narrow
  [-22, -250], // bend 1, to the left
  [-40, -330],
  [-8, -420], // bend 2, to the right
  [40, -490],
  [58, -570],
  [36, -650], // bend 3, to the left
  [-10, -710],
  [-48, -770],
  [-60, -840], // the last curve, round to the right…
  [-36, -900],
  [6, -930], // …out onto the oasis
  [44, -955],
  [78, -980], // the last stop, over the lake
];
export const route = new THREE.CatmullRomCurve3(
  ROUTE_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  "centripetal"
);
export const ROUTE_LENGTH = route.getLength();

// A dense polyline (every ~2 m) and a coarse one (every ~20 m) for fast
// nearest-point queries: the coarse one finds the stretch, the dense one
// the point.
const FINE_STEP = 2;
const FINE = route.getSpacedPoints(Math.ceil(ROUTE_LENGTH / FINE_STEP)).map((p) => [p.x, p.z]);
const FINE_DS = ROUTE_LENGTH / (FINE.length - 1);
const COARSE_EVERY = 10;

// Where along the route (arc length, m) a given landmark is.
function sNearest(x, z) {
  let best = Infinity;
  let bi = 0;
  for (let i = 0; i < FINE.length; i += COARSE_EVERY) {
    const dx = x - FINE[i][0];
    const dz = z - FINE[i][1];
    const d = dx * dx + dz * dz;
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  return bi;
}
export const S_ENTRANCE = sNearest(4, -160) * FINE_DS;
export const S_RIM = sNearest(6, -930) * FINE_DS; // out onto the oasis
export const S_END = ROUTE_LENGTH;

// The nearest point of the route to (x, z): its arc length s, the distance
// d to it, and which side (signed lateral distance, + to the route's right).
const hit = { s: 0, d: 0, lat: 0 };
export function nearestOnRoute(x, z, out = hit) {
  const c = sNearest(x, z);
  let best = Infinity;
  const lo = Math.max(c - COARSE_EVERY - 2, 0);
  const hi = Math.min(c + COARSE_EVERY + 2, FINE.length - 1);
  for (let i = lo; i < hi; i++) {
    const ax = FINE[i][0];
    const az = FINE[i][1];
    const bx = FINE[i + 1][0] - ax;
    const bz = FINE[i + 1][1] - az;
    const len2 = bx * bx + bz * bz || 1;
    const t = Math.min(Math.max(((x - ax) * bx + (z - az) * bz) / len2, 0), 1);
    const px = ax + bx * t - x;
    const pz = az + bz * t - z;
    const d2 = px * px + pz * pz;
    if (d2 < best) {
      best = d2;
      out.s = (i + t) * FINE_DS;
      // + when (x, z) is to the right of the way forward (the side
      // cross(forward, up) points to: Streaks lays the beam out by it)
      const cross = bx * (z - az) - bz * (x - ax);
      out.d = Math.sqrt(d2);
      out.lat = cross > 0 ? out.d : -out.d;
    }
  }
  return out;
}

// The passage's profile along the route: half-width of its level floor, and
// the stream's half-width and its meander off the centreline.
// (the water and the first life come in soon after the mark; the stream
// is a few metres wide from the start, widening into a river by the oasis)
// (T.oasisStreamWidth scales the stream; the valley floor widens with it so
// the banks keep their room. Changing it reshapes the land: RESHAPE_EVENT.)
export function streamHalfWidth(s) {
  const w = 2.2 * smooth(105, 190, s) + 2.3 * smooth(190, 380, s) + 2.5 * smooth(380, 600, s) + 3 * smooth(600, 800, s) + 3 * smooth(800, S_RIM, s);
  return w * T.oasisStreamWidth;
}
export function floorHalfWidth(s) {
  const extra = Math.max(streamHalfWidth(s) - streamHalfWidth(s) / Math.max(T.oasisStreamWidth, 1e-3), 0);
  if (s < 170) return lerp(46, 15, smooth(70, 170, s)) + extra;
  return 15 + 7 * smooth(170, 380, s) + 6 * smooth(380, 620, s) + 8 * smooth(620, 880, s) + extra;
}
export const RESHAPE_EVENT = "forging-sand-dune-concept-v3:reshape";
export function meander(s) {
  return (Math.sin(s * 0.021 + 1.3) * 0.6 + Math.sin(s * 0.047) * 0.4) * Math.min(floorHalfWidth(s) - streamHalfWidth(s) - 2, 5) * 0.8;
}
// How alive the passage is at s: bare sand at the entrance, green by the oasis.
export function lifeAt(s) {
  return smooth(110, 700, s);
}
// how far the oasis has set in along the route (none near the mark)
const carveAt = (s) => smooth(30, 120, s);

// ---------------------------------------------------------------------------
// The oasis at a point of the ground
// ---------------------------------------------------------------------------
// Returns (into `o`):
//   s, d, lat  where along the route it is, and how far off it
//   r          distance from the basin's centre
//   e          signed distance outside the oasis floor (< 0: on the floor)
//   w          signed distance outside the water (< 0: in the water)
//   carve      how far the oasis has set in here (0 near the mark)
//   life       how alive the land is here (0..1)
const BOUNDS = { x0: -600, x1: 940, z0: -1800, z1: 140 };
const noiseA = createNoise2D(mulberry32(301));
const noiseB = createNoise2D(mulberry32(307));

export function oasisAt(x, z, o = {}) {
  o.inside = x > BOUNDS.x0 && x < BOUNDS.x1 && z > BOUNDS.z0 && z < BOUNDS.z1;
  if (!o.inside) {
    o.e = Infinity;
    o.w = Infinity;
    o.carve = 0;
    o.life = 0;
    return o;
  }
  nearestOnRoute(x, z, hit);
  const s = hit.s;
  o.s = s;
  o.d = hit.d;
  o.lat = hit.lat;
  o.r = Math.hypot(x - BASIN.x, z - BASIN.z);
  // the passage's floor (a little ragged at its foot) and the basin's
  const rag = noiseA(x * 0.02, z * 0.02) * 3;
  const passage = hit.d - floorHalfWidth(s) + rag;
  const basin = o.r - BASIN.floor + rag * 2;
  o.e = Math.min(passage, basin);
  // the stream (meandering in its bed) and the lake round the island
  const stream = s < S_END - 4 ? Math.abs(hit.lat - meander(s)) - streamHalfWidth(s) + noiseB(x * 0.05, z * 0.05) * 0.6 : Infinity;
  const lake = Math.max(o.r - BASIN.lake - noiseB(x * 0.012, z * 0.012) * 10, BASIN.island - o.r);
  o.w = Math.min(stream, lake);
  // (none round the mark; fading out into the open desert far off)
  o.carve = carveAt(s) * (1 - smooth(380, 520, o.e));
  o.life = Math.max(lifeAt(s) * smooth(60, 0, passage), smooth(BASIN.floor + 40, BASIN.floor - 30, o.r));
  o.basin = o.r < BASIN.floor + 20;
  return o;
}

// Ground height on the oasis floor (the banks, the stream's bed, the lake,
// the island) given oasisAt's water distance.
function floorHeight(o, x, z) {
  if (o.w < 0) {
    // under the water: shelving off from the bank
    const lakeSide = o.r < BASIN.lake + 30;
    // (shelving gently: no step at the water's edge)
    const depth = lakeSide ? Math.min(-o.w * 0.09, 5.5) : Math.min(-o.w * 0.16, 1.5);
    return WATER_Y - 0.02 - depth;
  }
  // the banks rise gently from the water; the island to a low mound
  let h = WATER_Y + 0.03 + 1.4 * smooth(0, 22, o.w);
  h += noiseA(x * 0.08, z * 0.08) * 0.25 * smooth(0, 3, o.w);
  // the island: barely above the lake, rising a little into the trunk's foot
  if (o.r < BASIN.island) h = Math.min(h, WATER_Y + 0.08 + 0.7 * smooth(BASIN.island, 6, o.r));
  return h;
}

// The massif of tall, wind-carved dunes round the oasis: rising steeply
// from the floor's edge to crests 28–58 m high, falling away into the
// desert beyond. Smooth backs, sharp-ish crests (ridged noise), irregular.
function massif(e, x, z) {
  // (a soft |n|: rounded crests, no knife edges for the mesh to saw-tooth)
  const n = noiseB(x * 0.0065 + 3.1, z * 0.0065);
  const ridge = Math.max(1 - (Math.sqrt(n * n + 0.012) - Math.sqrt(0.012)), 0);
  // (lower near the mark, so the hero's backdrop stays the low dunes)
  const near = 0.45 + 0.55 * smooth(-150, -420, z);
  const height = (28 + 30 * ridge * ridge + noiseA(x * 0.004, z * 0.004) * 6) * near;
  const rise = smooth(0, 70, e);
  const fall = 1 - smooth(160, 460, e);
  // a softer foot (no step up from the floor)
  return height * Math.pow(rise, 1.3) * fall;
}

// a smooth max (no crease where the desert's dunes rise through the massif)
function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

// Ground height with the oasis carved into the desert's height `base`.
const scratch = {};
export function oasisHeight(base, x, z) {
  const o = oasisAt(x, z, scratch);
  if (!o.inside) return base;
  const k = o.carve;
  if (k <= 0) return base;
  let h;
  if (o.e < 0) h = floorHeight(o, x, z);
  else {
    // (rising from the floor's own height at its edge: no crease at the foot)
    const edge = Math.max(floorHeight(o, x, z), WATER_Y + 0.05);
    const wall = edge + massif(o.e, x, z);
    h = lerp(wall, smax(base, wall, 6), smooth(0, 90, o.e));
    // the desert in the oasis's reach never dips to the water
    h = Math.max(h, WATER_Y + 1.2);
  }
  return lerp(base, h, k);
}

// The oasis rising out of the desert (J.revealR): its front spreads out
// from here — the lake's middle, where the tree stands — once the camera
// turns to it after the last curve (world/oasisCamera.js revealRadiusAt).
// The band behind the front over which things come up is REVEAL_BAND m wide.
export const REVEAL_ORIGIN = new THREE.Vector2(TREE.x, TREE.z);
export const REVEAL_BAND = 45;
// how far the oasis has come up at (x, z) by the reveal's clock R (0..1):
// when each spot comes up is world/revealMap.js's (set here once built;
// until then, a ring out from the tree)
let startAt = (x, z) => Math.hypot(x - REVEAL_ORIGIN.x, z - REVEAL_ORIGIN.y);
export function setRevealStart(fn) {
  startAt = fn;
}
export function revealAt(x, z, R) {
  return Math.min(Math.max((R - startAt(x, z)) / REVEAL_BAND, 0), 1);
}

// The oasis region a few systems cover (water plane, ground map): x0, z0,
// x1, z1.
export const OASIS_RECT = { x0: -200, z0: -1300, x1: 420, z1: -120 };
