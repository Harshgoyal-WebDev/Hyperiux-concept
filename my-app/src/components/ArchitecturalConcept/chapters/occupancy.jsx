import * as THREE from "three";
import { C, LI, V, clamp, dotTexture, eo, io, keys, lerp, mixHex, pad, reveal, seg, setO } from "../kit";
import { BH, BLD, FILL, RD, RN, ZN, buildBase, buildFillers, buildProjects, winClass, winTextures, windowCells } from "./district-layout";

// 08 OCCUPANCY — dawn over the same district. The night city turns back
// into a drawing (light fills, ink edges), then five industry zones light in
// turn while the panel names them. People flow along the road and windows
// light up orange, growth bars rise (placeholder metrics), the Patronum quote
// lands, and the camera climbs to the high aerial Handover opens on.
export const key = "occupancy";
export const name = "Occupancy";

const IND = [
  ["Electronics", "Launches and configurators that make specs feel simple."],
  ["Fintech", "Experiences that simplify complexity, build trust and lift adoption."],
  ["Education", "Learning journeys that hold attention from first visit to enrolment."],
  ["Technology", "Clear stories for complex platforms, from SaaS to deep tech."],
  ["Banking", "Secure, accessible journeys from browsing to onboarding."],
];
const BARS = [["Conversion", 0.6], ["Engagement", 0.8], ["Organic reach", 1]];
const zc = (k) => [ZN[k].clone().add(V([-26, 46, 58])), ZN[k].clone()];
const K = [
  [0, V([0, 40, 110]), V([0, 12, -30])],
  [0.111, ...zc(0)], [0.222, ...zc(1)], [0.333, ...zc(2)], [0.444, ...zc(3)], [0.556, ...zc(4)],
  [0.667, V([10, 58, 92]), V([0, 6, -8])], [0.889, V([10, 58, 92]), V([0, 6, -8])], [1, V([0, 150, 140]), V([0, 0, 0])],
];
const ZR = 13; // zone radius
const NP = 420; // people

export function build() {
  const root = new THREE.Group();
  const base = buildBase();
  root.add(base.group);

  // facades: night windows (emissive) fade out as the fills turn to paper
  const WT = winTextures();
  const sideM = WT.map((t) => new THREE.MeshStandardMaterial({ color: 0x1a1a1e, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7, roughness: 1 }));
  const roofM = new THREE.MeshStandardMaterial({ color: 0x141417, roughness: 1 });
  const fill = buildFillers(sideM.map((m) => [m, roofM]));
  root.add(fill.group);
  const edgeMats = BLD.map(() => new THREE.LineBasicMaterial({ color: 0x9a9aa2, transparent: true, opacity: 0.8 }));
  const proj = buildProjects((h) => sideM[winClass(h)], roofM, edgeMats);
  proj.groups.forEach((G) => root.add(G));

  // which zone each filler stands in (for the tint when its zone lights)
  const WHITE = new THREE.Color(1, 1, 1), TINT = new THREE.Color("#FFD3B5"), tc = new THREE.Color();
  const zoneOf = fill.idx.map((list) => list.map((fi) => {
    const [x, z] = FILL[fi];
    return ZN.findIndex((p) => Math.hypot(p.x - x, p.z - z) < ZR);
  }));
  fill.meshes.forEach((m) => { for (let n = 0; n < m.count; n++) m.setColorAt(n, WHITE); });

  // zone decals: orange disc + ring when active, a dashed ink ring otherwise
  const zones = ZN.map((p) => {
    const g = new THREE.Group(); g.position.set(p.x, 0.07, p.z); root.add(g);
    const flat = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; g.add(m); return mat; };
    const disc = flat(new THREE.CircleGeometry(ZR, 64), new THREE.MeshBasicMaterial({ color: C.or, transparent: true, opacity: 0, depthWrite: false }));
    const ring = flat(new THREE.RingGeometry(ZR - 0.3, ZR + 0.3, 96), new THREE.MeshBasicMaterial({ color: C.or, transparent: true, opacity: 0, depthWrite: false }));
    const pts = [];
    for (let a = 0; a < 96; a++) pts.push(new THREE.Vector3(ZR * Math.cos((a / 96) * Math.PI * 2), 0.02, ZR * Math.sin((a / 96) * Math.PI * 2)));
    const dg = new THREE.BufferGeometry().setFromPoints(pts);
    const dmat = new THREE.LineDashedMaterial({ color: C.ink, dashSize: 1.1, gapSize: 1.1, transparent: true, opacity: 0 });
    const dl = new THREE.LineLoop(dg, dmat); dl.computeLineDistances(); g.add(dl);
    return { disc, ring, dmat, lp: new THREE.Vector3(p.x, 0, p.z + ZR + 2.5) };
  });

  // windows lighting up orange: three sets of small quads
  const winQ = new THREE.PlaneGeometry(1, 1);
  const winSets = windowCells(9, 0.2).map((cells) => {
    const mat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true, opacity: 0, depthWrite: false });
    const m = new THREE.InstancedMesh(winQ, mat, cells.length);
    cells.forEach((c, i) => m.setMatrixAt(i, c));
    m.visible = false; root.add(m);
    return m;
  });

  // people: points flowing along the road and its pavements
  const pPos = new Float32Array(NP * 3), pR = new Float32Array(NP), pLat = new Float32Array(NP), pDir = new Float32Array(NP), pSp = new Float32Array(NP);
  {
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < NP; i++) {
      const lane = r(), side = r() < 0.5 ? -1 : 1;
      pLat[i] = lane < 0.55 ? side * (0.6 + r() * 3) : side * (4.8 + r() * 1.4);
      pDir[i] = pLat[i] > 0 ? 1 : -1; pR[i] = r(); pSp[i] = 0.7 + r() * 0.6;
    }
  }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: C.ink, size: 1.1, map: dotTexture(), alphaTest: 0.5, transparent: true, opacity: 0 });
  const people = new THREE.Points(pGeo, pMat); people.frustumCulled = false; people.visible = false; root.add(people);

  const patP = new THREE.Vector3(BLD[2].P.x, BH[2] + 1, BLD[2].P.z), ORC = new THREE.Color(C.or), INK = new THREE.Color(C.ink), GREY = new THREE.Color(0x9a9aa2);
  let shownZ = -1, liEls = [];

  function bind(els) {
    liEls = [...els.list.querySelectorAll("li")];
  }

  function update(t, f) {
    const { rig, els, time } = f;
    const dn = io(seg(t, 0, 0.14)), ink = seg(t, 0.05, 0.09);
    const zo = seg(t, 0.06, 0.1) * (1 - seg(t, 0.6, 0.64));

    // camera: zone to zone, then out to the high aerial
    const [pos, tg] = keys(K, t), par = 1 - seg(t, 0.9, 1);
    pos.x += f.px * 2.4 * par; pos.y -= f.py * 1.6 * par;
    f.lens(44, { near: 0.5, far: 900, tall: 1.45, x: f.narrow ? 0 : 0.12 * zo, y: f.narrow ? 0.1 * zo : 0 });
    f.cam.position.copy(pos); f.cam.lookAt(tg);

    // dawn → paper day; the city becomes a drawing again
    f.theme(1 - ink); // night ink at t=0 (District's dawn), paper ink from F02
    const skyB = mixHex("#B86A40", C.paper, dn);
    f.sky(mixHex("#24232C", C.paper, dn), skyB);
    rig.fog.color.set(skyB); rig.fog.near = lerp(60, 160, dn); rig.fog.far = lerp(190, 520, dn);
    rig.hemi.color.set(mixHex("#8a96b8", "#ffffff", dn)); rig.hemi.groundColor.set(mixHex("#0c0c0e", "#d6cfc2", dn)); rig.hemi.intensity = lerp(0.55, 0.62, dn) * LI;
    rig.sun.color.set(mixHex("#c0c8ff", mixHex("#ffb27a", "#ffffff", seg(t, 0.1, 0.3)), dn)); rig.sun.intensity = lerp(0.4, 0.75, dn) * LI;
    rig.sun.position.set(lerp(40, -50, dn), lerp(80, 70, dn), lerp(-30, 60, dn)); rig.sun.target.position.set(0, 0, 0);

    const side = mixHex("#1a1a1e", "#FAF9F6", dn);
    sideM.forEach((m) => { m.color.set(side); m.emissiveIntensity = 0.7 * (1 - dn); });
    roofM.color.set(mixHex("#141417", "#F3F2EE", dn));
    base.groundMat.color.set(mixHex("#0d0d0f", C.paper, dn));
    base.gridMat.color.set(mixHex("#ffffff", C.ink, dn)); base.gridMat.opacity = lerp(0.045, 0.09, dn);
    base.roadMat.color.set(mixHex("#17171b", "#D9D7D1", dn)); base.roadMat.metalness = lerp(0.1, 0, dn);
    base.edgeMat.color.set(mixHex("#56565c", "#3B3A37", dn));
    base.dashMat.opacity = lerp(0.6 + 0.25 * Math.sin(time * 3), 0.7, dn);
    fill.edgeMat.color.set(mixHex("#4a4a52", C.ink, dn)); fill.edgeMat.opacity = lerp(0.7, 0.6, dn);

    // zones light in turn
    const u = clamp((t - 0.111) / 0.111, 0, 4), zi = Math.round(u);
    const zw = ZN.map((_, i) => clamp(1.5 - 2 * Math.abs(u - i)) * zo);
    zones.forEach((z, i) => {
      z.disc.opacity = 0.14 * zw[i]; z.ring.opacity = zw[i];
      z.dmat.opacity = 0.5 * zo * (1 - zw[i]);
      f.place(els["z" + i], z.lp, zo, "translate(-50%,0)");
      els["z" + i].classList.toggle("ac-occupancy-on", i === zi);
    });
    fill.meshes.forEach((m, k) => {
      zoneOf[k].forEach((zk, n) => { m.setColorAt(n, zk < 0 ? WHITE : tc.copy(WHITE).lerp(TINT, zw[zk])); });
      if (m.instanceColor) m.instanceColor.needsUpdate = true; // an empty batch never gets a colour buffer
    });

    // industry panel
    setO(els.panel, zo);
    if (zi !== shownZ) {
      shownZ = zi;
      els.zNo.textContent = pad(zi + 1); els.zName.textContent = IND[zi][0]; els.zDesc.textContent = IND[zi][1];
      liEls.forEach((l, i) => l.classList.toggle("ac-occupancy-on", i === zi));
    }

    // people + windows
    const pe = seg(t, 0.6, 0.68) * (1 - seg(t, 0.9, 0.97));
    people.visible = pe > 0; pMat.opacity = pe;
    if (pe > 0) {
      for (let i = 0; i < NP; i++) {
        let p = (pR[i] + pDir[i] * (t * 1.6 + time * 0.012 * pSp[i])) % 1; if (p < 0) p += 1;
        const s = -100 + 200 * p;
        pPos[i * 3] = RD.x * s + RN.x * pLat[i]; pPos[i * 3 + 1] = 0.6; pPos[i * 3 + 2] = RD.z * s + RN.z * pLat[i];
      }
      pGeo.attributes.position.needsUpdate = true;
    }
    winSets.forEach((m, k) => {
      const o = seg(t, 0.6 + k * 0.025, 0.66 + k * 0.025) * (1 - seg(t, 0.9, 0.97));
      m.visible = o > 0; m.material.opacity = o;
    });

    // growth bars (placeholder metrics)
    const gb = seg(t, 0.7, 0.75) * (1 - seg(t, 0.79, 0.82));
    setO(els.growth, gb);
    const gh = eo(seg(t, 0.7, 0.78));
    BARS.forEach((b, i) => { els["g" + i].style.transform = `scaleY(${(b[1] * gh).toFixed(3)})`; });

    // the Patronum quote; its building is picked out in orange
    const qp = seg(t, 0.81, 0.87), qf = 1 - seg(t, 0.93, 0.98);
    setO(els.quote, qp > 0 ? qf : 0); reveal(els.quote, qp);
    const ph = qp * qf;
    edgeMats.forEach((m, j) => {
      m.color.copy(GREY).lerp(INK, dn);
      if (j === 2) m.color.lerp(ORC, ph);
      m.opacity = lerp(0.8, 0.9, dn);
    });
    f.place(els.pat, patP, ph, "translate(-50%,-100%)");

    setO(els.next, seg(t, 0.93, 1));
  }

  return { root, update, bind };
}

export function Overlay() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="ac-lbl ac-mono ac-occupancy-zl" data-k={"z" + i}>{pad(i + 1)}</div>
      ))}
      <div className="ac-lbl ac-occupancy-pat" data-k="pat"><span>03 Patronum</span><i /></div>

      <aside className="ac-occupancy-panel ac-panel" data-k="panel" aria-live="polite">
        <span className="ac-mono ac-hi">Industries we work in</span>
        <div className="ac-occupancy-zrow"><b className="ac-occupancy-no" data-k="zNo">01</b><h3 data-k="zName">Electronics</h3></div>
        <p data-k="zDesc">{IND[0][1]}</p>
        <ol className="ac-occupancy-list ac-mono" data-k="list">
          {IND.map((d, i) => <li key={d[0]}>{pad(i + 1)}&nbsp;&nbsp;{d[0]}</li>)}
        </ol>
      </aside>

      <aside className="ac-occupancy-growth ac-panel" data-k="growth">
        <div className="ac-occupancy-gh"><span className="ac-mono ac-hi">Growth, measured</span><span className="ac-mono ac-occupancy-ph">Placeholder</span></div>
        <div className="ac-occupancy-bars">
          {BARS.map((b, i) => (
            <div key={b[0]}><span className="ac-occupancy-bar"><i data-k={"g" + i} className={i === 2 ? "ac-occupancy-or" : ""} /></span><span className="ac-mono">{b[0]} ↑</span></div>
          ))}
        </div>
        <p className="ac-occupancy-note">Live client metrics plug in here.</p>
      </aside>

      <figure className="ac-occupancy-quote" data-k="quote">
        <span className="ac-occupancy-qm" aria-hidden="true">“</span>
        <blockquote className="ac-hl">
          <span className="ln"><span>A website that not only</span></span>
          <span className="ln"><span>captured our essence but</span></span>
          <span className="ln"><span><em>transformed</em> our digital</span></span>
          <span className="ln"><span>presence.</span></span>
        </blockquote>
        <figcaption className="ac-mono">Paul Lees · CEO, Patronum</figcaption>
      </figure>

      <div className="ac-next ac-mono" data-k="next">[ Occupancy → Handover ]</div>
    </>
  );
}
