"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping, Vignette } from "@react-three/postprocessing";
import { Effect, EffectAttribute, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
// the forging-sand-dune-concept-v3 hero's own world: its dunes, sky, rocks,
// floating islands, blowing sand, sun and haze, as tuned there
import { createSharedUniforms, watchSandMap } from "@/components/ForgingSandDuneConceptV3/world/materials";
import { buildScatter, buildShards, createTerrainSampler } from "@/components/ForgingSandDuneConceptV3/world/layout";
import V3Sky from "@/components/ForgingSandDuneConceptV3/scene/Sky";
import V3Terrain, { buildTerrainGeometry } from "@/components/ForgingSandDuneConceptV3/scene/Terrain";
import V3Rocks, { buildRockSet } from "@/components/ForgingSandDuneConceptV3/scene/Rocks";
import FlyingIslands from "@/components/ForgingSandDuneConceptV3/scene/FlyingIslands";
import { SUN_DIR } from "@/components/ForgingSandDuneConceptV3/config";
import { T } from "@/components/ForgingSandDuneConceptV3/tuning";
import { LightPortrait } from "./LightPortrait";
import { BEAM_CENTRE, EnergyBeams, planStreaks } from "./EnergyBeams";
import { LightTerrain, TerrainParticles } from "./LightTerrain";
import { emptyPortraitTexture, fullMaskTexture, loadPortrait } from "./portraitMap";
import { TEAM } from "../content";
import { A, REBUILD_EVENT } from "../tuning";

// The one scene behind the whole experience. The opening is the V3 hero's
// world, at dusk; the light comes down into it out of the sky (EnergyBeams);
// as the person forms the world sinks into the dark, and the team is shown
// above the centre of it. Everything reads the shared uniforms (U); the
// Director writes them each frame from the state object (S) that the page's
// one scroll timeline and the team slider animate.
import { TEAM_LAYER, teamPose, teamStage } from "./stage";
import { TeamWorld, createCurtainMaterial } from "./TeamWorld";
import LightDust from "./LightDust";
import { BunqCutDriver, useBunqCut } from "./BunqCut";

function createUniforms(shared) {
  const u = (value) => ({ value });
  return {
    uTime: shared.uTime,
    uPixel: u(0.001),
    uLight: u(0),
    uWhite: u(0),
    uCurrents: u(0),
    uFlat: u(0),
    uFall: u(0),
    uFogColor: u(new THREE.Color()),
    uHoldRect: u(new THREE.Vector4(0, 0, 1, 1)),
    uHold: u(0),
    uResolution: u(new THREE.Vector2(1, 1)),
    uFogDensity: u(0.001),
    uBeams: u(1),
    uCenterBeam: u(1),
    uScan: u(-40),
    uScanGlow: u(0),
    uMap: u(null),
    uReveal: u(0),
    uDissolve: u(0),
    uMapB: u(null),
    uImage: u(null),
    uImageB: u(null),
    uImageAspect: u(0.8),
    uImageAspectB: u(0.8),
    uImageMask: u(null),
    uImageMaskB: u(null),
    uDepthA: u(null),
    uDepthB: u(null),
    uHasDepthA: u(0),
    uHasDepthB: u(0),
    uMorph: u(0),
    uMorphRing: u(0.66),
    uMorphGap: u(0.28),
    uRevealFly: u(0.35),
    uRevealLand: u(0.75),
    uRevealBlend: u(0.35),
    uPortraitIntensity: u(1),
    sway: { x: 0, y: 0 },
  };
}

// V3's haze, by day and by night (Rig.jsx), and its night lights
const HAZE = new THREE.Color(0.62, 0.37, 0.21);
const NIGHT_HAZE = new THREE.Color(0.035, 0.042, 0.075);
const NIGHT_SKY = new THREE.Color("#1d2a4d");
const NIGHT_GROUND = new THREE.Color("#0b0a12");
const DARK = new THREE.Color("#0b0706");
const EMBER_HAZE = new THREE.Color(0.075, 0.026, 0.01);
const tmpColor = new THREE.Color();
const FULL_MASK = fullMaskTexture();
const BG_WARM = new THREE.Color("#4a2d1c");
const BG_GLOW = new THREE.Color("#d9b893");

export default function AboutScene({ S, quality, reduced, onMissing }) {
  const shared = useMemo(() => createSharedUniforms(), []);
  useEffect(() => watchSandMap(shared), [shared]);
  const U = useMemo(() => createUniforms(shared), [shared]);
  // V3's land (the hero's); the team's stage is a place of its own
  // (TeamWorld.jsx: its own backdrop, on its own layer)
  const raw = useMemo(() => createTerrainSampler(), []);
  const stage = useMemo(() => teamStage((x, z) => raw.height(x, z)), [raw]);
  const terrain = raw;
  const terrainGeometry = useMemo(() => buildTerrainGeometry(terrain, quality.terrainSegments), [terrain, quality.terrainSegments]);
  useEffect(() => () => terrainGeometry.dispose(), [terrainGeometry]);
  const rockSet = useMemo(() => {
    const shards = buildShards();
    return buildRockSet(shards, buildScatter(shards), terrain);
  }, [terrain]);
  // (rebuilt when a count or shape is changed from the Leva panel)
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(REBUILD_EVENT, bump);
    return () => window.removeEventListener(REBUILD_EVENT, bump);
  }, []);
  const height = useMemo(() => (x, z) => terrain.height(x, z), [terrain]);
  const cut = useBunqCut();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the rebuild trigger
  const streaks = useMemo(() => planStreaks(height, Math.round(A.streakCount * quality.scale), stage), [height, quality.scale, version, stage]);
  const fibres = useMemo(
    () => ({ fibers: Math.round(A.beamFibers * quality.scale), reach: A.beamReach, column: A.beamColumn, bend: A.beamBend, top: A.beamHeight, width: A.beamFiberWidth, pool: A.beamPoolRadius }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the rebuild trigger
    [quality.scale, version]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the rebuild trigger
  const motes = useMemo(() => Math.round(A.motesCount * quality.scale), [quality.scale, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the rebuild trigger
  const morphParticles = useMemo(() => Math.round(A.portraitParticles * quality.scale), [quality.scale, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the rebuild trigger
  const teamLines = useMemo(() => Math.round(A.teamLines * (quality.scale < 1 ? 0.7 : 1)), [quality.scale, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the rebuild trigger
  const teamMotes = useMemo(() => Math.round(A.teamMotes * quality.scale), [quality.scale, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the rebuild trigger
  const columns = useMemo(() => Math.round(A.portraitColumns * (quality.scale < 1 ? 0.65 : 1)), [quality.scale, version]);
  // the sky's own uniforms (its "whiteout" grey is how it goes dark)
  const sky = useMemo(() => ({ uNight: shared.uNight, uTime: shared.uTime, uWhite: { value: 0 }, uWhiteLevel: { value: 1 } }), [shared]);
  const envSky = useMemo(() => ({ uNight: { value: 0 }, uWhite: { value: 0 }, uWhiteLevel: { value: 1 } }), []);
  const world = useRef(null);
  const curtain = useRef(null);
  // the dark drawing over the sky (and, as the land turns to light, a warm
  // haze low on the horizon behind the dunes — their ridges stand out on it)
  const curtainMaterial = useMemo(() => createCurtainMaterial(), []);
  useEffect(() => () => curtainMaterial.dispose(), [curtainMaterial]);

  const maps = useRef([]);
  const images = useRef([]);
  const empty = useMemo(() => emptyPortraitTexture(), []);
  useEffect(() => {
    let alive = true;
    Promise.all(TEAM.map(loadPortrait)).then((res) => {
      if (!alive) {
        res.forEach((r) => r.texture.dispose());
        return;
      }
      maps.current = res.map((r) => r.texture);
      images.current = res.map((r) => r.image);
      onMissing?.(res.map((r, i) => (r.missing ? TEAM[i] : null)).filter(Boolean));
    });
    return () => {
      alive = false;
      maps.current.forEach((t) => t.dispose());
      maps.current = [];
      images.current.forEach((t) => {
        t?.userData.mask?.dispose();
        t?.userData.depth?.dispose();
        t?.dispose();
      });
      images.current = [];
      empty.dispose();
    };
  }, [empty, onMissing]);

  return (
    <>
      <Director S={S} U={U} shared={shared} world={world} curtain={curtain} maps={maps} images={images} empty={empty} reduced={reduced} stage={stage} />
      <BunqCutDriver S={S} U={U} cut={cut} stage={stage} />
      <group ref={world}>
        <V3Sky shared={sky} />
        {/* the dark drawing over the sky as the team comes (the land goes into the haze) */}
        <mesh ref={curtain} renderOrder={-9} frustumCulled={false} material={curtainMaterial}>
          <sphereGeometry args={[2200, 32, 16]} />
        </mesh>
        <Environment frames={1} resolution={64}>
          <V3Sky shared={envSky} />
        </Environment>
        <V3Terrain shared={shared} geometry={terrainGeometry} />
        {/* ...turning into light as the streaks come down */}
        <LightTerrain U={U} geometry={terrainGeometry} />
        <TerrainParticles U={U} geometry={terrainGeometry} count={motes} />
        <RockLook S={S} shared={shared}>
          <Suspense fallback={null}>
            <V3Rocks rockSet={rockSet} shared={shared} />
          </Suspense>
        </RockLook>
        <FlyingIslands shared={shared} />
        <LightDust terrain={terrain} shared={shared} S={S} />
      </group>
      <Sun S={S} shared={shared} quality={quality} />
      <EnergyBeams U={U} streaks={streaks} fibres={fibres} height={height} />
      {/* the team's own scene (its own layer: never in the hero's shot, and nothing of the hero in its) */}
      <TeamWorld U={U} S={S} stage={stage} lines={teamLines} motes={teamMotes}>
        <LightPortrait U={U} columns={columns} segments={quality.segments} particles={quality.particles} morphParticles={morphParticles} stage={stage} S={S} />
      </TeamWorld>
      <Post S={S} U={U} cut={cut} />
    </>
  );
}

function Director({ S, U, shared, world, curtain, maps, images, empty, reduced, stage }) {
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.FogExp2(HAZE.clone(), T.fogDensity), []);
  const bg = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    scene.fog = fog;
    scene.background = bg;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog, bg]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.1);
    if (!reduced) shared.uTime.value += d;
    const sway = reduced ? 0 : 1;
    U.sway.x = THREE.MathUtils.damp(U.sway.x, S.px * sway, A.parallaxEase, d);
    U.sway.y = THREE.MathUtils.damp(U.sway.y, S.py * sway, A.parallaxEase, d);

    const cam = state.camera;
    // the hero's camera, flying on in over the land — until the bunq
    // transition has turned over to the team's stage: then the team camera
    // (moved round the portrait by the pointer: its depth shows in the parallax)
    // (each shot sees only its own scene: the hero's world on layer 0, the
    // team's on TEAM_LAYER — so once over, nothing of the hero remains)
    const team = S.cut >= 0.9995;
    if (team) {
      teamPose(stage, S, U.sway, cam);
    } else {
      // (moved by the pointer too, always looking at the centre beam: the
      // whole land moves round it, the beam held in the middle)
      const hx = U.sway.x * A.heroParallaxX;
      const hy = U.sway.y * A.heroParallaxY;
      cam.position.set(S.camX + hx, S.camY + hy, S.camZ);
      cam.lookAt(BEAM_CENTRE.x, S.tY, BEAM_CENTRE.z);
    }
    cam.layers.set(team ? TEAM_LAYER : 0);
    U.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / (state.size.height * state.gl.getPixelRatio());
    state.gl.getDrawingBufferSize(U.uResolution.value);

    // V3's sand, as its UniformSync keeps it
    shared.uRipple.value = T.rippleStrength;
    shared.uSandTex.value.x = T.sandRippleSize;
    shared.uSandTex.value.y = T.sandRippleDepth;
    shared.uCrackScale.value = T.crackScale;
    shared.uCrackDepth.value = T.crackDepth;

    // day ↔ night (V3's switch, eased over ~1.5 s as there)
    const target = T.night ? 1 : 0;
    shared.uNight.value += (target - shared.uNight.value) * (1 - Math.exp(-2.4 * d));
    if (Math.abs(target - shared.uNight.value) < 1e-3) shared.uNight.value = target;
    const night = shared.uNight.value;
    // V3's world as it is; sinking into the dark as the person forms (S.dark)
    // (the haze turns dark first, then thickens: never through a pale fog)
    const dark = S.dark;
    // as the land turns to light, the dusk deepens round it so the light
    // carries (the sky dims, the haze darkens)
    const lit = THREE.MathUtils.smoothstep(S.fall, 0.05, 0.85);
    S.lit = lit;
    // (a warm dark haze between the dune layers once the land is light)
    fog.color.copy(HAZE).lerp(NIGHT_HAZE, night).lerp(tmpColor.set(A.hazeColor).multiplyScalar(0.5).lerp(EMBER_HAZE, 0.5), lit).lerp(DARK, Math.min(dark * 2.2, 1));
    fog.density = THREE.MathUtils.lerp(THREE.MathUtils.lerp(T.fogDensity, A.hazeDensity, lit), 0.1, dark * dark);
    // (the team's own ridges come in once it is the shot, as it settles)
    S.ridges = lit * (1 - dark) * (team ? THREE.MathUtils.smoothstep(dark, 0.02, 0.2) : 1);
    U.uFogColor.value.copy(fog.color);
    U.uFogDensity.value = fog.density;
    scene.environmentIntensity = T.envIntensity * (1 - night * 0.8) * (1 - dark * 0.9) * (1 - lit * 0.6);
    if (curtain.current) {
      const cu = curtain.current.material.uniforms;
      cu.uOpacity.value = Math.max(lit * A.skyDark, Math.min(dark * 1.6, 1));
      cu.uGlow.value = lit * (1 - dark) * A.horizonGlow;
    }
    if (world.current) world.current.visible = dark < 0.995 && !team;
    bg.copy(DARK);
    if (S.light > 0) bg.lerp(BG_WARM, Math.min(S.light * 2, 1)).lerp(BG_GLOW, Math.max(S.light * 2 - 1, 0));

    U.uFall.value = S.fall;
    U.uBeams.value = S.beams;
    // (the centre beam stays: the team stands at its own stage, behind it)
    U.uCenterBeam.value = 1;
    U.uCurrents.value = S.currents;
    U.uFlat.value = S.flat;
    // (the forming held back a while into the transition, then eased)
    const rv = THREE.MathUtils.clamp((S.reveal - A.revealDelay) / Math.max(1 - A.revealDelay, 0.05), 0, 1);
    U.uReveal.value = rv * rv * (3 - 2 * rv);
    U.uDissolve.value = S.exit;

    U.uLight.value = S.light;
    // (the white is Post's line-by-line wipe over the scene as it is — the
    // scene itself never fades down under it)
    U.uWhite.value = 0;
    const slider = S.sScanGlow > S.scanGlow;
    U.uScan.value = slider ? S.sScan : S.scan;
    U.uScanGlow.value = slider ? S.sScanGlow : S.scanGlow;
    U.uMap.value = maps.current[S.member] || empty;
    // (changing member: the strands re-forming from one face into the next)
    U.uMapB.value = maps.current[S.morphTo] || U.uMap.value;
    U.uMorph.value = S.morph;
    U.uMorphRing.value = A.swapRing;
    U.uMorphGap.value = A.swapGap;
    U.uRevealFly.value = A.revealFly;
    U.uRevealLand.value = A.revealLand;
    U.uRevealBlend.value = A.revealBlend;
    U.uImage.value = images.current[S.member] || null;
    U.uImageB.value = images.current[S.morphTo] || U.uImage.value;
    U.uImageAspect.value = U.uImage.value?.userData.aspect || 0.8;
    U.uImageAspectB.value = U.uImageB.value?.userData.aspect || 0.8;
    U.uImageMask.value = U.uImage.value?.userData.mask || FULL_MASK;
    U.uImageMaskB.value = U.uImageB.value?.userData.mask || FULL_MASK;
    U.uDepthA.value = U.uImage.value?.userData.depth || FULL_MASK;
    U.uDepthB.value = U.uImageB.value?.userData.depth || FULL_MASK;
    U.uHasDepthA.value = U.uImage.value?.userData.depth ? 1 : 0;
    U.uHasDepthB.value = U.uImageB.value?.userData.depth ? 1 : 0;
  }, -10);
  return null;
}

// The rocks: V3's lit them by day and by night alike (its night keeps a
// strong fill for the sand); here, by night they go cool and dim under the
// moon, and once the land has turned to light they stand as near-black forms
// (the ridge lines catch their edges). (Their materials are V3's, shared:
// set back as they were on leaving.)
const ROCK_NIGHT = new THREE.Color();
function RockLook({ S, shared, children }) {
  const group = useRef(null);
  const mats = useMemo(() => new Map(), []);
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
      if (o.isMesh && o.material && !mats.has(o.material)) mats.set(o.material, o.material.color.clone());
    });
    const night = shared.uNight.value;
    const lit = S.lit || 0;
    ROCK_NIGHT.set(A.rockNight).multiplyScalar(A.rockNightBright);
    for (const [m, orig] of mats) m.color.copy(orig).multiply(tmpColor.setRGB(1, 1, 1).lerp(ROCK_NIGHT, night)).multiplyScalar(THREE.MathUtils.lerp(1, A.rockLit, lit));
  });
  return <group ref={group}>{children}</group>;
}

// V3's low sunset sun, its shadow box following the view (redrawn only when
// it moves on its grid).
function Sun({ S, shared, quality }) {
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
    // (at night the same key light is the moon, as in V3)
    const night = shared.uNight.value;
    s.intensity = THREE.MathUtils.lerp(T.sunIntensity, T.moonIntensity, night) * (1 - S.dark) * (1 - (S.lit || 0) * 0.7);
    s.color.set(T.sunColor).lerp(tmp.set(T.moonColor), night);
    if (hemi.current) {
      hemi.current.intensity = (T.hemiIntensity * (1 - night) + 0.35 * night) * (1 - S.dark);
      hemi.current.visible = hemi.current.intensity > 0.001;
      hemi.current.color.set(T.hemiSky).lerp(NIGHT_SKY, night);
      hemi.current.groundColor.set(T.hemiGround).lerp(NIGHT_GROUND, night);
    }
    if (ambient.current) {
      ambient.current.intensity = T.nightAmbient * night * (1 - S.dark);
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

// ---------------------------------------------------------------------------
// After tone mapping: the white — light flooding down the strands, the finer and
// broader streaks first, from the centre out, until the frame is pure white.
// ---------------------------------------------------------------------------
const FINISH = /* glsl */ `
  uniform float uAmount;
  uniform float uExposure;
  float h1(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb * uExposure;
    if (uAmount > 0.0) {
      float fine = h1(floor(uv.x * 260.0));
      float broad = h1(floor(uv.x * 22.0) + 3.0);
      float centre = 1.0 - abs(uv.x - 0.5) * 2.0;
      float lead = fine * 0.3 + broad * 0.35 + centre * 0.55 - 0.6 + (uv.y - 0.5) * 0.15;
      // (each line turning quickly — straight from the scene to a warm
      // light, never through a grey half-way)
      float w = smoothstep(0.32, 0.68, uAmount * 1.8 - 0.45 + lead * (1.0 - uAmount));
      // (each line cut out of the frame — the page behind showing through,
      // "Why partner with us?" — a warm light on it as it goes)
      float a = 1.0 - w;
      a *= 1.0 - smoothstep(0.92, 1.0, uAmount);
      c = mix(c, vec3(1.0, 0.86, 0.74), w * (1.0 - w) * 2.0);
      // (premultiplied, for the canvas)
      outputColor = vec4(c * a, inputColor.a * a);
      return;
    }
    outputColor = vec4(c, inputColor.a);
  }
`;
// ---------------------------------------------------------------------------
// The dunes' ridge lines, from depth: wherever a nearer surface's edge meets
// something farther behind (the next dune, the sky), a line of light along
// it, a soft glow round it — hottest where it is sharpest. Before tone
// mapping (HDR, like the light it is).
// ---------------------------------------------------------------------------
const RIDGES = /* glsl */ `
  uniform float uAmount;
  uniform float uCore;
  uniform float uHalo;
  uniform float uThr;
  uniform float uFar; // (no ridge lines beyond: in the team's shot, none on its skyline)
  // 1 / depth: flat for any plane on screen (its second difference is 0), so
  // only true breaks — a dune's edge over what lies behind it, or its crest
  // — register, however wide the look
  float inv(vec2 uv) { return 1.0 / max(-getViewZ(readDepth(uv)), 0.01); }
  float bend(float ic, vec2 uv, vec2 o) {
    float a = inv(uv + o * texelSize);
    float b = inv(uv - o * texelSize);
    return abs(2.0 * ic - a - b) / max(max(ic, a), b);
  }
  float edgeAt(float ic, vec2 uv, float r, float thr, float k) {
    float m = max(max(bend(ic, uv, vec2(r, 0.0)), bend(ic, uv, vec2(0.0, r))), max(bend(ic, uv, vec2(0.7, 0.7) * r), bend(ic, uv, vec2(0.7, -0.7) * r)));
    return clamp((m - thr) * k, 0.0, 1.0);
  }
  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    if (uAmount <= 0.001) {
      outputColor = inputColor;
      return;
    }
    float ic = inv(uv);
    float core = edgeAt(ic, uv, 1.2, uThr, 5.0);
    // (a soft falloff: many narrow steps, each a little dimmer)
    float halo = edgeAt(ic, uv, 2.5, 0.08, 3.0) * 0.32 + edgeAt(ic, uv, 4.5, 0.08, 3.0) * 0.24 + edgeAt(ic, uv, 7.0, 0.09, 3.0) * 0.17
      + edgeAt(ic, uv, 11.0, 0.1, 3.0) * 0.11 + edgeAt(ic, uv, 16.0, 0.11, 3.0) * 0.07;
    // (softer far off)
    float dC = 1.0 / ic;
    float fade = (1.0 - smoothstep(350.0, 1000.0, dC) * 0.55) * (1.0 - smoothstep(uFar * 0.45, uFar, dC));
    vec3 orange = vec3(1.0, 0.114, 0.0);
    vec3 hot = vec3(1.0, 0.42, 0.12);
    vec3 glow = mix(orange, hot, core * core) * (core * uCore + halo * uHalo) * fade;
    outputColor = vec4(inputColor.rgb + glow * uAmount, inputColor.a);
  }
`;
class RidgeEffect extends Effect {
  constructor() {
    super("RidgeEffect", RIDGES, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ["uAmount", new THREE.Uniform(0)],
        ["uCore", new THREE.Uniform(3.4)],
        ["uHalo", new THREE.Uniform(1.6)],
        ["uThr", new THREE.Uniform(0.06)],
        ["uFar", new THREE.Uniform(1e6)],
      ]),
    });
  }
}

class FinishEffect extends Effect {
  constructor() {
    super("FinishEffect", FINISH, {
      uniforms: new Map([
        ["uAmount", new THREE.Uniform(0)],
        ["uExposure", new THREE.Uniform(1)],
      ]),
    });
  }
}

function Post({ S, U, cut }) {
  const finish = useMemo(() => new FinishEffect(), []);
  const ridges = useMemo(() => new RidgeEffect(), []);
  useEffect(() => () => ridges.dispose(), [ridges]);
  const bloom = useRef(null);
  const vignette = useRef(null);
  useEffect(() => () => finish.dispose(), [finish]);
  useFrame(() => {
    finish.uniforms.get("uAmount").value = S.white;
    ridges.uniforms.get("uAmount").value = (S.ridges || 0) * A.ridgeIntensity;
    ridges.uniforms.get("uCore").value = A.ridgeCore;
    ridges.uniforms.get("uHalo").value = A.ridgeHalo;
    ridges.uniforms.get("uThr").value = A.ridgeThreshold;
    // (the team's shot: its near land's ridges only — never a line along its
    // horizon, which runs level with the portrait's face)
    ridges.uniforms.get("uFar").value = S.cut >= 0.9995 ? 180 : 1e6;
    const b = bloom.current;
    if (b) {
      // V3's bloom over its world; the portrait's softer glow in the dark
      // (V3's bloom over the hero; the team's own over its shot — its
      // portrait images carry their glow already, so only their brightest
      // lines bloom)
      const team = THREE.MathUtils.smoothstep(S.cut, 0.3, 1);
      b.intensity = THREE.MathUtils.lerp(A.bloomIntensity, A.teamBloomIntensity, team) + S.light;
      if (b.luminanceMaterial) b.luminanceMaterial.threshold = THREE.MathUtils.lerp(A.bloomThreshold, A.teamBloomThreshold, team);
    }
    if (vignette.current) vignette.current.darkness = THREE.MathUtils.lerp(A.vignette, A.teamVignette, THREE.MathUtils.smoothstep(S.cut, 0.3, 1)) * (1 - U.uLight.value * 0.8);
  });
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {/* (the ridge lines on each shot's own frame, before the bunq transition
      mixes in the next: never the hero's ridges over the team's shot) */}
      <primitive object={ridges} dispose={null} />
      {/* (the bunq transition next: the glow then comes from the frame as cut) */}
      <primitive object={cut.pass} dispose={null} />
      <Bloom ref={bloom} mipmapBlur levels={5} intensity={0.9} luminanceThreshold={1.05} luminanceSmoothing={0.25} radius={0.5} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette ref={vignette} offset={0.32} darkness={0.62} />
      <primitive object={finish} dispose={null} />
    </EffectComposer>
  );
}
