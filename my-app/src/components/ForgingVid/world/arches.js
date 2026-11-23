import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "./layout";

// Scene 02's semi-circular stone structures (scene/valley/Arches.jsx): rings
// of cut sandstone blocks (voussoirs) standing across the canyon, their
// lower part sunk in the sand. Per vertex too: aBlock (the block's turn as
// the arches build themselves: feet first, the keystone last, mapped into
// order0 … order0 + orderSpan) and aPivot (its centre). Each block is tapered to the ring (a wedge),
// weathered by a noise of its own position (so its faces stay closed), and
// set with a hairline gap to the next. Per vertex: aGlow (the inner faces of
// about half the blocks carry the energy: world/sandstone.js), aSeed.

function voussoir(n3, len, band, depth, R) {
  const g = new THREE.BoxGeometry(len, band, depth, 3, 2, 2);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // (a wedge: narrower on the ring's inside)
    v.x *= (R + v.y) / R;
    const e = n3(v.x * 0.6, v.y * 0.6, v.z * 0.6) * 0.09 + n3(v.x * 1.8, v.y * 1.8, v.z * 1.8) * 0.035;
    v.multiplyScalar(1 + e);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

// A ring of radius R (to the middle of its band) standing in the local xy
// plane round the origin, its axis along z; blocks below `sunk` (a share of
// R under the centre) are left out, being under the sand.
// (`sweep`: the order the blocks rise in — 0 feet first, 1 from the left
// foot over the top to the right (as the camera looking along the ring's
// axis sees it: local +x is on its left), -1 from the right to the left)
export function archGeometry(seed, R, band, depth, sunk = 0.5, order0 = 0, orderSpan = 1, sweep = 0) {
  const phi = Math.asin(Math.min(sunk, 1));
  const rng = mulberry32(seed);
  const n3 = createNoise3D(rng);
  const count = Math.max(12, Math.round((Math.PI * 2 * R) / 3.1));
  const len = ((Math.PI * 2 * R) / count) * 0.985;
  const parts = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 0, 1);
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + Math.PI / 2;
    if (Math.sin(a) < -sunk) continue;
    const g = voussoir(n3, len, band * (0.94 + rng() * 0.12), depth * (0.95 + rng() * 0.1), R);
    // (its inside face carries the energy on about half of them)
    const glow = rng() < 0.5 ? 0.7 + rng() * 0.3 : 0;
    const n = g.attributes.position.count;
    const aGlow = new Float32Array(n);
    const p = g.attributes.position;
    for (let i = 0; i < n; i++) aGlow[i] = p.getY(i) < -band * 0.3 ? glow : 0;
    g.setAttribute("aGlow", new THREE.BufferAttribute(aGlow, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(n).fill(rng()), 1));
    let order = (Math.sin(a) + sunk) / (1 + sunk);
    if (sweep !== 0) {
      let b = Math.atan2(Math.sin(a), Math.cos(a));
      if (b < -phi - 1e-6) b += Math.PI * 2;
      const u = (b + phi) / (Math.PI + 2 * phi); // 0 at the left foot, 1 at the right
      order = sweep > 0 ? u : 1 - u;
    }
    g.setAttribute("aBlock", new THREE.BufferAttribute(new Float32Array(n).fill(order0 + order * orderSpan), 1));
    const pivot = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pivot.set([Math.cos(a) * R, Math.sin(a) * R, 0], i * 3);
    g.setAttribute("aPivot", new THREE.BufferAttribute(pivot, 3));
    q.setFromAxisAngle(axis, a - Math.PI / 2);
    m.compose(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    parts.push(g);
  }
  const geometry = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return geometry;
}
