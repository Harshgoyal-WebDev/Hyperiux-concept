import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { mulberry32 } from "./layout";

// The hero's ancient ruins (scene/hero/Ruins.jsx): tall sandstone pillars on
// the far dunes, broken slabs half buried in the sand, and a ring arch
// sunk to its shoulders beside the slab — all one merged geometry (one draw
// call), in world space. Every vertex is moved by a function of its own
// position only, so the box's faces (which have their own vertices at the
// edges) stay closed.

// Weathering for a block standing on y = 0, h tall: strata grooves, eroded
// faces, a slight taper and lean, and (optionally) a broken, jagged top.
function weather(g, seed, h, { taper = 0.1, erode = 0.09, broken = 0.12 } = {}) {
  const rng = mulberry32(seed);
  const n3 = createNoise3D(rng);
  const lean = (rng() - 0.5) * 0.05;
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y01 = v.y / h;
    const band = Math.sin(v.y * 1.6 + n3(0.3, v.y * 0.25, 1.7) * 3) * 0.035;
    const ero = n3(v.x * 0.3, v.y * 0.3, v.z * 0.3) * erode + n3(v.x * 1.2, v.y * 1.2, v.z * 1.2) * erode * 0.35;
    const s = (1 - y01 * taper) * (1 + band + ero);
    let y = v.y;
    if (broken > 0 && y01 > 0.72) y -= Math.max(0, n3(v.x * 0.55 + 9, 2.1, v.z * 0.55 + 9) + 0.25) * h * broken * ((y01 - 0.72) / 0.28);
    v.set(v.x * s + lean * y, y, v.z * s);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// A pillar or slab: w × h × d, standing on its base at y = 0.
export function blockGeometry(seed, w, h, d, opts) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(2, Math.round(w / 2)), Math.max(4, Math.round(h / 1.6)), Math.max(2, Math.round(d / 2)));
  g.translate(0, h / 2, 0);
  return weather(g, seed, h, opts);
}

// A ring of stone (radius R to the middle of its band, the band `thick`
// across and `depth` deep), standing in the xy plane round the origin: four
// strips (outer, inner, front, back), each with its own vertices so the
// edges stay crisp. Per vertex `glow`: the inner face carries the energy.
export function ringGeometry(seed, R, thick, depth, seg = 64) {
  const n3 = createNoise3D(mulberry32(seed));
  const Ri = R - thick / 2;
  const Ro = R + thick / 2;
  const pos = [];
  const glow = [];
  const index = [];
  const strip = (corner, reverse, g) => {
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      for (let j = 0; j < 2; j++) {
        const [r, z] = corner(j);
        // eroded: pushed in and out along the band, a few chips out of it
        const x0 = r * Math.cos(a);
        const y0 = r * Math.sin(a);
        const e = n3(x0 * 0.25, y0 * 0.25, z * 0.25) * 0.28 + n3(x0 * 0.9, y0 * 0.9, z * 0.9) * 0.08;
        const rr = r + e * (r > R ? 1 : -0.6);
        pos.push(rr * Math.cos(a), rr * Math.sin(a), z * (1 + e * 0.15));
        glow.push(g);
      }
    }
    for (let i = 0; i < seg; i++) {
      const a0 = base + i * 2;
      const a1 = a0 + 1;
      const b0 = a0 + 2;
      const b1 = a0 + 3;
      if (reverse) index.push(a0, a1, b0, b0, a1, b1);
      else index.push(a0, b0, a1, b0, b1, a1);
    }
  };
  strip((j) => [Ro, j ? depth / 2 : -depth / 2], false, 0.15); // outer
  strip((j) => [Ri, j ? depth / 2 : -depth / 2], true, 1); // inner
  strip((j) => [j ? Ro : Ri, depth / 2], true, 0.3); // front
  strip((j) => [j ? Ro : Ri, -depth / 2], false, 0.3); // back
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aGlow", new THREE.Float32BufferAttribute(glow, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// An angular stone fragment about 1 m across: the hull of a few dozen
// points on a squashed, lumpy ellipsoid (broken faces, no two alike).
export function fragmentGeometry(seed) {
  const rng = mulberry32(seed);
  const n3 = createNoise3D(rng);
  const sx = 0.7 + rng() * 0.6;
  const sy = 0.45 + rng() * 0.45;
  const sz = 0.6 + rng() * 0.5;
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const u = rng() * 2 - 1;
    const t = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const d = new THREE.Vector3(s * Math.cos(t), u, s * Math.sin(t));
    const r = 0.55 + 0.45 * (n3(d.x * 1.3, d.y * 1.3, d.z * 1.3) * 0.5 + 0.5);
    pts.push(new THREE.Vector3(d.x * sx * r, d.y * sy * r, d.z * sz * r));
  }
  const g = new ConvexGeometry(pts);
  g.deleteAttribute("uv");
  return g;
}

// Where the ruins stand. Pillars: [x, z, width, height, depth, glow, seed];
// slabs: [x, z, width, height, depth, lean (rad), turn (rad), seed]; the arch:
// centre x, z, radius, band, depth, turn. Placed for the hero shot (camera
// at 0, 7, 155 looking at the slab): pillars on the far dunes either side of
// it, the slabs off the trail in the middle distance, the arch to the right
// of the slab, clear of the swirl round the mark and of every camera path.
const PILLARS = [
  [-156, -138, 8, 40, 7, 0.55, 401],
  [-141, -126, 5.5, 26, 5, 0.2, 409],
  [-135, -347, 5.5, 26, 5, 0.4, 419],
  [118, -252, 6.5, 31, 6, 0.6, 431],
  [282, -335, 7.5, 38, 6.5, 0.35, 443],
];
const SLABS = [
  [-78, 34, 10, 8, 1.6, 0.95, 0.35, 457],
  [92, -58, 8, 6.5, 1.4, 0.75, -0.5, 461],
  [-104, -44, 6.5, 4.5, 1.2, 0.7, 1.1, 467],
  [42, 82, 5, 3.2, 1.0, 0.85, -0.8, 479],
];
const ARCH = { x: 66, z: -4, R: 11, band: 2.4, depth: 2.8, turn: -0.62 };

// the lowest ground under a footprint (so nothing stands on a hollow)
function groundUnder(terrain, x, z, r) {
  let min = Infinity;
  for (let a = 0; a < 8; a++) min = Math.min(min, terrain.height(x + Math.cos(a * 0.785) * r, z + Math.sin(a * 0.785) * r));
  return Math.min(min, terrain.height(x, z));
}

function finish(g, matrix, glow) {
  g.applyMatrix4(matrix);
  if (g.attributes.uv) g.deleteAttribute("uv");
  const n = g.attributes.position.count;
  if (!g.attributes.aGlow) g.setAttribute("aGlow", new THREE.Float32BufferAttribute(new Float32Array(n).fill(glow), 1));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  return g;
}

// The merged geometry of the pillars and slabs, the arch's apart (it casts
// no shadow: in the low sun its shadow ran right across the foreground),
// and the soft contact shadows they leave on the sand (x, z, radius,
// strength: for the sand material's uContact).
export function buildRuins(terrain) {
  const parts = [];
  const contacts = [];
  let arch = null;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);

  for (const [x, z, w, h, d, glow, seed] of PILLARS) {
    const y = groundUnder(terrain, x, z, w * 0.6) - 3;
    q.setFromEuler(e.set(0, (seed % 7) * 0.4, 0));
    m.compose(new THREE.Vector3(x, y, z), q, one);
    parts.push(finish(blockGeometry(seed, w, h + 3, d), m, glow));
    contacts.push([x, z, w * 1.3, 0.55]);
  }
  for (const [x, z, w, h, d, lean, turn, seed] of SLABS) {
    // leaning over, its foot buried
    const y = groundUnder(terrain, x, z, w * 0.5) - h * 0.28;
    q.setFromEuler(e.set(lean, turn, (seed % 5) * 0.08, "YXZ"));
    m.compose(new THREE.Vector3(x, y, z), q, one);
    parts.push(finish(blockGeometry(seed, w, h, d, { taper: 0.05, erode: 0.12, broken: 0.18 }), m, 0.15));
    contacts.push([x, z, Math.max(w, h) * 0.6, 0.45]);
  }
  {
    const { x, z, R, band, depth, turn } = ARCH;
    // sunk to about a third of its height
    const y = groundUnder(terrain, x, z, R) + R * 0.3;
    q.setFromEuler(e.set(0, turn, 0.05));
    m.compose(new THREE.Vector3(x, y, z), q, one);
    arch = finish(ringGeometry(487, R, band, depth), m, 0);
    arch.computeBoundingSphere();
    // (its two feet)
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const foot = Math.sqrt(Math.max(R * R - (R * 0.3) ** 2, 0));
    contacts.push([x + c * foot, z - s * foot, band * 2.2, 0.5], [x - c * foot, z + s * foot, band * 2.2, 0.5]);
  }
  const geometry = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  geometry.computeBoundingSphere();
  return { geometry, arch, contacts };
}

// Foreground outcrops of broken sandstone (scene/hero/Ruins.jsx):
// [x, z, size, squash, turn, shape]. Low and spread, in small groups.
// (kept inside the hero's frame: ±30° either side of the view)
export const OUTCROPS = [
  [19, 107, 3.2, 0.5, 0.4, 0],
  [25, 103, 1.8, 0.62, 1.9, 1],
  [14, 112, 1.2, 0.7, 2.8, 2],
  [46, 68, 3.8, 0.42, 1.2, 0],
  [51, 64, 1.6, 0.6, 0.2, 2],
  [-27, 108, 2.6, 0.48, 2.2, 1],
  [-22, 112, 1.4, 0.66, 0.9, 0],
];
