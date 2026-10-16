// Test delle calorie che imparano (filtro di Kalman del Carburante) su dati simulati.
// Uso: node test-calorie-adattive.js [percorso dell'app]   — senza percorso usa ../02_App_iPhone/HUD-70.3.js
(async () => {
  const fs = require("fs");
  let src = fs.readFileSync(process.argv[2] || require("path").join(__dirname, "../02_App_iPhone/HUD-70.3.js"), "utf8"); src = src.slice(0, src.lastIndexOf('if (typeof Script !== "undefined")')) + "\nreturn { calorieAdattive, ymd, addDays, parseYMD };";
  const M = await new (Object.getPrototypeOf(async function () {}).constructor)(src)();
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const oggi = "2026-10-16";
  function caso(scartoVero, { giorniCibo = 42, pesateOgni = 1, outlier = false, sdRumore = 0.5 } = {}) {
    const pesi = [], mangiato = {}, stimato = {};
    let w = 91;
    for (let i = 42; i >= 0; i--) {
      const d = M.ymd(M.addDays(M.parseYMD(oggi), -i));
      const st = 3200 + (i % 7 === 0 ? 800 : i % 3 === 0 ? 400 : 0); // stima dell'app variabile con l'allenamento
      const mg = st - 500 + gauss() * 150;
      if (i > 0) { stimato[d] = st; if (42 - i < giorniCibo) mangiato[d] = mg; }
      if (i % pesateOgni === 0) pesi.push({ d, v: +(w + gauss() * sdRumore + (outlier && i === 10 ? 4 : 0)).toFixed(1) });
      if (i > 0) w += (mg - (st + scartoVero)) / 7700;
    }
    return M.calorieAdattive(pesi, mangiato, stimato, oggi, {});
  }
  const casi = [
    ["consumi veri +300 rispetto alla stima", caso(300), (r) => r.attivo && Math.abs(r.scarto - 300) <= 120 && r.correzione > 150],
    ["consumi veri −200", caso(-200), (r) => r.attivo && Math.abs(r.scarto + 200) <= 120],
    ["stima giusta", caso(0), (r) => r.attivo && Math.abs(r.scarto) <= 120],
    ["consumi veri +600: correzione fermata a 300", caso(600), (r) => r.attivo && r.correzione === 300],
    ["solo 8 giorni di cibo: non si attiva", caso(300, { giorniCibo: 8 }), (r) => !r.attivo && r.correzione === 0],
    ["pesate ogni 6 giorni: non si attiva", caso(300, { pesateOgni: 6 }), (r) => !r.attivo],
    ["una pesata sbagliata di +4 kg", caso(300, { outlier: true }), (r) => r.attivo && Math.abs(r.scarto - 300) <= 150 && r.scartate >= 1],
    ["nessuna pesata", M.calorieAdattive([], {}, {}, oggi, {}), (r) => !r.attivo],
  ];
  let ko = 0;
  for (const [n, r, ok] of casi) { const v = ok(r); if (!v) ko++; console.log(v ? "OK " : "KO ", n.padEnd(46), JSON.stringify({ attivo: r.attivo, scarto: r.scarto, corr: r.correzione, sd: r.sd, pesate: r.pesate, cibo: r.giorniCibo })); }
  console.log(ko ? ko + " casi falliti" : "tutti i casi corretti"); process.exit(ko ? 1 : 0);
})();
