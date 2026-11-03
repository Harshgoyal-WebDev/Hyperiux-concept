import * as THREE from "three";
import { LI, V, clamp, eo, keys, lerp, mixHex, pad, reveal, seg, setO } from "../kit";
import { BH, BLD, FACADE, PROJ, RN, buildBase, buildFillers, buildProjects, camFront, camK, road, winClass, winTextures } from "./district-layout";

// 07 DISTRICT — selected work as a night city along the beam-road. Lit
// windows, five project buildings, each with a mock of its site on the
// facade. The camera drops from an aerial to the road and stops at each
// project like a station: the building glows, its card slides in (prev/next,
// or click a building to travel there). It rises again for "View all
// projects", and first light comes up at the horizon (→ Occupancy).
export const key = "district";
export const name = "District";

const TK = [0.278, 0.444, 0.556, 0.667, 0.778]; // card peaks
const STOP = [0.222, 0.444, 0.556, 0.667, 0.778]; // where a click travels to
const K = [
  [0, V([0, 95, 85]), V([0, 0, -5])],
  [0.111, road(-96).add(V([0, 13, 0])), BLD[0].P.clone().add(V([0, 8, 0]))],
  [0.222, ...camK(0)], [0.333, ...camFront(0, 25)], [0.444, ...camK(1)], [0.556, ...camK(2, 30)], [0.667, ...camK(3, 42)], [0.778, ...camK(4, 42)],
  [0.889, V([24, 72, 96]), V([0, 0, -6])], [1, V([0, 40, 110]), V([0, 12, -30])],
];
const vis = (t, tk) => clamp((0.075 - Math.abs(t - tk)) / 0.03);
const cardO = (t, j) => (j === 0 ? Math.max(vis(t, 0.222), vis(t, 0.333)) : vis(t, TK[j]));

// a mock of each project's site, drawn onto its facade (real captures go here)
function facadeTex(j, w, h, F) {
  const c = document.createElement("canvas"), S = 64;
  c.width = Math.round(w * S); c.height = Math.round(h * S);
  const x = c.getContext("2d"), W = c.width, H = c.height, [p0, p1] = PROJ[j][3], u = Math.min(W, H) / 100;
  x.fillStyle = "#F3F2EE"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#141413"; x.font = `600 ${3.2 * u}px ${F.mono}`; x.fillText(PROJ[j][0].toUpperCase(), 5 * u, 8 * u);
  x.fillStyle = "#8E8B85"; [0, 1, 2].forEach((i) => x.fillRect(W - 30 * u + i * 8 * u, 5.5 * u, 6 * u, 1.6 * u));
  x.fillStyle = "#FF6A13"; x.fillRect(W - 9 * u, 4.5 * u, 5 * u, 3.4 * u);
  const tall = H > W * 1.3, hx = 5 * u, hy = tall ? 22 * u : 24 * u, imgX = tall ? 5 * u : W * 0.54, imgY = tall ? H * 0.48 : 18 * u, imgW = tall ? W - 10 * u : W * 0.42, imgH = tall ? H * 0.3 : H - 30 * u;
  x.fillStyle = "#141413"; x.font = `700 ${(tall ? 11 : 12) * u}px ${F.display}`;
  const words = PROJ[j][0].toUpperCase().split(" ");
  words.forEach((wd, i) => x.fillText(wd, hx, hy + i * 11 * u));
  x.font = `400 ${3 * u}px ${F.body}`; x.fillStyle = "#5D5B56"; x.fillText("Designed and built by Hyperiux", hx, hy + words.length * 11 * u + 1 * u);
  const g = x.createLinearGradient(imgX, imgY, imgX + imgW, imgY + imgH); g.addColorStop(0, p0); g.addColorStop(1, p1);
  x.fillStyle = g; x.fillRect(imgX, imgY, imgW, imgH);
  x.fillStyle = "rgba(255,255,255,.85)"; x.beginPath(); x.arc(imgX + imgW * 0.62, imgY + imgH * 0.45, Math.min(imgW, imgH) * 0.22, 0, Math.PI * 2); x.fill();
  const by = tall ? imgY - 12 * u : H - 18 * u;
  x.fillStyle = "#FF6A13"; x.fillRect(hx, by, 18 * u, 6 * u);
  x.fillStyle = "#fff"; x.font = `600 ${2.4 * u}px ${F.mono}`; x.fillText("EXPLORE →", hx + 2.6 * u, by + 3.9 * u);
  // keep it obviously a mock
  x.fillStyle = "#8E8B85"; x.font = `600 ${2.2 * u}px ${F.mono}`; x.textAlign = "right";
  x.fillText("MOCK FACADE · SITE CAPTURE GOES HERE", W - 4 * u, H - 3 * u);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return t;
}

export function build() {
  const root = new THREE.Group();

  const base = buildBase();
  root.add(base.group);

  // night facades: lit window textures, emissive
  const WT = winTextures();
  const WM = WT.map((t) => new THREE.MeshStandardMaterial({ color: 0x232328, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7, roughness: 0.8 }));
  const roofM = new THREE.MeshStandardMaterial({ color: 0x141417, roughness: 0.9 });
  const fill = buildFillers(WM.map((m) => [m, roofM]));
  root.add(fill.group);

  const edgeMats = PROJ.map(() => new THREE.LineBasicMaterial({ color: 0x9a9aa2, transparent: true, opacity: 0.9 }));
  const proj = buildProjects((h) => WM[winClass(h)], roofM, edgeMats);
  proj.groups.forEach((G) => root.add(G));

  // facade screens + a soft glow in front of each
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,140,70,.9)"); g.addColorStop(0.4, "rgba(255,106,19,.25)"); g.addColorStop(1, "rgba(255,106,19,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const screens = [], glows = [];
  BLD.forEach((b, j) => {
    const [fw, fh, fy, fz] = FACADE[j], front = -b.side;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshBasicMaterial({ color: 0xf3f2ee, transparent: true, opacity: 0.35, fog: false }));
    scr.position.set(0, fy, front * (fz + 0.06)); if (front < 0) scr.rotation.y = Math.PI;
    scr.userData.j = j; proj.groups[j].add(scr); screens.push(scr);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(26, 26, 1); sp.position.set(0, fy, front * (fz + 2)); proj.groups[j].add(sp); glows.push(sp);
  });
  const hitList = [...proj.meshes, ...screens];

  const labelP = BLD.map((b, j) => new THREE.Vector3(b.P.x, BH[j] + 1, b.P.z));
  const GREY = new THREE.Color(0x9a9aa2), ORC = new THREE.Color(0xff6a13);
  let lastJ = 0, shown = -1, goT = null;

  function paintFacades() {
    const cs = getComputedStyle(document.querySelector(".ac-root") || document.body);
    const F = { display: cs.getPropertyValue("--display") || "Arial", body: cs.getPropertyValue("--body") || "Arial", mono: cs.getPropertyValue("--mono") || "monospace" };
    screens.forEach((s, j) => {
      const g = s.geometry.parameters;
      s.material.map?.dispose();
      s.material.map = facadeTex(j, g.width, g.height, F);
      s.material.color.set(0xffffff); s.material.needsUpdate = true;
    });
  }

  function bind(els, f) {
    goT = (j) => f.goT(6 + STOP[j]);
    paintFacades();
    document.fonts?.ready.then(paintFacades);
    els.cPrev.addEventListener("click", () => goT((lastJ + 4) % 5));
    els.cNext.addEventListener("click", () => goT((lastJ + 1) % 5));

    // click a building to travel to it
    const sec = els.card.closest("[data-ch]"), on = () => sec?.dataset.on === "true";
    const canvas = document.querySelector(".ac-gl canvas");
    if (!canvas) return;
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    const pick = (e) => {
      const r = canvas.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, f.cam);
      const hit = ray.intersectObjects(hitList, false)[0];
      return hit ? hit.object.userData.j : null;
    };
    let down = null, cursor = false;
    canvas.addEventListener("pointerdown", (e) => { down = on() ? [e.clientX, e.clientY] : null; });
    canvas.addEventListener("pointerup", (e) => {
      if (!down || !on() || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      const j = pick(e);
      if (j != null) goT(j);
    });
    canvas.addEventListener("pointermove", (e) => {
      const want = on() && pick(e) != null;
      if (want !== cursor) { cursor = want; canvas.style.cursor = want ? "pointer" : ""; }
    }, { passive: true });
  }

  function update(t, f) {
    const { rig, els, time } = f;
    const [pos, tg] = keys(K, t);
    pos.x += f.px * 2.4; pos.y -= f.py * 1.6;
    f.lens(44, { near: 0.5, far: 600, tall: 1.45 }); f.cam.position.copy(pos); f.cam.lookAt(tg);

    // night, and first light at the end
    const dw = seg(t, 0.9, 1);
    f.theme(1);
    f.sky(mixHex("#0C0C0D", "#24232C", dw), mixHex("#141417", "#B86A40", dw));
    rig.fog.color.set(mixHex("#0f0f11", "#5a3a2c", dw)); rig.fog.near = 60; rig.fog.far = 190;
    rig.hemi.color.set(0x8a96b8); rig.hemi.groundColor.set(0x0c0c0e); rig.hemi.intensity = 0.55 * LI;
    rig.sun.color.set(0xc0c8ff); rig.sun.intensity = 0.4 * LI; rig.sun.position.set(40, 80, -30); rig.sun.target.position.set(0, 0, 0);

    // the active project glows; its facade lights up
    const ai = t < 0.05 || t > 0.84 ? -1 : t < 0.39 ? 0 : t < 0.5 ? 1 : t < 0.61 ? 2 : t < 0.72 ? 3 : 4;
    if (ai >= 0) lastJ = ai;
    for (let j = 0; j < 5; j++) {
      const isOn = j === ai, near = cardO(t, j);
      edgeMats[j].color.copy(isOn ? ORC : GREY); edgeMats[j].opacity = isOn ? 1 : 0.8;
      screens[j].material.opacity = lerp(0.32, 1, isOn ? Math.max(0.55, near) : 0);
      glows[j].material.opacity = (isOn ? 0.55 + 0.15 * Math.sin(time * 2) : 0) * Math.max(0.4, near);
    }
    const p1 = rig.p1;
    if (ai >= 0) { const b = BLD[ai]; p1.position.copy(b.P).addScaledVector(RN, -b.side * 12).setY(5); p1.color.set(0xff6a13); p1.intensity = 1.6 * 14 * LI; p1.distance = 60; p1.decay = 1.6; }
    base.dashMat.opacity = 0.6 + 0.25 * Math.sin(time * 3);

    // labels: on the aerial, and again on the rise
    const lb = 1 - seg(t, 0.04, 0.1) + seg(t, 0.84, 0.9) * (1 - seg(t, 0.95, 1));
    for (let j = 0; j < 5; j++) f.place(els["l" + j], labelP[j], lb, "translate(-50%,-100%)");

    // project card
    let co = 0, cj = 0;
    for (let j = 0; j < 5; j++) { const o = cardO(t, j); if (o > co) { co = o; cj = j; } }
    if (cj !== shown) {
      shown = cj; const p = PROJ[cj];
      els.cNo.textContent = `[${pad(cj + 1)}/05]`; els.cYr.textContent = p[1]; els.cName.textContent = p[0]; els.cTags.textContent = p[2];
    }
    setO(els.card, co); els.card.style.pointerEvents = co > 0.5 ? "auto" : "none";
    els.card.style.transform = `translateY(${((1 - eo(co)) * 24).toFixed(1)}px)`;

    setO(els.intro, 1 - seg(t, 0.04, 0.09));
    const hp = seg(t, 0.84, 0.9); setO(els.hero, hp > 0 ? 1 - seg(t, 0.95, 1) : 0); reveal(els.hero, hp);
    setO(els.next, seg(t, 0.94, 1));
  }

  return { root, update, bind };
}

export function Overlay() {
  return (
    <>
      {PROJ.map((p, j) => (
        <div key={p[0]} className="ac-lbl ac-district-lbl" data-k={"l" + j}><span>{pad(j + 1)} {p[0]}</span><i /></div>
      ))}
      <div className="ac-district-intro" data-k="intro">
        <p className="ac-eb ac-mono">Selected work</p>
        <h1>Every project is a building.</h1>
        <p>Five live sites, one road. Scroll to travel, or click a building.</p>
      </div>
      <div className="ac-district-hero" data-k="hero">
        <p className="ac-eb ac-mono">Selected work (05)</p>
        <h2 className="ac-hl"><span className="ln"><span>View all</span></span><span className="ln"><span>projects <em>↗</em></span></span></h2>
      </div>
      <aside className="ac-district-card" data-k="card" aria-live="polite">
        <div className="ac-district-r1"><span className="ac-mono ac-district-no" data-k="cNo">[01/05]</span><span className="ac-mono" data-k="cYr">2023</span></div>
        <h2 data-k="cName">Montra</h2>
        <div className="ac-mono ac-district-tags" data-k="cTags">Web design · Branding · Marketing</div>
        <p>We specialize in crafting one-of-a-kind, unforgettable experiences that captivate and engage your customers.</p>
        <div className="ac-mono ac-district-mock">Facade shown is a mock-up</div>
        <div className="ac-district-r2">
          <span className="ac-district-go ac-mono">View project <b>↗</b></span><span className="ac-district-sp" />
          <button type="button" data-k="cPrev" aria-label="Previous project">←</button>
          <button type="button" data-k="cNext" aria-label="Next project">→</button>
        </div>
      </aside>
      <div className="ac-next ac-mono" data-k="next">[ District → Occupancy ]</div>
    </>
  );
}
