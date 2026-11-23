"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { archGeometry } from "../../world/arches";
import { mulberry32 } from "../../world/layout";
import { S_END, S_RIM, route } from "../../world/oasis";
import { routeDistance } from "../../world/oasisCamera";
import { T } from "../../tuning";

// Scene 02: concentric semi-circular stone structures standing across the
// canyon ahead, the secondary focus after the energy trail. Three rings of
// cut sandstone, each square across the way, the largest nearest and the
// smaller ones further on (they nest in perspective, like the reference),
// their lower part sunk in the sand and their feet in the canyon's walls.
// They stand ~37 m apart along the canyon's last stretch, the last where it
// opens onto the oasis. As the valley comes in they build themselves
// (`form`, 0 → 1: their blocks rising out of the sand into place, sweeping
// across the arch — the first from left to right, the next from right to
// left — the nearest arch first), and then a thin line of energy lights
// along a few stretches of each one's inner edge.
// (evenly along the canyon's last stretch: from FIRST_AHEAD metres ahead of
// where the camera is at FROM, the last END_SHORT short of where the canyon
// opens onto the oasis — ~37 m apart; each builds sweeping across, the
// next the other way)
// (FROM: a little past the cut's end — T.tlCutEnd — wherever the timeline puts it)
const FROM_PAST_CUT = 0.016;
const FIRST_AHEAD = 44;
const END_SHORT = 4;
const RINGS = [
  { R: 17, band: 2.4, depth: 3.4, seed: 1301, sweep: 1 },
  { R: 13, band: 2.0, depth: 2.9, seed: 1307, sweep: -1 },
  { R: 10, band: 1.6, depth: 2.4, seed: 1319, sweep: 1 },
];

function buildArches(terrain) {
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const rng = mulberry32(1361);
  const s0 = routeDistance(T.tlCutEnd + FROM_PAST_CUT) + FIRST_AHEAD;
  const s1 = S_RIM - END_SHORT;
  return RINGS.map((r, i) => {
    const s = s0 + ((s1 - s0) * i) / (RINGS.length - 1);
    route.getPointAt(Math.min(s / S_END, 1), p);
    route.getTangentAt(Math.min(s / S_END, 1), t);
    const ground = terrain.height(p.x, p.z);
    // (the nearest builds first, each a little after the one before,
    // sweeping across from left to right, the next from right to left)
    const geometry = archGeometry(r.seed, r.R, r.band, r.depth, 0.5, i * 0.18, 0.64, r.sweep);
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, ground - r.R * 0.06, p.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(t.x, t.z), 0)),
      new THREE.Vector3(1, 1, 1)
    );
    geometry.applyMatrix4(matrix);
    // (the blocks' centres into the world with them)
    const pivot = geometry.attributes.aPivot;
    const v = new THREE.Vector3();
    for (let k = 0; k < pivot.count; k++) {
      v.fromBufferAttribute(pivot, k).applyMatrix4(matrix);
      pivot.setXYZ(k, v.x, v.y, v.z);
    }
    geometry.computeBoundingSphere();
    // the energy along its inner edge: two or three arcs over the top half
    const arcs = [];
    const Ri = r.R - r.band * 0.5 - 0.04;
    let a = 0.15 + rng() * 0.3;
    while (a < Math.PI - 0.3) {
      const len = 0.35 + rng() * 0.6;
      const g = new THREE.TorusGeometry(Ri, Math.max(r.band * 0.03, 0.05), 6, 48, Math.min(len, Math.PI - 0.1 - a));
      g.rotateZ(a);
      g.applyMatrix4(matrix);
      arcs.push(g);
      a += len + 0.4 + rng() * 0.7;
    }
    return { geometry, arcs };
  });
}

export default function Arches({ J, terrain, material, gate, form }) {
  const arches = useMemo(() => buildArches(terrain), [terrain]);
  // (additive: unlit, it is nothing at all — not a dark line)
  const glow = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    []
  );
  useEffect(
    () => () => {
      arches.forEach((a) => {
        a.geometry.dispose();
        a.arcs.forEach((g) => g.dispose());
      });
    },
    [arches]
  );
  useEffect(() => () => glow.dispose(), [glow]);

  const group = useRef();
  const stones = useRef([]);
  const casting = useRef(null);
  const HOT = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const k = gate();
    const f = form.current;
    if (group.current) group.current.visible = k > 0.001 && f > 0.001;
    // (a block on its way up casts no shadow — its shadow would be of the
    // finished arch: they cast once built, the shadows redrawn then)
    const built = f > 0.995;
    if (casting.current !== built) {
      casting.current = built;
      stones.current.forEach((m) => m && (m.castShadow = built));
      J.sceneVersion += 1;
    }
    // (HDR orange: the bloom gives it its glow; it comes in as the arches
    // close, and breathes slowly)
    HOT.set(T.crackColor).lerp(new THREE.Color("#ffb070"), 0.35);
    const lit = THREE.MathUtils.smoothstep(f, 0.85, 1);
    glow.color.copy(HOT).multiplyScalar(2.6 * T.archGlow * k * lit * (0.85 + 0.15 * Math.sin(clock.elapsedTime * 0.9)));
  });

  return (
    <group ref={group}>
      {arches.map((a, i) => (
        <group key={i}>
          <mesh ref={(el) => (stones.current[i] = el)} geometry={a.geometry} material={material} receiveShadow />
          {a.arcs.map((g, j) => (
            <mesh key={j} geometry={g} material={glow} />
          ))}
        </group>
      ))}
    </group>
  );
}
