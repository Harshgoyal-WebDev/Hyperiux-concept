"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects and uniforms are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CONTACT, choreograph } from "./choreography";

// Runs first each frame: reads the scroll's stage progresses (the master
// timeline's state), works out the whole scene from them (choreography.js)
// into `look`, and sets the camera and the shared uniforms from it. Every
// other part of the scene only reads `look` and the uniforms.
const size = new THREE.Vector2();
export default function Director({ stage, look, uniforms, still = false, dof = 1 }) {
  const gl = useThree((s) => s.gl);
  // the pointer (anywhere on the page: the canvas itself lets pointers through)
  const pointer = useMemo(() => ({ x: 0, y: 0, on: 0, sx: 0, sy: 0, son: 0 }), []);
  useEffect(() => {
    if (still) return;
    const move = (e) => {
      if (e.pointerType === "touch") return;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      pointer.on = 1;
    };
    const leave = () => (pointer.on = 0);
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
    };
  }, [pointer, still]);
  useFrame((state, delta) => {
    const u = uniforms;
    const dt = Math.min(delta, 0.1);
    if (!still) u.uTime.value += dt;
    const t = u.uTime.value;
    const cam = state.camera;
    choreograph(stage, t, state.size.width / state.size.height, look);
    // (the pointer, eased: everything that follows it moves softly)
    const k = 1 - Math.exp(-dt * 3.2);
    pointer.sx += (pointer.x - pointer.sx) * k;
    pointer.sy += (pointer.y - pointer.sy) * k;
    pointer.son += (pointer.on - pointer.son) * (1 - Math.exp(-dt * 2));
    look.pointer.set(pointer.sx, pointer.sy, pointer.son);
    u.uMouse.value.set(pointer.x * 0.25 + pointer.sx * 0.75, pointer.y * 0.25 + pointer.sy * 0.75);
    u.uMouseOn.value = pointer.son;
    u.uAspect.value = state.size.width / Math.max(state.size.height, 1);
    // (a touch of parallax: the camera drifting a little with the pointer)
    look.cam.x += pointer.sx * 0.7 * pointer.son;
    look.cam.y += pointer.sy * 0.4 * pointer.son;
    cam.position.copy(look.cam);
    cam.lookAt(look.target);
    if (Math.abs(cam.fov - look.fov) > 1e-3) {
      cam.fov = look.fov;
      cam.updateProjectionMatrix();
    }
    u.uContact.value.copy(CONTACT);
    u.uEnergy.value = look.energy;
    u.uFlash.value = look.flash;
    u.uShock.value = look.shock;
    u.uFade.value = look.handsFade;
    u.uGlow.value = look.glow;
    // (in focus: the contact; passing through, everything near)
    u.uFocus.value = look.travel > 0 ? 18 : cam.position.distanceTo(CONTACT);
    u.uDof.value = dof * (1 - look.travel);
    gl.getDrawingBufferSize(size);
    u.uPixelRatio.value = gl.getPixelRatio();
    u.uScale.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
  }, -2);
  return null;
}
