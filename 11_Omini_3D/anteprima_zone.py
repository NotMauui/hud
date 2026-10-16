# Controllo delle zone: colora ogni muscolo e fa 4 foto (davanti, dietro, lato, tre quarti)
import bpy, sys, math, colorsys
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.open_mainfile(filepath=argv[0])
out = argv[1]
solo = argv[2].split(",") if len(argv) > 2 and argv[2] else None
corpo = bpy.data.objects["HUD_Corpo"]
me = corpo.data
gr = [g for g in corpo.vertex_groups if g.name.startswith("m_") and (not solo or g.name[2:] in solo)]
col = me.color_attributes.new("zone", "FLOAT_COLOR", "POINT")
acc = [[0.75, 0.76, 0.78, 1] for _ in me.vertices]
for k, g in enumerate(sorted(gr, key=lambda g: g.name)):
    r, gg, b = colorsys.hsv_to_rgb((k * 0.381) % 1, 0.85, 0.95)
    for v in me.vertices:
        for e in v.groups:
            if e.group == g.index and e.weight > 0.05:
                w = e.weight
                acc[v.index] = [acc[v.index][0] * (1 - w) + r * w, acc[v.index][1] * (1 - w) + gg * w, acc[v.index][2] * (1 - w) + b * w, 1]
for i, c in enumerate(acc): col.data[i].color = c
mat = bpy.data.materials.new("zone"); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
a = nt.nodes.new("ShaderNodeAttribute"); a.attribute_name = "zone"
nt.links.new(a.outputs["Color"], bsdf.inputs["Base Color"]); bsdf.inputs["Roughness"].default_value = 0.6
me.materials.clear(); me.materials.append(mat)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.samples = 16; sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 400, 600
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.9, 0.9, 0.9, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.0
for nome, ang in [("davanti", 0), ("dietro", 180), ("lato", 90), ("tre_quarti", 35)]:
    a = math.radians(ang)
    cam.location = (math.sin(a) * 5, -math.cos(a) * 5, 0.95)
    cam.rotation_euler = (math.radians(90), 0, a)
    sc.render.filepath = f"{out}_{nome}.png"
    bpy.ops.render.render(write_still=True)
