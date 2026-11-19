"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: the precompiler's own state is mutated inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Shaders compiled ahead, behind the loader: three compiles a material's
// program the first time it is drawn, and that blocks the frame (hundreds
// of milliseconds to seconds for the page's big custom materials). Most of
// the page's things are first drawn deep into the scroll — the broken rock,
// the gravel and sand at the break, the whole oasis at the cut — so each
// arrived as a stall while scrolling.
//
// Whenever new materials have come into the scene (the models arrive over
// the first seconds), everything is drawn once, off screen into a 1 × 1
// target: every object shown, on every layer, none culled — so each program
// is built in exactly the variant the frame draws it in (renderer.compile()
// alone missed some: a few states differ between it and a real draw). Then
// all is put back as it was. The shaders are first started in the background
// (compileAsync: the driver compiles them in parallel), and the draw waits
// for them, so it doesn't block either.
const CHECK_EVERY = 0.5; // s
const UNTIL = 40; // s after mount: by then everything has arrived

const TEXTURE_KEYS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap", "displacementMap", "lightMap"];

export default function Precompile({ post }) {
  const { gl, scene, camera } = useThree();
  const s = useMemo(
    () => ({
      t: 0,
      next: 0.3,
      seen: new WeakSet(),
      state: "idle", // idle → compiling → draw
      target: new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }),
    }),
    []
  );
  useEffect(() => () => s.target.dispose(), [s]);

  // everything drawn once, off screen, then put back as it was
  const drawAll = () => {
    const shown = [];
    const unculled = [];
    scene.traverse((o) => {
      // (not the lights: a light switched on changes every lit material's
      // variant — the draw would build the wrong ones)
      if (o.isLight) return;
      if (!o.visible) {
        o.visible = true;
        shown.push(o);
      }
      if (o.frustumCulled && (o.isMesh || o.isPoints || o.isLine || o.isSprite)) {
        o.frustumCulled = false;
        unculled.push(o);
      }
    });
    const mask = camera.layers.mask;
    camera.layers.enableAll();
    const prev = gl.getRenderTarget();
    // (the shadows drawn too: their depth shaders — the plants' own — are
    // built as the shadow map is drawn)
    gl.shadowMap.needsUpdate = true;
    try {
      gl.setRenderTarget(post ? s.target : null);
      gl.render(scene, camera);
    } finally {
      gl.setRenderTarget(prev);
      camera.layers.mask = mask;
      // (...and redrawn as they really are on the next frame)
      gl.shadowMap.needsUpdate = true;
      for (const o of shown) o.visible = false;
      for (const o of unculled) o.frustumCulled = true;
    }
  };

  useFrame((_, delta) => {
    s.t += Math.min(delta, 0.25);
    if (s.state === "draw") {
      s.state = "idle";
      drawAll();
      return;
    }
    if (s.state !== "idle" || s.t < s.next || s.t > UNTIL) return;
    s.next = s.t + CHECK_EVERY;
    // anything new?
    let fresh = 0;
    scene.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        if (s.seen.has(m)) continue;
        s.seen.add(m);
        fresh++;
        // (its textures uploaded now, not on the frame that first draws it)
        for (const k of TEXTURE_KEYS) {
          const tex = m[k];
          if (tex?.isTexture && tex.version > 0 && !(tex.image && tex.image.complete === false)) gl.initTexture(tex);
        }
      }
    });
    if (!fresh) return;
    // start them compiling in the background, then draw once they are built
    s.state = "compiling";
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(post ? s.target : null);
    let done;
    try {
      done = gl.compileAsync(scene, camera);
    } finally {
      gl.setRenderTarget(prev);
    }
    if (window.location.search.includes("debug")) Object.assign(window, { __gl: gl, __scene: scene }); // (?debug: for inspection)
    done.then(
      () => (s.state = "draw"),
      () => (s.state = "draw")
    );
  });

  return null;
}
