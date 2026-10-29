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

// The mark as a solid, for the particle body: the flat logo extruded
// `thickness` deep — the four filled shapes as slabs (particles on their
// faces, round their sides and some inside), and the cube outline as the
// flat stroke it is in the logo (the SVG's own path, its 7-unit width,
// through the same depth), so its faces stay empty — all at one density, so
// the cube reads as part of the mark. Returns positions
// (logo-local metres, centred, y up, z towards the viewer) and per particle
// its kind (0 slab, 1 cube outline).
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

  // the cube outline: along the stroke's centre line, across its width
  const stroke = parsePath(LOGO_SVG.stroke);
  const strokeSegs = stroke.flatMap((p) => segments(p));
  const strokeTotal = strokeSegs.reduce((acc, g) => acc + g.len, 0);
  const pt = new THREE.Vector2();

  // shares by surface (metres²), so the cube outline and the slabs are
  // equally dense — one solid, not a bright cube set into dimmer arms: the
  // slabs' faces, their sides, the outline's faces and sides, and some
  // inside for body (so it reads as a solid, not a shell)
  const faces = 2 * areaTotal * k * k;
  const sides = outlineTotal * k * thickness;
  const stroked = strokeTotal * k * (2 * LOGO_SVG.strokeWidth * k + 2 * thickness);
  const shell = faces + sides + stroked;
  const inside = 0.14;
  const cubeShare = (stroked / shell) * (1 - inside);
  const faceShare = (faces / shell) * (1 - inside);
  const sideShare = (sides / shell) * (1 - inside);
  const cubeCount = Math.round(count * cubeShare);
  for (let i = 0; i < count; i++) {
    if (i < cubeCount) {
      const { tx, ty } = alongSegments(strokeSegs, strokeTotal, rng, pt);
      // its faces (front and back) or its sides (along the stroke's edges)
      const faceSide = rng() < (2 * LOGO_SVG.strokeWidth * k) / (2 * LOGO_SVG.strokeWidth * k + 2 * thickness);
      const across = faceSide ? (rng() - 0.5) * LOGO_SVG.strokeWidth : (rng() < 0.5 ? -0.5 : 0.5) * LOGO_SVG.strokeWidth;
      const z = faceSide ? (rng() < 0.5 ? -0.5 : 0.5) * thickness : (rng() - 0.5) * thickness;
      put(i, pt.x - ty * across, pt.y + tx * across, z, 1);
      continue;
    }
    const r = rng() * (1 - cubeShare);
    if (r < faceShare) {
      // front and back faces
      const [x, y] = inTri(pickTri());
      put(i, x, y, (rng() < 0.5 ? -0.5 : 0.5) * thickness, 0);
    } else if (r < faceShare + sideShare) {
      // round the sides
      alongSegments(outline, outlineTotal, rng, pt);
      put(i, pt.x, pt.y, (rng() - 0.5) * thickness, 0);
    } else {
      // inside
      const [x, y] = inTri(pickTri());
      put(i, x, y, (rng() - 0.5) * thickness * 0.85, 0);
    }
  }
  return { positions, kinds, count, metresPerUnit: k };
}

// ---------------------------------------------------------------------------
// The other forms the particle body takes in the garden. Each is a volume:
// most particles on or near its surface (so the silhouette reads crisply),
// the rest filling it. Positions in metres, centred on the origin.
// ---------------------------------------------------------------------------

// a cube turned corner-on to the viewer, like the one in the mark
export function sampleCube(count, { size = 6, seed = 31 } = {}) {
  const rng = mulberry32(seed);
  const out = new Float32Array(count * 3);
  const h = size / 2;
  const turn = new THREE.Matrix4().makeRotationX(Math.atan(1 / Math.SQRT2)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 4));
  const p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    p.set((rng() * 2 - 1) * h, (rng() * 2 - 1) * h, (rng() * 2 - 1) * h);
    if (rng() < 0.75) {
      // onto a face (pushed in a little: a skin, not a sheet)
      const axis = Math.floor(rng() * 3);
      p.setComponent(axis, Math.sign(p.getComponent(axis) || 1) * h * (1 - rng() * 0.08));
    }
    p.applyMatrix4(turn);
    out.set([p.x, p.y, p.z], i * 3);
  }
  return out;
}

// a ring facing the viewer (+z): the way through
export function sampleTorus(count, { radius = 4.6, tube = 1.25, seed = 53 } = {}) {
  const rng = mulberry32(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const b = rng() * Math.PI * 2;
    const r = tube * (rng() < 0.7 ? 0.85 + rng() * 0.15 : Math.sqrt(rng()));
    const ring = radius + Math.cos(b) * r;
    out.set([Math.cos(a) * ring, Math.sin(a) * ring, Math.sin(b) * r], i * 3);
  }
  return out;
}
