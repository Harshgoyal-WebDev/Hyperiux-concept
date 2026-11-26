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
import PortalCut from "./PortalCut";
import { Dust } from "./Atmosphere";
import AboutBackdrop from "./AboutBackdrop";

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
      {/* (only the light that is truly bright blooms — the touch, its flash:
          over the about hero's lit dunes a low threshold put a haze of glow
          round the whole particle hand) */}
      <Bloom mipmapBlur intensity={tier.bloom} luminanceThreshold={1.0} luminanceSmoothing={0.2} radius={0.6} />
      {tier.chroma ? <ChromaticAberration offset={offset} radialModulation modulationOffset={0.25} /> : <></>}
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.06} />
      <Vignette offset={0.28} darkness={0.72} />
      {/* (last: the page beneath showing through as the glass opens — the
          about page's own transition) */}
      <PortalCut look={look} />
    </EffectComposer>
  );
}

function World({ data, stage, tier, still, look }) {
  const uniforms = useMemo(() => createSceneUniforms(), []);
  return (
    <>
      <Director stage={stage} look={look} uniforms={uniforms} still={still} dof={tier.dof} />
      {/* (the desert is the about hero's now, behind: AboutBackdrop) */}
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
  // (shared by both canvases: the hands' and the about hero's behind them)
  const look = useMemo(() => createLook(), []);
  // once the portal is open right across, nothing of either canvas shows: both
  // stop drawing until the scroll comes back (the stage's own progress, as
  // the timeline writes it)
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let raf;
    let was = false;
    const tick = () => {
      const now = (stage?.portal ?? 0) >= 0.9995;
      if (now !== was) {
        was = now;
        setOpen(now);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);
  const running = active && !open;
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
      {/* behind: the about page's hero world (its own canvas, as there) */}
      <div className="absolute inset-0">
        <AboutBackdrop look={look} tier={tier} run={running} still={still} />
      </div>
      <div className="absolute inset-0">
      <Canvas
        flat
        dpr={[tier.dpr[0], Math.min(tier.dpr[1], 1.5)]}
        frameloop={still ? "demand" : running ? "always" : "never"}
        gl={{ antialias: false, alpha: true, premultipliedAlpha: true, stencil: false, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 0.4, far: 6000, position: [0, 0, 60] }}
        aria-hidden
      >
        {/* (see-through round the hands: the about hero's world shows behind) */}
        {data && <World data={data} stage={stage} tier={tier} still={still} look={look} />}
        {data && <Ready onReady={onReady} />}
      </Canvas>
      </div>
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
