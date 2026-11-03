import * as THREE from "three";
import { C, LI, V, clamp, eo, keys, lerp, mixHex, reveal, seg, setO } from "../kit";

// 05 MATERIAL — the client's identity becomes the facade. Dusk into night:
// 44 fins rise in a wave around the module (the cube) with long warm
// shadows, spec chips name the materials, then fins and module take each
// brand's palette in turn (the panel's chips let a visitor pick one).
// Night turns the fins into glossy dark composite ribs under a moving
// highlight, the statement lands, and surfaces dissolve to wireframe.
export const key = "material";
export const name = "Material";

const PAL = [["#1E3DFF", "#62D5FF"], ["#0E9F6E", "#C6F25A"], ["#D7263D", "#FF9DB0"]];
const BRANDS = ["Brand A — Fintech", "Brand B — Climate", "Brand C — Lifestyle"];

// storyboard geometry: 44 radial fins on an 18 m arc around the module
const N = 44, FW = 0.42, FD = 2.8;
const FINS = Array.from({ length: N }, (_, i) => {
  const a = -1.25 + (2.5 * i) / (N - 1);
  return { x: 18 * Math.sin(a), z: 6 - 18 * Math.cos(a), rot: Math.PI - a, h: 7 + 13 * Math.pow(Math.sin((Math.PI * (i + 0.5)) / N), 1.4) + 2.2 * Math.sin(i * 0.62) };
});
const EI = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
function finCorners(f, h) {
  const c = Math.cos(f.rot), s = Math.sin(f.rot), out = [];
  for (const y of [0, h]) for (const [lx, lz] of [[-FW / 2, -FD / 2], [FW / 2, -FD / 2], [FW / 2, FD / 2], [-FW / 2, FD / 2]]) out.push([f.x + lx * c + lz * s, y, f.z - lx * s + lz * c]);
  return out;
}
const K = [[0, V([0, 4, 34]), V([0, 7, -2])], [0.3, V([6, 5, 30]), V([0, 8, -4])], [0.67, V([-4, 6, 28]), V([0, 9, -4])], [0.78, V([2, 27, 19]), V([0, 5, -5])], [0.9, V([-5, 28, 24]), V([-9, 5, -4])], [1, V([0, 34, 40]), V([0, 4, -4])]];

export function build() {
  const root = new THREE.Group();

  // ground + grid
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xe7e6e2, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const gp = [];
  for (let v = -40; v <= 40; v += 2) gp.push(v, 0.01, -40, v, 0.01, 40, -40, 0.01, v, 40, 0.01, v);
  const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
  const gridMat = new THREE.LineBasicMaterial({ color: 0x141413, transparent: true, opacity: 0.12 });
  root.add(new THREE.LineSegments(gg, gridMat));

  // fins: one instanced mesh, edges as one line set, footprints traced on the ground
  const finMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.2, transparent: true });
  const finMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), finMat, N);
  finMesh.castShadow = finMesh.receiveShadow = true; root.add(finMesh);
  const col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3();
  for (let i = 0; i < N; i++) finMesh.setColorAt(i, col.set("#E2DFD8"));
  const finEdgeGeo = new THREE.BufferGeometry(), finEdgePos = new Float32Array(N * 24 * 3);
  finEdgeGeo.setAttribute("position", new THREE.BufferAttribute(finEdgePos, 3));
  const finEdgeMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: true });
  const finEdges = new THREE.LineSegments(finEdgeGeo, finEdgeMat); finEdges.frustumCulled = false; root.add(finEdges);
  const fpPos = [];
  FINS.forEach((f) => { const c = finCorners(f, 0); for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; fpPos.push(a[0], 0.02, a[2], b[0], 0.02, b[2]); } });
  const fpGeo = new THREE.BufferGeometry(); fpGeo.setAttribute("position", new THREE.Float32BufferAttribute(fpPos, 3));
  const fpMat = new THREE.LineBasicMaterial({ color: 0x141413, transparent: true });
  root.add(new THREE.LineSegments(fpGeo, fpMat));

  // plinth + module
  const plMat = new THREE.MeshStandardMaterial({ color: 0xe2dfd8, roughness: 0.9, transparent: true });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 7), plMat);
  plinth.position.y = 0.6; plinth.castShadow = plinth.receiveShadow = true; root.add(plinth);
  const plEdge = new THREE.LineSegments(new THREE.EdgesGeometry(plinth.geometry), new THREE.LineBasicMaterial({ color: 0x141413, transparent: true }));
  plinth.add(plEdge);
  const cube = new THREE.Group(); cube.position.set(0, 2.8, 0); cube.rotation.y = Math.PI / 4; root.add(cube);
  const cubeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, clearcoat: 0.4, emissive: 0x000000, transparent: true });
  const cubeM = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 3.2), cubeMat); cubeM.castShadow = true; cube.add(cubeM);
  const unit = new THREE.BoxGeometry(1, 1, 1), XA = new THREE.Vector3(1, 0, 0);
  const orMat = new THREE.MeshStandardMaterial({ color: 0xff6a13, emissive: 0xff6a13, emissiveIntensity: 0.4, roughness: 0.5 });
  const edge = (a, b, w) => {
    const m = new THREE.Mesh(unit, orMat), A = V(a), B = V(b), d = B.clone().sub(A), L = d.length();
    d.normalize(); m.quaternion.setFromUnitVectors(XA, d); m.scale.set(L, w, w); m.position.copy(A).add(B).multiplyScalar(0.5); return m;
  };
  const e = 1.62;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    cube.add(edge([-e, a * e, b * e], [e, a * e, b * e], 0.08)); cube.add(edge([a * e, -e, b * e], [a * e, e, b * e], 0.08)); cube.add(edge([a * e, b * e, -e], [a * e, b * e, e], 0.08));
  }

  let userBrand = null, chipBtns = [];

  function bind(els) {
    els.chips.innerHTML = BRANDS.map((b, i) => `<button type="button" data-b="${i}" aria-pressed="false"><i style="background:linear-gradient(90deg,${PAL[i][0]},${PAL[i][1]})"></i>${b.split(" — ")[0]}</button>`).join("");
    chipBtns = [...els.chips.querySelectorAll("button")];
    els.chips.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (b) userBrand = +b.dataset.b; });
  }

  function update(t, f) {
    const { rig, els, time } = f;
    const [pos, tg] = keys(K, t);
    pos.x += f.px * 2; pos.y -= f.py * 1.2;
    f.lens(42); f.cam.position.copy(pos); f.cam.lookAt(tg);

    const nt = seg(t, 0.25, 0.3), night = seg(t, 0.55, 0.75), dusk = seg(t, 0.04, 0.42), wire = seg(t, 0.9, 1);
    // sky: paper warms while the fins rise, then darkens to dusk just before the spec chips (text flips with it)
    const warm = seg(t, 0.04, 0.24), dark = seg(t, 0.24, 0.31), nf = seg(t, 0.58, 0.75);
    const skyT = mixHex(mixHex(mixHex("#E7E6E2", "#E2D4C8", warm), "#2B2529", dark), "#0C0C0D", nf);
    const skyB = mixHex(mixHex(mixHex("#E7E6E2", "#E8CDB6", warm), "#9A7462", dark), "#151516", nf);
    f.sky(skyT, skyB); f.theme(nt);
    rig.fog.color.set(skyB); rig.fog.near = 50; rig.fog.far = 120;
    groundMat.color.set(mixHex(mixHex(mixHex("#E7E6E2", "#DDCDBF", warm), "#4A403B", dark), "#111113", night));
    groundMat.roughness = lerp(1, 0.62, night); groundMat.metalness = lerp(0, 0.12, night);
    gridMat.color.set(mixHex("#141413", "#ffffff", nt)); gridMat.opacity = lerp(0.12, 0.07, nt);

    // light: low warm sun at dusk, then a night rim and a highlight sweeping over the ribs
    rig.sun.color.set(mixHex("#ffffff", "#ffb27a", dusk)); rig.sun.intensity = lerp(lerp(0.8, 0.95, dusk), 0.06, night) * LI;
    const sa = lerp(-0.6, -1.25, dusk);
    rig.sun.position.set(Math.sin(sa) * 40, lerp(30, 9, dusk), Math.cos(sa) * 28); rig.sun.target.position.set(0, 0, -4);
    rig.hemi.intensity = lerp(0.6, 0.1, night) * LI; rig.hemi.color.set(mixHex("#ffffff", "#7b88b0", night));
    rig.rim.color.set(0x9fb4ff); rig.rim.intensity = 0.9 * night * LI;
    rig.p1.intensity = 2.4 * night * (1 - wire) * LI; rig.p1.distance = 70; rig.p1.decay = 1.4;
    rig.p1.position.set(Math.sin(time * 0.35) * 20, 12 + Math.sin(time * 0.5) * 4, -2 + Math.cos(time * 0.35) * 8);

    // fins: brand phases, each complete before its frame
    const ph = [seg(t, 0.37, 0.42), seg(t, 0.49, 0.54), seg(t, 0.6, 0.65), seg(t, 0.7, 0.76)];
    if (!(t > 0.38 && t < 0.7)) userBrand = null;
    const finCol = (k) => {
      if (userBrand != null) return mixHex(PAL[userBrand][0], PAL[userBrand][1], k);
      let c = "#E2DFD8";
      ph.slice(0, 3).forEach((w, i) => { c = mixHex(c, mixHex(PAL[i][0], PAL[i][1], k), w); });
      return mixHex(c, mixHex("#18181A", "#3A3A3F", k), ph[3]);
    };
    const brandW = userBrand != null ? 1 : Math.max(ph[0], ph[1], ph[2]) * (1 - ph[3]);
    finMat.roughness = lerp(lerp(0.9, 0.42, brandW), 0.18, ph[3]); finMat.clearcoat = lerp(lerp(0, 0.35, brandW), 1, ph[3]); finMat.metalness = lerp(0, 0.25, ph[3]);
    finMat.opacity = 1 - wire; finMat.depthWrite = wire < 0.5;
    let ei = 0;
    FINS.forEach((fin, i) => {
      const g = eo(seg(t, 0.03 + i * 0.0035, 0.17 + i * 0.0035)), h = Math.max(0.001, fin.h * g);
      q.setFromAxisAngle(Y, fin.rot); m4.compose(P.set(fin.x, h / 2, fin.z), q, S.set(FW, h, FD)); finMesh.setMatrixAt(i, m4);
      finMesh.setColorAt(i, col.set(finCol(i / N)));
      const c = finCorners(fin, h);
      for (const [a, b] of EI) { finEdgePos.set(c[a], ei); finEdgePos.set(c[b], ei + 3); ei += 6; }
    });
    finMesh.instanceMatrix.needsUpdate = true; finMesh.instanceColor.needsUpdate = true; finEdgeGeo.attributes.position.needsUpdate = true;
    finEdgeMat.color.set(wire > 0 ? mixHex("#8a8a90", "#D2D2D8", wire) : mixHex(mixHex("#1a1a1a", "#000000", brandW), "#A4A4AA", ph[3]));
    finEdgeMat.opacity = wire > 0 ? lerp(0.55, 0.95, wire) : lerp(lerp(0.85, 0.3, brandW), 0.5, ph[3]);
    fpMat.opacity = 0.55 * (1 - seg(t, 0.1, 0.2));

    // plinth + module
    plMat.color.set(mixHex("#E2DFD8", "#2A2A2D", night)); plMat.opacity = 1 - wire * 0.9; plEdge.material.color.set(mixHex("#141413", "#6a6a70", night));
    let brandCube = "#FFFFFF";
    if (userBrand != null) brandCube = PAL[userBrand][0]; else ph.slice(0, 3).forEach((w, i) => { brandCube = mixHex(brandCube, PAL[i][0], w); });
    cubeMat.color.set(mixHex(brandCube, "#F3F2EE", ph[3])); cubeMat.emissive.set(mixHex("#000000", "#FFE9D8", ph[3] * 0.5)); cubeMat.opacity = 1 - wire * 0.85;
    rig.p3.position.set(0, 6, 4); rig.p3.intensity = 1.6 * ph[3] * (1 - wire) * LI; rig.p3.distance = 26; rig.p3.decay = 1.6;
    cube.rotation.y = Math.PI / 4 + (t > 0.7 ? time * 0.2 : 0);

    // copy
    const hp1 = seg(t, 0.15, 0.21); setO(els.h1, hp1 > 0 ? 1 - seg(t, 0.25, 0.28) : 0); reveal(els.h1, hp1);
    setO(els.sw, seg(t, 0.27, 0.31) * (1 - seg(t, 0.34, 0.37)));
    const pp = seg(t, 0.37, 0.42) * (1 - seg(t, 0.69, 0.73));
    setO(els.panel, pp); els.panel.style.pointerEvents = pp > 0.5 ? "auto" : "none";
    const bi = userBrand ?? (t < 0.49 ? 0 : t < 0.6 ? 1 : 2);
    if (els.pName.textContent !== BRANDS[bi]) els.pName.textContent = BRANDS[bi];
    chipBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(i === bi)));
    const hp2 = seg(t, 0.82, 0.88); setO(els.h2, hp2 > 0 ? 1 - seg(t, 0.94, 1) : 0); reveal(els.h2, hp2);
    setO(els.next, seg(t, 0.93, 1));
    setO(els.hint, 1 - clamp(t / 0.04));
  }

  return { root, update, bind };
}

export function Overlay() {
  return (
    <>
      <div className="ac-material-hd" data-k="h1">
        <h2 className="ac-hl"><span className="ln"><span>Your identity</span></span><span className="ln"><span>becomes the <em>facade.</em></span></span></h2>
      </div>
      <div className="ac-material-sw" data-k="sw">
        <div><i style={{ background: "#CFCBC3" }} /><span className="ac-mono ac-material-c">M-01</span><b>Concrete</b><span>Strategy</span></div>
        <div><i style={{ background: "#A9C4C9" }} /><span className="ac-mono ac-material-c">M-02</span><b>Glass</b><span>Experience</span></div>
        <div><i style={{ background: "#FF6A13" }} /><span className="ac-mono ac-material-c">M-03</span><b>Composite</b><span>Hyperiux #FF6A13</span></div>
      </div>
      <aside className="ac-material-panel ac-panel" data-k="panel" aria-live="polite">
        <span className="ac-mono ac-or">Applying identity</span>
        <h3 data-k="pName">Brand A — Fintech</h3>
        <p>Same structure. Its own skin. Try another brand:</p>
        <div className="ac-material-chips" data-k="chips" />
        <div className="ac-mono ac-material-note">Placeholder palettes</div>
      </aside>
      <div className="ac-material-hd" data-k="h2">
        <h2 className="ac-hl"><span className="ln"><span><em>Emotion</em>, <em>design</em>, <em>technology</em></span></span><span className="ln"><span>&amp; <em>neuromarketing</em>,</span></span><span className="ln"><span>cast in one material.</span></span></h2>
      </div>
      <div className="ac-next ac-mono" data-k="next">[ Material → Systems ]</div>
      <div className="ac-material-hint ac-mono" data-k="hint">Scroll to clad ↓</div>
    </>
  );
}
