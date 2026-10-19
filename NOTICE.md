# Avvisi di terze parti

HUD · © 2026 Matteo e i contributori di HUD, sotto licenza GNU AGPL 3.0 (vedi `LICENSE`).

HUD usa o si ispira ai seguenti lavori di terzi, ciascuno con la propria licenza.

I video degli esercizi in `11_Omini_3D/video` si possono riusare con licenza **CC BY 4.0**, citando HUD.

| Componente | Uso in HUD | Licenza |
| --- | --- | --- |
| [adaptive-macro](https://github.com/cramnivek/adaptive-macro) · © 2026 cramnivek | Struttura del filtro di Kalman delle "calorie che imparano" (`02_App_iPhone/src/10-carburante.js`), riscritta per HUD | MIT |
| [uPlot](https://github.com/leeoniya/uPlot) 1.6.32 · © 2022 Leon Sorokin | Grafico di fitness, fatica e forma (`02_App_iPhone/src/13-uplot-libreria.js`, incluso con la sua licenza) | MIT |
| [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) | Foto e descrizioni degli esercizi di palestra e mobilità, caricate dal web; punto di partenza della tabella muscoli (`11_Omini_3D/muscoli.json`) | Pubblico dominio (Unlicense) |
| [MakeHuman](https://github.com/makehumancommunity/makehuman) · © Data Collection AB, Joel Palmius, Jonas Hauquier | Corpo, scheletro e forme della figura dei video 3D (`11_Omini_3D/makehuman`, `figura.blend`) | CC0 1.0 (pubblico dominio) |
| [jsDelivr](https://www.jsdelivr.com) | Consegna dei video 3D dal repository all'app e di MapLibre GL JS | Servizio gratuito |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) 5.6.0 · © MapLibre contributors | Mappa e 3D del percorso (`02_App_iPhone/src/14-interfaccia.js`), caricata dal web, non inclusa | BSD 3-Clause |
| [OpenFreeMap](https://openfreemap.org) · stili [OpenMapTiles](https://openmaptiles.org) | Cartine della mappa (stili positron e dark) | Servizio gratuito; stili © OpenMapTiles (BSD 3-Clause, CC BY 4.0) |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Dati delle cartine, attribuiti nella mappa | ODbL 1.0 |
| [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen, su AWS Open Data) | Rilievo della vista 3D | Attribuzione alle fonti ([elenco](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)) |
| [Open Food Facts](https://world.openfoodfacts.org) | Valori dei cibi confezionati dal codice a barre (`02_App_iPhone/src/17-diario-cibo.js`) | Database ODbL 1.0, contenuti DbCL 1.0 |
| [@garmin/fitsdk](https://github.com/garmin/fit-javascript-sdk) | Scrittura e lettura dei file FIT in `09_Esporta_FIT` (dipendenza npm, non inclusa nel repository) | Garmin FIT Protocol License (gratuita, non open source) |
| [@types/scriptable-ios](https://www.npmjs.com/package/@types/scriptable-ios) | Autocompletamento in VS Code (dipendenza di sviluppo) | MIT |
| [Intervals.icu API](https://intervals.icu) | Fonte dei dati e calendario | Termini d'uso di Intervals.icu; i dati Garmin richiedono l'attribuzione a Garmin |

Idee, nessun codice copiato: [Endurain](https://github.com/joaovitoriasilva/endurain) (mappa del percorso), [SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness) (acqua e codici a barre), OpenGym (diario delle serie), [GoldenCheetah](https://github.com/GoldenCheetah/GoldenCheetah) (curve e W′bal), [zoffline](https://github.com/zoffline/zwift-offline) (collegamento delle sedute indoor).

Testo della licenza MIT di adaptive-macro:

```
MIT License

Copyright (c) 2026 cramnivek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
