"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C, lerp } from "../timeline";
import { curvedWall } from "../world/geometry";
import { panelMetal } from "../world/materials";
import { CORE, REVEAL, RINGS, RING_CY } from "./layout";

// Alignment, assembly, convergence, the core and the reveal.
//   the arcs   bands of paneled metal (ring sectors), their inner edges
//              traced in orange light: scattered and turned (alignment
//              starts), then face-on but off the axis (`align`), then
//              assembled into concentric rings round the way, a tunnel
//              whose feet are in the ground (`assemble`)
//   the core   a cube of glass at the heart of the rings: its edges draw
//              in light (`core`), it fills with a warm glow (`coreGlow`),
//              then gives itself up to light and is gone (`coreFade`)
//   the reveal a great ring beyond, dark within, a thin pillar of light
//              rising at its foot under the name (`reveal`); at the end it
//              fills with light, and the page opens from it (`light`)

const deg = THREE.MathUtils.degToRad;

// a ring sector facing +z, centred on its depth
function ringGeometry({ R, thick, depth, sweep }) {
  const g = curvedWall({ cx: 0, cz: 0, R, thick, a0: 0, a1: deg(sweep), height: depth, bevel: 0.14, segments: 160 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, depth / 2);
  return g;
}
// its inner edge, front and back, as a tube of light
function edgeGeometry({ R, depth, sweep }, z) {
  const pts = [];
  for (let i = 0; i <= 200; i++) {
    const a = deg((sweep * i) / 200);
    pts.push(new THREE.Vector3(Math.cos(a) * (R - 0.02), Math.sin(a) * (R - 0.02), z * (depth / 2 + 0.02)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.07, 6, false);
}

const glowMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff5f00"), toneMapped: false });

export default function Rings({ tier }) {
  const rings = useRef([]);
  const core = useRef();
  const coreEdges = useRef();
  const coreLight = useRef();
  const reveal = useRef();
  const res = useMemo(() => {
    const metal = panelMetal("#3a3835", { key: "night-ring", roughness: 0.3 });
    const ringGlow = glowMat();
    const list = RINGS.map((r) => ({ geo: ringGeometry(r), front: edgeGeometry(r, 1), back: edgeGeometry(r, -1) }));
    // the core: glass, its twelve edges in light, a warm heart
    const e = CORE.edge;
    const glass = tier.post
      ? new THREE.MeshPhysicalMaterial({ color: "#fff4e8", roughness: 0.04, transmission: 1, thickness: 2.4, ior: 1.45, attenuationColor: new THREE.Color("#ff9a4a"), attenuationDistance: 9, clearcoat: 1, envMapIntensity: 1.8 })
      : new THREE.MeshStandardMaterial({ color: "#ffd7b0", transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false });
    const cubeGeo = new THREE.BoxGeometry(e, e, e);
    const edges = [];
    const h = e / 2;
    for (const [ax, a, b] of [
      ["x", 1, 1], ["x", 1, -1], ["x", -1, 1], ["x", -1, -1],
      ["y", 1, 1], ["y", 1, -1], ["y", -1, 1], ["y", -1, -1],
      ["z", 1, 1], ["z", 1, -1], ["z", -1, 1], ["z", -1, -1],
    ]) {
      const g = new THREE.BoxGeometry(ax === "x" ? e : 0.09, ax === "y" ? e : 0.09, ax === "z" ? e : 0.09);
      g.translate(ax === "x" ? 0 : a * h, ax === "y" ? 0 : ax === "x" ? a * h : b * h, ax === "z" ? 0 : b * h);
      edges.push(g);
    }
    const coreGlowMat = glowMat();
    const heart = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff7a20"), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const heartGeo = new THREE.BoxGeometry(e * 0.42, e * 0.42, e * 0.42);
    // the reveal: its ring, the dark (then bright) field within, the pillar of light
    const revealGeo = ringGeometry({ R: REVEAL.R, thick: REVEAL.thick, depth: REVEAL.depth, sweep: 360 });
    const revealFront = edgeGeometry({ R: REVEAL.R, depth: REVEAL.depth, sweep: 360 }, 1);
    const revealGlow = glowMat();
    const field = new THREE.MeshBasicMaterial({ color: new THREE.Color("#07080a"), toneMapped: false });
    const fieldGeo = new THREE.CircleGeometry(REVEAL.R - 0.2, 96);
    const pillar = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: { uK: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uK; varying vec2 vUv;
        void main() {
          float x = abs(vUv.x - 0.5) * 2.0;
          float core = exp(-x * x * 30.0);
          float fade = smoothstep(1.0, 0.25, vUv.y) * (1.0 + 2.0 * exp(-vUv.y * 10.0));
          gl_FragColor = vec4(mix(vec3(1.0, 0.4, 0.05), vec3(1.0, 0.85, 0.6), core) * (core * 7.0 + exp(-x * 4.0) * 0.5) * fade * uK, 1.0);
        }`,
    });
    const pillarGeo = new THREE.PlaneGeometry(2.2, 15);
    pillarGeo.translate(0, 7.5, 0);
    return { metal, ringGlow, list, glass, cubeGeo, edges, coreGlowMat, heart, heartGeo, revealGeo, revealFront, revealGlow, field, fieldGeo, pillar, pillarGeo };
  }, [tier.post]);

  useEffect(
    () => () => {
      res.list.forEach((l) => [l.geo, l.front, l.back].forEach((g) => g.dispose()));
      res.edges.forEach((g) => g.dispose());
      [res.cubeGeo, res.heartGeo, res.revealGeo, res.revealFront, res.fieldGeo, res.pillarGeo].forEach((g) => g.dispose());
      [res.metal, res.ringGlow, res.glass, res.coreGlowMat, res.heart, res.revealGlow, res.field, res.pillar].forEach((m) => m.dispose());
    },
    [res]
  );

  useFrame(() => {
    const t = C.t;
    const a = C.align;
    const s = C.assemble;
    // the arcs
    const ringsOn = t > 26;
    RINGS.forEach((r, i) => {
      const g = rings.current[i];
      if (!g) return;
      g.visible = ringsOn;
      if (!ringsOn) return;
      const sc = r.scattered;
      const al = r.aligned;
      // scattered → aligned → assembled (each ring a little after the last)
      const ka = THREE.MathUtils.smoothstep(a, i * 0.06, 0.7 + i * 0.06);
      const ks = THREE.MathUtils.smoothstep(s, i * 0.07, 0.65 + i * 0.07);
      const x = lerp(lerp(sc.x, al.x, ka), 0, ks);
      const y = lerp(lerp(sc.y, al.y, ka), 0, ks) + RING_CY;
      const z = lerp(lerp(sc.z, al.z, ka), r.z, ks);
      g.position.set(x, y, z);
      g.rotation.set(lerp(lerp(sc.rx, al.rx, ka), 0, ks), lerp(lerp(sc.ry, al.ry, ka), 0, ks), lerp(lerp(sc.rz, al.rz, ka), r.gapAt, ks) + t * 0.004 * (i % 2 ? 1 : -1) * (1 - ks));
    });
    res.ringGlow.color.set("#ff5f00").multiplyScalar(1.2 + 3.2 * Math.max(a * 0.5, s) + C.coreGlow * 1.5);

    // the core
    const k = C.core;
    const fade = C.coreFade;
    const cube = core.current;
    cube.visible = t > 52 && fade < 0.999;
    if (cube.visible) {
      const sc = Math.max(0.001, THREE.MathUtils.smoothstep(k, 0, 0.7) * (1 - fade * 0.9));
      cube.scale.setScalar(sc);
      cube.rotation.set(0.0, t * 0.01 + (1 - k) * 0.8, 0);
      coreEdges.current.scale.setScalar(1);
      res.coreGlowMat.color.set("#ff5f00").multiplyScalar(2 + 5 * C.coreGlow + 9 * fade);
      res.heart.color.set("#ff7a20").multiplyScalar(0.15 + C.coreGlow * 1.6 + fade * 3);
      coreLight.current.intensity = (60 + 340 * C.coreGlow) * k * (1 - fade);
    } else coreLight.current.intensity = 0;

    // the reveal
    const rv = C.reveal;
    reveal.current.visible = t > 66;
    res.revealGlow.color.set("#ff5f00").multiplyScalar(0.6 + rv * 4 + C.light * 4);
    res.pillar.uniforms.uK.value = rv * (1 - C.light * 0.6);
    // the field within: dark, then filling with warm white light
    res.field.color.set("#07080a").lerp(new THREE.Color(3.2, 3.05, 2.9), C.light);
  });

  return (
    <group>
      {RINGS.map((r, i) => (
        <group key={i} ref={(el) => (rings.current[i] = el)} visible={false}>
          <mesh geometry={res.list[i].geo} material={res.metal} castShadow={tier.shadows} receiveShadow={tier.shadows} />
          <mesh geometry={res.list[i].front} material={res.ringGlow} />
          <mesh geometry={res.list[i].back} material={res.ringGlow} />
        </group>
      ))}

      <group ref={core} position={[CORE.x, CORE.y, CORE.z]} visible={false}>
        <mesh geometry={res.cubeGeo} material={res.glass} renderOrder={2} />
        <group ref={coreEdges}>
          {res.edges.map((g, i) => (
            <mesh key={i} geometry={g} material={res.coreGlowMat} />
          ))}
        </group>
        <mesh geometry={res.heartGeo} material={res.heart} />
      </group>
      <pointLight ref={coreLight} position={[CORE.x, CORE.y, CORE.z]} color="#ff7a24" distance={60} decay={2} intensity={0} />

      <group ref={reveal} position={[0, REVEAL.cy, REVEAL.z]} visible={false}>
        <mesh geometry={res.revealGeo} material={res.metal} castShadow={tier.shadows} receiveShadow={tier.shadows} />
        <mesh geometry={res.revealFront} material={res.revealGlow} />
        <mesh geometry={res.fieldGeo} material={res.field} position={[0, 0, -REVEAL.depth / 2 - 0.4]} />
        <mesh geometry={res.pillarGeo} material={res.pillar} position={[0, -REVEAL.cy, 0.5]} />
      </group>
    </group>
  );
}
