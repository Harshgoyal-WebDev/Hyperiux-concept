import * as THREE from "three";

// The garden terrain as a height grid (garden metres): its triangles are
// rasterised once onto a regular grid, so the grass, flowers and bushes can
// be planted on it without ray casts. sample(x, z) interpolates bilinearly;
// outside the terrain it returns -Infinity.
export function buildHeightGrid(mesh, step = 0.5) {
  const g = mesh.geometry;
  mesh.updateMatrixWorld(true);
  const pos = g.attributes.position;
  const index = g.index;
  g.computeBoundingBox();
  const box = g.boundingBox.clone().applyMatrix4(mesh.matrix);
  const x0 = box.min.x;
  const z0 = box.min.z;
  const nx = Math.ceil((box.max.x - x0) / step) + 1;
  const nz = Math.ceil((box.max.z - z0) / step) + 1;
  const h = new Float32Array(nx * nz).fill(-Infinity);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = index ? index.count : pos.count;
  for (let k = 0; k < n; k += 3) {
    a.fromBufferAttribute(pos, index ? index.getX(k) : k).applyMatrix4(mesh.matrix);
    b.fromBufferAttribute(pos, index ? index.getX(k + 1) : k + 1).applyMatrix4(mesh.matrix);
    c.fromBufferAttribute(pos, index ? index.getX(k + 2) : k + 2).applyMatrix4(mesh.matrix);
    const i0 = Math.max(Math.ceil((Math.min(a.x, b.x, c.x) - x0) / step), 0);
    const i1 = Math.min(Math.floor((Math.max(a.x, b.x, c.x) - x0) / step), nx - 1);
    const j0 = Math.max(Math.ceil((Math.min(a.z, b.z, c.z) - z0) / step), 0);
    const j1 = Math.min(Math.floor((Math.max(a.z, b.z, c.z) - z0) / step), nz - 1);
    const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(det) < 1e-9) continue;
    for (let j = j0; j <= j1; j++) {
      const z = z0 + j * step;
      for (let i = i0; i <= i1; i++) {
        const x = x0 + i * step;
        const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det;
        const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
        h[j * nx + i] = Math.max(h[j * nx + i], l1 * a.y + l2 * b.y + l3 * c.y);
      }
    }
  }

  const at = (i, j) => h[Math.min(Math.max(j, 0), nz - 1) * nx + Math.min(Math.max(i, 0), nx - 1)];
  return {
    min: new THREE.Vector2(box.min.x, box.min.z),
    max: new THREE.Vector2(box.max.x, box.max.z),
    sample(x, z) {
      const fx = (x - x0) / step;
      const fz = (z - z0) / step;
      if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return -Infinity;
      const i = Math.floor(fx);
      const j = Math.floor(fz);
      const tx = fx - i;
      const tz = fz - j;
      const top = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
      const bottom = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
      return top * (1 - tz) + bottom * tz;
    },
  };
}
