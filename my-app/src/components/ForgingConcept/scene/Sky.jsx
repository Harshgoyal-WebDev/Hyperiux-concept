"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { SUN_DIR } from "../config";
import { T } from "../tuning";

// Muted blue-grey sky with a warm amber horizon and a low sun. Colours are
// linear; the composer's tone mapping takes them to display space, so the
// fog colour (Rig.jsx) is picked to match the horizon band. At night
// (uNight) it turns deep navy with stars and a pale moon where the sun was.
export default function Sky({ shared }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSunDir: { value: SUN_DIR.clone() },
          uNight: shared.uNight,
          uStars: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uSunDir;
          uniform float uNight;
          uniform float uStars;
          varying vec3 vDir;
          float ncHash3(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }
          // a round disc of the given angular radius (rad) round dir, with a
          // crisp edge about a pixel wide (the sun, the moon)
          float ncDisc(vec3 d, vec3 dir, float radius) {
            float a = acos(clamp(dot(d, dir), -1.0, 1.0));
            return 1.0 - smoothstep(radius - 0.0012, radius + 0.0012, a);
          }
          vec3 ncNight(vec3 d, float h, float sun) {
            vec3 zenith = vec3(0.004, 0.007, 0.02);
            vec3 upper = vec3(0.012, 0.02, 0.045);
            vec3 horizon = vec3(0.05, 0.055, 0.09);
            vec3 col = mix(horizon, upper, smoothstep(-0.01, 0.22, h));
            col = mix(col, zenith, smoothstep(0.22, 0.8, h));
            // cool glow around the moon, the disc itself and a soft halo
            col += vec3(0.25, 0.32, 0.5) * pow(sun, 18.0) * 0.5;
            col += vec3(0.6, 0.68, 0.9) * pow(sun, 300.0) * 0.5;
            // (bright enough to glow a little, not to bloom into a blob)
            col = mix(col, vec3(0.92, 0.94, 1.0) * 1.6, ncDisc(d, uSunDir, 0.022));
            // stars: one candidate per cell of a direction grid
            vec3 g = d * 160.0;
            vec3 cell = floor(g);
            float r = ncHash3(cell);
            vec3 o = vec3(ncHash3(cell + 1.7), ncHash3(cell + 3.1), ncHash3(cell + 5.3)) - 0.5;
            float dist = length(fract(g) - 0.5 - o * 0.6);
            float star = step(0.975, r) * (1.0 - smoothstep(0.0, 0.11, dist));
            star *= mix(0.4, 2.2, ncHash3(cell + 9.0)) * smoothstep(0.03, 0.3, h) * (1.0 - pow(sun, 40.0));
            col += vec3(0.85, 0.9, 1.0) * star * uStars;
            if (h < 0.0) col = mix(col, vec3(0.03, 0.03, 0.05), smoothstep(0.0, -0.08, h));
            return col;
          }
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            float sun = max(dot(d, uSunDir), 0.0);
            vec3 zenith = vec3(0.13, 0.17, 0.25);
            vec3 upper = vec3(0.30, 0.33, 0.40);
            vec3 horizon = vec3(0.95, 0.50, 0.24);
            vec3 col = mix(horizon, upper, smoothstep(-0.01, 0.2, h));
            col = mix(col, zenith, smoothstep(0.2, 0.75, h));
            // warm band strongest on the sun side of the horizon
            float band = 1.0 - smoothstep(0.0, 0.32, abs(h));
            col += vec3(1.0, 0.42, 0.12) * pow(sun, 5.0) * band * 0.9;
            col += vec3(1.0, 0.7, 0.4) * pow(sun, 60.0) * 0.45;
            // the disc: round and clean-edged (bright enough to glow, not to
            // bloom into a blob)
            col = mix(col, vec3(1.0, 0.94, 0.8) * 3.4, ncDisc(d, uSunDir, 0.03));
            if (h < 0.0) col = mix(col, vec3(0.62, 0.33, 0.17), smoothstep(0.0, -0.08, h));
            if (uNight > 0.001) col = mix(col, ncNight(d, h, sun), uNight);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    [shared]
  );
  useFrame(() => {
    material.uniforms.uStars.value = T.stars;
  });

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[2500, 48, 24]} />
    </mesh>
  );
}
