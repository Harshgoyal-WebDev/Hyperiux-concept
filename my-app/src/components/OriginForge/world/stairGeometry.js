import * as THREE from "three";
import { SEGMENTS, STAIR, STAIR_LENGTH, pitchY, stairFrame } from "./stair";

// Geometry for the staircase, built along the stair curve so every tread
// meets the next exactly, even on the sweep. Every vertex carries:
//   aStep  its position along the flight (0–1), for the reveal and lit edges
//   aOcc   a baked contact shade: the inner corner of each step (where the
//          tread meets the next riser) is darker, as real stone is
// and a world-space uv (one unit = one metre) for the stone's grain.

const W = STAIR.width / 2;
const BASE = -0.6; // the masonry runs down below the hall floor

function pusher() {
  const pos = [];
  const step = [];
  const occ = [];
  const uv = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const n = new THREE.Vector3();
  const uvOf = (p, nrm) => {
    const ax = Math.abs(nrm.x), ay = Math.abs(nrm.y), az = Math.abs(nrm.z);
    if (ay >= ax && ay >= az) return [p.x, p.z];
    if (ax >= az) return [p.z, p.y];
    return [p.x, p.y];
  };
  // a quad p0 p1 p2 p3, wound so its face points along `expect`;
  // `o` gives the contact shade at each corner
  const quad = (p0, p1, p2, p3, expect, s, o = [1, 1, 1, 1]) => {
    a.subVectors(p1, p0);
    b.subVectors(p2, p0);
    n.crossVectors(a, b);
    const corners = [p0, p1, p2, p3];
    const order = n.dot(expect) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const k of order) {
      const p = corners[k];
      pos.push(p.x, p.y, p.z);
      step.push(s);
      occ.push(o[k]);
      uv.push(...uvOf(p, expect));
    }
  };
  const build = () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aStep", new THREE.Float32BufferAttribute(step, 1));
    geo.setAttribute("aOcc", new THREE.Float32BufferAttribute(occ, 1));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  };
  return { quad, build };
}

const UP = new THREE.Vector3(0, 1, 0);
const at = (f, side, y) => f.p.clone().addScaledVector(f.n, side).setY(y);

// One block of stone between u0 and u1 with its top at y: the tread (shaded
// toward its back edge when a riser rises behind it), its riser (from the
// tread below), and its two sides down to the base.
function block(quad, u0, u1, y, yBelow, s, { backShade = 0.68, frontShade = 1 } = {}) {
  const f0 = stairFrame(u0);
  const f1 = stairFrame(u1);
  const L0 = at(f0, W, y), R0 = at(f0, -W, y), L1 = at(f1, W, y), R1 = at(f1, -W, y);
  // tread: bright at the nosing, darker into the corner at the back
  quad(L0, R0, R1, L1, UP, s, [frontShade, frontShade, backShade, backShade]);
  // riser: dark at its foot, where it meets the tread below
  if (y > yBelow + 1e-4) {
    const L0d = at(f0, W, yBelow), R0d = at(f0, -W, yBelow);
    quad(L0d, R0d, R0, L0, f0.tan.clone().negate(), s, [0.62, 0.62, 0.97, 0.97]);
  }
  // sides of the masonry, down to the base
  const L0b = at(f0, W, BASE), L1b = at(f1, W, BASE), R0b = at(f0, -W, BASE), R1b = at(f1, -W, BASE);
  quad(L0b, L1b, L1, L0, f0.n, s, [0.8, 0.8, 1, 1]);
  quad(R0b, R1b, R1, R0, f0.n.clone().negate(), s, [0.8, 0.8, 1, 1]);
}

// the flights and landings, solid to the ground
export function buildSteps() {
  const { quad, build } = pusher();
  let below = 0;
  for (const g of SEGMENTS) {
    if (g.kind === "flight") {
      for (let j = 0; j < g.n; j++) {
        const y = g.y0 + (j + 1) * STAIR.riser;
        const u0 = g.u0 + j * g.du;
        // the last tread runs into the landing: no corner shade at its back
        const last = j === g.n - 1;
        block(quad, u0, u0 + g.du, y, below, (u0 + g.du * 0.5), { backShade: last ? 1 : 0.68 });
        below = y;
      }
    } else {
      // a landing: one level slab, subdivided to follow the curve
      const parts = Math.ceil(((g.u1 - g.u0) * STAIR_LENGTH) / 0.6);
      for (let k = 0; k < parts; k++) {
        const u0 = g.u0 + ((g.u1 - g.u0) * k) / parts;
        const u1 = g.u0 + ((g.u1 - g.u0) * (k + 1)) / parts;
        const lastPart = k === parts - 1;
        block(quad, u0, u1, g.y0, below, (u0 + u1) / 2, { backShade: lastPart ? 0.7 : 1 });
        below = g.y0;
      }
    }
  }
  return build();
}

// A continuous ribbon beside the flight, `side` along the normal, `thick`
// across, from `bottom` to `top` relative to the pitch line (each a function
// of u). Used for the low cheek under the railing and the tall wall opposite.
export function buildRibbon({ side, thick, top, bottom, u0 = 0, u1 = 1, segments = 360 }) {
  const { quad, build } = pusher();
  const sign = Math.sign(side);
  for (let k = 0; k < segments; k++) {
    const ua = u0 + ((u1 - u0) * k) / segments;
    const ub = u0 + ((u1 - u0) * (k + 1)) / segments;
    const fa = stairFrame(ua);
    const fb = stairFrame(ub);
    const ya = pitchY(ua);
    const yb = pitchY(ub);
    const inA = side - sign * (thick / 2);
    const outA = side + sign * (thick / 2);
    const iaT = at(fa, inA, ya + top(ua)), iaB = at(fa, inA, Math.min(BASE, ya + bottom(ua)));
    const ibT = at(fb, inA, yb + top(ub)), ibB = at(fb, inA, Math.min(BASE, yb + bottom(ub)));
    const oaT = at(fa, outA, ya + top(ua)), oaB = at(fa, outA, Math.min(BASE, ya + bottom(ua)));
    const obT = at(fb, outA, yb + top(ub)), obB = at(fb, outA, Math.min(BASE, yb + bottom(ub)));
    const inward = fa.n.clone().multiplyScalar(-sign);
    const s = (ua + ub) / 2;
    quad(iaB, ibB, ibT, iaT, inward, s);
    quad(oaB, obB, obT, oaT, inward.clone().negate(), s);
    quad(iaT, ibT, obT, oaT, UP, s);
    if (k === 0) quad(iaB, oaB, oaT, iaT, fa.tan.clone().negate(), s);
    if (k === segments - 1) quad(ibB, obB, obT, ibT, fb.tan, s);
  }
  return build();
}

// a thin inlaid strip along the front of every tread
export function buildNosings() {
  const { quad, build } = pusher();
  const d = 0.06;
  const h = 0.03;
  for (const g of SEGMENTS) {
    if (g.kind !== "flight") continue;
    for (let j = 0; j < g.n; j++) {
      const u = g.u0 + j * g.du;
      const f = stairFrame(u);
      const yt = g.y0 + (j + 1) * STAIR.riser + 0.003;
      const s = u + g.du * 0.5;
      const back = f.tan.clone().multiplyScalar(d);
      const out = f.tan.clone().multiplyScalar(-0.004);
      const L = at(f, W - 0.04, yt).add(out);
      const R = at(f, -W + 0.04, yt).add(out);
      quad(L, R, R.clone().add(back), L.clone().add(back), UP, s);
      quad(L.clone().setY(yt - h), R.clone().setY(yt - h), R, L, f.tan.clone().negate(), s);
    }
  }
  return build();
}

// The railing's line: `height` above the pitch line on the +n side, running
// on a few metres onto the summit landing, where it ends at a newel.
export const RAIL_END_U = 1 + 2.4 / STAIR_LENGTH;
export function railingCurve(side = W - 0.25, height = 0.98) {
  const pts = [];
  const K = 240;
  for (let k = 0; k <= K; k++) {
    const u = (RAIL_END_U * k) / K;
    pts.push(at(stairFrame(u), side, pitchY(u) + height));
  }
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}
