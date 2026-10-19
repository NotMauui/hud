
// ============================================================
//  Palestra: registro delle serie, progressione dei carichi e 1RM stimato
//  Scritto da zero sulle regole confermate da Atleta reale il 18/10/2026. Riferimenti:
//  - ACSM Position Stand 2009, "Progression models in resistance training": +2-10% quando si fanno
//    1-2 ripetizioni oltre l'obiettivo in due sedute di fila
//  - Epley 1985 (1RM = kg × (1 + rip/30)) e Brzycki 1993 (1RM = kg × 36 / (37 − rip)), solo fino a 12 ripetizioni
//  Funzioni pure: nessuna interfaccia, i dati stanno in hud-diario.json alla chiave «palestra».
// ============================================================

// Come progredisce ogni esercizio del catalogo: bilanciere gambe/alto, leg press, macchina, manubri,
// ripetizioni (corpo libero ed elastico), tempo, fermo (pliometria: non si carica)
const PROG_TIPO = { squatbil: "bilGambe", rdl: "bilGambe", hipthrust: "bilGambe", panca: "bilAlto", rematorebil: "bilAlto", legpress: "legpress" };
const PROG_VARIANTE = { ponte: "ponte1", affondo: "bulgaro", squat: "bulgaro" }; // corpo libero al tetto: la versione più dura
function tipoProgressione(es, dose) {
  if (PROG_TIPO[es]) return PROG_TIPO[es];
  const e = (typeof ESL !== "undefined" ? ESL : []).find((x) => x[0] === es);
  if (e && e[4] === "plio") return "fermo";
  if (/\d\s*["″]/.test(dose || "")) return "tempo";
  if (!e) return null; // esercizio fuori catalogo (scheda personale): si decide dai kg registrati
  if (e[3] === "palestra") return "macchina";
  if (e[3] === "manubri") return "manubri";
  return "ripetizioni";
}

// «4 × 8», «3 × 10 per lato», «3 × 40" per lato», «3 × 40 m»
function leggiDose(dose) {
  const s = String(dose || "").trim(), m = /^(\d+)\s*×\s*(.+)$/.exec(s);
  const serie = m ? +m[1] : 1, resto = m ? m[2] : s;
  const sec = /(\d+)\s*["″]/.exec(resto), metri = /(\d+)\s*m\b/.exec(resto), rip = /(\d+)/.exec(resto);
  return { serie, sec: sec ? +sec[1] : null, metri: metri ? +metri[1] : null, rip: !sec && !metri && rip ? +rip[1] : null, perLato: /per lato/.test(resto) };
}

const arrotonda = (kg, passo) => Math.round(Math.round(kg / passo) * passo * 100) / 100;
const numOk = (x, max) => (typeof x === "number" && isFinite(x) && x >= 0 && x <= max ? x : null);

// Salva una seduta di un esercizio: { data: "AAAA-MM-GG", es, serie: [{ kg, rip, sec, rir }] }.
// La stessa data e lo stesso esercizio si sovrascrivono (si può correggere). Restituisce la voce pulita o null.
function registraSerie(dia, voce) {
  if (!dia || !voce || !/^\d{4}-\d\d-\d\d$/.test(voce.data || "") || !/^[a-z0-9-]{1,30}$/.test(voce.es || "")) return null;
  const serie = (Array.isArray(voce.serie) ? voce.serie : []).slice(0, 10).map((s) => ({ kg: numOk(s.kg, 500), rip: numOk(s.rip, 100), sec: numOk(s.sec, 900), rir: numOk(s.rir, 10) })).filter((s) => s.rip !== null || s.sec !== null);
  if (!serie.length) return null;
  const P = (dia.palestra = dia.palestra || { log: [], stato: {} });
  P.log = (P.log || []).filter((x) => !(x.data === voce.data && x.es === voce.es));
  const pulita = { data: voce.data, es: voce.es, serie };
  P.log.push(pulita);
  P.log.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  if (P.log.length > 1500) P.log = P.log.slice(-1500);
  return pulita;
}

// 1RM stimato da una serie: solo con un carico esterno e da 1 a 12 ripetizioni (oltre la stima non regge)
function stima1RM(kg, rip, formula) {
  if (!(kg > 0) || !(rip >= 1) || rip > 12) return null;
  if (rip === 1) return kg;
  const v = formula === "brzycki" ? (kg * 36) / (37 - rip) : kg * (1 + rip / 30);
  return Math.round(v * 10) / 10;
}
// La miglior stima nello storico di un esercizio, con la serie da cui viene
function migliore1RM(dia, es) {
  let best = null;
  for (const v of ((dia && dia.palestra && dia.palestra.log) || [])) if (v.es === es) for (const s of v.serie) {
    const x = stima1RM(s.kg, s.rip);
    if (x !== null && (!best || x > best.valore)) best = { valore: x, data: v.data, kg: s.kg, rip: s.rip };
  }
  return best;
}

// La dose della prossima seduta di un esercizio.
// dose: quella della scheda («4 × 8»); ctx: { oggi, scarico, fase, semaforo } (semaforo "rosso" se uno dei due è rosso).
// Restituisce { serie, rip|sec, kg, fascia, azione, motivo, variante? }. azione: nuovo, sali, tieni, scendi, ripresa, variante.
function prossimaDose(dia, es, dose, ctx = {}) {
  const C = CONFIG.progressione, D = leggiDose(dose);
  const storia = (((dia && dia.palestra && dia.palestra.log) || []).filter((v) => v.es === es)).slice(-3);
  const ultima = storia[storia.length - 1];
  const kgDi = (v) => Math.max(0, ...v.serie.map((s) => s.kg || 0));
  let tipo = tipoProgressione(es, dose);
  if (!tipo) tipo = ultima && kgDi(ultima) > 0 ? "carico" : "ripetizioni";
  const passo = { bilGambe: C.passi.bilanciereGambe, bilAlto: C.passi.bilanciereAlto, legpress: C.passi.legPress, macchina: C.passi.macchina, manubri: C.passi.manubri, carico: C.passi.bilanciereAlto }[tipo] || null;
  const out = { serie: D.serie, rip: D.rip, sec: D.sec, metri: D.metri, kg: ultima && passo ? kgDi(ultima) || null : null, fascia: null, azione: "tieni", motivo: "" };
  if (tipo === "fermo") return { ...out, kg: null, motivo: "Esercizio esplosivo: conta la qualità del movimento, non il carico" };
  if (!ultima) return { ...out, azione: "nuovo", motivo: passo ? "Prima volta: scegli un carico che lasci 2 ripetizioni di riserva" : "Prima volta" };
  if (passo && !out.kg) return { ...out, azione: "nuovo", motivo: "Segna i kg delle serie: senza il carico non si può proporre l'aumento" };

  const blocco = ctx.scarico ? "settimana di scarico" : ["gara", "recupero"].includes(ctx.fase) ? `fase ${ctx.fase}` : ctx.semaforo === "rosso" ? "semaforo rosso" : null;
  const giorniFermo = ctx.oggi ? Math.round((parseYMD(ctx.oggi) - parseYMD(ultima.data)) / 864e5) : 0;
  const rir = (s) => (s.rir === null || s.rir === undefined ? 2 : s.rir); // RIR non segnato: si assume 2 (basta per salire in due sedute, non in una)
  const tutteRir0 = ultima.serie.every((s) => s.rir === 0);

  // Ripresa dopo uno stop lungo: si riparte più bassi qualunque sia il resto
  if (passo && out.kg && giorniFermo >= C.ripresaGiorni) return { ...out, kg: arrotonda(out.kg * (1 - C.ripresaCalo), passo), fascia: fasciaDi(D.rip, passo, out.kg, C), azione: "ripresa", motivo: `${giorniFermo} giorni senza questo esercizio: si riparte più leggeri` };

  if (tipo === "tempo") {
    const fatto = ultima.serie.length >= D.serie && ultima.serie.every((s) => (s.sec || 0) >= (D.sec || 0));
    const base = Math.max(D.sec || 0, ...ultima.serie.map((s) => s.sec || 0));
    if (blocco) return { ...out, sec: base, motivo: `Nessun aumento: ${blocco}` };
    if (fatto && base < C.tempoMax) return { ...out, sec: Math.min(C.tempoMax, base + C.tempoPasso), azione: "sali", motivo: `Tenuto ${base}" in tutte le serie` };
    return { ...out, sec: base, motivo: base >= C.tempoMax ? `Al tetto di ${C.tempoMax}"` : "Completa tutte le serie al tempo indicato" };
  }

  if (!passo) {
    // corpo libero ed elastico: crescono le ripetizioni fino al tetto, poi la variante più dura
    const base = Math.max(D.rip || 0, Math.min(...ultima.serie.map((s) => s.rip || 0)));
    const fatto = ultima.serie.length >= D.serie && ultima.serie.every((s) => (s.rip || 0) >= base && rir(s) >= 2);
    if (blocco) return { ...out, rip: base, motivo: `Nessun aumento: ${blocco}` };
    if (!fatto) return { ...out, rip: base, motivo: "Completa tutte le serie con 2 ripetizioni di riserva" };
    if (base >= C.ripMaxCorpoLibero) return PROG_VARIANTE[es] ? { ...out, rip: D.rip, azione: "variante", variante: PROG_VARIANTE[es], motivo: `Al tetto di ${C.ripMaxCorpoLibero} ripetizioni: passa alla versione più dura` } : { ...out, rip: base, motivo: `Al tetto di ${C.ripMaxCorpoLibero} ripetizioni` };
    const piu = ultima.serie.every((s) => rir(s) >= 3) ? 2 : 1;
    return { ...out, rip: Math.min(C.ripMaxCorpoLibero, base + piu), azione: "sali", motivo: `Tutte le serie fatte: +${piu} ripetizion${piu > 1 ? "i" : "e"}` };
  }

  // con un carico: doppia progressione dentro la fascia, poi il carico sale del passo minimo
  const fascia = fasciaDi(D.rip, passo, out.kg, C), [basso, alto] = fascia;
  out.fascia = fascia;
  const stessoKg = (v) => kgDi(v) === out.kg;
  const inCima = (v) => v.serie.length >= D.serie && v.serie.every((s) => (s.rip || 0) >= alto && rir(s) >= 2);
  const tot = (v) => v.serie.reduce((t, s) => t + (s.rip || 0), 0);
  const recenti = storia.filter(stessoKg);
  const ripProposte = Math.min(alto, Math.max(basso, Math.min(...ultima.serie.map((s) => s.rip || 0)) + 1));

  if (tutteRir0) return { ...out, kg: arrotonda(out.kg * (1 - C.calo), passo), rip: basso, azione: "scendi", motivo: "Tutte le serie a cedimento: −10% e si risale" };
  // due sedute ferme: tre sedute di fila allo stesso carico, senza arrivare in cima e senza più ripetizioni della volta prima
  if (recenti.length === 3 && !inCima(recenti[2]) && tot(recenti[1]) <= tot(recenti[0]) && tot(recenti[2]) <= tot(recenti[1])) return { ...out, kg: arrotonda(out.kg * (1 - C.calo), passo), rip: basso, azione: "scendi", motivo: "Due sedute senza progressi: −10% e si risale" };
  if (blocco) return { ...out, rip: ripProposte, motivo: `Nessun aumento: ${blocco}` };
  const unaBasta = inCima(ultima) && ultima.serie.every((s) => rir(s) >= 3);
  const dueDiFila = recenti.length >= 2 && inCima(recenti[recenti.length - 1]) && inCima(recenti[recenti.length - 2]);
  if (unaBasta || dueDiFila) return { ...out, kg: arrotonda(out.kg + passo, passo), rip: basso, azione: "sali", motivo: unaBasta ? `In cima alla fascia con 3 ripetizioni di riserva: +${fmtKg(passo)} kg` : `In cima alla fascia per due sedute: +${fmtKg(passo)} kg` };
  return { ...out, rip: ripProposte, motivo: inCima(ultima) ? "In cima alla fascia: se si ripete, sale il carico" : `Arriva a ${alto} ripetizioni in tutte le serie` };
}
// La fascia di ripetizioni: dalla dose della scheda a +2; se il passo minimo supera il 10% del carico (manubri leggeri) a +4
function fasciaDi(rip, passo, kg, C) {
  const b = rip || 8;
  return [b, b + (kg && passo / kg > C.passoMaxQuota ? 4 : 2)];
}
const fmtKg = (x) => String(x).replace(".", ",");
