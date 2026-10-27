import { Uniform } from "three";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";

// Screen effects for the break and the passage after it: the frame's edges
// stretch outwards as the cube tears open, and a radial motion blur with a
// chromatic split streaks along the scroll direction (zooming in going
// forward, out going back). Both read the scene buffer at a displaced UV (a
// convolution), so the stretch is applied by sampling rather than through
// mainUv, which postprocessing can't combine with convolution.
const fragmentShader = /* glsl */ `
uniform float uEdge; // edge stretch amount (break timing × edgeStretch)
uniform float uBlur;
uniform float uChroma;
uniform float uDir; // +1 scrolling forward (zoom in), -1 back (zoom out)

// barrel stretch: the outer frame samples from further in, so everything
// is pulled out towards (and past) the screen edges
vec2 ncStretch(vec2 uv) {
  vec2 c = uv - 0.5;
  float aspect = resolution.x / resolution.y;
  c.x *= aspect;
  float r = length(c);
  vec2 off = -c * r * r * 0.22 * uEdge;
  off.x /= aspect;
  return uv + off;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uEdge <= 0.0001 && uBlur <= 0.0001) {
    outputColor = inputColor;
    return;
  }
  vec2 c = ncStretch(uv) - 0.5;
  float amt = uBlur * smoothstep(0.05, 0.75, length(uv - 0.5));
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 8; i++) {
    float t = float(i) / 7.0;
    float s = 1.0 - amt * 0.14 * t * uDir;
    float ch = (amt * 0.006 + uEdge * 0.0015) * uChroma;
    vec3 col;
    col.r = texture2D(inputBuffer, 0.5 + c * (s - ch)).r;
    col.g = texture2D(inputBuffer, 0.5 + c * s).g;
    col.b = texture2D(inputBuffer, 0.5 + c * (s + ch)).b;
    float w = 1.0 - t * 0.55;
    acc += col * w;
    wsum += w;
    if (amt <= 0.0001) break;
  }
  outputColor = vec4(acc / wsum, inputColor.a);
}
`;

export class BreakEffect extends Effect {
  constructor() {
    super("BreakEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ["uEdge", new Uniform(0)],
        ["uBlur", new Uniform(0)],
        ["uChroma", new Uniform(1)],
        ["uDir", new Uniform(1)],
      ]),
    });
  }
}
