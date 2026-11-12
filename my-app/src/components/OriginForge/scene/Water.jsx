"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { C } from "../timeline";
import { T, setColor } from "../tuning";
import { pointer } from "../pointer";
import { createRipples } from "../world/ripples";

// The plaza is still, dark water, behaving as the garden's pond does
// (ForgingConcept GardenPond): a real mirror of the ruins and the horizon
// (a planar reflection, desktop only), broken up by
//   currents – a slow circulation round the core's platform, its small
//              waves flowing along it (two phases of a flow map, so they
//              never smear), and
//   ripples  – a wave simulation on a fine grid (world/ripples.js): the
//              pointer drops rings all along its path over the water,
//              stronger the faster it moves, which spread, cross and die
//              away; their slopes are taken in metres, so they tilt the
//              surface (and break up its mirror) as real ripples would.
// Fresnel decides how much is mirror and how much is water.

// the ripple grid: 512 cells over the heart of the plaza (minX, minZ, sizeX, sizeZ)
const RECT = new THREE.Vector4(-48, -34, 96, 96); // (reaches the hero camera's feet)
const SIM = 512;
const CURRENT_REACH = 40; // metres: the circulation's "shore"

const shader = {
  name: "OriginForgeWater",
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      uRipples: { value: null },
      uRect: { value: RECT.clone() },
      uTexel: { value: RECT.z / SIM },
      uTime: { value: 0 },
      uReach: { value: CURRENT_REACH },
      uReflect: { value: 1 },
      uDistort: { value: 0.2 },
      uCurrentSpeed: { value: 2.24 },
      uCurrentScale: { value: 2 },
      uCurrentStrength: { value: 1 },
      uRippleStrength: { value: 2.02 },
      uGlint: { value: 1 },
      uHasReflection: { value: 1 },
      uDeep: { value: new THREE.Color() },
      uShallow: { value: new THREE.Color() },
      uSky: { value: new THREE.Color() },
      uGlintColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.22, -1).normalize() },
    },
  ]),
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vReflect;
    varying vec3 vWorld;
    #include <common>
    #include <fog_pars_vertex>
    void main() {
      vReflect = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      vec4 mvPosition = viewMatrix * w;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, uRipples;
    uniform vec4 uRect;
    uniform float uTexel, uTime, uReach, uReflect, uDistort, uCurrentSpeed, uCurrentScale, uCurrentStrength, uRippleStrength, uGlint, uHasReflection;
    uniform vec3 uDeep, uShallow, uSky, uGlintColor, uSunDir;
    varying vec4 vReflect;
    varying vec3 vWorld;
    #include <common>
    #include <fog_pars_fragment>
    // smooth noise and its gradient (for the surface's small waves)
    float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 wNoiseD(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      vec2 du = 6.0 * f * (1.0 - f);
      float a = wHash(i), b = wHash(i + vec2(1.0, 0.0)), c = wHash(i + vec2(0.0, 1.0)), d = wHash(i + vec2(1.0, 1.0));
      return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y,
                  du * vec2(b - a + (a - b - c + d) * u.y, c - a + (a - b - c + d) * u.x));
    }
    vec2 waves(vec2 p) {
      vec2 g = wNoiseD(p).yz * 0.6;
      g += wNoiseD(p * 2.1 + 7.0).yz * 0.3;
      g += wNoiseD(p * 4.3 + 13.0).yz * 0.15;
      return g;
    }
    void main() {
      vec2 xz = vWorld.xz;
      float shore = length(xz) / uReach;
      // currents: a slow circulation round the platform; the waves are
      // carried along it in two phases blended so the stretching never shows
      vec2 flow = vec2(-xz.y, xz.x) / max(length(xz), 0.5) * (0.6 + 0.4 * smoothstep(0.2, 0.9, shore));
      float t = uTime * uCurrentSpeed * 0.25;
      float ph0 = fract(t);
      float ph1 = fract(t + 0.5);
      vec2 p = xz * uCurrentScale;
      vec2 g0 = waves(p - flow * ph0 * 1.6);
      vec2 g1 = waves(p - flow * ph1 * 1.6 + 3.7);
      // (the plaza is seen far off: its small waves calm with distance, so
      // they never shimmer)
      float dist = length(cameraPosition - vWorld);
      vec2 g = mix(g0, g1, abs(0.5 - ph0) * 2.0) * 0.05 * uCurrentStrength * mix(1.0, 0.25, smoothstep(18.0, 90.0, dist));
      // the pointer's ripples, their slopes in metres
      vec2 ruv = (xz - uRect.xy) / uRect.zw;
      if (ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0) {
        vec2 rt = vec2(1.0 / ${SIM}.0);
        float hx = texture2D(uRipples, ruv + vec2(rt.x, 0.0)).r - texture2D(uRipples, ruv - vec2(rt.x, 0.0)).r;
        float hz = texture2D(uRipples, ruv + vec2(0.0, rt.y)).r - texture2D(uRipples, ruv - vec2(0.0, rt.y)).r;
        g += vec2(hx, hz) / (2.0 * uTexel) * uRippleStrength * 1.5;
      }
      vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 v = normalize(cameraPosition - vWorld);
      float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
      // the mirror image, displaced by the surface
      vec3 refl = uSky;
      if (uHasReflection > 0.5) {
        vec4 r = vReflect;
        r.xy += n.xz * uDistort * r.w;
        refl = texture2DProj(tDiffuse, r).rgb;
      }
      vec3 body = mix(uDeep, uShallow, smoothstep(0.45, 1.0, shore));
      vec3 col = mix(body, refl, clamp(mix(0.35, 1.0, fresnel) * uReflect, 0.0, 1.0));
      // the horizon's glint on the ripples
      col += uGlintColor * 1.6 * pow(max(dot(reflect(-uSunDir, n), v), 0.0), 220.0) * uGlint;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

export default function Water({ tier }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const res = useMemo(() => {
    const geo = new THREE.CircleGeometry(150, 96);
    let mesh;
    if (tier.reflections) {
      mesh = new Reflector(geo, { textureWidth: 512, textureHeight: 512, clipBias: 0.003, multisample: 0, shader });
      mesh.material.fog = true;
    } else {
      mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ ...shader, uniforms: THREE.UniformsUtils.clone(shader.uniforms), fog: true }));
      mesh.material.uniforms.uHasReflection.value = 0;
    }
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0, 4);
    const ripples = createRipples(RECT, SIM);
    return { mesh, geo, ripples };
  }, [tier.reflections]);

  // the reflection at half the screen's resolution
  useEffect(() => {
    if (!res.mesh.getRenderTarget) return;
    const dpr = Math.min(gl.getPixelRatio(), 1.5);
    res.mesh.getRenderTarget().setSize(Math.max(256, Math.round(size.width * dpr * 0.5)), Math.max(256, Math.round(size.height * dpr * 0.5)));
  }, [res, gl, size]);

  useEffect(
    () => () => {
      res.ripples.dispose();
      res.geo.dispose();
      res.mesh.dispose?.();
      res.mesh.material.dispose();
    },
    [res]
  );

  const s = useMemo(
    () => ({ ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit: new THREE.Vector3(), last: new THREE.Vector3(1e9, 0, 0), drops: [] }),
    []
  );

  useFrame((state, delta) => {
    const visible = C.t < 77;
    res.mesh.visible = visible;
    if (!visible) return;

    // the pointer over the water drops rings all along its way, stronger
    // the faster it moves (one where it is now, one halfway from where it
    // was, so a quick stroke leaves an unbroken wake)
    const { ripples } = res;
    s.drops.length = 0;
    if (pointer.active && performance.now() - pointer.movedAt < 150) {
      s.ndc.set(pointer.x, pointer.y);
      s.ray.setFromCamera(s.ndc, state.camera);
      if (s.ray.ray.intersectPlane(s.plane, s.hit)) {
        const [u, v] = ripples.uv(s.hit.x, s.hit.z);
        const inside = u > 0.02 && u < 0.98 && v > 0.02 && v < 0.98;
        const moved = s.hit.distanceTo(s.last);
        const [lu, lv] = ripples.uv(s.last.x, s.last.z);
        s.last.copy(s.hit);
        if (inside && moved < 6) {
          const speed = moved / Math.max(Math.min(delta, 0.1), 1 / 240);
          const strength = Math.min(0.02 + speed * 0.01, 0.08) * T.rippleForce;
          if (moved > T.rippleRadius * 0.5) s.drops.push([(u + lu) / 2, (v + lv) / 2, strength]);
          s.drops.push([u, v, strength]);
        }
      }
    } else s.last.set(1e9, 0, 0);
    const tex = ripples.step(gl, s.drops, { radius: T.rippleRadius, damping: T.rippleDamping, speed: T.rippleSpeed });

    const w = res.mesh.material.uniforms;
    w.uRipples.value = tex;
    w.uTime.value = state.clock.elapsedTime;
    w.uReflect.value = T.reflectivity;
    w.uDistort.value = T.distortion;
    w.uCurrentSpeed.value = T.currentSpeed;
    w.uCurrentScale.value = T.currentScale;
    w.uCurrentStrength.value = T.currentStrength;
    w.uRippleStrength.value = T.rippleStrength;
    w.uGlint.value = T.glint * (0.4 + 0.6 * C.horizon);
    setColor(w.uDeep.value, T.waterDeep);
    setColor(w.uShallow.value, T.waterShallow);
    setColor(w.uGlintColor.value, T.glintColor);
    setColor(w.uSky.value, T.skyMid);
  });

  return <primitive object={res.mesh} />;
}
