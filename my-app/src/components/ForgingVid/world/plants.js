import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createNoise3D } from "simplex-noise";
import { mulberry32 } from "./layout";

// Geometry and textures for the oasis's plants, all built here (no files
// but the tree's leaf atlas): date palms, broadleaf trees and bushes (cards
// of the atlas's leaf clusters), grass and reed tufts, and rocks.
// Every plant is one or two instanced meshes; per-instance colour tints
// them. Heights are metres, at instance scale 1.

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Growth (scene/oasis/Vegetation.jsx GROW): every vertex says when, over its
// plant's own growing (0 → 1), it comes out, and from where — aGrow (from,
// to, span: how long the whole plant takes on the reveal's clock, turn: how
// long it may wait for its turn) and aAnchor (the point it grows out of: a
// blade's root, a limb's base, a leaf clump's middle). So a plant isn't
// scaled up: its blades lengthen one by one, its trunk rises, its limbs
// reach out of it, and its leaves unfold from their clumps, bottom to top.
// ---------------------------------------------------------------------------
function setGrow(g, at) {
  const P = g.attributes.position;
  const grow = new Float32Array(P.count * 4);
  const anchor = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const [a, b, ax, ay, az] = at(i, P.getX(i), P.getY(i), P.getZ(i));
    grow.set([a, Math.max(b, a + 0.001), 0, 0], i * 4);
    anchor.set([ax, ay, az], i * 3);
  }
  g.setAttribute("aGrow", new THREE.BufferAttribute(grow, 4));
  g.setAttribute("aAnchor", new THREE.BufferAttribute(anchor, 3));
  return g;
}
// (moving a part moves the points it grows from with it)
function shift(g, x, y, z) {
  g.translate(x, y, z);
  const A = g.attributes.aAnchor;
  if (A) {
    for (let i = 0; i < A.count; i++) A.setXYZ(i, A.getX(i) + x, A.getY(i) + y, A.getZ(i) + z);
    A.needsUpdate = true;
  }
  return g;
}
// the whole plant's pace: span (clock units it takes), turn (how long it may wait)
export function setGrowPace(g, span, turn) {
  const G = g.attributes.aGrow;
  for (let i = 0; i < G.count; i++) {
    G.setZ(i, span);
    G.setW(i, turn);
  }
  G.needsUpdate = true;
  return g;
}

// ---------------------------------------------------------------------------
// A tube along a curve with a radius that changes along it, uv in metres
// (u round, v along), for trunks, limbs and roots.
// ---------------------------------------------------------------------------
export function taperTube(curve, radiusAt, { segments = 24, radial = 8, texel = 4, wobble = 0, seed = 1, grow = null } = {}) {
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
  // growing: out of its base, ring by ring (each ring out by the time the
  // growth reaches its share of the way)
  if (grow) {
    const base = curve.getPointAt(0);
    setGrow(g, (i) => {
      const t = Math.floor(i / (radial + 1)) / segments;
      return [grow[0], grow[0] + (grow[1] - grow[0]) * Math.max(t, 0.04), base.x, base.y, base.z];
    });
  }
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
export function clumpGeometry({ cards = 20, radius = 1.4, height = 1.2, size = 1.4, lift = 0.5, seed = 3, flat = 0.75, grow = [0, 1] }) {
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
    // growing: the clump's cards unfold out of its middle one by one, the
    // lower ones first
    const hf = Math.min(Math.max((p.y - center.y) / Math.max(height, 0.01) + 0.5, 0), 1);
    const from = grow[0] + (grow[1] - grow[0]) * (0.5 * hf + 0.25 * rng());
    const to = from + (grow[1] - grow[0]) * 0.3;
    setGrow(g, () => [from, to, center.x, center.y, center.z]);
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
  limbs.push(taperTube(trunkCurve, (t) => 0.38 * (1 - t * 0.5), { segments: 10, radial: 6, texel: 1.5, wobble: 0.6, seed, grow: [0, 0.4] }));
  const m = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 + rng() * 0.5;
    const r = 2.6 + rng() * 1.6;
    const tip = v3(Math.cos(a) * r, h + 1.6 + rng() * 1.4, Math.sin(a) * r);
    const c = new THREE.CatmullRomCurve3([v3(0, h * 0.8, 0), v3(tip.x * 0.5, h + 0.6, tip.z * 0.5), tip]);
    limbs.push(taperTube(c, (t) => 0.2 * (1 - t * 0.7), { segments: 6, radial: 5, texel: 1.5, grow: [0.3 + 0.04 * i, 0.62 + 0.04 * i] }));
    const cl = clumpGeometry({ cards: 20, radius: 2.1 + rng() * 0.6, height: 1.8, size: 1.7, lift: 0, seed: seed * 7 + i, grow: [0.5 + 0.04 * i, 0.95] });
    shift(cl, tip.x, tip.y - 0.8, tip.z);
    crowns.push(cl);
  }
  const top = clumpGeometry({ cards: 24, radius: 2.6, height: 2.0, size: 1.8, lift: 0, seed: seed * 13, grow: [0.6, 1] });
  shift(top, 0, h + 1.8, 0);
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
  limbs.push(taperTube(trunkCurve, (t) => 0.55 * (1 - t * 0.45) * (1 + 0.4 * Math.exp(-t * 12)), { segments: 10, radial: 7, texel: 1.5, wobble: 0.8, seed, grow: [0, 0.38] }));
  const m = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 + rng() * 0.6;
    const tip = v3(Math.cos(a) * (1.6 + rng()), h + 2.2 + rng() * 1.5, Math.sin(a) * (1.6 + rng()));
    const c = new THREE.CatmullRomCurve3([v3(0, h * 0.85, 0), v3(tip.x * 0.4, h + 1, tip.z * 0.4), tip]);
    limbs.push(taperTube(c, (t) => 0.3 * (1 - t * 0.7), { segments: 6, radial: 5, texel: 1.5, grow: [0.28 + 0.04 * i, 0.6 + 0.04 * i] }));
  }
  // the dome: clumps over a squashed sphere, denser at its skin
  const R = 3.6 + rng() * 1.2;
  const cy = h + 3.6;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const th = rng() * Math.PI * 2;
    const ph = Math.acos(1 - rng() * 1.5);
    const p = v3(Math.sin(ph) * Math.cos(th) * R * 0.75, Math.cos(ph) * R * 0.5, Math.sin(ph) * Math.sin(th) * R * 0.75);
    // (the dome's clumps unfold from its lower ones up)
    const hf = (p.y / (R * 0.5) + 1) / 2;
    const cl = clumpGeometry({ cards: 18, radius: 1.8 + rng() * 0.5, height: 1.6, size: 1.7, lift: 0, seed: seed * 11 + i, grow: [0.48 + 0.22 * hf, 0.82 + 0.18 * hf] });
    shift(cl, p.x, cy + p.y - 0.8, p.z);
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
  const blade = [];
  for (let b = 0; b < blades; b++) {
    const a = rng() * Math.PI * 2;
    const h = height * (0.6 + rng() * 0.5);
    const bend = 0.2 + rng() * 0.5;
    const w = 0.035 + rng() * 0.03;
    const ox = Math.cos(a) * rng() * spread * 0.4;
    const oz = Math.sin(a) * rng() * spread * 0.4;
    blade.push({ x: ox, z: oz, from: (b / blades) * 0.25 + rng() * 0.15 });
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
  // growing: the tuft's blades come up one by one, each lengthening out of
  // its root (its tip last)
  const per = (seg + 1) * 2;
  setGrow(g, (i) => {
    const b = Math.floor(i / per);
    const t = Math.floor((i % per) / 2) / seg;
    const from = blade[b].from;
    return [from, from + 0.3 + 0.35 * t, blade[b].x, 0, blade[b].z];
  });
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

// ---------------------------------------------------------------------------
// Boulders and pebbles, after the reference (hyperiux-concepts v6): rounded,
// water-worn stones cut into many small flat facets (flat shaded, so each
// facet catches the light on its own), a few broad chipped planes, and a
// flatter underside where they sit. detail 2 for boulders, 1 for pebbles;
// lumpy is how far the outline wanders, flat how squashed it is (y).
// ---------------------------------------------------------------------------
export function boulderGeometry(seed, { detail = 2, lumpy = 0.22, flat = 0.62, chips = 4 } = {}) {
  const rng = mulberry32(seed);
  const n3 = createNoise3D(rng);
  const ico = new THREE.IcosahedronGeometry(1, detail);
  // (displaced welded, so neighbouring facets still meet; split apart after)
  ico.deleteAttribute("normal");
  ico.deleteAttribute("uv");
  const g = mergeVertices(ico);
  ico.dispose();
  const P = g.attributes.position;
  const v = new THREE.Vector3();
  const stretch = 0.85 + rng() * 0.4;
  // the chipped planes: mostly round its sides and top
  const planes = Array.from({ length: chips }, () => {
    const a = rng() * Math.PI * 2;
    const up = 0.15 + rng() * 0.75;
    const n = new THREE.Vector3(Math.cos(a) * (1 - up), up, Math.sin(a) * (1 - up)).normalize();
    return { n, d: 0.72 + rng() * 0.18 };
  });
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const k = 1 + n3(v.x * 0.9, v.y * 0.9, v.z * 0.9) * lumpy + n3(v.x * 2.6 + 5, v.y * 2.6, v.z * 2.6) * lumpy * 0.25;
    v.multiplyScalar(k);
    for (const pl of planes) {
      const over = v.dot(pl.n) - pl.d;
      if (over > 0) v.addScaledVector(pl.n, -over * 0.85);
    }
    // (its underside carries on well down into the ground: sunk into the
    // sand, its sides go into it at a steep angle — no sliver of lit sand
    // showing under its edge where the ground dips)
    const y = v.y * flat;
    P.setXYZ(i, v.x * stretch, y < 0 ? y * 1.5 : y, v.z);
  }
  const faceted = g.toNonIndexed();
  g.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

// ---------------------------------------------------------------------------
// Flowers (scene/oasis/Vegetation.jsx flowerMaterial: their petals open and
// close in the vertex shader — the cursor makes them bloom). Every vertex
// carries its flower's head (aHead: the centre the petals open round, and
// aAxis: the way it faces) and aPetal (u: metres out along its petal, v:
// metres across it, a: its bearing round the head, kind: 0 stem/leaf,
// 1 petal, 2 the head's heart). Positions are the half-open pose.
// ---------------------------------------------------------------------------
const FLOWER_PITCH_REST = 0.5; // (the position attribute's pose: radians up from flat)
function headFrame(axis) {
  const ref = Math.abs(axis.y) < 0.95 ? v3(0, 1, 0) : v3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(axis, ref).normalize();
  const t2 = new THREE.Vector3().crossVectors(axis, t1).normalize();
  return [t1, t2];
}
class FlowerBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.head = [];
    this.axis = [];
    this.petal = [];
    this.grow = [];
    this.anchor = [];
    this.index = [];
  }
  vert(p, n, c, head, axis, petal, grow, anchor) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.col.push(c[0], c[1], c[2]);
    this.head.push(head.x, head.y, head.z);
    this.axis.push(axis.x, axis.y, axis.z);
    this.petal.push(petal[0], petal[1], petal[2], petal[3]);
    this.grow.push(grow[0], Math.max(grow[1], grow[0] + 0.001), 0, 0);
    this.anchor.push(anchor.x, anchor.y, anchor.z);
    return this.pos.length / 3 - 1;
  }
  // a head of petals (and its heart) round `head`, facing `axis`
  flowerHead(head, axis, { petals = 6, len = 0.11, width = 0.06, grow = [0.4, 1], anchor = head, tint = 1, rng }) {
    const [t1, t2] = headFrame(axis);
    const a0 = rng() * Math.PI * 2;
    const g0 = grow[0];
    const gs = grow[1] - grow[0];
    for (let k = 0; k < petals; k++) {
      const a = a0 + (k / petals) * Math.PI * 2 + (rng() - 0.5) * 0.3;
      const L = len * (0.85 + rng() * 0.3);
      const W = width * (0.85 + rng() * 0.3);
      const dir = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
      const side = new THREE.Vector3().crossVectors(axis, dir);
      const pd = dir.clone().multiplyScalar(Math.cos(FLOWER_PITCH_REST)).addScaledVector(axis, Math.sin(FLOWER_PITCH_REST));
      const from = g0 + gs * (0.1 + 0.4 * (k / petals));
      const gr = [from, from + gs * 0.5];
      const at = (u, v) => head.clone().addScaledVector(pd, u).addScaledVector(side, v);
      const shade = (u) => {
        const s = (0.62 + 0.38 * (u / L)) * tint;
        return [s, s, s];
      };
      const i0 = this.vert(at(0, 0), axis, shade(0), head, axis, [0, 0, a, 1], gr, anchor);
      const i1 = this.vert(at(L * 0.45, W * 0.5), axis, shade(L * 0.45), head, axis, [L * 0.45, W * 0.5, a, 1], gr, anchor);
      const i2 = this.vert(at(L * 0.45, -W * 0.5), axis, shade(L * 0.45), head, axis, [L * 0.45, -W * 0.5, a, 1], gr, anchor);
      const i3 = this.vert(at(L, 0), axis, shade(L), head, axis, [L, 0, a, 1], gr, anchor);
      this.index.push(i0, i1, i3, i0, i3, i2);
    }
    // the heart: a little cone of pollen
    const r = len * 0.22;
    const apex = this.vert(head.clone().addScaledVector(axis, r * 0.9), axis, [0.95, 0.62, 0.12], head, axis, [0, 0, 0, 2], [g0 + gs * 0.3, g0 + gs * 0.7], anchor);
    const ring = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const d = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
      ring.push(this.vert(head.clone().addScaledVector(d, r), d.clone().lerp(axis, 0.5).normalize(), [0.7, 0.42, 0.08], head, axis, [0, 0, 0, 2], [g0 + gs * 0.3, g0 + gs * 0.7], anchor));
    }
    for (let k = 0; k < 4; k++) this.index.push(ring[k], ring[(k + 1) % 4], apex);
  }
  // a thin crossed-ribbon stem from `base` to `top`
  stem(base, top, width, grow, axis) {
    const up = top.clone().sub(base);
    const n0 = v3(1, 0, 0);
    for (const s of [v3(1, 0, 0), v3(0, 0, 1)]) {
      const w = s.clone().multiplyScalar(width * 0.5);
      const c0 = [0.1, 0.2, 0.06];
      const c1 = [0.22, 0.38, 0.12];
      const mk = (p, c, t) => this.vert(p, n0.clone().crossVectors(s, up).normalize().lerp(v3(0, 1, 0), 0.5).normalize(), c, top, axis, [0, 0, 0, 0], [grow[0], grow[0] + (grow[1] - grow[0]) * Math.max(t, 0.1)], base);
      const a = mk(base.clone().sub(w), c0, 0);
      const b = mk(base.clone().add(w), c0, 0);
      const c = mk(top.clone().sub(w.clone().multiplyScalar(0.6)), c1, 1);
      const d = mk(top.clone().add(w.clone().multiplyScalar(0.6)), c1, 1);
      this.index.push(a, b, c, b, d, c);
    }
  }
  // a leaf blade at the foot
  leaf(base, a, h, rng) {
    const out = v3(Math.cos(a), 0, Math.sin(a));
    const side = v3(-Math.sin(a), 0, Math.cos(a));
    const w = 0.035 + rng() * 0.02;
    const pts = [
      [base.clone().addScaledVector(side, -w), 0],
      [base.clone().addScaledVector(side, w), 0],
      [base.clone().addScaledVector(out, h * 0.35).add(v3(0, h * 0.75, 0)), 1],
    ];
    const ids = pts.map(([p, t]) => this.vert(p, v3(0, 1, 0).addScaledVector(out, 0.4).normalize(), t ? [0.24, 0.42, 0.13] : [0.1, 0.2, 0.06], p, v3(0, 1, 0), [0, 0, 0, 0], [0, 0.35 + 0.2 * t], base));
    this.index.push(ids[0], ids[1], ids[2]);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("aHead", new THREE.Float32BufferAttribute(this.head, 3));
    g.setAttribute("aAxis", new THREE.Float32BufferAttribute(this.axis, 3));
    g.setAttribute("aPetal", new THREE.Float32BufferAttribute(this.petal, 4));
    g.setAttribute("aGrow", new THREE.Float32BufferAttribute(this.grow, 4));
    g.setAttribute("aAnchor", new THREE.Float32BufferAttribute(this.anchor, 3));
    g.setIndex(this.index);
    return g;
  }
}

// A clump of wild flowers: a few stems of different heights, each with a
// head of petals, and a couple of leaves at the foot. ~0.3–0.6 m tall.
export function flowerClumpGeometry({ flowers = 4, height = 0.45, spread = 0.28, petals = 6, len = 0.1, width = 0.06, seed = 5 } = {}) {
  const rng = mulberry32(seed);
  const b = new FlowerBuilder();
  for (let f = 0; f < flowers; f++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * spread;
    const base = v3(Math.cos(a) * r, -0.02, Math.sin(a) * r);
    const h = height * (0.6 + rng() * 0.6);
    const lean = 0.08 + rng() * 0.22;
    const la = rng() * Math.PI * 2;
    const top = base.clone().add(v3(Math.cos(la) * lean * h, h, Math.sin(la) * lean * h));
    const axis = v3(Math.cos(la) * lean * 1.6, 1, Math.sin(la) * lean * 1.6).normalize();
    const g0 = (f / flowers) * 0.15 + rng() * 0.1;
    b.stem(base, top, 0.016, [g0, g0 + 0.45], axis);
    b.flowerHead(top, axis, { petals, len: len * (0.85 + rng() * 0.35), width, grow: [g0 + 0.35, 1], rng, tint: 0.85 + rng() * 0.15 });
    b.leaf(base, a + 0.6, h * 0.45, rng);
  }
  return b.build();
}

// Blossoms over a clump-built crown (a bush's or a tree's, as returned by
// clumpGeometry / buildBroadleaf / buildRoundTree): flower heads on the
// outer cards, facing out of the crown, unfolding as their cards do.
// share: of the outer cards that carry one.
export function blossomGeometry(crown, { share = 0.3, len = 0.22, width = 0.13, petals = 5, seed = 7 } = {}) {
  const rng = mulberry32(seed);
  const b = new FlowerBuilder();
  const P = crown.attributes.position;
  const N = crown.attributes.normal;
  const C = crown.attributes.color;
  const G = crown.attributes.aGrow;
  const A = crown.attributes.aAnchor;
  const cards = Math.floor(P.count / 4);
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let k = 0; k < cards; k++) {
    const i = k * 4;
    // (only the crown's skin: its outer cards are the light ones)
    if ((C ? C.getX(i) : 1) < 0.8 || rng() > share) continue;
    c.set(0, 0, 0);
    n.set(0, 0, 0);
    for (let j = 0; j < 4; j++) {
      c.x += P.getX(i + j) / 4;
      c.y += P.getY(i + j) / 4;
      c.z += P.getZ(i + j) / 4;
      n.x += N.getX(i + j);
      n.y += N.getY(i + j);
      n.z += N.getZ(i + j);
    }
    n.normalize();
    if (n.y < -0.35) continue;
    const axis = n.clone().lerp(v3(0, 1, 0), 0.3).normalize();
    const head = c.clone().addScaledVector(n, 0.12);
    const to = G ? G.getY(i) : 1;
    const anchor = A ? v3(A.getX(i), A.getY(i), A.getZ(i)) : head;
    b.flowerHead(head, axis, { petals, len, width, grow: [Math.min(to, 0.9), Math.min(to + 0.25, 1)], anchor, rng, tint: 0.8 + rng() * 0.2 });
  }
  return b.build();
}
