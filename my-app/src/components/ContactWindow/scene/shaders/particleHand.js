import { DOF, NOISE, PALETTE, POINTER, SCENE, SHOCK, SKIN } from "./common";

// Hand A: thousands of white points on the hand's surface (each its own
// size and brightness), skinned with the fingers. Alive: each point breathes
// on the surface, a few drift away from it; the arm is points too, on the
// model's own forearm, fading out where it ends. Near the fingertip they
// grow restless as the touch nears; at the touch a shockwave runs from the
// index fingertip back through the whole hand.
export const particleHandVertex = /* glsl */ `
${SKIN}
${SCENE}
${NOISE}
${DOF}
${POINTER}
${SHOCK}
// (the hand's extent along its length, rest, its own space: hand/handModel.js)
uniform vec2 uSpanY;
attribute vec3 aNormal;
attribute vec4 aRand; // size, phase, brightness / shedding, shedding phase
varying float vAlpha;
varying float vHot;
varying float vBright;
varying float vRim;
void main() {
  vec3 p = skinPoint(position);
  vec3 n = normalize(skinDir(aNormal));
  float ph = aRand.y * 6.2831853;
  // (breathing on the surface)
  p += n * (0.02 + 0.025 * sin(uTime * 1.1 + ph));
  vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz;
  vec3 wn = normalize(mat3(modelMatrix) * n);
  float alpha = 1.0;
  // (the arm: points on the model's forearm like the rest of the hand,
  // fading out softly towards where the model ends)
  alpha *= smoothstep(uSpanY.x, uSpanY.x + 3.0, position.y);
  // a few shed from the surface, drifting off and fading
  if (aRand.z > 0.955) {
    float s = fract(aRand.w * 3.1 + uTime * 0.06);
    wp += wn * s * 3.2 + drift3(wp * 0.3 + uTime * 0.1) * s * 2.5;
    alpha *= (1.0 - s) * smoothstep(0.0, 0.1, s);
  }

  // the fingertip's restlessness as the touch nears
  float dc = distance(wp, uContact);
  float near = exp(-dc / 2.4);
  wp += wn * near * uEnergy * 0.16 * sin(uTime * 11.0 + ph * 3.0);
  // the shockwave of the touch: a band of light running from the index
  // fingertip back through the whole hand to the end of its arm (colour
  // only: the hand keeps its shape)
  float hit = shockAt(position);
  // the pointer: the points part gently round it, and warm
  vec3 awayM;
  float pm = pointerNear(wp, awayM);
  wp += awayM * pm * 0.55 + wn * pm * 0.25;
  vHot = clamp(near * (uEnergy * 1.4 + uFlash * 2.0) + hit * 1.8 + uGlow * 0.15 * exp(-dc / 14.0) + pm * 0.7, 0.0, 2.5);

  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  // (the form's edges, where the surface turns away: they glow brightest)
  vRim = pow(1.0 - abs(dot(wn, normalize(cameraPosition - wp))), 2.0);
  float depth = -mv.z;
  float blur = defocus(depth);
  float size = mix(0.034, 0.1, aRand.x * aRand.x) * uScale / max(depth, 0.5);
  size *= 1.0 + blur * 1.6;
  gl_PointSize = clamp(size, 1.0 * uPixelRatio, 9.0 * uPixelRatio);
  alpha *= 1.0 / (1.0 + blur * 2.2);
  // (small points stand in for less light)
  alpha *= clamp(size / (1.4 * uPixelRatio), 0.5, 1.0);
  vAlpha = alpha * uFade;
  vBright = 0.6 + 0.8 * fract(aRand.z * 7.3);
}
`;
export const particleHandFragment = /* glsl */ `
${PALETTE}
uniform float uOpacity;
varying float vAlpha;
varying float vHot;
varying float vBright;
varying float vRim;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = (1.0 - smoothstep(0.12, 0.5, d));
  // (glowing white: a soft white glow round a brighter core — enough to
  // bloom; where it runs hot — the shockwave, the pointer — it turns orange)
  float core = 1.0 - smoothstep(0.0, 0.24, d);
  vec3 col = (vec3(0.92, 0.92, 0.95) * 0.9 + vec3(1.0) * core * 0.55) * vBright * (0.75 + 1.4 * vRim);
  col = mix(col, ORANGE * 2.6, clamp(vHot, 0.0, 1.0));
  col += AMBER * max(vHot - 1.0, 0.0);
  gl_FragColor = vec4(col, a * vAlpha * uOpacity);
}
`;
