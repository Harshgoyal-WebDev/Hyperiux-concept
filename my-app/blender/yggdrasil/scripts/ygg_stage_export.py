"""Yggdrasil - preview stage, preview render and export.

The PREVIEW_Stage collection (camera, sun, neutral sand disc, plain sky colour)
exists only so the preview render reads; it is never exported. Only the
"Yggdrasil" collection goes into the GLB.
"""

import math
import bpy
from mathutils import Vector


def _coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def _replace(name, data):
    old = bpy.data.objects.get(name)
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    return bpy.data.objects.new(name, data)


def setup_stage(cam_dist=78.0, cam_height=2.2, target_z=17.0, cam_az_deg=-62.0, lens=24.0):
    scene = bpy.context.scene
    stage = _coll("PREVIEW_Stage")

    # camera: slightly low angle, looking up at the crown
    cam_data = bpy.data.cameras.get("PREVIEW_Camera") or bpy.data.cameras.new("PREVIEW_Camera")
    cam_data.lens = lens
    cam_data.clip_end = 1000.0
    cam = _replace("PREVIEW_Camera", cam_data)
    stage.objects.link(cam)
    a = math.radians(cam_az_deg)
    cam.location = Vector((math.cos(a) * cam_dist, math.sin(a) * cam_dist, cam_height))
    direction = Vector((0.0, 0.0, target_z)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    # warm low desert sun
    sun_data = bpy.data.lights.get("PREVIEW_Sun") or bpy.data.lights.new("PREVIEW_Sun", "SUN")
    sun_data.energy = 4.2
    sun_data.color = (1.0, 0.9, 0.76)
    sun_data.angle = math.radians(1.2)
    sun = _replace("PREVIEW_Sun", sun_data)
    stage.objects.link(sun)
    sun.rotation_euler = (math.radians(52), 0.0, math.radians(-25))

    # neutral sand disc so roots read against a ground plane
    me = bpy.data.meshes.get("PREVIEW_Ground")
    if me is None:
        import bmesh
        me = bpy.data.meshes.new("PREVIEW_Ground")
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=True, radius=140.0, segments=96)
        bm.to_mesh(me)
        bm.free()
    ground = _replace("PREVIEW_Ground", me)
    stage.objects.link(ground)
    gm = bpy.data.materials.get("PREVIEW_Sand") or bpy.data.materials.new("PREVIEW_Sand")
    gm.use_nodes = True
    b = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.42, 0.30, 0.19, 1.0)
    b.inputs["Roughness"].default_value = 0.95
    me.materials.clear()
    me.materials.append(gm)

    # plain sky colour
    world = bpy.data.worlds.get("PREVIEW_World") or bpy.data.worlds.new("PREVIEW_World")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.50, 0.62, 0.78, 1.0)
    bg.inputs["Strength"].default_value = 0.9
    scene.world = world

    # render settings
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        pass
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    for attr in ("use_shadows", "use_raytracing"):
        if hasattr(scene.eevee, attr):
            try:
                setattr(scene.eevee, attr, True)
            except Exception:
                pass
    return cam


def render_preview(path):
    scene = bpy.context.scene
    scene.render.filepath = path
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    return path


def export(glb_path, draco=True, collection="Yggdrasil"):
    """Export only the given collection (incl. nested) to GLB."""
    view_layer = bpy.context.view_layer
    lc = view_layer.layer_collection.children.get(collection)
    lc.exclude = False
    view_layer.active_layer_collection = lc
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kw = dict(
        filepath=glb_path,
        export_format="GLB",
        use_active_collection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=False,
    )
    if "use_active_collection_with_nested" in props:
        kw["use_active_collection_with_nested"] = True
    if "export_attributes" in props:
        kw["export_attributes"] = True
    if "export_vertex_color" in props:
        kw["export_vertex_color"] = "ACTIVE"   # strand variant carries COLOR_0
    if draco and "export_draco_mesh_compression_enable" in props:
        kw.update(
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
            export_draco_position_quantization=14,
            export_draco_normal_quantization=10,
            export_draco_texcoord_quantization=12,
            export_draco_generic_quantization=12,
        )
    kw = {k: v for k, v in kw.items() if k in props}
    bpy.ops.export_scene.gltf(**kw)
    return glb_path


def setup_night_stage(bloom=True, leaf_fill=False, **cam_kw):
    """Dark void + bloom for previewing the light-strand variant.

    leaf_fill adds a cool low moon and two warm point lights at the trunk
    (stand-ins for the strands' light spill) so green leaves read."""
    scene = bpy.context.scene
    setup_stage(**cam_kw)
    for name in ("PREVIEW_Ground", "PREVIEW_Sun"):
        ob = bpy.data.objects.get(name)
        if ob is not None:
            ob.hide_render = True
            ob.hide_viewport = True
    world = bpy.data.worlds.get("PREVIEW_NightWorld") or bpy.data.worlds.new("PREVIEW_NightWorld")
    world.use_nodes = True
    bgn = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bgn.inputs["Color"].default_value = (0.004, 0.005, 0.010, 1.0)
    bgn.inputs["Strength"].default_value = 1.0
    scene.world = world
    try:
        scene.view_settings.look = "AgX - Base Contrast"
    except TypeError:
        pass
    stage = _coll("PREVIEW_Stage")
    for name, loc, energy in (("PREVIEW_TrunkGlowHigh", (0.0, 0.0, 22.0), 70000.0),
                              ("PREVIEW_TrunkGlowLow", (0.0, 0.0, 12.0), 30000.0)):
        old = bpy.data.objects.get(name)
        if old is not None:
            bpy.data.objects.remove(old, do_unlink=True)
        if not leaf_fill:
            continue
        ld = bpy.data.lights.get(name) or bpy.data.lights.new(name, "POINT")
        ld.color = (1.0, 0.45, 0.12)
        ld.energy = energy
        ld.shadow_soft_size = 6.0
        ob = bpy.data.objects.new(name, ld)
        stage.objects.link(ob)
        ob.location = loc
    if leaf_fill:
        bgn.inputs["Color"].default_value = (0.012, 0.02, 0.04, 1.0)
        sun = bpy.data.objects.get("PREVIEW_Sun")
        sun.hide_render = False
        sun.hide_viewport = False
        sun.data.color = (0.70, 0.80, 1.0)
        sun.data.energy = 6.0
        sun.rotation_euler = (math.radians(55), 0.0, math.radians(-70))
    if not bloom:
        return
    # Blender 5.x compositor: a node group assigned to the scene
    ng = bpy.data.node_groups.get("PREVIEW_Bloom")
    if ng is not None:
        bpy.data.node_groups.remove(ng)
    ng = bpy.data.node_groups.new("PREVIEW_Bloom", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl = ng.nodes.new("CompositorNodeRLayers")
    gl = ng.nodes.new("CompositorNodeGlare")
    out = ng.nodes.new("NodeGroupOutput")
    types = [i.identifier for i in gl.bl_rna.properties["glare_type"].enum_items] if "glare_type" in gl.bl_rna.properties else []
    if "BLOOM" in types:
        gl.glare_type = "BLOOM"
    elif "FOG_GLOW" in types:
        gl.glare_type = "FOG_GLOW"
    if "Type" in gl.inputs:
        try:
            gl.inputs["Type"].default_value = "Bloom"
        except Exception:
            pass
    for sock, val in (("Threshold", 0.25), ("Strength", 1.4), ("Size", 0.75)):
        if sock in gl.inputs:
            try:
                gl.inputs[sock].default_value = val
            except Exception:
                pass
    img_in = gl.inputs.get("Image") or gl.inputs[0]
    ng.links.new(rl.outputs["Image"], img_in)
    ng.links.new((gl.outputs.get("Image") or gl.outputs[0]), out.inputs[0])
    scene.compositing_node_group = ng
    scene.render.use_compositing = True
