"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createWaterSimulation } from "./waterSimulation";
import { smokeReflectionUniform, glowReflectionUniform } from "./sharedUniforms";

// Mirrored-camera reflection, following the technique from
// three/examples/jsm/objects/Reflector.js, but hand-rolled as our own
// ShaderMaterial so the look (color grading, fresnel, distortion, glow
// tint) stays fully ours to tune. Surface displacement + ripples come from
// a real GPGPU wave-equation sim (see waterSimulation.js), the same
// approach as three/examples/webgl_gpgpu_water.html.

const vertexShader = /* glsl */ `
  uniform mat4 textureMatrix;
  uniform sampler2D tHeightmap;
  uniform float uHeightScale;
  uniform float uHeightmapTexelSize;

  varying vec4 vProjUv;
  varying vec3 vWorldPosition;
  varying vec3 vWaveNormal;
  varying float vLocalDist;

  void main() {
    vLocalDist = length(position.xy);

    float h = texture2D(tHeightmap, uv).x;

    vec3 displaced = position;
    displaced.z += h * uHeightScale;

    float hL = texture2D(tHeightmap, uv - vec2(uHeightmapTexelSize, 0.0)).x;
    float hR = texture2D(tHeightmap, uv + vec2(uHeightmapTexelSize, 0.0)).x;
    float hD = texture2D(tHeightmap, uv - vec2(0.0, uHeightmapTexelSize)).x;
    float hU = texture2D(tHeightmap, uv + vec2(0.0, uHeightmapTexelSize)).x;
    vWaveNormal = vec3((hL - hR) * uHeightScale, (hD - hU) * uHeightScale, 1.0);

    vProjUv = textureMatrix * vec4(displaced, 1.0);
    vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tReflection;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uGlowColor;
  uniform float uOpacity;
  uniform float uReflectionBend;
  uniform float uReflectivity;
  uniform vec3 uCameraPosition;
  uniform vec3 uLightDirection;
  uniform vec3 uLightColor;
  uniform float uSpecularPower;
  uniform float uSpecularIntensity;
  uniform float uRadius;

  varying vec4 vProjUv;
  varying vec3 vWorldPosition;
  varying vec3 vWaveNormal;
  varying float vLocalDist;

  void main() {
    if (vLocalDist > uRadius) discard;

    vec3 waveNormal = normalize(vWaveNormal);

    // Reflection bend comes purely from the real simulated ripple slope —
    // this is what makes reflections (like the beam) bend as ripples pass
    // through instead of staying a perfectly straight mirror line.
    vec4 uv = vProjUv;
    uv.xy += waveNormal.xy * uReflectionBend * uv.w;

    // Dim the reflection rather than dropping it — a pitch-black lake still
    // catches light, it just doesn't mirror it back at full brightness.
    vec3 reflection = texture2DProj(tReflection, uv).rgb * uReflectivity;

    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    vec3 shadingNormal = normalize(vec3(waveNormal.x, 1.0, waveNormal.y));
    float fresnel = pow(1.0 - clamp(dot(viewDir, shadingNormal), 0.0, 1.0), 3.0);

    vec3 base = mix(uDeepColor, uShallowColor, fresnel * 0.5);
    vec3 color = mix(base, reflection, clamp(fresnel + 0.4, 0.0, 1.0));

    float reflectionLuma = dot(reflection, vec3(0.299, 0.587, 0.114));
    color += uGlowColor * pow(max(reflectionLuma, 0.0), 2.0) * 0.6;

    // A crisp highlight riding each ripple's slope — this is what makes the
    // concentric rings actually read as moving water rather than a subtle
    // reflection wobble.
    vec3 halfDir = normalize(viewDir + uLightDirection);
    float spec = pow(max(dot(shadingNormal, halfDir), 0.0), uSpecularPower);
    color += uLightColor * spec * uSpecularIntensity;

    gl_FragColor = vec4(color, uOpacity);

    // Without this, bright specular hotspots (reflected terrain, the ripple
    // highlight above) can sum past 1.0 and get hard-clipped to flat white
    // blobs instead of rolling off like the rest of the tonemapped scene.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function LakeSurface({
  width = 30,
  depth = 30,
  segments = 120,
  radius = Math.min(width, depth) / 2,
  position = [0, 0, 0],
  reflectionResolution = 512,
  simResolution = 128,
  deepColor = "#000000",
  shallowColor = "#020202",
  glowColor = "#ff7000",
  opacity = 1,
  heightScale = 0.6,
  reflectionBend = 0.7,
  reflectivity = 0.4,
  viscosity = 0.985,
  mouseSize = 0.06,
  mouseIntensity = 0.22,
  // Constantly-moving surface current, independent of any pointer
  // interaction — see waterSimulation.js. currentFrequency is how many
  // parallel ripple streaks pack across the current direction (higher =
  // denser/finer), currentStretch is how elongated each streak is along
  // the flow, currentSpeed/currentAngleDeg control how fast and which way
  // the whole field scrolls.
  currentStrength = 0.05,
  currentFrequency = 22,
  currentStretch = 3,
  currentSpeed = 0.12,
  currentAngleDeg = 20,
  hoverIntensityRatio = 0.35,
  hoverFadeSpeed = 6,
  clickBurstDuration = 0.2,
  lightDirection = [-14, 18, -8],
  lightColor = "#e8ece6",
  specularPower = 48,
  specularIntensity = 0.8,
  smokeReflectionStrength = 0.18,
  glowReflectionStrength = 0.35,
  // Once the page has scrolled past this (0..1, same shared scroll ref the
  // camera rigs use), the lake is out of view behind the tunnel — skip the
  // whole frame update, most importantly the extra full-scene render into
  // the reflection target, which is the single most expensive thing this
  // component does.
  progressRef,
  activeUntil = 1,
}) {
  const meshRef = useRef(null);
  const { gl, scene, camera: mainCamera } = useThree();

  const reflectionCameraRef = useRef(null);
  if (reflectionCameraRef.current === null) {
    const clone = mainCamera.clone();
    // Dust/stars live on layer 1 and stay excluded from the reflection —
    // their additive glow overwhelmed the reflected image. Smoke lives on
    // layer 2 instead, which stays enabled here; its reflected brightness
    // is dimmed per-frame below (see smokeReflectionUniform) rather than
    // excluded outright, so a faint smoke reflection still shows.
    clone.layers.disable(1);
    clone.layers.enable(2);
    reflectionCameraRef.current = clone;
  }
  const reflectionCamera = reflectionCameraRef.current;

  const renderTarget = useMemo(
    () =>
      new THREE.WebGLRenderTarget(reflectionResolution, reflectionResolution, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      }),
    [reflectionResolution]
  );

  useEffect(() => () => renderTarget.dispose(), [renderTarget]);

  const simulationRef = useRef(null);
  if (simulationRef.current === null) {
    simulationRef.current = createWaterSimulation({ renderer: gl, resolution: simResolution });
  }

  // Native pointer state, tracked outside R3F's synthetic event/capture
  // system (which OrbitControls also listens on) so ripple detection can't
  // be swallowed by a conflicting capture — same approach the original
  // webgl_gpgpu_water.html demo uses: raycast against the water mesh from
  // the current pointer position every frame. Hovering alone makes a
  // gentle continuous ripple follow the cursor; an actual click stamps one
  // stronger burst on top of that, rather than requiring click-and-drag.
  const pointerNdcRef = useRef(new THREE.Vector2(-10, -10));
  const pointerRef = useRef({ uv: new THREE.Vector2(-10, -10), active: false });
  const clickTriggerRef = useRef(false);
  // Eases toward 1 while the cursor is actively moving over the water and
  // back toward 0 as soon as it stops (or leaves), so a stationary cursor
  // doesn't leave a static dimple sitting on the surface — only real
  // movement keeps the ripple alive.
  const hoverStrengthRef = useRef(0);
  const lastHoverUvRef = useRef(null);
  if (lastHoverUvRef.current === null) {
    lastHoverUvRef.current = new THREE.Vector2(-10, -10);
  }
  const burstRef = useRef(null);
  if (burstRef.current === null) {
    burstRef.current = { active: false, endTime: 0, uv: new THREE.Vector2() };
  }
  const autoRippleRef = useRef(null);
  if (autoRippleRef.current === null) {
    // nextTime is randomized on the first useFrame tick instead of here —
    // Math.random() during render is impure and flagged by the compiler.
    autoRippleRef.current = {
      active: false,
      nextTime: 0,
      endTime: 0,
      uv: new THREE.Vector2(),
    };
  }

  useEffect(() => {
    const canvas = gl.domElement;

    const updateNdc = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointerNdcRef.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
    };

    const handleMove = (event) => updateNdc(event);

    const handleDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      updateNdc(event);
      clickTriggerRef.current = true;
    };

    const handleLeave = () => {
      // Move off-canvas so hover-following stops once the cursor leaves.
      pointerNdcRef.current.set(-10, -10);
    };

    window.addEventListener("pointermove", handleMove);
    canvas.addEventListener("pointerdown", handleDown);
    canvas.addEventListener("pointerleave", handleLeave);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerdown", handleDown);
      canvas.removeEventListener("pointerleave", handleLeave);
    };
  }, [gl]);

  // Mutable scratch state that gets written to every frame. useRef (not
  // useMemo) is the correct container here — these values are intentionally
  // reassigned imperatively outside of React's render cycle.
  const scratch = useRef(null);
  if (scratch.current === null) {
    const textureMatrix = new THREE.Matrix4();
    scratch.current = {
      textureMatrix,
      uniforms: {
        tReflection: { value: renderTarget.texture },
        // populated on the first useFrame tick, before it's ever sampled
        tHeightmap: { value: null },
        textureMatrix: { value: textureMatrix },
        uDeepColor: { value: new THREE.Color(deepColor) },
        uShallowColor: { value: new THREE.Color(shallowColor) },
        uGlowColor: { value: new THREE.Color(glowColor) },
        uOpacity: { value: opacity },
        uReflectionBend: { value: reflectionBend },
        uReflectivity: { value: reflectivity },
        uCameraPosition: { value: new THREE.Vector3() },
        uHeightScale: { value: heightScale },
        uHeightmapTexelSize: { value: 1 / simResolution },
        uLightDirection: {
          value: new THREE.Vector3(...lightDirection).normalize(),
        },
        uLightColor: { value: new THREE.Color(lightColor) },
        uSpecularPower: { value: specularPower },
        uSpecularIntensity: { value: specularIntensity },
        uRadius: { value: radius },
      },
      reflectorPlane: new THREE.Plane(),
      normal: new THREE.Vector3(),
      reflectorWorldPosition: new THREE.Vector3(),
      cameraWorldPosition: new THREE.Vector3(),
      rotationMatrix: new THREE.Matrix4(),
      lookAtPosition: new THREE.Vector3(0, 0, -1),
      clipPlane: new THREE.Vector4(),
      view: new THREE.Vector3(),
      target: new THREE.Vector3(),
      q: new THREE.Vector4(),
    };
  }
  const uniforms = scratch.current.uniforms;

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (progressRef && progressRef.current >= activeUntil) return;

    const simulation = simulationRef.current;

    // Resolve whether the pointer is currently hovering the water (no
    // button needed). Raycast the whole scene (not just this mesh) so a
    // rock or terrain ridge standing in front of the lake from this camera
    // angle correctly blocks the hover instead of "seeing through" it.
    // Walk up from the mesh itself to find that scene's actual root — this
    // content is portaled into PortalRenderer's own offscreen `bgScene`
    // (see PortalRenderer.jsx) for the shockwave compositing, so `state.scene`
    // (R3F's root scene) no longer contains it and would always miss.
    let hovering = false;
    state.raycaster.setFromCamera(pointerNdcRef.current, state.camera);
    let sceneRoot = mesh;
    while (sceneRoot.parent) sceneRoot = sceneRoot.parent;
    const closest = state.raycaster.intersectObjects(sceneRoot.children, true)[0];
    if (closest?.object === mesh && closest.uv) {
      // The mesh is still a square plane under the hood (for correct
      // heightmap/UV sampling); the circular shape is a fragment-shader
      // discard. Match that boundary here so corners that render as
      // "not water" don't register either.
      const localX = (closest.uv.x - 0.5) * width;
      const localY = (closest.uv.y - 0.5) * depth;
      if (Math.hypot(localX, localY) <= radius) {
        pointerRef.current.uv.copy(closest.uv);
        hovering = true;
      }
    }
    pointerRef.current.active = hovering;

    // A click while hovering starts a short, stronger ripple burst on top
    // of the gentle hover-follow ripple.
    if (clickTriggerRef.current) {
      clickTriggerRef.current = false;
      if (hovering) {
        burstRef.current.active = true;
        burstRef.current.uv.copy(pointerRef.current.uv);
        burstRef.current.endTime = state.clock.elapsedTime + clickBurstDuration;
      }
    }

    let simUV = pointerRef.current.uv;
    let simActive = false;
    let intensityScale = 1;

    if (burstRef.current.active) {
      if (state.clock.elapsedTime < burstRef.current.endTime) {
        simUV = burstRef.current.uv;
        simActive = true;
        intensityScale = 1;
      } else {
        burstRef.current.active = false;
      }
    }

    // Only actual cursor movement over the water keeps the ripple going —
    // a cursor that stops moving (even while still hovering) should let it
    // fade out just like leaving the water does, instead of leaving a
    // static dimple parked at the last position.
    let moving = false;
    if (hovering) {
      const moveDist = pointerRef.current.uv.distanceTo(lastHoverUvRef.current);
      moving = moveDist > 0.0015;
      lastHoverUvRef.current.copy(pointerRef.current.uv);
    } else {
      lastHoverUvRef.current.set(-10, -10);
    }

    // Ease the hover influence in/out instead of snapping, so it fades
    // smoothly rather than cutting off the instant movement stops.
    const hoverTarget = moving ? 1 : 0;
    const hoverLerp = 1 - Math.exp(-hoverFadeSpeed * delta);
    hoverStrengthRef.current += (hoverTarget - hoverStrengthRef.current) * hoverLerp;

    if (!simActive && hoverStrengthRef.current > 0.01) {
      simUV = pointerRef.current.uv;
      simActive = true;
      intensityScale = hoverIntensityRatio * hoverStrengthRef.current;
    }

    // When nothing is hovering or clicking, occasionally stamp a brief
    // ripple at a random point so the lake never looks dead-still.
    if (!simActive) {
      const auto = autoRippleRef.current;
      if (auto.active) {
        simUV = auto.uv;
        simActive = true;
        if (state.clock.elapsedTime > auto.endTime) {
          auto.active = false;
          auto.nextTime = state.clock.elapsedTime + 1.5 + Math.random() * 3;
        }
      } else if (state.clock.elapsedTime > auto.nextTime) {
        auto.active = true;
        auto.uv.set(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7);
        auto.endTime = state.clock.elapsedTime + 0.15;
        simUV = auto.uv;
        simActive = true;
      }
    }

    simulation.setPointer(simUV, simActive);
    simulation.setParams({
      viscosity,
      mouseSize,
      mouseIntensity: mouseIntensity * intensityScale,
      currentStrength,
      currentFrequency,
      currentStretch,
      currentSpeed,
      currentAngleDeg,
    });
    simulation.setTime(state.clock.elapsedTime);
    simulation.compute();
    uniforms.tHeightmap.value = simulation.getTexture();

    const {
      textureMatrix,
      reflectorPlane,
      normal,
      reflectorWorldPosition,
      cameraWorldPosition,
      rotationMatrix,
      lookAtPosition,
      clipPlane,
      view,
      target,
      q,
    } = scratch.current;

    uniforms.uCameraPosition.value.copy(state.camera.position);
    uniforms.uDeepColor.value.set(deepColor);
    uniforms.uShallowColor.value.set(shallowColor);
    uniforms.uGlowColor.value.set(glowColor);
    uniforms.uOpacity.value = opacity;
    uniforms.uReflectionBend.value = reflectionBend;
    uniforms.uReflectivity.value = reflectivity;
    uniforms.uHeightScale.value = heightScale;
    uniforms.uLightDirection.value.set(...lightDirection).normalize();
    uniforms.uLightColor.value.set(lightColor);
    uniforms.uSpecularPower.value = specularPower;
    uniforms.uSpecularIntensity.value = specularIntensity;
    uniforms.uRadius.value = radius;

    reflectorWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
    cameraWorldPosition.setFromMatrixPosition(state.camera.matrixWorld);

    rotationMatrix.extractRotation(mesh.matrixWorld);
    normal.set(0, 0, 1).applyMatrix4(rotationMatrix);

    view.subVectors(reflectorWorldPosition, cameraWorldPosition);
    if (view.dot(normal) > 0) return;

    view.reflect(normal).negate();
    view.add(reflectorWorldPosition);

    rotationMatrix.extractRotation(state.camera.matrixWorld);
    lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix);
    lookAtPosition.add(cameraWorldPosition);

    target.subVectors(reflectorWorldPosition, lookAtPosition);
    target.reflect(normal).negate();
    target.add(reflectorWorldPosition);

    reflectionCamera.position.copy(view);
    reflectionCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
    reflectionCamera.lookAt(target);
    reflectionCamera.far = state.camera.far;
    reflectionCamera.updateMatrixWorld();
    reflectionCamera.projectionMatrix.copy(state.camera.projectionMatrix);

    textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    textureMatrix.multiply(reflectionCamera.projectionMatrix);
    textureMatrix.multiply(reflectionCamera.matrixWorldInverse);
    textureMatrix.multiply(mesh.matrixWorld);

    reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
    reflectorPlane.applyMatrix4(reflectionCamera.matrixWorldInverse);
    clipPlane.set(
      reflectorPlane.normal.x,
      reflectorPlane.normal.y,
      reflectorPlane.normal.z,
      reflectorPlane.constant
    );

    const projectionMatrix = reflectionCamera.projectionMatrix;

    q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    q.z = -1.0;
    q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

    projectionMatrix.elements[2] = clipPlane.x;
    projectionMatrix.elements[6] = clipPlane.y;
    projectionMatrix.elements[10] = clipPlane.z + 1.0;
    projectionMatrix.elements[14] = clipPlane.w;

    mesh.visible = false;

    const currentRenderTarget = gl.getRenderTarget();
    const currentXr = gl.xr.enabled;
    const currentShadowAutoUpdate = gl.shadowMap.autoUpdate;

    gl.xr.enabled = false;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(renderTarget);
    gl.state.buffers.depth.setMask(true);
    if (!gl.autoClear) gl.clear();
    // Dim the smoke and the cuboid/beams for just this one render call,
    // then restore them before the main pass draws — see sharedUniforms.js.
    smokeReflectionUniform.value = smokeReflectionStrength;
    glowReflectionUniform.value = glowReflectionStrength;
    gl.render(scene, reflectionCamera);
    smokeReflectionUniform.value = 1;
    glowReflectionUniform.value = 1;

    gl.xr.enabled = currentXr;
    gl.shadowMap.autoUpdate = currentShadowAutoUpdate;
    gl.setRenderTarget(currentRenderTarget);

    mesh.visible = true;
  });

  return (
    <mesh ref={meshRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth, segments, segments]} />
      {/*
        Passing `uniforms` as a normal prop makes R3F shallow-copy each
        uniform's contents into brand-new wrapper objects exactly once,
        instead of keeping our object as the live `material.uniforms`
        (see @react-three/fiber's "ShaderMaterial uniforms must keep a
        stable target reference" special-case). Every subsequent mutation
        in useFrame would then be writing to an orphaned copy the renderer
        never reads. Passing it via `args` hands it straight to the
        THREE.ShaderMaterial constructor instead, which assigns it as the
        real, live `material.uniforms` reference.
      */}
      <shaderMaterial
        args={[{ vertexShader, fragmentShader, uniforms }]}
        transparent={opacity < 1}
      />
    </mesh>
  );
}
