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
// ---- Curve dei migliori (come GoldenCheetah): le calcola Intervals.icu con i modelli, una volta al giorno, solo per la vista completa
const CURVA_SEC = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200];
const CURVA_M = [400, 1000, 1609, 3000, 5000, 10000, 21097, 42195];
let CURVA_CP = null; // { cp, wp }: potenza critica e W′ per il W′bal delle uscite con la potenza
// i valori di una curva ai punti standard (durate o distanze): il punto esatto o il più vicino entro il 10%
function puntiCurva(xs, vs, punti) {
  if (!Array.isArray(xs) || !Array.isArray(vs) || !xs.length) return [];
  const out = [];
  for (const p of punti) {
    let best = -1, d = Infinity;
    for (let i = 0; i < xs.length; i++) { const q = Math.abs(xs[i] - p); if (q < d && num(vs[i]) !== null && vs[i] > 0) { d = q; best = i; } }
    if (best >= 0 && d <= p * 0.1) out.push([p, vs[best]]);
  }
  return out;
}
async function curveIntervals(key, now) {
  const [pw, pc] = await Promise.all([
    ivGet(key, `${BASE}/power-curves.json?type=Ride&curves=84d,1y`).catch(() => null),
    ivGet(key, `${BASE}/pace-curves.json?type=Run&curves=84d,1y&gap=false`).catch(() => null),
  ]);
  const L = (J, i) => (J && Array.isArray(J.list) && J.list[i]) || null;
  const out = { d: ymd(now), potenza: null, passo: null };
  const p0 = L(pw, 0), p1 = L(pw, 1);
  if (p0 && Array.isArray(p0.secs)) {
    const M = (p0.powerModels || []).find((m) => num(m.criticalPower) && num(m.wPrime)) || null;
    out.potenza = { p84: puntiCurva(p0.secs, p0.values, CURVA_SEC).map(([s, w]) => [s, Math.round(w)]), p1y: p1 ? puntiCurva(p1.secs, p1.values, CURVA_SEC).map(([s, w]) => [s, Math.round(w)]) : [],
      cp: M ? Math.round(M.criticalPower) : null, wp: M ? Math.round(M.wPrime) : null, pmax: M && num(M.pMax) ? Math.round(M.pMax) : null };
    if (out.potenza.p84.length < 3) out.potenza = null;
  }
  const c0 = L(pc, 0), c1 = L(pc, 1);
  if (c0 && Array.isArray(c0.distance)) {
    // values: secondi per coprire la distanza (se sembrano velocità in m/s si convertono)
    const sec = (C) => { const v = (C.values || []).filter((x) => num(x) !== null && x > 0), med = v.length ? v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0; return med && med < 30 ? C.distance.map((d, i) => (C.values[i] > 0 ? d / C.values[i] : null)) : C.values; };
    const M = (c0.paceModels || []).find((m) => num(m.criticalSpeed)) || null;
    out.passo = { p84: puntiCurva(c0.distance, sec(c0), CURVA_M).map(([m, s]) => [m, Math.round(s)]), p1y: c1 ? puntiCurva(c1.distance, sec(c1), CURVA_M).map(([m, s]) => [m, Math.round(s)]) : [],
      cs: M ? Math.round(M.criticalSpeed * 100) / 100 : null, dp: M && num(M.dPrime) ? Math.round(M.dPrime) : null };
    if (out.passo.p84.length < 3) out.passo = null;
  }
  return out;
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
  // W′bal: quanta energia sopra la potenza critica resta (Skiba 2012 in forma differenziale, ricarica di Froncioni e Clarke)
  const Wt = S.watts && S.watts.data;
  if (CURVA_CP && Wt && T && Wt.length === T.length && Wt.some((v) => v > 0)) {
    const { cp, wp } = CURVA_CP, bal = new Array(Wt.length); let b = wp, min = wp;
    for (let i = 0; i < Wt.length; i++) {
      const dt = i ? Math.max(0, Math.min(10, (T[i] - T[i - 1]) || 1)) : 1, p = num(Wt[i]) || 0;
      b = p > cp ? b - (p - cp) * dt : b + ((cp - p) * dt * (wp - b)) / wp;
      b = Math.max(-wp, Math.min(wp, b)); bal[i] = b; if (b < min) min = b;
    }
    out.s.wbal = riduci(bal, N, 0); out.wbal = { min: Math.round(min), wp: Math.round(wp), cp: Math.round(cp) };
  }
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
  // SWOLF (secondi + bracciate per vasca, più basso è meglio): serve la frequenza di bracciata e la vasca
  const swolf = acts.filter((a) => a.type === "Swim" && num(a.average_cadence) && num(a.distance) && num(a.moving_time) && g(a) <= 180 && g(a) >= 0).map((a) => {
    const m = num(a.distance), L = num(a.pool_length) || (num(a.lengths) ? m / num(a.lengths) : 0), v = m / num(a.moving_time);
    if (!(L >= 15 && L <= 100)) return null; const tl = L / v, bv = (num(a.average_cadence) * tl) / 60;
    return bv > 3 && bv < 80 ? { d: ds(a), g: g(a), v: Math.round(tl + bv), bv: Math.round(bv * 10) / 10, L: Math.round(L), m: Math.round(m) } : null;
  }).filter(Boolean).sort((a, b) => a.d.localeCompare(b.d));
  const W = (raw.wellness || []).filter((w) => w && w.id && daysBetween(parseYMD(w.id), now) <= 111 && daysBetween(parseYMD(w.id), now) >= 0);
  const sett = [];
  for (let k = 15; k >= 0; k--) { const xs = W.filter((w) => Math.floor(daysBetween(parseYMD(w.id), now) / 7) === k); if (xs.length) sett.push({ g: k * 7, d: ymd(addDays(now, -k * 7)), rhr: MED(xs.map((w) => num(w.restingHR))), hrv: MED(xs.map((w) => num(w.hrv) ?? num(w.hrvSDNN))) }); }
  const cuore = (key) => { const pts = sett.map((x) => ({ d: x.d, g: x.g, v: x[key] })).filter((x) => x.v !== null); return { pts, ...confronto(pts) }; };
  return {
    corsa: dur,
    bici: { pts: bici, ...confronto(bici), mancano: lunghiBici.filter((a) => !dettagli[a.id]).length },
    nuoto: { pts: nuoto, ...confronto(nuoto), css: toSec(CONFIG.nuoto.css), swolf: { pts: swolf, ...confronto(swolf) } },
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
  const doneList = [act(0, "Swim", 44, 42, { distance: 1400, pool_length: 25, average_cadence: 27 }), act(1, "Run", 31, 26, { distance: 5200 }), act(2, "Swim", 57, 47, { distance: 2600, pool_length: 25, average_cadence: 26.5 })];
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
    if (wd === 1 || wd === 3 || wd === 5) activities.push({ start_date_local: ymd(d) + "T06:30:00", type: "Swim", name: "Nuoto", moving_time: 3300, distance: 2800, icu_training_load: 45, pool_length: 25, lengths: 112, average_cadence: 26 + i / 30 + (k % 3) * 0.6 });
    if (wd === 6) activities.push({ start_date_local: ymd(d) + "T09:00:00", type: "VirtualRide", name: "Bici Z2", moving_time: 6000, icu_training_load: 80 });
  }
  // diario demo: check-in degli ultimi 40 giorni
  const checkins = {};
  for (let i = 40; i >= 1; i--) { const k = (i * 7) % 5; checkins[ymd(addDays(now, -i))] = { g: 2 + (k % 4), e: 2 + ((k + 1) % 4), u: 3 + (k % 3) }; }
  return { wellness, events, activities, fetchedAt: now.toISOString(), demo: true, diary: { checkins, adapt: {} } };
}

