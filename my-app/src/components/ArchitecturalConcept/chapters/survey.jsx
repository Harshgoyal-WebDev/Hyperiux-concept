import * as THREE from "three";
import { C, LI, V, bar, clamp, eo, io, lerp, mixHex, reveal, rng, seg, setO } from "../kit";

// 02 SURVEY — reading the land. Arrival dives onto the module's lid; here
// the camera pulls up and the module unfolds hinge by hinge into a flat net
// of six brand facets. Contour lines ripple out like a site survey, audience
// data lands as a field of points and clusters into the four Hyperiux lenses,
// code-style callouts pin insights to facets, then the headline and the
// bionic-reading paragraph. The camera returns overhead and the net turns to
// ink: the ghost net Blueprint opens on.
export const key = "survey";
export const name = "Survey";

const FACETS = ["Purpose", "Voice", "Audience", "Behaviour", "Visuals", "Market"];
const LENS = ["Emotion", "Design", "Technology", "Neuromarketing"];
const CL = [[-24, -6], [24, -6], [-24, 15], [24, 15]];
const CODES = [
  [2, "HX-01.1 · Audience", "Who decides, and what they feel first"],
  [3, "HX-02.4 · Behaviour", "Where attention drops, and why"],
  [5, "HX-03.2 · Market", "What competitors already own"],
];
const BIONIC = "We unravel complex design challenges through meticulous user research, expert analysis, prototyping and collaborative design.";
const NP = 260, NR = 10, RS = 72;
const UP = new THREE.Vector3(0, 0, -1), UP0 = new THREE.Vector3(0, 1, 0);

export function build() {
  const root = new THREE.Group();

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.15 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);

  // contour rings around the net, drawn on progressively
  const contours = [];
  const conMat = new THREE.LineBasicMaterial({ color: "#3B3A37", transparent: true, opacity: 0 });
  for (let i = 0; i < NR; i++) {
    const r0 = 11 + i * 3.6, pos = new Float32Array((RS + 1) * 3);
    for (let k = 0; k <= RS; k++) {
      const a = (k / RS) * Math.PI * 2;
      const r = r0 * (1 + 0.07 * Math.sin(3 * a + i * 0.7) + 0.045 * Math.sin(5 * a - i * 0.4) + 0.025 * Math.sin(8 * a + i * 1.3));
      pos.set([r * Math.cos(a), 0.012, 3 + r * Math.sin(a)], k * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const l = new THREE.Line(g, conMat); l.frustumCulled = false; root.add(l); contours.push(l);
  }

  // the module as a net: six 6 m faces on hinges (Market hangs off Behaviour)
  const net = new THREE.Group(); net.position.y = 0.06; root.add(net);
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, transparent: true });
  const edgeMat = new THREE.MeshBasicMaterial({ color: C.or, transparent: true });
  const faceGeo = new THREE.BoxGeometry(6, 0.1, 6);
  const mkFace = (parent, px, pz, cx, cz) => {
    const pivot = new THREE.Group(); pivot.position.set(px, 0, pz); parent.add(pivot);
    const m = new THREE.Mesh(faceGeo, faceMat); m.position.set(cx, 0, cz); m.castShadow = m.receiveShadow = true; pivot.add(m);
    const c = [[cx - 3.05, cz - 3], [cx + 3.05, cz - 3], [cx + 3.05, cz + 3], [cx - 3.05, cz + 3]];
    pivot.add(bar([c[0][0], 0, c[0][1]], [c[1][0], 0, c[1][1]], 0.11, edgeMat, 0.13), bar([c[3][0], 0, c[3][1]], [c[2][0], 0, c[2][1]], 0.11, edgeMat, 0.13));
    pivot.add(bar([cx - 3, 0, cz - 3.05], [cx - 3, 0, cz + 3.05], 0.11, edgeMat, 0.13), bar([cx + 3, 0, cz - 3.05], [cx + 3, 0, cz + 3.05], 0.11, edgeMat, 0.13));
    return { pivot, c: V([cx, 0, cz]) };
  };
  const F = [
    mkFace(net, 0, 0, 0, 0), // F1 Purpose (base)
    mkFace(net, 3, 0, 3, 0), // F2 Voice, hinge x = 3
    mkFace(net, -3, 0, -3, 0), // F3 Audience, hinge x = −3
    mkFace(net, 0, 3, 0, 3), // F4 Behaviour, hinge z = 3
    mkFace(net, 0, -3, 0, -3), // F5 Visuals, hinge z = −3
  ];
  F.push(mkFace(F[3].pivot, 0, 6, 0, 3)); // F6 Market, the lid, hinged on Behaviour's far edge

  // audience data: 260 points that land in a ring, then cluster into the four lenses
  const dotGeo = new THREE.CircleGeometry(0.2, 14); dotGeo.rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, NP); dots.frustumCulled = false; root.add(dots);
  const R = rng(7), D = [], col = new THREE.Color();
  for (let i = 0; i < NP; i++) {
    const a = R() * Math.PI * 2, rr = 10 + R() * 26, k = i % 4, b = R() * Math.PI * 2, br = Math.pow(R(), 0.6) * 5;
    D.push({ x0: rr * Math.cos(a), z0: 3 + rr * Math.sin(a), k, b, br, w: 0.08 + R() * 0.12, d: R(), s: i % 9 ? 1 : 1.55 });
    dots.setColorAt(i, col.set(i % 9 ? C.ink : C.or));
  }
  const m4 = new THREE.Matrix4(), tmp = new THREE.Vector3(), tg = new THREE.Vector3();

  function update(t, f) {
    const { rig, els, time } = f;
    f.sky(C.paper); f.theme(0);
    rig.hemi.intensity = 0.62 * LI; rig.amb.intensity = 0.16 * LI;
    rig.sun.intensity = 0.78 * LI; rig.sun.position.set(-16, 28, 20); rig.sun.target.position.set(0, 0, 3);
    rig.rim.color.set(0xfff1e6); rig.rim.intensity = 0.28 * LI; rig.rim.position.set(18, 10, -14);

    // camera: from just over the lid, up and back over the net, then square overhead —
    // the framing Blueprint's plan camera opens on
    const back = io(seg(t, 0.86, 1)), tl = io(seg(t, 0.24, 0.55)) * (1 - back);
    const zc = 3 * io(seg(t, 0.05, 0.3)) * (1 - back);
    const cam = f.lens(38, { x: f.narrow ? 0 : -0.15 * back, y: f.narrow ? -0.09 * back : 0, near: 0.3, far: 300 });
    const hh = f.narrow ? Math.max(19, 15.5 / (f.W / f.H)) : 20.5;
    const hEnd = hh / Math.tan((cam.fov * Math.PI) / 360);
    const hg = lerp(lerp(13.6, 50, io(seg(t, 0, 0.32))), hEnd, back);
    tg.set(0, lerp(6, 0, io(seg(t, 0, 0.3))), zc);
    cam.position.set(-12 * tl + f.px * 1.5 * tl, hg - 6 * tl, zc + 0.01 + 34 * tl - f.py * 1.5 * tl);
    cam.up.copy(UP); cam.lookAt(tg); cam.up.copy(UP0);

    // unfold, hinge by hinge: the lid opens first, Behaviour last
    const u = (a) => (Math.PI / 2) * (1 - io(seg(t, a, a + 0.09)));
    F[1].pivot.rotation.z = u(0.07); F[2].pivot.rotation.z = -u(0.09);
    F[4].pivot.rotation.x = u(0.11); F[3].pivot.rotation.x = -u(0.13); F[5].pivot.rotation.x = -u(0.04);
    root.updateMatrixWorld(true);
    const fin = seg(t, 0.9, 1);
    faceMat.color.set(mixHex("#FFFFFF", C.sheet, fin)); faceMat.opacity = 1 - seg(t, 0.93, 1); faceMat.depthWrite = fin < 0.6;
    edgeMat.color.set(mixHex(C.or, C.ink, fin));

    // contours ripple out
    const cop = 1 - seg(t, 0.88, 0.96);
    conMat.opacity = 0.42 * cop;
    contours.forEach((l, i) => {
      const pr = seg(t, 0.27 + i * 0.012, 0.4 + i * 0.012);
      l.visible = pr > 0 && cop > 0;
      l.geometry.setDrawRange(0, Math.max(2, Math.ceil(pr * RS) + 1));
    });

    // facet labels
    const lab = seg(t, 0.2, 0.27) * (1 - seg(t, 0.9, 0.97));
    F.forEach((fc, i) => { tmp.copy(fc.c); fc.pivot.localToWorld(tmp); f.place(els["f" + i], tmp, lab, "translate(-50%,-50%)"); });

    // data lands, then clusters
    const pv = seg(t, 0.36, 0.44) * (1 - seg(t, 0.86, 0.95)) * (1 - 0.6 * seg(t, 0.7, 0.76));
    const m = io(seg(t, 0.46, 0.58));
    dots.visible = pv > 0; dotMat.opacity = pv;
    if (pv > 0) {
      for (let i = 0; i < NP; i++) {
        const p = D[i], land = eo(seg(t, 0.34 + p.d * 0.08, 0.42 + p.d * 0.08)), b = p.b + time * p.w * m;
        const x = lerp(p.x0, CL[p.k][0] + p.br * Math.cos(b), m), z = lerp(p.z0, CL[p.k][1] + p.br * Math.sin(b), m), s = land > 0 ? p.s * (0.4 + 0.6 * land) : 0.0001;
        m4.makeScale(s, s, s).setPosition(x, 0.2 + 9 * (1 - land), z);
        dots.setMatrixAt(i, m4);
      }
      dots.instanceMatrix.needsUpdate = true;
    }
    CL.forEach((c, k) => f.place(els["l" + k], tmp.set(c[0], 0, c[1] - 7), m * pv, "translate(-50%,-100%)"));

    // callouts pinned to facets
    const cv = seg(t, 0.6, 0.67) * (1 - seg(t, 0.78, 0.84));
    setO(els.lead, cv);
    if (cv > 0) {
      CODES.forEach(([fi], i) => {
        tmp.copy(F[fi].c); F[fi].pivot.localToWorld(tmp);
        const [px, py] = f.project(tmp);
        let bx, by, d;
        if (f.narrow) {
          bx = 16; by = f.H - 88 - (3 - i) * 60;
          d = `M${px.toFixed(1)} ${py.toFixed(1)}L${clamp(px, bx + 14, f.W - 30).toFixed(1)} ${by}`;
        } else {
          bx = f.W - Math.max(32, f.W * 0.05) - 360; by = 136 + i * 100;
          d = `M${px.toFixed(1)} ${py.toFixed(1)}L${bx - 34} ${by + 11}L${bx} ${by + 11}`;
        }
        els["c" + i].style.transform = `translate(${bx}px,${by}px)`;
        els["p" + i].setAttribute("d", d);
        els["a" + i].setAttribute("x", (px - 5).toFixed(1)); els["a" + i].setAttribute("y", (py - 5).toFixed(1));
      });
    }
    CODES.forEach((_, i) => setO(els["c" + i], cv));

    // copy
    const hp = seg(t, 0.7, 0.77);
    setO(els.h1, hp > 0 ? 1 - seg(t, 0.82, 0.86) : 0); reveal(els.h1, hp);
    setO(els.bio, seg(t, 0.8, 0.87) * (1 - seg(t, 0.93, 0.98)));
    setO(els.next, seg(t, 0.93, 1));
  }

  return { root, update };
}

export function Overlay() {
  return (
    <>
      {FACETS.map((n, i) => (
        <div key={n} className="ac-lbl ac-survey-fl" data-k={"f" + i}><span className="ac-mono">F{i + 1}</span><b className="ac-mono">{n}</b></div>
      ))}
      {LENS.map((n, k) => (
        <div key={n} className="ac-lbl ac-survey-ll ac-mono" data-k={"l" + k}><i />{n}</div>
      ))}
      <svg className="ac-survey-lead" data-k="lead" aria-hidden="true">
        {CODES.map((c, i) => (
          <g key={c[1]}><path data-k={"p" + i} d="" /><rect data-k={"a" + i} width="10" height="10" /></g>
        ))}
      </svg>
      {CODES.map(([, code, txt], i) => (
        <div key={code} className="ac-survey-card" data-k={"c" + i}>
          <div className="ac-mono">{code}</div>
          <p>{txt}</p>
        </div>
      ))}
      <div className="ac-survey-copy">
        <div className="ac-survey-hd" data-k="h1">
          <h2 className="ac-hl"><span className="ln"><span>Before we draw a line,</span></span><span className="ln"><span>we <em>read the land.</em></span></span></h2>
        </div>
        <div className="ac-survey-bio" data-k="bio">
          <p>{BIONIC.split(" ").map((w, i) => { const k = Math.ceil(w.length / 2); return <span key={i}><b>{w.slice(0, k)}</b>{w.slice(k)} </span>; })}</p>
          <div className="ac-mono ac-hi">What you just read is called bionic reading.</div>
        </div>
      </div>
      <div className="ac-next ac-mono" data-k="next">[ Research → Strategy ]</div>
    </>
  );
}
