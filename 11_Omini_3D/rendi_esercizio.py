# HUD · video di un esercizio: la figura fa il movimento e i muscoli che lavorano si accendono a tempo.
#
# Uso (dalla cartella 11_Omini_3D):
#   blender -b figura.blend -P rendi_esercizio.py -- squat
#   blender -b figura.blend -P rendi_esercizio.py -- squat ponte --motore cycles --lato 1080
#   blender -b figura.blend -P rendi_esercizio.py -- tutti
# Opzioni: --motore cycles|eevee|workbench (cycles è il risultato finale; workbench per provare le pose) · --lato 720
#          --campioni 32 · --foto (solo l'immagine di copertina, per provare le pose) · --uscita video
# Escono video/<id>.mp4 (loop) e video/<id>.jpg (copertina nel momento di massimo sforzo).
import bpy, json, math, os, sys, importlib
from mathutils import Vector, Matrix, Quaternion

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)
import movimenti; importlib.reload(movimenti)

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def opz(nome, std):
    if nome in args:
        i = args.index(nome); v = args[i + 1]; del args[i:i + 2]; return v
    return std
# qualità: "bozza" per provare, "normale" (base), "massima" per i video finali
QUALITA = opz("--qualita", "normale")
PRESET = {"bozza": (540, 16, 24), "normale": (720, 32, 24), "massima": (1080, 64, 30)}[QUALITA]
MOTORE = opz("--motore", "cycles"); LATO = int(opz("--lato", str(PRESET[0]))); CAMPIONI = int(opz("--campioni", str(PRESET[1])))
USCITA = opz("--uscita", os.path.join(QUI, "video")); FPS = int(opz("--fps", str(PRESET[2])))
B5 = bpy.app.version >= (5, 0, 0)
def nodi(x):  # da Blender 5 i nodi sono sempre accesi (use_nodes è deprecato)
    if not B5: x.use_nodes = True
    return x
SALTA = "--salta" in args  # salta gli esercizi che hanno già il video (per riprendere un lavoro lungo)
if SALTA: args.remove("--salta")
SOLO_FOTO = "--foto" in args
if SOLO_FOTO: args.remove("--foto")
CHIAVI = "--chiavi" in args  # una foto per ogni posa chiave, per correggere i movimenti
if CHIAVI: args.remove("--chiavi")
TAB = json.load(open(os.path.join(QUI, "muscoli.json"), encoding="utf-8"))
MOBILITA = {"gattomucca", "bambino"}
ESERCIZI = (list(movimenti.MOVIMENTI) if (not args or args == ["tutti"]) else
            [k for k in movimenti.MOVIMENTI if k not in MOBILITA] if args == ["palestra"] else args)

# colori (stile anatomico: corpo chiaro su fondo scuro, rosso dove si lavora)
GRIGIO = (0.30, 0.31, 0.34, 1); ROSSO = (0.90, 0.03, 0.02, 1); ROSA = (0.95, 0.38, 0.32, 1); AZZURRO = (0.0, 0.62, 1.0, 1)
FONDO = (0.012, 0.012, 0.016, 1)
VISTE = {"fronte": 0, "tre_quarti": 35, "lato": 90, "dietro": 180, "lato_sx": -90, "tre_quarti_dietro": 145, "tre_quarti_sx": -35}

sc = bpy.context.scene
sch = bpy.data.objects["HUD_Scheletro"]; corpo = bpy.data.objects["HUD_Corpo"]
PB = sch.pose.bones

# ------------------------------------------------------------------ pose
def rot_corpo(lista):
    R = Matrix.Identity(3)
    for asse, gradi in lista: R = Matrix.Rotation(math.radians(gradi), 3, asse) @ R
    return R
def applica_posa(posa):
    for pb in PB:
        pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = Quaternion(); pb.location = Vector()
    for nome, lista in posa.get("ossa", {}).items():
        if nome not in PB: continue
        R0 = PB[nome].bone.matrix_local.to_3x3()
        PB[nome].rotation_quaternion = (R0.inverted() @ rot_corpo(lista) @ R0).to_quaternion()
    rad = posa.get("radice", {})
    if "pos" in rad or rad.get("rot"):
        pr0 = PB["root"]; R00 = pr0.bone.matrix_local.to_3x3()
        pr0.rotation_quaternion = (R00.inverted() @ rot_corpo(rad.get("rot", [])) @ R00).to_quaternion()
        if "pos" in rad: pr0.location = R00.inverted() @ (Vector(rad["pos"]) - pr0.bone.head_local)
    # "dir": l'osso punta in una direzione data negli assi del corpo (più comodo delle rotazioni per braccia e gambe)
    # "dirw": come "dir" ma negli assi del mondo (Z in alto, la figura in piedi guarda verso −Y)
    if posa.get("dir") or posa.get("dirw"):
        Rc = rot_corpo(rad.get("rot", []))
        prof = lambda n: len(PB[n].parent_recursive)
        tutte = {**{k: ("c", v) for k, v in posa.get("dir", {}).items()}, **{k: ("w", v) for k, v in posa.get("dirw", {}).items()}}
        for nome in sorted(tutte, key=prof):
            if nome not in PB: continue
            aggiorna(); pb = PB[nome]; M = pb.matrix.copy()
            tipo, vv = tutte[nome]
            # l'osso "01" è corto (spalla, anca, prima metà della gamba): conta la direzione fino alla fine del segmento ("02")
            fine = PB.get(nome.replace("01", "02")) if "01" in nome else None
            v = ((fine.tail - pb.head) if fine is not None and fine.parent_recursive and pb in fine.parent_recursive else (M.to_3x3() @ Vector((0, 1, 0)))).normalized()
            d = ((Rc @ Vector(vv)) if tipo == "c" else Vector(vv)).normalized()
            R = v.rotation_difference(d).to_matrix().to_4x4()
            T = Matrix.Translation(M.translation)
            pb.matrix = T @ R @ Matrix.Translation(-M.translation) @ M
        aggiorna()
    for nome, lista in posa.get("locali", {}).items():  # rotazioni sugli assi dell'osso (dita)
        if nome not in PB: continue
        q = Quaternion()
        for asse, gradi in lista: q = Quaternion(Vector({"X": (1, 0, 0), "Y": (0, 1, 0), "Z": (0, 0, 1)}[asse]), math.radians(gradi)) @ q
        PB[nome].rotation_quaternion = q @ PB[nome].rotation_quaternion
    rad = posa.get("radice", {}); pr = PB["root"]; R0 = pr.bone.matrix_local.to_3x3()
    R = rot_corpo(rad.get("rot", []))
    pr.rotation_quaternion = (R0.inverted() @ R @ R0).to_quaternion()
    if "pos" in rad:
        pr.location = R0.inverted() @ (Vector(rad["pos"]) - pr.bone.head_local)
def presa(lati="LR", forza=1.0):
    """Dita chiuse attorno a un'impugnatura (rotazioni locali da aggiungere a una posa)."""
    out = {}
    for s in lati:
        for d in (2, 3, 4, 5):
            out[f"finger{d}-1.{s}"] = [("X", 55 * forza)]; out[f"finger{d}-2.{s}"] = [("X", 75 * forza)]; out[f"finger{d}-3.{s}"] = [("X", 45 * forza)]
        out[f"finger1-2.{s}"] = [("X", 12 * forza)]; out[f"finger1-3.{s}"] = [("X", 18 * forza)]
    return out
def unisci_d(*dd):
    out = {}
    for d in dd: out.update(d)
    return out
def chiave(fr):
    for pb in PB:
        pb.keyframe_insert("rotation_quaternion", frame=fr);
    PB["root"].keyframe_insert("location", frame=fr)
def aggiorna(): bpy.context.view_layer.update()
PARTI = {"gambe": ("upperleg", "lowerleg", "foot", "toe"), "braccia": ("upperarm", "lowerarm", "wrist", "finger", "metacarpal", "thumb")}
_maschere = {}
def maschera(parte):  # vertici che appartengono a gambe o braccia
    if parte not in _maschere:
        gi = {g.index for g in corpo.vertex_groups if any(t in g.name for t in PARTI[parte]) and not g.name.startswith("m_")}
        _maschere[parte] = {v.index for v in corpo.data.vertices if sum(e.weight for e in v.groups if e.group in gi) > 0.4}
    return _maschere[parte]
def min_z_osso(osso):  # punto più basso dei vertici mossi da un osso (es. il piede)
    g = corpo.vertex_groups.get(osso); gi = g.index if g else -1
    sub = corpo.modifiers.get("Liscio"); vis = sub.show_viewport if sub else None
    if sub: sub.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get(); ev = corpo.evaluated_get(dg); m = ev.to_mesh()
    idx = {v.index for v in corpo.data.vertices if any(e.group == gi and e.weight > 0.3 for e in v.groups)}
    z = min((ev.matrix_world @ v.co).z for v in m.vertices if v.index in idx); ev.to_mesh_clear()
    if sub: sub.show_viewport = vis
    return z
def min_z(escludi=()):
    via = set().union(*[maschera(p) for p in escludi]) if escludi else set()
    sub = corpo.modifiers.get("Liscio"); vis = sub.show_viewport if sub else None
    if sub: sub.show_viewport = False  # gli indici dei vertici restano quelli originali
    dg = bpy.context.evaluated_depsgraph_get(); ev = corpo.evaluated_get(dg); m = ev.to_mesh()
    z = min((ev.matrix_world @ v.co).z for v in m.vertices if v.index not in via); ev.to_mesh_clear()
    if sub: sub.show_viewport = vis
    return z
def mondo(osso, dove="head"):
    pb = PB[osso]; return sch.matrix_world @ (pb.head if dove == "head" else pb.tail)

# ------------------------------------------------------------------ IK: piedi o mani fermi dove sono nella prima posa
def ik(catena_fine, n, bersaglio_pos, polo_dir, nome):
    e = bpy.data.objects.new("ik_" + nome, None); sc.collection.objects.link(e); e.location = bersaglio_pos
    p = bpy.data.objects.new("polo_" + nome, None); sc.collection.objects.link(p)
    # il polo sta a un metro dall'inizio della catena (anca o spalla), nella direzione in cui deve puntare ginocchio o gomito
    attacco = sch.matrix_world @ (PB[catena_fine].parent_recursive[n - 2].head if n >= 2 else PB[catena_fine].head)
    p.location = attacco + Vector(polo_dir).normalized() * 1.0
    c = PB[catena_fine].constraints.new("IK"); c.target = e; c.pole_target = p; c.chain_count = n; c.use_tail = True
    # angolo del polo calcolato dalla geometria della catena nella posa attuale (formula classica per l'IK di Blender)
    base = PB[catena_fine].parent_recursive[n - 2] if n >= 2 else PB[catena_fine]
    Mi = sch.matrix_world.inverted(); polo = Mi @ p.location
    asse = base.tail - base.head
    normale = (PB[catena_fine].tail - base.head).cross(polo - base.head)
    proiettato = normale.cross(asse)
    x = base.matrix.to_3x3() @ Vector((1, 0, 0))
    ang = x.angle(proiettato) if proiettato.length > 1e-6 else 0.0
    if x.cross(proiettato).dot(asse) < 0: ang = -ang
    c.pole_angle = ang; aggiorna()
    return e
def blocca_rotazione(osso, nome, piatto=False):
    """Tiene ferma la rotazione dell'osso nel mondo: com'è nella prima posa, o piatto come in piedi (pianta a terra)."""
    e = bpy.data.objects.new("rot_" + nome, None); sc.collection.objects.link(e)
    e.matrix_world = sch.matrix_world @ (PB[osso].bone.matrix_local if piatto else PB[osso].matrix)
    c = PB[osso].constraints.new("COPY_ROTATION"); c.target = e
    return e

# ------------------------------------------------------------------ attrezzi: manubri, kettlebell, bilanciere, panca, gradino, sbarra, cavi, elastici
def mat_attrezzo(nome, colore, metallo, ruvido):
    m = bpy.data.materials.get(nome)
    if m: return m
    m = nodi(bpy.data.materials.new(nome)); b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = colore; b.inputs["Metallic"].default_value = metallo; b.inputs["Roughness"].default_value = ruvido
    return m
def MET(): return mat_attrezzo("HUD_Metallo", (0.32, 0.33, 0.35, 1), 1.0, 0.32)
def GOMMA(): return mat_attrezzo("HUD_Gomma", (0.025, 0.025, 0.028, 1), 0.0, 0.62)
def IMBOT(): return mat_attrezzo("HUD_Imbottitura", (0.05, 0.05, 0.055, 1), 0.0, 0.55)
def ELAST(): return mat_attrezzo("HUD_Elastico", (0.10, 0.10, 0.11, 1), 0.0, 0.5)

def _unisci(parti, nome, mat=None):
    """Unisce più oggetti in uno (un attrezzo = un oggetto)."""
    for o in bpy.context.selected_objects: o.select_set(False)
    for p in parti: p.select_set(True)
    bpy.context.view_layer.objects.active = parti[0]
    if len(parti) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = "att_" + nome
    if mat is not None: o.data.materials.clear(); o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = True
    return o
def cil(r, l, pos=(0, 0, 0), asse="X", mat=None, v=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=l, vertices=v, location=pos)
    o = bpy.context.object
    if asse == "X": o.rotation_euler = (0, math.radians(90), 0)
    elif asse == "Y": o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    if mat: o.data.materials.append(mat)
    return o
def scatola(dim, pos=(0, 0, 0), mat=None, smussa=0.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos); o = bpy.context.object; o.scale = dim
    bpy.ops.object.transform_apply(scale=True)
    if smussa:
        m = o.modifiers.new("smusso", "BEVEL"); m.width = smussa; m.segments = 3
    if mat: o.data.materials.append(mat)
    return o
def crea_manubrio(nome, peso=1.0):
    # impugnatura lungo X (centrata nell'origine), dischi esagonali ai lati
    r = 0.055 * peso ** 0.33
    parti = [cil(0.016, 0.20, (0, 0, 0), "X", MET()), cil(r, 0.075, (-0.135, 0, 0), "X", GOMMA(), 6), cil(r, 0.075, (0.135, 0, 0), "X", GOMMA(), 6)]
    return _unisci(parti, nome)
def crea_kettlebell(nome):
    # maniglia lungo X sopra l'origine… l'origine è il centro della maniglia, la palla sotto (−Z)
    parti = [cil(0.014, 0.16, (0, 0, 0), "X", MET()), cil(0.014, 0.09, (-0.08, 0, -0.045), "Z", MET()), cil(0.014, 0.09, (0.08, 0, -0.045), "Z", MET())]
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(0, 0, -0.17), segments=40, ring_count=24); b = bpy.context.object; b.scale = (1, 1, 0.92)
    bpy.ops.object.transform_apply(scale=True); b.data.materials.append(GOMMA())
    return _unisci(parti + [b], nome)
def crea_bilanciere(nome, dischi=True, lungo=2.0):
    parti = [cil(0.014, lungo, (0, 0, 0), "X", MET())]
    if dischi: parti += [cil(0.025, 0.42, (-(lungo / 2 - 0.21), 0, 0), "X", MET()), cil(0.025, 0.42, (lungo / 2 - 0.21, 0, 0), "X", MET())]
    elif lungo > 0.5: parti += [cil(0.02, 0.12, (-(lungo / 2 - 0.06), 0, 0), "X", GOMMA()), cil(0.02, 0.12, (lungo / 2 - 0.06, 0, 0), "X", GOMMA())]  # impugnature
    if dischi:
        for sx in (-1, 1):
            parti.append(cil(0.225, 0.05, (sx * (lungo / 2 - 0.36), 0, 0), "X", GOMMA(), 48))
            parti.append(cil(0.17, 0.035, (sx * (lungo / 2 - 0.31), 0, 0), "X", GOMMA(), 48))
    return _unisci(parti, nome)
def crea_panca(nome, pos, lungo=1.2, largo=0.30, alto=0.45, rot=0):
    x, y, z = pos
    parti = [scatola((largo, lungo, 0.07), (0, 0, alto - 0.035), IMBOT(), 0.02),
             scatola((0.06, lungo * 0.85, 0.05), (0, 0, alto - 0.10), MET(), 0.005)]
    for sy in (-1, 1): parti.append(scatola((largo * 0.9, 0.05, alto - 0.1), (0, sy * lungo * 0.38, (alto - 0.1) / 2), MET(), 0.005))
    o = _unisci(parti, nome); o.location = (x, y, z); o.rotation_euler = (0, 0, math.radians(rot)); return o
def crea_gradino(nome, pos, dim=(0.5, 0.4, 0.40)):
    o = _unisci([scatola(dim, (0, 0, dim[2] / 2), IMBOT(), 0.02)], nome); o.location = pos; return o
def crea_sbarra(nome, alto=2.30, y=0.0, largo=1.4):
    parti = [cil(0.016, largo, (0, y, alto), "X", MET())]
    for sx in (-1, 1): parti.append(cil(0.03, alto + 0.05, (sx * largo / 2, y, (alto + 0.05) / 2), "Z", MET()))
    return _unisci(parti, nome)
def crea_colonna(nome, punto):
    """Colonna dei cavi: montante da terra fino alla carrucola, con il pacco pesi in basso."""
    x, y, z = punto
    parti = [cil(0.03, z + 0.15, (x, y + 0.08, (z + 0.15) / 2), "Z", MET()), scatola((0.22, 0.12, 0.45), (x, y + 0.08, 0.25), GOMMA(), 0.01),
             cil(0.045, 0.03, (x, y, z), "X", MET())]
    return _unisci(parti, nome)
def crea_cavo(nome, da_pos, a_obj=None, a_osso=None, raggio=0.004, mat=None):
    """Una linea tesa da un punto fisso a un oggetto o a un osso (si muove con lui)."""
    cu = bpy.data.curves.new(nome, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = raggio; cu.bevel_resolution = 3
    sp = cu.splines.new("POLY"); sp.points.add(1)
    fine = (a_obj.matrix_world.translation if a_obj else mondo(a_osso[0], a_osso[1]) if a_osso else Vector(da_pos))
    sp.points[0].co = (*da_pos, 1); sp.points[1].co = (*fine, 1)
    o = bpy.data.objects.new("att_" + nome, cu); sc.collection.objects.link(o); o.data.materials.append(mat or MET())
    return o, sp
def aggancia_punto(o, indice, a_obj=None, a_osso=None):
    """Il punto `indice` della curva segue un oggetto o un osso (modificatore Hook)."""
    h = o.modifiers.new("aggancio%d" % indice, "HOOK")
    if a_obj: h.object = a_obj
    else: h.object = sch; h.subtarget = a_osso
    h.center = o.data.splines[0].points[indice].co.xyz
    h.vertex_indices_set([indice])
    try:
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.hook_reset(modifier=h.name)
    except Exception: pass
    return h
def presa_mano(s):
    """Punto e assi dell'impugnatura nella mano `s` (L/R), nella posa attuale: centro, asse dell'impugnatura, verso le dita."""
    nocche = [mondo(f"finger{d}-1.{s}") for d in (2, 3, 4, 5)]
    c = sum(nocche, Vector()) / 4; polso = mondo(f"wrist.{s}")
    avanti = (c - polso).normalized(); asse = (mondo(f"finger2-1.{s}") - mondo(f"finger5-1.{s}")).normalized()
    palmo = asse.cross(avanti).normalized() * (1 if s == "L" else -1)  # verso il palmo
    centro = c - avanti * 0.015 + palmo * 0.025
    return centro, asse, avanti, palmo
def metti_in_mano(o, s, giu=False):
    """Mette l'attrezzo nella mano e lo lega all'osso del polso: da qui in poi la segue."""
    aggiorna(); centro, asse, avanti, palmo = presa_mano(s)
    x = asse; z = (-avanti if giu else palmo); y = z.cross(x).normalized(); z = x.cross(y).normalized()
    M = Matrix((x, y, z)).transposed().to_4x4(); M.translation = centro
    o.parent = sch; o.parent_type = "BONE"; o.parent_bone = "wrist." + s
    aggiorna(); o.matrix_world = M; aggiorna()
    return o
def lega_a_osso(o, osso):
    W = o.matrix_world.copy(); o.parent = sch; o.parent_type = "BONE"; o.parent_bone = osso; aggiorna(); o.matrix_world = W; aggiorna(); return o
def crea_attrezzi(mv):
    """Crea gli attrezzi dell'esercizio nella prima posa. Ritorna {nome: oggetto}."""
    A = {}
    for a in mv.get("attrezzi", []):
        t = a["tipo"]; nome = a.get("nome", t)
        if t == "manubrio" and "pos" in a: A[nome] = crea_manubrio(nome, a.get("peso", 1.0))
        elif t == "manubrio":
            for s in a.get("mani", "LR"):
                A[nome + s] = metti_in_mano(crea_manubrio(nome + s, a.get("peso", 1.0)), s)
        elif t == "kettlebell":
            o = crea_kettlebell(nome)
            if "pos" in a: o.location = a["pos"]; A[nome] = o
            else: A[nome] = metti_in_mano(o, a.get("mano", "L"), giu=True)
            if a.get("segue"): lega_a_osso(o, a["segue"])
        elif t in ("bilanciere", "maniglia", "corda"):
            o = crea_bilanciere(nome, dischi=(t == "bilanciere" and a.get("dischi", True)), lungo={"bilanciere": a.get("lungo", 2.0), "maniglia": a.get("lungo", 1.1), "corda": 0.35}[t])
            if t == "corda": o.data.materials.clear(); o.data.materials.append(ELAST())
            A[nome] = o
        elif t == "panca": A[nome] = crea_panca(nome, a["pos"], a.get("lungo", 1.2), a.get("largo", 0.30), a.get("alto", 0.45), a.get("rot", 0))
        elif t == "gradino":
            if "sotto" in a:  # sotto un piede della prima posa: alto quanto serve perché il piede appoggi
                aggiorna(); f = mondo(a["sotto"]); h = max(0.1, min_z_osso(a["sotto"]))
                d = a.get("dim", (0.5, 0.4, 0.40)); A[nome] = crea_gradino(nome, (f.x + a.get("dx", 0), f.y + a.get("dy", 0), 0), (d[0], d[1], h))
            else: A[nome] = crea_gradino(nome, a["pos"], a.get("dim", (0.5, 0.4, 0.40)))
        elif t == "sbarra": A[nome] = crea_sbarra(nome, a.get("alto", 2.3), a.get("y", 0.0))
        elif t == "colonna": A[nome] = crea_colonna(nome, a["punto"])
        elif t == "scatola":
            A[nome] = _unisci([scatola(a["dim"], (0, 0, 0), {"imbottitura": IMBOT(), "metallo": MET(), "gomma": GOMMA()}[a.get("mat", "imbottitura")], 0.01)], nome)
        elif t == "rullo": A[nome] = _unisci([cil(a.get("r", 0.05), a.get("lungo", 0.5), (0, 0, 0), "X", IMBOT())], nome)
        o = A.get(nome)
        if o is not None and t not in ("panca", "gradino", "sbarra", "colonna"):
            if "presso" in a:  # vicino a un osso della prima posa: [osso, "head"/"tail", (dx, dy, dz)], "x0": centrato
                aggiorna(); q = mondo(a["presso"][0], a["presso"][1]) + Vector(a["presso"][2] if len(a["presso"]) > 2 else (0, 0, 0))
                if a.get("x0"): q.x = 0
                o.location = q
            if "pos" in a: o.location = a["pos"]
            if "rot" in a: o.rotation_mode = "XYZ"; o.rotation_euler = rot_corpo(a["rot"]).to_euler()
            aggiorna()
            if a.get("segue"): lega_a_osso(o, a["segue"])
    return A
def crea_linee(mv, A):
    """Cavi ed elastici, dopo che IK e attrezzi sono a posto."""
    for a in mv.get("linee", []):
        nome = a.get("nome", "linea%d" % len(A))
        da = a["da"]; aa = a["a"]
        def fine(x):
            if isinstance(x, str): return {"obj": A[x]}
            if isinstance(x, (list, tuple)) and isinstance(x[0], str): return {"osso": x[0]}
            return {"pos": x}
        f0, f1 = fine(da), fine(aa)
        p0 = f0.get("pos") or (A[da].matrix_world.translation if "obj" in f0 else mondo(da[0], da[1]))
        p1 = (A[aa].matrix_world.translation if "obj" in f1 else mondo(aa[0], aa[1]) if "osso" in f1 else Vector(aa))
        o, sp = crea_cavo(nome, tuple(p0), raggio=a.get("raggio", 0.004), mat=ELAST() if a.get("elastico") else MET())
        sp.points[1].co = (*p1, 1); A[nome] = o
        if "obj" in f0: aggancia_punto(o, 0, a_obj=A[da])
        if "osso" in f0: aggancia_punto(o, 0, a_osso=da[0])
        if "obj" in f1: aggancia_punto(o, 1, a_obj=A[aa])
        if "osso" in f1: aggancia_punto(o, 1, a_osso=aa[0])

# ------------------------------------------------------------------ materiale
def materiale():
    m = bpy.data.materials.get("HUD_Pelle") or bpy.data.materials.new("HUD_Pelle")
    nodi(m); nt = m.node_tree; nt.nodes.clear()
    N = nt.nodes.new; L = nt.links.new
    out = N("ShaderNodeOutputMaterial"); bs = N("ShaderNodeBsdfPrincipled")
    bs.inputs["Roughness"].default_value = 0.42
    for nome, v in (("Subsurface Weight", 0.12), ("Coat Weight", 0.15)):
        if nome in bs.inputs: bs.inputs[nome].default_value = v
    # fibre: bande sottili che danno l'aspetto di muscolo alle zone accese
    tc = N("ShaderNodeTexCoord"); wave = N("ShaderNodeTexWave"); wave.inputs["Scale"].default_value = 38
    wave.inputs["Distortion"].default_value = 6; wave.inputs["Detail"].default_value = 3
    L(tc.outputs["Object"], wave.inputs["Vector"])
    fib = N("ShaderNodeMapRange"); fib.inputs["To Min"].default_value = 0.72; fib.inputs["To Max"].default_value = 1.0
    L(wave.outputs["Fac"], fib.inputs["Value"])
    def strato(attr, valore_nodo, colore, prima):
        a = N("ShaderNodeAttribute"); a.attribute_name = attr
        mul = N("ShaderNodeMath"); mul.operation = "MULTIPLY"; L(a.outputs["Fac"], mul.inputs[0]); L(valore_nodo.outputs[0], mul.inputs[1])
        mix = N("ShaderNodeMix"); mix.data_type = "RGBA"; mix.clamp_factor = True
        L(mul.outputs[0], mix.inputs["Factor"])
        if prima is None: mix.inputs[6].default_value = GRIGIO
        else: L(prima.outputs[2], mix.inputs[6])
        # colore × fibre
        mf = N("ShaderNodeMix"); mf.data_type = "RGBA"; mf.blend_type = "MULTIPLY"; mf.inputs["Factor"].default_value = 1.0
        mf.inputs[6].default_value = colore; L(fib.outputs[0], mf.inputs[7])
        L(mf.outputs[2], mix.inputs[7])
        return mix, mul
    vals = {}
    for k in ("aiuta", "allunga", "lavora"):
        v = N("ShaderNodeValue"); v.name = v.label = "v_" + k; vals[k] = v
    m1, mul_a = strato("a_aiuta", vals["aiuta"], ROSA, None)
    m2, mul_s = strato("a_allunga", vals["allunga"], AZZURRO, m1)
    m3, mul_l = strato("a_lavora", vals["lavora"], ROSSO, m2)
    L(m3.outputs[2], bs.inputs["Base Color"])
    # un filo di luce propria sulle zone accese, così si leggono anche in ombra
    def per(x, k):
        n = N("ShaderNodeMath"); n.operation = "MULTIPLY"; n.inputs[1].default_value = k; L(x.outputs[0], n.inputs[0]); return n
    def piu(a, b):
        n = N("ShaderNodeMath"); n.operation = "ADD"; L(a.outputs[0], n.inputs[0]); L(b.outputs[0], n.inputs[1]); return n
    forza = piu(piu(per(mul_l, 1.2), per(mul_s, 0.9)), per(mul_a, 0.5))
    if "Emission Color" in bs.inputs:
        L(m3.outputs[2], bs.inputs["Emission Color"]); L(forza.outputs[0], bs.inputs["Emission Strength"])
    L(bs.outputs[0], out.inputs["Surface"])
    corpo.data.materials.clear(); corpo.data.materials.append(m)
    return m, vals

def attributi(ex):
    me = corpo.data; idx = {g.name: g.index for g in corpo.vertex_groups}
    for ruolo in ("lavora", "aiuta", "allunga"):
        nome = "a_" + ruolo
        a = me.attributes.get(nome) or me.attributes.new(nome, "FLOAT", "POINT")
        gr = {idx["m_" + k] for k in ex[ruolo] if "m_" + k in idx}
        for v in me.vertices:
            a.data[v.index].value = max([e.weight for e in v.groups if e.group in gr] or [0.0])
    # chi lavora vince su chi aiuta o si allunga nello stesso punto
    L_, A_, S_ = (me.attributes["a_" + r].data for r in ("lavora", "aiuta", "allunga"))
    for i in range(len(me.vertices)):
        A_[i].value = max(0.0, A_[i].value - L_[i].value); S_[i].value = max(0.0, S_[i].value - L_[i].value)

# ------------------------------------------------------------------ scena: fondo, luci, pavimento, camera
def scena():
    w = bpy.data.worlds.get("HUD_Fondo") or bpy.data.worlds.new("HUD_Fondo"); sc.world = w; nodi(w)
    w.node_tree.nodes["Background"].inputs[0].default_value = FONDO; w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    if "HUD_Pavimento" not in bpy.data.objects:
        bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); pav = bpy.context.object; pav.name = "HUD_Pavimento"
        mp = nodi(bpy.data.materials.new("HUD_Pavimento")); b = mp.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (0.008, 0.008, 0.01, 1); b.inputs["Roughness"].default_value = 0.5
        pav.data.materials.append(mp)
    def luce(nome, tipo, pos, energia, colore, dimensione):
        if nome in bpy.data.objects: return bpy.data.objects[nome]
        l = bpy.data.lights.new(nome, tipo); l.energy = energia; l.color = colore
        if tipo == "AREA": l.size = dimensione
        o = bpy.data.objects.new(nome, l); sc.collection.objects.link(o); o.location = pos
        t = o.constraints.new("TRACK_TO"); t.target = sch; t.track_axis = "TRACK_NEGATIVE_Z"; t.up_axis = "UP_Y"
        return o
    luci = [luce("HUD_Chiave", "AREA", (-2.4, -2.8, 3.4), 140, (1, 0.97, 0.93), 1.6),
            luce("HUD_Contro1", "AREA", (2.8, 2.8, 2.6), 260, (0.95, 0.95, 1.0), 1.0),
            luce("HUD_Contro2", "AREA", (-2.8, 2.6, 1.8), 180, (0.95, 0.95, 1.0), 1.0),
            luce("HUD_Riempi", "AREA", (2.6, -2.6, 0.6), 25, (1, 1, 1), 3.0)]
    if "HUD_Camera" not in bpy.data.objects:
        cam = bpy.data.objects.new("HUD_Camera", bpy.data.cameras.new("HUD_Camera")); sc.collection.objects.link(cam)
    cam = bpy.data.objects["HUD_Camera"]; cam.data.lens = 50; sc.camera = cam
    return luci, cam

def motore():
    if MOTORE == "workbench":
        sc.render.engine = "BLENDER_WORKBENCH"; sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "MATERIAL"
    elif MOTORE == "cycles":
        sc.render.engine = "CYCLES"; sc.cycles.samples = CAMPIONI; sc.cycles.use_denoising = True
        # scheda video se c'è (Metal sul Mac, CUDA/OptiX altrove), altrimenti processore
        try:
            pr = bpy.context.preferences.addons["cycles"].preferences
            for tipo in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
                try: pr.compute_device_type = tipo; pr.get_devices()
                except Exception: continue
                if any(d.type == tipo for d in pr.devices):
                    for d in pr.devices: d.use = True
                    sc.cycles.device = "GPU"; break
        except Exception: pass
    else:
        for nome in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
            try: sc.render.engine = nome; break
            except TypeError: continue
        try: sc.eevee.taa_render_samples = CAMPIONI
        except Exception: pass
        for a in ("use_shadows", "use_gtao", "use_raytracing"):
            try: setattr(sc.eevee, a, True)
            except Exception: pass
    sc.render.resolution_x = sc.render.resolution_y = LATO; sc.render.resolution_percentage = 100
    sc.render.use_motion_blur = QUALITA == "massima"; sc.render.motion_blur_shutter = 0.35
    if QUALITA == "massima" and MOTORE == "cycles":
        sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.005
        sub = corpo.modifiers.get("Liscio")
        if sub: sub.render_levels = 3
    sc.render.fps = FPS
    try: sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Punchy"
    except Exception:
        try: sc.view_settings.view_transform = "Filmic"
        except Exception: pass

def formato_video(percorso):
    s = sc.render.image_settings
    try: s.media_type = "VIDEO"  # Blender 5
    except Exception: pass
    s.file_format = "FFMPEG"
    sc.render.ffmpeg.format = "MPEG4"; sc.render.ffmpeg.codec = "H264"
    sc.render.ffmpeg.constant_rate_factor = "HIGH" if QUALITA == "massima" else "MEDIUM"; sc.render.ffmpeg.ffmpeg_preset = "BEST" if QUALITA == "massima" else "GOOD"
    sc.render.ffmpeg.audio_codec = "NONE"
    sc.render.filepath = percorso
def formato_foto(percorso):
    s = sc.render.image_settings
    try: s.media_type = "IMAGE"
    except Exception: pass
    s.file_format = "JPEG"; s.quality = 88; sc.render.filepath = percorso

def curva(punti, t):
    for (t0, v0), (t1, v1) in zip(punti, punti[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 0; u = u * u * (3 - 2 * u); return v0 + (v1 - v0) * u
    return punti[-1][1]

# ------------------------------------------------------------------ un esercizio
def pulisci():
    for pb in PB:
        for c in list(pb.constraints): pb.constraints.remove(c)
    for o in list(bpy.data.objects):
        if o.name.startswith(("ik_", "polo_", "rot_", "att_")): bpy.data.objects.remove(o)
    sch.animation_data_clear()
    mat = bpy.data.materials.get("HUD_Pelle")
    if mat and mat.node_tree and mat.node_tree.animation_data: mat.node_tree.animation_data_clear()

def esercizio(eid):
    mv = movimenti.MOVIMENTI[eid]; ex = TAB["esercizi"][eid]
    pulisci()
    N = int(mv["secondi"] * FPS); sc.frame_start = 1; sc.frame_end = N  # l'ultimo fotogramma = il primo: il loop non salta
    # 1) appoggio della prima posa: il punto più basso del corpo tocca terra (salvo "appoggio": False, es. su una panca)
    # appoggio: True = ogni posa tocca terra · False = solo la prima · "mai" = posizioni scritte a mano (panca, sbarra…)
    app = mv.get("appoggio", True)
    def a_terra(posa, escludi=(), terra=True):
        posa = dict(posa); posa["radice"] = dict(posa.get("radice", {}))
        if "presa" in mv: posa["locali"] = unisci_d(presa(mv["presa"]), posa.get("locali", {}))
        applica_posa(posa); aggiorna()
        if terra:
            p = list(posa["radice"].get("pos", PB["root"].bone.head_local)); p[2] -= min_z(escludi) - posa.get("volo", 0); posa["radice"]["pos"] = tuple(p)
        return posa
    chiavi = [(mv["chiavi"][0][0], a_terra(mv["chiavi"][0][1], terra=app != "mai"))]
    # 2) prima posa: attrezzi, poi IK (piedi a terra, mani a terra o sull'attrezzo)
    applica_posa(chiavi[0][1]); aggiorna()
    A = crea_attrezzi(mv)
    def metti_att(posa):
        for nome, tr in posa.get("att", {}).items():
            o = A[nome]
            if "pos" in tr: o.location = tr["pos"]
            o.rotation_mode = "XYZ"; o.rotation_euler = rot_corpo(tr.get("rot", [])).to_euler()
    metti_att(chiavi[0][1]); aggiorna()
    IK = {}
    lati = lambda v: "LR" if v is True else (v or "")
    for s_ in lati(mv.get("ik_piedi")):
        pp = mv.get("piedi_piatti", True); blocca_rotazione("foot." + s_, "piede" + s_, piatto=(s_ in pp) if isinstance(pp, str) else pp)
        pd = mv.get("poli_ginocchia", (0, -1, 0)); pd = pd if s_ == "L" else (-pd[0], pd[1], pd[2])
        bers = ik("lowerleg02." + s_, 4, mondo("foot." + s_), pd, "piede" + s_)
        aggiorna()
        pt = mv.get("piedi_a_terra", True)
        if ((s_ in pt) if isinstance(pt, str) else pt): bers.location.z -= min_z_osso("foot." + s_); aggiorna()  # la pianta tocca terra
        IK["piede" + s_] = bers
    mani = mv.get("ik_mani")
    if isinstance(mani, str) and mani in A:  # le mani impugnano un attrezzo (bilanciere, maniglia…) e lo seguono
        o = A[mani]; larg = mv.get("larghezza_presa", 0.25); sui = mv.get("mani_su_attrezzo", "LR")
        for s_, sx in (("L", 1), ("R", -1)):
            if s_ not in sui: continue
            aggiorna(); centro, asse, avanti, palmo = presa_mano(s_)
            polso = mondo("wrist." + s_); dal_polso = polso - centro
            punto = o.matrix_world @ Vector((sx * larg, 0, 0))
            r = blocca_rotazione("wrist." + s_, "mano" + s_); r.parent = o; r.matrix_parent_inverse = o.matrix_world.inverted()
            pd = mv.get("poli_gomiti", (0, 1, 0)); pd = pd if s_ == "L" else (-pd[0], pd[1], pd[2])
            bers = ik("lowerarm02." + s_, 4, punto + dal_polso, pd, "mano" + s_)
            bers.parent = o; bers.matrix_parent_inverse = o.matrix_world.inverted(); IK["mano" + s_] = bers
    else:
        for s_ in lati(mani):
            blocca_rotazione("wrist." + s_, "mano" + s_)
            pd = mv.get("poli_gomiti", (0, 1, 0)); pd = pd if s_ == "L" else (-pd[0], pd[1], pd[2])
            bers = ik("lowerarm02." + s_, 4, mondo("wrist." + s_), pd, "mano" + s_)
            aggiorna()
            if mv.get("mani_a_terra", True): bers.location.z -= min_z_osso("wrist." + s_); aggiorna()  # il palmo tocca terra
            IK["mano" + s_] = bers
    for a in mv.get("attrezzi", []):
        if a.get("tra_piedi") and "piedeL" in IK and "piedeR" in IK:  # pedana: tra i piedi, si muove con loro
            o = A[a.get("nome", a["tipo"])]; aggiorna()
            o.location = (IK["piedeL"].location + IK["piedeR"].location) / 2 + Vector(a.get("scosta", (0, 0, 0)))
            aggiorna(); o.parent = IK["piedeL"]; o.matrix_parent_inverse = IK["piedeL"].matrix_world.inverted()
    base_ik = {k: o.location.copy() for k, o in IK.items()}
    # le altre pose: a terra con quello che non è tenuto fermo dall'IK (es. il ponte appoggia le spalle)
    escl = (["gambe"] if mv.get("ik_piedi") else []) + (["braccia"] if mv.get("ik_mani") else [])
    for t, posa in mv["chiavi"][1:]:
        if t >= 1 and posa is mv["chiavi"][0][1]: chiavi.append((t, chiavi[0][1])); continue  # il loop si chiude esattamente sulla prima posa
        chiavi.append((t, a_terra(posa, escl, terra=app is True)))
    # 3) pose chiave: ossa, attrezzi, bersagli IK
    for t, posa in chiavi:
        f = 1 + round(t * (N - 1)) if t < 1 else N + 1
        applica_posa(posa); chiave(f)
        metti_att(posa)
        for nome in posa.get("att", {}):
            A[nome].keyframe_insert("location", frame=f); A[nome].keyframe_insert("rotation_euler", frame=f)
        for k, o in IK.items():
            if o.parent is None:
                o.location = base_ik[k] + Vector(posa.get("ik", {}).get(k, (0, 0, 0))); o.keyframe_insert("location", frame=f)
    aggiorna(); crea_linee(mv, A)
    # 4) muscoli
    attributi(ex); mat, vals = materiale()
    for f in range(1, N + 2):
        t = (f - 1) / N; s = curva(mv["sforzo"], t)
        vals["lavora"].outputs[0].default_value = 0.25 + 0.75 * s
        vals["aiuta"].outputs[0].default_value = 0.18 + 0.32 * s
        vals["allunga"].outputs[0].default_value = 0.35 + 0.65 * s
        for v in vals.values(): v.outputs[0].keyframe_insert("default_value", frame=f)
    # 5) camera: inquadra la figura in tutto il movimento, gira piano di qualche grado e torna
    luci, cam = scena(); motore()
    pts = []
    for f in range(1, N + 1, max(1, N // 8)):
        sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get(); ev = corpo.evaluated_get(dg)
        m = ev.to_mesh(); pts += [ev.matrix_world @ m.vertices[i].co for i in range(0, len(m.vertices), 25)]; ev.to_mesh_clear()
    for o in A.values():
        if o.type == "MESH" and mv.get("inquadra_attrezzi", True): pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centro = (lo + hi) / 2; diag = (hi - lo).length
    base = math.radians(VISTE.get(mv.get("vista", ex["vista"]), 35))
    dist = diag / (2 * math.tan(cam.data.angle / 2)) * mv.get("zoom", 0.88) + 0.2
    centro = centro - Vector((0, 0, 0.06 * diag))  # la figura un po' più in alto nell'inquadratura
    for f in range(1, N + 2):
        t = (f - 1) / N; a = base + math.radians(2.5) * math.sin(2 * math.pi * t)
        cam.location = centro + Vector((math.sin(a) * dist, -math.cos(a) * dist, mv.get("alto_camera", 0.25 + 0.08 * diag)))
        cam.rotation_euler = (centro - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.keyframe_insert("location", frame=f); cam.keyframe_insert("rotation_euler", frame=f)
    # 6) render
    os.makedirs(USCITA, exist_ok=True)
    picco = max(range(1, N + 1), key=lambda f: curva(mv["sforzo"], (f - 1) / N))
    if CHIAVI:
        for k, (t, _) in enumerate(mv["chiavi"]):
            sc.frame_set(1 + round(t * (N - 1))); formato_foto(os.path.join(USCITA, f"{eid}_k{k}.jpg")); bpy.ops.render.render(write_still=True)
        return
    sc.frame_set(picco); formato_foto(os.path.join(USCITA, eid + ".jpg")); bpy.ops.render.render(write_still=True)
    if not SOLO_FOTO:
        formato_video(os.path.join(USCITA, eid + ".mp4")); bpy.ops.render.render(animation=True)
        open(os.path.join(USCITA, f".{eid}.{QUALITA}"), "w").write("ok")  # segno: video finito a questa qualità
    print("fatto:", eid, "·", N, "fotogrammi")

import time
for i, eid in enumerate(ESERCIZI):
    if eid not in movimenti.MOVIMENTI: print("manca il movimento:", eid); continue
    if SALTA and os.path.exists(os.path.join(USCITA, f".{eid}.{QUALITA}")):
        print("già fatto:", eid); continue
    t0 = time.time(); esercizio(eid)
    print(f"[{i + 1}/{len(ESERCIZI)}] {eid}: {round((time.time() - t0) / 60, 1)} minuti", flush=True)
