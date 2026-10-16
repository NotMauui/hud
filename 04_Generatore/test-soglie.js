// Test della stima delle soglie su utenti di prova (e, se c'è, sull'esportazione reale).
// Uso: node test-soglie.js [hud-dati.json]
const fs = require("fs");
const path = require("path");
const { stimaSoglie } = require("./soglie.js");

const NOW = new Date(2026, 9, 9, 10);
const g = (n) => { const d = new Date(NOW); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) + "T07:00:00"; };
const corsa = (n, min, hr, v, extra = {}) => ({ start_date_local: g(n), type: "Run", name: "Corsa", moving_time: min * 60, average_heartrate: hr, max_heartrate: hr + 8, average_speed: v, ...extra });
const pace = (mmss) => { const [m, s] = mmss.split(":").map(Number); return 1000 / (m * 60 + s); };
const facili = (n0, k, hr0 = 150) => Array.from({ length: k }, (_, i) => corsa(n0 + i * 3, 45 + (i % 3) * 10, hr0 + (i % 4) * 4, pace("6:10") + (i % 4) * 0.08));
const ATT_DEF = { corsa: { lthr: 186, max_hr: 205, threshold_pace: null }, bici: { lthr: 186, max_hr: 205, ftp: 250 }, nuoto: { threshold_pace: 100 / 120 } };

const casi = [
  ["Tipo Tester B: corse dure, niente nuoto, passo soglia vuoto", { activities: [corsa(27, 49, 193, pace("5:03"), { gap: pace("4:59"), max_heartrate: 195 }), corsa(59, 32, 194, pace("5:27"), { gap: pace("5:22"), max_heartrate: 196 }), ...facili(3, 10, 160), { start_date_local: g(4), type: "Ride", name: "Giro", moving_time: 7140, average_heartrate: 155, max_heartrate: 170 }] }, ATT_DEF,
    (r) => [r.cambi.find((c) => c.campo === "lthr" && c.tipo === "Run" && c.a >= 189 && c.a <= 193), r.cambi.find((c) => c.campo === "threshold_pace" && c.tipo === "Run" && Math.abs(1000 / c.a - 303) <= 6), !r.cambi.some((c) => c.tipo === "Swim" || c.campo === "ftp"), r.nuoto.daMisurare, r.corsa.passo.aff === "alta"]],
  ["Soglie già giuste: nessun cambio", { activities: [corsa(10, 40, 171, pace("5:20")), ...facili(2, 8, 145)] }, { corsa: { lthr: 173, max_hr: 197, threshold_pace: pace("5:15") }, bici: { lthr: 162, max_hr: 197 }, nuoto: { threshold_pace: 100 / 108 } },
    (r) => [r.cambi.length === 0]],
  ["Solo corse facili: passo dalla retta passo–battiti", { activities: Array.from({ length: 10 }, (_, i) => corsa(2 + i * 4, 50, 135 + i * 2.5, pace("6:40") + i * 0.07)) }, { corsa: { lthr: 172, max_hr: 190, threshold_pace: null } },
    (r) => [r.corsa.passo && r.corsa.passo.fonte === "stima" && 1000 / r.corsa.passo.v < 330 && 1000 / r.corsa.passo.v > 240, r.cambi.some((c) => c.campo === "threshold_pace"), !r.cambi.some((c) => c.campo === "lthr")]],
  ["Soglia FC più bassa nelle uscite: non si abbassa", { activities: [corsa(5, 40, 160, pace("5:30")), corsa(12, 45, 158, pace("5:35"))] }, { corsa: { lthr: 175, max_hr: 190, threshold_pace: pace("5:10") } },
    (r) => [!r.cambi.some((c) => c.campo === "lthr" || c.campo === "threshold_pace")]],
  ["Picco isolato del sensore: FC massima invariata", { activities: [corsa(3, 40, 170, 3, { max_heartrate: 231 }), corsa(6, 40, 168, 3, { max_heartrate: 214 }), corsa(9, 40, 169, 3, { max_heartrate: 188 }), corsa(12, 40, 167, 3, { max_heartrate: 187 })] }, { corsa: { lthr: 175, max_hr: 192, threshold_pace: 3 } },
    (r) => [!r.cambi.some((c) => c.campo === "max_hr")]],
  ["FC massima superata più volte", { activities: [corsa(3, 40, 170, 3, { max_heartrate: 199 }), corsa(6, 40, 168, 3, { max_heartrate: 198 })] }, { corsa: { lthr: 175, max_hr: 192, threshold_pace: 3 } },
    (r) => [r.cambi.some((c) => c.campo === "max_hr" && c.a === 198)]],
  ["Test CSS 400 + 200", { activities: [{ start_date_local: g(4), type: "Swim", name: "Test CSS", moving_time: 2400, distance: 1600, interval_summary: ["1x 400m 1:40", "1x 200m 1:35"] }] }, { nuoto: { threshold_pace: 100 / 120 } },
    (r) => [r.cambi.some((c) => c.tipo === "Swim" && Math.round(100 / c.a) === 105), r.nuoto.css.aff === "alta"]],
  ["Ripetute lunghe di nuoto con il CSS di partenza", { activities: [{ start_date_local: g(4), type: "Swim", name: "Piscina", moving_time: 3000, distance: 2400, interval_summary: ["4x 400m 1:50", "4x 50m 2:05"] }] }, { nuoto: { threshold_pace: 100 / 120 } },
    (r) => [r.cambi.some((c) => c.tipo === "Swim" && Math.round(100 / c.a) === 113)]],
  ["Nuotate continue, nessun giro: stima prudente", { activities: [{ start_date_local: g(4), type: "Swim", name: "Piscina", moving_time: 2100, distance: 1500 }] }, { nuoto: { threshold_pace: 100 / 120 } },
    (r) => [r.cambi.some((c) => c.tipo === "Swim" && Math.round(100 / c.a) === 135), r.nuoto.css.aff === "bassa"]],
  ["Ciclista con potenza: FTP dalla stima di Intervals", { activities: [1, 4, 8].map((n) => ({ start_date_local: g(n), type: "Ride", name: "Bici", moving_time: 3600, device_watts: true, icu_average_watts: 190, icu_rolling_ftp: 268, average_heartrate: 150 })) }, { bici: { lthr: 165, max_hr: 190, ftp: 250 } },
    (r) => [r.cambi.some((c) => c.campo === "ftp" && c.a === 268), !r.cambi.some((c) => c.tipo === "Run")]],
  ["Bici senza potenza: FTP non toccata", { activities: [1, 4, 8].map((n) => ({ start_date_local: g(n), type: "Ride", name: "Bici", moving_time: 3600, average_heartrate: 150, icu_ftp: 250 })) }, { bici: { lthr: 165, max_hr: 190, ftp: 250 } },
    (r) => [!r.cambi.some((c) => c.campo === "ftp"), r.bici.ftp === null]],
  ["Trail lento ma duro: il GAP conta", { activities: [corsa(5, 60, 182, 2.0, { gap: pace("5:10") }), corsa(9, 55, 181, 2.1, { gap: pace("5:15") })] }, { corsa: { lthr: 180, max_hr: 198, threshold_pace: null } },
    (r) => [r.cambi.some((c) => c.campo === "threshold_pace" && Math.abs(1000 / c.a - 310) <= 8)]],
  ["Corse sul tapis escluse dal passo", { activities: [corsa(5, 40, 178, 3.8, { trainer: true }), corsa(9, 45, 177, 3.7, { type: "VirtualRun" })] }, { corsa: { lthr: 180, max_hr: 198, threshold_pace: null } },
    (r) => [!r.cambi.some((c) => c.campo === "threshold_pace")]],
  ["Nessun dato", { activities: [] }, {}, (r) => [r.cambi.length === 0, r.corsa.lthr === null]],
  // casi trovati dalla revisione indipendente
  ["Senza impostazioni e solo corse facili: nulla di inventato", { activities: Array.from({ length: 8 }, (_, i) => corsa(2 + i * 3, 45, 140 + (i % 3) * 3, pace("6:20"), { max_heartrate: 150 + (i % 2) * 2 })) }, {},
    (r) => [!r.cambi.some((c) => ["max_hr", "lthr"].includes(c.campo))]],
  ["Test CSS con un 400 di riscaldamento: vale il più veloce", { activities: [{ start_date_local: g(4), type: "Swim", name: "Test CSS", moving_time: 2400, distance: 1600, interval_summary: ["1x 400m 2:10", "1x 400m 1:40", "1x 200m 1:35"] }] }, { nuoto: { threshold_pace: 100 / 100 } },
    (r) => [r.cambi.some((c) => c.tipo === "Swim" && Math.round(100 / c.a) === 105)]],
  ["Sensore agganciato alla cadenza: battiti alti a passo facile non alzano la soglia", { activities: [...Array.from({ length: 8 }, (_, i) => corsa(2 + i * 3, 45, 145, pace("6:00"))), corsa(5, 45, 185, pace("6:05"), { max_heartrate: 199 }), corsa(8, 50, 184, pace("6:02"), { max_heartrate: 197 })] }, { corsa: { lthr: 165, max_hr: 180, threshold_pace: pace("5:00") } },
    (r) => [!r.cambi.some((c) => c.campo === "lthr")]],
  ["FTP da una sola uscita: non si usa", { activities: [1, 4].map((n) => ({ start_date_local: g(n), type: "Ride", name: "Bici", moving_time: 3600, device_watts: true, icu_average_watts: 190, icu_pm_ftp_watts: 380 })) }, { bici: { lthr: 165, max_hr: 190, ftp: 250 } },
    (r) => [!r.cambi.some((c) => c.campo === "ftp")]],
  ["Passo soglia memorizzato male (s/km al posto di m/s): trattato come mancante", { activities: [corsa(5, 40, 178, pace("4:50"), { gap: pace("4:48") }), corsa(9, 45, 176, pace("4:55"))] }, { corsa: { lthr: 175, max_hr: 195, threshold_pace: 270 } },
    (r) => [r.cambi.some((c) => c.campo === "threshold_pace" && c.a < 7)]],
  ["La soglia sale al massimo di 8 bpm per volta", { activities: [corsa(5, 40, 190, pace("4:30"), { name: "Gara 10k", race: true }), corsa(9, 45, 189, pace("4:35"), { name: "Test 30" })] }, { corsa: { lthr: 170, max_hr: 200, threshold_pace: pace("5:00") } },
    (r) => [r.cambi.some((c) => c.campo === "lthr" && c.a === 178)]],
  // 1.7: conferma prima di cambiare un valore già impostato, velocità critica, CSS da più distanze
  ["Un solo sforzo più veloce: il passo impostato non cambia finché non c'è conferma", { activities: [corsa(5, 40, 178, pace("4:40")), ...facili(3, 9, 150)] }, { corsa: { lthr: 180, max_hr: 198, threshold_pace: pace("5:00") } },
    (r) => [!r.cambi.some((c) => c.campo === "threshold_pace"), r.corsa.passo && r.corsa.passo.confermato === false]],
  ["Due sforzi simili più veloci: il passo si aggiorna", { activities: [corsa(5, 40, 178, pace("4:40")), corsa(12, 42, 179, pace("4:42"))] }, { corsa: { lthr: 180, max_hr: 198, threshold_pace: pace("5:00") } },
    (r) => [r.cambi.some((c) => c.campo === "threshold_pace" && 1000 / c.a < 290)]],
  ["Solo prove brevi a tutta (4', 8', 14'): passo dalla velocità critica", { activities: [[4, 1110], [8, 2070], [14, 3510]].map(([m, d], i) => corsa(3 + i * 6, m, 184, d / (m * 60), { distance: d, name: "Prova " + m })) }, { corsa: { lthr: 180, max_hr: 198, threshold_pace: null } },
    (r) => [r.cambi.some((c) => c.campo === "threshold_pace" && Math.abs(1000 / c.a - 258) <= 4)]],
  ["CSS da quattro distanze a tutta", { activities: [[100, 75], [200, 158], [400, 325], [800, 664]].map(([d, t], i) => ({ start_date_local: g(3 + i * 5), type: "Swim", name: "Test " + d, moving_time: t + 600, distance: d + 600, interval_summary: ["1x " + d + "m " + Math.floor(t * 100 / d / 60) + ":" + String(Math.round(t * 100 / d) % 60).padStart(2, "0")] })) }, { nuoto: { threshold_pace: 100 / 120 } },
    (r) => [r.nuoto.css && Math.abs(100 / r.nuoto.css.v - 84) <= 2, r.nuoto.css.aff === "alta", r.cambi.some((c) => c.tipo === "Swim")]],

];

let ok = 0, ko = 0;
for (const [nome, raw, att, attese] of casi) {
  let r, esito;
  try { r = stimaSoglie(raw, NOW, att); esito = attese(r); } catch (e) { esito = [false]; r = { errore: e.stack }; }
  const pass = esito.every(Boolean);
  pass ? ok++ : ko++;
  console.log(`${pass ? "ok " : "NO "} ${nome.padEnd(58)} ${pass ? "" : JSON.stringify(esito) + " " + JSON.stringify(r.cambi || r)}`);
}
console.log(`\n${ok}/${casi.length} casi corretti`);

// Il blocco nell'app deve essere identico a questo file
const blk = (s) => s.slice(s.indexOf("// >>> SOGLIE"), s.indexOf("// <<< SOGLIE"));
const app = ["/home/claude/HUD-70.3.js", path.join(__dirname, "../02_App_iPhone/HUD-70.3.js")].find((p) => fs.existsSync(p) && fs.readFileSync(p, "utf8").includes("// >>> SOGLIE"));
if (app) {
  const same = blk(fs.readFileSync(app, "utf8")) === blk(fs.readFileSync(path.join(__dirname, "soglie.js"), "utf8"));
  console.log(same ? "Blocco nell'app: identico" : "Blocco nell'app: DIVERSO, esegui node sincronizza-app.js");
  if (!same) ko++;
}

const reale = process.argv[2];
if (reale && fs.existsSync(reale)) {
  const d = JSON.parse(fs.readFileSync(reale, "utf8"));
  const ultima = (sp) => (d.raw.activities || []).filter((a) => sp.test(a.type || "")).sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))[0] || {};
  const r0 = ultima(/run/i), s0 = ultima(/swim/i), b0 = ultima(/ride/i);
  const att = { corsa: { lthr: r0.lthr, max_hr: r0.athlete_max_hr, threshold_pace: r0.threshold_pace }, bici: { lthr: b0.lthr, max_hr: b0.athlete_max_hr, ftp: b0.icu_ftp }, nuoto: { threshold_pace: s0.threshold_pace } };
  const r = stimaSoglie(d.raw, NOW, att);
  console.log("\nDati reali (impostazioni lette dalle ultime attività):", JSON.stringify(att));
  for (const k of ["fcMax"]) console.log(`- FC massima: ${r.fcMax && r.fcMax.v} (${r.fcMax && r.fcMax.perche})`);
  console.log(`- soglia FC corsa: ${r.corsa.lthr && r.corsa.lthr.v} (${r.corsa.lthr && r.corsa.lthr.perche})`);
  console.log(`- passo soglia: ${r.corsa.passo ? (1000 / r.corsa.passo.v / 60).toFixed(2) : "—"} min/km (${r.corsa.passo && r.corsa.passo.perche})`);
  console.log(`- CSS: ${r.nuoto.css ? (100 / r.nuoto.css.v).toFixed(0) : "—"} s/100 m (${r.nuoto.css && r.nuoto.css.perche})`);
  console.log(`- bici: soglia FC ${r.bici.lthr && r.bici.lthr.v}, FTP ${r.bici.ftp && r.bici.ftp.v}`);
  console.log("- da scrivere:", r.cambi.map((c) => c.testo).filter(Boolean).join("; ") || "niente");
}
process.exit(ko ? 1 : 0);
