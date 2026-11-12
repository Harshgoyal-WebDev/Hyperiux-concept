"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C, lerp } from "../timeline";
import { useAssets } from "../world/assets";
import { HOT, MOLTEN, ORANGE } from "../world/shaders";
import { CUBE_LOCAL, CUBE_ROTATION, MARK_CENTER } from "../world/logo";
import { T } from "../tuning";

// The dormant core: a stepped circular platform engraved with rings and
// runes, and hovering over it the energy source: a cube standing on its
// corner (the mark's own cube, before it is set in the joint). It wakes (light
// floods the engravings), resonates (rings ripple out, orbits tilt around
// it), and finally rises into the joint of the mark, where it becomes the
// molten cube (HyperiuxMark.jsx).

export const CORE_POS = new THREE.Vector3(0, 3.2, 0);
const CUBE_WORLD = CUBE_LOCAL.clone().add(MARK_CENTER);

const glowMat = (color, k) =>
  new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

export function EnergyRings() {
  const ripples = useRef([]);
  const orbits = useRef([]);
  const mats = useMemo(() => ({ ripple: [0, 1, 2, 3].map(() => glowMat(MOLTEN, 2.2)), orbit: [0, 1, 2].map(() => glowMat(AMBER_K, 1.8)) }), []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const amp = C.rings;
    ripples.current.forEach((m, i) => {
      const k = (time * 0.18 + i / 4) % 1;
      m.visible = amp > 0.001;
      m.scale.setScalar(2.4 + k * 15);
      mats.ripple[i].opacity = amp * (1 - k) * (1 - k) * 0.9;
    });
    orbits.current.forEach((m, i) => {
      m.visible = amp > 0.001;
      m.rotation.set(Math.PI / 2 + (i - 1) * 0.42, time * (0.1 + i * 0.05), (i - 1) * 0.3);
      m.position.copy(CORE_POS).lerp(CUBE_WORLD, C.coreLift);
      mats.orbit[i].opacity = amp * 0.75;
    });
  });

  return (
    <group>
      {mats.ripple.map((m, i) => (
        <mesh key={`r${i}`} ref={(el) => (ripples.current[i] = el)} rotation-x={-Math.PI / 2} position={[0, 0.62, 0]} material={m}>
          <ringGeometry args={[0.97, 1.0, 128]} />
        </mesh>
      ))}
      {mats.orbit.map((m, i) => (
        <mesh key={`o${i}`} ref={(el) => (orbits.current[i] = el)} material={m}>
          <torusGeometry args={[3.2 + i * 1.6, 0.018, 6, 192]} />
        </mesh>
      ))}
    </group>
  );
}
const AMBER_K = new THREE.Color("#FF9A35");

export default function EnergyCore() {
  const { mat, tex } = useAssets();
  const core = useRef();
  const heart = useRef();
  const frame = useRef();
  const beam = useRef();
  const light = useRef();
  const platform = useRef();

  const m = useMemo(() => {
    const heartMat = new THREE.MeshBasicMaterial({ color: HOT.clone(), toneMapped: false });
    const frameMat = new THREE.LineBasicMaterial({ color: MOLTEN.clone(), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
    const shellMat = new THREE.MeshStandardMaterial({ color: "#2a2420", metalness: 0.85, roughness: 0.18, emissive: ORANGE, emissiveIntensity: 0, transparent: true, opacity: 0.32, depthWrite: false });
    const beamMat = glowMat(MOLTEN, 2.5);
    const engrave = (k) =>
      new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(k), map: tex.coreRings, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 });
    const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.5, 1.5, 1.5));
    return { heartMat, frameMat, shellMat, beamMat, ringsTop: engrave(2.2), ringsFloor: engrave(1.6), frameGeo };
  }, [tex.coreRings]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const on = C.core;
    const lift = C.coreLift;
    const t = C.t;
    platform.current.visible = t < 72;
    core.current.visible = t < 60 && C.cube < 0.999;
    if (!platform.current.visible) return;

    // the source: almost invisible, then awake; later it rises into the mark
    CORE_POS.y = T.coreHeight;
    core.current.position.copy(CORE_POS).lerp(CUBE_WORLD, lift);
    core.current.position.y += Math.sin(time * 0.8) * 0.12 * (1 - lift);
    // on its corner, turning about the vertical; it settles into the mark's
    // own pose as it rises
    const spin = time * (0.25 + on * 0.5) * T.coreSpin * (1 - lift);
    core.current.rotation.set(CUBE_ROTATION.x, CUBE_ROTATION.y + spin, CUBE_ROTATION.z, "YXZ");
    const s = (0.55 + 0.45 * on) * (1 - C.cube) * T.coreSize;
    core.current.scale.setScalar(Math.max(s, 0.0001));
    const pulse = 0.85 + 0.15 * Math.sin(time * 3.1);
    m.heartMat.color.copy(HOT).multiplyScalar((0.04 + on * 3.2 * pulse + C.attract * 1.5) * T.coreGlow);
    m.frameMat.opacity = 0.08 + on * 0.92;
    m.frameMat.color.copy(MOLTEN).multiplyScalar(1 + on * 2);
    m.shellMat.emissiveIntensity = on * 0.6;
    frame.current.rotation.y = 0;
    heart.current.scale.setScalar(0.85 + 0.12 * pulse * on);

    // a thread of light, up into the sky
    beam.current.visible = on > 0.01 && lift < 0.99;
    m.beamMat.opacity = on * (0.55 + 0.25 * pulse) * (1 - lift);

    light.current.position.copy(core.current.position);
    light.current.intensity = (on * 60 + C.attract * 40) * (1 - C.mark * 0.6) * T.coreGlow;

    m.ringsTop.opacity = Math.min(1, on * 1.2) * (0.8 + 0.2 * pulse);
    m.ringsFloor.opacity = C.markings * (0.75 + 0.25 * pulse) * (1 - C.open);
  });

  return (
    <group>
      {/* stepped platform */}
      <group ref={platform}>
        <mesh position={[0, 0.12, 0]} material={mat.ruinStone}>
          <cylinderGeometry args={[7, 7.3, 0.25, 72]} />
        </mesh>
        <mesh position={[0, 0.37, 0]} material={mat.ruinStone}>
          <cylinderGeometry args={[5.2, 5.4, 0.25, 72]} />
        </mesh>
        <mesh position={[0, 0.6, 0]} material={mat.ruinStone}>
          <cylinderGeometry args={[3.4, 3.55, 0.22, 72]} />
        </mesh>
        {/* engravings: on the top tier and in a wide ring on the floor */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.715, 0]} material={m.ringsTop}>
          <circleGeometry args={[3.35, 72]} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} material={m.ringsFloor}>
          <circleGeometry args={[14, 96]} />
        </mesh>
      </group>
      {/* the source */}
      <group ref={core}>
        <mesh ref={heart} material={m.heartMat}>
          <boxGeometry args={[0.62, 0.62, 0.62]} />
        </mesh>
        <mesh material={m.shellMat}>
          <boxGeometry args={[1.38, 1.38, 1.38]} />
        </mesh>
        <lineSegments ref={frame} geometry={m.frameGeo} material={m.frameMat} />
      </group>
      <mesh ref={beam} position={[0, 32, 0]} material={m.beamMat}>
        <cylinderGeometry args={[0.035, 0.035, 60, 6, 1, true]} />
      </mesh>
      <pointLight ref={light} color="#ff7a18" distance={40} decay={2} intensity={0} />
      <EnergyRings />
    </group>
  );
}
