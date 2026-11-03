import * as THREE from "three";
import { C, LI, V, bar, clamp, dotTexture, io, lerp, mixHex, rng, seg, setBar } from "../kit";
import { CUBE, MARK_CENTER, RISERS, SLAB, buildMark } from "./mark";
import { look } from "./looks";

// One world for the whole page, one camera, no cuts. The mark stands at the
// origin. Its cube is the client's brand, and its six faces carry the story:
// they unfold into the brand's facets (Research), become the strategy map
// along the beam (Strategy), the design system's layers and responsive pages
// (Design), the code under them (Engineering), the live project sites (Work)
// and their results (Impact), then fold back into the cube, and the camera
// settles on the flat logo (Handover). Everything is a function of global T
// (0–8, one unit per chapter), so scrolling back plays it in reverse.

const P1 = V([0, 0, 11]); // where the cube lands and unfolds
export const LENSES = [V([-8.5, 0, 7.5]), V([8.5, 0, 7.5]), V([-8.5, 0, 16.5]), V([8.5, 0, 16.5])];
export const NODE = (i) => V([-8.4 + 3.36 * i, 2.6 + 1.25 * i, 5]);
export const CONVERSION = V([10.6, 10.6, 5]);
export const WORK = (j) => V([-11 + 4.6 * j, 2.9 + 1.35 * j, 8.6 - 0.9 * j]);
export const WORK_STOPS = [0.2, 0.33, 0.46, 0.59, 0.72, 0.84]; // local t of each project stop
const ARC = (i) => { const a = -1.15 + (2.3 * i) / 5; return [V([11.5 * Math.sin(a), 5.4 + (i % 2) * 2, 11.5 * Math.cos(a) - 1]), a]; };
const WALL = (i) => V([4.5 + 5.3 * ((i % 3) - 1), 10.1 - 3.6 * Math.floor(i / 3), 2.5]);

/* ---------- frames: a panel's centre, orientation and size ---------- */
const Q = (yaw = 0, pitch = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
const fr = (c, q, w, h) => ({ c, q, w, h });
function fromCorners(p0, p1, p3) {
  const xv = p1.clone().sub(p0), yv = p0.clone().sub(p3), w = xv.length(), h = yv.length();
  const nx = xv.normalize(), nz = nx.clone().cross(yv).normalize(), ny = nz.clone().cross(nx);
  const c = p1.clone().add(p3).multiplyScalar(0.5);
  return fr(c, new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(nx, ny, nz)), w, h);
}
function mixFrame(a, b, k, lift = 0) {
  const c = a.c.clone().lerp(b.c, k);
  c.y += Math.sin(Math.PI * k) * lift;
  return fr(c, a.q.clone().slerp(b.q, k), lerp(a.w, b.w, k), lerp(a.h, b.h, k));
}

// the cube: in the mark (logo pose) or resting on the ground at P1
const POSE_LOGO = { p: CUBE.center, q: CUBE.quat, s: V([CUBE.w / 2, CUBE.h / 2, CUBE.d / 2]) };
const POSE_GROUND = { p: V([P1.x, 1, P1.z]), q: new THREE.Quaternion(), s: V([1, 1, 1]) };
function cubePose(T) {
  if (T > 6) return POSE_LOGO;
  const u = io(seg(T, 1.0, 1.12));
  return { p: POSE_LOGO.p.clone().lerp(POSE_GROUND.p, u), q: POSE_LOGO.q.clone().slerp(POSE_GROUND.q, u), s: POSE_LOGO.s.clone().lerp(POSE_GROUND.s, u) };
}
// the six faces as a net hinged off the bottom face (cube-local, ±1), θ = π/2 closed → 0 flat
function net(i, th) {
  const ct = Math.cos(th), sn = Math.sin(th), s2 = Math.sin(2 * th), c2 = Math.cos(2 * th), hy = 2 * sn, hz = 1 + 2 * ct;
  const F = [
    [[-1, 0, -1], [1, 0, -1], [-1, 0, 1]], // purpose (bottom)
    [[1, 0, -1], [1 + 2 * ct, 2 * sn, -1], [1, 0, 1]], // voice
    [[-1 - 2 * ct, 2 * sn, -1], [-1, 0, -1], [-1 - 2 * ct, 2 * sn, 1]], // audience
    [[-1, 0, 1], [1, 0, 1], [-1, 2 * sn, 1 + 2 * ct]], // behaviour
    [[-1, 2 * sn, -1 - 2 * ct], [1, 2 * sn, -1 - 2 * ct], [-1, 0, -1]], // visuals
    [[-1, hy, hz], [1, hy, hz], [-1, hy + 2 * s2, hz + 2 * c2]], // market (off behaviour)
  ][i];
  return F.map((p) => V([p[0], p[1] - 1, p[2]]));
}
const place = (pose, v) => v.clone().multiply(pose.s).applyQuaternion(pose.q).add(pose.p);
function cubeFace(i, T, closed = false) {
  const pose = closed ? POSE_LOGO : cubePose(T);
  const th = closed ? Math.PI / 2 : (Math.PI / 2) * (1 - io(seg(T, 1.12, 1.32)));
  const [a, b, d] = net(i, th).map((v) => place(pose, v));
  return fromCorners(a, b, d);
}

// the states the six faces pass through: [window start, window end, frame(i, T), look(i)]
const STATES = [
  [-1, 0, (i, T) => cubeFace(i, T), (i, T) => (T < 1.18 ? "face" : `facet:${i}`)],
  [1.84, 2.1, (i) => fr(NODE(i), Q(), 3.0, 1.875), (i) => `node:${i}`],
  [2.84, 3.1, (i, T) => {
    const t = T - 3, ex = io(seg(t, 0.12, 0.32)) * (1 - io(seg(t, 0.7, 0.86)));
    if (i < 4) return fr(V([2.2 + i * 0.45 * ex, 6.9 + i * 0.28 * ex, 6.4 + (i - 1.5) * 2.1 * ex + i * 0.015]), Q(), 8.4, 5.25);
    return i === 4 ? fr(V([-8.2, 6.2, 5.6]), Q(0.32), 3.3, 4.4) : fr(V([11, 5.6, 5.8]), Q(-0.32), 1.95, 4.15);
  }, (i) => (i < 4 ? `layer:${i}` : i === 4 ? "tablet" : "mobile")],
  [3.84, 4.12, (i) => { const [c, a] = ARC(i); return fr(c, Q(a), 3.6, 2.25); }, (i) => `code:${i}`],
  [4.84, 5.1, (i) => fr(WORK(i), Q(-0.2), 4.4, 2.75), (i) => `site:${i}`],
  [5.84, 6.1, (i) => fr(WALL(i), Q(), 4.7, 2.94), (i) => `site:${i}`],
  [6.86, 7.18, (i) => cubeFace(i, 7, true), () => "face"],
];
const STAGGER = 0.022;

/* ---------- camera: keyframes of target, direction, view height and lens ---------- */
// [T, target, yaw, pitch, half view height at the target, fov]
const MC = MARK_CENTER, CC = CUBE.center;
const KEYS = [
  [0, MC, 0, 0, 9.4, 3.5], [0.3, MC, 0, 0, 9.4, 3.5],
  [0.62, V([-0.5, 7, 0]), -0.6, 0.14, 9.4, 30], [0.72, V([-4.2, 7, 0]), -0.45, 0.16, 9.2, 30], [0.86, V([-4, 7, 0]), -0.3, 0.18, 9, 30],
  [0.97, CC, -0.15, 0.35, 2.2, 34], [1.0, CC, -0.1, 0.5, 2.2, 34],
  [1.12, POSE_GROUND.p, 0, 1.05, 3.4, 34], [1.3, V([0, 0, 12.4]), 0, 1.32, 6.2, 34], [1.42, V([0, 0, 12.4]), 0, 1.36, 10.6, 34], [1.8, V([0, 0, 12.4]), 0.06, 1.33, 10.6, 34],
  [2.08, V([0.6, 6.5, 5]), 0.04, 0.06, 7.3, 30], [2.86, V([0.6, 6.5, 5]), -0.06, 0.05, 7.3, 30],
  [3.08, V([1, 6.6, 6.8]), -0.6, 0.14, 7.4, 32], [3.6, V([1, 6.6, 6.8]), -0.45, 0.12, 7.2, 32], [3.86, V([1, 6.6, 6.4]), -0.1, 0.08, 7.6, 32],
  [4.1, V([0, 6.8, 2]), 0.45, 0.22, 10.6, 34], [4.86, V([0, 6.8, 2]), -0.35, 0.2, 10.6, 34],
  [5.06, V([0, 7, 4]), -0.22, 0.2, 10.8, 34],
  ...WORK_STOPS.flatMap((s, j) => { const c = WORK(j).add(V([1.9, 0, 0])); return [[5 + s - 0.035, c, -0.3, 0.06, 2.5, 32], [5 + s + 0.035, c, -0.26, 0.06, 2.5, 32]]; }),
  [5.95, V([0, 7.5, 3]), -0.15, 0.28, 11.2, 34],
  [6.1, V([1.2, 8.1, 2]), 0, 0.04, 7.4, 30], [6.86, V([1.2, 8.1, 2]), 0.08, 0.06, 7.4, 30],
  [7.1, MC, -0.45, 0.16, 9.4, 30], [7.25, MC, -0.3, 0.1, 9, 26], [7.46, V([6.6, MC.y + 0.3, 0]), 0, 0, 9.6, 3.5], [8, V([6.6, MC.y + 0.3, 0]), 0, 0, 9.6, 3.5],
];
// monotone cubic (PCHIP) through one parameter of the keys: smooth, no overshoot, holds where keys repeat
function pchip(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue;
    const h0 = xs[i] - xs[i - 1], h1 = xs[i + 1] - xs[i];
    m[i] = (3 * (h0 + h1)) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const CAM = (() => {
  const xs = KEYS.map((k) => k[0]);
  const ch = (f) => pchip(xs, KEYS.map(f));
  return { tx: ch((k) => k[1].x), ty: ch((k) => k[1].y), tz: ch((k) => k[1].z), yaw: ch((k) => k[2]), pitch: ch((k) => k[3]), h: ch((k) => k[4]), fov: ch((k) => k[5]) };
})();

export function buildWorld() {
  const root = new THREE.Group();

  // ground + drafting grid
  const groundMat = new THREE.MeshStandardMaterial({ color: C.paper, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const gp = [];
  for (let v = -60; v <= 60; v += 2) gp.push(v, 0.01, -60, v, 0.01, 60, -60, 0.01, v, 60, 0.01, v);
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
  const gridMat = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.1 });
  root.add(new THREE.LineSegments(gridGeo, gridMat));

  // the mark
  const mark = buildMark(); root.add(mark.group);
  const flyFrom = [V([0, 9, 0]), V([-14, 0, 0]), V([12, 6, 0]), V([13, 0, 0])];

  // the cube's twelve edges (orange, the mark's 7-unit stroke)
  const edgeMat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true });
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cubeEdges = EDGES.map(() => { const m = bar([0, 0, 0], [1, 0, 0], 0.2, edgeMat); root.add(m); return m; });
  const corner = (pose, k) => place(pose, V([k & 1 ? 1 : -1, k & 2 ? 1 : -1, k & 4 ? 1 : -1]));

  // the six faces: two coplanar meshes each, so one look can cross-fade into the next
  const plane = new THREE.PlaneGeometry(1, 1);
  const panels = Array.from({ length: 6 }, (_, i) => {
    const mk = (top) => {
      const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, polygonOffset: top, polygonOffsetFactor: top ? -1 : 0, polygonOffsetUnits: top ? -4 : 0, depthWrite: !top }));
      m.matrixAutoUpdate = false; m.castShadow = true; m.userData.i = i; m.renderOrder = top ? 2 : 1; root.add(m); return m;
    };
    return { a: mk(false), b: mk(true), frame: null };
  });
  const M = new THREE.Matrix4(), SC = new THREE.Vector3();
  function setPanel(p, f, la, lb, k) {
    M.compose(f.c, f.q, SC.set(f.w, f.h, 1));
    p.a.matrix.copy(M); p.b.matrix.copy(M);
    if (p.a.material.map !== la) { p.a.material.map = la; p.a.material.needsUpdate = true; }
    if (p.b.material.map !== lb) { p.b.material.map = lb; p.b.material.needsUpdate = true; }
    p.a.visible = k < 1; p.b.visible = k > 0; p.b.material.opacity = k;
    p.frame = f;
  }

  // points: research data, then user flow, data packets and visitors
  const NP = 320, R = rng(7), seeds = Array.from({ length: NP }, () => [R(), R(), R()]);
  const pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 6, sizeAttenuation: false, vertexColors: true, map: dotTexture(), transparent: true, alphaTest: 0.4, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; root.add(points);
  const cInk = new THREE.Color(), cOr = new THREE.Color(C.or), tmp = new THREE.Vector3();

  // lines: the user flow, and the links from the risers to the screens
  const mkLines = (n, color) => {
    const g = new THREE.BufferGeometry(), a = new Float32Array(n * 6);
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true })); l.frustumCulled = false; root.add(l);
    return { l, a, g };
  };
  const flow = mkLines(8, C.or), links = mkLines(8, "#8A8A90");
  const FLOW = [...Array.from({ length: 6 }, (_, i) => NODE(i)), CONVERSION];
  const along = (pts, s) => {
    const L = []; let tot = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); L.push(l); tot += l; }
    let r = s * tot;
    for (let i = 0; i < L.length; i++) { if (r <= L[i]) return pts[i].clone().lerp(pts[i + 1], r / L[i]); r -= L[i]; }
    return pts[pts.length - 1].clone();
  };

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const api = {
    T: 0, panels, lenses: LENSES, flow: FLOW,
    panelPoint(i, u, v) { const f = panels[i].frame; return V([u * f.w, v * f.h, 0]).applyQuaternion(f.q).add(f.c); },
    pick(e, f) {
      const r = f.canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      panels.forEach((p) => p.a.updateMatrixWorld()); ray.setFromCamera(ndc, f.active);
      const hit = ray.intersectObjects(panels.map((p) => p.a), false)[0];
      return hit ? hit.object.userData.i : -1;
    },
  };

  function update(T, f) {
    const { rig, time } = f;
    api.T = T;

    // light and sky across the day: day → dusk → night (Engineering, Work) → dawn (Impact) → day
    const dusk = seg(T, 4.0, 4.28), night = seg(T, 4.22, 4.46), dawnA = seg(T, 6.0, 6.18), dawnB = seg(T, 6.16, 6.42);
    const dark = night * (1 - dawnB);
    let top, bot;
    if (T < 5) { top = mixHex(mixHex(C.paper, "#2B2529", dusk), C.night, night); bot = mixHex(mixHex(C.paper, "#9A7462", dusk), "#151516", night); }
    else { top = mixHex(mixHex(C.night, "#24232C", dawnA), C.paper, dawnB); bot = mixHex(mixHex("#151516", "#B86A40", dawnA), C.paper, dawnB); }
    f.sky(top, bot);
    f.theme(seg(T, 4.2, 4.3) * (1 - seg(T, 6.22, 6.32)));
    rig.fog.color.set(bot);
    const warm = Math.max(dusk * (1 - night), dawnA * (1 - dawnB));
    rig.sun.color.set(mixHex("#ffffff", "#ffb27a", warm)); rig.sun.intensity = lerp(0.85, 0.08, dark) * LI;
    rig.sun.position.set(lerp(-16, -30, warm), lerp(30, 12, warm), 22); rig.sun.target.position.set(0, 0, 4);
    rig.hemi.intensity = lerp(0.62, 0.16, dark) * LI; rig.hemi.color.set(mixHex("#ffffff", "#7b88b0", dark)); rig.hemi.groundColor.set(mixHex("#d6cfc2", "#111113", dark));
    rig.rim.color.set(0x9fb4ff); rig.rim.intensity = 0.5 * dark * LI;
    groundMat.color.set(mixHex(C.paper, "#111113", dark));
    gridMat.color.set(mixHex(C.ink, "#ffffff", dark)); gridMat.opacity = lerp(0.1, 0.06, dark);

    // camera
    const yaw = CAM.yaw(T) + f.px * 0.04, pitch = CAM.pitch(T) - f.py * 0.03, fov = CAM.fov(T);
    const tg = V([CAM.tx(T), CAM.ty(T), CAM.tz(T)]);
    let h = CAM.h(T);
    if (f.narrow) { // tall screens: centre what sits off to one side, and keep a little more in view
      const flatEnd = seg(T, 7.3, 7.46);
      tg.x = lerp(tg.x, 0, Math.max(seg(T, 0.62, 0.72) * (1 - seg(T, 0.86, 0.97)), flatEnd));
      tg.y = lerp(tg.y, MC.y - 4.2, flatEnd); h *= lerp(1, 1.3, flatEnd);
      const wk = seg(T, 5.1, 5.16) * (1 - seg(T, 5.86, 5.92)); // work stops: screen centred, above the card
      tg.x -= 1.9 * wk; tg.y -= 1.4 * wk;
    }
    const dist = h / Math.tan((fov * Math.PI) / 360);
    const dir = V([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]);
    f.lens(fov, { near: Math.max(0.2, dist * 0.02), far: dist + 260, tall: 1.4 });
    f.cam.up.set(0, 1, 0);
    f.cam.position.copy(tg).addScaledVector(dir, dist); f.cam.lookAt(tg);
    rig.fog.near = dist + 30; rig.fog.far = dist + 150; // the flat logo view is ~280 away

    // the mark: drafted, assembled, orange by day; edges and lit risers at night
    const draft = seg(T, 0.3, 0.46), gf = 1 - seg(T, 0.62, 0.72);
    mark.ghosts.forEach((g) => { g.geometry.setDrawRange(0, Math.ceil(g.userData.n * draft)); g.visible = draft > 0 && gf > 0; });
    mark.ghostMat.opacity = gf;
    const ks = [0.44, 0.47, 0.5, 0.48].map((a) => io(seg(T, a, a + 0.16)));
    mark.pieces.forEach((m, i) => { m.position.copy(flyFrom[i]).multiplyScalar(1 - ks[i]); m.visible = ks[i] > 0; });
    const orange = io(seg(T, 0.66, 0.82)), wire = dark;
    // seen flat (the telephoto logo views) the mark is unlit, so it reads as the logo's exact #FF5F00
    const flatK = clamp((12 - fov) / 8) * orange * (1 - wire);
    mark.slabMat.color.set(mixHex(mixHex(mixHex("#FAF9F6", C.or, orange), "#151517", wire), "#000000", flatK));
    mark.slabMat.emissive.set(C.or); mark.slabMat.emissiveIntensity = flatK;
    mark.slabMat.opacity = Math.min(1, (ks[0] + ks[1] + ks[2] + ks[3]) / 3) * lerp(1, 0.35, wire);
    mark.slabMat.depthWrite = wire < 0.5;
    mark.edgeMat.color.set(mixHex(mixHex(C.ink, C.orD, orange), "#9A9AA2", wire)); mark.edgeMat.opacity = lerp(lerp(0.9, 0.25, orange), 0.9, wire);
    const rs = seg(T, 4.2, 4.32) * (1 - seg(T, 5.9, 6.1));
    mark.risers.forEach((m, i) => { const g = io(seg(T, 4.24 + i * 0.03, 4.36 + i * 0.03)); m.scale.y = Math.max(0.001, g); m.visible = rs > 0; });
    mark.riserMat.opacity = rs;

    // the cube's edges: while it is closed
    const eo2 = (1 - seg(T, 1.1, 1.16)) + seg(T, 7.1, 7.22);
    const pose = cubePose(T);
    edgeMat.opacity = clamp(eo2);
    cubeEdges.forEach((m, k) => {
      if (eo2 <= 0) { m.visible = false; return; }
      const [a, b] = EDGES[k]; m.userData.bar.a.copy(corner(pose, a)); m.userData.bar.b.copy(corner(pose, b)); setBar(m, 1);
    });

    // the six faces
    panels.forEach((p, i) => {
      let s = 0;
      while (s < STATES.length - 1 && T >= STATES[s + 1][0] + i * STAGGER) s++;
      const st = STATES[s], cur = st[2](i, T);
      const k = s === 0 ? 1 : io(seg(T, st[0] + i * STAGGER, st[1] + i * STAGGER));
      if (s === 0) {
        const k0 = seg(T, 1.13, 1.24);
        setPanel(p, cur, look("face"), look(st[3](i, 2)), T < 1.13 ? 0 : k0);
        return;
      }
      const prev = STATES[s - 1], from = prev[2](i, T);
      const lift = s === 6 ? 0.5 : 1.6;
      setPanel(p, k < 1 ? mixFrame(from, cur, k, lift) : cur, look(prev[3](i, T)), look(st[3](i, T)), k);
    });

    // points
    let op = 0;
    const visit = (j) => WORK(j);
    const active = WORK_STOPS.reduce((b, s, j) => (Math.abs(T - 5 - s) < Math.abs(T - 5 - WORK_STOPS[b]) ? j : b), 0);
    cInk.set(mixHex(C.ink, "#D8D6D0", dark));
    for (let n = 0; n < NP; n++) {
      const [r1, r2, r3] = seeds[n];
      if (T < 2) { // research: a field of audience data settling into the four lenses
        op = seg(T, 1.32, 1.38) * (1 - seg(T, 1.84, 1.92));
        const a = r1 * 6.283, rr = 4.5 + r2 * 8, L = LENSES[n % 4], b = r3 * 6.283, br = Math.pow(r2, 0.6) * 1.7, m = io(seg(T, 1.42, 1.56));
        tmp.set(lerp(P1.x + rr * Math.cos(a), L.x + br * Math.cos(b), m), 0.06, lerp(P1.z + 1 + rr * Math.sin(a) * 0.8, L.z + br * Math.sin(b), m));
      } else if (T < 3.5) { // strategy: people moving along the flow, up the beam to conversion
        op = seg(T, 2.38, 2.48) * (1 - seg(T, 2.86, 2.95));
        tmp.copy(along(FLOW, (r1 + time * 0.05) % 1)); tmp.x += (r2 - 0.5) * 0.3; tmp.y += (r3 - 0.5) * 0.3; tmp.z += 0.1;
      } else if (T < 5) { // engineering: packets up the risers and out to the screens
        op = seg(T, 4.3, 4.4) * (1 - seg(T, 4.86, 4.95));
        const rz = RISERS[n % 4], s = (r1 + time * 0.16) % 1, top = V([rz[0], rz[1], SLAB / 2 + 0.1]);
        if (s < 0.5) tmp.set(rz[0], lerp(rz[2], rz[1], s * 2), SLAB / 2 + 0.1);
        else tmp.copy(top).lerp(panels[n % 6].frame.c, (s - 0.5) * 2);
      } else if (T < 6) { // work: visitors arriving at the project in view
        op = seg(T, 5.12, 5.22) * (1 - seg(T, 5.86, 5.94));
        const s = (r1 + time * 0.1) % 1, from = V([(r2 - 0.5) * 40, 0, 22 + r3 * 10]);
        tmp.copy(from).lerp(visit(active), io(s)); tmp.y += Math.sin(Math.PI * s) * 2;
      } else { // impact: traffic into every project
        op = seg(T, 6.16, 6.26) * (1 - seg(T, 6.86, 6.94));
        const s = (r1 + time * 0.08) % 1, from = V([(r2 - 0.5) * 44, 0, 16 + r3 * 8]);
        tmp.copy(from).lerp(panels[n % 6].frame.c, io(s)); tmp.y += Math.sin(Math.PI * s) * 1.5;
      }
      pPos[n * 3] = tmp.x; pPos[n * 3 + 1] = tmp.y; pPos[n * 3 + 2] = tmp.z;
      const c = n % 7 === 0 ? cOr : cInk;
      pCol[n * 3] = c.r; pCol[n * 3 + 1] = c.g; pCol[n * 3 + 2] = c.b;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    points.visible = op > 0; pMat.opacity = op;

    // lines: the flow draws on through the six services; links run from the risers to the screens
    const fp = seg(T, 2.2, 2.4), ff = 1 - seg(T, 2.86, 2.95);
    let nf = 0;
    if (fp > 0 && ff > 0) for (let i = 0; i < FLOW.length - 1; i++) {
      const k = clamp(fp * (FLOW.length - 1) - i); if (k <= 0) break;
      const a = FLOW[i], b = FLOW[i].clone().lerp(FLOW[i + 1], k);
      flow.a.set([a.x, a.y, a.z + 0.05, b.x, b.y, b.z + 0.05], nf * 6); nf++;
    }
    flow.g.setDrawRange(0, nf * 2); flow.g.attributes.position.needsUpdate = true; flow.l.material.opacity = ff; flow.l.visible = nf > 0;
    const lk = seg(T, 4.3, 4.4) * (1 - seg(T, 4.86, 4.95));
    if (lk > 0) panels.forEach((p, i) => { const rz = RISERS[i % 4], c = p.frame.c; links.a.set([rz[0], rz[1], SLAB / 2 + 0.1, c.x, c.y, c.z], i * 6); });
    links.g.setDrawRange(0, lk > 0 ? 12 : 0); links.g.attributes.position.needsUpdate = true; links.l.material.opacity = lk * 0.6; links.l.visible = lk > 0;
  }

  return { root, update, api };
}
