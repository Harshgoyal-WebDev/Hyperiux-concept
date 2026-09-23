"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { createTerrainSampler } from "./terrainNoise";
import { createGrainTexture } from "./grainTexture";
import { createRockStriationTextures } from "./rockTexture";

const DIRT_DIFFUSE_MAP = "/assets/textures/dirt/dirt_diff_1k.jpg";
const DIRT_BUMP_MAP = "/assets/textures/dirt/dirt_disp_1k.jpg";

export default function Terrain({
  width = 40,
  depth = 40,
  segments = 220,
  position = [0,1, 0],
  height = 2.9,
  basinRadius = 33,
  basinDepth = 2.1,
  ruggedness = 0.45,
  ridgeSharpness = 0.85,
  warpStrength = 0.6,
  transitionWidth = 15,
  // How many peaks fit across the terrain — lower is fewer/bigger, see
  // terrainNoise.js for why this (not ruggedness/ridgeSharpness) is the
  // actual "peak count" knob.
  rollingFrequency = 0.018,
  ridgedFrequency = 0.028,
  seed = 7,
  color = "#5a4632",
  roughness = 0.95,
  grainIntensity = 0.6,
  grainScale = 4,
  dirtScale = 10,
  dirtBumpScale = 0.6,
  // Bare-rock tint blended in on steep slopes and high elevations (via
  // per-vertex color, see the geometry builder below) — the dirt texture
  // alone reads as flat ground everywhere; real mountains go gray/rocky on
  // their steep faces and peaks while keeping the dirt tone on gentler
  // low-lying ground.
  rockColor = "#77716a",
  rockSlopeStart = 0.35,
  rockSlopeEnd = 0.75,
  // Coarse vertical fluting/striation, like real rock faces carved by
  // water and wind — layered on top of the dirt bump and fine grain as a
  // normal map, at a much bigger world-space scale than either of those so
  // it reads as broad grooves across a whole slope, not repeated noise.
  rockStriationScale = 12,
  rockStriationIntensity = 0.9,
  rockStriationStretch = 3.5,
}) {
  const materialRef = useRef(null);

  // Real photographed dirt (diffuse color + height relief), tiled across the
  // whole ground — the procedural grain alone was just fine speckle with no
  // actual dirt detail (clumps, cracks, small rock texture) underneath it.
  const [dirtMap, dirtBumpMap] = useTexture([DIRT_DIFFUSE_MAP, DIRT_BUMP_MAP]);
  useEffect(() => {
    dirtMap.colorSpace = THREE.SRGBColorSpace;
    for (const tex of [dirtMap, dirtBumpMap]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(width / dirtScale, depth / dirtScale);
      tex.needsUpdate = true;
    }
  }, [dirtMap, dirtBumpMap, width, depth, dirtScale]);

  // Canvas isn't available during SSR, so the grain texture is built
  // client-side after mount (same pattern as Hero's wetness maps).
  const [grainMap, setGrainMap] = useState(null);
  useEffect(() => {
    setGrainMap(createGrainTexture({ seed, intensity: grainIntensity }));
  }, [seed, grainIntensity]);

  useEffect(() => {
    if (!grainMap) return;
    // grainScale is the world-space size of one tile — repeat count scales
    // with terrain size so the grain stays a consistent fine speckle
    // instead of stretching into visible blotches on a larger ground.
    grainMap.repeat.set(width / grainScale, depth / grainScale);
    grainMap.needsUpdate = true;

    // The material's very first compile happens before this texture
    // exists (it's built async, after mount), so its shader program is
    // compiled without bump-map support — `bumpMap` is a compile-time
    // `#define`, not a uniform. Assigning the prop afterward mutates the
    // material but doesn't by itself trigger a recompile, so without this
    // the grain silently never appears no matter the intensity/scale.
    if (materialRef.current) materialRef.current.needsUpdate = true;
  }, [grainMap, width, depth, grainScale]);

  // Same async-after-mount reasoning as the grain texture above.
  const [rockNormalMap, setRockNormalMap] = useState(null);
  useEffect(() => {
    const { normalTexture } = createRockStriationTextures({
      seed: seed + 101,
      stretch: rockStriationStretch,
    });
    setRockNormalMap(normalTexture);
  }, [seed, rockStriationStretch]);

  useEffect(() => {
    if (!rockNormalMap) return;
    rockNormalMap.repeat.set(width / rockStriationScale, depth / rockStriationScale);
    rockNormalMap.needsUpdate = true;
    if (materialRef.current) materialRef.current.needsUpdate = true;
  }, [rockNormalMap, width, depth, rockStriationScale]);

  const geometry = useMemo(() => {
    const getElevation = createTerrainSampler({
      seed,
      height,
      basinRadius,
      basinDepth,
      ruggedness,
      ridgeSharpness,
      warpStrength,
      transitionWidth,
      rollingFrequency,
      ridgedFrequency,
    });

    const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, getElevation(x, y));
    }

    geo.computeVertexNormals();

    // Per-vertex rock tint: real mountains go bare/gray on steep faces and
    // high peaks, keeping the dirt tone only on gentler, lower ground —
    // sampled here (not painted as a texture) since slope/elevation are
    // exactly the geometry data already being built. `rockColor`/`color`
    // are read fresh each rebuild (not deps of this memo — see below), so
    // multiplied against `map` this needs `vertexColors` on the material.
    const normal = geo.attributes.normal;
    const colorAttr = new Float32Array(pos.count * 3);
    const dirt = new THREE.Color(color);
    const rock = new THREE.Color(rockColor);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      // Geometry is built flat (XY) before the -90°-around-X rotation that
      // lays it down, so local +Z is "up" here — normal.z near 1 means
      // flat/facing up, lower values mean a steep face.
      const slope = 1 - normal.getZ(i);
      const elevationT = THREE.MathUtils.clamp(pos.getZ(i) / Math.max(height, 0.001), 0, 1);
      const rockT = THREE.MathUtils.clamp(
        Math.max(
          THREE.MathUtils.smoothstep(slope, rockSlopeStart, rockSlopeEnd),
          elevationT * 0.5
        ),
        0,
        1
      );
      tmp.copy(dirt).lerp(rock, rockT);
      colorAttr[i * 3 + 0] = tmp.r;
      colorAttr[i * 3 + 1] = tmp.g;
      colorAttr[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colorAttr, 3));

    return geo;
  }, [
    width,
    depth,
    segments,
    height,
    basinRadius,
    basinDepth,
    ruggedness,
    ridgeSharpness,
    warpStrength,
    transitionWidth,
    rollingFrequency,
    ridgedFrequency,
    seed,
    color,
    rockColor,
    rockSlopeStart,
    rockSlopeEnd,
  ]);

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      {/* Real dirt photo (map) carries the actual color/detail — clumps,
          cracks, small rock texture — that plain procedural grain never
          had. Its own height map (dirtBumpMap) drives the coarse surface
          relief; the finer procedural grain layers on top as a second,
          much smaller-scale bumpMap-like roughness variance so the ground
          still reads as fine sand/dust up close, not just a flat photo
          texture. The dirt/rock tint itself now comes from per-vertex
          colors baked into the geometry (see above), so `color` stays
          neutral here — setting it to the dirt color again would multiply
          the tint in twice. */}
      <meshStandardMaterial
        ref={materialRef}
        color="#ffffff"
        vertexColors
        map={dirtMap}
        bumpMap={dirtBumpMap}
        bumpScale={dirtBumpScale}
        // Broad vertical fluting on top of the dirt's own fine relief —
        // see rockTexture.js. Applies everywhere (not just the gray rock
        // vertex-tint areas), but reads strongest on steep, brightly-lit
        // slopes where the raking light actually catches the grooves.
        normalMap={rockNormalMap}
        normalScale={[rockStriationIntensity, rockStriationIntensity]}
        // roughnessMap varies the actual specular response per-pixel
        // (matte vs. slightly sheen), which reads as a "dusty" surface far
        // more clearly than the bump alone — light raking across a slope
        // now visibly glints and dulls grain-by-grain instead of just
        // subtly perturbing the highlight's shape.
        roughnessMap={grainMap}
        roughness={roughness}
        metalness={0}
      />
    </mesh>
  );
}
