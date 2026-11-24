"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import {
  ACCENT,
  CAMERA_KEYS,
  CUBE_EDGE,
  CUBE_POS,
  CUBE_TILT,
  HAZE,
  SUN_DIR,
  buildDuneGeometry,
  createDuneHeight,
  createSkyMaterial,
  mulberry32,
} from "./world";

export const MONOLITH_URL = "/models/hyperiux-monolith.glb";
const SAND_NORMAL_URL = "/textures/sand/ground055l_normal.jpg";

// The about hero, scroll by scroll (S.p, 0..1, eased into S.e here):
//   0    – dusk on the dunes, the monolith far off, its fissures smouldering
//   →.5  – the camera comes in; the two halves part and the forge cube inside
//          the logo lights up, embers rising out of the split
//   →1   – on, between the halves, into the cube's light (the page then
//          whites out onto the team, AboutHero.jsx)
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
// how far the halves have parted (m each side)
const gapAt = (e) => smooth(0.16, 0.72, e) * 2.3;

export default function HeroScene({ S, quality, onReady }) {
  return (
    <>
      <SceneFrame S={S} />
      <Sky S={S} />
      <Environment frames={1} resolution={64}>
        <EnvSky />
      </Environment>
      <Lights S={S} quality={quality} />
      <Dunes quality={quality} />
      <Monolith S={S} onReady={onReady} />
      <ForgeCube S={S} />
      <BackGlow S={S} />
      <Embers S={S} count={quality.embers} />
      <Dust count={quality.dust} />
      <Rig S={S} />
      <Post S={S} quality={quality} />
    </>
  );
}

// Eases the scroll into S.e (once per frame, before everything else reads
// it) and sets the haze.
function SceneFrame({ S }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.fog = new THREE.FogExp2(HAZE, 0.0038);
    scene.environmentIntensity = 0.55;
    return () => {
      scene.fog = null;
    };
  }, [scene]);
  useFrame((_, dt) => {
    S.e = THREE.MathUtils.damp(S.e, S.p, 5, Math.min(dt, 0.1));
    S.mx = THREE.MathUtils.damp(S.mx, S.px, 3, Math.min(dt, 0.1));
    S.my = THREE.MathUtils.damp(S.my, S.py, 3, Math.min(dt, 0.1));
  }, -10);
  return null;
}

function Sky({ S }) {
  const material = useMemo(() => createSkyMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uHeat.value = smooth(0.2, 0.9, S.e);
  });
  return (
    <mesh material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[2400, 48, 24]} />
    </mesh>
  );
}

// the dusk sky once, for the stone's reflections
function EnvSky() {
  const material = useMemo(() => createSkyMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh material={material}>
      <sphereGeometry args={[100, 32, 16]} />
    </mesh>
  );
}

function Lights({ S, quality }) {
  const sun = useRef(null);
  const core = useRef(null);
  const sunPos = useMemo(() => SUN_DIR.clone().multiplyScalar(160), []);
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.target.position.set(0, 4, 0);
    light.target.updateMatrixWorld();
  }, []);
  useFrame(() => {
    const e = S.e;
    // the cube's light on the cut walls and the sand round the foot
    if (core.current) core.current.intensity = 6 + smooth(0.1, 0.95, e) * 150;
  });
  return (
    <>
      <directionalLight
        ref={sun}
        position={sunPos}
        intensity={3.4}
        color="#ffb076"
        castShadow={quality.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={420}
      />
      <hemisphereLight args={["#8d99ad", "#6e3a1a", 0.45]} />
      <pointLight ref={core} position={CUBE_POS.toArray()} color="#ff7a26" distance={40} decay={2} />
    </>
  );
}

function Dunes({ quality }) {
  const normal = useLoader(THREE.TextureLoader, SAND_NORMAL_URL);
  const geometry = useMemo(() => buildDuneGeometry(createDuneHeight(7), 1500, quality.segments), [quality.segments]);
  const material = useMemo(() => {
    const t = normal.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1500 / 4.5, 1500 / 4.5);
    t.anisotropy = 4;
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      color: "#6f3517",
      roughness: 0.96,
      metalness: 0,
      normalMap: t,
      normalScale: new THREE.Vector2(0.6, 0.6),
      envMapIntensity: 0.6,
    });
  }, [normal]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.normalMap?.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

// The two basalt halves (their authored PBR maps kept), parting with the
// scroll, the orange fissures in the stone warming as they do.
function Monolith({ S, onReady }) {
  const gltf = useGLTF(MONOLITH_URL);
  const { root, halves, material } = useMemo(() => {
    const root = gltf.scene.clone(true);
    let material = null;
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (!material) {
        material = o.material.clone();
        material.emissive = new THREE.Color(ACCENT);
        material.envMapIntensity = 0.8;
      }
      o.material = material;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const halves = ["HyperiuxMonolith_Left", "HyperiuxMonolith_Right"]
      .map((name, i) => {
        const node = root.getObjectByName(name);
        return node && { node, base: node.position.x, side: i === 0 ? -1 : 1 };
      })
      .filter(Boolean);
    root.position.y = -0.25;
    return { root, halves, material };
  }, [gltf]);

  useEffect(() => {
    onReady?.();
    return () => material?.dispose();
  }, [material, onReady]);

  useFrame((state) => {
    const e = S.e;
    const gap = gapAt(e);
    const t = state.clock.elapsedTime;
    for (const h of halves) {
      h.node.position.x = h.base + h.side * gap;
      // (a slight lean outwards as they part, as if pushed by the light)
      h.node.rotation.z = -h.side * smooth(0.2, 0.75, e) * 0.035;
    }
    if (material) material.emissiveIntensity = 0.9 + smooth(0.08, 0.7, e) * 3.2 + Math.sin(t * 1.7) * 0.15;
  });

  return <primitive object={root} />;
}

// The cube in the logo's hexagon: dark stone with burning edges, turning
// slowly, its light growing until the camera goes into it.
function ForgeCube({ S }) {
  const spin = useRef(null);
  const body = useRef(null);
  const halo = useRef(null);
  const faceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#140904", roughness: 0.4, metalness: 0.3, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0.4 }),
    []
  );
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_EDGE, CUBE_EDGE, CUBE_EDGE)), []);
  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color(5, 1.6, 0.3), toneMapped: false, transparent: true }), []);
  const haloMat = useMemo(() => makeGlowMaterial(new THREE.Color(1.0, 0.42, 0.08)), []);
  useEffect(
    () => () => {
      faceMat.dispose();
      edges.dispose();
      edgeMat.dispose();
      haloMat.dispose();
    },
    [faceMat, edges, edgeMat, haloMat]
  );

  useFrame((state, dt) => {
    const e = S.e;
    const end = smooth(0.72, 1, e);
    if (spin.current) {
      spin.current.rotation.y += dt * (0.25 + smooth(0.2, 1, e) * 0.9);
      spin.current.position.y = CUBE_POS.y + Math.sin(state.clock.elapsedTime * 0.8) * 0.06 * smooth(0.2, 0.6, e);
      spin.current.scale.setScalar(1 + end * 0.5);
    }
    faceMat.emissiveIntensity = 0.35 + smooth(0.15, 0.8, e) * 2.2 + end * 14;
    haloMat.uniforms.uIntensity.value = 0.25 + smooth(0.1, 0.8, e) * 1.6 + end * 3;
    if (halo.current) {
      halo.current.quaternion.copy(state.camera.quaternion);
      halo.current.scale.setScalar(4 + smooth(0.2, 1, e) * 5);
    }
  });

  return (
    <>
      <group ref={spin} position={CUBE_POS.toArray()}>
        <group rotation={CUBE_TILT}>
          <mesh ref={body} material={faceMat}>
            <boxGeometry args={[CUBE_EDGE, CUBE_EDGE, CUBE_EDGE]} />
          </mesh>
          <lineSegments geometry={edges} material={edgeMat} scale={1.002} />
        </group>
      </group>
      <mesh ref={halo} position={CUBE_POS.toArray()} material={haloMat} renderOrder={5}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </>
  );
}

// A soft radial glow (additive, unlit, no fog).
function makeGlowMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uColor: { value: color }, uIntensity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float g = pow(max(1.0 - r, 0.0), 2.4) + pow(max(1.0 - r, 0.0), 10.0) * 2.0;
        gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
      }
    `,
  });
}

// Light behind the monolith: it burns through the logo's cut-outs and, as
// the halves part, through the split between them.
function BackGlow({ S }) {
  const material = useMemo(() => makeGlowMaterial(new THREE.Color(1.0, 0.38, 0.06)), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    material.uniforms.uIntensity.value = 0.55 + smooth(0.08, 0.75, S.e) * 2.4;
  });
  return (
    <mesh position={[0, 6.3, -2.4]} material={material} renderOrder={2}>
      <planeGeometry args={[26, 26]} />
    </mesh>
  );
}

// Embers rising out of the split as the forge opens.
function Embers({ S, count }) {
  const size = useThree((s) => s.size);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rand = mulberry32(11);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uGap: { value: 0 }, uAmount: { value: 0 }, uViewH: { value: 800 } },
        vertexShader: /* glsl */ `
          attribute vec4 aSeed;
          uniform float uTime;
          uniform float uGap;
          uniform float uAmount;
          uniform float uViewH;
          varying float vAlpha;
          void main() {
            float life = fract(uTime * (0.05 + aSeed.x * 0.07) + aSeed.y);
            vec3 p;
            p.x = (aSeed.w - 0.5) * (0.5 + uGap * 2.2);
            p.y = 0.6 + life * 16.0;
            p.z = (fract(aSeed.x * 7.13) - 0.5) * 2.6 + life * 2.4;
            p.x += sin(uTime * 0.9 + aSeed.y * 30.0 + life * 6.0) * 0.7 * life;
            p.z += cos(uTime * 0.7 + aSeed.x * 20.0) * 0.4 * life;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (0.05 + fract(aSeed.w * 13.1) * 0.09) * uViewH / max(-mv.z, 0.5);
            vAlpha = uAmount * smoothstep(0.0, 0.08, life) * (1.0 - life);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float a = pow(max(1.0 - d, 0.0), 1.6) * vAlpha;
            gl_FragColor = vec4(vec3(1.0, 0.42, 0.1) * 4.0 * a, 1.0);
          }
        `,
      }),
    []
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  useFrame((state) => {
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uGap.value = gapAt(S.e);
    u.uAmount.value = 0.15 + smooth(0.12, 0.6, S.e) * 0.85;
    u.uViewH.value = size.height * state.gl.getPixelRatio();
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// Fine sand drifting on the wind through the shot.
function Dust({ count }) {
  const size = useThree((s) => s.size);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rand = mulberry32(23);
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (rand() - 0.5) * 120;
      p[i * 3 + 1] = rand() * 14;
      p[i * 3 + 2] = -30 + rand() * 110;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uViewH: { value: 800 } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform float uViewH;
          varying float vA;
          void main() {
            vec3 p = position;
            p.x = mod(p.x - uTime * 1.6 + 60.0, 120.0) - 60.0;
            p.y += sin(uTime * 0.5 + position.x) * 0.4;
            p.z += sin(uTime * 0.3 + position.y * 2.0) * 0.6;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = 0.05 * uViewH / max(-mv.z, 0.5);
            vA = smoothstep(90.0, 10.0, -mv.z) * smoothstep(0.5, 3.0, -mv.z);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            gl_FragColor = vec4(vec3(1.0, 0.78, 0.58) * 0.35 * pow(max(1.0 - d, 0.0), 2.0) * vA, 1.0);
          }
        `,
      }),
    []
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uViewH.value = size.height * state.gl.getPixelRatio();
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// The camera along its keys, a little sway with the pointer (less as it
// closes in).
function Rig({ S }) {
  const curves = useMemo(() => {
    const make = (keys) => new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k)), false, "centripetal");
    return { position: make(CAMERA_KEYS.position), target: make(CAMERA_KEYS.target) };
  }, []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const e = clamp01(S.e);
    curves.position.getPoint(e, pos);
    curves.target.getPoint(e, target);
    const sway = 1 - smooth(0.6, 1, e) * 0.85;
    const t = state.clock.elapsedTime;
    pos.x += S.mx * 1.6 * sway + Math.sin(t * 0.21) * 0.25 * sway;
    pos.y += S.my * 0.7 * sway + Math.sin(t * 0.33) * 0.12 * sway;
    state.camera.position.copy(pos);
    state.camera.lookAt(target);
  });
  return null;
}

function Post({ S, quality }) {
  const bloom = useRef(null);
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 0.75 + smooth(0.6, 1, S.e) * 1.4;
  });
  return (
    <EffectComposer multisampling={quality.multisampling} enableNormalPass={false}>
      <Bloom ref={bloom} mipmapBlur levels={6} intensity={0.75} luminanceThreshold={1.0} luminanceSmoothing={0.25} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.62} />
    </EffectComposer>
  );
}

useGLTF.preload(MONOLITH_URL);
