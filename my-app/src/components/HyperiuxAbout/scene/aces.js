import * as THREE from "three";
import { A } from "../tuning";

// The exact inverse of the post's tone mapping (three's ACESFilmicToneMapping,
// exposure 1, as the ToneMapping effect applies it): the light to put into
// the frame so that, once tone-mapped, a pixel comes out as a given colour.
// Used for what must show as it is — the team's portrait images, and the
// team's backdrop colours matched to them.
// (GLSL's mat3(a, b, c) takes columns: the same matrices three uses.)
function columns(a, b, c) {
  return new THREE.Matrix3().set(a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]);
}
const ACES_IN = columns([0.59719, 0.076, 0.0284], [0.35458, 0.90834, 0.13383], [0.04823, 0.01566, 0.83777]);
const ACES_OUT = columns([1.60475, -0.10208, -0.00327], [-0.53108, 1.10813, -0.07276], [-0.07367, -0.00605, 1.07602]);
const INV_IN = ACES_IN.clone().invert();
const INV_OUT = ACES_OUT.clone().invert();

export function acesUniforms() {
  return { uInvAcesIn: { value: INV_IN }, uInvAcesOut: { value: INV_OUT } };
}

export const INVERSE_ACES_GLSL = /* glsl */ `
  uniform mat3 uInvAcesIn;
  uniform mat3 uInvAcesOut;
  // (RRTAndODTFit's inverse: the root of its quadratic in the curve's range)
  vec3 invAcesFit(vec3 y) {
    vec3 a = 0.983729 * y - 1.0;
    vec3 b = 0.432951 * y - 0.0245786;
    vec3 c = 0.238081 * y + 0.000090537;
    return (-b - sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a);
  }
  // linear colour wanted on screen → the linear light to render
  vec3 inverseAces(vec3 target) {
    vec3 c = max(uInvAcesOut * clamp(target, 0.0, 0.98), 0.0);
    // (past the curve's top, scaled down as a whole — never one channel
    // clipped alone, which turns a bright orange green)
    float top = max(max(c.r, c.g), c.b);
    if (top > 0.985) c *= 0.985 / top;
    c = invAcesFit(c);
    c = uInvAcesIn * c;
    return max(c * 0.6, 0.0);
  }
  vec3 srgbToLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }
`;

// The light's own colours, as the team renders have them: a line of light
// from its faint glow, through its body and its bright run, to its hot core.
// A strand of any kind reads its colour off this by how bright it is there
// (streakRamp(0 → 1), sRGB); together with inverseAces() it shows on screen
// in exactly the renders' colours. Values: tuning.js (A.line*).
export function rampUniforms() {
  return { uRamp: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] } };
}
// (as sRGB, as written: three's Color.set() stores a colour in linear, and
// the shaders take these as sRGB and convert them themselves)
export function setSrgb(color, hex) {
  return color.set(hex).convertLinearToSRGB();
}
export function syncRamp(u) {
  const r = u.uRamp.value;
  setSrgb(r[0], A.lineGlow);
  setSrgb(r[1], A.lineBody);
  setSrgb(r[2], A.lineBright);
  setSrgb(r[3], A.lineHot);
}
export const STREAK_RAMP_GLSL = /* glsl */ `
  uniform vec3 uRamp[4];
  vec3 streakRamp(float t) {
    t = clamp(t, 0.0, 1.0) * 3.0;
    if (t < 1.0) return mix(uRamp[0], uRamp[1], t);
    if (t < 2.0) return mix(uRamp[1], uRamp[2], t - 1.0);
    return mix(uRamp[2], uRamp[3], t - 2.0);
  }
`;
