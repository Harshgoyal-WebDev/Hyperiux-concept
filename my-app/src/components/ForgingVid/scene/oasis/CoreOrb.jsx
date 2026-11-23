"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { T } from "../../tuning";
import { TREE, WATER_Y } from "../../world/oasis";
import { cubeY } from "../../world/oasisCamera";
import { RIVULET_PN } from "./Rivulets";
import { arrivalAt, treeSamples } from "../../world/treeSamples";
import OrbRain, { RAIN, skidRadius } from "./OrbRain";

// the pour's timing and spread (local: tuning.js is someone else's). Shares
// of the burst (T.orbBurstSpan of the scroll from the beam's touch).
const POUR = {
  runners: 0.3, // share of the poured threads that run out along the reveal's rivulets (the rest skid out over the ground)
  from: 0.01, // the first skidding threads let go this far into the burst...
  spread: 0.34, // ...the last this much later (its underside first)
  trail: 0.035, // a thread's tail lets go this long after its head (drawn out into a falling strand)
  fall: RAIN.fall, // the fall from the top of the orb to the ground
  skid: 0.27, // the skid on out over the ground, slowing (± 25%)
  reach: RAIN.reach, // how far out they skid (m: the disc's soft radius)
  chase: 260, // m per burst: a thread landed on a rivulet runs on along it this fast to catch its front
};

// The core at the lake's heart (after the reference, hyperiux-concepts V6's
// orb): a ball of light hanging over the bare basin — thousands of motes
// running in threads round its shell, wavering in and out of it a little,
// so it reads as wisps of light in a glass ball — with our glowing cube
// waiting inside it, and a soft halo round it. As the beam comes in it
// gathers itself (drawing in a little, turning faster, brightening); as the
// beam touches it, it lets go, as the reference's does: it drains, its
// underside first, nearly all its threads pouring down off it over the
// burst; most land under it and skid on out over the ground, spreading its
// light over the whole island and on (with OrbRain.jsx's curtain of sparks),
// and the first down land on the inward ends of the reveal's rivulets and
// run on out along them at their front: the rivulets' running heads
// (Rivulets.jsx, the V2 reveal, the same lines), the oasis coming up
// behind; a few are thrown out or rise away. The cube stays, glowing, and as the tree grows past it it
// melts into it: it comes apart from its edges in threads of light that
// spiral up round the trunk onto the strands, each reaching its strand just
// as the strand's growing tip does (T.cubeFadeFrom → cubeFadeTo of the
// growth; world/treeSamples.js).
//
// All of it on the scroll (the gathering: the beam's run in, tuning.js
// tlBeamToTreeStart → End; the burst: from the touch over T.orbBurstSpan),
// so it plays back as the page scrolls back; only the turning runs on
// real time, so it is never frozen.

const VERTEX = /* glsl */ `
attribute vec4 aA; // thread axis (xyz), its latitude (w)
attribute vec4 aB; // a second axis, square to it (xyz), the mote's place along the thread (w)
attribute vec4 aS; // speed, latitude waver, its rate, its phase
attribute vec4 aD; // inset (share of the radius), width (m), brightness, seed
attribute vec4 aR; // role (0 ring, 1 thrown out, 2 rising, 3 pouring down and skidding out, 4 pouring down onto a rivulet), when it lets go (share of the burst), jitter, tube side (pouring: its heading out over the ground)
attribute vec4 aE; // pouring: its rivulet (row), its place along its thread (0 head … 1 tail), offset across (m), how far out it skids (m)
uniform sampler2D uPaths;
uniform float uLand; // the burst's share at which the poured light lands: as the reveal starts (tuning.js tlRevealStart)
uniform float uHand; // how far out along its rivulet the poured light runs before the rivulet's own threads carry on (m)
uniform float uTime;
uniform vec3 uC;
uniform float uR;
uniform float uCharge;
uniform float uBurst;
uniform float uRing;
uniform float uGround; // the ground's height under the orb
uniform float uSpread; // how far the poured light splashes out over the ground (x)
uniform float uRevealR; // the oasis's reveal: how far its front has spread (m) — the poured light runs out with it
uniform float uGain;
uniform float uAspect;
uniform float uPx;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec3 vCol;
varying vec2 vQ;
varying float vL;

vec3 shellAt(float t, float R) {
  vec3 A = aA.xyz;
  vec3 B = aB.xyz;
  vec3 C = cross(A, B);
  float th = aB.w + aS.x * t;
  float hh = clamp(aA.w + aS.y * sin(aS.z * th + aS.w + 0.6 * t), -0.97, 0.97);
  float r = R * (1.0 - aD.x);
  float s = sqrt(1.0 - hh * hh);
  return uC + r * (A * hh + (B * cos(th) + C * sin(th)) * s);
}
uniform float uFall; // how long a thread takes to fall from the top of the orb to the ground (share of the burst)
uniform float uSkid; // ...and to skid on out over the ground after (share of the burst)
uniform float uTrail; // how long after its head a thread's tail lets go (share of the burst)
uniform float uChase; // how fast a thread landed on a rivulet runs on along it to its front (m per burst)
const float PN = ${RIVULET_PN.toFixed(1)};
// the island's ground (world/oasis.js floorHeight: barely above the lake,
// rising to the trunk's foot), and the water's skin beyond it
float groundY(float r) {
  return max(${WATER_Y.toFixed(3)} + 0.08 + 0.7 * (1.0 - smoothstep(6.0, 42.0, r)), ${WATER_Y.toFixed(3)} + 0.22) + 0.16;
}
// a rivulet at arc length s (Rivulets.jsx's lines): where, and which way
vec3 pathAt(int row, float s, float L, out vec2 dir) {
  float u = clamp(s / L, 0.0, 1.0) * (PN - 1.0);
  float i = min(floor(u), PN - 2.0);
  float f = u - i;
  vec4 a = texelFetch(uPaths, ivec2(int(i), row), 0);
  vec4 b = texelFetch(uPaths, ivec2(int(i) + 1, row), 0);
  float da = b.w - a.w;
  da -= 6.2831853 * floor(da / 6.2831853 + 0.5);
  float ang = a.w + da * f;
  dir = vec2(cos(ang), sin(ang));
  return mix(a.xyz, b.xyz, f);
}
// where the mote is at burst b and time t, and how lit
vec3 moteAt(float b, float t, out float lit) {
  float c = uCharge;
  vec3 sh = shellAt(t + 1.6 * c, uR * (1.0 - 0.12 * c));
  float shellLit = 1.0 + 0.5 * c;
  vec2 out2 = normalize(sh.xz - uC.xz + 1e-4);
  if (aR.x > 2.5) {
    // pouring down off it, as water over a ledge: out a little, then down —
    // slow at first, falling faster (the higher it leaves, the longer it
    // falls) — its underside first, the rest after, over the burst, each
    // thread pulled off the ball head first, its motes following (uTrail),
    // so it drains in a stream of falling threads rather than all at once.
    // Most then skid on out over the ground from where they land (under the
    // orb, anywhere in a disc round its foot), slowing — spreading the light
    // over the whole island and on (OrbRain.jsx's sparks do the same); the
    // first down (role 4) land on the inward end of one of the reveal's
    // rivulets and run on out along it at its running front (the reveal's
    // clock, as Rivulets.jsx's own threads: the same line, the same reach),
    // until the rivulet's threads carry on (uHand)
    float along = aE.y;
    bool run = aR.x > 3.5;
    // (the rivulets' threads let go first, so they are down as the reveal
    // sets off: uLand)
    float leave = (run ? aR.y * uLand : aR.y) + along * uTrail;
    if (b <= leave) { lit = shellLit; return sh; }
    vec2 dir;
    vec3 land;
    vec4 m;
    int row = int(aE.x);
    float sIn = 0.0;
    vec2 sd = vec2(cos(aR.w), sin(aR.w));
    float rL = uR * (0.08 + 1.05 * aR.z);
    if (run) {
      // (on the rivulet's line drawn on in towards the foot: the light runs
      // out from under the orb, not from a ring round it)
      m = texelFetch(uPaths, ivec2(int(PN), row), 0); // t0, dur, L
      land = pathAt(row, 0.0, m.z, dir);
      sIn = 5.5 * aR.z;
      land.xz += -dir * sIn + vec2(-dir.y, dir.x) * aE.z * 0.6;
      land.y = max(land.y + 0.18, groundY(length(land.xz - uC.xz)));
    } else {
      land = vec3(uC.x + sd.x * rL, 0.0, uC.z + sd.y * rL);
      land.xz += vec2(-sd.y, sd.x) * aE.z * 0.4;
      land.y = groundY(length(land.xz - uC.xz));
    }
    float tf = uFall * sqrt(max(sh.y - land.y, 0.5) / 14.0) * (0.85 + 0.3 * fract(aR.w * 7.31));
    float k = (b - leave) / tf;
    if (k < 1.0) {
      vec3 p;
      p.xz = mix(sh.xz, land.xz, 1.0 - (1.0 - k) * (1.0 - k)) + out2 * sin(3.14159 * k) * uR * 0.12;
      p.y = mix(sh.y, land.y, k * k);
      lit = (1.1 + 0.5 * k) * shellLit;
      return p;
    }
    float since = b - leave - tf;
    if (!run) {
      // skidding out over the ground, fast at first and slowing, curling a
      // little, the thread drawn out behind its head into a streak
      float x = clamp(since / (uSkid * (0.75 + 0.5 * fract(aR.w * 3.17))), 0.0, 1.0);
      float rF = max(aE.w, rL + 3.0);
      float e = 1.0 - pow(1.0 - x, 3.0);
      float r = mix(rL, rF, e);
      float a = aR.w + (fract(aD.w * 5.3) - 0.5) * 0.3 * e;
      vec3 p = vec3(uC.x + cos(a) * r, 0.0, uC.z + sin(a) * r);
      p.xz += vec2(-sin(a), cos(a)) * aE.z * 0.4 * (1.0 + 2.0 * e);
      p.y = groundY(r);
      lit = (1.7 * exp(-8.0 * x) + 0.7) * (1.0 - smoothstep(0.45, 1.0, x)) * (1.0 - 0.5 * along);
      return p;
    }
    float bb = since / max(1.0 - leave - tf, 0.05);
    float x = clamp((uRevealR - m.x) / max(m.y, 1e-3), 0.0, 1.0);
    float reach = m.z * (1.0 - (1.0 - x) * (1.0 - x));
    // (a little splash on along it as it lands, before the clock has it; and
    // running on from where it landed to catch up with the front)
    float splash = (1.0 - exp(-5.0 * bb)) * uR * 0.5 * uSpread;
    float trail = along * (6.0 + 14.0 * aR.z) * uSpread;
    float s = max(min(-sIn + since * uChase, max(reach, splash) - trail), -sIn);
    vec3 p = pathAt(row, max(s, 0.0), m.z, dir);
    // (short of the rivulet's start: on its line drawn on in towards the foot)
    p.xz += dir * min(s, 0.0);
    p.xz += vec2(-dir.y, dir.x) * (aE.z * 0.6 + sin(s * 0.35 + aD.w * 30.0 + t * 0.9) * 0.3 * smoothstep(0.0, 6.0, s));
    p.y = max(p.y + 0.18, groundY(length(p.xz - uC.xz)));
    lit = (1.5 * exp(-bb * 3.0) + 0.9) * (1.0 - smoothstep(uHand * 0.45, uHand, s)) * (1.0 - 0.6 * along);
    return p;
  }
  float a = (b - aR.y) / max(1.0 - aR.y, 0.05);
  if (a <= 0.0) { lit = shellLit; return sh; }
  a = clamp(a, 0.0, 1.0);
  if (aR.x < 0.5) {
    // the ring: a fat ring of light rolling out round it, swelling and
    // slowing, rising a little, thinning out
    float e = 1.0 - pow(1.0 - a, 2.2);
    float Rt = uR * (1.0 + (2.2 + 1.4 * aR.z) * e * uRing);
    float rt = uR * (0.25 + 0.8 * e) * abs(aR.w);
    float be = aD.w * 6.2831 + sign(aR.w) * (t * 0.3 + a * 4.0);
    float al = atan(out2.y, out2.x) + 0.15 * sin(t * 0.3 + aD.w * 6.0) * e;
    vec3 ring = vec3(uC.x, uC.y + uR * 0.25 * e, uC.z) + vec3(cos(al), 0.0, sin(al)) * (Rt + rt * cos(be)) + vec3(0.0, rt * sin(be) * 0.7, 0.0);
    lit = mix(shellLit, 1.3, smoothstep(0.0, 0.3, a)) * (1.0 - smoothstep(0.45, 1.0, a));
    return mix(sh, ring, smoothstep(0.0, 0.25, a));
  }
  if (aR.x < 1.5) {
    // thrown out: away from its place on the shell, slowing, falling a little
    float e = 1.0 - pow(1.0 - a, 2.6);
    vec3 dir = normalize(sh - uC);
    vec3 p = sh + dir * uR * (2.5 + 2.5 * aR.z) * e * uRing;
    p.y -= uR * 0.8 * a * a;
    lit = 1.2 * (1.0 - smoothstep(0.3, 0.9, a));
    return p;
  }
  // rising away, drifting
  float e = 1.0 - pow(1.0 - a, 1.6);
  vec3 p = sh + vec3(out2.x, 0.0, out2.y) * uR * 1.2 * e + vec3(0.0, uR * (2.0 + 2.0 * aR.z) * e, 0.0);
  p.xz += vec2(sin(t * 0.5 + aD.w * 9.0), cos(t * 0.4 + aD.w * 7.0)) * uR * 0.15 * e;
  lit = 0.7 * (1.0 - smoothstep(0.4, 1.0, a));
  return p;
}

void main() {
  float lit;
  vec3 p1 = moteAt(uBurst, uTime, lit);
  float bright = aD.z * lit * uGain * (0.78 + 0.22 * sin(uTime * (2.0 + 3.0 * aD.w) + aD.w * 40.0));
  if (bright < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // where it was a moment before (a short streak along its own motion)
  float lit0;
  vec3 p0 = moteAt(max(uBurst - 0.012, 0.0), uTime - 0.22, lit0);
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 c1 = vp * vec4(p1, 1.0);
  vec4 c0 = vp * vec4(p0, 1.0);
  if (c1.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (c0.w < 0.05) c0 = c1;
  vec2 s1 = c1.xy / c1.w;
  vec2 s0 = c0.xy / c0.w;
  vec2 d = (s1 - s0) * vec2(uAspect, 1.0);
  float len = length(d);
  if (len > 0.05) { s0 = s1 - (s1 - s0) * (0.05 / len); d *= 0.05 / len; len = 0.05; }
  vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float wr = aD.y * projectionMatrix[1][1] / c1.w;
  wr = min(wr, 0.012);
  float w = max(wr, uPx * 0.9);
  bright *= clamp(wr / w, 0.5, 1.0);
  float x = position.x;
  float y = position.y;
  vec4 cc = mix(c0, c1, x);
  vec2 off2 = (nrm * y + dir * (x * 2.0 - 1.0)) * w;
  off2.x /= uAspect;
  gl_Position = vec4((mix(s0, s1, x) + off2) * cc.w, cc.z, cc.w);
  vL = len / w;
  vQ = vec2(mix(-1.0, vL + 1.0, x), y);
  // deep orange in the thin parts, a brighter, yellower orange where it is lit
  vCol = mix(uColor, uHot, clamp(0.3 * lit + 0.5 * aD.z - 0.2, 0.0, 1.0)) * bright / (1.0 + 0.1 * vL);
}
`;
const FRAGMENT = /* glsl */ `
varying vec3 vCol;
varying vec2 vQ;
varying float vL;
void main() {
  float dx = max(-vQ.x, 0.0) + max(vQ.x - vL, 0.0);
  float r = length(vec2(dx, vQ.y));
  if (r > 1.0) discard;
  float a = 1.0 - smoothstep(0.15, 1.0, r);
  float head = mix(0.35, 1.0, clamp(vQ.x / max(vL, 1e-3), 0.0, 1.0));
  gl_FragColor = vec4(vCol * a * a * head * 0.5, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// the halo round it, the warm heart, the faint ring as it gathers, and the
// flash as it lets go (a camera-facing square, six radii across)
const HALO_VERTEX = /* glsl */ `
uniform float uR;
uniform vec2 uStretch;
varying vec2 vQ;
void main() {
  vQ = position.xy * 2.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uR * 6.0 * uStretch;
  gl_Position = projectionMatrix * mv;
}
`;
const HALO_FRAGMENT = /* glsl */ `
uniform vec3 uCol;
uniform float uCore;
uniform float uFlash;
uniform float uOuter;
varying vec2 vQ;
void main() {
  float r = length(vQ) * 3.0;
  float edge = 1.0 - smoothstep(0.55, 1.0, length(vQ));
  // (kept close round the ball: no wide wash of light over the scene)
  float glow = exp(-r * r * 1.4) * 0.3 + exp(-r * 3.0) * 0.08;
  float rim = exp(-pow((r - 0.9) / 0.09, 2.0)) * 0.12;
  vec3 col = uCol * (glow + rim);
  col += vec3(1.0, 0.45, 0.16) * uCore * exp(-r * r * 3.0) * 0.22;
  col += vec3(1.0, 0.82, 0.62) * uFlash * (exp(-r * r * 0.6) + 0.4 * exp(-r * 0.8));
  gl_FragColor = vec4(col * edge, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
// the wave of light out across the horizon as it lets go (a wide, flat band)
const WAVE_FRAGMENT = /* glsl */ `
uniform vec3 uCol;
uniform float uFlash;
uniform float uSpread;
varying vec2 vQ;
void main() {
  vec2 q = vQ;
  float across = exp(-pow(q.y / (0.18 + 0.25 * uSpread), 2.0));
  float along = 1.0 - smoothstep(0.2 + 0.75 * uSpread, 1.0, abs(q.x));
  float a = across * along * uFlash;
  gl_FragColor = vec4(uCol * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// our cube, filled and glowing, its outline white-hot (as the seed cube was)
const CUBE_VERTEX = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const CUBE_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uGlow;
uniform float uShow;
uniform float uMelt; // 0 whole … 1 melted away into the tree's threads
varying vec3 vLocal;
float cubeHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float cubeNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(cubeHash(i), cubeHash(i + vec3(1, 0, 0)), f.x), mix(cubeHash(i + vec3(0, 1, 0)), cubeHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(cubeHash(i + vec3(0, 0, 1)), cubeHash(i + vec3(1, 0, 1)), f.x), mix(cubeHash(i + vec3(0, 1, 1)), cubeHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
void main() {
  // melting: it comes apart in flecks from its edges inwards, glowing hot
  // at the edge of what is left (the threads leave from there)
  float n = 0.6 * cubeNoise(vLocal * 7.0) + 0.4 * cubeNoise(vLocal * 17.0 + 3.1);
  float shellD = 1.0 - max(abs(vLocal.x), max(abs(vLocal.y), abs(vLocal.z))) * 2.0;
  float keep = n * 0.7 + 0.3 * (1.0 - shellD) - uMelt * 1.15 + 0.15;
  if (uMelt > 0.0 && keep < 0.0) discard;
  float burn = uMelt > 0.0 ? 1.0 - smoothstep(0.0, 0.12, keep) : 0.0;
  vec3 q = abs(vLocal) * 2.0;
  float big = max(q.x, max(q.y, q.z));
  float small = min(q.x, min(q.y, q.z));
  float e = q.x + q.y + q.z - big - small;
  float w = fwidth(e);
  float line = smoothstep(0.92 - w, 0.92 + w, e);
  float hot = smoothstep(0.96, 1.0, e);
  vec3 face = uColor * (0.75 + 0.35 * smoothstep(0.2, 1.0, e));
  vec3 col = mix(face, mix(uColor * 1.6, vec3(1.0, 0.9, 0.78), hot * 0.6), line);
  col = mix(col, vec3(1.0, 0.82, 0.6) * 2.2, burn);
  float a = mix(0.92, 1.0, max(line, burn)) * uShow;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * uGlow, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// The cube melting into the tree: threads of light off its edges, each
// spiralling up round the trunk onto a point of the strands, getting there
// as that strand's growing tip does (the growth's own clock, uGrow) — so
// the cube feeds the tree's growth as it comes apart.
const MELT_VERTEX = /* glsl */ `
attribute vec4 aP; // where it leaves the cube (its own space, ±0.5), its place along its thread (0 head … 1 tail)
attribute vec4 aQ; // where it goes on the tree (world), the growth at which it gets there
attribute vec4 aW; // width (m), brightness, seed, turns round the trunk (signed)
uniform mat4 uCube;
uniform vec3 uAxis;
uniform float uGrow;
uniform float uTravel;
uniform float uTime;
uniform float uGain;
uniform float uAspect;
uniform float uPx;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec3 vCol;
varying vec2 vQ;
varying float vL;

vec3 meltAt(float g, float t, out float lit) {
  float f = (g - (aQ.w - uTravel)) / max(uTravel, 1e-3) - aP.w * 0.14;
  vec3 c0 = (uCube * vec4(aP.xyz, 1.0)).xyz;
  if (f <= 0.0) { lit = 0.0; return c0; }
  float e = clamp(f, 0.0, 1.0);
  e = e * e * (3.0 - 2.0 * e);
  // round the trunk's axis: from its angle, radius and height on the cube
  // to the strand's, the long way round, bowing out on the way
  vec2 r0 = c0.xz - uAxis.xz;
  vec2 r3 = aQ.xz - uAxis.xz;
  float a0 = atan(r0.y, r0.x);
  float a3 = atan(r3.y, r3.x);
  float da = a3 - a0;
  da -= 6.2831853 * floor(da / 6.2831853 + 0.5);
  da += aW.w * 6.2831853;
  float ang = a0 + da * e + 0.05 * sin(t * 0.8 + aW.z * 20.0) * sin(3.14159 * e);
  float rad = mix(length(r0), length(r3), e) + sin(3.14159 * e) * (3.0 + 6.0 * fract(aW.z * 7.3));
  float y = mix(c0.y, aQ.y, e) + sin(3.14159 * e) * (1.0 + 2.0 * fract(aW.z * 3.1));
  // (bright as it leaves, fading into the strand as it gets there)
  lit = (0.9 + 1.4 * exp(-f * 5.0)) * (1.0 - smoothstep(0.9, 1.15, f)) * (1.0 - 0.5 * aP.w);
  return vec3(uAxis.x + cos(ang) * rad, y, uAxis.z + sin(ang) * rad);
}

void main() {
  float lit;
  vec3 p1 = meltAt(uGrow, uTime, lit);
  float bright = aW.y * lit * uGain;
  if (bright < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float lit0;
  vec3 p0 = meltAt(uGrow - uTravel * 0.05, uTime - 0.2, lit0);
  if (lit0 <= 0.0) p0 = p1;
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 c1 = vp * vec4(p1, 1.0);
  vec4 c0 = vp * vec4(p0, 1.0);
  if (c1.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (c0.w < 0.05) c0 = c1;
  vec2 s1 = c1.xy / c1.w;
  vec2 s0 = c0.xy / c0.w;
  vec2 d = (s1 - s0) * vec2(uAspect, 1.0);
  float len = length(d);
  if (len > 0.04) { s0 = s1 - (s1 - s0) * (0.04 / len); d *= 0.04 / len; len = 0.04; }
  vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float wr = aW.x * projectionMatrix[1][1] / c1.w;
  wr = min(wr, 0.01);
  float w = max(wr, uPx * 0.9);
  bright *= clamp(wr / w, 0.5, 1.0);
  float x = position.x;
  float yy = position.y;
  vec4 cc = mix(c0, c1, x);
  vec2 off2 = (nrm * yy + dir * (x * 2.0 - 1.0)) * w;
  off2.x /= uAspect;
  gl_Position = vec4((mix(s0, s1, x) + off2) * cc.w, cc.z, cc.w);
  vL = len / w;
  vQ = vec2(mix(-1.0, vL + 1.0, x), yy);
  vCol = mix(uColor, uHot, clamp(0.45 * lit, 0.0, 1.0)) * bright / (1.0 + 0.1 * vL);
}
`;

// the melt's threads: each a run of motes along one of the cube's edges,
// going to one point of the strands. Where they go depends on the growth's
// own timing and on when the cube melts (tuning.js), so it is (re)laid out
// when those change, or the tree's strands come in.
const EDGE_AXIS = [0, 1, 2];
function meltGeometry(threads, perThread) {
  const n = threads * perThread;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute("aP", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
  g.setAttribute("aQ", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
  g.setAttribute("aW", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
  g.instanceCount = n;
  g.userData = { threads, perThread };
  return g;
}
function layOutMelt(g, from, to, travel, jitter) {
  const { threads, perThread } = g.userData;
  const P_ = g.getAttribute("aP").array;
  const Q = g.getAttribute("aQ").array;
  const W = g.getAttribute("aW").array;
  // the strands' points, by when their growing tip reaches them
  let pts = null;
  if (treeSamples.pts) {
    const src = treeSamples.pts;
    pts = [];
    for (let i = 0; i < treeSamples.count; i++) pts.push([src[i * 5], src[i * 5 + 1], src[i * 5 + 2], arrivalAt(src[i * 5 + 3], src[i * 5 + 4], jitter)]);
    pts.sort((a, b) => a[3] - b[3]);
  }
  let seed = 31;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  let k = 0;
  for (let i = 0; i < threads; i++) {
    // when it leaves the cube (spread over the melt), and so when it gets there
    const leave = lo + (hi - lo) * ((i + rnd()) / threads);
    const want = Math.min(leave + travel, 1);
    let q;
    if (pts && pts.length) {
      let a = 0;
      let b = pts.length - 1;
      while (a < b) {
        const m = (a + b) >> 1;
        if (pts[m][3] < want) a = m + 1;
        else b = m;
      }
      const j = Math.min(Math.max(a + Math.round((rnd() - 0.5) * 40), 0), pts.length - 1);
      q = [pts[j][0], pts[j][1], pts[j][2], Math.max(pts[j][3], leave + travel * 0.5)];
    } else {
      // (no strands yet: round the trunk at the height the growth is at)
      const climb = want * (1 + jitter) - 0.5 * jitter;
      const ang = rnd() * Math.PI * 2;
      const r = 4 + rnd() * 8;
      q = [TREE.x + Math.cos(ang) * r, WATER_Y - 0.5 + (climb * 47.4 - 4.5) * (TREE.height / 40), TREE.z + Math.sin(ang) * r, want];
    }
    // off one of its twelve edges
    const axis = EDGE_AXIS[i % 3];
    const sA = rnd() < 0.5 ? -0.5 : 0.5;
    const sB = rnd() < 0.5 ? -0.5 : 0.5;
    const t0 = rnd() * 0.8 - 0.4;
    const turns = (0.35 + rnd() * 0.6) * (rnd() < 0.5 ? -1 : 1);
    const ws = rnd();
    for (let j = 0; j < perThread; j++, k++) {
      const along = j / Math.max(perThread - 1, 1);
      const e = THREE.MathUtils.clamp(t0 + along * 0.18, -0.5, 0.5);
      const c = [0, 0, 0];
      c[axis] = e;
      c[(axis + 1) % 3] = sA;
      c[(axis + 2) % 3] = sB;
      P_.set([c[0], c[1], c[2], along], k * 4);
      Q.set(q, k * 4);
      const mid = Math.sin(along * Math.PI * 0.5 + Math.PI * 0.5);
      W.set([0.13 + 0.09 * rnd(), (0.45 + 0.55 * mid) * (0.6 + 0.4 * rnd()), ws, turns], k * 4);
    }
  }
  g.getAttribute("aP").needsUpdate = true;
  g.getAttribute("aQ").needsUpdate = true;
  g.getAttribute("aW").needsUpdate = true;
}

// the threads: each a run of motes along one path round the shell
function buildMotes(threads, perThread, rivulets) {
  const n = threads * perThread;
  const A = new Float32Array(n * 4);
  const B = new Float32Array(n * 4);
  const S = new Float32Array(n * 4);
  const D = new Float32Array(n * 4);
  const R = new Float32Array(n * 4);
  const E = new Float32Array(n * 4);
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < threads; i++) {
    a.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    tmp.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    b.crossVectors(a, tmp).normalize();
    const lat = (rnd() * 2 - 1) * 0.85;
    const t0 = rnd() * Math.PI * 2;
    const speed = (0.25 + rnd() * 0.45) * (rnd() < 0.5 ? -1 : 1);
    const wav = 0.04 + rnd() * 0.2;
    const freq = 1 + rnd() * 2;
    const ph = rnd() * 6.28;
    const inset = rnd() * 0.07;
    const roll = rnd();
    // (nearly all of it pours down onto the rivulets; a few are thrown out
    // or rise away — no ring rolling out round it: one spread, the rivulets')
    // (of the pour, a share runs out along the rivulets — role 4 — the rest
    // skids out over the ground — role 3)
    const role = roll < 0.9 ? (rnd() < POUR.runners ? 4 : 3) : roll < 0.95 ? 1 : 2;
    const row = Math.min(Math.floor(rnd() * rivulets), rivulets - 1);
    const across = (rnd() - 0.5) * 2.4;
    const jit = rnd();
    // (pouring: which way it heads out over the ground — off the side of the
    // ball its thread runs round, near enough)
    const cx = a.x * lat;
    const cz = a.z * lat;
    const side = role >= 3 ? (Math.hypot(cx, cz) > 0.15 ? Math.atan2(cz, cx) : 0) + (rnd() - 0.5) * 1.2 : (rnd() * 2 - 1) || 0.5;
    // when it lets go: the rivulets' threads first (a share of uLand); the
    // rest over the burst, its underside first
    const low = (a.y * lat / 0.85 + 1) / 2;
    const lead = role === 4 ? rnd() * 0.55 : role === 3 ? POUR.from + POUR.spread * Math.min(0.6 * low + 0.4 * rnd(), 1) : rnd() * 0.12;
    const far = skidRadius(rnd(), POUR.reach);
    const spacing = 0.025 + rnd() * 0.02;
    for (let j = 0; j < perThread; j++, k++) {
      A.set([a.x, a.y, a.z, lat], k * 4);
      B.set([b.x, b.y, b.z, t0 + j * spacing], k * 4);
      S.set([speed, wav, freq, ph], k * 4);
      // (brightest mid-thread, fading at its ends)
      const mid = Math.sin((j / Math.max(perThread - 1, 1)) * Math.PI);
      D.set([inset, 0.05 + rnd() * 0.05, (0.35 + 0.65 * mid) * (0.6 + 0.4 * rnd()), rnd()], k * 4);
      R.set([role, role >= 3 ? lead : lead + rnd() * 0.04, jit, side], k * 4);
      E.set([row, j / Math.max(perThread - 1, 1), across + (rnd() - 0.5) * 0.4, far], k * 4);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 4));
  g.setAttribute("aB", new THREE.InstancedBufferAttribute(B, 4));
  g.setAttribute("aS", new THREE.InstancedBufferAttribute(S, 4));
  g.setAttribute("aD", new THREE.InstancedBufferAttribute(D, 4));
  g.setAttribute("aR", new THREE.InstancedBufferAttribute(R, 4));
  g.setAttribute("aE", new THREE.InstancedBufferAttribute(E, 4));
  g.instanceCount = n;
  return g;
}

const sm = (a, b, x) => THREE.MathUtils.smoothstep(x, a, Math.max(b, a + 1e-4));

export default function CoreOrb({ J, shared, tier, paths, rivulets }) {
  const { gl, size } = useThree();
  const parts = useMemo(() => {
    const threads = Math.round((tier?.name === "low" ? 260 : tier?.name === "medium" ? 420 : 560) * 1);
    const geometry = buildMotes(threads, 36, rivulets);
    const moteU = {
      uTime: shared.uTime,
      uPaths: { value: paths },
      uHand: { value: 220 },
      uLand: { value: 0.43 },
      uFall: { value: POUR.fall },
      uSkid: { value: POUR.skid },
      uTrail: { value: POUR.trail },
      uChase: { value: POUR.chase },
      uC: { value: new THREE.Vector3() },
      uR: { value: 6 },
      uCharge: { value: 0 },
      uBurst: { value: 0 },
      uRing: { value: 1 },
      uGround: { value: 0 },
      uSpread: { value: 1 },
      uRevealR: { value: 0 },
      uGain: { value: 1 },
      uAspect: { value: 1 },
      uPx: { value: 0.002 },
      uColor: { value: new THREE.Color() },
      uHot: { value: new THREE.Color() },
    };
    const motes = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({ uniforms: moteU, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    motes.frustumCulled = false;
    motes.renderOrder = 20;
    const plane = new THREE.PlaneGeometry(1, 1);
    const haloU = { uR: { value: 6 }, uStretch: { value: new THREE.Vector2(1, 1) }, uCol: { value: new THREE.Color() }, uCore: { value: 0 }, uFlash: { value: 0 }, uOuter: { value: 0 } };
    // (not cut by the ground in front of it: no hard line across the sand)
    const halo = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: haloU, vertexShader: HALO_VERTEX, fragmentShader: HALO_FRAGMENT, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    halo.frustumCulled = false;
    halo.renderOrder = 21;
    const waveU = { uR: { value: 6 }, uStretch: { value: new THREE.Vector2(8, 1.2) }, uCol: { value: new THREE.Color() }, uFlash: { value: 0 }, uSpread: { value: 0 } };
    const wave = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: waveU, vertexShader: HALO_VERTEX, fragmentShader: WAVE_FRAGMENT, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    wave.frustumCulled = false;
    wave.renderOrder = 22;
    const cubeU = { uColor: { value: new THREE.Color() }, uGlow: { value: 1 }, uShow: { value: 0 }, uMelt: { value: 0 } };
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.ShaderMaterial({ uniforms: cubeU, vertexShader: CUBE_VERTEX, fragmentShader: CUBE_FRAGMENT, transparent: true, depthWrite: false }));
    cube.renderOrder = 19;
    cube.frustumCulled = false;
    // the cube's melt into the tree
    const meltG = meltGeometry(tier?.name === "low" ? 160 : tier?.name === "medium" ? 260 : 360, 22);
    const meltU = {
      uCube: { value: new THREE.Matrix4() },
      uAxis: { value: new THREE.Vector3(TREE.x, 0, TREE.z) },
      uGrow: { value: 0 },
      uTravel: { value: 0.12 },
      uTime: shared.uTime,
      uGain: { value: 1 },
      uAspect: { value: 1 },
      uPx: { value: 0.002 },
      uColor: { value: new THREE.Color() },
      uHot: { value: new THREE.Color() },
    };
    const melt = new THREE.Mesh(meltG, new THREE.ShaderMaterial({ uniforms: meltU, vertexShader: MELT_VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    melt.frustumCulled = false;
    melt.renderOrder = 20;
    const group = new THREE.Group();
    group.add(cube, motes, halo, wave, melt);
    group.visible = false;
    return { group, motes, moteU, halo, haloU, wave, waveU, cube, cubeU, plane, melt, meltU, meltKey: { v: "" } };
  }, [shared, tier, paths, rivulets]);
  useEffect(
    () => () => {
      parts.motes.geometry.dispose();
      parts.motes.material.dispose();
      parts.plane.dispose();
      parts.halo.material.dispose();
      parts.wave.material.dispose();
      parts.cube.geometry.dispose();
      parts.cube.material.dispose();
      parts.melt.geometry.dispose();
      parts.melt.material.dispose();
    },
    [parts]
  );

  const ORANGE = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const p = J.progress;
    const t = clock.elapsedTime;
    const touch = T.tlBeamToTreeEnd;
    const show = sm(T.tlOrbShow - 0.01, T.tlOrbShow, p);
    // the gathering (as the beam comes in) and the burst (from its touch)
    const charge = sm(T.tlBeamToTreeStart, touch, p);
    const burst = THREE.MathUtils.clamp((p - touch) / Math.max(T.orbBurstSpan, 0.002), 0, 1);
    const span0 = Math.max(T.tlTreeGrowEnd - T.tlTreeGrowStart, 0.002);
    const grow = (p - T.tlTreeGrowStart) / span0;
    // (the cube, and its threads on their way up into the tree)
    const cubeOn = grow < Math.max(T.cubeFadeTo, T.cubeFadeFrom) + T.cubeMeltTravel * 1.2;
    const pouring = burst > 0 && J.revealR < 140;
    const on = (show > 0.001 && (burst < 0.999 || cubeOn || pouring)) || J.warmup > 0;
    parts.group.visible = on;
    if (!on) return;
    const R = T.orbRadius;
    const centre = parts.moteU.uC.value.set(TREE.x, cubeY(), TREE.z);
    parts.group.position.set(0, 0, 0);
    // the threads
    const mu = parts.moteU;
    mu.uR.value = R;
    mu.uCharge.value = charge;
    mu.uBurst.value = burst;
    mu.uRing.value = T.orbRingSize;
    mu.uGround.value = WATER_Y + 0.85;
    mu.uSpread.value = T.orbPourSpread;
    mu.uRevealR.value = J.revealR;
    mu.uHand.value = T.orbPourReach;
    // (landing as the reveal starts — whatever its start: the fall and the
    // rivulets are one; tlRevealStart before the touch drops it at once)
    mu.uLand.value = THREE.MathUtils.clamp((T.tlRevealStart - touch) / Math.max(T.orbBurstSpan, 0.002), 0.06, 1);
    mu.uGain.value = T.orbGlow * show;
    mu.uAspect.value = size.width / Math.max(size.height, 1);
    mu.uPx.value = 2 / Math.max(gl.domElement.height, 1);
    mu.uColor.value.set(T.orbColor);
    mu.uHot.value.set(T.orbHotColor);
    // the halo and heart (gone as it lets go), the flash and the wave
    const flash = burst > 0 ? Math.exp(-Math.pow((burst - 0.06) / 0.08, 2)) : 0;
    const whole = 1 - sm(0, 0.35, burst);
    const hu = parts.haloU;
    parts.halo.position.copy(centre);
    hu.uR.value = R * (1 - 0.12 * charge);
    ORANGE.set(T.orbColor);
    hu.uCol.value.copy(ORANGE).multiplyScalar(show * (0.35 + 0.45 * charge) * whole * T.orbHalo);
    hu.uCore.value = show * (0.35 + 0.65 * charge) * whole * T.orbHalo;
    hu.uFlash.value = flash * T.orbFlash;
    hu.uOuter.value = charge * (1 - sm(0, 0.1, burst)) * T.orbHalo;
    const wu = parts.waveU;
    parts.wave.position.copy(centre);
    wu.uR.value = R;
    wu.uStretch.value.set(8 + 10 * burst, 1.2);
    wu.uCol.value.set(T.orbHotColor).multiplyScalar(0.9);
    wu.uFlash.value = (burst > 0 ? Math.exp(-Math.pow((burst - 0.12) / 0.16, 2)) : 0) * T.orbWave;
    wu.uSpread.value = burst;
    parts.wave.visible = wu.uFlash.value > 0.001;
    parts.motes.visible = burst < 0.999 || pouring;
    parts.halo.visible = whole > 0.001 || hu.uFlash.value > 0.001;
    // the cube in it: turning slowly, staying on as the orb lets go — no
    // flare — until the tree has grown past it, then melting into it
    // (T.cubeFadeFrom → cubeFadeTo of the growth), its threads going up
    // round the trunk onto the strands as they grow
    const cu = parts.cubeU;
    const melt = THREE.MathUtils.clamp((grow - T.cubeFadeFrom) / Math.max(T.cubeFadeTo - T.cubeFadeFrom, 0.002), 0, 1);
    cu.uColor.value.set(T.cubeColor);
    cu.uGlow.value = T.cubeGlow;
    cu.uMelt.value = T.cubeMelt ? melt : 0;
    cu.uShow.value = show * (T.cubeMelt ? (melt >= 1 ? 0 : 1) : 1 - sm(0, 1, melt));
    parts.cube.visible = cu.uShow.value > 0.001;
    parts.cube.scale.setScalar(T.cubeSize);
    const tilt = THREE.MathUtils.degToRad(T.cubeTilt);
    parts.cube.rotation.set(tilt, t * 0.25 + charge * 1.5, tilt * 0.6);
    parts.cube.position.copy(centre);
    parts.cube.updateMatrix();
    // the threads it melts into
    const lu = parts.meltU;
    const key = `${treeSamples.version}:${T.cubeFadeFrom}:${T.cubeFadeTo}:${T.cubeMeltTravel}:${T.treeGrowJitter}`;
    if (parts.meltKey.v !== key) {
      layOutMelt(parts.melt.geometry, T.cubeFadeFrom, T.cubeFadeTo, T.cubeMeltTravel, T.treeGrowJitter);
      parts.meltKey.v = key;
    }
    lu.uCube.value.copy(parts.cube.matrix);
    lu.uGrow.value = grow;
    lu.uTravel.value = Math.max(T.cubeMeltTravel, 0.01);
    lu.uGain.value = T.cubeMeltGlow * show;
    lu.uAspect.value = mu.uAspect.value;
    lu.uPx.value = mu.uPx.value;
    lu.uColor.value.set(T.cubeColor);
    lu.uHot.value.set(T.orbHotColor);
    parts.melt.visible = T.cubeMelt && grow > T.cubeFadeFrom - 0.01 && grow < Math.max(T.cubeFadeTo, T.cubeFadeFrom) + T.cubeMeltTravel * 1.2;
  });

  return (
    <>
      <primitive object={parts.group} />
      <OrbRain J={J} shared={shared} tier={tier} />
    </>
  );
}
