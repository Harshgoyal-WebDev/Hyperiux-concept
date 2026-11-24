"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./util";
import { A } from "../tuning";

// The land turning into light, after mesh3d.gallery: V3's sand becomes a
// soft, self-lit landscape — dark in its hollows, glowing up on its crests,
// wisps of light drifting through the glow — under a cloud of motes on and
// above it, sizes all different, drifting and twinkling, fading into the
// haze. The whole land at once as the streaks come down (a soft organic
// dissolve: each point a little sooner or later). Its ridge lines are drawn
// from depth after the render (RidgeEffect, AboutScene.jsx). Drawn over the
// sand on V3's own terrain mesh; the sand is untouched underneath.
// Look values: tuning.js (A), live from the Leva panel.

const CONVERT_GLSL = /* glsl */ `
  uniform float uFall;
  uniform float uConvertStart;
  uniform float uConvertSpan;
  float cvH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cvN(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cvH(i), cvH(i + vec2(1.0, 0.0)), f.x), mix(cvH(i + vec2(0.0, 1.0)), cvH(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float converted(vec2 xz, out float edge) {
    float t = uConvertStart + (cvN(xz * 0.012) * 0.78 + cvN(xz * 0.07) * 0.22) * uConvertSpan;
    float c = smoothstep(t, t + 0.1, uFall);
    edge = c * (1.0 - c) * 4.0;
    return c;
  }
`;

function convertUniforms(U) {
  return { uFall: U.uFall, uConvertStart: { value: A.convertStart }, uConvertSpan: { value: A.convertSpan } };
}
function syncConvert(u) {
  u.uConvertStart.value = A.convertStart;
  u.uConvertSpan.value = A.convertSpan;
}

export function LightTerrain({ U, geometry }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
        uniforms: {
          ...convertUniforms(U),
          uTime: U.uTime,
          uWhite: U.uWhite,
          uFogColor: U.uFogColor,
          uFogDensity: U.uFogDensity,
          uGlow: { value: 1 },
          uWisps: { value: 1 },
          uCrest: { value: 1 },
          uBase: { value: new THREE.Color() },
          uColor: { value: new THREE.Color() },
        },
        vertexShader: /* glsl */ `
          varying vec3 vW;
          varying vec3 vN;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xyz;
            vN = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uWhite;
          uniform vec3 uFogColor;
          uniform float uFogDensity;
          uniform float uGlow;
          uniform float uWisps;
          uniform float uCrest;
          uniform vec3 uBase;
          uniform vec3 uColor;
          varying vec3 vW;
          varying vec3 vN;
          ${CONVERT_GLSL}
          float fbm(vec2 p) {
            float s = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
              s += a * cvN(p);
              p = p * 2.03 + vec2(1.7, 9.2);
              a *= 0.5;
            }
            return s;
          }
          void main() {
            float edge;
            float c = converted(vW.xz, edge);
            if (c < 0.002) discard;
            vec3 n = normalize(vN);
            vec3 V = normalize(cameraPosition - vW);
            float dist = length(cameraPosition - vW);
            // up on the dunes, down in the hollows
            float up = smoothstep(-3.0, 12.0, vW.y);
            // the slopes turned from the light behind them (towards the far
            // glow) catch it softly — never the grazing flat ground
            float facing = 1.0 - max(dot(n, V), 0.0);
            float slope = 1.0 - smoothstep(0.75, 0.98, n.y);
            float soft = pow(facing, 2.0) * slope;
            // wisps of light drifting over the land, stretched along it
            vec2 q = vec2(vW.x * 0.018, vW.z * 0.045) + vec2(uTime * 0.012, uTime * 0.004);
            float wisp = smoothstep(0.45, 0.9, fbm(q + fbm(q * 1.7 + 3.0) * 0.8));
            // (dark in the hollows: the glow climbs steeply with height)
            float glow = up * up * uCrest * (0.3 + soft * 1.1) + wisp * uWisps * up * (0.15 + up * 0.7);
            vec3 col = uBase * (0.6 + 0.4 * n.y) + uColor * glow * uGlow * 0.32;
            col += uColor * edge * 0.6;
            // haze (the land fades into it far off)
            float f = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
            col = mix(col, uFogColor, f);
            gl_FragColor = vec4(col * (1.0 - uWhite), c);
          }
        `,
      }),
    [U]
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const u = material.uniforms;
    syncConvert(u);
    u.uGlow.value = A.terrainGlow;
    u.uWisps.value = A.terrainWisps;
    u.uCrest.value = A.terrainCrest;
    u.uBase.value.set(A.terrainBase);
    u.uColor.value.set(A.terrainColor);
  });
  return <mesh geometry={geometry} material={material} renderOrder={1} frustumCulled={false} />;
}

// The motes: on the land and lifting off it, sizes all different, drifting,
// twinkling; a slight colour fringe on the nearest (as a lens would).
export function TerrainParticles({ U, geometry, count }) {
  const points = useMemo(() => {
    const rand = mulberry32(19);
    const src = geometry.attributes.position;
    const idx = geometry.index ? geometry.index.array : null;
    const p = new Float32Array(count * 3);
    const r = new Float32Array(count * 3);
    const tri = idx ? idx.length / 3 : src.count / 3;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const cc = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const t = Math.floor(rand() * tri) * 3;
      a.fromBufferAttribute(src, idx ? idx[t] : t);
      b.fromBufferAttribute(src, idx ? idx[t + 1] : t + 1);
      cc.fromBufferAttribute(src, idx ? idx[t + 2] : t + 2);
      let u = rand();
      let v = rand();
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      a.multiplyScalar(1 - u - v).addScaledVector(b, u).addScaledVector(cc, v);
      p.set([a.x, a.y + 0.2, a.z], i * 3);
      // (size: mostly fine, a few large; lift: most near the surface)
      r.set([rand(), Math.pow(rand(), 3), Math.pow(rand(), 2.2)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aRnd", new THREE.BufferAttribute(r, 3));
    return g;
  }, [geometry, count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          ...convertUniforms(U),
          uTime: U.uTime,
          uPixel: U.uPixel,
          uWhite: U.uWhite,
          uSize: { value: 1 },
          uIntensity: { value: 1 },
          uLift: { value: 2 },
          uTwinkle: { value: 1 },
          uColor: { value: new THREE.Color() },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aRnd;
          uniform float uTime;
          uniform float uPixel;
          uniform float uSize;
          uniform float uLift;
          uniform float uTwinkle;
          varying float vA;
          varying float vFringe;
          ${CONVERT_GLSL}
          void main() {
            float front;
            float c = converted(position.xz, front);
            vec3 p = position;
            // lifted off the land, drifting slowly on the air
            p.y += aRnd.z * uLift * 6.0 + sin(uTime * (0.25 + aRnd.x * 0.5) + aRnd.x * 40.0) * 0.5;
            p.x += sin(uTime * 0.12 + aRnd.x * 30.0) * 1.2 * aRnd.z;
            p.z += cos(uTime * 0.1 + aRnd.x * 20.0) * 1.2 * aRnd.z;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float size = (0.1 + aRnd.y * 0.55) * uSize;
            float px = uPixel * max(-mv.z, 0.01);
            gl_PointSize = clamp(size / px, 1.2, 14.0);
            float tw = mix(1.0, 0.45 + 0.55 * sin(uTime * (1.2 + aRnd.x * 3.0) + aRnd.x * 90.0), uTwinkle);
            vA = c * min(size / px, 1.0) * tw * (1.0 + front * 1.5) * (1.0 - smoothstep(260.0, 620.0, -mv.z));
            vFringe = smoothstep(40.0, 8.0, -mv.z);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uWhite;
          uniform float uIntensity;
          uniform vec3 uColor;
          varying float vA;
          varying float vFringe;
          void main() {
            vec2 pc = gl_PointCoord - 0.5;
            float d = length(pc) * 2.0;
            float a = pow(max(1.0 - d, 0.0), 1.6) * vA * (1.0 - uWhite);
            vec3 col = mix(uColor, vec3(1.0, 0.75, 0.45), 0.35);
            // (the near ones split a little at their edges)
            col += vec3(0.25, -0.05, 0.15) * vFringe * pc.x * 2.0;
            gl_FragColor = vec4(col * a * 2.2 * uIntensity, 1.0);
          }
        `,
      }),
    [U]
  );
  useEffect(
    () => () => {
      points.dispose();
      material.dispose();
    },
    [points, material]
  );
  useFrame(() => {
    const u = material.uniforms;
    syncConvert(u);
    u.uSize.value = A.motesSize;
    u.uIntensity.value = A.motesIntensity;
    u.uLift.value = A.motesLift;
    u.uTwinkle.value = A.motesTwinkle;
    u.uColor.value.set(A.terrainColor);
  });
  return <points geometry={points} material={material} frustumCulled={false} renderOrder={2} />;
}
