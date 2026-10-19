#!/bin/sh
# HUD · tutti i video degli esercizi di mobilità (118), poi aggiorna l'app.
# Uso: sh rendi_mobilita.sh          (dalla cartella 11_Omini_3D, col Mac in carica)
# Ci vogliono 2-3 notti: si può fermare con Ctrl+C e rilanciare, riparte dal primo video non ancora fatto.
cd "$(dirname "$0")"
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
caffeinate -i "$BLENDER" -b figura.blend -P rendi_esercizio.py -- mobilita --qualita massima --lato 720 --campioni 32 --fps 24 --salta 2>&1 | grep --line-buffered -E "^\[|già fatto|Error|Traceback|manca"
python3 sincronizza_app.py . ../02_App_iPhone/src/19-mobilita-palestra.js
cd ../02_App_iPhone && npm run build
echo "Fatto. Per pubblicare: cd ../10_Open_Source && node prepara-open-source.js && cd hud && git add . && git commit -m \"Video 3D degli esercizi di mobilità\" && git push"
