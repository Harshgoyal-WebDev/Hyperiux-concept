"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

// RoundedBoxGeometry (three-stdlib) read as flat/uncurved once rounded, so
// this rounds our own plain BoxGeometry directly instead — same core trick
// (project each vertex outside an inset box back onto a sphere of `radius`
// around its clamped point), just applied to our own vertices, in local
// unbent space, BEFORE bendAroundVerticalAxis runs — so the bend always
// operates on the same kind of geometry it was already verified to curve
// correctly, rounded or not.
function roundBoxCorners(geometry, { halfWidth, halfHeight, halfDepth, radius }) {
  if (radius <= 0) return geometry;
  const r = Math.min(radius, halfWidth, halfHeight, halfDepth);
  const insetX = halfWidth - r;
  const insetY = halfHeight - r;
  const insetZ = halfDepth - r;

  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const cx = THREE.MathUtils.clamp(x, -insetX, insetX);
    const cy = THREE.MathUtils.clamp(y, -insetY, insetY);
    const cz = THREE.MathUtils.clamp(z, -insetZ, insetZ);

    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // Vertices strictly inside the inset box (dist=0, most of each flat
    // face) are untouched — only ones out past it, near an edge/corner,
    // get pulled onto the rounded fillet.
    if (dist > 1e-6) {
      const scale = r / dist;
      pos.setXYZ(i, cx + dx * scale, cy + dy * scale, cz + dz * scale);
    }
  }
  return geometry;
}

// Same technique as roundBoxCorners, but 2D (X/Y only — the video plane has
// no depth to round) — so the video's own visible corners match the box's
// rounded fillet instead of poking out past it as sharp rectangular
// corners.
function roundRectCorners(geometry, { halfWidth, halfHeight, radius }) {
  if (radius <= 0) return geometry;
  const r = Math.min(radius, halfWidth, halfHeight);
  const insetX = halfWidth - r;
  const insetY = halfHeight - r;

  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    const cx = THREE.MathUtils.clamp(x, -insetX, insetX);
    const cy = THREE.MathUtils.clamp(y, -insetY, insetY);

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1e-6) {
      const scale = r / dist;
      pos.setX(i, cx + dx * scale);
      pos.setY(i, cy + dy * scale);
    }
  }
  return geometry;
}

// Bends a flat geometry (built lying in the XY plane, thickness along
// local Z) around a vertical axis while staying flat top-to-bottom (Y is
// left untouched) — but NOT at a constant rate across the width. Local X is
// first normalized to -1..1 and passed through `sign(x) * |x|^edgeBias`
// before being turned into an angle: at edgeBias=1 that's linear (a plain
// constant-radius arc, bending evenly everywhere); at edgeBias>1 the curve
// stays nearly flat (near-zero curvature, and near-zero *rate of change* of
// curvature) through the middle and then sharpens toward the outer edges,
// while still reaching exactly `curveAngle` of total arc at the panel's own
// edges either way.
//
// This is what keeps MeshTransmissionMaterial's refraction/chromatic
// aberration — which is driven by how steeply the surface normal turns away
// from the camera — visually concentrated at the rim instead of smeared
// across the whole panel: the center is geometrically closer to flat, so
// there's barely anything for it to bend there.
//
// Local Z (thickness/depth) pushes a vertex further out/in along the same
// nominal radius, so the box keeps a consistent thickness across the curve
// instead of just its front face bending.
function bendAroundVerticalAxis(geometry, { curveRadius, halfWidth, curveAngle, edgeBias }) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const normalizedX = THREE.MathUtils.clamp(x / halfWidth, -1, 1);
    const eased = Math.sign(normalizedX) * Math.abs(normalizedX) ** edgeBias;
    const theta = eased * (curveAngle / 2);

    const effectiveRadius = curveRadius - z;
    // Recentered so theta=0 (the panel's own horizontal middle) lands
    // back near local Z=0, keeping the whole curved shape roughly where
    // its flat, unbent version would have been.
    pos.setX(i, Math.sin(theta) * effectiveRadius);
    pos.setZ(i, Math.cos(theta) * effectiveRadius - curveRadius);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Split out from the parent so the video/image element/texture are only
// ever created while media is actually wanted — CurvedGlassPanel
// conditionally renders this instead of building them unconditionally.
// Handles both `mediaType="video"` and `mediaType="image"` behind the same
// texture-swap interface, so the panel doesn't care which one it got.
//
// Parallax here is a straight X/Y translation (never rotation) of the whole
// media mesh, clamped to +/-maxOffsetX/Y — a rotation-based parallax (rocking
// it like the rest of the environment does) visibly swung it out from
// behind the glass's own edge. Translating instead, by an amount that can
// never exceed the built-in margin between the media's own (smaller) size
// and the box's, keeps it geometrically inside the panel at all times — the
// closest equivalent to CSS `overflow: hidden` available here, since there's
// no cheap way to clip an arbitrary curved MeshTransmissionMaterial shape.
function CurvedMediaPlane({ geometry, mediaType, mediaUrl, maxOffsetX, maxOffsetY, strength, lerp }) {
  const groupRef = useRef(null);
  const offsetRef = useRef(null);
  if (offsetRef.current === null) {
    offsetRef.current = { x: 0, y: 0 };
  }

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const offset = offsetRef.current;

    const targetX = state.pointer.x * maxOffsetX * strength;
    const targetY = state.pointer.y * maxOffsetY * strength;
    offset.x = THREE.MathUtils.lerp(offset.x, targetX, lerp);
    offset.y = THREE.MathUtils.lerp(offset.y, targetY, lerp);
    group.position.set(offset.x, offset.y, 0);
  });

  // PlaneGeometry's default UVs already span 0..1 across the whole surface
  // with no repeat, so the media is stretched to exactly fill the curved
  // panel edge to edge with no gaps or tiling — no extra UV/repeat setup
  // needed.
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (mediaType === "image") {
      let cancelled = false;
      const imageTexture = new THREE.TextureLoader().load(mediaUrl, () => {
        // Only handed to state once actually decoded — unlike the video
        // texture below (which is fine to expose "blank" and let frames
        // fill in live), a still image has nothing to progressively fill
        // in, so setting state early would just show a blank panel first.
        if (!cancelled) setTexture(imageTexture);
      });
      imageTexture.colorSpace = THREE.SRGBColorSpace;

      return () => {
        cancelled = true;
        imageTexture.dispose();
      };
    }

    const video = document.createElement("video");
    video.src = mediaUrl;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    // An unattached <video> gets its decode rate heavily throttled by the
    // browser (it's treated as invisible) — actually inserting it into the
    // DOM (off-screen and invisible, but present) is what unlocks full
    // frame-rate decoding for a video used purely as a texture source (see
    // PortalBackgroundVideo.jsx, where this was first worked out).
    video.style.position = "fixed";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);
    video.play().catch(() => {});

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    setTexture(videoTexture);

    return () => {
      video.pause();
      video.remove();
      video.src = "";
      videoTexture.dispose();
    };
  }, [mediaType, mediaUrl]);

  if (!texture) return null;

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function CurvedGlassPanel({
  position = [0, 0, -18],
  width = 16,
  height = 9,
  depth = 2.3,
  curveAngleDeg = 90,
  // How sharply the curve concentrates toward the edges — 1 = a plain
  // constant-radius arc; higher values keep the middle progressively
  // flatter/clearer, only really curving (and refracting/aberrating) near
  // the rim. See bendAroundVerticalAxis above.
  edgeBias = 3,
  // Fillet radius on the box's own edges/corners (in local, unbent space)
  // — 0 is a sharp box. See roundBoxCorners above.
  edgeRadius = 0.25,
  widthSegments = 48,
  heightSegments = 24,
  // Undivided depth (1 segment, front/back only) can't show any rounding
  // along the box's thin side faces — this needs real subdivision there
  // for the fillet to read as a smooth curve instead of a single facet.
  depthSegments = 8,
  showMedia = false,
  // "video" (default) or "image" — see CurvedMediaPlane above for how each
  // one builds its own texture.
  mediaType = "video",
  mediaUrl,
  transmission = 1,
  roughness = 0.02,
  thickness = 1.1,
  ior = 1.95,
  chromaticAberration = 0.9,
  anisotropy = 0,
  distortion = 0,
  distortionScale = 0,
  temporalDistortion = 0,
  clearcoat = 0,
  clearcoatRoughness = 0,
  // MeshTransmissionMaterial does a full extra scene render (its own
  // backdrop-capture FBO) every frame, per instance — cheap for one panel,
  // very much not for several running simultaneously regardless of
  // whether they're actually in view. `highQuality=false` swaps it for a
  // plain meshPhysicalMaterial instead: real transmission/clearcoat, just
  // without that per-frame backdrop pass, for panels that are parked away
  // from focus and don't need the expensive version.
  highQuality = true,
  transmissionResolution = 1024,
  transmissionSamples = 8,
  // Fraction of the box's own width/height the media is built at (< 1) —
  // the gap this leaves is the margin the parallax offset below is clamped
  // within, so the media can shift without ever reaching the box's edge.
  videoInset = 0.88,
  // Independent mouse parallax on the media itself, nested inside the
  // panel's own (also mouse-parallaxed) position — a second, apart layer
  // of motion, not just riding along with the glass around it.
  videoParallaxStrength = 0.08,
  videoParallaxLerp = 0.08,
}) {
  // `width` is the panel's own visible CHORD width (its on-screen span,
  // left edge to right edge) — curveRadius is picked so that bending
  // `curveAngle` of arc produces exactly that chord (chord = 2*r*sin(a/2)),
  // not so that `width` of ARC LENGTH gets consumed by the bend. The
  // difference matters: with radius sized off arc length instead, the same
  // material length has to fit a smaller and smaller chord as the angle
  // grows, so the whole panel visibly shrank/grew as `curveAngleDeg`
  // changed — reading as "scaling", not curving, even though the geometry
  // was technically bending correctly. Sizing off the chord keeps the
  // visible width fixed at `width` for any angle; only how far the edges
  // curve back in depth changes.
  //
  // Clamped just above zero: at curveAngleDeg=0 (a value the Leva slider
  // allows), sin(0)=0 would make curveRadius width/0 = Infinity, and
  // sin(theta)*Infinity resolves to NaN instead of the flat panel that's
  // actually the correct zero-curve limit.
  const curveAngle = Math.max(THREE.MathUtils.degToRad(curveAngleDeg), 0.001);
  const curveRadius = width / (2 * Math.sin(curveAngle / 2));
  const halfWidth = width / 2;

  const glassGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(width, height, depth, widthSegments, heightSegments, depthSegments);
    roundBoxCorners(geo, { halfWidth: width / 2, halfHeight: height / 2, halfDepth: depth / 2, radius: edgeRadius });
    return bendAroundVerticalAxis(geo, { curveRadius, halfWidth, curveAngle, edgeBias });
  }, [
    width,
    height,
    depth,
    widthSegments,
    heightSegments,
    depthSegments,
    edgeRadius,
    curveRadius,
    halfWidth,
    curveAngle,
    edgeBias,
  ]);

  // Built smaller than the box (by `videoInset`) and bent using the BOX's
  // own halfWidth for normalization (not its own, smaller half-width) —
  // that keeps its curvature an exact sub-slice of the box's own curve at
  // any given X, rather than a narrower strip curving MORE sharply to
  // still reach the same total curveAngle over less width. Sits at the
  // box's own mid-depth — literally inside the glass volume, between its
  // front and back faces — so it reads as media trapped inside a block of
  // glass. Corners rounded the same way (and by the same `edgeRadius`) as
  // the glass box. Only built/used while `showMedia` is on.
  const mediaWidth = width * videoInset;
  const mediaHeight = height * videoInset;
  const maxOffsetX = (width - mediaWidth) / 2;
  const maxOffsetY = (height - mediaHeight) / 2;

  const mediaGeometry = useMemo(() => {
    if (!showMedia) return null;
    const geo = new THREE.PlaneGeometry(mediaWidth, mediaHeight, widthSegments, heightSegments);
    roundRectCorners(geo, { halfWidth: mediaWidth / 2, halfHeight: mediaHeight / 2, radius: edgeRadius });
    return bendAroundVerticalAxis(geo, { curveRadius, halfWidth, curveAngle, edgeBias });
  }, [
    showMedia,
    mediaWidth,
    mediaHeight,
    widthSegments,
    heightSegments,
    edgeRadius,
    curveRadius,
    halfWidth,
    curveAngle,
    edgeBias,
  ]);

  return (
    <group position={position}>
      {showMedia && mediaUrl && (
        <CurvedMediaPlane
          geometry={mediaGeometry}
          mediaType={mediaType}
          mediaUrl={mediaUrl}
          maxOffsetX={maxOffsetX}
          maxOffsetY={maxOffsetY}
          strength={videoParallaxStrength}
          lerp={videoParallaxLerp}
        />
      )}

      <mesh geometry={glassGeometry}>
        {highQuality ? (
          <MeshTransmissionMaterial
            transmission={transmission}
            roughness={roughness}
            thickness={thickness}
            ior={ior}
            chromaticAberration={chromaticAberration}
            anisotropy={anisotropy}
            distortion={distortion}
            distortionScale={distortionScale}
            temporalDistortion={temporalDistortion}
            clearcoat={clearcoat}
            clearcoatRoughness={clearcoatRoughness}
            color="#ffffff"
            specularIntensity={1}
            specularColor="#ffffff"
            // MeshTransmissionMaterial renders everything behind/inside
            // the glass (the video plane included) into its own internal
            // buffer at this resolution, THEN the glass samples from that
            // buffer — too low and the video reads as pixelated/blurry no
            // matter how sharp the source is; too high (multiplied across
            // however many panels are simultaneously `highQuality`) is
            // what actually causes the lag. `samples` is the blur quality
            // (how many times that buffer gets re-sampled for roughness/
            // distortion).
            samples={transmissionSamples}
            resolution={transmissionResolution}
            side={THREE.DoubleSide}
          />
        ) : (
          // No per-frame backdrop capture — three.js's own (much cheaper)
          // built-in transmission approximation, for panels that are
          // parked away from focus and don't need the expensive version.
          <meshPhysicalMaterial
            transmission={transmission}
            roughness={roughness}
            thickness={thickness}
            ior={ior}
            clearcoat={clearcoat}
            clearcoatRoughness={clearcoatRoughness}
            color="#ffffff"
            side={THREE.DoubleSide}
          />
        )}
      </mesh>
    </group>
  );
}
