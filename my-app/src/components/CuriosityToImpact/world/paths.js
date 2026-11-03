import * as THREE from "three";
import { at } from "../story";
import { CLUSTERS } from "./states";

// The cinematography, and the idea's journey, as keys on the timeline
// (beat, fraction) joined by smooth curves. The camera: a wide establishing
// shot, a push in, through the flow, across it (05), the network revealed,
// down onto the convergence, up to the sculpture, a partial orbit round it,
// then forward through it as it dissolves, into the light.

const CAMERA = [
  [1, 0, [0, 3, 70], [0, 0, 0]],
  [1, 1, [0, 2, 56], [0, 0, 0]],
  [2, 0.6, [1, 1.5, 40], [0, 0, 0]],
  [3, 0.6, [5, 2, 27], [2, 0, 0]],
  [4, 0.5, [1, 1, 25], [1, 0, 0]],
  [5, 0.15, [-9, 0.5, 16], [-6, 0, 0]],
  [5, 0.85, [9, 0.5, 16], [6, 0, 0]],
  [6, 0.5, [2, 3, 24], [0, 0, -4]],
  [7, 0.55, [0, 5, 46], [0, 1, -4]],
  [8, 0.6, [0, 7, 20], [0, 0, 0]],
  [9, 0.6, [0, 1.5, 21], [0, 0, 0]],
  [10, 0.5, [9, 2.5, 21], [0, 0.3, 0]],
  [11, 0.5, [-9, -3, 20], [0, 0, 0]],
  [12, 0.5, [3, 1.5, 24], [0, 0, 0]],
  [13, 0.2, [0, 0.5, 15], [0, 0, 0]],
  [13, 0.9, [0, 0, 2], [0, 0, -20]],
  [14, 0.8, [0, 0, -10], [0, 0, -40]],
  [15, 0.8, [0, 0, -14], [0, 0, -44]],
  [16, 1, [0, 0, -15], [0, 0, -45]],
];

// The idea: a faint light far off in the void, joining the flow, crossing
// it (05), through the network, from discipline to discipline (07), into
// the centre, inside the sculpture, ahead through its dissolution, out to
// the right in the light — and onto the page (World.jsx lands it).
const [D, T, S, E] = CLUSTERS;
const ENERGY = [
  [1, 0, [-46, -10, -70]],
  [1, 1, [-30, -7, -50]],
  [2, 0.7, [-14, -3, -14]],
  [3, 0.7, [-6, -1, -1]],
  [4, 0.5, [3, 0.4, 0.5]],
  [5, 0.15, [-8, 0, 1.5]],
  [5, 0.85, [8, 0, 1.5]],
  [6, 0.5, [-3, 1.5, -5]],
  [7, 0.25, D],
  [7, 0.45, T],
  [7, 0.65, S],
  [7, 0.85, E],
  [8, 0.7, [0, 0, 0]],
  [9, 0.7, [0, 0.2, 0]],
  [10, 0.5, [1.5, 0.8, 1]],
  [11, 0.5, [-1, -0.8, 0.5]],
  [12, 0.5, [0, 0, 0]],
  [13, 0.5, [0, 0, -6]],
  [14, 0.6, [0, 0, -26]],
  [15, 0.6, [9, 0.5, -34]],
  [16, 1, [12, 0, -36]],
];

function track(keys, pick) {
  const times = keys.map(([n, fr]) => at(n, fr));
  const curve = new THREE.CatmullRomCurve3(
    keys.map((k) => new THREE.Vector3(...pick(k))),
    false,
    "centripetal"
  );
  const last = keys.length - 1;
  // time → the curve's parameter, eased inside each segment so the motion
  // flows through the keys rather than stopping at them
  return (t, out) => {
    if (t <= times[0]) return curve.getPoint(0, out);
    if (t >= times[last]) return curve.getPoint(1, out);
    let i = 0;
    while (t > times[i + 1]) i++;
    const f = (t - times[i]) / (times[i + 1] - times[i]);
    const e = f * f * (3 - 2 * f) * 0.35 + f * 0.65;
    return curve.getPoint((i + e) / last, out);
  };
}

export const cameraAt = track(CAMERA, (k) => k[2]);
export const lookAt = track(CAMERA, (k) => k[3]);
export const energyAt = track(ENERGY, (k) => k[2]);
