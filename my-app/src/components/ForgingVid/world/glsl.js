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

// The rocks turning to sand: the share of the dissolve (0..1) at which a
// point of a rock goes. Tops first, broken up by a smooth pattern; each rock
// is offset by its seed so they do not all go at once. The rock's surface
// shader discards at it and its grains (Pillars) are released at it, so the
// solid and the sand never part. info: base y, height, seed (0..1).
export const DISSOLVE = /* glsl */ `
float ncWave(vec3 p) {
  return sin(p.x * 0.37 + sin(p.z * 0.23) * 1.7) * sin(p.y * 0.41 + sin(p.x * 0.29) * 1.9) * sin(p.z * 0.33 + sin(p.y * 0.31) * 1.3);
}
float ncPattern(vec3 p) {
  return 0.6 * ncWave(p) + 0.4 * ncWave(p * 2.7 + 11.0);
}
float ncDisT(vec3 p, vec3 info) {
  float y = clamp((p.y - info.x) / info.y, 0.0, 1.0);
  float n = ncPattern(p * 1.6) * 0.5 + 0.5;
  return clamp((1.0 - y) * 0.55 + n * 0.45, 0.0, 1.0) * 0.72 + info.z * 0.2;
}
`;
