// Profili di prova: 20 triatleti inventati, 16 atleti di uno o due sport + Atleta reale (primo profilo reale)
const OGGI = "2026-10-09";
const sett = (n) => { const d = new Date(2026, 9, 12 + 7 * n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const giorni = (feriale, weekend) => [feriale, feriale, feriale, feriale, feriale, weekend, weekend];

const livelli = {
  principiante: { ctl: 18, oreSett: 4, lungoCorsaMin: 40, lungoBiciMin: 60, settimaneStorico: 10 },
  nuovo: { ctl: 10, oreSett: 3, lungoCorsaMin: 30, lungoBiciMin: 45, settimaneStorico: 2 },
  intermedio: { ctl: 42, oreSett: 7, lungoCorsaMin: 60, lungoBiciMin: 90, settimaneStorico: 26 },
  esperto: { ctl: 75, oreSett: 12, lungoCorsaMin: 95, lungoBiciMin: 180, settimaneStorico: 52 },
};

const sintetici = [];
const tipi = ["sprint", "olimpico", "70.3", "ironman"];
const distanze = [null, 8, 14, 22, 34];
let i = 0;
for (const [nomeLiv, liv] of Object.entries(livelli)) {
  for (const t of tipi) {
    const settGara = distanze[(i % distanze.length)];
    const ore = { principiante: 6, nuovo: 5, intermedio: 10, esperto: 16 }[nomeLiv];
    sintetici.push({
      nome: `${nomeLiv} · ${t} · ${settGara === null ? "senza gara" : settGara + " sett."}`,
      oggi: OGGI,
      obiettivo: settGara === null ? { tipo: "migliorare" } : { tipo: t, data: sett(settGara) },
      disponibilita: { oreMax: ore, minutiGiorno: giorni(Math.round(ore * 60 / 6), Math.round(ore * 60 / 3.5)) },
      sport: { piscina: i % 7 !== 3, bici: i % 9 === 4 ? false : (i % 2 ? "indoor" : true), palestra: i % 3 !== 0 },
      piscinaGiorni: i % 2 ? [0, 2, 4] : [1, 3],
      giornoLungo: 6,
      livello: { ...liv },
    });
    i++;
  }
}
// casi limite
sintetici.push({ nome: "poco tempo · 70.3 · 20 sett.", oggi: OGGI, obiettivo: { tipo: "70.3", data: sett(20) }, disponibilita: { oreMax: 5, minutiGiorno: [45, 45, 0, 45, 45, 120, 150] }, sport: { piscina: true, bici: true, palestra: false }, piscinaGiorni: [0, 3], giornoLungo: 6, livello: { ...livelli.intermedio, oreSett: 6 } });
sintetici.push({ nome: "gara tra 2 settimane · olimpico", oggi: OGGI, obiettivo: { tipo: "olimpico", data: sett(2) }, disponibilita: { oreMax: 10, minutiGiorno: giorni(90, 180) }, sport: { piscina: true, bici: true, palestra: true }, piscinaGiorni: [0, 2, 4], giornoLungo: 6, livello: { ...livelli.intermedio } });
sintetici.push({ nome: "lungo il sabato · 70.3 · 30 sett.", oggi: OGGI, obiettivo: { tipo: "70.3", data: sett(30) }, disponibilita: { oreMax: 10, minutiGiorno: giorni(80, 200) }, sport: { piscina: true, bici: true, palestra: true }, piscinaGiorni: [1, 3], giornoLungo: 5, livello: { ...livelli.intermedio } });
sintetici.push({ nome: "esperto con poco tempo · ironman · 26 sett.", oggi: OGGI, obiettivo: { tipo: "ironman", data: sett(26) }, disponibilita: { oreMax: 9, minutiGiorno: giorni(75, 180) }, sport: { piscina: true, bici: true, palestra: true }, piscinaGiorni: [0, 2, 4], giornoLungo: 6, livello: { ...livelli.esperto } });

// Uno o due sport (scelti nella configurazione dell'app: sport.discipline)
const uno = (nome, discipline, tipo, settGara, liv, ore, extra = {}) => ({
  nome, oggi: OGGI,
  obiettivo: settGara === null ? { tipo: "migliorare" } : { tipo, data: sett(settGara) },
  disponibilita: { oreMax: ore, minutiGiorno: giorni(Math.round(ore * 60 / 6), Math.round(ore * 60 / 3.5)) },
  sport: { discipline, piscina: discipline.includes("nuoto"), bici: discipline.includes("bici") ? true : false, palestra: false, ...(extra.sport || {}) },
  piscinaGiorni: extra.piscinaGiorni || [0, 2, 4], giornoLungo: extra.giornoLungo ?? 6,
  livello: { ...livelli[liv], ...(extra.livello || {}) },
});
const singoli = [
  uno("solo corsa · 5 km · principiante · 14 sett.", ["corsa"], "5k", 14, "principiante", 5, { livello: { oreSett: 3, lungoCorsaMin: 50 } }),
  uno("solo corsa · 10 km · intermedio · 8 sett.", ["corsa"], "10k", 8, "intermedio", 7, { livello: { minPerSport: { corsa: 330, bici: 0, nuoto: 0 } } }),
  uno("solo corsa · mezza · intermedio · 22 sett.", ["corsa"], "mezza", 22, "intermedio", 8, { sport: { palestra: true }, livello: { minPerSport: { corsa: 300, bici: 0, nuoto: 0 } } }),
  uno("solo corsa · maratona · esperto · 14 sett.", ["corsa"], "maratona", 14, "esperto", 10, { livello: { oreSett: 8, lungoCorsaMin: 120, minPerSport: { corsa: 470, bici: 0, nuoto: 0 } } }),
  uno("solo corsa · migliorare · nuovo", ["corsa"], null, null, "nuovo", 4),
  uno("solo corsa · gara tra 2 sett. · 10 km", ["corsa"], "10k", 2, "intermedio", 7),
  uno("triatleta che passa alla maratona · 26 sett.", ["corsa"], "maratona", 26, "intermedio", 10, { livello: { oreSett: 8, lungoCorsaMin: 80, minPerSport: { nuoto: 90, bici: 150, corsa: 180 } } }),
  uno("solo bici · mediofondo · principiante · 22 sett.", ["bici"], "mediofondo", 22, "principiante", 6),
  uno("solo bici · granfondo · esperto · 14 sett.", ["bici"], "granfondo", 14, "esperto", 12, { livello: { minPerSport: { bici: 640, corsa: 0, nuoto: 0 } } }),
  uno("solo bici · migliorare · intermedio · lungo sabato", ["bici"], null, null, "intermedio", 8, { giornoLungo: 5 }),
  uno("solo nuoto · fino a 3 km · intermedio · 14 sett.", ["nuoto"], "nuoto-3k", 14, "intermedio", 6, { piscinaGiorni: [0, 1, 3, 5] }),
  uno("solo nuoto · 10 km · esperto · 22 sett.", ["nuoto"], "nuoto-10k", 22, "esperto", 9, { piscinaGiorni: [0, 1, 2, 3, 4, 6] }),
  uno("solo nuoto · migliorare · nuovo · 3 giorni", ["nuoto"], null, null, "nuovo", 4, { piscinaGiorni: [1, 3, 5] }),
  uno("duathlon · intermedio · 14 sett.", ["bici", "corsa"], "duathlon", 14, "intermedio", 8),
  uno("aquathlon · principiante · 8 sett.", ["nuoto", "corsa"], "aquathlon", 8, "principiante", 6, { piscinaGiorni: [1, 3] }),
  uno("nuoto e bici · migliorare · intermedio", ["nuoto", "bici"], null, null, "intermedio", 8, { piscinaGiorni: [0, 2, 4] }),
];

// Come l'app costruisce la disponibilità dalle risposte (ore indicate, giorni liberi)
const dallApp = (ore, giorniLiberi = [true, true, true, true, true, true, true]) => {
  const w = giorniLiberi.map((g, i) => (g ? (i >= 5 ? 1.8 : 1) : 0)), sw = w.reduce((t, x) => t + x, 0);
  return { oreMax: ore + 1, oreDichiarate: ore, minutiGiorno: w.map((x) => (x ? Math.max(45, Math.min(300, Math.round(((ore * 60 * x) / sw) * 1.6 / 5) * 5)) : 0)) };
};
// Tester B (primo tester, ottobre 2026): 3 ore a settimana nell'ultimo mese, 8 indicate; corsa (anche trail) e bici, niente nuoto da agosto
const livTesterB = { ctl: 26, atl: 37, oreSett: 3.1, lungoCorsaMin: 63, lungoBiciMin: 110, settimaneStorico: 8, minPerSport: { corsa: 127, bici: 57, nuoto: 0 }, rientro: { corsa: false } };
const conOre = [
  { nome: "Tester B · corsa e bici · 8 h indicate", oggi: OGGI, obiettivo: { tipo: "migliorare" }, disponibilita: dallApp(8), sport: { discipline: ["bici", "corsa"], piscina: false, bici: true, palestra: false }, giornoLungo: 6, livello: { ...livTesterB } },
  { nome: "Tester B · tre sport (risposta vecchia) · 8 h indicate · CSS da misurare", oggi: OGGI, obiettivo: { tipo: "migliorare" }, disponibilita: dallApp(8), sport: { discipline: ["nuoto", "bici", "corsa"], piscina: true, bici: true, palestra: false }, piscinaGiorni: [0, 2, 4], giornoLungo: 6, test: { css: true }, livello: { ...livTesterB } },
  { nome: "3 h abituali, 10 indicate · olimpico · 22 sett.", oggi: OGGI, obiettivo: { tipo: "olimpico", data: sett(22) }, disponibilita: dallApp(10), sport: { discipline: ["nuoto", "bici", "corsa"], piscina: true, bici: true, palestra: true }, piscinaGiorni: [0, 2, 4], palestraGiorni: [0, 3], giornoLungo: 6, livello: { ctl: 22, oreSett: 3, lungoCorsaMin: 50, lungoBiciMin: 70, settimaneStorico: 20, minPerSport: { nuoto: 40, bici: 60, corsa: 80 } } },
  { nome: "poco tempo con ore indicate · 70.3 · 20 sett.", oggi: OGGI, obiettivo: { tipo: "70.3", data: sett(20) }, disponibilita: { ...dallApp(5, [true, true, false, true, true, true, true]) }, sport: { discipline: ["nuoto", "bici", "corsa"], piscina: true, bici: true, palestra: false }, piscinaGiorni: [0, 3], giornoLungo: 6, livello: { ctl: 40, oreSett: 6, lungoCorsaMin: 60, lungoBiciMin: 90, settimaneStorico: 26 } },
  { nome: "principiante con ore indicate · 70.3 · 14 sett.", oggi: OGGI, obiettivo: { tipo: "70.3", data: sett(14) }, disponibilita: dallApp(6), sport: { discipline: ["nuoto", "bici", "corsa"], piscina: true, bici: "indoor", palestra: true }, piscinaGiorni: [0, 2, 4], giornoLungo: 6, livello: { ctl: 18, oreSett: 4, lungoCorsaMin: 40, lungoBiciMin: 60, settimaneStorico: 10 } },
  // casi dalla revisione indipendente
  { nome: "da zero con 15 h indicate · ironman · 40 sett.", oggi: OGGI, obiettivo: { tipo: "ironman", data: sett(40) }, disponibilita: dallApp(15), sport: { discipline: ["nuoto", "bici", "corsa"], piscina: true, bici: true, palestra: false }, piscinaGiorni: [0, 2, 4], giornoLungo: 6, livello: { ctl: 2, oreSett: 0.5, lungoCorsaMin: 20, lungoBiciMin: 30, settimaneStorico: 10, minPerSport: { nuoto: 0, bici: 20, corsa: 10 } } },
  { nome: "fitness 8 con 12 h indicate · solo bici", oggi: OGGI, obiettivo: { tipo: "migliorare" }, disponibilita: dallApp(12), sport: { discipline: ["bici"], piscina: false, bici: true, palestra: false }, giornoLungo: 6, livello: { ctl: 8, oreSett: 1.5, lungoCorsaMin: 0, lungoBiciMin: 60, settimaneStorico: 30, minPerSport: { nuoto: 0, bici: 90, corsa: 0 } } },
  { nome: "runner libero da giovedì a domenica · 10 km · 10 h", oggi: OGGI, obiettivo: { tipo: "10k", data: sett(10) }, disponibilita: dallApp(10, [false, false, false, true, true, true, true]), sport: { discipline: ["corsa"], piscina: false, bici: false, palestra: false }, giornoLungo: 6, livello: { ctl: 45, oreSett: 6, lungoCorsaMin: 80, lungoBiciMin: 0, settimaneStorico: 40, minPerSport: { corsa: 360, bici: 0, nuoto: 0 } } },
  { nome: "una sola piscina a settimana · CSS da misurare", oggi: OGGI, obiettivo: { tipo: "migliorare" }, disponibilita: dallApp(6), sport: { discipline: ["nuoto", "corsa"], piscina: true, bici: false, palestra: false }, piscinaGiorni: [2], giornoLungo: 6, test: { css: true }, livello: { ctl: 30, oreSett: 5, lungoCorsaMin: 60, lungoBiciMin: 0, settimaneStorico: 30, minPerSport: { corsa: 250, bici: 0, nuoto: 0 } } },
  { nome: "runner da 3 h, 6 indicate · 10 km · 14 sett.", oggi: OGGI, obiettivo: { tipo: "10k", data: sett(14) }, disponibilita: dallApp(6, [true, false, true, false, true, true, true]), sport: { discipline: ["corsa"], piscina: false, bici: false, palestra: false }, giornoLungo: 6, livello: { ctl: 30, oreSett: 3, lungoCorsaMin: 60, lungoBiciMin: 0, settimaneStorico: 30, minPerSport: { corsa: 180, bici: 0, nuoto: 0 } } },
];

// Atleta reale: profilo confermato con i dati reali esportati dall'app il 9 ottobre 2026
// (calcolato da dati-reali.js: 4 settimane prima del 12 ottobre)
const reale = {
  nome: "Atleta reale · 70.3 · 30 mag 2027",
  oggi: OGGI,
  obiettivo: { tipo: "70.3", data: "2027-05-30" },
  // nuoto lun/mer/ven mattina, palestra lun e ven a pranzo, mar/gio mattina e sera, lungo la domenica
  disponibilita: { oreMax: 16, minutiGiorno: [150, 150, 120, 150, 150, 180, 150] },
  sport: { piscina: true, bici: "indoor", palestra: true },
  piscinaGiorni: [0, 2, 4],
  palestraGiorni: [0, 4],
  giornoLungo: 6,
  livello: { ctl: 36, atl: 37, oreSett: 8, lungoCorsaMin: 80, lungoBiciMin: 80, settimaneStorico: 26, minPerSport: { nuoto: 86, bici: 124, corsa: 116 }, rientro: { corsa: true } },
  pianoReale: { lunghiCorsa: [50, 65, 75, null], palestra: ["Lun gambe", "Ven trazione-spalla-tronco"], qualitaCorsa: ["Mar soglia", "Gio VO2"] },
};

module.exports = { sintetici, singoli, conOre, reale };
