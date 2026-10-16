// Test della verifica automatica del profilo su utenti di prova.
// Uso: node test-verifiche.js   (opzionale: percorso di un'esportazione reale hud-dati.json)
const fs = require("fs");
const path = require("path");
const { verificaProfilo } = require("./verifiche.js");

const NOW = new Date(2026, 9, 9, 10);
const g = (n) => { const d = new Date(NOW); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) + "T07:00:00"; };
const CFG = { corsa: { lthr: 170, fcMax: 190, passoSoglia: "5:00" }, nuoto: { css: "1:50" }, bici: { ftp: 230 } };

// Utente "in regola": 10 settimane regolari, soglie coerenti, notti complete
function base() {
  const activities = [], wellness = [];
  for (let k = 0; k < 70; k++) {
    const dow = (NOW.getDay() - k + 70) % 7;
    if (dow === 2 || dow === 4) activities.push({ start_date_local: g(k), type: "Run", name: "Corsa facile", moving_time: 2700, average_heartrate: 140, max_heartrate: 160, average_speed: 2.9, lthr: 170, threshold_pace: 3.333, interval_summary: ["1x 45m 140bpm"] });
    if (dow === 0) activities.push({ start_date_local: g(k), type: "Run", name: "Lungo", moving_time: 5400, average_heartrate: 145, max_heartrate: 165, average_speed: 2.8, lthr: 170, threshold_pace: 3.333, interval_summary: ["1x 90m 145bpm"] });
    if (dow === 1 || dow === 5) activities.push({ start_date_local: g(k), type: "Swim", name: "Nuoto", moving_time: 2400, threshold_pace: 100 / 110, interval_summary: ["4x 200m 1:58", "4x 50m 2:05"] });
    if (dow === 6) activities.push({ start_date_local: g(k), type: "Ride", name: "Bici", moving_time: 5400, device_watts: true, icu_average_watts: 160, icu_ftp: 230, icu_rolling_ftp: 232, max_heartrate: 158, interval_summary: ["1x 90m 160w"] });
    wellness.push({ id: g(k).slice(0, 10), hrv: 55, sleepSecs: 27000 });
  }
  return { activities, wellness };
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const casi = [
  ["In regola", (r) => r, CFG, []],
  ["CSS vecchio", (r) => { r.activities.push({ start_date_local: g(1), type: "Swim", name: "Nuoto", moving_time: 2400, threshold_pace: 100 / 110, interval_summary: ["1x 400m 1:42", "4x 100m 1:45"] }); return r; }, CFG, ["css"]],
  ["Test CSS fatto: valore esatto", (r) => { r.activities.push({ start_date_local: g(0), type: "Swim", name: "Test CSS 400 + 200", moving_time: 2400, threshold_pace: 100 / 110, interval_summary: ["1x 400m 1:40", "1x 200m 1:35", "4x 50m 2:10"] }); return r; }, CFG, ["css"]],
  ["CSS: un solo 200 veloce non basta", (r) => { r.activities.push({ start_date_local: g(1), type: "Swim", name: "Nuoto", moving_time: 2400, threshold_pace: 100 / 110, interval_summary: ["1x 200m 1:42"] }); return r; }, CFG, []],
  ["Soglia FC bassa", (r) => { r.activities.push({ start_date_local: g(2), type: "Run", name: "Corsa", moving_time: 3000, average_heartrate: 168, max_heartrate: 183, lthr: 170, threshold_pace: 3.333, interval_summary: ["1x 10m 150bpm", "1x 30m 179bpm"] }); return r; }, CFG, ["lthr"]],
  ["FC massima superata", (r) => { r.activities[0].max_heartrate = 194; r.activities[2].max_heartrate = 196; return r; }, CFG, ["fcmax"]],
  ["Potenza senza FTP", (r) => { r.activities.forEach((a) => { if (a.type === "Ride") { a.icu_ftp = null; a.icu_rolling_ftp = null; } }); return r; }, { ...CFG, bici: { ftp: null } }, ["ftp"]],
  ["FTP superata dalla stima", (r) => { r.activities.forEach((a) => { if (a.type === "Ride") a.icu_rolling_ftp = 255; }); return r; }, CFG, ["ftp"]],
  ["Bici senza potenza", (r) => { r.activities.forEach((a) => { if (a.type === "Ride") { a.device_watts = false; a.icu_average_watts = null; a.icu_ftp = null; a.icu_rolling_ftp = null; a.interval_summary = ["1x 90m 130bpm"]; } }); return r; }, { ...CFG, bici: { ftp: null, daVerificare: true } }, ["bici-fc"]],
  ["Gara non segnata", (r) => { r.activities.push({ start_date_local: g(20), type: "Run", name: "Mezza di Firenze", moving_time: 6000, average_speed: 3.4 }); return r; }, CFG, ["gare"]],
  ["Nomi da allenamento, non gare", (r) => { r.activities.push({ start_date_local: g(20), type: "Run", name: "Ritmo gara mezza 3x10'", moving_time: 3000, average_speed: 3.3 }, { start_date_local: g(21), type: "TrailRun", name: "Genova Trail Running", moving_time: 5000, average_speed: 2.2 }); return r; }, CFG, []],
  ["Gara già segnata", (r) => { r.activities.push({ start_date_local: g(20), type: "Run", name: "Mezza di Firenze", moving_time: 6000, average_speed: 3.4, race: true }); return r; }, CFG, []],
  ["Notti mancanti", (r) => { r.wellness.slice(0, 14).forEach((w, i) => { if (i % 2) w.hrv = null; }); return r; }, CFG, ["notti"]],
  ["Rientro dopo 3 settimane senza corsa", (r) => { r.activities = r.activities.filter((a) => a.type !== "Run" || a.start_date_local < g(21)); return r; }, CFG, ["rientro"]],
  ["Settimane irregolari", (r) => { r.activities = r.activities.filter((a) => !((a.start_date_local >= g(30) && a.start_date_local < g(13)))); return r; }, CFG, ["continuita"]],
  ["Soglie app ≠ Intervals", (r) => r, { ...CFG, corsa: { lthr: 162, fcMax: 190, passoSoglia: "5:30" }, nuoto: { css: "1:58" } }, ["css-diverso", "lthr-diverso", "passo-diverso"]],
  ["Nessun dato", () => ({ activities: [], wellness: [] }), CFG, []],
  ["Solo corsa, niente nuoto e bici", (r) => { r.activities = r.activities.filter((a) => a.type === "Run"); return r; }, { corsa: CFG.corsa }, []],
  ["Solo trail lenti ma corsi (GAP): nessun rientro", (r) => { r.activities = r.activities.filter((a) => a.type !== "Run"); for (const k of [2, 5, 9, 12]) r.activities.push({ start_date_local: g(k), type: "TrailRun", name: "Trail", moving_time: 7200, average_speed: 1.9, gap: 2.45, average_heartrate: 168, lthr: 170 }); return r; }, CFG, []],
  ["Escursioni lente e a battiti bassi: rientro", (r) => { r.activities = r.activities.filter((a) => a.type !== "Run"); for (const k of [2, 5, 9, 12]) r.activities.push({ start_date_local: g(k), type: "TrailRun", name: "Escursione", moving_time: 7200, average_speed: 1.4, gap: 1.9, average_heartrate: 120, lthr: 170 }); return r; }, CFG, ["rientro"]],
  ["Soglie automatiche con la FC massima fissata: resta solo quel suggerimento", (r) => { r.activities[0].max_heartrate = 194; r.activities[2].max_heartrate = 196; return r; }, { ...CFG, soglieAutomatiche: true, soglieFissate: ["fcMax"] }, ["fcmax"]],
  ["Soglie automatiche: niente suggerimenti di soglia", (r) => { r.activities[0].max_heartrate = 194; r.activities[2].max_heartrate = 196; return r; }, { ...CFG, soglieAutomatiche: true }, []],
  ["Ciclista che non corre: nessun rientro", (r) => { r.activities = r.activities.filter((a) => a.type === "Ride"); return r; }, { ...CFG, sport: ["bici"] }, []],
  ["Nuotatore che non corre: nessun rientro", (r) => { r.activities = r.activities.filter((a) => a.type === "Swim"); return r; }, { ...CFG, sport: ["nuoto"] }, []],
  ["Runner fermo da 3 settimane (solo corsa)", (r) => { r.activities = r.activities.filter((a) => a.type === "Run" && a.start_date_local < g(21)); return r; }, { ...CFG, sport: ["corsa"] }, ["continuita", "rientro"]],
];

let ok = 0, ko = 0;
const righe = [];
for (const [nome, f, cfg, attese] of casi) {
  const r = verificaProfilo(f(clone(base())), cfg, NOW);
  const k = r.map((x) => x.k).sort(), a = attese.slice().sort();
  const pass = JSON.stringify(k) === JSON.stringify(a);
  pass ? ok++ : ko++;
  righe.push(`${pass ? "ok " : "NO "} ${nome.padEnd(40)} attese [${a.join(", ")}]  trovate [${k.join(", ")}]`);
}
console.log(righe.join("\n"));
console.log(`\n${ok}/${casi.length} casi corretti`);

// Il blocco nell'app deve essere identico a questo file
const blk = (s) => s.slice(s.indexOf("// >>> VERIFICHE"), s.indexOf("// <<< VERIFICHE"));
const app = ["/home/claude/HUD-70.3.js", path.join(__dirname, "../02_App_iPhone/HUD-70.3.js")].find((p) => fs.existsSync(p));
if (app) {
  const same = blk(fs.readFileSync(app, "utf8")) === blk(fs.readFileSync(path.join(__dirname, "verifiche.js"), "utf8"));
  console.log(same ? "Blocco nell'app: identico" : "Blocco nell'app: DIVERSO, ricopialo");
  if (!same) ko++;
}

const reale = process.argv[2];
if (reale && fs.existsSync(reale)) {
  const d = JSON.parse(fs.readFileSync(reale, "utf8"));
  console.log("\nDati reali:");
  for (const x of verificaProfilo(d.raw, d.config, NOW)) console.log(`- [${x.liv}] ${x.titolo}: ${x.testo} → ${x.azione}`);
}
process.exit(ko ? 1 : 0);
