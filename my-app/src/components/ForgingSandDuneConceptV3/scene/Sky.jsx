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
// In the whiteout it goes to white with the land (uWhite).
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
          uLush: shared.uLush ?? { value: 0 },
          uGrowSky: shared.uGrowSky ?? { value: 0 },
          uTime: shared.uTime ?? { value: 0 },
          uClouds: { value: 0.6 },
          uHeroClouds: { value: 1 },
          uWhite: shared.uWhite,
          uWhiteLevel: shared.uWhiteLevel,
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
          uniform float uLush;
          uniform float uGrowSky;
          uniform float uTime;
          uniform float uClouds;
          uniform float uHeroClouds;
          uniform float uStars;
          uniform float uWhite;
          uniform float uWhiteLevel;
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
          float ncN2(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = ncHash3(vec3(i, 0.0));
            float b = ncHash3(vec3(i + vec2(1.0, 0.0), 0.0));
            float c = ncHash3(vec3(i + vec2(0.0, 1.0), 0.0));
            float e = ncHash3(vec3(i + vec2(1.0, 1.0), 0.0));
            return mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
          }
          float ncCloudFbm(vec2 p) {
            float s = 0.0;
            float a = 0.5;
            for (int i = 0; i < 5; i++) {
              s += a * ncN2(p);
              p = p * 2.07 + vec2(3.1, 1.7);
              a *= 0.5;
            }
            return s;
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
            if (h < 0.0) col = mix(col, vec3(0.03, 0.03, 0.05), (1.0 - smoothstep(-0.08, 0.0, h)));
            return col;
          }
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            float sun = max(dot(d, uSunDir), 0.0);
            // (dusk, after the reference: a deep slate blue overhead, through
            // a soft lavender grey, into warm peach and amber at the horizon —
            // warmest round the sun)
            vec3 zenith = vec3(0.05, 0.075, 0.16);
            vec3 upper = vec3(0.2, 0.21, 0.3);
            vec3 peach = vec3(0.82, 0.5, 0.33);
            vec3 horizon = vec3(0.95, 0.50, 0.24);
            vec3 col = mix(horizon, peach, smoothstep(0.0, 0.07, h));
            col = mix(col, upper, smoothstep(0.05, 0.28, h));
            col = mix(col, zenith, smoothstep(0.25, 0.8, h));
            // warm band strongest on the sun side of the horizon
            float band = 1.0 - smoothstep(0.0, 0.32, abs(h));
            col += vec3(1.0, 0.42, 0.12) * pow(sun, 5.0) * band * 0.9;
            col += vec3(1.0, 0.7, 0.4) * pow(sun, 60.0) * 0.45;
            // the disc: round and clean-edged (bright enough to glow, not to
            // bloom into a blob)
            col = mix(col, vec3(1.0, 0.94, 0.8) * 3.4, ncDisc(d, uSunDir, 0.03));
            // clouds, after the reference: long, soft banks lying level across
            // the sky (in layers, thinning and lifting into feathered wisps
            // higher up), lit gold and rose underneath on the sun's side, cool
            // slate on the other
            if (h > 0.0 && uHeroClouds > 0.001) {
              float el = h;
              // (on a flat layer high overhead, seen in perspective: banks run
              // straight, crowding together towards the horizon — not bent
              // round the view)
              vec2 cp = d.xz / (h + 0.035);
              // (only a little longer than they are deep: loose, drifting forms)
              vec2 q = vec2(cp.x * 0.42 + uTime * 0.004, cp.y * 0.95);
              // (warped twice, strongly: the forms swirl, curl and break up
              // into tatters rather than running in straight bars)
              vec2 w1 = vec2(ncCloudFbm(q * 0.6 + 5.0), ncCloudFbm(q * 0.6 + 9.0)) - 0.5;
              q += w1 * vec2(1.4, 0.7);
              vec2 w2 = vec2(ncCloudFbm(q * 1.3 + 2.0), ncCloudFbm(q * 1.3 + 17.0)) - 0.5;
              q += w2 * 0.45;
              float bank = ncCloudFbm(q * vec2(0.9, 1.2));
              // (fuller puffs here and there)
              bank = max(bank, ncCloudFbm(q * 0.7 + 31.0) * 1.08 - 0.06);
              float wisp = ncCloudFbm(q * vec2(2.6, 3.4) + 13.0);
              // low: broad soft banks; higher: thin feathered wisps
              float low = smoothstep(0.5, 0.75, bank + 0.12 * wisp) * (1.0 - smoothstep(0.12, 0.3, el));
              float high = smoothstep(0.58, 0.85, bank * 0.6 + wisp * 0.55) * smoothstep(0.1, 0.22, el) * (1.0 - smoothstep(0.55, 0.85, el));
              float cover = max(low, high * 0.75) * smoothstep(0.015, 0.06, el) * uHeroClouds;
              float toSun = pow(sun, 2.5);
              // (lit from below by the low sun: gold-rose on their undersides)
              float under = smoothstep(0.35, 0.75, 1.0 - wisp);
              vec3 lit = mix(vec3(0.85, 0.5, 0.42), vec3(1.2, 0.74, 0.46), toSun) * mix(0.7, 1.15, under);
              vec3 shade = mix(vec3(0.2, 0.21, 0.3), vec3(0.42, 0.32, 0.34), (1.0 - smoothstep(0.05, 0.4, el)));
              vec3 cloud = mix(shade, lit, clamp(toSun * 1.4 + (1.0 - smoothstep(0.0, 0.25, el)) * 0.55, 0.0, 1.0));
              col = mix(col, cloud, cover * 0.8 * (1.0 - ncDisc(d, uSunDir, 0.04)));
            }
            if (h < 0.0) col = mix(col, vec3(0.62, 0.33, 0.17), (1.0 - smoothstep(-0.08, 0.0, h)));
            // the oasis come to life: the dusk gives way to a light blue sky
            if (uLush > 0.001) {
              // (a vivid, clear blue: pale at the horizon, deep overhead)
              vec3 day = mix(vec3(0.66, 0.80, 0.96), vec3(0.20, 0.46, 0.92), smoothstep(0.0, 0.55, h));
              day = mix(day, vec3(0.10, 0.30, 0.82), smoothstep(0.45, 0.95, h));
              day += vec3(1.0, 0.92, 0.75) * pow(sun, 8.0) * 0.3;
              if (h < 0.0) day = mix(day, vec3(0.55, 0.6, 0.6), (1.0 - smoothstep(-0.08, 0.0, h)));
              col = mix(col, mix(day, vec3(1.0, 0.96, 0.86) * 3.4, ncDisc(d, uSunDir, 0.03)), uLush);
            }
            // the tree growing: a deeper, clearer blue overhead, and soft
            // fair-weather clouds drifting slowly over (on a plane high up:
            // smaller and thinner towards the horizon), lit warm on the sun's side
            if (uGrowSky > 0.001) {
              vec3 blue = mix(vec3(0.60, 0.78, 0.98), vec3(0.14, 0.40, 0.92), smoothstep(0.0, 0.5, h));
              blue = mix(blue, vec3(0.06, 0.24, 0.78), smoothstep(0.4, 0.95, h));
              blue += vec3(1.0, 0.92, 0.75) * pow(sun, 8.0) * 0.3;
              if (h < 0.0) blue = mix(blue, vec3(0.55, 0.6, 0.62), (1.0 - smoothstep(-0.08, 0.0, h)));
              vec3 sky = mix(blue, vec3(1.0, 0.96, 0.86) * 3.4, ncDisc(d, uSunDir, 0.03));
              if (h > 0.0) {
                vec2 cp = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
                float n = ncCloudFbm(cp);
                float cover = smoothstep(0.5, 0.78, n + 0.08 * ncN2(cp * 0.3)) * uClouds;
                cover *= smoothstep(0.02, 0.16, h);
                float shade = smoothstep(0.45, 0.95, ncCloudFbm(cp * 1.3 + 4.0));
                vec3 cloud = mix(vec3(0.78, 0.82, 0.9), vec3(1.08, 1.05, 1.0), shade) + vec3(0.35, 0.22, 0.1) * pow(sun, 6.0);
                sky = mix(sky, cloud, cover * (1.0 - ncDisc(d, uSunDir, 0.035) * 0.6));
              }
              col = mix(col, sky, uGrowSky);
            }
            if (uNight > 0.001) col = mix(col, ncNight(d, h, sun), uNight);
            col = mix(col, vec3(mix(0.9, uWhiteLevel, uWhite * uWhite * uWhite)), uWhite);
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
    material.uniforms.uClouds.value = T.growClouds;
    material.uniforms.uHeroClouds.value = T.heroClouds;
  });

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[2500, 48, 24]} />
    </mesh>
  );
}
