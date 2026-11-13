import { Effect, EffectAttribute } from "postprocessing";
import { Uniform, Vector2 } from "three";

// The pointer's liquid, over the whole picture: the frame is seen through a
// clear film of water (the fluid's dye: its thickness). Where the film
// slopes it refracts, and like real glass or water it bends each wavelength
// a little differently: the image is sampled at six points along the
// refraction, each weighted to its part of the spectrum, so its edges split
// into a soft rainbow (chromatic dispersion). A faint sheen catches the
// light on its slopes. Where there is no liquid, the frame passes untouched.
const FRAGMENT = /* glsl */ `
  uniform sampler2D tThick;
  uniform sampler2D tVel;
  uniform vec2 uTexel;
  uniform float uStrength, uDispersion, uShine, uOn;

  vec3 spectrum(float k) {
    return clamp(vec3(1.5 - abs(k) * 3.0, 1.5 - abs(k - 0.5) * 3.0, 1.5 - abs(k - 1.0) * 3.0), 0.0, 1.0);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uOn < 0.5) { outputColor = inputColor; return; }
    float h = texture2D(tThick, uv).r;
    vec2 e = uTexel * 2.0;
    vec2 n = vec2(
      texture2D(tThick, uv + vec2(e.x, 0.0)).r - texture2D(tThick, uv - vec2(e.x, 0.0)).r,
      texture2D(tThick, uv + vec2(0.0, e.y)).r - texture2D(tThick, uv - vec2(0.0, e.y)).r
    );
    float wet = clamp(h * 3.0, 0.0, 1.0);
    vec2 off = n * uStrength * 0.065 + texture2D(tVel, uv).xy * 0.000009 * uStrength * wet;
    if (dot(off, off) < 1e-10) { outputColor = inputColor; return; }
    vec3 col;
    if (uDispersion < 0.4) {
      // a light split: one sample per channel is enough
      col.r = texture2D(inputBuffer, clamp(uv - off * (1.0 - uDispersion), 0.001, 0.999)).r;
      col.g = texture2D(inputBuffer, clamp(uv - off, 0.001, 0.999)).g;
      col.b = texture2D(inputBuffer, clamp(uv - off * (1.0 + uDispersion), 0.001, 0.999)).b;
    } else {
      // a strong one: six samples across the spectrum, so it stays smooth
      vec3 acc = vec3(0.0);
      vec3 wsum = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        float k = float(i) / 5.0;
        vec3 w = spectrum(k);
        vec2 o = off * (1.0 + (k - 0.5) * 2.0 * uDispersion);
        acc += texture2D(inputBuffer, clamp(uv - o, 0.001, 0.999)).rgb * w;
        wsum += w;
      }
      col = acc / wsum;
    }
    // the light on the water: a sheen on its slopes, the faintest clear tint
    float slope = length(n) * uStrength;
    col += vec3(1.0, 0.985, 0.96) * smoothstep(0.03, 0.3, slope) * 0.1 * uShine;
    col *= 1.0 + wet * 0.025;
    outputColor = vec4(col, inputColor.a);
  }
`;

export class LiquidEffect extends Effect {
  constructor() {
    super("PJLiquid", FRAGMENT, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ["tThick", new Uniform(null)],
        ["tVel", new Uniform(null)],
        ["uTexel", new Uniform(new Vector2(1 / 512, 1 / 512))],
        ["uStrength", new Uniform(1)],
        ["uDispersion", new Uniform(0.6)],
        ["uShine", new Uniform(1)],
        ["uOn", new Uniform(0)],
      ]),
    });
  }
}
