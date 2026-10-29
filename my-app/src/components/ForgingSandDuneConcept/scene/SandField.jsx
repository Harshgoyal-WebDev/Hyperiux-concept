"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../world/layout";
import { STIR_SLOTS } from "../world/materials";
import { attachPointer, pointer } from "../pointer";
import { T } from "../tuning";
import { getAudio } from "../audio";

// Hovering the dunes draws in the sand. The pointer's exact path (every
// pointer event, joined by Catmull-Rom curves on screen) is projected onto
// the height field and painted as a groove with heaped edges into a trail
// texture over the dunes around the camera; the sand material reads it.
// The trail is as long as the hover: the texture fades linearly, so every
// part merges back lineMerge seconds after it was drawn. Along the way the
// touch points become "stirs" (position, age, strength) that throw a spray
// of grains up out of the sand: every grain belongs to one stir slot, sits
// under the sand until its slot is dug, then launches from the crater on a
// ballistic arc, lands and settles back in.
const GRAVITY = 9.8;

const GRAIN_VERTEX = /* glsl */ `
attribute vec4 aGrain; // crater offset xz (unit disc), launch seeds
attribute float aSlot;
uniform sampler2D uHeight;
uniform vec4 uHMap; // x0, z0, step, n
uniform vec4 uStir[${STIR_SLOTS}];
uniform float uScale;
uniform float uVis;
uniform float uStrength;
uniform float uRadius;
uniform float uSize;
varying float vA;
varying float vAir;
float ncGround(vec2 xz) {
  vec2 uv = ((xz - uHMap.xy) / uHMap.z + 0.5) / uHMap.w;
  return texture2D(uHeight, uv).r;
}
void main() {
  vec4 s = uStir[int(aSlot + 0.5)];
  float t = s.z - aGrain.w * 0.14; // grains leave the crater in a short burst
  if (s.w <= 0.001 || t <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vA = 0.0;
    vAir = 0.0;
    return;
  }
  float r = length(aGrain.xy);
  vec2 dir = r > 1e-3 ? aGrain.xy / r : vec2(1.0, 0.0);
  float power = 0.4 + 0.2 * uStrength;
  // grains from the middle of the crater fly highest
  float up = (1.2 + aGrain.z * 3.6) * power * (1.15 - 0.5 * r);
  float out_ = (0.5 + aGrain.w * 2.0) * power * (0.4 + r);
  float land = 2.0 * up / ${GRAVITY.toFixed(1)};
  float ta = min(t, land);
  vec2 xz = s.xy + aGrain.xy * uRadius * 0.9 + dir * out_ * ta;
  float y = max(up * ta - 0.5 * ${GRAVITY.toFixed(1)} * ta * ta, 0.0);
  vec3 p = vec3(xz.x, ncGround(xz) + 0.02 + y, xz.y);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  vAir = smoothstep(0.0, 0.25, y);
  // emerge from the surface, settle back into it after landing
  vA = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(land, land + 0.45, t)) * uVis;
  vA *= smoothstep(1.5, 4.0, dist) * (1.0 - smoothstep(45.0, 75.0, dist));
  gl_PointSize = max((0.018 + aGrain.z * 0.022) * uSize * uScale / max(dist, 0.5), 1.2) * step(0.001, vA);
}
`;
// Grains have their own day and night colours (lighter than the dunes, so
// the spray reads against them), blended with night mode; a touch brighter
// in the air where they catch the light.
const GRAIN_FRAGMENT = /* glsl */ `
uniform vec3 uSand;
varying float vA;
varying float vAir;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.3, 0.5, d);
  if (m * vA < 0.01) discard;
  vec3 col = uSand * mix(0.8, 1.15, vAir);
  gl_FragColor = vec4(col, clamp(m * vA, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// The trail texture: a square of the dunes ahead of the camera, recentred
// (on its texel grid, shifting what is drawn) as the camera travels.
const TRAIL_SIZE = 160; // metres
const MAX_STAMPS = 512; // segments painted per frame
const GRAIN_LIFE = 1.6; // seconds a spray slot lives (its grains have landed)
const GRAIN_EVERY = 0.034; // seconds between sprays (48 slots cover the life)

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
// fades every texel linearly (oldest parts are gone first) and carries the
// contents along when the square is recentred
const FADE_FRAGMENT = /* glsl */ `
uniform sampler2D uPrev;
uniform vec2 uShift;
uniform float uFade;
varying vec2 vUv;
void main() {
  vec2 uv = vUv + uShift;
  vec2 v = uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ? vec2(0.0) : texture2D(uPrev, uv).rg;
  gl_FragColor = vec4(max(v - uFade, 0.0), 0.0, 1.0);
}
`;
// one segment of the path: a capsule with a soft groove down its middle and
// a heaped rim either side (max-blended, so overlaps never stack)
const STAMP_VERTEX = /* glsl */ `
attribute vec4 aSeg; // a.xz, b.xz (world)
uniform vec3 uRect;
uniform float uW;
varying vec2 vP;
varying vec4 vSeg;
void main() {
  vec2 a = aSeg.xy;
  vec2 b = aSeg.zw;
  vec2 ab = b - a;
  float L = length(ab);
  vec2 d = L > 1e-5 ? ab / L : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  float R = uW * 3.2;
  vec2 p = (a + b) * 0.5 + d * position.x * (L * 0.5 + R) + n * position.y * R;
  vP = p;
  vSeg = aSeg;
  gl_Position = vec4(((p - uRect.xy) / uRect.z) * 2.0, 0.0, 1.0);
}
`;
const STAMP_FRAGMENT = /* glsl */ `
uniform float uW;
varying vec2 vP;
varying vec4 vSeg;
void main() {
  vec2 a = vSeg.xy;
  vec2 ab = vSeg.zw - a;
  float L = dot(ab, ab);
  float t = L > 1e-8 ? clamp(dot(vP - a, ab) / L, 0.0, 1.0) : 0.0;
  float d = length(vP - a - ab * t);
  float groove = exp(-d * d / (uW * uW));
  float r = (d - 1.7 * uW) / (0.7 * uW);
  float rim = exp(-r * r);
  gl_FragColor = vec4(groove, rim, 0.0, 1.0);
}
`;

function createTrail(res) {
  const make = () =>
    new THREE.WebGLRenderTarget(res, res, {
      type: THREE.HalfFloatType,
      format: THREE.RGFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.PlaneGeometry(2, 2);
  const fade = new THREE.ShaderMaterial({
    uniforms: { uPrev: { value: null }, uShift: { value: new THREE.Vector2() }, uFade: { value: 0 } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: FADE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const fadeScene = new THREE.Scene();
  const fadeMesh = new THREE.Mesh(quad, fade);
  fadeMesh.frustumCulled = false;
  fadeScene.add(fadeMesh);

  const stampGeometry = new THREE.InstancedBufferGeometry();
  stampGeometry.index = quad.index;
  stampGeometry.setAttribute("position", quad.attributes.position);
  const seg = new THREE.InstancedBufferAttribute(new Float32Array(MAX_STAMPS * 4), 4);
  seg.setUsage(THREE.DynamicDrawUsage);
  stampGeometry.setAttribute("aSeg", seg);
  stampGeometry.instanceCount = 0;
  const stamp = new THREE.ShaderMaterial({
    uniforms: { uRect: { value: new THREE.Vector3(0, 0, TRAIL_SIZE) }, uW: { value: 0.5 } },
    vertexShader: STAMP_VERTEX,
    fragmentShader: STAMP_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const stampScene = new THREE.Scene();
  const stampMesh = new THREE.Mesh(stampGeometry, stamp);
  stampMesh.frustumCulled = false;
  stampScene.add(stampMesh);

  return {
    res,
    targets: [make(), make()],
    read: 0,
    camera,
    fade,
    fadeScene,
    stamp,
    stampScene,
    seg,
    stampGeometry,
    count: 0,
    rect: new THREE.Vector3(0, 0, TRAIL_SIZE), // centre x, z, size
    fresh: true, // nothing drawn yet (or all merged back): no passes needed
    liveUntil: 0,
    dispose() {
      this.targets.forEach((t) => t.dispose());
      quad.dispose();
      stampGeometry.dispose();
      fade.dispose();
      stamp.dispose();
    },
  };
}

// uniform Catmull-Rom between p1 and p2
function catmull(p0, p1, p2, p3, t, out) {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  out.x = f(p0.x, p1.x, p2.x, p3.x);
  out.y = f(p0.y, p1.y, p2.y, p3.y);
  return out;
}

export default function SandField({ J, tier, shared, heightField }) {
  const { camera, gl, size } = useThree();
  const ref = useRef();
  useEffect(() => attachPointer(), []);

  const built = useMemo(() => {
    const rng = mulberry32(4242);
    const n = tier.sandGrains;
    const grain = new Float32Array(n * 4);
    const slot = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // uniform over the crater disc
      const r = Math.sqrt(rng());
      const a = rng() * Math.PI * 2;
      grain.set([Math.cos(a) * r, Math.sin(a) * r, rng(), rng()], i * 4);
      slot[i] = i % STIR_SLOTS;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geometry.setAttribute("aGrain", new THREE.BufferAttribute(grain, 4));
    geometry.setAttribute("aSlot", new THREE.BufferAttribute(slot, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uHeight: { value: heightField.texture },
        uHMap: { value: heightField.params },
        uStir: shared.uStir,
        uScale: { value: 500 },
        uVis: { value: 1 },
        uStrength: { value: 1 },
        uRadius: { value: 1 },
        uSize: { value: 1 },
        uSand: { value: new THREE.Color() },
      },
      vertexShader: GRAIN_VERTEX,
      fragmentShader: GRAIN_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const trail = createTrail(n >= 16000 ? 2048 : 1024);
    return { geometry, material, trail };
  }, [tier, shared, heightField]);

  useEffect(() => {
    shared.uTrail.value = built.trail.targets[built.trail.read].texture;
    return () => {
      if (shared.uTrail.value === built.trail.targets[0].texture || shared.uTrail.value === built.trail.targets[1].texture) {
        shared.uTrail.value = null;
        shared.uStirActive.value = 0;
      }
      built.geometry.dispose();
      built.material.dispose();
      built.trail.dispose();
    };
  }, [built, shared]);

  const s = useMemo(
    () => ({
      raycaster: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      p: new THREE.Vector3(),
      night: new THREE.Color(),
      fwd: new THREE.Vector3(),
      ptr: new THREE.Vector2(),
      c: new THREE.Vector2(),
      // the last screen points of the stroke (for the curves) and the last
      // point it reached on the dunes
      hist: [],
      lastHit: null,
      lastT: -1e9,
      lastSpray: 0,
      sprayFrom: new THREE.Vector2(1e9, 1e9),
      next: 0,
    }),
    []
  );

  // the pointer ray against the height field → s.p
  const hitGround = (x, y) => {
    s.ndc.set(x, y);
    s.raycaster.setFromCamera(s.ndc, camera);
    const { origin, direction } = s.raycaster.ray;
    let t = 1;
    let prev = 0;
    for (let i = 0; i < 160 && t < 420; i++) {
      s.p.copy(origin).addScaledVector(direction, t);
      if (s.p.y < heightField.sample(s.p.x, s.p.z)) {
        // refine between prev and t
        let lo = prev;
        let hi = t;
        for (let k = 0; k < 8; k++) {
          const mid = (lo + hi) / 2;
          s.p.copy(origin).addScaledVector(direction, mid);
          if (s.p.y < heightField.sample(s.p.x, s.p.z)) hi = mid;
          else lo = mid;
        }
        s.p.copy(origin).addScaledVector(direction, hi);
        return true;
      }
      prev = t;
      t += Math.max(0.5, t * 0.03);
    }
    return false;
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const stir = shared.uStir.value;
    const trail = built.trail;
    const now = performance.now();

    // age every spray slot
    for (const v of stir) {
      if (v.w <= 0) continue;
      v.z += dt;
      if (v.z > GRAIN_LIFE) v.w = 0;
    }

    // ---- the trail square follows the camera (snapped to its texels)
    camera.getWorldDirection(s.fwd);
    const fl = Math.hypot(s.fwd.x, s.fwd.z) || 1;
    const texel = TRAIL_SIZE / trail.res;
    const cx = Math.round((camera.position.x + (s.fwd.x / fl) * TRAIL_SIZE * 0.4) / texel) * texel;
    const cz = Math.round((camera.position.z + (s.fwd.z / fl) * TRAIL_SIZE * 0.4) / texel) * texel;
    const recentre = Math.hypot(cx - trail.rect.x, cz - trail.rect.y) > TRAIL_SIZE * 0.08;
    const shiftX = recentre ? (cx - trail.rect.x) / TRAIL_SIZE : 0;
    const shiftZ = recentre ? (cz - trail.rect.y) / TRAIL_SIZE : 0;
    if (recentre) trail.rect.set(cx, cz, TRAIL_SIZE);

    // ---- trace the pointer's path since last frame onto the dunes
    const stamps = trail.seg.array;
    let count = 0;
    const width = Math.max(T.lineWidth, 0.05);
    const addPoint = (hit) => {
      if (!hit) {
        s.lastHit = null;
        return;
      }
      const x = s.p.x;
      const z = s.p.z;
      // join to the last point unless the ray jumped (over a crest, say): on
      // far sand a few pixels of cursor are metres, so the limit grows with
      // the distance
      const far = s.p.distanceTo(camera.position);
      if (s.lastHit && Math.hypot(x - s.lastHit.x, z - s.lastHit.y) < Math.max(6, width * 10, far * 0.15) && count < MAX_STAMPS) {
        stamps.set([s.lastHit.x, s.lastHit.y, x, z], count * 4);
        count++;
      } else if (count < MAX_STAMPS) {
        stamps.set([x, z, x, z], count * 4);
        count++;
      }
      s.lastHit = s.lastHit || new THREE.Vector2();
      s.lastHit.set(x, z);
      // a spray of grains every so often along the way
      if (now - s.lastSpray > GRAIN_EVERY * 1000 && s.sprayFrom.distanceTo(s.lastHit) > width * 0.8) {
        stir[s.next].set(x, z, 0, 1);
        s.next = (s.next + 1) % stir.length;
        s.lastSpray = now;
        s.sprayFrom.copy(s.lastHit);
      }
    };

    const interactive = pointer.active;
    const path = pointer.path;
    let sandLevel = 0;
    if (interactive && path.length) {
      const px = size.width / 2;
      const py = size.height / 2;
      for (const q of path) {
        // a pause or a jump starts a new stroke
        if (q.t - s.lastT > 140) {
          s.hist.length = 0;
          s.lastHit = null;
        }
        s.lastT = q.t;
        const h = s.hist;
        h.push(q);
        if (h.length > 4) h.shift();
        if (h.length === 1) {
          addPoint(hitGround(q.x, q.y));
          continue;
        }
        // draw the curve into the newest point; the tangent at its far end
        // is extrapolated (no waiting for the next event)
        const p1 = h[h.length - 2];
        const p2 = h[h.length - 1];
        const p0 = h.length > 2 ? h[h.length - 3] : p1;
        const p3 = { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
        const pixels = Math.hypot((p2.x - p1.x) * px, (p2.y - p1.y) * py);
        const n = Math.min(Math.max(Math.ceil(pixels / 3), 1), 32);
        for (let k = 1; k <= n; k++) {
          catmull(p0, p1, p2, p3, k / n, s.c);
          addPoint(hitGround(s.c.x, s.c.y));
        }
      }
    }
    // the wind of sand: louder the faster the pointer moves over the dunes
    const ps = Math.hypot(pointer.x - s.ptr.x, pointer.y - s.ptr.y) / dt;
    s.ptr.set(pointer.x, pointer.y);
    if (interactive && s.lastHit && now - pointer.movedAt < 150) sandLevel = Math.min(ps / 1.1, 1);
    path.length = 0;
    getAudio()?.sandHover(sandLevel, pointer.x);

    // ---- paint: fade (and carry) what is there, then the new segments
    if (count) {
      trail.liveUntil = now + Math.max(T.lineMerge, 0.1) * 1000 + 200;
      trail.fresh = false;
    }
    const active = !trail.fresh && now < trail.liveUntil;
    if (!trail.fresh) {
      const src = trail.targets[trail.read];
      const dst = trail.targets[1 - trail.read];
      trail.fade.uniforms.uPrev.value = src.texture;
      trail.fade.uniforms.uShift.value.set(shiftX, shiftZ);
      // everything merged: clear it once and rest
      trail.fade.uniforms.uFade.value = active ? dt / Math.max(T.lineMerge, 0.1) : 1;
      trail.stamp.uniforms.uRect.value.copy(trail.rect);
      trail.stamp.uniforms.uW.value = width;
      trail.stampGeometry.instanceCount = count;
      trail.seg.needsUpdate = count > 0;
      if (count) trail.seg.addUpdateRange(0, count * 4);
      const prevTarget = gl.getRenderTarget();
      const autoClear = gl.autoClear;
      gl.autoClear = false;
      gl.setRenderTarget(dst);
      gl.render(trail.fadeScene, trail.camera);
      if (count) gl.render(trail.stampScene, trail.camera);
      gl.setRenderTarget(prevTarget);
      gl.autoClear = autoClear;
      trail.read = 1 - trail.read;
      shared.uTrail.value = dst.texture;
      if (!active) trail.fresh = true;
    }
    shared.uTrailRect.value.copy(trail.rect);
    shared.uStirActive.value = active ? 1 : 0;

    const u = built.material.uniforms;
    u.uScale.value = gl.domElement.height * 0.5;
    u.uVis.value = T.grainOpacity;
    u.uStrength.value = T.stirStrength;
    u.uSize.value = T.grainSize;
    u.uSand.value.set(T.grainColorDay).lerp(s.night.set(T.grainColorNight), shared.uNight.value);
    u.uRadius.value = T.stirRadius;
    const anyStir = stir.some((v) => v.w > 0);
    if (ref.current) ref.current.visible = u.uVis.value > 0.001 && anyStir;
  });

  return <points ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} />;
}
