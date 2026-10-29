"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../world/layout";
import { breakupGLSL, breakupUniforms, puffDirection, samplePieceSurfaces } from "../world/breakup";
import { PALETTE } from "../config";
import { T } from "../tuning";

// The gravel the broken rock turns into: small lit, flat-shaded stones
// (one instanced draw) that chip off each piece as it wears away — the
// freshest still glowing from the cracks — tumble out and are carried into
// the swirl round the mark with the sand (see world/breakup.js).

// a rough little stone: an icosahedron with its corners pushed about
function stoneGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const pos = g.attributes.position;
  const rng = mulberry32(77);
  const moved = new Map();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // corners are repeated per face: move each one the same way
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!moved.has(key)) moved.set(key, 0.7 + rng() * 0.5);
    v.multiplyScalar(moved.get(key));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function patch(material, uniforms, pieces) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        ${breakupGLSL(pieces)}
        attribute vec3 aLocal;
        attribute vec4 aGravel; // piece, threshold, size (m), seed
        attribute vec4 aDrift; // puff direction, seed
        uniform float uGravelSize;
        uniform float uFade;
        varying float vGvTint;
        varying float vGvHot;
        mat3 gvRot;
        vec3 gvPos;
        vec3 gvScale;`
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        {
          float g = breakupFlow(int(aGravel.x + 0.5), aLocal, aGravel.y, aDrift, gvPos);
          float s = aGravel.w;
          // chips off at a little under full size, never seen growing from nothing
          float size = g < 0.0 ? 0.0 : aGravel.z * uGravelSize * uFade * mix(0.6, 1.0, smoothstep(0.0, 0.12, g));
          gvScale = size * vec3(1.0, 0.55 + 0.45 * fract(s * 3.17), 0.7 + 0.3 * fract(s * 5.71));
          // tumbling as it goes round
          vec3 axis = normalize(vec3(sin(s * 12.9), cos(s * 7.3), sin(s * 3.1 + 1.0)) + 1e-4);
          float ang = uTime * (0.5 + 1.6 * fract(s * 9.1)) + s * 40.0;
          float c = cos(ang);
          float sn = sin(ang);
          float t = 1.0 - c;
          gvRot = mat3(
            t * axis.x * axis.x + c, t * axis.x * axis.y + sn * axis.z, t * axis.x * axis.z - sn * axis.y,
            t * axis.x * axis.y - sn * axis.z, t * axis.y * axis.y + c, t * axis.y * axis.z + sn * axis.x,
            t * axis.x * axis.z + sn * axis.y, t * axis.y * axis.z - sn * axis.x, t * axis.z * axis.z + c
          );
          objectNormal = gvRot * objectNormal;
          vGvTint = fract(s * 13.7);
          vGvHot = g < 0.0 ? 0.0 : step(0.72, fract(s * 4.3)) * (1.0 - smoothstep(0.0, 0.5, g));
        }`
      )
      .replace("#include <begin_vertex>", "vec3 transformed = gvRot * (position * gvScale) + gvPos;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uHotColor;
        varying float vGvTint;
        varying float vGvHot;`
      )
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.65, 1.3, vGvTint);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uHotColor * vGvHot * 2.2;");
  };
  material.customProgramCacheKey = () => "forge-gravel";
}

export default function Gravel({ J, tier, shared, forge }) {
  const ref = useRef();
  const built = useMemo(() => {
    const count = tier.maxGravel;
    const rng = mulberry32(5150);
    const { local, piece, threshold } = samplePieceSurfaces(forge, count, rng);
    // (the draws the old orbit placement took, so every grain keeps its size, tint and drift)
    for (let k = 0; k < count * 8; k++) rng();
    const gravel = new Float32Array(count * 4);
    const drift = new Float32Array(count * 4);
    const dir = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // mostly small chips, a few larger stones (metres)
      gravel.set([piece[i], threshold[i], 0.08 + Math.pow(rng(), 2.2) * 0.42, rng()], i * 4);
      puffDirection(rng, dir);
      drift.set([dir.x, dir.y, dir.z, rng()], i * 4);
    }
    const stone = stoneGeometry();
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = stone.index;
    geometry.setAttribute("position", stone.attributes.position);
    geometry.setAttribute("normal", stone.attributes.normal);
    geometry.setAttribute("aLocal", new THREE.InstancedBufferAttribute(local, 3));
    geometry.setAttribute("aGravel", new THREE.InstancedBufferAttribute(gravel, 4));
    geometry.setAttribute("aDrift", new THREE.InstancedBufferAttribute(drift, 4));
    geometry.instanceCount = 0;
    const uniforms = {
      ...breakupUniforms(forge, shared),
      uGravelSize: { value: 1 },
      uFade: { value: 1 },
      uHotColor: { value: new THREE.Color("#ff6a14") },
    };
    const material = new THREE.MeshStandardMaterial({ color: PALETTE.basalt, roughness: 0.88, metalness: 0, flatShading: true });
    patch(material, uniforms, forge.chunks.length);
    return { geometry, material, uniforms, stone };
  }, [forge, tier, shared]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.stone.dispose();
      built.material.dispose();
    },
    [built]
  );

  useFrame(() => {
    const on = J.fracture > 0 && !J.inGarden && T.gravelCount >= 1;
    if (ref.current) ref.current.visible = on;
    if (!on) return;
    const u = built.uniforms;
    u.uGravelSize.value = T.gravelSize;
    // shrinks away in the light before the worlds switch
    u.uFade.value = 1 - THREE.MathUtils.smoothstep(J.flash, 0.3, 0.9);
    u.uHotColor.value.set(T.crackColor);
    built.geometry.instanceCount = Math.min(Math.round(T.gravelCount), tier.maxGravel);
  });

  return <mesh ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} />;
}
