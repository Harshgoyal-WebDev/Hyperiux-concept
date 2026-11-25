"""
Bakes a team member's portrait into a lit point cloud for the /about page
(after lusion.co/about's team section): a few thousand points spread evenly
over the person — denser on the face — each with its depth, its surface
normal and its shade. The page lights them live, so the face reads as a
solid in 3D as the camera moves.

Inputs (all the same size, in my-app/public/assets/images/about/team/):
  the portrait render (source), its depth map (white near), its outline mask.
Output: <out>.points.bin — uint32 count, then per point float32:
  u, v (0..1, v up), depth (0..1), nx, ny, nz, shade (0..1)

Usage (from my-app/):
  python3 scripts/bake-team-points.py <source> <depth> <mask> <out> [count]
e.g.
  python3 scripts/bake-team-points.py public/assets/images/about/team/harsh-goyal.jpg \
    public/assets/images/about/team/harsh-goyal-depth.png \
    public/assets/images/about/team/harsh-goyal-figure.png \
    public/assets/images/about/team/harsh-goyal.points.bin

Needs: numpy, scipy, Pillow.
"""
import struct
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree

src_path, depth_path, mask_path, out_path = sys.argv[1:5]
COUNT = int(sys.argv[5]) if len(sys.argv) > 5 else 12000
# (the portrait frame's proportions: width 0.8 × height; the depth's scale
# for the normals — the page sets the real depth live)
FRAME_W, FRAME_H, DEPTH_REF = 0.8, 1.0, 0.22
WORK_H = 820  # (worked at this height)

src = Image.open(src_path).convert("RGB")
W0, H0 = src.size
scale = WORK_H / H0
W, H = round(W0 * scale), WORK_H
rgb = np.asarray(src.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
depth = np.asarray(Image.open(depth_path).convert("L").resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
mask = np.asarray(Image.open(mask_path).convert("L").resize((W, H), Image.LANCZOS)).astype(np.float32) / 255

# shade: the render's luminance, its thin vertical lines of light opened away
# (they're the render's styling, not the face), softened a touch
lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
lum = ndi.grey_opening(lum, size=(1, 7))
lum = ndi.gaussian_filter(lum, 1.0)
lo, hi = np.percentile(lum[mask > 0.5], [2, 99.5])
shade = np.clip((lum - lo) / max(hi - lo, 1e-3), 0, 1)

# normals from the depth (smoothed), in the frame's own units
d = ndi.gaussian_filter(depth, 4.0) * DEPTH_REF  # (smoothed well: 8-bit depth maps step)
px = FRAME_H / H  # (one pixel, in frame units)
dzdx = ndi.sobel(d, axis=1) / (8 * px)
dzdy = -ndi.sobel(d, axis=0) / (8 * px)  # (image rows run down; v runs up)
n = np.dstack([-dzdx, -dzdy, np.ones_like(d)])
n /= np.linalg.norm(n, axis=2, keepdims=True)

# where the points go: over the person, denser where the face is (its
# features: brighter and more detailed), thinning out into the body
edges = np.hypot(ndi.sobel(ndi.gaussian_filter(lum, 1.5), 0), ndi.sobel(ndi.gaussian_filter(lum, 1.5), 1))
edges /= max(np.percentile(edges[mask > 0.5], 98), 1e-4)
density = mask * (0.35 + 0.45 * shade ** 0.7 + 0.35 * np.clip(edges, 0, 1))
density = ndi.gaussian_filter(density, 2.0)
density[mask < 0.02] = 0

# start: drawn by the density; then evened out (weighted Lloyd relaxation:
# each point to the weighted centre of the pixels nearest it) — a stipple
rng = np.random.default_rng(7)
flat = density.ravel()
p = flat / flat.sum()
idx = rng.choice(flat.size, COUNT, p=p)
pts = np.stack([idx % W + rng.random(COUNT), idx // W + rng.random(COUNT)], axis=1)
yy, xx = np.mgrid[0:H, 0:W]
inside = flat > 1e-4
pix = np.stack([xx.ravel()[inside] + 0.5, yy.ravel()[inside] + 0.5], axis=1)
wts = flat[inside]
for it in range(14):
    tree = cKDTree(pts)
    _, owner = tree.query(pix, k=1)
    sw = np.bincount(owner, weights=wts, minlength=COUNT)
    sx = np.bincount(owner, weights=wts * pix[:, 0], minlength=COUNT)
    sy = np.bincount(owner, weights=wts * pix[:, 1], minlength=COUNT)
    ok = sw > 0
    pts[ok, 0] = sx[ok] / sw[ok]
    pts[ok, 1] = sy[ok] / sw[ok]
    # (any left with no pixels: dropped somewhere new by the density)
    lost = np.where(~ok)[0]
    if len(lost):
        j = rng.choice(flat.size, len(lost), p=p)
        pts[lost] = np.stack([j % W + 0.5, j // W + 0.5], axis=1)
    print(f"  relax {it + 1}/14", end="\r")
print()

# sampled at each point
ix = np.clip(pts[:, 0].astype(int), 0, W - 1)
iy = np.clip(pts[:, 1].astype(int), 0, H - 1)
u = pts[:, 0] / W
v = 1 - pts[:, 1] / H
dep = ndi.gaussian_filter(depth, 1.0)[iy, ix]
nn = n[iy, ix]
sh = shade[iy, ix]

# ordered along a Hilbert curve over the frame: neighbours in the list are
# neighbours on the face — so one person's point k and the next's point k are
# in the same region, and a change morphs region to region
def hilbert(x, y, order=10):
    d = np.zeros_like(x)
    s = 1 << (order - 1)
    x = x.copy()
    y = y.copy()
    while s > 0:
        rx = ((x & s) > 0).astype(np.int64)
        ry = ((y & s) > 0).astype(np.int64)
        d += s * s * ((3 * rx) ^ ry)
        flip = ry == 0
        swap = flip & (rx == 1)
        x[swap] = s - 1 - x[swap]
        y[swap] = s - 1 - y[swap]
        x[flip], y[flip] = y[flip].copy(), x[flip].copy()
        s >>= 1
    return d

hx = np.clip((u * 1023).astype(np.int64), 0, 1023)
hy = np.clip((v * 1023).astype(np.int64), 0, 1023)
order = np.argsort(hilbert(hx, hy))
data = np.stack([u, v, dep, nn[:, 0], nn[:, 1], nn[:, 2], sh], axis=1)[order].astype(np.float32)

with open(out_path, "wb") as f:
    f.write(struct.pack("<I", COUNT))
    f.write(data.tobytes())
print(f"wrote {out_path}: {COUNT} points")
