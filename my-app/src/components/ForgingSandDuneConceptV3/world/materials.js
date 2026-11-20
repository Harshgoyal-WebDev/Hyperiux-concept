import * as THREE from "three";
import { NOISE, BUMP, VORONOI } from "./glsl";
import { PALETTE, WIND_DIR } from "../config";
import { REVEAL_GLSL } from "./revealMap";

// (no reveal map yet: nothing ever comes up)
function emptyRevealMap() {
  const h = THREE.DataUtils.toHalfFloat(60000);
  const t = new THREE.DataTexture(new Uint16Array([h, h, 0, 0]), 1, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  t.needsUpdate = true;
  return t;
}

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
    // The oasis past the mark (scene/oasis/groundMap.js): a map of its
    // ground over a rect (x0, z0, width, depth) — wet sand, grass, soil,
    // water depth — tinting the sand there.
    uOasisMap: { value: null },
    uOasisRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uOasisOn: { value: 0 },
    uOasisGrass: { value: new THREE.Color("#2c3a12") },
    uOasisSoil: { value: new THREE.Color("#2a1406") },
    // the oasis rising out of the desert: its front's origin (x, z), radius
    // and band (m); behind it the ground is the oasis's, ahead bare sand
    // (the stream's bed filled level) — and the front itself a line of light
    uOasisReveal: { value: new THREE.Vector4(0, 0, 0, 45) },
    uOasisRing: { value: 1 },
    // the land coming to life with the oasis (0..1, Rig UniformSync): the
    // dunes behind the reveal's front turn dark green-grey, the sky and the
    // haze a light blue (Sky.jsx, Rig)
    uLush: { value: 0 },
    uGrowSky: { value: 0 }, // the tree growing: a deeper blue sky with clouds (scene/Sky.jsx)
    uLushDune: { value: new THREE.Color("#2b5230") },
    // ...when each spot comes up, and the light running out ahead of it
    // (world/revealMap.js; until it is built: never)
    uRevealMap: { value: emptyRevealMap() },
    uRevealRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    // the sand's wind ripples: a photoscanned normal map (ambientCG
    // Ground055L, CC0 — public/textures/sand), laid over the dunes at its
    // real size (uSandTex.x m a tile), its strength (y), on once loaded (z)
    uSandNormal: { value: sandNormalMap() },
    uSandTex: { value: new THREE.Vector4(3, 1, 0, 0) },
  };
}

export const STIR_SLOTS = 48;

// (loaded once for the page; uSandTex.z turns it on when it has arrived)
let sandNormal = null;
const sandWaiting = [];
function sandNormalMap() {
  if (!sandNormal && typeof window !== "undefined") {
    sandNormal = new THREE.TextureLoader().load("/textures/sand/ground055l_normal.jpg", () => sandWaiting.forEach((u) => (u.value.z = 1)));
    sandNormal.wrapS = sandNormal.wrapT = THREE.RepeatWrapping;
    sandNormal.anisotropy = 8;
    sandNormal.colorSpace = THREE.NoColorSpace;
  }
  return sandNormal;
}
// (call with the shared uniforms: their uSandTex goes on once the map is in)
export function watchSandMap(shared) {
  if (sandNormal?.image) shared.uSandTex.value.z = 1;
  else sandWaiting.push(shared.uSandTex);
}

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
uniform sampler2D uOasisMap;
uniform vec4 uOasisRect;
uniform float uOasisOn;
uniform vec3 uOasisGrass;
uniform vec3 uOasisSoil;
uniform float uOasisRing;
uniform float uLush;
uniform vec3 uLushDune;
uniform sampler2D uSandNormal;
uniform vec4 uSandTex;
${REVEAL_GLSL}
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
// Stone
// ---------------------------------------------------------------------------
// The rocks, after the reference (hyperiux-concepts v6): matte, water-worn
// stone, warm grey-brown, its tone wandering a little from stone to stone and
// over each one, and a dusting of olive moss / lichen on what faces the sky.
// No crack network: the facets of the geometry (world/plants.js
// boulderGeometry, flat shaded) carry its form. Colour from world position,
// so instances never repeat. (T.stoneMoss / T.stoneMossAmount: the rigs set
// STONE_UNIFORMS, synced by scene/Rocks.jsx.)
export const STONE_UNIFORMS = { uMoss: { value: new THREE.Color("#5f6232") }, uMossAmount: { value: 0.5 } };
export function createStoneMaterial(shared, { color = PALETTE.basalt } = {}) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.3, flatShading: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, STONE_UNIFORMS);
    injectWorldVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        ${SHARED_DECLS}
        ${WORLD_VARYINGS}
        ${NOISE}
        uniform vec3 uMoss;
        uniform float uMossAmount;
        // (small facets cut into the stone's surface: the nearest of a 3D
        // jittered grid's points — each cell a flat patch with its own tilt)
        vec3 ncFacet(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          float d1 = 8.0;
          vec3 best = vec3(0.0);
          for (int z = -1; z <= 1; z++)
          for (int y = -1; y <= 1; y++)
          for (int x = -1; x <= 1; x++) {
            vec3 g = vec3(float(x), float(y), float(z));
            vec3 c = i + g;
            vec3 o = vec3(ncHash(c), ncHash(c + 7.3), ncHash(c + 13.1));
            vec3 r = g + o - f;
            float d = dot(r, r);
            if (d < d1) { d1 = d; best = c; }
          }
          return vec3(ncHash(best + 2.9), ncHash(best + 5.7), ncHash(best + 11.3));
        }`
      )
      .replace(
        "#include <clipping_planes_fragment>",
        /* glsl */ `#include <clipping_planes_fragment>
        // (the facet's own normal, in world space: flat shaded)
        vec3 ncFn = normalize(cross(dFdx(vNcWorld), dFdy(vNcWorld)));
        float ncTone = mix(0.8, 1.14, ncFbm(vNcWorld * 0.05));
        float ncFine = ncFbm(vNcWorld * 1.3 + 4.0);
        vec3 ncCell = ncFacet(vNcWorld * 2.6);
        float ncMoss = smoothstep(0.35, 0.85, ncFn.y) * smoothstep(0.35, 0.7, ncFbm(vNcWorld * 0.6 + 11.0) + 0.15) * uMossAmount;`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        diffuseColor.rgb *= ncTone * mix(0.88, 1.08, ncFine) * mix(0.9, 1.08, ncCell.z);
        // (a little lighter on top, where it is weathered pale)
        diffuseColor.rgb *= mix(0.9, 1.12, smoothstep(-0.2, 0.9, ncFn.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, uMoss * mix(0.8, 1.15, ncFine), ncMoss);`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor - ncFine * 0.06, 0.85, 1.0);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = normalize(normal + mat3(viewMatrix) * (ncCell - 0.5) * 0.55);`
      );
  };
  material.customProgramCacheKey = () => "nc-stone-v6";
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
    // until the oasis comes up here, its stream's and lake's bed is filled
    // level with the sand round it (the map's depth, lifted back: a smooth
    // desert); as the oasis comes up it sinks away first, while the water
    // is still unseen, and only then does the water come in over it — so
    // the two are never seen at the same height (where they were, the depth
    // test couldn't tell them apart and the sand stood out of the water in
    // stepped blocks; sunk under the water's line beforehand instead, the
    // bed was a trough all down the desert, its edges and their shadows
    // breaking into pixels)
    // (lifted level, its surface faces up: left with the carved banks'
    // normals, the filled bed was lit as steep slopes and broke into dark
    // blocks along the mesh's grid)
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `#include <beginnormal_vertex>
      if (uOasisOn > 0.5) {
        vec2 ncNuv = (position.xz - uOasisRect.xy) / uOasisRect.zw;
        if (ncNuv.x > 0.0 && ncNuv.y > 0.0 && ncNuv.x < 1.0 && ncNuv.y < 1.0) {
          float ncNd = textureLod(uOasisMap, ncNuv, 0.0).a;
          float ncNup = (1.0 - smoothstep(0.0, 0.5, ncRevealWater(position.xz))) * smoothstep(0.0, 0.03, ncNd);
          objectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), ncNup));
        }
      }`
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      if (uOasisOn > 0.5) {
        vec2 ncOuv = (position.xz - uOasisRect.xy) / uOasisRect.zw;
        if (ncOuv.x > 0.0 && ncOuv.y > 0.0 && ncOuv.x < 1.0 && ncOuv.y < 1.0) {
          float ncDepth = textureLod(uOasisMap, ncOuv, 0.0).a * 6.0;
          float ncUp = 1.0 - smoothstep(0.0, 0.5, ncRevealWater(position.xz));
          transformed.y += (ncDepth + 0.25 * step(0.001, ncDepth)) * ncUp;
        }
      }`
    );
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
        // The photoscanned ripples at p (world x, z) at a size (× the tile):
        // the crests turned across the wind; the tiling broken up (each
        // stretch of a few tiles takes the map at its own offset, blended
        // where they meet, so its repeat never shows) and gently bent, so the
        // crests wander. Returns the slope it gives the ground (world x, z).
        vec2 ncSandSlope(vec2 p, float size, float o) {
          vec2 across = vec2(-uWind.y, uWind.x);
          vec2 uv = vec2(dot(p, across), dot(p, uWind)) / (uSandTex.x * size);
          uv += (vec2(ncNoise(vec3(uv * 0.21, 41.0 + o)), ncNoise(vec3(uv * 0.21, 43.0 + o))) - 0.5) * 0.35;
          float k = ncNoise(vec3(uv * 0.33, 47.0 + o)) * 8.0;
          float ia = floor(k);
          float f = fract(k);
          // (sampled a touch blurred: soft crests, not sharp grooves)
          vec2 dx = dFdx(uv) * 1.8;
          vec2 dy = dFdy(uv) * 1.8;
          vec2 na = textureGrad(uSandNormal, uv + sin(vec2(3.0, 7.0) * ia), dx, dy).xy * 2.0 - 1.0;
          vec2 nb = textureGrad(uSandNormal, uv + sin(vec2(3.0, 7.0) * (ia + 1.0)), dx, dy).xy * 2.0 - 1.0;
          vec2 t = mix(na, nb, smoothstep(0.2, 0.8, f));
          return t.x * across + t.y * uWind;
        }
        // ...at three sizes, so the ripples carry on into the distance: the
        // real ones close by (a fine map seen from far flattens out under its
        // mipmaps), and the same pattern 6× and 30× larger taking over as it
        // does — near, the fine sand; far, ripples right across the dunes
        vec2 ncSandRipples(vec2 p) {
          vec2 uv = p / uSandTex.x;
          float lod = log2(max(length(fwidth(uv)) * 1024.0, 1e-4));
          vec2 s = ncSandSlope(p, 1.0, 0.0);
          float w2 = smoothstep(1.5, 4.0, lod);
          float w3 = smoothstep(1.5, 4.0, lod - log2(6.0));
          // (the larger ones gentler still: far off the dunes stay calm)
          if (w2 > 0.001) s = s * (1.0 - w2 * 0.5) + ncSandSlope(p, 6.0, 10.0) * w2 * 0.55;
          if (w3 > 0.001) s = s * (1.0 - w3 * 0.5) + ncSandSlope(p, 30.0, 20.0) * w3 * 0.3;
          return s;
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
        float ncRip = pow(0.5 + 0.5 * sin(ncPh), 1.8) * 0.05 * ncF1 * uRipple * (1.0 - uSandTex.z);
        float ncPh2 = ncU * 0.55 + ncNoise(vec3(ncP * 0.011, 4.0)) * 9.0 + sin(ncV * 0.045) * 2.0;
        float ncRip2 = pow(0.5 + 0.5 * sin(ncPh2), 2.4) * 0.36 * ncF2 * uRipple * (1.0 - uSandTex.z);
        float ncGrain = ncF1 > 0.0 ? ncFbm(vNcWorld * 0.85) : 0.5;
        // (anti-aliased: each layer of ripples fades out just where it gets
        // finer than the screen can show — looking down the valley, at a
        // grazing angle, it was squeezed under a pixel and its bump broke
        // into stepped, pixelated blocks; so the near sand keeps its crisp
        // wind ripples and the far sand settles into smooth dunes)
        float ncAA1 = 1.0 - smoothstep(0.45, 1.2, fwidth(ncPh));
        float ncAA2 = 1.0 - smoothstep(0.45, 1.2, fwidth(ncPh2));
        float ncAAg = 1.0 - smoothstep(0.2, 0.7, fwidth(dot(vNcWorld, vec3(0.85))));
        ncRip *= ncAA1;
        ncRip2 *= ncAA2;
        ncGrain = mix(0.5, ncGrain, ncAAg);
        // the oasis: wet sand by the water, grass, darker soil (r, g, b; a: depth)
        vec4 ncOasis = vec4(0.0);
        if (uOasisOn > 0.5) {
          vec2 ncOuv = (ncP - uOasisRect.xy) / uOasisRect.zw;
          if (ncOuv.x > 0.0 && ncOuv.y > 0.0 && ncOuv.x < 1.0 && ncOuv.y < 1.0) ncOasis = texture2D(uOasisMap, ncOuv);
        }
        // (none of it until the oasis has come up here)
        float ncRev = ncReveal(ncP);
        ncOasis.rgb *= ncRev;
        // (the light running out ahead of it is drawn apart: scene/oasis/Rivulets.jsx)
        vec3 ncFront = vec3(0.0);
        // (the ripples settle where it is wet or grown over)
        ncRip *= 1.0 - max(ncOasis.r, ncOasis.g) * 0.8;
        ncRip2 *= 1.0 - max(ncOasis.r, ncOasis.g) * 0.85;
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
          // (wider the further out it is, so it still reads at the horizon)
          float shX = (shD - uShockR) / (6.0 + shD * 0.028);
          shRing = exp(-shX * shX) * uShockAmp;
          shTrail = step(shD, uShockR) * exp(-(uShockR - shD) / (30.0 + shD * 0.06)) * uShockAmp;
          ncRip += shRing * 0.3;
        }`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        // the dunes come to life behind the oasis's front (its own clock,
        // world/revealMap.js): dark green-grey, keeping their light and shade
        if (uLush > 0.001) {
          // (sweeping out with the front, and the far dunes — beyond its reach —
          // turning with the rest as it spreads)
          float lsBehind = max(clamp((uOasisReveal.z - revealStart(ncP)) / 160.0, 0.0, 1.0), 0.9 * smoothstep(0.25, 0.9, uLush));
          float lsAmt = uLush * lsBehind * mix(0.75, 1.0, smoothstep(1.5, 12.0, vNcWorld.y));
          float lsLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 lsCol = uLushDune * (0.55 + 1.1 * lsLum) * mix(0.85, 1.12, ncNoise(vNcWorld * 0.02));
          diffuseColor.rgb = mix(diffuseColor.rgb, lsCol, lsAmt * 0.92);
        }
        float ncLift = smoothstep(-2.0, 13.0, vNcWorld.y);
        diffuseColor.rgb *= mix(0.8, 1.14, ncLift) * mix(0.88, 1.06, ncNoise(vNcWorld * 0.04));
        diffuseColor.rgb *= 1.0 + (ncRip2 / max(0.36 * uRipple, 1e-3) - 0.5) * 0.08 * ncF2;
        // the groove sits in its own shade; the heaped edges catch light
        diffuseColor.rgb *= 1.0 + (ncDraw.z * 0.14 - ncDraw.y * 0.3) * min(uLineDepth, 2.0);
        if (ncOasis.r + ncOasis.g + ncOasis.b > 0.002) {
          float ncOn = ncNoise(vec3(ncP * 0.21, 3.0)) * 0.5 + ncNoise(vec3(ncP * 0.9, 5.0)) * 0.25;
          diffuseColor.rgb = mix(diffuseColor.rgb, uOasisSoil * (0.85 + ncOn * 0.5), ncOasis.b * 0.8);
          float ncG = clamp(ncOasis.g * (1.0 + ncOn * 1.2) - 0.05, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, uOasisGrass * (0.75 + ncOn * 0.6), ncG);
          diffuseColor.rgb *= 1.0 - ncOasis.r * 0.3;
        }`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        // wet sand by the water has a sheen
        roughnessFactor = mix(roughnessFactor, 0.42, ncOasis.r * 0.85);`
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = ncBump(-vViewPosition, normal, ncRip + ncRip2 + ncGrain * 0.03 * ncF1 + ncDraw.x, faceDirection);
        // the photoscanned ripples: the ground tilted by them (in world space,
        // then turned into the view's), settling where it is wet or grown over
        if (uSandTex.z > 0.5) {
          // (and smoothed away inside the line the cursor draws in the sand)
          vec2 ncS = ncSandRipples(ncP) * uSandTex.y * uRipple * (1.0 - max(ncOasis.r, ncOasis.g) * 0.8) * (1.0 - ncDraw.y * 0.85);
          vec3 ncN0 = normalize(vNcNormal);
          vec3 ncN1 = normalize(ncN0 + vec3(ncS.x, 0.0, ncS.y));
          normal = normalize(normal + (viewMatrix * vec4(ncN1 - ncN0, 0.0)).xyz);
        }`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        // (brighter the further out, against the haze: seen to the horizon)
        totalEmissiveRadiance += vec3(1.0, 0.42, 0.1) * (shRing * 0.8 + shTrail * 0.12) * (1.0 + uShockR * 0.0025);
        totalEmissiveRadiance += ncFront;`
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
