// ------------------------------------------------------------
//  Analisi
// ------------------------------------------------------------
// Tendenza dell'HRV: media di 7 giorni del ln rMSSD (almeno 3 notti) e fascia normale dai 60 giorni prima (almeno 20 notti)
function trendHRV(wellness, oggi) {
  const v = (w) => { const x = num(w.hrv) ?? num(w.hrvSDNN); return x !== null && x > 0 ? Math.log(x) : null; };
  const d0 = parseYMD(oggi), fa = (w) => daysBetween(parseYMD(w.id), d0);
  const ult = wellness.filter((w) => fa(w) >= 0 && fa(w) <= 6).map(v).filter((x) => x !== null);
  const base = wellness.filter((w) => fa(w) >= 7 && fa(w) <= 66).map(v).filter((x) => x !== null);
  if (ult.length < 3 || base.length < 20) return null;
  const r7 = mean(ult), mu = mean(base), sdv = sd(base) || 0.05;
  return { r7, mu, sdv, lo: mu - 0.5 * sdv, hi: mu + 0.5 * sdv, n7: ult.length, nBase: base.length, ms7: Math.round(Math.exp(r7)), msLo: Math.round(Math.exp(mu - 0.5 * sdv)), msHi: Math.round(Math.exp(mu + 0.5 * sdv)) };
}

function analyze(raw, now, diary) {
  completaSoglie(raw);
  const today = ymd(now);
  const tomorrow = ymd(addDays(now, 1));
  const mon = mondayOf(now);
  const sun = addDays(mon, 6);
  const S = CONFIG.soglie;

  const wellness = (raw.wellness || []).filter((w) => w && w.id).sort((a, b) => a.id.localeCompare(b.id));
  const wToday = wellness.find((w) => w.id === today) || wellness[wellness.length - 1] || {};
  const prev = wellness.filter((w) => w.id < (wToday.id || today)).slice(-7);

  const events = (raw.events || []).filter((e) => e && (e.category || "WORKOUT") === "WORKOUT" && e.start_date_local);
  const evDate = (e) => e.start_date_local.slice(0, 10);
  const acts = (raw.activities || []).filter((a) => a && a.start_date_local);
  const actDate = (a) => a.start_date_local.slice(0, 10);
  const durOf = (x) => num(x.moving_time) ?? num(x.elapsed_time) ?? num(x.duration) ?? 0;
  const loadOf = (x) => num(x.icu_training_load) ?? num(x.training_load) ?? null;

  // --- Sistemico
  const sys = { state: "verde", reasons: [], hasData: false };
  const bump = (o, s) => { const r = { verde: 0, giallo: 1, rosso: 2 }; if (r[s] > r[o.state]) o.state = s; };
  const hrv = num(wToday.hrv) ?? num(wToday.hrvSDNN);
  const hrvPrev = prev.map((w) => num(w.hrv) ?? num(w.hrvSDNN)).filter((x) => x !== null);
  let hrvMean = null;
  if (hrv !== null) { sys.hasData = true; if (hrvPrev.length >= 3) hrvMean = mean(hrvPrev); }
  const rhr = num(wToday.restingHR);
  const rhrPrev = prev.map((w) => num(w.restingHR)).filter((x) => x !== null);
  let rhrMean = null;
  if (rhr !== null) {
    sys.hasData = true;
    if (rhrPrev.length >= 3) {
      rhrMean = mean(rhrPrev); const d = rhr - rhrMean;
      if (d >= S.fcRiposoRosso) { bump(sys, "rosso"); sys.reasons.push(`FC a riposo +${Math.round(d)}`); }
      else if (d >= S.fcRiposoGiallo) { bump(sys, "giallo"); sys.reasons.push(`FC a riposo +${Math.round(d)}`); }
    }
  }
  const sleepScore = num(wToday.sleepScore);
  const sleepSecs = num(wToday.sleepSecs);
  if (sleepScore !== null) { sys.hasData = true; if (sleepScore < S.sonnoGiallo) { bump(sys, "giallo"); sys.reasons.push("sonno scarso"); } }
  if (sleepSecs !== null && sleepSecs < S.sonnoOreGiallo * 3600) { sys.hasData = true; bump(sys, "giallo"); sys.reasons.push("poche ore di sonno"); }
  const ctl = num(wToday.ctl) ?? num(wToday.icu_ctl);
  const atl = num(wToday.atl) ?? num(wToday.icu_atl);
  const tsb = ctl !== null && atl !== null ? ctl - atl : null;
  if (tsb !== null) { sys.hasData = true; if (tsb < S.tsbRosso) { bump(sys, "rosso"); sys.reasons.push("forma troppo negativa"); } }
  // HRV: conta la tendenza, non la singola notte (Plews, Javaloyes). Media di 7 giorni del ln rMSSD contro la tua fascia
  // normale (60 giorni prima, ± 0,5 deviazioni standard). Una notte storta da sola accende il giallo solo se anche
  // la FC a riposo o il sonno dicono la stessa cosa. Con meno di 20 notti nei 60 giorni vale la regola semplice di prima.
  const altriSegnali = (rhr !== null && rhrMean !== null && rhr - rhrMean >= S.fcRiposoGiallo) || (sleepScore !== null && sleepScore < S.sonnoGiallo) || (sleepSecs !== null && sleepSecs < S.sonnoOreGiallo * 3600);
  const hrvTrend = trendHRV(wellness, wToday.id || today);
  if (hrv !== null && hrvTrend) {
    const { r7, lo, hi, sdv, mu } = hrvTrend;
    if (r7 < mu - 1.5 * sdv || (r7 < lo && altriSegnali)) { bump(sys, r7 < mu - 1.5 * sdv && altriSegnali ? "rosso" : "giallo"); sys.reasons.push("HRV della settimana sotto la tua fascia"); }
    else if (r7 < lo) { bump(sys, "giallo"); sys.reasons.push("HRV della settimana sotto la tua fascia"); }
    else if (r7 > hi + sdv && tsb !== null && tsb < -20) { bump(sys, "giallo"); sys.reasons.push("HRV insolitamente alta con molto carico"); }
    else if (Math.log(hrv) < r7 - 2 * sdv && altriSegnali) { bump(sys, "giallo"); sys.reasons.push("HRV di stanotte bassa"); }
  } else if (hrv !== null && hrvPrev.length >= 3) {
    const s = sd(hrvPrev) || 1;
    if (hrv < hrvMean - 2 * s) { bump(sys, "rosso"); sys.reasons.push("HRV molto bassa"); }
    else if (hrv < hrvMean - s) { bump(sys, "giallo"); sys.reasons.push("HRV sotto la media"); }
  }

  // --- Tessuti
  const tis = { state: "verde", reasons: [] };
  for (const a of acts) {
    const hours = (now - new Date(a.start_date_local)) / 3600000;
    if (hours < 0 || hours > 72) continue;
    const sp = sportOf(a.type);
    const elev = num(a.total_elevation_gain) ?? 0;
    const planned = events.find((e) => evDate(e) === actDate(a) && sportOf(e.type) === sp);
    const ratio = planned && loadOf(planned) && loadOf(a) ? loadOf(a) / loadOf(planned) : null;
    let s = null; let why = "";
    if (sp === "corsa" && elev >= S.dislivelloCorsa) { s = "giallo"; why = `${Math.round(elev)} m D+ in corsa`; }
    if (ratio !== null && ratio >= S.caricoOltrePiano) { s = "giallo"; why = `carico al ${Math.round(ratio * 100)}% del piano`; }
    if (s && hours < 48 && ((sp === "corsa" && elev >= 2 * S.dislivelloCorsa) || (ratio && ratio >= 2.5))) s = "rosso";
    if (s) { bump(tis, s); tis.reasons.push(why); }
  }
  const worst = [sys.state, tis.state].includes("rosso") ? "rosso" : [sys.state, tis.state].includes("giallo") ? "giallo" : "verde";

  // --- Sedute (con stato svolto)
  const matchAct = (e) => (e.id !== undefined && acts.find((a) => a.paired_event_id !== undefined && a.paired_event_id !== null && String(a.paired_event_id) === String(e.id))) || acts.find((a) => actDate(a) === evDate(e) && sportOf(a.type) === sportOf(e.type) && (a.paired_event_id === undefined || a.paired_event_id === null));
  const enrich = (e) => ({ ...e, sport: sportOf(e.type), date: evDate(e), min: Math.round(durOf(e) / 60), load: loadOf(e), parsed: parseWorkout(e), done: matchAct(e) || null });
  const todayEv = events.filter((e) => evDate(e) === today).map(enrich);
  const tomorrowEv = events.filter((e) => evDate(e) === tomorrow).map(enrich);
  const gymToday = CONFIG.palestra[now.getDay()] || null;
  const mainToday = todayEv.slice().sort((a, b) => (b.load || 0) - (a.load || 0))[0];

  let verdict;
  if (!sys.hasData && worst === "verde") verdict = "Dati di recupero non ancora sincronizzati. Ascolta le sensazioni del risveglio.";
  else if (worst === "verde") verdict = "Recupero completo: corpo pronto per il carico previsto oggi.";
  else if (worst === "rosso") verdict = `Segnali rossi (${[...sys.reasons, ...tis.reasons].join(", ")}). Oggi solo mobilità e sonno: ripianifica le sedute dure.`;
  else if (sys.state === "verde") {
    const alt = CONFIG.sport.filter((x) => x !== "corsa").map((x) => (x === "bici" ? "bici facile" : "nuoto"));
    verdict = `Cuore pronto, tessuti no (${tis.reasons.join(", ")}). Niente intensità${CONFIG.sport.includes("corsa") ? " né discese in corsa" : ""}${alt.length ? `; ${alt.join(" e ")} ${alt.length > 1 ? "vanno" : "va"} bene` : ": oggi solo sedute facili e brevi"}.`;
  }
  else verdict = `Recupero incompleto (${sys.reasons.join(", ")}). Fai le sedute in Z2 e rimanda l'intensità di 24–48 ore.`;

  // --- Sonno
  const sleepPrev = prev.map((w) => num(w.sleepSecs)).filter((x) => x !== null);
  const QUAL = { 1: "Ottima", 2: "Buona", 3: "Media", 4: "Scarsa" };
  const sleep = {
    secs: sleepSecs, score: sleepScore,
    avgSecs: sleepPrev.length ? mean(sleepPrev) : null,
    quality: QUAL[num(wToday.sleepQuality)] || null,
    hrSleep: num(wToday.avgSleepingHR),
    resp: num(wToday.respiration),
    spo2: num(wToday.spO2),
    readiness: num(wToday.readiness),
    week: wellness.slice(-7).map((w) => ({ d: parseYMD(w.id).getDay(), secs: num(w.sleepSecs), score: num(w.sleepScore), hrv: num(w.hrv) ?? num(w.hrvSDNN), rhr: num(w.restingHR) })),
  };

  // --- Settimane (questa e prossima)
  const buildWeek = (start) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i); const ds = ymd(d);
      const evs = events.filter((e) => evDate(e) === ds).map(enrich);
      const unplanned = acts.filter((a) => actDate(a) === ds && !evs.some((e) => e.done === a));
      days.push({ date: d, ds, isToday: ds === today, isPast: ds < today, evs, extra: unplanned, gym: CONFIG.palestra[d.getDay()] || null });
    }
    const all = days.flatMap((x) => x.evs);
    const sports = ["nuoto", "bici", "corsa", "forza"];
    const per = {};
    for (const s of sports) per[s] = { planned: all.filter((e) => e.sport === s).reduce((t, e) => t + durOf(e), 0), n: all.filter((e) => e.sport === s).length };
    const doneSec = days.flatMap((x) => [...x.evs.filter((e) => e.done).map((e) => e.done), ...x.extra]).reduce((t, a) => t + durOf(a), 0);
    return {
      start, days, per, n: all.length,
      plannedSec: all.reduce((t, e) => t + durOf(e), 0), doneSec,
      loadPlanned: all.reduce((t, e) => t + (e.load || 0), 0),
      loadDone: days.flatMap((x) => [...x.evs.filter((e) => e.done).map((e) => e.done), ...x.extra]).reduce((t, a) => t + (loadOf(a) || 0), 0),
    };
  };
  const weeks = [buildWeek(mon), buildWeek(addDays(mon, 7))];

  // --- Nastro della stagione: carico delle ultime 11 settimane, questa e la prossima
  const season = [];
  for (let k = 11; k >= 1; k--) {
    const s = addDays(mon, -7 * k), e = addDays(s, 7);
    season.push({ done: acts.filter((a) => { const t = new Date(a.start_date_local); return t >= s && t < e; }).reduce((t, a) => t + (loadOf(a) || 0), 0), plan: null });
  }
  season.push({ done: weeks[0].loadDone, plan: weeks[0].loadPlanned, cur: true });
  season.push({ done: 0, plan: weeks[1].loadPlanned });

  // --- Scala del lungo (questa domenica)
  const sunStr = ymd(sun);
  const ref = CONFIG.scalaLungo.find((s) => s.data === sunStr);
  const sunRun = events.filter((e) => evDate(e) === sunStr && sportOf(e.type) === "corsa").sort((a, b) => durOf(b) - durOf(a))[0];
  let ladderCheck = null;
  if (ref && ref.min === null) ladderCheck = { ok: true, text: "Domenica: settimana di scarico" };
  else if (ref && !sunRun) ladderCheck = { ok: false, text: `Domenica manca il lungo da ${fmtMin(ref.min)}` };
  else if (ref && sunRun) {
    const m = Math.round(durOf(sunRun) / 60);
    ladderCheck = Math.abs(m - ref.min) <= CONFIG.tolleranzaLungoMin
      ? { ok: true, text: `Lungo di domenica in linea con la scala (${fmtMin(ref.min)})` }
      : { ok: false, text: `Lungo a calendario ${fmtMin(m)}, la scala dice ${fmtMin(ref.min)}` };
  }

  // --- Fitness: storico + proiezione dal piano
  const fit = wellness.map((w) => {
    const c = num(w.ctl) ?? num(w.icu_ctl), a = num(w.atl) ?? num(w.icu_atl);
    return c === null || a === null ? null : { d: w.id, ctl: +c.toFixed(1), atl: +a.toFixed(1) };
  }).filter(Boolean);
  const proj = [];
  if (fit.length) {
    let c = fit[fit.length - 1].ctl, a = fit[fit.length - 1].atl;
    const lastDay = parseYMD(fit[fit.length - 1].d);
    const end = addDays(mon, 13);
    for (let d = addDays(lastDay, 1); d <= end; d = addDays(d, 1)) {
      const L = events.filter((e) => evDate(e) === ymd(d)).reduce((t, e) => t + (loadOf(e) || 0), 0);
      c += (L - c) / 42; a += (L - a) / 7;
      proj.push({ d: ymd(d), ctl: +c.toFixed(1), atl: +a.toFixed(1), p: 1 });
    }
  }

  // --- Peso: bilancia (Intervals), pesate scritte nell'app o arrivate da Salute; media di 7 giorni e ritmo su 2 settimane
  const N = CONFIG.nutrizione;
  const dia = diary || raw.diary || {};
  const corpo = (PROF && PROF.corpo) || {};
  const pesiMap = {};
  for (const w of wellness) if (num(w.weight) !== null) pesiMap[w.id] = num(w.weight);
  for (const [d, v] of Object.entries(dia.pesi || {})) if (num(v) !== null) pesiMap[d] = num(v);
  const pesi = Object.keys(pesiMap).sort().map((d) => ({ d, v: pesiMap[d] }));
  const giorniFa = (d) => daysBetween(parseYMD(d), now);
  const mediaPesi = (da, a) => { const xs = pesi.filter((w) => giorniFa(w.d) >= da && giorniFa(w.d) <= a).map((w) => w.v); return xs.length ? mean(xs) : null; };
  const w7 = mediaPesi(0, 6), wPrev = mediaPesi(14, 20);
  const ultimoPeso = pesi.length && giorniFa(pesi[pesi.length - 1].d) <= 14 ? pesi[pesi.length - 1].v : null;
  const pesoAtt = w7 ?? ultimoPeso ?? (num(corpo.peso) || null);
  const pesoOb = num(corpo.pesoObiettivo);
  const rate = w7 !== null && wPrev !== null ? (w7 - wPrev) / 2 : null;
  const eta = pesoOb && rate !== null && rate < -0.05 && (w7 ?? ultimoPeso) > pesoOb ? addDays(now, Math.round((((w7 ?? ultimoPeso) - pesoOb) / -rate) * 7)) : null;
  const sync = dia.pesiSync && dia.pesiSync.ultimo ? { ultimo: dia.pesiSync.ultimo, giorni: giorniFa(dia.pesiSync.ultimo) } : null;
  const trend = { w7, wPrev, rate, eta, ultimo: ultimoPeso, serie: pesi.filter((w) => giorniFa(w.d) <= 90), oggi: (dia.pesi && dia.pesi[today]) || null, sync };

  // --- Carburante: metabolismo dal profilo, allenamento dai consumi imparati, piano del giorno
  const pesoKg = pesoAtt || 70;
  const G0 = CONFIG.obiettivo;
  // % di grasso: dal profilo, altrimenti l'ultima della bilancia su Intervals (ultimi 60 giorni)
  const bfW = wellness.filter((w) => w && w.id && num(w.bodyFat) !== null && daysBetween(parseYMD(w.id), now) <= 60).sort((a, b) => a.id.localeCompare(b.id)).pop();
  const corpoN = num(+corpo.grasso) ? corpo : { ...corpo, grasso: bfW ? num(bfW.bodyFat) : null };
  const np = metabolismo(corpoN, pesoKg, pesoOb, G0, now), bmr = np.bmr;
  // Calorie che imparano: pesate, cibo registrato e consumi stimati delle ultime 6 settimane
  {
    const bm = bmr / 1440, stimato = {}, mangiato = {}, extra = {};
    for (let i = 1; i <= 42; i++) stimato[ymd(addDays(now, -i))] = np.base;
    for (const a of acts) { const d = actDate(a), kc = num(a.calories); if (stimato[d] !== undefined && kc) stimato[d] += Math.max(0, kc - bm * ((num(a.moving_time) || 0) / 60)); }
    // un giorno conta solo se il cibo registrato è plausibile come giornata intera
    for (const [d, L] of Object.entries(dia.cibo || {})) if (stimato[d] !== undefined) { const t = totaleCibo(L).kcal; if (t >= Math.max(1200, 0.5 * stimato[d])) mangiato[d] = t; }
    // attorno a una gara lunga il peso sale per glicogeno e acqua: quelle pesate contano un quarto
    if (G0 && G0.data) for (let k = -2; k <= 3; k++) extra[ymd(addDays(parseYMD(G0.data), k))] = 4;
    np.adattive = N.calorieAdattive === false ? null : calorieAdattive(pesi, mangiato, stimato, today, { rumoreExtra: extra, maxCorrezione: N.maxCorrezioneAdattiva || 300 });
    if (np.adattive && np.adattive.attivo && np.adattive.correzione) { np.baseFormula = np.base; np.base = Math.round((np.base + np.adattive.correzione) / 10) * 10; }
  }
  const lungoMin = N.lungoMin || 75;
  const todayMin = todayEv.reduce((t, e) => t + e.min, 0);
  const kcalActive = acts.filter((a) => actDate(a) === today).reduce((t, a) => t + (num(a.calories) || 0), 0);
  const fatteOggi = acts.filter((a) => actDate(a) === today);
  const K = consumiImparati(acts, pesoKg, now);
  // allenamento: le calorie vere delle sedute registrate e la stima di quelle da fare, al netto del metabolismo già nella base
  const bmrMin = bmr / 1440;
  const minSvolti = fatteOggi.reduce((t, a) => t + (num(a.moving_time) || 0) / 60, 0);
  const svolte = fatteOggi.length ? Math.max(0, kcalActive - bmrMin * minSvolti) : 0;
  const daFare = todayEv.filter((e) => !e.done).reduce((t, e) => t + e.min * Math.max(0, K.kpm(e.sport, classeSeduta(e.sport, e.min, e.name, 0)) - bmrMin), 0);
  const kcalEst = Math.round(todayEv.filter((e) => !e.done).reduce((t, e) => t + e.min * K.kpm(e.sport, classeSeduta(e.sport, e.min, e.name, 0)), 0));
  const alChiuso = (x) => x.trainer === true || /virtual/i.test(x.type || "") || /tapis|treadmill|indoor|rulli|spinning|cyclette/i.test(x.name || "");
  const tempi = acts.filter((a) => !alChiuso(a) && daysBetween(parseYMD(actDate(a)), now) <= 10 && num(a.average_weather_temp) !== null).map((a) => num(a.average_weather_temp));
  const tempRecente = tempi.length ? Math.round(mean(tempi)) : null;
  const rif = statoRifornimento(dia, now, tempRecente, rifParametri(pesoKg));
  const sedute = [
    ...todayEv.map((e) => ({ sport: e.sport, min: e.done ? Math.round(durOf(e.done) / 60) : e.min, nome: e.name || "Seduta", qualita: isQualityEv(e), fatta: !!e.done, indoor: alChiuso(e) })),
    ...fatteOggi.filter((a) => !todayEv.some((e) => e.done === a)).map((a) => ({ sport: sportOf(a.type), min: Math.round(durOf(a) / 60), nome: a.name || "Attività", qualita: QUALITY_RX.test(a.name || ""), fatta: true, indoor: alChiuso(a) })),
  ];
  const tomorrowKey = tomorrowEv.filter((e) => (e.sport === "corsa" && e.min >= 75) || (e.sport === "bici" && e.min >= 120)).sort((a, b) => b.min - a.min)[0];
  const saluteS = saluteDi(dia), saluteK = consigliSalute(saluteS, now);
  const piano = pianoNutrizione({ oggi: today, peso: pesoKg, np, trend, sedute, esercizio: svolte + daFare, peggiore: worst, domaniChiave: tomorrowKey ? tomorrowKey.name : null, rif, salute: saluteK });
  const longToday = piano.tipo === "lungo";
  const dayType = { carico: "Carico pre-gara", lungo: "Giorno lungo", duro: "Giorno duro", medio: "Giorno medio", riposo: "Giorno di riposo" }[piano.tipo];
  // la seduta lunga fatta oggi (da un'ora, corsa o bici): per segnare sudore e stomaco
  const lungaOggi = fatteOggi.filter((a) => ["corsa", "bici"].includes(sportOf(a.type)) && durOf(a) >= 3600).sort((a, b) => durOf(b) - durOf(a))[0];
  rif.oggi = lungaOggi ? (() => {
    const sp = sportOf(lungaOggi.type), min = Math.round(durOf(lungaOggi) / 60), ind = alChiuso(lungaOggi);
    const S = schemaRifornimento(sp, min, rif, ind);
    return { sport: sp, min, nome: lungaOggi.name || (sp === "bici" ? "Bici" : "Corsa"), indoor: ind, T: ind ? 24 : num(lungaOggi.average_weather_temp) ?? tempRecente ?? 18, carboPiano: S ? S.g : 0, salvato: (dia.lunghi || {})[today] || null, Lh: (rif.prove.find((p) => p.d === today) || {}).Lh ?? null };
  })() : null;
  // rifornimento delle sedute da fare (sotto la seduta e sull'orologio)
  const daFareEv = [...todayEv, ...tomorrowEv, ...weeks.flatMap((W) => W.days.flatMap((D) => D.evs))].filter((e) => !e.done && e.date >= today);
  for (const e of daFareEv) e.rif = schemaRifornimento(e.sport, e.min, rif, alChiuso(e));
  const visti = new Set();
  rif.orologio = daFareEv.filter((e) => e.rif && e.rif.voci.some((v) => v.tipo === "mangia") && !visti.has(e.id) && visti.add(e.id))
    .sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ nome: e.name || "Seduta", date: e.date, scritto: haAvvisi(e.description), n: e.rif.voci.length, senza: /senza avvisi/i.test(e.description || "") }));
  // domani: le sedute e il carburante del giorno (per il promemoria della sera)
  const gymDom = CONFIG.palestra[addDays(now, 1).getDay()] || null;
  const domEv = tomorrowEv.filter((e) => !e.done);
  const sedDom = domEv.map((e) => ({ sport: e.sport, min: e.min, nome: e.name || "Seduta", qualita: isQualityEv(e), fatta: false, indoor: alChiuso(e) }));
  if (gymDom && !sedDom.some((x) => x.sport === "forza")) sedDom.push({ sport: "forza", min: 60, nome: "Palestra", qualita: false, fatta: false });
  let pianoDom = null;
  try {
    const eDom = domEv.reduce((t, e) => t + e.min * Math.max(0, K.kpm(e.sport, classeSeduta(e.sport, e.min, e.name, 0)) - bmrMin), 0);
    pianoDom = pianoNutrizione({ oggi: tomorrow, peso: pesoKg, np, trend, sedute: sedDom, esercizio: eDom, peggiore: "verde", domaniChiave: null, rif, salute: saluteK });
  } catch (e) {}
  const domani = { data: tomorrow, palestra: gymDom, chiave: tomorrowKey ? tomorrowKey.name : null, piano: pianoDom ? { kcal: pianoDom.kcal, C: pianoDom.C, P: pianoDom.P, G: pianoDom.G, tipo: pianoDom.tipo } : null };
  const nut = { modo: "auto", kcal: piano.kcal, kcalEst, carbo: piano.C, proteine: piano.P, grassi: piano.G, meals: piano.pasti, consumi: K.tabella, base: piano.base, deficit: piano.deficit };
  const { kcal, carbo, meals } = nut;
  const chips = [...(N.integratori || []), ...(todayEv.length ? ["Elettroliti dopo la seduta"] : [])];

  const lastA = acts.slice().sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))[0] || null;
  const lastEv = lastA ? events.find((e) => evDate(e) === actDate(lastA) && sportOf(e.type) === sportOf(lastA.type)) : null;
  const lastAct = lastA ? {
    sport: sportOf(lastA.type), tipo: lastA.type, nome: lastA.name || "", data: actDate(lastA), ora: lastA.start_date_local.slice(11, 16),
    sec: durOf(lastA), m: num(lastA.distance), v: num(lastA.average_speed), hr: num(lastA.average_heartrate), hrMax: num(lastA.max_heartrate),
    dplus: num(lastA.total_elevation_gain), tss: loadOf(lastA), kcal: num(lastA.calories), watt: num(lastA.icu_average_watts) ?? num(lastA.average_watts),
    indoor: lastA.trainer === true || /virtual/i.test(lastA.type || "") || /tapis|treadmill|indoor|rulli/i.test(lastA.name || ""),
    piano: lastEv ? { nome: lastEv.name, min: Math.round(durOf(lastEv) / 60), load: loadOf(lastEv) } : null,
    lv: impFromAct(lastA), start: lastA.start_date_local,
  } : null;
  const longRuns = acts.filter((a) => sportOf(a.type) === "corsa" && durOf(a) >= 3600 && num(a.decoupling) !== null).sort((a, b) => b.start_date_local.localeCompare(a.start_date_local));
  const weight = pesi.length ? pesi[pesi.length - 1].v : null;

  const A = {
    now, raceDays: CONFIG.obiettivo && CONFIG.obiettivo.data ? daysBetween(now, parseYMD(CONFIG.obiettivo.data)) : null, worst, sys, tis, verdict,
    metrics: { hrv, hrvMean, hrvTrend, rhr, rhrMean, ctl, atl, tsb, ramp: num(wToday.rampRate) },
    sleep, todayEv, tomorrowEv, domani, gymToday, weeks, ladderCheck, season,
    fitness: { hist: fit, proj },
    decoupling: longRuns.length ? num(longRuns[0].decoupling) : null, weight, lastAct,
    nutrition: { kcal, kcalActive, kcalEst, carbo, meals, chips, dayType, todayMin, proteine: nut.proteine, grassi: nut.grassi, modo: nut.modo, consumi: nut.consumi, base: nut.base, deficit: nut.deficit, piano, trend, rif, np, longToday, cibo: { lista: (dia.cibo || {})[today] || [], tot: totaleCibo((dia.cibo || {})[today] || []) } },
    durOf, fetchedAt: raw.fetchedAt, demo: !!raw.demo, stale: !!raw.stale, curve: raw.curve || null,
    checks: (() => { try { return raw.demo ? [] : verificaProfilo(raw, CONFIG, now); } catch (e) { return []; } })(),
    prof: PROF, needSetup: !PROF && !raw.demo, atleta: raw.atleta || (PROF && PROF.intervals) || null,
    soglie: (() => { try { return raw.demo ? null : stimaSoglie(raw, now, attualiDa(raw)); } catch (e) { return null; } })(),
    soglieOggi: raw.soglieAggiornate || (PROF && PROF.soglieAuto && PROF.soglieAuto.ultimo && ymd(new Date(PROF.soglieAuto.ultimo.data)) === ymd(now) ? PROF.soglieAuto.ultimo.cambi.map((c) => c.testo) : []),
    sportRecenti: ["nuoto", "bici", "corsa"].filter((sp) => acts.filter((a) => sportOf(a.type) === sp && daysBetween(parseYMD(actDate(a)), now) <= 56).length >= 2),
  };
  A.diary = diary || raw.diary || {};
  A.ins = insights(A, raw, now, A.diary);
  Object.defineProperty(A, "raw", { value: raw, enumerable: false }); // per i riassunti della pagina, senza finire nei JSON
  try { A.gear = attrezzatura(raw, now, A.diary); } catch (e) { console.log("Attrezzatura: " + e); A.gear = []; }
  try { A.record = recordPersonali(raw, now, DETTAGLI, A.diary); } catch (e) { console.log("Record: " + e); A.record = null; }
  try { A.prog = progressi(raw, now, DETTAGLI, A.ins.durability); } catch (e) { console.log("Progressi: " + e); A.prog = null; }
  // infortunio o malattia: consigli, proposta per le prossime sedute e verdetto del giorno
  if (saluteK) {
    const visti = new Set(), evs7 = [...todayEv, ...tomorrowEv, ...weeks.flatMap((W) => W.days.flatMap((D) => D.evs))].filter((e) => e && !visti.has(String(e.id)) && visti.add(String(e.id)));
    const scrive = !raw.demo && !(PROF && PROF.pianoApp === false);
    const proposta = saluteS.applicata ? [] : propostaSalute(saluteK, scrive ? evs7.filter((e) => diApp(e)) : evs7, now, {});
    A.salute = { ...saluteK, S: saluteS, proposta, applicata: !!saluteS.applicata, modifiche: (saluteS.modifiche || []).length, puoApplicare: scrive };
    if (saluteK.stop) { A.worst = "rosso"; A.verdict = saluteK.tipo === "malattia" ? "Malattia: riposo completo finché non passa. Niente allenamento oggi." : `${saluteK.titolo}: fermo con quello che carica la zona, fatti vedere.`; }
    else if (saluteK.livello !== "ok") { if (A.worst === "verde") A.worst = "giallo"; A.verdict = `${saluteK.titolo}: ${saluteK.sotto.toLowerCase()}. ${A.verdict}`; }
  } else A.salute = null;
  try { A.att = datiAttivita(raw, A.diary, now, DETTAGLI); } catch (e) { console.log("Attività: " + e); A.att = { oggi: ymd(now), apri: ymd(now), giorni: [ymd(now)], att: {}, ctx: {}, det: {}, sport: { altro: { c: "#8E8E93", label: "Altro" } }, gara: null }; }
  return A;
}

// ------------------------------------------------------------
//  Analisi avanzata (v3): proposte, impatto, esecuzione,
//  durabilità, traiettoria, peso, revisione, predittori
// ------------------------------------------------------------
const MED = (a) => { const s = a.filter((x) => x !== null && isFinite(x)).sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; a += dx * dy; b += dx * dx; c += dy * dy; }
  return b && c ? a / Math.sqrt(b * c) : null;
}
const isTreadmill = (a) => a.trainer === true || /virtual/i.test(a.type || "") || /tapis|treadmill/i.test(a.name || "");
const QUALITY_RX = /soglia|vo2|test|ripetut|interval|threshold|tempo|fartlek|norveg|\d\s*[×x]\s*\d/i;
function isQualityEv(e) {
  if (QUALITY_RX.test(e.name || "")) return true;
  return (e.parsed && e.parsed.segs || []).some((s) => s.pct >= 95 && s.sec >= 45);
}
const isQualityAct = (a) => QUALITY_RX.test(a.name || "") || (num(a.icu_intensity) ?? 0) > 85;
const isLongEv = (e) => (e.sport === "corsa" && e.min >= 75) || (e.sport === "bici" && e.min >= 120) || /lungo/i.test(e.name || "");
function pace145(a) {
  const v = num(a.average_speed), h = num(a.average_heartrate);
  if (!v || !h || h < 110 || h > 178) return null;
  const p = 1000 / ((v / h) * 145);
  return p > 180 && p < 600 ? p : null;
}
function impactOf(a) {
  const km = (num(a.distance) || 0) / 1000; if (!km) return 0;
  const el = num(a.total_elevation_gain) || 0;
  const hard = (num(a.average_heartrate) || 0) / CONFIG.corsa.lthr > 0.88 || isQualityAct(a);
  return km + el / 50 + (hard ? km * 0.3 : 0) - (isTreadmill(a) ? km * 0.1 : 0);
}

function insights(A, raw, now, diary) {
  diary = diary || {};
  const today = ymd(now);
  const LT = CONFIG.corsa.lthr;
  const acts = (raw.activities || []).filter((a) => a && a.start_date_local);
  const dayOf = (a) => a.start_date_local.slice(0, 10);
  const ago = (d) => daysBetween(parseYMD(d), now);
  const runs = acts.filter((a) => sportOf(a.type) === "corsa").sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));
  const wellness = (raw.wellness || []).filter((w) => w && w.id).sort((a, b) => a.id.localeCompare(b.id));

  // ---------- Fiducia nei dati
  const W0 = wellness.find((w) => w.id === today);
  const missing = [];
  if (!W0) missing.push("dati di stanotte non ancora sincronizzati");
  else {
    if (num(W0.hrv) === null && num(W0.hrvSDNN) === null) missing.push("HRV");
    if (num(W0.sleepSecs) === null && num(W0.sleepScore) === null) missing.push("sonno");
    if (num(W0.restingHR) === null) missing.push("FC a riposo");
  }
  const confidence = { level: !W0 ? "bassa" : missing.length >= 2 ? "bassa" : missing.length ? "media" : "alta", missing };

  // ---------- Durabilità: passo a 145 bpm
  const durPts = runs.map((a) => ({ d: dayOf(a), p: pace145(a), tm: isTreadmill(a), long: (num(a.moving_time) || 0) >= 3600 }))
    .filter((x) => x.p !== null && ago(x.d) <= 180);
  const outd = durPts.filter((x) => !x.tm);
  const durNow = MED(outd.filter((x) => ago(x.d) <= 28).map((x) => x.p));
  const durOld = MED(outd.filter((x) => ago(x.d) >= 90 && ago(x.d) <= 150).map((x) => x.p));
  const baseP = MED(outd.filter((x) => ago(x.d) <= 42).map((x) => x.p));
  const decPts = runs.filter((a) => (num(a.moving_time) || 0) >= 3600 && num(a.decoupling) !== null && ago(dayOf(a)) <= 180)
    .map((a) => ({ d: dayOf(a), v: +num(a.decoupling).toFixed(1) }));
  const durability = { pts: durPts.map((x) => ({ d: x.d, p: Math.round(x.p), tm: x.tm })), now: durNow, old: durOld, base: baseP, dec: decPts };

  // ---------- Controllo dopo la seduta
  const execOf = (e) => {
    const a = e.done; if (!a) return null;
    const dR = (num(a.moving_time) || 0) / Math.max(60, (e.min || 1) * 60);
    const lA = num(a.icu_training_load), lR = e.load && lA ? lA / e.load : null;
    let sc = 100 - Math.min(50, Math.abs(1 - dR) * 60) - (lR === null ? 0 : Math.min(50, Math.abs(1 - lR) * 60));
    sc = Math.max(0, Math.min(100, Math.round(sc)));
    const flags = []; const q = isQualityEv(e);
    let hrSupp = false, paceWorse = false;
    if (e.sport === "corsa" && q) {
      const mx = num(a.max_heartrate);
      if (mx && mx < 0.97 * LT) { hrSupp = true; flags.push(`FC max ${Math.round(mx)}: sotto soglia (${LT})`); }
      const p = pace145(a);
      if (p && baseP && p > baseP * 1.03) { paceWorse = true; flags.push(`passo a 145 bpm ${fmtPace(p)} vs ${fmtPace(baseP)}/km`); }
      if (q && isTreadmill(a)) flags.push("qualità su tapis: meglio all'aperto");
    }
    if (dR < 0.8) flags.push(`accorciata (${Math.round(dR * 100)}% del tempo)`);
    if (lR && lR > 1.3) flags.push(`più dura del previsto (${Math.round(lR * 100)}% del carico)`);
    const p = pace145(a);
    return { score: sc, flags, quality: q, warn: hrSupp && paceWorse, p145: p ? Math.round(p) : null, avgHr: num(a.average_heartrate), maxHr: num(a.max_heartrate) };
  };
  const allEv = [...A.todayEv, ...A.weeks.flatMap((W) => W.days.flatMap((D) => D.evs))];
  for (const e of allEv) e.exec = execOf(e);

  // ---------- Allarme affaticamento periferico (ultime due qualità di corsa)
  const qRuns = runs.filter((a) => isQualityAct(a) && ago(dayOf(a)) <= 28).slice(-2);
  const qFlag = (a) => {
    const mx = num(a.max_heartrate), p = pace145(a);
    return { hr: !!(mx && mx < 0.97 * LT), pace: !!(p && baseP && p > baseP * 1.03), d: dayOf(a), name: a.name || "Qualità" };
  };
  const qf = qRuns.map(qFlag);
  let fatigue = null;
  if (qf.length === 2 && qf.every((x) => x.hr && x.pace)) fatigue = { level: "rosso", text: "Nelle ultime due sedute di qualità la FC non è salita fino alla soglia e il passo a parità di battiti è peggiorato. È il tuo segnale di affaticamento periferico: 3–4 giorni solo Z2, qualità all'aperto alla ripresa." };
  else if (qf.length && qf[qf.length - 1].hr && qf[qf.length - 1].pace) fatigue = { level: "giallo", text: "Nell'ultima seduta di qualità FC sotto soglia e passo peggiore a parità di battiti. Sotto osservazione: se si ripete alla prossima, scatta lo scarico." };

  // ---------- Proposta di seduta adattata
  let adapt = null;
  const pending = A.todayEv.filter((e) => !e.done);
  if (A.worst !== "verde" && pending.length) {
    const items = pending.map((e) => {
      const q = isQualityEv(e), L = isLongEv(e), m = e.min || 0;
      let prop = null;
      if (A.worst === "rosso") prop = "Riposo o 20' di mobilità";
      else if (A.tis.state !== "verde" && e.sport === "corsa") {
        if (q) { const alt = ["bici", "nuoto"].filter((x) => CONFIG.sport.includes(x)).join(" o "); prop = alt ? `${alt[0].toUpperCase() + alt.slice(1)} facile ${m}' al posto della corsa` : `Corsa facile ${Math.round(m * 0.6 / 5) * 5}' in piano, o riposo`; }
        else if (L) prop = `Lungo ridotto a ${fmtMin(Math.round(m * 0.7 / 5) * 5)} in piano, Z2, niente discese`;
        else prop = `${Math.round(m * 0.8 / 5) * 5}' in piano o su tapis, Z2`;
      } else if (A.sys.state !== "verde") {
        if (q) prop = `${Math.round(m * 0.7 / 5) * 5}' in Z2 (${CONFIG.corsa.zoneFC[2] && e.sport !== "nuoto" ? CONFIG.corsa.zoneFC[2].join("–") + " bpm" : "ritmo facile"})`;
        else if (L) prop = `${fmtMin(Math.round(m * 0.8 / 5) * 5)} tutto in Z2`;
      }
      return prop ? { name: e.name, sport: e.sport, min: m, prop, quality: q } : null;
    }).filter(Boolean);
    let move = null;
    if (items.some((x) => x.quality) && A.worst !== "rosso") {
      const minGap = A.tis.state !== "verde" ? 2 : 1; // tessuti in recupero: almeno 48 h
      const days = A.weeks[0].days.filter((D) => !D.isPast && !D.isToday && D.date.getDay() !== 0 && daysBetween(now, D.date) >= minGap);
      const free = days.find((D) => !D.evs.some((e) => isQualityEv(e) || isLongEv(e)));
      if (free) move = `La qualità slitta a ${GIORNI[free.date.getDay()].toLowerCase()} ${free.date.getDate()}${A.tis.state !== "verde" ? ", a tessuti recuperati" : ""}`;
      else move = "Questa settimana la qualità salta: la prossima resta com'è";
    }
    if (items.length) adapt = { items, move, accepted: !!(diary.adapt && diary.adapt[today]), why: A.verdict };
  }

  // ---------- Budget d'impatto della corsa
  const mon = mondayOf(now);
  const wkRuns = (i) => { const s = addDays(mon, -7 * i), e = addDays(s, 7); return runs.filter((a) => { const d = parseYMD(dayOf(a)); return d >= s && d < e; }); };
  const impW = (i) => wkRuns(i).reduce((t, a) => t + impactOf(a), 0);
  const prev4 = [1, 2, 3, 4].map(impW);
  const chronic = mean(prev4) || null;
  const doneImp = impW(0);
  const restRuns = A.weeks[0].days.flatMap((D) => D.evs.filter((e) => e.sport === "corsa" && !e.done && (D.isToday || !D.isPast)));
  const plannedImp = restRuns.reduce((t, e) => t + (e.min / 6.2) * (isQualityEv(e) ? 1.3 : 1), 0);
  const projected = doneImp + plannedImp;
  const ratio = chronic ? projected / chronic : null;
  const tmShare = (list) => { const tot = list.reduce((t, a) => t + (num(a.moving_time) || 0), 0); return tot ? list.filter(isTreadmill).reduce((t, a) => t + (num(a.moving_time) || 0), 0) / tot : null; };
  const impact = {
    done: doneImp, planned: plannedImp, projected, chronic, ratio,
    state: ratio === null ? null : ratio > 1.5 ? "rosso" : ratio > 1.3 ? "giallo" : ratio < 0.7 ? "basso" : "ok",
    hist: [4, 3, 2, 1].map(impW),
    tmWeek: tmShare(wkRuns(0)), tm4: tmShare([1, 2, 3, 4].flatMap(wkRuns)),
  };

  // ---------- Traiettoria verso la gara
  // Traiettoria generica: dall'obiettivo in CONFIG (nessun dato personale nel codice)
  const G = CONFIG.obiettivo;
  let tgt = [];
  if (G && G.data) {
    if (Array.isArray(G.traiettoria) && G.traiettoria.length) tgt = G.traiettoria.slice().sort((a, b) => a.data.localeCompare(b.data));
    else if (G.ctlGara && A.fitness.hist.length) {
      const start = A.fitness.hist.find((f) => ago(f.d) <= 30) || A.fitness.hist[0];
      const race = parseYMD(G.data), peak = addDays(race, -14);
      tgt = [{ data: start.d, ctl: start.ctl }, { data: ymd(peak), ctl: G.ctlGara }, { data: G.data, ctl: Math.round(G.ctlGara * 0.9) }];
    }
  }
  const targetAt = (d) => {
    const t = parseYMD(d).getTime();
    if (!tgt.length) return null;
    if (t <= parseYMD(tgt[0].data).getTime()) return tgt[0].ctl;
    for (let i = 1; i < tgt.length; i++) {
      const a = parseYMD(tgt[i - 1].data).getTime(), b = parseYMD(tgt[i].data).getTime();
      if (t <= b) return tgt[i - 1].ctl + (tgt[i].ctl - tgt[i - 1].ctl) * (t - a) / (b - a);
    }
    return tgt[tgt.length - 1].ctl;
  };
  const ctlNow = A.metrics.ctl, tNow = targetAt(today);
  const projEnd = A.fitness.proj.length ? A.fitness.proj[A.fitness.proj.length - 1] : null;
  const trajectory = !tgt.length ? null : {
    name: G.nome, race: G.data, targets: tgt, now: ctlNow, target: tNow,
    diff: ctlNow !== null && tNow !== null ? ctlNow - tNow : null,
    projEnd: projEnd ? { d: projEnd.d, ctl: projEnd.ctl, target: targetAt(projEnd.d) } : null,
    hist: A.fitness.hist.filter((f) => ago(f.d) <= 60).map((f) => ({ d: f.d, ctl: f.ctl })),
    proj: A.fitness.proj.map((f) => ({ d: f.d, ctl: f.ctl })),
  };

  // ---------- Peso: avvisi secondo le regole del piano (la correzione vera la fa pianoNutrizione)
  const T0 = A.nutrition.trend, PN = A.nutrition.piano, NP = A.nutrition.np, NR = CONFIG.nutrizione;
  const RIT = NR.ritmo || { lento: 0.25, veloce: 0.9 }, COR = NR.correzione || { piuCibo: 250, menoCibo: 150 };
  const rate = T0.rate, ratePct = rate === null ? null : (rate / (NP.peso || 70)) * 100;
  const dataIt = (d) => `${d.getDate()} ${MESI[d.getMonth()]}`;
  let fuelAlert;
  if (!NP.dimagrire) fuelAlert = rate === null ? { level: "info", text: "Pesati qualche mattina a settimana, dalla bilancia o qui sotto: l'app controlla che mangi abbastanza per l'allenamento." }
    : rate < -0.6 ? { level: "giallo", text: `Stai calando (${fmtIt(rate, 1)} kg a settimana) senza un obiettivo di peso: mangia di più attorno alle sedute.` }
    : { level: "ok", text: Math.abs(rate) < 0.15 ? "Peso stabile: mangi quello che consumi." : `Peso ${rate < 0 ? "in calo" : "in salita"} di ${fmtIt(Math.abs(rate), 1)} kg a settimana.` };
  else if (PN.fase === "mantenimento") fuelAlert = { level: "ok", text: `Mantenimento${NP.fineDimagrimento && ymd(now) >= NP.fineDimagrimento ? " fino alla gara" : ""}: niente deficit, mangi quello che consumi.` };
  else if (rate === null) fuelAlert = { level: "info", text: "Pesati almeno tre mattine a settimana, dalla bilancia o qui sotto: con le pesate il piano si corregge da solo." };
  else if (ratePct < -RIT.veloce) fuelAlert = { level: "giallo", text: `Calo veloce (${fmtIt(rate, 1)} kg a settimana): il piano aggiunge ${COR.piuCibo} kcal al giorno, soprattutto carboidrati attorno alle sedute.` };
  else if (ratePct > -RIT.lento) fuelAlert = { level: "info", text: `Calo lento (${rate <= 0 ? "−" : "+"}${fmtIt(Math.abs(rate), 1)} kg a settimana): il piano toglie ${COR.menoCibo} kcal al giorno.` };
  else fuelAlert = { level: "ok", text: `In linea: −${fmtIt(Math.abs(rate), 1)} kg a settimana.${T0.eta ? ` A questo ritmo ${kgIt(NP.pesoObiettivo)} kg verso il ${dataIt(T0.eta)}.` : ""}` };
  const corpoP = (PROF && PROF.corpo) || {};
  const weight = { now: T0.w7 ?? T0.ultimo, rate, target: NP.dimagrire ? NP.pesoObiettivo : null, start: NP.dimagrire ? num(corpoP.peso) : null, series: T0.serie, alert: fuelAlert, oggi: T0.oggi, sync: T0.sync, dimagrire: NP.dimagrire };

  // ---------- Revisione della settimana
  const W = A.weeks[0];
  const evs = W.days.flatMap((D) => D.evs);
  const due = W.days.flatMap((D) => D.evs.filter((e) => D.isPast || (D.isToday && e.done)));
  const doneN = evs.filter((e) => e.done).length;
  const adherence = due.length ? due.filter((e) => e.done).length / due.length : null;
  const scored = evs.filter((e) => e.exec);
  const best = scored.slice().sort((a, b) => b.exec.score - a.exec.score)[0] || null;
  const warns = scored.filter((e) => e.exec.flags.length).length;
  const nextSun = ymd(addDays(mon, 13));
  const nextLong = CONFIG.scalaLungo.find((s) => s.data === nextSun);
  let proposal;
  if (fatigue && fatigue.level === "rosso" || (impact.ratio && impact.ratio > 1.3)) proposal = "Settimana prossima: scarico, −25% di volume nella corsa e qualità solo all'aperto.";
  else if (adherence !== null && adherence < 0.7) proposal = "Settimana prossima: ripeti questo carico prima di salire.";
  else proposal = `Settimana prossima: carico +5–8%${nextLong ? `; lungo ${nextLong.min === null ? "di scarico" : fmtMin(nextLong.min)}` : ""}.`;
  const review = {
    final: now.getDay() === 0, doneN, total: evs.length, adherence,
    doneMin: Math.round(W.doneSec / 60), plannedMin: Math.round(W.plannedSec / 60), loadDone: Math.round(W.loadDone),
    best: best ? { name: best.name, score: best.exec.score } : null, warns, proposal,
  };

  // ---------- Cosa ti predice: segnali del mattino vs esito delle corse
  const wMap = {};
  wellness.forEach((w, i) => {
    const prev = wellness.slice(Math.max(0, i - 7), i);
    const hv = num(w.hrv) ?? num(w.hrvSDNN), rh = num(w.restingHR);
    const hvP = prev.map((x) => num(x.hrv) ?? num(x.hrvSDNN)).filter((x) => x !== null);
    const rhP = prev.map((x) => num(x.restingHR)).filter((x) => x !== null);
    wMap[w.id] = {
      hrv: hv !== null && hvP.length >= 3 ? hv - mean(hvP) : null,
      rhr: rh !== null && rhP.length >= 3 ? rh - mean(rhP) : null,
      sleep: num(w.sleepScore),
    };
  });
  const outRuns = runs.filter((a) => !isTreadmill(a) && pace145(a) !== null);
  const pairs = outRuns.map((a) => {
    const d = dayOf(a);
    const ref = MED(outRuns.filter((b) => { const k = daysBetween(parseYMD(dayOf(b)), parseYMD(d)); return k > 0 && k <= 42; }).map(pace145));
    if (!ref) return null;
    const out = -(pace145(a) - ref) / ref * 100; // + = meglio della tua norma
    const ck = (diary.checkins || {})[d] || {};
    return { d, out, ...(wMap[d] || {}), g: ck.g ?? null, e: ck.e ?? null, u: ck.u ?? null };
  }).filter(Boolean);
  const SIG = [
    ["hrv", "HRV rispetto alla tua media"], ["rhr", "FC a riposo rispetto alla media"], ["sleep", "Punteggio del sonno"],
    ["g", "Gambe (check-in)"], ["e", "Energia (check-in)"], ["u", "Umore (check-in)"],
  ];
  const preds = SIG.map(([k, lbl]) => {
    const pp = pairs.filter((p) => p[k] !== null && p[k] !== undefined);
    const r = pp.length >= 12 ? pearson(pp.map((p) => p[k]), pp.map((p) => p.out)) : null;
    return { k, lbl, n: pp.length, r };
  });
  const strong = preds.filter((p) => p.r !== null && Math.abs(p.r) >= 0.2).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const ckDays = Object.keys(diary.checkins || {}).length;
  const predictors = { list: strong.slice(0, 3), all: preds, nRuns: pairs.length, ckDays, ckPaired: preds.find((p) => p.k === "g").n, pairs };

  return { confidence, durability, fatigue, adapt, impact, trajectory, weight, review, predictors };
}

