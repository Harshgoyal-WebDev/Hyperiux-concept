"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { GARDEN } from "../../config";
import { mulberry32 } from "../../world/layout";
import { GRASS_LAYER, patchSway } from "../../world/gardenAsset";
import { T } from "../../tuning";

// A lawn of real grass over the whole clearing: individual blades (one
// instanced draw), planted on the terrain's height grid everywhere but the
// water — thick round the pond and the camera's path, thinning towards the
// trees. Each blade is a tapered, curved strip, coloured from a dark root to
// a sunlit tip in drifting patches of greens with a few dry ones; it sways
// in the wind and bends away along the pointer's path (the garden's shared
// sway, see gardenAsset.js). The blades live on GRASS_LAYER, which the
// pond's reflection skips.

// one blade: 5 rows up a tapered strip, 1 m tall, 1 unit wide at the root
function bladeGeometry() {
  const rows = 5;
  const pos = [];
  const uv = [];
  const normal = [];
  const index = [];
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const w = 0.5 * (1 - Math.pow(t, 1.4)) + 0.02;
    for (const s of [-1, 1]) {
      pos.push(s * w, t, 0);
      uv.push(s < 0 ? 0 : 1, t);
      // soft, rounded normals leaning up: a lawn reads as one surface
      const n = new THREE.Vector3(s * 0.35, 0.8, 0.6).normalize();
      normal.push(n.x, n.y, n.z);
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    const a = r * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  g.setIndex(index);
  return g;
}

// the blade's own shape before the sway: a curve forward, narrow width
const BLADE_VERTEX = /* glsl */ `
transformed.x *= aBlade.y * uGrassWidth;
transformed.y *= uGrassHeight;
transformed.z += pow(uv.y, 2.0) * aBlade.z * 0.35 * uGrassHeight;
vGrassTint = aBlade.w;
vGrassT = uv.y;
`;

export default function GardenGrass({ tier, garden, sway }) {
  const ref = useRef();
  const built = useMemo(() => {
    const count = tier.gardenBlades;
    const rng = mulberry32(9090);
    const noise = createNoise2D(mulberry32(31));
    const geometry = bladeGeometry();
    const blade = new Float32Array(count * 4);
    const mesh = new THREE.InstancedMesh(geometry, null, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    let n = 0;
    for (let tries = 0; n < count && tries < count * 4; tries++) {
      // densest round the pond, thinning out to ~60 m
      const a = rng() * Math.PI * 2;
      const r = 5 + Math.pow(rng(), 1.35) * 58;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.9 + 2;
      const h = garden.height.sample(x, z);
      if (!Number.isFinite(h) || h < GARDEN.water + 0.04) continue;
      if (garden.trunks.some((t) => Math.abs(t.x - x) < 0.6 && Math.abs(t.z - z) < 0.6)) continue;
      // patches: taller, lusher drifts and shorter, drier ones
      const patch = noise(x * 0.07, z * 0.07);
      const tall = 0.32 + 0.38 * (patch * 0.5 + 0.5) + rng() * 0.18;
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      m.compose(p.set(x, h - 0.02, z), q, s.set(tall, tall, tall));
      mesh.setMatrixAt(n, m);
      // seed, width, lean, tint (0 lush → 1 dry)
      const dry = THREE.MathUtils.clamp(noise(x * 0.05 + 40, z * 0.05) * 0.6 + 0.15 + (rng() < 0.08 ? 0.5 : 0), 0, 1);
      blade.set([rng(), 0.05 + rng() * 0.05, (rng() - 0.3) * 1.2, dry], n * 4);
      n++;
    }
    mesh.count = n;
    geometry.setAttribute("aBlade", new THREE.InstancedBufferAttribute(blade, 4));
    const uniforms = {
      uGrassHeight: { value: 1 },
      uGrassWidth: { value: 1 },
      uGrassRoot: { value: new THREE.Color("#1f3a12") },
      uGrassTip: { value: new THREE.Color("#7fae3c") },
      uGrassDry: { value: new THREE.Color("#b5a35a") },
    };
    const material = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
    patchSway(material, { ...sway, ...uniforms }, 0, {
      key: "-blade",
      before: BLADE_VERTEX,
      fragment: (f) =>
        f
          .replace(
            "#include <common>",
            `#include <common>
            uniform vec3 uGrassRoot;
            uniform vec3 uGrassTip;
            uniform vec3 uGrassDry;
            varying float vGrassTint;
            varying float vGrassT;`
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            vec3 grassTip = mix(uGrassTip, uGrassDry, vGrassTint);
            // (clamped: interpolation can dip a hair below 0 at the root, and pow() of
            // a negative is NaN — which the bloom spreads over the whole frame)
            diffuseColor.rgb = mix(uGrassRoot, grassTip, pow(clamp(vGrassT, 0.0, 1.0), 0.8));`
          ),
    });
    // the vertex stage needs the blade attribute and the varyings
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prev(shader, renderer);
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        attribute vec4 aBlade;
        uniform float uGrassHeight;
        uniform float uGrassWidth;
        varying float vGrassTint;
        varying float vGrassT;`
      );
    };
    mesh.material = material;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.layers.set(GRASS_LAYER);
    return { mesh, geometry, material, uniforms, planted: n };
  }, [tier, garden, sway]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
      built.mesh.dispose();
    },
    [built]
  );

  useFrame(() => {
    const u = built.uniforms;
    u.uGrassHeight.value = T.grassHeight;
    u.uGrassWidth.value = T.grassWidth;
    u.uGrassRoot.value.set(T.grassRoot);
    u.uGrassTip.value.set(T.grassTip);
    u.uGrassDry.value.set(T.grassDry);
    built.mesh.count = Math.min(Math.round(built.planted * T.grassDensity), built.planted);
  });

  return <primitive ref={ref} object={built.mesh} />;
}
