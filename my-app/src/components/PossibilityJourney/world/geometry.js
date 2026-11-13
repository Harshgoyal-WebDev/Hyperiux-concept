import * as THREE from "three";

// Builders for the architecture: portal walls (a slab with an arched or
// elliptical opening down to the floor), curved walls (a ring sector
// standing up) and ceilings with an oculus. All are real solids with
// softened (bevelled) edges, built once.

// A wall's face: a rectangle with an opening from the floor, the opening's
// top round (a semicircle on its springing line) or elliptical.
// width/height: the slab; half: the opening's half-width at the floor;
// spring: where the round top begins; ellipse: { ry } for an elliptical one.
export function portalShape({ width, height, half, spring = 0, ellipse = null, segments = 48 }) {
  const W = width / 2;
  const s = new THREE.Shape();
  s.moveTo(-W, 0);
  s.lineTo(-half, 0);
  if (ellipse) {
    // the left foot, up over the top, down to the right foot
    const ry = ellipse.ry;
    const cy = ellipse.cy ?? 0;
    for (let i = 0; i <= segments; i++) {
      const a = Math.PI - (i / segments) * Math.PI;
      const x = Math.cos(a) * half;
      const y = Math.max(0, cy + Math.sin(a) * ry);
      s.lineTo(x, y);
    }
  } else {
    s.lineTo(-half, spring);
    s.absarc(0, spring, half, Math.PI, 0, true);
    s.lineTo(half, 0);
  }
  s.lineTo(W, 0);
  s.lineTo(W, height);
  s.lineTo(-W, height);
  s.lineTo(-W, 0);
  return s;
}

// a shape extruded into a slab `depth` thick, centred on z = 0, edges softened
export function slab(shape, depth, bevel = 0.18, curveSegments = 48) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments,
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

// Bend a slab round a vertical axis: its two ends curve toward +z, so a
// flat wall becomes a sculptural shell embracing the space in front of it.
export function bendX(geo, radius) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = x / radius;
    const r = radius - z;
    p.setXYZ(i, Math.sin(a) * r, p.getY(i), radius - Math.cos(a) * r);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// A curved wall: the ring sector between radius R and R + thick, from angle
// a0 to a1 (world xz: a point is centre + R·(cos a, sin a)), standing up
// `height`. Built in the shape plane as (x, -z), extruded upward.
export function curvedWall({ cx = 0, cz = 0, R, thick = 1.2, a0, a1, height, bevel = 0.15, segments = 96 }) {
  const s = new THREE.Shape();
  const pt = (r, a) => [cx + Math.cos(a) * r, -(cz + Math.sin(a) * r)];
  s.moveTo(...pt(R, a0));
  for (let i = 1; i <= segments; i++) s.lineTo(...pt(R, a0 + ((a1 - a0) * i) / segments));
  for (let i = segments; i >= 0; i--) s.lineTo(...pt(R + thick, a0 + ((a1 - a0) * i) / segments));
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// A ceiling: a disc (radius R) with an off-centre-able round oculus (radius
// r), `thick` deep, its underside at y = 0.
export function oculusCeiling({ R, r, thick = 1.6, ox = 0, oz = 0 }) {
  const s = new THREE.Shape();
  s.absarc(0, 0, R, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(ox, -oz, r, 0, Math.PI * 2, true);
  s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 3, curveSegments: 96 });
  g.rotateX(-Math.PI / 2);
  return g;
}
