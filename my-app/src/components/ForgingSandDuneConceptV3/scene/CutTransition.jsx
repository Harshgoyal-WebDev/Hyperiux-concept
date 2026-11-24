"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ShaderPass } from "postprocessing";
import { T } from "../tuning";
import { valleyShot } from "./valleyShot";
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

vec3 bunqNext(vec2 uv) { return texture2D(tB, uv).rgb; }

// (bunqlabs.com's own section change, ported as it is: their transition
// shader and its settings) discs on a hexagonal grid, rising from the bottom
// with a gentle dome to the front and a little jitter; each disc a dome of
// glass refracting the next shot (uBRefract), the picture wobbling round the
// discs' rims as they run together (uBWobble), the colours splitting a touch
uniform float uStyle; // 1: this (T.cutStyle / outroStyle "bunq"), 0: the glass tiles
uniform vec2 uBRes; // the view (css px)
uniform float uBCellPx; // a disc's spacing (css px)
uniform float uBSpread;
uniform float uBJitter;
uniform float uBOvershoot;
uniform float uBRefract;
uniform float uBWobble;
uniform float uBBulge;
uniform float uBDir; // the way it sweeps: 0 from the bottom, 1 the top, 2 out from the centre, 3 diagonally, 4 from the left, 5 the right, 6 in from the edges, 7 at random
uniform float uReveal; // 1: it opens onto the page beneath (transparent), not the next shot
float bunqHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
const float DISC_TOUCH = 0.5;
const float DISC_FULL = 0.57735027;
vec2 bunqDiscCell(vec2 p, out vec2 gv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  gv = dot(a, a) < dot(b, b) ? a : b;
  return p - gv;
}
vec3 bunqDiscNormal(vec2 gv, float d, float rad) {
  float k = min(d / max(rad, 1e-4), 1.0);
  return vec3(gv / max(d, 1e-5) * k, sqrt(max(0.0, 1.0 - k * k)));
}
vec3 bunqFrom(vec2 uv, float amount) {
  vec2 o = vec2(cos(0.1), sin(0.1)) * amount;
  return vec3(texture2D(inputBuffer, uv + o).r, texture2D(inputBuffer, uv).g, texture2D(inputBuffer, uv - o).b);
}
vec3 bunqTo(vec2 uv, float amount) {
  vec2 o = vec2(cos(0.1), sin(0.1)) * amount;
  return vec3(bunqNext(uv + o).r, bunqNext(uv).g, bunqNext(uv - o).b);
}
vec4 bunqImage(vec4 inputColor, vec2 uv) {
  float ratio = uBRes.x / uBRes.y;
  float scale = uBRes.x / uBCellPx;
  vec2 p = (uv - 0.5) * vec2(1.0, 1.0 / ratio) * scale;
  vec2 gv;
  vec2 cell = bunqDiscCell(p, gv);
  vec2 cuv = cell / scale * vec2(1.0, ratio) + 0.5;
  float dome = 1.0 - abs(cuv.x - 0.5) * 2.0;
  dome = dome * dome * (3.0 - 2.0 * dome);
  float lead = (cuv.y - uBBulge * dome + uBBulge) / (1.0 + uBBulge);
  // (its sweep: the direction chosen — each still with its gentle dome)
  vec2 cq = (cuv - 0.5) * vec2(ratio, 1.0);
  float rmax = length(vec2(0.5 * ratio, 0.5));
  if (uBDir > 0.5 && uBDir < 1.5) {
    lead = (1.0 - cuv.y - uBBulge * dome + uBBulge) / (1.0 + uBBulge);
  } else if (uBDir > 1.5 && uBDir < 2.5) {
    lead = length(cq) / rmax;
  } else if (uBDir > 2.5 && uBDir < 3.5) {
    lead = (cuv.x * ratio + cuv.y) / (ratio + 1.0);
  } else if (uBDir > 3.5 && uBDir < 4.5) {
    float dy = 1.0 - abs(cuv.y - 0.5) * 2.0;
    dy = dy * dy * (3.0 - 2.0 * dy);
    lead = (cuv.x - uBBulge * dy + uBBulge) / (1.0 + uBBulge);
  } else if (uBDir > 4.5 && uBDir < 5.5) {
    float dy = 1.0 - abs(cuv.y - 0.5) * 2.0;
    dy = dy * dy * (3.0 - 2.0 * dy);
    lead = (1.0 - cuv.x - uBBulge * dy + uBBulge) / (1.0 + uBBulge);
  } else if (uBDir > 5.5 && uBDir < 6.5) {
    lead = 1.0 - length(cq) / rmax;
  } else if (uBDir > 6.5) {
    lead = bunqHash(cell * 0.37 + 3.1);
  }
  lead += (bunqHash(floor(cell * 2.0 + 0.5)) - 0.5) * uBJitter;
  lead = clamp(lead, 0.0, 1.0);
  float t = clamp(uT * (1.0 + uBSpread) - lead * uBSpread, 0.0, 1.0);
  float rad = t * (DISC_FULL + uBOvershoot);
  float domeRad = min(rad, DISC_TOUCH);
  float glass = 1.0 - smoothstep(DISC_TOUCH, DISC_FULL, rad);
  float d = length(gv);
  float aa = fwidth(d) + 1e-4;
  float cut = (1.0 - smoothstep(rad - aa, rad + aa, d)) * smoothstep(0.0, aa, rad);
  float lens = (1.0 - smoothstep(domeRad - aa, domeRad + aa, d)) * smoothstep(0.0, aa, domeRad);
  vec3 n = bunqDiscNormal(gv, d, domeRad);
  n.xy *= lens * glass;
  float rim = length(n.xy);
  float merge = smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(0.65, 1.0, t));
  uv += rim * sin(uv.y * 4.0 - uTime * 0.5) * merge * uBWobble;
  vec2 uvTo = uv + n.xy * (uBRefract / scale) * merge;
  uv = clamp(uv, 0.001, 0.999);
  uvTo = clamp(uvTo, 0.001, 0.999);
  vec3 fromC = vec3(0.0);
  vec3 toC = vec3(0.0);
  if (cut < 1.0) fromC = merge > 0.001 ? bunqFrom(uv, 0.002 * merge) : texture2D(inputBuffer, uv).rgb;
  // (opening onto the page beneath: the discs clear — premultiplied, so the
  // page shows through them as they grow and run together)
  if (uReveal > 0.5) return vec4(fromC * (1.0 - cut), 1.0 - cut);
  if (cut > 0.0) toC = merge > 0.001 ? bunqTo(uvTo, 0.002 * merge) : bunqNext(uvTo);
  return vec4(mix(fromC, toC, cut), inputColor.a);
}
uniform float uHold; // 1: once turned over, it stays the next shot (the change to the white site)
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uT <= 0.0005) {
    outputColor = inputColor;
    return;
  }
  if (uT >= 0.9995) {
    outputColor = uHold > 0.5 ? vec4(texture2D(tB, uv).rgb, inputColor.a) : inputColor;
    return;
  }
  if (uStyle > 0.5) {
    outputColor = bunqImage(inputColor, uv);
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
  // (the tiles turn over across most of the cut, not just its first half:
  // a slower, longer change over a longer scroll)
  float k = clamp((uT * 1.15 - 0.03 - delay) / 0.34, 0.0, 1.0);
  // the glass: a brief build-up ahead of the turn, strongest as it turns,
  // clearing over the new shot after (the old one is soon gone everywhere)
  float pre = smoothstep(0.0, 0.15, uT * 1.15 - delay * 0.8);
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

// the bunq hexagons' settings, from tuning.js (both changes share them)
function syncBunq(u, style, size) {
  u.uStyle.value = style === "bunq" ? 1 : 0;
  u.uBRes.value.set(size.width, Math.max(size.height, 1));
  u.uBCellPx.value = Math.max(T.transCellPx, 2);
  u.uBSpread.value = T.transSpread;
  u.uBJitter.value = T.transJitter;
  u.uBOvershoot.value = T.transOvershoot;
  u.uBRefract.value = T.transRefract;
  u.uBWobble.value = T.transWobble;
  u.uBBulge.value = T.transBulge;
}

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
    uHold: { value: 0 },
    uStyle: { value: 1 },
    uBRes: { value: new THREE.Vector2(1280, 720) },
    uBCellPx: { value: 11 },
    uBSpread: { value: 3.2 },
    uBJitter: { value: 0.05 },
    uBOvershoot: { value: 0.38 },
    uBRefract: { value: 4 },
    uBWobble: { value: 0.1 },
    uBBulge: { value: 0.115 },
    uBDir: { value: 0 },
    uReveal: { value: 0 },
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
export function CutPass({ J, cut, samples = 0 }) {
  const { gl, scene, camera, size } = useThree();
  const res = useMemo(() => {
    // (at the frame's full resolution, but not multisampled: seen through the
    // glass hexagons, its edges are softened anyway — and a second
    // multisampled full-screen render of the sand was the cut's lag)
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, samples: Math.min(samples, T.cutSamples) });
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
    // (the valley's own layer, and not the forge's: config.js)
    cam.layers.enable(VALLEY_LAYER);
    cam.layers.enable(NO_MIRROR_LAYER);
    return { target, cam, pos: new THREE.Vector3(), tgt: new THREE.Vector3(), buf: new THREE.Vector2() };
  }, [samples]);
  useEffect(() => () => res.target.dispose(), [res]);

  useFrame((state) => {
    const u = cut.uniforms;
    const t = J.cut;
    u.uT.value = t;
    u.uAspect.value = size.width / Math.max(size.height, 1);
    u.uTime.value = state.clock.elapsedTime;
    u.uGlass.value = T.cutGlass;
    u.uChroma.value = T.cutChroma;
    syncBunq(u, T.cutStyle, size);
    // (a pass doing nothing still costs a full-screen copy: off outside the cut)
    cut.pass.enabled = t > 0.0005 && t < 0.9995;
    if (t <= 0.0005 || t >= 0.9995) return;
    gl.getDrawingBufferSize(res.buf);
    // (at the frame's own resolution: drawn smaller it showed pixelated
    // through the hexagons, then snapped sharp as the cut ended)
    res.buf.floor();
    if (res.target.width !== res.buf.x || res.target.height !== res.buf.y) res.target.setSize(res.buf.x, res.buf.y);
    const { cam, pos, tgt } = res;
    // (the valley's own shot: the very one the camera carries on in after)
    const fov = valleyShot(J.progress, pos, tgt);
    // (the cursor's pull, as the CameraRig's camera will have it past the cut)
    const roll = applyMagnet(pos, tgt, T.magnetValleyOrbit, WATER_Y + 1.5, T.magnetValley);
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

// The change from the scene to the white site at the end: first the glass —
// hexagonal tiles spreading out from the centre until the whole screen is
// glass, the scene (the camera still going round the tree) bent and split
// through it — and, overlapping it a little, the white: each whole hexagon
// fading in to white, the centre's first and on outwards, mixed with
// chance (T.outroRandom), until it is all white — HDR white, so through the
// tone mapping it comes out as the site's own white — and staying white.
// (tuning.js outroGlassCover / outroWhiteFrom / outroWhiteFill / outroCell)
const OUTRO_FRAGMENT = /* glsl */ `
uniform sampler2D inputBuffer;
varying vec2 vUv;
uniform float uT; // 0..1
uniform float uAspect;
uniform float uTime;
uniform float uGlass;
uniform float uChroma;
uniform float uCell; // a tile's size (screen heights)
uniform float uCover; // the share of the change by which the glass covers the screen
uniform float uWhiteFrom; // ...at which the white starts
uniform float uWhiteFill; // ...each tile takes to fade in to white
uniform float uRandom; // 0 in rings from the centre … 1 at random
uniform vec3 uWhite;
${FRAGMENT.slice(FRAGMENT.indexOf("// pointy-top"), FRAGMENT.indexOf("vec3 bunqNext"))}
vec3 bunqNext(vec2 uv) { return uWhite; }
${FRAGMENT.slice(FRAGMENT.indexOf("// (bunqlabs.com's own"), FRAGMENT.indexOf("uniform float uHold"))}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uT <= 0.0005) { outputColor = inputColor; return; }
  if (uT >= 0.9995) { outputColor = uReveal > 0.5 ? vec4(0.0) : vec4(uWhite, inputColor.a); return; }
  if (uStyle > 0.5) { outputColor = bunqImage(inputColor, uv); return; }
  vec2 sp = (uv - 0.5) * vec2(uAspect, 1.0);
  vec4 hx = cutHex(sp / uCell);
  vec2 l = hx.xy;
  vec2 id = hx.zw;
  vec2 centre = id * vec2(1.0, 1.7320508);
  float far = min(length(centre * uCell) / length(vec2(0.5 * uAspect, 0.5)), 1.0);
  float rnd = cutHash(id);
  float rnd2 = cutHash(id + vec2(17.31, -4.7));
  // the glass: tile by tile from the centre out, the whole screen by uCover
  const float RAMP = 0.12;
  float gd = (far * 0.85 + rnd * 0.15) * max(uCover - RAMP, 0.0);
  float gIn = smoothstep(gd, gd + RAMP, uT);
  // the white: each tile its own moment, from the centre out mixed with chance
  float lin = uBDir < 0.5 ? 1.0 - uv.y : uBDir < 1.5 ? uv.y : uBDir < 2.5 ? far : uBDir < 3.5 ? (uv.x * uAspect + uv.y) / (uAspect + 1.0) : uBDir < 4.5 ? uv.x : uBDir < 5.5 ? 1.0 - uv.x : uBDir < 6.5 ? 1.0 - far : rnd2;
  float order = mix(lin, rnd2, uRandom);
  float wd = uWhiteFrom + order * max(1.0 - uWhiteFrom - uWhiteFill, 0.0);
  float w = clamp((uT - wd) / max(uWhiteFill, 0.01), 0.0, 1.0);
  w = w * w * (3.0 - 2.0 * w);
  float g = gIn * uGlass;
  // a bevelled lens, as the cut's, breathing a little (alive while the scroll rests)
  float edge = clamp(cutInHex(l) / 0.5, 0.0, 1.0);
  vec2 dirL = l / max(length(l), 1e-4);
  float bevel = pow(1.0 - edge, 2.2);
  float ph = rnd * 6.28 + uTime * 0.35;
  vec2 lens = -l * 0.32 + dirL * bevel * 0.55 + vec2(cos(ph), sin(ph)) * 0.05;
  vec2 off = lens * uCell / vec2(uAspect, 1.0) * g;
  float split = uChroma * (0.35 + bevel * 1.4) * g;
  vec3 col = cutGlass(inputBuffer, uv, off, split);
  col *= 1.0 - g * (0.18 * bevel + 0.06 * (l.y + 0.5));
  col += g * 0.04 * pow(max(dot(dirL, vec2(-0.55, 0.83)), 0.0), 3.0) * bevel * col;
  // the white: the whole tile fading in to white, evenly (no growing out
  // from its middle)
  // (HDR white: blended where the tone mapping's own curve is — x / (1 + x) —
  // so the fade reads evenly, not white at its first touch)
  if (uReveal > 0.5) { outputColor = vec4(col * (1.0 - w), 1.0 - w); return; }
  vec3 cy = col / (1.0 + col);
  vec3 wy = uWhite / (1.0 + uWhite);
  vec3 y = mix(cy, wy, w);
  outputColor = vec4(y / max(1.0 - y, 1e-3), inputColor.a);
}
`;

export const OUTRO_DIRS = ["bottom", "top", "radial", "diagonal", "left", "right", "edges", "random"];
export function createOutroPass() {
  const uniforms = {
    inputBuffer: { value: null },
    uT: { value: 0 },
    uAspect: { value: 1.6 },
    uTime: { value: 0 },
    uGlass: { value: 1 },
    uChroma: { value: 0.12 },
    uCell: { value: 0.13 },
    uCover: { value: 0.4 },
    uWhiteFrom: { value: 0.22 },
    uWhiteFill: { value: 0.3 },
    uRandom: { value: 0.55 },
    uWhite: { value: new THREE.Vector3(24, 24, 24) },
    uStyle: { value: 1 },
    uBRes: { value: new THREE.Vector2(1280, 720) },
    uBCellPx: { value: 11 },
    uBSpread: { value: 3.2 },
    uBJitter: { value: 0.05 },
    uBOvershoot: { value: 0.38 },
    uBRefract: { value: 4 },
    uBWobble: { value: 0.1 },
    uBBulge: { value: 0.115 },
    uBDir: { value: 0 },
    uReveal: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }`,
    fragmentShader: OUTRO_FRAGMENT + /* glsl */ `
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
export function OutroPass({ J, outro }) {
  const { size } = useThree();
  useFrame((state) => {
    const u = outro.uniforms;
    const t = J.outro;
    u.uT.value = t;
    u.uAspect.value = size.width / Math.max(size.height, 1);
    u.uTime.value = state.clock.elapsedTime;
    u.uGlass.value = T.outroGlass;
    u.uChroma.value = T.outroChroma;
    u.uCell.value = Math.max(T.outroCell, 0.02);
    u.uCover.value = T.outroGlassCover;
    u.uWhiteFrom.value = T.outroWhiteFrom;
    u.uWhiteFill.value = T.outroWhiteFill;
    u.uRandom.value = T.outroRandom;
    syncBunq(u, T.outroStyle, size);
    u.uBDir.value = OUTRO_DIRS.indexOf(T.outroDirection) < 0 ? 0 : OUTRO_DIRS.indexOf(T.outroDirection);
    u.uReveal.value = T.outroReveal ? 1 : 0;
    // (off until it starts; on from then, white once over)
    outro.pass.enabled = t > 0.0005;
  });
  return null;
}
