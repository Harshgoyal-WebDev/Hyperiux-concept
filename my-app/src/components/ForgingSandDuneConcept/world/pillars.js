import * as THREE from "three";
import { P, zoneAt } from "../config";
import { mulberry32 } from "./layout";
import { flightDistance, lineZ, weaveAt } from "./duneCamera";

// The vertical rocks that grow up out of the sand past the mark, laid out
// along the flight line (world/duneCamera.js). Four are the key pillars,
// one per section of the copy, each carrying a glowing pin: they stand
// beside the line, alternately left and right, each where the camera sees
// it ahead of it while its stretch of the scroll is on. The rest are a
// field of smaller and larger rocks out across the dunes on both sides,
// and a few tall ones close by the line where the camera is as they turn to
// sand, so that is seen up close.
//
// A rock rises as the camera comes within RISE_FROM metres of it and
// stands by RISE_TO; once the whiteout starts, whatever is still under the sand
// comes up too, so the whole field is standing when it turns to sand.
export const RISE_FROM = 290;
export const RISE_TO = 160;
const KEY_AT = [0.12, 0.34, 0.56, 0.78]; // shares of the pillars zone
const KEY_AHEAD = 95; // ...where the camera is this far short of the rock
const KEY_SIDE = 36; // metres off the line
const FIELD = 26;
// the finale: [m past the camera's spot mid-dissolve, side, height]
const FINALE = [
  [55, -30, 30],
  [85, 38, 36],
  [120, -46, 28],
  [150, 30, 33],
];

// Lowest sand under a rock's footprint, so its base is buried all round.
function ground(terrain, x, z, r) {
  let min = Infinity;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    min = Math.min(min, terrain.height(x + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  return Math.min(min, terrain.height(x, z));
}

export function buildPillars(terrain) {
  const rng = mulberry32(211);
  const out = [];
  const add = (d, side, o) => {
    const x = weaveAt(d) + side;
    const z = lineZ(d);
    const width = o.width;
    out.push({
      index: out.length,
      d,
      x,
      z,
      base: ground(terrain, x, z, width * 0.7) - 1.6,
      height: o.height,
      width,
      depth: width * (0.7 + rng() * 0.25),
      seed: 401 + out.length * 13,
      rotY: rng() * Math.PI * 2,
      lean: (rng() - 0.5) * 0.08,
      content: o.content ?? -1,
    });
  };
  KEY_AT.forEach((k, i) => {
    const d = flightDistance(zoneAt("pillars", k)) + KEY_AHEAD;
    add(d, (i % 2 ? 1 : -1) * KEY_SIDE, { height: 24 + rng() * 8, width: 6 + rng() * 1.5, content: i });
  });
  // (all beyond rising range of the camera as it comes out of the mark, so
  // none is standing behind the slab before then)
  const first = flightDistance(P.out) + RISE_FROM + 20;
  const last = flightDistance(1) + 380;
  for (let i = 0; i < FIELD; i++) {
    const d = first + ((i + rng() * 0.8) / FIELD) * (last - first);
    const side = (rng() < 0.5 ? -1 : 1) * (55 + Math.pow(rng(), 1.4) * 230);
    const tall = rng() < 0.3;
    add(d, side, { height: tall ? 26 + rng() * 14 : 9 + rng() * 14, width: tall ? 5 + rng() * 3 : 3 + rng() * 3 });
  }
  const mid = flightDistance(zoneAt("dissolve", 0.4));
  for (const [ahead, side, height] of FINALE) add(mid + ahead, side, { height, width: 6 + rng() * 2 });
  return out;
}

// How far a rock has risen (0 under the sand → 1 standing) at p, with the
// camera's distance along the line.
// (e0 > e1 runs the other way)
const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
export function riseOf(pillar, p, camD) {
  if (p < P.through) return 0;
  const ahead = pillar.d - camD;
  const near = smooth(RISE_FROM, RISE_TO, ahead);
  const late = smooth(P.pillars, zoneAt("whiteout", 0.6), p);
  return Math.max(near, late);
}

// The world matrix of a rock at a rise (sunk by its height under the sand).
export function pillarMatrix(pillar, rise, out = new THREE.Matrix4()) {
  const sink = (1 - rise) * (pillar.height + 2);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pillar.lean, pillar.rotY, -pillar.lean * 0.7));
  return out.compose(
    new THREE.Vector3(pillar.x, pillar.base - sink, pillar.z),
    q,
    new THREE.Vector3(pillar.width, pillar.height, pillar.depth)
  );
}

// Where a key pillar's pin floats: over its top.
export function pinPosition(pillar, rise, out = new THREE.Vector3()) {
  const sink = (1 - rise) * (pillar.height + 2);
  return out.set(pillar.x, pillar.base - sink + pillar.height + 5, pillar.z);
}
