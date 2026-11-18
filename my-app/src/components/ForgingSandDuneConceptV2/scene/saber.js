import * as THREE from "three";
import { T } from "../tuning";

// The beam's look, shared by both of its parts (scene/ForgeBeam.jsx, into
// the core; scene/oasis/Streaks.jsx, on through the valley): one solid beam
// of light, like a lightsaber's blade — a white-hot core, smooth and even,
// inside a coloured glow that falls off softly to nothing. No dashes, no
// strands: a single ribbon facing the camera, its width uWidth (the glow's;
// the core is uCoreRatio of it).

export const SABER_VERTEX_PARS = /* glsl */ `
attribute vec3 aTangent;
attribute float aSide;
attribute float aU;
uniform float uPixel; // world size of one pixel at 1 m from the camera
uniform float uWidth; // the glow's full width (m)
varying float vU;
varying float vSide;
varying float vWidthFix;
varying float vHalf; // half the beam's drawn width (m)
`;

// (p: the point on the beam's line, world space; leaves p moved to its edge)
export const SABER_VERTEX_BODY = /* glsl */ `
  vec3 toCam = cameraPosition - p;
  vec3 side = normalize(cross(aTangent, toCam));
  // never thinner than a few pixels (a far beam stays a crisp line); one
  // widened that way is dimmed to match
  float w = max(uWidth, length(toCam) * uPixel * 3.0);
  vWidthFix = uWidth / w;
  vHalf = w * 0.5;
  p += side * aSide * w * 0.5;
  vU = aU;
  vSide = aSide;
`;

export const SABER_FRAGMENT_PARS = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform float uCoreRatio; // the core's width, as a share of the glow's
uniform float uCoreBright;
uniform float uGlowBright;
uniform float uFlicker;
uniform vec3 uCoreColor;
uniform vec3 uGlowColor;
varying float vU;
varying float vSide;
varying float vWidthFix;
varying float vHalf;
// how far from the beam's axis a point is (0 → 1 at its edge), with its
// head rounded off: over its last half-width the beam closes in a half-disc
// (d: metres back from the head; 1e6 where it has no free head)
float saberAcross(float d) {
  float cap = max(vHalf - d, 0.0) / max(vHalf, 1e-4);
  return length(vec2(abs(vSide), cap));
}
// colour (HDR) and coverage of the beam at x across it (saberAcross)
vec4 saber(float x) {
  float core = 1.0 - smoothstep(uCoreRatio * 0.45, uCoreRatio, x);
  float glow = exp(-x * x * 6.0) * (1.0 - smoothstep(0.7, 1.0, x));
  // the faint hum of a blade: a slight, quick shimmer in its brightness
  float hum = 1.0 + uFlicker * 0.06 * (sin(uTime * 47.0) * 0.6 + sin(uTime * 83.0 + 1.7) * 0.4);
  vec3 col = mix(uGlowColor * uGlowBright, uCoreColor * uCoreBright, core) * hum;
  // (the glow covers only as much as it shines: at no glow there is no dark
  // fringe round the core, just the beam)
  float a = clamp(max(core, glow * 0.9 * min(uGlowBright, 1.0)), 0.0, 1.0) * mix(0.55, 1.0, vWidthFix);
  return vec4(col, a);
}
`;

export function saberUniforms() {
  return {
    uWidth: { value: 1 },
    uPixel: { value: 0.001 },
    uIntensity: { value: 1 },
    uCoreRatio: { value: 0.22 },
    uCoreBright: { value: 2 },
    uGlowBright: { value: 1.5 },
    uFlicker: { value: 1 },
    uCoreColor: { value: new THREE.Color("#fff3e0") },
    uGlowColor: { value: new THREE.Color("#ff6a1a") },
  };
}

// the panel's values, each frame (width: the part's own, m)
export function syncSaber(u, width) {
  u.uWidth.value = width;
  u.uCoreRatio.value = T.beamCoreRatio;
  u.uCoreBright.value = T.beamCoreBright;
  u.uGlowBright.value = T.beamGlowBright;
  u.uFlicker.value = T.beamFlicker;
  u.uCoreColor.value.set(T.beamCoreColor);
  u.uGlowColor.value.set(T.beamGlowColor);
}

// The beam's head, a true capsule end: a disc facing the camera, centred on
// the head, the beam's width across, shaded with the same profile (so the
// blade ends in a round tip from any angle — a cap drawn along the beam
// itself is squashed flat when the beam is seen running away over the sand).
const CAP_VERTEX = /* glsl */ `
uniform vec3 uHeadPos;
uniform float uPixel;
uniform float uWidth;
varying vec2 vCap;
varying float vWidthFix;
void main() {
  vec3 toCam = cameraPosition - uHeadPos;
  float w = max(uWidth, length(toCam) * uPixel * 3.0);
  vWidthFix = uWidth / w;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vCap = position.xy;
  vec3 p = uHeadPos + (right * position.x + up * position.y) * w * 0.5;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const CAP_FRAGMENT = /* glsl */ `
uniform float uCapOn;
uniform float uTime;
uniform float uIntensity;
uniform float uCoreRatio;
uniform float uCoreBright;
uniform float uGlowBright;
uniform float uFlicker;
uniform vec3 uCoreColor;
uniform vec3 uGlowColor;
varying vec2 vCap;
varying float vWidthFix;
void main() {
  float x = length(vCap);
  if (x > 1.0 || uCapOn < 0.001) discard;
  float core = 1.0 - smoothstep(uCoreRatio * 0.45, uCoreRatio, x);
  float glow = exp(-x * x * 6.0) * (1.0 - smoothstep(0.7, 1.0, x));
  float hum = 1.0 + uFlicker * 0.06 * (sin(uTime * 47.0) * 0.6 + sin(uTime * 83.0 + 1.7) * 0.4);
  vec3 col = mix(uGlowColor * uGlowBright, uCoreColor * uCoreBright, core) * hum;
  float a = clamp(max(core, glow * 0.9 * min(uGlowBright, 1.0)), 0.0, 1.0) * mix(0.55, 1.0, vWidthFix) * uCapOn * min(uIntensity, 1.0);
  if (a < 0.002) discard;
  gl_FragColor = vec4(col * uIntensity, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
const CAP_GEOMETRY = new THREE.PlaneGeometry(2, 2);
// (sharing the beam's own uniforms: the same look, kept in step)
export function createSaberCap(beamUniforms) {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...beamUniforms, uHeadPos: { value: new THREE.Vector3() }, uCapOn: { value: 0 } },
    vertexShader: CAP_VERTEX,
    fragmentShader: CAP_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(CAP_GEOMETRY, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return mesh;
}
