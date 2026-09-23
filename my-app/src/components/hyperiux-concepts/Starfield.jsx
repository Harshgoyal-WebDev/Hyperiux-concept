"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./scatter";

// A dome of stars (tinted white/warm-yellow/cool-blue, each twinkling on
// its own cycle) covering the upper hemisphere above the terrain, plus a
// small pool of shooting stars that each idle for a random interval, then
// streak a short arc across that dome, then go idle again — a slow,
// randomized time-lapse rather than a constant shower.
//
// This used to be a flat card facing one fixed direction, which worked
// while the camera only ever looked one way. Now that the scene is
// orbit-controllable, a flat card shows a hole in the sky the moment you
// turn away from its original facing — a hemisphere shell (points
// distributed by azimuth all the way around, elevation from the horizon up
// to the zenith) covers the sky from any orbit angle instead.

const STAR_COLORS = [
  new THREE.Color("#ffffff"),
  new THREE.Color("#fff4d6"),
  new THREE.Color("#cfe3ff"),
];

// `elevT` is 0 at the horizon, 1 at the zenith (straight up). `radiusJitter`
// is a fraction of `radius` (not an absolute world unit) so the shell has
// a little depth variance without needing per-scene tuning as radius
// changes.
function sampleHemispherePoint(random, radius, elevT, radiusJitter) {
  const azimuth = random() * Math.PI * 2;
  const elevAngle = elevT * (Math.PI / 2);
  const r = radius * (1 + (random() - 0.5) * radiusJitter);
  const cosElev = Math.cos(elevAngle);
  const x = r * cosElev * Math.cos(azimuth);
  const y = r * Math.sin(elevAngle);
  const z = r * cosElev * Math.sin(azimuth);
  return new THREE.Vector3(x, y, z);
}

const starVertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aTwinkleSeed;

  uniform float uTime;

  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vColor = aColor;
    vTwinkle = sin(uTime * (1.0 + aTwinkleSeed * 2.0) + aTwinkleSeed * 30.0) * 0.5 + 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * (300.0 / max(-mvPosition.z, 0.001));
  }
`;

const starFragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    float alpha = smoothstep(1.0, 0.0, d);
    float brightness = 0.55 + vTwinkle * 0.45;

    gl_FragColor = vec4(vColor * brightness, alpha * uOpacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function StarPoints({ count, radius, radiusJitter, opacity, elevationMin, elevationMax }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkles = new Float32Array(count);
    const random = mulberry32(count * 2003 + 11);
    const tMin = elevationMin / 100;
    const tSpan = (elevationMax - elevationMin) / 100;

    for (let i = 0; i < count; i++) {
      const point = sampleHemispherePoint(random, radius, tMin + random() * tSpan, radiusJitter);
      positions[i * 3 + 0] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      const color = STAR_COLORS[Math.floor(random() * STAR_COLORS.length)];
      colors[i * 3 + 0] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 1 + random() * 2.5;
      twinkles[i] = random();
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aTwinkleSeed", new THREE.BufferAttribute(twinkles, 1));
    return geo;
  }, [count, radius, radiusJitter, elevationMin, elevationMax]);

  const scratch = useRef(null);
  if (scratch.current === null) {
    scratch.current = {
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
      },
    };
  }
  const uniforms = scratch.current.uniforms;

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uOpacity.value = opacity;
  });

  return (
    <points
      geometry={geometry}
      ref={(node) => {
        // Layer 1 is excluded from the water's reflection camera (see
        // LakeSurface.jsx) — stars should sit in the sky behind the
        // terrain, not show up mirrored in the lake.
        if (node) node.layers.set(1);
      }}
    >
      <shaderMaterial
        args={[{ vertexShader: starVertexShader, fragmentShader: starFragmentShader, uniforms }]}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

const trailVertexShader = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const trailFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vT;

  void main() {
    float alpha = pow(vT, 2.0);
    gl_FragColor = vec4(uColor, alpha * uOpacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function ShootingStar({
  radius,
  radiusJitter,
  color,
  minInterval,
  maxInterval,
  duration,
  elevationMin,
  elevationMax,
  seed,
}) {
  const lineRef = useRef(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    geo.setAttribute("aT", new THREE.BufferAttribute(new Float32Array([0, 1]), 1));
    return geo;
  }, []);

  const scratch = useRef(null);
  if (scratch.current === null) {
    scratch.current = {
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0 },
      },
      random: mulberry32(seed * 104729 + 7),
      active: false,
      progress: 0,
      nextTime: -1,
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      head: new THREE.Vector3(),
      tail: new THREE.Vector3(),
    };
  }
  const s = scratch.current;
  const uniforms = s.uniforms;

  useFrame((state, delta) => {
    const line = lineRef.current;
    if (!line) return;

    const t = state.clock.elapsedTime;

    if (!s.active) {
      if (s.nextTime < 0) {
        // The very first wait is randomized across the full gap range
        // (not just minInterval..maxInterval) so every instance starts on
        // its own phase — otherwise, since they all mount within the same
        // frame, a fixed minInterval === maxInterval has them compute the
        // exact same nextTime and fire in permanent lockstep.
        s.nextTime = t + s.random() * Math.max(maxInterval, 0.1);
      }
      if (t < s.nextTime) return;

      s.active = true;
      s.progress = 0;

      const startT = (elevationMin + s.random() * (elevationMax - elevationMin)) / 100;
      s.start.copy(sampleHemispherePoint(s.random, radius, startT, radiusJitter));

      const endT = Math.max(elevationMin / 100, startT - (0.08 + s.random() * 0.12));
      s.end.copy(sampleHemispherePoint(s.random, radius, endT, radiusJitter));
      return;
    }

    s.progress += delta / duration;
    if (s.progress >= 1) {
      s.active = false;
      s.nextTime = t + minInterval + s.random() * (maxInterval - minInterval);
      uniforms.uOpacity.value = 0;
      return;
    }

    s.head.copy(s.start).lerp(s.end, s.progress);
    s.tail.copy(s.start).lerp(s.end, Math.max(0, s.progress - 0.15));

    const posAttr = line.geometry.attributes.position;
    posAttr.setXYZ(0, s.tail.x, s.tail.y, s.tail.z);
    posAttr.setXYZ(1, s.head.x, s.head.y, s.head.z);
    posAttr.needsUpdate = true;

    const fadeIn = Math.min(s.progress / 0.15, 1);
    const fadeOut = Math.min((1 - s.progress) / 0.3, 1);
    uniforms.uOpacity.value = fadeIn * fadeOut;
    uniforms.uColor.value.set(color);
  });

  return (
    <line
      geometry={geometry}
      ref={(node) => {
        lineRef.current = node;
        // Same reflection exclusion as the static stars.
        if (node) node.layers.set(1);
      }}
    >
      <shaderMaterial
        args={[{ vertexShader: trailVertexShader, fragmentShader: trailFragmentShader, uniforms }]}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </line>
  );
}

export default function Starfield({
  // Position/rotation of the whole dome — rotation is in radians per
  // three.js convention; use degrees-to-radians in whatever passes these
  // in if that's more convenient to tune from.
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  count = 500,
  // Shell radius, in world units — stars are distributed by azimuth (all
  // the way around) and elevation (horizon to zenith) on this shell, so
  // the sky reads correctly from any orbit angle instead of only the one
  // direction a flat card used to face.
  radius = 220,
  // Fractional depth variance (as a fraction of radius) so the shell
  // doesn't read as a perfectly smooth surface.
  radiusJitter = 0.06,
  opacity = 0.9,
  // How much of the dome's elevation (0-100, horizon to zenith) stars
  // populate — raise elevationMin to keep them clear of the terrain
  // silhouette.
  elevationMin = 8,
  elevationMax = 83,
  shootingStarCount = 3,
  shootingStarColor = "#dff2ff",
  shootingStarMinInterval = 3,
  shootingStarMaxInterval = 9,
  shootingStarDuration = 0.7,
}) {
  const shootingStars = useMemo(
    () => Array.from({ length: shootingStarCount }, (_, i) => i),
    [shootingStarCount]
  );

  return (
    <group position={position} rotation={rotation}>
      <StarPoints
        count={count}
        radius={radius}
        radiusJitter={radiusJitter}
        opacity={opacity}
        elevationMin={elevationMin}
        elevationMax={elevationMax}
      />
      {shootingStars.map((i) => (
        <ShootingStar
          key={i}
          radius={radius}
          radiusJitter={radiusJitter}
          color={shootingStarColor}
          minInterval={shootingStarMinInterval}
          maxInterval={shootingStarMaxInterval}
          duration={shootingStarDuration}
          elevationMin={elevationMin}
          elevationMax={elevationMax}
          seed={i + 1}
        />
      ))}
    </group>
  );
}
