// GLSL shared by the scene's materials.

// The palette (linear): #ff5f00, warm amber, #f1f1f1, the black #050505.
export const PALETTE = /* glsl */ `
const vec3 ORANGE = vec3(1.0, 0.1144, 0.0);
const vec3 AMBER = vec3(1.0, 0.42, 0.07);
const vec3 WIRE = vec3(0.88, 0.88, 0.88);
const vec3 BLACK = vec3(0.0015, 0.0015, 0.0015);
`;

// Skinning: each point carried by its two bones (hand/handRig.js).
export const SKIN = /* glsl */ `
uniform mat4 uBones[17];
attribute vec2 aBone;
attribute vec2 aWeight;
vec3 skinPoint(vec3 p) {
  vec4 q = vec4(p, 1.0);
  return (uBones[int(aBone.x + 0.5)] * q).xyz * aWeight.x + (uBones[int(aBone.y + 0.5)] * q).xyz * aWeight.y;
}
vec3 skinDir(vec3 n) {
  return mat3(uBones[int(aBone.x + 0.5)]) * n * aWeight.x + mat3(uBones[int(aBone.y + 0.5)]) * n * aWeight.y;
}
`;

// The touch's shockwave, through a hand: from its index fingertip (uTip) back
// along the finger, over the palm and the other fingers, to the end of its
// arm (uShockLen: the farthest of it from the tip) — measured in the hand's
// own rest space, so it runs through the hand as the hand is, wherever it
// is. uShock 0 → 1 is its run (scene/choreography.js). Returns its front's
// strength at a point (0..1).
export const SHOCK = /* glsl */ `
uniform vec3 uTip;
uniform float uShockLen;
float shockAt(vec3 rest) {
  if (uShock <= 0.0 || uShock >= 1.0) return 0.0;
  float d = distance(rest, uTip);
  float front = uShock * (uShockLen + 4.0);
  float w = 1.4 + uShock * 2.2;
  return exp(-pow((d - front) / w, 2.0)) * (1.0 - uShock * 0.55);
}
`;

// Value noise and a cheap curl-ish 3D drift.
export const NOISE = /* glsl */ `
float h13(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1, 0, 0)), f.x), mix(h13(i + vec3(0, 1, 0)), h13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h13(i + vec3(0, 0, 1)), h13(i + vec3(1, 0, 1)), f.x), mix(h13(i + vec3(0, 1, 1)), h13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 drift3(vec3 p) {
  return vec3(vnoise(p), vnoise(p + vec3(17.1, 3.7, 9.2)), vnoise(p + vec3(5.3, 21.4, 13.9))) - 0.5;
}
float fbm2(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(vec3(p, 0.0));
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
`;

// The shared scene uniforms' declarations (scene/uniforms.js).
export const SCENE = /* glsl */ `
uniform float uTime;
uniform vec3 uContact;
uniform float uEnergy;
uniform float uFlash;
uniform float uShock;
uniform float uFocus;
uniform float uDof;
uniform float uScale;
uniform float uFade;
uniform float uGlow;
uniform float uPixelRatio;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform float uAspect;
`;

// The pointer's touch on a point (world): how near the cursor it is on screen
// (0..1), and the way to push it aside in the world (along the screen).
export const POINTER = /* glsl */ `
float pointerNear(vec3 wp, out vec3 away) {
  vec4 c = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  vec2 dm = (c.xy / max(c.w, 1e-3) - uMouse) * vec2(uAspect, 1.0);
  float md = length(dm);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  away = (right * dm.x + up * dm.y) / max(md, 1e-3);
  return exp(-pow(md / 0.13, 2.0)) * uMouseOn;
}
`;

// focus blur, faked per point / line: how far off the focal plane (0..1)
export const DOF = /* glsl */ `
float defocus(float viewDepth) {
  return clamp(abs(viewDepth - uFocus) / max(uFocus, 1.0) * uDof, 0.0, 1.0);
}
`;
