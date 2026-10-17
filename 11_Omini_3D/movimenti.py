# HUD · i movimenti degli esercizi, scritti come pose chiave.
#
# Assi del corpo (in piedi, la figura guarda verso -Y):  X = da destra a sinistra, Y = da davanti a dietro, Z = in alto.
# Ogni rotazione è in gradi attorno a un asse del corpo, rispetto alla posa di riposo (in piedi, braccia ad A):
#   X positivo = piegarsi in avanti (busto) · X negativo = portare in avanti braccia e gambe (flessione di spalla e anca)
#   per gomito e ginocchio: X negativo piega il gomito, X positivo piega il ginocchio
#   Y = inclinare di lato · Z = ruotare. Con sim() il lato destro riceve Y e Z col segno opposto.
# "radice" è il bacino: "pos" dove sta (metri, nel mondo) e "rot" come è girato tutto il corpo.
# "sforzo" (0–1 nel tempo) accende i muscoli: 1 = massima attivazione.
#
# Le pose si correggono qui, senza toccare il resto: ogni esercizio è un dizionario.

def sim(base, **ossa):
    """Copia le rotazioni sul lato destro, con Y e Z invertiti."""
    out = dict(base)
    for nome, rot in ossa.items():
        out[nome + ".L"] = rot
        out[nome + ".R"] = [(a, -g if a in "YZ" else g) for a, g in rot]
    return out

def dsim(**ossa):
    """Direzioni per i due lati: x cambia segno a destra. Es. dsim(upperarm01=(1, 0, 0)) = braccia orizzontali di lato."""
    out = {}
    for nome, (x, y, z) in ossa.items():
        out[nome + ".L"] = (x, y, z); out[nome + ".R"] = (-x, y, z)
    return out

def unisci(*dd):
    out = {}
    for d in dd: out.update(d)
    return out

# braccia lungo i fianchi (da A a I)
BRACCIA_GIU = sim({}, upperarm01=[("Y", 40)], lowerarm01=[("X", 0)])

# ---------------------------------------------------------------- squat
SQ_SU = {"radice": {"pos": (0, 0.06, 1.037)}, "ossa": sim({}, upperarm01=[("Y", 40), ("X", -85)], lowerarm01=[("X", 40)])}
SQ_GIU = {"radice": {"pos": (0, 0.18, 0.62), "rot": [("X", 32)]},
          "ossa": unisci(sim({"spine03": [("X", -6)], "spine01": [("X", -6)], "neck01": [("X", -14)]},
                             upperarm01=[("Y", 40), ("X", -105)], lowerarm01=[("X", 40)]))}

# ---------------------------------------------------------------- ponte glutei (supino, piedi a terra)
PO_GIU = {"radice": {"pos": (0, 0.0, 0.13), "rot": [("X", -90)]},
          "ossa": unisci(sim({}, upperleg01=[("X", -55)], lowerleg01=[("X", 105)], foot=[("X", -40)], upperarm01=[("Y", 34), ("X", 8)], lowerarm01=[("X", 45), ("Z", 15)]))}
PO_SU = {"radice": {"pos": (0, 0.04, 0.44), "rot": [("X", -124)]},
         "ossa": unisci(sim({"spine03": [("X", 6)], "spine01": [("X", 10)], "neck01": [("X", 20)]},
                            upperleg01=[("X", -30)], lowerleg01=[("X", 95)], foot=[("X", -30)], upperarm01=[("Y", 34), ("X", 8)], lowerarm01=[("X", 45), ("Z", 15)]))}

# ---------------------------------------------------------------- plank sui gomiti
PL = {"radice": {"pos": (0, 0.0, 0.30), "rot": [("X", 82)]},
      "ossa": unisci(sim({"neck01": [("X", -10)]}, upperarm01=[("Y", 40), ("X", -74)], lowerarm01=[("X", -65)], foot=[("X", 0)]))}
PL_RESPIRO = {"radice": {"pos": (0, 0.0, 0.305), "rot": [("X", 82)]},
              "ossa": unisci(sim({"neck01": [("X", -10)], "spine03": [("X", -1.5)]}, upperarm01=[("Y", 40), ("X", -74)], lowerarm01=[("X", -65)], foot=[("X", 0)]))}

# ---------------------------------------------------------------- gatto-mucca (quattro zampe)
GM_BASE_OSSA = sim({}, upperleg01=[("X", -80)], lowerleg01=[("X", 92)], foot=[("X", 45)], upperarm01=[("Y", 42), ("X", -82)], lowerarm01=[("X", 45)], wrist=[("Y", -90), ("X", -70)])
GM_NEUTRA = {"radice": {"pos": (0, 0.0, 0.50), "rot": [("X", 82)]}, "ossa": GM_BASE_OSSA}
# gatto: la schiena sale al centro (la parte bassa si estende, l'alta torna giù), testa giù
GM_GATTO = {"radice": {"pos": (0, 0.0, 0.50), "rot": [("X", 81)]},
            "ossa": unisci(GM_BASE_OSSA, {"spine05": [("X", -12)], "spine04": [("X", -9)], "spine03": [("X", 0)], "spine02": [("X", 10)], "spine01": [("X", 10)], "neck01": [("X", 22)], "neck02": [("X", 10)]})}
# mucca: la schiena scende al centro, testa su
GM_MUCCA = {"radice": {"pos": (0, 0.0, 0.50), "rot": [("X", 82)]},
            "ossa": unisci(GM_BASE_OSSA, {"spine05": [("X", 10)], "spine04": [("X", 8)], "spine03": [("X", 0)], "spine02": [("X", -8)], "spine01": [("X", -10)], "neck01": [("X", -32)], "neck02": [("X", -16)]})}

# ---------------------------------------------------------------- piegamenti (mani a terra, corpo dritto sulle punte)
PG_OSSA = sim({}, upperarm01=[("Y", 32), ("X", -74)], lowerarm01=[("X", 45)], wrist=[("Y", -90), ("X", -70)])
PG_SU = {"radice": {"pos": (0, 0.0, 0.75), "rot": [("X", 74)]}, "ossa": PG_OSSA}
PG_GIU = {"radice": {"pos": (0, 0.0, 0.35), "rot": [("X", 85)]}, "ossa": unisci(PG_OSSA, {"neck01": [("X", -8)]})}

# ---------------------------------------------------------------- sollevamenti sulle punte
PC_GIU = {"radice": {"pos": (0, 0.06, 1.037)}, "ossa": sim({}, upperarm01=[("Y", 40)], lowerarm01=[("X", 45)])}
PC_SU = {"radice": {"pos": (0, 0.06, 1.037)}, "ossa": sim({}, upperarm01=[("Y", 40)], lowerarm01=[("X", 45)], foot=[("X", 32)])}

# ---------------------------------------------------------------- posizione del bambino (seduto sui talloni, busto avanti, braccia lunghe)
BA_OSSA = sim({"neck01": [("X", 10)]}, upperleg01=[("X", -150)], lowerleg01=[("X", 155)], foot=[("X", 60)],
              upperarm01=[("Y", 40), ("X", -165)], lowerarm01=[("X", 45)])
BA_FUORI = {"radice": {"pos": (0, 0.0, 0.40), "rot": [("X", 105)]}, "ossa": BA_OSSA}
BA_DENTRO = {"radice": {"pos": (0, 0.0, 0.40), "rot": [("X", 106.5)]},
             "ossa": unisci(BA_OSSA, {"spine04": [("X", 4)], "spine03": [("X", 4)], "spine02": [("X", 3)]})}

# ================================================================ PALESTRA
IN_PIEDI = (0, 0.06, 1.037)
def posa(pos=IN_PIEDI, rot=(), ossa=None, dir=None, dirw=None, att=None, ik=None, locali=None, volo=0):
    p = {"radice": {"pos": pos, "rot": list(rot)}, "ossa": ossa or {}, "dir": dir or {}, "dirw": dirw or {}, "volo": volo}
    if att: p["att"] = att
    if ik: p["ik"] = ik
    if locali: p["locali"] = locali
    return p
def ciclo(a, b, picco=0.5, tenuta=0.1):
    """Andata e ritorno: a → b (tenuta) → a. Ritorna le chiavi."""
    return [(0, a), (picco - tenuta / 2, b), (picco + tenuta / 2, b), (1, a)]
SFORZO_SU = [(0, 0.25), (0.45, 0.4), (0.55, 1.0), (0.9, 0.7), (1, 0.25)]      # spinta nella risalita
SFORZO_ANDATA = [(0, 0.25), (0.45, 1.0), (0.55, 1.0), (1, 0.25)]            # spinta nell'andata
MANUBRI = [{"tipo": "manubrio"}]

# spinte sopra la testa con manubri
SP_GIU = posa(dir=dsim(upperarm01=(1, -0.25, -0.1), lowerarm01=(0.08, -0.15, 1)))
SP_SU = posa(dir=dsim(upperarm01=(0.32, -0.12, 1), lowerarm01=(0.12, -0.05, 1)))

GAMBE_GIU = dsim(upperleg01=(0.09, 0, -1), lowerleg01=(0.11, 0.02, -1))  # gambe dritte nel mondo (prima posa delle pose piegate in avanti)
BRACCIA_LUNGHE = dsim(upperarm01=(0.12, -0.05, -1), lowerarm01=(0.08, -0.08, -1))     # braccia lungo i fianchi
BRACCIA_AVANTI_GIU = dsim(upperarm01=(0.10, -0.12, -1), lowerarm01=(0.04, -0.18, -1))  # mani davanti alle cosce (bilanciere)

# squat con bilanciere sulle spalle
SQB_SU = posa(dirw=dsim(upperarm01=(0.85, 0.35, 0.05), lowerarm01=(-0.25, 0.25, 1)))
SQB_GIU = posa(pos=(0, 0.20, 0.64), rot=[("X", 38)], ossa={"spine03": [("X", -6)], "spine01": [("X", -6)], "neck01": [("X", -16)]},
               dirw=dsim(upperarm01=(0.85, 0.35, 0.05), lowerarm01=(-0.25, 0.25, 1)))
# goblet squat: un manubrio verticale al petto
GB_BR = dsim(upperarm01=(0.18, -0.45, -0.85), lowerarm01=(-0.45, -0.35, 0.8))
GB_SU = posa(dir=GB_BR)
GB_GIU = posa(pos=(0, 0.16, 0.60), rot=[("X", 22)], ossa={"spine02": [("X", -5)], "neck01": [("X", -10)]}, dir=GB_BR)

# stacco rumeno con bilanciere: le anche vanno indietro, la schiena resta dritta
RDL_SU = posa(dir=BRACCIA_AVANTI_GIU, att={"bilanciere": {"pos": (0, -0.12, 0.84)}})
RDL_GIU = posa(pos=(0, 0.24, 0.98), rot=[("X", 70)], ossa={"neck01": [("X", -18)]}, dir=BRACCIA_AVANTI_GIU, att={"bilanciere": {"pos": (0, -0.10, 0.50)}})

# rematore con bilanciere e con manubri (busto a 45°)
RB_GIU = posa(pos=(0, 0.17, 0.92), rot=[("X", 48)], ossa={"neck01": [("X", -20)]}, dirw=unisci(GAMBE_GIU, dsim(upperarm01=(0.1, -0.05, -1), lowerarm01=(0.05, 0, -1))), att={"bilanciere": {"pos": (0, -0.24, 0.58)}})
RB_SU = posa(pos=(0, 0.17, 0.92), rot=[("X", 48)], ossa={"neck01": [("X", -20)]}, dirw=dsim(upperarm01=(0.2, 0.85, -0.45), lowerarm01=(0.05, -0.1, -1)), att={"bilanciere": {"pos": (0, -0.12, 0.97)}})
RM_GIU = posa(pos=(0, 0.17, 0.92), rot=[("X", 48)], ossa={"neck01": [("X", -20)]}, dirw=unisci(GAMBE_GIU, dsim(upperarm01=(0.12, -0.05, -1), lowerarm01=(0.06, 0, -1))))
RM_SU = posa(pos=(0, 0.17, 0.92), rot=[("X", 48)], ossa={"neck01": [("X", -20)]}, dirw=dsim(upperarm01=(0.22, 0.85, -0.45), lowerarm01=(0.05, -0.05, -1)))

# alzate posteriori a busto piegato con manubri
AP_GIU = posa(pos=(0, 0.20, 0.94), rot=[("X", 68)], ossa={"neck01": [("X", -20)]}, dirw=unisci(GAMBE_GIU, dsim(upperarm01=(0.15, 0, -1), lowerarm01=(0.15, -0.1, -1))))
AP_SU = posa(pos=(0, 0.20, 0.94), rot=[("X", 68)], ossa={"neck01": [("X", -20)]}, dirw=dsim(upperarm01=(1, 0.05, -0.12), lowerarm01=(0.95, -0.15, -0.25)))

# apertura con elastico: braccia avanti → a T
AE_CHIUSA = posa(dir=dsim(upperarm01=(0.18, -1, 0.02), lowerarm01=(0.18, -1, 0.02)))
AE_APERTA = posa(dir=dsim(upperarm01=(1, -0.12, 0.02), lowerarm01=(1, -0.12, 0.02)))

# panca piana con bilanciere: sdraiato sulla panca, piedi a terra
PANCA = {"tipo": "panca", "pos": (0, 0.35, 0), "lungo": 1.25}
PP_SU = posa(pos=(0, 0, 0.57), rot=[("X", -90)], dirw=unisci(dsim(upperarm01=(0.14, -0.05, 1), lowerarm01=(0.04, 0, 1)), dsim(upperleg01=(0.18, -0.85, -0.45), lowerleg01=(0.05, -0.15, -1))),
             att={"bilanciere": {"pos": (0, 0.42, 1.18)}})
PP_GIU = posa(pos=(0, 0, 0.57), rot=[("X", -90)], dirw=unisci(dsim(upperarm01=(0.8, 0.1, 0.2), lowerarm01=(0.1, 0, 1)), dsim(upperleg01=(0.18, -0.85, -0.45), lowerleg01=(0.05, -0.15, -1))),
              att={"bilanciere": {"pos": (0, 0.36, 0.74)}})

# affondi: piede sinistro avanti, destro indietro sulle punte
AF_GAMBE = unisci(dsim(), {"upperleg01.L": (0.06, -0.42, -1), "lowerleg01.L": (0.06, -0.42, -1), "upperleg01.R": (-0.06, 0.42, -1), "lowerleg01.R": (-0.06, 0.42, -1)})
def af_su(braccia): return posa(dirw=unisci(AF_GAMBE, braccia), ossa={"foot.R": [("X", 35)]})
def af_giu(braccia): return posa(pos=(0, 0.02, 0.62), ossa={"foot.R": [("X", 35)]}, dirw=braccia)
AFFONDO_BASE = {"secondi": 4, "vista": "lato", "ik_piedi": True, "piedi_piatti": "L", "poli_ginocchia": (0, -1, -0.3), "appoggio": False, "sforzo": SFORZO_SU}

# split squat bulgaro: piede dietro su una panca
BU_SU = posa(dirw=unisci({"upperleg01.L": (0.06, -0.30, -1), "lowerleg01.L": (0.06, -0.05, -1), "upperleg01.R": (-0.06, 0.3, -1), "lowerleg01.R": (-0.04, 1, 0.12)}, BRACCIA_LUNGHE),
             ossa={"foot.R": [("X", 60)]})
BU_GIU = posa(pos=(0, 0.06, 0.66), rot=[("X", 8)], ossa={"foot.R": [("X", 60)]}, dirw=BRACCIA_LUNGHE)

# step-up: piede sinistro sul gradino, si sale
ST_GIU = posa(dirw=unisci({"upperleg01.L": (0.06, -0.75, -0.62), "lowerleg01.L": (0.05, 0.08, -1)}, BRACCIA_LUNGHE))
ST_SU = posa(pos=(0, -0.36, 1.44), dirw=BRACCIA_LUNGHE, ik={"piedeR": (0, -0.36, 0.42)})
STL_SU = posa(pos=(0, -0.36, 1.44), dir=dsim(), dirw={"upperarm01.L": (0.15, -0.6, -0.8), "lowerarm01.L": (0.05, -0.9, 0.3), "upperarm01.R": (-0.15, 0.5, -0.85), "lowerarm01.R": (-0.1, 0.2, -1)},
              ik={"piedeR": (0, -0.62, 0.80)})

# stacco su una gamba con kettlebell nella mano destra
R1_SU = posa(dirw=unisci({"upperleg01.L": (0.09, 0, -1), "lowerleg01.L": (0.11, 0.02, -1), "upperleg01.R": (-0.05, 0.25, -1), "lowerleg01.R": (-0.05, 0.4, -1)},
                         {"upperarm01.R": (-0.12, 0, -1), "lowerarm01.R": (-0.05, 0, -1), "upperarm01.L": (0.55, -0.2, -0.8), "lowerarm01.L": (0.4, -0.3, -0.85)}))
R1_GIU = posa(pos=(0, 0.12, 0.98), rot=[("X", 78)], ossa={"neck01": [("X", -20)]},
              dirw={"upperarm01.R": (-0.12, -0.05, -1), "lowerarm01.R": (-0.05, 0, -1), "upperarm01.L": (0.9, -0.2, -0.4), "lowerarm01.L": (0.85, -0.3, -0.4)})

# ponte su una gamba: la destra resta tesa in linea con la coscia sinistra
P1_GIU = posa(pos=(0, 0.0, 0.13), rot=[("X", -90)], ossa=unisci(sim({}, upperarm01=[("Y", 34), ("X", 8)], lowerarm01=[("X", 45), ("Z", 15)]),
              {"upperleg01.L": [("X", -55)], "lowerleg01.L": [("X", 105)], "foot.L": [("X", -40)], "upperleg01.R": [("X", -38)]}))
P1_SU = posa(pos=(0, 0.04, 0.44), rot=[("X", -124)], ossa=unisci(sim({"spine03": [("X", 6)], "spine01": [("X", 10)], "neck01": [("X", 20)]}, upperarm01=[("Y", 34), ("X", 8)], lowerarm01=[("X", 45), ("Z", 15)]),
             {"upperleg01.L": [("X", -30)], "lowerleg01.L": [("X", 95)], "foot.L": [("X", -30)], "upperleg01.R": [("X", -22)]}))

# hip thrust: spalle sulla panca, bilanciere sulle anche
HT_GAMBE = dsim(upperleg01=(0.1, -0.84, 0.53), lowerleg01=(0.05, -0.26, -0.96))
HT_GIU = posa(pos=(0, 0.07, 0.20), rot=[("X", -62)], ossa={"neck01": [("X", 20)]}, dirw=unisci(HT_GAMBE, dsim(upperarm01=(0.3, -0.9, 0.3), lowerarm01=(0.1, -0.5, 0.85))))
HT_SU = posa(pos=(0, 0.0, 0.46), rot=[("X", -92)], ossa={"neck01": [("X", 30)]}, dirw=HT_GAMBE)

# polpacci con manubri e con il bilanciere sulle spalle
PCM_GIU = posa(dirw=BRACCIA_LUNGHE)
PCM_SU = posa(dirw=BRACCIA_LUNGHE, ossa={"foot.L": [("X", 32)], "foot.R": [("X", 32)]})
PCB_GIU = posa(dirw=dsim(upperarm01=(0.85, 0.35, 0.05), lowerarm01=(-0.25, 0.25, 1)))
PCB_SU = posa(dirw=dsim(upperarm01=(0.85, 0.35, 0.05), lowerarm01=(-0.25, 0.25, 1)), ossa={"foot.L": [("X", 32)], "foot.R": [("X", 32)]})

# leg curl a pancia in giù sulla panca
LC_BR = dsim(upperarm01=(0.3, -0.75, -0.6), lowerarm01=(0.05, -0.2, -1))
LC_GIU = posa(pos=(0, 0.0, 0.59), rot=[("X", 90)], ossa={"neck01": [("X", -15)]}, dirw=LC_BR)
LC_SU = posa(pos=(0, 0.0, 0.59), rot=[("X", 90)], ossa={"neck01": [("X", -15)], "lowerleg01.L": [("X", 105)], "lowerleg01.R": [("X", 105)]}, dirw=LC_BR)

# ---------------------------------------------------------------- macchine e cavi
# lat machine: seduto, cosce sotto il cuscino, barra dall'alto al petto
LAT_GAMBE = dsim(upperleg01=(0.12, -1, 0.02), lowerleg01=(0.04, 0.05, -1))
LAT_SU = posa(pos=(0, 0.06, 0.60), rot=[("X", -10)], dirw=unisci(LAT_GAMBE, dsim(upperarm01=(0.32, 0, 1), lowerarm01=(0.12, 0, 1))), att={"maniglia": {"pos": (0, -0.04, 1.74)}})
LAT_GIU = posa(pos=(0, 0.06, 0.60), rot=[("X", -16)], ossa={"neck01": [("X", -10)]}, dirw=unisci(LAT_GAMBE, dsim(upperarm01=(0.85, 0.1, 0.2), lowerarm01=(0.1, 0, 1))), att={"maniglia": {"pos": (0, -0.12, 1.20)}})
LAT_ATTREZZI = [{"tipo": "scatola", "nome": "sedile", "dim": (0.45, 0.42, 0.48), "pos": (0, 0.10, 0.24)},
                {"tipo": "scatola", "nome": "cuscino", "dim": (0.5, 0.12, 0.09), "pos": (0, -0.24, 0.73)},
                {"tipo": "colonna", "punto": (0, -0.62, 2.42)},
                {"tipo": "scatola", "nome": "trave", "dim": (0.06, 0.62, 0.06), "pos": (0, -0.32, 2.45), "mat": "metallo"},
                {"tipo": "maniglia", "lungo": 1.2}]

# trazioni alla sbarra
TR_GAMBE = {"lowerleg01.L": [("X", 55)], "lowerleg01.R": [("X", 70)], "upperleg01.L": [("X", -10)], "upperleg01.R": [("X", -5)]}
TR_GIU = posa(pos=(0, 0.06, 1.36), ossa=TR_GAMBE, dirw=dsim(upperarm01=(0.3, 0, 1), lowerarm01=(0.1, 0, 1)))
TR_SU = posa(pos=(0, 0.06, 1.80), ossa=unisci(TR_GAMBE, {"neck01": [("X", -10)]}), dirw=dsim(upperarm01=(0.9, 0.1, -0.2), lowerarm01=(-0.1, 0, 1)))

# face pull alla corda, cavo alto davanti
FP_AVANTI = posa(dir=dsim(upperarm01=(0.15, -1, 0.15), lowerarm01=(0.05, -1, 0.15)), att={"corda": {"pos": (0, -0.66, 1.58)}})
FP_VISO = posa(dir=dsim(upperarm01=(1, -0.1, 0.35), lowerarm01=(-0.3, -0.6, 0.75)), att={"corda": {"pos": (0, -0.22, 1.66)}})

# pallof press: cavo di lato, le mani spingono avanti senza farsi girare
PA_GAMBE = dsim(upperleg01=(0.22, 0, -1), lowerleg01=(0.2, 0, -1))
PA_PETTO = posa(pos=(0, 0.08, 0.98), dirw=unisci(PA_GAMBE, dsim(upperarm01=(0.15, -0.3, -1), lowerarm01=(-0.6, -0.75, 0.2))), att={"maniglia": {"pos": (0, -0.24, 1.22)}})
PA_AVANTI = posa(pos=(0, 0.08, 0.98), dirw=unisci(PA_GAMBE, dsim(upperarm01=(-0.1, -1, -0.1), lowerarm01=(-0.1, -1, 0))), att={"maniglia": {"pos": (0, -0.62, 1.24)}})

# rotazione esterna con elastico (braccio sinistro, gomito al fianco)
RE_DENTRO = posa(dirw={"upperarm01.L": (0.12, 0.05, -1), "lowerarm01.L": (-0.55, -0.83, 0.05), **dsim(upperarm01=(0.12, 0, -1))})
RE_FUORI = posa(dirw={"upperarm01.L": (0.12, 0.05, -1), "lowerarm01.L": (0.8, -0.6, 0.05), "upperarm01.R": (-0.12, 0, -1), "lowerarm01.R": (-0.08, -0.08, -1)})

# camminata laterale con elastico alle caviglie (mezzo squat)
MO = lambda x, rot=10: posa(pos=(x, 0.10, 0.90), rot=[("X", rot)], dir=dsim(upperarm01=(0.25, -0.5, -0.8), lowerarm01=(0.05, -0.9, 0.3)))
def mo_chiave(x, l, r, alzaL=0, alzaR=0):
    p = MO(x); p["ik"] = {"piedeL": (l, 0, alzaL), "piedeR": (r, 0, alzaR)}; return p

# adduttori con elastico: la gamba sinistra attraversa davanti
AD_FUORI = posa(dirw={"upperleg01.L": (0.42, -0.05, -1), "lowerleg01.L": (0.42, -0.05, -1), **dsim(upperarm01=(0.35, -0.1, -1), lowerarm01=(0.3, -0.2, -1))})
AD_DENTRO = posa(dirw={"upperleg01.L": (-0.22, -0.22, -1), "lowerleg01.L": (-0.22, -0.22, -1), **dsim(upperarm01=(0.35, -0.1, -1), lowerarm01=(0.3, -0.2, -1))})

# swing con kettlebell: la spinta viene dalle anche
SW_GIU = posa(pos=(0, 0.20, 0.90), rot=[("X", 58)], ossa={"neck01": [("X", -25)]}, dirw=unisci(GAMBE_GIU, dsim(upperarm01=(0.04, 0.45, -1), lowerarm01=(0.02, 0.55, -1))))
SW_SU = posa(dirw=dsim(upperarm01=(0.06, -1, 0.05), lowerarm01=(0.03, -1, 0.08)))

# camminata del contadino (sul posto, manubri pesanti)
CO_L = posa(ossa={"upperleg01.L": [("X", -28)], "lowerleg01.L": [("X", 45)], "foot.L": [("X", 10)], "upperleg01.R": [("X", 6)]}, dirw=BRACCIA_LUNGHE)
CO_R = posa(ossa={"upperleg01.R": [("X", -28)], "lowerleg01.R": [("X", 45)], "foot.R": [("X", 10)], "upperleg01.L": [("X", 6)]}, dirw=BRACCIA_LUNGHE)
CO_MEZZO = posa(dirw=BRACCIA_LUNGHE)

# leg press: schienale inclinato, la pedana si muove con i piedi
LP_D = (0, -0.6, 0.8)
LP_GIU = posa(pos=(0, 0.10, 0.58), rot=[("X", -52)], dirw=unisci(dsim(upperleg01=(0.14, -0.15, 0.99), lowerleg01=(0.05, -0.95, 0.3)), dsim(upperarm01=(0.3, 0.1, -1), lowerarm01=(0.1, -0.5, -0.8))))
LP_SU = posa(pos=(0, 0.10, 0.58), rot=[("X", -52)], dirw=dsim(upperarm01=(0.3, 0.1, -1), lowerarm01=(0.1, -0.5, -0.8)), ik={"piedeL": (0, -0.24, 0.32), "piedeR": (0, -0.24, 0.32)})
LP_ATTREZZI = [{"tipo": "scatola", "nome": "sedile", "dim": (0.5, 0.5, 0.12), "pos": (0, 0.12, 0.42)},
               {"tipo": "scatola", "nome": "schienale", "dim": (0.5, 0.1, 0.8), "pos": (0, 0.42, 0.78), "rot": [("X", -38)]},
               {"tipo": "scatola", "nome": "basamento", "dim": (0.4, 0.9, 0.36), "pos": (0, 0.20, 0.18), "mat": "metallo"},
               {"tipo": "scatola", "nome": "pedana", "dim": (0.75, 0.05, 0.55), "rot": [("X", 127)], "tra_piedi": True, "scosta": (0, -0.05, 0.03), "mat": "metallo"}]

# ---------------------------------------------------------------- a terra
# plank laterale sul gomito destro, la pancia verso la camera
PLL_GAMBE = {"upperleg01.L": [("Y", -4)], "upperleg01.R": [("Y", 4)]}
PLL = posa(pos=(0, 0, 0.5), rot=[("Y", -75)], ossa=PLL_GAMBE, dirw={"upperarm01.R": (0, 0.05, -1), "lowerarm01.R": (0.15, -1, 0)}, dir={"upperarm01.L": (0.12, 0, -1), "lowerarm01.L": (-0.4, -0.5, -0.8)})
PLL2 = posa(pos=(0, 0, 0.5), rot=[("Y", -76.5)], ossa=PLL_GAMBE, dirw={"upperarm01.R": (0, 0.05, -1), "lowerarm01.R": (0.15, -1, 0)}, dir={"upperarm01.L": (0.12, 0, -1), "lowerarm01.L": (-0.4, -0.5, -0.8)})

# dead bug: supino, braccia al cielo, anche e ginocchia a 90°; braccio e gamba opposti si allungano
DB_BASE = unisci(dsim(upperarm01=(0.15, 0, 1), lowerarm01=(0.1, 0, 1)), dsim(upperleg01=(0.12, -0.05, 1), lowerleg01=(0.05, -1, 0.05)))
DB_N = posa(pos=(0, 0, 0.3), rot=[("X", -90)], dirw=DB_BASE)
DB_A = posa(pos=(0, 0, 0.3), rot=[("X", -90)], dirw=unisci(DB_BASE, {"upperarm01.L": (0.12, 1, 0.12), "lowerarm01.L": (0.1, 1, 0.12), "upperleg01.R": (-0.1, -1, 0.12), "lowerleg01.R": (-0.05, -1, 0.1)}))
DB_B = posa(pos=(0, 0, 0.3), rot=[("X", -90)], dirw=unisci(DB_BASE, {"upperarm01.R": (-0.12, 1, 0.12), "lowerarm01.R": (-0.1, 1, 0.12), "upperleg01.L": (0.1, -1, 0.12), "lowerleg01.L": (0.05, -1, 0.1)}))

# superman: a pancia in giù, braccia e gambe si alzano
SU_GIU = posa(pos=(0, 0, 0.3), rot=[("X", 90)], dirw=unisci(dsim(upperarm01=(0.2, -1, 0), lowerarm01=(0.15, -1, 0)), dsim(upperleg01=(0.08, 1, 0), lowerleg01=(0.08, 1, 0))), ossa={"foot.L": [("X", 60)], "foot.R": [("X", 60)]})
SU_SU = posa(pos=(0, 0, 0.3), rot=[("X", 90)], ossa={"neck01": [("X", -15)], "spine02": [("X", -6)], "foot.L": [("X", 60)], "foot.R": [("X", 60)]},
             dirw=unisci(dsim(upperarm01=(0.2, -1, 0.3), lowerarm01=(0.15, -1, 0.32)), dsim(upperleg01=(0.08, 1, 0.22), lowerleg01=(0.08, 1, 0.25))))

# russian twist: seduto, busto indietro, ruota da un lato all'altro
RU_GAMBE = dsim(upperleg01=(0.12, -0.75, 0.6), lowerleg01=(0.04, -0.6, -0.8))
RU_BR = dsim(upperarm01=(0.2, -0.55, -0.8), lowerarm01=(-0.65, -0.75, -0.05))
def ru(gradi): return posa(pos=(0, 0, 0.3), rot=[("X", -38)], ossa={"spine04": [("Z", gradi * 0.3)], "spine03": [("Z", gradi * 0.35)], "spine02": [("Z", gradi * 0.35)]}, dirw=RU_GAMBE, dir=RU_BR)

# mountain climber: plank alto, le ginocchia vengono al petto a turno
MC_BR = sim({}, upperarm01=[("Y", 32), ("X", -74)], lowerarm01=[("X", 45)], wrist=[("Y", -90), ("X", -70)])
MC_A = posa(pos=(0, 0, 0.75), rot=[("X", 74)], ossa=unisci(MC_BR, {"upperleg01.L": [("X", -95)], "lowerleg01.L": [("X", 110)]}))
MC_B = posa(pos=(0, 0, 0.75), rot=[("X", 74)], ossa=unisci(MC_BR, {"upperleg01.R": [("X", -95)], "lowerleg01.R": [("X", 110)]}))

# ---------------------------------------------------------------- salti e corsa
SJ_SU = posa(dir=dsim(upperarm01=(0.15, -0.15, -1), lowerarm01=(0.1, -0.3, -1)))
SJ_GIU = posa(pos=(0, 0.18, 0.66), rot=[("X", 30)], ossa={"neck01": [("X", -12)]}, dir=dsim(upperarm01=(0.15, 0.6, -0.8), lowerarm01=(0.1, 0.4, -1)))
SJ_ARIA = posa(pos=(0, 0.06, 1.33), dir=dsim(upperarm01=(0.2, -0.7, 0.7), lowerarm01=(0.1, -0.6, 0.8)), ik={"piedeL": (0, 0, 0.30), "piedeR": (0, 0, 0.30)})
def corsa(lato, ginocchio, salto=0.03):
    alto, basso = ("L", "R") if lato == "L" else ("R", "L")
    br = {"upperarm01." + basso: (0.12 * (1 if basso == "L" else -1), -0.6, -0.8), "lowerarm01." + basso: (0.05 * (1 if basso == "L" else -1), -0.9, 0.4),
          "upperarm01." + alto: (0.12 * (1 if alto == "L" else -1), 0.5, -0.85), "lowerarm01." + alto: (0.05 * (1 if alto == "L" else -1), -0.4, -0.9)}
    o = {"upperleg01." + alto: [("X", -ginocchio[0])], "lowerleg01." + alto: [("X", ginocchio[1])], "foot." + basso: [("X", 25)], "foot." + alto: [("X", 20)]}
    return posa(ossa=o, dirw=br, volo=salto)
BL_SX = posa(pos=(0.32, 0.10, 0.9), rot=[("X", 22), ("Y", 10)], ossa={"upperleg01.R": [("X", 10), ("Y", 10)], "lowerleg01.R": [("X", 80)]}, dir=dsim(upperarm01=(0.3, -0.5, -0.8), lowerarm01=(0.1, -0.9, 0.2)))
BL_DX = posa(pos=(-0.32, 0.10, 0.9), rot=[("X", 22), ("Y", -10)], ossa={"upperleg01.L": [("X", 10), ("Y", -10)], "lowerleg01.L": [("X", 80)]}, dir=dsim(upperarm01=(0.3, -0.5, -0.8), lowerarm01=(0.1, -0.9, 0.2)))
BL_ARIA_A = posa(pos=(0, 0.08, 1.3), rot=[("X", 8)], ossa={"lowerleg01.L": [("X", 40)], "lowerleg01.R": [("X", 40)]}, dir=dsim(upperarm01=(0.5, -0.2, -0.6), lowerarm01=(0.2, -0.6, 0.2)), volo=0.18)
BL_ARIA_B = BL_ARIA_A

MOVIMENTI = {
    "squat": {"secondi": 4, "chiavi": [(0, SQ_SU), (0.45, SQ_GIU), (0.55, SQ_GIU), (1, SQ_SU)],
              "ik_piedi": True, "poli_ginocchia": (0.35, -1, 0), "appoggio": False,
              "sforzo": [(0, 0.25), (0.45, 0.45), (0.55, 1.0), (0.85, 0.8), (1, 0.25)]},
    "ponte": {"secondi": 4, "vista": "tre_quarti", "alto_camera": 0.15, "chiavi": [(0, PO_GIU), (0.4, PO_SU), (0.6, PO_SU), (1, PO_GIU)],
              "ik_piedi": True, "poli_ginocchia": (0.3, -0.3, 1), "ik_mani": True, "poli_gomiti": (1, 0, 0.3),
              "sforzo": [(0, 0.2), (0.4, 1.0), (0.6, 1.0), (0.85, 0.4), (1, 0.2)]},
    "plank": { "zoom": 0.97,"secondi": 4, "vista": "lato", "alto_camera": 0.1, "chiavi": [(0, PL), (0.5, PL_RESPIRO), (1, PL)],
              "sforzo": [(0, 0.85), (0.5, 1.0), (1, 0.85)]},
    "piegamenti": { "zoom": 0.97,"secondi": 3, "chiavi": [(0, PG_SU), (0.45, PG_GIU), (0.55, PG_GIU), (1, PG_SU)],
                   "ik_mani": True, "poli_gomiti": (0.7, 1, 0.2),
                   "sforzo": [(0, 0.3), (0.45, 0.5), (0.55, 1.0), (0.9, 0.7), (1, 0.3)]},
    "polpacci": {"secondi": 3, "chiavi": [(0, PC_GIU), (0.4, PC_SU), (0.6, PC_SU), (1, PC_GIU)],
                 "sforzo": [(0, 0.2), (0.4, 1.0), (0.6, 1.0), (1, 0.2)]},
    "bambino": { "zoom": 0.97,"secondi": 6, "vista": "lato", "chiavi": [(0, BA_FUORI), (0.5, BA_DENTRO), (1, BA_FUORI)],
                "sforzo": [(0, 0.5), (0.5, 1.0), (1, 0.5)]},
    "spinte": {"secondi": 3, "chiavi": ciclo(SP_GIU, SP_SU), "attrezzi": MANUBRI, "presa": "LR", "sforzo": SFORZO_ANDATA},
    "squatbil": {"secondi": 4, "chiavi": ciclo(SQB_SU, SQB_GIU), "ik_piedi": True, "poli_ginocchia": (0.35, -1, 0), "appoggio": False,
                 "attrezzi": [{"tipo": "bilanciere", "pos": (0, 0.09, 1.53), "segue": "spine01"}], "ik_mani": "bilanciere", "larghezza_presa": 0.42,
                 "poli_gomiti": (0.3, 1, -1), "presa": "LR", "sforzo": SFORZO_SU},
    "goblet": {"secondi": 4, "chiavi": ciclo(GB_SU, GB_GIU), "ik_piedi": True, "poli_ginocchia": (0.35, -1, 0), "appoggio": False,
               "attrezzi": [{"tipo": "manubrio", "nome": "goblet", "pos": (0, -0.24, 1.30), "rot": [("Y", 90)], "segue": "spine02", "peso": 1.6}],
               "presa": "LR", "sforzo": SFORZO_SU},
    "rdl": {"secondi": 4, "vista": "tre_quarti_dietro", "chiavi": ciclo(RDL_SU, RDL_GIU), "ik_piedi": True, "poli_ginocchia": (0, -1, 0), "appoggio": False,
            "attrezzi": [{"tipo": "bilanciere"}], "ik_mani": "bilanciere", "larghezza_presa": 0.25, "poli_gomiti": (0, 1, 0), "presa": "LR", "sforzo": SFORZO_SU},
    "rematorebil": {"secondi": 3, "vista": "tre_quarti_dietro", "chiavi": ciclo(RB_GIU, RB_SU), "ik_piedi": True, "poli_ginocchia": (0, -1, 0), "appoggio": False,
                    "attrezzi": [{"tipo": "bilanciere"}], "ik_mani": "bilanciere", "larghezza_presa": 0.28, "poli_gomiti": (0.4, 1, 0.6), "presa": "LR", "sforzo": SFORZO_ANDATA},
    "rematore": {"secondi": 3, "vista": "tre_quarti_dietro", "chiavi": ciclo(RM_GIU, RM_SU), "ik_piedi": True, "poli_ginocchia": (0, -1, 0), "appoggio": False,
                 "attrezzi": MANUBRI, "presa": "LR", "sforzo": SFORZO_ANDATA},
    "alzatepost": {"secondi": 3, "vista": "tre_quarti", "chiavi": ciclo(AP_GIU, AP_SU), "ik_piedi": True, "poli_ginocchia": (0, -1, 0), "appoggio": False,
                   "attrezzi": MANUBRI, "presa": "LR", "sforzo": SFORZO_ANDATA},
    "apertura": {"secondi": 3, "chiavi": ciclo(AE_CHIUSA, AE_APERTA), "presa": "LR", "sforzo": SFORZO_ANDATA,
                 "linee": [{"da": ("wrist.L", "head"), "a": ("wrist.R", "head"), "elastico": True, "raggio": 0.007}]},
    "panca": {"secondi": 3, "vista": "tre_quarti", "chiavi": ciclo(PP_SU, PP_GIU), "appoggio": "mai", "ik_piedi": True, "poli_ginocchia": (0.3, -0.3, 1),
              "attrezzi": [PANCA, {"tipo": "bilanciere"}], "ik_mani": "bilanciere", "larghezza_presa": 0.40, "poli_gomiti": (1, 0, -0.6), "presa": "LR",
              "sforzo": SFORZO_SU},
    "affondo": {**AFFONDO_BASE, "chiavi": ciclo(af_su(BRACCIA_LUNGHE), af_giu(BRACCIA_LUNGHE))},
    "affondoman": {**AFFONDO_BASE, "chiavi": ciclo(af_su(BRACCIA_LUNGHE), af_giu(BRACCIA_LUNGHE)), "attrezzi": MANUBRI, "presa": "LR"},
    "bulgaro": {"secondi": 4, "vista": "lato", "chiavi": ciclo(BU_SU, BU_GIU), "ik_piedi": True, "piedi_piatti": "L", "piedi_a_terra": "L",
                "poli_ginocchia": (0, -1, -0.3), "appoggio": False, "attrezzi": [{"tipo": "gradino", "sotto": "foot.R", "dy": 0.08, "dim": (0.45, 0.4, 0.4)}] + MANUBRI,
                "presa": "LR", "sforzo": SFORZO_SU},
    "stepup": { "zoom": 1.02,"secondi": 4, "vista": "lato", "chiavi": ciclo(ST_GIU, ST_SU), "ik_piedi": True, "piedi_a_terra": "R", "poli_ginocchia": (0, -1, 0), "appoggio": False,
               "attrezzi": [{"tipo": "gradino", "sotto": "foot.L", "dy": -0.04, "dim": (0.5, 0.45, 0.4)}] + MANUBRI, "presa": "LR", "sforzo": SFORZO_ANDATA},
    "stepupl": { "zoom": 1.02,"secondi": 4, "vista": "lato", "chiavi": ciclo(ST_GIU, STL_SU), "ik_piedi": True, "piedi_a_terra": "R", "poli_ginocchia": (0, -1, 0), "appoggio": False,
                "attrezzi": [{"tipo": "gradino", "sotto": "foot.L", "dy": -0.04, "dim": (0.5, 0.45, 0.4)}], "sforzo": SFORZO_ANDATA},
    "rdl1": {"secondi": 4, "vista": "lato", "chiavi": ciclo(R1_SU, R1_GIU), "ik_piedi": "L", "poli_ginocchia": (0, -1, 0), "appoggio": False,
             "attrezzi": [{"tipo": "kettlebell", "mano": "R"}], "presa": "R", "sforzo": SFORZO_SU},
    "ponte1": {"secondi": 4, "vista": "tre_quarti", "alto_camera": 0.15, "chiavi": ciclo(P1_GIU, P1_SU, 0.5, 0.2), "ik_piedi": "L", "poli_ginocchia": (0.3, -0.3, 1),
               "ik_mani": True, "poli_gomiti": (1, 0, 0.3), "sforzo": [(0, 0.2), (0.4, 1.0), (0.6, 1.0), (0.85, 0.4), (1, 0.2)]},
    "hipthrust": {"secondi": 4, "vista": "tre_quarti", "alto_camera": 0.2, "chiavi": ciclo(HT_GIU, HT_SU), "appoggio": "mai", "ik_piedi": True, "poli_ginocchia": (0.2, -0.3, 1),
                  "attrezzi": [{"tipo": "panca", "pos": (0, 0.64, 0), "alto": 0.38, "lungo": 1.2, "rot": 90}, {"tipo": "bilanciere", "pos": (0, 0.03, 0.27), "segue": "root"}],
                  "ik_mani": "bilanciere", "larghezza_presa": 0.36, "poli_gomiti": (1, 0, -0.5), "presa": "LR", "sforzo": SFORZO_ANDATA},
    "polpaccim": {"secondi": 3, "vista": "dietro", "chiavi": ciclo(PCM_GIU, PCM_SU, 0.5, 0.2), "attrezzi": MANUBRI, "presa": "LR",
                  "sforzo": [(0, 0.2), (0.4, 1.0), (0.6, 1.0), (1, 0.2)]},
    "polpaccip": {"secondi": 3, "vista": "tre_quarti_dietro", "chiavi": ciclo(PCB_GIU, PCB_SU, 0.5, 0.2),
                  "attrezzi": [{"tipo": "bilanciere", "pos": (0, 0.09, 1.53), "segue": "spine01"}], "ik_mani": "bilanciere", "larghezza_presa": 0.42,
                  "poli_gomiti": (0.3, 1, -1), "presa": "LR", "sforzo": [(0, 0.2), (0.4, 1.0), (0.6, 1.0), (1, 0.2)]},
    "legcurl": { "zoom": 0.97,"secondi": 3, "vista": "lato", "chiavi": ciclo(LC_GIU, LC_SU), "appoggio": "mai",
                "attrezzi": [{"tipo": "panca", "pos": (0, -0.22, 0), "lungo": 1.3, "alto": 0.45}, {"tipo": "rullo", "presso": ("lowerleg02.L", "tail", (0, -0.02, 0.09)), "x0": True, "lungo": 0.5, "r": 0.055, "segue": "lowerleg02.L"}],
                "sforzo": SFORZO_ANDATA},
    "lat": {"secondi": 3, "chiavi": ciclo(LAT_SU, LAT_GIU), "appoggio": "mai", "attrezzi": LAT_ATTREZZI, "ik_mani": "maniglia", "larghezza_presa": 0.40,
            "poli_gomiti": (1, 0.3, -0.6), "presa": "LR", "linee": [{"da": (0, -0.04, 2.42), "a": "maniglia", "raggio": 0.005}], "sforzo": SFORZO_ANDATA},
    "trazioni": {"secondi": 3, "chiavi": ciclo(TR_GIU, TR_SU), "appoggio": "mai", "attrezzi": [{"tipo": "sbarra", "alto": 2.45, "y": -0.02}], "ik_mani": "sbarra",
                 "larghezza_presa": 0.30, "poli_gomiti": (1, 0.2, -0.6), "presa": "LR", "sforzo": SFORZO_ANDATA},
    "facepull": {"secondi": 3, "vista": "tre_quarti_dietro", "chiavi": ciclo(FP_AVANTI, FP_VISO), "attrezzi": [{"tipo": "colonna", "punto": (0, -1.15, 1.75)}, {"tipo": "corda"}],
                 "ik_mani": "corda", "larghezza_presa": 0.10, "poli_gomiti": (1, 0.3, 0.4), "presa": "LR", "linee": [{"da": (0, -1.15, 1.75), "a": "corda", "raggio": 0.005}],
                 "sforzo": SFORZO_ANDATA},
    "pallof": {"secondi": 4, "vista": "fronte", "chiavi": ciclo(PA_PETTO, PA_AVANTI, 0.5, 0.3), "ik_piedi": True, "poli_ginocchia": (0.3, -1, 0), "appoggio": "mai",
               "attrezzi": [{"tipo": "colonna", "punto": (1.05, -0.24, 1.22)}, {"tipo": "maniglia", "lungo": 0.18}], "ik_mani": "maniglia", "larghezza_presa": 0.04,
               "poli_gomiti": (0.3, 0, -1), "presa": "LR", "linee": [{"da": (1.05, -0.24, 1.22), "a": "maniglia", "raggio": 0.005}],
               "sforzo": [(0, 0.5), (0.35, 1.0), (0.65, 1.0), (1, 0.5)]},
    "rotest": {"secondi": 3, "vista": "tre_quarti", "chiavi": ciclo(RE_DENTRO, RE_FUORI), "presa": "L", "sforzo": SFORZO_ANDATA,
               "linee": [{"da": (-0.75, -0.25, 1.02), "a": ("wrist.L", "head"), "elastico": True, "raggio": 0.008}]},
    "mostro": {"secondi": 4, "vista": "fronte", "ik_piedi": True, "poli_ginocchia": (0.4, -1, 0), "appoggio": "mai",
               "chiavi": [(0, mo_chiave(0, 0, 0)), (0.125, mo_chiave(0.05, 0.1, 0, alzaL=0.06)), (0.25, mo_chiave(0.10, 0.2, 0)), (0.375, mo_chiave(0.15, 0.2, 0.1, alzaR=0.06)),
                          (0.5, mo_chiave(0.20, 0.2, 0.2)), (0.625, mo_chiave(0.15, 0.2, 0.1, alzaR=0.06)), (0.75, mo_chiave(0.10, 0.2, 0)), (0.875, mo_chiave(0.05, 0.1, 0, alzaL=0.06)), (1, mo_chiave(0, 0, 0))],
               "linee": [{"da": ("lowerleg02.L", "tail"), "a": ("lowerleg02.R", "tail"), "elastico": True, "raggio": 0.012}],
               "sforzo": [(0, 0.7), (0.25, 1.0), (0.5, 0.8), (0.75, 1.0), (1, 0.7)]},
    "adduttori": {"secondi": 3, "vista": "fronte", "chiavi": ciclo(AD_FUORI, AD_DENTRO), "ik_piedi": "R", "appoggio": False,
                  "attrezzi": [{"tipo": "colonna", "punto": (1.0, -0.05, 0.14)}],
                  "linee": [{"da": (1.0, -0.05, 0.14), "a": ("lowerleg02.L", "tail"), "elastico": True, "raggio": 0.009}], "sforzo": SFORZO_ANDATA},
    "swing": { "zoom": 1.02,"secondi": 2.5, "vista": "lato", "chiavi": ciclo(SW_GIU, SW_SU, 0.5, 0.06), "ik_piedi": True, "poli_ginocchia": (0.2, -1, 0), "appoggio": False,
              "attrezzi": [{"tipo": "kettlebell", "mano": "L"}], "ik_mani": "kettlebell", "mani_su_attrezzo": "R", "larghezza_presa": 0.05, "poli_gomiti": (-0.3, 1, -0.5),
              "presa": "LR", "sforzo": [(0, 0.4), (0.25, 1.0), (0.5, 0.5), (0.9, 0.3), (1, 0.4)]},
    "contadino": {"secondi": 2, "vista": "tre_quarti", "chiavi": [(0, CO_MEZZO), (0.25, CO_L), (0.5, CO_MEZZO), (0.75, CO_R), (1, CO_MEZZO)],
                  "attrezzi": [{"tipo": "manubrio", "peso": 1.8}], "presa": "LR", "sforzo": [(0, 0.85), (0.5, 1.0), (1, 0.85)]},
    "legpress": { "zoom": 1.02,"secondi": 3.5, "vista": "lato", "chiavi": ciclo(LP_GIU, LP_SU), "appoggio": "mai", "ik_piedi": True, "piedi_piatti": False, "piedi_a_terra": False,
                 "poli_ginocchia": (0.3, -0.6, 0.6), "attrezzi": LP_ATTREZZI, "sforzo": SFORZO_ANDATA},
    "plankl": { "zoom": 0.97,"secondi": 4, "vista": "fronte", "chiavi": [(0, PLL), (0.5, PLL2), (1, PLL)], "sforzo": [(0, 0.85), (0.5, 1.0), (1, 0.85)]},
    "deadbug": {"secondi": 5, "vista": "tre_quarti", "chiavi": [(0, DB_N), (0.25, DB_A), (0.5, DB_N), (0.75, DB_B), (1, DB_N)],
                "sforzo": [(0, 0.5), (0.25, 1.0), (0.5, 0.5), (0.75, 1.0), (1, 0.5)]},
    "superman": { "zoom": 0.97,"secondi": 3, "vista": "lato", "chiavi": ciclo(SU_GIU, SU_SU), "sforzo": SFORZO_ANDATA},
    "russian": {"secondi": 3, "vista": "tre_quarti", "chiavi": [(0, ru(0)), (0.25, ru(32)), (0.5, ru(0)), (0.75, ru(-32)), (1, ru(0))],
                "sforzo": [(0, 0.6), (0.25, 1.0), (0.5, 0.6), (0.75, 1.0), (1, 0.6)]},
    "mountain": { "zoom": 0.97,"secondi": 1.6, "vista": "lato", "chiavi": [(0, MC_A), (0.5, MC_B), (1, MC_A)], "ik_mani": True, "poli_gomiti": (0.7, 1, 0.2),
                 "sforzo": [(0, 0.9), (0.5, 1.0), (1, 0.9)]},
    "squatjump": {"secondi": 2.5, "chiavi": [(0, SJ_SU), (0.3, SJ_GIU), (0.55, SJ_ARIA), (0.75, SJ_SU), (1, SJ_SU)], "ik_piedi": True, "poli_ginocchia": (0.35, -1, 0),
                  "appoggio": False, "sforzo": [(0, 0.3), (0.3, 0.6), (0.45, 1.0), (0.6, 0.7), (1, 0.3)]},
    "skip": {"secondi": 1.2, "vista": "lato", "chiavi": [(0, corsa("L", (80, 90))), (0.5, corsa("R", (80, 90))), (1, corsa("L", (80, 90)))],
             "sforzo": [(0, 1.0), (0.25, 0.7), (0.5, 1.0), (0.75, 0.7), (1, 1.0)]},
    "calciata": {"secondi": 1.2, "vista": "lato", "chiavi": [(0, corsa("L", (10, 135))), (0.5, corsa("R", (10, 135))), (1, corsa("L", (10, 135)))],
                 "sforzo": [(0, 1.0), (0.25, 0.7), (0.5, 1.0), (0.75, 0.7), (1, 1.0)]},
    "balzilat": {"secondi": 3, "vista": "fronte", "chiavi": [(0, BL_SX), (0.25, BL_ARIA_A), (0.5, BL_DX), (0.75, BL_ARIA_B), (1, BL_SX)],
                 "sforzo": [(0, 1.0), (0.25, 0.6), (0.5, 1.0), (0.75, 0.6), (1, 1.0)]},
    "gattomucca": {"secondi": 6, "chiavi": [(0, GM_NEUTRA), (0.25, GM_GATTO), (0.5, GM_NEUTRA), (0.75, GM_MUCCA), (1, GM_NEUTRA)],
                   "ik_mani": True, "poli_gomiti": (0, 1, 0),
                   "sforzo": [(0, 0.3), (0.25, 1.0), (0.5, 0.3), (0.75, 1.0), (1, 0.3)]},
}
