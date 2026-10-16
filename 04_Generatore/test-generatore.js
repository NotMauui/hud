// Test automatici: ogni piano generato deve rispettare tutte le regole.
const { generaBlocco, REGOLE, discipline } = require("./generatore.js");
const { sintetici, singoli, conOre, reale } = require("./profili.js");
const parz = (pr) => Array.isArray(pr.sport.discipline) && discipline(pr).length < 3;

const CONTROLLI = [
  ["Volume entro la disponibilità", (P, pr) => P.settimane.every((s) => s.minuti <= pr.disponibilita.oreMax * 60 + 5), (P, pr) => P.settimane.map((s) => `${Math.round(s.minuti / 6) / 10} h`).join(" · ") + ` (max ${pr.disponibilita.oreMax} h)`],
  ["Minuti per giorno entro la disponibilità", (P, pr) => P.settimane.every((s) => [0, 1, 2, 3, 4, 5, 6].every((g) => s.sedute.filter((x) => x.giorno === g).reduce((t, x) => t + x.min, 0) <= pr.disponibilita.minutiGiorno[g] + 5)), (P, pr) => { const o = []; P.settimane.forEach((s) => [0, 1, 2, 3, 4, 5, 6].forEach((g) => { const m = s.sedute.filter((x) => x.giorno === g).reduce((t, x) => t + x.min, 0); if (m > pr.disponibilita.minutiGiorno[g] + 5) o.push(`S${s.n} g${g}: ${m}'/${pr.disponibilita.minutiGiorno[g]}'`); })); return o.join(", "); }],
  ["Storico corto: settimana d'ingresso con test, senza qualità dura", (P, pr) => (pr.livello.settimaneStorico ?? 12) >= 4 || (P.settimane[0].sedute.filter((x) => x.tipo === "test").length >= 1 && P.settimane.every((s) => !s.sedute.some((x) => ["soglia", "vo2"].includes(x.tipo)))), () => ""],
  ["Frequenza: ≥ 2 sedute per sport quando la settimana supera 3,5 h", (P, pr) => P.settimane.filter((s) => !s.scarico && !["gara", "recupero"].includes(s.fase) && s.minuti >= 210).every((s) => discipline(pr).every((sp) => s.sedute.filter((x) => x.sport === sp).length >= (sp === "nuoto" ? Math.min(2, (pr.piscinaGiorni || [0, 2, 4]).length) : 2))), (P) => P.settimane.map((s) => ["corsa", "bici", "nuoto"].map((sp) => sp[0].toUpperCase() + s.sedute.filter((x) => x.sport === sp).length).join("")).join(" · ")],
  ["Giorni non disponibili rispettati", (P, pr) => P.settimane.every((s) => s.sedute.every((x) => pr.disponibilita.minutiGiorno[x.giorno] > 0)), () => ""],
  [`Crescita fitness ≤ ${REGOLE.rampMax} punti/sett`, (P) => P.settimane.every((s) => s.ramp <= REGOLE.rampMax + 0.05), (P) => P.settimane.map((s) => (s.ramp > 0 ? "+" : "") + s.ramp).join(" · ")],
  [`Qualità ≤ ${REGOLE.quotaQualitaMax * 100}% del tempo`, (P) => P.settimane.every((s) => s.minQualita <= s.minuti * REGOLE.quotaQualitaMax), (P) => P.settimane.map((s) => Math.round((s.minQualita / s.minuti) * 100) + "%").join(" · ")],
  ["Niente qualità di fila nello stesso sport", (P) => P.settimane.every((s) => { const q = s.sedute.filter((x) => x.qualita); return q.every((a) => !q.some((b) => b !== a && b.sport === a.sport && Math.abs(b.giorno - a.giorno) === 1)); }), () => ""],
  ["Niente qualità di corsa il giorno prima del lungo", (P, pr) => P.settimane.every((s) => !s.sedute.some((x) => x.sport === "corsa" && x.qualita && x.giorno === (pr.giornoLungo ?? 6) - 1)), () => ""],
  [`Lungo di corsa ≤ ${REGOLE.lungoCorsaQuotaMax * 100}% della corsa`, (P) => P.settimane.every((s) => !s.perSport.corsa || s.lungoCorsa <= s.perSport.corsa * REGOLE.lungoCorsaQuotaMax + 31), (P) => P.settimane.map((s) => `${s.lungoCorsa}'/${s.perSport.corsa}'`).join(" · ")],
  ["Uscite facili di bici più corte del lungo", (P) => P.settimane.every((s) => { const l = s.sedute.find((x) => x.sport === "bici" && x.tipo === "lungo"); return !l || s.sedute.filter((x) => x.sport === "bici" && x.tipo === "facile").every((x) => x.min <= l.min); }), (P) => P.settimane.map((s) => s.sedute.filter((x) => x.sport === "bici").map((x) => x.min).join("/")).join(" · ")],
  ["Lungo di corsa: +10' ogni 2 settimane al massimo", (P, pr) => { const l = P.settimane.map((s) => s.lungoCorsa); return l.every((v, i) => v <= (pr.livello.lungoCorsaMin || 40) + 10 * Math.floor((i + 0) / 2) + 10); }, (P) => P.settimane.map((s) => s.lungoCorsa + "'").join(" → ")],
  ["Settimana di scarico ≤ 75% della precedente", (P) => P.settimane[3].minuti <= P.settimane[2].minuti * 0.75 || ["gara", "recupero"].includes(P.settimane[3].fase) || ["gara", "recupero"].includes(P.settimane[2].fase), (P) => `${Math.round((P.settimane[3].minuti / P.settimane[2].minuti) * 100)}%`],
  ["Solo gli sport scelti e disponibili", (P, pr) => P.settimane.every((s) => s.sedute.every((x) => x.sport === "gara" || (x.sport === "forza" ? pr.sport.palestra : discipline(pr).includes(x.sport)))), (P) => [...new Set(P.settimane.flatMap((s) => s.sedute.map((x) => x.sport)))].join(", ")],
  ["Nuoto solo nei giorni di piscina", (P, pr) => P.settimane.every((s) => s.sedute.filter((x) => x.sport === "nuoto").every((x) => (pr.piscinaGiorni || [0, 2, 4]).includes(x.giorno))), () => ""],
  [`Ogni seduta ≥ ${REGOLE.minSeduta}'`, (P) => P.settimane.every((s) => s.sedute.every((x) => x.sport === "gara" || x.min >= REGOLE.minSeduta)), (P) => Math.min(...P.settimane.flatMap((s) => s.sedute.filter((x) => x.sport !== "gara").map((x) => x.min))) + "' minima"],
  ["Forza gambe lontana dalla qualità di corsa", (P) => P.settimane.every((s) => s.sedute.filter((x) => x.sport === "forza" && x.tipo === "gambe").every((g) => !s.sedute.some((x) => x.sport === "corsa" && x.qualita && Math.abs(x.giorno - g.giorno) <= 1))), () => ""],
  ["Scarico prima della gara", (P, pr) => { if (!pr.obiettivo.data) return true; const g = P.settimane.filter((s) => s.settAllaGara !== null && s.settAllaGara <= 1 && s.settAllaGara >= 0); return g.every((s) => s.minuti <= (pr.livello.oreSett || 4) * 60 * 0.7); }, (P) => P.settimane.map((s) => s.fase).join(" · ")],
  ["CSS da misurare: test 400 + 200 nella prima settimana", (P, pr) => !(pr.test && pr.test.css) || P.settimane[0].sedute.some((x) => x.sport === "nuoto" && x.tipo === "test"), () => ""],
  ["Al massimo una qualità per sport nello stesso giorno", (P) => P.settimane.every((s) => s.sedute.filter((x) => x.qualita).every((a) => !s.sedute.some((b) => b !== a && b.qualita && b.sport === a.sport && b.giorno === a.giorno))), (P) => P.settimane.map((s) => s.sedute.filter((x) => x.qualita).map((x) => x.giornoNome + ":" + x.sport[0]).join(",")).join(" · ")],
  // regole di chi fa uno o due sport
  ["Corse facili più corte del lungo (uno o due sport)", (P, pr) => !parz(pr) || P.settimane.every((s) => { const l = s.sedute.find((x) => x.sport === "corsa" && x.tipo === "lungo"); return !l || s.sedute.filter((x) => x.sport === "corsa" && ["facile", "allunghi"].includes(x.tipo)).every((x) => x.min <= Math.max(l.min, 30)); }), (P) => P.settimane.map((s) => s.sedute.filter((x) => x.sport === "corsa").map((x) => x.min).join("/")).join(" · ")],
  ["Lungo entro quello che serve per la gara (o l'abituale)", (P, pr) => { if (!parz(pr)) return true; const M = REGOLE.lungoMax[pr.obiettivo.tipo] || REGOLE.lungoMax.migliorare; return P.settimane.every((s) => s.sedute.filter((x) => x.tipo === "lungo" && M[x.sport]).every((x) => x.min <= Math.max(M[x.sport], (x.sport === "corsa" ? pr.livello.lungoCorsaMin : pr.livello.lungoBiciMin) || 0) + 5)); }, (P) => P.settimane.map((s) => s.sedute.filter((x) => x.tipo === "lungo").map((x) => x.sport[0] + x.min).join("/")).join(" · ")],
  ["Sedute di nuoto ≤ 2 ore (uno o due sport)", (P, pr) => !parz(pr) || P.settimane.every((s) => s.sedute.filter((x) => x.sport === "nuoto").every((x) => x.min <= 120)), (P) => Math.max(0, ...P.settimane.flatMap((s) => s.sedute.filter((x) => x.sport === "nuoto").map((x) => x.min))) + "' massima"],
  ["Con le ore indicate: la prima settimana parte almeno dal 75% (o fin dove lo consente la crescita della fitness)", (P, pr) => { const d = pr.disponibilita.oreDichiarate; if (!d) return true; const s = P.settimane[0]; const giorniUsati = pr.disponibilita.minutiGiorno.every((m, g) => !m || s.sedute.some((x) => x.giorno === g)); // ogni giorno libero ha già la sua seduta
    return s.minuti >= Math.min(d * 60 * REGOLE.quotaOreDichiarate * ((pr.livello.settimaneStorico ?? 12) < 4 ? 0.85 : 1), pr.disponibilita.oreMax * 60) - 20 || giorniUsati || s.ramp >= REGOLE.rampMax - 1.5 || P.settimane.some((x) => x.ramp >= REGOLE.rampMax - 1.5); }, (P, pr) => `S1 ${P.settimane[0].minuti}' (75% di ${pr.disponibilita.oreDichiarate || "—"} h = ${Math.round((pr.disponibilita.oreDichiarate || 0) * 45)}'), crescita ${P.settimane.map((s) => s.ramp).join("/")}`],
  ["Volume dello sport scelto vicino all'abituale (uno o due sport, senza ore indicate)", (P, pr) => !parz(pr) || !pr.livello.minPerSport || pr.disponibilita.oreDichiarate || discipline(pr).every((sp) => P.settimane[0].perSport[sp] <= Math.max(150, (pr.livello.minPerSport[sp] || 0) * 1.25 + 30)), (P, pr) => discipline(pr).map((sp) => `${sp} ${P.settimane[0].perSport[sp]}' (abituale ${(pr.livello.minPerSport || {})[sp] ?? "—"}')`).join(", ")],
  ["Una qualità in più solo per chi fa un solo sport", (P, pr) => P.settimane.every((s) => ["corsa", "bici"].every((sp) => s.sedute.filter((x) => x.sport === sp && x.qualita).length <= (parz(pr) && discipline(pr).length === 1 ? 2 : 1))), (P) => P.settimane.map((s) => s.sedute.filter((x) => x.qualita).map((x) => x.sport[0] + ":" + x.tipo).join(",")).join(" · ")],
];

function valuta(pr) {
  const P = generaBlocco(pr);
  const esiti = CONTROLLI.map(([nome, ok, det]) => { let pass; try { pass = !!ok(P, pr); } catch (e) { pass = false; } return { nome, pass, dettaglio: det(P, pr) }; });
  return { profilo: pr, piano: P, esiti, ok: esiti.every((e) => e.pass) };
}

const risultati = [...sintetici, ...singoli, ...conOre, reale].map(valuta);
module.exports = { risultati, CONTROLLI, valuta };

if (require.main === module) {
  let fail = 0;
  for (const r of risultati) {
    const ko = r.esiti.filter((e) => !e.pass);
    fail += ko.length;
    console.log(`${r.ok ? "OK " : "KO "} ${r.profilo.nome}${ko.length ? "  → " + ko.map((e) => e.nome + " [" + e.dettaglio + "]").join("; ") : ""}`);
  }
  console.log(`\n${risultati.length} profili · ${CONTROLLI.length} controlli ciascuno · ${fail} violazioni`);
  process.exitCode = fail ? 1 : 0;
}
