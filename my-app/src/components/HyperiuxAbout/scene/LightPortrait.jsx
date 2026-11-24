"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./util";
import { INVERSE_ACES_GLSL, acesUniforms } from "./aces";
import { MORPH_GLSL, PortraitParticles } from "./PortraitParticles";
import { A } from "../tuning";

// The team member, as a sculpture of light: a curtain of vertical amber
// strands where their head and shoulders are, each strand's brightness read
// from their light map (portraitMap.js) along its length — the face exists
// only in how bright, how dense and how close the strands are. Between them,
// the dark shows through.
//   uReveal   0 → 1: the strands gather in out of the field into the face
//   uDissolve 0 → 1: they detach, stretch and flow upwards away (the final
//             dissolve)
//   uMorph    0 → 1: changing member — the same strands re-form from one
//             face (uMap) into the next (uMapB), in a wave across the
//             portrait: each piece breaks loose, drifts, and settles into
//             the new face's light and depth
//   uScan     a scanning wave's x (world) and uScanGlow its strength
// Fine particles hang on the face's contours, drifting.
export const PORTRAIT_H = 5.95;
export const PORTRAIT_W = PORTRAIT_H * 0.8;

export function LightPortrait({ U, columns, segments, particles, morphParticles, stage, S }) {
  const group = useRef(null);
  const size = useThree((s) => s.size);

  const strands = useMemo(() => {
    const rand = mulberry32(23);
    const n = columns * segments;
    const cell = new Float32Array(n * 2);
    const rnd = new Float32Array(n * 4);
    let k = 0;
    for (let c = 0; c < columns; c++) {
      // (each strand keeps its own character along its length)
      const sr = [rand(), rand(), rand()];
      for (let s = 0; s < segments; s++) {
        cell[k * 2] = (c + 0.5 + (rand() - 0.5) * 0.25) / columns;
        cell[k * 2 + 1] = s / segments;
        rnd.set([rand(), sr[0], sr[1], sr[2] * 0.5 + rand() * 0.5], k * 4);
        k++;
      }
    }
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute("position", quad.attributes.position);
    g.setAttribute("uv", quad.attributes.uv);
    g.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 2));
    g.setAttribute("aRnd", new THREE.InstancedBufferAttribute(rnd, 4));
    g.instanceCount = n;
    return g;
  }, [columns, segments]);

  const strandMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uMap: U.uMap,
          uTime: U.uTime,
          uPixel: U.uPixel,
          uReveal: U.uReveal,
          uDissolve: U.uDissolve,
          uMapB: U.uMapB,
          uMorph: U.uMorph,
          uScan: U.uScan,
          uScanGlow: U.uScanGlow,
          uLight: U.uLight,
          uWhite: U.uWhite,
          uIntensity: { value: 1 },
          uRest: { value: 0.12 },
          uW: { value: PORTRAIT_W },
          uH: { value: PORTRAIT_H },
          uDepth: { value: 1.7 },
          uRelief: { value: 0.35 },
          uThick: { value: 0.18 },
          uSegH: { value: 1 / segments },
          uStrandW: { value: (PORTRAIT_W / columns) * 0.5 },
          uColor: { value: new THREE.Color("#ff5f00") },
          uHot: { value: new THREE.Color("#ffd3a6") },
          uDashFreq: { value: 3.2 },
          uDashLength: { value: 0.35 },
          uFlow: { value: 0.35 },
          uBase: { value: 0.75 },
        },
        vertexShader: /* glsl */ `
          attribute vec2 aCell;
          attribute vec4 aRnd;
          uniform sampler2D uMap;
          uniform float uTime;
          uniform float uPixel;
          uniform float uReveal;
          uniform float uDissolve;
          uniform sampler2D uMapB;
          uniform float uMorph;
          uniform float uScan;
          uniform float uScanGlow;
          uniform float uW;
          uniform float uH;
          uniform float uDepth;
          uniform float uRelief;
          uniform float uThick;
          uniform float uSegH;
          uniform float uStrandW;
          varying vec2 vMap;
          varying float vX;
          varying float vFade;
          varying float vRnd;
          varying float vScan;
          varying float vMorph;
          varying float vStir;
          varying float vActive;
          void main() {
            float u = aCell.x;
            float v = aCell.y + uv.y * uSegH;
            // changing member: where this piece is in the change — a wave
            // across the portrait, left to right, each piece a little sooner
            // or later — and how stirred up it is (most at the middle)
            float ms = u * 0.6 + aRnd.y * 0.28 + aRnd.x * 0.12;
            float mp = clamp((uMorph * 1.55 - ms) / 0.55, 0.0, 1.0);
            mp = mp * mp * (3.0 - 2.0 * mp);
            float stir = 0.0;
            // (depth read at each end, so a strand's segments join up;
            // from the one face, turning into the next's)
            vec4 m = mix(texture2D(uMap, vec2(u, v)), texture2D(uMapB, vec2(u, v)), mp);
            // in 3D: on the head's rounded form (the dome), its features
            // lifted by their light, each strand on its own layer of depth
            // (the face has volume: the mouse moves round it)
            vec3 home = vec3((u - 0.5) * uW, (v - 0.5) * uH, m.b * uDepth + m.r * m.a * uRelief + (aRnd.y - 0.5) * uThick * m.a);
            // the field it gathers out of: spread wide and deep, drawn out tall
            vec3 field = vec3((aRnd.y - 0.5) * 32.0, (v - 0.5) * uH * 2.6 + (aRnd.z - 0.5) * 6.0, -2.5 - aRnd.w * 20.0);
            float r = clamp(uReveal * 1.9 - aRnd.y * 0.55 - abs(u - 0.5) * 0.35, 0.0, 1.0);
            r = r * r * (3.0 - 2.0 * r);
            vec3 p = mix(field, home, r);
            // detaching and flowing upwards, the upper strands first
            float d = clamp(uDissolve * 1.9 - aRnd.x * 0.45 - (1.0 - aCell.y) * 0.45, 0.0, 1.0);
            d = d * d;
            p.y += d * (2.5 + aRnd.z * 9.0) + uv.y * d * (0.6 + aRnd.w * 3.5);
            p.x += sin(aRnd.y * 40.0 + uTime * 0.5) * d * 0.9;
            p.z += (aRnd.w - 0.35) * d * 4.0;
            // breathing
            p.x += sin(uTime * 0.7 + aRnd.y * 50.0 + v * 3.0) * 0.004;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float px = uPixel * max(-mv.z, 0.01);
            float w = max(uStrandW, px * 1.05);
            mv.x += (uv.x - 0.5) * w * 4.0;
            gl_Position = projectionMatrix * mv;
            vMap = vec2(u, v);
            vX = uv.x;
            // (changing member, they fade while the particles carry it)
            vFade = (uStrandW / w) * mix(0.22, 1.0, r) * (1.0 - d * 0.9) * (1.0 - sin(3.14159 * uMorph) * 0.9);
            vMorph = mp;
            vStir = stir;
            // (how alive it is: forming, changing or dissolving — at rest it
            // lies faint over the portrait image)
            vActive = max(1.0 - r, d);
            vRnd = aRnd.y;
            vec4 wp = modelMatrix * vec4(p, 1.0);
            vScan = exp(-pow((wp.x - uScan) * 0.8, 2.0)) * uScanGlow;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform float uTime;
          uniform float uLight;
          uniform float uWhite;
          uniform float uIntensity;
          uniform vec3 uColor;
          uniform vec3 uHot;
          uniform float uDashFreq;
          uniform float uDashLength;
          uniform float uFlow;
          uniform float uBase;
          uniform sampler2D uMapB;
          varying vec2 vMap;
          varying float vX;
          varying float vFade;
          varying float vRnd;
          varying float vScan;
          varying float vMorph;
          varying float vStir;
          varying float vActive;
          uniform float uRest;
          void main() {
            // V3's streak across its width: a hot core in a soft glow
            float x = abs(vX - 0.5) * 4.0;
            float across = 1.0 - smoothstep(0.2, 1.0, x);
            float core = exp(-x * x * 3.2);
            vec4 mA = texture2D(uMap, vMap);
            vec4 mB = texture2D(uMapB, vMap);
            vec4 m = mix(mA, mB, vMorph);
            float lum = m.r;
            float edge = m.g;
            float mask = m.a;
            float flick = 0.8 + 0.2 * sin(uTime * (0.6 + vRnd * 1.6) + vRnd * 40.0);
            // delicate horizontal filaments crossing the strands
            float fil = pow(max(sin(vMap.y * 330.0 + sin(vMap.x * 9.0 + uTime * 0.3) * 4.0), 0.0), 60.0) * mask * 0.35;
            // ...and V3's dashes streaming along it (up the face)
            float dash = smoothstep(1.0 - uDashLength, 1.0 - uDashLength * 0.3, fract(-vMap.y * uDashFreq + uTime * uFlow + vRnd * 7.0 + vStir * 1.5));
            float I = (pow(lum, 1.05) * 1.65 + edge * 0.5 + mask * 0.13 + fil) * flick * (uBase + dash * 0.9);
            I += vScan * (0.35 + lum * 1.5) * mask;
            // (the change runs through it as light: brighter where it is
            // re-forming, over both faces' shapes)
            I += vStir * (0.25 + lum * 0.9 + edge * 0.6) * max(mA.a, mB.a) * 0.8;
            // its colours: the brand's orange, white-hot where the face is
            // brightest, on its contours and in the dashes
            vec3 col = mix(uColor, uHot, clamp(lum * 0.75 * core + edge * 0.4 + dash * 0.25 + vStir * 0.3 * core, 0.0, 1.0));
            col = mix(col, vec3(1.0, 0.92, 0.82), uLight);
            float a = I * mix(across, core, 0.5) * vFade * uIntensity * (1.0 - uWhite) * mix(uRest, 1.0, vActive);
            if (a < 0.002) discard;
            gl_FragColor = vec4(col * a, 1.0);
          }
        `,
      }),
    [U, columns, segments]
  );

  // The portrait image itself, as it is (the team render's look: the face in
  // amber light, fine lines of light down it, its outline glowing) — shown
  // exactly (through the tone mapping's inverse), its sides blending into
  // the backdrop. It changes member in the strands' wave, brightening as it
  // goes; it forms (uReveal) and dissolves (uDissolve) with them; now and
  // then a light passes across it, catching its bright lines.
  const imageMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uImage: U.uImage,
          uImageB: U.uImageB,
          uMorph: U.uMorph,
          uReveal: U.uReveal,
          uDissolve: U.uDissolve,
          uWhite: U.uWhite,
          uTime: U.uTime,
          uOnA: { value: 0 },
          uOnB: { value: 0 },
          uOpacity: { value: 1 },
          uFeather: { value: 0.2 },
          uPass: { value: 0.35 },
          uFlowLight: { value: 1 },
          ...acesUniforms(),
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uImage;
          uniform sampler2D uImageB;
          uniform float uMorph;
          uniform float uReveal;
          uniform float uDissolve;
          uniform float uWhite;
          uniform float uTime;
          uniform float uOnA;
          uniform float uOnB;
          uniform float uOpacity;
          uniform float uFeather;
          uniform float uPass;
          uniform float uFlowLight;
          varying vec2 vUv;
          ${INVERSE_ACES_GLSL}
          ${MORPH_GLSL}
          float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float vnoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
          }
          void main() {
            vec2 uv = vUv;
            // (column by column, as the strands go)
            float n = vnoise(vec2(uv.x * 70.0, uv.y * 3.0));
            // changing member: this face comes apart into the particles here,
            // and the next forms here as they land (PortraitParticles.jsx)
            float gone = smoothstep(morphLeave(uv), morphLeave(uv) + 0.05, uMorph);
            float back = smoothstep(morphArrive(uv) + 0.02, morphArrive(uv) + 0.09, uMorph);
            if (uMorph <= 0.0005 || uMorph >= 0.9995) { gone = 0.0; back = 0.0; }
            float wa = (1.0 - gone) * uOnA;
            float wb = back * uOnB;
            float on = wa + wb;
            vec3 c = (srgbToLinear(texture2D(uImage, uv).rgb) * wa + srgbToLinear(texture2D(uImageB, uv).rgb) * wb) / max(on, 0.001);
            float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
            // light streaming down its lines of light: each fine column its
            // own run of bright dashes, at its own pace — caught by the bright
            // lines and the glowing outline, not the dark between
            float colN = floor(uv.x * 240.0);
            float hc = h21(vec2(colN, 3.1));
            float hd = h21(vec2(colN, 7.7));
            float dash = smoothstep(0.7, 1.0, fract(uv.y * (1.2 + hc * 2.5) + uTime * (0.08 + hd * 0.3) + hc * 10.0));
            float lit = smoothstep(0.1, 0.45, lum);
            c += c * dash * lit * uFlowLight * (0.8 + hd);
            // (the outline and the brightest lines breathe, each a little apart)
            c *= 1.0 + 0.25 * uFlowLight * lit * sin(uTime * (0.6 + hc) + hd * 30.0);
            // a light passing across now and then, caught by the bright lines
            float px = fract(uTime * 0.07) * 1.8 - 0.4;
            float pass = exp(-pow((uv.x - px - (uv.y - 0.5) * 0.15) * 6.0, 2.0));
            c *= 1.0 + pass * uPass * smoothstep(0.02, 0.25, lum);
            // forming from below, column by column; dissolving from the top
            float rv = clamp(uReveal * 1.7 - uv.y * 0.4 - n * 0.3, 0.0, 1.0);
            float ds = clamp(uDissolve * 1.7 - (1.0 - uv.y) * 0.4 - n * 0.3, 0.0, 1.0);
            // its sides and top soft into the backdrop
            float fx = smoothstep(0.0, uFeather, uv.x) * smoothstep(1.0, 1.0 - uFeather, uv.x);
            float fy = smoothstep(1.0, 1.0 - uFeather * 0.6, uv.y);
            float alpha = fx * fy * rv * (1.0 - ds) * on * uOpacity * (1.0 - uWhite);
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(inverseAces(c), alpha);
          }
        `,
      }),
    [U]
  );

  // particles on the contours
  const dust = useMemo(() => {
    const rand = mulberry32(61);
    const uvs = new Float32Array(particles * 2);
    const rnd = new Float32Array(particles * 4);
    for (let i = 0; i < particles; i++) {
      uvs.set([rand(), rand()], i * 2);
      rnd.set([rand(), rand(), rand(), rand()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(particles * 3), 3));
    g.setAttribute("aUv", new THREE.BufferAttribute(uvs, 2));
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 4));
    return g;
  }, [particles]);
  const dustMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uMap: U.uMap,
          uTime: U.uTime,
          uPixel: U.uPixel,
          uReveal: U.uReveal,
          uDissolve: U.uDissolve,
          uMapB: U.uMapB,
          uMorph: U.uMorph,
          uLight: U.uLight,
          uWhite: U.uWhite,
          uW: { value: PORTRAIT_W },
          uH: { value: PORTRAIT_H },
        },
        vertexShader: /* glsl */ `
          attribute vec2 aUv;
          attribute vec4 aRnd;
          uniform sampler2D uMap;
          uniform float uTime;
          uniform float uPixel;
          uniform float uReveal;
          uniform float uDissolve;
          uniform sampler2D uMapB;
          uniform float uMorph;
          uniform float uW;
          uniform float uH;
          varying float vA;
          void main() {
            float ms = aUv.x * 0.6 + aRnd.y * 0.4;
            float mp = clamp((uMorph * 1.55 - ms) / 0.55, 0.0, 1.0);
            mp = mp * mp * (3.0 - 2.0 * mp);
            float stir = sin(3.14159 * mp);
            vec4 m = mix(texture2D(uMap, aUv), texture2D(uMapB, aUv), mp);
            float weight = (m.g * 0.8 + m.r * 0.3) * m.a + step(0.985, aRnd.x) * 0.3;
            // drifting off the surface, rising slowly
            float life = fract(uTime * (0.03 + aRnd.y * 0.05) + aRnd.z);
            vec3 home = vec3((aUv.x - 0.5) * uW, (aUv.y - 0.5) * uH, m.b * 0.9);
            home += vec3(sin(aRnd.w * 30.0 + uTime * 0.4) * 0.15, life * 0.8, (aRnd.x - 0.5) * 0.6) * (0.3 + aRnd.w);
            vec3 field = vec3((aRnd.y - 0.5) * 30.0, (aRnd.z - 0.5) * 12.0, -3.0 - aRnd.w * 18.0);
            float r = clamp(uReveal * 1.6 - aRnd.x * 0.6, 0.0, 1.0);
            vec3 p = mix(field, home, r * r * (3.0 - 2.0 * r));
            float d = clamp(uDissolve * 1.6 - aRnd.y * 0.6, 0.0, 1.0);
            p.y += d * d * (3.0 + aRnd.z * 8.0);
            p.x += (aRnd.w - 0.5) * d * 3.0;
            p += vec3((aRnd.w - 0.5) * 1.2, (aRnd.z - 0.5) * 1.0 + 0.5, (aRnd.x - 0.5) * 2.0 + 0.4) * stir;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float size = 0.01 + pow(aRnd.w, 2.0) * 0.022;
            float px = uPixel * max(-mv.z, 0.01);
            gl_PointSize = max(size / px, 1.0);
            vA = weight * min(size / px, 1.0) * smoothstep(0.0, 0.15, life) * (1.0 - life) * mix(0.3, 1.0, r) * (1.0 - d * 0.6) * (1.0 + stir * 1.5);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uLight;
          uniform float uWhite;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA * (1.0 - uWhite);
            gl_FragColor = vec4(mix(vec3(1.0, 0.45, 0.1), vec3(1.0, 0.85, 0.7), uLight) * a * 2.2, 1.0);
          }
        `,
      }),
    [U]
  );

  useEffect(
    () => () => {
      strands.dispose();
      strandMat.dispose();
      imageMat.dispose();
      dust.dispose();
      dustMat.dispose();
    },
    [strands, strandMat, imageMat, dust, dustMat]
  );

  // where the portrait is on screen (for the streaks to give way to it)
  const corner = useMemo(() => new THREE.Vector3(), []);
  const camera = useThree((s) => s.camera);

  // composition: the portrait to the right of the copy on wide screens,
  // centred and higher on tall ones; turning a touch with the pointer
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const portrait = size.width / size.height < 0.9;
    // (wide screens: filling the frame's height, its centre a little right of
    // the frame's — where the team render has it)
    const x = portrait ? 0 : (size.width / size.height) * 0.457;
    // (set back by its depth, so the sculpture's middle sits where the flat
    // portrait did: the same framing, now with volume to move round)
    g.position.set(stage.x + x, stage.y + (portrait ? 0.85 : 0), stage.z - (A.portraitDepth * 0.6 + A.portraitRelief * 0.3));
    g.scale.setScalar(portrait ? 0.82 : 1);
    g.rotation.set(0, 0, 0);
    // (only in the team's section: never seen far off from the hero)
    g.visible = S.cut > 0.0005;
    g.updateMatrixWorld();
    let x0 = 1;
    let y0 = 1;
    let x1 = 0;
    let y1 = 0;
    for (const [cx, cy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      corner.set(cx * PORTRAIT_W, cy * PORTRAIT_H, A.portraitDepth * 0.5).applyMatrix4(g.matrixWorld).project(camera);
      x0 = Math.min(x0, corner.x * 0.5 + 0.5);
      x1 = Math.max(x1, corner.x * 0.5 + 0.5);
      y0 = Math.min(y0, corner.y * 0.5 + 0.5);
      y1 = Math.max(y1, corner.y * 0.5 + 0.5);
    }
    U.uHoldRect.value.set(x0, y0, x1, y1);
    // (only once the team's shot is the frame: the rect is the team camera's)
    U.uHold.value = S.cut >= 0.9995 ? THREE.MathUtils.smoothstep(U.uReveal.value, 0.5, 1) * (1 - U.uDissolve.value) : 0;
    const u = strandMat.uniforms;
    u.uDepth.value = A.portraitDepth;
    u.uRelief.value = A.portraitRelief;
    u.uThick.value = A.portraitThickness;
    u.uStrandW.value = (PORTRAIT_W / columns) * A.portraitStrandWidth;
    u.uIntensity.value = A.portraitIntensity;
    u.uRest.value = A.portraitStrandRest;
    const iu = imageMat.uniforms;
    iu.uOnA.value = U.uImage.value ? 1 : 0;
    iu.uOnB.value = U.uImageB.value ? 1 : 0;
    iu.uOpacity.value = A.portraitImage;
    iu.uFeather.value = A.portraitFeather;
    iu.uPass.value = A.portraitLightPass;
    iu.uFlowLight.value = A.portraitFlowLight;
    u.uColor.value.set(A.portraitColor);
    u.uHot.value.set(A.portraitHot);
    u.uDashFreq.value = A.portraitDashSpacing;
    u.uDashLength.value = A.portraitDashLength;
    u.uFlow.value = A.portraitFlow;
    u.uBase.value = A.portraitBase;
  });

  return (
    <group ref={group}>
      <mesh material={imageMat} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[PORTRAIT_W, PORTRAIT_H]} />
      </mesh>
      <mesh geometry={strands} material={strandMat} frustumCulled={false} renderOrder={2} />
      <PortraitParticles U={U} count={morphParticles} width={PORTRAIT_W} height={PORTRAIT_H} />
      <points geometry={dust} material={dustMat} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
