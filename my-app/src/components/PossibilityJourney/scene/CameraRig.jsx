"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "../timeline";
import { T } from "../tuning";
import { attachPointer, pointer } from "../../OriginForge/pointer";
import { cameraAt as lightCameraAt } from "./cameraPath";

// The camera rig. The shot is a pure function of the scroll (cameraPath.js);
// on top of it, only the pointer's subtle parallax (the camera slides a
// little toward it and leans its gaze, eased), which returns to centre when
// the pointer leaves. No drift, no shake.
//
// Framing is kept by horizontal field of view: a portrait screen widens the
// vertical fov (to a limit) so the compositions still fit across.
const REF_ASPECT = 16 / 9;
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export default function CameraRig({ cameraAt = lightCameraAt }) {
  const camera = useThree((s) => s.camera);
  const st = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), px: 0, py: 0 }), []);
  useEffect(() => attachPointer(), []);

  useFrame((state, delta) => {
    const { pos, look } = st;
    const baseFov = cameraAt(C.t, pos, look);
    const k = 1 - Math.exp(-Math.min(delta, 0.1) / Math.max(T.parallaxSmooth, 0.01));
    st.px += ((pointer.active ? pointer.x : 0) - st.px) * k;
    st.py += ((pointer.active ? pointer.y : 0) - st.py) * k;
    _fwd.subVectors(look, pos).normalize();
    _right.crossVectors(_fwd, camera.up).normalize();
    _up.crossVectors(_right, _fwd);
    pos.addScaledVector(_right, st.px * T.parallaxMove).addScaledVector(_up, st.py * T.parallaxMove * 0.5);
    look.addScaledVector(_right, st.px * T.parallaxLook).addScaledVector(_up, st.py * T.parallaxLook * 0.5);
    camera.position.copy(pos);
    camera.lookAt(look);

    const aspect = state.size.width / state.size.height;
    let fov = baseFov;
    if (aspect < REF_ASPECT) {
      const h = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * REF_ASPECT);
      const corrected = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / aspect));
      fov = Math.min(THREE.MathUtils.lerp(baseFov, corrected, 0.7), 78);
    }
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, -1);

  return null;
}
