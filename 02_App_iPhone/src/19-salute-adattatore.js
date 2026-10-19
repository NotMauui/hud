
// ============================================================
//  Adattatore Apple Salute → dati dell'app (per l'app nativa, senza Intervals)
//  L'app nativa legge Salute (HealthKit) e passa qui un oggetto semplice; ne esce lo stesso «raw»
//  che arriva da Intervals ({ activities, wellness, events }), così analisi, piano e interfaccia restano gli stessi.
//  Il carico di ogni seduta lo calcola HUD:
//  - con la frequenza cardiaca: TRIMP di Banister (Banister 1991; pesi 0,64·e^1,92x uomini, 0,86·e^1,67x donne),
//    riportato in scala TSS: 100 = un'ora alla FC di soglia (come l'HRSS di Intervals)
//  - senza FC ma con la fatica percepita (1-10): ore × IF² × 100, con l'IF delle categorie del generatore (stima di HUD)
//  - senza nessuno dei due: l'IF del tipo di seduta (facile, o forza per la palestra)
//  Fitness e fatica giorno per giorno con prevediForma (CTL 42 giorni, ATL 7), partendo da zero all'inizio dello storico.
// ============================================================

// tipi di allenamento di HealthKit (nome del caso di HKWorkoutActivityType) → tipi di Intervals
const SALUTE_TIPI = {
  running: "Run", walking: "Walk", hiking: "Hike", cycling: "Ride", handCycling: "Ride", swimming: "Swim",
  traditionalStrengthTraining: "WeightTraining", functionalStrengthTraining: "WeightTraining", coreTraining: "WeightTraining",
  crossTraining: "Workout", highIntensityIntervalTraining: "Workout", mixedCardio: "Workout", flexibility: "Yoga", yoga: "Yoga",
  rowing: "Rowing", elliptical: "Elliptical", stairClimbing: "Workout", swimBikeRun: "Workout", transition: "Workout",
};
function tipoDaSalute(tipo, indoor) {
  const t = SALUTE_TIPI[tipo] || "Workout";
  if (indoor && t === "Ride") return "VirtualRide";
  if (indoor && t === "Run") return "VirtualRun";
  return t;
}

// TRIMP di Banister con la FC media della seduta
function trimp(minuti, fcMedia, fcRiposo, fcMax, sesso) {
  if (!(minuti > 0) || !(fcMedia > 0) || !(fcMax > fcRiposo) || !(fcRiposo > 0)) return null;
  const x = Math.min(1, (fcMedia - fcRiposo) / (fcMax - fcRiposo));
  if (x <= 0) return 0;
  const [a, b] = sesso === "F" ? [0.86, 1.67] : [0.64, 1.92];
  return minuti * x * a * Math.exp(b * x);
}
// Carico in scala TSS dalla FC: 100 = 60 minuti alla FC di soglia
function caricoDaFC(minuti, fcMedia, fc, sesso) {
  if (!fc || !(fc.soglia > 0)) return null;
  const t = trimp(minuti, fcMedia, fc.riposo, fc.max, sesso), ora = trimp(60, fc.soglia, fc.riposo, fc.max, sesso);
  return t === null || !ora ? null : Math.round((100 * t) / ora);
}
// Fatica percepita (1-10) → categoria di intensità del generatore → ore × IF² × 100
function ifDaRPE(rpe) {
  const IF = GEN.REGOLE.IF;
  return rpe <= 2 ? IF.recupero : rpe <= 4 ? IF.facile : rpe <= 5 ? IF.lungo : rpe <= 7 ? IF.tempo : rpe <= 8 ? IF.soglia : IF.vo2;
}
function caricoDaRPE(minuti, rpe) {
  if (!(minuti > 0) || !(rpe >= 1 && rpe <= 10)) return null;
  return Math.round((minuti / 60) * ifDaRPE(rpe) ** 2 * 100);
}

// S = { allenamenti: [{ id, inizio: "AAAA-MM-GGTHH:MM:SS" (ora locale), tipo, indoor, secondi, metri, fcMedia, fcMax, kcal, dislivello, rpe, nome }],
//       hrv: [{ data, ms }], fcRiposo: [{ data, bpm }], sonno: [{ data, secondi }], peso: [{ data, kg }], eventi: [] }
// opz = { oggi: "AAAA-MM-GG", sesso: "M" | "F" }. Le soglie di FC vengono da CONFIG (profilo), la FC massima se manca dallo storico.
function rawDaSalute(S, opz = {}) {
  S = S || {};
  const oggi = opz.oggi || ymd(new Date()), sesso = opz.sesso || (typeof PROF !== "undefined" && PROF && PROF.corpo && PROF.corpo.sesso) || "M";
  const perData = (L, campo) => { const m = {}; for (const x of L || []) if (x && /^\d{4}-\d\d-\d\d$/.test(x.data || "") && x[campo] > 0) m[x.data] = x[campo]; return m; };
  const hrv = perData(S.hrv, "ms"), rhr = perData(S.fcRiposo, "bpm"), sonno = perData(S.sonno, "secondi"), peso = perData(S.peso, "kg");
  const rhrValori = Object.values(rhr).sort((a, b) => a - b), rhrMed = rhrValori.length ? rhrValori[Math.floor(rhrValori.length / 2)] : null;
  const fcMaxVista = Math.max(0, ...(S.allenamenti || []).map((a) => +a.fcMax || 0));
  const fcMax = CONFIG.corsa.fcMax || fcMaxVista || null;

  const activities = [];
  for (const a of S.allenamenti || []) {
    if (!a || !/^\d{4}-\d\d-\d\dT/.test(a.inizio || "") || !(a.secondi > 0)) continue;
    const type = tipoDaSalute(a.tipo, a.indoor), sp = sportOf(type), min = a.secondi / 60, d = a.inizio.slice(0, 10);
    const soglia = sp === "bici" ? CONFIG.bici.sogliaFC || CONFIG.corsa.lthr : CONFIG.corsa.lthr;
    const fc = { soglia, riposo: rhr[d] || rhrMed, max: fcMax };
    let load = a.fcMedia > 0 ? caricoDaFC(min, a.fcMedia, fc, sesso) : null, da = "fc";
    if (load === null && a.rpe) { load = caricoDaRPE(min, a.rpe); da = "rpe"; }
    if (load === null) { load = Math.round((min / 60) * GEN.REGOLE.IF[sp === "forza" ? "forza" : "facile"] ** 2 * 100); da = "durata"; }
    activities.push({
      id: "salute-" + (a.id || a.inizio), start_date_local: a.inizio.slice(0, 19), type, name: a.nome || null,
      moving_time: Math.round(a.secondi), distance: a.metri > 0 ? a.metri : null,
      average_speed: a.metri > 0 ? a.metri / a.secondi : null,
      average_heartrate: a.fcMedia > 0 ? Math.round(a.fcMedia) : null, max_heartrate: a.fcMax > 0 ? Math.round(a.fcMax) : null,
      total_elevation_gain: a.dislivello > 0 ? a.dislivello : null, calories: a.kcal > 0 ? Math.round(a.kcal) : null,
      trainer: !!a.indoor, icu_training_load: load, icu_rpe: a.rpe || null, fonte: "salute", caricoDa: da,
    });
  }
  activities.sort((x, y) => (x.start_date_local < y.start_date_local ? -1 : 1));

  // un giorno di wellness per ogni data dalla prima informazione a oggi, con fitness e fatica
  const date = [...activities.map((x) => x.start_date_local.slice(0, 10)), ...Object.keys(hrv), ...Object.keys(rhr), ...Object.keys(sonno), ...Object.keys(peso)].filter((x) => x <= oggi).sort();
  const wellness = [];
  if (date.length) {
    const caricoGiorno = {};
    for (const x of activities) { const k = x.start_date_local.slice(0, 10); caricoGiorno[k] = (caricoGiorno[k] || 0) + x.icu_training_load; }
    let ctl = 0, atl = 0;
    for (let g = parseYMD(date[0]); ymd(g) <= oggi; g = addDays(g, 1)) {
      const k = ymd(g);
      ({ ctl, atl } = GEN.prevediForma(ctl, atl, [caricoGiorno[k] || 0]).fine);
      wellness.push({ id: k, ctl: +ctl.toFixed(2), atl: +atl.toFixed(2), hrv: hrv[k] || null, restingHR: rhr[k] || null, sleepSecs: sonno[k] || null, weight: peso[k] || null });
    }
  }
  return { activities, wellness, events: Array.isArray(S.eventi) ? S.eventi : [], fetchedAt: new Date().toISOString(), fonte: "salute" };
}
