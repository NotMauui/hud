# Contribuire a HUD

Grazie se vuoi dare una mano. Segnalazioni, idee e correzioni sono benvenute, in italiano o in inglese.

## Segnalare un problema
Apri una *issue* con: cosa hai fatto, cosa ti aspettavi, cosa è successo, versione dell'app (in Impostazioni) e di iOS. Il registro dell'ultima apertura è in iCloud Drive › Scriptable › `hud-log.txt`: **togli eventuali dati personali** prima di allegarlo. Non incollare mai la tua chiave di Intervals.

## Proporre una modifica
1. Modifica i file in `02_App_iPhone/src/` (mai `HUD-70.3.js` direttamente) o in `04_Generatore/`.
2. Se tocchi un blocco condiviso con il generatore, lancia `node 04_Generatore/sincronizza-app.js`.
3. `cd 02_App_iPhone && npm run build && npm test`: tutti i test devono passare.
4. Se cambi apposta le regole del Carburante, rigenera i risultati attesi con `node 04_Generatore/test-carburante.js --salva` e spiega il perché nella richiesta.
5. Apri una *pull request* con una descrizione breve.

## Regole del progetto
- **Prudenza di default**: con dati scarsi o contrastanti l'app riduce il carico, non lo aumenta. I limiti di sicurezza del Carburante (deficit massimo, energia minima, calorie minime) non si abbassano.
- **I dati restano sull'iPhone.** Niente statistiche d'uso, server o servizi esterni senza una discussione aperta prima.
- **Tono calmo**: niente serie da non interrompere, medaglie o sensi di colpa.
- **Nessun dato personale** nel codice, nei test o negli esempi.

Contribuendo accetti che il tuo codice sia distribuito con la licenza del progetto (GNU AGPL 3.0).

---

## In English

Thanks for helping. Issues, ideas and fixes are welcome in English or Italian.

- **Report a problem:** open an issue with what you did, what you expected, what happened, the app version (Settings) and iOS version. In the app, *Settings › Report a problem on GitHub* fills these in for you. The last run's log is in iCloud Drive › Scriptable › `hud-log.txt`: **remove personal data** before attaching it, and never paste your Intervals key.
- **Propose a change:** edit `02_App_iPhone/src/` (never `HUD-70.3.js`) or `04_Generatore/`; if you touch a block shared with the generator run `node 04_Generatore/sincronizza-app.js`; then `cd 02_App_iPhone && npm run build && npm test` — every test must pass. If you deliberately change the fuel rules, regenerate the expected results with `node 04_Generatore/test-carburante.js --salva` and explain why in the pull request.
- **Project rules:** cautious by default (with poor or conflicting data the app lowers the load, never raises it; fuel safety floors are never lowered); data stays on the iPhone (no analytics, servers or third-party services without an open discussion first); calm tone (no streaks, badges or guilt); no personal data in code, tests or examples.

By contributing you agree that your code is distributed under the project license (GNU AGPL 3.0).
