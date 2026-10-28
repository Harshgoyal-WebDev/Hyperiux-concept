
# Hyperiux garden: composition / placement (re-runnable)
import bpy, math, random
import numpy as np
from mathutils import Vector, Euler
import garden_lib as L

GROUPS = ["PlacedTrees", "PlacedBushes", "GrassPatches", "PlacedPlants", "FlowerClusters", "PlacedRocks"]
CAM = Vector((0.0, -24.0, 0.0))

def clear_placed():
    ids = []
    for g in GROUPS:
        ids += list(bpy.data.objects[g].children_recursive)
    if ids: bpy.data.batch_remove(ids)

def z_at(x, y):
    return float(L.height(x, y))

def dup(src, prefix, coll_, parent):
    o = src.copy()
    o.name = prefix + "_" + src.name
    coll_.objects.link(o)
    o.parent = parent
    for c in src.children:
        dup(c, prefix, coll_, o)
    return o

def place(src_name, prefix, parent, x, y, rotz, scale, sink=0.0, tilt=(0.0, 0.0)):
    env = bpy.data.collections["GardenEnvironment"]
    src = bpy.data.objects[src_name]
    o = dup(src, prefix, env, parent)
    o.location = (x, y, z_at(x, y) - sink)
    o.rotation_euler = Euler((tilt[0], tilt[1], rotz))
    o.scale = (scale, scale, scale)
    return o

def in_corridor(x, y, half=5.0):
    return abs(x) < half and -36 < y < -9

def in_logo_view(x, y):
    return abs(x) < 10.5 and 8 < y < 75

def run(seed=7):
    clear_placed()
    rng = random.Random(seed)
    O = bpy.data.objects
    T = O["PlacedTrees"]; B = O["PlacedBushes"]; GP = O["GrassPatches"]
    PP = O["PlacedPlants"]; FC = O["FlowerClusters"]; PR = O["PlacedRocks"]
    stats = {}
    # ---------------- trees: hand-composed framing + background
    trees = [("B", -10.8, -17.2, 1.15), ("A", -21.0, 3.5, 1.05), ("C", -17.5, 13.0, 1.0), ("B", -28.0, -8.0, 1.0),
             ("A", 15.5, 6.5, 1.0), ("C", 21.5, -3.0, 1.05), ("B", 27.0, 13.5, 0.95), ("A", 14.0, -16.0, 0.9),
             ("D", -13.5, -4.5, 1.0), ("D", 11.0, -8.5, 1.1), ("D", 19.0, 22.0, 1.2), ("D", -24.5, 20.0, 1.1),
             ("A", -33.0, 22.0, 0.95), ("C", 34.0, 4.0, 1.0)]
    bg = []
    tries = 0
    while len(bg) < 22 and tries < 4000:
        tries += 1
        x = rng.uniform(-70, 70); y = rng.uniform(26, 88)
        if in_logo_view(x, y): continue
        if any((x - a) ** 2 + (y - b) ** 2 < 14 ** 2 for _, a, b, _ in trees + bg): continue
        if L.N_col1(x * 0.5, y * 0.5) < -0.1: continue
        for g in range(rng.randint(1, 3)):
            gx_, gy_ = x + rng.uniform(-5, 5), y + rng.uniform(-4, 4)
            if not in_logo_view(gx_, gy_):
                bg.append((rng.choice(["FarA", "FarA", "FarB", "D"]), gx_, gy_, rng.uniform(0.75, 1.2)))
    side = []
    tries = 0
    while len(side) < 10 and tries < 2000:
        tries += 1
        x = rng.choice([-1, 1]) * rng.uniform(36, 70); y = rng.uniform(-30, 30)
        if any((x - a) ** 2 + (y - b) ** 2 < 10 ** 2 for _, a, b, _ in trees + bg + side): continue
        side.append((rng.choice(["FarA", "FarB"]), x, y, rng.uniform(0.9, 1.15)))
    far = []
    tries = 0
    while len(far) < 26 and tries < 4000:
        tries += 1
        x = rng.uniform(-78, 78); y = rng.uniform(48, 92)
        if any((x - a) ** 2 + (y - b) ** 2 < 6 ** 2 for _, a, b, _ in trees + bg + far): continue
        if L.N_col1(x * 0.7, y * 0.7) < -0.3: continue
        far.append((rng.choice(["FarA", "FarB", "FarA"]), x, y, rng.uniform(0.5, 1.15)))
    tree_list = trees + side + bg + far
    for i, (v, x, y, s) in enumerate(tree_list):
        place("Tree_" + v, "PT%02d" % (i + 1), T, x, y, rng.uniform(0, 6.28), s, sink=0.08)
    stats["trees"] = len(tree_list)
    # ---------------- bushes
    bushes = [(-8.2, -14.5), (-12.6, -15.6), (-19.5, 1.0), (-22.5, 6.0), (-16.0, 11.5), (-11.6, 2.8), (-12.2, -2.8),
              (10.9, -1.0), (12.4, 3.8), (13.8, 8.6), (17.5, 4.0), (19.8, -1.0), (12.5, -14.0), (16.3, -15.5),
              (25.0, 11.0), (-26.0, -6.0), (-30.0, -10.0), (-5.0, 8.4), (5.6, 8.1), (8.8, 6.6), (-9.0, 6.5),
              (-15.0, -8.5), (16.0, -8.0), (-24.0, 17.5), (22.0, 19.0), (30.0, 2.0), (-34.0, 18.0)]
    for i, (x, y) in enumerate(bushes):
        x += rng.uniform(-0.6, 0.6); y += rng.uniform(-0.6, 0.6)
        if L.pond_d(x, y) < 1.12: continue
        sc = rng.uniform(0.75, 1.3) if L.pond_d(x, y) > 1.4 else rng.uniform(0.6, 0.85)
        place("Bush_" + rng.choice("ABC"), "PB%02d" % (i + 1), B, x, y, rng.uniform(0, 6.28), sc, sink=0.05)
    stats["bushes"] = len(B.children)
    # ---------------- rocks: shoreline ring (partially buried), scattered, pebbles
    ri = 0
    shore_angles = [0.25, 0.75, 1.3, 1.7, 2.2, 2.65, 3.3, 3.75, 4.6, 5.3, 5.75]
    for a in shore_angles:
        a += rng.uniform(-0.12, 0.12)
        r = float(L.pond_radius_at(a)) * rng.uniform(1.02, 1.12)
        x, y = r * math.cos(a), r * math.sin(a)
        if in_corridor(x, y, 3.5): continue
        ri += 1
        nm = rng.choice(["Rock_Shore_A", "Rock_Shore_B", "Rock_Shore_C", "Rock_Flat_A"])
        sc = rng.uniform(0.7, 1.15)
        place(nm, "PR%03d" % ri, PR, x, y, rng.uniform(0, 6.28), sc, sink=0.3 * sc * L.ROCK_SPECS[nm]["size"][2],
              tilt=(rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12)))
        for k in range(rng.randint(1, 3)):
            ox, oy = x + rng.uniform(-1.3, 1.3), y + rng.uniform(-1.3, 1.3)
            if L.pond_d(ox, oy) < 0.98: continue
            ri += 1
            nm2 = rng.choice(["Rock_Small_A", "Rock_Small_B"])
            place(nm2, "PR%03d" % ri, PR, ox, oy, rng.uniform(0, 6.28), rng.uniform(0.7, 1.4), sink=0.06,
                  tilt=(rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2)))
    for k in range(10):
        a = rng.uniform(0, 6.28); r = float(L.pond_radius_at(a)) * rng.uniform(0.98, 1.08)
        x, y = r * math.cos(a), r * math.sin(a)
        ri += 1; place("Rock_PebbleCluster_A", "PR%03d" % ri, PR, x, y, a, rng.uniform(0.8, 1.3), sink=0.03)
    scatter = [(4.2, -18.8, "Rock_Shore_B", 0.75), (-5.4, -20.5, "Rock_Flat_A", 0.8), (-3.0, -15.0, "Rock_Small_A", 1.2),
               (7.5, -13.0, "Rock_Small_A", 1.0), (-16.5, -12.0, "Rock_Shore_A", 0.9), (18.0, -11.0, "Rock_Shore_C", 0.8),
               (-20.0, 9.0, "Rock_Shore_B", 1.0), (22.5, 8.0, "Rock_Flat_A", 1.1), (-26.0, 0.0, "Rock_Small_B", 1.6)]
    for (x, y, nm, sc) in scatter:
        ri += 1
        place(nm, "PR%03d" % ri, PR, x, y, rng.uniform(0, 6.28), sc, sink=0.32 * sc * L.ROCK_SPECS[nm]["size"][2],
              tilt=(rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1)))
    for k in range(40):
        x, y = rng.uniform(-32, 32), rng.uniform(-30, 26)
        if L.pond_d(x, y) < 1.05 or in_corridor(x, y, 2.5) or in_logo_view(x, y) and y > 12: continue
        ri += 1
        place(rng.choice(["Rock_Small_A", "Rock_Small_B"]), "PR%03d" % ri, PR, x, y, rng.uniform(0, 6.28), rng.uniform(0.6, 1.3), sink=0.05)
    stats["rocks"] = len(PR.children)
    # ---------------- grass patches
    gi = 0; pi = 0
    env = bpy.data.collections["GardenEnvironment"]
    def grass_ok(x, y):
        d = float(L.pond_d(x, y))
        if d < 1.01: return False
        soil = float(L.N_col2(x, y) + 0.45 * L.N_fine(x, y))
        if soil > 1.1 and d > 1.6: return False
        return True
    centers = []
    tries = 0
    while len(centers) < 330 and tries < 20000:
        tries += 1
        x, y = rng.uniform(-40, 40), rng.uniform(-33, 40)
        r = math.hypot(x, y)
        w = 1.0 if r < 18 else max(0.08, 1 - (r - 18) / 18)
        if y < -14: w = max(w, 0.9)
        if abs(x) > (y + 26) * 0.95 + 3: continue
        if rng.random() > w: continue
        if not grass_ok(x, y): continue
        if any((x - a) ** 2 + (y - b) ** 2 < 1.7 ** 2 for a, b in centers): continue
        centers.append((x, y))
    for (cx, cy) in centers:
        pi += 1
        pe = L.empty("GrassPatch_%03d" % pi, env, parent=GP, loc=(cx, cy, 0), size=0.3)
        n = rng.randint(5, 10)
        corridor = in_corridor(cx, cy, 4.0)
        for k in range(n):
            x = cx + rng.gauss(0, 1.0); y = cy + rng.gauss(0, 1.0)
            if not grass_ok(x, y): continue
            if corridor: v = "Grass_Clump_C"
            else: v = rng.choices(["Grass_Clump_A", "Grass_Clump_B", "Grass_Clump_C", "Grass_Clump_D"], [4, 2, 3, 1.2])[0]
            gi += 1
            o = place(v, "GP%04d" % gi, pe, x - cx, y - cy, rng.uniform(0, 6.28), rng.uniform(0.8, 1.25))
            o.location.z = z_at(x, y) - 0.0
    # dense foreground fill in front of the camera (short grass in the corridor)
    fe = L.empty("GrassPatch_Foreground", env, parent=GP, size=0.3)
    for k in range(260):
        x, y = rng.uniform(-15, 15), rng.uniform(-29, -12)
        if abs(x) > (y + 26) * 0.95 + 4: continue
        if not grass_ok(x, y): continue
        v = "Grass_Clump_C" if in_corridor(x, y, 3.0) else rng.choices(["Grass_Clump_A", "Grass_Clump_B", "Grass_Clump_C", "Grass_Clump_D"], [4, 2, 3, 1])[0]
        gi += 1
        place(v, "GP%04d" % gi, fe, x, y, rng.uniform(0, 6.28), rng.uniform(0.85, 1.25))
    # shoreline reeds
    se = L.empty("GrassPatch_Shoreline", env, parent=GP, size=0.3)
    for k in range(260):
        a = rng.uniform(0, 6.28)
        r = float(L.pond_radius_at(a)) * rng.uniform(1.0, 1.1)
        x, y = r * math.cos(a), r * math.sin(a)
        if in_corridor(x, y, 3.0) or (-2.0 < a < -1.1 and rng.random() < 0.7): continue
        gi += 1
        v = "Grass_Shoreline_A" if rng.random() < 0.6 else "Grass_Clump_A"
        place(v, "GP%04d" % gi, se, x, y, rng.uniform(0, 6.28), rng.uniform(0.7, 1.15))
    stats["grass_clumps"] = gi; stats["grass_patches"] = pi
    # ---------------- flowers & plants
    fi = 0
    for k in range(80):
        if fi >= 34: break
        x, y = rng.uniform(-28, 28), rng.uniform(-30, 20)
        d = float(L.pond_d(x, y))
        if d < 1.08 or (in_corridor(x, y, 2.0)) or (in_logo_view(x, y) and y > 9): continue
        fi += 1
        place(rng.choices(["Flower_Daisy_A", "Flower_Pink_A", "Flower_Violet_A"], [4, 2, 2])[0], "PF%02d" % fi, FC, x, y, rng.uniform(0, 6.28), rng.uniform(0.85, 1.25))
    # a few deliberate foreground daisies (like the reference)
    for (x, y) in [(-6.5, -21.5), (6.0, -21.0), (-3.5, -18.0), (8.5, -17.5), (-9.0, -19.5)]:
        fi += 1; place("Flower_Daisy_A" if fi % 3 else "Flower_Pink_A", "PF%02d" % fi, FC, x, y, rng.uniform(0, 6.28), 1.1)
    pli = 0
    for k in range(200):
        if pli >= 45: break
        x, y = rng.uniform(-30, 30), rng.uniform(-30, 22)
        if L.pond_d(x, y) < 1.04 or in_corridor(x, y, 2.5): continue
        pli += 1
        place(rng.choice(list(L.PLANT_SPECS)), "PP%02d" % pli, PP, x, y, rng.uniform(0, 6.28), rng.uniform(0.8, 1.3))
    stats["flowers"] = fi; stats["plants"] = pli
    return stats
