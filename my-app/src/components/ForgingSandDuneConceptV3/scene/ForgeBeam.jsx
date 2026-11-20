"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../world/layout";
import { T } from "../tuning";
import { SABER_FRAGMENT_PARS, SABER_VERTEX_BODY, SABER_VERTEX_PARS, STRAND_FRAGMENT, STRAND_VERTEX, createSaberCap, saberUniforms, streakUniforms, syncSaber, syncStreaks } from "./saber";

// The energy beam: one single beam, laid along the sand. It runs in over
// the dunes hugging the ground, to the foot of the slab, and goes into the
// stone there, where the Spine crack starts (CrackRootAnchor). From there the
// energy climbs inside the rock: the Spine lights from the foot up to the
// core (scene/Forge.jsx), and the core takes it (the blast follows). A solid
// beam of light (scene/saber.js: a white-hot core in a soft glow, like a
// lightsaber's blade). It is drawn up to a travelling head
// (J.beam: 0 → 0.5 along the sand into the slab's foot; 0.5 → 1 is the
// Spine's climb, the beam holding at the foot); on load it races out from
// under the viewer.

// The ground run in plan (x, z; world metres): the line of the old sand
// trail (its corridor is still carved low through the dunes). Heights come
// from the sand under each point.
const OVER_DUNES = [
  [5, 0, 300],
  [-9, 0, 235],
  [8, 0, 165],
  [-5, 0, 100],
  [3, 0, 45],
];
const OVER_SAND = 0.22; // the beam's height over the sand (m)
const STRANDS = 1; // (one beam)

const VERTEX = /* glsl */ `
${SABER_VERTEX_PARS}
void main() {
  vec3 p = position;
${SABER_VERTEX_BODY}
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uHead;
uniform float uLength;
uniform float uFoot; // where the beam leaves the sand for the slab's face
uniform float uWall; // the part on the face: gone with the stone (1 → 0)
${SABER_FRAGMENT_PARS}
void main() {
  if (vU > uHead) discard;
  // (its head: a round capsule end, drawn apart — scene/saber.js createSaberCap)
  vec4 s = saber(abs(vSide));
  // (in out of the foreground)
  float start = smoothstep(0.0, 0.05, vU);
  float wall = mix(1.0, uWall, smoothstep(uFoot - 0.002, uFoot + 0.002, vU));
  float a = s.a * start * wall * min(uIntensity, 1.0);
  if (a < 0.002) discard;
  gl_FragColor = vec4(s.rgb * uIntensity, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// u (arc-length fraction) where a path running towards -z crosses z
function uAtZ(curve, z) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (curve.getPointAt(mid).z > z) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function buildBeamPath(forge, terrain) {
  const { world } = forge;
  // straight in at the Spine's start (bottom centre of the face)
  const x = world.root.x;
  const face = world.frontZ;
  // along the sand: the plan line, sampled every ~2 m so the beam lies on
  // the ground's every rise and dip, to the slab's foot
  const plan = new THREE.CatmullRomCurve3(
    [...OVER_DUNES.map(([px, , pz]) => new THREE.Vector3(px, 0, pz)), new THREE.Vector3(x, 0, face + 16), new THREE.Vector3(x, 0, face + 2.4)],
    false,
    "centripetal"
  );
  const n = Math.ceil(plan.getLength() / 2);
  const pts = plan.getSpacedPoints(n).map((p) => new THREE.Vector3(p.x, terrain.height(p.x, p.z) + OVER_SAND, p.z));
  // the foot: it turns up off the sand onto the slab's face, and runs on
  // straight up the face, close against it, to the core (T.beamUpFace)
  const g = pts[pts.length - 1].y;
  const gap = Math.max(T.beamFaceGap, 0.02);
  const core = world.target ?? world.core;
  pts.push(new THREE.Vector3(x, g + 0.08, face + 1.2), new THREE.Vector3(x, g + 0.35, face + gap + 0.25));
  const top = core.y - 0.8;
  const rise = Math.max(top - (g + 1.2), 0.5);
  const steps = Math.max(Math.ceil(rise / 2), 2);
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    pts.push(new THREE.Vector3(THREE.MathUtils.lerp(x, core.x, k * k), g + 1.2 + rise * k, face + gap));
  }
  pts.push(new THREE.Vector3(core.x, core.y, core.z));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  // (where along it the beam reaches the slab's foot)
  curve.userData = { foot: uAtZ(curve, face + 1.2) };
  return curve;
}

// fans out over the long run, draws together into one line at the core
const FORGE_SPREAD = (u) =>
  (0.6 + 1.1 * THREE.MathUtils.smoothstep(u, 0.04, 0.3) * (1 - THREE.MathUtils.smoothstep(u, 0.55, 0.9))) *
  THREE.MathUtils.lerp(1, 0.04, THREE.MathUtils.smoothstep(u, 0.86, 1));

// The bundle's strands as ribbons along the path (`spreadAt`: how wide the
// bundle is at u, `spacing`: metres between samples; `count`, `seed` and
// `width` make the oasis's other, finer streaks).
export function buildStrands(path, { spreadAt = FORGE_SPREAD, spacing = 0.6, count = STRANDS, seed = 5, width = 1 } = {}) {
  const rng = mulberry32(seed);
  const length = path.getLength();
  const n = Math.ceil(length / spacing);
  const pts = path.getSpacedPoints(n);
  const tangents = pts.map((_, i) => path.getTangentAt(i / n));
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const lift = new THREE.Vector3();
  const strands = Array.from({ length: count }, (_, s) =>
    // (one beam: a single ribbon on the line itself — scene/saber.js)
    count === 1
      ? { across: 0, vertical: 0, wave: 0, phase: 0, width: width, bright: 1, hot: 1 }
      : {
          // a flat-ish bundle: wider across than up and down
          across: (rng() - 0.5) * 2,
          vertical: (rng() - 0.5) * 0.7,
          wave: 0.15 + rng() * 0.35,
          phase: rng() * 10,
          width: (s < 2 ? 0.16 : 0.035 + rng() * 0.07) * width,
          bright: s < 2 ? 1.0 : 0.3 + rng() * 0.55,
          hot: s < 2 ? 1 : rng() * 0.3,
        }
  );
  const pos = [];
  const tan = [];
  const sideAttr = [];
  const offset = [];
  const uAttr = [];
  const strandAttr = [];
  const index = [];
  for (const st of strands) {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const t = tangents[i];
      side.crossVectors(t, up).normalize();
      lift.crossVectors(side, t).normalize();
      const spread = spreadAt(u);
      const sway = Math.sin(u * length * 0.035 + st.phase) * st.wave;
      const a = (st.across + sway) * spread * 1.6;
      const v = st.vertical * spread * 1.6;
      const p = pts[i];
      for (const s of [-1, 1]) {
        pos.push(p.x, p.y, p.z);
        offset.push(side.x * a + lift.x * v, side.y * a + lift.y * v, side.z * a + lift.z * v);
        tan.push(t.x, t.y, t.z);
        sideAttr.push(s);
        uAttr.push(u);
        strandAttr.push(st.width, st.bright, st.phase, st.hot);
      }
    }
    for (let i = 0; i < n; i++) {
      const k = base + i * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aTangent", new THREE.Float32BufferAttribute(tan, 3));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(sideAttr, 1));
  g.setAttribute("aOffset", new THREE.Float32BufferAttribute(offset, 3));
  g.setAttribute("aU", new THREE.Float32BufferAttribute(uAttr, 1));
  g.setAttribute("aStrand", new THREE.Float32BufferAttribute(strandAttr, 4));
  g.setIndex(index);
  return { geometry: g, length };
}

export default function ForgeBeam({ terrain, forge, J, shared }) {
  const { gl, camera } = useThree();
  const built = useMemo(() => {
    const path = buildBeamPath(forge, terrain);
    const { geometry, length } = buildStrands(path);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...saberUniforms(),
        uHead: { value: 0 },
        uLength: { value: length },
        uFoot: { value: path.userData.foot },
        uWall: { value: 1 },
        uTime: shared.uTime,
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // ...or the same path as a bundle of streaks (T.beamStreaks)
    const bundle = buildStrands(path, { count: 18, spacing: 0.6, seed: 5 });
    const streakMaterial = new THREE.ShaderMaterial({
      uniforms: { ...streakUniforms(bundle.length), uTime: shared.uTime, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 }, fogNear: { value: 1 }, fogFar: { value: 2000 } },
      vertexShader: STRAND_VERTEX,
      fragmentShader: STRAND_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const streaks = new THREE.Mesh(bundle.geometry, streakMaterial);
    streaks.frustumCulled = false;
    streaks.renderOrder = 3;

    return {
      path,
      length,
      beam: { geometry, material },
      streaks,
      // its round head (scene/saber.js)
      cap: createSaberCap(material.uniforms),
      behindFor: T.heroBeamBehind,
      foot: path.userData.foot,
    };
  }, [terrain, forge, shared]);

  useEffect(
    () => () => {
      built.beam.geometry.dispose();
      built.beam.material.dispose();
      built.cap.material.dispose();
      built.streaks.geometry.dispose();
      built.streaks.material.dispose();
    },
    [built]
  );

  // where the head is before the first scroll: behind the camera (the hero
  // shot's at z 155), so none of it is in view until the page moves
  const behind = useMemo(() => uAtZ(built.path, 155 + T.heroBeamBehind), [built]);
  useFrame(() => {
    const u = built.beam.material.uniforms;
    // with the scroll from the first moment: from behind the camera along the
    // sand to the slab's foot (J.beam 0 → 0.5), then on up its face into the
    // core (0.5 → 1; T.beamUpFace) — no load-in race, nothing there before
    const foot = built.foot;
    const from = T.heroBeamBehind !== built.behindFor ? uAtZ(built.path, 155 + T.heroBeamBehind) : behind;
    const run = Math.min(J.beam / 0.5, 1);
    const climb = T.beamUpFace ? THREE.MathUtils.clamp((J.beam - 0.5) / 0.5, 0, 1) : 0;
    u.uHead.value = J.beam <= 0 ? 0 : J.beam < 0.5 ? THREE.MathUtils.lerp(from, foot, run) : THREE.MathUtils.lerp(foot, 1, climb);
    // ...and the whole of it goes as the stone breaks away — the stretch
    // along the sand together with the one up the slab's face (J.beamFade):
    // nothing left lying on the sand without a purpose (the beam on out of
    // the core, past the mark, is Streaks.jsx's own)
    const gone = J.beamFade;
    // (the single beam, or the streaks: T.beamStreaks)
    const many = T.beamStreaks;
    built.beam.material.visible = gone < 0.999 && !many;
    built.streaks.visible = gone < 0.999 && many;
    u.uIntensity.value = T.beamIntensity * J.beamVis * (1 - gone);
    // (the part up the slab's face goes as the stone breaks away)
    u.uWall.value = 1 - J.beamFade;
    u.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / gl.domElement.height;
    syncSaber(u, T.beamWidth);
    // the round head, while it runs (not once it is in the core; on the
    // slab's face it goes with the stone)
    const h = u.uHead.value;
    const cu = built.cap.material.uniforms;
    built.path.getPointAt(Math.min(h, 1), cu.uHeadPos.value);
    cu.uCapOn.value = h < 0.999 ? THREE.MathUtils.smoothstep(h, 0.0, 0.05) * (h > foot ? 1 - J.beamFade : 1) * (1 - gone) * (many ? 0 : 1) : 0;
    // the streaks: the same head
    const su = built.streaks.material.uniforms;
    su.uHead.value = h;
    su.uTail.value = 0;
    syncStreaks(su, J.beamVis * (1 - gone), u.uPixel.value);
  });

  return (
    <>
      <mesh geometry={built.beam.geometry} material={built.beam.material} frustumCulled={false} renderOrder={3} />
      <primitive object={built.cap} />
      <primitive object={built.streaks} />
    </>
  );
}
