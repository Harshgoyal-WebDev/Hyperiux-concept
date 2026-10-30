"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js uniforms/objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ASSETS } from "../config";
import { T } from "../tuning";
import { CRACK_STAGES, FRONT_Z, MASK_RECT, SAND_NOISE_GLSL, SLAB_RECT, buildFractureMask, buildLogoMask, cubeHexagon, pieceProgress, prepareForge } from "../world/forgeAsset";
import { NOISE } from "../world/glsl";
import { pieceFlight, syncFlow } from "../world/breakup";

// The forging monolith: the authored slab (logo core + excess chunks), its
// crack network and the core sphere, all from the GLB. The logo core keeps
// its transform and material for the whole sequence; only the excess chunks
// move, and they wear away into the sand and gravel swirling round it.

// Basalt from the GLB (baked base colour / roughness / normal) plus: the
// sand-dune monolith's crack glow (the dark crack lines of the baked albedo
// light up behind a noisy front growing out from the core), the engraved
// outline of the mark (a shallow dark seam on the front face, from the SVG
// mask) and the energy along it, and orange heat inside the rhombus pocket.
// `local` is per material: how lit its cracks are (the excess rock's cool
// as it wears away, the logo core's stay lit) and whether the break lines
// glow (the excess rock only: the logo's own edges never do).
function patchStone(material, U, local, pieces) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, local);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute vec3 aRest;
        attribute float aPiece;
        uniform vec4 uPiece[${pieces}];
        varying vec3 vRest;
        varying vec3 vRestN;
        varying float vErode;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vRest = aRest;
        vRestN = objectNormal;
        // how far this vertex's piece has eroded into sand (the core: never)
        vErode = aPiece < -0.5 ? 0.0 : uPiece[int(aPiece + 0.5)].w;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uLogoMask;
        uniform vec4 uMaskRect;
        uniform float uEngrave;
        uniform float uHeat;
        uniform vec3 uCrackColor;
        uniform vec3 uCoreAsset;
        uniform float uCrackSpread;
        uniform float uCrackLevel;
        uniform float uFissureGlow;
        uniform float uSurge;
        uniform float uAssetScale;
        uniform sampler2D uFractureMask;
        uniform vec4 uFractureRect;
        uniform vec3 uHotColor;
        uniform float uBreakLines;
        varying vec3 vRest;
        varying vec3 vRestN;
        varying float vErode;
        uniform vec3 uSandTone;
        ${NOISE}
        ${SAND_NOISE_GLSL}`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        // Eroding into sand: stone below its piece's erosion is gone; a thin
        // rim at the wearing edge turns to sand-coloured grit.
        float sdEdge = 0.0;
        if (vErode > 0.0005) {
          float sdN = sandNoise(vRest);
          if (sdN < vErode) discard;
          sdEdge = 1.0 - smoothstep(0.0, 0.08, sdN - vErode);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSandTone, sdEdge * 0.8);
        }
        vec2 fgUv = (vRest.xy - uMaskRect.xy) / (uMaskRect.zw - uMaskRect.xy);
        float fgMask = texture2D(uLogoMask, clamp(fgUv, 0.0, 1.0)).r;
        // only on the front face (the mark is engraved there, not carved through)
        float fgFace = smoothstep(0.75, 0.95, normalize(vRestN + vec3(0.0, 0.0, 1e-5)).z) * (1.0 - smoothstep(0.03, 0.09, abs(vRest.z - ${FRONT_Z.toFixed(2)})));
        float fgSeam = 1.0 - abs(2.0 * fgMask - 1.0);
        fgSeam *= fgSeam * fgFace;
        diffuseColor.rgb *= 1.0 - fgSeam * uEngrave;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        // heat only on the pocket's inner walls, never the frame's front faces
        // the wearing edge is still warm from the energy
        totalEmissiveRadiance += uCrackColor * sdEdge * 0.35 * uCrackLevel;
        float fgPocket = (1.0 - smoothstep(0.3, 1.0, length(vRest - uCoreAsset))) * (1.0 - smoothstep(0.95, 1.15, vRest.z));
        totalEmissiveRadiance += uCrackColor * fgPocket * fgPocket * uHeat;
        // One energy front, growing out from the core once the beam reaches
        // it (the sand-dune monolith's front: metres at monument scale, with
        // a noisy edge and a brighter band where it is arriving).
        // (all of it skipped until the cracks need it)
        float ncLive = 0.0;
        if (uCrackSpread > 0.001 && uCrackLevel > 0.001) {
          vec3 ncP = vRest * uAssetScale;
          float ncDist = length(ncP - uCoreAsset * uAssetScale);
          float ncFront = uCrackSpread * 52.0 - ncDist + (ncNoise(ncP * 0.12) - 0.5) * 12.0;
          float ncReached = smoothstep(0.0, 5.0, ncFront);
          float ncEdge = smoothstep(0.0, 2.0, ncFront) * (1.0 - smoothstep(2.0, 7.0, ncFront));
          ncLive = (ncReached * (1.0 + uSurge) + ncEdge * 1.6) * uCrackLevel;
        }
        if (ncLive > 0.001) {
          // where the slab breaks: the fracture seams between pieces, on the
          // face and along the rims just behind it (excess rock only)
          vec2 frUv = (vRest.xy - uFractureRect.xy) / (uFractureRect.zw - uFractureRect.xy);
          float frM = texture2D(uFractureMask, clamp(frUv, 0.0, 1.0)).r;
          float frFace = smoothstep(0.75, 0.95, normalize(vRestN + vec3(0.0, 0.0, 1e-5)).z);
          float frRim = (1.0 - frFace) * exp(-max(${FRONT_Z.toFixed(2)} - vRest.z, 0.0) / 0.1);
          float frW = max(frFace, frRim);
          float frCore = smoothstep(0.35, 0.75, frM) * frW * uBreakLines;
          float frHalo = frM * frW * uBreakLines;
          // the stone's own cracks: thin lines darker than the stone around
          // them in the baked albedo
          float ncRaw = 0.0;
          #ifdef USE_MAP
            vec2 ncTs = vec2(3.0 / 2048.0);
            float ncC0 = dot(texture2D(map, vMapUv).rgb, vec3(0.3333));
            float ncCn = dot(
              texture2D(map, vMapUv + vec2(ncTs.x, 0.0)).rgb + texture2D(map, vMapUv - vec2(ncTs.x, 0.0)).rgb +
              texture2D(map, vMapUv + vec2(0.0, ncTs.y)).rgb + texture2D(map, vMapUv - vec2(0.0, ncTs.y)).rgb,
              vec3(0.0833));
            ncRaw = 1.0 - ncC0 / max(ncCn, 1e-4);
          #endif
          float ncThin = smoothstep(0.42, 0.8, ncRaw);
          float ncSoft = smoothstep(0.28, 0.6, ncRaw);
          // white-hot thin cores, orange falloff; bloom does the glow
          totalEmissiveRadiance += (uCrackColor * (frHalo * 1.0 + ncSoft * 0.5) + uHotColor * (frCore * 2.0 + ncThin * 1.2)) * ncLive * uFissureGlow;
          totalEmissiveRadiance = min(totalEmissiveRadiance, vec3(24.0));
        }`
      );
  };
  material.customProgramCacheKey = () => "forge-stone";
  material.needsUpdate = true;
}

// The crack strips: dark grooves while dormant; lit progressively by a front
// running along uv.x (distance from the core through the network, 0..1),
// with a hot leading edge, brightest along the middle of the strip (uv.y).
function crackMaterial(source, U, stage) {
  const m = source.clone();
  m.emissive.setRGB(0, 0, 0);
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -4;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, stage);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vCrackUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCrackUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uSpread;
        uniform float uStageGlow;
        uniform float uHead;
        uniform float uTime;
        uniform vec3 uCrackColor;
        uniform vec3 uHotColor;
        varying vec2 vCrackUv;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        float ckFront = uSpread * 1.06 - vCrackUv.x;
        float ckLit = smoothstep(0.0, 0.03, ckFront);
        float ckHead = smoothstep(-0.004, 0.006, ckFront) * (1.0 - smoothstep(0.006, 0.07, ckFront));
        // a thin white-hot core down the middle of the strip, orange around it
        // clamped: pow() of a negative is undefined (NaN → a bloom blob)
        float ckAcross = clamp(1.0 - abs(vCrackUv.y * 2.0 - 1.0), 0.0, 1.0);
        float ckSoft = ckAcross * ckAcross;
        float ckCore = pow(ckAcross, 6.0);
        float ckFlicker = 0.88 + 0.12 * sin(vCrackUv.x * 90.0 - uTime * 2.6);
        float ckI = ckLit * uStageGlow * ckFlicker + ckHead * uHead * 2.0;
        totalEmissiveRadiance += (uCrackColor * ckSoft * 1.4 + uHotColor * ckCore * 2.2) * ckI;
        totalEmissiveRadiance = min(totalEmissiveRadiance, vec3(24.0));`
      );
  };
  m.customProgramCacheKey = () => "forge-crack";
  return m;
}

// Soft radial glow for the core's halo.
function glowTexture() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(0.6, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function Forge({ J, shared, groundY, onReady }) {
  const gltf = useGLTF(ASSETS.forgeGlb, ASSETS.draco);
  const forge = useMemo(() => prepareForge(gltf.scene, groundY), [gltf, groundY]);

  const built = useMemo(() => {
    if (forge.missing) return null;
    const U = {
      uLogoMask: { value: buildLogoMask() },
      uMaskRect: { value: MASK_RECT },
      uEngrave: { value: 0.5 },
      uHeat: { value: 0 },
      uCrackColor: shared.uCrackColor,
      uCoreAsset: { value: forge.anchors.core.clone() },
      uTime: shared.uTime,
      uCrackSpread: { value: 0 },
      uFissureGlow: { value: 4 },
      uSurge: { value: 0 },
      uAssetScale: { value: forge.scale },
      uFractureMask: { value: buildFractureMask([forge.coreMeshes, ...forge.chunks.map((c) => [c.mesh])]) },
      uFractureRect: { value: SLAB_RECT },
      uHotColor: { value: new THREE.Color("#ffc47e") },
      // per piece: world position + erosion (forge.swirlSource, by reference)
      uPiece: { value: forge.swirlSource },
      uSandTone: { value: new THREE.Color("#a98a66") },
    };
    // per material: logo core vs excess rock (see patchStone)
    const coreLevel = { value: 0 };
    const excessLevel = { value: 0 };
    const coreLocal = { uCrackLevel: coreLevel, uBreakLines: { value: 0 } };
    const excessLocal = { uCrackLevel: excessLevel, uBreakLines: { value: 1 } };
    // The materials are made here and handed to the meshes in an effect
    // below, never assigned in this memo: React may run a memo twice (Strict
    // Mode in dev), and the meshes must end up with the materials whose
    // uniforms useFrame drives. Sources are the GLB's own materials, kept
    // aside by prepareForge, so a second run builds from the same originals.
    // the two baked basalt materials (logo core / excess), shared by their meshes
    const stoneMeshes = [...forge.coreMeshes, ...forge.chunks.map((c) => c.mesh)];
    const coreSources = new Set(forge.coreMeshes.map((m) => m.forgeSource));
    const stoneMaterials = new Map(
      [...new Set(stoneMeshes.map((m) => m.forgeSource))].map((src) => {
        const m = src.clone();
        patchStone(m, U, coreSources.has(src) ? coreLocal : excessLocal, forge.chunks.length);
        return [src, m];
      })
    );
    const assign = stoneMeshes.map((mesh) => [mesh, stoneMaterials.get(mesh.forgeSource)]);

    const stages = {};
    const crackMaterials = [];
    for (const name of CRACK_STAGES) {
      const list = forge.cracks[name];
      if (!list.length) continue;
      const stage = { uSpread: { value: 0 }, uStageGlow: { value: 0 }, uHead: { value: 0 } };
      const mat = crackMaterial(list[0].forgeSource, U, stage);
      for (const mesh of list) assign.push([mesh, mat]);
      stages[name] = stage;
      crackMaterials.push(mat);
    }

    // The core is a point of light, nothing else: the authored sphere mesh
    // is hidden; a white-hot point and an orange halo (plus the point light)
    // sit at its anchor.
    const glowMap = glowTexture();
    const sprite = (color) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowMap, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      sp.position.copy(forge.world.core);
      sp.renderOrder = 4;
      return sp;
    };
    const halo = sprite("#ff6a14");
    const point = sprite("#ffe2b8");

    // The breakup's impact: a shell of energy bursting out from the core
    // (bright at its rim, clear in the middle) and dissipating as it goes.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color("#ff8a3c") }, uLevel: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalMatrix * normal;
            vV = -mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uLevel;
          varying vec3 vN;
          varying vec3 vV;
          void main() {
            // (as the shell sweeps past the camera its surface comes right
            // up to it, where the view vector is nearly zero: normalised
            // carelessly that is NaN, which the bloom spreads over the whole
            // frame as a black flash)
            vec3 n = vN / max(length(vN), 1e-4);
            vec3 v = vV / max(length(vV), 1e-4);
            float rim = clamp(1.0 - abs(dot(n, v)), 0.0, 1.0);
            float a = (pow(rim, 3.0) * 1.6 + 0.04) * uLevel;
            gl_FragColor = vec4(uColor * a * 2.2, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
    );
    shell.position.copy(forge.world.core);
    shell.renderOrder = 6;
    shell.visible = false;

    // The cube outline's openings filled with light (not its walls): a
    // sheet cut to the outline's hexagon, inside the mark at the core's
    // depth — the outline's own strokes hide it everywhere but the gaps.
    const hex = cubeHexagon().map((v) => {
      const p = forge.toWorld(new THREE.Vector3(v.x, v.y, 0));
      return new THREE.Vector2(p.x, p.y);
    });
    const fill = new THREE.Mesh(
      new THREE.ShapeGeometry(new THREE.Shape(hex)),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
    );
    fill.position.z = forge.world.core.z;
    fill.renderOrder = 4;
    fill.visible = false;
    const fillColor = new THREE.Color("#ffc890");

    return { U, coreLevel, excessLevel, assign, fill, fillColor, stoneMaterials: [...stoneMaterials.values()], stages, crackMaterials, glowMap, halo, point, shell };
  }, [forge, shared]);

  useEffect(() => {
    if (forge.missing) {
      console.error(`[forging-concept] ${ASSETS.forgeGlb} is missing required parts: ${forge.missing.join(", ")}. The slab is not rendered.`);
      onReady?.(null, forge.missing);
      return;
    }
    onReady?.(forge);
  }, [forge, onReady]);

  // hand the materials to the meshes (see above)
  useLayoutEffect(() => {
    if (!built) return;
    for (const [mesh, material] of built.assign) {
      mesh.material = material;
      const crack = mesh.name.startsWith("Cracks_");
      mesh.castShadow = !crack;
      mesh.receiveShadow = true;
      if (crack) mesh.renderOrder = 1;
    }
    if (forge.sphere) forge.sphere.visible = false;
  }, [built, forge]);

  useEffect(
    () => () => {
      if (!built) return;
      built.U.uLogoMask.value.dispose();
      built.U.uFractureMask.value.dispose();
      built.stoneMaterials.forEach((m) => m.dispose());
      built.crackMaterials.forEach((m) => m.dispose());
      built.glowMap.dispose();
      built.halo.material.dispose();
      built.point.material.dispose();
      built.shell.geometry.dispose();
      built.shell.material.dispose();
      built.fill.geometry.dispose();
      built.fill.material.dispose();
    },
    [built]
  );

  // The slab whole: until the rock breaks, its ~66 chunks and their crack
  // strips are drawn as one mesh per material (merged in the forge's own
  // space, with the same per-vertex aRest / aPiece the stone shader reads),
  // not one draw each; the pieces themselves take over as it fractures.
  const whole = useRef(null);
  useLayoutEffect(() => {
    if (!built || forge.missing) return;
    const root = forge.object;
    root.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map(); // material → geometries (in root space)
    const take = (mesh) => {
      const g = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld));
      if (!groups.has(mesh.material)) groups.set(mesh.material, []);
      groups.get(mesh.material).push(g);
    };
    for (const c of forge.chunks) {
      take(c.mesh);
      for (const child of c.mesh.children) if (child.isMesh) take(child);
    }
    const meshes = [];
    let ok = true;
    for (const [material, geoms] of groups) {
      const merged = mergeGeometries(geoms, false);
      geoms.forEach((g) => g.dispose());
      if (!merged) {
        ok = false;
        break;
      }
      const m = new THREE.Mesh(merged, material);
      const crack = !built.stoneMaterials.includes(material);
      m.castShadow = !crack;
      m.receiveShadow = true;
      if (crack) m.renderOrder = 1;
      meshes.push(m);
    }
    if (!ok) {
      // (parts that don't merge: the pieces are drawn as they are)
      meshes.forEach((m) => m.geometry.dispose());
      return;
    }
    const group = new THREE.Group();
    meshes.forEach((m) => group.add(m));
    root.add(group);
    whole.current = group;
    return () => {
      root.remove(group);
      meshes.forEach((m) => m.geometry.dispose());
      whole.current = null;
    };
  }, [built, forge]);

  const coreLight = useRef();
  const pose = useMemo(() => ({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(), visible: true }), []);
  const lastFracture = useRef(-1);
  // a new forge: pose its pieces afresh
  useEffect(() => {
    lastFracture.current = -1;
  }, [forge]);

  useFrame((_, delta) => {
    // (nothing of it is on screen in the garden)
    if (!built || J.inGarden) return;
    const { U, stages, halo, point } = built;
    U.uCrackSpread.value = J.crackSpread * T.crackSpread;
    // the light filling the cube outline's openings
    const fill = J.innerGlow * T.innerGlow;
    built.fill.visible = fill > 0.001;
    built.fill.material.color.copy(built.fillColor).multiplyScalar(fill * 3);
    U.uFissureGlow.value = T.fissureGlow;
    U.uSurge.value = Math.min(J.sphere / 2, 1);
    built.coreLevel.value = J.logoCrackGlow;
    built.excessLevel.value = J.crackGlow;
    U.uEngrave.value = T.engrave;
    U.uHeat.value = (J.sphere * J.sphere * 0.9 + J.pulse * 1.6) * T.pocketHeat;

    const head = J.crackSpread > 0 && J.crackSpread * 1.25 < 1 ? 1 : 0;
    for (const name of CRACK_STAGES) {
      const s = stages[name];
      if (!s) continue;
      s.uSpread.value = J.crackSpread * 1.25;
      s.uHead.value = head * T.crackGlow;
      s.uStageGlow.value = (name === "LogoCore" ? J.logoCrackGlow : J.crackGlow) * T.crackGlow;
    }

    // Excess rock: blasted off round the mark, revolving faster and faster
    // in the swirl's orbits and grinding away into sand and gravel as it
    // spins (world/breakup.js). Each reports where it is, how it is turned,
    // its own progress and how far it has ground away: the stone shader,
    // the sand and gravel it turns into and the swirl follow.
    const f = J.fracture;
    // the streams the broken rock is carried round in: their clock (picking
    // up speed after the blast) and the panel's values
    syncFlow(Math.min(delta, 0.1), f);
    if (f !== lastFracture.current || f > 0) {
      lastFracture.current = f;
      const src = forge.swirlSource;
      const quat = forge.pieceQuat;
      const o = forge.object.position;
      const S = forge.scale;
      forge.chunks.forEach((c, i) => {
        const u = pieceProgress(c, f);
        forge.pieceProgress[i] = u;
        const erode = pieceFlight(forge, c, u, pose);
        const m = c.mesh;
        // (world → the asset space the mesh lives in)
        m.position.copy(pose.position).sub(o).divideScalar(S);
        m.quaternion.copy(pose.quaternion);
        m.scale.copy(pose.scale);
        m.visible = erode < 0.999;
        // a piece mostly gone to sand no longer casts a solid shadow
        m.castShadow = erode < 0.45;
        // its crack strips go with the stone they were on
        for (const child of m.children) child.visible = erode < 0.25;
        src[i].set(pose.position.x, pose.position.y, pose.position.z, erode);
        quat[i].set(pose.quaternion.x, pose.quaternion.y, pose.quaternion.z, pose.quaternion.w);
      });
    }
    // the slab whole until it fractures (see above)
    if (whole.current) {
      const intact = f <= 0;
      whole.current.visible = intact;
      if (intact) for (const c of forge.chunks) c.mesh.visible = false;
    }

    const glow = J.sphere * T.sphereGlow;
    const r = 0.3 * forge.scale;
    // the point: small and white-hot; the halo: wide and orange
    point.scale.setScalar(r * (0.9 + 1.3 * Math.min(glow, 2.4) + 3 * J.pulse));
    // (kept at full strength as the camera comes close: on the way to the
    // garden it flies into this light)
    point.material.opacity = Math.min(0.35 + glow * 0.5 + J.pulse, 1);
    halo.scale.setScalar(r * (3 + 4 * Math.min(glow, 2.4) + 8 * J.pulse));
    halo.material.opacity = Math.min(0.2 + glow * 0.45 + J.pulse * 0.8, 1);
    halo.material.color.set(T.crackColor);

    // the impact: the shell bursts out and fades, the core flares
    const burst = J.breakBurst;
    built.shell.visible = burst > 0.002;
    if (built.shell.visible) {
      const x = THREE.MathUtils.clamp(f / Math.max(T.breakBurstEnd, 0.01), 0, 1);
      built.shell.scale.setScalar(4 + (1 - Math.pow(1 - x, 3)) * T.streamRadius * T.breakSpread);
      built.shell.material.uniforms.uLevel.value = burst * T.breakImpact;
      built.shell.material.uniforms.uColor.value.set(T.crackColor);
      halo.scale.multiplyScalar(1 + burst * 5 * T.breakImpact);
      point.material.opacity = Math.min(point.material.opacity + burst, 1);
    }
    if (coreLight.current) {
      coreLight.current.intensity = (40 + glow * glow * 520 + J.pulse * 1800 + J.innerGlow * 90 + burst * 4000 * T.breakImpact) * T.coreLight;
      coreLight.current.color.set(T.crackColor);
    }
  });

  if (!built) return null;
  const w = forge.world;
  return (
    <>
      <primitive object={forge.object} />
      <primitive object={built.halo} />
      <primitive object={built.point} />
      <primitive object={built.shell} />
      <primitive object={built.fill} />
      <pointLight ref={coreLight} distance={70} decay={2} position={[w.core.x, w.core.y, w.core.z + 1.6]} />
    </>
  );
}
