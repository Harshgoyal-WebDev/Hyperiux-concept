"use client";

import * as THREE from "three";
import { boxProjectUVs } from "../../world/assets";
import PillarBase from "./PillarBase";

// Development: interlocking layers, each precisely aligned and slightly
// turned against the last, with molten seams between them and a frame of
// thin mechanical rails at the corners. Engineering, technology, execution.
const LAYERS = 5;
const LH = 1.95;
const GAP = 0.16;

function buildParts() {
  const layer = boxProjectUVs(new THREE.BoxGeometry(2.9, LH, 2.9));
  const seam = new THREE.BoxGeometry(2.5, GAP * 0.7, 2.5);
  const rail = new THREE.BoxGeometry(0.14, LAYERS * (LH + GAP), 0.14);
  const cap = boxProjectUVs(new THREE.BoxGeometry(1.9, 0.6, 1.9));
  const parts = [];
  for (let k = 0; k < LAYERS; k++) {
    const y = LH / 2 + k * (LH + GAP) + 0.3;
    const turn = (k % 2 ? 1 : -1) * 0.07 * (k > 0 ? 1 : 0);
    const ang = (k / LAYERS) * Math.PI * 2 + 0.5;
    parts.push({
      geometry: layer,
      position: [(k % 2 ? 0.08 : -0.08), y, 0],
      rotation: [0, turn, 0],
      dir: k === 2 ? [0, 0, 0] : [Math.cos(ang), 0.25, Math.abs(Math.sin(ang)) + 0.3],
      core: k === 2,
      reach: 1.4 + k * 0.15,
      stagger: Math.abs(k - 2) * 0.12,
    });
    if (k < LAYERS - 1) parts.push({ geometry: seam, position: [0, y + LH / 2 + GAP / 2, 0], glow: true, dir: [0, 0.2, 1], reach: 0.6, stagger: 0.3 });
  }
  const top = LAYERS * (LH + GAP) + 0.3;
  for (const [x, z] of [[-1.62, -1.62], [1.62, -1.62], [-1.62, 1.62], [1.62, 1.62]]) {
    parts.push({ geometry: rail, position: [x, top / 2, z], dir: [x, 0, z], reach: 1.8, stagger: 0 });
  }
  parts.push({ geometry: cap, position: [0, top + 0.5, 0], dir: [0, 1, 0], reach: 2, stagger: 0.05 });
  return parts;
}

export default function PillarDevelopment() {
  return <PillarBase index={2} piece="D" engraving="development" icon="development" iconAt={[0.08, 6.6, 1.48]} buildParts={buildParts} />;
}
