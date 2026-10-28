
# Hyperiux garden generator library (Blender Z-up, metres)
import bpy, bmesh, math, random, os
import numpy as np
from mathutils import Vector, Matrix, Euler, Quaternion

GARDEN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(GARDEN, "textures")

X0, X1, Y0, Y1 = -80.0, 80.0, -45.0, 95.0
POND_C = (0.0, 0.0)
POND_A, POND_B = 9.5, 6.5
WATER = -0.25

def smoothstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)

def periodic_noise(n, seed, beta=2.0, aniso=(1.0, 1.0)):
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(n)[:, None] * aniso[1]
    fx = np.fft.fftfreq(n)[None, :] * aniso[0]
    k = np.sqrt(fx * fx + fy * fy); k[0, 0] = 1.0
    amp = k ** (-beta / 2.0); amp[0, 0] = 0.0
    ph = rng.uniform(0, 2 * np.pi, (n, n))
    f = np.real(np.fft.ifft2(amp * np.exp(1j * ph)))
    return (f - f.mean()) / (f.std() + 1e-9)

class Noise:
    def __init__(s, n, seed, beta, period):
        s.g = periodic_noise(n, seed, beta); s.n = n; s.P = period
    def __call__(s, x, y):
        x = np.asarray(x, float); y = np.asarray(y, float)
        u = (x / s.P % 1.0) * s.n; v = (y / s.P % 1.0) * s.n
        i0 = np.floor(u).astype(int); j0 = np.floor(v).astype(int)
        fu = u - i0; fv = v - j0
        fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv)
        i1 = (i0 + 1) % s.n; j1 = (j0 + 1) % s.n; i0 %= s.n; j0 %= s.n
        g = s.g
        a = g[j0, i0] * (1 - fu) + g[j0, i1] * fu
        b = g[j1, i0] * (1 - fu) + g[j1, i1] * fu
        return a * (1 - fv) + b * fv

N_big = Noise(128, 11, 2.4, 420.0)
N_mid = Noise(256, 12, 2.2, 170.0)
N_small = Noise(256, 13, 1.8, 37.0)
N_fine = Noise(256, 14, 1.4, 9.0)
N_col1 = Noise(256, 21, 2.0, 60.0)
N_col2 = Noise(256, 22, 1.8, 23.0)
N_col3 = Noise(256, 23, 2.2, 45.0)

def pond_d(x, y):
    dx = np.asarray(x, float) - POND_C[0]; dy = np.asarray(y, float) - POND_C[1]
    th = np.arctan2(dy, dx)
    rs = (1 + 0.10 * np.sin(2 * th + 0.7) + 0.06 * np.sin(3 * th + 2.1)
          + 0.035 * np.sin(5 * th + 0.3) + 0.02 * np.sin(7 * th + 1.3))
    return np.sqrt((dx / POND_A) ** 2 + (dy / POND_B) ** 2) / rs

def pond_radius_at(theta):
    rs = (1 + 0.10 * np.sin(2 * theta + 0.7) + 0.06 * np.sin(3 * theta + 2.1)
          + 0.035 * np.sin(5 * theta + 0.3) + 0.02 * np.sin(7 * theta + 1.3))
    c, s = np.cos(theta), np.sin(theta)
    return rs / np.sqrt((c / POND_A) ** 2 + (s / POND_B) ** 2)

def ground(x, y):
    x = np.asarray(x, float); y = np.asarray(y, float)
    r = np.hypot(x - POND_C[0], y - POND_C[1])
    h = 0.30 * N_mid(x, y) + 0.07 * N_small(x, y) + 0.015 * N_fine(x, y)
    far = smoothstep(16.0, 60.0, r)
    h += far * (0.9 * N_big(x, y) + 0.45 * N_mid(x * 0.4 + 31, y * 0.4 - 17))
    h += 0.75 * smoothstep(9.0, 38.0, r)
    # banks left / right of the clearing
    h += 1.5 * np.exp(-(((x + 25) ** 2) / 170 + ((y - 7) ** 2) / 260))
    h += 1.2 * np.exp(-(((x - 27) ** 2) / 210 + ((y - 3) ** 2) / 230))
    h += 0.6 * np.exp(-(((x + 14) ** 2) / 60 + ((y + 12) ** 2) / 50))
    # rolling background hills (no mountains)
    h += smoothstep(26.0, 95.0, y) * (5.0 + 3.2 * N_big(x * 0.9 + 50, y * 0.6) + 1.2 * N_mid(x * 0.35 - 7, y * 0.35)) + 2.5 * smoothstep(48.0, 80.0, np.abs(x))
    # gentle rise behind the camera
    h += 0.5 * smoothstep(-28.0, -45.0, y)
    # flatten the camera entrance corridor
    corr = np.exp(-(x / 7.0) ** 2) * smoothstep(-6.0, -14.0, y) * (1 - smoothstep(-36.0, -44.0, y))
    h = h * (1 - 0.6 * corr) + corr * 0.6 * 0.18
    return h

def smax(a, b, k=0.25):
    hh = np.clip(0.5 + 0.5 * (a - b) / k, 0, 1)
    return a * hh + b * (1 - hh) + k * hh * (1 - hh)

def height(x, y):
    x = np.asarray(x, float); y = np.asarray(y, float)
    d = pond_d(x, y)
    g = ground(x, y)
    gp = smax(g, WATER + 0.16 + 0.30 * np.clip(d - 1, 0, None), 0.3)
    shore = WATER + (gp - WATER) * smoothstep(1.0, 1.65, d)
    shore += 0.04 * N_fine(x, y) * smoothstep(1.0, 1.15, d)
    bowl = (WATER - 1.05 * smoothstep(1.0, 0.35, d) - 0.18 * np.clip(1 - d, 0, 1)
            + 0.06 * N_small(x * 2, y * 2) * np.clip(1 - d, 0, 1))
    return np.where(d < 1.0, bowl, shore)

def tensor_axis(spec):
    out = []
    for a, b, st in spec:
        n = max(1, int(round((b - a) / st)))
        out.extend(list(np.linspace(a, b, n + 1))[:-1])
    out.append(spec[-1][1])
    return np.array(out)

XS = tensor_axis([(-80, -32, 2.0), (-32, -15, 1.0), (-15, 15, 0.5), (15, 32, 1.0), (32, 80, 2.0)])
YS = tensor_axis([(-45, -33, 2.0), (-33, -10, 0.75), (-10, 10, 0.5), (10, 30, 1.0), (30, 95, 2.5)])

# ------------------------------------------------------------- scene helpers
def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c

def empty(name, collection, parent=None, loc=(0, 0, 0), size=0.5, etype="PLAIN_AXES"):
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, None)
        collection.objects.link(o)
    o.empty_display_type = etype; o.empty_display_size = size
    o.parent = parent; o.location = loc
    return o

def obj_from_mesh(name, mesh, collection, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.get(name)
    if o is not None:
        bpy.data.objects.remove(o, do_unlink=True)
    o = bpy.data.objects.new(name, mesh)
    collection.objects.link(o)
    o.parent = parent; o.location = loc
    return o

# ------------------------------------------------------------- images
def save_img(name, arr, noncolor=False, alpha=False):
    arr = np.asarray(arr, np.float32)
    h, w = arr.shape[:2]
    if arr.ndim == 2:
        arr = np.repeat(arr[:, :, None], 3, axis=2)
    if arr.shape[2] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1), np.float32)], axis=2)
    old = bpy.data.images.get(name)
    if old: bpy.data.images.remove(old)
    img = bpy.data.images.new(name + "_tmp", w, h, alpha=alpha)
    img.pixels.foreach_set(np.clip(arr, 0, 1).ravel())
    path = os.path.join(TEX, name + ".png")
    img.filepath_raw = path; img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    im = bpy.data.images.load(path)
    im.name = name
    im.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"
    if alpha: im.alpha_mode = "STRAIGHT"
    return im

def normal_from_height(hgt, strength):
    gx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5 * strength
    gy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5 * strength
    n = np.stack([-gx, -gy, np.ones_like(hgt)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5

def lerp(a, b, t):
    t = np.asarray(t)[..., None]
    return np.asarray(a) * (1 - t) + np.asarray(b) * t

# ------------------------------------------------------------- materials
def mat_pbr(name, color=(0.5, 0.5, 0.5), base_img=None, normal_img=None, rough=0.85,
            alpha_clip=False, double=False, scale=None, nstrength=1.0, vcol=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (600, 0)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.location = (300, 0)
    nt.links.new(b.outputs[0], out.inputs[0])
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    vec = None
    if scale is not None and (base_img or normal_img):
        tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-900, 0)
        mp = nt.nodes.new("ShaderNodeMapping"); mp.location = (-700, 0)
        mp.inputs["Scale"].default_value = (scale[0], scale[1], 1)
        nt.links.new(tc.outputs["UV"], mp.inputs["Vector"]); vec = mp.outputs[0]
    col_out = None
    if base_img:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = base_img; t.location = (-400, 200)
        if vec: nt.links.new(vec, t.inputs[0])
        col_out = t.outputs["Color"]
        if alpha_clip:
            lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.location = (-100, -150)
            lt.inputs[1].default_value = 0.5
            sb = nt.nodes.new("ShaderNodeMath"); sb.operation = "SUBTRACT"; sb.location = (80, -150)
            sb.inputs[0].default_value = 1.0
            nt.links.new(t.outputs["Alpha"], lt.inputs[0]); nt.links.new(lt.outputs[0], sb.inputs[1])
            nt.links.new(sb.outputs[0], b.inputs["Alpha"])
    if vcol:
        ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "Col"; ca.location = (-400, 450)
        if col_out is not None:
            mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"
            mx.location = (0, 300); mx.inputs[0].default_value = 1.0
            nt.links.new(col_out, mx.inputs[6]); nt.links.new(ca.outputs["Color"], mx.inputs[7])
            col_out = mx.outputs[2]
        else:
            col_out = ca.outputs["Color"]
    if col_out is not None:
        nt.links.new(col_out, b.inputs["Base Color"])
    if normal_img:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = normal_img; t.location = (-400, -350)
        if vec: nt.links.new(vec, t.inputs[0])
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.location = (0, -350)
        nm.inputs["Strength"].default_value = nstrength
        nt.links.new(t.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs[0], b.inputs["Normal"])
    m.use_backface_culling = not double
    try:
        m.surface_render_method = "DITHERED"
    except Exception:
        pass
    return m


def build_terrain(mesh_name="GardenTerrain_Mesh"):
    gx, gy = np.meshgrid(XS, YS)
    gz = height(gx, gy)
    nx, ny = len(XS), len(YS)
    me = bpy.data.meshes.get(mesh_name)
    if me is None:
        me = bpy.data.meshes.new(mesh_name)
        faces = []
        for j in range(ny - 1):
            for i in range(nx - 1):
                a = j * nx + i
                faces.append((a, a + 1, a + nx + 1, a + nx))
        me.from_pydata(np.stack([gx, gy, gz], -1).reshape(-1, 3).tolist(), [], faces)
        uv = me.uv_layers.new(name="UVMap")
        u = ((gx - X0) / (X1 - X0)).ravel(); v = ((gy - Y0) / (Y1 - Y0)).ravel()
        lv = np.zeros(len(me.loops), int); me.loops.foreach_get("vertex_index", lv)
        uv.data.foreach_set("uv", np.stack([u[lv], v[lv]], -1).ravel())
        me.shade_smooth()
    else:
        me.vertices.foreach_set("co", np.stack([gx, gy, gz], -1).reshape(-1).astype(np.float32))
    me.update()
    return me

def build_terrain_albedo(R=2048):
    pu = (np.arange(R) + 0.5) / R
    PX, PY = np.meshgrid(X0 + pu * (X1 - X0), Y0 + pu * (Y1 - Y0))
    H = height(PX, PY); D = pond_d(PX, PY)
    dzx = np.gradient(H, axis=1) / ((X1 - X0) / R); dzy = np.gradient(H, axis=0) / ((Y1 - Y0) / R)
    slope = np.hypot(dzx, dzy)
    c1, c2, c3 = N_col1(PX, PY), N_col2(PX, PY), N_col3(PX, PY)
    f1, f2 = N_fine(PX, PY), N_fine(PX * 3.7 + 11, PY * 3.7 - 5)
    grass_a = np.array([0.12, 0.22, 0.04]); grass_b = np.array([0.27, 0.39, 0.07]); grass_dry = np.array([0.44, 0.42, 0.16])
    soil = np.array([0.34, 0.26, 0.17]); soil_dk = np.array([0.18, 0.14, 0.095]); mud = np.array([0.23, 0.20, 0.13])
    C = lerp(grass_a, grass_b, smoothstep(-0.9, 0.9, c1 + 0.3 * f1))
    C = lerp(C, grass_dry, 0.65 * smoothstep(0.5, 1.6, c3))
    m_soil = np.maximum(smoothstep(1.0, 1.6, c2 + 0.45 * f1), smoothstep(0.30, 0.55, slope))
    C = lerp(C, soil, 0.85 * m_soil)
    C = lerp(C, soil_dk, 0.75 * smoothstep(1.6, 1.04, D))
    inside = lerp(mud, soil_dk * 0.75, smoothstep(0.95, 0.45, D))
    C = np.where((D < 1.0)[..., None], inside, C)
    rng = np.random.default_rng(5)
    peb = (rng.random((R, R)) > 0.985) & (D > 0.9) & (D < 1.5)
    C = np.where(peb[..., None], np.array([0.46, 0.43, 0.38]) * (0.8 + 0.4 * rng.random((R, R, 1))), C)
    C *= (0.86 + 0.14 * f2[..., None]) * (0.92 + 0.08 * f1[..., None])
    return save_img("terrain_albedo", C)


# ------------------------------------------------------------- vegetation textures
def _draw_leaf(img, base, ang, L, W, col, rng, lobed=False):
    H, Wd = img.shape[:2]
    d = np.array([math.cos(ang), math.sin(ang)]); pp = np.array([-d[1], d[0]])
    tip = base + d * L
    xs = [base[0], tip[0], base[0] + pp[0] * W, base[0] - pp[0] * W, tip[0] + pp[0] * W, tip[0] - pp[0] * W]
    ys = [base[1], tip[1], base[1] + pp[1] * W, base[1] - pp[1] * W, tip[1] + pp[1] * W, tip[1] - pp[1] * W]
    x0, x1 = int(max(0, min(xs) - 3)), int(min(Wd, max(xs) + 3))
    y0, y1 = int(max(0, min(ys) - 3)), int(min(H, max(ys) + 3))
    if x1 <= x0 or y1 <= y0: return
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(float)
    rx, ry = xx - base[0], yy - base[1]
    sx = rx * d[0] + ry * d[1]; w = rx * pp[0] + ry * pp[1]
    t = np.clip(sx / L, 0, 1)
    prof = (4 * t * (1 - t)) ** 0.62 * (1.15 - 0.35 * t)
    if lobed: prof *= 1 + 0.06 * np.sin(t * 40)
    half = W * prof * (1 + 0.04 * np.sin(t * 9 + rng.random() * 6))
    a = np.clip((half - np.abs(w)) / 1.3, 0, 1) * np.clip(sx / 1.5, 0, 1) * np.clip((L - sx) / 1.5, 0, 1)
    edge = np.clip(1 - np.abs(w) / np.maximum(half, 1e-3), 0, 1)
    shade = 0.70 + 0.30 * edge ** 0.6
    vein = np.clip(1 - np.abs(w) / 2.2, 0, 1) * 0.18
    side = np.sin((sx - np.abs(w) * 0.9) / L * 2 * np.pi * 7.0)
    vein += 0.06 * np.clip((side - 0.82) / 0.18, 0, 1) * edge
    sideshade = np.where(w > 0, 1.0, 0.9)
    c = np.asarray(col)[None, None, :] * (shade * sideshade)[..., None] + vein[..., None] * np.array([0.35, 0.38, 0.22])
    c *= 1 + 0.06 * (rng.random(c.shape[:2])[..., None] - 0.5)
    tgt = img[y0:y1, x0:x1]
    aa = a[..., None]
    tgt[..., :3] = tgt[..., :3] * (1 - aa) + c * aa
    tgt[..., 3:] = np.maximum(tgt[..., 3:], aa)

def _draw_line(img, pts, w0, w1, col):
    H, Wd = img.shape[:2]
    n = len(pts)
    for k in range(n - 1):
        a, b = np.array(pts[k], float), np.array(pts[k + 1], float)
        wa = w0 + (w1 - w0) * k / (n - 1); wb = w0 + (w1 - w0) * (k + 1) / (n - 1)
        x0, x1 = int(max(0, min(a[0], b[0]) - wa - 2)), int(min(Wd, max(a[0], b[0]) + wa + 2))
        y0, y1 = int(max(0, min(a[1], b[1]) - wa - 2)), int(min(H, max(a[1], b[1]) + wa + 2))
        if x1 <= x0 or y1 <= y0: continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(float)
        ab = b - a; l2 = max(ab @ ab, 1e-6)
        t = np.clip(((xx - a[0]) * ab[0] + (yy - a[1]) * ab[1]) / l2, 0, 1)
        dist = np.hypot(xx - (a[0] + t * ab[0]), yy - (a[1] + t * ab[1]))
        ww = wa + (wb - wa) * t
        al = np.clip(ww - dist + 0.5, 0, 1)[..., None]
        tgt = img[y0:y1, x0:x1]
        tgt[..., :3] = tgt[..., :3] * (1 - al) + np.asarray(col) * al
        tgt[..., 3:] = np.maximum(tgt[..., 3:], al)

def _sprig(S, seed, n, Ll, Wl, pal, stem_col, branchy=False, lobed=False):
    rng = np.random.default_rng(seed)
    img = np.zeros((S, S, 4), np.float32)
    bend = rng.uniform(-0.12, 0.12) * S
    stem = [(S * 0.5 + bend * (t ** 2), S * (0.03 + 0.80 * t)) for t in np.linspace(0, 1, 12)]
    stems = [stem]
    if branchy:
        for k in range(3):
            t0 = rng.uniform(0.2, 0.6); i0 = int(t0 * 11)
            sgn = 1 if k % 2 else -1
            p0 = np.array(stem[i0]); dirv = np.array([sgn * rng.uniform(0.5, 0.9), 1.0]); dirv /= np.linalg.norm(dirv)
            ln = rng.uniform(0.3, 0.45) * S
            stems.append([tuple(p0 + dirv * ln * t + np.array([0, -0.05 * S * t * t])) for t in np.linspace(0, 1, 6)])
    leaves = []
    for st in stems:
        m = n if st is stem else max(3, n // 3)
        for i in range(m):
            t = 0.15 + 0.85 * (i + 0.5) / m
            idx = t * (len(st) - 1); i0 = min(int(idx), len(st) - 2); f = idx - i0
            pt = np.array(st[i0]) * (1 - f) + np.array(st[i0 + 1]) * f
            tang = np.array(st[i0 + 1]) - np.array(st[i0]); ta = math.atan2(tang[1], tang[0])
            side = 1 if i % 2 else -1
            ang = ta + side * math.radians(rng.uniform(32, 62))
            sc_ = rng.uniform(0.75, 1.1) * (1.0 - 0.25 * t)
            leaves.append((pt, ang, Ll * sc_, Wl * sc_))
        tipp = np.array(st[-1]); tg = np.array(st[-1]) - np.array(st[-2])
        leaves.append((tipp - tg * 0.3, math.atan2(tg[1], tg[0]) + rng.uniform(-0.2, 0.2), Ll * 0.9, Wl * 0.85))
    for st in stems:
        _draw_line(img, st, 0.006 * S if st is stem else 0.004 * S, 0.0025 * S, stem_col)
    order = rng.permutation(len(leaves))
    for k in order:
        pt, ang, ll, wl = leaves[k]
        col = np.array(pal[rng.integers(len(pal))]) * rng.uniform(0.85, 1.12)
        _draw_leaf(img, pt, ang, ll, wl, col, rng, lobed)
    return img

def build_leaf_atlas(S=1024):
    A = np.zeros((2 * S, 2 * S, 4), np.float32)
    treeA = [(0.20, 0.32, 0.08), (0.26, 0.38, 0.10), (0.17, 0.27, 0.07), (0.30, 0.40, 0.12)]
    treeB = [(0.27, 0.36, 0.09), (0.34, 0.42, 0.13), (0.22, 0.31, 0.08), (0.38, 0.43, 0.15)]
    bush = [(0.14, 0.24, 0.07), (0.19, 0.30, 0.08), (0.12, 0.20, 0.06), (0.22, 0.33, 0.10)]
    A[0:S, 0:S] = _sprig(S, 101, 12, 0.24 * S, 0.075 * S, treeA, (0.25, 0.20, 0.12), branchy=True)
    A[0:S, S:2 * S] = _sprig(S, 202, 8, 0.29 * S, 0.095 * S, treeB, (0.28, 0.22, 0.13), branchy=True, lobed=True)
    A[S:2 * S, 0:S] = _sprig(S, 303, 20, 0.12 * S, 0.042 * S, bush, (0.22, 0.18, 0.10), branchy=True)
    rng = np.random.default_rng(404)
    big = np.zeros((S, S, 4), np.float32)
    _draw_line(big, [(S * 0.5, 0), (S * 0.5, S * 0.12)], 0.01 * S, 0.008 * S, (0.20, 0.27, 0.09))
    _draw_leaf(big, np.array([S * 0.5, S * 0.1]), math.pi / 2, 0.86 * S, 0.30 * S, np.array([0.20, 0.31, 0.09]), rng)
    A[S:2 * S, S:2 * S] = big
    for (r0, c0) in [(0, 0), (0, S), (S, 0), (S, S)]:
        cell = A[r0:r0 + S, c0:c0 + S]
        m = cell[..., 3] > 0.9
        mean = cell[m][:, :3].mean(0) if m.any() else np.array([0.2, 0.3, 0.1])
        bg = cell[..., 3:] < 0.02
        cell[..., :3] = np.where(bg, mean, np.where(cell[..., 3:] > 0, cell[..., :3] / np.maximum(cell[..., 3:], 1e-3) * cell[..., 3:] + mean * (1 - cell[..., 3:]), mean))
    return save_img("leaf_atlas", A, alpha=True)

LEAF_CELLS = {"treeA": (0.0, 0.0), "treeB": (0.5, 0.0), "bush": (0.0, 0.5), "plant": (0.5, 0.5)}

def build_bark(S=1024):
    h = 0.7 * periodic_noise(S, 41, 2.0, aniso=(1.0, 7.0)) + 0.3 * periodic_noise(S, 42, 1.5, aniso=(1.0, 3.0))
    crack = np.abs(periodic_noise(S, 43, 2.2, aniso=(1.0, 9.0)))
    hh = h - 1.2 * np.exp(-crack * 4.0)
    lic = smoothstep(1.3, 2.0, periodic_noise(S, 44, 2.5))
    C = lerp(np.array([0.11, 0.09, 0.07]), np.array([0.36, 0.31, 0.25]), smoothstep(-1.4, 0.9, hh))
    C = lerp(C, np.array([0.46, 0.47, 0.34]), 0.55 * lic)
    a = save_img("bark_albedo", C)
    n = save_img("bark_normal", normal_from_height(hh, 3.0), noncolor=True)
    return a, n

def build_rock(S=1024):
    h = periodic_noise(S, 51, 2.3) + 0.35 * periodic_noise(S, 52, 1.3)
    cr = np.abs(periodic_noise(S, 53, 2.0))
    hh = h - 0.9 * np.exp(-cr * 6.0)
    tone = periodic_noise(S, 54, 2.6)
    C = lerp(np.array([0.30, 0.27, 0.23]), np.array([0.47, 0.45, 0.41]), smoothstep(-1.5, 1.5, hh + 0.5 * tone))
    C = lerp(C, np.array([0.38, 0.33, 0.26]), 0.4 * smoothstep(0.3, 1.5, periodic_noise(S, 55, 2.4)))
    lic = smoothstep(1.4, 2.1, periodic_noise(S, 56, 1.6))
    C = lerp(C, np.array([0.58, 0.57, 0.45]), 0.6 * lic)
    C *= (0.92 + 0.08 * periodic_noise(S, 57, 0.8))[..., None]
    a = save_img("rock_albedo", C)
    n = save_img("rock_normal", normal_from_height(hh, 2.2), noncolor=True)
    return a, n

def build_grass_tex(W=128, H=512):
    v = np.linspace(0, 1, H)[:, None] * np.ones((1, W)); u = np.linspace(-1, 1, W)[None, :] * np.ones((H, 1))
    C = lerp(np.array([0.09, 0.12, 0.04]), np.array([0.34, 0.44, 0.13]), smoothstep(0.0, 0.45, v))
    C = lerp(C, np.array([0.52, 0.53, 0.25]), smoothstep(0.65, 1.0, v))
    C *= (0.85 + 0.15 * (1 - np.abs(u)) ** 0.5)[..., None]
    streak = periodic_noise(W if W == H else max(W, H), 61, 1.5)[:H, :W]
    C *= (0.93 + 0.07 * streak)[..., None]
    return save_img("grass_blade_albedo", C)


# ------------------------------------------------------------- mesh builder
def frames_along(pts):
    pts = [Vector(p) for p in pts]; n = len(pts)
    T = []
    for i in range(n):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        T.append(t.normalized())
    up = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    N = [T[0].cross(up).normalized()]
    for i in range(1, n):
        v = N[-1] - T[i] * N[-1].dot(T[i])
        N.append(v.normalized() if v.length > 1e-6 else N[-1])
    B = [T[i].cross(N[i]) for i in range(n)]
    return T, N, B

class MB:
    def __init__(s):
        s.v = []; s.f = []; s.uv = []; s.col = []; s.n = []
    def tube(s, pts, radii, ring, utile=1.0, vtile=1.5, flare=None, col=(1, 1, 1)):
        T, N, B = frames_along(pts)
        base = len(s.v); acc = [0.0]
        for i in range(1, len(pts)): acc.append(acc[-1] + (Vector(pts[i]) - Vector(pts[i - 1])).length)
        circ = max(1, round(2 * math.pi * radii[0] / 0.8))
        for i, pnt in enumerate(pts):
            for k in range(ring + 1):
                th = 2 * math.pi * k / ring
                r = radii[i] * (flare(i, th) if flare else 1.0)
                d = N[i] * math.cos(th) + B[i] * math.sin(th)
                s.v.append(Vector(pnt) + d * r); s.n.append(d.copy())
                s.uv.append((k / ring * circ * utile, acc[i] / vtile)); s.col.append(col)
        for i in range(len(pts) - 1):
            for k in range(ring):
                a = base + i * (ring + 1) + k
                s.f.append((a, a + 1, a + ring + 2, a + ring + 1))
    def card(s, p, outdir, size, cell, rng, tint, center, rc, droop=0.12):
        outdir = Vector(outdir).normalized()
        rv = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized()
        up = (outdir * 1.0 + rv * 0.55 + Vector((0, 0, 0.25))).normalized()
        r2 = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
        side = up.cross(r2).normalized()
        nrm = side.cross(up)
        if nrm.dot(outdir) < 0: side = -side; nrm = -nrm
        base = Vector(p) - up * size * 0.12
        cu, cv = cell
        b0 = len(s.v)
        for t in (0.0, 0.5, 1.0):
            c = base + up * size * t + Vector((0, 0, -1)) * droop * size * t * t + nrm * 0.06 * size * math.sin(math.pi * t)
            for sgn, uu in ((-1, 0.0), (1, 1.0)):
                vv = c + side * sgn * size * 0.5
                s.v.append(vv)
                radial = (vv - Vector(center))
                rl = radial.length
                radial = radial.normalized() if rl > 1e-6 else outdir
                s.n.append((nrm * 0.3 + radial * 0.7).normalized())
                s.uv.append((cu + uu * 0.5, cv + t * 0.5))
                ao = 0.55 + 0.45 * min(1.0, rl / max(rc, 1e-3))
                ao *= 0.82 + 0.18 * max(0.0, min(1.0, (vv.z - center[2]) / max(rc, 1e-3) * 0.5 + 0.5))
                s.col.append(tuple(min(1.0, tint[i] * ao) for i in range(3)))
        s.f.append((b0, b0 + 1, b0 + 3, b0 + 2)); s.f.append((b0 + 2, b0 + 3, b0 + 5, b0 + 4))
    def to_mesh(s, name, mats, origin=(0, 0, 0)):
        old = bpy.data.meshes.get(name)
        if old: bpy.data.meshes.remove(old)
        me = bpy.data.meshes.new(name)
        o = Vector(origin)
        me.from_pydata([tuple(v - o) for v in s.v], [], s.f)
        for m in (mats if isinstance(mats, (list, tuple)) else [mats]): me.materials.append(m)
        lv = np.zeros(len(me.loops), int); me.loops.foreach_get("vertex_index", lv)
        uv = me.uv_layers.new(name="UVMap")
        uva = np.array(s.uv, np.float32); uv.data.foreach_set("uv", uva[lv].ravel())
        ca = me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
        cc = np.ones((len(s.v), 4), np.float32); cc[:, :3] = np.array(s.col, np.float32)
        ca.data.foreach_set("color", cc.ravel())
        me.color_attributes.active_color = ca; me.color_attributes.render_color_index = 0
        me.shade_smooth()
        me.normals_split_custom_set_from_vertices([tuple(n.normalized()) for n in s.n])
        me.update()
        return me

def link_obj(name, me, collection, parent, world_loc, parent_world=(0, 0, 0)):
    o = bpy.data.objects.get(name)
    if o: bpy.data.objects.remove(o, do_unlink=True)
    o = bpy.data.objects.new(name, me); collection.objects.link(o)
    o.parent = parent
    o.location = Vector(world_loc) - Vector(parent_world)
    return o

def grow(start, direction, length, segs, up_bias, wander, rng):
    pts = [Vector(start)]; d = Vector(direction).normalized(); step = length / segs
    for i in range(segs):
        d = (d + Vector((0, 0, up_bias)) + Vector((rng.gauss(0, wander), rng.gauss(0, wander), rng.gauss(0, wander * 0.5)))).normalized()
        pts.append(pts[-1] + d * step)
    return pts

def path_at(pts, t):
    acc = [0.0]
    for i in range(1, len(pts)): acc.append(acc[-1] + (pts[i] - pts[i - 1]).length)
    L_ = acc[-1] * t
    for i in range(1, len(pts)):
        if acc[i] >= L_:
            f = (L_ - acc[i - 1]) / max(acc[i] - acc[i - 1], 1e-9)
            return pts[i - 1].lerp(pts[i], f), (pts[i] - pts[i - 1]).normalized(), i
    return pts[-1].copy(), (pts[-1] - pts[-2]).normalized(), len(pts) - 1

def leaf_cluster(mb, center, rc, outbias, n, card_rng, cell, rng, tint_base, squash=0.78):
    for k in range(n):
        while True:
            q = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
            if q.length <= 1: break
        rr = q.length ** 0.4
        q = q.normalized() * rr
        pt = Vector(center) + Vector((q.x * rc, q.y * rc, q.z * rc * squash))
        outd = (pt - Vector(center)); outd = outd.normalized() if outd.length > 1e-4 else Vector(outbias)
        outd = (outd + Vector(outbias) * 0.35).normalized()
        sz = rng.uniform(*card_rng)
        hue = rng.uniform(-0.04, 0.04); br = rng.uniform(0.82, 1.12)
        tint = (min(1, (tint_base[0] + hue) * br), min(1, tint_base[1] * br), min(1, (tint_base[2] - hue * 0.5) * br))
        mb.card(pt, outd, sz, LEAF_CELLS[cell], rng, tint, center, rc)

TREE_SPECS = {
    "A": dict(leader=6.4, r0=0.21, nb=6, bh=(0.40, 0.86), elev=(32, 58), blen=(2.3, 3.3), twigs=(2, 3),
              crc=(1.15, 1.6), card=(0.55, 0.78), cell="treeA", dens=44, lean=0.06, tint=(0.95, 1.0, 0.92)),
    "B": dict(leader=4.6, r0=0.27, nb=7, bh=(0.34, 0.82), elev=(10, 32), blen=(3.0, 4.4), twigs=(2, 3),
              crc=(1.25, 1.8), card=(0.6, 0.85), cell="treeB", dens=42, lean=0.10, tint=(1.0, 1.0, 0.9)),
    "C": dict(leader=9.4, r0=0.25, nb=8, bh=(0.36, 0.92), elev=(38, 66), blen=(1.7, 3.0), twigs=(1, 3),
              crc=(0.9, 1.35), card=(0.5, 0.72), cell="treeA", dens=36, lean=0.05, tint=(0.92, 1.0, 0.95)),
    "FarA": dict(leader=6.2, r0=0.2, nb=5, bh=(0.42, 0.85), elev=(30, 55), blen=(2.2, 3.0), twigs=(0, 1),
              crc=(1.6, 2.2), card=(1.0, 1.45), cell="treeA", dens=13, lean=0.06, tint=(0.92, 1.0, 0.92)),
    "FarB": dict(leader=4.8, r0=0.25, nb=6, bh=(0.36, 0.82), elev=(14, 34), blen=(2.8, 3.8), twigs=(0, 1),
              crc=(1.7, 2.3), card=(1.1, 1.5), cell="treeB", dens=12, lean=0.08, tint=(1.0, 1.0, 0.9)),
    "D": dict(leader=3.1, r0=0.06, nb=4, bh=(0.45, 0.86), elev=(32, 55), blen=(0.6, 1.05), twigs=(1, 2),
              crc=(0.42, 0.62), card=(0.3, 0.42), cell="treeB", dens=46, lean=0.08, tint=(1.0, 1.0, 0.92)),
}

def make_tree(var, spec, seed, coll_, parent, origin, m_bark, m_leaf):
    rng = random.Random(seed)
    O = Vector(origin)
    root = empty("Tree_" + var, coll_, parent=parent, loc=O - (parent.matrix_world.translation if parent else Vector()), size=1)
    leanv = Vector((rng.gauss(0, spec["lean"]), rng.gauss(0, spec["lean"]), 1)).normalized()
    lead = grow(Vector((0, 0, 0)), leanv, spec["leader"], 14, 0.10, 0.07, rng)
    r0 = spec["r0"]
    trunk_r = lambda t: r0 * (1 - 0.82 * t) + 0.012
    radii = [trunk_r(i / (len(lead) - 1)) for i in range(len(lead))]
    phi = rng.uniform(0, 6.28)
    def flare(i, th):
        z = lead[i].z
        return 1 + 0.6 * math.exp(-z / 0.35) * (0.65 + 0.35 * math.cos(5 * th + phi)) + 0.03 * math.sin(3 * th + z * 4)
    mb = MB(); mb.tube(lead, radii, 12, 1.0, 1.6, flare)
    tr = mb.to_mesh("Tree_%s_Trunk_Mesh" % var, m_bark)
    trunk = link_obj("Tree_%s_Trunk" % var, tr, coll_, root, (0, 0, 0))
    clusters = []
    def make_cluster(cname, pivot, center, rc, outb, parent_obj, parent_w):
        cm = MB()
        n = int(spec["dens"] * rc * rc)
        leaf_cluster(cm, center - pivot, rc, outb, n, spec["card"], spec["cell"], rng, spec["tint"])
        me = cm.to_mesh(cname + "_Mesh", m_leaf)
        ob = link_obj(cname, me, coll_, parent_obj, pivot, parent_w)
        clusters.append(ob); return ob
    ci = 1
    ga = rng.uniform(0, 6.28)
    for b in range(spec["nb"]):
        t = spec["bh"][0] + (spec["bh"][1] - spec["bh"][0]) * (b + rng.uniform(-0.3, 0.3)) / max(1, spec["nb"] - 1)
        t = min(max(t, spec["bh"][0]), spec["bh"][1])
        p0, tdir, _ = path_at(lead, t)
        ga += 2.39996 + rng.uniform(-0.35, 0.35)
        el = math.radians(rng.uniform(*spec["elev"]))
        dirv = Vector((math.cos(ga) * math.cos(el), math.sin(ga) * math.cos(el), math.sin(el)))
        blen = rng.uniform(*spec["blen"]) * (1.15 - 0.35 * (t - spec["bh"][0]) / max(1e-3, spec["bh"][1] - spec["bh"][0]))
        start = p0 - dirv * trunk_r(t) * 0.5
        bp = grow(start, dirv, blen, 8, 0.07, 0.10, rng)
        rb = trunk_r(t) * rng.uniform(0.55, 0.7)
        bm = MB(); bm.tube(bp, [rb * (1 - 0.85 * i / 8) + 0.008 for i in range(9)], 7, 1.0, 1.2)
        twig_tips = []
        for w in range(rng.randint(*spec["twigs"])):
            tt = rng.uniform(0.4, 0.82)
            q0, qd, _ = path_at(bp, tt)
            side = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.uniform(0.2, 0.9))).normalized()
            td = (qd * 0.5 + side).normalized()
            tp = grow(q0, td, blen * rng.uniform(0.3, 0.45), 4, 0.12, 0.12, rng)
            rt = (rb * (1 - 0.85 * tt) + 0.008) * 0.6
            bm.tube(tp, [rt * (1 - 0.8 * i / 4) + 0.005 for i in range(5)], 5, 1.0, 1.2)
            twig_tips.append((tp[-1], (tp[-1] - tp[-2]).normalized()))
        twig_tips.append((bp[-1], (bp[-1] - bp[-2]).normalized()))
        bname = "Tree_%s_Branch_%02d" % (var, b + 1)
        bme = bm.to_mesh(bname + "_Mesh", m_bark, origin=start)
        bob = link_obj(bname, bme, coll_, trunk, start, (0, 0, 0))
        for tip, td in twig_tips:
            rc = rng.uniform(*spec["crc"])
            center = tip + td * rc * 0.35 + Vector((0, 0, rc * 0.15))
            pivot = tip - td * rc * 0.25
            make_cluster("Tree_%s_LeafCluster_%02d" % (var, ci), pivot, center, rc, td, bob, start); ci += 1
    tip = lead[-1]; td = (lead[-1] - lead[-2]).normalized()
    rc = spec["crc"][1] * 1.05
    make_cluster("Tree_%s_LeafCluster_%02d" % (var, ci), tip - td * rc * 0.3, tip + td * rc * 0.3, rc, td, trunk, (0, 0, 0))
    return root, trunk, clusters


# ------------------------------------------------------------- bushes
BUSH_SPECS = {
    "A": dict(stems=6, elev=(45, 70), slen=(0.7, 1.05), crc=(0.42, 0.6), card=(0.36, 0.5), dens=115, tint=(1.25, 1.22, 1.1), extra=3),
    "B": dict(stems=7, elev=(22, 42), slen=(0.9, 1.4), crc=(0.36, 0.52), card=(0.34, 0.46), dens=115, tint=(1.35, 1.28, 1.0), extra=2),
    "C": dict(stems=5, elev=(62, 82), slen=(1.0, 1.55), crc=(0.38, 0.55), card=(0.36, 0.5), dens=110, tint=(1.15, 1.2, 1.08), extra=3),
}

def make_bush(var, spec, seed, coll_, parent, m_bark, m_leaf):
    rng = random.Random(seed)
    root = empty("Bush_" + var, coll_, parent=parent, size=0.6)
    sm = MB(); tips = []
    for k in range(spec["stems"]):
        az = 2 * math.pi * k / spec["stems"] + rng.uniform(-0.4, 0.4)
        el = math.radians(rng.uniform(*spec["elev"]))
        d = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        st = grow(Vector((rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08), -0.05)), d, rng.uniform(*spec["slen"]), 5, 0.1, 0.15, rng)
        sm.tube(st, [0.03 * (1 - 0.8 * i / 5) + 0.006 for i in range(6)], 5, 1.0, 0.8)
        tips.append((st[-1], (st[-1] - st[-2]).normalized()))
        mid, md, _ = path_at(st, rng.uniform(0.45, 0.6))
        tips.append((mid, (md + Vector((math.cos(az), math.sin(az), 0)) * 0.8).normalized()))
    for k in range(spec["extra"]):
        az = rng.uniform(0, 6.28)
        tips.append((Vector((math.cos(az) * 0.25, math.sin(az) * 0.25, 0.25)), Vector((math.cos(az), math.sin(az), 0.6)).normalized()))
    sme = sm.to_mesh("Bush_%s_Stems_Mesh" % var, m_bark)
    stems = link_obj("Bush_%s_Stems" % var, sme, coll_, root, (0, 0, 0))
    out = []
    for i, (tip, td) in enumerate(tips):
        rc = rng.uniform(*spec["crc"])
        center = tip + td * rc * 0.3
        pivot = tip - td * rc * 0.3
        if pivot.z < 0.05: pivot.z = 0.05
        cm = MB()
        leaf_cluster(cm, center - pivot, rc, td, int(spec["dens"] * rc * rc), spec["card"], "bush", rng, spec["tint"], squash=0.85)
        me = cm.to_mesh("Bush_%s_LeafCluster_%02d_Mesh" % (var, i + 1), m_leaf)
        out.append(link_obj("Bush_%s_LeafCluster_%02d" % (var, i + 1), me, coll_, stems, pivot))
    return root, out

# ------------------------------------------------------------- grass
GRASS_SPECS = {
    "Grass_Clump_A": dict(n=46, r=0.26, h=(0.32, 0.68), w=(0.016, 0.026), lean=0.35, curl=0.5, tint=((0.85, 1.0, 0.85), (1.05, 1.05, 0.85)), dry=0.08),
    "Grass_Clump_B": dict(n=30, r=0.3, h=(0.5, 0.95), w=(0.015, 0.023), lean=0.45, curl=0.7, tint=((0.9, 1.0, 0.8), (1.15, 1.08, 0.75)), dry=0.18),
    "Grass_Clump_C": dict(n=56, r=0.42, h=(0.16, 0.38), w=(0.014, 0.022), lean=0.5, curl=0.45, tint=((0.8, 0.95, 0.8), (1.0, 1.05, 0.85)), dry=0.06),
    "Grass_Clump_D": dict(n=36, r=0.3, h=(0.28, 0.6), w=(0.013, 0.021), lean=0.4, curl=0.6, tint=((1.15, 1.05, 0.7), (1.3, 1.15, 0.7)), dry=0.45),
    "Grass_Shoreline_A": dict(n=24, r=0.2, h=(0.7, 1.35), w=(0.02, 0.032), lean=0.15, curl=0.35, tint=((0.75, 0.92, 0.75), (0.9, 1.0, 0.8)), dry=0.05),
}

def make_grass(name, spec, seed, coll_, parent, m_grass):
    rng = random.Random(seed)
    mb = MB()
    SEG = 4
    for b in range(spec["n"]):
        rr = spec["r"] * math.sqrt(rng.random()); az = rng.uniform(0, 6.28)
        rootp = Vector((math.cos(az) * rr, math.sin(az) * rr, -0.02))
        h = rng.uniform(*spec["h"]) * (1.0 - 0.35 * rr / spec["r"])
        w = rng.uniform(*spec["w"])
        outd = Vector((math.cos(az), math.sin(az), 0)) * (rr / spec["r"])
        lean = (outd * spec["lean"] + Vector((rng.gauss(0, 0.18), rng.gauss(0, 0.18), 0)))
        curl = spec["curl"] * rng.uniform(0.5, 1.3)
        facing = rng.uniform(0, 6.28)
        side = Vector((math.cos(facing), math.sin(facing), 0))
        dry = rng.random() < spec["dry"]
        t0, t1 = spec["tint"]
        f = rng.random()
        tint = tuple((t0[i] * (1 - f) + t1[i] * f) * rng.uniform(0.9, 1.08) for i in range(3))
        if dry: tint = (tint[0] * 1.45, tint[1] * 1.15, tint[2] * 0.75)
        tint = tuple(min(1.0, c * 0.8) for c in tint)
        b0 = len(mb.v)
        pts = []
        for k in range(SEG + 1):
            t = k / SEG
            off = lean * h * (t ** 1.6) * (1 + curl)
            pts.append(rootp + Vector((0, 0, h * t * (1 - 0.25 * curl * t * t))) + off)
        for k in range(SEG + 1):
            t = k / SEG
            if k == SEG:
                mb.v.append(pts[k]); mb.uv.append((0.5, 1.0)); mb.col.append(tint)
                mb.n.append(Vector((0, 0, 1)))
                continue
            ww = w * (1 - t) ** 0.7
            tang = (pts[min(k + 1, SEG)] - pts[k]).normalized()
            nrm = side.cross(tang).normalized()
            for sg, uu in ((-1, 0.0), (1, 1.0)):
                mb.v.append(pts[k] + side * sg * ww)
                mb.uv.append((uu, t)); mb.col.append(tint)
                mb.n.append((nrm * 0.45 + Vector((0, 0, 1)) * 0.55).normalized())
        for k in range(SEG - 1):
            a = b0 + k * 2
            mb.f.append((a, a + 1, a + 3, a + 2))
        a = b0 + (SEG - 1) * 2
        mb.f.append((a, a + 1, a + 2))
    me = mb.to_mesh(name + "_Mesh", m_grass)
    return link_obj(name, me, coll_, parent, (0, 0, 0))

# ------------------------------------------------------------- rocks
ROCK_SPECS = {
    "Rock_Shore_A": dict(size=(1.5, 1.1, 0.8), planes=6, tris=700, seed=1),
    "Rock_Shore_B": dict(size=(1.1, 0.9, 0.75), planes=7, tris=650, seed=2),
    "Rock_Shore_C": dict(size=(2.0, 1.3, 0.95), planes=6, tris=800, seed=3),
    "Rock_Flat_A": dict(size=(1.3, 0.95, 0.35), planes=5, tris=500, seed=4),
    "Rock_Small_A": dict(size=(0.42, 0.33, 0.26), planes=5, tris=220, seed=5),
    "Rock_Small_B": dict(size=(0.3, 0.26, 0.18), planes=5, tris=180, seed=6),
}

def _rock_mesh(name, spec, m_rock):
    from mathutils import noise
    rng = random.Random(spec["seed"] * 77)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
    planes = []
    for i in range(spec["planes"]):
        n = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 0.8) + 0.2)).normalized()
        planes.append((n, rng.uniform(0.72, 0.92)))
    off = Vector((rng.uniform(0, 100), rng.uniform(0, 100), rng.uniform(0, 100)))
    for v in bm.verts:
        d = v.co.normalized()
        r = 1 + 0.22 * noise.fractal(d * 1.3 + off, 0.6, 2.0, 4) + 0.05 * noise.fractal(d * 5 + off, 0.5, 2.0, 3)
        for n, dd in planes:
            dn = d.dot(n)
            if dn > 1e-3 and r * dn > dd: r = dd / dn
        p = d * r
        if p.z < -0.45: p.z = -0.45 + (p.z + 0.45) * 0.15
        v.co = Vector((p.x * spec["size"][0] / 2, p.y * spec["size"][1] / 2, (p.z + 0.45) * spec["size"][2] / 1.45))
    tmp = bpy.data.meshes.new("_rock_tmp"); bm.to_mesh(tmp); bm.free()
    to = bpy.data.objects.new("_rock_tmp", tmp); bpy.context.scene.collection.objects.link(to)
    md = to.modifiers.new("dec", "DECIMATE"); md.ratio = spec["tris"] / len(tmp.polygons)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(to.evaluated_get(dg))
    bpy.data.objects.remove(to); bpy.data.meshes.remove(tmp)
    old = bpy.data.meshes.get(name + "_Mesh")
    if old: bpy.data.meshes.remove(old)
    me.name = name + "_Mesh"
    # box-projected UVs, vertex colour (mossy tops, darker base)
    uv = me.uv_layers.new(name="UVMap")
    ca = me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    zmax = max(v.co.z for v in me.vertices)
    vn = [v.normal.copy() for v in me.vertices]
    for v in me.vertices:
        up = max(0.0, vn[v.index].z); hz = v.co.z / max(zmax, 1e-3)
        c = Vector((1, 1, 1)).lerp(Vector((0.78, 0.86, 0.6)), 0.55 * up ** 3) * (0.62 + 0.38 * min(1, hz * 1.4))
        ca.data[v.index].color = (c.x, c.y, c.z, 1)
    for poly in me.polygons:
        n = poly.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            a, b = [(1, 2), (0, 2), (0, 1)][ax]
            uv.data[li].uv = (co[a] / 1.2, co[b] / 1.2)
    me.color_attributes.active_color = ca
    me.materials.clear(); me.materials.append(m_rock)
    me.shade_smooth()
    try: me.set_sharp_from_angle(angle=math.radians(38))
    except Exception as e: print("sharp", e)
    return me

def make_rock(name, spec, coll_, parent, m_rock):
    me = _rock_mesh(name, spec, m_rock)
    return link_obj(name, me, coll_, parent, (0, 0, 0))

def make_pebbles(name, coll_, parent, m_rock, n=9, seed=9):
    rng = random.Random(seed)
    parts = []
    for i in range(n):
        sz = rng.uniform(0.08, 0.2)
        spec = dict(size=(sz * rng.uniform(1, 1.5), sz, sz * rng.uniform(0.5, 0.8)), planes=4, tris=60, seed=100 + i + seed)
        me = _rock_mesh("_peb%d" % i, spec, m_rock)
        mat = Matrix.Translation((rng.uniform(-0.45, 0.45), rng.uniform(-0.35, 0.35), -0.02)) @ Matrix.Rotation(rng.uniform(0, 6.28), 4, "Z")
        me.transform(mat); parts.append(me)
    bm = bmesh.new()
    for me in parts:
        bm.from_mesh(me)
    out = bpy.data.meshes.get(name + "_Mesh")
    if out: bpy.data.meshes.remove(out)
    out = bpy.data.meshes.new(name + "_Mesh"); bm.to_mesh(out); bm.free()
    for me in parts: bpy.data.meshes.remove(me)
    out.materials.append(m_rock); out.shade_smooth()
    try: out.set_sharp_from_angle(angle=math.radians(38))
    except Exception: pass
    return link_obj(name, out, coll_, parent, (0, 0, 0))

# ------------------------------------------------------------- flowers & plants
def _flower_head(mb, center, axis, petals, plen, pwid, cup, rng, mat_ids, faces_mat):
    axis = axis.normalized()
    t1 = axis.cross(Vector((0.3, 0.1, 0.9)) if abs(axis.z) < 0.95 else Vector((1, 0, 0))).normalized(); t2 = axis.cross(t1)
    ph = rng.uniform(0, 6.28)
    c0 = len(mb.v)
    mb.v.append(center + axis * 0.006); mb.n.append(axis.copy()); mb.uv.append((0.5, 0.5)); mb.col.append((1, 1, 1))
    ring = 8; rr = pwid * 1.1
    for k in range(ring):
        a = 2 * math.pi * k / ring
        mb.v.append(center + (t1 * math.cos(a) + t2 * math.sin(a)) * rr); mb.n.append(axis.copy()); mb.uv.append((0.5, 0.5)); mb.col.append((1, 1, 1))
    for k in range(ring):
        mb.f.append((c0, c0 + 1 + k, c0 + 1 + (k + 1) % ring)); faces_mat.append(mat_ids[1])
    for k in range(petals):
        a = ph + 2 * math.pi * k / petals + rng.uniform(-0.1, 0.1)
        d = (t1 * math.cos(a) + t2 * math.sin(a)); sd = axis.cross(d)
        l = plen * rng.uniform(0.85, 1.1)
        b0 = len(mb.v)
        for j, t in enumerate((0.0, 0.5, 1.0)):
            c = center + d * (rr * 0.6 + l * t) + axis * (cup * l * t * t)
            wv = pwid * (0.5 if t == 0 else (1.0 if t == 0.5 else 0.25))
            for sg in (-1, 1):
                mb.v.append(c + sd * sg * wv); mb.n.append(axis.copy()); mb.uv.append((0.5, 0.5)); mb.col.append((1, 1, 1))
        mb.f.append((b0, b0 + 1, b0 + 3, b0 + 2)); faces_mat.append(mat_ids[0])
        mb.f.append((b0 + 2, b0 + 3, b0 + 5, b0 + 4)); faces_mat.append(mat_ids[0])

FLOWER_SPECS = {
    "Flower_Daisy_A": dict(n=9, h=(0.22, 0.42), petals=12, plen=0.028, pwid=0.006, cup=0.25, petal="M_Petal_White", r=0.28),
    "Flower_Pink_A": dict(n=7, h=(0.25, 0.48), petals=5, plen=0.024, pwid=0.012, cup=0.5, petal="M_Petal_Pink", r=0.25),
    "Flower_Violet_A": dict(n=12, h=(0.15, 0.3), petals=6, plen=0.014, pwid=0.006, cup=0.6, petal="M_Petal_Violet", r=0.3),
}

def make_flowers(name, spec, seed, coll_, parent, mats, m_leaf):
    rng = random.Random(seed)
    mb = MB(); fm = []
    for i in range(spec["n"]):
        rr = spec["r"] * math.sqrt(rng.random()); az = rng.uniform(0, 6.28)
        base = Vector((math.cos(az) * rr, math.sin(az) * rr, -0.02))
        h = rng.uniform(*spec["h"])
        d = Vector((rng.gauss(0, 0.15) + math.cos(az) * 0.15, rng.gauss(0, 0.15) + math.sin(az) * 0.15, 1)).normalized()
        st = grow(base, d, h, 4, 0.05, 0.08, rng)
        nf = len(mb.f); mb.tube(st, [0.0035, 0.003, 0.0028, 0.0025, 0.002], 4, 0.05, 0.3)
        fm += [2] * (len(mb.f) - nf)
        nf = len(mb.f)
        for k in range(rng.randint(1, 3)):
            q, qd, _ = path_at(st, rng.uniform(0.05, 0.45))
            out = Vector((rng.gauss(0, 1), rng.gauss(0, 1), 0.6)).normalized()
            mb.card(q, out, rng.uniform(0.07, 0.11), LEAF_CELLS["plant"], rng, (0.9, 1.0, 0.85), q - out * 0.1, 0.1, droop=0.3)
        fm += [3] * (len(mb.f) - nf)
        tipd = (st[-1] - st[-2]).normalized()
        _flower_head(mb, st[-1], (tipd + Vector((rng.gauss(0, 0.3), rng.gauss(0, 0.3), 0.3))), spec["petals"], spec["plen"], spec["pwid"], spec["cup"], rng, (0, 1), fm)
    me = mb.to_mesh(name + "_Mesh", [mats[spec["petal"]], mats["M_Flower_Center"], mats["M_Plant_Stem"], m_leaf])
    me.polygons.foreach_set("material_index", fm); me.update()
    return link_obj(name, me, coll_, parent, (0, 0, 0))

PLANT_SPECS = {
    "Plant_Broadleaf_A": dict(cell="plant", n=9, size=(0.22, 0.36), elev=(25, 55), droop=0.35, tint=(0.95, 1.0, 0.9)),
    "Plant_Leafy_A": dict(cell="treeA", n=8, size=(0.32, 0.48), elev=(50, 75), droop=0.2, tint=(1.0, 1.05, 0.95)),
    "Plant_Shrublet_A": dict(cell="bush", n=12, size=(0.25, 0.38), elev=(40, 80), droop=0.15, tint=(1.05, 1.05, 0.9)),
}

def make_plant(name, spec, seed, coll_, parent, m_leaf):
    rng = random.Random(seed)
    mb = MB()
    center = Vector((0, 0, 0.12))
    for k in range(spec["n"]):
        az = 2 * math.pi * k / spec["n"] + rng.uniform(-0.3, 0.3)
        el = math.radians(rng.uniform(*spec["elev"]))
        d = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        sz = rng.uniform(*spec["size"])
        p0 = Vector((math.cos(az) * 0.03, math.sin(az) * 0.03, 0.0))
        rb = d.cross(Vector((0, 0, 1))).normalized()
        nrm = rb.cross(d)
        if nrm.z < 0: rb = -rb; nrm = -nrm
        b0 = len(mb.v)
        tint = tuple(min(1, c * rng.uniform(0.85, 1.1)) for c in spec["tint"])
        cu, cv = LEAF_CELLS[spec["cell"]]
        for t in (0.0, 0.5, 1.0):
            c = p0 + d * sz * t + Vector((0, 0, -1)) * spec["droop"] * sz * t * t
            for sg, uu in ((-1, 0.0), (1, 1.0)):
                mb.v.append(c + rb * sg * sz * 0.5)
                mb.n.append((nrm * 0.5 + Vector((0, 0, 1)) * 0.5).normalized())
                mb.uv.append((cu + uu * 0.5, cv + t * 0.5))
                ao = 0.6 + 0.4 * t
                mb.col.append(tuple(c_ * ao for c_ in tint))
        mb.f.append((b0, b0 + 1, b0 + 3, b0 + 2)); mb.f.append((b0 + 2, b0 + 3, b0 + 5, b0 + 4))
    me = mb.to_mesh(name + "_Mesh", m_leaf)
    return link_obj(name, me, coll_, parent, (0, 0, 0))
