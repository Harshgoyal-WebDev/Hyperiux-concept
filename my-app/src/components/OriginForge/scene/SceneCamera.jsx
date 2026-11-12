"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "../timeline";
import { cameraAt } from "./cameraPath";
import { attachPointer, pointer } from "../pointer";
import { T } from "../tuning";

// The cinematographer. Deterministic: the shot is a pure function of the
// timeline (plus a barely-there breathing drift), so scrubbing forward,
// backward or jumping always frames the same moment.
//
// Framing is kept by horizontal field of view: a portrait phone widens the
// vertical fov (to a limit) so the four pillars or the mark still fit across.
//
// On top of the shot, the pointer moves the whole scene: the camera slides a
// little toward it, leans its gaze and banks, smoothed so it floats rather
// than follows (T.parallax*).
const REF_ASPECT = 16 / 9;
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export default function SceneCamera() {
  const camera = useThree((s) => s.camera);
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), px: 0, py: 0 }), []);
  useEffect(() => attachPointer(), []);

  useFrame((state, delta) => {
    const { pos, look } = tmp;
    const baseFov = cameraAt(C.t, pos, look);
    const time = state.clock.elapsedTime;
    // breathing: a few centimetres, slow
    pos.x += Math.sin(time * 0.21) * 0.05;
    pos.y += Math.sin(time * 0.17 + 1.3) * 0.04;

    // parallax: eased toward the pointer (back to centre when it leaves)
    const k = 1 - Math.exp(-Math.min(delta, 0.1) / Math.max(T.parallaxSmooth, 0.01));
    tmp.px += ((pointer.active ? pointer.x : 0) - tmp.px) * k;
    tmp.py += ((pointer.active ? pointer.y : 0) - tmp.py) * k;
    _fwd.subVectors(look, pos).normalize();
    _right.crossVectors(_fwd, camera.up).normalize();
    _up.crossVectors(_right, _fwd);
    pos.addScaledVector(_right, tmp.px * T.parallaxMove).addScaledVector(_up, tmp.py * T.parallaxMove * 0.6);
    look.addScaledVector(_right, tmp.px * T.parallaxLook).addScaledVector(_up, tmp.py * T.parallaxLook * 0.6);
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.rotateZ(THREE.MathUtils.degToRad(-tmp.px * T.parallaxRoll));

    const aspect = state.size.width / state.size.height;
    let fov = baseFov;
    if (aspect < REF_ASPECT) {
      const h = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * REF_ASPECT);
      const corrected = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / aspect));
      fov = Math.min(THREE.MathUtils.lerp(baseFov, corrected, 0.72), 74);
    }
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, -1);

  return null;
}
