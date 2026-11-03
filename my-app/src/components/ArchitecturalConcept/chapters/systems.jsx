import * as THREE from "three";
import { C, LOGO, UNIT, V, bar, clamp, dotTexture, eo, io, keys, lerp, mixHex, reveal, rng, seg, setBar, setO } from "../kit";

// 06 SYSTEMS — what you don't see holds everything up. Night, edge-only on
// black (Zeggo): Material's wire fins give way to the three logo masses
// drawn as edges with a line at every floor, over a faint ground grid. The
// module lifts into the joint. Orange risers light up through every core,
// data runs along the floors as moving dashes, and the four technology
// services step down the page: a wire module spinning in the core (01), a
// performance budget (02), CMS nodes wired to the risers (03) and growth
// lines running to the horizon (04). The statement lands, then the camera
// pulls back over a district of wire buildings: District's opening aerial.
export const key = "systems";
export const name = "Systems";

// storyboard geometry (engine ch4/ch5): plan scale 0.1 m per px, 2.6 m floors
const kP = 0.1, FH = 2.6, NF = [7, 4, 10];
const mapP = (u, v, w) => new THREE.Vector3((u - 120) * kP, w, (v - 120) * kP);
const RIS = [[31, 39, 0], [31, 190, 1], [120, 103, 1], [208, 35, 1], [208, 186, 2]];
const ITEMS = [
  ["01", "Motion & WebGL", "Scroll-driven 3D, shaders and GSAP that load fast and degrade gracefully.", 0.4],
  ["02", "Performance", "Core Web Vitals budgets on every build, set before design starts.", 0.5],
  ["03", "Headless CMS", "Sanity and Strapi structures your team can edit without breaking the build.", 0.6],
  ["04", "Organic growth", "Technical SEO, schema and content architecture built into the frame.", 0.7],
];
const BUDGET = [["LCP", "< 2.0 s", 0.78], ["INP", "< 200 ms", 0.66], ["CLS", "< 0.05", 0.9], ["Lighthouse", "≥ 95", 0.95]];
const NODES = ["Pages", "Posts", "Case studies", "Media", "Authors", "Locales", "Forms", "Products", "SEO"];

// Material's last frame: 44 wire fins on an 18 m arc, the module on a plinth
const FN = 44, FW = 0.42, FD = 2.8;
const EI = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
function finLines() {
  const out = [];
  for (let i = 0; i < FN; i++) {
    const a = -1.25 + (2.5 * i) / (FN - 1), x = 18 * Math.sin(a), z = 6 - 18 * Math.cos(a), rot = Math.PI - a;
    const h = 7 + 13 * Math.pow(Math.sin((Math.PI * (i + 0.5)) / FN), 1.4) + 2.2 * Math.sin(i * 0.62);
    const c = Math.cos(rot), s = Math.sin(rot), P = [];
    for (const y of [0, h]) for (const [lx, lz] of [[-FW / 2, -FD / 2], [FW / 2, -FD / 2], [FW / 2, FD / 2], [-FW / 2, FD / 2]]) P.push([x + lx * c + lz * s, y, z - lx * s + lz * c]);
    for (const [p, q] of EI) out.push(...P[p], ...P[q]);
  }
  return out;
}

// District's layout (hyperiux-district.html), so the pull-back lands on its first frame
const RD = new THREE.Vector3(1, 0, -0.45).normalize(), RN = new THREE.Vector3(0.45, 0, 1).normalize(), RR = 0.42;
const road = (s) => RD.clone().multiplyScalar(s);
const BLD = [0, 1, 2, 3, 4].map((j) => ({ side: j % 2 ? 1 : -1, P: road(-48 + 24 * j).addScaledVector(RN, (j % 2 ? 1 : -1) * 15) }));

const K = [
  [0, V([0, 34, 40]), V([0, 4, -4])], [0.111, V([40, 36, 62]), V([0, 10, 0])], [0.222, V([34, 20, 44]), V([0, 11, 0])],
  [0.42, V([-36, 24, 50]), V([0, 12, 0])], [0.62, V([-48, 32, 24]), V([0, 11, 0])], [0.8, V([0, 18, 68]), V([0, 11, 0])],
  [0.88, V([0, 20, 72]), V([0, 11, 0])], [1, V([0, 95, 85]), V([0, 0, -5])],
];

const lineSet = (pos, mat) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, mat);
};

export function build() {
  const root = new THREE.Group();
  const dot = dotTexture();

  // ground + faint grid
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x0e0e10 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; root.add(ground);
  const gp = [];
  for (let v = -160; v <= 160; v += 4) gp.push(v, 0.01, -160, v, 0.01, 160, -160, 0.01, v, 160, 0.01, v);
  const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, depthWrite: false });
  root.add(lineSet(gp, gridMat));

  // Material's wire fins and plinth, fading out as the masses draw in
  const finMat = new THREE.LineBasicMaterial({ color: 0xd2d2d8, transparent: true, depthWrite: false });
  root.add(lineSet(finLines(), finMat));
  const plMat = new THREE.LineBasicMaterial({ color: 0x6a6a70, transparent: true, depthWrite: false });
  const plinth = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(7, 1.2, 7)), plMat);
  plinth.position.y = 0.6; root.add(plinth);

  // the three masses: black fills (hidden-line removal), edges, a line at every floor
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x0d0d0f, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xc9c9ce, transparent: true });
  const floorMat = new THREE.LineBasicMaterial({ color: 0x55555b, transparent: true });
  const masses = LOGO.map((P, mi) => {
    const shape = new THREE.Shape(P.map(([u, v]) => new THREE.Vector2((u - 120) * kP, -(v - 120) * kP)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, fillMat), new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    root.add(g);
    const fp = [];
    for (let k = 1; k < NF[mi]; k++) for (let i = 0; i < P.length; i++) {
      const a = mapP(...P[i], k * FH), b = mapP(...P[(i + 1) % P.length], k * FH);
      fp.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const floors = lineSet(fp, floorMat); root.add(floors);
    return { g, floors, per: P.length * 2, H: NF[mi] * FH };
  });

  // risers: a thick orange bar and a soft wider glow through every core
  const xr = { depthTest: false, depthWrite: false, transparent: true };
  const rCore = new THREE.MeshBasicMaterial({ color: C.or, ...xr });
  const rGlow = new THREE.MeshBasicMaterial({ color: C.or, opacity: 0.2, blending: THREE.AdditiveBlending, ...xr });
  const risers = RIS.map(([u, v, mi]) => {
    const a = mapP(u, v, 0), b = mapP(u, v, NF[mi] * FH);
    const core = bar(a, b, 0.26, rCore), glow = bar(a, b, 1.15, rGlow);
    core.renderOrder = glow.renderOrder = 6; root.add(glow, core);
    return { core, glow, top: b };
  });
  const tipGeo = new THREE.BufferGeometry();
  tipGeo.setAttribute("position", new THREE.Float32BufferAttribute(risers.flatMap((r) => [r.top.x, r.top.y, r.top.z]), 3));
  const tipMat = new THREE.PointsMaterial({ map: dot, color: 0xffd2b8, size: 11, sizeAttenuation: false, ...xr });
  const tips = new THREE.Points(tipGeo, tipMat); tips.renderOrder = 7; root.add(tips);

  // data flows: dashes moving along each floor (beam path through LB, loops in LA and LC)
  const flows = [];
  const addFlow = (pts, closed) => {
    const P = pts.map((p) => p.clone()); if (closed) P.push(P[0].clone());
    const cum = [0], dir = [], q = [];
    for (let i = 1; i < P.length; i++) {
      const d = new THREE.Vector3().subVectors(P[i], P[i - 1]); cum.push(cum[i - 1] + d.length()); d.normalize();
      dir.push(d); q.push(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d));
    }
    flows.push({ P, cum, dir, q, L: cum[cum.length - 1] });
  };
  const beam = [[31, 190], [31, 118], [120, 103], [208, 84], [208, 35]];
  const loopA = [[21, 6], [41, 6], [41, 72], [21, 72]], loopC = [[198, 139], [219, 139], [219, 234], [198, 234]];
  for (let k = 1; k <= 9; k++) {
    if (k < NF[1]) addFlow(beam.map(([u, v]) => mapP(u, v, k * FH + 0.05)), false);
    if (k < NF[0]) addFlow(loopA.map(([u, v]) => mapP(u, v, k * FH + 0.05)), true);
    if (k < NF[2]) addFlow(loopC.map(([u, v]) => mapP(u, v, k * FH + 0.05)), true);
  }
  const PER = 1.5, DL = 0.75;
  const nDash = flows.reduce((s, fl) => s + Math.ceil(fl.L / PER), 0);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a, ...xr });
  const dashes = new THREE.InstancedMesh(UNIT, dashMat, nDash);
  dashes.frustumCulled = false; dashes.renderOrder = 6; root.add(dashes);
  const pkGeo = new THREE.BufferGeometry(), pkPos = new Float32Array(flows.length * 3);
  pkGeo.setAttribute("position", new THREE.BufferAttribute(pkPos, 3));
  const pkMat = new THREE.PointsMaterial({ map: dot, color: 0xffd2b8, size: 7, sizeAttenuation: false, ...xr });
  const packets = new THREE.Points(pkGeo, pkMat); packets.frustumCulled = false; packets.renderOrder = 7; root.add(packets);

  // the module: Material's cube, lifted into the joint as a spinning wire module
  const cube = new THREE.Group(); root.add(cube);
  const cubeFillMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2e, ...xr });
  const cubeFill = new THREE.Mesh(UNIT, cubeFillMat); cubeFill.renderOrder = 8; cube.add(cubeFill);
  const cubeEdgeMat = new THREE.MeshBasicMaterial({ color: C.or, ...xr });
  for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) {
    for (const [p, q] of [[[-0.5, a, b], [0.5, a, b]], [[a, -0.5, b], [a, 0.5, b]], [[a, b, -0.5], [a, b, 0.5]]]) {
      const m = bar(V(p), V(q), 0.028, cubeEdgeMat); m.scale.x += 0.028; m.renderOrder = 9; cube.add(m);
    }
  }
  const coreMat = new THREE.LineBasicMaterial({ color: 0xffb27a, ...xr });
  const coreWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.34, 0)), coreMat);
  coreWire.renderOrder = 9; cube.add(coreWire);
  const C0 = new THREE.Vector3(0, 2.8, 0), C1 = new THREE.Vector3(0, 4 * FH + 2.5 + 1.8, -1.7);
  let spin = Math.PI / 4, lastTime = 0;

  // 03: CMS nodes on a ring, wired to the riser tops
  const R4 = rng(4);
  const nodes = NODES.map((_, i) => {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    return { p: new THREE.Vector3(22 * Math.cos(a), 3 + R4() * 14, 22 * Math.sin(a)), q: risers[i % 5].top };
  });
  const lkGeo = new THREE.BufferGeometry(), lkPos = new Float32Array(nodes.length * 6);
  lkGeo.setAttribute("position", new THREE.BufferAttribute(lkPos, 3));
  const lkMat = new THREE.LineDashedMaterial({ color: 0x9a9aa0, dashSize: 0.45, gapSize: 0.45, transparent: true, depthWrite: false });
  const links = new THREE.LineSegments(lkGeo, lkMat); links.frustumCulled = false; root.add(links);

  // 04: growth lines running out to the horizon, with pulses travelling on them
  const gMat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true, opacity: 0.6, depthWrite: false });
  const growth = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const m = bar(V([14 * Math.cos(a), 0.03, 14 * Math.sin(a)]), V([170 * Math.cos(a), 0.03, 170 * Math.sin(a)]), 0.16, gMat, 0.02);
    root.add(m); return { a, m };
  });
  const puGeo = new THREE.BufferGeometry(), puPos = new Float32Array(28 * 3);
  puGeo.setAttribute("position", new THREE.BufferAttribute(puPos, 3));
  const puMat = new THREE.PointsMaterial({ map: dot, color: 0xffa060, size: 6, sizeAttenuation: false, transparent: true, depthWrite: false });
  const pulses = new THREE.Points(puGeo, puMat); pulses.frustumCulled = false; root.add(pulses);

  // pull-back: District's buildings and road as wire on black
  const dFill = new THREE.MeshBasicMaterial({ color: 0x0f0f11, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const dEdge = new THREE.LineBasicMaterial({ color: 0x4a4a52, transparent: true });
  const dProj = new THREE.LineBasicMaterial({ color: 0x9a9aa2, transparent: true });
  const dist = new THREE.Group(); root.add(dist);
  const fillEdges = [], projEdges = [], tmp = new THREE.Matrix4();
  const r21 = rng(21), lots = [];
  for (let i = 0; i < 120; i++) {
    const s = -100 + r21() * 200, side = r21() < 0.5 ? -1 : 1, off = side * (9 + r21() * 46), p = road(s).addScaledVector(RN, off);
    const w = 4 + r21() * 5, d = 4 + r21() * 5, h = 3 + r21() * 14;
    if (BLD.some((b) => Math.hypot(b.P.x - p.x, b.P.z - p.z) < 13)) continue;
    lots.push([p, w, d, h]);
  }
  const lotMesh = new THREE.InstancedMesh(UNIT, dFill, lots.length);
  const qR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), RR), boxEdges = new THREE.EdgesGeometry(UNIT).attributes.position.array;
  lots.forEach(([p, w, d, h], i) => {
    tmp.compose(new THREE.Vector3(p.x, h / 2, p.z), qR, new THREE.Vector3(w, h, d)); lotMesh.setMatrixAt(i, tmp);
    const v = new THREE.Vector3();
    for (let k = 0; k < boxEdges.length; k += 3) { v.fromArray(boxEdges, k).applyMatrix4(tmp); fillEdges.push(v.x, v.y, v.z); }
  });
  dist.add(lotMesh);
  BLD.forEach((b, j) => {
    const G = new THREE.Group(); G.position.copy(b.P); G.rotation.y = RR; dist.add(G);
    const add = (geo, y, rotY = 0, lx = 0, lz = 0) => { const m = new THREE.Mesh(geo, dFill); m.position.set(lx, y, lz); m.rotation.y = rotY; G.add(m); return m; };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    if (j === 0) { add(B(10, 8, 10), 4); add(B(9, 7, 9), 11.5, 0, 1.5, 1); add(B(8, 6, 8), 18, 0, -1, 2); }
    if (j === 1) { add(new THREE.CylinderGeometry(6, 6, 26, 12), 13); add(new THREE.CylinderGeometry(4.4, 4.4, 3, 12), 27.5); }
    if (j === 2) { add(B(16, 4, 10), 2); add(B(22, 1, 13), 4.5, 0, 3); add(B(6, 3, 6), 6.5, 0, -3); }
    if (j === 3) add(B(7, 32, 3.2), 16);
    if (j === 4) for (let i = 0; i < 9; i++) add(B(8, 3.4, 8), 1.7 + i * 3.4, i * 0.12);
  });
  dist.updateMatrixWorld(true);
  dist.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh) return;
    const e = new THREE.EdgesGeometry(m.geometry, 20).applyMatrix4(m.matrixWorld).attributes.position.array;
    for (let k = 0; k < e.length; k++) projEdges.push(e[k]);
  });
  dist.add(lineSet(fillEdges, dEdge), lineSet(projEdges, dProj));
  const roadPos = [];
  for (const o of [-4, 4]) { const a = road(-150).addScaledVector(RN, o), b = road(150).addScaledVector(RN, o); roadPos.push(a.x, 0.04, a.z, b.x, 0.04, b.z); }
  const roadMat = new THREE.LineBasicMaterial({ color: 0x56565c, transparent: true });
  dist.add(lineSet(roadPos, roadMat));
  const cl = lineSet([...road(-150).setY(0.05).toArray(), ...road(150).setY(0.05).toArray()], new THREE.LineDashedMaterial({ color: C.or, dashSize: 1.1, gapSize: 0.9, transparent: true }));
  cl.computeLineDistances(); dist.add(cl);

  // reusable scratch
  const m4 = new THREE.Matrix4(), P = new THREE.Vector3(), Sd = new THREE.Vector3(DL, 0.12, 0.12);
  const off = new THREE.Vector3(), tmpV = new THREE.Vector3();

  function bind(els) {
    els.items = [0, 1, 2, 3].map((i) => els["i" + i]);
    els.bars = [0, 1, 2, 3].map((i) => els["b" + i]);
    els.nodes = NODES.map((_, i) => els["n" + i]);
  }

  function update(t, f) {
    const { rig, els, time } = f;
    const dt = Math.min(0.1, Math.max(0, time - lastTime)); lastTime = time;

    // camera: from Material's last frame around the building, then up to District's aerial
    const [pos, tg] = keys(K, t);
    const pk = 1 - seg(t, 0.9, 1);
    pos.x += f.px * 2 * pk; pos.y -= f.py * 1.2 * pk;
    const lx = f.narrow ? 0 : 0.12 * (io(seg(t, 0.36, 0.42)) - io(seg(t, 0.78, 0.82)));
    f.lens(lerp(42, 44, seg(t, 0, 0.12)), { x: lx, far: 700 }); f.cam.position.copy(pos); f.cam.lookAt(tg);

    // night: no light needed, everything is edge-drawn; fog sinks the far grid into the sky
    f.theme(1);
    const skyB = mixHex("#151516", "#141417", seg(t, 0.85, 1));
    f.sky(C.night, skyB);
    rig.fog.color.set(skyB); rig.fog.near = lerp(50, 80, seg(t, 0.85, 1)); rig.fog.far = lerp(140, 260, seg(t, 0.85, 1));
    rig.hemi.intensity = 0; rig.sun.intensity = 0;
    gridMat.opacity = 0.03 + 0.07 * seg(t, 0.05, 0.18);

    // Material's fins dissolve as the masses draw in, floor by floor
    const fo = 1 - seg(t, 0.02, 0.1);
    finMat.opacity = 0.95 * fo; plMat.opacity = 0.8 * fo; finMat.visible = plMat.visible = fo > 0;
    const df = seg(t, 0.86, 0.98), mo = (1 - 0.45 * seg(t, 0.8, 0.86)) * (1 - seg(t, 0.94, 1));
    edgeMat.opacity = 0.95 * mo; floorMat.opacity = 0.9 * mo;
    masses.forEach((m, mi) => {
      const g = eo(seg(t, 0.005 + mi * 0.02, 0.1 + mi * 0.02)), h = Math.max(1e-3, m.H * g);
      m.g.scale.y = h; m.g.visible = g > 0 && mo > 0;
      const n = Math.min(NF[mi] - 1, Math.floor(h / FH + 1e-3));
      m.floors.geometry.setDrawRange(0, n * m.per); m.floors.visible = n > 0 && mo > 0;
    });

    // risers light up through every core
    const rd = 1 - 0.4 * seg(t, 0.8, 0.86) - 0.6 * seg(t, 0.94, 1);
    rCore.opacity = rd; rGlow.opacity = 0.2 * rd * (0.85 + 0.15 * Math.sin(time * 2.4));
    risers.forEach((r, i) => {
      const p = eo(seg(t, 0.18 + i * 0.02, 0.28 + i * 0.02));
      setBar(r.core, p); setBar(r.glow, p);
    });
    tipMat.opacity = seg(t, 0.28, 0.32) * rd; tips.visible = tipMat.opacity > 0;

    // data flows along each floor, bottom up
    const fl = seg(t, 0.28, 0.38) * rd;
    let di = 0;
    flows.forEach((w, i) => {
      const k = clamp(fl * flows.length * 0.6 - i * 0.4);
      if (k <= 0) { pkPos[i * 3 + 1] = -1e3; return; }
      const n = Math.ceil(w.L / PER), o = (time * 2.4 + t * 40 + i * 0.37) % PER;
      let j = 0;
      for (let d = 0; d < n; d++) {
        const s = d * PER + o; if (s > w.L * k) break;
        while (j < w.dir.length - 1 && s > w.cum[j + 1]) j++;
        P.copy(w.P[j]).addScaledVector(w.dir[j], s - w.cum[j]);
        m4.compose(P, w.q[j], Sd); dashes.setMatrixAt(di++, m4);
      }
      const s = ((time * 0.11 + i * 0.137) % 1) * w.L * k;
      let jj = 0; while (jj < w.dir.length - 1 && s > w.cum[jj + 1]) jj++;
      P.copy(w.P[jj]).addScaledVector(w.dir[jj], s - w.cum[jj]); P.toArray(pkPos, i * 3);
    });
    dashes.count = di; dashes.instanceMatrix.needsUpdate = true; dashes.visible = di > 0;
    dashMat.opacity = clamp(fl * 3) * rd; pkMat.opacity = dashMat.opacity; pkGeo.attributes.position.needsUpdate = true;

    // the module: lifts from the plinth into the joint; spins in the core during 01
    const lift = io(seg(t, 0.04, 0.3)), w01 = seg(t, 0.4, 0.44) * (1 - seg(t, 0.5, 0.56));
    cube.position.lerpVectors(C0, C1, lift); cube.scale.setScalar(lerp(3.2, 3.6, lift));
    spin += dt * (0.2 + 2.2 * w01); cube.rotation.set(0.35 * w01 * Math.sin(time * 0.9), spin, 0);
    coreWire.rotation.set(-time * 0.8, -spin * 1.6, time * 0.5);
    const co = 1 - 0.5 * seg(t, 0.8, 0.86) - 0.5 * seg(t, 0.94, 1);
    cubeFillMat.opacity = lerp(0.55, 0.12, lift) * co; cubeEdgeMat.opacity = co; coreMat.opacity = seg(t, 0.38, 0.44) * co;
    f.place(els.mod, tmpV.copy(cube.position).add(off.set(0, 3.4, 0)), w01, "translate(-50%,-100%)");

    // 03 CMS nodes linked to the risers
    const nd = seg(t, 0.6, 0.66) * (1 - seg(t, 0.8, 0.86));
    nodes.forEach((n, i) => {
      const k = eo(seg(t, 0.6 + i * 0.006, 0.66 + i * 0.006));
      n.p.toArray(lkPos, i * 6); tmpV.lerpVectors(n.p, n.q, k).toArray(lkPos, i * 6 + 3);
      f.place(els.nodes[i], n.p, nd, "translate(-6px,-6px)");
    });
    if (nd > 0) { lkGeo.attributes.position.needsUpdate = true; links.computeLineDistances(); }
    lkMat.opacity = 0.75 * nd; links.visible = nd > 0;

    // 04 organic growth to the horizon
    const og = seg(t, 0.7, 0.78) * (1 - seg(t, 0.8, 0.86));
    const gk = eo(seg(t, 0.7, 0.78));
    growth.forEach((g) => setBar(g.m, gk));
    gMat.opacity = 0.6 * og; gMat.visible = og > 0;
    growth.forEach(({ a }, i) => {
      for (let k = 0; k < 2; k++) {
        const r = 14 + ((time * 0.06 + i * 0.23 + k * 0.5) % 1) * 150 * gk;
        puPos.set([r * Math.cos(a), 0.15, r * Math.sin(a)], (i * 2 + k) * 3);
      }
    });
    puGeo.attributes.position.needsUpdate = true; puMat.opacity = og; pulses.visible = og > 0;

    // the district appears around the building on the pull-back
    dist.visible = df > 0;
    dFill.opacity = df; dEdge.opacity = 0.7 * df; dProj.opacity = 0.85 * df; roadMat.opacity = df; cl.material.opacity = 0.55 * df;

    // copy: the numbered list steps down the page, Zeggo-style
    const lf = 1 - seg(t, 0.8, 0.84);
    ITEMS.forEach(([, , , s], i) => {
      const a = seg(t, s, s + 0.05), cur = t < s + 0.1 || i === 3;
      const o = a * lf * (cur ? 1 : f.narrow ? 0 : 0.4);
      setO(els.items[i], o);
      els.items[i].style.transform = `translateY(${((1 - eo(a)) * 18).toFixed(1)}px)`;
    });
    const hud = seg(t, 0.5, 0.56) * (1 - seg(t, 0.8, 0.84));
    setO(els.hud, hud);
    const bk = eo(seg(t, 0.5, 0.58));
    BUDGET.forEach(([, , v], i) => { els.bars[i].style.transform = `scaleX(${(v * bk).toFixed(3)})`; });
    const hp = seg(t, 0.8, 0.87); setO(els.hl, hp > 0 ? 1 - seg(t, 0.93, 0.99) : 0); reveal(els.hl, hp);
    setO(els.next, seg(t, 0.93, 1));
  }

  return { root, update, bind };
}

export function Overlay() {
  return (
    <>
      <ol className="ac-systems-list">
        {ITEMS.map(([n, h, d], i) => (
          <li key={n} className="ac-systems-it" data-k={"i" + i} style={{ "--i": i }}>
            <span className="ac-mono ac-or">{n}</span>
            <h3>{h}</h3>
            <p>{d}</p>
          </li>
        ))}
      </ol>
      <div className="ac-systems-hud" data-k="hud">
        <div className="ac-mono ac-or">Performance budget</div>
        {BUDGET.map(([a, b], i) => (
          <div key={a} className="ac-systems-row">
            <span className="ac-mono">{a}</span><span className="ac-mono">{b}</span>
            <i><b data-k={"b" + i} /></i>
          </div>
        ))}
        <div className="ac-mono ac-systems-note">Set per project, checked on every build</div>
      </div>
      <div className="ac-systems-mod ac-lbl ac-mono" data-k="mod">Wire module · WebGL</div>
      {NODES.map((n, i) => (
        <div key={n} className="ac-systems-node ac-lbl ac-mono" data-k={"n" + i}><i />{n}</div>
      ))}
      <div className="ac-systems-hd" data-k="hl">
        <h2 className="ac-hl"><span className="ln"><span>What you don&rsquo;t see</span></span><span className="ln"><span><em>holds everything up.</em></span></span></h2>
      </div>
      <div className="ac-next ac-mono" data-k="next">[ Systems → District ]</div>
    </>
  );
}
