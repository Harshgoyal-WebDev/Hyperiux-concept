"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createWindField } from "../world/windField";
import { STIR_UNIFORMS } from "../world/breakup";
import { pointer } from "../pointer";
import { T } from "../tuning";

// The pointer stirring the broken rock's sand and gravel as it streams round
// the mark: a field over the screen (world/windField.js, in screen uv)
// brushed along the pointer's path
// each frame — the grains there are pushed along its motion and parted from
// its line, harder the faster it goes (and lit, if T.breakStirGlow) — that
// relaxes over T.breakStirLinger, so they ease back into their streams. The
// sand and gravel read it (STIR_UNIFORMS, world/breakup.js), each by its own
// amount; only while there is broken rock on screen. Every part of it is in
// the panel (Breakup → Pointer stir).
export default function BreakupStir({ J }) {
  const { gl } = useThree();
  const field = useMemo(() => createWindField(new THREE.Vector4(0, 0, 1, 1)), []);
  useEffect(() => () => field.dispose(), [field]);
  const s = useMemo(
    () => ({ last: { x: 0, z: 0 }, now: { x: 0, z: 0 }, vel: new THREE.Vector2(), want: new THREE.Vector2(), moving: 0, lastMoved: 0, hasLast: false, activeUntil: 0 }),
    []
  );

  useFrame((_, delta) => {
    const on = J.fracture > 0 && T.breakStirForce > 0;
    if (!on) {
      STIR_UNIFORMS.uStirOn.value = 0;
      s.hasLast = false;
      return;
    }
    const dt = Math.min(delta, 0.1);
    const now = performance.now();
    // the pointer in screen uv, and how fast it moves (uv / s, smoothed)
    s.now.x = pointer.x * 0.5 + 0.5;
    s.now.z = pointer.y * 0.5 + 0.5;
    if (!s.hasLast) {
      s.last.x = s.now.x;
      s.last.z = s.now.z;
      s.hasLast = true;
    }
    const moved = pointer.active && pointer.movedAt !== s.lastMoved;
    s.lastMoved = pointer.movedAt;
    if (moved) s.vel.lerp(s.want.set((s.now.x - s.last.x) / dt, (s.now.z - s.last.z) / dt), 1 - Math.exp(-dt / Math.max(T.breakStirSmooth, 0.005)));
    else s.vel.multiplyScalar(Math.exp(-dt / 0.08));
    s.moving += ((moved ? Math.min(s.vel.length() * 1.5, 1) : 0) - s.moving) * (1 - Math.exp(-dt / (moved ? 0.05 : 0.15)));
    const linger = Math.max(T.breakStirLinger, 0.05);
    if (moved || s.moving > 0.01) s.activeUntil = now + linger * 4000;
    if (now < s.activeUntil) {
      const brushing = moved && s.vel.lengthSq() > 1e-4;
      STIR_UNIFORMS.uStir.value = field.step(gl, {
        from: brushing ? s.last : null,
        to: brushing ? s.now : null,
        vel: s.want.copy(s.vel).multiplyScalar(3),
        push: 0.12 * T.breakStirForce,
        radius: T.breakStirRadius,
        glowRadius: T.breakStirRadius * 0.8,
        glow: s.moving,
        relax: Math.exp(-dt / (linger * 0.6)),
        fade: Math.exp(-dt / (linger * 0.4)),
        wake: T.breakStirWake,
        along: T.breakStirAlong,
        apart: T.breakStirApart,
        // (frame-rate independent: the share per 60th of a second)
        ease: 1 - Math.pow(1 - Math.min(T.breakStirEase, 1), dt * 60),
      });
      STIR_UNIFORMS.uStirGlow.value = T.breakStirGlow;
      STIR_UNIFORMS.uStirSpread.value = T.breakStirSpread;
      STIR_UNIFORMS.uStirOn.value = 1;
    } else STIR_UNIFORMS.uStirOn.value = 0;
    s.last.x = s.now.x;
    s.last.z = s.now.z;
  });
  return null;
}
