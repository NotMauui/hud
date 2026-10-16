# Una foto per muscolo (davanti e dietro, o di lato), per controllare le zone
import bpy, sys, math
argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.open_mainfile(filepath=argv[0]); out = argv[1]
corpo = bpy.data.objects["HUD_Corpo"]; me = corpo.data
col = me.color_attributes.new("zone", "FLOAT_COLOR", "POINT")
mat = bpy.data.materials.new("zone"); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
a = nt.nodes.new("ShaderNodeAttribute"); a.attribute_name = "zone"; nt.links.new(a.outputs["Color"], bsdf.inputs["Base Color"])
me.materials.clear(); me.materials.append(mat)
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.samples = 8; sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 180, 280
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.1
gr = sorted([g for g in corpo.vertex_groups if g.name.startswith("m_")], key=lambda g: g.name)
for g in gr:
    for v in me.vertices:
        w_ = 0
        for e in v.groups:
            if e.group == g.index: w_ = e.weight
        col.data[v.index].color = (0.8 * (1 - w_) + 0.9 * w_, 0.8 * (1 - w_) + 0.1 * w_, 0.8 * (1 - w_) + 0.1 * w_, 1)
    for nome, ang in [("a", 0), ("b", 180), ("c", 90)]:
        an = math.radians(ang); cam.location = (math.sin(an) * 5, -math.cos(an) * 5, 1.0); cam.rotation_euler = (math.radians(90), 0, an)
        sc.render.filepath = f"{out}/{g.name}_{nome}.png"; bpy.ops.render.render(write_still=True)
