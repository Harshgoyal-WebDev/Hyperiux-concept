import * as THREE from "three";
import { ERODE, FLOW, sandNoise } from "./forgeAsset";
import { ORBIT_GLSL, ORBIT_UNIFORMS } from "./swirl";

// What the broken rock turns into: bits sampled once over every piece's
// surface. Each sits on its piece (moving with it) until the piece has worn
// away to it in the shared sand pattern (exactly where the stone shader
// wears the stone away); then it comes off, puffs out a little and is drawn
// in one smooth arc into its own orbit in the swirl round the mark, and
// keeps revolving there. A function of each piece's own progress, so
// scrolling back gathers it back into the stone. Shared by the sand
// (CrumbleSand) and the gravel (Gravel).

// count points, area-weighted over every piece's triangles, in the piece's
// own (pivot-relative) space: { local, piece, threshold }
export function samplePieceSurfaces(forge, count, rng) {
  const tris = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  forge.chunks.forEach((piece) => {
    const g = piece.mesh.geometry;
    const pos = g.attributes.position;
    const index = g.index;
    const n = index ? index.count : pos.count;
    for (let k = 0; k < n; k += 3) {
      a.fromBufferAttribute(pos, index ? index.getX(k) : k);
      b.fromBufferAttribute(pos, index ? index.getX(k + 1) : k + 1);
      c.fromBufferAttribute(pos, index ? index.getX(k + 2) : k + 2);
      const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
      if (area > 1e-6) tris.push({ piece, a: a.clone(), b: b.clone(), c: c.clone(), area });
    }
  });
  const cumulative = new Float64Array(tris.length);
  let total = 0;
  tris.forEach((t, i) => (cumulative[i] = total += t.area));

  const local = new Float32Array(count * 3);
  const piece = new Float32Array(count);
  const threshold = new Float32Array(count);
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // binary search the cumulative areas
    const r = rng() * total;
    let lo = 0;
    let hi = tris.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const t = tris[lo];
    let u = rng();
    let v = rng();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    p.copy(t.a).addScaledVector(ab.subVectors(t.b, t.a), u).addScaledVector(ac.subVectors(t.c, t.a), v);
    local.set([p.x, p.y, p.z], i * 3);
    piece[i] = t.piece.index;
    // its threshold in the shared sand pattern, at its rest position
    const rest = t.piece.rest;
    threshold[i] = sandNoise(p.x + rest.x, p.y + rest.y, p.z + rest.z);
  }
  return { local, piece, threshold };
}

// A direction to puff out in as it comes off: mostly out of the face and up.
export function puffDirection(rng, out) {
  return out.set(rng() - 0.5, rng() * 0.7, 0.35 + rng() * 0.65).normalize();
}

// Uniforms the flow reads (by reference: the forge updates them in place).
export function breakupUniforms(forge, shared) {
  return {
    uPiece: { value: forge.swirlSource },
    uPieceQ: { value: forge.pieceQuat },
    uPieceU: { value: forge.pieceProgress },
    uS: { value: forge.scale },
    uCenter: { value: forge.world.logo.clone() },
    uClock: { value: 0 },
    uOpen: { value: 0 },
    ...ORBIT_UNIFORMS,
    uTime: shared.uTime,
  };
}

// GLSL: breakupFlow(piece, local, threshold, drift, out pos) → how far along
// its flow into the swirl it is (0..1), or -1 while it is still stone.
export const breakupGLSL = (pieces) => /* glsl */ `
${ORBIT_GLSL}
uniform vec4 uPiece[${pieces}]; // world position + erosion
uniform vec4 uPieceQ[${pieces}]; // orientation
uniform vec4 uPieceU[${Math.ceil(pieces / 4)}]; // each piece's own progress, four to a vec4
uniform float uS; // asset → world scale
vec3 bkRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
float bkProgress(int i) {
  vec4 q = uPieceU[i / 4];
  int k = i - (i / 4) * 4;
  return k == 0 ? q.x : k == 1 ? q.y : k == 2 ? q.z : q.w;
}
float breakupFlow(int i, vec3 local, float threshold, vec4 drift, out vec3 pos) {
  float u = bkProgress(i);
  float released = ${ERODE[0].toFixed(3)} + threshold * ${(ERODE[1] - ERODE[0]).toFixed(3)};
  if (u < released) {
    pos = vec3(0.0);
    return -1.0;
  }
  float g = clamp((u - released) / ${FLOW.toFixed(3)}, 0.0, 1.0);
  float e = g * g * g * (g * (g * 6.0 - 15.0) + 10.0);
  vec4 P = uPiece[i];
  vec3 from = P.xyz + bkRot(uPieceQ[i], local) * uS;
  // off the stone with a little puff, then one smooth rising arc into its orbit
  vec3 puff = drift.xyz * (1.0 + 2.5 * drift.w) * smoothstep(0.0, 0.4, g);
  pos = mix(from + puff, orbitPos(), e) + vec3(0.0, 1.0, 0.0) * sin(3.14159 * e) * (1.0 + 2.0 * drift.w);
  return g;
}
`;
