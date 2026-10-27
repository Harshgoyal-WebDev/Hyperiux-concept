import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LOGO, PLACEHOLDER, mulberry32 } from "./layout";
import { CUBE_SIZE, MONOLITH_SINK, MONOLITH_TARGET_HEIGHT } from "../config";

// The result every monolith source (GLB or placeholder) is normalized to:
//   object      – Object3D to add to the scene, already in world space
//   meshes      – the stone meshes (receive the basalt material)
//   cube        – { position: Vector3 (world), size }
//   bounds      – world Box3 of the stone
//   frontZ/backZ – world z of the logo face and the far face
//   parts        – per-piece world-space geometry (position+normal) for ash sampling,
//                  with the side (-1 / +1) each piece moves to when the halves part
//   split        – halves + offsets for the joined → parted animation (null if one piece)
//   isPlaceholder

// Converts SVG coordinates (y down) to monolith-local metres with the
// cube hexagon centre at x = 0 and the slab bottom at y = -MONOLITH_SINK.
function svgToLocal([x, y]) {
  const s = PLACEHOLDER.scale;
  const { bottom } = PLACEHOLDER.slab;
  return new THREE.Vector2((x - LOGO.cubeCenter[0]) * s, (bottom - y) * s - MONOLITH_SINK);
}

// Slightly irregular outer silhouette: dense points with deterministic
// chips so the slab edge doesn't read as a perfect rectangle.
function slabOutline() {
  const rng = mulberry32(5);
  const { left, right, top, bottom } = PLACEHOLDER.slab;
  const pts = [];
  const edge = (a, b, steps, amp, inwardX, inwardY) => {
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const chip = i === 0 ? 0 : (rng() < 0.3 ? rng() * amp * 2.2 : rng() * amp * 0.5);
      pts.push([x + inwardX * chip, y + inwardY * chip]);
    }
  };
  edge([left, bottom], [right, bottom], 8, 0, 0, 0);
  edge([right, bottom], [right, top], 26, 6, -1, 0);
  edge([right, top], [left, top], 24, 9, 0, 1);
  edge([left, top], [left, bottom], 26, 6, 1, 0);
  return pts;
}

export function buildPlaceholderMonolith() {
  const shape = new THREE.Shape(slabOutline().map(svgToLocal));
  for (const hole of [LOGO.barTopLeft, LOGO.barBottomRight, LOGO.bridge]) {
    shape.holes.push(new THREE.Path(hole.map(svgToLocal)));
  }

  const depth = PLACEHOLDER.depth;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.35,
    bevelSize: 0.3,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const mesh = new THREE.Mesh(geometry);
  mesh.name = "MonolithRoot";
  const group = new THREE.Group();
  group.add(mesh);

  const cubeY = svgToLocal(LOGO.cubeCenter).y;
  const bounds = geometry.boundingBox.clone();
  return {
    object: group,
    meshes: [mesh],
    cube: { position: new THREE.Vector3(0, cubeY, 0), size: CUBE_SIZE },
    bounds,
    frontZ: bounds.max.z,
    backZ: bounds.min.z,
    parts: [{ geometry: toSamplingGeometry([mesh]), side: 0 }],
    split: null,
    isPlaceholder: true,
  };
}

// ---------------------------------------------------------------------------
// GLB
// ---------------------------------------------------------------------------
const FRONT_ROTATION = {
  "+Z": 0,
  "-Z": Math.PI,
  "+X": -Math.PI / 2,
  "-X": Math.PI / 2,
};

function readAnchorFromMeta(meta) {
  const a = meta?.cubeAnchor;
  // blender/monolith/hyperiux-monolith-metadata.json stores it as
  // cube.position (MonolithRoot space, metres, Y-up); cubeAnchor.* is also accepted.
  const p = a?.localPosition || a?.position || a?.location || meta?.cubeAnchorPosition || meta?.cube?.position;
  if (!Array.isArray(p) || p.length < 3) return null;
  const v = new THREE.Vector3(p[0], p[1], p[2]);
  // Raw Blender coordinates are Z-up; the glTF exporter converts nodes to
  // Y-up, so metadata written straight from Blender needs the same swap.
  if ((meta.upAxis || meta.orientation?.up || "").toUpperCase().startsWith("Z")) v.set(p[0], p[2], -p[1]);
  return v;
}

// "+Z (logo face; …)" → "+Z"
function readFront(meta) {
  const raw = meta?.front || meta?.orientation?.front || "+Z";
  return (String(raw).toUpperCase().match(/^[+-][XZ]/) || ["+Z"])[0];
}

// Explicit cube.size, else the middle of the recommended edge range.
function readCubeEdge(meta) {
  const c = meta?.cube;
  if (Number.isFinite(c?.size)) return c.size;
  const r = c?.recommendedEdge_m;
  if (Array.isArray(r) && r.length) return r.reduce((a, b) => a + b, 0) / r.length;
  return null;
}

export function normalizeGltfMonolith(gltfScene, meta) {
  const scene = gltfScene.clone(true);
  scene.updateMatrixWorld(true);
  const root = scene.getObjectByName("MonolithRoot") || scene;
  // Read the anchor in MonolithRoot space before detaching the root.
  const anchorNode = scene.getObjectByName("CubeAnchor");
  const anchorLocal = anchorNode ? root.worldToLocal(anchorNode.getWorldPosition(new THREE.Vector3())) : null;

  // Mount only the MonolithRoot subtree: a Blender export can also carry
  // boolean cutters, cameras and lights that must not reach the scene.
  const wrapper = new THREE.Group();
  const placed = new THREE.Group();
  if (root !== scene) {
    root.matrixWorld.decompose(placed.position, placed.quaternion, placed.scale);
    root.removeFromParent();
    root.position.set(0, 0, 0);
    root.quaternion.identity();
    root.scale.set(1, 1, 1);
  }
  placed.add(root);
  wrapper.add(placed);
  wrapper.rotation.y = FRONT_ROTATION[readFront(meta)] ?? 0;
  wrapper.updateMatrixWorld(true);

  // Stone meshes: everything under MonolithRoot except any cube mesh the
  // Blender file might carry — the cube is generated in code.
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (/cube/i.test(o.name) && !/monolith/i.test(o.name)) {
      o.visible = false;
      return;
    }
    meshes.push(o);
  });

  const bounds = new THREE.Box3();
  meshes.forEach((m) => bounds.expandByObject(m));
  const size = bounds.getSize(new THREE.Vector3());
  const targetHeight = meta?.targetHeight || MONOLITH_TARGET_HEIGHT;
  const scale = size.y > 0 ? targetHeight / size.y : 1;

  let anchorWorld;
  let anchorSource;
  if (anchorLocal) {
    anchorWorld = anchorLocal.clone().applyMatrix4(root.matrixWorld);
    anchorSource = "CubeAnchor node";
  } else {
    const local = readAnchorFromMeta(meta);
    if (local) {
      anchorWorld = local.applyMatrix4(root.matrixWorld);
      anchorSource = "metadata";
    } else {
      // Last resort only — documented as a warning, because the bbox
      // centre is generally NOT the logo bridge.
      anchorWorld = bounds.getCenter(new THREE.Vector3());
      anchorSource = "bounding-box centre (fallback)";
      console.warn(
        "[sand-dune-concept] CubeAnchor not found in GLB or metadata — the cube is placed at the monolith's bounding-box centre, which is unlikely to be the logo bridge."
      );
    }
  }

  // Scale, then move so the anchor sits on the world origin's vertical
  // axis and the stone's base is buried MONOLITH_SINK metres in the sand.
  wrapper.scale.setScalar(scale);
  wrapper.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3();
  meshes.forEach((m) => scaledBounds.expandByObject(m));
  // anchorWorld was measured after rotation, before scale; scaling about
  // the origin is a pure multiply.
  const scaledAnchor = anchorWorld.clone().multiplyScalar(scale);
  wrapper.position.set(-scaledAnchor.x, -MONOLITH_SINK - scaledBounds.min.y, -scaledAnchor.z);
  wrapper.updateMatrixWorld(true);

  const finalBounds = new THREE.Box3();
  meshes.forEach((m) => finalBounds.expandByObject(m));
  const cubePos = new THREE.Vector3(0, scaledAnchor.y + wrapper.position.y, 0);
  const edge = readCubeEdge(meta);
  const cubeSize = edge ? edge * scale : CUBE_SIZE;

  // Two-piece monument, shown joined (gap closed, see monolithGap). Sides
  // come from each piece's centre.
  const halves = meshes.map((m) => {
    const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
    return { mesh: m, side: Math.sign(c.x) || 0, base: m.position.clone() };
  });
  const isSplit = halves.length >= 2 && halves.some((h) => h.side < 0) && halves.some((h) => h.side > 0);
  const gapLocal = meta?.splitGap?.nominalWidth_m ?? 0.45;
  // gapWorld: the authored gap. The live offset comes from the monolithGap
  // tuning (splitOffset below).
  const split = isSplit ? { halves, gapWorld: gapLocal * scale, scale } : null;
  // Width of the hexagon opening at the authored gap; the cube is fitted
  // into whatever the current gap leaves of it (cubeFit).
  const hexWidth = meta?.cube?.openingHexagon_m?.width;
  const hexWidthWorld = isSplit && hexWidth ? hexWidth * scale : null;
  const hexHeight = meta?.cube?.openingHexagon_m?.height;

  return {
    object: wrapper,
    meshes,
    cube: { position: cubePos, size: cubeSize, hexWidthWorld, hexHeightWorld: hexHeight ? hexHeight * scale : null },
    bounds: finalBounds,
    frontZ: finalBounds.max.z,
    backZ: finalBounds.min.z,
    // per-piece surfaces; `side` tells the ash where that half ends up
    parts: halves.map((h) => ({ geometry: toSamplingGeometry([h.mesh]), side: isSplit ? h.side : 0 })),
    split,
    isPlaceholder: false,
    hasAuthoredMaps: meshes.some((m) => m.material?.map),
    anchorSource,
  };
}

// Merges stone meshes into one world-space geometry (position + normal
// only) for surface sampling of the dissolve particles.
function toSamplingGeometry(meshes) {
  const parts = meshes.map((m) => {
    m.updateWorldMatrix(true, false);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", m.geometry.attributes.position.clone());
    if (m.geometry.attributes.normal) g.setAttribute("normal", m.geometry.attributes.normal.clone());
    if (m.geometry.index) g.setIndex(m.geometry.index.clone());
    g.applyMatrix4(m.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    return g.index ? g.toNonIndexed() : g;
  });
  return parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
}

// Per-half x offset (world metres, away from the middle) that opens the gap
// between the halves to `gap` metres.
export function splitOffset(split, gap) {
  return (gap - split.gapWorld) / 2;
}

// Largest cube scale that clears the hexagon opening with the halves `gap`
// metres apart (Infinity when there's nothing to fit).
export function cubeFit(monolith, gap) {
  const { split, cube } = monolith;
  if (!split || !cube.hexWidthWorld) return Infinity;
  return ((cube.hexWidthWorld - split.gapWorld + gap) * 0.9) / (Math.SQRT2 * cube.size);
}

// The cube's scale for a journey state: sized to sit in the joined
// opening (cubeSize, capped so it clears the stone), then growing just a
// little (cubeGrow) as the camera approaches.
export function cubeScale(monolith, J, tuning) {
  const base = Math.min(tuning.cubeSize, cubeFit(monolith, tuning.monolithGap));
  return base * (1 + (tuning.cubeGrow - 1) * J.approach);
}
