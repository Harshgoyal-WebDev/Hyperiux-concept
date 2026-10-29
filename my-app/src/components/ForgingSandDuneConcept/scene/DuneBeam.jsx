"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DUNES } from "../config";
import { T } from "../tuning";
import { buildStrands } from "./ForgeBeam";
import { flightDistance, lineZ, swayAtDistance, weaveAt } from "../world/duneCamera";

// The beam past the mark: as the camera goes through the opening the energy
// runs on out of the core, drops to just over the sand and races on ahead
// of the camera along the flight line — the camera following it out over
// the dunes, its head always DUNES.beamLead metres in front. It stays one
// bundle all the way: through the whiteout it runs on over the contour
// drawing in true orange, then fades as the rocks turn to sand.
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
varying vec3 vWorld;
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
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform float uHead;
uniform float uTail;
uniform float uLength;
uniform float uTime;
uniform float uIntensity;
uniform float uFlow;
uniform float uDashFreq;
uniform float uDashLength;
uniform float uBase;
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uWhite;
uniform float uWhiteR;
uniform vec2 uWhitePos;
varying float vU;
varying float vSide;
varying vec4 vStrand;
varying float vWidthFix;
varying vec3 vWorld;
void main() {
  if (vU > uHead || vU < uTail) discard;
  float across = 1.0 - smoothstep(0.2, 1.0, abs(vSide));
  float metres = vU * uLength;
  // dashes streaming away from the core, along with the flight
  float dash = smoothstep(1.0 - uDashLength, 1.0 - uDashLength * 0.3, fract(-metres * uDashFreq + uTime * uFlow + vStrand.z));
  float head = 1.0 - smoothstep(0.0, 10.0, (uHead - vU) * uLength);
  // out of the core it grows in over its first metres
  float start = smoothstep(0.0, 6.0, metres - uTail * uLength);
  float I = vStrand.y * (uBase + dash * 2.2 + head * 3.0) * across * start * vWidthFix * uIntensity;
  if (I < 0.002) discard;
  vec3 col = mix(uColor, uHot, clamp(vStrand.w * across * 0.7 + head * 0.6 + dash * 0.3, 0.0, 1.0));
  // On the white the line must stay true orange: HDR orange over HDR white
  // tone-maps to pink, so drop to display-range orange and full cover.
  float wh = max(1.0 - smoothstep(uWhiteR - 90.0, uWhiteR, length(vWorld.xz - uWhitePos)), uWhite);
  col = mix(col * 2.4, uColor * 0.9, wh);
  gl_FragColor = vec4(col, clamp(mix(I, I * 4.0, wh), 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// The path, world metres: out of the core, down to just over the sand
// within ~45 m, then along the flight line (swaying as the camera does), on
// on past where the journey ends. It glides
// over the dunes rather than dipping into every trough: its height follows
// the crests nearby (the highest sand within ±30 m along the line),
// smoothed, and stays clear of the sand under it.
const STEP = 18;
function buildPath(forge, terrain) {
  const core = forge.world.core;
  const end = flightDistance(1) + DUNES.beamLead * 3 + 60;
  const line = [];
  for (let d = 12; d <= end; d += STEP) {
    const x = weaveAt(d, swayAtDistance(d));
    let crest = -Infinity;
    for (let o = -30; o <= 30; o += 10) crest = Math.max(crest, terrain.height(weaveAt(d + o, swayAtDistance(d + o)), lineZ(d + o)));
    line.push({ d, x, z: lineZ(d), crest });
  }
  const pts = [new THREE.Vector3(core.x, core.y, core.z)];
  line.forEach((s, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(i - 3, 0); j <= Math.min(i + 3, line.length - 1); j++, n++) sum += line[j].crest;
    const k = THREE.MathUtils.smoothstep(s.d, 0, 45);
    // (never closer than 3 m to the sand right under it, on a sharp crest)
    const y = Math.max(sum / n, s.crest - 1.5) + DUNES.beamHeight;
    pts.push(new THREE.Vector3(s.x, THREE.MathUtils.lerp(core.y, y, k), s.z));
  });
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

// tight out of the core, a loose bundle over the sand
const DUNE_SPREAD = (u) => THREE.MathUtils.lerp(0.15, 1.0, THREE.MathUtils.smoothstep(u, 0, 0.04));

export default function DuneBeam({ terrain, forge, J, shared }) {
  const { gl, camera } = useThree();
  const ref = useRef();
  const built = useMemo(() => {
    const path = buildPath(forge, terrain);
    const { geometry, length } = buildStrands(path, { spreadAt: DUNE_SPREAD, spacing: 1.2 });
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uHead: { value: 0 },
        uTail: { value: 0 },
        uLength: { value: length },
        uTime: shared.uTime,
        uIntensity: { value: 1 },
        uFlow: { value: 1 },
        uSpread: { value: 1 },
        uDashFreq: { value: 0.045 },
        uDashLength: { value: 0.1 },
        uBase: { value: 0.45 },
        uPixel: { value: 0.001 },
        uWhite: shared.uWhite,
        uWhiteR: shared.uWhiteR,
        uWhitePos: shared.uWhitePos,
        uColor: { value: new THREE.Color("#ff5f00") },
        uHot: { value: new THREE.Color("#ffc890") },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { geometry, material, length };
  }, [forge, terrain, shared]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  useFrame(() => {
    const u = built.material.uniforms;
    const on = J.duneBeam > 0.001 && J.progress > 0;
    if (ref.current) ref.current.visible = on;
    if (!on) return;
    // the head runs ahead of the camera (shooting out to its lead as the
    // camera comes through the mark)
    const d = flightDistance(J.progress);
    const head = d + DUNES.beamLead * T.beamLeadScale * J.duneBeam;
    u.uHead.value = Math.min(head / built.length, 1);
    // behind the camera it is let go (nothing to draw there)
    u.uTail.value = Math.max(d - 60, 0) / built.length;
    u.uIntensity.value = T.trailIntensity * Math.min(J.duneBeam * 2, 1) * (1 - J.duneBeamFade);
    u.uFlow.value = T.beamFlow;
    u.uSpread.value = T.beamSpread;
    u.uDashFreq.value = 1 / Math.max(T.beamDashSpacing, 0.5);
    u.uDashLength.value = T.beamDashLength;
    u.uBase.value = T.beamBase;
    u.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / gl.domElement.height;
    u.uColor.value.set(T.crackColor);
  });

  return <mesh ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} renderOrder={3} />;
}
