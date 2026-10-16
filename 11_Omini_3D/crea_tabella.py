# Crea muscoli.json: per ogni esercizio dell'app i muscoli che lavorano, aiutano o si allungano.
import json, sys
MUSCOLI = {
 "quadricipite": "Quadricipite", "grande_gluteo": "Grande gluteo", "medio_gluteo": "Medio gluteo", "femorali": "Femorali",
 "adduttori": "Adduttori", "flessori_anca": "Flessori dell'anca", "gastrocnemio": "Gastrocnemio", "soleo": "Soleo",
 "tibiale": "Tibiale anteriore", "retto_addome": "Retto dell'addome", "obliqui": "Obliqui", "erettori": "Erettori della schiena",
 "gran_dorsale": "Gran dorsale", "trapezio": "Trapezio", "romboidi": "Romboidi e trapezio medio", "pettorale": "Grande pettorale",
 "deltoide_ant": "Deltoide anteriore", "deltoide_lat": "Deltoide laterale", "deltoide_post": "Deltoide posteriore",
 "cuffia": "Cuffia dei rotatori", "dentato": "Dentato anteriore", "bicipite": "Bicipite", "tricipite": "Tricipite", "avambraccio": "Avambraccio",
}
# id: (lavora, aiuta, allunga, fase dello sforzo, inquadratura)
# fase: "su" = lo sforzo è nella salita/spinta, "giu" = nella discesa, "tenuta" = isometria, "ciclo" = continuo, "respiro" = mobilità lenta
T = {
 "squat": ("quadricipite grande_gluteo", "adduttori femorali erettori soleo", "", "su", "tre_quarti"),
 "goblet": ("quadricipite grande_gluteo", "adduttori erettori retto_addome deltoide_ant bicipite", "", "su", "tre_quarti"),
 "squatbil": ("quadricipite grande_gluteo", "adduttori femorali erettori trapezio retto_addome", "", "su", "tre_quarti"),
 "legpress": ("quadricipite grande_gluteo", "adduttori femorali", "", "su", "lato"),
 "affondo": ("quadricipite grande_gluteo", "medio_gluteo adduttori femorali gastrocnemio", "flessori_anca", "su", "lato"),
 "affondoman": ("quadricipite grande_gluteo", "medio_gluteo adduttori avambraccio", "flessori_anca", "su", "lato"),
 "bulgaro": ("quadricipite grande_gluteo", "medio_gluteo adduttori", "flessori_anca", "su", "lato"),
 "stepup": ("quadricipite grande_gluteo", "medio_gluteo gastrocnemio avambraccio", "", "su", "tre_quarti"),
 "stepupl": ("grande_gluteo quadricipite", "flessori_anca medio_gluteo gastrocnemio", "", "su", "tre_quarti"),
 "rdl": ("femorali grande_gluteo", "erettori adduttori avambraccio trapezio", "", "su", "lato"),
 "rdl1": ("femorali grande_gluteo", "medio_gluteo erettori obliqui", "", "su", "lato"),
 "ponte": ("grande_gluteo", "femorali erettori", "flessori_anca", "su", "lato"),
 "ponte1": ("grande_gluteo", "medio_gluteo femorali obliqui", "flessori_anca", "su", "lato"),
 "hipthrust": ("grande_gluteo", "femorali quadricipite adduttori", "", "su", "lato"),
 "polpacci": ("gastrocnemio soleo", "tibiale", "", "su", "dietro"),
 "polpaccim": ("gastrocnemio soleo", "avambraccio trapezio", "", "su", "dietro"),
 "polpaccip": ("gastrocnemio soleo", "trapezio", "", "su", "dietro"),
 "legcurl": ("femorali", "gastrocnemio", "", "su", "lato"),
 "mostro": ("medio_gluteo", "grande_gluteo quadricipite", "", "ciclo", "fronte"),
 "adduttori": ("adduttori", "flessori_anca obliqui", "", "su", "fronte"),
 "swing": ("grande_gluteo femorali", "erettori retto_addome deltoide_ant avambraccio", "", "su", "lato"),
 "squatjump": ("quadricipite grande_gluteo gastrocnemio", "femorali soleo", "", "su", "tre_quarti"),
 "skip": ("flessori_anca gastrocnemio", "quadricipite soleo retto_addome", "", "ciclo", "lato"),
 "balzilat": ("medio_gluteo quadricipite", "grande_gluteo adduttori gastrocnemio", "", "su", "fronte"),
 "plank": ("retto_addome obliqui", "deltoide_ant pettorale quadricipite dentato", "", "tenuta", "lato"),
 "plankl": ("obliqui medio_gluteo", "retto_addome deltoide_lat erettori", "", "tenuta", "fronte"),
 "deadbug": ("retto_addome obliqui", "flessori_anca", "", "ciclo", "tre_quarti"),
 "superman": ("erettori grande_gluteo", "femorali deltoide_post romboidi", "", "su", "lato"),
 "pallof": ("obliqui retto_addome", "pettorale deltoide_ant tricipite", "", "tenuta", "fronte"),
 "russian": ("obliqui retto_addome", "flessori_anca", "", "ciclo", "fronte"),
 "mountain": ("retto_addome flessori_anca", "deltoide_ant pettorale quadricipite", "", "ciclo", "lato"),
 "piegamenti": ("pettorale tricipite", "deltoide_ant dentato retto_addome", "", "su", "lato"),
 "panca": ("pettorale tricipite", "deltoide_ant", "", "su", "lato"),
 "spinte": ("deltoide_ant deltoide_lat", "tricipite trapezio dentato", "", "su", "fronte"),
 "rematore": ("gran_dorsale romboidi", "deltoide_post bicipite erettori avambraccio", "", "su", "lato"),
 "rematorebil": ("gran_dorsale romboidi", "deltoide_post bicipite erettori avambraccio", "", "su", "lato"),
 "lat": ("gran_dorsale", "bicipite romboidi deltoide_post avambraccio", "", "giu", "dietro"),
 "trazioni": ("gran_dorsale bicipite", "romboidi avambraccio retto_addome", "", "su", "dietro"),
 "facepull": ("deltoide_post romboidi", "cuffia trapezio", "", "su", "dietro"),
 "rotest": ("cuffia", "deltoide_post", "", "su", "dietro"),
 "apertura": ("deltoide_post romboidi", "cuffia trapezio", "pettorale", "su", "dietro"),
 "alzatepost": ("deltoide_post", "romboidi cuffia trapezio", "", "su", "dietro"),
 "contadino": ("avambraccio trapezio", "obliqui retto_addome erettori grande_gluteo quadricipite", "", "ciclo", "fronte"),
 "gattomucca": ("", "", "erettori retto_addome trapezio", "respiro", "lato"),
 "wgs": ("", "quadricipite", "flessori_anca femorali adduttori pettorale", "respiro", "tre_quarti"),
 "flessori": ("grande_gluteo", "", "flessori_anca quadricipite", "respiro", "lato"),
 "caviglie": ("tibiale", "gastrocnemio soleo", "", "ciclo", "lato"),
 "polpaccimuro": ("", "", "gastrocnemio soleo", "respiro", "lato"),
 "femorali": ("", "", "femorali", "respiro", "lato"),
 "quad": ("", "medio_gluteo", "quadricipite flessori_anca", "respiro", "lato"),
 "bambino": ("", "", "gran_dorsale erettori grande_gluteo", "respiro", "lato"),
 "ginpetto": ("", "", "grande_gluteo erettori femorali", "respiro", "lato"),
 "torsione": ("", "", "obliqui erettori gran_dorsale grande_gluteo", "respiro", "tre_quarti"),
 "groiners": ("", "deltoide_ant pettorale", "adduttori flessori_anca", "respiro", "tre_quarti"),
 "inchworm": ("retto_addome deltoide_ant", "pettorale tricipite", "femorali gastrocnemio", "ciclo", "lato"),
 "cerchibraccia": ("deltoide_lat deltoide_ant deltoide_post", "cuffia trapezio", "", "ciclo", "fronte"),
 "petto": ("romboidi deltoide_post", "", "pettorale deltoide_ant", "respiro", "fronte"),
 "cerchianca": ("flessori_anca medio_gluteo", "adduttori grande_gluteo", "", "ciclo", "fronte"),
 "calciata": ("femorali", "gastrocnemio soleo quadricipite", "", "ciclo", "lato"),
 "rullopiri": ("", "", "grande_gluteo medio_gluteo", "respiro", "lato"),
 "rulloquad": ("", "", "quadricipite", "respiro", "lato"),
}
app = json.load(open(sys.argv[1], encoding="utf-8"))
out = {"versione": 1, "muscoli": MUSCOLI, "esercizi": {}}
for e in app:
    t = T[e["id"]]
    for k in " ".join(t[:3]).split():
        assert k in MUSCOLI, (e["id"], k)
    out["esercizi"][e["id"]] = {"nome": e["nome"], "lavora": t[0].split(), "aiuta": t[1].split(), "allunga": t[2].split(), "fase": t[3], "vista": t[4], "fedb": e["fedb"]}
assert set(T) == {e["id"] for e in app}
json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out["esercizi"]), "esercizi,", len(MUSCOLI), "muscoli")
