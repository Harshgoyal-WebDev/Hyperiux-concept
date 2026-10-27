import * as THREE from "three";
import { mulberry32 } from "./layout";

// The cube's isometric orientation: body diagonal towards the viewer, one
// vertex pointing straight up — the silhouette of the hexagon in the logo.
export function isometricQuaternion() {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 0, 1));
  // Spin about the view axis so a corner sits on top.
  const corner = new THREE.Vector3(-1, 1, -1).applyQuaternion(q);
  const angle = Math.PI / 2 - Math.atan2(corner.y, corner.x);
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle).multiply(q);
}

const randomUnit = (rng, out = new THREE.Vector3()) => {
  const u = rng() * 2 - 1;
  const t = rng() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(t), s * Math.sin(t), u);
};

// Pushes a direction away from the camera's travel axis so the fragments
// open a clear corridor through the cube's former position.
function avoidAxis(dir, axis, rng) {
  const d = dir.clone().addScaledVector(axis, -dir.dot(axis) * 0.88);
  if (d.lengthSq() < 0.04) {
    const r = randomUnit(rng);
    d.copy(r).addScaledVector(axis, -r.dot(axis)).normalize();
  }
  return d.normalize();
}

// All fracture data in cube-local space. `axisLocal` is the camera travel
// direction (+Z world) expressed in the cube's rotated frame.
export function buildFractureData(size, quaternion, counts) {
  const rng = mulberry32(404);
  const axisLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion.clone().invert());
  const third = size / 3;

  // 27 cubelets tile the cube exactly, so swapping the solid for them at
  // fracture = 0 is invisible.
  const cubelets = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) {
        const origin = new THREE.Vector3(i - 1, j - 1, k - 1).multiplyScalar(third);
        const base = origin.lengthSq() > 0 ? origin.clone().normalize() : randomUnit(rng);
        base.add(randomUnit(rng).multiplyScalar(0.35));
        cubelets.push({
          origin,
          dir: avoidAxis(base, axisLocal, rng),
          axis: randomUnit(rng),
          seed: rng(),
        });
      }

  const shards = [];
  for (let i = 0; i < counts.shards; i++) {
    const parent = cubelets[Math.floor(rng() * cubelets.length)];
    shards.push({
      parent,
      offset: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(third * 0.9),
      dir: avoidAxis(parent.dir.clone().add(randomUnit(rng).multiplyScalar(0.7)), axisLocal, rng),
      axis: randomUnit(rng),
      spawn: 0.32 + rng() * 0.42,
      dist: 3 + rng() * 9,
      size: 0.1 + Math.pow(rng(), 2) * 0.32,
      seed: rng(),
    });
  }

  const sparks = [];
  for (let i = 0; i < counts.sparks; i++) {
    sparks.push({
      origin: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(size),
      dir: avoidAxis(randomUnit(rng), axisLocal, rng),
      speed: 6 + rng() * 22,
      size: 0.4 + rng() * 1.2,
      seed: rng(),
      delay: rng() * 0.35,
    });
  }

  return { cubelets, shards, sparks, axisLocal };
}
