import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { GARDEN } from "../config";
import { mulberry32 } from "./layout";

// The garden's ground, reshaped from the GLB's as it loads:
//   the pond – widened by a scale (T.pondSize). Everything within the banks'
//              top (BANK pond radii) is scaled out as a whole, so the
//              basin, its shelf and its shore keep their shape; beyond, the
//              push eases off to nothing by FADE pond radii, the meadow
//              taking up the difference. The terrain's vertices (with their
//              uvs, so its painted mud and grass go with them) and every
//              placed tree, bush, rock and plant move by the same map.
//   ridges – grassy ridges and knolls rolling up from just past the pond's
//              banks (ridged noise, from nothing at 1.2 pond radii to full
//              height by 1.9, on out to the terrain's edge; their crests'
//              height is T.gardenRidges), leaving a shallow valley open on
//              the way in; the lawn grows over them, and the trees on them
//              are lifted with them.
const BANK = 1.45;
const FADE = 3.8;
const smooth = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// a point of the GLB's ground → where it lies on the pond widened by scale
export function widenPond(x, z, scale, out) {
  const dx = x - GARDEN.pond.x;
  const dz = z - GARDEN.pond.z;
  const rho = Math.hypot(dx / GARDEN.pondGlbAxes[0], dz / GARDEN.pondGlbAxes[1]);
  const push = (scale - 1) * Math.min(rho, BANK) * (1 - smooth(BANK, FADE, rho));
  const k = rho > 1e-6 ? (rho + push) / rho : scale;
  out.x = GARDEN.pond.x + dx * k;
  out.z = GARDEN.pond.z + dz * k;
  return out;
}

// the ridges' height at (x, z) (garden metres), their crests up to height,
// round the pond widened by pondScale
export function createRidges(height, pondScale, seed = 2024) {
  const noise = createNoise2D(mulberry32(seed));
  const ridge = (x, z, f, o) => {
    const v = 1 - Math.abs(noise(x * f + o, z * f - o));
    return v * v;
  };
  const ax = GARDEN.pondGlbAxes[0] * pondScale;
  const az = GARDEN.pondGlbAxes[1] * pondScale;
  return (x, z) => {
    const dx = x - GARDEN.pond.x;
    const dz = z - GARDEN.pond.z;
    let m = smooth(1.2, 1.9, Math.hypot(dx / ax, dz / az));
    if (m <= 0) return 0;
    // the way in (from +z) stays a shallow valley
    m *= 1 - 0.8 * smooth(0.9, 1.4, dz / az) * (1 - smooth(4, 12, Math.abs(dx)));
    // crests along the lines where the noise crosses zero, a smaller set
    // across them, and broad swells and saddles along their length
    const crest = ridge(x, z, 1 / 24, 0) * 0.65 + ridge(x, z, 1 / 10, 17) * 0.25 + (noise(x / 6, z / 6) * 0.5 + 0.5) * 0.1;
    const swell = 0.6 + 0.4 * noise(x * 0.02 + 7, z * 0.02);
    return height * m * swell * crest;
  };
}

// The terrain mesh, reshaped in place: its transform is baked into a copy
// of its geometry (the GLB's own is cached and shared), then each vertex is
// moved out with the pond and raised onto the ridges.
export function reshapeTerrain(mesh, pondScale, ridgeAt) {
  mesh.updateMatrix();
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrix);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrix();
  const p = g.attributes.position;
  const v = { x: 0, z: 0 };
  for (let i = 0; i < p.count; i++) {
    widenPond(p.getX(i), p.getZ(i), pondScale, v);
    p.setXYZ(i, v.x, p.getY(i) + ridgeAt(v.x, v.z), v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  mesh.geometry = g;
  return mesh;
}

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
