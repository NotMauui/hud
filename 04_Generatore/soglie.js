// Stima delle soglie di ogni persona dalle sue attività: FC massima, soglia FC (corsa e bici),
// passo soglia di corsa, CSS del nuoto, FTP. Nessun valore personale nel codice.
// Lo stesso blocco (tra i due marcatori) è copiato dentro l'app: test-soglie.js controlla che siano identici.
// Ingresso: raw = { activities, events } come li dà Intervals; now = Date;
//   att = impostazioni attuali di Intervals { corsa: {lthr, max_hr, threshold_pace}, bici: {lthr, max_hr, ftp}, nuoto: {threshold_pace} }
//   (velocità in m/s, come le usa Intervals).
// Uscita: { fcMax, corsa: {lthr, passo}, bici: {lthr, ftp}, nuoto: {css}, cambi: [...] }
//   ogni valore è { v, fonte, aff: "alta" | "media" | "bassa", perche } oppure null;
//   cambi = le impostazioni da scrivere su Intervals: { tipo: "Run" | "Ride" | "Swim", campo, da, a, testo }.

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

if (typeof module !== "undefined") module.exports = { stimaSoglie };
