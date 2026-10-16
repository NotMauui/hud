# HUD sul computer

Apri **`HUD-PC.html`** con Chrome o Safari: è la stessa app dell'iPhone (stesse schede, stessi numeri) con un'impaginazione da schermo grande, schede a sinistra e fogli al centro.

## I dati
- La prima volta scegli (o trascina nella pagina) **`hud-dati.json`** da iCloud Drive › Scriptable. L'iPhone lo riscrive quando apri l'HUD (al massimo ogni mezz'ora).
- La pagina ricorda l'ultima copia: riaprendola i dati ci sono già.
- **Aggiorna i dati**, in basso a sinistra, rilegge il file. Su Chrome basta un clic (al primo chiede il permesso); su Safari si sceglie di nuovo il file.
- I dati restano sul computer: la pagina non li manda da nessuna parte.

## Cosa si fa e cosa no
- Si guarda tutto: Oggi, Piano (con palestra e mobilità), Attività, Corpo, Progressi, dettagli e spiegazioni.
- Grafici e percorsi delle attività arrivano dal file (ultime tre settimane), dalla versione 0.6 dell'app sull'iPhone in poi.
- Le cose che scrivono (peso, cibo, sedute su Intervals, infortunio applicato) si fanno dall'iPhone: qui la pagina lo dice.

## Per rifarla
`node crea-hud-pc.js` ricostruisce `HUD-PC.html` dallo script in `02_App_iPhone/HUD-70.3.js` e dai file in `src/` (`template-pc.html`, `pc-hud.js`).

## La vecchia analisi
`HUD-Analisi.html` (9 ottobre) resta per le analisi lunghe: carico per settimana, 80/20, predittori. Usa il motore di allora.
