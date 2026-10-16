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

