"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C, lerp } from "../timeline";
import { panelMetal } from "../world/materials";
import { FLOATERS, MONOLITHS, SPARK } from "./layout";

// The monoliths of the dark version: slabs of paneled metal with slanted
// tops (one geometry, instanced), some burning along an edge.
//   the spark   two colossal ones standing almost touching; between them a
//               slit of blazing light, which ignites (`spark`), throws
//               orange onto their inner faces and the wet ground, and which
//               the camera passes through
//   the ranks   standing either side of the way, and in the haze beyond
//   the lifting blocks rise from the ground into the air (`float`) and turn
const dummy = new THREE.Object3D();

// a slab with a slanted top
function slabGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) - 0.07 + p.getX(i) * 0.14);
  g.computeVertexNormals();
  return g;
}

// the slit's light: a sheet, hottest down its middle and at its foot
function sheetMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
    uniforms: { uK: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uK;
      varying vec2 vUv;
      void main() {
        float x = abs(vUv.x - 0.5) * 2.0;
        float core = exp(-x * x * 18.0);
        float halo = exp(-x * 3.0) * 0.35;
        float foot = 1.0 + 2.5 * exp(-vUv.y * 9.0);
        float top = smoothstep(1.0, 0.55, vUv.y);
        vec3 col = mix(vec3(1.0, 0.36, 0.04), vec3(1.0, 0.82, 0.55), core) * (core * 4.0 + halo * 0.6) * foot * top * uK;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export default function Monoliths({ tier }) {
  const spark = useRef();
  const ranks = useRef();
  const floaters = useRef();
  const lights = useRef([]);
  const res = useMemo(() => {
    const geo = slabGeometry();
    const glowAttr = (list) => new THREE.InstancedBufferAttribute(new Float32Array(list), 1);
    const sparkGeo = geo.clone();
    sparkGeo.setAttribute("aGlow", glowAttr([1, 1]));
    const ranksGeo = geo.clone();
    ranksGeo.setAttribute("aGlow", glowAttr(MONOLITHS.map((m) => m.glow)));
    const floatGeo = geo.clone();
    floatGeo.setAttribute("aGlow", glowAttr(FLOATERS.map((_, i) => (i % 2 ? 1 : 0.6))));
    const metal = panelMetal("#3b3936", { key: "night-mono", roughness: 0.32 });
    const sheet = sheetMaterial();
    const sheetGeo = new THREE.PlaneGeometry(SPARK.gap * 1.4, 56);
    sheetGeo.translate(0, 28, 0);
    return { geo, sparkGeo, ranksGeo, floatGeo, metal, sheet, sheetGeo };
  }, []);

  // the spark pair and the ranks, set once
  useEffect(() => {
    const { left, right, gap, z } = SPARK;
    const pair = [
      { x: -(gap / 2 + left.w / 2), ...left },
      { x: gap / 2 + right.w / 2, ...right },
    ];
    pair.forEach((m, i) => {
      dummy.position.set(m.x, m.h / 2 - 0.6, z);
      dummy.rotation.set(0, 0, m.lean);
      dummy.scale.set(m.w, m.h, m.d);
      dummy.updateMatrix();
      spark.current.setMatrixAt(i, dummy.matrix);
    });
    spark.current.instanceMatrix.needsUpdate = true;
    spark.current.computeBoundingSphere();
    MONOLITHS.forEach((m, i) => {
      dummy.position.set(m.x, m.h / 2 - 0.6, m.z);
      dummy.rotation.set(0, m.yaw, m.lean);
      dummy.scale.set(m.w, m.h, m.d);
      dummy.updateMatrix();
      ranks.current.setMatrixAt(i, dummy.matrix);
    });
    ranks.current.instanceMatrix.needsUpdate = true;
    ranks.current.computeBoundingSphere();
  }, []);

  useEffect(
    () => () => {
      [res.geo, res.sparkGeo, res.ranksGeo, res.floatGeo, res.sheetGeo].forEach((g) => g.dispose());
      res.metal.dispose();
      res.sheet.dispose();
    },
    [res]
  );

  useFrame(() => {
    const t = C.t;
    // the slit's light, and the orange it throws
    const k = C.spark;
    res.sheet.uniforms.uK.value = k;
    lights.current.forEach((l, i) => l && (l.intensity = k * (i === 0 ? 900 : 500)));
    // the lifting blocks: up out of the ground, turning a little with the scroll
    const f = C.float;
    const m = floaters.current;
    m.visible = t > 14 && t < 70;
    if (m.visible) {
      FLOATERS.forEach((b, i) => {
        const g = THREE.MathUtils.smoothstep(f, i * 0.08, i * 0.08 + 0.6);
        dummy.position.set(lerp(b.p[0], b.to[0], g), lerp(b.p[1] + b.s[1] / 2 - 3.6, b.to[1], g), lerp(b.p[2], b.to[2], g));
        dummy.rotation.set(b.r[0] * g, b.r[1] * g + t * 0.012 * (i % 2 ? 1 : -1), b.r[2] * g);
        dummy.scale.set(...b.s);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={spark} args={[res.sparkGeo, res.metal, 2]} castShadow={tier.shadows} receiveShadow={tier.shadows} />
      <mesh geometry={res.sheetGeo} material={res.sheet} position={[0, 0, SPARK.z]} renderOrder={4} />
      <pointLight ref={(el) => (lights.current[0] = el)} position={[0, 3, SPARK.z + 4]} color="#ff6a1a" distance={90} decay={2} intensity={0} />
      <pointLight ref={(el) => (lights.current[1] = el)} position={[0, 22, SPARK.z + 3]} color="#ff7a2a" distance={70} decay={2} intensity={0} />
      <instancedMesh ref={ranks} args={[res.ranksGeo, res.metal, MONOLITHS.length]} castShadow={tier.shadows} receiveShadow={tier.shadows} />
      <instancedMesh ref={floaters} args={[res.floatGeo, res.metal, FLOATERS.length]} castShadow={tier.shadows} frustumCulled={false} />
    </group>
  );
}
