# HUD · i movimenti degli esercizi di mobilità (stesse regole di movimenti.py).
from movimenti import posa, sim, dsim, unisci, ciclo, IN_PIEDI, BRACCIA_LUNGHE, GM_BASE_OSSA, PG_SU, PG_OSSA

BL = BRACCIA_LUNGHE
def collo(x=0, y=0, z=0):
    """Testa e collo: X = mento giù, Y = orecchio verso la spalla, Z = girare. Diviso sulle 4 vertebre."""
    out = {}
    for o, k in (("neck01", 0.3), ("neck02", 0.3), ("neck03", 0.2), ("head", 0.2)):
        out[o] = [(a, g * k) for a, g in (("X", x), ("Y", y), ("Z", z)) if g]
    return out
def busto(x=0, y=0, z=0):
    """Busto: X = avanti, Y = di lato, Z = ruotare. Diviso sulle 5 vertebre."""
    out = {}
    for o, k in (("spine05", 0.15), ("spine04", 0.2), ("spine03", 0.25), ("spine02", 0.2), ("spine01", 0.2)):
        out[o] = [(a, g * k) for a, g in (("X", x), ("Y", y), ("Z", z)) if g]
    return out
def tieni(a, b, durata=0.5):
    """Va in posizione, tiene, torna (gli allungamenti statici)."""
    return ciclo(a, b, 0.5, durata)
def giro(*pose):
    """Pose in sequenza a intervalli uguali, il loop chiude sulla prima."""
    n = len(pose); return [(i / n, p) for i, p in enumerate(pose)] + [(1, pose[0])]
SF_TIENI = [(0, 0.2), (0.25, 1.0), (0.75, 1.0), (1, 0.2)]
SF_ANDATA = [(0, 0.25), (0.45, 1.0), (0.55, 1.0), (1, 0.25)]
def sf_onde(n):  # n spinte uguali nel ciclo
    return [(i / (2 * n), 0.3 if i % 2 == 0 else 1.0) for i in range(2 * n)] + [(1, 0.3)]

# posizioni di base
SUP = dict(pos=(0, 0, 0.2), rot=[("X", -90)])                      # supino (testa verso +Y, pancia in alto)
PRONO = dict(pos=(0, 0, 0.2), rot=[("X", 90)])                     # a pancia in giù
FIANCO_DX = dict(pos=(0, 0, 0.3), rot=[("Y", -90)])               # sdraiato sul fianco destro, la pancia verso −Y
GINOCCHIA_SU = dsim(upperleg01=(0.12, -0.75, -0.65), lowerleg01=(0.05, 0.55, -0.85))  # supino, piedi a terra (assi del corpo)
QUAD_GAMBE = dsim(upperleg01=(0.1, 0, -1), lowerleg01=(0.05, 1, -0.02))              # in ginocchio, cosce verticali (mondo)
PIEDI_DISTESI = {"foot.L": [("X", 60)], "foot.R": [("X", 60)]}

MOV_MOB = {}
def M(eid, chiavi, secondi=6, sforzo=SF_TIENI, **kw):
    MOV_MOB[eid] = {"secondi": min(secondi, 6), "chiavi": chiavi, "sforzo": sforzo, **kw}  # al massimo 6 secondi: il video gira in loop

# ================================================================ COLLO
def C(x=0, y=0, z=0, **kw):
    d = kw.pop("dir", {}); bw = {k: v for k, v in kw.pop("dirw", BL).items() if k not in d}
    return posa(dirw=bw, dir=d, ossa=unisci(collo(x, y, z), kw.pop("ossa", {})), **kw)
COLLO = dict(inquadra_da=0.95, zoom=0.95)
M("collocars", giro(C(x=32), C(y=34), C(x=-30), C(y=-34)), 8, sf_onde(4), **COLLO)
M("mentoindietro", ciclo(C(), posa(dirw=BL, ossa={"neck01": [("X", 14)], "neck02": [("X", 6)], "neck03": [("X", -6)], "head": [("X", -14)]}), 0.5, 0.3), 4, SF_TIENI, **COLLO)
MANO_TESTA_L = {"upperarm01.L": (0.6, -0.05, 0.8), "lowerarm01.L": (-1, -0.05, -0.05)}
M("collolat", tieni(C(), C(y=-38, dir=MANO_TESTA_L)), 8, **COLLO)
M("elevatore", tieni(C(), C(x=38, z=35, dir={"upperarm01.L": (0.55, -0.2, 0.8), "lowerarm01.L": (-0.75, 0.45, 0.1)})), 8, **COLLO)
M("sguardo", giro(C(), C(z=70, ossa=busto(z=12)), C(), C(z=-70, ossa=busto(z=-12))), 6, sf_onde(2), **COLLO)
FRONTE = {"upperarm01.L": (0.35, -0.75, -0.1), "lowerarm01.L": (-0.45, -0.25, 0.85)}
TEMPIA = {"upperarm01.L": (0.85, -0.1, -0.15), "lowerarm01.L": (-0.55, 0, 0.85)}
M("collois", [(0, C()), (0.1, C(dir=FRONTE)), (0.4, C(dir=FRONTE)), (0.5, C()), (0.6, C(dir=TEMPIA)), (0.9, C(dir=TEMPIA)), (1, C())], 8,
  [(0, 0.2), (0.15, 1.0), (0.4, 1.0), (0.5, 0.2), (0.65, 1.0), (0.9, 1.0), (1, 0.2)], **COLLO)

# ================================================================ SPALLE
def BR(L, R=None, **kw):  # braccio sinistro (e destro) negli assi del corpo, l'altro lungo il fianco
    d = {"upperarm01.L": L[0], "lowerarm01.L": L[1]}
    if R: d.update({"upperarm01.R": R[0], "lowerarm01.R": R[1]})
    return posa(dir=d, dirw=kw.pop("dirw", {} if R else {"upperarm01.R": (-0.12, -0.05, -1), "lowerarm01.R": (-0.08, -0.08, -1)}), **kw)
def ret(v): return (v, v)
M("spallacars", giro(BR(ret((0.12, 0, -1))), BR(ret((0.12, -1, 0))), BR(ret((0.15, -0.1, 1))), BR(ret((0.85, 0.5, 0.15))), BR(ret((0.35, 0.45, -0.85)))), 8, sf_onde(5))
M("cerchibraccia", giro(*[posa(dir=dsim(upperarm01=v, lowerarm01=v)) for v in ((1, -0.18, 0), (1, 0, 0.18), (1, 0.18, 0), (1, 0, -0.18))]), 2, [(0, 0.8), (0.5, 1.0), (1, 0.8)])
M("petto", ciclo(posa(dir=dsim(upperarm01=(0.15, -1, 0.02), lowerarm01=(-0.25, -1, 0.02))), posa(dir=dsim(upperarm01=(1, 0.45, 0.1), lowerarm01=(1, 0.45, 0.1)))), 3, SF_ANDATA, vista="tre_quarti")
def bast(pos): return posa(att={"bastone": {"pos": pos}})
M("passbastone", giro(bast((0, -0.28, 0.92)), bast((0, -0.32, 1.6)), bast((0, -0.02, 1.98)), bast((0, 0.30, 1.55)), bast((0, 0.28, 1.0)), bast((0, 0.30, 1.55)), bast((0, -0.02, 1.98)), bast((0, -0.32, 1.6))),
  8, sf_onde(2), attrezzi=[{"tipo": "bastone", "lungo": 1.45}], ik_mani="bastone", larghezza_presa=0.58, poli_gomiti=(0.6, 0.4, -0.7), presa="LR")
MURO_DIETRO = {"tipo": "muro", "y": 0.27}
M("wallslide", ciclo(posa(dir=dsim(upperarm01=(1, 0.15, -0.25), lowerarm01=(0.1, 0.15, 1))), posa(dir=dsim(upperarm01=(0.55, 0.15, 0.85), lowerarm01=(0.4, 0.15, 0.9)))), 4, SF_ANDATA, attrezzi=[MURO_DIETRO])
M("angeli", ciclo(posa(**SUP, dir=unisci(GINOCCHIA_SU, dsim(upperarm01=(1, 0.05, -0.2), lowerarm01=(0.1, 0.05, 1)))),
                  posa(**SUP, dir=unisci(GINOCCHIA_SU, dsim(upperarm01=(0.5, 0.05, 0.85), lowerarm01=(0.35, 0.05, 0.95))))), 4, SF_ANDATA, vista="lato", alto_camera=0.9)
def prono(braccia, **kw): return posa(**PRONO, ossa=unisci(PIEDI_DISTESI, {"neck01": [("X", -8)]}, kw.pop("ossa", {})), dir=braccia, **kw)
M("ytw", giro(prono(dsim(upperarm01=(0.55, 0.25, 0.8), lowerarm01=(0.5, 0.25, 0.85))), prono(dsim(upperarm01=(1, 0.25, 0), lowerarm01=(1, 0.25, 0))),
              prono(dsim(upperarm01=(0.9, 0.3, -0.3), lowerarm01=(0.15, 0.3, 1)))), 6, sf_onde(3), vista="lato", alto_camera=0.7)
M("scapolari", [(0, PG_SU), (0.3, posa(pos=(0, 0, 0.72), rot=[("X", 74)], ossa=PG_OSSA)), (0.45, posa(pos=(0, 0, 0.72), rot=[("X", 74)], ossa=PG_OSSA)),
                (0.75, posa(pos=(0, 0, 0.78), rot=[("X", 74)], ossa=unisci(PG_OSSA, {"spine02": [("X", 6)], "spine01": [("X", 4)]}))), (1, PG_SU)], 3, SF_ANDATA,
  ik_mani=True, poli_gomiti=(0.7, 1, 0.2), vista="lato")
M("re9090", ciclo(posa(dir=dsim(upperarm01=(1, 0.1, 0.05), lowerarm01=(0.05, -1, 0.05))), posa(dir=dsim(upperarm01=(1, 0.1, 0.05), lowerarm01=(0.05, 0.1, 1)))), 4, SF_ANDATA, attrezzi=[MURO_DIETRO])
SL_GAMBE = dsim(upperleg01=(0.05, -0.7, -0.7), lowerleg01=(0.0, 0.5, -0.85))
SL_L = {"upperarm01.L": (0.3, -0.8, -0.5), "lowerarm01.L": (-0.6, -0.5, -0.6)}
M("sleeper", tieni(posa(**FIANCO_DX, dir=unisci(SL_GAMBE, SL_L, {"upperarm01.R": (0, -1, 0), "lowerarm01.R": (1, -0.1, 0)})),
                   posa(**FIANCO_DX, dir=unisci(SL_GAMBE, SL_L, {"upperarm01.R": (0, -1, 0), "lowerarm01.R": (0.2, -0.1, -1)}))), 8, vista="fronte", alto_camera=0.9)
M("braccioal", tieni(posa(dirw=BL), posa(dir={"upperarm01.L": (-1, -0.4, 0), "lowerarm01.L": (-1, -0.3, 0), "upperarm01.R": (-0.15, -0.5, -0.85), "lowerarm01.R": (0.75, -0.55, 0.35)})), 8)
SP_GAMBE = {"upperleg01.L": (0.06, -0.28, -1), "lowerleg01.L": (0.06, -0.12, -1), "upperleg01.R": (-0.06, 0.22, -1), "lowerleg01.R": (-0.06, 0.22, -1)}
M("stipite", tieni(posa(dirw=SP_GAMBE, dir=dsim(upperarm01=(1, -0.35, 0), lowerarm01=(0.02, -0.1, 1))),
                   posa(pos=(0, 0.0, 1.0), rot=[("X", 6)], dirw=SP_GAMBE, dir=dsim(upperarm01=(1, 0.3, 0), lowerarm01=(0.02, 0.1, 1)))), 8,
  attrezzi=[{"tipo": "stipite", "y": -0.10, "luce": 0.9}], vista="tre_quarti_dietro", appoggio=False)
M("tricipitesu", tieni(posa(dirw=BL), posa(ossa=busto(y=-8), dir={"upperarm01.L": (0.1, 0.1, 1), "lowerarm01.L": (-0.3, 0.3, -0.9), "upperarm01.R": (0.15, -0.15, 0.95), "lowerarm01.R": (1, 0, 0.1)})), 8)
GIN = dict(pos=(0, 0.1, 0.55))
M("dorsalepanca", tieni(posa(**GIN, rot=[("X", 82)], ossa=PIEDI_DISTESI, dirw=unisci(QUAD_GAMBE, dsim(upperarm01=(0.15, -1, -0.15), lowerarm01=(0.12, -1, -0.15)))),
                        posa(**GIN, rot=[("X", 98)], ossa=unisci(PIEDI_DISTESI, busto(x=-10), {"neck01": [("X", 10)]}), dirw=unisci(QUAD_GAMBE, dsim(upperarm01=(0.15, -1, 0.2), lowerarm01=(0.12, -1, 0.2))))), 8,
  attrezzi=[{"tipo": "panca", "pos": (0, -0.95, 0), "rot": 90, "lungo": 1.0}], appoggio=False)
M("preghiera", tieni(posa(**GIN, rot=[("X", 82)], ossa=PIEDI_DISTESI, dirw=unisci(QUAD_GAMBE, dsim(upperarm01=(0.25, -1, 0.0), lowerarm01=(-0.4, 0.5, 0.75)))),
                     posa(**GIN, rot=[("X", 96)], ossa=unisci(PIEDI_DISTESI, busto(x=-10), {"neck01": [("X", 15)]}), dirw=unisci(QUAD_GAMBE, dsim(upperarm01=(0.25, -1, 0.25), lowerarm01=(-0.4, 0.3, 0.85))))), 8,
  attrezzi=[{"tipo": "panca", "pos": (0, -0.75, 0), "rot": 90, "lungo": 1.0}], appoggio=False)
M("cucciolo", tieni(posa(**GIN, rot=[("X", 92)], ossa=PIEDI_DISTESI, dirw=unisci(QUAD_GAMBE, dsim(upperarm01=(0.15, -1, -0.2), lowerarm01=(0.12, -1, -0.1)))),
                    posa(**GIN, rot=[("X", 118)], ossa=unisci(PIEDI_DISTESI, busto(x=-12)), dirw=unisci(QUAD_GAMBE, dsim(upperarm01=(0.15, -1, 0.05), lowerarm01=(0.12, -1, 0.0))))), 8)
APP = dsim(upperarm01=(0.32, 0, 1), lowerarm01=(0.12, 0, 1))
M("appeso", tieni(posa(pos=(0, 0.06, 1.38), dirw=APP), posa(pos=(0, 0.06, 1.43), dirw=APP, ossa={"neck01": [("X", -6)]}), 0.3), 6, [(0, 0.7), (0.35, 1.0), (0.65, 1.0), (1, 0.7)],
  appoggio="mai", attrezzi=[{"tipo": "sbarra", "alto": 2.45, "y": 0.04}], ik_mani="sbarra", larghezza_presa=0.32, poli_gomiti=(1, 0.2, -0.6), presa="LR")

# ================================================================ TORACICA
import math
GM = dict(pos=(0, 0, 0.5), rot=[("X", 82)])
def quad(ossa=None, **kw): return posa(**GM, ossa=unisci(GM_BASE_OSSA, ossa or {}), **kw)
LB_GAMBE = dsim(upperleg01=(0.05, -1, 0), lowerleg01=(0, 0, -1))
M("libroaperto", ciclo(posa(**FIANCO_DX, dir=unisci(LB_GAMBE, dsim(upperarm01=(0.05, -1, 0.05), lowerarm01=(0.05, -1, 0.05)))),
                       posa(**FIANCO_DX, ossa=busto(z=40), dir=unisci(LB_GAMBE, {"upperarm01.R": (-0.05, -1, 0.05), "lowerarm01.R": (-0.05, -1, 0.05),
                                                                                "upperarm01.L": (0.3, 0.95, 0.05), "lowerarm01.L": (0.3, 0.95, 0.05)}), locali={"neck01": [("Y", 25)]}), 0.5, 0.2),
  6, SF_ANDATA, vista="fronte", alto_camera=1.0)
M("infilaago", giro(quad(), quad(ossa=busto(z=-30), dirw={"upperarm01.R": (0.95, -0.1, -0.3), "lowerarm01.R": (0.95, -0.1, -0.2)}), quad(),
                    quad(ossa=busto(z=35), dirw={"upperarm01.R": (-0.25, 0, 1), "lowerarm01.R": (-0.2, 0, 1)})), 6, sf_onde(2), ik_mani="L", poli_gomiti=(0, 1, 0))
M("rotquad", giro(quad(dirw={"upperarm01.R": (-1, 0, 0.1), "lowerarm01.R": (0.7, -0.5, 0.4)}), quad(ossa=busto(z=-25), dirw={"upperarm01.R": (0.3, -0.1, -1), "lowerarm01.R": (-0.4, -0.6, 0.7)}),
                  quad(dirw={"upperarm01.R": (-1, 0, 0.1), "lowerarm01.R": (0.7, -0.5, 0.4)}), quad(ossa=busto(z=30), dirw={"upperarm01.R": (-0.35, 0, 1), "lowerarm01.R": (0.6, -0.5, -0.2)})),
  6, sf_onde(2), ik_mani="L", poli_gomiti=(0, 1, 0))
DIETRO_TESTA = dsim(upperarm01=(0.9, -0.35, 0.35), lowerarm01=(-0.6, 0.35, 0.7))
M("estrullo", ciclo(posa(pos=(0, 0, 0.2), rot=[("X", -72)], dir=unisci(GINOCCHIA_SU, DIETRO_TESTA)),
                    posa(pos=(0, 0, 0.2), rot=[("X", -72)], ossa=unisci(busto(x=-28), {"neck01": [("X", -10)]}), dir=unisci(GINOCCHIA_SU, DIETRO_TESTA)), 0.5, 0.2),
  5, SF_ANDATA, appoggio=False, attrezzi=[{"tipo": "rullo", "sotto": ("spine02", "head"), "x0": True, "lungo": 0.6}], vista="lato")
M("inclinlat", tieni(posa(dirw=BL), posa(ossa=busto(y=32), dir={"upperarm01.R": (0.55, 0, 0.85), "lowerarm01.R": (0.75, 0, 0.65), "upperarm01.L": (0.2, -0.1, -1), "lowerarm01.L": (0.1, -0.1, -1)})), 8)
SED_GAMBE = dsim(upperleg01=(0.12, -1, 0.02), lowerleg01=(0.04, 0.05, -1))
M("rotbastone", giro(posa(dirw=SED_GAMBE), posa(dirw=SED_GAMBE, ossa=busto(z=45)), posa(dirw=SED_GAMBE), posa(dirw=SED_GAMBE, ossa=busto(z=-45))), 6, sf_onde(2),
  attrezzi=[{"tipo": "gradino", "nome": "sgabello", "sotto": "upperleg01.L", "x0": True, "dy": 0.04, "dim": (0.45, 0.42, 0.4)},
                            {"tipo": "bastone", "lungo": 1.4, "presso": ("neck01", "head", (0, 0.07, -0.02)), "x0": True, "segue": "spine01"}],
  ik_mani="bastone", larghezza_presa=0.55, poli_gomiti=(0.3, 0.3, -1), presa="LR")
def rm(g):
    a = math.radians(g); f = (math.sin(a), -math.cos(a), 0.05)
    return posa(ossa=busto(z=-g * 0.8), dirw={"upperarm01.L": f, "lowerarm01.L": f, "upperarm01.R": f, "lowerarm01.R": f})
M("rotmuro", giro(rm(0), rm(65), rm(0), rm(-65)), 6, sf_onde(2))
FIANCHI = dsim(upperarm01=(0.8, 0.2, -0.55), lowerarm01=(-0.75, -0.35, -0.3))
M("bustocars", giro(*[posa(dir=FIANCHI, ossa=busto(*v)) for v in ((25, 0, 0), (0, 25, 0), (-18, 0, 0), (0, -25, 0))]), 8, sf_onde(4))

# ================================================================ POLSI
AVANBR = dsim(upperarm01=(0.12, 0.05, -1), lowerarm01=(0.05, -1, 0.05))
POLSI = dict(inquadra_da=0.75, zoom=0.95, vista="tre_quarti")
def pol(w=None, loc=None): return posa(dir=AVANBR, ossa={k + s: v for k, v in (w or {}).items() for s in (".L", ".R")}, locali=loc)
M("polsocars", giro(pol({"wrist": [("X", 45)]}), pol({"wrist": [("Z", 30)]}), pol({"wrist": [("X", -45)]}), pol({"wrist": [("Z", -30)]})), 6, sf_onde(4), **POLSI)
def twist(g): return {"lowerarm02.L": [("Y", g)], "lowerarm02.R": [("Y", -g)], "wrist.L": [("Y", g * 0.3)], "wrist.R": [("Y", -g * 0.3)]}
M("avambrot", giro(pol(loc=twist(-70)), pol(loc=twist(70))), 3, sf_onde(2), **POLSI)
def presa(lati="LR", forza=1.0):
    out = {}
    for s in lati:
        for d in (2, 3, 4, 5):
            out[f"finger{d}-1.{s}"] = [("X", 55 * forza)]; out[f"finger{d}-2.{s}"] = [("X", 75 * forza)]; out[f"finger{d}-3.{s}"] = [("X", 45 * forza)]
        out[f"finger1-2.{s}"] = [("X", 12 * forza)]; out[f"finger1-3.{s}"] = [("X", 18 * forza)]
    return out
M("pugno", ciclo(pol(loc=presa("LR", -0.15)), pol(loc=presa("LR", 1.0)), 0.5, 0.2), 2, SF_ANDATA, **POLSI)
M("flessoripolso", ciclo(quad(ossa=sim({}, wrist=[("Y", 90), ("X", -70)])), posa(pos=(0, 0.1, 0.48), rot=[("X", 78)], ossa=unisci(GM_BASE_OSSA, sim({}, wrist=[("Y", 90), ("X", -70)])))), 6, SF_TIENI,
  ik_mani=True, poli_gomiti=(0, 1, 0), vista="lato")
M("estensoripolso", ciclo(quad(ossa=sim({}, wrist=[("Y", 90), ("X", 70)])), posa(pos=(0, 0.1, 0.48), rot=[("X", 78)], ossa=unisci(GM_BASE_OSSA, sim({}, wrist=[("Y", 90), ("X", 70)])))), 6, SF_TIENI,
  ik_mani=True, poli_gomiti=(0, 1, 0), vista="lato")
M("dondoliopalmi", giro(quad(), posa(pos=(0, -0.1, 0.5), rot=[("X", 82)], ossa=GM_BASE_OSSA), quad(), posa(pos=(0, 0.1, 0.5), rot=[("X", 82)], ossa=GM_BASE_OSSA)), 4, sf_onde(2),
  ik_mani=True, poli_gomiti=(0, 1, 0), vista="lato")

# ================================================================ LOMBARE
ABBRACCIO = dsim(upperarm01=(0.3, -0.65, -0.7), lowerarm01=(-0.25, -0.35, -0.9))
M("dueginocchia", ciclo(posa(**SUP, dir=unisci(dsim(upperleg01=(0.15, -0.75, 0.6), lowerleg01=(0.05, 0.85, -0.5)), ABBRACCIO)),
                        posa(**SUP, dir=unisci(dsim(upperleg01=(0.15, -0.55, 0.82), lowerleg01=(0.05, 0.92, -0.38)), ABBRACCIO))), 6, SF_TIENI, vista="lato", alto_camera=0.6)
M("bacino", ciclo(posa(**SUP, dir=GINOCCHIA_SU), posa(pos=(0, 0, 0.2), rot=[("X", -96)], ossa=busto(x=-6), dir=GINOCCHIA_SU)), 3, SF_ANDATA, vista="lato", ik_piedi=True,
  poli_ginocchia=(0.3, -0.3, 1), alto_camera=0.6)
BRACCIA_T = dsim(upperarm01=(1, 0.05, 0.1), lowerarm01=(1, 0.05, 0.1))
def tergi(d):  # d = +1 ginocchia a sinistra, −1 a destra
    L = (0.45 * d, -0.6, -0.65) if d > 0 else (-0.45, -0.65, -0.6)
    out = {"upperleg01.L": (0.25 + 0.6 * d, -0.6 + 0.35 * abs(d), -0.6), "upperleg01.R": (-0.25 + 0.6 * d, -0.6 + 0.35 * abs(d), -0.6),
           "lowerleg01.L": (0.05, 0.55, -0.85), "lowerleg01.R": (-0.05, 0.55, -0.85)}
    return posa(**SUP, dir=unisci(out, BRACCIA_T))
M("tergicristallo", giro(tergi(0), tergi(1), tergi(0), tergi(-1)), 6, sf_onde(2), vista="fronte", alto_camera=0.9)
M("torsionesup", tieni(posa(**SUP, dir=BRACCIA_T), posa(pos=(0, 0, 0.2), rot=[("X", -90), ("Y", -28)], ossa=unisci(busto(z=28), collo(z=30)),
                                                      dir=unisci(BRACCIA_T, {"upperleg01.L": (-0.6, -0.75, 0.2), "lowerleg01.L": (-0.1, 0.3, -0.95)}))), 8, vista="fronte", alto_camera=0.9)
SF_BR = {"upperarm01.L": (0.12, 0.05, -1), "lowerarm01.L": (0.05, -1, 0), "upperarm01.R": (-0.12, 0.05, -1), "lowerarm01.R": (-0.05, -1, 0)}
M("sfinge", ciclo(posa(**PRONO, ossa=unisci(PIEDI_DISTESI, busto(x=-25)), dirw=SF_BR), posa(**PRONO, ossa=unisci(PIEDI_DISTESI, busto(x=-40), {"neck01": [("X", -10)]}), dirw=SF_BR)),
  6, SF_TIENI, vista="lato")
M("estensioniterra", ciclo(posa(**PRONO, ossa=PIEDI_DISTESI, dirw={"upperarm01.L": (0.4, 0.85, 0.35), "lowerarm01.L": (0, -0.5, -0.85), "upperarm01.R": (-0.4, 0.85, 0.35), "lowerarm01.R": (0, -0.5, -0.85)}),
                           posa(**PRONO, ossa=unisci(PIEDI_DISTESI, busto(x=-60), {"neck01": [("X", -10)]}))), 4, SF_ANDATA, vista="lato", ik_mani=True, poli_gomiti=(0.5, 1, 0))
M("banana", tieni(posa(**SUP, dir=dsim(upperarm01=(0.25, 0.05, 1), lowerarm01=(0.2, 0.05, 1))),
                  posa(**SUP, ossa=busto(y=22), dir=unisci({k: (v[0] - 0.4, v[1], v[2]) for k, v in dsim(upperarm01=(0.25, 0.05, 1), lowerarm01=(0.2, 0.05, 1)).items()},
                                                          {"upperleg01.L": (-0.25, 0.02, -1), "lowerleg01.L": (-0.25, 0.02, -1), "upperleg01.R": (-0.4, 0.02, -1), "lowerleg01.R": (-0.4, 0.02, -1)}))), 8,
  alto_camera=2.0, vista="fronte", zoom=0.7)
M("birddog", giro(quad(), quad(dirw={"upperarm01.L": (0.1, -1, 0.1), "lowerarm01.L": (0.1, -1, 0.1), "upperleg01.R": (-0.08, 1, 0.08), "lowerleg01.R": (-0.08, 1, 0.08)}),
                  quad(), quad(dirw={"upperarm01.R": (-0.1, -1, 0.1), "lowerarm01.R": (-0.1, -1, 0.1), "upperleg01.L": (0.08, 1, 0.08), "lowerleg01.L": (0.08, 1, 0.08)})), 6, sf_onde(2), vista="lato")

# ================================================================ ANCHE
def gamb(L1, L2, R1, R2): return {"upperleg01.L": L1, "lowerleg01.L": L2, "upperleg01.R": R1, "lowerleg01.R": R2}
MANI_GINOCCHIO = dsim(upperarm01=(0.12, -0.4, -0.9), lowerarm01=(0.05, -0.6, -0.8))
DIV = gamb((0.08, -1, -0.1), (0.03, 0.05, -1), (-0.05, 0.25, -1), (-0.02, 0.2, 1))
M("divano", tieni(posa(pos=(0, 0, 0.7), dirw=unisci(DIV, MANI_GINOCCHIO)), posa(pos=(0, -0.04, 0.7), rot=[("X", -8)], ossa=busto(x=-5), dirw=unisci(DIV, MANI_GINOCCHIO))), 8,
  attrezzi=[{"tipo": "muro", "largo": 0.9, "presso": ("lowerleg02.R", "tail", (0, 0.10, 0))}], vista="lato")
AFB = gamb((0.08, -1, -0.1), (0.03, 0.05, -1), (-0.05, 0.3, -1), (-0.03, 1, -0.05))
M("affondobraccio", tieni(posa(pos=(0, 0, 0.7), ossa={"foot.R": [("X", 60)]}, dirw=unisci(AFB, MANI_GINOCCHIO)),
                          posa(pos=(0, -0.05, 0.7), rot=[("X", -6)], ossa=unisci({"foot.R": [("X", 60)]}, busto(y=14)), dirw=unisci(AFB, {"upperarm01.L": (0.12, -0.4, -0.9), "lowerarm01.L": (0.05, -0.6, -0.8)}),
                               dir={"upperarm01.R": (0.15, 0, 1), "lowerarm01.R": (0.2, 0, 1)})), 8, vista="lato")
MP_BR = dsim(upperarm01=(0.15, -1, 0), lowerarm01=(0.1, -1, 0))
MP_N = gamb((0.12, -0.05, 1), (0.05, -1, 0.05), (-0.12, -0.05, 1), (-0.05, -1, 0.05))
M("marciapsoas", giro(posa(**SUP, dirw=unisci(MP_N, MP_BR)), posa(**SUP, dirw=unisci(gamb((0.12, 0.25, 0.95), (0.05, -1, 0.1), (-0.12, -0.6, 0.75), (-0.05, -1, 0.05)), MP_BR)),
                      posa(**SUP, dirw=unisci(MP_N, MP_BR)), posa(**SUP, dirw=unisci(gamb((0.12, -0.6, 0.75), (0.05, -1, 0.05), (-0.12, 0.25, 0.95), (-0.05, -1, 0.1)), MP_BR))),
  4, sf_onde(2), vista="lato", alto_camera=0.6)
N90L = gamb((0.25, -1, 0), (-1, 0, 0), (-1, 0.25, 0), (0, 1, 0))
N90R = gamb((1, 0.25, 0), (0, 1, 0), (-0.25, -1, 0), (1, 0, 0))
MANI_TERRA = dsim(upperarm01=(0.2, -0.5, -0.85), lowerarm01=(0.1, -0.5, -0.85))
SED = dict(pos=(0, 0, 0.3))
M("novanta", tieni(posa(**SED, dirw=unisci(N90L, MANI_TERRA)), posa(**SED, rot=[("X", 30)], dirw=unisci(N90L, dsim(upperarm01=(0.2, -0.8, -0.55), lowerarm01=(0.1, -0.8, -0.5))))), 8)
MANI_DIETRO = dsim(upperarm01=(0.3, 0.6, -0.75), lowerarm01=(0.2, 0.6, -0.8))
NMID = gamb((0.35, -0.75, 0.55), (0.05, 0.1, -1), (-0.35, -0.75, 0.55), (-0.05, 0.1, -1))
M("novantapass", giro(posa(**SED, rot=[("X", -12)], dirw=unisci(N90L, MANI_DIETRO)), posa(**SED, rot=[("X", -15)], dirw=unisci(NMID, MANI_DIETRO)),
                      posa(**SED, rot=[("X", -12)], dirw=unisci(N90R, MANI_DIETRO)), posa(**SED, rot=[("X", -15)], dirw=unisci(NMID, MANI_DIETRO))), 6, sf_onde(2))
M("shinbox", giro(posa(**SED, dirw=unisci(N90L, MANI_TERRA)), posa(pos=(0, 0, 0.6), rot=[("X", -5)], dirw=unisci(gamb((0.15, -0.25, -1), (-1, 0, 0), (-0.3, 0.2, -1), (0, 1, 0)), dsim(upperarm01=(0.15, -1, 0.1), lowerarm01=(0.1, -1, 0.1)))),
                  posa(**SED, dirw=unisci(N90R, MANI_TERRA)), posa(pos=(0, 0, 0.6), rot=[("X", -5)], dirw=unisci(gamb((0.3, 0.2, -1), (0, 1, 0), (-0.15, -0.25, -1), (1, 0, 0)), dsim(upperarm01=(0.15, -1, 0.1), lowerarm01=(0.1, -1, 0.1))))),
  6, sf_onde(2))
def gR(a, b): return {"upperleg01.R": a, "lowerleg01.R": b}
M("ancacars", giro(quad(), quad(dirw=gR((-0.1, -0.8, -0.3), (-0.05, 0.3, -0.95))), quad(dirw=gR((-1, -0.1, -0.1), (-0.05, 1, 0))), quad(dirw=gR((-0.1, 0.9, 0.2), (-0.05, 0.3, 1)))),
  8, sf_onde(4), ik_mani=True, poli_gomiti=(0, 1, 0))
M("idrante", ciclo(quad(), quad(dirw=gR((-1, 0, -0.12), (-0.05, 1, 0)))), 3, SF_ANDATA, ik_mani=True, poli_gomiti=(0, 1, 0))
AE_L = {"upperleg01.L": (0.09, 0, -1), "lowerleg01.L": (0.11, 0.02, -1)}
M("aeroplano", tieni(posa(pos=(0, 0.12, 0.98), rot=[("X", 78)], ossa={"neck01": [("X", -20)]}, dirw=unisci(AE_L, gR((-0.05, 1, 0.1), (-0.05, 1, 0.1)), dsim(upperarm01=(1, 0, 0), lowerarm01=(1, 0, 0)))),
                     posa(pos=(0, 0.12, 0.98), rot=[("X", 78), ("Y", -40)], ossa={"neck01": [("X", -20)]}, dirw=unisci(AE_L, gR((-0.55, 0.8, 0.45), (-0.55, 0.8, 0.45)), {"upperarm01.L": (0.75, 0, -0.65), "lowerarm01.L": (0.75, 0, -0.65), "upperarm01.R": (-0.75, 0, 0.65), "lowerarm01.R": (-0.75, 0, 0.65)}))),
  6, ik_piedi="L", poli_ginocchia=(0, -1, 0), appoggio=False)
OSC = {"upperarm01.R": (-0.9, 0, -0.35), "lowerarm01.R": (-0.9, 0, 0.35)}
def osc(L): return posa(dirw=unisci(OSC, {"upperleg01.L": L, "lowerleg01.L": L, "upperarm01.L": (0.15, 0, -1), "lowerarm01.L": (0.1, 0, -1)}))
M("swingav", giro(osc((0.06, -0.85, -0.5)), osc((0.08, 0, -1)), osc((0.06, 0.5, -0.85)), osc((0.08, 0, -1))), 2.4, sf_onde(2), ik_piedi="R", appoggio=False,
  attrezzi=[{"tipo": "muro", "x": -0.62}], vista="lato")
def osl(L): return posa(dirw={"upperleg01.L": L, "lowerleg01.L": L, **dsim(upperarm01=(0.25, -1, 0.15), lowerarm01=(0.15, -1, 0.15))})
M("swinglat", giro(osl((-0.45, -0.1, -0.9)), osl((0.09, 0, -1)), osl((0.65, 0, -0.75)), osl((0.09, 0, -1))), 2.4, sf_onde(2), ik_piedi="R", appoggio=False,
  attrezzi=[{"tipo": "muro", "y": -0.62}], vista="dietro")
LARGHE = dsim(upperleg01=(0.22, 0, -1), lowerleg01=(0.2, 0, -1))
PREGA = dsim(upperarm01=(0.3, -0.75, -0.55), lowerarm01=(-0.55, -0.5, 0.65))
SP_SU = posa(dirw=LARGHE, dir=PREGA)
M("squatprof", [(0, SP_SU), (0.2, posa(pos=(0, 0.14, 0.45), rot=[("X", 25)], dir=PREGA)), (0.5, posa(pos=(0, 0.14, 0.46), rot=[("X", 20)], ossa=busto(x=-5), dir=PREGA)),
                (0.8, posa(pos=(0, 0.14, 0.45), rot=[("X", 25)], dir=PREGA)), (1, SP_SU)], 6, [(0, 0.3), (0.2, 1.0), (0.8, 1.0), (1, 0.3)],
  ik_piedi=True, poli_ginocchia=(0.5, -1, 0), appoggio=False)
BR_AV = dsim(upperarm01=(0.15, -1, -0.1), lowerarm01=(0.1, -1, 0))
CS = posa(dirw=dsim(upperleg01=(0.5, 0, -1), lowerleg01=(0.45, 0, -1)), dir=BR_AV)
M("cossack", giro(CS, posa(pos=(0.33, 0.1, 0.55), rot=[("X", 25)], dir=BR_AV), CS, posa(pos=(-0.33, 0.1, 0.55), rot=[("X", 25)], dir=BR_AV)), 6, sf_onde(2),
  ik_piedi=True, poli_ginocchia=(0.4, -1, 0), appoggio=False)
FARF = dsim(upperleg01=(0.85, -0.5, 0.05), lowerleg01=(-0.75, -0.55, 0))
M("farfalla", tieni(posa(**SED, dirw=unisci(FARF, dsim(upperarm01=(0.15, -0.6, -0.8), lowerarm01=(0.05, -0.5, -0.85)))),
                    posa(**SED, rot=[("X", 30)], dirw=unisci(FARF, dsim(upperarm01=(0.25, -0.7, -0.65), lowerarm01=(0.05, -0.6, -0.8))))), 8)
RANA = unisci(dsim(upperleg01=(0.8, -0.05, -0.6), lowerleg01=(0.05, 1, 0)), dsim(upperarm01=(0.15, -0.05, -1), lowerarm01=(0.05, -1, 0)))
M("rana", tieni(posa(pos=(0, 0, 0.4), rot=[("X", 88)], dirw=RANA), posa(pos=(0, 0.12, 0.4), rot=[("X", 92)], dirw=RANA)), 8, vista="dietro", alto_camera=1.0)
def gv(a): return posa(**SUP, dirw=unisci(dsim(upperleg01=(a, -0.05, 0.85), lowerleg01=(a, -0.05, 0.85)), dsim(upperarm01=(1, 0.05, 0.05), lowerarm01=(1, 0.05, 0.05))))
M("gambev", tieni(gv(0.12), gv(0.6)), 8, attrezzi=[{"tipo": "muro", "largo": 0.9, "presso": ("upperleg01.L", "head", (0, -0.14, 0))}], vista="tre_quarti_dietro", alto_camera=0.7)

# ================================================================ GLUTEI
PIC = gamb((0.35, -1, -0.05), (-1, 0.2, 0), (-0.08, 1, -0.25), (-0.03, 1, 0))
M("piccione", tieni(posa(pos=(0, 0, 0.35), ossa={"foot.R": [("X", 60)]}, dirw=unisci(PIC, dsim(upperarm01=(0.3, -0.1, -1), lowerarm01=(0.2, -0.1, -1)))),
                    posa(pos=(0, 0, 0.35), rot=[("X", 60)], ossa={"foot.R": [("X", 60)]}, dirw=unisci(PIC, dsim(upperarm01=(0.15, -1, -0.3), lowerarm01=(0.1, -1, -0.1))))), 8)
F4 = {"upperleg01.R": (-0.75, -0.55, 0.35), "lowerleg01.R": (1, -0.1, 0.0)}
M("fig4sup", tieni(posa(**SUP, dir=unisci(GINOCCHIA_SU, F4)), posa(**SUP, dir=unisci({"upperleg01.L": (0.15, -0.7, 0.7), "lowerleg01.L": (0.05, 0.85, -0.5)}, F4,
                                                                                      dsim(upperarm01=(0.2, -0.75, -0.6), lowerarm01=(-0.1, -0.2, -0.95))))), 8, vista="lato", alto_camera=0.5)
SGAB = {"tipo": "gradino", "nome": "sgabello", "sotto": "upperleg01.L", "x0": True, "dy": 0.04, "dim": (0.45, 0.42, 0.4)}
F4S = unisci({"upperleg01.L": (0.12, -1, 0.02), "lowerleg01.L": (0.04, 0.05, -1), "upperleg01.R": (-0.6, -0.75, 0.2), "lowerleg01.R": (1, 0, 0.05)})
M("fig4sed", tieni(posa(dirw=unisci(F4S, dsim(upperarm01=(0.1, -0.4, -0.9), lowerarm01=(0.05, -0.6, -0.8)))), posa(rot=[("X", 35)], dirw=unisci(F4S, dsim(upperarm01=(0.1, -0.6, -0.8), lowerarm01=(0.05, -0.6, -0.8))))), 8,
  attrezzi=[SGAB])
F4P = {"upperleg01.R": (-0.7, -0.7, -0.1), "lowerleg01.R": (1, 0.05, 0.1)}
M("fig4piedi", tieni(posa(dirw=F4P, dir=BR_AV), posa(pos=(0, 0.16, 0.78), rot=[("X", 32)], dirw=F4P, dir=BR_AV)), 6, ik_piedi="L", poli_ginocchia=(0, -1, 0), appoggio=False)
M("ginspalla", tieni(posa(**SUP, dir=dsim(upperarm01=(0.15, 0.05, -1), lowerarm01=(0.1, 0.05, -1))),
                     posa(**SUP, dir=unisci({"upperleg01.R": (0.45, -0.6, 0.65), "lowerleg01.R": (0.6, 0.4, -0.6)}, dsim(upperarm01=(0.15, -0.75, -0.65), lowerarm01=(-0.2, -0.3, -0.9))))), 8, vista="lato", alto_camera=0.5)
M("mediogluteo", tieni(posa(dirw=BL), posa(pos=(-0.06, 0.06, 1.03), ossa=busto(y=25), dirw={"upperleg01.R": (0.2, 0.12, -1), "lowerleg01.R": (0.2, 0.12, -1), "upperleg01.L": (0.06, 0, -1), "lowerleg01.L": (0.06, 0, -1),
                                                                                         "upperarm01.L": (0.2, -0.1, -1), "lowerarm01.L": (0.1, -0.1, -1)}, dir={"upperarm01.R": (0.55, 0, 0.85), "lowerarm01.R": (0.75, 0, 0.65)})), 8)
TI = {"upperleg01.L": (0.1, -1, 0), "lowerleg01.L": (0.1, -1, 0), "upperleg01.R": (0.25, -0.65, 0.7), "lowerleg01.R": (0.05, 0.25, -1)}
M("torsioneinc", tieni(posa(**SED, dirw=unisci(TI, MANI_DIETRO)), posa(**SED, ossa=busto(z=-40), dirw=unisci(TI, {"upperarm01.R": (-0.3, 0.6, -0.75), "lowerarm01.R": (-0.2, 0.6, -0.8),
                                                                                                               "upperarm01.L": (-0.6, -0.6, -0.3), "lowerarm01.L": (-0.2, -0.9, 0.2)}))), 8)

# ================================================================ GAMBE
CI_BR = dsim(upperarm01=(0.12, -0.45, 0.9), lowerarm01=(0.08, -0.25, 0.95))
def cin(L): return posa(**SUP, dirw=unisci({"upperleg01.L": L, "lowerleg01.L": L}, CI_BR), ossa={"foot.L": [("X", -15)]})
M("cinghia", [(0, cin((0.08, 0.15, 1))), (0.3, cin((0.08, 0.05, 1))), (0.5, cin((0.08, 0.05, 1))), (0.75, cin((0.08, 0.32, 0.95))), (1, cin((0.08, 0.15, 1)))], 8,
  [(0, 0.5), (0.3, 1.0), (0.5, 1.0), (0.6, 0.4), (0.8, 1.0), (1, 0.5)], presa="LR",
  linee=[{"da": ("foot.L", "tail"), "a": ("wrist.L", "head"), "raggio": 0.009, "elastico": True}, {"da": ("foot.L", "tail"), "a": ("wrist.R", "head"), "raggio": 0.009, "elastico": True}], vista="lato")
M("spazzata", giro(posa(dirw=BL), posa(pos=(0, 0.18, 0.95), rot=[("X", 45)], ossa={"foot.L": [("X", -25)], "lowerleg01.R": [("X", 15)]},
                                       dirw={"upperleg01.L": (0.06, -0.4, -0.95), "lowerleg01.L": (0.06, -0.4, -0.95), "upperarm01.L": (0.15, -0.3, -1), "lowerarm01.L": (0.1, -0.4, -1), "upperarm01.R": (-0.15, -0.3, -1), "lowerarm01.R": (-0.1, -0.4, -1)}),
                   posa(dir=dsim(upperarm01=(0.3, -0.3, 0.9), lowerarm01=(0.25, -0.3, 0.9)))), 4, sf_onde(1))
def sold(s):
    o = "R" if s == "L" else "L"; k = 1 if s == "L" else -1
    return posa(dirw={"upperleg01." + s: (0.05 * k, -1, 0.15), "lowerleg01." + s: (0.05 * k, -1, 0.15), "upperarm01." + o: (0.05 * k, -1, 0.1), "lowerarm01." + o: (0.05 * k, -1, 0.15),
                      "upperarm01." + s: (0.15 * k, 0.3, -1), "lowerarm01." + s: (0.1 * k, 0.3, -1)})
M("soldatino", giro(posa(dirw=BL), sold("L"), posa(dirw=BL), sold("R")), 3, sf_onde(2))
M("quadfianco", tieni(posa(**FIANCO_DX, dir={"upperleg01.R": (0, -0.3, -0.95), "lowerleg01.R": (0, 0.3, -0.95), "upperarm01.R": (0, 0, 1), "lowerarm01.R": (0.5, -0.3, 0.8)}),
                      posa(**FIANCO_DX, dir={"upperleg01.R": (0, -0.3, -0.95), "lowerleg01.R": (0, 0.3, -0.95), "upperarm01.R": (0, 0, 1), "lowerarm01.R": (0.5, -0.3, 0.8),
                                             "upperleg01.L": (0.05, 0.15, -1), "lowerleg01.L": (0.05, 0.35, 0.9), "upperarm01.L": (0.15, 0.6, -0.8), "lowerarm01.L": (0.1, 0.7, -0.7)})), 8, vista="fronte", alto_camera=0.9)
TAL = dsim(upperleg01=(0.12, -1, -0.05), lowerleg01=(0.05, 1, -0.05))
M("talloni", tieni(posa(pos=(0, 0, 0.5), ossa=PIEDI_DISTESI, dirw=unisci(TAL, dsim(upperarm01=(0.15, -0.3, -1), lowerarm01=(0.1, -0.3, -1)))),
                   posa(pos=(0, 0, 0.5), rot=[("X", -25)], ossa=PIEDI_DISTESI, dirw=unisci(TAL, dsim(upperarm01=(0.2, 0.45, -0.85), lowerarm01=(0.15, 0.45, -0.85))))), 8)
PK = dsim(upperleg01=(0.08, -1, 0), lowerleg01=(0.08, -1, 0))
M("pike", tieni(posa(**SED, dirw=unisci(PK, dsim(upperarm01=(0.15, -0.75, -0.65), lowerarm01=(0.1, -0.75, -0.65)))), posa(**SED, rot=[("X", 55)], ossa=busto(x=10), dirw=unisci(PK, dsim(upperarm01=(0.12, -1, -0.2), lowerarm01=(0.1, -1, -0.15))))), 8)
FG = {"upperleg01.L": (0.06, -0.7, -0.7), "lowerleg01.L": (0.06, -0.7, -0.7)}
M("femgradino", tieni(posa(dirw=unisci(FG, BL), ossa={"foot.L": [("X", -10)]}), posa(pos=(0, 0.14, 0.98), rot=[("X", 40)], ossa={"foot.L": [("X", -10)]}, dirw=unisci(FG, dsim(upperarm01=(0.15, -0.6, -0.8), lowerarm01=(0.1, -0.6, -0.8))))), 6,
  ik_piedi=True, piedi_a_terra="R", piedi_piatti="R", poli_ginocchia=(0, -1, 0), appoggio=False, attrezzi=[{"tipo": "gradino", "sotto": "foot.L", "dy": 0.02, "dim": (0.4, 0.35, 0.4)}])
M("itband", tieni(posa(dirw=BL), posa(pos=(-0.06, 0.06, 1.03), ossa=busto(y=28), dirw={"upperleg01.R": (0.2, -0.1, -1), "lowerleg01.R": (0.2, -0.1, -1), "upperleg01.L": (0.06, 0.05, -1), "lowerleg01.L": (0.06, 0.05, -1)},
                                       dir=dsim(upperarm01=(0.6, 0, 0.8), lowerarm01=(0.6, 0, 0.8)))), 8)
KN = dict(rot=[("X", 30)], dir=dsim(upperarm01=(0.1, -0.55, -0.85), lowerarm01=(0.05, -0.3, -0.95)))
KS = posa(dirw=dsim(upperleg01=(0.03, 0, -1), lowerleg01=(0.03, 0, -1)), dir=dsim(upperarm01=(0.1, -0.55, -0.85), lowerarm01=(0.05, -0.3, -0.95)))
M("ginocchiocerchi", [(0, KS)] + [(0.12 + 0.2 * i, posa(pos=p, **KN)) for i, p in enumerate(((0.07, 0.12, 0.86), (0, 0.18, 0.82), (-0.07, 0.12, 0.86), (0, 0.06, 0.9)))] + [(1, KS)], 6, sf_onde(4),
  ik_piedi=True, poli_ginocchia=(0, -1, 0), appoggio=False)

# ================================================================ CAVIGLIE
GM_ST = {"upperleg01.L": (0.06, -0.15, -1), "lowerleg01.L": (0.06, 0, -1), "upperleg01.R": (-0.06, 0.35, -1), "lowerleg01.R": (-0.06, 0.35, -1)}
MANI_MURO = dsim(upperarm01=(0.2, -0.75, -0.3), lowerarm01=(0.1, -0.3, 0.95))
MANI_MURO_LUNGHE = dsim(upperarm01=(0.15, -1, 0.25), lowerarm01=(0.1, -1, 0.3))
M("ginmuro", ciclo(posa(dirw=unisci(GM_ST, MANI_MURO), ossa={"foot.R": [("X", 20)]}), posa(pos=(0, -0.04, 0.95), dirw=MANI_MURO, ossa={"foot.R": [("X", 20)]})), 3, SF_ANDATA,
  ik_piedi=True, piedi_piatti="L", poli_ginocchia=(0, -1, 0), appoggio=False, attrezzi=[{"tipo": "muro", "largo": 0.9, "presso": ("wrist.L", "head", (0, -0.13, 0))}], vista="lato", zoom=1.0)
DON = unisci(AFB, MANI_GINOCCHIO)
M("dondolio", ciclo(posa(pos=(0, 0, 0.7), ossa={"foot.R": [("X", 60)]}, dirw=DON),
                    posa(pos=(0, -0.1, 0.7), ossa={"foot.R": [("X", 60)]}, dirw=unisci(DON, {"upperleg01.L": (0.08, -1, 0.05), "lowerleg01.L": (0.03, -0.42, -0.9), "upperleg01.R": (-0.05, 0.1, -1)}))), 3, SF_ANDATA, vista="lato")
GRAD2 = {"tipo": "gradino", "sotto": "foot.L", "x0": True, "dy": -0.05, "dim": (0.6, 0.22, 0.4)}
def tall(ang, z=0, gin=False):
    d = dict(dirw=dsim(upperleg01=(0.1, -0.3, -0.95), lowerleg01=(0.1, 0.3, -0.95))) if gin else {}
    return posa(pos=(0, 0.06, (0.98 if gin else 1.037) + z), ossa={"foot.L": [("X", ang)], "foot.R": [("X", ang)]}, volo=0.2, dir=dsim(upperarm01=(0.15, -0.3, -1), lowerarm01=(0.1, -0.5, -0.9)), **d)
M("polpgradino", ciclo(tall(0), tall(-22, -0.045)), 4, SF_TIENI, appoggio=False, attrezzi=[GRAD2], vista="lato")
M("solgradino", ciclo(tall(0, 0, True), tall(-22, -0.045, True)), 4, SF_TIENI, appoggio=False, attrezzi=[GRAD2], vista="lato")
M("tibiale", tieni(posa(pos=(0, 0, 0.5), rot=[("X", -15)], ossa=PIEDI_DISTESI, dirw=unisci(TAL, dsim(upperarm01=(0.2, 0.45, -0.85), lowerarm01=(0.15, 0.45, -0.85)))),
                   posa(pos=(0, 0, 0.5), rot=[("X", -30)], ossa=PIEDI_DISTESI, dirw=unisci(dsim(upperleg01=(0.12, -1, 0.25), lowerleg01=(0.05, 1, -0.05)), dsim(upperarm01=(0.2, 0.45, -0.85), lowerarm01=(0.15, 0.45, -0.85))))), 6)
AL = {"upperleg01.L": (0.08, -1, 0.15), "lowerleg01.L": (0.08, -1, 0.15), "upperleg01.R": (-0.12, -1, 0.02), "lowerleg01.R": (-0.04, 0.05, -1)}
def alf(o): return posa(dirw=unisci(AL, dsim(upperarm01=(0.25, 0.2, -1), lowerarm01=(0.15, 0.1, -1))), ossa={"foot.L": o})
M("alfabeto", giro(alf([("X", 30)]), alf([("Z", 25)]), alf([("X", -20)]), alf([("Z", -25)])), 6, sf_onde(4), attrezzi=[SGAB], vista="tre_quarti")
M("alluce", tieni(posa(dirw=unisci(GM_ST, MANI_MURO), ossa={"foot.R": [("X", 20)]}),
                  posa(pos=(0, -0.03, 0.97), dirw=MANI_MURO, ossa={"foot.R": [("X", 20)]}, locali={"toe1-1.L": [("X", -45)], "toe1-2.L": [("X", -15)]})), 6,
  ik_piedi=True, piedi_piatti="L", poli_ginocchia=(0, -1, 0), appoggio=False, attrezzi=[{"tipo": "muro", "largo": 0.9, "presso": ("wrist.L", "head", (0, -0.13, 0))}], vista="lato", zoom=1.0)
def dita(g): return {f"toe{d}-{k}.{s}": [("X", g)] for d in (1, 2, 3, 4, 5) for k in (1, 2) for s in "LR"}
M("piedecorto", ciclo(posa(dirw=BL), posa(dirw=BL, locali=dita(18))), 4, SF_TIENI, inquadra_fino=0.6, vista="tre_quarti", zoom=0.9)
TP = dict(dirw=BL)
M("taccopunta", giro(posa(ossa={"foot.L": [("X", -25)], "foot.R": [("X", -25)]}, **TP), posa(**TP), posa(ossa={"foot.L": [("X", 35)], "foot.R": [("X", 35)]}, **TP), posa(**TP)), 3, sf_onde(2))
INV = dsim(upperleg01=(0.1, -1, 0), lowerleg01=(0.1, -1, 0))
def inv(o): return posa(**SED, ossa={"foot.L": o}, dirw=unisci(INV, MANI_DIETRO))
M("inversione", giro(inv([("Y", 25)]), inv([]), inv([("Y", -25)]), inv([])), 4, sf_onde(2), attrezzi=[{"tipo": "colonna", "punto": (0.8, -0.9, 0.14)}],
  linee=[{"da": (0.8, -0.9, 0.14), "a": ("foot.L", "tail"), "elastico": True, "raggio": 0.008}])

# ================================================================ FLUSSI
GAMBE_DRITTE = dsim(upperleg01=(0.09, 0, -1), lowerleg01=(0.11, 0.02, -1))
SS_UP = posa(dir=dsim(upperarm01=(0.25, -0.05, 1), lowerarm01=(0.25, -0.05, 1)), ossa=busto(x=-10))
SS_FOLD = posa(pos=(0, 0.2, 0.95), rot=[("X", 115)], dirw=unisci(GAMBE_DRITTE, dsim(upperarm01=(0.12, -0.2, -1), lowerarm01=(0.1, -0.1, -1))))
SS_COBRA = posa(pos=(0, 0.25, 0.2), rot=[("X", 90)], ossa=unisci(PIEDI_DISTESI, busto(x=-55), {"neck01": [("X", -10)]}), dirw=dsim(upperarm01=(0.12, 0.05, -1), lowerarm01=(0.1, 0.05, -1)))
SS_DOG = posa(pos=(0, 0.25, 0.95), rot=[("X", 135)], dirw=dsim(upperleg01=(0.09, 0.45, -0.9), lowerleg01=(0.1, 0.45, -0.9)), dir=dsim(upperarm01=(0.15, 0, 1), lowerarm01=(0.12, 0, 1)), ossa={"neck01": [("X", 15)]})
M("salutosole", giro(posa(dirw=BL), SS_UP, SS_FOLD, PG_SU, SS_COBRA, SS_DOG, SS_FOLD, SS_UP), 12, sf_onde(4), vista="lato")
M("canecobra", ciclo(SS_DOG, SS_COBRA, 0.5, 0.2), 5, SF_ANDATA, vista="lato")
def dogp(s):
    k = 1 if s == "L" else -1
    return posa(pos=(0, 0.25, 0.95), rot=[("X", 135)], dir=dsim(upperarm01=(0.15, 0, 1), lowerarm01=(0.12, 0, 1)), ossa={"neck01": [("X", 15)], "foot." + s: [("X", 35)]},
                dirw=unisci(dsim(upperleg01=(0.09, 0.45, -0.9), lowerleg01=(0.1, 0.45, -0.9)), {"upperleg01." + s: (0.09 * k, 0.25, -0.97), "lowerleg01." + s: (0.1 * k, 0.75, -0.65)}))
M("canepedala", giro(dogp("L"), dogp("R")), 2.4, sf_onde(2), vista="lato")
SC_BR = dsim(upperarm01=(1, 0, 0.05), lowerarm01=(1, 0, 0.05))
M("scorpione", giro(posa(**PRONO, ossa=PIEDI_DISTESI, dirw=SC_BR),
                    posa(pos=(0, 0, 0.2), rot=[("X", 90), ("Y", 30)], ossa=PIEDI_DISTESI, dirw=unisci(SC_BR, {"upperleg01.R": (0.55, 0.5, 0.65), "lowerleg01.R": (0.85, 0.2, -0.5)})),
                    posa(**PRONO, ossa=PIEDI_DISTESI, dirw=SC_BR),
                    posa(pos=(0, 0, 0.2), rot=[("X", 90), ("Y", -30)], ossa=PIEDI_DISTESI, dirw=unisci(SC_BR, {"upperleg01.L": (-0.55, 0.5, 0.65), "lowerleg01.L": (-0.85, 0.2, -0.5)}))),
  6, sf_onde(2), alto_camera=1.0)
SQA_FOLD = posa(pos=(0, 0.22, 0.95), rot=[("X", 110)], dirw=dsim(upperarm01=(0.12, -0.3, -1), lowerarm01=(0.1, -0.2, -1)))
M("squatalzati", [(0, posa(dirw=BL)), (0.15, SQA_FOLD), (0.35, posa(pos=(0, 0.14, 0.42), rot=[("X", 30)], dirw=dsim(upperarm01=(0.15, -0.4, -0.9), lowerarm01=(0.1, -0.3, -0.95)))),
                  (0.55, posa(pos=(0, 0.12, 0.42), rot=[("X", 15)], dir=dsim(upperarm01=(0.25, -0.05, 1), lowerarm01=(0.25, -0.05, 1)))), (0.75, posa(pos=(0, 0.14, 0.42), rot=[("X", 30)], dirw=dsim(upperarm01=(0.15, -0.4, -0.9), lowerarm01=(0.1, -0.3, -0.95)))),
                  (0.88, SQA_FOLD), (1, posa(dirw=BL))], 8, [(0, 0.3), (0.35, 1.0), (0.55, 1.0), (0.75, 0.8), (1, 0.3)], ik_piedi=True, poli_ginocchia=(0.4, -1, 0), appoggio=False)
ALR = posa(dirw=dsim(upperleg01=(0.5, 0, -1), lowerleg01=(0.45, 0, -1)), dir=BR_AV)
M("afflatrot", giro(ALR, posa(pos=(0.33, 0.1, 0.6), rot=[("X", 25)], ossa=busto(z=40), dirw={"upperarm01.L": (0.3, 0, 1), "lowerarm01.L": (0.3, 0, 1), "upperarm01.R": (0.2, -0.3, -1), "lowerarm01.R": (0.2, -0.3, -1)}),
                    ALR, posa(pos=(-0.33, 0.1, 0.6), rot=[("X", 25)], ossa=busto(z=-40), dirw={"upperarm01.R": (-0.3, 0, 1), "lowerarm01.R": (-0.3, 0, 1), "upperarm01.L": (-0.2, -0.3, -1), "lowerarm01.L": (-0.2, -0.3, -1)})),
  6, sf_onde(2), ik_piedi=True, poli_ginocchia=(0.4, -1, 0), appoggio=False)
ORSO_G = dsim(upperleg01=(0.1, -0.1, -1), lowerleg01=(0.05, 1, -0.3))
def orso(**dw): return posa(pos=(0, 0, 0.55), rot=[("X", 82)], ossa=unisci(GM_BASE_OSSA, sim({}, foot=[("X", 20)])), dirw=unisci(ORSO_G, dw))
M("orso", giro(orso(), orso(**{"upperarm01.L": (0.15, -0.6, -0.75), "lowerarm01.L": (0.1, -0.5, -0.8), "upperleg01.R": (-0.1, -0.1, -1), "lowerleg01.R": (-0.05, 1, -0.05)}),
               orso(), orso(**{"upperarm01.R": (-0.15, -0.6, -0.75), "lowerarm01.R": (-0.1, -0.5, -0.8), "upperleg01.L": (0.1, -0.1, -1), "lowerleg01.L": (0.05, 1, -0.05)})), 2.4, sf_onde(2), vista="lato")
FOLD_IW = SS_FOLD
IW_MID = posa(pos=(0, 0.3, 0.9), rot=[("X", 100)], dirw=unisci(GAMBE_DRITTE, dsim(upperarm01=(0.12, -0.75, -0.65), lowerarm01=(0.1, -0.7, -0.7))))
M("inchworm", giro(posa(dirw=BL), FOLD_IW, IW_MID, PG_SU, IW_MID, FOLD_IW), 8, sf_onde(3), vista="lato")
def groin(s):
    k = 1 if s == "L" else -1
    return posa(pos=(0, 0, 0.62), rot=[("X", 74)], ossa=PG_OSSA, dirw={"upperleg01." + s: (0.4 * k, -0.75, -0.35), "lowerleg01." + s: (0.1 * k, 0.1, -1)})
M("groiners", giro(PG_SU, groin("L"), PG_SU, groin("R")), 4, sf_onde(2), ik_mani=True, poli_gomiti=(0.7, 1, 0.2))
WGS_G = gamb((0.12, -0.85, -0.5), (0.05, 0.05, -1), (-0.06, 0.75, -0.65), (-0.03, 0.6, -0.8))
M("wgs", giro(posa(pos=(0, 0, 0.55), rot=[("X", 55)], dirw=unisci(WGS_G, {"upperarm01.R": (-0.05, -0.2, -1), "lowerarm01.R": (-0.05, -0.2, -1), "upperarm01.L": (-0.1, -0.1, -1), "lowerarm01.L": (-0.15, 0.1, -1)})),
              posa(pos=(0, 0, 0.55), rot=[("X", 55)], ossa=busto(z=45), dirw=unisci(WGS_G, {"upperarm01.R": (-0.05, -0.2, -1), "lowerarm01.R": (-0.05, -0.2, -1), "upperarm01.L": (0.35, 0, 1), "lowerarm01.L": (0.35, 0, 1)}))),
  5, sf_onde(1), vista="tre_quarti")

# ---------------------------------------------------------------- vecchi esercizi dell'app
CA = {"upperarm01.L": (0.8, 0.2, -0.55), "lowerarm01.L": (-0.75, -0.35, -0.3), "upperarm01.R": (-0.8, 0.2, -0.55), "lowerarm01.R": (0.75, -0.35, -0.3)}
def ca(t): return posa(dir=CA, dirw={"upperleg01.L": t, "lowerleg01.L": (0.05, 0, -1)})
M("cerchianca", giro(ca((0.1, -0.9, -0.3)), ca((0.85, -0.3, -0.3)), ca((0.2, 0.2, -1)), ca((0.1, -0.4, -0.9))), 5, sf_onde(2), ik_piedi="R", appoggio=False)
M("femorali", tieni(posa(dirw=BL), posa(pos=(0, 0.18, 0.95), rot=[("X", 45)], ossa={"foot.L": [("X", -25)], "lowerleg01.R": [("X", 15)]},
                                           dirw={"upperleg01.L": (0.06, -0.4, -0.95), "lowerleg01.L": (0.06, -0.4, -0.95), **dsim(upperarm01=(0.15, -0.4, -1), lowerarm01=(0.1, -0.4, -1))})), 8, vista="lato")
QU = {"upperleg01.L": (0.06, 0.25, -1), "lowerleg01.L": (0.03, 1, 0.3)}
M("quad", tieni(posa(dirw=unisci(QU, BL)), posa(rot=[("X", -6)], dirw=unisci(QU, BL))), 8, ik_piedi="R", appoggio=False, attrezzi=[{"tipo": "gradino", "sotto": "foot.L", "dy": 0.0, "dim": (0.45, 0.4, 0.4)}], vista="lato")
M("caviglie", giro(alf([("X", 30)]), alf([("X", 10), ("Z", 25)]), alf([("X", -20)]), alf([("X", 10), ("Z", -25)])), 6, sf_onde(4), attrezzi=[SGAB], vista="tre_quarti")
PM = {"upperleg01.L": (0.06, -0.2, -1), "lowerleg01.L": (0.06, -0.05, -1), "upperleg01.R": (-0.06, 0.45, -1), "lowerleg01.R": (-0.06, 0.45, -1)}
M("polpaccimuro", tieni(posa(pos=(0, 0.1, 1.0), rot=[("X", 12)], dirw=unisci(PM, MANI_MURO_LUNGHE)), posa(pos=(0, 0.05, 0.98), rot=[("X", 14)], dirw=MANI_MURO_LUNGHE)), 8, ik_piedi=True, poli_ginocchia=(0, -1, 0), appoggio=False,
  attrezzi=[{"tipo": "muro", "largo": 0.9, "presso": ("foot.L", "tail", (0, -0.42, 0))}], vista="lato")

# ================================================================ RULLO E PALLINA
RP_BR = dsim(upperarm01=(0.15, 0.35, -0.95), lowerarm01=(0.1, 0.35, -0.95))
RP_G = dsim(upperleg01=(0.08, -1, -0.05), lowerleg01=(0.08, -1, -0.02))
def rp(y): return posa(pos=(0, y, 0.32), rot=[("X", -25)], dirw=unisci(RP_G, RP_BR))
M("rullopolp", giro(rp(0), rp(-0.1), rp(0), rp(0.1)), 4, sf_onde(2), appoggio=False, ik_mani=True, poli_gomiti=(0, 1, 0), vista="lato",
  attrezzi=[{"tipo": "rullo", "sotto": ("lowerleg02.L", "head"), "x0": True, "lungo": 0.6}])
M("rullofem", giro(rp(0), rp(-0.1), rp(0), rp(0.1)), 4, sf_onde(2), appoggio=False, ik_mani=True, poli_gomiti=(0, 1, 0), vista="lato",
  attrezzi=[{"tipo": "rullo", "sotto": ("upperleg02.L", "head"), "x0": True, "lungo": 0.6}])
RPI = {"upperleg01.L": (0.15, -0.8, 0.3), "lowerleg01.L": (0.05, 0.1, -1), "upperleg01.R": (-0.6, -0.75, 0.3), "lowerleg01.R": (1, 0, 0.1)}
def rpi(y): return posa(pos=(0, y, 0.4), rot=[("X", -20)], dirw=unisci(RPI, RP_BR))
M("rullopiri", giro(rpi(0), rpi(-0.06), rpi(0), rpi(0.06)), 4, sf_onde(2), appoggio=False, ik_mani=True, poli_gomiti=(0, 1, 0), vista="tre_quarti",
  attrezzi=[{"tipo": "rullo", "sotto": ("upperleg01.R", "head"), "x0": True, "lungo": 0.6}])
PLB = sim({"neck01": [("X", -10)]}, upperarm01=[("Y", 40), ("X", -74)], lowerarm01=[("X", -65)])
def rq(y): return posa(pos=(0, y, 0.36), rot=[("X", 82)], ossa=PLB)
M("rulloquad", giro(rq(0), rq(-0.1), rq(0), rq(0.1)), 4, sf_onde(2), appoggio=False, vista="lato", attrezzi=[{"tipo": "rullo", "sotto": ("upperleg02.L", "head"), "x0": True, "lungo": 0.6}])
def rad(x): return posa(pos=(x, 0, 0.36), rot=[("X", 86)], ossa=PLB, dirw={"upperleg01.L": (1, 0, -0.15), "lowerleg01.L": (0.05, 1, -0.05)})
M("rulloadd", giro(rad(0), rad(-0.06), rad(0), rad(0.06)), 4, sf_onde(2), appoggio=False, vista="tre_quarti",
  attrezzi=[{"tipo": "rullo", "sotto": ("upperleg02.L", "head"), "lungo": 0.6, "rot": [("Z", 90)]}])
def rl(x): return posa(pos=(x, 0, 0.42), rot=[("Y", 72)], dirw={"upperarm01.L": (0, 0.05, -1), "lowerarm01.L": (-0.15, -1, 0)}, dir={"upperarm01.R": (-0.12, 0, -1), "lowerarm01.R": (0.4, -0.5, -0.8)})
M("rullolat", giro(rl(0), rl(-0.07), rl(0), rl(0.07)), 4, sf_onde(2), appoggio=False, vista="fronte",
  attrezzi=[{"tipo": "rullo", "sotto": ("upperleg02.L", "head"), "lungo": 0.6, "rot": [("Z", 90)]}])
RS_G = dsim(upperleg01=(0.12, -0.95, 0.25), lowerleg01=(0.05, -0.05, -1))
def rs(y): return posa(pos=(0, y, 0.34), rot=[("X", -80)], dirw=RS_G, dir=DIETRO_TESTA)
M("rulloschiena", giro(rs(0), rs(-0.08), rs(0), rs(0.08)), 4, sf_onde(2), appoggio="mai", ik_piedi=True, poli_ginocchia=(0.3, -0.3, 1), vista="lato",
  attrezzi=[{"tipo": "rullo", "sotto": ("spine02", "head"), "x0": True, "lungo": 0.6}])
def rdo(x): return posa(pos=(x, 0, 0.32), rot=[("Y", -90)], dir={"upperarm01.R": (0, 0, 1), "lowerarm01.R": (0, 0, 1), "upperarm01.L": (0.1, -0.5, -0.85), "lowerarm01.L": (0.05, -0.8, -0.5),
                                                                "upperleg01.L": (0, -0.4, -0.9), "lowerleg01.L": (0, 0.3, -0.95)})
M("rullodorsale", giro(rdo(0), rdo(-0.05), rdo(0), rdo(0.05)), 4, sf_onde(2), appoggio=False, vista="fronte", alto_camera=0.8,
  attrezzi=[{"tipo": "rullo", "sotto": ("upperarm01.R", "head"), "osso_z": "spine01", "lungo": 0.6, "rot": [("Z", 90)]}])
def pp(y): return posa(dirw=BL, ik={"piedeL": (0, y, 0.05)})
M("pallinapiede", giro(pp(0), pp(-0.05), pp(0), pp(0.05)), 4, sf_onde(2), ik_piedi=True, piedi_a_terra="R", appoggio=False, inquadra_fino=1.2, vista="tre_quarti",
  attrezzi=[{"tipo": "pallina", "presso": ("foot.L", "head", (0, -0.08, 0)), "z": 0.035}])
def ppt(d): return posa(pos=(0, 0.06 - d, 1.037), rot=[("X", 3 + d * 40)], dirw=BL)
M("pallinapetto", giro(ppt(0), ppt(0.015), ppt(0), ppt(-0.01)), 4, sf_onde(2), ik_piedi=True, appoggio=False, vista="lato", zoom=1.0,
  attrezzi=[{"tipo": "pallina", "presso": ("upperarm01.L", "head", (-0.07, -0.14, -0.06))}, {"tipo": "muro", "largo": 0.9, "presso": ("upperarm01.L", "head", (0, -0.23, 0))}])
def pps(z): return posa(pos=(0, 0.06, 1.037 + z), dirw={"upperarm01.R": (-0.12, -0.05, -1), "lowerarm01.R": (-0.08, -0.08, -1)}, dir={"upperarm01.L": (-1, -0.4, 0), "lowerarm01.L": (-1, -0.3, 0)})
M("pallinaspalla", giro(pps(0), pps(-0.06)), 4, sf_onde(1), ik_piedi=True, poli_ginocchia=(0, -1, 0), appoggio=False, vista="lato", zoom=1.0,
  attrezzi=[{"tipo": "pallina", "presso": ("upperarm01.L", "head", (-0.07, 0.14, -0.08))}, {"tipo": "muro", "largo": 0.9, "presso": ("upperarm01.L", "head", (0, 0.23, 0))}])
M("torsione", tieni(posa(**SUP, dir=unisci(BRACCIA_T, GINOCCHIA_SU)), posa(pos=(0, 0, 0.2), rot=[("X", -90), ("Y", -25)], ossa=unisci(busto(z=25), collo(z=30)),
                                                                       dir=unisci(BRACCIA_T, {k: (v[0] - 0.75, v[1] + 0.3, v[2]) for k, v in GINOCCHIA_SU.items()}))), 8, vista="fronte", alto_camera=0.9)
M("ginpetto", tieni(posa(**SUP, dir=dsim(upperarm01=(0.15, 0.05, -1), lowerarm01=(0.1, 0.05, -1))),
                    posa(**SUP, dir=unisci({"upperleg01.L": (0.15, -0.6, 0.78), "lowerleg01.L": (0.05, 0.85, -0.5)}, dsim(upperarm01=(0.2, -0.75, -0.6), lowerarm01=(-0.1, -0.3, -0.95))))), 8, vista="lato", alto_camera=0.5)
M("flessori", tieni(posa(pos=(0, 0, 0.7), ossa={"foot.R": [("X", 60)]}, dirw=unisci(AFB, MANI_GINOCCHIO)),
                    posa(pos=(0, -0.07, 0.7), rot=[("X", -6)], ossa={"foot.R": [("X", 60)]}, dirw=unisci(AFB, dsim(upperarm01=(0.8, 0.2, -0.55), lowerarm01=(-0.75, -0.35, -0.3))))), 8, vista="lato")
