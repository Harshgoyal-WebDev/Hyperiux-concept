// Shared GLSL chunks for the world materials and the forge.

export const NOISE = /* glsl */ `
float ncHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ncNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(ncHash(i + vec3(0, 0, 0)), ncHash(i + vec3(1, 0, 0)), f.x),
        mix(ncHash(i + vec3(0, 1, 0)), ncHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(ncHash(i + vec3(0, 0, 1)), ncHash(i + vec3(1, 0, 1)), f.x),
        mix(ncHash(i + vec3(0, 1, 1)), ncHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float ncFbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * ncNoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
`;

// 2D Voronoi: x = F2 - F1 (distance to the nearest cell border, which reads
// as straight, angular fracture lines), y = id of the nearest cell.
export const VORONOI = /* glsl */ `
vec2 ncVoronoi(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(ncHash(vec3(i + g, 1.7)), ncHash(vec3(i + g, 9.1)));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = ncHash(vec3(i + g, 4.3)); }
    else if (d < d2) { d2 = d; }
  }
  return vec2(sqrt(d2) - sqrt(d1), id);
}
`;

// Mikkelsen bump mapping from a world-space height, using the
// un-normalized screen derivatives so the height is in real metres.
export const BUMP = /* glsl */ `
vec3 ncBump(vec3 surfPos, vec3 n, float h, float faceDir) {
  vec3 dpdx = dFdx(surfPos);
  vec3 dpdy = dFdy(surfPos);
  vec3 r1 = cross(dpdy, n);
  vec3 r2 = cross(n, dpdx);
  float det = dot(dpdx, r1) * faceDir;
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad);
}
`;
