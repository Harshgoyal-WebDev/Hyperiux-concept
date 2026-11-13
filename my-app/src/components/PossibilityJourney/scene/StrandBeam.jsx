"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { C, seg } from "../timeline";
import { T } from "../tuning";
import { PATH_GAPS, PATH_POINTS } from "../world/layout";
import { mulberry32 } from "../../OriginForge/world/textures";
import { cameraZ } from "./cameraPath";

// The beam of the light version, built as the forging-dune concept builds
// its beam (ForgingSandDuneConcept DuneBeam / ForgeBeam): not a line painted
// on the floor but a single glowing beam floating just over it, a ribbon
// turned to the camera and never thinner than a pixel, with bright dashes
// streaming along it and a hot head that runs on ahead of the visitor; it
// is bright enough throughout for the bloom to give it a soft halo. It follows the journey's route (world/
// layout.js), comes apart into separate lengths in the challenge's passage,
// and runs down into the basin's water at the end. On the light stone it
// keeps its true orange (HDR orange over a bright ground would tone-map to
// pink): its body is drawn in display-range orange, only the dashes and the
// head go hot enough to bloom.

const STRANDS = 1; // one beam
const HEIGHT = 0.42; // metres over the floor
const LEAD = 30; // how far ahead of the camera the head runs (m)

const VERTEX = /* glsl */ `
attribute vec3 aTangent;
attribute float aSide;
attribute float aU;
attribute vec4 aStrand; // width (m), brightness, phase, hot
attribute vec3 aOffset;
uniform float uPixel;
uniform float uSpread;
varying float vU;
varying float vSide;
varying vec4 vStrand;
varying float vWidthFix;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec3 p = position + aOffset * uSpread;
  vec3 toCam = cameraPosition - p;
  vec3 side = normalize(cross(aTangent, toCam));
  float w = max(aStrand.x, length(toCam) * uPixel * 1.3);
  vWidthFix = aStrand.x / w;
  p += side * aSide * w * 0.5;
  vU = aU;
  vSide = aSide;
  vStrand = aStrand;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform float uHead, uLength, uTime, uIntensity, uFlow, uDashFreq, uDashLength, uBase;
uniform float uGap, uGapFrom, uGapTo;
uniform vec3 uColor, uHot;
varying float vU;
varying float vSide;
varying vec4 vStrand;
varying float vWidthFix;
#include <common>
#include <fog_pars_fragment>
float h11(float x) { return fract(sin(x * 91.17) * 43758.5453); }
void main() {
  if (vU > uHead) discard;
  float across = 1.0 - smoothstep(0.2, 1.0, abs(vSide));
  float metres = vU * uLength;
  // dashes streaming along, away from where it began
  float dash = smoothstep(1.0 - uDashLength, 1.0 - uDashLength * 0.3, fract(-metres * uDashFreq + uTime * uFlow + vStrand.z));
  float head = 1.0 - smoothstep(0.0, 8.0, (uHead - vU) * uLength);
  float start = smoothstep(0.0, 5.0, metres);
  // in the passage of the challenge it falls apart into separate lengths
  float inGaps = smoothstep(uGapFrom - 0.01, uGapFrom + 0.01, vU) * (1.0 - smoothstep(uGapTo - 0.01, uGapTo + 0.01, vU));
  float cell = floor(metres / 2.8);
  float broken = step(h11(cell + vStrand.z * 7.0), 0.5) * inGaps * uGap;
  float I = vStrand.y * (uBase + dash * 2.0 + head * 2.6) * across * start * vWidthFix * uIntensity * (1.0 - broken);
  if (I < 0.003) discard;
  vec3 hot = mix(uColor, uHot, clamp(vStrand.w * across * 0.7 + head * 0.6 + dash * 0.35, 0.0, 1.0));
  // bright enough all along to bloom (a soft halo round the line), hotter in
  // its dashes and at its head
  vec3 col = mix(uColor * 2.4, hot * 3.6, clamp(dash * 0.7 + head, 0.0, 1.0));
  gl_FragColor = vec4(col, clamp(I * 2.4, 0.0, 1.0));
  #include <fog_fragment>
}
`;

// the bundle's strands as ribbons along the path
function buildStrands(path, spacing = 0.5) {
  const rng = mulberry32(5);
  const length = path.getLength();
  const n = Math.ceil(length / spacing);
  const pts = path.getSpacedPoints(n);
  const tangents = pts.map((_, i) => path.getTangentAt(i / n));
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const lift = new THREE.Vector3();
  void rng;
  // a single beam, on the route itself
  const strands = Array.from({ length: STRANDS }, () => ({ across: 0, vertical: 0, wave: 0, phase: 0, width: 0.07, bright: 1, hot: 1 }));
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
      // tight where it rises from the floor, a loose bundle along the way
      const spread = THREE.MathUtils.lerp(0.15, 1, THREE.MathUtils.smoothstep(u, 0, 0.02)) * (1 - 0.7 * THREE.MathUtils.smoothstep(u, 0.95, 1));
      const sway = Math.sin(u * length * 0.05 + st.phase) * st.wave;
      const a = (st.across + sway) * spread * 0.3;
      const v = st.vertical * spread * 0.3;
      const p = pts[i];
      for (const sgn of [-1, 1]) {
        pos.push(p.x, p.y, p.z);
        offset.push(side.x * a + lift.x * v, side.y * a + lift.y * v, side.z * a + lift.z * v);
        tan.push(t.x, t.y, t.z);
        sideAttr.push(sgn);
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

// the route, floating: risen out of the floor at its start, and down into
// the basin's water at its end
function beamPath() {
  const pts = PATH_POINTS.map((p, i) => {
    const q = p.clone();
    const last = PATH_POINTS.length - 1;
    q.y = i === 0 ? 0.08 : i === last ? 0.75 : HEIGHT;
    return q;
  });
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

export default function StrandBeam() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const ref = useRef();
  const built = useMemo(() => {
    const path = beamPath();
    const { geometry, length } = buildStrands(path);
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uHead: { value: 0 },
          uLength: { value: length },
          uTime: { value: 0 },
          uIntensity: { value: 1 },
          uFlow: { value: 0.9 },
          uSpread: { value: 1 },
          uDashFreq: { value: 1 / 22 },
          uDashLength: { value: 0.2 },
          uBase: { value: 0.55 },
          uPixel: { value: 0.001 },
          uGap: { value: 0 },
          uGapFrom: { value: PATH_GAPS[0] },
          uGapTo: { value: PATH_GAPS[1] },
          uColor: { value: new THREE.Color("#ff5f00") },
          uHot: { value: new THREE.Color("#ffc890") },
        },
      ]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    // where along it (0–1) the route crosses each z (it runs ever toward -z)
    const N = 1200;
    const zs = [];
    for (let i = 0; i <= N; i++) zs.push(path.getPointAt(i / N).z);
    return { geometry, material, length, zs, N };
  }, []);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  const uAtZ = (z) => {
    const { zs, N } = built;
    if (z >= zs[0]) return 0;
    if (z <= zs[N]) return 1;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (zs[mid] > z) lo = mid;
      else hi = mid;
    }
    return (lo + (z - zs[lo]) / (zs[hi] - zs[lo])) / N;
  };

  useFrame((state) => {
    const t = C.t;
    const u = built.material.uniforms;
    const appear = seg(t, 14, 17.5);
    ref.current.visible = appear > 0;
    if (!appear) return;
    u.uHead.value = Math.max(0.002, uAtZ(cameraZ(t) - LEAD * appear)) * Math.min(1, appear * 3);
    u.uTime.value = state.clock.elapsedTime;
    u.uIntensity.value = T.pathIntensity * 0.42 * (1 - 0.35 * C.soft);
    u.uGap.value = C.gap;
    u.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / gl.domElement.height;
  });

  return <mesh ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} renderOrder={3} />;
}
