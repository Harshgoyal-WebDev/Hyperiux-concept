import * as THREE from "three";

// Camera-facing ribbon strips (beams, streaks). Each line is
// { points: Vector3[], info: [a, b, c, d] }; the shader gets the point, its
// tangent, which side of the strip the vertex is on, the normalized
// position along the line and the per-line info vector.
export function buildRibbonGeometry(lines) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const l of lines) {
    vertexCount += l.points.length * 2;
    indexCount += (l.points.length - 1) * 6;
  }
  const position = new Float32Array(vertexCount * 3);
  const tangent = new Float32Array(vertexCount * 3);
  const side = new Float32Array(vertexCount);
  const along = new Float32Array(vertexCount);
  const info = new Float32Array(vertexCount * 4);
  const variant = new Float32Array(vertexCount);
  const index = new Uint32Array(indexCount);

  const t = new THREE.Vector3();
  let v = 0;
  let k = 0;
  for (const l of lines) {
    const pts = l.points;
    const n = pts.length;
    const base = v;
    for (let i = 0; i < n; i++) {
      const prev = pts[Math.max(i - 1, 0)];
      const next = pts[Math.min(i + 1, n - 1)];
      t.subVectors(next, prev).normalize();
      for (let s = 0; s < 2; s++) {
        position.set([pts[i].x, pts[i].y, pts[i].z], v * 3);
        tangent.set([t.x, t.y, t.z], v * 3);
        side[v] = s === 0 ? -1 : 1;
        along[v] = n > 1 ? i / (n - 1) : 0;
        info.set(l.info, v * 4);
        variant[v] = l.variant || 0;
        v++;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k);
      k += 6;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("aTangent", new THREE.BufferAttribute(tangent, 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setAttribute("aT", new THREE.BufferAttribute(along, 1));
  g.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  g.setAttribute("aVar", new THREE.BufferAttribute(variant, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

// Expands a ribbon vertex sideways in view space.
export const RIBBON_VERTEX = /* glsl */ `
vec4 ncRibbon(vec3 p, vec3 tangent, float side, float width) {
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 tv = (modelViewMatrix * vec4(tangent, 0.0)).xyz;
  vec3 s = cross(tv, mv.xyz);
  float l = length(s);
  s = l > 1e-5 ? s / l : vec3(0.0, 1.0, 0.0);
  mv.xyz += s * side * width;
  return mv;
}
`;
