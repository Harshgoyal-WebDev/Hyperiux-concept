"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Wraps an angle difference into (-π, π] — so interpolating from `start`'s
// angle around `target` to `end`'s reliably sweeps the *shorter* way
// around (e.g. an `end` placed 180° from `start` always reads as a clean
// half-revolution) instead of occasionally taking the long way around
// because the raw atan2 difference happened to land past ±180°.
function shortestAngleDelta(from, to) {
  const raw = to - from;
  return ((raw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

// Drives the camera on an arc around `target` as the page scrolls through
// its 0..1 progress: it starts at `start`, always looking at `target`, and
// by the time progress reaches 1 it's at `end` — both `start` and `end`
// are plain world-space points (not derived multipliers), so placing them
// in Leva directly controls where the camera begins and ends up. The path
// between them sweeps around `target` at an interpolated radius/height
// rather than a straight line, so it still reads as an orbit rather than
// cutting through the scene.
//
// Both endpoints' radius/angle/height are recomputed from `start`/`end`/
// `target` every frame (not cached once at mount) specifically so
// dragging those values in Leva updates the camera immediately, instead
// of only taking effect on the next full remount — the flat cost of a few
// trig calls a frame is nothing next to the win of live-tunable endpoints.
export default function ScrollCameraRig({ progressRef, start, end, target, damping = 6 }) {
  const s = useRef(null);
  if (s.current === null) {
    s.current = {
      desiredPos: new THREE.Vector3(),
      lookTarget: new THREE.Vector3(),
      targetVec: new THREE.Vector3(),
      initialized: false,
    };
  }
  const st = s.current;

  useFrame((state, delta) => {
    const dx0 = start[0] - target[0];
    const dz0 = start[2] - target[2];
    const radius0 = Math.sqrt(dx0 * dx0 + dz0 * dz0) || 0.001;
    const angle0 = Math.atan2(dz0, dx0);
    const y0 = start[1];

    const dx1 = end[0] - target[0];
    const dz1 = end[2] - target[2];
    const radius1 = Math.sqrt(dx1 * dx1 + dz1 * dz1) || 0.001;
    const angle1 = Math.atan2(dz1, dx1);
    const y1 = end[1];

    const t = THREE.MathUtils.clamp(progressRef.current, 0, 1);
    const eased = THREE.MathUtils.smoothstep(t, 0, 1);

    const angle = angle0 + shortestAngleDelta(angle0, angle1) * eased;
    const radius = THREE.MathUtils.lerp(radius0, radius1, eased);
    const y = THREE.MathUtils.lerp(y0, y1, eased);

    st.desiredPos.set(
      target[0] + radius * Math.cos(angle),
      y,
      target[2] + radius * Math.sin(angle)
    );
    st.targetVec.set(target[0], target[1], target[2]);
    st.lookTarget.copy(st.targetVec);

    if (!st.initialized) {
      state.camera.position.copy(st.desiredPos);
      st.initialized = true;
    } else {
      const lerpAmt = 1 - Math.exp(-damping * delta);
      state.camera.position.lerp(st.desiredPos, lerpAmt);
    }
    state.camera.lookAt(st.lookTarget);
  });

  return null;
}
