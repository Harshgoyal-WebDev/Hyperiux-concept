"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createSandstoneMaterial, createSandstoneUniforms } from "../../world/sandstone";
import { S_END, TREE, floorHalfWidth, route } from "../../world/oasis";
import { S_LAND, cubeY } from "../../world/oasisCamera";
import { T } from "../../tuning";
import { reducedMotion, valleyOn } from "../hero/heroState";
import { CUT_TO } from "../../config";
import FieldDust from "../hero/FieldDust";
import SandDrift from "../hero/SandDrift";
import Embers from "../hero/Embers";
import Arches from "./Arches";
import TrailLight from "./TrailLight";
import OrbEnergy from "./OrbEnergy";

// The valley's sunset scenes, past the cut (in the valley's world only:
// Scene.jsx ValleyLayer):
//   Scene 02, the canyon – semi-circular stone structures across the way
//     ahead (Arches.jsx), the energy trail's sparks and its light on the
//     sand (TrailLight.jsx), dust drifting low over its floor and hanging
//     in the air, the boulders' glowing fissures (world/rockFinish.js)
//   Scene 03, the open desert – the energy orb (OrbEnergy.jsx), its light on
//     the sand and on the dust round it; no structures
// The light on the sand itself (the crests' rim, the dust blowing over it,
// the warm bounce) is shared with the hero's (HeroDressing: valleyOn).
// All of it eases out before the oasis comes to life (heroState valleyOn).

// the dust clouds: over the canyon's floor along the way the camera runs
function valleySpots(rng) {
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const s = S_LAND - 60 + rng() * 260;
  route.getPointAt(Math.min(s / S_END, 1), p);
  route.getTangentAt(Math.min(s / S_END, 1), t);
  const lat = (rng() * 2 - 1) * floorHalfWidth(s) * 0.95;
  return [p.x - t.z * lat, p.z + t.x * lat, rng() < 0.4];
}
// ...and round the orb, on the open ground under it
function orbSpots(rng) {
  const a = rng() * Math.PI * 2;
  const r = 8 + Math.pow(rng(), 0.7) * 70;
  return [TREE.x + Math.cos(a) * r, TREE.z + Math.sin(a) * r];
}
const VALLEY_BOX = { min: new THREE.Vector3(-170, -2, -1130), size: new THREE.Vector3(400, 45, 380) };

export default function ValleyDressing({ J, tier, shared, terrain, heightField }) {
  const stone = useMemo(() => {
    const uniforms = createSandstoneUniforms(shared);
    // (their own uForm: the arches building themselves)
    uniforms.uForm = { value: 0 };
    uniforms.uFormDrop = { value: 9 };
    // (the same warm light as the sand round them, a touch softer: they
    // stand in the same sunset — the canyon's light, its haze)
    uniforms.uFill = { value: new THREE.Color() };
    uniforms.uHemiSky = { value: new THREE.Color() };
    uniforms.uHemiGround = { value: new THREE.Color() };
    return { uniforms, material: createSandstoneMaterial(uniforms, { form: true }) };
  }, [shared]);
  useEffect(() => () => stone.material.dispose(), [stone]);
  // (the valley's light, eased in and out over time: HeroDressing J.valleyK)
  const gate = useCallback(() => J.valleyK ?? valleyOn(J.progress), [J]);
  // the arches building themselves as the valley comes in: led by the
  // scroll, eased over time so it never jumps (0 → 1)
  const form = useRef(0);
  const orbCore = useMemo(() => new THREE.Vector3(TREE.x, cubeY(), TREE.z), []);

  useFrame((_, delta) => {
    // (its energy glows by night as by day; only the sunlit rim turns to moonlight)
    const k = gate();
    const night = shared.uNight.value;
    const target = THREE.MathUtils.clamp((J.progress - CUT_TO()) / 0.032, 0, 1);
    if (reducedMotion()) form.current = target;
    else form.current += (target - form.current) * (1 - Math.exp(-Math.min(delta, 0.1) * 2.2));
    if (Math.abs(target - form.current) < 1e-4) form.current = target;
    stone.uniforms.uForm.value = form.current;
    const m = stone.material;
    if (m.userData.hex !== T.archColor) {
      m.color.set(T.archColor);
      m.userData.hex = T.archColor;
    }
    // (lit as the backlit canyon is: the low sun behind them, their faces
    // towards us in soft warm shade, a rim of light round their edges)
    stone.uniforms.uRim.value = (T.duneRim * (1 - night) + T.moonRim * night) * k;
    stone.uniforms.uFill.value.copy(shared.uFill.value).multiplyScalar(0.42);
    stone.uniforms.uHemiSky.value.copy(shared.uHemiSky.value).multiplyScalar(0.9);
    stone.uniforms.uHemiGround.value.copy(shared.uHemiGround.value).multiplyScalar(0.7);
    stone.uniforms.uRuinGlow.value = T.archGlow * k * THREE.MathUtils.smoothstep(form.current, 0.85, 1);
    // (the boulders' fissures coming in with the valley's light)
    shared.uRockGlow.value = T.rockGlow * k;
    orbCore.y = cubeY();
  });

  return (
    <>
      <Arches J={J} terrain={terrain} material={stone.material} gate={gate} form={form} />
      <TrailLight J={J} tier={tier} shared={shared} gate={gate} />
      <OrbEnergy J={J} tier={tier} shared={shared} />
      <FieldDust J={J} tier={tier} shared={shared} heightField={heightField} core={orbCore} box={VALLEY_BOX} gate={gate} seed={1451} />
      <SandDrift J={J} tier={tier} shared={shared} heightField={heightField} spots={valleySpots} gate={gate} seed={1459} />
      <Embers J={J} tier={tier} shared={shared} heightField={heightField} spots={valleySpots} gate={gate} seed={1609} />
      <Embers J={J} tier={tier} shared={shared} heightField={heightField} spots={orbSpots} gate={gate} seed={1613} />
    </>
  );
}
