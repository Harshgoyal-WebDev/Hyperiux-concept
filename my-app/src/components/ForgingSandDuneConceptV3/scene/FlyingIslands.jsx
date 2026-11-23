"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { mulberry32 } from "../world/layout";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BUMP, NOISE } from "../world/glsl";
import { T } from "../tuning";

// Islands of rock adrift in the dusk sky over the dunes (the first scene's
// backdrop, after the reference): each a broad, roughly flat top with a few
// crags on it and a jagged underside tapering down to a point, bobbing and
// turning very slowly, and from some of them a thin fall of sand pouring off
// the edge into the haze. Far off, so they read mostly as silhouettes against
// the sky. Hero only (the ForgeLayer they are drawn in).

// [x, y, z, size (m across), seed, falls]
const ISLANDS = [
  [-330, 175, -560, 150, 3, 2],
  [-470, 110, -720, 46, 7, 1],
  [-180, 120, -900, 34, 11, 1],
  [380, 215, -640, 115, 5, 1],
  [560, 150, -980, 60, 13, 0],
];

// one island: a dense sphere pushed into shape (smooth, welded — no facets)
// — its top a ragged, gently rolling plateau with crags, its underside a
// thick slab of layered rock, stepped in strata, narrowing down into craggy
// points, its outline cut back in bays and spurs
function islandGeometry(seed) {
  const rng = mulberry32(seed);
  const n3 = createNoise3D(rng);
  const ico = new THREE.IcosahedronGeometry(1, 34);
  ico.deleteAttribute("normal");
  ico.deleteAttribute("uv");
  const g = mergeVertices(ico);
  ico.dispose();
  const P = g.attributes.position;
  const v = new THREE.Vector3();
  const stretch = 0.75 + rng() * 0.5;
  const fbm = (x, y, z, o) => {
    let a = 0.5;
    let f = 1;
    let r = 0;
    for (let k = 0; k < o; k++) {
      r += a * n3(x * f, y * f, z * f);
      a *= 0.5;
      f *= 2.03;
    }
    return r;
  };
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    // (its outline: bays and spurs)
    const edge = 1 + fbm(v.x * 1.3, 0, v.z * 1.3, 4) * 0.35;
    let x = v.x * edge * stretch;
    let z = v.z * edge;
    let y;
    if (v.y >= 0) {
      // the top: a rolling plateau, crags and boulders on it, falling away
      // at its rim
      const rim = Math.pow(1 - v.y, 3);
      y = 0.04 + Math.max(fbm(v.x * 2 + 9, 0, v.z * 2, 5), 0) * 0.32 * (1 - rim) + fbm(v.x * 6, 0, v.z * 6, 3) * 0.03 - rim * 0.06;
    } else {
      const d = -v.y;
      // the underside: a thick slab first, then narrowing in steps of strata
      // to craggy points
      const steps = 7;
      const sd = Math.floor(d * steps) / steps + Math.pow((d * steps) % 1, 3) / steps;
      const taper = 1 - Math.pow(sd, 1.5) * 0.82;
      const crag = fbm(v.x * 3.5, v.y * 2.5, v.z * 3.5, 5);
      x *= taper * (1 + crag * 0.18 * d);
      z *= taper * (1 + crag * 0.18 * d);
      y = -(0.12 + Math.pow(d, 1.35) * (0.85 + fbm(v.x * 1.5, 3, v.z * 1.5, 3) * 0.55)) + crag * 0.1 * d;
    }
    P.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

// their rock: layered sandstone (bands of warmer and darker stone, by height,
// wandering), fine relief bumped in from a 3D noise, the tops a little paler
// and dusted with sand; and a little of the sky's haze over all of it
function islandMaterial(haze) {
  const m = new THREE.MeshStandardMaterial({ color: "#5a4636", roughness: 0.95, metalness: 0 });
  m.fog = false;
  m.emissive = new THREE.Color("#5a5468");
  m.emissiveIntensity = haze;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vIsl;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvIsl = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vIsl;
        ${NOISE}
        ${BUMP.replace("return normalize(abs(det) * n - grad);", "vec3 r = abs(det) * n - grad; return dot(r, r) > 1e-24 ? normalize(r) : n;")}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float iBand = sin((vIsl.y + ncFbm(vIsl * 2.5) * 0.18) * 38.0) * 0.5 + 0.5;
        float iTone = ncFbm(vIsl * 6.0);
        diffuseColor.rgb *= mix(0.62, 1.12, iBand * 0.55 + iTone * 0.45);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.47, 0.33), smoothstep(0.02, 0.12, vIsl.y) * 0.55);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float iH = ncFbm(vIsl * 14.0) * 0.012 + sin((vIsl.y + ncFbm(vIsl * 2.5) * 0.18) * 38.0) * 0.004;
        // (guarded: far off, on a pixel-thin edge, the bump's normal can come
        // out of nothing — NaN, which the bloom spreads over the whole frame)
        {
          vec3 iN = ncBump(-vViewPosition, normal, iH, faceDirection);
          if (!any(isnan(iN)) && dot(iN, iN) > 0.5) normal = iN;
        }`
      );
  };
  m.customProgramCacheKey = () => "flying-island";
  return m;
}

// a fall of sand: a thin ribbon facing the camera, streaming down, fading out
const FALL_VERTEX = /* glsl */ `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const FALL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uGain;
varying vec2 vUv;
#include <fog_pars_fragment>
float h1(float x) { return fract(sin(x * 91.3) * 43758.5453); }
void main() {
  float across = abs(vUv.x - 0.5) * 2.0;
  // a few fine strands, streaming down
  float strands = 0.0;
  for (int i = 0; i < 4; i++) {
    float c = h1(float(i) + 1.7) - 0.5;
    float w = 0.06 + 0.06 * h1(float(i) + 4.1);
    float s = 1.0 - smoothstep(0.0, w, abs((vUv.x - 0.5) - c * 0.6));
    float flow = 0.6 + 0.4 * sin((vUv.y * 14.0 + uTime * (1.4 + h1(float(i) + 8.0))) + float(i) * 2.0);
    strands += s * flow;
  }
  float body = (1.0 - smoothstep(0.2, 1.0, across)) * 0.5 + strands * 0.6;
  // dense where it pours off the edge, thinning into mist as it falls
  // (uv.y: 1 at the top, where it pours off the edge, 0 at its foot)
  float fade = smoothstep(0.0, 0.85, vUv.y) * (1.0 - smoothstep(0.96, 1.0, vUv.y));
  float a = body * fade * uGain;
  gl_FragColor = vec4(uColor * a, a);
  #include <fog_fragment>
}
`;

const ROCK_DAY = new THREE.Color("#5a4636");
const ROCK_NIGHT = new THREE.Color("#2c3140");
const HAZE_DAY = new THREE.Color("#5a5468");
const HAZE_NIGHT = new THREE.Color("#0d1428");
const FALL_DAY = new THREE.Color("#e8a874");
const FALL_NIGHT = new THREE.Color("#9aa8c8");

export default function FlyingIslands({ shared }) {
  const group = useRef();
  const built = useMemo(() => {
    // (dark against the sky, as in the reference — the scene's haze would
    // wash them out to the sky's colour at this distance — lit along their
    // edges by the low sun, with a little haze of their own)
    const stone = islandMaterial(T.islandHaze);
    const fallMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uColor: { value: new THREE.Color("#e8a874") }, uGain: { value: 0.55 } }]),
      vertexShader: FALL_VERTEX,
      fragmentShader: FALL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    });
    const items = ISLANDS.map(([x, y, z, size, seed, falls]) => {
      const rng = mulberry32(seed * 7 + 1);
      const geometry = islandGeometry(seed);
      const mesh = new THREE.Mesh(geometry, stone);
      const s = size / 2;
      mesh.scale.set(s, s * (0.9 + rng() * 0.3), s * (0.8 + rng() * 0.3));
      mesh.rotation.y = rng() * Math.PI * 2;
      const node = new THREE.Group();
      node.position.set(x, y, z);
      node.add(mesh);
      // sand pouring off its edge, down into the haze below
      const fallMeshes = [];
      for (let i = 0; i < falls; i++) {
        const a = rng() * Math.PI * 2;
        const len = size * (1.4 + rng() * 1.2);
        const w = size * (0.05 + rng() * 0.05);
        const plane = new THREE.PlaneGeometry(w, len);
        plane.translate(0, -len / 2, 0);
        const fall = new THREE.Mesh(plane, fallMat);
        fall.position.set(Math.cos(a) * s * 0.75, s * 0.02, Math.sin(a) * s * 0.55);
        fall.renderOrder = 2;
        node.add(fall);
        fallMeshes.push(fall);
      }
      return { node, mesh, fallMeshes, base: y, phase: rng() * 10, spin: (rng() - 0.5) * 0.02 };
    });
    return { stone, fallMat, items };
  }, []);

  useEffect(
    () => () => {
      built.stone.dispose();
      built.fallMat.dispose();
      built.items.forEach((it) => {
        it.mesh.geometry.dispose();
        it.fallMeshes.forEach((f) => f.geometry.dispose());
      });
    },
    [built]
  );

  useFrame(({ camera, clock }) => {
    const on = T.flyingIslands > 0.001;
    if (group.current) group.current.visible = on;
    if (!on) return;
    const t = clock.elapsedTime;
    built.fallMat.uniforms.uTime.value = t;
    // (by night: the haze over them a deep blue, faint — silhouettes against
    // the stars, rimmed by the moon — and the falls a pale, dim moonlit grey)
    const night = shared?.uNight.value ?? 0;
    built.fallMat.uniforms.uGain.value = 0.9 * T.islandFalls * THREE.MathUtils.lerp(1, 0.3, night);
    built.fallMat.uniforms.uColor.value.copy(FALL_DAY).lerp(FALL_NIGHT, night);
    built.stone.emissive.copy(HAZE_DAY).lerp(HAZE_NIGHT, night);
    built.stone.emissiveIntensity = T.islandHaze * THREE.MathUtils.lerp(1, 0.35, night);
    // (their rock, by moonlight: a cool, dark grey rather than warm sandstone)
    built.stone.color.copy(ROCK_DAY).lerp(ROCK_NIGHT, night);
    for (const it of built.items) {
      // drifting: a slow bob and turn
      it.node.position.y = it.base + Math.sin(t * 0.18 + it.phase) * 3;
      it.mesh.rotation.y += it.spin * 0.016;
      it.node.scale.setScalar(T.flyingIslands);
      // (the falls face the camera, turning only about the vertical)
      for (const f of it.fallMeshes) {
        f.getWorldPosition(f.userData.p ?? (f.userData.p = new THREE.Vector3()));
        f.rotation.y = Math.atan2(camera.position.x - f.userData.p.x, camera.position.z - f.userData.p.z) - it.node.rotation.y;
      }
    }
  });

  return (
    <group ref={group}>
      {built.items.map((it, i) => (
        <primitive key={i} object={it.node} />
      ))}
    </group>
  );
}
