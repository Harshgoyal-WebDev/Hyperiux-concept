import * as THREE from "three";
import { createNoise4D } from "simplex-noise";

// Every surface texture of the forge is drawn here at load, on canvases:
// no image files to download. Masks are white on black and are used as
// emissive maps, so the orange lives *inside* the stone's grooves.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  return [c, ctx];
}

function toTexture(c, { srgb = false, repeat = false } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Weathered stone: seamless fbm (4D noise around two circles), with fine
// pitting. Returned twice: as colour (sRGB) and as data (rough / bump).
export function makeStone(size = 256, seed = 11) {
  const noise = createNoise4D(mulberry32(seed));
  const rand = mulberry32(seed + 1);
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    const ay = (y / size) * TAU;
    const cy = Math.cos(ay);
    const sy = Math.sin(ay);
    for (let x = 0; x < size; x++) {
      const ax = (x / size) * TAU;
      const cx = Math.cos(ax);
      const sx = Math.sin(ax);
      let v = 0;
      let amp = 0.55;
      let f = 0.7;
      for (let o = 0; o < 5; o++) {
        v += amp * noise(cx * f, sx * f, cy * f, sy * f);
        f *= 2.03;
        amp *= 0.5;
      }
      // ridged streaks, like strata
      const streak = 1 - Math.abs(noise(cx * 0.6, sx * 0.6, cy * 3.2, sy * 3.2));
      let g = 0.5 + v * 0.45 + (streak - 0.6) * 0.12 + (rand() - 0.5) * 0.07;
      if (rand() < 0.012) g -= 0.25; // pits
      g = Math.max(0, Math.min(1, g));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { color: toTexture(c, { srgb: true, repeat: true }), data: toTexture(c, { repeat: true }) };
}

// Molten cracks: branching jagged lines with a soft halo.
export function makeCracks(size = 512, seed = 3, count = 18) {
  const rand = mulberry32(seed);
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const crack = (x, y, ang, len, w, depth) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < len; s++) {
      ang += (rand() - 0.5) * 0.9;
      x += Math.cos(ang) * 7;
      y += Math.sin(ang) * 7;
      ctx.lineTo(x, y);
      if (depth < 2 && rand() < 0.08) {
        ctx.stroke();
        crack(x, y, ang + (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.6), Math.floor(len * 0.4), w * 0.6, depth + 1);
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
    ctx.lineWidth = w;
    ctx.stroke();
  };
  ctx.strokeStyle = "#fff";
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 5;
  for (let i = 0; i < count; i++) crack(rand() * size, rand() * size, rand() * Math.PI * 2, 10 + Math.floor(rand() * 30), 0.8 + rand() * 1.8, 0);
  return toTexture(c, { repeat: true });
}

// --- Engravings, one language per force -----------------------------------

function engravingCanvas() {
  const [c, ctx] = canvas(512, 1024);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 512, 1024);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "square";
  return [c, ctx];
}
const glow = (ctx, b) => {
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = b;
};

// Strategy: a precise survey grid, with a few grooves carrying the light.
export function engraveStrategy() {
  const [c, ctx] = engravingCanvas();
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1;
  for (let x = 32; x < 512; x += 48) line(ctx, x, 40, x, 984);
  for (let y = 40; y < 1024; y += 48) line(ctx, 32, y, 480, y);
  ctx.globalAlpha = 1;
  glow(ctx, 8);
  ctx.lineWidth = 4;
  line(ctx, 128, 60, 128, 960);
  line(ctx, 32, 328, 480, 328);
  line(ctx, 32, 712, 480, 712);
  ctx.lineWidth = 3;
  ctx.strokeRect(176, 376, 256, 288);
  ctx.strokeRect(224, 424, 160, 192);
  line(ctx, 304, 376, 304, 136);
  line(ctx, 304, 136, 432, 136);
  for (let y = 760; y < 960; y += 24) line(ctx, 352, y, 432, y);
  return toTexture(c);
}

// Design: flowing ribbons.
export function engraveDesign() {
  const [c, ctx] = engravingCanvas();
  glow(ctx, 10);
  for (let k = 0; k < 5; k++) {
    ctx.lineWidth = k === 2 ? 6 : 2.5;
    ctx.globalAlpha = k === 2 ? 1 : 0.7;
    ctx.beginPath();
    for (let y = 0; y <= 1024; y += 8) {
      const x = 256 + Math.sin(y / 150 + k * 0.9) * (90 + k * 22) + Math.sin(y / 61 + k) * 12;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return toTexture(c);
}

// Development: layer seams and right-angled traces with nodes.
export function engraveDevelopment() {
  const [c, ctx] = engravingCanvas();
  const rand = mulberry32(41);
  glow(ctx, 6);
  ctx.lineWidth = 2;
  for (let k = 0; k < 14; k++) {
    let x = 40 + Math.floor(rand() * 9) * 48;
    let y = 40 + Math.floor(rand() * 20) * 48;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      if (s % 2) x = Math.max(24, Math.min(488, x + (rand() < 0.5 ? -1 : 1) * 48 * (1 + Math.floor(rand() * 3))));
      else y = Math.max(24, Math.min(1000, y + (rand() < 0.5 ? -1 : 1) * 48 * (1 + Math.floor(rand() * 3))));
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillRect(x - 6, y - 6, 12, 12);
  }
  return toTexture(c);
}

// Marketing: vertical lines fanning out from a source, with chevrons.
export function engraveMarketing() {
  const [c, ctx] = engravingCanvas();
  glow(ctx, 8);
  ctx.lineWidth = 2.5;
  for (let k = -6; k <= 6; k++) {
    ctx.globalAlpha = 1 - Math.abs(k) * 0.1;
    line(ctx, 256 + k * 6, 1010, 256 + k * 38, 20);
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 4;
  for (let y = 180; y < 900; y += 110) {
    ctx.beginPath();
    ctx.moveTo(176, y + 40);
    ctx.lineTo(256, y);
    ctx.lineTo(336, y + 40);
    ctx.stroke();
  }
  return toTexture(c);
}

// Runes: rows of small ancient glyphs, for the corridor and the arch.
export function makeRunes(w = 1024, h = 256, seed = 9) {
  const rand = mulberry32(seed);
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  glow(ctx, 5);
  ctx.globalAlpha = 0.9;
  line(ctx, 0, 18, w, 18);
  line(ctx, 0, h - 18, w, h - 18);
  const cell = 40;
  for (let row = 0; row < 2; row++) {
    for (let x = 16; x < w - cell; x += cell + 14) {
      const y = 50 + row * 90;
      if (rand() < 0.15) continue;
      rune(ctx, rand, x, y, cell);
    }
  }
  return toTexture(c, { repeat: true });
}

function rune(ctx, rand, x, y, s) {
  ctx.beginPath();
  const strokes = 2 + Math.floor(rand() * 3);
  for (let k = 0; k < strokes; k++) {
    const p = () => [x + Math.round(rand() * 2) * (s / 2), y + Math.round(rand() * 2) * (s / 2)];
    const [ax, ay] = p();
    const [bx, by] = p();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.stroke();
}

// The circle of markings around the core: concentric rings, ticks and runes.
export function makeCoreRings(size = 1024) {
  const rand = mulberry32(5);
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2;
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  glow(ctx, 6);
  const R = size / 2;
  const ring = (r, w, a = 1) => {
    ctx.globalAlpha = a;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(cx, cx, r * R, 0, Math.PI * 2);
    ctx.stroke();
  };
  ring(0.98, 3);
  ring(0.93, 1.5, 0.6);
  ring(0.7, 2.5);
  ring(0.62, 1, 0.5);
  ring(0.56, 4);
  // ticks between 0.93 and 0.98
  ctx.globalAlpha = 0.9;
  for (let k = 0; k < 180; k++) {
    const a = (k / 180) * Math.PI * 2;
    const r0 = k % 5 === 0 ? 0.88 : 0.93;
    ctx.lineWidth = k % 5 === 0 ? 2.5 : 1.2;
    line(ctx, cx + Math.cos(a) * r0 * R, cx + Math.sin(a) * r0 * R, cx + Math.cos(a) * 0.98 * R, cx + Math.sin(a) * 0.98 * R);
  }
  // runes on the band 0.72–0.86
  ctx.lineWidth = 2;
  for (let k = 0; k < 36; k++) {
    if (rand() < 0.2) continue;
    const a = (k / 36) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * 0.79 * R, cx + Math.sin(a) * 0.79 * R);
    ctx.rotate(a + Math.PI / 2);
    rune(ctx, rand, -14, -14, 28);
    ctx.restore();
  }
  // four spokes, one per force
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    line(ctx, cx + Math.cos(a) * 0.56 * R, cx + Math.sin(a) * 0.56 * R, cx + Math.cos(a) * 0.7 * R, cx + Math.sin(a) * 0.7 * R);
  }
  return toTexture(c);
}

// --- Icons (the four forces, the four steps) -------------------------------

export function drawIcon(ctx, kind, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  switch (kind) {
    case "strategy": {
      // isometric cube
      ctx.moveTo(50, 8);
      ctx.lineTo(88, 29);
      ctx.lineTo(88, 71);
      ctx.lineTo(50, 92);
      ctx.lineTo(12, 71);
      ctx.lineTo(12, 29);
      ctx.closePath();
      ctx.moveTo(12, 29);
      ctx.lineTo(50, 50);
      ctx.lineTo(88, 29);
      ctx.moveTo(50, 50);
      ctx.lineTo(50, 92);
      break;
    }
    case "design": {
      for (let k = 0; k < 3; k++) {
        const ox = 22 + k * 22;
        ctx.moveTo(ox, 88);
        ctx.bezierCurveTo(ox - 18, 62, ox + 26, 40, ox + 6, 12);
      }
      break;
    }
    case "development": {
      for (let k = 0; k < 3; k++) {
        const oy = 24 + k * 22;
        ctx.moveTo(50, oy - 16);
        ctx.lineTo(90, oy);
        ctx.lineTo(50, oy + 16);
        ctx.lineTo(10, oy);
        ctx.closePath();
      }
      break;
    }
    case "marketing": {
      ctx.moveTo(58, 6);
      ctx.lineTo(20, 56);
      ctx.lineTo(48, 56);
      ctx.lineTo(40, 94);
      ctx.lineTo(80, 40);
      ctx.lineTo(52, 40);
      ctx.closePath();
      break;
    }
    case "idea": {
      ctx.arc(50, 40, 26, Math.PI * 0.8, Math.PI * 2.2);
      ctx.lineTo(62, 76);
      ctx.lineTo(38, 76);
      ctx.closePath();
      ctx.moveTo(40, 86);
      ctx.lineTo(60, 86);
      ctx.moveTo(44, 95);
      ctx.lineTo(56, 95);
      break;
    }
    case "build": {
      drawIcon(ctx, "strategy", 0, 0, 100);
      break;
    }
    case "deploy": {
      ctx.moveTo(92, 8);
      ctx.lineTo(8, 46);
      ctx.lineTo(40, 58);
      ctx.lineTo(92, 8);
      ctx.lineTo(56, 92);
      ctx.lineTo(40, 58);
      break;
    }
    case "scale": {
      for (let k = 0; k < 4; k++) {
        const h = 22 + k * 22;
        ctx.rect(10 + k * 22, 94 - h, 14, h);
      }
      break;
    }
    default:
  }
  ctx.stroke();
  ctx.restore();
}

export function makeIcon(kind, size = 256) {
  const [c, ctx] = canvas(size, size);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5.5;
  glow(ctx, 14);
  drawIcon(ctx, kind, size * 0.14, size * 0.14, size * 0.72);
  return toTexture(c);
}

// The engraved inscription on a plinth of the staircase: number, word and
// icon, white on black (used as alpha and emissive mask).
export function makeInscription({ n, name, icon }, fontFamily) {
  const [c, ctx] = canvas(1024, 512);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 64px ${fontFamily}`;
  ctx.fillText(`[${n}]`, 88, 150);
  ctx.font = `400 230px ${fontFamily}`;
  ctx.fillText(`${name}.`, 76, 400);
  ctx.lineWidth = 6;
  drawIcon(ctx, icon, 780, 92, 160);
  ctx.fillRect(88, 448, 140, 6);
  return toTexture(c);
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
