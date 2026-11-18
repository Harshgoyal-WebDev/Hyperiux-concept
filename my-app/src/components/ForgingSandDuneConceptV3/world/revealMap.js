import * as THREE from "three";
import { OASIS_RECT, REVEAL_BAND, TREE, setRevealStart } from "./oasis";

// When the oasis comes up where (after the reference,
// hyperiux-concept-rho.vercel.app's load reveal): one front sweeping out
// from the cube at the lake's heart — where the tree will grow — across the
// whole desert. Not a perfect circle: its edge wavers gently round the
// tree (a few slow lobes), and it is drawn as a line of white-hot light
// with an orange glow, its colours split a little at the edge (red leading,
// blue trailing). Everything inside it is the oasis.
//
// The clock is J.revealR (world/oasisCamera.js revealRadiusAt: 0 → its end
// over the reveal's stretch of the scroll): the front's radius, in metres.
// A spot comes up as the front passes it — at its "start": its distance
// from the tree, wavered — over REVEAL_BAND m behind the front.
//
// Pure functions of the position (no texture): the shaders' REVEAL_GLSL
// and its CPU twin revealStartAt agree exactly, everywhere.

// how far the edge wavers in and out (m, once clear of the cube)
const WAVER = 14;
const waver = (dx, dz, r) => {
  const a = Math.atan2(dz, dx);
  const k = Math.min(Math.max(r / 80, 0), 1);
  return WAVER * (0.55 * Math.sin(3 * a + 1.3) + 0.3 * Math.sin(5 * a + 0.4) + 0.15 * Math.sin(11 * a + 2.1)) * k * k * (3 - 2 * k);
};

// when the spot at x, z comes up (the front's radius then)
export function revealStartAt(x, z) {
  const dx = x - TREE.x;
  const dz = z - TREE.z;
  const r = Math.hypot(dx, dz);
  return r + waver(dx, dz, r);
}

// the clock by which all of the oasis has come up (its farthest corner)
let END = 0;
{
  const { x0, z0, x1, z1 } = OASIS_RECT;
  for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) END = Math.max(END, Math.hypot(x - TREE.x, z - TREE.z));
  END += WAVER + REVEAL_BAND;
}
export const revealEnd = () => END;

// (kept for the shared uniforms' sake: there is no map to sample any more)
export function buildRevealMap() {
  setRevealStart(revealStartAt);
  const texture = new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.needsUpdate = true;
  return { texture, rect: new THREE.Vector4(0, 0, 1, 1), end: END, dispose: () => texture.dispose() };
}

// The shaders' side: uOasisReveal (x, z: the tree; z: the clock, the
// front's radius; w: the band over which a spot comes up), and the sweep's
// look, uSweep (its glow's width m, colour split m, intensity, waver over
// time m) and uSweepColor.
export const REVEAL_GLSL = /* glsl */ `
uniform sampler2D uRevealMap;
uniform vec4 uRevealRect;
uniform vec4 uOasisReveal;
uniform vec4 uSweep;
uniform vec3 uSweepColor;
float revealStart(vec2 p) {
  vec2 d = p - uOasisReveal.xy;
  float r = length(d);
  float a = atan(d.y, d.x);
  float k = smoothstep(0.0, 80.0, r);
  return r + ${WAVER.toFixed(1)} * (0.55 * sin(3.0 * a + 1.3) + 0.3 * sin(5.0 * a + 0.4) + 0.15 * sin(11.0 * a + 2.1)) * k;
}
vec4 revealSample(vec2 p) { float s = revealStart(p); return vec4(s, 60000.0, 0.0, s); }
// how far the oasis has come up at p (0 bare desert … 1 the oasis)
float ncReveal(vec2 p) {
  return clamp((uOasisReveal.z - revealStart(p)) / uOasisReveal.w, 0.0, 1.0);
}
// ...and its water (and the bed's sand sinking under it): a little behind
float ncRevealWater(vec2 p) {
  return clamp((uOasisReveal.z - revealStart(p) - 6.0) / (uOasisReveal.w * 2.0), 0.0, 1.0);
}
// The sweep's light at p (HDR, added to the ground): a white-hot line at
// the front with an orange glow round it and a faint afterglow behind; each
// colour channel's edge at a slightly different radius (red leading, blue
// trailing). Fine near the tree, widening as it races out. (t: seconds, for
// the edge's slow waver)
vec3 ncSweep(vec2 p, float t, float wob) {
  float R = uOasisReveal.z;
  if (R < 0.5 || uSweep.z < 0.001) return vec3(0.0);
  float kw = clamp(R / 320.0, 0.45, 1.0);
  float st = revealStart(p) + wob * uSweep.w;
  vec3 x = (vec3(st) - (R + vec3(1.0, 0.0, -1.0) * uSweep.y * kw)) / (uSweep.x * kw);
  vec3 core = exp(-x * x * 4.0);
  vec3 glow = exp(-x * x * 0.3);
  vec3 tail = (1.0 - step(0.0, x)) * exp(x * 0.25);
  // (in as it leaves the cube; out once past everything)
  float fade = smoothstep(0.0, 14.0, R) * (1.0 - smoothstep(${(END * 0.8).toFixed(1)}, ${(END + 120).toFixed(1)}, R));
  return (core * vec3(1.0, 0.88, 0.72) * 3.0 + glow * uSweepColor * 1.6 + tail * uSweepColor * 0.15) * uSweep.z * fade;
}
`;
