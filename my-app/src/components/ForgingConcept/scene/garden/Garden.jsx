"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { ASSETS, GARDEN, GARDEN_ORIGIN } from "../../config";
import { mulberry32 } from "../../world/layout";
import { GRASS_LAYER, RIPPLES, createSwayUniforms, prepareGarden } from "../../world/gardenAsset";
import { createWindField } from "../../world/windField";
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
// bushes, grass, rocks (its flowers left out for the garden's own), with more
// bushes planted, the pond widened and ridges raised round it — placed at
// GARDEN_ORIGIN, under a daylight sky with a warm sun from behind the
// camera; a lawn of real grass over the clearing, blossom on the trees, the
// pond (a mirror with currents and ripples), two rings of small mountains
// past the terrain's far edge, the particle body over the water, and the
// air. Grass, leaves and flowers sway in the wind and in the pointer's own
// wind (a wind field brushed along its path, a ripple from a click); bushes,
// plants and flowers glow where it has just passed, only while it moves.

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
    gl.compileAsync(g, camera)
      .catch(() => {})
      .then(() => {
        J.gardenCompiled = true;
      });
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

  // the pointer's wind over the meadow (a field brushed along its path),
  // and the rings of air from its clicks
  const wind = useMemo(() => {
    // over the lawn and a little past it (world)
    const half = LAWN_RADIUS + 4;
    return createWindField(new THREE.Vector4(GARDEN_ORIGIN.x - half, GARDEN_ORIGIN.z + 2 - half, half * 2, half * 2));
  }, []);
  useEffect(() => () => wind.dispose(), [wind]);
  const s = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      lastMoved: 0,
      ripples: [], // { x, z, age, strength } (world)
      hit: new THREE.Vector3(),
      lastHit: new THREE.Vector3(),
      hasHit: false,
      vel: new THREE.Vector2(),
      want: new THREE.Vector2(),
      moving: 0,
      activeUntil: 0,
      clicks: pointer.clicks,
      ground: "",
      groundAt: 0,
      groundAsked: "",
    }),
    []
  );
  // where the pointer's line of sight first meets the garden — a tree's
  // canopy (so its blossom lights up, not the grass under it) or the ground
  // (garden height grid) — in world space; false if it misses
  const canopies = garden.canopies || [];
  const groundHit = (ray, out) => {
    const o = ray.origin;
    const d = ray.direction;
    let t = 0.5;
    for (let i = 0; i < 240 && t < 120; i++) {
      const x = o.x + d.x * t - GARDEN_ORIGIN.x;
      const z = o.z + d.z * t - GARDEN_ORIGIN.z;
      const y = o.y + d.y * t - GARDEN_ORIGIN.y;
      // (the canopy as the ellipsoid inside its leaves' bounds)
      for (const c of canopies) {
        const ex = (x - c.x) / (c.rx * 0.85);
        const ey = (y - c.y) / (c.ry * 0.85);
        const ez = (z - c.z) / (c.rz * 0.85);
        if (ex * ex + ey * ey + ez * ez <= 1) {
          out.set(x + GARDEN_ORIGIN.x, y + GARDEN_ORIGIN.y, z + GARDEN_ORIGIN.z);
          return true;
        }
      }
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
    sky.uniforms.uCover.value = T.skyCloudCover;
    sky.uniforms.uSpeed.value = T.skyCloudSpeed;

    const now = performance.now();
    s.ndc.set(pointer.x, pointer.y);
    s.ray.setFromCamera(s.ndc, camera);

    // the pointer's wind: brushed into the field along its path over the
    // ground since the last frame, carrying its speed; lit only while it
    // moves (a still pointer leaves the meadow be)
    const hit = pointer.active && groundHit(s.ray.ray, s.hit);
    const moved = pointer.active && pointer.movedAt !== s.lastMoved;
    s.lastMoved = pointer.movedAt;
    if (hit && !s.hasHit) s.lastHit.copy(s.hit);
    const step = hit ? Math.hypot(s.hit.x - s.lastHit.x, s.hit.z - s.lastHit.z) : 0;
    // its speed over the ground, smoothed (and none at all when it jumps)
    if (hit && moved && step < 8) s.vel.lerp(s.want.set((s.hit.x - s.lastHit.x) / dt, (s.hit.z - s.lastHit.z) / dt), 1 - Math.exp(-dt / Math.max(T.gardenHoverSmooth, 0.005)));
    else s.vel.multiplyScalar(Math.exp(-dt / 0.08));
    const speed = Math.min(s.vel.length(), 30);
    s.moving += ((moved && hit ? Math.min(speed / 4, 1) : 0) - s.moving) * (1 - Math.exp(-dt / (moved ? 0.06 : 0.12)));
    const linger = Math.max(T.gardenHoverLinger, 0.05);
    const brushing = hit && step < 8 && speed > 0.05;
    if (brushing || s.moving > 0.01) s.activeUntil = now + linger * 4000;
    const fieldOn = now < s.activeUntil || s.ripples.length > 0;
    if (fieldOn) {
      sway.uWindField.value = wind.step(gl, {
        from: brushing ? s.lastHit : null,
        to: brushing ? s.hit : null,
        vel: s.vel,
        push: 0.8,
        radius: T.gardenHoverRadius * 0.6,
        glowRadius: T.gardenGlowRadius,
        glow: s.moving,
        relax: Math.exp(-dt / (linger * 0.6)),
        fade: Math.exp(-dt / (linger * 0.5)),
        wake: T.gardenHoverWake,
        hitY: s.hit.y,
      });
      sway.uFieldRect.value.copy(wind.rect);
    }
    sway.uFieldOn.value = fieldOn ? 1 : 0;
    if (hit) s.lastHit.copy(s.hit);
    s.hasHit = hit;

    // a click: a ring of air across the meadow
    if (pointer.clicks !== s.clicks) {
      s.clicks = pointer.clicks;
      if (hit) {
        s.ripples.push({ x: s.hit.x, z: s.hit.z, age: 0, strength: 0.45 * T.gardenHoverStrength });
        if (s.ripples.length > RIPPLES) s.ripples.shift();
      }
    }
    for (const r of s.ripples) r.age += dt;
    s.ripples = s.ripples.filter((r) => r.age < 3.2);
    s.ripples.forEach((r, i) => sway.uRipple.value[i].set(r.x, r.z, r.age, r.strength));
    sway.uRippleCount.value = s.ripples.length;
    sway.uPushAmount.value = T.gardenHoverStrength;
    sway.uWindAmount.value = T.gardenWind;
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
        <GardenPond J={J} tier={tier} time={time} axes={pondAxes} />
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
