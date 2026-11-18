"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { T } from "../../tuning";
import { P, VALLEY_LAYER } from "../../config";
import { buildStrands } from "../ForgeBeam";
import { SABER_FRAGMENT_PARS, SABER_VERTEX_BODY, SABER_VERTEX_PARS, createSaberCap, saberUniforms, syncSaber } from "../saber";
import { S_END, S_RIM, TREE, WATER_Y, meander, route } from "../../world/oasis";
import { CUT_FROM, cameraHeightAt, cubeY, descentAt, routeDistance } from "../../world/oasisCamera";

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
const HOLD = 70; // until they converge, heads stop this far (m) short of the core

// The run into the tree (converging on its core), a pure function of the
// scroll — the same as timeline.js's "converge": eased from 90% of the way
// through the tree's moment to halfway through the next — so where the beam
// is, and when it first touches a root, are known for any p.
const convergeAt = (p) => {
  const a = T.tlBeamToTreeStart;
  const b = Math.max(T.tlBeamToTreeEnd, a + 0.002);
  const x = THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
};
// the head's place along a streak at p (m along it)
function headAt(b, i, p, camS) {
  const lead = b.rib.lead * T.oasisBeamLead * (0.45 + 0.55 * descentAt(camS));
  const free = Math.min(camS + lead, b.qMax - HOLD);
  const delay = (i / RIBBONS.length) * 0.35;
  const k = THREE.MathUtils.clamp((convergeAt(p) - delay) / (1 - delay), 0, 1);
  return { q: THREE.MathUtils.lerp(free, b.qMax, k * k * (3 - 2 * k)), k };
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
export function buildPath(rib, core, terrain) {
  const pts = [core.clone()];
  const qs = [0];
  const routeEnd = rib.end.root !== undefined ? S_END - 30 : S_RIM - 40 - rib.end.from;
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
    // low over the lake, straight on into the cube at its heart (where the
    // tree will grow): the beam touches it there
    const last = pts.at(-1);
    const cube = new THREE.Vector3(TREE.x, cubeY(), TREE.z);
    const lowY = WATER_Y + 0.8;
    const toCube = cube.clone().setY(lowY).sub(last.clone().setY(lowY));
    const len = toCube.length();
    toCube.normalize();
    for (const k of [0.3, 0.6, 0.85]) tail.push(last.clone().setY(lowY).addScaledVector(toCube, len * k).setY(THREE.MathUtils.lerp(lowY, cube.y, Math.pow(k, 3))));
    tail.push(cube);
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
      return { rib, curve, geometry, material, cap, qs, us, qMax: qs.at(-1), qRoot };
    });
  }, [forge, terrain, shared]);

  useEffect(
    () => () => {
      built.forEach((b) => {
        b.geometry.dispose();
        b.material.dispose();
        b.cap.material.dispose();
      });
    },
    [built]
  );

  useFrame(() => {
    const on = J.duneBeam > 0.001 && J.progress > 0;
    const camS = routeDistance(J.progress);
    const pixel = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / gl.domElement.height;
    built.forEach((b, i) => {
      const mesh = refs.current[i];
      if (mesh) mesh.visible = on;
      b.cap.visible = on;
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
      // ...until the camera turns away round the tree: then the beam fills
      // back in behind, all the way up the way it came
      const span = Math.max(T.tlOrbitEnd - T.tlOrbitStart, 0.002);
      const unwind = THREE.MathUtils.smoothstep(J.progress, T.tlOrbitStart, T.tlOrbitStart + span * 0.3);
      const back = J.progress >= CUT_FROM() ? (camS - 4) * (1 - unwind) : 0;
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
    });
  });

  return built.map((b, i) => (
    <group key={i}>
      <mesh ref={(el) => {
          refs.current[i] = el;
          el?.layers.set(VALLEY_LAYER);
        }} geometry={b.geometry} material={b.material} frustumCulled={false} renderOrder={3} visible={false} />
      <primitive object={b.cap} />
    </group>
  ));
}
