// Legge l'esportazione dell'app (hud-dati.json) e ricava il profilo del generatore a una certa data.
// Uso: const { carica, profiloAl, settimanaReale } = require("./dati-reali.js");
const fs = require("fs");
const { parseYMD, addDays, ymd } = require("./generatore.js");

// >>> PROFILO
const SPORT = (t) => {
  t = String(t || "");
  if (/swim/i.test(t)) return "nuoto";
  if (/ride|bike|cycl/i.test(t)) return "bici";
  if (/run|walk.*run/i.test(t)) return "corsa";
  if (/weight|strength/i.test(t)) return "forza";
  return "altro";
};
const QUALITA = /soglia|vo2|test|ripetut|interval|threshold|tempo|fartlek|norveg|css|\d\s*[×x]\s*\d/i;

// Dati di Intervals (o l'esportazione dell'app) nel formato compatto usato dal generatore
function normalizza(d) {
  const R = d.raw || d;
  const acts = (R.activities || []).filter((a) => a && a.start_date_local).map((a) => ({
    data: a.start_date_local.slice(0, 10), sport: SPORT(a.type), nome: a.name || "",
    min: Math.round((a.moving_time || a.elapsed_time || 0) / 60), carico: a.icu_training_load || 0,
    z4: (a.icu_hr_zone_times || []).slice(3).reduce((t, x) => t + (x || 0), 0), gara: !!a.race, v: a.average_speed || null,
    gap: a.gap || null, fc: a.average_heartrate || null, lthr: a.lthr || null,
  }));
  const well = (R.wellness || []).filter((w) => w && w.id).sort((a, b) => a.id.localeCompare(b.id));
  return { acts, well, config: d.config, esportato: d.esportato };
}

// Corsa vera o camminata? Più lenta di ~7'15"/km è una camminata, a meno che il passo corretto per la pendenza (GAP)
// o i battiti dicano che è corsa: un trail in salita a 9'/km e 175 bpm è una corsa vera
function corsaVera(a) {
  if (a.sport !== "corsa" || !a.v || a.v >= 2.3) return true;
  if (a.gap && a.gap >= 2.3) return true;
  return !!(a.fc && a.lthr && a.fc >= 0.8 * a.lthr);
}

// Una settimana reale (lunedì → domenica): ore per sport, lungo di corsa, qualità svolte, carico
function settimanaReale(D, lun) {
  const s = ymd(lun), e = ymd(addDays(lun, 7));
  const A = D.acts.filter((a) => a.data >= s && a.data < e);
  const per = { nuoto: 0, bici: 0, corsa: 0, forza: 0 };
  for (const a of A) if (per[a.sport] !== undefined) per[a.sport] += a.min;
  const corse = A.filter((a) => a.sport === "corsa");
  const qual = A.filter((a) => ["corsa", "bici", "nuoto"].includes(a.sport) && (QUALITA.test(a.nome) || a.z4 >= 600));
  return {
    lunedi: s, per, minuti: per.nuoto + per.bici + per.corsa + per.forza,
    lungoCorsa: corse.length ? Math.max(...corse.map((a) => a.min)) : 0,
    qualita: qual.map((a) => `${a.sport} · ${a.nome}`),
    carico: Math.round(A.reduce((t, a) => t + a.carico, 0)),
    sedute: A.filter((a) => a.sport !== "altro").length,
  };
}

function wellAl(D, giorno) { return [...D.well].reverse().find((w) => w.id <= giorno && w.ctl !== null && w.ctl !== undefined) || {}; }

// Profilo del generatore con i dati disponibili fino al giorno prima di `inizio`
function profiloAl(D, inizio, base) {
  const lun = parseYMD(inizio), ieri = ymd(addDays(lun, -1));
  const w = wellAl(D, ieri);
  const sett4 = [1, 2, 3, 4].map((k) => settimanaReale(D, addDays(lun, -7 * k)));
  const media = (f) => Math.round(sett4.reduce((t, s) => t + f(s), 0) / 4);
  const da6 = ymd(addDays(lun, -42));
  const rec = D.acts.filter((a) => a.data >= da6 && a.data < inizio);
  // lungo "tipico": la mediana delle 3 uscite più lunghe, così una gara o un'uscita eccezionale non falsano il punto di partenza
  const vera = corsaVera;
  const lungo = (sp) => { const v = rec.filter((a) => a.sport === sp && !a.gara && vera(a)).map((a) => a.min).sort((x, y) => y - x).slice(0, 3); return v.length ? v[Math.floor(v.length / 2)] : 0; };
  const primo = D.acts.length ? D.acts.map((a) => a.data).sort()[0] : inizio;
  const settStorico = Math.max(0, Math.floor((lun - parseYMD(primo)) / (7 * 86400000)));
  // rientro: nessuna corsa vera negli ultimi 10 giorni, o meno di un'ora nelle ultime 2 settimane
  const corse = D.acts.filter((a) => a.sport === "corsa" && a.data < inizio && vera(a)).map((a) => a.data).sort();
  const ultima = corse.length ? corse[corse.length - 1] : null;
  const da14 = ymd(addDays(lun, -14));
  const min14 = D.acts.filter((a) => a.sport === "corsa" && a.data >= da14 && a.data < inizio && vera(a)).reduce((t, a) => t + a.min, 0);
  const rientroCorsa = !ultima || (lun - parseYMD(ultima)) / 86400000 > 10 || min14 < 60;
  const minPerSport = { nuoto: media((s) => s.per.nuoto), bici: media((s) => s.per.bici), corsa: media((s) => s.per.corsa) };
  return {
    ...base,
    oggi: ieri,
    livello: {
      ctl: Math.round(w.ctl || 0), atl: Math.round(w.atl || w.ctl || 0),
      oreSett: +(media((s) => s.minuti) / 60).toFixed(1),
      lungoCorsaMin: lungo("corsa"), lungoBiciMin: lungo("bici"),
      settimaneStorico: settStorico, minPerSport, rientro: { corsa: rientroCorsa },
    },
  };
}

// <<< PROFILO

function carica(percorso) { return normalizza(JSON.parse(fs.readFileSync(percorso, "utf8"))); }

module.exports = { carica, normalizza, profiloAl, settimanaReale, SPORT };
