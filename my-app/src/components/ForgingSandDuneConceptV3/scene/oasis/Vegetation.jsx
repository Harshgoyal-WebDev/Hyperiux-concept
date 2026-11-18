"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NO_MIRROR_LAYER, P, SUN_DIR } from "../../config";
import { T } from "../../tuning";
import { mulberry32 } from "../../world/layout";
import { BASIN, S_ENTRANCE, S_RIM, WATER_Y, floorHalfWidth, oasisAt, route } from "../../world/oasis";
import { buildBroadleaf, buildRoundTree, clumpGeometry, frondTexture, rockGeometry, setGrowPace, tuftGeometry } from "../../world/plants";
import { REVEAL_GLSL, revealStartAt } from "../../world/revealMap";
import { createStoneMaterial } from "../../world/materials";

// The oasis's life, coming in along the passage (world/oasis.js lifeAt):
// first a few dry shrubs and rocks on the bare sand, then — as the stream
// appears — reeds at the water's edge, grass on the banks, bushes, date
// palms and broadleaf trees, thickening all the way to the round oasis,
// where palms and green ring the lake. Every kind is instanced, in chunks
// along the way so what is behind the camera is culled. Kept clear of the
// camera's line (it travels low along the route) and of the tree's island.

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
const bump = (x, a, b, c, d) => smooth(a, b, x) * (1 - smooth(c, d, x));

// How likely each kind is at a point of the oasis (o: oasisAt), and how
// many of it there are at full density.
const SEEN_FROM = 470; // route metres

const KINDS = {
  grass: { n: 20000, at: (o) => Math.pow(o.life, 0.7) * bump(o.w, 0.1, 0.6, 6, 15) * (o.e < 3 ? 1 : 0) * (o.r < BASIN.island - 5 ? 0 : 1) },
  reeds: { n: 3000, at: (o) => o.life * bump(o.w, -1.4, -0.6, 0.8, 2.4) * (o.r > BASIN.island + 2 ? 1 : 0) },
  bushes: { n: 2600, at: (o) => o.life * bump(o.w, 0.8, 2, 12, 28) * (o.e < 5 ? 1 : 0) * (o.r > BASIN.island + 8 ? 1 : 0) },
  shrubs: { n: 260, at: (o) => (o.s > S_ENTRANCE - 50 ? 1 : 0) * (0.25 + 0.75 * (1 - o.life)) * bump(o.e, -40, -20, 8, 20) * (o.w > 3 ? 1 : 0) * 0.5 },
  // (by the stream, broadleaf and rounded shade trees; the palms stand back
  // from the water, towards the dunes, and ring the lake)
  palms: { n: 0, at: (o) => (o.s > 220 || o.basin ? 1 : 0) * Math.pow(o.life, 1.3) * bump(o.w, o.basin ? 4 : 16, o.basin ? 7 : 22, 40, 60) * (o.e < 2 ? 1 : 0) * (o.d > 9 ? 1 : 0) * (o.r > BASIN.island + 12 ? 1 : 0) },
  broadleaf: { n: 300, at: (o) => (o.s > 160 || o.basin ? 1 : 0) * smooth(0.15, 0.6, o.life) * bump(o.w, 2.5, 5, o.basin ? 18 : 16, o.basin ? 34 : 30) * (o.e < 0 ? 1 : 0) * (o.d > 13 ? 1 : 0) * (o.r > BASIN.island + 16 ? 1 : 0) },
  rocks: { n: 170, at: (o) => (o.s > 90 ? 1 : 0) * bump(o.e, -60, -30, 10, 26) * (0.35 + 0.65 * (1 - o.life * 0.7)) * (o.w > -1.4 ? 1 : 0) * (o.d > 4 ? 1 : 0) * 0.6 },
};

// a random point of the oasis's floor (and the dunes' foot): along the
// passage, or in the round oasis
function candidate(rng, out) {
  // (only the stretch the camera travels after the cut — it lands at
  // oasisCamera S_LAND — and a little behind it: nothing is spent on the
  // way it never sees)
  const passageArea = (S_RIM - SEEN_FROM) * 2 * 30;
  const basinArea = Math.PI * (BASIN.floor + 20) ** 2;
  if (rng() < passageArea / (passageArea + basinArea)) {
    const s = SEEN_FROM + rng() * (S_RIM - SEEN_FROM);
    const p = route.getPointAt(Math.min(s / route.getLength(), 1));
    const t = route.getTangentAt(Math.min(s / route.getLength(), 1));
    const reach = floorHalfWidth(s) + 22;
    const lat = (rng() * 2 - 1) * reach;
    out.set(p.x - t.z * lat, 0, p.z + t.x * lat);
  } else {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * (BASIN.floor + 20);
    out.set(BASIN.x + Math.cos(a) * r, 0, BASIN.z + Math.sin(a) * r);
  }
  return out;
}

// chunk a point falls in (culled as a whole): stretches of the passage, and
// quarters of the round oasis
function chunkOf(o, x, z) {
  if (o.r < BASIN.floor + 30) return `b${(Math.atan2(z - BASIN.z, x - BASIN.x) > 0 ? 2 : 0) + (x > BASIN.x ? 1 : 0)}`;
  return `p${Math.floor(o.s / 140)}`;
}

export function scatter(terrain, veg) {
  const rng = mulberry32(911);
  const lists = Object.fromEntries(Object.keys(KINDS).map((k) => [k, []]));
  const want = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, Math.round(v.n * (k === "rocks" ? 1 : veg))]));
  const p = new THREE.Vector3();
  const o = {};
  const keys = Object.keys(KINDS);
  for (let it = 0; it < 700000; it++) {
    candidate(rng, p);
    oasisAt(p.x, p.z, o);
    if (!o.inside) continue;
    let done = true;
    for (const k of keys) {
      if (lists[k].length >= want[k]) continue;
      done = false;
      // (relative odds: grass is common, trees rare)
      const odds = KINDS[k].n / 20000;
      if (rng() < KINDS[k].at(o) * odds) {
        const y = terrain.height(p.x, p.z);
        lists[k].push({ x: p.x, y: Math.max(y, k === "reeds" ? WATER_Y - 0.6 : -Infinity), z: p.z, chunk: chunkOf(o, p.x, p.z), life: o.life, w: o.w, basin: o.basin ? 1 : 0, r: rng(), r2: rng(), r3: rng() });
        break;
      }
    }
    if (done) break;
  }
  return lists;
}

// Every plant grows as the oasis comes up round it (world/revealMap.js) —
// not scaled up from nothing: each part comes out of the point it grows
// from, in its own turn (world/plants.js aGrow / aAnchor): a tuft's blades
// one by one, lengthening from their roots; a tree's trunk rising, its
// limbs reaching out of it, its leaves unfolding from their clumps, bottom
// to top. Plants wait their turn a little, in patches (a few clumps first,
// then the rest, as the reference's), and so does their shadow (GROW_DEPTH).
const GROW = /* glsl */ `
  {
    vec3 ncBase = vec3(0.0);
    #ifdef USE_INSTANCING
      ncBase = instanceMatrix[3].xyz;
    #endif
    float ncH = fract(sin(dot(ncBase.xz, vec2(12.9898, 78.233))) * 43758.5453);
    float ncClump = fract(sin(dot(floor(ncBase.xz / 9.0), vec2(39.3468, 11.135))) * 24634.6345);
    float ncTurn = (0.6 * ncClump + 0.4 * ncH) * aGrow.w;
    float ncG = clamp((uOasisReveal.z - revealStart(ncBase.xz) - ncTurn) / max(aGrow.z, 1.0), 0.0, 1.0);
    float ncK = smoothstep(aGrow.x, aGrow.y, ncG);
    transformed = aAnchor + (transformed - aAnchor) * ncK * (1.0 + 0.1 * sin(3.14159 * ncK));
  }`;
// (far: beyond this many metres from the camera a plant isn't drawn at
// all — the low plants are too small to tell at a distance)
function growVertex(shader, uniforms, far = 0) {
  shader.uniforms.uOasisReveal = uniforms.uOasisReveal;
  shader.uniforms.uRevealMap = uniforms.uRevealMap;
  shader.uniforms.uRevealRect = uniforms.uRevealRect;
  const cull = far > 0 ? `\n#ifdef USE_INSTANCING\nif (distance(instanceMatrix[3].xyz, cameraPosition) > ${far.toFixed(1)}) transformed *= 0.0;\n#endif` : "";
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\nattribute vec4 aGrow;\nattribute vec3 aAnchor;\n${REVEAL_GLSL}`)
    .replace("#include <begin_vertex>", `#include <begin_vertex>\n${GROW}${cull}`);
}
// the shadow of a growing plant (alpha-tested like the plant)
function growDepth(uniforms, { map = null, alphaTest = 0 } = {}) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest });
  m.onBeforeCompile = (shader) => growVertex(shader, uniforms);
  m.customProgramCacheKey = () => `oasis-grow-depth-${!!map}`;
  return m;
}

// Plants barely shine: at these low albedos even the standard 4% specular
// sheen of the bright sky outweighs their colour and greys them out (the
// "faded" look), so it is cut right down.
const MATTE = /* glsl */ `#include <lights_fragment_end>
        reflectedLight.directSpecular *= 0.1;
        reflectedLight.indirectSpecular *= 0.08;`;
export function matte(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    if (uniforms) growVertex(shader, uniforms);
    shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_end>", MATTE);
  };
  material.customProgramCacheKey = () => `oasis-matte-${!!uniforms}`;
  return material;
}

// Leaves (and fronds, and grass) let the low sun through: lit from behind
// they glow a warm green. Plus a little wind.
function foliage(material, { sway = 0.06, translucency = 1, swayFrom = 0, far = 0 } = {}, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    growVertex(shader, uniforms, far);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTime;
        varying vec3 vFolWorld;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec3 base = vec3(0.0);
          #ifdef USE_INSTANCING
            base = instanceMatrix[3].xyz;
          #endif
          float h = max(transformed.y - ${swayFrom.toFixed(2)}, 0.0);
          float ph = uTime * 1.3 + base.x * 0.07 + base.z * 0.05;
          transformed.x += (sin(ph) * 0.7 + sin(ph * 2.3 + transformed.z) * 0.3) * ${sway.toFixed(3)} * h;
          transformed.z += sin(ph * 0.8 + 1.7) * ${(sway * 0.6).toFixed(3)} * h;
        }`
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        {
          vec4 fw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fw = instanceMatrix * fw;
          #endif
          vFolWorld = (modelMatrix * fw).xyz;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <lights_fragment_end>", MATTE)
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vFolWorld;`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 toFrag = normalize(vFolWorld - cameraPosition);
          float back = pow(max(dot(toFrag, uSunDir), 0.0), 3.0);
          // (light through a leaf comes out greener)
          totalEmissiveRadiance += diffuseColor.rgb * vec3(0.5, 1.0, 0.3) * uSunColor * back * ${(0.12 * translucency).toFixed(3)};
        }`
      );
  };
  material.customProgramCacheKey = () => `oasis-foliage-${sway}-${translucency}-${swayFrom}-${far}`;
  return material;
}

export default function Vegetation({ J, tier, shared, terrain }) {
  const group = useRef();
  const foliageAt = useRef(-1); // the brightness the plants' colours are at
  const atlas = useMemo(() => {
    const t = new THREE.TextureLoader().load("/models/yggdrasil/leaf_atlas.png");
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  // the trunks wear the tree's bark (the palms' stretched along them)
  const barkMap = useMemo(() => {
    const t = new THREE.TextureLoader().load("/models/yggdrasil/bark_basecolor.jpg");
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }, []);
  const built = useMemo(() => {
    const lists = scatter(terrain, tier.veg);
    const uniforms = { uTime: shared.uTime, uSunDir: { value: SUN_DIR.clone() }, uSunColor: { value: new THREE.Color() }, uOasisReveal: shared.uOasisReveal, uRevealMap: shared.uRevealMap, uRevealRect: shared.uRevealRect };
    const frond = frondTexture();
    const mats = {
      // (albedos are low: this desert is lit by a strong low sun — the sand
      // itself is ~0.025 — so a plant at a "normal" albedo would glare)
      leaf: foliage(new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.9, color: new THREE.Color(0.3, 0.3, 0.3) }), { sway: 0.035 }, uniforms),
      frond: foliage(new THREE.MeshStandardMaterial({ map: frond, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85, color: new THREE.Color(0.22, 0.24, 0.2) }), { sway: 0.03, swayFrom: 9 }, uniforms),
      grass: foliage(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9, color: new THREE.Color(0.15, 0.17, 0.12) }), { sway: 0.16, translucency: 1.3, far: 170 }, uniforms),
      // (the bushes' own leaves: drawn only within a few hundred metres)
      bushLeaf: foliage(new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.9, color: new THREE.Color(0.3, 0.3, 0.3) }), { sway: 0.035, far: 300 }, uniforms),
      wood: matte(new THREE.MeshStandardMaterial({ map: barkMap, vertexColors: true, roughness: 0.95, color: new THREE.Color(0.32, 0.3, 0.28) }), uniforms),
      bark: matte(new THREE.MeshStandardMaterial({ map: barkMap, roughness: 0.95, color: new THREE.Color(0.28, 0.25, 0.22) }), uniforms),
      rock: createStoneMaterial(shared, { color: "#4c3b2e" }).material,
    };
    // geometry: three palms, two broadleaf trees, bush and shrub clumps, a tuft, two rocks
    const palms = []; // (no palms: broadleaf and rounded trees only)
    // two acacia-like spreading trees, two rounded shade trees
    const broad = [buildBroadleaf(5), buildRoundTree(13), buildBroadleaf(9), buildRoundTree(21)];
    const bush = clumpGeometry({ cards: 18, radius: 1.5, height: 1.3, size: 1.4, lift: 0.3, seed: 31 });
    const shrub = clumpGeometry({ cards: 10, radius: 0.9, height: 0.7, size: 0.95, lift: 0.1, seed: 37 });
    const tuft = tuftGeometry({ blades: 5, height: 0.8, seed: 9 });
    const reed = tuftGeometry({ blades: 6, height: 2.0, spread: 0.25, seed: 13 });
    const rocks = [rockGeometry(1), rockGeometry(2)];
    // how long each kind takes to grow, and may wait its turn (the reveal's clock)
    for (const b of broad) {
      setGrowPace(b.trunk, 120, 45);
      setGrowPace(b.crown, 120, 45);
    }
    setGrowPace(bush, 70, 60);
    setGrowPace(shrub, 60, 60);
    setGrowPace(tuft, 45, 65);
    setGrowPace(reed, 55, 50);

    // their shadows grow with them
    const depth = {
      solid: growDepth(uniforms),
      leaf: growDepth(uniforms, { map: atlas, alphaTest: 0.5 }),
      frond: growDepth(uniforms, { map: frond, alphaTest: 0.4 }),
    };
    const depthFor = (material) => (material === mats.leaf ? depth.leaf : material === mats.frond ? depth.frond : depth.solid);
    const meshes = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const color = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    // one instanced mesh per (geometry, chunk)
    const add = (geometry, material, items, place, { shadow = false, tint } = {}) => {
      const chunks = new Map();
      for (const it of items) {
        if (!chunks.has(it.chunk)) chunks.set(it.chunk, []);
        chunks.get(it.chunk).push(it);
      }
      for (const list of chunks.values()) {
        const mesh = new THREE.InstancedMesh(geometry, material, list.length);
        list.forEach((it, i) => {
          place(it, pos, q, s);
          mesh.setMatrixAt(i, m.compose(pos, q, s));
          if (tint) mesh.setColorAt(i, tint(it, color));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = shadow && tier.shadowMap > 0;
        // (the low plants stay out of the water's mirror)
        if (!shadow) mesh.layers.set(NO_MIRROR_LAYER);
        // (the rocks were always there: only the plants grow)
        if (material !== mats.rock) mesh.customDepthMaterial = depthFor(material);
        mesh.receiveShadow = false;
        // (where its plants stand: it isn't drawn until the oasis starts
        // coming up at the first of them — see useFrame)
        mesh.userData.at = list.map((it) => [it.x, it.z]);
        mesh.userData.from = -1;
        meshes.push(mesh);
      }
    };
    const turn = (it, qq, tilt = 0) => qq.setFromAxisAngle(up, it.r * Math.PI * 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (it.r2 - 0.5) * tilt));

    // palms: three variants
    palms.forEach((pv, vi) => {
      const items = lists.palms.filter((_, i) => i % palms.length === vi);
      const place = (it, p, qq, ss) => {
        p.set(it.x, it.y, it.z);
        turn(it, qq);
        ss.setScalar(0.75 + it.r3 * 0.5);
      };
      add(pv.trunk, mats.wood, items, place, { shadow: true });
      add(pv.crown, mats.frond, items, place, { shadow: true, tint: (it, c) => c.setRGB(0.55 + it.r2 * 0.2, 0.75 + it.r3 * 0.2, 0.4) });
    });
    broad.forEach((bv, vi) => {
      const items = lists.broadleaf.filter((_, i) => i % broad.length === vi);
      const place = (it, p, qq, ss) => {
        p.set(it.x, it.y, it.z);
        turn(it, qq);
        // (trees, not bushes: sized at random, and bigger still round the
        // lake, the oasis's wide heart, than along the stream)
        ss.setScalar((it.basin ? T.oasisTreeSize * 1.35 : T.oasisTreeSize) * (0.7 + Math.pow(it.r3, 1.3) * 0.95));
      };
      add(bv.trunk, mats.bark, items, place, { shadow: true });
      add(bv.crown, mats.leaf, items, place, { shadow: true, tint: (it, c) => c.setRGB(0.3 + it.r * 0.1, 0.55 + it.r2 * 0.12, 0.2) });
    });
    add(bush, mats.bushLeaf, lists.bushes, (it, p, qq, ss) => {
      p.set(it.x, it.y - 0.2, it.z);
      turn(it, qq, 0.2);
      ss.set(0.8 + it.r3 * 0.9, 0.7 + it.r2 * 0.6, 0.8 + it.r3 * 0.9);
    }, { tint: (it, c) => c.setRGB(0.28 + it.r * 0.1, 0.5 + it.r2 * 0.15, 0.18) });
    add(shrub, mats.bushLeaf, lists.shrubs, (it, p, qq, ss) => {
      p.set(it.x, it.y - 0.1, it.z);
      turn(it, qq, 0.2);
      ss.setScalar(0.6 + it.r3 * 0.7);
    }, { tint: (it, c) => c.setRGB(0.42, 0.36, 0.2) }); // dry, olive-brown
    add(tuft, mats.grass, lists.grass, (it, p, qq, ss) => {
      p.set(it.x, it.y - 0.05, it.z);
      turn(it, qq, 0.3);
      ss.setScalar(0.55 + it.r3 * 0.7);
    }, { tint: (it, c) => c.setRGB(0.8 + it.r2 * 0.35, 0.85 + it.r3 * 0.3, 0.6) });
    add(reed, mats.grass, lists.reeds, (it, p, qq, ss) => {
      p.set(it.x, it.y, it.z);
      turn(it, qq, 0.2);
      ss.set(0.8, 0.7 + it.r3 * 0.6, 0.8);
    }, { tint: (it, c) => c.setRGB(0.75, 0.82, 0.55) });
    rocks.forEach((rg, vi) => {
      const items = lists.rocks.filter((_, i) => i % rocks.length === vi);
      add(rg, mats.rock, items, (it, p, qq, ss) => {
        const sc = it.r3 < 0.15 ? 2.2 + it.r2 * 2.5 : 0.45 + it.r2 * 1.3;
        p.set(it.x, it.y - sc * 0.25, it.z);
        qq.setFromEuler(new THREE.Euler((it.r - 0.5) * 0.5, it.r2 * 6.28, (it.r3 - 0.5) * 0.4));
        ss.set(sc, sc * (0.6 + it.r * 0.5), sc * (0.8 + it.r3 * 0.4));
      }, { shadow: true });
    });
    // (their base colours, for the brightness control)
    for (const m of Object.values(mats)) m.userData.base = m.color.clone();
    const geometries = [...palms.flatMap((v) => [v.trunk, v.crown]), ...broad.flatMap((v) => [v.trunk, v.crown]), bush, shrub, tuft, reed, ...rocks];
    return { meshes, mats, geometries, frond, uniforms, depth };
  }, [terrain, tier, shared, atlas, barkMap]);

  // (rebuilt plants start from their base colours)
  useEffect(() => {
    foliageAt.current = -1;
  }, [built]);
  useEffect(
    () => () => {
      built.meshes.forEach((m) => m.dispose());
      built.geometries.forEach((g) => g.dispose());
      Object.values(built.mats).forEach((m) => m.dispose());
      Object.values(built.depth).forEach((m) => m.dispose());
      built.frond.dispose();
      atlas.dispose();
      barkMap.dispose();
    },
    [built, atlas, barkMap]
  );

  useFrame(() => {
    if (group.current) group.current.visible = J.progress > P.pass || J.warmup > 0;
    // A patch of plants is drawn only once the oasis has started coming up
    // at its first plant (world/revealMap.js): before, it runs its growing
    // shader every frame for plants of no size at all — through the cut and
    // all the way down the bare valley, the oasis's lag.
    const R = J.revealR;
    for (const m of built.meshes) {
      const d = m.userData;
      if (!d.at) continue;
      if (d.from < 0 && R > 0) {
        let lo = Infinity;
        for (const [x, z] of d.at) lo = Math.min(lo, revealStartAt(x, z));
        d.from = lo;
      }
      m.visible = J.warmup > 0 || (d.from >= 0 && R > d.from);
    }
    built.uniforms.uSunColor.value.set(T.sunColor).multiplyScalar(T.sunIntensity * T.leafGlow);
    if (foliageAt.current !== T.foliage) {
      foliageAt.current = T.foliage;
      for (const k of ["leaf", "bushLeaf", "frond", "grass", "wood", "bark"]) built.mats[k].color.copy(built.mats[k].userData.base).multiplyScalar(T.foliage);
    }
  });

  return (
    <group ref={group} visible={false}>
      {built.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
