"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../world/layout";
import { makeOrbits, syncOrbit } from "../world/swirl";
import { breakupGLSL, breakupUniforms, puffDirection, samplePieceSurfaces } from "../world/breakup";
import { T } from "../tuning";

// The sand the broken rock turns into (see world/breakup.js): grains come
// off each piece exactly where it wears away, a few still hot from the
// cracks, and flow smoothly out into the swirl round the mark.

const vertexShader = (pieces) => /* glsl */ `
${breakupGLSL(pieces)}
attribute vec3 aLocal; // on its piece, asset metres from the piece's pivot
attribute vec4 aInfo; // piece index, erosion threshold, size (m), tint
attribute vec4 aDrift; // puff direction, seed
uniform float uScale;
uniform float uSize;
varying float vA;
varying float vTint;
varying float vHot;
void main() {
  vec3 p;
  float g = breakupFlow(int(aInfo.x + 0.5), aLocal, aInfo.y, aDrift, p);
  if (g < 0.0) {
    // still stone
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vA = 0.0;
    return;
  }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = aInfo.z * uSize * uScale / max(-mv.z, 1.0);
  gl_PointSize = clamp(px, 1.0, 6.0);
  vA = smoothstep(0.0, 0.03, g) * min(px, 1.0);
  vTint = aInfo.w;
  // a few grains still hot from the cracks, cooling on the way out
  vHot = step(0.88, fract(aDrift.w * 7.13)) * (1.0 - smoothstep(0.0, 0.45, g));
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uDark;
uniform vec3 uLight;
uniform vec3 uHotColor;
uniform float uOpacity;
uniform float uBright;
varying float vA;
varying float vTint;
varying float vHot;
void main() {
  if (vA < 0.004) discard;
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  // basalt grit and sand
  vec3 col = mix(uDark, uLight, vTint) * uBright;
  col = mix(col, uHotColor * 2.5, vHot);
  gl_FragColor = vec4(col, vA * uOpacity * (1.0 - smoothstep(0.3, 0.5, d)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function buildGeometry(forge, count) {
  const rng = mulberry32(919);
  const { local, piece, threshold } = samplePieceSurfaces(forge, count, rng);
  const orbits = makeOrbits(count, 1.25, rng);
  const info = new Float32Array(count * 4);
  const drift = new Float32Array(count * 4);
  const orbit = new Float32Array(count * 4);
  const plane = new Float32Array(count * 4);
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    info.set([piece[i], threshold[i], 0.1 + rng() * 0.14 + (rng() < 0.08 ? 0.14 : 0), rng()], i * 4);
    puffDirection(rng, dir);
    drift.set([dir.x, dir.y, dir.z, rng()], i * 4);
    const o = orbits[i];
    orbit.set(o.orbit, i * 4);
    plane.set(o.plane, i * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3)); // placed in the shader
  geometry.setAttribute("aLocal", new THREE.BufferAttribute(local, 3));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  geometry.setAttribute("aDrift", new THREE.BufferAttribute(drift, 4));
  geometry.setAttribute("aOrbit", new THREE.BufferAttribute(orbit, 4));
  geometry.setAttribute("aPlane", new THREE.BufferAttribute(plane, 4));
  return geometry;
}

export default function CrumbleSand({ J, tier, shared, forge }) {
  const { gl, camera } = useThree();
  const ref = useRef();
  const clock = useRef(0);
  const built = useMemo(() => {
    const geometry = buildGeometry(forge, tier.maxCrumble);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...breakupUniforms(forge, shared),
        uScale: { value: 1000 },
        uSize: { value: 1 },
        uOpacity: { value: 1 },
        uBright: { value: 1 },
        uDark: { value: new THREE.Color("#3a2f27") },
        uLight: { value: new THREE.Color("#b08d64") },
        uHotColor: { value: new THREE.Color("#ff6a14") },
      },
      vertexShader: vertexShader(forge.chunks.length),
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    return { geometry, material };
  }, [forge, tier, shared]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  useFrame((_, delta) => {
    const on = J.fracture > 0;
    if (ref.current) ref.current.visible = on;
    if (!on) return;
    syncOrbit();
    // the same pace as the swirl's own sand
    clock.current += Math.min(delta, 0.1) * J.orbitSpeed * T.swirlSpeed * T.sandSpeed;
    const u = built.material.uniforms;
    u.uClock.value = clock.current;
    u.uOpen.value = J.swirlOpen;
    u.uScale.value = gl.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    u.uSize.value = T.crumbleSize;
    u.uBright.value = (1 - shared.uNight.value * 0.6) * T.sandBrightness;
    u.uOpacity.value = T.crumbleOpacity;
    u.uHotColor.value.set(T.crackColor);
    built.geometry.setDrawRange(0, Math.min(Math.round(T.crumbleSand), tier.maxCrumble));
  });

  return <points ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} renderOrder={5} />;
}
