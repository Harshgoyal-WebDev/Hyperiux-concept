"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { NOISE, FRACTURE } from "../world/glsl";
import { buildFractureData } from "../world/fracture";
import { cubeScale } from "../world/monolithGeometry";
import { T } from "../tuning";

const ORANGE = new THREE.Color("#FF5F00"); // linear after Color management

// Glowing glass: amber body that is see-through face-on and dense at
// grazing angles, hot opaque edges that bloom, faint facet lines on the
// future fracture planes, and cracks that spread before it breaks. Drawn
// twice (back faces, then front faces) so the far side shows through.
const GLASS_FRAGMENT = /* glsl */ `
uniform float uGlow;
uniform vec3 uHot;
uniform float uCrack;
uniform float uHeat;
uniform float uSize;
uniform float uFracture;
uniform float uBack;
uniform float uGlassOpacity;
uniform float uEdgeGlow;
uniform float uFadeNear;
uniform float uFadeFar;
uniform vec3 uColor;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vView;
${NOISE}
// 2D Voronoi border distance on a face — cracks only exist on the front
// faces while the cube is cracking, so this stays cheap.
float ncVoronoiEdge2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(ncHash(vec3(i + g, 3.1)), ncHash(vec3(i + g, 8.7)));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(d2) - sqrt(d1);
}
float fn3(vec3 f) { return f.x * 1.0 + f.y * 2.0 + f.z * 3.0; }
void main() {
  vec3 q = vLocal / (uSize * 0.5);
  vec3 a = abs(q);
  float mx = max(a.x, max(a.y, a.z));
  float mn = min(a.x, min(a.y, a.z));
  float md = a.x + a.y + a.z - mx - mn;
  vec3 isFace = step(vec3(mx - 1e-3), a);

  float outer = smoothstep(0.9, 0.98, mx);
  float edge = smoothstep(0.88, 0.975, md) * outer;
  float edgeCore = smoothstep(0.955, 0.995, md) * outer;
  vec3 dl = abs(a - 1.0 / 3.0) + isFace * 10.0;
  float facet = (1.0 - smoothstep(0.0, 0.02, min(dl.x, min(dl.y, dl.z)))) * outer;

  float facing = clamp(abs(dot(normalize(vN), normalize(vView))), 0.0, 1.0);
  float fres = pow(1.0 - facing, 2.2);
  float g = min(1.0 + log(max(uGlow, 0.05)), 1.6);

  float crack = 0.0;
  if (uCrack > 0.001 && uBack < 0.5) {
    vec2 fuv = isFace.x > 0.5 ? q.yz : (isFace.y > 0.5 ? q.xz : q.xy);
    float ve = ncVoronoiEdge2(fuv * 2.4 + fn3(isFace) * 5.0);
    float reveal = step(ncNoise(q * 2.0 + 7.0), uCrack * 1.15);
    crack = (1.0 - smoothstep(0.0, 0.02 + 0.04 * uCrack, ve)) * reveal * outer;
  }

  // glass body
  vec3 col = uColor * (0.35 + 1.0 * fres) * g;
  float alpha = mix(0.12, 0.7, fres);
  float sheen = pow(max(0.0, sin((q.x + q.y * 0.6 - q.z * 0.4) * 3.2 + 1.3)), 8.0);
  col += uHot * sheen * 0.35 * g;
  alpha += sheen * 0.12;
  if (uBack > 0.5) {
    // the far walls are a dense molten backdrop: the sky behind the cube
    // never washes out its glowing interior
    col = mix(uColor * 0.3, uColor * 0.9, fres) * g;
    alpha = 0.94;
  }

  // edges: hot, opaque, bloom
  alpha *= uGlassOpacity;
  vec3 edgeCol = (mix(uColor * 3.0, uHot * 4.2, edgeCore) * (0.8 + 0.4 * g) + uHot * uHeat * edgeCore) * uEdgeGlow;
  col = mix(col, edgeCol, edge);
  alpha = max(alpha, edge);

  col += uColor * facet * (0.4 + uCrack * 2.2) * g;
  alpha = max(alpha, facet * (0.35 + uCrack * 0.5));
  col += uHot * crack * (2.2 + uHeat * 1.6);
  alpha = max(alpha, crack);

  // broken inner faces only exist once the cube has opened
  float inner = (1.0 - outer) * smoothstep(0.0, 0.08, uFracture);
  col = mix(col, uColor * (1.3 + uHeat * 0.6), inner);
  alpha = mix(alpha, 0.8, inner);
  alpha *= mix(1.0, 0.0, (1.0 - outer) * (1.0 - smoothstep(0.0, 0.08, uFracture)));

  // torn pieces flying past the lens dissolve instead of filling the frame
  // (that blew out to a full white flash as we flew through)
  float near = smoothstep(uFadeNear, uFadeFar, length(vView));
  alpha *= near;
  col *= near;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// As it cracks and breaks the cube is pulled out towards the screen
// edges: in view space, every vertex is pushed away from the cube's centre
// by an amount that grows with its distance from it, so the far parts
// stretch most.
const DISTORT = /* glsl */ `
uniform float uDistort;
uniform float uSize;
vec4 ncDistort(vec4 mv) {
  vec4 cv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 rv = mv.xy - cv.xy;
  float rn = length(rv) / uSize;
  mv.xy = cv.xy + rv * (1.0 + uDistort * min(rn * rn, 2.5));
  return mv;
}
`;

const SOLID_VERTEX = /* glsl */ `
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vView;
${DISTORT}
void main() {
  vLocal = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = ncDistort(modelViewMatrix * vec4(position, 1.0));
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT_VERTEX = /* glsl */ `
attribute vec3 aOrigin;
attribute vec3 aDir;
attribute vec3 aAxis;
attribute float aSeed;
uniform float uFracture;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vView;
${FRACTURE}
${DISTORT}
void main() {
  float fr = uFracture;
  mat3 R = ncRotation(aAxis, fr * (1.2 + aSeed * 2.6) * 3.14159);
  float sc = 1.0 - smoothstep(0.45, 1.0, fr);
  vec3 v = R * (position * sc);
  // pieces elongate along their flight as they're torn outwards
  v += aDir * dot(v, aDir) * uDistort * 2.0;
  vec3 lp = v + ncFragOffset(aOrigin, aDir, aSeed, fr);
  vLocal = aOrigin + position;
  vN = normalize(normalMatrix * (R * normal));
  vec4 mv = ncDistort(modelViewMatrix * vec4(lp, 1.0));
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

// Molten interior: nested inner cubes filled with a slowly churning fire
// texture and glowing seams, seen through the glass (additive).
const SHELL_VERTEX = /* glsl */ `
varying vec3 vP;
varying vec3 vN;
varying vec3 vView;
void main() {
  vP = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;
const SHELL_FRAGMENT = /* glsl */ `
uniform float uGlow;
uniform float uHeat;
uniform float uTime;
uniform float uFracture;
uniform float uCoreGlow;
uniform float uShell; // 0 outer shell, 1 inner shell
uniform float uHalf;  // half edge of this shell
uniform vec3 uColor;
uniform vec3 uHot;
varying vec3 vP;
varying vec3 vN;
varying vec3 vView;
${NOISE}
void main() {
  vec3 q = vP / uHalf;
  vec3 a = abs(q);
  float mx = max(a.x, max(a.y, a.z));
  float mn = min(a.x, min(a.y, a.z));
  float md = a.x + a.y + a.z - mx - mn;
  float seam = smoothstep(0.86, 0.985, md);
  vec3 p = q * (1.6 + uShell) + vec3(0.0, uTime * 0.25, uTime * 0.12);
  float fire = ncNoise(p) * 0.65 + ncNoise(p * 2.3 + 4.0) * 0.35;
  float veins = 1.0 - abs(ncNoise(p * 1.4 + 9.0) * 2.0 - 1.0);
  veins = smoothstep(0.75, 0.98, veins);
  float facing = abs(dot(normalize(vN), normalize(vView)));
  float g = min(1.0 + log(max(uGlow, 0.05)), 1.8);
  // deep red-orange body, molten orange churn, hot seams — no white wash
  vec3 deep = uColor * 0.42;
  vec3 hot = mix(uColor, uHot, 0.35) * 1.5;
  vec3 white = uHot * 2.2;
  vec3 col = mix(deep, hot, fire);
  col = mix(col, white, veins * 0.55 + uShell * 0.12);
  col *= 0.35 + 0.65 * facing;
  col += mix(uColor * 2.2, white, uShell) * seam;
  col *= g * (0.8 + uHeat * 0.5) * uCoreGlow;
  col *= 1.0 - smoothstep(0.0, 0.22, uFracture);
  gl_FragColor = vec4(col * 0.5, 1.0);
}
`;

const SHARD_VERTEX = /* glsl */ `
attribute vec3 aPOrigin;
attribute vec3 aPDir;
attribute vec3 aPAxis;
attribute float aPSeed;
attribute vec3 aOffset;
attribute vec3 aDir;
attribute vec3 aAxis;
attribute vec4 aInfo; // spawn, dist, size, seed
uniform float uFracture;
varying float vLife;
varying float vFacing;
${FRACTURE}
void main() {
  float fr = uFracture;
  float s = clamp((fr - aInfo.x) / (1.0 - aInfo.x), 0.0, 1.0);
  mat3 PR = ncRotation(aPAxis, fr * (1.2 + aPSeed * 2.6) * 3.14159);
  vec3 parent = ncFragOffset(aPOrigin, aPDir, aPSeed, fr) + PR * aOffset;
  float scale = aInfo.z * smoothstep(0.0, 0.06, s) * (1.0 - smoothstep(0.55, 1.0, s));
  mat3 R = ncRotation(aAxis, s * 9.0 + aInfo.w * 6.0);
  vec3 lp = R * position * scale + parent + aDir * pow(s, 1.15) * aInfo.y;
  vec4 mv = modelViewMatrix * vec4(lp, 1.0);
  vec3 n = normalize(normalMatrix * (R * normal));
  vFacing = abs(dot(n, normalize(-mv.xyz)));
  vLife = s;
  gl_Position = projectionMatrix * mv;
}
`;

const SHARD_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
varying float vLife;
varying float vFacing;
void main() {
  vec3 hot = uHot * 2.4;
  vec3 col = mix(hot, uColor * 1.4, smoothstep(0.0, 0.5, vLife)) * (0.55 + 0.45 * vFacing);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const SPARK_VERTEX = /* glsl */ `
attribute vec3 aOrigin;
attribute vec3 aDir;
attribute vec4 aInfo; // speed, size, seed, delay
uniform float uFracture;
uniform float uScale;
uniform float uFadeFar;
varying float vA;
void main() {
  float d = aInfo.w * 0.5;
  float s = clamp((uFracture - d) / (1.0 - d), 0.0, 1.0);
  vec3 p = aOrigin + aDir * pow(s, 0.8) * aInfo.x;
  p += vec3(sin(s * 6.0 + aInfo.z * 20.0), cos(s * 5.0 + aInfo.z * 13.0), sin(s * 4.0 + aInfo.z * 7.0)) * s * 0.9;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float alive = step(0.0001, s) * (1.0 - smoothstep(0.5, 1.0, s));
  vA = alive * smoothstep(1.0, uFadeFar * 0.5, -mv.z);
  gl_PointSize = aInfo.y * 0.08 * uScale / max(-mv.z, 0.4) * alive;
}
`;

const SPARK_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(mix(uColor, uHot, 0.6) * 1.8, m * vA);
}
`;

// Colour uniforms follow the tuning hex (converted to linear on change).
export function setHex(uniform, hex) {
  if (uniform.userData !== hex) {
    uniform.value.set(hex);
    uniform.userData = hex;
  }
}

function instanced(base, count, attrs) {
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(base.index);
  for (const name of Object.keys(base.attributes)) g.setAttribute(name, base.attributes[name]);
  for (const [name, [array, size]] of Object.entries(attrs)) {
    g.setAttribute(name, new THREE.InstancedBufferAttribute(array, size));
  }
  g.instanceCount = count;
  return g;
}

export default function EnergyCube({ monolith, quaternion, J, tier, shared }) {
  const size = monolith.cube.size;
  const { gl } = useThree();
  const nodes = useRef({});
  const groupRef = useRef();

  const data = useMemo(
    // built at 2× the quality tier; the tuned counts draw a prefix
    () => buildFractureData(size, quaternion, { shards: tier.shards * 2, sparks: tier.fractureParticles * 2 }),
    [size, quaternion, tier]
  );

  const uniforms = useMemo(
    () => ({
      uGlow: { value: 1 },
      uCrack: { value: 0 },
      uHeat: { value: 0 },
      uSize: { value: size },
      uColor: { value: ORANGE.clone() },
      uHot: { value: new THREE.Color("#ffc890") },
      uFracture: { value: 0 },
      uScale: { value: 500 },
      uTime: shared.uTime,
      uGlassOpacity: { value: 1 },
      uEdgeGlow: { value: 1 },
      uCoreGlow: { value: 1 },
      uDistort: { value: 0 },
      uFadeNear: { value: 3 },
      uFadeFar: { value: 14 },
    }),
    [size, shared]
  );

  const built = useMemo(() => {
    const { cubelets, shards, sparks } = data;
    const glass = (vertexShader, back) =>
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uBack: { value: back ? 1 : 0 } },
        vertexShader,
        fragmentShader: GLASS_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: back ? THREE.BackSide : THREE.FrontSide,
      });
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    const shell = (scale, inner) => ({
      geometry: new THREE.BoxGeometry(size * scale, size * scale, size * scale),
      material: new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uShell: { value: inner ? 1 : 0 }, uHalf: { value: (size * scale) / 2 } },
        vertexShader: SHELL_VERTEX,
        fragmentShader: SHELL_FRAGMENT,
        ...additive,
      }),
    });

    const solidGeo = new THREE.BoxGeometry(size, size, size);
    const flat = (list, fn, n) => {
      const out = new Float32Array(list.length * n);
      list.forEach((item, i) => out.set(fn(item), i * n));
      return out;
    };
    const fragGeo = instanced(new THREE.BoxGeometry(size / 3, size / 3, size / 3), cubelets.length, {
      aOrigin: [flat(cubelets, (c) => c.origin.toArray(), 3), 3],
      aDir: [flat(cubelets, (c) => c.dir.toArray(), 3), 3],
      aAxis: [flat(cubelets, (c) => c.axis.toArray(), 3), 3],
      aSeed: [flat(cubelets, (c) => [c.seed], 1), 1],
    });
    const shardGeo = instanced(new THREE.TetrahedronGeometry(1, 0), shards.length, {
      aPOrigin: [flat(shards, (s) => s.parent.origin.toArray(), 3), 3],
      aPDir: [flat(shards, (s) => s.parent.dir.toArray(), 3), 3],
      aPAxis: [flat(shards, (s) => s.parent.axis.toArray(), 3), 3],
      aPSeed: [flat(shards, (s) => [s.parent.seed], 1), 1],
      aOffset: [flat(shards, (s) => s.offset.toArray(), 3), 3],
      aDir: [flat(shards, (s) => s.dir.toArray(), 3), 3],
      aAxis: [flat(shards, (s) => s.axis.toArray(), 3), 3],
      aInfo: [flat(shards, (s) => [s.spawn, s.dist, s.size * (size / 3.2), s.seed], 4), 4],
    });
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sparks.length * 3), 3));
    sparkGeo.setAttribute("aOrigin", new THREE.BufferAttribute(flat(sparks, (s) => s.origin.toArray(), 3), 3));
    sparkGeo.setAttribute("aDir", new THREE.BufferAttribute(flat(sparks, (s) => s.dir.toArray(), 3), 3));
    sparkGeo.setAttribute("aInfo", new THREE.BufferAttribute(flat(sparks, (s) => [s.speed, s.size, s.seed, s.delay], 4), 4));

    return {
      shellOuter: shell(0.7, false),
      shellInner: shell(0.38, true),
      solid: { geometry: solidGeo, material: glass(SOLID_VERTEX, false) },
      solidBack: { geometry: solidGeo, material: glass(SOLID_VERTEX, true) },
      frag: { geometry: fragGeo, material: glass(FRAGMENT_VERTEX, false) },
      fragBack: { geometry: fragGeo, material: glass(FRAGMENT_VERTEX, true) },
      shard: {
        geometry: shardGeo,
        material: new THREE.ShaderMaterial({ uniforms, vertexShader: SHARD_VERTEX, fragmentShader: SHARD_FRAGMENT }),
      },
      spark: {
        geometry: sparkGeo,
        material: new THREE.ShaderMaterial({ uniforms, vertexShader: SPARK_VERTEX, fragmentShader: SPARK_FRAGMENT, ...additive }),
      },
    };
  }, [data, size, uniforms]);

  useEffect(
    () => () => {
      const seen = new Set();
      Object.values(built).forEach(({ geometry, material }) => {
        if (!seen.has(geometry)) geometry.dispose();
        seen.add(geometry);
        material.dispose();
      });
    },
    [built]
  );

  useFrame(() => {
    const fr = J.fracture;
    const u = uniforms;
    // the torn pieces cool as they fly apart (see EnergyBeams: no white flash)
    const spent = THREE.MathUtils.smoothstep(J.fracture, 0.15, 0.9);
    u.uGlow.value = J.cubeGlow * T.cubeGlow * (1 - spent * 0.6);
    setHex(u.uColor, T.cubeColor);
    setHex(u.uHot, T.cubeHotColor);
    u.uGlassOpacity.value = T.glassOpacity;
    u.uEdgeGlow.value = T.edgeGlow;
    u.uCoreGlow.value = T.coreGlow;
    u.uCrack.value = J.crack;
    u.uHeat.value = (Math.max(J.energy, 0) * 0.6 + J.crack * 0.8) * (1 - spent * 0.7);
    u.uFracture.value = fr;
    u.uFadeFar.value = T.coreFadeFar;
    u.uFadeNear.value = T.coreFadeNear;
    // builds while it cracks, peaks as it tears open, gone once it's apart
    u.uDistort.value = T.breakStretch * (J.crack * 0.45 * (1 - fr) + Math.sin(Math.PI * Math.min(fr / 0.75, 1)) * 0.9);
    u.uScale.value = gl.domElement.height * 0.5;
    if (groupRef.current) groupRef.current.scale.setScalar(cubeScale(monolith, J, T));
    built.shard.geometry.instanceCount = Math.min(Math.round(T.shardCount), data.shards.length);
    built.spark.geometry.setDrawRange(0, Math.min(Math.round(T.sparkCount), data.sparks.length));

    const broken = fr > 0;
    const show = (key, on) => {
      if (nodes.current[key]) nodes.current[key].visible = on;
    };
    show("shellOuter", fr < 0.22);
    show("shellInner", fr < 0.22);
    show("solid", !broken);
    show("solidBack", !broken);
    show("frag", broken && fr < 1);
    show("fragBack", broken && fr < 1);
    show("shard", fr > 0.3 && fr < 1);
    show("spark", broken && fr < 1);
  });

  const part = (key, order) => (
    <mesh
      ref={(el) => {
        nodes.current[key] = el;
      }}
      geometry={built[key].geometry}
      material={built[key].material}
      renderOrder={order}
      frustumCulled={false}
      visible={false}
    />
  );
  return (
    <group ref={groupRef} position={monolith.cube.position} quaternion={quaternion}>
      {part("solidBack", 3)}
      {part("fragBack", 3)}
      {part("shellOuter", 4)}
      {part("shellInner", 5)}
      {part("solid", 6)}
      {part("frag", 6)}
      {part("shard", 4)}
      <points
        ref={(el) => {
          nodes.current.spark = el;
        }}
        geometry={built.spark.geometry}
        material={built.spark.material}
        frustumCulled={false}
        visible={false}
      />
    </group>
  );
}
