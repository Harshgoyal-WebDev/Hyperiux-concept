"use client";
 

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { C } from "../timeline";
import { PROJECTS } from "../content";
import { PLANE, PLANES } from "../world/layout";
import { ORANGE } from "../world/materials";
import { THEME } from "../theme";

// Chapter 06, impact: a gallery of the real work. Large panes of glass stand
// along the hall, each holding a project (its own imagery from the site),
// revealed as the visitor approaches: a soft wipe opens across the image
// while it settles from a slight zoom. Their foot is lined with the orange
// path; each carries the project's name and year.
const SHOWN = ["montra", "yellow", "patronum", "monielink"];

function planeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uMap: { value: null },
        uReady: { value: 0 },
        uReveal: { value: 0 },
        uAspect: { value: 1.6 }, // the image's
        uPane: { value: PLANE.w / PLANE.h },
        uOrange: { value: ORANGE.clone().multiplyScalar(2.4) },
        uSize: { value: new THREE.Vector2(PLANE.w, PLANE.h) },
        uGlass: { value: new THREE.Vector3(...THEME.gallery.glass) },
        uFrame: { value: new THREE.Vector3(...THEME.gallery.frame) },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uReady, uReveal, uAspect, uPane;
      uniform vec3 uOrange, uGlass, uFrame;
      uniform vec2 uSize;
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        // cover-fit the image into the pane, settling from a slight zoom
        vec2 uv = vUv - 0.5;
        float zoom = mix(1.12, 1.0, uReveal);
        uv /= zoom;
        if (uAspect > uPane) uv.x *= uPane / uAspect; else uv.y *= uAspect / uPane;
        uv += 0.5;
        vec3 img = texture2D(uMap, uv).rgb;
        // the glass the image sits in
        vec3 glass = uGlass;
        // the wipe: a soft diagonal edge travelling across
        float edge = vUv.x * 0.85 + vUv.y * 0.15;
        float shown = smoothstep(edge - 0.12, edge, uReveal * 1.16) * uReady;
        vec3 col = mix(glass, img, shown);
        float a = mix(0.32, 1.0, shown);
        // a thin warm frame, its bottom lined with orange as it is revealed
        vec2 d = min(vUv, 1.0 - vUv) * uSize;
        float frame = 1.0 - smoothstep(0.025, 0.06, min(d.x, d.y));
        col = mix(col, uFrame, frame * 0.85);
        a = max(a, frame);
        float base = (1.0 - smoothstep(0.0, 0.05, vUv.y * uSize.y)) * smoothstep(0.0, 1.0, uReveal);
        col = mix(col, uOrange, base);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

function labelTexture(name, year, family) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d");
  g.fillStyle = `rgba(${THEME.gallery.ink},0.92)`;
  g.font = `500 44px ${family}`;
  g.fillText(name, 4, 58);
  const w = g.measureText(name).width;
  g.fillStyle = `rgba(${THEME.gallery.ink},0.55)`;
  g.font = `400 30px ${family}`;
  g.fillText(year, w + 26, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function Gallery() {
  const group = useRef();
  const res = useMemo(() => {
    const projects = SHOWN.map((id) => PROJECTS.find((p) => p.id === id));
    const plane = new THREE.PlaneGeometry(PLANE.w, PLANE.h);
    const labelGeo = new THREE.PlaneGeometry(3.2, 0.6);
    const mats = projects.map(() => planeMaterial());
    const labelMats = projects.map(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    return { projects, plane, labelGeo, mats, labelMats, textures: [] };
  }, []);

  // the images, and the labels once the brand face is in
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    res.projects.forEach((p, i) => {
      loader.load(p.images[0], (tex) => {
        if (!alive) return tex.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        res.textures.push(tex);
        const u = res.mats[i].uniforms;
        u.uMap.value = tex;
        u.uAspect.value = tex.image.width / tex.image.height;
        u.uReady.value = 1;
      });
    });
    const root = document.querySelector("[data-pj-root]");
    const family = (root && getComputedStyle(root).fontFamily) || "Arial, sans-serif";
    const draw = () => {
      if (!alive) return;
      res.projects.forEach((p, i) => {
        const t = labelTexture(p.name, p.year, family);
        res.textures.push(t);
        res.labelMats[i].map = t;
        res.labelMats[i].needsUpdate = true;
      });
    };
    (document.fonts?.load(`500 44px ${family}`) ?? Promise.resolve()).then(draw, draw);
    return () => {
      alive = false;
    };
  }, [res]);

  useEffect(
    () => () => {
      res.plane.dispose();
      res.labelGeo.dispose();
      res.mats.forEach((m) => m.dispose());
      res.labelMats.forEach((m) => m.dispose());
      res.textures.forEach((t) => t.dispose());
    },
    [res]
  );

  useFrame(() => {
    const on = C.t > 52 && C.t < 86;
    group.current.visible = on;
    if (!on) return;
    res.mats.forEach((m, i) => {
      m.uniforms.uReveal.value = C.gallery[i];
      res.labelMats[i].opacity = Math.max(0, C.gallery[i] * 1.4 - 0.4);
    });
  });

  return (
    <group ref={group}>
      {PLANES.map((p, i) => (
        <group key={i} position={p} rotation-y={PLANE.yaw}>
          <mesh geometry={res.plane} material={res.mats[i]} renderOrder={2} />
          <mesh geometry={res.labelGeo} material={res.labelMats[i]} position={[-PLANE.w / 2 + 1.6, -PLANE.h / 2 - 0.55, 0.01]} />
        </group>
      ))}
    </group>
  );
}
