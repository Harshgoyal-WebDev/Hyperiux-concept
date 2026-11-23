import * as THREE from "three";
import { CUT_FROM, CUT_TO, OPENING_NOMINAL as O, P, RUN_FROM_Z } from "../config";
import { RUN_ARRIVAL, cameraSetsOffAt } from "../timeline";
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
const runFrom = () => Math.min(cameraSetsOffAt(), P.forged);
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
export const S_LAND = 880; // (world/oasis.js: at the end of the straight, as the curve to the right begins — the valley shot the cut opens on is already well up the way)
const N = 900;
let cache = null;
let cacheKey = "";
function table() {
  const key = `${P.through}:${P.held}:${P.canopy}:${cameraSetsOffAt()}:${CUT_FROM()}:${CUT_TO()}`;
  if (cache && key === cacheKey) return cache;
  const p0 = CUT_FROM();
  const p1 = P.canopy;
  const vArrive = runPace(P.through);
  // easing up from the cut's pace to the cruise: from as the hexagons have
  // all but covered the screen (the last fifth of the cut) over a good
  // stretch past it — no sudden step up as the cut ends (it was once a step:
  // the second scene shortened, its stretch ended before the cut did)
  const upFrom = CUT_TO() - (CUT_TO() - p0) * 0.2;
  const upTo = Math.max(P.glow, CUT_TO() + 0.04);
  const stopFrom = P.reveal + (P.canopy - P.reveal) * 0.15;
  const shape = (p, V) => {
    const run = p < P.through ? runPace(p) : vArrive;
    const up = smoother(upFrom, upTo, p);
    const down = 1 - THREE.MathUtils.smoothstep(p, stopFrom, p1);
    return THREE.MathUtils.lerp(run, V, up) * down;
  };
  const integrate = (V, a0, a1, out) => {
    let s = 0;
    const dp = (a1 - a0) / N;
    if (out) out[0] = 0;
    for (let k = 0; k < N; k++) {
      const a = a0 + k * dp;
      s += 0.5 * (shape(a, V) + shape(a + dp, V)) * dp;
      if (out) out[k + 1] = s;
    }
    return s;
  };
  // the cruise that, past the landing (S_LAND at CUT_TO), reaches the
  // route's end — then where that puts the cut's start
  let lo = 0;
  let hi = 1e5;
  for (let it = 0; it < 50; it++) {
    const mid = (lo + hi) / 2;
    if (S_LAND + integrate(mid, CUT_TO(), p1, null) < S_END) lo = mid;
    else hi = mid;
  }
  const V = (lo + hi) / 2;
  const s0 = S_LAND - integrate(V, p0, CUT_TO(), null);
  const cum = new Float32Array(N + 1);
  integrate(V, p0, p1, cum);
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
const CORE = new THREE.Vector3();
const AT = new THREE.Vector3();
const END = new THREE.Vector3();

// The fall and the reveal in step (T.syncFallReveal): the moment the first
// of the orb's poured threads land on the ground (CoreOrb.jsx: they leave at
// up to 16% of its burst, and land 42% of the way through their own) is
// when the oasis's reveal starts — its front spreading out with them — and
// the Yggdrasil starts growing, from its roots. So retiming the touch or the
// burst keeps them together; their lengths are T.revealSpan / T.treeGrowSpan.
export const landAt = () => T.tlBeamToTreeEnd + T.orbBurstSpan * 0.43;
export function syncEnding() {
  if (!T.syncFallReveal) return;
  const land = landAt();
  T.tlRevealStart = land;
  T.tlRevealEnd = land + T.revealSpan;
  T.tlTreeGrowStart = land;
  T.tlTreeGrowEnd = land + T.treeGrowSpan;
}

// how far the tree has grown at p (0 → 1: tuning.js tlTreeGrowStart / End)
// (linear, as the strands' own uGrow: Yggdrasil.jsx)
export const growAt = (p) => (syncEnding(), Math.min(Math.max((p - T.tlTreeGrowStart) / Math.max(T.tlTreeGrowEnd - T.tlTreeGrowStart, 0.002), 0), 1));
// the core at the lake's heart — the orb with our cube in it (scene/oasis/
// CoreOrb.jsx), where the beam ends: its centre's height
export const cubeY = () => WATER_Y + T.orbHeight;

// the angle the camera has gone round the tree by p: at one steady pace from
// tlOrbitStart (T.orbitSweep degrees over tlOrbitStart → tlOrbitEnd), eased
// in over its first moment — and on at that pace to the end of the page,
// through the glass into the site (no stop)
// (the turn round to the right starts already as the camera comes in to the
// tree — from part way through its run in, gathering pace until it is at
// the orbit's own pace as that starts — so it never stops between the two:
// it arrives turning, a little round to the right of the way it came)
const orbitFrom = () => lerp(T.tlBeamToTreeStart, Math.min(T.tlBeamToTreeEnd, T.tlOrbitStart), 0.4);
function orbitAngle(p) {
  const span = Math.max(T.tlOrbitEnd - T.tlOrbitStart, 0.002);
  const rate = THREE.MathUtils.degToRad(T.orbitSweep) / span;
  const from = orbitFrom();
  const d = Math.max(p - from, 0);
  const ramp = Math.max(T.tlOrbitStart - from, 0.012);
  return rate * (d < ramp ? (d * d) / (2 * ramp) : d - ramp / 2);
}

// The heading along the way, smoothed: the aim (ahead along the way, then
// turning to the core after the last curve) as one even turn to the right,
// following the beam — not a turn as the look ahead goes into the curve and
// then another as it swings round to the core. The raw heading at every 2 m,
// smoothed over T.camTurnSmooth m (a Gaussian), and handed back to the raw
// one over the last stretch to the stop (where it is aimed at the core).
const YAW_STEP = 2;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
let yawCache = null;
let yawKey = "";
function rawYaw(s) {
  routePoint(s, _a);
  routePoint(s + 46, _b);
  const toTree = smooth(S_RIM - 100, S_RIM + 15, s);
  _b.x = lerp(_b.x, TREE.x, toTree);
  _b.z = lerp(_b.z, TREE.z, toTree);
  return Math.atan2(_b.z - _a.z, _b.x - _a.x);
}
function yawTable() {
  const sigma = Math.max(T.camTurnSmooth, 0);
  const key = `${sigma}`;
  if (yawCache && key === yawKey) return yawCache;
  const n = Math.ceil(S_END / YAW_STEP) + 1;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    raw[i] = rawYaw(i * YAW_STEP);
    // (unwrapped: no jump of 2π)
    if (i > 0) raw[i] = raw[i - 1] + THREE.MathUtils.euclideanModulo(raw[i] - raw[i - 1] + Math.PI, Math.PI * 2) - Math.PI;
  }
  const out = new Float32Array(n);
  const r = Math.ceil((sigma * 3) / YAW_STEP);
  for (let i = 0; i < n; i++) {
    if (r < 1) {
      out[i] = raw[i];
      continue;
    }
    let sum = 0;
    let wsum = 0;
    for (let j = -r; j <= r; j++) {
      const k = Math.min(Math.max(i + j, 0), n - 1);
      const w = Math.exp(-0.5 * ((j * YAW_STEP) / sigma) ** 2);
      sum += raw[k] * w;
      wsum += w;
    }
    const sm = sum / wsum;
    const back = smoother(S_END - 70, S_END - 4, i * YAW_STEP);
    out[i] = lerp(sm, raw[i], back);
  }
  yawCache = out;
  yawKey = key;
  return out;
}
function smoothYaw(s) {
  const t = yawTable();
  const f = Math.min(Math.max(s / YAW_STEP, 0), t.length - 1);
  const i = Math.floor(f);
  return lerp(t[i], t[Math.min(i + 1, t.length - 1)], f - i);
}

// An extra turn round the tree (radians) on top of the orbit — set from the
// page: the footer turns the camera on round the tree as it is scrolled
// down to the bottom (ForgingConcept's follow loop, T.footerTurn)
export const extraTurn = { value: 0 };

export function oasisCamera(p, pos, tgt) {
  const s = routeDistance(p);
  routePoint(s, pos);
  pos.y = WATER_Y + eyeHeight(s);

  // the aim: along the way ahead, a touch down to the floor and the beam
  routePoint(s + 46, tgt);
  tgt.y = pos.y - 1.4;
  // ...and after the last curve, to the core at the lake's heart
  CORE.set(TREE.x, cubeY(), TREE.z);
  const toTree = smooth(S_RIM - 100, S_RIM + 15, s);
  if (toTree > 0) tgt.lerp(CORE, toTree);
  // (its heading: the one smooth turn — its height as it was)
  if (s < S_END) {
    const yaw = smoothYaw(s);
    const dist = Math.hypot(tgt.x - pos.x, tgt.z - pos.z);
    tgt.x = pos.x + Math.cos(yaw) * dist;
    tgt.z = pos.z + Math.sin(yaw) * dist;
  }
  let fov = lerp(50, 54, smooth(S_RIM, S_END, s));

  // following the beam in: as it runs on to the core, the camera goes with
  // it, coming to T.camCoreDist m from the core (on the side it came from,
  // T.camCoreLift m above its centre) as the beam touches it
  routePoint(S_END, END);
  const away = Math.atan2(END.z - CORE.z, END.x - CORE.x);
  // (where it comes in to is already turning round the tree: orbitAngle)
  const k = smoother(T.tlBeamToTreeStart, Math.max(T.tlBeamToTreeEnd, T.tlBeamToTreeStart + 0.002), p);
  if (k > 0 && p <= T.tlOrbitStart) {
    const a = away - orbitAngle(p);
    AT.set(CORE.x + Math.cos(a) * T.camCoreDist, CORE.y + T.camCoreLift, CORE.z + Math.sin(a) * T.camCoreDist);
    pos.lerp(AT, k);
    tgt.lerp(CORE, k);
  } else if (k > 0) tgt.copy(CORE);

  // then round the tree as it grows up out of the lake: steadily round it,
  // and steadily further off and higher until it stands complete (T.orbitRadius
  // m out — under the lake's 150 m, so the trees round it are never in the
  // way — T.orbitRise m over the water), its lens widening to T.orbitFov; the
  // aim up the tree with its growing top
  if (p > T.tlOrbitStart) {
    const x = Math.min(Math.max((p - T.tlOrbitStart) / Math.max(T.tlOrbitEnd - T.tlOrbitStart, 0.002), 0), 1);
    const e = x * x * (3 - 2 * x);
    const r = lerp(T.camCoreDist, T.orbitRadius, e);
    const a = away - orbitAngle(p) - extraTurn.value;
    pos.set(CORE.x + Math.cos(a) * r, lerp(CORE.y + T.camCoreLift, WATER_Y + T.orbitRise, e), CORE.z + Math.sin(a) * r);
    fov = lerp(fov, T.orbitFov, e);
  }
  const g = growAt(p);
  if (g > 0) {
    LOOK.set(TREE.x, lerp(CORE.y, WATER_Y + T.orbitLookTop, smooth(0, 1, g)), TREE.z);
    tgt.copy(LOOK);
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
export function revealRadiusAt(p) {
  syncEnding();
  const REVEAL_MAX = revealEnd() + 160;
  const from = T.tlRevealStart;
  const to = Math.max(T.tlRevealEnd, from + 0.002);
  const x = Math.min(Math.max((p - from) / (to - from), 0), 1);
  // (away at once as the poured light lands — no slow start, the oasis
  // coming up close behind it — easing out to its end)
  return REVEAL_MAX * Math.sin((Math.PI / 2) * x);
}
// (the journey's state follows it: set with the timeline's progress)
export function deriveReveal(J, p) {
  J.revealR = revealRadiusAt(p);
}
