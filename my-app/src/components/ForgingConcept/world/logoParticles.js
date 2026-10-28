import * as THREE from "three";
import { mulberry32 } from "./layout";

// Particle positions for the Hyperiux mark, taken from the original vector
// paths of public/hyperiux-icon.svg (viewBox 0 0 500 501): four filled paths
// and one stroked path (the cube outline, stroke-width 7). Nothing here is
// redrawn — the paths are parsed and sampled (see sampleLogo3D). Output is
// in logo-local metres: x right, y up, centred on the mark, scaled so the
// mark is `height` metres tall.

export const LOGO_SVG = {
  viewBox: [500, 501],
  fills: [
    "M40 13H106.261V222.826H40V13Z",
    "M459.654 487.869H393.394V278.043H459.654V487.869Z",
    "M40.1406 278.043V487.869H106.401V322.217L198.062 287.983V223.931L40.1406 278.043Z",
    "M393.527 178.653V13.0007H460.892V222.826L291.927 290.889V222.826L393.527 178.653Z",
  ],
  stroke:
    "M246.651 306.756L295.242 285.774C295.242 263.779 295.242 249.995 295.242 228L257.334 210.358C254.732 209.147 251.761 208.996 249.051 209.938L201.373 226.5V285.774L246.651 306.756ZM201.373 226.5L246.651 249.33M295.242 228L246.651 249.33M246.651 249.33V306.756",
  strokeWidth: 7,
};

// Minimal parser for the absolute commands the icon uses (M L H V C Z).
// Returns subpaths as point lists; curves are flattened finely.
function parsePath(d) {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  const paths = [];
  let cur = null;
  let x = 0;
  let y = 0;
  let i = 0;
  let cmd = null;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLHVCZ]/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === "M") {
      x = num();
      y = num();
      cur = { points: [new THREE.Vector2(x, y)], closed: false };
      paths.push(cur);
      cmd = "L"; // further pairs are implicit line-tos
    } else if (cmd === "L") {
      x = num();
      y = num();
      cur.points.push(new THREE.Vector2(x, y));
    } else if (cmd === "H") {
      x = num();
      cur.points.push(new THREE.Vector2(x, y));
    } else if (cmd === "V") {
      y = num();
      cur.points.push(new THREE.Vector2(x, y));
    } else if (cmd === "C") {
      const c1 = new THREE.Vector2(num(), num());
      const c2 = new THREE.Vector2(num(), num());
      const end = new THREE.Vector2(num(), num());
      const curve = new THREE.CubicBezierCurve(new THREE.Vector2(x, y), c1, c2, end);
      for (const p of curve.getPoints(16).slice(1)) cur.points.push(p);
      x = end.x;
      y = end.y;
    } else if (cmd === "Z") {
      cur.closed = true;
      const first = cur.points[0];
      x = first.x;
      y = first.y;
    } else {
      throw new Error(`[forging-concept] unsupported SVG path command near "${tokens[i]}"`);
    }
  }
  return paths;
}

// Segments of a point list (closing it if it is a closed path).
function segments(path) {
  const pts = path.points.slice();
  const last = pts[pts.length - 1];
  if (path.closed && !last.equals(pts[0])) pts.push(pts[0]);
  const segs = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const len = pts[k].distanceTo(pts[k + 1]);
    if (len > 1e-6) segs.push({ a: pts[k], b: pts[k + 1], len });
  }
  return segs;
}

// A point picked uniformly along a list of segments (by length), written to
// `out`; returns the unit direction of its segment (for spreading across a
// stroke or stepping inside an outline).
function alongSegments(segs, total, rng, out) {
  let r = rng() * total;
  let s = segs[segs.length - 1];
  let t = 1;
  for (const seg of segs) {
    if ((r -= seg.len) <= 0) {
      s = seg;
      t = 1 + r / seg.len;
      break;
    }
  }
  out.lerpVectors(s.a, s.b, t);
  return { tx: (s.b.x - s.a.x) / s.len, ty: (s.b.y - s.a.y) / s.len };
}

// The cube outline is an isometric drawing of a cube seen corner-on: the
// centre of its Y is the nearest corner, the Y's three outer ends its three
// neighbours, the hexagon's other three corners the next ring back. Given
// those depths, the drawing becomes a real cube whose nine visible edges line
// up exactly with the SVG when seen head-on (SVG units; z towards the viewer).
const CUBE_CENTRE = [246.651, 249.33];
const CUBE_RING1 = [[201.373, 226.5], [295.242, 228], [246.651, 306.756]]; // Y ends
const CUBE_RING2 = [[253.2, 209.4], [295.242, 285.774], [201.373, 285.774]]; // top, lower right, lower left
function cubeEdges3D() {
  // an isometric edge of length L projects to L·√(2/3); each ring of corners
  // is L/√3 further back than the last
  const spoke = Math.hypot(CUBE_RING1[0][0] - CUBE_CENTRE[0], CUBE_RING1[0][1] - CUBE_CENTRE[1]);
  const step = spoke / Math.sqrt(2 / 3) / Math.sqrt(3);
  const v = (p, z) => new THREE.Vector3(p[0], p[1], z);
  const c = v(CUBE_CENTRE, step * 1.5);
  const r1 = CUBE_RING1.map((p) => v(p, step * 0.5));
  const r2 = CUBE_RING2.map((p) => v(p, -step * 0.5));
  // the hexagon alternates ring 1 / ring 2: UL–T–UR–LR–B–LL
  const hex = [r1[0], r2[0], r1[1], r2[1], r1[2], r2[2]];
  const edges = r1.map((p) => [c, p]);
  for (let i = 0; i < 6; i++) edges.push([hex[i], hex[(i + 1) % 6]]);
  return edges;
}

// The mark as a 3D object, for the particle logo: the four filled shapes as
// solid slabs `thickness` deep (particles on their faces, round their sides
// and a few inside), and the cube outline as a real cube of round tubes the
// stroke's width across. Returns positions (logo-local metres, centred, y up,
// z towards the viewer) and per particle its kind (0 slab, 1 cube).
export function sampleLogo3D(count, { height, thickness = 0.9, seed = 17 }) {
  const rng = mulberry32(seed);
  const fills = LOGO_SVG.fills.map((d) => parsePath(d)[0]);
  const box = new THREE.Box2();
  for (const p of fills) for (const v of p.points) box.expandByPoint(v);
  for (const p of parsePath(LOGO_SVG.stroke)) for (const v of p.points) box.expandByPoint(v);
  box.expandByScalar(LOGO_SVG.strokeWidth / 2);
  const k = height / (box.max.y - box.min.y); // metres per SVG unit
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;

  const positions = new Float32Array(count * 3);
  const kinds = new Float32Array(count);
  const put = (i, sx, sy, z, kind) => {
    positions[i * 3] = (sx - cx) * k;
    positions[i * 3 + 1] = -(sy - cy) * k; // SVG y runs down
    positions[i * 3 + 2] = z;
    kinds[i] = kind;
  };

  // the slabs' faces (area-weighted) and outlines
  const tris = [];
  for (const p of fills) {
    const contour = p.points.slice();
    if (contour[contour.length - 1].equals(contour[0])) contour.pop();
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const A = contour[a];
      const B = contour[b];
      const C = contour[c];
      tris.push({ A, B, C, area: Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2 });
    }
  }
  const areaTotal = tris.reduce((s, t) => s + t.area, 0);
  const outline = fills.flatMap((p) => segments(p));
  const outlineTotal = outline.reduce((s, g) => s + g.len, 0);
  const pickTri = () => {
    let r = rng() * areaTotal;
    for (const t of tris) if ((r -= t.area) <= 0) return t;
    return tris[tris.length - 1];
  };
  const inTri = (t) => {
    let u = rng();
    let v = rng();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    return [t.A.x + (t.B.x - t.A.x) * u + (t.C.x - t.A.x) * v, t.A.y + (t.B.y - t.A.y) * u + (t.C.y - t.A.y) * v];
  };

  // the cube's tubes
  const edges = cubeEdges3D();
  const lengths = edges.map(([a, b]) => a.distanceTo(b));
  const edgeTotal = lengths.reduce((s, l) => s + l, 0);
  const tubeR = (LOGO_SVG.strokeWidth / 2) * 1.1;
  const dir = new THREE.Vector3();
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();
  const pt = new THREE.Vector2();

  // shares: the cube's tubes are thin, so they get more than their volume
  const cubeCount = Math.round(count * 0.3);
  for (let i = 0; i < count; i++) {
    if (i < cubeCount) {
      let r = rng() * edgeTotal;
      let e = 0;
      while (e < edges.length - 1 && (r -= lengths[e]) > 0) e++;
      const [a, b] = edges[e];
      dir.subVectors(b, a).normalize();
      n1.set(0, 0, 1).cross(dir);
      if (n1.lengthSq() < 1e-6) n1.set(1, 0, 0);
      n1.normalize();
      n2.crossVectors(dir, n1);
      const t = rng();
      const ang = rng() * Math.PI * 2;
      // most on the tube's surface, some inside it
      const rad = tubeR * (rng() < 0.8 ? 1 : Math.sqrt(rng()));
      const x = a.x + (b.x - a.x) * t + (n1.x * Math.cos(ang) + n2.x * Math.sin(ang)) * rad;
      const y = a.y + (b.y - a.y) * t + (n1.y * Math.cos(ang) + n2.y * Math.sin(ang)) * rad;
      const z = a.z + (b.z - a.z) * t + (n1.z * Math.cos(ang) + n2.z * Math.sin(ang)) * rad;
      put(i, x, y, z * k, 1);
      continue;
    }
    const r = rng();
    if (r < 0.5) {
      // front and back faces
      const [x, y] = inTri(pickTri());
      put(i, x, y, (rng() < 0.5 ? -0.5 : 0.5) * thickness, 0);
    } else if (r < 0.85) {
      // round the sides
      alongSegments(outline, outlineTotal, rng, pt);
      put(i, pt.x, pt.y, (rng() - 0.5) * thickness, 0);
    } else {
      // a few inside
      const [x, y] = inTri(pickTri());
      put(i, x, y, (rng() - 0.5) * thickness * 0.8, 0);
    }
  }
  return { positions, kinds, count, metresPerUnit: k };
}
