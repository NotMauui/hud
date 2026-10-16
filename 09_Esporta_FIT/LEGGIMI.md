# Esporta FIT · sedute di nuoto per Garmin

Trasforma le sedute di nuoto dell'HUD in file FIT di allenamento, con l'SDK FIT ufficiale di Garmin (`@garmin/fitsdk`). Serve perché Intervals non porta sull'orologio stili, esercizi di tecnica e attrezzatura del nuoto, e il programma sviluppatori Garmin oggi non accetta nuove app.

- `esporta-fit.js` — crea i file in `fit/`.
  - `node esporta-fit.js` → una seduta d'esempio per tipo (tecnica, lungo, soglia 10×100, ritmo 8×200, test CSS).
  - `node esporta-fit.js --blocco` → le sedute di nuoto del prossimo blocco di 4 settimane (profilo `reale` di `04_Generatore/profili.js`; un altro profilo: `--blocco nome`).
  - `--vasca 50` per la vasca olimpica (predefinita 25 m).
- `test-fit.js` — 60 sedute esportate e rilette con il decoder ufficiale: passi, ripetute e durate devono coincidere con l'HUD. Esegui: `node test-fit.js`.

Come sono fatti i passi: riscaldamento e defaticamento come tali, i passi con i metri nel nome ("100 a CSS", "200 a CSS +3\"") a distanza, gli altri a tempo, i recuperi come riposo, le ripetute come blocchi da ripetere. L'intensità (CSS, CSS +8", facile) è nelle note del passo.

## Metterli sull'orologio (da provare)
1. Collega l'orologio al Mac con il cavo. Sui Garmin recenti come l'Enduro 3 serve un programma per i dispositivi MTP, per esempio OpenMTP (gratuito).
2. Copia il file `.fit` nella cartella `GARMIN/NewFiles` dell'orologio.
3. Scollega: l'orologio importa l'allenamento e lo mostra tra gli allenamenti salvati.

Non è stato ancora provato su un orologio vero: verifica che i nomi dei passi e le ripetute compaiano come ti aspetti. La licenza dell'SDK Garmin è gratuita ma proprietaria (Garmin FIT Protocol License): va bene per uso personale; prima di inserirla in un'app a pagamento rileggine i termini.
