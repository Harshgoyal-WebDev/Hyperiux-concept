"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { C, lerp } from "../timeline";
import { DISCIPLINES } from "../content";
import { PANEL, PANELS } from "../world/layout";
import { BEIGE, ORANGE, etchedPanel, limestone } from "../world/materials";

// Chapter 04, our approach: four slabs of glass, one for each discipline
// (Strategy, Experience Design, Technology, Growth), each with its sign
// etched into its face. Each rises straight up out of a slot in the floor,
// already where it belongs, already turned to the visitor; nothing shifts
// or turns. As the last one stands, a line of orange light runs along each
// one's foot, where the orange path joins them.
//
// Real glass on desktop (physically transmissive, with thickness, a little
// warm absorption and a clear-coated face); on phones, a lighter
// translucent stand-in.
const ICONS = ["strategy", "design", "technology", "growth"];

export default function Panels({ tier }) {
  const groups = useRef([]);
  const slabs = useRef([]);
  const res = useMemo(() => {
    const slab = new RoundedBoxGeometry(PANEL.w, PANEL.h, PANEL.d, 4, 0.07);
    slab.translate(0, PANEL.h / 2, 0);
    const glass = tier.post
      ? new THREE.MeshPhysicalMaterial({
          color: "#fffaf3",
          metalness: 0,
          roughness: 0.05,
          transmission: 1,
          thickness: 0.6,
          ior: 1.5,
          attenuationColor: new THREE.Color("#efe0c8"),
          attenuationDistance: 2.4,
          specularIntensity: 1,
          clearcoat: 0.4,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1.3,
        })
      : new THREE.MeshStandardMaterial({ color: "#fbf4ea", transparent: true, opacity: 0.4, roughness: 0.08, metalness: 0, envMapIntensity: 1.4, depthWrite: false });
    // the etched sign, just proud of the front face
    const face = new THREE.PlaneGeometry(PANEL.w * 0.9, PANEL.h * 0.9);
    face.translate(0, PANEL.h / 2, PANEL.d / 2 + 0.004);
    const signs = DISCIPLINES.map(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: "#ffffff" }));
    // the line of light along its foot
    const foot = new THREE.BoxGeometry(PANEL.w - 0.12, 0.035, PANEL.d + 0.02);
    foot.translate(0, 0.03, 0);
    const footMat = new THREE.MeshBasicMaterial({ color: ORANGE.clone(), toneMapped: false });
    // the slot each rises from: a thin stone sill
    const sill = new THREE.BoxGeometry(PANEL.w + 0.5, 0.14, 0.7);
    const sillMat = limestone(BEIGE, { key: "sill" });
    return { slab, glass, face, signs, foot, footMat, sill, sillMat, textures: [] };
  }, [tier.post]);

  // the etched signs, once the brand face has loaded
  useEffect(() => {
    let alive = true;
    const root = document.querySelector("[data-pj-root]");
    const family = (root && getComputedStyle(root).fontFamily) || "Arial, sans-serif";
    const draw = () => {
      if (!alive) return;
      DISCIPLINES.forEach((d, i) => {
        const tex = etchedPanel({ icon: ICONS[i], name: d.short, n: d.n }, family);
        res.textures.push(tex);
        res.signs[i].map = tex;
        res.signs[i].needsUpdate = true;
      });
    };
    (document.fonts?.load(`400 44px ${family}`) ?? Promise.resolve()).then(draw, draw);
    return () => {
      alive = false;
    };
  }, [res]);

  useEffect(
    () => () => {
      res.slab.dispose();
      res.glass.dispose();
      res.face.dispose();
      res.signs.forEach((m) => m.dispose());
      res.foot.dispose();
      res.footMat.dispose();
      res.sill.dispose();
      res.sillMat.dispose();
      res.textures.forEach((t) => t.dispose());
    },
    [res]
  );

  useFrame(() => {
    const on = C.t > 38 && C.t < 68;
    res.footMat.color.copy(ORANGE).multiplyScalar(0.2 + C.panelLight * 5);
    PANELS.forEach((p, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.visible = on;
      if (!on) return;
      const rise = C.panel[i];
      // straight up, in place
      slabs.current[i].position.y = lerp(-PANEL.h - 0.3, 0, rise);
      slabs.current[i].visible = rise > 0.001;
      res.signs[i].opacity = res.signs[i].map ? Math.max(0, rise * 1.3 - 0.3) * 0.9 : 0;
    });
  });

  return (
    <group>
      {PANELS.map((p, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} position={p} rotation-y={PANEL.yaw}>
          <group ref={(el) => (slabs.current[i] = el)}>
            <mesh geometry={res.slab} material={res.glass} castShadow={false} renderOrder={2} />
            <mesh geometry={res.face} material={res.signs[i]} renderOrder={3} />
            <mesh geometry={res.foot} material={res.footMat} />
          </group>
          <mesh geometry={res.sill} material={res.sillMat} position={[0, 0.07, 0]} receiveShadow={tier.shadows} castShadow={tier.shadows} />
        </group>
      ))}
    </group>
  );
}
