"use client";

import * as THREE from "three";
import { boxProjectUVs } from "../../world/assets";
import PillarBase from "./PillarBase";

// Design: the expressive one. A column twisted along its height and gently
// swelling, wrapped by a stone ribbon and a ribbon of light that spiral
// around it in counterpoint. Creativity, aesthetics, human experience.
const H = 10.6;
const TWIST = 0.085; // radians per unit of height

function twistedBody() {
  const geo = new THREE.BoxGeometry(2.5, H, 2.5, 4, 48, 4);
  geo.translate(0, H / 2, 0);
  boxProjectUVs(geo);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = y * TWIST;
    const bulge = 1 + 0.14 * Math.sin((y / H) * Math.PI);
    pos.setXYZ(i, (x * Math.cos(a) - z * Math.sin(a)) * bulge, y, (x * Math.sin(a) + z * Math.cos(a)) * bulge);
  }
  geo.computeVertexNormals();
  return geo;
}

function helix(r0, r1, turns, phase, y0, y1) {
  const pts = [];
  for (let k = 0; k <= 160; k++) {
    const f = k / 160;
    const a = phase + f * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * f;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y0 + (y1 - y0) * f, Math.sin(a) * r));
  }
  return new THREE.CatmullRomCurve3(pts);
}

function buildParts() {
  const stoneRibbon = new THREE.TubeGeometry(helix(2.35, 1.95, 1.35, 0.4, 0.6, 9.8), 220, 0.2, 3, false);
  const lightRibbon = new THREE.TubeGeometry(helix(2.05, 1.85, 1.9, 2.6, 0.4, 10.6), 260, 0.045, 6, false);
  const crown = boxProjectUVs(new THREE.TorusGeometry(1.5, 0.16, 6, 48));
  const plinth = boxProjectUVs(new THREE.CylinderGeometry(2.1, 2.3, 0.5, 40));
  return [
    { geometry: twistedBody(), position: [0, 0, 0], core: true },
    { geometry: stoneRibbon, position: [0, 0, 0], dir: [0, 0.4, 1], reach: 1.2, stagger: 0.15 },
    { geometry: lightRibbon, position: [0, 0, 0], glow: true, dir: [0, 0.6, 0.6], reach: 1.4, stagger: 0.05 },
    { geometry: crown, position: [0, H + 0.7, 0], rotation: [Math.PI / 2 - 0.3, 0, 0.2], dir: [0, 1, 0], reach: 2.2, stagger: 0 },
    { geometry: plinth, position: [0, 0.25, 0], dir: [0, -0.4, 1], stagger: 0.5, reach: 1 },
  ];
}

// the icon sits on the twisted front face
const ICON_Y = 6.2;
const ICON_A = ICON_Y * TWIST;
const ICON_R = 1.25 * (1 + 0.14 * Math.sin((ICON_Y / H) * Math.PI)) + 0.03;

export default function PillarDesign() {
  return (
    <PillarBase
      index={1}
      piece="C"
      engraving="design"
      icon="design"
      iconAt={[-Math.sin(ICON_A) * ICON_R, ICON_Y, Math.cos(ICON_A) * ICON_R]}
      iconRot={-ICON_A}
      buildParts={buildParts}
    />
  );
}
