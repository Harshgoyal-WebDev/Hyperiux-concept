"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { cameraPose, setApproachStart } from "../world/cameraPath";
import { SUN_DIR } from "../config";
import { WHITE_LEVEL } from "../config";
import { T } from "../tuning";
import { attachPointer, pointer } from "../pointer";
import { BreakEffect } from "./BreakEffect";

// ---------------------------------------------------------------------------
// Camera: path A (exterior → core → passage), blended into trail-follow,
// then path C (About → crane). No damping here — Lenis and the scrubbed
// timeline already smooth the input, and a pure function of progress keeps
// every scroll position mapped to exactly one shot. Mouse parallax is
// layered on top (damped, and scaled down near the core and inside the
// cut-out so it can never push the camera into stone).
// ---------------------------------------------------------------------------
const UP = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;

// How the shot is moving this frame, for the effects that follow the
// scroll: camera velocity (world m/s, parallax excluded), signed scroll
// speed (timeline progress per second), both smoothed, and the scroll
// intensity (0 below scrollIntensityMin, 1 from scrollIntensityFull).
export const motion = { velocity: new THREE.Vector3(), scroll: 0, intensity: 0 };

export function CameraRig({ J, pathA, pathC, terrain }) {
  const { camera } = useThree();
  const v = useMemo(
    () => ({
      p: new THREE.Vector3(),
      t: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      mouse: { x: 0, y: 0 },
      prev: new THREE.Vector3(),
      prevProgress: -1,
      vel: new THREE.Vector3(),
      euler: new THREE.Euler(),
      q: new THREE.Quaternion(),
    }),
    []
  );
  useEffect(() => attachPointer(), []);

  useFrame((_, delta) => {
    // The hero position is live-tunable: re-seat the approach when it moves.
    const hero = T.heroCamPosition;
    const p0 = pathA.approach.position.points[0];
    if (p0.x !== hero.x || p0.y !== hero.y || p0.z !== hero.z) setApproachStart(pathA.approach, hero);
    cameraPose(J, pathA, pathC, terrain, v.p, v.t);
    const dt = Math.min(delta, 0.1);
    if (v.prevProgress >= 0 && dt > 0) {
      const km = 1 - Math.exp(-10 * dt);
      v.vel.subVectors(v.p, v.prev).divideScalar(dt);
      // a jump (deep link, state button) is not motion
      if (v.vel.lengthSq() > 400 * 400) v.vel.set(0, 0, 0);
      motion.velocity.lerp(v.vel, km);
      // Scroll speed is measured frame to frame, and scroll updates don't
      // land on every render frame, so the raw value is noisy — worst as a
      // scroll winds down. Average it over ~0.15 s, then let the effects
      // build quickly (attack) but settle gently (release), so nothing
      // flickers on and off as you stop.
      const sv = THREE.MathUtils.clamp((J.progress - v.prevProgress) / dt, -0.6, 0.6);
      motion.scroll += (sv - motion.scroll) * (1 - Math.exp(-dt / 0.15));
      const lo = T.scrollIntensityMin;
      const target = THREE.MathUtils.smoothstep(Math.abs(motion.scroll), lo, Math.max(T.scrollIntensityFull, lo + 1e-4));
      const tau = target > motion.intensity ? T.scrollAttack : T.scrollRelease;
      motion.intensity += (target - motion.intensity) * (1 - Math.exp(-dt / Math.max(tau, 0.01)));
    }
    v.prev.copy(v.p);
    v.prevProgress = J.progress;

    // mouse parallax
    const k = 1 - Math.exp(-T.parallaxDamping * Math.min(delta, 0.1));
    v.mouse.x += ((pointer.active ? pointer.x : 0) - v.mouse.x) * k;
    v.mouse.y += ((pointer.active ? pointer.y : 0) - v.mouse.y) * k;
    const amt = J.parallax * T.parallax;
    if (amt > 0) {
      v.fwd.subVectors(v.t, v.p).normalize();
      v.right.crossVectors(v.fwd, UP).normalize();
      v.up.crossVectors(v.right, v.fwd);
      // camera travels, aim barely moves: near dunes slide past, the
      // monolith holds — that's what reads as depth
      v.p.addScaledVector(v.right, v.mouse.x * 6.5 * amt).addScaledVector(v.up, v.mouse.y * 3.0 * amt);
      v.t.addScaledVector(v.right, v.mouse.x * 0.5 * amt).addScaledVector(v.up, v.mouse.y * 0.25 * amt);
    }
    if (J.wB > 0) {
      const ground = terrain.height(v.p.x, v.p.z) * (1 - J.flatten) + 2.2;
      if (v.p.y < ground) v.p.y = ground;
    }
    camera.position.copy(v.p);
    camera.lookAt(v.t);
    // Hero pose rotation offset, eased out over the first stretch.
    const heroW = 1 - THREE.MathUtils.smoothstep(J.approach, 0, 0.3);
    const rot = T.heroCamRotation;
    if (heroW > 0 && (rot.x || rot.y || rot.z)) {
      v.euler.set(rot.x * DEG * heroW, rot.y * DEG * heroW, rot.z * DEG * heroW, "YXZ");
      camera.quaternion.multiply(v.q.setFromEuler(v.euler));
    }
    // Portrait screens keep more of the horizontal framing (bounded so the
    // lens doesn't distort): the choreography is composed for landscape.
    const widen = Math.max(1, Math.pow(1 / camera.aspect, 0.6));
    const baseFov = J.fov + (T.heroFov - 40) * heroW;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * widen));
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// Shared uniforms + fog, written once per frame from the timeline state.
// ---------------------------------------------------------------------------
const HAZE = new THREE.Color(0.62, 0.37, 0.21);
const NIGHT_HAZE = new THREE.Color(0.035, 0.042, 0.075);
const WHITE = new THREE.Color();

export function UniformSync({ J, shared, cubePosition }) {
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
    shared.uDissolve.value = J.dissolve;
    // Ease into white. Mixing straight towards HDR white (needed so the end
    // state tone-maps to ~#FFF) overwhelms the frame early, so the white
    // level itself ramps up only as the mix completes.
    shared.uWhite.value = J.white;
    shared.uWhiteLevel.value = THREE.MathUtils.lerp(0.9, WHITE_LEVEL, J.white * J.white * J.white);
    shared.uCubeGlow.value = J.cubeGlow;
    shared.uEnergy.value = J.energy;
    shared.uFlatten.value = J.flatten;
    shared.uContours.value = J.contours;
    shared.uCubePos.value.copy(cubePosition);
    shared.uCrackScale.value = T.crackScale;
    shared.uCrackDepth.value = T.crackDepth;
    shared.uFissureGlow.value = T.fissureGlow;
    if (shared.uCrackColor.userData !== T.crackColor) {
      shared.uCrackColor.value.set(T.crackColor);
      shared.uCrackColor.userData = T.crackColor;
    }
    shared.uRipple.value = T.rippleStrength;
    shared.uContourStrength.value = T.contourStrength;
    shared.uContourSpacing.value = T.contourSpacing;
    shared.uLineWidth.value = T.lineWidth;
    shared.uLineDepth.value = T.lineDepth;
    // The glow fills the cracks gradually over [crackStart, crackEnd] of
    // the scroll (eased in so it starts gently). Written back to J so the
    // sound of the cracks follows the same value.
    const cs = THREE.MathUtils.clamp((J.progress - T.crackStart) / Math.max(T.crackEnd - T.crackStart, 1e-3), 0, 1);
    J.crackSpread = cs * cs * (3 - 2 * cs) * 0.85 + cs * 0.15;
    shared.uCrackSpread.value = J.crackSpread * T.crackSpread;
    const level = shared.uWhiteLevel.value;
    // On the white the fog stays near display white (not HDR) and thin, so
    // the stone keeps reading as dark silhouettes while it turns to ash.
    fog.color.copy(HAZE).lerp(NIGHT_HAZE, night).lerp(WHITE.setScalar(Math.min(level, 1.6)), J.white);
    fog.density = THREE.MathUtils.lerp(T.fogDensity, 0.0016, J.white * J.white);
    // the captured environment is the sunset sky: dim it right down at night
    scene.environmentIntensity = T.envIntensity * (1 - night * 0.8) * (1 - J.white * 0.7);
    gl.toneMappingExposure = T.exposure;
  });
  return null;
}

// ---------------------------------------------------------------------------
// Lights: low sunset sun with shadows that follow the shot, sky/sand
// hemisphere, a warm bounce on the logo face, and the cube's own light.
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

export function Lights({ J, tier, shared, cubePosition }) {
  const sun = useRef();
  const core = useRef();
  const arc = useRef();
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
    if (hemi.current) {
      // a faint cool skylight keeps the night readable
      hemi.current.intensity = T.hemiIntensity * (1 - night) + 0.35 * night;
      hemi.current.color.copy(hexColor(T.hemiSky)).lerp(NIGHT_SKY, night);
      hemi.current.groundColor.copy(hexColor(T.hemiGround)).lerp(NIGHT_GROUND, night);
    }
    if (fill.current) {
      fill.current.intensity = T.fillIntensity * (1 - night);
      setColor(fill.current, T.fillColor);
    }
    if (core.current) {
      setColor(core.current, T.cubeColor);
      const spent = THREE.MathUtils.smoothstep(J.fracture, 0.15, 0.9);
      core.current.intensity = (60 * J.cubeGlow + 380 * J.energy * (1 - spent * 0.85) + 200 * J.field) * T.coreLight;
    }
    if (arc.current) {
      setColor(arc.current, T.cubeColor);
      const a = J.flow * 2.4;
      arc.current.position.set(cubePosition.x + Math.cos(a) * 4, cubePosition.y + Math.sin(a * 1.3) * 3.5, cubePosition.z + 2);
      arc.current.intensity = 260 * J.energy * (1 - J.fracture);
    }
  });

  const size = tier.shadowMap;
  return (
    <>
      <hemisphereLight ref={hemi} args={["#8d99ad", "#6e3a1a", 0.95]} />
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
      <directionalLight ref={fill} color="#d4875a" intensity={0.9} position={[-30, 25, 120]} />
      <pointLight ref={core} color="#ff6a12" distance={80} decay={2} position={[cubePosition.x, cubePosition.y, cubePosition.z + 3.2]} />
      <pointLight ref={arc} color="#ff7a2a" distance={40} decay={2} />
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
    u.uDust.value = J.dust * T.dust * (1 - J.white) * (1 - shared.uNight.value * 0.7);
    if (ref.current) ref.current.visible = u.uDust.value > 0.001;
  });

  return <points ref={ref} geometry={built.geometry} material={built.material} frustumCulled={false} />;
}

// ---------------------------------------------------------------------------
// Post: edge stretch + motion blur for the break, bloom tuned for the
// core, ACES tone mapping, vignette; bloom and vignette fade out for white.
// ---------------------------------------------------------------------------
export function Post({ J, tier }) {
  const bloom = useRef();
  const vignette = useRef();
  const fx = useMemo(() => new BreakEffect(), []);
  const blurDir = useRef(1);
  useEffect(() => () => fx.dispose(), [fx]);
  useFrame((_, delta) => {
    if (bloom.current) {
      bloom.current.intensity = J.bloom * T.bloomIntensity;
      bloom.current.luminanceMaterial.threshold = T.bloomThreshold;
      if (bloom.current.mipmapBlurPass) bloom.current.mipmapBlurPass.radius = T.bloomRadius;
    }
    if (vignette.current) vignette.current.darkness = J.vignette * T.vignette;
    // The blur only appears when you scroll with some intensity, follows
    // the scroll: zooming inwards scrolling down, outwards scrolling up.
    const speed = motion.intensity;
    if (Math.abs(motion.scroll) > T.scrollIntensityMin) {
      const k = 1 - Math.exp(-6 * Math.min(delta, 0.1));
      blurDir.current += (Math.sign(motion.scroll) - blurDir.current) * k;
    }
    fx.uniforms.get("uBlur").value = J.blur * T.blurStrength * (T.blurAtRest + (1 - T.blurAtRest) * speed);
    fx.uniforms.get("uDir").value = blurDir.current;
    fx.uniforms.get("uEdge").value = J.edge * T.edgeStretch;
    fx.uniforms.get("uChroma").value = T.chromatic;
  });
  return (
    <EffectComposer multisampling={tier.multisampling} enableNormalPass={false}>
      <primitive object={fx} dispose={null} />
      <Bloom ref={bloom} mipmapBlur intensity={0.9} luminanceThreshold={1.05} luminanceSmoothing={0.25} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette ref={vignette} offset={0.32} darkness={0.6} />
    </EffectComposer>
  );
}
