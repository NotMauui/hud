// Test del Carburante (motore nutrizionale dell'app): profili fissi × tipi di giorno, più i limiti di sicurezza.
// Uso: node test-carburante.js [percorso dell'app]   — senza percorso usa ../02_App_iPhone/HUD-70.3.js
// Con --salva scrive i risultati in carburante-atteso.json; senza, li confronta con quel file e segnala le differenze.
const fs = require("fs"), path = require("path");
const app = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(__dirname, "../02_App_iPhone/HUD-70.3.js");
const ATTESO = path.join(__dirname, "carburante-atteso.json");

async function motore(file) {
  let src = fs.readFileSync(file, "utf8");
  src = src.slice(0, src.lastIndexOf('if (typeof Script !== "undefined")'));
  src += "\nreturn { pianoNutrizione, metabolismo, CONFIG, analyze, demoData };";
  const AsyncF = Object.getPrototypeOf(async function () {}).constructor;
  return new AsyncF(src)();
}
const MET = { corsa: { facile: 9, qualita: 11, lungo: 9 }, bici: { lungo: 6.5 }, nuoto: { facile: 7 }, forza: { facile: 4.5 } };
const PERSONE = {
  reale: { peso: 91, altezza: 193, anno: 1996, sesso: "M", pesoObiettivo: 85 },
  donna: { peso: 58, altezza: 165, anno: 1990, sesso: "F", pesoObiettivo: 55 },
  leggero: { peso: 65, altezza: 175, anno: 1985, sesso: "M", pesoObiettivo: null },
  pesante: { peso: 110, altezza: 180, anno: 1980, sesso: "M", pesoObiettivo: 90, grasso: 30 },
};
const GIORNI = {
  riposo: [], medio: [["corsa", 45, "Corsa facile", false, "facile"]],
  nuoto_palestra: [["nuoto", 60, "Nuoto tecnica", false, "facile"], ["forza", 60, "Palestra", false, "facile"]],
  duro: [["corsa", 60, "Soglia 3x10'", true, "qualita"]], lungo_corsa: [["corsa", 100, "Lungo", false, "lungo"]], lungo_bici: [["bici", 180, "Lungo bici", false, "lungo"]],
};
(async () => {
  const M = await motore(app);
  const now = new Date(2026, 9, 14, 8), out = {}, errori = [];
  for (const [pn, p] of Object.entries(PERSONE)) {
    const np = M.metabolismo(p, p.peso, p.pesoObiettivo, null, now);
    for (const [gn, sed] of Object.entries(GIORNI)) for (const domani of [null, "Lungo"]) for (const rate of [null, -0.4, -1.2, 0.1]) {
      const esercizio = sed.reduce((t, [sp, min, , , cl]) => t + min * Math.max(0, (MET[sp][cl] * p.peso) / 60 - np.bmr / 1440), 0);
      const r = M.pianoNutrizione({ oggi: "2026-10-14", peso: p.peso, np, trend: { w7: p.peso, rate }, sedute: sed.map(([sport, min, nome, qualita]) => ({ sport, min, nome, qualita, fatta: false, indoor: false })), esercizio, peggiore: "verde", domaniChiave: domani, rif: null, salute: null });
      const k = `${pn}|${gn}|${domani ? "vigilia" : "-"}|${rate === null ? "senza pesate" : rate + " kg/sett"}`;
      out[k] = { tipo: r.tipo, kcal: r.kcal, deficit: r.deficit, P: r.P, C: r.C, G: r.G };
      // limiti che non devono mai saltare
      const F = p.sesso === "F", tdee = r.base + r.esercizio;
      if (r.kcal < (F ? 1500 : 1800)) errori.push(`${k}: ${r.kcal} kcal, sotto il minimo`);
      if (r.C < 2.95 * p.peso) errori.push(`${k}: carboidrati ${(r.C / p.peso).toFixed(1)} g/kg, sotto 3`);
      if (r.G < 0.75 * p.peso) errori.push(`${k}: grassi ${(r.G / p.peso).toFixed(2)} g/kg, sotto 0,8`);
      if (r.deficit > 0.25 * tdee + 10) errori.push(`${k}: deficit ${r.deficit} oltre il 25% delle calorie`);
      if ((r.kcal - r.esercizio) / np.ffm < (F ? 30 : 25) - 0.5) errori.push(`${k}: energia disponibile ${((r.kcal - r.esercizio) / np.ffm).toFixed(1)} kcal/kg di massa magra`);
      if ((r.tipo === "duro" || r.tipo === "lungo") && r.C < (r.tipo === "duro" ? 6 : 7) * p.peso - 5) errori.push(`${k}: giorno chiave con ${(r.C / p.peso).toFixed(1)} g/kg di carboidrati`);
      if (Math.abs(4 * r.P + 4 * r.C + 9 * r.G - r.kcal) > 10) errori.push(`${k}: macro e calorie non tornano`);
    }
  }
  // metabolismo di riferimento: ten Haaf per Atleta reale ≈ 2.197 kcal
  const m = M.metabolismo(PERSONE.reale, 91, 85, null, now);
  if (Math.abs(m.bmr - 2197) > 3) errori.push(`ten Haaf per Atleta reale: ${Math.round(m.bmr)} invece di ≈2.197`);
  // carico pre-gara: 2 giorni prima di una gara lunga
  M.CONFIG.obiettivo = { nome: "Gara", data: "2026-10-16", tipo: "70.3" };
  const c = M.pianoNutrizione({ oggi: "2026-10-14", peso: 91, np: m, trend: { w7: 91, rate: null }, sedute: [], esercizio: 0, peggiore: "verde", domaniChiave: null, rif: null, salute: null });
  if (c.tipo !== "carico" || c.C < 9.5 * 91 || c.deficit) errori.push(`carico pre-gara: tipo ${c.tipo}, ${(c.C / 91).toFixed(1)} g/kg, deficit ${c.deficit}`);
  M.CONFIG.obiettivo = null;
  // l'app intera con i dati demo non deve rompersi
  try { M.analyze(M.demoData(now), now, {}); } catch (e) { errori.push("analyze sui dati demo: " + e.message); }

  const n = Object.keys(out).length;
  if (process.argv.includes("--salva")) { fs.writeFileSync(ATTESO, JSON.stringify(out, null, 1)); console.log(`Salvati ${n} risultati attesi in ${path.basename(ATTESO)}`); }
  else if (fs.existsSync(ATTESO)) {
    const a = JSON.parse(fs.readFileSync(ATTESO, "utf8"));
    const diff = Object.keys(out).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(out[k]));
    console.log(diff.length ? `${diff.length} risultati diversi da quelli attesi:\n` + diff.slice(0, 12).map((k) => `  ${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(out[k])}`).join("\n") : `${n} risultati uguali a quelli attesi`);
  }
  console.log(errori.length ? `\n${errori.length} violazioni dei limiti:\n  ` + errori.join("\n  ") : `\n${n} scenari · 7 limiti ciascuno · carico pre-gara · demo: 0 violazioni`);
  process.exit(errori.length ? 1 : 0);
})();
