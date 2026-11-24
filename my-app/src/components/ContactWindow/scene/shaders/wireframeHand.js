import { DOF, PALETTE, POINTER, SCENE, SHOCK, SKIN } from "./common";

// Hand B: the same hand as fine orange lines (its mesh) and its vertices as
// points of light, skinned with the fingers. Near the contact it runs hot, to
// a warm white: faintly as the touch nears, then the shockwave's band running
// back along the mesh from the fingertip at the touch.
// (the touch's shockwave runs through it from the index fingertip back to the
// end of its arm: common.js SHOCK — \`wave\`, its front here)
const HOT = /* glsl */ `
${SHOCK}
float hotAt(vec3 wp, float wave) {
  float dc = distance(wp, uContact);
  return uEnergy * 1.3 * exp(-dc / 2.6) + uFlash * 1.6 * exp(-dc / 3.5) + wave * 1.8 + uGlow * 0.35 * exp(-dc / 16.0);
}
`;

export const wireVertex = /* glsl */ `
${SKIN}
${SCENE}
${DOF}
${POINTER}
${HOT}
uniform float uOpacity;
varying float vAlpha;
varying float vHot;
void main() {
  vec3 p = skinPoint(position);
  vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz;
  // (the pointer: the mesh bending aside round it, lit orange)
  vec3 awayM;
  float pm = pointerNear(wp, awayM);
  wp += awayM * pm * 0.45;
  // (the shockwave: a band of orange light running through the mesh as its
  // front passes — colour only, the hand keeps its shape)
  float wave = shockAt(position);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  vHot = hotAt(wp, wave) + pm * 0.85;
  // (the forearm fading out towards where the model's ends, 9cm below the wrist)
  float fade = smoothstep(-9.2, -3.5, position.y) * (1.0 + wave * 1.8);
  vAlpha = fade * uOpacity * uFade / (1.0 + defocus(-mv.z) * 1.6);
}
`;
export const wireFragment = /* glsl */ `
${PALETTE}
varying float vAlpha;
varying float vHot;
void main() {
  // (the brand's orange; where it runs hot — the shockwave, the pointer — a
  // warm white)
  vec3 col = mix(ORANGE * 1.8, vec3(1.0, 0.86, 0.7) * 2.0, clamp(vHot, 0.0, 1.0)) + AMBER * max(vHot - 1.0, 0.0);
  gl_FragColor = vec4(col, vAlpha);
}
`;

export const vertexDotVertex = /* glsl */ `
${SKIN}
${SCENE}
${DOF}
${POINTER}
${HOT}
uniform float uOpacity;
varying float vAlpha;
varying float vHot;
void main() {
  vec3 p = skinPoint(position);
  vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz;
  // (the pointer: the mesh bending aside round it, lit orange)
  vec3 awayM;
  float pm = pointerNear(wp, awayM);
  wp += awayM * pm * 0.45;
  // (the shockwave: a band of orange light running through the mesh as its
  // front passes — colour only, the hand keeps its shape)
  float wave = shockAt(position);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  vHot = hotAt(wp, wave) + pm * 0.85;
  float depth = -mv.z;
  float blur = defocus(depth);
  gl_PointSize = clamp(0.07 * uScale / max(depth, 0.5) * (1.0 + blur), 1.5 * uPixelRatio, 6.0 * uPixelRatio);
  float fade = smoothstep(-9.2, -3.5, position.y) * (1.0 + wave * 1.8);
  vAlpha = fade * uOpacity * uFade / (1.0 + blur * 2.0);
}
`;
export const vertexDotFragment = /* glsl */ `
${PALETTE}
varying float vAlpha;
varying float vHot;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = (1.0 - smoothstep(0.0, 0.5, d));
  vec3 col = mix(ORANGE * 2.0 + AMBER * 0.3, vec3(1.0, 0.86, 0.7) * 2.2, clamp(vHot, 0.0, 1.0)) + AMBER * max(vHot - 1.0, 0.0);
  gl_FragColor = vec4(col, a * vAlpha);
}
`;
