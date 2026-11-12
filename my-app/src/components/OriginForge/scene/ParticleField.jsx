"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { C, lerp } from "../timeline";
import { particleMaterial } from "../world/shaders";
import { MARK_CENTER, sampleMarkTargets } from "../world/logo";
import { mulberry32 } from "../world/textures";
import { stairPoint } from "../world/stair";
import { createParticleSim } from "../world/particleSim";
import { attachPointer, pointer } from "../pointer";
import { T } from "../tuning";
import { CORE_POS } from "./EnergyCore";

// The energy made visible: one Points draw for the forge (embers drifting in
// the plaza and down the corridor), one for the dust in the stair hall's
// light. Every particle's motion is computed in the vertex shader from the
// timeline channels (world/shaders.js particleMaterial), so thousands of
// them cost one draw call and no per-frame JS work.
//
// The pointer stirs them, as it stirs the garden's particle body: each
// particle near the cursor is dragged along with it and parted, drifts loose
// on a churning flow, glows white-hot, and finds its way home to its path
// (world/particleSim.js, simulated on the GPU).

function buildForge(count, rand) {
  const plaza = Math.floor(count * 0.8);
  const home = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const group = new Float32Array(count);
  const target = sampleMarkTargets(count, rand);
  for (let i = 0; i < count; i++) {
    if (i < plaza) {
      // a wide cylinder around the core, thicker toward the centre
      const a = rand() * Math.PI * 2;
      const r = 2 + Math.pow(rand(), 0.8) * 42;
      home[i * 3] = Math.cos(a) * r;
      home[i * 3 + 1] = 1 + rand() * 16;
      home[i * 3 + 2] = Math.sin(a) * r + 6;
      group[i] = 0;
    } else {
      // the corridor's embers
      home[i * 3] = (rand() - 0.5) * 9;
      home[i * 3 + 1] = 1 + rand() * 11;
      home[i * 3 + 2] = -8 - rand() * 62;
      group[i] = 1;
    }
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = rand();
  }
  return geometry({ home, seed, group, target }, count);
}

function buildDust(count, rand) {
  const home = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const group = new Float32Array(count).fill(2);
  const target = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = stairPoint(rand() * 1.05, (rand() - 0.5) * 22, 1 + rand() * 10);
    home[i * 3] = p.x;
    home[i * 3 + 1] = p.y;
    home[i * 3 + 2] = p.z;
    for (let k = 0; k < 4; k++) seed[i * 4 + k] = rand();
  }
  return geometry({ home, seed, group, target }, count);
}

function geometry({ home, seed, group, target }, count) {
  const geo = new THREE.BufferGeometry();
  // `position` is required by three; the shader uses aHome
  geo.setAttribute("position", new THREE.BufferAttribute(home, 3));
  geo.setAttribute("aHome", new THREE.BufferAttribute(home, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  geo.setAttribute("aGroup", new THREE.BufferAttribute(group, 1));
  geo.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 10, -60), 400);
  geo.setDrawRange(0, count);
  return geo;
}

export default function ParticleField({ tier }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const gl = useThree((s) => s.gl);
  const res = useMemo(() => {
    const rand = mulberry32(7);
    const forgeGeo = buildForge(tier.particles, rand);
    const dustGeo = buildDust(Math.floor(tier.particles * 0.3), rand);
    const forgeMat = particleMaterial();
    const dustMat = particleMaterial({ light: true });
    // the pointer's touch: only where there is a fine pointer to stir with
    const fine = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;
    const sims = fine
      ? [createParticleSim(gl, forgeGeo, forgeMat), createParticleSim(gl, dustGeo, dustMat, { light: true })]
      : [null, null];
    return { forgeGeo, dustGeo, forgeMat, dustMat, sims };
  }, [gl, tier.particles]);
  const ptr = useMemo(() => ({ uv: new THREE.Vector2(-10, -10), last: new THREE.Vector2(-10, -10), vel: new THREE.Vector2(), tmp: new THREE.Vector2(), hover: 0 }), []);
  useEffect(() => attachPointer(), []);
  const cam = useMemo(() => ({ viewProj: new THREE.Matrix4(), right: new THREE.Vector3(), up: new THREE.Vector3() }), []);

  useEffect(
    () => () => {
      res.sims.forEach((s) => s?.dispose());
      res.forgeGeo.dispose();
      res.dustGeo.dispose();
      res.forgeMat.dispose();
      res.dustMat.dispose();
    },
    [res]
  );

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);
    const u = res.forgeMat.uniforms;
    u.uTime.value = time;
    u.uPixelRatio.value = dpr;
    u.uSize.value = tier.particleSize * T.particleSize;
    u.uDensity.value = T.particleDensity;
    u.uBright.value = T.particleBrightness;
    u.uAttract.value = C.attract;
    u.uOrbit.value = C.orbit;
    u.uOrbitR.value = lerp(12, 7, C.gather);
    u.uForge.value = C.forge;
    u.uDisperse.value = C.disperse;
    u.uCore.value.copy(CORE_POS);
    u.uMark.value.copy(MARK_CENTER);
    u.uPlaza.value = 0.55 + 0.45 * C.core;
    u.uCorr.value = C.corridorRise * (1 - C.light);
    u.uAlpha.value = 1 - C.light;
    const d = res.dustMat.uniforms;
    d.uTime.value = time;
    d.uPixelRatio.value = dpr;
    d.uSize.value = tier.particleSize * 0.8 * T.particleSize;
    d.uDensity.value = Math.min(1, T.particleDensity * 1.6);
    d.uBright.value = T.particleBrightness;
    d.uAlpha.value = C.light * 0.85;

    // the pointer's touch, simulated (world/particleSim.js)
    if (!res.sims[0] && !res.sims[1]) return;
    const active = pointer.active;
    if (active) ptr.uv.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
    if (active) {
      if (ptr.last.x < -5) ptr.last.copy(ptr.uv);
      ptr.tmp.subVectors(ptr.uv, ptr.last).divideScalar(Math.max(dt, 1e-3));
      ptr.last.copy(ptr.uv);
    } else {
      ptr.tmp.set(0, 0);
      ptr.last.set(-10, -10);
    }
    ptr.vel.lerp(ptr.tmp, 1 - Math.exp(-dt * 20));
    ptr.hover += ((active ? 1 : 0) - ptr.hover) * (1 - Math.exp(-dt / 0.2));
    const camera = state.camera;
    camera.updateMatrixWorld();
    cam.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    cam.right.setFromMatrixColumn(camera.matrixWorld, 0);
    cam.up.setFromMatrixColumn(camera.matrixWorld, 1);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const aspect = state.size.width / Math.max(1, state.size.height);
    // each set only while it can be seen
    const shown = [u.uAlpha.value > 0.001, d.uAlpha.value > 0.001];
    res.sims.forEach((sim, i) => {
      if (!sim || !shown[i]) return;
      const v = sim.uniforms;
      v.uViewProj.value.copy(cam.viewProj);
      v.uCamRight.value.copy(cam.right);
      v.uCamUp.value.copy(cam.up);
      v.uTanHalf.value = tanHalf;
      v.uAspect.value = aspect;
      v.uMouseUV.value.copy(ptr.uv);
      v.uMouseVel.value.copy(ptr.vel);
      v.uHover.value = ptr.hover;
      v.uHoverRadius.value = T.stirRadius;
      v.uHoverForce.value = T.stirForce;
      v.uDrag.value = T.stirDrag;
      v.uSpring.value = T.stirSpring;
      v.uDamping.value = T.stirDamping;
      v.uFlow.value = T.stirFlow;
      v.uScatterTime.value = T.stirScatter;
      sim.step(dt);
    });
  });

  return (
    <>
      <points geometry={res.forgeGeo} material={res.forgeMat} frustumCulled={false} />
      <points geometry={res.dustGeo} material={res.dustMat} frustumCulled={false} />
    </>
  );
}
