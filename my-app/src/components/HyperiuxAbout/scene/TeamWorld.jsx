"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TEAM_CAM_DIST, TEAM_LAYER } from "./stage";
import { mulberry32 } from "./util";
import { INVERSE_ACES_GLSL, acesUniforms } from "./aces";
import { A } from "../tuning";

// The team's own place, as V3's oasis is to its forge: a separate scene,
// reached through the bunq transition, that the hero never draws and that
// draws nothing of the hero. It lives on its own layer (TEAM_LAYER): the
// team camera sees only it, the hero camera never does.
// No land: the portrait stands in a dark, warm space — a haze of light
// behind the head, fading to the dark at the edges; vertical lines of amber
// light at every depth behind the person (fine and faint, a few bright, each
// with its own soft glow; the mouse parallax shows their depth); fine dust
// hanging in the air. Look values: tuning.js (A), "Team backdrop".

// The team's sky: the portraits' own surroundings — near black-brown up at
// the top left, a warm brown lower down and towards the person — set so it
// shows on screen in exactly those tones (through the tone mapping's
// inverse), so the portrait images blend into it without an edge.
function createTeamSky() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uBack: { value: 1 }, uWhite: { value: 0 }, ...acesUniforms() },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uBack;
      uniform float uWhite;
      varying vec3 vDir;
      ${INVERSE_ACES_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        // (as on screen: how far off straight ahead)
        vec2 q = d.xy / max(-d.z, 0.05);
        float ahead = smoothstep(0.0, 0.3, -d.z);
        float h = exp(-(pow((q.x - 0.12) / 0.45, 2.0) + pow((q.y + 0.18) / 0.38, 2.0))) * ahead;
        vec3 c = mix(vec3(22.0, 16.0, 15.0) / 255.0, vec3(58.0, 36.0, 30.0) / 255.0, clamp(h * uBack, 0.0, 1.0));
        gl_FragColor = vec4(inverseAces(srgbToLinear(c)) * (1.0 - uWhite), 1.0);
      }
    `,
  });
}

// the dark sky over a scene: a warm band of haze low on the horizon
// (uGlow, strongest ahead) — the hero's drawing over V3's sky — and a warm
// haze straight ahead (uBack)
export function createCurtainMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uOpacity: { value: 0 }, uGlow: { value: 0 }, uBack: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uGlow;
      uniform float uBack;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float band = exp(-max(d.y + 0.02, 0.0) * 9.0);
        float ahead = 0.35 + 0.65 * pow(max(-d.z, 0.0), 3.0);
        vec3 col = vec3(0.016, 0.008, 0.005) + vec3(0.42, 0.1, 0.018) * band * ahead * uGlow;
        // (a soft haze straight ahead, a little taller than wide)
        vec3 q = normalize(vec3(d.x, d.y * 0.75, d.z));
        float back = pow(max(-q.z, 0.0), 9.0);
        col += (vec3(0.2, 0.065, 0.016) * back + vec3(0.03, 0.009, 0.003) * pow(max(-q.z, 0.0), 4.0)) * uBack;
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });
}

// The lines of light: each a vertical strand at its own depth behind the
// person, across the view (more of them behind the person than out at the
// sides), its own width, brightness and flicker; brightest round the
// portrait's height, fading out below.
const LINE_H = 60;
function buildLines(count) {
  const rand = mulberry32(77);
  const g = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  g.index = quad.index;
  g.setAttribute("position", quad.attributes.position);
  const line = new Float32Array(count * 4);
  const rnd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const D = 1.5 + Math.pow(rand(), 1.2) * 46;
    // (the view's half width at that depth, with a margin, for a wide screen)
    const half = (TEAM_CAM_DIST + D) * 0.7;
    // (gathered round the person — a little right of centre — and out to
    // the right; few out over the copy on the left)
    const s = rand() * 2 - 1;
    const x = (0.08 + Math.sign(s) * Math.pow(Math.abs(s), 1.15) * (s < 0 ? 0.55 : 0.95)) * half;
    const width = 0.004 + Math.pow(rand(), 4) * 0.05;
    // (mostly faint, a few bright; faint over the copy)
    const left = 1 - 0.85 * Math.min(Math.max(-x / half - 0.05, 0) / 0.35, 1);
    const bright = (0.05 + Math.pow(rand(), 3.5) * 0.95) * left;
    line.set([x, -D, width, bright], i * 4);
    rnd.set([rand() * 10, 0.2 + rand() * 0.8, rand(), rand()], i * 4);
  }
  g.setAttribute("aLine", new THREE.InstancedBufferAttribute(line, 4));
  g.setAttribute("aRnd", new THREE.InstancedBufferAttribute(rnd, 4));
  g.instanceCount = count;
  return g;
}

// The dust hanging in the air round the person, drifting slowly up.
function buildMotes(count) {
  const rand = mulberry32(91);
  const p = new Float32Array(count * 3);
  const r = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const D = -2 + Math.pow(rand(), 1.4) * 30;
    const half = (TEAM_CAM_DIST + D) * 0.7;
    p.set([(rand() * 2 - 1) * half, (rand() - 0.5) * 2, -D], i * 3);
    r.set([rand(), Math.pow(rand(), 3), rand()], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("aRnd", new THREE.BufferAttribute(r, 3));
  return g;
}

// The faint waves of light low in the frame, out either side of the
// shoulders: a few fine lines, each a slow swell across the view, rising a
// little towards the sides, light running along them.
const WAVES = 7;
const WAVE_SEGMENTS = 180;
function buildWaves() {
  const rand = mulberry32(57);
  const n = WAVES * (WAVE_SEGMENTS + 1) * 2;
  const t = new Float32Array(n * 2);
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 4);
  const index = [];
  let k = 0;
  for (let w = 0; w < WAVES; w++) {
    // (low in the frame at its depth: near its foot)
    const D = 2.5 + rand() * 6;
    const shape = [-(TEAM_CAM_DIST + D) * 0.315 * (0.8 + rand() * 0.14), 0.1 + rand() * 0.25, 0.16 + rand() * 0.2, rand() * 6.28];
    const more = [-D, 0.15 + rand() * 0.35, 0.3 + Math.pow(rand(), 2) * 0.7, 0];
    const first = k;
    for (let i = 0; i <= WAVE_SEGMENTS; i++) {
      for (const side of [-1, 1]) {
        t.set([i / WAVE_SEGMENTS * 2 - 1, side], k * 2);
        a.set(shape, k * 4);
        b.set(more, k * 4);
        k++;
      }
      if (i < WAVE_SEGMENTS) {
        const v = first + i * 2;
        index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("aT", new THREE.BufferAttribute(t, 2));
  g.setAttribute("aShape", new THREE.BufferAttribute(a, 4));
  g.setAttribute("aMore", new THREE.BufferAttribute(b, 4));
  g.setIndex(index);
  return g;
}

export function TeamWorld({ U, S, stage, lines: lineCount, motes: moteCount, children }) {
  const group = useRef(null);
  const sky = useMemo(() => createTeamSky(), []);
  useEffect(() => () => sky.dispose(), [sky]);

  const lines = useMemo(() => {
    const geometry = buildLines(lineCount);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: U.uTime,
        uPixel: U.uPixel,
        uWhite: U.uWhite,
        uH: { value: LINE_H },
        uIntensity: { value: 1 },
        uGlow: { value: 0.3 },
        uGlowPx: { value: 5 },
        uColor: { value: new THREE.Color() },
        uHot: { value: new THREE.Color() },
        uBehind: { value: 0.7 },
        uHoldMap: U.uMap,
        uHoldRect: U.uHoldRect,
        uHold: U.uHold,
        uResolution: U.uResolution,
      },
      vertexShader: /* glsl */ `
        attribute vec4 aLine; // x, depth (z), width (m), brightness
        attribute vec4 aRnd;
        uniform float uPixel;
        uniform float uH;
        uniform float uGlowPx;
        varying vec2 vUv;
        varying float vFix;
        varying float vCore;
        varying float vBright;
        varying vec4 vR;
        void main() {
          vec4 mv = modelViewMatrix * vec4(aLine.x, position.y * uH, aLine.y, 1.0);
          float d = max(-mv.z, 0.01);
          // (never finer than a pixel; a soft glow uGlowPx pixels either side)
          float wc = max(aLine.z, d * uPixel * 1.2);
          float w = wc + d * uPixel * uGlowPx * 2.0;
          mv.x += position.x * w;
          gl_Position = projectionMatrix * mv;
          vFix = aLine.z / wc;
          vCore = wc / w;
          vUv = vec2(position.x * 2.0, position.y);
          vBright = aLine.w;
          vR = aRnd;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uWhite;
        uniform float uIntensity;
        uniform float uGlow;
        uniform vec3 uColor;
        uniform vec3 uHot;
        uniform float uBehind;
        uniform sampler2D uHoldMap;
        uniform vec4 uHoldRect;
        uniform float uHold;
        uniform vec2 uResolution;
        varying vec2 vUv;
        varying float vFix;
        varying float vCore;
        varying float vBright;
        varying vec4 vR;
        // (dimmer where the person stands in front: their silhouette on screen)
        float behind() {
          vec2 m = (gl_FragCoord.xy / uResolution - uHoldRect.xy) / (uHoldRect.zw - uHoldRect.xy);
          if (m.x < 0.0 || m.y < 0.0 || m.x > 1.0 || m.y > 1.0) return 1.0;
          return 1.0 - smoothstep(0.05, 0.5, texture2D(uHoldMap, m).a) * uBehind * max(uHold, 0.0);
        }
        void main() {
          float sx = abs(vUv.x);
          float core = 1.0 - smoothstep(0.15 * vCore, vCore, sx);
          float halo = pow(max(1.0 - sx, 0.0), 3.0) * (1.0 - core);
          // (up its length: fading in from below the shoulders, each line
          // its own; thinning away high up)
          float y = vUv.y;
          float env = smoothstep(-0.36 - vR.w * 0.1, -0.02 - vR.w * 0.12, y) * (1.0 - smoothstep(0.25, 0.5, y));
          // light drifting up it, and a slow flicker
          float flow = 0.7 + 0.3 * sin(y * 36.0 - uTime * (0.4 + vR.y) * 1.5 + vR.x * 6.0);
          float flick = 0.8 + 0.2 * sin(uTime * (0.4 + vR.y * 0.8) + vR.x * 20.0);
          float I = vBright * env * flow * flick * (core * pow(vFix, 0.5) + halo * uGlow) * uIntensity * (1.0 - uWhite) * behind();
          if (I < 0.001) discard;
          vec3 col = mix(uColor, uHot, core * vR.z * 0.7 * vBright);
          gl_FragColor = vec4(col * I, 1.0);
        }
      `,
    });
    return { geometry, material };
  }, [lineCount, U]);

  const motes = useMemo(() => {
    const geometry = buildMotes(moteCount);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: U.uTime, uPixel: U.uPixel, uWhite: U.uWhite, uIntensity: { value: 1 }, uColor: { value: new THREE.Color() } },
      vertexShader: /* glsl */ `
        attribute vec3 aRnd;
        uniform float uTime;
        uniform float uPixel;
        varying float vA;
        void main() {
          vec3 p = position;
          // (drifting up through the frame, round again)
          float life = fract(uTime * (0.008 + aRnd.x * 0.012) + aRnd.z);
          p.y += (life - 0.5) * 22.0;
          p.x += sin(uTime * 0.2 + aRnd.x * 30.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float size = 0.008 + aRnd.y * 0.03;
          float px = uPixel * max(-mv.z, 0.01);
          gl_PointSize = clamp(size / px, 1.0, 10.0);
          vA = min(size / px, 1.0) * smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.8, 1.0, life)) * (0.55 + 0.45 * sin(uTime * (0.8 + aRnd.x) + aRnd.z * 40.0));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uWhite;
        uniform float uIntensity;
        uniform vec3 uColor;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(max(1.0 - d, 0.0), 1.6) * vA * uIntensity * (1.0 - uWhite);
          gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.8, 0.55), 0.35) * a * 1.6, 1.0);
        }
      `,
    });
    return { geometry, material };
  }, [moteCount, U]);

  const waves = useMemo(() => {
    const geometry = buildWaves();
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: U.uTime, uPixel: U.uPixel, uWhite: U.uWhite, uIntensity: { value: 0.5 }, uColor: { value: new THREE.Color() }, uHot: { value: new THREE.Color() } },
      vertexShader: /* glsl */ `
        attribute vec2 aT; // along (-1..1), side
        attribute vec4 aShape; // height, swell, frequency, phase
        attribute vec4 aMore; // depth, speed, brightness, tilt
        uniform float uTime;
        uniform float uPixel;
        varying float vSide;
        varying float vAlong;
        varying float vBright;
        varying float vCore;
        varying float vFlow;
        float yAt(float x) {
          // (rising gently out to the right, as the light lifts off the shoulder)
          return aShape.x + 0.006 * x * x + 0.07 * max(x - 1.0, 0.0)
            + aShape.y * sin(x * aShape.z + aShape.w + uTime * aMore.y * 0.25)
            + aShape.y * 0.35 * sin(x * aShape.z * 2.3 - uTime * aMore.y * 0.4 + aShape.w * 1.7);
        }
        void main() {
          float x = aT.x * 13.0;
          vec3 p = vec3(x, yAt(x), aMore.x);
          vec3 q = vec3(x + 0.05, yAt(x + 0.05), aMore.x);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vec4 mq = modelViewMatrix * vec4(q, 1.0);
          vec2 dir = normalize(mq.xy - mv.xy);
          float d = max(-mv.z, 0.01);
          // (a fine core, a soft glow either side: ~8 px across in all)
          float wc = max(0.006, d * uPixel * 1.1);
          float w = wc + d * uPixel * 6.0;
          mv.xy += vec2(-dir.y, dir.x) * aT.y * w * 0.5;
          gl_Position = projectionMatrix * mv;
          vSide = aT.y;
          vAlong = aT.x;
          vBright = aMore.z;
          vCore = wc / w;
          vFlow = x * 0.6 - uTime * aMore.y * 1.2 + aShape.w * 3.0;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uWhite;
        uniform float uIntensity;
        uniform vec3 uColor;
        uniform vec3 uHot;
        varying float vSide;
        varying float vAlong;
        varying float vBright;
        varying float vCore;
        varying float vFlow;
        void main() {
          float sx = abs(vSide);
          float core = 1.0 - smoothstep(0.1 * vCore, vCore, sx);
          float halo = pow(max(1.0 - sx, 0.0), 3.0) * (1.0 - core) * 0.35;
          // (faint across the middle, behind the shoulders; stronger out to
          // either side; gone at the far ends)
          float side = smoothstep(0.08, 0.55, abs(vAlong - 0.04)) * (1.0 - smoothstep(0.85, 1.0, abs(vAlong)));
          float run = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(vFlow), 3.0);
          float I = (core + halo) * side * run * vBright * uIntensity * (1.0 - uWhite);
          if (I < 0.001) discard;
          gl_FragColor = vec4(mix(uColor, uHot, core * 0.4) * I, 1.0);
        }
      `,
    });
    return { geometry, material };
  }, [U]);

  useEffect(
    () => () => {
      waves.geometry.dispose();
      waves.material.dispose();
    },
    [waves]
  );

  useEffect(
    () => () => {
      lines.geometry.dispose();
      lines.material.dispose();
      motes.geometry.dispose();
      motes.material.dispose();
    },
    [lines, motes]
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    // (only while the team is in view: from the transition on)
    g.visible = S.cut > 0.0005;
    if (!g.visible) return;
    // everything in it on the team's layer (the portrait's parts included)
    g.traverse((o) => o.layers.set(TEAM_LAYER));
    sky.uniforms.uBack.value = A.teamBackGlow;
    sky.uniforms.uWhite.value = S.white;
    const lu = lines.material.uniforms;
    lu.uIntensity.value = A.teamLineIntensity;
    lu.uGlow.value = A.teamLineGlow;
    lu.uGlowPx.value = A.teamLineGlowPx;
    lu.uColor.value.set(A.teamLineColor);
    lu.uBehind.value = A.teamLineBehind;
    lu.uHot.value.set(A.streakHot);
    const wu = waves.material.uniforms;
    wu.uIntensity.value = A.teamWaves;
    wu.uColor.value.set(A.teamLineColor);
    wu.uHot.value.set(A.streakHot);
    const mu = motes.material.uniforms;
    mu.uIntensity.value = A.teamMotesIntensity;
    mu.uColor.value.set(A.teamLineColor);
  });

  return (
    <group ref={group} visible={false}>
      <group position={[stage.x, stage.y, stage.z]}>
        <mesh renderOrder={-9} frustumCulled={false} material={sky}>
          <sphereGeometry args={[2200, 32, 16]} />
        </mesh>
        {/* (all of it drawn before the portrait, always: in its own order, not
        sorted by distance — which flipped as the pointer moved the camera,
        drawing the lines over the image) */}
        <mesh geometry={lines.geometry} material={lines.material} frustumCulled={false} renderOrder={-2} />
        <points geometry={motes.geometry} material={motes.material} frustumCulled={false} renderOrder={-2} />
        <mesh geometry={waves.geometry} material={waves.material} frustumCulled={false} renderOrder={-1} />
      </group>
      {children}
    </group>
  );
}
