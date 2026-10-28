"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { ASSETS, GARDEN, GARDEN_ORIGIN } from "../../config";
import { mulberry32 } from "../../world/layout";
import { GRASS_LAYER, GUSTS, RIPPLES, TRAIL, createSwayUniforms, prepareGarden } from "../../world/gardenAsset";
import { setGardenGround } from "../../world/gardenCamera";
import { pointer } from "../../pointer";
import { T } from "../../tuning";
import { GARDEN_SUN, createGardenEnvironment, createSkyMaterial } from "./sky";
import ParticleLogo from "./ParticleLogo";
import GardenGrass, { LAWN_RADIUS } from "./GardenGrass";
import GardenFlowers from "./GardenFlowers";
import GardenBlossoms from "./GardenBlossoms";
import GardenPond from "./GardenPond";
import GardenAir from "./GardenAir";

// The garden beyond the forged logo, as its own world (WorldSwitch swaps it
// in under the light): hyperiux-garden-environment.glb — terrain, trees,
// bushes, grass, rocks, flowers, with more bushes and flowers planted, the
// pond widened and low ridges raised beyond the clearing — placed at
// GARDEN_ORIGIN, under a daylight sky with a warm sun from behind the
// camera; a lawn of real grass over the clearing, blossom on the trees, the
// pond (a mirror with currents and ripples), two rings of small mountains
// past the terrain's far edge, the particle body over the water, and the
// air. Grass, leaves and flowers sway in the wind and in the pointer's own
// wind (gusts along its path, a ripple from a click); bushes, plants and
// flowers glow where it passes.

// Small mountains ringing the garden past the terrain's hard far edge: a
// nearer ring of low wooded ridges and a far, hazier one of taller peaks.
// Each is a band of ground round the garden, rising from below the horizon
// to a ridge line (ridged noise round the ring: peaks, cols and spurs) and
// falling away behind; the sun on its slopes and the haze at its foot are
// baked into its vertex colours.
const MOUNTAIN_RINGS = [
  { radius: 128, depth: 44, low: 4, high: 22, colour: "#4a6648", haze: 0.28, seed: 77, freq: [2.3, 5.6, 14] },
  { radius: 205, depth: 70, low: 14, high: 48, colour: "#6d879c", haze: 0.5, seed: 78, freq: [1.7, 4.3, 11] },
];
// the band's profile across: (offset from the ridge line, share of depth;
// share of the height)
const MOUNTAIN_PROFILE = [
  [-0.5, 0],
  [-0.3, 0.32],
  [-0.14, 0.68],
  [-0.04, 0.93],
  [0, 1],
  [0.18, 0.72],
  [0.5, 0.15],
];
function buildMountains({ radius, depth, low, high, colour, haze, seed, freq }) {
  const noise = createNoise2D(mulberry32(seed));
  const steps = 360;
  const rows = MOUNTAIN_PROFILE.length;
  const pos = [];
  const share = [];
  const index = [];
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ridge = (f, o) => 1 - Math.abs(noise(ca * f + o, sa * f - o));
    const crest = Math.pow(ridge(freq[0], 0) * 0.6 + ridge(freq[1], 3) * 0.3 + ridge(freq[2], 9) * 0.1, 1.6);
    const peak = low + (high - low) * crest;
    const r0 = radius + noise(ca * 1.3 + 20, sa * 1.3) * depth * 0.25;
    for (const [off, w] of MOUNTAIN_PROFILE) {
      const r = r0 + off * depth;
      // the slopes rumpled into spurs and gullies
      const rumple = w > 0 && w < 1 ? noise(ca * freq[2] * 2.2 + off * 3, sa * freq[2] * 2.2) * (peak + 12) * 0.06 : 0;
      pos.push(ca * r, -12 + (peak + 12) * w + rumple, sa * r - 20);
      share.push(w);
    }
  }
  for (let s = 0; s < steps; s++) {
    for (let k = 0; k < rows - 1; k++) {
      const i = s * rows + k;
      index.push(i, i + rows, i + 1, i + 1, i + rows, i + rows + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  // lit by the sun on its slopes, hazier towards its foot
  const base = new THREE.Color(colour);
  const mist = new THREE.Color("#a9bfd0");
  const c = new THREE.Color();
  const n = new THREE.Vector3();
  const colors = [];
  for (let i = 0; i < share.length; i++) {
    // (the side of the slope facing up)
    n.fromBufferAttribute(g.attributes.normal, i);
    if (n.y < 0) n.negate();
    const lit = 0.55 + 0.6 * Math.max(n.dot(GARDEN_SUN), 0);
    c.copy(base).multiplyScalar(lit).lerp(mist, haze + (1 - share[i]) * 0.3);
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

export default function Garden({ J, tier, worlds }) {
  const { gl, camera } = useThree();
  const gltf = useGLTF(ASSETS.gardenGlb);
  const group = useRef();
  const sun = useRef();
  const time = useMemo(() => ({ value: 0 }), []);
  const sway = useMemo(() => createSwayUniforms(time), [time]);
  // the ground's shape (the pond's size, the ridges) is built into the
  // garden: changed in the panel, it is rebuilt once the slider settles
  const [ground, setGround] = useState(() => ({ pond: T.pondSize, ridges: T.gardenRidges }));
  const garden = useMemo(
    () =>
      prepareGarden(gltf.scene, {
        grassShare: tier.gardenGrass,
        extraBushes: tier.gardenBushes,
        lawnRadius: LAWN_RADIUS,
        dropFlowers: true,
        pondScale: ground.pond,
        ridges: ground.ridges,
        sway,
      }),
    [gltf, tier, sway, ground]
  );
  const pondAxes = useMemo(() => GARDEN.pondGlbAxes.map((a) => a * ground.pond), [ground]);
  const sky = useMemo(() => createSkyMaterial(), []);
  const env = useMemo(() => createGardenEnvironment(gl), [gl]);
  // daylight haze: soft on the far trees, hiding the terrain's far edge
  const fog = useMemo(() => new THREE.FogExp2("#b7cde0", 0.0045), []);
  const extras = useMemo(() => {
    const mountains = new THREE.Group();
    const mountainMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    for (const ring of MOUNTAIN_RINGS) mountains.add(new THREE.Mesh(buildMountains(ring), mountainMaterial));
    const sunTarget = new THREE.Object3D();
    sunTarget.position.copy(GARDEN.pond);
    return { mountains, mountainMaterial, sunTarget };
  }, []);

  // the camera keeps clear of the ground as it revolves
  useEffect(() => {
    setGardenGround(garden.height ? (x, z) => garden.height.sample(x, z) : null);
    return () => setGardenGround(null);
  }, [garden]);

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
    // (its sun's shadows are drawn once, not every frame: draw them again)
    gl.shadowMap.needsUpdate = true;
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
      extras.mountains.children.forEach((m) => m.geometry.dispose());
      extras.mountainMaterial.dispose();
    },
    [sky, env, extras]
  );
  useEffect(
    () => () => {
      if (garden.missing) return;
      garden.terrain.geometry.dispose();
      garden.materials.forEach((m) => m.dispose());
      garden.root.traverse((o) => o.isInstancedMesh && o.dispose());
    },
    [garden]
  );

  useEffect(() => {
    if (sun.current) sun.current.target = extras.sunTarget;
  }, [extras]);

  // the pointer: its recent lines of sight (the glow, fading as they age),
  // and the puffs of air it releases where it crosses the ground (the wind)
  const s = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      live: 0,
      trail: Array.from({ length: TRAIL - 1 }, () => ({ o: new THREE.Vector3(0, -1000, 0), d: new THREE.Vector3(0, 0, -1), at: -1e9 })),
      next: 0,
      lastPush: 0,
      lastMoved: 0,
      gusts: [], // { x, z, wx, wz, age, radius, drift } (world)
      ripples: [], // { x, z, age, strength } (world)
      hit: new THREE.Vector3(),
      lastHit: new THREE.Vector3(),
      hasHit: false,
      lastGustAt: 0,
      clicks: pointer.clicks,
      ground: "",
      groundAt: 0,
      groundAsked: "",
    }),
    []
  );
  // where the pointer's line of sight meets the ground (garden height grid),
  // in world space; false if it misses
  const groundHit = (ray, out) => {
    const o = ray.origin;
    const d = ray.direction;
    let t = 0.5;
    for (let i = 0; i < 240 && t < 120; i++) {
      const x = o.x + d.x * t - GARDEN_ORIGIN.x;
      const z = o.z + d.z * t - GARDEN_ORIGIN.z;
      const y = o.y + d.y * t - GARDEN_ORIGIN.y;
      const h = garden.height?.sample(x, z);
      if (Number.isFinite(h) && y <= h) {
        out.set(x + GARDEN_ORIGIN.x, h + GARDEN_ORIGIN.y, z + GARDEN_ORIGIN.z);
        return true;
      }
      t += 0.25 + t * 0.02;
    }
    return false;
  };
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
    // the live line of sight (world)
    s.live += ((pointer.active ? 1 : 0) - s.live) * (1 - Math.exp(-dt / 0.15));
    o[0].set(s.ray.ray.origin.x, s.ray.ray.origin.y, s.ray.ray.origin.z, s.live);
    d[0].set(s.ray.ray.direction.x, s.ray.ray.direction.y, s.ray.ray.direction.z, 0);
    const moved = pointer.active && pointer.movedAt !== s.lastMoved;
    // drop a copy along the way while it moves
    if (moved && now - s.lastPush > 60) {
      const e = s.trail[s.next];
      e.o.copy(s.ray.ray.origin);
      e.d.copy(s.ray.ray.direction);
      e.at = now;
      s.next = (s.next + 1) % s.trail.length;
      s.lastPush = now;
    }
    const linger = Math.max(T.gardenHoverLinger, 0.05) * 1000;
    s.trail.forEach((e, i) => {
      const f = Math.max(1 - (now - e.at) / linger, 0);
      o[i + 1].set(e.o.x, e.o.y, e.o.z, f * f);
      d[i + 1].set(e.d.x, e.d.y, e.d.z, 0);
    });

    // the pointer's wind: a puff of air every so often along its path over
    // the ground, carrying its speed there
    const hit = pointer.active && groundHit(s.ray.ray, s.hit);
    if (hit && moved) {
      if (!s.hasHit) s.lastHit.copy(s.hit);
      const dist = Math.hypot(s.hit.x - s.lastHit.x, s.hit.z - s.lastHit.z);
      const since = (now - s.lastGustAt) / 1000;
      if (dist > 0.4 && since > 0.05) {
        const speed = Math.min(dist / Math.max(since, 0.016), 14);
        const k = Math.min(speed * 0.05, 0.7) / Math.max(dist, 1e-3);
        s.gusts.push({ x: s.hit.x, z: s.hit.z, wx: (s.hit.x - s.lastHit.x) * k, wz: (s.hit.z - s.lastHit.z) * k, age: 0, radius: T.gardenHoverRadius * 0.55, drift: 0.7 });
        if (s.gusts.length > GUSTS) s.gusts.shift();
        s.lastHit.copy(s.hit);
        s.lastGustAt = now;
      }
    }
    s.hasHit = hit;
    s.lastMoved = pointer.movedAt;
    // a click: a ring of air across the meadow
    if (pointer.clicks !== s.clicks) {
      s.clicks = pointer.clicks;
      if (hit) {
        s.ripples.push({ x: s.hit.x, z: s.hit.z, age: 0, strength: 0.45 * T.gardenHoverStrength });
        if (s.ripples.length > RIPPLES) s.ripples.shift();
      }
    }
    for (const g of s.gusts) g.age += dt;
    for (const r of s.ripples) r.age += dt;
    s.gusts = s.gusts.filter((g) => g.age < 2.6);
    s.ripples = s.ripples.filter((r) => r.age < 3.2);
    s.gusts.forEach((g, i) => {
      sway.uGustA.value[i].set(g.x, g.z, g.wx, g.wz);
      sway.uGustB.value[i].set(g.age, g.radius, g.drift, 0);
    });
    sway.uGustCount.value = s.gusts.length;
    s.ripples.forEach((r, i) => sway.uRipple.value[i].set(r.x, r.z, r.age, r.strength));
    sway.uRippleCount.value = s.ripples.length;
    sway.uPushAmount.value = T.gardenHoverStrength;
    sway.uWindAmount.value = T.gardenWind;
    sway.uGlowRadius.value = T.gardenGlowRadius;
    sway.uGlowStrength.value = T.gardenGlow;
    sway.uGlowColor.value.set(T.gardenGlowColor);
    if (sun.current) sun.current.intensity = T.gardenSun;
    extras.mountains.scale.y = T.gardenMountains;

    // the ground's shape from the panel: rebuilt once it has held still a moment
    const want = `${T.pondSize}|${T.gardenRidges}`;
    if (want !== s.ground) {
      s.ground = want;
      s.groundAt = now;
    } else if (want !== `${ground.pond}|${ground.ridges}` && want !== s.groundAsked && now - s.groundAt > 400) {
      s.groundAsked = want;
      setGround({ pond: T.pondSize, ridges: T.gardenRidges });
    }
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
        <GardenFlowers tier={tier} garden={garden} sway={sway} />
        <GardenBlossoms tier={tier} garden={garden} sway={sway} />
        <GardenPond tier={tier} time={time} axes={pondAxes} />
        <primitive object={extras.mountains} />
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
        <GardenAir time={time} />
      </group>
    </group>
  );
}
