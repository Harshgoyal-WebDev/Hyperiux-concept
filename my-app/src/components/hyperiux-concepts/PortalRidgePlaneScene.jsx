"use client";

import { Suspense, createRef, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid, useFBO } from "@react-three/drei";
import { useControls } from "leva";
import * as THREE from "three";
import { createCubeGridTexture } from "../RidgePlane/cubeGridTexture";
import CurvedGlassPanel from "../RidgePlane/CurvedGlassPanel";
import Parallax from "./Parallax";
import OurWorkBand from "./OurWorkBand";

// The "other side" of the shockwave portal — the same cylinder + curved
// glass panel showcase as the standalone RidgePlane page (see
// src/components/RidgePlane/RidgePlane.jsx), ported to run as
// PortalRenderer's `portalScene` content instead: no own <Canvas>/scroll-
// listener (Hero.jsx owns those), but it does get its own camera, injected
// by PortalRenderer, separate from the hero's.
//
// `ridgeProgressRef` (0..1 across a 300vh stretch that only starts once the
// portal has fully finished opening) drives the panel rotation and the
// camera's descent through the panels. It stays at 0 for the whole reveal,
// so during the reveal the camera sits at a fixed "panel 0" framing.

function wrapAngle(theta) {
  const twoPi = Math.PI * 2;
  let t = theta % twoPi;
  if (t > Math.PI) t -= twoPi;
  if (t < -Math.PI) t += twoPi;
  return t;
}

function CylinderAutoSpin({ meshRef, speed }) {
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.y += speed * delta;
  });
  return null;
}

// `entryAngle`/`entryY` offset the whole ring at the moment the portal
// opens (ridgeProgress 0) and ease out linearly to nothing by the end of
// the scroll, so the end state — last panel dead center — is unchanged;
// the ring just sweeps through that much extra rotation/height on the way.
function ScrollCylinderPanel({
  progressRef,
  radius,
  angleSlot,
  totalRotation,
  baseY,
  entryAngle = 0,
  entryY = 0,
  // Focus ramp: replaces the old binary highQuality swap (which remounted
  // the material and popped from very blurry to sharp in one frame). Now
  // every panel keeps the same material; only its roughness eases from
  // `offCenterRoughness` (at >= focusFalloff from center) down to
  // `roughness` (dead center), continuously, every frame.
  roughness,
  offCenterRoughness,
  focusFalloff,
  glassRef,
  children,
}) {
  const groupRef = useRef(null);
  const materialRef = useRef(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const overall = progressRef.current ?? 0;
    const remaining = 1 - overall;
    const theta = wrapAngle(angleSlot - overall * totalRotation + entryAngle * remaining);

    group.position.set(radius * Math.sin(theta), baseY + entryY * remaining, radius * Math.cos(theta));
    group.rotation.set(0, theta, 0);

    const material = materialRef.current;
    if (material) {
      const absTheta = Math.abs(theta);
      const focus = 1 - THREE.MathUtils.smoothstep(absTheta, focusFalloff * 0.15, focusFalloff);
      material.roughness = THREE.MathUtils.lerp(offCenterRoughness, roughness, focus);
    }
  });

  return <group ref={groupRef}>{children({ glassRef, materialRef })}</group>;
}

// One backdrop capture per frame, shared by every glass panel (passed to
// each MeshTransmissionMaterial as `buffer`). Previously each in-focus
// panel rendered the whole scene into its own buffer and out-of-focus
// ones fell back to a different, low-res material — the swap between the
// two is what glitched. Now all panels always use the same high-quality
// material, and the total cost is ONE extra scene render regardless of
// panel count. Glass meshes are hidden during the capture (the videos
// inside them stay visible, so they still show through the glass).
// Skipped entirely until the portal actually starts opening.
function SharedGlassBackdrop({ fbo, glassRefs, activeRef }) {
  useFrame((state) => {
    if ((activeRef?.current ?? 1) <= 0.02) return;
    const { gl, scene, camera } = state;
    const prevTarget = gl.getRenderTarget();
    const prevTone = gl.toneMapping;

    const hidden = [];
    for (const ref of glassRefs) {
      const mesh = ref.current;
      if (mesh && mesh.visible) {
        mesh.visible = false;
        hidden.push(mesh);
      }
    }

    // Same as MeshTransmissionMaterial's own capture: no tone mapping in
    // the buffer, or it gets tone-mapped twice.
    gl.toneMapping = THREE.NoToneMapping;
    gl.setRenderTarget(fbo);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(prevTarget);
    gl.toneMapping = prevTone;

    for (const mesh of hidden) mesh.visible = true;
  });
  return null;
}

// Drives this scene's OWN camera (PortalRenderer injects a dedicated camera
// into this portal, so state.camera here is not the hero's) — always at the
// ridge framing, so the scene is correctly sized from the very first frame
// of the reveal instead of starting zoomed in on the hero's camera
// position. Descends through the panels' staircase heights as
// ridgeProgressRef climbs, which only happens after the portal has fully
// opened.
function PortalCameraFollow({ ridgeProgressRef, panelBaseYs, cylinderRef, cameraOrbitDistance }) {
  useFrame((state) => {
    const raw = THREE.MathUtils.clamp(ridgeProgressRef.current ?? 0, 0, 1);
    const n = panelBaseYs.length;
    const continuous = THREE.MathUtils.clamp(raw * (n - 1), 0, n - 1);
    const i0 = Math.min(Math.floor(continuous), n - 2);
    const i1 = i0 + 1;
    const frac = continuous - i0;
    const targetY = THREE.MathUtils.lerp(panelBaseYs[i0], panelBaseYs[i1], frac);

    const cam = state.camera;
    cam.position.set(0, targetY, cameraOrbitDistance);
    cam.lookAt(0, targetY, 0);

    // Cancels the room's own apparent vertical drift the same way
    // RidgePlane.jsx's CameraHeightFollow does — the big background
    // cylinder never actually moves, but the camera's height does (that's
    // the whole staircase effect), so relative to the camera a static
    // room would otherwise read as sliding upward while scrolling down.
    const cylinder = cylinderRef.current;
    if (cylinder) {
      cylinder.position.y = targetY - panelBaseYs[0];
    }
  });

  return null;
}

// three.js's OWN automatic transmission pass (separate from drei's
// MeshTransmissionMaterial's own transmissionResolution) — fires for ANY
// transmissive material in the WHOLE shared canvas, at full resolution by
// default. This is a renderer-level setting, so it's safe to set here even
// though it's shared with Hero's own scene — nothing else in this canvas
// uses transmission once the portal no longer holds the frosted glass logo.
function NativeTransmissionScale({ value }) {
  useFrame((state) => {
    if (state.gl.transmissionResolutionScale !== value) {
      state.gl.transmissionResolutionScale = value;
    }
  });
  return null;
}

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

    let local = ((theta % period) + period) % period;
    if (local > halfPeriod) local -= period;

    const t = THREE.MathUtils.clamp(Math.abs(local) / halfPeriod, 0, 1);
    const s = 1 - t;
    const envelope = (s * s * (3 - 2 * s)) ** sharpness;
    const newRadius = radius - amplitude * envelope;

    pos.setX(i, Math.cos(theta) * newRadius);
    pos.setZ(i, Math.sin(theta) * newRadius);
    pos.setY(i, y);
  }

  geo.computeVertexNormals();
  return geo;
}

// EdgesGeometry (angle-threshold edge detection) can't tell "the diagonal
// splitting one quad into two triangles" apart from "the seam between two
// vertically-stacked quads" on this cylinder — neither has any real bend to
// it (the surface only curves around the circumference, never along its
// height), so both get treated as equally flat and dropped, which is why
// the horizontal ring lines vanished along with the diagonals. This builds
// the wireframe directly from the geometry's own known vertex layout
// instead: three.js's CylinderGeometry (openEnded, no caps) lays vertices
// out as `heightSegments+1` rows of `radialSegments+1` columns each, in
// that exact row-major order — so "connect adjacent columns within a row"
// and "connect adjacent rows within a column" reconstructs precisely the
// horizontal + vertical grid lines, with no diagonal ever entering the
// picture to begin with.
function buildCylinderGridEdges(positionAttribute, radialSegments, heightSegments) {
  const cols = radialSegments + 1;
  const rows = heightSegments + 1;
  const linePositions = [];

  const pushVertex = (row, col) => {
    const i = row * cols + col;
    linePositions.push(positionAttribute.getX(i), positionAttribute.getY(i), positionAttribute.getZ(i));
  };

  // Horizontal ring lines.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols - 1; col++) {
      pushVertex(row, col);
      pushVertex(row, col + 1);
    }
  }

  // Vertical lines.
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows - 1; row++) {
      pushVertex(row, col);
      pushVertex(row + 1, col);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  return geo;
}

const PANEL_COUNT = 3;
const DEFAULT_PANEL_MEDIA = [
  { type: "video", url: "/assets/videos/patronum.mp4" },
  { type: "video", url: "/assets/videos/gcm.mp4" },
  { type: "video", url: "/assets/videos/kedarkala.mp4" },
];

export default function PortalRidgePlaneScene({ ridgeProgressRef, portalProgressRef, pointerRef, store }) {
  const cylinder = useControls(
    "Cylinder",
    {
      radius: { value: 86, min: 1, max: 200, step: 0.5 },
      height: { value: 250, min: 5, max: 350, step: 1, label: "height (tall)" },
      // Lowered from 128/64 — this mesh gets drawn TWICE a frame (once for
      // the main view, once again inside MeshTransmissionMaterial's own
      // backdrop capture for whichever panel is highQuality), and at
      // Ridge>amplitude=0 (no dents) the extra tessellation has zero visual
      // effect anyway — pure wasted vertex cost.
      radialSegments: { value: 114, min: 8, max: 256, step: 1, label: "resolution (around)" },
      heightSegments: { value: 53, min: 4, max: 200, step: 1, label: "resolution (vertical)" },
      color: { value: "#9a9a9a", label: "color" },
      emissive: { value: "#9a9a9a", label: "emissive" },
      roughness: { value: 1.0, min: 0, max: 1, step: 0.01 },
      metalness: { value: 0.0, min: 0, max: 1, step: 0.01 },
      wireframe: { value: false },
    },
    { store }
  );

  const texture = useControls(
    "Texture",
    {
      enabled: { value: true, label: "cube grid texture" },
      outlineColor: { value: "#909090", label: "cube outline color" },
      cubeWorldSize: { value: 6.5, min: 0.5, max: 40, step: 0.5, label: "cube size (world units)" },
      size: { value: 90, min: 8, max: 256, step: 1, label: "cube detail size" },
      heightScale: { value: 1.03, min: 0.2, max: 3, step: 0.02, label: "cube height scale" },
      rotationDeg: { value: 0, min: -180, max: 180, step: 1, label: "cube rotation" },
    },
    { store }
  );

  const ridge = useControls(
    "Ridge",
    {
      amplitude: { value: 0, min: 0, max: 15, step: 0.1, label: "dent depth" },
      sharpness: { value: 0.2, min: 0.2, max: 6, step: 0.1, label: "crest sharpness" },
      frequency: { value: 8, min: 1, max: 48, step: 1, label: "number of dents (around)" },
    },
    { store }
  );

  const glassPanel = useControls(
    "Glass Panel",
    {
    distance: { value: 22, min: 2, max: 100, step: 1, label: "distance from camera" },
    width: { value: 16, min: 2, max: 60, step: 0.5, label: "width (arc length)" },
    height: { value: 9, min: 2, max: 40, step: 0.5 },
    depth: { value: 0.2, min: 0.05, max: 5, step: 0.05, label: "thickness" },
    curveAngleDeg: { value: 30, min: 0, max: 180, step: 1, label: "curve angle" },
    edgeBias: { value: 1, min: 1, max: 8, step: 0.25, label: "edge curve bias" },
    edgeRadius: { value: 0.17, min: 0, max: 3, step: 0.01, label: "edge roundness" },
    showMedia: { value: true, label: "show video/image" },
    transmission: { value: 1, min: 0, max: 1, step: 0.01, label: "glass transmission" },
    roughness: { value: 0.2, min: 0, max: 1, step: 0.01, label: "frost (roughness)" },
    thickness: { value: 0.95, min: 0, max: 5, step: 0.05, label: "glass thickness (refraction depth)" },
    ior: { value: 1.14, min: 0, max: 2.5, step: 0.01, label: "glass IOR" },
    clearcoat: { value: 3, min: 0, max: 3, step: 0.01, label: "surface shine (clearcoat)" },
    clearcoatRoughness: { value: 0.05, min: 0, max: 3, step: 0.01, label: "shine sharpness" },
    chromaticAberration: { value: 0.15, min: 0, max: 4, step: 0.05, label: "glass chromatic split" },
    anisotropy: { value: 0.0, min: 0, max: 2, step: 0.01, label: "glass anisotropy" },
    distortion: { value: 0.15, min: 0, max: 2, step: 0.02, label: "video distortion (magnify)" },
    distortionScale: { value: 0.38, min: 0, max: 2, step: 0.02, label: "distortion scale" },
    temporalDistortion: { value: 0.2, min: 0, max: 1, step: 0.01, label: "distortion shimmer" },
    videoInset: { value: 0.95, min: 0.5, max: 1, step: 0.01, label: "video inset (size vs. box)" },
    videoParallaxStrength: {
      value: 0.8,
      min: 0,
      max: 3,
      step: 0.01,
      label: "video parallax strength (of margin)",
    },
    videoParallaxLerp: { value: 0.08, min: 0.01, max: 0.3, step: 0.01, label: "video parallax smoothing" },
    // MeshTransmissionMaterial's own backdrop-capture buffer — the actual
    // per-frame cost driver, and a big lever on overall lag. Only ever 1-2
    // panels pay this cost at once (see "high-quality window" below), but
    // each occurrence is a full extra scene render, so this is worth
    // keeping as low as still reads clean.
    transmissionResolution: {
      value: 1920,
      min: 256,
      max: 2048,
      step: 128,
      label: "perf: transmission resolution",
    },
    transmissionSamples: { value: 6, min: 2, max: 16, step: 1, label: "perf: transmission samples" },
    },
    { store }
  );

  const ridgeScene = useControls("Ridge Scene", {
    background: "#ffffff",
    showGrid: { value: false, label: "show reference floor grid" },
    parallaxStrength: { value: 0.02, min: 0, max: 1, step: 0.01, label: "mouse parallax strength" },
    parallaxLerp: { value: 0.06, min: 0.01, max: 0.3, step: 0.01, label: "mouse parallax smoothing" },
    cylinderSpinSpeed: { value: 0.05, min: 0, max: 0.2, step: 0.005, label: "cylinder spin speed" },
    // Same as the standalone RidgePlane page — this scene now has its own
    // fov 55 camera (see PortalRenderer), so the page's values carry over.
    cameraOrbitDistance: { value: 40, min: 6, max: 200, step: 1, label: "camera orbit distance" },
    // three.js's OWN automatic transmission capture resolution (0-1, scales
    // the canvas' own size) — see NativeTransmissionScale above. A much
    // bigger lever on lag than transmissionResolution above (that one only
    // covers drei's own extra buffer); this one governs a separate
    // full-scene capture that fires for ANY transmissive material, at full
    // canvas resolution by default.
    nativeTransmissionScale: {
      value: 0.2,
      min: 0.05,
      max: 1,
      step: 0.05,
      label: "perf: native transmission scale",
    },
  }, { store });

  const scrollMotion = useControls("Scroll Motion", {
    panelHeightStep: { value: 11.5, min: -40, max: 40, step: 0.5, label: "panel height step (staircase)" },
    // Angular spacing between adjacent panels — the ring's own total
    // rotation is derived straight from this so the last panel still
    // centers at ridgeProgressRef=1, just over a tighter or wider sweep.
    panelAngleGapDeg: { value: 53, min: 10, max: 170, step: 1, label: "panel angle gap (deg)" },
    // Where the whole ring starts when the portal opens, relative to its
    // usual start — both ease out to 0 across the ridge scroll, so the end
    // state (last panel centered) is unchanged. Y is a percentage of the
    // panel staircase's full height span (panelHeightStep x (panels - 1)).
    entryRotationDeg: { value: 90, min: -180, max: 180, step: 1, label: "entry: extra rotation (deg)" },
    entryYPercent: { value: -80, min: -200, max: 200, step: 1, label: "entry: Y offset (% of staircase)" },
    // Replaces the old "high-quality window" on/off swap: panels now
    // smoothly frost up as they rotate away from center, and sharpen
    // (down to Glass Panel > frost) as they arrive.
    offCenterRoughness: { value: 0.45, min: 0, max: 1, step: 0.01, label: "focus: off-center frost" },
    focusFalloffDeg: { value: 45, min: 5, max: 120, step: 1, label: "focus: falloff (deg)" },
  }, { store });

  const ourWork = useControls("Our Work Band", {
    enabled: { value: true, label: "show band" },
    text: { value: "OUR WORK" },
    y: { value: 15.5, min: -120, max: 120, step: 0.5, label: "height (y)" },
    rotationDeg: { value: 0, min: -180, max: 180, step: 1, label: "rotation around ring (deg)" },
    size: { value: 15.5, min: 1, max: 30, step: 0.25, label: "letter size" },
    depth: { value: 2.15, min: 0.05, max: 6, step: 0.05, label: "extrude depth" },
    gap: { value: 13, min: 0, max: 60, step: 0.5, label: "gap between repeats" },
    inset: { value: 1.6, min: 0, max: 20, step: 0.1, label: "inset from wall" },
    color: { value: "#111111" },
    emissiveIntensity: { value: 0.35, min: 0, max: 3, step: 0.05, label: "glow (emissive)" },
  }, { store });

  const panelAngleGap = THREE.MathUtils.degToRad(scrollMotion.panelAngleGapDeg);
  const scrollTotalRotation = (PANEL_COUNT - 1) * panelAngleGap;
  const focusFalloff = THREE.MathUtils.degToRad(scrollMotion.focusFalloffDeg);
  const entryAngle = THREE.MathUtils.degToRad(scrollMotion.entryRotationDeg);
  const entryY = (scrollMotion.entryYPercent / 100) * Math.abs(scrollMotion.panelHeightStep) * (PANEL_COUNT - 1);

  const panelMedia = useControls("Panel Media", {
    panel1Type: { value: DEFAULT_PANEL_MEDIA[0].type, options: ["video", "image"], label: "panel 1 type" },
    panel1Url: { value: DEFAULT_PANEL_MEDIA[0].url, label: "panel 1 url" },
    panel2Type: { value: DEFAULT_PANEL_MEDIA[1].type, options: ["video", "image"], label: "panel 2 type" },
    panel2Url: { value: DEFAULT_PANEL_MEDIA[1].url, label: "panel 2 url" },
    panel3Type: { value: DEFAULT_PANEL_MEDIA[2].type, options: ["video", "image"], label: "panel 3 type" },
    panel3Url: { value: DEFAULT_PANEL_MEDIA[2].url, label: "panel 3 url" },
  }, { store });
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

  const wireGeometry = useMemo(
    () => buildCylinderGridEdges(geometry.attributes.position, cylinder.radialSegments, cylinder.heightSegments),
    [geometry, cylinder.radialSegments, cylinder.heightSegments]
  );

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
    const circumference = 2 * Math.PI * cylinder.radius;
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

  // Shared transmission backdrop (see SharedGlassBackdrop) — width set by
  // Glass Panel > transmission resolution, height follows the canvas.
  const backdropFbo = useFBO(glassPanel.transmissionResolution);
  const [glassRefs] = useState(() => Array.from({ length: PANEL_COUNT }, () => createRef()));

  const panelBaseYs = useMemo(
    () => Array.from({ length: PANEL_COUNT }, (_, i) => eyeHeight - i * scrollMotion.panelHeightStep),
    [eyeHeight, scrollMotion.panelHeightStep]
  );

  return (
    <>
      <color attach="background" args={[ridgeScene.background]} />
      <NativeTransmissionScale value={ridgeScene.nativeTransmissionScale} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, cylinder.height, 8]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-14, eyeHeight + 6, -12]} intensity={0.9} color="#dfe8ff" />
      <directionalLight position={[0, eyeHeight - 4, 10]} intensity={0.7} color="#ffe9d0" />
      <pointLight position={[0, eyeHeight, 0]} intensity={3} distance={cylinder.radius * 4} decay={2} />

      {ridgeScene.showGrid && (
        <Grid
          position={[0, 0, 0]}
          args={[cylinder.radius * 4, cylinder.radius * 4]}
          cellColor="#333333"
          sectionColor="#555555"
          fadeDistance={60}
          fadeStrength={1}
        />
      )}

      <Parallax
        center={[0, eyeHeight, glassPanel.distance]}
        strength={ridgeScene.parallaxStrength}
        lerp={ridgeScene.parallaxLerp}
        pointerRef={pointerRef}
      >
        {/* Built from the geometry's own known row/column vertex layout
            (see buildCylinderGridEdges) rather than EdgesGeometry's
            angle-threshold detection — this cylinder only curves around
            its circumference, never along its height, so EdgesGeometry
            couldn't tell "the diagonal splitting a quad into 2 triangles"
            apart from "the seam between two vertically-stacked quads" (both
            equally flat) and dropped both, losing the horizontal rings
            along with the diagonals. */}
        <lineSegments ref={cylinderMeshRef} geometry={wireGeometry}>
          <lineBasicMaterial color={cylinder.color} />
          {/* Child of the wireframe so it spins and follows the camera
              height together with the cylinder wall it's stuck to. */}
          {ourWork.enabled && (
            <OurWorkBand
              text={ourWork.text}
              radius={cylinder.radius}
              inset={ourWork.inset}
              y={ourWork.y}
              rotationDeg={ourWork.rotationDeg}
              size={ourWork.size}
              depth={ourWork.depth}
              gap={ourWork.gap}
              color={ourWork.color}
              emissiveIntensity={ourWork.emissiveIntensity}
            />
          )}
        </lineSegments>

        <Suspense fallback={null}>
          {panelMediaList.map((media, i) => (
            <ScrollCylinderPanel
              key={`panel-${i}`}
              progressRef={ridgeProgressRef}
              radius={glassPanel.distance}
              angleSlot={i * panelAngleGap}
              totalRotation={scrollTotalRotation}
              baseY={panelBaseYs[i]}
              entryAngle={entryAngle}
              entryY={entryY}
              roughness={glassPanel.roughness}
              offCenterRoughness={scrollMotion.offCenterRoughness}
              focusFalloff={focusFalloff}
              glassRef={glassRefs[i]}
            >
              {({ glassRef, materialRef }) => (
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
                  transmissionBuffer={backdropFbo.texture}
                  glassRef={glassRef}
                  materialRef={materialRef}
                  transmissionSamples={glassPanel.transmissionSamples}
                />
              )}
            </ScrollCylinderPanel>
          ))}
        </Suspense>
      </Parallax>

      <SharedGlassBackdrop fbo={backdropFbo} glassRefs={glassRefs} activeRef={portalProgressRef} />

      <CylinderAutoSpin meshRef={cylinderMeshRef} speed={ridgeScene.cylinderSpinSpeed} />

      <PortalCameraFollow
        ridgeProgressRef={ridgeProgressRef}
        panelBaseYs={panelBaseYs}
        cylinderRef={cylinderMeshRef}
        cameraOrbitDistance={ridgeScene.cameraOrbitDistance}
      />
    </>
  );
}
