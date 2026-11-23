"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { T } from "../../tuning";
import { P, VALLEY_LAYER } from "../../config";
import { buildStrands } from "../ForgeBeam";
import { SABER_FRAGMENT_PARS, SABER_VERTEX_BODY, SABER_VERTEX_PARS, STRAND_FRAGMENT, STRAND_VERTEX, createSaberCap, saberUniforms, streakUniforms, syncSaber, syncStreaks } from "../saber";
import { S_END, S_RIM, TREE, WATER_Y, meander, route } from "../../world/oasis";
import { CUT_FROM, CUT_TO, cameraHeightAt, cubeY, descentAt, routeDistance } from "../../world/oasisCamera";

// The energy beam past the mark: the same beam the visitor first sees — the
// bundle of strands that brought the energy into the logo's core. As the
// camera goes through the opening it runs on out of the core, drops to just
// over the sand and races on ahead of the camera down the passage, then
// along the stream; at the end it comes in low over the lake, runs up one of
// the tree's roots and into its core (J.converge), in a flash
// (J.corePulse, Yggdrasil.jsx).
//
// It is laid out along the route (world/oasis.js) by a height and a
// sideways offset, kept clear of the sand, and its head runs a set lead
// ahead of the camera. (More streaks can be added to RIBBONS: a canopy end
// winds round the crown and dives in through it.)

// h: height over the water (m), lat: sideways off the route (+ right),
// lead: how far ahead of the camera its head runs (m), end: how it comes
// into the tree (a root's index, or round the crown: dir ±1, its height)
export const RIBBONS = [
  // the beam out of the core, low along the way and then the stream
  { count: 1, width: 1, spacing: 1.2, seed: 5, bright: 1, h: () => 0.75, lat: (s) => meander(s), lead: 150, end: { root: 0 } },
];
// how many strands the streaks are (T.beamStreaks; fixed: built once)
const STREAK_COUNT = 18;
// The head's run, a pure function of the scroll (so where the beam is, and
// when it touches the core, are known for any p): it runs its lead ahead of
// the camera; then — from the moment carrying on at its own pace would bring
// it to the core just as it touches (tlBeamToTreeEnd) — on into the core at
// that pace (a cubic matched to its place and pace at both ends). No hold
// short of the lake, no stop and start: one continuous run.
// (past the cut it starts behind the camera — none of it in view as the
// valley comes in — and comes up past it to its lead: T.valleyBeamBehind /
// T.valleyBeamCatchUp)
// (it is drawn out on the scroll from part-way through the cut — the valley
// showing through its hexagons with the beam already running out ahead —
// T.valleyBeamFrom of the cut, reaching its lead T.valleyBeamCatchUp past it)
const beamFrom = () => THREE.MathUtils.lerp(CUT_FROM(), CUT_TO(), T.valleyBeamFrom);
const beamUpTo = () => Math.max(CUT_TO() + T.valleyBeamCatchUp, beamFrom() + 0.004);
const freeAt = (b, p, camS = routeDistance(p)) => {
  const lead = b.rib.lead * T.oasisBeamLead * (0.45 + 0.55 * descentAt(camS));
  const k = THREE.MathUtils.smoothstep(p, beamFrom(), beamUpTo());
  return camS + THREE.MathUtils.lerp(-T.valleyBeamBehind, lead, k);
};
let runKey = "";
let run = null;
function runIn(b) {
  const pb = T.tlBeamToTreeEnd;
  const key = `${T.oasisBeamLead}:${pb}:${T.tlCutStart}:${T.tlCutEnd}:${b.qMax}:${P.canopy}:${T.valleyBeamBehind}:${T.valleyBeamCatchUp}:${T.valleyBeamFrom}`;
  if (run && key === runKey) return run;
  const dp = 0.0005;
  const pace = (p) => (freeAt(b, p + dp) - freeAt(b, p - dp)) / (2 * dp);
  let pa = -1;
  let fastest = CUT_TO();
  let fastestV = 0;
  for (let p = beamUpTo() + 0.005; p < pb - 0.003; p += dp) {
    const v = pace(p);
    if (v > fastestV) {
      fastestV = v;
      fastest = p;
    }
    if (freeAt(b, p) + v * (pb - p) >= b.qMax) {
      pa = p;
      break;
    }
  }
  // (never quick enough to make it: it speeds up from its fastest instead)
  const found = pa >= 0;
  if (!found) pa = Math.min(fastest, pb - 0.003);
  const q0 = freeAt(b, pa);
  const span = pb - pa;
  const avg = Math.max((b.qMax - q0) / span, 1);
  // (paces kept under 3× the average: the cubic never runs backwards)
  const v0 = Math.min(Math.max(pace(pa), 0), 2.8 * avg);
  const v1 = found ? Math.min(v0, 2.8 * avg) : avg;
  run = { pa, pb, q0, q1: b.qMax, m0: v0 * span, m1: v1 * span };
  runKey = key;
  return run;
}
// One pace for the camera and the beam (T.camBeamPace): from the cut to the
// touch the camera moves along the beam evenly (leaving the cut at the cut's
// own pace — no rush, no lag — a cubic in p), and the beam's head runs a lead
// ahead of it that grows smoothly from its lead out of the cut to
// T.camTouchDist, so the head reaches the cube exactly at the touch with the
// camera T.camTouchDist behind it. After the touch the camera carries on at
// that pace (the rig hands it over to the turn round the tree).
let paceKey = "";
let pace = null;
function paceOf(b) {
  const pc = CUT_TO();
  const pt = Math.max(T.tlBeamToTreeEnd, pc + 0.01);
  const key = `${pc}:${pt}:${b.qMax}:${T.camTouchDist}:${T.oasisBeamLead}:${T.valleyBeamBehind}:${T.valleyBeamCatchUp}:${T.valleyBeamFrom}:${P.canopy}`;
  if (pace && key === paceKey) return pace;
  const dp = 0.0005;
  const q0 = routeDistance(pc);
  const v0 = (routeDistance(pc + dp) - routeDistance(pc - dp)) / (2 * dp);
  const q1 = b.qMax - Math.max(T.camTouchDist, 5);
  const span = pt - pc;
  const avg = (q1 - q0) / span;
  // (its pace out of the cut, held under 2.5× the average: never backwards)
  const m0 = Math.min(Math.max(v0, 0), 2.5 * avg) * span;
  // the lead the head has at the cut (catching up past the camera), and its
  // lead at the touch
  const lead0 = freeAt(b, pc, q0) - q0;
  pace = { pc, pt, q0, q1, m0, m1: avg * span, avg, lead0 };
  paceKey = key;
  return pace;
}
// the camera's place along the beam at p (m), with the pace on
export function cameraQAt(p) {
  const b = mainBeam;
  if (!b) return null;
  const c = paceOf(b);
  if (p <= c.pc) return routeDistance(p);
  // (after the touch: easing to a stop — its pace dying away over ~0.012)
  if (p >= c.pt) return Math.min(c.q1 + c.avg * 0.012 * (1 - Math.exp(-(p - c.pt) / 0.012)), b.qMax - 8);
  const x = (p - c.pc) / (c.pt - c.pc);
  const x2 = x * x;
  const x3 = x2 * x;
  return (2 * x3 - 3 * x2 + 1) * c.q0 + (x3 - 2 * x2 + x) * c.m0 + (-2 * x3 + 3 * x2) * c.q1 + (x3 - x2) * c.m1;
}
function pacedHead(b, p) {
  const c = paceOf(b);
  if (p >= c.pt) return { q: b.qMax, k: 1 };
  const x = (p - c.pc) / (c.pt - c.pc);
  // (its lead: the cut's catch-up first — as freeAt — then growing to the touch's)
  const k = THREE.MathUtils.smoothstep(p, beamFrom(), beamUpTo());
  const full = b.rib.lead * T.oasisBeamLead;
  const lead = THREE.MathUtils.lerp(-T.valleyBeamBehind, THREE.MathUtils.lerp(full, Math.max(T.camTouchDist, 5), THREE.MathUtils.smootherstep(x, 0, 1)), k);
  return { q: Math.min(cameraQAt(p) + lead, b.qMax), k: THREE.MathUtils.smoothstep(x, 0.85, 1) };
}

// the head's place along a streak at p (m along it), and how far through
// its run into the core it is (k: 1 once it touches)
function headAt(b, i, p, camS) {
  if (T.camBeamPace && p > CUT_TO()) return pacedHead(b, p);
  const r = runIn(b);
  if (p >= r.pb) return { q: b.qMax, k: 1 };
  if (p <= r.pa) return { q: Math.min(freeAt(b, p, camS), b.qMax), k: 0 };
  const x = (p - r.pa) / (r.pb - r.pa);
  const x2 = x * x;
  const x3 = x2 * x;
  const q = (2 * x3 - 3 * x2 + 1) * r.q0 + (x3 - 2 * x2 + x) * r.m0 + (-2 * x3 + 3 * x2) * r.q1 + (x3 - x2) * r.m1;
  return { q: Math.min(q, b.qMax), k: x };
}
// Where the beam is at p — its head, and a point `behind` metres back along
// it — for the camera to ride it in (scene/Rig.jsx): the same pure function
// of the scroll as the beam itself, so camera and beam move in step, frame
// for frame. false until the beam is built.
let mainBeam = null;
const qToU = (b, q) => {
  let j = 0;
  while (j < b.qs.length - 2 && b.qs[j + 1] < q) j++;
  const f = THREE.MathUtils.clamp((q - b.qs[j]) / Math.max(b.qs[j + 1] - b.qs[j], 1e-3), 0, 1);
  return THREE.MathUtils.lerp(b.us[j], b.us[j + 1], f);
};
// the beam's whole length (m, to the cube at the lake's heart)
export const beamLength = () => mainBeam?.qMax ?? 0;
// a point of the beam q metres along it (along the way: its route distance)
export function beamPointAt(q, out) {
  const b = mainBeam;
  if (!b) return false;
  b.curve.getPointAt(Math.min(qToU(b, THREE.MathUtils.clamp(q, 0, b.qMax)), 1), out);
  return true;
}
export function beamFrameAt(p, behind, head, back) {
  const b = mainBeam;
  if (!b) return false;
  const { q } = headAt(b, 0, p, routeDistance(p));
  b.curve.getPointAt(Math.min(qToU(b, q), 1), head);
  b.curve.getPointAt(Math.min(qToU(b, Math.max(q - behind, 0)), 1), back);
  return true;
}

// the p at which the beam's head first reaches a root's tip (the tree's
// light starts climbing from there: Yggdrasil.jsx)
let touchKey = "";
let touchP = 1;
function touchesRootAt(b) {
  const key = `${T.oasisBeamLead}:${P.canopy}:${b.qRoot}:${T.tlBeamToTreeStart}:${T.tlBeamToTreeEnd}:${T.tlCutStart}:${T.tlCutEnd}`;
  if (key === touchKey) return touchP;
  let lo = P.out;
  let hi = 1;
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    if (headAt(b, 0, mid, routeDistance(mid)).q >= b.qRoot - 0.5) hi = mid;
    else lo = mid;
  }
  touchKey = key;
  touchP = hi;
  return touchP;
}

// (the beam's look: scene/saber.js)
const VERTEX = /* glsl */ `
${SABER_VERTEX_PARS}
#include <common>
#include <fog_pars_vertex>
void main() {
  vec3 p = position;
${SABER_VERTEX_BODY}
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform float uHead;
uniform float uTail;
uniform float uLength;
${SABER_FRAGMENT_PARS}
#include <fog_pars_fragment>
void main() {
  if (vU > uHead || vU < uTail) discard;
  // (its head: a round capsule end, drawn apart — scene/saber.js createSaberCap)
  vec4 s = saber(abs(vSide));
  float metres = vU * uLength;
  // out of the core it grows in over its first metres
  float start = smoothstep(0.0, 6.0, metres);
  float a = s.a * start * min(uIntensity, 1.0);
  if (a < 0.002) discard;
  gl_FragColor = vec4(s.rgb * uIntensity, a);
  #ifdef USE_FOG
    float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    // (far, it thins into the haze rather than turning to its colour)
    gl_FragColor.a *= 1.0 - fogF * 0.85;
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const up = new THREE.Vector3(0, 1, 0);

// One streak's path, as control points and how far along the way (q, m)
// each is: along the route by its height and offset (out of the logo's
// core over the first metres), kept clear of the sand, then its own way
// into the tree's core.
// where along the way it points straight at the cube at the lake's heart
// (its heading and the bearing to the cube agree): the beam leaves it there
function straightFrom() {
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  let best = S_RIM - 30;
  let bestErr = Infinity;
  for (let s = S_RIM - 260; s <= S_END - 10; s += 2) {
    route.getPointAt(Math.min(s / S_END, 1), p);
    route.getTangentAt(Math.min(s / S_END, 1), t);
    const dx = TREE.x - p.x;
    const dz = TREE.z - p.z;
    if (Math.hypot(dx, dz) < 70) break;
    const err = Math.abs(THREE.MathUtils.euclideanModulo(Math.atan2(dx, -dz) - Math.atan2(t.x, -t.z) + Math.PI, Math.PI * 2) - Math.PI);
    if (err < bestErr) {
      bestErr = err;
      best = s;
    }
  }
  return best;
}

export function buildPath(rib, core, terrain) {
  const pts = [core.clone()];
  const qs = [0];
  // (the beam into the core leaves the way where the way itself points
  // straight at the cube — from there it runs dead straight into it: no
  // curve in at the end)
  const routeEnd = rib.end.root !== undefined ? straightFrom() : S_RIM - 40 - rib.end.from;
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const side = new THREE.Vector3();
  const step = 5;
  const line = [];
  for (let s = 14; s <= routeEnd; s += step) {
    route.getPointAt(Math.min(s / S_END, 1), p);
    route.getTangentAt(Math.min(s / S_END, 1), t);
    side.crossVectors(t, up).normalize();
    // Out of the core it comes down with the camera, alongside and a little
    // below it (the camera's own descent, world/oasisCamera.js), so it stays
    // with the visitor through the mark instead of diving away to the sand;
    // by the passage it skims the water at its own height and offset.
    const down = descentAt(s);
    const out = THREE.MathUtils.smoothstep(s, 0, 18);
    const lat = THREE.MathUtils.lerp(1.6, rib.lat(s), down) * out;
    const x = p.x + side.x * lat;
    const z = p.z + side.z * lat;
    const ground = Math.max(terrain.height(x, z), WATER_Y);
    // (a steady few metres under the eye all the way down, settling to its
    // own height over the water as the camera reaches the passage)
    // (the eye's height on the way down; over the lake the camera rises, the beam does not)
    const eye = THREE.MathUtils.lerp(cameraHeightAt(0), WATER_Y + 4.4, down);
    const settled = WATER_Y + rib.h(s);
    const y = THREE.MathUtils.lerp(core.y, Math.max(eye - 2.4 - 1.25 * down, settled), out);
    line.push({ s, x, z, y, ground });
  }
  // clear of the sand (smoothly: over the crests nearby, not into each trough)
  line.forEach((l, i) => {
    let crest = -Infinity;
    for (let j = Math.max(i - 4, 0); j <= Math.min(i + 4, line.length - 1); j++) crest = Math.max(crest, line[j].ground);
    // (the beam skims the water: just clear of it, and of the sand before the stream)
    const clear = rib.h(l.s) < 4 ? 0.55 : 6;
    pts.push(new THREE.Vector3(l.x, Math.max(l.y, crest + clear), l.z));
    qs.push(l.s);
  });
  // ...then into the tree
  const tail = [];
  let rootAt = -1;
  const c = TREE.core;
  if (rib.end.root !== undefined) {
    // from where the way points at it, dead straight into the cube at the
    // lake's heart: low over the sand and the water, rising into the cube
    // only over the last stretch
    const last = pts.at(-1);
    const cube = new THREE.Vector3(TREE.x, cubeY(), TREE.z);
    const lowY = Math.max(last.y, WATER_Y + 0.8);
    const len = Math.hypot(cube.x - last.x, cube.z - last.z);
    const N = Math.max(Math.ceil(len / 6), 8);
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      const rise = THREE.MathUtils.smootherstep(k, 0.7, 1);
      tail.push(i === N ? cube : new THREE.Vector3(THREE.MathUtils.lerp(last.x, cube.x, k), THREE.MathUtils.lerp(lowY, cube.y, rise), THREE.MathUtils.lerp(last.z, cube.z, k)));
    }
    rootAt = tail.length - 1;
  } else {
    // round the crown, spiralling in, and down through it into the core
    const last = pts.at(-1);
    let ang = Math.atan2(last.z - c.z, last.x - c.x);
    let r = Math.hypot(last.x - c.x, last.z - c.z);
    const steps = 9;
    const y0 = last.y;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      ang += rib.end.dir * 0.55;
      r = THREE.MathUtils.lerp(r, i < steps - 2 ? TREE.canopy + 14 - i * 3 : 18, 0.45);
      const y = THREE.MathUtils.lerp(y0, WATER_Y + rib.end.y, Math.min(k * 1.6, 1));
      tail.push(new THREE.Vector3(c.x + Math.cos(ang) * r, y, c.z + Math.sin(ang) * r));
    }
    ang += rib.end.dir * 0.6;
    tail.push(new THREE.Vector3(c.x + Math.cos(ang) * 9, c.y + 14, c.z + Math.sin(ang) * 9));
    tail.push(c.clone());
  }
  let q = qs.at(-1);
  let prev = pts.at(-1);
  let qRoot = -1;
  tail.forEach((pt, i) => {
    q += pt.distanceTo(prev);
    prev = pt;
    pts.push(pt);
    qs.push(q);
    if (i === rootAt) qRoot = q;
  });
  return { pts, qs, qRoot };
}

export default function Streaks({ J, forge, terrain, shared }) {
  const { gl, camera } = useThree();
  const refs = useRef([]);
  const built = useMemo(() => {
    const core = forge.world.core;
    return RIBBONS.map((rib) => {
      const { pts, qs, qRoot } = buildPath(rib, core, terrain);
      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      // arc length at each control point (u), for q → u
      const per = 8;
      const lengths = curve.getLengths((pts.length - 1) * per);
      const total = lengths.at(-1);
      const us = qs.map((_, i) => lengths[i * per] / total);
      const { geometry, length } = buildStrands(curve, {
        spreadAt: (u) => THREE.MathUtils.lerp(0.15, 1, THREE.MathUtils.smoothstep(u, 0, 0.04)) * (1 - 0.9 * THREE.MathUtils.smoothstep(u, 0.97, 1)),
        spacing: rib.spacing,
        count: rib.count,
        seed: rib.seed,
        width: rib.width,
      });
      const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            ...saberUniforms(),
            uHead: { value: 0 },
            uTail: { value: 0 },
            uLength: { value: length },
            uTime: { value: 0 },
          },
        ]),
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      });
      material.uniforms.uTime = shared.uTime;
      // its round head (scene/saber.js), on the valley's layer with it
      const cap = createSaberCap(material.uniforms);
      cap.layers.set(VALLEY_LAYER);
      // ...and the same path as a bundle of streaks (T.beamStreaks)
      const bundle = buildStrands(curve, {
        spreadAt: (u) => THREE.MathUtils.lerp(0.15, 1, THREE.MathUtils.smoothstep(u, 0, 0.04)) * (1 - 0.9 * THREE.MathUtils.smoothstep(u, 0.97, 1)),
        spacing: rib.spacing,
        count: STREAK_COUNT,
        seed: rib.seed,
        width: rib.width,
      });
      const streakMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, streakUniforms(bundle.length)]),
        vertexShader: STRAND_VERTEX,
        fragmentShader: STRAND_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      });
      streakMaterial.uniforms.uTime = shared.uTime;
      const streaks = new THREE.Mesh(bundle.geometry, streakMaterial);
      streaks.frustumCulled = false;
      streaks.renderOrder = 3;
      streaks.visible = false;
      streaks.layers.set(VALLEY_LAYER);
      return { rib, curve, geometry, material, cap, streaks, qs, us, qMax: qs.at(-1), qRoot };
    });
  }, [forge, terrain, shared]);

  useEffect(
    () => () => {
      built.forEach((b) => {
        b.geometry.dispose();
        b.material.dispose();
        b.cap.material.dispose();
        b.streaks.geometry.dispose();
        b.streaks.material.dispose();
      });
    },
    [built]
  );

  // (the camera rides it: beamFrameAt)
  useEffect(() => {
    mainBeam = built[0] ?? null;
    return () => {
      mainBeam = null;
    };
  }, [built]);

  useFrame(() => {
    const on = J.duneBeam > 0.001 && J.progress > 0;
    const camS = routeDistance(J.progress);
    const pixel = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / gl.domElement.height;
    // the single beam, or the streaks (T.beamStreaks)
    const many = T.beamStreaks;
    built.forEach((b, i) => {
      const mesh = refs.current[i];
      if (mesh) mesh.visible = on && !many;
      b.cap.visible = on && !many;
      b.streaks.visible = on && many;
      if (!on) return;
      const u = b.material.uniforms;
      // the head runs its lead ahead of the camera (shooting out to it as
      // the camera comes through the mark), held short of the core until
      // they converge; then on into it, one after another
      // (held at a root's tip until it runs on into the tree)
      const { q, k } = headAt(b, i, J.progress, camS);
      if (i === 0 && b.qRoot > 0) J.treeFillFrom = touchesRootAt(b);
      // q → u along its control points
      let j = 0;
      while (j < b.qs.length - 2 && b.qs[j + 1] < q) j++;
      const f = THREE.MathUtils.clamp((q - b.qs[j]) / Math.max(b.qs[j + 1] - b.qs[j], 1e-3), 0, 1);
      u.uHead.value = k >= 1 ? 1 : THREE.MathUtils.lerp(b.us[j], b.us[j + 1], f);
      // how far into the tree it has run (root's tip → core): the tree's
      // light climbs from the roots with it (Yggdrasil.jsx)
      if (i === 0) J.beamInTree = b.qRoot > 0 ? THREE.MathUtils.clamp((q - b.qRoot) / (b.qMax - b.qRoot), 0, 1) : k;
      // (from the cut on the camera is in the valley: nothing behind it)
      // ...and once it has touched the cube, its tail runs on in after it:
      // the whole beam merged into the cube by the time the tree starts to
      // grow (T.tlTreeGrowStart)
      let back = J.progress >= CUT_FROM() ? camS - 4 : 0;
      if (b.qRoot > 0) {
        const t0 = T.tlBeamToTreeEnd;
        const merge = THREE.MathUtils.smootherstep(J.progress, t0, Math.max(T.tlTreeGrowStart, t0 + 0.004));
        if (merge > 0) back = THREE.MathUtils.lerp(Math.min(back, b.qRoot), b.qRoot, merge);
      }
      let jt = 0;
      while (jt < b.qs.length - 2 && b.qs[jt + 1] < back) jt++;
      const ft = THREE.MathUtils.clamp((back - b.qs[jt]) / Math.max(b.qs[jt + 1] - b.qs[jt], 1e-3), 0, 1);
      u.uTail.value = back > 0 ? THREE.MathUtils.lerp(b.us[jt], b.us[jt + 1], ft) : 0;
      u.uIntensity.value = T.beamIntensity * T.oasisBeam * b.rib.bright * Math.min(J.duneBeam * 2, 1) * (1 + 0.6 * J.amber);
      u.uPixel.value = pixel;
      syncSaber(u, T.oasisBeamWidth);
      // the round head while it runs free (not once it is in the core)
      const cu = b.cap.material.uniforms;
      b.curve.getPointAt(Math.min(u.uHead.value, 1), cu.uHeadPos.value);

      cu.uCapOn.value = u.uHead.value < 0.9995 && u.uHead.value > u.uTail.value ? 1 : 0;
      // the streaks: the same head and tail
      const su = b.streaks.material.uniforms;
      su.uHead.value = u.uHead.value;
      su.uTail.value = u.uTail.value;
      syncStreaks(su, T.oasisBeam * b.rib.bright * Math.min(J.duneBeam * 2, 1) * (1 + 0.6 * J.amber), pixel);
    });
  });

  return built.map((b, i) => (
    <group key={i}>
      <mesh ref={(el) => {
          refs.current[i] = el;
          el?.layers.set(VALLEY_LAYER);
        }} geometry={b.geometry} material={b.material} frustumCulled={false} renderOrder={3} visible={false} />
      <primitive object={b.cap} />
      <primitive object={b.streaks} />
    </group>
  ));
}
