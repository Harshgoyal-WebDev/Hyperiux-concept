import * as THREE from "three";
import { C } from "../kit";

// What the six faces show, chapter by chapter, drawn once into canvases:
// the brand's facets, the strategy services, the design system's layers and
// responsive pages, the code under them, and the project sites. Cached by key;
// redrawn once the web fonts have loaded.

export const FACETS = [
  ["Purpose", "Why the brand exists"], ["Voice", "How it sounds"], ["Audience", "Who decides, and what they feel first"],
  ["Behaviour", "Where attention drops, and why"], ["Visuals", "What people recognise"], ["Market", "What competitors already own"],
];
export const SERVICES = [
  ["UI Design Strategy", "Strategic planning based on insight is the starting point of everything we do.", ["Insight workshops", "Experience roadmap", "KPI framework"]],
  ["Branding", "An identity system that holds up on every screen, from logo to motion language.", ["Brand platform", "Visual identity", "Motion and sonic cues"]],
  ["UX Development", "Journeys, flows and prototypes tested with real users before a pixel is final.", ["Journey maps", "Wireframes and prototypes", "Usability testing"]],
  ["Integrated Digital Marketing Plan", "Channels, content and campaigns planned around the same experience the site delivers.", ["Channel strategy", "Content calendar", "Performance tracking"]],
  ["Customer Experience Strategy", "Every touchpoint mapped, so the brand feels the same before, during and after the sale.", ["Service blueprint", "Touchpoint audit", "CX metrics"]],
  ["Consumer Research", "Behaviour, emotion and neuromarketing signals that show what people actually do.", ["Interviews and surveys", "Behavioural analytics", "Neuromarketing tests"]],
];
export const PROJECTS = [
  ["Montra", "2023", "Web design · Branding · Marketing", ["#1E3DFF", "#62D5FF"], "Electronics"],
  ["Yellow", "2024", "Web design · Branding · Marketing", ["#F5C518", "#1A1A1A"], "Fintech"],
  ["Patronum", "2023", "Web design · Marketing · Branding", ["#3A2A6E", "#C9A6FF"], "Education"],
  ["Montra App", "2025", "Web design · Branding · Marketing", ["#0E9F6E", "#C6F25A"], "Technology"],
  ["Monielink", "2025", "Web design · Marketing · Branding", ["#D7263D", "#FF9DB0"], "Banking"],
];
export const LAYERS = ["Tokens", "Components", "Patterns", "Pages"];
const CODE = [
  ["motion.glsl", ["uniform float uScroll;", "varying vec2 vUv;", "", "void main() {", "  vec3 p = position;", "  p.z += sin(uScroll * 6.28) * 0.2;", "  vUv = uv;", "  gl_Position = mvp(p);", "}"]],
  ["budget.json", ["{", '  "lcp": "< 2.0 s",', '  "inp": "< 200 ms",', '  "cls": "< 0.05",', '  "lighthouse": ">= 95",', '  "js": "< 120 kB"', "}"]],
  ["schema.ts", ["export default defineType({", "  name: 'project',", "  fields: [", "    { name: 'title' },", "    { name: 'hero', type: 'image' },", "    { name: 'body', type: 'blocks' },", "  ],", "})"]],
  ["seo.ts", ["export const metadata = {", "  title: page.title,", "  description: page.summary,", "  alternates: { canonical },", "};", "", "// schema.org Organization", "jsonLd(org, breadcrumbs)"]],
  ["route.ts", ["export async function GET() {", "  const work = await cms.fetch(", "    '*[_type == \"project\"]'", "  );", "  return Response.json(work, {", "    headers: cache('1h'),", "  });", "}"]],
  ["build.log", ["▲ next build", "✓ Compiled in 8.2 s", "✓ 24 routes, all static", "  First Load JS   92 kB", "  LCP (lab)       1.4 s", "  CLS             0.01", "✓ Lighthouse     98 / 100", "✓ Deployed"]],
];

const SIZE = { sq: [512, 512], wide: [800, 500], tablet: [480, 640], mobile: [320, 680] };
let fonts = null;
function fam() {
  if (fonts) return fonts;
  const st = getComputedStyle(document.querySelector(".ac-root") || document.body);
  const v = (n, fb) => (st.getPropertyValue(n).trim() || "") + (st.getPropertyValue(n).trim() ? ", " : "") + fb;
  fonts = { d: v("--font-archivo", "Arial, sans-serif"), b: v("--font-instrument", "Arial, sans-serif"), m: v("--font-plex-mono", "Menlo, monospace") };
  return fonts;
}
function canvas([w, h]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d"), w, h];
}
const rect = (x, c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
function text(x, s, a, b, size, { w = 400, f = "b", c = C.ink, al = "left", ls = 0 } = {}) {
  x.font = `${w} ${size}px ${fam()[f]}`; x.fillStyle = c; x.textAlign = al; x.textBaseline = "alphabetic";
  if ("letterSpacing" in x) x.letterSpacing = `${ls}px`;
  x.fillText(s, a, b);
  if ("letterSpacing" in x) x.letterSpacing = "0px";
}
function wrap(x, s, a, b, size, maxW, lh, o) {
  x.font = `${o?.w || 400} ${size}px ${fam()[o?.f || "b"]}`;
  const words = s.split(" "); let line = "", y = b;
  for (const wd of words) { const t = line ? line + " " + wd : wd; if (x.measureText(t).width > maxW && line) { text(x, line, a, y, size, o); line = wd; y += lh; } else line = t; }
  if (line) text(x, line, a, y, size, o);
  return y;
}
const frame = (x, w, h, c = C.ink, lw = 3) => { x.strokeStyle = c; x.lineWidth = lw; x.strokeRect(lw / 2, lw / 2, w - lw, h - lw); };

// a small page layout, reused by the design pages and the project sites
function page(x, w, h, { name = "Hyperiux", line1 = "Your brand,", line2 = "built to be", line3 = "experienced.", col = [C.or, "#FFB48A"], tag = null, cols = 2 } = {}) {
  const u = w / 100;
  rect(x, C.sheet, 0, 0, w, h);
  text(x, name.toUpperCase(), 5 * u, 7 * u, 2.6 * u, { w: 600, f: "m", ls: 1 });
  [0, 1, 2].forEach((i) => rect(x, C.mute, w - 30 * u + i * 7 * u, 4.8 * u, 5 * u, 1.2 * u));
  rect(x, C.or, w - 8 * u, 4 * u, 4 * u, 3 * u);
  const tall = h > w * 1.2, hs = tall ? 9.5 * u : 7.2 * u, hy = tall ? 24 * u : 21 * u;
  [line1, line2, line3].forEach((l, i) => text(x, l, 5 * u, hy + i * hs, hs * 0.95, { w: 700, f: "d", c: i === 2 ? C.or : C.ink }));
  const by = hy + 2 * hs + 6 * u;
  rect(x, C.or, 5 * u, by, (tall ? 34 : 17) * u, (tall ? 7 : 4.6) * u);
  text(x, "EXPLORE →", 7.5 * u, by + (tall ? 4.6 : 3) * u, (tall ? 3.4 : 2) * u, { w: 600, f: "m", c: "#fff", ls: 1 });
  const ix = tall ? 5 * u : 52 * u, iy = tall ? by + 12 * u : 15 * u, iw = tall ? w - 10 * u : 43 * u, ih = tall ? h * 0.24 : by - 15 * u + 4.6 * u;
  const g = x.createLinearGradient(ix, iy, ix + iw, iy + ih); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
  x.fillStyle = g; x.fillRect(ix, iy, iw, ih);
  x.fillStyle = "rgba(255,255,255,.85)"; x.beginPath(); x.arc(ix + iw * 0.64, iy + ih * 0.48, Math.min(iw, ih) * 0.2, 0, Math.PI * 2); x.fill();
  const cy = tall ? iy + ih + 5 * u : Math.max(by + 9 * u, iy + ih + 5 * u), cw = (w - 10 * u - (cols - 1) * 3 * u) / cols;
  for (let i = 0; i < cols * (tall ? 1 : 1); i++) {
    const cx = 5 * u + i * (cw + 3 * u);
    if (cy + 6 * u > h) break;
    x.strokeStyle = "rgba(20,20,19,.25)"; x.lineWidth = 1.5; x.strokeRect(cx, cy, cw, h - cy - 4 * u);
    rect(x, "rgba(20,20,19,.12)", cx + 2 * u, cy + 2.5 * u, cw * 0.5, 1.6 * u);
    rect(x, "rgba(20,20,19,.08)", cx + 2 * u, cy + 6 * u, cw * 0.7, 1.2 * u);
  }
  if (tag) { x.font = `500 ${2.2 * u}px ${fam().m}`; const tw = x.measureText(tag).width + 3 * u; rect(x, C.ink, w - tw - 4 * u, h - 7 * u, tw, 4 * u); text(x, tag, w - tw - 2.5 * u, h - 4.2 * u, 2.2 * u, { f: "m", c: C.sheet, w: 500, ls: 1 }); }
}

const DRAW = {
  face([x, w, h]) { rect(x, C.sheet, 0, 0, w, h); },
  facet([x, w, h], i) {
    rect(x, C.sheet, 0, 0, w, h); frame(x, w, h, C.or, 10);
    text(x, `F${i + 1}`, 40, 70, 30, { w: 600, f: "m", c: C.or, ls: 2 });
    text(x, FACETS[i][0].toUpperCase(), 40, 300, 62, { w: 700, f: "d" });
    wrap(x, FACETS[i][1], 40, 360, 28, w - 80, 36, { c: C.graphite });
  },
  node([x, w, h], i) {
    rect(x, C.sheet, 0, 0, w, h); frame(x, w, h, C.ink, 4);
    rect(x, C.ink, 0, 0, w, 64);
    text(x, `${String(i + 1).padStart(2, "0")} / 06`, 30, 42, 24, { w: 500, f: "m", c: C.sheet, ls: 2 });
    rect(x, C.or, w - 70, 18, 40, 28);
    const y = wrap(x, SERVICES[i][0], 30, 150, 54, w - 60, 58, { w: 700, f: "d" });
    SERVICES[i][2].forEach((s, k) => text(x, "→ " + s.toUpperCase(), 30, y + 70 + k * 40, 22, { w: 500, f: "m", c: C.graphite, ls: 1 }));
  },
  layer([x, w, h], k) {
    x.fillStyle = k < 3 ? "rgba(243,242,238,.8)" : C.sheet; x.fillRect(0, 0, w, h);
    frame(x, w, h, k < 3 ? "rgba(20,20,19,.35)" : C.ink, 3);
    if (k === 0) { // tokens: colour, type and space
      [C.or, C.ink, C.graphite, C.paper, "#FFB48A"].forEach((c, i) => { rect(x, c, 40 + i * 120, 60, 96, 96); x.strokeStyle = "rgba(20,20,19,.3)"; x.strokeRect(40 + i * 120, 60, 96, 96); text(x, ["#FF5F00", "#141413", "#5D5B56", "#E7E6E2", "#FFB48A"][i], 40 + i * 120, 186, 16, { f: "m", c: C.graphite }); });
      [96, 64, 40, 24].forEach((s, i) => text(x, "Aa", 40 + i * 150, 330, s, { w: 700, f: "d" }));
      [8, 16, 24, 32, 48, 64].forEach((s, i) => rect(x, C.or, 40 + i * 110, 400, s * 1.4, 14));
      text(x, "COLOUR · TYPE · SPACE", 40, 460, 20, { f: "m", c: C.graphite, w: 500, ls: 2 });
    } else if (k === 1) { // components
      const pill = (a, b, ww, fill, label, tc) => { x.fillStyle = fill; x.beginPath(); x.roundRect(a, b, ww, 56, 28); x.fill(); if (fill === "transparent") { x.strokeStyle = C.ink; x.lineWidth = 2; x.stroke(); } text(x, label, a + 26, b + 36, 20, { f: "m", w: 600, c: tc, ls: 1 }); };
      pill(40, 50, 220, C.or, "START A PROJECT", "#fff"); pill(290, 50, 160, "transparent", "SAY HI ↗", C.ink);
      x.strokeStyle = C.ink; x.lineWidth = 2; x.strokeRect(40, 140, 410, 60); text(x, "you@company.com", 60, 178, 22, { c: C.mute });
      x.strokeRect(500, 50, 260, 300); rect(x, "#FFD3B5", 516, 66, 228, 130); text(x, "Card title", 516, 240, 30, { w: 700, f: "d" }); rect(x, "rgba(20,20,19,.12)", 516, 262, 200, 12); rect(x, "rgba(20,20,19,.12)", 516, 284, 160, 12);
      x.fillStyle = C.or; x.beginPath(); x.roundRect(40, 240, 92, 48, 24); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(108, 264, 18, 0, 7); x.fill();
      ["Branding", "UX", "WebGL"].forEach((s, i) => { x.strokeStyle = C.ink; x.strokeRect(160 + i * 110, 244, 100, 40); text(x, s.toUpperCase(), 172 + i * 110, 270, 16, { f: "m", w: 500 }); });
      text(x, "BUTTON · INPUT · CARD · TOGGLE · CHIP", 40, 460, 20, { f: "m", c: C.graphite, w: 500, ls: 2 });
    } else if (k === 2) { // patterns: the page's sections as wireframe
      x.strokeStyle = "rgba(20,20,19,.55)"; x.lineWidth = 2; x.setLineDash([10, 8]);
      x.strokeRect(30, 26, w - 60, 44); x.strokeRect(30, 90, w * 0.44, 200); x.strokeRect(w * 0.52, 90, w * 0.44, 200);
      [0, 1, 2].forEach((i) => x.strokeRect(30 + i * ((w - 60) / 3 + 0), 310, (w - 60) / 3 - 16, 130));
      x.setLineDash([]);
      text(x, "NAV", 44, 56, 18, { f: "m", w: 600, c: C.graphite }); text(x, "HERO", 44, 120, 18, { f: "m", w: 600, c: C.graphite }); text(x, "MEDIA", w * 0.52 + 14, 120, 18, { f: "m", w: 600, c: C.graphite }); text(x, "CARD GRID", 44, 340, 18, { f: "m", w: 600, c: C.graphite });
      text(x, "12 COLUMNS · 8 PT GRID", 30, 478, 20, { f: "m", c: C.graphite, w: 500, ls: 2 });
      x.fillStyle = "rgba(255,95,0,.07)"; for (let i = 0; i < 12; i++) x.fillRect(30 + i * ((w - 60) / 12) + 4, 0, (w - 60) / 12 - 8, h);
    } else page(x, w, h, { cols: 3 });
  },
  tablet([x, w, h]) { page(x, w, h, { cols: 2 }); frame(x, w, h, C.ink, 6); },
  mobile([x, w, h]) { page(x, w, h, { cols: 1 }); frame(x, w, h, C.ink, 6); },
  code([x, w, h], i) {
    rect(x, "#121214", 0, 0, w, h); rect(x, "#1C1C20", 0, 0, w, 60);
    [0, 1, 2].forEach((k) => { x.fillStyle = ["#3A3A40", "#3A3A40", C.or][k]; x.beginPath(); x.arc(30 + k * 26, 30, 8, 0, 7); x.fill(); });
    text(x, CODE[i][0], 120, 39, 22, { f: "m", c: "#A8A6A1", w: 500 });
    CODE[i][1].forEach((l, k) => {
      text(x, String(k + 1).padStart(2, " "), 30, 120 + k * 42, 22, { f: "m", c: "#55555B" });
      const kw = /^(\s*)(export|const|uniform|varying|void|return|async|function|await)\b/.exec(l);
      if (kw) { text(x, kw[1] + kw[2], 90, 120 + k * 42, 22, { f: "m", c: C.or }); x.font = `400 22px ${fam().m}`; const off = x.measureText(kw[1] + kw[2]).width; text(x, l.slice(kw[0].length), 90 + off, 120 + k * 42, 22, { f: "m", c: "#EDEBE6" }); }
      else text(x, l, 90, 120 + k * 42, 22, { f: "m", c: l.startsWith("✓") || l.startsWith("▲") ? "#C6F25A" : "#EDEBE6" });
    });
    frame(x, w, h, "#3A3A40", 3);
  },
  site([x, w, h], j) {
    if (j < 5) { const p = PROJECTS[j]; page(x, w, h, { name: p[0], line1: p[0], line2: "Designed and", line3: "built by Hyperiux", col: p[3], tag: "MOCK-UP", cols: 3 }); frame(x, w, h, C.ink, 4); return; }
    rect(x, C.sheet, 0, 0, w, h);
    x.strokeStyle = C.or; x.lineWidth = 6; x.setLineDash([24, 16]); x.strokeRect(10, 10, w - 20, h - 20); x.setLineDash([]);
    text(x, "06 / NEXT", 50, 80, 24, { f: "m", w: 600, c: C.or, ls: 2 });
    text(x, "Your brand", 50, 300, 92, { w: 700, f: "d" }); text(x, "goes here.", 50, 400, 92, { w: 700, f: "d", c: C.or });
  },
};

const cache = new Map();
export function look(key) {
  let t = cache.get(key);
  if (t) return t;
  const [kind, n] = key.split(":"), i = n == null ? 0 : +n;
  const size = kind === "face" || kind === "facet" ? SIZE.sq : kind === "tablet" ? SIZE.tablet : kind === "mobile" ? SIZE.mobile : SIZE.wide;
  const [c, x, w, h] = canvas(size);
  DRAW[kind]([x, w, h], i);
  t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}
// once the fonts are in, redraw every texture already made
export function redrawLooks() {
  fonts = null;
  cache.forEach((t, key) => {
    const [kind, n] = key.split(":");
    const c = t.image, x = c.getContext("2d");
    x.clearRect(0, 0, c.width, c.height);
    DRAW[kind]([x, c.width, c.height], n == null ? 0 : +n);
    t.needsUpdate = true;
  });
}
