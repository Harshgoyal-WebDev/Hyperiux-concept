import * as THREE from "three";
import { NOISE, BUMP, VORONOI } from "./glsl";
import { PALETTE, SUN_DIR, WIND_DIR } from "../config";
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
    // The hero's dressing on the sand (scene/hero, synced by HeroDressing):
    // soft contact shadows round the slab's foot (uContactSlab: what is left
    // of the slab) and the ruins' (x, z, radius m, strength), their strength
    // overall (uContactK); the warm rim light along the backlit crests; the
    // energy veins round the slab; the drifting ground haze (amount, sunlit).
    uContact: { value: Array.from({ length: CONTACT_SLOTS }, () => new THREE.Vector4(0, 0, 1, 0)) },
    uContactK: { value: 0 },
    uContactSlab: { value: 1 },
    uRim: { value: 0 },
    uVeins: { value: 0 },
    uHaze: { value: new THREE.Vector2(0, 1) },
    // ...and its sky (scene/Sky.jsx): how warm, and the sun's glow
    uHeroSky: { value: 0 },
    uSunGlow: { value: 0 },
    // ...and its warm light on the sand and the ruins only (not the slab,
    // which keeps its own dark basalt): from the front (colour × intensity,
    // the direction towards it) and a warm bounce in the shadows (sky,
    // ground). In the shaders, not scene lights, so nothing else is lit.
    uFill: { value: new THREE.Color(0, 0, 0) },
    uFillDir: { value: new THREE.Vector3(-30, 25, 120).normalize() },
    uHemiSky: { value: new THREE.Color(0, 0, 0) },
    uHemiGround: { value: new THREE.Color(0, 0, 0) },
    // ...and the sand blowing over the dunes' surface (streaks sliding
    // downwind)
    uSurfDust: { value: 0 },
    // The valley's light (scene/valley): the energy trail's light spilt on
    // the sand round it — its path as a polyline (BEAM_POINTS, world x y z),
    // the box round it (x0, z0, x1, z1) and how strong — and the orb's light
    // on the ground round it (centre, strength).
    uBeamPath: { value: Array.from({ length: BEAM_POINTS }, () => new THREE.Vector3()) },
    uBeamBox: { value: new THREE.Vector4() },
    uBeamSpill: { value: 0 },
    uOrbLight: { value: new THREE.Vector4() },
    // ...and the glowing fissures in its boulders (world/rockFinish.js)
    uRockGlow: { value: 0 },
    // the rim light's colour (warm by day, cool moonlight by night) and the
    // slab's core's light on the sand round it (centre, strength)
    uRimColor: { value: new THREE.Color(1, 0.5, 0.2) },
    uCoreGlow: { value: new THREE.Vector4() },
    // the Milky Way's band for the night sky (scene/Sky.jsx: pole, centre)
    uMwN: { value: new THREE.Vector3(0, 0, 1) },
    uMwC: { value: new THREE.Vector3(0, 0.5, -1).normalize() },
    // ...and where its moon is drawn (the moonlight itself keeps SUN_DIR)
    uMoonDir: { value: SUN_DIR.clone() },
  };
}

export const STIR_SLOTS = 48;

// The hero's warm light (uFill, uHemiSky / uHemiGround), added after the
// scene's lights as a directional and a hemisphere light would be.
export const HERO_LIGHT = /* glsl */ `
if (uFill.r + uFill.g + uFill.b + uHemiSky.r + uHemiGround.r > 0.0001) {
  vec3 hlN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  reflectedLight.directDiffuse += uFill * max(dot(hlN, uFillDir), 0.0) * BRDF_Lambert(material.diffuseColor);
  reflectedLight.indirectDiffuse += mix(uHemiGround, uHemiSky, 0.5 * hlN.y + 0.5) * BRDF_Lambert(material.diffuseColor);
}
`;
export const CONTACT_SLOTS = 16;
export const BEAM_POINTS = 24;

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
        }
        // the hero's dressing (createSharedUniforms)
        uniform vec4 uContact[${CONTACT_SLOTS}];
        uniform float uContactK;
        uniform float uContactSlab;
        uniform float uRim;
        uniform float uVeins;
        uniform vec2 uHaze;
        uniform vec3 uCrackColor;
        uniform vec3 uFill;
        uniform vec3 uFillDir;
        uniform vec3 uHemiSky;
        uniform vec3 uHemiGround;
        uniform float uSurfDust;
        uniform vec3 uBeamPath[${BEAM_POINTS}];
        uniform vec4 uBeamBox;
        uniform float uBeamSpill;
        uniform vec4 uOrbLight;
        uniform vec3 uRimColor;
        uniform vec4 uCoreGlow;
        const vec3 ncNightMist = vec3(0.05, 0.07, 0.13);
        const vec3 ncSun = vec3(${SUN_DIR.x.toFixed(4)}, ${SUN_DIR.y.toFixed(4)}, ${SUN_DIR.z.toFixed(4)});
        // Thin veins of energy across the dunes round the slab: the 0.5
        // contour of a warped low noise (long meandering lines), and finer
        // branches off them only where they run close by; only some
        // stretches lit (a slow mask). Anti-aliased: where a line gets
        // thinner than a pixel it widens to one and dims by as much.
        float ncVeinLine(float n, float w) {
          float aa = fwidth(n);
          return (1.0 - smoothstep(w, w + aa * 1.5, abs(n - 0.5))) * clamp(2.0 * w / (w + aa), 0.0, 1.0);
        }
        // ...and the soft glow either side of it (a few times its width,
        // fading out where it would be under a pixel's worth)
        float ncVeinHalo(float n, float w) {
          float aa = fwidth(n);
          return exp(-abs(n - 0.5) / (w * 5.0 + aa)) * clamp(w * 5.0 / (w * 5.0 + aa * 2.0), 0.0, 1.0);
        }
        float ncVeins(vec2 p) {
          // long open lines running along the dunes (across the wind, as
          // their crests do), ~45 m apart, wandering with the dunes' shapes
          float f = dot(p, uWind) / 45.0 + (ncNoise(vec3(p * 0.007, 2.0)) - 0.5) * 1.8 + (ncNoise(vec3(p * 0.021, 5.0)) - 0.5) * 0.35;
          float df = abs(fract(f + 0.5) - 0.5); // (0 on a line)
          float main = ncVeinLine(0.5 + df, 0.0055) + ncVeinHalo(0.5 + df, 0.0055) * 0.22;
          // short branches splitting off them (lines the other way, only
          // within a few metres of a main one)
          float g = dot(p, vec2(-uWind.y, uWind.x)) / 28.0 + (ncNoise(vec3(p * 0.016, 13.0)) - 0.5) * 2.2;
          float dg = abs(fract(g + 0.5) - 0.5);
          float branch = ncVeinLine(0.5 + dg, 0.006) * (1.0 - smoothstep(0.02, 0.09, df)) * 0.7;
          // (long stretches lit, with gaps: a slow mask)
          float sel = smoothstep(0.38, 0.58, ncNoise(vec3(p * 0.006, 19.0)));
          // the energy running along them
          float flow = 0.6 + 0.4 * sin(ncNoise(vec3(p * 0.02, 23.0)) * 24.0 - uTime * 1.1);
          return max(main, branch) * sel * flow;
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
        // soft contact shadows: round the slab's foot (its 50 × 13 m
        // footprint, while it stands) and the ruins' (scene/hero)
        if (uContactK > 0.001 && ncCam < 700.0) {
          vec2 ctQ = abs(ncP) - vec2(26.0, 6.5);
          float ctD = length(max(ctQ, 0.0)) + min(max(ctQ.x, ctQ.y), 0.0);
          float ctAo = 1.0 - 0.6 * uContactSlab * exp(-max(ctD, 0.0) / 6.0);
          for (int i = 0; i < ${CONTACT_SLOTS}; i++) {
            vec4 c = uContact[i];
            if (c.w > 0.0) {
              vec2 d = (ncP - c.xy) / c.z;
              ctAo *= 1.0 - c.w * exp(-dot(d, d));
            }
          }
          diffuseColor.rgb *= mix(1.0, ctAo, uContactK);
        }
        if (ncOasis.r + ncOasis.g + ncOasis.b > 0.002) {
          float ncOn = ncNoise(vec3(ncP * 0.21, 3.0)) * 0.5 + ncNoise(vec3(ncP * 0.9, 5.0)) * 0.25;
          diffuseColor.rgb = mix(diffuseColor.rgb, uOasisSoil * (0.85 + ncOn * 0.5), ncOasis.b * 0.8);
          float ncG = clamp(ncOasis.g * (1.0 + ncOn * 1.2) - 0.05, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, uOasisGrass * (0.75 + ncOn * 0.6), ncG);
          diffuseColor.rgb *= 1.0 - ncOasis.r * 0.3;
        }`
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        ${HERO_LIGHT}`
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
        }
        // Nothing we see can face away from us. Out where the mesh is coarse
        // its crests overshoot the true ridgeline, and slivers of the slope
        // behind (facing away from the camera and into the low sun) showed
        // along every crest as a dashed line of light. Such a normal is
        // bent back to the silhouette's, side-on to the view, so the crest
        // reads as one even edge.
        {
          vec3 ncV = normalize(vViewPosition);
          float ncNv = dot(normal, ncV);
          if (ncNv < 0.05) normal = normalize(normal + ncV * (0.05 - ncNv));
        }`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        // (brighter the further out, against the haze: seen to the horizon)
        totalEmissiveRadiance += vec3(1.0, 0.42, 0.1) * (shRing * 0.8 + shTrail * 0.12) * (1.0 + uShockR * 0.0025);
        totalEmissiveRadiance += ncFront;
        // Warm rim light along the backlit crests: looking into the low sun,
        // the sand turned side-on to us at a crest and tilted towards the
        // sun (not the flat ground, which is side-on too far off) glows,
        // stronger on some crests than others.
        if (uRim > 0.001) {
          vec3 rmN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float rmNv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float rmToSun = smoothstep(0.04, 0.3, dot(rmN.xz, normalize(ncSun.xz)));
          float rmBack = pow(max(dot(normalize(vNcWorld - cameraPosition), ncSun), 0.0), 3.0);
          float rmSel = 0.5 + 0.5 * smoothstep(0.35, 0.7, ncNoise(vec3(ncP * 0.008, 7.0)));
          totalEmissiveRadiance += uRimColor * pow(1.0 - rmNv, 5.0) * rmToSun * rmBack * rmSel * uRim * 1.1;
        }
        // Sand blowing over the surface: streaks drawn out along the wind
        // (long along it, narrow across), sliding downwind, in patches that
        // drift with it; lit warm, brighter looking into the sun.
        if (uSurfDust > 0.001 && ncCam < 700.0) {
          vec2 sdW = vec2(dot(ncP, uWind), dot(ncP, vec2(-uWind.y, uWind.x)));
          float sd1 = ncNoise(vec3(sdW.x * 0.03 - uTime * 0.8, sdW.y * 0.2, 3.0));
          float sd2 = ncNoise(vec3(sdW.x * 0.07 - uTime * 1.6, sdW.y * 0.45, 7.0));
          float sdStreak = smoothstep(0.48, 0.92, sd1 * 0.65 + sd2 * 0.35);
          float sdPatch = smoothstep(0.35, 0.7, ncNoise(vec3(ncP * 0.009 - uWind * uTime * 0.025, 9.0)));
          float sdSun = pow(max(dot(normalize(vNcWorld - cameraPosition), ncSun), 0.0), 3.0);
          // (thinning out where the streaks get finer than the screen shows)
          float sdAa = (1.0 - smoothstep(0.25, 0.8, fwidth(sdW.y * 0.2))) * (1.0 - smoothstep(140.0, 380.0, ncCam));
          totalEmissiveRadiance += vec3(1.0, 0.58, 0.3) * sdStreak * sdPatch * sdAa * (0.12 + 0.45 * sdSun) * uSurfDust;
        }
        // The energy trail's light on the sand round it: the nearest of its
        // path's segments (only inside the box round it), a tight bright
        // pool under it and a soft spill a few metres out.
        if (uBeamSpill > 0.001 && ncP.x > uBeamBox.x && ncP.y > uBeamBox.y && ncP.x < uBeamBox.z && ncP.y < uBeamBox.w) {
          float bmD = 1e5;
          for (int i = 0; i < ${BEAM_POINTS - 1}; i++) {
            vec2 a = uBeamPath[i].xz;
            vec2 ab = uBeamPath[i + 1].xz - a;
            float h = clamp(dot(ncP - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
            bmD = min(bmD, length(ncP - a - ab * h));
          }
          // (by night the wide spill would light the whole dark floor: there
          // only the pool right under it — uHaze.y is the day's share)
          float bmSpill = exp(-bmD / 4.5) * 0.35 * (0.15 + 0.85 * uHaze.y) + exp(-bmD / 1.2) * 0.9;
          totalEmissiveRadiance += vec3(1.0, 0.45, 0.13) * bmSpill * uBeamSpill;
        }
        // the slab's core's warm light on the sand round it (by night most)
        if (uCoreGlow.w > 0.001) {
          vec3 cgTo = uCoreGlow.xyz - vNcWorld;
          float cgD2 = dot(cgTo, cgTo);
          vec3 cgN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float cgFace = max(dot(cgN, cgTo * inversesqrt(cgD2)), 0.0) * 0.7 + 0.3;
          totalEmissiveRadiance += vec3(1.0, 0.38, 0.08) * cgFace * uCoreGlow.w * 1600.0 / (cgD2 + 1600.0) * exp(-sqrt(cgD2) / 90.0);
        }
        // the orb's light on the ground round it (falling off with distance,
        // on what faces it)
        if (uOrbLight.w > 0.001) {
          vec3 obTo = uOrbLight.xyz - vNcWorld;
          float obD2 = dot(obTo, obTo);
          vec3 obN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float obFace = max(dot(obN, obTo * inversesqrt(obD2)), 0.0);
          // (a pool round it: gone well before the far mountains)
          totalEmissiveRadiance += vec3(1.0, 0.5, 0.18) * obFace * uOrbLight.w * 900.0 / (obD2 + 900.0) * exp(-sqrt(obD2) / 130.0);
        }
        // the energy veins round the slab (from 45 m out to ~250 m)
        // (from 40 m round the slab out past the camera's foreground, to ~330 m)
        if (uVeins > 0.001 && ncCam < 500.0) {
          float vnR = length(ncP);
          float vnArea = smoothstep(38.0, 58.0, vnR) * (1.0 - smoothstep(240.0, 330.0, vnR));
          // (kept clear of the beam's path in front of the slab: it runs
          // along the sand within ~10 m of x = 0)
          vnArea *= ncP.y > 0.0 ? smoothstep(10.0, 22.0, abs(ncP.x)) : 1.0;
          if (vnArea > 0.001) totalEmissiveRadiance += uCrackColor * ncVeins(ncP) * vnArea * uVeins * 2.2;
        }`
      )
      .replace(
        "#include <fog_fragment>",
        /* glsl */ `#include <fog_fragment>
        // Haze drifting low over the dunes: thicker near the sand and with
        // distance, in slow banks carried by the wind, and lit warm where we
        // look into the sun (its light scattered through the dust).
        #ifdef USE_FOG
        if (uHaze.x > 0.001) {
          float hzD = length(vViewPosition);
          // (lying in the low ground between the ridges, so each ridge's
          // crest stands out darker against the haze filling the hollow
          // behind it: the far dunes read in layers, as in the art)
          float hzLow = exp(-max(vNcWorld.y + 2.0, 0.0) / 9.0);
          float hzBank = ncNoise(vec3(ncP * 0.005 + uWind * uTime * 0.012, uTime * 0.015));
          float hzAmt = (1.0 - exp(-hzD * 0.0024)) * hzLow * mix(0.55, 1.15, hzBank) * uHaze.x;
          float hzSun = pow(max(dot(normalize(vNcWorld - cameraPosition), ncSun), 0.0), 8.0) * uHaze.y;
          vec3 hzCol = mix(fogColor, vec3(1.0, 0.46, 0.18), hzSun * 0.5);
          // (by night a moonlit mist, cool and pale, lying low)
          hzCol = mix(hzCol, ncNightMist, 1.0 - uHaze.y);
          // (thinner by night: a low blue mist, not a pale wash)
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hzCol, clamp(hzAmt * mix(0.6, 1.0, uHaze.y), 0.0, mix(0.55, 0.88, uHaze.y)));
        }
        #endif
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
