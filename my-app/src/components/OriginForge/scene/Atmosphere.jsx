"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { C, lerp } from "../timeline";
import { IVORY, skyMaterial } from "../world/shaders";
import { T, setColor } from "../tuning";
import { stairPoint } from "../world/stair";

// Sky, fog, light and reflections. One set for the whole journey, blended by
// the `light` channel from the forge's darkness into the ivory stair hall.

const FOG_DARK = new THREE.Color();
const HEMI_SKY_DARK = new THREE.Color();
const HEMI_GROUND_DARK = new THREE.Color();
const HEMI_SKY_LIGHT = new THREE.Color("#fffaf3");
const HEMI_GROUND_LIGHT = new THREE.Color("#d8b596");

export default function Atmosphere({ tier }) {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const sky = useMemo(() => skyMaterial(), []);
  const skyRef = useRef();
  const hemi = useRef();
  const rim = useRef();
  const key = useRef();
  const fog = useMemo(() => new THREE.FogExp2(FOG_DARK.clone(), 0.02), []);
  const stairCenter = useMemo(() => stairPoint(0.5, 0, 0), []);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.fog = fog;
    scene.background = null;
    // the stair's shadows are static: drawn once, when it appears
    gl.shadowMap.autoUpdate = false;
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

  useEffect(() => {
    if (!key.current) return;
    key.current.target.position.copy(stairCenter);
    key.current.target.updateMatrixWorld();
  }, [stairCenter]);

  useFrame((state) => {
    const L = C.light;
    const t = state.clock.elapsedTime;
    sky.uniforms.uTime.value = t;
    sky.uniforms.uHorizon.value = C.horizon * (1 - L) * T.horizon;
    sky.uniforms.uLight.value = L;
    setColor(sky.uniforms.uTop.value, T.skyTop);
    setColor(sky.uniforms.uMid.value, T.skyMid);
    setColor(sky.uniforms.uGlow.value, T.skyGlow);
    skyRef.current.position.copy(state.camera.position);

    setColor(FOG_DARK, T.fogColor);
    setColor(HEMI_SKY_DARK, T.hemiSky);
    setColor(HEMI_GROUND_DARK, T.hemiGround);
    fog.color.copy(FOG_DARK).lerp(IVORY, L);
    fog.density = lerp(T.fogDensity, 0.0095, L);
    scene.environmentIntensity = lerp(T.envIntensity, 0.75, L);
    // without post-processing, exposure is the renderer's
    gl.toneMappingExposure = tier.post ? 1 : T.exposure;

    hemi.current.color.copy(HEMI_SKY_DARK).lerp(HEMI_SKY_LIGHT, L);
    hemi.current.groundColor.copy(HEMI_GROUND_DARK).lerp(HEMI_GROUND_LIGHT, L);
    hemi.current.intensity = lerp(T.hemiIntensity, 1.35, L);
    setColor(rim.current.color, T.rimColor);
    rim.current.intensity = (1 - L) * (0.6 + 0.9 * C.horizon) * T.rimIntensity;
    key.current.intensity = L * 2.6;
    key.current.visible = L > 0.001;
  });

  return (
    <>
      <mesh ref={skyRef} material={sky} frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[500, 48, 24]} />
      </mesh>
      <hemisphereLight ref={hemi} />
      {/* rim light from the molten horizon, behind the forge */}
      <directionalLight ref={rim} position={[0, 18, -60]} />
      {/* the stair hall's sun: warm, high and ahead of the climb, so treads
          catch the light and risers fall into soft shade */}
      <directionalLight
        ref={key}
        position={[stairCenter.x - 30, stairCenter.y + 62, stairCenter.z - 40]}
        color="#fff3e2"
        castShadow={tier.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-56}
        shadow-camera-right={56}
        shadow-camera-top={56}
        shadow-camera-bottom={-56}
        shadow-camera-near={1}
        shadow-camera-far={180}
      />
    </>
  );
}

