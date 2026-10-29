"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../world/layout";
import { T } from "../tuning";

// The energy beam: a bundle of thin glowing strands that flies in over the
// dunes, already lifted off the sand, and rises in one smooth path straight
// into the core. The strands fan out over the long run and draw together
// into a single bright line as they reach the core; bright dashes stream
// along them towards it. The bundle is drawn up to a travelling head
// (J.beam: one steady travel along the whole path, over the dunes and up
// into the core); on load it races out from under the viewer.

// The path, world metres: over the line of the old sand trail (its corridor
// is still carved low through the dunes), 4–10 m up, then rising to the
// core. Heights are above the sand under each point.
const OVER_DUNES = [
  [5, 4, 300],
  [-9, 4.5, 235],
  [8, 5.5, 165],
  [-5, 7, 100],
  [3, 10, 45],
];
const STRANDS = 18;

const VERTEX = /* glsl */ `
attribute vec3 aTangent;
attribute float aSide;
attribute float aU;
attribute vec4 aStrand; // width (m), brightness, phase, hot (the bright core strands)
attribute vec3 aOffset; // where this strand runs in the bundle, off the path
uniform float uPixel; // world size of one pixel at 1 m from the camera
uniform float uSpread; // how wide the bundle opens (the gaps between strands)
varying float vU;
varying float vSide;
varying vec4 vStrand;
varying float vWidthFix;
void main() {
  vec3 p = position + aOffset * uSpread;
  vec3 toCam = cameraPosition - p;
  vec3 side = normalize(cross(aTangent, toCam));
  // never thinner than ~1.3 px (far strands stay crisp lines instead of
  // breaking up); a strand widened that way is dimmed to match
  float w = max(aStrand.x, length(toCam) * uPixel * 1.3);
  vWidthFix = aStrand.x / w;
  p += side * aSide * w * 0.5;
  vU = aU;
  vSide = aSide;
  vStrand = aStrand;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uHead;
uniform float uLength;
uniform float uTime;
uniform float uIntensity;
uniform float uFlow;
uniform float uDashFreq; // dashes per metre
uniform float uDashLength; // share of each period that is bright
uniform float uBase; // glow of the strands between dashes
uniform vec3 uColor;
uniform vec3 uHot;
varying float vU;
varying float vSide;
varying vec4 vStrand;
varying float vWidthFix;
void main() {
  if (vU > uHead) discard;
  float across = 1.0 - smoothstep(0.2, 1.0, abs(vSide));
  float metres = vU * uLength;
  // bright dashes streaming along each strand towards the core
  float dash = smoothstep(1.0 - uDashLength, 1.0 - uDashLength * 0.3, fract(metres * uDashFreq - uTime * uFlow + vStrand.z));
  // the drawing head, while it travels
  float head = (1.0 - smoothstep(0.0, 8.0, (uHead - vU) * uLength)) * (1.0 - step(0.999, uHead));
  // fades in out of the foreground
  float start = smoothstep(0.0, 0.05, vU);
  float I = vStrand.y * (uBase + dash * 2.2 + head * 3.0) * across * start * vWidthFix * uIntensity;
  if (I < 0.002) discard;
  vec3 col = mix(uColor, uHot, clamp(vStrand.w * across * 0.7 + head * 0.6 + dash * 0.3, 0.0, 1.0));
  gl_FragColor = vec4(col * I, 1.0);
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
  const x = world.target.x;
  const y = world.target.y;
  const face = world.frontZ;
  const pts = OVER_DUNES.map(([px, h, pz]) => new THREE.Vector3(px, terrain.height(px, pz) + h, pz));
  // the final rise: up in front of the face and in level through the rhombus
  pts.push(
    new THREE.Vector3(x, y - 9, face + 22),
    new THREE.Vector3(x, y - 1.5, face + 8),
    new THREE.Vector3(x, y, face + 1.5),
    new THREE.Vector3(x, y, world.core.z)
  );
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

// fans out over the long run, draws together into one line at the core
const FORGE_SPREAD = (u) =>
  (0.6 + 1.1 * THREE.MathUtils.smoothstep(u, 0.04, 0.3) * (1 - THREE.MathUtils.smoothstep(u, 0.55, 0.9))) *
  THREE.MathUtils.lerp(1, 0.04, THREE.MathUtils.smoothstep(u, 0.86, 1));

// The bundle's strands as ribbons along the path (`spreadAt`: how wide the
// bundle is at u, `spacing`: metres between samples).
export function buildStrands(path, { spreadAt = FORGE_SPREAD, spacing = 0.6 } = {}) {
  const rng = mulberry32(5);
  const length = path.getLength();
  const n = Math.ceil(length / spacing);
  const pts = path.getSpacedPoints(n);
  const tangents = pts.map((_, i) => path.getTangentAt(i / n));
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const lift = new THREE.Vector3();
  const strands = Array.from({ length: STRANDS }, (_, s) => ({
    // a flat-ish bundle: wider across than up and down
    across: (rng() - 0.5) * 2,
    vertical: (rng() - 0.5) * 0.7,
    wave: 0.15 + rng() * 0.35,
    phase: rng() * 10,
    width: s < 2 ? 0.16 : 0.035 + rng() * 0.07,
    bright: s < 2 ? 1.0 : 0.3 + rng() * 0.55,
    hot: s < 2 ? 1 : rng() * 0.3,
  }));
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

// Sparks streaming along the bundle just behind its head.
const SPARK_COUNT = 48;
const SPARK_VERTEX = /* glsl */ `
attribute float aA;
uniform float uScale;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = aA;
  gl_PointSize = clamp(0.2 * uScale / max(-mv.z, 0.5), 1.0, 8.0);
}
`;
const SPARK_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.1, 0.5, d);
  if (vA * m < 0.004) discard;
  gl_FragColor = vec4(uColor * 3.0 * m * vA, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default function ForgeBeam({ terrain, forge, J, shared }) {
  const { gl, camera } = useThree();
  const built = useMemo(() => {
    const path = buildBeamPath(forge, terrain);
    const { geometry, length } = buildStrands(path);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uHead: { value: 0 },
        uLength: { value: length },
        uTime: shared.uTime,
        uIntensity: { value: 1 },
        uFlow: { value: 1 },
        uSpread: { value: 1 },
        uDashFreq: { value: 0.045 },
        uDashLength: { value: 0.1 },
        uBase: { value: 0.45 },
        uPixel: { value: 0.001 },
        uColor: { value: new THREE.Color("#ff5f00") },
        uHot: { value: new THREE.Color("#ffc890") },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3));
    sparkGeometry.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(SPARK_COUNT), 1));
    const sparkMaterial = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 }, uColor: { value: new THREE.Color("#ff8a3a") } },
      vertexShader: SPARK_VERTEX,
      fragmentShader: SPARK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      path,
      length,
      beam: { geometry, material },
      sparks: { geometry: sparkGeometry, material: sparkMaterial },
      // where the load-in race starts (the hero's lead is T.beamStart)
      intro: uAtZ(path, 200),
    };
  }, [terrain, forge, shared]);

  useEffect(
    () => () => {
      for (const part of [built.beam, built.sparks]) {
        part.geometry.dispose();
        part.material.dispose();
      }
    },
    [built]
  );

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const sparksRef = useRef();

  useFrame(() => {
    const u = built.beam.material.uniforms;
    const front = Math.max(T.beamStart, built.intro);
    const head = front + (1 - front) * J.beam;
    // The load-in race runs on the page's own clock (0.5 s in, 2.8 s long,
    // eased in and out), so nothing can rewind it; a review frame sets
    // J.intro to skip it.
    const k = THREE.MathUtils.clamp((performance.now() / 1000 - 0.5) / 2.8, 0, 1);
    const race = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    u.uHead.value = THREE.MathUtils.lerp(built.intro, head, Math.max(race, J.intro));
    // once the core has taken the energy the beam settles to a quieter glow
    // ...and goes out as the camera heads for the opening
    u.uIntensity.value = T.trailIntensity * (1 - 0.45 * J.beamFade) * J.beamVis;
    u.uFlow.value = T.beamFlow;
    u.uSpread.value = T.beamSpread;
    u.uDashFreq.value = 1 / Math.max(T.beamDashSpacing, 0.5);
    u.uDashLength.value = T.beamDashLength;
    u.uBase.value = T.beamBase;
    u.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / gl.domElement.height;
    u.uColor.value.set(T.crackColor);

    // sparks: spread over the ~30 m behind the head, all moving towards it
    const sp = built.sparks;
    const vis = J.beamSparks * J.beamVis;
    if (sparksRef.current) sparksRef.current.visible = vis > 0.001;
    if (vis <= 0.001) return;
    sp.material.uniforms.uScale.value = gl.domElement.height * 0.5;
    sp.material.uniforms.uColor.value.set(T.crackColor);
    const pos = sp.geometry.attributes.position.array;
    const alpha = sp.geometry.attributes.aA.array;
    const time = shared.uTime.value;
    const d = u.uHead.value * built.length;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const k = (i * 0.6180339 + time * 0.45) % 1;
      const di = d - k * 30;
      built.path.getPointAt(THREE.MathUtils.clamp(di / built.length, 0, 1), tmp);
      // scattered through the bundle, stable per spark
      tmp.x += Math.sin(i * 12.9898) * 1.2;
      tmp.y += Math.sin(i * 78.233) * 0.5;
      pos[i * 3] = tmp.x;
      pos[i * 3 + 1] = tmp.y;
      pos[i * 3 + 2] = tmp.z;
      alpha[i] = vis * (1 - k) * (di > 0 ? 1 : 0);
    }
    sp.geometry.attributes.position.needsUpdate = true;
    sp.geometry.attributes.aA.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={built.beam.geometry} material={built.beam.material} frustumCulled={false} renderOrder={3} />
      <points ref={sparksRef} geometry={built.sparks.geometry} material={built.sparks.material} frustumCulled={false} renderOrder={5} />
    </>
  );
}
