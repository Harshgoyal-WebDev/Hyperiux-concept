"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom, ToneMapping, Vignette } from "@react-three/postprocessing";
import { Effect, ToneMappingMode } from "postprocessing";
import { OPENING_NOMINAL, P, SUN_DIR } from "../config";
import { gardenCamera } from "../world/gardenCamera";
import { T } from "../tuning";
import { attachPointer, pointer } from "../pointer";

// ---------------------------------------------------------------------------
// Camera: a pure function of the timeline's shot channels (position, aim,
// lens), so every story time maps to exactly one shot. Mouse parallax is
// layered on top (damped, and scaled down by J.parallax while the core is
// close). Every shot keeps the camera well in front of the slab and outside
// the space the flying chunks pass through.
// ---------------------------------------------------------------------------
const UP = new THREE.Vector3(0, 1, 0);

export function CameraRig({ J, opening }) {
  const { camera } = useThree();
  const v = useMemo(
    () => ({
      p: new THREE.Vector3(),
      t: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      mouse: { x: 0, y: 0 },
      shift: new THREE.Vector3(),
    }),
    []
  );
  useEffect(() => attachPointer(), []);

  useFrame((_, delta) => {
    v.p.set(J.camX, J.camY, J.camZ);
    v.t.set(J.tgtX, J.tgtY, J.tgtZ);
    let lens = J.fov;
    // in the garden: its own continuous path round the pond
    if (J.progress >= P.through) lens = gardenCamera(J.gardenT, v.p, v.t);
    // shots through the mark are composed on the nominal opening: move them
    // onto the real one (the slab's height depends on the sand under it)
    if (opening && J.align > 0) {
      v.shift.subVectors(opening, OPENING_NOMINAL).multiplyScalar(J.align);
      v.p.add(v.shift);
      v.t.add(v.shift);
    }

    const k = 1 - Math.exp(-T.parallaxDamping * Math.min(delta, 0.1));
    v.mouse.x += ((pointer.active ? pointer.x : 0) - v.mouse.x) * k;
    v.mouse.y += ((pointer.active ? pointer.y : 0) - v.mouse.y) * k;
    const amt = J.parallax * T.parallax;
    if (amt > 0) {
      v.fwd.subVectors(v.t, v.p).normalize();
      v.right.crossVectors(v.fwd, UP).normalize();
      v.up.crossVectors(v.right, v.fwd);
      // camera travels, aim barely moves: near dunes slide past, the
      // slab holds — that's what reads as depth
      v.p.addScaledVector(v.right, v.mouse.x * 5 * amt).addScaledVector(v.up, v.mouse.y * 2.2 * amt);
      v.t.addScaledVector(v.right, v.mouse.x * 0.4 * amt).addScaledVector(v.up, v.mouse.y * 0.2 * amt);
    }
    // the jolt as the beam merges into the core
    const jolt = J.jolt * T.shockShake;
    if (jolt > 0.001) {
      const t = performance.now() * 0.001;
      v.p.x += Math.sin(t * 61) * Math.sin(t * 17) * jolt;
      v.p.y += Math.sin(t * 53 + 1.3) * Math.sin(t * 23) * jolt * 0.7;
    }
    camera.position.copy(v.p);
    camera.lookAt(v.t);
    // Portrait screens keep more of the horizontal framing (bounded so the
    // lens doesn't distort): the choreography is composed for landscape.
    const widen = Math.max(1, Math.pow(1 / camera.aspect, 0.6));
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(lens) / 2) * widen));
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// Shared uniforms + fog, written once per frame.
// ---------------------------------------------------------------------------
const HAZE = new THREE.Color(0.62, 0.37, 0.21);
const NIGHT_HAZE = new THREE.Color(0.035, 0.042, 0.075);

export function UniformSync({ J, shared, shockCenter }) {
  const { scene, gl } = useThree();
  const fog = useMemo(() => new THREE.FogExp2(HAZE.clone(), 0.0011), []);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame((_, delta) => {
    shared.uTime.value += Math.min(delta, 0.1);
    // day ↔ night eases over ~1.5 s
    const target = T.night ? 1 : 0;
    shared.uNight.value += (target - shared.uNight.value) * (1 - Math.exp(-2.4 * Math.min(delta, 0.1)));
    if (Math.abs(target - shared.uNight.value) < 1e-3) shared.uNight.value = target;
    const night = shared.uNight.value;
    shared.uCrackScale.value = T.crackScale;
    shared.uCrackDepth.value = T.crackDepth;
    if (shared.uCrackColor.userData !== T.crackColor) {
      shared.uCrackColor.value.set(T.crackColor);
      shared.uCrackColor.userData = T.crackColor;
    }
    shared.uRipple.value = T.rippleStrength;
    // shockwave: out to ~380 m, fading as it spreads (nothing before the merge)
    shared.uShockR.value = J.shock * 380;
    shared.uShockAmp.value = J.shock > 0 ? Math.pow(1 - J.shock, 1.4) * T.shockStrength : 0;
    if (shockCenter) shared.uShockPos.value.set(shockCenter.x, shockCenter.z);
    shared.uLineWidth.value = T.lineWidth;
    shared.uLineDepth.value = T.lineDepth;
    fog.color.copy(HAZE).lerp(NIGHT_HAZE, night);
    fog.density = T.fogDensity;
    // the captured environment is the sunset sky: dim it right down at night
    scene.environmentIntensity = T.envIntensity * (1 - night * 0.8);
    gl.toneMappingExposure = T.exposure;
  });
  return null;
}

// ---------------------------------------------------------------------------
// Lights: low sunset sun with shadows that follow the shot, sky/sand
// hemisphere and a warm bounce on the face (the forge adds the core's light).
// ---------------------------------------------------------------------------
function setColor(light, hex) {
  if (light && light.userData.hex !== hex) {
    light.color.set(hex);
    light.userData.hex = hex;
  }
}

// Colour cache for blends that run every frame (hex → linear Color).
const colorCache = new Map();
function hexColor(hex) {
  let c = colorCache.get(hex);
  if (!c) colorCache.set(hex, (c = new THREE.Color(hex)));
  return c;
}
const NIGHT_SKY = new THREE.Color("#1d2a4d");
const NIGHT_GROUND = new THREE.Color("#0b0a12");

export function Lights({ tier, shared }) {
  const sun = useRef();
  const hemi = useRef();
  const fill = useRef();
  const { camera, scene } = useThree();
  const focus = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const target = sun.current?.target;
    if (!target) return;
    scene.add(target);
    return () => scene.remove(target);
  }, [scene]);

  useFrame(() => {
    const night = shared.uNight.value;
    const s = sun.current;
    if (s) {
      camera.getWorldDirection(fwd);
      focus.copy(camera.position).addScaledVector(fwd.setY(0).normalize(), 70);
      focus.y = 0;
      s.target.position.copy(focus);
      s.position.copy(focus).addScaledVector(SUN_DIR, 320);
      s.target.updateMatrixWorld();
      // at night the same key light is the moon
      s.intensity = THREE.MathUtils.lerp(T.sunIntensity, T.moonIntensity, night);
      s.color.copy(hexColor(T.sunColor)).lerp(hexColor(T.moonColor), night);
    }
    // Lights at zero are hidden: a hidden light is left out of every
    // material's shader, so by day (both at 0) they cost nothing.
    if (hemi.current) {
      // a faint cool skylight keeps the night readable
      hemi.current.intensity = T.hemiIntensity * (1 - night) + 0.35 * night;
      hemi.current.visible = hemi.current.intensity > 0.001;
      hemi.current.color.copy(hexColor(T.hemiSky)).lerp(NIGHT_SKY, night);
      hemi.current.groundColor.copy(hexColor(T.hemiGround)).lerp(NIGHT_GROUND, night);
    }
    if (fill.current) {
      fill.current.intensity = T.fillIntensity * (1 - night);
      fill.current.visible = fill.current.intensity > 0.001;
      setColor(fill.current, T.fillColor);
    }
  });

  const size = tier.shadowMap;
  return (
    <>
      <hemisphereLight ref={hemi} args={["#8d99ad", "#6e3a1a", 0]} visible={false} />
      <directionalLight
        ref={sun}
        color="#ffb27a"
        intensity={2.8}
        castShadow={size > 0}
        shadow-mapSize={[size || 512, size || 512]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.06}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={130}
        shadow-camera-bottom={-130}
        shadow-camera-near={10}
        shadow-camera-far={800}
      />
      {/* warm bounce from the sand onto the logo face */}
      <directionalLight ref={fill} color="#d4875a" intensity={0} position={[-30, 25, 120]} visible={false} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Fine sand drifting on the wind, always in a box around the camera.
// ---------------------------------------------------------------------------
const DUST_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec3 uCam;
uniform float uScale;
uniform float uDust;
uniform vec2 uWind;
varying float vA;
void main() {
  float B = 70.0;
  vec3 drift = vec3(uWind.x, 0.04, uWind.y) * uTime * 1.4;
  vec3 p = mod(position + drift - uCam + B * 0.5, B) - B * 0.5 + uCam;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  vA = uDust * smoothstep(1.0, 6.0, dist) * (1.0 - smoothstep(20.0, 34.0, dist));
  gl_PointSize = 0.045 * uScale / max(dist, 0.5);
}
`;
const DUST_FRAGMENT = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = 1.0 - smoothstep(0.2, 0.5, d);
  gl_FragColor = vec4(vec3(1.0, 0.7, 0.45) * 1.2, m * vA * 0.55);
}
`;

export function Dust({ J, tier, shared }) {
  const { gl, camera } = useThree();
  const ref = useRef();
  const built = useMemo(() => {
    let a = 99;
    const rng = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    const n = tier.dust;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([rng() * 70, rng() * 70, rng() * 70], i * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: shared.uTime,
        uWind: shared.uWind,
        uCam: { value: new THREE.Vector3() },
        uScale: { value: 500 },
        uDust: { value: 1 },
      },
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, [tier, shared]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built]
  );

  useFrame(() => {
    const u = built.material.uniforms;
    u.uCam.value.copy(camera.position);
    u.uScale.value = gl.domElement.height * 0.5;
    // warm sunlit motes; only a few catch the moonlight
    u.uDust.value = J.dust * T.dust * (1 - shared.uNight.value * 0.7) * (1 - THREE.MathUtils.smoothstep(J.flash, 0.3, 0.9));
    if (ref.current) ref.current.visible = u.uDust.value > 0.001;
  });

  return <points ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} />;
}

// ---------------------------------------------------------------------------
// Edge motion blur + chromatic aberration: the frame smears outwards and its
// colours split towards the edges (the centre stays clean) — through the
// forging event, from the impact until the logo stands.
// ---------------------------------------------------------------------------
const EDGE_FX = /* glsl */ `
uniform float uAmount;
uniform float uChroma;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 dir = uv - 0.5;
  float edge = smoothstep(0.12, 0.72, length(dir * vec2(1.0, 0.8)) * 1.35);
  float a = uAmount * edge;
  if (a < 0.0005) {
    outputColor = inputColor;
    return;
  }
  vec3 acc = vec3(0.0);
  float w = 0.0;
  for (int i = 0; i < 10; i++) {
    float t = float(i) / 9.0;
    vec2 o = dir * t * a * 0.07;
    float k = 1.0 - t * 0.6;
    acc.r += texture2D(inputBuffer, uv - o * (1.0 + uChroma)).r * k;
    acc.g += texture2D(inputBuffer, uv - o).g * k;
    acc.b += texture2D(inputBuffer, uv - o * (1.0 - uChroma)).b * k;
    w += k;
  }
  outputColor = vec4(acc / w, inputColor.a);
}
`;
class EdgeFxEffect extends Effect {
  constructor() {
    super("EdgeFxEffect", EDGE_FX, {
      uniforms: new Map([
        ["uAmount", new THREE.Uniform(0)],
        ["uChroma", new THREE.Uniform(0.6)],
      ]),
    });
  }
}

// ---------------------------------------------------------------------------
// Post: restrained bloom for the core and the lit cracks, ACES, vignette.
// ---------------------------------------------------------------------------
export function Post({ J, tier }) {
  const bloom = useRef();
  const vignette = useRef();
  const edgeFx = useMemo(() => new EdgeFxEffect(), []);
  useEffect(() => () => edgeFx.dispose(), [edgeFx]);
  useFrame(() => {
    edgeFx.uniforms.get("uAmount").value = J.edgeFx * T.edgeBlur;
    edgeFx.uniforms.get("uChroma").value = T.edgeChroma;
    if (bloom.current) {
      bloom.current.intensity = J.bloom * T.bloomIntensity;
      bloom.current.luminanceMaterial.threshold = T.bloomThreshold;
      if (bloom.current.mipmapBlurPass) bloom.current.mipmapBlurPass.radius = T.bloomRadius;
    }
    if (vignette.current) vignette.current.darkness = J.vignette * T.vignette;
  });
  return (
    <EffectComposer multisampling={tier.multisampling} enableNormalPass={false}>
      <primitive object={edgeFx} dispose={null} />
      <Bloom ref={bloom} mipmapBlur intensity={0.9} luminanceThreshold={1.05} luminanceSmoothing={0.25} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette ref={vignette} offset={0.32} darkness={0.6} />
    </EffectComposer>
  );
}
