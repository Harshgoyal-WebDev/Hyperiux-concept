"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LOGO } from "../geometry";
import { buildWorld } from "./layout";
import { linesMaterial, worldUniforms } from "./lines";
import { cameraAt } from "./rig";
import { markToWorld } from "./space";
import { WORLD, smooth, win } from "./store";
import { DEBUG, LOOK, onLayout } from "./tuning";

// The world behind the page: one fixed WebGL canvas, the camera flown by
// world time. Lines (lines.js), the city's solid bodies (so it hides what is
// behind it, like a hidden-line drawing), the mark's fill, and labels as
// HTML over it, projected every frame.

// the theme: the opening's dark ground turns light at frame 08 → 09 (its
// colours, tones and window are LOOK's, tunable)
const lightAt = (w) => smooth(LOOK.lightFrom, LOOK.lightTo, w);

// The mouse: the camera leans after it, a few degrees round its subject and
// a little off it, eased so it drifts rather than follows. (Mouse only — a
// touch is a scroll — and never with reduced motion.)
const POINTER = { x: 0, y: 0, ex: 0, ey: 0 };

// The mark's shapes, parsed from its own paths (geometry.js): the fills of
// the two verticals and the two bridges, the cube as its stroke (weight 7),
// and every outline as a polyline, for drawing.
function parseMark() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 501">${["verticalTL", "verticalBR", "bridgeBL", "bridgeTR"].map((k) => `<path d="${LOGO[k]}" fill="#fff"/>`).join("")}<path d="${LOGO.cubeOutline}${LOGO.cubeInner.join("")}" stroke="#fff" stroke-width="${LOGO.cubeStroke}" fill="none"/></svg>`;
  const data = new SVGLoader().parse(svg);
  const geos = [];
  const outlines = [];
  data.paths.forEach((path) => {
    const filled = path.userData.style.fill && path.userData.style.fill !== "none";
    if (filled) path.toShapes(true).forEach((shape) => geos.push(new THREE.ShapeGeometry(shape, 12)));
    else {
      const style = SVGLoader.getStrokeStyle(LOGO.cubeStroke, "#fff", "miter", "butt", 4);
      path.subPaths.forEach((sp) => {
        const g = SVGLoader.pointsToStroke(sp.getPoints(), style);
        if (g) geos.push(g);
      });
    }
    path.subPaths.forEach((sp) => {
      const pts = sp.getPoints().map((p) => [p.x, p.y]);
      if (filled && pts.length > 2) pts.push(pts[0]);
      outlines.push(pts);
    });
  });
  geos.forEach((g) => {
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const w = markToWorld(p.getX(i), p.getY(i));
      p.setXYZ(i, w[0], w[1], w[2]);
    }
  });
  const fill = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
  return { fill, outlines };
}

// every shape's body: unit boxes, instanced, rising as their edges are
// drawn and sinking as they are undrawn
const solidVert = /* glsl */ `
  attribute vec3 aMin;
  attribute vec3 aSize;
  attribute vec2 aGrow;
  attribute vec2 aOut;
  uniform float uW;
  void main() {
    float g = clamp((uW - aGrow.x) / aGrow.y, 0.0, 1.0) * (1.0 - clamp((uW - aOut.x) / aOut.y, 0.0, 1.0));
    vec3 p = position + 0.5;
    vec3 s = aSize * vec3(1.0, g, 1.0);
    vec3 w = aMin + p * s;
    // not yet risen (or sunk away): nothing at all, not a flat slab lying
    // on the ground hiding the lines there
    gl_Position = g <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;
const solidFrag = /* glsl */ `
  uniform vec3 uBg;
  void main() {
    gl_FragColor = vec4(uBg, 1.0);
    #include <colorspace_fragment>
  }
`;

// the mark's pieces (06): prisms, their walls rising with their corners
const prismVert = /* glsl */ `
  attribute vec2 aBase;
  attribute vec2 aGrow;
  attribute vec2 aOut;
  uniform float uW;
  void main() {
    float g = clamp((uW - aGrow.x) / aGrow.y, 0.0, 1.0) * (1.0 - clamp((uW - aOut.x) / aOut.y, 0.0, 1.0));
    vec3 w = vec3(position.x, aBase.x + position.y * aBase.y * g, position.z);
    gl_Position = g <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;

function prismGeometry(prisms) {
  const pos = [];
  const base = [];
  const grow = [];
  const out = [];
  const push = (x, f, z, pr) => {
    pos.push(x, f, z);
    base.push(pr.y0 + 0.004, pr.h - 0.012);
    grow.push(pr.t0, Math.max(pr.dur, 1e-3));
    out.push(pr.out ? pr.out[0] : 1e6, pr.out ? Math.max(pr.out[1] - pr.out[0], 1e-3) : 1);
  };
  for (const pr of prisms) {
    // a hair inside its outline, so its own lines stay in front of it
    const cx = pr.poly.reduce((a, p) => a + p[0], 0) / pr.poly.length;
    const cz = pr.poly.reduce((a, p) => a + p[1], 0) / pr.poly.length;
    const poly = pr.poly.map(([x, z]) => {
      const d = Math.hypot(cx - x, cz - z) || 1;
      return [x + ((cx - x) / d) * 0.012, z + ((cz - z) / d) * 0.012];
    });
    const tris = THREE.ShapeUtils.triangulateShape(poly.map(([x, z]) => new THREE.Vector2(x, z)), []);
    for (const f of [0, 1]) for (const t of tris) for (const i of t) push(poly[i][0], f, poly[i][1], pr);
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k];
      const b = poly[(k + 1) % poly.length];
      for (const [q, f] of [[a, 0], [b, 0], [b, 1], [a, 0], [b, 1], [a, 1]]) push(q[0], f, q[1], pr);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aBase", new THREE.Float32BufferAttribute(base, 2));
  g.setAttribute("aGrow", new THREE.Float32BufferAttribute(grow, 2));
  g.setAttribute("aOut", new THREE.Float32BufferAttribute(out, 2));
  return g;
}

// a client's logo on its cube's top face (17): the image as a mask in ink,
// in as the top closes, fading with the fog like the lines
const logoVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const logoFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uWin;
  uniform float uW;
  uniform vec3 uInk;
  uniform vec3 uFocus;
  uniform vec2 uFog;
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    float a = texture2D(uMap, vUv).a * smoothstep(uWin.x, uWin.y, uW) * (1.0 - smoothstep(uFog.x, uFog.y, distance(vW, uFocus)));
    if (a < 0.01) discard;
    gl_FragColor = vec4(uInk, a * 0.92);
    #include <colorspace_fragment>
  }
`;

// an SVG drawn into a canvas (sharp at any size), its aspect kept
function logoTexture(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = 512 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
      const w = Math.max(1, Math.round((img.naturalWidth || 512) * k));
      const h = Math.max(1, Math.round((img.naturalHeight || 512) * k));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 4;
      resolve({ tex: t, aspect: w / h });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function Scene({ world, labelRefs, mobile }) {
  const { gl, size } = useThree();
  const camera = useThree((s) => s.camera);
  const shared = useMemo(() => worldUniforms(), []);
  const { mark, labels: labelData } = world;

  const lines = useMemo(() => {
    const geo = world.lines.geometry();
    return new THREE.Mesh(geo, linesMaterial(shared));
  }, [world, shared]);

  const solids = useMemo(() => {
    const base = new THREE.BoxGeometry(1, 1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.attributes.position);
    const n = world.solids.length;
    const min = new Float32Array(n * 3);
    const sz = new Float32Array(n * 3);
    const grow = new Float32Array(n * 2);
    const out = new Float32Array(n * 2);
    world.solids.forEach((s, i) => {
      // a hair inside its edges, so its own lines stay in front of it (a
      // sheet is already set just behind its outline)
      for (let k = 0; k < 3; k++) {
        const e = s.size[k] > 0.1 ? 0.01 : 0;
        min[i * 3 + k] = s.min[k] + e;
        sz[i * 3 + k] = s.size[k] - 2 * e;
      }
      grow[i * 2] = s.t0;
      grow[i * 2 + 1] = Math.max(s.dur, 1e-3);
      out[i * 2] = s.out ? s.out[0] : 1e6;
      out[i * 2 + 1] = s.out ? Math.max(s.out[1] - s.out[0], 1e-3) : 1;
    });
    g.setAttribute("aMin", new THREE.InstancedBufferAttribute(min, 3));
    g.setAttribute("aSize", new THREE.InstancedBufferAttribute(sz, 3));
    g.setAttribute("aGrow", new THREE.InstancedBufferAttribute(grow, 2));
    g.setAttribute("aOut", new THREE.InstancedBufferAttribute(out, 2));
    g.instanceCount = n;
    const m = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: solidVert, fragmentShader: solidFrag, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    return new THREE.Mesh(g, m);
  }, [world, shared]);

  const prisms = useMemo(
    () => new THREE.Mesh(prismGeometry(world.prisms), new THREE.ShaderMaterial({ uniforms: shared, vertexShader: prismVert, fragmentShader: solidFrag, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })),
    [world, shared]
  );

  // the clients' logos: a plane each, its texture loaded when it can be
  const logos = useMemo(() => {
    const group = new THREE.Group();
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    world.logos.forEach((l) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uW: shared.uW, uInk: shared.uInk, uFocus: shared.uFocus, uFog: shared.uFog, uMap: { value: null }, uWin: { value: new THREE.Vector2(l.t0, l.t1) } },
        vertexShader: logoVert,
        fragmentShader: logoFrag,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(plane, m);
      mesh.position.set(l.p[0], l.p[1] + 0.006, l.p[2]);
      mesh.rotation.y = THREE.MathUtils.degToRad(l.turn);
      mesh.scale.setScalar(l.size);
      mesh.visible = false;
      mesh.renderOrder = 1;
      mesh.userData.src = l.src;
      group.add(mesh);
    });
    group.userData.plane = plane;
    return group;
  }, [world, shared]);

  useEffect(() => {
    let alive = true;
    const loaded = [];
    logos.children.forEach((mesh) => {
      logoTexture(mesh.userData.src).then((r) => {
        if (!r) return;
        if (!alive) return r.tex.dispose();
        loaded.push(r.tex);
        mesh.material.uniforms.uMap.value = r.tex;
        const s = mesh.scale.x;
        mesh.scale.set(r.aspect >= 1 ? s : s * r.aspect, 1, r.aspect >= 1 ? s / r.aspect : s);
        mesh.visible = true;
      });
    });
    return () => {
      alive = false;
      loaded.forEach((t) => t.dispose());
      logos.children.forEach((m) => m.material.dispose());
      logos.userData.plane.dispose();
    };
  }, [logos]);

  // (over everything: nothing in the world stands in front of the mark)
  const fill = useMemo(() => new THREE.Mesh(mark.fill, new THREE.MeshBasicMaterial({ color: "#fff", transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide })), [mark]);

  useEffect(() => {
    for (const o of [lines, solids, prisms, fill]) o.frustumCulled = false;
    solids.renderOrder = 0;
    prisms.renderOrder = 0;
    lines.renderOrder = 1;
    fill.renderOrder = 2;
    return () => {
      lines.geometry.dispose();
      lines.material.dispose();
      solids.geometry.dispose();
      solids.material.dispose();
      prisms.geometry.dispose();
      prisms.material.dispose();
      fill.geometry.dispose();
      fill.material.dispose();
    };
  }, [lines, solids, prisms, fill]);

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), bg: new THREE.Color(), a: new THREE.Color(), b: new THREE.Color() }), []);

  useFrame((state, delta) => {
    const W = DEBUG.lock ? DEBUG.W : WORLD.W;
    const c = cameraAt(W);
    const aspect = size.width / size.height;
    // parallax: none while the view is the mark (it must line up exactly)
    const e = 1 - Math.exp(-Math.min(delta, 0.1) * LOOK.leanEase);
    POINTER.ex += (POINTER.x - POINTER.ex) * e;
    POINTER.ey += (POINTER.y - POINTER.ey) * e;
    const lean = WORLD.reduced ? 0 : smooth(1.2, 10, c.fov);
    c.yaw += POINTER.ex * LOOK.leanYaw * lean;
    c.pitch = Math.max(1, c.pitch - POINTER.ey * LOOK.leanPitch * lean);
    // on a phone, frame wider (it is narrow) and centre the subject
    const R = c.size * (mobile ? Math.min(Math.max(1.15 / aspect, 1), 2.4) : 1);
    const fov = c.fov;
    const dist = R / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const yaw = THREE.MathUtils.degToRad(c.yaw);
    const pitch = THREE.MathUtils.degToRad(c.pitch);
    camera.position.set(c.tx + dist * Math.sin(yaw) * Math.cos(pitch), c.ty + dist * Math.sin(pitch), c.tz + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(c.tx, c.ty, c.tz);
    camera.fov = fov;
    camera.near = Math.max(0.05, dist * 0.08);
    camera.far = dist * 4 + 320;
    camera.updateProjectionMatrix();
    // the subject's place on the screen: shift the image (an off-axis
    // frustum), so the perspective stays the camera's own
    const sx = mobile ? c.mx : c.sx;
    const sy = mobile ? c.my : c.sy;
    camera.projectionMatrix.elements[8] -= sx - POINTER.ex * LOOK.leanShift * lean;
    camera.projectionMatrix.elements[9] -= sy + POINTER.ey * LOOK.leanShift * lean;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

    // the theme
    const m = lightAt(W);
    const L = LOOK;
    tmp.bg.set(L.darkBg).lerp(tmp.a.set(L.lightBg), m);
    shared.uBg.value.copy(tmp.bg);
    shared.uInk.value.set(L.darkInk).lerp(tmp.b.set(L.lightInk), m);
    shared.uAccent.value.set(L.accent);
    shared.uGuide.value.set(L.guide);
    const mix = (a, b) => a + (b - a) * m;
    shared.uTone.value.set(mix(L.darkToneInk, L.lightToneInk), mix(L.darkToneGuide, L.lightToneGuide), L.toneAccent, mix(L.darkToneFaint, L.lightToneFaint));
    shared.uWidth.value = L.lineWidth;
    gl.setClearColor(tmp.bg, 1);

    shared.uW.value = W;
    shared.uTime.value = state.clock.elapsedTime;
    shared.uRes.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
    shared.uPx.value = gl.getPixelRatio();
    shared.uNear.value = camera.near;
    shared.uFocus.value.set(c.tx, c.ty, c.tz);
    shared.uFog.value.set(R * LOOK.fogNear + 3, R * LOOK.fogFar + 12);

    // the mark's fill: in as the mark completes (04), and at the end (20)
    fill.material.color.copy(shared.uInk.value);
    fill.material.opacity = (win(W, 3.0, 3.35, 4.0, 4.4) + win(W, 19.05, 19.4)) * LOOK.markFill;
    fill.visible = fill.material.opacity > 0.002;

    // labels
    const w = size.width;
    const h = size.height;
    labelData.forEach((l, i) => {
      const el = labelRefs.current[i];
      if (!el) return;
      const a = win(W, l.t0, l.t0 + 0.12, l.t1 - 0.12, l.t1);
      if (a <= 0.01) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        return;
      }
      tmp.v.set(l.p[0], l.p[1], l.p[2]).project(camera);
      if (tmp.v.z > 1 || tmp.v.z < -1) {
        el.style.opacity = "0";
        return;
      }
      const d = Math.hypot(l.p[0] - c.tx, l.p[1] - c.ty, l.p[2] - c.tz);
      const fog = smooth(R * LOOK.fogNear + 3, R * LOOK.fogFar + 12, d);
      el.style.opacity = String(a * (1 - fog) * LOOK.labelOpacity);
      el.style.transform = `translate3d(${((tmp.v.x + 1) / 2) * w}px, ${((1 - tmp.v.y) / 2) * h}px, 0)`;
    });
  });

  return (
    <>
      <primitive object={solids} />
      <primitive object={prisms} />
      <primitive object={logos} />
      <primitive object={fill} />
      <primitive object={lines} />
    </>
  );
}

// (client only: the page loads it without server rendering)
export default function World({ mobile }) {
  const labelRefs = useRef([]);
  // the world is rebuilt when its layout is tuned (TuningPanel.jsx)
  const [version, setVersion] = useState(0);
  useEffect(() => onLayout(() => setVersion((v) => v + 1)), []);
  const mark = useMemo(() => parseMark(), []);
  const world = useMemo(() => ({ mark, ...buildWorld(mark), version }), [mark, version]);
  const { labels } = world;
  useEffect(() => {
    const move = (e) => {
      if (e.pointerType !== "mouse") return;
      POINTER.x = (e.clientX / window.innerWidth) * 2 - 1;
      POINTER.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const leave = () => {
      POINTER.x = 0;
      POINTER.y = 0;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ fov: 34, near: 0.05, far: 1000, position: [0, 2, 6] }}
        flat
        style={{ position: "absolute", inset: 0 }}
      >
        <Scene world={world} labelRefs={labelRefs} mobile={mobile} />
      </Canvas>
      <div className="absolute inset-0 overflow-hidden">
        {labels.map((l, i) => (
          <span
            key={i}
            ref={(el) => (labelRefs.current[i] = el)}
            className={`bp-mono absolute left-0 top-0 ${l.dense ? "max-md:hidden" : "flex"} md:flex -translate-x-1/2 -translate-y-full items-center gap-2 whitespace-nowrap pb-1 text-[10px] uppercase tracking-[0.16em] md:text-[11px] ${l.accent ? "text-[var(--bp-accent)]" : "text-[var(--bp-muted)]"}`}
            style={{ opacity: 0, willChange: "transform, opacity" }}
          >
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
}
