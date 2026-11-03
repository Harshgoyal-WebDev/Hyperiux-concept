import * as THREE from "three";
import { C, MARK_POLYS } from "../kit";

// The mark in 3D, from the official SVG (kit.js MARK_POLYS), never re-shaped.
// Mark units (500 × 501, y down) map to the world at S per unit, standing on
// the ground in the x–y plane, facing +z. The four orange pieces are slabs.
// The centre cube is a real box: the mark's cube outline is an exact
// orthographic view of one (solved as in ArchitecturalStorytelling/world/
// space.js), so a camera looking straight down −z sees the logo line for line.

export const S = 0.03;
export const mx = (u) => (u - 250) * S;
export const my = (v) => (488 - v) * S;
export const SLAB = 1.2; // slab depth (world)

// the cube's three edges from its front-top corner, in mark units (y up, z towards the viewer)
const A = [295.242 - 246.651, 228 - 249.33], B = [201.373 - 246.651, 226.5 - 249.33], Hh = 306.756 - 249.33;
const ah = -A[1] * Hh, bh = -B[1] * Hh, ab = A[0] * B[0] + A[1] * B[1], zH = Math.sqrt((ah * bh) / -ab);
const eA = new THREE.Vector3(A[0], -A[1], -ah / zH), eB = new THREE.Vector3(B[0], -B[1], -bh / zH), eH = new THREE.Vector3(0, Hh, zH);

// the cube's size (world) and its pose in the mark: centre + rotation (local x = eA, y = eH, z = −eB)
export const CUBE = (() => {
  const w = eA.length() * S, h = eH.length() * S, d = eB.length() * S;
  const half = eA.clone().add(eB).add(eH).multiplyScalar(0.5 * S);
  const center = new THREE.Vector3(mx(246.651) + half.x, my(306.756) + half.y, 0);
  const m = new THREE.Matrix4().makeBasis(eA.clone().normalize(), eH.clone().normalize(), eB.clone().normalize().negate());
  return { w, h, d, center, quat: new THREE.Quaternion().setFromRotationMatrix(m) };
})();

// mark centre (for framing) and the four column centres (the risers)
export const MARK_CENTER = new THREE.Vector3(0, my(250.5), 0);
export const RISERS = [
  [mx(73.13), my(13), my(222.826)], [mx(73.27), my(278.043), my(487.869)],
  [mx(427.2), my(13), my(222.826)], [mx(426.5), my(278.043), my(487.869)],
];

export function buildMark() {
  const group = new THREE.Group();
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, transparent: true });
  const edgeMat = new THREE.LineBasicMaterial({ color: C.ink, transparent: true });
  const pieces = MARK_POLYS.map((poly) => {
    const sh = new THREE.Shape(poly.map(([u, v]) => new THREE.Vector2(mx(u), my(v))));
    const g = new THREE.ExtrudeGeometry(sh, { depth: SLAB, bevelEnabled: false });
    g.translate(0, 0, -SLAB / 2);
    const m = new THREE.Mesh(g, slabMat);
    m.castShadow = m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), edgeMat));
    group.add(m);
    return m;
  });

  // the outline drafted on the front face before the pieces arrive: one line per piece
  const ghostMat = new THREE.LineBasicMaterial({ color: C.or, transparent: true });
  const ghosts = MARK_POLYS.map((poly) => {
    const pts = [...poly, poly[0]].map(([u, v]) => new THREE.Vector3(mx(u), my(v), SLAB / 2 + 0.02));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ghostMat);
    l.userData.n = pts.length;
    group.add(l);
    return l;
  });

  // risers: the verticals' cores, lit orange at night
  const riserMat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true });
  const risers = RISERS.map(([x, y0, y1]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, y0 - y1, 0.09), riserMat);
    m.position.set(x, (y0 + y1) / 2, SLAB / 2 + 0.05);
    group.add(m);
    return m;
  });

  return { group, pieces, slabMat, edgeMat, ghosts, ghostMat, risers, riserMat };
}
