import * as THREE from "three";
import { V, rng } from "../kit";

// The district both 07 District and 08 Occupancy stand in (the storyboard
// engine's layout): one road along the beam's 12° direction, five project
// buildings alternating either side of it, ~100 filler blocks around them.
// Each chapter builds its own copy (a mesh has one parent) with its own
// materials; geometry and the window textures are shared.

export const RD = new THREE.Vector3(1, 0, -0.45).normalize(); // along the road
export const RN = new THREE.Vector3(0.45, 0, 1).normalize(); // across it
export const RR = 0.42; // the road's yaw
export const road = (s) => RD.clone().multiplyScalar(s);

// project: name, year, tags, mock-facade palette (client colours stay on the facade)
export const PROJ = [
  ["Montra", "2023", "Web design · Branding · Marketing", ["#1E3DFF", "#62D5FF"]],
  ["Yellow", "2024", "Web design · Branding · Marketing", ["#F5C518", "#1A1A1A"]],
  ["Patronum", "2023", "Web design · Marketing · Branding", ["#3A2A6E", "#C9A6FF"]],
  ["Montra App", "2025", "Web design · Branding · Marketing", ["#0E9F6E", "#C6F25A"]],
  ["Monielink", "2025", "Web design · Marketing · Branding", ["#D7263D", "#FF9DB0"]],
];
export const BH = [21, 29, 8, 32, 30.6]; // roof heights
export const BLD = PROJ.map((p, j) => {
  const s = -48 + 24 * j, side = j % 2 ? 1 : -1;
  return { s, side, P: road(s).addScaledVector(RN, side * 15) };
});

// the five buildings, in their own frame (yawed RR at BLD[j].P):
// box [w,h,d] or cylinder [r,h] at height y, local yaw ry, offset lx/lz
const bx = (w, h, d, y, ry = 0, lx = 0, lz = 0) => ({ box: [w, h, d], y, ry, lx, lz });
const cy = (r, h, y) => ({ cyl: [r, h], y, ry: 0, lx: 0, lz: 0 });
export const PARTS = [
  [bx(10, 8, 10, 4), bx(9, 7, 9, 11.5, 0, 1.5, 1), bx(8, 6, 8, 18, 0, -1, 2)],
  [cy(6, 26, 13), cy(4.4, 3, 27.5)],
  [bx(16, 4, 10, 2), bx(22, 1, 13, 4.5, 0, 3), bx(6, 3, 6, 6.5, 0, -3)],
  [bx(7, 32, 3.2, 16)],
  Array.from({ length: 9 }, (_, i) => bx(8, 3.4, 8, 1.7 + i * 3.4, i * 0.12)),
];
// the facade screen on the road side: width, height, centre height, depth offset
export const FACADE = [[8.6, 6.2, 4, 5], [7, 9, 14, 6.2], [13, 3.1, 2, 5], [5.4, 11.6, 18, 1.6], [6.6, 6.4, 13, 5.8]];

// filler blocks [x, z, w, d, h], kept clear of the projects
export const FILL = (() => {
  const r = rng(21), o = [];
  for (let i = 0; i < 120; i++) {
    const s = -100 + r() * 200, side = r() < 0.5 ? -1 : 1, off = side * (9 + r() * 46), p = road(s).addScaledVector(RN, off);
    const w = 4 + r() * 5, d = 4 + r() * 5, h = 3 + r() * 14;
    if (BLD.some((b) => Math.hypot(b.P.x - p.x, b.P.z - p.z) < 13)) continue;
    o.push([p.x, p.z, w, d, h]);
  }
  return o;
})();
export const winClass = (h) => (h < 9 ? 0 : h < 20 ? 1 : 2);

// the five industry zones (Occupancy), alternating across the road
export const ZN = [0, 1, 2, 3, 4].map((k) => road(-64 + 32 * k).addScaledVector(RN, (k % 2 ? -1 : 1) * 30));

// camera stations
export const camK = (j, back = 38) => {
  const b = BLD[j];
  return [road(b.s - back).addScaledVector(RN, -b.side * 9).add(V([0, 15, 0])), V([b.P.x, BH[j] * 0.45, b.P.z])];
};
export const camFront = (j, d) => {
  const b = BLD[j];
  return [b.P.clone().addScaledVector(RN, -b.side * d).add(V([0, 6, 0])), V([b.P.x, 5, b.P.z])];
};

// ——— shared resources ———
export const UNIT = new THREE.BoxGeometry(1, 1, 1);
const XA = new THREE.Vector3(1, 0, 0), YA = new THREE.Vector3(0, 1, 0);

// night window textures, one per height class (lit cells warm, the rest dark)
let WT = null;
export function winTextures() {
  if (WT) return WT;
  const make = (cols, rows, seed) => {
    const c = document.createElement("canvas");
    c.width = cols * 16; c.height = rows * 16;
    const x = c.getContext("2d"), r = rng(seed);
    x.fillStyle = "#121215"; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const lit = r() < 0.16;
      x.fillStyle = lit ? (r() < 0.5 ? "#FFC58A" : "#FFE2B8") : "#1E1E24";
      x.globalAlpha = lit ? 0.55 + r() * 0.45 : 1;
      x.fillRect(i * 16 + 4, j * 16 + 5, 8, 7);
    }
    x.globalAlpha = 1;
    return new THREE.CanvasTexture(c);
  };
  WT = [make(10, 6, 3), make(10, 14, 5), make(10, 26, 7)];
  return WT;
}

const partGeo = new Map();
function geoFor(p) {
  const k = p.box ? "b" + p.box.join(",") : "c" + p.cyl.join(",");
  if (!partGeo.has(k)) {
    const g = p.box ? new THREE.BoxGeometry(...p.box) : new THREE.CylinderGeometry(p.cyl[0], p.cyl[0], p.cyl[1], 12);
    partGeo.set(k, { g, e: new THREE.EdgesGeometry(g, 20) });
  }
  return partGeo.get(k);
}

// ground plane, grid, road surface, edge lines and the orange centre dashes
export function buildBase() {
  const group = new THREE.Group();
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), groundMat);
  ground.rotation.x = -Math.PI / 2; group.add(ground);
  const gp = [];
  for (let v = -160; v <= 160; v += 8) gp.push(v, 0.01, -160, v, 0.01, 160, -160, 0.01, v, 160, 0.01, v);
  const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
  const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.045 });
  group.add(new THREE.LineSegments(gg, gridMat));
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x17171b, roughness: 0.7, metalness: 0.1 });
  const roadM = new THREE.Mesh(new THREE.PlaneGeometry(300, 8), roadMat);
  roadM.rotation.set(-Math.PI / 2, 0, RR); roadM.position.y = 0.02; group.add(roadM);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x56565c });
  const em = new THREE.InstancedMesh(UNIT, edgeMat, 2), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromUnitVectors(XA, RD);
  [-4, 4].forEach((o, i) => { m4.compose(RN.clone().multiplyScalar(o).setY(0.04), q, V([300, 0.02, 0.08])); em.setMatrixAt(i, m4); });
  group.add(em);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xff6a13, transparent: true, opacity: 0.85 });
  const dash = new THREE.InstancedMesh(UNIT, dashMat, 150), S = V([1.1, 0.02, 0.16]);
  for (let i = 0; i < 150; i++) { m4.compose(road(-150 + i * 2).setY(0.05), q, S); dash.setMatrixAt(i, m4); }
  group.add(dash);
  return { group, groundMat, gridMat, roadMat, edgeMat, dashMat };
}

// filler blocks: one instanced mesh per window class (mats[k] = [side, roof]),
// plus all their edges as one line set. idx[k] lists the FILL index of each instance.
export function buildFillers(mats) {
  const group = new THREE.Group(), byK = [[], [], []];
  FILL.forEach((b, i) => byK[winClass(b[4])].push(i));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(YA, RR), P = new THREE.Vector3(), S = new THREE.Vector3();
  const edges = [], eg = new THREE.EdgesGeometry(UNIT), ep = eg.attributes.position, tv = new THREE.Vector3();
  const meshes = byK.map((list, k) => {
    const [side, roof] = mats[k];
    const m = new THREE.InstancedMesh(UNIT, [side, side, roof, roof, side, side], list.length);
    list.forEach((fi, n) => {
      const [x, z, w, d, h] = FILL[fi];
      m4.compose(P.set(x, h / 2, z), q, S.set(w, h, d)); m.setMatrixAt(n, m4);
      for (let e = 0; e < ep.count; e++) { tv.fromBufferAttribute(ep, e).applyMatrix4(m4); edges.push(tv.x, tv.y, tv.z); }
    });
    group.add(m);
    return m;
  });
  const feg = new THREE.BufferGeometry(); feg.setAttribute("position", new THREE.Float32BufferAttribute(edges, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4a4a52, transparent: true, opacity: 0.7 });
  group.add(new THREE.LineSegments(feg, edgeMat));
  return { group, meshes, idx: byK, edgeMat };
}

// the five project buildings. side(h) → facade material for a part of height h,
// roof → roof material, edge[j] → that building's edge material.
// Returns their groups (yawed, at BLD[j].P) and the meshes (userData.j set) for raycasting.
export function buildProjects(side, roof, edge) {
  const groups = [], meshes = [];
  BLD.forEach((b, j) => {
    const G = new THREE.Group(); G.position.copy(b.P); G.rotation.y = RR; groups.push(G);
    PARTS[j].forEach((p) => {
      const { g, e } = geoFor(p), h = p.box ? p.box[1] : p.cyl[1], s = side(h);
      const m = new THREE.Mesh(g, p.box ? [s, s, roof, roof, s, s] : [s, roof, roof]);
      m.position.set(p.lx, p.y, p.lz); m.rotation.y = p.ry; m.userData.j = j;
      m.add(new THREE.LineSegments(e, edge[j]));
      G.add(m); meshes.push(m);
    });
  });
  return { groups, meshes };
}

// window cells over every block face (fillers and projects), as world
// matrices for small quads facing out; three random sets so they can light in turn
export function windowCells(seed = 9, p = 0.2) {
  const r = rng(seed), sets = [[], [], []], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(0.9, 1, 1);
  const put = (cx, cz, rot, nOff, tw, y0, h) => {
    const cols = Math.max(1, Math.floor(tw / 1.8)), rows = Math.max(1, Math.floor((h - 0.8) / 2.2));
    const nx = Math.sin(rot), nz = Math.cos(rot), tx = Math.cos(rot), tz = -Math.sin(rot);
    q.setFromAxisAngle(YA, rot);
    for (let i = 0; i < cols; i++) for (let k = 0; k < rows; k++) {
      if (r() > p) continue;
      const u = ((i + 0.5) / cols - 0.5) * tw * 0.86, y = y0 + 1.3 + k * 2.2;
      P.set(cx + nx * nOff + tx * u, y, cz + nz * nOff + tz * u);
      sets[Math.floor(r() * 3)].push(m4.compose(P, q, S).clone());
    }
  };
  const boxFaces = (cx, cz, w, d, y0, h, yaw) => {
    put(cx, cz, yaw, d / 2 + 0.05, w, y0, h); put(cx, cz, yaw + Math.PI, d / 2 + 0.05, w, y0, h);
    put(cx, cz, yaw + Math.PI / 2, w / 2 + 0.05, d, y0, h); put(cx, cz, yaw - Math.PI / 2, w / 2 + 0.05, d, y0, h);
  };
  FILL.forEach(([x, z, w, d, h]) => boxFaces(x, z, w, d, 0, h, RR));
  const c = Math.cos(RR), s = Math.sin(RR);
  BLD.forEach((b, j) => PARTS[j].forEach((pt) => {
    const cx = b.P.x + pt.lx * c + pt.lz * s, cz = b.P.z - pt.lx * s + pt.lz * c;
    if (pt.box) { const [w, h, d] = pt.box; if (h > 1.5) boxFaces(cx, cz, w, d, pt.y - h / 2, h, RR + pt.ry); return; }
    const [rad, h] = pt.cyl, ap = rad * Math.cos(Math.PI / 12) + 0.05;
    for (let f = 0; f < 12; f++) put(cx, cz, RR + Math.PI / 12 + (f * Math.PI) / 6, ap, 2 * rad * Math.sin(Math.PI / 12), pt.y - h / 2, h);
  }));
  return sets;
}
