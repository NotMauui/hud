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

MOVIMENTI = {
    "squat": {"secondi": 4, "chiavi": [(0, SQ_SU), (0.45, SQ_GIU), (0.55, SQ_GIU), (1, SQ_SU)],
              "ik_piedi": True, "poli_ginocchia": (0.35, -1, 0), "appoggio": False,
              "sforzo": [(0, 0.25), (0.45, 0.45), (0.55, 1.0), (0.85, 0.8), (1, 0.25)]},
    "ponte": {"secondi": 4, "vista": "tre_quarti", "alto_camera": 0.15, "chiavi": [(0, PO_GIU), (0.4, PO_SU), (0.6, PO_SU), (1, PO_GIU)],
              "ik_piedi": True, "poli_ginocchia": (0, 0, 1), "ik_mani": True, "poli_gomiti": (1, 0, 0.3),
              "sforzo": [(0, 0.2), (0.4, 1.0), (0.6, 1.0), (0.85, 0.4), (1, 0.2)]},
    "plank": {"secondi": 4, "vista": "lato", "alto_camera": 0.1, "chiavi": [(0, PL), (0.5, PL_RESPIRO), (1, PL)],
              "sforzo": [(0, 0.85), (0.5, 1.0), (1, 0.85)]},
    "piegamenti": {"secondi": 3, "chiavi": [(0, PG_SU), (0.45, PG_GIU), (0.55, PG_GIU), (1, PG_SU)],
                   "ik_mani": True, "poli_gomiti": (0.7, 1, 0.2),
                   "sforzo": [(0, 0.3), (0.45, 0.5), (0.55, 1.0), (0.9, 0.7), (1, 0.3)]},
    "polpacci": {"secondi": 3, "chiavi": [(0, PC_GIU), (0.4, PC_SU), (0.6, PC_SU), (1, PC_GIU)],
                 "sforzo": [(0, 0.2), (0.4, 1.0), (0.6, 1.0), (1, 0.2)]},
    "bambino": {"secondi": 6, "vista": "lato", "chiavi": [(0, BA_FUORI), (0.5, BA_DENTRO), (1, BA_FUORI)],
                "sforzo": [(0, 0.5), (0.5, 1.0), (1, 0.5)]},
    "gattomucca": {"secondi": 6, "chiavi": [(0, GM_NEUTRA), (0.25, GM_GATTO), (0.5, GM_NEUTRA), (0.75, GM_MUCCA), (1, GM_NEUTRA)],
                   "ik_mani": True, "poli_gomiti": (0, 1, 0),
                   "sforzo": [(0, 0.3), (0.25, 1.0), (0.5, 0.3), (0.75, 1.0), (1, 0.3)]},
}
