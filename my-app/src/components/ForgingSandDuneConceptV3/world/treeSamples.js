import * as THREE from "three";

// Points on the Yggdrasil's strands (world metres), each with its climb and
// its filament's seed — so the growth (0 → 1, Yggdrasil.jsx uGrow) at which
// the strand's growing tip reaches it is known (arrivalAt): where the cube's
// threads run to as it melts into the tree (scene/oasis/CoreOrb.jsx). Set
// once the strand model is in (Yggdrasil.jsx StrandTree); until then none.
// pts: x, y, z, climb, seed per point.
export const treeSamples = { pts: null, count: 0, version: 0 };

// (the strands' climb: their height in the model, −4.5 m to 42.9 m — as the
// strand shader's vClimb — and each filament a little apart by its seed)
const climbOf = (y) => Math.min(Math.max((y + 4.5) / 47.4, 0), 1);
export const arrivalAt = (climb, seed, jitter) => (climb + seed * jitter) / (1 + jitter);

export function sampleTree(root, count = 4000) {
  root.updateMatrixWorld(true);
  const meshes = [];
  let total = 0;
  root.traverse((o) => {
    if (!o.isMesh || /Leaves/i.test(o.name) || /Leaves/i.test(o.material?.name || "")) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    meshes.push({ o, pos, seed: o.geometry.getAttribute("_seed"), from: total });
    total += pos.count;
  });
  if (!total) return null;
  let s = 77;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const v = new THREE.Vector3();
  const pts = new Float32Array(count * 5);
  for (let i = 0; i < count; i++) {
    const at = Math.floor(rnd() * total);
    const m = meshes.find((q) => at >= q.from && at < q.from + q.pos.count);
    const k = at - m.from;
    v.fromBufferAttribute(m.pos, k);
    const climb = climbOf(v.y);
    v.applyMatrix4(m.o.matrixWorld);
    pts.set([v.x, v.y, v.z, climb, m.seed ? m.seed.getX(k) : 0.5], i * 5);
  }
  return pts;
}

export function setTreeSamples(pts) {
  treeSamples.pts = pts;
  treeSamples.count = pts ? pts.length / 5 : 0;
  treeSamples.version++;
}
