// ------------------------------------------------------------
//  Piano: dal profilo al blocco di 4 settimane, poi nel calendario di Intervals
// ------------------------------------------------------------
const GIORNI_L = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]; // indici del generatore: 0 = lunedì

function baseGeneratore(P, raw, now) {
  const giorni = Array.isArray(P.giorni) && P.giorni.length === 7 ? P.giorni.map(Boolean) : [true, true, true, true, true, true, true];
  const liberi = giorni.map((g, i) => (g ? i : -1)).filter((i) => i >= 0);
  const ore = Math.max(3, Math.min(25, +P.ore || 6));
  const w = giorni.map((g, i) => (g ? (i >= 5 ? 1.8 : 1) : 0));
  const sw = w.reduce((t, x) => t + x, 0) || 1;
  const minutiGiorno = w.map((x) => (x ? Math.max(45, Math.min(300, Math.round(((ore * 60 * x) / sw) * 1.6 / 5) * 5)) : 0));
  const disc = sportDi(P);
  const tipo = P.gara && P.gara.data ? P.gara.tipo || ((GARE[chiaveSport(disc)] || [["70.3"]])[0][0]) : "migliorare";
  const scegli = (lista, n) => { const ok = (lista || []).filter((g) => giorni[g]); return ok.length ? ok : liberi.slice(0, n); };
  let lungo = P.giornoLungo ?? 6;
  if (!giorni[lungo]) lungo = [6, 5].find((g) => giorni[g]) ?? liberi[liberi.length - 1];
  const piscina = disc.includes("nuoto"), palestra = !!P.palestra;
  return {
    nome: P.nome || "Atleta",
    obiettivo: tipo === "migliorare" ? { tipo } : { tipo, data: P.gara.data },
    disponibilita: { oreMax: ore + 1, oreDichiarate: ore, minutiGiorno },
    sport: { discipline: disc, piscina, bici: !disc.includes("bici") ? false : P.bici === "rulli" ? "indoor" : true, palestra },
    // CSS mai misurato (nessuna nuotata): il primo blocco comincia con il test 400 + 200
    test: { css: piscina && !!raw && (() => { try { return stimaSoglie(raw, now || new Date(), attualiDa(raw)).nuoto.daMisurare; } catch (e) { return false; } })() },
    piscinaGiorni: piscina ? scegli(P.piscinaGiorni, 2) : [0, 2, 4],
    palestraGiorni: palestra ? scegli(P.palestraGiorni, 2) : [0, 4],
    giornoLungo: lungo,
  };
}

// Primo giorno del blocco: lunedì prossimo (oggi se è lunedì), oppure il giorno dopo la fine del blocco in corso
// modo: "prossimo" = dopo il blocco in corso; "domani" = il lunedì della settimana di domani (il generatore conta i giorni
// da lunedì: le sedute prima di domani non si scrivono); "lunedi" = il prossimo lunedì dopo oggi (questa settimana resta);
// altrimenti (primo piano) lunedì prossimo, oggi se è lunedì
function inizioBlocco(now, P, modo) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lunedi = ymd(d.getDay() === 1 ? d : addDays(d, (8 - d.getDay()) % 7));
  if (modo === "domani") return ymd(mondayOf(addDays(d, 1)));
  if (modo === "lunedi") return ymd(addDays(d, (8 - d.getDay()) % 7 || 7));
  if ((modo === true || modo === "prossimo") && P.piano && P.piano.fine) {
    const dopo = ymd(addDays(parseYMD(P.piano.fine), 1));
    if (dopo >= ymd(d)) return dopo; // attaccato al blocco in corso, mai nel passato
  }
  return lunedi;
}

// Solo palestra: tre schede che si alternano, con gli attrezzi che hai; la quarta settimana più leggera
const PAL_SCHEDE = {
  A: { nome: "Gambe e glutei",
    libero: ["squat:3 × 15", "affondo:3 × 10 per lato", "ponte1:3 × 12 per lato", "polpacci:3 × 15", "plankl:3 × 30\" per lato", "deadbug:3 × 8 per lato"],
    elastico: ["squat:3 × 15", "mostro:3 × 12 passi per lato", "affondo:3 × 10 per lato", "ponte1:3 × 12 per lato", "polpacci:3 × 15", "deadbug:3 × 8 per lato"],
    manubri: ["goblet:3 × 10", "rdl1:3 × 8 per lato", "affondoman:3 × 8 per lato", "polpaccim:3 × 12", "plankl:3 × 30\" per lato", "deadbug:3 × 8 per lato"],
    palestra: ["squatbil:4 × 8", "rdl:3 × 8", "legpress:3 × 10", "legcurl:3 × 10", "polpaccip:3 × 12", "pallof:3 × 10 per lato"] },
  B: { nome: "Parte alta e core",
    libero: ["piegamenti:3 × 10", "trazioni:3 × 5", "superman:3 × 10", "plank:3 × 40\"", "mountain:3 × 30\"", "russian:3 × 12 per lato"],
    elastico: ["piegamenti:3 × 10", "apertura:3 × 15", "rotest:3 × 15 per lato", "superman:3 × 10", "plank:3 × 40\"", "deadbug:3 × 8 per lato"],
    manubri: ["rematore:3 × 10", "spinte:3 × 10", "piegamenti:3 × 10", "alzatepost:3 × 12", "plank:3 × 40\"", "russian:3 × 12 per lato"],
    palestra: ["lat:3 × 10", "panca:3 × 8", "rematorebil:3 × 8", "facepull:3 × 12", "plank:3 × 40\"", "pallof:3 × 10 per lato"] },
  C: { nome: "Tutto il corpo",
    libero: ["squat:3 × 15", "piegamenti:3 × 10", "ponte:3 × 15", "superman:3 × 10", "plank:3 × 40\"", "mountain:3 × 30\""],
    elastico: ["squat:3 × 15", "piegamenti:3 × 10", "mostro:3 × 12 passi per lato", "apertura:3 × 15", "ponte:3 × 15", "plank:3 × 40\""],
    manubri: ["goblet:3 × 10", "rematore:3 × 10", "rdl1:3 × 8 per lato", "spinte:3 × 10", "contadino:3 × 40 m", "deadbug:3 × 8 per lato"],
    palestra: ["legpress:3 × 10", "lat:3 × 10", "hipthrust:3 × 10", "panca:3 × 8", "facepull:3 × 12", "plank:3 × 40\""] },
};
const ATTREZZI = ["libero", "elastico", "manubri", "palestra"];
// «Goblet squat · 3 × 10»: le righe che l'app riconosce e trasforma in esercizi con le foto
function righePal(sch, attrezzi, scarico) {
  const S = PAL_SCHEDE[sch] || PAL_SCHEDE.C, L = S[ATTREZZI.includes(attrezzi) ? attrezzi : "manubri"];
  return L.map((x) => { const [k, d] = x.split(":"), e = ESL.find((y) => y[0] === k); const dd = d.replace(/(\d+)"/g, "$1 secondi"); return `${e ? e[1] : k} · ${scarico ? dd.replace(/^(\d) ×/, (m, n) => `${Math.max(2, +n - 1)} ×`) : dd}`; });
}
function pianoPalestra(P, inizio, indice) {
  const giorni = (Array.isArray(P.palestraGiorni) && P.palestraGiorni.length ? P.palestraGiorni : [0, 2, 4]).slice().sort((a, b) => a - b);
  const min = [30, 45, 60].includes(+P.palMin) ? +P.palMin : 45, attrezzi = ATTREZZI.includes(P.attrezzi) ? P.attrezzi : "manubri";
  const ord = ["A", "B", "C"];
  let k = (indice * giorni.length * 4) % 3;
  const settimane = [];
  for (let w = 0; w < 4; w++) {
    const lun = addDays(parseYMD(inizio), w * 7), scarico = w === 3;
    const sedute = giorni.map((g) => {
      const sch = giorni.length === 1 ? "C" : ord[k++ % 3], m = scarico ? Math.max(25, Math.round((min * 0.75) / 5) * 5) : min;
      return { giorno: g, data: ymd(addDays(lun, g)), sport: "forza", tipo: "palestra", nome: `Palestra ${sch} · ${PAL_SCHEDE[sch].nome.toLowerCase()}`, min: m, carico: Math.round(m * 0.45), qualita: false, scheda: sch, attrezzi, scarico, passi: [] };
    });
    settimane.push({ n: w + 1, lunedi: ymd(lun), fase: "base", scarico, minuti: sedute.reduce((t, x) => t + x.min, 0), lungoCorsa: 0, sedute });
  }
  return { settimane, avvisi: [] };
}

function creaPiano(P, raw, now, modo) {
  const prossimo = modo === true || modo === "prossimo";
  const inizio = inizioBlocco(now, P, modo);
  // da domani: si scrive da domani in poi, i giorni prima restano come sono
  const domani = ymd(addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1));
  const dal = modo === "domani" && domani > inizio ? domani : null;
  if (P.soloPalestra) {
    const indice = P.piano ? (P.piano.indice || 0) + (prossimo ? 1 : 0) : 0;
    const piano = pianoPalestra(P, inizio, indice), w0 = piano.settimane[0];
    return { inizio, fine: ymd(addDays(parseYMD(inizio), 27)), indice, piano, livello: { ctl: 0, oreSett: 0, lungoCorsaMin: 0, lungoBiciMin: 0, rientro: null },
      palestra: { n: w0.sedute.length, min: w0.sedute[0] ? w0.sedute[0].min : 45, attrezzi: w0.sedute[0] ? w0.sedute[0].attrezzi : "manubri" },
      timbro: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), dal };
  }
  const D = GEN.normalizza(raw);
  const prof = GEN.profiloAl(D, inizio, baseGeneratore(P, raw, now));
  const indice = P.piano ? (P.piano.indice || 0) + (prossimo ? 1 : 0) : 0;
  const piano = GEN.generaBlocco(prof, { inizio, indiceBlocco: indice });
  // timbro della scrittura: ogni versione del piano ha codici nuovi, così le vecchie si tolgono senza ambiguità
  return { inizio, fine: ymd(addDays(parseYMD(inizio), 27)), indice, piano, livello: prof.livello, timbro: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), dal };
}

// Una seduta del generatore nel linguaggio dei passi di Intervals (diventa strutturata e può andare sull'orologio)
const durIv = (min) => { const sec = Math.max(1, Math.round(min * 60)); const m = Math.floor(sec / 60), s = sec % 60; return (m ? m + "m" : "") + (s ? s + "s" : ""); };
const cueIv = (t) => {
  let c = String(t || "");
  if (/^\d+\s+a tutta/i.test(c)) return "A tutta";
  if (/^vo2/i.test(c)) return "Ripetuta veloce"; // niente cifre nel testo del passo
  c = c.replace(/^\d+\s+a\s+/i, "")          // "100 a CSS" → "CSS": la distanza va nel passo
    .replace(/\d+\s*["'″′]/g, "")             // 20" o 5' sarebbero letti come durate
    .replace(/["'+″′]/g, "").replace(/\s+/g, " ").trim();
  return c ? c[0].toUpperCase() + c.slice(1) : "";
};
function targetIv(sport, txt, ftp) {
  const t = String(txt || "").toLowerCase().replace(/–/g, "-");
  if (sport === "corsa") {
    if (/108%/.test(t)) return "105-110% Pace";
    if (/100% soglia/.test(t)) return "98-102% Pace";
    if (/ritmo gara/.test(t)) return "86-90% Pace";
    if (/veloce/.test(t)) return "110-120% Pace";
    if (/gradino/.test(t)) return "Z3-Z4 HR";
    if (/z1-z2/.test(t)) return "Z1-Z2 HR";
    if (/z1|cammin|passo|lenta/.test(t)) return "Z1 HR";
    return "Z2 HR";
  }
  if (sport === "bici") {
    if (/95-100% ftp/.test(t)) return ftp ? "95-100%" : "98-102% LTHR";
    if (/88-92% ftp/.test(t)) return ftp ? "88-92%" : "93-96% LTHR";
    if (/ritmo gara/.test(t)) return ftp ? "78-84%" : "88-92% LTHR";
    if (/z1-z2/.test(t)) return ftp ? "Z1-Z2" : "Z1-Z2 HR";
    if (/z1/.test(t)) return ftp ? "Z1" : "Z1 HR";
    return ftp ? "Z2" : "Z2 HR";
  }
  if (sport === "nuoto") {
    if (/fermo/.test(t)) return "";
    if (/massimo/.test(t)) return "105-110% Pace";
    if (/css \+8/.test(t)) return "92-94% Pace";
    if (/css \+3/.test(t)) return "96-98% Pace";
    if (/css/.test(t)) return "99-101% Pace";
    return "80-88% Pace";
  }
  return "";
}
// Nuoto: solo passi a distanza e senza obiettivi di passo. COROS rifiuta i passi a tempo e gli obiettivi di passo nel nuoto
// (e un rifiuto blocca l'invio di tutto il piano); Garmin in piscina lavora comunque a distanza. I recuperi da fermo vanno in nota.
function testoNuoto(s) {
  // i passi a tempo diventano metri: quello che resta dopo le ripetute si divide in proporzione al tempo, così il totale è quello della seduta
  const dist = (p) => { const d = /^(\d{2,4}) a /.exec(p.cosa || ""); return d ? +d[1] : null; };
  const fermo = (p) => /fermo/i.test(p.intensita || "");
  let fissi = 0, minTempo = 0;
  for (const p of s.passi || []) for (const q of p.ripeti ? p.passi : [p]) { if (fermo(q)) continue; const d = dist(q), k = p.ripeti || 1; if (d) fissi += d * k; else minTempo += q.min * k; }
  const totale = s.metri || Math.round((s.min * 1000) / 30 / 100) * 100;
  const mpm = minTempo ? Math.max(0, totale - fissi) / minTempo : 33;
  const m50 = (min) => Math.max(50, Math.round((min * mpm) / 50) * 50);
  const intens = (t) => (/massimo/i.test(t) ? "a tutta" : /css \+8/i.test(t) ? "medio" : /css \+3/i.test(t) ? "ritmo" : /css/i.test(t) ? "soglia" : "facile");
  const pause = new Set();
  const riga = (p) => {
    if (/fermo/i.test(p.intensita || "")) { const sec = Math.round(p.min * 60); pause.add(sec < 60 ? `${sec} secondi` : `${Math.round(sec / 60)} minuti`); return null; }
    const d = dist(p), it = intens(p.intensita || "");
    let cue = cueIv(p.cosa) || "Nuoto";
    if (/^css$/i.test(cue)) cue = it === "soglia" ? "Soglia CSS" : it === "ritmo" ? "Ritmo poco sotto il CSS" : "CSS";
    else if (!/^a tutta$/i.test(cue) && !cue.toLowerCase().includes(it)) cue += " " + it;
    return `- ${cue} ${d || m50(p.min)}mtr`;
  };
  const L = [];
  for (const p of s.passi || []) {
    if (p.ripeti) { const r = p.passi.map(riga).filter(Boolean); if (r.length) L.push("", `${p.ripeti}x`, ...r, ""); }
    else if (p.min > 0) { const r = riga(p); if (r) L.push(r); }
  }
  // gli arrotondamenti a 50 m vanno all'ultimo passo a tempo, così la somma è il totale della seduta
  let rip = 1, somma = 0, ultimo = -1;
  L.forEach((r, i) => { const x = /^(\d+)x$/.exec(r); if (x) rip = +x[1]; else if (r === "") rip = 1; else { const m = /(\d+)mtr$/.exec(r); if (m) { somma += rip * +m[1]; if (rip === 1) ultimo = i; } } });
  if (ultimo >= 0 && somma !== totale) { const m = +/(\d+)mtr$/.exec(L[ultimo])[1] + (totale - somma); if (m >= 50) L[ultimo] = L[ultimo].replace(/\d+mtr$/, m + "mtr"); }
  const nota = pause.size ? [`Recuperi da fermo: ${[...pause].join(" e ")}.`, ""] : [];
  return [...nota, ...L].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function testoSeduta(s, ftp) {
  if (s.sport === "nuoto") return testoNuoto(s);
  const riga = (p) => {
    const dist = s.sport === "nuoto" && /^(\d{2,4}) a /.exec(p.cosa || "");
    const quanto = dist ? `${dist[1]}mtr` : durIv(p.min);
    return `- ${cueIv(p.cosa) || "Passo"} ${quanto} ${targetIv(s.sport, p.intensita || p.cosa, ftp)}`.trim();
  };
  const L = [];
  for (const p of s.passi || []) {
    if (p.ripeti) { L.push("", `${p.ripeti}x`, ...p.passi.map(riga), ""); }
    else if (p.min > 0) L.push(riga(p));
  }
  if (s.sport === "forza") {
    // gli esercizi dopo il passo, così Intervals non li legge come intestazioni; l'app li mostra con le foto
    const sch = s.scheda || (s.tipo === "gambe" ? "A" : s.tipo === "alto" ? "B" : "C");
    return `${s.nome}, ${s.min} minuti.\n\n- ${cueIv(s.nome)} ${durIv(s.min)}\n\n${righePal(sch, s.attrezzi, s.scarico).join("\n")}\n\nIn circuito, 75 secondi di recupero tra gli esercizi. Foto e video degli esercizi nell'app: tocca la seduta.`;
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function eventiDaPiano(res, P) {
  const tipo = { corsa: "Run", nuoto: "Swim", forza: "WeightTraining" };
  const out = [];
  for (const w of res.piano.settimane) w.sedute.forEach((s, i) => {
    if (s.sport === "gara" || !s.min || (res.dal && s.data < res.dal)) return;
    out.push({
      category: "WORKOUT",
      start_date_local: `${s.data}T00:00:00`,
      type: s.sport === "bici" ? (P.bici === "rulli" ? "VirtualRide" : "Ride") : tipo[s.sport] || "Workout",
      name: s.nome,
      description: testoSeduta(s.sport === "forza" && !s.attrezzi ? { ...s, attrezzi: (P && P.attrezzi) || "manubri" } : s, CONFIG.bici.potenza ? CONFIG.bici.ftp : null),
      moving_time: s.min * 60,
      icu_training_load: s.carico,
      external_id: `hud-${s.data}-${s.sport}-${i}-${res.timbro || "0"}`,
    });
  });
  return out;
}
// Anteprima per la pagina: solo quello che serve a leggere il blocco
function anteprimaPiano(res, conflitti) {
  const ok = (s) => s.sport !== "gara" && s.min && (!res.dal || s.data >= res.dal);
  return {
    inizio: res.inizio, fine: res.fine, dal: res.dal || null, avvisi: res.piano.avvisi || [], conflitti: conflitti || 0, palestra: res.palestra || null,
    sport: CONFIG.sport,
    livello: { ctl: res.livello.ctl, ore: res.livello.oreSett, lungo: res.livello.lungoCorsaMin, lungoBici: res.livello.lungoBiciMin, rientro: CONFIG.sport.includes("corsa") && !!(res.livello.rientro && res.livello.rientro.corsa) },
    settimane: res.piano.settimane.map((w) => { const ss = w.sedute.filter(ok); return { n: w.n, lunedi: w.lunedi, fase: w.fase, scarico: w.scarico, minuti: res.dal ? ss.reduce((t, s) => t + s.min, 0) : w.minuti, lungo: w.lungoCorsa,
      sedute: ss.map((s) => ({ g: s.giorno, sport: s.sport, nome: s.nome, min: s.min, q: !!s.qualita })) }; }).filter((w) => !res.dal || w.sedute.length),
  };
}

async function ivRichiesta(key, metodo, percorso, corpo, timeout) {
  const r = new Request(BASE + percorso);
  r.method = metodo;
  r.headers = { Authorization: "Basic " + Data.fromString("API_KEY:" + key).toBase64String(), Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (iPhone) HUD" };
  if (corpo !== undefined) r.body = JSON.stringify(corpo);
  r.timeoutInterval = timeout || 40;
  const txt = await r.loadString();
  const code = r.response && r.response.statusCode;
  if (code && code >= 400) throw new Error(`Intervals ha risposto ${code}${txt ? ": " + String(txt).slice(0, 140) : ""}`);
  try { return JSON.parse(txt); } catch (e) { return txt; }
}
// Sedute già nel calendario in quelle settimane, non create dall'app
async function contaConflitti(key, res) {
  const ev = await ivRichiesta(key, "GET", `/events?oldest=${res.dal || res.inizio}&newest=${res.fine}`);
  return (Array.isArray(ev) ? ev : []).filter((e) => (e.category || "WORKOUT") === "WORKOUT" && !String(e.external_id || "").startsWith("hud-")).length;
}
// ------------------------------------------------------------
//  Le sedute dell'app nel calendario: si leggono da Intervals e si tolgono per numero (id).
//  Il profilo può perdersi o restare indietro e la cancellazione per external_id non è affidabile:
//  così, riscrivendo il piano, non resta mai una seduta doppia.
// ------------------------------------------------------------
const diApp = (e) => e && (e.category || "WORKOUT") === "WORKOUT" && String(e.external_id || "").startsWith("hud-") && e.id !== undefined && e.id !== null && !!e.start_date_local;
// hud-AAAA-MM-GG-sport-n-timbro: il timbro dice quale scrittura del piano (i più vecchi non l'hanno)
const timbroDi = (x) => { const p = String(x || "").split("-"); return p.length >= 7 ? p.slice(6).join("-") : ""; };
const quandoTimbro = (t) => { const n = parseInt(String(t || "").slice(0, 8), 36); return isFinite(n) && String(t).length >= 8 ? n : 0; };
// Quali sedute dell'app togliere. opz: { oggi, tieni (Set di external_id della scrittura nuova), tutte (tutte quelle future), corrente (timbro), dal (data) }
function seduteDaTogliere(eventi, opz) {
  const app = (eventi || []).filter(diApp);
  const futura = (e) => e.start_date_local.slice(0, 10) >= opz.oggi && !e.paired_activity_id;
  const via = new Map();
  // 1. copie con lo stesso codice nello stesso giorno (scrittura ripetuta): resta la più recente.
  //    Una copia spostata dall'utente su un altro giorno non si tocca.
  const perCodice = new Map();
  for (const e of app) { const k = e.external_id + "|" + e.start_date_local.slice(0, 10); const L = perCodice.get(k) || []; L.push(e); perCodice.set(k, L); }
  for (const L of perCodice.values()) if (L.length > 1) L.slice().sort((x, y) => Number(y.id) - Number(x.id)).slice(1).filter(futura).forEach((e) => via.set(String(e.id), e));
  // 2. versioni vecchie del piano dal giorno in cui comincia quella nuova
  const future = app.filter(futura);
  if (opz.tutte) future.forEach((e) => via.set(String(e.id), e));
  else if (opz.tieni) future.filter((e) => e.start_date_local.slice(0, 10) >= (opz.dal || opz.oggi) && !opz.tieni.has(e.external_id)).forEach((e) => via.set(String(e.id), e));
  else if (opz.corrente) {
    const dal = opz.dal || app.filter((e) => timbroDi(e.external_id) === opz.corrente).map((e) => e.start_date_local.slice(0, 10)).sort()[0];
    if (dal) future.filter((e) => timbroDi(e.external_id) !== opz.corrente && e.start_date_local.slice(0, 10) >= dal).forEach((e) => via.set(String(e.id), e));
  }
  return [...via.values()];
}
// Toglie le sedute (per id), poi ricontrolla: quelle ancora lì si tolgono una per una
async function togliSedute(key, evs) {
  if (!evs.length) return 0;
  const ids = evs.map((e) => e.id);
  try { await ivRichiesta(key, "PUT", "/events/bulk-delete", ids.map((id) => ({ id })), 60); } catch (e) { registro("bulk-delete: " + (e.message || e)); }
  const date = evs.map((e) => e.start_date_local.slice(0, 10)).sort();
  let resta = [];
  try {
    const cal = await ivRichiesta(key, "GET", `/events?oldest=${date[0]}&newest=${date[date.length - 1]}`);
    const cerca = new Set(ids.map(String));
    resta = (Array.isArray(cal) ? cal : []).filter((e) => cerca.has(String(e.id)));
  } catch (e) { registro("verifica cancellazione: " + (e.message || e)); }
  let falliti = 0;
  for (const e of resta) { try { await ivRichiesta(key, "DELETE", `/events/${e.id}`); } catch (err) { falliti++; registro(`seduta ${e.id} non tolta: ${err.message || err}`); } }
  return ids.length - falliti;
}
// All'apertura: se nel calendario ci sono sedute dell'app doppie o di un piano vecchio, si tolgono
async function pulisciCalendario(key, P, eventi, now) {
  if (!key || !P || !Array.isArray(eventi)) return [];
  const oggi = ymd(now);
  const app = eventi.filter(diApp);
  if (!app.length) return [];
  let opz = { oggi };
  if (P.pianoApp === false) opz.tutte = true; // con il suo piano le sedute future dell'app non servono più
  else if (!P.pianoPendente) {
    // la scrittura corrente: la più recente registrata nel profilo, altrimenti la più recente nel calendario
    const tim = (L) => L.map(timbroDi).filter(Boolean).sort((x, y) => quandoTimbro(y) - quandoTimbro(x))[0] || null;
    const corrente = tim((P.piano && P.piano.ids) || []) || tim(app.map((e) => e.external_id));
    if (corrente) opz = { oggi, corrente, dal: P.piano && tim(P.piano.ids || []) === corrente && P.piano.inizio ? P.piano.dal || P.piano.inizio : null };
  }
  const via = seduteDaTogliere(eventi, opz);
  if (!via.length) return [];
  const n = await togliSedute(key, via);
  registro(`calendario: tolte ${n} sedute dell'app doppie o vecchie`);
  return n ? via : [];
}
async function scriviPiano(key, P, res, now) {
  const oggi = ymd(now);
  const ev = eventiDaPiano(res, P);
  const nuovi = ev.map((e) => e.external_id);
  // le sedute in scrittura restano tracciate anche se l'app si chiude a metà
  const primo = res.dal || res.inizio;
  P.pianoPendente = { ids: nuovi, inizio: primo };
  scriviProfilo(P);
  await ivRichiesta(key, "POST", "/events/bulk?upsert=true", ev, 120);
  // poi tolgo dal calendario le sedute dell'app che il piano nuovo sostituisce (dal suo primo giorno scritto, mai prima di oggi)
  const dal = primo > oggi ? primo : oggi;
  let tolte = 0;
  try {
    const cal = await ivRichiesta(key, "GET", `/events?oldest=${dal}&newest=${ymd(addDays(parseYMD(dal), 140))}`);
    tolte = await togliSedute(key, seduteDaTogliere(cal, { oggi: dal, dal, tieni: new Set(nuovi) }));
  } catch (e) { registro("Vecchie sedute non tolte: " + (e.message || e)); }
  if (tolte) registro(`piano riscritto: tolte ${tolte} sedute vecchie dell'app`);
  const restano = [...new Set([...((P.piano && P.piano.ids) || [])])].filter((id) => String(id).startsWith("hud-") && String(id).slice(4, 14) < dal && !nuovi.includes(id)).slice(-300);
  P.piano = { inizio: res.inizio, fine: res.fine, indice: res.indice, ids: [...restano, ...nuovi], scritto: now.toISOString(), ...(res.dal ? { dal: res.dal } : {}) };
  delete P.pianoPendente;
  scriviProfilo(P);
  return ev.length;
}

