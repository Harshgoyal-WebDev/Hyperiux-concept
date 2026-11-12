"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C, lerp } from "../timeline";
import { useAssets } from "../world/assets";
import { WARM_WHITE, glowDiscMaterial } from "../world/shaders";
import { STAIR, SUMMIT } from "../world/stair";

// The summit: a landing at the top of the flight and, beyond it, a tall
// ivory gateway, the same pointed frame as the forge corridor's but
// made of light stone, its opening filled with a bright light that grows
// as the camera arrives. The white transition (Overlays.jsx) takes over
// from here.

const pentagon = (w, wall, apex) => [new THREE.Vector2(-w, 0), new THREE.Vector2(w, 0), new THREE.Vector2(w, wall), new THREE.Vector2(0, apex), new THREE.Vector2(-w, wall)];

export default function Summit() {
  const { mat, keep } = useAssets();
  const disc = useRef();
  const res = useMemo(() => {
    const shape = new THREE.Shape(pentagon(7.4, 12.5, 17.5));
    shape.holes.push(new THREE.Path(pentagon(5.4, 11, 14.6).reverse()));
    const frame = keep(new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false }));
    frame.translate(0, 0, -0.8);
    const trimShape = new THREE.Shape(pentagon(5.4, 11, 14.6));
    trimShape.holes.push(new THREE.Path(pentagon(5.2, 10.85, 14.35).reverse()));
    const trim = keep(new THREE.ExtrudeGeometry(trimShape, { depth: 1.7, bevelEnabled: false }));
    trim.translate(0, 0, -0.85);
    const glow = keep(glowDiscMaterial({ inner: WARM_WHITE, outer: new THREE.Color("#ffd9b0") }));
    const yaw = Math.atan2(SUMMIT.tan.x, SUMMIT.tan.z);
    // the landing runs on past the gate, so the frame stands on stone
    const landing = SUMMIT.landing.clone().addScaledVector(SUMMIT.tan, 8);
    const gate = SUMMIT.landing.clone().addScaledVector(SUMMIT.tan, 10);
    return { frame, trim, glow, yaw, landing, gate };
  }, [keep]);

  useFrame(() => {
    const s = C.summit;
    res.glow.uniforms.uIntensity.value = 0.35 + s * 1.4 + C.rail * 0.8;
    disc.current.scale.setScalar(lerp(1, 2.6, s * s));
  });

  return (
    <group>
      <mesh position={[res.landing.x, STAIR.rise - 1.3, res.landing.z]} rotation-y={res.yaw} material={mat.bronze} castShadow receiveShadow>
        <boxGeometry args={[17, 2.6, 16]} />
      </mesh>
      <group position={[res.gate.x, STAIR.rise, res.gate.z]} rotation-y={res.yaw + Math.PI}>
        <mesh geometry={res.frame} material={mat.bronzeWall} castShadow receiveShadow />
        <mesh geometry={res.trim} material={mat.brass} />
        <mesh ref={disc} position={[0, 6.8, -1.2]} material={res.glow}>
          <planeGeometry args={[13, 13]} />
        </mesh>
      </group>
    </group>
  );
}
