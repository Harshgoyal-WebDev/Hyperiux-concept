"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mulberry32 } from "../world/layout";
import { PARTICLE_LIFE, makeDissolveConfig, threshold } from "../world/dissolve";
import { SUN_DIR } from "../config";
import { T } from "../tuning";
import { splitOffset } from "../world/monolithGeometry";

// One normalized dissolve value drives every grain. A grain sits exactly
// on its source surface and is released when the dissolve passes the same
// threshold the surface shader discards at, so solid and dust never
// separate. Against the white world it reads as a snap: dark ash flaking
// off and blowing away downwind until nothing is left.
const MOTION = /* glsl */ `
uniform float uDissolve;
uniform float uLife;
uniform float uFlatten;
uniform vec2 uWind;
uniform float uAshWind;
uniform float uSplitShift;
// Monolith grains follow their half if the parted gap is tuned away from
// the pose they were sampled at.
vec3 ncSplit(vec3 p, float kind) {
  return kind < 0.5 ? p + vec3(sign(p.x) * uSplitShift, 0.0, 0.0) : p;
}
vec3 ncGrainOffset(vec3 p, vec3 n, float seed, float kind, float l) {
  vec3 wind = vec3(uWind.x, 0.0, uWind.y);
  float e = pow(l, 1.6);
  vec3 o = n * l * (0.4 + seed * 1.4);
  o += wind * e * (22.0 + seed * 40.0) * uAshWind;
  o.y += l * (2.0 + seed * 7.0) + sin(l * 3.0 + seed * 6.28) * 1.4 * l;
  o += vec3(sin(l * 5.0 + seed * 40.0), cos(l * 3.0 + seed * 11.0) * 0.5, cos(l * 4.0 + seed * 23.0)) * l * 2.4;
  return o;
}
`;

const GRAIN_VERTEX = /* glsl */ `
attribute vec3 aNormal;
attribute vec4 aInfo; // threshold, seed, kind (0 monolith, 1 rock, 2 terrain), size
uniform float uScale;
uniform float uFade;
uniform float uAshSize;
uniform float uWhite;
uniform float uWhiteLevel;
varying float vA;
varying vec3 vColor;
${MOTION}
void main() {
  float raw = (uDissolve - aInfo.x) / uLife;
  if (raw <= 0.0 || uFade >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vA = 0.0;
    return;
  }
  float l = clamp(raw, 0.0, 1.0);
  vec3 p = ncSplit(position, aInfo.z);
  if (aInfo.z > 1.5) p.y *= (1.0 - uFlatten);
  p += ncGrainOffset(p, aNormal, aInfo.y, aInfo.z, l);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // dark ash, warming slightly to burnt earth as it thins out
  vColor = mix(vec3(0.03, 0.026, 0.024), vec3(0.16, 0.1, 0.07), smoothstep(0.2, 1.0, l));
  vA = (1.0 - smoothstep(0.3, 1.0, raw)) * (1.0 - uFade);
  gl_PointSize = aInfo.w * uAshSize * (1.0 - 0.6 * l) * uScale / max(-mv.z, 0.5);
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

const CHUNK_VERTEX = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aNrm;
attribute vec4 aInfo; // threshold, seed, size, kind
attribute vec3 aAxis;
uniform vec3 uSun;
uniform float uWhite;
uniform float uWhiteLevel;
varying vec3 vColor;
mat3 ncRot(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c, oc * axis.x * axis.y + axis.z * s, oc * axis.z * axis.x - axis.y * s,
    oc * axis.x * axis.y - axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.x + axis.y * s, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.z + c);
}
${MOTION}
void main() {
  float raw = (uDissolve - aInfo.x) / (uLife * 1.3);
  float l = clamp(raw, 0.0, 1.0);
  float size = aInfo.z * step(0.0001, raw) * (1.0 - smoothstep(0.05, 0.85, l));
  mat3 R = ncRot(aAxis, l * (5.0 + aInfo.y * 8.0));
  // thin flakes that tumble and grind down to grains
  vec3 p = ncSplit(aPos, aInfo.w) + ncGrainOffset(aPos, aNrm, aInfo.y, aInfo.w, l) * 0.8 + R * (position * vec3(1.0, 0.22, 1.0)) * size;
  vec3 n = normalize(R * (normal * vec3(1.0, 4.5, 1.0)));
  float lit = 0.3 + 0.7 * max(dot(n, uSun), 0.0);
  vColor = vec3(0.07, 0.06, 0.055) * lit;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const CHUNK_FRAGMENT = /* glsl */ `
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Samples `count` points weighted by area over a list of { geometry,
// matrix } surfaces.
function sampleSurfaces(surfaces, count, rng) {
  const out = [];
  const areas = surfaces.map((s) => s.area);
  const total = areas.reduce((a, b) => a + b, 0) || 1;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  surfaces.forEach((s, i) => {
    const k = Math.round((areas[i] / total) * count);
    nm.getNormalMatrix(s.matrix);
    for (let j = 0; j < k; j++) {
      s.sampler.sample(p, n);
      p.applyMatrix4(s.matrix);
      n.applyMatrix3(nm).normalize();
      out.push([p.x, p.y, p.z, n.x, n.y, n.z]);
    }
  });
  return out;
}

function geometryArea(g, scale = new THREE.Vector3(1, 1, 1)) {
  const pos = g.attributes.position;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let area = 0;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i).multiply(scale);
    b.fromBufferAttribute(pos, i + 1).multiply(scale);
    c.fromBufferAttribute(pos, i + 2).multiply(scale);
    area += b.sub(a).cross(c.sub(a)).length() * 0.5;
  }
  return area;
}

export default function DissolveParticles({ monolith, rockSet, J, tier, shared }) {
  const { gl } = useThree();
  const grainsRef = useRef();
  const chunksRef = useRef();

  const built = useMemo(() => {
    const rng = mulberry32(777);
    const center = monolith.bounds.getCenter(new THREE.Vector3());
    const extent = monolith.bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const cfg = {
      monolith: makeDissolveConfig("monolith", { center, extent }),
      rocks: makeDissolveConfig("rocks"),
    };

    // One surface per monolith piece, placed where that half sits (joined);
    // uSplitShift corrects for live tuning of the gap.
    const openWorld = monolith.split ? splitOffset(monolith.split, T.monolithGap) : 0;
    const monoSurface = monolith.parts.map((part) => ({
      sampler: new MeshSurfaceSampler(new THREE.Mesh(part.geometry)).setRandomGenerator(rng).build(),
      matrix: new THREE.Matrix4().makeTranslation(part.side * openWorld, 0, 0),
      area: geometryArea(part.geometry),
    }));

    const rockSurfaces = [];
    rockSet.forEach((g) => {
      const sampler = new MeshSurfaceSampler(new THREE.Mesh(g.geometry)).setRandomGenerator(rng).build();
      const baseArea = geometryArea(g.geometry);
      g.matrices.forEach((m) => {
        const s = new THREE.Vector3();
        m.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
        rockSurfaces.push({ sampler, matrix: m, area: baseArea * (s.x * s.y + s.y * s.z + s.x * s.z) / 3 });
      });
    });

    const total = tier.dissolveParticles;
    const monoPts = sampleSurfaces(monoSurface, Math.round(total * 0.64), rng);
    const rockPts = sampleSurfaces(rockSurfaces, Math.round(total * 0.36), rng);
    const all = [...monoPts.map((p) => [p, 0]), ...rockPts.map((p) => [p, 1])];
    const n = all.length;
    const position = new Float32Array(n * 3);
    const normal = new Float32Array(n * 3);
    const info = new Float32Array(n * 4);
    const tmp = new THREE.Vector3();
    const cfgFor = [cfg.monolith, cfg.rocks];
    const sizeFor = [0.2, 0.18];
    all.forEach(([p, kind], i) => {
      position.set([p[0], p[1], p[2]], i * 3);
      normal.set([p[3], p[4], p[5]], i * 3);
      tmp.set(p[0], p[1], p[2]);
      info.set([threshold(tmp, cfgFor[kind]), rng(), kind, sizeFor[kind] * (0.55 + rng() * 0.9)], i * 4);
    });
    const grainGeo = new THREE.BufferGeometry();
    grainGeo.setAttribute("position", new THREE.BufferAttribute(position, 3));
    grainGeo.setAttribute("aNormal", new THREE.BufferAttribute(normal, 3));
    grainGeo.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));

    const uniforms = {
      uDissolve: shared.uDissolve,
      uFlatten: shared.uFlatten,
      uWhite: shared.uWhite,
      uWhiteLevel: shared.uWhiteLevel,
      uWind: shared.uWind,
      uLife: { value: PARTICLE_LIFE },
      uFade: { value: 0 },
      uScale: { value: 500 },
      uSun: { value: SUN_DIR.clone() },
      uAshSize: { value: 1 },
      uAshWind: { value: 1 },
      uSplitShift: { value: 0 },
    };
    const grainMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: GRAIN_VERTEX,
      fragmentShader: GRAIN_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });

    // Larger fragments that break off the stone and grind down to grains.
    const chunkN = tier.dissolveChunks;
    const chunkSrc = [
      ...sampleSurfaces(monoSurface, Math.round(chunkN * 0.7), rng).map((p) => [p, 0]),
      ...sampleSurfaces(rockSurfaces, Math.round(chunkN * 0.3), rng).map((p) => [p, 1]),
    ];
    const cPos = new Float32Array(chunkSrc.length * 3);
    const cNrm = new Float32Array(chunkSrc.length * 3);
    const cInfo = new Float32Array(chunkSrc.length * 4);
    const cAxis = new Float32Array(chunkSrc.length * 3);
    chunkSrc.forEach(([p, kind], i) => {
      cPos.set([p[0], p[1], p[2]], i * 3);
      cNrm.set([p[3], p[4], p[5]], i * 3);
      tmp.set(p[0], p[1], p[2]);
      cInfo.set([threshold(tmp, cfgFor[kind]), rng(), 0.35 + Math.pow(rng(), 2) * 1.4, kind], i * 4);
      tmp.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      cAxis.set([tmp.x, tmp.y, tmp.z], i * 3);
    });
    const base = new THREE.TetrahedronGeometry(1, 0);
    const chunkGeo = new THREE.InstancedBufferGeometry();
    chunkGeo.setAttribute("position", base.attributes.position);
    chunkGeo.setAttribute("normal", base.attributes.normal);
    chunkGeo.setAttribute("aPos", new THREE.InstancedBufferAttribute(cPos, 3));
    chunkGeo.setAttribute("aNrm", new THREE.InstancedBufferAttribute(cNrm, 3));
    chunkGeo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(cInfo, 4));
    chunkGeo.setAttribute("aAxis", new THREE.InstancedBufferAttribute(cAxis, 3));
    chunkGeo.instanceCount = chunkSrc.length;
    const chunkMat = new THREE.ShaderMaterial({ uniforms, vertexShader: CHUNK_VERTEX, fragmentShader: CHUNK_FRAGMENT });

    return { grainGeo, grainMat, chunkGeo, chunkMat, uniforms, bakedOffset: openWorld };
  }, [monolith, rockSet, tier, shared]);

  useEffect(
    () => () => {
      built.grainGeo.dispose();
      built.grainMat.dispose();
      built.chunkGeo.dispose();
      built.chunkMat.dispose();
    },
    [built]
  );

  useFrame(() => {
    built.uniforms.uFade.value = J.particleFade;
    built.uniforms.uAshSize.value = T.ashSize;
    built.uniforms.uAshWind.value = T.ashWind;
    const sp = monolith.split;
    built.uniforms.uSplitShift.value = sp ? splitOffset(sp, T.monolithGap) - built.bakedOffset : 0;
    built.uniforms.uScale.value = gl.domElement.height * 0.5;
    const active = J.dissolve > 0.0001 && J.particleFade < 1;
    if (grainsRef.current) grainsRef.current.visible = active;
    if (chunksRef.current) chunksRef.current.visible = active;
  });

  return (
    <>
      <points ref={grainsRef} geometry={built.grainGeo} material={built.grainMat} frustumCulled={false} visible={false} />
      <mesh ref={chunksRef} geometry={built.chunkGeo} material={built.chunkMat} frustumCulled={false} visible={false} />
    </>
  );
}
