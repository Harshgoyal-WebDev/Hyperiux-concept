"""Yggdrasil World Tree - procedural texture generation.

Generates, with numpy only (no Cycles bake), the PBR images the tree uses:

  bark_basecolor.jpg  2048 sRGB   seamless dark-walnut / earthy-brown bark
  bark_normal.jpg     2048 linear OpenGL (+Y) tangent-space normal map
  bark_orm.jpg        2048 linear R=AO  G=roughness  B=metallic (glTF ORM)
  leaf_atlas.png      2048 sRGBA  2x2 atlas of leaf sprays (twigs + ~350 veined leaves, alpha mask)
  leaf_normal.jpg     2048 linear OpenGL normal map: per-leaf tilt, midrib fold, droop, round twigs

Every bark map tiles seamlessly in both directions (built from FFT-periodic
noise and integer ridge frequencies), so the trunk/root/branch UVs can wrap.

Run inside Blender:
    exec(open(".../ygg_textures.py").read()); build_textures(out_dir)
"""

import os
import math
import numpy as np
import bpy


# --------------------------------------------------------------------------
# periodic noise helpers
# --------------------------------------------------------------------------

def periodic_noise(n, rng, beta=1.0, sx=1.0, sy=1.0, lo=0.0):
    """Seamless fractal noise, std-normalised. sx/sy stretch frequencies:
    sy > sx gives features elongated along x, and vice versa."""
    white = rng.standard_normal((n, n))
    spec = np.fft.fft2(white)
    fy = np.fft.fftfreq(n)[:, None] * sy
    fx = np.fft.fftfreq(n)[None, :] * sx
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = 1.0 / np.power(f, beta)
    if lo > 0:
        amp *= 1.0 - np.exp(-(f / lo) ** 2)
    amp[0, 0] = 0.0
    out = np.real(np.fft.ifft2(spec * amp))
    out -= out.mean()
    out /= out.std() + 1e-9
    return out


def periodic_blur(img, sigma):
    """Gaussian blur with wrap-around (FFT), keeps tiling intact."""
    n0, n1 = img.shape[:2]
    fy = np.fft.fftfreq(n0)[:, None]
    fx = np.fft.fftfreq(n1)[None, :]
    g = np.exp(-2.0 * (math.pi ** 2) * (sigma ** 2) * (fx * fx + fy * fy))
    if img.ndim == 2:
        return np.real(np.fft.ifft2(np.fft.fft2(img) * g))
    return np.stack([np.real(np.fft.ifft2(np.fft.fft2(img[..., c]) * g))
                     for c in range(img.shape[2])], axis=-1)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def save_image(name, rgba, path, fmt, non_color=False, quality=92):
    """rgba: (h, w, 4) float array, row 0 = bottom (Blender convention)."""
    h, w = rgba.shape[:2]
    img = bpy.data.images.get(name)
    if img is not None:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, width=w, height=h, alpha=(fmt == "PNG"))
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = fmt
    scene = bpy.context.scene
    old_q = scene.render.image_settings.quality
    scene.render.image_settings.quality = quality
    img.save()
    scene.render.image_settings.quality = old_q
    bpy.data.images.remove(img)
    return path


# --------------------------------------------------------------------------
# bark
# --------------------------------------------------------------------------

def periodic_worley(n, gx, gy, rng, warp_x, warp_y):
    """F1/F2 Worley distances on a jittered gx*gy grid that wraps.
    Distances are measured in grid-cell units (so cells look elongated when
    gx != gy). warp_* (pixels->cell units) bend the lookup coordinates."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    px = (x / n) * gx + warp_x
    py = (y / n) * gy + warp_y
    jit = rng.uniform(0.08, 0.92, size=(gy, gx, 2)).astype(np.float32)
    cx0 = np.floor(px).astype(np.int32)
    cy0 = np.floor(py).astype(np.int32)
    f1 = np.full((n, n), 9.0, np.float32)
    f2 = np.full((n, n), 9.0, np.float32)
    # cells are (gx/gy) times taller than wide in the metric, so search wider in x
    rx = int(math.ceil(gx / gy)) + 1
    for oy in (-1, 0, 1):
        for ox in range(-rx, rx + 1):
            cx = cx0 + ox
            cy = cy0 + oy
            j = jit[cy % gy, cx % gx]
            dx = (cx + j[..., 0]) - px
            # measure in x-cell widths so crack lines keep an even pixel width
            dy = ((cy + j[..., 1]) - py) * (gx / gy)
            d = np.sqrt(dx * dx + dy * dy)
            f2 = np.where(d < f1, f1, np.minimum(f2, d))
            f1 = np.minimum(f1, d)
    return f1, f2


def make_bark(n=2048, seed=7):
    rng = np.random.default_rng(seed)

    # Meandering warp, elongated along v (the branch axis).
    # Low-passed so the warp never folds space (that smears the crack network).
    def smooth_warp(**kw):
        w = periodic_blur(periodic_noise(n, rng, **kw), n / 90.0)
        return w / (w.std() + 1e-9)
    warp_a = smooth_warp(beta=2.2, sx=1.0, sy=2.5)
    warp_b = smooth_warp(beta=2.0, sx=2.5, sy=1.0)
    gx, gy = 14, 3        # plates ~4-5x taller than wide, integer grid -> seamless
    f1, f2 = periodic_worley(n, gx, gy, rng, 0.45 * warp_a, 0.25 * warp_b)
    edge = f2 - f1                                   # 0 on the crack network

    # crack width varies along the network: wide furrows + hairline cracks
    width = 0.045 + 0.04 * smoothstep(-1.0, 1.5, periodic_noise(n, rng, beta=2.0))
    groove = np.exp(-(edge / width) ** 4)   # crisp walls, flat furrow floor

    # secondary finer network that splits the big plates
    f1b, f2b = periodic_worley(n, 23, 9, rng, 0.35 * warp_b, 0.2 * warp_a)
    groove2 = np.exp(-((f2b - f1b) / 0.06) ** 2)
    groove2 *= smoothstep(-0.4, 0.8, periodic_noise(n, rng, beta=1.8))
    groove = np.maximum(groove, 0.5 * groove2)

    fibres = periodic_noise(n, rng, beta=1.0, sx=1.0, sy=0.10)   # long vertical fibres
    mid = periodic_noise(n, rng, beta=1.8)
    fine = periodic_noise(n, rng, beta=0.6)

    plate = np.clip(edge / 0.35, 0, 1) ** 0.5            # rounded, raised plates
    height = 0.55 * plate + 0.10 * fibres + 0.10 * mid + 0.035 * fine
    height -= 0.75 * groove
    height = (height - height.min()) / (height.max() - height.min())

    # ---- normal map (OpenGL, +Y up; rows increase with v) ----
    strength = 9.0
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5 * strength
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5 * strength
    nz = np.ones_like(dx)
    nx, ny = -dx, -dy
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5,
                       np.ones_like(nz)], axis=-1)

    # ---- ambient occlusion from cavity ----
    cav = height - periodic_blur(height, 10.0)
    ao = np.clip(0.80 + 2.2 * cav - 0.45 * groove, 0.25, 1.0)
    ao = periodic_blur(ao, 1.0)

    # ---- base colour (authored directly in sRGB) ----
    walnut = np.array([62, 41, 28]) / 255.0
    walnut_dark = np.array([30, 19, 13]) / 255.0
    earthy = np.array([108, 78, 54]) / 255.0
    weathered = np.array([128, 112, 96]) / 255.0
    patch = smoothstep(-0.6, 1.0, periodic_noise(n, rng, beta=2.4))
    t = np.clip(height, 0, 1)[..., None]
    col = walnut[None, None, :] * (1 - t) + earthy[None, None, :] * t
    col = col * (1 - 0.35 * patch[..., None]) + walnut[None, None, :] * 0.35 * patch[..., None]
    weather = smoothstep(0.72, 0.95, height) * smoothstep(-0.2, 1.2, periodic_noise(n, rng, beta=1.6))
    col = col * (1 - 0.45 * weather[..., None]) + weathered[None, None, :] * 0.45 * weather[..., None]
    gmask = smoothstep(0.15, 0.85, groove)[..., None]
    col = col * (1 - gmask) + walnut_dark[None, None, :] * gmask
    col *= (0.92 + 0.08 * np.clip(fine, -2, 2)[..., None] / 2.0)
    col *= ao[..., None] ** 0.6
    basecolor = np.concatenate([np.clip(col, 0, 1), np.ones((n, n, 1))], axis=-1)

    # ---- ORM ----
    rough = np.clip(0.80 + 0.14 * groove + 0.05 * mid - 0.10 * weather, 0.55, 1.0)
    orm = np.stack([ao, rough, np.zeros_like(ao), np.ones_like(ao)], axis=-1)

    return basecolor, normal, orm


# --------------------------------------------------------------------------
# leaf-spray atlas: base colour + alpha, and a tangent-space normal map
# --------------------------------------------------------------------------

PALETTES = [
    # (name, sRGB leaf colours) - always green, never orange
    ("emerald", [(46, 118, 58), (38, 104, 50), (58, 132, 66), (44, 112, 70)]),
    ("forest", [(34, 86, 40), (28, 74, 36), (44, 98, 46), (38, 90, 54)]),
    ("olive", [(88, 112, 46), (72, 104, 44), (58, 116, 54), (98, 118, 52)]),
    ("mixed", [(44, 112, 56), (32, 82, 40), (86, 110, 46), (52, 124, 66)]),
]

TWIG_COL = np.array([84, 66, 44]) / 255.0
UNDERSIDE = np.array([128, 146, 112]) / 255.0


class Spray:
    """Paints one leaf spray (a twig carrying ~350 leaves) into a square cell.
    Rows are bottom-up (Blender pixel order): the stem enters at the bottom."""

    def __init__(self, n, rng):
        self.n = n
        self.rng = rng
        self.rgb = np.zeros((n, n, 3))
        self.a = np.zeros((n, n))
        self.nrm = np.zeros((n, n, 3))
        self.nrm[..., 2] = 1.0
        self.yy, self.xx = np.mgrid[0:n, 0:n].astype(np.float64)
        self.c = np.array([n * 0.5, n * 0.5])
        self.R = n * 0.47

    def clamp(self, p):
        d = p - self.c
        r = np.hypot(*d)
        return self.c + d * (self.R / r) if r > self.R else p

    def box(self, pts, pad):
        pts = np.array(pts)
        x0 = int(max(0, pts[:, 0].min() - pad)); x1 = int(min(self.n, pts[:, 0].max() + pad + 1))
        y0 = int(max(0, pts[:, 1].min() - pad)); y1 = int(min(self.n, pts[:, 1].max() + pad + 1))
        return (slice(y0, y1), slice(x0, x1)) if x1 > x0 and y1 > y0 else None

    def composite(self, sl, mask, col, nrm):
        m = mask[..., None]
        self.rgb[sl] = self.rgb[sl] * (1 - m) + col * m
        self.nrm[sl] = self.nrm[sl] * (1 - m) + nrm * m
        self.a[sl] = self.a[sl] + mask * (1 - self.a[sl])

    # ---- twigs: tapered, round (normal-mapped) segments ----
    def segment(self, p, q, w0, w1):
        sl = self.box([p, q], max(w0, w1) + 2)
        if sl is None:
            return
        X = self.xx[sl]; Y = self.yy[sl]
        d = q - p
        L2 = float(d @ d) + 1e-9
        t = np.clip(((X - p[0]) * d[0] + (Y - p[1]) * d[1]) / L2, 0, 1)
        px = X - (p[0] + t * d[0]); py = Y - (p[1] + t * d[1])
        dist = np.sqrt(px * px + py * py)
        w = w0 + (w1 - w0) * t
        mask = smoothstep(w + 0.7, w - 0.5, dist)
        perp = np.array([-d[1], d[0]]) / math.sqrt(L2)
        s = np.clip((px * perp[0] + py * perp[1]) / (w + 1e-6), -1, 1)
        nx, ny = perp[0] * s * 0.85, perp[1] * s * 0.85
        nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0.05, 1))
        shade = (0.78 + 0.3 * (1 - np.abs(s)))[..., None]
        self.composite(sl, mask, TWIG_COL[None, None, :] * shade, np.stack([nx, ny, nz], -1))

    def polyline(self, pts, w0, w1):
        k = len(pts) - 1
        for i in range(k):
            self.segment(pts[i], pts[i + 1], w0 + (w1 - w0) * i / k, w0 + (w1 - w0) * (i + 1) / k)

    def curve(self, p0, p1, p2, steps=14):
        return [self.clamp((1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2)
                for t in np.linspace(0, 1, steps)]

    # ---- one leaf ----
    def leaf(self, base, ang, L, W, bend, col, z, under=False):
        rng = self.rng
        ca, sa = math.cos(ang), math.sin(ang)
        tip = base + L * np.array([ca, sa])
        if np.hypot(*(tip - self.c)) > self.R + 6:
            return
        sl = self.box([base, tip], W + abs(bend) * L + 10)
        if sl is None:
            return
        X = self.xx[sl] - base[0]; Y = self.yy[sl] - base[1]

        def shape(Xs, Ys, soft):
            a = (Xs * ca + Ys * sa) / L
            c = -Xs * sa + Ys * ca - bend * L * a * a
            ac = np.clip(a, 0, 1)
            hw = W * np.power(np.clip(4 * ac * (1 - ac), 0, 1), 0.62) * (1.0 - 0.28 * ac)
            m = smoothstep(hw + soft, hw - soft, np.abs(c)) * (a > 0) * (a < 1)
            return a, c, hw, m

        a, c, hw, mask = shape(X, Y, 0.9)
        if mask.max() < 0.05:
            return
        # soft cast shadow onto the leaves already painted behind this one
        _, _, _, sh = shape(X - 5.0, Y + 7.0, 3.5)
        self.rgb[sl] *= (1.0 - 0.34 * sh * self.a[sl])[..., None]

        side = np.sign(c)
        rel = np.clip(np.abs(c) / (hw + 1e-6), 0, 1)
        midrib = np.exp(-(c / 1.1) ** 2) * (a < 0.93)
        vp = (a * L - np.abs(c) * 1.15) / (L * 0.105)
        veins = np.exp(-((vp - np.round(vp)) / 0.1) ** 2) * (rel < 0.85) * (a > 0.07) * (a < 0.9)
        shade = 1.0 + 0.17 * midrib + 0.07 * veins - 0.14 * rel ** 3 + 0.07 * (1 - a)
        ao = 0.66 + 0.34 * z
        speck = 1.0 + 0.035 * rng.standard_normal(mask.shape)
        base_col = UNDERSIDE * 0.8 if under else col
        colr = base_col[None, None, :] * (shade * ao * speck)[..., None]

        axis = np.array([ca, sa]); across = np.array([-sa, ca])
        fold = rng.uniform(0.18, 0.42)
        tilt = np.clip(rng.normal(0, 0.32, size=2), -0.7, 0.7)
        droop = rng.uniform(0.1, 0.4)
        k_across = -side * fold * np.sqrt(rel) + side * 0.35 * np.exp(-(c / 1.6) ** 2) + 0.12 * veins * side
        k_axis = (a - 0.4) * droop
        nx = tilt[0] + k_across * across[0] + k_axis * axis[0]
        ny = tilt[1] + k_across * across[1] + k_axis * axis[1]
        nz = np.ones_like(nx)
        ln = np.sqrt(nx * nx + ny * ny + nz * nz)
        self.composite(sl, mask, colr, np.stack([nx / ln, ny / ln, nz / ln], -1))

    # ---- whole spray ----
    def paint(self, palette):
        rng, n = self.rng, self.n
        cols = [np.array(c) / 255.0 for c in palette]
        twigs = []      # (points, level)
        p0 = np.array([n * 0.5 + rng.uniform(-0.04, 0.04) * n, n * 0.02])
        p1 = np.array([n * 0.5 + rng.uniform(-0.16, 0.16) * n, n * 0.45])
        p2 = np.array([n * 0.5 + rng.uniform(-0.2, 0.2) * n, n * 0.9])
        main = self.curve(p0, p1, p2, 26)
        twigs.append((main, 0))
        side_sign = 1 if rng.random() < 0.5 else -1
        for t in sorted(rng.uniform(0.12, 0.82, size=rng.integers(6, 9))):
            i = int(t * (len(main) - 1))
            b = main[i]
            d = main[min(i + 1, len(main) - 1)] - main[max(i - 1, 0)]
            ang = math.atan2(d[1], d[0]) + side_sign * math.radians(rng.uniform(35, 62))
            side_sign *= -1
            ln = n * rng.uniform(0.22, 0.42) * (1 - 0.45 * t)
            dv = np.array([math.cos(ang), math.sin(ang)])
            pv = np.array([-dv[1], dv[0]]) * rng.uniform(-0.15, 0.15) * ln
            end = b + dv * ln + np.array([0, 0.12 * ln])
            side = self.curve(b, b + dv * ln * 0.5 + pv, end, 12)
            twigs.append((side, 1))
            for _ in range(rng.integers(1, 4)):
                j = int(rng.uniform(0.3, 0.8) * (len(side) - 1))
                sb = side[j]
                sd = side[min(j + 1, len(side) - 1)] - side[max(j - 1, 0)]
                sang = math.atan2(sd[1], sd[0]) + rng.choice([-1, 1]) * math.radians(rng.uniform(30, 55))
                sl_ = n * rng.uniform(0.09, 0.17)
                sdv = np.array([math.cos(sang), math.sin(sang)])
                twigs.append((self.curve(sb, sb + sdv * sl_ * 0.5, sb + sdv * sl_, 7), 2))

        widths = {0: (7.0, 2.4), 1: (3.6, 1.2), 2: (2.0, 0.8)}
        for pts, lvl in twigs:
            self.polyline(pts, *widths[lvl])

        leaves = []
        for pts, lvl in twigs:
            pts = np.array(pts)
            seg = np.hypot(*(pts[1:] - pts[:-1]).T)
            s_acc = np.concatenate([[0], np.cumsum(seg)])
            total = s_acc[-1]
            s = total * (0.18 if lvl == 0 else 0.12)
            alt = 1
            scale = {0: 1.0, 1: 0.95, 2: 0.82}[lvl]
            while s < total:
                i = min(int(np.searchsorted(s_acc, s)), len(pts) - 1)
                d = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
                tang = math.atan2(d[1], d[0])
                sides = [alt, -alt] if rng.random() < 0.35 else [alt]
                for sd in sides:
                    leaves.append((pts[i], tang + sd * math.radians(rng.uniform(32, 68)), scale))
                alt *= -1
                s += rng.uniform(15, 23)
            d = pts[-1] - pts[-2]
            tang = math.atan2(d[1], d[0])
            for k in range(rng.integers(2, 4)):
                leaves.append((pts[-1], tang + math.radians(rng.uniform(-28, 28)), scale))

        order = rng.permutation(len(leaves))
        zs = np.sort(rng.random(len(leaves)))
        for z, idx in zip(zs, order):
            b, ang, scale = leaves[idx]
            pet = rng.uniform(5, 10)
            dv = np.array([math.cos(ang), math.sin(ang)])
            base = b + dv * pet
            self.segment(b, base, 1.1, 0.8)
            L = rng.uniform(52, 84) * scale
            W = L * rng.uniform(0.2, 0.3)
            col = cols[rng.integers(len(cols))] * rng.uniform(0.82, 1.14)
            mixr = rng.random()
            if mixr < 0.18:
                col = col * 0.8 + np.array([0.46, 0.54, 0.16]) * 0.2     # sun-yellowed
            elif mixr < 0.3:
                col = col * 0.85 + np.array([0.10, 0.30, 0.28]) * 0.15   # blue-green
            self.leaf(base, ang, L, W, rng.uniform(-0.14, 0.14), np.clip(col, 0, 1), z,
                      under=rng.random() < 0.08)
        return self.rgb, self.a, self.nrm


def make_leaf_atlas(n=2048, seed=11):
    rng = np.random.default_rng(seed)
    cell = n // 2
    rgb = np.zeros((n, n, 3)); alpha = np.zeros((n, n)); nrm = np.zeros((n, n, 3))
    for idx, (_name, pal) in enumerate(PALETTES):
        cx, cy = idx % 2, idx // 2
        c_rgb, c_a, c_n = Spray(cell, rng).paint(pal)
        sl = (slice(cy * cell, (cy + 1) * cell), slice(cx * cell, (cx + 1) * cell))
        rgb[sl] = c_rgb; alpha[sl] = c_a; nrm[sl] = c_n

    # bleed leaf colour into transparent texels so mipmaps never fringe dark
    prem = rgb * alpha[..., None]
    filled = rgb.copy()
    for sigma in (2.0, 6.0, 18.0, 48.0):
        b_a = periodic_blur(alpha, sigma)
        b_c = periodic_blur(prem, sigma) / (b_a[..., None] + 1e-6)
        take = (alpha < 0.5) & (b_a > 0.02)
        filled[take] = b_c[take]
    still = (alpha < 0.5) & (filled.sum(-1) < 1e-4)
    filled[still] = prem.reshape(-1, 3).sum(0) / (alpha.sum() + 1e-6)
    color = np.concatenate([np.clip(filled, 0, 1), alpha[..., None]], axis=-1)

    ln = np.linalg.norm(nrm, axis=-1, keepdims=True) + 1e-9
    nrm = nrm / ln
    nrm[alpha < 0.02] = (0.0, 0.0, 1.0)
    normal = np.concatenate([nrm * 0.5 + 0.5, np.ones((n, n, 1))], axis=-1)
    return color, normal


def build_textures(out_dir, bark_size=2048, leaf_size=2048, bark=True):
    os.makedirs(out_dir, exist_ok=True)
    paths = {}
    if bark:
        basecolor, normal, orm = make_bark(bark_size)
        paths["bark_basecolor"] = save_image("YGG_bark_basecolor", basecolor,
                                             os.path.join(out_dir, "bark_basecolor.jpg"), "JPEG")
        paths["bark_normal"] = save_image("YGG_bark_normal", normal,
                                          os.path.join(out_dir, "bark_normal.jpg"), "JPEG", quality=95)
        paths["bark_orm"] = save_image("YGG_bark_orm", orm,
                                       os.path.join(out_dir, "bark_orm.jpg"), "JPEG")
    color, lnorm = make_leaf_atlas(leaf_size)
    paths["leaf_atlas"] = save_image("YGG_leaf_atlas", color,
                                     os.path.join(out_dir, "leaf_atlas.png"), "PNG")
    paths["leaf_normal"] = save_image("YGG_leaf_normal", lnorm,
                                      os.path.join(out_dir, "leaf_normal.jpg"), "JPEG", quality=94)
    return paths
