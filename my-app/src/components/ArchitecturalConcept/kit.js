import * as THREE from "three";

// Shared helpers for every chapter: the timeline curves the storyboard uses,
// colour mixing, the logo geometry, and small mesh builders.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const lerp = (a, b, t) => a + (b - a) * t;
export const io = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eo = (x) => 1 - Math.pow(1 - x, 3);
export const pad = (n) => String(n).padStart(2, "0");
export const V = (a) => new THREE.Vector3(...a);

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// hex colour mix (sRGB, like the storyboard), returns '#rrggbb'
const cA = new THREE.Color(), cB = new THREE.Color();
export const mixHex = (a, b, t) => "#" + cA.set(a).lerp(cB.set(b), clamp(t)).getHexString();

// light intensities: the prototypes used three r149's legacy lighting; the
// app runs three r186, where the same look needs every intensity × π
export const LI = Math.PI;

// palette (style rules in HANDOFF.md)
export const C = {
  paper: "#E7E6E2", sheet: "#F3F2EE", ink: "#141413", graphite: "#5D5B56", mute: "#8E8B85",
  or: "#FF6A13", orInk: "#B9440A", orD: "#B5470D", night: "#0C0C0D",
};

// the logo in its 240×240 px space
export const LA = [[15, 0], [47, 0], [47, 78], [15, 78]];
export const LB = [[15, 240], [15, 108], [192, 70], [192, 0], [225, 0], [225, 99], [47, 137], [47, 240]];
export const LC = [[192, 133], [225, 133], [225, 240], [192, 240]];
export const LOGO = [LA, LB, LC];

// the mark as SVG markup (columns + beam in orange, the cube in the joint)
export function logoSVG(cube = "#F3F2EE") {
  const P = (a) => a.map((p) => p.join(",")).join(" "), k = 0.866 * 19, c = [120, 101];
  const hx = [[120, 82], [120 + k, 91.5], [120 + k, 110.5], [120, 120], [120 - k, 110.5], [120 - k, 91.5]];
  return LOGO.map((p) => `<polygon points="${P(p)}" fill="#FF6A13"/>`).join("") +
    `<g fill="${cube}" stroke="#FF6A13" stroke-width="9" stroke-linejoin="round"><polygon points="${P(hx)}"/><polyline points="${P([hx[5], c, hx[1]])}" fill="none"/><line x1="120" y1="101" x2="120" y2="120"/></g>`;
}

// point in polygon (2D)
export function pip(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

// a thin box between two points: crisp drawn lines (WebGL lines are 1 px).
// setBar(m, k) draws it on from a to b, k in 0–1.
export const UNIT = new THREE.BoxGeometry(1, 1, 1);
const XA = new THREE.Vector3(1, 0, 0);
export function bar(a, b, w, mat, h) {
  const m = new THREE.Mesh(UNIT, mat);
  m.userData.bar = { a: a.isVector3 ? a.clone() : V(a), b: b.isVector3 ? b.clone() : V(b), w, h: h ?? w };
  setBar(m, 1);
  return m;
}
export function setBar(m, k) {
  const { a, b, w, h } = m.userData.bar, d = new THREE.Vector3().subVectors(b, a), L = d.length();
  d.normalize();
  m.quaternion.setFromUnitVectors(XA, d);
  m.scale.set(Math.max(1e-4, L * k), h, w);
  m.position.copy(a).addScaledVector(d, (L * k) / 2);
  m.visible = k > 0;
}
export const barLen = (m) => m.userData.bar.a.distanceTo(m.userData.bar.b);

// camera keyframes [[t, pos, target], …] eased between neighbours
export function keys(K, t) {
  let i = 0;
  while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], u = io(seg(t, a[0], b[0]));
  return [a[1].clone().lerp(b[1], u), a[2].clone().lerp(b[2], u)];
}

// a soft round sprite for points and glows
let dotTex = null;
export function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,1)"); g.addColorStop(0.7, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

// line-by-line headline reveal (root holds .ln > span lines)
export function reveal(root, p) {
  if (!root) return;
  root.querySelectorAll(".ln > span").forEach((l, i) => {
    const lp = eo(clamp(p * 1.7 - i * 0.28));
    l.style.transform = `translateY(${((1 - lp) * 108).toFixed(2)}%)`;
  });
}
export function setO(el, o) {
  if (!el) return;
  el.style.opacity = o.toFixed(3);
  el.style.visibility = o <= 0.001 ? "hidden" : "visible";
}
