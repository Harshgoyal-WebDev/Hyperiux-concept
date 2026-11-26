"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: the shared `look` is written imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BlendFunction, Effect } from "postprocessing";
import * as THREE from "three";
import { CONTACT } from "./choreography";

// The portal: forging-vid's change between scenes (its "bunq" glass discs —
// scene/CutTransition.jsx there), here opening onto the contact page. Small
// discs of glass on a hexagonal grid grow out from where the fingertips
// touch, across the whole frame, a soft, slightly ragged band of them; each
// disc a window through the scene: the canvas clears there (transparent) and
// the contact page, waiting beneath it, shows through. Each opening disc has a
// faint warm rim of glass until the discs run together. (The last pass: the
// rest of the frame is drawn as before.)
// Settings as forging-vid's (tuning.js trans*): 11 px discs, spread 3.2,
// jitter 0.05, overshoot 0.38.

const FRAGMENT = /* glsl */ `
uniform float uT;
uniform vec2 uCenter; // the touch, on screen (uv)
uniform float uMaxD;
uniform vec2 uRes; // css px
uniform float uCellPx;
uniform float uSpread;
uniform float uJitter;
uniform float uOvershoot;
const float DISC_TOUCH = 0.5;
const float DISC_FULL = 0.57735027;
float rvHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
vec2 rvDiscCell(vec2 p, out vec2 gv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  gv = dot(a, a) < dot(b, b) ? a : b;
  return p - gv;
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uT <= 0.0005) {
    outputColor = inputColor;
    return;
  }
  if (uT >= 0.9995) {
    outputColor = vec4(0.0);
    return;
  }
  float ratio = uRes.x / uRes.y;
  float scale = uRes.x / uCellPx;
  vec2 p = (uv - 0.5) * vec2(1.0, 1.0 / ratio) * scale;
  vec2 gv;
  vec2 cell = rvDiscCell(p, gv);
  vec2 cuv = cell / scale * vec2(1.0, ratio) + 0.5;
  // (each disc's turn: by its distance from the touch, a little ragged)
  float lead = clamp(length((cuv - uCenter) * vec2(ratio, 1.0)) / uMaxD, 0.0, 1.0);
  lead += (rvHash(floor(cell * 2.0 + 0.5)) - 0.5) * uJitter;
  lead = clamp(lead, 0.0, 1.0);
  float t = clamp(uT * (1.0 + uSpread) - lead * uSpread, 0.0, 1.0);
  float rad = t * (DISC_FULL + uOvershoot);
  float d = length(gv);
  float aa = fwidth(d) + 1e-4;
  float cut = (1.0 - smoothstep(rad - aa, rad + aa, d)) * smoothstep(0.0, aa, rad);
  // glass: a faint warm rim round each disc as it opens, and a soft sheen in
  // its dome, both gone as the discs run together
  float glass = (1.0 - smoothstep(DISC_TOUCH, DISC_FULL, rad)) * step(0.0005, rad);
  float rim = exp(-pow((d - rad) / (aa * 1.2 + 0.035), 2.0)) * glass;
  float k = clamp(d / max(rad, 1e-4), 0.0, 1.0);
  float sheen = cut * glass * (1.0 - k * k) * 0.05;
  // (what was clear stays clear: the hands' canvas is see-through round
  // them now, the about hero's world drawn behind it — AboutBackdrop.jsx)
  float a = inputColor.a * (1.0 - cut);
  vec3 col = inputColor.rgb * (1.0 - cut);
  vec3 warm = vec3(1.0, 0.42, 0.1);
  col += warm * rim * 0.14 + warm * sheen;
  a = clamp(a + rim * 0.14 + sheen, 0.0, 1.0);
  // (premultiplied: the page beneath shows through what clears)
  outputColor = vec4(col, a);
}
`;

class RevealEffect extends Effect {
  constructor() {
    super("RevealEffect", FRAGMENT, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([
        ["uT", new THREE.Uniform(0)],
        ["uCenter", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ["uMaxD", new THREE.Uniform(1)],
        ["uRes", new THREE.Uniform(new THREE.Vector2(1280, 720))],
        ["uCellPx", new THREE.Uniform(11)],
        ["uSpread", new THREE.Uniform(3.2)],
        ["uJitter", new THREE.Uniform(0.05)],
        ["uOvershoot", new THREE.Uniform(0.38)],
      ]),
    });
  }
}

// (`shared`: in the about hero's canvas behind the hands — its discs opened
// where the hands' canvas has them: the touch as the hands' camera sees it)
export default function Reveal({ look, shared = false }) {
  const effect = useMemo(() => new RevealEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  const ndc = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const u = effect.uniforms;
    u.get("uT").value = look.reveal;
    let cx;
    let cy;
    if (shared && look.revealCenter) {
      [cx, cy] = look.revealCenter;
    } else {
      ndc.copy(CONTACT).project(camera);
      cx = THREE.MathUtils.clamp(ndc.x * 0.5 + 0.5, 0, 1);
      cy = THREE.MathUtils.clamp(ndc.y * 0.5 + 0.5, 0, 1);
      look.revealCenter = [cx, cy];
    }
    u.get("uCenter").value.set(cx, cy);
    const ratio = size.width / Math.max(size.height, 1);
    // (to the farthest corner: the whole frame open by the end)
    u.get("uMaxD").value = Math.hypot(Math.max(cx, 1 - cx) * ratio, Math.max(cy, 1 - cy));
    u.get("uRes").value.set(size.width, Math.max(size.height, 1));
  });
  return <primitive object={effect} dispose={null} />;
}
