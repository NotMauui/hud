# Generatore del piano · v0.1

Dato un profilo (obiettivo, disponibilità, sport, livello) produce un blocco di 4 settimane: 3 di carico e 1 di scarico.

- `generatore.js` — regole (oggetto `REGOLE`), libreria di sedute, generazione e collocazione nei giorni.
- `profili.js` — 47 profili: 20 triatleti inventati, 16 atleti di uno o due sport, 10 con le ore indicate nella configurazione (anche Tester B), più un profilo reale reso anonimo.
- `test-generatore.js` — 26 controlli su ogni piano. Esegui: `node test-generatore.js`.
- `crea-report.js` — rigenera `report-validazione.html`. Esegui: `node crea-report.js`.
- `dati-reali.js` — legge `hud-dati.json` (l'esportazione dell'app in iCloud Drive › Scriptable) e calcola il profilo a una data.
- `confronto-reale.js` — rigenera i blocchi da settembre con i dati veri e li confronta con quanto fatto. Esegui: `node confronto-reale.js <percorso di hud-dati.json>`. Crea `confronto-reale.html` (dati personali). È il caso studio di Atleta reale.
- `soglie.js` — la stima delle soglie per ogni persona dalle sue attività: FC massima (picchi confermati), soglia FC di corsa e bici (sforzi duri di 20–70' o giri lunghi), passo soglia (corsa dura più veloce con il GAP, portata a un'ora; se manca, retta passo–battiti letta alla soglia), CSS (test 400 + 200, ripetute lunghe, nuotata continua), FTP (stima di Intervals, solo con la potenza). Restituisce valori, fonte, affidabilità e i cambi da scrivere su Intervals. Lo stesso blocco gira nell'app, che li scrive da sola.
- `test-soglie.js` — 20 utenti di prova (anche i casi trovati dalla revisione: sensore agganciato alla cadenza, FTP da una sola uscita, test con un 400 di riscaldamento, valori salvati in unità sbagliate). Esegui: `node test-soglie.js [hud-dati.json]`.
- `verifiche.js` — la verifica automatica del profilo, uguale per ogni utente: soglie superate dai giri registrati (CSS, anche calcolato da un test 400+200; soglia FC di corsa; FC massima; FTP), soglie diverse tra app e Intervals, gare non segnate, notti senza HRV, rientro dopo una pausa, settimane irregolari. Lo stesso blocco gira dentro l'app (scheda Stagione › Verifica del profilo).
- `test-verifiche.js` — 18 utenti di prova: ogni verifica deve scattare solo quando serve, e il blocco dentro l'app deve essere identico. Esegui: `node test-verifiche.js [hud-dati.json]`.
- `verifica-utente.js` — il rapporto completo per un utente qualsiasi: verifiche, piano contro realtà su due blocchi passati, prossimo blocco. Esegui: `node verifica-utente.js <hud-dati.json> [profilo.json]`. Senza `profilo.json` (le risposte dell'onboarding) ricava disponibilità e giorni dai dati. Scrive in `verifiche-utenti/` (dati personali, restano in locale).

- `raccogli-tester.js` — scarica da Intervals i dati di tutti i tester del tuo gruppo di allenamento e lancia `verifica-utente.js` per ognuno. Esegui: `INTERVALS_KEY=la-tua-chiave node raccogli-tester.js` (oppure metti la chiave nel file `.chiave-intervals` in questa cartella). Crea `verifiche-utenti/tester.html`: per ogni tester storico, notti con HRV e sonno, attività con battiti e giri, fonti dei dati, valori da aggiornare e cosa chiedergli. Se Intervals non restituisce l'elenco, scrivi i tester in `tester.json`: `[{"id": "i12345", "nome": "Luca"}]`.

## Raccogliere i dati dei tester
1. Su Intervals crea un gruppo di allenamento (serve l'abbonamento supporter) e copia il suo link.
2. Manda ai tester la guida "Guida tester HUD" e il link del gruppo.
3. Accetta le richieste di ingresso: ogni tester riceve il messaggio per darti l'accesso da coach e lo accetta.
4. Quando vuoi: `node raccogli-tester.js`. Il riepilogo dice chi ha dati incompleti e cosa chiedergli.

- `sincronizza-app.js` — copia nell'app i blocchi condivisi (verifiche, generatore, profilo dai dati), così il codice esiste in un solo posto. Esegui dopo ogni modifica: `node sincronizza-app.js` (con `--controlla` dice solo se l'app è allineata).

- `test-carburante.js` — il motore del Carburante su 4 profili × 6 tipi di giorno × vigilia × pesate (192 scenari): 7 limiti di sicurezza per scenario, carico pre-gara, metabolismo di riferimento, e confronto con `carburante-atteso.json` (aggiornalo con `--salva` quando cambi le regole apposta). Esegui: `node test-carburante.js`.
- `test-calorie-adattive.js` — il filtro delle calorie che imparano su dati simulati. Esegui: `node test-calorie-adattive.js`.
- `sincronizza-app.js` ora scrive i blocchi nei file di `../02_App_iPhone/src/` e poi ricostruisce l'app da solo.

Serve Node.js (sul Mac: `brew install node`). Nessuna libreria esterna.

## Regole aggiunte il 9 ottobre (app 4.1)
- **Sport scelti** (`sport.discipline`): uno, due o tre. Gare per sport: 5k, 10k, mezza, maratona, mediofondo, granfondo, nuoto-3k, nuoto-10k, duathlon-sprint, duathlon, aquathlon, più i quattro triathlon. Chi fa un solo sport: da 3 a 6 sedute (4 se la fitness è sotto 20), due qualità in costruzione e picco se la fitness è almeno 30, uscite facili mai più lunghe del lungo, sempre un giorno di riposo. I profili senza `discipline` (triathlon della prima versione) danno lo stesso piano di prima.
- **Ore indicate** (`disponibilita.oreDichiarate`): il piano parte almeno dal 75%; il limite di crescita della fitness (≤ 6 a settimana) resta e ora è garantito.
- **Trail**: una corsa lenta conta come corsa se il GAP o i battiti lo dicono.
- **CSS da misurare** (`test.css`): test 400 + 200 nella prima settimana.
- **Nomi e passi** delle sedute accorciate o allungate rifatti sulla durata finale (prima 37 sedute su 644 avevano nome e passi della durata vecchia).

## Stato
47 profili × 26 controlli: 0 violazioni; soglie 20/20, verifiche 25/25; nell'app 208 controlli di flusso completi superati. In precedenza i test hanno trovato e fatto correggere 6 difetti (dettagli nel report). Il confronto con i dati reali del 9 ottobre ha aggiunto la regola del rientro (lungo da 50' dopo una pausa) e l'esclusione di gare e uscite camminate dal calcolo del lungo tipico. La verifica su utenti di prova ha aggiunto due regole: ogni sport mantiene almeno l'85% dei minuti abituali, e il lungo di corsa abituale non si accorcia per far posto a nuoto e bici (prima un runner da 60' riceveva lunghi da 30').
