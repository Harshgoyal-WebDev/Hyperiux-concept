"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CHAPTERS } from "./chapters";
import { C, LI, clamp, mixHex, pad } from "./kit";
import { timeline } from "./timeline";
import { buildWorld } from "./world/world";
import { redrawLooks } from "./world/looks";

// The one WebGL stage behind the page. The world (world/world.js) is built
// once and driven by global T (0–8); nothing is swapped between chapters, so
// the camera and every object carry straight on. Each chapter only owns its
// DOM layer (copy, cards, labels), driven by its local t (0–1). The shared
// lights and fog are reset each frame; the page chrome is updated here too.

function makeRig() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd6cfc2, 0);
  const amb = new THREE.AmbientLight(0xffffff, 0);
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
  const rim = new THREE.DirectionalLight(0xffffff, 0);
  rim.position.set(0, 24, -50);
  const rig = { hemi, amb, sun, rim, fog: new THREE.Fog(0xe7e6e2, 50, 150), objects: [hemi, amb, sun, sun.target, rim] };
  rig.reset = () => {
    hemi.intensity = 0.6 * LI; amb.intensity = 0;
    sun.intensity = 0.8 * LI; sun.color.set(0xffffff);
    rim.intensity = 0;
  };
  rig.reset();
  return rig;
}

function Runtime({ rootRef }) {
  const { gl, scene } = useThree();

  const kit = useMemo(() => {
    const persp = new THREE.PerspectiveCamera(40, 1, 0.3, 600);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
    const rig = makeRig();
    const world = buildWorld();
    const chapters = CHAPTERS.map((c) => ({ ...c, els: {}, state: {} }));
    return { persp, ortho, rig, world, chapters };
  }, []);

  // frame context handed to the world and to every chapter
  const f = useMemo(() => {
    const ctx = {
      cam: kit.persp, ortho: kit.ortho, rig: kit.rig, scene, canvas: gl.domElement,
      W: 1, H: 1, narrow: false, time: 0, px: 0, py: 0, els: {},
      active: kit.persp,
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
  }, [kit, scene, gl]);

  // the world and lights join the scene here, not in useMemo: React may run a
  // memo twice in development, and both copies would end up in the scene
  useEffect(() => {
    scene.add(kit.world.root, ...kit.rig.objects);
    scene.fog = kit.rig.fog;
    return () => { scene.remove(kit.world.root, ...kit.rig.objects); scene.fog = null; };
  }, [kit, scene]);

  // bind each chapter to its overlay once the DOM is there; redraw the screens once fonts load
  useEffect(() => {
    const root = rootRef.current;
    const secs = root ? [...root.querySelectorAll("[data-ch]")] : [];
    kit.chapters.forEach((c, i) => {
      const sec = secs[i];
      c.els = sec ? Object.fromEntries([...sec.querySelectorAll("[data-k]")].map((e) => [e.dataset.k, e])) : {};
      c.sec = sec;
      c.bind?.(c.els, f, kit.world.api, c.state);
    });
    let alive = true;
    document.fonts?.ready.then(() => alive && redrawLooks());
    const stop = timeline.start(CHAPTERS.length);
    return () => { alive = false; stop(); };
  }, [kit, f, rootRef]);

  const dom = useRef(null);
  useFrame((state, dt) => {
    const root = rootRef.current;
    if (!root) return;
    if (!dom.current) {
      dom.current = {
        sky: root.querySelector("[data-sky]"),
        chap: root.querySelector("[data-chap]"), pct: root.querySelector("[data-pct]"),
        bars: [...root.querySelectorAll("[data-bar]")], btns: [...root.querySelectorAll("[data-go]")],
      };
    }
    const d = dom.current, N = CHAPTERS.length;
    const T = timeline.step(Math.min(dt, 0.1));
    const ci = Math.min(N - 1, Math.floor(T)), t = clamp(T - ci);
    Object.assign(f, { W: state.size.width, H: state.size.height, narrow: state.size.width < 760, time: state.clock.elapsedTime });
    f.px += (timeline.mx - f.px) * 0.05; f.py += (timeline.my - f.py) * 0.05;

    kit.rig.reset();
    f._theme = 0; f._sky = [C.paper, C.paper];
    kit.world.update(T, f);

    kit.chapters.forEach((c, i) => {
      const on = i === ci;
      if (c.sec && c.sec.dataset.on !== String(on)) { c.sec.dataset.on = String(on); c.sec.inert = !on; }
    });
    const ch = kit.chapters[ci];
    f.els = ch.els;
    ch.dom?.(t, f, kit.world.api, ch.state);

    // sky + theme
    const [top, bot] = f._sky;
    d.sky.style.background = `linear-gradient(180deg,${top} 0%,${bot} 100%)`;
    const k = f._theme, s = root.style;
    s.setProperty("--fg", mixHex(C.ink, "#EDEBE6", k));
    s.setProperty("--fg2", mixHex(C.graphite, "#A8A6A1", k));
    s.setProperty("--rule", k > 0.5 ? "rgba(237,235,230,.16)" : "rgba(20,20,19,.16)");
    s.setProperty("--bar", mixHex(C.paper, "#141416", k));
    s.setProperty("--panel", mixHex(C.sheet, "#1b1b1e", k));
    s.setProperty("--hi", k > 0.5 ? C.or : C.orInk);

    // chrome
    const label = `${pad(ci + 1)} / ${ch.name}`;
    if (d.chap.textContent !== label) d.chap.textContent = label;
    d.pct.textContent = Math.round((T / N) * 100) + "%";
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
      legacy
      shadows="percentage"
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Runtime rootRef={rootRef} />
    </Canvas>
  );
}
