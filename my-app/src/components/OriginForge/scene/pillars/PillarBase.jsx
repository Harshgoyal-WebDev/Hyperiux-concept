"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C, lerp, seg, ss } from "../../timeline";
import { useAssets } from "../../world/assets";
import { MOLTEN, ORANGE } from "../../world/shaders";
import { pieceWorld } from "../../world/logo";

// One of the four forces. Each pillar file builds its own architecture as a
// list of parts; this base gives them all the same life:
//   rise    – up out of the floor, light pooling at the base
//   focus   – its engravings and icon wake during its beat
//   gather  – it turns and travels to its place in the mark, shrinking
//   detach  – its parts lift away from the body, intentionally, outward
//   absorb  – the parts are pulled into the forming piece and vanish
// The piece of the Hyperiux mark it becomes is drawn by HyperiuxMark.jsx.

export const PILLAR_H = 11;
export const SPOTS = [
  new THREE.Vector3(-10.5, 0, -1.5),
  new THREE.Vector3(-3.7, 0, -5),
  new THREE.Vector3(3.7, 0, -5),
  new THREE.Vector3(10.5, 0, -1.5),
];
const GATHER_SCALE = 0.55;

export default function PillarBase({ index, piece, engraving, icon, iconAt = [0, 6.2, 1.31], iconRot = 0, buildParts }) {
  const assets = useAssets();
  const group = useRef();
  const partRefs = useRef([]);
  const iconRef = useRef();
  const baseLight = useRef();

  const { stone, glow, iconMat, parts } = useMemo(() => {
    const stone = assets.pillarMaterial(assets.tex.engraving[engraving]);
    const glow = assets.keep(new THREE.MeshBasicMaterial({ color: MOLTEN.clone(), toneMapped: false }));
    const iconMat = assets.keep(
      new THREE.MeshBasicMaterial({ map: assets.tex.icons[icon], color: MOLTEN.clone().multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 })
    );
    const parts = buildParts().map((p, k) => ({ ...p, geometry: assets.keep(p.geometry), dir: p.dir ? new THREE.Vector3(...p.dir).normalize() : new THREE.Vector3(), k }));
    return { stone, glow, iconMat, parts };
  }, [assets, engraving, icon, buildParts]);

  const spot = SPOTS[index];
  const target = useMemo(() => pieceWorld(piece), [piece]);
  const v = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(0, PILLAR_H / 2, 0), []);
  const side = useMemo(() => new THREE.Vector3(spot.x < 0 ? -1 : 1, 0, 0), [spot]);

  useEffect(() => {
    group.current.position.copy(spot);
    group.current.position.y = -PILLAR_H;
  }, [spot]);

  useFrame((state) => {
    const rise = C.rise[index];
    const g = C.gather;
    const a = C.absorb;
    const visible = rise > 0.001 && a < 0.995 && C.t < 60;
    group.current.visible = visible;
    baseLight.current.visible = visible;
    if (!visible) return;
    const time = state.clock.elapsedTime;

    // place: rise from the floor, then travel to the piece on a swirling arc
    const s = lerp(1, GATHER_SCALE, g);
    v.copy(spot).lerp(target, g);
    v.y = lerp(-PILLAR_H * 1.02 * (1 - rise), target.y - (PILLAR_H / 2) * s, g);
    const arc = Math.sin(Math.PI * g);
    v.addScaledVector(side, arc * 3.2);
    v.z += arc * 3.5;
    v.y += arc * 1.6;
    group.current.position.copy(v);
    group.current.rotation.y = ss(g) * Math.PI * (index % 2 ? 1 : -1) + Math.sin(time * 0.6 + index) * 0.04 * arc;
    group.current.scale.setScalar(s);

    // parts: lift away, then are pulled in
    const d = C.detach;
    parts.forEach((p, k) => {
      const m = partRefs.current[k];
      if (!m) return;
      const stagger = p.stagger ?? (k / parts.length) * 0.5;
      const dd = ss(seg(d, stagger * 0.6, stagger * 0.6 + 0.55));
      const pull = ss(seg(a, p.core ? 0.35 : stagger * 0.4, p.core ? 1 : stagger * 0.4 + 0.6));
      const out = Math.sin(Math.PI * Math.min(1, dd * 0.5 + pull * 0.5)) * (p.reach ?? 1.6) * (p.core ? 0 : 1);
      m.position.set(p.position[0], p.position[1], p.position[2]).addScaledVector(p.dir, out);
      m.position.lerp(mid, pull * 0.85);
      m.rotation.set(
        (p.rotation?.[0] ?? 0) + dd * p.dir.z * 0.6,
        (p.rotation?.[1] ?? 0) + dd * 0.4 * (k % 2 ? 1 : -1),
        (p.rotation?.[2] ?? 0) - dd * p.dir.x * 0.6
      );
      const sc = Math.max(1 - pull, 0.0001);
      m.scale.set((p.scale?.[0] ?? 1) * sc, (p.scale?.[1] ?? 1) * sc, (p.scale?.[2] ?? 1) * sc);
    });

    // light: its own beat, then the heat of the forge
    const focus = C.pillar[index];
    const forgeHeat = Math.max(g * 1.4, a * 3);
    const pulse = 0.9 + 0.1 * Math.sin(time * 2.2 + index);
    stone.emissiveIntensity = (0.03 + focus * 2.4) * pulse + forgeHeat;
    glow.color.copy(MOLTEN).multiplyScalar((0.25 + focus * 3.2 + forgeHeat * 1.5) * pulse);
    iconMat.opacity = Math.min(1, focus * 1.15) * (1 - g);
    baseLight.current.position.set(v.x, lerp(0.6, v.y + (PILLAR_H / 2) * s, g), v.z + 2.4);
    baseLight.current.intensity = rise * (8 + focus * 34) * (1 - a);
  });

  return (
    <>
      <group ref={group}>
        {parts.map((p, k) => (
          <mesh key={k} ref={(el) => (partRefs.current[k] = el)} geometry={p.geometry} material={p.glow ? glow : stone} position={p.position} rotation={p.rotation} scale={p.scale} />
        ))}
        <mesh ref={iconRef} position={iconAt} rotation-y={iconRot} material={iconMat}>
          <planeGeometry args={[1.5, 1.5]} />
        </mesh>
      </group>
      <pointLight ref={baseLight} color={ORANGE} distance={16} decay={2} intensity={0} />
    </>
  );
}
