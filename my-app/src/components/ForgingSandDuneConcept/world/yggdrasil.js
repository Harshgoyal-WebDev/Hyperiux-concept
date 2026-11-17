import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "./layout";
import { TREE, WATER_Y } from "./oasis";
import { taperTube } from "./plants";

// The Yggdrasil's form, for the placeholder tree that stands in until
// public/models/yggdrasil.glb exists (scene/oasis/Yggdrasil.jsx swaps the
// model in): a massive trunk of seven strands twisting round each other,
// great exposed roots arching out of the island into the lake, and limbs
// spreading into a broad, layered crown of leaf clusters. World metres,
// relative to the tree's foot (TREE.x, WATER_Y, TREE.z).
//
// ROOT_TIPS and the crown's measure are shared with the streaks, which run
// along roots and wind round the crown on their way into the core.

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const H = TREE.height;
const CORE_Y = TREE.core.y - WATER_Y;

// The roots: their bearing (radians, round the tree) and reach. The first
// three face the way the camera comes in (from the north-west), so the
// streaks that come in low can follow them into the trunk.
const APPROACH = Math.atan2(-930 - TREE.z, 6 - TREE.x); // bearing of the passage's mouth, from the tree
export const ROOTS = (() => {
  const rng = mulberry32(41);
  const list = [];
  const n = 15;
  for (let i = 0; i < n; i++) {
    const a = APPROACH + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    list.push({ a, reach: 24 + rng() * 14, rise: 0.4 + rng() * 0.8, radius: 2.4 + rng() * 1.4, seed: 100 + i });
  }
  // the three nearest the approach first
  return list.sort((p, q) => Math.abs(Math.sin((p.a - APPROACH) / 2)) - Math.abs(Math.sin((q.a - APPROACH) / 2)));
})();

// A point along a root (k: 0 at the trunk's foot, 1 at its end) in world
// space: out of the flared foot, hugging the island, down into the lake
// (its last third under the water), for the wood and the streak.
export function rootPoint(root, k, out = new THREE.Vector3()) {
  const r = THREE.MathUtils.lerp(6, root.reach, k);
  // (sitting on the island, not arching over the water: half its length is
  // in the lake)
  const arch = Math.sin(Math.min(k * 2.2, 1) * Math.PI) * root.rise;
  // (the whole foot sits low: the roots meet the water within a few metres
  // of the trunk and run on under it)
  const y = THREE.MathUtils.lerp(0.4, -3.6, Math.pow(k, 0.6)) + arch;
  return out.set(TREE.x + Math.cos(root.a) * r, WATER_Y + y, TREE.z + Math.sin(root.a) * r);
}

// ---------------------------------------------------------------------------
// The wood: trunk strands, limbs, branches and roots, as one geometry
// (local: the foot at the origin). Returns { wood, tips } — tips are the
// branch ends the crown's clusters gather round.
// ---------------------------------------------------------------------------
export function buildWood(detail = 1) {
  const rng = mulberry32(7);
  const parts = [];
  const tips = [];
  const seg = (n) => Math.max(Math.round(n * detail), 4);
  const STRANDS = 7;
  const forkY = 40;
  for (let k = 0; k < STRANDS; k++) {
    const a0 = (k / STRANDS) * Math.PI * 2 + rng() * 0.3;
    const twist = 1.0 + rng() * 0.25;
    const pts = [];
    const ring = [7.6, 5.6, 4.2, 3.4, 3.6, 5.2];
    const ys = [-1.5, 8, 17, 27, 35, forkY];
    for (let i = 0; i < ys.length; i++) {
      const a = a0 + twist * (ys[i] / forkY);
      pts.push(v3(Math.cos(a) * ring[i], ys[i], Math.sin(a) * ring[i]));
    }
    // the limb this strand becomes
    const aTop = a0 + twist;
    const limbA = aTop + (rng() - 0.5) * 0.4;
    const reach = 40 + rng() * 14;
    pts.push(v3(Math.cos(limbA) * 16, forkY + 9 + rng() * 4, Math.sin(limbA) * 16));
    pts.push(v3(Math.cos(limbA) * reach * 0.62, forkY + 17 + rng() * 6, Math.sin(limbA) * reach * 0.62));
    const end = v3(Math.cos(limbA + 0.15) * reach, forkY + 22 + rng() * 8, Math.sin(limbA + 0.15) * reach);
    pts.push(end);
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    parts.push(
      taperTube(curve, (t) => (t < 0.45 ? THREE.MathUtils.lerp(3.6, 2.5, t / 0.45) : THREE.MathUtils.lerp(2.5, 0.55, (t - 0.45) / 0.55)), {
        segments: seg(60),
        radial: seg(12),
        texel: 5,
        wobble: 0.9,
        seed: 10 + k,
      })
    );
    tips.push(end);
    // branches off the limb, out and up into the crown
    for (let b = 0; b < 4; b++) {
      const t0 = 0.55 + b * 0.11;
      const from = curve.getPointAt(Math.min(t0, 0.97));
      const ba = limbA + (rng() - 0.5) * 1.5;
      const br = 14 + rng() * 14;
      const mid = from.clone().add(v3(Math.cos(ba) * br * 0.5, 4 + rng() * 5, Math.sin(ba) * br * 0.5));
      const tip = from.clone().add(v3(Math.cos(ba) * br, 9 + rng() * 12, Math.sin(ba) * br));
      const c = new THREE.CatmullRomCurve3([from, mid, tip], false, "centripetal");
      parts.push(taperTube(c, (t) => THREE.MathUtils.lerp(0.95, 0.18, t), { segments: seg(14), radial: seg(6), texel: 3 }));
      tips.push(tip);
      if (rng() < 0.7) {
        const tw = tip.clone().add(v3((rng() - 0.5) * 12, 3 + rng() * 5, (rng() - 0.5) * 12));
        const c2 = new THREE.CatmullRomCurve3([mid, mid.clone().lerp(tw, 0.5).add(v3(0, 2, 0)), tw], false, "centripetal");
        parts.push(taperTube(c2, (t) => THREE.MathUtils.lerp(0.5, 0.12, t), { segments: seg(10), radial: 5, texel: 3 }));
        tips.push(tw);
      }
    }
  }
  // a central leader, up into the crown's top
  {
    const c = new THREE.CatmullRomCurve3([v3(0, forkY - 6, 0), v3(2, forkY + 14, -1), v3(-1, H - 18, 2)], false, "centripetal");
    parts.push(taperTube(c, (t) => THREE.MathUtils.lerp(3, 0.5, t), { segments: seg(20), radial: seg(10), texel: 4, wobble: 0.5, seed: 3 }));
    tips.push(v3(-1, H - 18, 2));
  }
  // the roots: arching out of the island and down into the lake, some forking
  for (const root of ROOTS) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const p = rootPoint(root, i / 6);
      pts.push(p.set(p.x - TREE.x, p.y - WATER_Y, p.z - TREE.z));
    }
    // (from inside the trunk's foot)
    pts.unshift(v3(Math.cos(root.a) * 4, 6, Math.sin(root.a) * 4));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    parts.push(
      taperTube(curve, (t) => root.radius * (1 - 0.82 * t) * (1 + 0.6 * Math.exp(-t * 10)), {
        segments: seg(26),
        radial: seg(9),
        texel: 4,
        wobble: 0.7,
        seed: root.seed,
      })
    );
    const r2 = mulberry32(root.seed);
    if (r2() < 0.55) {
      const from = curve.getPointAt(0.45);
      const side = root.a + (r2() < 0.5 ? 0.5 : -0.5);
      const to = v3(Math.cos(side) * (root.reach * 0.85), -2.4, Math.sin(side) * (root.reach * 0.85));
      const c2 = new THREE.CatmullRomCurve3([from, from.clone().lerp(to, 0.5).add(v3(0, 2, 0)), to], false, "centripetal");
      parts.push(taperTube(c2, (t) => root.radius * 0.5 * (1 - 0.7 * t), { segments: seg(14), radial: seg(7), texel: 4, seed: root.seed + 50 }));
    }
  }
  const wood = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  wood.computeBoundingSphere();
  return { wood, tips };
}

// ---------------------------------------------------------------------------
// The crown: leaf-cluster cards (the tree's leaf atlas), gathered round the
// branch tips and filling a broad, layered dome. Instanced: per card its
// matrix, atlas cell, shade (darker inside) and the normal it is lit by
// (out of the crown, so it shades as a mass, not as flat cards).
// ---------------------------------------------------------------------------
export function buildCrown(tips, count) {
  const rng = mulberry32(19);
  const centres = [];
  for (const t of tips) centres.push({ p: t, r: 9 + rng() * 6 });
  // fill: points on a lumpy dome
  const fill = Math.round(count / 40);
  for (let i = 0; i < fill; i++) {
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * TREE.canopy * 0.92;
    const dome = Math.sqrt(Math.max(1 - (rr / (TREE.canopy * 1.05)) ** 2, 0));
    const y = 54 + dome * (H - 66) + (rng() - 0.5) * 8;
    centres.push({ p: v3(Math.cos(a) * rr, y, Math.sin(a) * rr), r: 8 + rng() * 6 });
  }
  const centre = v3(0, 66, 0);
  const matrices = new Float32Array(count * 16);
  const cell = new Float32Array(count);
  const shade = new Float32Array(count);
  const normal = new Float32Array(count * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const look = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const c = centres[Math.floor(rng() * centres.length)];
    // a point in the cluster, more towards its skin
    const dir = v3(rng() * 2 - 1, rng() * 1.4 - 0.5, rng() * 2 - 1).normalize();
    p.copy(c.p).addScaledVector(dir, c.r * Math.pow(rng(), 0.5));
    // the cards face out of the crown, turned at random about that
    n.copy(p).sub(centre);
    n.y *= 1.8;
    n.normalize();
    const out = n.clone().lerp(dir, 0.5).normalize();
    look.lookAt(out, new THREE.Vector3(0, 0, 0), Math.abs(out.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
    q.setFromRotationMatrix(look);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rng() * Math.PI * 2));
    const size = 5.5 + rng() * 4;
    s.set(size, size, size);
    m.compose(p, q, s);
    m.toArray(matrices, i * 16);
    // mostly the deep greens (cells 1–3), a few olive
    cell[i] = rng() < 0.15 ? 0 : 1 + Math.floor(rng() * 3);
    const depth = p.clone().sub(centre).multiply(v3(1 / TREE.canopy, 1 / 26, 1 / TREE.canopy)).length();
    shade[i] = THREE.MathUtils.clamp(0.35 + depth * 0.65, 0.35, 1) * (0.85 + rng() * 0.3);
    const nn = n.clone().lerp(v3(0, 1, 0), 0.2).normalize();
    normal.set([nn.x, nn.y, nn.z], i * 3);
  }
  return { matrices, cell, shade, normal, count };
}
