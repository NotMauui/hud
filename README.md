# HUD · l'allenamento che si scrive da solo

HUD è un'app per atleti di endurance (triathlon, corsa, nuoto, bici) che ogni mattina dice **cosa fare oggi e perché**, scrive da sola il piano a blocchi di 4 settimane e calcola **quanto mangiare** in base all'allenamento del giorno. Oggi gira su iPhone dentro [Scriptable](https://scriptable.app) e legge i dati da [Intervals.icu](https://intervals.icu).

> *English summary:* HUD is a free, open-source (AGPL-3.0) endurance-training companion for iPhone (Scriptable + Intervals.icu). It reads your readiness (HRV, resting HR, sleep), adapts today's session, generates 4-week training blocks for triathlon and single sports, and computes daily fuelling with safety floors. The UI and docs are in Italian for now; contributions in English are welcome.

**Stato: in fase di test.** Funziona ogni giorno su iPhone, ma è un progetto giovane: aspettati cambiamenti.

## Cosa fa

- **Oggi** — prontezza da HRV, FC a riposo e sonno, con due semafori separati: *sistemico* (cuore e recupero) e *tessuti* (impatto della corsa). La seduta del giorno si adatta da sola se serve.
- **Piano** — blocchi di 4 settimane (3 di carico, 1 di scarico) con periodizzazione all'indietro dalla gara, circa 80/20, libreria di sedute parametriche tradotte nelle tue zone. Le sedute vanno nel calendario di Intervals e da lì all'orologio.
- **Carburante** — metabolismo a riposo (ten Haaf 2014), carboidrati in g/kg secondo il giorno, proteine e grassi con dei minimi, deficit in % del peso, **calorie che imparano** dalle pesate e dal cibo registrato, carico pre-gara, rifornimento in seduta (gel, acqua e sodio all'ora). **Limiti di sicurezza** che vincono su tutto.
- **L'impronta** — il segno dell'app: ogni seduta è una fila di capsule larga quanto il tempo e alta quanto l'intensità; il contorno è il piano, il pieno quello che hai fatto.
- Widget per Home e schermata di blocco, notifiche della sera, diario del cibo (anche con Siri), infortuni e malattia, palestra e mobilità, condivisione delle attività.
- **Condividere** — quattro immagini per le storie (Attività, Giornata, Settimana, Gara) su fondo nero, bianco o trasparente, tutte firmate dall'impronta.

## Installazione (iPhone)

1. Installa **Scriptable** dall'App Store.
2. Copia il contenuto di [`02_App_iPhone/HUD-70.3.js`](02_App_iPhone/HUD-70.3.js) in un nuovo script di Scriptable.
3. Su Intervals.icu › Settings › Developer Settings genera la tua **API Key**.
4. Avvia lo script: incolla la chiave (resta nel Portachiavi dell'iPhone) e rispondi alle domande della configurazione.

La guida completa delle schede, dei widget e della condivisione è in [`docs/GUIDA.md`](docs/GUIDA.md).

## I tuoi dati

Tutto resta sul tuo iPhone e nel tuo iCloud: l'app non ha un server, non raccoglie statistiche d'uso e non manda nulla a nessuno, tranne le chiamate a Intervals.icu con la tua chiave. I dati di Garmin che arrivano tramite Intervals restano soggetti ai termini di Garmin e di Intervals.icu.

**Non è un dispositivo medico.** Le indicazioni su allenamento e alimentazione sono generali: se hai un medico, un allenatore o un nutrizionista, vale il loro parere.

## Struttura del repository

| Cartella | Contenuto |
| --- | --- |
| `02_App_iPhone` | L'app: il codice in `src/` (21 file per argomento), `costruisci.js` che li unisce in `HUD-70.3.js` |
| `04_Generatore` | Generatore del piano, stima delle soglie, verifiche del profilo, profili di prova e tutti i test |
| `03_Versione_PC` | Dashboard di analisi per il computer, costruita dallo stesso motore |
| `09_Esporta_FIT` | Le sedute di nuoto come file FIT per gli orologi Garmin |
| `01_Prodotto` | Specifica di prodotto e diagrammi |
| `docs` | Guida d'uso |

## Sviluppo

Serve Node.js 18 o più recente.

```sh
cd 02_App_iPhone
npm install        # solo per l'autocompletamento delle API di Scriptable in VS Code
npm run build      # unisce src/ in HUD-70.3.js
npm test           # Carburante, calorie adattive, generatore, soglie, verifiche
```

Si modifica sempre `02_App_iPhone/src/`; `HUD-70.3.js` è il risultato e non va toccato a mano. I blocchi condivisi con il generatore si copiano con `node 04_Generatore/sincronizza-app.js`. Vedi [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licenza

HUD è software libero: puoi usarlo, studiarlo, modificarlo e ridistribuirlo secondo la **GNU Affero General Public License 3.0** ([`LICENSE`](LICENSE)). Se distribuisci una versione modificata, o la offri ad altri come servizio in rete, devi rendere disponibile il suo codice sorgente con la stessa licenza.

© 2026 Matteo e i contributori di HUD. Componenti e dati di terze parti: [`NOTICE.md`](NOTICE.md).
