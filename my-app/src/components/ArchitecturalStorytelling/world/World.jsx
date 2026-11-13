"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LOGO } from "../geometry";
import { PROJECTS } from "../content";
import { buildWorld } from "./layout";
import { linesMaterial, worldUniforms } from "./lines";
import { cameraAt } from "./rig";
import { markToWorld } from "./space";
import { WORLD, onFeatured, pickProject, smooth, win } from "./store";
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

// an SVG drawn into a canvas (sharp at any size), trimmed to what it draws
// (the clients' icons sit small in a wide empty box: cropped to the mark
// itself, it fills its face), its aspect kept
function logoTexture(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = 1024 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
      const w = Math.max(1, Math.round((img.naturalWidth || 1024) * k));
      const h = Math.max(1, Math.round((img.naturalHeight || 1024) * k));
      const full = document.createElement("canvas");
      full.width = w;
      full.height = h;
      const fx = full.getContext("2d", { willReadFrequently: true });
      fx.drawImage(img, 0, 0, w, h);
      const px = fx.getImageData(0, 0, w, h).data;
      let x0 = w;
      let y0 = h;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (px[(y * w + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      let c = full;
      if (x1 >= x0 && y1 >= y0) {
        const pad = 4;
        x0 = Math.max(0, x0 - pad);
        y0 = Math.max(0, y0 - pad);
        x1 = Math.min(w - 1, x1 + pad);
        y1 = Math.min(h - 1, y1 + pad);
        c = document.createElement("canvas");
        c.width = x1 - x0 + 1;
        c.height = y1 - y0 + 1;
        c.getContext("2d").drawImage(full, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
      }
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 8;
      resolve({ tex: t, aspect: c.width / c.height });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// a project's picture on a wall of the hall (15 – 16): its imagery wiped in
// from the top as its frame closes (as the page reveals its images), going
// into the ground with the fog; the end wall's cross-fades to whichever
// project the case study shows. (Captions use it too, see-through.)
const pictureFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uPrev;
  uniform float uMix;
  uniform vec2 uWin;
  uniform float uW;
  uniform vec3 uBg;
  uniform vec3 uFocus;
  uniform vec2 uFog;
  uniform float uSolid;
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    float r = smoothstep(uWin.x, uWin.y, uW);
    if (r <= 0.0 || vUv.y < 1.0 - r) discard;
    vec4 c = mix(texture2D(uPrev, vUv), texture2D(uMap, vUv), uMix);
    float fog = smoothstep(uFog.x, uFog.y, distance(vW, uFocus));
    if (uSolid > 0.5) {
      gl_FragColor = vec4(mix(mix(uBg, c.rgb, c.a), uBg, fog), 1.0);
    } else {
      float a = c.a * (1.0 - fog);
      if (a < 0.01) discard;
      gl_FragColor = vec4(c.rgb, a);
    }
    #include <colorspace_fragment>
  }
`;

// the page's two faces, as the canvas can name them (next/font's families)
function pageFonts() {
  const root = document.querySelector(".bp-root") || document.body;
  const probe = document.createElement("span");
  probe.className = "bp-mono";
  root.appendChild(probe);
  const mono = getComputedStyle(probe).fontFamily || "ui-monospace, monospace";
  probe.remove();
  return { sans: getComputedStyle(root).fontFamily || "sans-serif", mono };
}

// a project's caption, set on the wall under its picture: its number, its
// year, its name and its services, in the page's type
const CAPTION = { w: 1024, h: 240 };
function captionTexture(project, index, fonts) {
  const c = document.createElement("canvas");
  c.width = CAPTION.w;
  c.height = CAPTION.h;
  const x = c.getContext("2d");
  x.textBaseline = "alphabetic";
  x.font = `500 30px ${fonts.mono}`;
  x.fillStyle = "#ff5f00";
  x.fillText(String(index + 1).padStart(2, "0"), 4, 36);
  x.fillStyle = "#777777";
  x.textAlign = "right";
  x.fillText(project.year, CAPTION.w - 4, 36);
  x.textAlign = "left";
  x.fillStyle = "#111111";
  x.font = `400 104px ${fonts.sans}`;
  x.fillText(project.name, 0, 148);
  x.fillStyle = "#777777";
  x.font = `400 28px ${fonts.mono}`;
  if ("letterSpacing" in x) x.letterSpacing = "5px";
  x.fillText(project.services.join(" · ").toUpperCase(), 4, 214);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Scene({ world, labelRefs, hotRefs, mobile }) {
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

  // the work's pictures on the hall's walls, their captions under them, and
  // the case study's on its end wall
  const pictures = useMemo(() => {
    const group = new THREE.Group();
    const plane = new THREE.PlaneGeometry(1, 1);
    const material = (t0, t1, solid) =>
      new THREE.ShaderMaterial({
        uniforms: { uW: shared.uW, uBg: shared.uBg, uFocus: shared.uFocus, uFog: shared.uFog, uMap: { value: null }, uPrev: { value: null }, uMix: { value: 1 }, uWin: { value: new THREE.Vector2(t0, t1) }, uSolid: { value: solid ? 1 : 0 } },
        vertexShader: logoVert,
        fragmentShader: pictureFrag,
        transparent: !solid,
        depthWrite: solid,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
    const items = world.pictures.map((pic) => {
      const mesh = new THREE.Mesh(plane, material(pic.t0, pic.t1, true));
      mesh.position.set(pic.p[0], pic.p[1], pic.p[2]);
      mesh.rotation.y = pic.turn;
      mesh.scale.set(pic.w, pic.h, 1);
      mesh.visible = false;
      mesh.frustumCulled = false;
      group.add(mesh);
      let caption = null;
      if (pic.caption) {
        caption = new THREE.Mesh(plane, material(pic.t0 + 0.05, pic.t1 + 0.05, false));
        caption.position.set(pic.caption[0], pic.caption[1], pic.caption[2]);
        caption.rotation.y = pic.turn;
        caption.scale.set(pic.w, (pic.w * CAPTION.h) / CAPTION.w, 1);
        caption.visible = false;
        caption.renderOrder = 1;
        group.add(caption);
      }
      return { pic, mesh, caption };
    });
    group.updateMatrixWorld(true);
    group.userData = { plane, items, fade: null };
    return group;
  }, [world, shared]);

  // their imagery, loaded once; the end wall follows the featured project
  useEffect(() => {
    let alive = true;
    const { items } = pictures.userData;
    const loader = new THREE.TextureLoader();
    const aniso = gl.capabilities.getMaxAnisotropy();
    const texs = PROJECTS.map((p) => {
      const t = loader.load(p.image, () => alive && show());
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, aniso);
      return t;
    });
    const ready = (t) => !!t.image && (t.image.complete ?? true);
    const feature = items.find((it) => it.pic.kind === "feature");
    let featured = -1;
    function show() {
      items.forEach((it) => {
        if (it.pic.kind !== "work") return;
        const t = texs[it.pic.i];
        if (!t || !ready(t)) return;
        const u = it.mesh.material.uniforms;
        u.uMap.value = u.uPrev.value = t;
        it.mesh.visible = true;
      });
      if (feature && featured >= 0 && ready(texs[featured]) && !feature.mesh.visible) {
        const u = feature.mesh.material.uniforms;
        u.uMap.value = u.uPrev.value = texs[featured];
        u.uMix.value = 1;
        feature.mesh.visible = true;
      }
    }
    const stop = onFeatured((i) => {
      featured = i;
      if (!feature) return;
      const u = feature.mesh.material.uniforms;
      if (!feature.mesh.visible) return show();
      u.uPrev.value = u.uMap.value;
      u.uMap.value = texs[i];
      u.uMix.value = 0;
    });
    // the captions, once the page's type has loaded
    const captions = [];
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!alive) return;
      const fonts = pageFonts();
      items.forEach((it) => {
        if (!it.caption) return;
        const t = captionTexture(PROJECTS[it.pic.i], it.pic.i, fonts);
        captions.push(t);
        const u = it.caption.material.uniforms;
        u.uMap.value = u.uPrev.value = t;
        it.caption.visible = true;
      });
    });
    return () => {
      alive = false;
      stop();
      texs.forEach((t) => t.dispose());
      captions.forEach((t) => t.dispose());
      items.forEach((it) => {
        it.mesh.material.dispose();
        it.caption?.material.dispose();
      });
      pictures.userData.plane.dispose();
    };
  }, [pictures, gl]);

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
  const CORNERS = useMemo(() => [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], []);

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

    const w = size.width;
    const h = size.height;

    // the end wall's picture cross-fading to the project chosen
    pictures.userData.items.forEach((it) => {
      const u = it.mesh.material.uniforms;
      if (u.uMix.value < 1) u.uMix.value = Math.min(1, u.uMix.value + delta * 2.2);
    });

    // the pictures on the walls answer the pointer: a target over each, where
    // it is on the screen (the page opens its case study)
    const fogN = R * LOOK.fogNear + 3;
    const fogF = R * LOOK.fogFar + 12;
    let hot = 0;
    pictures.userData.items.forEach((it) => {
      if (it.pic.kind !== "work") return;
      const el = hotRefs.current[hot++];
      if (!el) return;
      const p = it.pic;
      const d = Math.hypot(p.p[0] - c.tx, p.p[1] - c.ty, p.p[2] - c.tz);
      let on = it.mesh.visible && W > p.t1 && W < 15.35 && smooth(fogN, fogF, d) < 0.5;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      if (on) {
        for (const [a, b] of CORNERS) {
          tmp.v.set(a, b, 0).applyMatrix4(it.mesh.matrixWorld).project(camera);
          if (tmp.v.z > 1 || tmp.v.z < -1) {
            on = false;
            break;
          }
          const sx = ((tmp.v.x + 1) / 2) * w;
          const sy = ((1 - tmp.v.y) / 2) * h;
          x0 = Math.min(x0, sx);
          x1 = Math.max(x1, sx);
          y0 = Math.min(y0, sy);
          y1 = Math.max(y1, sy);
        }
      }
      if (on) {
        x0 = Math.max(0, x0);
        y0 = Math.max(0, y0);
        x1 = Math.min(w, x1);
        y1 = Math.min(h, y1);
        on = x1 - x0 > 40 && y1 - y0 > 40;
      }
      if (!on) {
        if (el.style.display !== "none") el.style.display = "none";
        return;
      }
      el.style.display = "block";
      el.style.transform = `translate3d(${x0}px, ${y0}px, 0)`;
      el.style.width = `${x1 - x0}px`;
      el.style.height = `${y1 - y0}px`;
    });

    // labels
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
      <primitive object={pictures} />
      <primitive object={fill} />
      <primitive object={lines} />
    </>
  );
}

// (client only: the page loads it without server rendering)
export default function World({ mobile }) {
  const labelRefs = useRef([]);
  const hotRefs = useRef([]);
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
    <>
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ fov: 34, near: 0.05, far: 1000, position: [0, 2, 6] }}
        flat
        style={{ position: "absolute", inset: 0 }}
      >
        <Scene world={world} labelRefs={labelRefs} hotRefs={hotRefs} mobile={mobile} />
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
    {/* over the page's copy: the targets on the work's pictures in the hall
        (pointer only; the section lists the projects for the keyboard) */}
    <div className="pointer-events-none fixed inset-0 z-[15] overflow-hidden" aria-hidden="true">
      {PROJECTS.map((p, i) => (
        <button
          key={p.id}
          ref={(el) => (hotRefs.current[i] = el)}
          type="button"
          tabIndex={-1}
          title={`${p.name}: open the case study`}
          onClick={() => pickProject(i)}
          className="pointer-events-auto absolute left-0 top-0 cursor-pointer"
          style={{ display: "none", willChange: "transform" }}
        />
      ))}
    </div>
    </>
  );
}
