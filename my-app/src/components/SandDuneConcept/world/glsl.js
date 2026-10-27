// Shared GLSL chunks. Anything that has a JS twin (dissolve threshold,
// fragment motion) must stay byte-for-byte equivalent with dissolve.js /
// fracture.js, otherwise particles and meshes drift out of sync.

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

// Dissolve threshold: the progress value at which a world point turns to
// sand. Mode 0 = monolith (outer edges first, inwards), 1 = rocks (tops
// first), 2 = terrain (upwind first, across the scene).
export const DISSOLVE = /* glsl */ `
uniform float uDissolve;
uniform vec2 uDisRange;
uniform vec3 uDisCenter;
uniform vec3 uDisExtent;
uniform vec2 uDisAxis;
uniform float uDisMode;

float ncWave(vec3 p) {
  return sin(p.x * 0.37 + sin(p.z * 0.23) * 1.7)
       * sin(p.y * 0.41 + sin(p.x * 0.29) * 1.9)
       * sin(p.z * 0.33 + sin(p.y * 0.31) * 1.3);
}
float ncPattern(vec3 p) {
  return 0.6 * ncWave(p) + 0.4 * ncWave(p * 2.7 + 11.0);
}
float ncThreshold(vec3 p) {
  float n = ncPattern(p) * 0.5 + 0.5;
  float e;
  if (uDisMode < 0.5) {
    vec3 d = abs(p - uDisCenter) / uDisExtent;
    e = 1.0 - clamp(max(d.x, d.y), 0.0, 1.0);
  } else if (uDisMode < 1.5) {
    e = 1.0 - clamp(p.y / uDisExtent.y, 0.0, 1.0);
  } else {
    e = clamp((dot(p.xz, uDisAxis) - uDisExtent.x) / (uDisExtent.y - uDisExtent.x), 0.0, 1.0);
  }
  return mix(uDisRange.x, uDisRange.y, clamp(e * 0.75 + n * 0.25, 0.0, 1.0));
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

// Cube fracture: offset and spin of one fragment (cube-local space).
export const FRACTURE = /* glsl */ `
vec3 ncFragOffset(vec3 origin, vec3 dir, float seed, float fr) {
  float e = pow(fr, 1.45);
  return origin + dir * e * (5.5 + seed * 7.0);
}
mat3 ncRotation(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c, oc * axis.x * axis.y + axis.z * s, oc * axis.z * axis.x - axis.y * s,
    oc * axis.x * axis.y - axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.x + axis.y * s, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.z + c);
}
`;
