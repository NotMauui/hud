// ------------------------------------------------------------
//  Archivio ed esportazione: il tuo storico resta tuo
//  In iCloud Drive › Scriptable › HUD Archivio, un file per anno: cresce a ogni apertura e non cancella mai nulla.
//  Dentro: attività (con i file originali dell'orologio), giorni (benessere e verdetto dell'HUD), sedute pianificate,
//  soglie, palestra, cibo, acqua e rifornimento. «Esporta i miei dati» raccoglie tutto in un .zip:
//  tabelle CSV per Numbers ed Excel e i JSON completi, per portarlo in qualsiasi altra app.
// ------------------------------------------------------------
const ARCH_DIR = "HUD Archivio", ARCH_VER = 1;
const ARCH_FIT_APERTURA = 8; // file originali scaricati in sottofondo a ogni apertura (tutti gli altri con «Completa l'archivio»)
const ARCH_ANNI_VUOTI = 3;   // tre anni di fila senza attività né dati: lo storico su Intervals è finito
const ARCH_PRIMO_ANNO = 1990;
const DIA_MAPPE = ["cibo", "acqua", "pesi", "checkins", "lunghi"]; // le parti del diario segnate per giorno
let ARCH_CODA = Promise.resolve(), ARCH_FERMA = false, ARCH_COMPLETA = false;

// ---- File: in iCloud se c'è (sopravvive al cambio di telefono), sennò su questo iPhone
function archFM() {
  let fm, dove = "iCloud";
  try { fm = FileManager.iCloud(); fm.documentsDirectory(); } catch (e) { fm = FileManager.local(); dove = "iPhone"; }
  const dir = fm.joinPath(fm.documentsDirectory(), ARCH_DIR);
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  const p = (nome) => String(nome).split("/").reduce((a, x) => fm.joinPath(a, x), dir);
  return { fm, dir, dove, p };
}
async function archScarica(X, f) { if (X.fm.isFileStoredIniCloud && X.fm.isFileStoredIniCloud(f) && !X.fm.isFileDownloaded(f)) await X.fm.downloadFileFromiCloud(f); }
async function archLeggi(X, nome, vuoto) {
  const f = X.p(nome);
  if (!X.fm.fileExists(f)) return vuoto;
  await archScarica(X, f);
  return JSON.parse(X.fm.readString(f)); // un file rovinato ferma l'archivio invece di essere riscritto vuoto: lo storico non si perde
}
function archScrivi(X, nome, o) {
  const f = X.p(nome), d = f.slice(0, f.lastIndexOf("/"));
  if (!X.fm.fileExists(d)) X.fm.createDirectory(d, true);
  X.fm.writeString(f, JSON.stringify(o));
}
// In fila: novità, recupero ed esportazione non scrivono mai insieme lo stesso file
function archCoda(fn) {
  const p = ARCH_CODA.then(() => fn());
  ARCH_CODA = p.catch((e) => registro("archivio: " + ((e && e.message) || e)));
  return p;
}
async function archGet(key, path) {
  const r = new Request(BASE + path);
  r.headers = { Authorization: "Basic " + Data.fromString("API_KEY:" + key).toBase64String(), Accept: "application/json", "User-Agent": "Mozilla/5.0 (iPhone) HUD703" };
  r.timeoutInterval = 60; // un anno intero di attività può pesare qualche MB
  const txt = await r.loadString();
  const code = r.response && r.response.statusCode;
  if (code && code >= 400) throw new Error(`Intervals ha risposto ${code} su ${path.split("?")[0]}`);
  return JSON.parse(txt);
}

// ---- Unioni (senza file: si provano anche fuori da Scriptable)
const annoDi = (s) => { const y = String(s || "").slice(0, 4); return /^\d{4}$/.test(y) ? y : null; };
const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fileAnno = (tipo, y) => `${tipo}-${y}.json`;
function perAnno(lista, data) {
  const m = {};
  for (const x of lista || []) { const y = x && annoDi(data(x)); if (y) (m[y] = m[y] || []).push(x); }
  return m;
}
// Attività per id, con tutti i campi di Intervals. Quelle cancellate su Intervals restano, segnate con il giorno in cui sono sparite
function unisciAttivita(F, lista, sparite, oggi) {
  F.att = F.att || {};
  let n = 0;
  for (const a of lista || []) {
    if (!a || a.id === undefined || a.id === null || !a.start_date_local) continue;
    const o = { ...a };
    delete o.skyline_chart_bytes; // l'anteprima del grafico: pesa e non è un dato
    const id = String(a.id);
    if (!uguali(F.att[id], o)) { F.att[id] = o; n++; }
  }
  for (const id of sparite || []) if (F.att[id] && !F.att[id]._tolta) { F.att[id] = { ...F.att[id], _tolta: oggi }; n++; }
  return n;
}
// Giorni: il benessere di Intervals (peso, sonno, HRV, forma…) e, a parte, il verdetto dell'HUD
function unisciGiorni(F, wellness) {
  F.giorni = F.giorni || {};
  let n = 0;
  for (const w of wellness || []) {
    if (!w || !/^\d{4}-\d\d-\d\d$/.test(w.id || "")) continue;
    const g = F.giorni[w.id] || {};
    if (!uguali(g.w, w)) { F.giorni[w.id] = { ...g, w }; n++; }
  }
  return n;
}
function unisciHUD(F, d, hud) {
  F.giorni = F.giorni || {};
  const g = F.giorni[d] || {};
  if (!hud || uguali(g.hud, hud)) return 0;
  F.giorni[d] = { ...g, hud };
  return 1;
}
function giornoHUD(A) {
  if (!A || A.demo) return null;
  const P = A.nutrition && A.nutrition.piano, M = A.metrics || {};
  return {
    semaforo: A.worst || null, verdetto: A.verdict || null,
    piano: P ? { kcal: num(P.kcal), C: num(P.C), P: num(P.P), G: num(P.G), tipo: P.tipo || null } : null,
    ctl: num(M.ctl), atl: num(M.atl), tsb: num(M.tsb), hrv: num(M.hrv), rhr: num(M.rhr),
  };
}
// Sedute del calendario fino a oggi (le future cambiano ancora): il testo dei passi, non lo schema dell'orologio
const SEDUTA_CAMPI = ["id", "start_date_local", "end_date_local", "category", "type", "name", "description", "moving_time", "elapsed_time", "icu_training_load", "icu_intensity", "distance", "external_id", "indoor", "trainer", "target", "carbs_per_hour", "tags", "paired_activity_id"];
function sedutaPulita(e) {
  const o = {};
  for (const k of SEDUTA_CAMPI) if (e[k] !== undefined && e[k] !== null && e[k] !== "") o[k] = e[k];
  const wd = e.workout_doc;
  if (wd && num(wd.duration)) o.durata_prevista = wd.duration;
  if (wd && num(wd.distance)) o.distanza_prevista = wd.distance;
  return o;
}
function unisciSedute(F, events, oggi) {
  F.sedute = F.sedute || {};
  let n = 0;
  for (const e of events || []) {
    if (!e || e.id === undefined || e.id === null || !e.start_date_local || e.start_date_local.slice(0, 10) > oggi) continue;
    const o = sedutaPulita(e), id = String(e.id);
    if (!uguali(F.sedute[id], o)) { F.sedute[id] = o; n++; }
  }
  return n;
}
// Il diario dell'iPhone vale per i giorni che ha ancora; quelli che ha già tolto (cibo e acqua dopo 60 giorni) restano qui.
// Una voce cancellata oggi (cibodel) lascia il giorno con la lista nuova, quindi la correzione arriva anche qui.
function anniDiario(dia) {
  const s = new Set();
  for (const k of DIA_MAPPE) for (const d of Object.keys((dia && dia[k]) || {})) { const y = annoDi(d); if (y) s.add(y); }
  for (const x of (dia && dia.palestra && dia.palestra.log) || []) { const y = annoDi(x && x.data); if (y) s.add(y); }
  return [...s].sort();
}
function unisciDiario(F, dia, anno) {
  let n = 0;
  for (const k of DIA_MAPPE) {
    F[k] = F[k] || {};
    for (const [d, v] of Object.entries((dia && dia[k]) || {})) if (annoDi(d) === anno && !uguali(F[k][d], v)) { F[k][d] = v; n++; }
  }
  F.palestra = F.palestra || {};
  for (const x of (dia && dia.palestra && dia.palestra.log) || []) {
    if (!x || annoDi(x.data) !== anno || !x.es) continue;
    const k = `${x.data}|${x.es}`;
    if (!uguali(F.palestra[k], x)) { F.palestra[k] = x; n++; }
  }
  return n;
}
// Soglie: una fotografia ogni volta che cambiano (lo stesso giorno vale l'ultima)
function unisciSoglie(S, imp, oggi) {
  if (!Array.isArray(imp) || !imp.length) return 0;
  S.lista = S.lista || [];
  const u = S.lista[S.lista.length - 1];
  if (u && uguali(u.sport, imp)) return 0;
  if (u && u.d === oggi) u.sport = imp; else S.lista.push({ d: oggi, sport: imp });
  return 1;
}
const contaAtt = (F) => Object.values((F && F.att) || {}).filter((a) => !a._tolta).length;
function segnaAnno(S, y, campo, n) { S.anni = S.anni || {}; S.anni[y] = { ...(S.anni[y] || {}), [campo]: n }; }

// ---- File originali dell'orologio (.fit, .tcx o .gpx come li ha ricevuti Intervals, compressi .gz)
function codaFit(I, acts) {
  I.f = I.f || {};
  let n = 0;
  for (const a of acts || []) {
    if (!a || a.id === undefined || a.id === null || !a.start_date_local || I.f[String(a.id)]) continue;
    I.f[String(a.id)] = { d: a.start_date_local, s: a.source || null, t: a.file_type || null };
    n++;
  }
  return n;
}
function contaFit(I) {
  const c = { ok: 0, no: 0, attesa: 0 };
  for (const x of Object.values((I && I.f) || {})) { if (x.f) c.ok++; else if (x.no || (x.err || 0) >= 3) c.no++; else c.attesa++; }
  return c;
}
// prima i più recenti: sono quelli che servono di più
const fitDaFare = (I) => Object.entries((I && I.f) || {}).filter(([, x]) => !x.f && !x.no && (x.err || 0) < 3).sort((a, b) => String(b[1].d || "").localeCompare(String(a[1].d || "")));
// 2026-10-18_0712_i12345.fit.gz: in ordine di data già nella cartella, con l'id per ritrovarlo su Intervals
function nomeFit(id, x, intest, gzip) {
  const cd = Object.entries(intest || {}).find(([k]) => /^content-disposition$/i.test(k));
  const m = cd && String(cd[1]).match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);
  let ext = m ? (m[1].toLowerCase().match(/\.(fit|tcx|gpx)(\.gz)?$/) || [])[0] : null;
  if (!ext) ext = `.${/^(fit|tcx|gpx)$/i.test(x.t || "") ? String(x.t).toLowerCase() : "fit"}${typeof gzip === "function" ? (gzip() ? ".gz" : "") : gzip ? ".gz" : ""}`;
  const d = String(x.d || "");
  return `${d.slice(0, 10)}_${d.slice(11, 13)}${d.slice(14, 16)}_${String(id).replace(/[^\w-]/g, "")}${ext}`;
}
async function scaricaUnFit(key, X, id, x) {
  if (/strava/i.test(x.s || "")) { x.no = "da Strava: Strava non lo concede alle altre app"; return "no"; }
  if (/manual/i.test(x.s || "")) { x.no = "inserita a mano"; return "no"; }
  const r = new Request(`${API}/activity/${encodeURIComponent(id)}/file`);
  r.headers = { Authorization: "Basic " + Data.fromString("API_KEY:" + key).toBase64String(), "User-Agent": "Mozilla/5.0 (iPhone) HUD703" };
  r.timeoutInterval = 60;
  let data;
  try { data = await r.load(); } catch (e) { x.err = (x.err || 0) + 1; return "err"; }
  const code = (r.response && r.response.statusCode) || 0;
  if (code === 401) return "stop"; // chiave non più valida: si riprova alla prossima apertura
  if (code === 403 || code === 404 || code === 422) { x.no = code === 404 ? "nessun file" : "non disponibile"; return "no"; }
  if (code >= 400 || !data) { x.err = (x.err || 0) + 1; x.codice = code; return "err"; }
  const y = annoDi(x.d) || "senza-data";
  const nome = nomeFit(id, x, r.response && r.response.headers, () => { try { return data.toBase64String().slice(0, 4) === "H4sI"; } catch (e) { return true; } });
  const dir = X.p(`fit/${y}`);
  if (!X.fm.fileExists(dir)) X.fm.createDirectory(dir, true);
  X.fm.write(X.p(`fit/${y}/${nome}`), data);
  x.f = `${y}/${nome}`;
  try { x.kb = Math.round(X.fm.fileSize(X.p(`fit/${y}/${nome}`))); } catch (e) {}
  delete x.err; delete x.codice;
  return "ok";
}

// ---- A ogni apertura, in sottofondo: le novità di Intervals e del diario nell'archivio
function statoNuovo(now) { return { v: ARCH_VER, creato: now.toISOString(), anni: {}, storico: { fatti: [], vuoti: 0, finito: false }, fit: { ok: 0, no: 0, attesa: 0 } }; }
async function archiviaNovita(key, raw, A, now) {
  if (!raw || raw.demo || raw.stale) return null;
  const X = archFM(), oggi = ymd(now), anno = oggi.slice(0, 4);
  const S = (await archLeggi(X, "stato.json", null)) || statoNuovo(now);
  const I = await archLeggi(X, "fit/indice.json", { v: ARCH_VER, f: {} });
  S.dove = X.dove;
  // attività: alla rilettura completa (una volta a settimana) si segnano anche quelle cancellate negli ultimi sei mesi
  const pieno = !!raw.fullAt && raw.fullAt === raw.fetchedAt;
  const da = ymd(addDays(now, -178)), ids = new Set((raw.activities || []).map((a) => String(a.id)));
  const A1 = perAnno(raw.activities, (a) => a.start_date_local);
  const anniA = new Set(Object.keys(A1));
  if (pieno) for (let y = +da.slice(0, 4); y <= +anno; y++) anniA.add(String(y));
  for (const y of anniA) {
    const F = await archLeggi(X, fileAnno("attivita", y), { v: ARCH_VER, anno: y, att: {} });
    const sparite = pieno ? Object.keys(F.att || {}).filter((id) => !ids.has(id) && String(F.att[id].start_date_local || "").slice(0, 10) > da) : [];
    if (unisciAttivita(F, A1[y], sparite, oggi)) archScrivi(X, fileAnno("attivita", y), F);
    codaFit(I, Object.values(F.att).filter((a) => !a._tolta));
    segnaAnno(S, y, "att", contaAtt(F));
  }
  // giorni: benessere e, per oggi, il verdetto dell'HUD
  const W1 = perAnno(raw.wellness, (w) => w.id);
  for (const y of new Set([...Object.keys(W1), anno])) {
    const F = await archLeggi(X, fileAnno("giorni", y), { v: ARCH_VER, anno: y, giorni: {} });
    let n = unisciGiorni(F, W1[y]);
    if (y === anno) n += unisciHUD(F, oggi, giornoHUD(A));
    if (n) archScrivi(X, fileAnno("giorni", y), F);
    segnaAnno(S, y, "giorni", Object.keys(F.giorni).length);
  }
  // sedute: la cache ha solo questa settimana e la prossima, quindi se l'app è rimasta chiusa a lungo si recupera il buco
  let evs = (raw.events || []).slice(), buco = true;
  const lun = mondayOf(now);
  if (S.sedFino && S.sedFino < ymd(addDays(lun, -1)) && key) {
    try { const ex = await archGet(key, `/events?oldest=${S.sedFino}&newest=${ymd(addDays(lun, -1))}`); if (Array.isArray(ex)) evs = evs.concat(ex); }
    catch (e) { buco = false; registro("archivio, sedute: " + (e.message || e)); }
  }
  const E1 = perAnno(evs, (e) => e.start_date_local);
  for (const y of Object.keys(E1)) {
    if (y > anno) continue;
    const F = await archLeggi(X, fileAnno("sedute", y), { v: ARCH_VER, anno: y, sedute: {} });
    if (unisciSedute(F, E1[y], oggi)) archScrivi(X, fileAnno("sedute", y), F);
    segnaAnno(S, y, "sedute", Object.keys(F.sedute).length);
  }
  if (buco) S.sedFino = oggi;
  // diario: palestra, cibo, acqua, pesate, check-in e lunghi segnati
  const dia = diaryIO().read();
  for (const y of anniDiario(dia)) {
    const F = await archLeggi(X, fileAnno("diario", y), { v: ARCH_VER, anno: y });
    if (unisciDiario(F, dia, y)) archScrivi(X, fileAnno("diario", y), F);
  }
  // soglie
  const SO = await archLeggi(X, "soglie.json", { v: ARCH_VER, lista: [] });
  if (unisciSoglie(SO, raw.impostazioni, oggi)) archScrivi(X, "soglie.json", SO);
  S.fit = contaFit(I);
  S.aggiornato = now.toISOString();
  archScrivi(X, "fit/indice.json", I);
  archScrivi(X, "stato.json", S);
  if (!X.fm.fileExists(X.p("LEGGIMI.txt"))) { try { X.fm.writeString(X.p("LEGGIMI.txt"), leggimiCartella()); } catch (e) {} }
  return S;
}

// ---- Un pezzo di storico alla volta: un anno indietro (attività, benessere, sedute), poi i file originali
async function passoStorico(key, now, o = {}) {
  if (!key) return null;
  const X = archFM(), oggi = ymd(now);
  const S = await archLeggi(X, "stato.json", null);
  if (!S) return null;
  const I = await archLeggi(X, "fit/indice.json", { v: ARCH_VER, f: {} });
  S.storico = S.storico || { fatti: [], vuoti: 0, finito: false };
  const fermo = () => ARCH_FERMA || !!(o.ferma && o.ferma());
  const salva = async () => { S.fit = contaFit(I); archScrivi(X, "fit/indice.json", I); archScrivi(X, "stato.json", S); if (o.avanza) await o.avanza(S); };
  let anni = o.anni ?? 1;
  while (anni-- > 0 && !S.storico.finito && !fermo()) {
    const fatti = (S.storico.fatti || []).map(Number);
    const y = String(fatti.length ? Math.min(...fatti) - 1 : now.getFullYear());
    if (+y < ARCH_PRIMO_ANNO) { S.storico.finito = true; break; }
    if (o.inizio) await o.inizio(y);
    const q = (p) => archGet(key, `${p}?oldest=${y}-01-01&newest=${y}-12-31`);
    const [acts, well, evs] = await Promise.all([q("/activities"), q("/wellness"), q("/events")]);
    const FA = await archLeggi(X, fileAnno("attivita", y), { v: ARCH_VER, anno: y, att: {} });
    if (unisciAttivita(FA, acts, [], oggi)) archScrivi(X, fileAnno("attivita", y), FA);
    codaFit(I, Object.values(FA.att).filter((a) => !a._tolta));
    const FG = await archLeggi(X, fileAnno("giorni", y), { v: ARCH_VER, anno: y, giorni: {} });
    if (unisciGiorni(FG, well)) archScrivi(X, fileAnno("giorni", y), FG);
    const FS = await archLeggi(X, fileAnno("sedute", y), { v: ARCH_VER, anno: y, sedute: {} });
    if (unisciSedute(FS, evs, oggi)) archScrivi(X, fileAnno("sedute", y), FS);
    if (contaAtt(FA)) segnaAnno(S, y, "att", contaAtt(FA));
    if (Object.keys(FG.giorni).length) segnaAnno(S, y, "giorni", Object.keys(FG.giorni).length);
    if (Object.keys(FS.sedute).length) segnaAnno(S, y, "sedute", Object.keys(FS.sedute).length);
    const utile = (w) => w && ((num(w.ctl) || 0) > 0.5 || num(w.weight) || num(w.restingHR) || num(w.hrv) || num(w.sleepSecs) || num(w.steps));
    const vuoto = !(acts || []).length && !(well || []).some(utile);
    S.storico.fatti = [...fatti, +y];
    S.storico.vuoti = vuoto ? (S.storico.vuoti || 0) + 1 : 0;
    if (!vuoto) S.storico.primo = +y;
    if (S.storico.vuoti >= ARCH_ANNI_VUOTI) S.storico.finito = true;
    await salva();
  }
  let max = o.fit ?? ARCH_FIT_APERTURA, k = 0;
  for (const [id, x] of fitDaFare(I)) {
    if (max-- <= 0 || fermo()) break;
    const r = await scaricaUnFit(key, X, id, x);
    if (r === "stop") break;
    if (++k % 5 === 0) await salva();
    await attesa(150); // con calma: Intervals è gratuito per tutti
  }
  await salva();
  return S;
}

// «Completa l'archivio adesso»: tutto lo storico e tutti i file, finché la pagina resta aperta
async function completaArchivio(key, js, chiusa, conFit = true) {
  ARCH_COMPLETA = true;
  try {
    const manda = (R) => js(`window.__archivio && window.__archivio(${JSON.stringify(R)})`);
    return await passoStorico(key, new Date(), {
      anni: 999, fit: conFit ? 1e6 : 0, ferma: chiusa,
      inizio: (y) => manda({ dati: `Recupero il ${y}…` }),
      avanza: (S) => manda(riassuntoArchivio(S)),
    });
  } finally { ARCH_COMPLETA = false; }
}

// ---- Per le Impostazioni
function riassuntoArchivio(S) {
  if (!S) return null;
  const att = Object.values(S.anni || {}).reduce((t, a) => t + (a.att || 0), 0);
  const anni = Object.entries(S.anni || {}).filter(([, a]) => (a.att || 0) + (a.giorni || 0) > 0).map(([y]) => +y);
  const dal = anni.length ? Math.min(...anni) : null;
  const F = S.fit || { ok: 0, no: 0, attesa: 0 };
  const finito = !!(S.storico && S.storico.finito);
  const fitTxt = F.ok + F.attesa ? `${fmtIt(F.ok)} su ${fmtIt(F.ok + F.attesa)} file originali` : "";
  const manca = [!finito ? (dal ? `gli anni prima del ${dal}` : "lo storico") : "", F.attesa ? `${fmtIt(F.attesa)} file originali` : ""].filter(Boolean);
  return { att, dal, finito, attesa: F.attesa, dove: S.dove || "iCloud", dati: att || dal ? `${fmtIt(att)} attività${dal ? ` dal ${dal}` : ""}` : "in preparazione", fitTxt, manca: manca.length ? `Mancano ${manca.join(" e ")}` : "" };
}
function archStatoSubito() {
  try {
    const X = archFM(), f = X.p("stato.json");
    if (!X.fm.fileExists(f)) return null;
    if (X.fm.isFileStoredIniCloud && X.fm.isFileStoredIniCloud(f) && !X.fm.isFileDownloaded(f)) { X.fm.downloadFileFromiCloud(f); return null; }
    return JSON.parse(X.fm.readString(f));
  } catch (e) { return null; }
}
function archivioCard(A) {
  const R = A.archivio || null, iphone = R && R.dove === "iPhone";
  return `<h2>I tuoi dati</h2>
  <div class="card list">
    <div class="lrow"><span>Archivio</span><span class="muted" id="arch-dati" style="text-align:right">${esc(R ? R.dati : "si crea alla prossima apertura")}</span></div>
    <div class="sep l16"></div>
    <button class="lrow rowlink" type="button" data-act="esporta:tutto"><span>Esporta i miei dati</span><span class="chev2">›</span></button>
    <div id="arch-completa"${R && R.manca ? "" : ' style="display:none"'}><div class="sep l16"></div>
    <button class="lrow rowlink" type="button" data-act="archivio:completa"><span><span style="display:block">Completa l'archivio adesso</span><span class="t13 muted" id="arch-manca" style="display:block;margin-top:2px">${esc(R ? R.manca : "")}</span></span><span class="chev2">›</span></button></div>
  </div>
  <p class="t13 muted" style="margin:-6px 16px 0">Ogni allenamento, giorno, seduta, pasto e serie in palestra resta ${iphone ? "su questo iPhone" : "in iCloud Drive"} › Scriptable › HUD Archivio, con i file originali dell'orologio. Non si cancella mai nulla${iphone ? "" : ", anche se cambi telefono o smetti di usare Intervals"}. L'esportazione è un file .zip con le tabelle per Numbers o Excel e i dati completi.</p>`;
}

// ---- Esportazione: tabelle per le persone (CSV all'italiana) e JSON per le macchine
// Punto e virgola e virgola decimale: è quello che Excel e Numbers in italiano aprono bene con un tocco.
// Chi deve elaborare i dati con un programma usa i JSON, che hanno i numeri così come sono.
const CSV_SEP = ";";
function cellaCSV(v) {
  if (v === null || v === undefined || (typeof v === "number" && !isFinite(v))) return "";
  let s;
  if (typeof v === "number") s = String(Math.round(v * 1000) / 1000 || 0).replace(".", ",");
  else if (typeof v === "boolean") s = v ? "sì" : "no";
  else { s = String(v); if (/^[=+@\t\r]|^-[^\d]/.test(s)) s = "'" + s; } // un nome che inizia con = non diventa una formula
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function tabellaCSV(colonne, righe) {
  const riga = (r) => colonne.map(([, f]) => { let v; try { v = f(r); } catch (e) { v = null; } return cellaCSV(v); }).join(CSV_SEP);
  return "﻿" + [colonne.map(([t]) => cellaCSV(t)).join(CSV_SEP), ...righe.map(riga)].join("\r\n") + "\r\n"; // il BOM fa leggere gli accenti a Excel
}
const arr = (v, d = 1) => (num(v) === null ? null : Math.round(v * 10 ** d) / 10 ** d);
const per = (v, k, d = 1) => (num(v) === null ? null : arr(v / k, d));
const durataTxt = (s) => { if (num(s) === null) return null; s = Math.round(s); return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
const SPORT_NOME = { corsa: "Corsa", bici: "Bici", nuoto: "Nuoto", forza: "Palestra", altro: "Altro" };
const CAT_NOME = { WORKOUT: "Allenamento", RACE_A: "Gara A", RACE_B: "Gara B", RACE_C: "Gara C", NOTE: "Nota", HOLIDAY: "Vacanza", SICK: "Malattia", INJURED: "Infortunio", SET_EFTP: "Soglia", FITNESS_DAYS: "Giorni di forma", SEASON_START: "Inizio stagione", TARGET: "Obiettivo", SET_FITNESS: "Forma" };
const SEMAFORO = { verde: "verde", giallo: "giallo", rosso: "rosso" };
function passoTxt(v, tipo) {
  v = num(v);
  if (!v || v <= 0) return null;
  const sp = sportOf(tipo);
  if (sp === "corsa" || /walk|hike/i.test(String(tipo || ""))) return `${fmtPace(1000 / v)} /km`;
  if (sp === "nuoto") return `${fmtPace(100 / v)} /100 m`;
  return null;
}
const unaRiga = (s, max = 1000) => (s ? String(s).replace(/\s*[\r\n]+\s*/g, " / ").slice(0, max) : null);
// i passi di una seduta su una riga: «- 10m Z1» diventa «10m Z1» (un trattino in testa, per Excel, è l'inizio di una formula)
const passiRiga = (s) => (s ? String(s).split(/\r?\n/).map((r) => r.trim().replace(/^[-–•*]\s+/, "")).filter(Boolean).join(" · ").slice(0, 1000) : null);
function tabelleEsportazione(D) {
  const att = (D.att || []).filter((a) => a && a.start_date_local && !a._tolta).sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));
  const sed = (D.sedute || []).filter((e) => e && e.start_date_local).sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));
  const sedPer = new Map(sed.map((e) => [String(e.id), e]));
  const accoppiata = new Map();
  for (const a of att) if (a.paired_event_id !== undefined && a.paired_event_id !== null) accoppiata.set(String(a.paired_event_id), a);
  // fatta: l'attività collegata, sennò una dello stesso sport nello stesso giorno (come fa l'HUD)
  const fattaDa = (e) => accoppiata.get(String(e.id)) || att.find((a) => a.start_date_local.slice(0, 10) === e.start_date_local.slice(0, 10) && sportOf(a.type) === sportOf(e.type)) || null;
  const fitDi = (a) => { const x = D.fit && D.fit[String(a.id)]; return x && x.f ? `fit/${x.f}` : x && x.no ? `(${x.no})` : null; };
  const dur = (a) => num(a.moving_time) ?? num(a.elapsed_time);
  const out = {};
  out["attivita.csv"] = tabellaCSV([
    ["Data", (a) => a.start_date_local.slice(0, 10)],
    ["Ora", (a) => a.start_date_local.slice(11, 16)],
    ["Sport", (a) => SPORT_NOME[sportOf(a.type)]],
    ["Tipo", (a) => a.type],
    ["Nome", (a) => a.name],
    ["Durata", (a) => durataTxt(dur(a))],
    ["Minuti", (a) => per(dur(a), 60, 1)],
    ["Tempo totale", (a) => durataTxt(a.elapsed_time)],
    ["Distanza (km)", (a) => per(a.distance, 1000, 2)],
    ["Dislivello (m)", (a) => arr(a.total_elevation_gain, 0)],
    ["FC media", (a) => arr(a.average_heartrate, 0)],
    ["FC max", (a) => arr(a.max_heartrate, 0)],
    ["Passo", (a) => passoTxt(a.average_speed, a.type)],
    ["Velocità (km/h)", (a) => (num(a.average_speed) ? arr(a.average_speed * 3.6, 1) : null)],
    ["Potenza media (W)", (a) => arr(num(a.icu_average_watts) ?? num(a.average_watts), 0)],
    ["Potenza normalizzata (W)", (a) => arr(a.icu_weighted_avg_watts, 0)],
    ["Carico", (a) => arr(a.icu_training_load, 0)],
    ["Intensità (%)", (a) => arr(a.icu_intensity, 0)],
    ["Calorie", (a) => arr(a.calories, 0)],
    ["Cadenza", (a) => arr(a.average_cadence, 0)],
    ["Temperatura (°C)", (a) => arr(num(a.average_weather_temp) ?? num(a.average_temp), 1)],
    ["Fatica percepita (1-10)", (a) => arr(num(a.icu_rpe) ?? num(a.perceived_exertion), 0)],
    ["Sensazione (1-5)", (a) => arr(a.feel, 0)],
    ["Fitness (CTL)", (a) => arr(a.icu_ctl, 1)],
    ["Fatica (ATL)", (a) => arr(a.icu_atl, 1)],
    ["Seduta pianificata", (a) => { const e = a.paired_event_id !== undefined && a.paired_event_id !== null ? sedPer.get(String(a.paired_event_id)) : null; return e ? e.name : null; }],
    ["Conformità (%)", (a) => arr(a.compliance, 0)],
    ["Dispositivo", (a) => a.device_name],
    ["Origine", (a) => (/strava/i.test(a.source || "") ? "Strava (dati non disponibili)" : a.source)],
    ["File originale", fitDi],
    ["Id Intervals", (a) => String(a.id)],
  ], att);
  const oggi = D.oggi || ymd(new Date());
  out["sedute.csv"] = tabellaCSV([
    ["Data", (e) => e.start_date_local.slice(0, 10)],
    ["Ora", (e) => (e.start_date_local.slice(11, 16) === "00:00" ? null : e.start_date_local.slice(11, 16))],
    ["Categoria", (e) => CAT_NOME[e.category] || e.category || "Allenamento"],
    ["Sport", (e) => (e.type ? SPORT_NOME[sportOf(e.type)] : null)],
    ["Nome", (e) => e.name],
    ["Minuti previsti", (e) => per(num(e.moving_time) ?? num(e.durata_prevista), 60, 0)],
    ["Carico previsto", (e) => arr(e.icu_training_load, 0)],
    ["Distanza prevista (km)", (e) => per(num(e.distance) ?? num(e.distanza_prevista), 1000, 2)],
    ["Dall'app HUD", (e) => /^hud-/.test(String(e.external_id || ""))],
    ["Fatta", (e) => ((e.category || "WORKOUT") === "WORKOUT" && e.start_date_local.slice(0, 10) <= oggi ? !!fattaDa(e) : null)],
    ["Attività", (e) => { const a = (e.category || "WORKOUT") === "WORKOUT" ? fattaDa(e) : null; return a ? a.name : null; }],
    ["Conformità (%)", (e) => { const a = accoppiata.get(String(e.id)); return a ? arr(a.compliance, 0) : null; }],
    ["Descrizione", (e) => passiRiga(e.description)],
  ], sed);
  // giorni: tutti quelli con almeno un dato, da Intervals o dal diario
  const G = D.giorni || {}, DI = D.diario || {};
  const giorni = [...new Set([...Object.keys(G), ...["cibo", "acqua", "pesi", "checkins"].flatMap((k) => Object.keys(DI[k] || {}))])].filter((d) => /^\d{4}-\d\d-\d\d$/.test(d)).sort()
    .map((d) => { const lista = (DI.cibo || {})[d]; return { d, w: (G[d] && G[d].w) || {}, hud: (G[d] && G[d].hud) || null, ck: (DI.checkins || {})[d] || {}, cibo: Array.isArray(lista) && lista.length ? totaleCibo(lista) : null, acqua: (DI.acqua || {})[d], peso: (DI.pesi || {})[d] }; });
  out["giorni.csv"] = tabellaCSV([
    ["Data", (g) => g.d],
    ["Semaforo HUD", (g) => (g.hud ? SEMAFORO[g.hud.semaforo] || g.hud.semaforo : null)],
    ["Peso (kg)", (g) => arr(num(g.peso) ?? num(g.w.weight), 1)],
    ["FC a riposo", (g) => arr(g.w.restingHR, 0)],
    ["HRV", (g) => arr(g.w.hrv, 0)],
    ["Sonno (ore)", (g) => per(g.w.sleepSecs, 3600, 1)],
    ["Punteggio sonno", (g) => arr(g.w.sleepScore, 0)],
    ["Prontezza", (g) => arr(g.w.readiness, 0)],
    ["Passi", (g) => arr(g.w.steps, 0)],
    ["Fitness (CTL)", (g) => arr(g.w.ctl, 1)],
    ["Fatica (ATL)", (g) => arr(g.w.atl, 1)],
    ["Forma (TSB)", (g) => (num(g.w.ctl) !== null && num(g.w.atl) !== null ? arr(g.w.ctl - g.w.atl, 1) : null)],
    ["VO2max", (g) => arr(g.w.vo2max, 1)],
    ["Grasso (%)", (g) => arr(g.w.bodyFat, 1)],
    ["Gambe (check-in)", (g) => arr(g.ck.g, 0)],
    ["Energia (check-in)", (g) => arr(g.ck.e, 0)],
    ["Umore (check-in)", (g) => arr(g.ck.u, 0)],
    ["Acqua (ml)", (g) => arr(g.acqua, 0)],
    ["Kcal mangiate", (g) => arr(g.cibo ? g.cibo.kcal : g.w.kcalConsumed, 0)],
    ["Carboidrati (g)", (g) => arr(g.cibo ? g.cibo.C : g.w.carbohydrates, 0)],
    ["Proteine (g)", (g) => arr(g.cibo ? g.cibo.P : g.w.protein, 0)],
    ["Grassi (g)", (g) => arr(g.cibo ? g.cibo.G : g.w.fatTotal, 0)],
    ["Kcal piano HUD", (g) => (g.hud && g.hud.piano ? arr(g.hud.piano.kcal, 0) : null)],
    ["Carboidrati piano HUD (g)", (g) => (g.hud && g.hud.piano ? arr(g.hud.piano.C, 0) : null)],
    ["Verdetto HUD", (g) => (g.hud ? unaRiga(g.hud.verdetto, 400) : null)],
  ], giorni);
  const nomeEs = (id) => { try { const e = ESL.find((x) => x[0] === id); return e ? e[1] : id; } catch (e) { return id; } };
  const serie = [];
  for (const x of (DI.palestra || []).slice().sort((a, b) => (a.data + a.es).localeCompare(b.data + b.es))) (x.serie || []).forEach((s, i) => serie.push({ ...s, data: x.data, es: x.es, n: i + 1 }));
  out["palestra.csv"] = tabellaCSV([
    ["Data", (s) => s.data], ["Esercizio", (s) => nomeEs(s.es)], ["Serie", (s) => s.n], ["Kg", (s) => arr(s.kg, 2)], ["Ripetizioni", (s) => arr(s.rip, 0)],
    ["Secondi", (s) => arr(s.sec, 0)], ["Ripetizioni in riserva", (s) => arr(s.rir, 0)], ["Codice esercizio", (s) => s.es],
  ], serie);
  const pasti = [];
  for (const d of Object.keys(DI.cibo || {}).sort()) for (const e of DI.cibo[d] || []) pasti.push({ d, e, t: totaleCibo([e]) });
  out["cibo.csv"] = tabellaCSV([
    ["Data", (p) => p.d], ["Ora", (p) => p.e.ora], ["Cosa", (p) => p.e.testo], ["Kcal", (p) => arr(p.t.kcal, 0)],
    ["Carboidrati (g)", (p) => arr(p.t.C, 0)], ["Proteine (g)", (p) => arr(p.t.P, 0)], ["Grassi (g)", (p) => arr(p.t.G, 0)],
  ], pasti);
  const lunghi = Object.keys(DI.lunghi || {}).sort().map((d) => ({ d, ...(DI.lunghi[d] || {}) }));
  out["rifornimento.csv"] = tabellaCSV([
    ["Data", (l) => l.d], ["Sport", (l) => SPORT_NOME[l.sport] || l.sport], ["Minuti", (l) => arr(l.min, 0)], ["Temperatura (°C)", (l) => arr(l.T, 0)],
    ["Carboidrati presi (g)", (l) => arr(l.carbo, 0)], ["Carboidrati all'ora (g/h)", (l) => (num(l.carbo) !== null && num(l.min) ? arr(l.carbo / (l.min / 60), 0) : null)],
    ["Stomaco", (l) => l.stomaco], ["Peso prima (kg)", (l) => arr(l.pre, 1)], ["Peso dopo (kg)", (l) => arr(l.post, 1)], ["Bevuto (ml)", (l) => arr(l.bevuto, 0)],
  ], lunghi);
  const soglie = [];
  for (const f of D.soglie || []) for (const s of f.sport || []) soglie.push({ d: f.d, ...s });
  out["soglie.csv"] = tabellaCSV([
    ["Data", (s) => s.d], ["Sport", (s) => (s.types || []).join(", ")], ["FTP (W)", (s) => arr(s.ftp, 0)], ["Soglia FC", (s) => arr(s.lthr, 0)], ["FC max", (s) => arr(s.max_hr, 0)],
    ["Passo soglia", (s) => passoTxt(s.threshold_pace, (s.types || []).find((t) => /run|swim/i.test(t)) || "")], ["Velocità soglia (m/s)", (s) => arr(s.threshold_pace, 3)],
  ], soglie);
  return { file: out, conti: { attivita: att.length, giorni: giorni.length, sedute: sed.length, serie: serie.length, pasti: pasti.length } };
}
function leggimiCartella() {
  return `HUD Archivio
Qui l'HUD tiene tutto il tuo storico, un file per anno. Cresce a ogni apertura dell'app e non cancella mai nulla.

attivita-AAAA.json   ogni allenamento con tutti i dati di Intervals
giorni-AAAA.json     peso, sonno, HRV, forma e il verdetto dell'HUD di ogni giorno
sedute-AAAA.json     le sedute pianificate nel calendario
diario-AAAA.json     palestra, cibo, acqua, pesate, check-in e lunghi segnati nell'app
soglie.json          come sono cambiate le soglie
fit/                 i file originali dell'orologio, uno per allenamento

Non spostare né rinominare questi file: l'app li aggiorna da sola.
Per avere tabelle da aprire con Numbers o Excel: app HUD › Impostazioni › Esporta i miei dati.
`;
}
function leggimiEsportazione(R, conti, now) {
  const quando = `${now.getDate()} ${MESI[now.getMonth()]} ${now.getFullYear()} alle ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `HUD · i tuoi dati
Esportati il ${quando} (versione ${VERSIONE}). ${fmtIt(conti.attivita)} attività${R && R.dal ? ` dal ${R.dal}` : ""}, ${fmtIt(conti.giorni)} giorni, ${fmtIt(conti.sedute)} sedute pianificate.${R && !R.finito ? "\nL'archivio non era ancora completo: gli anni più vecchi si stavano ancora recuperando da Intervals." : ""}

COSA C'È
attivita.csv       una riga per allenamento: data, sport, durata, distanza, frequenza cardiaca, passo, potenza, carico, la seduta pianificata collegata e il file originale.
giorni.csv         una riga per giorno: peso, sonno, HRV, FC a riposo, forma (CTL, ATL, TSB), check-in, cibo e acqua, il semaforo e il verdetto dell'HUD.
sedute.csv         le sedute pianificate nel calendario, fatte o no.
soglie.csv         come sono cambiate FTP, soglia di frequenza cardiaca e passo soglia.
palestra.csv       ogni serie: esercizio, kg, ripetizioni, ripetizioni in riserva.
cibo.csv           ogni cosa segnata nel Carburante.
rifornimento.csv   i lunghi segnati: carboidrati, stomaco, peso prima e dopo, bevuto.
json/              tutto l'archivio così com'è, con ogni campo di Intervals: per programmi e altre app.

COME APRIRLI
Le tabelle si aprono con Numbers o Excel: punto e virgola tra le colonne e virgola nei decimali, come nei fogli in italiano. Le date sono anno-mese-giorno, così si ordinano da sole.

I FILE ORIGINALI DELL'OROLOGIO
Non sono in questo .zip perché pesano molto. Li trovi in iCloud Drive › Scriptable › HUD Archivio › fit, uno per allenamento (.fit, .tcx o .gpx, compressi .gz): la colonna «File originale» di attivita.csv dice quale. Si caricano su Garmin Connect, Strava, Runalyze, GoldenCheetah e quasi ogni app di sport.

DA DOVE ARRIVANO
Attività, benessere e sedute da Intervals.icu, che li riceve dal tuo orologio (con Garmin, da Garmin Connect). Palestra, cibo, acqua, check-in e verdetti dall'HUD. Le attività che Intervals ha preso da Strava hanno solo data e sport: Strava non concede i dati alle altre app.
`;
}

// ---- .zip senza compressione (va bene per qualsiasi app) con il controllo CRC-32
let CRC_T = null;
function crc32(b) {
  if (!CRC_T) { CRC_T = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c; } }
  let c = -1;
  for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function utf8(s) {
  s = String(s);
  const out = new Uint8Array(s.length * 3);
  let j = 0;
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
    if (c < 0x80) out[j++] = c;
    else if (c < 0x800) { out[j++] = 0xc0 | (c >> 6); out[j++] = 0x80 | (c & 63); }
    else if (c < 0x10000) { out[j++] = 0xe0 | (c >> 12); out[j++] = 0x80 | ((c >> 6) & 63); out[j++] = 0x80 | (c & 63); }
    else { out[j++] = 0xf0 | (c >> 18); out[j++] = 0x80 | ((c >> 12) & 63); out[j++] = 0x80 | ((c >> 6) & 63); out[j++] = 0x80 | (c & 63); }
  }
  return out.slice(0, j);
}
function creaZip(voci, now = new Date()) {
  const ora = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const giorno = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  const parti = [], centrale = [];
  let off = 0;
  for (const [nome, dati] of voci) {
    const n = utf8(nome), crc = crc32(dati);
    const L = new Uint8Array(30 + n.length), v = new DataView(L.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true); // 0x0800: nomi in UTF-8
    v.setUint16(10, ora, true); v.setUint16(12, giorno, true); v.setUint32(14, crc, true); v.setUint32(18, dati.length, true); v.setUint32(22, dati.length, true);
    v.setUint16(26, n.length, true); v.setUint16(28, 0, true); L.set(n, 30);
    const C = new Uint8Array(46 + n.length), w = new DataView(C.buffer);
    w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true); w.setUint16(10, 0, true);
    w.setUint16(12, ora, true); w.setUint16(14, giorno, true); w.setUint32(16, crc, true); w.setUint32(20, dati.length, true); w.setUint32(24, dati.length, true);
    w.setUint16(28, n.length, true); w.setUint32(42, off, true); C.set(n, 46);
    parti.push(L, dati); centrale.push(C);
    off += L.length + dati.length;
  }
  const cd = centrale.reduce((t, c) => t + c.length, 0), E = new Uint8Array(22), e = new DataView(E.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, voci.length, true); e.setUint16(10, voci.length, true); e.setUint32(12, cd, true); e.setUint32(16, off, true);
  const tutto = new Uint8Array(off + cd + 22);
  let p = 0;
  for (const x of [...parti, ...centrale, E]) { tutto.set(x, p); p += x.length; }
  return tutto;
}
let B64_2 = null;
function base64(b) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  if (!B64_2) { B64_2 = new Array(4096); for (let k = 0; k < 4096; k++) B64_2[k] = A[k >> 6] + A[k & 63]; } // due caratteri per volta: 10 volte più veloce
  const parti = [], n3 = b.length - (b.length % 3);
  for (let i = 0; i < n3; i += 49152) {
    const fine = Math.min(i + 49152, n3), s = new Array((fine - i) / 3);
    for (let j = i, k = 0; j < fine; j += 3, k++) { const n = (b[j] << 16) | (b[j + 1] << 8) | b[j + 2]; s[k] = B64_2[n >> 12] + B64_2[n & 4095]; }
    parti.push(s.join(""));
  }
  const r = b.length - n3;
  if (r === 1) { const n = b[n3] << 16; parti.push(A[n >> 18] + A[(n >> 12) & 63] + "=="); }
  else if (r === 2) { const n = (b[n3] << 16) | (b[n3 + 1] << 8); parti.push(A[n >> 18] + A[(n >> 12) & 63] + A[(n >> 6) & 63] + "="); }
  return parti.join("");
}
async function esportaDati(now) {
  const X = archFM();
  const S = await archLeggi(X, "stato.json", null);
  if (!S) throw new Error("L'archivio non c'è ancora: riapri l'app collegata a Intervals e riprova tra un minuto");
  const D = { oggi: ymd(now), att: [], giorni: {}, sedute: [], diario: { cibo: {}, acqua: {}, pesi: {}, checkins: {}, lunghi: {}, palestra: [] }, soglie: [], fit: {} };
  const json = [];
  const leggi = async (nome) => { const f = X.p(nome); await archScarica(X, f); return X.fm.readString(f); };
  for (const nome of X.fm.listContents(X.dir).filter((f) => /\.json$/i.test(f)).sort()) {
    const t = await leggi(nome);
    json.push([`json/${nome}`, t]);
    let j; try { j = JSON.parse(t); } catch (e) { continue; }
    const m = nome.match(/^(attivita|giorni|sedute|diario)-\d{4}\.json$/);
    if (!m) { if (nome === "soglie.json") D.soglie = j.lista || []; continue; }
    if (m[1] === "attivita") D.att.push(...Object.values(j.att || {}));
    else if (m[1] === "giorni") Object.assign(D.giorni, j.giorni || {});
    else if (m[1] === "sedute") D.sedute.push(...Object.values(j.sedute || {}));
    else { for (const k of DIA_MAPPE) Object.assign(D.diario[k], j[k] || {}); D.diario.palestra.push(...Object.values(j.palestra || {})); }
  }
  if (X.fm.fileExists(X.p("fit/indice.json"))) { const t = await leggi("fit/indice.json"); json.push(["json/fit-indice.json", t]); try { D.fit = JSON.parse(t).f || {}; } catch (e) {} }
  const T = tabelleEsportazione(D), R = riassuntoArchivio(S);
  const voci = [["LEGGIMI.txt", leggimiEsportazione(R, T.conti, now)], ...Object.entries(T.file), ...json];
  const zip = creaZip(voci.map(([n, t]) => [n, utf8(t)]), now);
  const nome = `HUD-dati-${ymd(now)}.zip`;
  let salvato = null;
  try { salvato = await DocumentPicker.exportData(Data.fromBase64String(base64(zip)), nome); } catch (e) { salvato = null; } // annullato
  return { nome, kb: Math.round(zip.length / 1024), conti: T.conti, salvato: Array.isArray(salvato) ? salvato : salvato ? [salvato] : [] };
}
