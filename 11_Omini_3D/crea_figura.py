# HUD · crea la figura anatomica di base in Blender (una volta sola).
# Usa la figura libera di MakeHuman (CC0): mesh di base, bersagli "muscoloso" e scheletro con i pesi.
# Uso:  blender -b -P crea_figura.py -- <cartella makehuman> <figura.blend>
# Risultato: un file .blend con la figura "HUD_Corpo", lo scheletro "HUD_Scheletro" e un gruppo di vertici
# per ogni muscolo della tabella (m_quadricipite, m_grande_gluteo, ...), con i bordi sfumati.
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MH = argv[0] if argv else os.path.join(os.path.dirname(__file__), "makehuman")
OUT = argv[1] if len(argv) > 1 else os.path.join(os.path.dirname(__file__), "figura.blend")

# Bersagli applicati alla figura neutra: uomo giovane, muscoloso, leggermente asciutto
BERSAGLI = [("caucasian-male-young.target", 1/3), ("african-male-young.target", 1/3), ("asian-male-young.target", 1/3),
            ("universal-male-young-maxmuscle-averageweight.target", 0.8), ("universal-male-young-maxmuscle-minweight.target", 0.2),
            ("male-young-maxmuscle-averageweight-idealproportions.target", 0.7), ("male-young-maxmuscle-averageweight-maxheight.target", 0.25)]

def mh2bl(x, y, z):  # MakeHuman: Y in alto, Z verso chi guarda, decimetri → Blender: Z in alto, la figura guarda verso -Y, metri
    return Vector((x * 0.1, -z * 0.1, y * 0.1))

for o in list(bpy.data.objects): bpy.data.objects.remove(o)

# ---------- mesh
V, F, gruppo = [], [], None
for r in open(os.path.join(MH, "base.obj"), encoding="utf-8"):
    if r.startswith("v "):
        V.append([float(t) for t in r.split()[1:4]])
    elif r.startswith("g "):
        gruppo = r.split()[1]
    elif r.startswith("f ") and gruppo == "body":
        F.append([int(t.split("/")[0]) - 1 for t in r.split()[1:]])
for nome, peso in BERSAGLI:
    for r in open(os.path.join(MH, nome), encoding="utf-8"):
        if not r.strip() or r.startswith("#"): continue
        i, dx, dy, dz = r.split()
        i = int(i); V[i][0] += peso * float(dx); V[i][1] += peso * float(dy); V[i][2] += peso * float(dz)
P = [mh2bl(*v) for v in V]

sk = json.load(open(os.path.join(MH, "default.mhskel"), encoding="utf-8"))
J = {k: sum((P[i] for i in idx), Vector()) / len(idx) for k, idx in sk["joints"].items()}

usati = sorted({i for f in F for i in f})
nuovo = {v: n for n, v in enumerate(usati)}
me = bpy.data.meshes.new("HUD_Corpo")
me.from_pydata([P[i] for i in usati], [], [[nuovo[i] for i in f] for f in F])
me.update()
for p in me.polygons: p.use_smooth = True
corpo = bpy.data.objects.new("HUD_Corpo", me)

# a terra: i piedi toccano z = 0
zmin = min(v.co.z for v in me.vertices)
for v in me.vertices: v.co.z -= zmin
for k in J: J[k] = J[k] - Vector((0, 0, zmin))

# ---------- scheletro
scena = bpy.context.scene
scena.collection.objects.link(corpo)
arm = bpy.data.armatures.new("HUD_Scheletro")
sch = bpy.data.objects.new("HUD_Scheletro", arm)
scena.collection.objects.link(sch)
bpy.context.view_layer.objects.active = sch
bpy.ops.object.mode_set(mode="EDIT")
B = sk["bones"]
for nome, b in B.items():
    eb = arm.edit_bones.new(nome)
    eb.head, eb.tail = J[b["head"]], J[b["tail"]]
    if (eb.tail - eb.head).length < 1e-4: eb.tail = eb.head + Vector((0, 0, 0.01))
    pl = sk["planes"].get(b["rotation_plane"])
    if pl:
        a, c, d = (J[x] for x in pl)
        n = (c - a).cross(d - c)
        if n.length > 1e-6: eb.align_roll(n.normalized())
for nome, b in B.items():
    if b["parent"]:
        arm.edit_bones[nome].parent = arm.edit_bones[b["parent"]]
        if (arm.edit_bones[nome].head - arm.edit_bones[b["parent"]].tail).length < 1e-4: arm.edit_bones[nome].use_connect = True
bpy.ops.object.mode_set(mode="OBJECT")

# pesi della pelle
W = json.load(open(os.path.join(MH, "default_weights.mhw"), encoding="utf-8"))["weights"]
for osso, lista in W.items():
    vg = corpo.vertex_groups.new(name=osso)
    for i, w in lista:
        if i in nuovo: vg.add([nuovo[i]], w, "REPLACE")
corpo.parent = sch
mod = corpo.modifiers.new("Scheletro", "ARMATURE"); mod.object = sch

# ---------- zone muscolari
# Ogni muscolo è una zona della pelle: si trova dalle ossa che muovono quel punto, dalla direzione della superficie
# (davanti, dietro, dentro, fuori) e dall'altezza rispetto alle articolazioni. Poi i bordi si sfumano.
nv = len(me.vertices)
osso = {o: [0.0] * nv for o in W}
for o, lista in W.items():
    for i, w in lista:
        if i in nuovo: osso[o][nuovo[i]] = w
def ossa(*nomi):
    return [sum(osso[n][i] for n in nomi if n in osso) for i in range(nv)]
def lati(base):  # somma .L e .R
    return ossa(*(base + s for s in (".L", ".R")))

def sm(x, a, b):  # gradino morbido da a a b
    if a == b: return 1.0 if x >= a else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def J_(n): return J[n]
anca = (J_("upperleg01.L____head").z + J_("upperleg01.R____head").z) / 2
ginocchio = (J_("lowerleg01.L____head").z + J_("lowerleg01.R____head").z) / 2
caviglia = (J_("foot.L____head").z + J_("foot.R____head").z) / 2
spalla = (J_("upperarm01.L____head").z + J_("upperarm01.R____head").z) / 2
spallaX = abs(J_("upperarm01.L____head").x)
collo = J_("neck01____head").z
vita = anca + 0.55 * (spalla - anca) * 0.5  # circa l'ombelico
torace = anca + 0.62 * (spalla - anca)       # sotto i pettorali
print("articolazioni (m): anca %.2f ginocchio %.2f caviglia %.2f spalla %.2f collo %.2f" % (anca, ginocchio, caviglia, spalla, collo))

coscia = [a + b for a, b in zip(lati("upperleg01"), lati("upperleg02"))]
gamba = [a + b for a, b in zip(lati("lowerleg01"), lati("lowerleg02"))]
braccio = [a + b for a, b in zip(lati("upperarm01"), lati("upperarm02"))]
avamb = [a + b + c for a, b, c in zip(lati("lowerarm01"), lati("lowerarm02"), lati("wrist"))]
spallaO = lati("shoulder01")
busto = ossa("spine01", "spine02", "spine03", "spine04", "spine05", "root", "pelvis.L", "pelvis.R", "clavicle.L", "clavicle.R", "neck01")
collo_w = ossa("neck01", "neck02", "neck03")

# niente zone del busto su mani e braccia (in A le mani arrivano all'altezza delle anche)
manibraccia = ossa(*[o for o in W if any(t in o for t in ("upperarm", "lowerarm", "wrist", "finger", "metacarpal", "thumb"))])
def el(x, z, cx, cz, rx, rz):  # ellisse morbida: 1 al centro, 0 fuori
    d = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2
    return 1 - sm(d, 0.55, 1.0)
Z = {}
me.calc_loop_triangles()
for i, v in enumerate(me.vertices):
    p, n = v.co, v.normal
    nob = 1 - min(1.0, manibraccia[i])
    ax = abs(p.x); fuori = n.x if p.x > 0 else -n.x  # >0 verso l'esterno del corpo
    davanti, dietro = sm(-n.y, 0.15, 0.55), sm(n.y, 0.15, 0.55)
    zc = {}
    # gambe
    c = coscia[i]
    zc["quadricipite"] = c * davanti * sm(p.z, ginocchio + 0.06, ginocchio + 0.12) * (1 - sm(p.z, anca - 0.04, anca + 0.02)) * (1 - sm(-fuori, 0.55, 0.8))
    zc["femorali"] = c * dietro * sm(p.z, ginocchio + 0.03, ginocchio + 0.10) * (1 - sm(p.z, anca - 0.10, anca - 0.05))
    zc["adduttori"] = c * sm(-fuori, 0.35, 0.65) * sm(p.z, ginocchio + 0.12, ginocchio + 0.22)
    zc["flessori_anca"] = davanti * sm(p.z, anca - 0.07, anca - 0.03) * (1 - sm(p.z, anca + 0.04, anca + 0.08)) * sm(ax, 0.045, 0.07) * (1 - sm(ax, 0.13, 0.16))
    gl = 1
    zc["grande_gluteo"] = nob * el(ax, p.z, 0.085, anca - 0.0, 0.095, 0.115) * sm(n.y, 0.1, 0.45)
    zc["medio_gluteo"] = nob * el(ax, p.z, 0.135, anca + 0.1, 0.065, 0.075) * sm(fuori + 0.5 * n.y, 0.35, 0.7)
    g = gamba[i]
    meta = ginocchio - 0.45 * (ginocchio - caviglia)
    zc["gastrocnemio"] = g * dietro * sm(p.z, meta - 0.02, meta + 0.04) * (1 - sm(p.z, ginocchio - 0.01, ginocchio + 0.03))
    zc["soleo"] = g * sm(n.y, 0.0, 0.4) * sm(p.z, caviglia + 0.05, caviglia + 0.09) * (1 - sm(p.z, meta + 0.02, meta + 0.07)) + g * sm(fuori, 0.5, 0.8) * sm(n.y, -0.1, 0.2) * sm(p.z, meta - 0.06, meta) * (1 - sm(p.z, ginocchio - 0.08, ginocchio - 0.03))
    zc["tibiale"] = g * sm(-n.y, 0.1, 0.5) * sm(fuori, -0.1, 0.3) * sm(p.z, caviglia + 0.10, caviglia + 0.16) * (1 - sm(p.z, ginocchio - 0.06, ginocchio - 0.02))
    # busto davanti
    bu = busto[i] * (1 - sm(braccio[i] + spallaO[i], 0.4, 0.7)) * nob
    zc["retto_addome"] = bu * davanti * el(ax, p.z, 0.0, (anca + 0.05 + torace) / 2, 0.075, (torace - anca - 0.05) / 2 + 0.01)
    zc["obliqui"] = bu * el(ax, p.z, 0.115, anca + 0.17, 0.055, 0.1) * sm(-n.y, -0.4, 0.0)
    zc["pettorale"] = nob * (1 - min(1.0, braccio[i])) * davanti * el(ax, p.z, 0.085, torace + 0.085, 0.09, 0.07) * sm(ax, 0.0, 0.015)
    zc["dentato"] = bu * sm(fuori, 0.45, 0.75) * sm(-n.y, -0.2, 0.15) * sm(p.z, torace - 0.04, torace) * (1 - sm(p.z, torace + 0.08, torace + 0.12))
    # busto dietro
    zc["erettori"] = bu * dietro * el(ax, p.z, 0.035, (anca + 0.1 + torace + 0.06) / 2, 0.032, (torace - anca - 0.04) / 2)
    zc["gran_dorsale"] = bu * el(ax, p.z, 0.11, torace - 0.04, 0.075, 0.14) * sm(n.y + 0.4 * fuori, 0.1, 0.45) * (1 - sm(ax, 0.0, 0.0) * 0)
    zc["romboidi"] = bu * dietro * el(ax, p.z, 0.045, spalla - 0.085, 0.05, 0.065)
    zc["cuffia"] = bu * dietro * el(ax, p.z, 0.11, spalla - 0.1, 0.06, 0.06)
    zc["trapezio"] = (bu + collo_w[i]) * sm(n.y + n.z, 0.3, 0.7) * sm(p.z, spalla - 0.04, spalla) * (1 - sm(ax, spallaX - 0.04, spallaX - 0.01)) * (1 - sm(p.z, collo + 0.06, collo + 0.1))
    # spalle e braccia
    sp = (spallaO[i] + braccio[i]) * (1 - sm((p - (J_("upperarm01.L____head") if p.x > 0 else J_("upperarm01.R____head"))).length, 0.08, 0.12))
    sp *= sm(fuori + n.z, -0.3, 0.1)
    zc["deltoide_ant"] = sp * sm(-n.y, 0.25, 0.6)
    zc["deltoide_post"] = sp * sm(n.y, 0.25, 0.6)
    zc["deltoide_lat"] = sp * (1 - sm(abs(n.y), 0.35, 0.65))
    br = braccio[i] * (1 - sm((p - (J_("upperarm01.L____head") if p.x > 0 else J_("upperarm01.R____head"))).length, 0.08, 0.12) * 0 - (sp > 0.3) * 0.0)
    br *= sm((p - (J_("upperarm01.L____head") if p.x > 0 else J_("upperarm01.R____head"))).length, 0.09, 0.13)  # sotto il deltoide
    gom = J_("lowerarm01.L____head") if p.x > 0 else J_("lowerarm01.R____head")
    lontano = sm((p - gom).length, 0.03, 0.06)
    zc["bicipite"] = br * davanti * lontano
    zc["tricipite"] = br * dietro * lontano
    zc["avambraccio"] = avamb[i] * sm((p - gom).length, 0.02, 0.05)
    for k, w in zc.items():
        if w > 0.02: Z.setdefault(k, {})[i] = min(1.0, w)

# bordi sfumati: 3 passate di media coi vicini
vic = [[] for _ in range(nv)]
for e in me.edges:
    a, b = e.vertices; vic[a].append(b); vic[b].append(a)
for k in list(Z):
    w = [Z[k].get(i, 0.0) for i in range(nv)]
    for _ in range(3):
        w = [0.5 * w[i] + 0.5 * (sum(w[j] for j in vic[i]) / len(vic[i]) if vic[i] else w[i]) for i in range(nv)]
    vg = corpo.vertex_groups.new(name="m_" + k)
    for i, x in enumerate(w):
        if x > 0.03: vg.add([i], min(1.0, x * 1.15), "REPLACE")
    print("m_%-14s %5d vertici" % (k, sum(1 for x in w if x > 0.03)))

sub = corpo.modifiers.new("Liscio", "SUBSURF"); sub.levels = 1; sub.render_levels = 2
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("salvata", OUT)
