"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

// A giant inverted sphere behind everything else (Starfield included),
// shaded by a simple vertical gradient — orange near the horizon fading up
// to black at the zenith. Previously the scene had no background at all
// (scene.background was never set), so the sky was just whatever the
// canvas's own empty clear color happens to be: flat black everywhere,
// including right at the horizon.
//
// Static (no per-frame uniform updates needed — it doesn't move or
// animate), so this stays a single cheap draw call: one big sphere,
// BackSide only, depthWrite off so it can never occlude anything real.

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBottomColor;
  uniform vec3 uTopColor;
  uniform float uHorizon;
  uniform float uZenith;
  uniform float uPower;

  varying vec3 vDir;

  void main() {
    // vDir.y is -1 straight down, 0 at the horizon, 1 straight up.
    // uHorizon/uZenith let the transition band itself be placed and
    // widened rather than always spanning the full -1..1 range.
    float t = clamp((vDir.y - uHorizon) / max(uZenith - uHorizon, 0.001), 0.0, 1.0);
    t = pow(t, uPower);
    vec3 color = mix(uBottomColor, uTopColor, t);

    gl_FragColor = vec4(color, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function SkyGradient({
  radius = 280,
  bottomColor = "#ff5f00",
  topColor = "#000000",
  horizon = -0.05,
  zenith = 0.65,
  power = 1.0,
}) {
  // Built once (stable reference for `args`, so the shaderMaterial isn't
  // torn down and recompiled every time an unrelated Leva control
  // elsewhere triggers a re-render) — this has no useFrame, so prop
  // changes are synced through a plain effect instead.
  const uniforms = useMemo(
    () => ({
      uBottomColor: { value: new THREE.Color(bottomColor) },
      uTopColor: { value: new THREE.Color(topColor) },
      uHorizon: { value: horizon },
      uZenith: { value: zenith },
      uPower: { value: power },
    }),
    []
  );

  useEffect(() => {
    uniforms.uBottomColor.value.set(bottomColor);
    uniforms.uTopColor.value.set(topColor);
    uniforms.uHorizon.value = horizon;
    uniforms.uZenith.value = zenith;
    uniforms.uPower.value = power;
  }, [uniforms, bottomColor, topColor, horizon, zenith, power]);

  return (
    <mesh frustumCulled={false} renderOrder={-100}>
      <sphereGeometry args={[radius, 24, 16]} />
      <shaderMaterial
        args={[{ vertexShader, fragmentShader, uniforms }]}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
