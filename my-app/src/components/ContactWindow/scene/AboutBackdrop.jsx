"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects and uniforms are mutated imperatively inside useFrame, outside React's render. */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
// the about page's hero world — itself the forging-sand-dune-concept-v3
// hero's: its dunes, sky, rocks, blowing sand, sun and haze, as tuned there
import { createSharedUniforms, watchSandMap } from "@/components/ForgingSandDuneConceptV3/world/materials";
import { buildScatter, buildShards, createTerrainSampler } from "@/components/ForgingSandDuneConceptV3/world/layout";
import V3Sky from "@/components/ForgingSandDuneConceptV3/scene/Sky";
import V3Terrain, { buildTerrainGeometry } from "@/components/ForgingSandDuneConceptV3/scene/Terrain";
import V3Rocks, { buildRockSet } from "@/components/ForgingSandDuneConceptV3/scene/Rocks";
import FlyingIslands from "@/components/ForgingSandDuneConceptV3/scene/FlyingIslands";
import { SUN_DIR } from "@/components/ForgingSandDuneConceptV3/config";
import { T } from "@/components/ForgingSandDuneConceptV3/tuning";
import LightDust from "@/components/HyperiuxAbout/scene/LightDust";
import { BEAM_CENTRE } from "@/components/HyperiuxAbout/scene/EnergyBeams";
import { A } from "@/components/HyperiuxAbout/tuning";
import PortalCut from "./PortalCut";

// Behind the hands: the about page's hero, exactly — its world, from its
// opening shot (far out over the dunes, looking at where its centre beam
// stands), lit and finished as there (its bloom, ACES, vignette) — but
// without its beams of light, or anything after its hero (AboutScene.jsx).
// Its own canvas, under the hands' (which is transparent round them); the
// portal's glass discs cut through both alike (Reveal, sharing the hands'
// `look`: PortalCut), so the contact page shows through as before.

// the hero's camera before any scroll (AboutExperience.jsx createState)
const CAM = new THREE.Vector3(0, 20, 270);
const LOOK_Y = 26;
// V3's haze and the about page's backdrop behind its sky
const HAZE = new THREE.Color(0.62, 0.37, 0.21);
const DARK = new THREE.Color("#0b0706");
const NIGHT_HAZE = new THREE.Color(0.035, 0.042, 0.075);

function World({ look, quality }) {
  const shared = useMemo(() => createSharedUniforms(), []);
  useEffect(() => watchSandMap(shared), [shared]);
  const terrain = useMemo(() => createTerrainSampler(), []);
  const terrainGeometry = useMemo(() => buildTerrainGeometry(terrain, quality.terrainSegments), [terrain, quality.terrainSegments]);
  useEffect(() => () => terrainGeometry.dispose(), [terrainGeometry]);
  const rockSet = useMemo(() => {
    const shards = buildShards();
    return buildRockSet(shards, buildScatter(shards), terrain);
  }, [terrain]);
  const sky = useMemo(() => ({ uNight: shared.uNight, uTime: shared.uTime, uWhite: { value: 0 }, uWhiteLevel: { value: 1 } }), [shared]);
  const envSky = useMemo(() => ({ uNight: { value: 0 }, uWhite: { value: 0 }, uWhiteLevel: { value: 1 } }), []);
  const S = useMemo(() => ({ lit: 0 }), []);
  return (
    <>
      <Director look={look} shared={shared} />
      <V3Sky shared={sky} />
      <Environment frames={1} resolution={64}>
        <V3Sky shared={envSky} />
      </Environment>
      <V3Terrain shared={shared} geometry={terrainGeometry} />
      <Suspense fallback={null}>
        <V3Rocks rockSet={rockSet} shared={shared} />
      </Suspense>
      <FlyingIslands shared={shared} />
      <LightDust terrain={terrain} shared={shared} S={S} />
      <Sun shared={shared} quality={quality} />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur levels={5} intensity={A.bloomIntensity} luminanceThreshold={A.bloomThreshold} luminanceSmoothing={0.25} radius={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.32} darkness={A.vignette} />
        {/* (the portal's discs, as the hands' canvas has them) */}
        <PortalCut look={look} />
      </EffectComposer>
    </>
  );
}

// The about hero's Director, at its opening: V3's sand and haze, its day and
// night, and the camera — moved a little by the pointer, as there.
function Director({ look, shared }) {
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.FogExp2(HAZE.clone(), T.fogDensity), []);
  const bg = useMemo(() => DARK.clone(), []);
  const sway = useMemo(() => ({ x: 0, y: 0 }), []);
  useEffect(() => {
    scene.fog = fog;
    scene.background = bg;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog, bg]);
  useFrame((state, dt) => {
    const d = Math.min(dt, 0.1);
    shared.uTime.value += d;
    // (the hands' pointer, as they ease it)
    const on = look.pointer.z;
    sway.x = THREE.MathUtils.damp(sway.x, look.pointer.x * on, A.parallaxEase, d);
    sway.y = THREE.MathUtils.damp(sway.y, look.pointer.y * on, A.parallaxEase, d);
    const cam = state.camera;
    cam.position.set(CAM.x + sway.x * A.heroParallaxX, CAM.y + sway.y * A.heroParallaxY, CAM.z);
    cam.lookAt(BEAM_CENTRE.x, LOOK_Y, BEAM_CENTRE.z);
    shared.uRipple.value = T.rippleStrength;
    shared.uSandTex.value.x = T.sandRippleSize;
    shared.uSandTex.value.y = T.sandRippleDepth;
    shared.uCrackScale.value = T.crackScale;
    shared.uCrackDepth.value = T.crackDepth;
    const target = T.night ? 1 : 0;
    shared.uNight.value += (target - shared.uNight.value) * (1 - Math.exp(-2.4 * d));
    if (Math.abs(target - shared.uNight.value) < 1e-3) shared.uNight.value = target;
    const night = shared.uNight.value;
    fog.color.copy(HAZE).lerp(NIGHT_HAZE, night);
    fog.density = T.fogDensity;
    scene.environmentIntensity = T.envIntensity * (1 - night * 0.8);
  }, -10);
  return null;
}

// V3's low sunset sun (the about hero's), its shadow box following the view.
const NIGHT_SKY = new THREE.Color("#1d2a4d");
const NIGHT_GROUND = new THREE.Color("#0b0a12");
function Sun({ shared, quality }) {
  const sun = useRef(null);
  const hemi = useRef(null);
  const ambient = useRef(null);
  const { camera, scene, gl } = useThree();
  const focus = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const last = useRef("");
  const tmp = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    const target = sun.current?.target;
    if (target) scene.add(target);
    return () => {
      gl.shadowMap.autoUpdate = true;
      if (target) scene.remove(target);
    };
  }, [gl, scene]);
  useFrame(() => {
    const s = sun.current;
    if (!s) return;
    camera.getWorldDirection(fwd);
    focus.copy(camera.position).addScaledVector(fwd.setY(0).normalize(), 90);
    focus.set(Math.round(focus.x / 12) * 12, 0, Math.round(focus.z / 12) * 12);
    const key = `${focus.x},${focus.z}`;
    if (key !== last.current) gl.shadowMap.needsUpdate = true;
    last.current = key;
    s.target.position.copy(focus);
    s.position.copy(focus).addScaledVector(SUN_DIR, 320);
    s.target.updateMatrixWorld();
    const night = shared.uNight.value;
    s.intensity = THREE.MathUtils.lerp(T.sunIntensity, T.moonIntensity, night);
    s.color.set(T.sunColor).lerp(tmp.set(T.moonColor), night);
    if (hemi.current) {
      hemi.current.intensity = T.hemiIntensity * (1 - night) + 0.35 * night;
      hemi.current.visible = hemi.current.intensity > 0.001;
      hemi.current.color.set(T.hemiSky).lerp(NIGHT_SKY, night);
      hemi.current.groundColor.set(T.hemiGround).lerp(NIGHT_GROUND, night);
    }
    if (ambient.current) {
      ambient.current.intensity = T.nightAmbient * night;
      ambient.current.visible = ambient.current.intensity > 0.001;
      ambient.current.color.set(T.nightAmbientColor);
    }
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#8d99ad", "#6e3a1a", 0]} visible={false} />
      <ambientLight ref={ambient} args={["#8f8ea8", 0]} visible={false} />
      <directionalLight
        ref={sun}
        intensity={2.8}
        castShadow={quality.shadowMap > 0}
        shadow-mapSize={[quality.shadowMap || 512, quality.shadowMap || 512]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.06}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
        shadow-camera-near={10}
        shadow-camera-far={800}
      />
    </>
  );
}

// the about page's own quality settings (AboutExperience.jsx), by the hands'
// tier — but a lighter pixel ratio: here it is only the backdrop, under the
// hands, its haze and bloom soft anyway
const QUALITY = {
  low: { dpr: [0.75, 1], terrainSegments: 260, shadowMap: 1024 },
  full: { dpr: [1, 1.25], terrainSegments: 420, shadowMap: 2048 },
};

// Drawn on demand: every other frame while it is still (its dust and clouds
// drift slowly: 30 fps is plenty), every frame while the pointer moves it
// (the parallax stays smooth) — `run` off: not at all.
function Pace({ run, look, still }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!run) return;
    let raf;
    let n = 0;
    const last = { x: 0, y: 0 };
    const tick = () => {
      const p = look.pointer;
      const moving = Math.abs(p.x - last.x) + Math.abs(p.y - last.y) > 0.0005;
      last.x = p.x;
      last.y = p.y;
      // (reduced motion: only now and then, so what loads late still shows)
      if (still ? ++n % 30 === 0 : moving || ++n % 2 === 0) invalidate();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, look, invalidate, still]);
  return null;
}

export default function AboutBackdrop({ look, tier, run = true, still = false }) {
  const quality = tier?.name === "low" ? QUALITY.low : QUALITY.full;
  return (
    <Canvas
      frameloop="demand"
      dpr={quality.dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: true }}
      shadows="percentage"
      camera={{ position: [CAM.x, CAM.y, CAM.z], fov: 35, near: 0.5, far: 4000 }}
      aria-hidden
    >
      <Pace run={run} look={look} still={still} />
      <World look={look} quality={quality} />
    </Canvas>
  );
}
