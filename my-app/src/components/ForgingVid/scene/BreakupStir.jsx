"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { STIR_BALL } from "../world/windField";
import { STIR_UNIFORMS } from "../world/breakup";
import { pointer } from "../pointer";
import { T } from "../tuning";

// The pointer stirring the broken rock as it streams round the mark: an
// invisible ball following the pointer (closely, on a critically damped
// spring: no lag to speak of, no overshoot) that flings whatever it hits
// along its stroke — sand, gravel and pieces — each of which then coasts out
// and eases back home to its own place in its stream (world/windField.js has
// the physics; the sand and gravel step their own pushes, the Forge its
// pieces'). It is only there while it moves — its reach comes from its
// speed — so a resting pointer touches nothing. Only while there is broken
// rock on screen. Every part of it is in the panel (Breakup → Pointer stir).
const STEP = 1 / 240; // its spring's substep

export default function BreakupStir({ J }) {
  const { size } = useThree();
  const s = useMemo(() => ({ placed: false, wasActive: false, radius: 0, activeUntil: 0 }), []);

  useFrame((_, delta) => {
    const B = STIR_BALL;
    const on = J.fracture > 0 && T.breakStirForce > 0;
    if (!on) {
      STIR_UNIFORMS.uStirOn.value = 0;
      B.on = false;
      s.placed = false;
      return;
    }
    const dt = Math.min(delta, 0.1);
    const now = performance.now();
    const R = Math.max(T.breakStirRadius, 0.01);
    B.radius = R;
    B.aspect = size.width / Math.max(size.height, 1);
    // the pointer, in the field's units (screen heights over the ball's
    // radius); the ball starts there (and is put back there when the pointer
    // comes back onto the page, so it never sweeps in from where it left)
    const tx = ((pointer.x * 0.5 + 0.5) * B.aspect) / R;
    const ty = (pointer.y * 0.5 + 0.5) / R;
    const back = pointer.active && !s.wasActive;
    s.wasActive = pointer.active;
    if (!s.placed || s.radius !== R || back) {
      B.pos.set(tx, ty);
      B.vel.set(0, 0);
      s.placed = true;
      s.radius = R;
    }
    B.prev.copy(B.pos);
    // after the pointer, critically damped (smooths the mouse's steps; never
    // swings past it); once the pointer has left, it comes to rest
    const k = Math.max(T.breakStirFollow, 1);
    const c = 2 * Math.sqrt(k);
    const gx = pointer.active ? tx : B.pos.x;
    const gy = pointer.active ? ty : B.pos.y;
    for (let t = 0; t < dt - 1e-6; t += STEP) {
      const h = Math.min(STEP, dt - t);
      B.vel.x += ((gx - B.pos.x) * k - B.vel.x * c) * h;
      B.vel.y += ((gy - B.pos.y) * k - B.vel.y * c) * h;
      B.pos.addScaledVector(B.vel, h);
    }
    // there only while it moves: at once as it sets off, gone as it stops
    const want = Math.min(B.vel.length() / 2, 1);
    B.presence += (want - B.presence) * (1 - Math.exp(-dt / (want > B.presence ? 0.03 : 0.12)));
    if (B.presence < 1e-3) B.presence = 0;
    const linger = Math.max(T.breakStirLinger, 0.2);
    // (critically damped home: settled to within a few percent by ~linger)
    B.omega = 4.7 / linger;
    B.throw = T.breakStirForce;
    B.spread = T.breakStirSpread;
    B.mass = T.breakStirMass;
    // stepping on until what was stirred has settled
    if (B.presence > 0) s.activeUntil = now + linger * 2500;
    B.on = now < s.activeUntil;
    STIR_UNIFORMS.uStirScale.value = R;
    STIR_UNIFORMS.uStirGlow.value = T.breakStirGlow;
    STIR_UNIFORMS.uStirOn.value = B.on ? 1 : 0;
  });
  return null;
}
