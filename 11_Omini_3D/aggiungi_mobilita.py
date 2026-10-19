# Mette il catalogo della mobilità (catalogo_mobilita.py) in muscoli.json e nell'app (blocco CATALOGO in 19-mobilita-palestra.js).
# Uso: python3 aggiungi_mobilita.py <cartella 11_Omini_3D> <file 19-mobilita-palestra.js>
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import catalogo_mobilita as C
dove, dest = sys.argv[1], sys.argv[2]
pt = os.path.join(dove, "muscoli.json"); T = json.load(open(pt, encoding="utf-8"))
for (i, nome, zona, tipo, dose, att, come, sport, lav, aiu, all_, vista) in C.E:
    T["esercizi"][i] = {"nome": nome, "lavora": lav.split(), "aiuta": aiu.split(), "allunga": all_.split(),
                        "fase": "respiro" if tipo in ("statica", "rullo") else "ciclo", "vista": vista, "fedb": "", "zona": zona, "tipo": tipo}
for i, z in C.GIA.items():
    if i in T["esercizi"]: T["esercizi"][i]["zona"] = z
json.dump(T, open(pt, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
ATT = {"elastico": "elastico"}
esl = [[i, nome, "", ATT.get(att, "libero"), "mob", dose, come] for (i, nome, zona, tipo, dose, att, come, *_r) in C.E]
zona = {**{e[0]: e[2] for e in C.E}, **C.GIA}
info = {e[0]: [e[3], e[5], e[7]] for e in C.E}  # tipo, attrezzo, sport
J = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))
blocco = ("// >>> CATALOGO (generato da 11_Omini_3D/aggiungi_mobilita.py: non modificare a mano)\n"
          "// esercizi di mobilità in più, la zona di ognuno (anche dei vecchi), tipo/attrezzo/sport e le routine nuove\n"
          f"const ESL_MOB = {J(esl)};\n"
          f"const MOB_ZONE = {J(C.ZONE)};\n"
          f"const MOB_ZONA = {J(zona)};\n"
          f"const MOB_INFO = {J(info)};\n"
          f"const MOB_NUOVE = {J(C.ROUTINE)};\n"
          "for (const e of ESL_MOB) if (!ESL.some((x) => x[0] === e[0])) ESL.push(e);\n"
          "Object.assign(MOB, MOB_NUOVE);\n"
          "// <<< CATALOGO")
s = open(dest, encoding="utf-8").read()
if "// >>> CATALOGO" in s: s = re.sub(r"// >>> CATALOGO.*?// <<< CATALOGO", lambda m: blocco, s, flags=re.S)
elif "// >>> MUSCOLI" in s: s = s.replace("// >>> MUSCOLI", blocco + "\n\n// >>> MUSCOLI", 1)
else: s = s.rstrip("\n") + "\n\n" + blocco + "\n"
open(dest, "w", encoding="utf-8").write(s)
print(len(esl), "esercizi aggiunti,", len(C.ROUTINE), "routine nuove,", len(T["esercizi"]), "esercizi in muscoli.json")
