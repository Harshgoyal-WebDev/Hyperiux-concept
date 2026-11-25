import * as THREE from "three";
import { loadPoints } from "./PortraitPoints";

// The light-strand portraits' source pipeline: a team member's photo → a
// small "light map" the strand shader reads. The photo itself is never
// drawn; only what it says about the face survives:
//   R  luminance, contrast-stretched over the subject (strand brightness)
//   G  edges (Sobel), for the champagne highlights along the contours
//   B  depth, a soft bulge from the subject's mask (relief)
//   A  the subject mask (where strands exist at all)
// The subject is separated from its background by colour distance from the
// photo's border (works best on a plain, darker background), and faded out
// at the edges of the frame — or, where the member has one, by their mask
// image (member.mask: their outline, white on black, the photo's size). Rows are stored bottom-up (v = 0 at the foot).
export const MAP_W = 360;
export const MAP_H = 450;

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export function emptyPortraitTexture() {
  return toTexture(new Uint8Array(4 * 4), 2, 2);
}

// (no mask: the whole image)
export function fullMaskTexture() {
  return toTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
}

// Loads a member's photo and builds their map. Never rejects: a missing or
// broken photo gives an anonymous silhouette and { missing: true }.
const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

export async function loadPortrait(member) {
  const [img, mask, depth, points] = await Promise.all([loadImage(member.source), loadImage(member.mask), loadImage(member.depth), loadPoints(member.points)]);
  if (!img) {
    console.warn(`[about] portrait source for ${member.name} not found: public${member.source}. Showing an anonymous silhouette.`);
    return { texture: buildFromSource(silhouetteCanvas(), { x: 0.5, y: 0.5, zoom: 1 }), image: null, points: null, missing: true };
  }
  if (member.mask && !mask) console.warn(`[about] portrait mask for ${member.name} not found: public${member.mask}. Separating automatically.`);
  // (the image itself too: the portrait shows it as it is, the strands
  // over it — sampled as stored, sRGB, and converted in the shader)
  const image = new THREE.Texture(img);
  image.colorSpace = THREE.NoColorSpace;
  image.minFilter = THREE.LinearMipmapLinearFilter;
  image.anisotropy = 4;
  image.needsUpdate = true;
  // (its shape: the portrait shows it at the frame's height, its own width)
  image.userData.aspect = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
  // (and its mask: the portrait shows only the person, cut out of the rest)
  if (mask) {
    const m = new THREE.Texture(mask);
    m.colorSpace = THREE.NoColorSpace;
    m.needsUpdate = true;
    image.userData.mask = m;
  }
  // (and its depth, where there is one: the particles stand out at it)
  if (depth) {
    const d = new THREE.Texture(depth);
    d.colorSpace = THREE.NoColorSpace;
    d.minFilter = THREE.LinearFilter;
    d.needsUpdate = true;
    image.userData.depth = d;
  }
  return { texture: buildFromSource(img, member.focus, mask), image, points, missing: false };
}

// (an image drawn into the map's frame, as framed by focus)
function drawFramed(src, frame) {
  const c = document.createElement("canvas");
  c.width = MAP_W;
  c.height = MAP_H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.drawImage(src, frame.x, frame.y, frame.w, frame.h);
  return ctx.getImageData(0, 0, MAP_W, MAP_H).data;
}

function buildFromSource(src, focus = {}, mask = null) {
  const iw = src.naturalWidth || src.width;
  const ih = src.naturalHeight || src.height;
  const s = Math.max(MAP_W / iw, MAP_H / ih) * (focus.zoom ?? 1);
  const w = iw * s;
  const h = ih * s;
  let dx = MAP_W / 2 - w * (focus.x ?? 0.5);
  let dy = MAP_H / 2 - h * (focus.y ?? 0.5);
  // (the photo always covers the frame: never a hard empty strip along an
  // edge, which would read as a contour)
  dx = Math.min(Math.max(dx, MAP_W - w), 0);
  dy = Math.min(Math.max(dy, MAP_H - h), 0);
  const frame = { x: dx, y: dy, w, h };
  const data = drawFramed(src, frame);
  return toTexture(process(data, mask ? drawFramed(mask, frame) : null), MAP_W, MAP_H);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function boxBlur(src, W, H, r) {
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * W + Math.min(Math.max(x, 0), W - 1)];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc / (2 * r + 1);
      acc += src[y * W + Math.min(x + r + 1, W - 1)] - src[y * W + Math.max(x - r, 0)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(Math.max(y, 0), H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(y + r + 1, H - 1) * W + x] - tmp[Math.max(y - r, 0) * W + x];
    }
  }
  return out;
}

function process(data, maskData = null) {
  const W = MAP_W;
  const H = MAP_H;
  const N = W * H;
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;

  // the background: the median colour round the frame's border
  const border = [[], [], []];
  for (let x = 0; x < W; x += 2) {
    for (const y of [0, 1, H - 2, H - 1]) for (let k = 0; k < 3; k++) border[k].push(data[(y * W + x) * 4 + k]);
  }
  for (let y = 0; y < H; y += 2) {
    for (const x of [0, 1, W - 2, W - 1]) for (let k = 0; k < 3; k++) border[k].push(data[(y * W + x) * 4 + k]);
  }
  const bg = border.map((ch) => percentile(ch, 0.5) / 255);

  // the subject: far enough from the background's colour, inside an oval
  const raw = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (maskData) {
        raw[i] = maskData[i * 4] / 255;
        continue;
      }
      const d = Math.hypot(data[i * 4] / 255 - bg[0], data[i * 4 + 1] / 255 - bg[1], data[i * 4 + 2] / 255 - bg[2]) / Math.sqrt(3);
      const fg = smooth(0.04, 0.2, d);
      const ox = (x / W - 0.5) / 0.52;
      const oy = (y / H - 0.5) / 0.6;
      const vig = 1 - smooth(0.82, 1.08, Math.hypot(ox, oy));
      // (the shoulders run out of the bottom of the frame: no fade there)
      const foot = smooth(0.55, 0.9, y / H);
      raw[i] = fg * Math.max(vig, foot * (1 - smooth(0.46, 0.52, Math.abs(x / W - 0.5)) * 0.6));
    }
  }
  const mask = boxBlur(boxBlur(raw, W, H, 2), W, H, 2);

  // luminance stretched over the subject
  const lumIn = [];
  for (let i = 0; i < N; i += 3) if (mask[i] > 0.35) lumIn.push(L[i]);
  const lo = percentile(lumIn, 0.03);
  const hi = Math.max(percentile(lumIn, 0.995), lo + 0.05);

  // edges, on the luminance softened across (so a photo's fine vertical
  // texture doesn't read as contours)
  const Ls = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    let acc = 0;
    const r = 4;
    for (let x = -r; x <= r; x++) acc += L[y * W + Math.min(Math.max(x, 0), W - 1)];
    for (let x = 0; x < W; x++) {
      Ls[y * W + x] = acc / (2 * r + 1);
      acc += L[y * W + Math.min(x + r + 1, W - 1)] - L[y * W + Math.max(x - r, 0)];
    }
  }
  const E = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -Ls[i - W - 1] - 2 * Ls[i - 1] - Ls[i + W - 1] + Ls[i - W + 1] + 2 * Ls[i + 1] + Ls[i + W + 1];
      const gy = -Ls[i - W - 1] - 2 * Ls[i - W] - Ls[i - W + 1] + Ls[i + W - 1] + 2 * Ls[i + W] + Ls[i + W + 1];
      E[i] = Math.hypot(gx, gy);
    }
  }
  const eIn = [];
  for (let i = 0; i < N; i += 3) if (mask[i] > 0.35) eIn.push(E[i]);
  const eHi = Math.max(percentile(eIn, 0.97), 1e-3);

  // depth: a rounded dome over the head and shoulders (the mask blurred wide,
  // three times over: near a smooth falloff to its edges), lifted a little by
  // the face's own light (brow, nose, cheekbones forward)
  let dome = boxBlur(boxBlur(boxBlur(mask, W, H, 26), W, H, 26), W, H, 26);
  let dMax = 1e-3;
  for (let i = 0; i < N; i++) dMax = Math.max(dMax, dome[i]);
  const depth = new Float32Array(N);
  const Lb = boxBlur(L, W, H, 3);
  for (let i = 0; i < N; i++) depth[i] = Math.min(Math.pow(dome[i] / dMax, 0.7) * 0.85 + Lb[i] * mask[i] * 0.15, 1);
  dome = null;

  const out = new Uint8Array(N * 4);
  for (let y = 0; y < H; y++) {
    const dst = (H - 1 - y) * W;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const m = mask[i];
      const l = Math.pow(Math.min(Math.max((L[i] - lo) / (hi - lo), 0), 1), 1.15);
      const e = Math.pow(Math.min(E[i] / eHi, 1), 1.3);
      const o = (dst + x) * 4;
      out[o] = l * m * 255;
      out[o + 1] = e * m * 255;
      out[o + 2] = depth[i] * 255;
      out[o + 3] = m * 255;
    }
  }
  return out;
}

function toTexture(bytes, W, H) {
  const t = new THREE.DataTexture(bytes, W, H, THREE.RGBAFormat);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

// An anonymous head-and-shoulders outline (no features): what a member
// without a photo is shown as, so no face is ever made up.
function silhouetteCanvas() {
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 500;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 400, 500);
  // (hollow: a dim fill, a bright outline)
  const outline = () => {
    g.beginPath();
    g.ellipse(200, 185, 78, 96, 0, Math.PI * 0.62, Math.PI * 2.38);
    g.bezierCurveTo(232, 300, 236, 316, 240, 326);
    g.bezierCurveTo(300, 336, 370, 380, 384, 500);
    g.lineTo(16, 500);
    g.bezierCurveTo(30, 380, 100, 336, 160, 326);
    g.bezierCurveTo(164, 316, 168, 300, 166, 270);
    g.closePath();
  };
  outline();
  g.fillStyle = "#262626";
  g.fill();
  g.strokeStyle = "#b0b0b0";
  g.lineWidth = 5;
  outline();
  g.stroke();
  return c;
}
