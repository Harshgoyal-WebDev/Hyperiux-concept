import * as THREE from "three";
import { NOISE, DISSOLVE, BUMP, VORONOI } from "./glsl";
import { dissolveUniforms } from "./dissolve";
import { PALETTE, WIND_DIR } from "../config";

// Uniforms every world material shares; UniformSync in Scene.jsx writes
// these once per frame from the master timeline state.
export function createSharedUniforms() {
  return {
    uTime: { value: 0 },
    uDissolve: { value: 0 },
    uWhite: { value: 0 },
    uWhiteLevel: { value: 6 },
    uNight: { value: 0 }, // 0 sunset → 1 moonlit night (eased in UniformSync)
    uCubePos: { value: new THREE.Vector3() },
    uCubeGlow: { value: 1 },
    uEnergy: { value: 0 },
    uFlatten: { value: 0 },
    uContours: { value: 0 },
    uWind: { value: new THREE.Vector2(WIND_DIR.x, WIND_DIR.y) },
    // Live tuning (tuning.js → UniformSync)
    uCrackScale: { value: 1 },
    uCrackDepth: { value: 1 },
    uFissureGlow: { value: 1 },
    uRipple: { value: 1 },
    uContourStrength: { value: 0.82 },
    uContourSpacing: { value: 1.8 },
    uLineWidth: { value: 0.5 },
    uStirActive: { value: 0 }, // any line in the sand at all (skips the loop when not)
    uLineDepth: { value: 1 },
    uCrackColor: { value: new THREE.Color("#ff8e2c") },
    uCrackSpread: { value: 0 }, // 0..1 how far the glow has crept through the monolith's cracks
    // Recent pointer hits on the dunes: (x, z, age seconds, strength).
    uStir: { value: Array.from({ length: STIR_SLOTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  };
}

export const STIR_SLOTS = 24;

const WORLD_VARYINGS = /* glsl */ `
varying vec3 vNcWorld;
varying vec3 vNcNormal;
`;

const WORLD_POS_VERTEX = /* glsl */ `
{
  vec4 ncW = vec4(transformed, 1.0);
  vec3 ncNrm = objectNormal;
  #ifdef USE_INSTANCING
    ncW = instanceMatrix * ncW;
    ncNrm = mat3(instanceMatrix) * ncNrm;
  #endif
  ncW = modelMatrix * ncW;
  vNcWorld = ncW.xyz;
  vNcNormal = normalize(mat3(modelMatrix) * ncNrm);
}
`;

const SHARED_DECLS = /* glsl */ `
uniform float uTime;
uniform float uWhite;
uniform float uWhiteLevel;
uniform vec3 uCubePos;
uniform float uCubeGlow;
uniform float uEnergy;
uniform float uFlatten;
uniform float uContours;
uniform vec2 uWind;
uniform vec4 uStir[${STIR_SLOTS}];
uniform float uCrackScale;
uniform float uCrackDepth;
uniform float uFissureGlow;
uniform vec3 uCrackColor;
uniform float uRipple;
uniform float uContourStrength;
uniform float uContourSpacing;
uniform float uLineWidth;
uniform float uStirActive;
uniform float uLineDepth;
uniform float uCrackSpread;
`;

function injectWorldVertex(shader, extraBegin = "") {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${SHARED_DECLS}\n${WORLD_VARYINGS}`)
    .replace("#include <begin_vertex>", `#include <begin_vertex>\n${extraBegin}`)
    .replace("#include <project_vertex>", `#include <project_vertex>\n${WORLD_POS_VERTEX}`);
}

// Depth material that honours the same dissolve, so stone that has turned
// to sand stops casting shadows at the same moment.
function createDissolveDepthMaterial(shared, local, extraBegin = "") {
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, local);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${SHARED_DECLS}\nvarying vec3 vNcWorld;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${extraBegin}`)
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        {
          vec4 ncW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            ncW = instanceMatrix * ncW;
          #endif
          vNcWorld = (modelMatrix * ncW).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vNcWorld;\n${DISSOLVE}`)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>\nif (ncThreshold(vNcWorld) < uDissolve) discard;`
      );
  };
  depth.customProgramCacheKey = () => "nc-depth-" + extraBegin.length;
  return depth;
}

// ---------------------------------------------------------------------------
// Basalt
// ---------------------------------------------------------------------------
// `procedural` = the fracture network is generated here (placeholder stone,
// rocks). A delivered GLB sets it to false: its authored maps carry the
// surface and only the dissolve / energy response is added.
export function createStoneMaterial(shared, dissolveCfg, { procedural = true, fissure = 0, color = PALETTE.basalt } = {}) {
  const local = {
    ...dissolveUniforms(dissolveCfg),
    uProcedural: { value: procedural ? 1 : 0 },
    uFissure: { value: fissure },
  };

  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, local);
    injectWorldVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        ${SHARED_DECLS}
        ${WORLD_VARYINGS}
        uniform float uProcedural;
        uniform float uFissure;
        ${NOISE}
        ${VORONOI}
        ${DISSOLVE}
        ${BUMP}`
      )
      .replace(
        "#include <clipping_planes_fragment>",
        /* glsl */ `#include <clipping_planes_fragment>
        float ncT = ncThreshold(vNcWorld);
        if (ncT < uDissolve) discard;
        // Charred, flaking edge right at the dissolve front (no glow: it
        // turns to ash, it doesn't burn).
        float ncAsh = (1.0 - smoothstep(0.0, 0.03, ncT - uDissolve)) * step(0.0005, uDissolve);

        vec3 ncN = normalize(vNcNormal);
        vec3 ncA = abs(ncN);
        vec2 ncUV = ncA.z > max(ncA.x, ncA.y) ? vNcWorld.xy : (ncA.x > ncA.y ? vNcWorld.zy : vNcWorld.xz);
        // Procedural surface only where there's no authored texture (a
        // delivered GLB skips all of this per pixel).
        float ncTone = 1.0;
        float ncFine = 0.5;
        float ncCrackFine = 0.0;
        float ncCrackMajor = 0.0;
        float ncFissureSel = 0.0;
        if (uProcedural > 0.5) {
          ncTone = mix(0.86, 1.1, ncFbm(vNcWorld * 0.07));
          ncFine = ncFbm(vNcWorld * 1.9 + 4.0);
          // Angular fracture network: fine polygonal cells + a few major cracks.
          vec2 ncV1 = ncVoronoi(ncUV * 0.45 * uCrackScale);
          vec2 ncV2 = ncVoronoi(ncUV * 0.12 * uCrackScale + 7.0);
          ncCrackFine = 1.0 - smoothstep(0.0, 0.045, ncV1.x);
          ncCrackMajor = 1.0 - smoothstep(0.0, 0.03, ncV2.x);
          ncFissureSel = step(0.7, ncV2.y);
        }`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        diffuseColor.rgb *= mix(1.0, ncTone * mix(0.86, 1.08, ncFine), uProcedural);
        diffuseColor.rgb *= 1.0 - (ncCrackFine * 0.45 + ncCrackMajor * 0.55) * min(uCrackDepth, 1.5);
        diffuseColor.rgb *= 1.0 - ncAsh * 0.75;
        diffuseColor.rgb *= 1.0 - uWhite * 0.55; // keep a dark silhouette against the white`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor - ncFine * 0.25 * uProcedural + ncCrackFine * 0.1, 0.35, 1.0);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float ncH = (ncFine * 0.05 - (ncCrackFine * 0.035 + ncCrackMajor * 0.09) * uCrackDepth) * uProcedural;
        normal = ncBump(-vViewPosition, normal, ncH, faceDirection);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        float ncDist = length(vNcWorld - uCubePos);
        float ncNear = exp(-ncDist / 12.0);
        float ncGlow = ncNear * (0.45 * uCubeGlow + 1.6 * uEnergy) + uFissure;
        // authored emissive fissures (GLB) flare up with the core
        totalEmissiveRadiance *= (1.0 + ncNear * (uEnergy * 4.0 + uCubeGlow * 0.4)) * uFissureGlow;
        totalEmissiveRadiance += uCrackColor * ncCrackMajor * ncFissureSel * ncGlow * 2.4 * uFissureGlow;
        // Glow creeping outwards from the logo bridge through the cracks as
        // the camera approaches. Placeholder: the generated cracks. GLB: the
        // grooves of its normal map and the dark crack lines in its albedo.
        if (uCrackSpread > 0.001) {
          float ncGroove = max(ncCrackMajor, ncCrackFine * 0.7);
          #ifdef USE_MAP
          if (uProcedural < 0.5) {
            // cracks are thin lines darker than the stone around them
            vec2 ncTs = vec2(3.0 / 2048.0);
            float ncC0 = dot(texture2D(map, vMapUv).rgb, vec3(0.3333));
            float ncCn = dot(
              texture2D(map, vMapUv + vec2(ncTs.x, 0.0)).rgb + texture2D(map, vMapUv - vec2(ncTs.x, 0.0)).rgb +
              texture2D(map, vMapUv + vec2(0.0, ncTs.y)).rgb + texture2D(map, vMapUv - vec2(0.0, ncTs.y)).rgb,
              vec3(0.0833));
            ncGroove = smoothstep(0.3, 0.62, 1.0 - ncC0 / max(ncCn, 1e-4));
          }
          #endif
          float ncFront = uCrackSpread * 48.0 - ncDist + (ncNoise(vNcWorld * 0.12) - 0.5) * 12.0;
          float ncReached = smoothstep(0.0, 5.0, ncFront);
          float ncEdge = smoothstep(0.0, 2.0, ncFront) * (1.0 - smoothstep(2.0, 7.0, ncFront));
          totalEmissiveRadiance += uCrackColor * ncGroove * (ncReached * (1.4 + uEnergy * 2.0) + ncEdge * 2.5) * uFissureGlow;
        }
        totalEmissiveRadiance *= 1.0 - ncAsh;`
      );
  };
  material.customProgramCacheKey = () => "nc-stone";

  const depthMaterial = createDissolveDepthMaterial(shared, local);
  return { material, depthMaterial, uniforms: local };
}

// ---------------------------------------------------------------------------
// Sand
// ---------------------------------------------------------------------------
const FLATTEN = "transformed.y *= (1.0 - uFlatten);";

export function createSandMaterial(shared, dissolveCfg) {
  const local = dissolveUniforms(dissolveCfg);
  const material = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.97, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, local);
    injectWorldVertex(shader, FLATTEN);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        ${SHARED_DECLS}
        ${WORLD_VARYINGS}
        ${NOISE}
        ${DISSOLVE}
        ${BUMP}
        // Pointer drawing in the sand: consecutive touch points of one
        // stroke (laid in quick succession; uStir is a ring buffer, newest
        // after oldest) are joined into a groove with the displaced sand
        // heaped along its edges, which slowly merges back (s.w fades).
        // returns (height, groove, rim)
        vec3 ncStirLine(vec2 p) {
          float groove = 0.0;
          float rim = 0.0;
          for (int i = 0; i < ${STIR_SLOTS}; i++) {
            vec4 a = uStir[i];
            if (a.w <= 0.001) continue;
            vec4 b = uStir[i == 0 ? ${STIR_SLOTS - 1} : i - 1];
            bool joined = b.w > 0.001 && b.z >= a.z && b.z - a.z < 0.4;
            vec2 ab = joined ? b.xy - a.xy : vec2(0.0);
            float L = dot(ab, ab);
            float t = L > 1e-6 ? clamp(dot(p - a.xy, ab) / L, 0.0, 1.0) : 0.0;
            float d = length(p - a.xy - ab * t);
            float fade = joined ? min(a.w, b.w) : a.w;
            float w = uLineWidth;
            groove = max(groove, exp(-d * d / (w * w)) * fade);
            rim = max(rim, exp(-pow((d - 1.7 * w) / (0.7 * w), 2.0)) * fade);
          }
          rim *= 1.0 - groove;
          return vec3((rim * 0.03 - groove * 0.07) * uLineDepth, groove, rim);
        }`
      )
      .replace(
        "#include <clipping_planes_fragment>",
        /* glsl */ `#include <clipping_planes_fragment>
        float ncT = ncThreshold(vNcWorld);
        if (ncT < uDissolve) discard;
        float ncEmber = (1.0 - smoothstep(0.0, 0.03, ncT - uDissolve)) * step(0.0005, uDissolve);

        vec2 ncP = vNcWorld.xz;
        float ncU = dot(ncP, uWind);
        float ncV = dot(ncP, vec2(-uWind.y, uWind.x));
        float ncCam = length(vViewPosition);
        float ncF1 = 1.0 - smoothstep(18.0, 110.0, ncCam);
        float ncF2 = 1.0 - smoothstep(60.0, 420.0, ncCam);
        float ncPh = ncU * 3.0 + ncNoise(vec3(ncP * 0.06, 0.0)) * 7.0 + sin(ncV * 0.21) * 1.4;
        float ncRip = pow(0.5 + 0.5 * sin(ncPh), 1.8) * 0.05 * ncF1 * uRipple;
        float ncPh2 = ncU * 0.55 + ncNoise(vec3(ncP * 0.011, 4.0)) * 9.0 + sin(ncV * 0.045) * 2.0;
        float ncRip2 = pow(0.5 + 0.5 * sin(ncPh2), 2.4) * 0.36 * ncF2 * uRipple;
        float ncGrain = ncF1 > 0.0 ? ncFbm(vNcWorld * 0.85) : 0.5;
        // a line drawn in the sand by the pointer: the ripples are smoothed
        // out inside it
        vec3 ncDraw = uStirActive > 0.5 && ncCam < 320.0 ? ncStirLine(ncP) : vec3(0.0);
        ncRip *= 1.0 - ncDraw.y;
        ncRip2 *= 1.0 - ncDraw.y * 0.7;`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float ncLift = smoothstep(-2.0, 13.0, vNcWorld.y);
        diffuseColor.rgb *= mix(0.8, 1.14, ncLift) * mix(0.88, 1.06, ncNoise(vNcWorld * 0.04));
        diffuseColor.rgb *= 1.0 + (ncRip2 / max(0.36 * uRipple, 1e-3) - 0.5) * 0.08 * ncF2;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.82, 0.66), ncEmber * 0.6);
        // the groove sits in its own shade; the heaped edges catch light
        diffuseColor.rgb *= 1.0 + (ncDraw.z * 0.14 - ncDraw.y * 0.3) * min(uLineDepth, 2.0);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = ncBump(-vViewPosition, normal, ncRip + ncRip2 + ncGrain * 0.03 * ncF1 + ncDraw.x, faceDirection);`
      )
      .replace(
        "#include <fog_fragment>",
        /* glsl */ `#include <fog_fragment>
        // White state: the dunes become a line drawing of their contours.
        float ncC = vNcWorld.y / uContourSpacing + 0.5;
        float ncW = fwidth(ncC);
        float ncD = min(fract(ncC), 1.0 - fract(ncC));
        float ncLine = (1.0 - smoothstep(0.0, ncW * 1.4, ncD)) * (1.0 - smoothstep(0.3, 0.7, ncW));
        float ncInk = ncLine * uContourStrength * uContours;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(uWhiteLevel) * (1.0 - ncInk), uWhite);`
      );
  };
  material.customProgramCacheKey = () => "nc-sand";
  return { material, uniforms: local };
}
