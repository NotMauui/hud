// Verifica automatica del profilo: gira sui dati di ogni utente, senza nulla di personale nel codice.
// Lo stesso blocco (tra i due marcatori) è copiato dentro l'app HUD-70.3.js: test-verifiche.js controlla che siano identici.
// Ingresso: raw = { activities, wellness } come li dà Intervals, cfg = CONFIG dell'app, now = Date.
// Uscita: elenco di { k, liv: "aggiorna" | "controlla" | "info", titolo, testo, azione, valore? }

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

if (typeof module !== "undefined") module.exports = { verificaProfilo };
