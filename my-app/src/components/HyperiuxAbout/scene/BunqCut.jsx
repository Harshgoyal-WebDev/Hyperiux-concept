"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createCutPass } from "@/components/ForgingSandDuneConceptV3/scene/CutTransition";
import { T } from "@/components/ForgingSandDuneConceptV3/tuning";
import { TEAM_LAYER, teamPose } from "./stage";

// The change from the hero to the team: the forging-sand-dune-concept-v3's
// own bunq transition (bunqlabs.com's — CutTransition.jsx: glass discs on a
// hexagonal grid growing up from the bottom, each refracting the next shot,
// running together until it is all the next shot), with its settings. While
// it runs (S.cut 0 → 1) the team's shot — the team camera at its stage — is
// rendered into a target for it; once it is over, the main camera is that
// shot (the Director), so nothing jumps.
export function useBunqCut() {
  const cut = useMemo(() => createCutPass(), []);
  useEffect(() => () => cut.material.dispose(), [cut]);
  return cut;
}

export function BunqCutDriver({ S, U, cut, stage }) {
  const { gl, scene, camera, size } = useThree();
  const res = useMemo(
    () => ({
      target: new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true }),
      cam: new THREE.PerspectiveCamera(35, 1, 0.5, 4000),
      pos: new THREE.Vector3(),
      tgt: new THREE.Vector3(),
      buf: new THREE.Vector2(),
    }),
    []
  );
  useEffect(() => () => res.target.dispose(), [res]);

  useFrame((state) => {
    const u = cut.uniforms;
    const t = S.cut;
    u.uT.value = t;
    u.uAspect.value = size.width / Math.max(size.height, 1);
    u.uTime.value = state.clock.elapsedTime;
    // (bunq, from the bottom, as V3's: its own settings)
    u.uStyle.value = 1;
    u.uBRes.value.set(size.width, Math.max(size.height, 1));
    u.uBCellPx.value = Math.max(T.transCellPx, 2);
    u.uBSpread.value = T.transSpread;
    u.uBJitter.value = T.transJitter;
    u.uBOvershoot.value = T.transOvershoot;
    u.uBRefract.value = T.transRefract;
    u.uBWobble.value = T.transWobble;
    u.uBBulge.value = T.transBulge;
    u.uBDir.value = 0;
    u.uHold.value = 0;
    u.uReveal.value = 0;
    cut.pass.enabled = t > 0.0005 && t < 0.9995;
    if (!cut.pass.enabled) return;
    gl.getDrawingBufferSize(res.buf);
    res.buf.floor();
    if (res.target.width !== res.buf.x || res.target.height !== res.buf.y) res.target.setSize(res.buf.x, res.buf.y);
    teamPose(stage, S, U.sway, res.pos, res.tgt);
    const cam = res.cam;
    // (the team's own scene only: nothing of the hero in its shot)
    cam.layers.set(TEAM_LAYER);
    cam.position.copy(res.pos);
    cam.lookAt(res.tgt);
    cam.aspect = camera.aspect;
    cam.fov = camera.fov;
    cam.near = camera.near;
    cam.far = camera.far;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(res.target);
    gl.clear();
    gl.render(scene, cam);
    gl.setRenderTarget(prev);
    u.tB.value = res.target.texture;
  });
  return null;
}
