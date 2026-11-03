"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CHAPTERS } from "./chapters";
import { C, LI, clamp, mixHex, pad } from "./kit";
import { timeline } from "./timeline";

// The one WebGL stage behind the page. Every chapter is built once into its
// own group; scroll picks the chapter (T = 0–9) and only that group is drawn,
// with its local t (0–1) driving the same curves as the storyboard. The
// cameras, lights and fog are shared and reset each frame, so a chapter only
// sets what it uses. Between chapters a short wash in the sky colour hides
// the change of scene. The page chrome (header, strip) is updated here too.

const WASH = 0.022; // half-width of the wash at each chapter boundary, in T

function makeRig(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd6cfc2, 0);
  const amb = new THREE.AmbientLight(0xffffff, 0);
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  const rim = new THREE.DirectionalLight(0xffffff, 0);
  const p1 = new THREE.PointLight(0xffffff, 0, 70, 1.4);
  const p2 = new THREE.PointLight(0xffffff, 0, 60, 1.6);
  const p3 = new THREE.PointLight(0xffffff, 0, 26, 1.6);
  scene.add(hemi, amb, sun, sun.target, rim, p1, p2, p3);
  scene.fog = new THREE.Fog(0xe7e6e2, 1e4, 2e4);
  const rig = { hemi, amb, sun, rim, p1, p2, p3, fog: scene.fog };
  rig.reset = () => {
    hemi.intensity = 0.6 * LI; hemi.color.set(0xffffff); hemi.groundColor.set(0xd6cfc2);
    amb.intensity = 0; amb.color.set(0xffffff);
    sun.intensity = 0.8 * LI; sun.color.set(0xffffff); sun.position.set(-16, 28, 20); sun.target.position.set(0, 0, 0);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 160 });
    sun.shadow.camera.updateProjectionMatrix();
    rim.intensity = 0; rim.color.set(0xffffff); rim.position.set(0, 24, -50);
    [p1, p2, p3].forEach((p) => { p.intensity = 0; p.color.set(0xffffff); p.position.set(0, 0, 0); });
    scene.fog.color.set(C.paper); scene.fog.near = 1e4; scene.fog.far = 2e4;
  };
  rig.reset();
  return rig;
}

function Runtime({ rootRef }) {
  const { gl, scene } = useThree();
  const rootEl = () => rootRef.current;

  const kit = useMemo(() => {
    const persp = new THREE.PerspectiveCamera(40, 1, 0.3, 600);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
    const rig = makeRig(scene);
    const chapters = CHAPTERS.map((c) => {
      const built = c.build({ scene });
      built.root.visible = false;
      scene.add(built.root);
      return { ...c, ...built };
    });
    return { persp, ortho, rig, chapters };
  }, [scene]);

  // frame context handed to every chapter's update
  const f = useMemo(() => {
    const ctx = {
      cam: kit.persp, ortho: kit.ortho, rig: kit.rig, scene,
      W: 1, H: 1, narrow: false, time: 0, px: 0, py: 0, els: {},
      active: kit.persp,
      use(camera) { ctx.active = camera; },
      // perspective lens: base fov widened on tall screens, optional view offset (fractions of W/H)
      lens(fov, { x = 0, y = 0, near = 0.3, far = 600, tall = 1.5 } = {}) {
        const c = kit.persp, asp = ctx.W / ctx.H;
        c.aspect = asp;
        c.fov = asp < 1.3 ? (2 * Math.atan((Math.tan((fov * Math.PI) / 360) * tall) / asp) * 180) / Math.PI : fov;
        c.near = near; c.far = far;
        if (x || y) c.setViewOffset(ctx.W, ctx.H, -x * ctx.W, -y * ctx.H, ctx.W, ctx.H); else c.clearViewOffset();
        c.updateProjectionMatrix();
        ctx.active = c;
        return c;
      },
      // orthographic lens: half-height in world units, optional view offset
      orthoLens(hh, { x = 0, y = 0, near = 0.1, far = 600 } = {}) {
        const c = kit.ortho, asp = ctx.W / ctx.H;
        Object.assign(c, { left: -hh * asp, right: hh * asp, top: hh, bottom: -hh, near, far });
        if (x || y) c.setViewOffset(ctx.W, ctx.H, -x * ctx.W, -y * ctx.H, ctx.W, ctx.H); else c.clearViewOffset();
        c.updateProjectionMatrix();
        ctx.active = c;
        return c;
      },
      sky(top, bottom = top) { ctx._sky = [top, bottom]; },
      theme(k) { ctx._theme = k; }, // 0 = paper with dark ink, 1 = night with light ink
      // project a world point to the page: [x, y, inFront]
      project(v) {
        const p = v.clone().project(ctx.active);
        return [((p.x + 1) / 2) * ctx.W, ((1 - p.y) / 2) * ctx.H, p.z < 1];
      },
      place(el, v, o = 1, extra = "") {
        if (!el) return;
        const [x, y, ok] = ctx.project(v);
        el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) ${extra}`;
        const oo = ok ? o : 0;
        el.style.opacity = oo.toFixed(3);
        el.style.visibility = oo <= 0.001 ? "hidden" : "visible";
      },
      goT: (T) => timeline.goT(T),
      _sky: [C.paper, C.paper], _theme: 0,
    };
    return ctx;
  }, [kit, scene]);

  // bind each chapter to its overlay once the DOM is there; warm up shaders
  useEffect(() => {
    const root = rootEl();
    const secs = root ? [...root.querySelectorAll("[data-ch]")] : [];
    kit.chapters.forEach((c, i) => {
      const sec = secs[i];
      c.els = sec ? Object.fromEntries([...sec.querySelectorAll("[data-k]")].map((e) => [e.dataset.k, e])) : {};
      c.sec = sec;
      c.bind?.(c.els, f);
    });
    kit.chapters.forEach((c) => (c.root.visible = true));
    gl.compile(scene, kit.persp);
    kit.chapters.forEach((c) => (c.root.visible = false));
    return timeline.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit]);

  const dom = useRef(null);
  useFrame((state, dt) => {
    const root = rootEl();
    if (!root) return;
    if (!dom.current) {
      dom.current = {
        sky: root.querySelector("[data-sky]"), wash: root.querySelector("[data-wash]"),
        chap: root.querySelector("[data-chap]"), pct: root.querySelector("[data-pct]"),
        bars: [...root.querySelectorAll("[data-bar]")], btns: [...root.querySelectorAll("[data-go]")],
      };
    }
    const d = dom.current;
    const T = timeline.step(Math.min(dt, 0.1));
    const ci = Math.min(8, Math.floor(T)), t = clamp(T - ci);
    Object.assign(f, { W: state.size.width, H: state.size.height, narrow: state.size.width < 760, time: state.clock.elapsedTime });
    f.px += (timeline.mx - f.px) * 0.05; f.py += (timeline.my - f.py) * 0.05;

    kit.rig.reset();
    f._theme = 0; f._sky = [C.paper, C.paper];
    kit.chapters.forEach((c, i) => {
      const on = i === ci;
      if (c.root.visible !== on) c.root.visible = on;
      if (c.sec && c.sec.dataset.on !== String(on)) { c.sec.dataset.on = String(on); c.sec.inert = !on; }
    });
    const ch = kit.chapters[ci];
    f.els = ch.els || {};
    ch.update(t, f);

    // sky, wash, theme
    const [top, bot] = f._sky;
    d.sky.style.background = `linear-gradient(180deg,${top} 0%,${bot} 100%)`;
    const near = Math.round(T), w = near >= 1 && near <= 8 ? clamp(1 - Math.abs(T - near) / WASH) : 0;
    d.wash.style.opacity = (w * w * (3 - 2 * w)).toFixed(3);
    d.wash.style.background = bot;
    const k = f._theme;
    const s = root.style;
    s.setProperty("--fg", mixHex(C.ink, "#EDEBE6", k));
    s.setProperty("--fg2", mixHex(C.graphite, "#A8A6A1", k));
    s.setProperty("--rule", k > 0.5 ? "rgba(237,235,230,.16)" : "rgba(20,20,19,.16)");
    s.setProperty("--bar", mixHex(C.paper, "#141416", k));
    s.setProperty("--panel", mixHex(C.sheet, "#1b1b1e", k));
    s.setProperty("--hi", k > 0.5 ? C.or : C.orInk);

    // chrome
    const label = `${pad(ci + 1)} / ${ch.name}`;
    if (d.chap.textContent !== label) d.chap.textContent = label;
    d.pct.textContent = Math.round((T / 9) * 100) + "%";
    d.bars.forEach((b, i) => { b.style.transform = `scaleX(${clamp(T - i).toFixed(3)})`; });
    d.btns.forEach((b, i) => b.classList.toggle("on", i === ci));

    gl.render(scene, f.active);
  }, 1);

  return null;
}

export default function Stage({ rootRef }) {
  return (
    <Canvas
      className="ac-gl"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh" }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      flat
      linear
      shadows="percentage"
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Runtime rootRef={rootRef} />
    </Canvas>
  );
}
