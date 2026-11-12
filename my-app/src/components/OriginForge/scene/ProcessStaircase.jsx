"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { C, STAGE_U, ss } from "../timeline";
import { STEPS } from "../content";
import { useAssets } from "../world/assets";
import { T, setColor } from "../tuning";
import { COPPER, MOLTEN, ORANGE, energyFlowMaterial } from "../world/shaders";
import { mulberry32, makeInscription } from "../world/textures";
import { SEGMENTS, STAIR, STAIR_LENGTH, pitchY, stairFrame, stairPoint, treadY } from "../world/stair";
import { RAIL_END_U, buildNosings, buildRibbon, buildSteps, railingCurve } from "../world/stairGeometry";
import { PLINTH_AHEAD, PLINTH_SIDE } from "./cameraPath";
import Summit from "./Summit";

// The ascent. Out of the light at the end of the corridor, a monumental
// staircase of cast bronze sweeps upward in an S: five flights of real
// steps, solid metal between a low cheek with a polished brass railing and
// a tall curved wall of darker, patinated bronze. Its steps rise into place as you arrive. On each of the
// four landings stands a plinth carrying one step of the process, IDEA ·
// BUILD · DEPLOY · SCALE, inlaid in copper; each ignites as you reach it, and
// the inlay along the step edges warms up the flight behind you.

const ICONS = ["idea", "build", "deploy", "scale"];
const dummy = new THREE.Object3D();

// The stair-mass material: clean cast metal, the baked contact shade (aOcc),
// and the blocks rising into place by `uReveal`.
function revealMaterial(base, uniforms) {
  const m = base.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = uniforms.uReveal;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aStep;\nattribute float aOcc;\nvarying float vOcc;\nuniform float uReveal;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vOcc = aOcc;
        float appear = smoothstep(aStep * 0.86, aStep * 0.86 + 0.14, uReveal);
        transformed.y -= (1.0 - appear) * 7.0;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vOcc;")
      .replace("#include <aomap_fragment>", "#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= vOcc;\nreflectedLight.directDiffuse *= mix(1.0, vOcc, 0.55);");
  };
  m.customProgramCacheKey = () => "of-stair-reveal-v3";
  return m;
}

export default function ProcessStaircase({ tier }) {
  const { mat, keep } = useAssets();
  const gl = useThree((s) => s.gl);
  const group = useRef();
  const plinths = useRef([]);
  const balusters = useRef();
  const newel = useRef();
  const monoliths = useRef();
  const shadowFrames = useRef(0);
  const wasVisible = useRef(false);

  const res = useMemo(() => {
    const uniforms = { uReveal: { value: 0 } };
    const stairMat = keep(revealMaterial(mat.bronze, uniforms));
    const wallMat = keep(revealMaterial(mat.bronzeWall, uniforms));
    const nosing = new THREE.ShaderMaterial({
      fog: true,
      toneMapped: false,
      // inlaid flush in the tread: drawn over it, never fighting it
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uLit: { value: 0 }, uBase: { value: new THREE.Color("#a8823f") }, uHot: { value: new THREE.Color("#f2c46a").multiplyScalar(1.25) }, uHead: { value: MOLTEN.clone().multiplyScalar(2.2) }, uGlow: { value: 1 } },
      ]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        attribute float aStep;
        uniform float uReveal;
        varying float vStep;
        void main() {
          vStep = aStep;
          vec3 transformed = position;
          float appear = smoothstep(aStep * 0.86, aStep * 0.86 + 0.14, uReveal);
          transformed.y -= (1.0 - appear) * 7.0;
          vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform float uLit;
        uniform vec3 uBase, uHot, uHead;
        uniform float uGlow;
        varying float vStep;
        void main() {
          float lit = 1.0 - smoothstep(uLit - 0.004, uLit + 0.004, vStep);
          float head = smoothstep(uLit - 0.03, uLit, vStep) * lit;
          vec3 col = mix(uBase, uHot * uGlow, lit) + uHead * head * uGlow;
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }`,
    });
    nosing.uniforms.uReveal = uniforms.uReveal;
    keep(nosing);

    const steps = keep(buildSteps());
    const nosings = keep(buildNosings());
    const W = STAIR.width / 2;
    const cheek = keep(buildRibbon({ side: W + 0.16, thick: 0.32, top: () => 0.38, bottom: () => -2, u1: RAIL_END_U }));
    const wall = keep(
      buildRibbon({
        side: -(W + 0.25),
        thick: 0.5,
        top: (u) => 0.38 + 5.8 * ss(Math.min(1, Math.max(0, u / 0.06))) * ss(Math.min(1, Math.max(0, (1.02 - u) / 0.05))),
        bottom: () => -2,
      })
    );
    const rail = railingCurve();
    const railGeo = keep(new THREE.TubeGeometry(rail, 900, 0.045, 10, false));
    const railLightGeo = keep(new THREE.TubeGeometry(railingCurve(W - 0.25, 1.035), 900, 0.016, 6, false));
    const railLight = keep(energyFlowMaterial({ color: ORANGE, density: 14, speed: 0.4, onLight: true }));
    const plinthGeo = keep(new THREE.BoxGeometry(1.8, 1.1, 0.7));
    const plinthBaseGeo = keep(new THREE.BoxGeometry(2.0, 0.12, 0.9));
    const panelGeo = keep(new THREE.PlaneGeometry(1.7, 0.85));
    const inscriptions = STEPS.map(() =>
      keep(
        new THREE.MeshStandardMaterial({
          color: COPPER.clone(),
          metalness: 0.65,
          roughness: 0.32,
          transparent: true,
          opacity: 0,
          emissive: ORANGE,
          emissiveIntensity: 0,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        })
      )
    );

    // balusters: two to a tread pair on the flights, evenly on the landings,
    // each from the stone up to the rail
    const baluster = [];
    const addBaluster = (u) => {
      const p = stairPoint(u, W - 0.25, 0);
      const foot = treadY(u);
      baluster.push({ p: p.setY(foot), h: pitchY(u) + 0.98 - foot });
    };
    for (const g of SEGMENTS) {
      if (g.kind === "flight") for (let j = 0; j < g.n; j += 1) addBaluster(g.u0 + (j + 0.5) * g.du);
      else for (let d = 0.35; d < (g.u1 - g.u0) * STAIR_LENGTH; d += 0.42) addBaluster(g.u0 + d / STAIR_LENGTH);
    }
    for (let d = 0.35; d < 2.2; d += 0.42) addBaluster(1 + d / STAIR_LENGTH);
    const newelPos = stairPoint(RAIL_END_U, W - 0.25, 0).setY(STAIR.rise);
    // ivory monoliths standing in the hall's haze, for scale
    const rand = mulberry32(77);
    const monos = [];
    const centre = stairPoint(0.5, 0, 0);
    for (let k = 0; k < 34; k++) {
      const a = rand() * Math.PI * 2;
      const r = 34 + rand() * 60;
      const x = centre.x + Math.cos(a) * r;
      const z = centre.z + Math.sin(a) * r;
      if (z > -70) continue;
      const h = 22 + rand() * 60;
      monos.push({ p: [x, h / 2 - 1, z], r: [0, rand() * Math.PI, 0], s: [2 + rand() * 5, h, 1 + rand() * 2.5] });
    }

    // each plinth stands on its landing by the railing, turned a little toward
    // the climber coming up the flight
    const plinthPose = STAGE_U.map((u) => {
      const uu = u + PLINTH_AHEAD / STAIR_LENGTH;
      const f = stairFrame(uu);
      const p = stairPoint(uu, PLINTH_SIDE, 0).setY(treadY(u) + 0.12 + 0.55);
      return { p, yaw: Math.atan2(-f.tan.x, -f.tan.z) - 0.42 };
    });
    return { uniforms, stairMat, wallMat, nosing, steps, nosings, cheek, wall, railGeo, railLightGeo, railLight, plinthGeo, plinthBaseGeo, panelGeo, inscriptions, baluster, newelPos, monos, plinthPose };
  }, [mat.bronze, mat.bronzeWall, keep]);

  // the inscriptions, drawn once the brand face has loaded
  useEffect(() => {
    let alive = true;
    const root = document.querySelector("[data-of-root]");
    const family = (root && getComputedStyle(root).fontFamily) || "Arial, sans-serif";
    const draw = () => {
      if (!alive) return;
      res.inscriptions.forEach((m, i) => {
        const tex = keep(makeInscription({ n: STEPS[i].n, name: STEPS[i].name, icon: ICONS[i] }, family));
        m.alphaMap = tex;
        m.emissiveMap = tex;
        m.needsUpdate = true;
      });
    };
    (document.fonts?.load(`400 230px ${family}`) ?? Promise.resolve()).then(draw, draw);
    return () => {
      alive = false;
    };
  }, [res, keep]);

  useEffect(() => {
    res.baluster.forEach(({ p, h }, i) => {
      dummy.position.set(p.x, p.y + h / 2, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      balusters.current.setMatrixAt(i, dummy.matrix);
    });
    balusters.current.instanceMatrix.needsUpdate = true;
    balusters.current.computeBoundingSphere();
    res.monos.forEach((d, i) => {
      dummy.position.set(...d.p);
      dummy.rotation.set(...d.r);
      dummy.scale.set(...d.s);
      dummy.updateMatrix();
      monoliths.current.setMatrixAt(i, dummy.matrix);
    });
    monoliths.current.instanceMatrix.needsUpdate = true;
    monoliths.current.computeBoundingSphere();
  }, [res]);

  useFrame((state) => {
    const t = C.t;
    const visible = t > 75.5;
    group.current.visible = visible;
    // the shadows are static: render the shadow map when the hall appears
    if (visible && !wasVisible.current) shadowFrames.current = 3;
    wasVisible.current = visible;
    if (shadowFrames.current > 0) {
      gl.shadowMap.needsUpdate = true;
      shadowFrames.current--;
    }
    if (!visible) return;

    // the metals, live from the tuning panel
    setColor(mat.bronze.color, T.bronze);
    setColor(mat.bronzeWall.color, T.bronzeWall);
    setColor(mat.brass.color, T.brass);
    setColor(res.stairMat.color, T.bronze);
    setColor(res.wallMat.color, T.bronzeWall);
    for (const m of [mat.bronze, mat.bronzeWall, res.stairMat, res.wallMat]) {
      m.metalness = T.stairMetalness;
      m.roughness = T.stairRoughness;
      m.envMapIntensity = T.stairEnv;
    }
    mat.brass.metalness = T.stairMetalness;
    mat.brass.roughness = T.brassRoughness;
    mat.brass.envMapIntensity = T.stairEnv;
    res.nosing.uniforms.uGlow.value = T.nosingGlow;

    const reveal = C.stairReveal;
    res.uniforms.uReveal.value = reveal;
    // the lit front climbs with the process, then all the way to the top
    let lit = 0;
    STAGE_U.forEach((u, i) => (lit = Math.max(lit, C.stage[i] * (u + 0.012))));
    lit = Math.max(lit, C.rail * 1.02);
    res.nosing.uniforms.uLit.value = lit;

    res.railLight.uniforms.uTime.value = state.clock.elapsedTime;
    res.railLight.uniforms.uReveal.value = Math.min(1, lit * 0.86 + C.rail * 0.2);
    res.railLight.uniforms.uAlpha.value = 0.9;
    if (newel.current) newel.current.position.y = res.newelPos.y + 0.55 - (1 - ss(Math.min(1, Math.max(0, (reveal - 0.86) / 0.14)))) * 7;

    res.plinthPose.forEach((pose, i) => {
      const g = plinths.current[i];
      if (!g) return;
      const appear = ss(Math.min(1, Math.max(0, (reveal - STAGE_U[i] * 0.86) / 0.14)));
      g.position.set(pose.p.x, pose.p.y - (1 - appear) * 7, pose.p.z);
      const m = res.inscriptions[i];
      m.opacity = m.alphaMap ? appear : 0;
      m.emissiveIntensity = C.stage[i] * 2.4 + 0.05;
    });
  });

  return (
    <group ref={group} visible={false}>
      {/* the hall */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -221]} material={mat.ivoryFloor} receiveShadow>
        <planeGeometry args={[320, 300]} />
      </mesh>
      <instancedMesh ref={monoliths} args={[null, mat.ivory, res.monos.length]}>
        <boxGeometry />
      </instancedMesh>

      {/* the flight */}
      <mesh geometry={res.steps} material={res.stairMat} castShadow={tier.shadows} receiveShadow={tier.shadows} />
      <mesh geometry={res.cheek} material={res.wallMat} castShadow={tier.shadows} receiveShadow={tier.shadows} />
      <mesh geometry={res.wall} material={res.wallMat} castShadow={tier.shadows} receiveShadow={tier.shadows} />
      <mesh geometry={res.nosings} material={res.nosing} />

      {/* copper railing, balusters, and the light that runs along it */}
      <mesh geometry={res.railGeo} material={mat.brass} castShadow={tier.shadows} />
      <mesh geometry={res.railLightGeo} material={res.railLight} />
      <instancedMesh ref={balusters} args={[null, mat.brass, res.baluster.length]} castShadow={tier.shadows}>
        <cylinderGeometry args={[0.016, 0.016, 1.0, 6]} />
      </instancedMesh>
      <mesh ref={newel} position={[res.newelPos.x, res.newelPos.y + 0.55, res.newelPos.z]} material={mat.brass} castShadow={tier.shadows}>
        <cylinderGeometry args={[0.07, 0.09, 1.1, 12]} />
      </mesh>

      {/* the four plinths of the process */}
      {res.plinthPose.map((pose, i) => (
        <group key={i} ref={(el) => (plinths.current[i] = el)} rotation-y={pose.yaw}>
          <mesh geometry={res.plinthBaseGeo} material={mat.brass} position={[0, -0.61, 0]} castShadow={tier.shadows} receiveShadow={tier.shadows} />
          <mesh geometry={res.plinthGeo} material={mat.bronzeWall} castShadow={tier.shadows} receiveShadow={tier.shadows} />
          <mesh geometry={res.panelGeo} material={res.inscriptions[i]} position={[0, 0, 0.352]} />
        </group>
      ))}

      <Summit />
    </group>
  );
}

