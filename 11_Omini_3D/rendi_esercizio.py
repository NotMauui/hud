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
MOTORE = opz("--motore", "cycles"); LATO = int(opz("--lato", "720")); CAMPIONI = int(opz("--campioni", "32"))
USCITA = opz("--uscita", os.path.join(QUI, "video")); FPS = int(opz("--fps", "24"))
SOLO_FOTO = "--foto" in args
if SOLO_FOTO: args.remove("--foto")
CHIAVI = "--chiavi" in args  # una foto per ogni posa chiave, per correggere i movimenti
if CHIAVI: args.remove("--chiavi")
TAB = json.load(open(os.path.join(QUI, "muscoli.json"), encoding="utf-8"))
ESERCIZI = list(movimenti.MOVIMENTI) if (not args or args == ["tutti"]) else args

# colori (stile anatomico: corpo chiaro su fondo scuro, rosso dove si lavora)
GRIGIO = (0.30, 0.31, 0.34, 1); ROSSO = (0.90, 0.03, 0.02, 1); ROSA = (0.95, 0.38, 0.32, 1); AZZURRO = (0.0, 0.62, 1.0, 1)
FONDO = (0.012, 0.012, 0.016, 1)
VISTE = {"fronte": 0, "tre_quarti": 35, "lato": 90, "dietro": 180, "lato_sx": -90}

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
    rad = posa.get("radice", {}); pr = PB["root"]; R0 = pr.bone.matrix_local.to_3x3()
    R = rot_corpo(rad.get("rot", []))
    pr.rotation_quaternion = (R0.inverted() @ R @ R0).to_quaternion()
    if "pos" in rad:
        pr.location = R0.inverted() @ (Vector(rad["pos"]) - pr.bone.head_local)
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
    meta = mondo(catena_fine, "head")
    p.location = meta + Vector(polo_dir) * 0.8
    c = PB[catena_fine].constraints.new("IK"); c.target = e; c.pole_target = p; c.chain_count = n; c.use_tail = True
    # angolo del polo: quello che porta davvero il ginocchio/gomito verso il polo
    migliore = None
    for ang in (-90, 90, 0, 180):
        c.pole_angle = math.radians(ang); aggiorna()
        d = (mondo(catena_fine, "head") - p.location).length
        if migliore is None or d < migliore[0]: migliore = (d, ang)
    c.pole_angle = math.radians(migliore[1]); aggiorna()
    return e
def blocca_rotazione(osso, nome, piatto=False):
    """Tiene ferma la rotazione dell'osso nel mondo: com'è nella prima posa, o piatto come in piedi (pianta a terra)."""
    e = bpy.data.objects.new("rot_" + nome, None); sc.collection.objects.link(e)
    e.matrix_world = sch.matrix_world @ (PB[osso].bone.matrix_local if piatto else PB[osso].matrix)
    c = PB[osso].constraints.new("COPY_ROTATION"); c.target = e
    return e

# ------------------------------------------------------------------ materiale
def materiale():
    m = bpy.data.materials.get("HUD_Pelle") or bpy.data.materials.new("HUD_Pelle")
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
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
    w = bpy.data.worlds.get("HUD_Fondo") or bpy.data.worlds.new("HUD_Fondo"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = FONDO; w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    if "HUD_Pavimento" not in bpy.data.objects:
        bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0)); pav = bpy.context.object; pav.name = "HUD_Pavimento"
        mp = bpy.data.materials.new("HUD_Pavimento"); mp.use_nodes = True; b = mp.node_tree.nodes["Principled BSDF"]
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
    sc.render.ffmpeg.constant_rate_factor = "MEDIUM"; sc.render.ffmpeg.ffmpeg_preset = "GOOD"
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
        if o.name.startswith(("ik_", "polo_", "rot_")): bpy.data.objects.remove(o)
    sch.animation_data_clear()
    mat = bpy.data.materials.get("HUD_Pelle")
    if mat and mat.node_tree and mat.node_tree.animation_data: mat.node_tree.animation_data_clear()

def esercizio(eid):
    mv = movimenti.MOVIMENTI[eid]; ex = TAB["esercizi"][eid]
    pulisci()
    N = int(mv["secondi"] * FPS); sc.frame_start = 1; sc.frame_end = N  # l'ultimo fotogramma = il primo: il loop non salta
    # 1) appoggio della prima posa: il punto più basso del corpo tocca terra
    def a_terra(posa, escludi=()):
        posa = {"radice": dict(posa.get("radice", {})), "ossa": posa.get("ossa", {})}
        applica_posa(posa); aggiorna()
        p = list(posa["radice"].get("pos", PB["root"].bone.head_local)); p[2] -= min_z(escludi); posa["radice"]["pos"] = tuple(p)
        return posa
    chiavi = [(mv["chiavi"][0][0], a_terra(mv["chiavi"][0][1]))]
    # 2) IK dalla prima posa: piedi o mani restano dove sono
    applica_posa(chiavi[0][1]); aggiorna()
    if mv.get("ik_piedi"):
        for s in ("L", "R"):
            blocca_rotazione("foot." + s, "piede" + s, piatto=True)
            pd = mv.get("poli_ginocchia", (0, -1, 0)); pd = pd if s == "L" else (-pd[0], pd[1], pd[2])
            bers = ik("lowerleg02." + s, 4, mondo("foot." + s), pd, "piede" + s)
            aggiorna(); bers.location.z -= min_z_osso("foot." + s); aggiorna()  # la pianta tocca terra
    if mv.get("ik_mani"):
        for s in ("L", "R"):
            blocca_rotazione("wrist." + s, "mano" + s)
            pd = mv.get("poli_gomiti", (0, 1, 0)); pd = pd if s == "L" else (-pd[0], pd[1], pd[2])
            bers = ik("lowerarm02." + s, 4, mondo("wrist." + s), pd, "mano" + s)
            aggiorna(); bers.location.z -= min_z_osso("wrist." + s); aggiorna()  # il palmo tocca terra
    # le altre pose: a terra con quello che non è tenuto fermo dall'IK (es. il ponte appoggia le spalle)
    escl = (["gambe"] if mv.get("ik_piedi") else []) + (["braccia"] if mv.get("ik_mani") else [])
    for t, posa in mv["chiavi"][1:]:
        chiavi.append((t, a_terra(posa, escl) if mv.get("appoggio", True) else posa))
    # 3) pose chiave
    for t, posa in chiavi:
        applica_posa(posa); chiave(1 + round(t * (N - 1)) if t < 1 else N + 1)
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
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centro = (lo + hi) / 2; diag = (hi - lo).length
    base = math.radians(VISTE.get(mv.get("vista", ex["vista"]), 35))
    dist = diag / (2 * math.tan(cam.data.angle / 2)) * 0.97 + 0.25
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
    print("fatto:", eid, "·", N, "fotogrammi")

for eid in ESERCIZI:
    if eid not in movimenti.MOVIMENTI: print("manca il movimento:", eid); continue
    esercizio(eid)
