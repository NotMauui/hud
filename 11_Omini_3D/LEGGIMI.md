# Omini 3D · video degli esercizi con i muscoli che si accendono

Una figura anatomica fa l'esercizio in loop su fondo scuro. I muscoli si colorano a tempo con lo sforzo:
**rosso** quelli che lavorano, **rosa** quelli che aiutano, **azzurro** quelli che si allungano (mobilità).
L'app mostra il video nella scheda dell'esercizio, con l'elenco dei muscoli sotto. Senza rete torna la foto di prima.

## Cosa c'è in questa cartella

| File | A cosa serve |
| --- | --- |
| `figura.blend` | La figura pronta: corpo, scheletro e 24 zone muscolari. Si apre in Blender. |
| `rendi_esercizio.py` | Fa il video di uno o più esercizi. È l'unico script che serve di solito. |
| `movimenti.py` | I movimenti di palestra, scritti come pose chiave. Qui si correggono o si aggiungono esercizi. |
| `movimenti_mobilita.py` | I 118 movimenti di mobilità (collo, spalle, schiena, anche, gambe, caviglie, flussi, rullo). |
| `rendi_mobilita.sh` | Fa tutti i video di mobilità e aggiorna l'app (2-3 notti, riprende da dove era rimasto). |
| `muscoli.json` | Per ognuno dei 162 esercizi dell'app: muscoli che lavorano, aiutano, si allungano; inquadratura. |
| `sincronizza_app.py` | Copia nell'app la tabella dei muscoli e l'elenco dei video pronti. |
| `crea_figura.py`, `makehuman/` | Ricostruiscono `figura.blend` da zero (servono solo se cambi corpo o zone). |
| `crea_tabella.py` | Ricrea `muscoli.json` (la tabella è scritta lì dentro). |
| `anteprima_zone.py`, `griglia_zone.py` | Foto di controllo delle zone muscolari. |
| `video/` | I video finiti (`.mp4`) e le copertine (`.jpg`). |

## Tutti gli esercizi di palestra, qualità massima

Col Mac in carica, nel Terminale, dalla cartella `11_Omini_3D` (scrivi `cd `, trascina la cartella, Invio):

```sh
sh rendi_palestra.sh
```

Fa i 44 video di palestra a 720 × 720 (quanto serve all'app; per 1080 togli `--lato 720` dallo script), 30 fotogrammi al secondo, sfocatura di movimento e luce calcolata con Cycles (64 campioni con riduzione del rumore), poi aggiorna l'app.
Ci vogliono ore: il Terminale scrive quanto ha richiesto ogni video, così sai quanto manca. Il Mac resta sveglio da solo.
Si può fermare con Ctrl+C e rilanciare: riparte dal primo video non ancora fatto a qualità massima.
Alla fine scrive i comandi per pubblicare.

Le qualità: `--qualita bozza` (540, veloce, per provare), `normale` (720, la base), `massima` (1080 · 30 fps · motion blur).

## Tutti gli esercizi di mobilità

```sh
sh rendi_mobilita.sh
```

Fa i 118 video di mobilità a 720 × 720, 24 fotogrammi al secondo, 32 campioni. Sono tanti e più lunghi di quelli di palestra:
conta 2-3 notti. La mattina si ferma con Ctrl+C, la sera si rilancia lo stesso comando e riparte dal primo video mancante.
Gli attrezzi nuovi (muro, stipite della porta, bastone, rullo a terra, pallina, cinghia, elastico) li crea lo script.

## Fare i video sul Mac

Apri il Terminale, scrivi `cd ` (con lo spazio), trascina dentro la cartella `11_Omini_3D` e premi Invio. Poi:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b figura.blend -P rendi_esercizio.py -- squat
```

- Più esercizi insieme: `-- squat ponte plank gattomucca`. Tutti: `-- tutti`; solo palestra: `-- palestra`; solo mobilità: `-- mobilita`.
- Più grande o più pulito: `--lato 1080 --campioni 64`. Di base è 720 × 720 con 32 campioni.
- Usa la scheda video del Mac (Metal) da sola. Su un Mac con chip M un video di 4 secondi richiede pochi minuti.
- Escono `video/squat.mp4` (loop di 3–6 secondi, poche centinaia di KB) e `video/squat.jpg` (la copertina).

Poi, per farli vedere nell'app:

```sh
python3 sincronizza_app.py . ../02_App_iPhone/src/19-mobilita-palestra.js
cd ../02_App_iPhone && npm run build
```

`sincronizza_app.py` crea anche il loop `.webp` che l'app mostra (parte da solo anche dove un video aspetta un tocco).
Per farlo servono ffmpeg e Pillow (`brew install ffmpeg` e `pip3 install pillow`); se mancano, l'app usa l'`.mp4`.

L'app scarica i video da GitHub (tramite jsDelivr) dalla cartella `11_Omini_3D/video` del repository pubblico: arrivano sull'iPhone dopo il push.

## Correggere o aggiungere un movimento

1. In `movimenti.py` ogni esercizio è un elenco di pose chiave nel tempo (0 = inizio, 1 = fine, uguale all'inizio così il loop non salta).
   Le rotazioni sono in gradi sugli assi del corpo, spiegati in cima al file. `sforzo` dice quando si accendono i muscoli.
2. Controlla le pose in pochi secondi, con una foto per posa:
   `/Applications/Blender.app/Contents/MacOS/Blender -b figura.blend -P rendi_esercizio.py -- squat --chiavi --motore workbench`
3. Quando vanno bene, fai il video come sopra.

Lo script mette da solo la figura a terra in ogni posa. Con `ik_piedi` / `ik_mani` piedi e mani restano fermi dove sono nella prima posa (squat, ponte, quattro zampe).
I muscoli di ogni esercizio vengono da `muscoli.json`, non dal movimento.

## Stato

- **Movimenti scritti:** tutti i 44 esercizi di palestra, con gli attrezzi (manubri, kettlebell, bilanciere, panca, gradino, sbarra, cavi, elastici, lat machine, leg press), più gatto-mucca e posizione del bambino.
- **Video già nell'app:** squat, ponte glutei, plank, gatto-mucca, piegamenti, sollevamenti sulle punte, posizione del bambino (qualità normale). `rendi_palestra.sh` li rifà tutti alla massima.
- **Mobilità:** tutti i 118 esercizi hanno il movimento (`movimenti_mobilita.py`); i video si fanno con `rendi_mobilita.sh`.

Strumenti per scrivere i movimenti (in cima a `movimenti.py`): `dir`/`dirw` dicono dove punta un segmento (braccio, coscia…) negli assi del corpo o del mondo, `ik` sposta piedi e mani tenuti dall'IK, `att` muove un attrezzo, `volo` stacca la figura da terra.

## Licenze

- Figura, scheletro e forme: **MakeHuman**, rilasciati in **CC0** (pubblico dominio). Il copyright originale è di Data Collection AB, Joel Palmius e Jonas Hauquier.
- Muscoli per esercizio: punto di partenza da **Free Exercise DB** (pubblico dominio), poi rivisti a mano.
- Zone muscolari, movimenti, script e video: parte di HUD. Il codice è AGPL-3.0, i video si possono riusare con **CC BY 4.0** citando HUD.
