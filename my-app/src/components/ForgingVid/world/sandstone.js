import * as THREE from "three";
import { NOISE, BUMP, VORONOI } from "./glsl";
import { SUN_DIR } from "../config";
import { HERO_LIGHT } from "./materials";

// Weathered sandstone for the hero's ruins and floating fragments
// (scene/hero): no textures, all from the surface's own coordinates (its
// object space, so a fragment's pattern turns with it and never swims):
//   strata  – soft horizontal bands of tone, wandering a little
//   grain   – fine mottling and a little bump
//   cracks  – an angular fracture network (triplanar Voronoi), dark grooves;
//             in the pieces that carry energy (aGlow) a few of them glow,
//             shimmering slowly
//   core    – the slab's core lights the edges that face it (uCore)
//   rim     – backlit by the low sun, the silhouette's edges catch warm light
// Per vertex (or per instance): aGlow, how much energy the piece carries;
// aSeed, an offset so pieces of one shape don't repeat their pattern.
const SUN = `vec3(${SUN_DIR.x.toFixed(4)}, ${SUN_DIR.y.toFixed(4)}, ${SUN_DIR.z.toFixed(4)})`;

export function createSandstoneUniforms(shared) {
  return {
    uTime: shared.uTime,
    uCrackColor: shared.uCrackColor,
    uRuinGlow: { value: 1 },
    uCore: { value: new THREE.Vector3(0, 30, 2) },
    uCoreLight: { value: 0 },
    uRim: { value: 1 },
    // (the arches building themselves, scene/valley/Arches.jsx: how far, and
    // how far below its place each block starts)
    uForm: { value: 1 },
    uFormDrop: { value: 9 },
    // (the haze over the sand, so they sit in the same air: world/materials.js)
    uHaze: shared.uHaze,
    // (the hero's warm light, as on the sand: world/materials.js)
    uRimColor: shared.uRimColor,
    uFill: shared.uFill,
    uFillDir: shared.uFillDir,
    uHemiSky: shared.uHemiSky,
    uHemiGround: shared.uHemiGround,
  };
}

// (`form`: the geometry carries aBlock / aPivot, and its blocks rise out of
// the sand into place with uForm — scene/valley/Arches.jsx)
export function createSandstoneMaterial(uniforms, { instanced = false, form = false } = {}) {
  const material = new THREE.MeshStandardMaterial({ color: "#6a4630", roughness: 0.93, metalness: 0, envMapIntensity: 0.35 });
  if (form) material.defines = { SS_FORM: "" };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aGlow;
        attribute float aSeed;
        #ifdef SS_FORM
          attribute float aBlock;
          attribute vec3 aPivot;
          uniform float uForm;
          uniform float uFormDrop;
        #endif
        varying vec3 vSsObj;
        varying vec3 vSsObjN;
        varying vec3 vSsWorld;
        varying float vSsGlow;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vSsObj = position + aSeed * 37.0;
        vSsObjN = objectNormal;
        vSsGlow = aGlow;
        #ifdef SS_FORM
        {
          // each block in its turn (aBlock: feet first, the keystone last)
          // rises out of the sand, turning upright and growing to its size
          float e = clamp((uForm - aBlock * 0.6) / 0.4, 0.0, 1.0);
          e = e * e * (3.0 - 2.0 * e);
          vec3 off = transformed - aPivot;
          float ang = (1.0 - e) * 1.4 * (fract(aBlock * 37.13) - 0.5);
          float c = cos(ang);
          float s = sin(ang);
          off = vec3(off.x * c - off.y * s, off.x * s + off.y * c, off.z);
          transformed = aPivot + off * mix(0.55, 1.0, e) - vec3(0.0, (1.0 - e) * uFormDrop, 0.0);
        }
        #endif`
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        {
          vec4 ssW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            ssW = instanceMatrix * ssW;
          #endif
          vSsWorld = (modelMatrix * ssW).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTime;
        uniform vec3 uCrackColor;
        uniform float uRuinGlow;
        uniform vec3 uCore;
        uniform float uCoreLight;
        uniform float uRim;
        uniform vec2 uHaze;
        uniform vec3 uRimColor;
        uniform vec3 uFill;
        uniform vec3 uFillDir;
        uniform vec3 uHemiSky;
        uniform vec3 uHemiGround;
        varying vec3 vSsObj;
        varying vec3 vSsObjN;
        varying vec3 vSsWorld;
        varying float vSsGlow;
        ${NOISE}
        ${VORONOI}
        ${BUMP}
        // distance to the nearest fracture line (cell units), triplanar:
        // the network projected along each axis, weighted by the surface's
        // facing, its lines warped so they wander like real cracks
        float ssFracture(vec3 p, vec3 n) {
          vec3 w = pow(abs(n), vec3(4.0));
          w /= w.x + w.y + w.z + 1e-4;
          vec3 q = p * 0.3 + (vec3(ncNoise(p * 0.2), ncNoise(p * 0.2 + 5.0), ncNoise(p * 0.2 + 9.0)) - 0.5) * 1.2;
          return ncVoronoi(q.zy).x * w.x + ncVoronoi(q.xz + 3.1).x * w.y + ncVoronoi(q.xy + 7.7).x * w.z;
        }`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float ssE = ssFracture(vSsObj, normalize(vSsObjN));
        float ssAa = fwidth(ssE);
        // (fading where the lines get finer than a pixel: no shimmering far off)
        float ssCr = (1.0 - smoothstep(0.0, 0.05 + ssAa, ssE)) * clamp(0.1 / (0.05 + ssAa), 0.0, 1.0);
        float ssBand = ncNoise(vec3(0.0, vSsObj.y * 0.85 + ncNoise(vSsObj * 0.12) * 3.0, 0.0));
        float ssGrain = ncFbm(vSsObj * 1.6);
        diffuseColor.rgb *= mix(0.78, 1.16, ssBand) * mix(0.84, 1.1, ssGrain);
        diffuseColor.rgb *= 1.0 - ssCr * 0.6;`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = ncBump(-vViewPosition, normal, ssBand * 0.08 + ssGrain * 0.05 - ssCr * 0.12, faceDirection);`
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        ${HERO_LIGHT}`
      )
      .replace(
        "#include <fog_fragment>",
        /* glsl */ `#include <fog_fragment>
        // the same low haze as over the sand (world/materials.js): thicker
        // low down and with distance, warm towards the sun
        #ifdef USE_FOG
        if (uHaze.x > 0.001) {
          float hzD = length(vViewPosition);
          float hzAmt = (1.0 - exp(-hzD * 0.0024)) * exp(-max(vSsWorld.y + 2.0, 0.0) / 9.0) * 0.85 * uHaze.x;
          float hzSun = pow(max(dot(normalize(vSsWorld - cameraPosition), ${SUN}), 0.0), 8.0) * uHaze.y;
          vec3 hzCol = mix(fogColor, vec3(1.0, 0.46, 0.18), hzSun * 0.5);
          hzCol = mix(hzCol, vec3(0.075, 0.1, 0.17), 1.0 - uHaze.y);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hzCol, clamp(hzAmt, 0.0, 0.88));
        }
        #endif`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        {
          vec3 ssV = normalize(vViewPosition);
          float ssNv = clamp(dot(normal, ssV), 0.0, 1.0);
          // energy in a few of the cracks (a slow mask picks which), a thin
          // hot line that shimmers
          if (vSsGlow > 0.001 && uRuinGlow > 0.001) {
            float ssSel = smoothstep(0.52, 0.72, ncNoise(vSsObj * 0.08 + 3.0));
            float ssLine = (1.0 - smoothstep(0.0, 0.025 + ssAa, ssE)) * clamp(0.05 / (0.025 + ssAa), 0.0, 1.0);
            float ssShim = 0.7 + 0.3 * sin(uTime * 1.1 + ncNoise(vSsObj * 0.25) * 6.283);
            totalEmissiveRadiance += uCrackColor * ssLine * ssSel * vSsGlow * uRuinGlow * ssShim * 2.4;
          }
          // the core's light on the edges that face it
          if (uCoreLight > 0.001) {
            vec3 ssTo = uCore - vSsWorld;
            float ssD = length(ssTo);
            vec3 ssL = normalize((viewMatrix * vec4(ssTo / max(ssD, 1e-3), 0.0)).xyz);
            float ssFace = max(dot(normal, ssL), 0.0);
            // (mostly at the edges, turned side-on to us: a rim of its light)
            totalEmissiveRadiance += uCrackColor * ssFace * (0.06 + pow(1.0 - ssNv, 3.0)) * uCoreLight * 160.0 / (ssD * ssD + 500.0);
          }
          // backlit by the low sun: warm light round the silhouette
          float ssBack = pow(max(dot(normalize(vSsWorld - cameraPosition), ${SUN}), 0.0), 3.0);
          totalEmissiveRadiance += uRimColor * pow(1.0 - ssNv, 4.0) * ssBack * uRim * 0.5;
        }`
      );
  };
  material.customProgramCacheKey = () => (instanced ? "hero-sandstone-i" : "hero-sandstone") + (form ? "-form" : "");
  return material;
}
