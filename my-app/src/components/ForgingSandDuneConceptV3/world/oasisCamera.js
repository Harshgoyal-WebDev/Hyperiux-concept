import * as THREE from "three";
import { CUT_FROM, CUT_TO, OPENING_NOMINAL as O, P, RUN_FROM_Z } from "../config";
import { RUN_ARRIVAL, brokenAt } from "../timeline";
import { T } from "../tuning";
import { S_END, S_RIM, TREE, WATER_Y, route } from "./oasis";
import { revealEnd } from "./revealMap";

// The camera past the mark: from the cut (as it closes on the logo, the
// frame turns over in cubes onto the valley beyond: scene/CutTransition.js)
// to the end of the journey, a pure function of the scroll, so every p maps
// to exactly one shot. It is low in the dune valley from the first, a few
// metres over the sand, moving on along the winding way (world/oasis.js)
// and round its bends as the oasis rises out of the desert around it.
// After the last curve it turns to the tree — roots first, then up into its
// crown as it comes in over the lake — and stays there, the tree lighting up
// as the scroll goes on, until the light opens onto the site.

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
const smoother = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const lerp = (a, b, t) => a + (b - a) * t;

// The cut's span (config.js).
export { CUT_FROM, CUT_TO };

// The logo shot's run at the opening (timeline.js shots: from the still
// shot at RUN_FROM_Z, once the rock has ground to sand, to the opening at
// P.through, eased by runIn) — its pace at p, metres per unit of p — and how
// far it carries on past the opening at its arrival pace (CameraRig: the
// logo shot keeps moving while the cut runs).
const runIn = (x) => 0.4 * x + 0.6 * (1 - Math.cos((x * Math.PI) / 2));
const runInSlope = (x) => 0.4 + 0.6 * (Math.PI / 2) * Math.sin((x * Math.PI) / 2);
const START_Z = 0.3;
const runFrom = () => Math.min(brokenAt(), P.forged);
function runPace(p) {
  const span = P.through - runFrom();
  const x = Math.min(Math.max((p - runFrom()) / span, 0), 1);
  return ((RUN_FROM_Z - START_Z) * runInSlope(x)) / span;
}
function runCovered(p0, p1) {
  const span = P.through - runFrom();
  const x = (p) => Math.min(Math.max((p - runFrom()) / span, 0), 1);
  return (RUN_FROM_Z - START_Z) * (runIn(x(p1)) - runIn(x(p0)));
}
export function runOnPast(p) {
  return Math.max(p - P.through, 0) * (((RUN_FROM_Z - START_Z) * RUN_ARRIVAL) / (P.through - runFrom()));
}

// Distance along the route at p, from one smooth pace (metres per unit of
// p): through the cut exactly the logo shot's pace (the two are seen at
// once, cell by cell: their motion matches); out of it, easing up to a
// steady cruise; and in the last stretch easing down to a stop at the
// route's end, over the lake (the rise as the light opens takes over). The
// cut lands at S_LAND — on the stream between the trees, the oasis rising
// round the camera from just behind it (world/oasis.js REVEAL_ORIGIN).
export const S_LAND = 800;
const N = 900;
let cache = null;
let cacheKey = "";
function table() {
  const key = `${P.through}:${P.held}:${P.canopy}:${brokenAt()}:${CUT_FROM()}:${CUT_TO()}`;
  if (cache && key === cacheKey) return cache;
  const p0 = CUT_FROM();
  const p1 = P.canopy;
  const vArrive = runPace(P.through);
  const ease = (P.passage - CUT_TO()) * 0.45; // (to cruise over the first part of the first moment)
  const stopFrom = P.reveal + (P.canopy - P.reveal) * 0.15;
  const shape = (p, V) => {
    if (p < CUT_TO()) return runPace(Math.min(p, P.through));
    const up = THREE.MathUtils.smoothstep(p, CUT_TO(), CUT_TO() + ease);
    const down = 1 - THREE.MathUtils.smoothstep(p, stopFrom, p1);
    return THREE.MathUtils.lerp(vArrive, V, up) * down;
  };
  const integrate = (V, out) => {
    let s = 0;
    const dp = (p1 - p0) / N;
    if (out) out[0] = 0;
    for (let k = 0; k < N; k++) {
      const a = p0 + k * dp;
      s += 0.5 * (shape(a, V) + shape(a + dp, V)) * dp;
      if (out) out[k + 1] = s;
    }
    return s;
  };
  // the cut's own distance, then the cruise that reaches the route's end
  let covered = 0;
  {
    const dp = (CUT_TO() - p0) / 200;
    for (let k = 0; k < 200; k++) covered += 0.5 * (shape(p0 + k * dp, 0) + shape(p0 + (k + 1) * dp, 0)) * dp;
  }
  const s0 = S_LAND - covered;
  let lo = 0;
  let hi = 1e5;
  for (let it = 0; it < 50; it++) {
    const mid = (lo + hi) / 2;
    if (s0 + integrate(mid, null) < S_END) lo = mid;
    else hi = mid;
  }
  const cum = new Float32Array(N + 1);
  integrate((lo + hi) / 2, cum);
  cache = { p0, p1, s0, cum };
  cacheKey = key;
  return cache;
}
export function routeDistance(p) {
  const { p0, p1, s0, cum } = table();
  if (p <= p0) return s0;
  if (p >= p1) return S_END;
  const f = ((p - p0) / (p1 - p0)) * N;
  const k = Math.floor(f);
  return s0 + cum[k] + (cum[Math.min(k + 1, N)] - cum[k]) * (f - k);
}

// a point of the route at arc length s (past its end, on towards the tree)
const tmp = new THREE.Vector3();
export function routePoint(s, out) {
  if (s <= S_END) return route.getPointAt(Math.max(s, 0) / S_END, out);
  route.getPointAt(1, out);
  route.getTangentAt(1, tmp);
  return out.addScaledVector(tmp, s - S_END);
}

// The beam out of the logo's core comes down to the valley floor over its
// first metres (behind the camera, which is in the valley from the cut on).
export const descentAt = (s) => smoother(0, 90, s);
export const cameraHeightAt = (s) => lerp(O.y, WATER_Y + eyeHeight(s), descentAt(s));

// the eye's height over the water: low along the passage, lower over the lake
// (rising a little over the lake, to look down onto the island and the roots
// going into the water rather than along the water's surface at them)
const eyeHeight = (s) => lerp(T.eyePassage, T.eyeLake, smooth(S_RIM, S_END, s));

const LOOK = new THREE.Vector3();

// how far the tree has grown at p (0 → 1: tuning.js tlTreeGrowStart / End)
// (linear, as the strands' own uGrow: Yggdrasil.jsx)
export const growAt = (p) => Math.min(Math.max((p - T.tlTreeGrowStart) / Math.max(T.tlTreeGrowEnd - T.tlTreeGrowStart, 0.002), 0), 1);
// the cube at the lake's heart (where the tree grows from): its centre
export const cubeY = () => WATER_Y + 0.78 + T.cubeHover + T.cubeSize * 0.5;

export function oasisCamera(p, pos, tgt) {
  const s = routeDistance(p);
  routePoint(s, pos);
  pos.y = WATER_Y + eyeHeight(s);

  // the aim: along the way ahead, a touch down to the floor and the beam
  routePoint(s + 46, tgt);
  tgt.y = pos.y - 1.4;
  // ...and after the last curve, to the cube at the lake's heart (the sweep
  // racing out from it across the desert, the beam running on into it);
  // as the tree grows out of it, up with its growing top
  const toTree = smooth(S_RIM - 100, S_RIM + 15, s);
  const g = growAt(p);
  if (toTree > 0) {
    // (up with the tree's growing top as it draws up out of the cube)
    const look = lerp(cubeY() - WATER_Y + 2, T.orbitLookTop, smooth(0.05, 1, g));
    LOOK.set(TREE.x, WATER_Y + look, TREE.z);
    tgt.lerp(LOOK, toTree);
  }
  let fov = lerp(50, 54, smooth(S_RIM, S_END, s));

  // round the tree as it draws up out of the cube (with the scroll): a
  // long swing round the trunk, in closer on the way, rising and drawing
  // back as the tree climbs to its full height — staying out over the lake
  // (T.orbitRadius under its 150 m: the ring of trees round it is never in
  // the way), the lens widening to take in the whole tree
  const o = smoother(T.tlOrbitStart, Math.max(T.tlOrbitEnd, T.tlOrbitStart + 0.002), p);
  if (o > 0) {
    const dx = pos.x - TREE.x;
    const dz = pos.z - TREE.z;
    const r0 = Math.hypot(dx, dz);
    // (and once round, still drifting on round it — slowly, steadily — as
    // the white ink spreads over the screen at the end: no stop)
    const drift = Math.max(p - T.tlOrbitEnd, 0) / Math.max(1 - T.tlOrbitEnd, 0.002);
    const a = Math.atan2(dz, dx) - THREE.MathUtils.degToRad(T.orbitSweep * o + T.orbitDrift * drift);
    const r = lerp(r0, T.orbitRadius, o) - T.orbitIn * Math.sin(Math.PI * o);
    const y = lerp(pos.y, WATER_Y + T.orbitRise, Math.pow(o, 1.4));
    pos.set(TREE.x + Math.cos(a) * r, y, TREE.z + Math.sin(a) * r);
    fov = lerp(fov, T.orbitFov, o);
  }

  return fov;
}

// The oasis rising out of the desert (world/oasis.js REVEAL_ORIGIN, at the
// tree): the valley is bare sand all along the way, until — after the last
// curve — the camera turns to where the tree will be; from there, the
// lake's middle, the front spreads out across the desert (under the camera
// and on, back up the way it came), the tree first, then the lake, the
// stream and the green behind it. Its radius (m) at p.
// (by default it starts as the camera reaches S_RIM − 100 m, where it
// begins its turn; tuning.js tlRevealStart / tlRevealEnd)
// (to the clock by which all of it has come up, and its plants grown:
// world/revealMap.js)
// (as the reference's: setting off slowly from the cube, then racing out
// across the desert — an eased-in-out curve, bent towards its end)
export function revealRadiusAt(p) {
  const REVEAL_MAX = revealEnd() + 160;
  const from = T.tlRevealStart;
  const to = Math.max(T.tlRevealEnd, from + 0.002);
  const x = Math.min(Math.max((p - from) / (to - from), 0), 1);
  const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  return REVEAL_MAX * Math.pow(e, 1.7);
}
// (the journey's state follows it: set with the timeline's progress)
export function deriveReveal(J, p) {
  J.revealR = revealRadiusAt(p);
}
