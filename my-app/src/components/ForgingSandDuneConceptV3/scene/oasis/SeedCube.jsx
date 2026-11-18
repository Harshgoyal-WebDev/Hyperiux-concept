"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { T } from "../../tuning";
import { TREE } from "../../world/oasis";
import { cubeY } from "../../world/oasisCamera";

// The cube at the lake's heart: small, glowing, turned a little, floating
// just over the island where the tree will grow. The sweep races out from
// it across the desert (world/revealMap.js); the beam runs on into it
// (Streaks.jsx); as it touches, the Yggdrasil's strands start streaming
// out of its outline, the whole tree drawing up from the bottom to the top
// in one (Yggdrasil.jsx).
//
// A solid glowing cube: its faces filled with its colour, its outline
// white-hot over them; no halo, and no flare or blast as the beam touches it.

const VERTEX = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uGlow;
uniform float uShow;
uniform float uLine;
varying vec3 vLocal;
void main() {
  // only its outline: how near an edge (the second largest of |x|, |y|,
  // |z| on a face), as a crisp line of a set share of the edge's length
  vec3 q = abs(vLocal) * 2.0;
  float big = max(q.x, max(q.y, q.z));
  float small = min(q.x, min(q.y, q.z));
  float e = q.x + q.y + q.z - big - small;
  float w = fwidth(e);
  float line = smoothstep(1.0 - uLine - w, 1.0 - uLine + w, e);
  // filled: its faces a solid glow of its colour, a touch brighter towards
  // the edges, and its outline white-hot over them (no halo round it)
  float a = mix(0.92, 1.0, line) * uShow;
  if (a < 0.003) discard;
  float hot = smoothstep(1.0 - uLine * 0.45, 1.0, e);
  vec3 face = uColor * (0.75 + 0.35 * smoothstep(0.2, 1.0, e));
  vec3 col = mix(face, mix(uColor * 1.6, vec3(1.0, 0.9, 0.78), hot * 0.6), line);
  gl_FragColor = vec4(col * uGlow, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, Math.max(b, a + 1e-4));

export default function SeedCube({ J }) {
  const parts = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color() },
        uGlow: { value: 1 },
        uShow: { value: 0 },
        uLine: { value: 0.08 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    cube.renderOrder = 5;
    cube.frustumCulled = false;
    cube.visible = false;
    return { cube, material };
  }, []);
  useEffect(
    () => () => {
      parts.cube.geometry.dispose();
      parts.material.dispose();
    },
    [parts]
  );

  useFrame(({ clock }) => {
    const p = J.progress;
    const t = clock.elapsedTime;
    // there as the camera turns to it (just before the sweep sets off from
    // it); the tree's strands stream out of it as it grows, and once the
    // tree has risen well past it, it fades away (no flare, no blast)
    const show = smooth(T.tlRevealStart - 0.012, T.tlRevealStart - 0.002, p);
    const span = Math.max(T.tlTreeGrowEnd - T.tlTreeGrowStart, 0.002);
    const gone = smooth(T.tlTreeGrowStart + span * 0.55, T.tlTreeGrowStart + span * 0.85, p);
    const k = show * (1 - gone);
    const on = k > 0.001 || J.warmup > 0;
    parts.cube.visible = on;
    if (!on) return;
    const u = parts.material.uniforms;
    u.uColor.value.set(T.cubeColor);
    u.uGlow.value = T.cubeGlow;
    u.uShow.value = k;
    parts.cube.scale.setScalar(T.cubeSize);
    const tilt = THREE.MathUtils.degToRad(T.cubeTilt);
    parts.cube.rotation.set(tilt, t * 0.25, tilt * 0.6);
    parts.cube.position.set(TREE.x, cubeY() + Math.sin(t * 1.1) * 0.12, TREE.z);
  });

  return <primitive object={parts.cube} />;
}
