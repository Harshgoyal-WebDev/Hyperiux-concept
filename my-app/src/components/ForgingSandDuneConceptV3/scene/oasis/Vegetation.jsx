"use client";
/* eslint-disable react-hooks/immutability -- R3F pattern: three.js objects are mutated imperatively inside useFrame, outside React's render. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NO_MIRROR_LAYER, P, SUN_DIR } from "../../config";
import { T } from "../../tuning";
import { mulberry32 } from "../../world/layout";
import { BASIN, S_ENTRANCE, S_RIM, WATER_Y, floorHalfWidth, oasisAt, route } from "../../world/oasis";
import { blossomGeometry, boulderGeometry, buildBroadleaf, buildRoundTree, clumpGeometry, flowerClumpGeometry, frondTexture, rockGeometry, setGrowPace, tuftGeometry } from "../../world/plants";
import { REVEAL_GLSL, revealStartAt } from "../../world/revealMap";
import { createStoneMaterial } from "../../world/materials";
import { attachPointer } from "../../pointer";
import { BLOOM_GLSL, createBloom, stepBloom } from "./bloom";

// The oasis's life. Along the valley (no stream now) only dry shrubs and
// rocks — boulders in clusters at the dunes' feet, drawn from the first, as
// the camera travels it before the reveal; at the entrance a wall of trees
// and bushes, a lane left for the camera; round the lake dense trees and
// bushes, many in flower, and wild flowers on the banks; on the island
// grass, flower patches and dark boulders and pebbles, the trunk's foot
// left bare. The flowers bloom under the cursor (./bloom.js). Every kind is
// instanced, in chunks so what is out of view is culled, and comes up with
// the oasis's reveal (the rocks excepted: they are there from the first).

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};
const bump = (x, a, b, c, d) => smooth(a, b, x) * (1 - smooth(c, d, x));

// ---------------------------------------------------------------------------
// Tunables (counts are at full density: × the tier's veg share, but the
// rocks)
// ---------------------------------------------------------------------------
// round the lake
const BASIN_TREES = 540; // broadleaf and rounded trees (was 300; 720 was too heavy)
const BASIN_BUSHES = 2800; // (was 2600; 3800 was too heavy)
const BASIN_TREE_BAND = [2, 4.5, 34, 50]; // m from the water: in from … full … thinning … out
const TREE_BLOSSOM_SHARE = 0.45; // of the trees that are in flower
const BUSH_BLOSSOM_SHARE = 0.45; // of the bushes that are in flower
const BANK_FLOWERS = 1100; // wild-flower clumps on the banks round the lake (in patches)
// the island (round the Yggdrasil's foot)
const ISLAND_CLEAR = 10; // m round the trunk's foot left bare
const ISLAND_GRASS = 5200; // grass tufts (taller: ISLAND_GRASS_TALL)
const ISLAND_FLOWERS = 1200; // wild-flower clumps (in patches)
const ISLAND_BOULDERS = 75; // dark rounded boulders (some in clusters, some at the water's edge)
const ISLAND_PEBBLES = 900;
const ISLAND_CENTER_BOULDERS = 60; // ...and more of them gathered in towards the middle, round the trunk's foot
const ISLAND_CENTER_FROM = 6.5; // m from the centre they start at
const ISLAND_GRASS_TALL = 2.1; // the island's grass: this much taller than the banks'...
const ISLAND_FLOWER_SCALE = 1.6; // ...and its flowers this much bigger (taller)
const SHORE_BOULDERS = 90; // round the lake's outer shore
const SHORE_PEBBLES = 520;
const OASIS_ROCK_COLOR = "#2b2623"; // (dark, water-worn: the reference's)
// the valley (drawn from the first: the camera travels it before the reveal)
const VALLEY_FROM = 770; // route m
const VALLEY_TO = 1035;
const VALLEY_BOULDERS = 360;
const VALLEY_PEBBLES = 600;
const VALLEY_CLEAR = 7; // m either side of the camera's line (and the beam along it) kept clear
const VALLEY_CLUSTER_SHARE = 0.55; // of the boulders that have others round them
const VALLEY_DUNE_REACH = 22; // m up the dunes' feet they still lie
const VALLEY_ROCK_COLOR = "#3e3229";
const RIM_BOULDERS = 200; // ...and round the oasis's rim, at the dunes' feet (seen as the camera comes in, before the reveal)
const RIM_REACH = [-3, 20]; // m: from just on the floor to up the dunes' feet
// the entrance (the gap in the dunes the way comes in by): a wall of trees
// and bushes, a lane left clear for the camera
const ENTRANCE_FROM = 960; // route m
const ENTRANCE_TO = 1055;
const ENTRANCE_TREES = 95;
const ENTRANCE_BUSHES = 280;
const ENTRANCE_FLOWERS = 160;
const ENTRANCE_CLEAR_TREES = 10; // m off the camera's line (their crowns overhang)
const ENTRANCE_CLEAR_BUSHES = 6;
// the flowers (and their bloom under the cursor: ./bloom.js)
const FLOWER_ALBEDO = 0.5; // (× the per-flower colour, × T.foliage)
const FLOWER_REST_OPEN = 0.32; // how open a wild flower is untouched (0 bud … 1 flat open)
const BLOSSOM_REST_OPEN = 0.6; // ...and a blossom on a tree or bush
const BLOOM_GROW = 0.4; // how much bigger a head gets in full bloom
const BLOOM_GLOW = 1.6; // how much it lights up
const FLOWER_FAR = 210; // m: the wild flowers aren't drawn beyond
const FLOWER_COLORS = ["#f3eee2", "#f4c53f", "#ee7aa8", "#a57ae6", "#f08945", "#e04f4a", "#f6a6c8"];
const TREE_BLOSSOM_COLORS = ["#f3a0c4", "#b88af0", "#f5efe6", "#f09a52", "#e8637d"];
const BUSH_BLOSSOM_COLORS = ["#e7518a", "#f4c53f", "#f3eee2", "#ad7de8", "#ef7f45"];

// How likely each kind is at a point of the oasis (o: oasisAt), and how
// many of it there are at full density.
const SEEN_FROM = 470; // route metres

const KINDS = {
  grass: { n: 12000, at: (o) => Math.pow(o.life, 0.7) * bump(o.w, 0.1, 0.6, 6, 15) * (o.e < 3 ? 1 : 0) * (o.r < BASIN.island - 5 ? 0 : 1) },
  reeds: { n: 1200, at: (o) => o.life * bump(o.w, -1.4, -0.6, 0.8, 2.4) * (o.r > BASIN.island + 2 ? 1 : 0) },
  bushes: { n: BASIN_BUSHES, at: (o) => o.life * bump(o.w, 0.8, 2, 12, 28) * (o.e < 5 ? 1 : 0) * (o.r > BASIN.island + 8 ? 1 : 0) },
  shrubs: { n: 260, at: (o) => (o.s > S_ENTRANCE - 50 ? 1 : 0) * (0.25 + 0.75 * (1 - o.life)) * bump(o.e, -40, -20, 8, 20) * (o.w > 3 ? 1 : 0) * 0.5 },
  // (by the stream, broadleaf and rounded shade trees; the palms stand back
  // from the water, towards the dunes, and ring the lake)
  palms: { n: 0, at: (o) => (o.s > 220 || o.basin ? 1 : 0) * Math.pow(o.life, 1.3) * bump(o.w, o.basin ? 4 : 16, o.basin ? 7 : 22, 40, 60) * (o.e < 2 ? 1 : 0) * (o.d > 9 ? 1 : 0) * (o.r > BASIN.island + 12 ? 1 : 0) },
  broadleaf: { n: BASIN_TREES, at: (o) => (o.s > 160 || o.basin ? 1 : 0) * smooth(0.15, 0.6, o.life) * bump(o.w, ...BASIN_TREE_BAND) * (o.e < 4 ? 1 : 0) * (o.d > 13 ? 1 : 0) * (o.r > BASIN.island + 16 ? 1 : 0) },
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
        lists[k].push({ x: p.x, y: Math.max(y, k === "reeds" ? WATER_Y - 0.6 : -Infinity), z: p.z, chunk: chunkOf(o, p.x, p.z), life: o.life, w: o.w, basin: o.basin ? 1 : 0, r: rng(), r2: rng(), r3: rng(), r4: rng() });
        break;
      }
    }
    if (done) break;
  }
  return lists;
}

// The rest, each placed where it belongs rather than by the odds above:
// rocks along the valley (in clusters, at the dunes' feet), the island's
// grass, flowers and rocks, the banks' flower patches and the shore's
// rocks, and the wall of green across the entrance (added to `lists`).
export function scatterMore(terrain, veg, lists) {
  const rng = mulberry32(1777);
  const o = {};
  const rp = new THREE.Vector3();
  const rt = new THREE.Vector3();
  const L = route.getLength();
  const at = (s, lat) => {
    route.getPointAt(Math.min(Math.max(s / L, 0), 1), rp);
    route.getTangentAt(Math.min(Math.max(s / L, 0), 1), rt);
    return [rp.x - rt.z * lat, rp.z + rt.x * lat];
  };
  const item = (x, z, chunk, extra) => ({ x, y: terrain.height(x, z), z, chunk, r: rng(), r2: rng(), r3: rng(), r4: rng(), ...extra });
  // a rock, sunk into the ground (deeper on a slope, so no edge floats)
  const rock = (list, x, z, sc, chunk) => {
    const y = terrain.height(x, z);
    const g = Math.min(Math.hypot(terrain.height(x + 1, z) - y, terrain.height(x, z + 1) - y), 1);
    list.push({ x, y: y - sc * (0.18 + g * 0.45), z, sc, chunk, r: rng(), r2: rng(), r3: rng(), r4: rng() });
  };
  const ring = (r0, r1) => {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(r0 * r0 + rng() * (r1 * r1 - r0 * r0));
    return [BASIN.x + Math.cos(a) * r, BASIN.z + Math.sin(a) * r];
  };
  const out = {
    valleyBoulders: [],
    valleyPebbles: [],
    islandGrass: [],
    islandFlowers: [],
    islandBoulders: [],
    islandPebbles: [],
    shoreBoulders: [],
    shorePebbles: [],
    flowers: [],
  };

  // ---- the valley: boulders (many with others round them, and gravel),
  // more at the dunes' feet than out on the floor; and loose pebbles
  const valleyOk = (x, z, clear) => {
    oasisAt(x, z, o);
    return o.inside && o.d > clear && o.r > BASIN.floor - 20 && o.e < VALLEY_DUNE_REACH && o.s > VALLEY_FROM - 40;
  };
  const vChunk = () => `v${Math.floor(o.s / 90)}`;
  let guard = 0;
  while (out.valleyBoulders.length < VALLEY_BOULDERS && guard++ < 40000) {
    const s = VALLEY_FROM + rng() * (VALLEY_TO - VALLEY_FROM);
    const fh = floorHalfWidth(s);
    const side = rng() < 0.5 ? -1 : 1;
    const lat = side * (rng() < 0.6 ? fh * (0.7 + rng() * 0.3) + rng() * VALLEY_DUNE_REACH * 0.8 : VALLEY_CLEAR + 2 + rng() * Math.max(fh - VALLEY_CLEAR - 2, 0));
    const [x, z] = at(s, lat);
    const big = rng() < 0.13 ? 2 + rng() * 2.6 : 0.45 + Math.pow(rng(), 1.6) * 1.5;
    if (!valleyOk(x, z, VALLEY_CLEAR + big)) continue;
    const chunk = vChunk();
    rock(out.valleyBoulders, x, z, big, chunk);
    if (rng() < VALLEY_CLUSTER_SHARE) {
      const k = 2 + Math.floor(rng() * 5);
      for (let j = 0; j < k; j++) {
        const a = rng() * Math.PI * 2;
        const d = big * (1 + rng() * 1.2) + rng() * 1.5;
        const sc = big * (0.22 + rng() * 0.5);
        const px = x + Math.cos(a) * d;
        const pz = z + Math.sin(a) * d;
        if (valleyOk(px, pz, VALLEY_CLEAR + sc)) rock(out.valleyBoulders, px, pz, sc, chunk);
      }
    }
    // (gravel round its foot)
    const k = 2 + Math.floor(rng() * 6);
    for (let j = 0; j < k && out.valleyPebbles.length < VALLEY_PEBBLES; j++) {
      const a = rng() * Math.PI * 2;
      const d = big * (1.1 + rng() * 1.6);
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (valleyOk(px, pz, VALLEY_CLEAR * 0.6)) rock(out.valleyPebbles, px, pz, 0.12 + rng() * 0.3, chunk);
    }
  }
  guard = 0;
  while (out.valleyPebbles.length < VALLEY_PEBBLES && guard++ < 40000) {
    const s = VALLEY_FROM + rng() * (VALLEY_TO - VALLEY_FROM);
    const fh = floorHalfWidth(s);
    const [x, z] = at(s, (rng() * 2 - 1) * (fh + 6));
    if (valleyOk(x, z, 3.5)) rock(out.valleyPebbles, x, z, 0.1 + Math.pow(rng(), 2) * 0.35, vChunk());
  }

  // ...and round the oasis's rim (clusters at the dunes' feet: the camera
  // comes into the round oasis while it is still bare sand)
  guard = 0;
  let rim = 0;
  while (rim < RIM_BOULDERS && guard++ < 40000) {
    const [x, z] = ring(BASIN.floor - 10, BASIN.floor + 40);
    oasisAt(x, z, o);
    const big = rng() < 0.2 ? 2 + rng() * 2.8 : 0.6 + Math.pow(rng(), 1.5) * 1.6;
    if (!o.inside || o.e < RIM_REACH[0] || o.e > RIM_REACH[1] || o.d < VALLEY_CLEAR + big || o.w < 6) continue;
    const chunk = chunkOf(o, x, z);
    rock(out.valleyBoulders, x, z, big, chunk);
    rim++;
    const k = rng() < VALLEY_CLUSTER_SHARE ? 1 + Math.floor(rng() * 4) : 0;
    for (let j = 0; j < k; j++) {
      const ang = rng() * Math.PI * 2;
      const d = big * (1 + rng() * 1.2) + rng();
      const px = x + Math.cos(ang) * d;
      const pz = z + Math.sin(ang) * d;
      oasisAt(px, pz, o);
      if (o.d > VALLEY_CLEAR + big && o.w > 6) {
        rock(out.valleyBoulders, px, pz, big * (0.25 + rng() * 0.45), chunk);
        rim++;
      }
    }
    for (let j = 0; j < 4; j++) {
      const ang = rng() * Math.PI * 2;
      const d = big * (1.1 + rng() * 1.8);
      const px = x + Math.cos(ang) * d;
      const pz = z + Math.sin(ang) * d;
      rock(out.valleyPebbles, px, pz, 0.12 + rng() * 0.28, chunk);
    }
  }

  // ---- the island: grass all over it but the trunk's foot, flowers in
  // patches, dark boulders (a few clusters, some out at the water's edge)
  // and pebbles round them
  const isle = BASIN.island;
  // (the island is small: one chunk)
  const iChunk = () => "i";
  const nGrass = Math.round(ISLAND_GRASS * veg);
  guard = 0;
  while (out.islandGrass.length < nGrass && guard++ < nGrass * 4) {
    const [x, z] = ring(ISLAND_CLEAR, isle + 0.5);
    // (a little patchy: a thinner sward here and there)
    const patch = 0.6 + 0.4 * Math.sin(x * 0.31 + Math.sin(z * 0.23) * 2) * Math.sin(z * 0.27 - x * 0.11);
    if (rng() > patch) continue;
    const it = item(x, z, iChunk(x, z));
    if (it.y < WATER_Y + 0.02) continue;
    out.islandGrass.push(it);
  }
  const nFl = Math.round(ISLAND_FLOWERS * veg);
  guard = 0;
  while (out.islandFlowers.length < nFl && guard++ < 4000) {
    const [cx, cz] = ring(ISLAND_CLEAR + 2, isle - 2);
    const k = 6 + Math.floor(rng() * 16);
    const col = Math.floor(rng() * FLOWER_COLORS.length);
    for (let j = 0; j < k && out.islandFlowers.length < nFl; j++) {
      const a = rng() * Math.PI * 2;
      const d = Math.pow(rng(), 0.7) * 4.5;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const r = Math.hypot(x - BASIN.x, z - BASIN.z);
      if (r < ISLAND_CLEAR + 1 || r > isle) continue;
      // (a patch is mostly one colour)
      out.islandFlowers.push(item(x, z, iChunk(x, z), { col: rng() < 0.8 ? col : Math.floor(rng() * FLOWER_COLORS.length) }));
    }
  }
  guard = 0;
  while (out.islandBoulders.length < ISLAND_BOULDERS && guard++ < 4000) {
    const edge = rng() < 0.35;
    const [x, z] = edge ? ring(isle - 4, isle + 5) : ring(ISLAND_CLEAR + 2, isle - 3);
    const big = 0.45 + Math.pow(rng(), 1.4) * (edge ? 1.6 : 1.3);
    rock(out.islandBoulders, x, z, big, iChunk(x, z));
    const k = rng() < 0.6 ? 1 + Math.floor(rng() * 4) : 0;
    for (let j = 0; j < k; j++) {
      const a = rng() * Math.PI * 2;
      const d = big * (1 + rng() * 1.1);
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (Math.hypot(px - BASIN.x, pz - BASIN.z) > ISLAND_CLEAR) rock(out.islandBoulders, px, pz, big * (0.3 + rng() * 0.45), iChunk(px, pz));
    }
    const g = 4 + Math.floor(rng() * 10);
    for (let j = 0; j < g && out.islandPebbles.length < ISLAND_PEBBLES * 0.55; j++) {
      const a = rng() * Math.PI * 2;
      const d = big * (1 + rng() * 2.2);
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (Math.hypot(px - BASIN.x, pz - BASIN.z) > ISLAND_CLEAR - 1) rock(out.islandPebbles, px, pz, 0.07 + Math.pow(rng(), 1.5) * 0.28, iChunk(px, pz));
    }
  }
  // (most of them in towards the middle: boulders round the trunk's foot,
  // clustered, thinning out towards the shore)
  guard = 0;
  let centre = 0;
  while (centre < ISLAND_CENTER_BOULDERS && guard++ < 4000) {
    const a = rng() * Math.PI * 2;
    const r = ISLAND_CENTER_FROM + Math.pow(rng(), 1.7) * (isle * 0.55);
    const x = BASIN.x + Math.cos(a) * r;
    const z = BASIN.z + Math.sin(a) * r;
    const big = 0.5 + Math.pow(rng(), 1.3) * 1.5 * (1 - 0.4 * (r / isle));
    rock(out.islandBoulders, x, z, big, iChunk(x, z));
    centre++;
    const k = rng() < 0.7 ? 1 + Math.floor(rng() * 3) : 0;
    for (let j = 0; j < k; j++) {
      const b = rng() * Math.PI * 2;
      const d = big * (0.9 + rng() * 0.9);
      const px = x + Math.cos(b) * d;
      const pz = z + Math.sin(b) * d;
      if (Math.hypot(px - BASIN.x, pz - BASIN.z) > ISLAND_CENTER_FROM - 0.5) rock(out.islandBoulders, px, pz, big * (0.3 + rng() * 0.4), iChunk(px, pz));
    }
    for (let j = 0; j < 6; j++) {
      const b = rng() * Math.PI * 2;
      const d = big * (1 + rng() * 2);
      const px = x + Math.cos(b) * d;
      const pz = z + Math.sin(b) * d;
      if (Math.hypot(px - BASIN.x, pz - BASIN.z) > ISLAND_CENTER_FROM - 1) rock(out.islandPebbles, px, pz, 0.07 + Math.pow(rng(), 1.5) * 0.26, iChunk(px, pz));
    }
  }
  while (out.islandPebbles.length < ISLAND_PEBBLES) {
    const [x, z] = ring(ISLAND_CLEAR - 1, isle + 3);
    rock(out.islandPebbles, x, z, 0.06 + Math.pow(rng(), 2) * 0.3, iChunk(x, z));
  }

  // ---- round the lake: rocks along its outer shore, flower patches on the
  // banks among the trees
  guard = 0;
  while (out.shoreBoulders.length < SHORE_BOULDERS && guard++ < 20000) {
    const [x, z] = ring(BASIN.lake - 20, BASIN.lake + 25);
    oasisAt(x, z, o);
    if (o.w < -2.5 || o.w > 10 || o.d < 8) continue;
    const big = 0.5 + Math.pow(rng(), 1.5) * 1.8;
    rock(out.shoreBoulders, x, z, big, chunkOf(o, x, z));
    const g = 3 + Math.floor(rng() * 8);
    for (let j = 0; j < g && out.shorePebbles.length < SHORE_PEBBLES; j++) {
      const a = rng() * Math.PI * 2;
      const d = big * (1 + rng() * 2.4);
      rock(out.shorePebbles, x + Math.cos(a) * d, z + Math.sin(a) * d, 0.07 + Math.pow(rng(), 1.5) * 0.3, chunkOf(o, x, z));
    }
  }
  guard = 0;
  while (out.shorePebbles.length < SHORE_PEBBLES && guard++ < 20000) {
    const [x, z] = ring(BASIN.lake - 20, BASIN.lake + 25);
    oasisAt(x, z, o);
    if (o.w < -1 || o.w > 5 || o.d < 5) continue;
    rock(out.shorePebbles, x, z, 0.06 + Math.pow(rng(), 2) * 0.3, chunkOf(o, x, z));
  }
  const nBank = Math.round(BANK_FLOWERS * veg);
  guard = 0;
  while (out.flowers.length < nBank && guard++ < 20000) {
    const [cx, cz] = ring(BASIN.lake - 15, BASIN.floor + 10);
    oasisAt(cx, cz, o);
    if (o.w < 1 || o.w > 32 || o.e > 0 || o.d < 6) continue;
    const k = 5 + Math.floor(rng() * 12);
    const col = Math.floor(rng() * FLOWER_COLORS.length);
    for (let j = 0; j < k && out.flowers.length < nBank; j++) {
      const a = rng() * Math.PI * 2;
      const d = Math.pow(rng(), 0.7) * 5;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      oasisAt(x, z, o);
      if (o.w < 0.8 || o.e > 2 || o.d < 6) continue;
      out.flowers.push(item(x, z, chunkOf(o, x, z), { col: rng() < 0.8 ? col : Math.floor(rng() * FLOWER_COLORS.length) }));
    }
  }

  // ---- the entrance: trees and bushes across the gap, and flowers at
  // their feet, the camera's lane left clear
  const ent = (n, clear, eMax, wMin, list, extra) => {
    let g = 0;
    let made = 0;
    while (made < n && g++ < n * 60) {
      const s = ENTRANCE_FROM + rng() * (ENTRANCE_TO - ENTRANCE_FROM);
      const reach = Math.max(floorHalfWidth(s), 16) + 14;
      const [x, z] = at(s, (rng() < 0.5 ? -1 : 1) * (clear + rng() * (reach - clear)));
      oasisAt(x, z, o);
      if (!o.inside || o.d < clear || o.e > eMax || o.w < wMin) continue;
      list.push(item(x, z, chunkOf(o, x, z), { life: 1, w: o.w, basin: 1, ...(extra ? extra() : null) }));
      made++;
    }
  };
  ent(Math.round(ENTRANCE_TREES * veg), ENTRANCE_CLEAR_TREES, 7, 4, lists.broadleaf);
  ent(Math.round(ENTRANCE_BUSHES * veg), ENTRANCE_CLEAR_BUSHES, 9, 2, lists.bushes);
  ent(Math.round(ENTRANCE_FLOWERS * veg), ENTRANCE_CLEAR_BUSHES, 4, 1, out.flowers, () => ({ col: Math.floor(rng() * FLOWER_COLORS.length) }));
  return out;
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

// The flowers: their petals open round their heads in the vertex shader —
// a little open at rest (rest: 0 a bud … 1 flat open), and wide open,
// bigger and lit up under the cursor (./bloom.js) — swaying, and growing
// with the oasis like the rest.
function flowerMaterial({ sway = 0.1, far = 0, rest = 0.3 } = {}, uniforms, bloom) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, color: new THREE.Color().setScalar(FLOWER_ALBEDO) });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, bloom);
    growVertex(shader, uniforms, far);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uTime;
        attribute vec3 aHead;
        attribute vec3 aAxis;
        attribute vec4 aPetal;
        varying float vBloom;
        varying float vKind;
        varying vec3 vFolWorld;
        ${BLOOM_GLSL}
        float flB;
        // a petal's place for how open its flower is (and its normal)
        vec3 flPetal(float open, out vec3 nrm) {
          vec3 ax = normalize(aAxis);
          vec3 ref = abs(ax.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 t1 = normalize(cross(ax, ref));
          vec3 t2 = normalize(cross(ax, t1));
          vec3 dir = cos(aPetal.z) * t1 + sin(aPetal.z) * t2;
          vec3 side = cross(ax, dir);
          // (a bud's petals stand up round its heart; open, they lie flat
          // and a little beyond)
          float pitch = mix(1.25, -0.12, open);
          vec3 pd = dir * cos(pitch) + ax * sin(pitch);
          nrm = normalize(cross(pd, side));
          float k = 1.0 + ${BLOOM_GROW.toFixed(3)} * flB;
          return aHead + (pd * aPetal.x + side * aPetal.y) * k;
        }`
      )
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
        // (the colour is the petals': stems, leaves and hearts keep their own)
        #ifdef USE_INSTANCING_COLOR
          if (aPetal.w < 0.5 || aPetal.w > 1.5) vColor.xyz = color.xyz;
        #endif`
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        {
          vec4 hw = vec4(aHead, 1.0);
          #ifdef USE_INSTANCING
            hw = instanceMatrix * hw;
          #endif
          hw = modelMatrix * hw;
          flB = flBloomAt(hw.xyz);
          // (each one a touch apart from its neighbours)
          flB = smoothstep(0.0, 1.0, flB);
          vBloom = flB;
          vKind = aPetal.w;
          if (aPetal.w > 0.5 && aPetal.w < 1.5) {
            vec3 n;
            flPetal(mix(${rest.toFixed(3)}, 1.0, flB), n);
            objectNormal = n;
          }
        }`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          if (aPetal.w > 0.5 && aPetal.w < 1.5) {
            vec3 n;
            transformed = flPetal(mix(${rest.toFixed(3)}, 1.0, flB), n);
          } else if (aPetal.w > 1.5) {
            transformed = aHead + (transformed - aHead) * (1.0 + ${BLOOM_GROW.toFixed(3)} * flB);
          }
          vec3 base = vec3(0.0);
          #ifdef USE_INSTANCING
            base = instanceMatrix[3].xyz;
          #endif
          float h = max(transformed.y, 0.0);
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
        varying float vBloom;
        varying float vKind;
        varying vec3 vFolWorld;`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // (opening, a petal's colour comes up richer)
        diffuseColor.rgb *= 1.0 + 0.45 * vBloom * step(0.5, vKind);`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          vec3 toFrag = normalize(vFolWorld - cameraPosition);
          float back = pow(max(dot(toFrag, uSunDir), 0.0), 3.0);
          totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * 0.16;
          // (in bloom it lights up)
          totalEmissiveRadiance += diffuseColor.rgb * vBloom * step(0.5, vKind) * ${BLOOM_GLOW.toFixed(3)};
        }`
      );
  };
  material.customProgramCacheKey = () => `oasis-flower-${sway}-${far}-${rest}`;
  return material;
}

export default function Vegetation({ J, tier, shared, terrain }) {
  const group = useRef();
  const foliageAt = useRef(-1); // the brightness the plants' colours are at
  // the cursor's trail, for the flowers' bloom
  const bloom = useMemo(() => createBloom(), []);
  useEffect(() => attachPointer(), []);
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
    const more = scatterMore(terrain, tier.veg, lists);
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
      // the valley's boulders and the oasis's dark water-worn ones: all
      // there from the first (the island's are seen before the beam
      // touches the orb), in the shared stone's matte look
      valleyRock: createStoneMaterial(shared, { color: VALLEY_ROCK_COLOR }).material,
      oasisRock: createStoneMaterial(shared, { color: OASIS_ROCK_COLOR }).material,
      // wild flowers, and the blossoms on the trees and bushes (swaying with
      // their leaves)
      flower: flowerMaterial({ sway: 0.1, far: FLOWER_FAR, rest: FLOWER_REST_OPEN }, uniforms, bloom.uniforms),
      blossom: flowerMaterial({ sway: 0.035, far: 0, rest: BLOSSOM_REST_OPEN }, uniforms, bloom.uniforms),
    };
    const rockMats = new Set([mats.rock, mats.valleyRock, mats.oasisRock]);
    // geometry: three palms, two broadleaf trees, bush and shrub clumps, a tuft, two rocks
    const palms = []; // (no palms: broadleaf and rounded trees only)
    // two acacia-like spreading trees, two rounded shade trees
    const broad = [buildBroadleaf(5), buildRoundTree(13), buildBroadleaf(9), buildRoundTree(21)];
    const bush = clumpGeometry({ cards: 18, radius: 1.5, height: 1.3, size: 1.4, lift: 0.3, seed: 31 });
    const shrub = clumpGeometry({ cards: 10, radius: 0.9, height: 0.7, size: 0.95, lift: 0.1, seed: 37 });
    const tuft = tuftGeometry({ blades: 5, height: 0.8, seed: 9 });
    const reed = tuftGeometry({ blades: 6, height: 2.0, spread: 0.25, seed: 13 });
    const rocks = [rockGeometry(1), rockGeometry(2)];
    // boulders and pebbles (rounded, three and two shapes)
    const boulders = [boulderGeometry(41), boulderGeometry(43, { lumpy: 0.3, flat: 0.5 }), boulderGeometry(47, { lumpy: 0.18, flat: 0.75 })];
    const pebbles = [boulderGeometry(53, { detail: 1, lumpy: 0.12, flat: 0.55 }), boulderGeometry(59, { detail: 1, lumpy: 0.16, flat: 0.7 })];
    // flowers: two clumps of wild flowers, blossoms over each tree's crown
    // and over the bushes
    const flowerClumps = [flowerClumpGeometry({ flowers: 4, height: 0.5, petals: 6, len: 0.14, width: 0.085, seed: 61 }), flowerClumpGeometry({ flowers: 3, height: 0.7, petals: 5, len: 0.17, width: 0.1, seed: 67 })];
    const treeBlossoms = broad.map((b, i) => blossomGeometry(b.crown, { share: 0.55, len: 0.4, width: 0.24, petals: 5, seed: 71 + i }));
    const bushBlossom = blossomGeometry(bush, { share: 0.8, len: 0.2, width: 0.12, petals: 5, seed: 79 });
    // how long each kind takes to grow, and may wait its turn (the reveal's clock)
    for (const b of broad) {
      setGrowPace(b.trunk, 120, 45);
      setGrowPace(b.crown, 120, 45);
    }
    for (const b of treeBlossoms) setGrowPace(b, 120, 45);
    setGrowPace(bush, 70, 60);
    setGrowPace(bushBlossom, 70, 60);
    setGrowPace(shrub, 60, 60);
    setGrowPace(tuft, 45, 65);
    setGrowPace(reed, 55, 50);
    for (const f of flowerClumps) setGrowPace(f, 55, 70);

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
    // (gate: drawn only once the oasis has come up at its first item — the
    // valley's rocks are drawn from the first)
    const add = (geometry, material, items, place, { shadow = false, tint, gate = true, mirror = shadow } = {}) => {
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
        // (in the lake's mirror only the tall things: trees, not rocks or low plants)
        if (!mirror) mesh.layers.set(NO_MIRROR_LAYER);
        // (the rocks were always there: only the plants grow)
        if (!rockMats.has(material)) mesh.customDepthMaterial = depthFor(material);
        mesh.receiveShadow = false;
        // (where its plants stand: it isn't drawn until the oasis starts
        // coming up at the first of them — see useFrame)
        if (gate) {
          mesh.userData.at = list.map((it) => [it.x, it.z]);
          mesh.userData.from = -1;
        }
        meshes.push(mesh);
      }
    };
    const turn = (it, qq, tilt = 0) => qq.setFromAxisAngle(up, it.r * Math.PI * 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (it.r2 - 0.5) * tilt));
    const pick = (list, k) => new THREE.Color(list[Math.min(Math.floor(k * list.length), list.length - 1)]);

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
      // (some of them in flower)
      add(treeBlossoms[vi], mats.blossom, items.filter((it) => it.r4 < TREE_BLOSSOM_SHARE), place, { tint: (it, c) => c.copy(pick(TREE_BLOSSOM_COLORS, it.r4 / TREE_BLOSSOM_SHARE)) });
    });
    const bushPlace = (it, p, qq, ss) => {
      p.set(it.x, it.y - 0.2, it.z);
      turn(it, qq, 0.2);
      ss.set(0.8 + it.r3 * 0.9, 0.7 + it.r2 * 0.6, 0.8 + it.r3 * 0.9);
    };
    add(bush, mats.bushLeaf, lists.bushes, bushPlace, { tint: (it, c) => c.setRGB(0.28 + it.r * 0.1, 0.5 + it.r2 * 0.15, 0.18) });
    add(bushBlossom, mats.blossom, lists.bushes.filter((it) => it.r4 < BUSH_BLOSSOM_SHARE), bushPlace, { tint: (it, c) => c.copy(pick(BUSH_BLOSSOM_COLORS, it.r4 / BUSH_BLOSSOM_SHARE)) });
    add(shrub, mats.bushLeaf, lists.shrubs, (it, p, qq, ss) => {
      p.set(it.x, it.y - 0.1, it.z);
      turn(it, qq, 0.2);
      ss.setScalar(0.6 + it.r3 * 0.7);
    }, { tint: (it, c) => c.setRGB(0.42, 0.36, 0.2) }); // dry, olive-brown
    const tuftPlace = (it, p, qq, ss) => {
      p.set(it.x, it.y - 0.05, it.z);
      turn(it, qq, 0.3);
      ss.setScalar(0.55 + it.r3 * 0.7);
    };
    add(tuft, mats.grass, lists.grass, tuftPlace, { tint: (it, c) => c.setRGB(0.8 + it.r2 * 0.35, 0.85 + it.r3 * 0.3, 0.6) });
    // (the island's sward: lusher)
    const islandTuftPlace = (it, p, qq, ss) => {
      p.set(it.x, it.y - 0.05, it.z);
      turn(it, qq, 0.3);
      const k = 0.6 + it.r3 * 0.7;
      ss.set(k * 1.15, k * ISLAND_GRASS_TALL, k * 1.15);
    };
    add(tuft, mats.grass, more.islandGrass, islandTuftPlace, { tint: (it, c) => c.setRGB(0.75 + it.r2 * 0.3, 0.95 + it.r3 * 0.3, 0.55) });
    add(reed, mats.grass, lists.reeds, (it, p, qq, ss) => {
      p.set(it.x, it.y, it.z);
      turn(it, qq, 0.2);
      ss.set(0.8, 0.7 + it.r3 * 0.6, 0.8);
    }, { tint: (it, c) => c.setRGB(0.75, 0.82, 0.55) });
    // wild flowers: on the island, on the banks, at the entrance
    const flowerPlace = (it, p, qq, ss) => {
      p.set(it.x, it.y - 0.03, it.z);
      turn(it, qq, 0.15);
      ss.setScalar(0.9 + it.r3 * 0.6);
    };
    const flowerTint = (it, c) => c.set(FLOWER_COLORS[it.col]).multiplyScalar(0.85 + it.r2 * 0.3);
    flowerClumps.forEach((fg, vi) => {
      add(fg, mats.flower, more.islandFlowers.filter((_, i) => i % flowerClumps.length === vi), (it, p, qq, ss) => (flowerPlace(it, p, qq, ss), ss.multiplyScalar(ISLAND_FLOWER_SCALE)), { tint: flowerTint });
      add(fg, mats.flower, more.flowers.filter((_, i) => i % flowerClumps.length === vi), flowerPlace, { tint: flowerTint });
    });
    rocks.forEach((rg, vi) => {
      const items = lists.rocks.filter((_, i) => i % rocks.length === vi);
      add(rg, mats.rock, items, (it, p, qq, ss) => {
        const sc = it.r3 < 0.15 ? 2.2 + it.r2 * 2.5 : 0.45 + it.r2 * 1.3;
        p.set(it.x, it.y - sc * 0.25, it.z);
        qq.setFromEuler(new THREE.Euler((it.r - 0.5) * 0.5, it.r2 * 6.28, (it.r3 - 0.5) * 0.4));
        ss.set(sc, sc * (0.6 + it.r * 0.5), sc * (0.8 + it.r3 * 0.4));
      }, { shadow: true });
    });
    // the boulders and pebbles (sc: their size, already sunk into the ground)
    const rockPlace = (it, p, qq, ss) => {
      p.set(it.x, it.y, it.z);
      qq.setFromEuler(new THREE.Euler((it.r - 0.5) * 0.35, it.r2 * 6.28, (it.r3 - 0.5) * 0.3));
      ss.set(it.sc * (0.9 + it.r4 * 0.3), it.sc * (0.75 + it.r * 0.5), it.sc * (0.8 + it.r3 * 0.4));
    };
    const scatterRocks = (list, geoms, material, opts) => geoms.forEach((g, vi) => add(g, material, list.filter((_, i) => i % geoms.length === vi), rockPlace, opts));
    scatterRocks(more.valleyBoulders, boulders, mats.valleyRock, { shadow: true, mirror: false, gate: false });
    scatterRocks(more.valleyPebbles, pebbles, mats.valleyRock, { gate: false });
    // (the island's and the shore's too: there before the reveal)
    scatterRocks(more.islandBoulders, boulders, mats.oasisRock, { shadow: true, mirror: false, gate: false });
    scatterRocks(more.islandPebbles, pebbles, mats.oasisRock, { gate: false });
    scatterRocks(more.shoreBoulders, boulders, mats.oasisRock, { shadow: true, mirror: false, gate: false });
    scatterRocks(more.shorePebbles, pebbles, mats.oasisRock, { gate: false });
    // (their base colours, for the brightness control)
    for (const m of Object.values(mats)) m.userData.base = m.color.clone();
    const geometries = [...palms.flatMap((v) => [v.trunk, v.crown]), ...broad.flatMap((v) => [v.trunk, v.crown]), bush, shrub, tuft, reed, ...rocks, ...boulders, ...pebbles, ...flowerClumps, ...treeBlossoms, bushBlossom];
    return { meshes, mats, geometries, frond, uniforms, depth };
  }, [terrain, tier, shared, atlas, barkMap, bloom]);

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

  useFrame((state) => {
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
    // the cursor over the flowers (only once there are flowers)
    stepBloom(bloom, state.camera, state.clock.elapsedTime, R > 0);
    if (foliageAt.current !== T.foliage) {
      foliageAt.current = T.foliage;
      for (const k of ["leaf", "bushLeaf", "frond", "grass", "wood", "bark", "flower", "blossom"]) built.mats[k].color.copy(built.mats[k].userData.base).multiplyScalar(T.foliage);
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
