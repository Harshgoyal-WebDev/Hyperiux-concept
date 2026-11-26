"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { loadHands } from "../hand/loadHands";
import { createLook } from "./choreography";
import { createSceneUniforms } from "./uniforms";
import Director from "./Director";
import Hands from "./Hands";
import TouchEnergy from "./TouchEnergy";
import Reveal from "./Reveal";
import { Dust } from "./Atmosphere";
import { Ground, Rocks, Sky } from "./Desert";

// The Window's 3D scene (loaded lazily, client only): the canvas, the two
// hands, the energy of their touch, the portal and the travel through it,
// all driven by `stage` (the scroll's master timeline: timeline.js).
// `tier` (quality.js) sets the particle counts and what post-processing runs;
// `still` freezes it (reduced motion). The canvas stops drawing whenever it
// is off screen.

function Effects({ look, tier }) {
  const offset = useMemo(() => new THREE.Vector2(), []);
  useFrame(() => {
    const c = look.chroma * 0.0024;
    offset.set(c, c * 0.6);
  });
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={tier.bloom} luminanceThreshold={0.3} luminanceSmoothing={0.35} radius={0.72} />
      {tier.chroma ? <ChromaticAberration offset={offset} radialModulation modulationOffset={0.25} /> : <></>}
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.06} />
      <Vignette offset={0.28} darkness={0.72} />
      {/* (last: the page beneath showing through as the glass opens) */}
      <Reveal look={look} />
    </EffectComposer>
  );
}

function World({ data, stage, tier, still }) {
  const uniforms = useMemo(() => createSceneUniforms(), []);
  const look = useMemo(() => createLook(), []);
  return (
    <>
      <Director stage={stage} look={look} uniforms={uniforms} still={still} dof={tier.dof} />
      <Sky uniforms={uniforms} />
      <Ground uniforms={uniforms} tier={tier} />
      <Rocks uniforms={uniforms} />
      <Dust uniforms={uniforms} count={tier.dust} />
      <Hands data={data} look={look} uniforms={uniforms} gain={tier.handGain} />
      <TouchEnergy look={look} />
      <Effects look={look} tier={tier} />
    </>
  );
}

export default function Experience({ stage, tier, still = false, onReady }) {
  const [data, setData] = useState(null);
  const [active, setActive] = useState(true);
  const host = useRef(null);
  useEffect(() => {
    let live = true;
    loadHands(tier.particles).then(
      (d) => {
        if (live) setData(d);
      },
      (err) => console.error("[ContactWindow] the hand model failed to load:", err)
    );
    return () => {
      live = false;
    };
  }, [tier.particles]);
  // (nothing drawn while it's off screen)
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      <Canvas
        flat
        dpr={tier.dpr}
        frameloop={still ? "demand" : active ? "always" : "never"}
        gl={{ antialias: false, alpha: true, premultipliedAlpha: true, stencil: false, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 0.4, far: 6000, position: [0, 0, 60] }}
        aria-hidden
      >
        <color attach="background" args={["#050505"]} />
        {data && <World data={data} stage={stage} tier={tier} still={still} />}
        {data && <Ready onReady={onReady} />}
      </Canvas>
    </div>
  );
}

// (tells the page once the hands are built and drawn)
function Ready({ onReady }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onReady?.());
  });
  return null;
}
