"use client";

import * as THREE from "three";
import { boxProjectUVs } from "../../world/assets";
import PillarBase from "./PillarBase";

// Strategy: a tall, imposing monolith, cut on a precise slant, flanked by two
// knife-thin blades and capped by a floating wedge. Its faces carry a survey
// grid; only a few grooves hold light. Clarity, direction, research.
function buildParts() {
  const W = 2.5;
  const shape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(W / 2, 11), new THREE.Vector2(-W / 2, 10.0)]);
  const body = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
  body.translate(0, 0, -W / 2);
  body.computeVertexNormals();
  boxProjectUVs(body);

  const blade = boxProjectUVs(new THREE.BoxGeometry(0.2, 8.6, 2.1));
  const cap = boxProjectUVs(new THREE.BoxGeometry(1.5, 0.45, 2.0));
  const plinth = boxProjectUVs(new THREE.BoxGeometry(3.6, 0.5, 3.4));
  const groove = new THREE.BoxGeometry(0.06, 8.8, 0.06);
  return [
    { geometry: body, position: [0, 0, 0], core: true },
    { geometry: blade, position: [-1.62, 4.7, 0], dir: [-1, 0.2, 0.2], stagger: 0.1 },
    { geometry: blade, position: [1.62, 5.1, 0], dir: [1, 0.25, 0.2], stagger: 0.2 },
    { geometry: cap, position: [-0.2, 11.55, 0], rotation: [0, 0, 0.36], dir: [0, 1, 0.3], reach: 2.4, stagger: 0 },
    { geometry: plinth, position: [0, 0.25, 0], dir: [0, -0.4, 1], stagger: 0.5, reach: 1 },
    // light-carrying grooves on the front edges of the blades
    { geometry: groove, position: [-1.62, 4.7, 1.08], glow: true, dir: [-1, 0.2, 0.2], stagger: 0.1 },
    { geometry: groove, position: [1.62, 5.1, 1.08], glow: true, dir: [1, 0.25, 0.2], stagger: 0.2 },
  ];
}

export default function PillarStrategy() {
  return <PillarBase index={0} piece="A" engraving="strategy" icon="strategy" iconAt={[0, 6.4, 1.3]} buildParts={buildParts} />;
}
