// ------------------------------------------------------------
//  Carburante automatico: base dal corpo, sedute dai consumi imparati
// ------------------------------------------------------------
const QUAL_NOME = /soglia|threshold|vo2|ripetut|interval|sweet|tempo|fartlek|ritmo|test|css|\d\s*[×x]\s*\d/i;
const MET = { corsa: { facile: 9, qualita: 11, lungo: 9 }, bici: { facile: 6.5, qualita: 8.5, lungo: 6.5 }, nuoto: { facile: 7, qualita: 8.5, lungo: 7 }, forza: { facile: 4.5, qualita: 4.5, lungo: 4.5 }, altro: { facile: 4.5, qualita: 5.5, lungo: 4.5 } };
const CLASSI = { facile: "facile", qualita: "qualità", lungo: "lungo" };
function classeSeduta(sport, min, nome, z4sec) {
  if (QUAL_NOME.test(nome || "") || (z4sec || 0) >= 600) return "qualita";
  if ((sport === "corsa" && min >= 75) || (sport === "bici" && min >= 120) || (sport === "nuoto" && min >= 60) || /lungo|long/i.test(nome || "")) return "lungo";
  return "facile";
}
// Quanto brucia questa persona per minuto, per sport e tipo di seduta: mediana delle sue attività con calorie
function consumiImparati(acts, pesoKg, now) {
  const da = addDays(now, -180), gruppi = {};
  for (const a of acts) {
    const sp = sportOf(a.type), sec = num(a.moving_time), kc = num(a.calories);
    if (!sec || sec < 600 || !kc || kc < 30 || new Date(a.start_date_local) < da) continue;
    const z4 = (a.icu_hr_zone_times || []).slice(3).reduce((t, x) => t + (x || 0), 0);
    const k = `${sp}|${classeSeduta(sp, sec / 60, a.name, z4)}`;
    (gruppi[k] = gruppi[k] || []).push(kc / (sec / 60));
  }
  const med = (v) => { const s = v.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const peso = pesoKg || 70;
  const kpm = (sp, cl) => {
    const g = gruppi[`${sp}|${cl}`];
    if (g && g.length >= 3) return { v: med(g), n: g.length, fonte: "tue" };
    const tutte = Object.keys(gruppi).filter((k) => k.startsWith(sp + "|")).flatMap((k) => gruppi[k]);
    const metSp = MET[sp] || MET.altro;
    if (tutte.length >= 3) return { v: med(tutte) * (metSp[cl] / metSp.facile), n: tutte.length, fonte: "sport" };
    return { v: (metSp[cl] * peso) / 60, n: 0, fonte: "stima" };
  };
  const tabella = [];
  for (const sp of ["corsa", "bici", "nuoto", "forza"]) for (const cl of ["facile", "qualita", "lungo"]) {
    if (sp === "forza" && cl !== "facile") continue;
    const r = kpm(sp, cl);
    tabella.push({ sport: sp, classe: cl, kpm: Math.round(r.v * 10) / 10, n: r.n, fonte: r.fonte });
  }
  return { kpm: (sp, cl) => kpm(sp, cl).v, tabella };
}
// Rifornimento: grammi all'ora verso la gara, frenati dallo stomaco; sudore e sodio tarati sulle pesate prima/dopo.
// Le dosi salgono solo dopo un lungo con lo stomaco a posto: senza prove si resta alla dose di partenza.
const sudoreA = (Lh18, T) => Lh18 * (1 + 0.03 * ((T ?? 18) - 18)); // circa +3% per ogni grado sopra i 18 °C
function statoRifornimento(dia, now, T, R) {
  const r5 = (v) => Math.round(v / 5) * 5;
  const t = (x) => parseYMD(x).getTime();
  const prog = R.rampa ? Math.max(0, Math.min(1, (now.getTime() - t(R.rampa.inizio)) / (t(R.rampa.fine) - t(R.rampa.inizio)))) : 0;
  const prove = Object.keys(dia.lunghi || {}).sort().map((d) => {
    const l = dia.lunghi[d] || {}, ore = (l.min || 0) / 60;
    const gh = l.carbo >= 0 && l.min >= 45 ? Math.round(l.carbo / Math.max(0.75, ore)) : null;
    const perso = l.pre > 0 && l.post > 0 ? l.pre - l.post : null;
    const Lh = perso !== null && perso >= -1 && perso <= 4 && ore >= 0.75 ? (perso + (l.bevuto || 0) / 1000) / ore : null;
    return { d, sport: l.sport, min: l.min, gh, stomaco: l.stomaco, Lh: Lh !== null && Lh >= 0.2 && Lh <= 3 ? Lh : null, Lh18: Lh !== null && Lh >= 0.2 && Lh <= 3 ? Lh / sudoreA(1, l.T) : null };
  });
  const out = { gh: {}, gara: {}, sudore: {}, tarato: {}, sodioMgL: R.sodioMgL, T, prove, prog, ultima: {}, lunga: !!R.rampa, nomeGara: R.nomeGara || null };
  for (const sp of ["bici", "corsa"]) {
    const P = prove.filter((p) => p.sport === sp && p.gh !== null && daysBetween(parseYMD(p.d), now) >= 0 && daysBetween(parseYMD(p.d), now) <= 42);
    const u = P[P.length - 1];
    let tetto = R[sp].da; // senza prove: dose di partenza
    if (u && u.stomaco === "problemi") tetto = Math.max(R[sp].da - 10, u.gh - 10);
    else if (u && u.stomaco === "pesante") tetto = Math.max(R[sp].da - 10, u.gh);
    else if (u) tetto = Math.max(R[sp].da, ...P.filter((p) => p.stomaco === "bene").map((p) => p.gh)) + 10;
    out.gh[sp] = Math.max(R[sp].da - 10, Math.min(r5(R[sp].da + (R[sp].a - R[sp].da) * prog), r5(tetto)));
    out.gara[sp] = R[sp].a;
    out.ultima[sp] = u || null;
    const M = prove.filter((p) => p.sport === sp && p.Lh18 !== null).slice(-5).map((p) => p.Lh18);
    out.sudore[sp] = M.length >= 2 ? MED(M) : M.length === 1 ? (R.sudore[sp] + M[0]) / 2 : R.sudore[sp];
    out.tarato[sp] = M.length;
  }
  return out;
}
// litri, ml da bere e sodio all'ora per una seduta (al chiuso conta come 24 °C: niente vento, si suda di più)
function idratazione(rif, sport, indoor) {
  const T = indoor ? 24 : rif.T ?? 18;
  const Lh = Math.max(0.4, Math.min(2.5, sudoreA(rif.sudore[sport] || 1, T)));
  const r50 = (v) => Math.round(v / 50) * 50;
  return { T, Lh, ml: r50(Math.max(Math.min(400, Lh * 800), Math.min(900, Lh * 700))), na: r50(Math.max(250, Math.min(1000, Lh * rif.sodioMgL * 0.5))) };
}
const elencoIt = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1] : xs.join(""));

// Le dosi di questa persona: rampa solo verso una gara lunga; sudore di partenza in proporzione al peso
function rifParametri(peso) {
  const R = CONFIG.rifornimento, G = CONFIG.obiettivo;
  const lunga = !!(G && G.data && R.gareLunghe.includes(G.tipo));
  const k = Math.max(0.75, Math.min(1.3, (peso || 75) / 75));
  const gd = lunga ? parseYMD(G.data) : null;
  return {
    rampa: lunga ? { inizio: ymd(addDays(gd, -7 * R.settimane[0])), fine: ymd(addDays(gd, -7 * R.settimane[1])) } : null,
    bici: { da: R.bici.da, a: lunga ? R.bici.a : R.bici.da }, corsa: { da: R.corsa.da, a: lunga ? R.corsa.a : R.corsa.da },
    sudore: { corsa: R.sudore.corsa * k, bici: R.sudore.bici * k }, sodioMgL: R.sodioMgL, nomeGara: lunga ? G.nome : null,
  };
}

// Massa magra: dalla % di grasso del profilo (bilancia) se c'è, altrimenti formula di Boer da peso e altezza
function massaMagra(corpo, peso) {
  const bf = num(corpo && +corpo.grasso);
  if (bf !== null && bf >= 3 && bf <= 60) return { kg: peso * (1 - bf / 100), fonte: "bilancia" };
  const h = +(corpo && corpo.altezza) || 175;
  const kg = corpo && corpo.sesso === "F" ? 0.252 * peso + 0.473 * h - 48.3 : 0.407 * peso + 0.267 * h - 19.2;
  return { kg: Math.max(0.5 * peso, Math.min(0.95 * peso, kg)), fonte: "stima" };
}
// Metabolismo a riposo: ten Haaf 2014 (la più precisa negli atleti, altezza in metri) oppure Mifflin-St Jeor
function metabolismo(corpo, pesoKg, pesoOb, G0, now) {
  const N = CONFIG.nutrizione;
  corpo = corpo || {};
  const anni = corpo.anno ? now.getFullYear() - +corpo.anno : 35, altezza = +corpo.altezza || 175, maschio = corpo.sesso !== "F";
  const formula = N.metabolismo === "mifflin" ? "mifflin" : "tenHaaf";
  const bmr = formula === "mifflin"
    ? 10 * pesoKg + 6.25 * altezza - 5 * anni + (maschio ? 5 : -161)
    : 11.936 * pesoKg + 587.728 * (altezza / 100) - 8.129 * anni + (maschio ? 191.027 : 0) + 29.279;
  const MM = massaMagra(corpo, pesoKg);
  return {
    peso: pesoKg, bmr, formula, sesso: maschio ? "M" : "F", ffm: MM.kg, ffmFonte: MM.fonte,
    base: Math.round((bmr * (+N.fattoreBase || 1.3)) / 10) * 10, pesoObiettivo: pesoOb,
    dimagrire: !!(pesoOb && pesoOb < pesoKg - 0.5), daProfilo: !!(corpo.peso && corpo.altezza && corpo.anno && corpo.sesso),
    fineDimagrimento: G0 && G0.data ? ymd(addDays(parseYMD(G0.data), -7 * (N.stopPrimaDellaGara || 12))) : null,
  };
}

// Calorie che imparano. Filtro di Kalman sul bilancio energetico, con la stessa struttura di adaptive-macro
// (github.com/cramnivek/adaptive-macro, © 2026 cramnivek, licenza MIT). Qui lo stato è [peso di tendenza, scarto]:
// lo scarto è quanto consumi davvero in più (o in meno) rispetto alla stima dell'app (base + allenamento).
// Ogni giorno col cibo registrato il peso previsto cambia di (mangiato − stimato − scarto) / 7.700 kcal per kg;
// le pesate correggono il peso, e lo scarto si muove quel tanto che serve per spiegarle.
// Limiti: se il cibo registrato è incompleto lo scarto esce troppo basso; servono un paio di settimane di dati.
function calorieAdattive(pesi, mangiato, stimato, oggi, opz) {
  const o = Object.assign({ rho: 7700, rumoreBilancia: 0.7, rumorePeso: 0.05, volatilita: 12, senzaCibo: 0.35, sdIniziale: 350, sigma: 3, giorni: 42, maxCorrezione: 300, minPesate: 8, minGiorniCibo: 14, sdMax: 120, rumoreExtra: {} }, opz || {});
  const mm = (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]], [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
  const tr = (A) => [[A[0][0], A[1][0]], [A[0][1], A[1][1]]];
  const add = (A, B) => [[A[0][0] + B[0][0], A[0][1] + B[0][1]], [A[1][0] + B[1][0], A[1][1] + B[1][1]]];
  const da = ymd(addDays(parseYMD(oggi), -o.giorni));
  const P0 = (pesi || []).filter((w) => w.d >= da && w.d <= oggi && num(w.v) !== null);
  const vuoto = { attivo: false, scarto: 0, correzione: 0, sd: o.sdIniziale, pesate: P0.length, giorniCibo: 0, affidabilita: "nessuna" };
  if (!P0.length) return vuoto;
  const pMap = new Map(P0.map((w) => [w.d, w.v]));
  let x = [P0[0].v, 0], P = [[o.rumoreBilancia ** 2, 0], [0, o.sdIniziale ** 2]];
  let pesate = 0, giorniCibo = 0, scartate = 0;
  const F = [[1, -1 / o.rho], [0, 1]];
  for (let d = parseYMD(P0[0].d), k = ymd(d); k <= oggi; d = addDays(d, 1), k = ymd(d)) {
    if (pMap.has(k)) {
      pesate++;
      let R = o.rumoreBilancia ** 2 * (o.rumoreExtra[k] || 1);
      const inn = pMap.get(k) - x[0];
      let S = P[0][0] + R;
      const z = Math.abs(inn) / Math.sqrt(S);
      if (z > o.sigma) { R *= (z / o.sigma) ** 2; S = P[0][0] + R; scartate++; } // pesata strana: conta meno
      const K0 = P[0][0] / S, K1 = P[1][0] / S;
      x = [x[0] + K0 * inn, x[1] + K1 * inn];
      const A = [[1 - K0, 0], [-K1, 1]];
      P = add(mm(mm(A, P), tr(A)), [[K0 * K0 * R, K0 * K1 * R], [K1 * K0 * R, K1 * K1 * R]]);
    }
    if (k === oggi) break;
    const mg = mangiato[k], st = stimato[k];
    if (num(mg) !== null && num(st) !== null) {
      giorniCibo++;
      x = [x[0] + (mg - st - x[1]) / o.rho, x[1]];
      P = add(mm(mm(F, P), tr(F)), [[o.rumorePeso ** 2, 0], [0, o.volatilita ** 2]]);
    } else P = add(P, [[o.rumorePeso ** 2 + o.senzaCibo ** 2, 0], [0, o.volatilita ** 2]]); // senza cibo: solo più incertezza
  }
  const sd = Math.sqrt(Math.max(0, P[1][1])), scarto = Math.round(x[1]);
  const attivo = pesate >= o.minPesate && giorniCibo >= o.minGiorniCibo && sd <= o.sdMax;
  return {
    attivo, scarto, sd: Math.round(sd), pesate, giorniCibo, scartate, pesoTendenza: +x[0].toFixed(1),
    correzione: attivo ? Math.max(-o.maxCorrezione, Math.min(o.maxCorrezione, scarto)) : 0,
    affidabilita: sd < 75 ? "alta" : sd < 150 ? "media" : "bassa",
  };
}

// Il piano del giorno. Ordine: proteine fisse per kg, carboidrati in g/kg secondo il carico, grassi con un minimo,
// e il deficit (in % del peso a settimana, più forte nei giorni leggeri) è l'ultima cosa a cedere.
// x = { oggi, peso, np, trend: { w7, rate }, sedute: [{ sport, min, nome, qualita, fatta, indoor }], esercizio, peggiore, domaniChiave, rif, salute }
const DEFICIT_PESI = { riposo: 1.5, medio: 1.5, duro: 0.7, lungo: 0.3, carico: 0 };
const CARBO_GKG = { riposo: 3, medio: 4.5, duro: 6, lungo: 7, carico: 10 };
// I due giorni prima di una gara lunga: carico di carboidrati
function giornoDiCarico(oggi) {
  const G = CONFIG.obiettivo, R = CONFIG.rifornimento || {};
  if (!G || !G.data || !(R.gareLunghe || []).includes(G.tipo) || CONFIG.nutrizione.caricoPreGara === false) return false;
  const k = daysBetween(parseYMD(oggi), parseYMD(G.data));
  return k >= 1 && k <= 2;
}
function pianoNutrizione(x) {
  const N = CONFIG.nutrizione, np = x.np;
  const peso = x.peso || np.peso;
  const r5 = (v) => Math.round(v / 5) * 5, r10 = (v) => Math.round(v / 10) * 10;
  const end = x.sedute.filter((s) => ["corsa", "bici", "nuoto", "forza"].includes(s.sport));
  const minTot = end.reduce((t, s) => t + s.min, 0);
  const esercizio = Math.round(x.esercizio || 0);
  // tipo di giorno: carico (2 giorni prima di una gara lunga), lungo (corsa da 90', bici da 2 ore),
  // duro (allenamento da 12 kcal per kg o una qualità di corsa o bici), medio, riposo
  const lungo = end.some((s) => (s.sport === "corsa" && s.min >= 90) || (s.sport === "bici" && s.min >= 120));
  const duro = !lungo && (esercizio >= 12 * peso || end.some((s) => s.qualita && (s.sport === "corsa" || s.sport === "bici")));
  const carico = giornoDiCarico(x.oggi);
  const tipo = carico ? "carico" : lungo ? "lungo" : duro ? "duro" : end.length ? "medio" : "riposo";
  const fase = !np.dimagrire || (x.trend.w7 !== null && x.trend.w7 <= np.pesoObiettivo) || (np.fineDimagrimento && x.oggi >= np.fineDimagrimento) ? "mantenimento" : "dimagrimento";
  const base = np.base, tdee = base + esercizio;
  const motivi = [];
  const RIT = N.ritmo || { lento: 0.25, veloce: 0.9 }, COR = N.correzione || { piuCibo: 250, menoCibo: 150 };
  // --- deficit: calo settimanale in % del peso (7.700 kcal per kg), distribuito al contrario del carico
  const pct = Math.max(0, Math.min(1, +N.ritmoCalo || 0.5));
  const medioGiorno = ((pct / 100) * peso * 7700) / 7;
  const PESI = N.pesoDeficit || DEFICIT_PESI;
  let deficit = fase === "mantenimento" || tipo === "carico" ? 0 : Math.round(medioGiorno * (PESI[tipo] ?? 1));
  const AD = np.adattive && np.adattive.attivo ? np.adattive : null;
  if (AD && Math.abs(AD.correzione) >= 50) motivi.push(`Base tarata sulle tue pesate e sul cibo registrato: ${AD.correzione > 0 ? "+" : "−"}${fmtIt(Math.abs(AD.correzione))} kcal (affidabilità ${AD.affidabilita}).`);
  if (deficit && x.trend.rate !== null && !AD) {
    const rPct = (x.trend.rate / peso) * 100; // negativo quando cali
    if (rPct < -RIT.veloce) { deficit = Math.max(0, deficit - COR.piuCibo); motivi.push(`Stai calando in fretta (${fmtIt(x.trend.rate, 1)} kg a settimana, ${fmtIt(-rPct, 1)}% del peso): ${COR.piuCibo} kcal in più.`); }
    else if (rPct > -RIT.lento) { deficit += COR.menoCibo; motivi.push(`Calo lento (${x.trend.rate <= 0 ? "−" : "+"}${fmtIt(Math.abs(x.trend.rate), 1)} kg a settimana): ${COR.menoCibo} kcal in meno.`); }
  }
  if (deficit && x.peggiore === "rosso") { deficit = Math.round(deficit / 2); motivi.push(`Recupero in rosso: oggi metà deficit (${deficit} kcal), per recuperare meglio.`); }
  if (deficit && x.salute) {
    if (x.salute.carb.deficit === "zero") { deficit = 0; motivi.push("Malattia: niente deficit finché non torni ad allenarti normalmente, per guarire prima."); }
    else { deficit = Math.round(deficit / 2); motivi.push(`Infortunio: metà deficit (${deficit} kcal), i tessuti guariscono meglio con energia sufficiente.`); }
  }
  // --- limiti di sicurezza: nessuna regola sopra può scendere sotto questi (si mostra solo l'ultimo che decide)
  let limite = null;
  if (deficit) {
    const quota = +N.deficitMaxQuota || 0.25, cap = Math.round(quota * tdee);
    if (deficit > cap) { deficit = cap; limite = `Deficit fermato al ${Math.round(quota * 100)}% delle calorie di oggi (${cap} kcal).`; }
    const sesso = np.sesso || "M";
    const EAmin = (N.energiaMin || {})[sesso] || (sesso === "F" ? 30 : 25);
    const ffm = np.ffm || 0.8 * peso;
    const maxEA = Math.max(0, Math.round(base - EAmin * ffm));
    if (deficit > maxEA) { deficit = maxEA; limite = `Deficit ridotto a ${maxEA} kcal: tolto l'allenamento, devono restarti almeno ${EAmin} kcal per kg di massa magra.`; }
    const kMin = (N.kcalMin || {})[sesso] || (sesso === "F" ? 1500 : 1800);
    const maxK = Math.max(0, Math.round(tdee - kMin));
    if (deficit > maxK) { deficit = maxK; limite = `Deficit ridotto a ${maxK} kcal: mai meno di ${fmtIt(kMin)} kcal al giorno.`; }
  }
  const deficitPiano = deficit;
  // --- macro: proteine → carboidrati per il carico → grassi con un minimo
  let kcal = tdee - deficit;
  const PG = N.proteineGkg && typeof N.proteineGkg === "object" ? N.proteineGkg[fase] : +N.proteineGkg || 1.8;
  const P = r5(PG * peso);
  const CG = N.carboGkg || CARBO_GKG;
  const vigilia = x.domaniChiave && (tipo === "riposo" || tipo === "medio" || tipo === "duro") ? +N.carboVigilia || 0 : 0;
  const Cobj = r5(((CG[tipo] ?? 4.5) + vigilia) * peso);
  const Cmin = r5((+N.carboMinGkg || 3) * peso);
  // per tenere il deficit i carboidrati scendono solo nei giorni leggeri, mai sotto il minimo; nei giorni duri e lunghi non si toccano
  const Cpav = tipo === "riposo" || tipo === "medio" ? Math.min(Cobj, Cmin + r5(vigilia * peso)) : Cobj; // i carboidrati della vigilia non si tolgono
  const gKg = (+N.grassiMinGkg || 0.8) * peso, gQ = tipo === "carico" ? 0 : +N.grassiMinQuota || 0.2;
  const gMin = (k) => Math.max(gKg, (gQ * k) / 9), gMax = (k) => ((+N.grassiMaxQuota || 0.35) * k) / 9;
  let C = Cobj, G = (kcal - 4 * P - 4 * C) / 9;
  if (fase === "mantenimento" && tipo !== "carico") {
    // senza deficit l'energia in più va ai carboidrati: grassi a circa 1 g per kg, nei limiti
    G = Math.max(gMin(kcal), Math.min(gMax(kcal), (+N.grassiGkgMantenimento || 1.0) * peso));
    C = Math.max(Cpav, (kcal - 4 * P - 9 * G) / 4);
    G = (kcal - 4 * P - 4 * C) / 9;
  }
  if (G < gMin(kcal)) {
    C = Math.max(Cpav, (kcal - 4 * P - 9 * gMin(kcal)) / 4);
    G = (kcal - 4 * P - 4 * C) / 9;
    if (G < gMin(kcal)) {
      // non ci sta: si mangia di più (cala il deficit, o nei giorni di carico si va sopra il consumo)
      kcal = Math.max(4 * P + 4 * C + 9 * gKg, (4 * P + 4 * C) / (1 - gQ));
      G = gMin(kcal);
    }
  } else if (G > gMax(kcal)) { G = gMax(kcal); C = (kcal - 4 * P - 9 * G) / 4; }
  C = r5(C); G = r5(G);
  kcal = r10(4 * P + 9 * G + 4 * C);
  deficit = Math.max(0, Math.round(tdee - kcal));
  if (deficit < 50) deficit = 0; // differenze da arrotondamento: non è un deficit
  const surplus = Math.max(0, Math.round(kcal - tdee));
  if (tipo === "carico") motivi.push(`Carico di carboidrati per ${CONFIG.obiettivo.nome || "la gara"}: ${fmtIt(C / peso, 0)} g per kg, niente deficit, pochi grassi e poca fibra. Se lo stomaco non regge, scendi a 8 g per kg.`);
  else if (vigilia) motivi.push(`Domani ${x.domaniChiave}: +${fmtIt(vigilia, 0)} g per kg di carboidrati oggi, soprattutto a cena${deficitPiano && deficit < deficitPiano - 60 ? (deficit ? `; il deficit scende a ${deficit} kcal` : "; oggi niente deficit") : ""}.`);
  else if (deficitPiano && deficit < deficitPiano - 60) motivi.push(tipo === "duro" || tipo === "lungo"
    ? (deficit ? `Giorno chiave: deficit ridotto a ${deficit} kcal, i carboidrati servono all'allenamento.` : "Giorno chiave: niente deficit oggi, i carboidrati servono all'allenamento.")
    : deficit ? `Oggi il deficit si ferma a ${deficit} kcal: con meno non resterebbero abbastanza carboidrati e grassi.` : "Oggi niente deficit: servono tutti per carboidrati e grassi.");
  else if (limite) motivi.push(limite);

  // durante le sedute ancora da fare (fanno parte dei carboidrati del giorno): carboidrati, acqua e sodio
  const RF = x.rif || { gh: { bici: CONFIG.rifornimento.bici.da, corsa: CONFIG.rifornimento.corsa.da }, sudore: CONFIG.rifornimento.sudore, sodioMgL: CONFIG.rifornimento.sodioMgL, T: null };
  const durante = [];
  for (const s of x.sedute.filter((y) => !y.fatta && (y.sport === "corsa" || y.sport === "bici") && y.min >= 60)) {
    const I = idratazione(RF, s.sport, s.indoor), acqua = `${I.ml} ml d'acqua all'ora con ${I.na} mg di sodio`;
    const S = schemaRifornimento(s.sport, s.min, RF, s.indoor), cibo = S ? descriviSchema(S) : "";
    if (cibo) durante.push({ g: S.g, t: `${s.nome}: ${cibo}; ${acqua}.` });
    else if (s.indoor || (RF.T ?? 18) >= 22) durante.push({ g: 0, t: `${s.nome}: ${acqua}${s.indoor ? ", al chiuso si suda di più" : ""}.` });
  }
  const D = durante.reduce((t, d) => t + d.g, 0);
  // pasti: una giornata all'italiana, con le quantità di oggi
  const nuoto = x.sedute.some((s) => s.sport === "nuoto" && !s.fatta), chiave = tipo === "duro" || tipo === "lungo";
  const CB = tipo === "carico" ? r5(1.5 * peso) : lungo ? r5(1.0 * peso) : tipo === "duro" ? r5(0.7 * peso) : r5(0.5 * peso);
  const ME = 25, NOTTE = 10;
  const R = chiave ? Math.min(r5(0.8 * peso), Math.max(0, r5((C - D - CB - ME - NOTTE) * 0.3))) : 0;
  const resto = Math.max(0, C - D - CB - ME - NOTTE - R);
  const quotaCena = x.domaniChiave ? 0.55 : 0.5;
  // pranzo e cena al massimo 130 g di carboidrati (circa 180 g di pasta), 200 nel carico: il resto negli spuntini
  const capPasto = tipo === "carico" ? 200 : 130;
  const cenaC = Math.min(capPasto, resto * quotaCena), pranzoC = Math.min(capPasto, resto - cenaC);
  const extra = r5(Math.max(0, resto - cenaC - pranzoC));
  const pasta = (c) => Math.max(60, r10(c / 0.72));
  const fette = (c) => Math.max(2, Math.round(c / 7.5));
  const colaz = (c, avena = true) => c <= 60 ? `${fette(c)} fette biscottate con miele o marmellata${avena ? ` (o ${r5(c / 0.6)} g di avena)` : ""}` : `6 fette biscottate più ${r10((c - 45) / 0.5)} g di pane con miele o marmellata`;
  const prot = peso >= 75 ? "150 g di pollo o 200 g di pesce" : "120 g di pollo o 160 g di pesce";
  const pasti = [];
  if (nuoto) {
    pasti.push(["Prima", `Metà dei carboidrati della colazione: ${colaz(CB / 2)}.`]);
    pasti.push(["Dopo", `L'altra metà: ${colaz(CB / 2, false)}, più 300 ml di latte o 150 g di yogurt greco e 20 g di frutta secca.`]);
  } else pasti.push(["Colazione", `${colaz(CB)}, 300 ml di latte o 150 g di yogurt greco, 20 g di frutta secca.${lungo ? " Due o tre ore prima del lungo." : ""}`]);
  pasti.push(["Merenda", "Un frutto con 20 g di proteine e 20 g di frutta secca; prima di una seduta, 1h30–2 ore prima."]);
  for (const d of durante) pasti.push(["Durante", d.t]);
  if (R) pasti.push(["Recupero", `Entro un'ora dalla seduta principale: ${R} g di carboidrati e 25–30 g di proteine (per esempio ${r10(R / 0.5)} g di pane con marmellata e 150 g di yogurt greco).`]);
  pasti.push(["Pranzo", `${pasta(pranzoC)} g di pasta, riso o cereali (o ${r10(pasta(pranzoC) * 1.2)} g di pane), ${prot}, 10 g di olio, verdure${tipo === "carico" ? " poche e cotte" : ""}.`]);
  if (extra) pasti.push(["Spuntino", tipo === "carico" ? `${extra} g di carboidrati in più, in 2–3 spuntini: pane bianco e marmellata, riso, gallette, succo di frutta, banane.` : `${extra} g di carboidrati in più, dove ti è comodo: pane e marmellata, una banana, gallette.`]);
  pasti.push(["Cena", `${pasta(cenaC)} g di pasta, riso o cereali, una proteina, 10 g di olio, ${x.domaniChiave || tipo === "carico" ? `poca fibra e verdure cotte${x.domaniChiave ? `: domani ${x.domaniChiave}` : ""}.` : "verdure."}`]);
  pasti.push(["Sera", "Se hai fame prima di dormire: yogurt greco o ricotta, circa 25 g di proteine."]);
  return { fase, tipo, peso, base, tdee, esercizio, deficit, deficitPiano, surplus, kcal, P, G, C, gkg: C / peso, pasti, motivi, durante: D, minTot, formula: np.formula || "mifflin" };
}

