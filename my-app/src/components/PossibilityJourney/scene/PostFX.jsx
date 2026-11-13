"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { Effect, ToneMappingMode } from "postprocessing";
import { Uniform } from "three";
import { C } from "../timeline";
import { T } from "../tuning";
import { attachPointer, pointer } from "../../OriginForge/pointer";
import { LiquidSim } from "../world/fluid";
import { LiquidEffect } from "./LiquidEffect";
import { RippleTransition } from "./RippleTransition";

// exposure, in linear light, ahead of the tone mapping
class ExposureEffect extends Effect {
  constructor() {
    super(
      "PJExposure",
      /* glsl */ `
      uniform float uExposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(inputColor.rgb * uExposure, inputColor.a);
      }`,
      { uniforms: new Map([["uExposure", new Uniform(1)]]) }
    );
  }
}

// Restrained: a little bloom for the orange light only (a high threshold, so
// the stone keeps every detail), neutral tone mapping so limestone stays
// limestone, a soft vignette. Exposure rises as the arrival opens up.
//
// Last, the pointer's liquid (world/fluid.js, LiquidEffect.js): a clear
// trail of water drawn over the whole picture, refracting it with a touch
// of chromatic dispersion, swirling and evaporating behind the cursor.
export default function PostFX() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const bloom = useRef();
  const vignette = useRef();
  const exposure = useMemo(() => new ExposureEffect(), []);
  const liquid = useMemo(() => new LiquidEffect(), []);
  const ripple = useMemo(() => new RippleTransition(), []);
  const sim = useMemo(() => new LiquidSim({ sim: 96, dye: 512, iterations: 14 }), []);
  // bloom costs a chain of blur passes even at zero strength: it is only in
  // the composer while it is turned up
  const [bloomOn, setBloomOn] = useState(T.bloom > 0);
  useEffect(() => attachPointer(), []);
  useEffect(
    () => () => {
      exposure.dispose();
      liquid.dispose();
      ripple.dispose();
      sim.dispose();
    },
    [exposure, liquid, ripple, sim]
  );
  useEffect(() => {
    sim.setAspect(size.width / Math.max(1, size.height));
  }, [sim, size]);

  useFrame((_, delta) => {
    if (T.bloom > 0 !== bloomOn) setBloomOn(T.bloom > 0);
    if (bloom.current) {
      bloom.current.intensity = T.bloom;
      bloom.current.luminanceMaterial.threshold = T.bloomThreshold;
    }
    if (vignette.current) vignette.current.darkness = T.vignette * (1 - C.white);
    exposure.uniforms.get("uExposure").value = T.exposure * (1 + C.bright * 0.45);

    // the liquid: stirred by a fine pointer, faded out as the page takes over
    // the ripple that opens onto the page
    ripple.uniforms.get("uP").value = C.white;
    ripple.uniforms.get("uAspect").value = size.width / Math.max(1, size.height);

    if (pointer.active) sim.pointer(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
    const on = T.liquid > 0 && C.white < 0.02 && sim.step(gl, delta, { radius: T.liquidRadius, force: T.liquidForce, ink: T.liquidInk, trail: T.liquidTrail, swirl: T.liquidSwirl, follow: T.liquidFollow });
    const u = liquid.uniforms;
    u.get("uOn").value = on ? 1 : 0;
    u.get("tThick").value = sim.thickness;
    u.get("tVel").value = sim.velocity;
    u.get("uTexel").value.copy(sim.dyeTexel);
    u.get("uStrength").value = T.liquid * (1 - C.white);
    u.get("uDispersion").value = T.liquidDispersion;
    u.get("uShine").value = T.liquidShine;
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {bloomOn ? <Bloom ref={bloom} mipmapBlur intensity={1.4} luminanceThreshold={1.5} luminanceSmoothing={0.4} radius={0.85} /> : <></>}
      <primitive object={exposure} dispose={null} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette ref={vignette} offset={0.3} darkness={0.32} />
      <SMAA />
      <primitive object={liquid} dispose={null} />
      <primitive object={ripple} dispose={null} />
    </EffectComposer>
  );
}
