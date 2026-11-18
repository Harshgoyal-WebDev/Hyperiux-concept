import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { mulberry32 } from "./layout";
import { OASIS_RECT, REVEAL_BAND, S_END, TREE, floorHalfWidth, route, setRevealStart } from "./oasis";

// When the oasis comes up where (after the reference, hyperiux-orb-bloom's
// "bloom"): not a ring spreading evenly, but light running out from the
// tree over the bare sand like water — rivulets that wander outwards along
// the low ground, and a few that run back up the stream's bed — each
// reaching further as the scroll goes on, bright at its running front and
// dimming behind. A while after the light has run past a spot, that spot
// comes to life, and the life spreads out sideways from the rivulets (at a
// pace that varies with the ground); a slower front out from the tree
// takes care of whatever they leave.
//
// The clock is J.revealR (world/oasisCamera.js revealRadiusAt: 0 → its end
// over the reveal's stretch of the scroll), in the units the old ring used —
// metres of a front out from the tree at one metre per unit — so the slow
// front reaches r at clock r, and everything else is quicker.
//
// One texture over OASIS_RECT, read by the sand, the water and the plants
// (REVEAL_GLSL), and its CPU twin (revealStartAt):
//   r  when the spot comes to life (the oasis's ground, water, plants)
//   g  when the light runs past it (none: far in the future)
//   b  how much of a rivulet it is (0 … 1 on its line)
//   a  when the water comes up there (a smoothed r)

export const REVEAL_CELL = 2.5; // m

// a separable box blur of a grid (radius in cells)
function boxBlur(src, nx, nz, rad) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      let sum = 0;
      let n = 0;
      for (let k = Math.max(i - rad, 0); k <= Math.min(i + rad, nx - 1); k++) {
        sum += src[j * nx + k];
        n++;
      }
      tmp[j * nx + i] = sum / n;
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      let sum = 0;
      let n = 0;
      for (let k = Math.max(j - rad, 0); k <= Math.min(j + rad, nz - 1); k++) {
        sum += tmp[k * nx + i];
        n++;
      }
      out[j * nx + i] = sum / n;
    }
  }
  return out;
}
const NONE = 60000; // (never: a half float still holds it)
const RIVULETS = 46; // out over the sand, wandering
const STREAM_RIVULETS = 8; // back up the stream's bed
const LAG = 32; // how long after the light has run past a spot it comes to life (clock)
const FAR_NOISE = 70; // the slow front's raggedness (clock)

let current = null;

// how far the light has run along a rivulet by clock t, and when it passes s
// (it slows a little as it goes: reach = L(1 − (1 − x)²), as the reference)
export const passedAt = (s, L, t0, dur) => t0 + dur * (1 - Math.sqrt(Math.max(0, 1 - s / L)));

export function buildRevealMap(terrain) {
  const { x0, z0, x1, z1 } = OASIS_RECT;
  const nx = Math.round((x1 - x0) / REVEAL_CELL);
  const nz = Math.round((z1 - z0) / REVEAL_CELL);
  const N = nx * nz;
  const rnd = mulberry32(911);
  const n1 = createNoise2D(mulberry32(917));
  const n2 = createNoise2D(mulberry32(919));
  const cx = TREE.x;
  const cz = TREE.z;

  // the slow front, ragged
  const start = new Float32Array(N);
  const light = new Float32Array(N).fill(NONE);
  const line = new Float32Array(N);
  const speed = new Float32Array(N);
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + 0.5) * REVEAL_CELL;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * REVEAL_CELL;
      const q = j * nx + i;
      const r = Math.hypot(x - cx, z - cz);
      const nn = n1(x * 0.006, z * 0.006);
      start[q] = r + nn * FAR_NOISE * 0.5 + n2(x * 0.03, z * 0.03) * 10;
      // how quickly life spreads out from the rivulets here (m per clock unit)
      speed[q] = 0.3 + 0.6 * (0.5 + 0.5 * n2(x * 0.011 + 40, z * 0.011 - 13));
    }
  }

  // a rivulet's light and life, splatted along its line
  const splat = (x, z, tLight, rad) => {
    const ia = Math.floor((x - rad - x0) / REVEAL_CELL);
    const ib = Math.floor((x + rad - x0) / REVEAL_CELL);
    const ja = Math.floor((z - rad - z0) / REVEAL_CELL);
    const jb = Math.floor((z + rad - z0) / REVEAL_CELL);
    for (let j = Math.max(ja, 0); j <= Math.min(jb, nz - 1); j++) {
      for (let i = Math.max(ia, 0); i <= Math.min(ib, nx - 1); i++) {
        const px = x0 + (i + 0.5) * REVEAL_CELL;
        const pz = z0 + (j + 0.5) * REVEAL_CELL;
        const d = Math.hypot(px - x, pz - z);
        if (d > rad) continue;
        const q = j * nx + i;
        const w = 1 - d / rad;
        if (tLight < light[q]) light[q] = tLight;
        if (w > line[q]) line[q] = w;
        // (the spot comes to life a while after the light has passed)
        if (d < rad * 1.6 && tLight + LAG < start[q]) start[q] = tLight + LAG;
      }
    }
  };
  const rivulets = []; // (their lines, for scene/oasis/Rivulets.jsx)
  const run = (pts, t0, v) => {
    // evenly along it, every ~1.5 m
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const L = cum.at(-1);
    if (L < 5) return;
    const dur = L / v;
    rivulets.push({ pts, cum, L, t0, dur });
    let k = 0;
    for (let s = 0; s <= L; s += 1.5) {
      while (k < cum.length - 2 && cum[k + 1] < s) k++;
      const f = (s - cum[k]) / Math.max(cum[k + 1] - cum[k], 1e-6);
      const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f;
      const z = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f;
      // (thinner as it runs out)
      splat(x, z, passedAt(s, L, t0, dur), 3.2 - 1.2 * (s / L));
    }
  };

  // out over the sand: wandering away from the tree, drawn into the low
  // ground across their way (the dunes' troughs), never back
  const inRect = (x, z) => x > x0 && x < x1 && z > z0 && z < z1;
  const e = 2.5;
  for (let p = 0; p < RIVULETS; p++) {
    const a0 = (p / RIVULETS) * Math.PI * 2 + (rnd() - 0.5) * 0.12;
    let dx = Math.cos(a0);
    let dz = Math.sin(a0);
    let x = cx + dx * 8;
    let z = cz + dz * 8;
    const want = 260 + 640 * Math.pow(rnd(), 0.7);
    const pts = [[x, z]];
    let len = 0;
    const STEP = 3;
    while (len < want && inRect(x, z)) {
      const hx = (terrain.height(x + e, z) - terrain.height(x - e, z)) / (2 * e);
      const hz = (terrain.height(x, z + e) - terrain.height(x, z - e)) / (2 * e);
      const rx = x - cx;
      const rz = z - cz;
      const rl = Math.hypot(rx, rz) || 1;
      // (the downhill pull only across its way: it keeps heading out)
      const across = -hx * (-rz / rl) - hz * (rx / rl);
      const w = n1(x * 0.012 + p * 3.1, z * 0.012 - 1.7) * 0.9;
      dx += (rx / rl) * 0.16 + (-rz / rl) * (across * 0.5 + w * 0.22);
      dz += (rz / rl) * 0.16 + (rx / rl) * (across * 0.5 + w * 0.22);
      const dl = Math.hypot(dx, dz) || 1;
      dx /= dl;
      dz /= dl;
      x += dx * STEP;
      z += dz * STEP;
      len += STEP;
      pts.push([x, z]);
    }
    run(pts, 4 + rnd() * 26, 1.55 + rnd() * 0.6);
  }
  // back up the stream's bed: from the tree out to the way's end, then back
  // along it, each weaving across the floor
  const tmp = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let p = 0; p < STREAM_RIVULETS; p++) {
    const side = (p / (STREAM_RIVULETS - 1)) * 2 - 1;
    const ph = rnd() * 6.28;
    const pts = [[cx, cz]];
    const sTo = 380 + rnd() * 120;
    for (let s = S_END; s > sTo; s -= 4) {
      route.getPointAt(s / S_END, tmp);
      route.getTangentAt(s / S_END, tan);
      const lat = floorHalfWidth(s) * 0.55 * (side * 0.7 + 0.3 * Math.sin(s * 0.017 + ph));
      pts.push([tmp.x - tan.z * lat, tmp.z + tan.x * lat]);
    }
    run(pts, 10 + rnd() * 20, 1.9 + rnd() * 0.5);
  }

  // life spreading out sideways from the rivulets (two sweeps of a chamfer
  // distance, each step at the ground's own pace)
  const D1 = REVEAL_CELL;
  const D2 = REVEAL_CELL * Math.SQRT2;
  const relax = (q, o, d) => {
    const t = start[o] + d / speed[q];
    if (t < start[q]) start[q] = t;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const q = j * nx + i;
        if (i > 0) relax(q, q - 1, D1);
        if (j > 0) {
          relax(q, q - nx, D1);
          if (i > 0) relax(q, q - nx - 1, D2);
          if (i < nx - 1) relax(q, q - nx + 1, D2);
        }
      }
    }
    for (let j = nz - 1; j >= 0; j--) {
      for (let i = nx - 1; i >= 0; i--) {
        const q = j * nx + i;
        if (i < nx - 1) relax(q, q + 1, D1);
        if (j < nz - 1) {
          relax(q, q + nx, D1);
          if (i < nx - 1) relax(q, q + nx + 1, D2);
          if (i > 0) relax(q, q + nx - 1, D2);
        }
      }
    }
  }

  // the water's own, smoother start (the lake and the stream fill in
  // evenly, not in the fingers the green comes up in — stepped, the bed's
  // sand stood out of the water in blocks): a wide blur of the above
  const wet = boxBlur(boxBlur(start, nx, nz, 7), nx, nz, 7);

  let maxStart = 0;
  const half = new Uint16Array(N * 4);
  for (let q = 0; q < N; q++) {
    start[q] = Math.max(start[q], 0);
    maxStart = Math.max(maxStart, start[q]);
    half[q * 4] = THREE.DataUtils.toHalfFloat(Math.min(start[q], NONE));
    half[q * 4 + 1] = THREE.DataUtils.toHalfFloat(Math.min(light[q], NONE));
    half[q * 4 + 2] = THREE.DataUtils.toHalfFloat(line[q]);
    half[q * 4 + 3] = THREE.DataUtils.toHalfFloat(Math.max(wet[q], 0));
  }
  const texture = new THREE.DataTexture(half, nx, nz, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  current = { start, nx, nz, maxStart };
  setRevealStart(revealStartAt);
  return {
    texture,
    // (x0, z0, 1 / width, 1 / depth)
    rect: new THREE.Vector4(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0)),
    // the clock by which all of it has come up
    end: maxStart + REVEAL_BAND,
    // the light's lines: points (x, z), arc length along, length, and when
    // it passes s along each (passedAt)
    rivulets,
    dispose: () => texture.dispose(),
  };
}

// when the spot at x, z comes to life (the shaders' revealStart, on the CPU)
export function revealStartAt(x, z) {
  const r = Math.hypot(x - TREE.x, z - TREE.z);
  if (!current) return r;
  const { x0, z0 } = OASIS_RECT;
  const u = (x - x0) / REVEAL_CELL - 0.5;
  const v = (z - z0) / REVEAL_CELL - 0.5;
  const { start, nx, nz } = current;
  if (u < 0 || v < 0 || u > nx - 1.001 || v > nz - 1.001) return r;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const a = start[j * nx + i];
  const b = start[j * nx + i + 1];
  const c = start[(j + 1) * nx + i];
  const d = start[(j + 1) * nx + i + 1];
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}
// the clock by which everything has come up (the reveal's end)
export const revealEnd = () => (current ? current.maxStart + REVEAL_BAND : 1100);

// The shaders' side: uRevealMap / uRevealRect, and uOasisReveal (x, z: the
// tree; z: the clock; w: the band over which a spot comes up).
export const REVEAL_GLSL = /* glsl */ `
uniform sampler2D uRevealMap;
uniform vec4 uRevealRect;
uniform vec4 uOasisReveal;
vec4 revealSample(vec2 p) {
  vec2 uv = (p - uRevealRect.xy) * uRevealRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { float r = length(p - uOasisReveal.xy); return vec4(r, 60000.0, 0.0, r); }
  return textureLod(uRevealMap, uv, 0.0);
}
float revealStart(vec2 p) { return revealSample(p).r; }
// how far the oasis has come up at p (0 bare desert … 1 the oasis)
float ncReveal(vec2 p) {
  return clamp((uOasisReveal.z - revealStart(p)) / uOasisReveal.w, 0.0, 1.0);
}
// ...and its water (and the bed's sand sinking under it): smoother, slower
float ncRevealWater(vec2 p) {
  vec4 m = revealSample(p);
  float st = uOasisReveal.z > 0.0 && m.a > 0.0 ? m.a : m.r;
  return clamp((uOasisReveal.z - st) / (uOasisReveal.w * 2.0), 0.0, 1.0);
}
`;
