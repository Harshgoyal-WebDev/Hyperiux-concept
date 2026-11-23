import * as THREE from "three";
import { pointer } from "../pointer";
import { T } from "../tuning";

// The camera magnet: the cursor's pull on every shot, from the first frame
// to the last. The camera swings round a point ahead of it on its line of
// sight, towards the cursor (yaw and pitch), banking into the move and
// swaying with how fast the cursor goes. What it looks at holds still while
// everything between slides past — the dunes against the slab, the reeds
// and banks against the water, the water against the far trees.
//
// `orbit` is how much of the swing moves the camera rather than only turning
// it: 1 swings it round the point ahead, 0 turns it where it stands (through
// the logo's opening, which is only ±1.4 m clear).

const UP = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;

// the cursor, damped (stepped once a frame by the CameraRig, read by every
// camera that draws the scene)
export const magnet = { x: 0, y: 0, swing: 0 };
export function stepMagnet(delta) {
  const dt = Math.min(delta, 0.1);
  const k = 1 - Math.exp(-T.magnetDamping * dt);
  const x0 = magnet.x;
  magnet.x += ((pointer.active ? pointer.x : 0) - magnet.x) * k;
  magnet.y += ((pointer.active ? pointer.y : 0) - magnet.y) * k;
  magnet.swing += (Math.tanh((magnet.x - x0) / Math.max(dt, 1e-3) / 2) - magnet.swing) * k;
}

// soft round the middle of the screen, fuller towards its edges (edge 0: even)
const edgeCurve = (x, edge) => {
  const c = Math.min(1, Math.max(-1, x));
  return c * (1 - edge + edge * c * c);
};

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const pivot = new THREE.Vector3();
const off = new THREE.Vector3();
const qYaw = new THREE.Quaternion();
const qPitch = new THREE.Quaternion();

// Moves the shot (pos, tgt) by the cursor; returns the roll (radians) to
// apply about the camera's view once it is aimed. floorY: it never goes
// below this.
const up = new THREE.Vector3();
// (scale: × T.magnet — the valley's own, lower, T.magnetValley)
export function applyMagnet(pos, tgt, orbit = 1, floorY = -Infinity, scale = 1) {
  const amt = T.magnet * scale;
  if (amt <= 0.001) return 0;
  const cx = edgeCurve(magnet.x, T.magnetEdge);
  const cy = edgeCurve(magnet.y, T.magnetEdge);
  // The classic parallax (T.parallaxMode "shift"): the camera slides
  // sideways and up and down with the cursor, its aim sliding a little
  // with it, so near things move against far ones — no swinging round.
  // (Through the logo's opening, only ±1.4 m clear, it slides by `orbit`.)
  if (T.parallaxMode !== "swing") {
    fwd.subVectors(tgt, pos).normalize();
    right.crossVectors(fwd, UP);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    up.crossVectors(right, fwd).normalize();
    const k = amt * Math.min(Math.max(orbit, 0.15), 1);
    const dx = cx * T.parallaxShiftX * k;
    const dy = cy * T.parallaxShiftY * k;
    const baseY = pos.y;
    pos.addScaledVector(right, dx).addScaledVector(up, dy);
    tgt.addScaledVector(right, dx * T.parallaxLook).addScaledVector(up, dy * T.parallaxLook);
    pos.y = Math.max(pos.y, baseY - T.magnetDip, floorY);
    return 0;
  }
  fwd.subVectors(tgt, pos);
  const reach = Math.min(fwd.length(), T.magnetReach) * Math.min(Math.max(orbit, 0), 1);
  fwd.normalize();
  right.crossVectors(fwd, UP);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  pivot.copy(pos).addScaledVector(fwd, reach);
  qYaw.setFromAxisAngle(UP, cx * T.magnetYaw * DEG * amt);
  qPitch.setFromAxisAngle(right, -cy * T.magnetPitch * DEG * amt);
  qYaw.multiply(qPitch);
  const baseY = pos.y;
  off.subVectors(pos, pivot).applyQuaternion(qYaw);
  pos.copy(pivot).add(off);
  off.subVectors(tgt, pivot).applyQuaternion(qYaw);
  tgt.copy(pivot).add(off);
  // (it rises freely, but dips only a little: low shots stay clear of the
  // ground, the water and the beam over it)
  pos.y = Math.max(pos.y, baseY - T.magnetDip, floorY);
  return (cx * T.magnetBank + magnet.swing * T.magnetSwing) * DEG * amt;
}
