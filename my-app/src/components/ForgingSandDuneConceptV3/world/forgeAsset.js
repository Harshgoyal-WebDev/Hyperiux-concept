import * as THREE from "three";
import { FORGE } from "../config";
import { mulberry32 } from "./layout";

// Reads the Blender forging asset (public/models/hyperiux-forging-assets.glb)
// into the parts the scene animates. Nothing is generated in place of the
// model: the logo core, the excess chunks, the crack strips and the sphere
// are the authored meshes, and the logo core is never moved.
//
// Asset space (hyperiux-forging-metadata.json): metres, +Y up, engraved face
// towards +Z at z = 1.2, slab base on y = 0, translation-only hierarchy.

export const REQUIRED_NODES = [
  "MonolithRoot",
  "LogoRoot",
  "HyperiuxLogoCore",
  "SlabExcessChunks",
  "CoreSphereAnchor",
  "BeamTarget",
  "BeamOrigin",
];

// Order the crack network lights up in (metadata energyCracks.revealOrder).
// The Spine comes first: one fracture from the slab's foot (CrackRootAnchor,
// where the beam arrives) up to the core, on its own uv.x run (0 at the foot
// → 1 at BeamTarget). The others spread out from the core after it.
export const CRACK_STAGES = ["Spine", "Core", "Inner", "Middle", "Outer", "LogoCore"];

export const FRONT_Z = 1.2; // engraved face, asset space

// When each break group comes loose, as a share of the breakup (0..1): one
// blast, a beat apart — perimeter first, then above and below the mark, then
// the negative spaces inside it, then the last pieces around the core.
const GROUP_WINDOWS = [
  [/BreakGroup_01/, 0.0, 0.02],
  [/BreakGroup_02/, 0.01, 0.03],
  [/BreakGroup_03/, 0.015, 0.035],
  [/BreakGroup_04/, 0.02, 0.04],
  [/BreakGroup_05/, 0.03, 0.045],
];
// Share of the breakup each chunk spends in flight (last start + span = 1).
export const CHUNK_SPAN = 0.955;

// ---------------------------------------------------------------------------
// The Hyperiux mark, verbatim from public/hyperiux-icon-black.svg (500×501).
// Four filled paths and the cube outline, stroked 7 units wide.
// ---------------------------------------------------------------------------
const LOGO_FILLS = [
  "M40 13H106.261V222.826H40V13Z",
  "M459.654 487.869H393.394V278.043H459.654V487.869Z",
  "M40.1406 278.043V487.869H106.401V322.217L198.062 287.983V223.931L40.1406 278.043Z",
  "M393.527 178.653V13.0007H460.892V222.826L291.927 290.889V222.826L393.527 178.653Z",
];
const LOGO_STROKE =
  "M246.651 306.756L295.242 285.774C295.242 263.779 295.242 249.995 295.242 228L257.334 210.358C254.732 209.147 251.761 208.996 249.051 209.938L201.373 226.5V285.774L246.651 306.756ZM201.373 226.5L246.651 249.33M295.242 228L246.651 249.33M246.651 249.33V306.756";
const LOGO_STROKE_WIDTH = 7;

// metadata svgMapping: x = (svgX - 250.446) * 0.018 ; y = 6 - (svgY - 250.4345) * 0.018
const SVG_SCALE = 0.018;
const SVG_CX = 250.446;
const SVG_CY = 250.4345;
const SVG_Y0 = 6;

// The camera's way through the forged mark: the top compartment of the cube
// outline (between the hexagon's upper edges and the inner Y), its centroid
// from the cube path's own corners. It is about 32 × 85 SVG units clear
// inside the 7-unit strokes: ±1.4 m vertically, ±3.9 m across at the scale
// shown.
const OPENING_SVG = [249.1, 228.5];

// The cube outline's hexagon (its stroke's centre line, from the path's
// corners), in asset metres: the light that fills its openings is cut to it.
const CUBE_HEX_SVG = [
  [246.651, 306.756],
  [295.242, 285.774],
  [295.242, 228],
  [253.2, 209.4],
  [201.373, 226.5],
  [201.373, 285.774],
];
export const cubeHexagon = () =>
  CUBE_HEX_SVG.map(([x, y]) => new THREE.Vector2((x - SVG_CX) * SVG_SCALE, SVG_Y0 - (y - SVG_CY) * SVG_SCALE));

// Area of asset space the outline mask covers (the logo extent plus margin).
export const MASK_RECT = new THREE.Vector4(-4.1, 1.4, 4.1, 10.6); // x0, y0, x1, y1
const MASK_TEXEL = 0.008; // metres per texel

// Silhouette of the logo rasterised from the SVG paths and softened, so
// shaders can find its outline anywhere on the slab face: the mask is 0.5
// exactly on the outline. Used for the engraved seam and its glow.
export function buildLogoMask() {
  const [x0, y0, x1, y1] = MASK_RECT.toArray();
  const w = Math.round((x1 - x0) / MASK_TEXEL);
  const h = Math.round((y1 - y0) / MASK_TEXEL);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  // SVG units → canvas pixels (canvas y runs down from y1)
  const k = SVG_SCALE / MASK_TEXEL;
  ctx.setTransform(k, 0, 0, k, (-SVG_CX * SVG_SCALE - x0) / MASK_TEXEL, (y1 - SVG_Y0 - SVG_CY * SVG_SCALE) / MASK_TEXEL);
  ctx.fillStyle = ctx.strokeStyle = "#fff";
  for (const d of LOGO_FILLS) ctx.fill(new Path2D(d));
  ctx.lineWidth = LOGO_STROKE_WIDTH;
  ctx.lineJoin = "miter";
  ctx.stroke(new Path2D(LOGO_STROKE));
  const rgba = ctx.getImageData(0, 0, w, h).data;

  // two box-blur passes ≈ a ~3 cm wide soft edge
  let a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = rgba[i * 4] / 255;
  let b = new Float32Array(w * h);
  const r = 2;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += a[y * w + Math.min(Math.max(x + d, 0), w - 1)];
        b[y * w + x] = s / (2 * r + 1);
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += b[Math.min(Math.max(y + d, 0), h - 1) * w + x];
        a[y * w + x] = s / (2 * r + 1);
      }
    }
  }
  b = null;
  // rows bottom-up so texture v follows asset y
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w;
    for (let x = 0; x < w; x++) data[y * w + x] = Math.round(a[src + x] * 255);
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

// Where the slab breaks: the lines on its front face where neighbouring
// pieces (each excess chunk, and the logo core as one piece) meet — the
// fracture seams between chunks and the outline of the mark. Every piece's
// front-facing triangles are filled in its own exact id colour, then every
// pixel where two pieces meet is marked (anti-aliased pixels between pieces
// count; edges against the open sky or the rhombus pocket do not). Shaders
// read it in asset xy, so the lines travel with the pieces as they fly.
export const SLAB_RECT = new THREE.Vector4(-5.5, -0.5, 5.5, 12.5); // x0, y0, x1, y1
const FRACTURE_TEXEL = 0.01; // metres per texel

export function buildFractureMask(pieces) {
  const [x0, y0, x1, y1] = SLAB_RECT.toArray();
  const w = Math.round((x1 - x0) / FRACTURE_TEXEL);
  const h = Math.round((y1 - y0) / FRACTURE_TEXEL);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const px = (x) => (x - x0) / FRACTURE_TEXEL;
  const py = (y) => (y1 - y) / FRACTURE_TEXEL;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  pieces.forEach((meshes, id) => {
    // exact id colour: multiples of 16 in red and green, blue 0
    ctx.fillStyle = `rgb(${16 + (id % 15) * 16}, ${16 + Math.floor(id / 15) * 16}, 0)`;
    ctx.beginPath();
    for (const mesh of meshes) {
      const rest = mesh.geometry.attributes.aRest;
      const index = mesh.geometry.index;
      const count = index ? index.count : rest.count;
      for (let i = 0; i < count; i += 3) {
        const ia = index ? index.getX(i) : i;
        const ib = index ? index.getX(i + 1) : i + 1;
        const ic = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(rest, ia);
        b.fromBufferAttribute(rest, ib);
        c.fromBufferAttribute(rest, ic);
        n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
        // the engraved face only (flat at z = 1.2, facing the camera)
        if (n.z < 0.6 || (a.z + b.z + c.z) / 3 < FRONT_Z - 0.12) continue;
        ctx.moveTo(px(a.x), py(a.y));
        ctx.lineTo(px(b.x), py(b.y));
        ctx.lineTo(px(c.x), py(c.y));
        ctx.closePath();
      }
    }
    ctx.fill(); // one fill per piece: no seams between its own triangles
  });
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const R = (i) => rgba[i * 4];
  const G = (i) => rgba[i * 4 + 1];
  const B = (i) => rgba[i * 4 + 2];
  const bg = (i) => R(i) < 4 && G(i) < 4;
  const exact = (i) => B(i) === 0 && R(i) >= 16 && R(i) % 16 === 0 && G(i) >= 16 && G(i) % 16 === 0;
  const near = (i, test) => {
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && test(yy * w + xx)) return true;
      }
    return false;
  };
  let line = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (bg(i)) continue;
      if (!exact(i)) {
        // blended pixel between two pieces (not against the sky / pocket)
        if (!near(i, bg)) line[i] = 1;
        continue;
      }
      for (const j of [x + 1 < w ? i + 1 : -1, y + 1 < h ? i + w : -1]) {
        if (j < 0 || bg(j) || !exact(j)) continue;
        if (R(i) !== R(j) || G(i) !== G(j)) line[i] = line[j] = 1;
      }
    }
  }
  // one soft pass: a thin bright core with a little falloff
  const soft = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      soft[i] = line[i] * 0.5 + (line[i - 1] + line[i + 1] + line[i - w] + line[i + w]) * 0.125;
    }
  }
  line = null;
  // rows bottom-up so texture v follows asset y
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w;
    for (let x = 0; x < w; x++) data[y * w + x] = Math.round(Math.min(soft[src + x], 1) * 255);
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// GLB → forge parts
// ---------------------------------------------------------------------------
// Every stone mesh gets aRest: its vertices in asset space at rest, so the
// engraving and the energy front stay attached to a chunk as it flies.
function addRestAttribute(mesh, offset) {
  const g = mesh.geometry;
  if (g.attributes.aRest) return;
  const p = g.attributes.position;
  const rest = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    rest[i * 3] = p.getX(i) + offset.x;
    rest[i * 3 + 1] = p.getY(i) + offset.y;
    rest[i * 3 + 2] = p.getZ(i) + offset.z;
  }
  g.setAttribute("aRest", new THREE.BufferAttribute(rest, 3));
}

// Which broken piece a vertex belongs to (-1: the logo core): the stone
// shader looks up that piece's erosion with it.
function addPieceAttribute(mesh, index) {
  const g = mesh.geometry;
  if (g.attributes.aPiece) return;
  g.setAttribute("aPiece", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(index), 1));
}

// The pattern stone erodes in as it turns to sand (asset space): 0..1, the
// erosion threshold of each point. Shared, byte for byte, by the stone
// shader (SAND_NOISE_GLSL) and the sand it releases (sandNoise), so every
// grain leaves exactly where the stone wears away.
const sWave = (x, y, z) =>
  Math.sin(x * 1.7 + Math.sin(z * 1.3) * 1.7) * Math.sin(y * 1.9 + Math.sin(x * 1.1) * 1.9) * Math.sin(z * 1.5 + Math.sin(y * 1.2) * 1.3);
export function sandNoise(x, y, z) {
  const r = 0.5 + 0.5 * (0.6 * sWave(x * 2.2, y * 2.2, z * 2.2) + 0.4 * sWave(x * 5.9 + 11, y * 5.9 + 11, z * 5.9 + 11));
  return THREE.MathUtils.smoothstep(r, 0.22, 0.78);
}
export const SAND_NOISE_GLSL = /* glsl */ `
float sWave(vec3 p) {
  return sin(p.x * 1.7 + sin(p.z * 1.3) * 1.7) * sin(p.y * 1.9 + sin(p.x * 1.1) * 1.9) * sin(p.z * 1.5 + sin(p.y * 1.2) * 1.3);
}
float sandNoise(vec3 p) {
  float r = 0.5 + 0.5 * (0.6 * sWave(p * 2.2) + 0.4 * sWave(p * 5.9 + 11.0));
  return smoothstep(0.22, 0.78, r);
}
`;

export function prepareForge(gltfScene, groundY) {
  const missing = REQUIRED_NODES.filter((n) => !gltfScene.getObjectByName(n));
  if (missing.length) return { missing };

  const scene = gltfScene.clone(true);
  const root = scene.getObjectByName("MonolithRoot");
  root.removeFromParent();
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  // root is detached and at the origin, so world == asset space for its subtree
  const assetPos = (o) => o.getWorldPosition(new THREE.Vector3());

  const anchors = {
    logo: assetPos(root.getObjectByName("LogoRoot")),
    core: assetPos(root.getObjectByName("CoreSphereAnchor")),
    target: assetPos(root.getObjectByName("BeamTarget")),
    origin: assetPos(root.getObjectByName("BeamOrigin")),
  };
  // the Spine's start: bottom centre of the engraved face (an older asset
  // without the anchor: straight above BeamOrigin, on the face)
  const crackRoot = root.getObjectByName("CrackRootAnchor");
  anchors.root = crackRoot ? assetPos(crackRoot) : new THREE.Vector3(anchors.origin.x, 0.05, FRONT_Z);

  const coreMeshes = [];
  const chunks = [];
  const cracks = Object.fromEntries(CRACK_STAGES.map((s) => [s, []]));
  let sphere = null;

  root.getObjectByName("HyperiuxLogoCore").traverse((o) => {
    if (o.isMesh && !o.name.startsWith("Cracks_")) {
      addRestAttribute(o, assetPos(o));
      addPieceAttribute(o, -1); // the logo core never erodes
      coreMeshes.push(o);
    }
  });

  const chunkNodes = [];
  root.getObjectByName("SlabExcessChunks").traverse((o) => {
    if (o.isMesh && o.name.startsWith("SlabChunk_")) chunkNodes.push(o);
  });
  if (!chunkNodes.length) return { missing: ["SlabChunk_### meshes under SlabExcessChunks"] };

  const rng = mulberry32(61);
  const byGroup = new Map();
  for (const mesh of chunkNodes) {
    const x = mesh.userData || {};
    const group = x.break_group || mesh.parent?.name || "";
    if (!byGroup.has(group)) byGroup.set(group, []);
    const restAsset = assetPos(mesh);
    addRestAttribute(mesh, restAsset);
    const dir = new THREE.Vector3().fromArray(x.explode_dir_gltf || [restAsset.x, restAsset.y - 6, 1]).normalize();
    const vol = x.volume_m3 ?? 1;
    const axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    byGroup.get(group).push({
      mesh,
      group,
      order: x.break_order ?? chunks.length + 1,
      rest: mesh.position.clone(), // in its parent (translation-only), i.e. asset space
      dir,
      // it comes loose and floats off: a gentle drift (smaller pieces a
      // little more) and a slow turn
      vol,
      drift: 0.35 + 0.7 * (1 - Math.min(vol / 6, 1)) + rng() * 0.3,
      spin: (0.25 + 0.7 * (1 - Math.min(vol / 6, 1))) * (rng() < 0.5 ? -1 : 1),
      axis,
      // the perimeter is free to move sideways at once; every other piece
      // is pushed straight out of the face first so it never passes
      // through the logo beside it
      perimeter: /BreakGroup_01/.test(group),
      start: 0,
    });
    chunks.push(byGroup.get(group).at(-1));
  }
  const size = new THREE.Vector3();
  chunks.forEach((c, i) => {
    c.index = i;
    addPieceAttribute(c.mesh, i);
    c.mesh.geometry.computeBoundingBox();
    c.mesh.geometry.boundingBox.getSize(size);
    c.dim = Math.max(size.x, size.y, size.z); // asset metres
  });
  for (const [group, list] of byGroup) {
    list.sort((p, q) => p.order - q.order);
    const win = GROUP_WINDOWS.find(([re]) => re.test(group));
    list.forEach((c, i) => {
      if (win) c.start = win[1] + (list.length > 1 ? i / (list.length - 1) : 0) * (win[2] - win[1]);
      else c.start = Math.min((c.order - 1) / Math.max(chunks.length - 1, 1), 1) * (1 - CHUNK_SPAN);
      c.seed = rng();
    });
  }

  root.traverse((o) => {
    if (!o.isMesh) return;
    // the GLB's own material, kept aside: the scene swaps in patched copies
    o.forgeSource = o.material;
    const m = o.name.match(/^Cracks_([A-Za-z]+)__/);
    if (m && cracks[m[1]]) cracks[m[1]].push(o);
    if (o.name === "CoreSphere_Preview") sphere = o;
  });

  // Asset space → world: uniform scale, core centred on x = 0, base sunk.
  const S = FORGE.scale;
  const object = new THREE.Group();
  object.name = "Forge";
  object.add(root);
  object.scale.setScalar(S);
  object.position.set(-anchors.core.x * S, groundY - FORGE.sink, 0);
  object.updateMatrixWorld(true);
  const toWorld = (v) => v.clone().multiplyScalar(S).add(object.position);

  return {
    object,
    root,
    coreMeshes,
    chunks,
    // per piece: world position + how far it has eroded into sand, its
    // orientation and its own breakup progress (the stone shader, the sand
    // and gravel it turns into and the swirl read these)
    swirlSource: chunks.map(() => new THREE.Vector4()),
    pieceQuat: chunks.map(() => new THREE.Vector4(0, 0, 0, 1)),
    pieceProgress: new Float32Array(Math.ceil(chunks.length / 4) * 4), // four to a vec4 uniform
    // each piece's sand stream once broken off: which stream, how far back
    // along it, its size
    pieceStream: chunks.map(() => new THREE.Vector4(0, 0, 1, 0)),
    cracks,
    sphere,
    scale: S,
    anchors,
    toWorld,
    world: {
      core: toWorld(anchors.core),
      target: toWorld(anchors.target),
      origin: toWorld(anchors.origin),
      root: toWorld(anchors.root),
      logo: toWorld(anchors.logo),
      frontZ: FRONT_Z * S + object.position.z,
      opening: toWorld(new THREE.Vector3((OPENING_SVG[0] - SVG_CX) * SVG_SCALE, SVG_Y0 - (OPENING_SVG[1] - SVG_CY) * SVG_SCALE, FRONT_Z)),
    },
  };
}

// ---------------------------------------------------------------------------
// Chunk breakup
// ---------------------------------------------------------------------------
// The breakup is a blast: all the excess rock is thrown off at once (the
// groups only a beat apart, from the centre out), then carried round the
// mark in streams of sand that it grinds away into. Each piece's flight is
// world/breakup.js (pieceFlight); a function of the breakup progress, so
// scrolling back reassembles the slab.

// A piece's own progress (0 → 1) at breakup progress f.
export const pieceProgress = (c, f) => THREE.MathUtils.clamp((f - c.start) / CHUNK_SPAN, 0, 1);
