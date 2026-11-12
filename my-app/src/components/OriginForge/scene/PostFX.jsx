"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, Effect, ToneMappingMode } from "postprocessing";
import { Uniform } from "three";
import { C, lerp } from "../timeline";
import { T } from "../tuning";

// A grade before tone mapping: exposure, saturation, warmth and contrast
// (in linear light, around middle grey), all live from the tuning panel.
class GradeEffect extends Effect {
  constructor() {
    super(
      "OriginForgeGrade",
      /* glsl */ `
      uniform float uExposure, uSaturation, uWarmth, uContrast;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = max(inputColor.rgb * uExposure, vec3(0.0));
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSaturation);
        c *= vec3(1.0 + uWarmth * 0.12, 1.0 + uWarmth * 0.02, 1.0 - uWarmth * 0.12);
        c = 0.18 * pow(c / 0.18 + 1e-6, vec3(uContrast));
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        uniforms: new Map([
          ["uExposure", new Uniform(1)],
          ["uSaturation", new Uniform(1)],
          ["uWarmth", new Uniform(0)],
          ["uContrast", new Uniform(1)],
        ]),
      }
    );
  }
}

// Restrained post: bloom only on what is truly hot, the grade, neutral tone
// mapping so the ivory stays ivory, a soft vignette, a whisper of grain. In
// the light, bloom is pulled back further so the hall keeps its detail.
export default function PostFX() {
  const bloom = useRef();
  const vignette = useRef();
  const noise = useRef();
  const grade = useMemo(() => new GradeEffect(), []);
  useEffect(() => () => grade.dispose(), [grade]);

  useFrame(() => {
    const L = C.light;
    if (bloom.current) {
      bloom.current.intensity = lerp(T.bloomIntensity, 0.35, L);
      bloom.current.luminanceMaterial.threshold = lerp(T.bloomThreshold, 1.05, L);
    }
    if (vignette.current) vignette.current.darkness = lerp(T.vignette, 0.22, L);
    if (noise.current) noise.current.blendMode.opacity.value = T.grain;
    const u = grade.uniforms;
    // the hall is graded neutrally whatever the forge's look
    u.get("uExposure").value = lerp(T.exposure, 1, L);
    u.get("uSaturation").value = lerp(T.saturation, 1, L);
    u.get("uWarmth").value = lerp(T.warmth, 0, L);
    u.get("uContrast").value = lerp(T.contrast, 1, L);
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom ref={bloom} mipmapBlur intensity={0.6} luminanceThreshold={0.85} luminanceSmoothing={0.2} radius={0.72} />
      <primitive object={grade} dispose={null} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette ref={vignette} offset={0.28} darkness={0.42} />
      <Noise ref={noise} premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.16} />
    </EffectComposer>
  );
}
