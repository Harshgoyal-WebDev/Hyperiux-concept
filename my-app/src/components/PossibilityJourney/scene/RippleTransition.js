import { Effect, EffectAttribute } from "postprocessing";
import { Color, Uniform } from "three";

// The hand-over from the world to the page. Where the drop meets the water
// (the centre of the screen), a ripple spreads outward: just ahead of its
// front the picture is bent by travelling rings, as through moving water,
// a bright crest rides the front, and inside it there is only the page's
// warm white. At uP = 1 the white reaches every corner.
const FRAGMENT = /* glsl */ `
  uniform float uP, uAspect;
  uniform vec3 uWhite;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uP <= 0.0) { outputColor = inputColor; return; }
    vec2 d = uv - 0.5;
    d.x *= uAspect;
    float r = length(d);
    float far = 0.5 * length(vec2(uAspect, 1.0)) + 0.06;
    float R = pow(uP, 0.9) * far;
    float b = r - R;
    // rings travelling ahead of the front
    float ahead = step(-0.01, b);
    float rings = sin(b * 75.0 - uP * 24.0) * exp(-max(b, 0.0) * 8.0) * ahead;
    vec2 dir = d / max(r, 1e-4);
    dir.x /= uAspect;
    vec2 suv = clamp(uv - dir * rings * 0.03 * (1.0 - uP * 0.5), 0.001, 0.999);
    vec3 col = texture2D(inputBuffer, suv).rgb;
    // the crest, warm, on the front
    col += vec3(1.0, 0.82, 0.6) * exp(-abs(b) * 120.0) * 0.4 * (1.0 - uP * 0.7);
    // inside: the page
    float inside = 1.0 - smoothstep(-0.012, 0.006, b);
    col = mix(col, uWhite, inside);
    outputColor = vec4(col, inputColor.a);
  }
`;

export class RippleTransition extends Effect {
  constructor() {
    super("PJRippleTransition", FRAGMENT, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ["uP", new Uniform(0)],
        ["uAspect", new Uniform(1)],
        ["uWhite", new Uniform(new Color("#F7F4F0"))],
      ]),
    });
  }
}
