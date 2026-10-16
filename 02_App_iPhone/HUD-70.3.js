// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: heartbeat;
// SPDX-License-Identifier: AGPL-3.0-only
// HUD · app di allenamento per atleti di endurance. Codice libero sotto licenza GNU AGPL 3.0: vedi LICENSE nel repository.

// ============================================================
//  HUD  ·  v4 (versione per i tester)
//  Controllo quotidiano da iPhone su dati di Intervals.icu.
//  La chiave API resta nel Portachiavi dell'iPhone, mai nel codice.
//  I dati di ogni persona stanno nel file hud-profilo.json (iCloud › Scriptable),
//  creato dalla configurazione al primo avvio: qui sotto ci sono solo valori generici.
// ============================================================

const VERSIONE = "1.6";

// ------------------------------------------------------------
//  CONFIGURAZIONE — valori di partenza uguali per tutti
// ------------------------------------------------------------
const CONFIG = {
  nomeApp: "HUD",
  sport: ["nuoto", "bici", "corsa"], // gli sport della persona, dal profilo
  soglieAutomatiche: true, // le soglie stimate dalle attività vanno su Intervals da sole, tranne quelle fissate nel profilo
  soglieFissate: [],
  feedbackEmail: "", // dove arrivano i commenti dei tester (vuoto: la mail si apre senza destinatario)

  // Obiettivo: arriva dal profilo ({ nome, data, tipo, ctlGara }) oppure null.
  obiettivo: null,

  peso: null,                                // { partenza, obiettivo } in kg, dal profilo
  // record di prima dell'app per distanza (es. c5000: "22:30"): li batte solo chi fa meglio
  record: {},
  // domani: la sera prima, l'allenamento nel dettaglio; settimana: domenica alle 20:30; attivita: quando una seduta arriva
  // da Intervals ad app chiusa (serve il widget). Tutte finiscono anche nella campana dell'app.
  notifiche: { domani: "19:30", ricarica: true, affaticamento: true, settimana: true, attivita: true },

  // Soglie: se restano null le legge dalle attività di Intervals
  corsa: { lthr: null, fcMax: null, passoSoglia: null, zoneFC: {} },
  nuoto: { css: null, recuperoBlocchi: '20"' },
  bici: { sogliaFC: null, ftp: null, daVerificare: true },

  volumeObiettivo: null,

  // Scala del lungo di corsa (minuti): con il piano dell'app la decide il generatore
  scalaLungo: [],
  tolleranzaLungoMin: 5,

  // Palestra fuori da Intervals (0 = domenica…): con il piano dell'app è nel calendario
  palestra: {},

  // Soglie del semaforo
  soglie: {
    fcRiposoGiallo: 5,     // bpm sopra la media dei 7 giorni
    fcRiposoRosso: 8,
    sonnoGiallo: 60,       // sleep score
    sonnoOreGiallo: 6,     // ore dormite
    tsbRosso: -30,         // forma (CTL − ATL)
    dislivelloCorsa: 400,  // m D+ in una corsa → tessuti gialli per 72 h
    caricoOltrePiano: 1.5, // carico effettivo / pianificato
  },

  riegelK: null, // { valore, obiettivo } se lo misuri

  // Carburante: calorie = base (metabolismo a riposo × fattoreBase) + allenamento − deficit.
  // Ordine dei macro: proteine per kg → carboidrati per kg secondo il carico del giorno → grassi con un minimo.
  // Il deficit c'è solo con un peso obiettivo più basso di quello attuale, si misura in % del peso a settimana,
  // è più forte nei giorni leggeri e si ferma qualche settimana prima della gara. I limiti di sicurezza vincono su tutto.
  nutrizione: {
    metabolismo: "tenHaaf",                          // "tenHaaf" (ten Haaf 2014, la più precisa negli atleti) o "mifflin"
    fattoreBase: 1.3,                                // la giornata senza allenamento: metabolismo a riposo × 1,3
    ritmoCalo: 0.5,                                  // % del peso a settimana mentre dimagrisci (0,25–0,75; mai oltre 1)
    pesoDeficit: { riposo: 1.5, medio: 1.5, duro: 0.7, lungo: 0.3, carico: 0 }, // quanto del deficit medio cade in ogni tipo di giorno
    deficitMaxQuota: 0.25,                           // mai più del 25% delle calorie del giorno
    energiaMin: { M: 25, F: 30 },                    // kcal per kg di massa magra che restano tolto l'allenamento
    kcalMin: { M: 1800, F: 1500 },                   // mai sotto, in nessun giorno
    proteineGkg: { dimagrimento: 2.0, mantenimento: 1.8 },
    carboGkg: { riposo: 3, medio: 4.5, duro: 6, lungo: 7, carico: 10 }, carboVigilia: 1, carboMinGkg: 3,
    grassiMinGkg: 0.8, grassiMinQuota: 0.2, grassiMaxQuota: 0.35, // grassi: almeno 0,8 g/kg e il 20% delle calorie, al massimo il 35%
    caricoPreGara: true,
    calorieAdattive: true, maxCorrezioneAdattiva: 300, // la base impara dalle pesate e dal cibo registrato (±300 kcal al massimo)                             // i 2 giorni prima di una gara lunga: carico di carboidrati
    stopPrimaDellaGara: 12,                          // settimane prima della gara senza deficit
    ritmo: { lento: 0.25, veloce: 0.9 },             // % del peso a settimana: sotto si stringe, sopra si mangia di più
    correzione: { piuCibo: 250, menoCibo: 150 },     // kcal al giorno
    lungoMin: 75, integratori: [],
  },

  // Rifornimento nelle sedute lunghe: le dosi salgono verso quelle della gara solo se lo stomaco le regge
  rifornimento: {
    bici: { da: 60, a: 90 }, corsa: { da: 40, a: 60 }, // g di carboidrati all'ora: partenza e gara
    gareLunghe: ["70.3", "ironman", "maratona", "mezza", "granfondo"],
    settimane: [26, 5],                              // la dose sale da 26 a 5 settimane prima della gara lunga
    sudore: { corsa: 1.0, bici: 0.9 },               // litri all'ora a 18 °C per 75 kg: stima, si tara con le pesate
    sodioMgL: 1000,                                  // sodio perso per litro di sudore (media)
    // cosa porti: un gel da 25 g (il nome compare sull'orologio: corto, senza numeri)
    prodotti: { gel: { nome: "gel", g: 25 } },
    // scrive gli orari del rifornimento nei lunghi creati dall'app su Intervals: l'orologio vibra e dice cosa prendere
    avvisiOrologio: true,
  },

  resetChiave: false, // metti true e lancia lo script per reinserire la chiave
};

// Fitness (CTL) di riferimento al picco, per tipo di gara, quando il profilo non ne indica una
// Gare per combinazione di sport (chiave: sport in ordine alfabetico). ctl = fitness di riferimento al picco,
// indicativa, usata solo se il profilo non ne indica una
const GARE = {
  "bici+corsa+nuoto": [["sprint", "Sprint", 45], ["olimpico", "Olimpico", 55], ["70.3", "70.3", 70], ["ironman", "Ironman", 85]],
  corsa: [["5k", "5 km", 35], ["10k", "10 km", 42], ["mezza", "Mezza", 50], ["maratona", "Maratona", 60]],
  bici: [["mediofondo", "Mediofondo", 55], ["granfondo", "Granfondo", 65]],
  nuoto: [["nuoto-3k", "Fino a 3 km", 30], ["nuoto-10k", "5–10 km", 40]],
  "bici+corsa": [["duathlon-sprint", "Sprint", 45], ["duathlon", "Standard", 55]],
  "corsa+nuoto": [["aquathlon", "Aquathlon", 40]],
};
const TUTTE_GARE = Object.values(GARE).flat();
const ctlGaraDi = (tipo) => (TUTTE_GARE.find((g) => g[0] === tipo) || [])[2] || null;
const chiaveSport = (sp) => sp.slice().sort().join("+");
// Gli sport della persona: dalla configurazione, oppure (profili della prima versione) da piscina e bici
function sportDi(P) {
  const ok = ["nuoto", "bici", "corsa"];
  if (P && P.soloPalestra) return [];
  if (P && Array.isArray(P.sport) && P.sport.some((x) => ok.includes(x))) return ok.filter((x) => P.sport.includes(x));
  if (!P) return ok.slice();
  return ok.filter((x) => x === "corsa" || (x === "bici" && P.bici !== "no") || (x === "nuoto" && P.piscina !== false));
}

const KEY_NAME = "hud703_intervals_key";
const BASE = "https://intervals.icu/api/v1/athlete/0";
const CACHE_FILE = "hud703-cache-v2.json";
let DETTAGLI = {}; // grafici, percorso e giri delle attività già scaricati (hud703-dettagli.json)

// ------------------------------------------------------------
//  Utilità
// ------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parseYMD = (s) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const daysBetween = (a, b) => Math.round((parseYMD(ymd(b)) - parseYMD(ymd(a))) / 86400000);
const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };
const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const GG = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

const fmtDur = (sec) => { if (!sec) return "0h00"; const m = Math.round(sec / 60); return `${Math.floor(m / 60)}h${pad(m % 60)}`; };
const fmtMin = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${pad(min % 60)}` : `${min}'`);
const fmtStepDur = (s) => { s = Math.round(s); if (s < 60) return `${s}"`; const m = Math.floor(s / 60), r = s % 60; return r ? `${m}'${pad(r)}"` : (m >= 60 ? fmtMin(m) : `${m}'`); };
const fmtDist = (m, sport) => (sport === "nuoto" || m < 1000 ? `${Math.round(m)} m` : `${fmtIt(m / 1000, m % 1000 ? 1 : 0)} km`);
const toSec = (mmss) => { const [m, s] = String(mmss).split(":").map(Number); return m * 60 + (s || 0); };
const fmtPace = (sec) => { sec = Math.round(sec); return `${Math.floor(sec / 60)}:${pad(sec % 60)}`; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const fmtIt = (v, dec = 0) => v.toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const kgIt = (v) => fmtIt(v, Math.abs(v % 1) > 0.01 ? 1 : 0); // 59 kg, 58,5 kg
const signed = (v) => (v === null ? "—" : (v < 0 ? "−" : v > 0 ? "+" : "") + fmtIt(Math.abs(Math.round(v))));

function sportOf(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("swim")) return "nuoto";
  if (t.includes("run")) return "corsa";
  if (t.includes("ride") || t.includes("bike") || t.includes("cycl")) return "bici";
  if (t.includes("weight") || t.includes("strength") || t === "workout") return "forza";
  return "altro";
}

// Zone di forma come su Intervals.icu
function formZone(tsb) {
  if (tsb === null) return { name: "—", c: "#8E8E93" };
  if (tsb > 25) return { name: "Transizione", c: "#FFD60A" };
  if (tsb > 5) return { name: "Fresco", c: "#64D2FF" };
  if (tsb > -10) return { name: "Zona grigia", c: "#8E8E93" };
  if (tsb > -30) return { name: "Ottimale", c: "#30D158" };
  return { name: "Rischio alto", c: "#FF453A" };
}

// ------------------------------------------------------------
//  Dati: Intervals.icu (o demo)
// ------------------------------------------------------------
// Scarica da Intervals. Con i dati dell'ultima apertura (prev) prende solo quello che può essere cambiato:
// benessere degli ultimi 3 giorni e attività degli ultimi 7 (sync in ritardo, modifiche, cancellazioni).
// Una volta a settimana riscarica tutto, così niente resta indietro.
const RAW_VER = 3;
async function fetchIntervals(key, now, prev) {
  const auth = "Basic " + Data.fromString("API_KEY:" + key).toBase64String();
  const get = async (path) => {
    const r = new Request(BASE + path);
    r.headers = { Authorization: auth, Accept: "application/json", "User-Agent": "Mozilla/5.0 (iPhone) HUD703" };
    r.timeoutInterval = 25;
    const j = await r.loadJSON();
    const code = r.response && r.response.statusCode;
    if (code && code >= 400) throw new Error(`Intervals ha risposto ${code} su ${path.split("?")[0]}`);
    return j;
  };
  const mon = mondayOf(now);
  const wOld = addDays(now, -365), aOld = addDays(now, -180);
  const pieno = !prev || prev.v !== RAW_VER || prev.stale || !prev.fullAt || !Array.isArray(prev.wellness) || !Array.isArray(prev.activities) || (now - new Date(prev.fullAt)) > 7 * 864e5 || (now - new Date(prev.fetchedAt || 0)) < -36e5;
  const wDa = pieno ? wOld : addDays(new Date(prev.fetchedAt), -3), aDa = pieno ? aOld : addDays(new Date(prev.fetchedAt), -7);
  const [wNew, events, aNew, atl] = await Promise.all([
    get(`/wellness?oldest=${ymd(wDa)}&newest=${ymd(now)}`),
    get(`/events?oldest=${ymd(mon)}&newest=${ymd(addDays(mon, 13))}&resolve=true`),
    get(`/activities?oldest=${ymd(aDa)}&newest=${ymd(now)}`),
    get("").catch(() => null),
  ]);
  // delle impostazioni dell'atleta tengo solo le soglie per sport (niente altro finisce nella cache)
  const impostazioni = atl && Array.isArray(atl.sportSettings) ? atl.sportSettings.map((x) => ({ id: x.id, types: x.types || [], lthr: x.lthr ?? null, max_hr: x.max_hr ?? null, threshold_pace: x.threshold_pace ?? null, ftp: x.ftp ?? null })) : (prev && prev.impostazioni) || null;
  if (pieno) return { v: RAW_VER, wellness: wNew, events, activities: aNew, impostazioni, fetchedAt: now.toISOString(), fullAt: now.toISOString(), nuove: null };
  // unisci: il benessere per giorno, le attività per id (quelle sparite nella finestra riscaricata sono state cancellate)
  const W = new Map((prev.wellness || []).filter((w) => w && w.id && w.id >= ymd(wOld)).map((w) => [w.id, w]));
  for (const w of wNew || []) if (w && w.id) W.set(w.id, w);
  const daA = ymd(aDa), nuoveIds = new Set((aNew || []).map((a) => String(a.id)));
  const vecchie = (prev.activities || []).filter((a) => a && a.start_date_local && a.start_date_local.slice(0, 10) >= ymd(aOld) && a.start_date_local.slice(0, 10) < daA && !nuoveIds.has(String(a.id)));
  const prima = new Set((prev.activities || []).map((a) => String(a.id)));
  const activities = [...vecchie, ...(aNew || [])].sort((a, b) => b.start_date_local.localeCompare(a.start_date_local));
  return { v: RAW_VER, wellness: [...W.values()].sort((a, b) => a.id.localeCompare(b.id)), events, activities, impostazioni, fetchedAt: now.toISOString(), fullAt: prev.fullAt, nuove: (aNew || []).filter((a) => !prima.has(String(a.id))).map((a) => a.id) };
}

// Scrive gli orari del rifornimento nei lunghi da fare (oggi e dopo) su Intervals, da lì all'orologio.
// Tocca solo il testo dei passi; se Intervals lo legge con una durata diversa, rimette subito il testo di prima.
async function scriviAvvisi(raw, A, key, now) {
  const RF = A && A.nutrition && A.nutrition.rif;
  if (!CONFIG.rifornimento.avvisiOrologio || !RF || !key || raw.stale) return [];
  const auth = "Basic " + Data.fromString("API_KEY:" + key).toBase64String();
  const put = async (id, description) => {
    const r = new Request(`${BASE}/events/${id}`);
    r.method = "PUT";
    r.headers = { Authorization: auth, Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (iPhone) HUD703" };
    r.body = JSON.stringify({ description });
    r.timeoutInterval = 20;
    const txt = await r.loadString();
    const code = r.response && r.response.statusCode;
    if (code && code >= 400) throw new Error(`Intervals ha risposto ${code}`);
    try { return JSON.parse(txt); } catch (e) { return null; }
  };
  const oggi = ymd(now), acts = raw.activities || [], out = [];
  const accoppiate = new Set(acts.map((a) => a.paired_event_id).filter((x) => x !== null && x !== undefined).map(String));
  for (const e of raw.events || []) {
    if ((e.category || "WORKOUT") !== "WORKOUT" || e.id === undefined || !e.start_date_local) continue;
    if (!String(e.external_id || "").startsWith("hud-")) continue; // solo le sedute del piano dell'app: quelle dell'allenatore non si toccano
    const d = e.start_date_local.slice(0, 10), sp = sportOf(e.type), desc = String(e.description || "");
    if (d < oggi || (sp !== "bici" && sp !== "corsa") || !desc.trim() || /senza avvisi/i.test(desc)) continue;
    if (accoppiate.has(String(e.id)) || (d === oggi && acts.some((a) => (a.start_date_local || "").slice(0, 10) === d && sportOf(a.type) === sp))) continue; // già fatta
    const min = Math.round((num(e.moving_time) ?? num(e.elapsed_time) ?? num(e.duration) ?? 0) / 60);
    const indoor = e.trainer === true || /virtual/i.test(e.type || "") || /tapis|treadmill|indoor|rulli|spinning|cyclette/i.test(e.name || "");
    // bici senza misuratore di potenza: «Z2» da solo Intervals lo legge come zona di potenza, quindi diventa «Z2 HR»
    const base = sp === "bici" && CONFIG.bici && CONFIG.bici.potenza === false ? zoneFC(desc) : desc;
    const r = testoConAvvisi(base, schemaRifornimento(sp, min, RF, indoor));
    if (r.testo === desc) continue;
    try {
      const nuovo = await put(e.id, r.testo);
      const prima = e.workout_doc && num(e.workout_doc.duration), dopo = nuovo && nuovo.workout_doc && num(nuovo.workout_doc.duration);
      if (prima && dopo && Math.abs(prima - dopo) > 60) {
        await put(e.id, desc); // letta male: torna com'era
        registro(`avvisi tolti da ${e.name}: Intervals leggeva ${Math.round(dopo / 60)}' invece di ${Math.round(prima / 60)}'`);
        continue;
      }
      e.description = r.testo; // i passi nuovi si leggono dalla prossima apertura
      out.push({ id: e.id, nome: e.name || "Seduta", d, n: r.inseriti.length, zone: base !== desc, avvisi: r.testo !== base });
      registro(`avvisi di rifornimento su ${e.name} (${d}): ${r.inseriti.length}`);
    } catch (err) { registro(`avvisi non scritti su ${e.name}: ${err && err.message ? err.message : err}`); }
  }
  return out;
}


// ------------------------------------------------------------
//  Attività: grafici, percorso, giri e parziali dalle registrazioni (stream) di Intervals
// ------------------------------------------------------------
const API = BASE.replace(/\/athlete\/0$/, "");
const DET_FILE = "hud703-dettagli.json", DET_VER = 1, ATT_GIORNI = 45;
const TIPI_STREAM = ["time", "heartrate", "velocity_smooth", "distance", "altitude", "fixed_altitude", "latlng", "cadence", "watts", "temp", "respiration"];
function dettagliIO() {
  const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), DET_FILE);
  return {
    read: () => { try { if (fm.fileExists(p)) { const j = JSON.parse(fm.readString(p)); if (j && j.at) return j.at; } } catch (e) {} return {}; },
    write: (at) => { try { fm.writeString(p, JSON.stringify({ v: DET_VER, at })); } catch (e) { console.log("Dettagli non salvati: " + e); } },
  };
}
async function ivGet(key, url) {
  const r = new Request(url);
  r.headers = { Authorization: "Basic " + Data.fromString("API_KEY:" + key).toBase64String(), Accept: "application/json", "User-Agent": "Mozilla/5.0 (iPhone) HUD703" };
  r.timeoutInterval = 25;
  const txt = await r.loadString();
  const code = r.response && r.response.statusCode;
  if (code && code >= 400) throw new Error(`Intervals ha risposto ${code}`);
  return JSON.parse(txt);
}
// Riduce una serie a n punti (media per tratto, senza buchi né zeri finti)
function riduci(arr, n, dec = 0, zeroVuoto = false) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const out = [], k = arr.length / n, f = 10 ** dec;
  for (let i = 0; i < Math.min(n, arr.length); i++) {
    let s = 0, c = 0;
    for (let j = Math.floor(i * k); j < Math.max(Math.floor(i * k) + 1, Math.floor((i + 1) * k)) && j < arr.length; j++) { const v = arr[j]; if (typeof v === "number" && isFinite(v) && !(zeroVuoto && v === 0)) { s += v; c++; } }
    out.push(c ? Math.round((s / c) * f) / f : null);
  }
  for (let i = 0; i < out.length; i++) if (out[i] === null) out[i] = out[i - 1] ?? out.find((v) => v !== null) ?? 0; // riempi i buchi
  return out.some((v) => v) ? out : null;
}
const distM = (a1, o1, a2, o2) => { const R = 6371000, r = Math.PI / 180, dA = (a2 - a1) * r, dO = (o2 - o1) * r; const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
// Il tratto più veloce lungo almeno d metri (due indici che scorrono sulla distanza)
function migliori(T, D, distanze) {
  const out = {};
  if (!T || !D || T.length !== D.length || D.length < 10) return out;
  for (const d of distanze) {
    if ((D[D.length - 1] || 0) < d) continue;
    let j = 0, best = null;
    for (let i = 1; i < D.length; i++) {
      if (typeof D[i] !== "number") continue;
      while (j + 1 < i && typeof D[j + 1] === "number" && D[i] - D[j + 1] >= d) j++;
      if (D[i] - D[j] >= d) { const t = T[i] - T[j]; if (t > 0 && (best === null || t < best)) best = t; }
    }
    if (best) out[d] = Math.round(best);
  }
  return out;
}
const DIST_RECORD = { corsa: [1000, 5000, 10000, 21097], nuoto: [100, 400, 1000] };
function calcolaDettaglio(a, streams, ivs) {
  const S = {};
  for (const st of Array.isArray(streams) ? streams : []) if (st && st.type && Array.isArray(st.data)) S[st.type] = st;
  const sp = sportOf(a.type), out = { v: DET_VER, id: a.id, s: {} };
  // giri (intervalli di Intervals, altrimenti il riassunto)
  const L = ivs && Array.isArray(ivs.icu_intervals) ? ivs.icu_intervals : [];
  out.giri = L.slice(0, 40).map((g, i) => ({ n: i + 1, tipo: g.type || "", nome: g.label || "", sec: num(g.moving_time) ?? num(g.elapsed_time), m: num(g.distance), hr: num(g.average_heartrate), hrM: num(g.max_heartrate), v: num(g.average_speed), w: num(g.average_watts), cad: num(g.average_cadence) })).filter((g) => g.sec);
  const hr = S.heartrate && S.heartrate.data, T = S.time && S.time.data;
  const n = (T || hr || (S.distance && S.distance.data) || []).length;
  if (!n) return out;
  // migliori tempi sulle distanze dei record (corsa e nuoto in piscina)
  if (DIST_RECORD[sp] && S.distance && T && !(sp === "nuoto" && a.type !== "Swim")) { const b = migliori(T, S.distance.data, DIST_RECORD[sp]); if (Object.keys(b).length) out.best = b; }
  const N = 240;
  out.s.hr = riduci(hr, N, 0, true);
  out.s.v = riduci(S.velocity_smooth && S.velocity_smooth.data, N, 2);
  out.s.alt = riduci((S.altitude || S.fixed_altitude || {}).data, N, 0);
  out.s.cad = riduci(S.cadence && S.cadence.data, N, 0, true);
  out.s.w = riduci(S.watts && S.watts.data, N, 0);
  out.s.temp = riduci(S.temp && S.temp.data, N, 1);
  out.s.resp = riduci(S.respiration && S.respiration.data, N, 1, true);
  out.s.d = riduci(S.distance && S.distance.data, N, 0);
  for (const k of Object.keys(out.s)) if (!out.s[k]) delete out.s[k];
  const hv = (hr || []).filter((v) => v > 30);
  if (hv.length) out.hrMin = Math.min(...hv);
  // percorso: senza i primi e gli ultimi 250 m, così non si vede da dove parti
  const LL = S.latlng;
  if (LL && Array.isArray(LL.data2) && LL.data.length === LL.data2.length) {
    const pts = [];
    for (let i = 0; i < LL.data.length; i++) { const la = LL.data[i], lo = LL.data2[i]; if (typeof la === "number" && typeof lo === "number" && (la || lo)) pts.push([la, lo]); }
    if (pts.length > 10) {
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distM(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
      const tot = cum[cum.length - 1], cut = tot > 2000 ? 250 : tot * 0.1;
      const tenuti = pts.filter((_, i) => cum[i] >= cut && cum[i] <= tot - cut), k = Math.max(1, Math.ceil(tenuti.length / 400));
      const r = tenuti.filter((_, i) => i % k === 0);
      if (r.length > 5) out.route = { lat: r.map((p) => Math.round(p[0] * 1e5) / 1e5), lng: r.map((p) => Math.round(p[1] * 1e5) / 1e5) };
    }
  }
  // parziali al km (corsa e camminata con la distanza)
  const D = S.distance && S.distance.data, AL = (S.altitude || S.fixed_altitude || {}).data;
  if (D && T && ["corsa", "altro"].includes(sp) && (num(a.distance) || 0) >= 1500) {
    const sp1 = []; let i0 = 0, km = 1;
    for (let i = 1; i < D.length; i++) {
      if (D[i] >= km * 1000 || i === D.length - 1) {
        const ult = i === D.length - 1 && D[i] < km * 1000, m = D[i] - D[i0], sec = T[i] - T[i0];
        if (m > (ult ? 200 : 900) && sec > 0) {
          const hh = (hr || []).slice(i0, i + 1).filter((v) => v > 30);
          let su = 0; if (AL) for (let j = i0 + 1; j <= i; j++) { const d = (AL[j] ?? 0) - (AL[j - 1] ?? 0); if (d > 0) su += d; }
          sp1.push({ km: ult ? Math.round(m / 10) / 100 : km, sec: Math.round(sec), passo: Math.round(sec / (m / 1000)), hr: hh.length ? Math.round(mean(hh)) : null, su: AL ? Math.round(su) : null, parz: ult });
        }
        i0 = i; km++;
        if (sp1.length >= 60) break;
      }
    }
    if (sp1.length) out.km = sp1;
  }
  // deriva: efficienza (velocità o potenza per battito) nella prima e nella seconda metà, senza riscaldamento e defaticamento
  if (hr && T && (sp === "corsa" || sp === "bici") && T[T.length - 1] >= 2400) {
    const t0 = 600, t1 = T[T.length - 1] - 300, mid = (t0 + t1) / 2, base = (S.watts && S.watts.data && S.watts.data.some((v) => v > 0)) ? S.watts.data : S.velocity_smooth && S.velocity_smooth.data && S.velocity_smooth.data.some((v) => v > 0) ? S.velocity_smooth.data : null;
    const met = (da, a2) => { let h = 0, b = 0, c = 0; for (let i = 0; i < T.length; i++) if (T[i] >= da && T[i] < a2 && hr[i] > 30) { h += hr[i]; b += base ? base[i] || 0 : 0; c++; } return c ? { h: h / c, b: b / c } : null; };
    const m1 = met(t0, mid), m2 = met(mid, t1);
    if (m1 && m2) out.deriva = base && m1.b > 0 && m2.b > 0 ? { tipo: "dis", v: Math.round(((m1.b / m1.h - m2.b / m2.h) / (m1.b / m1.h)) * 1000) / 10 } : { tipo: "fc", v: Math.round(((m2.h - m1.h) / m1.h) * 1000) / 10 };
  }
  return out;
}
// Scarica (una volta sola) i dettagli delle attività che servono
async function scaricaDettagli(key, acts, cache, leggero = false) {
  let nuovi = 0;
  for (const a of acts) {
    const c = a && cache[a.id];
    if (!a || a.id === undefined || (c && c.v === DET_VER && (leggero || !c.slim))) continue;
    const base = leggero ? ["time", "distance", "heartrate", "velocity_smooth", "watts"] : TIPI_STREAM;
    const tipi = base.filter((t) => t === "time" || !Array.isArray(a.stream_types) || a.stream_types.includes(t));
    let streams = [], ivs = null;
    try { streams = await ivGet(key, `${API}/activity/${a.id}/streams.json?types=${tipi.join(",")}`); } catch (e) { registro(`registrazione di ${a.name} non scaricata: ${e.message || e}`); if (leggero) continue; }
    if (!leggero) { try { ivs = await ivGet(key, `${API}/activity/${a.id}?intervals=true`); } catch (e) {} }
    try { const d = calcolaDettaglio(a, streams, ivs); cache[a.id] = leggero ? snello(d) : d; nuovi++; } catch (e) { registro(`dettagli di ${a.name}: ${e.message || e}`); }
  }
  return nuovi;
}
// Per i giorni vecchi bastano deriva e migliori tempi: niente grafici né percorso
const snello = (d) => ({ v: d.v, id: d.id, slim: true, ...(d.deriva ? { deriva: d.deriva } : {}), ...(d.best ? { best: d.best } : {}), ...(d.hrMin ? { hrMin: d.hrMin } : {}) });
// Sedute che servono a progressi e record: bici da 1h15, corse da 1 km, nuoti in piscina da 400 m (ultimi 180 giorni)
function daCompletare(raw, now, cache) {
  return (raw.activities || []).filter((a) => a && a.start_date_local && a.id !== undefined && !cache[a.id] && daysBetween(parseYMD(a.start_date_local), now) <= 180 && (
    (sportOf(a.type) === "bici" && (num(a.moving_time) || 0) >= 4500) || (sportOf(a.type) === "corsa" && (num(a.distance) || 0) >= 1000) || (a.type === "Swim" && (num(a.distance) || 0) >= 400)))
    .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local));
}
// In sottofondo, poche per volta: alla prossima apertura progressi e record sono più completi
async function completaStorico(key, raw, now, quante = 4) {
  const L = daCompletare(raw, now, DETTAGLI).slice(0, quante);
  if (!L.length) return 0;
  const n = await scaricaDettagli(key, L, DETTAGLI, true);
  if (n) { potaDettagli(DETTAGLI, raw, now); dettagliIO().write(DETTAGLI); registro(`storico: ${n} sedute (${daCompletare(raw, now, DETTAGLI).length} ancora da leggere)`); }
  return n;
}
function potaDettagli(cache, raw, now) {
  const eta = new Map((raw.activities || []).filter((a) => a.start_date_local).map((a) => [String(a.id), daysBetween(parseYMD(a.start_date_local), now)]));
  for (const k of Object.keys(cache)) {
    const g = eta.get(String(k));
    if (g === undefined || g > 180) delete cache[k];
    else if (g > ATT_GIORNI && !cache[k].slim) cache[k] = snello(cache[k]); // dopo 45 giorni restano solo i numeri
  }
  return cache;
}
// Il giorno da mostrare all'apertura: oggi se hai fatto qualcosa, sennò l'ultimo giorno con attività
function giornoAttivita(raw, now) {
  const oggi = ymd(now), ds = (raw.activities || []).map((a) => (a.start_date_local || "").slice(0, 10)).filter((d) => d && d <= oggi).sort();
  return ds.includes(oggi) ? oggi : ds[ds.length - 1] || oggi;
}
// I dati della scheda Attività: un riassunto per ogni attività degli ultimi 45 giorni, il contesto del giorno e i dettagli già scaricati
function datiAttivita(raw, dia, now, dettagli, soloGiorni) {
  const acts = (raw.activities || []).filter((a) => a && a.start_date_local && daysBetween(parseYMD(a.start_date_local), now) <= ATT_GIORNI && daysBetween(parseYMD(a.start_date_local), now) >= 0)
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));
  const evs = (raw.events || []).filter((e) => e && e.id !== undefined);
  const al = (x) => x.trainer === true || /virtual/i.test(x.type || "") || /tapis|treadmill|indoor|rulli|spinning|cyclette/i.test(x.name || "");
  const r1 = (v, d = 0) => (num(v) === null ? null : Math.round(v * 10 ** d) / 10 ** d);
  const att = {}, ctx = {}, det = {}, apri = giornoAttivita(raw, now), oggiS = ymd(now);
  const tutti = [...new Set(acts.map((a) => a.start_date_local.slice(0, 10)))];
  const tieni = soloGiorni ? new Set(soloGiorni) : new Set(tutti.filter((ds) => daysBetween(parseYMD(ds), now) <= 7 || ds === apri));
  for (const a of acts) {
    if (!tieni.has(a.start_date_local.slice(0, 10))) continue;
    const ds = a.start_date_local.slice(0, 10), sec = num(a.moving_time) ?? num(a.elapsed_time) ?? 0, ini = new Date(a.start_date_local);
    const fine = new Date(ini.getTime() + (num(a.elapsed_time) ?? sec) * 1000);
    const ev = a.paired_event_id !== undefined && a.paired_event_id !== null ? evs.find((e) => String(e.id) === String(a.paired_event_id)) : null;
    (att[ds] = att[ds] || []).push({
      id: a.id, sp: sportOf(a.type), tipo: a.type, nome: a.name || "", data: ds, ora: a.start_date_local.slice(11, 16), fine: `${pad(fine.getHours())}:${pad(fine.getMinutes())}`,
      sec, el: num(a.elapsed_time), m: r1(a.distance), v: r1(a.average_speed, 3), vMax: r1(a.max_speed, 2), hr: r1(a.average_heartrate), hrM: r1(a.max_heartrate),
      kcal: r1(a.calories), tss: r1(a.icu_training_load), int: r1(a.icu_intensity), trimp: r1(a.trimp), dplus: r1(a.total_elevation_gain), dminus: r1(a.total_elevation_loss),
      cad: r1(a.average_cadence, 1), w: r1(num(a.icu_average_watts) ?? num(a.average_watts)), np: r1(a.icu_weighted_avg_watts),
      temp: r1(num(a.average_weather_temp) ?? num(a.average_temp), 1), meteo: num(a.average_weather_temp) !== null, indoor: al(a), device: a.device_name || "",
      z: Array.isArray(a.icu_hr_zone_times) ? a.icu_hr_zone_times.slice(0, 5) : null, zl: Array.isArray(a.icu_hr_zones) ? a.icu_hr_zones.slice(0, 5) : null,
      rpe: r1(num(a.icu_rpe) ?? num(a.perceived_exertion)), feel: r1(a.feel), kg: r1(a.kg_lifted), vasche: r1(a.lengths), vasca: r1(a.pool_length),
      stride: r1(a.average_stride, 2), gct: r1(a.average_stance_time), vo: r1(a.average_vertical_oscillation, 1), hrr: a.icu_hrr && num(a.icu_hrr.hrr) !== null ? a.icu_hrr.hrr : null,
      comp: r1(a.compliance), ef: r1(a.icu_efficiency_factor, 2), dec: r1(a.decoupling, 1), giri: Array.isArray(a.interval_summary) ? a.interval_summary.slice(0, 12) : null,
      ctl: r1(a.icu_ctl), atl: r1(a.icu_atl), carbo: r1(a.carbs_ingested), gap: r1(a.gap, 3),
      piano: ev ? { nome: ev.name || "", min: Math.round((num(ev.moving_time) || 0) / 60), tss: r1(ev.icu_training_load) } : null,
      imp: (() => { try { return impFromAct(a).map((x) => Math.round(x * 100) / 100); } catch (e) { return null; } })(),
      gear: (() => { const g = gearPer(a, dia.gear); return g ? g.nome : null; })(),
    });
    const r = att[ds][att[ds].length - 1];
    for (const k of Object.keys(r)) if (r[k] === null || r[k] === undefined || r[k] === false || r[k] === "") delete r[k]; // la pagina resta leggera
    if (dettagli && dettagli[a.id] && !dettagli[a.id].slim && (soloGiorni || ds === apri || ds === oggiS)) det[a.id] = dettagli[a.id];
  }
  const W = {}; for (const w of raw.wellness || []) if (w && w.id) W[w.id] = w;
  for (const ds of Object.keys(att)) {
    const w = W[ds] || {}, cibo = (dia.cibo || {})[ds] || [], tc = cibo.length ? totaleCibo(cibo) : null;
    ctx[ds] = { sonno: num(w.sleepSecs), voto: num(w.sleepScore), hrv: num(w.hrv) ?? num(w.hrvSDNN), rhr: num(w.restingHR), peso: num((dia.pesi || {})[ds]) ?? num(w.weight),
      ctl: r1(num(w.ctl) ?? num(w.icu_ctl)), atl: r1(num(w.atl) ?? num(w.icu_atl)), kcal: tc ? Math.round(tc.kcal) : null, lungo: (dia.lunghi || {})[ds] || null };
  }
  const oggi = ymd(now);
  if (!ctx[oggi]) { const w = W[oggi] || {}; ctx[oggi] = { sonno: num(w.sleepSecs), voto: num(w.sleepScore), hrv: num(w.hrv) ?? num(w.hrvSDNN), rhr: num(w.restingHR), peso: num((dia.pesi || {})[oggi]) ?? num(w.weight), ctl: r1(num(w.ctl) ?? num(w.icu_ctl)), atl: r1(num(w.atl) ?? num(w.icu_atl)), kcal: null, lungo: null }; }
  const giorni = [...new Set([oggi, ...tutti])].sort().reverse();
  return { oggi, apri, giorni, att, ctx, det, sport: Object.fromEntries(Object.entries(SPORT).map(([k, v]) => [k, { c: v.c, label: v.label }])), lthr: CONFIG.corsa.lthr, app: CONFIG.nomeApp, gara: CONFIG.obiettivo && CONFIG.obiettivo.data ? { nome: CONFIG.obiettivo.nome, giorni: daysBetween(now, parseYMD(CONFIG.obiettivo.data)) } : null };
}

// ------------------------------------------------------------
//  Progressi: i segnali che la base aerobica cresce, disciplina per disciplina
//  Ultime 4 settimane contro le settimane 8–12 prima (la corsa usa il confronto della durabilità)
// ------------------------------------------------------------
function progressi(raw, now, dettagli, dur) {
  const acts = (raw.activities || []).filter((a) => a && a.start_date_local);
  const g = (a) => daysBetween(parseYMD(a.start_date_local), now), ds = (a) => a.start_date_local.slice(0, 10);
  const confronto = (pts) => { const ora = MED(pts.filter((p) => p.g <= 28).map((p) => p.v)), prima = MED(pts.filter((p) => p.g >= 56 && p.g <= 84).map((p) => p.v)); return { ora, prima, diff: ora !== null && prima !== null ? ora - prima : null }; };
  const lunghiBici = acts.filter((a) => sportOf(a.type) === "bici" && (num(a.moving_time) || 0) >= 4500 && g(a) <= 180 && g(a) >= 0);
  const bici = lunghiBici.map((a) => { const d = dettagli[a.id]; return d && d.deriva ? { d: ds(a), g: g(a), v: d.deriva.v, tipo: d.deriva.tipo, min: Math.round(a.moving_time / 60) } : null; }).filter(Boolean).sort((a, b) => a.d.localeCompare(b.d));
  const nuoto = acts.filter((a) => a.type === "Swim" && (num(a.distance) || 0) >= 800 && num(a.moving_time) && g(a) <= 180 && g(a) >= 0)
    .map((a) => ({ d: ds(a), g: g(a), v: Math.round(a.moving_time / (a.distance / 100)), m: Math.round(a.distance) })).sort((a, b) => a.d.localeCompare(b.d));
  const W = (raw.wellness || []).filter((w) => w && w.id && daysBetween(parseYMD(w.id), now) <= 111 && daysBetween(parseYMD(w.id), now) >= 0);
  const sett = [];
  for (let k = 15; k >= 0; k--) { const xs = W.filter((w) => Math.floor(daysBetween(parseYMD(w.id), now) / 7) === k); if (xs.length) sett.push({ g: k * 7, d: ymd(addDays(now, -k * 7)), rhr: MED(xs.map((w) => num(w.restingHR))), hrv: MED(xs.map((w) => num(w.hrv) ?? num(w.hrvSDNN))) }); }
  const cuore = (key) => { const pts = sett.map((x) => ({ d: x.d, g: x.g, v: x[key] })).filter((x) => x.v !== null); return { pts, ...confronto(pts) }; };
  return {
    corsa: dur,
    bici: { pts: bici, ...confronto(bici), mancano: lunghiBici.filter((a) => !dettagli[a.id]).length },
    nuoto: { pts: nuoto, ...confronto(nuoto), css: toSec(CONFIG.nuoto.css) },
    rhr: cuore("rhr"), hrv: cuore("hrv"),
  };
}

// ------------------------------------------------------------
//  Record personali: i tratti più veloci dentro le corse e le nuotate in piscina, più le sedute più lunghe
// ------------------------------------------------------------
const RECORD_DEF = [
  { k: "c1000", sp: "corsa", d: 1000, nome: "1 km" }, { k: "c5000", sp: "corsa", d: 5000, nome: "5 km" },
  { k: "c10000", sp: "corsa", d: 10000, nome: "10 km" }, { k: "c21097", sp: "corsa", d: 21097, nome: "Mezza maratona" },
  { k: "n100", sp: "nuoto", d: 100, nome: "100 m" }, { k: "n400", sp: "nuoto", d: 400, nome: "400 m" }, { k: "n1000", sp: "nuoto", d: 1000, nome: "1000 m" },
];
const secTempo = (t) => { const p = String(t || "").split(":").map(Number); if (!p.length || p.some((x) => !isFinite(x))) return null; return p.reduce((a, x) => a * 60 + x, 0) || null; };
function recordPersonali(raw, now, dettagli, dia) {
  const acts = new Map((raw.activities || []).filter((a) => a && a.start_date_local).map((a) => [String(a.id), a]));
  const base = CONFIG.record || {}, prima = (dia && dia.record) || null, lista = [], nuovi = [], mappa = {};
  for (const R of RECORD_DEF) {
    let best = null;
    for (const [id, d] of Object.entries(dettagli || {})) {
      const a = acts.get(String(id)), t = d && d.best && d.best[R.d];
      if (!a || !t || sportOf(a.type) !== R.sp) continue;
      if (!best || t < best.sec) best = { sec: t, d: a.start_date_local.slice(0, 10), id: a.id, att: a.name || "" };
    }
    const b0 = secTempo(base[R.k]), rec = best && (!b0 || best.sec < b0) ? best : b0 ? { sec: b0, d: null, id: null, att: "prima dell'app" } : best;
    if (!rec) continue;
    const vecchio = prima && prima[R.k] ? prima[R.k].sec : null, dal = prima && prima._al;
    // migliorato davvero solo da una seduta fatta dopo l'ultimo controllo (lo storico letto in sottofondo corregge in silenzio)
    const meglio = vecchio !== null && rec.sec < vecchio && rec.d && (!dal || rec.d >= dal) ? vecchio - rec.sec : null;
    const stesso = prima && prima[R.k] && prima[R.k].sec === rec.sec;
    const x = { ...R, ...rec, passo: R.sp === "corsa" ? rec.sec / (R.d / 1000) : rec.sec / (R.d / 100), meglio: meglio ?? (stesso ? prima[R.k].meglio ?? null : null), prec: meglio ? vecchio : (stesso ? prima[R.k].prec ?? null : null) };
    lista.push(x);
    mappa[R.k] = { sec: x.sec, d: x.d, id: x.id, meglio: x.meglio, prec: x.prec };
    // nuovo: migliorato da una seduta degli ultimi 3 giorni (alla prima apertura non si festeggia niente)
    if (prima && meglio && rec.d && daysBetween(parseYMD(rec.d), now) <= 3) nuovi.push(x);
  }
  const in180 = [...acts.values()].filter((a) => daysBetween(parseYMD(a.start_date_local), now) <= 180);
  const max = (xs, f) => xs.reduce((m, a) => (f(a) > (m ? f(m) : 0) ? a : m), null);
  const lungo = (sp, f, fmt, nome) => { const a = max(in180.filter((x) => sp(x)), f); return a && f(a) > 0 ? { nome, val: fmt(f(a)), d: a.start_date_local.slice(0, 10), id: a.id, att: a.name || "" } : null; };
  const lunghe = [
    lungo((a) => sportOf(a.type) === "corsa", (a) => num(a.distance) || 0, (m) => `${fmtIt(m / 1000, 1)} km`, "Corsa più lunga"),
    lungo((a) => sportOf(a.type) === "bici", (a) => num(a.moving_time) || 0, (s2) => fmtDur(s2), "Bici più lunga"),
    lungo((a) => sportOf(a.type) === "nuoto", (a) => num(a.distance) || 0, (m) => `${fmtIt(m)} m`, "Nuotata più lunga"),
    lungo((a) => sportOf(a.type) === "corsa", (a) => num(a.total_elevation_gain) || 0, (m) => `${fmtIt(m)} m D+`, "Più dislivello in corsa"),
  ].filter(Boolean);
  mappa._al = ymd(now);
  return { lista, lunghe, nuovi, mappa };
}

// ------------------------------------------------------------
//  Attrezzatura: scarpe e bici con i loro km. Le corse vanno alle scarpe attive per quel tipo
//  (strada, trail, tapis o tutto); le uscite in bici alla bici attiva. Oltre i 6 mesi i km restano nel conto (base).
// ------------------------------------------------------------
const tipoCorsa = (a) => (/trail/i.test(a.type || "") || /trail/i.test(a.name || "") ? "trail" : a.trainer === true || /virtual/i.test(a.type || "") || /tapis|treadmill/i.test(a.name || "") ? "tapis" : "strada");
function gearPer(a, gear) {
  const sp = sportOf(a.type), d = (a.start_date_local || "").slice(0, 10);
  if (sp !== "corsa" && sp !== "bici") return null;
  const ok = (g) => g.tipo === (sp === "corsa" ? "scarpe" : "bici") && (!g.dal || g.dal <= d) && (!g.ritirata || g.ritirata >= d) && (sp !== "corsa" || !g.per || g.per === "tutto" || g.per === tipoCorsa(a));
  const L = (gear || []).filter(ok);
  // la più specifica vince sul «tutto», poi la più recente
  return L.sort((x, y) => (x.per === "tutto") - (y.per === "tutto") || String(y.dal || "").localeCompare(String(x.dal || "")))[0] || null;
}
function attrezzatura(raw, now, dia) {
  const gear = (dia && Array.isArray(dia.gear) ? dia.gear : []).filter((g) => g && g.id);
  if (!gear.length) return [];
  const acc = new Map(gear.map((g) => [g.id, { km: 0, ore: 0, n: 0, ultima: null }]));
  for (const a of raw.activities || []) {
    if (!a || !a.start_date_local) continue;
    const g = gearPer(a, gear); if (!g) continue;
    if (g.base && g.base.fino && a.start_date_local.slice(0, 10) <= g.base.fino) continue; // già contata
    const x = acc.get(g.id); x.km += (num(a.distance) || 0) / 1000; x.ore += (num(a.moving_time) || 0) / 3600; x.n++;
    if (!x.ultima || a.start_date_local > x.ultima) x.ultima = a.start_date_local.slice(0, 10);
  }
  return gear.map((g) => { const x = acc.get(g.id), km = (num(g.kmIniziali) || 0) + ((g.base && g.base.km) || 0) + x.km, ore = ((g.base && g.base.ore) || 0) + x.ore, lim = num(g.limite) || 0;
    return { ...g, km: Math.round(km), ore: Math.round(ore * 10) / 10, n: x.n + ((g.base && g.base.n) || 0), ultima: x.ultima, pct: lim ? km / lim : null }; })
    .sort((a, b) => !!a.ritirata - !!b.ritirata || (a.tipo === b.tipo ? 0 : a.tipo === "scarpe" ? -1 : 1));
}
// Le attività che stanno per uscire dai 6 mesi passano nella base, così i km non si perdono
function consolidaGear(dia, raw, now) {
  if (!dia || !Array.isArray(dia.gear) || !dia.gear.length) return false;
  const lim = ymd(addDays(now, -170)); let cambiato = false;
  for (const g of dia.gear) {
    const fino = (g.base && g.base.fino) || "";
    if (fino >= lim) continue;
    const L = (raw.activities || []).filter((a) => a && a.start_date_local && a.start_date_local.slice(0, 10) > fino && a.start_date_local.slice(0, 10) <= lim && gearPer(a, dia.gear) === g);
    g.base = { fino: lim, km: Math.round((((g.base && g.base.km) || 0) + L.reduce((t, a) => t + (num(a.distance) || 0) / 1000, 0)) * 10) / 10, ore: Math.round((((g.base && g.base.ore) || 0) + L.reduce((t, a) => t + (num(a.moving_time) || 0) / 3600, 0)) * 10) / 10, n: ((g.base && g.base.n) || 0) + L.length };
    cambiato = true;
  }
  return cambiato;
}
// Quello che arriva dalla pagina: solo campi noti, valori puliti
function pulisciGear(list) {
  const out = [];
  for (const g of Array.isArray(list) ? list.slice(0, 30) : []) {
    if (!g || !g.nome) continue;
    const d = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
    out.push({ id: String(g.id || "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(0, 24), tipo: g.tipo === "bici" ? "bici" : "scarpe", nome: String(g.nome).slice(0, 40),
      dal: d(g.dal), per: ["strada", "trail", "tapis", "tutto"].includes(g.per) ? g.per : "tutto", kmIniziali: Math.max(0, Math.min(20000, Number(g.kmIniziali) || 0)),
      limite: Math.max(0, Math.min(50000, Number(g.limite) || 0)), ritirata: d(g.ritirata), ...(g.base && !g.reset && d(g.base.fino) ? { base: { fino: d(g.base.fino), km: Math.max(0, Number(g.base.km) || 0), ore: Math.max(0, Number(g.base.ore) || 0), n: Math.max(0, Math.round(Number(g.base.n) || 0)) } } : {}) });
  }
  return out;
}

// ------------------------------------------------------------
//  La settimana in numeri (k = 0 questa, 1 la scorsa): per l'immagine della domenica
// ------------------------------------------------------------
function riassuntoSettimana(raw, now, k) {
  const lun = addDays(mondayOf(now), -7 * k), dom = addDays(lun, 6), da = ymd(lun), a = ymd(dom);
  const per = { corsa: { sec: 0, m: 0 }, bici: { sec: 0, m: 0 }, nuoto: { sec: 0, m: 0 }, forza: { sec: 0, m: 0 }, altro: { sec: 0, m: 0 } };
  const giorni = Array(7).fill(0); let tss = 0, n = 0, sec = 0;
  for (const x of raw.activities || []) {
    if (!x || !x.start_date_local) continue;
    const d = x.start_date_local.slice(0, 10); if (d < da || d > a) continue;
    const sp = sportOf(x.type), t = num(x.moving_time) || 0;
    if ((sp === "altro" || x.type === "Workout") && (num(x.icu_training_load) || 0) < 5) continue; // respirazione e mobilità leggera non fanno volume
    per[sp].sec += t; per[sp].m += num(x.distance) || 0; tss += num(x.icu_training_load) || 0; n++; sec += t;
    giorni[Math.max(0, Math.min(6, daysBetween(lun, parseYMD(d))))] += Math.round(t / 60);
  }
  const W = (raw.wellness || []).filter((w) => w && w.id >= da && w.id <= a);
  return { k, da, a, n, sec, tss: Math.round(tss), per, giorni, sonno: MED(W.map((w) => num(w.sleepSecs))), iso: isoWeek(lun), ctl: num((W[W.length - 1] || {}).ctl) };
}

function demoData(now) {
  // 365 giorni di carico simulato con CTL/ATL calcolati come Intervals
  const wellness = [];
  let ctl = 38, atl = 40;
  for (let i = 365; i >= 0; i--) {
    const d = addDays(now, -i);
    const k = 365 - i;
    const base = 45 + 20 * Math.sin(k / 40) + (k > 300 ? 15 : 0);
    let load = d.getDay() === 0 ? base * 1.9 : d.getDay() === 3 ? 0 : base * (0.7 + ((k * 37) % 10) / 20);
    if (i <= 14 && i >= 11) load = i === 11 ? 210 : 0; // Camogli + stop
    ctl += (load - ctl) / 42; atl += (load - atl) / 7;
    const r = (k * 13) % 7;
    wellness.push({
      id: ymd(d), ctl, atl, rampRate: 1.2,
      hrv: 80 + r * 1.5 - (i === 10 ? 18 : 0), restingHR: 43 - (r % 3) + (i === 10 ? 4 : 0),
      sleepSecs: 6.6 * 3600 + r * 900, sleepScore: 74 + r * 3, avgSleepingHR: 47 - (r % 3),
      respiration: 13.4 + (r % 3) * 0.3, spO2: 95 + (r % 3), readiness: 70 + r * 3,
      weight: 74.6 - k * 0.002,
    });
  }
  const t = wellness[wellness.length - 1];
  Object.assign(t, { hrv: 89, restingHR: 41, sleepSecs: 7.7 * 3600, sleepScore: 92, sleepQuality: 2, avgSleepingHR: 45, respiration: 13.2, spO2: 96, readiness: 84 });

  const mon = mondayOf(now);
  const S = (duration, extra = {}) => ({ duration, ...extra });
  const docs = {
    css: { steps: [
      S(0, { distance: 400, warmup: true, text: "Riscaldamento misto", pace: { units: "%pace", value: 80 } }),
      S(120, { text: "Recupero", intensity: "rest" }),
      S(0, { distance: 400, text: "400 a tutta", pace: { units: "%pace", value: 112 } }),
      S(300, { text: "Recupero", intensity: "rest" }),
      S(0, { distance: 200, text: "200 a tutta", pace: { units: "%pace", value: 116 } }),
      S(0, { distance: 200, cooldown: true, text: "Defaticamento", pace: { units: "%pace", value: 75 } }),
    ] },
    soglia: { steps: [
      S(900, { warmup: true, hr: { units: "hr_zone", value: 2 } }),
      { reps: 6, steps: [S(300, { pace: { units: "%pace", start: 98, end: 102 } }), S(60, { intensity: "recovery", pace: { units: "%pace", value: 70 } })] },
      S(600, { cooldown: true, hr: { units: "hr_zone", value: 2 } }),
    ] },
    z2: { steps: [S(2700, { hr: { units: "hr_zone", value: 2 } })] },
    biciZ2: { steps: [S(600, { warmup: true, power: { units: "%ftp", value: 55 } }), S(3600, { power: { units: "%ftp", start: 65, end: 72 } }), S(600, { cooldown: true, power: { units: "%ftp", value: 50 } })] },
    vo2: { steps: [
      S(900, { warmup: true, hr: { units: "hr_zone", value: 2 } }),
      { reps: 10, steps: [S(30, { pace: { units: "%pace", value: 112 } }), S(30, { intensity: "recovery", pace: { units: "%pace", value: 65 } })] },
      S(600, { cooldown: true, hr: { units: "hr_zone", value: 2 } }),
    ] },
    lungo: { steps: [S(3000, { hr: { units: "hr_zone", value: 2 }, text: "Costante, gel non necessario" })] },
    nuoto: { steps: [
      S(0, { distance: 600, warmup: true, pace: { units: "%pace", value: 80 } }),
      { reps: 8, steps: [S(0, { distance: 200, pace: { units: "%pace", value: 97 } }), S(20, { intensity: "rest", text: "Recupero" })] },
      S(0, { distance: 400, cooldown: true, pace: { units: "%pace", value: 75 } }),
    ] },
  };
  const ev = (d, type, name, min, load, doc, extra = {}) => ({ category: "WORKOUT", start_date_local: ymd(addDays(mon, d)) + "T00:00:00", type, name, moving_time: min * 60, icu_training_load: load, workout_doc: doc, ...extra });
  const events = [
    ev(0, "Swim", "Nuoto · Test CSS 400+200", 45, 40, docs.css, { distance: 1400 }),
    ev(1, "Run", "Corsa · Rientro Z2 30'", 30, 25, { steps: [S(1800, { hr: { units: "hr_zone", value: 2 } })] }),
    ev(2, "Swim", "Nuoto · Ritmo 2.600", 55, 45, docs.nuoto, { distance: 2600 }),
    ev(3, "Run", "Corsa · Soglia 6×5'", 61, 70, docs.soglia),
    ev(3, "VirtualRide", "Bici · Z2 1h20", 80, 60, docs.biciZ2),
    ev(4, "Swim", "Nuoto · Tecnica 2.400", 50, 40, null, { description: "400 risc. misto\n8×50 drill (pull, catch-up) 20\" rec\n6×100 a CSS +5\" 30\" rec\n200 def." }),
    ev(5, "VirtualRide", "Bici · Lungo 2h", 120, 95, docs.biciZ2),
    ev(6, "Run", "Corsa · Lungo 50'", 50, 45, docs.lungo),
    ev(7, "Swim", "Nuoto · Lungo 3.500", 80, 60, docs.nuoto, { distance: 3500 }),
    ev(8, "Run", "Corsa · Soglia 6×5'", 61, 70, docs.soglia),
    ev(9, "Run", "Corsa · VO2 10×30/30", 45, 55, docs.vo2),
    ev(10, "VirtualRide", "Bici · Z2 1h30", 90, 65, docs.biciZ2),
    ev(11, "Swim", "Nuoto · Ritmo 3.000", 65, 50, docs.nuoto, { distance: 3000 }),
    ev(12, "VirtualRide", "Bici · Lungo 2h15", 135, 100, docs.biciZ2),
    ev(13, "Run", "Corsa · Lungo 1h05", 65, 60, docs.lungo),
  ];
  const act = (d, type, min, load, extra = {}) => ({ start_date_local: ymd(addDays(mon, d)) + "T07:00:00", type, moving_time: min * 60, icu_training_load: load, ...extra });
  const activities = [];
  const todayIdx = daysBetween(mon, now);
  const doneList = [act(0, "Swim", 44, 42, { distance: 1400 }), act(1, "Run", 31, 26, { distance: 5200 }), act(2, "Swim", 57, 47, { distance: 2600 })];
  for (const a of doneList) if (daysBetween(mon, parseYMD(a.start_date_local)) < todayIdx) activities.push(a);
  // storico demo di 180 giorni: corse con FC e velocità, tapis in estate, nuoto e bici
  for (let i = 180; i >= 1; i--) {
    const d = addDays(now, -i); if (d >= mon) continue;
    const wd = d.getDay(), k = 180 - i;
    const iso = ymd(d) + "T07:00:00";
    const summerTm = i <= 85 && i >= 30;
    const p145 = i > 150 ? 330 : i > 30 ? 330 + (150 - i) * 0.35 : 372 - (30 - i) * 0.6; // peggiora d'estate, recupera
    const hr = 140 + ((k * 7) % 9);
    const run = (name, min, extra = {}) => {
      const pace = p145 * 145 / hr * (1 + (((k * 13) % 7) - 3) / 150);
      activities.push({ start_date_local: iso, type: summerTm && !/soglia|vo2/i.test(name) ? "VirtualRun" : "Run", name, moving_time: min * 60,
        distance: min * 60 / pace * 1000, average_speed: 1000 / pace, average_heartrate: hr, max_heartrate: hr + 18,
        total_elevation_gain: summerTm ? 0 : 40 + (k % 5) * 30, icu_training_load: min * 0.9, trainer: summerTm && !/soglia|vo2/i.test(name), ...extra });
    };
    if (wd === 2) run("Corsa facile", 40);
    if (wd === 4) run(k % 2 ? "Soglia 6×5'" : "VO2 5×3'", 60, { average_heartrate: 158, max_heartrate: i <= 40 && i > 20 ? 165 : 178, icu_intensity: 88 });
    if (wd === 0) run("Corsa lungo", 70 + (k % 4) * 10, { decoupling: 3 + ((k * 3) % 50) / 10 });
    if (wd === 1 || wd === 3 || wd === 5) activities.push({ start_date_local: ymd(d) + "T06:30:00", type: "Swim", name: "Nuoto", moving_time: 3300, distance: 2800, icu_training_load: 45 });
    if (wd === 6) activities.push({ start_date_local: ymd(d) + "T09:00:00", type: "VirtualRide", name: "Bici Z2", moving_time: 6000, icu_training_load: 80 });
  }
  // diario demo: check-in degli ultimi 40 giorni
  const checkins = {};
  for (let i = 40; i >= 1; i--) { const k = (i * 7) % 5; checkins[ymd(addDays(now, -i))] = { g: 2 + (k % 4), e: 2 + ((k + 1) % 4), u: 3 + (k % 3) }; }
  return { wellness, events, activities, fetchedAt: now.toISOString(), demo: true, diary: { checkins, adapt: {} } };
}

// ------------------------------------------------------------
//  Struttura delle sedute (workout_doc di Intervals)
// ------------------------------------------------------------
function thresholdPace(sport) {
  if (sport === "corsa") return { sec: toSec(CONFIG.corsa.passoSoglia), unit: "/km", per: 1000 };
  if (sport === "nuoto") return { sec: toSec(CONFIG.nuoto.css), unit: "/100", per: 100 };
  return null;
}

function rng(t) {
  if (!t || typeof t !== "object") return null;
  const a = num(t.start) ?? num(t.value), b = num(t.end) ?? num(t.value);
  if (a === null) return null;
  return [Math.min(a, b ?? a), Math.max(a, b ?? a)];
}

function describeTarget(step, sport) {
  const out = []; let pct = null;
  const tp = thresholdPace(sport);

  // Passo
  const rp = rng(step._pace);
  const p = step.pace; const pr = rng(p);
  if (rp && tp) {
    // valori risolti da Intervals in m/s
    const toPace = (v) => (v > 0 && v < 30 ? tp.per / v : v);
    const s1 = toPace(rp[1]), s2 = toPace(rp[0]);
    out.push({ k: "pace", t: s1 === s2 || Math.abs(s1 - s2) < 2 ? `${fmtPace(s1)}${tp.unit}` : `${fmtPace(s1)}–${fmtPace(s2)}${tp.unit}` });
    pct = (tp.sec / ((s1 + s2) / 2)) * 100;
  } else if (p && pr) {
    const u = String(p.units || "").toLowerCase();
    if (u.includes("%") && tp) {
      const fast = tp.sec * 100 / pr[1], slow = tp.sec * 100 / pr[0];
      out.push({ k: "pace", t: Math.abs(fast - slow) < 2 ? `${fmtPace(fast)}${tp.unit}` : `${fmtPace(fast)}–${fmtPace(slow)}${tp.unit}` });
      pct = (pr[0] + pr[1]) / 2;
    } else if (u.includes("zone")) {
      out.push({ k: "pace", t: `Z${pr[0]}${pr[1] !== pr[0] ? "–" + pr[1] : ""} passo` });
      pct = [0, 55, 68, 84, 97, 106, 115][Math.round(pr[1])] || 80;
    }
  }

  // Frequenza cardiaca
  const rh = rng(step._hr);
  const h = step.hr; const hr = rng(h);
  const lthr = sport === "bici" ? CONFIG.bici.sogliaFC : CONFIG.corsa.lthr;
  if (rh && rh[0] > 60) {
    out.push({ k: "hr", t: `${Math.round(rh[0])}–${Math.round(rh[1])} bpm` });
    if (pct === null) pct = ((rh[0] + rh[1]) / 2 / lthr) * 100;
  } else if (h && hr) {
    const u = String(h.units || "").toLowerCase();
    if (u.includes("lthr")) { out.push({ k: "hr", t: `${Math.round(lthr * hr[0] / 100)}–${Math.round(lthr * hr[1] / 100)} bpm` }); if (pct === null) pct = (hr[0] + hr[1]) / 2; }
    else if (u.includes("%")) { const mx = CONFIG.corsa.fcMax; out.push({ k: "hr", t: `${Math.round(mx * hr[0] / 100)}–${Math.round(mx * hr[1] / 100)} bpm` }); if (pct === null) pct = ((hr[0] + hr[1]) / 2) * mx / lthr; }
    else if (u.includes("zone")) {
      const z = Math.round(hr[0]); const zz = CONFIG.corsa.zoneFC[z];
      out.push({ k: "hr", t: zz && sport !== "bici" ? `Z${z} · ${zz[0]}–${zz[1]} bpm` : `Z${z} FC` });
      if (pct === null) pct = [0, 55, 68, 84, 97, 106, 115][z] || 80;
    }
  }

  // Potenza
  const rw = rng(step._power);
  const w = step.power; const wr = rng(w);
  if (rw && rw[0] > 30) { out.push({ k: "power", t: rw[0] === rw[1] ? `${Math.round(rw[0])} W` : `${Math.round(rw[0])}–${Math.round(rw[1])} W` }); }
  if (w && wr) {
    const u = String(w.units || "").toLowerCase();
    if (!(rw && rw[0] > 30)) {
      if (u.includes("ftp")) out.push({ k: "power", t: CONFIG.bici.ftp ? `${Math.round(CONFIG.bici.ftp * wr[0] / 100)}–${Math.round(CONFIG.bici.ftp * wr[1] / 100)} W` : `${wr[0] === wr[1] ? wr[0] : wr[0] + "–" + wr[1]}% FTP` });
      else if (u.includes("zone")) out.push({ k: "power", t: `Z${wr[0]} potenza` });
      else out.push({ k: "power", t: `${wr[0]}–${wr[1]} W` });
    }
    if (pct === null) pct = u.includes("zone") ? [0, 55, 70, 85, 100, 115, 130][Math.round(wr[0])] : (wr[0] + wr[1]) / 2;
  }
  return { targets: out, pct };
}

function stepLabel(step) {
  const it = String(step.intensity || "").toLowerCase();
  if (step.warmup || it === "warmup") return "Riscaldamento";
  if (step.cooldown || it === "cooldown") return "Defaticamento";
  if (it === "rest") return "Recupero";
  if (it === "recovery") return "Recupero";
  return null;
}

function stepSeconds(step, sport, pct) {
  if (num(step.duration)) return step.duration;
  if (num(step.distance)) {
    const tp = thresholdPace(sport);
    if (tp) return (step.distance / tp.per) * tp.sec * 100 / (pct || 85);
    return step.distance / 8;
  }
  return 60;
}

// Restituisce righe leggibili + segmenti per il profilo grafico
function parseWorkout(e) {
  const sport = sportOf(e.type);
  const doc = e.workout_doc;
  if (!doc || !Array.isArray(doc.steps) || !doc.steps.length) {
    const lines = rimuoviAvvisi(String(e.description || "")).split("\n").map((l) => l.trim()).filter((l) => l && !/^(indoor|outdoor|pool length)/i.test(l));
    return { rows: lines.map((l) => ({ text: l.replace(/^-\s*/, "") , plain: true })), segs: [] };
  }
  const rows = []; const segs = [];
  let avvisi = 0;
  const one = (st, indent) => {
    const { targets, pct } = describeTarget(st, sport);
    // gli avvisi di rifornimento ("Mangia…", "Bevi") servono all'orologio: qui non si mostrano
    const proprio = String(st.text || "").replace(AVVISO_RE, "").trim();
    if (AVVISO_RE.test(st.text || "")) avvisi++;
    const lbl = proprio || stepLabel(st);
    const isRest = /recuper|rest|riposo/i.test(lbl || "") || String(st.intensity || "").match(/rest|recovery/i);
    const len = num(st.distance) && !num(st.duration) ? fmtDist(st.distance, sport) : num(st.duration) ? fmtStepDur(st.duration) : "";
    const p = pct ?? (isRest ? 40 : st.warmup || st.cooldown ? 62 : 75);
    const prev = rows[rows.length - 1];
    // un passo spezzato dagli avvisi torna uno solo
    if (!indent && !proprio && AVVISO_RE.test(st.text || "") && prev && !prev.header && !prev.indent && prev.sec && num(st.duration) && JSON.stringify(prev.targets) === JSON.stringify(targets)) {
      prev.sec += st.duration; prev.len = fmtStepDur(prev.sec);
    } else rows.push({ len, label: lbl, targets, indent, rest: !!isRest, pct: p, sec: num(st.duration) });
    return { sec: stepSeconds(st, sport, p), pct: isRest ? 35 : p };
  };
  for (const st of doc.steps) {
    if (num(st.reps) && Array.isArray(st.steps)) {
      rows.push({ header: `${st.reps}×`, label: st.text || null });
      const inner = st.steps.map((s) => one(s, 1));
      for (let r = 0; r < Math.min(st.reps, 40); r++) segs.push(...inner);
    } else segs.push(one(st, 0));
  }
  return { rows, segs, avvisi };
}

// ------------------------------------------------------------
//  L'impronta: ogni seduta è una fila di capsule, larga quanto il tempo
//  e alta quanto l'intensità. Contorno = piano, pieno = quello che hai fatto.
//  Arancio solo sopra soglia.
// ------------------------------------------------------------
const IMP_N = 34, IMP_TH = 0.8, IMP_ACC = "#FF6A1A";
const impLv = (pct) => Math.max(0.12, Math.min(1, ((pct || 60) - 30) / 80));
function impSample(segs, n) {
  const tot = segs.reduce((t, s) => t + s.sec, 0) || 1;
  const out = []; let k = 0, acc = segs[0] ? segs[0].sec : 0;
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * tot;
    while (k < segs.length - 1 && x > acc) { k++; acc += segs[k].sec; }
    out.push(segs[k] ? segs[k].l : 0.3);
  }
  return out;
}
function impPlan(e, n = IMP_N) {
  const segs = (e.parsed && e.parsed.segs) || [];
  if (segs.length) return impSample(segs.map((s) => ({ sec: Math.max(1, s.sec), l: impLv(s.pct) })), n);
  const base = e.sport === "forza" ? 0.35 : 0.45;
  return Array.from({ length: n }, (_, i) => (i < 2 || i >= n - 2 ? 0.3 : base));
}
// Attività senza piano: zone di FC in ordine, dal facile al duro
function impFromAct(a, n = IMP_N) {
  const sg = actSegs(a);
  if (sg && sg.length) return impSample(sg, n);
  const ZL = [0.2, 0.35, 0.5, 0.66, 0.84, 0.95, 1];
  const z = a && Array.isArray(a.icu_hr_zone_times) ? a.icu_hr_zone_times.map((s) => num(s) || 0) : null;
  if (z && z.some((s) => s > 0)) return impSample(z.map((s, k) => ({ sec: s, l: ZL[Math.min(k, 6)] })).filter((s) => s.sec > 0), n);
  const sp = sportOf(a && a.type);
  return Array.from({ length: n }, (_, i) => (i < 2 || i >= n - 2 ? 0.3 : sp === "forza" ? 0.35 : 0.45));
}
// ---- Quello che hai fatto davvero: dai giri registrati (interval_summary di Intervals)
// Ogni voce è "Nx durata misura", es. "6x 5m 175bpm", "1x 400m 1:49", "2x 20m 250w".
const mmss = (t) => { const p = String(t).split(":").map(Number); return p.length === 2 && p.every((x) => isFinite(x)) ? p[0] * 60 + p[1] : null; };
function hrPct(r) { return r < 0.85 ? 55 + ((r - 0.7) / 0.15) * 20 : r < 1 ? 75 + ((r - 0.85) / 0.15) * 25 : 100 + (r - 1) * 200; }
function actSegs(a) {
  const L = a && Array.isArray(a.interval_summary) ? a.interval_summary : null;
  if (!L || !L.length) return null;
  const sp = sportOf(a.type);
  const tps = num(a.threshold_pace); // m/s
  const thrSec = sp === "nuoto" ? (tps ? 100 / tps : mmss(CONFIG.nuoto.css)) : sp === "corsa" ? (tps ? 1000 / tps : mmss(CONFIG.corsa.passoSoglia)) : null;
  const lthr = num(a.lthr) || (sp === "bici" ? CONFIG.bici.sogliaFC : CONFIG.corsa.lthr);
  const ftp = num(a.icu_ftp) || CONFIG.bici.ftp;
  const groups = [];
  for (const s of L) {
    const m = String(s).trim().match(/^(\d+)x\s+(\S+)\s+(\S+)$/);
    if (!m) continue;
    const reps = +m[1], size = m[2], met = m[3];
    let pace = null, pct = null;
    if (/bpm$/.test(met)) pct = lthr ? hrPct(parseFloat(met) / lthr) : null;
    else if (/w$/i.test(met)) pct = ftp ? (parseFloat(met) / ftp) * 100 : null;
    else if (/^\d+:\d\d/.test(met)) { pace = mmss(met.replace(/\/.*/, "")); pct = thrSec && pace ? (thrSec / pace) * 100 : null; }
    let sec = null;
    const t = size.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (/^\d+(\.\d+)?km$/.test(size)) { const meters = parseFloat(size) * 1000; sec = pace ? (meters / (sp === "nuoto" ? 100 : 1000)) * pace : null; }
    else if (/^\d+m$/.test(size) && (sp === "nuoto" || +size.slice(0, -1) >= 100)) { const meters = +size.slice(0, -1); sec = pace ? (meters / (sp === "nuoto" ? 100 : 1000)) * pace : meters / 1.2; }
    else if (/^\d+m$/.test(size)) sec = +size.slice(0, -1) * 60;
    else if (t) sec = (+(t[1] || 0)) * 3600 + (+(t[2] || 0)) * 60 + (+(t[3] || 0));
    if (!sec || sec < 1) continue;
    groups.push({ reps, sec, pct: pct === null ? 60 : Math.max(30, Math.min(130, pct)) });
  }
  if (!groups.length) return null;
  // I giri uguali sono raggruppati: due gruppi consecutivi con lo stesso numero di ripetute si alternano (lavoro, recupero)
  const segs = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i], h = groups[i + 1];
    if (h && g.reps > 1 && h.reps === g.reps) { for (let r = 0; r < g.reps; r++) segs.push({ sec: g.sec, l: impLv(g.pct) }, { sec: h.sec, l: impLv(h.pct) }); i++; }
    else for (let r = 0; r < Math.min(g.reps, 60); r++) segs.push({ sec: g.sec, l: impLv(g.pct) });
  }
  return segs.filter((s) => s.sec >= 5);
}
// Il pieno: dai giri registrati quando ci sono, altrimenti stimato da durata e carico rispetto al piano
function impronta(e, n = IMP_N) {
  const plan = impPlan(e, n);
  if (!e.done) return { plan, done: null, pct: null };
  const a = e.done, pSec = Math.max(60, (e.min || 0) * 60);
  const aSec = num(a.moving_time) || num(a.elapsed_time) || pSec;
  const frac = Math.max(0.15, Math.min(1, aSec / pSec));
  const k = Math.max(1, Math.round(frac * n));
  const segs = actSegs(a);
  let done, real = false;
  if (segs && segs.length) { const lv = impSample(segs, k); done = plan.map((_, i) => (i < k ? lv[i] : 0)); real = true; }
  else {
    const lA = num(a.icu_training_load) ?? num(a.training_load), lP = e.load;
    const s = lA && lP ? Math.max(0.7, Math.min(1.15, lA / lP / frac)) : 1;
    done = plan.map((l, i) => (i < k ? Math.min(1, l * s) : 0));
  }
  return { plan, done, pct: e.exec ? e.exec.score : Math.round(frac * 100), real };
}
// Seduta adattata: il contorno si abbassa e si accorcia
function impAdapt(plan, item) {
  const keep = Math.round(plan.length * (item && item.quality ? 0.72 : 0.8));
  return plan.map((l, i) => (i < keep ? Math.min(l, item && item.quality ? 0.45 : 0.6) : 0));
}
// Impronta per la pagina: colonne flessibili (si adattano a qualsiasi larghezza), colori dal CSS
function impSVG(I, h = 56) {
  const cols = I.plan.map((p, i) => {
    const d = I.done ? I.done[i] : 0;
    return `<i>${p > 0 ? `<b class="ip" style="height:${(Math.max(0.1, p) * 100).toFixed(0)}%"></b>` : ""}${d > 0 ? `<b class="${d >= IMP_TH ? "ia" : "if"}" style="height:${(Math.max(0.1, d) * 100).toFixed(0)}%"></b>` : ""}</i>`;
  }).join("");
  return `<div class="imp" style="height:${h}px" aria-hidden="true">${cols}</div>`;
}

// ------------------------------------------------------------
//  Verifica automatica del profilo (stesso blocco di 04_Generatore/verifiche.js)
// ------------------------------------------------------------
// >>> VERIFICHE
function verificaProfilo(raw, cfg, now) {
  const V_N = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  const V_MS = (t) => { const p = String(t || "").split(":").map(Number); return p.length === 2 && p.every((x) => isFinite(x)) ? p[0] * 60 + p[1] : null; };
  const V_PACE = (s) => { s = Math.round(s); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const V_SP = (t) => { t = String(t || "").toLowerCase(); return t.includes("swim") ? "nuoto" : t.includes("run") ? "corsa" : t.includes("ride") || t.includes("bike") || t.includes("cycl") ? "bici" : "altro"; };
  const V_DAY = 86400000, V_YMD = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const V_MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const V_DATA = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return d + " " + V_MESI[m - 1]; };
  const giorniFa = (a) => (now - new Date(String(a.start_date_local).slice(0, 10) + "T12:00:00")) / V_DAY;
  const acts = (raw.activities || []).filter((a) => a && a.start_date_local && giorniFa(a) >= -0.5);
  const recenti = (gg, sp) => acts.filter((a) => giorniFa(a) <= gg && (!sp || V_SP(a.type) === sp));
  const out = [];
  const C = cfg || {}, CC = C.corsa || {}, CN = C.nuoto || {}, CB = C.bici || {};
  const SPORT_SCELTI = Array.isArray(C.sport) && C.sport.length ? C.sport : ["nuoto", "bici", "corsa"]; // dagli sport della configurazione

  // Giri registrati: "Nx misura valore" → { reps, m (metri) | sec, passo (s), bpm, w }
  const giri = (a) => (Array.isArray(a.interval_summary) ? a.interval_summary : []).map((s) => {
    const m = String(s).trim().match(/^(\d+)x\s+(\S+)\s+(\S+)$/); if (!m) return null;
    const g = { reps: +m[1] }, size = m[2], met = m[3], sp = V_SP(a.type);
    if (/bpm$/.test(met)) g.bpm = parseFloat(met); else if (/w$/i.test(met)) g.w = parseFloat(met); else if (/^\d+:\d\d/.test(met)) g.passo = V_MS(met.replace(/\/.*/, ""));
    const t = size.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (/^\d+(\.\d+)?km$/.test(size)) g.m = parseFloat(size) * 1000;
    else if (/^\d+m$/.test(size) && (sp === "nuoto" || +size.slice(0, -1) >= 100)) g.m = +size.slice(0, -1);
    else if (t && size) g.sec = (+(t[1] || 0)) * 3600 + (+(t[2] || 0)) * 60 + (+(t[3] || 0));
    if (g.m && g.passo && !g.sec) g.sec = (g.m / (sp === "nuoto" ? 100 : 1000)) * g.passo;
    return g;
  }).filter(Boolean);

  // 1. Soglia di nuoto (CSS): ripetute lunghe nuotate nettamente più veloci della soglia
  const cssApp = V_MS(CN.css);
  const nuoti = recenti(42, "nuoto");
  if (nuoti.length) {
    const tpI = nuoti.map((a) => V_N(a.threshold_pace)).find(Boolean);
    const css = tpI ? 100 / tpI : cssApp;
    const prove = [];
    for (const a of nuoti) for (const g of giri(a)) if (g.m >= 200 && g.passo && g.passo >= 50) {
      const marg = g.m >= 300 ? 0.96 : 0.94; // un 400 si nuota ~2–3" sotto il CSS, un 200 qualcosa in più
      if (g.passo < css * marg) prove.push({ m: g.m, passo: g.passo, data: String(a.start_date_local).slice(0, 10) });
    }
    const lunghe = prove.filter((p) => p.m >= 300);
    // Un test CSS (400 + 200) fatto di recente dà il valore esatto: CSS = 200 m / (tempo 400 − tempo 200)
    let test = null;
    for (const a of nuoti) {
      const G = giri(a), piu = (m) => G.filter((x) => x.m === m && x.passo).sort((x, y) => x.passo - y.passo)[0], r4 = piu(400), r2 = piu(200); // i più veloci: il riscaldamento può avere un 400
      const ev = a.paired_event_id ? (raw.events || []).find((e) => e && e.id === a.paired_event_id) : null; // l'attività prende spesso un nome generico ("Piscina")
      if (/css|test/i.test((a.name || "") + " " + ((ev && ev.name) || "")) && r4 && r2 && (!test || a.start_date_local > test.data)) {
        const t4 = 4 * r4.passo, t2 = 2 * r2.passo; // secondi totali del 400 e del 200
        if (t4 > t2) test = { css: Math.round((t4 - t2) / 2), data: String(a.start_date_local).slice(0, 10) }; // secondi per 100 m
      }
    }
    if (test && css && Math.abs(test.css - css) / css > 0.02) {
      out.push({ k: "css", liv: "aggiorna", titolo: "Nuova soglia di nuoto dal test",
        testo: `Il test CSS del ${V_DATA(test.data)} dà ${V_PACE(test.css)}/100 m. La soglia impostata è ancora ${V_PACE(css)}/100 m.`,
        azione: `Imposta ${V_PACE(test.css)}/100 m in Intervals (soglia di passo del nuoto) e nell'app (CSS).`, valore: V_PACE(test.css) });
    } else if (!test && css && (lunghe.length >= 1 || prove.length >= 2)) {
      const best = (lunghe.length ? lunghe : prove).slice().sort((x, y) => x.passo - y.passo)[0];
      const stima = Math.round((lunghe.length ? Math.min(...lunghe.map((p) => p.passo)) : best.passo) + 3);
      out.push({ k: "css", liv: "aggiorna", titolo: "Soglia di nuoto da aggiornare",
        testo: `La soglia è ${V_PACE(css)}/100 m, ma hai nuotato ${best.m} m a ${V_PACE(best.passo)}/100 m (${V_DATA(best.data)}). Con una soglia vecchia ogni nuotata sembra sopra soglia.`,
        azione: `Fai il test CSS (400 + 200) e aggiorna la soglia in Intervals e nell'app. Stima dai tuoi giri: circa ${V_PACE(stima)}/100 m.`, valore: V_PACE(stima) });
    }
    if (tpI && cssApp && Math.abs(100 / tpI - cssApp) / cssApp > 0.03)
      out.push({ k: "css-diverso", liv: "controlla", titolo: "Soglia di nuoto diversa da Intervals", testo: `Intervals usa ${V_PACE(100 / tpI)}/100 m, l'app ${CN.css}/100 m.`, azione: "Metti lo stesso valore in tutti e due." });
  }

  // 2. Soglia FC di corsa (LTHR): almeno 20 minuti tenuti sopra la soglia
  const corse = recenti(56, "corsa");
  const lthrI = corse.map((a) => V_N(a.lthr)).find(Boolean), lthr = lthrI || V_N(CC.lthr);
  if (lthr && corse.length) {
    let top = null;
    for (const a of corse) {
      for (const g of giri(a)) if (g.bpm && g.sec && g.reps * g.sec >= 1200 && g.bpm >= lthr + 3 && (!top || g.bpm > top.bpm)) top = { bpm: g.bpm, min: Math.round((g.reps * g.sec) / 60), data: String(a.start_date_local).slice(0, 10) };
      const t = V_N(a.moving_time), hr = V_N(a.average_heartrate);
      if (t >= 1200 && t <= 4200 && hr >= lthr + 3 && (!top || hr > top.bpm)) top = { bpm: hr, min: Math.round(t / 60), data: String(a.start_date_local).slice(0, 10) };
    }
    if (top) {
      const stima = Math.round(top.bpm * (top.min <= 30 ? 0.97 : 0.99));
      if (stima > lthr + 1) out.push({ k: "lthr", liv: "aggiorna", titolo: "Soglia FC di corsa probabilmente bassa",
        testo: `La soglia è ${lthr} bpm, ma hai tenuto ${Math.round(top.bpm)} bpm per ${top.min} minuti (${V_DATA(top.data)}). Le zone risultano più dure di quanto sono.`,
        azione: `Fai un test di 30 minuti o aggiorna la soglia: stima circa ${stima} bpm.`, valore: stima });
    }
    if (lthrI && V_N(CC.lthr) && Math.abs(lthrI - CC.lthr) >= 3)
      out.push({ k: "lthr-diverso", liv: "controlla", titolo: "Soglia FC di corsa diversa da Intervals", testo: `Intervals usa ${lthrI} bpm, l'app ${CC.lthr} bpm.`, azione: "Metti lo stesso valore in tutti e due." });
  }
  // Passo soglia: confronto tra Intervals e app
  const tpC = corse.map((a) => V_N(a.threshold_pace)).find(Boolean), psApp = V_MS(CC.passoSoglia);
  if (tpC && psApp && Math.abs(1000 / tpC - psApp) / psApp > 0.03)
    out.push({ k: "passo-diverso", liv: "controlla", titolo: "Passo soglia diverso da Intervals", testo: `Intervals usa ${V_PACE(1000 / tpC)}/km, l'app ${CC.passoSoglia}/km.`, azione: "Metti lo stesso valore in tutti e due, dopo un test recente." });

  // 3. FC massima superata più volte
  const fcMax = V_N(CC.fcMax);
  if (fcMax) {
    const sopra = recenti(90).map((a) => V_N(a.max_heartrate)).filter((h) => h && h > fcMax + 1 && h < 225).sort((a, b) => b - a);
    if (sopra.length >= 2) out.push({ k: "fcmax", liv: "aggiorna", titolo: "FC massima superata", testo: `Hai toccato ${sopra[1]}–${sopra[0]} bpm in ${sopra.length} uscite, sopra la FC massima impostata (${fcMax}).`, azione: `Aggiorna la FC massima a ${sopra[1]} bpm: le zone in % della massima si spostano.`, valore: sopra[1] });
  }

  // 4. Bici: FTP mancante o superata dalla stima di Intervals
  const bici = recenti(56, "bici");
  if (bici.length) {
    const conW = bici.filter((a) => a.device_watts || V_N(a.icu_average_watts));
    const ftpI = bici.map((a) => V_N(a.icu_ftp)).find(Boolean), ftp = V_N(CB.ftp) || ftpI;
    const eft = bici.map((a) => V_N(a.icu_rolling_ftp) || V_N(a.icu_pm_ftp_watts) || V_N(a.icu_pm_ftp)).find(Boolean);
    if (conW.length && !ftp) out.push({ k: "ftp", liv: "aggiorna", titolo: "Manca la FTP", testo: `${conW.length} uscite in bici hanno la potenza, ma non c'è una FTP: le sedute si leggono solo con i battiti.`, azione: "Fai un test di 20 minuti o usa la stima di Intervals, poi impostala." });
    else if (conW.length && ftp && eft && Math.abs(eft - ftp) / ftp > 0.05) out.push({ k: "ftp", liv: "controlla", titolo: "FTP diversa dalla stima", testo: `FTP impostata ${Math.round(ftp)} W, stima di Intervals dalle ultime uscite ${Math.round(eft)} W.`, azione: "Se la stima è affidabile, aggiorna la FTP.", valore: Math.round(eft) });
    else if (!conW.length && CB.daVerificare) out.push({ k: "bici-fc", liv: "info", titolo: "Bici letta con i battiti", testo: "Nessuna uscita ha la potenza: intensità e impronta della bici si basano sulla FC, che reagisce in ritardo.", azione: "Con un misuratore di potenza le sedute diventano più precise." });
  }

  // 5. Gare non segnate: falsano il lungo tipico e il carico
  // "Trail Running" da solo è il nome automatico degli orologi, non una gara; "ritmo gara", "pre-gara" sono allenamenti
  const RX = /\b(gara|race|maratona|marathon|mezza|half|10 ?k|21 ?k|granfondo|gran fondo|triathlon|70\.3|ironman|duathlon|parkrun|ultra ?trail|skyrace|trofeo|memorial)\b/i;
  const ALL = /ritmo|pre[- ]|post|verso|richiamo|prepara|simula|\bz[1-5]\b|ripetut|lungo|facile|recupero|soglia|tecnica|test|lavori/i;
  const nonSegnate = recenti(120).filter((a) => !a.race && RX.test(a.name || "") && !ALL.test(a.name || ""));
  if (nonSegnate.length) out.push({ k: "gare", liv: "controlla", titolo: nonSegnate.length === 1 ? "Una gara non segnata" : `${nonSegnate.length} gare non segnate`,
    testo: `${nonSegnate.slice(0, 3).map((a) => `"${a.name}"`).join(", ")}${nonSegnate.length > 3 ? "…" : ""}: se sono gare, il piano le sta contando come allenamenti normali.`, azione: "Segnala le gare in Intervals (opzione Race): il lungo di partenza e i carichi tornano corretti." });

  // 6. Notti senza HRV o sonno: la prontezza diventa meno affidabile
  const ultimi = (raw.wellness || []).filter((w) => w && w.id && (now - new Date(w.id + "T12:00:00")) / V_DAY <= 14 && (now - new Date(w.id + "T12:00:00")) / V_DAY >= 0);
  if (ultimi.length >= 7) {
    const senza = ultimi.filter((w) => V_N(w.hrv) === null || (V_N(w.sleepSecs) === null && V_N(w.sleepScore) === null)).length;
    if (senza / ultimi.length > 0.3) out.push({ k: "notti", liv: "controlla", titolo: "Mancano dati notturni", testo: `${senza} notti su ${ultimi.length} senza HRV o sonno: la prontezza si basa su meno segnali e l'app è più prudente.`, azione: "Indossa l'orologio di notte e controlla che sincronizzi con Intervals." });
  }

  // 7. Rientro dalla pausa di corsa (solo per chi corre)
  // corsa vera: più veloce di ~7'15"/km, oppure trail lento ma con passo corretto per la pendenza (GAP) o battiti da corsa
  const vere = acts.filter((a) => V_SP(a.type) === "corsa" && (!(V_N(a.average_speed) && a.average_speed < 2.3) || V_N(a.gap) >= 2.3 || (V_N(a.average_heartrate) && V_N(a.lthr) && a.average_heartrate >= 0.8 * a.lthr)));
  const ultima = vere.map(giorniFa).filter((g) => g >= 0).sort((a, b) => a - b)[0];
  const min14 = vere.filter((a) => giorniFa(a) <= 14).reduce((t, a) => t + (V_N(a.moving_time) || 0) / 60, 0);
  if (SPORT_SCELTI.includes("corsa") && acts.length && (ultima === undefined || ultima > 10 || min14 < 60)) out.push({ k: "rientro", liv: "info", titolo: "Rientro nella corsa",
    testo: ultima === undefined ? "Non ci sono corse recenti." : ultima > 10 ? `L'ultima corsa vera è di ${Math.round(ultima)} giorni fa.` : `Solo ${Math.round(min14)} minuti di corsa nelle ultime 2 settimane.`,
    azione: "Il lungo riparte da 50 minuti e cresce di 10 ogni due settimane, anche se in passato correvi di più." });

  // 8. Continuità: settimane molto diverse tra loro
  const sett = [];
  const lun = new Date(now); lun.setHours(12, 0, 0, 0); lun.setDate(lun.getDate() - ((lun.getDay() + 6) % 7));
  for (let k = 1; k <= 8; k++) {
    const s = V_YMD(new Date(lun - 7 * k * V_DAY)), e = V_YMD(new Date(lun - 7 * (k - 1) * V_DAY));
    sett.push(acts.filter((a) => ["nuoto", "bici", "corsa"].includes(V_SP(a.type)) && a.start_date_local.slice(0, 10) >= s && a.start_date_local.slice(0, 10) < e).reduce((t, a) => t + (V_N(a.moving_time) || 0) / 60, 0));
  }
  const storia = acts.length ? (now - new Date(acts.map((a) => a.start_date_local).sort()[0])) / V_DAY : 0;
  if (storia >= 63) {
    const m = sett.reduce((t, x) => t + x, 0) / sett.length, sdv = Math.sqrt(sett.reduce((t, x) => t + (x - m) ** 2, 0) / sett.length);
    const zero = sett.filter((x) => x < 30).length;
    if (m > 0 && (sdv / m > 0.5 || zero >= 2)) out.push({ k: "continuita", liv: "info", titolo: "Settimane irregolari",
      testo: `Nelle ultime 8 settimane il tempo di endurance va da ${Math.round(Math.min(...sett) / 6) / 10} a ${Math.round(Math.max(...sett) / 6) / 10} ore${zero ? `, con ${zero} settimane quasi ferme` : ""}.`,
      azione: "Il piano ti fa crescere più lentamente: conta più la costanza delle singole settimane forti." });
  }
  const ord = { aggiorna: 0, controlla: 1, info: 2 };
  // con le soglie automatiche l'app le aggiorna da sola su Intervals: restano le verifiche che chiedono un'azione alla persona
  // e quelle sulle soglie che la persona ha fissato nel profilo (le gestisce lei)
  const CAMPO_K = { css: "css", "css-diverso": "css", lthr: "lthr", "lthr-diverso": "lthr", "passo-diverso": "passoSoglia", fcmax: "fcMax", ftp: "ftp" };
  const fisse = C.soglieFissate || [];
  return out.filter((x) => !C.soglieAutomatiche || !CAMPO_K[x.k] || fisse.includes(CAMPO_K[x.k])).sort((a, b) => ord[a.liv] - ord[b.liv]);
}
// <<< VERIFICHE

// ------------------------------------------------------------
//  Stima delle soglie (stesso blocco di 04_Generatore/soglie.js, copiato con node sincronizza-app.js)
// ------------------------------------------------------------
// >>> SOGLIE
function stimaSoglie(raw, now, att) {
  const S_N = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);
  const S_SP = (t) => { t = String(t || "").toLowerCase(); return t.includes("swim") ? "nuoto" : t.includes("run") ? "corsa" : t.includes("ride") || t.includes("bike") || t.includes("cycl") ? "bici" : "altro"; };
  const S_MS = (t) => { const p = String(t || "").split(":").map(Number); return p.length === 2 && p.every((x) => isFinite(x)) ? p[0] * 60 + p[1] : null; };
  const S_PACE = (sec) => { sec = Math.round(sec); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
  const S_MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const S_DATA = (a) => { const [y, m, d] = String(a.start_date_local).slice(0, 10).split("-").map(Number); return d + " " + S_MESI[m - 1]; };
  const fa = (a) => (now - new Date(String(a.start_date_local).slice(0, 10) + "T12:00:00")) / 86400000;
  const acts = ((raw && raw.activities) || []).filter((a) => a && a.start_date_local && fa(a) >= -0.5);
  const di = (sp, gg) => acts.filter((a) => S_SP(a.type) === sp && fa(a) <= gg);
  const min = (a) => (S_N(a.moving_time) || 0) / 60;
  const indoor = (a) => a.trainer === true || /virtual|treadmill/i.test(a.type || "") || /tapis|treadmill|rulli|indoor/i.test(a.name || "");
  const A = att || {}, AC = A.corsa || {}, AB = A.bici || {}, AN = A.nuoto || {};
  const val = (v, fonte, aff, perche) => ({ v, fonte, aff, perche });
  const out = { fcMax: null, corsa: { lthr: null, passo: null }, bici: { lthr: null, ftp: null }, nuoto: { css: null }, cambi: [] };
  // giri registrati ("Nx misura valore") → { reps, m | sec, passo (s/100 m o s/km), bpm }
  const giri = (a) => (Array.isArray(a.interval_summary) ? a.interval_summary : []).map((s) => {
    const m = String(s).trim().match(/^(\d+)x\s+(\S+)\s+(\S+)$/); if (!m) return null;
    const g = { reps: +m[1] }, size = m[2], met = m[3], sp = S_SP(a.type);
    if (/bpm$/.test(met)) g.bpm = parseFloat(met); else if (/^\d+:\d\d/.test(met)) g.passo = S_MS(met.replace(/\/.*/, ""));
    const t = size.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (/^\d+(\.\d+)?km$/.test(size)) g.m = parseFloat(size) * 1000;
    else if (/^\d+m$/.test(size) && (sp === "nuoto" || +size.slice(0, -1) >= 100)) g.m = +size.slice(0, -1);
    else if (t && size) g.sec = (+(t[1] || 0)) * 3600 + (+(t[2] || 0)) * 60 + (+(t[3] || 0));
    return g;
  }).filter(Boolean);

  const fcAtt = S_N(AC.max_hr) || S_N(AB.max_hr);
  const med = (v) => { const x = v.filter(Boolean).sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : null; };
  // sforzo davvero duro: lo dicono Intervals (intensità, gara), il nome, il tempo in zona 4+ o i battiti rispetto alla FC massima.
  // Nella corsa serve anche un passo più veloce del solito: battiti alti a passo facile sono spesso il sensore agganciato alla cadenza.
  const vCorse = di("corsa", 90).filter((a) => !indoor(a)).map((a) => S_N(a.gap) || S_N(a.average_speed)).filter(Boolean);
  const vMed = vCorse.length >= 5 ? med(vCorse) : null; // con poche corse non c'è un "solito" affidabile
  const duro = (a) => {
    const z = Array.isArray(a.icu_hr_zone_times) ? a.icu_hr_zone_times : [], zt = z.reduce((t, x) => t + (x || 0), 0);
    const segni = (S_N(a.icu_intensity) || 0) >= 85 || a.race === true || /gara|race|test|soglia|threshold|tempo|crono|time ?trial|\b(5|10|21) ?k\b|mezza|half|maratona|marathon/i.test(a.name || "")
      || (zt > 0 && z.slice(3).reduce((t, x) => t + (x || 0), 0) >= 0.4 * zt) || (fcAtt && (S_N(a.average_heartrate) || 0) >= 0.88 * fcAtt);
    if (!segni) return false;
    if (S_SP(a.type) !== "corsa" || !vMed) return true;
    const v = S_N(a.gap) || S_N(a.average_speed);
    return !v || indoor(a) || v >= 1.03 * vMed;
  };

  // ---- FC massima: il valore più alto confermato da una seconda uscita entro 3 bpm, solo da uscite con la media ad almeno l'80% del picco
  // (un picco isolato in un'uscita facile è spesso il sensore). Sale al massimo di 8 bpm per volta.
  const picchi = di("corsa", 365).concat(di("bici", 365)).filter((a) => S_N(a.max_heartrate) && a.max_heartrate < 225 && (S_N(a.average_heartrate) || 0) >= 0.8 * a.max_heartrate).map((a) => a.max_heartrate).sort((x, y) => y - x);
  let fcOss = null;
  for (let i = 0; i < picchi.length - 1; i++) if (picchi[i] - picchi[i + 1] <= 3) { fcOss = picchi[i + 1]; break; }
  if (fcOss && fcAtt && fcOss > fcAtt + 1) out.fcMax = val(Math.min(fcOss, fcAtt + 8), "attivita", "alta", `Hai toccato ${fcOss} bpm in più di un'uscita`);
  else if (fcAtt) out.fcMax = val(fcAtt, "intervals", "media", "Il valore impostato su Intervals");
  else if (fcOss) out.fcMax = val(fcOss, "osservata", "bassa", `Il valore più alto toccato più di una volta (${fcOss} bpm)`);
  const fcMax = out.fcMax && out.fcMax.v;

  // ---- Soglia FC da sforzi duri tenuti: l'uscita intera (20–70') o giri lunghi (≥10' l'uno, ≥20' in tutto)
  // Sforzo di 20–30' ≈ 103% della soglia, oltre ≈ 101%. Si prende il secondo valore più alto (robusto agli errori del sensore).
  // Sale al massimo di 8 bpm per volta e non scende mai da sola.
  const sogliaFC = (sp, att) => {
    const c = [];
    for (const a of di(sp, 120)) {
      if (!duro(a)) continue;
      const t = min(a), hr = S_N(a.average_heartrate);
      if (hr && t >= 20 && t <= 70) c.push({ v: Math.round(hr * (t <= 30 ? 0.97 : 0.99)), a, t: Math.round(t), hr: Math.round(hr) });
      for (const g of giri(a)) if (g.bpm && g.sec >= 600 && g.reps * g.sec >= 1200) c.push({ v: Math.round(g.bpm * 0.99), a, t: Math.round((g.reps * g.sec) / 60), hr: Math.round(g.bpm) });
    }
    c.sort((x, y) => y.v - x.v);
    if (!c.length) return att ? val(att, "intervals", "media", "Il valore impostato su Intervals") : null;
    const scelto = c.length >= 2 ? c[1] : c[0];
    if (att && scelto.v <= att + 2) return val(att, "intervals", "media", "Il valore impostato su Intervals, confermato dalle tue uscite");
    return val(att ? Math.min(scelto.v, att + 8) : scelto.v, "attivita", c.length >= 2 ? "alta" : "media", `${scelto.t}' a ${scelto.hr} bpm di media (${S_DATA(scelto.a)})`);
  };
  out.corsa.lthr = sogliaFC("corsa", S_N(AC.lthr)) || (fcMax ? val(Math.round(fcMax * 0.9), "stima", "bassa", "Il 90% della FC massima: servono uno sforzo di 20–30' o una gara") : null);
  const LT = out.corsa.lthr && out.corsa.lthr.v;
  out.bici.lthr = sogliaFC("bici", S_N(AB.lthr)) || (LT ? val(LT - 5, "stima", "bassa", "5 bpm sotto la soglia di corsa") : null);

  // ---- Passo soglia di corsa (m/s): (a) sforzi duri di 15–75' con il passo corretto per la pendenza (GAP), portati a un'ora;
  // (b) se mancano e su Intervals non c'è un valore, la retta passo–battiti delle corse facili, letta alla soglia FC
  const pAtt = S_N(AC.threshold_pace) && AC.threshold_pace < 7 ? AC.threshold_pace : null; // oltre 7 m/s non è una velocità di corsa
  let passo = null;
  if (LT) {
    const duri = di("corsa", 90).filter((a) => !indoor(a) && duro(a) && min(a) >= 15 && min(a) <= 75 && S_N(a.average_heartrate) >= 0.94 * LT).map((a) => {
      const v = S_N(a.gap) || S_N(a.average_speed);
      return v && v > 1.8 && v < 6.5 ? { v: v * Math.pow(min(a) / 60, 0.06), a, alta: a.average_heartrate >= 0.97 * LT && min(a) >= 20 } : null;
    }).filter(Boolean).sort((x, y) => y.v - x.v);
    if (duri.length) {
      const b = duri[0];
      passo = val(pAtt ? Math.min(b.v, pAtt * 1.08) : b.v, "attivita", b.alta ? "alta" : "media", `${Math.round(min(b.a))}' a ${S_PACE(1000 / (S_N(b.a.gap) || b.a.average_speed))}/km${S_N(b.a.gap) ? " (corretto per la pendenza)" : ""} e ${Math.round(b.a.average_heartrate)} bpm (${S_DATA(b.a)})`);
      if (pAtt && passo.v <= pAtt * 1.03) passo = null; // non più veloce del valore impostato: resta quello
    } else if (!pAtt) {
      const pts = di("corsa", 60).filter((a) => !indoor(a) && min(a) >= 20 && S_N(a.average_heartrate) && a.average_heartrate >= 0.7 * LT && a.average_heartrate < 0.95 * LT)
        .map((a) => ({ x: a.average_heartrate, y: S_N(a.gap) || S_N(a.average_speed) })).filter((p) => p.y && p.y > 1.8 && p.y < 6.5);
      if (pts.length >= 6) {
        const n = pts.length, mx = pts.reduce((t, p) => t + p.x, 0) / n, my = pts.reduce((t, p) => t + p.y, 0) / n;
        const sxy = pts.reduce((t, p) => t + (p.x - mx) * (p.y - my), 0), sxx = pts.reduce((t, p) => t + (p.x - mx) ** 2, 0), syy = pts.reduce((t, p) => t + (p.y - my) ** 2, 0);
        const b = sxx ? sxy / sxx : 0, r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
        const v = my + b * (LT - mx), vMax = Math.max(...pts.map((p) => p.y));
        if (b > 0 && r >= 0.4 && v > vMax && v < vMax * 1.35) passo = val(v, "stima", r >= 0.6 ? "media" : "bassa", `Dal rapporto tra passo e battiti di ${n} corse facili, letto a ${LT} bpm`);
      }
    }
  }
  out.corsa.passo = passo || (pAtt ? val(pAtt, "intervals", "media", "Il valore impostato su Intervals") : null);

  // ---- CSS del nuoto (m/s): test 400 + 200, poi ripetute lunghe, poi la nuotata continua più veloce
  const nuoti = di("nuoto", 120);
  let css = null; // secondi per 100 m
  for (const a of nuoti) {
    // nel test il 400 e il 200 sono i più veloci della seduta (il riscaldamento può avere anche lui un 400)
    const G = giri(a), piu = (m) => G.filter((x) => x.m === m && x.passo).sort((x, y) => x.passo - y.passo)[0], r4 = piu(400), r2 = piu(200);
    const ev = a.paired_event_id ? ((raw && raw.events) || []).find((e) => e && e.id === a.paired_event_id) : null;
    if (/css|test/i.test((a.name || "") + " " + ((ev && ev.name) || "")) && r4 && r2 && 4 * r4.passo > 2 * r2.passo && (!css || css.data < a.start_date_local))
      css = { s: Math.round((4 * r4.passo - 2 * r2.passo) / 2), aff: "alta", perche: `Test 400 + 200 del ${S_DATA(a)}`, data: a.start_date_local };
  }
  if (!css) {
    const rip = [];
    for (const a of nuoti) for (const g of giri(a)) if (g.m >= 200 && g.passo >= 50) rip.push({ s: g.passo + (g.m >= 300 ? 3 : 5), g, a });
    rip.sort((x, y) => x.s - y.s);
    if (rip.length >= 2 || (rip.length && rip[0].g.m >= 300)) css = { s: Math.round(rip[0].s), aff: "media", perche: `${rip[0].g.reps > 1 ? rip[0].g.reps + " × " : ""}${rip[0].g.m} m a ${S_PACE(rip[0].g.passo)}/100 m (${S_DATA(rip[0].a)})` };
  }
  if (!css) {
    const cont = nuoti.filter((a) => S_N(a.distance) >= 1000 && S_N(a.moving_time)).map((a) => ({ s: (a.moving_time / a.distance) * 100, a })).filter((x) => x.s >= 50 && x.s <= 240).sort((x, y) => x.s - y.s);
    if (cont.length) css = { s: Math.round(cont[0].s - 5), aff: "bassa", perche: `La nuotata più veloce, ${Math.round(cont[0].a.distance)} m a ${S_PACE(cont[0].s)}/100 m (${S_DATA(cont[0].a)}): il test 400 + 200 la renderebbe precisa` };
  }
  const cssAtt = S_N(AN.threshold_pace) && AN.threshold_pace > 0.4 && AN.threshold_pace < 2.5 ? AN.threshold_pace : null;
  const cssPredef = cssAtt && Math.abs(cssAtt - 100 / 120) < 0.001; // 2:00/100 m: il valore che Intervals mette di partenza
  if (css) {
    const v = 100 / css.s;
    const cambia = !cssAtt || cssPredef || (css.aff === "alta" && Math.abs(v - cssAtt) / cssAtt > 0.02) || (css.aff === "media" && v > cssAtt * 1.02);
    out.nuoto.css = cambia ? val(v, "attivita", css.aff, css.perche) : val(cssAtt, "intervals", "media", "Il valore impostato su Intervals");
  } else out.nuoto.css = cssAtt ? val(cssAtt, "intervals", cssPredef ? "bassa" : "media", cssPredef ? "Il valore di partenza di Intervals: fai il test 400 + 200" : "Il valore impostato su Intervals") : null;
  out.nuoto.daMisurare = !css;

  // ---- FTP: solo con il misuratore di potenza (almeno 2 uscite), dalla stima di Intervals (eFTP)
  const conW = di("bici", 90).filter((a) => a.device_watts === true || S_N(a.icu_average_watts)).sort((x, y) => String(y.start_date_local).localeCompare(String(x.start_date_local)));
  const ftpAtt = S_N(AB.ftp);
  if (conW.length >= 2) {
    const e = conW.map((a) => S_N(a.icu_rolling_ftp)).find(Boolean); // la stima "a scorrimento" di Intervals, non quella di una singola uscita
    out.bici.ftp = e && (!ftpAtt || e > ftpAtt * 1.03) ? val(Math.round(ftpAtt ? Math.min(e, ftpAtt * 1.15) : e), "attivita", "media", "La stima di Intervals dalle tue ultime uscite con la potenza") : ftpAtt ? val(ftpAtt, "intervals", "media", "Il valore impostato su Intervals") : null;
  } else out.bici.ftp = null; // senza potenza le sedute di bici usano i battiti

  // ---- Cosa scrivere su Intervals: solo per gli sport che la persona fa (attività negli ultimi 4 mesi)
  const fa4 = { Run: di("corsa", 120).length > 0, Ride: di("bici", 120).length > 0, Swim: nuoti.length > 0 };
  const cambio = (tipo, campo, da, a, testo) => { if (fa4[tipo]) out.cambi.push({ tipo, campo, da: da || null, a, testo }); };
  // (si scrive solo quello che viene da attività vere; le stime prudenti servono alla pagina, non a Intervals,
  //  tranne il passo dalla retta passo–battiti quando su Intervals manca del tutto)
  if (out.fcMax && out.fcMax.fonte === "attivita") { cambio("Run", "max_hr", fcAtt, out.fcMax.v, `FC massima ${out.fcMax.v} bpm`); cambio("Ride", "max_hr", S_N(AB.max_hr), out.fcMax.v, null); }
  if (out.corsa.lthr && out.corsa.lthr.fonte === "attivita") cambio("Run", "lthr", S_N(AC.lthr), out.corsa.lthr.v, `soglia FC di corsa ${out.corsa.lthr.v} bpm`);
  if (out.corsa.passo && (out.corsa.passo.fonte === "attivita" || (out.corsa.passo.fonte === "stima" && !pAtt))) cambio("Run", "threshold_pace", pAtt, out.corsa.passo.v, `passo soglia ${S_PACE(1000 / out.corsa.passo.v)}/km`);
  if (out.bici.lthr && out.bici.lthr.fonte === "attivita") cambio("Ride", "lthr", S_N(AB.lthr), out.bici.lthr.v, `soglia FC in bici ${out.bici.lthr.v} bpm`);
  if (out.bici.ftp && out.bici.ftp.fonte !== "intervals") cambio("Ride", "ftp", ftpAtt, out.bici.ftp.v, `FTP ${out.bici.ftp.v} W`);
  if (out.nuoto.css && out.nuoto.css.fonte !== "intervals") cambio("Swim", "threshold_pace", cssAtt, out.nuoto.css.v, `CSS ${S_PACE(100 / out.nuoto.css.v)}/100 m`);
  return out;
}
// <<< SOGLIE

// ------------------------------------------------------------
//  Generatore del piano e profilo dai dati (stessi blocchi di 04_Generatore,
//  copiati con node sincronizza-app.js: non modificarli qui)
// ------------------------------------------------------------
const GEN = (function () {
// >>> GENERATORE
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYMD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const nextMonday = (d) => addDays(d, ((8 - d.getDay()) % 7) || 7);
const r5 = (m) => Math.max(5, Math.round(m / 5) * 5);
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// ------------------------------------------------------------
//  Parametri delle regole (tutti in un posto, per la revisione)
// ------------------------------------------------------------
const REGOLE = {
  ripartizione: { // quota del tempo di endurance per sport
    sprint: { nuoto: 0.25, bici: 0.35, corsa: 0.40 },
    olimpico: { nuoto: 0.22, bici: 0.40, corsa: 0.38 },
    "70.3": { nuoto: 0.20, bici: 0.45, corsa: 0.35 },
    ironman: { nuoto: 0.18, bici: 0.52, corsa: 0.30 },
    "duathlon-sprint": { bici: 0.45, corsa: 0.55 },
    duathlon: { bici: 0.50, corsa: 0.50 },
    aquathlon: { nuoto: 0.40, corsa: 0.60 },
    "5k": { corsa: 1 }, "10k": { corsa: 1 }, mezza: { corsa: 1 }, maratona: { corsa: 1 },
    mediofondo: { bici: 1 }, granfondo: { bici: 1 },
    "nuoto-3k": { nuoto: 1 }, "nuoto-10k": { nuoto: 1 },
    migliorare: { nuoto: 0.25, bici: 0.40, corsa: 0.35 },
  },
  // lungo massimo verso cui crescere (minuti): oltre non serve per quella gara; chi fa già di più lo mantiene
  // (solo per chi sceglie uno o due sport: il triathlon resta con le sue regole)
  lungoMax: {
    "duathlon-sprint": { corsa: 75, bici: 120 }, duathlon: { corsa: 100, bici: 180 }, aquathlon: { corsa: 80, bici: 120 },
    "5k": { corsa: 75 }, "10k": { corsa: 95 }, mezza: { corsa: 120 }, maratona: { corsa: 170 },
    mediofondo: { bici: 240 }, granfondo: { bici: 330 },
    migliorare: { corsa: 120, bici: 240 },
  },
  triathlon: ["sprint", "olimpico", "70.3", "ironman"],
  quotaSportExtra: 0.15,                   // sport scelto che la gara non prevede: solo mantenimento
  sedutaNuotoMax: 100,                     // minuti: oltre, meglio una seduta in più
  sedutaFacileMax: 75,                     // corsa facile per chi fa solo corsa (90' per mezza e maratona)
  uscitaFacileMax: 120,                    // bici facile per chi fa solo bici
  ctlDueQualita: 30,                       // fitness minima per due qualità a settimana (chi fa un solo sport)
  crescitaSettimanale: [1.0, 1.07, 1.14],  // settimane di carico del blocco
  scarico: 0.65,                           // volume della 4ª settimana rispetto alla 3ª
  rampMax: 6,                              // punti di fitness (CTL) a settimana
  quotaQualitaMax: 0.25,                   // tempo in qualità sul totale (80/20 con tolleranza)
  lungoCorsaPassoMin: 10,                  // +10' ...
  lungoCorsaOgniSett: 2,                   // ... ogni 2 settimane
  volumeSportMin: 0.85,
  quotaOreDichiarate: 0.75,                // il piano parte almeno da questa quota delle ore indicate nella configurazione                    // quota minima dei minuti abituali di ogni sport da mantenere
  lungoRientroMax: 50,                    // lungo massimo alla ripresa dopo una pausa di corsa
  lungoCorsaQuotaMax: 0.40,                // del tempo di corsa settimanale (calibrato: 30% era irrealistico con 3 uscite)
  minSeduta: 20,
  palestraMin: 45,
  IF: { recupero: 0.55, facile: 0.68, lungo: 0.70, tecnica: 0.65, tempo: 0.82, soglia: 0.95, vo2: 1.02, gara: 0.85, forza: 0.6 },
};

// ------------------------------------------------------------
//  Libreria di sedute: modelli parametrici, l'utente vede solo il risultato
// ------------------------------------------------------------
function seduta(sport, tipo, min, fase, k, maxMin) {
  if (maxMin && ["soglia", "vo2", "tempo"].includes(tipo)) {
    for (let kk = k; kk >= 0; kk--) { const s = seduta(sport, tipo, min, fase, kk); if (s.min <= maxMin) return s; }
    const corta = seduta(sport, tipo, min, fase, 0); // ultima risorsa: meno ripetute, stesso schema
    const blocco = corta.passi.find((p) => p.ripeti);
    while (blocco && blocco.ripeti > 3 && corta.min > maxMin) { blocco.ripeti--; corta.min -= blocco.passi.reduce((t, p) => t + p.min, 0); }
    corta.min = r5(corta.min); corta.nome = corta.nome.replace(/\d+×/, blocco.ripeti + "×");
    corta.minQualita = Math.round(blocco.ripeti * blocco.passi[0].min);
    return corta;
  }
  // k = indice di progressione 0..2 nel blocco
  const S = { sport, tipo, min: r5(min), passi: [] };
  const P = S.passi;
  const add = (min, cosa, intensita) => P.push({ min, cosa, intensita });
  if (sport === "corsa") {
    if (tipo === "soglia") {
      const rep = [5, 6, 6][k] || 6, dur = [5, 5, 6][k] || 5;
      S.nome = `Soglia ${rep}×${dur}'`; const core = rep * dur + (rep - 1);
      add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: dur, cosa: "Soglia", intensita: "100% soglia" }, { min: 1, cosa: "Recupero", intensita: "camminata/corsa lenta" }] }); add(10, "Defaticamento", "Z1–Z2");
      S.min = r5(25 + core);
    } else if (tipo === "vo2") {
      const rep = [5, 6, 6][k] || 5, dur = [2, 2, 3][k] || 3;
      S.nome = `VO2 ${rep}×${dur}'`; add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: dur, cosa: "VO2", intensita: "108% soglia" }, { min: dur, cosa: "Recupero", intensita: "Z1" }] }); add(10, "Defaticamento", "Z1–Z2");
      S.min = r5(25 + rep * dur * 2);
    } else if (tipo === "tempo") {
      // medio: blocchi lunghi poco sotto la soglia, la qualità di chi prepara mezza e maratona
      const rep = [2, 2, 3][k] || 2, dur = [12, 15, 12][k] || 12;
      S.nome = `Medio ${rep}×${dur}'`; add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: dur, cosa: "Medio", intensita: "90% soglia" }, { min: 3, cosa: "Recupero", intensita: "corsa lenta" }] }); add(10, "Defaticamento", "Z1–Z2");
      S.min = r5(25 + rep * (dur + 3));
    } else if (tipo === "lungo") {
      S.nome = `Lungo ${S.min}'`;
      if (fase === "picco" && S.min >= 70) { add(S.min - 20, "Lungo", "Z2"); add(20, "Finale a ritmo gara", "ritmo gara"); }
      else add(S.min, "Lungo costante", "Z2");
    } else if (tipo === "allunghi") {
      S.nome = `Facile ${S.min}' + allunghi`; add(S.min - 4, "Facile", "Z2"); P.push({ ripeti: 6, passi: [{ min: 0.33, cosa: "Allungo", intensita: "veloce, rilassato" }, { min: 0.67, cosa: "Recupero", intensita: "passo" }] });
    } else if (tipo === "test") {
      S.nome = "Test a gradini"; add(10, "Riscaldamento", "Z1–Z2"); P.push({ ripeti: 5, passi: [{ min: 4, cosa: "Gradino", intensita: "ogni gradino +0,5 km/h" }] }); add(5, "Defaticamento", "Z1");
      S.min = 35;
    } else { S.nome = `Facile ${S.min}'`; add(S.min, "Facile", "Z2"); }
  }
  if (sport === "bici") {
    if (tipo === "soglia") {
      const rep = [3, 4, 4][k] || 4, dur = [8, 8, 10][k] || 8;
      S.nome = `Soglia ${rep}×${dur}'`; add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: dur, cosa: "Soglia", intensita: "95–100% FTP" }, { min: 4, cosa: "Recupero", intensita: "Z1" }] }); add(10, "Defaticamento", "Z1");
      S.min = r5(25 + rep * (dur + 4));
    } else if (tipo === "tempo") {
      const rep = [3, 3, 4][k] || 3; S.nome = `Sweet spot ${rep}×12'`; add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: 12, cosa: "Sweet spot", intensita: "88–92% FTP" }, { min: 4, cosa: "Recupero", intensita: "Z1" }] }); add(10, "Defaticamento", "Z1");
      S.min = r5(25 + rep * 16);
    } else if (tipo === "lungo") {
      S.nome = `Lungo ${Math.floor(S.min / 60)}h${pad(S.min % 60)}`;
      if (fase === "picco" && S.min >= 120) { add(S.min - 60, "Lungo", "Z2"); add(40, "Blocco a ritmo gara", "ritmo gara"); add(20, "Sciolto", "Z1–Z2"); }
      else add(S.min, "Lungo costante", "Z2");
    } else { S.nome = `Z2 ${S.min}'`; add(S.min, "Resistenza", "Z2"); }
  }
  if (sport === "nuoto") {
    const metri = Math.round((S.min * 1000 / 30) / 100) * 100; // ~3 km/h con pause
    S.metri = metri;
    // le ripetute stanno nel tempo della seduta: 10' di riscaldamento e almeno 5' di defaticamento
    if (tipo === "soglia") { const rep = Math.max(4, Math.min([8, 10, 12][k] || 10, Math.floor((S.min - 15) / 2.08))); S.nome = `Soglia ${rep}×100 · ${metri} m`; add(10, "Riscaldamento misto", "facile"); P.push({ ripeti: rep, passi: [{ min: 1.75, cosa: "100 a CSS", intensita: "CSS" }, { min: 0.33, cosa: "Recupero 20\"", intensita: "fermo" }] }); add(Math.max(5, Math.round(S.min - 10 - rep * 2.08)), "Tecnica + defaticamento", "facile"); }
    else if (tipo === "lungo") { S.nome = `Lungo continuo · ${metri} m`; add(10, "Riscaldamento", "facile"); add(S.min - 15, "Continuo", "CSS +8\""); add(5, "Defaticamento", "facile"); }
    else if (tipo === "tempo") { const rep = Math.max(3, Math.min(8, Math.floor((S.min - 15) / 3.93))); S.nome = `Ritmo ${rep}×200 · ${metri} m`; add(10, "Riscaldamento", "facile"); P.push({ ripeti: rep, passi: [{ min: 3.6, cosa: "200 a CSS +3\"", intensita: "CSS +3\"" }, { min: 0.33, cosa: "Recupero 20\"", intensita: "fermo" }] }); add(Math.max(5, Math.round(S.min - 10 - rep * 3.93)), "Tecnica + defaticamento", "facile"); }
    else if (tipo === "test") { S.nome = "Test CSS · 400 + 200"; add(10, "Riscaldamento", "facile"); add(8, "400 a tutta", "massimo"); add(5, "Recupero", "fermo"); add(4, "200 a tutta", "massimo"); add(S.min - 27, "Defaticamento", "facile"); }
    else { S.nome = `Tecnica · ${metri} m`; add(S.min, "Drill e nuotata facile", "facile"); }
  }
  if (sport === "nuoto") {
    // metri dai passi: le ripetute hanno la loro distanza, il resto ~40 m al minuto (passo facile), le pause da fermo nulla
    const dist = (p) => { const d = /^(\d{2,4}) a /.exec(p.cosa || ""); return d ? +d[1] : /fermo/.test(p.intensita || "") ? 0 : p.min * 40; };
    const m = P.reduce((t, p) => t + (p.ripeti ? p.ripeti * p.passi.reduce((u, q) => u + dist(q), 0) : dist(p)), 0);
    const nuovi = Math.max(100, Math.round(m / 100) * 100);
    S.nome = S.nome.replace(/· \d+ m$/, `· ${nuovi} m`); S.metri = nuovi;
  }
  if (sport === "forza") { S.nome = tipo === "gambe" ? "Forza gambe" : "Forza parte alta e core"; add(S.min, S.nome, "moderata"); }
  const ifKey = { soglia: "soglia", vo2: "vo2", tempo: "tempo", lungo: "lungo", allunghi: "facile", facile: "facile", tecnica: "tecnica", gambe: "forza", alto: "forza" }[tipo] || "facile";
  S.qualita = ["soglia", "vo2", "tempo", "test"].includes(tipo);
  S.carico = Math.round((S.min / 60) * REGOLE.IF[ifKey] ** 2 * 100);
  S.minQualita = tipo === "test" ? 15 : S.qualita ? Math.round(P.reduce((t, p) => t + (p.ripeti ? p.ripeti * p.passi[0].min : 0), 0)) : (S.tipo === "lungo" && P.some((p) => p.intensita && /ritmo gara/.test(p.intensita)) ? 20 : 0);
  return S;
}

// ------------------------------------------------------------
//  Fase in base alle settimane mancanti alla gara
// ------------------------------------------------------------
function faseDi(settimaneAllaGara, indiceBlocco) {
  if (settimaneAllaGara === null) return indiceBlocco % 2 ? "costruzione" : "base";
  if (settimaneAllaGara < 0) return "recupero";
  if (settimaneAllaGara <= 2) return "gara";
  if (settimaneAllaGara <= 6) return "picco";
  if (settimaneAllaGara <= 16) return "costruzione";
  return "base";
}

// ------------------------------------------------------------
//  Generazione del blocco
// ------------------------------------------------------------
// Gli sport che la persona fa: corsa, bici, nuoto (uno, due o tutti e tre)
// I profili senza "discipline" (prima versione) seguono le regole del triathlon con bici e piscina facoltative
function discipline(profilo) {
  const s = profilo.sport || {};
  let d = Array.isArray(s.discipline) && s.discipline.length ? s.discipline.filter((x) => ["nuoto", "bici", "corsa"].includes(x)) : ["nuoto", "bici", "corsa"];
  if (s.bici === false) d = d.filter((x) => x !== "bici");
  if (s.piscina === false) d = d.filter((x) => x !== "nuoto");
  return d.length ? d : ["corsa"];
}
const parziale = (profilo) => Array.isArray((profilo.sport || {}).discipline) && discipline(profilo).length < 3;

function generaBlocco(profilo, opzioni = {}) {
  const oggi = parseYMD(profilo.oggi);
  const inizio = opzioni.inizio ? parseYMD(opzioni.inizio) : nextMonday(oggi);
  const gara = profilo.obiettivo && profilo.obiettivo.data ? parseYMD(profilo.obiettivo.data) : null;
  const tipo = (profilo.obiettivo && profilo.obiettivo.tipo) || "migliorare";
  const scelti = discipline(profilo), parz = parziale(profilo);
  const rip = REGOLE.ripartizione[tipo] || REGOLE.ripartizione.migliorare;
  const split0 = { nuoto: 0, bici: 0, corsa: 0 };
  const avvisi = [];
  if (parz) {
    // uno o due sport scelti: solo quelli, con le quote della gara
    for (const sp of scelti) split0[sp] = rip[sp] ?? REGOLE.quotaSportExtra;
    if (REGOLE.triathlon.includes(tipo)) avvisi.push("Per un triathlon servono nuoto, bici e corsa: il piano prepara solo gli sport che hai scelto.");
    if (!(split0.nuoto + split0.bici + split0.corsa)) split0[scelti[0]] = 1;
    const somma = split0.nuoto + split0.bici + split0.corsa;
    for (const sp of ["nuoto", "bici", "corsa"]) split0[sp] /= somma;
  } else {
    // triathlon (e profili della prima versione): bici e piscina possono mancare
    Object.assign(split0, rip);
    if (!scelti.includes("bici")) { split0.corsa += split0.bici * 0.6; split0.nuoto += split0.bici * 0.4; split0.bici = 0; avvisi.push("Senza bici il piano non prepara la frazione ciclistica: consigliata almeno una bici da indoor."); }
    if (!scelti.includes("nuoto")) { split0.corsa += split0.nuoto * 0.5; split0.bici += split0.nuoto * 0.5; split0.nuoto = 0; avvisi.push("Senza piscina il nuoto è escluso: servono almeno 2 accessi a settimana per una gara di triathlon."); }
  }

  const L = profilo.livello;
  // mescola la ripartizione standard con quella dello storico: chi nuota molto non deve smettere
  if (L.minPerSport) {
    const h = L.minPerSport, tot = (h.nuoto || 0) + (h.bici || 0) + (h.corsa || 0);
    if (tot > 0) for (const sp of ["nuoto", "bici", "corsa"]) if (split0[sp] > 0) split0[sp] = 0.5 * split0[sp] + 0.5 * ((h[sp] || 0) / tot);
    const somma = split0.nuoto + split0.bici + split0.corsa;
    for (const sp of ["nuoto", "bici", "corsa"]) split0[sp] /= somma;
  }
  const storicoCorto = (L.settimaneStorico ?? 12) < 4;
  if (storicoCorto) avvisi.push("Storico inferiore a 4 settimane: blocco d'ingresso prudente con test di soglia.");
  // chi fa uno o due sport parte dai minuti abituali di quegli sport, non dalle ore totali
  // (un triatleta che prepara una maratona non deve trasformare in corsa le ore di bici e nuoto)
  let abituali = (L.oreSett || 4) * 60;
  if (parz && L.minPerSport) {
    const m = scelti.reduce((t, sp) => t + (L.minPerSport[sp] || 0), 0);
    abituali = Math.min(abituali, Math.max(150, m * 1.05) + (profilo.sport.palestra ? 2 * REGOLE.palestraMin : 0));
  }
  // ore indicate nella configurazione: il piano parte almeno dal 75% (scelta di prodotto: subito vicino a quello che la persona vuole fare);
  // il limite di crescita della fitness (rampMax) resta e, se serve, riduce il volume
  const dich = profilo.disponibilita.oreDichiarate;
  if (dich) abituali = Math.max(abituali, REGOLE.quotaOreDichiarate * dich * 60);
  const base = Math.min(profilo.disponibilita.oreMax * 60, Math.max(parz ? 150 : 180, abituali)) * (storicoCorto ? 0.85 : 1);
  if (base < 210 && tipo !== "migliorare" && !parz) avvisi.push("Con meno di 3,5 ore a settimana non c'è spazio per due sedute per sport: il piano tiene 2 corse e 2 nuotate, la bici una volta. Il volume crescerà con la fitness.");

  let scala = 1, piano;
  for (let tentativo = 0; tentativo < 25; tentativo++) { // si riduce finché la fitness non cresce più di rampMax a settimana
    piano = costruisci(profilo, inizio, gara, tipo, split0, base * scala, opzioni);
    const ramp = Math.max(...piano.settimane.map((s) => s.ramp));
    if (ramp <= REGOLE.rampMax) break;
    scala *= 0.93;
  }
  piano.avvisi = [...avvisi, ...piano.avvisi];
  piano.profilo = profilo.nome;
  return piano;
}

function costruisci(profilo, inizio, gara, tipo, split, baseMin, opzioni) {
  const L = profilo.livello, D = profilo.disponibilita;
  const avvisi = [];
  const settimane = [];
  const scelti = discipline(profilo), parz = parziale(profilo);
  const solo = parz && scelti.length === 1 ? scelti[0] : null; // chi fa un solo sport
  const LMAX = parz ? REGOLE.lungoMax[tipo] || REGOLE.lungoMax.migliorare : {}; // nel triathlon il lungo cresce senza tetto per gara
  const lunga = tipo === "mezza" || tipo === "maratona"; // gare lunghe di corsa: il medio conta più delle ripetute brevi
  let ctl = L.ctl, atl = L.atl ?? L.ctl;
  let lungoCorsa = L.lungoCorsaMin || 40;
  // Rientro dopo una pausa di corsa: il lungo riparte basso e cresce con la regola normale
  if (L.rientro && L.rientro.corsa && lungoCorsa > REGOLE.lungoRientroMax) { lungoCorsa = REGOLE.lungoRientroMax; avvisi.push(`Rientro dopo una pausa di corsa: il lungo riparte da ${REGOLE.lungoRientroMax}' e cresce di ${REGOLE.lungoCorsaPassoMin}' ogni ${REGOLE.lungoCorsaOgniSett} settimane.`); }
  let lungoBici = L.lungoBiciMin || 60;
  const indiceBlocco = opzioni.indiceBlocco || 0;
  let volPrec = null;

  for (let w = 0; w < 4; w++) {
    const lun = addDays(inizio, 7 * w);
    const settGara = gara ? Math.floor((gara - lun) / (7 * DAY)) : null;
    const fase = faseDi(settGara, indiceBlocco);
    const scaricoSett = w === 3;
    let fattore = scaricoSett ? REGOLE.crescitaSettimanale[2] * REGOLE.scarico : REGOLE.crescitaSettimanale[w];
    if (fase === "gara") fattore = settGara <= 0 ? 0.45 : settGara === 1 ? 0.6 : 0.75;
    if (fase === "recupero") fattore = 0.5;
    let T = Math.min(D.oreMax * 60, baseMin * fattore);
    if (scaricoSett && volPrec && fase !== "gara" && fase !== "recupero") T = Math.min(T, volPrec * 0.68);

    // palestra: fuori dal tempo di endurance
    const nPal = !profilo.sport.palestra ? 0 : fase === "picco" || fase === "gara" || fase === "recupero" || T < 300 ? 1 : 2;
    const palestraMin = nPal * REGOLE.palestraMin;
    const E = Math.max(90, T - palestraMin);
    const mins = { nuoto: E * split.nuoto, bici: E * split.bici, corsa: E * split.corsa };
    // Non togliere volume allo sport che l'atleta già fa: almeno l'85% dei suoi minuti abituali
    // (chi arriva dalla corsa e aggiunge il nuoto non deve dimezzare la corsa). Il rientro dopo una pausa fa eccezione.
    if (L.minPerSport) {
      const rid = scaricoSett ? 0.7 : fase === "gara" || fase === "recupero" ? 0.6 : 1;
      for (const sp of ["nuoto", "bici", "corsa"]) {
        if (!mins[sp] || (sp === "corsa" && L.rientro && L.rientro.corsa)) continue;
        mins[sp] = Math.max(mins[sp], (L.minPerSport[sp] || 0) * REGOLE.volumeSportMin * rid);
      }
      const tetto = D.oreMax * 60 - palestraMin, tot = mins.nuoto + mins.bici + mins.corsa;
      if (tot > tetto) for (const sp of ["nuoto", "bici", "corsa"]) mins[sp] *= tetto / tot;
    }

    // qualità per fase
    let qual = { base: ["corsa"], costruzione: ["corsa", "bici"], picco: ["corsa", "bici"], gara: settGara <= 0 ? [] : ["corsa"], recupero: [] }[fase].slice();
    if (scaricoSett) qual.splice(1);

    if (fase === "base" && w % 2 === 1 && mins.bici > 0) qual[0] = "bici";
    if (!mins.corsa && mins.bici > 0 && qual[0] === "corsa") qual[0] = "bici"; // chi fa nuoto e bici: la qualità va alla bici
    // un solo sport (corsa o bici): una qualità in base, due in costruzione e picco
    // un solo sport (corsa o bici): una qualità in base; due in costruzione e picco se il livello e le sedute lo permettono
    if (solo === "corsa" || solo === "bici") {
      const sedSett = solo === "corsa" ? Math.round(mins.corsa / 50) : Math.round(mins.bici / 70);
      const due = (L.ctl || 0) >= REGOLE.ctlDueQualita && sedSett >= 5;
      const n = { base: 1, costruzione: due ? 2 : 1, picco: due ? 2 : 1, gara: settGara <= 0 ? 0 : 1, recupero: 0 }[fase];
      qual = Array(scaricoSett ? Math.min(1, n) : n).fill(solo);
    }
    qual = qual.filter((sp) => mins[sp] > 0);
    const ingresso = (L.settimaneStorico ?? 12) < 4;
    if (ingresso) qual.length = 0;
    const k = Math.min(w, 2);

    // lungo di corsa: +10' ogni 2 settimane fino al lungo che serve per la gara, scarico −25%, tetto 40% del tempo di corsa
    if (w > 0 && w % REGOLE.lungoCorsaOgniSett === 0 && !scaricoSett && fase !== "gara" && lungoCorsa < (LMAX.corsa || 999)) lungoCorsa = Math.min(LMAX.corsa || 999, lungoCorsa + REGOLE.lungoCorsaPassoMin);
    let lungoC = scaricoSett || fase === "gara" ? lungoCorsa * 0.75 : lungoCorsa;
    lungoC = Math.min(lungoC, mins.corsa * REGOLE.lungoCorsaQuotaMax);
    if (lungoC < 30) lungoC = Math.min(30, mins.corsa);

    const gLungo = profilo.giornoLungo ?? 6; // 0 = lunedì
    // lungo di bici nel weekend se c'è tempo, altrimenti nel giorno libero con più minuti; senza corsa prende il giorno del lungo
    const gLungoBici = !mins.corsa && D.minutiGiorno[gLungo] > 0 ? gLungo
      : [gLungo === 6 ? 5 : 6, 6, 5, 4, 3, 2, 1, 0].find((g) => g !== gLungo && D.minutiGiorno[g] > 0) ?? (gLungo === 6 ? 5 : 6);

    // lungo di bici: 40% del tempo di bici, crescita max +15' a settimana fino al lungo che serve per la gara, dentro il suo giorno
    const capB = LMAX.bici || 9999;
    let lungoB = Math.min(mins.bici * 0.42, scaricoSett || lungoBici >= capB ? lungoBici : Math.min(capB, lungoBici + 15));
    if (D.minutiGiorno[gLungoBici] > 0) lungoB = Math.min(lungoB, D.minutiGiorno[gLungoBici]);
    if (!scaricoSett && fase !== "gara") lungoBici = Math.max(lungoBici, lungoB);
    if (scaricoSett) lungoB *= 0.75;

    // ---- sedute
    const sedute = []; // {giorno, ...seduta}
    const push = (g, s) => sedute.push({ giorno: g, ...s });
    let piscina = profilo.piscinaGiorni || [0, 2, 4];
    // chi fa solo nuoto: il lungo in acqua nel giorno del lungo, se è un giorno di piscina
    if (solo === "nuoto" && piscina.includes(gLungo)) piscina = [gLungo, ...piscina.filter((g) => g !== gLungo)];
    const nQ = (sp) => qual.filter((x) => x === sp).length;
    const giornoLibero = (pref, evita, obbligatorio) => pref.find((g) => D.minutiGiorno[g] > 0 && !evita.includes(g)) ?? (obbligatorio ? pref.find((g) => D.minutiGiorno[g] > 0) ?? pref[0] : null);
    // chi fa un solo sport: le uscite facili il più distanti possibile dal lungo, dalle qualità e tra loro
    const distanziati = (n, occupati, pref) => {
      const out = [];
      const d = (g) => [...occupati, ...out].map((o) => Math.min(Math.abs(o - g), 7 - Math.abs(o - g)));
      const dist = (g) => Math.min(7, ...d(g)), somma = (g) => d(g).reduce((t, x) => t + x, 0);
      for (let i = 0; i < n; i++) {
        const c = pref.filter((g) => !occupati.includes(g) && !out.includes(g) && D.minutiGiorno[g] > 0).sort((a, b) => dist(b) - dist(a) || somma(b) - somma(a) || pref.indexOf(a) - pref.indexOf(b));
        if (!c.length) break;
        out.push(c[0]);
      }
      return out;
    };

    // corsa
    if (mins.corsa > 0) {
      push(gLungo, seduta("corsa", "lungo", lungoC, fase, k));
      let resto = mins.corsa - lungoC;
      let tipoQ = fase === "base" ? "soglia" : fase === "picco" ? (w % 2 ? "soglia" : "vo2") : fase === "gara" ? "soglia" : (w % 2 ? "vo2" : "soglia");
      if (lunga && tipoQ === "vo2") tipoQ = "tempo";
      const giorniQ = [];
      // giorni di qualità: martedì e giovedì; per chi fa uno o due sport, se non sono liberi, i primi giorni liberi non vicini al lungo né tra loro
      const gq1 = !parz ? 1 : giornoLibero([1, 2, 3, 0, 4], [gLungo, gLungo - 1], true);
      const gq2 = !parz ? 3 : giornoLibero([3, 4, 2, 0, 1], [gLungo, gLungo - 1, gq1 - 1, gq1, gq1 + 1]); // nessun giorno adatto: la seconda qualità salta
      if (nQ("corsa") >= 1) { const s = seduta("corsa", tipoQ, 0, fase, scaricoSett ? 0 : k, D.minutiGiorno[gq1]); push(gq1, s); giorniQ.push(gq1); resto -= s.min; }
      if (nQ("corsa") >= 2 && gq2 !== null) {
        const t2 = tipoQ === "soglia" ? (lunga ? "tempo" : "vo2") : "soglia";
        const s = seduta("corsa", t2, 0, fase, k, D.minutiGiorno[gq2]); push(gq2, s); giorniQ.push(gq2); resto -= s.min;
      }
      if (ingresso && w === 0) { const s = seduta("corsa", "test", 0, fase, 0); push(gq1, s); giorniQ.push(gq1); resto -= s.min; }
      // facili: mai più lunghe del lungo. Chi fa solo corsa: quante servono per stare nel tempo, da 3 a 6 uscite in tutto
      // (sempre almeno un giorno di riposo)
      const capF = !parz && !D.oreDichiarate ? 999 : Math.max(REGOLE.minSeduta + 10, Math.min(lungoC, solo === "corsa" ? (lunga ? 90 : REGOLE.sedutaFacileMax) : 999));
      const maxUscite = (L.ctl || 0) < 20 ? 4 : (L.ctl || 0) < 35 ? 5 : 6; // chi parte da poca fitness corre meno spesso
      const nFacili = solo === "corsa"
        ? Math.max(1, 3 - 1 - giorniQ.length, Math.min(maxUscite - 1 - giorniQ.length, Math.ceil(resto / capF)))
        : Math.max(1, Math.min(3, Math.max(Math.round(resto / 40), parz || D.oreDichiarate ? Math.ceil(resto / capF) : 0)));
      const giorniFacili = solo === "corsa" ? distanziati(nFacili, [gLungo, ...giorniQ], [3, 4, 2, 0, 5, 6, 1]) : [3, 4, 2, 0, 5, 6].filter((g) => g !== gLungo && !giorniQ.includes(g)).slice(0, nFacili);
      giorniFacili.forEach((g, i) => { const m = Math.max(REGOLE.minSeduta + 5, Math.min(capF, resto / giorniFacili.length)); push(g, seduta("corsa", i === 0 && fase !== "gara" ? "allunghi" : "facile", m, fase, k)); });
    }
    // bici
    if (mins.bici > 0) {
      push(gLungoBici, seduta("bici", "lungo", Math.max(60, lungoB), fase, k));
      let resto = mins.bici - Math.max(60, lungoB);
      const giorniQ = [];
      const occ = sedute.filter((x) => x.qualita || x.tipo === "lungo").map((x) => x.giorno);
      const gb1 = !parz ? 3 : giornoLibero([3, 2, 4, 1, 0, 5], [gLungoBici, ...occ], true);
      const gb2 = !parz ? 1 : giornoLibero([1, 0, 2, 4, 5], [gLungoBici, ...occ, gb1 - 1, gb1, gb1 + 1]);
      if (nQ("bici") >= 1) { const t1 = fase === "costruzione" && w === 0 ? "tempo" : "soglia"; const s = seduta("bici", t1, 0, fase, scaricoSett ? 0 : k, D.minutiGiorno[gb1]); push(gb1, s); giorniQ.push(gb1); resto -= s.min;
        if (nQ("bici") >= 2 && gb2 !== null) { const s2 = seduta("bici", t1 === "soglia" ? "tempo" : "soglia", 0, fase, k, D.minutiGiorno[gb2]); push(gb2, s2); giorniQ.push(gb2); resto -= s2.min; } }
      // le uscite facili restano più corte del lungo: se il tempo avanza diventano tre (quattro per chi fa solo bici)
      const lungoEff = Math.max(60, lungoB);
      const maxFacile = Math.max(30, Math.min(lungoEff - 10, solo === "bici" ? REGOLE.uscitaFacileMax : 999));
      const maxN = solo === "bici" ? Math.max(1, Math.min(4, 5 - giorniQ.length)) : 3; // chi fa solo bici: al massimo 6 uscite, un giorno di riposo
      const n = Math.max(1, Math.min(maxN, Math.max(Math.min(2, Math.round(resto / 60)), Math.ceil(resto / maxFacile))));
      const giorniB = solo === "bici" ? distanziati(n, [gLungoBici, ...giorniQ], [2, 4, 0, 5, 6, 1, 3]) : parz ? [2, 4, 0, 5, 6, 1].filter((g) => g !== gLungoBici && !giorniQ.includes(g)).slice(0, n) : [2, 4, 0].slice(0, n);
      giorniB.forEach((g) => push(g, seduta("bici", "facile", Math.max(30, Math.min(maxFacile, resto / giorniB.length)), fase, k)));
    }
    // nuoto
    if (mins.nuoto > 0) {
      // chi fa solo nuoto: fino a 5 sedute (una per giorno di piscina), non più lunghe di 100'
      const n = solo === "nuoto" ? Math.min(piscina.length, Math.max(2, Math.min(5, Math.ceil(mins.nuoto / 75)))) : Math.min(piscina.length, mins.nuoto < 100 ? 2 : 3);
      const giorni = piscina.slice(0, n);
      const per = mins.nuoto / n;
      const facileN = fase === "base" || ingresso;
      const testCSS = ingresso || !!(profilo.test && profilo.test.css); // CSS sconosciuto (nessuna nuotata): test 400 + 200 nella prima settimana
      const iTest = giorni.length > 1 || !(profilo.test && profilo.test.css) ? 1 : 0; // con una sola nuotata il test prende il suo posto
      giorni.forEach((g, i) => {
        let t = testCSS && w === 0 && i === iTest ? "test" : i === 0 ? "lungo" : i === 1 ? (facileN ? (solo === "nuoto" && !ingresso ? "tempo" : "tecnica") : "tempo") : i === 2 ? (facileN ? "tecnica" : solo === "nuoto" ? "tecnica" : "soglia") : i === 3 ? (facileN || scaricoSett ? "tecnica" : "soglia") : "tecnica";
        let m = Math.max(30, i === 0 ? per * 1.2 : per * 0.9);
        if (solo === "nuoto") m = Math.min(m, REGOLE.sedutaNuotoMax + (i === 0 ? 20 : 0));
        if (parz && D.minutiGiorno[g] > 0) m = Math.max(REGOLE.minSeduta + 10, Math.min(m, D.minutiGiorno[g]));
        push(g, seduta("nuoto", t, m, fase, k));
      });
      // due qualità di nuoto in giorni consecutivi: la seconda diventa tecnica
      const qn = !parz ? [] : sedute.filter((s) => s.sport === "nuoto" && s.qualita && s.tipo !== "test").sort((a, b) => a.giorno - b.giorno);
      for (let i = 1; i < qn.length; i++) if (qn[i].giorno - qn[i - 1].giorno === 1 && qn[i - 1].qualita) Object.assign(qn[i], seduta("nuoto", "tecnica", qn[i].min, fase, k));
    }
    // palestra: gambe solo lontano dalla qualità di corsa
    if (nPal) {
      const gQ = sedute.filter((s) => s.sport === "corsa" && s.qualita).map((s) => s.giorno);
      const giorniPal = profilo.palestraGiorni || [0, 4];
      const lontano = (g) => gQ.every((q) => Math.abs(q - g) > 1);
      const gambe = giorniPal.find(lontano);
      giorniPal.slice(0, nPal).forEach((g, i) => {
        const t = g === gambe && i === giorniPal.indexOf(gambe) ? "gambe" : "alto";
        push(g, seduta("forza", t, REGOLE.palestraMin, fase, k));
      });
      if (gambe === undefined) avvisi.push(`Settimana ${w + 1}: nessun giorno di palestra lontano dalla qualità di corsa, forza solo parte alta.`);
    }

    // collocazione: ogni giorno entro i minuti disponibili, rispettando i vincoli
    const cap = (g) => D.minutiGiorno[g];
    const usato = (g) => sedute.filter((s) => s.giorno === g).reduce((t, s) => t + s.min, 0);
    const libero = (g) => cap(g) - usato(g);
    const qualGiorni = (sp) => sedute.filter((s) => s.qualita && s.sport === sp).map((s) => s.giorno);
    const ammesso = (s, g) => {
      if (cap(g) <= 0) return false;
      if (s.sport === "nuoto" && !piscina.includes(g)) return false;
      if (s.sport === "forza") return (profilo.palestraGiorni || [0, 4]).includes(g) && !sedute.some((x) => x !== s && x.giorno === g && x.sport === "forza");
      if (sedute.some((x) => x !== s && x.giorno === g && x.sport === s.sport)) return false; // una seduta per sport al giorno
      if (s.qualita) {
        if (qualGiorni(s.sport).some((q) => q !== s.giorno && Math.abs(q - g) <= 1)) return false;
        if ((parz || D.oreDichiarate) && sedute.some((x) => x !== s && x.giorno === g && x.tipo === "lungo" && x.sport !== "nuoto")) return false; // niente qualità nel giorno di un lungo di corsa o bici
        if (s.sport === "corsa" && g === gLungo - 1) return false;
        if (s.sport === "corsa" && sedute.some((x) => x.sport === "forza" && x.tipo === "gambe" && Math.abs(x.giorno - g) <= 1)) return false;
      }
      if (s.tipo === "lungo") return false; // i lunghi restano nel loro giorno
      return true;
    };
    // prima le qualità (scelgono il giorno migliore), poi le facili
    const ordine = sedute.slice().sort((a, b) => (b.qualita - a.qualita) || (b.min - a.min));
    for (const s of ordine) {
      if (s.tipo === "lungo" || s.sport === "gara") continue;
      if (usato(s.giorno) <= cap(s.giorno) && cap(s.giorno) > 0 && !sedute.some((x) => x !== s && x.giorno === s.giorno && x.sport === s.sport)) continue;
      const dest = [0, 1, 2, 3, 4, 5, 6].filter((g) => g !== s.giorno && ammesso(s, g)).sort((a, b) => libero(b) - libero(a))[0];
      if (dest !== undefined && libero(dest) >= Math.min(s.min, REGOLE.minSeduta + 10)) s.giorno = dest;
    }
    // ciò che ancora sfora: accorcia (qualità con meno ripetute, facili più brevi), poi elimina le facili in eccesso
    for (let g = 0; g < 7; g++) {
      let guardia = 0;
      while (usato(g) > cap(g) + 5 && guardia++ < 20) {
        const qs = sedute.find((s) => s.giorno === g && s.qualita && s.tipo !== "test");
        const altri = usato(g) - (qs ? qs.min : 0);
        if (qs && qs.min > cap(g) - altri) {
          const nuova = seduta(qs.sport, qs.tipo, qs.min, fase, 0, Math.max(30, cap(g) - altri));
          if (nuova.min < qs.min) { Object.assign(qs, nuova); continue; }
        }
        const facile = sedute.filter((s) => s.giorno === g && !s.qualita && s.tipo !== "lungo").sort((a, b) => b.min - a.min)[0];
        if (!facile) break;
        const eccesso = usato(g) - cap(g);
        if (facile.min - eccesso >= REGOLE.minSeduta + 5) facile.min = r5(facile.min - eccesso);
        else if (facile.min > REGOLE.minSeduta + 5) facile.min = REGOLE.minSeduta + 5;
        else {
          const dest = [0, 1, 2, 3, 4, 5, 6].filter((x) => x !== g && ammesso(facile, x) && libero(x) >= facile.min)[0];
          if (dest !== undefined) facile.giorno = dest; else sedute.splice(sedute.indexOf(facile), 1);
        }
      }
      if (usato(g) > cap(g) + 5) avvisi.push(`Settimana ${w + 1}, ${GIORNI[g]}: ${usato(g)}' pianificati oltre i ${cap(g)}' disponibili.`);
    }

    // gara nella settimana
    if (gara && gara >= lun && gara < addDays(lun, 7)) {
      const g = (gara.getDay() + 6) % 7;
      for (let i = sedute.length - 1; i >= 0; i--) if (sedute[i].giorno >= g - 1 && sedute[i].giorno <= g) sedute.splice(i, 1);
      push(g, { sport: "gara", tipo: "gara", nome: `Gara · ${tipo}`, min: 0, passi: [], qualita: false, carico: 0, minQualita: 0 });
    }

    // tetti: volume della settimana e quota di qualità (le durate minime non devono sforare)
    const tetto = Math.min(D.oreMax * 60, Math.max(T, mins.nuoto + mins.bici + mins.corsa + palestraMin) * 1.05); // il volume protetto dello sport abituale conta nel tetto
    const tot = () => sedute.reduce((t, s) => t + s.min, 0);
    const priorita = (s) => (s.qualita || s.tipo === "lungo" || s.sport === "gara" ? 99 : s.sport === "forza" ? 3 : s.sport === "bici" ? 1 : s.sport === "corsa" ? 2 : 4);
    // il lungo di corsa abituale non si accorcia per far posto agli sport nuovi (salvo rientro): si taglia prima il resto
    const lungoAbituale = L.rientro && L.rientro.corsa ? 30 : Math.max(30, Math.min(lungoC, (L.lungoCorsaMin || 0) * 0.8));
    const minLungo = (s) => (s.sport === "bici" ? 45 : s.sport === "corsa" ? r5(lungoAbituale) : 30);
    let guard = 0;
    while (tot() > tetto && guard++ < 60) {
      const facili = sedute.filter((s) => priorita(s) < 99).sort((a, b) => priorita(a) - priorita(b) || b.min - a.min);
      if (!facili.length) {
        const lunghi = sedute.filter((s) => s.tipo === "lungo" && s.min > minLungo(s)).sort((a, b) => (b.min - minLungo(b)) - (a.min - minLungo(a)));
        if (!lunghi.length) break;
        lunghi[0].min = r5(lunghi[0].min - 5); continue;
      }
      const f = facili[0];
      const eccesso = tot() - tetto;
      if (f.min - eccesso >= REGOLE.minSeduta + 5) f.min = r5(f.min - eccesso);
      else if (f.sport === "forza" || sedute.filter((s) => s.sport === f.sport).length > (f.sport === solo ? 3 : 2)) sedute.splice(sedute.indexOf(f), 1); // chi fa un solo sport tiene almeno 3 sedute
      else {
        // prima di scendere sotto 2 sedute per sport, accorcia i lunghi
        const lungo = sedute.filter((s) => s.tipo === "lungo" && s.min > minLungo(s)).sort((a, b) => (b.min - minLungo(b)) - (a.min - minLungo(a)))[0];
        if (lungo) { lungo.min = r5(lungo.min - 5); continue; }
        if (f.min > REGOLE.minSeduta + 5) { f.min = r5(f.min - 5); continue; }
        sedute.splice(sedute.indexOf(f), 1);
      }
    }
    const qmin = () => sedute.reduce((t, s) => t + (s.minQualita || 0), 0);
    for (const sp of solo ? ["bici", "corsa", "bici", "corsa"] : ["bici", "corsa"]) { // due giri: chi fa un solo sport può avere due qualità
      if (qmin() <= tot() * REGOLE.quotaQualitaMax) break;
      const q = sedute.find((s) => s.qualita && s.sport === sp && (!solo || s.tipo !== "test"));
      if (q) { const lb = sedute.find((x) => x.sport === sp && x.tipo === "lungo"); const m = lb ? Math.min(q.min, Math.max(30, lb.min - 10)) : q.min; const nuova = seduta(sp, sp === "corsa" ? "allunghi" : "facile", m, fase, k); Object.assign(q, nuova); avvisi.push(`Settimana ${w + 1}: qualità di ${sp} trasformata in seduta facile per restare nell'80/20 con poche ore.`); }
    }

    // le sedute accorciate o allungate dopo la creazione: nome e passi rifatti sulla durata finale
    for (const s of sedute) if (!s.qualita && ["corsa", "bici", "nuoto"].includes(s.sport) && ["facile", "allunghi", "lungo", "tecnica"].includes(s.tipo)) Object.assign(s, seduta(s.sport, s.tipo, s.min, fase, k), { giorno: s.giorno });
    // ricalcolo carico e fitness giorno per giorno
    for (const s of sedute) if (s.sport !== "gara") { const ifk = s.qualita ? (s.tipo === "vo2" ? "vo2" : s.tipo === "tempo" ? "tempo" : "soglia") : s.sport === "forza" ? "forza" : s.tipo === "lungo" ? "lungo" : "facile"; s.carico = Math.round((s.min / 60) * REGOLE.IF[ifk] ** 2 * 100); }
    const ctl0 = ctl;
    for (let g = 0; g < 7; g++) {
      const load = sedute.filter((s) => s.giorno === g).reduce((t, s) => t + s.carico, 0);
      ctl += (load - ctl) / 42; atl += (load - atl) / 7;
    }
    const vol = sedute.reduce((t, s) => t + s.min, 0);
    sedute.sort((a, b) => a.giorno - b.giorno || (b.qualita - a.qualita));
    settimane.push({
      n: w + 1, lunedi: ymd(lun), fase, scarico: scaricoSett, settAllaGara: settGara,
      minuti: vol, carico: sedute.reduce((t, s) => t + s.carico, 0),
      minQualita: sedute.reduce((t, s) => t + (s.minQualita || 0), 0),
      perSport: ["nuoto", "bici", "corsa", "forza"].reduce((o, sp) => (o[sp] = sedute.filter((s) => s.sport === sp).reduce((t, s) => t + s.min, 0), o), {}),
      ctlFine: +ctl.toFixed(1), atlFine: +atl.toFixed(1), ramp: +(ctl - ctl0).toFixed(1),
      lungoCorsa: (sedute.find((s) => s.sport === "corsa" && s.tipo === "lungo") || {}).min || 0,
      sedute: sedute.map((s) => ({ ...s, data: ymd(addDays(lun, s.giorno)), giornoNome: GIORNI[s.giorno] })),
    });
    volPrec = vol;
  }
  return { inizio: ymd(inizio), tipo, settimane, avvisi, ctlInizio: L.ctl };
}

// <<< GENERATORE

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

  return { generaBlocco, REGOLE, seduta, normalizza, profiloAl, settimanaReale };
})();

// ------------------------------------------------------------
//  Profilo della persona: hud-profilo.json in iCloud › Scriptable
// ------------------------------------------------------------
const PROFILO_FILE = "hud-profilo.json";
let PROF = null;

function profiloFM() { try { const fm = FileManager.iCloud(); fm.documentsDirectory(); return fm; } catch (e) { return FileManager.local(); } }
async function leggiProfilo() {
  const fm = profiloFM(), p = fm.joinPath(fm.documentsDirectory(), PROFILO_FILE);
  if (!fm.fileExists(p)) return null;
  try {
    if (fm.isFileStoredIniCloud && fm.isFileStoredIniCloud(p) && !fm.isFileDownloaded(p)) await fm.downloadFileFromiCloud(p);
    return JSON.parse(fm.readString(p));
  } catch (e) {
    // file rovinato: ne tengo una copia, così il piano già scritto si può recuperare
    console.log("Profilo non leggibile: " + e);
    try { fm.writeString(fm.joinPath(fm.documentsDirectory(), `hud-profilo-copia-${Date.now()}.json`), fm.readString(p) || ""); } catch (e2) {}
    return null;
  }
}
function scriviProfilo(P) { const fm = profiloFM(); fm.writeString(fm.joinPath(fm.documentsDirectory(), PROFILO_FILE), JSON.stringify(P, null, 2)); }

const unisci = (dst, src) => {
  for (const k of Object.keys(src || {})) {
    const v = src[k];
    if (v && typeof v === "object" && !Array.isArray(v) && dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) unisci(dst[k], v);
    else dst[k] = v;
  }
  return dst;
};

// Porta le risposte della configurazione dentro CONFIG
function applicaProfilo(P) {
  PROF = P || null;
  if (!P) return;
  const G = P.gara;
  CONFIG.sport = sportDi(P);
  const tipoG = (G && G.tipo) || ((GARE[chiaveSport(CONFIG.sport)] || [[null]])[0][0]) || "70.3";
  CONFIG.obiettivo = G && G.data ? { nome: G.nome || "La tua gara", data: G.data, tipo: tipoG, ctlGara: G.ctlGara || ctlGaraDi(tipoG) || 60, traiettoria: [] } : null;
  const C = P.corpo || {};
  CONFIG.peso = C.peso && C.pesoObiettivo ? { partenza: C.peso, obiettivo: C.pesoObiettivo } : null;
  const S = P.soglie || {};
  if (S.lthr) CONFIG.corsa.lthr = S.lthr;
  if (S.fcMax) CONFIG.corsa.fcMax = S.fcMax;
  if (S.passoSoglia) CONFIG.corsa.passoSoglia = S.passoSoglia;
  if (S.css) CONFIG.nuoto.css = S.css;
  if (S.ftp) CONFIG.bici.ftp = S.ftp;
  if (S.sogliaFCBici) CONFIG.bici.sogliaFC = S.sogliaFCBici;
  unisci(CONFIG, P.config || {}); // impostazioni avanzate, per esempio un piano alimentare personale
  CONFIG.soglieFissate = Object.keys(P.soglie || {}).filter((k) => P.soglie[k] != null); // queste le gestisce la persona; le altre l'app
  if (P.pianoApp === false) CONFIG.soglieAutomatiche = false; // ha già il suo piano: l'app legge e basta, su Intervals non scrive niente
}

// Le soglie che mancano si leggono dalle attività di Intervals (le più recenti), altrimenti valori prudenti
// Le soglie impostate oggi su Intervals, per sport: dalle impostazioni dell'atleta, altrimenti dall'ultima attività
function attualiDa(raw) {
  const imp = Array.isArray(raw.impostazioni) ? raw.impostazioni : [];
  const acts = (raw.activities || []).filter((a) => a && a.start_date_local).sort((a, b) => b.start_date_local.localeCompare(a.start_date_local));
  const da = (sp, f) => { for (const a of acts) if (sportOf(a.type) === sp) { const v = num(a[f]); if (v) return v; } return null; };
  const per = (tipo, sp) => {
    const x = imp.find((s) => (s.types || []).includes(tipo));
    const r = x ? { lthr: num(x.lthr), max_hr: num(x.max_hr), threshold_pace: num(x.threshold_pace), ftp: num(x.ftp) }
      : { lthr: da(sp, "lthr"), max_hr: da(sp, "athlete_max_hr"), threshold_pace: da(sp, "threshold_pace"), ftp: da(sp, "icu_ftp") };
    // velocità di soglia plausibili (m/s): un valore salvato in altre unità vale come mancante
    if (r.threshold_pace && (sp === "nuoto" ? r.threshold_pace <= 0.4 || r.threshold_pace >= 2.5 : r.threshold_pace >= 7)) r.threshold_pace = null;
    return r;
  };
  return { corsa: per("Run", "corsa"), bici: per("Ride", "bici"), nuoto: per("Swim", "nuoto") };
}

// Soglie automatiche: le stime migliori vanno su Intervals da sole (scelta di prodotto), tranne i valori fissati nel profilo.
// Ogni cambio resta nel profilo (soglieAuto.storia), così si può sempre vedere cosa è cambiato e quando.
const CAMPO_PROFILO = { "Run.lthr": "lthr", "Run.max_hr": "fcMax", "Ride.max_hr": "fcMax", "Run.threshold_pace": "passoSoglia", "Swim.threshold_pace": "css", "Ride.lthr": "sogliaFCBici", "Ride.ftp": "ftp" };
// Gli sport di Intervals che condividono le stesse soglie (ognuno può avere una sua voce nelle impostazioni)
const TIPI_SOGLIE = { Run: ["Run", "TrailRun", "VirtualRun"], Ride: ["Ride", "VirtualRide", "GravelRide", "MountainBikeRide"], Swim: ["Swim", "OpenWaterSwim"] };
async function aggiornaSoglie(key, raw, now) {
  // solo con la configurazione fatta (così ogni cambio resta nella storia) e con le impostazioni vere di Intervals
  if (!CONFIG.soglieAutomatiche || !key || !PROF || raw.demo || raw.stale || !Array.isArray(raw.impostazioni) || !raw.impostazioni.length) return [];
  const fissate = (PROF && PROF.soglie) || {};
  const SA = PROF.soglieAuto || {}, scritti = SA.scritti || {}, bloccati = new Set(SA.bloccati || []);
  const AT = attualiDa(raw), attuale = (c) => (AT[{ Run: "corsa", Ride: "bici", Swim: "nuoto" }[c.tipo]] || {})[c.campo];
  // se un valore scritto dall'app è stato cambiato a mano su Intervals, quel campo non si tocca più
  for (const k of Object.keys(scritti)) {
    const [tipo, campo] = k.split("."), ora = attuale({ tipo, campo });
    if (ora != null && Math.abs(ora - scritti[k]) > (campo === "threshold_pace" ? 0.005 : 1)) bloccati.add(k);
  }
  const st = stimaSoglie(raw, now, AT);
  const cambi = st.cambi.filter((c) => !fissate[CAMPO_PROFILO[c.tipo + "." + c.campo]] && !bloccati.has(c.tipo + "." + c.campo)
    && raw.impostazioni.some((x) => (x.types || []).some((t) => TIPI_SOGLIE[c.tipo].includes(t))));
  const fatti = [];
  await Promise.all(["Run", "Ride", "Swim"].map(async (tipo) => {
    const cc = cambi.filter((c) => c.tipo === tipo);
    if (!cc.length) return;
    const corpo = {}; for (const c of cc) corpo[c.campo] = c.campo === "threshold_pace" ? Math.round(c.a * 10000) / 10000 : Math.round(c.a);
    const voci = raw.impostazioni.filter((x) => (x.types || []).some((t) => TIPI_SOGLIE[tipo].includes(t)));
    let ok = false;
    for (const x of voci) {
      try {
        await ivRichiesta(key, "PUT", `/sport-settings/${x.id != null ? x.id : tipo}?recalcHrZones=true`, corpo, 15);
        Object.assign(x, corpo); ok = true; // le impostazioni in memoria seguono subito: pagina e piano usano i valori nuovi
      } catch (e) { console.log(`Soglie di ${tipo} non aggiornate su Intervals: ${e.message || e}`); }
    }
    if (ok) fatti.push(...cc);
  }));
  if (bloccati.size !== (SA.bloccati || []).length || fatti.length) {
    for (const c of fatti) scritti[c.tipo + "." + c.campo] = c.campo === "threshold_pace" ? Math.round(c.a * 10000) / 10000 : Math.round(c.a);
    const voce = fatti.length ? { data: now.toISOString(), cambi: fatti.filter((c) => c.testo).map((c) => ({ tipo: c.tipo, campo: c.campo, da: c.da, a: c.a, testo: c.testo })) } : null;
    PROF.soglieAuto = { ...SA, scritti, bloccati: [...bloccati], ...(voce ? { ultimo: voce, storia: [...(SA.storia || []), voce].slice(-20) } : {}) };
    try { scriviProfilo(PROF); } catch (e) {}
  }
  return fatti;
}

// Dopo un aggiornamento automatico CONFIG riprende i valori da Intervals (quelli fissati nel profilo restano)
function completaSoglieDi(raw) {
  const fisse = CONFIG.soglieFissate || [];
  if (!fisse.includes("lthr")) CONFIG.corsa.lthr = null;
  if (!fisse.includes("fcMax")) CONFIG.corsa.fcMax = null;
  if (!fisse.includes("passoSoglia")) CONFIG.corsa.passoSoglia = null;
  if (!fisse.includes("css")) CONFIG.nuoto.css = null;
  if (!fisse.includes("sogliaFCBici")) CONFIG.bici.sogliaFC = null;
  if (!fisse.includes("ftp")) CONFIG.bici.ftp = null;
  completaSoglie(raw);
}
function completaSoglie(raw) {
  const acts = (raw.activities || []).filter((a) => a && a.start_date_local).sort((a, b) => b.start_date_local.localeCompare(a.start_date_local));
  const AT = attualiDa(raw);
  const C = CONFIG;
  if (C.corsa.lthr == null) C.corsa.lthr = AT.corsa.lthr || AT.bici.lthr || 170;
  if (C.corsa.fcMax == null) C.corsa.fcMax = AT.corsa.max_hr || AT.bici.max_hr || C.corsa.lthr + 17;
  if (C.corsa.passoSoglia == null) C.corsa.passoSoglia = AT.corsa.threshold_pace ? fmtPace(1000 / AT.corsa.threshold_pace) : "5:30";
  if (C.nuoto.css == null) C.nuoto.css = AT.nuoto.threshold_pace ? fmtPace(100 / AT.nuoto.threshold_pace) : "2:00";
  if (C.bici.sogliaFC == null) C.bici.sogliaFC = AT.bici.lthr || Math.round(C.corsa.lthr * 0.95);
  const da = (sp, f) => { for (const a of acts) if (!sp || sportOf(a.type) === sp) { const v = num(a[f]); if (v) return v; } return null; };
  // FTP solo se le uscite hanno davvero la potenza: Intervals tiene una FTP di default anche senza misuratore
  const conPotenza = acts.filter((a) => sportOf(a.type) === "bici" && (a.device_watts === true || (num(a.icu_average_watts) || 0) > 0)).length >= 2;
  if (C.bici.ftp == null) C.bici.ftp = conPotenza ? da("bici", "icu_ftp") : null;
  C.bici.potenza = conPotenza || !!(PROF && PROF.soglie && PROF.soglie.ftp);
}

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
function inizioBlocco(now, P, prossimo) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lunedi = ymd(d.getDay() === 1 ? d : addDays(d, (8 - d.getDay()) % 7));
  if (prossimo && P.piano && P.piano.fine) {
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

function creaPiano(P, raw, now, prossimo) {
  const inizio = inizioBlocco(now, P, prossimo);
  if (P.soloPalestra) {
    const indice = P.piano ? (P.piano.indice || 0) + (prossimo ? 1 : 0) : 0;
    const piano = pianoPalestra(P, inizio, indice), w0 = piano.settimane[0];
    return { inizio, fine: ymd(addDays(parseYMD(inizio), 27)), indice, piano, livello: { ctl: 0, oreSett: 0, lungoCorsaMin: 0, lungoBiciMin: 0, rientro: null },
      palestra: { n: w0.sedute.length, min: w0.sedute[0] ? w0.sedute[0].min : 45, attrezzi: w0.sedute[0] ? w0.sedute[0].attrezzi : "manubri" },
      timbro: Date.now().toString(36) + Math.random().toString(36).slice(2, 5) };
  }
  const D = GEN.normalizza(raw);
  const prof = GEN.profiloAl(D, inizio, baseGeneratore(P, raw, now));
  const indice = P.piano ? (P.piano.indice || 0) + (prossimo ? 1 : 0) : 0;
  const piano = GEN.generaBlocco(prof, { inizio, indiceBlocco: indice });
  // timbro della scrittura: ogni versione del piano ha codici nuovi, così le vecchie si tolgono senza ambiguità
  return { inizio, fine: ymd(addDays(parseYMD(inizio), 27)), indice, piano, livello: prof.livello, timbro: Date.now().toString(36) + Math.random().toString(36).slice(2, 5) };
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
    if (s.sport === "gara" || !s.min) return;
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
  return {
    inizio: res.inizio, fine: res.fine, avvisi: res.piano.avvisi || [], conflitti: conflitti || 0, palestra: res.palestra || null,
    sport: CONFIG.sport,
    livello: { ctl: res.livello.ctl, ore: res.livello.oreSett, lungo: res.livello.lungoCorsaMin, lungoBici: res.livello.lungoBiciMin, rientro: CONFIG.sport.includes("corsa") && !!(res.livello.rientro && res.livello.rientro.corsa) },
    settimane: res.piano.settimane.map((w) => ({ n: w.n, lunedi: w.lunedi, fase: w.fase, scarico: w.scarico, minuti: w.minuti, lungo: w.lungoCorsa,
      sedute: w.sedute.filter((s) => s.sport !== "gara" && s.min).map((s) => ({ g: s.giorno, sport: s.sport, nome: s.nome, min: s.min, q: !!s.qualita })) })),
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
  const ev = await ivRichiesta(key, "GET", `/events?oldest=${res.inizio}&newest=${res.fine}`);
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
    if (corrente) opz = { oggi, corrente, dal: P.piano && tim(P.piano.ids || []) === corrente && P.piano.inizio ? P.piano.inizio : null };
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
  P.pianoPendente = { ids: nuovi, inizio: res.inizio };
  scriviProfilo(P);
  await ivRichiesta(key, "POST", "/events/bulk?upsert=true", ev, 120);
  // poi tolgo dal calendario le sedute dell'app che il piano nuovo sostituisce (dal suo primo giorno, mai prima di oggi)
  const dal = res.inizio > oggi ? res.inizio : oggi;
  let tolte = 0;
  try {
    const cal = await ivRichiesta(key, "GET", `/events?oldest=${dal}&newest=${ymd(addDays(parseYMD(dal), 140))}`);
    tolte = await togliSedute(key, seduteDaTogliere(cal, { oggi: dal, dal, tieni: new Set(nuovi) }));
  } catch (e) { registro("Vecchie sedute non tolte: " + (e.message || e)); }
  if (tolte) registro(`piano riscritto: tolte ${tolte} sedute vecchie dell'app`);
  const restano = [...new Set([...((P.piano && P.piano.ids) || [])])].filter((id) => String(id).startsWith("hud-") && String(id).slice(4, 14) < dal && !nuovi.includes(id)).slice(-300);
  P.piano = { inizio: res.inizio, fine: res.fine, indice: res.indice, ids: [...restano, ...nuovi], scritto: now.toISOString() };
  delete P.pianoPendente;
  scriviProfilo(P);
  return ev.length;
}

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

// ------------------------------------------------------------
//  Rifornimento sull'orologio
//  Per ogni lungo: cosa prendere e quando. Gli orari finiscono nella seduta su Intervals: il passo
//  viene spezzato all'ora giusta e la nota del passo nuovo dice cosa prendere ("Mangia gel e bevi").
//  A ogni cambio di passo l'orologio vibra e mostra la nota.
// ------------------------------------------------------------
const AVVISO_RE = /^(?:mangia|bevi)\b[^,]*(?:,\s*)?/i;
const r5min = (v) => Math.round(v / 5) * 5;

// Le dosi sono per tutta la durata: 150 g in 2h30 sono 60 g all'ora.
function schemaRifornimento(sport, min, RF, indoor) {
  if (!RF || !min || (sport !== "bici" && sport !== "corsa")) return null;
  const PR = CONFIG.rifornimento.prodotti || {};
  const gel = PR.gel && PR.gel.g ? PR.gel : { nome: "gel", g: 25 };
  const ex = PR.extra && PR.extra.g ? PR.extra : null;
  const I = idratazione(RF, sport, indoor);
  const voci = [];
  let gh = 0, borraccia = null;
  const distribuisci = (k, t0, t1) => Array.from({ length: k }, (_, i) => (k === 1 ? r5min((t0 + t1) / 2) : r5min(t0 + (i * (t1 - t0)) / (k - 1))));
  if (sport === "bici" && min >= 90) {
    gh = min >= 150 ? RF.gh.bici : Math.min(RF.gh.bici, 60);
    borraccia = PR.borraccia && PR.borraccia.g ? PR.borraccia : null;
    const resto = (gh * min) / 60 - (borraccia ? borraccia.g : 0);
    // quanti gel e quanti "extra" (mai più extra che gel) per arrivare più vicino ai grammi
    let best = null;
    for (let a = 1; a <= 12; a++) for (let b = 0; b <= (ex ? a : 0); b++) {
      const d = Math.abs(gel.g * a + (ex ? ex.g * b : 0) - resto);
      if (!best || d < best.d - 0.01 || (Math.abs(d - best.d) < 0.01 && a + b < best.a + best.b)) best = { a, b, d };
    }
    const k = best.a + best.b;
    const conExtra = new Set(Array.from({ length: best.b }, (_, j) => 1 + Math.floor((j * (k - 1)) / best.b)));
    distribuisci(k, 20, Math.max(20, min - 20)).forEach((t, i) => { const p = conExtra.has(i) ? ex : gel; voci.push({ t, tipo: "mangia", nome: p.nome, g: p.g }); });
  } else if (sport === "corsa" && min >= 75) {
    gh = min >= 90 ? RF.gh.corsa : Math.min(RF.gh.corsa, 45);
    const n = Math.max(1, Math.round((gh * min) / 60 / gel.g));
    distribuisci(n, 30, Math.max(30, min - 15)).forEach((t) => voci.push({ t, tipo: "mangia", nome: gel.nome, g: gel.g }));
  }
  // in bici si beve anche tra un rifornimento e l'altro; al chiuso o col caldo anche nelle uscite da un'ora
  if (sport === "bici" && min >= 60) {
    if (voci.length) {
      const punti = [...voci.map((v) => v.t), min - 10];
      for (let i = 0; i < punti.length - 1; i++) if (punti[i + 1] - punti[i] >= 25) voci.push({ t: r5min((punti[i] + punti[i + 1]) / 2), tipo: "bevi" });
    } else if (indoor || I.T >= 22) for (let t = 15; t <= min - 10; t += 20) voci.push({ t, tipo: "bevi" });
  }
  if (!voci.length) return null;
  voci.sort((a, b) => a.t - b.t);
  for (const v of voci) v.avviso = v.tipo === "bevi" ? "Bevi" : `Mangia ${v.nome}${sport === "bici" ? " e bevi" : ""}`;
  const g = voci.reduce((t, v) => t + (v.g || 0), 0) + (borraccia ? borraccia.g : 0);
  return { sport, min, gh, g, borraccia, voci, acqua: I };
}

// "gel a 20', 1h05 e 1h50 (75 g, 45 g all'ora)"
function descriviSchema(S) {
  const cibo = S.voci.filter((v) => v.tipo === "mangia");
  if (!cibo.length) return "";
  const nomi = [...new Set(cibo.map((v) => v.nome))];
  const parti = nomi.map((n) => `${n} a ${elencoIt(cibo.filter((v) => v.nome === n).map((v) => fmtMin(v.t)))}`);
  if (S.borraccia) parti.unshift(`${S.borraccia.nome} nella borraccia, a sorsi`);
  return `${parti.join(", ")} (${S.g} g di carboidrati, ${Math.round((S.g * 60) / S.min)} g all'ora)`;
}

// ---- Il testo delle sedute di Intervals: "- [nota] durata [obiettivi]"
function secDurata(tok) {
  const t = String(tok).replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  let m = /^(\d+)'(?:(\d+)")?$/.exec(t); if (m) return +m[1] * 60 + +(m[2] || 0);
  m = /^(\d+)"$/.exec(t); if (m) return +m[1];
  m = /^(\d+)h(\d+)$/i.exec(t); if (m) return +m[1] * 3600 + +m[2] * 60;
  m = /^(\d+)m(\d+)$/i.exec(t); if (m) return +m[1] * 60 + +m[2];
  m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i.exec(t);
  if (m && (m[1] || m[2] || m[3])) return Math.round(+(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0));
  return null;
}
function leggiPasso(riga) {
  const m = /^(\s*-\s*)(.*)$/.exec(riga);
  if (!m) return null;
  const corpo = m[2], re = /\S+/g;
  let t;
  while ((t = re.exec(corpo))) {
    const tok = t[0];
    if (/^\d+(?:\.\d+)?(?:km|mi|mtr|yd)$/i.test(tok)) return { pre: m[1], dist: true };
    if (/^\d+(?:\.\d+)?$/.test(tok) && /^\s*(?:km|mi|mtr|m|yd)\b/i.test(corpo.slice(re.lastIndex))) return { pre: m[1], dist: true };
    const s = secDurata(tok);
    if (s) return { pre: m[1], nota: corpo.slice(0, t.index).trim(), sec: s, resto: corpo.slice(re.lastIndex).trim() };
  }
  return { pre: m[1], vuoto: true };
}
const durTok = (s) => (s % 3600 === 0 ? `${s / 3600}h` : s % 60 === 0 ? `${s / 60}m` : s > 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`);
const rigaPasso = (p) => `${p.pre.replace(/-\s*$/, "- ")}${p.nota ? p.nota + " " : ""}${durTok(p.sec)}${p.resto ? " " + p.resto : ""}`;
const RIP_RE = /(?:^|\s)\d+\s*x$/i;

// Toglie gli avvisi scritti dall'HUD e ricuce i passi spezzati
function rimuoviAvvisi(testo) {
  const out = [];
  let prev = null, inRip = false;
  for (const r of String(testo).split("\n")) {
    if (!r.trim()) { out.push(r); prev = null; inRip = false; continue; }
    const p = leggiPasso(r);
    if (!p) { out.push(r); prev = null; inRip = RIP_RE.test(r.trim()); continue; }
    if (p.sec && !inRip && AVVISO_RE.test(p.nota)) {
      const nota = p.nota.replace(AVVISO_RE, "").trim();
      if (!nota && prev && prev.p.resto === p.resto) { prev.p.sec += p.sec; out[prev.i] = rigaPasso(prev.p); continue; }
      const q = { ...p, nota };
      out.push(rigaPasso(q)); prev = { i: out.length - 1, p: q }; continue;
    }
    out.push(r); prev = p.sec && !inRip ? { i: out.length - 1, p: { ...p } } : null;
  }
  return out.join("\n");
}

// Spezza i passi agli orari di rifornimento. voci = [{ t (minuti dall'inizio), tipo, nome, avviso }]
function aggiungiAvvisi(testo, voci) {
  const righe = String(testo).split("\n");
  const unita = [];
  let t = 0, rip = null;
  const chiudi = () => { if (rip) { rip.t1 = rip.t0 + rip.n * rip.giro; t = rip.t1; unita.push(rip); rip = null; } };
  for (let i = 0; i < righe.length; i++) {
    const r = righe[i];
    if (!r.trim()) { chiudi(); continue; }
    const p = leggiPasso(r);
    if (!p) { chiudi(); const mr = /(?:^|\s)(\d+)\s*x$/i.exec(r.trim()); if (mr) rip = { tipo: "blocco", n: +mr[1], giro: 0, t0: t }; continue; }
    if (!p.sec) return { testo: String(testo), inseriti: [], motivo: p.dist ? "seduta a distanza" : "passo senza durata" };
    if (rip) { rip.giro += p.sec; continue; }
    unita.push({ tipo: "passo", i, p, t0: t, t1: t + p.sec, pezzi: [{ off: 0, nota: p.nota }], divisibile: !/\bramp\b/i.test(p.resto) });
    t += p.sec;
  }
  chiudi();
  const tot = t, MIN = 120, inseriti = [];
  if (!unita.some((u) => u.tipo === "passo")) return { testo: String(testo), inseriti, motivo: "nessun passo" };
  const metti = (u, off, v) => {
    let pz = u.pezzi.find((x) => x.off === off);
    if (!pz) { pz = { off, nota: "" }; u.pezzi.push(pz); u.pezzi.sort((a, b) => a.off - b.off); }
    if (!pz.av) { pz.av = v.avviso; pz.tipo = v.tipo; }
    else if (v.tipo === "mangia" && pz.tipo === "bevi") { pz.av = v.avviso; pz.tipo = "mangia"; }
    else if (v.tipo === "mangia" && pz.tipo === "mangia" && !pz.av.includes(v.nome)) pz.av = pz.av.replace(/^Mangia (\S+)/, `Mangia $1 e ${v.nome}`);
    u.cambiata = true;
    inseriti.push({ t: Math.round((u.t0 + off) / 60), tipo: v.tipo, avviso: v.avviso, nome: v.nome });
  };
  for (const v of voci) {
    const s = v.t * 60;
    if (s <= 0 || s >= tot - 180) continue;
    const k = unita.findIndex((u) => s >= u.t0 && s < u.t1);
    if (k < 0) continue;
    const u = unita[k];
    if (u.tipo === "passo" && u.divisibile && s - u.t0 >= MIN && u.t1 - s >= MIN) { metti(u, s - u.t0, v); continue; }
    if (u.tipo === "passo" && (s - u.t0 < MIN || (!u.divisibile && s - u.t0 <= u.t1 - s))) { metti(u, 0, v); continue; }
    // dentro le ripetute o alla fine di un passo: all'inizio del passo che viene dopo
    const nx = unita.slice(k + 1).find((w) => w.tipo === "passo");
    if (nx && nx.t0 < tot - 180) metti(nx, 0, v);
  }
  for (const u of unita) {
    if (!u.cambiata) continue;
    righe[u.i] = u.pezzi.map((pz, j) => {
      const fine = j + 1 < u.pezzi.length ? u.pezzi[j + 1].off : u.p.sec;
      return rigaPasso({ pre: u.p.pre, nota: pz.av ? (pz.nota ? `${pz.av}, ${pz.nota}` : pz.av) : pz.nota, sec: fine - pz.off, resto: u.p.resto });
    }).join("\n");
  }
  return { testo: righe.join("\n"), inseriti, tot };
}
// Il testo che la seduta deve avere: senza i vecchi avvisi, con quelli di oggi
function testoConAvvisi(desc, S) {
  const base = rimuoviAvvisi(desc);
  if (!S) return { testo: base, inseriti: [] };
  return aggiungiAvvisi(base, S.voci);
}
// «Z2» senza tipo diventa «Z2 HR» in ogni passo (anche nelle ripetute); i passi con HR, passo, potenza o % restano come sono
function zoneFC(testo) {
  return String(testo).split("\n").map((r) => {
    const p = leggiPasso(r);
    if (!p || !p.sec || !/\bZ\d\b/i.test(p.resto) || /\b(?:HR|LTHR|Pace|Power|bpm|FTP)\b|%|\d\s*W\b/i.test(p.resto)) return r;
    return rigaPasso({ ...p, resto: p.resto.replace(/\b(Z\d(?:-Z\d)?)\b/i, "$1 HR") });
  }).join("\n");
}
const haAvvisi = (desc) => /^\s*-\s*(?:mangia|bevi)\b/im.test(String(desc || ""));

// ------------------------------------------------------------
//  Analisi
// ------------------------------------------------------------
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
  if (hrv !== null) {
    sys.hasData = true;
    if (hrvPrev.length >= 3) {
      hrvMean = mean(hrvPrev); const s = sd(hrvPrev) || 1;
      if (hrv < hrvMean - 2 * s) { bump(sys, "rosso"); sys.reasons.push("HRV molto bassa"); }
      else if (hrv < hrvMean - s) { bump(sys, "giallo"); sys.reasons.push("HRV sotto la media"); }
    }
  }
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
    metrics: { hrv, hrvMean, rhr, rhrMean, ctl, atl, tsb, ramp: num(wToday.rampRate) },
    sleep, todayEv, tomorrowEv, domani, gymToday, weeks, ladderCheck, season,
    fitness: { hist: fit, proj },
    decoupling: longRuns.length ? num(longRuns[0].decoupling) : null, weight, lastAct,
    nutrition: { kcal, kcalActive, kcalEst, carbo, meals, chips, dayType, todayMin, proteine: nut.proteine, grassi: nut.grassi, modo: nut.modo, consumi: nut.consumi, base: nut.base, deficit: nut.deficit, piano, trend, rif, np, longToday, cibo: { lista: (dia.cibo || {})[today] || [], tot: totaleCibo((dia.cibo || {})[today] || []) } },
    durOf, fetchedAt: raw.fetchedAt, demo: !!raw.demo, stale: !!raw.stale,
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

// ------------------------------------------------------------
//  HTML (iOS, dark)
// ------------------------------------------------------------
const COL = { verde: "#30D158", giallo: "#FF9F0A", rosso: "#FF453A" };
const TINT = { verde: "rgba(48,209,88,.16)", giallo: "rgba(255,159,10,.16)", rosso: "rgba(255,69,58,.18)" };
const SPORT = {
  nuoto: { c: "#0A84FF", t: "rgba(10,132,255,.18)", label: "Nuoto", icon: '<path d="M2 15c2 0 2-1.5 4-1.5S8 15 10 15s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M2 19c2 0 2-1.5 4-1.5S8 19 10 19s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><circle cx="15" cy="6" r="2"/><path d="M6 11l4-4 3 3"/>' },
  corsa: { c: "#FFD60A", t: "rgba(255,214,10,.14)", label: "Corsa", icon: '<circle cx="14" cy="4" r="2"/><path d="M6 21l3-6 3 2 1-5 4 3"/><path d="M9 9l3-2 3 2"/>' },
  bici: { c: "#FF453A", t: "rgba(255,69,58,.16)", label: "Bici", icon: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l2 7h-6M14 5h2"/>' },
  forza: { c: "#30D158", t: "rgba(48,209,88,.16)", label: "Palestra", icon: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>' },
  altro: { c: "#8E8E93", t: "rgba(142,142,147,.18)", label: "Altro", icon: '<circle cx="12" cy="12" r="4"/>' },
};
const STATE_WORD = { verde: "Pronto", giallo: "Con cautela", rosso: "Riposo" };
const STATE_ICON = { verde: "M5 12l5 5 9-10", giallo: "M12 7v6M12 17h.01", rosso: "M6 6l12 12M18 6L6 18" };
const SYS_WORD = { verde: "Ottimo", giallo: "Incompleto", rosso: "Sotto stress" };
const TIS_WORD = { verde: "Recuperati", giallo: "In recupero", rosso: "Danneggiati" };
const CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#30D158" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>';
const CHEV = '<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

function icon(sport, size = 22, box = 40) {
  const s = SPORT[sport] || SPORT.altro;
  return `<div class="ico" style="background:${s.t};width:${box}px;height:${box}px"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${s.c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg></div>`;
}

// Profilo della seduta (barre larghe quanto la durata, alte quanto l'intensità)
function profile(segs, color, h = 52) {
  if (!segs.length) return "";
  const tot = segs.reduce((t, s) => t + s.sec, 0) || 1;
  const bars = segs.map((s) => {
    const hh = Math.max(8, Math.min(100, ((s.pct - 30) / 90) * 100));
    const op = s.pct < 50 ? 0.28 : s.pct < 80 ? 0.55 : 1;
    return `<div style="flex:${(s.sec / tot * 1000).toFixed(1)} 1 0;height:${hh.toFixed(0)}%;background:${color};opacity:${op};border-radius:3px;min-width:2px"></div>`;
  }).join("");
  return `<div class="prof" style="height:${h}px">${bars}</div>`;
}

function stepsList(parsed, sport) {
  if (!parsed.rows.length) return "";
  const c = SPORT[sport].c;
  return `<div class="steps">${parsed.rows.map((r) => {
    if (r.plain) return `<div class="st"><div class="stx">${esc(r.text)}</div></div>`;
    if (r.header) return `<div class="srep" style="color:${c}">${esc(r.header)}${r.label ? " " + esc(r.label) : ""}</div>`;
    const tg = r.targets.map((t) => `<span class="tg${t.k === "pace" ? " tp" : ""}">${esc(t.t)}</span>`).join("");
    return `<div class="st${r.indent ? " in" : ""}${r.rest ? " rest" : ""}" style="${r.indent ? `border-left:2px solid ${c}55` : ""}">
      <div class="sl">${esc(r.len)}</div>
      <div class="sr">${r.label ? `<div class="sn">${esc(r.label)}</div>` : ""}${tg ? `<div class="tgs">${tg}</div>` : ""}</div>
    </div>`;
  }).join("")}</div>`;
}

// Sotto la seduta: cosa prendere e quando, e se gli avvisi sono già sull'orologio
function rifSedutaHTML(e) {
  const S = e.rif;
  if (!S || e.done) return "";
  const senza = /senza avvisi/i.test(e.description || ""), scritto = haAvvisi(e.description);
  const testa = S.voci.some((v) => v.tipo === "mangia") ? `Carboidrati · ${S.g} g in tutto, ${Math.round((S.g * 60) / S.min)} g all'ora` : "Da bere";
  const stato = senza ? "Avvisi spenti per questa seduta (c'è «senza avvisi» nella descrizione)."
    : !CONFIG.rifornimento.avvisiOrologio ? "Avvisi sull'orologio spenti in CONFIG."
    : scritto ? "Sull'orologio: a ogni orario vibra e ti dice cosa prendere."
    : "Gli orari arrivano sull'orologio la prossima volta che apri l'HUD con internet.";
  return `<div class="rif">
    <div class="t13 semi" style="color:#FF9F0A">${esc(testa)}</div>
    ${S.borraccia ? `<div class="t13 muted" style="margin-top:-4px">${esc(S.borraccia.nome)} nella borraccia, da bere a sorsi: ${S.borraccia.g} g di carboidrati</div>` : ""}
    <div class="rvs">${S.voci.map((v) => `<div class="rv${v.tipo === "bevi" ? " bv" : ""}"><span class="rt">${fmtMin(v.t)}</span><span>${v.tipo === "bevi" ? "Bevi" : `${esc(v.nome)} <span class="rg">${v.g} g</span>`}</span></div>`).join("")}</div>
    <div class="t13 muted" style="line-height:1.4">${stato} ${S.acqua.ml} ml d'acqua all'ora.</div>
  </div>`;
}

function sessionCard(e, open) {
  const s = SPORT[e.sport] || SPORT.altro;
  const meta = [e.min ? fmtMin(e.min) : null, num(e.distance) ? fmtDist(e.distance, e.sport) : null, e.load ? `${Math.round(e.load)} TSS` : null].filter(Boolean).join(" · ");
  const doneTxt = e.done ? `<div class="done">${CHECK}<span>Svolto · ${fmtMin(Math.round((num(e.done.moving_time) || 0) / 60))}</span></div>` : "";
  const hint = e.sport === "nuoto" ? `Recupero ${CONFIG.nuoto.recuperoBlocchi} tra i blocchi` : e.sport === "bici" && CONFIG.bici.daVerificare ? `Soglia FC ${CONFIG.bici.sogliaFC} da verificare` : "";
  return `<div class="sess">
    <div class="hstack" style="gap:12px;align-items:flex-start">
      ${icon(e.sport)}
      <div class="grow">
        <div class="t17 semi">${esc(e.name || s.label)}</div>
        <div class="sub">${esc(meta || s.label)}</div>
      </div>
    </div>
    ${impSVG(impronta(e), 48)}
    ${open ? stepsList(e.parsed, e.sport) : ""}
    ${hint ? `<div class="sub" style="margin-top:2px">${esc(hint)}</div>` : ""}
    ${doneTxt}
  </div>`;
}

function keyLine(parsed) {
  const R = parsed.rows;
  for (let i = 0; i < R.length; i++) {
    if (R[i].header && R[i + 1] && !R[i + 1].header) {
      const r = R[i + 1];
      return `${R[i].header} ${r.len}${r.targets && r.targets[0] ? " · " + r.targets[0].t : ""}`;
    }
  }
  const main = R.find((r) => !r.header && !r.plain && !r.rest && !/riscald|defatic/i.test(r.label || "") && r.targets && r.targets.length);
  if (main) return `${main.len} · ${main.targets[0].t}`;
  const pl = R.find((r) => r.plain);
  return pl ? pl.text : null;
}

function recapWeek(W) {
  const end = addDays(W.start, 6);
  const per = { nuoto: { p: 0, d: 0 }, bici: { p: 0, d: 0 }, corsa: { p: 0, d: 0 } };
  let done = 0;
  const days = W.days.map((D) => {
    const items = [];
    for (const e of D.evs) {
      const m = e.done ? Math.round((num(e.done.moving_time) || 0) / 60) : e.min;
      items.push({ c: (SPORT[e.sport] || SPORT.altro).c, min: m, done: !!e.done });
      if (per[e.sport]) { per[e.sport].p += e.min; if (e.done) per[e.sport].d += m; }
      if (e.done) done += m;
    }
    for (const a of D.extra) {
      const sp = sportOf(a.type), m = Math.round((num(a.moving_time) || 0) / 60);
      items.push({ c: (SPORT[sp] || SPORT.altro).c, min: m, done: true });
      if (per[sp]) per[sp].d += m;
      done += m;
    }
    return { l: GG[D.date.getDay()].slice(0, 1), d: D.date.getDate(), today: D.isToday, items };
  });
  return {
    n: isoWeek(W.start), range: `${W.start.getDate()} ${MESI_BREVI[W.start.getMonth()]} – ${end.getDate()} ${MESI_BREVI[end.getMonth()]}`,
    days, planned: Math.round(W.plannedSec / 60), done, load: Math.round(W.loadPlanned),
    sports: ["nuoto", "bici", "corsa"].filter((s) => CONFIG.sport.includes(s) || per[s].p || per[s].d).map((s) => ({ l: SPORT[s].label, c: SPORT[s].c, planned: per[s].p, done: per[s].d })),
  };
}

// ------------------------------------------------------------
//  uPlot 1.6.32 (github.com/leeoniya/uPlot): grafici veloci su canvas per il grafico della fitness.
//  Incluso così com'è, con la sua licenza:
//  The MIT License (MIT)
//  
//  Copyright (c) 2022 Leon Sorokin
//  
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//  
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//  
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
// ------------------------------------------------------------
const UPLOT_JS = "/*! https://github.com/leeoniya/uPlot (v1.6.32) */\nvar uPlot=function(){\"use strict\";const l=\"u-off\",e=\"u-label\",t=\"width\",n=\"height\",i=\"top\",o=\"bottom\",s=\"left\",r=\"right\",u=\"#000\",a=u+\"0\",f=\"mousemove\",c=\"mousedown\",h=\"mouseup\",d=\"mouseenter\",p=\"mouseleave\",m=\"dblclick\",g=\"change\",x=\"dppxchange\",w=\"--\",_=\"undefined\"!=typeof window,b=_?document:null,v=_?window:null,k=_?navigator:null;let y,M;function S(l,e){if(null!=e){let t=l.classList;!t.contains(e)&&t.add(e)}}function T(l,e){let t=l.classList;t.contains(e)&&t.remove(e)}function E(l,e,t){l.style[e]=t+\"px\"}function z(l,e,t,n){let i=b.createElement(l);return null!=e&&S(i,e),null!=t&&t.insertBefore(i,n),i}function D(l,e){return z(\"div\",l,e)}const P=new WeakMap;function A(e,t,n,i,o){let s=\"translate(\"+t+\"px,\"+n+\"px)\";s!=P.get(e)&&(e.style.transform=s,P.set(e,s),0>t||0>n||t>i||n>o?S(e,l):T(e,l))}const W=new WeakMap;function Y(l,e,t){let n=e+t;n!=W.get(l)&&(W.set(l,n),l.style.background=e,l.style.borderColor=t)}const C=new WeakMap;function H(l,e,t,n){let i=e+\"\"+t;i!=C.get(l)&&(C.set(l,i),l.style.height=t+\"px\",l.style.width=e+\"px\",l.style.marginLeft=n?-e/2+\"px\":0,l.style.marginTop=n?-t/2+\"px\":0)}const F={passive:!0},R={...F,capture:!0};function G(l,e,t,n){e.addEventListener(l,t,n?R:F)}function I(l,e,t){e.removeEventListener(l,t,F)}function L(l,e,t,n){let i;t=t||0;let o=2147483647>=(n=n||e.length-1);for(;n-t>1;)i=o?t+n>>1:sl((t+n)/2),l>e[i]?t=i:n=i;return l-e[t]>e[n]-l?n:t}function O(l){return(e,t,n)=>{let i=-1,o=-1;for(let o=t;n>=o;o++)if(l(e[o])){i=o;break}for(let i=n;i>=t;i--)if(l(e[i])){o=i;break}return[i,o]}}_&&function l(){let e=devicePixelRatio;y!=e&&(y=e,M&&I(g,M,l),M=matchMedia(`(min-resolution: ${y-.001}dppx) and (max-resolution: ${y+.001}dppx)`),G(g,M,l),v.dispatchEvent(new CustomEvent(x)))}();const N=l=>null!=l,j=l=>null!=l&&l>0,U=O(N),V=O(j);function B(l,e,t,n){let i=hl(l),o=hl(e);l==e&&(-1==i?(l*=t,e/=t):(l/=t,e*=t));let s=10==t?dl:pl,r=1==o?ul:sl,u=(1==i?sl:ul)(s(ol(l))),a=r(s(ol(e))),f=cl(t,u),c=cl(t,a);return 10==t&&(0>u&&(f=Al(f,-u)),0>a&&(c=Al(c,-a))),n||2==t?(l=f*i,e=c*o):(l=Pl(l,f),e=Dl(e,c)),[l,e]}function $(l,e,t,n){let i=B(l,e,t,n);return 0==l&&(i[0]=0),0==e&&(i[1]=0),i}const J=.1,q={mode:3,pad:J},K={pad:0,soft:null,mode:0},X={min:K,max:K};function Z(l,e,t,n){return Ol(t)?ll(l,e,t):(K.pad=t,K.soft=n?0:null,K.mode=n?3:0,ll(l,e,X))}function Q(l,e){return null==l?e:l}function ll(l,e,t){let n=t.min,i=t.max,o=Q(n.pad,0),s=Q(i.pad,0),r=Q(n.hard,-gl),u=Q(i.hard,gl),a=Q(n.soft,gl),f=Q(i.soft,-gl),c=Q(n.mode,0),h=Q(i.mode,0),d=e-l,p=dl(d),m=fl(ol(l),ol(e)),g=dl(m),x=ol(g-p);(1e-24>d||x>10)&&(d=0,0!=l&&0!=e||(d=1e-24,2==c&&a!=gl&&(o=0),2==h&&f!=-gl&&(s=0)));let w=d||m||1e3,_=dl(w),b=cl(10,sl(_)),v=Al(Pl(l-w*(0==d?0==l?.1:1:o),b/10),24),k=a>l||1!=c&&(3!=c||v>a)&&(2!=c||a>v)?gl:a,y=fl(r,k>v&&l>=k?k:al(k,v)),M=Al(Dl(e+w*(0==d?0==e?.1:1:s),b/10),24),S=e>f||1!=h&&(3!=h||f>M)&&(2!=h||M>f)?-gl:f,T=al(u,M>S&&S>=e?S:fl(S,M));return y==T&&0==y&&(T=100),[y,T]}const el=new Intl.NumberFormat(_?k.language:\"en-US\"),tl=l=>el.format(l),nl=Math,il=nl.PI,ol=nl.abs,sl=nl.floor,rl=nl.round,ul=nl.ceil,al=nl.min,fl=nl.max,cl=nl.pow,hl=nl.sign,dl=nl.log10,pl=nl.log2,ml=(l,e=1)=>nl.asinh(l/e),gl=1/0;function xl(l){return 1+(0|dl((l^l>>31)-(l>>31)))}function wl(l,e,t){return al(fl(l,e),t)}function _l(l){return\"function\"==typeof l}function bl(l){return _l(l)?l:()=>l}const vl=l=>l,kl=(l,e)=>e,yl=()=>null,Ml=()=>!0,Sl=(l,e)=>l==e,Tl=/\\.\\d*?(?=9{6,}|0{6,})/gm,El=l=>{if(Il(l)||Wl.has(l))return l;const e=\"\"+l,t=e.match(Tl);if(null==t)return l;let n=t[0].length-1;if(-1!=e.indexOf(\"e-\")){let[l,t]=e.split(\"e\");return+`${El(l)}e${t}`}return Al(l,n)};function zl(l,e){return El(Al(El(l/e))*e)}function Dl(l,e){return El(ul(El(l/e))*e)}function Pl(l,e){return El(sl(El(l/e))*e)}function Al(l,e=0){if(Il(l))return l;let t=10**e;return rl(l*t*(1+Number.EPSILON))/t}const Wl=new Map;function Yl(l){return((\"\"+l).split(\".\")[1]||\"\").length}function Cl(l,e,t,n){let i=[],o=n.map(Yl);for(let s=e;t>s;s++){let e=ol(s),t=Al(cl(l,s),e);for(let r=0;n.length>r;r++){let u=10==l?+`${n[r]}e${s}`:n[r]*t,a=(0>s?e:0)+(o[r]>s?o[r]:0),f=10==l?u:Al(u,a);i.push(f),Wl.set(f,a)}}return i}const Hl={},Fl=[],Rl=[null,null],Gl=Array.isArray,Il=Number.isInteger;function Ll(l){return\"string\"==typeof l}function Ol(l){let e=!1;if(null!=l){let t=l.constructor;e=null==t||t==Object}return e}function Nl(l){return null!=l&&\"object\"==typeof l}const jl=Object.getPrototypeOf(Uint8Array),Ul=\"__proto__\";function Vl(l,e=Ol){let t;if(Gl(l)){let n=l.find((l=>null!=l));if(Gl(n)||e(n)){t=Array(l.length);for(let n=0;l.length>n;n++)t[n]=Vl(l[n],e)}else t=l.slice()}else if(l instanceof jl)t=l.slice();else if(e(l)){t={};for(let n in l)n!=Ul&&(t[n]=Vl(l[n],e))}else t=l;return t}function Bl(l){let e=arguments;for(let t=1;e.length>t;t++){let n=e[t];for(let e in n)e!=Ul&&(Ol(l[e])?Bl(l[e],Vl(n[e])):l[e]=Vl(n[e]))}return l}function $l(l,e,t){for(let n,i=0,o=-1;e.length>i;i++){let s=e[i];if(s>o){for(n=s-1;n>=0&&null==l[n];)l[n--]=null;for(n=s+1;t>n&&null==l[n];)l[o=n++]=null}}}const Jl=\"undefined\"==typeof queueMicrotask?l=>Promise.resolve().then(l):queueMicrotask,ql=[\"January\",\"February\",\"March\",\"April\",\"May\",\"June\",\"July\",\"August\",\"September\",\"October\",\"November\",\"December\"],Kl=[\"Sunday\",\"Monday\",\"Tuesday\",\"Wednesday\",\"Thursday\",\"Friday\",\"Saturday\"];function Xl(l){return l.slice(0,3)}const Zl=Kl.map(Xl),Ql=ql.map(Xl),le={MMMM:ql,MMM:Ql,WWWW:Kl,WWW:Zl};function ee(l){return(10>l?\"0\":\"\")+l}const te={YYYY:l=>l.getFullYear(),YY:l=>(l.getFullYear()+\"\").slice(2),MMMM:(l,e)=>e.MMMM[l.getMonth()],MMM:(l,e)=>e.MMM[l.getMonth()],MM:l=>ee(l.getMonth()+1),M:l=>l.getMonth()+1,DD:l=>ee(l.getDate()),D:l=>l.getDate(),WWWW:(l,e)=>e.WWWW[l.getDay()],WWW:(l,e)=>e.WWW[l.getDay()],HH:l=>ee(l.getHours()),H:l=>l.getHours(),h:l=>{let e=l.getHours();return 0==e?12:e>12?e-12:e},AA:l=>12>l.getHours()?\"AM\":\"PM\",aa:l=>12>l.getHours()?\"am\":\"pm\",a:l=>12>l.getHours()?\"a\":\"p\",mm:l=>ee(l.getMinutes()),m:l=>l.getMinutes(),ss:l=>ee(l.getSeconds()),s:l=>l.getSeconds(),fff:l=>function(l){return(10>l?\"00\":100>l?\"0\":\"\")+l}(l.getMilliseconds())};function ne(l,e){e=e||le;let t,n=[],i=/\\{([a-z]+)\\}|[^{]+/gi;for(;t=i.exec(l);)n.push(\"{\"==t[0][0]?te[t[1]]:t[0]);return l=>{let t=\"\";for(let i=0;n.length>i;i++)t+=\"string\"==typeof n[i]?n[i]:n[i](l,e);return t}}const ie=(new Intl.DateTimeFormat).resolvedOptions().timeZone,oe=l=>l%1==0,se=[1,2,2.5,5],re=Cl(10,-32,0,se),ue=Cl(10,0,32,se),ae=ue.filter(oe),fe=re.concat(ue),ce=\"{YYYY}\",he=\"\\n\"+ce,de=\"{M}/{D}\",pe=\"\\n\"+de,me=pe+\"/{YY}\",ge=\"{aa}\",xe=\"{h}:{mm}\"+ge,we=\"\\n\"+xe,_e=\":{ss}\",be=null;function ve(l){let e=1e3*l,t=60*e,n=60*t,i=24*n,o=30*i,s=365*i;return[(1==l?Cl(10,0,3,se).filter(oe):Cl(10,-3,0,se)).concat([e,5*e,10*e,15*e,30*e,t,5*t,10*t,15*t,30*t,n,2*n,3*n,4*n,6*n,8*n,12*n,i,2*i,3*i,4*i,5*i,6*i,7*i,8*i,9*i,10*i,15*i,o,2*o,3*o,4*o,6*o,s,2*s,5*s,10*s,25*s,50*s,100*s]),[[s,ce,be,be,be,be,be,be,1],[28*i,\"{MMM}\",he,be,be,be,be,be,1],[i,de,he,be,be,be,be,be,1],[n,\"{h}\"+ge,me,be,pe,be,be,be,1],[t,xe,me,be,pe,be,be,be,1],[e,_e,me+\" \"+xe,be,pe+\" \"+xe,be,we,be,1],[l,_e+\".{fff}\",me+\" \"+xe,be,pe+\" \"+xe,be,we,be,1]],function(e){return(r,u,a,f,c,h)=>{let d=[],p=c>=s,m=c>=o&&s>c,g=e(a),x=Al(g*l,3),w=Pe(g.getFullYear(),p?0:g.getMonth(),m||p?1:g.getDate()),_=Al(w*l,3);if(m||p){let t=m?c/o:0,n=p?c/s:0,i=x==_?x:Al(Pe(w.getFullYear()+n,w.getMonth()+t,1)*l,3),r=new Date(rl(i/l)),u=r.getFullYear(),a=r.getMonth();for(let o=0;f>=i;o++){let s=Pe(u+n*o,a+t*o,1),r=s-e(Al(s*l,3));i=Al((+s+r)*l,3),i>f||d.push(i)}}else{let o=i>c?c:i,s=_+(sl(a)-sl(x))+Dl(x-_,o);d.push(s);let p=e(s),m=p.getHours()+p.getMinutes()/t+p.getSeconds()/n,g=c/n,w=h/r.axes[u]._space;for(;s=Al(s+c,1==l?0:3),f>=s;)if(g>1){let l=sl(Al(m+g,6))%24,t=e(s).getHours()-l;t>1&&(t=-1),s-=t*n,m=(m+g)%24,.7>Al((s-d[d.length-1])/c,3)*w||d.push(s)}else d.push(s)}return d}}]}const[ke,ye,Me]=ve(1),[Se,Te,Ee]=ve(.001);function ze(l,e){return l.map((l=>l.map(((t,n)=>0==n||8==n||null==t?t:e(1==n||0==l[8]?t:l[1]+t)))))}function De(l,e){return(t,n,i,o,s)=>{let r,u,a,f,c,h,d=e.find((l=>s>=l[0]))||e[e.length-1];return n.map((e=>{let t=l(e),n=t.getFullYear(),i=t.getMonth(),o=t.getDate(),s=t.getHours(),p=t.getMinutes(),m=t.getSeconds(),g=n!=r&&d[2]||i!=u&&d[3]||o!=a&&d[4]||s!=f&&d[5]||p!=c&&d[6]||m!=h&&d[7]||d[1];return r=n,u=i,a=o,f=s,c=p,h=m,g(t)}))}}function Pe(l,e,t){return new Date(l,e,t)}function Ae(l,e){return e(l)}function We(l,e){return(t,n,i,o)=>null==o?w:e(l(n))}Cl(2,-53,53,[1]);const Ye={show:!0,live:!0,isolate:!1,mount:()=>{},markers:{show:!0,width:2,stroke:function(l,e){let t=l.series[e];return t.width?t.stroke(l,e):t.points.width?t.points.stroke(l,e):null},fill:function(l,e){return l.series[e].fill(l,e)},dash:\"solid\"},idx:null,idxs:null,values:[]},Ce=[0,0];function He(l,e,t,n=!0){return l=>{0==l.button&&(!n||l.target==e)&&t(l)}}function Fe(l,e,t,n=!0){return l=>{(!n||l.target==e)&&t(l)}}const Re={show:!0,x:!0,y:!0,lock:!1,move:function(l,e,t){return Ce[0]=e,Ce[1]=t,Ce},points:{one:!1,show:function(l,e){let i=l.cursor.points,o=D(),s=i.size(l,e);E(o,t,s),E(o,n,s);let r=s/-2;E(o,\"marginLeft\",r),E(o,\"marginTop\",r);let u=i.width(l,e,s);return u&&E(o,\"borderWidth\",u),o},size:function(l,e){return l.series[e].points.size},width:0,stroke:function(l,e){let t=l.series[e].points;return t._stroke||t._fill},fill:function(l,e){let t=l.series[e].points;return t._fill||t._stroke}},bind:{mousedown:He,mouseup:He,click:He,dblclick:He,mousemove:Fe,mouseleave:Fe,mouseenter:Fe},drag:{setScale:!0,x:!0,y:!1,dist:0,uni:null,click:(l,e)=>{e.stopPropagation(),e.stopImmediatePropagation()},_x:!1,_y:!1},focus:{dist:(l,e,t,n,i)=>n-i,prox:-1,bias:0},hover:{skip:[void 0],prox:null,bias:0},left:-10,top:-10,idx:null,dataIdx:null,idxs:null,event:null},Ge={show:!0,stroke:\"rgba(0,0,0,0.07)\",width:2},Ie=Bl({},Ge,{filter:kl}),Le=Bl({},Ie,{size:10}),Oe=Bl({},Ge,{show:!1}),Ne='12px system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\"',je=\"bold \"+Ne,Ue={show:!0,scale:\"x\",stroke:u,space:50,gap:5,alignTo:1,size:50,labelGap:0,labelSize:30,labelFont:je,side:2,grid:Ie,ticks:Le,border:Oe,font:Ne,lineGap:1.5,rotate:0},Ve={show:!0,scale:\"x\",auto:!1,sorted:1,min:gl,max:-gl,idxs:[]};function Be(l,e){return e.map((l=>null==l?\"\":tl(l)))}function $e(l,e,t,n,i,o,s){let r=[],u=Wl.get(i)||0;for(let l=t=s?t:Al(Dl(t,i),u);n>=l;l=Al(l+i,u))r.push(Object.is(l,-0)?0:l);return r}function Je(l,e,t,n,i){const o=[],s=l.scales[l.axes[e].scale].log,r=sl((10==s?dl:pl)(t));i=cl(s,r),10==s&&(i=fe[L(i,fe)]);let u=t,a=i*s;10==s&&(a=fe[L(a,fe)]);do{o.push(u),u+=i,10!=s||Wl.has(u)||(u=Al(u,Wl.get(i))),a>u||(a=(i=u)*s,10==s&&(a=fe[L(a,fe)]))}while(n>=u);return o}function qe(l,e,t,n,i){let o=l.scales[l.axes[e].scale].asinh,s=n>o?Je(l,e,fl(o,t),n,i):[o],r=0>n||t>0?[]:[0];return(-o>t?Je(l,e,fl(o,-n),-t,i):[o]).reverse().map((l=>-l)).concat(r,s)}const Ke=/./,Xe=/[12357]/,Ze=/[125]/,Qe=/1/,lt=(l,e,t,n)=>l.map(((l,i)=>4==e&&0==l||i%n==0&&t.test(l.toExponential()[0>l?1:0])?l:null));function et(l,e,t){let n=l.axes[t],i=n.scale,o=l.scales[i],s=l.valToPos,r=n._space,u=s(10,i),a=s(9,i)-u<r?s(7,i)-u<r?s(5,i)-u<r?Qe:Ze:Xe:Ke;if(a==Qe){let l=ol(s(1,i)-u);if(r>l)return lt(e.slice().reverse(),o.distr,a,ul(r/l)).reverse()}return lt(e,o.distr,a,1)}function tt(l,e,t){let n=l.axes[t],i=n.scale,o=n._space,s=l.valToPos,r=ol(s(1,i)-s(2,i));return o>r?lt(e.slice().reverse(),3,Ke,ul(o/r)).reverse():e}function nt(l,e,t,n){return null==n?w:null==e?\"\":tl(e)}const it={show:!0,scale:\"y\",stroke:u,space:30,gap:5,alignTo:1,size:50,labelGap:0,labelSize:30,labelFont:je,side:3,grid:Ie,ticks:Le,border:Oe,font:Ne,lineGap:1.5,rotate:0},ot={scale:null,auto:!0,sorted:0,min:gl,max:-gl},st=(l,e,t,n,i)=>i,rt={show:!0,auto:!0,sorted:0,gaps:st,alpha:1,facets:[Bl({},ot,{scale:\"x\"}),Bl({},ot,{scale:\"y\"})]},ut={scale:\"y\",auto:!0,sorted:0,show:!0,spanGaps:!1,gaps:st,alpha:1,points:{show:function(l,e){let{scale:t,idxs:n}=l.series[0],i=l._data[0],o=l.valToPos(i[n[0]],t,!0),s=l.valToPos(i[n[1]],t,!0);return ol(s-o)/(l.series[e].points.space*y)>=n[1]-n[0]},filter:null},values:null,min:gl,max:-gl,idxs:[],path:null,clip:null};function at(l,e,t){return t/10}const ft={time:!0,auto:!0,distr:1,log:10,asinh:1,min:null,max:null,dir:1,ori:0},ct=Bl({},ft,{time:!1,ori:1}),ht={};function dt(l){let e=ht[l];return e||(e={key:l,plots:[],sub(l){e.plots.push(l)},unsub(l){e.plots=e.plots.filter((e=>e!=l))},pub(l,t,n,i,o,s,r){for(let u=0;e.plots.length>u;u++)e.plots[u]!=t&&e.plots[u].pub(l,t,n,i,o,s,r)}},null!=l&&(ht[l]=e)),e}function pt(l,e,t){const n=l.mode,i=l.series[e],o=2==n?l._data[e]:l._data,s=l.scales,r=l.bbox;let u=o[0],a=2==n?o[1]:o[e],f=2==n?s[i.facets[0].scale]:s[l.series[0].scale],c=2==n?s[i.facets[1].scale]:s[i.scale],h=r.left,d=r.top,p=r.width,m=r.height,g=l.valToPosH,x=l.valToPosV;return 0==f.ori?t(i,u,a,f,c,g,x,h,d,p,m,kt,Mt,Tt,zt,Pt):t(i,u,a,f,c,x,g,d,h,m,p,yt,St,Et,Dt,At)}function mt(l,e){let t=0,n=0,i=Q(l.bands,Fl);for(let l=0;i.length>l;l++){let o=i[l];o.series[0]==e?t=o.dir:o.series[1]==e&&(n|=1==o.dir?1:2)}return[t,1==n?-1:2==n?1:3==n?2:0]}function gt(l,e,t,n,i){let o=l.series[e],s=l.scales[2==l.mode?o.facets[1].scale:o.scale];return-1==i?s.min:1==i?s.max:3==s.distr?1==s.dir?s.min:s.max:0}function xt(l,e,t,n,i,o){return pt(l,e,((l,e,s,r,u,a,f,c,h,d,p)=>{let m=l.pxRound;const g=0==r.ori?Mt:St;let x,w;1==r.dir*(0==r.ori?1:-1)?(x=t,w=n):(x=n,w=t);let _=m(a(e[x],r,d,c)),b=m(f(s[x],u,p,h)),v=m(a(e[w],r,d,c)),k=m(f(1==o?u.max:u.min,u,p,h)),y=new Path2D(i);return g(y,v,k),g(y,_,k),g(y,_,b),y}))}function wt(l,e,t,n,i,o){let s=null;if(l.length>0){s=new Path2D;const r=0==e?Tt:Et;let u=t;for(let e=0;l.length>e;e++){let t=l[e];if(t[1]>t[0]){let l=t[0]-u;l>0&&r(s,u,n,l,n+o),u=t[1]}}let a=t+i-u,f=10;a>0&&r(s,u,n-f/2,a,n+o+f)}return s}function _t(l,e,t,n,i,o,s){let r=[],u=l.length;for(let a=1==i?t:n;a>=t&&n>=a;a+=i)if(null===e[a]){let f=a,c=a;if(1==i)for(;++a<=n&&null===e[a];)c=a;else for(;--a>=t&&null===e[a];)c=a;let h=o(l[f]),d=c==f?h:o(l[c]),p=f-i;h=s>0||0>p||p>=u?h:o(l[p]);let m=c+i;d=0>s||0>m||m>=u?d:o(l[m]),h>d||r.push([h,d])}return r}function bt(l){return 0==l?vl:1==l?rl:e=>zl(e,l)}function vt(l){let e=0==l?kt:yt,t=0==l?(l,e,t,n,i,o)=>{l.arcTo(e,t,n,i,o)}:(l,e,t,n,i,o)=>{l.arcTo(t,e,i,n,o)},n=0==l?(l,e,t,n,i)=>{l.rect(e,t,n,i)}:(l,e,t,n,i)=>{l.rect(t,e,i,n)};return(l,i,o,s,r,u=0,a=0)=>{0==u&&0==a?n(l,i,o,s,r):(u=al(u,s/2,r/2),a=al(a,s/2,r/2),e(l,i+u,o),t(l,i+s,o,i+s,o+r,u),t(l,i+s,o+r,i,o+r,a),t(l,i,o+r,i,o,a),t(l,i,o,i+s,o,u),l.closePath())}}const kt=(l,e,t)=>{l.moveTo(e,t)},yt=(l,e,t)=>{l.moveTo(t,e)},Mt=(l,e,t)=>{l.lineTo(e,t)},St=(l,e,t)=>{l.lineTo(t,e)},Tt=vt(0),Et=vt(1),zt=(l,e,t,n,i,o)=>{l.arc(e,t,n,i,o)},Dt=(l,e,t,n,i,o)=>{l.arc(t,e,n,i,o)},Pt=(l,e,t,n,i,o,s)=>{l.bezierCurveTo(e,t,n,i,o,s)},At=(l,e,t,n,i,o,s)=>{l.bezierCurveTo(t,e,i,n,s,o)};function Wt(){return(l,e,t,n,i)=>pt(l,e,((e,o,s,r,u,a,f,c,h,d,p)=>{let m,g,{pxRound:x,points:w}=e;0==r.ori?(m=kt,g=zt):(m=yt,g=Dt);const _=Al(w.width*y,3);let b=(w.size-w.width)/2*y,v=Al(2*b,3),k=new Path2D,M=new Path2D,{left:S,top:T,width:E,height:z}=l.bbox;Tt(M,S-v,T-v,E+2*v,z+2*v);const D=l=>{if(null!=s[l]){let e=x(a(o[l],r,d,c)),t=x(f(s[l],u,p,h));m(k,e+b,t),g(k,e,t,b,0,2*il)}};if(i)i.forEach(D);else for(let l=t;n>=l;l++)D(l);return{stroke:_>0?k:null,fill:k,clip:M,flags:3}}))}function Yt(l){return(e,t,n,i,o,s)=>{n!=i&&(o!=n&&s!=n&&l(e,t,n),o!=i&&s!=i&&l(e,t,i),l(e,t,s))}}const Ct=Yt(Mt),Ht=Yt(St);function Ft(l){const e=Q(l?.alignGaps,0);return(l,t,n,i)=>pt(l,t,((o,s,r,u,a,f,c,h,d,p,m)=>{[n,i]=U(r,n,i);let g,x,w=o.pxRound,_=l=>w(f(l,u,p,h)),b=l=>w(c(l,a,m,d));0==u.ori?(g=Mt,x=Ct):(g=St,x=Ht);const v=u.dir*(0==u.ori?1:-1),k={stroke:new Path2D,fill:null,clip:null,band:null,gaps:null,flags:1},y=k.stroke;let M=!1;if(i-n<4*p)for(let l=1==v?n:i;l>=n&&i>=l;l+=v){let e=r[l];null===e?M=!0:null!=e&&g(y,_(s[l]),b(e))}else{let e,t,o,a=e=>l.posToVal(e,u.key,!0),f=null,c=null,h=_(s[1==v?n:i]),d=_(s[n]),p=_(s[i]),m=a(1==v?d+1:p-1);for(let l=1==v?n:i;l>=n&&i>=l;l+=v){let n=s[l],i=(1==v?m>n:n>m)?h:_(n),o=r[l];i==h?null!=o?(t=o,null==f?(g(y,i,b(t)),e=f=c=t):f>t?f=t:t>c&&(c=t)):null===o&&(M=!0):(null!=f&&x(y,h,b(f),b(c),b(e),b(t)),null!=o?(t=o,g(y,i,b(t)),f=c=e=t):(f=c=null,null===o&&(M=!0)),h=i,m=a(h+v))}null!=f&&f!=c&&o!=h&&x(y,h,b(f),b(c),b(e),b(t))}let[S,T]=mt(l,t);if(null!=o.fill||0!=S){let e=k.fill=new Path2D(y),r=b(o.fillTo(l,t,o.min,o.max,S)),u=_(s[n]),a=_(s[i]);-1==v&&([a,u]=[u,a]),g(e,a,r),g(e,u,r)}if(!o.spanGaps){let a=[];M&&a.push(..._t(s,r,n,i,v,_,e)),k.gaps=a=o.gaps(l,t,n,i,a),k.clip=wt(a,u.ori,h,d,p,m)}return 0!=T&&(k.band=2==T?[xt(l,t,n,i,y,-1),xt(l,t,n,i,y,1)]:xt(l,t,n,i,y,T)),k}))}function Rt(l,e,t,n,i,o,s=gl){if(l.length>1){let r=null;for(let u=0,a=1/0;l.length>u;u++)if(void 0!==e[u]){if(null!=r){let e=ol(l[u]-l[r]);a>e&&(a=e,s=ol(t(l[u],n,i,o)-t(l[r],n,i,o)))}r=u}}return s}function Gt(l,e,t,n,i){const o=l.length;if(2>o)return null;const s=new Path2D;if(t(s,l[0],e[0]),2==o)n(s,l[1],e[1]);else{let t=Array(o),n=Array(o-1),r=Array(o-1),u=Array(o-1);for(let t=0;o-1>t;t++)r[t]=e[t+1]-e[t],u[t]=l[t+1]-l[t],n[t]=r[t]/u[t];t[0]=n[0];for(let l=1;o-1>l;l++)0===n[l]||0===n[l-1]||n[l-1]>0!=n[l]>0?t[l]=0:(t[l]=3*(u[l-1]+u[l])/((2*u[l]+u[l-1])/n[l-1]+(u[l]+2*u[l-1])/n[l]),isFinite(t[l])||(t[l]=0));t[o-1]=n[o-2];for(let n=0;o-1>n;n++)i(s,l[n]+u[n]/3,e[n]+t[n]*u[n]/3,l[n+1]-u[n]/3,e[n+1]-t[n+1]*u[n]/3,l[n+1],e[n+1])}return s}const It=new Set;function Lt(){for(let l of It)l.syncRect(!0)}_&&(G(\"resize\",v,Lt),G(\"scroll\",v,Lt,!0),G(x,v,(()=>{en.pxRatio=y})));const Ot=Ft(),Nt=Wt();function jt(l,e,t,n){return(n?[l[0],l[1]].concat(l.slice(2)):[l[0]].concat(l.slice(1))).map(((l,n)=>Ut(l,n,e,t)))}function Ut(l,e,t,n){return Bl({},0==e?t:n,l)}function Vt(l,e,t){return null==e?Rl:[e,t]}const Bt=Vt;function $t(l,e,t){return null==e?Rl:Z(e,t,J,!0)}function Jt(l,e,t,n){return null==e?Rl:B(e,t,l.scales[n].log,!1)}const qt=Jt;function Kt(l,e,t,n){return null==e?Rl:$(e,t,l.scales[n].log,!1)}const Xt=Kt;function Zt(l,e,t,n,i){let o=fl(xl(l),xl(e)),s=e-l,r=L(i/n*s,t);do{let l=t[r],e=n*l/s;if(e>=i&&17>=o+(5>l?Wl.get(l):0))return[l,e]}while(++r<t.length);return[0,0]}function Qt(l){let e,t;return[l=l.replace(/(\\d+)px/,((l,n)=>(e=rl((t=+n)*y))+\"px\")),e,t]}function ln(l){l.show&&[l.font,l.labelFont].forEach((l=>{let e=Al(l[2]*y,1);l[0]=l[0].replace(/[0-9.]+px/,e+\"px\"),l[1]=e}))}function en(u,g,_){const k={mode:Q(u.mode,1)},M=k.mode;function P(l,e,t,n){let i=e.valToPct(l);return n+t*(-1==e.dir?1-i:i)}function W(l,e,t,n){let i=e.valToPct(l);return n+t*(-1==e.dir?i:1-i)}function C(l,e,t,n){return 0==e.ori?P(l,e,t,n):W(l,e,t,n)}k.valToPosH=P,k.valToPosV=W;let F=!1;k.status=0;const R=k.root=D(\"uplot\");null!=u.id&&(R.id=u.id),S(R,u.class),u.title&&(D(\"u-title\",R).textContent=u.title);const O=z(\"canvas\"),K=k.ctx=O.getContext(\"2d\"),X=D(\"u-wrap\",R);G(\"click\",X,(l=>{l.target===el&&(Nn!=Gn||jn!=In)&&Zn.click(k,l)}),!0);const ll=k.under=D(\"u-under\",X);X.appendChild(O);const el=k.over=D(\"u-over\",X),tl=+Q((u=Vl(u)).pxAlign,1),sl=bt(tl);(u.plugins||[]).forEach((l=>{l.opts&&(u=l.opts(k,u)||u)}));const hl=u.ms||.001,pl=k.series=1==M?jt(u.series||[],Ve,ut,!1):function(l,e){return l.map(((l,t)=>0==t?{}:Bl({},e,l)))}(u.series||[null],rt),xl=k.axes=jt(u.axes||[],Ue,it,!0),vl=k.scales={},Tl=k.bands=u.bands||[];Tl.forEach((l=>{l.fill=bl(l.fill||null),l.dir=Q(l.dir,-1)}));const El=2==M?pl[1].facets[0].scale:pl[0].scale,Dl={axes:function(){for(let l=0;xl.length>l;l++){let e=xl[l];if(!e.show||!e._show)continue;let t,n,u=e.side,a=u%2,f=e.stroke(k,l),c=0==u||3==u?-1:1,[h,d]=e._found;if(null!=e.label){let s=rl((e._lpos+e.labelGap*c)*y);_n(e.labelFont[0],f,\"center\",2==u?i:o),K.save(),1==a?(t=n=0,K.translate(s,rl(lt+st/2)),K.rotate((3==u?-il:il)/2)):(t=rl(Qe+ot/2),n=s);let r=_l(e.label)?e.label(k,l,h,d):e.label;K.fillText(r,t,n),K.restore()}if(0==d)continue;let p=vl[e.scale],m=0==a?ot:st,g=0==a?Qe:lt,x=e._splits,w=2==p.distr?x.map((l=>pn[l])):x,_=2==p.distr?pn[x[1]]-pn[x[0]]:h,b=e.ticks,v=e.border,M=b.show?b.size:0,S=rl(M*y),T=rl((2==e.alignTo?e._size-M-e.gap:e.gap)*y),E=e._rotate*-il/180,z=sl(e._pos*y),D=z+(S+T)*c;n=0==a?D:0,t=1==a?D:0,_n(e.font[0],f,1==e.align?s:2==e.align?r:E>0?s:0>E?r:0==a?\"center\":3==u?r:s,E||1==a?\"middle\":2==u?i:o);let P=e.font[1]*e.lineGap,A=x.map((l=>sl(C(l,p,m,g)))),W=e._values;for(let l=0;W.length>l;l++){let e=W[l];if(null!=e){0==a?t=A[l]:n=A[l],e=\"\"+e;let i=-1==e.indexOf(\"\\n\")?[e]:e.split(/\\n/gm);for(let l=0;i.length>l;l++){let e=i[l];E?(K.save(),K.translate(t,n+l*P),K.rotate(E),K.fillText(e,0,0),K.restore()):K.fillText(e,t,n+l*P)}}}b.show&&zn(A,b.filter(k,w,l,d,_),a,u,z,S,Al(b.width*y,3),b.stroke(k,l),b.dash,b.cap);let Y=e.grid;Y.show&&zn(A,Y.filter(k,w,l,d,_),a,0==a?2:1,0==a?lt:Qe,0==a?st:ot,Al(Y.width*y,3),Y.stroke(k,l),Y.dash,Y.cap),v.show&&zn([z],[1],0==a?1:0,0==a?1:2,1==a?lt:Qe,1==a?st:ot,Al(v.width*y,3),v.stroke(k,l),v.dash,v.cap)}Ci(\"drawAxes\")},series:function(){if(Gt>0){let l=pl.some((l=>l._focus))&&dn!=Tt.alpha;l&&(K.globalAlpha=dn=Tt.alpha),pl.forEach(((l,e)=>{if(e>0&&l.show&&(kn(e,!1),kn(e,!0),null==l._paths)){let t=dn;dn!=l.alpha&&(K.globalAlpha=dn=l.alpha);let n=2==M?[0,g[e][0].length-1]:function(l){let e=wl(Lt-1,0,Gt-1),t=wl(en+1,0,Gt-1);for(;null==l[e]&&e>0;)e--;for(;null==l[t]&&Gt-1>t;)t++;return[e,t]}(g[e]);l._paths=l.paths(k,e,n[0],n[1]),dn!=t&&(K.globalAlpha=dn=t)}})),pl.forEach(((l,e)=>{if(e>0&&l.show){let t=dn;dn!=l.alpha&&(K.globalAlpha=dn=l.alpha),null!=l._paths&&yn(e,!1);{let t=null!=l._paths?l._paths.gaps:null,n=l.points.show(k,e,Lt,en,t),i=l.points.filter(k,e,n,t);(n||i)&&(l.points._paths=l.points.paths(k,e,Lt,en,i),yn(e,!0))}dn!=t&&(K.globalAlpha=dn=t),Ci(\"drawSeries\",e)}})),l&&(K.globalAlpha=dn=1)}}},Pl=(u.drawOrder||[\"axes\",\"series\"]).map((l=>Dl[l]));function Cl(l){const e=3==l.distr?e=>dl(e>0?e:l.clamp(k,e,l.min,l.max,l.key)):4==l.distr?e=>ml(e,l.asinh):100==l.distr?e=>l.fwd(e):l=>l;return t=>{let n=e(t),{_min:i,_max:o}=l;return(n-i)/(o-i)}}function Il(l){let e=vl[l];if(null==e){let t=(u.scales||Hl)[l]||Hl;if(null!=t.from){Il(t.from);let e=Bl({},vl[t.from],t,{key:l});e.valToPct=Cl(e),vl[l]=e}else{e=vl[l]=Bl({},l==El?ft:ct,t),e.key=l;let n=e.time,i=e.range,o=Gl(i);if((l!=El||2==M&&!n)&&(!o||null!=i[0]&&null!=i[1]||(i={min:null==i[0]?q:{mode:1,hard:i[0],soft:i[0]},max:null==i[1]?q:{mode:1,hard:i[1],soft:i[1]}},o=!1),!o&&Ol(i))){let l=i;i=(e,t,n)=>null==t?Rl:Z(t,n,l)}e.range=bl(i||(n?Bt:l==El?3==e.distr?qt:4==e.distr?Xt:Vt:3==e.distr?Jt:4==e.distr?Kt:$t)),e.auto=bl(!o&&e.auto),e.clamp=bl(e.clamp||at),e._min=e._max=null,e.valToPct=Cl(e)}}}Il(\"x\"),Il(\"y\"),1==M&&pl.forEach((l=>{Il(l.scale)})),xl.forEach((l=>{Il(l.scale)}));for(let l in u.scales)Il(l);const jl=vl[El],Ul=jl.distr;let $l,ql;0==jl.ori?(S(R,\"u-hz\"),$l=P,ql=W):(S(R,\"u-vt\"),$l=W,ql=P);const Kl={};for(let l in vl){let e=vl[l];null==e.min&&null==e.max||(Kl[l]={min:e.min,max:e.max},e.min=e.max=null)}const Xl=u.tzDate||(l=>new Date(rl(l/hl))),Zl=u.fmtDate||ne,Ql=1==hl?Me(Xl):Ee(Xl),le=De(Xl,ze(1==hl?ye:Te,Zl)),ee=We(Xl,Ae(\"{YYYY}-{MM}-{DD} {h}:{mm}{aa}\",Zl)),te=[],ie=k.legend=Bl({},Ye,u.legend),oe=k.cursor=Bl({},Re,{drag:{y:2==M}},u.cursor),se=ie.show,re=oe.show,ue=ie.markers;let ce,he,de;ie.idxs=te,ue.width=bl(ue.width),ue.dash=bl(ue.dash),ue.stroke=bl(ue.stroke),ue.fill=bl(ue.fill);let pe,me=[],ge=[],xe=!1,we={};if(ie.live){const l=pl[1]?pl[1].values:null;xe=null!=l,pe=xe?l(k,1,0):{_:0};for(let l in pe)we[l]=w}if(se)if(ce=z(\"table\",\"u-legend\",R),de=z(\"tbody\",null,ce),ie.mount(k,ce),xe){he=z(\"thead\",null,ce,de);let l=z(\"tr\",null,he);for(var _e in z(\"th\",null,l),pe)z(\"th\",e,l).textContent=_e}else S(ce,\"u-inline\"),ie.live&&S(ce,\"u-live\");const be={show:!0},ve={show:!1},Pe=new Map;function Ce(l,e,t,n=!0){const i=Pe.get(e)||{},o=oe.bind[l](k,e,t,n);o&&(G(l,e,i[l]=o),Pe.set(e,i))}function He(l,e){const t=Pe.get(e)||{};for(let n in t)null!=l&&n!=l||(I(n,e,t[n]),delete t[n]);null==l&&Pe.delete(e)}let Fe=0,Ge=0,Ie=0,Le=0,Oe=0,Ne=0,je=Oe,Ke=Ne,Xe=Ie,Ze=Le,Qe=0,lt=0,ot=0,st=0;k.bbox={};let ht=!1,pt=!1,mt=!1,xt=!1,wt=!1,_t=!1;function vt(l,e,t){(t||l!=k.width||e!=k.height)&&kt(l,e),An(!1),mt=!0,pt=!0,Jn()}function kt(l,e){k.width=Fe=Ie=l,k.height=Ge=Le=e,Oe=Ne=0,function(){let l=!1,e=!1,t=!1,n=!1;xl.forEach((i=>{if(i.show&&i._show){let{side:o,_size:s}=i,r=s+(null!=i.label?i.labelSize:0);r>0&&(o%2?(Ie-=r,3==o?(Oe+=r,n=!0):t=!0):(Le-=r,0==o?(Ne+=r,l=!0):e=!0))}})),Ct[0]=l,Ct[1]=t,Ct[2]=e,Ct[3]=n,Ie-=Rt[1]+Rt[3],Oe+=Rt[3],Le-=Rt[2]+Rt[0],Ne+=Rt[0]}(),function(){let l=Oe+Ie,e=Ne+Le,t=Oe,n=Ne;function i(i,o){switch(i){case 1:return l+=o,l-o;case 2:return e+=o,e-o;case 3:return t-=o,t+o;case 0:return n-=o,n+o}}xl.forEach((l=>{if(l.show&&l._show){let e=l.side;l._pos=i(e,l._size),null!=l.label&&(l._lpos=i(e,l.labelSize))}}))}();let t=k.bbox;Qe=t.left=zl(Oe*y,.5),lt=t.top=zl(Ne*y,.5),ot=t.width=zl(Ie*y,.5),st=t.height=zl(Le*y,.5)}const yt=3;if(k.setSize=function({width:l,height:e}){vt(l,e)},null==oe.dataIdx){let l=oe.hover,e=l.skip=new Set(l.skip??[]);e.add(void 0);let t=l.prox=bl(l.prox),n=l.bias??=0;oe.dataIdx=(l,i,o,s)=>{if(0==i)return o;let r=o,u=t(l,i,o,s)??gl,a=u>=0&&gl>u,f=0==jl.ori?Ie:Le,c=oe.left,h=g[0],d=g[i];if(e.has(d[o])){r=null;let l,t=null,i=null;if(0==n||-1==n)for(l=o;null==t&&l-- >0;)e.has(d[l])||(t=l);if(0==n||1==n)for(l=o;null==i&&l++<d.length;)e.has(d[l])||(i=l);if(null!=t||null!=i)if(a){let l=c-(null==t?-1/0:$l(h[t],jl,f,0)),e=(null==i?1/0:$l(h[i],jl,f,0))-c;l>e?e>u||(r=i):l>u||(r=t)}else r=null==i?t:null==t||o-t>i-o?i:t}else a&&ol(c-$l(h[o],jl,f,0))>u&&(r=null);return r}}const Mt=l=>{oe.event=l};oe.idxs=te,oe._lock=!1;let St=oe.points;St.show=bl(St.show),St.size=bl(St.size),St.stroke=bl(St.stroke),St.width=bl(St.width),St.fill=bl(St.fill);const Tt=k.focus=Bl({},u.focus||{alpha:.3},oe.focus),Et=Tt.prox>=0,zt=Et&&St.one;let Dt=[],Pt=[],At=[];function Wt(l,e){let t=St.show(k,e);if(t instanceof HTMLElement)return S(t,\"u-cursor-pt\"),S(t,l.class),A(t,-10,-10,Ie,Le),el.insertBefore(t,Dt[e]),t}function Yt(t,n){if(1==M||n>0){let l=1==M&&vl[t.scale].time,e=t.value;t.value=l?Ll(e)?We(Xl,Ae(e,Zl)):e||ee:e||nt,t.label=t.label||(l?\"Time\":\"Value\")}if(zt||n>0){t.width=null==t.width?1:t.width,t.paths=t.paths||Ot||yl,t.fillTo=bl(t.fillTo||gt),t.pxAlign=+Q(t.pxAlign,tl),t.pxRound=bt(t.pxAlign),t.stroke=bl(t.stroke||null),t.fill=bl(t.fill||null),t._stroke=t._fill=t._paths=t._focus=null;let l=function(l){return Al(1*(3+2*(l||1)),3)}(fl(1,t.width)),e=t.points=Bl({},{size:l,width:fl(1,.2*l),stroke:t.stroke,space:2*l,paths:Nt,_stroke:null,_fill:null},t.points);e.show=bl(e.show),e.filter=bl(e.filter),e.fill=bl(e.fill),e.stroke=bl(e.stroke),e.paths=bl(e.paths),e.pxAlign=t.pxAlign}if(se){let i=function(t,n){if(0==n&&(xe||!ie.live||2==M))return Rl;let i=[],o=z(\"tr\",\"u-series\",de,de.childNodes[n]);S(o,t.class),t.show||S(o,l);let s=z(\"th\",null,o);if(ue.show){let l=D(\"u-marker\",s);if(n>0){let e=ue.width(k,n);e&&(l.style.border=e+\"px \"+ue.dash(k,n)+\" \"+ue.stroke(k,n)),l.style.background=ue.fill(k,n)}}let r=D(e,s);for(var u in t.label instanceof HTMLElement?r.appendChild(t.label):r.textContent=t.label,n>0&&(ue.show||(r.style.color=t.width>0?ue.stroke(k,n):ue.fill(k,n)),Ce(\"click\",s,(l=>{if(oe._lock)return;Mt(l);let e=pl.indexOf(t);if((l.ctrlKey||l.metaKey)!=ie.isolate){let l=pl.some(((l,t)=>t>0&&t!=e&&l.show));pl.forEach(((t,n)=>{n>0&&oi(n,l?n==e?be:ve:be,!0,Fi.setSeries)}))}else oi(e,{show:!t.show},!0,Fi.setSeries)}),!1),Et&&Ce(d,s,(l=>{oe._lock||(Mt(l),oi(pl.indexOf(t),ai,!0,Fi.setSeries))}),!1)),pe){let l=z(\"td\",\"u-value\",o);l.textContent=\"--\",i.push(l)}return[o,i]}(t,n);me.splice(n,0,i[0]),ge.splice(n,0,i[1]),ie.values.push(null)}if(re){te.splice(n,0,null);let l=null;zt?0==n&&(l=Wt(t,n)):n>0&&(l=Wt(t,n)),Dt.splice(n,0,l),Pt.splice(n,0,0),At.splice(n,0,0)}Ci(\"addSeries\",n)}k.addSeries=function(l,e){e=null==e?pl.length:e,l=1==M?Ut(l,e,Ve,ut):Ut(l,e,{},rt),pl.splice(e,0,l),Yt(pl[e],e)},k.delSeries=function(l){if(pl.splice(l,1),se){ie.values.splice(l,1),ge.splice(l,1);let e=me.splice(l,1)[0];He(null,e.firstChild),e.remove()}re&&(te.splice(l,1),Dt.splice(l,1)[0].remove(),Pt.splice(l,1),At.splice(l,1)),Ci(\"delSeries\",l)};const Ct=[!1,!1,!1,!1];function Ht(l,e,t){let[n,i,o,s]=t,r=e%2,u=0;return 0==r&&(s||i)&&(u=0==e&&!n||2==e&&!o?rl(Ue.size/3):0),1==r&&(n||o)&&(u=1==e&&!i||3==e&&!s?rl(it.size/2):0),u}const Ft=k.padding=(u.padding||[Ht,Ht,Ht,Ht]).map((l=>bl(Q(l,Ht)))),Rt=k._padding=Ft.map(((l,e)=>l(k,e,Ct,0)));let Gt,Lt=null,en=null;const tn=1==M?pl[0].idxs:null;let nn,on,sn,rn,un,an,fn,cn,hn,dn,pn=null,mn=!1;function gn(l,e){if(k.data=k._data=g=null==l?[]:l,2==M){Gt=0;for(let l=1;pl.length>l;l++)Gt+=g[l][0].length}else{0==g.length&&(k.data=k._data=g=[[]]),pn=g[0],Gt=pn.length;let l=g;if(2==Ul){l=g.slice();let e=l[0]=Array(Gt);for(let l=0;Gt>l;l++)e[l]=l}k._data=g=l}if(An(!0),Ci(\"setData\"),2==Ul&&(mt=!0),!1!==e){let l=jl;l.auto(k,mn)?xn():ii(El,l.min,l.max),xt=xt||oe.left>=0,_t=!0,Jn()}}function xn(){let l,e;mn=!0,1==M&&(Gt>0?(Lt=tn[0]=0,en=tn[1]=Gt-1,l=g[0][Lt],e=g[0][en],2==Ul?(l=Lt,e=en):l==e&&(3==Ul?[l,e]=B(l,l,jl.log,!1):4==Ul?[l,e]=$(l,l,jl.log,!1):jl.time?e=l+rl(86400/hl):[l,e]=Z(l,e,J,!0))):(Lt=tn[0]=l=null,en=tn[1]=e=null)),ii(El,l,e)}function wn(l,e,t,n,i,o){l??=a,t??=Fl,n??=\"butt\",i??=a,o??=\"round\",l!=nn&&(K.strokeStyle=nn=l),i!=on&&(K.fillStyle=on=i),e!=sn&&(K.lineWidth=sn=e),o!=un&&(K.lineJoin=un=o),n!=an&&(K.lineCap=an=n),t!=rn&&K.setLineDash(rn=t)}function _n(l,e,t,n){e!=on&&(K.fillStyle=on=e),l!=fn&&(K.font=fn=l),t!=cn&&(K.textAlign=cn=t),n!=hn&&(K.textBaseline=hn=n)}function bn(l,e,t,n,i=0){if(n.length>0&&l.auto(k,mn)&&(null==e||null==e.min)){let e=Q(Lt,0),o=Q(en,n.length-1),s=null==t.min?function(l,e,t,n=0,i=!1){let o=i?V:U,s=i?j:N;[e,t]=o(l,e,t);let r=l[e],u=l[e];if(e>-1)if(1==n)r=l[e],u=l[t];else if(-1==n)r=l[t],u=l[e];else for(let n=e;t>=n;n++){let e=l[n];s(e)&&(r>e?r=e:e>u&&(u=e))}return[r??gl,u??-gl]}(n,e,o,i,3==l.distr):[t.min,t.max];l.min=al(l.min,t.min=s[0]),l.max=fl(l.max,t.max=s[1])}}k.setData=gn;const vn={min:null,max:null};function kn(l,e){let t=e?pl[l].points:pl[l];t._stroke=t.stroke(k,l),t._fill=t.fill(k,l)}function yn(l,e){let t=e?pl[l].points:pl[l],{stroke:n,fill:i,clip:o,flags:s,_stroke:r=t._stroke,_fill:u=t._fill,_width:a=t.width}=t._paths;a=Al(a*y,3);let f=null,c=a%2/2;e&&null==u&&(u=a>0?\"#fff\":r);let h=1==t.pxAlign&&c>0;if(h&&K.translate(c,c),!e){let l=Qe-a/2,e=lt-a/2,t=ot+a,n=st+a;f=new Path2D,f.rect(l,e,t,n)}e?Sn(r,a,t.dash,t.cap,u,n,i,s,o):function(l,e,t,n,i,o,s,r,u,a,f){let c=!1;0!=u&&Tl.forEach(((h,d)=>{if(h.series[0]==l){let l,p=pl[h.series[1]],m=g[h.series[1]],x=(p._paths||Hl).band;Gl(x)&&(x=1==h.dir?x[0]:x[1]);let w=null;p.show&&x&&function(l,e,t){for(e=Q(e,0),t=Q(t,l.length-1);t>=e;){if(null!=l[e])return!0;e++}return!1}(m,Lt,en)?(w=h.fill(k,d)||o,l=p._paths.clip):x=null,Sn(e,t,n,i,w,s,r,u,a,f,l,x),c=!0}})),c||Sn(e,t,n,i,o,s,r,u,a,f)}(l,r,a,t.dash,t.cap,u,n,i,s,f,o),h&&K.translate(-c,-c)}const Mn=3;function Sn(l,e,t,n,i,o,s,r,u,a,f,c){wn(l,e,t,n,i),(u||a||c)&&(K.save(),u&&K.clip(u),a&&K.clip(a)),c?(r&Mn)==Mn?(K.clip(c),f&&K.clip(f),En(i,s),Tn(l,o,e)):2&r?(En(i,s),K.clip(c),Tn(l,o,e)):1&r&&(K.save(),K.clip(c),f&&K.clip(f),En(i,s),K.restore(),Tn(l,o,e)):(En(i,s),Tn(l,o,e)),(u||a||c)&&K.restore()}function Tn(l,e,t){t>0&&(e instanceof Map?e.forEach(((l,e)=>{K.strokeStyle=nn=e,K.stroke(l)})):null!=e&&l&&K.stroke(e))}function En(l,e){e instanceof Map?e.forEach(((l,e)=>{K.fillStyle=on=e,K.fill(l)})):null!=e&&l&&K.fill(e)}function zn(l,e,t,n,i,o,s,r,u,a){let f=s%2/2;1==tl&&K.translate(f,f),wn(r,s,u,a,r),K.beginPath();let c,h,d,p,m=i+(0==n||3==n?-o:o);0==t?(h=i,p=m):(c=i,d=m);for(let n=0;l.length>n;n++)null!=e[n]&&(0==t?c=d=l[n]:h=p=l[n],K.moveTo(c,h),K.lineTo(d,p));K.stroke(),1==tl&&K.translate(-f,-f)}function Dn(l){let e=!0;return xl.forEach(((t,n)=>{if(!t.show)return;let i=vl[t.scale];if(null==i.min)return void(t._show&&(e=!1,t._show=!1,An(!1)));t._show||(e=!1,t._show=!0,An(!1));let o=t.side,s=o%2,{min:r,max:u}=i,[a,f]=function(l,e,t,n){let i,o=xl[l];if(n>0){let s=o._space=o.space(k,l,e,t,n);i=Zt(e,t,o._incrs=o.incrs(k,l,e,t,n,s),n,s)}else i=[0,0];return o._found=i}(n,r,u,0==s?Ie:Le);if(0==f)return;let c=t._splits=t.splits(k,n,r,u,a,f,2==i.distr),h=2==i.distr?c.map((l=>pn[l])):c,d=2==i.distr?pn[c[1]]-pn[c[0]]:a,p=t._values=t.values(k,t.filter(k,h,n,f,d),n,f,d);t._rotate=2==o?t.rotate(k,p,n,f):0;let m=t._size;t._size=ul(t.size(k,p,n,l)),null!=m&&t._size!=m&&(e=!1)})),e}function Pn(l){let e=!0;return Ft.forEach(((t,n)=>{let i=t(k,n,Ct,l);i!=Rt[n]&&(e=!1),Rt[n]=i})),e}function An(l){pl.forEach(((e,t)=>{t>0&&(e._paths=null,l&&(1==M?(e.min=null,e.max=null):e.facets.forEach((l=>{l.min=null,l.max=null}))))}))}let Wn,Yn,Cn,Hn,Fn,Rn,Gn,In,Ln,On,Nn,jn,Un=!1,Vn=!1,Bn=[];function $n(){Vn=!1;for(let l=0;Bn.length>l;l++)Ci(...Bn[l]);Bn.length=0}function Jn(){Un||(Jl(qn),Un=!0)}function qn(){if(ht&&(function(){for(let l in vl){let e=vl[l];null==Kl[l]&&(null==e.min||null!=Kl[El]&&e.auto(k,mn))&&(Kl[l]=vn)}for(let l in vl){let e=vl[l];null==Kl[l]&&null!=e.from&&null!=Kl[e.from]&&(Kl[l]=vn)}null!=Kl[El]&&An(!0);let l={};for(let e in Kl){let t=Kl[e];if(null!=t){let n=l[e]=Vl(vl[e],Nl);if(null!=t.min)Bl(n,t);else if(e!=El||2==M)if(0==Gt&&null==n.from){let l=n.range(k,null,null,e);n.min=l[0],n.max=l[1]}else n.min=gl,n.max=-gl}}if(Gt>0){pl.forEach(((e,t)=>{if(1==M){let n=e.scale,i=Kl[n];if(null==i)return;let o=l[n];if(0==t){let l=o.range(k,o.min,o.max,n);o.min=l[0],o.max=l[1],Lt=L(o.min,g[0]),en=L(o.max,g[0]),en-Lt>1&&(o.min>g[0][Lt]&&Lt++,g[0][en]>o.max&&en--),e.min=pn[Lt],e.max=pn[en]}else e.show&&e.auto&&bn(o,i,e,g[t],e.sorted);e.idxs[0]=Lt,e.idxs[1]=en}else if(t>0&&e.show&&e.auto){let[n,i]=e.facets,o=n.scale,s=i.scale,[r,u]=g[t],a=l[o],f=l[s];null!=a&&bn(a,Kl[o],n,r,n.sorted),null!=f&&bn(f,Kl[s],i,u,i.sorted),e.min=i.min,e.max=i.max}}));for(let e in l){let t=l[e],n=Kl[e];if(null==t.from&&(null==n||null==n.min)){let l=t.range(k,t.min==gl?null:t.min,t.max==-gl?null:t.max,e);t.min=l[0],t.max=l[1]}}}for(let e in l){let t=l[e];if(null!=t.from){let n=l[t.from];if(null==n.min)t.min=t.max=null;else{let l=t.range(k,n.min,n.max,e);t.min=l[0],t.max=l[1]}}}let e={},t=!1;for(let n in l){let i=l[n],o=vl[n];if(o.min!=i.min||o.max!=i.max){o.min=i.min,o.max=i.max;let l=o.distr;o._min=3==l?dl(o.min):4==l?ml(o.min,o.asinh):100==l?o.fwd(o.min):o.min,o._max=3==l?dl(o.max):4==l?ml(o.max,o.asinh):100==l?o.fwd(o.max):o.max,e[n]=t=!0}}if(t){pl.forEach(((l,t)=>{2==M?t>0&&e.y&&(l._paths=null):e[l.scale]&&(l._paths=null)}));for(let l in e)mt=!0,Ci(\"setScale\",l);re&&oe.left>=0&&(xt=_t=!0)}for(let l in Kl)Kl[l]=null}(),ht=!1),mt&&(function(){let l=!1,e=0;for(;!l;){e++;let t=Dn(e),n=Pn(e);l=e==yt||t&&n,l||(kt(k.width,k.height),pt=!0)}}(),mt=!1),pt){if(E(ll,s,Oe),E(ll,i,Ne),E(ll,t,Ie),E(ll,n,Le),E(el,s,Oe),E(el,i,Ne),E(el,t,Ie),E(el,n,Le),E(X,t,Fe),E(X,n,Ge),O.width=rl(Fe*y),O.height=rl(Ge*y),xl.forEach((({_el:e,_show:t,_size:n,_pos:i,side:o})=>{if(null!=e)if(t){let t=o%2==1;E(e,t?\"left\":\"top\",i-(3===o||0===o?n:0)),E(e,t?\"width\":\"height\",n),E(e,t?\"top\":\"left\",t?Ne:Oe),E(e,t?\"height\":\"width\",t?Le:Ie),T(e,l)}else S(e,l)})),nn=on=sn=un=an=fn=cn=hn=rn=null,dn=1,_i(!0),Oe!=je||Ne!=Ke||Ie!=Xe||Le!=Ze){An(!1);let l=Ie/Xe,e=Le/Ze;if(re&&!xt&&oe.left>=0){oe.left*=l,oe.top*=e,Cn&&A(Cn,rl(oe.left),0,Ie,Le),Hn&&A(Hn,0,rl(oe.top),Ie,Le);for(let t=0;Dt.length>t;t++){let n=Dt[t];null!=n&&(Pt[t]*=l,At[t]*=e,A(n,ul(Pt[t]),ul(At[t]),Ie,Le))}}if(ei.show&&!wt&&ei.left>=0&&ei.width>0){ei.left*=l,ei.width*=l,ei.top*=e,ei.height*=e;for(let l in ki)E(ti,l,ei[l])}je=Oe,Ke=Ne,Xe=Ie,Ze=Le}Ci(\"setSize\"),pt=!1}Fe>0&&Ge>0&&(K.clearRect(0,0,O.width,O.height),Ci(\"drawClear\"),Pl.forEach((l=>l())),Ci(\"draw\")),ei.show&&wt&&(ni(ei),wt=!1),re&&xt&&(xi(null,!0,!1),xt=!1),ie.show&&ie.live&&_t&&(mi(),_t=!1),F||(F=!0,k.status=1,Ci(\"ready\")),mn=!1,Un=!1}function Kn(l,e){let t=vl[l];if(null==t.from){if(0==Gt){let n=t.range(k,e.min,e.max,l);e.min=n[0],e.max=n[1]}if(e.min>e.max){let l=e.min;e.min=e.max,e.max=l}if(Gt>1&&null!=e.min&&null!=e.max&&1e-16>e.max-e.min)return;l==El&&2==t.distr&&Gt>0&&(e.min=L(e.min,g[0]),e.max=L(e.max,g[0]),e.min==e.max&&e.max++),Kl[l]=e,ht=!0,Jn()}}k.batch=function(l,e=!1){Un=!0,Vn=e,l(k),qn(),e&&Bn.length>0&&queueMicrotask($n)},k.redraw=(l,e)=>{mt=e||!1,!1!==l?ii(El,jl.min,jl.max):Jn()},k.setScale=Kn;let Xn=!1;const Zn=oe.drag;let Qn=Zn.x,li=Zn.y;re&&(oe.x&&(Wn=D(\"u-cursor-x\",el)),oe.y&&(Yn=D(\"u-cursor-y\",el)),0==jl.ori?(Cn=Wn,Hn=Yn):(Cn=Yn,Hn=Wn),Nn=oe.left,jn=oe.top);const ei=k.select=Bl({show:!0,over:!0,left:0,width:0,top:0,height:0},u.select),ti=ei.show?D(\"u-select\",ei.over?el:ll):null;function ni(l,e){if(ei.show){for(let e in l)ei[e]=l[e],e in ki&&E(ti,e,l[e]);!1!==e&&Ci(\"setSelect\")}}function ii(l,e,t){Kn(l,{min:e,max:t})}function oi(e,t,n,i){null!=t.focus&&function(l){if(l!=ui){let e=null==l,t=1!=Tt.alpha;pl.forEach(((n,i)=>{if(1==M||i>0){let o=e||0==i||i==l;n._focus=e?null:o,t&&function(l,e){pl[l].alpha=e,re&&null!=Dt[l]&&(Dt[l].style.opacity=e),se&&me[l]&&(me[l].style.opacity=e)}(i,o?1:Tt.alpha)}})),ui=l,t&&Jn()}}(e),null!=t.show&&pl.forEach(((n,i)=>{0>=i||e!=i&&null!=e||(n.show=t.show,function(e){if(pl[e].show)se&&T(me[e],l);else if(se&&S(me[e],l),re){let l=zt?Dt[0]:Dt[e];null!=l&&A(l,-10,-10,Ie,Le)}}(i),2==M?(ii(n.facets[0].scale,null,null),ii(n.facets[1].scale,null,null)):ii(n.scale,null,null),Jn())})),!1!==n&&Ci(\"setSeries\",e,t),i&&Ii(\"setSeries\",k,e,t)}let si,ri,ui;k.setSelect=ni,k.setSeries=oi,k.addBand=function(l,e){l.fill=bl(l.fill||null),l.dir=Q(l.dir,-1),Tl.splice(e=null==e?Tl.length:e,0,l)},k.setBand=function(l,e){Bl(Tl[l],e)},k.delBand=function(l){null==l?Tl.length=0:Tl.splice(l,1)};const ai={focus:!0};function fi(l,e,t){let n=vl[e];t&&(l=l/y-(1==n.ori?Ne:Oe));let i=Ie;1==n.ori&&(i=Le,l=i-l),-1==n.dir&&(l=i-l);let o=n._min,s=o+l/i*(n._max-o),r=n.distr;return 3==r?cl(10,s):4==r?((l,e=1)=>nl.sinh(l)*e)(s,n.asinh):100==r?n.bwd(s):s}function ci(l,e){E(ti,s,ei.left=l),E(ti,t,ei.width=e)}function hi(l,e){E(ti,i,ei.top=l),E(ti,n,ei.height=e)}se&&Et&&Ce(p,ce,(l=>{oe._lock||(Mt(l),null!=ui&&oi(null,ai,!0,Fi.setSeries))})),k.valToIdx=l=>L(l,g[0]),k.posToIdx=function(l,e){return L(fi(l,El,e),g[0],Lt,en)},k.posToVal=fi,k.valToPos=(l,e,t)=>0==vl[e].ori?P(l,vl[e],t?ot:Ie,t?Qe:0):W(l,vl[e],t?st:Le,t?lt:0),k.setCursor=(l,e,t)=>{Nn=l.left,jn=l.top,xi(null,e,t)};let di=0==jl.ori?ci:hi,pi=1==jl.ori?ci:hi;function mi(l,e){if(null!=l&&(l.idxs?l.idxs.forEach(((l,e)=>{te[e]=l})):(l=>void 0===l)(l.idx)||te.fill(l.idx),ie.idx=te[0]),se&&ie.live){for(let l=0;pl.length>l;l++)(l>0||1==M&&!xe)&&gi(l,te[l]);!function(){if(se&&ie.live)for(let l=2==M?1:0;pl.length>l;l++){if(0==l&&xe)continue;let e=ie.values[l],t=0;for(let n in e)ge[l][t++].firstChild.nodeValue=e[n]}}()}_t=!1,!1!==e&&Ci(\"setLegend\")}function gi(l,e){let t,n=pl[l],i=0==l&&2==Ul?pn:g[l];xe?t=n.values(k,l,e)??we:(t=n.value(k,null==e?null:i[e],l,e),t=null==t?we:{_:t}),ie.values[l]=t}function xi(l,e,t){let n;Ln=Nn,On=jn,[Nn,jn]=oe.move(k,Nn,jn),oe.left=Nn,oe.top=jn,re&&(Cn&&A(Cn,rl(Nn),0,Ie,Le),Hn&&A(Hn,0,rl(jn),Ie,Le)),si=gl,ri=null;let i=0==jl.ori?Ie:Le,o=1==jl.ori?Ie:Le;if(0>Nn||0==Gt||Lt>en){n=oe.idx=null;for(let l=0;pl.length>l;l++){let e=Dt[l];null!=e&&A(e,-10,-10,Ie,Le)}Et&&oi(null,ai,!0,null==l&&Fi.setSeries),ie.live&&(te.fill(n),_t=!0)}else{let l,e,t;1==M&&(l=0==jl.ori?Nn:jn,e=fi(l,El),n=oe.idx=L(e,g[0],Lt,en),t=$l(g[0][n],jl,i,0));let s=-10,r=-10,u=0,a=0,f=!0,c=\"\",h=\"\";for(let l=2==M?1:0;pl.length>l;l++){let d=pl[l],p=te[l],m=null==p?null:1==M?g[l][p]:g[l][1][p],x=oe.dataIdx(k,l,n,e),w=null==x?null:1==M?g[l][x]:g[l][1][x];if(_t=_t||w!=m||x!=p,te[l]=x,l>0&&d.show){let e=null==x?-10:x==n?t:$l(1==M?g[0][x]:g[l][0][x],jl,i,0),p=null==w?-10:ql(w,1==M?vl[d.scale]:vl[d.facets[1].scale],o,0);if(Et&&null!=w){let e=1==jl.ori?Nn:jn,t=ol(Tt.dist(k,l,x,p,e));if(si>t){let n=Tt.bias;if(0!=n){let i=fi(e,d.scale),o=0>i?-1:1;o!=(0>w?-1:1)||(1==o?1==n?i>w:w>i:1==n?w>i:i>w)||(si=t,ri=l)}else si=t,ri=l}}if(_t||zt){let t,n;0==jl.ori?(t=e,n=p):(t=p,n=e);let i,o,d,m,g,x,w=!0,_=St.bbox;if(null!=_){w=!1;let e=_(k,l);d=e.left,m=e.top,i=e.width,o=e.height}else d=t,m=n,i=o=St.size(k,l);if(x=St.fill(k,l),g=St.stroke(k,l),zt)l!=ri||si>Tt.prox||(s=d,r=m,u=i,a=o,f=w,c=x,h=g);else{let e=Dt[l];null!=e&&(Pt[l]=d,At[l]=m,H(e,i,o,w),Y(e,x,g),A(e,ul(d),ul(m),Ie,Le))}}}}if(zt){let l=Tt.prox;if(_t||(null==ui?l>=si:si>l||ri!=ui)){let l=Dt[0];null!=l&&(Pt[0]=s,At[0]=r,H(l,u,a,f),Y(l,c,h),A(l,ul(s),ul(r),Ie,Le))}}}if(ei.show&&Xn)if(null!=l){let[e,t]=Fi.scales,[n,s]=Fi.match,[r,u]=l.cursor.sync.scales,a=l.cursor.drag;if(Qn=a._x,li=a._y,Qn||li){let a,f,c,h,d,{left:p,top:m,width:g,height:x}=l.select,w=l.scales[r].ori,_=l.posToVal,b=null!=e&&n(e,r),v=null!=t&&s(t,u);b&&Qn?(0==w?(a=p,f=g):(a=m,f=x),c=vl[e],h=$l(_(a,r),c,i,0),d=$l(_(a+f,r),c,i,0),di(al(h,d),ol(d-h))):di(0,i),v&&li?(1==w?(a=p,f=g):(a=m,f=x),c=vl[t],h=ql(_(a,u),c,o,0),d=ql(_(a+f,u),c,o,0),pi(al(h,d),ol(d-h))):pi(0,o)}else yi()}else{let l=ol(Ln-Fn),e=ol(On-Rn);if(1==jl.ori){let t=l;l=e,e=t}Qn=Zn.x&&l>=Zn.dist,li=Zn.y&&e>=Zn.dist;let t,n,s=Zn.uni;null!=s?Qn&&li&&(Qn=l>=s,li=e>=s,Qn||li||(e>l?li=!0:Qn=!0)):Zn.x&&Zn.y&&(Qn||li)&&(Qn=li=!0),Qn&&(0==jl.ori?(t=Gn,n=Nn):(t=In,n=jn),di(al(t,n),ol(n-t)),li||pi(0,o)),li&&(1==jl.ori?(t=Gn,n=Nn):(t=In,n=jn),pi(al(t,n),ol(n-t)),Qn||di(0,i)),Qn||li||(di(0,0),pi(0,0))}if(Zn._x=Qn,Zn._y=li,null==l){if(t){if(null!=Ri){let[l,e]=Fi.scales;Fi.values[0]=null!=l?fi(0==jl.ori?Nn:jn,l):null,Fi.values[1]=null!=e?fi(1==jl.ori?Nn:jn,e):null}Ii(f,k,Nn,jn,Ie,Le,n)}if(Et){let l=t&&Fi.setSeries,e=Tt.prox;null==ui?si>e||oi(ri,ai,!0,l):si>e?oi(null,ai,!0,l):ri!=ui&&oi(ri,ai,!0,l)}}_t&&(ie.idx=n,mi()),!1!==e&&Ci(\"setCursor\")}k.setLegend=mi;let wi=null;function _i(l=!1){l?wi=null:(wi=el.getBoundingClientRect(),Ci(\"syncRect\",wi))}function bi(l,e,t,n,i,o){oe._lock||Xn&&null!=l&&0==l.movementX&&0==l.movementY||(vi(l,e,t,n,i,o,0,!1,null!=l),null!=l?xi(null,!0,!0):xi(e,!0,!1))}function vi(l,e,t,n,i,o,s,r,u){if(null==wi&&_i(!1),Mt(l),null!=l)t=l.clientX-wi.left,n=l.clientY-wi.top;else{if(0>t||0>n)return Nn=-10,void(jn=-10);let[l,s]=Fi.scales,r=e.cursor.sync,[u,a]=r.values,[f,c]=r.scales,[h,d]=Fi.match,p=e.axes[0].side%2==1,m=0==jl.ori?Ie:Le,g=1==jl.ori?Ie:Le,x=p?o:i,w=p?i:o,_=p?n:t,b=p?t:n;if(t=null!=f?h(l,f)?C(u,vl[l],m,0):-10:m*(_/x),n=null!=c?d(s,c)?C(a,vl[s],g,0):-10:g*(b/w),1==jl.ori){let l=t;t=n,n=l}}!u||null!=e&&e.cursor.event.type!=f||(t>1&&Ie-1>t||(t=zl(t,Ie)),n>1&&Le-1>n||(n=zl(n,Le))),r?(Fn=t,Rn=n,[Gn,In]=oe.move(k,t,n)):(Nn=t,jn=n)}Object.defineProperty(k,\"rect\",{get:()=>(null==wi&&_i(!1),wi)});const ki={width:0,height:0,left:0,top:0};function yi(){ni(ki,!1)}let Mi,Si,Ti,Ei;function zi(l,e,t,n,i,o){Xn=!0,Qn=li=Zn._x=Zn._y=!1,vi(l,e,t,n,i,o,0,!0,!1),null!=l&&(Ce(h,b,Di,!1),Ii(c,k,Gn,In,Ie,Le,null));let{left:s,top:r,width:u,height:a}=ei;Mi=s,Si=r,Ti=u,Ei=a}function Di(l,e,t,n,i,o){Xn=Zn._x=Zn._y=!1,vi(l,e,t,n,i,o,0,!1,!0);let{left:s,top:r,width:u,height:a}=ei,f=u>0||a>0,c=Mi!=s||Si!=r||Ti!=u||Ei!=a;if(f&&c&&ni(ei),Zn.setScale&&f&&c){let l=s,e=u,t=r,n=a;if(1==jl.ori&&(l=r,e=a,t=s,n=u),Qn&&ii(El,fi(l,El),fi(l+e,El)),li)for(let l in vl){let e=vl[l];l!=El&&null==e.from&&e.min!=gl&&ii(l,fi(t+n,l),fi(t,l))}yi()}else oe.lock&&(oe._lock=!oe._lock,xi(e,!0,null!=l));null!=l&&(He(h,b),Ii(h,k,Nn,jn,Ie,Le,null))}function Pi(l){oe._lock||(Mt(l),xn(),yi(),null!=l&&Ii(m,k,Nn,jn,Ie,Le,null))}function Ai(){xl.forEach(ln),vt(k.width,k.height,!0)}G(x,v,Ai);const Wi={};Wi.mousedown=zi,Wi.mousemove=bi,Wi.mouseup=Di,Wi.dblclick=Pi,Wi.setSeries=(l,e,t,n)=>{-1!=(t=(0,Fi.match[2])(k,e,t))&&oi(t,n,!0,!1)},re&&(Ce(c,el,zi),Ce(f,el,bi),Ce(d,el,(l=>{Mt(l),_i(!1)})),Ce(p,el,(function(l){if(oe._lock)return;Mt(l);let e=Xn;if(Xn){let l,e,t=!0,n=!0,i=10;0==jl.ori?(l=Qn,e=li):(l=li,e=Qn),l&&e&&(t=i>=Nn||Nn>=Ie-i,n=i>=jn||jn>=Le-i),l&&t&&(Nn=Gn>Nn?0:Ie),e&&n&&(jn=In>jn?0:Le),xi(null,!0,!0),Xn=!1}Nn=-10,jn=-10,te.fill(null),xi(null,!0,!0),e&&(Xn=e)})),Ce(m,el,Pi),It.add(k),k.syncRect=_i);const Yi=k.hooks=u.hooks||{};function Ci(l,e,t){Vn?Bn.push([l,e,t]):l in Yi&&Yi[l].forEach((l=>{l.call(null,k,e,t)}))}(u.plugins||[]).forEach((l=>{for(let e in l.hooks)Yi[e]=(Yi[e]||[]).concat(l.hooks[e])}));const Hi=(l,e,t)=>t,Fi=Bl({key:null,setSeries:!1,filters:{pub:Ml,sub:Ml},scales:[El,pl[1]?pl[1].scale:null],match:[Sl,Sl,Hi],values:[null,null]},oe.sync);2==Fi.match.length&&Fi.match.push(Hi),oe.sync=Fi;const Ri=Fi.key,Gi=dt(Ri);function Ii(l,e,t,n,i,o,s){Fi.filters.pub(l,e,t,n,i,o,s)&&Gi.pub(l,e,t,n,i,o,s)}function Li(){Ci(\"init\",u,g),gn(g||u.data,!1),Kl[El]?Kn(El,Kl[El]):xn(),wt=ei.show&&(ei.width>0||ei.height>0),xt=_t=!0,vt(u.width,u.height)}return Gi.sub(k),k.pub=function(l,e,t,n,i,o,s){Fi.filters.sub(l,e,t,n,i,o,s)&&Wi[l](null,e,t,n,i,o,s)},k.destroy=function(){Gi.unsub(k),It.delete(k),Pe.clear(),I(x,v,Ai),R.remove(),ce?.remove(),Ci(\"destroy\")},pl.forEach(Yt),xl.forEach((function(l,e){if(l._show=l.show,l.show){let t=vl[l.scale];null==t&&(l.scale=l.side%2?pl[1].scale:El,t=vl[l.scale]);let n=t.time;l.size=bl(l.size),l.space=bl(l.space),l.rotate=bl(l.rotate),Gl(l.incrs)&&l.incrs.forEach((l=>{!Wl.has(l)&&Wl.set(l,Yl(l))})),l.incrs=bl(l.incrs||(2==t.distr?ae:n?1==hl?ke:Se:fe)),l.splits=bl(l.splits||(n&&1==t.distr?Ql:3==t.distr?Je:4==t.distr?qe:$e)),l.stroke=bl(l.stroke),l.grid.stroke=bl(l.grid.stroke),l.ticks.stroke=bl(l.ticks.stroke),l.border.stroke=bl(l.border.stroke);let i=l.values;l.values=Gl(i)&&!Gl(i[0])?bl(i):n?Gl(i)?De(Xl,ze(i,Zl)):Ll(i)?function(l,e){let t=ne(e);return(e,n)=>n.map((e=>t(l(e))))}(Xl,i):i||le:i||Be,l.filter=bl(l.filter||(3>t.distr||10!=t.log?3==t.distr&&2==t.log?tt:kl:et)),l.font=Qt(l.font),l.labelFont=Qt(l.labelFont),l._size=l.size(k,null,e,0),l._space=l._rotate=l._incrs=l._found=l._splits=l._values=null,l._size>0&&(Ct[e]=!0,l._el=D(\"u-axis\",X))}})),_?_ instanceof HTMLElement?(_.appendChild(R),Li()):_(k,Li):Li(),k}en.assign=Bl,en.fmtNum=tl,en.rangeNum=Z,en.rangeLog=B,en.rangeAsinh=$,en.orient=pt,en.pxRatio=y,en.join=function(l,e){if(function(l){let e=l[0][0],t=e.length;for(let n=1;l.length>n;n++){let i=l[n][0];if(i.length!=t)return!1;if(i!=e)for(let l=0;t>l;l++)if(i[l]!=e[l])return!1}return!0}(l)){let e=l[0].slice();for(let t=1;l.length>t;t++)e.push(...l[t].slice(1));return function(l,e=100){const t=l.length;if(1>=t)return!0;let n=0,i=t-1;for(;i>=n&&null==l[n];)n++;for(;i>=n&&null==l[i];)i--;if(n>=i)return!0;const o=fl(1,sl((i-n+1)/e));for(let e=l[n],t=n+o;i>=t;t+=o){const n=l[t];if(null!=n){if(e>=n)return!1;e=n}}return!0}(e[0])||(e=function(l){let e=l[0],t=e.length,n=Array(t);for(let l=0;n.length>l;l++)n[l]=l;n.sort(((l,t)=>e[l]-e[t]));let i=[];for(let e=0;l.length>e;e++){let o=l[e],s=Array(t);for(let l=0;t>l;l++)s[l]=o[n[l]];i.push(s)}return i}(e)),e}let t=new Set;for(let e=0;l.length>e;e++){let n=l[e][0],i=n.length;for(let l=0;i>l;l++)t.add(n[l])}let n=[Array.from(t).sort(((l,e)=>l-e))],i=n[0].length,o=new Map;for(let l=0;i>l;l++)o.set(n[0][l],l);for(let t=0;l.length>t;t++){let s=l[t],r=s[0];for(let l=1;s.length>l;l++){let u=s[l],a=Array(i).fill(void 0),f=e?e[t][l]:1,c=[];for(let l=0;u.length>l;l++){let e=u[l],t=o.get(r[l]);null===e?0!=f&&(a[t]=e,2==f&&c.push(t)):a[t]=e}$l(a,c,i),n.push(a)}}return n},en.fmtDate=ne,en.tzDate=function(l,e){let t;return\"UTC\"==e||\"Etc/UTC\"==e?t=new Date(+l+6e4*l.getTimezoneOffset()):e==ie?t=l:(t=new Date(l.toLocaleString(\"en-US\",{timeZone:e})),t.setMilliseconds(l.getMilliseconds())),t},en.sync=dt;{en.addGap=function(l,e,t){let n=l[l.length-1];n&&n[0]==e?n[1]=t:l.push([e,t])},en.clipGaps=wt;let l=en.paths={points:Wt};l.linear=Ft,l.stepped=function(l){const e=Q(l.align,1),t=Q(l.ascDesc,!1),n=Q(l.alignGaps,0),i=Q(l.extend,!1);return(l,o,s,r)=>pt(l,o,((u,a,f,c,h,d,p,m,g,x,w)=>{[s,r]=U(f,s,r);let _=u.pxRound,{left:b,width:v}=l.bbox,k=l=>_(d(l,c,x,m)),M=l=>_(p(l,h,w,g)),S=0==c.ori?Mt:St;const T={stroke:new Path2D,fill:null,clip:null,band:null,gaps:null,flags:1},E=T.stroke,z=c.dir*(0==c.ori?1:-1);let D=M(f[1==z?s:r]),P=k(a[1==z?s:r]),A=P,W=P;i&&-1==e&&(W=b,S(E,W,D)),S(E,P,D);for(let l=1==z?s:r;l>=s&&r>=l;l+=z){let t=f[l];if(null==t)continue;let n=k(a[l]),i=M(t);1==e?S(E,n,D):S(E,A,i),S(E,n,i),D=i,A=n}let Y=A;i&&1==e&&(Y=b+v,S(E,Y,D));let[C,H]=mt(l,o);if(null!=u.fill||0!=C){let e=T.fill=new Path2D(E),t=M(u.fillTo(l,o,u.min,u.max,C));S(e,Y,t),S(e,W,t)}if(!u.spanGaps){let i=[];i.push(..._t(a,f,s,r,z,k,n));let h=u.width*y/2,d=t||1==e?h:-h,p=t||-1==e?-h:h;i.forEach((l=>{l[0]+=d,l[1]+=p})),T.gaps=i=u.gaps(l,o,s,r,i),T.clip=wt(i,c.ori,m,g,x,w)}return 0!=H&&(T.band=2==H?[xt(l,o,s,r,E,-1),xt(l,o,s,r,E,1)]:xt(l,o,s,r,E,H)),T}))},l.bars=function(l){const e=Q((l=l||Hl).size,[.6,gl,1]),t=l.align||0,n=l.gap||0;let i=l.radius;i=null==i?[0,0]:\"number\"==typeof i?[i,0]:i;const o=bl(i),s=1-e[0],r=Q(e[1],gl),u=Q(e[2],1),a=Q(l.disp,Hl),f=Q(l.each,(()=>{})),{fill:c,stroke:h}=a;return(l,e,i,d)=>pt(l,e,((p,m,g,x,w,_,b,v,k,M,S)=>{let T,E,z=p.pxRound,D=t,P=n*y,A=r*y,W=u*y;0==x.ori?[T,E]=o(l,e):[E,T]=o(l,e);const Y=x.dir*(0==x.ori?1:-1);let C,H,F,R=0==x.ori?Tt:Et,G=0==x.ori?f:(l,e,t,n,i,o,s)=>{f(l,e,t,i,n,s,o)},I=Q(l.bands,Fl).find((l=>l.series[0]==e)),L=p.fillTo(l,e,p.min,p.max,null!=I?I.dir:0),O=z(b(L,w,S,k)),N=M,j=z(p.width*y),U=!1,V=null,B=null,$=null,J=null;null==c||0!=j&&null==h||(U=!0,V=c.values(l,e,i,d),B=new Map,new Set(V).forEach((l=>{null!=l&&B.set(l,new Path2D)})),j>0&&($=h.values(l,e,i,d),J=new Map,new Set($).forEach((l=>{null!=l&&J.set(l,new Path2D)}))));let{x0:q,size:K}=a;if(null!=q&&null!=K){D=1,m=q.values(l,e,i,d),2==q.unit&&(m=m.map((e=>l.posToVal(v+e*M,x.key,!0))));let t=K.values(l,e,i,d);H=2==K.unit?t[0]*M:_(t[0],x,M,v)-_(0,x,M,v),N=Rt(m,g,_,x,M,v,N),F=N-H+P}else N=Rt(m,g,_,x,M,v,N),F=N*s+P,H=N-F;1>F&&(F=0),H/2>j||(j=0),5>F&&(z=vl);let X=F>0;H=z(wl(N-F-(X?j:0),W,A)),C=(0==D?H/2:D==Y?0:H)-D*Y*((0==D?P/2:0)+(X?j/2:0));const Z={stroke:null,fill:null,clip:null,band:null,gaps:null,flags:0},ll=U?null:new Path2D;let el=null;if(null!=I)el=l.data[I.series[1]];else{let{y0:t,y1:n}=a;null!=t&&null!=n&&(g=n.values(l,e,i,d),el=t.values(l,e,i,d))}let tl=T*H,nl=E*H;for(let t=1==Y?i:d;t>=i&&d>=t;t+=Y){let n=g[t];if(null==n)continue;if(null!=el){let l=el[t]??0;if(n-l==0)continue;O=b(l,w,S,k)}let i=_(2!=x.distr||null!=a?m[t]:t,x,M,v),o=b(Q(n,L),w,S,k),s=z(i-C),r=z(fl(o,O)),u=z(al(o,O)),f=r-u;if(null!=n){let i=0>n?nl:tl,o=0>n?tl:nl;U?(j>0&&null!=$[t]&&R(J.get($[t]),s,u+sl(j/2),H,fl(0,f-j),i,o),null!=V[t]&&R(B.get(V[t]),s,u+sl(j/2),H,fl(0,f-j),i,o)):R(ll,s,u+sl(j/2),H,fl(0,f-j),i,o),G(l,e,t,s-j/2,u,H+j,f)}}return j>0?Z.stroke=U?J:ll:U||(Z._fill=0==p.width?p._fill:p._stroke??p._fill,Z.width=0),Z.fill=U?B:ll,Z}))},l.spline=function(l){return function(l,e){const t=Q(e?.alignGaps,0);return(e,n,i,o)=>pt(e,n,((s,r,u,a,f,c,h,d,p,m,g)=>{[i,o]=U(u,i,o);let x,w,_,b=s.pxRound,v=l=>b(c(l,a,m,d)),k=l=>b(h(l,f,g,p));0==a.ori?(x=kt,_=Mt,w=Pt):(x=yt,_=St,w=At);const y=a.dir*(0==a.ori?1:-1);let M=v(r[1==y?i:o]),S=M,T=[],E=[];for(let l=1==y?i:o;l>=i&&o>=l;l+=y)if(null!=u[l]){let e=v(r[l]);T.push(S=e),E.push(k(u[l]))}const z={stroke:l(T,E,x,_,w,b),fill:null,clip:null,band:null,gaps:null,flags:1},D=z.stroke;let[P,A]=mt(e,n);if(null!=s.fill||0!=P){let l=z.fill=new Path2D(D),t=k(s.fillTo(e,n,s.min,s.max,P));_(l,S,t),_(l,M,t)}if(!s.spanGaps){let l=[];l.push(..._t(r,u,i,o,y,v,t)),z.gaps=l=s.gaps(e,n,i,o,l),z.clip=wt(l,a.ori,d,p,m,g)}return 0!=A&&(z.band=2==A?[xt(e,n,i,o,D,-1),xt(e,n,i,o,D,1)]:xt(e,n,i,o,D,A)),z}))}(Gt,l)}}return en}();\n";
const UPLOT_CSS = ".uplot, .uplot *, .uplot *::before, .uplot *::after {box-sizing: border-box;}.uplot {font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\";line-height: 1.5;width: min-content;}.u-title {text-align: center;font-size: 18px;font-weight: bold;}.u-wrap {position: relative;user-select: none;}.u-over, .u-under {position: absolute;}.u-under {overflow: hidden;}.uplot canvas {display: block;position: relative;width: 100%;height: 100%;}.u-axis {position: absolute;}.u-legend {font-size: 14px;margin: auto;text-align: center;}.u-inline {display: block;}.u-inline * {display: inline-block;}.u-inline tr {margin-right: 16px;}.u-legend th {font-weight: 600;}.u-legend th > * {vertical-align: middle;display: inline-block;}.u-legend .u-marker {width: 1em;height: 1em;margin-right: 4px;background-clip: padding-box !important;}.u-inline.u-live th::after {content: \":\";vertical-align: middle;}.u-inline:not(.u-live) .u-value {display: none;}.u-series > * {padding: 4px;}.u-series th {cursor: pointer;}.u-legend .u-off > * {opacity: 0.3;}.u-select {background: rgba(0,0,0,0.07);position: absolute;pointer-events: none;}.u-cursor-x, .u-cursor-y {position: absolute;left: 0;top: 0;pointer-events: none;will-change: transform;}.u-hz .u-cursor-x, .u-vt .u-cursor-y {height: 100%;border-right: 1px dashed #607D8B;}.u-hz .u-cursor-y, .u-vt .u-cursor-x {width: 100%;border-bottom: 1px dashed #607D8B;}.u-cursor-pt {position: absolute;top: 0;left: 0;border-radius: 50%;border: 0 solid;pointer-events: none;will-change: transform;/*this has to be !important since we set inline \"background\" shorthand */background-clip: padding-box !important;}.u-axis.u-off, .u-select.u-off, .u-cursor-x.u-off, .u-cursor-y.u-off, .u-cursor-pt.u-off {display: none;}";
// ------------------------------------------------------------
//  Blocchi UI v3
// ------------------------------------------------------------
const LV = { ok: "#30D158", verde: "#30D158", giallo: "#FF9F0A", rosso: "#FF453A", info: "#64D2FF", basso: "#64D2FF" };
const WARN_ICO = (c) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5h.01"/></svg>`;
const scoreCol = (s) => (s >= 85 ? "#30D158" : s >= 65 ? "#FF9F0A" : "#FF453A");

function banner(level, title, text, extra = "") {
  const c = LV[level] || LV.info;
  return `<div class="card pad banner" style="box-shadow:inset 0 0 0 1px ${c}55">
    <div class="hstack" style="gap:10px;align-items:flex-start">${WARN_ICO(c)}<div class="grow"><div class="t15 semi" style="color:${c}">${esc(title)}</div><div class="t15" style="margin-top:4px;line-height:1.4;color:var(--mut)">${esc(text)}</div>${extra}</div></div>
  </div>`;
}

function checkinCard(diary, today, nudo) {
  const ck = (diary.checkins || {})[today] || {};
  const row = (k, lbl, lo, hi) => `<div class="ckrow"><div class="hstack" style="justify-content:space-between"><span class="t15 semi">${lbl}</span><span class="t13 muted">${lo} · ${hi}</span></div>
    <div class="ckbtns" data-k="${k}">${[1, 2, 3, 4, 5].map((v) => `<button class="ck${ck[k] === v ? " on" : ""}" data-v="${v}" aria-label="${lbl} ${v}">${v}</button>`).join("")}</div></div>`;
  return `${nudo ? "" : `<h2 class="ih">Come ti senti?<button class="info" data-info="checkin" aria-label="Cosa significa">i</button></h2>`}
  <div class="card pad" id="checkin">
    ${row("g", "Gambe", "1 pesanti", "5 fresche")}
    ${row("e", "Energia", "1 a terra", "5 carico")}
    ${row("u", "Umore", "1 giù", "5 ottimo")}
    <div class="t13 muted" id="ckstate">${ck.g ? "Check-in di oggi salvato" : "Tre tocchi: servono per imparare quali segnali contano per te"}</div>
  </div>`;
}

function predictorsCard(P) {
  const strength = (r) => (Math.abs(r) >= 0.5 ? "forte" : Math.abs(r) >= 0.3 ? "moderato" : "debole");
  const items = P.list.map((p) => {
    const good = p.r > 0 ? "più alto" : "più basso";
    const w = Math.round(Math.min(1, Math.abs(p.r)) * 100);
    return `<div class="pred"><div class="hstack" style="justify-content:space-between"><span class="t15 semi">${esc(p.lbl)}</span><span class="t13 muted">${strength(p.r)} · ${p.n} corse</span></div>
      <div class="t13" style="color:var(--mut)">Quando è ${good}, le tue corse vanno meglio</div>
      <div class="pbar"><div style="width:${w}%;background:${p.r > 0 ? "#30D158" : "#64D2FF"}"></div></div></div>`;
  }).join("");
  return `<h2 class="ih">Cosa ti predice<button class="info" data-info="predittori" aria-label="Cosa significa">i</button></h2>
  <div class="card pad">
    <div class="t13 muted" style="line-height:1.4">Confronto tra i segnali del mattino e il passo a parità di battiti nelle tue corse all'aperto (${P.nRuns} corse).</div>
    ${items || `<div class="t15">Nessun segnale chiaro per ora: servono più corse all'aperto.</div>`}
    <div class="topline t13 muted">Check-in raccolti: ${P.ckDays} giorni · ${P.ckPaired >= 12 ? `abbinati a ${P.ckPaired} corse: già valutati` : `abbinati a corse ${P.ckPaired}/12, poi entrano nel confronto`}</div>
  </div>`;
}

function adaptCard(ad) {
  if (!ad) return "";
  const rows = ad.items.map((it) => `<div class="adrow"><span class="evbar" style="background:${(SPORT[it.sport] || SPORT.altro).c}"></span>
    <div class="grow"><div class="t13 muted" style="text-decoration:line-through">${esc(it.name)} · ${fmtMin(it.min)}</div><div class="t17 semi">${esc(it.prop)}</div></div></div>`).join("");
  return `<div class="card pad adapt" id="adaptcard">
    <div class="hstack" style="gap:10px">${WARN_ICO("#FF9F0A")}<div class="grow"><div class="t17 semi">Proposta per oggi</div><div class="t13 muted">${esc(ad.why)}</div></div></div>
    ${rows}
    ${ad.move ? `<div class="t15" style="color:#FF9F0A">${esc(ad.move)}</div>` : ""}
    <button id="acceptAdapt" class="${ad.accepted ? "secondary" : "primary"}" ${ad.accepted ? "disabled" : ""}>${ad.accepted ? "✓ Accettata · ricordati di aggiornare Intervals" : "Accetta proposta"}</button>
  </div>`;
}

function impactCard(I) {
  if (I.chronic === null) return "";
  const max = 2, pos = (v) => Math.max(0, Math.min(100, (v / max) * 100));
  const mk = I.ratio === null ? 0 : pos(I.ratio);
  const lbl = { ok: "Nella norma", basso: "Sotto la tua media", giallo: "Alto: attenzione ai tessuti", rosso: "Troppo alto: rischio" }[I.state] || "—";
  const allW = [...I.hist, I.projected], mxW = Math.max(...allW, 1);
  const bars = I.hist.map((v, i) => `<div class="ibc"><div class="ibt"><div style="height:${(v / mxW * 100).toFixed(0)}%;background:#FFD60A;opacity:.35"></div></div><div class="sbl">−${4 - i}</div></div>`).join("") +
    `<div class="ibc"><div class="ibt"><div style="height:${(I.planned / mxW * 100).toFixed(0)}%;border:2px dashed #FFD60A;border-bottom:0;box-sizing:border-box;border-radius:5px 5px 0 0"></div><div style="height:${(I.done / mxW * 100).toFixed(0)}%;background:#FFD60A;border-radius:${I.planned ? "0" : "5px 5px"} 0 0"></div></div><div class="sbl" style="color:var(--fg);font-weight:600">ora</div></div>`;
  const tm = (x) => (x === null ? "—" : Math.round(x * 100) + "%");
  return `<h2 class="ih">Impatto della corsa<button class="info" data-info="impatto" aria-label="Cosa significa">i</button></h2>
  <div class="card pad">
    <div class="hstack" style="justify-content:space-between;align-items:flex-end">
      <div><div class="num34" style="color:${LV[I.state] || "inherit"}">${I.ratio === null ? "—" : "×" + fmtIt(I.ratio, 2)}</div><div class="t15 semi" style="color:${LV[I.state] || "inherit"}">${lbl}</div></div>
      <div style="text-align:right"><div class="t13 muted">a fine settimana</div><div class="num20">${fmtIt(I.projected)}<span class="unit"> / media ${fmtIt(I.chronic)}</span></div></div>
    </div>
    <div class="gauge"><div class="gz" style="left:0;width:35%;background:#64D2FF"></div><div class="gz" style="left:35%;width:30%;background:#30D158"></div><div class="gz" style="left:65%;width:10%;background:#FF9F0A"></div><div class="gz" style="left:75%;width:25%;background:#FF453A"></div><div class="gm" style="left:${mk}%"></div></div>
    <div class="ibars">${bars}</div>
    <div class="grid2 topline"><div><div class="label">Tapis questa settimana</div><div class="num20">${tm(I.tmWeek)}</div></div><div><div class="label">Tapis ultime 4 settimane</div><div class="num20" style="color:${I.tm4 > 0.5 ? "#FF9F0A" : "inherit"}">${tm(I.tm4)}</div></div></div>
    <div class="t13 muted" style="line-height:1.4">Km di corsa pesati per dislivello e intensità, confrontati con la media delle 4 settimane prima. Le sedute di qualità rendono di più all'aperto.</div>
  </div>`;
}

function reviewCard(R) {
  const pct = R.adherence === null ? "—" : Math.round(R.adherence * 100) + "%";
  return `<h2 class="ih">${R.final ? "Revisione della settimana" : "Revisione · in corso"}<button class="info" data-info="revisione" aria-label="Cosa significa">i</button></h2>
  <div class="card list">
    <div class="lrow"><span>Sedute svolte</span><span class="muted">${R.doneN} di ${R.total} · ${pct} di quelle già dovute</span></div><div class="sep l16"></div>
    <div class="lrow"><span>Tempo</span><span class="muted">${fmtMin(R.doneMin)} di ${fmtMin(R.plannedMin)}</span></div><div class="sep l16"></div>
    <div class="lrow"><span>Carico</span><span class="muted">${R.loadDone} TSS</span></div><div class="sep l16"></div>
    <div class="lrow"><span>Migliore esecuzione</span><span class="muted">${R.best ? esc(R.best.name) + " · " + R.best.score : "—"}</span></div><div class="sep l16"></div>
    <div class="lrow"><span>Sedute con avvisi</span><span style="color:${R.warns ? "#FF9F0A" : "#30D158"}">${R.warns}</span></div>
    <div class="propo">${esc(R.proposal)}</div>
  </div>
  <button class="secondary" id="shareReview" data-shlay="settimana">Condividi la revisione</button>`;
}

function weightCard(Wt) {
  if (!Wt) return "";
  const al = Wt.alert;
  const span = Wt.start && Wt.target ? Wt.start - Wt.target : null;
  const prog = span && Wt.now !== null ? Math.max(0, Math.min(1, (Wt.start - Wt.now) / span)) : null;
  const ser = Wt.series || [];
  let spark = "";
  if (ser.length > 2) {
    const vs = ser.map((x) => x.v), lo = Math.min(...vs, Wt.target || 999) - 0.5, hi = Math.max(...vs) + 0.5, n = ser.length;
    const X = (i) => 4 + (i / (n - 1)) * 318, Y = (v) => 4 + (1 - (v - lo) / (hi - lo)) * 62;
    spark = scrub(`<svg width="100%" height="70" viewBox="0 0 326 70" preserveAspectRatio="none"><path d="${ser.map((x, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(x.v).toFixed(1)).join(" ")}" fill="none" stroke="#BF5AF2" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${Wt.target ? `<line x1="0" x2="326" y1="${Y(Wt.target).toFixed(1)}" y2="${Y(Wt.target).toFixed(1)}" stroke="#8E8E93" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>` : ""}</svg>`, ser.map((x, i) => [X(i) / 326, Y(x.v) / 70, x.d ? dGiorno(x.d) : "", `${fmtIt(x.v, 1)} kg`, "#BF5AF2"]));
  }
  return `${banner(al.level === "ok" ? "ok" : al.level, al.level === "ok" ? "Piano in linea" : al.level === "info" ? "Da tenere d'occhio" : "Mangi poco per il carico", al.text)}
  <h2 class="ih">Peso<button class="info" data-info="peso" aria-label="Cosa significa">i</button></h2>
  <div class="card pad">
    <div class="hstack" style="justify-content:space-between;align-items:flex-end">
      <div><div class="num34">${Wt.now === null ? "—" : fmtIt(Wt.now, 1)}<span class="unit" style="font-size:15px"> kg</span></div><div class="t13 muted">media 7 giorni</div></div>
      <div style="text-align:right"><div class="num20">${Wt.rate === null ? "—" : Math.abs(Wt.rate) < 0.05 ? "stabile" : (Wt.rate < 0 ? "−" : "+") + fmtIt(Math.abs(Wt.rate), 1) + " kg/sett"}</div><div class="t13 muted">ritmo</div></div>
    </div>
    ${spark}
    ${prog !== null ? `<div><div class="hstack" style="justify-content:space-between" ><span class="t13 muted">${fmtIt(Wt.start)} kg</span><span class="t13 muted">obiettivo ${fmtIt(Wt.target)} kg</span></div><div class="pbar" style="height:8px"><div style="width:${(prog * 100).toFixed(0)}%;background:#30D158"></div></div></div>` : ""}
    <div class="hstack topline" style="gap:10px;align-items:center">
      <label for="pesoin" class="t15 grow">Peso di stamattina</label>
      <input id="pesoin" type="text" inputmode="decimal" placeholder="${Wt.oggi ? fmtIt(Wt.oggi, 1) : Wt.now !== null ? fmtIt(Wt.now, 1) : "70,0"}" value="${Wt.oggi ? fmtIt(Wt.oggi, 1) : ""}" style="width:84px;font:inherit;font-size:17px;text-align:right;color:var(--fg);background:var(--fill);border:0;border-radius:10px;padding:8px 10px">
      <button id="pesook" class="pill" type="button" style="border:0;color:#fff;background:var(--accbg);font:inherit;font-weight:600;padding:8px 12px">Salva</button>
    </div>
    ${bilanciaRiga(Wt.sync)}
  </div>`;
}

// Mangiato oggi: quello che hai detto a Siri o scritto qui, contro l'obiettivo del giorno
function mangiatoCard(N) {
  const PN = N.piano, CB = N.cibo || { lista: [], tot: { kcal: 0, C: 0, P: 0, G: 0 } }, T = CB.tot;
  const barra = (lbl, v, max, col, unit) => `<div><div class="hstack" style="justify-content:space-between"><span class="t15">${lbl}</span><span class="t15"><span class="semi">${fmtIt(v)}</span><span class="muted"> / ${fmtIt(max)} ${unit}</span></span></div><div class="pbar" style="height:6px;margin-top:6px"><div style="width:${Math.min(100, (v / Math.max(1, max)) * 100).toFixed(0)}%;background:${col}"></div></div></div>`;
  const resto = PN.kcal - T.kcal;
  const righe = CB.lista.slice().reverse().map((e) => `<div class="hstack" style="gap:10px;align-items:flex-start;padding:10px 0;border-top:.5px solid var(--sep)"><span class="t13 muted" style="width:40px;flex:none;padding-top:2px">${esc(e.ora)}</span><div class="grow"><div class="t15">${esc(descriviVoci(e.voci))}</div>${e.ignoti && e.ignoti.length ? `<div class="t13" style="color:var(--warn)">Non ho capito: ${esc(e.ignoti.join(", "))}</div>` : ""}</div><span class="t15 semi" style="white-space:nowrap">${fmtIt(totaleCibo([e]).kcal)}</span><button class="cdel" data-cdel="${esc(e.id)}" aria-label="Togli" style="border:0;background:none;color:var(--mut);font-size:20px;line-height:1;padding:0 2px">×</button></div>`).join("");
  return `<h2 class="ih">Mangiato oggi<button class="info" data-info="cibo" aria-label="Cosa significa">i</button></h2>
  <div class="card pad" style="gap:12px">
    ${barra("Calorie", T.kcal, PN.kcal, "#FF9F0A", "kcal")}
    ${barra("Carboidrati", T.C, PN.C, "#FF9F0A", "g")}
    ${barra("Proteine", T.P, PN.P, "#64D2FF", "g")}
    ${barra("Grassi", T.G, PN.G, "#BF5AF2", "g")}
    <div class="t13 muted">${T.kcal ? (resto >= 0 ? `Ti restano ${fmtIt(resto)} kcal e ${fmtIt(Math.max(0, PN.C - T.C))} g di carboidrati.` : `Sei ${fmtIt(-resto)} kcal sopra l'obiettivo di oggi.`) : "Ancora niente: dillo a Siri («Ho mangiato») o scrivilo qui sotto."}</div>
    ${righe ? `<div>${righe}</div>` : ""}
    <div class="hstack" style="gap:10px;align-items:center;border-top:.5px solid var(--sep);padding-top:12px">
      <input id="ciboin" type="text" placeholder="Es. 180 g di pasta e 150 g di pollo" style="flex:1;min-width:0;font:inherit;font-size:16px;color:var(--fg);background:var(--fill);border:0;border-radius:10px;padding:9px 10px">
      <button id="cibook" class="pill" type="button" style="border:0;color:#fff;background:var(--accbg);font:inherit;font-weight:600;padding:8px 12px">Segna</button>
    </div>
  </div>`;
}

// Il prossimo lungo con gli orari del rifornimento sull'orologio
function orologioRiga(L) {
  const quando = (ds) => { const g = daysBetween(new Date(), parseYMD(ds)), d = parseYMD(ds); return g === 0 ? "oggi" : g === 1 ? "domani" : `${GG[d.getDay()].toLowerCase()} ${d.getDate()}`; };
  const u = L.find((x) => !x.senza) || L[0];
  const sub = !u ? "Nessun lungo nelle prossime due settimane." : u.senza ? `${esc(u.nome)}, ${quando(u.date)}: avvisi spenti` : `${esc(u.nome)}, ${quando(u.date)}${u.scritto ? "" : " · si scrivono alla prossima apertura con internet"}`;
  const val = !u ? `<span class="t15 muted">—</span>` : u.scritto ? `<span class="t15 semi" style="color:var(--good)">Pronti</span>` : `<span class="t15 muted">Da scrivere</span>`;
  return `<div class="lrow"><div><div>Avvisi sull'orologio</div><div class="t13 muted" style="margin-top:2px">${sub}</div></div><div style="text-align:right;white-space:nowrap">${val}</div></div>`;
}

// Rifornimento: dosi di oggi verso la gara, sudore e acqua
function rifornimentoCard(RF) {
  if (!RF) return "";
  const tar = (sp) => (RF.tarato[sp] ? `tarato su ${RF.tarato[sp]} ${RF.tarato[sp] === 1 ? "lungo" : "lunghi"}` : "stima");
  const Ic = idratazione(RF, "corsa", false), Ib = idratazione(RF, "bici", false);
  const riga = (lbl, val, sub) => `<div class="lrow"><div><div>${lbl}</div><div class="t13 muted" style="margin-top:2px">${sub}</div></div><div style="text-align:right;white-space:nowrap">${val}</div></div>`;
  const stato = (sp) => { const u = RF.ultima[sp]; return `${RF.lunga ? `gara ${RF.gara[sp]} g/h · ` : ""}${u ? `ultimo lungo ${u.gh} g/h, stomaco ${u.stomaco}` : RF.lunga ? "segna il prossimo lungo per salire" : "segna i lunghi per tararla"}`; };
  const fa = (sp) => (CONFIG.sport || []).includes(sp);
  if (!fa("bici") && !fa("corsa")) return "";
  return `<h2 class="ih">Rifornimento<button class="info" data-info="rifornimento" aria-label="Cosa significa">i</button></h2>
  <div class="card list">
    ${fa("bici") ? `${riga("Bici nei lunghi", `<span class="num20">${RF.gh.bici}</span><span class="unit"> g/h</span>`, `carboidrati all'ora · ${stato("bici")}`)}<div class="sep l16"></div>` : ""}
    ${fa("corsa") ? `${riga("Corsa nei lunghi", `<span class="num20">${RF.gh.corsa}</span><span class="unit"> g/h</span>`, `carboidrati all'ora · ${stato("corsa")}`)}<div class="sep l16"></div>` : ""}
    ${riga("Sudore", `<span class="num20">${fmtIt(fa("corsa") ? Ic.Lh : Ib.Lh, 1)}</span><span class="unit"> L/h</span>`, fa("corsa") && fa("bici") ? `corsa, ${tar("corsa")} · bici ${fmtIt(Ib.Lh, 1)} L/h, ${tar("bici")}` : fa("corsa") ? `corsa, ${tar("corsa")}` : `bici, ${tar("bici")}`)}<div class="sep l16"></div>
    ${riga("Da bere", `<span class="num20">${fa("corsa") ? Ic.ml : Ib.ml}</span><span class="unit"> ml/h</span>`, fa("corsa") && fa("bici") ? `di corsa, con ${Ic.na} mg di sodio all'ora; in bici ${Ib.ml} ml e ${Ib.na} mg` : `con ${fa("corsa") ? Ic.na : Ib.na} mg di sodio all'ora`)}
    ${CONFIG.rifornimento.avvisiOrologio && (fa("bici") || fa("corsa")) ? `<div class="sep l16"></div>${orologioRiga(RF.orologio || [])}` : ""}
  </div>
  <div class="t13 muted" style="padding:0 16px;margin-top:-8px">${RF.T !== null && RF.T !== undefined ? `Temperatura delle ultime uscite: ${RF.T} °C. ` : ""}Le dosi salgono solo dopo un lungo con lo stomaco a posto.</div>`;
}

// Dopo una corsa o una bici da un'ora: carboidrati presi, stomaco, pesate prima e dopo
function lungoCard(RF) {
  const L = RF && RF.oggi;
  if (!L) return "";
  const v = L.salvato || {};
  const campo = (id, lbl, val, ph) => `<div class="hstack" style="gap:10px;align-items:center"><label for="${id}" class="t15 grow">${lbl}</label><input id="${id}" type="text" inputmode="decimal" value="${val ?? ""}" placeholder="${ph}" style="width:84px;font:inherit;font-size:17px;text-align:right;color:var(--fg);background:var(--fill);border:0;border-radius:10px;padding:8px 10px"></div>`;
  const ST = [["bene", "Bene"], ["pesante", "Pesante"], ["problemi", "Problemi"]];
  return `<h2>Dopo ${esc(L.nome)}</h2>
  <div class="card pad" id="lungo" data-sport="${L.sport}" data-min="${L.min}" data-t="${L.T}" data-st="${v.stomaco || ""}" style="gap:12px">
    <div class="t13 muted" style="line-height:1.4">${L.salvato ? `Salvato${L.Lh !== null ? `: hai sudato ${fmtIt(L.Lh, 1)} L all'ora` : ""}. Puoi correggerlo qui.` : `Trenta secondi: il piano impara quanti carboidrati regge il tuo stomaco e quanto sudi. Previsti ${L.carboPiano} g.`}</div>
    ${campo("lcarb", "Carboidrati presi (g)", v.carbo, L.carboPiano)}
    <div class="t15">Stomaco</div>
    <div class="stbtns" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${ST.map(([k, l]) => `<button class="ck${v.stomaco === k ? " on" : ""}" data-v="${k}" style="font-size:15px">${l}</button>`).join("")}</div>
    <div class="t13 muted" style="line-height:1.4;border-top:.5px solid var(--sep);padding-top:10px">Se ti sei pesato, nudo, prima e dopo:</div>
    ${campo("lpre", "Peso prima (kg)", v.pre, "70,0")}
    ${campo("lpost", "Peso dopo (kg)", v.post, "69,2")}
    ${campo("lbev", "Bevuto (ml)", v.bevuto || "", "750")}
    <button id="lungook" class="pill" type="button" style="border:0;color:#fff;background:var(--accbg);font:inherit;font-weight:600;padding:10px 12px">${L.salvato ? "Aggiorna" : "Salva"}</button>
  </div>`;
}

// Sotto la pesata: se la bilancia arriva da sola (Comando Rapido «Peso HUD») e quando è arrivata l'ultima
function bilanciaRiga(sy) {
  if (!sy) return `<div class="t13 muted" style="line-height:1.4">Vuoi che arrivi da solo dalla bilancia? Tocca <b>i</b> accanto a Peso: due minuti con Comandi Rapidi.</div>`;
  const quando = sy.giorni <= 0 ? "oggi" : sy.giorni === 1 ? "ieri" : `il ${parseYMD(sy.ultimo).getDate()} ${MESI_BREVI[parseYMD(sy.ultimo).getMonth()]}`;
  if (sy.giorni > 4) return `<div class="t13" style="line-height:1.4;color:#FF9F0A">Dalla bilancia non arriva niente da ${sy.giorni} giorni: ultima pesata ${quando}. Controlla in Salute che la bilancia scriva il peso.</div>`;
  return `<div class="t13 muted" style="line-height:1.4">Bilancia collegata · ultima pesata arrivata ${quando}.</div>`;
}

function trajectoryCard(T) {
  if (!T) return "";
  const t0 = parseYMD(T.targets[0].data).getTime(), t1 = parseYMD(T.race).getTime();
  const all = [...T.targets.map((x) => x.ctl), ...T.hist.map((x) => x.ctl), ...T.proj.map((x) => x.ctl)];
  const hi = Math.ceil((Math.max(...all) + 5) / 10) * 10, lo = Math.max(0, Math.floor((Math.min(...all) - 10) / 10) * 10);
  const Wd = 326, Hh = 150, X = (d) => 4 + ((parseYMD(d).getTime() - t0) / (t1 - t0)) * (Wd - 34), Y = (v) => 6 + (1 - (v - lo) / (hi - lo)) * (Hh - 26);
  const line = (pts, key) => pts.filter((p) => parseYMD(p.d || p.data).getTime() >= t0).map((p, i) => (i ? "L" : "M") + X(p.d || p.data).toFixed(1) + " " + Y(p[key]).toFixed(1)).join(" ");
  const months = []; for (let d = new Date(parseYMD(T.targets[0].data).getFullYear(), parseYMD(T.targets[0].data).getMonth() + 1, 1); d.getTime() <= t1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
  const step = Math.max(1, Math.ceil(months.length / 5));
  const ticks = months.filter((_, i) => i % step === 0).map((m) => `<text x="${X(ymd(m))}" y="${Hh - 4}" fill="#8E8E93" font-size="10" text-anchor="middle">${MESI_BREVI[m.getMonth()]}</text>`).join("");
  const grid = [lo, (lo + hi) / 2, hi].map((g) => `<line x1="4" x2="${Wd - 30}" y1="${Y(g)}" y2="${Y(g)}" stroke="rgba(142,142,147,.25)"/><text x="${Wd - 26}" y="${Y(g) + 4}" fill="#8E8E93" font-size="10">${Math.round(g)}</text>`).join("");
  const today = ymd(new Date());
  const diff = T.diff;
  const st = diff === null ? { c: "#8E8E93", t: "—" } : diff >= -2 ? { c: "#30D158", t: diff > 2 ? `Sopra la traiettoria di ${fmtIt(diff)}` : "In linea con la traiettoria" } : diff >= -6 ? { c: "#FF9F0A", t: `Sotto di ${fmtIt(-diff)} punti` } : { c: "#FF453A", t: `Sotto di ${fmtIt(-diff)} punti` };
  const peak = T.targets.reduce((a, b) => (b.ctl > a.ctl ? b : a), T.targets[0]);
  const pk = parseYMD(peak.data);
  return `<h2 class="ih">Verso ${esc(T.name || "l'obiettivo")}<button class="info" data-info="traiettoria" aria-label="Cosa significa">i</button></h2>
  <div class="card pad">
    <div class="hstack" style="justify-content:space-between;align-items:flex-end">
      <div><div class="num34" style="color:${st.c}">${T.now === null ? "—" : fmtIt(T.now)}<span class="unit" style="font-size:15px"> / ${T.target === null ? "—" : fmtIt(T.target)}</span></div><div class="t15 semi" style="color:${st.c}">${st.t}</div></div>
      <div style="text-align:right"><div class="t13 muted">picco previsto</div><div class="num20">CTL ${fmtIt(peak.ctl)}</div><div class="t13 muted">${pk.getDate()} ${MESI_BREVI[pk.getMonth()]}</div></div>
    </div>
    ${scrub(`<svg width="100%" height="${Hh}" viewBox="0 0 ${Wd} ${Hh}" preserveAspectRatio="none">${grid}
      <path d="${line(T.targets, "ctl")}" fill="none" stroke="#8E8E93" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>
      <path d="${line(T.hist, "ctl")}" fill="none" stroke="#0A84FF" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      <path d="${line(T.proj, "ctl")}" fill="none" stroke="#0A84FF" stroke-width="3" stroke-dasharray="2 4" vector-effect="non-scaling-stroke"/>
      <line x1="${X(today)}" x2="${X(today)}" y1="4" y2="${Hh - 18}" stroke="#FF453A" stroke-width="1"/>${ticks}
    </svg>`, (() => {
      // ogni punto della traiettoria con la fitness di quel giorno (fatta o prevista dal piano)
      const vicino = (L, d, prev) => { const t = parseYMD(d).getTime(); let b = null; for (const q of L || []) { const dt = Math.abs(parseYMD(q.d || q.data).getTime() - t); if (dt <= 3.5 * 864e5 && (!b || dt < b.dt)) b = { dt, v: q.ctl, prev }; } return b; };
      return T.targets.filter((x) => parseYMD(x.data).getTime() >= t0).map((x) => { const f = vicino(T.hist, x.data, false) || vicino(T.proj, x.data, true); return [X(x.data) / Wd, Y(f ? f.v : x.ctl) / Hh, dGiorno(x.data), f ? `${f.prev ? "Prevista" : "Fitness"} ${fmtIt(f.v)} · traiettoria ${fmtIt(x.ctl)}` : `Traiettoria ${fmtIt(x.ctl)}`, f ? "#0A84FF" : "#8E8E93"]; });
    })())}
    <div class="legend"><span><i style="background:#0A84FF"></i>Fitness</span><span><i class="dash"></i>Traiettoria</span><span><i style="background:#FF453A;width:3px;height:10px"></i>Oggi</span></div>
    ${T.projEnd ? `<div class="t13 muted">Con il piano attuale: CTL ${fmtIt(T.projEnd.ctl)} il ${parseYMD(T.projEnd.d).getDate()} ${MESI_BREVI[parseYMD(T.projEnd.d).getMonth()]} (traiettoria ${fmtIt(T.projEnd.target)}).</div>` : ""}
  </div>`;
}

function durabilityCard(D, dentro) {
  const pts = D.pts;
  if (pts.length < 3) return dentro ? `<div class="t13 muted">Servono almeno tre corse con la frequenza cardiaca.</div>` : "";
  const vs = pts.map((p) => p.p), lo = Math.min(...vs) - 10, hi = Math.max(...vs) + 10;
  const t0 = parseYMD(pts[0].d).getTime(), t1 = Math.max(parseYMD(pts[pts.length - 1].d).getTime(), t0 + 86400000);
  const Wd = 326, Hh = 140, X = (d) => 6 + ((parseYMD(d).getTime() - t0) / (t1 - t0)) * (Wd - 44), Y = (v) => 8 + ((v - lo) / (hi - lo)) * (Hh - 30); // più in alto = più veloce
  const dots = pts.map((p) => `<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.p).toFixed(1)}" r="${p.tm ? 2.5 : 3.5}" fill="${p.tm ? "#636366" : "#FFD60A"}" opacity="${p.tm ? 0.8 : 0.9}"/>`).join("");
  const out = pts.filter((p) => !p.tm);
  const roll = out.map((p) => { const t = parseYMD(p.d).getTime(); return { d: p.d, v: MED(out.filter((q) => Math.abs(parseYMD(q.d).getTime() - t) <= 14 * 86400000).map((q) => q.p)) }; });
  const rl = roll.map((r, i) => (i ? "L" : "M") + X(r.d).toFixed(1) + " " + Y(r.v).toFixed(1)).join(" ");
  const yt = [lo + 10, (lo + hi) / 2, hi - 10].map((v) => `<text x="${Wd - 36}" y="${Y(v) + 4}" fill="#8E8E93" font-size="10">${fmtPace(v)}</text>`).join("");
  const delta = D.now && D.old ? D.now - D.old : null;
  const dc = delta === null ? "#8E8E93" : delta <= -3 ? "#30D158" : delta >= 3 ? "#FF9F0A" : "#8E8E93";
  const dt = delta === null ? "Servono più corse all'aperto" : Math.abs(delta) < 3 ? "Stabile rispetto a 3–5 mesi fa" : delta < 0 ? `${Math.round(-delta)}"/km più veloce di 3–5 mesi fa` : `${Math.round(delta)}"/km più lento di 3–5 mesi fa`;
  const lastDec = D.dec.slice(-4);
  const corpo = `
    <div class="hstack" style="justify-content:space-between;align-items:flex-end">
      <div><div class="label">Passo a 145 bpm · ultimi 28 giorni</div><div class="num34">${D.now ? fmtPace(D.now) : "—"}<span class="unit" style="font-size:15px"> /km</span></div><div class="t15 semi" style="color:${dc}">${dt}</div></div>
    </div>
    ${scrub(`<svg width="100%" height="${Hh}" viewBox="0 0 ${Wd} ${Hh}" preserveAspectRatio="none">${yt}${dots}<path d="${rl}" fill="none" stroke="#FFD60A" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`, pts.map((p) => [X(p.d) / Wd, Y(p.p) / Hh, `${dGiorno(p.d)}${p.tm ? " · tapis" : ""}`, `${fmtPace(p.p)}/km a 145`, p.tm ? "#8E8E93" : "#FFD60A"]))}
    <div class="legend"><span><i style="background:#FFD60A;height:8px;width:8px;border-radius:50%"></i>All'aperto</span><span><i style="background:#636366;height:8px;width:8px;border-radius:50%"></i>Tapis</span><span><i style="background:#FFD60A"></i>Mediana 4 sett.</span></div>
    ${lastDec.length ? `<div class="topline"><div class="label">Decoupling dei lunghi (obiettivo &lt; 5%)</div><div class="hstack" style="gap:8px;margin-top:6px;flex-wrap:wrap">${lastDec.map((x) => `<span class="chip" style="color:${x.v < 5 ? "#30D158" : "#FF9F0A"}">${parseYMD(x.d).getDate()} ${MESI_BREVI[parseYMD(x.d).getMonth()]} · ${fmtIt(x.v, 1)}%</span>`).join("")}</div></div>` : ""}`;
  if (dentro) return corpo;
  return `<h2 class="ih">Durabilità<button class="info" data-info="durabilita" aria-label="Cosa significa">i</button></h2>
  <div class="card pad">${corpo}
  </div>`;
}

// Grafico da leggere col dito: tieni premuto (o scorri di lato) e compare il punto con data e valore.
// pts: [x 0–1, y 0–1, etichetta, valore, colore]
const dGiorno = (d) => { const q = parseYMD(d); return `${q.getDate()} ${MESI_BREVI[q.getMonth()]}`; };
function scrub(svg, pts) { return `<div class="scr" data-pts="${esc(JSON.stringify(pts.map((p) => [Math.round(p[0] * 1000) / 1000, p[1] === null ? null : Math.round(p[1] * 1000) / 1000, p[2], p[3], p[4] || null])))}">${svg}<div class="gcur"></div><div class="gdot"></div><div class="gbub"></div></div>`; }
// Un grafico dei progressi: punti, mediana di 3 settimane, linea di riferimento. Il meglio sta in alto.
function progGrafico(pts, o) {
  if (!pts || pts.length < 2) return `<div class="t13 muted" style="padding:6px 0">${esc(o.vuoto || "Servono più sedute.")}</div>`;
  const vs = pts.map((p) => p.v).concat(o.ref !== undefined && o.ref !== null ? [o.ref] : []);
  let lo = Math.min(...vs), hi = Math.max(...vs); const pd = (hi - lo) * 0.15 || 1; lo -= pd; hi += pd;
  const t0 = parseYMD(pts[0].d).getTime(), t1 = Math.max(parseYMD(pts[pts.length - 1].d).getTime(), t0 + 86400000);
  const Wd = 326, Hh = o.h || 120, X = (d) => 6 + ((parseYMD(d).getTime() - t0) / (t1 - t0)) * (Wd - 50);
  const Y = (v) => 8 + (o.meglioBasso ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)) * (Hh - 22);
  const dots = pts.map((p) => `<circle cx="${X(p.d).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.5" fill="${o.col ? o.col(p) : o.c}" opacity=".9"/>`).join("");
  const roll = pts.map((p) => { const t = parseYMD(p.d).getTime(); return { d: p.d, v: MED(pts.filter((q) => Math.abs(parseYMD(q.d).getTime() - t) <= 10.5 * 86400000).map((q) => q.v)) }; });
  const rl = pts.length >= 3 ? `<path d="${roll.map((r, i) => (i ? "L" : "M") + X(r.d).toFixed(1) + " " + Y(r.v).toFixed(1)).join(" ")}" fill="none" stroke="${o.c}" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` : "";
  const ref = o.ref !== undefined && o.ref !== null ? `<line x1="6" x2="${Wd - 44}" y1="${Y(o.ref).toFixed(1)}" y2="${Y(o.ref).toFixed(1)}" stroke="#8E8E93" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/><text x="${Wd - 40}" y="${(Y(o.ref) + 4).toFixed(1)}" fill="#8E8E93" font-size="10">${esc(o.refLbl || o.fmt(o.ref))}</text>` : "";
  const yt = [hi - pd, lo + pd].filter((v) => o.ref === undefined || o.ref === null || Math.abs(Y(v) - Y(o.ref)) > 14).map((v) => `<text x="${Wd - 40}" y="${(Y(v) + 4).toFixed(1)}" fill="#8E8E93" font-size="10">${esc(o.fmt(v))}</text>`).join("");
  const tip = pts.map((p) => [X(p.d) / Wd, Y(p.v) / Hh, o.lbl ? o.lbl(p) : dGiorno(p.d), o.tip ? o.tip(p) : o.fmt(p.v), o.col ? o.col(p) : o.c]);
  return scrub(`<svg width="100%" height="${Hh}" viewBox="0 0 ${Wd} ${Hh}" preserveAspectRatio="none">${ref}${yt}${dots}${rl}</svg>`, tip);
}
// La riga in alto: valore di oggi e confronto con due mesi fa (verde se migliora)
function progTesta(lbl, val, unit, diff, o) {
  const soglia = o.soglia || 0, meglio = diff === null ? null : o.meglioBasso ? diff < -soglia : diff > soglia, peggio = diff === null ? null : o.meglioBasso ? diff > soglia : diff < -soglia;
  const c = meglio ? "#30D158" : peggio ? "#FF9F0A" : "#8E8E93";
  const t = diff === null ? (o.vuoto || "Il confronto arriva con due mesi di dati") : !meglio && !peggio ? "Stabile rispetto a due mesi fa" : o.dt(diff);
  return `<div><div class="label">${esc(lbl)}</div><div class="num34">${val}<span class="unit" style="font-size:15px"> ${unit}</span></div><div class="t15 semi" style="color:${c}">${esc(t)}</div></div>`;
}
function progressiCard(P, D) {
  if (!P) return durabilityCard(D);
  const ult = (pts) => (pts && pts.length ? pts[pts.length - 1].v : null);
  const b = P.bici, n = P.nuoto, bOra = b.ora ?? ult(b.pts), nOra = n.ora ?? ult(n.pts), rOra = P.rhr.ora ?? ult(P.rhr.pts), hOra = P.hrv.ora ?? ult(P.hrv.pts);
  const sgn = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmtIt(Math.abs(v), d);
  const bici = `${progTesta("Deriva FC nei lunghi in bici", bOra === null ? "—" : sgn(bOra), "%", b.diff, { meglioBasso: true, soglia: 1, dt: (d) => `${fmtIt(Math.abs(d), 1)} punti ${d < 0 ? "in meno" : "in più"} di due mesi fa`, vuoto: b.pts.length ? null : "Si misura nelle uscite da 1h15" })}
    ${progGrafico(b.pts, { c: "#FF453A", meglioBasso: true, ref: 5, refLbl: "5%", fmt: (v) => sgn(v) + "%", col: (p) => (p.v < 5 ? "#30D158" : "#FF9F0A"), lbl: (p) => `${dGiorno(p.d)}${p.min ? " · " + fmtMin(p.min) : ""}`, vuoto: "Nessuna uscita da 1h15 letta ancora." })}
    <div class="t13 muted" style="line-height:1.4">Quanto sale la frequenza nella seconda metà a parità di sforzo, senza riscaldamento e defaticamento. Sotto il 5% vuol dire che reggi la durata.${b.mancano ? ` Sto leggendo le uscite passate: ne mancano ${b.mancano}, arrivano da sole nelle prossime aperture.` : ""}</div>`;
  const nuoto = `${progTesta("Passo medio in piscina", nOra === null ? "—" : fmtPace(nOra), "/100 m", n.diff, { meglioBasso: true, soglia: 1, dt: (d) => `${Math.round(Math.abs(d))}" ${d < 0 ? "più veloce" : "più lento"} di due mesi fa`, vuoto: n.pts.length ? null : "Servono nuotate in piscina da 800 m" })}
    ${progGrafico(n.pts, { c: "#0A84FF", meglioBasso: true, ref: n.css, refLbl: "CSS " + fmtPace(n.css), fmt: (v) => fmtPace(v), tip: (p) => fmtPace(p.v) + "/100 m", lbl: (p) => `${dGiorno(p.d)}${p.m ? " · " + fmtIt(p.m) + " m" : ""}` })}
    <div class="t13 muted" style="line-height:1.4">Tutta la nuotata, recuperi compresi: conta come si muove nel tempo. La linea tratteggiata è il tuo CSS.</div>`;
  const cuore = `${progTesta("FC a riposo · media della settimana", rOra === null ? "—" : Math.round(rOra), "bpm", P.rhr.diff, { meglioBasso: true, soglia: 0.9, dt: (d) => `${Math.round(Math.abs(d))} bpm ${d < 0 ? "in meno" : "in più"} di due mesi fa` })}
    ${progGrafico(P.rhr.pts, { c: "#FF375F", meglioBasso: true, h: 90, fmt: (v) => String(Math.round(v)), tip: (p) => Math.round(p.v) + " bpm", lbl: (p) => "settimana del " + dGiorno(p.d) })}
    ${progTesta("HRV · media della settimana", hOra === null ? "—" : Math.round(hOra), "ms", P.hrv.diff, { soglia: 2, dt: (d) => `${Math.round(Math.abs(d))} ms ${d > 0 ? "in più" : "in meno"} di due mesi fa` })}
    ${progGrafico(P.hrv.pts, { c: "#5E5CE6", h: 90, fmt: (v) => String(Math.round(v)), tip: (p) => Math.round(p.v) + " ms", lbl: (p) => "settimana del " + dGiorno(p.d) })}
    <div class="t13 muted" style="line-height:1.4">Con la base aerobica che cresce, la FC a riposo tende a scendere e l'HRV a salire. Si guardano le settimane, non i giorni.</div>`;
  return `<h2 class="ih">Progressi<button class="info" data-info="progressi" aria-label="Cosa significa">i</button></h2>
  <div class="seg seg4" id="prseg"><button class="on" data-p="corsa">Corsa</button><button data-p="bici">Bici</button><button data-p="nuoto">Nuoto</button><button data-p="cuore">Cuore</button></div>
  <div class="card pad prp" data-p="corsa">${durabilityCard(D, true)}</div>
  <div class="card pad prp" data-p="bici" style="display:none">${bici}</div>
  <div class="card pad prp" data-p="nuoto" style="display:none">${nuoto}</div>
  <div class="card pad prp" data-p="cuore" style="display:none">${cuore}</div>`;
}

// Scarpe e bici: km fatti contro i km previsti; tocca una riga per cambiarla
function gearCard(G, now) {
  const PER = { strada: "corse su strada", trail: "trail", tapis: "tapis", tutto: "tutte le corse" };
  const dt = (d) => { const q = parseYMD(d); return `${q.getDate()} ${MESI_BREVI[q.getMonth()]}${q.getFullYear() !== now.getFullYear() ? " " + q.getFullYear() : ""}`; };
  const riga = (g) => {
    const col = g.pct === null ? "var(--fg)" : g.pct >= 1 ? "#FF453A" : g.pct >= 0.8 ? "#FF9F0A" : "#30D158";
    return `<button class="lrow" data-gear="${esc(g.id)}" style="width:100%;border:0;background:none;font:inherit;color:inherit;text-align:left;-webkit-tap-highlight-color:transparent"><div class="grow">
      <div>${esc(g.nome)}${g.ritirata ? ` <span class="t13 muted">· in pensione</span>` : ""}</div>
      <div class="t13 muted" style="margin-top:2px">${g.tipo === "scarpe" ? PER[g.per] || "corse" : "bici"} · ${g.n} ${g.tipo === "scarpe" ? (g.n === 1 ? "corsa" : "corse") : g.n === 1 ? "uscita" : "uscite"}${g.tipo === "bici" && g.ore ? ` · ${fmtIt(g.ore, 0)} h` : ""}${g.dal ? ` · dal ${dt(g.dal)}` : ""}</div>
      ${g.pct !== null ? `<div class="pbar"><div style="width:${Math.min(100, g.pct * 100).toFixed(0)}%;background:${col}"></div></div>` : ""}</div>
      <span class="num20" style="white-space:nowrap">${fmtIt(g.km)}<span class="unit"> km${g.limite ? ` / ${fmtIt(g.limite)}` : ""}</span></span></button>`;
  };
  const finite = G.filter((g) => !g.ritirata && g.pct !== null && g.pct >= 1);
  return `<h2 class="ih">Attrezzatura<button class="info" data-info="attrezzatura" aria-label="Cosa significa">i</button></h2>
  <div class="card list">${G.length ? G.map(riga).join('<div class="sep l16"></div>') + '<div class="sep l16"></div>' : `<div class="lrow"><span class="t15 muted" style="line-height:1.4">Aggiungi le scarpe che usi: l'HUD conta i km da solo, corsa per corsa.</span></div><div class="sep l16"></div>`}
    <button class="lrow" id="gearadd" style="width:100%;border:0;background:none;font:inherit;color:var(--acc);font-weight:600;text-align:left">Aggiungi scarpe o bici</button></div>
  ${finite.length ? `<div class="t13" style="padding:0 16px;margin-top:-8px;color:#FF9F0A;line-height:1.4">${finite.map((g) => esc(g.nome)).join(" e ")}: superati i km previsti, la suola ammortizza meno. Valuta un paio nuovo.</div>` : ""}`;
}

// I record: i tratti più veloci, con la data e quanto hai migliorato; da qui si condividono
function recordCard(R, now) {
  if (!R || (!R.lista.length && !R.lunghe.length)) return "";
  const quando = (d) => { if (!d) return "prima dell'app"; const q = parseYMD(d); return `${q.getDate()} ${MESI_BREVI[q.getMonth()]}${q.getFullYear() !== now.getFullYear() ? " " + q.getFullYear() : ""}`; };
  const nuovo = (r) => r.meglio && r.d && daysBetween(parseYMD(r.d), now) <= 14;
  const riga = (r) => `<div class="lrow"><div class="grow"><div>${esc(r.nome)}${nuovo(r) ? ` <span class="pill" style="background:var(--accbg);color:#fff;font-size:11px;padding:2px 8px">Nuovo</span>` : ""}</div><div class="t13 muted" style="margin-top:2px">${quando(r.d)} · ${fmtPace(r.passo)}${r.sp === "corsa" ? "/km" : "/100 m"}${r.meglio ? ` · ${fmtStepDur(r.meglio)} meglio di prima` : ""}</div></div><span class="num20" style="font-variant-numeric:tabular-nums">${fmtDur2(r.sec)}</span><button class="sharebtn" data-shrec="${r.k}" aria-label="Condividi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg></button></div>`;
  const gruppo = (sp, tit) => { const L = R.lista.filter((r) => r.sp === sp); return L.length ? `<div class="label caps" style="padding:12px 16px 0">${tit}</div>${L.map(riga).join('<div class="sep l16"></div>')}` : ""; };
  const lunghe = R.lunghe.map((l) => `<div class="lrow"><div class="grow"><div>${esc(l.nome)}</div><div class="t13 muted" style="margin-top:2px">${quando(l.d)} · ${esc(l.att)}</div></div><span class="num20">${esc(l.val)}</span></div>`).join('<div class="sep l16"></div>');
  return `<h2 class="ih">Record<button class="info" data-info="record" aria-label="Cosa significa">i</button></h2>
  ${R.lista.length ? `<div class="card list">${gruppo("corsa", "Corsa")}${gruppo("nuoto", "Nuoto in piscina")}</div>` : ""}
  ${lunghe ? `<div class="card list">${lunghe}</div>` : ""}
  <div class="t13 muted" style="padding:0 16px;margin-top:-8px;line-height:1.4">Il tratto più veloce dentro le sedute degli ultimi 6 mesi. Quando lo batti, l'app te lo dice all'apertura.</div>`;
}
const fmtDur2 = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), z = s % 60; return h ? `${h}:${pad(m)}:${pad(z)}` : `${m}:${pad(z)}`; };

// ---- Carte della direzione C: impronta di oggi, trama della settimana, nastro della stagione
// ---- Schede di dettaglio: ogni seduta ha una chiave e un contenuto che si apre in un pannello
const DETS = new Map();
function detKey(x) { return "d" + String(x).replace(/[^a-zA-Z0-9]/g, "").slice(-40); }
function regEv(e) {
  const k = detKey(e.id ?? `${e.date}${e.name || ""}${e.sport}`);
  if (!DETS.has(k)) DETS.set(k, evDetail(e));
  return k;
}
function regAct(a) {
  const k = detKey(a.id ?? `${a.start_date_local}${a.name || ""}`);
  if (!DETS.has(k)) DETS.set(k, actDetail(a));
  return k;
}
function detStats(cells) { return `<div class="dstats">${cells.filter((c) => c && c[1] !== null && c[1] !== undefined && c[1] !== "").map((c) => `<div><div class="label">${c[0]}</div><div class="num20">${c[1]}</div></div>`).join("")}</div>`; }
function evDetail(e) {
  const s = SPORT[e.sport] || SPORT.altro, d = parseYMD(e.date), I = impronta(e), ex = e.exec, a = e.done;
  const head = `<div class="dhead"><span class="evbar" style="background:${s.c}"></span><div class="grow"><div class="t22 bold">${esc(e.name || s.label)}</div><div class="sub">${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} · ${esc(s.label)}</div></div></div>`;
  const plan = detStats([["Durata", e.min ? fmtMin(e.min) : null], ["Distanza", num(e.distance) ? fmtDist(e.distance, e.sport) : null], ["Carico", e.load ? `${Math.round(e.load)} TSS` : null]]);
  const done = a ? `<h3>Fatto</h3>${detStats([["Tempo", fmtMin(Math.round((num(a.moving_time) || 0) / 60))], ["Distanza", num(a.distance) ? fmtDist(a.distance, e.sport) : null], ["FC media", num(a.average_heartrate) ? Math.round(a.average_heartrate) + " bpm" : null], ["Carico", num(a.icu_training_load) ? Math.round(a.icu_training_load) + " TSS" : null]])}` : "";
  const exB = ex ? `<div class="exbox"><div class="hstack" style="justify-content:space-between"><span class="t15 semi">Esecuzione ${ex.score}/100</span><span class="t13 muted">${[ex.maxHr ? "FC max " + Math.round(ex.maxHr) : null, ex.p145 ? fmtPace(ex.p145) + "/km a 145" : null].filter(Boolean).join(" · ")}</span></div>${ex.flags.map((f) => `<div class="t13" style="color:var(--warn)">! ${esc(f)}</div>`).join("")}${ex.warn ? `<div class="t13 semi" style="color:var(--bad)">FC che non sale e passo peggiore: segnale di affaticamento</div>` : ""}</div>` : "";
  const key = keyLine(e.parsed);
  const hint = e.sport === "nuoto" ? `Recupero ${CONFIG.nuoto.recuperoBlocchi} tra i blocchi` : e.sport === "bici" && CONFIG.bici.daVerificare ? `Soglia FC ${CONFIG.bici.sogliaFC} da verificare` : "";
  const steps = stepsList(e.parsed, e.sport);
  return `${head}
    ${e.sport === "forza" ? "" : `<div class="dimp">${impSVG(I, 72)}<div class="hstack" style="justify-content:space-between"><span class="t13 muted">${I.done ? "Contorno: il piano · pieno: quello che hai fatto" : "Contorno da riempire"}</span>${I.done ? `<span class="t15 bold acc">${I.pct}%</span>` : ""}</div></div>`}
    <h3>Il piano</h3>${plan}
    ${key && !(e.sport === "forza" && eserciziDi(e).length >= 2) ? `<div class="keyline">${esc(key)}</div>` : ""}
    ${done}${exB}
    ${!a ? riscHTML(e) : ""}
    ${e.sport === "forza" && eserciziDi(e).length >= 2 ? eserciziHTML(e) : steps ? `<h3>I passi</h3>${steps}` : `<div class="t15 muted">Nessun passo dettagliato per questa seduta.</div>`}
    ${e.rif && !a ? `<h3>Durante</h3>${rifSedutaHTML(e)}` : ""}
    ${hint ? `<div class="t13 muted">${esc(hint)}</div>` : ""}`;
}
function actDetail(a) {
  const sp = sportOf(a.type), s = SPORT[sp] || SPORT.altro, d = new Date(a.start_date_local), lv = impFromAct(a);
  const sec = num(a.moving_time) || 0;
  const pace = sp === "corsa" && num(a.average_speed) ? fmtPace(1000 / a.average_speed) + " /km" : sp === "bici" && num(a.average_speed) ? (a.average_speed * 3.6).toFixed(1).replace(".", ",") + " km/h" : null;
  return `<div class="dhead"><span class="evbar" style="background:${s.c}"></span><div class="grow"><div class="t22 bold">${esc(a.name || s.label)}</div><div class="sub">${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} · fuori piano</div></div></div>
    <div class="dimp">${impSVG({ plan: lv, done: lv }, 72)}<span class="t13 muted">Impronta ricavata dal tempo nelle zone di FC</span></div>
    ${detStats([["Tempo", fmtMin(Math.round(sec / 60))], ["Distanza", num(a.distance) ? fmtDist(a.distance, sp) : null], [sp === "bici" ? "Velocità" : "Passo", pace], ["FC media", num(a.average_heartrate) ? Math.round(a.average_heartrate) + " bpm" : null], ["Dislivello", num(a.total_elevation_gain) ? Math.round(a.total_elevation_gain) + " m" : null], ["Carico", num(a.icu_training_load) ? Math.round(a.icu_training_load) + " TSS" : null]])}`;
}

function mainOf(evs) { return evs.slice().sort((a, b) => (b.load || 0) - (a.load || 0) || b.min - a.min)[0] || null; }

function todayImpCard(A) {
  const e = mainOf(A.todayEv);
  if (!e) {
    return `<div class="card pad imp-card"><div class="label caps">Oggi</div><div class="t22 semi">${A.gymToday ? "Palestra" : "Giorno di riposo"}</div>
      <div class="sub">${A.gymToday ? esc(A.gymToday) : "Nessuna impronta da riempire: recupero, mobilità, sonno."}</div></div>`;
  }
  const I = impronta(e);
  const ad = A.ins.adapt && !A.ins.adapt.accepted ? A.ins.adapt.items.find((x) => x.name === e.name) : null;
  if (ad && !I.done) I.plan = impAdapt(I.plan, ad);
  const others = A.todayEv.filter((x) => x !== e);
  const status = I.done
    ? `<div class="hstack" style="justify-content:space-between"><span class="t15 muted">${e.exec && e.exec.flags[0] ? esc(e.exec.flags[0][0].toUpperCase() + e.exec.flags[0].slice(1)) : "Seduta eseguita"}</span><button class="pillbtn" id="shareImp">Condividi</button></div>`
    : `<div class="hstack" style="justify-content:space-between"><span class="t15 muted">${ad ? "Contorno adattato: " + esc(ad.prop) : "Da riempire"}</span><button class="linkbtn" data-det="${regEv(e)}">Vedi i passi ›</button></div>`;
  return `<div class="card pad imp-card rel"><button class="info corner" data-info="impronta" aria-label="Cosa significa">i</button>
    <div class="hstack" style="justify-content:space-between;padding-right:30px"><span class="label caps">${I.done ? "Impronta di oggi · riempita" : ad ? "Impronta di oggi · adattata" : "La tua impronta di oggi"}</span><span class="t13 muted">${esc((SPORT[e.sport] || SPORT.altro).label)}</span></div>
    <div class="hstack" style="justify-content:space-between;align-items:baseline"><span class="t22 semi">${esc(e.name || (SPORT[e.sport] || SPORT.altro).label)}</span>${I.done ? `<span class="t22 bold acc">${I.pct}%</span>` : `<span class="t17 semi muted">${fmtMin(e.min)}</span>`}</div>
    ${impSVG(I, 64)}
    ${status}
    ${others.length ? `<div class="t13 muted">Poi: ${others.map((x) => `${esc(x.name || SPORT[x.sport].label)} · ${fmtMin(x.min)}`).join(", ")}</div>` : ""}
  </div>`;
}

function weekImp(W) {
  return W.days.map((D) => {
    const e = mainOf(D.evs);
    const extra = !e && D.extra.length ? D.extra.slice().sort((a, b) => (num(b.moving_time) || 0) - (num(a.moving_time) || 0))[0] : null;
    let I = null, min = 0;
    if (e) { I = impronta(e, 24); min = D.evs.reduce((t, x) => t + (x.done ? Math.round((num(x.done.moving_time) || 0) / 60) : x.min), 0); }
    else if (extra) { const lv = impFromAct(extra, 24); I = { plan: lv, done: lv }; min = Math.round((num(extra.moving_time) || 0) / 60); }
    return { D, I, min, more: Math.max(0, D.evs.length - 1), e, extra };
  });
}
function tramaCard(W) {
  const rows = weekImp(W);
  const mx = Math.max(60, ...rows.map((r) => r.min));
  return `<div class="card trama rel"><button class="info corner" data-info="trama" aria-label="Cosa significa">i</button>${rows.map((r) => `<${r.e || r.extra ? `button data-det="${r.e ? regEv(r.e) : regAct(r.extra)}"` : "div"} class="trow${r.D.isToday ? " today" : ""}">
      <span class="tday">${r.D.isToday ? "Oggi" : GG[r.D.date.getDay()]}</span>
      <div class="tbody">${r.I ? `<div style="width:${Math.max(18, (r.min / mx) * 100).toFixed(0)}%">${impSVG(r.I, 30)}</div>` : `<span class="t13 muted">${r.D.gym ? "Palestra" : "Riposo"}</span>`}</div>
      <span class="tmin${r.I && r.I.done ? "" : " muted"}">${r.min ? fmtMin(r.min) : ""}${r.more ? ` <small>+${r.more}</small>` : ""}</span>
    </${r.e || r.extra ? "button" : "div"}>`).join("")}</div>`;
}

function nastroSVG(season, race) {
  const cols = season.length + (race ? 3 : 0), step = 12, cw = 7, H = 110, W = cols * step;
  const mx = Math.max(1, ...season.map((w) => Math.max(w.done || 0, w.plan || 0)));
  let s = "";
  const cap = (i, v, cls) => { const hh = Math.max(cw, (v / mx) * H), x = i * step + (step - cw) / 2; return `<rect class="${cls}" x="${x}" y="${(H - hh).toFixed(1)}" width="${cw}" height="${hh.toFixed(1)}" rx="${cw / 2}"/>`; };
  season.forEach((w, i) => {
    if (w.plan) s += cap(i, w.plan, "np");
    if (w.done) s += cap(i, w.done, w.cur ? "nf cur" : "nf");
  });
  if (race) {
    const i0 = season.length;
    s += `<circle class="nd" cx="${i0 * step + step / 2}" cy="${H - 4}" r="1.6"/><circle class="nd" cx="${(i0 + 0.7) * step + step / 2}" cy="${H - 4}" r="1.6"/>`;
    const x = (i0 + 2) * step + (step - cw) / 2;
    s += `<rect class="nr" x="${x + 1}" y="1" width="${cw - 2}" height="${H - 2}" rx="${cw / 2 - 1}"/>`;
  }
  return `<svg class="nastro" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="${H}" aria-hidden="true">${s}</svg>`;
}

// Verifica del profilo: soglie, gare, dati mancanti. Si calcola da sola sui dati di ogni utente.
const CHK_TAG = { aggiorna: ["Aggiorna", "var(--warn)"], controlla: ["Controlla", "var(--fg)"], info: ["Da sapere", "var(--mut)"] };
function checksCard(A) {
  const L = A.checks || [];
  if (!L.length) return `<h2 class="ih">Verifica del profilo<button class="info" data-info="verifiche" aria-label="Cosa significa">i</button></h2>
  <div class="card pad"><div class="t15">Soglie e dati coerenti con quello che fai. Nessuna correzione da fare.</div></div>`;
  return `<h2 class="ih">Verifica del profilo<button class="info" data-info="verifiche" aria-label="Cosa significa">i</button></h2>
  <div class="card list">${L.map((c, i) => `${i ? '<div class="sep l16"></div>' : ""}<div class="chk">
    <div class="chkt" style="color:${CHK_TAG[c.liv][1]}">${CHK_TAG[c.liv][0]}</div>
    <div class="t15 semi">${esc(c.titolo)}</div>
    <div class="sub">${esc(c.testo)}</div>
    <div class="t13" style="margin-top:4px">${esc(c.azione)}</div></div>`).join("")}</div>`;
}
// ---- Le soglie in uso: valore, da dove viene, quando è cambiato
function soglieCard(A) {
  if (A.demo) return "";
  const S = A.soglie || { corsa: {}, bici: {}, nuoto: {} }, C = CONFIG, sp = C.sport, auto = C.soglieAutomatiche;
  const storia = (PROF && PROF.soglieAuto && PROF.soglieAuto.storia) || [];
  const quando = (tipo, campo) => { const v = storia.slice().reverse().find((x) => x.cambi.some((c) => c.tipo === tipo && c.campo === campo)); if (!v) return ""; const d = new Date(v.data); return `Aggiornata il ${d.getDate()} ${MESI_BREVI[d.getMonth()]}. `; };
  const fisse = C.soglieFissate || [], bloccati = (PROF && PROF.soglieAuto && PROF.soglieAuto.bloccati) || [];
  const fonte = (x, tipo, campo) => !auto || fisse.includes(CAMPO_PROFILO[tipo + "." + campo]) ? "Fissata nel tuo profilo." : bloccati.includes(tipo + "." + campo) ? "Cambiata a mano su Intervals: l'app non la tocca più." : x && x.perche ? quando(tipo, campo) + (x.fonte === "intervals" ? "Impostata su Intervals." : x.fonte === "attivita" ? x.perche + "." : `Stima: ${x.perche.charAt(0).toLowerCase() + x.perche.slice(1)}.`) : "";
  const righe = [];
  const riga = (nome, valore, sub, avviso) => righe.push(`<div class="lrow" style="align-items:flex-start"><div class="grow"><div>${esc(nome)}</div><div class="sub"${avviso ? ' style="color:var(--warn)"' : ""}>${esc(sub)}</div></div><span class="num20">${valore}</span></div>`);
  riga("FC massima", `${fmtIt(C.corsa.fcMax)}<span class="unit"> bpm</span>`, fonte(S.fcMax, "Run", "max_hr"));
  if (sp.includes("corsa")) {
    riga("Soglia FC di corsa", `${fmtIt(C.corsa.lthr)}<span class="unit"> bpm</span>`, fonte(S.corsa.lthr, "Run", "lthr"));
    const senzaPasso = auto && !fisse.includes("passoSoglia") && !(S.corsa.passo);
    riga("Passo soglia", `${esc(C.corsa.passoSoglia)}<span class="unit"> /km</span>`, senzaPasso ? "Da misurare: serve una corsa dura di 20–30' o qualche corsa facile con i battiti." : fonte(S.corsa.passo, "Run", "threshold_pace"), senzaPasso);
  }
  if (sp.includes("bici")) {
    if (C.bici.potenza && C.bici.ftp) riga("FTP", `${fmtIt(C.bici.ftp)}<span class="unit"> W</span>`, fonte(S.bici.ftp, "Ride", "ftp"));
    riga("Soglia FC in bici", `${fmtIt(C.bici.sogliaFC)}<span class="unit"> bpm</span>`, C.bici.potenza ? fonte(S.bici.lthr, "Ride", "lthr") : `${fonte(S.bici.lthr, "Ride", "lthr")} Senza misuratore di potenza le sedute di bici usano i battiti.`.trim());
  }
  if (sp.includes("nuoto")) {
    const da = auto && !fisse.includes("css") && S.nuoto && S.nuoto.daMisurare;
    riga("CSS (soglia nel nuoto)", `${esc(C.nuoto.css)}<span class="unit"> /100 m</span>`, da ? "Da misurare: il piano parte con il test 400 + 200, poi l'app la aggiorna da sola." : fonte(S.nuoto.css, "Swim", "threshold_pace"), da);
  }
  return `<h2 class="ih">Le tue soglie<button class="info" data-info="soglie" aria-label="Cosa significa">i</button></h2>
  <div class="card list">${righe.join('<div class="sep l16"></div>')}</div>
  <div class="t13 muted" style="padding:0 16px;margin-top:-8px;line-height:1.4">${!auto || fisse.length >= 5 ? "Sono fissate nel tuo profilo: l'app non le cambia." : "L'app le ricava dalle tue attività e le aggiorna da sola su Intervals: zone e obiettivi delle sedute, anche sull'orologio, seguono."}</div>`;
}
function checksRow(A) {
  const n = (A.checks || []).filter((c) => c.liv === "aggiorna").length;
  if (!n) return "";
  const first = A.checks[0];
  return `<button class="card rowbtn" data-goto="trend" data-sub="pr-sog"><div><div class="label" style="color:var(--warn)">Verifica del profilo</div><div class="t15 semi">${n === 1 ? esc(first.titolo) : `${n} valori da aggiornare`}</div></div><span class="chev2">›</span></button>`;
}

function seasonCard(A) {
  const race = A.raceDays !== null && A.raceDays !== undefined && A.raceDays >= 0 && CONFIG.obiettivo;
  const T = A.ins.trajectory;
  return `<div class="card season rel"><button class="info corner dark" data-info="stagione" aria-label="Cosa significa">i</button>
    ${race ? `<div class="hstack" style="align-items:baseline;gap:10px"><span class="bignum">${A.raceDays}</span><span class="t17 semi" style="color:#A1A1A6">giorni a ${esc(CONFIG.obiettivo.nome)}</span></div>`
      : `<div class="t22 bold">Le tue ultime 13 settimane</div>`}
    ${nastroSVG(A.season, race)}
    <div class="hstack" style="justify-content:space-between;font-size:13px;color:#A1A1A6"><span>11 settimane fa</span><span>Questa settimana</span>${race ? `<span style="color:#FF9F45">Gara</span>` : `<span>Prossima</span>`}</div>
    ${T && T.now !== null && T.target !== null ? `<div class="t15" style="color:#D1D1D6">Fitness ${fmtIt(T.now)} su ${fmtIt(T.target)} previsti oggi${T.diff !== null ? (T.diff >= -2 ? " · in linea" : ` · sotto di ${fmtIt(-T.diff)}`) : ""}</div>` : ""}
  </div>`;
}

// ---- Configurazione (primo avvio) e Impostazioni: la stessa schermata
function setupView(A) {
  const P = A.prof || {};
  const first = !A.prof;
  const G = P.gara || null;
  const giorni = Array.isArray(P.giorni) ? P.giorni : [true, true, false, true, true, true, true];
  const C = P.corpo || {};
  const dayBtns = (id, sel) => `<div class="days7" id="${id}">${GIORNI_L.map((g, i) => `<button type="button" data-i="${i}" class="${sel.includes(i) ? "on" : ""}" aria-pressed="${sel.includes(i)}">${g.slice(0, 1)}</button>`).join("")}</div>`;
  const segB = (id, cls, opts, cur) => `<div class="seg ${cls}" id="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const giorniIdx = giorni.map((g, i) => (g ? i : -1)).filter((i) => i >= 0);
  // sport: dal profilo; la prima volta quelli che si vedono nelle attività degli ultimi due mesi
  const daDati = first && (A.sportRecenti || []).length > 0;
  const sp = !first ? sportDi(P) : A.sportRecenti || [];
  const kSp = chiaveSport(sp);
  const sportBtns = `<div class="sport3" id="f-sport">${[["corsa", "Corsa"], ["bici", "Bici"], ["nuoto", "Nuoto"]].map(([v, l]) => `<button type="button" data-v="${v}" class="${sp.includes(v) ? "on" : ""}" aria-pressed="${sp.includes(v)}">${l}</button>`).join("")}</div>`;
  const gruppi = Object.entries(GARE).map(([k, lista]) => {
    const cur = G && lista.some((x) => x[0] === G.tipo) ? G.tipo : lista[0][0];
    return `<div class="seg seg${lista.length}" data-k="${k}"${k === kSp ? "" : ' style="display:none"'}>${lista.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === cur ? "on" : ""}">${l}</button>`).join("")}</div>`;
  }).join("");
  return `
  <div class="setup">
  <p class="lede">${first ? "Poche domande, una volta sola. Se lasci fare all'app, poi ti mostro il piano di 4 settimane, costruito dalle risposte e da quello che hai fatto negli ultimi mesi. Se hai già il tuo piano su Intervals, l'app lo legge e basta." : "Cambia quello che serve. Il piano già scritto resta com'è finché non lo rifai dalla scheda Settimana."}</p>
  <div class="card pad form">
    <div class="fq"><label for="f-nome">Come ti chiami</label><input id="f-nome" autocomplete="given-name" value="${esc(P.nome || (A.atleta && A.atleta.nome ? A.atleta.nome.split(" ")[0] : ""))}" placeholder="Nome"></div>
  </div>
  <h2>Il tuo piano</h2>
  <div class="card pad form">
    <div class="fq"><span class="flab">Chi scrive le sedute nel tuo Intervals</span>${segB("f-piano", "seg2", [["app", "Le crea l'app"], ["mio", "Ho già il mio piano"]], P.pianoApp === false ? "mio" : "app")}
      <div class="t13 muted" id="f-piano-app"${P.pianoApp === false ? ' style="display:none"' : ""}>L'app crea un piano di 4 settimane e lo scrive nel tuo Intervals solo quando tocchi Scrivi nel calendario. Le sedute che hai già non le tocca mai.</div>
      <div class="t13 muted" id="f-piano-mio"${P.pianoApp === false ? "" : ' style="display:none"'}>L'app legge il tuo calendario e non scrive niente su Intervals: né sedute né soglie. Prontezza, Carburante e rifornimento si basano sulle tue sedute; le soglie te le suggerisce in Stagione.</div></div>
  </div>
  <h2>Cosa alleni</h2>
  <div class="card pad form">
    <div class="fq">${segB("f-cosa", "seg2", [["end", "Corsa, bici, nuoto"], ["pal", "Solo palestra"]], P.soloPalestra ? "pal" : "end")}
      <div class="t13 muted" id="f-cosa-pal"${P.soloPalestra ? "" : ' style="display:none"'}>Un piano di palestra di 4 settimane: tre schede che si alternano, con gli esercizi illustrati e i video.</div></div>
  </div>
  <h2 id="f-sph">I tuoi sport</h2>
  <div class="card pad form">
    <div class="fq" id="f-spw"><span class="flab">Quali fai? Uno, due o tutti e tre</span>${sportBtns}
      ${daDati ? `<div class="t13 muted">Li ho presi dalle tue attività degli ultimi due mesi: cambia se serve.</div>` : ""}</div>
    <div id="f-biciw" class="fq"${sp.includes("bici") ? "" : ' style="display:none"'}><span class="flab">Dove vai in bici</span>${segB("f-bici", "seg2", [["strada", "Su strada"], ["rulli", "Sui rulli"]], P.bici === "rulli" ? "rulli" : "strada")}</div>
    <div id="f-piscw" class="fq"${sp.includes("nuoto") ? "" : ' style="display:none"'}><span class="flab">Giorni in cui puoi andare in piscina</span>${dayBtns("f-piscg", P.piscinaGiorni || [0, 2, 4])}</div>
    <div class="fq"><div id="f-palsi" class="vstack" style="gap:8px${P.soloPalestra ? ";display:none" : ""}"><span class="flab">Palestra</span>${segB("f-pal", "seg2", [["1", "Sì"], ["0", "No"]], P.palestra ? 1 : 0)}</div>
      <div id="f-palw" class="sub2"${P.palestra || P.soloPalestra ? "" : ' style="display:none"'}><span class="flab">In quali giorni</span>${dayBtns("f-palg", P.palestraGiorni || [0, 3])}
        <span class="flab">Con cosa</span>${segB("f-attr", "seg4", [["libero", "Corpo libero"], ["elastico", "Elastico"], ["manubri", "Manubri"], ["palestra", "Palestra"]], P.attrezzi || "manubri")}
        <div id="f-palminw" class="vstack" style="gap:8px${P.soloPalestra ? "" : ";display:none"}"><span class="flab">Quanto dura una seduta</span>${segB("f-palmin", "seg3", [[30, "30'"], [45, "45'"], [60, "1 ora"]], P.palMin || 45)}</div></div></div>
  </div>
  <div id="f-garaw" class="vstack" style="gap:14px${P.soloPalestra ? ";display:none" : ""}">
  <h2>La tua gara</h2>
  <div class="card pad form">
    <div id="f-nogara" class="t15 muted"${GARE[kSp] || !sp.length ? ' style="display:none"' : ""}>Per nuoto e bici insieme non ci sono gare in elenco: il piano ti fa migliorare in tutti e due.</div>
    <div id="f-garasi">${segB("f-garaon", "seg2", [["1", "Ho una gara"], ["0", "Voglio migliorare"]], G ? 1 : first ? 1 : 0)}</div>
    <div id="f-gara" class="vstack" style="gap:14px${G || first ? "" : ";display:none"}">
      <div class="fq"><label for="f-gnome">Nome della gara</label><input id="f-gnome" value="${esc((G && G.nome) || "")}" placeholder="Nome della gara"></div>
      <div class="fq"><span class="flab">Distanza</span><div id="f-gtipo">${gruppi}</div></div>
      <div class="fq"><label for="f-gdata">Data</label><input id="f-gdata" type="date" value="${esc((G && G.data) || "")}"></div>
    </div>
  </div>
  </div>
  <div id="f-tempow" class="vstack" style="gap:14px${P.pianoApp === false || P.soloPalestra ? ";display:none" : ""}">
  <h2>Il tuo tempo</h2>
  <div class="card pad form">
    <div class="fq"><span class="flab">Giorni in cui puoi allenarti</span>${dayBtns("f-giorni", giorniIdx)}</div>
    <div class="fq"><span class="flab">Ore a settimana, più o meno</span>${segB("f-ore", "seg6", [[4, "4"], [6, "6"], [8, "8"], [10, "10"], [12, "12"], [15, "15+"]], P.ore || 8)}</div>
    <div class="fq"><span class="flab">Giorno del lungo</span>${segB("f-lungo", "seg2", [[5, "Sabato"], [6, "Domenica"]], P.giornoLungo ?? 6)}</div>
  </div>
  </div>
  <h2>Il tuo corpo</h2>
  <div class="card pad form">
    <p class="t13 muted" style="margin:0">Serve al Carburante per stimare quanto consumi. Resta solo su questo iPhone e nel tuo iCloud.</p>
    <div class="fq"><span class="flab">Sesso</span>${segB("f-sesso", "seg2", [["M", "Uomo"], ["F", "Donna"]], C.sesso || "")}</div>
    <div class="grid2f">
      <div class="fq"><label for="f-anno">Anno di nascita</label><input id="f-anno" type="text" inputmode="numeric" value="${esc(C.anno || "")}" placeholder="1990"></div>
      <div class="fq"><label for="f-alt">Altezza (cm)</label><input id="f-alt" type="text" inputmode="numeric" value="${esc(C.altezza || "")}" placeholder="178"></div>
      <div class="fq"><label for="f-peso">Peso (kg)</label><input id="f-peso" type="text" inputmode="decimal" value="${esc(C.peso || "")}" placeholder="72"></div>
      <div class="fq"><label for="f-pob">Peso obiettivo</label><input id="f-pob" type="text" inputmode="decimal" value="${esc(C.pesoObiettivo || "")}" placeholder="facoltativo"></div>
      <div class="fq"><label for="f-grasso">Grasso (%)</label><input id="f-grasso" type="text" inputmode="decimal" value="${esc(C.grasso || "")}" placeholder="facoltativo"></div>
    </div>
    <p class="t13 muted" style="margin:0">La % di grasso della bilancia serve a stimare la massa magra per i limiti di sicurezza. Se la lasci vuota la legge da Intervals, se c'è, altrimenti la stima da peso e altezza.</p>
  </div>
  <div id="f-err" class="ferr" role="alert"></div>
  <button class="primary" id="f-salva" type="button" data-first="${first ? 1 : 0}">${first ? (P.pianoApp === false ? "Inizia" : "Crea il mio piano") : "Salva le modifiche"}</button>
  ${first ? "" : `<div class="card list">
    ${P.avvisato ? "" : `<button class="lrow rowlink" type="button" data-act="avvisa:impostazioni"><span>Avvisa chi ti ha dato l'app che sei pronto</span><span class="chev2">›</span></button>
    <div class="sep l16"></div>`}
    <button class="lrow rowlink" type="button" data-act="feedback:impostazioni"><span>Invia un commento a chi ti ha dato l'app</span><span class="chev2">›</span></button>
    <div class="sep l16"></div>
    <div class="lrow"><span class="muted">Versione</span><span class="muted">${esc(VERSIONE)}</span></div>
  </div>`}
  </div>`;
}

// ---- Il piano dell'app: stato del blocco e pulsanti
function pianoCard(A, dove) {
  const P = A.prof;
  if (!P || P.pianoApp === false || A.demo) return "";
  const pi = P.piano, oggi = ymd(A.now);
  const fmtG = (s) => { const q = parseYMD(s); return `${q.getDate()} ${MESI_BREVI[q.getMonth()]}`; };
  if (!pi || pi.fine < oggi) {
    return `<div class="card pad plan">
      <div class="label caps">Il tuo piano</div>
      <div class="t17 semi">${pi ? "Il blocco è finito: prepariamo il prossimo" : "Crea il tuo primo blocco di 4 settimane"}</div>
      <div class="t15 muted">Lo costruisco dalle tue risposte e da quello che hai fatto negli ultimi mesi, poi lo scrivo nel tuo calendario di Intervals. Prima di scriverlo vedi l'anteprima.</div>
      <button class="primary" type="button" data-act="plan:${pi ? "prossimo" : "crea"}">${pi ? "Prepara il prossimo blocco" : "Crea il mio piano"}</button>
    </div>`;
  }
  const inizio = parseYMD(pi.inizio);
  const sett = A.now < inizio ? 0 : Math.min(4, Math.floor(daysBetween(inizio, A.now) / 7) + 1);
  const finisce = daysBetween(A.now, parseYMD(pi.fine));
  if (dove === "oggi" && finisce > 6) return "";
  return `<div class="card pad plan">
    <div class="label caps">Il tuo piano · blocco ${(pi.indice || 0) + 1}</div>
    <div class="t17 semi">${sett ? `Settimana ${sett} di 4` : `Inizia lunedì ${fmtG(pi.inizio)}`} · fino ${[1, 8, 11].includes(parseYMD(pi.fine).getDate()) ? "all’" : "al "}${fmtG(pi.fine)}</div>
    ${finisce <= 6 ? `<div class="t15 muted">Il blocco finisce ${finisce <= 0 ? "oggi" : finisce === 1 ? "domani" : `tra ${finisce} giorni`}. Il prossimo parte da quello che hai fatto davvero.</div>
    <button class="primary" type="button" data-act="plan:prossimo">Prepara il prossimo blocco</button>` : `<div class="t15 muted">Le sedute sono nel tuo calendario. Se cambiano i tuoi impegni puoi rifarlo da lunedì prossimo.</div>
    <button class="secondary" type="button" data-act="plan:crea">Rifai il piano da lunedì</button>`}
  </div>`;
}

function buildHTML(A) {
  DETS.clear();
  const I = A.ins;
  const DIARY = A.diary || {};
  const d = A.now;
  const dateLine = `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
  const M = A.metrics;
  const v = (x, dec = 0) => (x === null || x === undefined ? "—" : fmtIt(x, dec));
  const fetched = A.fetchedAt ? new Date(A.fetchedAt) : null;
  const updLine = A.demo ? "Dati demo · inserisci la chiave Intervals per i tuoi dati"
    : `${A.stale ? "Offline · " : ""}Aggiornato ${fetched ? `${pad(fetched.getHours())}:${pad(fetched.getMinutes())}` : "—"} · Intervals.icu · versione ${VERSIONE}`;
  const fz = formZone(M.tsb);

  // ================= OGGI =================
  const sl = A.sleep;
  const hhmm = (s) => (s === null ? "—" : `${Math.floor(s / 3600)}h ${pad(Math.round((s % 3600) / 60))}m`);
  const sleepDelta = sl.secs !== null && sl.avgSecs ? Math.round((sl.secs - sl.avgSecs) / 60) : null;
  const maxS = Math.max(9 * 3600, ...sl.week.map((x) => x.secs || 0));
  const sleepBars = sl.week.map((x, i) => {
    const h = x.secs ? Math.max(6, (x.secs / maxS) * 100) : 4;
    const last = i === sl.week.length - 1;
    return `<div class="sbc"><div class="sbt"><div style="height:${h.toFixed(0)}%;background:${last ? "#5E5CE6" : "#3A3A5C"};border-radius:5px"></div></div><div class="sbl" style="${last ? "color:var(--fg);font-weight:600" : ""}">${GG[x.d].slice(0, 1)}</div></div>`;
  }).join("");
  const sleepCell = (lbl, val, unit = "") => `<div class="cell"><div class="label">${lbl}</div><div class="num20">${val}${val !== "—" && unit ? `<span class="unit"> ${unit}</span>` : ""}</div></div>`;

  const weekBars = (k, color) => {
    const vals = sl.week.map((x) => x[k]);
    const ok = vals.filter((x) => x !== null);
    if (ok.length < 2) return `<div class="sub">Dati insufficienti</div>`;
    const lo = Math.min(...ok), hi = Math.max(...ok), span = hi - lo || 1;
    return `<div class="mbars">${vals.map((x, i) => `<div class="mbc"><div class="mbt"><div style="height:${x === null ? 4 : (25 + 75 * (x - lo) / span).toFixed(0)}%;background:${color};opacity:${i === vals.length - 1 ? 1 : 0.35};border-radius:3px"></div></div><div class="sbl" style="${i === vals.length - 1 ? "color:var(--fg);font-weight:600" : ""}">${GG[sl.week[i].d].slice(0, 1)}</div></div>`).join("")}</div>`;
  };
  const trendTxt = (val, avg, better) => (val === null || avg === null ? "" : Math.abs(val - avg) < 1 ? "nella media" : `${val > avg ? "+" : "−"}${fmtIt(Math.abs(val - avg))} vs media`);
  const hrvTrend = trendTxt(M.hrv, M.hrvMean, true);
  const rhrTrend = M.rhr === null || M.rhrMean === null ? "" : Math.abs(M.rhr - M.rhrMean) < 1 ? "nella media" : `${M.rhr > M.rhrMean ? "+" : "−"}${fmtIt(Math.abs(M.rhr - M.rhrMean))} vs media`;

  const rd = sl.readiness;
  const tile = (lbl, val, sub, cls = "", k = "") => `<div class="tile">${k ? `<button class="info corner" data-info="${k}" aria-label="Cosa significa">i</button>` : ""}<div class="label">${lbl}</div><div class="tv">${val}</div><div class="ts ${cls}">${sub || "&nbsp;"}</div></div>`;
  const dCls = (val, avg, inv) => (val === null || avg === null || Math.abs(val - avg) < 1 ? "" : (inv ? val < avg : val > avg) ? "good" : "warn");
  const N0 = A.nutrition;
  const SA = A.salute, saCol = SA ? (SA.livello === "stop" ? "#D70015" : SA.livello === "ok" ? "#1E7F45" : "#B25000") : null;
  const saluteBox = SA ? `<button class="card salb" data-salute="1"><span class="evbar" style="background:${saCol}"></span><div class="grow"><div class="label caps" style="color:${saCol}">${esc(SA.titolo)} · da ${SA.giorni === 0 ? "oggi" : SA.giorni === 1 ? "ieri" : SA.giorni + " giorni"}</div><div class="t17 semi">${esc(SA.sotto)}</div><div class="t13 muted">${SA.applicata ? "Sedute dei prossimi giorni adattate" : SA.proposta.length ? `${SA.proposta.length} ${SA.proposta.length === 1 ? "seduta da adattare" : "sedute da adattare"}: tocca per vederle` : "Tocca per consigli e Carburante"}</div></div>${CHEV}</button>` : "";
  // la seduta di oggi dentro la card principale: nome, durata, carboidrati, impronta, Dettagli e Condividi
  const tE = mainOf(A.todayEv);
  const sedutaOggi = (() => {
    if (!tE) return `<div class="hsep"></div><div class="label caps">La seduta di oggi</div><div class="t22 semi" style="margin-top:-6px">${A.gymToday ? "Palestra" : "Giorno di riposo"}</div><div class="t15 muted" style="margin-top:-6px">${A.gymToday ? esc(A.gymToday) : "Recupero: un po' di mobilità e dormire bene."}</div>
      <div class="btnrow" style="grid-template-columns:1fr 1fr"><button class="secondary fillb" data-goto="sett" data-sub="${A.gymToday ? "pi-gym" : "pi-mob"}">${A.gymToday ? "Esercizi" : "Mobilità"}</button><button class="secondary fillb" id="sharebtn">Condividi</button></div>`;
    const sp = SPORT[tE.sport] || SPORT.altro, I0 = impronta(tE);
    const ad = A.ins.adapt && !A.ins.adapt.accepted ? A.ins.adapt.items.find((x) => x.name === tE.name) : null;
    if (ad && !I0.done) I0.plan = impAdapt(I0.plan, ad);
    const carbo = !tE.done && tE.rif && tE.rif.voci.some((x) => x.tipo === "mangia") ? `${tE.rif.g} g di carboidrati` : null;
    const fd = tE.done;
    const meta = (fd ? [fmtMin(Math.round((num(fd.moving_time) || 0) / 60)), num(fd.distance) ? fmtDist(fd.distance, tE.sport) : null, num(fd.average_heartrate) ? `${Math.round(fd.average_heartrate)} bpm di media` : null] : [tE.min ? fmtMin(tE.min) : null, keyLine(tE.parsed), carbo]).filter(Boolean).join(" · ");
    const altre = A.todayEv.filter((x) => x !== tE);
    return `<div class="hsep"></div>
    <div class="hstack" style="justify-content:space-between"><span class="label caps">La seduta di oggi</span><span class="t13 muted">${esc(sp.label)}</span></div>
    <div class="hstack" style="justify-content:space-between;align-items:baseline;gap:10px;margin-top:-6px"><span class="t22 semi">${esc(tE.name || sp.label)}</span>${I0.done ? `<span class="t17 bold acc" style="white-space:nowrap">Fatta ${I0.pct}%</span>` : ""}</div>
    ${meta ? `<div class="t15 muted" style="margin-top:-8px;line-height:1.4">${esc(meta)}</div>` : ""}
    ${tE.sport === "forza" ? "" : impSVG(I0, 44)}
    ${ad && !I0.done ? `<div class="t13" style="color:var(--warn)">Adattata per oggi: ${esc(ad.prop)}</div>` : ""}
    ${altre.length ? `<div class="t13 muted">Poi: ${altre.map((x) => `${esc(x.name || (SPORT[x.sport] || SPORT.altro).label)} · ${fmtMin(x.min)}`).join(", ")}</div>` : ""}
    <div class="btnrow" style="grid-template-columns:1fr 1fr"><button class="secondary fillb" data-det="${regEv(tE)}">Dettagli</button><button class="secondary fillb" id="${I0.done ? "shareImp" : "sharebtn"}">Condividi</button></div>`;
  })();
  // i quattro numeri del mattino: un tocco apre il dettaglio con la spiegazione
  const formaCard = `  <div class="card pad">
    <div class="hstack" style="justify-content:space-between;align-items:flex-end">
      <div><div class="num34" style="color:${fz.c}">${signed(M.tsb)}</div><div class="t15 semi" style="color:${fz.c}">${fz.name}</div></div>
      <div class="formbar">${["Rischio alto", "Ottimale", "Zona grigia", "Fresco", "Transizione"].map((z, i) => `<div style="background:${["#FF453A", "#30D158", "#8E8E93", "#64D2FF", "#FFD60A"][i]};opacity:${z === fz.name ? 1 : 0.22}"></div>`).join("")}</div>
    </div>
    <div class="grid3 topline">
      <div><div class="label">Fitness · CTL</div><div class="num20" style="color:#0A84FF">${v(M.ctl)}</div></div>
      <div><div class="label">Fatica · ATL</div><div class="num20" style="color:#BF5AF2">${v(M.atl)}</div></div>
      <div><div class="label">Ramp rate</div><div class="num20" style="color:${M.ramp === null ? "inherit" : M.ramp > 8 ? COL.rosso : M.ramp > 5 ? COL.giallo : COL.verde}">${M.ramp === null ? "—" : fmtIt(M.ramp, 1)}</div></div>
    </div>
  </div>`;
  const sonnoCard = `  <div class="card pad">
    <div class="hstack" style="justify-content:space-between;align-items:flex-end">
      <div>
        <div class="num34">${hhmm(sl.secs)}</div>
        <div class="t13 muted">${sleepDelta === null ? "Durata" : `${sleepDelta >= 0 ? "+" : "−"}${Math.abs(sleepDelta)}' rispetto alla media`}</div>
      </div>
      <div style="text-align:right">
        <div class="num34" style="color:#5E5CE6">${v(sl.score)}</div>
        <div class="t13 muted">${sl.quality ? "Qualità " + sl.quality.toLowerCase() : "Punteggio"}</div>
      </div>
    </div>
    <div class="sbars">${sleepBars}</div>
    <div class="grid3 topline">
      ${sleepCell("FC notturna", v(sl.hrSleep), "bpm")}
      ${sleepCell("Respiro", v(sl.resp, 1), "/min")}
      ${sleepCell("SpO₂", v(sl.spo2), "%")}
    </div>
  </div>`;
  const cuoreCard = `  <div class="card pad">
    <div class="grid2" style="gap:16px">
      <div class="vstack" style="gap:6px">
        <div class="hstack" style="justify-content:space-between;gap:6px"><div class="t15 semi" style="color:#30D158">HRV</div><div class="t13 muted">${hrvTrend}</div></div>
        <div class="num">${v(M.hrv)}<span class="unit"> ms</span></div>
        ${weekBars("hrv", "#30D158")}
      </div>
      <div class="vstack" style="gap:6px">
        <div class="hstack" style="justify-content:space-between;gap:6px"><div class="t15 semi" style="color:#FF375F">FC riposo</div><div class="t13 muted">${rhrTrend}</div></div>
        <div class="num">${v(M.rhr)}<span class="unit"> bpm</span></div>
        ${weekBars("rhr", "#FF375F")}
      </div>
    </div>
    <div class="hstack topline" style="justify-content:space-between">
      <div class="t15">Prontezza dell’orologio</div>
      <div class="num20">${v(sl.readiness)}</div>
    </div>
    <div class="hstack topline" style="justify-content:space-between">
      <div class="t15">Peso</div>
      <div class="num20">${A.weight === null ? "—" : fmtIt(A.weight, 1)}<span class="unit"> kg</span></div>
    </div>
  </div>`;
  DETS.set("msonno", `${sonnoCard}<button class="linkbtn" data-info="sonno" style="align-self:flex-start">Come si legge ›</button>`);
  DETS.set("mcuore", `${cuoreCard}<button class="linkbtn" data-info="cuore" style="align-self:flex-start">Come si legge ›</button>`);
  DETS.set("mforma", `${formaCard}<button class="secondary" data-goto="trend" data-sub="pr-forma">Vedi il grafico di fitness e fatica</button><button class="linkbtn" data-info="forma" style="align-self:flex-start">Come si legge ›</button>`);
  DETS.set("mcheck", `${checkinCard(DIARY, ymd(d), true)}<button class="linkbtn" data-info="checkin" style="align-self:flex-start">A cosa serve ›</button>`);
  const mt = (k, tit, lbl, val, sub, cls = "") => `<button class="mtile" data-det="${k}" data-dt="${tit}"><span class="label">${lbl}</span><span class="tv">${val}</span><span class="ts ${cls}">${sub || "&nbsp;"}</span></button>`;
  const corto = (t) => (t || "").replace(" sulla media", "").replace("nella media", "nella media");
  const ckN = Object.keys(((DIARY.checkins || {})[ymd(d)]) || {}).filter((k) => ["g", "e", "u"].includes(k)).length;
  const CBt = (N0.cibo && N0.cibo.tot) || { kcal: 0, C: 0 };
  const fr = Math.max(0, Math.min(1, CBt.kcal / Math.max(1, N0.kcal)));
  const fuelRing = `<button class="card rowbtn fring" data-goto="fuel" data-sub="co-fuel"><svg width="54" height="54" viewBox="0 0 56 56" aria-hidden="true" style="flex:none"><circle cx="28" cy="28" r="23" fill="none" style="stroke:var(--fill2)" stroke-width="7"/><circle cx="28" cy="28" r="23" fill="none" stroke="#FF9F0A" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(fr * 144.5).toFixed(1)} 144.5" transform="rotate(-90 28 28)"/></svg><div class="grow"><div class="label caps">Carburante</div><div class="t17 semi">${fmtIt(CBt.kcal)} di ${N0.kcalEst > 0 ? "≈" : ""}${fmtIt(N0.kcal)} kcal</div><div class="t13 muted">carboidrati ${fmtIt(CBt.C)} di ${fmtIt(N0.carbo)} g · ${esc((N0.dayType || "").toLowerCase())}</div></div>${CHEV}</button>`;
  const tomE = (A.tomorrowEv || []).filter((e) => !e.done), tomM = mainOf(tomE);
  const domTxt = tomM ? `${tomM.name || (SPORT[tomM.sport] || SPORT.altro).label}${tomM.min ? " · " + fmtMin(tomM.min) : ""}${tomE.length > 1 ? ` e altre ${tomE.length - 1}` : ""}` : A.domani && A.domani.palestra ? "Palestra" : "Riposo";
  const rico = (col, path) => `<span class="rico" style="background:${col}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
  const righeOggi = [
    promemoriaDomani(A) ? `<button class="lrow rowb" data-domani="1">${rico("#0A84FF", '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>')}<div class="grow"><div class="t17">Domani</div><div class="t13 muted">${esc(domTxt)}</div></div>${CHEV}</button>`
      : `<div class="lrow">${rico("#8E8E93", '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>')}<div class="grow"><div class="t17">Domani</div><div class="t13 muted">${esc(domTxt)}</div></div></div>`,
    `<button class="lrow rowb" data-det="mcheck" data-dt="Come ti senti?">${rico("#30D158", '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01"/>')}<div class="grow"><div class="t17">Come ti senti?</div><div class="t13 muted">gambe, energia, umore</div></div><span class="t15 muted" id="ckrow">${ckN === 3 ? "Fatto" : ckN ? ckN + " di 3" : "Segna"}</span>${CHEV}</button>`,
    SA ? "" : `<button class="lrow rowb" data-salute="1">${rico("#FF453A", '<path d="M12 5v14M5 12h14"/>')}<div class="grow"><div class="t17">Infortunio o malattia</div><div class="t13 muted">consigli e sedute adattate</div></div>${CHEV}</button>`,
  ].filter(Boolean);
  const oggi = `${saluteBox}
  <div class="card hero rel"><button class="info corner" data-info="prontezza" aria-label="Cosa significa">i</button>
    <div class="hstack" style="align-items:baseline;gap:12px;flex-wrap:wrap;padding-right:30px">${rd !== null ? `<span class="bignum">${rd}</span>` : ""}<span class="stw ${A.worst}">${STATE_WORD[A.worst]}.</span></div>
    ${rd !== null ? `<div class="meter" aria-label="Prontezza ${rd} su 100"><div style="width:${Math.max(2, Math.min(100, rd))}%"></div></div>` : ""}
    <div class="verdict">${esc(A.verdict)}</div>
    ${I.confidence.level !== "alta" ? `<div class="conf">Affidabilità ${I.confidence.level}: ${esc(I.confidence.missing.join(", "))}. Orologio non indossato o sincronizzazione in corso?</div>` : ""}
    ${I.adapt && !I.adapt.accepted ? `<button class="linkrow" data-goto="sett" data-sub="pi-sett">Vedi la proposta per oggi ›</button>` : ""}
    ${sedutaOggi}
  </div>
  ${pianoCard(A, "oggi")}
  ${I.fatigue ? banner(I.fatigue.level, "Affaticamento periferico", I.fatigue.text) : ""}
  ${A.soglieOggi && A.soglieOggi.length ? banner("ok", "Soglie aggiornate su Intervals", `${A.soglieOggi.join(", ").replace(/^./, (c) => c.toUpperCase())}. Zone e obiettivi delle sedute usano i nuovi valori.`) : ""}
  ${checksRow(A)}
  <div class="card mstrip">
    ${mt("msonno", "Sonno", "Sonno", sl.secs === null ? "—" : `${Math.floor(sl.secs / 3600)}h${pad(Math.round((sl.secs % 3600) / 60))}`, sl.score !== null ? "punti " + sl.score : sleepDelta !== null ? `${sleepDelta >= 0 ? "+" : "−"}${Math.abs(sleepDelta)}'` : "")}
    ${mt("mcuore", "Cuore", "HRV", v(M.hrv), corto(hrvTrend.replace(" vs media", "")), dCls(M.hrv, M.hrvMean, false))}
    ${mt("mcuore", "Cuore", "FC riposo", v(M.rhr), corto(rhrTrend.replace(" vs media", "")), dCls(M.rhr, M.rhrMean, true))}
    ${mt("mforma", "Forma", "Forma", signed(M.tsb), fz.name.toLowerCase())}
  </div>
  ${fuelRing}
  <div class="card list">${righeOggi.join('<div class="sep" style="margin-left:60px"></div>')}</div>`;

  // ================= SETTIMANA =================
  const weekView = (W, idx) => {
    const end = addDays(W.start, 6);
    const range = `${W.start.getDate()} ${MESI_BREVI[W.start.getMonth()]} – ${end.getDate()} ${MESI_BREVI[end.getMonth()]}`;
    const spW = ["nuoto", "bici", "corsa", ...(CONFIG.sport.length ? [] : ["forza"])].filter((s) => CONFIG.sport.includes(s) || (W.per[s] && W.per[s].planned) || (s === "forza" && !CONFIG.sport.length));
    const totalBar = spW.map((s) => W.plannedSec ? `<div style="flex:${W.per[s].planned} 1 0;background:${SPORT[s].c}"></div>` : "").join("");
    const days = W.days.map((D) => {
      const head = `<div class="dh${D.isToday ? " today" : ""}">
        <div class="dd"><span class="dn">${D.date.getDate()}</span><span class="dw">${D.isToday ? "Oggi" : GIORNI[D.date.getDay()]}</span></div>
        <div class="dsum">${D.evs.length ? fmtMin(D.evs.reduce((t, e) => t + e.min, 0)) : ""}</div>
      </div>`;
      const items = D.evs.map((e) => {
        const s = SPORT[e.sport] || SPORT.altro;
        const carbo = !e.done && e.rif && e.rif.voci.some((v) => v.tipo === "mangia") ? `${e.rif.g} g di carboidrati` : null;
        const meta = [e.min ? fmtMin(e.min) : null, num(e.distance) ? fmtDist(e.distance, e.sport) : null, e.load ? `${Math.round(e.load)} TSS` : null, carbo].filter(Boolean).join(" · ");
        const ex = e.exec;
        const status = ex ? `<span class="spill" style="color:${scoreCol(ex.score)};background:${scoreCol(ex.score)}22">${ex.flags.length ? "!" : "✓"} ${ex.score}</span>` : D.isPast ? `<span class="badge miss">non svolto</span>` : "";
        return `<button class="ev evrow" data-det="${regEv(e)}">
            <span class="evbar" style="background:${s.c}"></span>
            <div class="grow"><div class="t15 semi">${esc(e.name || s.label)}</div><div class="sub">${esc(meta || s.label)}</div></div>
            ${status}${CHEV}
          </button>`;
      }).join("");
      const extra = D.extra.map((a) => `<button class="ev evrow" data-det="${regAct(a)}"><div class="summary" style="padding:0;flex:1"><span class="evbar" style="background:${(SPORT[sportOf(a.type)] || SPORT.altro).c}"></span><div class="grow"><div class="t15">${esc(a.name || (SPORT[sportOf(a.type)] || SPORT.altro).label)}</div><div class="sub">Fuori piano · ${fmtMin(Math.round((num(a.moving_time) || 0) / 60))}</div></div><span class="badge ok">${CHECK}</span>${CHEV}</div></button>`).join("");
      const gym = D.gym ? `<div class="ev"><div class="summary"><span class="evbar" style="background:${SPORT.forza.c}"></span><div class="grow"><div class="t15">Palestra</div><div class="sub">Pausa pranzo · ${esc(D.gym)}</div></div></div></div>` : "";
      const empty = !D.evs.length && !D.extra.length && !D.gym ? `<div class="ev"><div class="summary"><div class="grow sub" style="padding-left:14px">Riposo</div></div></div>` : "";
      return `<div class="day${D.isPast ? " past" : ""}">${head}<div class="card list">${items}${extra}${gym}${empty}</div></div>`;
    }).join("");
    const lc = idx === 0 && A.ladderCheck ? `<div class="note" style="color:${A.ladderCheck.ok ? COL.verde : COL.giallo}">${A.ladderCheck.ok ? "✓" : "!"} ${esc(A.ladderCheck.text)}</div>` : "";
    return `<div class="wk${idx === 0 ? " on" : ""}" id="wk${idx}">
      ${idx === 0 ? adaptCard(I.adapt) : ""}
      <div class="card pad">
        <div class="hstack" style="justify-content:space-between;align-items:baseline">
          <div class="t15 muted">${range}</div>
          <div class="t15 muted">${W.n} sedute · ${Math.round(W.loadPlanned)} TSS</div>
        </div>
        <div class="hstack" style="align-items:baseline;gap:6px"><div class="num34">${fmtDur(idx === 0 ? W.doneSec : W.plannedSec)}</div><div class="t15 muted">${idx === 0 ? `di ${fmtDur(W.plannedSec)} pianificate` : "pianificate"}</div></div>
        <div class="tbar">${totalBar}</div>
        <div class="grid${spW.length}">${spW.map((s) => `<div class="hstack" style="gap:6px"><span class="dot" style="background:${SPORT[s].c}"></span><span class="t13">${SPORT[s].label} ${fmtDur(W.per[s].planned)}</span></div>`).join("")}</div>
      </div>
      ${tramaCard(W)}
      ${lc}
      ${idx === 0 ? (() => { const [mk, mw] = mobDelGiorno(A), R = MOB[mk]; return `<button class="card rowbtn" data-mob="${mk}" style="gap:12px">${`<span class="rico" style="background:#5E5CE6"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="1.8"/><path d="M5 9l7 1.5L19 9M12 10.5V15l-3.5 6M12 15l3.5 6"/></svg></span>`}<div class="grow"><div class="t17 semi">Mobilità · ${esc(R[0].toLowerCase())}</div><div class="t13 muted">${mobMin(R)}' · ${esc(mw)}</div></div><span class="t15 semi acc">Inizia</span></button>`; })() : ""}
      <h2 class="ih">Giorno per giorno<button class="info" data-info="giorni" aria-label="Cosa significa">i</button></h2>
      ${days}
      ${idx === 0 ? (DETS.set("mrev", impactCard(I.impact) + reviewCard(I.review)), `<button class="card rowbtn" data-det="mrev" data-dt="La settimana" style="gap:12px"><span class="rico" style="background:#BF5AF2"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"><path d="M5 19V11M10 19V6M15 19v-5M20 19V9"/></svg></span><div class="grow"><div class="t17 semi">${I.review.final ? "Revisione della settimana" : "Riepilogo e revisione"}</div><div class="t13 muted">carico, impatto della corsa, settimana prossima</div></div>${CHEV}</button>`) : ""}
    </div>`;
  };
  const sett = `
  <div class="seg seg3 subseg" id="seg-sett"><button class="on" data-s="pi-sett">Settimana</button><button data-s="pi-gym">Palestra</button><button data-s="pi-mob">Mobilità</button></div>
  <div class="subv on" id="pi-sett">
  ${pianoCard(A, "sett")}
  <div class="seg seg2" id="wkseg">
    <button class="on" data-w="0">Questa settimana</button>
    <button data-w="1">Prossima</button>
  </div>
  ${A.weeks.map(weekView).join("")}
  </div>
  <div class="subv" id="pi-gym"></div>
  <div class="subv" id="pi-mob"></div>`;

  // ================= TREND =================
  const recapSess = A.todayEv.map((e) => ({
    name: e.name || (SPORT[e.sport] || SPORT.altro).label,
    c: (SPORT[e.sport] || SPORT.altro).c,
    min: e.done ? Math.round((num(e.done.moving_time) || 0) / 60) : e.min,
    done: !!e.done,
  }));
  if (A.gymToday) recapSess.push({ name: "Palestra · " + A.gymToday, c: SPORT.forza.c, min: null, done: false });
  const recapData = JSON.stringify({
    date: dateLine.toUpperCase(), file: ymd(d),
    state: STATE_WORD[A.worst], stateC: COL[A.worst],
    tsb: signed(M.tsb), zone: fz.name, zoneC: fz.c,
    sleep: A.sleep.secs === null ? "—" : `${Math.floor(A.sleep.secs / 3600)}h${pad(Math.round((A.sleep.secs % 3600) / 60))}`,
    sleepScore: A.sleep.score, hrv: M.hrv, rhr: M.rhr,
    hrvMean: M.hrvMean, rhrMean: M.rhrMean, readiness: A.sleep.readiness,
    wkSleep: A.sleep.week.map((x) => x.secs), wkHrv: A.sleep.week.map((x) => x.hrv), wkRhr: A.sleep.week.map((x) => x.rhr),
    sess: recapSess.slice(0, 3), more: Math.max(0, recapSess.length - 3),
    full: A.todayEv.slice(0, 3).map((e) => ({
      name: e.name || (SPORT[e.sport] || SPORT.altro).label, c: (SPORT[e.sport] || SPORT.altro).c,
      min: e.done ? Math.round((num(e.done.moving_time) || 0) / 60) : e.min, done: !!e.done,
      load: e.load ? Math.round(e.load) : null, key: keyLine(e.parsed),
      segs: e.parsed.segs.slice(0, 90).map((g) => ({ s: Math.round(g.sec), p: Math.round(g.pct) })),
    })),
    wk: recapWeek(A.weeks[0]),
    act: A.lastAct ? (() => {
      const L = A.lastAct, sp = L.sport;
      const dur = L.sec >= 3600 ? `${Math.floor(L.sec / 3600)}:${pad(Math.floor((L.sec % 3600) / 60))}:${pad(Math.round(L.sec % 60))}` : `${Math.floor(L.sec / 60)}:${pad(Math.round(L.sec % 60))}`;
      let big = "—", bigU = "", pace = null, paceU = "";
      if (sp === "nuoto") { big = L.m ? String(Math.round(L.m)) : "—"; bigU = "M"; if (L.m && L.sec) { pace = fmtPace(L.sec / (L.m / 100)); paceU = "/100M"; } }
      else if (L.m) { big = (L.m / 1000).toFixed(L.m >= 100000 ? 0 : 1); bigU = "KM"; }
      else { big = String(Math.round(L.sec / 60)); bigU = "MIN"; }
      if (sp === "corsa" && L.v) { pace = fmtPace(1000 / L.v); paceU = "/KM"; }
      if (sp === "bici" && L.v) { pace = (L.v * 3.6).toFixed(1); paceU = "KM/H"; }
      const d = parseYMD(L.data);
      const stats = [["TEMPO", dur, ""]];
      if (pace) stats.push([sp === "bici" ? "VELOCITÀ" : "PASSO", pace, paceU]);
      if (L.hr) stats.push(["FC MEDIA", String(Math.round(L.hr)), "BPM"]);
      if (sp === "bici" && L.watt) stats.push(["POTENZA", String(Math.round(L.watt)), "W"]);
      if (L.dplus && sp !== "nuoto" && !L.indoor) stats.push(["DISLIVELLO", String(Math.round(L.dplus)), "M"]);
      if (L.tss) stats.push(["CARICO", String(Math.round(L.tss)), "TSS"]);
      if (L.kcal) stats.push(["ENERGIA", String(Math.round(L.kcal)), "KCAL"]);
      return {
        sport: sp, indoor: L.indoor, nome: L.nome,
        label: ({ corsa: "CORSA", bici: "BICI", nuoto: "NUOTO", forza: "FORZA", altro: "ATTIVITÀ" }[sp] || "ATTIVITÀ") + (L.indoor && sp !== "nuoto" && sp !== "forza" ? (sp === "corsa" ? " · TAPIS" : " · INDOOR") : ""),
        data: `${GIORNI[d.getDay()].slice(0, 3).toUpperCase()} ${d.getDate()} ${MESI_BREVI[d.getMonth()].toUpperCase()} · ${L.ora}`,
        big, bigU, stats: stats.slice(0, 6), km: L.m ? L.m / 1000 : null,
        piano: L.piano && L.piano.min ? Math.round(Math.min(150, (L.sec / 60) / L.piano.min * 100)) : null,
      };
    })() : null,
    review: { ...A.ins.review, imp: A.ins.impact.ratio, impState: A.ins.impact.state, dur: A.ins.durability.now ? fmtPace(A.ins.durability.now) : null },
    fit: A.fitness.hist.slice(-42).map((f) => ({ ctl: f.ctl, atl: f.atl, lbl: (() => { const q = parseYMD(f.d); return `${q.getDate()} ${MESI_BREVI[q.getMonth()]}`; })() })),
  }).replace(/</g, "\\u003c");
  // ---- Dati dell'impronta per la condivisione
  const allEvs = [...A.todayEv, ...A.weeks.flatMap((W) => W.days.flatMap((D) => D.evs))];
  const LA = A.lastAct;
  const lastEvS = LA ? allEvs.find((e) => e.done && e.done.start_date_local === LA.start) : null;
  const rnd = (a) => (a ? a.map((x) => Math.round(x * 100) / 100) : null);
  const shareImp = lastEvS ? impronta(lastEvS) : LA ? { plan: LA.lv, done: LA.lv, pct: null } : null;
  const tMain = mainOf(A.todayEv);
  const tImp = tMain ? impronta(tMain) : null;
  if (tImp && !tImp.done && A.ins.adapt && !A.ins.adapt.accepted) { const it = A.ins.adapt.items.find((x) => x.name === tMain.name); if (it) tImp.plan = impAdapt(tImp.plan, it); }
  const attData = JSON.stringify(A.att || {}).replace(/</g, "\\u003c");
  const shareData = JSON.stringify({
    imp: shareImp ? { plan: rnd(shareImp.plan), done: rnd(shareImp.done), pct: shareImp.pct, name: lastEvS ? lastEvS.name : LA.nome || "" } : null,
    today: tImp ? { plan: rnd(tImp.plan), done: rnd(tImp.done), name: tMain.name || (SPORT[tMain.sport] || SPORT.altro).label, min: tMain.min } : null,
    rd: A.sleep.readiness, word: STATE_WORD[A.worst], worst: A.worst,
    week: weekImp(A.weeks[0]).map((r) => ({ l: r.D.isToday ? "Oggi" : GG[r.D.date.getDay()], plan: r.I ? rnd(r.I.plan) : null, done: r.I ? rnd(r.I.done) : null, min: r.min, today: r.D.isToday })),
    wkDone: Math.round(A.weeks[0].doneSec / 60), wkPlan: Math.round(A.weeks[0].plannedSec / 60),
    season: A.season.map((w) => ({ d: Math.round(w.done || 0), p: w.plan ? Math.round(w.plan) : null, c: !!w.cur })),
    race: A.raceDays !== null && A.raceDays >= 0 && CONFIG.obiettivo ? { days: A.raceDays, name: CONFIG.obiettivo.nome, date: (() => { const q = parseYMD(CONFIG.obiettivo.data); return `${q.getDate()} ${MESI[q.getMonth()]} ${q.getFullYear()}`; })() } : null,
    ctl: M.ctl !== null ? Math.round(M.ctl) : null,
  }).replace(/</g, "\\u003c");
  const fitData = JSON.stringify({ h: A.fitness.hist, p: A.fitness.proj, today: ymd(A.now) });
  const K = CONFIG.riegelK;
  const N = A.nutrition;
  const NC = CONFIG.nutrizione;
  const PN = N.piano, NPn = N.np;
  const FASE_TXT = !NPn.daProfilo ? "Stima di partenza: completa sesso, anno, altezza e peso in Impostazioni per un calcolo preciso."
    : NPn.dimagrire && PN.fase === "dimagrimento" ? `Dimagrimento · obiettivo ${kgIt(NPn.pesoObiettivo)} kg` : NPn.dimagrire ? "Mantenimento fino alla gara" : "Mantenimento: mangi quello che consumi";
  const kc = { c: N.carbo * 4, p: N.proteine * 4, g: N.grassi * 9 };
  const kTot = kc.c + kc.p + kc.g;
  const macro = (lbl, g, kcal, col) => `<div class="lrow"><div class="hstack" style="gap:10px"><span class="dot" style="background:${col};width:10px;height:10px"></span><span>${lbl}</span></div><div><span class="num20">${g}</span><span class="unit"> g · ${fmtIt(kcal)} kcal</span></div></div>`;
  const sessLine = A.todayEv.length ? A.todayEv.map((e) => `<div class="hstack" style="gap:8px"><span class="dot" style="background:${(SPORT[e.sport] || SPORT.altro).c}"></span><span class="t15">${esc(e.name)}</span><span class="t13 muted" style="margin-left:auto">${fmtMin(e.min)}</span></div>`).join("") : `<div class="t15 muted">Nessuna seduta a calendario</div>`;
  const dB = (ds) => { const q = parseYMD(ds); return `${q.getDate()} ${MESI_BREVI[q.getMonth()]}`; };
  const storiaS = ((A.diary || {}).saluteStoria || []).slice(-5).reverse();
  const saluteCorpo = `${SA ? saluteBox : `<div class="card pad"><div class="t17 semi">Stai bene</div><div class="t15 muted" style="line-height:1.45">Se hai un fastidio o sei malato, segnalalo: ti dico cosa puoi fare, come cambia il Carburante e propongo come adattare le prossime sedute. Le cambio solo se confermi.</div><button class="primary" data-salute="1">Segnala infortunio o malattia</button></div>`}
  ${storiaS.length ? `<h2>Gli ultimi episodi</h2><div class="card list">${storiaS.map((x, i) => `${i ? '<div class="sep l16"></div>' : ""}<div class="lrow"><div class="grow"><div class="t15">${x.tipo === "malattia" ? "Malattia" : esc((ZONE_INF[x.zona] || ZONE_INF.altro).nome)}</div><div class="t13 muted">dal ${dB(x.dal)}${x.guarito ? " al " + dB(x.guarito) : ""}</div></div></div>`).join("")}</div>` : ""}
  <div class="t13 muted" style="padding:0 4px;line-height:1.4">Indicazioni generali, non un parere medico. Restano solo su questo iPhone.</div>`;
  const fuelView = `
  <div class="seg seg3 subseg" id="seg-fuel"><button class="on" data-s="co-fuel">Carburante</button><button data-s="co-peso">Peso</button><button data-s="co-sal">Salute</button></div>
  <div class="subv on" id="co-fuel">
  <div class="card hero" style="gap:14px">
    <div class="hstack" style="justify-content:space-between;align-items:flex-end">
      <div><div class="label semi">Obiettivo di oggi</div><div class="num34">${N.kcalActive || !N.kcalEst ? "" : "≈"}${fmtIt(N.kcal)}<span class="unit" style="font-size:15px"> kcal</span></div></div>
      <div class="pill" style="color:#FF9F0A;background:rgba(255,159,10,.16)">${esc(N.dayType)}</div>
    </div>
    <div class="t13 muted" style="line-height:1.45">${fmtIt(PN.base)} di base + ${fmtIt(PN.esercizio)} di allenamento${PN.deficit ? ` − ${fmtIt(PN.deficit)} di deficit` : ""}${PN.surplus ? ` + ${fmtIt(PN.surplus)} di carico` : ""}</div>
    <div class="tbar" style="height:10px">
      <div style="flex:${kc.c} 1 0;background:#FF9F0A"></div><div style="flex:${kc.p} 1 0;background:#64D2FF"></div><div style="flex:${kc.g} 1 0;background:#BF5AF2"></div>
    </div>
    <div class="grid3">${[["Carboidrati", N.carbo, "#FF9F0A"], ["Proteine", N.proteine, "#64D2FF"], ["Grassi", N.grassi, "#BF5AF2"]].map(([l, g, c]) => `<div><div class="hstack" style="gap:6px"><span class="dot" style="background:${c}"></span><span class="label">${l}</span></div><div class="num20">${g}<span class="unit"> g</span></div></div>`).join("")}</div>
    <div class="t13 muted" style="line-height:1.4">Carboidrati ${fmtIt(PN.gkg, 1)} g per kg${PN.durante ? `, di cui ${PN.durante} g durante le sedute` : ""}. Proteine ${fmtIt(PN.P / PN.peso, 1)} g/kg, grassi ${fmtIt(PN.G / PN.peso, 1)} g/kg.</div>
    ${PN.motivi.length ? `<div class="vstack" style="gap:6px">${PN.motivi.map((m) => `<div class="t13" style="color:var(--warn)">${esc(m)}</div>`).join("")}</div>` : ""}
    <div class="vstack" style="gap:8px;border-top:.5px solid var(--sep);padding-top:12px">${sessLine}</div>
    <div class="t13 muted">${esc(FASE_TXT)}</div>
  </div>
  ${mangiatoCard(N)}
  ${lungoCard(N.rif)}
  ${(DETS.set("mpasti", `<div class="card list">${N.meals.map(([k, t], i) => `${i ? '<div class="sep l16"></div>' : ""}<div class="lrow" style="align-items:flex-start"><div class="mk" style="padding-top:2px">${esc(k)}</div><div class="mt grow">${esc(t)}</div></div>`).join("")}</div><div class="t13 muted" style="line-height:1.4">Pasta, riso e cereali pesati a crudo. Sono indicazioni generali: se hai un nutrizionista, vale il suo piano.</div>${N.chips.length ? `<h3>Da ricordare</h3><div class="chips">${N.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>` : ""}`), "")}
  ${N.rif && rifornimentoCard(N.rif) ? (DETS.set("mrif", rifornimentoCard(N.rif)), "") : ""}
  ${N.modo === "auto" && N.consumi && N.consumi.length ? (DETS.set("mbruci", `<div class="card list">${N.consumi.filter((c) => (CONFIG.sport.includes(c.sport) || (c.sport === "forza" && PROF && PROF.palestra) || c.fonte !== "stima") && (c.fonte !== "stima" || c.classe === "facile")).map((c, i) => `${i ? '<div class="sep l16"></div>' : ""}<div class="lrow"><div><div>${esc((SPORT[c.sport] || SPORT.altro).label)} ${c.sport === "forza" ? "" : CLASSI[c.classe]}</div><div class="sub">${c.fonte === "tue" ? `dalle tue ${c.n} sedute` : c.fonte === "sport" ? `dalle tue sedute di ${esc((SPORT[c.sport] || SPORT.altro).label.toLowerCase())}` : "stima dal peso, finché non ci sono tue sedute"}</div></div><div><span class="num20">${fmtIt(c.kpm, 1)}</span><span class="unit"> kcal/min</span></div></div>`).join("")}</div>`), "") : ""}
  <div class="card list">
    <button class="lrow rowb" data-det="mpasti" data-dt="Pasti di oggi"><span class="rico" style="background:#FF9F0A"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-2 2-2.5 5-2.5 8h3V21"/></svg></span><div class="grow"><div class="t17">Pasti di oggi</div><div class="t13 muted">${N.meals.length} pasti · ${esc(N.meals.map(([k]) => k.toLowerCase()).slice(0, 3).join(", "))}</div></div>${CHEV}</button>
    ${N.rif && rifornimentoCard(N.rif) && CONFIG.sport.some((x) => x === "bici" || x === "corsa") ? `<div class="sep" style="margin-left:60px"></div><button class="lrow rowb" data-det="mrif" data-dt="Rifornimento"><span class="rico" style="background:#64D2FF"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/></svg></span><div class="grow"><div class="t17">Rifornimento e sudore</div><div class="t13 muted">${["bici", "corsa"].filter((x) => CONFIG.sport.includes(x)).map((x) => `${x} ${N.rif.gh[x]} g/h`).join(" · ") || "acqua e sali"}${["bici", "corsa"].some((x) => CONFIG.sport.includes(x)) ? " di carboidrati" : ""}</div></div>${CHEV}</button>` : ""}
    ${N.modo === "auto" && N.consumi && N.consumi.length ? `<div class="sep" style="margin-left:60px"></div><button class="lrow rowb" data-det="mbruci" data-dt="Quanto bruci"><span class="rico" style="background:#FF453A"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-4.3 4.5-6.3 4-11.3 3.4 2 7 5.7 7 10.6 0 4.2-1.8 6.9-4.5 6.9z"/></svg></span><div class="grow"><div class="t17">Quanto bruci</div><div class="t13 muted">calorie al minuto per sport, dalle tue attività</div></div>${CHEV}</button>` : ""}
  </div>
  </div>
  <div class="subv" id="co-peso">${weightCard(I.weight) || `<div class="card pad"><div class="t15 muted">Ancora nessuna pesata: scrivila qui ogni mattina o dalla bilancia.</div></div>`}</div>
  <div class="subv" id="co-sal">${saluteCorpo}</div>`;
  const tr = `
  <div class="seg seg3 subseg" id="seg-trend"><button class="on" data-s="pr-forma">Forma</button><button data-s="pr-rec">Record</button><button data-s="pr-sog">Soglie</button></div>
  <div class="subv on" id="pr-forma">
  ${seasonCard(A)}
  <h2 class="ih">Fitness e fatica<button class="info" data-info="fitness" aria-label="Come si legge">i</button></h2>
  <div class="seg seg4" id="rgseg">
    <button data-r="42">6 sett.</button>
    <button class="on" data-r="90">3 mesi</button>
    <button data-r="180">6 mesi</button>
    <button data-r="365">1 anno</button>
  </div>
  <div class="card pad" style="gap:4px">
    <div id="fitread" class="fitread"></div>
    <div id="fitchart" class="fitchart"></div>
    <div class="legend">
      <span><i style="background:#0A84FF"></i>Fitness</span>
      <span><i style="background:#BF5AF2"></i>Fatica</span>
      <span><i style="background:#fff"></i>Forma</span>
      <span><i class="dash"></i>Piano</span>
    </div>
  </div>
  <div class="t13 muted" style="padding:0 16px;line-height:1.4">Tieni premuto e scorri per leggere un giorno. Il tratteggio è quello che succede se fai le sedute in programma. Come si legge: tocca la i.</div>
  ${trajectoryCard(I.trajectory)}
  <button class="secondary" data-shlay="stagione">Condividi la stagione</button>
  </div>
  <div class="subv" id="pr-rec">
  ${recordCard(A.record, A.now)}
  ${progressiCard(A.prog, I.durability)}
  ${gearCard(A.gear || [], A.now)}
  </div>
  <div class="subv" id="pr-sog">
  ${soglieCard(A)}
  ${checksCard(A)}
  ${CONFIG.sport.includes("corsa") ? predictorsCard(I.predictors) : ""}
  ${K && K.valore ? `<div class="card list">
    <div class="lrow"><div><div>Durabilità · Riegel k</div><div class="sub">Obiettivo ${fmtIt(K.obiettivo, 2)}</div></div><span class="num20" style="color:${K.valore > K.obiettivo ? COL.giallo : COL.verde}">${fmtIt(K.valore, 3)}</span></div>
  </div>` : ""}
  </div>`;

  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${esc(CONFIG.nomeApp)}</title>
<style>
:root{--bg:#F2F2F7;--card:#FFFFFF;--fill:#EFEFF4;--fill2:#E5E5EA;--sep:#E5E5EA;--fg:#1D1D1F;--mut:rgba(60,60,67,.62);--mut2:rgba(60,60,67,.38);--acc:#C2410C;--accbg:#C2410C;--good:#1F8F4E;--warn:#C26A00;--bad:#D70015;--verde:#1F8F4E;--giallo:#C26A00;--rosso:#D70015;--ipl:#C7C7CC;--today:#FFF3EA;--tab:rgba(249,249,251,.94)}
@media (prefers-color-scheme:dark){:root{--bg:#000000;--card:#1C1C1E;--fill:#2C2C2E;--fill2:#3A3A3C;--sep:#38383A;--fg:#F5F5F7;--mut:rgba(235,235,245,.62);--mut2:rgba(235,235,245,.38);--acc:#FF9F45;--accbg:#C2410C;--good:#30D158;--warn:#FF9F0A;--bad:#FF453A;--verde:#30D158;--giallo:#FF9F0A;--rosso:#FF453A;--ipl:#48484A;--today:rgba(255,106,26,.16);--tab:rgba(22,22,24,.92)}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
body{padding:calc(env(safe-area-inset-top) + 12px) 16px calc(env(safe-area-inset-bottom) + 104px)}
.wrap{max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.top{display:flex;justify-content:space-between;align-items:flex-end;padding-top:8px}
.date{font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--mut);text-transform:uppercase}
h1{margin:2px 0 0;font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:1.1}
h2{margin:10px 0 -4px 4px;font-size:22px;font-weight:700;letter-spacing:-.02em}
.h2row{display:flex;justify-content:space-between;align-items:baseline;margin:6px 4px -6px}.h2row h2{margin:0}
.seg{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:2px;background:var(--fill2);border-radius:9px}
.pill{font-size:13px;font-weight:600;padding:5px 11px;border-radius:999px;flex:none}
.seg2{grid-template-columns:repeat(2,1fr)}.seg4{grid-template-columns:repeat(4,1fr)}
.seg button{border:0;border-radius:7px;padding:7px 0;font:inherit;font-size:13px;font-weight:500;color:var(--fg);background:transparent;-webkit-tap-highlight-color:transparent}
.seg button.on{background:var(--card);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.view,.wk{display:none;flex-direction:column;gap:14px}.view.on,.wk.on{display:flex}
.card{background:var(--card);border-radius:20px}
.pad{padding:16px;display:flex;flex-direction:column;gap:12px}
.hero{padding:18px;display:flex;flex-direction:column;gap:12px}
.bignum{font-size:60px;font-weight:700;letter-spacing:-.045em;line-height:.95}
.stw{font-size:28px;font-weight:700;letter-spacing:-.02em}.stw.verde{color:var(--verde)}.stw.giallo{color:var(--giallo)}.stw.rosso{color:var(--rosso)}
.meter{height:8px;border-radius:4px;background:var(--fill2);overflow:hidden}.meter div{height:100%;border-radius:4px;background:var(--fg)}
.hstack{display:flex;align-items:center;gap:14px}.vstack{display:flex;flex-direction:column}
.ico{border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
.label{font-size:12px;font-weight:600;color:var(--mut)}.label.caps{text-transform:uppercase;letter-spacing:.03em}
.state{font-size:28px;font-weight:700;letter-spacing:-.02em;line-height:1.1}
.verdict{font-size:15px;line-height:1.4;color:var(--mut)}
.grid1{display:grid;grid-template-columns:1fr;gap:8px}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.topline{border-top:.5px solid var(--sep);padding-top:14px}
.mini{background:var(--fill);border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
.num{font-size:22px;font-weight:600;letter-spacing:-.02em}
.num20{font-size:20px;font-weight:600;letter-spacing:-.02em}
.num34{font-size:34px;font-weight:700;letter-spacing:-.03em;line-height:1.05}
.unit{font-size:12px;font-weight:500;color:var(--mut)}
.list{overflow:hidden}
.grow{flex:1;min-width:0}
.t22{font-size:22px;letter-spacing:-.02em}.t17{font-size:17px}.t15{font-size:15px}.t13{font-size:13px}.semi{font-weight:600}.bold{font-weight:700}.acc{color:var(--acc)}
.sub{font-size:13px;color:var(--mut);line-height:1.35;margin-top:1px}
.sep{border-top:.5px solid var(--sep);margin-left:68px}.sep.l16{margin-left:16px}
.lrow{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;font-size:17px;gap:12px}
.muted{color:var(--mut)}
.formbar{display:flex;gap:3px;width:130px;height:8px;margin-bottom:8px}.formbar div{flex:1;border-radius:4px}
.sbars{display:flex;gap:8px;height:84px}
.sbc{flex:1;display:flex;flex-direction:column;gap:4px;align-items:center}
.sbt{flex:1;width:100%;display:flex;flex-direction:column;justify-content:flex-end}
.mbars{display:flex;gap:4px;height:48px}.mbc{flex:1;display:flex;flex-direction:column;gap:3px;align-items:center}.mbt{flex:1;width:100%;display:flex;flex-direction:column;justify-content:flex-end}
.sbl{font-size:11px;color:var(--mut2)}
/* impronta */
.imp{display:flex;align-items:stretch;gap:3px;width:100%}.imp i{flex:1 1 0;position:relative;min-width:2px}.imp b{position:absolute;left:0;right:0;bottom:0;border-radius:999px;min-height:4px}.imp .ip{box-shadow:inset 0 0 0 1.4px var(--ipl)}.imp .if{background:var(--fg)}.imp .ia{background:#FF6A1A}
.imp-card{gap:10px}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tile{background:var(--card);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.tv{font-size:24px;font-weight:700;letter-spacing:-.03em}
.ts{font-size:12px;color:var(--mut)}.ts.good{color:var(--good)}.ts.warn{color:var(--warn)}
.chk{padding:13px 16px;display:flex;flex-direction:column;gap:2px}.chkt{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px}
.rowbtn{border:0;width:100%;text-align:left;font:inherit;color:inherit;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;-webkit-tap-highlight-color:transparent}
.chev2{font-size:22px;color:var(--mut2)}
.linkbtn{border:0;background:none;font:inherit;font-size:15px;font-weight:500;color:var(--acc);padding:0;white-space:nowrap;flex:none}.linkbtn.back{align-self:flex-start;font-size:17px}
#backbtn{display:block;margin:0 0 8px -2px;padding:4px 8px 4px 0;font-size:17px;-webkit-tap-highlight-color:transparent}#backbtn[hidden],body.first #backbtn{display:none}
.sheetbox::before{content:"";align-self:center;flex:none;width:38px;height:5px;border-radius:3px;background:var(--sep);margin:-8px 0 -4px}
.pillbtn{border:0;border-radius:999px;background:var(--accbg);color:#fff;font:inherit;font-size:15px;font-weight:600;padding:8px 16px}
.trama{padding:4px 16px}
.trow{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:.5px solid var(--sep)}.trow:last-child{border-bottom:0}
.trow.today{background:var(--today);margin:0 -10px;padding:11px 10px;border-radius:12px;border-bottom:0}
.tday{width:40px;flex:none;font-size:14px;font-weight:600;color:var(--mut)}.trow.today .tday{color:var(--acc);font-weight:700}
.tbody{flex:1;min-width:0}
.tmin{width:56px;flex:none;text-align:right;font-size:14px;font-weight:600}.tmin small{font-size:11px;color:var(--mut)}
.season{background:#000;color:#F5F5F7;padding:20px 18px 18px;display:flex;flex-direction:column;gap:14px}
.season .bignum{font-size:56px}
.nastro .np{fill:none;stroke:#48484A;stroke-width:1.4}.nastro .nf{fill:#F5F5F7}.nastro .nf.cur{fill:#F5F5F7}.nastro .nr{fill:none;stroke:#FF6A1A;stroke-width:2}.nastro .nd{fill:#636366}
/* attività */
.attnav{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 0}
.navb{width:40px;height:40px;border-radius:50%;border:0;background:var(--fill2);color:var(--fg);font:600 24px/1 -apple-system,sans-serif;padding:0 0 3px;-webkit-tap-highlight-color:transparent;flex:none}.navb:disabled{opacity:.3}
.attc{padding:16px;display:flex;flex-direction:column;gap:16px}
.atth{display:flex;gap:12px;align-items:stretch}.atth .sharebtn{align-self:center;flex:none}
.ahero{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.agrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 10px}.agrid .num20{font-size:18px}
.gwrap{display:flex;flex-direction:column;gap:18px;border-top:.5px solid var(--sep);padding-top:14px}
.gch{display:flex;flex-direction:column;gap:6px}.gtop{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.gbox{position:relative;height:110px;touch-action:pan-y}.gbox svg{display:block;overflow:visible}
.gcur{position:absolute;top:0;bottom:0;width:1.5px;background:var(--fg);opacity:0;pointer-events:none;transform:translateX(-50%)}
.gdot{position:absolute;width:10px;height:10px;border-radius:50%;background:var(--fg);box-shadow:0 0 0 2.5px var(--card);transform:translate(-50%,-50%);opacity:0;pointer-events:none}
.gbub{position:absolute;left:0;top:0;opacity:0;pointer-events:none;background:var(--bg);border-radius:10px;padding:5px 9px;box-shadow:0 2px 12px rgba(0,0,0,.28);display:flex;flex-direction:column;line-height:1.25;white-space:nowrap;z-index:2}
.gbub b{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}.gbub span{font-size:11px;color:var(--mut);font-variant-numeric:tabular-nums}
.scr{position:relative;touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}.scr>svg{display:block}
.gch{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
body.scrubbing{-webkit-user-select:none;user-select:none}
.gax{position:absolute;left:0;font-size:11px;color:var(--mut);font-variant-numeric:tabular-nums;background:var(--card);padding:0 4px 0 0;border-radius:4px}.gmax{top:-4px}.gmin{bottom:-4px}
.gxs{display:flex;justify-content:space-between;font-size:11px;color:var(--mut);font-variant-numeric:tabular-nums}
.asec{display:flex;flex-direction:column;gap:8px;border-top:.5px solid var(--sep);padding-top:14px}
.zbar{display:flex;height:10px;border-radius:5px;overflow:hidden;gap:2px}.zrow{display:flex;align-items:center;gap:8px}.zdot{width:10px;height:10px;border-radius:3px;flex:none}
.route{background:var(--fill);border-radius:14px;padding:6px}
.krow{display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}.kbar{flex:1;height:8px;background:var(--fill);border-radius:4px;overflow:hidden}.kbar span{display:block;height:100%;background:#64D2FF;border-radius:4px}
.lrow2{display:flex;align-items:center;gap:8px;padding:3px 0;font-variant-numeric:tabular-nums}.lrow2.rec{opacity:.55}
.tline{position:relative;height:12px;border-radius:6px;background:var(--fill);margin-top:4px}.tline span{position:absolute;top:0;bottom:0;border-radius:6px;min-width:4px}
.tlx{display:flex;justify-content:space-between;font-size:11px;color:var(--mut)}
#fnt button{font-size:16px}
/* sedute */
.sess{padding:16px;display:flex;flex-direction:column;gap:12px}
.steps{display:flex;flex-direction:column;gap:2px}
.st{display:flex;gap:12px;padding:7px 0;align-items:flex-start}
.st.in{padding-left:12px;margin-left:4px}
.st.rest .sl,.st.rest .sn{color:var(--mut)}
.sl{width:52px;flex:none;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.sr{flex:1;display:flex;flex-direction:column;gap:4px}
.sn{font-size:15px}
.stx{font-size:15px;line-height:1.4}
.tgs{display:flex;gap:6px;flex-wrap:wrap}
.tg{font-size:13px;padding:2px 8px;border-radius:6px;background:var(--fill);color:var(--fg);font-variant-numeric:tabular-nums}
.tg.tp{background:var(--fill2);font-weight:600}
.srep{font-size:13px;font-weight:700;letter-spacing:.02em;padding:8px 0 0}
.rif{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:rgba(255,159,10,.10)}
.rvs{display:flex;flex-direction:column}
.rv{display:flex;gap:12px;padding:5px 0;font-size:15px;border-top:.5px solid var(--sep)}
.rv:first-child{border-top:0}
.rv .rt{width:52px;flex:none;font-weight:600;font-variant-numeric:tabular-nums}
.rv .rg{color:var(--mut);font-variant-numeric:tabular-nums;margin-left:4px}
.rv.bv{color:var(--mut)}
.done{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--good);font-weight:600}
/* settimana */
.day{display:flex;flex-direction:column;gap:6px}
.day.past .card{opacity:.7}
.dh{display:flex;justify-content:space-between;align-items:baseline;padding:4px 4px 0}
.dd{display:flex;align-items:baseline;gap:8px}
.dn{font-size:22px;font-weight:700;letter-spacing:-.02em}
.dw{font-size:15px;color:var(--mut)}
.dh.today .dn,.dh.today .dw{color:var(--acc)}.dh.today .dw{font-weight:600}
.dsum{font-size:13px;color:var(--mut2)}
.ev{border-top:.5px solid var(--sep)}.ev:first-child{border-top:0}
.ev summary,.ev .summary{list-style:none;display:flex;align-items:center;gap:12px;padding:12px 16px 12px 12px;-webkit-tap-highlight-color:transparent}
.ev summary::-webkit-details-marker{display:none}
.evbar{width:4px;align-self:stretch;border-radius:2px;flex:none}
.chev{transition:transform .2s;flex:none}
details[open] .chev{transform:rotate(90deg)}
.evbody{padding:0 16px 14px 28px;display:flex;flex-direction:column;gap:10px}
.badge{font-size:12px;flex:none;display:flex;align-items:center}
.badge.miss{color:var(--mut2)}
.tbar{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px;background:var(--fill)}
.note{font-size:13px;padding:0 16px;margin-top:-6px}
/* stagione */
.fitread{display:flex;flex-direction:column;gap:2px;min-height:62px}
.fitread .fd{font-size:13px;color:var(--mut)}
.fitread .fv{display:flex;gap:16px;align-items:baseline}
.fitread .fv b{font-size:24px;letter-spacing:-.02em}
.fitread .fv small{font-size:12px;color:var(--mut);display:block;font-weight:400}
.fitchart{width:100%;touch-action:pan-y;-webkit-user-select:none;user-select:none;color:var(--fg)}
.legend{display:flex;gap:14px;font-size:12px;color:var(--mut);flex-wrap:wrap}
.legend span{display:flex;align-items:center;gap:5px}.legend i{width:12px;height:3px;border-radius:2px;display:inline-block}
.legend i.dash{background:repeating-linear-gradient(90deg,#8E8E93 0 3px,transparent 3px 5px)}
.meal{display:flex;gap:12px}.mk{width:74px;flex:none;font-size:13px;font-weight:600;color:var(--mut);padding-top:1px}.mt{font-size:15px;line-height:1.35}
.chips{display:flex;gap:8px;flex-wrap:wrap}.chip{font-size:13px;padding:6px 12px;border-radius:999px;background:var(--fill)}
.sharebtn{width:36px;height:36px;border-radius:50%;border:0;background:var(--fill2);color:var(--fg);display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
.tabbar{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:space-around;padding:7px 8px calc(env(safe-area-inset-bottom) + 6px);background:var(--tab);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-top:.5px solid var(--sep);z-index:8}
.tabbar button{border:0;background:none;font:inherit;display:flex;flex-direction:column;align-items:center;gap:2px;color:#8E8E93;min-width:70px;padding:2px 0;-webkit-tap-highlight-color:transparent}
.tabbar button span{font-size:10px;font-weight:600}.tabbar button.on{color:var(--acc)}
.sheet{position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:flex-end;justify-content:center;z-index:10}
.sheet.on{display:flex}
.sheetbox{width:100%;max-width:520px;background:var(--bg);border-radius:22px 22px 0 0;padding:16px 16px calc(env(safe-area-inset-bottom) + 20px);display:flex;flex-direction:column;gap:14px;max-height:94vh;overflow:auto}
.sheethead{display:flex;justify-content:space-between;align-items:center}
.link{border:0;background:none;color:var(--acc);font:inherit;font-size:17px;padding:4px}
.checker{border-radius:14px;overflow:hidden;background-color:#C7C7CC;background-image:linear-gradient(45deg,#E5E5EA 25%,transparent 25%),linear-gradient(-45deg,#E5E5EA 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#E5E5EA 75%),linear-gradient(-45deg,transparent 75%,#E5E5EA 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0;display:flex;justify-content:center}
.checker canvas{width:44%;display:block;margin:10px 0}
.optl{font-size:13px;font-weight:600;color:var(--mut);text-transform:uppercase;letter-spacing:.03em;margin:2px 4px -6px}
.chiprow{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0}.chiprow::-webkit-scrollbar{display:none}.sheetbox>*{flex:none}
.chiprow button{flex:none;border:0;border-radius:999px;padding:8px 14px;font:inherit;font-size:15px;font-weight:500;background:var(--card);color:var(--fg);-webkit-tap-highlight-color:transparent}
.chiprow button.on{background:var(--fg);color:var(--bg);font-weight:600}
.btnrow{display:grid;grid-template-columns:1fr 2fr;gap:10px}
.secondary{border:0;border-radius:14px;background:var(--card);color:var(--fg);font:inherit;font-size:17px;font-weight:600;padding:15px}
.primary{border:0;border-radius:14px;background:var(--accbg);color:#fff;font:inherit;font-size:17px;font-weight:600;padding:15px}
.toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 110px);transform:translate(-50%,20px);background:rgba(44,44,46,.96);color:#fff;font-size:15px;font-weight:600;padding:12px 18px;border-radius:999px;opacity:0;transition:all .25s;z-index:20;pointer-events:none;white-space:nowrap;display:flex;gap:8px;align-items:center}
.toast.on{opacity:1;transform:translate(-50%,0)}
.banner{gap:0}
.conf{font-size:13px;color:var(--warn);line-height:1.4;margin-top:-4px}
.linkrow{border:0;background:var(--fill);color:var(--acc);font:inherit;font-size:15px;font-weight:600;border-radius:12px;padding:12px;text-align:left}
.ckrow{display:flex;flex-direction:column;gap:8px}
.ckbtns{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.ck{border:0;border-radius:10px;height:44px;background:var(--fill);color:var(--fg);font:inherit;font-size:17px;font-weight:600;-webkit-tap-highlight-color:transparent}
.ck.on{background:var(--fg);color:var(--bg)}
.pred{display:flex;flex-direction:column;gap:4px}
.pbar{height:6px;border-radius:3px;background:var(--fill);overflow:hidden;margin-top:4px}.pbar div{height:100%;border-radius:3px}
.adapt{box-shadow:inset 0 0 0 1px rgba(255,159,10,.5)}
.adrow{display:flex;gap:12px;align-items:stretch}
.adapt button[disabled]{color:var(--good);opacity:1}
.gauge{position:relative;height:10px;border-radius:5px;overflow:hidden;background:var(--fill);margin-top:4px}
.gz{position:absolute;top:0;bottom:0;opacity:.35}
.gm{position:absolute;top:-3px;width:4px;height:16px;margin-left:-2px;background:var(--fg);border-radius:2px}
.ibars{display:flex;gap:10px;height:70px}
.ibc{flex:1;display:flex;flex-direction:column;gap:4px;align-items:center}
.ibt{flex:1;width:100%;display:flex;flex-direction:column;justify-content:flex-end}
.ibt div{border-radius:5px 5px 0 0}
.lrow>span:first-child{white-space:nowrap}.lrow>span.muted:last-child{text-align:right}
.propo{margin:4px 16px 16px;padding:12px 14px;border-radius:12px;background:rgba(255,159,10,.14);color:var(--warn);font-size:15px;font-weight:600;line-height:1.4}
.spill{font-size:13px;font-weight:700;padding:3px 9px;border-radius:999px;flex:none}
.exbox{background:var(--fill);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.upd{text-align:center;font-size:12px;color:var(--mut2);margin-top:8px}
.rel{position:relative}
.info{width:22px;height:22px;border-radius:50%;border:0;background:var(--fill2);color:var(--mut);font:600 13px/22px -apple-system,"SF Pro Text",sans-serif;font-style:italic;padding:0;text-align:center;flex:none;-webkit-tap-highlight-color:transparent}
.info.corner{position:absolute;top:12px;right:12px;z-index:1}.info.dark{background:#2C2C2E;color:#A1A1A6}
h2.ih{display:flex;align-items:center;gap:8px}
body.first .tabbar,body.first #sharebtn,body.first #setbtn,body.first .upd{display:none}
.setup{display:flex;flex-direction:column;gap:14px}.setup .lede{margin:0 4px;font-size:16px;line-height:1.45;color:var(--mut)}
.form{gap:16px}.fq{display:flex;flex-direction:column;gap:8px;min-width:0}.fq label,.flab{font-size:13px;font-weight:600;color:var(--mut)}
.form input{font:inherit;font-size:17px;color:var(--fg);background:var(--fill);border:0;border-radius:12px;padding:12px 14px;width:100%;min-width:0;-webkit-appearance:none;appearance:none}
.form input:focus{outline:2px solid var(--acc);outline-offset:0}
.grid2f{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.seg6{grid-template-columns:repeat(6,1fr)}.seg button{min-height:34px}
.days7{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.sport3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.sport3 button{border:0;height:46px;border-radius:23px;background:var(--fill);color:var(--fg);font:inherit;font-size:16px;font-weight:600;-webkit-tap-highlight-color:transparent}
.sport3 button.on{background:var(--fg);color:var(--bg)}
.seg1{grid-template-columns:1fr}
.days7 button{border:0;height:42px;border-radius:21px;background:var(--fill);color:var(--fg);font:inherit;font-size:15px;font-weight:600}
.days7 button.on{background:var(--fg);color:var(--bg)}
.sub2{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.ferr{color:var(--bad);font-size:15px;margin:0 4px;min-height:0}
.plan{gap:10px}.plan .primary,.plan .secondary{margin-top:4px}.plan .secondary{background:var(--fill)}
.rowlink{border:0;background:none;width:100%;text-align:left;font:inherit;color:inherit}
.pv{display:flex;flex-direction:column;gap:12px}.pvw{background:var(--card);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.pvh{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;font-weight:600;color:var(--mut)}
.pvr{display:grid;grid-template-columns:34px 10px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:15px}.pvr .q{font-weight:600}
.pvbtn{display:grid;grid-template-columns:1fr 2fr;gap:10px;position:sticky;bottom:0;padding-top:6px}
.tile{position:relative}.tile .info.corner{top:10px;right:10px}
button.trow{border:0;background:none;font:inherit;color:inherit;width:100%;text-align:left;-webkit-tap-highlight-color:transparent}
.trama.rel{padding-top:34px}
.evrow{border:0;background:none;width:100%;text-align:left;font:inherit;color:inherit;display:flex;align-items:center;gap:12px;padding:12px 16px 12px 12px;-webkit-tap-highlight-color:transparent}
.ev.evrow:first-child{border-top:0}
.pbox{gap:16px}
.pbody{display:flex;flex-direction:column;gap:14px;padding-bottom:8px}
.pbody h3{margin:6px 0 -6px;font-size:17px;font-weight:700}
.pbody p{margin:0;font-size:16px;line-height:1.5}
.pbody p.q{font-size:15px;color:var(--mut)}
.pbody .icard{background:var(--card);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.pbody .icard b{font-size:16px}.pbody .icard span{font-size:15px;line-height:1.45;color:var(--mut)}
.dhead{display:flex;gap:12px;align-items:stretch}
.dimp{background:var(--card);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px}
.dstats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;background:var(--card);border-radius:16px;padding:14px}
.keyline{font-size:15px;font-weight:600;background:var(--card);border-radius:12px;padding:10px 14px}
.pbody .steps{background:var(--card);border-radius:16px;padding:8px 14px}
.cbadge{position:absolute;top:-4px;right:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#FF3B30;color:#fff;font-size:11px;font-weight:700;line-height:15px;text-align:center;box-sizing:border-box;border:2px solid var(--bg);font-variant-numeric:tabular-nums}
.crow{border:0;background:none;font:inherit;color:inherit;width:100%;text-align:left;display:flex;gap:12px;align-items:flex-start;padding:12px 14px 12px 16px;-webkit-tap-highlight-color:transparent}
.crow:active{background:var(--fill)}
.cdot{width:10px;height:10px;border-radius:50%;flex:none;margin-top:5px}
.cnew{width:9px;height:9px;border-radius:50%;background:var(--acc);flex:none;margin-top:5px}
.ctx{margin-top:3px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.domh{display:flex;flex-direction:column;gap:6px}
.t28{font-size:28px;letter-spacing:-.02em;line-height:1.15}
.dcard{display:flex;flex-direction:column;gap:12px}.dcard+.dcard{border-top:.5px solid var(--sep);padding-top:16px}
.salb{border:0;font:inherit;color:inherit;text-align:left;width:100%;display:flex;gap:12px;align-items:stretch;padding:14px 16px;-webkit-tap-highlight-color:transparent}
.salb .chev{align-self:center}
.salink{border:0;background:none;font:inherit;font-size:15px;color:var(--mut);text-align:left;padding:2px 0 0;text-decoration:underline;text-underline-offset:3px;-webkit-tap-highlight-color:transparent}
.chipw{display:flex;flex-wrap:wrap;gap:8px}
.chipb{border:0;border-radius:999px;padding:9px 13px;font:inherit;font-size:15px;background:var(--fill);color:var(--fg);text-align:left;-webkit-tap-highlight-color:transparent}
.chipb.on{background:var(--fg);color:var(--bg);font-weight:600}
.salsp{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;background:var(--card);border-radius:16px;padding:12px 14px}
.inp{font:inherit;font-size:16px;color:var(--fg);background:var(--fill);border:0;border-radius:10px;padding:8px 10px}
.prep{cursor:pointer}.prep input{width:22px;height:22px;margin:0;accent-color:#30D158;flex:none}
.prep input:checked+span{color:var(--mut);text-decoration:line-through}
.seg3{grid-template-columns:repeat(3,1fr)}
.subv{display:none;flex-direction:column;gap:14px}.subv.on{display:flex}
.hsep{border-top:.5px solid var(--sep);margin:2px 0}
.secondary.fillb{background:var(--fill);font-size:16px;padding:12px}
.mstrip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden}
.mtile{border:0;background:none;font:inherit;color:inherit;text-align:left;padding:12px 10px 12px 12px;display:flex;flex-direction:column;gap:2px;min-width:0;-webkit-tap-highlight-color:transparent}
.mtile+.mtile{border-left:.5px solid var(--sep)}
.mtile .tv{font-size:20px;white-space:nowrap}.mtile .ts{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mtile:active,.rowb:active,.esrow:active{background:var(--fill)}
.fring{gap:14px;justify-content:flex-start}
.rowb{border:0;background:none;font:inherit;color:inherit;width:100%;text-align:left;-webkit-tap-highlight-color:transparent}
.lrow .rico{margin:-2px 0}
.rico{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none}
.esimg{position:relative;width:96px;height:72px;border-radius:12px;overflow:hidden;background:#fff;flex:none}
.esimg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.esimg img.f2{animation:esx 2.6s ease-in-out infinite}
@keyframes esx{0%,38%{opacity:0}50%,88%{opacity:1}100%{opacity:0}}
.esimg.big{width:100%;height:auto;aspect-ratio:4/3}
.esimg.no{background:var(--fill)}.esimg.no img{display:none}
.esrow{display:flex;gap:12px;align-items:center;padding:10px 12px;cursor:pointer}
.vidb{width:36px;height:36px;border-radius:18px;border:0;background:var(--fill);color:var(--acc);display:flex;align-items:center;justify-content:center;flex:none;padding:0 0 0 3px}
.mobfs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mobf{margin:0;display:flex;flex-direction:column;gap:6px;cursor:pointer}.mobf .esimg{width:100%;height:auto;aspect-ratio:4/3}
.riscp{display:flex;gap:12px;align-items:center;background:var(--card);border-radius:14px;padding:10px 12px}.riscp .esimg{width:72px;height:54px}
.riscl .rr{display:flex;gap:10px;align-items:baseline;justify-content:space-between;padding:8px 0;border-top:.5px solid var(--sep)}.riscl .rr:first-child{border-top:0}.riscl .rr span:last-child{text-align:right;max-width:48%}
.esimg.rnum{background:var(--fill);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:var(--mut)}
.gdt{font-size:64px;font-weight:700;letter-spacing:-.04em;text-align:center;font-variant-numeric:tabular-nums}
</style></head><body class="${A.needSetup ? "first" : ""}"><div class="wrap">
  <div class="top">
    <div><button id="backbtn" class="linkbtn back" hidden aria-label="Indietro"><svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px"><path d="M10 2 2 10l8 8"/></svg><span id="backlbl">Oggi</span></button><div class="date">${dateLine} · Sett. ${isoWeek(d)}</div><h1 id="title">${A.needSetup ? "Benvenuto" : "Oggi"}</h1></div>
    <div class="hstack" style="gap:10px">
      ${A.demo || A.needSetup ? "" : `<button id="campbtn" class="sharebtn rel" aria-label="Notifiche"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span id="campn" class="cbadge" style="display:none"></span></button>`}
      ${A.demo ? "" : `<button id="setbtn" class="sharebtn" aria-label="Impostazioni"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg></button>`}
    </div>
  </div>
  <div class="view${A.needSetup ? "" : " on"}" id="oggi">${oggi}</div>
  <div class="view${A.needSetup ? " on" : ""}" id="setup">${A.demo ? "" : setupView(A)}</div>
  <div class="view" id="sett">${sett}</div>
  <div class="view" id="fuel">${fuelView}</div>
  <div class="view" id="att"><div id="attbox" style="display:flex;flex-direction:column;gap:14px"></div></div>
  <div class="view" id="trend">${tr}</div>
  <div class="upd">${esc(updLine)}</div>
</div>
<nav class="tabbar" id="mainseg" role="tablist">
  <button class="on" data-v="oggi" data-t="Oggi" role="tab"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg><span>Oggi</span></button>
  <button data-v="sett" data-t="Piano" role="tab"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><span>Piano</span></button>
  <button data-v="att" data-t="Attività" role="tab"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg><span>Attività</span></button>
  <button data-v="fuel" data-t="Corpo" role="tab"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg><span>Corpo</span></button>
  <button data-v="trend" data-t="Progressi" role="tab"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V13M9 20V9M14 20v-5M19 20V5"/></svg><span>Progressi</span></button>
</nav>
<div id="toast" class="toast" role="status"></div>
<div id="psheet" class="sheet" aria-hidden="true"><div class="sheetbox pbox"><div class="sheethead"><span class="t17 semi" id="ptitle"></span><button id="psx" class="link">Chiudi</button></div><div id="pbody" class="pbody"></div></div></div>
${[...DETS].map(([k, h]) => `<template id="det-${k}">${h}</template>`).join("")}
${promemoriaDomani(A) ? `<template id="domani-tpl">${domaniHTML(A)}</template>` : ""}
<div id="sheet" class="sheet" aria-hidden="true">
  <div class="sheetbox">
    <div class="sheethead"><span class="t17 semi">Condividi</span><button id="sheetx" class="link">Chiudi</button></div>
    <div class="checker"><canvas id="recanim" width="1080" height="1920"></canvas></div>
    <div class="optl">Immagine</div>
    <div class="seg seg4" id="lay"><button data-l="attivita">Attività</button><button data-l="giornata">Giornata</button><button data-l="settimana">Settimana</button><button data-l="gara">Gara</button></div>
    <div id="attopts" style="display:none;flex-direction:column;gap:14px">
      <div class="optl">Attività · <span id="attday" style="text-transform:none;letter-spacing:0"></span></div>
      <div class="chiprow" id="attsel"></div>
    </div>
    <div class="optl">Fondo</div>
    <div class="seg seg3" id="sty"><button class="on" data-s="scuro">Nero</button><button data-s="chiaro">Bianco</button><button data-s="trasparente">Sticker</button></div>
    <div class="btnrow" style="grid-template-columns:1fr 1fr 1fr"><button id="docopy" class="secondary">Copia</button><button id="dovid" class="secondary">Video</button><button id="dosh" class="primary">Condividi</button></div>
    <div id="hint" class="t13 muted" style="text-align:center">Video: l’impronta si riempie in 3 secondi.</div>
  </div>
</div>
<style>${UPLOT_CSS}</style>
<script>${UPLOT_JS}</script>
<script>
var FIT=${fitData};
function segPr(){var b=document.getElementById('prseg');if(!b)return;seg('prseg','data-p',function(v){document.querySelectorAll('.prp').forEach(function(x){x.style.display=x.getAttribute('data-p')===v?'':'none'})})}
function seg(id,attr,fn){var bs=document.querySelectorAll('#'+id+' button');bs.forEach(function(b){b.addEventListener('click',function(){bs.forEach(function(x){x.classList.toggle('on',x===b)});fn(b.getAttribute(attr),b)})})}
function showView(v,t){document.querySelectorAll('.view').forEach(function(x){x.classList.toggle('on',x.id===v)});document.querySelectorAll('#mainseg button').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-v')===v)});document.getElementById('title').textContent=t;window.scrollTo(0,0);if(typeof SUBS!=='undefined'&&SUBS[v])subMostra(SUBS[v]);if(v==='att'&&typeof attRender==='function')attRender()}
// ---- Navigazione: storia delle pagine (pulsante e swipe dal bordo sinistro per tornare indietro)
var TIT={oggi:'Oggi',att:'Attività',sett:'Piano',fuel:'Corpo',trend:'Progressi',setup:'Impostazioni'},NAV=[],CUR={v:(document.querySelector('.view.on')||{}).id||'oggi',t:document.getElementById('title').textContent};
var SUBS={sett:'pi-sett',fuel:'co-fuel',trend:'pr-forma'};
try{var ss=JSON.parse(localStorage.getItem('hud_subs')||'null');if(ss&&Date.now()-ss.ts<20000)Object.keys(SUBS).forEach(function(k){if(ss.s&&ss.s[k])SUBS[k]=ss.s[k]})}catch(e){}
function subMostra(id){var p=document.getElementById(id);if(!p||!p.parentNode)return;var v=p.parentNode;
  Array.prototype.forEach.call(v.children,function(x){if(x.classList.contains('subv'))x.classList.toggle('on',x===p)});
  v.querySelectorAll('.subseg button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-s')===id)});
  SUBS[v.id]=id;try{localStorage.setItem('hud_subs',JSON.stringify({ts:Date.now(),s:SUBS}))}catch(e){}
  if(id==='pi-gym'&&typeof gymVista==='function')gymVista();if(id==='pi-mob'&&typeof mobVista==='function')mobVista();if(id==='pr-forma'&&typeof drawFit==='function')drawFit()}
function subVai(id){subMostra(id);window.scrollTo(0,0)}
function salvaNav(){try{localStorage.setItem('hud_nav',JSON.stringify({ts:Date.now(),cur:CUR,nav:NAV,y:window.scrollY}))}catch(e){}}
function aggiornaBack(){var b=document.getElementById('backbtn'),p=NAV[NAV.length-1];b.hidden=!p;if(p)document.getElementById('backlbl').textContent=p.t}
function vai(v,t){t=t||TIT[v]||'';if(v===CUR.v){window.scrollTo({top:0,behavior:'smooth'});return}NAV.push({v:CUR.v,t:CUR.t,y:window.scrollY});if(NAV.length>20)NAV.shift();CUR={v:v,t:t};showView(v,t);aggiornaBack();salvaNav()}
function foglioAperto(){return document.querySelector('.sheet.on')}
function chiudiFoglio(s){s.classList.remove('on');var bx=s.querySelector('.sheetbox');bx.style.transition='';bx.style.transform='';if(s.id==='sheet'&&typeof animStop==='function')animStop()}
function indietro(){var s=foglioAperto();if(s){chiudiFoglio(s);return true}if(document.body.classList.contains('first'))return false;var p=NAV.pop();if(!p)return false;CUR={v:p.v,t:p.t};showView(p.v,p.t);window.scrollTo(0,p.y||0);aggiornaBack();salvaNav();return true}
window.__indietro=indietro;
window.__apri=function(v,t){vai(v,t)};
seg('mainseg','data-v',function(v,b){vai(v,b.getAttribute('data-t'))});segPr();
document.querySelectorAll('.subseg button').forEach(function(b){b.addEventListener('click',function(){subVai(b.getAttribute('data-s'))})});
document.getElementById('backbtn').addEventListener('click',indietro);
seg('wkseg','data-w',function(w){document.querySelectorAll('.wk').forEach(function(x){x.classList.toggle('on',x.id==='wk'+w)})});
var RANGE=90;seg('rgseg','data-r',function(r){RANGE=+r;drawFit()});

var MB=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
function lab(s){var p=s.split('-');return (+p[2])+' '+MB[+p[1]-1]}
function zone(t){if(t>25)return['Transizione','#FFD60A'];if(t>5)return['Fresco','#64D2FF'];if(t>-10)return['Zona grigia','#8E8E93'];if(t>-30)return['Ottimale','#30D158'];return['Rischio alto','#FF453A']}
function sg(v){v=Math.round(v);return (v<0?'−':v>0?'+':'')+Math.abs(v)}

function drawFitSvg(){
  var box=document.getElementById('fitchart');if(!box||!box.offsetParent)return;
  var all=FIT.h.concat(FIT.p);if(!all.length){box.innerHTML='<div class="sub">Nessun dato di fitness</div>';return}
  var nh=FIT.h.length,start=Math.max(0,nh-RANGE),data=all.slice(start);
  var W=box.clientWidth||358,H1=170,G=14,H2=86,H=H1+G+H2+18,L=4,R=30;
  var n=data.length,X=function(i){return L+(n<2?0:i/(n-1))*(W-L-R)};
  var hi=0;data.forEach(function(d){hi=Math.max(hi,d.ctl,d.atl)});hi=Math.ceil((hi+5)/10)*10;
  var Y1=function(v){return 6+(1-v/hi)*(H1-12)};
  var tsb=data.map(function(d){return d.ctl-d.atl});
  var tl=Math.min(-35,Math.floor(Math.min.apply(null,tsb)/10)*10),th=Math.max(30,Math.ceil(Math.max.apply(null,tsb)/10)*10);
  var top2=H1+G,Y2=function(v){return top2+(1-(v-tl)/(th-tl))*H2};
  var hist=Math.max(0,nh-start),s='';
  // griglia
  for(var g=0;g<=hi;g+=hi>60?20:10){s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y1(g)+'" y2="'+Y1(g)+'" stroke="rgba(142,142,147,.25)"/><text x="'+(W-R+6)+'" y="'+(Y1(g)+4)+'" fill="#8E8E93" font-size="10">'+g+'</text>'}
  // fasce di forma
  [[25,th,'#FFD60A'],[5,25,'#64D2FF'],[-10,5,'#8E8E93'],[-30,-10,'#30D158'],[tl,-30,'#FF453A']].forEach(function(z){var a=Math.max(z[0],tl),b=Math.min(z[1],th);if(b>a)s+='<rect x="'+L+'" width="'+(W-L-R)+'" y="'+Y2(b)+'" height="'+(Y2(a)-Y2(b))+'" fill="'+z[2]+'" opacity=".13"/>'});
  [-30,-10,5,25].forEach(function(t){if(t>tl&&t<th)s+='<text x="'+(W-R+6)+'" y="'+(Y2(t)+4)+'" fill="#8E8E93" font-size="10">'+t+'</text>'});
  s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y2(0)+'" y2="'+Y2(0)+'" stroke="rgba(142,142,147,.55)"/>';
  function path(fn,from,to){var p='';for(var i=from;i<=to&&i<n;i++)p+=(i===from?'M':'L')+X(i).toFixed(1)+' '+fn(i).toFixed(1);return p}
  var hEnd=Math.max(0,hist-1),pS=hEnd;
  // area fitness
  if(hist>1)s+='<path d="'+path(function(i){return Y1(data[i].ctl)},0,hEnd)+' L'+X(hEnd)+' '+Y1(0)+' L'+X(0)+' '+Y1(0)+'Z" fill="#0A84FF" opacity=".18"/>';
  var lines=[[function(i){return Y1(data[i].ctl)},'#0A84FF',2.5],[function(i){return Y1(data[i].atl)},'#BF5AF2',1.6],[function(i){return Y2(tsb[i])},'currentColor',1.8]];
  lines.forEach(function(l){if(hist>1)s+='<path d="'+path(l[0],0,hEnd)+'" fill="none" stroke="'+l[1]+'" stroke-width="'+l[2]+'" stroke-linejoin="round"/>';if(n-1>pS)s+='<path d="'+path(l[0],pS,n-1)+'" fill="none" stroke="'+l[1]+'" stroke-width="'+l[2]+'" stroke-dasharray="4 4" opacity=".75"/>'});
  // oggi
  var ti=-1;data.forEach(function(d,i){if(d.d===FIT.today)ti=i});if(ti<0)ti=hEnd;
  s+='<line x1="'+X(ti)+'" x2="'+X(ti)+'" y1="4" y2="'+(top2+H2)+'" stroke="#FF453A" stroke-width="1" opacity=".7"/>';
  // etichette mesi
  var step=Math.max(1,Math.round(n/4));for(var i=0;i<n;i+=step){s+='<text x="'+X(i)+'" y="'+(H-2)+'" fill="#8E8E93" font-size="10" text-anchor="'+(i===0?'start':'middle')+'">'+lab(data[i].d)+'</text>'}
  s+='<g id="cur" style="display:none"><line id="cl" y1="4" y2="'+(top2+H2)+'" stroke="currentColor" stroke-width="1"/><circle id="c1" r="4.5" fill="#0A84FF" stroke="none" stroke-width="2"/><circle id="c2" r="4" fill="#BF5AF2" stroke="none" stroke-width="2"/><circle id="c3" r="4" fill="currentColor" stroke="none" stroke-width="2"/></g>';
  box.innerHTML='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+s+'</svg>';
  function read(i,show){i=Math.max(0,Math.min(n-1,i));var d=data[i],t=tsb[i],z=zone(t);
    document.getElementById('fitread').innerHTML='<div class="fd">'+lab(d.d)+(d.p?' · proiezione dal piano':d.d===FIT.today?' · oggi':'')+'</div><div class="fv"><div><b style="color:#0A84FF">'+Math.round(d.ctl)+'</b><small>Fitness</small></div><div><b style="color:#BF5AF2">'+Math.round(d.atl)+'</b><small>Fatica</small></div><div><b style="color:'+z[1]+'">'+sg(t)+'</b><small>Forma · '+z[0]+'</small></div></div>';
    var c=document.getElementById('cur');c.style.display=show?'':'none';if(show){var x=X(i);document.getElementById('cl').setAttribute('x1',x);document.getElementById('cl').setAttribute('x2',x);['c1','c2','c3'].forEach(function(id,k){var e=document.getElementById(id);e.setAttribute('cx',x);e.setAttribute('cy',k===0?Y1(d.ctl):k===1?Y1(d.atl):Y2(t))})}}
  read(ti,false);
  var svg=box.firstChild;
  // tieni premuto o scorri di lato: lo legge il motore dei grafici
  box.classList.add('scr');box.setAttribute('data-scrfn','fit');window.SCRFN=window.SCRFN||{};
  SCRFN.fit=function(cx,on){if(!on){read(ti,false);return}var r=svg.getBoundingClientRect();read(Math.round((cx-r.left-L)/(W-L-R)*(n-1)),true)};
}
// Fitness, fatica e forma con uPlot (canvas): due pannelli legati, la proiezione tratteggiata, le fasce di forma, oggi in rosso.
// Se uPlot non c'è resta il disegno SVG di prima (drawFitSvg).
var FITU=null;
function drawFit(){
  var box=document.getElementById('fitchart');if(!box||!box.offsetParent)return;
  var all=FIT.h.concat(FIT.p);if(!all.length){box.innerHTML='<div class="sub">Nessun dato di fitness</div>';return}
  if(typeof uPlot==='undefined')return drawFitSvg();
  if(FITU){FITU.a.destroy();FITU.b.destroy();FITU=null}
  box.innerHTML='';
  var nh=FIT.h.length,start=Math.max(0,nh-RANGE),data=all.slice(start),n=data.length,hEnd=Math.max(0,nh-start-1);
  var xs=data.map(function(d){return Date.parse(d.d+'T12:00:00Z')/1000});
  var seg=function(k,proj){return data.map(function(d,i){var v=k==='tsb'?d.ctl-d.atl:d[k];return proj?(i>=hEnd?v:null):(i<=hEnd?v:null)})};
  var tsb=data.map(function(d){return d.ctl-d.atl});
  var ti=-1;data.forEach(function(d,i){if(d.d===FIT.today)ti=i});if(ti<0)ti=hEnd;
  var fg=getComputedStyle(box).color||'#8E8E93',W=box.clientWidth||358,font='10px -apple-system,"SF Pro Text",sans-serif',grid={stroke:'rgba(142,142,147,.25)',width:1};
  var hi=0;data.forEach(function(d){hi=Math.max(hi,d.ctl,d.atl)});hi=Math.ceil((hi+5)/10)*10;
  var tl=Math.min(-35,Math.floor(Math.min.apply(null,tsb)/10)*10),th=Math.max(30,Math.ceil(Math.max.apply(null,tsb)/10)*10);
  var mesi=function(u,v){return v.map(function(t){var d=new Date(t*1000);return lab(d.toISOString().slice(0,10))})};
  var oggi=function(u){var x=u.valToPos(xs[ti],'x',true),c=u.ctx;c.save();c.strokeStyle='rgba(255,69,58,.7)';c.lineWidth=1*devicePixelRatio;c.beginPath();c.moveTo(x,u.bbox.top);c.lineTo(x,u.bbox.top+u.bbox.height);c.stroke();c.restore()};
  var fasce=function(u){var c=u.ctx;[[25,th,'#FFD60A'],[5,25,'#64D2FF'],[-10,5,'#8E8E93'],[-30,-10,'#30D158'],[tl,-30,'#FF453A']].forEach(function(z){var a=Math.max(z[0],tl),b=Math.min(z[1],th);if(b<=a)return;
    var y1=u.valToPos(b,'y',true),y2=u.valToPos(a,'y',true);c.save();c.globalAlpha=.13;c.fillStyle=z[2];c.fillRect(u.bbox.left,y1,u.bbox.width,y2-y1);c.restore()})};
  var leggi=function(u){var i=u.cursor.idx;read(i===null||i===undefined?ti:i,i!==null&&i!==undefined)};
  var cursore={sync:{key:'fit'},y:false,drag:{x:false,y:false},points:{size:8,width:0},focus:{prox:-1}};
  var asseY=function(splits){return{side:1,size:30,font:font,stroke:'#8E8E93',grid:grid,ticks:{show:false},splits:splits}};
  var top=document.createElement('div'),bot=document.createElement('div');box.appendChild(top);box.appendChild(bot);
  var a=new uPlot({width:W,height:170,padding:[6,0,8,4],legend:{show:false},cursor:cursore,scales:{x:{time:true},y:{range:[0,hi]}},
    axes:[{show:false},asseY(function(){var o=[];for(var g=0;g<=hi;g+=hi>60?20:10)o.push(g);return o})],
    series:[{},{stroke:'#0A84FF',width:2.5,fill:'rgba(10,132,255,.18)'},{stroke:'#BF5AF2',width:1.6},{stroke:'#0A84FF',width:2.5,dash:[4,4]},{stroke:'#BF5AF2',width:1.6,dash:[4,4]}],
    hooks:{draw:[oggi],setCursor:[leggi]}},[xs,seg('ctl'),seg('atl'),seg('ctl',true),seg('atl',true)],top);
  var b=new uPlot({width:W,height:104,padding:[6,0,0,4],legend:{show:false},cursor:cursore,scales:{x:{time:true},y:{range:[tl,th]}},
    axes:[{font:font,stroke:'#8E8E93',grid:{show:false},ticks:{show:false},size:18,values:mesi,space:70},asseY(function(){return[-30,-10,5,25].filter(function(t){return t>tl&&t<th})})],
    series:[{},{stroke:fg,width:1.8},{stroke:fg,width:1.8,dash:[4,4]}],
    hooks:{drawClear:[fasce],draw:[oggi,function(u){var y=u.valToPos(0,'y',true),c=u.ctx;c.save();c.strokeStyle='rgba(142,142,147,.55)';c.beginPath();c.moveTo(u.bbox.left,y);c.lineTo(u.bbox.left+u.bbox.width,y);c.stroke();c.restore()}]}},[xs,seg('tsb'),seg('tsb',true)],bot);
  FITU={a:a,b:b};
  function read(i,show){i=Math.max(0,Math.min(n-1,i));var d=data[i],t=tsb[i],z=zone(t);
    document.getElementById('fitread').innerHTML='<div class="fd">'+lab(d.d)+(d.p?' · proiezione dal piano':d.d===FIT.today?' · oggi':'')+'</div><div class="fv"><div><b style="color:#0A84FF">'+Math.round(d.ctl)+'</b><small>Fitness</small></div><div><b style="color:#BF5AF2">'+Math.round(d.atl)+'</b><small>Fatica</small></div><div><b style="color:'+z[1]+'">'+sg(t)+'</b><small>Forma · '+z[0]+'</small></div></div>'}
  read(ti,false);
  // tieni premuto o scorri di lato: lo legge il motore dei grafici, uPlot sposta il cursore su entrambi i pannelli
  box.classList.add('scr');box.setAttribute('data-scrfn','fit');window.SCRFN=window.SCRFN||{};
  SCRFN.fit=function(cx,on){if(!on){a.setCursor({left:-10,top:-10});b.setCursor({left:-10,top:-10});read(ti,false);return}
    var r=a.over.getBoundingClientRect(),l=Math.max(0,Math.min(r.width,cx-r.left));a.setCursor({left:l,top:10});b.setCursor({left:l,top:10})};
}
window.addEventListener('resize',drawFit);
var RECAP=${recapData};
// ---- Spiegazioni dei tasti i
function IC(t,x){return "<div class=icard><b>"+t+"</b><span>"+x+"</span></div>"}
var INFO={
prontezza:["Prontezza",
 "<p>Il numero (0–100) è la prontezza calcolata dal tuo orologio. La parola sotto è il verdetto dell'app, che unisce due controlli separati.</p>"+
 IC("Sistemico","Cuore e sistema nervoso: HRV sotto la tua media, FC a riposo più alta del solito, poco sonno o forma molto negativa lo fanno scendere a cautela o riposo.")+
 IC("Tessuti","Muscoli e tendini: una corsa con molto dislivello o un carico molto sopra il piano nelle ultime 72 ore. Il cuore può essere pronto e le gambe no.")+
 "<p class=q>Pronto: segui il piano. Con cautela: niente intensità, la seduta si adatta. Riposo: solo mobilità e sonno.</p>"],
impronta:["L'impronta",
 "<p>Ogni seduta è una fila di capsule: <b>larga quanto il tempo</b> e <b>alta quanto l'intensità</b>.</p>"+
 IC("Contorno","È il piano: quello che dovresti fare. Al mattino l'impronta è solo contorno, da riempire.")+
 IC("Pieno","È quello che hai fatto. Se coincide con il contorno hai eseguito bene; se resta vuoto o sfora, si vede subito.")+
 IC("Arancio","Solo sopra soglia. Quanto arancio c'è, tanto è stata dura.")+
 "<p class=q>Il pieno è stimato da durata e carico rispetto al piano: senza i dati secondo per secondo non segue ogni singola ripetuta.</p>"],
sonno:["Sonno",
 "<p>Durata della notte e punteggio di qualità (0–100) dal tuo orologio. Sotto le 6 ore, o con un punteggio basso, l'app diventa più prudente sull'intensità del giorno.</p><p class=q>Il confronto è con la media dei 7 giorni prima: conta più la tendenza della singola notte.</p>"],
hrv:["HRV",
 "<p>La variabilità della frequenza cardiaca: quanto cambia l'intervallo tra un battito e l'altro durante la notte, in millisecondi.</p>"+
 IC("Più alta della tua media","Sistema nervoso riposato, pronto a reggere il carico.")+
 IC("Più bassa della tua media","Stress, fatica, poco sonno o un malanno in arrivo: l'app propone di ridurre l'intensità.")+
 "<p class=q>Il valore assoluto non si confronta con quello di altri: conta solo rispetto alla tua media.</p>"],
fcriposo:["FC a riposo",
 "<p>I battiti al minuto a riposo, misurati di notte. Con l'allenamento tende a scendere nel tempo.</p><p>Se sale di 5 battiti sopra la tua media è un segnale giallo, di 8 o più è rosso: spesso arriva prima della stanchezza che senti.</p>"],
cuore:["Cuore e corpo",
 "<p>HRV e FC a riposo degli ultimi 7 giorni: la barra piena è oggi. Sotto trovi la prontezza dell'orologio e il peso.</p><p class=q>Le due misure vanno lette insieme: HRV giù e FC su nello stesso giorno sono il segnale più affidabile di recupero incompleto.</p>"],
forma:["Forma, fitness e fatica",
 "<p>Tre numeri calcolati dal carico di ogni seduta (TSS).</p>"+
 IC("Fitness · CTL","La media del carico degli ultimi 42 giorni circa. È la forma costruita nel tempo: sale lentamente, scende lentamente.")+
 IC("Fatica · ATL","La media del carico degli ultimi 7 giorni circa. Sale in fretta dopo una settimana dura e scende in fretta con il riposo.")+
 IC("Forma · TSB","Fitness meno fatica. Negativa vuol dire che sei carico di lavoro; positiva che sei fresco. Tra −10 e −30 è la zona utile per costruire, sotto −30 il rischio sale, sopra +5 sei pronto per una gara.")+
 IC("Ramp rate","Di quanti punti cresce la fitness a settimana. Tra 3 e 6 è una crescita sana; sopra 7–8 il carico sale troppo in fretta.")],
checkin:["Check-in del mattino",
 "<p>Tre tocchi ogni mattina: gambe, energia, umore da 1 a 5.</p><p>Da soli non cambiano la seduta: servono all'app per imparare, corsa dopo corsa, quali sensazioni predicono le tue giornate buone e quelle storte.</p>"],
predittori:["Cosa ti predice",
 "<p>L'app confronta i segnali del mattino (HRV, FC a riposo, sonno, check-in) con come vanno davvero le tue corse all'aperto, misurate con il passo a 145 battiti.</p><p>Dopo almeno 12 corse abbinate mostra quali segnali contano per te. Una barra lunga vuol dire un legame forte.</p><p class=q>È una correlazione, non una certezza: serve per dare il giusto peso ai tuoi segnali.</p>"],
impatto:["Impatto della corsa",
 "<p>Misura lo stress su muscoli e tendini, che il cuore non vede: i km di corsa pesati per dislivello e intensità.</p>"+
 IC("Il rapporto ×","Impatto di questa settimana diviso la media delle 4 settimane prima. Tra 0,8 e 1,3 è nella norma; oltre 1,3 aumenta il rischio di infortunio.")+
 IC("Tapis","Quota di corsa su tapis: utile per i volumi facili, ma le sedute di qualità rendono di più all'aperto.")],
giorni:["Giorno per giorno",
 "<p>Tutte le sedute della settimana. Tocca una seduta per vedere impronta, piano, passi con passi e battiti, e, se è già fatta, il voto di esecuzione.</p>"+
 IC("Voto di esecuzione","Da 0 a 100: quanto durata e carico reali sono vicini al previsto. Il punto esclamativo indica un avviso, per esempio seduta accorciata o FC che non sale.")],
revisione:["Revisione della settimana",
 "<p>Il bilancio della settimana: sedute svolte, tempo, carico, migliore esecuzione e avvisi. In fondo c'è la proposta per la settimana dopo.</p><p class=q>Con l'aderenza sotto il 70% il carico si ripete, con segnali di fatica arriva prima lo scarico, altrimenti si sale del 5–8%.</p>"],
trama:["La trama della settimana",
 "<p>Un'impronta per giorno, lunga quanto il tempo di quel giorno. Piena se l'hai fatta, solo contorno se è ancora da fare.</p><p>Tocca un giorno per aprire il dettaglio della seduta.</p>"],
stagione:["Il nastro della stagione",
 "<p>Una capsula per settimana, alta quanto il carico totale.</p>"+
 IC("Settimane passate","Piene: il carico che hai fatto davvero. Gli scarichi si riconoscono perché sono più basse.")+
 IC("Questa e la prossima","Il contorno è il carico pianificato, il pieno quello già fatto.")+
 IC("La capsula arancio","È la gara: resta vuota finché non la corri.")],
fitness:["Come si legge il grafico",
 "<p>Il grafico racconta tre cose giorno per giorno: <b>quanto sei allenato</b>, <b>quanto sei stanco</b> e il <b>bilancio</b> tra le due. Tutto nasce dal carico di ogni seduta (TSS): durata per intensità. Un'ora tirata alla soglia vale circa 100.</p>"+
 "${A.metrics && A.metrics.ctl !== null && A.metrics.atl !== null ? `<p class=q>Oggi: fitness ${Math.round(A.metrics.ctl)}, fatica ${Math.round(A.metrics.atl)}, forma ${Math.round(A.metrics.ctl - A.metrics.atl) > 0 ? "+" : ""}${String(Math.round(A.metrics.ctl - A.metrics.atl)).replace("-", "−")}.</p>` : ""}"+
 "<p><b>In alto, due linee</b></p>"+
 IC("Blu · Fitness (CTL)","La media del carico delle ultime 6 settimane circa, con l'area azzurra sotto. È l'allenamento che hai costruito: sale piano e scende piano. Una crescita di 3–6 punti a settimana è sana; il numero è più o meno il carico medio al giorno che reggi.")+
 IC("Viola · Fatica (ATL)","La media dell'ultima settimana circa. Sale in fretta dopo i giorni duri e scende in fretta con il riposo: per questo fa i dentini.")+
 "<p><b>In basso, la forma (TSB)</b></p><p>La linea scura è fitness meno fatica. Le fasce dicono cosa significa:</p>"+
 "<svg viewBox='0 0 300 132' width='100%' role='img' aria-label='Le cinque fasce della forma'>"+
 "<rect x='0' y='0' width='300' height='24' rx='6' fill='#FFD60A' opacity='.25'/><text x='10' y='16' font-size='12' fill='currentColor'>sopra +25 · Transizione: perdi allenamento</text>"+
 "<rect x='0' y='27' width='300' height='24' rx='6' fill='#64D2FF' opacity='.25'/><text x='10' y='43' font-size='12' fill='currentColor'>+5 / +25 · Fresco: pronto per una gara</text>"+
 "<rect x='0' y='54' width='300' height='24' rx='6' fill='#8E8E93' opacity='.25'/><text x='10' y='70' font-size='12' fill='currentColor'>−10 / +5 · Zona grigia: mantieni</text>"+
 "<rect x='0' y='81' width='300' height='24' rx='6' fill='#30D158' opacity='.25'/><text x='10' y='97' font-size='12' fill='currentColor'>−10 / −30 · Ottimale: stai costruendo</text>"+
 "<rect x='0' y='108' width='300' height='24' rx='6' fill='#FF453A' opacity='.25'/><text x='10' y='124' font-size='12' fill='currentColor'>sotto −30 · Rischio alto: troppa fatica</text></svg>"+
 "<p><b>Le altre cose sul grafico</b></p>"+
 IC("Linea rossa verticale","È oggi. A sinistra quello che hai fatto, a destra quello che succederà.")+
 IC("Tratteggio","Dopo oggi le linee diventano tratteggiate: è la proiezione se fai tutte le sedute in programma su Intervals.")+
 IC("6 settimane · 3 mesi · 6 mesi · 1 anno","Il periodo mostrato. Le settimane si leggono bene sul breve, la stagione sull'anno.")+
 IC("Tieni premuto e scorri","Sopra il grafico compaiono data, fitness, fatica e forma del giorno sotto il dito.")+
 "<p><b>Come usarlo</b></p>"+
 IC("Nei blocchi di carico","Forma nella fascia verde e fitness che sale. Qualche giorno nel grigio dopo uno scarico è normale.")+
 IC("Prima di una gara","Una o due settimane più leggere portano la forma tra +5 e +15 senza perdere molta fitness.")+
 IC("Quando alleggerire","Forma sotto −30 per più giorni, oppure fitness che sale più di 7–8 punti a settimana: il rischio di infortuni e malanni cresce. Rallenta prima che te lo dica il corpo.")+
 "<p class=q>I numeri sono relativi a te: una fitness di 40 non è «poco» o «tanto» in assoluto. Conta la direzione nel tempo.</p>"],
traiettoria:["Verso l'obiettivo",
 "<p>La linea tratteggiata è la fitness che dovresti avere giorno per giorno per arrivare al picco previsto due settimane prima della gara. La linea blu è la tua.</p><p>Il numero grande confronta la tua fitness di oggi con quella prevista: entro 2 punti sei in linea.</p>"],
attrezzatura:["Attrezzatura",
 "<p>Le scarpe e le bici che usi, con i km fatti. Ogni corsa va alle scarpe in uso per quel tipo: strada, trail o tapis (oppure «tutte»).</p>"+
 IC("Da cambiare","Le scarpe da corsa reggono di solito 600–800 km: oltre, l'ammortizzazione cala. La barra diventa arancio all'80% e rossa al 100%.")+
 IC("Bici","Senza distanza (spinning) conta le ore; all'aperto anche i km.")+
 "<p class=q>Se cambi la data o il tipo di corse di un paio, i km si ricontano dalle sedute degli ultimi 6 mesi più quelli che hai scritto.</p>"],
record:["Record",
 "<p>Per ogni distanza, il tratto più veloce che hai corso o nuotato dentro una seduta, anche se la seduta era più lunga. Si legge dalla registrazione dell'orologio.</p>"+
 IC("Nuovo","Quando una seduta degli ultimi tre giorni batte un record, l'HUD te lo dice all'apertura e la riga resta segnata per due settimane.")+
 IC("Condividi","Tocca la freccia accanto a un record: si apre il foglio Condividi con i tre design.")+
 "<p class=q>L'HUD vede gli ultimi sei mesi: i record più vecchi (5 km, 10 km, mezza) sono scritti in CONFIG.record.</p>"],
progressi:["Progressi",
 "<p>Quattro segnali che la base aerobica cresce. Ognuno confronta le ultime quattro settimane con le settimane da 8 a 12 prima: verde se migliora, arancio se peggiora.</p>"+
 IC("Corsa","Passo a 145 bpm: più sei in forma, più vai veloce con gli stessi battiti. Sotto, il decoupling dei lunghi.")+
 IC("Bici","Deriva della FC nelle uscite da 1h15: quanto salgono i battiti nella seconda metà a parità di sforzo. Sotto il 5% reggi bene la durata, che è quello che serve nelle gare lunghe.")+
 IC("Nuoto","Passo medio delle nuotate in piscina da 800 m, confrontato con il tuo CSS.")+
 IC("Cuore","FC a riposo e HRV, media della settimana: con l'allenamento aerobico la prima scende e la seconda sale.")+
 "<p class=q>Le uscite vecchie in bici si leggono poche per volta, in sottofondo: in pochi giorni lo storico è completo.</p>"],
durabilita:["Durabilità",
 "<p>Quanto resisti alla fatica, misurato in tre modi.</p>"+
 IC("Passo a 145 bpm","Il passo che tieni a 145 battiti nelle corse all'aperto. Se scende nel tempo, a parità di sforzo vai più forte.")+
 IC("Decoupling","Nei lunghi, quanto il rapporto tra passo e battiti peggiora dalla prima alla seconda metà. Sotto il 5% vuol dire buona resistenza aerobica.")+
 IC("Riegel k","Quanto rallenti allungando la distanza. Più è basso, meglio tieni il ritmo sulle gare lunghe.")],
peso:["Peso",
 "<p>Pesati al mattino, dopo il bagno e prima di colazione, qualche volta a settimana. Il peso arriva dalla bilancia, da Intervals o scritto qui.</p><p>Conta la media di 7 giorni, così le oscillazioni di un giorno non pesano; il ritmo confronta la media di oggi con quella di due settimane fa.</p><p class=q>Con un peso obiettivo: tra 0,25 e 0,8 kg a settimana. Fuori da questa fascia il piano corregge le calorie da solo.</p>"+
 "<p><b>La bilancia, da sola.</b> Se la tua bilancia scrive su Salute, un Comando Rapido legge le pesate e le passa all'HUD. Si fa una volta:</p>"+
 IC("1. Salute","Salute › Sfoglia › Misure corporee › Peso: le pesate della bilancia devono esserci. Se mancano, attiva Apple Salute nell'app della bilancia.")+
 IC("2. Comando","Comandi Rapidi › + › «Trova campioni di Salute»: Peso, Data di inizio negli ultimi 14 giorni. Poi «Ripeti con ciascuno» con dentro un «Testo»: Elemento ripetizione › Data di inizio, uno spazio, Elemento ripetizione › Valore.")+
 IC("3. HUD","Dopo la ripetizione: «Esegui script» di Scriptable, lo script dell'HUD, Parametro = Risultati della ripetizione, «Esegui nell'app» spento. Chiamalo Peso HUD.")+
 IC("4. Automazione","Automazione › + › App › l'app della bilancia › È chiusa › Esegui immediatamente › Peso HUD. Ti pesi, chiudi l'app, il peso è nell'HUD.")],
soglie:["Le tue soglie",
 "<p>Sono i numeri su cui si regolano zone e obiettivi di ogni seduta, anche sull'orologio.</p>"+
 IC("Come le trova","Dalle tue attività: la FC massima toccata più di una volta, gli sforzi tenuti di 20–70 minuti per la soglia FC, la corsa dura più veloce (con il passo corretto per la pendenza) per il passo soglia, il test 400 + 200 o le ripetute lunghe per il CSS, la stima di Intervals per l'FTP se hai il misuratore di potenza.")+
 IC("Quando cambiano","Solo quando le tue attività mostrano un valore migliore: la soglia non si abbassa per una giornata storta. Ogni cambio va su Intervals da solo e lo vedi in Oggi.")+
 IC("Da misurare","Se manca un dato (per esempio non hai mai nuotato), il piano inserisce il test e il valore si aggiorna dopo.")],
verifiche:["Verifica del profilo",
 "<p>Ogni giorno l'app confronta le soglie impostate con quello che fai davvero. Così passi, battiti e impronte restano giusti anche quando migliori.</p>"+
 IC("Aggiorna","I tuoi giri dicono che una soglia è superata: per esempio hai nuotato un 400 più veloce del tuo CSS o tenuto 20 minuti sopra la soglia FC. Si propone un valore stimato e il test da fare.")+
 IC("Controlla","Qualcosa non torna: l'app e Intervals usano soglie diverse, una gara non è segnata come gara, mancano molte notti di HRV.")+
 IC("Da sapere","Come il piano si sta adattando a te: rientro dopo una pausa, settimane irregolari, bici letta solo con i battiti.")+
 "<p class=q>Le stime vengono dai giri registrati: il test resta il modo più affidabile per fissare una soglia.</p>"],
consumi:["Quanto bruci",
 "<p>Le calorie che consumi per ogni minuto di seduta, divise per sport e tipo: facile, qualità, lungo.</p>"+
 IC("Dalle tue sedute","È la mediana delle tue attività degli ultimi 6 mesi che hanno le calorie registrate dall'orologio. Più sedute fai, più il numero è tuo.")+
 IC("Stima","Finché non ci sono almeno tre sedute di quel tipo, l'app parte da un valore medio calcolato dal tuo peso.")+
 "<p class=q>Con questi numeri il Carburante calcola quanto mangiare nei giorni con le sedute ancora da fare.</p>"],
macro:["Il tuo piano",
 "<p>Calorie del giorno = base + allenamento − deficit. La base è il metabolismo a riposo stimato da peso, altezza, età e sesso (equazione di ten Haaf, studiata sugli atleti) per la vita di tutti i giorni; l'allenamento sono le calorie registrate dall'orologio più quelle stimate per le sedute ancora da fare.</p>"+
 IC("Deficit","Solo se in Impostazioni hai un peso obiettivo più basso del tuo. Si misura in calo a settimana: lo 0,5% del peso, più forte nei giorni di riposo e leggeri, quasi nullo nei lunghi. Qualche settimana prima della gara si ferma.")+
 IC("Limiti di sicurezza","Il deficit non supera mai il 25% delle calorie del giorno; tolto l'allenamento ti restano almeno 25 kcal per kg di massa magra (30 per le donne) e mai meno di 1.800 kcal (1.500 per le donne). Questi limiti vincono su tutto.")+
 IC("Macro","Prima le proteine: 2 g per kg mentre dimagrisci, 1,8 altrimenti. Poi i carboidrati in base al giorno: riposo 3 g per kg, medio 4,5, duro 6, lungo 7, più 1 la vigilia di una seduta chiave. I grassi completano: almeno 0,8 g per kg e il 20% delle calorie. Quelli presi durante le sedute fanno parte del totale.")+
 IC("Calorie che imparano","Se ti pesi almeno 8 volte e registri il cibo di almeno 14 giornate intere nelle ultime 6 settimane, l'app confronta quanto hai mangiato con come si è mosso il peso e corregge la base (al massimo 300 kcal in più o in meno). Finché i dati non bastano vale la formula.")+
 IC("Carico pre-gara","Nei due giorni prima di una gara lunga: 10 g di carboidrati per kg, niente deficit, pochi grassi e poca fibra.")+
 IC("Si corregge da solo","Con le pesate: se cali più dello 0,9% del peso a settimana mangi 250 kcal in più, se cali meno dello 0,25% ne togli 150. Nei giorni con il recupero in rosso metà deficit.")+
 "<p class=q>Sono indicazioni generali, non un piano medico: se hai un nutrizionista, vale il suo.</p>"],
cibo:["Mangiato oggi",
 "<p>Di' a Siri «Ho mangiato» e poi cosa, oppure scrivilo qui: per esempio «180 g di pasta, 150 di pollo e un cucchiaio d'olio». L'app riconosce i cibi più comuni e le quantità, anche a cucchiai, fette, vasetti o pezzi.</p>"+
 IC("Quantità","Pasta, riso e cereali si contano a crudo, come nel piano. Se non dici quanto, vale una porzione normale.")+
 IC("Calorie e macro","Valori medi per 100 g: sono una stima, utile per non andare troppo sopra o sotto l'obiettivo del giorno.")+
 IC("Correggere","Tocca × accanto a una voce per toglierla. Se qualcosa non lo conosce te lo dice: riscrivilo con un nome più semplice.")+
 "<p><b>Con Siri.</b> Un Comando Rapido chiede cosa hai mangiato e lo passa all'HUD. Si fa una volta:</p>"+
 IC("1. Domanda","Comandi Rapidi › + › «Chiedi input»: Testo, domanda «Cosa hai mangiato?». Poi «Codifica URL» con dentro Testo fornito.")+
 IC("2. Link","«URL»: scrivi scriptable:///run/${encodeURIComponent(nomeScript())}?cibo= e subito dopo inserisci la variabile Testo codificato URL. Poi «Apri URL».")+
 IC("3. Nome","Chiamalo Ho mangiato. Dici «Ehi Siri, ho mangiato», rispondi e l'HUD si apre su Carburante con la voce segnata e il totale del giorno.")],
rifornimento:["Rifornimento",
 "<p>Nelle sedute lunghe l'intestino si allena come le gambe: si parte da dosi che reggi e, se hai una gara lunga, si sale verso quelle della gara.</p>"+
 IC("Dosi","Grammi all'ora su tutta la seduta: 150 g in 2h30 sono 60 g all'ora. Verso una gara lunga la dose sale con le settimane, ma solo se l'ultimo lungo è andato bene. Stomaco pesante: resta uguale. Problemi: scende di 10 g all'ora.")+
 IC("Sull'orologio","Nei lunghi del piano dell'app l'HUD scrive gli orari nella seduta su Intervals: il passo si spezza all'ora giusta e l'orologio vibra con «Mangia gel e bevi» o «Bevi». Avvia la seduta dall'allenamento del giorno. Le sedute che ti scrivi da solo non si toccano.")+
 IC("Sudore","Pesati nudo prima e dopo un lungo e segna quanto hai bevuto: peso perso più bevuto, diviso le ore. Dopo due lunghi l'app usa i tuoi numeri al posto della stima.")+
 IC("Sodio","Circa metà del sodio che perdi: con 1 litro all'ora di sudore sono circa 500 mg all'ora.")+
 "<p class=q>Con il caldo o al chiuso si suda di più: acqua e sodio salgono da soli.</p>"],
};
function openP(title,html){document.getElementById('ptitle').textContent=title||'';document.getElementById('pbody').innerHTML=html;var s=document.getElementById('psheet');s.classList.add('on');s.querySelector('.sheetbox').scrollTop=0}
function closeP(){document.getElementById('psheet').classList.remove('on')}
document.getElementById('psx').addEventListener('click',closeP);
document.getElementById('psheet').addEventListener('click',function(e){if(e.target.id==='psheet')closeP()});
document.addEventListener('click',function(e){
  var i=e.target.closest&&e.target.closest('[data-info]');
  if(i){e.preventDefault();e.stopPropagation();var it=INFO[i.getAttribute('data-info')];if(it)openP(it[0],it[1]);return}
  var d=e.target.closest&&e.target.closest('[data-det]');
  if(d){var tp=document.getElementById('det-'+d.getAttribute('data-det'));if(tp){openP(d.getAttribute('data-dt')||'Seduta',tp.innerHTML);if(d.getAttribute('data-det')==='mcheck')ckMostra();esIdrata()}}
},true);
// ---- Campana: le notifiche dell'app (le stesse del telefono), le più nuove in alto
var CAMP=${JSON.stringify(campanaArrivate(CAMPANA, A.now).slice(0, 30).map((x) => ({ id: x.id, t: x.t, tit: x.tit, txt: x.txt, az: x.az || "", letta: !!x.letta, c: x.tipo === "att" && x.sp && SPORT[x.sp] ? SPORT[x.sp].c : ({ domani: "#0A84FF", settimana: "#BF5AF2", record: "#FFD60A", orologio: "#FF9F0A", fatica: "#FF453A", gear: "#FF9F0A" })[x.tipo] || "#8E8E93" }))).replace(/</g, "\\u003c")},NOWMS=${A.now.getTime()},DOMD=${JSON.stringify(ymd(A.now))};
function campBadge(){var n=CAMP.filter(function(x){return !x.letta}).length,b=document.getElementById('campn');if(!b)return;b.textContent=n>9?'9+':String(n);b.style.display=n?'':'none';document.getElementById('campbtn').setAttribute('aria-label',n?'Notifiche, '+n+' da leggere':'Notifiche')}
function campQuando(t){var d=new Date(t),o=new Date(Math.max(NOWMS,d.getTime())),h=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2),g=Math.round((new Date(o.getFullYear(),o.getMonth(),o.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);
  if(o-d<120000)return 'ora';if(g===0)return h;if(g===1)return 'ieri '+h;return ['dom','lun','mar','mer','gio','ven','sab'][d.getDay()]+' '+d.getDate()+' '+MB[d.getMonth()]}
function campApri(){var L=CAMP;
  var html=L.length?'<div class="card list">'+L.map(function(x,i){return (i?'<div class="sep l16"></div>':'')+'<button class="crow" data-az="'+escH(x.az)+'"><span class="cdot" style="background:'+x.c+'"></span><div class="grow"><div class="hstack" style="justify-content:space-between;gap:10px;align-items:baseline"><span class="t15 '+(x.letta?'semi':'bold')+'">'+escH(x.tit)+'</span><span class="t13 muted" style="white-space:nowrap;flex:none">'+campQuando(x.t)+'</span></div><div class="t13 muted ctx">'+escH(x.txt||'').replace(/\\n/g,'<br>')+'</div></div>'+(x.letta?'':'<span class="cnew" aria-label="Da leggere"></span>')+'</button>'}).join('')+'</div>'
    :'<div class="card pad"><div class="t17 semi">Nessuna notifica</div><div class="t15 muted" style="line-height:1.4">Qui arrivano il promemoria della sera, i record, le sedute sincronizzate e il riepilogo della domenica.</div></div>';
  html+='<div class="t13 muted" style="padding:0 4px;line-height:1.4">Le stesse arrivano come notifiche sul telefono: si gestiscono in Impostazioni › Notifiche › Scriptable.</div>';
  openP('Notifiche',html);
  if(CAMP.some(function(x){return !x.letta})){CAMP.forEach(function(x){x.letta=true});campBadge();hudSend('campana','letto')}}
function campAzione(az){if(!az)return;if(az==='domani'){window.__domani();return}
  if(az==='settimana'){OPT.week=0;OPT.rec=null;setLayout('riepilogo');openSheet();return}
  if(az.indexOf('att:')===0){window.__apriAtt(az.slice(4));return}
  var v={record:'trend',trend:'trend',fuel:'fuel',oggi:'oggi',sett:'sett'}[az];if(v){vai(v);if(az==='record')subVai('pr-rec');else if(az==='trend')subVai('pr-forma')}}
(function(){var cb=document.getElementById('campbtn');if(cb)cb.addEventListener('click',campApri)})();
document.getElementById('pbody').addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.crow[data-az]');if(!b)return;var az=b.getAttribute('data-az');if(!az)return;closeP();setTimeout(function(){campAzione(az)},60)});
// il foglio di domani: dalla notifica della sera, dalla campana o da solo la sera alla prima apertura
window.__domani=function(){var t=document.getElementById('domani-tpl');if(!t){toast('Domani niente in programma');return false}openP('Domani',t.innerHTML);if(typeof esIdrata==='function')esIdrata();
  var b=document.getElementById('domok');if(b)b.addEventListener('click',closeP);
  var c=false;CAMP.forEach(function(x){if(x.az==='domani'&&!x.letta){x.letta=true;c=true}});if(c)campBadge();hudSend('domani',DOMD);return true};
window.__apriAtt=function(g){if(typeof ATT==='undefined')return;ATTG=g;if(CUR.v==='att')attRender();else vai('att')};
campBadge();
var SAL=${JSON.stringify(A.salute ? { ...A.salute, S: (({ modifiche, ...r }) => r)(A.salute.S) } : null).replace(/</g, "\\u003c")};
// ---- Infortunio e malattia: modulo, consigli, proposta per le prossime sedute
var ZONE_N={piede:'Piede o caviglia',polpaccio:'Polpaccio o Achille',ginocchio:'Ginocchio',anca:'Anca o inguine',femorali:'Dietro la coscia',quadricipite:'Davanti alla coscia',schiena:'Schiena',spalla:'Spalla',altro:'Altro'};
var REG_W={no:'In pausa',facile:'Solo facile',si:'Come da piano'},REG_C={no:'#D70015',facile:'#B25000',si:'#1E7F45'};
var AZ_W={leggera:'più leggera',sostituisci:'cambia sport',riposo:'riposo'},SP_W={corsa:'Corsa',bici:'Bici',nuoto:'Nuoto',forza:'Palestra'};
function salData(d){var q=aD(d);return GIOL[q.getDay()].slice(0,3).toLowerCase()+' '+q.getDate()}
function salForm(pre){var S=pre||{tipo:'infortunio',zona:'',dolore:3,riposo:false,sintomi:'sopra',febbre:false,dal:TODAY};
  function chip(attr,v,l,on){return '<button type="button" class="chipb'+(on?' on':'')+'" data-'+attr+'="'+v+'">'+l+'</button>'}
  var h='<div class="seg seg2" id="saltipo"><button type="button" data-t="infortunio" class="'+(S.tipo!=='malattia'?'on':'')+'">Infortunio</button><button type="button" data-t="malattia" class="'+(S.tipo==='malattia'?'on':'')+'">Malattia</button></div>'+
    '<div id="salinf" class="card pad vstack" style="gap:12px'+(S.tipo==='malattia'?';display:none':'')+'"><div class="label caps">Dove</div><div class="chipw" id="salz">'+Object.keys(ZONE_N).map(function(k){return chip('z',k,ZONE_N[k],S.zona===k)}).join('')+'</div>'+
    '<label class="vstack" style="gap:8px"><span class="label caps">Dolore durante l’attività · <b id="saldv">'+(S.dolore||0)+'</b> su 10</span><input id="saldol" type="range" min="0" max="10" step="1" value="'+(S.dolore||0)+'"></label>'+
    '<label class="hstack" style="justify-content:space-between;gap:12px"><span class="t15">Fa male anche a riposo, è gonfio o zoppichi</span><input id="salrip" type="checkbox"'+(S.riposo?' checked':'')+'></label></div>'+
    '<div id="salmal" class="card pad vstack" style="gap:12px'+(S.tipo==='malattia'?'':';display:none')+'"><div class="label caps">Dove sono i sintomi</div><div class="vstack" style="gap:8px" id="sals">'+chip('s','sopra','Sopra il collo: naso, raffreddore, gola',S.sintomi!=='sotto')+chip('s','sotto','Sotto il collo: tosse, petto, dolori, stomaco',S.sintomi==='sotto')+'</div>'+
    '<label class="hstack" style="justify-content:space-between;gap:12px"><span class="t15">Ho la febbre</span><input id="salfeb" type="checkbox"'+(S.febbre?' checked':'')+'></label></div>'+
    '<label class="card pad hstack" style="justify-content:space-between;gap:12px"><span class="t15">Da quando</span><input id="saldal" type="date" value="'+(S.dal||TODAY)+'" max="'+TODAY+'" class="inp" style="width:auto"></label>'+
    '<button class="primary" id="salok">Vedi i consigli</button><div class="t13 muted" style="line-height:1.4">Indicazioni generali, non un parere medico. Restano solo su questo iPhone.</div>';
  openP('Come stai?',h);
  var tipo=S.tipo==='malattia'?'malattia':'infortunio',zona=S.zona||'',sint=S.sintomi||'sopra';
  seg('saltipo','data-t',function(t){tipo=t;document.getElementById('salinf').style.display=t==='malattia'?'none':'';document.getElementById('salmal').style.display=t==='malattia'?'':'none'});
  document.querySelectorAll('#salz .chipb').forEach(function(b){b.addEventListener('click',function(){zona=b.getAttribute('data-z');document.querySelectorAll('#salz .chipb').forEach(function(x){x.classList.toggle('on',x===b)})})});
  document.querySelectorAll('#sals .chipb').forEach(function(b){b.addEventListener('click',function(){sint=b.getAttribute('data-s');document.querySelectorAll('#sals .chipb').forEach(function(x){x.classList.toggle('on',x===b)})})});
  var dol=document.getElementById('saldol');dol.addEventListener('input',function(){document.getElementById('saldv').textContent=dol.value});
  document.getElementById('salok').addEventListener('click',function(){
    if(tipo==='infortunio'&&!zona){toast('Scegli dove fa male');return}
    var o={tipo:tipo,dal:document.getElementById('saldal').value||TODAY};
    if(tipo==='infortunio'){o.zona=zona;o.dolore=+dol.value;o.riposo=document.getElementById('salrip').checked}else{o.sintomi=sint;o.febbre=document.getElementById('salfeb').checked}
    var b=document.getElementById('salok');b.disabled=true;b.textContent='Un attimo…';
    if(!hudSend('salute',JSON.stringify(o))){b.disabled=false;b.textContent='Vedi i consigli';toast('Apri l’HUD da Scriptable per salvarlo')}})}
function salVista(){var K=SAL;if(!K){salForm(null);return}
  var col=K.livello==='stop'?'#D70015':K.livello==='ok'?'#1E7F45':'#B25000',bg=K.livello==='stop'?'rgba(215,0,21,.10)':K.livello==='ok'?'rgba(48,209,88,.12)':'rgba(255,159,10,.14)';
  var h='<div class="vstack" style="gap:4px"><div class="label caps" style="color:'+col+'">'+escH(K.titolo)+' · da '+(K.giorni===0?'oggi':K.giorni===1?'ieri':K.giorni+' giorni')+'</div><div class="t22 bold">'+escH(K.sotto)+'</div></div>'+
    '<div class="salsp">'+['corsa','bici','nuoto','forza'].map(function(k){var r=K.sport[k]||'si';return '<div><div class="label">'+SP_W[k]+'</div><div class="t15 semi" style="color:'+REG_C[r]+'">'+REG_W[r]+'</div></div>'}).join('')+'</div>'+
    K.consigli.map(function(c){return '<div class="icard" style="background:'+bg+'"><b>'+escH(c[0])+'</b><span>'+escH(c[1])+'</span></div>'}).join('');
  if(K.proposta&&K.proposta.length&&K.puoApplicare===false){h+='<h3>Come adattare le prossime sedute</h3><div class="card list">'+K.proposta.map(function(p,i){var dopo=p.azione==='riposo'?'riposo':p.nuovo?((p.nuovo.sport!==p.sport?SP_W[p.nuovo.sport]+' ':'')+aHm(p.nuovo.min*60)+' facile'):'';
      return (i?'<div class="sep l16"></div>':'')+'<div class="lrow"><span class="t13 muted" style="width:46px;flex:none">'+salData(p.data)+'</span><div class="grow"><div class="t15"><s class="muted">'+escH(p.nome)+'</s></div><div class="t15 semi">→ '+escH(dopo)+'</div><div class="t13 muted">'+escH(p.motivo)+'</div></div></div>'}).join('')+'</div>'+
    '<div class="t13 muted" style="line-height:1.4">Il tuo piano lo gestisci tu: cambia queste sedute su Intervals o con chi ti allena.</div>'}
  else if(K.proposta&&K.proposta.length){h+='<h3>Le prossime sedute</h3><div class="card list">'+K.proposta.map(function(p,i){var dopo=p.azione==='riposo'?'riposo':p.nuovo?((p.nuovo.sport!==p.sport?SP_W[p.nuovo.sport]+' ':'')+aHm(p.nuovo.min*60)+' facile'):'';
      return (i?'<div class="sep l16"></div>':'')+'<div class="lrow"><span class="t13 muted" style="width:46px;flex:none">'+salData(p.data)+'</span><div class="grow"><div class="t15"><s class="muted">'+escH(p.nome)+'</s></div><div class="t15 semi">→ '+escH(dopo)+'</div><div class="t13 muted">'+escH(p.motivo)+'</div></div></div>'}).join('')+'</div>'+
    '<div class="btnrow" style="grid-template-columns:1fr 1fr"><button class="secondary" id="salsolo">Solo consigli</button><button class="primary" id="salapp">Applica al piano</button></div>'+
    '<div class="t13 muted" style="line-height:1.4">«Applica» cambia queste sedute su Intervals (e sull’orologio). Puoi annullare quando vuoi: tornano com’erano.</div>'}
  else if(K.applicata){h+='<div class="icard"><b>Sedute adattate su Intervals</b><span>'+K.modifiche+' sedute cambiate per i prossimi giorni.</span></div><button class="secondary" id="salann">Annulla le modifiche</button>'}
  else h+='<div class="icard"><b>Le prossime sedute vanno bene così</b><span>Nei prossimi 7 giorni non c’è niente da cambiare.</span></div>';
  h+='<h3>Carburante</h3><div class="icard"><b>'+(K.carb.deficit==='zero'?'Niente deficit':'Metà deficit')+'</b><span>'+escH(K.carb.testo)+'</span></div>';
  h+='<h3>Quando sentire un medico</h3><div class="card pad vstack" style="gap:6px">'+K.allarmi.map(function(a){return '<div class="t15" style="color:#D70015">• '+escH(a)+'</div>'}).join('')+'</div>';
  h+='<div class="btnrow" style="grid-template-columns:1fr 1fr">'+(K.tipo==='malattia'&&K.fase!=='rientro'?'<button class="secondary" id="salmeglio">Sto meglio</button>':'<button class="secondary" id="salmod">Aggiorna</button>')+'<button class="secondary" id="salfine" style="color:#1E7F45">Guarito</button></div>';
  h+='<div class="t13 muted" style="line-height:1.4">Indicazioni generali, non un parere medico.</div>';
  openP('Come stai?',h);
  function on(id,f){var b=document.getElementById(id);if(b)b.addEventListener('click',f)}
  function manda(kind,msg){if(!hudSend(kind,'1'))toast('Apri l’HUD da Scriptable');else toast(msg)}
  on('salsolo',closeP);on('salapp',function(){manda('saluteApplica','Aggiorno le sedute…')});on('salann',function(){manda('saluteAnnulla','Rimetto le sedute…')});
  on('salmeglio',function(){manda('saluteMeglio','Preparo il rientro…')});on('salfine',function(){manda('saluteFine','Bentornato')});on('salmod',function(){salForm(K.S)})}
window.__salute=function(){salVista()};
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-salute]');if(b){e.preventDefault();salVista()}});
var MOB=${JSON.stringify(MOB)},RISC=${JSON.stringify(RISC).replace(/</g, "\\u003c")},MOBH=${JSON.stringify(mobDelGiorno(A)[0])},MOBW=${JSON.stringify(mobDelGiorno(A)[1])},SPC=${JSON.stringify(Object.fromEntries(Object.entries(SPORT).map(([k, x]) => [k, x.c])))},CHEVJ=${JSON.stringify(CHEV)},SCRIVE=${JSON.stringify(!!SCRIVE_APP(A))};
// ---- Palestra, mobilità e riscaldamenti: esercizi con foto (Free Exercise DB, pubblico dominio) e video su YouTube
var ESL=${JSON.stringify(ESL).replace(/</g, "\\u003c")};
var ES={};ESL.forEach(function(e){ES[e[0]]={k:e[0],n:e[1],id:e[2],a:e[3],g:e[4],r:e[5],c:e[6]}});
var ATTR_L={libero:0,elastico:1,manubri:2,palestra:3},ATTR_OK={libero:['libero'],elastico:['libero','elastico'],manubri:['libero','manubri'],palestra:['libero','elastico','manubri','palestra']},GR_FORZA={gambe:1,post:1,mono:1,spinta:1,tirata:1,polpacci:1};
function esImg(id,n){return 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'+id+'/'+n+'.jpg'}
function esNo(i){i.parentNode.classList.add('no')}
function esNo2(i){i.style.display='none'}
function esFoto(e,cls){return '<div class="esimg'+(cls?' '+cls:'')+'"><img src="'+esImg(e.id,0)+'" alt="'+escH(e.n)+'" loading="lazy" onerror="esNo(this)"><img class="f2" src="'+esImg(e.id,1)+'" alt="" loading="lazy" onerror="esNo2(this)"></div>'}
function esVideo(e){var u='https://www.youtube.com/results?search_query='+encodeURIComponent(e.n+' esercizio come si fa');if(!hudSend('apri',u))window.open(u,'_blank')}
function esScheda(k){var e=ES[k];if(!e)return;openP(e.n,esFoto(e,'big')+'<div class="icard"><b>Come si fa</b><span>'+escH(e.c)+'</span></div><div class="t15 muted">Dose: '+escH(e.r)+'</div><button class="secondary" data-video="'+e.k+'">Guarda il video</button><div class="t13 muted">Foto: Free Exercise DB (pubblico dominio). Il video si apre su YouTube.</div>')}
document.addEventListener('click',function(e){var v=e.target.closest&&e.target.closest('[data-video]');if(v){e.preventDefault();e.stopPropagation();var x=ES[v.getAttribute('data-video')];if(x)esVideo(x);return}
  var s=e.target.closest&&e.target.closest('[data-es]');if(s){e.preventDefault();esScheda(s.getAttribute('data-es'))}},true);
// Allenamenti di palestra a scelta: obiettivo, attrezzi, tempo (cambiano ogni giorno, restano uguali nella giornata)
var GYM_OB={corsa:['Forza per correre',['gambe','post','mono','polpacci','core','glutei','plio','core']],prevenzione:['Prevenzione',['polpacci','glutei','post','mono','core','spalle','core']],core:['Core',['core','core','core','core','core','core']],alta:['Parte alta',['tirata','spinta','spalle','tirata','core','spalle','spinta']],tutto:['Tutto il corpo',['gambe','tirata','post','spinta','mono','core','spalle']]};
var GYM_AT=[['libero','Corpo libero'],['elastico','Elastico'],['manubri','Manubri'],['palestra','Palestra']],GYM_T=[[20,'20 min'],[30,'30 min'],[45,'45 min']];
var GYM=${JSON.stringify({ ob: PROF && PROF.soloPalestra ? "tutto" : "corsa", at: (PROF && ATTREZZI.includes(PROF.attrezzi) && PROF.attrezzi) || "manubri", t: PROF && PROF.soloPalestra ? Math.min(45, +PROF.palMin || 45) : 30 })};
try{var gs=JSON.parse(localStorage.getItem('hud_gym')||'null');if(gs&&GYM_OB[gs.ob]&&ATTR_OK[gs.at])GYM=gs}catch(e){}
function gymCrea(o){var ric=GYM_OB[o.ob][1],ok=ATTR_OK[o.at],n=o.t<=20?4:o.t<=30?6:ric.length,giri=o.t<=20?2:3,seme=Math.floor(Date.parse(TODAY)/864e5),usati={},out=[];
  for(var i=0;i<ric.length&&out.length<n;i++){var g=ric[i];
    var cand=ESL.map(function(x){return ES[x[0]]}).filter(function(x){return x.g===g&&ok.indexOf(x.a)>=0&&!usati[x.k]});if(!cand.length)continue;
    // forza: si usano gli attrezzi che hai (il livello più alto disponibile); core, glutei e salti vanno bene a corpo libero
    var pool=cand;if(GR_FORZA[g]){var top=Math.max.apply(null,cand.map(function(x){return ATTR_L[x.a]}));pool=cand.filter(function(x){return ATTR_L[x.a]===top})}
    var x=pool[(seme+i*7)%pool.length];usati[x.k]=1;
    out.push({e:x,giri:giri,rec:g==='core'?30:g==='plio'?60:75})}
  return out}
function gymVista(){var box=document.getElementById('pi-gym');if(!box)return;var L=gymCrea(GYM);
  function chips(id,arr,cur){return '<div class="chipw" id="'+id+'">'+arr.map(function(a){return '<button type="button" class="chipb'+(String(a[0])===String(cur)?' on':'')+'" data-v="'+a[0]+'">'+a[1]+'</button>'}).join('')+'</div>'}
  var obs=Object.keys(GYM_OB).map(function(k){return [k,GYM_OB[k][0]]});
  box.innerHTML='<div class="card pad vstack" style="gap:12px"><div class="label caps">Obiettivo</div>'+chips('gy-ob',obs,GYM.ob)+'<div class="label caps">Attrezzi</div>'+chips('gy-at',GYM_AT,GYM.at)+'<div class="label caps">Tempo</div>'+chips('gy-t',GYM_T,GYM.t)+'</div>'+
    '<div class="hstack" style="justify-content:space-between;align-items:baseline;padding:0 4px"><span class="t20 bold">'+L.length+' esercizi · '+(L[0]?L[0].giri:0)+' giri</span><span class="t13 muted">in circuito</span></div>'+
    '<div class="card list">'+L.map(function(r,i){return (i?'<div class="sep" style="margin-left:124px"></div>':'')+'<div class="esrow" data-es="'+r.e.k+'">'+esFoto(r.e)+'<div class="grow"><div class="t16 semi">'+escH(r.e.n)+'</div><div class="t13 muted">'+r.giri+' × '+escH(r.e.r)+' · recupero '+r.rec+'"</div></div><button class="vidb" data-video="'+r.e.k+'" aria-label="Video di '+escH(r.e.n)+'"><svg width="13" height="15" viewBox="0 0 14 16" aria-hidden="true"><path d="M2 1l11 7-11 7z" fill="currentColor"/></svg></button></div>'}).join('')+'</div>'+
    (SCRIVE?'<div class="btnrow" style="grid-template-columns:1fr 1fr"><button class="secondary" id="gy-piano">Metti nel piano</button><button class="primary" id="gy-via">Inizia ora</button></div>':'<button class="primary" id="gy-via">Inizia ora</button>')+'<div class="t13 muted" style="padding:0 4px;line-height:1.4">Tocca un esercizio per come si fa, ▶ per il video. Carichi che lasciano 2 ripetizioni di riserva. Foto: Free Exercise DB, pubblico dominio.</div>';
  [['gy-ob','ob'],['gy-at','at'],['gy-t','t']].forEach(function(p){box.querySelectorAll('#'+p[0]+' .chipb').forEach(function(b){b.addEventListener('click',function(){GYM[p[1]]=p[1]==='t'?+b.getAttribute('data-v'):b.getAttribute('data-v');try{localStorage.setItem('hud_gym',JSON.stringify(GYM))}catch(e){}gymVista()})})});
  var gp=document.getElementById('gy-piano');if(gp)gp.addEventListener('click',function(){gymPiano(L)});
  document.getElementById('gy-via').addEventListener('click',function(){var passi=[];for(var g=1;g<=(L[0]?L[0].giri:0);g++)L.forEach(function(r){passi.push({e:r.e,testo:'Giro '+g+' di '+r.giri+' · '+r.e.r,rec:r.rec})});guida('Palestra · '+GYM.t+' min',passi,false)})}
// Il passo per passo: foto grande, dose o timer, recupero; per palestra si va avanti a mano, per la mobilità a tempo
var GUIDA=null;
function guidaStop(){if(GUIDA&&GUIDA.tm)clearInterval(GUIDA.tm);GUIDA=null}
function guida(tit,passi,aTempo){guidaStop();GUIDA={p:passi,i:0,tit:tit,tempo:aTempo,riposo:false,tm:null};guidaMostra()}
function guidaMostra(){var G=GUIDA;if(!G)return;if(G.tm){clearInterval(G.tm);G.tm=null}
  if(G.i>=G.p.length){openP(G.tit,'<div class="vstack" style="gap:12px;align-items:center;padding:30px 0"><div class="t28 bold">Fatto</div><div class="t15 muted">'+G.p.length+' passi completati. Bravo.</div><button class="primary" style="align-self:stretch" id="gd-fine">Chiudi</button></div>');document.getElementById('gd-fine').addEventListener('click',function(){guidaStop();closeP()});return}
  var P=G.p[G.i],sec=G.riposo?P.rec:(G.tempo?P.sec:0),fino=Date.now()+sec*1000;
  var h=G.riposo?'<div class="label caps">Recupero</div><div class="gdt" id="gd-t">'+sec+'"</div><div class="t15 muted">Dopo: '+escH((G.p[G.i+1]||{e:{n:'fine'}}).e.n)+'</div><button class="secondary" id="gd-ok">Salta</button>'
    :esFoto(P.e,'big')+'<div class="hstack" style="justify-content:space-between;align-items:baseline"><span class="t22 bold">'+escH(P.e.n)+'</span><span class="t13 muted">'+(G.i+1)+' di '+G.p.length+'</span></div><div class="t17 semi">'+escH(P.testo)+'</div>'+(sec?'<div class="gdt" id="gd-t">'+sec+'"</div>':'')+'<div class="t15 muted">'+escH(P.e.c)+'</div>'+
      '<div class="btnrow" style="grid-template-columns:1fr 2fr"><button class="secondary" data-video="'+P.e.k+'">Video</button><button class="primary" id="gd-ok">'+(sec?'Avanti':'Fatto')+'</button></div>';
  openP(G.tit,'<div class="vstack" style="gap:12px">'+h+'<div class="pbar"><div style="width:'+Math.round(G.i/G.p.length*100)+'%;background:var(--accbg)"></div></div></div>');
  function avanti(){if(!GUIDA)return;if(!G.riposo&&P.rec&&G.i<G.p.length-1){G.riposo=true}else{G.riposo=false;G.i++}guidaMostra()}
  document.getElementById('gd-ok').addEventListener('click',avanti);
  if(sec){G.tm=setInterval(function(){var t=document.getElementById('gd-t');if(!t||!document.getElementById('psheet').classList.contains('on')){guidaStop();return}var r=Math.max(0,Math.round((fino-Date.now())/1000));t.textContent=r+'"';if(r<=0)avanti()},500)}}
// Mobilità: una routine al giorno, a tempo
function mobMin(R){var s=0;R[1].forEach(function(x){s+=x[1]*x[2]+10*x[2]});return Math.round(s/60)}
function mobPassi(R){var out=[];R[1].forEach(function(x){var e=ES[x[0]];for(var l=0;l<x[2];l++)out.push({e:e,sec:x[1],rec:8,testo:x[2]>1?(l?'Lato sinistro':'Lato destro')+' · '+x[1]+'"':x[1]+'"'})});return out}
function mobVista(){var box=document.getElementById('pi-mob');if(!box)return;var k=MOBH&&MOB[MOBH]?MOBH:'anche',R=MOB[k];
  var foto=R[1].slice(0,2).map(function(x){var e=ES[x[0]];return '<figure class="mobf" data-es="'+e.k+'">'+esFoto(e)+'<figcaption class="t13">'+escH(e.n)+'</figcaption></figure>'}).join('');
  box.innerHTML='<div class="card pad vstack" style="gap:12px"><div class="hstack" style="justify-content:space-between;align-items:baseline"><div><div class="label caps">Routine di oggi</div><div class="t20 bold">'+R[0]+' · '+mobMin(R)+'’</div></div><span class="t13 muted">'+escH(MOBW||'')+'</span></div><div class="mobfs">'+foto+'</div>'+
    '<div class="t15 muted">'+R[1].slice(2).map(function(x){return ES[x[0]].n.toLowerCase()}).join(', ')+'</div><button class="primary" data-mob="'+k+'">Inizia con il timer</button></div>'+
    '<div class="t20 bold" style="padding:0 4px">Le altre routine</div><div class="card list">'+Object.keys(MOB).filter(function(x){return x!==k}).map(function(x,i){return (i?'<div class="sep l16"></div>':'')+'<button class="lrow rowb" data-mob="'+x+'"><div class="grow"><div class="t16 semi">'+MOB[x][0]+'</div><div class="t13 muted">'+mobMin(MOB[x])+'’ · '+MOB[x][1].map(function(y){return ES[y[0]].n.toLowerCase()}).slice(0,3).join(', ')+'</div></div><span class="t15 semi acc">Inizia</span></button>'}).join('')+'</div>'+
    '<div class="t20 bold" style="padding:0 4px">Riscaldamento prima della seduta</div><div class="card list">'+Object.keys(RISC).map(function(x,i){var r=RISC[x];return (i?'<div class="sep l16"></div>':'')+'<button class="lrow rowb" data-risc="'+x+'"><span class="evbar" style="background:'+(SPC[r.sp]||'#8E8E93')+'"></span><div class="grow"><div class="t16 semi">'+escH(r.t)+'</div><div class="t13 muted">'+r.min+'’ · '+escH(r.passi.map(function(p){return p[1]}).slice(0,2).join(', '))+'</div></div>'+CHEVJ+'</button>'}).join('')+'</div>'}
function riscScheda(k){var r=RISC[k];if(!r)return;
  var h='<div class="label caps">'+r.min+' minuti</div>'+r.passi.map(function(p){var e=p[0]?ES[p[0]]:null;return '<div class="riscp'+(e?'" data-es="'+e.k:'')+'">'+(e?esFoto(e):'<div class="esimg rnum">'+(r.passi.indexOf(p)+1)+'</div>')+'<div class="grow"><div class="t16 semi">'+escH(p[1])+'</div><div class="t13 muted">'+escH(p[2]||'')+'</div></div>'+(e?'<button class="vidb" data-video="'+e.k+'" aria-label="Video"><svg width="13" height="15" viewBox="0 0 14 16" aria-hidden="true"><path d="M2 1l11 7-11 7z" fill="currentColor"/></svg></button>':'')+'</div>'}).join('')+(r.nota?'<div class="icard"><b>Perché</b><span>'+escH(r.nota)+'</span></div>':'');
  openP('Riscaldamento · '+r.t,'<div class="vstack" style="gap:10px">'+h+'</div>')}
document.addEventListener('click',function(e){var m=e.target.closest&&e.target.closest('[data-mob]');if(m){var R=MOB[m.getAttribute('data-mob')];if(R)guida(R[0],mobPassi(R),true);return}
  var r=e.target.closest&&e.target.closest('[data-risc]');if(r){riscScheda(r.getAttribute('data-risc'))}});
// Le sedute di palestra del piano: righe con foto e video, e la guida passo passo
function esLista(v){return String(v||'').split(',').map(function(x){var p=x.split(':');return {e:ES[p[0]],d:(p[1]||'').trim()}}).filter(function(x){return x.e})}
function esIdrata(){document.querySelectorAll('#pbody .esl[data-esl]').forEach(function(b){var L=esLista(b.getAttribute('data-esl'));
  b.innerHTML=L.map(function(x,i){return (i?'<div class="sep" style="margin-left:124px"></div>':'')+'<div class="esrow" data-es="'+x.e.k+'">'+esFoto(x.e)+'<div class="grow"><div class="t16 semi">'+escH(x.e.n)+'</div><div class="t13 muted">'+escH(x.d||x.e.r)+'</div></div><button class="vidb" data-video="'+x.e.k+'" aria-label="Video di '+escH(x.e.n)+'"><svg width="13" height="15" viewBox="0 0 14 16" aria-hidden="true"><path d="M2 1l11 7-11 7z" fill="currentColor"/></svg></button></div>'}).join('');b.removeAttribute('data-esl')})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-gymgo]');if(!b)return;var L=esLista(b.getAttribute('data-gymgo')),giri=1;
  L.forEach(function(x){var m=/^([0-9]+) *×/.exec(x.d);if(m)giri=Math.max(giri,+m[1])});var passi=[];
  for(var g=1;g<=giri;g++)L.forEach(function(x){var m=/^([0-9]+) *× *(.+)$/.exec(x.d);if(m&&+m[1]<g)return;passi.push({e:x.e,testo:(giri>1?'Giro '+g+' di '+giri+' · ':'')+(m?m[2]:x.d||x.e.r),rec:x.e.g==='core'?30:75})});
  guida('Palestra',passi,false)});
// «Metti nel piano»: scegli il giorno, diventa una seduta su Intervals con gli esercizi nella descrizione
function gymPiano(L){var giorni=[];for(var i=0;i<7;i++){var d=new Date(aD(TODAY).getTime()+i*864e5);giorni.push([d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2),i===0?'Oggi':i===1?'Domani':GIOL[d.getDay()].slice(0,3)+' '+d.getDate()])}
  var scelto=giorni[0][0],nome=GYM_OB[GYM.ob][0];
  openP('Metti nel piano','<div class="t22 bold">'+escH(nome)+' · '+GYM.t+'’</div><div class="t15 muted">'+L.map(function(r){return r.e.n}).join(', ')+'</div><div class="label caps">Quando</div><div class="chipw" id="gp-g">'+giorni.map(function(g,i){return '<button type="button" class="chipb'+(i?'':' on')+'" data-g="'+g[0]+'">'+g[1]+'</button>'}).join('')+'</div><button class="primary" id="gp-ok">Aggiungi a Intervals</button><div class="t13 muted" style="line-height:1.4">Arriva su Intervals e sull’orologio come seduta di palestra. Una per giorno: se c’è già, si aggiorna.</div>');
  document.querySelectorAll('#gp-g .chipb').forEach(function(b){b.addEventListener('click',function(){scelto=b.getAttribute('data-g');document.querySelectorAll('#gp-g .chipb').forEach(function(x){x.classList.toggle('on',x===b)})})});
  document.getElementById('gp-ok').addEventListener('click',function(){var o={data:scelto,nome:'Palestra · '+nome,min:GYM.t,righe:L.map(function(r){return r.e.n+' · '+r.giri+' × '+r.e.r})};o.righe.push('In circuito, recupero '+(L[0]?L[0].rec:60)+' secondi tra gli esercizi.');
    var b=document.getElementById('gp-ok');b.disabled=true;b.textContent='Un attimo…';if(!hudSend('gymPiano',JSON.stringify(o))){b.disabled=false;b.textContent='Aggiungi a Intervals';toast('Apri l’HUD da Scriptable per salvarlo')}})}

var SH=${shareData};
var ATT=${attData};
var REC=${JSON.stringify(A.record || { lista: [] }).replace(/</g, "\\u003c")};
var SETT=${JSON.stringify([0, 1].map((k) => riassuntoSettimana(A.raw || { activities: [], wellness: [] }, A.now, k)))};
var OPT={layout:SH.imp?'attivita':'giornata',style:'scuro',act:null};
var ACC='#FF6A1A';
function rr(x,c,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));x.beginPath();x.moveTo(c+r,y);x.arcTo(c+w,y,c+w,y+h,r);x.arcTo(c+w,y+h,c,y+h,r);x.arcTo(c,y+h,c,y,r);x.arcTo(c,y,c+w,y,r);x.closePath()}
function fmtM(m){if(!m)return '—';return m>=60?Math.floor(m/60)+' h '+('0'+m%60).slice(-2):m+"'"}
function zone(t){if(t>25)return['Transizione','#FFD60A'];if(t>5)return['Fresco','#64D2FF'];if(t>-10)return['Zona grigia','#8E8E93'];if(t>-30)return['Ottimale','#30D158'];return['Rischio alto','#FF453A']}
// Colori per stile: chiaro e scuro hanno il fondo pieno, trasparente e foto no
function pal(){var s=OPT.style;
  if(s==='chiaro')return{bg:'#F5F5F7',fg:'#1D1D1F',mut:'#6E6E73',line:'#C7C7CC',sh:false,good:'#1F8F4E',warn:'#C26A00',bad:'#D70015'};
  if(s==='scuro')return{bg:'#000000',fg:'#F5F5F7',mut:'#A1A1A6',line:'#3A3A3C',sh:false,good:'#30D158',warn:'#FF9F0A',bad:'#FF453A'};
  return{bg:null,fg:'#FFFFFF',mut:'#E5E5EA',line:'#D1D1D6',sh:true,good:'#FFFFFF',warn:'#FFFFFF',bad:'#FFFFFF'}}
// L'impronta su canvas: contorno del piano, pieno di quello che hai fatto; p = quanto è riempita (0–1)
function drawImp(x,I,X,Y,W,H,P,p){if(!I||!I.plan)return;var n=I.plan.length,step=W/n,cw=step*0.62,r=cw/2,lw=Math.max(2,cw*0.14);p=p===undefined?1:p;
  x.lineWidth=lw;
  for(var i=0;i<n;i++){var cx=X+i*step+(step-cw)/2,pl=I.plan[i],dn=I.done?I.done[i]:0;
    if(pl>0){var hh=Math.max(cw,pl*H);rr(x,cx+lw/2,Y+H-hh+lw/2,cw-lw,hh-lw,r-lw/2);x.strokeStyle=P.line;x.stroke()}
    if(dn>0){var k=Math.max(0,Math.min(1,p*n-i));if(k<=0)continue;var h2=Math.max(cw,dn*H)*k;rr(x,cx,Y+H-h2,cw,h2,r);x.fillStyle=dn>=0.8?ACC:P.fg;x.fill()}}}
// Pennello comune delle immagini da condividere: un solo carattere (SF Pro), cifre Heavy, etichette Semibold spaziate
var SF='-apple-system,"SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif',SL=96,SR=1080-96,SCW=SR-SL,FY=1560,FH=200,FC=1830;
function pennello(x,P){
  function sh(on){if(on&&P.sh){x.shadowColor='rgba(0,0,0,.34)';x.shadowBlur=14;x.shadowOffsetY=2}else{x.shadowColor='transparent';x.shadowBlur=0;x.shadowOffsetY=0}}
  function t(s,X,Y,size,w,col,al,ls){s=String(s);sh(true);x.font=(w||400)+' '+size+'px '+SF;x.fillStyle=col||P.fg;x.textAlign=al||'left';x.textBaseline='alphabetic';if(x.letterSpacing!==undefined)x.letterSpacing=(ls||0)+'px';x.fillText(s,X,Y);var m=x.measureText(s).width;if(x.letterSpacing!==undefined)x.letterSpacing='0px';sh(false);return m}
  function fit(s,size,w,max,ls){x.font=w+' '+size+'px '+SF;if(x.letterSpacing!==undefined)x.letterSpacing=(ls||0)+'px';var m=x.measureText(String(s)).width;if(x.letterSpacing!==undefined)x.letterSpacing='0px';return m>max?size*max/m:size}
  // etichetta: maiuscolo, Semibold, spaziata
  function lab(s,X,Y,col,al,size){return t(String(s).toUpperCase(),X,Y,size||28,600,col||P.mut,al,4)}
  return{t:t,fit:fit,lab:lab}}
// Il simbolo: tre capsule, quella in mezzo arancio (sopra soglia)
function drawMark(x,X,Y,S,P){var hs=[0.42,1,0.62],cw=S*0.22,gap=S*0.14;for(var i=0;i<3;i++){var hh=hs[i]*S;rr(x,X+i*(cw+gap),Y+S-hh,cw,hh,cw/2);x.fillStyle=i===1?ACC:P.fg;x.fill()}return 3*cw+2*gap}
// Intestazione uguale per tutte: simbolo e HUD a sinistra, data a destra
function testata(x,P,B,data){var w=drawMark(x,SL,152,46,P);B.t('HUD',SL+w+16,196,40,800,P.fg,'left',-1);B.lab(data,SR,192,P.mut,'right')}
// La firma: l'impronta sempre nello stesso punto in fondo, con la sua didascalia
function firma(x,P,B,I,p,sx,dx,dxCol){if(I&&I.plan&&I.plan.length)drawImp(x,I,SL,FY,SCW,FH,P,p);if(sx)B.lab(sx,SL,FC,null,null,B.fit(String(sx).toUpperCase(),28,600,SCW*(dx?0.68:1),4));if(dx)B.lab(dx,SR,FC,dxCol||P.mut,'right')}
function oggiTxt(){return RECAP.date.split(' · ')[0]}
function drawRecap(p){
  var Wd=1080,H=1920,cv=document.createElement('canvas');cv.width=Wd;cv.height=H;var x=cv.getContext('2d'),P=pal();
  p=p===undefined?1:Math.max(0,Math.min(1,p));
  if(P.bg){x.fillStyle=P.bg;x.fillRect(0,0,Wd,H)}
  if(OPT.layout==='attivita')return drawAtt(cv,x,P,p);
  var B=pennello(x,P),lay=OPT.layout;testata(x,P,B,oggiTxt());
  if(lay==='giornata'){var col=P.sh?P.fg:({verde:P.good,giallo:P.warn,rosso:P.bad})[SH.worst],y=900;
    if(SH.rd!==null&&SH.rd!==undefined){B.lab('Prontezza',SL,420);B.t(String(SH.rd),SL-14,770,400,800,P.fg,'left',-24)}else y=640;
    B.t(SH.word+'.',SL,y,110,800,col,'left',-4);
    var cells=[[RECAP.sleep,'Sonno'],[RECAP.hrv!==null&&RECAP.hrv!==undefined?String(Math.round(RECAP.hrv)):'—','HRV'],[RECAP.tsb,'Forma']];
    cells.forEach(function(c,i){var cx=SL+i*(SCW/3);B.t(String(c[0]),cx,y+220,80,800,P.fg,'left',-2);B.lab(c[1],cx,y+266)});
    var T=SH.today;firma(x,P,B,T,p,T?(T.done?'Oggi, fatto · ':'Oggi · ')+T.name:'Oggi riposo',T?(T.done?'Fatto':'Da riempire'):'');
    return cv}
  if(lay==='settimana'){var rows=SH.week||[],nf=rows.filter(function(r){return r.done&&r.done.some(function(v){return v>0})}).length;
    B.lab('Settimana',SL,400);var hw=B.t(fmtM(SH.wkDone),SL-8,630,B.fit(fmtM(SH.wkDone),210,800,SCW,-8),800,P.fg,'left',-8);B.t('di '+fmtM(SH.wkPlan),SL,710,40,600,P.mut);
    var mx=Math.max(60,Math.max.apply(null,rows.map(function(r){return r.min||0}))),top=860,rh=(FC-70-top)/7,LX=SL+90,LW=SCW-90-170;
    rows.forEach(function(r,i){var yy=top+i*rh;B.t(r.l,SL,yy+rh*0.66,34,800,r.today?ACC:P.fg);
      if(r.plan){drawImp(x,{plan:r.plan,done:r.done},LX,yy+rh*0.14,Math.max(140,(r.min/mx)*LW),rh*0.62,P,p);B.t(fmtM(r.min),SR,yy+rh*0.66,34,800,r.done?P.fg:P.mut,'right')}
      else B.lab('Riposo',LX,yy+rh*0.62)});
    B.lab('Sette impronte',SL,FC);B.lab(nf+' di 7',SR,FC,P.mut,'right');
    return cv}
  if(lay==='gara'){var S=SH.season||[],rc=SH.race,y=640;
    if(rc){B.t(String(rc.days),SL-14,y,B.fit(String(rc.days),400,800,SCW,-24),800,P.fg,'left',-24);B.lab('Giorni a',SL,y+70);B.t(rc.name,SL,y+180,B.fit(rc.name,96,800,SCW,-3),800,ACC,'left',-3);B.t(rc.date,SL,y+240,36,400,P.mut)}
    else{B.t(String(SH.ctl||'—'),SL-14,y,400,800,P.fg,'left',-24);B.lab('Fitness',SL,y+70);B.t('La tua stagione',SL,y+180,96,800,P.fg,'left',-3)}
    var cols=S.length+(rc?3:0),step=SCW/Math.max(1,cols),cw=step*0.58,top=1060,Hn=FY+FH-top,mx=Math.max(1,Math.max.apply(null,S.map(function(w){return Math.max(w.d,w.p||0)}))),shown=Math.ceil(p*cols);x.lineWidth=3;
    S.forEach(function(w,i){if(i>=shown)return;var X=SL+i*step+(step-cw)/2;
      if(w.p){var hp=Math.max(cw,w.p/mx*Hn);rr(x,X+1.5,top+Hn-hp+1.5,cw-3,hp-3,cw/2);x.strokeStyle=P.line;x.stroke()}
      if(w.d){var hd=Math.max(cw,w.d/mx*Hn);rr(x,X,top+Hn-hd,cw,hd,cw/2);x.fillStyle=P.fg;x.fill()}});
    if(rc&&shown>=cols){var X=SL+(S.length+2)*step+(step-cw)/2;rr(x,X+2,top+2,cw-4,Hn-4,cw/2);x.strokeStyle=ACC;x.lineWidth=5;x.stroke();
      [0,0.7].forEach(function(o){x.beginPath();x.arc(SL+(S.length+o)*step+step/2,top+Hn-8,4,0,6.283);x.fillStyle=P.mut;x.fill()})}
    B.lab('11 settimane fa',SL,FC);B.lab(rc?'Gara':'Questa settimana',SR,FC,rc?ACC:P.mut,'right');
    return cv}
  return cv}
function refresh(){var st=OPT.style,ao=document.getElementById('attopts');var conD=OPT.layout==='attivita';if(ao){ao.style.display=conD?'flex':'none';if(conD&&window.attChips)attChips()}document.querySelector('.checker').classList.toggle('light',st==='chiaro');
  document.getElementById('hint').textContent=st==='trasparente'?'Sticker: fondo trasparente, da incollare su una tua foto nelle storie.':'Video: l’impronta si riempie in 3 secondi; caricalo come storia.';
  if(typeof animStart==='function')animStart()}
function chips(id,attr,fn){var bs=document.querySelectorAll('#'+id+' button');bs.forEach(function(b){b.addEventListener('click',function(){bs.forEach(function(z){z.classList.toggle('on',z===b)});fn(b.getAttribute(attr));refresh()})})}
chips('lay','data-l',function(v){OPT.layout=v});
document.querySelectorAll('#lay button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-l')===OPT.layout)});
chips('sty','data-s',function(v){OPT.style=v});
(function(){var g=document.querySelector('#lay [data-l="gara"]');if(g&&!SH.race)g.textContent='Stagione'})();
function setLayout(v){v=({impronta:'attivita',riepilogo:'settimana',stagione:'gara'})[v]||v;var b=document.querySelector('#lay button[data-l="'+v+'"]');if(b)b.click()}
function openSheet(){refresh();document.getElementById('sheet').classList.add('on')}
(function(){var sb=document.getElementById('sharebtn');if(sb)sb.addEventListener('click',function(){OPT.rec=null;if(CUR.v==='att'){var L=ATT.att[ATTG]||[];if(L.length){OPT.act=L[L.length-1].id;setLayout('attivita')}}openSheet()});})();
document.getElementById('sheetx').addEventListener('click',function(){document.getElementById('sheet').classList.remove('on');if(typeof animStop==='function')animStop()});
document.getElementById('sheet').addEventListener('click',function(e){if(e.target.id==='sheet'){e.target.classList.remove('on');if(typeof animStop==='function')animStop()}});
(function(){var b=document.getElementById('shareImp');if(b)b.addEventListener('click',function(){setLayout('impronta');openSheet()})})();
// ---- Condividi: le cifre per sport e i disegni (percorso, curve, barre) delle immagini
var FONTS={sf:['SF Pro','-apple-system,"SF Pro Display","Helvetica Neue",Inter,Arial,sans-serif'],
  rounded:['Rounded','ui-rounded,"SF Pro Rounded",Nunito,-apple-system,sans-serif'],
  ny:['New York','ui-serif,"New York","Bodoni Moda",Georgia,serif'],
  didot:['Didot','Didot,"Bodoni 72","Bodoni Moda",serif'],
  futura:['Futura','Futura,"Futura-Medium",Jost,"Century Gothic",sans-serif'],
  din:['DIN','"DINCondensed-Bold","DIN Condensed","DIN Alternate","Barlow Condensed","Arial Narrow",sans-serif'],
  compatto:['Compatto','"HelveticaNeue-CondensedBlack","Futura-CondensedExtraBold",Anton,Impact,sans-serif'],
  mono:['Mono','ui-monospace,"SF Mono",Menlo,"DM Mono",monospace']};
var DESIGN_FONT={minimal:'sf',tecnico:'din',bold:'compatto'};
var MESI3=['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC'],GG3=['DOM','LUN','MAR','MER','GIO','VEN','SAB'];
var SPW={corsa:'CORSA',bici:'BICI',nuoto:'NUOTO',forza:'FORZA',altro:'ATTIVITÀ'};
function itN(v,d){var s=Number(v).toFixed(d||0).split('.'),i=s[0],neg=i.charAt(0)==='-',o='';if(neg)i=i.slice(1);while(i.length>3){o='.'+i.slice(-3)+o;i=i.slice(0,-3)}o=(neg?'-':'')+i+o;return s[1]?o+','+s[1]:o}
function durS(s){s=Math.round(s||0);var h=Math.floor(s/3600),m=Math.floor(s%3600/60),z=s%60;return h?h+':'+('0'+m).slice(-2)+':'+('0'+z).slice(-2):m+':'+('0'+z).slice(-2)}
function paceS(s){s=Math.round(s);return Math.floor(s/60)+':'+('0'+s%60).slice(-2)}
// Le cifre da mostrare, in ordine di importanza per sport
function metricheAtt(A){if(A.hero)return{hero:A.hero,list:A.lista||[]};var L=[],sp=A.sp,hero;
  function add(l,v,u){if(v!==null&&v!==undefined&&v!==''&&v!=='—')L.push({l:l,v:String(v),u:u||''})}
  var t=durS(A.sec),hasD=A.m>0;
  if(sp==='corsa'){hero={l:'DISTANZA',v:itN(A.m/1000,2),u:'KM'};add('TEMPO',t);if(A.m)add('PASSO',paceS(A.sec/(A.m/1000)),'/KM');}
  else if(sp==='nuoto'){hero={l:'DISTANZA',v:itN(A.m),u:'M'};add('TEMPO',t);if(A.m)add('PASSO',paceS(A.sec/(A.m/100)),'/100M');}
  else if(sp==='bici'&&hasD){hero={l:'DISTANZA',v:itN(A.m/1000,1),u:'KM'};add('TEMPO',t);add('VELOCITÀ',itN(A.m/A.sec*3.6,1),'KM/H');}
  else hero={l:'TEMPO',v:t,u:''};
  if(A.hr)add('FC MEDIA',A.hr,'BPM');
  if(sp==='bici'&&A.w)add('POTENZA',A.w,'W');
  if(A.dplus>20)add('DISLIVELLO',itN(A.dplus),'M');
  if(sp==='forza'&&A.kg)add('SOLLEVATI',itN(A.kg),'KG');
  if(sp==='nuoto'&&A.vasche)add('VASCHE',A.vasche,'');
  if(A.tss)add('CARICO',A.tss,'TSS');
  if(A.kcal)add('CALORIE',itN(A.kcal),'KCAL');
  if(A.hrM)add('FC MAX',A.hrM,'BPM');
  if(sp==='corsa'&&A.cad)add('CADENZA',Math.round(A.cad*2),'SPM');
  if(A.temp!==null&&A.temp!==undefined)add('TEMPERATURA',itN(A.temp),'°C');
  return{hero:hero,list:L}}
// Percorso: lat/lng proiettati in un riquadro, proporzioni vere
function proiezione(r,X,Y,W,H){if(!r||!r.lat||r.lat.length<2)return null;var la=r.lat,lo=r.lng,mnA=1e9,mxA=-1e9,mnO=1e9,mxO=-1e9;
  for(var i=0;i<la.length;i++){if(la[i]<mnA)mnA=la[i];if(la[i]>mxA)mxA=la[i];if(lo[i]<mnO)mnO=lo[i];if(lo[i]>mxO)mxO=lo[i]}
  var k=Math.cos((mnA+mxA)/2*Math.PI/180),w=(mxO-mnO)*k||1e-6,h=(mxA-mnA)||1e-6,s=Math.min(W/w,H/h),ox=X+(W-w*s)/2,oy=Y+(H-h*s)/2;
  return la.map(function(a,i){return[ox+(lo[i]-mnO)*k*s,oy+(mxA-a)*s]})}
function tracciato(x,pts,p,col,lw){if(!pts)return null;var n=Math.max(2,Math.round(pts.length*p));x.beginPath();x.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<n;i++)x.lineTo(pts[i][0],pts[i][1]);
  x.lineJoin='round';x.lineCap='round';x.lineWidth=lw;x.strokeStyle=col;x.stroke();return pts[n-1]}
// Curva di una serie (FC o quota), con l'area sotto opzionale
function curva(x,s,X,Y,W,H,p,col,lw,fill,lo,hi){if(!s||s.length<2)return null;var mn=lo!==undefined?lo:Math.min.apply(null,s),mx=hi!==undefined?hi:Math.max.apply(null,s);if(mx-mn<1)mx=mn+1;
  var n=s.length,m=Math.max(2,Math.round(n*p)),pt=function(i){return[X+i/(n-1)*W,Y+H-(s[i]-mn)/(mx-mn)*H]};
  x.beginPath();var a=pt(0);x.moveTo(a[0],a[1]);for(var i=1;i<m;i++){var q=pt(i);x.lineTo(q[0],q[1])}
  if(fill){var e=pt(m-1);x.save();x.lineTo(e[0],Y+H);x.lineTo(X,Y+H);x.closePath();x.globalAlpha=0.16;x.fillStyle=fill;x.fill();x.restore();x.beginPath();x.moveTo(a[0],a[1]);for(var j=1;j<m;j++){var r2=pt(j);x.lineTo(r2[0],r2[1])}}
  x.lineJoin='round';x.lineCap='round';x.lineWidth=lw;x.strokeStyle=col;x.stroke();return pt(m-1)}

// Le sette giornate della settimana come colonne: più alte = più minuti; la più lunga in arancio
var GG1=['L','M','M','G','V','S','D'];
// Prima e ora come barre orizzontali: più corta = più veloce
function confronto(x,C,X,Y,W,P,p,fam,size){var mx=Math.max(C[0][1],C[1][1]),h=size*1.6;C.forEach(function(c,i){var w=c[1]/mx*W*Math.min(1,p*1.3),yy=Y+i*(h+size*2.4);rr(x,X,yy,Math.max(h,w),h,h/2);x.fillStyle=i?ACC:P.line;x.fill();
  x.font='600 '+size+'px '+fam;x.fillStyle=i?P.fg:P.mut;x.textAlign='left';x.fillText(c[0]+'  '+durS(c[1]),X,yy-size*0.5)})}
function barre(x,v,X,Y,W,H,p,P,lab,fam,lw){var mx=Math.max.apply(null,v.concat([1])),n=v.length,st=W/n,cw=st*(lw||0.5),im=v.indexOf(mx);
  v.forEach(function(m,i){var h=Math.max(m>0?cw:6,m/mx*H*Math.min(1,p*1.3)),cx=X+i*st+(st-cw)/2;rr(x,cx,Y+H-h,cw,h,Math.min(cw/2,18));x.fillStyle=m<=0?P.line:i===im?ACC:P.fg;x.fill();
    if(lab){x.font='600 '+lab+'px '+fam;x.fillStyle=P.mut;x.textAlign='center';x.fillText(GG1[i]||'',cx+cw/2,Y+H+lab*1.6)}})}
// Attività: in alto il percorso (o la frequenza cardiaca), poi nome e cifre, in fondo la firma
function drawAtt(cv,x,P,p){
  var A=SHA(),B=pennello(x,P);
  function conta(v,q){if(q>=1)return v;var m=String(v).match(/^([0-9.]*)(,?)([0-9]*)$/);if(!m||!m[1]&&!m[3])return v;var dec=m[3].length,n=parseFloat((m[1].split('.').join('')||'0')+'.'+(m[3]||'0'))*(1-Math.pow(1-q,3));return itN(n,dec)}
  if(!A){testata(x,P,B,oggiTxt());B.t('Nessuna attività',SL,960,72,800);return cv}
  var M=metricheAtt(A),D=new Date(A.data+'T12:00:00'),giorno=GG3[D.getDay()]+' '+D.getDate()+' '+MESI3[D.getMonth()];
  testata(x,P,B,giorno+(A.ora?' · '+A.ora:''));
  var gt=290,gh=600;
  if(A.route){var punti=proiezione(A.route,SL+40,gt,SCW-80,gh),e=tracciato(x,punti,p,P.fg,8);if(e){x.beginPath();x.arc(e[0],e[1],15,0,6.283);x.fillStyle=ACC;x.fill()}
    if(punti){x.beginPath();x.arc(punti[0][0],punti[0][1],10,0,6.283);x.lineWidth=5;x.strokeStyle=P.fg;x.stroke()}}
  else if(A.barre)barre(x,A.barre,SL,gt+140,SCW,gh-220,p,P,26,SF);
  else if(A.confronto)confronto(x,A.confronto,SL,gt+240,SCW,P,p,SF,40);
  else if(A.hrS){var e2=curva(x,A.hrS,SL,gt+160,SCW,gh-240,p,P.fg,5,P.fg);if(e2){x.beginPath();x.arc(e2[0],e2[1],13,0,6.283);x.fillStyle=ACC;x.fill()}B.lab('Frequenza cardiaca',SL,gt+gh-20);B.lab((A.hrMin||'')+'–'+(A.hrM||'')+' bpm',SR,gt+gh-20,P.mut,'right')}
  // senza percorso né curve il blocco delle cifre sale, così l'immagine non resta vuota in alto
  var o=A.route||A.barre||A.confronto||A.hrS?0:-280;
  B.lab(A.etichetta||(SPW[A.sp]+(A.indoor?' · al chiuso':'')),SL,1000+o,ACC);
  B.t(A.nome,SL,1066+o,B.fit(A.nome,54,600,SCW,-1),600,P.fg,'left',-1);
  var hs=B.fit(M.hero.v,250,800,SCW-(M.hero.u?150:0),-10),hy=1100+o+hs*0.9;
  var hw=B.t(conta(M.hero.v,p),SL-10,hy,hs,800,P.fg,'left',-10);if(M.hero.u)B.lab(M.hero.u,SL+hw+16,hy,P.mut,'left',36);
  var row=M.list.filter(function(z){return z.l!==M.hero.l}).slice(0,3),cw3=SCW/3;
  row.forEach(function(z,i){var X=SL+i*cw3,s=B.fit(z.v,66,800,cw3-34,-2);var w=B.t(z.v,X,1440+o,s,800,P.fg,'left',-2);if(z.u)B.lab(z.u,X+w+8,1440+o,P.mut,'left',22);B.lab(z.l,X,1482+o,P.mut,'left',22)});
  firma(x,P,B,A.imp,p,A.imp?"L'impronta":(A.gara?A.gara.nome+' · tra '+A.gara.giorni+' giorni':''),durS(A.sec));
  return cv}

// ---- Scheda Attività: tutto quello che hai fatto in un giorno
var ATTG=ATT.apri,ATTREQ={},CHS=[];
try{var sa=JSON.parse(localStorage.getItem('hud_att')||'null');if(sa&&Date.now()-sa.ts<20000&&ATT.giorni.indexOf(sa.g)>=0)ATTG=sa.g}catch(e){}
var ZC=['#8E8E93','#0A84FF','#30D158','#FF9F0A','#FF453A'],GIOL=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'],MESL=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
function aD(ds){return new Date(ds+'T12:00:00')}
function aDur(s){s=Math.round(s||0);var h=Math.floor(s/3600),m=Math.floor(s%3600/60),z=s%60;return h?h+':'+('0'+m).slice(-2)+':'+('0'+z).slice(-2):m+':'+('0'+z).slice(-2)}
function aHm(s){var m=Math.round((s||0)/60);return m>=60?Math.floor(m/60)+'h'+('0'+m%60).slice(-2):m+"'"}
function aN(v,d){return v===null||v===undefined?'—':itN(v,d||0)}
function aGiorno(ds){var d=aD(ds),o=aD(ATT.oggi),g=Math.round((o-d)/864e5);return g===0?'Oggi':g===1?'Ieri':d.getDate()+' '+MESL[d.getMonth()]}
function aData(ds){var d=aD(ds);return GIOL[d.getDay()]+' '+d.getDate()+' '+MESL[d.getMonth()]}
function aSport(sp){return ATT.sport[sp]||ATT.sport.altro}
function aPasso(a){if(!a.m||!a.sec)return null;if(a.sp==='nuoto')return paceS(a.sec/(a.m/100));return paceS(a.sec/(a.m/1000))}
// Le cifre di un'attività, quelle che ci sono
function aMetriche(a,d){var L=[],s=(d&&d.s)||{};function add(l,v,u){if(v!==null&&v!==undefined&&v!==''&&v!=='—')L.push([l,v,u||''])}
  var corsaLike=a.sp==='corsa'||(a.sp==='altro'&&a.m>500);
  add('Durata',aDur(a.sec));if(a.el&&a.el-a.sec>60)add('Tempo totale',aDur(a.el));
  if(a.m)add('Distanza',a.sp==='nuoto'?itN(a.m):itN(a.m/1000,2),a.sp==='nuoto'?'m':'km');
  if(corsaLike&&a.m)add('Passo medio',aPasso(a),'/km');
  if(a.sp==='corsa'&&a.gap)add('Passo in piano',paceS(1000/a.gap),'/km');
  if(a.sp==='nuoto'&&a.m)add('Passo medio',aPasso(a),'/100 m');
  if(a.sp==='bici'&&a.m)add('Velocità media',itN(a.m/a.sec*3.6,1),'km/h');
  if(a.vMax&&(a.sp==='bici'))add('Velocità max',itN(a.vMax*3.6,1),'km/h');
  if(a.hr)add('FC media',a.hr,'bpm');if(a.hrM)add('FC max',a.hrM,'bpm');if(d&&d.hrMin)add('FC minima',d.hrMin,'bpm');
  if(a.kcal)add('Calorie',itN(a.kcal),'kcal');
  if(a.tss!==null&&a.tss!==undefined)add('Carico',a.tss,'TSS');if(a.int)add('Intensità',Math.round(a.int),'%');if(a.trimp)add('TRIMP',Math.round(a.trimp),'');
  if(a.dplus)add('Dislivello +',itN(a.dplus),'m');if(a.dminus)add('Dislivello −',itN(a.dminus),'m');
  if(a.cad)add(a.sp==='corsa'?'Cadenza':a.sp==='nuoto'?'Bracciate':'Cadenza',a.sp==='corsa'?Math.round(a.cad*2):Math.round(a.cad),a.sp==='corsa'?'passi/min':a.sp==='nuoto'?'/min':'rpm');
  if(a.w)add('Potenza media',a.w,'W');if(a.np)add('Potenza normalizzata',a.np,'W');
  if(a.stride)add('Lunghezza passo',itN(a.stride,2),'m');if(a.gct)add('Contatto al suolo',Math.round(a.gct),'ms');if(a.vo)add('Oscillazione verticale',itN(a.vo>30?a.vo/10:a.vo,1),'cm');
  if(a.vasche)add('Vasche',a.vasche+(a.vasca?' da '+a.vasca+' m':''),'');
  if(a.kg)add('Sollevati',itN(a.kg),'kg');
  if(a.temp!==null&&a.temp!==undefined)add(a.meteo?'Temperatura':'Temp. al polso',itN(a.temp,0),'°C');
  if(s.resp){var r=s.resp.reduce(function(x,y){return x+y},0)/s.resp.length;add('Respirazione',Math.round(r),'atti/min')}
  if(a.hrr)add('Recupero FC in 1 min','−'+a.hrr,'bpm');
  if(d&&d.deriva)add(d.deriva.tipo==='dis'?'Disaccoppiamento':'Deriva FC',(d.deriva.v>0?'+':'')+itN(d.deriva.v,1),'%');
  else if(a.dec!==null&&a.dec!==undefined)add('Disaccoppiamento',itN(a.dec,1),'%');
  if(a.ef)add('Efficienza',itN(a.ef,2),'');
  if(a.rpe)add('Fatica percepita',a.rpe,'/10');
  if(a.comp)add('Rispetto al piano',Math.round(a.comp),'%');
  if(a.ctl!==null&&a.ctl!==undefined&&a.atl!==null&&a.atl!==undefined)add('Forma dopo',(a.ctl-a.atl>0?'+':'')+Math.round(a.ctl-a.atl),'');
  return L}
// Grafico con il dito: ogni punto si legge tenendo premuto
function aGrafico(o){var s=o.s,n=s.length;if(!s||n<3)return '';var vals=s.map(o.map||function(v){return v}),ok=vals.filter(function(v){return v!==null&&isFinite(v)});if(ok.length<3)return '';
  var mn=Math.min.apply(null,ok),mx=Math.max.apply(null,ok);if(o.lo!==undefined)mn=Math.max(mn,o.lo);if(o.hi!==undefined)mx=Math.min(mx,o.hi);if(mx-mn<1e-6)mx=mn+1;var pad=(mx-mn)*0.08;mn-=pad;mx+=pad;
  var W=340,H=110,inv=!!o.inv,Y=function(v){var k=(Math.max(mn,Math.min(mx,v))-mn)/(mx-mn);return (inv?k:1-k)*H};
  var pts=vals.map(function(v,i){return (i/(n-1)*W).toFixed(1)+','+(v===null||!isFinite(v)?H:Y(v)).toFixed(1)}).join(' ');
  var media=ok.reduce(function(a,b){return a+b},0)/ok.length,ym=Y(media).toFixed(1),id='g'+CHS.length;
  CHS.push({v:vals,f:o.f,sec:o.sec,Y:Y,H:H,d:o.dist||null,sp:o.sp});
  return '<div class="gch" data-k="'+(CHS.length-1)+'"><div class="gtop"><span class="t15 semi">'+escH(o.t)+'</span><span class="t13 muted gval">'+escH(o.sub||'')+'</span></div>'+
    '<div class="gbox"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" width="100%" height="'+H+'"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+o.c+'" stop-opacity=".35"/><stop offset="1" stop-color="'+o.c+'" stop-opacity="0"/></linearGradient></defs>'+
    '<polygon points="0,'+H+' '+pts+' '+W+','+H+'" fill="url(#'+id+')"/><polyline points="'+pts+'" fill="none" stroke="'+o.c+'" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>'+
    '<line x1="0" x2="'+W+'" y1="'+ym+'" y2="'+ym+'" stroke="'+o.c+'" stroke-dasharray="3 4" stroke-opacity=".7" vector-effect="non-scaling-stroke"/></svg><div class="gcur"></div><div class="gdot" style="background:'+o.c+'"></div><div class="gbub"></div>'+
    '<span class="gax gmax">'+escH(o.f(inv?mn:mx))+'</span><span class="gax gmin">'+escH(o.f(inv?mx:mn))+'</span></div>'+
    '<div class="gxs"><span>0'+"'"+'</span><span>'+aHm(o.sec/2)+'</span><span>'+aHm(o.sec)+'</span></div></div>'}
function aGrafici(a,d){if(!d||!d.s)return '';var s=d.s,out='',sec=a.sec||1,corsaLike=a.sp==='corsa'||(a.sp==='altro'&&a.m>500);
  if(s.hr)out+=aGrafico({dist:s.d,sp:a.sp,t:'Frequenza cardiaca',s:s.hr,c:'#FF453A',sec:sec,f:function(v){return Math.round(v)+' bpm'},sub:'media '+(a.hr||'—')+' · max '+(a.hrM||'—')});
  if(s.v&&a.m){if(corsaLike)out+=aGrafico({dist:s.d,sp:a.sp,t:'Passo',s:s.v,c:'#64D2FF',sec:sec,map:function(v){return v>0.6?1000/v:null},inv:true,lo:150,hi:900,f:function(v){return paceS(v)+'/km'},sub:'medio '+aPasso(a)+'/km'});
    else if(a.sp==='nuoto')out+=aGrafico({dist:s.d,sp:a.sp,t:'Passo',s:s.v,c:'#64D2FF',sec:sec,map:function(v){return v>0.2?100/v:null},inv:true,lo:60,hi:300,f:function(v){return paceS(v)+'/100'},sub:'medio '+aPasso(a)+'/100 m'});
    else out+=aGrafico({dist:s.d,sp:a.sp,t:'Velocità',s:s.v,c:'#64D2FF',sec:sec,map:function(v){return v*3.6},f:function(v){return itN(v,1)+' km/h'},sub:'media '+itN(a.m/a.sec*3.6,1)+' km/h'})}
  if(s.alt&&!a.indoor)out+=aGrafico({dist:s.d,sp:a.sp,t:'Quota',s:s.alt,c:'#30D158',sec:sec,f:function(v){return Math.round(v)+' m'},sub:a.dplus?'+'+itN(a.dplus)+' m':''});
  if(s.w)out+=aGrafico({dist:s.d,sp:a.sp,t:'Potenza',s:s.w,c:'#FFD60A',sec:sec,f:function(v){return Math.round(v)+' W'},sub:a.w?'media '+a.w+' W':''});
  if(s.cad)out+=aGrafico({dist:s.d,sp:a.sp,t:a.sp==='nuoto'?'Bracciate':'Cadenza',s:s.cad,c:'#BF5AF2',sec:sec,map:function(v){return a.sp==='corsa'?v*2:v},f:function(v){return Math.round(v)+(a.sp==='corsa'?' passi/min':a.sp==='nuoto'?'/min':' rpm')}});
  if(s.temp)out+=aGrafico({dist:s.d,sp:a.sp,t:a.meteo?'Temperatura':'Temperatura al polso',s:s.temp,c:'#FF9F0A',sec:sec,f:function(v){return itN(v,1)+' °C'}});
  if(s.resp)out+=aGrafico({dist:s.d,sp:a.sp,t:'Respirazione',s:s.resp,c:'#5E5CE6',sec:sec,f:function(v){return Math.round(v)+' atti/min'}});
  return out?'<div class="gwrap">'+out+'</div>':''}
function aZone(a){if(!a.z||!a.z.some(function(v){return v>0}))return '';var tot=a.z.reduce(function(x,y){return x+y},0),zl=a.zl||[];
  var bar=a.z.map(function(v,i){return v>0?'<div style="flex:'+v+' 1 0;background:'+ZC[i]+'"></div>':''}).join('');
  var rows=a.z.map(function(v,i){var rg=i===0?'sotto '+(zl[0]||'—'):(zl[i-1]||'—')+'–'+(zl[i]||'—');return '<div class="zrow"><span class="zdot" style="background:'+ZC[i]+'"></span><span class="t15 semi" style="width:30px">Z'+(i+1)+'</span><span class="t13 muted grow">'+rg+' bpm</span><span class="t15" style="font-variant-numeric:tabular-nums">'+aHm(v)+'</span><span class="t13 muted" style="width:44px;text-align:right">'+Math.round(v/tot*100)+'%</span></div>'}).join('');
  return '<div class="asec"><div class="t15 semi">Zone di frequenza cardiaca</div><div class="zbar">'+bar+'</div>'+rows+'</div>'}
function aPercorso(d,c){if(!d||!d.route)return '';var r=d.route,la=r.lat,lo=r.lng,mnA=Math.min.apply(null,la),mxA=Math.max.apply(null,la),mnO=Math.min.apply(null,lo),mxO=Math.max.apply(null,lo),k=Math.cos((mnA+mxA)/2*Math.PI/180);
  var w=(mxO-mnO)*k||1e-6,h=(mxA-mnA)||1e-6,W=340,H=Math.max(160,Math.min(300,W*h/w)),s=Math.min((W-24)/w,(H-24)/h),ox=(W-w*s)/2,oy=(H-h*s)/2;
  var P=la.map(function(a,i){return [(ox+(lo[i]-mnO)*k*s).toFixed(1),(oy+(mxA-a)*s).toFixed(1)]}),pts=P.map(function(p){return p.join(',')}).join(' '),a0=P[0],a1=P[P.length-1];
  return '<div class="asec"><div class="t15 semi">Percorso</div><div class="route"><svg viewBox="0 0 '+W+' '+H.toFixed(0)+'" width="100%"><polyline points="'+pts+'" fill="none" stroke="'+c+'" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="'+a0[0]+'" cy="'+a0[1]+'" r="5" fill="var(--card)" stroke="'+c+'" stroke-width="2.5"/><circle cx="'+a1[0]+'" cy="'+a1[1]+'" r="6" fill="#FF6A1A"/></svg></div><div class="t13 muted">Senza i primi e gli ultimi 250 m, così non si vede da dove parti.</div></div>'}
function aKm(d){if(!d||!d.km||!d.km.length)return '';var ps=d.km.map(function(k){return k.passo}),mn=Math.min.apply(null,ps),mx=Math.max.apply(null,ps);
  var rows=d.km.map(function(k){var w=mx>mn?30+70*(mx-k.passo)/(mx-mn):100;return '<div class="krow"><span class="t15 semi" style="width:40px">'+(k.parz?itN(k.km,2):k.km)+'</span><span class="kbar"><span style="width:'+w.toFixed(0)+'%"></span></span><span class="t15" style="width:50px;text-align:right">'+paceS(k.passo)+'</span><span class="t13 muted" style="width:62px;text-align:right;white-space:nowrap">'+(k.hr?k.hr+' bpm':'')+'</span><span class="t13 muted" style="width:38px;text-align:right">'+(k.su!==null&&k.su!==undefined?'+'+k.su:'')+'</span></div>'}).join('');
  return '<div class="asec"><div class="hstack" style="justify-content:space-between"><span class="t15 semi">Parziali al km</span><span class="t13 muted">passo · FC · D+</span></div>'+rows+'</div>'}
function aGiri(a,d){var G=d&&d.giri&&d.giri.length?d.giri:null;
  if(!G){if(!a.giri||!a.giri.length)return '';return '<div class="asec"><div class="t15 semi">Giri</div><div class="chips">'+a.giri.map(function(g){return '<span class="chip">'+escH(g)+'</span>'}).join('')+'</div></div>'}
  var corsaLike=a.sp==='corsa'||a.sp==='altro';
  var rows=G.map(function(g){var vel=g.v&&g.m?(a.sp==='bici'?itN(g.v*3.6,1)+' km/h':a.sp==='nuoto'?paceS(100/g.v)+'/100':corsaLike?paceS(1000/g.v)+'/km':''):'';
    return '<div class="lrow2'+(/RECOVERY|REST/i.test(g.tipo)?' rec':'')+'"><span class="t13 muted" style="width:22px">'+g.n+'</span><span class="t15" style="width:62px">'+aDur(g.sec)+'</span><span class="t13 muted" style="width:62px">'+(g.m?(a.sp==='nuoto'||g.m<1000?Math.round(g.m)+' m':itN(g.m/1000,2)+' km'):'')+'</span><span class="t15 grow">'+vel+'</span><span class="t13 muted" style="text-align:right">'+(g.hr?Math.round(g.hr)+' bpm':'')+(g.w?' · '+Math.round(g.w)+' W':'')+'</span></div>'}).join('');
  return '<div class="asec"><div class="t15 semi">Giri</div>'+rows+'</div>'}
function aCard(a){var d=ATT.det[a.id],S=aSport(a.sp),M=aMetriche(a,d),hero=M.slice(0,3),rest=M.slice(3);
  var head='<div class="atth"><span class="evbar" style="background:'+S.c+'"></span><div class="grow"><div class="t17 semi">'+escH(a.nome||S.label)+'</div><div class="sub">'+S.label+(a.indoor?' al chiuso':'')+' · '+a.ora+'–'+a.fine+(a.device?' · '+escH(a.device):'')+(a.gear?' · '+escH(a.gear):'')+'</div></div><button class="sharebtn" data-shatt="'+escH(a.id)+'" aria-label="Condividi"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg></button></div>';
  var heroH='<div class="ahero">'+hero.map(function(m){return '<div><div class="label caps">'+m[0]+'</div><div class="num34" style="font-size:26px">'+escH(m[1])+'<span class="unit"> '+m[2]+'</span></div></div>'}).join('')+'</div>';
  var grid=rest.length?'<div class="agrid">'+rest.map(function(m){return '<div><div class="label">'+m[0]+'</div><div class="num20">'+escH(m[1])+'<span class="unit"> '+m[2]+'</span></div></div>'}).join('')+'</div>':'';
  var piano=a.piano?'<div class="exbox"><span class="t15 semi">Piano: '+escH(a.piano.nome)+'</span><span class="t13 muted">'+(a.piano.min?aHm(a.piano.min*60)+' previsti':'')+(a.piano.tss?' · '+a.piano.tss+' TSS':'')+(a.comp?' · fatto al '+Math.round(a.comp)+'%':'')+'</span></div>':'';
  var attesa=!d&&window.__inScriptable?'<div class="t13 muted">Carico grafici, percorso e giri…</div>':'';
  return '<div class="card attc">'+head+heroH+grid+piano+attesa+aGrafici(a,d)+aZone(a)+aPercorso(d,S.c)+aKm(d)+aGiri(a,d)+'</div>'}
function attRender(){var box=document.getElementById('attbox');if(!box)return;CHS=[];
  if(!ATT.att[ATTG]&&ATTG!==ATT.oggi){var j=ATT.giorni.indexOf(ATTG);box.innerHTML='<div class="attnav"><button class="navb" id="attprev"'+(j>=ATT.giorni.length-1?' disabled':'')+'>‹</button><div style="text-align:center"><div class="t22 bold">'+aGiorno(ATTG)+'</div><div class="sub">'+GIOL[aD(ATTG).getDay()]+'</div></div><button class="navb" id="attnext"'+(j<=0?' disabled':'')+'>›</button></div><div class="card pad"><div class="t15 muted">'+(window.__inScriptable?'Carico il giorno…':'Apri l’HUD da Scriptable per vedere questo giorno.')+'</div></div>';
    document.getElementById('attprev').addEventListener('click',function(){attVai(1)});document.getElementById('attnext').addEventListener('click',function(){attVai(-1)});
    if(window.__inScriptable&&!ATTREQ['g'+ATTG]){ATTREQ['g'+ATTG]=1;hudSend('attg',ATTG)}return}
  var i=ATT.giorni.indexOf(ATTG),L=ATT.att[ATTG]||[],C=ATT.ctx[ATTG]||{};
  var tot={sec:0,kcal:0,tss:0,m:0};L.forEach(function(a){tot.sec+=a.sec||0;tot.kcal+=a.kcal||0;tot.tss+=a.tss||0;if(a.sp!=='nuoto')tot.m+=a.m||0});
  var nav='<div class="attnav"><button class="navb" id="attprev"'+(i>=ATT.giorni.length-1?' disabled':'')+' aria-label="Giorno prima">‹</button><div style="text-align:center"><div class="t22 bold">'+aGiorno(ATTG)+'</div><div class="sub">'+(/^(Oggi|Ieri)$/.test(aGiorno(ATTG))?aData(ATTG):GIOL[aD(ATTG).getDay()])+' · '+(L.length===1?'1 attività':L.length+' attività')+'</div></div><button class="navb" id="attnext"'+(i<=0?' disabled':'')+' aria-label="Giorno dopo">›</button></div>';
  var tl='';if(L.length){tl='<div class="tline">'+L.map(function(a){var h0=+a.ora.slice(0,2)+a.ora.slice(3)/60,h1=+a.fine.slice(0,2)+a.fine.slice(3)/60;if(h1<h0)h1=24;return '<span style="left:'+(h0/24*100).toFixed(2)+'%;width:'+Math.max(0.8,(h1-h0)/24*100).toFixed(2)+'%;background:'+aSport(a.sp).c+'"></span>'}).join('')+'</div><div class="tlx"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>'}
  var sum='<div class="card pad"><div class="ahero">'+[['Tempo',aHm(tot.sec),''],['Calorie',itN(tot.kcal),'kcal'],['Carico',Math.round(tot.tss),'TSS']].map(function(m){return '<div><div class="label caps">'+m[0]+'</div><div class="num34" style="font-size:28px">'+m[1]+'<span class="unit"> '+m[2]+'</span></div></div>'}).join('')+'</div>'+(tot.m?'<div class="t13 muted">'+itN(tot.m/1000,1)+' km tra corsa, bici e camminate</div>':'')+tl+'</div>';
  var cx=[['Sonno',C.sonno?aHm(C.sonno)+(C.voto?' · '+C.voto:''):null],['HRV',C.hrv?Math.round(C.hrv)+' ms':null],['FC a riposo',C.rhr?C.rhr+' bpm':null],['Peso',C.peso?itN(C.peso,1)+' kg':null],['Forma',C.ctl!==null&&C.ctl!==undefined&&C.atl!==null&&C.atl!==undefined?((C.ctl-C.atl>0?'+':'')+Math.round(C.ctl-C.atl)):null],['Mangiato',C.kcal?itN(C.kcal)+' kcal':null]].filter(function(c){return c[1]});
  var ctx=cx.length?'<h2>La giornata</h2><div class="card pad"><div class="agrid">'+cx.map(function(c){return '<div><div class="label">'+c[0]+'</div><div class="num20">'+c[1]+'</div></div>'}).join('')+'</div>'+(C.lungo&&C.lungo.carbo>=0?'<div class="t13 muted">Lungo segnato: '+C.lungo.carbo+' g di carboidrati, stomaco '+escH(C.lungo.stomaco||'—')+'</div>':'')+'</div>':'';
  var cards=L.length?'<h2>'+(L.length===1?'L’attività':'Le attività')+'</h2>'+L.slice().reverse().map(aCard).join(''):'<div class="card pad"><div class="t17 semi">Nessuna attività</div><div class="t15 muted">'+(ATTG===ATT.oggi?'Quando l’orologio sincronizza una seduta con Intervals, la trovi qui con tutti i dati.':'In questo giorno non c’è niente di registrato.')+'</div></div>';
  box.innerHTML=nav+sum+ctx+cards;
  var p=document.getElementById('attprev'),n=document.getElementById('attnext');
  if(p)p.addEventListener('click',function(){attVai(1)});if(n)n.addEventListener('click',function(){attVai(-1)});
  var manca=L.filter(function(a){return !ATT.det[a.id]&&!ATTREQ[a.id]}).map(function(a){return a.id});
  if(manca.length&&window.__inScriptable){manca.forEach(function(id){ATTREQ[id]=1});hudSend('att',manca.join(','))}}
function attVai(k){var i=ATT.giorni.indexOf(ATTG)+k;if(i<0||i>=ATT.giorni.length)return;ATTG=ATT.giorni[i];try{localStorage.setItem('hud_att',JSON.stringify({ts:Date.now(),g:ATTG}))}catch(e){}attRender();window.scrollTo(0,0)}
// ---- Attrezzatura: aggiungi, modifica, metti in pensione, togli
function gearForm(id){var L=(DIARY.gear||[]).map(function(x){return Object.assign({},x)}),g=null;L.forEach(function(x){if(x.id===id)g=x});var nuova=!g;
  g=g||{id:'g'+Date.now().toString(36),tipo:'scarpe',nome:'',dal:TODAY,per:'tutto',kmIniziali:0,limite:700};
  var inp='font:inherit;font-size:17px;color:var(--fg);background:var(--fill);border:0;border-radius:10px;padding:9px 10px;width:100%;box-sizing:border-box';
  function campo(l,id,t,v,ph){return '<label class="vstack" style="gap:6px"><span class="label">'+l+'</span><input id="'+id+'" type="'+t+'" value="'+escH(v===null||v===undefined?'':v)+'" placeholder="'+escH(ph||'')+'"'+(t==='number'?' inputmode="numeric"':'')+' style="'+inp+'"></label>'}
  var pers=[['strada','Strada'],['trail','Trail'],['tapis','Tapis'],['tutto','Tutte']];
  var html='<div class="vstack" style="gap:14px"><div class="seg seg2" id="gtipo"><button data-t="scarpe"'+(g.tipo==='scarpe'?' class="on"':'')+'>Scarpe</button><button data-t="bici"'+(g.tipo==='bici'?' class="on"':'')+'>Bici</button></div>'+
    campo('Nome','gnome','text',g.nome,'Es. Pegasus 41')+campo('In uso dal','gdal','date',g.dal||'')+campo('Km già fatti prima','gkm','number',g.kmIniziali||0)+campo('Da cambiare a (km, 0 = mai)','glim','number',g.limite||0)+
    '<div id="gperbox" class="vstack" style="gap:6px"><span class="label">Per quali corse</span><div class="seg seg4" id="gper">'+pers.map(function(p){return '<button data-p="'+p[0]+'"'+(g.per===p[0]?' class="on"':'')+'>'+p[1]+'</button>'}).join('')+'</div></div>'+
    '<button class="pillbtn" id="gsalva" style="padding:12px">Salva</button>'+(nuova?'':'<button class="secondary" id="gritira">'+(g.ritirata?'Rimetti in uso':'Metti in pensione')+'</button><button class="secondary" id="gtogli" style="color:var(--bad)">Togli</button>')+'</div>';
  openP(nuova?'Nuova attrezzatura':g.nome,html);
  function tipo(t){g.tipo=t;document.getElementById('gperbox').style.display=t==='scarpe'?'':'none';var li=document.getElementById('glim');if(nuova&&li)li.value=t==='scarpe'?700:0}
  seg('gtipo','data-t',function(t){tipo(t)});seg('gper','data-p',function(p){g.per=p});tipo(g.tipo);if(!nuova)document.getElementById('glim').value=g.limite||0;
  function invia(lista,msg){DIARY.gear=lista;if(!hudSend('gear',JSON.stringify(lista)))toast(msg||'Salvato qui: apri da Scriptable per contarle');chiudiFoglio(document.getElementById('psheet'))}
  document.getElementById('gsalva').addEventListener('click',function(){var n=document.getElementById('gnome').value.trim();if(!n){toast('Dai un nome');return}
    var dal=document.getElementById('gdal').value||null,cambia=nuova||dal!==g.dal||g.per!==(L.filter(function(x){return x.id===g.id})[0]||{}).per;
    g.nome=n;g.dal=dal;g.kmIniziali=+document.getElementById('gkm').value||0;g.limite=+document.getElementById('glim').value||0;if(g.tipo==='bici')g.per='tutto';if(cambia)g.reset=true;
    if(nuova)L.push(g);invia(L)});
  var r=document.getElementById('gritira');if(r)r.addEventListener('click',function(){g.ritirata=g.ritirata?null:TODAY;invia(L)});
  var t=document.getElementById('gtogli');if(t)t.addEventListener('click',function(){if(!t.getAttribute('data-ok')){t.setAttribute('data-ok','1');t.textContent='Tocca ancora per togliere';return}invia(L.filter(function(x){return x.id!==g.id}))})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-gear]');if(b){gearForm(b.getAttribute('data-gear'));return}if(e.target.closest&&e.target.closest('#gearadd'))gearForm(null)});
window.__giornoAtt=function(o){ATT.att[o.g]=o.att;ATT.ctx[o.g]=o.ctx;for(var id in o.det)ATT.det[id]=o.det[id];if(o.g===ATTG)attRender()};
window.__dettagli=function(o){var y=window.scrollY,cambia=false;for(var id in o){ATT.det[id]=o[id];(ATT.att[ATTG]||[]).forEach(function(a){if(String(a.id)===String(id))cambia=true})}if(cambia&&CUR.v==='att'){attRender();window.scrollTo(0,y)}else if(cambia)attRender()};
// ---- Grafici: tieni premuto (o scorri di lato) e leggi il punto sotto il dito; la pagina resta ferma
window.SCRFN=window.SCRFN||{};
(function(){var T=null,act=null,x0=0,y0=0,el0=null,hov=null;
  function tgt(n){return n&&n.closest?n.closest('.gch,.scr'):null}
  function sotto(bub,yf){var basso=yf!==null&&yf!==undefined&&yf<0.42;bub.style.top=basso?'auto':'0';bub.style.bottom=basso?'0':'auto'}
  function piazza(bub,box,xf){var w=box.clientWidth,bw=bub.offsetWidth;bub.style.left=Math.max(0,Math.min(w-bw,xf*w-bw/2))+'px'}
  function mostra(g,xf,yf,l,v,c){var cur=g.querySelector('.gcur'),dot=g.querySelector('.gdot'),bub=g.querySelector('.gbub');
    cur.style.left=(xf*100)+'%';cur.style.opacity=1;
    if(yf!==null&&yf!==undefined){dot.style.left=(xf*100)+'%';dot.style.top=(yf*100)+'%';dot.style.opacity=1;if(c)dot.style.background=c}else dot.style.opacity=0;
    bub.innerHTML='<b>'+escH(v)+'</b><span>'+escH(l)+'</span>';bub.style.opacity=1;sotto(bub,yf);piazza(bub,g,xf)}
  function leggiAtt(g,cx,on){var card=g.closest('.attc')||g.parentNode,c0=CHS[+g.getAttribute('data-k')];if(!c0)return;
    var box=g.querySelector('.gbox'),bx=box.getBoundingClientRect(),k=Math.max(0,Math.min(1,(cx-bx.left)/bx.width));
    card.querySelectorAll('.gch').forEach(function(h){var c=CHS[+h.getAttribute('data-k')];if(!c)return;var cur=h.querySelector('.gcur'),dot=h.querySelector('.gdot'),lab=h.querySelector('.gval');
      if(!on){cur.style.opacity=0;dot.style.opacity=0;if(lab.getAttribute('data-o')!==null)lab.textContent=lab.getAttribute('data-o');return}
      var v=c.v[Math.round(k*(c.v.length-1))];cur.style.left=(k*100)+'%';cur.style.opacity=1;
      if(v!==null&&isFinite(v)){dot.style.left=(k*100)+'%';dot.style.top=(c.Y(v)/c.H*100)+'%';dot.style.opacity=1}else dot.style.opacity=0;
      if(lab.getAttribute('data-o')===null)lab.setAttribute('data-o',lab.textContent);lab.textContent=v===null||!isFinite(v)?'—':c.f(v)});
    var bub=g.querySelector('.gbub');if(!on){bub.style.opacity=0;return}
    var v0=c0.v[Math.round(k*(c0.v.length-1))],dd=c0.d&&c0.d.length?c0.d[Math.round(k*(c0.d.length-1))]:null;
    bub.innerHTML='<b>'+(v0===null||!isFinite(v0)?'—':escH(c0.f(v0)))+'</b><span>'+aHm(k*c0.sec)+(dd?' · '+(c0.sp==='nuoto'||dd<1000?Math.round(dd)+' m':itN(dd/1000,2)+' km'):'')+'</span>';bub.style.opacity=1;
    sotto(bub,v0!==null&&isFinite(v0)?c0.Y(v0)/c0.H:null);piazza(bub,box,k)}
  function leggi(g,cx){if(g.classList.contains('gch')){leggiAtt(g,cx,true);return}
    var f=g.getAttribute('data-scrfn');if(f){if(SCRFN[f])SCRFN[f](cx,true);return}
    var P=g.__p||(g.__p=JSON.parse(g.getAttribute('data-pts')||'[]'));if(!P.length)return;
    var r=g.getBoundingClientRect(),k=(cx-r.left)/r.width,b=0;for(var i=1;i<P.length;i++)if(Math.abs(P[i][0]-k)<Math.abs(P[b][0]-k))b=i;
    var p=P[b];mostra(g,p[0],p[1],p[2],p[3],p[4])}
  function spegni(g){if(!g)return;if(g.classList.contains('gch')){leggiAtt(g,0,false);return}var f=g.getAttribute('data-scrfn');if(f){if(SCRFN[f])SCRFN[f](0,false);return}
    ['.gcur','.gdot','.gbub'].forEach(function(s){var e=g.querySelector(s);if(e)e.style.opacity=0})}
  function attiva(g,cx){act=g;document.body.classList.add('scrubbing');leggi(g,cx)}
  function fine(){clearTimeout(T);T=null;el0=null;if(act){spegni(act);act=null;document.body.classList.remove('scrubbing')}}
  document.addEventListener('touchstart',function(e){if(e.touches.length!==1){fine();return}var g=tgt(e.target);if(!g)return;var t=e.touches[0];x0=t.clientX;y0=t.clientY;el0=g;clearTimeout(T);T=setTimeout(function(){T=null;if(el0)attiva(el0,x0)},170)},{passive:true});
  document.addEventListener('touchmove',function(e){var t=e.touches[0];if(act){if(e.cancelable)e.preventDefault();leggi(act,t.clientX);return}if(!el0)return;
    var dx=Math.abs(t.clientX-x0),dy=Math.abs(t.clientY-y0);
    if(dx>7&&dx>dy*1.2){clearTimeout(T);T=null;if(e.cancelable)e.preventDefault();attiva(el0,t.clientX);return}
    if(dy>7){clearTimeout(T);T=null;el0=null}},{passive:false});
  document.addEventListener('touchend',fine);document.addEventListener('touchcancel',fine);
  document.addEventListener('mousemove',function(e){var g=tgt(e.target);if(g!==hov){spegni(hov);hov=g}if(g)leggi(g,e.clientX)});
  window.__scrubAttivo=function(){return !!act}})();
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-shatt]');if(b){OPT.act=b.getAttribute('data-shatt');OPT.rec=null;setLayout('attivita');openSheet();return}
  var r=e.target.closest&&e.target.closest('[data-shrec]');if(r){OPT.rec=r.getAttribute('data-shrec');setLayout('attivita');openSheet()}});
attRender();

// I dati dell'attività da condividere (quella scelta, sennò l'ultima del giorno aperto)
function SHArec(){var r=null;(REC&&REC.lista||[]).forEach(function(x){if(x.k===OPT.rec)r=x});if(!r)return null;
  var D=r.d?aD(r.d):aD(ATT.oggi),corsa=r.sp==='corsa',det=r.id?ATT.det[r.id]:null,L=[{l:'PASSO',v:paceS(r.passo),u:corsa?'/KM':'/100M'}];
  if(r.meglio)L.push({l:'MEGLIO DI',v:'−'+durS(r.meglio),u:''});if(r.prec)L.push({l:'PRIMA',v:durS(r.prec),u:''});
  L.push({l:'DATA',v:r.d?D.getDate()+' '+MESI3[D.getMonth()]:'—',u:''});
  return{confronto:r.prec?[['PRIMA',r.prec],['ORA',r.sec]]:null,id:r.id,sp:r.sp,nome:'Record · '+r.nome,data:r.d||ATT.oggi,ora:'',sec:r.sec,m:r.d,hero:{l:'RECORD '+r.nome.toUpperCase(),v:durS(r.sec),u:''},lista:L,route:det&&det.route||null,hrS:null,altS:null,imp:null,gara:ATT.gara&&ATT.gara.giorni>=0?ATT.gara:null,device:''}}
function SHAweek(k){var S=SETT[k||0];if(!S)return null;var hm=function(s){var m=Math.round(s/60);return Math.floor(m/60)+'h'+('0'+m%60).slice(-2)},L=[],P2=S.per,d0=aD(S.da),d1=aD(S.a);
  if(P2.corsa.m)L.push({l:'CORSA',v:itN(P2.corsa.m/1000,1),u:'KM'});
  if(P2.bici.sec)L.push(P2.bici.m>1000?{l:'BICI',v:itN(P2.bici.m/1000,0),u:'KM'}:{l:'BICI',v:hm(P2.bici.sec),u:''});
  if(P2.nuoto.m)L.push({l:'NUOTO',v:itN(P2.nuoto.m),u:'M'});
  if(P2.forza.sec)L.push({l:'PALESTRA',v:hm(P2.forza.sec),u:''});
  L.push({l:'CARICO',v:String(S.tss),u:'TSS'});L.push({l:'SEDUTE',v:String(S.n),u:''});if(S.sonno)L.push({l:'SONNO MEDIO',v:hm(S.sonno),u:''});
  var split=[['NUOTO',P2.nuoto.sec],['BICI',P2.bici.sec],['CORSA',P2.corsa.sec],['PALESTRA',P2.forza.sec]].filter(function(q){return q[1]>0});
  return{sp:'altro',etichetta:'SETTIMANA '+S.iso,parola:'SETTIMANA',nome:(k?'Settimana scorsa':'Questa settimana')+' · '+d0.getDate()+'–'+d1.getDate()+' '+MESL[d1.getMonth()],data:S.a,ora:'',sec:S.sec,hero:{l:'ALLENAMENTO',v:hm(S.sec).toUpperCase(),u:''},lista:L,barre:S.giorni,split:split,route:null,hrS:null,altS:null,imp:null,gara:ATT.gara&&ATT.gara.giorni>=0?ATT.gara:null,device:''}}
function SHA(){if(OPT.layout==='riepilogo')return SHAweek(OPT.week||0);if(OPT.rec){var rr=SHArec();if(rr)return rr}var id=OPT.act,a=null,g;
  if(id)for(g in ATT.att)(ATT.att[g]||[]).forEach(function(x){if(String(x.id)===String(id))a=x});
  if(!a){var gs=[ATTG].concat(ATT.giorni);for(var i=0;i<gs.length&&!a;i++){var L=(ATT.att[gs[i]]||[]).slice().reverse();a=L.filter(function(x){return x.sp!=='altro'})[0]||L[0]||null}}
  if(!a)return null;var d=ATT.det[a.id]||{},s=d.s||{};
  function red(v,n){if(!v)return null;if(v.length<=n)return v;var o=[];for(var i=0;i<n;i++)o.push(v[Math.floor(i*v.length/n)]);return o}
  return{id:a.id,sp:a.sp,nome:a.nome||aSport(a.sp).label,data:a.data,ora:a.ora,sec:a.sec,m:a.m||0,hr:a.hr,hrM:a.hrM,hrMin:d.hrMin,kcal:a.kcal,tss:a.tss,dplus:a.dplus,cad:a.cad,w:a.w,temp:a.temp,z:a.z,indoor:a.indoor,device:a.device,kg:a.kg,vasche:a.vasche,route:d.route||null,hrS:red(s.hr,160),altS:red(s.alt,160),imp:a.imp?{plan:a.imp,done:a.imp}:null,gara:ATT.gara&&ATT.gara.giorni>=0?ATT.gara:null}}
// Scelte nel foglio Condividi: quale attività
(function(){
  window.attChips=function(){var A=SHA(),box=document.getElementById('attsel');if(!A){box.innerHTML='';return}
    if(OPT.layout==='riepilogo'){box.innerHTML=[0,1].map(function(k){return '<button data-w="'+k+'"'+((OPT.week||0)===k?' class="on"':'')+'>'+(k?'Settimana scorsa':'Questa settimana')+'</button>'}).join('');
      box.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){OPT.week=+b.getAttribute('data-w');attChips();refresh()})});document.getElementById('attday').textContent='Riepilogo';return}
    if(OPT.rec){box.innerHTML=(REC.lista||[]).map(function(r){return '<button data-r="'+r.k+'"'+(r.k===OPT.rec?' class="on"':'')+'>'+escH(r.nome+' · '+durS(r.sec))+'</button>'}).join('');
      box.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){OPT.rec=b.getAttribute('data-r');attChips();refresh()})});document.getElementById('attday').textContent='Record';return}
    var L=ATT.att[A.data]||[];
    box.innerHTML=L.map(function(a){return '<button data-a="'+escH(a.id)+'"'+(String(a.id)===String(A.id)?' class="on"':'')+'>'+escH(a.ora+' · '+(a.nome||aSport(a.sp).label))+'</button>'}).join('');
    box.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){OPT.act=b.getAttribute('data-a');OPT.rec=null;attChips();refresh()})});
    document.getElementById('attday').textContent=aData(A.data)};
})();

// ---- GIF animata (encoder senza librerie: palette fissa, LZW, trasparenza)
function lzwEncode(px,mcs){var clear=1<<mcs,eoi=clear+1,cs=mcs+1,next=eoi+1,dict=new Map(),out=[],cur=0,bits=0;
  function emit(c){cur|=c<<bits;bits+=cs;while(bits>=8){out.push(cur&255);cur>>>=8;bits-=8}}
  emit(clear);var pre=px[0];
  for(var i=1;i<px.length;i++){var k=px[i],key=pre*256+k,v=dict.get(key);
    if(v!==undefined){pre=v;continue}
    emit(pre);
    if(next<4096){dict.set(key,next);next++;if(next>(1<<cs)&&cs<12)cs++}
    else{emit(clear);dict.clear();next=eoi+1;cs=mcs+1}
    pre=k}
  emit(pre);emit(eoi);if(bits>0)out.push(cur&255);return out}
function gifBytes(frames,w,h,pal,delay){var b=[];function s(str){for(var i=0;i<str.length;i++)b.push(str.charCodeAt(i))}function u16(v){b.push(v&255,(v>>8)&255)}
  s('GIF89a');u16(w);u16(h);b.push(0xF3,0,0);for(var i=0;i<16;i++){var c=pal[i]||[0,0,0];b.push(c[0],c[1],c[2])}
  b.push(0x21,0xFF,11);s('NETSCAPE2.0');b.push(3,1,0,0,0);
  frames.forEach(function(px){b.push(0x21,0xF9,4,0x09);u16(delay);b.push(0,0);b.push(0x2C);u16(0);u16(0);u16(w);u16(h);b.push(0);b.push(4);
    var data=lzwEncode(px,4);for(var i=0;i<data.length;i+=255){var n=Math.min(255,data.length-i);b.push(n);for(var j=0;j<n;j++)b.push(data[i+j])}b.push(0)});
  b.push(0x3B);return new Uint8Array(b)}
function hex(c){return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]}
function gifPalette(){var P=pal(),base=[P.fg,P.mut,P.line,ACC].map(hex),pal0=[[0,0,0]].concat(base);
  if(P.bg){var bg=hex(P.bg);pal0.push(bg);[0,1,2,3].forEach(function(k){[0.33,0.66].forEach(function(t){var c=base[k];pal0.push([Math.round(bg[0]+(c[0]-bg[0])*t),Math.round(bg[1]+(c[1]-bg[1])*t),Math.round(bg[2]+(c[2]-bg[2])*t)])})})}
  while(pal0.length<16)pal0.push([0,0,0]);return pal0.slice(0,16)}
function makeGif(onProgress,done){var W=1080,H=1920,N=36,pal=gifPalette(),frames=[],cache=new Map(),sm=document.createElement('canvas');sm.width=W;sm.height=H;var sx=sm.getContext('2d');
  function quant(id){var d=id.data,out=new Uint8Array(W*H);for(var i=0,p=0;p<out.length;p++,i+=4){if(d[i+3]<128){out[p]=0;continue}var key=(d[i]<<16)|(d[i+1]<<8)|d[i+2],v=cache.get(key);
    if(v===undefined){var best=1,bd=1e9;for(var k=1;k<pal.length;k++){var c=pal[k],dd=(c[0]-d[i])*(c[0]-d[i])+(c[1]-d[i+1])*(c[1]-d[i+1])+(c[2]-d[i+2])*(c[2]-d[i+2]);if(dd<bd){bd=dd;best=k}}v=best;cache.set(key,v)}out[p]=v}return out}
  var f=0;(function step(){var t0=Date.now();while(f<N&&Date.now()-t0<60){sx.clearRect(0,0,W,H);sx.drawImage(drawRecap(Math.min(1,f/27)),0,0,W,H);frames.push(quant(sx.getImageData(0,0,W,H)));f++}
    onProgress(f/N);if(f<N)setTimeout(step,0);else done(gifBytes(frames,W,H,pal,6))})()}
function b64(u8){var s='',CH=0x8000;for(var i=0;i<u8.length;i+=CH)s+=String.fromCharCode.apply(null,u8.subarray(i,i+CH));return btoa(s)}
var ANIM=null;function animStop(){if(ANIM){cancelAnimationFrame(ANIM);ANIM=null}}
function animStart(){animStop();var cv=document.getElementById('recanim'),cx=cv.getContext('2d'),last=0;cv.width=1080;cv.height=1920;(function loop(ts){ANIM=requestAnimationFrame(loop);if(ts-last<60)return;last=ts;var t=Math.min(1,(ts%4200)/3000);cx.clearRect(0,0,1080,1920);cx.drawImage(drawRecap(t),0,0)})(0)}
document.getElementById('dogif')?.addEventListener('click',function(){var b=this;if(b.disabled)return;b.disabled=true;var lbl=b.textContent;
  makeGif(function(p){b.textContent='Creo la GIF… '+Math.round(p*100)+'%'},function(bytes){b.textContent=lbl;b.disabled=false;
    if(window.__inScriptable){window.__q.push('gif:'+b64(bytes));return}
    var blob=new Blob([bytes],{type:'image/gif'}),name='HUD-'+OPT.layout+'-'+RECAP.file+'.gif';
    try{var f=new File([blob],name,{type:'image/gif'});if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f]}).catch(function(){});return}}catch(e){}
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();toast('GIF salvata')})});
window.__q=window.__q||[];
// ---- foto sotto e video per la storia (MP4 1080×1920)
var BG=null;
function clearBg(){if(BG&&BG.videoWidth){try{BG.pause()}catch(e){}if(BG.__url)URL.revokeObjectURL(BG.__url)}BG=null}
window.__setBg=function(src){clearBg();if(!src){refresh();return}var im=new Image();im.onload=function(){BG=im;refresh()};im.src=src};
function setBgVideo(file){clearBg();var v=document.createElement('video');v.muted=true;v.playsInline=true;v.setAttribute('playsinline','');v.loop=true;v.preload='auto';v.__url=URL.createObjectURL(file);
  v.onloadeddata=function(){BG=v;v.play().catch(function(){});refresh()};v.onerror=function(){toast('Video non leggibile')};v.src=v.__url;v.load()}
function pickBg(){document.getElementById('bgfile').click()}
document.getElementById('dophoto')?.addEventListener('click',function(){if(BG){window.__setBg(null);return}pickBg()});
document.getElementById('bgfile')?.addEventListener('change',function(){var f=this.files&&this.files[0];this.value='';if(!f)return;
  if((f.type||'').indexOf('video')===0){setBgVideo(f);return}var r=new FileReader();r.onload=function(){window.__setBg(r.result)};r.readAsDataURL(f)});
function videoType(){if(typeof MediaRecorder==='undefined'||!MediaRecorder.isTypeSupported)return null;
  var ts=['video/mp4;codecs=avc1.640028','video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'];for(var i=0;i<ts.length;i++)if(MediaRecorder.isTypeSupported(ts[i]))return ts[i];return null}
function makeVideo(onProgress,done,fail){var DUR=4500,cv=document.getElementById('recanim'),cx=cv.getContext('2d'),mt=videoType();
  if(!mt||!cv.captureStream)return fail();
  if(OPT.style==='foto'&&BG&&BG.videoWidth){DUR=Math.max(4500,Math.min(15000,(BG.duration||6)*1000));try{BG.currentTime=0;BG.play()}catch(e){}}
  animStop();cv.width=1080;cv.height=1920;cx.drawImage(drawRecap(0),0,0);
  var rec,chunks=[];try{rec=new MediaRecorder(cv.captureStream(30),{mimeType:mt,videoBitsPerSecond:6000000})}catch(e){animStart();return fail()}
  rec.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data)};
  rec.onstop=function(){animStart();done(new Blob(chunks,{type:mt.split(';')[0]}),mt.indexOf('mp4')>=0?'mp4':'webm')};
  rec.start(500);var t0=performance.now();
  (function loop(){var e=performance.now()-t0;cx.clearRect(0,0,1080,1920);cx.drawImage(drawRecap(Math.min(1,e/3000)),0,0);onProgress(Math.min(1,e/DUR));
    if(e<DUR)requestAnimationFrame(loop);else setTimeout(function(){rec.stop()},120)})()}
document.getElementById('dovid').addEventListener('click',function(){var b=this;if(b.disabled)return;
  if(OPT.style==='trasparente'){toast('Per il video scegli Scuro, Chiaro o Sulla foto');return}
  if(OPT.style==='foto'&&!BG){toast('Scegli prima una foto o un video');pickBg();return}
  b.disabled=true;var lbl=b.textContent;
  makeVideo(function(p){b.textContent='Registro il video… '+Math.round(p*100)+'%'},function(blob,ext){b.textContent='Preparo il file…';
    blob.arrayBuffer().then(function(buf){b.textContent=lbl;b.disabled=false;var bytes=new Uint8Array(buf);
      if(window.__inScriptable){window.__q.push(ext+':'+b64(bytes));return}
      var name='HUD-'+OPT.layout+'-'+RECAP.file+'.'+ext;
      try{var f=new File([blob],name,{type:blob.type});if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f]}).catch(function(){});return}}catch(e){}
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();toast('Video salvato')})},
  function(){b.textContent=lbl;b.disabled=false;
    toast('Video non disponibile su questo dispositivo')})});
var DIARY=${JSON.stringify(A.diary || {}).replace(/</g, "\\u003c")},TODAY='${ymd(d)}';
try{var ls=JSON.parse(localStorage.getItem('hud_diary')||'null');if(ls&&!window.__inScriptable){DIARY.checkins=Object.assign({},DIARY.checkins||{},ls.checkins||{});DIARY.adapt=Object.assign({},DIARY.adapt||{},ls.adapt||{})}}catch(e){}
(function(){var b=document.getElementById('pesook');if(!b)return;b.addEventListener('click',function(){var v=parseFloat(String(document.getElementById('pesoin').value).replace(',','.'));
  if(!(v>40&&v<200)){toast('Scrivi il peso in kg, per esempio 88,6');return}DIARY.pesi=DIARY.pesi||{};DIARY.pesi[TODAY]=Math.round(v*10)/10;
  if(!hudSend('peso',JSON.stringify(DIARY)))toast('Funziona nell’app su iPhone');else{b.disabled=true;b.textContent='…'}})})();
(function(){var c=document.getElementById('lungo');if(!c)return;var st=c.getAttribute('data-st')||'';
  c.querySelectorAll('.stbtns .ck').forEach(function(b){b.addEventListener('click',function(){st=b.getAttribute('data-v');c.querySelectorAll('.stbtns .ck').forEach(function(z){z.classList.toggle('on',z===b)})})});
  document.getElementById('lungook').addEventListener('click',function(){var b=this,n=function(id){var v=parseFloat(String(document.getElementById(id).value).replace(',','.'));return isNaN(v)?null:v};
    var carbo=n('lcarb'),pre=n('lpre'),post=n('lpost'),bev=n('lbev');
    if(carbo===null||carbo<0||carbo>500){toast('Scrivi i grammi di carboidrati presi');return}
    if(!st){toast('Com’è andato lo stomaco?');return}
    if((pre===null)!==(post===null)||(pre!==null&&(pre<40||pre>200||post<40||post>200||pre-post<-1||pre-post>4))){toast('Peso prima e dopo: tutti e due, in kg');return}
    DIARY.lunghi=DIARY.lunghi||{};DIARY.lunghi[TODAY]={sport:c.getAttribute('data-sport'),min:+c.getAttribute('data-min'),T:+c.getAttribute('data-t'),carbo:carbo,stomaco:st,pre:pre,post:post,bevuto:bev||0};
    if(!hudSend('lungo',JSON.stringify(DIARY)))toast('Funziona nell’app su iPhone');else{b.disabled=true;b.textContent='…'}})})();
(function(){var b=document.getElementById('cibook');if(!b)return;var inp=document.getElementById('ciboin');
  function segna(){var t=String(inp.value||'').trim();if(t.length<3){toast('Scrivi cosa hai mangiato');return}if(!hudSend('cibo',t))toast('Funziona nell’app su iPhone');else{b.disabled=true;b.textContent='…'}}
  b.addEventListener('click',segna);inp.addEventListener('keydown',function(e){if(e.key==='Enter')segna()});
  document.querySelectorAll('[data-cdel]').forEach(function(x){x.addEventListener('click',function(){if(!hudSend('cibodel',x.getAttribute('data-cdel')))toast('Funziona nell’app su iPhone');else x.disabled=true})})})();
function saveDiary(){hudSend('save',JSON.stringify(DIARY));try{localStorage.setItem('hud_diary',JSON.stringify(DIARY))}catch(e){}}
function ckMostra(){var c=(DIARY.checkins||{})[TODAY]||{};document.querySelectorAll('#pbody .ckbtns').forEach(function(g){var k=g.getAttribute('data-k');g.querySelectorAll('.ck').forEach(function(z){z.classList.toggle('on',+z.getAttribute('data-v')===c[k])})})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.ckbtns .ck');if(!b)return;var g=b.parentNode,k=g.getAttribute('data-k');
  DIARY.checkins=DIARY.checkins||{};var c=DIARY.checkins[TODAY]||{};c[k]=+b.getAttribute('data-v');DIARY.checkins[TODAY]=c;
  g.querySelectorAll('.ck').forEach(function(z){z.classList.toggle('on',z===b)});
  var n=['g','e','u'].filter(function(q){return c[q]}).length,st=document.querySelectorAll('#ckstate');st.forEach(function(x){x.textContent=n===3?'Check-in di oggi salvato':'Ancora '+(3-n)+' da segnare'});
  var r=document.getElementById('ckrow');if(r)r.textContent=n===3?'Fatto':n+' di 3';
  if(n===3){saveDiary();toast('Check-in salvato');setTimeout(closeP,500)}});
(function(){var b=document.getElementById('acceptAdapt');if(!b)return;b.addEventListener('click',function(){DIARY.adapt=DIARY.adapt||{};DIARY.adapt[TODAY]=1;saveDiary();b.className='secondary';b.disabled=true;b.textContent='✓ Accettata · ricordati di aggiornare Intervals';toast('Proposta accettata')})})();
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-goto]');if(!b)return;e.preventDefault();if(foglioAperto())closeP();vai(b.getAttribute('data-goto'));var sb=b.getAttribute('data-sub');if(sb)subVai(sb)});
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-shlay]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(document.getElementById('psheet').classList.contains('on'))closeP();OPT.rec=null;setLayout(b.getAttribute('data-shlay'));openSheet()});
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-domani]');if(b){e.preventDefault();window.__domani()}});
// dopo un salvataggio la pagina si ricarica: torna dov'eri (solo se è appena successo, e mai sulla configurazione)
(function(){try{var s=JSON.parse(localStorage.getItem('hud_nav')||'null');if(s&&Date.now()-s.ts<20000&&s.cur&&s.cur.v!=='setup'&&!document.body.classList.contains('first')&&document.getElementById(s.cur.v)){NAV=(s.nav||[]).filter(function(x){return x.v!=='setup'});CUR=s.cur;showView(CUR.v,CUR.t);aggiornaBack();var y=s.y||0;requestAnimationFrame(function(){window.scrollTo(0,y)})}}catch(e){}})();
// swipe dal bordo sinistro: la pagina segue il dito e, rilasciata oltre un terzo, torna a quella di prima
(function(){var w=document.querySelector('.wrap'),on=false,x0=0,y0=0,dx=0,t0=0,dec=false;
  document.addEventListener('touchstart',function(e){if(e.touches.length!==1||foglioAperto()||!NAV.length||document.body.classList.contains('first'))return;var t=e.touches[0];if(t.clientX>24)return;on=true;dec=false;x0=t.clientX;y0=t.clientY;dx=0;t0=Date.now();w.style.transition='none'},{passive:true});
  document.addEventListener('touchmove',function(e){if(!on)return;var t=e.touches[0],mx=t.clientX-x0,my=Math.abs(t.clientY-y0);
    if(!dec){if(Math.abs(mx)<8&&my<8)return;dec=true;if(my>Math.abs(mx)||mx<0){on=false;w.style.transform='';return}}
    e.preventDefault();dx=Math.max(0,mx);w.style.transform='translateX('+dx+'px)';w.style.opacity=String(1-Math.min(.35,dx/innerWidth*.5))},{passive:false});
  var fine=function(){if(!on)return;on=false;var v=dx/Math.max(1,Date.now()-t0);w.style.transition='transform .2s ease-out,opacity .2s ease-out';
    if(dx>innerWidth*.33||(v>.45&&dx>40)){w.style.transform='translateX('+innerWidth+'px)';w.style.opacity='0';setTimeout(function(){indietro();w.style.transition='none';w.style.transform='translateX(-40px)';w.style.opacity='0';requestAnimationFrame(function(){requestAnimationFrame(function(){w.style.transition='transform .22s ease-out,opacity .22s ease-out';w.style.transform='';w.style.opacity=''})})},190)}
    else{w.style.transform='';w.style.opacity=''}};
  document.addEventListener('touchend',fine);document.addEventListener('touchcancel',fine)})();
// fogli (dettagli, spiegazioni, condividi): si chiudono trascinandoli giù o toccando fuori
document.querySelectorAll('.sheet').forEach(function(s){var bx=s.querySelector('.sheetbox'),on=false,y0=0,dy=0,t0=0;
  bx.addEventListener('touchstart',function(e){if(e.touches.length!==1||bx.scrollTop>0)return;var tg=e.target;if(tg.closest&&tg.closest('input,canvas,textarea,.chiprow'))return;on=true;y0=e.touches[0].clientY;dy=0;t0=Date.now();bx.style.transition='none'},{passive:true});
  bx.addEventListener('touchmove',function(e){if(!on)return;dy=e.touches[0].clientY-y0;if(dy<=0||bx.scrollTop>0){if(dy<-6||bx.scrollTop>0){on=false;bx.style.transform=''}return}e.preventDefault();bx.style.transform='translateY('+dy+'px)'},{passive:false});
  var fine=function(){if(!on)return;on=false;var v=dy/Math.max(1,Date.now()-t0);bx.style.transition='transform .22s ease-out';
    if(dy>110||(v>.6&&dy>30)){bx.style.transform='translateY(100%)';setTimeout(function(){chiudiFoglio(s)},200)}else bx.style.transform=''};
  bx.addEventListener('touchend',fine);bx.addEventListener('touchcancel',fine);
  s.addEventListener('click',function(e){if(e.target===s)chiudiFoglio(s)})});


function toast(msg){var t=document.getElementById('toast');t.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#30D158" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>'+msg;t.classList.add('on');clearTimeout(window.__tt);window.__tt=setTimeout(function(){t.classList.remove('on')},2200)}
window.__toast=toast;
// ---- Messaggi verso Scriptable (configurazione, piano, commenti)
function hudSend(kind,payload){if(window.__inScriptable){if(typeof salvaNav==='function')salvaNav();window.__q.push(kind+':'+payload);return true}return false}
function planBusy(on){document.querySelectorAll('[data-act^="plan:"]').forEach(function(b){if(on){if(!b.getAttribute('data-l'))b.setAttribute('data-l',b.textContent);b.disabled=true;b.textContent=b.getAttribute('data-act')==='plan:scrivi'?'Scrivo nel calendario…':'Preparo il piano…'}else{b.disabled=false;if(b.getAttribute('data-l'))b.textContent=b.getAttribute('data-l')}})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-act]');if(!b||b.disabled)return;var a=b.getAttribute('data-act'),i=a.indexOf(':');
  if(!hudSend(a.slice(0,i),a.slice(i+1))){toast('Funziona nell’app su iPhone');return}
  if(a.indexOf('plan:')===0)planBusy(true)});
(function(){var sb=document.getElementById('setbtn');if(sb)sb.addEventListener('click',function(){vai('setup','Impostazioni')})})();
(function(){
  var root=document.querySelector('.setup');if(!root||!document.getElementById('f-salva'))return;
  function segVal(id){var b=document.querySelector('#'+id+' button.on');return b?b.getAttribute('data-v'):null}
  function sports(){return Array.prototype.filter.call(document.querySelectorAll('#f-sport button'),function(b){return b.classList.contains('on')}).map(function(b){return b.getAttribute('data-v')})}
  var ESEMPI={'bici+corsa+nuoto':'Es. Triathlon del lago',corsa:'Es. Mezza di primavera',bici:'Es. Granfondo delle colline',nuoto:'Es. Traversata del lago','bici+corsa':'Es. Duathlon di città','corsa+nuoto':'Es. Aquathlon del porto'};
  function gruppo(){var k=sports().slice().sort().join('+');return document.querySelector('#f-gtipo .seg[data-k="'+k+'"]')}
  function upd(){var sp=sports(),k=sp.slice().sort().join('+'),gr=gruppo(),conGara=!!gr;
    document.getElementById('f-biciw').style.display=sp.indexOf('bici')>=0?'':'none';
    document.getElementById('f-piscw').style.display=sp.indexOf('nuoto')>=0?'':'none';
    document.querySelectorAll('#f-gtipo .seg').forEach(function(x){x.style.display=x===gr?'':'none'});
    document.getElementById('f-nogara').style.display=sp.length&&!conGara?'':'none';
    document.getElementById('f-garasi').style.display=conGara||!sp.length?'':'none';
    document.getElementById('f-gara').style.display=conGara&&segVal('f-garaon')==='1'?'':'none';
    document.getElementById('f-gnome').placeholder=ESEMPI[k]||'Nome della gara';
    var pal=segVal('f-cosa')==='pal';
    document.getElementById('f-palw').style.display=pal||segVal('f-pal')==='1'?'':'none';
    ['f-spw','f-biciw','f-piscw'].forEach(function(id){if(pal)document.getElementById(id).style.display='none'});
    document.getElementById('f-palsi').style.display=pal?'none':'';document.getElementById('f-palminw').style.display=pal?'':'none';document.getElementById('f-garaw').style.display=pal?'none':'';
    document.getElementById('f-cosa-pal').style.display=pal?'':'none';document.getElementById('f-sph').textContent=pal?'La palestra':'I tuoi sport';
    var mio=segVal('f-piano')==='mio',sb=document.getElementById('f-salva');
    document.getElementById('f-tempow').style.display=mio||pal?'none':'';document.getElementById('f-piano-app').style.display=mio?'none':'';document.getElementById('f-piano-mio').style.display=mio?'':'none';
    if(sb.getAttribute('data-first')==='1')sb.textContent=mio?'Inizia':'Crea il mio piano'}
  root.querySelectorAll('.seg').forEach(function(g){g.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){g.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)});upd()})})});
  root.querySelectorAll('.days7,.sport3').forEach(function(g){g.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){b.classList.toggle('on');b.setAttribute('aria-pressed',b.classList.contains('on')?'true':'false');upd()})})});
  upd();
  function days(id){return Array.prototype.map.call(document.querySelectorAll('#'+id+' button'),function(b){return b.classList.contains('on')})}
  function idx(id){var o=[];days(id).forEach(function(v,i){if(v)o.push(i)});return o}
  function n(id){var v=parseFloat(String(document.getElementById(id).value).replace(',','.'));return isFinite(v)?v:null}
  document.getElementById('f-salva').addEventListener('click',function(){
    var err=document.getElementById('f-err'),b=this;err.textContent='';
    var g=days('f-giorni'),gara=null,sp=sports(),gr=gruppo();
    var pal=segVal('f-cosa')==='pal';
    if(!pal&&!sp.length){err.textContent='Scegli almeno uno sport.';return}
    if(!pal&&gr&&segVal('f-garaon')==='1'){var dt=document.getElementById('f-gdata').value;
      if(!dt){err.textContent='Manca la data della gara.';return}
      if(dt<=TODAY){err.textContent='La data della gara è già passata: scegline una futura o tocca "Voglio migliorare".';return}
      var tb=gr.querySelector('button.on')||gr.querySelector('button');
      gara={nome:document.getElementById('f-gnome').value.trim()||'La mia gara',tipo:tb.getAttribute('data-v'),data:dt}}
    var mio=segVal('f-piano')==='mio';
    if(!mio&&!pal&&g.filter(Boolean).length<3){err.textContent='Scegli almeno tre giorni in cui puoi allenarti.';return}
    if(pal&&!idx('f-palg').length){err.textContent='Scegli almeno un giorno per la palestra.';return}
    var P={nome:document.getElementById('f-nome').value.trim(),sport:pal?[]:sp,gara:pal?null:gara,soloPalestra:pal,attrezzi:segVal('f-attr')||'manubri',palMin:+(segVal('f-palmin')||45),giorni:g,ore:+segVal('f-ore')||8,giornoLungo:+(segVal('f-lungo')||6),
      piscina:!pal&&sp.indexOf('nuoto')>=0,piscinaGiorni:idx('f-piscg'),bici:!pal&&sp.indexOf('bici')>=0?(segVal('f-bici')||'strada'):'no',palestra:pal||segVal('f-pal')==='1',palestraGiorni:idx('f-palg'),
      corpo:{sesso:segVal('f-sesso'),anno:n('f-anno'),altezza:n('f-alt'),peso:n('f-peso'),pesoObiettivo:n('f-pob'),grasso:n('f-grasso')},pianoApp:!mio};
    if(P.corpo.grasso!==null&&(P.corpo.grasso<3||P.corpo.grasso>60)){err.textContent='La % di grasso va da 3 a 60: correggila o lasciala vuota.';return}
    if(P.piscina&&!P.piscinaGiorni.length){err.textContent='Scegli almeno un giorno per la piscina.';return}
    if(!mio&&P.palestra&&!P.palestraGiorni.length){err.textContent='Scegli almeno un giorno per la palestra.';return}
    if(!hudSend('setup',JSON.stringify(P))){toast('Funziona nell’app su iPhone');return}
    b.disabled=true;b.textContent='Salvo…'});
})();
var GL=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],SPC={nuoto:'#0A84FF',bici:'#FF453A',corsa:'#FFD60A',forza:'#30D158'},FASE={base:'Base',costruzione:'Costruzione',picco:'Picco',gara:'Gara',recupero:'Recupero'};
function art(a,s){var d=+s.split('-')[2],el=d===1||d===8||d===11;return (el?(a==='Dal'?'Dall’':'all’'):a+' ')+lab(s)}
function hm(m){return m>=60?Math.floor(m/60)+'h'+String(m%60).padStart(2,'0'):m+"'"}
function escH(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
window.__planPreview=function(p){planBusy(false);
  if(p.palestra){var AT={libero:'a corpo libero',elastico:'con l’elastico',manubri:'con manubri e kettlebell',palestra:'in palestra'},hp='<div class="pv"><p>'+art('Dal',p.inizio)+' '+art('al',p.fine)+'. '+p.palestra.n+(p.palestra.n===1?' seduta':' sedute')+' a settimana da '+hm(p.palestra.min)+', '+(AT[p.palestra.attrezzi]||'')+': tre schede che si alternano (gambe e glutei, parte alta e core, tutto il corpo). La quarta settimana è più leggera.</p>';
    p.settimane.forEach(function(w){var ss=w.sedute.slice().sort(function(a,b){return a.g-b.g});hp+='<div class="pvw"><div class="pvh"><span>Settimana '+w.n+(w.scarico?' · più leggera':'')+'</span><span>'+hm(w.minuti)+'</span></div>';
      ss.forEach(function(s){hp+='<div class="pvr"><span class="muted">'+GL[s.g]+'</span><span class="dot" style="background:#30D158"></span><span>'+escH(s.nome)+'</span><span class="muted">'+hm(s.min)+'</span></div>'});hp+='</div>'});
    hp+='<p class="q">Ogni seduta ha gli esercizi con le foto e i video: tocca la seduta nell’app. Carichi che lasciano 2 ripetizioni di riserva.</p><div class="pvbtn"><button class="secondary" type="button" onclick="closeP()">Annulla</button><button class="primary" type="button" data-act="plan:scrivi">Scrivi nel calendario</button></div></div>';
    openP('Il tuo piano',hp);return}
  var L=p.livello||{},sp=p.sport||['nuoto','bici','corsa'],ha=function(x){return sp.indexOf(x)>=0},
    lg=ha('corsa')&&L.lungo?' e un lungo di corsa tipico di '+L.lungo+' minuti':!ha('corsa')&&ha('bici')&&L.lungoBici?' e un lungo in bici tipico di '+hm(L.lungoBici):'',
    h='<div class="pv"><p>'+art('Dal',p.inizio)+' '+art('al',p.fine)+'. Parto da fitness '+(L.ctl||0)+(lg?', ':' e ')+String(L.ore||0).replace('.',',')+' ore a settimana nell’ultimo mese'+lg+'.'+(L.rientro?' Hai corso poco di recente, quindi il lungo riparte basso.':'')+'</p>';
  if(p.conflitti)h+='<div class="icard"><b>Hai già '+(p.conflitti===1?'una seduta':p.conflitti+' sedute')+' in queste settimane</b><span>Le lascio dove sono e aggiungo le mie. Se non ti servono più, cancellale da Intervals.</span></div>';
  (p.avvisi||[]).slice(0,3).forEach(function(a){h+='<div class="icard"><span>'+escH(a)+'</span></div>'});
  p.settimane.forEach(function(w){var ss=w.sedute.slice().sort(function(a,b){return a.g-b.g});
    h+='<div class="pvw"><div class="pvh"><span>Settimana '+w.n+' · '+(FASE[w.fase]||w.fase)+(w.scarico?' · scarico':'')+'</span><span>'+hm(w.minuti)+'</span></div>';
    ss.forEach(function(s,i){h+='<div class="pvr"><span class="muted">'+(i&&ss[i-1].g===s.g?'':GL[s.g])+'</span><span class="dot" style="background:'+(SPC[s.sport]||'#8E8E93')+'"></span><span class="'+(s.q?'q':'')+'">'+escH(s.nome)+'</span><span class="muted">'+hm(s.min)+'</span></div>'});
    h+='</div>'});
  var reg=[ha('corsa')?'la corsa si regola su passo e battiti':'',ha('bici')?(ha('corsa')?'la bici su watt o battiti':'la bici si regola su watt o battiti'):'',ha('nuoto')?(ha('corsa')||ha('bici')?'il nuoto sul tuo passo soglia':'il nuoto si regola sul tuo passo soglia'):''].filter(Boolean).join(', ');
  h+='<p class="q">'+reg.charAt(0).toUpperCase()+reg.slice(1)+'. Dal calendario di Intervals le sedute possono arrivare anche sull’orologio, se lo hai attivato nelle impostazioni di Intervals.</p>';
  h+='<div class="pvbtn"><button class="secondary" type="button" onclick="closeP()">Annulla</button><button class="primary" type="button" data-act="plan:scrivi">Scrivi nel calendario</button></div></div>';
  openP('Il tuo piano',h)};
window.__avvisa=function(){openP('Ultimo passo','<p>Avvisa chi ti ha dato l’app che sei pronto: con un tocco gli mando il tuo nome su Intervals, così ti aggiunge al gruppo dei tester.</p><p class="q">Poi su Intervals ti arriva un invito: tocca Accetta. Serve a migliorare il piano guardando come va su di te.</p><div class="pvbtn"><button class="secondary" type="button" onclick="closeP()">Più tardi</button><button class="primary" type="button" data-act="avvisa:piano">Avvisa</button></div>')};
window.__planError=function(msg){planBusy(false);openP('Piano non scritto','<p>'+escH(msg)+'</p><p class="q">Riprova tra poco. Se continua, manda un commento dalle Impostazioni.</p>')};
window.__setupError=function(msg){var b=document.getElementById('f-salva');if(b){b.disabled=false;b.textContent='Riprova'}var e=document.getElementById('f-err');if(e)e.textContent=msg};
function native(kind,url){if(!window.__inScriptable)return false;window.__q.push(kind+':'+url.split(',')[1]);return true}
document.getElementById('docopy').addEventListener('click',function(){
  var cv=drawRecap(),url=cv.toDataURL('image/png');
  if(native('copy',url))return;
  cv.toBlob(function(bl){
    try{if(navigator.clipboard&&window.ClipboardItem){navigator.clipboard.write([new ClipboardItem({'image/png':bl})]).then(function(){toast('Immagine copiata')},function(){toast('Tieni premuto l’immagine › Copia')});return}}catch(e){}
    toast('Tieni premuto l’immagine › Copia')},'image/png')});
document.getElementById('dosh').addEventListener('click',function(){
  var cv=drawRecap(),url=cv.toDataURL('image/png');
  if(native('share',url))return;
  cv.toBlob(function(bl){try{var f=new File([bl],'HUD-'+RECAP.file+'.png',{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f]}).catch(function(){});return}}catch(e){}
    var a=document.createElement('a');a.href=url;a.download='HUD-'+RECAP.file+'.png';document.body.appendChild(a);a.click();a.remove()},'image/png')});

</script></body></html>`;
}

// ------------------------------------------------------------
//  Widget per la Home
// ------------------------------------------------------------
function buildAccessory(A, fam) {
  const w = new ListWidget();
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  const main = A.todayEv.slice().sort((a, b) => (b.load || 0) - (a.load || 0) || b.min - a.min)[0];
  const ad = A.ins.adapt && !A.ins.adapt.accepted ? A.ins.adapt.items[0] : null;
  if (fam === "accessoryInline") {
    w.addText(`${STATE_WORD[A.worst]} · ${ad ? ad.prop : main ? main.name : A.gymToday ? "Palestra" : "riposo"}`);
  } else if (fam === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const v = A.sleep.readiness !== null ? String(A.sleep.readiness) : signed(A.metrics.tsb);
    const t1 = w.addText(v); t1.font = Font.boldSystemFont(20); t1.centerAlignText(); t1.minimumScaleFactor = 0.6;
    const t2 = w.addText({ verde: "pronto", giallo: "cautela", rosso: "riposo" }[A.worst]); t2.font = Font.systemFont(10); t2.centerAlignText();
  } else {
    const t1 = w.addText(STATE_WORD[A.worst]); t1.font = Font.boldSystemFont(15);
    const t2 = w.addText(ad ? "Proposta: " + ad.prop : main ? `${main.name} · ${fmtMin(main.min)}` : A.gymToday ? "Palestra" : "Nessuna seduta");
    t2.font = Font.systemFont(12); t2.lineLimit = 2;
    const t3 = w.addText(`Forma ${signed(A.metrics.tsb)} · HRV ${A.metrics.hrv ?? "—"}`); t3.font = Font.systemFont(11); t3.textOpacity = 0.7;
  }
  return w;
}

// ---- Widget nella direzione C: chiaro e scuro automatici, impronta a capsule
const dyn = (l, d, a) => (typeof Color.dynamic === "function" ? Color.dynamic(new Color(l, a === undefined ? 1 : a), new Color(d, a === undefined ? 1 : a)) : new Color(d, a === undefined ? 1 : a));
const WC = {
  bg: () => dyn("#FFFFFF", "#1C1C1E"), tile: () => dyn("#F2F2F7", "#2C2C2E"), fg: () => dyn("#1D1D1F", "#F5F5F7"),
  mut: () => dyn("#6E6E73", "#A1A1A6"), line: () => dyn("#C7C7CC", "#48484A"), acc: () => new Color(IMP_ACC),
  verde: () => dyn("#1F8F4E", "#30D158"), giallo: () => dyn("#C26A00", "#FF9F0A"), rosso: () => dyn("#D70015", "#FF453A"),
};
function wText(st, s, size, weight, col, opts = {}) {
  const t = st.addText(String(s));
  const F = { bold: Font.boldSystemFont, semi: Font.semiboldSystemFont, med: Font.mediumSystemFont, reg: Font.systemFont,
    num: Font.boldRoundedSystemFont, numsemi: Font.semiboldRoundedSystemFont }[weight || "reg"];
  t.font = F(size); t.textColor = col || WC.fg(); t.lineLimit = opts.lines || 1;
  t.minimumScaleFactor = opts.scale || 0.75;
  if (opts.right) t.rightAlignText(); if (opts.center) t.centerAlignText();
  return t;
}
function formaZone(t) { return t === null || t === undefined ? "—" : t > 25 ? "Transizione" : t > 5 ? "Fresco" : t > -10 ? "Zona grigia" : t > -30 ? "Ottimale" : "Rischio alto"; }
function hm(sec) { return sec ? `${Math.floor(sec / 3600)}h${pad(Math.round((sec % 3600) / 60))}` : "—"; }
// Impronta fatta di stack: pieno se svolta (arancio sopra soglia), contorno se da fare
function wImp(parent, I, width, height, n) {
  const N = n || I.plan.length, step = width / N, cw = Math.max(2, Math.round(step * 0.6));
  const plan = n ? impSample(I.plan.map((l) => ({ sec: 1, l })), N) : I.plan;
  const done = I.done ? (n ? impSample(I.done.map((l) => ({ sec: 1, l })), N) : I.done) : null;
  const row = parent.addStack(); row.size = new Size(width, height); row.bottomAlignContent(); row.spacing = 0;
  for (let i = 0; i < N; i++) {
    const col = row.addStack(); col.size = new Size(step, height); col.layoutVertically(); col.addSpacer();
    const d = done ? done[i] : 0, p = plan[i];
    const h = Math.max(cw, Math.round((d || p) * height));
    const c = col.addStack(); c.size = new Size(cw, h); c.cornerRadius = cw / 2;
    if (d > 0) c.backgroundColor = d >= IMP_TH ? WC.acc() : WC.fg();
    else if (p > 0) { c.borderColor = WC.line(); c.borderWidth = 1; }
  }
  return row;
}
function wMeter(parent, v, width) {
  const tr = parent.addStack(); tr.size = new Size(width, 6); tr.cornerRadius = 3; tr.backgroundColor = WC.tile();
  const f = tr.addStack(); f.size = new Size(Math.max(6, width * Math.min(1, v / 100)), 6); f.cornerRadius = 3; f.backgroundColor = WC.fg();
  tr.addSpacer();
}
function wTile(parent, label, value, sub, subCol, width) {
  const t = parent.addStack(); t.layoutVertically(); t.backgroundColor = WC.tile(); t.cornerRadius = 12; t.setPadding(6, 9, 6, 6);
  if (width) t.size = new Size(width, 0);
  wText(t, label, 9, "semi", WC.mut());
  wText(t, value, 17, "num", WC.fg(), { scale: 0.6 });
  if (sub) wText(t, sub, 9, "med", subCol || WC.mut(), { scale: 0.7 });
  return t;
}
function wDelta(v, ref, invert) {
  if (v === null || v === undefined || ref === null || ref === undefined) return [null, null];
  const d = Math.round(v - ref); if (d === 0) return ["= media", WC.mut()];
  const good = invert ? d < 0 : d > 0;
  return [`${d > 0 ? "+" : "−"}${Math.abs(d)} sulla media`, good ? WC.verde() : WC.giallo()];
}
function wTodayImp(A) {
  const e = mainOf(A.todayEv); if (!e) return null;
  const I = impronta(e);
  const ad = A.ins && A.ins.adapt && !A.ins.adapt.accepted ? A.ins.adapt.items.find((x) => x.name === e.name) : null;
  if (ad && !I.done) I.plan = impAdapt(I.plan, ad);
  return { e, I, ad };
}

function buildWidget(A) {
  if (String(config.widgetFamily || "").startsWith("accessory")) return buildAccessory(A, config.widgetFamily);
  const fam = config.widgetFamily || "large";
  const w = new ListWidget();
  w.backgroundColor = WC.bg();
  w.setPadding(14, 14, 14, 14);
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  const M = A.metrics, rd = A.sleep.readiness, word = STATE_WORD[A.worst] + ".", wcol = WC[A.worst]();
  const T = wTodayImp(A);
  const race = A.raceDays !== null && A.raceDays !== undefined && A.raceDays >= 0 ? A.raceDays : null;
  const [hrvS, hrvC] = wDelta(M.hrv, M.hrvMean, false);
  const [rhrS, rhrC] = wDelta(M.rhr, M.rhrMean, true);
  const head = (parent, size, stacked) => {
    const h = parent.addStack(); h.bottomAlignContent(); if (stacked) h.layoutVertically();
    if (rd !== null && rd !== undefined) { wText(h, rd, size, "num"); if (!stacked) h.addSpacer(6); }
    wText(h, word, rd !== null && rd !== undefined ? size * (stacked ? 0.4 : 0.42) : size * 0.55, "bold", wcol, { scale: 0.6 });
    return h;
  };
  const todayLine = (parent, size) => {
    if (!T) { wText(parent, A.gymToday ? `Palestra · ${A.gymToday}` : "Giorno di riposo", size, "semi", WC.mut(), { lines: 2 }); return; }
    const r = parent.addStack(); r.centerAlignContent();
    wText(r, T.e.name || (SPORT[T.e.sport] || SPORT.altro).label, size, "semi", WC.fg(), { scale: 0.8 });
    r.addSpacer(4);
    wText(r, T.I.done ? `${T.I.pct}%` : fmtMin(T.e.min), size, "numsemi", T.I.done ? WC.acc() : WC.mut());
  };

  if (fam === "small") {
    head(w, 40);
    if (rd !== null && rd !== undefined) { w.addSpacer(4); wMeter(w, rd, 142); }
    w.addSpacer();
    if (T) { todayLine(w, 11); w.addSpacer(4); wImp(w, T.I, 142, 26, 17); }
    else todayLine(w, 12);
    w.addSpacer();
    const bot = w.addStack(); bot.centerAlignContent();
    const mini = (lab, val) => { const s = bot.addStack(); s.layoutVertically(); wText(s, val, 13, "num"); wText(s, lab, 8.5, "semi", WC.mut()); };
    mini("SONNO", hm(A.sleep.secs)); bot.addSpacer();
    mini("HRV", M.hrv ?? "—"); bot.addSpacer();
    mini("FORMA", signed(M.tsb));
    return w;
  }

  if (fam === "medium") {
    const row = w.addStack(); row.topAlignContent();
    const left = row.addStack(); left.layoutVertically(); left.size = new Size(116, 142);
    head(left, 46, true);
    if (rd !== null && rd !== undefined) { left.addSpacer(6); wMeter(left, rd, 116); }
    left.addSpacer();
    wText(left, race !== null ? `${race} giorni al via` : formaZone(M.tsb), 10, "semi", WC.mut());
    row.addSpacer(14);
    const right = row.addStack(); right.layoutVertically(); right.size = new Size(206, 142);
    const h = right.addStack(); h.centerAlignContent();
    wText(h, T && T.I.done ? "OGGI · RIEMPITA" : T && T.ad ? "OGGI · ADATTATA" : "OGGI", 9, "semi", T && T.ad ? WC.giallo() : WC.mut()); h.addSpacer();
    if (A.nutrition) wText(h, `${Math.round(A.nutrition.kcal / 10) * 10} kcal`, 9, "semi", WC.mut());
    right.addSpacer(4);
    todayLine(right, 13);
    if (T) { right.addSpacer(5); wImp(right, T.I, 206, 34, 26); }
    right.addSpacer();
    const tiles = right.addStack(); tiles.spacing = 6;
    wTile(tiles, "SONNO", hm(A.sleep.secs), null, null, 64);
    wTile(tiles, "HRV", M.hrv ?? "—", null, null, 64);
    wTile(tiles, "FORMA", signed(M.tsb), null, null, 66);
    return w;
  }

  // ---- grande
  const top = w.addStack(); top.centerAlignContent();
  wText(top, `${GIORNI[A.now.getDay()].toUpperCase()} ${A.now.getDate()}`, 10, "semi", WC.mut());
  top.addSpacer();
  if (race !== null) wText(top, `${race} giorni · ${CONFIG.obiettivo.nome}`, 10, "semi", WC.mut());
  w.addSpacer(4);
  head(w, 46);
  if (rd !== null && rd !== undefined) { w.addSpacer(5); wMeter(w, rd, 336); }
  w.addSpacer(5);
  wText(w, A.verdict, 11, "reg", WC.mut(), { lines: 2, scale: 0.85 });
  w.addSpacer();
  const tiles = w.addStack(); tiles.spacing = 6;
  wTile(tiles, "SONNO", hm(A.sleep.secs), A.sleep.score ? `punteggio ${A.sleep.score}` : null, null, 79);
  wTile(tiles, "HRV", M.hrv ?? "—", hrvS, hrvC, 79);
  wTile(tiles, "FC RIPOSO", M.rhr ?? "—", rhrS, rhrC, 79);
  wTile(tiles, "FORMA", signed(M.tsb), formaZone(M.tsb).toLowerCase(), null, 79);
  w.addSpacer();
  const oh = w.addStack(); oh.centerAlignContent();
  wText(oh, T && T.I.done ? "IMPRONTA DI OGGI · RIEMPITA" : T && T.ad ? "IMPRONTA DI OGGI · ADATTATA" : "IMPRONTA DI OGGI", 9, "semi", T && T.ad ? WC.giallo() : WC.mut()); oh.addSpacer();
  if (A.nutrition) wText(oh, `${Math.round(A.nutrition.kcal / 10) * 10} kcal · ${A.nutrition.carbo} g carbo`, 9, "semi", WC.mut());
  w.addSpacer(3);
  todayLine(w, 13);
  if (T) { w.addSpacer(4); wImp(w, T.I, 336, 34, 34); }
  w.addSpacer();
  // settimana: una capsula per giorno, piena se fatta, contorno se da fare
  const wk = A.weeks[0];
  const wh = w.addStack(); wh.centerAlignContent();
  wText(wh, "SETTIMANA", 9, "semi", WC.mut()); wh.addSpacer();
  wText(wh, `${hm(wk.doneSec)} di ${hm(wk.plannedSec)}`, 9, "semi", WC.mut());
  w.addSpacer(4);
  const strip = w.addStack(); strip.bottomAlignContent();
  const mins = wk.days.map((D) => D.evs.reduce((t, e) => t + e.min, 0));
  const maxMin = Math.max(60, ...mins);
  wk.days.forEach((D, i) => {
    if (i) strip.addSpacer();
    const c = strip.addStack(); c.layoutVertically(); c.size = new Size(36, 0);
    const bx = c.addStack(); bx.size = new Size(36, 30); bx.bottomAlignContent(); bx.addSpacer();
    const allDone = D.evs.length && D.evs.every((e) => e.done);
    const hard = D.evs.some((e) => isQualityEv(e));
    const cap = bx.addStack(); cap.size = new Size(10, mins[i] ? Math.max(10, Math.round((mins[i] / maxMin) * 30)) : 4); cap.cornerRadius = 5;
    if (!mins[i]) cap.backgroundColor = WC.line();
    else if (allDone || (D.isPast && D.evs.some((e) => e.done))) cap.backgroundColor = hard ? WC.acc() : WC.fg();
    else { cap.borderColor = D.isToday ? WC.acc() : WC.line(); cap.borderWidth = 1.2; }
    bx.addSpacer();
    c.addSpacer(3);
    const l = c.addStack(); l.addSpacer();
    wText(l, D.isToday ? "Oggi" : GG[D.date.getDay()].slice(0, 1), 9, D.isToday ? "bold" : "semi", D.isToday ? WC.acc() : WC.mut());
    l.addSpacer();
  });
  return w;
}

// ------------------------------------------------------------
//  Avvio
// ------------------------------------------------------------
function cacheIO() {
  const fm = FileManager.local();
  const p = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
  return {
    read: () => (fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null),
    write: (o) => fm.writeString(p, JSON.stringify(o)),
  };
}

// Ponte tra la pagina e iOS: condivisione, diario, configurazione, piano, commenti
// Ascolta i pulsanti della pagina. La pagina mette i messaggi in coda (window.__q) e qui si leggono ogni 250 ms:
// una chiamata con callback lasciata in sospeso, come prima, su iOS 26 lascia la WebView nera.
const attesa = (ms) => new Promise((r) => Timer.schedule(ms, false, r));
async function shareLoop(wv, ctx) {
  ctx = ctx || {};
  const js = (code) => wv.evaluateJavaScript(code, false).catch(() => {});
  const ricarica = async (msgToast) => {
    const A = analyze(ctx.raw, ctx.now, ctx.key ? diaryIO().read() : ctx.raw.diary);
    await wv.loadHTML(buildHTML(A), "https://intervals.icu");
    await js("window.__inScriptable=true");
    if (msgToast) await js(`window.__toast(${JSON.stringify(msgToast)})`);
  };
  await attesa(600); // prima lascia disegnare la pagina
  for (;;) {
    if (ctx.chiusa && ctx.chiusa()) return;
    let msg;
    try { msg = await wv.evaluateJavaScript("(window.__q && window.__q.length) ? window.__q.shift() : ''", false); } catch (e) { return; }
    if (!msg) { await attesa(250); continue; }
    const i = msg.indexOf(":");
    const kind = msg.slice(0, i), b64 = msg.slice(i + 1);
    if (kind === "save") {
      try { diaryIO().write(JSON.parse(b64)); } catch (e) { console.log("Diario non salvato: " + e); }
      continue;
    }
    if (kind.startsWith("salute")) {
      // infortunio o malattia: salva, applica o annulla le sedute adattate, rientro, guarito
      try {
        const dia = diaryIO().read(), oggi = ymd(new Date());
        let msg = null, riapri = true;
        if (kind === "salute") {
          const o = JSON.parse(b64), S0 = saluteDi(dia);
          const S = { tipo: o.tipo === "malattia" ? "malattia" : "infortunio", dal: /^\d{4}-\d\d-\d\d$/.test(o.dal || "") && o.dal <= oggi ? o.dal : oggi, aggiornato: new Date().toISOString() };
          if (S.tipo === "infortunio") { S.zona = ZONE_INF[o.zona] ? o.zona : "altro"; S.dolore = Math.max(0, Math.min(10, Math.round(+o.dolore || 0))); S.riposo = !!o.riposo; }
          else { S.sintomi = o.sintomi === "sotto" ? "sotto" : "sopra"; S.febbre = !!o.febbre; }
          // stesso episodio: le sedute già cambiate restano tracciate (si possono rimettere)
          if (S0 && S0.tipo === S.tipo) { S.modifiche = S0.modifiche || []; if (S0.applicata) S.applicata = S0.applicata; if (S0.passati && S.tipo === "malattia") S.passati = S0.passati; }
          dia.salute = S; msg = "Salvato";
        } else if (kind === "saluteMeglio") {
          if (dia.salute && !dia.salute.guarito) { dia.salute.passati = oggi; delete dia.salute.applicata; msg = "Rientro graduale"; }
        } else if (kind === "saluteFine") {
          if (dia.salute) { dia.salute.guarito = oggi; dia.saluteStoria = [...(dia.saluteStoria || []), { ...dia.salute, modifiche: undefined }].slice(-20); delete dia.salute; }
          msg = "Bentornato: piano normale"; riapri = false;
        } else if (kind === "saluteApplica" || kind === "saluteAnnulla") {
          if (!ctx.key || ctx.raw.stale) msg = "Serve internet per cambiare le sedute";
          else if (kind === "saluteAnnulla") { const n = await annullaSalute(ctx.key, ctx.raw, dia); msg = `Rimesse ${n} sedute com'erano`; }
          else {
            const A0 = analyze(ctx.raw, ctx.now, dia), K = A0.salute;
            const n = K && K.puoApplicare && K.proposta.length ? await applicaSalute(ctx.key, K, K.proposta, ctx.raw, dia) : 0;
            msg = n ? `Sedute adattate su Intervals: ${n}` : "Nessuna seduta cambiata";
          }
          try { cacheIO().write(ctx.raw); } catch (e) {}
        }
        diaryIO().write(dia);
        await ricarica(msg);
        if (riapri) await js("window.__salute && window.__salute()");
      } catch (e) { console.log("Salute: " + e); await js(`window.__toast(${JSON.stringify("Non riuscito: " + (e.message || e))})`); }
      continue;
    }
    if (kind === "apri") {
      // solo le ricerche dei video degli esercizi su YouTube
      if (/^https:\/\/www\.youtube\.com\/results\?search_query=[^\s]{1,200}$/.test(b64)) { try { Safari.open(b64); } catch (e) {} }
      continue;
    }
    if (kind === "gymPiano") {
      try {
        if (!ctx.key || ctx.raw.stale) throw new Error("serve internet");
        if (ctx.raw.demo || (PROF && PROF.pianoApp === false)) throw new Error("con il tuo piano l'app non scrive su Intervals");
        const r = await palestraNelPiano(ctx.key, JSON.parse(b64), ctx.raw);
        try { cacheIO().write(ctx.raw); } catch (e) {}
        const q = parseYMD(r.data);
        await ricarica(`${r.nuovo ? "Aggiunta" : "Aggiornata"} su Intervals: ${GIORNI[q.getDay()].toLowerCase()} ${q.getDate()}`);
      } catch (e) { console.log("Palestra nel piano: " + e); await js(`window.__toast(${JSON.stringify("Non aggiunta: " + (e.message || e))})`); await js("var b=document.getElementById('gp-ok');if(b){b.disabled=false;b.textContent='Aggiungi a Intervals'}"); }
      continue;
    }
    if (kind === "campana" || kind === "domani") {
      // campana aperta: tutto letto; foglio di domani visto: stasera non si ripropone
      try {
        const io = campanaIO(), C = io.read(), t = new Date();
        if (kind === "campana") campanaSegnaLette(C, t);
        else {
          // visto nell'app: la notifica di stasera non serve più
          C.domaniVisto = ymd(t); campanaSegnaLette(C, t, (x) => x.tipo === "domani");
          C.lista = C.lista.filter((x) => !(x.tipo === "domani" && new Date(x.t) > t));
          try { await Notification.removePending([`domani-${ymd(t)}`]); } catch (e) {}
        }
        io.write(C); CAMPANA = C;
      } catch (e) { console.log("Campana: " + e); }
      continue;
    }
    if (kind === "cibo") {
      try {
        const dia = diaryIO().read(), r = registraCibo(dia, b64, new Date());
        if (r.voce) { diaryIO().write(dia); await ricarica(`Segnato · ${fmtIt(totaleCibo([r.voce]).kcal)} kcal`); }
        else { await js(`window.__toast(${JSON.stringify("Non ho riconosciuto cibi")})`); await js("var b=document.getElementById('cibook');if(b){b.disabled=false;b.textContent='Segna'}"); }
      } catch (e) { console.log("Cibo non salvato: " + e); }
      continue;
    }
    if (kind === "attg") {
      // la scheda Attività chiede un giorno che non era nella pagina
      try {
        const D = datiAttivita(ctx.raw, diaryIO().read(), ctx.now, DETTAGLI, [b64]);
        await js(`window.__giornoAtt && window.__giornoAtt(${JSON.stringify({ g: b64, att: D.att[b64] || [], ctx: D.ctx[b64] || {}, det: D.det })})`);
      } catch (e) { console.log("Giorno non caricato: " + e); }
      continue;
    }
    if (kind === "att") {
      // la scheda Attività chiede grafici, percorso e giri: dal file, sennò da Intervals
      try {
        const ids = b64.split(",").filter(Boolean), acts = (ctx.raw.activities || []).filter((a) => ids.includes(String(a.id)));
        if (ctx.key && !ctx.raw.stale) { const n = await scaricaDettagli(ctx.key, acts, DETTAGLI); if (n) { potaDettagli(DETTAGLI, ctx.raw, ctx.now); dettagliIO().write(DETTAGLI); registro(`dettagli di ${n} attività`); } }
        const out = {}; for (const a of acts) out[a.id] = DETTAGLI[a.id] || { v: DET_VER, id: a.id, s: {}, vuoto: true };
        await js(`window.__dettagli && window.__dettagli(${JSON.stringify(out)})`);
      } catch (e) { console.log("Dettagli non scaricati: " + e); }
      continue;
    }
    if (kind === "cibodel") {
      try {
        const dia = diaryIO().read(), g = ymd(new Date());
        if (dia.cibo && dia.cibo[g]) dia.cibo[g] = dia.cibo[g].filter((e) => e.id !== b64);
        diaryIO().write(dia); await ricarica("Tolto");
      } catch (e) { console.log("Cibo non tolto: " + e); }
      continue;
    }
    if (kind === "lungo") {
      // lungo segnato: stomaco e sudore cambiano dosi, acqua e sodio dei prossimi
      try { diaryIO().write(JSON.parse(b64)); await ricarica("Lungo salvato: rifornimento aggiornato"); } catch (e) { console.log("Lungo non salvato: " + e); }
      continue;
    }
    if (kind === "gear") {
      try { const dia = diaryIO().read(); dia.gear = pulisciGear(JSON.parse(b64)); diaryIO().write(dia); await ricarica("Attrezzatura salvata"); } catch (e) { console.log("Attrezzatura non salvata: " + e); }
      continue;
    }
    if (kind === "peso") {
      // pesata del giorno: nel diario e subito nel piano (media, ritmo, calorie)
      try { diaryIO().write(JSON.parse(b64)); await ricarica("Peso salvato: piano aggiornato"); } catch (e) { console.log("Peso non salvato: " + e); }
      continue;
    }
    if (kind === "setup") {
      try {
        const nuovo = JSON.parse(b64);
        const vecchio = PROF || {};
        const P = { ...vecchio, ...nuovo, versione: 1, aggiornato: new Date().toISOString() };
        // i campi che il modulo non mostra (per esempio ctlGara) restano; se cambia la distanza si ricalcola
        if (vecchio.gara && nuovo.gara) { P.gara = { ...vecchio.gara, ...nuovo.gara }; if (vecchio.gara.tipo !== nuovo.gara.tipo) delete P.gara.ctlGara; }
        if (vecchio.corpo && nuovo.corpo) P.corpo = { ...vecchio.corpo, ...nuovo.corpo };
        if (!P.creato) P.creato = P.aggiornato;
        if (ctx.atleta && !P.intervals) P.intervals = ctx.atleta;
        const primaVolta = !PROF;
        let tolte = 0;
        if (P.pianoApp === false && vecchio.pianoApp !== false && ctx.key) {
          const oggi = ymd(ctx.now || new Date());
          try {
            const cal = await ivRichiesta(ctx.key, "GET", `/events?oldest=${oggi}&newest=${ymd(addDays(parseYMD(oggi), 140))}`);
            tolte = await togliSedute(ctx.key, seduteDaTogliere(cal, { oggi, tutte: true }));
          } catch (e) { console.log("Sedute dell'app non tolte: " + e); }
          if (P.piano && Array.isArray(P.piano.ids)) P.piano = { ...P.piano, ids: P.piano.ids.filter((id) => !(String(id).startsWith("hud-") && String(id).slice(4, 14) >= oggi)) };
        }
        scriviProfilo(P);
        applicaProfilo(P);
        // con il profilo pronto le soglie stimate vanno su Intervals prima del piano: le sedute nascono con gli obiettivi giusti
        if (ctx.key && ctx.raw) {
          try { const f = await aggiornaSoglie(ctx.key, ctx.raw, ctx.now); if (f.length) { ctx.raw.soglieAggiornate = f.filter((c) => c.testo).map((c) => c.testo); completaSoglieDi(ctx.raw); } }
          catch (e) { console.log("Soglie: " + (e.message || e)); }
        }
        if (primaVolta && P.pianoApp !== false && ctx.key) {
          // prima volta: niente giri, si passa subito all'anteprima del piano
          await ricarica(null);
          try {
            ctx.piano = creaPiano(PROF, ctx.raw, ctx.now, false);
            let conflitti = 0;
            try { conflitti = await contaConflitti(ctx.key, ctx.piano); } catch (e) {}
            await js(`window.__planPreview(${JSON.stringify(anteprimaPiano(ctx.piano, conflitti)).replace(/</g, "\\u003c")})`);
          } catch (e) { await js(`window.__toast(${JSON.stringify("Fatto. Crea il piano dalla scheda Settimana")})`); }
        } else await ricarica(primaVolta && P.pianoApp !== false ? "Fatto. Crea il piano dalla scheda Settimana"
          : P.pianoApp === false && primaVolta ? "Fatto: l'app legge il tuo piano. In Impostazioni tocca Avvisa"
          : tolte ? `Impostazioni salvate: tolte ${tolte} sedute future dell'app` : "Impostazioni salvate");
      } catch (e) { await js(`window.__setupError(${JSON.stringify("Non sono riuscito a salvare: " + (e.message || e))})`); }
      continue;
    }
    if (kind === "plan") {
      if (!ctx.key || !PROF) { await js(`window.__planError(${JSON.stringify("Serve la chiave di Intervals e la configurazione completata.")})`); continue; }
      try {
        if (b64 === "scrivi") {
          if (!ctx.piano) throw new Error("Prima crea l'anteprima del piano.");
          const n = await scriviPiano(ctx.key, PROF, ctx.piano, ctx.now);
          ctx.piano = null;
          try { ctx.raw = await fetchIntervals(ctx.key, ctx.now); cacheIO().write(ctx.raw); } catch (e) { console.log("Rilettura dopo il piano: " + e); }
          await ricarica(`${n} sedute scritte nel calendario`);
          if (!PROF.avvisato) await js("window.__avvisa && window.__avvisa()");
        } else {
          ctx.piano = creaPiano(PROF, ctx.raw, ctx.now, b64 === "prossimo");
          let conflitti = 0;
          try { conflitti = await contaConflitti(ctx.key, ctx.piano); } catch (e) { console.log("Calendario non letto: " + e); }
          await js(`window.__planPreview(${JSON.stringify(anteprimaPiano(ctx.piano, conflitti)).replace(/</g, "\\u003c")})`);
        }
      } catch (e) { await js(`window.__planError(${JSON.stringify(String(e.message || e))})`); }
      continue;
    }
    if (kind === "avvisa") {
      try {
        let at = ctx.atleta || (PROF && PROF.intervals) || null;
        if (!at && ctx.key) { try { const r = await ivRichiesta(ctx.key, "GET", ""); if (r && r.id) at = { id: r.id, nome: r.name || "" }; } catch (e) {} }
        const m = new Mail();
        m.toRecipients = CONFIG.feedbackEmail ? [CONFIG.feedbackEmail] : [];
        m.subject = `${CONFIG.nomeApp} · ${PROF && PROF.nome ? PROF.nome : "nuovo tester"} è pronto`;
        m.body = `Ciao! Ho installato l'app e scritto il mio piano.\n\nSu Intervals sono: ${at ? `${at.nome || "—"} (id ${at.id})` : "—"}\nAggiungimi al gruppo dei tester.\n\n—\nVersione ${VERSIONE}`;
        await m.send();
        if (PROF) { PROF.avvisato = new Date().toISOString(); if (at) PROF.intervals = at; scriviProfilo(PROF); }
        await js(`window.__toast(${JSON.stringify("Fatto. Quando ti aggiunge, accetta l'invito su Intervals")})`);
      } catch (e) { await js(`window.__toast(${JSON.stringify(CONFIG.feedbackEmail ? "Mail non disponibile: scrivi a " + CONFIG.feedbackEmail : "Mail non disponibile su questo iPhone")})`); }
      continue;
    }
    if (kind === "feedback") {
      try {
        const m = new Mail();
        m.toRecipients = CONFIG.feedbackEmail ? [CONFIG.feedbackEmail] : [];
        m.subject = `${CONFIG.nomeApp} · commento (versione ${VERSIONE})`;
        m.body = `Scrivi qui cosa ti piace, cosa non funziona o cosa manca:\n\n\n\n—\nVersione ${VERSIONE} · ${PROF && PROF.nome ? PROF.nome : "tester"} · ${ymd(new Date())}`;
        await m.send();
      } catch (e) { await js(`window.__toast(${JSON.stringify(CONFIG.feedbackEmail ? "Mail non disponibile: scrivi a " + CONFIG.feedbackEmail : "Mail non disponibile su questo iPhone")})`); }
      continue;
    }
    if (kind === "photo") {
      // Foto dalla galleria, ritagliata a 1080×1920 qui per non passare 12 MP alla pagina
      try {
        const img = await Photos.fromLibrary();
        const W = 1080, H = 1920, s = Math.max(W / img.size.width, H / img.size.height);
        const w = img.size.width * s, h = img.size.height * s;
        const dc = new DrawContext(); dc.size = new Size(W, H); dc.opaque = true; dc.respectScreenScale = false;
        dc.drawImageInRect(img, new Rect((W - w) / 2, (H - h) / 2, w, h));
        const jpg = Data.fromJPEG(dc.getImage()).toBase64String();
        await wv.evaluateJavaScript(`window.__setBg('data:image/jpeg;base64,${jpg}')`, false);
      } catch (e) { console.log("Foto non scelta: " + e); }
      continue;
    }
    if (kind === "mp4" || kind === "webm") {
      // Video per la storia: anteprima con il pulsante Condividi (Salva video / Instagram)
      try {
        const fm = FileManager.local();
        const vp = fm.joinPath(fm.temporaryDirectory(), `HUD-attivita-${ymd(new Date())}.${kind}`);
        fm.write(vp, Data.fromBase64String(b64));
        await QuickLook.present(vp, true);
      } catch (e) { console.log("Video non condiviso: " + e); }
      continue;
    }
    try {
      const data = Data.fromBase64String(b64);
      const fm = FileManager.local();
      const path = fm.joinPath(fm.temporaryDirectory(), `HUD-${ymd(new Date())}.png`);
      fm.write(path, data);
      const img = Image.fromFile(path);
      if (kind === "gif") {
        const gp = fm.joinPath(fm.temporaryDirectory(), `HUD-attivita-${ymd(new Date())}.gif`);
        fm.write(gp, data);
        await QuickLook.present(gp, true); // anteprima animata con il pulsante Condividi di iOS
        continue;
      }
      if (kind === "copy") {
        Pasteboard.copyImage(img);
        await wv.evaluateJavaScript("window.__toast('Copiata · incollala nella storia')", false);
      } else {
        await ShareSheet.present([img]);
      }
    } catch (e) { console.log("Condivisione non riuscita: " + e); }
  }
}

// Pesate da Salute, passate dal Comando Rapido «Peso HUD»: testo, numeri, liste o dizionari, come arrivano.
// Ogni voce: una data (9 ott 2026, 09/10/2026, 2026-10-09, oggi, ieri; senza data vale oggi) e un peso tra 40 e 200 kg.
// Più pesate nello stesso giorno: vale la prima del mattino.
const MESI_IN = { gen: 0, jan: 0, feb: 1, mar: 2, apr: 3, mag: 4, may: 4, giu: 5, jun: 5, lug: 6, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, ott: 9, oct: 9, nov: 10, dic: 11, dec: 11 };
function leggiPesi(input, now) {
  const oggi0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const perGiorno = {};
  const voce = (testo) => {
    let s = String(testo).toLowerCase().replace(/[\u00a0\u202f]/g, " ").replace(/(\d)t(\d)/g, "$1 $2");
    let d = null, preso = null;
    const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    const num = s.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
    const mese = s.match(/\b(\d{1,2})\s+([a-z\u00e0-\u00f9]{3,})\.?(?:\s+(\d{4}))?/);
    const meseEn = s.match(/\b([a-z]{3,})\.?\s+(\d{1,2}),?(?:\s+(\d{4}))?/);
    const giornoDi = (g, m, a) => { let x = new Date(a ? +a : now.getFullYear(), m, +g); if (!a && x > oggi0) x = new Date(x.getFullYear() - 1, x.getMonth(), x.getDate()); return x; };
    if (iso) { d = new Date(+iso[1], +iso[2] - 1, +iso[3]); preso = iso[0]; }
    else if (num) { d = new Date(+num[3] < 100 ? 2000 + +num[3] : +num[3], +num[2] - 1, +num[1]); preso = num[0]; }
    else if (mese && MESI_IN[mese[2].slice(0, 3)] !== undefined) { d = giornoDi(mese[1], MESI_IN[mese[2].slice(0, 3)], mese[3]); preso = mese[0]; }
    else if (meseEn && MESI_IN[meseEn[1].slice(0, 3)] !== undefined) { d = giornoDi(meseEn[2], MESI_IN[meseEn[1].slice(0, 3)], meseEn[3]); preso = meseEn[0]; }
    else if (/\b(ieri|yesterday)\b/.test(s)) d = addDays(oggi0, -1);
    else d = oggi0; // «oggi», o nessuna data
    if (preso) s = s.replace(preso, " ");
    s = s.replace(/\b(oggi|ieri|today|yesterday)\b/g, " ");
    const ore = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?\b/);
    const minuti = ore ? +ore[1] * 60 + +ore[2] : null;
    s = s.replace(/\b(?:[01]?\d|2[0-3])[:.][0-5]\d(?::[0-5]\d)?\b/g, " ");
    // il primo numero che può essere un peso (40–200 kg, o in libbre se lo dice)
    const re = /(^|[^\d.,])(\d{2,3}(?:[.,]\d{1,3})?)(?!\d)\s*(kg|lbs?|libbre)?/g;
    let kg = null, k;
    while ((k = re.exec(s))) {
      const v = parseFloat(k[2].replace(",", ".")) * (k[3] && k[3] !== "kg" ? 0.45359237 : 1);
      if (v >= 40 && v <= 200) { kg = v; break; }
    }
    if (kg === null || isNaN(d)) return;
    const giorni = Math.round((oggi0 - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    if (!(kg >= 40 && kg <= 200) || giorni < 0 || giorni > 120) return;
    const g = ymd(d), prima = perGiorno[g];
    if (!prima || (minuti !== null && (prima.minuti === null || minuti < prima.minuti))) perGiorno[g] = { d: g, kg: Math.round(kg * 100) / 100, minuti };
  };
  const visita = (x) => {
    if (x === null || x === undefined || x === "") return;
    if (Array.isArray(x)) return x.forEach(visita);
    if (typeof x === "object") {
      const ks = Object.keys(x), kd = ks.find((k) => /^(data|date|giorno|day|start|inizio)/i.test(k)), kv = ks.find((k) => /^(peso|weight|valore|value|kg)/i.test(k));
      if (kv) return voce(`${kd ? x[kd] : ""} ${x[kv]}`);
      return ks.forEach((k) => voce(`${k} ${x[k]}`));
    }
    if (typeof x === "number") return voce(String(x));
    String(x).split(/[\n;|]+/).forEach((r) => r.trim() && voce(r));
  };
  visita(input);
  return Object.values(perGiorno).sort((a, b) => (a.d < b.d ? -1 : 1));
}

// Salva le pesate nel diario: la bilancia vale più di quella scritta a mano lo stesso giorno
function importaPesi(dia, input, now) {
  const xs = leggiPesi(input, now);
  dia.pesi = dia.pesi || {};
  for (const x of xs) dia.pesi[x.d] = x.kg;
  if (xs.length) dia.pesiSync = { ts: now.toISOString(), ultimo: xs[xs.length - 1].d, n: xs.length };
  return xs;
}

// ------------------------------------------------------------
//  Diario del cibo: "180 g di pasta, 150 di pollo e un cucchiaio d'olio" → grammi, calorie e macro
// ------------------------------------------------------------
// Per 100 g (pasta, riso e cereali crudi, come nel piano): kcal, carboidrati, proteine, grassi.
// pz = grammi di un pezzo · por = porzione quando non dici quanto · cuc = grammi di un cucchiaio · fetta = grammi di una fetta
const CIBI = [
  [["pasta integrale", "spaghetti integrali", "penne integrali"], "pasta integrale", 340, 66, 13, 2.5, { por: 100 }],
  [["gnocchi"], "gnocchi", 150, 33, 4, 0.3, { por: 250 }],
  [["pasta", "spaghetti", "penne", "fusilli", "rigatoni", "maccheroni", "linguine", "farfalle", "paccheri", "tagliatelle", "orecchiette", "pastasciutta"], "pasta", 353, 72, 12.5, 1.5, { por: 100 }],
  [["risotto", "riso basmati", "riso integrale", "riso"], "riso", 350, 79, 7, 0.6, { por: 90 }],
  [["cous cous", "couscous"], "cous cous", 360, 72, 12, 1.5, { por: 80 }],
  [["farro", "orzo", "quinoa", "cereali in chicco"], "farro o quinoa", 340, 67, 13, 2.5, { por: 80 }],
  [["fette biscottate", "fetta biscottata", "fette biscottata"], "fette biscottate", 410, 76, 11, 6, { pz: 10, fetta: 10, por: 40 }],
  [["fiocchi d avena", "fiocchi di avena", "avena", "porridge"], "avena", 370, 60, 13, 7, { por: 50, cuc: 10 }],
  [["corn flakes", "cornflakes", "cereali", "muesli", "granola"], "cereali", 375, 78, 8, 3, { por: 40, cuc: 8 }],
  [["gallette", "galletta", "gallette di riso"], "gallette", 380, 80, 8, 3, { pz: 8, por: 24 }],
  [["crackers", "cracker", "grissini", "taralli"], "crackers", 430, 70, 10, 11, { pz: 25, por: 25 }],
  [["biscotti", "biscotto", "frollini"], "biscotti", 450, 70, 7, 16, { pz: 9, por: 36 }],
  [["cornetto", "cornetti", "brioche", "croissant"], "cornetto", 410, 48, 7, 21, { pz: 60 }],
  [["focaccia"], "focaccia", 300, 45, 7, 10, { pz: 100, fetta: 80, por: 100 }],
  [["pizza"], "pizza", 250, 33, 10, 9, { pz: 320, fetta: 110, por: 320 }],
  [["piadina", "piadine", "tortilla", "wrap"], "piadina", 300, 50, 8, 8, { pz: 100 }],
  [["panino", "panini", "rosetta", "baguette"], "panino", 275, 56, 9, 1.5, { pz: 80 }],
  [["pane integrale", "pane", "pan carre", "pancarre", "bruschetta", "bruschette"], "pane", 270, 55, 8.5, 1.5, { fetta: 30, pz: 50, por: 60 }],
  [["patatine fritte", "patate fritte", "patatine"], "patatine fritte", 312, 41, 3.4, 15, { por: 150 }],
  [["patate", "patata"], "patate", 77, 17, 2, 0.1, { pz: 150, por: 200 }],
  [["lasagne", "lasagna", "parmigiana"], "lasagne", 160, 13, 9, 8, { por: 300 }],
  [["ceci"], "ceci", 120, 17, 7, 2.5, { por: 150, cuc: 20 }],
  [["lenticchie"], "lenticchie", 110, 17, 9, 0.5, { por: 150 }],
  [["fagioli", "piselli", "legumi", "edamame"], "legumi", 100, 15, 7, 0.5, { por: 150 }],
  [["petto di pollo", "pollo", "fesa di tacchino", "tacchino"], "pollo o tacchino", 110, 0, 23, 1.5, { por: 150 }],
  [["hamburger", "burger", "polpette", "salsiccia", "salsicce"], "hamburger", 230, 2, 18, 17, { pz: 120, por: 150 }],
  [["bistecca", "manzo", "vitello", "carne", "tagliata", "filetto", "maiale", "lonza"], "carne", 150, 0, 21, 7, { por: 150 }],
  [["bresaola"], "bresaola", 150, 0, 32, 2, { fetta: 10, por: 50 }],
  [["prosciutto crudo", "crudo", "speck", "salame", "salumi", "mortadella"], "prosciutto crudo", 250, 0, 26, 16, { fetta: 12, por: 50 }],
  [["prosciutto cotto", "cotto", "prosciutto"], "prosciutto cotto", 140, 1, 20, 6, { fetta: 15, por: 50 }],
  [["salmone"], "salmone", 200, 0, 20, 13, { por: 150 }],
  [["tonno sott olio", "tonno all olio"], "tonno sott'olio", 190, 0, 25, 10, { pz: 80, por: 80 }],
  [["tonno"], "tonno", 120, 0, 26, 1.5, { pz: 80, por: 80 }],
  [["gamberi", "gamberetti", "calamari", "polpo", "cozze", "vongole"], "gamberi o molluschi", 85, 1, 17, 1.2, { por: 150 }],
  [["merluzzo", "orata", "branzino", "spigola", "pesce", "sogliola", "platessa", "nasello"], "pesce", 90, 0, 19, 1.5, { por: 200 }],
  [["sushi", "uramaki", "nigiri", "sashimi", "poke"], "sushi", 150, 28, 6, 1.5, { pz: 30, por: 250 }],
  [["albume", "albumi", "chiare"], "albume", 50, 0.7, 11, 0.2, { pz: 33, por: 100 }],
  [["frittata", "uova", "uovo"], "uova", 130, 0.7, 12.5, 9.5, { pz: 60, por: 120 }],
  [["yogurt greco", "skyr", "greco"], "yogurt greco", 57, 4, 10, 0.2, { pz: 150, por: 150, cuc: 20 }],
  [["yogurt", "yogurth", "jogurt"], "yogurt", 65, 4.5, 3.5, 3.5, { pz: 125, por: 125 }],
  [["kefir", "latte", "cappuccino"], "latte", 46, 5, 3.3, 1.6, { por: 250 }],
  [["ricotta"], "ricotta", 140, 3.5, 9, 10, { por: 100, cuc: 20 }],
  [["fiocchi di latte", "cottage"], "fiocchi di latte", 100, 3, 12, 4.5, { pz: 150, por: 150 }],
  [["mozzarella", "mozzarelle", "burrata"], "mozzarella", 250, 1, 18, 19, { pz: 125, por: 125 }],
  [["parmigiano", "grana", "pecorino"], "parmigiano", 390, 0, 33, 28, { por: 20, cuc: 10 }],
  [["formaggio", "formaggi", "stracchino", "fontina", "emmental"], "formaggio", 350, 1, 25, 28, { fetta: 20, por: 50 }],
  [["olio", "olio d oliva", "olio extravergine"], "olio", 900, 0, 0, 100, { por: 10, cuc: 10, filo: 5 }],
  [["burro"], "burro", 720, 0, 1, 82, { por: 10, cuc: 10 }],
  [["burro di arachidi", "burro d arachidi", "crema di arachidi"], "burro di arachidi", 590, 18, 25, 50, { por: 15, cuc: 15 }],
  [["frutta secca", "noci", "noce", "mandorle", "nocciole", "anacardi", "pistacchi", "arachidi"], "frutta secca", 600, 10, 18, 52, { pz: 4, por: 20, manciata: 25 }],
  [["cioccolato fondente", "fondente", "cioccolato", "cioccolata"], "cioccolato fondente", 550, 35, 8, 40, { pz: 10, quadratino: 10, por: 20 }],
  [["miele"], "miele", 304, 82, 0.3, 0, { por: 10, cuc: 20 }],
  [["marmellata", "confettura", "nutella"], "marmellata", 250, 60, 0.5, 0, { por: 20, cuc: 20 }],
  [["zucchero"], "zucchero", 400, 100, 0, 0, { por: 5, cuc: 15 }],
  [["datteri", "dattero"], "datteri", 280, 75, 2.5, 0.4, { pz: 8, por: 24 }],
  [["banana", "banane"], "banana", 90, 21, 1.1, 0.3, { pz: 120 }],
  [["frutti di bosco", "mirtilli", "fragole", "lamponi"], "frutti di bosco", 45, 10, 1, 0.4, { por: 125 }],
  [["mela", "mele", "pera", "pere", "pesca", "pesche", "arancia", "arance", "mandarini", "mandarino", "kiwi", "albicocche", "prugne", "uva", "ananas", "melone", "anguria", "frutta"], "frutta", 50, 12, 0.5, 0.2, { pz: 160 }],
  [["insalata", "verdure", "verdura", "zucchine", "zucchina", "pomodori", "pomodoro", "broccoli", "spinaci", "carote", "carota", "peperoni", "melanzane", "fagiolini", "cavolfiore", "minestrone", "passata", "funghi", "rucola", "finocchi"], "verdure", 25, 4, 1.5, 0.2, { por: 200 }],
  [["barretta proteica", "barrette proteiche", "protein bar"], "barretta proteica", 360, 30, 33, 12, { pz: 50 }],
  [["barretta", "barrette"], "barretta", 380, 65, 8, 8, { pz: 40 }],
  [["gel"], "gel", 250, 62.5, 0, 0, { pz: 40 }],
  [["proteine in polvere", "proteine", "whey", "shake proteico", "frullato proteico"], "proteine in polvere", 380, 6, 78, 6, { por: 30, misurino: 30 }],
  [["gelato", "gelati"], "gelato", 200, 25, 3.5, 10, { pz: 120, por: 120 }],
  [["tiramisu", "dolce", "torta", "crostata", "dessert"], "dolce", 320, 40, 5, 15, { fetta: 100, por: 100 }],
  [["birra", "birre"], "birra", 43, 3.5, 0.5, 0, { pz: 330, por: 330 }],
  [["vino", "prosecco", "spritz"], "vino", 85, 2.6, 0.1, 0, { por: 125 }],
  [["succo", "spremuta"], "succo", 48, 11, 0.5, 0, { por: 200 }],
  [["coca cola", "cola", "aranciata", "bibita"], "bibita", 42, 10.6, 0, 0, { pz: 330, por: 330 }],
  [["caffe", "espresso", "te", "tisana", "acqua", "sali", "elettroliti"], "caffè, tè o acqua", 1, 0, 0, 0, { por: 30 }],
];
const NUMERI_IT = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, mezzo: 0.5, mezza: 0.5, paio: 2, qualche: 2 };
const UNITA_PESO = { kg: 1000, chili: 1000, chilo: 1000, kilo: 1000, g: 1, gr: 1, grammi: 1, grammo: 1, etti: 100, etto: 100, ml: 1, millilitri: 1, cl: 10, l: 1000, litri: 1000, litro: 1000 };
const UNITA_CASA = {
  cucchiaio: "cuc", cucchiai: "cuc", cucchiaino: "cucn", cucchiaini: "cucn", tazza: 250, tazze: 250, tazzina: 30, tazzine: 30, bicchiere: 200, bicchieri: 200,
  vasetto: "pz", vasetti: "pz", fetta: "fetta", fette: "fetta", manciata: "manciata", manciate: "manciata", pezzo: "pz", pezzi: "pz", porzione: "por", porzioni: "por",
  piatto: "por", piatti: "por", scatoletta: 80, scatolette: 80, lattina: 330, lattine: 330, bottiglia: 500, bottiglie: 500, quadratino: "quadratino", quadratini: "quadratino",
  misurino: "misurino", misurini: "misurino", filo: "filo", spicchio: "pz", spicchi: "pz",
};
const senzaAccenti = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "");
const CHIAVI_CIBO = CIBI.flatMap((c) => c[0].map((k) => [senzaAccenti(k), c])).sort((a, b) => b[0].length - a[0].length);
function leggiCibo(testo) {
  let s = senzaAccenti(String(testo || "").toLowerCase()).replace(/[’'`]/g, " ").replace(/\s+/g, " ");
  s = s.replace(/\b(ho mangiato|ho bevuto|mangiato|bevuto|per colazione|a colazione|a pranzo|a cena|come spuntino|per spuntino|a merenda|stamattina|stasera|oggi|adesso|appena)\b/g, " ");
  const pezzi = s.split(/,|;|\.\s|\be poi\b|\bpoi\b|\bed\b|\be\b|\bpiu\b|\bcon\b|\binsieme a\b|\boltre a\b|\binsieme\b/).map((x) => x.trim()).filter(Boolean);
  const voci = [], ignoti = [];
  const NUM = "(\\d+(?:[.,]\\d+)?|un paio di|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|mezzo|mezza|qualche)";
  for (const p of pezzi) {
    // il cibo nominato per primo (in "pasta al pomodoro" conta la pasta); a pari posizione la parola più lunga
    let hit = null, pos = Infinity;
    for (const kc of CHIAVI_CIBO) {
      const mm = new RegExp(`(^|[^a-z])${kc[0].replace(/ /g, "\\s+")}([^a-z]|$)`).exec(p);
      if (mm && mm.index < pos) { pos = mm.index; hit = kc; }
    }
    if (!hit) { const resto = p.replace(/\b(un|uno|una|di|del|della|dello|dei|delle|degli|il|lo|la|i|gli|le|al|alla|po|poco|anche|qualche|d)\b/g, " ").replace(/[\d.,]+/g, " ").trim(); if (resto.length >= 3) ignoti.push(p); continue; }
    const c = hit[1], [, nome, kcal, C, P, G, u] = c;
    const n = (x) => (x === undefined || x === null ? null : /^\d/.test(x) ? parseFloat(x.replace(",", ".")) : x === "un paio di" ? 2 : NUMERI_IT[x] ?? null);
    let g = null, m;
    if ((m = p.match(new RegExp(`${NUM}?\\s*(${Object.keys(UNITA_PESO).join("|")})\\b`))) && (m[1] || /\d/.test(p.slice(0, m.index + 1)))) {
      const q = n(m[1]) ?? 1; g = q * UNITA_PESO[m[2]];
    } else if ((m = p.match(new RegExp(`${NUM}?\\s*(${Object.keys(UNITA_CASA).join("|")})\\b`)))) {
      const q = n(m[1]) ?? 1, tipo = UNITA_CASA[m[2]];
      const base = typeof tipo === "number" ? tipo
        : tipo === "cuc" ? u.cuc || 15 : tipo === "cucn" ? (u.cuc || 15) / 3 : tipo === "fetta" ? u.fetta || u.pz || 30
        : tipo === "manciata" ? u.manciata || 25 : tipo === "quadratino" ? u.quadratino || 10 : tipo === "misurino" ? u.misurino || 30
        : tipo === "filo" ? u.filo || 5 : tipo === "por" ? u.por || u.pz || 100 : u.pz || u.por || 100;
      g = q * base;
    } else if ((m = p.match(new RegExp(`(^|\\s)${NUM}(\\s|$)`)))) {
      const q = n(m[2]);
      if (q !== null) g = /^\d/.test(m[2]) && q >= 15 ? q : q * (u.pz || u.por || 100);
    }
    if (g === null) g = u.por || u.pz || 100;
    g = Math.round(g);
    const k = g / 100;
    voci.push({ n: nome, g, kcal: Math.round(kcal * k), C: Math.round(C * k), P: Math.round(P * k), G: Math.round(G * k) });
  }
  return { voci, ignoti };
}
// Segna nel diario quello che hai mangiato (oggi); tiene due mesi
function registraCibo(dia, testo, now) {
  const r = leggiCibo(testo);
  if (!r.voci.length) return { ...r, voce: null };
  const giorno = ymd(now);
  dia.cibo = dia.cibo || {};
  const voce = { id: `${now.getTime().toString(36)}-${((dia.cibo[giorno] || []).length + 1)}-${Math.floor(Math.random() * 1e6).toString(36)}`, ora: `${pad(now.getHours())}:${pad(now.getMinutes())}`, testo: String(testo).trim().slice(0, 200), voci: r.voci, ignoti: r.ignoti };
  (dia.cibo[giorno] = dia.cibo[giorno] || []).push(voce);
  const limite = ymd(addDays(now, -60));
  for (const d of Object.keys(dia.cibo)) if (d < limite) delete dia.cibo[d];
  return { ...r, voce };
}
function totaleCibo(lista) {
  const t = { kcal: 0, C: 0, P: 0, G: 0 };
  for (const e of lista || []) for (const v of e.voci || []) { t.kcal += v.kcal; t.C += v.C; t.P += v.P; t.G += v.G; }
  return t;
}
const descriviVoci = (voci) => voci.map((v) => `${v.n} ${v.g} g`).join(", ");

const nomeScript = () => { try { return typeof Script !== "undefined" && Script.name ? Script.name() || "HUD" : "HUD"; } catch (e) { return "HUD"; } };

// ------------------------------------------------------------
//  Infortunio e malattia: consigli, Carburante adattato e proposta per le prossime sedute.
//  Le sedute su Intervals cambiano solo con «Applica»; «Annulla» le rimette com'erano.
//  Indicazioni generali, non un parere medico.
// ------------------------------------------------------------
// per zona: cosa si può fare (no = in pausa, facile = solo facile e senza dolore, si = come da piano)
const ZONE_INF = {
  piede: { nome: "Piede o caviglia", corsa: "no", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Bici con la pressione sul mezzo piede, nuoto con il pull buoy se calciare fa male. In palestra parte alta e core, niente salti.",
    esercizi: "Ogni giorno, se non fa male: cerchi con la caviglia, alfabeto con il piede, equilibrio su una gamba (30\" per 3)." },
  polpaccio: { nome: "Polpaccio o tendine d'Achille", corsa: "no", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Bici facile senza salite pesanti, nuoto con il pull buoy se il calcio tira. Niente salti né corsa in salita.",
    esercizi: "Dopo i primi giorni, se il dolore resta sotto 3 su 10: sollevamenti sulle punte lenti (3 secondi in su, 3 in giù), 3 serie da 15, prima a due gambe poi a una." },
  ginocchio: { nome: "Ginocchio", corsa: "no", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Bici agile (cadenza alta, rapporti leggeri, niente salite seduto). In acqua stile e dorso, niente rana. In palestra niente squat profondi né affondi se fanno male.",
    esercizi: "Rinforzo di anca e glutei: ponte, abduzioni sul fianco, mostri laterali con l'elastico, 3 serie da 12." },
  anca: { nome: "Anca o inguine", corsa: "facile", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Corsa solo facile, in piano e se il dolore resta sotto 3 su 10. In acqua niente rana.",
    esercizi: "Ponte su due gambe, adduttori in isometria con un cuscino tra le ginocchia (10\" per 10), plank laterale." },
  femorali: { nome: "Dietro la coscia (femorali)", corsa: "facile", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Niente velocità, allunghi e salite: si strappano lì. Corsa solo lenta e solo se non zoppichi. In palestra niente stacchi pesanti.",
    esercizi: "Ponte con i talloni lontani e camminate a passi lunghi lenti; quando non fa più male, ponte su una gamba." },
  quadricipite: { nome: "Davanti alla coscia", corsa: "facile", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Corsa facile in piano se il dolore resta sotto 3 su 10, niente discese.",
    esercizi: "Estensioni lente della gamba e mezzi squat a corpo libero, senza dolore." },
  schiena: { nome: "Schiena", corsa: "facile", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Corsa piano su fondo morbido se non fa male. Bici con il manubrio più alto e uscite brevi. In acqua stile e dorso, niente delfino. In palestra niente carichi sulla schiena.",
    esercizi: "Gatto-mucca, dead bug, bird dog: 2 serie lente ogni giorno. Cammina: aiuta." },
  spalla: { nome: "Spalla", corsa: "si", bici: "si", nuoto: "no", forza: "facile",
    cosa: "Corsa e bici vanno bene. Nuoto in pausa (al massimo solo gambe con la tavoletta, se non fa male). In palestra niente esercizi sopra la testa.",
    esercizi: "Rotazioni esterne con l'elastico, gomito al fianco, e spalle indietro: 3 serie da 15, leggere." },
  altro: { nome: "Altro", corsa: "facile", bici: "facile", nuoto: "facile", forza: "facile",
    cosa: "Fai solo quello che non fa male: dolore al massimo 3 su 10 durante e nessun peggioramento il giorno dopo.",
    esercizi: "" },
};
const SINTOMI_MAL = { sopra: "Sopra il collo: naso chiuso, raffreddore, gola", sotto: "Sotto il collo: tosse profonda, petto, dolori, stomaco" };

// L'episodio in corso (uno alla volta): nel diario
function saluteDi(dia) { const S = dia && dia.salute; return S && S.tipo && !S.guarito ? S : null; }

function consigliSalute(S, now) {
  if (!S) return null;
  const giorni = Math.max(0, daysBetween(parseYMD(S.dal), now));
  const sport = { corsa: "si", bici: "si", nuoto: "si", forza: "si" };
  const consigli = [], allarmi = [];
  let titolo, sotto, stop = false, livello = "cautela", fase = null, carb;
  if (S.tipo === "malattia") {
    const febbre = !!S.febbre, giu = S.sintomi === "sotto";
    const passati = S.passati || null; // giorno in cui i sintomi sono spariti
    const malGiorni = Math.max(1, daysBetween(parseYMD(S.dal), passati ? parseYMD(passati) : now) + 1);
    titolo = febbre ? "Malattia con febbre" : giu ? "Malattia · sotto il collo" : "Raffreddore · sopra il collo";
    if (!passati && (febbre || giu)) {
      fase = "stop"; stop = true; livello = "stop";
      ["corsa", "bici", "nuoto", "forza"].forEach((k) => { sport[k] = "no"; });
      sotto = "Riposo completo finché non passa";
      consigli.push(["Riposa davvero", "Con febbre o sintomi sotto il collo allenarsi allunga la malattia e affatica il cuore. Dormi, bevi, mangia normale."]);
      consigli.push(["Quando ripartire", "Da 24 ore senza febbre (senza antipiretici) e senza sintomi sotto il collo: tocca «Sto meglio» e l'app prepara il rientro."]);
    } else if (!passati) {
      fase = "lieve";
      ["corsa", "bici", "nuoto"].forEach((k) => { sport[k] = "facile"; });
      sport.forza = "facile";
      sotto = "Solo sedute facili, al massimo 45'";
      consigli.push(["La regola del collo", "Sintomi solo sopra il collo e niente febbre: puoi muoverti piano, in Z1–Z2, al massimo 45'. Niente intensità né lunghi."]);
      consigli.push(["Prova di 10 minuti", "Parti piano: se dopo 10 minuti ti senti peggio, fermati e riposa. Se ti senti meglio, finisci la seduta facile."]);
    } else {
      fase = "rientro";
      const rientro = Math.min(7, Math.max(2, malGiorni)), fatti = Math.max(0, daysBetween(parseYMD(passati), now));
      sotto = fatti < rientro ? `Rientro graduale · giorno ${fatti + 1} di ${rientro}` : "Rientro completato";
      ["corsa", "bici", "nuoto", "forza"].forEach((k) => { sport[k] = fatti < rientro ? "facile" : "si"; });
      consigli.push(["Tanti giorni quanti di malattia", `Sei stato male ${malGiorni} ${malGiorni === 1 ? "giorno" : "giorni"}: rientra in ${rientro}. Primi giorni a metà durata in Z1–Z2, poi tre quarti; l'intensità solo dopo due giorni normali senza sintomi.`]);
      if (febbre) consigli.push(["Dopo la febbre", "I battiti possono restare alti per qualche giorno: guarda la FC più del passo e resta basso."]);
      if (fatti >= rientro) { consigli.push(["Puoi tornare al piano", "Tocca «Guarito» per chiudere: torna tutto come prima."]); livello = "ok"; }
    }
    carb = { deficit: "zero", testo: "Niente deficit finché sei malato e durante il rientro: mangiare a sufficienza aiuta a guarire. Bevi di più." };
    allarmi.push("Febbre sopra 38,5 o che dura più di 3 giorni", "Dolore al petto, palpitazioni o fiato corto che non c'era", "Sintomi che peggiorano invece di migliorare");
  } else {
    const Z = ZONE_INF[S.zona] || ZONE_INF.altro, d = +S.dolore || 0;
    titolo = `Infortunio · ${Z.nome.toLowerCase()}`;
    const grave = !!S.riposo || d >= 7;
    for (const k of ["corsa", "bici", "nuoto", "forza"]) sport[k] = Z[k];
    if (grave) {
      stop = true; livello = "stop"; fase = "stop";
      for (const k of ["corsa", "bici", "nuoto", "forza"]) if (sport[k] !== "si") sport[k] = "no";
      sotto = "Fermo con la parte che fa male";
      consigli.push(["Prima un controllo", S.riposo ? "Dolore a riposo, gonfiore o zoppia: fermati con tutto quello che carica la zona e fatti vedere da un medico o da un fisioterapista." : `Dolore ${d} su 10: troppo per allenarsi su quella parte. Fermati e fatti vedere.`]);
    } else {
      fase = "adatta";
      sotto = sport.corsa === "no" ? "Corsa in pausa, il resto con giudizio" : "Allenamento adattato";
      consigli.push(["Cosa puoi fare", Z.cosa]);
      consigli.push(["La regola del 3", "Dolore al massimo 3 su 10 durante, e il giorno dopo non peggiora: puoi continuare. Se sale, torna indietro di un passo."]);
    }
    if (Z.esercizi) consigli.push(["Esercizi per la zona", Z.esercizi]);
    if (sport.corsa !== "si") consigli.push(["Tornare a correre", "Quando cammini senza dolore e fai 10 saltelli su una gamba senza fastidio: corsa e cammino alternati (1' e 1', 10 volte) a giorni alterni, poi allunghi la corsa di 1' ogni volta."]);
    carb = { deficit: "metà", testo: "Metà deficit e proteine piene: i tessuti guariscono meglio con energia sufficiente." };
    allarmi.push("Non riesci a caricare il peso o la zona è molto gonfia", "Dolore di notte o che cresce giorno dopo giorno", "Formicolio, intorpidimento o una caduta, una storta forte");
  }
  return { tipo: S.tipo, titolo, sotto, stop, livello, fase, sport, consigli, allarmi, carb, giorni, dal: S.dal };
}

// Sedute dei prossimi 7 giorni: cosa cambia (tieni, leggera, sostituisci, riposo)
function propostaSalute(K, evs, now, opz = {}) {
  if (!K) return [];
  // malattia: i prossimi 3 giorni (poi si rivede con «Sto meglio»); infortunio: la settimana
  const oggi = ymd(now), fine = ymd(addDays(now, K.tipo === "malattia" ? 2 : 6));
  const alt = (sp) => ["bici", "nuoto", "corsa"].find((k) => k !== sp && K.sport[k] !== "no" && (opz.sport || CONFIG.sport || []).includes(k)) || null;
  const out = [];
  for (const e of evs) {
    if (!e || e.done || !e.date || e.date < oggi || e.date > fine || (e.category || "WORKOUT") !== "WORKOUT") continue;
    if (opz.soloApp && !String(e.external_id || "").startsWith("hud-")) continue;
    const sp = e.sport, min = e.min || 0, reg = K.sport[sp] || "si", q = isQualityEv(e) || (sp === "corsa" && min >= 75) || (sp === "bici" && min >= 120);
    if (sp === "altro" || (sp === "forza" && reg !== "no")) continue; // la palestra si adatta con i consigli, non si riscrive
    let azione = "tieni", nuovo = null, motivo = "";
    const leggera = (spN, m, perche) => ({ sport: spN, min: Math.max(15, Math.round(m / 5) * 5), perche });
    if (reg === "no") {
      const a = K.stop ? null : alt(sp);
      if (a) { azione = "sostituisci"; nuovo = leggera(a, a === "bici" && sp === "corsa" ? Math.min(150, min * 1.2) : a === "nuoto" ? Math.min(60, min) : min, `${SPORT[sp].label.toLowerCase()} in pausa`); motivo = `${SPORT[sp].label} in pausa: ${SPORT[a].label.toLowerCase()} facile`; }
      else { azione = "riposo"; motivo = K.tipo === "malattia" ? "riposo finché non passa" : `${SPORT[sp].label.toLowerCase()} in pausa`; }
    } else if (reg === "facile") {
      // infortunio: via l'intensità e un po' di durata dai lunghi, le sedute facili restano; malattia: più corte
      const cap = K.tipo === "infortunio" ? (q ? Math.max(30, Math.round(min * 0.8)) : min) : K.fase === "lieve" ? 45 : Math.round(min * 0.6);
      if (q || min > cap) { azione = "leggera"; nuovo = leggera(sp, Math.min(min, cap), "solo facile"); motivo = q ? (cap < min ? `niente intensità, al massimo ${fmtMin(cap)}` : "niente intensità") : `al massimo ${fmtMin(cap)}`; }
    }
    if (azione !== "tieni") out.push({ id: e.id, data: e.date, sport: sp, nome: e.name || SPORT[sp].label, min, azione, nuovo, motivo, ext: e.external_id || null });
  }
  return out;
}
// Il testo della seduta nuova su Intervals (passi a zone di frequenza cardiaca; il nuoto senza passi)
function testoSalute(n, titolo) {
  const nota = `Proposta dall'HUD (${titolo}): ${n.perche}. Dolore massimo 3 su 10.`;
  if (n.sport === "nuoto") return `${nota}\n\nNuoto facile ${n.min}': bracciate lunghe, niente intensità.`;
  const centro = Math.max(5, n.min - 15);
  return `${nota}\n\n- 10m Z1 HR\n- ${centro}m Z2 HR\n- 5m Z1 HR`;
}
const TIPO_IV = { corsa: "Run", nuoto: "Swim", forza: "WeightTraining" };
// Applica la proposta: copia di ogni seduta prima di cambiarla, così «Annulla» la rimette com'era
async function applicaSalute(key, K, prop, raw, dia) {
  const prima = [];
  const tipoBici = (() => { const L = (raw.activities || []).filter((a) => sportOf(a.type) === "bici").slice(0, 10); return L.filter((a) => /virtual/i.test(a.type || "")).length > L.length / 2 ? "VirtualRide" : "Ride"; })();
  let fatte = 0;
  for (const p of prop) {
    const e = (raw.events || []).find((x) => String(x.id) === String(p.id));
    if (!e) continue;
    const copia = { id: e.id, category: e.category || "WORKOUT", start_date_local: e.start_date_local, type: e.type, name: e.name, description: e.description || "", moving_time: e.moving_time ?? null, icu_training_load: e.icu_training_load ?? null, external_id: e.external_id || null };
    try {
      if (p.azione === "riposo") await ivRichiesta(key, "DELETE", `/events/${e.id}`);
      else {
        const n = p.nuovo, body = { name: `${n.sport === p.sport ? e.name : SPORT[n.sport].label + " facile"} · adattata`, description: testoSalute(n, K.titolo), moving_time: n.min * 60, icu_training_load: null };
        if (n.sport !== p.sport) body.type = n.sport === "bici" ? tipoBici : TIPO_IV[n.sport] || e.type;
        const r = await ivRichiesta(key, "PUT", `/events/${e.id}`, body);
        Object.assign(e, body, r && typeof r === "object" ? { workout_doc: r.workout_doc } : {});
      }
      prima.push({ ...copia, azione: p.azione });
      fatte++;
    } catch (err) { registro(`seduta ${e.id} non adattata: ${err.message || err}`); }
  }
  if (prima.length) {
    const tolte = new Set(prima.filter((x) => x.azione === "riposo").map((x) => String(x.id)));
    raw.events = (raw.events || []).filter((x) => !tolte.has(String(x.id)));
    dia.salute.modifiche = [...(dia.salute.modifiche || []), ...prima];
    dia.salute.applicata = new Date().toISOString();
  }
  return fatte;
}
async function annullaSalute(key, raw, dia) {
  const L = (dia.salute && dia.salute.modifiche) || [];
  let rimesse = 0;
  for (const c of L.slice().reverse()) {
    try {
      if (c.azione === "riposo") {
        const { id, azione, ...ev } = c;
        if (!ev.external_id) delete ev.external_id;
        const r = await ivRichiesta(key, "POST", "/events/bulk?upsert=true", [ev]);
        const nuovo = Array.isArray(r) && r[0] ? r[0] : { ...ev, id: c.id };
        raw.events = [...(raw.events || []), nuovo];
      } else {
        const body = { name: c.name, description: c.description, moving_time: c.moving_time, type: c.type, icu_training_load: c.icu_training_load };
        const r = await ivRichiesta(key, "PUT", `/events/${c.id}`, body);
        const e = (raw.events || []).find((x) => String(x.id) === String(c.id));
        if (e) Object.assign(e, body, r && typeof r === "object" ? { workout_doc: r.workout_doc } : {});
      }
      rimesse++;
    } catch (err) { registro(`seduta ${c.id} non rimessa: ${err.message || err}`); }
  }
  if (dia.salute) { dia.salute.modifiche = []; delete dia.salute.applicata; }
  return rimesse;
}

// ------------------------------------------------------------
//  Riscaldamento prima della seduta, mobilità del giorno e palestra nel piano.
//  Gli esercizi (foto e come si fanno) sono nella libreria della pagina: qui solo le chiavi.
// ------------------------------------------------------------
const RISC = {
  "corsa-facile": { t: "Corsa facile o lunga", sp: "corsa", min: 5, passi: [["caviglie", "Cerchi con le caviglie", "10 per verso"], ["cerchianca", "Cerchi con l’anca", "8 per lato"], ["wgs", "Affondo con rotazione", "3 per lato"], [null, "I primi 10 minuti più piano", "lascia salire i battiti da soli"]], nota: "Per le uscite facili basta poco: il vero riscaldamento sono i primi minuti lenti." },
  "corsa-qualita": { t: "Corsa di qualità", sp: "corsa", min: 15, passi: [[null, "8–10 minuti di corsa facile", "gli ultimi 2 un po’ più svelti"], ["wgs", "Affondo con rotazione", "3 per lato"], ["skip", "Skip", "2 × 20 m"], ["calciata", "Calciata", "2 × 20 m"], [null, "3 allunghi di 20 secondi", "veloci ma sciolti, ritorno camminando"]], nota: "Prima delle ripetute il corpo deve arrivare già caldo: i battiti salgono prima e la prima ripetuta non va sprecata." },
  "bici": { t: "Bici facile o lunga", sp: "bici", min: 5, passi: [[null, "5 minuti agili", "cadenza 85–95, battiti bassi"], [null, "Poi entra nel ritmo della seduta", "senza strappi in salita nei primi 15 minuti"]], nota: "In bici il riscaldamento si fa pedalando: niente esercizi a terra." },
  "bici-qualita": { t: "Bici di qualità", sp: "bici", min: 12, passi: [[null, "5 minuti agili", "cadenza 85–95, battiti bassi"], [null, "3 minuti con la cadenza che sale", "ogni minuto 5 pedalate in più"], [null, "3 accelerazioni di 30 secondi", "1 minuto facile tra una e l’altra"], [null, "2 minuti facili", "poi parte la prima ripetuta"]], nota: "Le prime ripetute vengono meglio con le gambe già sveglie: le accelerazioni servono a questo." },
  "nuoto": { t: "Nuoto", sp: "nuoto", min: 8, passi: [["cerchibraccia", "Cerchi con le braccia", "30\" avanti e indietro"], ["apertura", "Apertura con elastico", "15"], ["rotest", "Rotazione esterna con elastico", "10 per lato"], [null, "In acqua: 200–400 m facili", "misti, poi 4 × 25 m in progressione"]], nota: "Le spalle sono la parte che soffre di più nel nuoto: 5 minuti a bordo vasca evitano fastidi." },
  "palestra": { t: "Palestra", sp: "forza", min: 6, passi: [["gattomucca", "Gatto-mucca", "45\""], ["inchworm", "Inchworm", "5"], ["ponte", "Ponte glutei", "10"], [null, "2 serie leggere del primo esercizio", "metà carico, 8 ripetizioni"]], nota: "Le serie leggere servono a provare il movimento prima di caricare." },
};
function riscDi(e) {
  if (!e) return null;
  const q = e.parsed ? isQualityEv(e) : false;
  if (e.sport === "corsa") return q ? "corsa-qualita" : "corsa-facile";
  if (e.sport === "bici") return q ? "bici-qualita" : "bici";
  if (e.sport === "nuoto") return "nuoto";
  if (e.sport === "forza") return "palestra";
  return null;
}
// Il blocco «Prima di partire» nel dettaglio della seduta e nel foglio di domani
function riscHTML(e) {
  const k = riscDi(e), R = k && RISC[k];
  if (!R) return "";
  return `<div class="label caps" style="margin:2px 2px -4px">Prima di partire · ${R.min}'</div>
  <div class="steps riscl">${R.passi.map((p) => `<div class="rr"><span class="t15 grow">${esc(p[1])}</span><span class="t13 muted">${esc(p[2] || "")}</span></div>`).join("")}</div>
  ${R.passi.some((p) => p[0]) ? `<button class="linkbtn" data-risc="${k}" style="align-self:flex-start">Guarda come si fanno ›</button>` : ""}`;
}

// La libreria degli esercizi: [chiave, nome, id nel Free Exercise DB, attrezzo, gruppo, dose, come si fa]
const ESL = [
 ['squat','Squat a corpo libero','Bodyweight_Squat','libero','gambe','12','Piedi larghi come le spalle, scendi come per sederti, ginocchia nella direzione delle punte, schiena dritta.'],
 ['goblet','Goblet squat','Goblet_Squat','manubri','gambe','10','Peso al petto, gomiti dentro le ginocchia in basso. Scendi lento, spingi dai talloni.'],
 ['squatbil','Squat con bilanciere','Barbell_Squat','palestra','gambe','8','Bilanciere sui trapezi, petto alto, scendi fino a cosce parallele. Carico che lascia 2 ripetizioni di riserva.'],
 ['legpress','Leg press','Leg_Press','palestra','gambe','10','Piedi a metà pedana, scendi finché la schiena resta appoggiata, non bloccare le ginocchia in alto.'],
 ['affondo','Affondi in camminata','Bodyweight_Walking_Lunge','libero','mono','8 per lato','Passo lungo, ginocchio dietro quasi a terra, busto dritto. Spingi con il tallone davanti.'],
 ['affondoman','Affondo indietro con manubri','Dumbbell_Rear_Lunge','manubri','mono','8 per lato','Fai un passo indietro, scendi in verticale, torna spingendo con la gamba davanti.'],
 ['bulgaro','Split squat con manubri','Split_Squat_with_Dumbbells','manubri','mono','8 per lato','Gambe a forbice, scendi dritto in basso, peso sulla gamba davanti.'],
 ['stepup','Step-up con manubri','Dumbbell_Step_Ups','manubri','mono','8 per lato','Sali su una panca o un gradino alto spingendo solo con la gamba sopra, scendi lento.'],
 ['stepupl','Step-up con ginocchio alto','Step-up_with_Knee_Raise','libero','mono','10 per lato','Sali sul gradino e porta su l’altro ginocchio, come in corsa. Scendi controllato.'],
 ['rdl','Stacco rumeno','Romanian_Deadlift','palestra','post','8','Ginocchia appena piegate, scendi spingendo il bacino indietro, bilanciere vicino alle gambe, schiena dritta.'],
 ['rdl1','Stacco su una gamba','Kettlebell_One-Legged_Deadlift','manubri','post','8 per lato','In equilibrio su una gamba, busto avanti e gamba dietro in linea. Il peso scende vicino alla gamba.'],
 ['ponte','Ponte glutei','Butt_Lift_Bridge','libero','post','15','Schiena a terra, piedi vicini ai glutei: alza il bacino stringendo i glutei, 2 secondi su.'],
 ['ponte1','Ponte su una gamba','Single_Leg_Glute_Bridge','libero','glutei','12 per lato','Come il ponte, ma su una gamba. Il bacino resta dritto, non ruota.'],
 ['hipthrust','Hip thrust','Barbell_Hip_Thrust','palestra','post','10','Schiena sulla panca, bilanciere sul bacino: spingi in alto fino ad allineare busto e cosce.'],
 ['polpacci','Sollevamenti sulle punte','Standing_Dumbbell_Calf_Raise','libero','polpacci','15','Su un gradino, sali in punta in 1 secondo e scendi in 3 sotto il gradino. Anche su una gamba sola.'],
 ['polpaccim','Sollevamenti sulle punte con manubri','Standing_Dumbbell_Calf_Raise','manubri','polpacci','12','Manubri in mano, su un gradino: su veloce, giù lento in 3 secondi.'],
 ['polpaccip','Polpacci alla macchina','Standing_Calf_Raises','palestra','polpacci','12','Spalle sotto i cuscinetti, scendi bene con i talloni, sali in punta e tieni 1 secondo.'],
 ['legcurl','Leg curl','Lying_Leg_Curls','palestra','post','10','Piega le ginocchia portando i talloni verso i glutei, torna giù lento.'],
 ['mostro','Camminata laterale con elastico','Monster_Walk','elastico','glutei','12 passi per lato','Elastico sopra le ginocchia o alle caviglie, mezzo piegamento, passi laterali senza far cedere le ginocchia.'],
 ['adduttori','Adduttori con elastico','Band_Hip_Adductions','elastico','glutei','12 per lato','Elastico alla caviglia, porta la gamba verso l’interno davanti all’altra, lento.'],
 ['swing','Swing con kettlebell','One-Arm_Kettlebell_Swings','manubri','plio','15','Spinta del bacino, non delle braccia: il peso sale fino al petto, schiena dritta.'],
 ['squatjump','Squat jump','Freehand_Jump_Squat','libero','plio','8','Mezzo squat e salto, atterra morbido sulle punte e riparti. Solo se senza dolori.'],
 ['skip','Skip veloce','Fast_Skipping','libero','plio','2 × 20 m','Passi corti e rapidi sull’avampiede, ginocchia su, braccia che lavorano.'],
 ['balzilat','Balzi laterali','Lateral_Bound','libero','plio','6 per lato','Salta di lato su una gamba e atterra stabile sull’altra, tieni 1 secondo.'],
 ['plank','Plank','Plank','libero','core','40"','Gomiti sotto le spalle, corpo in linea, glutei e addome stretti. Respira.'],
 ['plankl','Plank laterale','Side_Bridge','libero','core','30" per lato','Su un gomito, bacino alto in linea con spalle e piedi.'],
 ['deadbug','Dead bug','Dead_Bug','libero','core','8 per lato','Schiena incollata a terra: allunga braccio e gamba opposti, torna, cambia lato.'],
 ['superman','Superman','Superman','libero','core','10','A pancia in giù, alza insieme braccia e gambe di pochi centimetri, tieni 2 secondi.'],
 ['pallof','Pallof press','Pallof_Press','palestra','core','10 per lato','Cavo o elastico al fianco: spingi le mani avanti e non lasciarti ruotare.'],
 ['russian','Russian twist','Russian_Twist','libero','core','12 per lato','Seduto, busto inclinato indietro, ruota le spalle da un lato all’altro.'],
 ['mountain','Mountain climber','Mountain_Climbers','libero','core','30"','In posizione di piegamento, porta le ginocchia al petto alternando, bacino basso.'],
 ['piegamenti','Piegamenti','Pushups','libero','spinta','10','Mani sotto le spalle, corpo in linea, petto a un pugno dal pavimento. Sulle ginocchia se serve.'],
 ['panca','Panca piana','Barbell_Bench_Press_-_Medium_Grip','palestra','spinta','8','Scapole strette sulla panca, il bilanciere scende a metà petto, spingi in su.'],
 ['spinte','Spinte sopra la testa','Dumbbell_Shoulder_Press','manubri','spinta','10','Manubri all’altezza delle spalle, spingi in alto senza inarcare la schiena.'],
 ['rematore','Rematore con manubri','Bent_Over_Two-Dumbbell_Row','manubri','tirata','10','Busto inclinato, schiena dritta: porta i gomiti indietro vicino ai fianchi.'],
 ['rematorebil','Rematore con bilanciere','Bent_Over_Barbell_Row','palestra','tirata','8','Busto a 45 gradi, tira il bilanciere verso l’ombelico, scapole strette.'],
 ['lat','Lat machine','Wide-Grip_Lat_Pulldown','palestra','tirata','10','Tira la barra al petto portando i gomiti in basso, petto alto, niente slanci.'],
 ['trazioni','Trazioni','Chin-Up','libero','tirata','5','Alla sbarra, tira il mento sopra la barra. Con l’elastico se servono aiuti.'],
 ['facepull','Face pull','Face_Pull','palestra','spalle','12','Corda al cavo alto: tira verso il viso aprendo i gomiti, scapole indietro.'],
 ['rotest','Rotazione esterna con elastico','External_Rotation_with_Band','elastico','spalle','15 per lato','Gomito attaccato al fianco a 90 gradi, ruota l’avambraccio verso l’esterno. Lento.'],
 ['apertura','Apertura con elastico','Band_Pull_Apart','elastico','spalle','15','Braccia tese davanti, apri l’elastico fino al petto stringendo le scapole.'],
 ['alzatepost','Alzate posteriori','Seated_Bent-Over_Rear_Delt_Raise','manubri','spalle','12','Seduto e piegato in avanti, apri le braccia di lato con i gomiti morbidi.'],
 ['contadino','Camminata del contadino','Farmers_Walk','manubri','core','40 m','Due pesi pesanti ai lati, cammina dritto con le spalle basse e l’addome stretto.'],
 ['gattomucca','Gatto-mucca','Cat_Stretch','libero','mob','60"','A quattro zampe: inarca e arrotonda la schiena con il respiro, lento.'],
 ['wgs','Affondo con rotazione','Worlds_Greatest_Stretch','libero','mob','5 per lato','Affondo lungo, gomito verso il piede davanti, poi ruota il busto aprendo il braccio al cielo.'],
 ['flessori','Flessori dell’anca in ginocchio','Kneeling_Hip_Flexor','libero','mob','45" per lato','Un ginocchio a terra, bacino in avanti e glutei stretti: senti tirare davanti all’anca.'],
 ['caviglie','Cerchi con le caviglie','Ankle_Circles','libero','mob','10 per verso','Disegna cerchi ampi con la punta del piede, nei due versi.'],
 ['polpaccimuro','Polpacci al muro','Calf_Stretch_Hands_Against_Wall','libero','mob','45" per lato','Mani al muro, gamba dietro tesa e tallone a terra; poi ginocchio piegato per il soleo.'],
 ['femorali','Allungamento dei femorali','Hamstring_Stretch','libero','mob','45" per lato','Gamba tesa, porta il busto in avanti dalla piega dell’anca, schiena lunga.'],
 ['quad','Quadricipite in piedi','Standing_Elevated_Quad_Stretch','libero','mob','45" per lato','Piede dietro appoggiato in alto, ginocchio verso il basso, bacino in avanti.'],
 ['bambino','Posizione del bambino','Childs_Pose','libero','mob','60"','Seduto sui talloni, braccia avanti e fronte a terra. Respira nella schiena.'],
 ['ginpetto','Ginocchio al petto','One_Knee_To_Chest','libero','mob','45" per lato','Sdraiato, porta un ginocchio al petto, l’altra gamba resta lunga.'],
 ['torsione','Torsione della schiena','Spinal_Stretch','libero','mob','45" per lato','Seduto o sdraiato, ruota il busto da un lato tenendo il bacino fermo.'],
 ['groiners','Groiners','Groiners','libero','mob','6 per lato','Da piegamento, porta un piede accanto alla mano e spingi il bacino giù, poi cambia.'],
 ['inchworm','Inchworm','Inchworm','libero','mob','5','Piegati e cammina con le mani fino al piegamento, poi torna con i piedi verso le mani.'],
 ['cerchibraccia','Cerchi con le braccia','Arm_Circles','libero','mob','30"','Braccia tese di lato, cerchi piccoli che diventano grandi, avanti e indietro.'],
 ['petto','Apertura del petto','Dynamic_Chest_Stretch','libero','mob','30"','Apri e chiudi le braccia davanti al petto, ampie e senza strappi.'],
 ['cerchianca','Cerchi con l’anca','Standing_Hip_Circles','libero','mob','8 per lato','In piedi, ginocchio su e disegna un cerchio grande con l’anca.'],
 ['calciata','Calciata','Double_Leg_Butt_Kick','libero','plio','2 × 20 m','Corsa sul posto o avanzando, talloni ai glutei, passi rapidi.'],
 ['rullopiri','Piriforme con il rullo','Piriformis-SMR','palestra','mob','60" per lato','Seduto sul rullo, caviglia sul ginocchio opposto, rotola piano sul gluteo.'],
 ['rulloquad','Quadricipiti con il rullo','Quadriceps-SMR','palestra','mob','60"','A pancia in giù sul rullo, rotola dall’anca al ginocchio, lento.']
];
const ES_NOME = new Map(ESL.map((x) => [x[1].toLowerCase(), x[0]]));
// Gli esercizi scritti nella descrizione di una seduta di palestra («Goblet squat · 3 × 10»)
function eserciziDi(e) {
  const out = [];
  for (const riga of String((e && e.description) || "").split("\n")) {
    const [nome, dose] = riga.replace(/^[-•*\s]+/, "").split(" · ");
    const k = ES_NOME.get((nome || "").trim().toLowerCase());
    if (k && !out.some((x) => x[0] === k)) out.push([k, (dose || "").trim()]);
  }
  return out;
}
function eserciziHTML(e) {
  const L = eserciziDi(e);
  if (L.length < 2) return "";
  const dati = L.map(([k, d]) => `${k}:${d.replace(/[,:"<>]/g, " ")}`).join(",");
  return `<h3>Gli esercizi</h3><div class="card list esl" data-esl="${esc(dati)}"></div><button class="primary" data-gymgo="${esc(dati)}">Inizia con la guida</button>`;
}

// Le routine di mobilità: [esercizio, secondi, lati]
const MOB = {
  anche: ["Anche e caviglie", [["polpaccimuro", 45, 2], ["flessori", 45, 2], ["femorali", 45, 2], ["ginpetto", 45, 2], ["gattomucca", 60, 1], ["bambino", 60, 1]]],
  schiena: ["Schiena e spalle", [["gattomucca", 60, 1], ["bambino", 60, 1], ["torsione", 45, 2], ["petto", 45, 1], ["cerchibraccia", 30, 1], ["inchworm", 60, 1]]],
  risveglio: ["Risveglio", [["caviglie", 30, 1], ["cerchianca", 30, 2], ["wgs", 45, 2], ["inchworm", 45, 1], ["gattomucca", 45, 1], ["cerchibraccia", 30, 1]]],
  sera: ["Prima di dormire", [["bambino", 90, 1], ["ginpetto", 45, 2], ["torsione", 45, 2], ["femorali", 45, 2], ["quad", 45, 2]]],
};
// l'app può scrivere sedute su Intervals? (no in demo, senza chiave o con un piano proprio)
const SCRIVE_APP = (A) => !A.demo && !A.needSetup && !(typeof PROF !== "undefined" && PROF && PROF.pianoApp === false);
function mobMin(R) { return Math.round(R[1].reduce((t, x) => t + x[1] * x[2] + 10 * x[2], 0) / 60); }
// La routine consigliata oggi: dopo corsa o bici anche e caviglie, dopo nuoto o palestra schiena e spalle
function mobDelGiorno(A) {
  const h = A.now.getHours(), sp = new Set((A.todayEv || []).map((e) => e.sport));
  if (A.gymToday) sp.add("forza");
  if (h >= 21) return ["sera", "prima di dormire"];
  if (h < 9) return ["risveglio", "per iniziare la giornata"];
  if (sp.has("corsa")) return ["anche", "dopo la corsa"];
  if (sp.has("bici")) return ["anche", "dopo la bici"];
  if (sp.has("nuoto")) return ["schiena", "dopo il nuoto"];
  if (sp.has("forza")) return ["schiena", "dopo la palestra"];
  return [Math.floor(A.now.getTime() / 864e5) % 2 ? "anche" : "schiena", "giorno di riposo"];
}

// «Metti nel piano»: la seduta di palestra scelta diventa una seduta su Intervals (una sola per giorno: se c'è già, si aggiorna)
async function palestraNelPiano(key, o, raw) {
  const oggi = ymd(new Date()), fino = ymd(addDays(new Date(), 13));
  if (!/^\d{4}-\d\d-\d\d$/.test(o.data || "") || o.data < oggi || o.data > fino) throw new Error("giorno non valido");
  const min = Math.max(10, Math.min(120, Math.round(+o.min || 30)));
  const righe = (Array.isArray(o.righe) ? o.righe : []).slice(0, 14).map((r) => String(r).replace(/[\r\n]+/g, " ").replace(/(\d+)\s*["″]/g, "$1 secondi").replace(/(\d+)\s*['′]/g, "$1 minuti").slice(0, 90));
  const nome = String(o.nome || "Palestra").replace(/[\r\n]+/g, " ").slice(0, 60);
  const ext = `hudgym-${o.data}`;
  const corpo = { category: "WORKOUT", type: "WeightTraining", name: nome, moving_time: min * 60, description: [`${nome} · ${min}'`, ...righe, "", "Dall'HUD: foto e video degli esercizi nella scheda Piano › Palestra."].join("\n") };
  const gia = await ivRichiesta(key, "GET", `/events?oldest=${o.data}&newest=${o.data}`);
  const stesso = (Array.isArray(gia) ? gia : []).find((e) => e.external_id === ext);
  let ev;
  if (stesso) ev = await ivRichiesta(key, "PUT", `/events/${stesso.id}`, corpo);
  else ev = await ivRichiesta(key, "POST", "/events", { ...corpo, start_date_local: `${o.data}T18:00:00`, external_id: ext });
  if (ev && ev.id && Array.isArray(raw.events)) raw.events = [...raw.events.filter((e) => String(e.id) !== String(ev.id)), ev];
  return { nuovo: !stesso, data: o.data };
}

// Diario locale: check-in e proposte accettate (solo su questo iPhone)
function diaryIO() {
  const fm = FileManager.local();
  const p = fm.joinPath(fm.documentsDirectory(), "hud-diario.json");
  return {
    read: () => { try { return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : {}; } catch (e) { return {}; } },
    write: (o) => fm.writeString(p, JSON.stringify(o)),
  };
}

// ------------------------------------------------------------
//  Campana: le notifiche dell'app. Sono le stesse che arrivano sul telefono (all'ora in cui arrivano),
//  più i record, gli avvisi scritti sull'orologio e le sedute sincronizzate. Restano 30 giorni.
// ------------------------------------------------------------
const CAMP_FILE = "hud-campana.json";
let CAMPANA = { lista: [] };
function campanaIO() {
  const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), CAMP_FILE);
  return {
    read: () => { try { const o = fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; return o && Array.isArray(o.lista) ? o : { lista: [] }; } catch (e) { return { lista: [] }; } },
    write: (o) => { try { fm.writeString(p, JSON.stringify(o)); } catch (e) { console.log("Campana non salvata: " + e); } },
  };
}
// aggiunge una voce o, con lo stesso id, ne aggiorna il testo (se era già letta resta letta)
function campanaMetti(C, v, now) {
  const i = C.lista.findIndex((x) => x.id === v.id);
  if (i >= 0) C.lista[i] = { ...C.lista[i], ...v, letta: !!(v.letta || C.lista[i].letta) };
  else C.lista.push({ letta: false, ...v });
  const lim = addDays(now, -30).toISOString();
  C.lista = C.lista.filter((x) => x.t >= lim).sort((a, b) => b.t.localeCompare(a.t)).slice(0, 40);
}
// quelle già arrivate (le programmate compaiono all'ora della notifica)
const campanaArrivate = (C, now) => (C.lista || []).filter((x) => new Date(x.t) <= now);
function campanaSegnaLette(C, now, filtro) { for (const x of C.lista || []) if (new Date(x.t) <= now && (!filtro || filtro(x))) x.letta = true; }

// ------------------------------------------------------------
//  Domani: la sera prima, l'allenamento nel dettaglio (notifica sul telefono e foglio nell'app)
// ------------------------------------------------------------
const TESTO_RICARICA = "Stasera cena di ricarica: un piatto abbondante di pasta o riso, poca fibra.";
const oraEv = (e) => { const h = String(e.start_date_local || "").slice(11, 16); return h && h !== "00:00" ? h : null; };
// i passi in una riga: «15' Z1 · 6× 5' 4:55/km / 2' Z1 · 10' Z1»
function passiBrevi(parsed, max = 6) {
  const R = (parsed && parsed.rows) || [], out = [];
  const uno = (r) => `${r.len || ""}${r.targets && r.targets[0] ? " " + r.targets[0].t : ""}`.trim();
  for (let i = 0; i < R.length && out.length < max; i++) {
    const r = R[i];
    if (r.plain) continue;
    if (r.header) {
      const sub = []; let j = i + 1;
      while (j < R.length && R[j].indent) { sub.push(uno(R[j])); j++; }
      out.push(`${r.header} ${sub.filter(Boolean).join(" / ")}`.trim()); i = j - 1; continue;
    }
    if (uno(r)) out.push(uno(r));
  }
  return out.join(" · ");
}
// cosa prendere: «4 gel (100 g)», con la borraccia se è nei prodotti
function rifBreve(S) {
  if (!S) return "";
  const conta = new Map();
  for (const v of S.voci) if (v.tipo === "mangia") conta.set(v.nome, (conta.get(v.nome) || 0) + 1);
  if (!conta.size) return "";
  const pr = [...conta].map(([n, k]) => `${k} ${n}`).join(" + ");
  return `${S.borraccia ? S.borraccia.nome + " in borraccia + " : ""}${pr} (${S.g} g di carboidrati)`;
}
// la borsa: dipende dagli sport, dal chiuso o fuori e dal rifornimento
function daPreparare(A) {
  const evs = (A.tomorrowEv || []).filter((e) => !e.done), out = [];
  const add = (x) => { if (x && !out.includes(x)) out.push(x); };
  for (const e of evs) {
    const indoor = e.trainer === true || /virtual/i.test(e.type || "") || /tapis|treadmill|indoor|rulli|spinning|cyclette/i.test(e.name || "");
    if (e.sport === "nuoto") { add("costume, cuffia e occhialini"); add("asciugamano e ciabatte"); }
    if (e.sport === "forza") add("borsa della palestra");
    if (e.sport === "corsa") { const g = gearPer(e, (A.diary || {}).gear); add(g ? `le ${g.nome}` : null); if (indoor) add("asciugamano"); }
    if (e.sport === "bici") { if (indoor) { add("ventilatore e asciugamano"); add(e.min >= 60 ? "2 borracce" : "una borraccia"); } else { add("casco e luci"); add("2 borracce"); } }
    if (e.rif) { const r = rifBreve(e.rif); if (r) add(r.replace(/ \(\d+ g di carboidrati\)$/, "").replace(" in borraccia", "")); else if (e.rif.voci.length) add("acqua"); }
  }
  if (A.domani && A.domani.palestra) add("borsa della palestra");
  return out.slice(0, 6);
}
function promemoriaDomani(A) {
  const D = A.domani;
  if (!D) return null;
  const evs = (A.tomorrowEv || []).filter((e) => !e.done);
  if (!evs.length && !D.palestra) return null;
  const nomi = evs.map((e) => `${e.name || (SPORT[e.sport] || SPORT.altro).label}${e.min ? " " + fmtMin(e.min) : ""}`);
  if (D.palestra) nomi.push("Palestra");
  const righe = [];
  for (const e of evs) {
    const s = SPORT[e.sport] || SPORT.altro, ora = oraEv(e), p = passiBrevi(e.parsed) || keyLine(e.parsed) || (e.min ? fmtMin(e.min) : "");
    righe.push(`${evs.length > 1 || ora ? `${s.label}${ora ? " alle " + ora : ""}: ` : ""}${p}`);
    if (e.rif && e.rif.voci.some((v) => v.tipo === "mangia")) righe.push(`Durante: ${rifBreve(e.rif)}`);
  }
  if (D.palestra) righe.push(`Palestra: ${D.palestra}`);
  if (D.chiave && (CONFIG.notifiche || {}).ricarica !== false) righe.push(TESTO_RICARICA);
  const prep = daPreparare(A);
  if (prep.length) righe.push(`Prepara: ${prep.join(", ")}`);
  return { titolo: `Domani · ${nomi.join(" + ")}`, testo: righe.filter(Boolean).join("\n"), data: D.data };
}
// il foglio «Domani» nell'app: sedute con i passi, cosa prendere, la borsa, il carburante del giorno
function domaniHTML(A) {
  const D = A.domani, evs = (A.tomorrowEv || []).filter((e) => !e.done), d = parseYMD(D.data), P = D.piano;
  const TIPO = { lungo: "Giorno lungo", duro: "Giorno duro", medio: "Giorno medio", riposo: "Giorno di riposo" };
  const testa = `<div class="domh"><div class="t28 bold">${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}</div>
    ${P ? `<div class="hstack" style="gap:8px;flex-wrap:wrap"><span class="pill" style="background:var(--fill)">${TIPO[P.tipo] || ""}</span><span class="t15 muted">${fmtIt(P.kcal)} kcal · ${fmtIt(P.C)} g di carboidrati</span></div>` : ""}</div>`;
  const sedute = evs.map((e) => {
    const s = SPORT[e.sport] || SPORT.altro, ora = oraEv(e), key = keyLine(e.parsed), steps = stepsList(e.parsed, e.sport);
    const indoor = e.trainer === true || /virtual/i.test(e.type || "") || /tapis|treadmill|indoor|rulli|spinning|cyclette/i.test(e.name || "");
    const orologio = e.rif && e.rif.voci.some((v) => v.tipo === "mangia") && haAvvisi(e.description) ? `<div class="t13 muted" style="line-height:1.4">Avvia la seduta dall'allenamento del giorno sull'orologio: gli avvisi arrivano da soli.</div>` : "";
    return `<div class="dcard">
      <div class="dhead"><span class="evbar" style="background:${s.c}"></span><div class="grow"><div class="t17 semi">${esc(e.name || s.label)}</div><div class="sub">${s.label}${indoor ? " al chiuso" : ""}${ora ? ` · alle ${ora}` : ""}</div></div></div>
      ${detStats([["Durata", e.min ? fmtMin(e.min) : null], ["Distanza", num(e.distance) ? fmtDist(e.distance, e.sport) : null], ["Carico", e.load ? `${Math.round(e.load)} TSS` : null]])}
      ${riscHTML(e)}
      ${e.sport === "forza" && eserciziDi(e).length >= 2 ? eserciziHTML(e) : steps ? `<div class="label caps" style="margin:2px 2px -4px">I passi</div>${steps}` : key ? `<div class="keyline">${esc(key)}</div>` : ""}
      ${e.rif ? rifSedutaHTML(e) : ""}${orologio}
    </div>`;
  }).join("");
  const gym = D.palestra ? `<div class="dcard"><div class="dhead"><span class="evbar" style="background:${SPORT.forza.c}"></span><div class="grow"><div class="t17 semi">Palestra</div><div class="sub">${esc(D.palestra)}</div></div></div>${riscHTML({ sport: "forza" })}</div>` : "";
  const prep = daPreparare(A), cena = D.chiave && (CONFIG.notifiche || {}).ricarica !== false ? TESTO_RICARICA : null;
  const stasera = prep.length || cena ? `<h3>Stasera</h3><div class="card list">${cena ? `<div class="lrow"><span class="t15" style="line-height:1.4;white-space:normal">${esc(cena)}</span></div>${prep.length ? '<div class="sep l16"></div>' : ""}` : ""}${prep.map((x) => `<label class="lrow prep"><input type="checkbox"><span class="t15 grow" style="white-space:normal">Prepara ${esc(x)}</span></label>`).join('<div class="sep l16"></div>')}</div>` : "";
  const carb = P ? `<h3>Carburante di domani</h3>${detStats([["Calorie", `${fmtIt(P.kcal)} kcal`], ["Carboidrati", `${fmtIt(P.C)} g`], ["Proteine", `${fmtIt(P.P)} g`], ["Grassi", `${fmtIt(P.G)} g`]])}` : "";
  return `${testa}${sedute}${gym}${stasera}${carb}<button class="primary" id="domok">Ok, a domani</button>`;
}

// Le sedute arrivate da Intervals dopo l'ultima apertura: nella campana e, ad app chiusa (widget), anche sul telefono
async function campanaAttivita(raw, C, now, interattivo, primaVolta) {
  if (primaVolta || !Array.isArray(raw.nuove) || !raw.nuove.length) return 0;
  const N = CONFIG.notifiche || {};
  let n = 0;
  for (const id of raw.nuove.slice(0, 5)) {
    const a = (raw.activities || []).find((x) => String(x.id) === String(id));
    if (!a || !a.start_date_local || (now - new Date(a.start_date_local)) / 36e5 > 36) continue;
    const sp = sportOf(a.type), sec = num(a.moving_time) ?? num(a.elapsed_time) ?? 0, tss = num(a.icu_training_load);
    if (sec < 300 || (sp === "altro" && (tss || 0) < 5)) continue;
    const cid = `att-${a.id}`;
    if (C.lista.some((x) => x.id === cid)) continue;
    const s = SPORT[sp] || SPORT.altro, m = num(a.distance), v = num(a.average_speed);
    const txt = [fmtMin(Math.round(sec / 60)), m && sp !== "forza" ? fmtDist(m, sp) : null,
      sp === "corsa" && v ? `${fmtPace(1000 / v)}/km` : sp === "bici" && v ? `${fmtIt(v * 3.6, 1)} km/h` : sp === "nuoto" && v ? `${fmtPace(100 / v)}/100 m` : null,
      num(a.average_heartrate) ? `FC ${Math.round(a.average_heartrate)}` : null, tss ? `${Math.round(tss)} TSS` : null,
      num(a.compliance) ? `piano al ${Math.round(a.compliance)}%` : null].filter(Boolean).join(" · ");
    const tit = `${a.name || s.label}`, g = a.start_date_local.slice(0, 10);
    campanaMetti(C, { id: cid, t: now.toISOString(), tit, txt, tipo: "att", sp, az: "att:" + g }, now);
    n++;
    if (!interattivo && N.attivita && typeof Notification !== "undefined") {
      try {
        const no = new Notification();
        no.identifier = cid; no.threadIdentifier = "hud"; no.title = `Fatto: ${tit}`; no.body = `${txt}\nTocca per grafici, giri e percorso.`;
        try { no.openURL = `scriptable:///run/${encodeURIComponent(Script.name())}?att=${g}`; } catch (e) {}
        no.setTriggerDate(new Date(now.getTime() + 2000));
        await no.schedule();
      } catch (e) { console.log("Notifica attività: " + e); }
    }
  }
  return n;
}

// Notifiche sul telefono: solo quando c'è qualcosa da fare, al massimo una per tipo al giorno.
// Ognuna finisce anche nella campana, all'ora in cui arriva.
async function scheduleNotifs(A, C, interattivo) {
  if (typeof Notification === "undefined") return;
  C = C || { lista: [] };
  const N = CONFIG.notifiche || {};
  const now = new Date();
  const fm = FileManager.local();
  const p = fm.joinPath(fm.documentsDirectory(), "hud-notifiche.json");
  let sent = {};
  try { if (fm.fileExists(p)) sent = JSON.parse(fm.readString(p)); } catch (e) {}
  const nome = (() => { try { return encodeURIComponent(Script.name()); } catch (e) { return "HUD"; } })();
  const programma = async (id, title, body, date, o = {}) => {
    const n = new Notification();
    n.identifier = id; n.threadIdentifier = "hud"; n.title = title; n.body = body;
    if (o.q) { try { n.openURL = `scriptable:///run/${nome}?${o.q}`; } catch (e) {} }
    n.setTriggerDate(date);
    await n.schedule();
    sent[id] = 1;
    campanaMetti(C, { id, t: date.toISOString(), tit: title, txt: body, tipo: o.tipo || "info", az: o.az || null }, now);
  };
  const once = async (key, title, body, date, o) => { const id = `${key}-${ymd(now)}`; if (sent[id] || date <= now) return; await programma(id, title, body, date, o); };
  // la sera prima: l'allenamento di domani nel dettaglio (si riprogramma a ogni apertura, così il testo resta aggiornato)
  if (N.domani) {
    const [hh, mm] = String(N.domani).split(":").map(Number);
    const quando = new Date(now.getFullYear(), now.getMonth(), now.getDate(), isFinite(hh) ? hh : 19, isFinite(mm) ? mm : 30);
    const id = `domani-${ymd(now)}`, P = C.domaniVisto === ymd(now) ? null : promemoriaDomani(A); // già visto nell'app stasera: niente notifica
    if (!P) {
      if (quando > now) { try { await Notification.removePending([id]); } catch (e) {} C.lista = C.lista.filter((x) => x.id !== id); delete sent[id]; }
    } else if (quando > now) await programma(id, P.titolo, P.testo, quando, { q: "domani=1", tipo: "domani", az: "domani" });
    else if (!sent[id] && now.getHours() < 23) {
      // ora è già passata: con l'app aperta lo mostra il foglio, ad app chiusa arriva adesso
      if (interattivo) { sent[id] = 1; campanaMetti(C, { id, t: now.toISOString(), tit: P.titolo, txt: P.testo, tipo: "domani", az: "domani" }, now); }
      else await programma(id, P.titolo, P.testo, new Date(Date.now() + 60 * 1000), { q: "domani=1", tipo: "domani", az: "domani" });
    }
  }
  if (N.affaticamento && A.ins.fatigue && A.ins.fatigue.level === "rosso") {
    await once("fatica", "Segnale di affaticamento", "Ultime due qualità con FC soppressa e passo peggiore. Apri l'HUD per la proposta.", new Date(Date.now() + 60 * 1000), { tipo: "fatica", az: "oggi" });
  }
  // domenica sera: la settimana è fatta, il riepilogo è pronto da condividere
  if (N.settimana !== false) {
    const dom = addDays(mondayOf(now), 6), quando = new Date(dom.getFullYear(), dom.getMonth(), dom.getDate(), 20, 30), id = `settimana-${ymd(dom)}`;
    if (!sent[id] && quando > now) await programma(id, "La tua settimana", "Ore, km e carico in un'immagine: tocca per vederla e condividerla.", quando, { q: "settimana=1", tipo: "settimana", az: "settimana" });
  }
  // tieni solo le ultime due settimane
  Object.keys(sent).forEach((k) => { if (k.slice(-10) < ymd(addDays(now, -14))) delete sent[k]; });
  fm.writeString(p, JSON.stringify(sent));
}

function siriText(A) {
  const s = A.sleep.secs ? `${Math.floor(A.sleep.secs / 3600)} ore e ${Math.round((A.sleep.secs % 3600) / 60)} minuti` : "dato non disponibile";
  const ses = A.todayEv.length ? A.todayEv.map((e) => `${e.name}, ${e.min} minuti`).join("; ") : A.gymToday ? "palestra" : "nessuna seduta";
  const ad = A.ins.adapt ? ` Proposta: ${A.ins.adapt.items.map((x) => x.prop).join("; ")}.` : "";
  return `${STATE_WORD[A.worst]}. ${A.verdict} Forma ${A.metrics.tsb === null ? "non disponibile" : Math.round(A.metrics.tsb)}. Sonno ${s}. Oggi: ${ses}.${ad}`;
}

// ---- Primo collegamento a Intervals: una pagina guidata dentro l'app, niente messaggi a comparsa
function onboardingHTML(stato) {
  stato = stato || {};
  const tab = (id, on, txt) => `<button type="button" data-w="${id}" class="${on ? "on" : ""}">${txt}</button>`;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="color-scheme" content="light dark">
<style>
:root{--bg:#F2F2F7;--card:#FFFFFF;--fill:#EFEFF4;--fg:#1D1D1F;--mut:rgba(60,60,67,.64);--acc:#E8590C;--accbg:#FF6A1A;--bad:#D70015;--good:#1F8F4E}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1C1C1E;--fill:#2C2C2E;--fg:#F5F5F7;--mut:rgba(235,235,245,.64);--acc:#FF9F45;--bad:#FF453A;--good:#30D158}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:560px;margin:0 auto;padding:calc(env(safe-area-inset-top) + 28px) 16px 48px;display:flex;flex-direction:column;gap:16px}
h1{font-size:34px;letter-spacing:-.02em;margin:0}h2{font-size:20px;margin:0;letter-spacing:-.01em}.lede{color:var(--mut);margin:0 2px;font-size:17px}
.card{background:var(--card);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px}
.num{font-size:13px;font-weight:600;color:var(--mut)}p{margin:0}.mut{color:var(--mut);font-size:14px}
ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px}b{font-weight:600}
.seg{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:2px;background:var(--fill);border-radius:10px}
.seg button{border:0;border-radius:8px;padding:8px 0;font:inherit;font-size:14px;font-weight:600;color:var(--fg);background:transparent}
.seg button.on{background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.btn{border:0;border-radius:14px;font:inherit;font-size:17px;font-weight:600;padding:15px;width:100%}
.pri{background:var(--accbg);color:#fff}.sec{background:var(--fill);color:var(--fg)}
.link{background:none;border:0;color:var(--acc);font:inherit;font-size:15px;padding:6px 0}
input{font:inherit;font-size:16px;color:var(--fg);background:var(--fill);border:0;border-radius:12px;padding:12px;width:100%}
.err{color:var(--bad);font-size:15px}.ok{color:var(--good);font-size:15px}
[hidden]{display:none!important}
</style></head><body><div class="wrap">
<h1>Benvenuto</h1>
<p class="lede">Colleghiamo il tuo orologio: due minuti, una volta sola. Poi l'app fa il resto.</p>
<div class="card">
  <div class="num">1 di 2</div><h2>Account Intervals e orologio</h2>
  <p>Intervals.icu è gratuito e raccoglie i dati del tuo orologio per l'app. Ti serve solo adesso.</p>
  <div class="seg" id="w">${tab("garmin", true, "Garmin")}${tab("coros", false, "COROS")}${tab("apple", false, "Apple Watch")}</div>
  <ol id="w-garmin"><li>Tocca <b>Apri Intervals</b> e registrati (o accedi).</li><li>Nella pagina Settings, sezione Garmin, tocca <b>Connect</b> e accetta.</li><li>Spunta <b>Download activities</b> e i dati di benessere (wellness), poi <b>Download Old Data</b>. Se c'è l'opzione per mandare gli allenamenti pianificati a Garmin, attivala.</li></ol>
  <ol id="w-coros" hidden><li>Tocca <b>Apri Intervals</b> e registrati (o accedi).</li><li>Nella pagina Settings trova COROS e collegalo, con il download delle attività attivo.</li></ol>
  <ol id="w-apple" hidden><li>Tocca <b>Apri Intervals</b> e registrati (o accedi).</li><li>Installa <b>Intervals.icu Companion</b> dall'App Store, accedi e consenti la lettura di allenamenti, battiti, variabilità cardiaca e sonno.</li></ol>
  <p class="mut">Collega l'orologio direttamente, non passando da Strava: quelle attività l'app non le può leggere.</p>
  <button class="btn sec" type="button" data-act="apri:https://intervals.icu/settings">Apri Intervals</button>
</div>
<div class="card">
  <div class="num">2 di 2</div><h2>Copia la tua chiave</h2>
  <p>Nella stessa pagina Settings scorri fino a <b>Developer Settings</b> e copia la <b>API Key</b> (se non c'è, generala). Poi torna qui.</p>
  <button class="btn pri" type="button" id="incolla" data-act="chiave:appunti">Ho copiato la chiave</button>
  <div id="stato" class="${stato.errore ? "err" : "mut"}" role="status">${esc(stato.errore || "La chiave resta solo nel Portachiavi di questo iPhone.")}</div>
  <button class="link" type="button" id="amano">Preferisco scriverla</button>
  <div id="manuale" hidden><input id="k" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="API Key"><button class="btn sec" type="button" id="kgo" style="margin-top:8px">Collega</button></div>
</div>
<button class="link" type="button" data-act="demo:">Prima voglio vedere la demo</button>
</div>
<script>
window.__q=[];
function send(m){window.__q.push(m)}
document.querySelectorAll('#w button').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('#w button').forEach(function(x){x.classList.toggle('on',x===b)});['garmin','coros','apple'].forEach(function(w){document.getElementById('w-'+w).hidden=w!==b.getAttribute('data-w')})})});
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act');if(a.indexOf('chiave:')===0){var s=document.getElementById('stato');s.className='mut';s.textContent='Controllo la chiave…'}send(a)});
document.getElementById('amano').addEventListener('click',function(){document.getElementById('manuale').hidden=false;document.getElementById('k').focus()});
document.getElementById('kgo').addEventListener('click',function(){var v=document.getElementById('k').value.trim();if(!v)return;var s=document.getElementById('stato');s.className='mut';s.textContent='Controllo la chiave…';send('chiave:'+v)});
window.__stato=function(t,ok){var s=document.getElementById('stato');s.className=ok?'ok':'err';s.textContent=t};
</script></body></html>`;
}

// Resta in ascolto della pagina di benvenuto finché la chiave funziona (o si sceglie la demo)
async function collegaIntervals(wv, chiusa) {
  const js = (code) => wv.evaluateJavaScript(code, false).catch(() => {});
  for (;;) {
    if (chiusa && chiusa()) return null;
    let msg;
    try { msg = await wv.evaluateJavaScript("(window.__q && window.__q.length) ? window.__q.shift() : ''", false); } catch (e) { return null; }
    if (!msg) { await attesa(250); continue; }
    const i = msg.indexOf(":"), kind = msg.slice(0, i), val = msg.slice(i + 1);
    if (kind === "apri") { Safari.open(val); continue; }
    if (kind === "demo") return null;
    if (kind !== "chiave") continue;
    let k = val;
    if (val === "appunti") { try { k = (Pasteboard.paste() || "").trim(); } catch (e) { k = ""; } }
    k = String(k || "").trim();
    if (!/^\S{8,200}$/.test(k)) {
      await js(`window.__stato(${JSON.stringify(val === "appunti" ? "Negli appunti non c'è una chiave. In Intervals copia la API Key e tocca di nuovo il pulsante." : "Non sembra una chiave di Intervals: controlla di averla copiata tutta.")})`);
      continue;
    }
    try {
      const atleta = await ivRichiesta(k, "GET", ""); // l'atleta della chiave: conferma che funziona
      Keychain.set(KEY_NAME, k);
      await js(`window.__stato(${JSON.stringify("Collegato" + (atleta && atleta.name ? " come " + atleta.name : "") + ". Carico i tuoi dati…")}, true)`);
      return { key: k, atleta: atleta && atleta.id ? { id: atleta.id, nome: atleta.name || "" } : null };
    } catch (e) {
      await js(`window.__stato(${JSON.stringify(/\b(401|403)\b/.test(String(e.message || e)) ? "Intervals non ha accettato la chiave: copiala di nuovo e riprova." : "Intervals non risponde: controlla la connessione e riprova.")})`);
    }
  }
}

// Registro dell'ultima apertura in iCloud › Scriptable › hud-log.txt: dice dove si ferma se qualcosa va storto
const REG = [];
function registro(m) {
  if (typeof config !== "undefined" && config.runsInWidget) return; // il widget non sovrascrive il registro dell'app
  REG.push(`${new Date().toISOString().slice(11, 19)} ${m}`);
  try { const fm = FileManager.iCloud(); fm.writeString(fm.joinPath(fm.documentsDirectory(), "hud-log.txt"), REG.join("\n") + "\n"); } catch (e) {}
}

async function run() {
  const now = new Date();
  registro(`avvio ${VERSIONE}${config.runsInWidget ? " (widget)" : config.runsWithSiri ? " (Comandi Rapidi)" : ""}`);
  try { registro(`iOS ${Device.systemVersion()}`); } catch (e) {}
  // Comando Rapido «Peso HUD»: riceve le pesate da Salute, le salva e chiude (niente Intervals, niente voce)
  const par = typeof args !== "undefined" && args ? args.shortcutParameter : null;
  if (par !== null && par !== undefined && par !== "") {
    const io = diaryIO(), dia = io.read();
    const xs = importaPesi(dia, par, now);
    if (xs.length) io.write(dia);
    const u = xs[xs.length - 1];
    const out = u ? `Peso salvato nell'HUD: ${fmtIt(u.kg, 1)} kg del ${parseYMD(u.d).getDate()} ${MESI_BREVI[parseYMD(u.d).getMonth()]}${xs.length > 1 ? ` (${xs.length} pesate)` : ""}.` : `Nessun peso trovato in quello che ho ricevuto: ${String(JSON.stringify(par)).slice(0, 120)}`;
    console.log(out);
    registro(out);
    Script.setShortcutOutput(out);
    Script.complete();
    return;
  }
  applicaProfilo(await leggiProfilo());
  if (CONFIG.resetChiave && Keychain.contains(KEY_NAME)) Keychain.remove(KEY_NAME);
  let key = Keychain.contains(KEY_NAME) ? Keychain.get(KEY_NAME) : null;
  const interattivo = !config.runsInWidget && !config.runsWithSiri;
  let wv = null, presenting = null, atleta = null, chiusa = false;
  const mostra = async (html) => {
    if (!wv) {
      wv = new WebView(); await wv.loadHTML(html, "https://intervals.icu");
      await wv.evaluateJavaScript("window.__inScriptable=true", false).catch(() => {});
      presenting = wv.present(true);
      presenting.then(() => { chiusa = true; }, () => { chiusa = true; });
    } else {
      await wv.loadHTML(html, "https://intervals.icu");
      await wv.evaluateJavaScript("window.__inScriptable=true", false).catch(() => {});
    }
  };
  const collega = async (stato) => {
    await mostra(onboardingHTML(stato));
    const r = await collegaIntervals(wv, () => chiusa);
    if (r) { key = r.key; atleta = r.atleta; } else key = null;
  };

  // Prima volta: pagina di benvenuto per collegare Intervals
  if (!key && interattivo) await collega({});

  let raw, primaVolta = true;
  if (!key) raw = demoData(now);
  else {
    const cache = cacheIO();
    let prev = null; try { prev = cache.read(); } catch (e) {}
    primaVolta = !prev;
    try {
      try { raw = await fetchIntervals(key, now, prev); }
      catch (err) {
        // chiave non più valida: si ricollega dalla pagina di benvenuto
        if (interattivo && /\b(401|403)\b/.test(String(err.message || err))) {
          Keychain.remove(KEY_NAME);
          await collega({ errore: "La chiave salvata non funziona più: copiala di nuovo da Intervals." });
          if (!key) throw err;
          raw = await fetchIntervals(key, now, null);
        } else throw err;
      }
      cache.write(raw);
    } catch (err) {
      const old = cache.read();
      if (old) raw = { ...old, stale: true };
      else if (interattivo && key) {
        const a = new Alert();
        a.title = "Intervals non raggiungibile";
        a.message = String(err.message || err) + "\n\nControlla la connessione e riapri l'app.";
        a.addAction("Mostra demo");
        await a.presentAlert();
        raw = demoData(now);
      } else raw = demoData(now);
    }
  }
  // chi è su Intervals: serve per "Avvisa chi ti ha dato l'app" e per proporre il nome
  if (atleta) { raw.atleta = atleta; if (PROF) { PROF.intervals = atleta; scriviProfilo(PROF); } }
  // soglie: le stime migliori vanno su Intervals prima di tutto il resto, così pagina e sedute usano i valori nuovi
  if (interattivo && key) {
    try { const fatti = await aggiornaSoglie(key, raw, now); if (fatti.length) { cacheIO().write(raw); raw.soglieAggiornate = fatti.filter((c) => c.testo).map((c) => c.testo); } }
    catch (e) { console.log("Soglie: " + (e.message || e)); }
  }
  // Comandi Rapidi che aprono l'HUD con un link: ?cibo=… (quello che hai detto a Siri), ?pesi=… (Salute), ?settimana=1 (notifica)
  const qp = (typeof args !== "undefined" && args && args.queryParameters) || {};
  let apertura = null;
  if (qp.settimana) apertura = { vista: "trend", toast: "La tua settimana", condividi: "riepilogo" };
  if (qp.domani) apertura = { domani: true }; // dalla notifica della sera
  if (qp.att && /^\d{4}-\d\d-\d\d$/.test(qp.att)) apertura = { att: qp.att }; // dalla notifica di una seduta sincronizzata
  if (key && (qp.pesi || qp.cibo)) {
    const io = diaryIO(), dia = io.read();
    if (qp.pesi) {
      const xs = importaPesi(dia, qp.pesi, now);
      if (xs.length) io.write(dia);
      const u = xs[xs.length - 1];
      apertura = { vista: "fuel", toast: u ? `Peso salvato: ${fmtIt(u.kg, 1)} kg` : "Nessun peso trovato in Salute" };
    }
    if (qp.cibo) {
      const r = registraCibo(dia, qp.cibo, now);
      if (r.voce) io.write(dia);
      apertura = { vista: "fuel", cibo: r, toast: r.voce ? `Segnato · ${fmtIt(totaleCibo([r.voce]).kcal)} kcal` : "Non ho riconosciuto cibi" };
    }
  }
  registro(`dati ${raw.demo ? "demo" : raw.stale ? "dalla cache" : raw.fullAt === raw.fetchedAt ? "da Intervals (completi)" : "da Intervals (solo le novità)"}: ${(raw.activities || []).length} attività`);
  DETTAGLI = key ? dettagliIO().read() : {};
  // attività appena arrivate: corse e nuotate in piscina si leggono subito, così un record si vede già a questa apertura
  if (key && !config.runsInWidget && !config.runsWithSiri && !raw.stale && !raw.demo && Array.isArray(raw.nuove) && raw.nuove.length) {
    const nuove = (raw.activities || []).filter((a) => raw.nuove.includes(a.id) && !DETTAGLI[a.id] && ((sportOf(a.type) === "corsa" && (num(a.distance) || 0) >= 1000) || (a.type === "Swim" && (num(a.distance) || 0) >= 100))).slice(0, 3);
    if (nuove.length) { try { const n = await scaricaDettagli(key, nuove, DETTAGLI, true); if (n) { potaDettagli(DETTAGLI, raw, now); dettagliIO().write(DETTAGLI); } } catch (e) { registro("nuove attività: " + e); } }
  }
  // Sedute dell'app doppie o di un piano vecchio: via dal calendario (alla prima apertura del giorno si legge tutto il piano)
  let doppie = [];
  if (key && PROF && interattivo && !raw.stale && !raw.demo) {
    try {
      const C0 = campanaIO().read(), oggi = ymd(now);
      let cal = raw.events || [];
      if (C0.pulizia !== oggi) { try { cal = await ivRichiesta(key, "GET", `/events?oldest=${oggi}&newest=${ymd(addDays(now, 140))}`, undefined, 20); } catch (e) { registro("calendario non letto: " + (e.message || e)); } }
      doppie = await pulisciCalendario(key, PROF, cal, now);
      if (C0.pulizia !== oggi) { C0.pulizia = oggi; campanaIO().write(C0); }
      if (doppie.length) {
        const via = new Set(doppie.map((e) => String(e.id)));
        raw.events = (raw.events || []).filter((e) => !via.has(String(e.id)));
        try { cacheIO().write(raw); } catch (e) {}
      }
    } catch (e) { registro("pulizia del calendario: " + (e.message || e)); }
  }
  let A = analyze(raw, now, key ? diaryIO().read() : raw.diary);
  registro("analisi ok");

  // Orari del rifornimento nei lunghi su Intervals, e da lì sull'orologio (solo quando apri l'app)
  let avvisiScritti = [];
  if (!config.runsInWidget && !config.runsWithSiri) {
    try { avvisiScritti = await scriviAvvisi(raw, A, key, now); } catch (e) { registro("avvisi: " + e); }
    if (avvisiScritti.length) { try { cacheIO().write(raw); } catch (e) {} A = analyze(raw, now, diaryIO().read()); }
  }

  if (key && !raw.stale && !config.runsInWidget && consolidaGear(A.diary, raw, now)) { try { diaryIO().write(A.diary); } catch (e) {} }
  // Record: si ricordano, così ci si accorge del prossimo miglioramento (alla prima apertura senza festeggiare)
  let nuoviRecord = [];
  if (key && A.record && !config.runsInWidget && !raw.stale) {
    nuoviRecord = A.record.nuovi || [];
    if (JSON.stringify(A.diary.record || null) !== JSON.stringify(A.record.mappa)) { A.diary.record = A.record.mappa; try { diaryIO().write(A.diary); } catch (e) {} }
    if (nuoviRecord.length) registro(`nuovi record: ${nuoviRecord.map((r) => r.nome).join(", ")}`);
  }

  // Esporta i dati in iCloud Drive › Scriptable › hud-dati.json per la versione da PC
  if (key && !raw.stale) {
    try {
      const ic = FileManager.iCloud(), fx = ic.joinPath(ic.documentsDirectory(), "hud-dati.json");
      const recente = (() => { try { return ic.fileExists(fx) && now - ic.modificationDate(fx) < 30 * 60000; } catch (e) { return false; } })();
      if (!recente) ic.writeString(fx, JSON.stringify({ versione: 4, esportato: new Date().toISOString(), nome: PROF && PROF.nome, config: CONFIG, profilo: PROF, diary: A.diary, raw }));
    } catch (e) { console.log("Esportazione per il PC non riuscita: " + e); }
  }

  // Campana: notifiche del telefono, record, avvisi sull'orologio, sedute arrivate, scarpe da cambiare
  const C = key ? campanaIO().read() : { lista: [] }; CAMPANA = C;
  try {
    if (key && !raw.stale && !raw.demo) await campanaAttivita(raw, C, now, interattivo, primaVolta);
    if (doppie.length) campanaMetti(C, { id: `doppie-${ymd(now)}-${doppie.length}`, t: now.toISOString(), tit: "Calendario sistemato", txt: `Tolte ${doppie.length} ${doppie.length === 1 ? "seduta dell'app doppia" : "sedute dell'app doppie"} o di un piano vecchio. Le tue sedute non sono state toccate.`, tipo: "info", az: "sett" }, now);
    for (const r of nuoviRecord) campanaMetti(C, { id: `rec-${r.k}-${r.d || ""}`, t: now.toISOString(), tit: `Nuovo record: ${r.nome}`, txt: `${fmtDur2(r.sec)}${r.meglio ? ` · ${fmtStepDur(r.meglio)} meglio di prima` : ""}${r.att ? ` · ${r.att}` : ""}`, tipo: "record", az: "record" }, now);
    const conAvv = avvisiScritti.filter((x) => x.avvisi);
    if (conAvv.length) campanaMetti(C, { id: `orologio-${ymd(now)}-${conAvv.map((x) => x.id).join("-")}`, t: now.toISOString(), tit: "Rifornimento sull'orologio", txt: conAvv.map((x) => { const q = parseYMD(x.d); return `${x.nome} (${GIORNI[q.getDay()].slice(0, 3).toLowerCase()} ${q.getDate()}): ${x.n} avvisi`; }).join("\n"), tipo: "orologio", az: "sett" }, now);
    for (const g of (A.gear || []).filter((x) => !x.ritirata && x.pct !== null && x.pct >= 1)) if (!C.lista.some((x) => x.id === `gear-${g.id}`)) campanaMetti(C, { id: `gear-${g.id}`, t: now.toISOString(), tit: `${g.tipo === "bici" ? "Bici" : "Scarpe"} da controllare: ${g.nome}`, txt: `${fmtIt(g.km)} km su ${fmtIt(g.limite)} previsti.`, tipo: "gear", az: "trend" }, now);
  } catch (e) { registro("campana: " + e); }
  if (key && !raw.demo && !A.needSetup) { try { await scheduleNotifs(A, C, interattivo); } catch (e) { console.log("Notifiche: " + e); } }
  if (key) campanaIO().write(C);
  // la sera (dalle 18), alla prima apertura: il foglio con l'allenamento di domani
  const sera = !!key && interattivo && !apertura && !A.needSetup && !raw.demo && now.getHours() >= 18 && C.domaniVisto !== ymd(now) && !!promemoriaDomani(A);

  if (config.runsWithSiri) {
    const txt = siriText(A);
    Speech.speak(txt);
    Script.setShortcutOutput(txt);
    Script.complete();
    return;
  }

  if (config.runsInWidget) {
    Script.setWidget(buildWidget(A));
  } else {
    let html;
    try { html = buildHTML(A); registro(`pagina: ${html.length} caratteri`); }
    catch (e) {
      registro(`ERRORE nella pagina: ${e && e.stack ? e.stack : e}`);
      const a = new Alert(); a.title = "Errore nell'HUD"; a.message = String(e && e.message ? e.message : e).slice(0, 400); a.addAction("OK"); await a.presentAlert();
      Script.complete();
      return;
    }
    await mostra(html);
    registro("mostrata");
    if (apertura && (apertura.domani || apertura.att)) {
      await attesa(400);
      if (apertura.domani) await wv.evaluateJavaScript("window.__domani && window.__domani()", false).catch(() => {});
      else await wv.evaluateJavaScript(`window.__apriAtt && window.__apriAtt(${JSON.stringify(apertura.att)})`, false).catch(() => {});
    } else if (apertura) {
      // aperto da Siri o da un'automazione: Carburante, con il riepilogo detto a voce
      await attesa(500);
      await wv.evaluateJavaScript(`window.__apri && window.__apri(${JSON.stringify(apertura.vista)}); window.__toast && window.__toast(${JSON.stringify(apertura.toast)})`, false).catch(() => {});
      if (apertura.condividi) await wv.evaluateJavaScript(`OPT.week=0;OPT.rec=null;setLayout(${JSON.stringify(apertura.condividi)});openSheet()`, false).catch(() => {});
      if (apertura.cibo) {
        const T = A.nutrition.cibo.tot, PN = A.nutrition.piano, r = apertura.cibo;
        const frase = r.voce ? `Segnato ${fmtIt(totaleCibo([r.voce]).kcal)} chilocalorie. Oggi sei a ${fmtIt(T.kcal)} su ${fmtIt(PN.kcal)}, con ${fmtIt(T.C)} grammi di carboidrati su ${fmtIt(PN.C)}.${r.ignoti.length ? ` Non ho capito: ${r.ignoti.join(", ")}.` : ""}` : "Non ho riconosciuto i cibi. Riprova dicendo, per esempio, centottanta grammi di pasta.";
        try { Speech.speak(frase); } catch (e) {}
      }
    }
    if (!apertura && doppie.length && !nuoviRecord.length) {
      await attesa(500);
      await wv.evaluateJavaScript(`window.__toast && window.__toast(${JSON.stringify(`Calendario sistemato: tolte ${doppie.length} sedute doppie`)})`, false).catch(() => {});
    } else if (!apertura && nuoviRecord.length) {
      await attesa(500);
      const r0 = nuoviRecord[0], msg = `Nuovo record: ${r0.nome} in ${fmtDur2(r0.sec)}${nuoviRecord.length > 1 ? ` (+${nuoviRecord.length - 1})` : ""}`;
      await wv.evaluateJavaScript(`window.__toast && window.__toast(${JSON.stringify(msg)})`, false).catch(() => {});
    } else if (!apertura && avvisiScritti.length) {
      await attesa(500);
      const conAvv = avvisiScritti.filter((x) => x.avvisi), soloZone = avvisiScritti.filter((x) => x.zone && !x.avvisi);
      const msg = conAvv.length ? (conAvv.length === 1 ? `Rifornimento sull'orologio: ${conAvv[0].nome}` : `Rifornimento sull'orologio: ${conAvv.length} sedute`) : `Bici sull'orologio: zone di frequenza cardiaca${soloZone.length > 1 ? ` (${soloZone.length} sedute)` : ""}`;
      await wv.evaluateJavaScript(`window.__toast && window.__toast(${JSON.stringify(msg)})`, false).catch(() => {});
    }
    if (sera) { await attesa(nuoviRecord.length || avvisiScritti.length ? 900 : 400); await wv.evaluateJavaScript("window.__domani && window.__domani()", false).catch(() => {}); }
    if (key && !raw.stale) completaStorico(key, raw, now).catch((e) => registro("storico: " + e)); // in sottofondo, mentre guardi la pagina
    shareLoop(wv, { key, raw, now, atleta, chiusa: () => chiusa }); // non bloccante: resta in ascolto dei pulsanti della pagina
    await presenting;
  }
  Script.complete();
}

if (typeof Script !== "undefined") {
  await run();
} else if (typeof module !== "undefined") {
  module.exports = { analyze, buildHTML, demoData, CONFIG };
}
