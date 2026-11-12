"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C, lerp } from "../timeline";
import { useAssets } from "../world/assets";
import { HOT, MOLTEN, ORANGE, glowDiscMaterial } from "../world/shaders";

// Behind the mark, the passage: an enormous corridor of repeated pointed
// frames, rising out of the ground as the mark activates. Each frame holds a
// thin channel of light that wakes as the camera nears it; runes run along
// the walls; a channel of light runs down the floor; and far ahead, a bright
// light waits where the darkness ends.

const Z0 = -8;
const Z1 = -69;
const COUNT = 19;
const OUTER = { w: 6.6, wall: 11.2, apex: 15.4 };
const INNER = { w: 5.2, wall: 10.2, apex: 13.4 };

const pentagon = ({ w, wall, apex }) => [
  new THREE.Vector2(-w, 0),
  new THREE.Vector2(w, 0),
  new THREE.Vector2(w, wall),
  new THREE.Vector2(0, apex),
  new THREE.Vector2(-w, wall),
];
const inset = (o, d) => ({ w: o.w - d, wall: o.wall - d * 0.6, apex: o.apex - d * 1.1 });

function frameGeometry(outer, inner, depth) {
  const shape = new THREE.Shape(pentagon(outer));
  shape.holes.push(new THREE.Path(pentagon(inner).reverse()));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

export default function ForgeCorridor() {
  const { mat, tex, keep } = useAssets();
  const group = useRef();
  const frames = useRef();
  const trims = useRef();
  const channel = useRef();
  const endLight = useRef();
  const endGlow = useRef();

  const res = useMemo(() => {
    const frameGeo = keep(frameGeometry(OUTER, INNER, 1.0));
    // the channel of light: a thin band just inside each frame's opening
    const trimGeo = keep(frameGeometry(INNER, inset(INNER, 0.14), 0.12));
    const trimMat = keep(new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }));
    const runeMat = keep(
      new THREE.MeshStandardMaterial({
        color: "#2c2622",
        map: tex.stone.color,
        roughnessMap: tex.stone.data,
        roughness: 0.7,
        metalness: 0.2,
        emissive: ORANGE,
        emissiveMap: (() => {
          const r = tex.runes.clone();
          r.repeat.set(7, 1);
          r.needsUpdate = true;
          return keep(r);
        })(),
        emissiveIntensity: 0,
        side: THREE.DoubleSide,
      })
    );
    const channelMat = keep(new THREE.MeshBasicMaterial({ color: MOLTEN.clone().multiplyScalar(2.5), toneMapped: false }));
    const glowMat = keep(glowDiscMaterial({ inner: HOT, outer: new THREE.Color("#ffdcb4") }));
    return { frameGeo, trimGeo, trimMat, runeMat, channelMat, glowMat };
  }, [keep, tex]);

  const length = Z0 - Z1;
  // roof slopes: local x runs down the corridor, local y up the slope
  const roof = useMemo(() => {
    const dx = OUTER.w;
    const dy = OUTER.apex - OUTER.wall;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const q = (s) => {
      const X = new THREE.Vector3(0, 0, 1);
      const Y = new THREE.Vector3(-s * Math.cos(ang), Math.sin(ang), 0);
      const Z = new THREE.Vector3().crossVectors(X, Y);
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    };
    return { len, q: { [-1]: q(-1), 1: q(1) } };
  }, []);

  useEffect(() => {
    for (let i = 0; i < COUNT; i++) {
      dummy.position.set(0, 0, Z0 - (i / (COUNT - 1)) * length);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      frames.current.setMatrixAt(i, dummy.matrix);
      dummy.position.z += 0.56;
      dummy.updateMatrix();
      trims.current.setMatrixAt(i, dummy.matrix);
      trims.current.setColorAt(i, tmpColor.set(0, 0, 0));
    }
    frames.current.instanceMatrix.needsUpdate = true;
    trims.current.instanceMatrix.needsUpdate = true;
    trims.current.instanceColor.needsUpdate = true;
    frames.current.computeBoundingSphere();
    trims.current.computeBoundingSphere();
  }, [length]);

  useFrame((state) => {
    const t = C.t;
    const visible = C.corridorRise > 0.001 && t < 82;
    group.current.visible = visible;
    if (!visible) return;
    const time = state.clock.elapsedTime;
    group.current.position.y = -17 * (1 - C.corridorRise);

    // each frame's trim wakes as the camera approaches it
    const camZ = state.camera.position.z;
    const base = C.hot * 0.35 + C.corridorLight * 0.25;
    for (let i = 0; i < COUNT; i++) {
      const z = Z0 - (i / (COUNT - 1)) * length;
      const ahead = camZ - z; // > 0: the frame is in front of the camera
      const near = Math.exp(-Math.abs(ahead - 9) / 9) * C.corridorLight;
      const wake = C.corridorRise * (0.15 + base) + near * 3.2;
      const k = wake * (0.92 + 0.08 * Math.sin(time * 3 + i));
      trims.current.setColorAt(i, tmpColor.copy(MOLTEN).multiplyScalar(k));
    }
    trims.current.instanceColor.needsUpdate = true;

    res.runeMat.emissiveIntensity = 0.15 + C.corridorLight * 1.6 + C.hot * 0.4;
    channel.current.scale.z = Math.max(0.0001, C.corridorLight);
    res.channelMat.color.copy(MOLTEN).multiplyScalar(1.5 + C.corridorLight * 2);

    // the light at the end: grows as we approach, then we pass into it
    const glowK = Math.max(C.corridorLight, C.hot * 0.3);
    res.glowMat.uniforms.uIntensity.value = glowK * (1 - C.light * 0.9);
    endGlow.current.scale.setScalar(lerp(0.6, 1.6, C.corridorLight) + C.light * 2);
    endLight.current.intensity = glowK * 160 * (1 - C.light);
  });

  return (
    <group ref={group}>
      <instancedMesh ref={frames} args={[res.frameGeo, mat.ruinStone, COUNT]} />
      <instancedMesh ref={trims} args={[res.trimGeo, res.trimMat, COUNT]} />
      {/* walls and roof slopes carrying runes */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (OUTER.w - 0.05), OUTER.wall / 2, (Z0 + Z1) / 2]} rotation-y={-s * Math.PI / 2} material={res.runeMat}>
            <planeGeometry args={[length + 2, OUTER.wall]} />
          </mesh>
          <mesh position={[(s * OUTER.w) / 2, (OUTER.wall + OUTER.apex) / 2, (Z0 + Z1) / 2]} quaternion={roof.q[s]} material={res.runeMat}>
            <planeGeometry args={[length + 2, roof.len + 0.4]} />
          </mesh>
        </group>
      ))}
      {/* floor and its channel of light */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, (Z0 + Z1) / 2]} material={mat.floor}>
        <planeGeometry args={[OUTER.w * 2, length + 4]} />
      </mesh>
      <group ref={channel} position={[0, 0.05, Z0]}>
        <mesh position-z={-length / 2} material={res.channelMat}>
          <boxGeometry args={[0.18, 0.04, length]} />
        </mesh>
      </group>
      {/* the light where the darkness ends */}
      <mesh ref={endGlow} position={[0, 6.5, Z1 - 2.5]} material={res.glowMat}>
        <planeGeometry args={[14, 14]} />
      </mesh>
      <pointLight ref={endLight} position={[0, 6, Z1 - 1]} color="#ffd2a0" distance={60} decay={2} intensity={0} />
    </group>
  );
}
