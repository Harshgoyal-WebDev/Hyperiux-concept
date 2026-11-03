import * as THREE from "three";
import { C, LA, LB, LC, LI, UNIT, bar, barLen, clamp, eo, io, lerp, pad, pip, reveal, seg, setBar, setO } from "../kit";

// 03 BLUEPRINT — strategy before pixels. An orthographic plan camera looks
// down on the sheet: the ghost of Survey's unfolded net fades, construction
// lines frame the sheet, the H draws itself as a floor plan and its walls
// fill solid. Dimension strings and room areas appear, the user flow climbs
// the beam to Conversion, and six orange markers pin the six strategy
// services (click one, or step the spec card). The headline lands, then the
// sheet tilts to axonometric, the walls rise and the module comes up out of
// the atrium, which is where Structure picks the plan up.
export const key = "blueprint";
export const name = "Blueprint";

// service card copy: written by Claude, not taken from the site (placeholder)
const SV = [
  ["UI Design Strategy", "Strategic planning based on insight is the starting point of everything we do.", ["Insight workshops", "Experience roadmap", "KPI framework"], [[15, 0], [47, 0], [47, 40], [15, 40]]],
  ["Branding", "An identity system that holds up on every screen, from logo to motion language.", ["Brand platform", "Visual identity", "Motion and sonic cues"], [[15, 108], [47, 101.1], [47, 175], [15, 175]]],
  ["UX Development", "Journeys, flows and prototypes tested with real users before a pixel is final.", ["Journey maps", "Wireframes and prototypes", "Usability testing"], [[75, 95.1], [165, 75.75], [165, 111.75], [75, 131.1]]],
  ["Integrated Digital Marketing Plan", "Channels, content and campaigns planned around the same experience the site delivers.", ["Channel strategy", "Content calendar", "Performance tracking"], [[192, 0], [225, 0], [225, 32], [192, 32]]],
  ["Customer Experience Strategy", "Every touchpoint mapped, so the brand feels the same before, during and after the sale.", ["Service blueprint", "Touchpoint audit", "CX metrics"], [[192, 133], [225, 133], [225, 186], [192, 186]]],
  ["Consumer Research", "Behaviour, emotion and neuromarketing signals that show what people actually do.", ["Interviews and surveys", "Behavioural analytics", "Neuromarketing tests"], [[192, 186], [225, 186], [225, 240], [192, 240]]],
];

// plan space: logo px (u,v) → world (x,z), 0.1 m per px, a 24 m square
const k = 0.1;
const W3a = (u, v, y = 0) => [(u - 120) * k, y, (v - 120) * k];
const W3 = (u, v, y = 0) => new THREE.Vector3(...W3a(u, v, y));
const P2 = (p) => [(p[0] - 120) * k, (p[1] - 120) * k];

// room areas (m²) and dimension strings, as data so the overlay can render their labels
const ROOMS = [[31, 20, "12.8"], [31, 59, "12.2"], [31, 150, "18.4"], [31, 192, "10.6"], [31, 225, "10.2"], [61, 117, "10.1"], [118, 104, "32.4"], [180, 88, "9.7"], [208, 16, "10.6"], [208, 58, "12.5"], [208, 160, "17.5"], [208, 213, "17.8"]];
const DIM_ROWS = [[[15, 47, 192, 225], -12, true], [[15, 225], -24, true], [[0, 78, 108, 240], 3, false], [[0, 240], -9, false], [[0, 70, 99, 133, 240], 237, false]];
const mm = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const DIMS = DIM_ROWS.flatMap(([us, v, horiz]) => us.slice(0, -1).map((u, i) => {
  const m = (u + us[i + 1]) / 2, p = horiz ? W3a(m, v, 0.02) : W3a(v, m, 0.02);
  if (horiz) p[2] -= 0.55; else p[0] -= 0.55;
  return { p, txt: mm((us[i + 1] - u) * 100), rot: !horiz };
}));

// inset a polygon by d (walls are the footprint minus this hole)
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

// draw a bar on to k, skipping the rebuild when k hasn't changed
const draw = (m, kk) => { if (m.userData.k !== kk) { m.userData.k = kk; setBar(m, kk); } };
const XA = new THREE.Vector3(1, 0, 0);

export function build() {
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.15 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);

  // walls: footprint minus an inset hole, extruded 1 m (scaled up at the tilt)
  const TH = 0.38;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.85, transparent: true, opacity: 0 });
  const walls = new THREE.Group(); root.add(walls);
  const outlineMat = new THREE.MeshBasicMaterial({ color: C.ink, transparent: true }), outlines = [];
  const parts = [[[15, 40], [47, 40]], [[15, 175], [47, 175]], [[15, 208], [47, 208]], [[75, 95.1], [75, 131.1]], [[165, 75.75], [165, 111.75]], [[192, 32], [225, 32]], [[192, 186], [225, 186]]];
  [LA, LB, LC].forEach((poly) => {
    const outer = poly.map(P2), inner = inset(outer, TH);
    const sh = new THREE.Shape(outer.map((p) => new THREE.Vector2(p[0], -p[1])));
    sh.holes.push(new THREE.Path(inner.map((p) => new THREE.Vector2(p[0], -p[1]))));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, wallMat); m.castShadow = m.receiveShadow = true; walls.add(m);
    [outer, inner].forEach((ring) => ring.forEach((p, i) => {
      const q = ring[(i + 1) % ring.length], b = bar([p[0], 0.02, p[1]], [q[0], 0.02, q[1]], 0.07, outlineMat, 0.02);
      b.userData.kind = "wall"; root.add(b); outlines.push(b);
    }));
  });
  parts.forEach(([a, b]) => {
    const A = W3(...a), B = W3(...b), d = new THREE.Vector3().subVectors(B, A).normalize();
    const A2 = A.clone().addScaledVector(d, TH * 0.6), B2 = B.clone().addScaledVector(d, -TH * 0.6);
    const m = new THREE.Mesh(UNIT, wallMat); m.castShadow = true;
    m.scale.set(A2.distanceTo(B2), 1, TH * 0.55); m.quaternion.setFromUnitVectors(XA, d);
    m.position.copy(A2).add(B2).multiplyScalar(0.5); m.position.y = 0.5; walls.add(m);
    const nrm = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(TH * 0.275);
    [1, -1].forEach((sg) => {
      const o = bar(A2.clone().addScaledVector(nrm, sg).setY(0.02), B2.clone().addScaledVector(nrm, sg).setY(0.02), 0.06, outlineMat, 0.02);
      o.userData.kind = "part"; root.add(o); outlines.push(o);
    });
  });
  const wLen = outlines.map(barLen);
  const tw = wLen.reduce((sm, l, i) => sm + (outlines[i].userData.kind === "wall" ? l : 0), 0);
  const tp = wLen.reduce((sm, l, i) => sm + (outlines[i].userData.kind === "part" ? l : 0), 0);

  // rooms that fill orange for the selected service
  const roomMat = SV.map(() => new THREE.MeshBasicMaterial({ color: C.or, transparent: true, opacity: 0, depthWrite: false }));
  SV.forEach((sv, i) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(sv[3].map((p) => { const q = P2(p); return new THREE.Vector2(q[0], -q[1]); })));
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, roomMat[i]); m.position.y = 0.008; root.add(m);
  });

  // ghost of Survey's unfolded net
  const ghostMat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true }), ghost = new THREE.Group(); root.add(ghost);
  [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6], [0, 12]].forEach(([x, z]) => {
    const c = [[x - 3, z - 3], [x + 3, z - 3], [x + 3, z + 3], [x - 3, z + 3]];
    c.forEach((p, i) => { const q = c[(i + 1) % 4]; ghost.add(bar([p[0], 0.015, p[1]], [q[0], 0.015, q[1]], 0.05, ghostMat, 0.01)); });
  });

  // atrium: the module's footprint, open to above
  const atMat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true }), atrium = new THREE.Group(); root.add(atrium);
  const AD = [[120, 86], [137, 103], [120, 120], [103, 103]].map((p) => W3(p[0], p[1], 0.03));
  AD.forEach((p, i) => { const q = AD[(i + 1) % 4]; for (let st = 0; st < 1; st += 0.2) atrium.add(bar(p.clone().lerp(q, st), p.clone().lerp(q, st + 0.12), 0.05, atMat, 0.01)); });
  atrium.add(bar(AD[0], AD[2], 0.03, atMat, 0.01)); atrium.add(bar(AD[1], AD[3], 0.03, atMat, 0.01));

  // dimension strings with ticks
  const dimMat = new THREE.MeshBasicMaterial({ color: C.ink, transparent: true }), dims = new THREE.Group(); root.add(dims);
  const tk = new THREE.Vector3(0.28, 0, -0.28);
  DIM_ROWS.forEach(([us, v, horiz]) => {
    const pts = us.map((u) => (horiz ? W3(u, v, 0.02) : W3(v, u, 0.02)));
    dims.add(bar(pts[0], pts[pts.length - 1], 0.035, dimMat, 0.01));
    pts.forEach((p) => dims.add(bar(p.clone().sub(tk), p.clone().add(tk), 0.06, dimMat, 0.01)));
  });

  // user flow: dashes up the left column, along the beam, up the right column
  const flowMat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true }), flow = [];
  const fpts = [[31, 232], [31, 122.6], [208, 84.5], [208, 8]].map((p) => W3(p[0], p[1], 0.04));
  let acc = 0;
  for (let i = 0; i < fpts.length - 1; i++) {
    const a = fpts[i], b = fpts[i + 1], L = a.distanceTo(b);
    for (let st = 0; st < L; st += 0.9) {
      const m = bar(a.clone().lerp(b, st / L), a.clone().lerp(b, Math.min(L, st + 0.55) / L), 0.11, flowMat, 0.02);
      m.userData.d0 = acc + st; root.add(m); flow.push(m);
    }
    acc += L;
  }
  const fTot = acc, fSeg = fpts.slice(0, -1).map((p, i) => p.distanceTo(fpts[i + 1]));
  const pulse = new THREE.Mesh(new THREE.CircleGeometry(0.32, 32), flowMat); pulse.rotation.x = -Math.PI / 2; root.add(pulse);
  const endDot = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), flowMat); endDot.rotation.x = -Math.PI / 2; endDot.position.copy(fpts[3]).setY(0.05); root.add(endDot);
  const along = (d, out) => {
    let r = d;
    for (let i = 0; i < fSeg.length; i++) { if (r <= fSeg[i]) return out.copy(fpts[i]).lerp(fpts[i + 1], r / fSeg[i]); r -= fSeg[i]; }
    return out.copy(fpts[fpts.length - 1]);
  };

  // the module, rising out of the atrium at the end
  const cube = new THREE.Group();
  const cubeM = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: C.or, roughness: 0.55, transparent: true }));
  cubeM.castShadow = true; cube.add(cubeM);
  cube.position.copy(W3(120, 103, 0)); cube.rotation.y = Math.PI / 4; root.add(cube);

  // projected label anchors
  const roomP = ROOMS.map((r) => W3(r[0], r[1] + 6, 0));
  const dimP = DIMS.map((d) => new THREE.Vector3(...d.p));
  const atP = W3(120, 68, 0), ufP = W3(31, 252, 0), cvP = W3(234, 10, 0);
  const mkP = SV.map((sv) => { const c = sv[3].reduce((a, p) => [a[0] + p[0] / sv[3].length, a[1] + p[1] / sv[3].length], [0, 0]); return W3(c[0], c[1] - 6, 0); });
  const clP = [W3(120, 0, 0), W3(120, 240, 0)];

  // card state: a visitor's pick (marker or prev/next) overrides the auto card
  let userSel = null, shown = -1;
  const fillCard = (els, i) => {
    if (i === shown) return;
    shown = i;
    const sv = SV[i];
    els.cardNo.textContent = `${pad(i + 1)} / 06`; els.cardT.textContent = sv[0]; els.cardP.textContent = sv[1];
    els.cardL.innerHTML = sv[2].map((x) => `<li>${x}</li>`).join("");
  };

  function bind(els) {
    SV.forEach((_, i) => { if (els[`mk${i}`]) els[`mk${i}`].onclick = () => { userSel = i; }; });
    els.cPrev.onclick = () => { userSel = ((userSel ?? 0) + 5) % 6; };
    els.cNext.onclick = () => { userSel = ((userSel ?? 0) + 1) % 6; };
    shown = -1; fillCard(els, 0);
  }

  const tg = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3();
  const up0 = new THREE.Vector3(0, 0, -1), up1 = new THREE.Vector3(0, 1, 0);
  const d0 = new THREE.Vector3(0, 1, 0.0001), d1 = new THREE.Vector3(0.62, 0.78, 0.95).normalize();

  function update(t, f) {
    const { rig, els, time } = f;
    f.sky(C.paper); f.theme(0);
    rig.hemi.intensity = 0.7 * LI;
    rig.amb.intensity = 0.2 * LI;
    rig.sun.intensity = 0.75 * LI; rig.sun.position.set(-18, 30, 14); rig.sun.target.position.set(0, 0, 0);
    Object.assign(rig.sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 90 });
    rig.sun.shadow.camera.updateProjectionMatrix();

    // camera: orthographic plan, tilting to axonometric
    const tl = io(seg(t, 0.88, 1)), asp = f.W / f.H;
    const hh = f.narrow ? Math.max(19, 15.5 / asp) : lerp(20.5, 21, tl);
    const cam = f.orthoLens(hh, f.narrow ? { y: -lerp(0.09, 0.06, tl), far: 400 } : { x: -lerp(0.15, 0.06, tl), far: 400 });
    dir.copy(d0).lerp(d1, tl).normalize(); tg.set(0, lerp(0, 1.6, tl), 0);
    cam.up.copy(up0).lerp(up1, tl).normalize();
    cam.position.copy(tg).addScaledVector(dir, 90); cam.lookAt(tg);

    // drawing: ghost net out, outlines draw, partitions draw, walls fill solid
    const gn = 1 - seg(t, 0, 0.12); ghost.visible = gn > 0; ghostMat.opacity = gn * 0.75;
    const dr = seg(t, 0.05, 0.24), dp = seg(t, 0.15, 0.28), wf = io(seg(t, 0.3, 0.42));
    let aw = 0, ap = 0;
    outlines.forEach((o, i) => {
      const isW = o.userData.kind === "wall", L = wLen[i], st = isW ? aw / tw : ap / tp, en = isW ? (aw + L) / tw : (ap + L) / tp;
      if (isW) aw += L; else ap += L;
      draw(o, wf >= 1 ? 0 : clamp(((isW ? dr : dp) - st) / (en - st)));
    });
    outlineMat.opacity = 1 - wf;
    wallMat.opacity = wf; walls.visible = wf > 0; walls.scale.y = lerp(0.05, 3.4, tl);

    const at = seg(t, 0.24, 0.3) * (1 - seg(t, 0.9, 0.97)); atrium.visible = at > 0; atMat.opacity = at;
    const dm = seg(t, 0.42, 0.5) * (1 - seg(t, 0.84, 0.9)); dims.visible = dm > 0; dimMat.opacity = dm;
    const fp = seg(t, 0.5, 0.6), ff = 1 - seg(t, 0.86, 0.9);
    flow.forEach((m) => { m.visible = ff > 0 && m.userData.d0 < fp * fTot; });
    flowMat.opacity = ff;
    pulse.visible = fp >= 1 && ff > 0; along((time * 2.4) % fTot, pulse.position).setY(0.06);
    endDot.visible = fp > 0.98 && ff > 0;

    // markers + spec card
    const mf = 1 - seg(t, 0.86, 0.9), markersOn = seg(t, 0.62, 0.66) * mf;
    const autoCard = seg(t, 0.68, 0.75) * (1 - seg(t, 0.8, 0.84));
    if (userSel != null && markersOn <= 0) userSel = null;
    const sel = userSel ?? 0, cardO = userSel != null ? markersOn : autoCard;
    fillCard(els, sel);
    setO(els.card, cardO); els.card.style.pointerEvents = cardO > 0.5 ? "auto" : "none";
    roomMat.forEach((m, i) => { m.opacity = i === sel ? 0.86 * cardO : 0; });
    mkP.forEach((p, i) => {
      const b = els[`mk${i}`], mp = eo(seg(t, 0.58 + i * 0.012, 0.62 + i * 0.012)) * mf;
      f.place(b, p, mp); b.style.pointerEvents = mp > 0.5 ? "auto" : "none";
      b.classList.toggle("on", i === sel && cardO > 0.5);
    });

    // labels
    const rm = seg(t, 0.5, 0.56) * (1 - seg(t, 0.86, 0.9));
    roomP.forEach((p, i) => f.place(els[`rm${i}`], p, rm * 0.9, "translate(-50%,-50%)"));
    dimP.forEach((p, i) => f.place(els[`dm${i}`], p, dm, DIMS[i].rot ? "translate(-50%,-50%) rotate(-90deg)" : "translate(-50%,-50%)"));
    f.place(els.at, atP, at * (1 - tl), "translate(-50%,-50%)");
    f.place(els.uf, ufP, fp > 0 ? ff : 0, "translate(-50%,-50%)");
    f.place(els.cv, cvP, seg(t, 0.58, 0.6) * ff, "translate(-50%,-50%)");
    const clo = seg(t, 0.03, 0.12) * (1 - seg(t, 0.4, 0.5));
    clP.forEach((p, i) => {
      const el = els[`cl${i}`];
      if (clo > 0) el.style.transform = `translateY(${f.project(tmp.copy(p))[1].toFixed(1)}px)`;
      setO(el, clo * 0.8);
    });

    // the module rises out of the atrium
    const cb = seg(t, 0.9, 1); cube.visible = cb > 0; cubeM.material.opacity = Math.min(1, cb * 2);
    cube.position.y = 3.4 + 1.2 + lerp(-2.4, 2.2, eo(cb)); cube.rotation.y = Math.PI / 4 + time * 0.3;

    // type
    const hp = seg(t, 0.8, 0.87), hf = 1 - seg(t, 0.92, 0.98);
    setO(els.hd, hp > 0 ? hf : 0); reveal(els.hd, hp);
    setO(els.next, seg(t, 0.93, 1)); setO(els.hint, 1 - seg(t, 0, 0.04));
  }

  return { root, update, bind };
}

export function Overlay() {
  return (
    <>
      <div className="ac-blueprint-cline" data-k="cl0" />
      <div className="ac-blueprint-cline" data-k="cl1" />
      {ROOMS.map((r, i) => <div key={`rm${i}`} className="ac-lbl ac-blueprint-l" data-k={`rm${i}`}>{r[2]} m²</div>)}
      {DIMS.map((d, i) => <div key={`dm${i}`} className="ac-lbl ac-blueprint-l" data-k={`dm${i}`}>{d.txt}</div>)}
      <div className="ac-lbl ac-blueprint-l ac-hi" data-k="at">Module · open to above</div>
      <div className="ac-lbl ac-blueprint-l ac-hi" data-k="uf">User flow</div>
      <div className="ac-lbl ac-blueprint-l ac-hi" data-k="cv">Conversion</div>
      {SV.map((sv, i) => (
        <button key={`mk${i}`} type="button" className="ac-blueprint-mk" data-k={`mk${i}`} aria-label={`Service ${i + 1}: ${sv[0]}`}>
          {pad(i + 1)}<span className="ac-blueprint-tip">{sv[0]}</span>
        </button>
      ))}
      <div className="ac-blueprint-hd" data-k="hd">
        <p className="ac-eb ac-mono">From concept to conversion</p>
        <h2 className="ac-hl"><span className="ln"><span>Strategy is</span></span><span className="ln"><span>the floor</span></span><span className="ln"><span><em>plan.</em></span></span></h2>
      </div>
      <aside className="ac-blueprint-card" data-k="card" aria-live="polite">
        <div className="ac-blueprint-ch">
          <span className="ac-mono" data-k="cardNo">01 / 06</span>
          <span className="ac-blueprint-sp" />
          <button type="button" data-k="cPrev" aria-label="Previous service">←</button>
          <button type="button" data-k="cNext" aria-label="Next service">→</button>
        </div>
        <div className="ac-blueprint-cb">
          <h3 data-k="cardT">{SV[0][0]}</h3>
          <p data-k="cardP">{SV[0][1]}</p>
          <ul data-k="cardL" />
          <span className="ac-blueprint-go">View service →</span>
          <div className="ac-mono ac-blueprint-note">Placeholder copy</div>
        </div>
      </aside>
      <div className="ac-next ac-mono" data-k="next">[ Strategy → Structure ]</div>
      <div className="ac-blueprint-hint ac-mono" data-k="hint">Scroll to draw ↓</div>
    </>
  );
}
