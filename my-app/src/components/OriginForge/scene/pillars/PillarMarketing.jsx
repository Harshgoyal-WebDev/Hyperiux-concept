"use client";

import * as THREE from "three";
import { boxProjectUVs } from "../../world/assets";
import PillarBase from "./PillarBase";

// Marketing: a core column with eight vertical fins radiating from it, of
// differing heights, each with a lit outer edge, so its light spreads
// outward. Reach, communication, growth.
const FIN_H = [10.4, 8.1, 9.4, 7.4, 10.0, 7.8, 9.1, 8.6];

function buildParts() {
  const core = boxProjectUVs(new THREE.BoxGeometry(1.35, 11, 1.35));
  const parts = [{ geometry: core, position: [0, 5.5, 0], core: true }];
  FIN_H.forEach((h, k) => {
    const a = (k / FIN_H.length) * Math.PI * 2 + Math.PI / 8;
    const r = 1.45;
    const fin = boxProjectUVs(new THREE.BoxGeometry(1.65, h, 0.16));
    const edge = new THREE.BoxGeometry(0.05, h * 0.92, 0.05);
    const dir = [Math.cos(a), 0.12, -Math.sin(a)];
    parts.push({ geometry: fin, position: [Math.cos(a) * r, h / 2, -Math.sin(a) * r], rotation: [0, a, 0], dir, reach: 1.6, stagger: (k % 4) * 0.08 });
    parts.push({ geometry: edge, position: [Math.cos(a) * (r + 0.84), h / 2, -Math.sin(a) * (r + 0.84)], rotation: [0, a, 0], glow: true, dir, reach: 1.6, stagger: (k % 4) * 0.08 });
  });
  const plinth = boxProjectUVs(new THREE.CylinderGeometry(2.6, 2.8, 0.5, 8));
  parts.push({ geometry: plinth, position: [0, 0.25, 0], dir: [0, -0.4, 1], stagger: 0.5, reach: 1 });
  return parts;
}

export default function PillarMarketing() {
  return <PillarBase index={3} piece="B" engraving="marketing" icon="marketing" iconAt={[0, 6.3, 0.7]} buildParts={buildParts} />;
}
