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

