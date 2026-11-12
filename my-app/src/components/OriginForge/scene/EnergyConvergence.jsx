"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C, lerp } from "../timeline";
import { AMBER, MOLTEN, energyFlowMaterial } from "../world/shaders";
import { MARK_CENTER } from "../world/logo";
import { SPOTS } from "./pillars/PillarBase";

// The four forces begin to answer each other: thin streams of energy arc
// from pillar to pillar, then wind into orbital paths around the centre,
// tightening as the pillars are drawn in, until the energy is concentrated
// where the mark will be forged.

const LINKS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
];

export default function EnergyConvergence() {
  const linkMats = useRef([]);
  const orbitGroup = useRef();
  const orbitMats = useRef([]);

  const { linkGeos, orbitGeo, mats } = useMemo(() => {
    const linkGeos = LINKS.map(([a, b], k) => {
      const A = SPOTS[a].clone().setY(7.5 + (k % 3) * 0.9);
      const B = SPOTS[b].clone().setY(8.2 - (k % 2) * 1.1);
      const mid = A.clone().lerp(B, 0.5);
      mid.y += 3 + (k % 3);
      mid.z += 2.5;
      const curve = new THREE.CatmullRomCurve3([A, A.clone().lerp(mid, 0.6).setY(mid.y - 0.6), mid, B.clone().lerp(mid, 0.6).setY(mid.y - 0.6), B]);
      return new THREE.TubeGeometry(curve, 96, 0.035, 5, false);
    });
    const ring = new THREE.EllipseCurve(0, 0, 1, 1, 0, Math.PI * 2);
    const pts = ring.getPoints(256).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const orbitGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 256, 0.006, 4, true);
    const mats = {
      links: LINKS.map((_, k) => energyFlowMaterial({ color: k % 2 ? AMBER : MOLTEN, density: 4, speed: 0.5 + k * 0.08 })),
      orbits: [0, 1, 2].map((k) => energyFlowMaterial({ color: k === 1 ? AMBER : MOLTEN, density: 6, speed: 0.25 + k * 0.1 })),
    };
    return { linkGeos, orbitGeo, mats };
  }, []);

  useEffect(
    () => () => {
      linkGeos.forEach((g) => g.dispose());
      orbitGeo.dispose();
      [...mats.links, ...mats.orbits].forEach((m) => m.dispose());
    },
    [linkGeos, orbitGeo, mats]
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const links = C.links;
    mats.links.forEach((m, k) => {
      m.uniforms.uTime.value = time;
      m.uniforms.uReveal.value = Math.min(1, links * 1.4 - k * 0.06);
      m.uniforms.uAlpha.value = links;
    });
    linkMats.current.forEach((mesh) => (mesh.visible = links > 0.001));

    const orbit = C.orbit;
    orbitGroup.current.visible = orbit > 0.001;
    orbitGroup.current.position.copy(MARK_CENTER);
    const r = lerp(13, 7.2, C.gather);
    orbitMats.current.forEach((mesh, k) => {
      mesh.scale.setScalar(r * (1 - k * 0.08));
      mesh.rotation.set(0.35 + (k - 1) * 0.38, time * (0.12 + k * 0.05) * (k % 2 ? -1 : 1), (k - 1) * 0.42);
      const m = mats.orbits[k];
      m.uniforms.uTime.value = time;
      m.uniforms.uReveal.value = Math.min(1, orbit * 1.3);
      m.uniforms.uAlpha.value = orbit * (1 + C.gather);
    });
  });

  return (
    <group>
      {linkGeos.map((g, k) => (
        <mesh key={k} ref={(el) => (linkMats.current[k] = el)} geometry={g} material={mats.links[k]} frustumCulled={false} />
      ))}
      <group ref={orbitGroup}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} ref={(el) => (orbitMats.current[k] = el)} geometry={orbitGeo} material={mats.orbits[k]} frustumCulled={false} />
        ))}
      </group>
    </group>
  );
}
