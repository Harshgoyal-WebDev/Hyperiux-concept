"""Yggdrasil World Tree - procedural geometry + materials (Blender 4.2+ / 5.x).

Builds a ~40 m ancient world tree as five separately named meshes:

  YGG_Roots          massive exposed root network (+ twisted companions,
                     secondary roots and rootlets), recessed ember grooves
  YGG_Trunk          fused core + 7 helically intertwined trunk strands,
                     geometric bark ridges, burls, recessed ember grooves
  YGG_Branches       the 7 strands continue as major limbs, a central leader,
                     two recursive levels of sub-branches  (attr _sway)
  YGG_Foliage        layered foliage pads made of crossed leaf-cluster cards
                     with alpha-mask atlas + volumetric custom normals
                     (attrs _sway, _phase)
  YGG_EmberChannels  thin vein strips sitting *inside* the grooves, for an
                     orange emissive material driven from Three.js
                     UVMap    u across vein, v 0..1 along that channel
                     EnergyUV u channel id / count, v global energy coord:
                              root tip 0.0 -> trunk base 0.5 -> trunk top 1.0

Blender is Z-up, 1 unit = 1 m, origin = trunk centre at ground level (z=0).
Roots dive ~3 m below z=0 so the tree can sit on uneven terrain.

Usage inside Blender:
    exec(open(".../ygg_build.py").read()); build(tex_dir)
"""

import math
import random
import bpy
from mathutils import Vector, noise

TAU = math.tau
UP = Vector((0.0, 0.0, 1.0))

# Filled by build_geometry(): every swept path (for the light-strand variant)
# as (object name, full path points, radii, first ring, last ring, path key),
# and every foliage pad that survives thinning as (centre, rx, ry, rz).
_SKEL = []
_PADS = []


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def frange(a, b, step):
    out = []
    x = a
    while x <= b + 1e-9:
        out.append(x)
        x += step
    return out


_NOFF1 = Vector((31.4, 17.2, -9.7))
_NOFF2 = Vector((-23.1, 41.7, 12.9))


def nvec(p):
    """Deterministic noise vector. mathutils.noise.noise_vector() is NOT
    reproducible across Blender processes (it changes every launch), so build
    the vector from three offset samples of noise.noise(), which is."""
    p = Vector(p)
    return Vector((noise.noise(p), noise.noise(p + _NOFF1), noise.noise(p + _NOFF2)))


class Acc:
    """Accumulates one mesh: verts, faces, per-corner UVs, per-vertex attrs."""

    def __init__(self, name, attrs=(), uv2=False, normals=False):
        self.name = name
        self.co = []
        self.faces = []
        self.uv = []
        self.uv2 = [] if uv2 else None
        self.attrs = {a: [] for a in attrs}
        self.normals = [] if normals else None

    def vert(self, co, nrm=None, **at):
        self.co.append((co[0], co[1], co[2]))
        for k, lst in self.attrs.items():
            lst.append(at.get(k, 0.0))
        if self.normals is not None:
            self.normals.append(tuple(nrm) if nrm is not None else (0.0, 0.0, 1.0))
        return len(self.co) - 1

    def face(self, idx, uvs, uv2s=None):
        self.faces.append(tuple(idx))
        self.uv.extend(uvs)
        if self.uv2 is not None:
            self.uv2.extend(uv2s if uv2s is not None else [(0.0, 0.0)] * len(idx))

    @property
    def tris(self):
        return sum(len(f) - 2 for f in self.faces)


def frames(pts, frame_dir=None):
    """Tangent / normal / binormal per sample. Parallel transport, or a
    preferred normal direction (used to keep ember grooves on a visible side)."""
    n = len(pts)
    T = []
    for i in range(n):
        t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        if t.length < 1e-9:
            t = T[-1].copy() if T else UP.copy()
        T.append(t.normalized())
    t0 = T[0]
    ref = Vector((1, 0, 0)) if abs(t0.x) < 0.9 else Vector((0, 1, 0))
    prev = (ref - t0 * ref.dot(t0)).normalized()
    N, B = [], []
    for i in range(n):
        t = T[i]
        nn = None
        if frame_dir is not None:
            d = frame_dir(i, pts[i], t)
            nn = d - t * d.dot(t)
            nn = nn.normalized() if nn.length > 1e-3 else None
        if nn is None:
            nn = prev - t * prev.dot(t)
            nn = nn.normalized() if nn.length > 1e-6 else (ref - t * ref.dot(t)).normalized()
        N.append(nn)
        B.append(t.cross(nn))
        prev = nn
    return T, N, B


def arclen(pts):
    S = [0.0]
    for i in range(1, len(pts)):
        S.append(S[-1] + (pts[i] - pts[i - 1]).length)
    return S


# --------------------------------------------------------------------------
# the tube sweep: every root, trunk strand and branch goes through here
# --------------------------------------------------------------------------

def tube(acc, pts, radii, segs, *, tile=2.4, ridge_k=0, ridge_amp=0.0, twist=0.0,
         lump=0.08, seed=0, frame_dir=None, groove=None, cap=False, sway=None,
         burls=None, ring_range=None, uv_r=None, cap_len=1.4):
    rnd = random.Random(seed)
    off = Vector((rnd.uniform(-90, 90), rnd.uniform(-90, 90), rnd.uniform(-90, 90)))
    n = len(pts)
    _r0, _r1 = ring_range if ring_range else (0, n - 1)
    _SKEL.append((acc.name, pts, radii, _r0, _r1, id(pts)))
    T, N, B = frames(pts, frame_dir)
    S = arclen(pts)

    if groove:
        # warp angular samples so they crowd around theta=0 (the groove centre)
        M = segs
        thetas = []
        for j in range(M):
            x = -math.pi + TAU * j / M
            thetas.append(math.copysign(math.pi * (abs(x) / math.pi) ** 2.1, x))
    else:
        M = segs
        thetas = [-math.pi + TAU * j / M for j in range(M)]

    r_ref = uv_r if uv_r else max(radii[0] * 0.75, sorted(radii)[len(radii) // 2])
    urep = max(1, round(TAU * r_ref / tile))
    vscale = urep / (TAU * r_ref)

    env = [0.0] * n
    if groove:
        g0, g1 = groove["i0"], groove["i1"]
        ramp = max(2.0, (g1 - g0) * 0.12)
        for i in range(n):
            env[i] = smoothstep(g0, g0 + ramp, i) * (1.0 - smoothstep(g1 - ramp, g1, i))

    def gprof(i, th):
        if not groove or env[i] <= 0.0:
            return 0.0
        w = groove["w_m"] / max(radii[i], 0.05)
        return 1.0 - smoothstep(0.7, 1.25, abs(th) / w)

    def surf(i, th, damp):
        r = radii[i]
        d = N[i] * math.cos(th) + B[i] * math.sin(th)
        p0 = pts[i] + d * r
        rr = r
        if ridge_k:
            ph = ridge_k * th + twist * S[i] + 1.7 * noise.noise(p0 * 0.22 + off)
            rid = ridge_amp * r * (abs(math.sin(0.5 * ph)) ** 0.55 - 0.62)
            rr += rid * (1.0 - 0.9 * damp)
        if lump:
            rr += lump * r * (noise.noise(p0 * 0.16 + off) + 0.4 * noise.noise(p0 * 0.6 - off))
        if burls:
            for c, rad, amp in burls:
                dd = (p0 - c).length_squared
                if dd < 9.0 * rad * rad:
                    rr += amp * math.exp(-dd / (rad * rad))
        return d, rr

    i0, i1 = ring_range if ring_range else (0, n - 1)
    base = len(acc.co)
    for i in range(i0, i1 + 1):
        sw = sway[i] if sway else 0.0
        for th in thetas:
            pr = gprof(i, th) * env[i]
            d, rr = surf(i, th, pr)
            if groove:
                rr -= groove["depth_m"] * pr
            acc.vert(pts[i] + d * rr, _sway=sw)

    us = [(th + math.pi) / TAU * urep for th in thetas] + [urep]
    for ii in range(i1 - i0):
        v0 = S[i0 + ii] * vscale
        v1 = S[i0 + ii + 1] * vscale
        for j in range(M):
            jn = (j + 1) % M
            a = base + ii * M + j
            b = base + ii * M + jn
            c = base + (ii + 1) * M + jn
            dd = base + (ii + 1) * M + j
            acc.face((a, b, c, dd), [(us[j], v0), (us[j + 1], v0), (us[j + 1], v1), (us[j], v1)])

    if cap and i1 == n - 1:
        tip = pts[-1] + T[-1] * radii[-1] * cap_len
        ti = acc.vert(tip, _sway=(sway[-1] if sway else 0.0))
        last = base + (i1 - i0) * M
        vt = S[-1] * vscale + radii[-1] * cap_len * vscale
        v0 = S[-1] * vscale
        for j in range(M):
            jn = (j + 1) % M
            acc.face((last + j, last + jn, ti),
                     [(us[j], v0), (us[j + 1], v0), ((us[j] + us[j + 1]) * 0.5, vt)])

    # ---- ember vein that sits inside the recessed groove ----
    if groove and groove.get("ember") is not None:
        em = groove["ember"]
        K = 5
        rings = [i for i in range(max(groove["i0"], i0), min(groove["i1"], i1) + 1) if env[i] > 0.015]
        if len(rings) >= 3:
            s0, s1 = S[rings[0]], S[rings[-1]]
            L = max(s1 - s0, 1e-6)
            e0, e1 = groove["energy"]
            cu = groove["chan_u"]
            eb = len(em.co)
            for i in rings:
                e = env[i]
                w = groove["w_m"] / max(radii[i], 0.05)
                for k in range(K):
                    t = k / (K - 1)
                    a = (-0.8 + 1.6 * t) * w * (e ** 0.5)
                    pr = gprof(i, a) * e
                    d, rr = surf(i, a, pr)
                    rr -= groove["depth_m"] * pr
                    bulge = groove["depth_m"] * e * 0.30 * math.cos((t - 0.5) * math.pi)
                    em.vert(pts[i] + d * (rr + bulge + 0.004))
            for ii in range(len(rings) - 1):
                va = (S[rings[ii]] - s0) / L
                vb = (S[rings[ii + 1]] - s0) / L
                ea = e0 + (e1 - e0) * va
                eb_ = e0 + (e1 - e0) * vb
                for k in range(K - 1):
                    a = eb + ii * K + k
                    ua, ub = k / (K - 1), (k + 1) / (K - 1)
                    em.face((a, a + 1, a + 1 + K, a + K),
                            [(ua, va), (ub, va), (ub, vb), (ua, vb)],
                            [(cu, ea), (cu, ea), (cu, eb_), (cu, eb_)])
    return T, N, B, S


# --------------------------------------------------------------------------
# tree layout
# --------------------------------------------------------------------------

def core_center(z):
    return Vector((0.45 * math.sin(0.09 * z + 0.3), 0.35 * math.sin(0.07 * z + 1.1), z))


def core_radius(z):
    zc = max(z, 0.0)
    return 2.45 * (1.0 - 0.32 * min(zc / 24.0, 1.0)) + 2.9 * math.exp(-zc / 2.4)


def grow_path(start, d0, L, r0, rnd, *, step=0.5, up_bias=0.3, wander=0.35,
              r_end=0.05, power=0.85, droop=0.0):
    off = Vector((rnd.uniform(-50, 50), rnd.uniform(-50, 50), rnd.uniform(-50, 50)))
    pts = [start.copy()]
    rads = [r0]
    pos = start.copy()
    d = d0.normalized()
    s = 0.0
    while s < L:
        f = s / L
        tgt = d0 + UP * (up_bias * smoothstep(0.15, 1.0, f)) - UP * (droop * math.sin(math.pi * f))
        tgt = tgt + nvec(pos * 0.11 + off) * wander
        tgt.normalize()
        d = (d + (tgt - d) * 0.2).normalized()
        pos = pos + d * step
        s += step
        pts.append(pos.copy())
        rads.append(r0 * (1.0 - min(s / L, 1.0)) ** power + r_end)
    return pts, rads


def spawn_children(parent_pts, parent_rads, parent_L, level, rnd, *, count, angle, len_fac,
                   radius_fac=0.58, f_range=(0.28, 0.93), up=0.3, outward=0.25):
    T, N, B = frames(parent_pts)
    n = len(parent_pts)
    kids = []
    cnt = rnd.randint(*count)
    fs = sorted(rnd.uniform(*f_range) for _ in range(cnt))
    roll = rnd.uniform(0, TAU)
    for f in fs:
        i = min(n - 2, max(1, int(f * (n - 1))))
        roll += math.radians(137.5 + rnd.uniform(-20, 20))
        axis = N[i] * math.cos(roll) + B[i] * math.sin(roll)
        beta = math.radians(rnd.uniform(*angle))
        dirc = T[i] * math.cos(beta) + axis * math.sin(beta)
        outv = Vector((parent_pts[i].x, parent_pts[i].y, 0.0))
        if outv.length > 1e-3:
            dirc += outv.normalized() * outward
        dirc += UP * up
        if dirc.z < -0.2:
            dirc.z = -0.2
        dirc.normalize()
        L = len_fac(parent_L, f, rnd)
        r0 = max(parent_rads[i] * radius_fac, 0.06)
        kids.append((parent_pts[i].copy(), dirc, L, r0, f))
    return kids


def build_geometry(seed=1337):
    _SKEL.clear()
    _PADS.clear()
    rnd = random.Random(seed)
    roots = Acc("YGG_Roots")
    trunk = Acc("YGG_Trunk")
    branches = Acc("YGG_Branches", attrs=("_sway",))
    foliage = Acc("YGG_Foliage", attrs=("_sway", "_phase"), normals=True)
    ember = Acc("YGG_EmberChannels", uv2=True)
    pads = []          # (centre, rx, ry, rz, tilt-normal, palette bias)
    chan_count = 8     # 5 root channels + 3 trunk channels
    chan = [0]

    def next_chan():
        u = (chan[0] + 0.5) / chan_count
        chan[0] += 1
        return u

    # ---------------- trunk core ----------------
    zs = frange(-2.5, 20.5, 0.3)
    core_pts = [core_center(z) for z in zs]
    core_rad = [core_radius(z) for z in zs]
    burls = []
    for _ in range(6):
        z = rnd.uniform(4.0, 17.0)
        a = rnd.uniform(0, TAU)
        c = core_center(z) + Vector((math.cos(a), math.sin(a), 0)) * (core_radius(z) + 0.9)
        burls.append((c, rnd.uniform(0.8, 1.5), rnd.uniform(0.35, 0.6)))
    tube(trunk, core_pts, core_rad, 96, tile=2.6, ridge_k=22, ridge_amp=0.06, twist=0.10,
         lump=0.10, seed=rnd.randint(0, 9999), burls=burls, cap=True, cap_len=0.5)

    # ---------------- intertwined strands -> major limbs ----------------
    limbs = []
    grooved_strands = {0, 3, 5}
    for k in range(7):
        a0 = k * TAU / 7 + rnd.uniform(-0.2, 0.2)
        rk = rnd.uniform(0.85, 1.15)
        h = rnd.uniform(12.5, 19.0)
        omega = 0.075 * (1 if k % 3 else 1.25)
        pts, rads = [], []
        for z in frange(-2.0, h, 0.35):
            ang = a0 + omega * z
            zc = max(z, 0.0)
            R = (2.85 - 0.04 * zc) * (1.0 + 0.12 * math.sin(0.35 * z + k)) + 2.0 * math.exp(-zc / 1.8)
            pts.append(core_center(z) + Vector((math.cos(ang), math.sin(ang), 0.0)) * R)
            rads.append(rk * (1.6 * (1.0 - 0.014 * zc) + 0.9 * math.exp(-zc / 2.0)))
        i_split = len(pts) - 1
        ang_h = a0 + omega * h
        E = math.radians(min(42.0, 12.0 + (h - 12.5) / 6.5 * 24.0 + rnd.uniform(-6, 6)))
        az = ang_h + rnd.uniform(-0.3, 0.3)
        D = Vector((math.cos(E) * math.cos(az), math.cos(E) * math.sin(az), math.sin(E)))
        L = rnd.uniform(21.0, 26.0) * (1.08 - 0.25 * (math.degrees(E) - 12.0) / 26.0)
        r_split = rads[-1]
        off = Vector((rnd.uniform(-50, 50), rnd.uniform(-50, 50), 0))
        pos = pts[-1].copy()
        d = (pts[-1] - pts[-2]).normalized()
        flat = 1.0 - (math.degrees(E) - 12.0) / 30.0
        s = 0.0
        while s < L:
            f = s / L
            tgt = D + UP * (0.55 * smoothstep(0.5, 1.0, f)) - UP * (0.22 * flat * math.sin(math.pi * f))
            tgt = (tgt + nvec(pos * 0.09 + off) * 0.3).normalized()
            # gentle at first: bend radius must stay well above the limb radius
            # or the tube folds into itself at the trunk split
            rate = 0.05 + 0.11 * smoothstep(5.0, 10.0, s)
            d = (d + (tgt - d) * rate).normalized()
            pos = pos + d * 0.45
            s += 0.45
            pts.append(pos.copy())
            rads.append(r_split * (1.0 - min(s / L, 1.0)) ** 0.9 + 0.06)
        n_all = len(pts)
        sway = [0.0 if i <= i_split else 0.3 * (i - i_split) / (n_all - 1 - i_split)
                for i in range(n_all)]
        sseed = rnd.randint(0, 9999)
        groove = None
        frame_dir = None
        if k in grooved_strands:
            def frame_dir(i, p, t, _is=i_split):
                c = core_center(p.z)
                o = Vector((p.x - c.x, p.y - c.y, 0.0))
                o = o.normalized() if o.length > 1e-4 else Vector((1, 0, 0))
                w = smoothstep(_is - 5, _is + 8, i)
                return o * (1.0 - w) + UP * w
            gz0 = next(i for i, p in enumerate(pts) if p.z >= 0.6)
            gz1 = max(gz0 + 6, int(i_split - 2.5 / 0.35))
            groove = {"i0": gz0, "i1": gz1, "w_m": 0.085, "depth_m": 0.11,
                      "ember": ember, "energy": (0.5, 1.0), "chan_u": None}
        segs = 44 if groove else 36
        common = dict(tile=2.4, ridge_k=7, ridge_amp=0.075, twist=0.25, lump=0.09,
                      seed=sseed, frame_dir=frame_dir, sway=sway, uv_r=rads[0] * 0.8)
        if groove:
            groove["chan_u"] = next_chan()
        tube(trunk, pts, rads, segs, groove=groove, ring_range=(0, i_split), **common)
        # limb shares ring i_split exactly with the trunk strand -> seamless
        if groove:
            groove = dict(groove, ember=None)
        tube(branches, pts, rads, segs, groove=groove, ring_range=(i_split, n_all - 1), cap=True, **common)
        limb_pts, limb_rads = pts[i_split:], rads[i_split:]
        limbs.append((limb_pts, limb_rads, L))
        pads.append((limb_pts[-1] + UP * 0.8, rnd.uniform(3.6, 4.6), rnd.uniform(3.6, 4.6),
                     rnd.uniform(1.6, 2.3), 0))

    # ---------------- central leader ----------------
    lead_start = core_center(16.5)
    lp, lr = grow_path(lead_start, Vector((0.1, -0.05, 1.0)), 12.5, 2.0, rnd, step=0.45,
                       up_bias=0.4, wander=0.3, r_end=0.08)
    tube(branches, lp, lr, 22, tile=2.0, ridge_k=5, ridge_amp=0.06, twist=0.2, lump=0.08,
         seed=rnd.randint(0, 9999), cap=True, sway=[0.15 * i / len(lp) for i in range(len(lp))])
    limbs.append((lp, lr, 12.5))
    pads.append((lp[-1] + UP * 0.6, 3.6, 3.6, 1.8, 1))

    # ---------------- recursive branches ----------------
    def l1_len(pL, f, r):
        return pL * r.uniform(0.32, 0.5) * (1.15 - 0.5 * f) + 1.5

    def l2_len(pL, f, r):
        return pL * r.uniform(0.42, 0.62) * (1.1 - 0.4 * f) + 0.8

    n_l1 = n_l2 = 0
    for li, (pp, pr, pL) in enumerate(limbs):
        is_leader = li == len(limbs) - 1
        kids = spawn_children(pp, pr, pL, 1, rnd, count=(5, 7) if not is_leader else (5, 6),
                              f_range=(0.36, 0.95) if not is_leader else (0.3, 0.9),
                              angle=(35, 60) if not is_leader else (28, 48), len_fac=l1_len,
                              up=0.35 if not is_leader else 0.6, outward=0.3)
        for start, dirc, L1, r0, f in kids:
            p1, r1 = grow_path(start, dirc, L1, r0, rnd, step=0.5, up_bias=0.35, wander=0.35,
                               r_end=0.04, droop=0.12)
            tube(branches, p1, r1, 12, tile=1.6, ridge_k=4, ridge_amp=0.05, twist=0.3,
                 lump=0.08, seed=rnd.randint(0, 9999), cap=True,
                 sway=[0.3 + 0.3 * i / len(p1) for i in range(len(p1))])
            n_l1 += 1
            pads.append((p1[-1] + UP * 0.7, rnd.uniform(3.0, 4.2), rnd.uniform(3.0, 4.2),
                         rnd.uniform(1.4, 2.1), rnd.randint(0, 3)))
            gkids = spawn_children(p1, r1, L1, 2, rnd, count=(3, 5), angle=(30, 55),
                                   len_fac=l2_len, radius_fac=0.6, f_range=(0.3, 0.95),
                                   up=0.3, outward=0.2)
            for s2, d2, L2, r02, f2 in gkids:
                p2, r2 = grow_path(s2, d2, L2, r02, rnd, step=0.45, up_bias=0.3, wander=0.45,
                                   r_end=0.03, droop=0.1)
                tube(branches, p2, r2, 7, tile=1.0, lump=0.06, seed=rnd.randint(0, 9999),
                     cap=True, sway=[0.6 + 0.4 * i / len(p2) for i in range(len(p2))])
                n_l2 += 1
                pads.append((p2[-1] + UP * 0.5, rnd.uniform(2.3, 3.4), rnd.uniform(2.3, 3.4),
                             rnd.uniform(1.1, 1.7), rnd.randint(0, 3)))
                if rnd.random() < 0.22:
                    pm = p2[len(p2) // 2]
                    pads.append((pm + UP * 0.4, rnd.uniform(1.6, 2.3), rnd.uniform(1.6, 2.3),
                                 rnd.uniform(0.9, 1.3), rnd.randint(0, 3)))

    # ---------------- roots ----------------
    grooved_roots = {0, 2, 4, 7, 9}
    twisted_roots = {1, 5, 8}
    n_roots = 11
    for k in range(n_roots):
        az0 = k * TAU / n_roots + rnd.uniform(-0.18, 0.18)
        D = rnd.uniform(17.0, 30.0)
        r0 = rnd.uniform(1.5, 2.3)
        ph = rnd.uniform(0, TAU)
        bury = rnd.uniform(0.15, 0.6)
        hump_d = rnd.uniform(0.25, 0.5) * D if rnd.random() < 0.75 else None
        hump_h = rnd.uniform(0.6, 1.3)
        pts, rads = [], []
        for d in frange(1.2, D, 0.4):
            az = az0 + 0.28 * noise.noise(Vector((d * 0.06, k * 3.7, 1.3)))
            f = (d - 1.2) / (D - 1.2)
            r = r0 * (1.0 - f) ** 0.95 + 0.1
            z = 5.0 * math.exp(-(d - 1.2) / 3.0) + bury * r + 0.25 * math.sin(d * 0.5 + ph) * smoothstep(3, 6, d)
            if hump_d:
                z += hump_h * math.exp(-((d - hump_d) / 2.2) ** 2)
            if d > D - 5.0:
                z -= 3.0 * ((d - (D - 5.0)) / 5.0) ** 2
            pts.append(Vector((d * math.cos(az), d * math.sin(az), z)))
            rads.append(r)
        groove = None
        frame_dir = None
        if k in grooved_roots:
            def frame_dir(i, p, t):
                return UP
            gi0 = int((3.2 - 1.2) / 0.4)
            gi1 = int((0.68 * D - 1.2) / 0.4)
            groove = {"i0": gi0, "i1": gi1, "w_m": 0.09, "depth_m": 0.10, "ember": ember,
                      "energy": (0.5, 0.0), "chan_u": next_chan()}
        T, N, B, S = tube(roots, pts, rads, 32 if groove else 22, tile=2.2, ridge_k=5,
                          ridge_amp=0.05, twist=0.3, lump=0.12, seed=rnd.randint(0, 9999),
                          frame_dir=frame_dir, groove=groove, uv_r=r0 * 0.6)

        # twisted companion root wrapping around the main one
        if k in twisted_roots:
            cp, cr = [], []
            psi0 = rnd.uniform(0, TAU)
            ia = int((1.8 - 1.2) / 0.4)
            ib = int((0.72 * D - 1.2) / 0.4)
            for i in range(ia, ib):
                psi = psi0 + TAU * S[i] / 6.5
                rc = 0.42 * rads[i] + 0.05
                cp.append(pts[i] + (N[i] * math.cos(psi) + B[i] * math.sin(psi)) * ((rads[i] + rc) * 0.72))
                cr.append(rc)
            tdir = (cp[-1] - cp[-2]).normalized()
            for j in range(1, 7):
                cp.append(cp[-1] + tdir * 0.5 - UP * 0.45)
                cr.append(cr[-1] * 0.93)
            tube(roots, cp, cr, 12, tile=1.6, ridge_k=3, ridge_amp=0.05, twist=0.4, lump=0.12,
                 seed=rnd.randint(0, 9999), uv_r=cr[0])

        # secondary roots + rootlets
        for _ in range(rnd.randint(2, 4)):
            fs = rnd.uniform(0.25, 0.8)
            i = int(fs * (len(pts) - 1))
            t = T[i]
            th = Vector((t.x, t.y, 0)).normalized()
            side = 1 if rnd.random() < 0.5 else -1
            ang = side * math.radians(rnd.uniform(35, 75))
            hd = Vector((th.x * math.cos(ang) - th.y * math.sin(ang),
                         th.x * math.sin(ang) + th.y * math.cos(ang), 0.0))
            Ls = rnd.uniform(4.0, 10.0) * (1.0 - fs * 0.4)
            rs = rads[i] * rnd.uniform(0.35, 0.5)
            sb = rnd.uniform(-0.15, 0.3)
            off = Vector((rnd.uniform(-50, 50), rnd.uniform(-50, 50), 0))
            start = pts[i] - UP * (rads[i] * 0.45)   # emerge from the lower flank
            sp, sr = [start.copy()], [rs]
            pos = start.copy()
            s = 0.0
            while s < Ls:
                f = s / Ls
                w = nvec(pos * 0.15 + off)
                hd = (hd + Vector((w.x, w.y, 0)) * 0.22).normalized()
                pos = pos + hd * 0.35
                s += 0.35
                r = rs * (1.0 - min(s / Ls, 1.0)) ** 0.6 + 0.05
                ztarget = min(start.z, sb * r) + 0.15 * math.sin(s * 0.9)
                if s > Ls - 3.0:
                    ztarget -= 2.2 * ((s - (Ls - 3.0)) / 3.0) ** 1.5
                pos.z = pos.z + (ztarget - pos.z) * min(1.0, 0.12 + 0.6 * f)
                sp.append(pos.copy())
                sr.append(r)
            tube(roots, sp, sr, 10, tile=1.2, ridge_k=3, ridge_amp=0.04, twist=0.5, lump=0.14,
                 seed=rnd.randint(0, 9999), uv_r=rs, cap=True)
            for _ in range(rnd.randint(0, 2)):
                j = rnd.randint(len(sp) // 4, max(len(sp) // 4 + 1, 3 * len(sp) // 4))
                j = min(j, len(sp) - 2)
                if sp[j].z > sr[j] * 0.6:
                    continue   # only near the ground, or rootlets dangle like legs
                hd2 = (sp[j + 1] - sp[j])
                hd2.z = 0
                hd2 = hd2.normalized() if hd2.length > 1e-6 else Vector((1, 0, 0))
                a2 = math.radians(rnd.choice([-1, 1]) * rnd.uniform(40, 80))
                hd2 = Vector((hd2.x * math.cos(a2) - hd2.y * math.sin(a2),
                              hd2.x * math.sin(a2) + hd2.y * math.cos(a2), 0.0))
                rp, rr_ = [sp[j].copy()], [sr[j] * 0.45]
                pos = sp[j].copy()
                Lr = rnd.uniform(2.0, 4.0)
                s = 0.0
                while s < Lr:
                    pos = pos + hd2 * 0.3 - UP * (0.12 + 0.35 * (s / Lr))
                    s += 0.3
                    rp.append(pos.copy())
                    rr_.append(sr[j] * 0.45 * (1.0 - min(s / Lr, 1.0)) + 0.03)
                tube(roots, rp, rr_, 6, tile=0.8, lump=0.15, seed=rnd.randint(0, 9999), uv_r=rr_[0], cap=True)

    # ---------------- foliage pads ----------------
    build_foliage(foliage, pads, rnd)

    stats = {"l1": n_l1, "l2": n_l2, "pads": len(pads), "channels": chan[0]}
    return [roots, trunk, branches, foliage, ember], stats


# atlas cell -> (u0, v0); weights emerald/forest/olive/mixed
ATLAS_CELLS = [(0.0, 0.0), (0.5, 0.0), (0.0, 0.5), (0.5, 0.5)]
CELL_WEIGHTS = [0.34, 0.30, 0.14, 0.22]


def build_foliage(acc, pads, rnd):
    for (c, rx, ry, rz, bias) in pads:
        if math.hypot(c.x, c.y) < 8.0 and c.z < 27.0:
            continue   # keep the inner crown open so the trunk and limbs read
        if (rx < 2.4 and rnd.random() < 0.35) or rnd.random() < 0.12:
            continue   # small mid-branch pads thinned out -> light gaps
        rz *= 0.7      # flatter pads -> layered tiers
        rx *= 1.12
        ry *= 1.12
        _PADS.append((c.copy(), rx, ry, rz))
        phase = rnd.random()
        dist_axis = math.hypot(c.x, c.y)
        sway_base = min(1.0, 0.35 + dist_axis / 30.0 + max(0.0, c.z - 20.0) / 40.0)
        n = int(math.pi * rx * ry * 1.45) + 6
        for _ in range(n):
            # point in a flattened ellipsoid, biased to its outer shell
            while True:
                u = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
                if 0.05 < u.length <= 1.0:
                    break
            u = u.normalized() * (u.length ** 0.4)
            if u.z < -0.25:
                u.z *= 0.55
            p = c + Vector((u.x * rx, u.y * ry, u.z * rz))
            o = Vector((u.x / rx, u.y / ry, u.z / rz))
            o = (o.normalized() if o.length > 1e-6 else UP.copy()) + UP * 0.45
            o.normalize()
            # Real canopies present leaf faces to the light: most sprays face
            # out of the pad (no edge-on "X" cards), a few are random.
            jitter = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
            if rnd.random() < 0.8:
                fn = (o + jitter * 0.45).normalized()
            else:
                fn = jitter.normalized() if jitter.length > 1e-3 else o.copy()
            # stem -> tip runs away from the pad centre, along the card plane
            tdir = (p - c)
            tdir.z *= 0.3
            tdir = tdir + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.3, 0.6))) * 1.2
            tdir = tdir - fn * tdir.dot(fn)
            if tdir.length < 1e-4:
                tdir = fn.orthogonal()
            tdir.normalize()
            side = tdir.cross(fn).normalized()
            size = rnd.uniform(1.25, 1.95)
            cup = rnd.uniform(0.1, 0.22) * size      # sprays cup toward the light
            curl = rnd.uniform(0.05, 0.16) * size    # and droop at the tip
            # choose atlas cell
            if rnd.random() < 0.55 and bias is not None:
                cell = bias
            else:
                x = rnd.random()
                acc_w = 0.0
                cell = 3
                for ci, w in enumerate(CELL_WEIGHTS):
                    acc_w += w
                    if x <= acc_w:
                        cell = ci
                        break
            cu, cv = ATLAS_CELLS[cell]
            m = 0.004
            b0 = p - tdir * size * 0.3
            grid = {}
            for gu in (0, 1, 2):
                for gv in (0, 1):
                    su = gu / 2.0 - 0.5
                    co = (b0 + side * su * size + tdir * gv * size
                          + fn * (cup * (2 * su) ** 2 - curl * gv))
                    nv = Vector(((co.x - c.x) / rx, (co.y - c.y) / ry, (co.z - c.z) / rz))
                    nv = (nv.normalized() if nv.length > 1e-6 else UP.copy()) + UP * 0.5
                    nrm = (nv.normalized() * 0.55 + fn * 0.45).normalized()
                    sw = sway_base * (1.0 if gv else 0.75)
                    grid[(gu, gv)] = acc.vert(co, nrm=nrm, _sway=sw, _phase=phase)
            us = [cu + m, cu + 0.25, cu + 0.5 - m]
            vs = [cv + m, cv + 0.5 - m]
            for gu in (0, 1):
                acc.face((grid[(gu, 0)], grid[(gu + 1, 0)], grid[(gu + 1, 1)], grid[(gu, 1)]),
                         [(us[gu], vs[0]), (us[gu + 1], vs[0]), (us[gu + 1], vs[1]), (us[gu], vs[1])])


# --------------------------------------------------------------------------
# materials
# --------------------------------------------------------------------------

def gltf_settings_group():
    g = bpy.data.node_groups.get("glTF Material Output")
    if g is None:
        g = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        g.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
        g.interface.new_socket("Thickness", in_out="INPUT", socket_type="NodeSocketFloat")
    return g


def load_image(path, non_color=False):
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def new_material(name):
    m = bpy.data.materials.get(name)
    if m is not None:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    return m, nt, bsdf, out


def bark_material(name, imgs):
    m, nt, bsdf, out = new_material(name)
    N, L = nt.nodes, nt.links
    tc = N.new("ShaderNodeTexImage"); tc.image = imgs["bc"]; tc.location = (-700, 300)
    tn = N.new("ShaderNodeTexImage"); tn.image = imgs["n"]; tn.location = (-700, -300)
    to = N.new("ShaderNodeTexImage"); to.image = imgs["orm"]; to.location = (-700, 0)
    nm = N.new("ShaderNodeNormalMap"); nm.location = (-350, -300)
    sep = N.new("ShaderNodeSeparateColor"); sep.location = (-400, 0)
    L.new(tc.outputs["Color"], bsdf.inputs["Base Color"])
    L.new(tn.outputs["Color"], nm.inputs["Color"])
    L.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    L.new(to.outputs["Color"], sep.inputs["Color"])
    L.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    L.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    g = N.new("ShaderNodeGroup"); g.node_tree = gltf_settings_group(); g.location = (-100, -500)
    L.new(sep.outputs["Red"], g.inputs["Occlusion"])
    m.use_backface_culling = True   # closed tubes -> single-sided in glTF
    return m


def leaf_material(img, nimg):
    m, nt, bsdf, out = new_material("YGG_Leaves")
    N, L = nt.nodes, nt.links
    t = N.new("ShaderNodeTexImage"); t.image = img; t.location = (-600, 200)
    rnd = N.new("ShaderNodeMath"); rnd.operation = "ROUND"; rnd.location = (-300, 0)
    tn = N.new("ShaderNodeTexImage"); tn.image = nimg; tn.location = (-600, -250)
    nm = N.new("ShaderNodeNormalMap"); nm.location = (-300, -250)
    L.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    L.new(t.outputs["Alpha"], rnd.inputs[0])
    L.new(rnd.outputs[0], bsdf.inputs["Alpha"])
    L.new(tn.outputs["Color"], nm.inputs["Color"])
    L.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.58  # waxy, but no mirror-like sky sheen
    bsdf.inputs["Specular IOR Level"].default_value = 0.35
    m.use_backface_culling = False
    try:
        m.surface_render_method = "DITHERED"
    except Exception:
        pass
    return m


def ember_material():
    m, nt, bsdf, out = new_material("YGG_EmberChannel")
    bsdf.inputs["Base Color"].default_value = (0.05, 0.028, 0.015, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.45
    bsdf.inputs["Emission Color"].default_value = (1.0, 0.36, 0.05, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 1.0
    m.use_backface_culling = True
    return m


# --------------------------------------------------------------------------
# objects / collections
# --------------------------------------------------------------------------

def make_object(acc, coll, mat, parent):
    old = bpy.data.objects.get(acc.name)
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    oldm = bpy.data.meshes.get(acc.name)
    if oldm is not None:
        bpy.data.meshes.remove(oldm)
    me = bpy.data.meshes.new(acc.name)
    me.from_pydata(acc.co, [], acc.faces)
    uvl = me.uv_layers.new(name="UVMap")
    flat = [c for uv in acc.uv for c in uv]
    uvl.data.foreach_set("uv", flat)
    if acc.uv2 is not None:
        uv2 = me.uv_layers.new(name="EnergyUV")
        uv2.data.foreach_set("uv", [c for uv in acc.uv2 for c in uv])
    for k, vals in acc.attrs.items():
        a = me.attributes.new(k, "FLOAT", "POINT")
        a.data.foreach_set("value", vals)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    if acc.normals is not None:
        me.normals_split_custom_set_from_vertices(acc.normals)
    me.update()
    me.materials.append(mat)
    ob = bpy.data.objects.new(acc.name, me)
    coll.objects.link(ob)
    ob.parent = parent
    return ob


def stitch_normals(ob_a, ob_b, eps=1e-4):
    """Trunk strands and limbs share their split ring but live in different
    objects; average the one-sided vertex normals there so no seam shows."""
    from mathutils import kdtree
    me_a, me_b = ob_a.data, ob_b.data
    kd = kdtree.KDTree(len(me_a.vertices))
    for v in me_a.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    n_a = [v.normal.copy() for v in me_a.vertices]
    n_b = [v.normal.copy() for v in me_b.vertices]
    shared = 0
    for v in me_b.vertices:
        _co, idx, dist = kd.find(v.co)
        if dist is not None and dist < eps:
            n = (n_a[idx] + n_b[v.index]).normalized()
            n_a[idx] = n
            n_b[v.index] = n
            shared += 1
    me_a.normals_split_custom_set_from_vertices(n_a)
    me_b.normals_split_custom_set_from_vertices(n_b)
    return shared


def ensure_collection(name, parent):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
    if c.name not in parent.children:
        parent.children.link(c)
    return c


def build(tex_dir, seed=22, target_height=40.0):
    import os
    import time
    t0 = time.time()
    scene = bpy.context.scene
    root_coll = bpy.data.collections.get("Yggdrasil")
    if root_coll is None:
        root_coll = bpy.data.collections.new("Yggdrasil")
        scene.collection.children.link(root_coll)

    accs, stats = build_geometry(seed)
    # uniform scale so the crown tops out exactly at target_height metres
    top = max(c[2] for c in accs[3].co)
    k = target_height / top
    for acc in accs:
        acc.co = [(x * k, y * k, z * k) for (x, y, z) in acc.co]
    stats["scale"] = round(k, 4)
    t1 = time.time()

    imgs = {
        "bc": load_image(os.path.join(tex_dir, "bark_basecolor.jpg")),
        "n": load_image(os.path.join(tex_dir, "bark_normal.jpg"), True),
        "orm": load_image(os.path.join(tex_dir, "bark_orm.jpg"), True),
    }
    leaf_img = load_image(os.path.join(tex_dir, "leaf_atlas.png"))
    leaf_nrm = load_image(os.path.join(tex_dir, "leaf_normal.jpg"), True)
    for im in (leaf_img, leaf_nrm):
        im.reload()
    mats = {
        "YGG_Roots": bark_material("YGG_Root_Bark", imgs),
        "YGG_Trunk": bark_material("YGG_Trunk_Bark", imgs),
        "YGG_Branches": bark_material("YGG_Branch_Bark", imgs),
        "YGG_Foliage": leaf_material(leaf_img, leaf_nrm),
        "YGG_EmberChannels": ember_material(),
    }

    old = bpy.data.objects.get("Yggdrasil")
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    empty = bpy.data.objects.new("Yggdrasil", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 3.0
    root_coll.objects.link(empty)

    report = {}
    for acc in accs:
        coll = ensure_collection(acc.name, root_coll)
        ob = make_object(acc, coll, mats[acc.name], empty)
        report[acc.name] = {"verts": len(acc.co), "tris": acc.tris}
    stitch_normals(bpy.data.objects["YGG_Trunk"], bpy.data.objects["YGG_Branches"])
    report["_stats"] = stats
    report["_time"] = (round(t1 - t0, 1), round(time.time() - t1, 1))
    return report
