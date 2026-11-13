"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { C, DROP_HIT, lerp } from "../timeline";
import { BASIN, COURT, FINALE, SUN_DIR } from "../world/layout";
import { THEME } from "../theme";
import { createRipples } from "../../OriginForge/world/ripples";
import { attachPointer, pointer } from "../../OriginForge/pointer";

// Chapter 06: the tree stands in a basin of still water. It mirrors the
// tree and the sky through the oculus (a planar reflection on desktop), is
// stirred by slow currents, and the pointer drags rings through it as
// through the garden's pond. At the end of the journey a single drop falls
// into it, at the centre of the screen; its rings spread (and the page
// opens from them: the ripple transition, PostFX).

const SIM = 256;
const RECT = new THREE.Vector4(COURT.cx - BASIN.R, COURT.cz - BASIN.R, BASIN.R * 2, BASIN.R * 2);

const shader = {
  name: "PJBasinWater",
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
      uHasReflection: { value: 1 },
      uDeep: { value: new THREE.Color() },
      uShallow: { value: new THREE.Color() },
      uSky: { value: new THREE.Color() },
      uGlint: { value: new THREE.Vector3() },
      uSunDir: { value: SUN_DIR.clone() },
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
    uniform float uTexel, uTime, uHasReflection;
    uniform vec3 uDeep, uShallow, uSky, uSunDir, uGlint;
    varying vec4 vReflect;
    varying vec3 vWorld;
    #include <common>
    #include <fog_pars_fragment>
    float wH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 wN(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
      float a = wH(i), b = wH(i + vec2(1.0, 0.0)), c = wH(i + vec2(0.0, 1.0)), d = wH(i + vec2(1.0, 1.0));
      return vec3(0.0, du * vec2(b - a + (a - b - c + d) * u.y, c - a + (a - b - c + d) * u.x));
    }
    void main() {
      vec2 local = vWorld.xz - (uRect.xy + uRect.zw * 0.5);
      float r = length(local) / (uRect.z * 0.5);
      // currents: a slow circulation round the tree
      vec2 flow = vec2(-local.y, local.x) / max(length(local), 0.5);
      float t = uTime * 0.18;
      float ph0 = fract(t), ph1 = fract(t + 0.5);
      vec2 p = local * 2.2;
      vec2 g0 = wN(p - flow * ph0 * 1.4).yz + wN(p * 2.1 + 7.0 - flow * ph0 * 2.8).yz * 0.5;
      vec2 g1 = wN(p - flow * ph1 * 1.4 + 3.7).yz + wN(p * 2.1 + 11.0 - flow * ph1 * 2.8).yz * 0.5;
      vec2 g = mix(g0, g1, abs(0.5 - ph0) * 2.0) * 0.03;
      // the rings (pointer, drop), their slopes in metres
      vec2 ruv = (vWorld.xz - uRect.xy) / uRect.zw;
      vec2 rt = vec2(1.0 / ${SIM}.0);
      float hx = texture2D(uRipples, ruv + vec2(rt.x, 0.0)).r - texture2D(uRipples, ruv - vec2(rt.x, 0.0)).r;
      float hz = texture2D(uRipples, ruv + vec2(0.0, rt.y)).r - texture2D(uRipples, ruv - vec2(0.0, rt.y)).r;
      g += vec2(hx, hz) / (2.0 * uTexel) * 3.0;
      vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 v = normalize(cameraPosition - vWorld);
      float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
      vec3 refl = uSky;
      if (uHasReflection > 0.5) {
        vec4 rp = vReflect;
        rp.xy += n.xz * 0.12 * rp.w;
        refl = texture2DProj(tDiffuse, rp).rgb;
      }
      // the basin's stone floor showing through near the rim, deeper water inward
      vec3 body = mix(uDeep, uShallow, smoothstep(0.55, 1.0, r));
      vec3 col = mix(body, refl, clamp(mix(0.42, 1.0, fresnel), 0.0, 1.0));
      col += uGlint * pow(max(dot(reflect(-normalize(uSunDir), n), v), 0.0), 240.0);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

export default function BasinWater({ tier }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const group = useRef();
  const drop = useRef();
  const res = useMemo(() => {
    const geo = new THREE.CircleGeometry(BASIN.R, 128);
    let mesh;
    if (tier.reflections) {
      mesh = new Reflector(geo, { textureWidth: 512, textureHeight: 512, clipBias: 0.003, multisample: 0, shader });
      mesh.material.fog = true;
    } else {
      mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ ...shader, uniforms: THREE.UniformsUtils.clone(shader.uniforms), fog: true }));
      mesh.material.uniforms.uHasReflection.value = 0;
    }
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(COURT.cx, BASIN.water, COURT.cz);
    const wu = mesh.material.uniforms;
    wu.uDeep.value.set(THEME.water.deep);
    wu.uShallow.value.set(THEME.water.shallow);
    wu.uSky.value.set(THEME.water.sky);
    wu.uGlint.value.set(...THEME.water.glint).multiplyScalar(THEME.water.glintK);
    wu.uSunDir.value.copy(SUN_DIR);
    const ripples = createRipples(RECT, SIM);
    const dropGeo = new THREE.SphereGeometry(0.2, 32, 20);
    dropGeo.scale(1, 1.35, 1);
    const dropMat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.02, metalness: 0, transmission: tier.post ? 1 : 0, thickness: 0.2, ior: 1.33, envMapIntensity: 1.6, clearcoat: 1 });
    return { mesh, geo, ripples, dropGeo, dropMat };
  }, [tier.reflections, tier.post]);

  useEffect(() => attachPointer(), []);

  // the reflection at a third of the screen's resolution (it is small)
  useEffect(() => {
    if (!res.mesh.getRenderTarget) return;
    const dpr = Math.min(gl.getPixelRatio(), 1.5);
    res.mesh.getRenderTarget().setSize(Math.max(256, Math.round(size.width * dpr * 0.4)), Math.max(256, Math.round(size.height * dpr * 0.4)));
  }, [res, gl, size]);

  useEffect(
    () => () => {
      res.ripples.dispose();
      res.geo.dispose();
      res.mesh.dispose?.();
      res.mesh.material.dispose();
      res.dropGeo.dispose();
      res.dropMat.dispose();
    },
    [res]
  );

  const s = useMemo(
    () => ({ ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -BASIN.water), hit: new THREE.Vector3(), last: new THREE.Vector3(1e9, 0, 0), drops: [], prevT: 0, ring: 0 }),
    []
  );

  useFrame((state, delta) => {
    const t = C.t;
    const on = t > 70;
    group.current.visible = on;
    s.drops.length = 0;
    if (!on) {
      s.prevT = t;
      return;
    }
    const { ripples } = res;
    // the pointer over the water drops rings all along its way (the pond's
    // way: one where it is now, one halfway from where it was)
    if (pointer.active && performance.now() - pointer.movedAt < 150) {
      s.ndc.set(pointer.x, pointer.y);
      s.ray.setFromCamera(s.ndc, state.camera);
      if (s.ray.ray.intersectPlane(s.plane, s.hit)) {
        const [u, v] = ripples.uv(s.hit.x, s.hit.z);
        const inside = Math.hypot(s.hit.x - COURT.cx, s.hit.z - COURT.cz) < BASIN.R - 0.2;
        const moved = s.hit.distanceTo(s.last);
        const [lu, lv] = ripples.uv(s.last.x, s.last.z);
        s.last.copy(s.hit);
        if (inside && moved < 3) {
          const speed = moved / Math.max(Math.min(delta, 0.1), 1 / 240);
          const strength = Math.min(0.02 + speed * 0.01, 0.08) * 1.3;
          if (moved > 0.2) s.drops.push([(u + lu) / 2, (v + lv) / 2, strength]);
          s.drops.push([u, v, strength]);
        }
      }
    } else s.last.set(1e9, 0, 0);

    // the drop: falls, and where it meets the water, rings (each time the
    // scroll carries it down into the water)
    const k = C.drop;
    const falling = k > 0 && k < 1;
    drop.current.visible = falling;
    if (falling) {
      const y = lerp(7.5, 0, k * k);
      drop.current.position.set(FINALE.spot.x, BASIN.water + y, FINALE.spot.z);
      drop.current.scale.set(1, 1 + k * 0.5, 1);
    }
    if (s.prevT < DROP_HIT && t >= DROP_HIT) s.ring = 4; // a strong drop, over a few frames
    s.prevT = t;
    if (s.ring > 0) {
      const [u, v] = ripples.uv(FINALE.spot.x, FINALE.spot.z);
      s.drops.push([u, v, 0.22]);
      s.ring--;
    }
    const tex = ripples.step(gl, s.drops, { radius: s.ring > 0 ? 0.32 : 0.45, damping: 0.985, speed: 0.6 });
    const w = res.mesh.material.uniforms;
    w.uRipples.value = tex;
    w.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group ref={group} visible={false}>
      <primitive object={res.mesh} />
      <mesh ref={drop} geometry={res.dropGeo} material={res.dropMat} visible={false} />
    </group>
  );
}
