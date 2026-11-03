"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { STATE, STORY, at, onStory, smooth } from "../story";
import { buildStates } from "./states";
import { energyFrag, energyVert, linesFrag, linesVert, pointsFrag, pointsVert, sculptFrag, sculptVert, skyFrag, skyVert } from "./shaders";
import { cameraAt, energyAt, lookAt } from "./paths";

// The one persistent canvas: fixed behind the page, it renders only while
// it can be seen (the opening and the arrival), on demand from the story's
// ticker; everything in it reads STATE and STORY, never React state.

const DARK = new THREE.Color("#08090B");
const LIGHT = new THREE.Color("#F7F7F5");
const TRAIL = 48;

// additive when uNormal = 0, painted over when 1 (shaders.js)
const blend = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
};

// the pointer, in screen space; it fades when it rests
const POINTER = { x: 0, y: 0, on: 0, last: -1e9, sx: 0, sy: 0 };

function Scene({ count, mobile }) {
  const { gl, size, camera, setDpr } = useThree();
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), l: new THREE.Vector3(), e: new THREE.Vector3(), c: new THREE.Color(), r: new THREE.Vector3(), u: new THREE.Vector3() }), []);

  const world = useMemo(() => buildStates(count), [count]);

  const shared = useMemo(
    () => ({
      uStates: { value: world.tex },
      uRows: { value: world.rows },
      uStage: { value: 0 },
      uFlow: { value: 0.6 },
      uTime: { value: 0 },
      uSpread: { value: 0 },
      uLight: { value: 0 },
      uNormal: { value: 0 },
      uEnergy: { value: new THREE.Vector3() },
      uEnergyB: { value: 0 },
    }),
    [world]
  );

  const points = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const idx = new Float32Array(count);
    for (let i = 0; i < count; i++) idx[i] = i;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aIndex", new THREE.BufferAttribute(idx, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: pointsVert,
      fragmentShader: pointsFrag,
      uniforms: {
        ...shared,
        uSize: { value: mobile ? 1.15 : 1 },
        uPx: { value: 1 },
        uReveal: { value: 0 },
        uMouse: { value: new THREE.Vector2() },
        uMouseOn: { value: 0 },
        uAspect: { value: 1 },
        uGridX: { value: new THREE.Vector2(-0.9, 0.9) },
      },
      ...blend,
    });
    const o = new THREE.Points(g, m);
    o.frustumCulled = false;
    return o;
  }, [count, shared, mobile]);

  const lines = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = world.pairs.length;
    const a = new Float32Array(n);
    const b = new Float32Array(n);
    for (let i = 0; i < n; i += 2) {
      a[i] = world.pairs[i];
      b[i] = world.pairs[i + 1];
      a[i + 1] = world.pairs[i + 1];
      b[i + 1] = world.pairs[i];
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aIndex", new THREE.BufferAttribute(a, 1));
    g.setAttribute("aOther", new THREE.BufferAttribute(b, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: linesVert, fragmentShader: linesFrag, uniforms: { ...shared, uLinks: { value: 0 } }, ...blend });
    const o = new THREE.LineSegments(g, m);
    o.frustumCulled = false;
    return o;
  }, [world, shared]);

  const sculpture = useMemo(() => {
    // five ribbons, each a strip of (u along, v across, ribbon) — the shader
    // makes it the surface
    const SU = mobile ? 120 : 200;
    const SV = 18;
    const pos = [];
    const index = [];
    for (let r = 0; r < 5; r++) {
      const base = pos.length / 3;
      for (let i = 0; i <= SU; i++) for (let j = 0; j <= SV; j++) pos.push(i / SU, j / SV, r);
      for (let i = 0; i < SU; i++)
        for (let j = 0; j < SV; j++) {
          const a = base + i * (SV + 1) + j;
          const b = a + SV + 1;
          index.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(index);
    const m = new THREE.ShaderMaterial({
      vertexShader: sculptVert,
      fragmentShader: sculptFrag,
      uniforms: { ...shared, uSculpt: { value: 0 }, uDissolve: { value: 0 }, uAccent: { value: 0 } },
      side: THREE.DoubleSide,
      ...blend,
    });
    const o = new THREE.Mesh(g, m);
    o.frustumCulled = false;
    o.renderOrder = -1;
    return o;
  }, [shared, mobile]);

  const energy = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const t = new Float32Array(TRAIL);
    for (let i = 0; i < TRAIL; i++) t[i] = i / (TRAIL - 1);
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: energyVert,
      fragmentShader: energyFrag,
      uniforms: { uB: { value: 0 }, uRing: { value: 0 }, uPx: { value: 1 }, uLand: { value: 0 }, uLandNdc: { value: new THREE.Vector2() }, uNormal: shared.uNormal },
      ...blend,
    });
    const o = new THREE.Points(g, m);
    o.frustumCulled = false;
    o.renderOrder = 2;
    return o;
  }, [shared]);

  const sky = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: { uLight: shared.uLight, uAspect: { value: 1 }, uCentre: { value: new THREE.Vector2(0.6, 0.5) } },
      depthTest: false,
      depthWrite: false,
    });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
    o.frustumCulled = false;
    o.renderOrder = -10;
    return o;
  }, [shared]);

  useEffect(
    () => () => {
      world.tex.dispose();
      for (const o of [points, lines, sculpture, energy, sky]) {
        o.geometry.dispose();
        o.material.dispose();
      }
    },
    [world, points, lines, sculpture, energy, sky]
  );

  useEffect(() => {
    STORY.camera = camera;
    camera.fov = mobile ? 54 : 40;
    camera.near = 0.1;
    camera.far = 400;
    return () => {
      if (STORY.camera === camera) STORY.camera = null;
    };
  }, [camera, mobile]);

  // the trail: the head's last positions
  const trail = useRef({ filled: false });
  // adaptive quality: a slow second lowers the pixel ratio a step
  const perf = useRef({ acc: 0, n: 0, dpr: Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75) });

  useFrame((_, dt) => {
    const t = STORY.t;
    const S = STATE;
    const px = gl.getPixelRatio();
    const pu = points.material.uniforms;

    // time and the timeline's values
    shared.uTime.value += Math.min(dt, 0.05) * 0.6;
    shared.uStage.value = S.stage;
    shared.uFlow.value = S.flow;
    shared.uSpread.value = S.spread;
    shared.uLight.value = S.light;
    shared.uNormal.value = smooth(0.15, 0.85, S.light);
    pu.uReveal.value = S.reveal * STORY.boot;
    pu.uPx.value = px;
    pu.uAspect.value = size.width / size.height;
    lines.material.uniforms.uLinks.value = S.links;
    const su = sculpture.material.uniforms;
    su.uSculpt.value = S.sculpt;
    su.uDissolve.value = S.dissolve;
    su.uAccent.value = smooth(at(10, 0.1), at(10, 0.6), t) * (1 - smooth(at(11, 0), at(11, 0.4), t));
    sculpture.visible = S.sculpt > 0.001 && S.dissolve < 0.999;
    lines.visible = S.links > 0.002;

    // the background, dark into white (the clear colour is only seen
    // before the backdrop draws)
    tmp.c.copy(DARK).lerp(LIGHT, S.light);
    gl.setClearColor(tmp.c, 1);
    sky.material.uniforms.uAspect.value = size.width / size.height;

    // the camera, with a little parallax from the pointer
    const now = performance.now() / 1000;
    POINTER.on = Math.max(0, 1 - (now - POINTER.last) / 2.5);
    const k = 1 - Math.exp(-dt * 3);
    POINTER.sx += (POINTER.x * POINTER.on - POINTER.sx) * k;
    POINTER.sy += (POINTER.y * POINTER.on - POINTER.sy) * k;
    cameraAt(t, tmp.v);
    lookAt(t, tmp.l);
    camera.position.copy(tmp.v);
    camera.lookAt(tmp.l);
    tmp.r.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmp.u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const lean = mobile ? 0 : 0.7;
    camera.position.addScaledVector(tmp.r, POINTER.sx * lean).addScaledVector(tmp.u, POINTER.sy * lean * 0.6);
    camera.lookAt(tmp.l);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    // the scene's place across the screen: right of the copy on desktop,
    // above it on a phone
    const e = camera.projectionMatrix.elements;
    e[8] -= mobile ? S.shift * 0.15 : S.shift;
    if (mobile) e[9] -= 0.22 * smooth(at(3, 0.5), at(4, 0.2), t) * (1 - S.light);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();

    pu.uMouse.value.set(POINTER.x, POINTER.y);
    pu.uMouseOn.value = POINTER.on * (1 - S.light * 0.6);

    // the idea
    energyAt(t, tmp.e);
    const tm = shared.uTime.value;
    const roam = 0.25 + 7 * (1 - smooth(at(2, 0), at(3, 0), t));
    tmp.e.x += Math.sin(tm * 0.33) * roam;
    tmp.e.y += Math.sin(tm * 0.21 + 1) * roam * 0.3;
    tmp.e.z += Math.cos(tm * 0.27) * roam;
    shared.uEnergy.value.copy(tmp.e);
    // the light opens from where the idea is on screen (held while it can't be seen)
    tmp.v.copy(tmp.e).project(camera);
    if (tmp.v.z < 1) {
      const c = sky.material.uniforms.uCentre.value;
      // (leaning to the right, where the idea is heading)
      c.set(THREE.MathUtils.clamp(tmp.v.x * 0.25 + 0.5 + 0.18, 0.2, 0.85), THREE.MathUtils.clamp(tmp.v.y * 0.5 + 0.5, 0.25, 0.75));
    }
    const eb = S.energy * STORY.boot;
    shared.uEnergyB.value = eb;
    const eu = energy.material.uniforms;
    eu.uB.value = eb;
    eu.uRing.value = S.ring;
    eu.uPx.value = px;
    const pos = energy.geometry.attributes.position;
    const arr = pos.array;
    if (!trail.current.filled) {
      for (let i = 0; i < TRAIL; i++) tmp.e.toArray(arr, i * 3);
      trail.current.filled = true;
    }
    arr.copyWithin(3, 0, (TRAIL - 1) * 3);
    tmp.e.toArray(arr, 0);
    pos.needsUpdate = true;

    // the arrival (16): onto the page's grid, and the idea onto its full stop
    const land = smooth(at(16, 0.2), at(16, 0.95), t);
    eu.uLand.value = land;
    if (S.stage > 8) {
      const grid = document.querySelector("[data-cti-grid]");
      if (grid) {
        const r = grid.getBoundingClientRect();
        pu.uGridX.value.set((r.left / size.width) * 2 - 1, (r.right / size.width) * 2 - 1);
      }
    }
    if (land > 0) {
      const dot = document.querySelector("[data-energy-land]");
      if (dot) {
        const r = dot.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.78;
        eu.uLandNdc.value.set((cx / size.width) * 2 - 1, 1 - (cy / size.height) * 2);
      }
    }

    // adaptive pixel ratio
    // (a long gap is the canvas resting, not a slow frame)
    const p = perf.current;
    if (dt > 0.25) return;
    p.acc += dt;
    p.n++;
    if (p.acc > 1.2) {
      const avg = p.acc / p.n;
      if (avg > 1 / 42 && p.dpr > 1) {
        p.dpr = Math.max(1, p.dpr - 0.25);
        setDpr(p.dpr);
      }
      p.acc = 0;
      p.n = 0;
    }
  });

  return (
    <>
      <primitive object={sky} />
      <primitive object={sculpture} />
      <primitive object={lines} />
      <primitive object={points} />
      <primitive object={energy} />
    </>
  );
}

// renders on the story's ticker while the canvas can be seen
function Driver({ wrap }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(
    () =>
      onStory((story) => {
        const fade = 1 - smooth(0.15, 0.75, story.after);
        const el = wrap.current;
        if (el) {
          el.style.opacity = fade.toFixed(3);
          el.style.visibility = fade > 0 ? "visible" : "hidden";
          el.style.setProperty("--cti-dark", (1 - STATE.light).toFixed(3));
        }
        if (fade > 0) invalidate();
      }),
    [invalidate, wrap]
  );
  return null;
}

// particles by device: phones, tablets and modest machines, the rest
const countFor = (mobile) => {
  if (mobile) return 22000;
  const cores = navigator.hardwareConcurrency || 4;
  return window.innerWidth < 1200 || cores <= 4 ? 40000 : 72000;
};

export default function World({ mobile }) {
  const wrap = useRef(null);
  const count = useMemo(() => countFor(mobile), [mobile]);

  useEffect(() => {
    const move = (ev) => {
      POINTER.x = (ev.clientX / window.innerWidth) * 2 - 1;
      POINTER.y = 1 - (ev.clientY / window.innerHeight) * 2;
      POINTER.last = performance.now() / 1000;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
    };
  }, []);

  return (
    <div ref={wrap} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={[1, mobile ? 1.5 : 1.75]}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance", stencil: false }}
        camera={{ position: [0, 3, 70], fov: 40, near: 0.1, far: 400 }}
      >
        <Scene count={count} mobile={mobile} />
        <Driver wrap={wrap} />
      </Canvas>
      <div className="cti-vignette absolute inset-0" />
    </div>
  );
}

