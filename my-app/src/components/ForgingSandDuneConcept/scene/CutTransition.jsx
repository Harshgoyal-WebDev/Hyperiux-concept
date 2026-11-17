"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ShaderPass } from "postprocessing";
import { T } from "../tuning";
import { NO_MIRROR_LAYER, VALLEY_LAYER } from "../config";
import { oasisCamera } from "../world/oasisCamera";
import { applyMagnet } from "../world/magnet";
import { WATER_Y } from "../world/oasis";

// The cut from the logo to the valley. As the camera closes on the forged
// mark, the frame becomes a field of hexagonal tiles of glass: through each
// the logo shot bends — magnified a little at its middle, bent hard at its
// bevelled edges — and splits into its colours, more and more, from the
// centre of the frame outwards. At the height of its distortion each tile
// turns over to the next shot — the camera low in the dune valley beyond
// (the oasis camera, rendered here into a target while the cut runs) —
// which then clears as the glass settles. No outlines: the tiles are only
// seen by what they do to the image. When it is done the main camera is
// that shot (CameraRig takes over as the cut ends), so the frame does not
// jump. The two shots move at the same pace throughout (world/oasisCamera.js).

const FRAGMENT = /* glsl */ `
uniform sampler2D inputBuffer;
uniform sampler2D tB;
varying vec2 vUv;
uniform float uT; // 0..1
uniform float uAspect;
uniform float uTime;
uniform float uGlass; // the glass's strength (T.cutGlass)
uniform float uChroma; // ...and how far it splits the colours (T.cutChroma)
const float CELL = 0.13; // a tile's size (screen heights)

// pointy-top hexagonal cells: (local x, y, cell id x, y)
vec4 cutHex(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
}
// inside the hexagon: distance to its boundary (0.5 at the centre)
float cutInHex(vec2 l) {
  vec2 a = abs(l);
  return 0.5 - max(a.x, dot(a, vec2(0.5, 0.8660254)));
}
float cutHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

// an image seen through the tile's glass: displaced by off, its colours split
vec3 cutGlass(sampler2D tex, vec2 uv, vec2 off, float split) {
  vec3 c;
  c.r = texture2D(tex, clamp(uv + off * (1.0 + split), 0.001, 0.999)).r;
  c.g = texture2D(tex, clamp(uv + off, 0.001, 0.999)).g;
  c.b = texture2D(tex, clamp(uv + off * (1.0 - split), 0.001, 0.999)).b;
  return c;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uT <= 0.0005 || uT >= 0.9995) {
    outputColor = inputColor;
    return;
  }
  vec2 sp = (uv - 0.5) * vec2(uAspect, 1.0);
  vec4 hx = cutHex(sp / CELL);
  vec2 l = hx.xy;
  vec2 id = hx.zw;
  vec2 centre = id * vec2(1.0, 1.7320508);
  float far = length(centre * CELL) / length(vec2(0.5 * uAspect, 0.5));
  float rnd = cutHash(id);
  // when this tile turns over: from the centre out, a little at random
  float delay = far * 0.42 + rnd * 0.12;
  float k = clamp((uT * 1.6 - 0.04 - delay) / 0.3, 0.0, 1.0);
  // the glass: a brief build-up ahead of the turn, strongest as it turns,
  // clearing over the new shot after (the old one is soon gone everywhere)
  float pre = smoothstep(0.0, 0.15, uT * 1.6 - delay * 0.8);
  float g = max(pre * 0.3 * (1.0 - k), sin(3.14159 * min(k * 1.2, 1.0))) * (1.0 - smoothstep(0.8, 1.0, uT)) * uGlass;
  // a bevelled lens: magnifying a little in the middle, bending hard
  // towards the edges (the bevel), each tile a touch differently
  float edge = clamp(cutInHex(l) / 0.5, 0.0, 1.0);
  vec2 dirL = l / max(length(l), 1e-4);
  float bevel = pow(1.0 - edge, 2.2);
  vec2 lens = -l * 0.32 + dirL * bevel * 0.55 + vec2(cos(rnd * 6.28), sin(rnd * 6.28)) * 0.05;
  vec2 off = lens * CELL / vec2(uAspect, 1.0) * g;
  float split = uChroma * (0.35 + bevel * 1.4) * g;
  // the logo shot and the next shot (settling out of a small zoom), each
  // through the glass; the switch is hidden in the strongest distortion
  vec3 a = cutGlass(inputBuffer, uv, off, split);
  vec2 dir = uv - 0.5;
  float settle = 1.0 - uT;
  vec2 buv = 0.5 + dir * (1.0 - 0.1 * settle * settle);
  vec3 b = cutGlass(tB, buv, off, split);
  float m = smoothstep(0.2, 0.45, k);
  vec3 col = mix(a, b, m);
  // glass, not light: a faint shading across each tile, darker at its rim
  col *= 1.0 - g * (0.18 * bevel + 0.06 * (l.y + 0.5));
  col += g * 0.04 * pow(max(dot(dirL, vec2(-0.55, 0.83)), 0.0), 3.0) * bevel * col;
  outputColor = vec4(col, inputColor.a);
}
`;

// (its own pass, ahead of the bloom: the bloom then glows from the frame as
// cut — not from the logo shot underneath, which would leave its glow hanging
// over the valley)
export function createCutPass() {
  const uniforms = {
    inputBuffer: { value: null },
    tB: { value: null },
    uT: { value: 0 },
    uAspect: { value: 1.6 },
    uTime: { value: 0 },
    uGlass: { value: 1 },
    uChroma: { value: 0.12 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }`,
    fragmentShader: FRAGMENT + /* glsl */ `
      void main() {
        vec4 c = texture2D(inputBuffer, vUv);
        vec4 o;
        mainImage(c, vUv, o);
        gl_FragColor = o;
      }`,
    depthTest: false,
    depthWrite: false,
  });
  return { pass: new ShaderPass(material, "inputBuffer"), uniforms, material };
}

// While the cut runs, the next shot (the oasis camera at this point of the
// scroll) is rendered into a target for the effect, before the composer.
export function CutPass({ J, cut }) {
  const { gl, scene, camera, size } = useThree();
  const res = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
    // (the valley's own layer, and not the forge's: config.js)
    cam.layers.enable(VALLEY_LAYER);
    cam.layers.enable(NO_MIRROR_LAYER);
    return { target, cam, pos: new THREE.Vector3(), tgt: new THREE.Vector3(), buf: new THREE.Vector2() };
  }, []);
  useEffect(() => () => res.target.dispose(), [res]);

  useFrame((state) => {
    const u = cut.uniforms;
    const t = J.cut;
    u.uT.value = t;
    u.uAspect.value = size.width / Math.max(size.height, 1);
    u.uTime.value = state.clock.elapsedTime;
    u.uGlass.value = T.cutGlass;
    u.uChroma.value = T.cutChroma;
    // (a pass doing nothing still costs a full-screen copy: off outside the cut)
    cut.pass.enabled = t > 0.0005 && t < 0.9995;
    if (t <= 0.0005 || t >= 0.9995) return;
    gl.getDrawingBufferSize(res.buf);
    if (res.target.width !== res.buf.x || res.target.height !== res.buf.y) res.target.setSize(res.buf.x, res.buf.y);
    const { cam, pos, tgt } = res;
    const fov = oasisCamera(J.progress, pos, tgt);
    // (the cursor's pull, as the CameraRig's camera will have it past the cut)
    const roll = applyMagnet(pos, tgt, 1, WATER_Y + 1.5);
    cam.position.copy(pos);
    cam.lookAt(tgt);
    if (roll !== 0) cam.rotateZ(roll);
    cam.aspect = camera.aspect;
    // (the same widening for portrait screens as the CameraRig's)
    const widen = Math.max(1, Math.pow(1 / camera.aspect, 0.6));
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * widen));
    cam.near = camera.near;
    cam.far = camera.far;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(res.target);
    gl.clear();
    gl.render(scene, cam);
    gl.setRenderTarget(prev);
    u.tB.value = res.target.texture;
  });
  return null;
}
