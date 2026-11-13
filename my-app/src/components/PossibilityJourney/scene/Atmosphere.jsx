"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { C, lerp } from "../timeline";
import { T, setColor } from "../tuning";
import { SUN_DIR } from "../world/layout";
import { WARM_WHITE } from "../world/materials";
import { THEME } from "../theme";

// (The light version (theme.js) has a day sky and a high sun instead.)
// Night, at the last of the light: a dark, stormy sky of charcoal cloud
// with a low band of molten orange along the horizon ahead, where the sun
// has just gone down; that low sun rims every wall and rock in warm light
// and throws long shadows back toward the visitor; a cold, faint fill; a
// smoky dark haze. The chapters change its strength (timeline: sun, fog,
// contrast); the end hands over to the page through the drop's ripple.
// the night sky: charcoal cloud, a molten band on the horizon ahead
const NIGHT_SKY = /* glsl */ `
  uniform float uTime, uBright;
  uniform vec3 uSun, uWhite;
  varying vec3 vDir;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vn(p); p = p * 2.03 + 3.1; a *= 0.5; } return v; }
  void main() {
    vec3 uZenith = vec3(0.012, 0.013, 0.016), uMid = vec3(0.05, 0.053, 0.062), uCloud = vec3(0.09, 0.092, 0.1), uGlow = vec3(1.0, 0.22, 0.04);
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    vec3 sun = normalize(uSun);
    vec3 flatD = normalize(vec3(d.x, 0.0, d.z) + 1e-5);
    vec3 flatS = normalize(vec3(sun.x, 0.0, sun.z));
    float toward = pow(max(dot(flatD, flatS), 0.0), 3.0);
    vec3 col = mix(uMid, uZenith, smoothstep(0.02, 0.6, h));
    float band = exp(-abs(d.y - 0.01) * 14.0);
    col += uGlow * band * (0.03 + 0.55 * toward);
    col += vec3(1.0, 0.72, 0.4) * exp(-abs(d.y - 0.005) * 60.0) * toward * 0.7;
    vec2 cp = d.xz / max(d.y + 0.12, 0.06);
    float n = fbm(cp * 0.45 + vec2(uTime * 0.003, 0.0));
    float c = smoothstep(0.38, 0.8, n) * smoothstep(-0.02, 0.2, h);
    vec3 cloud = mix(uCloud, uCloud * 0.55, smoothstep(0.1, 0.6, h));
    cloud += uGlow * exp(-h * 7.0) * (0.04 + 0.45 * toward) * smoothstep(0.45, 0.8, n);
    col = mix(col, cloud, c * 0.92);
    float s = max(dot(d, sun), 0.0);
    col += vec3(1.0, 0.55, 0.22) * (pow(s, 10.0) * 0.35 + pow(s, 120.0) * 0.55);
    col = mix(col, uMid * 0.8 + uGlow * 0.05 * toward, smoothstep(0.01, -0.12, d.y));
    col = mix(col, uWhite * 1.1, uBright);
    // (kept under the bloom's threshold: only the beam glows)
    gl_FragColor = vec4(min(col, vec3(1.2)), 1.0);
    #include <colorspace_fragment>
  }`;

// the day sky: a vivid blue, deep overhead and pale at the horizon, full of
// dense white cumulus (lit on their sunward side, soft grey beneath), the
// sun's glare
const DAY_SKY = /* glsl */ `
  uniform float uTime, uBright;
  uniform vec3 uSun, uWhite;
  varying vec3 vDir;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { v += a * vn(p); p = p * 2.03 + 3.1; a *= 0.5; } return v; }
  void main() {
    vec3 zenith = vec3(0.022, 0.16, 0.62), mid = vec3(0.14, 0.42, 0.92), horizon = vec3(0.6, 0.78, 0.95);
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
    col = mix(col, zenith, smoothstep(0.25, 0.9, h));
    // dense cumulus on a cloud layer: billowing (fbm), lit from the sun's side
    vec2 cp = d.xz / max(d.y + 0.1, 0.06) * 0.55 + vec2(uTime * 0.003, 0.0);
    float n = fbm(cp);
    float cover = smoothstep(0.56, 0.74, n) * 0.85;
    vec2 sunDir2 = normalize(uSun.xz + 1e-4);
    float lit = clamp((n - fbm(cp + sunDir2 * 0.08)) * 6.0 + 0.55, 0.0, 1.0);
    vec3 cloud = mix(vec3(0.62, 0.66, 0.74), vec3(1.0, 0.99, 0.97) * 1.12, lit);
    cloud = mix(cloud, vec3(1.08), smoothstep(0.62, 0.85, n) * 0.5);
    float fadeLow = smoothstep(0.0, 0.08, h);
    col = mix(col, cloud, cover * fadeLow * 0.96);
    // haze on the horizon
    col = mix(col, horizon * 1.05, (1.0 - smoothstep(0.0, 0.06, h)) * 0.6);
    float s = max(dot(d, normalize(uSun)), 0.0);
    col += vec3(1.0, 0.9, 0.75) * (pow(s, 14.0) * 0.3 + pow(s, 600.0) * 2.0);
    col = mix(col, horizon, smoothstep(0.02, -0.12, d.y));
    col = mix(col, uWhite * 1.15, uBright);
    gl_FragColor = vec4(min(col, vec3(1.3)), 1.0);
    #include <colorspace_fragment>
  }`;

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: SUN_DIR.clone() },
      uBright: { value: 0 },
      uWhite: { value: WARM_WHITE.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: THEME.sky === "day" ? DAY_SKY : NIGHT_SKY,
  });
}

const _target = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const SNAP = 4; // metres: the shadow box moves in steps, so the map can be reused
const EVERY = 4; // ...and is redrawn every few frames regardless (moving pieces)

export default function Atmosphere({ tier }) {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const sky = useMemo(() => skyMaterial(), []);
  const fog = useMemo(() => new THREE.FogExp2(new THREE.Color("#15161a"), 0.009), []);
  const skyRef = useRef();
  const hemi = useRef();
  const sun = useRef();
  const shadowState = useMemo(() => ({ key: "", frame: 0 }), []);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    // the dark version's metal reflects its own dusk sky; the light one, a soft room
    let env;
    if (THEME.sky === "night" || THEME.sky === "day") {
      const skyScene = new THREE.Scene();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), skyMaterial());
      skyScene.add(dome);
      env = pmrem.fromScene(skyScene, 0).texture;
      dome.geometry.dispose();
      dome.material.dispose();
    } else env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.fog = fog;
    scene.background = null;
    // the sun's shadow is not redrawn every frame (see useFrame)
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      scene.environment = null;
      scene.fog = null;
      env.dispose();
      pmrem.dispose();
      room.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose?.();
      });
      sky.dispose();
    };
  }, [gl, scene, fog, sky]);

  useFrame((state) => {
    const cam = state.camera;
    sky.uniforms.uTime.value = state.clock.elapsedTime;
    sky.uniforms.uBright.value = C.bright * 0.85;
    skyRef.current.position.copy(cam.position);

    setColor(fog.color, T.fogColor);
    fog.color.lerp(WARM_WHITE, C.bright);
    fog.density = C.fog * T.fog;
    scene.environmentIntensity = T.envIntensity * (1 + C.bright);
    gl.toneMappingExposure = tier.post ? 1 : T.exposure * (1 + C.bright * 0.35);

    setColor(hemi.current.color, T.hemiSky);
    setColor(hemi.current.groundColor, T.hemiGround);
    hemi.current.intensity = T.hemi * lerp(1, 0.78, C.contrast) * (1 + C.bright * 0.8);

    // the sun, its shadow box following where the camera looks
    const s = sun.current;
    setColor(s.color, T.sunColor);
    s.intensity = C.sun * T.sun;
    cam.getWorldDirection(_fwd);
    _target.copy(cam.position).addScaledVector(_fwd, 24);
    _target.set(Math.round(_target.x / SNAP) * SNAP, 0, Math.round(_target.z / SNAP) * SNAP);
    const key = `${_target.x},${_target.z}`;
    if (key !== shadowState.key || ++shadowState.frame % EVERY === 0) {
      shadowState.key = key;
      gl.shadowMap.needsUpdate = true;
    }
    s.target.position.copy(_target);
    s.target.updateMatrixWorld();
    s.position.copy(_target).addScaledVector(SUN_DIR, 90);
  });

  return (
    <>
      <mesh ref={skyRef} material={sky} frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[800, 48, 24]} />
      </mesh>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow={tier.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.05}
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-46}
        shadow-camera-near={1}
        shadow-camera-far={220}
      />
    </>
  );
}
