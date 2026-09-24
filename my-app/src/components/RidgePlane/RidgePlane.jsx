"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { Leva, useControls } from "leva";
import * as THREE from "three";
import { createCubeGridTexture } from "./cubeGridTexture";
import CurvedGlassPanel from "./CurvedGlassPanel";
import Parallax from "../hyperiux-concepts/Parallax";

// A continuous, very slow spin on the cylinder mesh itself (time-based, via
// its own ref) — independent of and stacked underneath the mouse-driven
// <Parallax> rotation wrapping the whole environment below.
function CylinderAutoSpin({ meshRef, speed }) {
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.y += speed * delta;
  });
  return null;
}

// Wraps into (-PI, PI] so "distance to 0" (facing the camera) is always the
// short way around, regardless of how many turns totalRotation sweeps.
function wrapAngle(theta) {
  const twoPi = Math.PI * 2;
  let t = theta % twoPi;
  if (t > Math.PI) t -= twoPi;
  if (t < -Math.PI) t += twoPi;
  return t;
}

// Panels read as physically attached to the OUTER skin of a shared
// invisible cylinder, with the camera standing outside it and orbiting
// around — not the other way around (camera at the axis, panels lining an
// inner wall facing in). Scrolling spins the cylinder (`overallTheta =
// progress * totalRotation`) and lifts it (`elevationRange`); each panel
// sits at its own fixed angular slot on that outer surface, positioned at
// (R sin(theta), R cos(theta)) — the point on the ring CLOSEST to the
// camera's own resting side (+Z), not the far side — facing directly
// outward, away from the axis. Because its rotation is always exactly
// `theta` — the SAME angle that places it — a panel necessarily faces
// outward the whole time, the way a facet welded to a rotating drum's
// exterior would, rather than spinning independently of where it is.
//
// Also owns its own `highQuality` flag: MeshTransmissionMaterial runs a
// full extra scene render every frame per instance, so with 3 panels
// running that simultaneously regardless of visibility is real, measurable
// lag. Only the panel(s) currently within `activeWindow` of dead center
// (theta=0, i.e. facing the camera's own side) get the expensive material;
// everything else swaps to a cheap approximation (see CurvedGlassPanel's
// `highQuality` prop). This is a rare setState — only fires the moment a
// panel crosses in or out of the window, not every frame — so it doesn't
// reintroduce the cost it's meant to remove.
function ScrollCylinderPanel({ progressRef, radius, angleSlot, totalRotation, baseY, activeWindow, children }) {
  const groupRef = useRef(null);
  const [highQuality, setHighQuality] = useState(true);
  const wasActiveRef = useRef(true);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const overall = progressRef.current ?? 0;
    const theta = wrapAngle(angleSlot - overall * totalRotation);

    // baseY is each panel's own fixed staircase height now (see the
    // per-panel array built in RidgePlane) — no longer drifting with
    // scroll on top of that; CameraHeightFollow below is what makes the
    // camera/target glide between these fixed heights instead.
    group.position.set(radius * Math.sin(theta), baseY, radius * Math.cos(theta));
    group.rotation.set(0, theta, 0);

    const isActive = Math.abs(theta) < activeWindow;
    if (isActive !== wasActiveRef.current) {
      wasActiveRef.current = isActive;
      setHighQuality(isActive);
    }
  });

  return <group ref={groupRef}>{children(highQuality)}</group>;
}

// Keeps the camera aimed at the SAME height it's standing at, every frame,
// tracking whichever panel is currently swinging past dead center
// (theta=0) — this is what makes the view read as "descending the
// staircase along with the panels" instead of a fixed eye-level looking up
// at higher panels or down at lower ones.
//
// Also THE fix for "looking downward on load": R3F's default camera, when
// only given a `position` via the Canvas `camera` prop (no explicit
// rotation), auto-orients itself to look at the world origin (0,0,0) —
// not level. Since the camera stands at y=eyeHeight (nonzero) while the
// origin is at y=0, that default aim tilts it down toward the origin,
// which is exactly the downward pitch reported. Works with OR without
// OrbitControls mounted: with it, this nudges its `target`/camera height
// and lets its own update() apply the rotation; without it (controlsRef
// empty), this calls camera.lookAt directly so the view is still level
// even with OrbitControls commented out for debugging.
//
// Mirrors the ring rotation's own panel-0-at-0/last-panel-at-1 mapping
// directly (progress * (n-1)), clamped rather than wrapped — so this can
// never loop back toward panel 0's height once scroll reaches the end, the
// same "shouldn't come back" fix as the rotation itself.
//
// Also cancels the room's own apparent vertical drift: the big background
// cylinder itself never moves, but the camera's own height does (that's
// the whole staircase effect) — so relative to the camera, a perfectly
// static room reads as sliding upward while scrolling down. Shifting the
// cylinder mesh by the SAME delta the camera moves keeps the vector
// between camera and room constant, so the room reads as anchored/fixed
// while the panels (whose own Y is independent of this) still visibly
// descend against it.
function CameraHeightFollow({ progressRef, panelBaseYs, controlsRef, cylinderRef, baseCameraY }) {
  useFrame((state) => {
    const overall = progressRef.current ?? 0;
    const n = panelBaseYs.length;
    const continuous = THREE.MathUtils.clamp(overall * (n - 1), 0, n - 1);

    const i0 = Math.min(Math.floor(continuous), n - 2);
    const i1 = i0 + 1;
    const frac = continuous - i0;
    const y = THREE.MathUtils.lerp(panelBaseYs[i0], panelBaseYs[i1], frac);

    state.camera.position.y = y;

    const controls = controlsRef.current;
    if (controls) {
      controls.target.y = y;
      controls.update();
    } else {
      state.camera.lookAt(0, y, 0);
    }

    const cylinder = cylinderRef.current;
    if (cylinder) {
      cylinder.position.y = y - baseCameraY;
    }
  });

  return null;
}

// three.js's OWN automatic transmission pass — separate from and IN
// ADDITION TO drei's own transmissionResolution prop on
// MeshTransmissionMaterial (which only governs its own extra
// chromatic-aberration/distortion buffer). This native one fires
// unconditionally whenever ANY material with transmission>0 is visible —
// including the two "cheap" fallback meshPhysicalMaterial panels, not just
// the one highQuality panel — and defaults to capturing the WHOLE SCENE at
// FULL CANVAS RESOLUTION (transmissionResolutionScale=1), every frame.
// This was the single biggest lag source found so far; live-tunable here
// (rather than a hardcoded guess) since how blurry it can go before it
// stops looking like glass is a visual call, not a fixed number — dial it
// up for more clarity, down for more smoothness.
function NativeTransmissionScale({ value }) {
  // Set via useFrame's own `state.gl` (matching CameraHeightFollow's
  // `state.camera.position.y = y` above) rather than useThree()'s return
  // value directly — mutating a value returned straight from a hook call
  // is what the React Compiler's immutability rule flags; a value handed
  // in through a callback argument isn't.
  useFrame((state) => {
    if (state.gl.transmissionResolutionScale !== value) {
      state.gl.transmissionResolutionScale = value;
    }
  });
  return null;
}

// 3 showcased panels, evenly spaced 120° apart around the same invisible
// cylinder. As it rotates with scroll, each takes its own turn sweeping
// past dead center in front of the camera. Defaults here are just the
// starting point — each one's type/url is also exposed live via the
// "Panel Media" Leva folder below, so video vs. image and the source can
// be swapped without touching code.
const PANEL_COUNT = 3;
const DEFAULT_PANEL_MEDIA = [
  { type: "video", url: "/assets/videos/patronum.mp4" },
  { type: "video", url: "/assets/videos/quickx.mp4" },
  { type: "video", url: "/assets/videos/dharan.mp4" },
  // { type: "image", url: "https://pub-8abee449136941f5b0a1cd2c014534e9.r2.dev/vault-listing-images/assets-images/h-18.jpg" },
  // { type: "image", url: "https://pub-8abee449136941f5b0a1cd2c014534e9.r2.dev/vault-listing-images/assets-images/h-20.jpg" },
  // { type: "image", url: "https://pub-8abee449136941f5b0a1cd2c014534e9.r2.dev/vault-listing-images/assets-images/h-25.jpg" },
];

// Panel angular spacing (and therefore SCROLL_TOTAL_ROTATION, which has to
// match it) is now a Leva-tunable value read inside the component — see
// "panelAngleGapDeg" in Scroll Motion — rather than always the full circle
// divided evenly, so the panels can sit in a tighter arc instead of
// wrapping the whole invisible cylinder.

// Rebuilt (not mutated per-frame) whenever an input changes — this shape is
// static, so there's no useFrame loop here, just a fresh geometry each time
// Leva values change.
//
// A tall, open-ended tube standing on the Y axis, dented inward at evenly
// spaced points around its own circumference. Unlike the flat plane this
// started as, the circumference has no edges to taper flat against — it's
// already a closed loop — so `frequency` directly IS the number of dents,
// each one spanning exactly `(2*PI) / frequency` radians with a guaranteed
// seamless wrap, rather than needing a separate taper-distance control.
function buildCylinderGeometry({ radius, height, radialSegments, heightSegments, amplitude, sharpness, frequency }) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, radialSegments, heightSegments, true);
  const pos = geo.attributes.position;

  const segmentCount = Math.max(1, Math.round(frequency));
  const period = (Math.PI * 2) / segmentCount;
  const halfPeriod = period / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const theta = Math.atan2(z, x);

    // Distance (in radians) from the nearest dent's own center line.
    let local = ((theta % period) + period) % period;
    if (local > halfPeriod) local -= period;

    const t = THREE.MathUtils.clamp(Math.abs(local) / halfPeriod, 0, 1);
    const s = 1 - t;
    // Smoothstep envelope: zero at each dent's own boundary (so it merges
    // flat into its neighbor with no crease) and peaks at its center line
    // — always >= 0, so raising it to `sharpness` is safe for any exponent.
    const envelope = (s * s * (3 - 2 * s)) ** sharpness;
    // Negated: a dent sinking INTO the wall by default, matching this
    // shape's original inward-valley convention.
    const newRadius = radius - amplitude * envelope;

    pos.setX(i, Math.cos(theta) * newRadius);
    pos.setZ(i, Math.sin(theta) * newRadius);
    pos.setY(i, y);
  }

  geo.computeVertexNormals();
  return geo;
}

export default function RidgePlane() {
  const cylinder = useControls("Cylinder", {
    radius: { value: 150, min: 1, max: 200, step: 0.5 },
    height: { value: 250, min: 5, max: 350, step: 1, label: "height (tall)" },
    // Lowered from 128/64 — this mesh gets drawn TWICE every frame (once
    // for the main view, once again inside MeshTransmissionMaterial's own
    // backdrop capture for whichever panel is highQuality), and at
    // Ridge>amplitude=0 (no dents) the extra tessellation has zero visual
    // effect anyway — pure wasted vertex cost. Raise this back up if
    // amplitude is pushed up enough that dents start looking faceted.
    radialSegments: { value: 48, min: 8, max: 256, step: 1, label: "resolution (around)" },
    heightSegments: { value: 24, min: 4, max: 200, step: 1, label: "resolution (vertical)" },
    // Also the cube-grid texture's own background fill (see the Texture
    // panel below) — the material's own base color is left neutral so the
    // texture's baked-in colors show through true, not multiplied.
    color: { value: "#0d0d0d", label: "color" },
    emissive: { value: "#0d0d0d", label: "emissive" },
    roughness: { value: 1.0, min: 0, max: 1, step: 0.01 },
    metalness: { value: 0.0, min: 0, max: 1, step: 0.01 },
    wireframe: { value: false },
  });

  const texture = useControls("Texture", {
    enabled: { value: true, label: "cube grid texture" },
    outlineColor: { value: "#909090", label: "cube outline color" },
    // A fixed WORLD-SPACE size (same convention as Terrain's own
    // grainScale/dirtScale) rather than a fixed repeat count — with a
    // fixed count, growing the radius had to stretch every cube bigger to
    // still fit the same count around the now-larger circumference, which
    // canceled out the wall actually moving farther away. A fixed size
    // means the room genuinely gets bigger (more same-size cubes, wall
    // farther off) as radius grows, instead of just stretching them.
    cubeWorldSize: { value: 6.5, min: 0.5, max: 40, step: 0.5, label: "cube size (world units)" },
    size: { value: 90, min: 8, max: 256, step: 1, label: "cube detail size" },
    // The drawn tile itself is taller than it is wide (a triangular
    // lattice period is `cubeSize * sqrt(3)` tall for `cubeSize` wide —
    // see cubeGridTexture.js), which the repeat math below already
    // corrects for by default; this is an extra manual multiplier on top
    // for squashing/stretching the cubes further to taste.
    heightScale: { value: 1.03, min: 0.2, max: 3, step: 0.02, label: "cube height scale" },
    rotationDeg: { value: 0, min: -180, max: 180, step: 1, label: "cube rotation" },
  });

  const ridge = useControls("Ridge", {
    amplitude: { value: 0, min: 0, max: 15, step: 0.1, label: "dent depth" },
    sharpness: { value: 0.2, min: 0.2, max: 6, step: 0.1, label: "crest sharpness" },
    frequency: { value: 8, min: 1, max: 48, step: 1, label: "number of dents (around)" },
  });

  const glassPanel = useControls("Glass Panel", {
    distance: { value: 22, min: 2, max: 100, step: 1, label: "distance from camera" },
    width: { value: 16, min: 2, max: 60, step: 0.5, label: "width (arc length)" },
    height: { value: 9, min: 2, max: 40, step: 0.5 },
    // Thicker than a plain pane — this is meant to read as a block the
    // video sits inside of, not a window it sits behind.
    depth: { value: 0.2, min: 0.05, max: 5, step: 0.05, label: "thickness" },
    // "Curved from a vertical line" — bent left-to-right only, flat
    // top-to-bottom (see bendAroundVerticalAxis in CurvedGlassPanel.jsx).
    curveAngleDeg: { value: 30, min: 0, max: 180, step: 1, label: "curve angle" },
    // How much the curve (and therefore the refraction/chromatic-aberration
    // it drives) concentrates toward the panel's outer edges — 1 is a
    // plain constant-radius arc bending evenly everywhere; higher values
    // keep the middle progressively flatter and clearer, curving/
    // aberrating only near the rim.
    edgeBias: { value: 1, min: 1, max: 8, step: 0.25, label: "edge curve bias" },
    // Fillet radius on the box's own edges/corners — 0 is a sharp box (see
    // roundBoxCorners in CurvedGlassPanel.jsx — rounds our own plain box
    // directly, not a swap to RoundedBoxGeometry, which didn't curve right).
    edgeRadius: { value: 0.17, min: 0, max: 3, step: 0.01, label: "edge roundness" },
    showMedia: { value: true, label: "show video/image" },
    transmission: { value: 1, min: 0, max: 1, step: 0.01, label: "glass transmission" },
    // Roughness blurs what's transmitted/refracted through the glass —
    // this is the "frosted" knob; clearcoat keeps the surface itself
    // shiny regardless of how blurred the transmission is.
    roughness: { value: 0.20, min: 0, max: 1, step: 0.01, label: "frost (roughness)" },
    thickness: { value: 0.95, min: 0, max: 5, step: 0.05, label: "glass thickness (refraction depth)" },
    ior: { value: 1.14, min: 0, max: 2.5, step: 0.01, label: "glass IOR" },
    clearcoat: { value: 3, min: 0, max: 3, step: 0.01, label: "surface shine (clearcoat)" },
    // Lower = glossier (a sharp, mirror-like highlight).
    clearcoatRoughness: { value: 0.05, min: 0, max: 3, step: 0.01, label: "shine sharpness" },
    // MeshTransmissionMaterial's chromatic split is inherently strongest at
    // grazing angles (i.e. the panel's own silhouette/edges) — combined
    // with edgeBias above, this concentrates rainbow fringing right at the
    // curved edges while the flatter center stays clear.
    chromaticAberration: { value: 0.35, min: 0, max: 4, step: 0.05, label: "glass chromatic split" },
    anisotropy: { value: 0.0, min: 0, max: 2, step: 0.01, label: "glass anisotropy" },
    // The magnifying-glass warp — how much the video trapped inside bends
    // and swims through the glass.
    distortion: { value: 0.15, min: 0, max: 2, step: 0.02, label: "video distortion (magnify)" },
    distortionScale: { value: 0.38, min: 0, max: 2, step: 0.02, label: "distortion scale" },
    temporalDistortion: { value: 0.2, min: 0, max: 1, step: 0.01, label: "distortion shimmer" },
    // Video is built smaller than the box by this fraction — the gap is
    // the margin the parallax offset below is clamped within, so it can
    // shift without ever reaching (let alone crossing) the box's own edge.
    videoInset: { value: 0.95, min: 0.5, max: 1, step: 0.01, label: "video inset (size vs. box)" },
    // A second, independent layer of mouse parallax on just the video —
    // nested inside the panel's own (already mouse-parallaxed) position,
    // so it shifts apart from the glass around it rather than riding along
    // with it 1:1. A straight X/Y translation (not rotation) clamped to
    // the inset margin above, so it's geometrically guaranteed to stay
    // inside the panel — a rotation would visibly swing it out past the
    // glass's own edge.
    videoParallaxStrength: {
      value: 0.8,
      min: 0,
      max: 3,
      step: 0.01,
      label: "video parallax strength (of margin)",
    },
    videoParallaxLerp: { value: 0.08, min: 0.01, max: 0.3, step: 0.01, label: "video parallax smoothing" },
    // MeshTransmissionMaterial's own backdrop-capture buffer — the actual
    // per-frame cost driver, and the single biggest lever on overall lag.
    // Lowered further (1024->640, 8->6 samples) — still only ever 1-2
    // panels pay this cost at once (see "high-quality window" below), but
    // each occurrence is a full extra scene render, so this is worth
    // keeping as low as still reads clean.
    // 1920 here was ~9x the pixel cost of 640 (a render-target SIZE, not a
    // texture — MeshTransmissionMaterial redoes a full scene render at
    // this resolution every frame for whichever panel is highQuality) and
    // was the dominant cause of reported lag. Back down to something that
    // still reads clean without that cost; crank it up live via Leva if
    // more clarity is worth the tradeoff on a given machine.
    transmissionResolution: {
      value: 1920,
      min: 256,
      max: 2048,
      step: 128,
      label: "perf: transmission resolution",
    },
    transmissionSamples: { value: 6, min: 2, max: 16, step: 1, label: "perf: transmission samples" },
  });

  const scene = useControls("Scene", {
    background: "#0a0a0c",
    showGrid: { value: false, label: "show reference floor grid" },
    // A real orbit now (drag rotates the camera AROUND the target, at
    // roughly `cameraOrbitDistance`), since the camera sits outside the
    // panel ring rather than at its center — "auto look-around" now reads
    // as a slow auto-orbit around the whole arrangement.
    autoRotate: { value: false, label: "auto orbit" },
    parallaxStrength: { value: 0.02, min: 0, max: 1, step: 0.01, label: "mouse parallax strength" },
    parallaxLerp: { value: 0.06, min: 0.01, max: 0.3, step: 0.01, label: "mouse parallax smoothing" },
    // Radians per second — kept tiny on purpose, a full turn takes minutes.
    cylinderSpinSpeed: { value: 0.05, min: 0, max: 0.2, step: 0.005, label: "cylinder spin speed" },
    // How far outside the panel ring (radius = Glass Panel > distance) the
    // camera's own resting orbit sits.
    cameraOrbitDistance: { value: 40, min: 6, max: 150, step: 1, label: "camera orbit distance" },
    // three.js's OWN automatic transmission capture resolution (0-1, scales
    // the canvas' own size) — see NativeTransmissionScale above. This is a
    // MUCH bigger lever on lag than transmissionResolution in Glass Panel
    // (that one only covers drei's own extra buffer); this one governs a
    // separate full-scene capture that fires for ANY transmissive
    // material, at full canvas resolution by default. Lower = smoother,
    // blurrier glass; higher = sharper, heavier.
    nativeTransmissionScale: {
      value: 0.2,
      min: 0.05,
      max: 1,
      step: 0.05,
      label: "perf: native transmission scale",
    },
  });

  // Drives the invisible cylinder the glass panels sit on — see
  // ScrollCylinderPanel above. `radius` reuses the panel's own "distance
  // from camera" so a panel at theta=0 sits exactly where the original
  // single-panel version did.
  const scrollMotion = useControls("Scroll Motion", {
    // Each successive panel (in video order) sits this much LOWER than the
    // one before it — a fixed staircase, not something that drifts with
    // scroll. The camera/target height glides between these same fixed
    // values as scroll brings each one to center (see CameraHeightFollow).
    panelHeightStep: { value: 12, min: -30, max: 30, step: 0.5, label: "panel height step (staircase)" },
    // Angular spacing between adjacent panels — was always the full circle
    // divided evenly (120° for 3 panels), wrapping the whole invisible
    // cylinder. Lower this to pull them into a tighter arc instead; the
    // ring's own total rotation (see scrollTotalRotation below) is
    // derived straight from this so panel 0 still centers at scroll=0 and
    // the last panel still centers at scroll=1, just over a smaller sweep.
    panelAngleGapDeg: { value: 45, min: 10, max: 170, step: 1, label: "panel angle gap (deg)" },
    activeWindowDeg: {
      value: 40,
      min: 20,
      max: 120,
      step: 1,
      label: "high-quality window (deg, perf)",
    },
  });

  // How far the ring rotates across the FULL scroll range — sized so panel
  // 0 is centered at scroll=0 and the LAST panel is centered at scroll=1,
  // exactly, with nothing left over (same reasoning as before, just now
  // built from the tunable gap instead of always a full-circle division —
  // see panelAngleGapDeg above).
  const panelAngleGap = THREE.MathUtils.degToRad(scrollMotion.panelAngleGapDeg);
  const scrollTotalRotation = (PANEL_COUNT - 1) * panelAngleGap;
  // Clamped below half the gap so two adjacent panels' windows can never
  // overlap — without this, pulling panelAngleGapDeg down without also
  // lowering activeWindowDeg would let 2 panels go `highQuality`
  // (full MeshTransmissionMaterial backdrop capture) at once, undoing the
  // perf work that assumes only ever one does.
  const activeWindow = Math.min(THREE.MathUtils.degToRad(scrollMotion.activeWindowDeg), panelAngleGap / 2 - 0.01);

  // Per-panel media, swappable live between video and image without
  // touching code — each panel's own CurvedGlassPanel (see the loop below)
  // reads its type/url straight from here. Options intentionally named
  // "panel 1/2/3" (not "patronum/gcm/dharan") since whatever plays in each
  // slot is now arbitrary.
  const panelMedia = useControls("Panel Media", {
    panel1Type: { value: DEFAULT_PANEL_MEDIA[0].type, options: ["video", "image"], label: "panel 1 type" },
    panel1Url: { value: DEFAULT_PANEL_MEDIA[0].url, label: "panel 1 url" },
    panel2Type: { value: DEFAULT_PANEL_MEDIA[1].type, options: ["video", "image"], label: "panel 2 type" },
    panel2Url: { value: DEFAULT_PANEL_MEDIA[1].url, label: "panel 2 url" },
    panel3Type: { value: DEFAULT_PANEL_MEDIA[2].type, options: ["video", "image"], label: "panel 3 type" },
    panel3Url: { value: DEFAULT_PANEL_MEDIA[2].url, label: "panel 3 url" },
  });
  const panelMediaList = useMemo(
    () => [
      { type: panelMedia.panel1Type, url: panelMedia.panel1Url },
      { type: panelMedia.panel2Type, url: panelMedia.panel2Url },
      { type: panelMedia.panel3Type, url: panelMedia.panel3Url },
    ],
    [panelMedia.panel1Type, panelMedia.panel1Url, panelMedia.panel2Type, panelMedia.panel2Url, panelMedia.panel3Type, panelMedia.panel3Url]
  );

  const geometry = useMemo(
    () =>
      buildCylinderGeometry({
        radius: cylinder.radius,
        height: cylinder.height,
        radialSegments: cylinder.radialSegments,
        heightSegments: cylinder.heightSegments,
        amplitude: ridge.amplitude,
        sharpness: ridge.sharpness,
        frequency: ridge.frequency,
      }),
    [
      cylinder.radius,
      cylinder.height,
      cylinder.radialSegments,
      cylinder.heightSegments,
      ridge.amplitude,
      ridge.sharpness,
      ridge.frequency,
    ]
  );

  // Canvas isn't available during SSR, so the grid texture is built
  // client-side only, after mount (same pattern as Terrain's grain/rock
  // textures and Hero's wetness maps) — fully configured (background,
  // lines, repeat) before it's ever handed to setState, so nothing about
  // it is mutated again afterward.
  const [gridTexture, setGridTexture] = useState(null);
  useEffect(() => {
    if (!texture.enabled) {
      setGridTexture(null);
      return;
    }

    const tex = createCubeGridTexture({
      backgroundColor: cylinder.color,
      lineColor: texture.outlineColor,
      cubeSize: texture.size,
      rotationDeg: texture.rotationDeg,
    });
    // The drawn tile is `cubeSize` wide by `cubeSize * sqrt(3)` tall (see
    // cubeGridTexture.js) — dividing by sqrt(3) here undoes that so a
    // repeat of `cubeWorldSize` world units maps back to an undistorted
    // cube; `heightScale` is a further manual multiplier on top, for
    // squashing/stretching to taste.
    const circumference = 2 * Math.PI * cylinder.radius;
    // Rounded to a whole number of repeats: the cylinder's U coordinate
    // wraps a full loop (u=1 meets back up with u=0), so a fractional
    // repeat count here would leave one partial, misaligned tile exactly
    // at that seam — every other direction (the open-ended height axis
    // below) has no such wraparound and is fine left fractional.
    const repeatX = Math.max(1, Math.round(circumference / texture.cubeWorldSize));
    const repeatY = (cylinder.height / (texture.cubeWorldSize * Math.sqrt(3))) * texture.heightScale;
    tex.repeat.set(repeatX, repeatY);
    setGridTexture(tex);

    return () => tex.dispose();
  }, [
    texture.enabled,
    texture.outlineColor,
    texture.cubeWorldSize,
    texture.size,
    texture.heightScale,
    texture.rotationDeg,
    cylinder.color,
    cylinder.radius,
    cylinder.height,
  ]);

  const eyeHeight = cylinder.height / 20;
  const cylinderMeshRef = useRef(null);
  const orbitControlsRef = useRef(null);

  // One fixed staircase height per panel (index 0 = patronum, highest;
  // each one after sits panelHeightStep lower) — see ScrollCylinderPanel's
  // baseY and CameraHeightFollow above.
  const panelBaseYs = useMemo(
    () => Array.from({ length: PANEL_COUNT }, (_, i) => eyeHeight - i * scrollMotion.panelHeightStep),
    [eyeHeight, scrollMotion.panelHeightStep]
  );

  // Plain DOM scroll progress (0..1 across the scrollable container),
  // written outside React state so ScrollPanelRig can read it every frame
  // without a re-render triggering on every scroll pixel — same pattern as
  // Hero.jsx's own scroll-driven camera/portal rigs.
  const scrollContainerRef = useRef(null);
  const scrollProgressRef = useRef(0);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = scrollable > 0 ? -rect.top / scrollable : 0;
      scrollProgressRef.current = THREE.MathUtils.clamp(progress, 0, 1);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full"
      style={{ height: "300vh", backgroundColor: scene.background }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <Leva titleBar={{ title: "Ridge Plane" }} collapsed={false} />

      <Canvas
        // Capped at 1.25x (was 1.5x, originally up to 2x) — retina devices
        // otherwise push the actual pixel count MeshTransmissionMaterial's
        // backdrop pass (and everything else in the scene) has to fill
        // considerably higher than any resolution setting alone suggests.
        dpr={[1, 1.25]}
        camera={{ position: [0, panelBaseYs[0], scene.cameraOrbitDistance], fov: 55, near: 0.5, far: 500 }}
        // MSAA (antialias) multiplies fragment cost on top of a scene
        // that's already being drawn twice a frame (main view + the
        // transmission backdrop capture) — off, since dpr's own
        // supersampling above already softens edges somewhat and this is
        // one of the more expensive remaining levers that doesn't touch
        // how transmission itself looks.
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[scene.background]} />
        <NativeTransmissionScale value={scene.nativeTransmissionScale} />

        <ambientLight intensity={0.6} />
        {/* Key + fill + rim, from clearly different angles — one
            directional light alone leaves the glass panel's rounded edges
            with only a single glint; a transmission/clearcoat material
            needs more than one bright source around it for the shiny
            curved rim to actually catch highlights from multiple sides.
            Trimmed from 5 down to 3, then dropped the hemisphere light
            too (redundant fill on top of ambient+point) — every one of
            these adds a real per-fragment cost across the whole screen
            (the big cylinder alone covers most of it), and this happens
            TWICE per frame for whichever panel is highQuality (once for
            the main view, once again inside its transmission backdrop
            capture), so trimming here is worth double what it looks like. */}
        <directionalLight position={[10, cylinder.height, 8]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-14, eyeHeight + 6, -12]} intensity={0.9} color="#dfe8ff" />
        <directionalLight position={[0, eyeHeight - 4, 10]} intensity={0.7} color="#ffe9d0" />
        {/* Sits right where the camera does — a directional/hemisphere
            light alone leaves most of an enclosing tube's inner wall in
            shadow from any given angle; this keeps the surface around the
            viewer evenly lit regardless of which way they're looking. */}
        <pointLight position={[0, eyeHeight, 0]} intensity={3} distance={cylinder.radius * 4} decay={2} />

        {scene.showGrid && (
          <Grid
            position={[0, 0, 0]}
            args={[cylinder.radius * 4, cylinder.radius * 4]}
            cellColor="#333333"
            sectionColor="#555555"
            fadeDistance={60}
            fadeStrength={1}
          />
        )}

        {/* Wraps the whole environment (cylinder + glass panel) — rotates
            it opposite to cursor movement, lerped, pivoting around the
            resting/near-side panel position (now +Z, the side facing the
            camera's own resting orbit) rather than the viewer's position:
            that spot stays anchored/"looked at" while the cylinder around
            it (farther from this pivot) is what visibly swings with the
            parallax. */}
        <Parallax
          center={[0, eyeHeight, glassPanel.distance]}
          strength={scene.parallaxStrength}
          lerp={scene.parallaxLerp}
        >
          <mesh ref={cylinderMeshRef} geometry={geometry}>
            <meshStandardMaterial
              // The grid texture already bakes in `cylinder.color` as its
              // own fill, so the material's base color is left neutral
              // white here — multiplying the two together would
              // double-darken it.
              color={gridTexture ? "#ffffff" : cylinder.color}
              map={gridTexture}
              emissive={cylinder.emissive}
              roughness={cylinder.roughness}
              metalness={cylinder.metalness}
              wireframe={cylinder.wireframe}
              // The camera's orbit distance is always bounded well inside
              // cylinder.radius (see OrbitControls' maxDistance below), so
              // the outside of this tube is never actually seen — only
              // ever its inner wall, which is the BACK face of the
              // (outward-facing-by-default) cylinder geometry. BackSide
              // instead of DoubleSide roughly halves the fragment cost of
              // the single largest mesh in the scene for a look that's
              // otherwise identical from where the camera can actually be.
              side={THREE.BackSide}
            />
          </mesh>

          <Suspense fallback={null}>
            {panelMediaList.map((media, i) => (
              <ScrollCylinderPanel
                key={`panel-${i}`}
                progressRef={scrollProgressRef}
                radius={glassPanel.distance}
                angleSlot={i * panelAngleGap}
                totalRotation={scrollTotalRotation}
                baseY={panelBaseYs[i]}
                activeWindow={activeWindow}
              >
                {(highQuality) => (
                  <CurvedGlassPanel
                    position={[0, 0, 0]}
                    width={glassPanel.width}
                    height={glassPanel.height}
                    depth={glassPanel.depth}
                    curveAngleDeg={glassPanel.curveAngleDeg}
                    edgeBias={glassPanel.edgeBias}
                    edgeRadius={glassPanel.edgeRadius}
                    showMedia={glassPanel.showMedia}
                    mediaType={media.type}
                    mediaUrl={media.url}
                    transmission={glassPanel.transmission}
                    roughness={glassPanel.roughness}
                    thickness={glassPanel.thickness}
                    ior={glassPanel.ior}
                    clearcoat={glassPanel.clearcoat}
                    clearcoatRoughness={glassPanel.clearcoatRoughness}
                    chromaticAberration={glassPanel.chromaticAberration}
                    anisotropy={glassPanel.anisotropy}
                    distortion={glassPanel.distortion}
                    distortionScale={glassPanel.distortionScale}
                    temporalDistortion={glassPanel.temporalDistortion}
                    videoInset={glassPanel.videoInset}
                    videoParallaxStrength={glassPanel.videoParallaxStrength}
                    videoParallaxLerp={glassPanel.videoParallaxLerp}
                    highQuality={highQuality}
                    transmissionResolution={glassPanel.transmissionResolution}
                    transmissionSamples={glassPanel.transmissionSamples}
                  />
                )}
              </ScrollCylinderPanel>
            ))}
          </Suspense>
        </Parallax>

        <CylinderAutoSpin meshRef={cylinderMeshRef} speed={scene.cylinderSpinSpeed} />

        {/* Re-levels the camera + OrbitControls' own pivot to whichever
            panel's staircase height is currently centered, every frame —
            see CameraHeightFollow above for why this (not a one-time
            target prop) is what keeps the view level on load and gliding
            correctly between panels as they scroll past. */}
        <CameraHeightFollow
          progressRef={scrollProgressRef}
          panelBaseYs={panelBaseYs}
          controlsRef={orbitControlsRef}
          cylinderRef={cylinderMeshRef}
          baseCameraY={panelBaseYs[0]}
        />

        {/* A genuine orbit now — the camera sits outside the panel ring
            (see cameraOrbitDistance) looking at its axis, and dragging
            actually revolves the camera around that target rather than
            just rotating in place. Distance is loosely bounded around the
            camera's own resting distance so a bit of zoom is still
            possible without wandering off into the surrounding tube wall
            or in through the panel ring itself. Target's Y starts at the
            first panel's own height (matching the camera's initial
            position above) and is then driven every frame by
            CameraHeightFollow, not left static. */}
        {/* <OrbitControls
          ref={orbitControlsRef}
          makeDefault
          target={[0, panelBaseYs[0], 0]}
          minDistance={Math.max(scene.cameraOrbitDistance * 0.5, glassPanel.distance * 1.1)}
          maxDistance={Math.min(scene.cameraOrbitDistance * 2, cylinder.radius * 0.9)}
          enableZoom
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          autoRotate={scene.autoRotate}
          autoRotateSpeed={1}
        /> */}
      </Canvas>
    </div>
    </div>
  );
}
