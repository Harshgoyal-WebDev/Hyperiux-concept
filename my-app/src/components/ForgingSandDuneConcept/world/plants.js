import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "./layout";

// Geometry and textures for the oasis's plants, all built here (no files
// but the tree's leaf atlas): date palms, broadleaf trees and bushes (cards
// of the atlas's leaf clusters), grass and reed tufts, and rocks.
// Every plant is one or two instanced meshes; per-instance colour tints
// them. Heights are metres, at instance scale 1.

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// A tube along a curve with a radius that changes along it, uv in metres
// (u round, v along), for trunks, limbs and roots.
// ---------------------------------------------------------------------------
export function taperTube(curve, radiusAt, { segments = 24, radial = 8, texel = 4, wobble = 0, seed = 1 } = {}) {
  const frames = curve.computeFrenetFrames(segments, false);
  const pos = [];
  const nor = [];
  const uv = [];
  const index = [];
  const length = curve.getLength();
  const rng = mulberry32(seed);
  const bumps = Array.from({ length: 5 }, () => [rng() * 6.28, 1 + Math.floor(rng() * 3), rng() * 6.28]);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radiusAt(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      let k = 1;
      // buttresses and folds: the section isn't round
      if (wobble > 0) for (const [ph, f, ph2] of bumps) k += wobble * 0.18 * Math.sin(a * f + ph + t * 3 + ph2);
      n.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize();
      pos.push(p.x + n.x * r * k, p.y + n.y * r * k, p.z + n.z * r * k);
      nor.push(n.x, n.y, n.z);
      uv.push(((j / radial) * Math.max(Math.round((Math.PI * 2 * r) / texel), 1)), (t * length) / texel);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

// ---------------------------------------------------------------------------
// Date palm
// ---------------------------------------------------------------------------
// A frond's texture: a midrib and its leaflets, pale to dark green.
export function frondTexture() {
  const W = 512;
  const H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const rng = mulberry32(17);
  g.clearRect(0, 0, W, H);
  g.lineCap = "round";
  // leaflets: angled forward along the rib, longest mid-frond
  for (let i = 0; i < 70; i++) {
    const x = 18 + (i / 70) * (W - 30);
    const t = x / W;
    const len = (H * 0.5 - 4) * Math.sin(Math.min(t * 1.25, 1) * Math.PI * 0.92) * (0.85 + rng() * 0.2);
    for (const side of [-1, 1]) {
      const shade = 0.75 + rng() * 0.35;
      g.strokeStyle = `rgb(${Math.round(60 * shade)},${Math.round(98 * shade)},${Math.round(34 * shade)})`;
      g.lineWidth = 3 + rng() * 2;
      g.beginPath();
      g.moveTo(x, H / 2);
      g.quadraticCurveTo(x + len * 0.25, H / 2 + side * len * 0.55, x + len * 0.55, H / 2 + side * len);
      g.stroke();
    }
  }
  g.strokeStyle = "rgb(118,112,62)";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, H / 2);
  g.lineTo(W, H / 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// one frond: a strip arching out from the crown and drooping, a little twisted
function frondGeometry(length, width, droop, rng) {
  const seg = 10;
  const pos = [];
  const uv = [];
  const nor = [];
  const index = [];
  const twist = (rng() - 0.5) * 0.6;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const x = t * length;
    const y = Math.sin(t * Math.PI * 0.5) * length * 0.32 - droop * t * t * length;
    const w = width * (0.25 + 0.75 * Math.sin(Math.min(t * 1.2, 1) * Math.PI * 0.95));
    const tw = twist * t;
    for (const s of [-1, 1]) {
      pos.push(x, y + Math.sin(tw) * s * w * 0.5, Math.cos(tw) * s * w * 0.5);
      uv.push(t, s < 0 ? 0 : 1);
      nor.push(0, 1, 0);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(index);
  return g;
}

// A palm variant: { trunk, crown } geometries (crown in place at the top),
// height ~11–15 m at scale 1.
export function buildPalm(seed) {
  const rng = mulberry32(seed);
  const h = 11 + rng() * 4;
  const lean = 0.8 + rng() * 2.2;
  const dir = rng() * Math.PI * 2;
  const top = v3(Math.cos(dir) * lean, h, Math.sin(dir) * lean);
  const curve = new THREE.CatmullRomCurve3([v3(0, -0.4, 0), v3(top.x * 0.2, h * 0.35, top.z * 0.2), v3(top.x * 0.6, h * 0.72, top.z * 0.6), top]);
  const trunk = taperTube(curve, (t) => 0.42 * (1 - t * 0.38) * (1 + 0.5 * Math.exp(-t * 18)), { segments: 22, radial: 7, texel: 1.2 });
  // the trunk's ring scars, in the vertex colour
  const col = [];
  const P = trunk.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i);
    const ring = 0.75 + 0.25 * Math.pow(Math.abs(Math.sin(y * 3.4)), 3);
    col.push(0.9 * ring, 0.82 * ring, 0.7 * ring);
  }
  trunk.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const fronds = [];
  const n = 15 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    const len = 4.2 + rng() * 1.8;
    const g = frondGeometry(len, 1.5 + rng() * 0.4, 0.25 + rng() * 0.5 + (i % 3 === 0 ? 0.35 : 0), rng);
    const pitch = -0.15 + rng() * 0.75 - (i % 4 === 0 ? 0.35 : 0);
    g.rotateZ(pitch);
    g.rotateY((i / n) * Math.PI * 2 + rng() * 0.3);
    g.translate(top.x, top.y - 0.2, top.z);
    fronds.push(g);
  }
  const crown = mergeGeometries(fronds);
  fronds.forEach((g) => g.dispose());
  return { trunk, crown, height: h };
}

// ---------------------------------------------------------------------------
// Leaf clumps: cards of the atlas's four leaf clusters (bushes, the
// broadleaf trees' crowns, the Yggdrasil's crown). Each card carries its
// atlas cell in its uv, and a normal pointing out of the clump (soft, round
// shading, as a whole bush is lit rather than each card).
// ---------------------------------------------------------------------------
export function clumpGeometry({ cards = 20, radius = 1.4, height = 1.2, size = 1.4, lift = 0.5, seed = 3, flat = 0.75 }) {
  const rng = mulberry32(seed);
  const parts = [];
  const center = v3(0, lift + height * 0.5, 0);
  for (let i = 0; i < cards; i++) {
    const s = size * (0.75 + rng() * 0.5);
    const g = new THREE.PlaneGeometry(s, s);
    // atlas cell
    const cell = Math.floor(rng() * 4);
    const ox = (cell % 2) * 0.5;
    const oy = Math.floor(cell / 2) * 0.5;
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, ox + uv.getX(k) * 0.5, oy + uv.getY(k) * 0.5);
    // a point in the clump (more towards its skin), the card facing out of it
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(1 - rng() * 1.6);
    const rr = Math.pow(rng(), 0.4);
    const p = v3(Math.sin(ph) * Math.cos(th) * radius * rr, Math.cos(ph) * height * 0.5 * rr, Math.sin(ph) * Math.sin(th) * radius * rr).add(center);
    const out = p.clone().sub(center).normalize();
    g.lookAt(out.clone().multiplyScalar(-1).lerp(v3(0, -1, 0), 0.2 * flat));
    g.rotateY(0);
    const q = new THREE.Quaternion().setFromAxisAngle(out, rng() * Math.PI * 2);
    g.applyQuaternion(q);
    g.translate(p.x, p.y, p.z);
    // soft normals out of the clump (a touch upwards)
    const nrm = [];
    const shade = [];
    const P = g.attributes.position;
    for (let k = 0; k < P.count; k++) {
      const d = v3(P.getX(k), P.getY(k), P.getZ(k)).sub(center);
      const nn = d.clone().normalize().lerp(v3(0, 1, 0), 0.25).normalize();
      nrm.push(nn.x, nn.y, nn.z);
      // inner cards darker (self-shadowing)
      const depth = Math.min(d.length() / Math.max(radius, height * 0.5), 1);
      shade.push(0.45 + 0.55 * depth, 0.45 + 0.55 * depth, 0.45 + 0.55 * depth);
    }
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(shade, 3));
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

// A broadleaf tree (the oasis's acacia-like greens): a short trunk and
// limbs, and a wide crown of clumps. { trunk, crown }, ~7–9 m tall.
export function buildBroadleaf(seed) {
  const rng = mulberry32(seed);
  const h = 5 + rng() * 1.5;
  const limbs = [];
  const crowns = [];
  const trunkCurve = new THREE.CatmullRomCurve3([v3(0, -0.3, 0), v3(0.2, h * 0.5, 0.1), v3(-0.1, h, 0)]);
  limbs.push(taperTube(trunkCurve, (t) => 0.38 * (1 - t * 0.5), { segments: 10, radial: 6, texel: 1.5, wobble: 0.6, seed }));
  const m = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 + rng() * 0.5;
    const r = 2.6 + rng() * 1.6;
    const tip = v3(Math.cos(a) * r, h + 1.6 + rng() * 1.4, Math.sin(a) * r);
    const c = new THREE.CatmullRomCurve3([v3(0, h * 0.8, 0), v3(tip.x * 0.5, h + 0.6, tip.z * 0.5), tip]);
    limbs.push(taperTube(c, (t) => 0.2 * (1 - t * 0.7), { segments: 6, radial: 5, texel: 1.5 }));
    const cl = clumpGeometry({ cards: 20, radius: 2.1 + rng() * 0.6, height: 1.8, size: 1.7, lift: 0, seed: seed * 7 + i });
    cl.translate(tip.x, tip.y - 0.8, tip.z);
    crowns.push(cl);
  }
  const top = clumpGeometry({ cards: 24, radius: 2.6, height: 2.0, size: 1.8, lift: 0, seed: seed * 13 });
  top.translate(0, h + 1.8, 0);
  crowns.push(top);
  const trunk = mergeGeometries(limbs);
  const crown = mergeGeometries(crowns);
  [...limbs, ...crowns].forEach((g) => g.dispose());
  return { trunk, crown };
}

// A rounded shade tree (a fig or a tamarind by the water): a stout trunk
// forking low into a few limbs under one full, domed crown of clumps,
// ~8–11 m tall. { trunk, crown }
export function buildRoundTree(seed) {
  const rng = mulberry32(seed);
  const h = 3.2 + rng() * 1.2;
  const limbs = [];
  const crowns = [];
  const trunkCurve = new THREE.CatmullRomCurve3([v3(0, -0.3, 0), v3(0.15, h * 0.5, -0.1), v3(0, h, 0.1)]);
  limbs.push(taperTube(trunkCurve, (t) => 0.55 * (1 - t * 0.45) * (1 + 0.4 * Math.exp(-t * 12)), { segments: 10, radial: 7, texel: 1.5, wobble: 0.8, seed }));
  const m = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 + rng() * 0.6;
    const tip = v3(Math.cos(a) * (1.6 + rng()), h + 2.2 + rng() * 1.5, Math.sin(a) * (1.6 + rng()));
    const c = new THREE.CatmullRomCurve3([v3(0, h * 0.85, 0), v3(tip.x * 0.4, h + 1, tip.z * 0.4), tip]);
    limbs.push(taperTube(c, (t) => 0.3 * (1 - t * 0.7), { segments: 6, radial: 5, texel: 1.5 }));
  }
  // the dome: clumps over a squashed sphere, denser at its skin
  const R = 3.6 + rng() * 1.2;
  const cy = h + 3.6;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(1 - rng() * 1.5);
    const p = v3(Math.sin(ph) * Math.cos(th) * R * 0.75, Math.cos(ph) * R * 0.5, Math.sin(ph) * Math.sin(th) * R * 0.75);
    const cl = clumpGeometry({ cards: 18, radius: 1.8 + rng() * 0.5, height: 1.6, size: 1.7, lift: 0, seed: seed * 11 + i });
    cl.translate(p.x, cy + p.y - 0.8, p.z);
    crowns.push(cl);
  }
  const trunk = mergeGeometries(limbs);
  const crown = mergeGeometries(crowns);
  [...limbs, ...crowns].forEach((g) => g.dispose());
  return { trunk, crown };
}

// ---------------------------------------------------------------------------
// Grass: a tuft of tapering, arching blades (vertex colour dark at the root,
// sunlit straw-green at the tip). Reeds are the same, scaled tall.
// ---------------------------------------------------------------------------
export function tuftGeometry({ blades = 7, height = 0.9, spread = 0.35, seed = 9 } = {}) {
  const rng = mulberry32(seed);
  const pos = [];
  const col = [];
  const nor = [];
  const index = [];
  const seg = 2;
  for (let b = 0; b < blades; b++) {
    const a = rng() * Math.PI * 2;
    const h = height * (0.6 + rng() * 0.5);
    const bend = 0.2 + rng() * 0.5;
    const w = 0.035 + rng() * 0.03;
    const ox = Math.cos(a) * rng() * spread * 0.4;
    const oz = Math.sin(a) * rng() * spread * 0.4;
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const out = bend * t * t * h;
      const x = ox + Math.cos(a) * out;
      const z = oz + Math.sin(a) * out;
      const y = t * h * (1 - 0.25 * bend * t);
      const ww = w * (1 - t * 0.92);
      const px = -Math.sin(a) * ww;
      const pz = Math.cos(a) * ww;
      pos.push(x - px, y, z - pz, x + px, y, z + pz);
      const k = 0.35 + 0.65 * t;
      col.push(0.32 * k, 0.5 * k, 0.16 * k, 0.32 * k, 0.5 * k, 0.16 * k);
      nor.push(Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3, Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3);
    }
    for (let i = 0; i < seg; i++) {
      const k = base + i * 2;
      index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// Rocks: rounded, weathered sandstone boulders.
// ---------------------------------------------------------------------------
export function rockGeometry(seed) {
  const rng = mulberry32(seed);
  const g = new THREE.IcosahedronGeometry(1, 2);
  const P = g.attributes.position;
  const ph = [rng() * 6, rng() * 6, rng() * 6];
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i);
    const y = P.getY(i);
    const z = P.getZ(i);
    const k = 1 + 0.18 * Math.sin(x * 2.1 + ph[0]) * Math.sin(y * 1.7 + ph[1]) + 0.12 * Math.sin(z * 2.9 + ph[2]);
    P.setXYZ(i, x * k * 1.2, Math.max(y * k * 0.7, -0.3), z * k);
  }
  g.computeVertexNormals();
  return g;
}
