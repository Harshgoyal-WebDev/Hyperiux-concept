"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { ASSETS, GARDEN, GARDEN_ORIGIN } from "../../config";
import { mulberry32 } from "../../world/layout";
import { GRASS_LAYER, TRAIL, createSwayUniforms, prepareGarden } from "../../world/gardenAsset";
import { pointer } from "../../pointer";
import { T } from "../../tuning";
import { GARDEN_SUN, createGardenEnvironment, createSkyMaterial } from "./sky";
import ParticleLogo from "./ParticleLogo";
import GardenGrass from "./GardenGrass";
import GardenPond from "./GardenPond";

// The garden beyond the forged logo, as its own world (WorldSwitch swaps it
// in under the light): hyperiux-garden-environment.glb — terrain, trees,
// bushes, grass, rocks, flowers, with more bushes and flowers planted —
// placed at GARDEN_ORIGIN, under a daylight sky with a warm sun from behind
// the camera; a lawn of real grass over the clearing, the pond (a mirror
// with currents and ripples), a ring of hazy hills past the terrain's far
// edge, and the bubble logo over the water. Grass, leaves and flowers sway
// in the wind and part along the pointer's path; bushes, plants and flowers
// glow where it passes.

// Low hazy hills ringing the garden past the terrain's hard far edge.
function buildHills() {
  const noise = createNoise2D(mulberry32(77));
  const steps = 200;
  const pos = [];
  const colors = [];
  const index = [];
  const near = new THREE.Color("#5f7a55");
  const haze = new THREE.Color("#9fb6c4");
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    const r = 165 + noise(Math.cos(a) * 2, Math.sin(a) * 2) * 20;
    const h = 8 + (noise(Math.cos(a) * 3.1 + 5, Math.sin(a) * 3.1) * 0.5 + 0.5) * 22;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 20;
    pos.push(x, -12, z, x, h, z);
    const c = near.clone().lerp(haze, 0.5 + noise(a * 4, 1) * 0.15);
    colors.push(c.r * 0.9, c.g * 0.9, c.b * 0.9, c.r, c.g, c.b);
  }
  for (let s = 0; s < steps; s++) {
    const k = s * 2;
    index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  return g;
}

export default function Garden({ J, tier, worlds }) {
  const { gl, camera } = useThree();
  const gltf = useGLTF(ASSETS.gardenGlb);
  const group = useRef();
  const sun = useRef();
  const time = useMemo(() => ({ value: 0 }), []);
  const sway = useMemo(() => createSwayUniforms(time), [time]);
  const garden = useMemo(
    () => prepareGarden(gltf.scene, { grassShare: tier.gardenGrass, extraBushes: tier.gardenBushes, extraFlowers: tier.gardenFlowers, sway }),
    [gltf, tier, sway]
  );
  const sky = useMemo(() => createSkyMaterial(), []);
  const env = useMemo(() => createGardenEnvironment(gl), [gl]);
  // daylight haze: soft on the far trees, hiding the terrain's far edge
  const fog = useMemo(() => new THREE.FogExp2("#b7cde0", 0.0045), []);
  const extras = useMemo(() => {
    const hills = new THREE.Mesh(buildHills(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    const sunTarget = new THREE.Object3D();
    sunTarget.position.copy(GARDEN.pond);
    return { hills, sunTarget };
  }, []);

  useEffect(() => {
    if (garden.missing) console.error(`[forging-concept] ${ASSETS.gardenGlb} is missing: ${garden.missing.join(", ")}. The garden is not rendered.`);
  }, [garden]);

  useEffect(() => {
    if (!group.current) return;
    worlds.garden = { group: group.current, fog, env };
    J.gardenReady = true;
    // compile its shaders and upload its textures now, while it is hidden,
    // so the switch under the light doesn't stall
    const g = group.current;
    g.visible = true;
    g.fog = fog;
    g.environment = env;
    if (!garden.missing) for (const t of garden.textures) gl.initTexture(t);
    gl.compileAsync(g, camera).catch(() => {});
    g.visible = worlds.gardenActive;
    g.fog = null;
    g.environment = null;
    return () => {
      worlds.garden = null;
      J.gardenReady = false;
    };
  }, [J, worlds, fog, env, gl, camera, garden]);

  useEffect(
    () => () => {
      sky.dispose();
      env.dispose();
      extras.hills.geometry.dispose();
      extras.hills.material.dispose();
      if (!garden.missing) {
        garden.materials.forEach((m) => m.dispose());
        garden.root.traverse((o) => o.isInstancedMesh && o.dispose());
      }
    },
    [sky, env, extras, garden]
  );

  useEffect(() => {
    if (sun.current) sun.current.target = extras.sunTarget;
  }, [extras]);

  // the pointer's recent path: its live line of sight, and a few older ones
  // that fade as they age (grass parts along the way and closes up behind;
  // the glow lingers a moment on what it passed)
  const s = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      live: 0,
      trail: Array.from({ length: TRAIL - 1 }, () => ({ o: new THREE.Vector3(0, -1000, 0), d: new THREE.Vector3(0, 0, -1), at: -1e9 })),
      next: 0,
      lastPush: 0,
      lastMoved: 0,
    }),
    []
  );
  useEffect(() => {
    // the lawn's blades are on their own layer (the pond's reflection skips it)
    camera.layers.enable(GRASS_LAYER);
  }, [camera]);

  useFrame((_, delta) => {
    // only alive while it is on screen
    if (!worlds.gardenActive) return;
    const dt = Math.min(delta, 0.1);
    time.value += dt;
    sky.uniforms.uTime.value = time.value;

    const now = performance.now();
    s.ndc.set(pointer.x, pointer.y);
    s.ray.setFromCamera(s.ndc, camera);
    const o = sway.uTrailO.value;
    const d = sway.uTrailD.value;
    // the live one, in the garden's own metres
    s.live += ((pointer.active ? 1 : 0) - s.live) * (1 - Math.exp(-dt / 0.15));
    o[0].set(s.ray.ray.origin.x - GARDEN_ORIGIN.x, s.ray.ray.origin.y - GARDEN_ORIGIN.y, s.ray.ray.origin.z - GARDEN_ORIGIN.z, s.live);
    d[0].set(s.ray.ray.direction.x, s.ray.ray.direction.y, s.ray.ray.direction.z, 0);
    // drop a copy along the way while it moves
    if (pointer.active && pointer.movedAt !== s.lastMoved && now - s.lastPush > 60) {
      const e = s.trail[s.next];
      e.o.set(o[0].x, o[0].y, o[0].z);
      e.d.copy(s.ray.ray.direction);
      e.at = now;
      s.next = (s.next + 1) % s.trail.length;
      s.lastPush = now;
      s.lastMoved = pointer.movedAt;
    }
    const linger = Math.max(T.gardenHoverLinger, 0.05) * 1000;
    s.trail.forEach((e, i) => {
      const f = Math.max(1 - (now - e.at) / linger, 0);
      o[i + 1].set(e.o.x, e.o.y, e.o.z, f * f);
      d[i + 1].set(e.d.x, e.d.y, e.d.z, 0);
    });
    sway.uPushRadius.value = T.gardenHoverRadius;
    sway.uPushAmount.value = T.gardenHoverStrength;
    sway.uWindAmount.value = T.gardenWind;
    sway.uGlowRadius.value = T.gardenGlowRadius;
    sway.uGlowStrength.value = T.gardenGlow;
    sway.uGlowColor.value.set(T.gardenGlowColor);
    if (sun.current) sun.current.intensity = T.gardenSun;
  });

  const shadow = Math.min(tier.shadowMap || 0, 2048);
  const sunPos = useMemo(() => GARDEN_SUN.clone().multiplyScalar(120).add(GARDEN.pond), []);
  if (garden.missing) return null;
  return (
    <group ref={group} visible={false}>
      <mesh material={sky} frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[2400, 48, 24]} />
      </mesh>
      <group position={GARDEN_ORIGIN}>
        <primitive object={garden.root} />
        <GardenGrass tier={tier} garden={garden} sway={sway} />
        <GardenPond tier={tier} time={time} />
        <primitive object={extras.hills} />
        <primitive object={extras.sunTarget} />
        <directionalLight
          ref={sun}
          color="#fff0d8"
          intensity={3}
          position={sunPos}
          castShadow={shadow > 0}
          shadow-mapSize={[shadow || 512, shadow || 512]}
          shadow-bias={-0.0003}
          shadow-normalBias={0.04}
          shadow-camera-left={-55}
          shadow-camera-right={55}
          shadow-camera-top={55}
          shadow-camera-bottom={-55}
          shadow-camera-near={10}
          shadow-camera-far={260}
        />
        <hemisphereLight args={["#bcd5ee", "#5d6b3e", 0.7]} />
        <ParticleLogo J={J} tier={tier} time={time} />
      </group>
    </group>
  );
}
