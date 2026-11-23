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
// The Milky Way's band (night: ncMilkyWay below), placed for each world's
// camera as in the night art: in the hero's view it rises from low on the
// left to high in the middle; over the canyon beyond the cut (the camera
// level, looking towards the moon) it runs low across the sky, rising to the
// right. Each: its pole (the band is the great circle square to it) and its
// bright centre. (Sky's uMwN / uMwC: HeroDressing blends them with J.valleyK.)
export const dirAt = (azDeg, elDeg) => {
  const a = THREE.MathUtils.degToRad(azDeg);
  const e = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
};
const band = (a, b, centre) => ({ pole: new THREE.Vector3().crossVectors(a, b).normalize(), centre });
export const MW_HERO = band(dirAt(-38, 2), dirAt(4, 33), dirAt(-6, 26));
export const MW_VALLEY = band(dirAt(14, 8), dirAt(56, 24), dirAt(36, 17));
const MW_POLE = MW_HERO.pole.clone();
const MW_CENTRE = MW_HERO.centre.clone();

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
          uSunsetClouds: { value: 0.6 },
          uWhite: shared.uWhite,
          uWhiteLevel: shared.uWhiteLevel,
          uStars: { value: 1 },
          uHeroSky: shared.uHeroSky ?? { value: 0 },
          uSunGlow: shared.uSunGlow ?? { value: 0 },
          // the Milky Way: its pole (the band runs round the great circle
          // square to it), the galactic centre, how bright
          uMwN: shared.uMwN ?? { value: MW_POLE },
          uMwC: shared.uMwC ?? { value: MW_CENTRE },
          uMilky: { value: 1 },
          uMoonDir: shared.uMoonDir ?? { value: SUN_DIR.clone() },
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
          uniform float uSunsetClouds;
          uniform float uStars;
          uniform float uWhite;
          uniform float uWhiteLevel;
          uniform float uHeroSky;
          uniform float uSunGlow;
          uniform vec3 uMwN;
          uniform vec3 uMwC;
          uniform float uMilky;
          uniform vec3 uMoonDir;
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
          // value noise and fbm on the sphere of directions (no seams)
          float ncVn3(vec3 x) {
            vec3 i = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(ncHash3(i), ncHash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(ncHash3(i + vec3(0.0, 1.0, 0.0)), ncHash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                       mix(mix(ncHash3(i + vec3(0.0, 0.0, 1.0)), ncHash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(ncHash3(i + vec3(0.0, 1.0, 1.0)), ncHash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
          }
          float ncFbm3(vec3 p) {
            float s = 0.0;
            float a = 0.5;
            for (int i = 0; i < 5; i++) {
              s += a * ncVn3(p);
              p = p * 2.03 + vec3(1.7, 9.2, 3.1);
              a *= 0.5;
            }
            return s;
          }
          // The Milky Way: a band of light along a great circle of the sky
          // (uMwN its pole), wandering a little, brightest towards the
          // galactic centre (uMwC): star clouds and fine grain through it,
          // dark dust lanes down its middle, a wide faint glow round it, blue
          // and indigo with violet in its clouds. Drifting very slowly.
          // Returns its light (rgb) and its density (a: for the stars).
          vec4 ncMilkyWay(vec3 d) {
            vec3 dd = d + vec3(uTime * 0.0006, 0.0, uTime * 0.0004);
            float b = dot(d, uMwN) + (ncFbm3(dd * 3.2) - 0.5) * 0.05;
            float core = exp(-pow(b / 0.038, 2.0));
            float body = exp(-pow(b / 0.07, 2.0));
            float wide = exp(-pow(b / 0.13, 2.0));
            float spine = exp(-pow((b + 0.003) / 0.016, 2.0));
            float bulge = pow(max(dot(d, uMwC), 0.0), 6.0);
            // grainy star clouds
            float c1 = ncFbm3(dd * 14.0 + 1.0);
            float c2 = ncFbm3(dd * 40.0 + 3.0);
            float c3 = ncFbm3(dd * 120.0 + 7.0);
            float cloud = smoothstep(0.28, 0.78, c2) * (0.45 + 0.55 * smoothstep(0.3, 0.78, c3));
            // dark rust-brown dust: threadlike rifts through it and a main
            // rift down its length
            float rift = 1.0 - smoothstep(0.0, 0.05, abs(ncFbm3(dd * 17.0 + 4.0) - 0.5));
            float mainLane = exp(-pow((b - 0.004) / 0.013, 2.0)) * smoothstep(0.3, 0.58, ncFbm3(dd * 9.0 + 9.0));
            float dust = clamp(rift * 0.7 * body + mainLane * 0.9, 0.0, 0.92);
            // (the night mode's palette, the photograph's structure: dark
            // indigo at its edges (#101D35), a moonlit-blue body (#829BC7),
            // cool silver along its core (#AFC8EA), a faint violet in its
            // clouds; the dust lanes near-black navy)
            vec3 edge = vec3(0.07, 0.09, 0.24);
            vec3 rust = vec3(0.26, 0.34, 0.6);
            vec3 bright = vec3(0.62, 0.74, 0.92);
            float warm = clamp(body * 1.1 + bulge * 0.6, 0.0, 1.0);
            vec3 tone = mix(edge, rust, warm);
            tone = mix(tone, bright, clamp(spine * cloud * 0.9 + bulge * core * 0.35, 0.0, 0.85));
            vec3 col = tone * body * cloud * (1.0 - dust) * (0.75 + 1.8 * bulge);
            col += vec3(0.2, 0.15, 0.36) * core * smoothstep(0.4, 0.8, c1) * (1.0 - dust) * (0.4 + bulge);
            col += vec3(0.025, 0.04, 0.1) * wide * (0.6 + bulge) * (1.0 - dust * 0.4);
            return vec4(col * 0.8 * uMilky, body * (1.0 - 0.6 * dust));
          }
          // one layer of stars: a candidate per cell of a direction grid
          vec3 ncStarLayer(vec3 d, float cells, float chance, float size) {
            vec3 g = d * cells;
            vec3 cell = floor(g);
            float r = ncHash3(cell);
            vec3 o = vec3(ncHash3(cell + 1.7), ncHash3(cell + 3.1), ncHash3(cell + 5.3)) - 0.5;
            float dist = length(fract(g) - 0.5 - o * 0.6);
            float star = step(1.0 - chance, r) * (1.0 - smoothstep(0.0, size, dist));
            float tw = 0.85 + 0.15 * sin(uTime * (1.0 + 2.0 * ncHash3(cell + 7.7)) + r * 40.0);
            float bright = mix(0.4, 2.4, pow(ncHash3(cell + 9.0), 3.0));
            float tk = ncHash3(cell + 11.0);
            vec3 tint = tk < 0.9 ? mix(vec3(0.68, 0.78, 1.0), vec3(0.9, 0.94, 1.0), tk / 0.9) : vec3(1.0, 0.9, 0.78);
            return tint * star * bright * tw;
          }
          vec3 ncNight(vec3 d, float h, float sun) {
            // deep navy overhead, indigo lower down, a cool glow at the horizon
            // (the night art: near-black navy overhead, deep navy lower, a
            // pale blue glow only low on the horizon, strongest by the moon)
            vec3 zenith = vec3(0.0018, 0.0035, 0.012);
            vec3 upper = vec3(0.005, 0.01, 0.028);
            vec3 horizon = vec3(0.022, 0.034, 0.075);
            vec3 col = mix(horizon, upper, smoothstep(-0.01, 0.2, h));
            col = mix(col, zenith, smoothstep(0.2, 0.75, h));
            float mSun = max(dot(d, uMoonDir), 0.0);
            col += vec3(0.03, 0.055, 0.13) * exp(-max(h, 0.0) * 16.0) * (0.35 + 0.65 * pow(mSun, 6.0));
            // the moon: a modest cool halo round a crisp bright disc
            col += vec3(0.2, 0.3, 0.55) * pow(mSun, 160.0) * 0.3;
            col += vec3(0.55, 0.65, 0.9) * pow(mSun, 1200.0) * 0.45;
            // the Milky Way, and its stars (far denser along the band)
            float skyUp = smoothstep(-0.02, 0.12, h) * (1.0 - pow(mSun, 30.0));
            vec4 mw = ncMilkyWay(d);
            col += mw.rgb * skyUp;
            // (as dense as the photograph: fine white stars everywhere, a few
            // brighter, packed far denser along the band)
            vec3 stars = ncStarLayer(d, 160.0, 0.07 + 0.1 * mw.a, 0.12) * 1.1;
            stars += ncStarLayer(d, 420.0, 0.12 + 0.45 * mw.a, 0.17) * 0.7;
            stars += ncStarLayer(d, 950.0, 0.16 + 0.6 * mw.a, 0.22) * 0.45;
            stars += ncStarLayer(d, 2000.0, 0.12 + 0.7 * mw.a, 0.28) * 0.32;
            col += stars * uStars * skyUp * smoothstep(0.03, 0.25, h + 0.1);
            // (bright enough to glow a little, not to bloom into a blob)
            col = mix(col, vec3(0.94, 0.96, 1.0) * 2.1, ncDisc(d, uMoonDir, 0.026));
            if (h < 0.0) col = mix(col, vec3(0.015, 0.02, 0.04), smoothstep(0.0, -0.08, h));
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
            // The hero's sunset (scene/hero): dusty mauve-grey overhead,
            // warming through rose to peach and amber at the horizon, all of
            // it warmer towards the sun; the sun a bright disc in a wide warm
            // corona, its glare spread low along the horizon.
            if (uHeroSky > 0.001) {
              vec3 wZen = vec3(0.105, 0.088, 0.112);
              vec3 wUp = vec3(0.27, 0.19, 0.2);
              vec3 wHor = vec3(0.86, 0.42, 0.19);
              vec3 w = mix(wHor, wUp, smoothstep(-0.01, 0.24, h));
              w = mix(w, wZen, smoothstep(0.22, 0.8, h));
              // (the whole sun side of the sky warmer, the horizon there amber)
              w += vec3(0.5, 0.2, 0.05) * pow(sun, 3.0) * (1.0 - smoothstep(0.0, 0.5, h)) * 0.5;
              w += vec3(1.0, 0.4, 0.1) * pow(sun, 6.0) * band * 0.35;
              // the sun itself, set a touch higher than the light it casts
              // (so its disc clears the far ridge, sitting on the horizon), in
              // a warm corona with its glare spread low along the horizon
              vec3 sDir = normalize(uSunDir + vec3(0.0, 0.035, 0.0));
              float s2 = max(dot(d, sDir), 0.0);
              // (saturated orange round it, never a white wash: the disc
              // itself is the only pale thing, and only just bright enough
              // for the bloom to give it a soft halo)
              w += vec3(1.0, 0.4, 0.1) * pow(s2, 22.0) * 0.5 * uSunGlow;
              w += vec3(1.0, 0.56, 0.22) * pow(s2, 500.0) * 0.55 * uSunGlow;
              float glare = exp(-abs(h - sDir.y) * 30.0) * pow(s2, 5.0);
              w += vec3(1.0, 0.42, 0.12) * glare * 0.45 * uSunGlow;
              w = mix(w, vec3(1.0, 0.92, 0.72) * 2.3, ncDisc(d, sDir, 0.03));
              // fair-weather clouds drifting slowly over, as the oasis's
              // (the same clouds on the same high plane: smaller and thinner
              // towards the horizon), lit by the low sun — dusty mauve on
              // their shaded side, peach and rose where it catches them,
              // glowing amber round the sun, their edges against it bright
              if (h > 0.0 && uSunsetClouds > 0.001) {
                vec2 cp = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
                float n = ncCloudFbm(cp);
                float cover = smoothstep(0.5, 0.78, n + 0.08 * ncN2(cp * 0.3)) * uSunsetClouds;
                cover *= smoothstep(0.02, 0.16, h);
                float shade = smoothstep(0.45, 0.95, ncCloudFbm(cp * 1.3 + 4.0));
                // (thin at their edges, where the sun shines through them)
                float thin = 1.0 - smoothstep(0.5, 0.72, n);
                vec3 cDark = vec3(0.24, 0.16, 0.18);
                vec3 cLit = vec3(0.95, 0.58, 0.4);
                vec3 cloud = mix(cDark, cLit, shade * (0.45 + 0.55 * smoothstep(0.0, 0.35, 1.0 - h)));
                cloud += vec3(1.0, 0.46, 0.14) * pow(sun, 4.0) * (0.5 + 0.9 * thin) * uSunGlow;
                cloud += vec3(1.0, 0.75, 0.45) * pow(sun, 24.0) * thin * 0.8 * uSunGlow;
                w = mix(w, cloud, cover * (1.0 - ncDisc(d, sDir, 0.035) * 0.6));
              }
              if (h < 0.0) w = mix(w, vec3(0.7, 0.36, 0.17), smoothstep(0.0, -0.08, h));
              col = mix(col, w, uHeroSky);
            }
            // the oasis come to life: the dusk gives way to a light blue sky
            if (uLush > 0.001) {
              // (a vivid, clear blue: pale at the horizon, deep overhead)
              vec3 day = mix(vec3(0.66, 0.80, 0.96), vec3(0.20, 0.46, 0.92), smoothstep(0.0, 0.55, h));
              day = mix(day, vec3(0.10, 0.30, 0.82), smoothstep(0.45, 0.95, h));
              day += vec3(1.0, 0.92, 0.75) * pow(sun, 8.0) * 0.3;
              if (h < 0.0) day = mix(day, vec3(0.55, 0.6, 0.6), smoothstep(0.0, -0.08, h));
              col = mix(col, mix(day, vec3(1.0, 0.96, 0.86) * 3.4, ncDisc(d, uSunDir, 0.03)), uLush);
            }
            // the tree growing: a deeper, clearer blue overhead, and soft
            // fair-weather clouds drifting slowly over (on a plane high up:
            // smaller and thinner towards the horizon), lit warm on the sun's side
            if (uGrowSky > 0.001) {
              vec3 blue = mix(vec3(0.60, 0.78, 0.98), vec3(0.14, 0.40, 0.92), smoothstep(0.0, 0.5, h));
              blue = mix(blue, vec3(0.06, 0.24, 0.78), smoothstep(0.4, 0.95, h));
              blue += vec3(1.0, 0.92, 0.75) * pow(sun, 8.0) * 0.3;
              if (h < 0.0) blue = mix(blue, vec3(0.55, 0.6, 0.62), smoothstep(0.0, -0.08, h));
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
    material.uniforms.uMilky.value = T.milkyWay;
    material.uniforms.uClouds.value = T.growClouds;
    material.uniforms.uSunsetClouds.value = T.sunsetClouds;
  });

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[2500, 48, 24]} />
    </mesh>
  );
}
