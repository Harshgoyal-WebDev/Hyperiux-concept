import * as THREE from "three";
import { C, LA, LB, LC, LI, bar, barLen, clamp, eo, io, lerp, reveal, rng, seg, setBar, setO } from "../kit";

// 01 ARRIVAL — a single module floats over an empty site while the loader
// counts 00→100. A survey grid, pegs and dimension strings are set out, the
// logo is drawn in orange in the air, then columns and beam fly in from three
// directions and lock around the module: the H stands. The headline lands
// beside the monument, the concrete turns Hyperiux orange, and the camera
// dives down onto the module's lid ("Your brand is the cube."), where Survey
// opens, looking down on that lid.
export const key = "arrival";
export const name = "Arrival";

// logo px → world: 0.05 m per px, standing in the XY plane, extruded ±D/2 in z
const s = 0.05, D = 1.4, toW = (p) => [(p[0] - 120) * s, (240 - p[1]) * s];
const cubeY = (240 - 101) * s;

// the module's own axes at rest (rotation π/4): the dive ends square to its lid
const UP0 = new THREE.Vector3(0, 1, 0), UP1 = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);

function noiseTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d"), d = x.createImageData(256, 256), r = rng(7);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = 228 + r() * 27 - (r() < 0.02 ? 40 : 0);
    d.data[i] = n; d.data[i + 1] = n * 0.995; d.data[i + 2] = n * 0.985; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.6, 0.6);
  return t;
}

// draw a bar on to k, skipping the rebuild when k hasn't changed
const draw = (m, k) => { if (m.userData.k !== k) { m.userData.k = k; setBar(m, k); } };

export function build() {
  const root = new THREE.Group();

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);

  // survey grid
  const gp = [];
  for (let v = -36; v <= 36; v += 2) gp.push(v, 0.002, -36, v, 0.002, 36, -36, 0.002, v, 36, 0.002, v);
  const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
  const gridMat = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0 });
  root.add(new THREE.LineSegments(gg, gridMat));

  // the logo monument: three extruded concrete pieces with drawn edges
  const monoMat = new THREE.MeshStandardMaterial({ color: "#F6F4F0", roughness: 0.92, metalness: 0, map: noiseTex(), transparent: true });
  const edgeMat = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.9 });
  const piece = (poly) => {
    const sh = new THREE.Shape();
    poly.forEach((p, i) => { const [x, y] = toW(p); if (i) sh.lineTo(x, y); else sh.moveTo(x, y); });
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    g.translate(0, 0, -D / 2);
    const m = new THREE.Mesh(g, monoMat); m.castShadow = m.receiveShadow = true;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), edgeMat));
    root.add(m);
    return m;
  };
  const pA = piece(LA), pB = piece(LB), pC = piece(LC);

  // the module: white cube with orange edges, in the joint
  const cube = new THREE.Group(); cube.position.set(0, cubeY, 0); root.add(cube);
  const cMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0.06 }));
  cMesh.castShadow = true; cube.add(cMesh);
  const orMat = new THREE.MeshStandardMaterial({ color: C.or, roughness: 0.5, emissive: C.or, emissiveIntensity: 0.35 });
  const e = 1.01;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    cube.add(bar([-e, a * e, b * e], [e, a * e, b * e], 0.06, orMat));
    cube.add(bar([a * e, -e, b * e], [a * e, e, b * e], 0.06, orMat));
    cube.add(bar([a * e, b * e, -e], [a * e, b * e, e], 0.06, orMat));
  }

  // setting-out: ghost drawing of the logo, survey pegs, dimension strings
  const ghostMat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true });
  const ghost = [];
  [LA, LB, LC].forEach((poly) => {
    for (let i = 0; i < poly.length; i++) {
      const a = toW(poly[i]), b = toW(poly[(i + 1) % poly.length]);
      const m = bar([a[0], a[1], D / 2 + 0.06], [b[0], b[1], D / 2 + 0.06], 0.05, ghostMat);
      root.add(m); ghost.push(m);
    }
  });
  const gLen = ghost.map(barLen), gTot = gLen.reduce((a, b) => a + b, 0);
  const surMat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true });
  const dimMat = new THREE.MeshBasicMaterial({ color: C.ink, transparent: true });
  const survey = new THREE.Group(); root.add(survey);
  [[-9, -6], [9, -6], [-9, 6], [9, 6], [0, 0]].forEach(([x, z]) => {
    survey.add(bar([x - 0.7, 0.02, z], [x + 0.7, 0.02, z], 0.07, surMat));
    survey.add(bar([x, 0.02, z - 0.7], [x, 0.02, z + 0.7], 0.07, surMat));
  });
  survey.add(bar([-5.25, 0.02, 4], [5.25, 0.02, 4], 0.035, dimMat));
  [-5.25, 5.25].forEach((x) => survey.add(bar([x, 0.02, 3.6], [x, 0.02, 4.4], 0.035, dimMat)));
  for (let y = 0; y < 12; y += 0.6) survey.add(bar([6.6, y, 0], [6.6, y + 0.32, 0], 0.035, dimMat));

  const tg = new THREE.Vector3(), up = new THREE.Vector3();
  const dimWP = new THREE.Vector3(0, 0, 4.9), dimHP = new THREE.Vector3(7.4, 6, 0);
  const cWhite = new THREE.Color("#F6F4F0"), cOr = new THREE.Color(C.or), cInk = new THREE.Color(C.ink), cEdge = new THREE.Color("#7a2c03");

  function update(t, f) {
    const { rig, els, time } = f;
    f.sky(C.paper); f.theme(0);
    rig.fog.color.set(C.paper); rig.fog.near = 38; rig.fog.far = 105;
    rig.hemi.intensity = 0.62 * LI;
    rig.amb.intensity = 0.16 * LI;
    rig.sun.intensity = 0.78 * LI; rig.sun.position.set(-16, 28, 20); rig.sun.target.position.set(0, 0, 0);
    Object.assign(rig.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, far: 90 });
    rig.sun.shadow.camera.updateProjectionMatrix();
    rig.rim.color.set(0xfff1e6); rig.rim.intensity = 0.28 * LI; rig.rim.position.set(18, 10, -14);

    // camera: the storyboard's orbit in, then a dive that ends square over the module's lid
    const a1 = io(seg(t, 0.3, 0.88)), a2 = io(seg(t, 0.88, 1));
    const th = -0.55 * a1 - 0.12 * a2 + f.px * 0.06 * (1 - a2);
    const Rr = lerp(lerp(44, 31, a1), 0.02, a2);
    tg.set(0, lerp(6.2, cubeY, a2), 0);
    const h = lerp(lerp(9.5, 11, a1), cubeY + 3.6, a2) - f.py * 1.2 * (1 - a2);
    const shift = f.narrow ? 0 : lerp(io(seg(t, 0.6, 0.78)), 0, a2); // push the monument right for the headline
    const cam = f.lens(30, { x: shift * 0.13, y: f.narrow ? 0.07 * (1 - a2) : 0, near: 0.1, far: 400, tall: 1.55 });
    cam.position.set(tg.x + Rr * Math.sin(th), h, tg.z + Rr * Math.cos(th));
    cam.up.copy(up.copy(UP0).lerp(UP1, io(seg(t, 0.9, 1))).normalize());
    cam.lookAt(tg);
    cam.up.copy(UP0);

    gridMat.opacity = 0.17 * seg(t, 0.04, 0.2) * (1 - 0.6 * a2);

    const sv = seg(t, 0.13, 0.25) * (1 - seg(t, 0.5, 0.6));
    survey.visible = sv > 0; surMat.opacity = sv; dimMat.opacity = sv * 0.85;

    const gd = seg(t, 0.34, 0.46), gf = 1 - 0.8 * seg(t, 0.6, 0.7);
    let acc = 0;
    ghost.forEach((g, i) => { const st = acc / gTot, en = (acc + gLen[i]) / gTot; acc += gLen[i]; draw(g, clamp((gd - st) / (en - st))); });
    ghostMat.opacity = gf;

    // columns and beam fly in from three directions
    const kA = eo(seg(t, 0.44, 0.6)), kC = eo(seg(t, 0.47, 0.63)), kB = eo(seg(t, 0.5, 0.66));
    pA.position.set(0, (1 - kA) * 9, 0); pA.visible = kA > 0;
    pC.position.set((1 - kC) * 12, 0, 0); pC.visible = kC > 0;
    pB.position.set(-(1 - kB) * 14, 0, 0); pB.visible = kB > 0;
    // concrete turns Hyperiux orange
    const ok = io(seg(t, 0.7, 0.84));
    monoMat.color.copy(cWhite).lerp(cOr, ok); monoMat.roughness = lerp(0.92, 0.6, ok);
    edgeMat.opacity = lerp(0.9, 0.12, ok); edgeMat.color.copy(cInk).lerp(cEdge, ok);
    const tr = Math.min(kA, kB, kC) < 1;
    if (monoMat.transparent !== tr) { monoMat.transparent = tr; monoMat.needsUpdate = true; }
    monoMat.opacity = lerp(0.25, 1, Math.min(1, ((kA + kB + kC) / 3) * 1.2));

    // the module spins while the loader runs, then settles
    const settle = 1 - seg(t, 0.25, 0.34);
    cube.rotation.y = Math.PI / 4 + (1 - eo(seg(t, 0, 0.34))) * 2.6 + (t < 0.34 ? time * 0.25 * settle : 0);
    cube.position.y = cubeY + (t < 0.34 ? Math.sin(time * 1.4) * 0.08 * settle : 0);

    // loader
    const ld = 1 - seg(t, 0.33, 0.4), n = Math.round(seg(t, 0, 0.333) * 100);
    const cnt = n >= 100 ? "100" : String(n).padStart(2, "0");
    if (els.count.textContent !== cnt) els.count.textContent = cnt;
    setO(els.count, ld);
    const lt = t < 0.2 ? "Surveying the site…" : "Good things worth the wait!!";
    if (els.ltext.textContent !== lt) els.ltext.textContent = lt;
    setO(els.ltext, ld);
    setO(els.hint, 1 - seg(t, 0, 0.04));
    if (sv > 0) {
      f.place(els.dimW, dimWP, sv, "translate(-50%,-50%)");
      f.place(els.dimH, dimHP, sv, "translate(-50%,-50%)");
    } else { setO(els.dimW, 0); setO(els.dimH, 0); }

    // hero, sub, the dive's line
    const hp = seg(t, 0.7, 0.8), hf = 1 - seg(t, 0.88, 0.94);
    setO(els.hero, hp > 0 ? hf : 0); setO(els.eb, hp); reveal(els.hero, hp);
    setO(els.sub, seg(t, 0.8, 0.88) * hf);
    const ep = seg(t, 0.925, 0.965); // fully up before the wash into Survey
    setO(els.final, ep);
    els.final.style.transform = `translateY(calc(-50% + ${((1 - eo(ep)) * 24).toFixed(1)}px))`;
    setO(els.next, seg(t, 0.94, 0.97));
  }

  return { root, update };
}

export function Overlay() {
  return (
    <div aria-live="polite">
      <div className="ac-arrival-count" data-k="count">00</div>
      <div className="ac-arrival-ltext ac-mono" data-k="ltext">Surveying the site…</div>
      <div className="ac-lbl ac-arrival-dim" data-k="dimW">10 500</div>
      <div className="ac-lbl ac-arrival-dim" data-k="dimH">12 000</div>
      <div className="ac-arrival-hero" data-k="hero">
        <p className="ac-eb ac-mono ac-arrival-eb" data-k="eb">Digital experience design agency</p>
        <h1 className="ac-hl"><span className="ln"><span>We don&apos;t</span></span><span className="ln"><span>decorate brands.</span></span><span className="ln"><span>We <em>build</em> them.</span></span></h1>
      </div>
      <div className="ac-arrival-sub" data-k="sub">
        <p>Emotion, design, technology and neuromarketing, engineered into one structure.</p>
        <span className="ac-mono ac-hi">[ Scroll to enter the module ]</span>
      </div>
      <div className="ac-arrival-final" data-k="final">Your brand is the cube.</div>
      <div className="ac-next ac-mono" data-k="next">[ Arrival → Research ]</div>
      <div className="ac-arrival-hint ac-mono" data-k="hint">Scroll to build ↓</div>
    </div>
  );
}
