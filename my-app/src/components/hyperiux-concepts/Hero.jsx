"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Leva, useControls, useCreateStore } from "leva";
import * as THREE from "three";
import Terrain from "./Terrain";
import LakeSurface from "./LakeSurface";
import HyperiuxLogoModel from "./HyperiuxLogoModel";
import LogoSparkles from "./LogoSparkles";
import Pebbles from "./Pebbles";
import Rocks from "./Rocks";
import Parallax from "./Parallax";
import Starfield from "./Starfield";
import SkyGradient from "./SkyGradient";
import RidgeFog from "./RidgeFog";
import GroundFog from "./GroundFog";
import ScrollCameraRig from "./ScrollCameraRig";
import PortalRenderer from "./PortalRenderer";
import PortalRidgePlaneScene from "./PortalRidgePlaneScene";
import { createWetnessMaps } from "./wetnessTexture";
import { OrbitControls } from "@react-three/drei";

const SUN_DIRECTION = [-14, 18, -8];
// Two extra directional lights beyond the main sun, from clearly different
// angles (opposite side, and low from the front) so the terrain/cuboid
// pick up separate highlight/fill directions instead of everything being
// lit from one side only.
const FILL_DIRECTION = [16, 10, 6];
const RIM_DIRECTION = [0, 4, 20];
const LOGO_POSITION = [0, 6.7, 0];

// Folders we're not tuning right now — still return their default values
// (so the scene is unchanged), just not shown in the Leva panel.
const HIDDEN_FOLDER = { render: () => false };

// A static, orbit-able showcase of the lake/cuboid environment — the same
// terrain/lake/cuboid/stars/lighting setup as the scroll-driven Concepts
// Hero, minus the portal snap, tunnel flythrough, screen flash and
// warp-speed post effects built for that scroll sequence. This is just the
// diorama itself, always fully rendered, navigated with OrbitControls
// instead of scroll.
//
// The scrollable page is four back-to-back stretches: the first (0..
// CAMERA_VH) is the half-revolution camera arc around the logo (see
// ScrollCameraRig); then a dead zone (CAMERA_VH..CAMERA_VH+DEAD_VH) where
// scrolling does nothing — the camera arc has already finished (clamped at
// 1) and the portal hasn't started yet (still clamped at 0) — a deliberate
// pause before the reveal; then the shockwave portal (see
// PortalRenderer.jsx) opens over the live scene, revealing the ridge-plane
// scene (cylinder + glass panels, see PortalRidgePlaneScene.jsx) in its
// place; then, once that reveal has fully finished, the LAST stretch is
// the ridge scene's own scroll-driven choreography (camera stepping down
// through each panel) — the same scroll behavior RidgePlane.jsx drives on
// its own standalone page, here reusing this page's single scroll
// container instead of a second one.
const CAMERA_VH = 200;
const DEAD_VH = 50;
const PORTAL_VH = 100;
const RIDGE_VH = 150;
const TOTAL_VH = CAMERA_VH + DEAD_VH + PORTAL_VH + RIDGE_VH;
const CAMERA_FRACTION = CAMERA_VH / TOTAL_VH;
const PORTAL_START_FRACTION = (CAMERA_VH + DEAD_VH) / TOTAL_VH;
// Was "1 - PORTAL_START_FRACTION" (correct only because the portal used to
// be the LAST stretch, so "everything remaining" and "the portal's own
// span" were the same fraction) — now that RIDGE_VH follows it, those two
// are different, so the portal's own progress needs its own explicit end
// fraction instead of silently stretching across the ridge stretch too.
const PORTAL_END_FRACTION = (CAMERA_VH + DEAD_VH + PORTAL_VH) / TOTAL_VH;
// How far BEFORE the portal finishes expanding the ridge scene starts its
// own scroll motion, as a fraction of PORTAL_VH (0.3 = starts at 70% of
// the portal's expansion). 0 = waits until the portal is fully open.
const RIDGE_OVERLAP = 0.7;
const RIDGE_START_FRACTION =
  (CAMERA_VH + DEAD_VH + PORTAL_VH * (1 - RIDGE_OVERLAP)) / TOTAL_VH;

// Fades Bloom's intensity to 0 across the portal's own reveal — the bloom
// is tuned for the hero's glow and would otherwise wash out the ridge
// scene's bright video panels. Driven per-frame through the effect's own
// `intensity` setter rather than a React prop, so scrolling doesn't
// re-render anything.
// Also eases the Vignette's darkness from `vignetteStart` to `vignetteEnd`
// on the same curve — the heavy hero vignette otherwise crushes the ridge
// scene's corners.
function PostFade({ bloomRef, vignetteRef, progressRef, baseIntensity, vignetteStart, vignetteEnd }) {
  useFrame(() => {
    const p = THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1);
    const t = THREE.MathUtils.smoothstep(p, 0, 1);
    const bloom = bloomRef.current;
    if (bloom) bloom.intensity = baseIntensity * (1 - t);
    const vignette = vignetteRef.current;
    if (vignette) vignette.darkness = THREE.MathUtils.lerp(vignetteStart, vignetteEnd, t);
  });
  return null;
}

// `showLeva` is just the initial state — pressing "h" toggles it live
// regardless (see the effect below), so a caller can start it hidden for
// a clean embed while still leaving the tuning panel a keystroke away.
export default function Hero({ showLeva: showLevaProp = true }) {
  // A second, independent Leva store/panel just for the ridge-plane scene
  // (see PortalRidgePlaneScene.jsx, which uses this via its `store` prop
  // on every one of its own useControls calls) — that scene alone has 7
  // folders' worth of controls, which was making the single shared panel
  // unwieldy alongside the hero environment's own dozen-plus folders.
  const ridgeStore = useCreateStore();
  const bloomRef = useRef(null);
  const vignetteRef = useRef(null);

  // Canvas textures need document/canvas, which don't exist during SSR —
  // build them client-side only, after mount.
  const [wetnessMaps, setWetnessMaps] = useState(null);
  useEffect(() => {
    setWetnessMaps(createWetnessMaps({ seed: 3, scale: 6, contrast: 1.4 }));
  }, []);

  const [showLeva, setShowLeva] = useState(showLevaProp);
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't hijack "h" while the user is typing into one of Leva's own
      // text/number fields (or anything else editable on the page).
      const el = event.target;
      const isEditable =
        el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable;
      if (isEditable) return;
      if (event.key.toLowerCase() === "h") {
        setShowLeva((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Plain DOM scroll progress (0..1 across the scrollable container),
  // written outside React state so the camera/portal rigs can read it
  // every frame without a re-render triggering on every scroll pixel —
  // same pattern as the scroll-driven Concepts page this was copied from.
  // `cameraProgressRef`/`portalProgressRef`/`ridgeProgressRef` are the same
  // overall scroll fraction remapped to each stretch's own local 0..1
  // range, so the camera arc finishes exactly at CAMERA_VH, the portal
  // doesn't start opening until scroll actually enters its own stretch,
  // and the ridge scene's own scroll choreography doesn't start until the
  // portal has fully finished opening.
  const scrollContainerRef = useRef(null);
  const cameraProgressRef = useRef(0);
  const portalProgressRef = useRef(0);
  const ridgeProgressRef = useRef(0);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = scrollable > 0 ? -rect.top / scrollable : 0;
      const clamped = THREE.MathUtils.clamp(progress, 0, 1);
      cameraProgressRef.current = THREE.MathUtils.clamp(clamped / CAMERA_FRACTION, 0, 1);
      portalProgressRef.current = THREE.MathUtils.clamp(
        (clamped - PORTAL_START_FRACTION) / (PORTAL_END_FRACTION - PORTAL_START_FRACTION),
        0,
        1
      );
      ridgeProgressRef.current = THREE.MathUtils.clamp(
        (clamped - RIDGE_START_FRACTION) / (1 - RIDGE_START_FRACTION),
        0,
        1
      );
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  // Tracked outside R3F (plain window listener) and handed to <Parallax>
  // as `pointerRef` — the hero content now lives inside PortalRenderer's
  // portaled `bgScene` for the shockwave compositing, and a portaled
  // scene's own `state.pointer` never actually updates (see Parallax.jsx),
  // so cursor-driven parallax needs its own real pointer source instead.
  const pointerRef = useRef(new THREE.Vector2(0, 0));
  useEffect(() => {
    const handlePointerMove = (event) => {
      pointerRef.current.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
    };
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  // A valley, not a busy mountain range: a wide, genuinely deep flat basin
  // in the middle (big enough and deep enough for a real lake), ramping up
  // through open ground into just a handful of big, smooth surrounding
  // peaks — closer to a quiet valley flanked by a couple of large mountain
  // masses than a jagged ring of many small summits.
  const terrain = useControls("Terrain", {
    groundSize: { value: 200, min: 40, max: 240, step: 5 },
    height: { value: 14.4, min: 0.5, max: 24, step: 0.2, label: "peak height" },
    basinRadius: { value: 8.0, min: 0, max: 60, step: 0.5, label: "lake basin radius" },
    basinDepth: { value: 7.9, min: 0.5, max: 10, step: 0.1, label: "lake basin depth" },
    // ruggedness/ridgeSharpness/ridgedFrequency were previously flattened
    // to nearly zero (ridgeSharpness=0 makes Math.pow(x,0)=1, a flat
    // plateau; ridgedFrequency=0 makes that term's own noise constant) —
    // the ridged term was effectively disabled, so every peak was pure
    // smooth "rolling" noise with no sharp crests. These bring it back in
    // at a moderate level: pointed but not jagged mountain-game spikes.
    ruggedness: { value: 0.52, min: 0, max: 1, step: 0.01 },
    ridgeSharpness: { value: 1.1, min: 0.0, max: 3, step: 0.05 },
    warpStrength: { value: 1.2, min: 0, max: 8, step: 0.1 },
    // The actual "how many peaks" knob — much lower than a busy mountain
    // range so only a few big, broad landforms fit across the terrain
    // instead of a dense field of small bumps (see terrainNoise.js).
    rollingFrequency: { value: 0.02, min: 0, max: 0.05, step: 0.001, label: "landform size (rolling)" },
    ridgedFrequency: { value: 0.022, min: 0, max: 0.05, step: 0.001, label: "peak spacing (ridged)" },
    transitionWidth: {
      value: 25,
      min: 0,
      max: 60,
      step: 1,
      label: "peak ramp distance",
    },
    color: "#000000",
    roughness: { value: 1.0, min: 0, max: 1, step: 0.01 },
    grainIntensity: { value: 0.31, min: 0, max: 1, step: 0.01, label: "grain intensity" },
    grainScale: { value: 0.9, min: 0.2, max: 20, step: 0.1, label: "grain tile size" },
    dirtScale: { value: 40, min: 1, max: 40, step: 0.5, label: "dirt texture tile size" },
    dirtBumpScale: { value: 2.0, min: 0, max: 2, step: 0.02, label: "dirt relief depth" },
    rockColor: { value: "#000000", label: "bare rock tint" },
    // Tightened slightly so the now-sharper peaks/faces actually pick up
    // the bare-rock tint instead of staying dirt-toned right up to the
    // crest — real sharp peaks go bare rock well before the very tip.
    rockSlopeStart: { value: 0.45, min: 0, max: 1, step: 0.01, label: "rock: slope start" },
    rockSlopeEnd: { value: 0.62, min: 0, max: 1, step: 0.01, label: "rock: slope end" },
    rockStriationScale: { value: 16, min: 2, max: 40, step: 0.5, label: "rock: groove tile size" },
    rockStriationIntensity: { value: 1.45, min: 0, max: 2, step: 0.05, label: "rock: groove depth" },
    rockStriationStretch: { value: 2.0, min: 1, max: 10, step: 0.1, label: "rock: groove stretch" },
  });

  const rocks = useControls("Rocks", {
    count: { value: 190, min: 0, max: 80, step: 1 },
    minScale: { value: 0.5, min: 0.1, max: 2, step: 0.05 },
    maxScale: { value: 1.6, min: 0.2, max: 4, step: 0.05 },
    color: "#1c1c1a",
    roughness: { value: 0.5, min: 0, max: 1, step: 0.01 },
    clearcoat: { value: 0.55, min: 0, max: 1, step: 0.01 },
    clearcoatRoughness: { value: 0.18, min: 0, max: 1, step: 0.01 },
    normalScale: { value: 0.5, min: 0, max: 2, step: 0.05 },
  }, HIDDEN_FOLDER);

  const pebbles = useControls("Pebbles", {
    count: { value: 760, min: 0, max: 800, step: 10 },
    color: "#141613",
    roughness: { value: 0.55, min: 0, max: 1, step: 0.01 },
    clearcoat: { value: 0.5, min: 0, max: 1, step: 0.01 },
    clearcoatRoughness: { value: 0.2, min: 0, max: 1, step: 0.01 },
  }, HIDDEN_FOLDER);

  const lake = useControls("Lake", {
    // Sized to actually fill the basin (see Terrain above, basinRadius) —
    // everything else here is unchanged from before.
    size: { value: 47, min: 10, max: 160, step: 1, label: "spread" },
    deepColor: "#2a2a2a",
    shallowColor: "#2a2a2a",
    glowColor: "#ff7000",
    opacity: { value: 1, min: 0.3, max: 1, step: 0.01 },
    reflectivity: { value: 0.4, min: 0, max: 1, step: 0.02 },
    heightScale: { value: 1.5, min: 0, max: 2, step: 0.05 },
    reflectionBend: { value: 1.18, min: 0, max: 2, step: 0.02 },
    viscosity: { value: 0.91, min: 0.9, max: 0.999, step: 0.001 },
    mouseSize: { value: 0.03, min: 0.01, max: 0.3, step: 0.005 },
    mouseIntensity: { value: 0.2, min: 0, max: 1, step: 0.01, label: "click intensity" },
    // A continuous train of concentric ripples expanding outward from a
    // fixed point on the lake, like a slow drip constantly feeding the
    // surface — no pointer needed (see waterSimulation.js).
    rippleStrength: { value: 0.03, min: 0, max: 0.4, step: 0.005, label: "ripple: strength" },
    rippleFrequency: {
      value: 400,
      min: 5,
      max: 400,
      step: 1,
      label: "ripple: density (1/wavelength)",
    },
    rippleSpeed: { value: 10, min: 0, max: 20, step: 0.1, label: "ripple: outward speed" },
    rippleDecay: {
      value: 0.0,
      min: 0,
      max: 10,
      step: 0.05,
      label: "ripple: fade with distance",
    },
    rippleOriginX: { value: 0.77, min: 0, max: 1, step: 0.01, label: "ripple: origin X (UV)" },
    rippleOriginY: { value: 0.0, min: 0, max: 1, step: 0.01, label: "ripple: origin Y (UV)" },
    hoverIntensityRatio: { value: 0.35, min: 0, max: 1, step: 0.05, label: "hover ripple strength" },
    hoverFadeSpeed: { value: 6, min: 0.5, max: 20, step: 0.5, label: "hover fade speed" },
    clickBurstDuration: { value: 0.05, min: 0.05, max: 1, step: 0.01, label: "click burst length" },
    // Raised from the old 60/0.15 — the directional-light glint riding
    // each ripple's slope was barely visible; a lower power spreads the
    // highlight wider (easier to actually catch) and the higher intensity
    // makes it read clearly instead of needing to look closely for it.
    // The lake's own baked-in sun glint (see LakeSurface's fragment shader)
    // — NOT driven by the scene lights. At the old power 36 in the
    // near-white directional color, the highlight lobe was so wide that
    // whenever the camera faced the sun direction, a huge part of the lake
    // washed out silver. A tight power keeps it to sparkles on ripple
    // crests; its own warm color keeps it from ever reading as silver.
    specularPower: { value: 220, min: 4, max: 600, step: 1 },
    specularIntensity: { value: 1.2, min: 0, max: 3, step: 0.05 },
    specularColor: { value: "#ff9a4a", label: "specular (glint) color" },
    glowReflectionStrength: {
      value: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
      label: "cuboid/beam reflection strength",
    },
    reflectionResolution: {
      value: 512,
      options: [256, 512, 1024],
      label: "reflection quality",
    },
  });

  const logo = useControls("Logo", {
    colorA: "#ff4901",
    colorB: "#ff5f00",
    mix: { value: 0.3, min: 0, max: 1, step: 0.01 },
    modelScale: { value: 0.6, min: 0.05, max: 1, step: 0.01, label: "model scale" },
    emissiveIntensity: { value: 3, min: 0, max: 10, step: 0.1, label: "glow (bloom) intensity" },
    roughness: { value: 0.45, min: 0, max: 1, step: 0.01 },
    metalness: { value: 0.0, min: 0, max: 1, step: 0.01 },
    lightIntensity: { value: 12, min: 0, max: 40, step: 0.5 },
    lightDistance: { value: 30, min: 5, max: 80, step: 1 },
    height: { value: 4.5, min: -3, max: 6, step: 0.1 },
  });

  // Small glowing embers drifting straight up past the logo, looping from
  // baseOffset to topOffset (both Y offsets from the logo's own position)
  // then fading out over the next `fadeBeyondTop` fraction of that span
  // before wrapping back to the bottom — see LogoSparkles.jsx.
  const sparkles = useControls("Logo Sparkles", {
    count: { value: 200, min: 0, max: 400, step: 5 },
    // Spans the whole lake now (lake.size default 47 → ~radius 23), not
    // just a tight ring around the logo's own base — reads as particles
    // rising off the entire water surface, not an emitter stuck to the
    // model.
    radius: { value: 22, min: 0, max: 60, step: 0.5, label: "spawn radius (lake-wide)" },
    // -5.5 puts the bottom of the rise at the lake's own surface (lakeY
    // 1.2, LOGO_POSITION.y 6.7 → 1.2 - 6.7 = -5.5), so particles visibly
    // originate from the water instead of appearing already mid-air.
    baseOffset: { value: -5.5, min: -10, max: 0, step: 0.1, label: "rise from (Y offset)" },
    topOffset: { value: 2.2, min: 0, max: 6, step: 0.1, label: "rise to (Y offset)" },
    fadeBeyondTop: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      label: "fade distance past top (%)",
    },
    speed: { value: 0.4, min: 0, max: 3, step: 0.01, label: "rise speed" },
    size: { value: 0.2, min: 0.0, max: 40, step: 0.5, label: "point size" },
    opacity: { value: 1, min: 0, max: 1, step: 0.01 },
  });

  const parallax = useControls("Parallax", {
    strength: { value: 0.06, min: 0, max: 1, step: 0.01 },
    lerp: { value: 0.06, min: 0.01, max: 0.3, step: 0.01 },
  }, HIDDEN_FOLDER);

  // Low mist clinging to the terrain's outer ridges — see RidgeFog.jsx.
  // Light grey/white (not orange), always drifting via its own shader
  // scroll so it reads as moving atmosphere regardless of camera/scroll
  // state.
  const ridgeFog = useControls("Ridge Mist", {
    // Was 50 x layerCount 2 = 100 overlapping additive planes, each with
    // its own multi-octave noise + curl field per fragment — the single
    // biggest remaining fill-rate cost in the scene. Cut to 20 x 1 = 20
    // planes (5x fewer draws) now that GroundFog (see below) provides the
    // broad atmospheric coverage across the whole terrain; this is back to
    // being just close-up wisps clinging to the ridge line itself.
    count: { value: 20, min: 0, max: 50, step: 1 },
    bandInner: { value: 34, min: 0, max: 100, step: 1, label: "band: inner radius" },
    bandOuter: { value: 80, min: 0, max: 140, step: 1, label: "band: outer radius" },
    heightOffset: { value: -5, min: -5, max: 15, step: 0.5, label: "height above ground" },
    heightJitter: { value: 3.5, min: 0, max: 15, step: 0.5, label: "height variance" },
    // Was 0/0 (i.e. zero-size, literally invisible planes) — restored to a
    // real patch size.
    patchWidth: { value: 29, min: 4, max: 60, step: 1, label: "patch width" },
    patchHeight: { value: 10, min: 2, max: 30, step: 1, label: "patch height" },
    // Each patch is now a small cross of this many static, fixed-rotation
    // planes instead of one card that spins to face the camera (see
    // RidgeFog.jsx) — 1 is the old flat-card behavior; 2+ is what actually
    // reads as volume from any angle you orbit the camera to.
    layerCount: { value: 1, min: 1, max: 5, step: 1, label: "volume: layers per patch" },
    flowSpeed: { value: 0.70, min: 0, max: 2, step: 0.005, label: "drift speed" },
    // Now additive-blended (see RidgeFog.jsx) — a near-black color like the
    // old #262626 default contributes almost nothing when added to the
    // scene, and opacity stacks across every layer/patch overlap, so both
    // needed to come down/up together for the additive glow to read as a
    // soft haze instead of either invisible or blown out.
    opacity: { value: 1.0, min: 0, max: 1, step: 0.01 },
    color: { value: "#484848", label: "color (grey/white)" },
    // Bends the noise sampling through a curl field each frame (see
    // RidgeFog.jsx's curl()) so the mist visibly rolls/curls in place
    // instead of just sliding sideways — 0 is the old pure drift.
    swirl: { value: 1.2, min: 0, max: 3, step: 0.05, label: "swirl amount" },
  });

  // Wide, dense ground-hugging atmosphere across the whole terrain — see
  // GroundFog.jsx for why this uses an exponential radial falloff instead
  // of a hard-edged plane/box (no visible boundary), plus orange
  // scattering toward the logo's own glow.
  const groundFog = useControls("Ground Mist", {
    density: { value: 0.55, min: 0, max: 1.5, step: 0.02 },
    opacity: { value: 0.60, min: 0, max: 1, step: 0.01 },
    coverageRadius: {
      value: 15,
      min: 10,
      max: 200,
      step: 5,
      label: "coverage radius (1/e falloff)",
    },
    baseHeight: { value: 0.7, min: -3, max: 6, step: 0.1, label: "height above ground" },
    layerSpread: { value: 1.5, min: 0, max: 6, step: 0.1, label: "layer spacing (thickness)" },
    noiseScale: { value: 0.09, min: 0.002, max: 0.12, step: 0.001, label: "noise cloud size" },
    flowSpeed: { value: 0.14, min: 0, max: 0.3, step: 0.005, label: "drift speed" },
    // Same curl-based rolling motion as Ridge Mist's own "swirl amount" —
    // see RidgeFog.jsx's curl(), reused verbatim in GroundFog.jsx.
    swirl: { value: 0.95, min: 0, max: 4, step: 0.05, label: "swirl amount" },
  });

  const camera = useControls("Camera", {
    scrollThrough: { value: true, label: "scroll-driven orbit" },
    start: { value: [-3, 19, -45], label: "start position" },
    // Direct world-space point, not a multiplier on `start` — where the
    // camera ends up once scroll reaches the bottom of its 200vh. Defaults
    // to roughly a half-revolution around `target`, higher and farther
    // back than `start`, but every axis here is yours to place by hand.
    end: { value: [12, 10, 25], label: "end position" },
    // Applied to the camera's initial rotation on mount. Whichever of
    // ScrollCameraRig / OrbitControls is active (see the JSX below)
    // recomputes the camera's actual orientation every frame from
    // `start`/`target`, so this mostly matters for the very first
    // rendered frame before that kicks in.
    rotationDeg: { value: [0, 0, 0], label: "initial rotation (deg)" },
    // The look-at point itself now rises over the scroll arc too, not
    // just the camera position — see ScrollCameraRig.jsx.
    targetStart: { value: [0, 3, 0], label: "look at: start" },
    targetEnd: { value: [0, 6, 0], label: "look at: end" },
    damping: { value: 6, min: 0.5, max: 20, step: 0.5, label: "scroll: camera smoothing" },
  });

  // The shockwave portal that opens once scroll enters its own stretch
  // (see PORTAL_VH above) — see PortalRenderer.jsx, ported from the
  // ChromaticShockwavePortalR3F reference: two scenes rendered to two FBOs
  // through the SAME live camera every frame, composited on a fullscreen
  // quad with a traveling radial ring (the shockwave/chromatic-aberration
  // shader in ShockwaveQuad.jsx), rather than a mesh-shaped window.
  const portal = useControls("Portal", {
    smoothness: { value: 12, min: 1, max: 30, step: 0.5, label: "reveal smoothing" },
    chromatic: { value: 0.38, min: 0, max: 1, step: 0.01, label: "chromatic aberration" },
    warp: { value: 0.75, min: 0, max: 1.5, step: 0.01, label: "ring warp strength" },
    edge: { value: 12.5, min: 1, max: 30, step: 0.5, label: "wipe edge sharpness" },
    ringPow: { value: 20.0, min: 1, max: 60, step: 1, label: "ring falloff" },
    ringGap: { value: 0.10, min: 0, max: 0.1, step: 0.005, label: "double-ring gap" },
    ring2Strength: { value: 0.0, min: 0, max: 1, step: 0.01, label: "double-ring strength" },
    // The outer environment already bends inward toward the ring as it
    // passes (that's `warp` above) — this applies the same inward lensing
    // to the INNER/portal scene too (not outward/bulging — that read as
    // popping toward the screen instead of being pulled into the portal),
    // plus its own stronger chromatic dispersion (a proper prism-style RGB
    // split, not just a faint tint), so the reveal itself reads as warped
    // rather than a flat cut sitting underneath the bent background.
    portalWarp: { value: 0.25, min: 0, max: 4, step: 0.05, label: "inner: portal warp strength" },
    portalChromatic: {
      value: 0.3,
      min: 0,
      max: 4,
      step: 0.05,
      label: "inner: portal chromatic dispersion",
    },
    // Anti-aliasing of the ridge scene behind the portal (see
    // PortalRenderer). resolution multiplies the canvas's own pixel ratio.
    innerResolution: { value: 1, min: 0.5, max: 2, step: 0.05, label: "inner: resolution (AA)" },
    innerMsaa: { value: 4, options: [0, 2, 4, 8], label: "inner: MSAA samples (AA)" },
  });

  // Vignette darkness eases from `darkness` to `endDarkness` across the
  // portal reveal (see PostFade) — same timing as the bloom fade.
  const vignette = useControls("Vignette", {
    offset: { value: 0.1, min: 0, max: 1, step: 0.01 },
    darkness: { value: 0.9, min: 0, max: 1.5, step: 0.01, label: "darkness (hero)" },
    endDarkness: { value: 0.2, min: 0, max: 1.5, step: 0.01, label: "darkness (after portal)" },
  });

  // Vertical gradient sky, behind everything including Starfield — see
  // Was hardcoded (intensity 1, threshold 0.15) — fine for the hero's own
  // small, very bright emissive highlights (logo, sparkles), but the ridge
  // scene's glass panels can show much bigger, ordinarily-bright video
  // content that blooms far more aggressively under the same settings
  // since it's a much larger bright screen area, not a small hot spot.
  // Exposed here (rather than left hardcoded) so both halves of the scene
  // can actually be tuned against each other.
  const bloom = useControls("Bloom", {
    intensity: { value: 0.6, min: 0, max: 3, step: 0.05 },
    luminanceThreshold: { value: 0.3, min: 0, max: 1, step: 0.01, label: "threshold" },
    luminanceSmoothing: { value: 0.4, min: 0, max: 1, step: 0.01, label: "smoothing" },
    radius: { value: 0.8, min: 0, max: 1, step: 0.01 },
  });

  // SkyGradient.jsx. Previously there was no background at all (flat
  // black), so the horizon never picked up any of the scene's warm tone.
  const sky = useControls("Sky", {
    radius: { value: 100, min: 100, max: 600, step: 10 },
    bottomColor: { value: "#eb7c01", label: "horizon color" },
    topColor: { value: "#000000", label: "zenith color" },
    horizon: { value: -1, min: -1, max: 1, step: 0.01, label: "horizon band position" },
    zenith: { value: 0.22, min: -1, max: 1, step: 0.01, label: "zenith band position" },
    power: { value: 0.4, min: 0.2, max: 4, step: 0.05, label: "gradient curve" },
  });

  const stars = useControls("Stars", {
    // Centered near ground level at the terrain's own center — the
    // hemisphere shell (see Starfield.jsx) is built around its own local
    // origin, so this is where that origin sits in the world, not an
    // offset like the old flat card needed.
    position: { value: [0, -10, 0] },
    rotationDeg: { value: [0, 0, 0], label: "rotation (deg)" },
    count: { value: 1000, min: 0, max: 3000, step: 10 },
    radius: { value: 220, min: 60, max: 500, step: 10, label: "dome radius" },
    radiusJitter: { value: 0.06, min: 0, max: 0.3, step: 0.01, label: "dome depth variance" },
    opacity: { value: 1, min: 0, max: 1.5, step: 0.02 },
    elevationMin: { value: 8, min: -10, max: 90, step: 1, label: "min elevation (%)" },
    elevationMax: { value: 83, min: 0, max: 100, step: 1, label: "max elevation (%)" },
    parallaxRatio: {
      value: 1.0,
      min: 0,
      max: 1,
      step: 0.05,
      label: "parallax vs. foreground",
    },
    shootingStarCount: { value: 5, min: 0, max: 10, step: 1 },
    shootingStarColor: "#dff2ff",
    shootingStarMinInterval: { value: 5, min: 0.5, max: 30, step: 0.5, label: "min gap (s)" },
    shootingStarMaxInterval: { value: 5, min: 1, max: 60, step: 0.5, label: "max gap (s)" },
    shootingStarDuration: { value: 0.7, min: 0.1, max: 3, step: 0.05, label: "streak length (s)" },
  }, HIDDEN_FOLDER);

  // Distance fog, tuned so the terrain seems to go on forever instead of
  // visibly stopping at its own mesh edge: FogExp2 grows with the SQUARE
  // of distance, so a density picked to nearly fully hide anything past
  // ~100 units (the far edge of the ground plane from center) still barely
  // touches the near/foreground rock detail we want to stay crisp. The
  // color is matched to the canvas's own background (near-black, no
  // scene.background is set) rather than a visibly tinted haze, so the
  // fog and the sky are the same thing — the terrain just fades into it
  // instead of fading into a differently-colored fog bank.
  const fog = useControls("Fog", {
    color: { value: "#000000" },
    density: { value: 0.015, min: 0, max: 0.05, step: 0.001 },
  }, HIDDEN_FOLDER);

  // Noticeably brighter across the board than the scroll-driven Concepts
  // page this was copied from — that page masks a dim terrain with bloom,
  // fog, and constant camera motion; this one just sits there being looked
  // at, so the ground actually needs to read clearly on its own.
  const lights = useControls("Lights", {
    ambientIntensity: { value: 5, min: 0, max: 2, step: 0.05 },
    ambientColor: "#3d3d3d",
    hemisphereIntensity: { value: 2.1, min: 0, max: 2, step: 0.05 },
    hemisphereSky: "#4d5049",
    hemisphereGround: "#141410",
    directionalIntensity: { value: 1.5, min: 0, max: 5, step: 0.05 },
    directionalColor: "#e8ece6",
    fillDirIntensity: { value: 5, min: 0, max: 5, step: 0.05, label: "fill light intensity" },
    fillDirColor: { value: "#ffb073", label: "fill light color" },
    rimDirIntensity: { value: 2, min: 0, max: 5, step: 0.05, label: "rim light intensity" },
    rimDirColor: { value: "#7fb3ff", label: "rim light color" },
    accentAIntensity: { value: 20, min: 0, max: 30, step: 0.5 },
    accentAColor: "#ff5f00",
    accentBIntensity: { value: 20, min: 0, max: 30, step: 0.5 },
    accentBColor: "#ff9900",
    // Was a hardcoded 40 — at that reach, both lights decay to almost
    // nothing well before the terrain slopes actually facing the logo,
    // so the ground around it never visibly picked up any of its color.
    // Exposed here (rather than left hardcoded) since "how far the glow
    // spreads onto the terrain" is exactly the knob this needed.
    accentDistance: { value: 90, min: 10, max: 150, step: 5, label: "accent light reach" },
    // A dedicated light for "the model visibly casts light on the lake and
    // terrain around it" — reusing accentA's own intensity (20) here was
    // nowhere near enough: at intensity/distance²  falloff (decay=2), 20
    // decays to a fraction of a unit by the time it reaches terrain 15-25
    // units away, invisible next to the much stronger sun/fill/rim lights
    // already lighting the scene. This gets its own much higher intensity
    // and a gentler decay (1, not 2) so it actually reaches and reads at
    // those distances instead of needing an unreasonably huge number.
    modelGlowColor: { value: "#ff5f00", label: "model glow: color" },
    modelGlowIntensity: { value: 300, min: 0, max: 400, step: 5, label: "model glow: intensity" },
    modelGlowDistance: { value: 50, min: 10, max: 150, step: 5, label: "model glow: reach" },
    modelGlowDecay: { value: 1, min: 0.5, max: 2, step: 0.1, label: "model glow: falloff" },
  });

  const waterLevel = -terrain.basinDepth + 0.35;
  // LakeSurface's actual world Y — used for both its own position and the
  // cuboid's smoke floorY clamp below. These must stay in sync: floorY was
  // previously derived from `waterLevel` (the terrain basin's height,
  // meant for scattering rocks/pebbles above the water) while the lake
  // mesh itself sits at a fixed, unrelated Y. Once those drifted apart the
  // smoke's floor clamp ended up below the actual visible water surface,
  // letting its billboard planes pass straight through the opaque lake
  // mesh — the hard seam/lines where smoke met the lake.
  const lakeY = 1.2;

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full bg-black"
      style={{ height: `${TOTAL_VH}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
      <Leva titleBar={{ title: "Hyperiux Concept" }} collapsed hidden={!showLeva} />
      <Leva
        store={ridgeStore}
        // Both panels default to the same fixed top-right position, which
        // would stack this directly on top of the first one — anchored to
        // the top-LEFT instead so both are visible side by side (still
        // freely draggable from there via the title bar, same as the
        // first panel).
        titleBar={{ title: "Ridge Scene", position: { x: 10, y: 10 } }}
        collapsed
        hidden={!showLeva}
      />

      <Canvas
        shadows
        // Capped at 1.5x (was up to 2x on retina) — the single biggest
        // lever on frame cost here, since it multiplies every pixel shader
        // in the scene (terrain, lake, bloom, fog, ridge fog) and, on top
        // of that, PortalRenderer's own extra off-screen scene renders
        // every frame (see PortalRenderer.jsx). 2x device pixel ratio is
        // 78% more pixels than 1.5x for a difference that's barely
        // perceptible at normal viewing distance.
        dpr={[1, 1.5]}
        camera={{
          position: camera.start,
          rotation: camera.rotationDeg.map((deg) => THREE.MathUtils.degToRad(deg)),
          fov: 45,
          near: 0.1,
          far: 300,
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl, camera: threeCamera }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          // PCFSoftShadowMap is deprecated in this three.js version and
          // logs on every shadow pass; PCFShadowMap is its replacement.
          gl.shadowMap.type = THREE.PCFShadowMap;
          // Layer 1 (dust/stars) and layer 2 (smoke) are both visible from
          // the main camera; the water's reflection camera excludes layer 1
          // but dims layer 2 instead of excluding it (see LakeSurface.jsx).
          threeCamera.layers.enable(1);
          threeCamera.layers.enable(2);
        }}
      >
        {camera.scrollThrough ? (
          <ScrollCameraRig
            progressRef={cameraProgressRef}
            start={camera.start}
            end={camera.end}
            targetStart={camera.targetStart}
            targetEnd={camera.targetEnd}
            damping={camera.damping}
          />
        ) : (
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={6}
            maxDistance={180}
            maxPolarAngle={Math.PI / 2 - 0.02}
            target={camera.targetEnd}
            // Left click is reserved for rippling the lake — without this,
            // OrbitControls also grabs left-drag for rotate, which fights
            // the click-to-ripple detection and nudges the camera mid-click.
            // mouseButtons={{
            //   LEFT: null,
            //   MIDDLE: THREE.MOUSE.DOLLY,
            //   RIGHT: THREE.MOUSE.ROTATE,
            // }}
          />
        )}

        <PortalRenderer
          progressRef={portalProgressRef}
          smoothness={portal.smoothness}
          chromatic={portal.chromatic}
          warp={portal.warp}
          edge={portal.edge}
          ringPow={portal.ringPow}
          ringGap={portal.ringGap}
          ring2Strength={portal.ring2Strength}
          portalWarp={portal.portalWarp}
          portalChromatic={portal.portalChromatic}
          portalResolution={portal.innerResolution}
          portalMsaa={Number(portal.innerMsaa)}
          portalScene={
            <PortalRidgePlaneScene
              ridgeProgressRef={ridgeProgressRef}
              portalProgressRef={portalProgressRef}
              pointerRef={pointerRef}
              store={ridgeStore}
            />
          }
        >
        {/* A JSX element (not scene.fog set imperatively in onCreated) so
            it stays reactive to the Leva controls below instead of only
            ever applying the values present at the very first mount. */}
        <fogExp2 attach="fog" args={[fog.color, fog.density]} />

        <ambientLight intensity={lights.ambientIntensity} color={lights.ambientColor} />
        <hemisphereLight
          args={[lights.hemisphereSky, lights.hemisphereGround, lights.hemisphereIntensity]}
        />
        <directionalLight
          position={SUN_DIRECTION}
          intensity={lights.directionalIntensity}
          color={lights.directionalColor}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={80}
          shadow-camera-left={-35}
          shadow-camera-right={35}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
        />
        {/* Fill + rim directional lights — no shadows (a third/fourth
            shadow map here isn't worth the cost for a secondary light),
            just extra directional definition so the scene doesn't read as
            lit from a single source. */}
        <directionalLight
          position={FILL_DIRECTION}
          intensity={lights.fillDirIntensity}
          color={lights.fillDirColor}
        />
        <directionalLight
          position={RIM_DIRECTION}
          intensity={lights.rimDirIntensity}
          color={lights.rimDirColor}
        />
        <pointLight
          position={[10, 6, 10]}
          intensity={lights.accentAIntensity}
          color={lights.accentAColor}
          distance={lights.accentDistance}
          decay={2}
        />
        <pointLight
          position={[-12, 5, -10]}
          intensity={lights.accentBIntensity}
          color={lights.accentBColor}
          distance={lights.accentDistance}
          decay={2}
        />
        {/* Sits low, near the water's own surface (not up at the logo's
            own height) so its spill actually grazes the nearby terrain
            slopes and the lake alike, reading as the logo's glow visibly
            pooling around its own base rather than a light floating in
            the air beside it. */}
        <pointLight
          position={[LOGO_POSITION[0], lakeY + 1, LOGO_POSITION[2]]}
          intensity={lights.modelGlowIntensity}
          color={lights.modelGlowColor}
          distance={lights.modelGlowDistance}
          decay={lights.modelGlowDecay}
        />

        <Suspense fallback={null}>
          <Parallax
            strength={parallax.strength * stars.parallaxRatio}
            lerp={parallax.lerp}
            center={[0, 0, 0]}
            pointerRef={pointerRef}
          >
            <SkyGradient
              radius={sky.radius}
              bottomColor={sky.bottomColor}
              topColor={sky.topColor}
              horizon={sky.horizon}
              zenith={sky.zenith}
              power={sky.power}
            />

            <Starfield
              position={stars.position}
              rotation={stars.rotationDeg.map((deg) => THREE.MathUtils.degToRad(deg))}
              count={stars.count}
              radius={stars.radius}
              radiusJitter={stars.radiusJitter}
              opacity={stars.opacity}
              elevationMin={stars.elevationMin}
              elevationMax={stars.elevationMax}
              shootingStarCount={stars.shootingStarCount}
              shootingStarColor={stars.shootingStarColor}
              shootingStarMinInterval={stars.shootingStarMinInterval}
              shootingStarMaxInterval={stars.shootingStarMaxInterval}
              shootingStarDuration={stars.shootingStarDuration}
            />
          </Parallax>
          <Parallax
            strength={parallax.strength}
            lerp={parallax.lerp}
            center={LOGO_POSITION}
            pointerRef={pointerRef}
          >
            <Terrain
              width={terrain.groundSize}
              depth={terrain.groundSize}
              height={terrain.height}
              basinRadius={terrain.basinRadius}
              basinDepth={terrain.basinDepth}
              ruggedness={terrain.ruggedness}
              ridgeSharpness={terrain.ridgeSharpness}
              warpStrength={terrain.warpStrength}
              rollingFrequency={terrain.rollingFrequency}
              ridgedFrequency={terrain.ridgedFrequency}
              transitionWidth={terrain.transitionWidth}
              color={terrain.color}
              roughness={terrain.roughness}
              grainIntensity={terrain.grainIntensity}
              grainScale={terrain.grainScale}
              dirtScale={terrain.dirtScale}
              dirtBumpScale={terrain.dirtBumpScale}
              rockColor={terrain.rockColor}
              rockSlopeStart={terrain.rockSlopeStart}
              rockSlopeEnd={terrain.rockSlopeEnd}
              rockStriationScale={terrain.rockStriationScale}
              rockStriationIntensity={terrain.rockStriationIntensity}
              rockStriationStretch={terrain.rockStriationStretch}
            />

            <RidgeFog
              count={ridgeFog.count}
              groundSize={terrain.groundSize}
              bandInner={ridgeFog.bandInner}
              bandOuter={ridgeFog.bandOuter}
              heightOffset={ridgeFog.heightOffset}
              heightJitter={ridgeFog.heightJitter}
              width={ridgeFog.patchWidth}
              height={ridgeFog.patchHeight}
              flowSpeed={ridgeFog.flowSpeed}
              opacity={ridgeFog.opacity}
              color={ridgeFog.color}
              layerCount={ridgeFog.layerCount}
              swirl={ridgeFog.swirl}
              terrainHeight={terrain.height}
              basinRadius={terrain.basinRadius}
              basinDepth={terrain.basinDepth}
              ruggedness={terrain.ruggedness}
              ridgeSharpness={terrain.ridgeSharpness}
              warpStrength={terrain.warpStrength}
              transitionWidth={terrain.transitionWidth}
              rollingFrequency={terrain.rollingFrequency}
              ridgedFrequency={terrain.ridgedFrequency}
            />

            <GroundFog
              groundSize={terrain.groundSize}
              density={groundFog.density}
              opacity={groundFog.opacity}
              coverageRadius={groundFog.coverageRadius}
              baseHeight={groundFog.baseHeight}
              layerSpread={groundFog.layerSpread}
              noiseScale={groundFog.noiseScale}
              flowSpeed={groundFog.flowSpeed}
              swirl={groundFog.swirl}
              color={ridgeFog.color}
            />

            <Rocks
              count={rocks.count}
              minScale={rocks.minScale}
              maxScale={rocks.maxScale}
              color={rocks.color}
              roughness={rocks.roughness}
              clearcoat={rocks.clearcoat}
              clearcoatRoughness={rocks.clearcoatRoughness}
              normalScale={rocks.normalScale}
              width={terrain.groundSize}
              depth={terrain.groundSize}
              height={terrain.height}
              basinRadius={terrain.basinRadius}
              basinDepth={terrain.basinDepth}
              ruggedness={terrain.ruggedness}
              ridgeSharpness={terrain.ridgeSharpness}
              warpStrength={terrain.warpStrength}
              rollingFrequency={terrain.rollingFrequency}
              ridgedFrequency={terrain.ridgedFrequency}
              transitionWidth={terrain.transitionWidth}
              waterLevel={waterLevel}
              wetnessMaps={wetnessMaps}
            />

            <Pebbles
              count={pebbles.count}
              color={pebbles.color}
              roughness={pebbles.roughness}
              clearcoat={pebbles.clearcoat}
              clearcoatRoughness={pebbles.clearcoatRoughness}
              width={terrain.groundSize}
              depth={terrain.groundSize}
              height={terrain.height}
              basinRadius={terrain.basinRadius}
              basinDepth={terrain.basinDepth}
              ruggedness={terrain.ruggedness}
              ridgeSharpness={terrain.ridgeSharpness}
              warpStrength={terrain.warpStrength}
              rollingFrequency={terrain.rollingFrequency}
              ridgedFrequency={terrain.ridgedFrequency}
              transitionWidth={terrain.transitionWidth}
              waterLevel={waterLevel}
            />

            <LakeSurface
              width={lake.size}
              depth={lake.size}
              position={[0, lakeY, 0]}
              deepColor={lake.deepColor}
              shallowColor={lake.shallowColor}
              glowColor={lake.glowColor}
              opacity={lake.opacity}
              reflectivity={lake.reflectivity}
              heightScale={lake.heightScale}
              reflectionBend={lake.reflectionBend}
              viscosity={lake.viscosity}
              mouseSize={lake.mouseSize}
              mouseIntensity={lake.mouseIntensity}
              rippleStrength={lake.rippleStrength}
              rippleFrequency={lake.rippleFrequency}
              rippleSpeed={lake.rippleSpeed}
              rippleDecay={lake.rippleDecay}
              rippleOriginX={lake.rippleOriginX}
              rippleOriginY={lake.rippleOriginY}
              hoverIntensityRatio={lake.hoverIntensityRatio}
              hoverFadeSpeed={lake.hoverFadeSpeed}
              clickBurstDuration={lake.clickBurstDuration}
              lightDirection={SUN_DIRECTION}
              lightColor={lake.specularColor}
              specularPower={lake.specularPower}
              specularIntensity={lake.specularIntensity}
              reflectionResolution={lake.reflectionResolution}
              glowReflectionStrength={lake.glowReflectionStrength}
              // This gate (skip the reflection render + GPGPU sim + hover
              // raycast entirely once past activeUntil) already existed in
              // LakeSurface but was never actually wired up here — it was
              // running all three, full cost, for the component's entire
              // lifetime regardless of scroll position. portalProgressRef
              // is 0 for the whole 200vh camera arc + 80vh dead zone, then
              // ramps 0..1 across the portal's own 100vh reveal, so 0.3
              // stops the lake's per-frame cost once the shockwave has
              // opened enough that the background scene it's part of is
              // mostly obscured anyway.
              progressRef={portalProgressRef}
              activeUntil={0.3}
            />

            <HyperiuxLogoModel
              position={LOGO_POSITION}
              colorA={logo.colorA}
              colorB={logo.colorB}
              mix={logo.mix}
              modelScale={logo.modelScale}
              emissiveIntensity={logo.emissiveIntensity}
              roughness={logo.roughness}
              metalness={logo.metalness}
              lightIntensity={logo.lightIntensity}
              lightDistance={logo.lightDistance}
            />

            <LogoSparkles
              position={LOGO_POSITION}
              count={sparkles.count}
              radius={sparkles.radius}
              baseOffset={sparkles.baseOffset}
              topOffset={sparkles.topOffset}
              fadeBeyondTop={sparkles.fadeBeyondTop}
              speed={sparkles.speed}
              size={sparkles.size}
              opacity={sparkles.opacity}
            />
          </Parallax>
        </Suspense>
        </PortalRenderer>

        <PostFade
          bloomRef={bloomRef}
          vignetteRef={vignetteRef}
          progressRef={portalProgressRef}
          baseIntensity={bloom.intensity}
          vignetteStart={vignette.darkness}
          vignetteEnd={vignette.endDarkness}
        />
        <EffectComposer>
          <Bloom
            ref={bloomRef}
            intensity={bloom.intensity}
            luminanceThreshold={bloom.luminanceThreshold}
            luminanceSmoothing={bloom.luminanceSmoothing}
            mipmapBlur
            radius={bloom.radius}
          />
          <Vignette
            ref={vignetteRef}
            eskil={false}
            offset={vignette.offset}
            darkness={vignette.darkness}
          />
        </EffectComposer>
      </Canvas>
      </div>
    </div>
  );
}
