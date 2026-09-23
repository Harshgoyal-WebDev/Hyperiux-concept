"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Rotates its children opposite to cursor movement instead of translating
// them. The rotation pivots around `center` (the cuboid's position) via a
// nested group: the outer group sits at `center` and does the rotating,
// the inner group cancels that offset so everything renders in its normal
// place at rest — meaning `center` itself sits exactly on the pivot and
// never moves, while the rest of the scene swings around it.
//
// The tilt/yaw axes are read from the camera's own current world-space
// basis (its live right/up vectors), not the fixed world X/Y axes — so
// this still looks correct regardless of where the camera has been moved
// or angled to. Using fixed world axes only looks right when the camera
// sits on the default straight-on view.

// Yaw (from horizontal cursor movement) reads as four times more dramatic
// than pitch (from vertical movement) — hence the x4 multiplier below.
const Y_TO_X_RATIO = 4;

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// `pointerRef` (optional) is a live NDC (-1..1) cursor position tracked
// outside R3F — pass this instead of relying on `state.pointer` when this
// component's children are mounted inside a `createPortal`-ed scene (see
// PortalRenderer.jsx): a portaled subtree gets its own isolated `pointer`
// (@react-three/fiber's `Portal` always overrides it with a fresh Vector2
// that's never written to), so `state.pointer` inside one always reads as
// frozen at (0, 0) — real cursor movement never reaches it.
export default function Parallax({
  strength = 0.3,
  lerp = 0.06,
  center = [0, 0, 0],
  pointerRef,
  children,
}) {
  const pivotRef = useRef(null);

  const scratch = useRef(null);
  if (scratch.current === null) {
    scratch.current = {
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      qPitch: new THREE.Quaternion(),
      qYaw: new THREE.Quaternion(),
      qTarget: new THREE.Quaternion(),
    };
  }

  useFrame((state) => {
    const pivot = pivotRef.current;
    if (!pivot) return;

    const { right, up, forward, qPitch, qYaw, qTarget } = scratch.current;
    state.camera.matrixWorld.extractBasis(right, up, forward);

    const pointer = pointerRef ? pointerRef.current : state.pointer;
    const pitchAngle = pointer.y * strength;
    const yawAngle = -pointer.x * strength * Y_TO_X_RATIO;

    // Pitch tilts relative to whichever way the camera is currently facing
    // (its own right vector), but yaw always swings around true world-up —
    // not the camera's own up vector, which drifts slightly off world-up
    // once the camera sits at an angle (from its lookAt), producing a
    // subtle unwanted swirl for pure horizontal movement.
    qPitch.setFromAxisAngle(right, pitchAngle);
    qYaw.setFromAxisAngle(WORLD_UP, yawAngle);
    qTarget.multiplyQuaternions(qYaw, qPitch);

    pivot.quaternion.slerp(qTarget, lerp);
  });

  return (
    <group ref={pivotRef} position={center}>
      <group position={[-center[0], -center[1], -center[2]]}>{children}</group>
    </group>
  );
}
