"""Irregular island base for the light-strand Yggdrasil (yggdrasil-island.blend).

Blender Z-up, metres, trunk centred on the origin (same frame as the tree).

The island follows the tree's own roots: for every direction its outline
reaches the furthest root tip plus a margin, with irregular lobes and bays.
The top is a dome lying just under the roots, so the roots rest on the
ground near the trunk and sink into it toward their tips, with irregular
ridges across it. The underside is one flat plane: the island is slim at
the edge (a thin rocky lip) and thickest under the trunk only because the
top domes up, with nothing hanging below the bottom.

Usage:
    g = {"__name__": "ygg_island"}; exec(compile(open(p).read(), p, "exec"), g)
    g["build_island"]()
"""

import math

import bmesh
import bpy
from mathutils import Vector, noise


def fbm(p, octaves=4, lac=2.0, gain=0.5):
    s, a, f = 0.0, 1.0, 1.0
    for _ in range(octaves):
        s += a * noise.noise(p * f)
        a *= gain
        f *= lac
    return s


def root_reach(bins=72, roots="YGG_StrandRoots"):
    """Furthest root vertex per azimuth bin (world XY), smoothed."""
    ob = bpy.data.objects[roots]
    mw = ob.matrix_world
    reach = [0.0] * bins
    for v in ob.data.vertices:
        p = mw @ v.co
        r = math.hypot(p.x, p.y)
        b = int((math.atan2(p.y, p.x) + math.pi) / math.tau * bins) % bins
        if r > reach[b]:
            reach[b] = r
    # smooth so the outline does not trace single roots
    out = []
    for i in range(bins):
        out.append(max(reach[(i + k) % bins] for k in range(-3, 4)))
    return out


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def ridges(p, r, s):
    """Irregular ridged crests across the island top (ridged noise on a
    domain-warped position), kept off the dense root zone near the trunk and
    fading out before the thin lip."""
    warp = Vector((fbm(p / 9.0 + Vector((1.7, 9.2, 0.0)), 2),
                   fbm(p / 9.0 + Vector((8.3, 2.8, 0.0)), 2), 0.0)) * 4.0
    q = p + warp
    big = (1.0 - abs(noise.noise(q / 6.5 + Vector((4.4, 1.1, 0.0))))) ** 4
    small = (1.0 - abs(noise.noise(q / 2.7 + Vector((0.6, 7.9, 0.0))))) ** 3
    patch = smoothstep(-0.25, 0.35, noise.noise(p / 13.0 + Vector((2.2, 5.5, 0.0))))
    mask = smoothstep(8.0, 14.0, r) * (1.0 - smoothstep(0.86, 0.98, s)) * patch
    return (1.5 * big + 0.45 * small) * mask


def top_height(r, p, s=0.0):
    """Dome that is highest at the trunk and thins out to a slim lip at the
    edge, with gentle undulation and irregular ridges."""
    z = 0.55 - 0.045 * r
    z -= 1.1 * smoothstep(0.78, 1.0, s) ** 1.5           # slim edge lip
    z += 0.28 * fbm(p / 7.0 + Vector((11.3, 2.1, 0.0)), 3)
    z += 0.05 * fbm(p / 1.6, 2)
    return z + ridges(p, r, s)


def build_island(name="YGG_Island", seg=384, top_rings=90, rim_rings=8,
                 margin=3.5, base_r=25.0, edge_thick=0.7,
                 parent="YggdrasilStrands"):
    old = bpy.data.objects.get(name)
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    reach = root_reach()
    nb = len(reach)

    def outline(th):
        # interpolated root reach + irregular lobes / bays
        f = (th + math.pi) / math.tau * nb
        i0 = int(math.floor(f)) % nb
        t = f - math.floor(f)
        rr = reach[i0] * (1 - t) + reach[(i0 + 1) % nb] * t
        c = Vector((math.cos(th), math.sin(th), 0.0))
        lobes = (0.20 * noise.noise(c * 1.4 + Vector((3.7, 1.9, 0.5)))
                 + 0.11 * noise.noise(c * 3.6 + Vector((0.3, 8.2, 2.2)))
                 + 0.04 * noise.noise(c * 9.0 + Vector((5.1, 0.7, 4.4))))
        return max(base_r * (1.0 + lobes) * (1.12 if abs(c.x) > 0.6 else 1.0),
                   rr + margin)

    R = [outline(-math.pi + math.tau * k / seg) for k in range(seg)]
    bm = bmesh.new()
    rings = []
    # centre
    centre = bm.verts.new((0.0, 0.0, top_height(0.0, Vector((0, 0, 0)))))
    # top surface rings (denser toward the edge)
    for j in range(1, top_rings + 1):
        s = (j / top_rings) ** 0.85
        ring = []
        for k in range(seg):
            th = -math.pi + math.tau * k / seg
            r = s * R[k]
            p = Vector((r * math.cos(th), r * math.sin(th), 0.0))
            ring.append(bm.verts.new((p.x, p.y, top_height(r, p, s))))
        rings.append(ring)
    # rim: a short rocky bank from the top edge straight down to one flat
    # bottom plane. Thickness = top height - bottom, so the island is slim at
    # the edge and thickest under the trunk, with nothing hanging below.
    z_edge = [rings[-1][k].co.z for k in range(seg)]
    z_flat = min(z_edge) - edge_thick
    for j in range(1, rim_rings + 1):
        u = j / rim_rings
        ring = []
        for k in range(seg):
            th = -math.pi + math.tau * k / seg
            c = Vector((math.cos(th), math.sin(th), 0.0))
            out = 0.5 * math.sin(u * math.pi) - 0.25 * u
            z = z_edge[k] + (z_flat - z_edge[k]) * u
            pz = Vector((c.x * R[k], c.y * R[k], z))
            rock = 0.35 * fbm(pz / 1.8 + Vector((7.7, 3.3, 1.1)), 3) * math.sin(u * math.pi)
            p = c * (R[k] + out + rock)
            ring.append(bm.verts.new((p.x, p.y, z)))
        rings.append(ring)
    bottom = bm.verts.new((0.0, 0.0, z_flat))
    # faces
    first = rings[0]
    for k in range(seg):
        bm.faces.new((centre, first[k], first[(k + 1) % seg]))
    for a, b in zip(rings[:-1], rings[1:]):
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((a[k], b[k], b[k2], a[k2]))
    last = rings[-1]
    flat_faces = []
    for k in range(seg):
        flat_faces.append(bm.faces.new((bottom, last[(k + 1) % seg], last[k])))
    for f in flat_faces:
        f.smooth = False
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    n_flat = seg
    for i, poly in enumerate(me.polygons):
        poly.use_smooth = i < len(me.polygons) - n_flat    # flat underside stays flat-shaded
    ob = bpy.data.objects.new(name, me)
    coll = bpy.data.collections.get("YggdrasilIsland")
    if coll is None:
        coll = bpy.data.collections.new("YggdrasilIsland")
        bpy.context.scene.collection.children.link(coll)
    coll.objects.link(ob)
    par = bpy.data.objects.get(parent)
    if par is not None:
        ob.parent = par
        ob.matrix_parent_inverse = par.matrix_world.inverted()
    ob.data.materials.append(island_material())
    return ob, {"verts": len(me.vertices), "faces": len(me.polygons),
                "radius_min": round(min(R), 1), "radius_max": round(max(R), 1)}


def island_material():
    """Procedural ground: mossy green-olive top with darker soil patches and
    root-shaded soil around the trunk, rolling into rocky grey-brown earth
    banks on the sides."""
    name = "YGG_IslandGround"
    m = bpy.data.materials.get(name)
    if m is not None:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    for nd in list(N):
        N.remove(nd)
    out = N.new("ShaderNodeOutputMaterial"); out.location = (900, 0)
    bsdf = N.new("ShaderNodeBsdfPrincipled"); bsdf.location = (650, 0)
    L.new(bsdf.outputs[0], out.inputs["Surface"])
    tc = N.new("ShaderNodeTexCoord"); tc.location = (-1400, 0)
    geo = N.new("ShaderNodeNewGeometry"); geo.location = (-1400, -300)

    def noise_tex(scale, detail, x, y, rough=0.55):
        t = N.new("ShaderNodeTexNoise"); t.location = (x, y)
        t.inputs["Scale"].default_value = scale
        t.inputs["Detail"].default_value = detail
        t.inputs["Roughness"].default_value = rough
        L.new(tc.outputs["Object"], t.inputs["Vector"])
        return t

    def ramp(src, stops, x, y):
        r = N.new("ShaderNodeValToRGB"); r.location = (x, y)
        els = r.color_ramp.elements
        for i, (pos, col) in enumerate(stops):
            e = els[i] if i < len(els) else els.new(pos)
            e.position = pos
            e.color = (*col, 1.0)
        L.new(src, r.inputs[0])
        return r.outputs[0]

    def mix(a, b, fac, x, y):
        mx = N.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.location = (x, y)
        L.new(fac, mx.inputs["Factor"])
        L.new(a, mx.inputs[6]); L.new(b, mx.inputs[7])
        return mx.outputs[2]

    # top: moss / turf colour variation (colour only, no grass geometry)
    n1 = noise_tex(0.09, 6, -1150, 300)
    moss = ramp(n1.outputs["Fac"], [(0.35, (0.045, 0.085, 0.018)),
                                     (0.55, (0.085, 0.14, 0.03)),
                                     (0.72, (0.16, 0.19, 0.05))], -900, 300)
    n2 = noise_tex(0.22, 4, -1150, 80)
    soil_patch = ramp(n2.outputs["Fac"], [(0.58, (0, 0, 0)), (0.68, (1, 1, 1))], -900, 80)
    soil = N.new("ShaderNodeRGB"); soil.location = (-900, -120)
    soil.outputs[0].default_value = (0.075, 0.05, 0.03, 1)
    top = mix(moss, soil.outputs[0], soil_patch, -650, 250)
    # darker trodden soil around the trunk / under the roots
    sep = N.new("ShaderNodeSeparateXYZ"); sep.location = (-1150, -500)
    L.new(tc.outputs["Object"], sep.inputs[0])
    vl = N.new("ShaderNodeVectorMath"); vl.operation = "LENGTH"; vl.location = (-1150, -650)
    cxy = N.new("ShaderNodeCombineXYZ"); cxy.location = (-950, -560)
    L.new(sep.outputs["X"], cxy.inputs["X"]); L.new(sep.outputs["Y"], cxy.inputs["Y"])
    L.new(cxy.outputs[0], vl.inputs[0])
    mr = N.new("ShaderNodeMapRange"); mr.location = (-950, -750)
    mr.inputs["From Min"].default_value = 6.0
    mr.inputs["From Max"].default_value = 14.0
    L.new(vl.outputs["Value"], mr.inputs["Value"])
    near_f = N.new("ShaderNodeMath"); near_f.operation = "SUBTRACT"; near_f.location = (-700, -750)
    near_f.inputs[0].default_value = 1.0
    L.new(mr.outputs["Result"], near_f.inputs[1])
    dark_soil = N.new("ShaderNodeRGB"); dark_soil.location = (-650, -350)
    dark_soil.outputs[0].default_value = (0.06, 0.045, 0.028, 1)
    nf = N.new("ShaderNodeMath"); nf.operation = "MULTIPLY"; nf.location = (-500, -700)
    L.new(near_f.outputs[0], nf.inputs[0]); nf.inputs[1].default_value = 0.65
    top = mix(top, dark_soil.outputs[0], nf.outputs[0], -400, 150)
    # sides: rocky grey-brown earth with stones
    vor = N.new("ShaderNodeTexVoronoi"); vor.location = (-1150, -950)
    vor.inputs["Scale"].default_value = 0.9
    L.new(tc.outputs["Object"], vor.inputs["Vector"])
    stones = ramp(vor.outputs["Distance"], [(0.0, (0.20, 0.18, 0.16)), (0.35, (0.13, 0.11, 0.09)),
                                            (0.6, (0.075, 0.06, 0.045))], -900, -950)
    n3 = noise_tex(0.6, 6, -1150, -1150)
    earth = ramp(n3.outputs["Fac"], [(0.35, (0.06, 0.045, 0.032)), (0.65, (0.11, 0.085, 0.06))], -900, -1150)
    sm = N.new("ShaderNodeMix"); sm.data_type = "RGBA"; sm.location = (-650, -1000)
    sm.inputs["Factor"].default_value = 0.55
    L.new(earth, sm.inputs[6]); L.new(stones, sm.inputs[7])
    side = sm.outputs[2]
    # blend by surface slope (normal Z) with a noisy edge
    sn = N.new("ShaderNodeSeparateXYZ"); sn.location = (-1150, -1350)
    L.new(geo.outputs["Normal"], sn.inputs[0])
    nedge = noise_tex(0.5, 3, -1150, -1500)
    add = N.new("ShaderNodeMath"); add.operation = "ADD"; add.location = (-900, -1400)
    L.new(sn.outputs["Z"], add.inputs[0])
    sc = N.new("ShaderNodeMath"); sc.operation = "MULTIPLY_ADD"; sc.location = (-900, -1550)
    L.new(nedge.outputs["Fac"], sc.inputs[0]); sc.inputs[1].default_value = 0.3; sc.inputs[2].default_value = -0.15
    L.new(sc.outputs[0], add.inputs[1])
    slope = ramp(add.outputs[0], [(0.62, (0, 0, 0)), (0.8, (1, 1, 1))], -650, -1400)
    col = mix(side, top, slope, -150, -300)
    L.new(col, bsdf.inputs["Base Color"])
    rmix = N.new("ShaderNodeMix"); rmix.data_type = "FLOAT"; rmix.location = (200, -500)
    rmix.inputs[2].default_value = 0.88; rmix.inputs[3].default_value = 0.95
    sep_slope = N.new("ShaderNodeSeparateColor"); sep_slope.location = (0, -500)
    L.new(slope, sep_slope.inputs[0])
    L.new(sep_slope.outputs[0], rmix.inputs[0])
    L.new(rmix.outputs[0], bsdf.inputs["Roughness"])
    # bump: stones on the banks, soft turf texture on top
    bump = N.new("ShaderNodeBump"); bump.location = (400, -700)
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.15
    hm = N.new("ShaderNodeMix"); hm.data_type = "FLOAT"; hm.location = (200, -800)
    L.new(sep_slope.outputs[0], hm.inputs[0])
    vinv = N.new("ShaderNodeMath"); vinv.operation = "SUBTRACT"; vinv.location = (0, -900)
    vinv.inputs[0].default_value = 1.0
    L.new(vor.outputs["Distance"], vinv.inputs[1])
    L.new(vinv.outputs[0], hm.inputs[2])
    n4 = noise_tex(3.0, 4, -150, -1050)
    L.new(n4.outputs["Fac"], hm.inputs[3])
    L.new(hm.outputs[0], bump.inputs["Height"])
    L.new(bump.outputs[0], bsdf.inputs["Normal"])
    return m


def optimize_for_share(strand_ratio=0.5):
    """Shrink the share .blend without changing the look.

    - drops attributes only the web exporter / editing used (_flow, _seed, _sway,
      _phase, selection layers) and UVs the strand material never reads
    - stores the strand vertex colour 'Col' as 8-bit instead of float
    - halves the strand ribbons along their length (collapse decimate); the
      leaves (alpha cards) and the island are left as they are
    Save afterwards with compress=True.
    """
    drop = {"_flow", "_seed", "_sway", "_phase", ".select_vert", ".select_edge",
            ".select_poly", ".uv_select_vert", ".uv_select_edge", ".uv_select_face"}
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.name.startswith("YGG_"):
            continue
        me = o.data
        for name in [a.name for a in me.attributes if a.name in drop]:
            me.attributes.remove(me.attributes[name])
        if o.name.startswith("YGG_Strand") and o.name != "YGG_StrandLeaves":
            for uv in list(me.uv_layers):
                me.uv_layers.remove(uv)
            if "Col" in me.attributes and me.attributes["Col"].data_type != "BYTE_COLOR":
                me.color_attributes.active_color = me.color_attributes["Col"]
                with bpy.context.temp_override(object=o, active_object=o):
                    bpy.ops.geometry.color_attribute_convert(domain="POINT", data_type="BYTE_COLOR")
            m = o.modifiers.new("share_decimate", "DECIMATE")
            m.decimate_type = "COLLAPSE"
            m.ratio = strand_ratio
            with bpy.context.temp_override(object=o, active_object=o):
                bpy.ops.object.modifier_apply(modifier=m.name)
