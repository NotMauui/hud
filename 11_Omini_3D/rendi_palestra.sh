#!/bin/sh
# HUD · tutti i video degli esercizi di palestra alla qualità massima, poi aggiorna l'app.
# Uso: sh rendi_palestra.sh          (dalla cartella 11_Omini_3D, col Mac in carica)
# Si può fermare con Ctrl+C e rilanciare: riparte da dove era rimasto.
cd "$(dirname "$0")"
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
# caffeinate tiene sveglio il Mac finché Blender lavora
caffeinate -i "$BLENDER" -b figura.blend -P rendi_esercizio.py -- palestra --qualita massima --lato 720 --salta 2>&1 | grep --line-buffered -E "^\[|già fatto|Error|Traceback|manca"
python3 sincronizza_app.py . ../02_App_iPhone/src/19-mobilita-palestra.js
cd ../02_App_iPhone && npm run build
echo "Fatto. Per pubblicare: cd ../10_Open_Source && node prepara-open-source.js && cd hud && git add . && git commit -m \"Video 3D di tutti gli esercizi\" && git push"
