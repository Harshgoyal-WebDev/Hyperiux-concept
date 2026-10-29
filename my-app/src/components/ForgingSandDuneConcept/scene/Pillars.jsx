"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mulberry32 } from "../world/layout";
import { buildRockCrackMap, createPillarMaterial } from "../world/materials";
import { DISSOLVE } from "../world/glsl";
import { P, zoneAt } from "../config";
import { flightDistance } from "../world/duneCamera";
import { pillarMatrix, pinPosition, riseOf } from "../world/pillars";
import { shardGeometry } from "./Rocks";
import { T } from "../tuning";

// The rocks that grow up out of the sand past the mark (world/pillars.js):
// tall faceted basalt in the slab's own stone, its cracks glowing as the
// slab's do, one instanced mesh per shape. While a rock rises the sand puffs
// up round its foot. The key pillars each carry a pin — a glowing dot (an HTML button, kept over the rock here
// every frame) on a thin stem of light; the one in close-up lights up. When
// the dissolve comes the rock is eaten away and its grains blow off downwind
// (released exactly where its surface goes: see DISSOLVE).
const VARIANTS = 5;
const GRAIN_LIFE = 0.22; // share of the dissolve a grain drifts before it is gone

const GRAIN_VERTEX = /* glsl */ `
attribute vec3 aNormal;
attribute vec4 aInfo; // base y, height, seed, size
attribute float aRand;
uniform float uDissolve;
uniform float uLife;
uniform float uScale;
uniform float uSize;
uniform float uWind2;
uniform vec2 uWind;
varying float vA;
varying vec3 vColor;
${DISSOLVE}
void main() {
  float raw = (uDissolve - ncDisT(position, aInfo.xyz)) / uLife;
  if (raw <= 0.0 || raw >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vA = 0.0;
    return;
  }
  float l = raw;
  vec3 wind = vec3(uWind.x, 0.0, uWind.y);
  vec3 o = aNormal * l * (0.5 + aRand * 1.6);
  o += wind * pow(l, 1.6) * (26.0 + aRand * 44.0) * uWind2;
  o.y += l * (2.0 + aRand * 8.0) + sin(l * 3.0 + aRand * 6.28) * 1.4 * l;
  o += vec3(sin(l * 5.0 + aRand * 40.0), cos(l * 3.0 + aRand * 11.0) * 0.5, cos(l * 4.0 + aRand * 23.0)) * l * 2.6;
  vec4 mv = modelViewMatrix * vec4(position + o, 1.0);
  gl_Position = projectionMatrix * mv;
  // an ember as it comes away, then dark sand, warming to burnt earth as
  // it thins out
  vec3 ash = mix(vec3(0.03, 0.026, 0.024), vec3(0.16, 0.1, 0.07), smoothstep(0.25, 1.0, l));
  vColor = mix(vec3(2.6, 0.9, 0.2), ash, smoothstep(0.0, 0.1, l));
  float px = aInfo.w * uSize * (1.0 - 0.6 * l) * uScale / max(-mv.z, 0.5);
  // never thinner than ~1.6 px (far rocks still visibly turn to sand); a
  // grain widened that way is faded to match
  gl_PointSize = max(px, 1.6);
  vA = (1.0 - smoothstep(0.35, 1.0, l)) * mix(0.3, 1.0, min(px / 1.6, 1.0));
}
`;
const GRAIN_FRAGMENT = /* glsl */ `
varying float vA;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.32, 0.5, d);
  if (m * vA < 0.01) discard;
  gl_FragColor = vec4(vColor, m * vA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// sand puffing up round a rock's foot while it rises
const dustVertex = (n) => /* glsl */ `
attribute vec4 aDust; // angle, ring, seed, rock
uniform float uRise[${n}];
uniform vec4 uFoot[${n}]; // x, sand y, z, width
uniform float uTime;
uniform float uScale;
varying float vA;
void main() {
  int i = int(aDust.w + 0.5);
  float r = uRise[i];
  float act = clamp(r * (1.0 - r) * 4.0, 0.0, 1.0);
  vec4 f = uFoot[i];
  if (act < 0.01) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vA = 0.0;
    return;
  }
  float a = aDust.x + uTime * (0.15 + aDust.z * 0.3);
  float ring = f.w * (0.55 + aDust.y * (0.9 + act));
  vec3 p = vec3(f.x + cos(a) * ring, f.y + aDust.z * act * 6.0 + aDust.y * act * 2.0, f.z + sin(a) * ring);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = act * (1.0 - aDust.z * 0.6);
  gl_PointSize = (0.18 + aDust.z * 0.3) * uScale / max(-mv.z, 0.5);
}
`;
const DUST_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.15, 0.5, d);
  if (m * vA < 0.01) discard;
  gl_FragColor = vec4(uColor, m * vA * 0.55);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// the pins' light: a glow at each dot and a stem down to the rock's top
const PIN_VERTEX = /* glsl */ `
attribute float aA;
uniform float uScale;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = aA;
  gl_PointSize = clamp(1.3 * uScale / max(-mv.z, 0.5), 2.0, 50.0);
}
`;
const PIN_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uPoint;
varying float vA;
void main() {
  float m = 1.0;
  if (uPoint > 0.5) {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    m = exp(-d * d * 5.0);
  }
  if (m * vA < 0.003) discard;
  gl_FragColor = vec4(uColor * 2.2 * m * vA, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function buildGrains(pillars, geometries, count) {
  const rng = mulberry32(77);
  const areas = pillars.map((p) => p.height * (p.width + p.depth));
  const total = areas.reduce((a, b) => a + b, 0);
  const pos = [];
  const nrm = [];
  const info = [];
  const rand = [];
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  pillars.forEach((p, i) => {
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometries[i % VARIANTS])).setRandomGenerator(rng).build();
    pillarMatrix(p, 1, m);
    nm.getNormalMatrix(m);
    const k = Math.round((areas[i] / total) * count);
    const seed = (i * 0.618) % 1;
    for (let j = 0; j < k; j++) {
      sampler.sample(v, n);
      v.applyMatrix4(m);
      n.applyMatrix3(nm).normalize();
      pos.push(v.x, v.y, v.z);
      nrm.push(n.x, n.y, n.z);
      info.push(p.base, p.height, seed, 0.22 + rng() * 0.4);
      rand.push(rng());
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aNormal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("aInfo", new THREE.Float32BufferAttribute(info, 4));
  g.setAttribute("aRand", new THREE.Float32BufferAttribute(rand, 1));
  return g;
}

function buildDust(pillars, perRock) {
  const rng = mulberry32(91);
  const data = [];
  pillars.forEach((_, i) => {
    for (let j = 0; j < perRock; j++) data.push(rng() * Math.PI * 2, rng(), rng(), i);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(data.length * 0.75), 3));
  g.setAttribute("aDust", new THREE.Float32BufferAttribute(data, 4));
  return g;
}

export default function Pillars({ J, tier, shared, forge, pillars, pins, focus }) {
  const { gl, camera, size } = useThree();
  const keys = useMemo(() => pillars.filter((p) => p.content >= 0), [pillars]);

  const built = useMemo(() => {
    const geometries = Array.from({ length: VARIANTS }, (_, i) => shardGeometry(701 + i * 29, { taper: 0.22, noise: 0.13 }));
    const crackMap = buildRockCrackMap(forge);
    const { material, uniforms: rock } = createPillarMaterial(shared, crackMap);
    const groups = geometries.map((geometry, gi) => {
      const members = pillars.filter((p) => p.index % VARIANTS === gi);
      const info = new Float32Array(members.length * 4);
      members.forEach((p, k) => info.set([p.base, p.height, (p.index * 0.618) % 1, p.content >= 0 ? 1 : 0], k * 4));
      geometry.setAttribute("aPillar", new THREE.InstancedBufferAttribute(info, 4));
      return { geometry, members };
    });

    const grains = new THREE.Points(
      buildGrains(pillars, geometries, tier.pillarGrains),
      new THREE.ShaderMaterial({
        uniforms: {
          uDissolve: shared.uDissolve,
          uWind: shared.uWind,
          uLife: { value: GRAIN_LIFE },
          uScale: { value: 500 },
          uSize: { value: 1 },
          uWind2: { value: 1 },
        },
        vertexShader: GRAIN_VERTEX,
        fragmentShader: GRAIN_FRAGMENT,
        transparent: true,
        depthWrite: false,
      })
    );

    const n = pillars.length;
    const dust = new THREE.Points(
      buildDust(pillars, tier.name === "low" ? 90 : 220),
      new THREE.ShaderMaterial({
        uniforms: {
          uRise: { value: new Float32Array(n) },
          uFoot: { value: pillars.map((p) => new THREE.Vector4(p.x, p.base + 1.6, p.z, p.width)) },
          uTime: shared.uTime,
          uScale: { value: 500 },
          uColor: { value: new THREE.Color("#d79a68") },
        },
        vertexShader: dustVertex(n),
        fragmentShader: DUST_FRAGMENT,
        transparent: true,
        depthWrite: false,
      })
    );

    const pinColor = { value: new THREE.Color("#ff5f00") };
    const pinGlowGeometry = new THREE.BufferGeometry();
    pinGlowGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(keys.length * 3), 3));
    pinGlowGeometry.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(keys.length), 1));
    const pinStemGeometry = new THREE.BufferGeometry();
    pinStemGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(keys.length * 6), 3));
    pinStemGeometry.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(keys.length * 2), 1));
    const pinMaterial = (point) =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: pinColor, uScale: { value: 500 }, uPoint: { value: point ? 1 : 0 } },
        vertexShader: PIN_VERTEX,
        fragmentShader: PIN_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    const pinGlow = new THREE.Points(pinGlowGeometry, pinMaterial(true));
    const pinStem = new THREE.LineSegments(pinStemGeometry, pinMaterial(false));
    for (const o of [grains, dust, pinGlow, pinStem]) o.frustumCulled = false;

    return { geometries, material, rock, crackMap, groups, grains, dust, pinGlow, pinStem, pinColor };
  }, [pillars, keys, shared, tier, forge]);

  useEffect(
    () => () => {
      built.geometries.forEach((g) => g.dispose());
      built.material.dispose();
      built.crackMap.texture.dispose();
      for (const o of [built.grains, built.dust, built.pinGlow, built.pinStem]) {
        o.geometry.dispose();
        o.material.dispose();
      }
    },
    [built]
  );

  const meshes = useRef([]);
  const rise = useMemo(() => new Float32Array(pillars.length), [pillars]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), v: new THREE.Vector3(), top: new THREE.Vector3() }), []);
  const lastP = useRef(-1);

  // the pillars' instance matrices at a rise
  const place = (p) => {
    const camD = flightDistance(p);
    pillars.forEach((pl, i) => (rise[i] = p > 0 ? riseOf(pl, p, camD) : 0));
    built.groups.forEach((g, gi) => {
      const mesh = meshes.current[gi];
      if (!mesh) return;
      g.members.forEach((pl, k) => mesh.setMatrixAt(k, pillarMatrix(pl, rise[pl.index], tmp.m)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = g.members.some((pl) => rise[pl.index] > 0.001);
    });
    built.dust.material.uniforms.uRise.value.set(rise);
  };
  // (re)placed on the next frame after a rebuild
  useLayoutEffect(() => {
    lastP.current = -1;
  }, [built]);

  useFrame(() => {
    if (J.progress !== lastP.current) {
      lastP.current = J.progress;
      place(J.progress);
    }
    const scale = gl.domElement.height * 0.5;
    built.grains.material.uniforms.uScale.value = scale;
    built.grains.material.uniforms.uSize.value = T.ashSize;
    built.grains.material.uniforms.uWind2.value = T.ashWind;
    built.grains.visible = J.dissolve > 0;
    built.dust.material.uniforms.uScale.value = scale;
    built.dust.visible = rise.some((r) => r > 0.01 && r < 0.99);
    built.pinColor.value.set(T.crackColor);
    built.pinGlow.material.uniforms.uScale.value = scale;
    shared.uPillarGlow.value = T.pillarGlow;
    // the slab's crack texture at the slab's scale (T.rockCrackSize: metres
    // the patch covers, top to bottom), lit as brightly as its cracks
    built.rock.uRockUv.value.set(1 / (T.rockCrackSize * built.crackMap.aspect), 1 / T.rockCrackSize);
    built.rock.uRockFissure.value = T.fissureGlow;

    // the pillar in close-up lights up
    const f = focus.index >= 0 ? keys[focus.index] : null;
    if (f) shared.uFocus.value.set(f.x, f.base + f.height * 0.5, f.z, focus.k);
    else shared.uFocus.value.w = 0;

    // the pins: shown over a key pillar once it stands, ahead of the camera,
    // until the whiteout; all gone in close-up
    const camD = flightDistance(J.progress);
    const glowPos = built.pinGlow.geometry.attributes.position;
    const glowA = built.pinGlow.geometry.attributes.aA;
    const stemPos = built.pinStem.geometry.attributes.position;
    const stemA = built.pinStem.geometry.attributes.aA;
    const common = (1 - THREE.MathUtils.smoothstep(J.progress, P.pillars, zoneAt("whiteout", 0.12))) * (1 - THREE.MathUtils.smoothstep(focus.k, 0, 0.2));
    // the light breathes with the pin's ring (2.6 s)
    const breath = 0.7 + 0.3 * Math.sin((shared.uTime.value * Math.PI * 2) / 2.6);
    keys.forEach((pl, i) => {
      const r = rise[pl.index];
      const ahead = pl.d - camD;
      const show = common * THREE.MathUtils.smoothstep(r, 0.93, 1) * (1 - THREE.MathUtils.smoothstep(ahead, 175, 215)) * THREE.MathUtils.smoothstep(ahead, -25, 10);
      pinPosition(pl, r, tmp.v);
      tmp.top.set(pl.x, tmp.v.y - 5, pl.z);
      glowPos.setXYZ(i, tmp.v.x, tmp.v.y, tmp.v.z);
      glowA.setX(i, show * breath * 0.6);
      stemPos.setXYZ(i * 2, tmp.top.x, tmp.top.y, tmp.top.z);
      stemPos.setXYZ(i * 2 + 1, tmp.v.x, tmp.v.y, tmp.v.z);
      stemA.setX(i * 2, 0);
      stemA.setX(i * 2 + 1, show * 0.8);

      const el = pins.current[i];
      if (!el) return;
      tmp.v.project(camera);
      const onScreen = tmp.v.z < 1 && Math.abs(tmp.v.x) < 1.05 && Math.abs(tmp.v.y) < 1.05;
      const o = onScreen ? show : 0;
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o > 0.01 ? "visible" : "hidden";
      el.style.pointerEvents = o > 0.5 ? "auto" : "none";
      el.style.transform = `translate3d(${((tmp.v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-tmp.v.y * 0.5 + 0.5) * size.height).toFixed(1)}px, 0)`;
    });
    for (const a of [glowPos, glowA, stemPos, stemA]) a.needsUpdate = true;
  });

  return (
    <>
      {built.groups.map((g, gi) =>
        g.members.length ? (
          <instancedMesh
            key={gi}
            ref={(el) => (meshes.current[gi] = el)}
            args={[g.geometry, built.material, g.members.length]}
            castShadow
            receiveShadow
            frustumCulled={false}
          />
        ) : null
      )}
      <primitive object={built.dust} renderOrder={4} />
      <primitive object={built.grains} renderOrder={6} />
      <primitive object={built.pinStem} renderOrder={7} />
      <primitive object={built.pinGlow} renderOrder={7} />
    </>
  );
}
