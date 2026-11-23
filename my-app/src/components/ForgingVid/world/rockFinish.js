import * as THREE from "three";
import { NOISE, VORONOI } from "./glsl";
import { SUN_DIR } from "../config";

// The valley's boulders (scene/oasis/Oasis.jsx → Rocks): the photoreal rock
// material (world/rockModels.js) with, on top:
//   contact – darker towards the foot, where they sit in the sand
//   rim     – a warm rim round their silhouette where they are backlit by
//             the low sun (shared uRim: the valley's sunset scenes)
//   fissures– on about a third of them, a few thin cracks glowing orange,
//             shimmering (uRockGlow)
// A copy: the hero's pebbles keep the material as it is.
const SUN = `vec3(${SUN_DIR.x.toFixed(4)}, ${SUN_DIR.y.toFixed(4)}, ${SUN_DIR.z.toFixed(4)})`;

export function createRockFinish(shared) {
  const uniforms = {
    uTime: shared.uTime,
    uCrackColor: shared.uCrackColor,
    uRim: shared.uRim,
    uRimColor: shared.uRimColor,
    uRockGlow: shared.uRockGlow,
  };
  const finish = (base) => {
    const m = base.clone();
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vRfObj;
          varying vec3 vRfObjN;
          varying vec3 vRfWorld;
          varying float vRfSeed;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vRfObj = position;
          vRfObjN = objectNormal;`
        )
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>
          {
            vec4 w = vec4(transformed, 1.0);
            vRfSeed = 0.0;
            #ifdef USE_INSTANCING
              w = instanceMatrix * w;
              vRfSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
            #endif
            vRfWorld = (modelMatrix * w).xyz;
          }`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uTime;
          uniform vec3 uCrackColor;
          uniform float uRim;
          uniform vec3 uRimColor;
          uniform float uRockGlow;
          varying vec3 vRfObj;
          varying vec3 vRfObjN;
          varying vec3 vRfWorld;
          varying float vRfSeed;
          ${NOISE}
          ${VORONOI}`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          // (darker towards the foot: sitting in the sand)
          diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.45, vRfObj.y));`
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            vec3 rfV = normalize(vViewPosition);
            float rfNv = clamp(dot(normal, rfV), 0.0, 1.0);
            float rfBack = pow(max(dot(normalize(vRfWorld - cameraPosition), ${SUN}), 0.0), 3.0);
            totalEmissiveRadiance += uRimColor * pow(1.0 - rfNv, 4.0) * rfBack * uRim * 0.7;
            // glowing fissures on some of them (triplanar fracture lines)
            if (uRockGlow > 0.001 && vRfSeed < 0.34) {
              vec3 w = pow(abs(normalize(vRfObjN)), vec3(4.0));
              w /= w.x + w.y + w.z + 1e-4;
              vec3 q = vRfObj * 2.2 + vRfSeed * 13.0;
              float e = ncVoronoi(q.zy).x * w.x + ncVoronoi(q.xz + 3.1).x * w.y + ncVoronoi(q.xy + 7.7).x * w.z;
              float aa = fwidth(e);
              float line = (1.0 - smoothstep(0.0, 0.035 + aa, e)) * clamp(0.06 / (0.035 + aa), 0.0, 1.0);
              float sel = smoothstep(0.45, 0.7, ncNoise(vRfObj * 1.3 + vRfSeed * 7.0));
              float shim = 0.72 + 0.28 * sin(uTime * 0.6 + vRfSeed * 40.0);
              totalEmissiveRadiance += uCrackColor * line * sel * shim * uRockGlow * 2.6;
            }
          }`
        );
    };
    m.customProgramCacheKey = () => "valley-rock";
    return m;
  };
  return { uniforms, finish };
}
