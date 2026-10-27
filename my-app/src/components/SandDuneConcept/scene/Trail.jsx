"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { backTrail, frontTrail } from "../world/layout";
import { T } from "../tuning";

// The orange line: a flat ribbon draped on the dunes. Front trail leads to
// the monolith (visible from the hero), the core beam carries it up the
// seam of the monolith's face and into the cube at its core, back trail is
// unrolled from the far face as the energy resolves into it. The drawing
// tip is a round cap. A thin, normally blended core
// survives the white-out; an additive halo gives it glow on the dark sand.
const TRAIL_VERTEX = /* glsl */ `
attribute float aS;
attribute float aSide;
attribute float aSeg;
attribute float aH;
attribute float aLen;
uniform float uFlatten;
varying float vS;
varying float vSide;
varying float vSeg;
varying float vDist;
varying float vLen;
void main() {
  vLen = aLen;
  vec3 p = position;
  p.y = aH * (1.0 - uFlatten) + 0.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vS = aS;
  vSide = aSide;
  vSeg = aSeg;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const TRAIL_FRAGMENT = /* glsl */ `
uniform float uFront;
uniform float uBack;
uniform float uCore;
uniform float uRear;
uniform float uHalfWidth;
uniform float uIntensity;
uniform float uTime;
uniform float uHalo;
uniform float uWhite;
uniform vec3 uColor;
varying float vS;
varying float vSide;
varying float vSeg;
varying float vDist;
varying float vLen;
void main() {
  float reveal = vSeg < 0.5 ? uFront : (vSeg < 1.5 ? uBack : (vSeg < 2.5 ? uCore : uRear));
  if (reveal <= 0.0) discard;
  // metres past the drawing tip; the tip is a half-disc cap of the
  // ribbon's own half width (until the segment is fully drawn)
  float ahead = reveal < 0.999 ? (vS - reveal) * vLen / uHalfWidth : -1.0;
  float edge = ahead > 0.0 ? length(vec2(ahead, vSide)) : abs(vSide);
  if (edge >= 1.0 && uHalo < 0.5) discard;
  float profile = uHalo > 0.5 ? exp(-edge * edge * 4.0) * 0.22 * (1.0 - smoothstep(0.7, 1.0, edge)) : 1.0 - smoothstep(0.6, 1.0, edge);
  // slow pulses travelling along the line (towards the monolith on the
  // front trail, away from it on the back trail)
  float dir = vSeg < 0.5 || vSeg > 1.5 ? 1.0 : -1.0;
  float pulse = 0.85 + 0.15 * sin(vS * 160.0 * dir + uTime * 1.6);
  // bright drawing head while the line is still being drawn
  float head = (1.0 - smoothstep(0.0, 6.0, (reveal - vS) * vLen)) * 2.2 * (1.0 - step(0.999, reveal));
  float I = profile * pulse * (1.0 + head) * uIntensity;
  // keep the far trail from shimmering into a dotted line
  I *= mix(1.0, 0.6, smoothstep(150.0, 600.0, vDist));
  if (I < 0.003) discard;
  // On the white-out the line must stay true orange: HDR orange over HDR
  // white tone-maps to pink, so drop to display-range orange and full cover.
  // Normal blending needs alpha in [0, 1] — above 1 it subtracts the
  // background and the bright head turned black. Extra brightness goes
  // into the colour instead.
  vec3 col = uColor * (uHalo > 0.5 ? 2.0 : mix(3.2, 0.9, uWhite)) * (1.0 + max(I - 1.0, 0.0) * 0.6);
  float a = clamp(mix(I, I * 2.0, uWhite), 0.0, 1.0);
  gl_FragColor = uHalo > 0.5 ? vec4(col * I, 1.0) : vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Ground height for the line: the analytic dunes or the rendered sand mesh,
// whichever is higher. The mesh is a coarse grid whose flat triangles can
// sit above the analytic surface and bury the line in places.
function groundHeight(terrain, heightField) {
  return (x, z) => Math.max(terrain.height(x, z), heightField ? heightField.sample(x, z) + 0.15 : -Infinity);
}

function ribbon(curve, seg, ground, halfWidth, positions, attrs) {
  const length = curve.getLength();
  const n = Math.max(Math.ceil(length / 1.0), 1);
  const pts = curve.getSpacedPoints(n);
  const t = new THREE.Vector3();
  const base = positions.length / 3;
  for (let i = 0; i <= n; i++) {
    const p = pts[i];
    const prev = pts[Math.max(i - 1, 0)];
    const next = pts[Math.min(i + 1, n)];
    t.subVectors(next, prev).setY(0).normalize();
    const h = ground(p.x, p.z);
    for (const s of [-1, 1]) {
      positions.push(p.x - t.z * halfWidth * s, h, p.z + t.x * halfWidth * s);
      attrs.s.push(i / n);
      attrs.side.push(s);
      attrs.seg.push(seg);
      attrs.h.push(h);
      attrs.len.push(length);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = base + i * 2;
    attrs.index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
}

// The core beam runs in the x = 0 plane (along the ground, up the face, in
// through the cut-out), so its width always lies along x: flat on the
// ground, face-on against the stone. aH is its real height.
function ribbonInPlane(curve, seg, halfWidth, positions, attrs) {
  const length = curve.getLength();
  const n = Math.max(Math.ceil(length / 0.5), 1);
  const pts = curve.getSpacedPoints(n);
  const base = positions.length / 3;
  for (let i = 0; i <= n; i++) {
    const p = pts[i];
    for (const s of [-1, 1]) {
      positions.push(p.x + halfWidth * s, p.y, p.z);
      attrs.s.push(i / n);
      attrs.side.push(s);
      attrs.seg.push(seg);
      attrs.h.push(p.y);
      attrs.len.push(length);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = base + i * 2;
    attrs.index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
}

// Front trail's end → across the ground to the foot of the logo face → up
// the seam between the halves to the hexagon cut-out → in along its floor
// → up into the cube.
// How far the front line is drawn at the hero (fraction of its length).
const FRONT_START = 0.64;

export function buildCoreBeam(monolith, terrain, heightField) {
  const c = monolith.cube.position;
  const fz = monolith.frontZ;
  const start = frontTrail.getPointAt(1);
  const face = fz + 0.35; // just proud of the stone
  const hexHalf = (monolith.cube.hexHeightWorld ?? monolith.cube.size * 1.8) / 2;
  const floor = c.y - hexHalf + 0.35;
  // Never buried in the sand (that showed as a gap at the foot of the
  // face); the shader adds its usual 0.3 m lift on top.
  const ground = groundHeight(terrain, heightField);
  const g = (z) => ground(0, z);
  const foot = Math.max(g(fz + 0.3), g(fz + 1.5), g(fz + 3)) + 0.5;
  const pts = [
    new THREE.Vector3(start.x, g(start.z), start.z),
    new THREE.Vector3(0, g(fz + 4.5), fz + 4.5),
    new THREE.Vector3(0, Math.max(g(fz + 1.8), foot - 0.3), fz + 1.8),
    new THREE.Vector3(0, foot, face),
    new THREE.Vector3(0, THREE.MathUtils.lerp(foot, floor, 0.5), face),
    new THREE.Vector3(0, floor, face),
    new THREE.Vector3(0, floor, c.z + monolith.cube.size * 0.9),
    new THREE.Vector3(0, c.y - monolith.cube.size * 0.35, c.z),
  ];
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

// The mirror of the core beam: as the cube breaks, its energy runs out of
// the back of the cut-out, down the far face and along the sand to where
// the back trail starts, so the line is under the camera as it flies
// through and on.
export function buildRearBeam(monolith, terrain, heightField) {
  const c = monolith.cube.position;
  const bz = monolith.backZ;
  const back = bz - 0.35; // just proud of the far face
  const hexHalf = (monolith.cube.hexHeightWorld ?? monolith.cube.size * 1.8) / 2;
  const floor = c.y - hexHalf + 0.35;
  const ground = groundHeight(terrain, heightField);
  const g = (z) => ground(0, z);
  const foot = Math.max(g(bz - 0.3), g(bz - 1.5), g(bz - 3)) + 0.5;
  const end = backTrail.getPointAt(0);
  const pts = [
    new THREE.Vector3(0, c.y - monolith.cube.size * 0.35, c.z),
    new THREE.Vector3(0, floor, c.z - monolith.cube.size * 0.9),
    new THREE.Vector3(0, floor, back),
    new THREE.Vector3(0, THREE.MathUtils.lerp(foot, floor, 0.5), back),
    new THREE.Vector3(0, foot, back),
    new THREE.Vector3(0, Math.max(g(bz - 1.8), foot - 0.3), bz - 1.8),
    new THREE.Vector3(0, g(bz - 4.5), bz - 4.5),
    new THREE.Vector3(end.x, g(end.z), end.z),
  ];
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

function buildTrailGeometry(ground, coreBeam, rearBeam, halfWidth) {
  const positions = [];
  const attrs = { s: [], side: [], seg: [], h: [], len: [], index: [] };
  ribbon(frontTrail, 0, ground, halfWidth, positions, attrs);
  ribbon(backTrail, 1, ground, halfWidth, positions, attrs);
  ribbonInPlane(coreBeam, 2, halfWidth, positions, attrs);
  ribbonInPlane(rearBeam, 3, halfWidth, positions, attrs);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("aS", new THREE.Float32BufferAttribute(attrs.s, 1));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(attrs.side, 1));
  g.setAttribute("aSeg", new THREE.Float32BufferAttribute(attrs.seg, 1));
  g.setAttribute("aH", new THREE.Float32BufferAttribute(attrs.h, 1));
  g.setAttribute("aLen", new THREE.Float32BufferAttribute(attrs.len, 1));
  g.setIndex(attrs.index);
  return g;
}

export default function Trail({ terrain, heightField, monolith, J, shared }) {
  const built = useMemo(() => {
    const ground = groundHeight(terrain, heightField);
    const coreBeam = buildCoreBeam(monolith, terrain, heightField);
    const rearBeam = buildRearBeam(monolith, terrain, heightField);
    const make = (halo, halfWidth) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uFront: { value: 1 },
          uBack: { value: 0 },
          uCore: { value: 0 },
          uRear: { value: 0 },
          uHalfWidth: { value: halfWidth },
          uIntensity: { value: 1 },
          uHalo: { value: halo ? 1 : 0 },
          uTime: shared.uTime,
          uFlatten: shared.uFlatten,
          uWhite: shared.uWhite,
          uColor: { value: new THREE.Color("#FF5F00") },
        },
        vertexShader: TRAIL_VERTEX,
        fragmentShader: TRAIL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        blending: halo ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
    return {
      // distances the one continuous stroke (J.beam) is split between
      frontRun: frontTrail.getLength() * (1 - FRONT_START),
      frontLength: frontTrail.getLength(),
      coreLength: coreBeam.getLength(),
      core: { geometry: buildTrailGeometry(ground, coreBeam, rearBeam, 0.13), material: make(false, 0.13) },
      halo: { geometry: buildTrailGeometry(ground, coreBeam, rearBeam, 0.85), material: make(true, 0.85) },
    };
  }, [terrain, heightField, monolith, shared]);

  useEffect(
    () => () => {
      for (const part of [built.core, built.halo]) {
        part.geometry.dispose();
        part.material.dispose();
      }
    },
    [built]
  );

  useFrame(() => {
    const fade = 1 - J.trailFade;
    const coreU = built.core.material.uniforms;
    const haloU = built.halo.material.uniforms;
    // The front line is drawn ahead of the camera as it travels in; on
    // load it races out from under the viewer (J.intro). The lead offset
    // closes as it arrives, so it always reaches the monolith and joins
    // the core beam without a break.
    const d = J.beam * (built.frontRun + built.coreLength);
    const front = FRONT_START + Math.min(d, built.frontRun) / built.frontLength;
    const arrive = Math.min(d / built.frontRun, 1);
    const lead = THREE.MathUtils.clamp(front + (T.trailLead - 1) * 0.15 * (1 - arrive), 0, 1);
    coreU.uFront.value = haloU.uFront.value = THREE.MathUtils.lerp(0.46, lead, J.intro);
    coreU.uCore.value = haloU.uCore.value = Math.max(d - built.frontRun, 0) / built.coreLength;
    coreU.uRear.value = haloU.uRear.value = J.rearBeam;
    coreU.uBack.value = haloU.uBack.value = J.backTrail;
    coreU.uIntensity.value = fade * T.trailIntensity;
    // The halo is part of the dark-world look; it bows out with the light.
    haloU.uIntensity.value = fade * (1 - J.white) * (1 + J.energy * 0.6) * T.trailIntensity * T.trailHalo;
  });

  return (
    <>
      <mesh geometry={built.halo.geometry} material={built.halo.material} frustumCulled={false} renderOrder={2} />
      <mesh geometry={built.core.geometry} material={built.core.material} frustumCulled={false} renderOrder={3} />
    </>
  );
}
