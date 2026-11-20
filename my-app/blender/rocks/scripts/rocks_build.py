"""Hyperiux desert / valley boulder set -> public/models/rocks.glb

Six water-worn sandstone/granite boulders (riverbed stones): broad smooth
planes, a few chipped facets, subtle cracks and pitting, warm grey-brown
(#6b5a4b) with lighter weathered tops and faint olive moss/lichen in
crevices and on upward faces.

Pipeline (all procedural, deterministic per seed):
  1. high-poly "sculpt": icosphere -> ellipsoid + low-frequency lumps ->
     soft planar cuts (water-worn facets, a sheared face, flattened top/base)
     -> fitted to exact real-world size -> fine detail along the normal
     (bumps, pitting, voronoi cracks)
  2. game mesh: decimated copy of the high-poly at the triangle budget,
     weighted (face-area) custom normals, smooth shading
  3. one 2048 atlas for all six rocks: UVs averaged to one texel density
     and packed without overlap
  4. Cycles bake high -> low: tangent-space normal (OpenGL, +Y green),
     ambient occlusion (with a ground plane at z = 0 for contact shadow),
     base colour, roughness; AO + roughness packed into ORM (R AO, G rough,
     B metal = 0)
  5. glTF export: the six low meshes only, +Y up, JPEG 85, Draco level 6

Blender is Z-up while building; the exporter writes +Y up. Every rock's
origin is the centre of its base on the ground (z = 0 here, y = 0 in glTF);
the mesh continues ~30 % of its height below the ground as a buried skirt.

Usage (Blender 4.2+ / 5.x):
    g = {"__name__": "rocks_build"}; exec(compile(open(p).read(), p, "exec"), g)
    g["build_all"](root)          # meshes + UVs + materials
    g["bake_all"](root)           # textures
    g["export"](root)             # (separate call) public/models/rocks.glb
"""

import math
import os
import random

import bmesh
import bpy
from mathutils import Vector, noise

# --------------------------------------------------------------------------
# specs
# --------------------------------------------------------------------------
# W = width (x), D = depth (y), H = height above ground. Skirt = 0.3 * H below.
SPECS = [
    dict(name="rock_01", W=3.0, D=2.35, H=1.6, seed=11, subdiv=7, tris=2600,
         lumps=0.04, facets=6, facet_soft=0.05, top_flat=0.8, boxy=0.0),
    dict(name="rock_02", W=2.5, D=2.15, H=2.0, seed=23, subdiv=7, tris=2700,
         lumps=0.045, facets=5, facet_soft=0.05, top_flat=None, boxy=0.12,
         shear=dict(n=(0.82, -0.45, 0.10), at=0.66, soft=0.02)),
    dict(name="rock_03", W=1.4, D=1.1, H=0.8, seed=37, subdiv=6, tris=1000,
         lumps=0.04, facets=5, facet_soft=0.06, top_flat=0.72, boxy=0.0),
    dict(name="rock_04", W=1.2, D=1.05, H=1.0, seed=41, subdiv=6, tris=1000,
         lumps=0.035, facets=4, facet_soft=0.09, top_flat=None, boxy=0.0),
    dict(name="rock_05", W=0.6, D=0.47, H=0.35, seed=53, subdiv=5, tris=360,
         lumps=0.04, facets=4, facet_soft=0.07, top_flat=0.8, boxy=0.0),
    dict(name="rock_06", W=0.3, D=0.22, H=0.075, seed=67, subdiv=4, tris=330,
         cluster=True),
]

ATLAS = 2048
SKIRT = 0.30
BASE_HEX = (0x6B, 0x5A, 0x4B)


def srgb_to_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


BASE_LIN = tuple(srgb_to_lin(c) for c in BASE_HEX)


# --------------------------------------------------------------------------
# noise helpers (mathutils.noise.noise / voronoi only: deterministic)
# --------------------------------------------------------------------------

def fbm(p, octaves=4, lac=2.0, gain=0.5):
    s, a, f = 0.0, 1.0, 1.0
    for _ in range(octaves):
        s += a * noise.noise(p * f)
        a *= gain
        f *= lac
    return s


def smin(a, b, k):
    """Smooth minimum (soft planar cut -> water-worn rounded edges)."""
    if k <= 1e-6:
        return min(a, b)
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# --------------------------------------------------------------------------
# 1. high-poly
# --------------------------------------------------------------------------

def _icosphere(name, subdiv):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    bm.to_mesh(me)
    bm.free()
    return me


def _shape_boulder(co, spec):
    """co: list of unit-sphere Vectors -> list of shaped Vectors (unfitted)."""
    rnd = random.Random(spec["seed"])
    off = Vector((rnd.uniform(-50, 50), rnd.uniform(-50, 50), rnd.uniform(-50, 50)))
    W, D, H = spec["W"], spec["D"], spec["H"]
    tot = H * (1.0 + SKIRT)
    rad = Vector((W / 2, D / 2, tot / 2))
    boxy = spec.get("boxy", 0.0)
    out = []
    for u in co:
        # superellipsoid-ish: push toward a rounded box
        if boxy:
            m = max(abs(u.x), abs(u.y), abs(u.z))
            u = u.lerp(u / max(m, 1e-6) * 0.86, boxy)
        p = Vector((u.x * rad.x, u.y * rad.y, u.z * rad.z))
        lump = fbm(u * 1.15 + off, 3) * spec["lumps"]
        p += u.normalized() * lump * (W + D + tot) / 3.0
        out.append(p)
    # soft planar cuts: broad planes + chipped facets
    size = (W + D + tot) / 3.0
    planes = []
    for i in range(spec["facets"]):
        a = rnd.uniform(0, math.tau)
        el = rnd.uniform(-0.15, 0.65)              # mostly sides / upper sides
        n = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        planes.append((n, rnd.uniform(0.82, 0.94), spec["facet_soft"]))
    if spec.get("shear"):
        sh = spec["shear"]
        planes.append((Vector(sh["n"]).normalized(), sh["at"], sh["soft"]))
    if spec.get("top_flat"):
        planes.append((Vector((0, 0, 1)), spec["top_flat"], 0.12))
    planes.append((Vector((0, 0, -1)), 0.86, 0.10))  # broad underside
    for n, frac, soft in planes:
        hmax = max(p.dot(n) for p in out)
        d = hmax * frac
        k = soft * size
        for i, p in enumerate(out):
            h = p.dot(n)
            if h > d - k:
                out[i] = p + n * (smin(h, d, k) - h)
    return out


def _fit(out, W, D, H):
    xs = [p.x for p in out]; ys = [p.y for p in out]; zs = [p.z for p in out]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    sx, sy = W / (max(xs) - min(xs)), D / (max(ys) - min(ys))
    z0, z1 = min(zs), max(zs)
    tot = H * (1.0 + SKIRT)
    return [Vector(((p.x - cx) * sx, (p.y - cy) * sy,
                    (p.z - z0) / (z1 - z0) * tot - SKIRT * H)) for p in out]


def _detail(ob, spec):
    """Fine surface detail along the vertex normal: bumps, pits, cracks."""
    me = ob.data
    me.update()
    rnd = random.Random(spec["seed"] * 7 + 1)
    off = Vector((rnd.uniform(-90, 90), rnd.uniform(-90, 90), rnd.uniform(-90, 90)))
    s = min(1.0, (spec["W"] + spec["H"]) / 4.0)          # detail scale ~ rock size
    s = max(s, 0.35)
    for v in me.vertices:
        p, n = v.co.copy(), v.normal.copy()
        q = p + off
        bump = fbm(q * (1.6 / s), 4) * 0.0045 * s
        # pitting: sparse small dents
        pit = max(0.0, noise.noise(q * (14.0 / s)) - 0.5) * -0.016 * s
        # cracks: voronoi cell edges, masked to a few runs
        d, _pts = noise.voronoi(q * (1.6 / s), distance_metric="DISTANCE", exponent=2.5)
        edge = d[1] - d[0]
        mask = smoothstep(0.30, 0.55, noise.noise(q * (0.55 / s) + Vector((3.1, 7.7, 1.3))))
        crack = -(1.0 - smoothstep(0.0, 0.03, edge)) * 0.012 * s * mask
        # flatter, smoother tops (water-worn) / rougher sides
        wear = 0.55 + 0.45 * (1.0 - max(0.0, n.z))
        v.co = p + n * ((bump + pit) * wear + crack)
    me.update()


def _pebble_cluster(spec):
    """rock_06: three flat river pebbles fused into one flat piece."""
    rnd = random.Random(spec["seed"])
    parts = [((-0.055, 0.010), (0.19, 0.15, spec["H"] * 1.0), 0.3),
             ((0.075, -0.030), (0.15, 0.11, spec["H"] * 0.8), 1.9),
             ((0.040, 0.060), (0.10, 0.08, spec["H"] * 0.6), 0.9)]
    bm = bmesh.new()
    for (cx, cy), (w, d, h), rot in parts:
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=spec["subdiv"], radius=1.0)
        off = Vector((rnd.uniform(-40, 40), rnd.uniform(-40, 40), 0))
        cr, sr = math.cos(rot), math.sin(rot)
        tot = h * (1 + SKIRT)
        for v in tmp.verts:
            u = v.co.copy()
            p = Vector((u.x * w / 2, u.y * d / 2, u.z * tot / 2))
            p += u * fbm(u * 1.3 + off, 2) * 0.05 * w
            # flatter top and base
            p.z = p.z * (0.85 + 0.15 * (1 - abs(u.z)))
            p = Vector((p.x * cr - p.y * sr + cx, p.x * sr + p.y * cr + cy, p.z + tot / 2 - SKIRT * h))
            v.co = p
        me_tmp = bpy.data.meshes.new("tmp")
        tmp.to_mesh(me_tmp)
        tmp.free()
        bm.from_mesh(me_tmp)
        bpy.data.meshes.remove(me_tmp)
    me = bpy.data.meshes.new(spec["name"] + "_high")
    bm.to_mesh(me)
    bm.free()
    # fit overall width/depth exactly
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    sx, sy = spec["W"] / (max(xs) - min(xs)), spec["D"] / (max(ys) - min(ys))
    for v in me.vertices:
        v.co = Vector(((v.co.x - cx) * sx, (v.co.y - cy) * sy, v.co.z))
    return me


def make_high(spec, coll):
    name = spec["name"] + "_high"
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    if spec.get("cluster"):
        me = _pebble_cluster(spec)
    else:
        me = _icosphere(name, spec["subdiv"])
        co = [v.co.copy() for v in me.vertices]
        shaped = _fit(_shape_boulder(co, spec), spec["W"], spec["D"], spec["H"])
        for v, p in zip(me.vertices, shaped):
            v.co = p
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    if not spec.get("cluster"):
        _detail(ob, spec)
    for p in me.polygons:
        p.use_smooth = True
    return ob


# --------------------------------------------------------------------------
# 2. game mesh
# --------------------------------------------------------------------------

def make_low(high, spec, coll):
    name = spec["name"]
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    me = high.data.copy()
    me.name = name
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    dec = ob.modifiers.new("Decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = spec["tris"] / tris
    dec.use_collapse_triangulate = True
    _apply_mods(ob)
    # clean up
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = True
    wn = ob.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
    wn.mode = "FACE_AREA"
    wn.weight = 50
    wn.keep_sharp = False
    _apply_mods(ob)
    return ob


def _apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    me.name = old.name
    bpy.data.meshes.remove(old)


# --------------------------------------------------------------------------
# 3. atlas UVs
# --------------------------------------------------------------------------

def _select_only(obs, active=None):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or obs[0]


def _view3d_override():
    """UV operators silently do nothing without a 3D view in the context."""
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type == "VIEW_3D":
                region = next(r for r in area.regions if r.type == "WINDOW")
                return dict(window=win, screen=win.screen, area=area, region=region)
    win = bpy.context.window_manager.windows[0]
    area = max(win.screen.areas, key=lambda a: a.width * a.height)
    area.type = "VIEW_3D"
    region = next(r for r in area.regions if r.type == "WINDOW")
    return dict(window=win, screen=win.screen, area=area, region=region)


def atlas_uvs(lows):
    for ob in lows:
        for uvl in list(ob.data.uv_layers):
            ob.data.uv_layers.remove(uvl)
        ob.data.uv_layers.new(name="UVMap")
    _select_only(lows)
    with bpy.context.temp_override(**_view3d_override()):
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0,
                                 area_weight=0.0, scale_to_bounds=False)
        bpy.ops.uv.select_all(action="SELECT")
        bpy.ops.uv.average_islands_scale()
        kw = dict(margin=0.006, rotate=True)
        try:
            bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", shape_method="CONCAVE", **kw)
        except TypeError:
            bpy.ops.uv.pack_islands(**kw)
        bpy.ops.object.mode_set(mode="OBJECT")


# --------------------------------------------------------------------------
# materials
# --------------------------------------------------------------------------

def _clear(m):
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    return nt, nt.nodes, nt.links


def high_material():
    """Procedural boulder surface used only as the bake source."""
    m = bpy.data.materials.get("ROCK_HighSource") or bpy.data.materials.new("ROCK_HighSource")
    nt, N, L = _clear(m)
    out = N.new("ShaderNodeOutputMaterial")
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    L.new(bsdf.outputs[0], out.inputs["Surface"])
    tc = N.new("ShaderNodeTexCoord")
    geo = N.new("ShaderNodeNewGeometry")
    sep_n = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Normal"], sep_n.inputs[0])
    sep_p = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Position"], sep_p.inputs[0])

    def noise_tex(scale, detail=6.0, rough=0.55):
        t = N.new("ShaderNodeTexNoise")
        t.inputs["Scale"].default_value = scale
        t.inputs["Detail"].default_value = detail
        t.inputs["Roughness"].default_value = rough
        L.new(tc.outputs["Object"], t.inputs["Vector"])
        return t

    def ramp(src, stops, interp="LINEAR"):
        r = N.new("ShaderNodeValToRGB")
        r.color_ramp.interpolation = interp
        els = r.color_ramp.elements
        while len(els) > 2:
            els.remove(els[-1])
        for i, (pos, col) in enumerate(stops):
            e = els[i] if i < 2 else els.new(pos)
            e.position = pos
            e.color = (*col, 1.0) if len(col) == 3 else col
        L.new(src, r.inputs[0])
        return r

    def mix(a, b, fac, blend="MIX"):
        mx = N.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = blend
        L.new(fac, mx.inputs["Factor"])
        L.new(a, mx.inputs[6]); L.new(b, mx.inputs[7])
        return mx.outputs[2]

    def mathn(op, a, b=None, val=None):
        mt = N.new("ShaderNodeMath"); mt.operation = op
        L.new(a, mt.inputs[0])
        if b is not None:
            L.new(b, mt.inputs[1])
        elif val is not None:
            mt.inputs[1].default_value = val
        return mt.outputs[0]

    b = BASE_LIN
    dark = tuple(c * 0.62 for c in b)
    light = tuple(min(1, c * 1.45) for c in b)
    # mottled base: large-scale tone + fine granite grain
    mott = noise_tex(1.6, 8.0, 0.6)
    base = ramp(mott.outputs["Fac"], [(0.32, dark), (0.5, b), (0.72, light)]).outputs[0]
    grain = noise_tex(90.0, 2.0, 0.5)
    g_ramp = ramp(grain.outputs["Fac"], [(0.45, (1, 1, 1)), (0.75, (0.72, 0.70, 0.68))]).outputs[0]
    one = N.new("ShaderNodeValue"); one.outputs[0].default_value = 1.0
    base = mix(base, g_ramp, one.outputs[0], "MULTIPLY")
    # pale quartz specks (granite)
    speck = noise_tex(260.0, 1.0, 0.5)
    sp = ramp(speck.outputs["Fac"], [(0.66, (0, 0, 0)), (0.74, (0.35, 0.35, 0.35))]).outputs[0]
    quartz = N.new("ShaderNodeRGB"); quartz.outputs[0].default_value = (0.42, 0.38, 0.33, 1.0)
    base = mix(base, quartz.outputs[0], sp)
    # weathered, sun-bleached tops
    up = ramp(sep_n.outputs["Z"], [(0.35, (0, 0, 0)), (0.92, (1, 1, 1))]).outputs[0]
    wmask = noise_tex(3.0, 4.0, 0.6)
    wm = mathn("MULTIPLY", up, mathn("ADD", wmask.outputs["Fac"], val=0.25))
    top_col = N.new("ShaderNodeRGB"); top_col.outputs[0].default_value = (0.255, 0.225, 0.19, 1)
    base = mix(base, top_col.outputs[0], mathn("MINIMUM", wm, val=0.85))
    # crevices: occlusion mask
    ao = N.new("ShaderNodeAmbientOcclusion")
    ao.inputs["Distance"].default_value = 0.08
    ao.samples = 16
    ao.only_local = True     # the game mesh (overlapping while baking) must not count
    crev = ramp(ao.outputs["AO"], [(0.45, (1, 1, 1)), (0.9, (0, 0, 0))]).outputs[0]
    # moss / lichen: crevices + patches on upward faces, faint
    mpatch = noise_tex(4.5, 6.0, 0.65)
    mp = ramp(mpatch.outputs["Fac"], [(0.52, (0, 0, 0)), (0.66, (1, 1, 1))]).outputs[0]
    moss_up = mathn("MULTIPLY", mp, up)
    moss_m = mathn("MAXIMUM", mathn("MULTIPLY", crev, val=0.75), moss_up)
    moss_m = mathn("MULTIPLY", moss_m, val=0.55)
    moss = N.new("ShaderNodeRGB"); moss.outputs[0].default_value = (0.075, 0.082, 0.032, 1)
    base = mix(base, moss.outputs[0], moss_m)
    # dark crevice dirt
    dirt = N.new("ShaderNodeRGB"); dirt.outputs[0].default_value = (0.045, 0.036, 0.028, 1)
    base = mix(base, dirt.outputs[0], mathn("MULTIPLY", crev, val=0.35))
    # damp ground line + darker buried skirt
    gl = ramp(sep_p.outputs["Z"], [(-0.02, (1, 1, 1)), (0.10, (0, 0, 0))]).outputs[0]
    earth = N.new("ShaderNodeRGB"); earth.outputs[0].default_value = (0.06, 0.047, 0.035, 1)
    base = mix(base, earth.outputs[0], mathn("MULTIPLY", gl, val=0.55))
    L.new(base, bsdf.inputs["Base Color"])
    # roughness 0.85..0.95: smoother worn tops, rougher moss and crevices
    rn = noise_tex(6.0, 4.0, 0.5)
    rough = ramp(rn.outputs["Fac"], [(0.3, (0.86, 0.86, 0.86)), (0.7, (0.92, 0.92, 0.92))]).outputs[0]
    r_moss = N.new("ShaderNodeRGB"); r_moss.outputs[0].default_value = (0.95, 0.95, 0.95, 1)
    rough = mix(rough, r_moss.outputs[0], moss_m)
    top_r = mathn("MULTIPLY", up, val=-0.02)
    rr = N.new("ShaderNodeSeparateColor"); L.new(rough, rr.inputs[0])
    rough_f = mathn("ADD", rr.outputs[0], top_r)
    rough_f = mathn("MAXIMUM", rough_f, val=0.85)
    L.new(rough_f, bsdf.inputs["Roughness"])
    bsdf.inputs["Metallic"].default_value = 0.0
    return m


def atlas_material(img_bc, img_n, img_orm):
    m = bpy.data.materials.get("Rock_Atlas") or bpy.data.materials.new("Rock_Atlas")
    nt, N, L = _clear(m)
    out = N.new("ShaderNodeOutputMaterial")
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    L.new(bsdf.outputs[0], out.inputs["Surface"])
    bc = N.new("ShaderNodeTexImage"); bc.image = img_bc
    L.new(bc.outputs["Color"], bsdf.inputs["Base Color"])
    nm = N.new("ShaderNodeTexImage"); nm.image = img_n
    nmap = N.new("ShaderNodeNormalMap")
    L.new(nm.outputs["Color"], nmap.inputs["Color"])
    L.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    orm = N.new("ShaderNodeTexImage"); orm.image = img_orm
    sep = N.new("ShaderNodeSeparateColor")
    L.new(orm.outputs["Color"], sep.inputs[0])
    L.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    L.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    # glTF occlusion socket
    grp = bpy.data.node_groups.get("glTF Material Output")
    if grp is None:
        grp = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        grp.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
        grp.interface.new_socket("Thickness", in_out="INPUT", socket_type="NodeSocketFloat")
    gn = N.new("ShaderNodeGroup"); gn.node_tree = grp
    L.new(sep.outputs["Red"], gn.inputs["Occlusion"])
    m.use_backface_culling = True    # closed meshes: single-sided in glTF
    return m


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------

def _coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def build_one(name):
    """Build one rock (high + low). Separate calls keep each step short."""
    spec = next(s for s in SPECS if s["name"] == name)
    h = make_high(spec, _coll("Rocks_High"))
    h.data.materials.clear(); h.data.materials.append(high_material())
    lo = make_low(h, spec, _coll("Rocks"))
    return {"high_tris": sum(len(p.vertices) - 2 for p in h.data.polygons),
            "tris": sum(len(p.vertices) - 2 for p in lo.data.polygons),
            "dims": [round(x, 3) for x in lo.dimensions]}


def build_all(root):
    import time
    t0 = time.time()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    hc = _coll("Rocks_High")
    lc = _coll("Rocks")
    hmat = high_material()
    highs, lows, report = [], [], {}
    for spec in SPECS:
        h = make_high(spec, hc)
        h.data.materials.clear(); h.data.materials.append(hmat)
        lo = make_low(h, spec, lc)
        highs.append(h); lows.append(lo)
        report[spec["name"]] = {
            "high_tris": sum(len(p.vertices) - 2 for p in h.data.polygons),
            "tris": sum(len(p.vertices) - 2 for p in lo.data.polygons),
            "dims": [round(x, 3) for x in lo.dimensions],
            "zmin": round(min(v.co.z for v in lo.data.vertices), 3),
            "zmax": round(max(v.co.z for v in lo.data.vertices), 3)}
    atlas_uvs(lows)
    report["_time"] = round(time.time() - t0, 1)
    return report


# --------------------------------------------------------------------------
# 4. bake
# --------------------------------------------------------------------------

def _new_image(name, non_color, fill):
    im = bpy.data.images.get(name)
    if im is not None:
        bpy.data.images.remove(im)
    im = bpy.data.images.new(name, ATLAS, ATLAS, alpha=False, float_buffer=False)
    im.generated_color = fill
    if non_color:
        im.colorspace_settings.name = "Non-Color"
    return im


def _ao_material(spec, size):
    """Bake source for ambient occlusion: the high-poly's own occlusion
    (Only Local, so the game mesh and other rocks never darken it) x a
    ground-contact term that darkens toward the ground line."""
    m = bpy.data.materials.get("ROCK_AOSource") or bpy.data.materials.new("ROCK_AOSource")
    nt, N, L = _clear(m)
    out = N.new("ShaderNodeOutputMaterial")
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    L.new(bsdf.outputs[0], out.inputs["Surface"])
    ao = N.new("ShaderNodeAmbientOcclusion")
    ao.only_local = True
    ao.samples = 32
    ao.inputs["Distance"].default_value = max(0.04, 0.14 * size)
    geo = N.new("ShaderNodeNewGeometry")
    sep = N.new("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Position"], sep.inputs[0])
    mr = N.new("ShaderNodeMapRange")
    mr.interpolation_type = "SMOOTHSTEP"
    mr.inputs["From Min"].default_value = -0.02
    mr.inputs["From Max"].default_value = min(0.35, 0.45 * spec["H"])
    mr.inputs["To Min"].default_value = 0.5
    mr.inputs["To Max"].default_value = 1.0
    L.new(sep.outputs["Z"], mr.inputs["Value"])
    mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    L.new(ao.outputs["AO"], mul.inputs[0]); L.new(mr.outputs["Result"], mul.inputs[1])
    L.new(mul.outputs[0], bsdf.inputs["Base Color"])
    return m


def finish_materials(root):
    """Load the baked atlas PNGs and give every game mesh the Rock_Atlas material."""
    tdir = os.path.join(root, "textures")

    def load(name, non_color):
        im = bpy.data.images.load(os.path.join(tdir, name), check_existing=True)
        im.reload()
        if non_color:
            im.colorspace_settings.name = "Non-Color"
        return im

    bc = load("rock_atlas_basecolor.png", False)
    nm = load("rock_atlas_normal.png", True)
    om = load("rock_atlas_orm.png", True)
    mat = atlas_material(bc, nm, om)
    for s in SPECS:
        lo = bpy.data.objects[s["name"]]
        lo.data.materials.clear(); lo.data.materials.append(mat)
    return bc, nm, om


def bake_all(root, samples=24, margin=8):
    import time
    import numpy as np
    t0 = time.time()
    scene = bpy.context.scene
    try:
        scene.render.engine = "CYCLES"
    except TypeError:
        pass
    cy = scene.cycles
    cy.samples = samples
    cy.use_denoising = False
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        cy.device = "GPU"
    except Exception:
        cy.device = "CPU"
    bk = scene.render.bake
    bk.margin = margin
    bk.margin_type = "EXTEND"
    bk.use_selected_to_active = True
    bk.normal_space = "TANGENT"
    bk.normal_r, bk.normal_g, bk.normal_b = "POS_X", "POS_Y", "POS_Z"  # OpenGL
    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True

    # Cycles overwrites the whole target image on every bake, so each rock is
    # baked into a fresh temp image and its covered pixels (alpha 1, incl. the
    # margin) are composited into the shared atlas buffers.
    n = ATLAS * ATLAS
    fills = {"BaseColor": (0.42, 0.355, 0.30), "Normal": (0.5, 0.5, 1.0),
             "AO": (1.0, 1.0, 1.0), "Rough": (0.9, 0.9, 0.9)}
    acc = {k: np.tile(np.array([*c, 1.0], np.float32), n) for k, c in fills.items()}
    cover = np.zeros(n, bool)
    bakemat = bpy.data.materials.get("ROCK_BakeTarget") or bpy.data.materials.new("ROCK_BakeTarget")
    nt, N, L = _clear(bakemat)
    out = N.new("ShaderNodeOutputMaterial")
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    L.new(bsdf.outputs[0], out.inputs["Surface"])
    tex = N.new("ShaderNodeTexImage")
    N.active = tex
    tex.select = True

    def temp_image(key):
        im = bpy.data.images.get("ROCK_bake_tmp")
        if im is not None:
            bpy.data.images.remove(im)
        im = bpy.data.images.new("ROCK_bake_tmp", ATLAS, ATLAS, alpha=True)
        if key != "BaseColor":
            im.colorspace_settings.name = "Non-Color"
        im.pixels.foreach_set(np.zeros(n * 4, np.float32))
        return im

    pairs = [(bpy.data.objects[s["name"] + "_high"], bpy.data.objects[s["name"]], s) for s in SPECS]
    all_obs = [o for pr in pairs for o in pr[:2]]
    for h, lo, spec in pairs:
        lo.data.materials.clear(); lo.data.materials.append(bakemat)
    hmat = bpy.data.materials["ROCK_HighSource"]
    buf = np.empty(n * 4, np.float32)
    for h, lo, spec in pairs:
        size = (spec["W"] + spec["D"] + spec["H"]) / 3.0
        ext = max(0.012, 0.035 * size)
        bk.cage_extrusion = ext
        bk.max_ray_distance = ext * 2.2
        for o in all_obs:
            o.hide_render = o not in (h, lo)
        _select_only([h, lo], lo)
        aomat = _ao_material(spec, size)
        # BaseColor first: its alpha is this rock's coverage (the normal bake
        # fills the whole image with alpha 1, so it can't be its own mask)
        for key, btype, kw in (("BaseColor", "DIFFUSE", {"pass_filter": {"COLOR"}}),
                               ("Normal", "NORMAL", {}),
                               ("Rough", "ROUGHNESS", {}),
                               ("AO", "DIFFUSE", {"pass_filter": {"COLOR"}})):
            im = temp_image(key)
            tex.image = im
            h.data.materials[0] = aomat if key == "AO" else hmat
            cy.samples = 96 if key == "AO" else samples
            bpy.ops.object.bake(type=btype, **kw)
            im.pixels.foreach_get(buf)
            if key == "BaseColor":
                m = buf[3::4] > 0.5
                cover |= m
            px = acc[key].reshape(-1, 4)
            px[m] = buf.reshape(-1, 4)[m]
            px[m, 3] = 1.0
        h.data.materials[0] = hmat
    im = bpy.data.images.get("ROCK_bake_tmp")
    if im is not None:
        bpy.data.images.remove(im)
    for o in all_obs:
        o.hide_render = False

    tdir = os.path.join(root, "textures")
    os.makedirs(tdir, exist_ok=True)

    def save(pixels, name, non_color):
        im = bpy.data.images.new("ROCK_out", ATLAS, ATLAS, alpha=False)
        if non_color:
            im.colorspace_settings.name = "Non-Color"
        im.pixels.foreach_set(pixels)
        im.filepath_raw = os.path.join(tdir, name)
        im.file_format = "PNG"
        im.save()
        bpy.data.images.remove(im)

    for nm_ in ("rock_atlas_basecolor.png", "rock_atlas_normal.png", "rock_atlas_orm.png"):
        im = bpy.data.images.get(nm_)
        if im is not None:
            bpy.data.images.remove(im)
    save(acc["BaseColor"], "rock_atlas_basecolor.png", False)
    save(acc["Normal"], "rock_atlas_normal.png", True)
    ao, ro = acc["AO"], acc["Rough"]
    orm = np.empty(n * 4, np.float32)
    orm[0::4] = ao[0::4]
    orm[1::4] = ro[0::4]
    orm[2::4] = 0.0
    orm[3::4] = 1.0
    save(orm, "rock_atlas_orm.png", True)
    finish_materials(root)
    stats = {"coverage": round(float(cover.mean()), 3),
             "AO_mean": round(float(ao[0::4][cover].mean()), 3),
             "rough_range": [round(float(ro[0::4][cover].min()), 3), round(float(ro[0::4][cover].max()), 3)]}
    return {"time": round(time.time() - t0, 1), **stats}


# --------------------------------------------------------------------------
# 5. export
# --------------------------------------------------------------------------

def export(root, glb_path):
    lows = [bpy.data.objects[s["name"]] for s in SPECS]
    for o in lows:
        clash = bpy.data.meshes.get(o.name)
        if clash is not None and clash != o.data:
            clash.name = o.name + "_old"
        o.data.name = o.name           # glTF mesh name == node name
        o.location = (0, 0, 0)
        o.rotation_euler = (0, 0, 0)
        o.scale = (1, 1, 1)
    _select_only(lows)
    kw = dict(filepath=glb_path, export_format="GLB", use_selection=True,
              export_yup=True, export_apply=True, export_materials="EXPORT",
              export_image_format="JPEG", export_draco_mesh_compression_enable=True,
              export_draco_mesh_compression_level=6, export_normals=True,
              export_texcoords=True, export_tangents=False, export_cameras=False,
              export_lights=False, export_extras=False)
    try:
        bpy.ops.export_scene.gltf(export_image_quality=85, **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)
    return os.path.getsize(glb_path)
