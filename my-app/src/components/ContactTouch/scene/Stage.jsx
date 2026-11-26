"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects and uniforms are mutated imperatively inside useFrame, outside React's render. */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
// the desert: the forging-sand-dune-concept-v3 hero's world, as the about
// page's hero shows it (its dunes, sky, rocks, blowing sand, sun and haze)
import { createSharedUniforms, watchSandMap } from "@/components/ForgingSandDuneConceptV3/world/materials";
import { buildScatter, buildShards, createTerrainSampler } from "@/components/ForgingSandDuneConceptV3/world/layout";
import Sky from "@/components/ForgingSandDuneConceptV3/scene/Sky";
import Terrain, { buildTerrainGeometry } from "@/components/ForgingSandDuneConceptV3/scene/Terrain";
import Rocks, { buildRockSet } from "@/components/ForgingSandDuneConceptV3/scene/Rocks";
import DuneDust from "@/components/ForgingSandDuneConceptV3/scene/DuneDust";
import { createCutPass } from "@/components/ForgingSandDuneConceptV3/scene/CutTransition";
import { SUN_DIR } from "@/components/ForgingSandDuneConceptV3/config";
import { T } from "@/components/ForgingSandDuneConceptV3/tuning";
// ...and the about page's look over it, and its transition between scenes
import { A } from "@/components/HyperiuxAbout/tuning";
import { C } from "../tuning";
import Hands from "./Hands";

// The page's one canvas: the desert (the about page's opening shot — far out
// over the dunes), the two hands, and the change onto the contact section —
// the about page's own transition (V3's bunq glass discs, out from the
// centre), opening onto the page beneath instead of onto a next shot. All of
// it read from `story` (timeline.js), written by the page as it scrolls.

// the about hero's camera before any scroll (its AboutExperience createState)
const CAM = new THREE.Vector3(0, 20, 270);
const LOOK = new THREE.Vector3(0, 26, -14);
const HAZE = new THREE.Color(0.62, 0.37, 0.21);
// (by night — as the about hero has it)
const NIGHT_HAZE = new THREE.Color(0.035, 0.042, 0.075);
const NIGHT_SKY = new THREE.Color("#1d2a4d");
const NIGHT_GROUND = new THREE.Color("#0b0a12");
const SKY_BEHIND = new THREE.Color("#0b0706");

function Director({ pointer, anchor, shared }) {
  const { scene, camera } = useThree();
  const fog = useMemo(() => new THREE.FogExp2(HAZE.clone(), T.fogDensity), []);
  const sway = useMemo(() => ({ x: 0, y: 0 }), []);
  const touch = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    scene.fog = fog;
    scene.background = SKY_BEHIND;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);
  useFrame((state, dt) => {
    const d = Math.min(dt, 0.1);
    shared.uTime.value += d;
    // day ↔ night, eased over a second or so (the V3 world's own night)
    const target = C.night ? 1 : 0;
    shared.uNight.value += (target - shared.uNight.value) * (1 - Math.exp(-2.4 * d));
    if (Math.abs(target - shared.uNight.value) < 1e-3) shared.uNight.value = target;
    const night = shared.uNight.value;
    fog.color.copy(HAZE).lerp(NIGHT_HAZE, night);
    scene.environmentIntensity = T.envIntensity * (1 - night * 0.8);
    shared.uRipple.value = T.rippleStrength;
    shared.uSandTex.value.x = T.sandRippleSize;
    shared.uSandTex.value.y = T.sandRippleDepth;
    shared.uCrackScale.value = T.crackScale;
    shared.uCrackDepth.value = T.crackDepth;
    // the resting shot (the hands are placed against it), and the camera
    // moved off it a little by the pointer
    const a = anchor.current;
    a.fov = camera.fov;
    a.aspect = camera.aspect;
    a.position.copy(CAM);
    a.lookAt(LOOK);
    a.updateMatrixWorld();
    sway.x = THREE.MathUtils.damp(sway.x, pointer.x, A.parallaxEase, d);
    sway.y = THREE.MathUtils.damp(sway.y, pointer.y, A.parallaxEase, d);
    // (C.parallax × the about hero's: the hands are near, and move over the
    // land as near things do)
    camera.position.set(CAM.x + sway.x * A.heroParallaxX * C.parallax, CAM.y + sway.y * A.heroParallaxY * C.parallax, CAM.z);
    // (always looking at where the fingertips meet: it stays put on the screen,
    // the land moving round it — the hands only turning a little)
    const t = Math.tan(THREE.MathUtils.degToRad(a.fov / 2));
    touch.set(C.touchX * t * a.aspect * C.touchDepth, C.touchY * t * C.touchDepth, -C.touchDepth).applyMatrix4(a.matrixWorld);
    camera.lookAt(touch);
  }, -10);
  return null;
}

// V3's low sun — by night the moon, in the same place — its shadow box on
// the land ahead (drawn once: nothing on the land moves); the sky's light,
// and the night's soft fill (as the about hero has them)
function Sun({ quality, shared }) {
  const sun = useRef(null);
  const hemi = useRef(null);
  const ambient = useRef(null);
  const { scene, gl } = useThree();
  const tint = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    const s = sun.current;
    if (!s) return;
    const focus = new THREE.Vector3(0, 0, 180);
    s.target.position.copy(focus);
    s.position.copy(focus).addScaledVector(SUN_DIR, 320);
    scene.add(s.target);
    s.target.updateMatrixWorld();
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      scene.remove(s.target);
      gl.shadowMap.autoUpdate = true;
    };
  }, [scene, gl]);
  useFrame(() => {
    const night = shared.uNight.value;
    const s = sun.current;
    if (s) {
      s.intensity = THREE.MathUtils.lerp(T.sunIntensity, T.moonIntensity, night);
      s.color.set(T.sunColor).lerp(tint.set(T.moonColor), night);
    }
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

// The rocks by night: cool and dim under the moon (as the about hero has
// them). Their materials are V3's, shared: set back as they were on leaving.
function RockLook({ shared, children }) {
  const group = useRef(null);
  const mats = useMemo(() => new Map(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const moon = useMemo(() => new THREE.Color(), []);
  useEffect(
    () => () => {
      for (const [m, orig] of mats) m.color.copy(orig);
      mats.clear();
    },
    [mats]
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.traverse((o) => {
      if (o.isMesh && o.material?.color && !mats.has(o.material)) mats.set(o.material, o.material.color.clone());
    });
    moon.set(A.rockNight).multiplyScalar(A.rockNightBright);
    const night = shared.uNight.value;
    for (const [m, orig] of mats) m.color.copy(orig).multiply(tint.setRGB(1, 1, 1).lerp(moon, night));
  });
  return <group ref={group}>{children}</group>;
}

function useDesert(quality) {
  const shared = useMemo(() => createSharedUniforms(), []);
  useEffect(() => watchSandMap(shared), [shared]);
  const terrain = useMemo(() => createTerrainSampler(), []);
  const geometry = useMemo(() => buildTerrainGeometry(terrain, quality.terrainSegments), [terrain, quality.terrainSegments]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const rockSet = useMemo(() => {
    const shards = buildShards();
    return buildRockSet(shards, buildScatter(shards), terrain);
  }, [terrain]);
  const sky = useMemo(() => ({ uNight: shared.uNight, uTime: shared.uTime, uWhite: { value: 0 }, uWhiteLevel: { value: 1 } }), [shared]);
  const envSky = useMemo(() => ({ uNight: { value: 0 }, uWhite: { value: 0 }, uWhiteLevel: { value: 1 } }), []);
  return { shared, terrain, geometry, rockSet, sky, envSky };
}

// the change onto the contact section: the about page's transition, its
// settings (tuning.js trans*), opening onto the page beneath (uReveal)
function Cut({ story }) {
  const cut = useMemo(() => createCutPass(), []);
  useEffect(
    () => () => {
      cut.pass.dispose();
      cut.material.dispose();
    },
    [cut]
  );
  useFrame((state) => {
    const u = cut.uniforms;
    const { width, height } = state.size;
    u.uT.value = story.cut;
    u.uAspect.value = width / Math.max(height, 1);
    u.uTime.value = state.clock.elapsedTime;
    u.uStyle.value = 1;
    u.uBRes.value.set(width, Math.max(height, 1));
    u.uBCellPx.value = Math.max(C.transCellPx, 2);
    u.uBSpread.value = C.transSpread;
    u.uBJitter.value = C.transJitter;
    u.uBOvershoot.value = C.transOvershoot;
    u.uBRefract.value = C.transRefract;
    u.uBWobble.value = C.transWobble;
    u.uBBulge.value = C.transBulge;
    u.uBDir.value = C.transDir;
    u.uHold.value = 0;
    u.uReveal.value = 1;
    // (never switched off: it is the last pass — the one that draws to the
    // screen; until the discs start, its shader passes the frame straight on)
  });
  return <primitive object={cut.pass} dispose={null} />;
}

// (tells the page once everything is built and has been drawn)
function Ready({ onReady }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onReady?.());
  });
  return null;
}

// the bloom and vignette, live from the panel
function Look({ bloom, vignette }) {
  useFrame(() => {
    const b = bloom.current;
    if (b) {
      b.intensity = C.bloomIntensity;
      if (b.luminanceMaterial) b.luminanceMaterial.threshold = C.bloomThreshold;
    }
    if (vignette.current) vignette.current.darkness = C.vignette;
  });
  return null;
}

function World({ story, pointer, quality, onReady }) {
  const bloom = useRef(null);
  const vignette = useRef(null);
  const camera = useMemo(() => new THREE.PerspectiveCamera(35, 1, 0.5, 4000), []);
  const anchor = useRef(camera);
  const d = useDesert(quality);
  return (
    <>
      <Director pointer={pointer} anchor={anchor} shared={d.shared} />
      <Sky shared={d.sky} />
      <Environment frames={1} resolution={64}>
        <Sky shared={d.envSky} />
      </Environment>
      <Terrain shared={d.shared} geometry={d.geometry} />
      <RockLook shared={d.shared}>
        <Rocks rockSet={d.rockSet} shared={d.shared} />
      </RockLook>
      <DuneDust terrain={d.terrain} shared={d.shared} />
      <Sun quality={quality} shared={d.shared} />
      <Hands story={story} anchor={anchor} night={d.shared.uNight} pointer={pointer} />
      <Look bloom={bloom} vignette={vignette} />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom ref={bloom} mipmapBlur levels={5} intensity={C.bloomIntensity} luminanceThreshold={C.bloomThreshold} luminanceSmoothing={0.25} radius={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Cut story={story} />
        {/* (last: an effect pass — it hands the frame to the screen in the
            screen's colours; the transition's own shader pass, last, would
            leave it linear: dark and hard) */}
        <Vignette ref={vignette} offset={0.32} darkness={C.vignette} />
      </EffectComposer>
      <Ready onReady={onReady} />
    </>
  );
}

export default function Stage({ story, pointer, quality, running, onReady }) {
  return (
    <Canvas
      frameloop={running ? "always" : "never"}
      dpr={quality.dpr}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: true }}
      shadows="percentage"
      camera={{ position: [CAM.x, CAM.y, CAM.z], fov: 35, near: 0.5, far: 4000 }}
      // (it never takes the pointer: the contact section under it is live)
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <Suspense fallback={null}>
        <World story={story} pointer={pointer} quality={quality} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
