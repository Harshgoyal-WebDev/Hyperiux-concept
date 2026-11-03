import * as THREE from "three";
import { C, LI, LOGO, UNIT, V, clamp, eo, io, lerp, pip, reveal, seg, setO } from "../kit";

// 04 STRUCTURE — the plan rises; the structure is the design system.
// Blueprint ends on the plan in axonometric with its walls up. Here the walls
// settle into the plan, the structural grid A–E / 1–4 is set out with its
// bubbles, columns rise on the grid, and floors stack at different rates in
// three masses extruded from the logo (LA, LB, LC). Annotations map grid,
// columns, slabs and core onto the design system, the headline lands, the
// stack explodes into four layers (tokens, components, patterns, pages) and
// closes again, and the orange module lands on the roof — Material opens on
// the module on its plinth.
export const key = "structure";
export const name = "Structure";

// plan space: logo px (u, v) → world (x, z), 0.1 m per px (as Blueprint)
const K = 0.1, W3 = (u, v, y = 0) => new THREE.Vector3((u - 120) * K, y, (v - 120) * K), P2 = (p) => [(p[0] - 120) * K, (p[1] - 120) * K];
const FH = 2.6, SL = 0.3, NF = [7, 4, 10], LAY = [0, 1, 3, 6, 10], GAP = 4.5;
const layerOf = (j) => (j < 1 ? 0 : j < 3 ? 1 : j < 6 ? 2 : 3);
const RATE = [[0.28, 0.54], [0.29, 0.46], [0.3, 0.56]]; // floors per mass stack at their own rate
const COLS = (() => {
  const o = [[20, 5], [42, 5], [20, 39], [42, 39], [20, 73], [42, 73], [20, 112], [42, 112], [20, 150], [42, 150], [20, 190], [42, 190], [20, 235], [42, 235],
    [197, 5], [220, 5], [197, 35], [220, 35], [197, 66], [220, 66], [197, 98], [220, 94], [197, 138], [220, 138], [197, 186], [220, 186], [197, 235], [220, 235]];
  for (const u of [70, 100, 130, 160]) { const top = 108 - 0.215 * (u - 15); o.push([u, top + 6], [u, top + 30]); }
  return o;
})();
const GU = [15, 47, 120, 192, 225], GV = [0, 78, 137, 240];
const CORE = W3(120, 103);
const ANN = [
  [W3(15, 240), "Grid → 12-column layout", "One 12-col, 8 pt grid under every page."],
  [V([10.5, 13, 12]), "Columns → Components", "Components carry content like columns."],
  [V([-8.9, 18.2, -4.2]), "Slabs → Type scale", "One scale sets every level, H1 to caption."],
  [V([CORE.x, 4 * FH + 1, CORE.z]), "Core → Design tokens", "Colour, space and motion tokens."],
];
const LAYERS = ["L1 · Tokens", "L2 · Components", "L3 · Patterns", "L4 · Pages"];
const DIR = new THREE.Vector3(0.62, 0.78, 0.95).normalize(), Y = new THREE.Vector3(0, 1, 0);
// hex as stored values (the prototypes' colour handling): no sRGB → linear conversion
const raw = (h) => new THREE.Color().setStyle(h, THREE.LinearSRGBColorSpace);
const EI = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

// offset a polygon (d > 0 inward), as Blueprint's wall poché
function inset(poly, d) {
  const n = poly.length, L = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    let nx = -dz / l, nz = dx / l;
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!pip([m[0] + nx * 0.01, m[1] + nz * 0.01], poly)) { nx = -nx; nz = -nz; }
    L.push({ p: [a[0] + nx * d, a[1] + nz * d], r: [dx, dz] });
  }
  return L.map((l, i) => {
    const q = L[(i + n - 1) % n], cr = (x, y) => x[0] * y[1] - x[1] * y[0], den = cr(q.r, l.r);
    if (Math.abs(den) < 1e-9) return l.p;
    const tt = cr([l.p[0] - q.p[0], l.p[1] - q.p[1]], l.r) / den;
    return [q.p[0] + q.r[0] * tt, q.p[1] + q.r[1] * tt];
  });
}
// a plan polygon extruded 0–1 m up (scale y for height)
function extrude(outer, hole) {
  const sh = new THREE.Shape(outer.map((p) => new THREE.Vector2(p[0], -p[1])));
  if (hole) sh.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p[0], -p[1]))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function build() {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.ShadowMaterial({ opacity: 0.15 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);

  // Blueprint's walls (poché), which settle into the plan as the grid is set out
  const TH = 0.38, wallMat = new THREE.MeshStandardMaterial({ color: raw("#1b1a18"), roughness: 0.85, transparent: true });
  const walls = new THREE.Group(); root.add(walls);
  LOGO.forEach((poly) => {
    const outer = poly.map(P2), m = new THREE.Mesh(extrude(outer, inset(outer, TH)), wallMat);
    m.castShadow = m.receiveShadow = true; walls.add(m);
  });
  const XA = new THREE.Vector3(1, 0, 0);
  [[[15, 40], [47, 40]], [[15, 175], [47, 175]], [[15, 208], [47, 208]], [[75, 95.1], [75, 131.1]], [[165, 75.75], [165, 111.75]], [[192, 32], [225, 32]], [[192, 186], [225, 186]]].forEach(([a, b]) => {
    const A = W3(...a), B = W3(...b), d = new THREE.Vector3().subVectors(B, A).normalize(), A2 = A.clone().addScaledVector(d, TH * 0.6), B2 = B.clone().addScaledVector(d, -TH * 0.6);
    const m = new THREE.Mesh(UNIT, wallMat); m.castShadow = true;
    m.scale.set(A2.distanceTo(B2), 1, TH * 0.55); m.quaternion.setFromUnitVectors(XA, d); m.position.copy(A2).add(B2).multiplyScalar(0.5); m.position.y = 0.5; walls.add(m);
  });

  // structural grid A–E / 1–4: dashed ink bars, drawn on together
  const dashes = [];
  const addLine = (a, b) => { const L = a.distanceTo(b); for (let s = 0; s < L - 0.4; s += 1.4) dashes.push({ a, b, s: s / L, e: Math.min(1, (s + 0.8) / L) }); };
  GU.forEach((u) => addLine(W3(u, -30, 0.02), W3(u, 268, 0.02)));
  GV.forEach((v) => addLine(W3(-30, v, 0.02), W3(268, v, 0.02)));
  dashes.sort((p, q) => p.s - q.s);
  const gridMat = new THREE.MeshBasicMaterial({ color: C.ink, transparent: true, depthWrite: false });
  const grid = new THREE.InstancedMesh(UNIT, gridMat, dashes.length); grid.frustumCulled = false; root.add(grid);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), dv = new THREE.Vector3();
  dashes.forEach((d, i) => {
    dv.subVectors(d.b, d.a); const L = dv.length(); dv.normalize(); q.setFromUnitVectors(XA, dv);
    P.copy(d.a).lerp(d.b, (d.s + d.e) / 2); m4.compose(P, q, S.set(L * (d.e - d.s), 0.01, 0.06)); grid.setMatrixAt(i, m4);
  });
  const BUB = [...GU.map((u) => W3(u, -42)), ...GV.map((v) => W3(-42, v))];

  // columns on the grid
  const colMat = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.85, transparent: true });
  const cols = new THREE.InstancedMesh(UNIT, colMat, COLS.length); cols.castShadow = cols.receiveShadow = true; root.add(cols);
  const CP = COLS.map(([u, v]) => W3(u, v));
  const colEdgePos = new Float32Array(COLS.length * 24 * 3), colEdgeGeo = new THREE.BufferGeometry();
  colEdgeGeo.setAttribute("position", new THREE.BufferAttribute(colEdgePos, 3));
  const colEdgeMat = new THREE.LineBasicMaterial({ color: C.ink, transparent: true });
  const colEdges = new THREE.LineSegments(colEdgeGeo, colEdgeMat); colEdges.frustumCulled = false; root.add(colEdges);

  // three masses, one group per floor: a recessed floor body under a slab, each with drawn edges
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1efea, roughness: 0.92 });
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.85 });
  const bodyEdge = new THREE.LineBasicMaterial({ color: C.mute, transparent: true, opacity: 0.7 });
  const slabEdge = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.9 });
  const floors = [];
  LOGO.forEach((poly, mi) => {
    const outer = poly.map(P2), bodyG = extrude(inset(outer, 0.16)), slabG = extrude(inset(outer, -0.05));
    const bodyE = new THREE.EdgesGeometry(bodyG), slabE = new THREE.EdgesGeometry(slabG);
    for (let j = 0; j < NF[mi]; j++) {
      const g = new THREE.Group(), b = new THREE.Mesh(bodyG, bodyMat), s = new THREE.Mesh(slabG, slabMat);
      b.castShadow = b.receiveShadow = s.castShadow = s.receiveShadow = true;
      b.add(new THREE.LineSegments(bodyE, bodyEdge)); s.add(new THREE.LineSegments(slabE, slabEdge));
      g.add(b, s); g.visible = false; root.add(g);
      floors.push({ g, b, s, mi, j, L: layerOf(j) });
    }
  });

  // the core under the module: the design tokens, so it is Hyperiux's (light orange, orange edges)
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xffd9c2, roughness: 0.8 });
  const core = new THREE.Mesh(UNIT, coreMat); core.rotation.y = Math.PI / 4; core.castShadow = true;
  core.add(new THREE.LineSegments(new THREE.EdgesGeometry(UNIT), new THREE.LineBasicMaterial({ color: C.or })));
  root.add(core);

  // the module: rises out of Blueprint's atrium, lands on the roof at the end
  const cubeMat = new THREE.MeshStandardMaterial({ color: C.or, roughness: 0.55, emissive: C.or, emissiveIntensity: 0.08, transparent: true });
  const cube = new THREE.Mesh(UNIT, cubeMat); cube.castShadow = true;
  cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(UNIT), new THREE.LineBasicMaterial({ color: "#7a2c03", transparent: true })));
  root.add(cube);

  const dir = new THREE.Vector3(), tg = new THREE.Vector3(), tmp = new THREE.Vector3(), cubeP = new THREE.Vector3();

  function update(t, f) {
    const { rig, els, time } = f;
    f.sky(C.paper); f.theme(0);
    rig.hemi.intensity = 0.7 * LI; rig.amb.intensity = 0.2 * LI;
    rig.sun.intensity = 0.75 * LI; rig.sun.position.set(-36, 60, 28); rig.sun.target.position.set(0, 0, 0);
    rig.rim.intensity = 0;

    const gr = io(seg(t, 0.3, 0.62)), s0 = io(seg(t, 0, 0.2)), push = io(seg(t, 0.93, 1));
    const ex = io(seg(t, 0.78, 0.86)) * (1 - io(seg(t, 0.9, 0.98)));
    const off = (L) => L * ex * GAP;

    // camera: Blueprint's axonometric, turning slightly as the masses rise; a push onto the module at the end
    const asp = f.W / f.H, zoom = io(seg(t, 0.2, 0.62));
    let hh = f.narrow ? lerp(Math.max(19, 15.5 / asp), Math.max(27.3, 20 / asp), zoom) : lerp(21, 27.3, zoom);
    hh = lerp(hh, hh * 0.55, push);
    const side = io(seg(t, 0.68, 0.76)) * (1 - io(seg(t, 0.9, 1)));
    const sx = f.narrow ? 0 : lerp(-0.06, 0, s0) + 0.1 * side;
    const sy = f.narrow ? lerp(-0.06, -0.1, gr) : lerp(0, 0.022, s0) + 0.056 * gr * (1 - push);
    const o = f.orthoLens(hh, { x: sx, y: sy, near: 0.1, far: 400 });
    cubeP.set(CORE.x, 4 * FH + 1 + 1.6, CORE.z);
    tg.set(0, lerp(1.6, 11, gr), 0).lerp(cubeP, push * 0.8);
    dir.copy(DIR).applyAxisAngle(Y, -0.16 * io(seg(t, 0, 0.9)));
    o.up.set(0, 1, 0); o.position.copy(tg).addScaledVector(dir, 120); o.lookAt(tg);

    // walls settle into the plan, then go under the floors
    const wl = 1 - seg(t, 0.3, 0.4);
    walls.visible = wl > 0; wallMat.opacity = wl; wallMat.depthWrite = wl > 0.5;
    walls.scale.y = lerp(3.4, 0.35, io(seg(t, 0, 0.12)));

    // grid + bubbles
    const gb = seg(t, 0.05, 0.14) * (1 - seg(t, 0.58, 0.66));
    grid.visible = gb > 0; gridMat.opacity = 0.5 * gb; grid.count = Math.ceil(dashes.length * clamp(seg(t, 0.05, 0.16) * 1.02));
    BUB.forEach((p, i) => f.place(els["b" + i], p, gb, "translate(-50%,-50%)"));

    // columns rise, staggered
    const co = 1 - seg(t, 0.4, 0.46);
    cols.visible = co > 0 && t > 0.14; colEdges.visible = cols.visible; colMat.opacity = co; colEdgeMat.opacity = co;
    if (cols.visible) {
      let e = 0;
      CP.forEach((p, i) => {
        const h = Math.max(0.001, 2 * FH * eo(seg(t, 0.14 + i * 0.003, 0.26 + i * 0.003)));
        m4.compose(P.set(p.x, h / 2, p.z), q.identity(), S.set(0.55, h, 0.55)); cols.setMatrixAt(i, m4);
        const c = [];
        for (const y of [0, h]) for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.push(p.x + dx * 0.275, y, p.z + dz * 0.275);
        for (const [a, b] of EI) { colEdgePos[e++] = c[a * 3]; colEdgePos[e++] = c[a * 3 + 1]; colEdgePos[e++] = c[a * 3 + 2]; colEdgePos[e++] = c[b * 3]; colEdgePos[e++] = c[b * 3 + 1]; colEdgePos[e++] = c[b * 3 + 2]; }
      });
      cols.instanceMatrix.needsUpdate = true; colEdgeGeo.attributes.position.needsUpdate = true;
    }

    // floors stack, each mass at its own rate; the exploded view lifts the four layers apart
    const nf = RATE.map(([a, b], mi) => NF[mi] * io(seg(t, a, b)));
    floors.forEach((fl) => {
      const k = eo(clamp(nf[fl.mi] - fl.j)), h = FH * k;
      fl.g.visible = k > 0.001;
      if (!fl.g.visible) return;
      const sh = Math.min(SL, h), bh = Math.max(0.001, h - sh);
      fl.g.position.y = fl.j * FH + off(fl.L);
      fl.b.scale.y = bh; fl.s.position.y = bh; fl.s.scale.y = Math.max(0.001, sh);
    });

    // core follows the beam's roof; its stub carries the module
    const coreH = FH * nf[1] + seg(t, 0.46, 0.52) + off(2);
    core.visible = coreH > 0.01;
    core.position.set(CORE.x, coreH / 2, CORE.z); core.scale.set(2.2, Math.max(0.01, coreH), 2.2);

    // module: lifts out of frame at the start, lands on the roof at the end
    const up = io(seg(t, 0, 0.1)), cb = seg(t, 0.9, 1);
    if (t < 0.12) {
      cube.visible = up < 1; cubeMat.opacity = 1 - seg(t, 0.06, 0.1);
      cube.position.set(CORE.x, lerp(6.8, 34, up), CORE.z); cube.scale.setScalar(2.4); cube.rotation.y = Math.PI / 4 + time * 0.3;
    } else {
      cube.visible = cb > 0; cubeMat.opacity = Math.min(1, cb * 2.5);
      cube.position.set(CORE.x, 4 * FH + 1 + 1.6 + (1 - eo(cb)) * 9, CORE.z); cube.scale.setScalar(3.2);
      cube.rotation.y = Math.PI / 4 + (1 - eo(cb)) * 1.6;
    }
    cube.children[0].material.opacity = cubeMat.opacity;

    // annotations: structure → design system
    const an = seg(t, 0.62, 0.69) * (1 - seg(t, 0.74, 0.78));
    setO(els.ann, an); setO(els.lead, an);
    if (an > 0) {
      ANN.forEach(([p], i) => {
        const [px, py] = f.project(p);
        els["a" + i].setAttribute("cx", px.toFixed(1)); els["a" + i].setAttribute("cy", py.toFixed(1));
        f.place(els["n" + i], p, 1, "translate(-50%,-50%)");
        if (f.narrow) { els["p" + i].setAttribute("d", ""); els["r" + i].style.transform = ""; return; }
        const tx = f.W - Math.max(32, f.W * 0.05) - 330, y = f.H * 0.22 + i * Math.min(112, f.H * 0.125);
        els["r" + i].style.transform = `translate(${tx}px,${(y - 12).toFixed(1)}px)`;
        els["p" + i].setAttribute("d", `M${px.toFixed(1)} ${py.toFixed(1)}L${tx - 34} ${(y - 2).toFixed(1)}L${tx - 10} ${(y - 2).toFixed(1)}`);
      });
    } else ANN.forEach((_, i) => setO(els["n" + i], 0));

    // headline
    const hp = seg(t, 0.7, 0.77);
    setO(els.h1, hp > 0 ? 1 - seg(t, 0.9, 0.96) : 0); reveal(els.h1, hp);

    // exploded layer labels
    setO(els.lay, ex > 0.02 ? ex : 0);
    if (ex > 0.02) {
      const lx = f.narrow ? f.W - 112 : f.W - Math.max(32, f.W * 0.05) - 170;
      LAYERS.forEach((_, j) => {
        const ym = ((LAY[j] + LAY[j + 1]) / 2) * FH + off(j), [px, py] = f.project(tmp.set(10.5, ym, 12));
        els["ll" + j].setAttribute("x1", (px + 8).toFixed(1)); els["ll" + j].setAttribute("x2", (lx - 10).toFixed(1));
        els["ll" + j].setAttribute("y1", py.toFixed(1)); els["ll" + j].setAttribute("y2", py.toFixed(1));
        els["lt" + j].style.transform = `translate(${lx}px,${py.toFixed(1)}px) translateY(-50%)`;
      });
    }

    setO(els.next, seg(t, 0.93, 1));
  }

  return { root, update };
}

export function Overlay() {
  return (
    <>
      {[..."ABCDE", "1", "2", "3", "4"].map((n, i) => (
        <div key={n} className="ac-lbl ac-structure-bub ac-mono" data-k={"b" + i}>{n}</div>
      ))}
      <svg className="ac-structure-svg" data-k="lead" aria-hidden="true">
        {ANN.map((a, i) => (
          <g key={a[1]}><path data-k={"p" + i} d="" /><circle data-k={"a" + i} r="4.5" /></g>
        ))}
      </svg>
      {ANN.map((a, i) => (
        <div key={a[1]} className="ac-lbl ac-structure-num ac-mono" data-k={"n" + i}>{i + 1}</div>
      ))}
      <ol className="ac-structure-ann" data-k="ann">
        {ANN.map(([, h, d], i) => (
          <li key={h} data-k={"r" + i}><b className="ac-mono"><i>{i + 1}</i>{h}</b><span>{d}</span></li>
        ))}
      </ol>
      <div className="ac-structure-lay" data-k="lay">
        <svg aria-hidden="true">
          {LAYERS.map((n, j) => <line key={n} data-k={"ll" + j} />)}
        </svg>
        {LAYERS.map((n, j) => <div key={n} className="ac-mono" data-k={"lt" + j}>{n}</div>)}
      </div>
      <div className="ac-structure-hd" data-k="h1">
        <h2 className="ac-hl"><span className="ln"><span>Design systems</span></span><span className="ln"><span>are load-</span></span><span className="ln"><span><em>bearing.</em></span></span></h2>
      </div>
      <div className="ac-next ac-mono" data-k="next">[ Structure → Material ]</div>
    </>
  );
}
