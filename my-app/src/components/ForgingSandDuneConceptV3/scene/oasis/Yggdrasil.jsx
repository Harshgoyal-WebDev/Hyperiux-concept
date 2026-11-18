"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ASSETS, P, SUN_DIR, zoneAt } from "../../config";
import { T } from "../../tuning";
import { TREE, WATER_Y, revealAt } from "../../world/oasis";
import { buildCrown, buildWood } from "../../world/yggdrasil";
import { attachPointer, pointer } from "../../pointer";
import { cubeY } from "../../world/oasisCamera";

// The Yggdrasil, at the heart of the oasis: public/models/yggdrasil.glb when
// it is there (fitted to TREE's height on its island), and until then a
// placeholder built here (world/yggdrasil.js) with the model's own bark and
// leaf textures (public/models/yggdrasil/).
//
// Its foliage stays a natural deep green, lit by the low sun; what glows is
// amber-orange — the tree is where the energy goes:
//   the bark's cracks       molten light flowing up the roots and the trunk
//                           (strongest low down, J.treeGlow)
//   the core                a hot heart in the trunk where the streaks meet,
//                           flaring as they do (J.corePulse)
//   the aura                a soft amber glow round the crown and a golden
//                           haze in it, seen first beyond the dunes (J.amber)
//   light                   warm point lights on the roots, the island and
//                           the water round it
//   embers                  motes of light drifting up round the trunk

// (the placeholder's textures come from the solid model's own set)
const TEX = "/models/yggdrasil/";
const ORANGE = new THREE.Color("#ff6a10");

// Does the tree's model exist yet? (Next serves an HTML 404 for missing
// files, so the content type is checked too.)
function useTreeAsset() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(STRANDS_GLB, { method: "HEAD" })
      .then((r) => r.ok && !(r.headers.get("content-type") || "").includes("text/html"))
      .catch(() => false)
      .then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

// The bark's cracks glow: its albedo's darkest lines (the cracks) carry an
// amber light that flows slowly upwards, strongest in the roots and the
// lower trunk.
function glowingBark(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBarkWorld;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vBarkWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uGlow;
        uniform float uTime;
        uniform vec3 uGlowColor;
        uniform vec3 uFoot;
        varying vec3 vBarkWorld;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          #ifdef USE_MAP
            vec3 texel = texture2D(map, vMapUv).rgb;
            lum = dot(texel, vec3(0.3, 0.59, 0.11));
          #endif
          float crack = 1.0 - smoothstep(0.012, 0.05, lum);
          float y = vBarkWorld.y - uFoot.y;
          float low = 1.0 - smoothstep(6.0, 46.0, y);
          float flow = 0.55 + 0.45 * sin(y * 0.35 - uTime * 1.6 + vBarkWorld.x * 0.05);
          totalEmissiveRadiance += uGlowColor * crack * uGlow * (0.25 + 0.75 * low) * flow * 3.5;
        }`
      );
  };
  material.customProgramCacheKey = () => "ygg-bark";
  return material;
}

// The crown's leaf cards (instanced): each card its atlas cell, its shade,
// and the crown's normal (lit as a mass); backlit by the low sun.
function crownMaterial(atlas, uniforms) {
  const material = new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aCell;
        attribute float aShade;
        attribute vec3 aNormal;
        uniform float uTime;
        varying float vShade;
        varying vec3 vLeafWorld;`
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
        vMapUv = uv * 0.5 + vec2(mod(aCell, 2.0), floor(aCell / 2.0)) * 0.5;
        vShade = aShade;`
      )
      .replace(
        "#include <defaultnormal_vertex>",
        `#include <defaultnormal_vertex>
        transformedNormal = normalize(normalMatrix * aNormal);`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec3 base = instanceMatrix[3].xyz;
          float ph = uTime * 0.7 + base.x * 0.05 + base.z * 0.04;
          transformed.xy += vec2(sin(ph), cos(ph * 1.3)) * 0.06;
        }`
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vLeafWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        reflectedLight.directSpecular *= 0.1;
        reflectedLight.indirectSpecular *= 0.08;`
      )
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uLeafTint;
        uniform float uGlow;
        uniform vec3 uGlowColor;
        uniform vec3 uCore;
        varying float vShade;
        varying vec3 vLeafWorld;`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb *= uLeafTint * vShade;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 toFrag = normalize(vLeafWorld - cameraPosition);
          float back = pow(max(dot(toFrag, uSunDir), 0.0), 3.0);
          totalEmissiveRadiance += diffuseColor.rgb * vec3(0.5, 1.0, 0.3) * uSunColor * back * 0.12;
          // the underside of the crown takes the amber light from the core
          float under = 1.0 - smoothstep(-6.0, 26.0, vLeafWorld.y - uCore.y - 22.0);
          totalEmissiveRadiance += uGlowColor * diffuseColor.g * under * uGlow * 1.6;
        }`
      );
  };
  material.customProgramCacheKey = () => "ygg-crown";
  return material;
}

// A soft round glow (for the aura, the haze and the core's flare).
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.16)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function PlaceholderTree({ tier, uniforms, onReady }) {
  const built = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const map = loader.load(`${TEX}bark_basecolor.jpg`);
    map.colorSpace = THREE.SRGBColorSpace;
    const normalMap = loader.load(`${TEX}bark_normal.jpg`);
    for (const t of [map, normalMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
    }
    const atlas = loader.load(`${TEX}leaf_atlas.png`);
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = 4;
    const bark = glowingBark(new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.92, color: "#b9a593" }), uniforms);
    const { wood, tips } = buildWood(tier.name === "low" ? 0.6 : 1);
    const crown = buildCrown(tips, tier.name === "high" ? 3400 : tier.name === "medium" ? 2600 : 1500);
    const card = new THREE.PlaneGeometry(1, 1);
    card.setAttribute("aCell", new THREE.InstancedBufferAttribute(crown.cell, 1));
    card.setAttribute("aShade", new THREE.InstancedBufferAttribute(crown.shade, 1));
    card.setAttribute("aNormal", new THREE.InstancedBufferAttribute(crown.normal, 3));
    const leaves = new THREE.InstancedMesh(card, crownMaterial(atlas, uniforms), crown.count);
    leaves.instanceMatrix.array.set(crown.matrices);
    leaves.instanceMatrix.needsUpdate = true;
    leaves.computeBoundingSphere();
    leaves.castShadow = tier.shadowMap > 0;
    return { wood, bark, leaves, card, textures: [map, normalMap, atlas] };
  }, [tier, uniforms]);
  useEffect(() => {
    onReady?.();
    return () => {
      built.wood.dispose();
      built.bark.dispose();
      built.card.dispose();
      built.leaves.material.dispose();
      built.leaves.dispose();
      built.textures.forEach((t) => t.dispose());
    };
  }, [built, onReady]);
  return (
    <group position={[TREE.x, WATER_Y - 0.6, TREE.z]}>
      <mesh geometry={built.wood} material={built.bark} castShadow={tier.shadowMap > 0} receiveShadow={tier.shadowMap > 0} />
      <primitive object={built.leaves} />
    </group>
  );
}

// The tree woven of light (public/models/yggdrasil-strands.glb, see
// yggdrasil-strands-metadata.json): filaments through the roots, the
// braided trunk and every limb and branch, fanning out of the branch tips
// into a crown of light-wisps — no bark, no leaves. Each vertex carries a
// flow coordinate (_flow: 0 at the root tips → 0.5 at the trunk's foot →
// 1 at the crown's tips) and a per-filament seed (_seed).
//   pulses     bright bands of energy flow up every filament, roots to tips
//   the fill   the tree lights up from the bottom: as the beam nears, the
//              roots and the trunk's foot glow; once it reaches the core the
//              light climbs the trunk, out along the branches and into the
//              crown (J.fill: the flow it has reached, with a bright front)
// Unlit and additive (its colours are a Hyperiux orange heat ramp baked
// into the vertices). Its origin is the trunk's centre on the ground plane,
// with the roots diving below; it is scaled by its skeleton (the solid
// model's 40 m, which it shares) to TREE.height and set with the ground
// plane just under the lake's surface.
export const STRANDS_GLB = "/models/yggdrasil-strands.glb";
const MODEL_SINK = 0.5; // metres the ground plane sits under the water
const SKELETON_HEIGHT = 40; // m, yggdrasil-metadata.json (the strands share it)

// (Drawn as HDR light over the scene, not added to it: added orange all but
// vanishes against the bright sunset sky, while HDR orange laid over it reads
// as saturated light and blooms.)
function strandMaterial(material, uniforms) {
  material.vertexColors = true;
  material.transparent = true;
  material.depthWrite = false;
  material.blending = THREE.NormalBlending;
  material.color.setScalar(1);
  material.side = THREE.DoubleSide;
  material.toneMapped = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float _flow;\nattribute float _seed;\nuniform float uTime;\nuniform float uGrow;\nuniform float uGrowJitter;\nuniform float uDrawLen;\nuniform vec3 uCubeC;\nuniform float uCubeH;\nuniform vec3 uRayO;\nuniform vec3 uRayD;\nuniform float uPush;\nuniform float uPushR;\nvarying float vFlow;\nvarying float vSeed;\nvarying float vClimb;")
      // how far up the tree a point is, for the light's climb: its height in
      // the model (−4.5 m, the deepest root, to 42.9 m, the crown's top) with
      // a little of its flow, so the roots' ends light just before their foot.
      // (By flow alone the roots — half its range, a short way up — took half
      // the climb, then the trunk and branches went by in a rush: two parts.)
      // ...and how it grows (and the light climbs it after): one front, the
      // whole tree at once from its deepest root (−4.5 m in the model) to the
      // crown's top (42.9 m) — each filament a little apart by its seed
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFlow = _flow;\nvSeed = _seed;\nvClimb = clamp((position.y + 4.5) / 47.4, 0.0, 1.0);"
      )
      // the cursor: strands near the line under it ease aside (out from the
      // line, in world metres; a slight quiver along each, by its seed),
      // turned back into the strand's own space (rotation × uniform scale)
      .replace(
        "#include <project_vertex>",
        `// the roots spun out of the cube: the newest stretch of each root
        // filament (just behind its growing tip) is drawn from the cube's
        // outline — the point of it facing this vertex — and eases out into
        // its place, so the roots stream out of the cube's lines; the trunk,
        // limbs and crown simply draw up from the bottom, on the same front
        if (uGrow < 0.999 && _flow < 0.5) {
          float grownV = uGrow * (1.0 + uGrowJitter) - _seed * uGrowJitter;
          float settle = clamp((grownV - vClimb) / uDrawLen, 0.0, 1.0);
          settle = 1.0 - pow(1.0 - settle, 3.0);
          vec3 pw0 = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vec3 dir = pw0 - uCubeC;
          vec3 ad = abs(dir);
          vec3 onCube = uCubeC + dir * (uCubeH / max(max(ad.x, max(ad.y, ad.z)), 1e-3));
          vec3 dw0 = (onCube - pw0) * (1.0 - settle);
          float s20 = dot(modelMatrix[0].xyz, modelMatrix[0].xyz);
          transformed += transpose(mat3(modelMatrix)) * dw0 / s20;
        }
        if (uPush > 0.0001) {
          vec3 pw = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vec3 rel = pw - uRayO;
          vec3 off = rel - uRayD * dot(rel, uRayD);
          float d = length(off);
          float k = (1.0 - smoothstep(0.0, uPushR, d)) * uPush * (0.85 + 0.15 * sin(uTime * 4.0 + _seed * 40.0 + position.y * 0.6));
          vec3 dw = off / max(d, 1e-3) * k;
          float s2 = dot(modelMatrix[0].xyz, modelMatrix[0].xyz);
          transformed += transpose(mat3(modelMatrix)) * dw / s2;
        }
        #include <project_vertex>`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uFill;\nuniform float uGrow;\nuniform float uGrowJitter;\nuniform float uGain;\nuniform float uPulse;\nuniform float uDim;\nuniform float uPulseSpeed;\nvarying float vFlow;\nvarying float vSeed;\nvarying float vClimb;"
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          // growing: each filament extends from the bottom up, strand by
          // strand (a little apart, by its seed), with a bright growing tip;
          // beyond its tip there is nothing yet
          float grown = uGrow * (1.0 + uGrowJitter) - vSeed * uGrowJitter;
          if (vClimb > grown) discard;
          float growTip = exp(-pow((grown - vClimb) / 0.012, 2.0)) * step(uGrow, 0.999);
          // how far the light has climbed: lit below the fill, a bright
          // front at it, the rest dim
          float lit = 1.0 - smoothstep(uFill - 0.04, uFill + 0.01, vClimb);
          float front = exp(-pow((vClimb - uFill) / 0.025, 2.0)) * step(0.001, uFill) * step(uFill, 0.999);
          // pulses of energy running up every filament
          float band = fract(vFlow * 3.0 - uTime * uPulseSpeed + vSeed * 0.15);
          float pulse = smoothstep(0.0, 0.06, band) * (1.0 - smoothstep(0.06, 0.22, band));
          float k = mix(uDim, 1.0, lit) * (0.75 + 2.2 * pulse * mix(0.25, 1.0, lit)) + front * 3.0 + uPulse * lit + growTip * 3.0;
          outgoingLight *= k * uGain * 4.0;
        }
        #include <opaque_fragment>
        // opaque where it is bright, thinning where it is faint
        gl_FragColor.a = clamp(max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)) * 0.9, 0.0, 1.0);`
      );
  };
  material.customProgramCacheKey = () => "ygg-strands";
  return material;
}

// The leaf crown (YGG_StrandLeaves: leaf cards cut from an atlas — the
// cosmic crown, periwinkle and violet with pink sparks and a teal glow
// underneath, unlit by design: yggdrasil-strands-metadata.json — with no
// vertex colours; drawn with the strands' material they came out black and
// see-through). Its own material: its own colours (tinted by
// T.treeLeafColor, white = as made), glowing brighter where the tree's
// light has climbed to them; and they grow in with the tree (the same front
// as the strands).
function leafMaterial(material, uniforms) {
  material.vertexColors = false;
  material.transparent = false;
  material.depthWrite = true;
  material.alphaTest = Math.max(material.alphaTest, 0.45);
  material.side = THREE.DoubleSide;
  material.toneMapped = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vLeafClimb;\nvarying float vLeafH;\nvarying float vLeafSeed;")
      // (vLeafH: its height on the tree's own scale — where the strands'
      // light reaches it; vLeafClimb: when it comes out — only once the
      // branches have drawn on past it, the last of them as the tree tops out)
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvLeafH = clamp((position.y + 4.5) / 47.4, 0.0, 1.0);\nvLeafClimb = 0.3 + 0.7 * vLeafH;\nvLeafSeed = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uFill;\nuniform float uGrow;\nuniform float uGrowJitter;\nuniform float uLeafBase;\nuniform float uLeafLit;\nuniform vec3 uLeafColor;\nuniform vec3 uGlowColor;\nvarying float vLeafClimb;\nvarying float vLeafH;\nvarying float vLeafSeed;"
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        // (not yet grown this far)
        if (vLeafClimb > uGrow * (1.0 + uGrowJitter) - vLeafSeed * uGrowJitter) discard;`
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          // the energy climbing the tree lights them as it passes: brighter
          // behind its front, and a warm glow at the front itself
          float leafLit = 1.0 - smoothstep(uFill - 0.04, uFill + 0.01, vLeafH);
          float leafFront = exp(-pow((vLeafH - uFill) / 0.035, 2.0)) * step(0.001, uFill) * step(uFill, 0.999);
          outgoingLight *= uLeafColor * (uLeafBase + uLeafLit * leafLit);
          outgoingLight += uGlowColor * leafFront * uLeafLit * 1.6 * max(max(outgoingLight.r, outgoingLight.g), max(outgoingLight.b, 0.25));
        }
        #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => "ygg-leaves";
  return material;
}

// A denser crown: the branch and crown-wisp filaments are drawn again,
// turned about the trunk and a touch smaller or larger, so the limbs come
// out of the braided trunk in more directions and the crown fills in.
const CROWN_COPIES = { high: [[3.1, 0.97]], medium: [], low: [] };

function StrandTree({ J, tier, uniforms, onReady }) {
  const gltf = useGLTF(STRANDS_GLB, ASSETS.draco);
  const object = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.scale.setScalar(TREE.height / SKELETON_HEIGHT);
    root.position.set(TREE.x, WATER_Y - MODEL_SINK, TREE.z);
    const crown = [];
    root.traverse((o) => {
      if (/StrandBranches|StrandCanopy/i.test(o.name) && o.parent) crown.push(o);
    });
    for (const node of crown) {
      for (const [turn, scale] of CROWN_COPIES[tier.name] || []) {
        const copy = node.clone(true);
        copy.rotation.y += turn;
        copy.scale.multiplyScalar(scale);
        node.parent.add(copy);
      }
    }

    const materials = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 4;
      o.frustumCulled = false;
      const leaves = /Leaves/i.test(o.name) || /Leaves/i.test(o.material.name);
      if (leaves) o.renderOrder = 3;
      if (!materials.has(o.material)) materials.set(o.material, leaves ? leafMaterial(o.material.clone(), uniforms) : strandMaterial(o.material.clone(), uniforms));
      o.material = materials.get(o.material);
    });
    return root;
  }, [gltf, tier, uniforms]);
  useEffect(() => onReady?.(), [object, onReady]);
  const push = useMemo(() => ({ ndc: new THREE.Vector2(), on: 0, ray: new THREE.Raycaster() }), []);
  useEffect(() => attachPointer(), []);
  // it grows out of the lake, strand by strand from the bottom up (not
  // scaled: its filaments extend — uGrow, tuning.js tlTreeGrowStart / End)
  useFrame(({ camera }, delta) => {
    const from = T.tlTreeGrowStart;
    const x = THREE.MathUtils.clamp((J.progress - from) / Math.max(T.tlTreeGrowEnd - from, 0.002), 0, 1);
    uniforms.uGrow.value = x;
    uniforms.uGrowJitter.value = T.treeGrowJitter;
    uniforms.uCubeC.value.set(TREE.x, cubeY(), TREE.z);
    uniforms.uCubeH.value = T.cubeSize * 0.5;
    uniforms.uDrawLen.value = T.treeDrawLength;
    object.visible = x > 0.0005 || J.warmup > 0;
    // the cursor's line through the scene (eased after the cursor: the
    // strands drift aside and settle back, never snap)
    const k = 1 - Math.exp(-delta * 7);
    push.ndc.x += ((pointer.active ? pointer.x : push.ndc.x) - push.ndc.x) * k;
    push.ndc.y += ((pointer.active ? pointer.y : push.ndc.y) - push.ndc.y) * k;
    push.on += ((pointer.active && x > 0.0005 ? 1 : 0) - push.on) * (1 - Math.exp(-delta * 3));
    push.ray.setFromCamera(push.ndc, camera);
    uniforms.uRayO.value.copy(push.ray.ray.origin);
    uniforms.uRayD.value.copy(push.ray.ray.direction);
    uniforms.uPush.value = T.strandPush * push.on;
    uniforms.uPushR.value = T.strandPushRadius;
  });
  return <primitive object={object} />;
}

export default function Yggdrasil({ J, tier, onReady }) {
  const hasModel = useTreeAsset();
  const group = useRef();
  const coreLight = useRef();
  const footLight = useRef();
  const uniforms = useMemo(
    () => ({
      uGlow: { value: 0 },
      uTime: { value: 0 },
      uGlowColor: { value: ORANGE.clone() },
      uFoot: { value: new THREE.Vector3(TREE.x, WATER_Y, TREE.z) },
      uCore: { value: TREE.core.clone() },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: new THREE.Color() },
      uLeafTint: { value: new THREE.Color() },
      // the strands
      uFill: { value: 0 },
      uGrow: { value: 0 },
      uGrowJitter: { value: 0.25 },
      // the cube the strands stream out of (world centre, half its edge),
      // and how much of the growth each filament's newest stretch takes to
      // ease out of it into place
      uCubeC: { value: new THREE.Vector3() },
      uCubeH: { value: 2 },
      uDrawLen: { value: 0.1 },
      // the cursor's line through the scene (origin, direction), how far
      // the strands round it move aside (m) and its reach (m)
      uRayO: { value: new THREE.Vector3() },
      uRayD: { value: new THREE.Vector3(0, 0, -1) },
      uPush: { value: 0 },
      uPushR: { value: 10 },
      uLeafBase: { value: 1 },
      uLeafLit: { value: 1.6 },
      uLeafColor: { value: new THREE.Color("#ffffff") },
      uGain: { value: 0.5 },
      uPulse: { value: 0 },
      uDim: { value: 0.12 },
      uPulseSpeed: { value: 0.25 },
    }),
    []
  );
  // the glows: aura round the crown, golden haze in it, the core's flare
  const glow = useMemo(() => {
    const map = glowTexture();
    const sprite = (scale, y, depthTest = true) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: ORANGE.clone(), blending: THREE.AdditiveBlending, depthWrite: false, depthTest, fog: false, transparent: true }));
      s.scale.setScalar(scale);
      s.position.set(TREE.x, y, TREE.z);
      s.renderOrder = 6;
      return s;
    };
    const aura = sprite(300, WATER_Y + 58);
    const haze = sprite(170, WATER_Y + 70);
    const core = sprite(26, TREE.core.y);
    const flare = sprite(60, TREE.core.y, false);
    return { map, aura, haze, core, flare };
  }, []);
  // embers drifting up round the trunk
  const embers = useMemo(() => {
    const n = tier.name === "low" ? 160 : 420;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    let a = 7;
    const rng = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const ang = rng() * Math.PI * 2;
      const r = 6 + Math.pow(rng(), 0.7) * 70;
      pos.set([TREE.x + Math.cos(ang) * r, WATER_Y + rng() * 70, TREE.z + Math.sin(ang) * r], i * 3);
      seed[i] = rng();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uK: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uScale;
        uniform float uK;
        varying float vA;
        void main() {
          vec3 p = position;
          float t = fract(aSeed * 7.3 + uTime * (0.02 + aSeed * 0.03));
          p.y += t * 40.0;
          p.x += sin(uTime * 0.6 + aSeed * 30.0) * 2.0;
          p.z += cos(uTime * 0.5 + aSeed * 20.0) * 2.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vA = uK * sin(t * 3.14159) * (0.4 + 0.6 * fract(aSeed * 13.1));
          gl_PointSize = clamp(0.5 * uScale / max(-mv.z, 1.0), 1.0, 6.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float m = 1.0 - smoothstep(0.1, 0.5, d);
          gl_FragColor = vec4(vec3(1.0, 0.55, 0.18) * 3.0 * m * vA, 1.0);
        }`,
    });
    return { geometry, material };
  }, [tier]);
  useEffect(
    () => () => {
      glow.map.dispose();
      [glow.aura, glow.haze, glow.core, glow.flare].forEach((s) => s.material.dispose());
      embers.geometry.dispose();
      embers.material.dispose();
    },
    [glow, embers]
  );

  useFrame(({ clock, gl }) => {
    // hidden behind the dunes until the passage is well under way (its glow
    // is seen first)
    const p = J.progress;
    // (and for the first frames, so its materials compile behind the loader)
    const show = p > P.through || J.warmup > 0;
    if (group.current) group.current.visible = show;
    if (!show) {
      if (coreLight.current) coreLight.current.intensity = 0;
      if (footLight.current) footLight.current.intensity = 0;
      return;
    }
    const t = clock.elapsedTime;
    // (its glows come up with it)
    const risen = revealAt(TREE.x, TREE.z, J.revealR - 30);
    const g = J.treeGlow * T.treeGlow * risen;
    uniforms.uTime.value = t;
    uniforms.uGlow.value = g;
    uniforms.uSunColor.value.set(T.sunColor).multiplyScalar(T.sunIntensity * T.leafGlow);
    uniforms.uLeafTint.value.set(T.leafTint);
    // (from the moment the beam touches a root — Streaks works out where in
    // the scroll that is — one steady climb to the crown, halfway through
    // the light opening onto the site)
    // (the light follows the growth up out of the cube: from the moment it
    // starts to the top of the crown)
    const from = T.tlTreeGrowStart;
    const to = T.tlTreeLightEnd;
    const fill = from > 0 && from < to ? THREE.MathUtils.clamp((J.progress - from) / (to - from), 0, 1) : 0;
    uniforms.uFill.value = T.strandFill >= 0 ? T.strandFill : fill;
    uniforms.uDim.value = T.strandDim;
    uniforms.uLeafBase.value = T.treeLeafGlow;
    uniforms.uLeafLit.value = T.treeLeafLit;
    uniforms.uLeafColor.value.set(T.treeLeafColor);
    uniforms.uPulseSpeed.value = T.strandPulseSpeed;
    // the same unlit state all over until the beam reaches the core; then
    // its light (the core's, the roots' on the water, the embers) comes up
    // as the glow climbs it — no flash
    uniforms.uGain.value = T.strandGain;
    uniforms.uPulse.value = 0;
    // (and not before the tree has grown up to its core: no light hanging
    // over the cube while only the roots are out)
    const grown = (p - T.tlTreeGrowStart) / Math.max(T.tlTreeGrowEnd - T.tlTreeGrowStart, 0.002);
    const lit = THREE.MathUtils.smoothstep(fill, 0.0, 0.35) * THREE.MathUtils.smoothstep(grown, 0.42, 0.55);
    // (the aura and the haze round the crown: all of it under treeAura — 0, none)
    const amber = J.amber * risen;
    glow.aura.material.color.copy(ORANGE).multiplyScalar((0.12 * amber + 0.1 * g * lit) * T.treeAura);
    glow.haze.material.color.set("#ffb05a").multiplyScalar((0.05 * amber + 0.05 * g * lit) * T.treeAura);
    glow.aura.visible = T.treeAura > 0.001;
    glow.haze.visible = T.treeAura > 0.001;
    glow.core.material.color.set("#ffb36b").multiplyScalar(0.5 * g * lit);
    glow.core.scale.setScalar(22);
    glow.flare.visible = false;
    if (coreLight.current) coreLight.current.intensity = g * lit * 1400 * T.treeLight;
    if (footLight.current) footLight.current.intensity = g * lit * 900 * T.treeLight;
    embers.material.uniforms.uTime.value = t;
    embers.material.uniforms.uScale.value = gl.domElement.height * 0.5;
    embers.material.uniforms.uK.value = Math.min(g, 1.2) * lit * T.embers;
  });

  return (
    <>
      {/* (always in the scene, at 0 until the tree glows: adding or removing
        a light would recompile every material) */}
      <pointLight ref={coreLight} position={TREE.core.toArray()} color="#ff8a3a" distance={320} decay={1.3} intensity={0} />
      <pointLight ref={footLight} position={[TREE.x, WATER_Y + 5, TREE.z]} color="#ff7a26" distance={140} decay={1.4} intensity={0} />
    <group ref={group} visible={false}>
      {hasModel === true && (
        <Suspense fallback={null}>
          <StrandTree J={J} tier={tier} uniforms={uniforms} onReady={onReady} />
        </Suspense>
      )}
      {hasModel === false && <PlaceholderTree tier={tier} uniforms={uniforms} onReady={onReady} />}
      <primitive object={glow.aura} />
      <primitive object={glow.haze} />
      <primitive object={glow.core} />
      <primitive object={glow.flare} />
      <points geometry={embers.geometry} material={embers.material} frustumCulled={false} />
    </group>
    </>
  );
}
