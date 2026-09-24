"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
// Bundled locally: three.js dropped examples/fonts in newer versions.
import fontJson from "./fonts/helvetiker_bold.typeface.json";

// A continuous ring of extruded 3D "OUR WORK" text stuck to the INSIDE of
// the background cylinder, repeated side by side (like a flex row) until
// it wraps the full circumference.
//
// Built as ONE merged geometry (one draw call) instead of N <Text3D>s: the
// text is extruded once, then each copy's vertices are bent around the
// cylinder — letters actually follow the curve rather than being flat
// slabs placed on tangents. Copies are spaced evenly so the ring closes
// seamlessly (the gap between repeats is stretched slightly to fit).
//
// Mapping (local text space -> cylinder space): text X runs along the
// circumference (angle = x / radius, increasing to the viewer's right when
// seen from inside), text Y stays Y, and text Z (extrusion, front face at
// +depth) points INWARD toward the axis, so the readable front face faces
// the camera at the center. That frame (tangent, up, inward) is
// right-handed, so triangle winding/culling is preserved.

const font = new FontLoader().parse(fontJson);

function buildBandGeometry({ text, size, depth, radius, gap, curveSegments }) {
  const base = new TextGeometry(text, {
    font,
    size,
    depth,
    curveSegments,
    bevelEnabled: false,
  });
  base.computeBoundingBox();
  const bb = base.boundingBox;
  const textWidth = bb.max.x - bb.min.x;
  const centerX = (bb.min.x + bb.max.x) / 2;
  const centerY = (bb.min.y + bb.max.y) / 2;

  const nonIndexed = base.index ? base.toNonIndexed() : base;
  const src = nonIndexed.attributes.position.array;

  const circumference = 2 * Math.PI * radius;
  const count = Math.max(1, Math.floor(circumference / (textWidth + gap)));
  const slotAngle = (Math.PI * 2) / count;

  const out = new Float32Array(src.length * count);
  for (let c = 0; c < count; c++) {
    const baseAngle = c * slotAngle;
    const offset = c * src.length;
    for (let i = 0; i < src.length; i += 3) {
      const x = src[i] - centerX;
      const y = src[i + 1] - centerY;
      const z = src[i + 2];
      const phi = baseAngle + x / radius;
      const r = radius - z;
      out[offset + i] = r * Math.sin(phi);
      out[offset + i + 1] = y;
      out[offset + i + 2] = -r * Math.cos(phi);
    }
  }

  if (nonIndexed !== base) nonIndexed.dispose();
  base.dispose();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(out, 3));
  geo.computeVertexNormals();
  return geo;
}

export default function OurWorkBand({
  text = "OUR WORK",
  radius = 86,
  // Distance the letters' BACK face sits inside the cylinder wall.
  inset = 0.3,
  y = 0,
  // Slides the whole ring of words around the cylinder (degrees).
  rotationDeg = 0,
  size = 6,
  depth = 0.8,
  gap = 8,
  curveSegments = 4,
  color = "#ffffff",
  emissiveIntensity = 0.35,
}) {
  const geometry = useMemo(
    () =>
      buildBandGeometry({
        text,
        size,
        depth,
        radius: Math.max(radius - inset, 1),
        gap,
        curveSegments,
      }),
    [text, size, depth, radius, inset, gap, curveSegments]
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, y, 0]} rotation={[0, THREE.MathUtils.degToRad(rotationDeg), 0]}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.5}
        metalness={0}
      />
    </mesh>
  );
}
