"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createSandstoneMaterial, createSandstoneUniforms } from "../../world/sandstone";
import { T } from "../../tuning";
import * as THREE from "three";
import { desertOn, heroOn, reducedMotion, valleyOn } from "./heroState";

// the hero's warm bounce: a dusty rose sky, sunlit sand
const HERO_SKY = new THREE.Color("#b88f86");
const HERO_GROUND = new THREE.Color("#a5582a");
// ...and by night: the moonlight's colour (rim and fill), a navy sky's
// bounce over dark sand (the night art's palette: #829BC7, #101D35, #24170F)
const MOON_RIM = new THREE.Color("#8fa9d6");
const NIGHT_FILL = new THREE.Color("#829bc7");
const NIGHT_SKY = new THREE.Color("#101d35").multiplyScalar(2.2);
const NIGHT_GROUND = new THREE.Color("#24170f").multiplyScalar(0.8);
import Ruins from "./Ruins";
import Fragments from "./Fragments";
import OrbitRing from "./OrbitRing";
import FieldDust from "./FieldDust";
import SandDrift from "./SandDrift";
import Embers from "./Embers";
import { MW_HERO, MW_VALLEY, dirAt } from "../Sky";
import { SUN_DIR } from "../../config";

const MOON_UP = new THREE.Vector3();
const MOON_VALLEY = dirAt(62, 3.2);

// the embers: rising round the slab's foot (its 50 × 13 m footprint), most
// close in, some further out over the dunes in front
function slabSpots(rng) {
  if (rng() < 0.7) {
    const side = rng() < 0.5 ? -1 : 1;
    return [side * (24 + rng() * 14) * (rng() < 0.35 ? rng() : 1), 7 + rng() * 22 * (rng() < 0.5 ? -1 : 1)];
  }
  return [-90 + rng() * 180, 10 + rng() * 90];
}
import Toggle from "./Toggle";

// The hero's dressing, after the art direction's enhanced frame: ancient
// sandstone ruins on the dunes round the slab, stone fragments floating
// about it and a thin ring of light circling it, dust suspended over the
// whole desert. It lives in the forge's world (the logo shot sees it, the
// valley beyond the cut never does: Scene.jsx ForgeLayer); the ring and the
// fragments are blown away as the beam merges into the core (heroState.js).
export default function HeroDressing({ J, tier, shared, terrain, heightField, forge }) {
  // one set of sandstone uniforms for the ruins and the fragments
  const stone = useMemo(() => {
    const uniforms = createSandstoneUniforms(shared);
    return {
      uniforms,
      ruins: createSandstoneMaterial(uniforms),
      fragments: createSandstoneMaterial(uniforms, { instanced: true }),
    };
  }, [shared]);
  useEffect(
    () => () => {
      stone.ruins.dispose();
      stone.fragments.dispose();
    },
    [stone]
  );

  const core = forge?.world.core;
  const tint = useMemo(() => new THREE.Color(), []);
  // the light's factors, eased over time as well as led by the scroll: the
  // change from one scene's light to the next never pops, however fast the
  // scroll
  const eased = useRef(null);
  useFrame((_, delta) => {
    const u = stone.uniforms;
    for (const m of [stone.ruins, stone.fragments]) {
      if (m.userData.hex !== T.sandstoneColor) {
        m.color.set(T.sandstoneColor);
        m.userData.hex = T.sandstoneColor;
      }
    }
    u.uRuinGlow.value = T.ruinGlow;
    // (warm rim by day, cool moonlit rim by night: shared.uRimColor)
    u.uRim.value = T.duneRim * (1 - shared.uNight.value) + T.moonRim * shared.uNight.value;
    if (core) u.uCore.value.copy(core);
    // (the core's light on the fragments: while they are there, breathing
    // with the cube)
    u.uCoreLight.value = core && T.showFragments ? heroOn(J.progress) * T.heroEmber * (1 + Math.sin(shared.uTime.value * 1.6) * T.cubePulse) : 0;

    // ...and on the sand (world/materials.js createSharedUniforms)
    const night = shared.uNight.value;
    // (the valley's sunset scenes share the desert's light on the sand:
    // scene/valley)
    const e = (eased.current ??= { desert: desertOn(J.progress), valley: valleyOn(J.progress) });
    const a = reducedMotion() ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 2.5);
    e.desert += (desertOn(J.progress) - e.desert) * a;
    e.valley += (valleyOn(J.progress) - e.valley) * a;
    const desert = e.desert;
    const valley = e.valley;
    J.valleyK = valley;
    const land = Math.max(desert, valley);
    // (by night: a cool blue rim along the crests, a moonlit mist low down)
    shared.uRim.value = (T.duneRim * (1 - night) + T.moonRim * night) * land;
    shared.uRimColor.value.setRGB(1, 0.5, 0.2).lerp(MOON_RIM, night);
    shared.uVeins.value = T.duneVeins * heroOn(J.progress) * (1 + night * 0.5);
    shared.uHaze.value.set(T.groundHaze * (1 - night * 0.25) * land, 1 - night);
    shared.uContactK.value = T.contactShadow * desert;
    shared.uSurfDust.value = T.surfaceDust * land * (1 - night * 0.7);
    // the slab's core's warm light on the sand round it: faint by day, the
    // brightest thing on the dunes by night; gone as the core goes out
    if (core) shared.uCoreGlow.value.set(core.x, Math.max(core.y * 0.35, 4), core.z + 6, T.coreSandLight * (0.12 + 0.88 * night) * Math.min(J.sphere / 0.3, 1) * desert);
    // (the slab's own: gone with the rock that breaks away)
    shared.uContactSlab.value = 1 - Math.min(J.fracture * 3, 1) * 0.7;
    // ...and the sky's sunset (scene/Sky.jsx)
    // (the valley's sunset scenes under the same sky as the hero's)
    shared.uHeroSky.value = T.heroSky * land;
    // the night sky's Milky Way, placed for whichever world the camera is in
    shared.uMwN.value.copy(MW_HERO.pole).lerp(MW_VALLEY.pole, valley).normalize();
    shared.uMwC.value.copy(MW_HERO.centre).lerp(MW_VALLEY.centre, valley).normalize();
    // the night's moon: set on the hero's far ridge (where its sun is drawn);
    // in the valley low at the right horizon, half behind the mountains, so
    // it never sits over the orb (the night art)
    shared.uMoonDir.value.copy(SUN_DIR).add(MOON_UP.set(0, 0.03 * desert, 0)).normalize().lerp(MOON_VALLEY, valley).normalize();
    shared.uSunGlow.value = T.sunGlow;
    // ...and its warm light on the sand and the ruins (not the slab); by
    // night cool moonlight from the front instead, and a navy sky's bounce
    tint.set(T.heroFillColor).multiplyScalar(T.heroFill * (1 - night));
    tint.r += NIGHT_FILL.r * T.moonFill * night;
    tint.g += NIGHT_FILL.g * T.moonFill * night;
    tint.b += NIGHT_FILL.b * T.moonFill * night;
    shared.uFill.value.copy(tint).multiplyScalar(land);
    shared.uHemiSky.value.copy(HERO_SKY).multiplyScalar(T.heroHemi * (1 - night)).lerp(NIGHT_SKY, night).multiplyScalar(land);
    shared.uHemiGround.value.copy(HERO_GROUND).multiplyScalar(T.heroHemi * (1 - night)).lerp(NIGHT_GROUND, night).multiplyScalar(land);
  });

  return (
    <>
      <Toggle J={J} flag="showRuins">
        <Ruins J={J} shared={shared} terrain={terrain} material={stone.ruins} rockMaterial={stone.fragments} />
      </Toggle>
      {core && (
        <Toggle J={J} flag="showFragments">
          <Fragments J={J} core={core} material={stone.fragments} />
        </Toggle>
      )}
      {core && <OrbitRing J={J} shared={shared} core={core} />}
      <FieldDust J={J} tier={tier} shared={shared} heightField={heightField} core={core} />
      <SandDrift J={J} tier={tier} shared={shared} heightField={heightField} />
      <Embers J={J} tier={tier} shared={shared} heightField={heightField} spots={slabSpots} gate={desertOn} />
    </>
  );
}
