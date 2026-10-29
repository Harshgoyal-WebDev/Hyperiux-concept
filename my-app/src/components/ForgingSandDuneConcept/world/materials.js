import * as THREE from "three";
import { NOISE, BUMP, VORONOI, DISSOLVE } from "./glsl";
import { PALETTE, WIND_DIR } from "../config";

// Uniforms every world material shares; UniformSync in Scene.jsx writes
// these once per frame from the master timeline state.
export function createSharedUniforms() {
  return {
    uTime: { value: 0 },
    uNight: { value: 0 }, // 0 sunset → 1 moonlit night (eased in UniformSync)
    uWind: { value: new THREE.Vector2(WIND_DIR.x, WIND_DIR.y) },
    // Live tuning (tuning.js → UniformSync)
    uCrackScale: { value: 1 },
    uCrackDepth: { value: 1 },
    uRipple: { value: 1 },
    uLineWidth: { value: 0.5 },
    uStirActive: { value: 0 }, // any line in the sand at all (skips the lookup when not)
    // The line drawn in the sand (SandField paints it): groove / rim
    // texture over a square of the dunes, centre x, z and size (m).
    uTrail: { value: null },
    uTrailRect: { value: new THREE.Vector3(0, 0, 1) },
    uLineDepth: { value: 1 },
    uCrackColor: { value: new THREE.Color("#ff8e2c") },
    // Shockwave across the dunes as the beam merges into the core: ring
    // radius (m), strength, centre (x, z).
    uShockR: { value: 0 },
    uShockAmp: { value: 0 },
    uShockPos: { value: new THREE.Vector2() },
    // Recent pointer hits on the dunes, for the grain sprays: (x, z, age
    // seconds, strength).
    uStir: { value: Array.from({ length: STIR_SLOTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    // The whiteout past the pillars: a wave of white spreading out from
    // just ahead of the camera (radius m, centre x, z), then everything (uWhite); the
    // dunes are left as a contour drawing on it.
    uWhite: { value: 0 },
    uWhiteR: { value: 0 },
    uWhitePos: { value: new THREE.Vector2() },
    uWhiteLevel: { value: 6 },
    uContours: { value: 0 },
    uContourStrength: { value: 0.95 },
    uContourSpacing: { value: 1.8 },
    // the rocks turning to sand (0..1)
    uDissolve: { value: 0 },
    // the pillar in close-up: x, y, z, how far in
    uFocus: { value: new THREE.Vector4(0, -1000, 0, 0) },
    uPillarGlow: { value: 1 },
  };
}

export const STIR_SLOTS = 48;

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
uniform vec2 uWind;
uniform sampler2D uTrail;
uniform vec3 uTrailRect;
uniform float uCrackScale;
uniform float uCrackDepth;
uniform float uRipple;
uniform float uLineWidth;
uniform float uStirActive;
uniform float uLineDepth;
uniform float uShockR;
uniform float uShockAmp;
uniform vec2 uShockPos;
uniform float uWhite;
uniform float uWhiteR;
uniform vec2 uWhitePos;
uniform float uWhiteLevel;
uniform float uContours;
uniform float uContourStrength;
uniform float uContourSpacing;
uniform float uDissolve;
uniform vec4 uFocus;
uniform float uPillarGlow;
// how white the world is at p: inside the spreading wave, or everywhere
float ncWhiteAt(vec3 p) {
  float r = 1.0 - smoothstep(uWhiteR - 90.0, uWhiteR, length(p.xz - uWhitePos));
  return max(r, uWhite);
}
// Mixing straight towards HDR white (needed so it tone-maps to ~#FFF)
// overwhelms the frame early, so the white level itself ramps up only as
// the mix completes.
vec3 ncWhiteCol(float w) {
  return vec3(mix(0.9, uWhiteLevel, w * w * w));
}
`;

function injectWorldVertex(shader) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${SHARED_DECLS}\n${WORLD_VARYINGS}`)
    .replace("#include <project_vertex>", `#include <project_vertex>\n${WORLD_POS_VERTEX}`);
}

// ---------------------------------------------------------------------------
// Basalt
// ---------------------------------------------------------------------------
// Procedural basalt for the scattered rocks: an angular fracture network
// (fine polygonal cells + a few major cracks) and fine relief, from world
// position, so instances never repeat.
export function createStoneMaterial(shared, { color = PALETTE.basalt } = {}) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    injectWorldVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        ${SHARED_DECLS}
        ${WORLD_VARYINGS}
        ${NOISE}
        ${VORONOI}
        ${BUMP}`
      )
      .replace(
        "#include <clipping_planes_fragment>",
        /* glsl */ `#include <clipping_planes_fragment>
        vec3 ncN = normalize(vNcNormal);
        vec3 ncA = abs(ncN);
        vec2 ncUV = ncA.z > max(ncA.x, ncA.y) ? vNcWorld.xy : (ncA.x > ncA.y ? vNcWorld.zy : vNcWorld.xz);
        float ncTone = mix(0.86, 1.1, ncFbm(vNcWorld * 0.07));
        float ncFine = ncFbm(vNcWorld * 1.9 + 4.0);
        vec2 ncV1 = ncVoronoi(ncUV * 0.45 * uCrackScale);
        vec2 ncV2 = ncVoronoi(ncUV * 0.12 * uCrackScale + 7.0);
        float ncCrackFine = 1.0 - smoothstep(0.0, 0.045, ncV1.x);
        float ncCrackMajor = 1.0 - smoothstep(0.0, 0.03, ncV2.x);`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        diffuseColor.rgb *= ncTone * mix(0.86, 1.08, ncFine);
        diffuseColor.rgb *= 1.0 - (ncCrackFine * 0.45 + ncCrackMajor * 0.55) * min(uCrackDepth, 1.5);`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor - ncFine * 0.25 + ncCrackFine * 0.1, 0.35, 1.0);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float ncH = ncFine * 0.05 - (ncCrackFine * 0.035 + ncCrackMajor * 0.09) * uCrackDepth;
        normal = ncBump(-vViewPosition, normal, ncH, faceDirection);`
      );
  };
  material.customProgramCacheKey = () => "nc-stone";
  return { material };
}

// ---------------------------------------------------------------------------
// Sand
// ---------------------------------------------------------------------------
export function createSandMaterial(shared) {
  const material = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.97, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    injectWorldVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        ${SHARED_DECLS}
        ${WORLD_VARYINGS}
        ${NOISE}
        ${BUMP}
        // Pointer drawing in the sand: the groove traced along the
        // pointer's path, with the displaced sand heaped along its edges,
        // merging back as it ages (painted by SandField).
        // returns (height, groove, rim)
        // The trail is read with a cubic B-spline (four bilinear taps), not
        // plain bilinear: bilinear is only piecewise flat, and its slope —
        // which lights the groove — steps from texel to texel into blocky
        // facets. The B-spline is smooth, slope included.
        vec4 ncCubic(float v) {
          vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
          vec4 s = n * n * n;
          float x = s.x;
          float y = s.y - 4.0 * s.x;
          float z = s.z - 4.0 * s.y + 6.0 * s.x;
          return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
        }
        vec2 ncTrailSample(vec2 uv) {
          vec2 res = vec2(textureSize(uTrail, 0));
          uv = uv * res - 0.5;
          vec2 f = fract(uv);
          uv -= f;
          vec4 xc = ncCubic(f.x);
          vec4 yc = ncCubic(f.y);
          vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
          vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
          vec4 o = (c + vec4(xc.yw, yc.yw) / s) / res.xxyy;
          vec2 s0 = texture2D(uTrail, o.xz).rg;
          vec2 s1 = texture2D(uTrail, o.yz).rg;
          vec2 s2 = texture2D(uTrail, o.xw).rg;
          vec2 s3 = texture2D(uTrail, o.yw).rg;
          float sx = s.x / (s.x + s.y);
          float sy = s.z / (s.z + s.w);
          return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
        }
        vec3 ncStirLine(vec2 p) {
          vec2 uv = (p - uTrailRect.xy) / uTrailRect.z + 0.5;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
          // fades out over the square's last few metres (never a hard edge)
          float edge = smoothstep(0.0, 0.04, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
          vec2 tr = ncTrailSample(uv) * edge;
          float groove = tr.r;
          float rim = tr.g * (1.0 - groove);
          return vec3((rim * 0.03 - groove * 0.07) * uLineDepth, groove, rim);
        }`
      )
      .replace(
        "#include <clipping_planes_fragment>",
        /* glsl */ `#include <clipping_planes_fragment>
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
        ncRip2 *= 1.0 - ncDraw.y * 0.7;
        // the shockwave: a low ridge running out through the sand, with a
        // wave of light on it and a faint afterglow behind
        float shRing = 0.0;
        float shTrail = 0.0;
        if (uShockAmp > 0.001) {
          float shD = length(ncP - uShockPos);
          // (squared by hand: pow() of a negative base is undefined — NaN on
          // some GPUs, which the bloom spreads into a black frame)
          float shX = (shD - uShockR) / 6.0;
          shRing = exp(-shX * shX) * uShockAmp;
          shTrail = step(shD, uShockR) * exp(-(uShockR - shD) / 30.0) * uShockAmp;
          ncRip += shRing * 0.3;
        }`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float ncLift = smoothstep(-2.0, 13.0, vNcWorld.y);
        diffuseColor.rgb *= mix(0.8, 1.14, ncLift) * mix(0.88, 1.06, ncNoise(vNcWorld * 0.04));
        diffuseColor.rgb *= 1.0 + (ncRip2 / max(0.36 * uRipple, 1e-3) - 0.5) * 0.08 * ncF2;
        // the groove sits in its own shade; the heaped edges catch light
        diffuseColor.rgb *= 1.0 + (ncDraw.z * 0.14 - ncDraw.y * 0.3) * min(uLineDepth, 2.0);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = ncBump(-vViewPosition, normal, ncRip + ncRip2 + ncGrain * 0.03 * ncF1 + ncDraw.x, faceDirection);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.42, 0.1) * (shRing * 0.8 + shTrail * 0.12);`
      )
      .replace(
        "#include <fog_fragment>",
        /* glsl */ `#include <fog_fragment>
        // On the white the dunes become a line drawing of their contours
        // (hairline black lines, ~1 px, fading out where they would crowd
        // together).
        float ncC = vNcWorld.y / uContourSpacing + 0.5;
        float ncW = fwidth(ncC);
        float ncD = min(fract(ncC), 1.0 - fract(ncC));
        float ncLine = (1.0 - smoothstep(0.0, ncW * 0.85, ncD)) * (1.0 - smoothstep(0.3, 0.7, ncW));
        float ncWh = ncWhiteAt(vNcWorld);
        float ncInk = ncLine * uContourStrength * uContours;
        // (the paper is HDR white, so the ink falls off steeply to read black)
        float ncPaper = pow(1.0 - ncInk, 4.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, ncWhiteCol(ncWh) * ncPaper, ncWh);`
      );
  };
  material.customProgramCacheKey = () => "nc-sand";
  return { material };
}

// ---------------------------------------------------------------------------
// Pillars
// ---------------------------------------------------------------------------
// The basalt of the rocks that grow up past the mark (instanced: aPillar is
// each rock's base y, height, seed and whether it is a key pillar). It is the
// slab's own stone: a clean patch of the logo core's baked basalt
// (buildRockCrackMap), mirror-tiled over each facet by world position, and
// its cracks glow exactly as the slab's do (Forge.jsx patchStone): the dark
// crack lines of the albedo found against their neighbours, white-hot thin
// cores with an orange falloff, bloom doing the glow — brighter on the rock in
// close-up. On the white it goes to a dark silhouette, and it is eaten away
// as it turns to sand, with an ember edge where it is going.
export function createPillarMaterial(shared, crackMap) {
  const material = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.82, metalness: 0 });
  const local = {
    uRockMap: { value: crackMap.texture },
    uRockUv: { value: new THREE.Vector2(1, 1) }, // repeats per metre (see Pillars)
    uRockHot: { value: new THREE.Color("#ffc47e") }, // the slab's uHotColor
    uRockFissure: { value: 1 }, // T.fissureGlow, as on the slab
    uRockLevel: { value: 1.2 }, // the forged logo's lit level (J.logoCrackGlow)
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, local);
    injectWorldVertex(shader);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aPillar;\nvarying vec4 vPillar;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvPillar = aPillar;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        ${SHARED_DECLS}
        ${WORLD_VARYINGS}
        ${DISSOLVE}
        varying vec4 vPillar;
        uniform vec3 uCrackColor;
        uniform sampler2D uRockMap;
        uniform vec2 uRockUv;
        uniform vec3 uRockHot;
        uniform float uRockFissure;
        uniform float uRockLevel;`
      )
      .replace(
        "#include <clipping_planes_fragment>",
        /* glsl */ `#include <clipping_planes_fragment>
        float ncT = ncDisT(vNcWorld, vPillar.xyz);
        if (ncT < uDissolve) discard;
        float ncEdge = (1.0 - smoothstep(0.0, 0.035, ncT - uDissolve)) * step(0.0005, uDissolve);
        float ncWh = ncWhiteAt(vNcWorld);
        // the facet's plane (faces are flat shaded), offset per rock
        vec3 ncA = abs(normalize(vNcNormal));
        vec2 ncUv = ncA.z > max(ncA.x, ncA.y) ? vNcWorld.xy : (ncA.x > ncA.y ? vNcWorld.zy : vNcWorld.xz);
        ncUv = ncUv * uRockUv + vPillar.z * vec2(7.3, 3.1);`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        diffuseColor.rgb *= texture2D(uRockMap, ncUv).rgb;
        diffuseColor.rgb *= 1.0 - ncWh * 0.6;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        {
          // the slab's cracks: thin lines darker than the stone around them
          vec2 ncTs = 3.0 / vec2(textureSize(uRockMap, 0));
          float ncC0 = dot(texture2D(uRockMap, ncUv).rgb, vec3(0.3333));
          float ncCn = dot(
            texture2D(uRockMap, ncUv + vec2(ncTs.x, 0.0)).rgb + texture2D(uRockMap, ncUv - vec2(ncTs.x, 0.0)).rgb +
            texture2D(uRockMap, ncUv + vec2(0.0, ncTs.y)).rgb + texture2D(uRockMap, ncUv - vec2(0.0, ncTs.y)).rgb,
            vec3(0.0833));
          float ncRaw = 1.0 - ncC0 / max(ncCn, 1e-4);
          float ncThin = smoothstep(0.42, 0.8, ncRaw);
          float ncSoft = smoothstep(0.28, 0.6, ncRaw);
          float focus = uFocus.w * (1.0 - smoothstep(4.0, 12.0, length(vNcWorld.xz - uFocus.xz)));
          float lit = uRockLevel * (1.0 + 0.8 * focus) * uPillarGlow * (1.0 - ncWh);
          // white-hot thin cores, orange falloff; bloom does the glow
          totalEmissiveRadiance += (uCrackColor * ncSoft * 0.5 + uRockHot * ncThin * 1.2) * lit * uRockFissure;
          totalEmissiveRadiance += uCrackColor * ncEdge * 2.0 * (1.0 - ncWh * 0.7);
          totalEmissiveRadiance = min(totalEmissiveRadiance, vec3(24.0));
        }`
      )
      .replace(
        "#include <fog_fragment>",
        /* glsl */ `gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.025, 0.022, 0.02), ncWh * 0.9); // a dark silhouette against the white
        #include <fog_fragment>`
      );
  };
  material.customProgramCacheKey = () => "nc-pillar";
  return { material, uniforms: local };
}

// A clean patch of the slab's baked basalt for the rocks: the logo core's
// albedo is an atlas of UV islands with black between them, so a rectangle
// inside one large island (shares of the image) is copied out and tiled
// mirrored (no seams).
const ROCK_PATCH = { x: 0.43, y: 0.264, w: 0.23, h: 0.139 };
export function buildRockCrackMap(forge) {
  const source = forge.coreMeshes.map((m) => m.material?.map).find((t) => t?.image);
  if (!source) {
    // (no baked albedo: plain stone, no cracks to light)
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    return { texture: white, aspect: 1 };
  }
  const img = source.image;
  const sw = Math.round(ROCK_PATCH.w * img.width);
  const sh = Math.round(ROCK_PATCH.h * img.height);
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d").drawImage(img, Math.round(ROCK_PATCH.x * img.width), Math.round(ROCK_PATCH.y * img.height), sw, sh, 0, 0, sw, sh);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.anisotropy = 4;
  return { texture, aspect: sw / sh };
}
