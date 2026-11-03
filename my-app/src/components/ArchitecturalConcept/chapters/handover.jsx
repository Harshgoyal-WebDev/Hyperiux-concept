import * as THREE from "three";
import { C, LI, LOGO, UNIT, V, bar, eo, io, keys, lerp, mixHex, pip, reveal, rng, seg, setBar, setO } from "../kit";

// 09 HANDOVER — the streets spell the logo; the module rises. Day, paper.
// From Occupancy's high aerial the camera climbs over a city of white blocks
// with ink edges until it looks straight down: the H is the negative space
// between the lots. The H fills orange, the module rises in the plaza on the
// beam, then the city fades to line while the logo stays (a flat mark that
// hands over to the 2D logo). The CTA, Say Hi and contact details arrive,
// the footer lands as a drawing title block, and the page loops: back to a
// blank sheet with one module and a button to the first sheet.
export const key = "handover";
export const name = "Handover";

// storyboard city (engine CITY): logo px → world at 0.6 m per px, lots every 11 m
const kG = 0.6;
const mapG = (u, v, w = 0) => new THREE.Vector3((u - 120) * kG, w, (v - 120) * kG);
const CITY = (() => {
  const R = rng(5), out = [];
  const hit = (x, z, m) => {
    for (const [dx, dz] of [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m], [m, m], [-m, -m], [m, -m], [-m, m]]) {
      const u = (x + dx) / kG + 120, v = (z + dz) / kG + 120;
      if (LOGO.some((P) => pip([u, v], P))) return true;
    }
    return false;
  };
  for (let x = -198; x <= 198; x += 11) for (let z = -110; z <= 110; z += 11) {
    if (R() < 0.12) continue;
    const w = 6 + R() * 3.2, d = 6 + R() * 3.2;
    if (hit(x, z, 5.5)) { R(); continue; }
    const dist = Math.hypot(x, z * 1.4);
    out.push([x, z, w, d, 3 + R() * 10 + (dist < 110 ? R() * 18 : 0)]);
  }
  return out;
})();
const EI = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const CUBE = mapG(120, 101), CS = 16; // the module in the plaza on the beam, 16 m
const UP = new THREE.Vector3(0, 1, 0), DOWN_UP = new THREE.Vector3(0, 0, -1);

const K = [
  [0, V([0, 150, 140]), V([0, 0, 0])], [0.111, V([0, 220, 80]), V([0, 0, 0])], [0.222, V([0, 290, 0]), V([0, 0, 0])],
  [0.34, V([0, 290, 0]), V([0, 0, 0])], [0.444, V([46, 160, 128]), V([0, 0, -8])], [0.52, V([0, 300, 0]), V([0, 0, 0])],
  [0.667, V([0, 345, 0]), V([0, 0, 0])], [1, V([0, 345, 0]), V([0, 0, 0])],
];

// the iso cube of the mark, centred on 0,0 (logo units, radius 19)
const k19 = 0.866 * 19;
const HEX = [[0, -19], [k19, -9.5], [k19, 9.5], [0, 19], [-k19, 9.5], [-k19, -9.5]];
const pts = (a) => a.map((p) => p.join(",")).join(" ");

export function build() {
  const root = new THREE.Group();

  // paper ground, with a shadow catcher above the flat logo
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ color: C.paper }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; root.add(ground);
  const shMat = new THREE.ShadowMaterial({ opacity: 0.14, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(700, 500), shMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.12; shadow.receiveShadow = true; root.add(shadow);

  // the logo: the negative space between the lots, drawn as a flat mark
  const logoMat = new THREE.MeshBasicMaterial({ color: C.sheet, transparent: true, depthWrite: false });
  const logoLine = new THREE.LineBasicMaterial({ color: C.ink, transparent: true });
  LOGO.forEach((P) => {
    const sh = new THREE.Shape(P.map(([u, v]) => new THREE.Vector2((u - 120) * kG, -(v - 120) * kG)));
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, logoMat); m.position.y = 0.06; root.add(m);
    const lg = new THREE.BufferGeometry().setFromPoints(P.map(([u, v]) => mapG(u, v, 0.1)));
    root.add(new THREE.LineLoop(lg, logoLine));
  });

  // the city: one instanced set of white blocks, one merged set of ink edges
  const lotMat = new THREE.MeshLambertMaterial({ color: 0xfaf9f6, transparent: true });
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const lots = new THREE.InstancedMesh(box, lotMat, CITY.length);
  lots.castShadow = true; root.add(lots);
  const m4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), ep = [];
  CITY.forEach(([x, z, w, d, h], i) => {
    lots.setMatrixAt(i, m4.compose(P.set(x, 0, z), Q, S.set(w, h, d)));
    const c = [];
    for (const y of [0, h]) for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.push([x + (a * w) / 2, y, z + (b * d) / 2]);
    for (const [a, b] of EI) ep.push(...c[a], ...c[b]);
  });
  const edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(ep, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: C.ink, transparent: true });
  root.add(new THREE.LineSegments(edgeGeo, edgeMat));

  // the module: a white cube with orange edges rising out of the beam
  const cube = new THREE.Group(); cube.position.copy(CUBE); cube.rotation.y = Math.PI / 4; root.add(cube);
  const cubeMat = new THREE.MeshLambertMaterial({ color: 0xfaf9f6, transparent: true });
  const cubeM = new THREE.Mesh(UNIT, cubeMat); cubeM.castShadow = true; cube.add(cubeM);
  const cubeEdge = new THREE.MeshBasicMaterial({ color: C.or, transparent: true });
  const h2 = CS / 2, cEdges = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    cEdges.push([[-h2, 1, a * h2, b], [h2, 1, a * h2, b]], [[a * h2, 1, -h2, b], [a * h2, 1, h2, b]], [[a * h2, 0, b * h2], [a * h2, 1, b * h2]]);
  }
  // each edge: endpoints as [x, yFlag(0 bottom / 1 top), z]; horizontal edges carry a 4th entry: ±1 = top/bottom ring
  const edgeBars = cEdges.map((e) => { const m = bar(V([0, 0, 0]), V([1, 0, 0]), 0.55, cubeEdge); cube.add(m); return { m, e }; });
  const setCubeH = (h) => {
    cubeM.scale.set(CS, Math.max(1e-3, h), CS); cubeM.position.y = 0;
    edgeBars.forEach(({ m, e }) => {
      const [A, B] = e, bd = m.userData.bar;
      if (A.length === 4) { const y = A[3] > 0 ? h : 0; bd.a.set(A[0], y, A[2]); bd.b.set(B[0], y, B[2]); }
      else { bd.a.set(A[0], 0, A[2]); bd.b.set(B[0], h, B[2]); }
      setBar(m, h > 0.05 ? 1 : 0);
    });
  };
  // horizontal edges were written as [x, 1, z, ring]; normalise them to the 4-entry form
  cEdges.forEach((e) => { if (e[0].length === 4) { e[0] = [e[0][0], 0, e[0][2], e[0][3]]; e[1] = [e[1][0], 0, e[1][2], e[1][3]]; } });

  const tmp = new THREE.Vector3();

  function bind(els, f) {
    els.back?.addEventListener("click", () => f.goT(0));
  }

  function update(t, f) {
    const { rig, els, W, H, narrow } = f;

    // camera: climb from Occupancy's aerial to straight down; dip to the plaza for the module; back up
    const [pos, tg] = keys(K, t);
    const sx = narrow ? 0 : -0.15 * io(seg(t, 0.58, 0.66));
    const sy = narrow ? -0.2 * io(seg(t, 0.58, 0.66)) : -0.07 * io(seg(t, 0.76, 0.84));
    f.lens(38, { x: sx, y: sy, near: 1, far: 1600 });
    f.cam.position.copy(pos); f.cam.up.copy(DOWN_UP); f.cam.lookAt(tg); f.cam.up.copy(UP);

    // day on paper
    f.theme(0); f.sky(C.paper, C.paper);
    rig.fog.color.set(C.paper); rig.fog.near = 260; rig.fog.far = 620;
    rig.hemi.intensity = 0.62 * LI; rig.hemi.color.set(0xffffff); rig.hemi.groundColor.set(0xbdb9b0);
    rig.sun.intensity = 0.5 * LI; rig.sun.position.set(-120, 260, 90); rig.sun.target.position.set(0, 0, 0);
    Object.assign(rig.sun.shadow.camera, { left: -230, right: 230, top: 160, bottom: -160, near: 10, far: 700 });
    rig.sun.shadow.camera.updateProjectionMatrix();

    const all = 1 - seg(t, 0.9, 0.97);
    const lf = seg(t, 0.26, 0.34), cr = eo(seg(t, 0.38, 0.47)), line = seg(t, 0.5, 0.58), x2 = seg(t, 0.53, 0.58);

    // city: white blocks, then line only
    lotMat.opacity = (1 - line) * all; lots.visible = lotMat.opacity > 0.001;
    lotMat.depthWrite = line < 0.5;
    edgeMat.opacity = lerp(0.8, 0.32, line) * all; edgeMat.color.set(mixHex(C.ink, C.graphite, line));
    shMat.opacity = 0.14 * (1 - line) * all;

    // the H fills orange; the flat mark hands over to the 2D logo
    logoMat.color.set(mixHex(C.sheet, C.or, lf)); logoMat.opacity = (1 - x2) * all;
    logoLine.color.set(mixHex(C.ink, C.orD, lf)); logoLine.opacity = (1 - x2) * all * 0.9;

    // the module rises in the plaza
    setCubeH(CS * cr);
    cube.visible = cr > 0 && x2 < 1;
    cubeMat.opacity = Math.min(1, cr * 3) * (1 - x2); cubeEdge.opacity = cubeMat.opacity;

    // 2D logo, pinned to the ground plane (exact once the camera looks straight down)
    const [ox, oy] = f.project(mapG(0, 0)), [xx] = f.project(mapG(240, 0)), s = (xx - ox) / 240;
    if (els.logo) {
      els.logo.style.transform = `translate(${ox.toFixed(1)}px,${oy.toFixed(1)}px) scale(${s.toFixed(4)})`;
      setO(els.logo, x2 * all);
    }
    // the module: from the mark's joint to the centre of a blank sheet
    const lp = io(seg(t, 0.9, 0.97));
    const [cx, cy] = f.project(tmp.copy(CUBE));
    const k = lerp(s, narrow ? 1.5 : 1.8, lp);
    if (els.cube) {
      els.cube.style.transform = `translate(${lerp(cx, W / 2, lp).toFixed(1)}px,${lerp(cy, H / 2, lp).toFixed(1)}px) translate(-50%,-50%) scale(${k.toFixed(4)})`;
      els.cube.style.setProperty("--sw", (lerp(4.5, 2.2, lp) / Math.max(0.6, k / s) * (lp > 0 ? 1 : 1)).toFixed(2));
      setO(els.cube, x2);
    }

    // drawing label while the plan reads
    setO(els.plan, seg(t, 0.16, 0.22) * (1 - seg(t, 0.5, 0.56)));

    // CTA, Say Hi + contact, title block
    const ctOut = narrow ? 1 - seg(t, 0.79, 0.82) : all;
    const ct = seg(t, 0.6, 0.68);
    setO(els.cta, ct > 0 ? ctOut : 0); reveal(els.hl, ct);
    setO(els.eb, seg(t, 0.6, 0.64)); setO(els.sub, seg(t, 0.64, 0.68));
    const sh = seg(t, 0.7, 0.76);
    setO(els.hi, sh); if (els.hi) els.hi.style.transform = `translateY(${((1 - eo(sh)) * 14).toFixed(1)}px)`;
    if (els.cta) els.cta.style.pointerEvents = ct * ctOut > 0.5 ? "auto" : "none";
    const tb = seg(t, 0.8, 0.87) * all;
    setO(els.tb, tb); if (els.tb) { els.tb.style.transform = `translateY(${((1 - eo(seg(t, 0.8, 0.87))) * 24).toFixed(1)}px)`; els.tb.style.pointerEvents = tb > 0.5 ? "auto" : "none"; }

    // the loop: a blank sheet, one module, the counter back at 00
    const lo = seg(t, 0.93, 1);
    setO(els.zero, lo); setO(els.back, lo);
    if (els.back) els.back.style.pointerEvents = lo > 0.5 ? "auto" : "none";
  }

  return { root, update, bind };
}

const LOGO_SVG = LOGO.map((p) => `<polygon points="${pts(p)}" fill="#FF6A13"/>`).join("");
const CUBE_SVG = `<polygon points="${pts(HEX)}"/><polyline points="${pts([HEX[5], [0, 0], HEX[1]])}" fill="none"/><line x1="0" y1="0" x2="0" y2="19"/>`;

export function Overlay() {
  return (
    <>
      <svg className="ac-handover-logo" data-k="logo" viewBox="0 0 240 240" width="240" height="240" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
      <svg className="ac-handover-cube" data-k="cube" viewBox="-20 -20 40 40" width="40" height="40" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CUBE_SVG }} />

      <div className="ac-handover-plan ac-mono" data-k="plan">
        <span className="ac-handover-north" aria-hidden="true">N ↑</span>
        <span>Site plan · the streets spell the H</span>
        <span className="ac-handover-scale" aria-hidden="true"><i /><i /><i /><i /></span>
        <span className="ac-handover-sc">0 — 50 — 100 m</span>
      </div>

      <div className="ac-handover-cta" data-k="cta">
        <p className="ac-mono ac-eb" data-k="eb">Let&rsquo;s build yours</p>
        <h2 className="ac-hl" data-k="hl"><span className="ln"><span>Let&rsquo;s bring your</span></span><span className="ln"><span><em>ideas to life.</em></span></span></h2>
        <p className="ac-handover-sub" data-k="sub">Your brand is the cube.<br />We build the world around it.</p>
        <div className="ac-handover-hi" data-k="hi">
          <a className="ac-handover-pill ac-mono" href="mailto:hi@hyperiux.com">Say Hi ↗</a>
          <address>
            <a href="mailto:hi@hyperiux.com">hi@hyperiux.com</a>
            <a href="tel:+918178026136">+91 8178 026 136</a>
          </address>
        </div>
      </div>

      <footer className="ac-handover-tb" data-k="tb">
        <dl>
          <div><dt>Project</dt><dd>Your brand — next</dd></div>
          <div><dt>Architect</dt><dd>Hyperiux Immersion Labs</dd></div>
          <div><dt>Site</dt><dd>A-40, Sector 62, Noida 201309</dd></div>
          <div><dt>Sheet</dt><dd>A-09 / 09</dd></div>
          <div><dt>Scale</dt><dd>1 : 1</dd></div>
          <div><dt>Year</dt><dd>© 2026</dd></div>
        </dl>
        <nav className="ac-mono" aria-label="Footer">
          <span>About</span><span>Work</span><span>Expertise</span><span>Career</span><span>Resources</span><span>Contact</span><span>The Vault</span><span>Labs</span>
          <b>Grandslam I-Thum, Noida</b>
        </nav>
      </footer>

      <div className="ac-handover-zero" data-k="zero" aria-hidden="true">00</div>
      <button type="button" className="ac-handover-back ac-mono" data-k="back">Back to the first sheet ↑</button>
    </>
  );
}
