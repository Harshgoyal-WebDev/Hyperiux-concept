"""Yggdrasil - light-strand variant.

A world tree woven from glowing filaments plus glowing amber leaves, built on
the exact skeleton of the realistic tree (same seed and scale) so both assets
line up when swapped.

Objects (collection "YggdrasilStrands", root empty "YggdrasilStrands"):

  YGG_StrandRoots    filaments running through every root, companion and rootlet
  YGG_StrandTrunk    dense twisting bundle through the trunk core + 7 strands
  YGG_StrandBranches threads splitting into every limb and branch
  YGG_StrandCanopy   fading light-wisps fanning out where the foliage pads were
  YGG_StrandLeaves   glowing amber leaf sprays: the realistic tree's foliage
                     cards (same positions) with a baked amber light atlas

Each filament is either a "core" strand (3-sided tube, 5-10 cm radius) or a
"fine" thread (a twisting ribbon 3-6 cm wide, never fully edge-on).

Per-vertex data (all objects):
  COLOR_0   linear RGB: Hyperiux orange heat ramp x brightness (dim at tips)
  uv        u = across the strand (0..1), v = global flow coordinate
  _flow     same flow coordinate: 0 at root tips -> 0.5 trunk base -> 1 at
            canopy wisp tips. Animate pulses as a band on (_flow - time).
  _seed     random 0..1 per filament (desynchronise flicker / pulses)

Material YGG_Strand is unlit (KHR_materials_unlit) and double-sided; in
three.js set blending = AdditiveBlending, depthWrite = false, and push
material.color above 1 (or use bloom) for the glow.

Usage in Blender:
    bg = {...exec ygg_build.py...}; exec(this); build_strands(bg)
"""

import math
import random
import bpy
from mathutils import Vector, noise

UP = Vector((0.0, 0.0, 1.0))
DEEP = Vector((0.80, 0.13, 0.015))
BRAND = Vector((1.0, 0.36, 0.05))
HOT = Vector((1.0, 0.70, 0.36))

KIND_OBJ = {"YGG_Roots": "YGG_StrandRoots", "YGG_Trunk": "YGG_StrandTrunk",
            "YGG_Branches": "YGG_StrandBranches"}


def nvec(p):
    """Deterministic noise vector (noise.noise_vector changes per Blender launch)."""
    p = Vector(p)
    return Vector((noise.noise(p), noise.noise(p + Vector((31.4, 17.2, -9.7))),
                   noise.noise(p + Vector((-23.1, 41.7, 12.9)))))


def heat_color(t):
    t = max(0.0, min(1.0, t))
    if t < 0.5:
        return DEEP.lerp(BRAND, t / 0.5)
    return BRAND.lerp(HOT, (t - 0.5) / 0.5)


class StrandAcc:
    def __init__(self, name):
        self.name = name
        self.co, self.col, self.u, self.flow_raw, self.root, self.seed = [], [], [], [], [], []
        self.faces = []

    def vert(self, p, col, u, is_root, sd):
        self.co.append((p.x, p.y, p.z))
        self.col.append((col.x, col.y, col.z))
        self.u.append(u)
        d = math.hypot(p.x, p.y)
        self.flow_raw.append(d if is_root else p.z + 0.45 * d)
        self.root.append(is_root)
        self.seed.append(sd)
        return len(self.co) - 1

    @property
    def tris(self):
        return sum(len(f) - 2 for f in self.faces)


def emit_strand(acc, path, core, width, col_fn, is_root, sd, phi0):
    """path: list of (point, frameN, frameB, tangent, brightness, heat)."""
    rows = []
    for k, (p, N, B, T, bri, heat) in enumerate(path):
        col = heat_color(heat) * bri
        if core:
            ring = []
            for j in range(3):
                a = phi0 + j * math.tau / 3
                ring.append(acc.vert(p + (N * math.cos(a) + B * math.sin(a)) * width, col, j / 3, is_root, sd))
            rows.append(ring)
        else:
            a = phi0 + 1.7 * k * 0.5
            w = (N * math.cos(a) + B * math.sin(a)) * width
            rows.append([acc.vert(p - w, col, 0.0, is_root, sd), acc.vert(p + w, col, 1.0, is_root, sd)])
    for k in range(len(rows) - 1):
        r0, r1 = rows[k], rows[k + 1]
        if core:
            for j in range(3):
                jn = (j + 1) % 3
                acc.faces.append((r0[j], r0[jn], r1[jn], r1[j]))
        else:
            acc.faces.append((r0[0], r0[1], r1[1], r1[0]))


def build_skeleton(bg, seed, target_height):
    accs, _stats = bg["build_geometry"](seed)
    top = max(c[2] for c in accs[3].co)
    k = target_height / top
    skel = []
    stable = {}
    for name, pts, radii, i0, i1, key in bg["_SKEL"]:
        key = stable.setdefault(key, len(stable) + 1)   # id() differs per run
        skel.append((name, [p * k for p in pts], [r * k for r in radii], i0, i1, key))
    pads = [(c * k, rx * k, ry * k, rz * k) for (c, rx, ry, rz) in bg["_PADS"]]
    bg["_LEAF_ACC"] = (accs[3], k)   # YGG_Foliage cards, for the glowing-leaf layer
    return skel, pads, k


def build_strands(bg, seed=22, target_height=40.0, k_core=3.5, k_fine=30.0, wisp_density=0.2,
                  twig_spacing=1.4, branch_density=1.4):
    """branch_density multiplies the thread count of every branch path (and of
    the trunk half of the 7 limb strands, so threads stay continuous through the
    split) and the number of peel-off twig threads along branches."""
    frames = bg["frames"]
    arclen = bg["arclen"]
    accs = {n: StrandAcc(n) for n in ("YGG_StrandRoots", "YGG_StrandTrunk",
                                      "YGG_StrandBranches", "YGG_StrandCanopy")}
    skel, pads, scale = build_skeleton(bg, seed, target_height)
    counts = {"core": 0, "fine": 0, "twig": 0, "wisp": 0}
    branch_keys = {key for name, *_rest, key in skel if name == "YGG_Branches"}

    # ---------- filaments along every skeleton path ----------
    for name, pts, radii, i0, i1, key in skel:
        is_root = name == "YGG_Roots"
        acc = accs[KIND_OBJ[name]]
        n = len(pts)
        T, N, B = frames(pts)
        S = arclen(pts)
        spacing = S[-1] / max(n - 1, 1)
        step = max(1, int(round(0.55 / max(spacing, 1e-3))))
        idx = list(range(i0, i1 + 1, step))
        if idx[-1] != i1:
            idx.append(i1)
        # same count / params for both halves of a split strand -> continuous
        r_ref = radii[n // 3]
        prng = random.Random(key * 7919 + seed)
        bmul = branch_density if key in branch_keys else 1.0
        for style, K in (("core", k_core), ("fine", k_fine)):
            want = K * r_ref ** 1.5 * bmul
            cnt = int(want) + (1 if prng.random() < want - int(want) else 0)
            if style == "fine":
                # even the thinnest twig is a small bundle
                cnt = max(cnt, 2 if is_root else int(round(3 * bmul)))
            for f in range(cnt):
                r = random.Random(key * 100003 + f * 31 + (0 if style == "core" else 17))
                th0 = r.uniform(0, math.tau)
                rho = math.sqrt(r.random()) * 0.92
                twist = r.uniform(0.05, 0.16) * (1 if r.random() < 0.7 else -1)
                wob = r.uniform(0, 500)
                temp = r.random()
                bri0 = r.uniform(0.5, 1.0)
                width = r.uniform(0.05, 0.10) if style == "core" else r.uniform(0.015, 0.03)
                phi0 = r.uniform(0, math.tau)
                sd = r.random()
                path = []
                for i in idx:
                    s = S[i]
                    th = th0 + twist * s + 0.35 * noise.noise(Vector((s * 0.12, wob, 0.0)))
                    rr = rho * radii[i] * (1.0 + 0.15 * noise.noise(Vector((s * 0.25, wob, 5.0))))
                    p = pts[i] + (N[i] * math.cos(th) + B[i] * math.sin(th)) * rr
                    fpath = i / (n - 1)
                    if is_root:
                        bri = bri0 * (0.2 + 0.8 * (1.0 - fpath) ** 0.8)
                    else:
                        bri = bri0 * (1.0 - 0.35 * fpath)
                    d = math.hypot(p.x, p.y)
                    heat = 0.55 * temp + 0.45 * math.exp(-d / 9.0) + (0.1 if style == "core" else 0.0)
                    path.append((p, N[i], B[i], T[i], bri, heat))
                if len(path) >= 2:
                    emit_strand(acc, path, style == "core", width, None, is_root, sd, phi0)
                    counts[style] += 1

    # ---------- peel-off twig threads (denser branching, same skeleton) ----------
    tr = random.Random(seed * 13 + 5)

    def trail(acc, p, d, L, segs, width, bri0, heat, gravity, rise, is_root):
        wob = tr.uniform(0, 500)
        phi0 = tr.uniform(0, math.tau)
        sd = tr.random()
        path = []
        for sgi in range(segs + 1):
            t = sgi / segs
            ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
            Nn = (ref - d * ref.dot(d)).normalized()
            Bn = d.cross(Nn)
            bri = bri0 * (1.0 - t) ** 1.1
            path.append((p.copy(), Nn, Bn, d.copy(), bri, heat))
            nv = nvec(Vector((wob, t * 1.1, 7.0)))
            d = (d + UP * (rise - gravity * t) + Vector((nv[0], nv[1], nv[2])) * 0.08).normalized()
            p = p + d * (L / segs)
        emit_strand(acc, path, False, width, None, is_root, sd, phi0)
        counts["twig"] += 1

    for name, pts, radii, i0, i1, key in skel:
        if name == "YGG_Trunk" or len(pts) < 4:
            continue
        is_root = name == "YGG_Roots"
        acc = accs[KIND_OBJ[name]]
        T, N, B = frames(pts)
        S = arclen(pts)
        lo = S[i0] + (S[i1] - S[i0]) * (0.25 if not is_root else 0.2)
        hi = S[i0] + (S[i1] - S[i0]) * (0.97 if not is_root else 0.75)
        spacing = twig_spacing / branch_density if not is_root else twig_spacing * 1.8
        s = lo + tr.uniform(0, spacing)
        while s < hi:
            i = min(range(i0, i1 + 1), key=lambda j: abs(S[j] - s))
            for _ in range(1 if tr.random() < 0.6 else 2):
                a = tr.uniform(0, math.tau)
                radial = N[i] * math.cos(a) + B[i] * math.sin(a)
                beta = math.radians(tr.uniform(22, 55))
                d = T[i] * math.cos(beta) + radial * math.sin(beta)
                if is_root:
                    d = Vector((d.x, d.y, min(d.z, 0.0) - 0.15)).normalized()
                    trail(acc, pts[i] + radial * radii[i] * 0.7, d, tr.uniform(1.0, 3.0), 8,
                          tr.uniform(0.010, 0.02), tr.uniform(0.3, 0.7), 0.2 + 0.3 * tr.random(),
                          0.25, 0.0, True)
                else:
                    d = (d + UP * 0.25).normalized()
                    trail(acc, pts[i] + radial * radii[i] * 0.7, d, tr.uniform(1.5, 4.0), 10,
                          tr.uniform(0.010, 0.022), tr.uniform(0.45, 0.95), 0.3 + 0.35 * tr.random(),
                          0.12, 0.03, False)
            s += spacing * tr.uniform(0.6, 1.4)

    # ---------- canopy light-wisps ----------
    # Fountain-like fans grow out of every branch tip, continuing its
    # direction and arcing outward and down; a lighter haze of shorter wisps
    # fills the old foliage pads so the crown keeps its layered silhouette.
    wr = random.Random(seed * 7 + 3)
    can = accs["YGG_StrandCanopy"]

    def wisp(p, d, L, segs, width, bri0, heat, gravity, curl):
        wob = wr.uniform(0, 500)
        phi0 = wr.uniform(0, math.tau)
        sd = wr.random()
        outward = Vector((p.x, p.y, 0.0))
        outward = outward.normalized() if outward.length > 1e-3 else Vector((1, 0, 0))
        path = []
        for sgi in range(segs + 1):
            t = sgi / segs
            ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
            Nn = (ref - d * ref.dot(d)).normalized()
            Bn = d.cross(Nn)
            bri = bri0 * (1.0 - t) ** 1.2 * (0.6 + 0.4 * min(1.0, t * 6.0))
            path.append((p.copy(), Nn, Bn, d.copy(), bri, heat))
            nv = nvec(Vector((wob, t * 0.9, 2.0)))
            d = (d + outward * (0.05 * curl) - UP * (gravity * t)
                 + Vector((nv[0], nv[1], nv[2])) * 0.06).normalized()
            p = p + d * (L / segs)
        emit_strand(can, path, False, width, None, False, sd, phi0)
        counts["wisp"] += 1

    for name, pts, radii, i0, i1, key in skel:
        if name != "YGG_Branches" or i1 != len(pts) - 1 or len(pts) < 3:
            continue
        tip = pts[-1]
        T = (pts[-1] - pts[-3]).normalized()
        thick = radii[0]
        fan = int(11 + 13 * min(1.0, thick / 0.6))
        ref = Vector((0, 0, 1)) if abs(T.z) < 0.9 else Vector((1, 0, 0))
        Nn = (ref - T * ref.dot(T)).normalized()
        Bn = T.cross(Nn)
        for _ in range(fan):
            a = wr.uniform(0, math.tau)
            spread = math.radians(wr.uniform(8, 42))
            d = (T * math.cos(spread) + (Nn * math.cos(a) + Bn * math.sin(a)) * math.sin(spread)
                 + UP * 0.04).normalized()
            wisp(tip + Vector((wr.uniform(-.2, .2), wr.uniform(-.2, .2), wr.uniform(-.2, .2))), d,
                 wr.uniform(3.0, 6.5), 14, wr.uniform(0.010, 0.022), wr.uniform(0.45, 1.0),
                 0.25 + 0.35 * wr.random(), wr.uniform(0.09, 0.2), wr.uniform(0.3, 1.0))

    for (c, rx, ry, rz) in pads:
        m = int(math.pi * rx * ry * wisp_density) + 2
        outward = Vector((c.x, c.y, 0.0))
        outward = outward.normalized() if outward.length > 1e-3 else Vector((1, 0, 0))
        for _ in range(m):
            u = Vector((wr.uniform(-1, 1), wr.uniform(-1, 1), wr.uniform(-1, 1)))
            if u.length > 1.0:
                u.normalize()
            p = c + Vector((u.x * rx * 0.6, u.y * ry * 0.6, u.z * rz * 0.5))
            d = (outward * 0.9 + UP * 0.35 + Vector((wr.uniform(-1, 1), wr.uniform(-1, 1), wr.uniform(-0.4, 0.6))) * 0.6).normalized()
            wisp(p, d, wr.uniform(2.0, 4.5), 10, wr.uniform(0.008, 0.016), wr.uniform(0.3, 0.7),
                 0.2 + 0.3 * wr.random(), wr.uniform(0.06, 0.14), 1.0)

    # ---------- normalise flow:  roots 0..0.5, tree 0.5..1 ----------
    rmax = max((v for a in accs.values() for v, rt in zip(a.flow_raw, a.root) if rt), default=1.0)
    tmax = max((v for a in accs.values() for v, rt in zip(a.flow_raw, a.root) if not rt), default=1.0)
    for a in accs.values():
        a.flow = [0.5 * (1.0 - min(v / rmax, 1.0)) if rt else 0.5 + 0.5 * min(max(v, 0.0) / tmax, 1.0)
                  for v, rt in zip(a.flow_raw, a.root)]
    return accs, counts, scale


# --------------------------------------------------------------------------
# Blender objects / material
# --------------------------------------------------------------------------

def strand_material():
    name = "YGG_Strand"
    m = bpy.data.materials.get(name)
    if m is not None:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        if nd.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(nd)
    out = next(nd for nd in nt.nodes if nd.type == "OUTPUT_MATERIAL")
    ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "Col"; ca.location = (-500, 0)
    bgn = nt.nodes.new("ShaderNodeBackground"); bgn.location = (-250, 0)
    bgn.inputs["Strength"].default_value = 1.0
    nt.links.new(ca.outputs["Color"], bgn.inputs["Color"])
    nt.links.new(bgn.outputs["Background"], out.inputs["Surface"])
    m.use_backface_culling = False
    return m


def make_strand_object(acc, coll, mat, parent):
    for old in (bpy.data.objects.get(acc.name),):
        if old is not None:
            bpy.data.objects.remove(old, do_unlink=True)
    oldm = bpy.data.meshes.get(acc.name)
    if oldm is not None:
        bpy.data.meshes.remove(oldm)
    me = bpy.data.meshes.new(acc.name)
    me.from_pydata(acc.co, [], acc.faces)
    uvl = me.uv_layers.new(name="UVMap")
    uvs = []
    for f in acc.faces:
        for vi in f:
            uvs.extend((acc.u[vi], acc.flow[vi]))
    uvl.data.foreach_set("uv", uvs)
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    col.data.foreach_set("color", [c for rgb in acc.col for c in (*rgb, 1.0)])
    me.color_attributes.active_color = col
    me.attributes.new("_flow", "FLOAT", "POINT").data.foreach_set("value", acc.flow)
    me.attributes.new("_seed", "FLOAT", "POINT").data.foreach_set("value", acc.seed)
    me.update()
    me.materials.append(mat)
    ob = bpy.data.objects.new(acc.name, me)
    coll.objects.link(ob)
    ob.parent = parent
    return ob


# --------------------------------------------------------------------------
# glowing amber leaves
# --------------------------------------------------------------------------

# heat ramp in display (sRGB-encoded) values: dark ember -> brand -> hot amber
_LEAF_RAMP = ((0.00, (0.20, 0.035, 0.008)), (0.45, (0.80, 0.27, 0.04)),
              (0.80, (1.00, 0.45, 0.09)), (1.00, (1.00, 0.74, 0.42)))


def bake_glow_leaf_atlas(src_path, out_path, size=1024, gain=0.55, contrast=1.35):
    """Recolour the green leaf atlas into amber light, keeping its alpha.

    Leaf structure (veins, cast shadows, per-leaf shading) comes from the
    atlas luminance and is mapped through the Hyperiux heat ramp.
    """
    import numpy as np
    src = bpy.data.images.load(src_path, check_existing=False)
    w, h = src.size
    px = np.empty(w * h * 4, np.float32)
    src.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    a = px[..., 3]
    lum = px[..., 0] * 0.2126 + px[..., 1] * 0.7152 + px[..., 2] * 0.0722
    on = a > 0.5
    lo, hi = np.percentile(lum[on], 3), np.percentile(lum[on], 99.5)
    t = np.clip((lum - lo) / max(hi - lo, 1e-6), 0.0, 1.0) ** contrast
    xs = np.array([k for k, _ in _LEAF_RAMP], np.float32)
    rgb = np.stack([np.interp(t, xs, [c[i] for _, c in _LEAF_RAMP]) for i in range(3)], -1)
    rgb = np.clip(rgb * gain, 0.0, 1.0)
    # transparent texels take the mean leaf colour so filtering leaves no dark fringe
    rgb[~on] = rgb[on].mean(0)
    out = np.concatenate([rgb, a[..., None]], -1).astype(np.float32)
    dst = bpy.data.images.new("leaf_glow_atlas", w, h, alpha=True)
    dst.pixels.foreach_set(out.ravel())
    if size and size != w:
        dst.scale(size, size)
    dst.filepath_raw = out_path
    dst.file_format = "PNG"
    dst.save()
    bpy.data.images.remove(dst)
    bpy.data.images.remove(src)
    img = bpy.data.images.load(out_path, check_existing=True)
    img.reload()
    return img


def glow_leaf_material(img):
    """Unlit, alpha-masked amber leaves (exports as KHR_materials_unlit + MASK)."""
    name = "YGG_GlowLeaves"
    m = bpy.data.materials.get(name)
    if m is not None:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        if nd.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(nd)
    out = next(nd for nd in nt.nodes if nd.type == "OUTPUT_MATERIAL")
    N, L = nt.nodes, nt.links
    t = N.new("ShaderNodeTexImage"); t.image = img; t.location = (-700, 0)
    rnd = N.new("ShaderNodeMath"); rnd.operation = "ROUND"; rnd.location = (-400, 200)
    tr = N.new("ShaderNodeBsdfTransparent"); tr.location = (-400, 50)
    # Emission behind a camera-ray light-path mix: the glTF exporter reads this
    # as unlit AND keeps the transparent mix as alpha (a Background node would
    # short-circuit its alpha detection).
    em = N.new("ShaderNodeEmission"); em.location = (-400, -150)
    em.inputs["Strength"].default_value = 1.0
    lp = N.new("ShaderNodeLightPath"); lp.location = (-650, -350)
    cam = N.new("ShaderNodeMixShader"); cam.location = (-200, -150)
    mix = N.new("ShaderNodeMixShader"); mix.location = (-50, 0)
    L.new(t.outputs["Color"], em.inputs["Color"])
    L.new(lp.outputs["Is Camera Ray"], cam.inputs[0])
    L.new(em.outputs[0], cam.inputs[2])
    L.new(t.outputs["Alpha"], rnd.inputs[0])
    L.new(rnd.outputs[0], mix.inputs[0])
    L.new(tr.outputs[0], mix.inputs[1])
    L.new(cam.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs["Surface"])
    m.use_backface_culling = False
    try:
        m.surface_render_method = "DITHERED"
    except Exception:
        pass
    return m


def make_leaf_object(bg, coll, parent, tex_dir, atlas_size=1024):
    import os
    leaf, k = bg["_LEAF_ACC"]
    leaf.name = "YGG_StrandLeaves"
    leaf.co = [(x * k, y * k, z * k) for (x, y, z) in leaf.co]
    # same pulse attributes as the strands: leaves sit at the top of the flow
    sway = leaf.attrs["_sway"]
    leaf.attrs["_flow"] = [0.88 + 0.12 * min(1.0, s) for s in sway]
    leaf.attrs["_seed"] = list(leaf.attrs["_phase"])
    leaf.normals = None   # unlit: normals carry no information
    img = bake_glow_leaf_atlas(os.path.join(tex_dir, "leaf_atlas.png"),
                               os.path.join(tex_dir, "leaf_glow_atlas.png"), atlas_size)
    ob = bg["make_object"](leaf, coll, glow_leaf_material(img), parent)
    return ob, leaf


def build(bg, seed=22, target_height=40.0, leaves=False, tex_dir=None, **kw):
    import time
    t0 = time.time()
    scene = bpy.context.scene
    root = bpy.data.collections.get("YggdrasilStrands")
    if root is None:
        root = bpy.data.collections.new("YggdrasilStrands")
        scene.collection.children.link(root)
    accs, counts, scale = build_strands(bg, seed, target_height, **kw)
    mat = strand_material()
    old = bpy.data.objects.get("YggdrasilStrands")
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    empty = bpy.data.objects.new("YggdrasilStrands", None)
    empty.empty_display_size = 3.0
    root.objects.link(empty)
    report = {}
    for name, acc in accs.items():
        c = bpy.data.collections.get(name)
        if c is None:
            c = bpy.data.collections.new(name)
            root.children.link(c)
        make_strand_object(acc, c, mat, empty)
        report[name] = {"verts": len(acc.co), "tris": acc.tris}
    if leaves:
        c = bpy.data.collections.get("YGG_StrandLeaves")
        if c is None:
            c = bpy.data.collections.new("YGG_StrandLeaves")
            root.children.link(c)
        _ob, leaf = make_leaf_object(bg, c, empty, tex_dir)
        report["YGG_StrandLeaves"] = {"verts": len(leaf.co), "tris": leaf.tris}
    report["_counts"] = counts
    report["_scale"] = round(scale, 4)
    report["_time"] = round(time.time() - t0, 1)
    return report
