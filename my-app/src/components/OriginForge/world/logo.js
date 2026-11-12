import * as THREE from "three";

// The Hyperiux mark, read from public/hyperiux-icon-white.svg (viewBox
// 500 × 501). Its four solid parts become the four forged pieces; the
// isometric cube outline becomes the molten core at the joint.
//
//   A ▌      ▐▀ D        A: left upper bar            (Strategy)
//     ▌   ⬡ ╱▐           C: left lower bar + beam     (Design)
//   C ▌╱      ▐ B        D: right upper bar + beam    (Development)
//     ▌       ▐          B: right lower bar           (Marketing)
const SVG = {
  A: [[40, 13], [106.261, 13], [106.261, 222.826], [40, 222.826]],
  B: [[393.394, 278.043], [459.654, 278.043], [459.654, 487.869], [393.394, 487.869]],
  C: [[40.1406, 278.043], [198.062, 223.931], [198.062, 287.983], [106.401, 322.217], [106.401, 487.869], [40.1406, 487.869]],
  D: [[393.527, 13.0007], [460.892, 13.0007], [460.892, 222.826], [291.927, 290.889], [291.927, 222.826], [393.527, 178.653]],
};
// the cube's hexagon centre in the SVG
const CUBE_SVG = [248.3, 258.4];

export const LOGO_SCALE = 0.03; // svg px → world units (the mark is ~14 units tall)
export const MARK_DEPTH = 1.8;
export const MARK_CENTER = new THREE.Vector3(0, 8.6, -3);
export const CUBE_EDGE = 2.0;
// tilts the cube so it reads as the logo's isometric hexagon from the front
export const CUBE_ROTATION = new THREE.Euler(THREE.MathUtils.degToRad(22), Math.PI / 4, 0, "XYZ");

const toLocal = ([x, y]) => [(x - 250) * LOGO_SCALE, (250.5 - y) * LOGO_SCALE];

export const PIECE_IDS = ["A", "B", "C", "D"];
export const PIECE_POLYS = Object.fromEntries(PIECE_IDS.map((id) => [id, SVG[id].map(toLocal)]));
export const CUBE_LOCAL = new THREE.Vector3(...toLocal(CUBE_SVG), 0);

// bounding-box centre of each piece, in mark space
export const PIECE_CENTERS = Object.fromEntries(
  PIECE_IDS.map((id) => {
    const xs = PIECE_POLYS[id].map((p) => p[0]);
    const ys = PIECE_POLYS[id].map((p) => p[1]);
    return [id, new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, 0)];
  })
);

// world position of a piece's centre
export const pieceWorld = (id) => PIECE_CENTERS[id].clone().add(MARK_CENTER);

// An extruded piece, centred on its own bounding-box centre (so it can grow
// and slide from there).
export function pieceGeometry(id) {
  const c = PIECE_CENTERS[id];
  const shape = new THREE.Shape(PIECE_POLYS[id].map(([x, y]) => new THREE.Vector2(x - c.x, y - c.y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: MARK_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -MARK_DEPTH / 2);
  geo.computeVertexNormals();
  return geo;
}

// Points for the particles to settle on: mostly along the pieces' outlines
// (where the light gathers), the rest through their volume and the cube.
export function sampleMarkTargets(count, rand) {
  const out = new Float32Array(count * 3);
  const polys = PIECE_IDS.map((id) => PIECE_POLYS[id]);
  const areas = polys.map(polyArea);
  const total = areas.reduce((a, b) => a + b, 0);
  const pickPoly = () => {
    let r = rand() * total;
    for (let i = 0; i < polys.length; i++) {
      r -= areas[i];
      if (r <= 0) return polys[i];
    }
    return polys[polys.length - 1];
  };
  const v = new THREE.Vector3();
  const cubeEdges = cubeEdgeList();
  for (let i = 0; i < count; i++) {
    const r = rand();
    if (r < 0.5) {
      // on an outline, front or back face
      const poly = pickPoly();
      const k = Math.floor(rand() * poly.length);
      const a = poly[k];
      const b = poly[(k + 1) % poly.length];
      const f = rand();
      v.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, (rand() < 0.5 ? -1 : 1) * MARK_DEPTH * 0.5);
    } else if (r < 0.88) {
      // inside a piece
      const poly = pickPoly();
      const [minX, maxX, minY, maxY] = bounds(poly);
      let x;
      let y;
      let guard = 0;
      do {
        x = minX + (maxX - minX) * rand();
        y = minY + (maxY - minY) * rand();
      } while (!inside(poly, x, y) && ++guard < 40);
      v.set(x, y, (rand() - 0.5) * MARK_DEPTH);
    } else {
      // along the cube's edges
      const [a, b] = cubeEdges[Math.floor(rand() * cubeEdges.length)];
      v.lerpVectors(a, b, rand());
    }
    v.add(MARK_CENTER);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}

function cubeEdgeList() {
  const box = new THREE.BoxGeometry(CUBE_EDGE, CUBE_EDGE, CUBE_EDGE);
  const edges = new THREE.EdgesGeometry(box);
  const m = new THREE.Matrix4().makeRotationFromEuler(CUBE_ROTATION).setPosition(CUBE_LOCAL);
  const pos = edges.attributes.position;
  const list = [];
  for (let i = 0; i < pos.count; i += 2) {
    list.push([new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m), new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(m)]);
  }
  box.dispose();
  edges.dispose();
  return list;
}

function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}
function bounds(p) {
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}
function inside(p, x, y) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// Edge lines with a per-vertex `aT` (0 → 1 along each edge, staggered
// through the set), drawn progressively by the trace shader.
export function traceEdges(geometry, thresholdAngle = 25) {
  const edges = new THREE.EdgesGeometry(geometry, thresholdAngle);
  const n = edges.attributes.position.count / 2;
  const t = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) {
    const s = (k / n) * 0.45;
    t[k * 2] = s;
    t[k * 2 + 1] = s + 0.55;
  }
  edges.setAttribute("aT", new THREE.BufferAttribute(t, 1));
  return edges;
}
