"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { C, seg } from "../timeline";
import { T } from "../tuning";
import { PATH_GAPS, PATH_LENGTH, pathCurve } from "../world/layout";
import { pathMaterial, ribbonAlong } from "../world/materials";
import { cameraZ } from "./cameraPath";

// The orange path: one line through the whole journey, the thread of the
// story. It is not there at the opening; it rises from the floor as the path
// chapter begins and is drawn on ahead of the visitor, always a little in
// front of the camera (so it leads), breaks into lengths in the passage of
// the challenge, rejoins at the panels, runs round under the ramp (whose
// own edge then lights), lines the gallery's planes, softens round the tree
// and leads straight through the last arch.
const LEAD = 34; // metres ahead of the camera the line has reached

// arc-length position (0–1) of the path where it crosses each z: the path
// runs ever toward -z, so this is a simple lookup
function zTable(curve) {
  const N = 1200;
  const zs = [];
  for (let i = 0; i <= N; i++) zs.push(curve.getPointAt(i / N).z);
  return { N, zs };
}
function uAtZ(TABLE, z) {
  const { N, zs } = TABLE;
  if (z >= zs[0]) return 0;
  if (z <= zs[N]) return 1;
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (zs[mid] > z) lo = mid;
    else hi = mid;
  }
  const f = (z - zs[lo]) / (zs[hi] - zs[lo]);
  return (lo + f) / N;
}

// curve / length / gaps / cameraZ / appear: the world's own (the light
// version's by default); appear: [t from, t to] of its rising
export default function OrangePath({ curve = pathCurve, length = PATH_LENGTH, gaps = PATH_GAPS, cameraZ: camZ = cameraZ, appear: appearAt = [14, 17.5] }) {
  const res = useMemo(() => {
    // (wide: a narrow beam and, either side, its soft halo on the stone)
    const geo = ribbonAlong(curve, 2.8, 2400);
    const mat = pathMaterial();
    mat.uniforms.uLength.value = length;
    mat.uniforms.uGapFrom.value = gaps[0];
    mat.uniforms.uGapTo.value = gaps[1];
    return { geo, mat, table: zTable(curve) };
  }, [curve, length, gaps]);

  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [res]
  );

  useFrame(() => {
    const t = C.t;
    const u = res.mat.uniforms;
    // (from the deterministic camera path, not the parallaxed camera)
    const appear = seg(t, appearAt[0], appearAt[1]);
    u.uReveal.value = appear > 0 ? Math.max(0.004, uAtZ(res.table, camZ(t) - LEAD * appear)) * Math.min(1, appear * 3) : 0;
    u.uGap.value = C.gap;
    u.uSoft.value = C.soft;
    u.uIntensity.value = T.pathIntensity;
  });

  return <mesh geometry={res.geo} material={res.mat} renderOrder={3} frustumCulled={false} />;
}
