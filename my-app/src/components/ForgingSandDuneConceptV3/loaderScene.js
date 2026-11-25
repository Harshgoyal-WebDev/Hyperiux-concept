import * as THREE from "three";
import { T } from "./tuning";

// What the loader (Loader.jsx) and its reveal in the scene (scene/Rig.jsx
// LoaderRevealEffect) share.
//  · the scene: the cube cut out of the slab (the reveal sets off from it),
//    the slab's bounds, the terrain's height map — set by scene/Scene.jsx;
//  · the cube's outline as it lies on the screen (its hexagon, then the
//    junction of its three inner edges, in CSS pixels) — projected every
//    frame by Rig.jsx, so the loader draws its cube exactly over it.
export const LOADER_SCENE = {
  origin: new THREE.Vector3(0, 0, -60),
  slabMin: new THREE.Vector3(-6, 0, -66),
  slabMax: new THREE.Vector3(6, 14, -54),
  height: null,
  heightParams: new THREE.Vector4(-1500, -1500, 10, 2),
  cube: null, // { hex: Vector3[6], junction: Vector3 } in the world
  cubeScreen: null, // Float32Array(14): hex x,y ×6, junction x,y — CSS px
  cubeView: null, // ...the same points as the camera sees them (its own space, m)
  lens: 0,
};

// The cube as the opening shot's camera sees it (its own space, m: hexagon
// ×6, then the joint; and the lens, degrees) — the shot is always the same,
// so the loader can draw the cube exactly where the slab's will be, at once,
// before the scene is loaded. Measured from the scene (rememberCube keeps the
// latest, should the shot or the slab ever be retuned).
const CUBE_VIEW = [
  -0.1988, -1.9281, -149.9754, 4.1744, -0.0551, -150.2159, 4.1744, 5.1022, -150.878, 0.3906, 6.7626, -151.0912, -4.2738, 5.2361, -150.8952, -4.2738, -0.0551, -150.2159,
  -0.49, 3.5757, -150.6821,
];
const CUBE_LENS = 45.9;
const STORE = "forging-sand-dune-concept-v3:loader-cube";
let remembered = false;
export function rememberCube(view, lens) {
  if (remembered) return;
  remembered = true;
  try {
    window.localStorage.setItem(STORE, JSON.stringify({ view: Array.from(view, (v) => +v.toFixed(4)), lens }));
  } catch {
    // (storage unavailable: the built-in shape is used)
  }
}
function storedCube() {
  try {
    const s = JSON.parse(window.localStorage.getItem(STORE) || "null");
    if (s && Array.isArray(s.view) && s.view.length === 21) return s;
  } catch {
    // (nothing kept)
  }
  return CUBE_VIEW ? { view: CUBE_VIEW, lens: CUBE_LENS } : null;
}
// The cube on the screen (CSS px: hexagon x,y ×6, then the joint) — as the
// scene projects it, or, before it is there, from the shot as it is known.
export function cubeOnScreen(w, h) {
  if (LOADER_SCENE.cubeScreen) return LOADER_SCENE.cubeScreen;
  const known = storedCube();
  if (!known) return null;
  // (the lens as the camera has it: wider on portrait screens — Rig.jsx)
  const aspect = w / Math.max(h, 1);
  const widen = Math.max(1, Math.pow(1 / aspect, 0.6));
  const t = Math.tan(((known.lens * Math.PI) / 180) / 2) * widen;
  const out = new Float32Array(14);
  for (let i = 0; i < 7; i++) {
    const [x, y, z] = known.view.slice(i * 3, i * 3 + 3);
    const nx = x / -z / (t * aspect);
    const ny = y / -z / t;
    out[i * 2] = (nx * 0.5 + 0.5) * w;
    out[i * 2 + 1] = (0.5 - ny * 0.5) * h;
  }
  return out;
}

// The reveal's timing, in seconds and as shares of the whole sweep
// (J.loaderSweep 0 → 1): the slab's (out from its heart: 0.42 of
// T.loaderReveal) and the desert's ring (setting off at 0.3 of it, running
// T.loaderDesert s).
export function loaderTiming() {
  const reveal = Math.max(T.loaderReveal, 0.4);
  const slab = reveal * 0.42;
  const ringAt = reveal * 0.3;
  const ring = Math.max(T.loaderDesert, 0.3);
  const total = Math.max(slab, ringAt + ring);
  return { total, slabDur: slab / total, ringStart: ringAt / total, ringDur: ring / total };
}
