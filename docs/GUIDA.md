# Guida d'uso

## Prima installazione
1. Installa **Scriptable** dall'App Store.
2. Apri `HUD-70.3.js` sull'iPhone › Condividi › Scriptable (oppure crea uno script e incolla il contenuto).
3. Intervals.icu › Settings › Developer Settings › genera la **API Key**.
4. Avvia lo script e incolla la chiave: resta nel Portachiavi dell'iPhone.

## Aggiornare
Apri lo script in Scriptable › seleziona tutto › incolla il nuovo contenuto › Fine. Chiave, diario e widget restano.

## L'impronta (il segno ricorrente)
Ogni seduta è una fila di capsule: larga quanto il tempo, alta quanto l'intensità. Il **contorno** è il piano, il **pieno** è quello che hai fatto; l'**arancio** compare solo sopra soglia.
- Al mattino l'impronta di oggi è vuota ("Da riempire"); se la seduta va adattata il contorno si abbassa e si accorcia.
- Dopo l'allenamento si riempie e mostra la percentuale di esecuzione.
- Il pieno è stimato da durata e carico rispetto al piano: senza i dati secondo per secondo non segue ogni singola ripetuta.

## Le schede
- **Oggi**: prontezza con il verdetto, impronta del giorno, sonno, HRV, FC a riposo e forma; il carburante si apre dalla riga dedicata. Sotto: check-in e i dettagli di forma, sonno, cuore.
- **Settimana**: la trama (un'impronta per giorno, piena se fatta), poi impatto della corsa, giorno per giorno con i passi, revisione.
- **Stagione**: il nastro delle ultime 11 settimane, questa e la prossima, con la capsula arancio della gara; poi fitness, traiettoria e durabilità.
- Chiaro o scuro segue l'impostazione dell'iPhone.
- **Tasto i**: accanto ai titoli e nell'angolo dei riquadri principali (prontezza, impronta, sonno, HRV, FC a riposo, forma, trama, nastro, impatto, durabilità…). Toccalo per una spiegazione breve di cosa vuol dire il dato e come leggerlo.
- **Dettaglio della seduta**: in Settimana ogni riga della trama e ogni seduta di "Giorno per giorno" si tocca. Si apre un pannello con l'impronta, il piano (durata, distanza, carico), quello che hai fatto, il voto di esecuzione con gli avvisi e i passi con passo e battiti. Anche "Vedi i passi" nella scheda Oggi apre lo stesso pannello.

## Widget
- Home: widget Scriptable piccolo, medio o grande › Modifica widget › Script "HUD 70.3". Chiari o scuri come l'iPhone.
  - **Piccolo**: prontezza e verdetto, impronta di oggi, sonno, HRV e forma.
  - **Medio**: in più la seduta con la percentuale quando è fatta, le kcal e tre riquadri.
  - **Grande**: verdetto, sonno, HRV e FC a riposo rispetto alla media, forma, impronta di oggi con kcal e carboidrati, la settimana a capsule (piene le fatte, contorno le future).
- Schermata di blocco: widget Scriptable rettangolare, circolare o in linea, stesso script.

## Siri
App Comandi › nuovo comando "Come sto?" › azione Esegui script › HUD 70.3.

## Versione da PC
Ogni volta che apri l'HUD, i dati vengono salvati in **iCloud Drive › Scriptable › hud-dati.json**. Trascina quel file in `03_Versione_PC/HUD-Analisi.html`.

## Impostazioni
- Dall'app: icona delle impostazioni in alto a destra (gara, giorni, ore, sport, corpo) e "Invia un commento".
- Nel file `hud-profilo.json`: `soglie` (lthr, fcMax, passoSoglia, css, ftp, sogliaFCBici) per fissare le soglie dopo un test; `config` per le impostazioni avanzate (`scalaLungo`, `palestra`, `nutrizione` con un piano personale, `notifiche`, `riegelK`).
- Nel codice si può impostare `feedbackEmail`, l'indirizzo a cui arrivano i commenti dal pulsante "Invia un commento".

## Condividere
Pulsante Condividi in alto (o "Condividi" sull'impronta riempita). Tutte le immagini sono storie 1080×1920 con lo stesso carattere (SF Pro) e la stessa firma: l'impronta in fondo.
- **Immagine**: Attività (percorso o frequenza cardiaca, nome, cifre e l'impronta della seduta), Giornata (prontezza e impronta di oggi), Settimana (sette impronte), Gara (conto alla rovescia e nastro della stagione; senza gara diventa Stagione).
- **Fondo**: Nero, Bianco o Sticker (trasparente, da incollare su una tua foto nelle storie).
- **Copia / Condividi**: PNG. **Video**: l'impronta si riempie in 3 secondi e i numeri salgono.
