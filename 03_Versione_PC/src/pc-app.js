// ============================================================
//  HUD · Analisi (versione da PC)
//  Usa lo stesso motore dell'app iPhone (analyze + insights)
//  Fonti: Intervals.icu in diretta, file esportato dall'iPhone, demo
// ============================================================
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const SP = { nuoto: "var(--s-nuoto)", bici: "var(--s-bici)", corsa: "var(--s-corsa)", forza: "var(--s-forza)", altro: "var(--muted)" };
  const SPN = { nuoto: "Nuoto", bici: "Bici", corsa: "Corsa", forza: "Forza", altro: "Altro" };
  const st = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  const it = (v, d = 0) => (v === null || v === undefined || !isFinite(v) ? "—" : Number(v).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const dlab = (s) => { const d = parseYMD(s); return `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`; };

  // ---------------------------------------------------------- dati
  let SRC = null; // { raw, diary, label }
  async function caricaLive() {
    const key = st("hud_key"); if (!key) throw new Error("Nessuna chiave salvata");
    const now = new Date(), mon = mondayOf(now);
    const auth = "Basic " + btoa("API_KEY:" + key);
    const get = async (path) => {
      const r = await fetch("https://intervals.icu/api/v1/athlete/0" + path, { headers: { Authorization: auth, Accept: "application/json" } });
      if (!r.ok) throw new Error(`Intervals ha risposto ${r.status}`);
      return r.json();
    };
    const [wellness, events, activities] = await Promise.all([
      get(`/wellness?oldest=${ymd(addDays(now, -365))}&newest=${ymd(now)}`),
      get(`/events?oldest=${ymd(mon)}&newest=${ymd(addDays(mon, 13))}&resolve=true`),
      get(`/activities?oldest=${ymd(addDays(now, -180))}&newest=${ymd(now)}`),
    ]);
    return { raw: { wellness, events, activities, fetchedAt: now.toISOString() }, diary: JSON.parse(st("hud_diary") || "{}"), label: "Intervals.icu in diretta" };
  }
  function daFile(obj) {
    if (obj.config) for (const k of Object.keys(obj.config)) CONFIG[k] = obj.config[k];
    const raw = obj.raw || obj;
    if (!raw.wellness || !raw.activities) throw new Error("Il file non contiene dati dell'HUD");
    return { raw, diary: obj.diary || {}, label: `File dell'iPhone · ${obj.esportato ? new Date(obj.esportato).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }) : "senza data"}` };
  }
  function demo() { const now = new Date(); const raw = demoData(now); return { raw, diary: raw.diary, label: "Dati demo" }; }

  // ---------------------------------------------------------- grafici (SVG)
  function el(tag, attrs = {}, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function tip() { let t = $("#tip"); if (!t) { t = document.createElement("div"); t.id = "tip"; document.body.appendChild(t); } return t; }
  function showTip(html, ev) { const t = tip(); t.innerHTML = html; t.style.display = "block"; const x = Math.min(window.innerWidth - t.offsetWidth - 12, ev.clientX + 14); t.style.left = x + "px"; t.style.top = (ev.clientY + 14) + "px"; }
  function hideTip() { tip().style.display = "none"; }

  // linee nel tempo con crosshair. opts: {dates, series:[{name,color,values,dash,width,area}], bands:[{from,to,color}], refs:[{y,label}], yFmt, h, zero, todayIdx}
  function lineChart(host, o) {
    host.innerHTML = "";
    const W = host.clientWidth || 600, H = o.h || 220, L = 40, R = 12, T = 12, B = 26;
    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.label || "grafico" }, host);
    const n = o.dates.length; if (n < 2) { host.innerHTML = '<div class="empty">Dati insufficienti</div>'; return; }
    const vals = o.series.flatMap((s) => s.values.filter((v) => v !== null && isFinite(v)));
    (o.refs || []).forEach((r) => vals.push(r.y));
    (o.bands || []).forEach((b) => { [b.from, b.to].forEach((v) => { if (isFinite(v) && Math.abs(v) <= 30) vals.push(v); }); });
    let lo = Math.min(...vals), hi = Math.max(...vals); if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (o.yMin !== undefined) lo = o.yMin; if (o.yMax !== undefined) hi = o.yMax;
    const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    const X = (i) => L + (i / (n - 1)) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    (o.bands || []).forEach((b) => { const a = Math.max(b.from, lo), c = Math.min(b.to, hi); if (c > a) el("rect", { x: L, width: W - L - R, y: Y(c), height: Y(a) - Y(c), fill: b.color, opacity: b.op ?? 0.12 }, svg); });
    const ticks = 4; for (let i = 0; i <= ticks; i++) { const v = lo + (hi - lo) * i / ticks; el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "grid" }, svg); const t = el("text", { x: L - 6, y: Y(v) + 4, class: "ax", "text-anchor": "end" }, svg); t.textContent = o.yFmt ? o.yFmt(v) : it(v); }
    const step = Math.max(1, Math.round(n / 6)); for (let i = 0; i < n; i += step) { const t = el("text", { x: X(i), y: H - 6, class: "ax", "text-anchor": i === 0 ? "start" : "middle" }, svg); t.textContent = dlab(o.dates[i]); }
    (o.refs || []).forEach((r) => { el("line", { x1: L, x2: W - R, y1: Y(r.y), y2: Y(r.y), class: "ref" }, svg); if (r.label) { const t = el("text", { x: W - R - 4, y: Y(r.y) - 4, class: "ax", "text-anchor": "end" }, svg); t.textContent = r.label; } });
    if (o.todayIdx !== undefined && o.todayIdx >= 0) el("line", { x1: X(o.todayIdx), x2: X(o.todayIdx), y1: T, y2: H - B, class: "today" }, svg);
    for (const s of o.series) {
      let d = "", started = false;
      s.values.forEach((v, i) => { if (v === null || !isFinite(v)) { started = false; return; } d += (started ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); started = true; });
      if (s.area) { const f = s.values.findIndex((v) => v !== null), l = s.values.length - 1 - [...s.values].reverse().findIndex((v) => v !== null); el("path", { d: d + `L${X(l)} ${Y(Math.max(lo, 0))}L${X(f)} ${Y(Math.max(lo, 0))}Z`, fill: s.color, opacity: 0.14 }, svg); }
      el("path", { d, fill: "none", stroke: s.color, "stroke-width": s.width || 2, "stroke-dasharray": s.dash || "", "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      if (s.dots) s.values.forEach((v, i) => { if (v !== null) el("circle", { cx: X(i), cy: Y(v), r: 2.5, fill: s.color }, svg); });
    }
    const cross = el("line", { y1: T, y2: H - B, class: "cross", visibility: "hidden" }, svg);
    const dots = o.series.map((s) => el("circle", { r: 4.5, fill: s.color, stroke: "var(--card)", "stroke-width": 2, visibility: "hidden" }, svg));
    const hit = el("rect", { x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent" }, svg);
    hit.addEventListener("mousemove", (ev) => {
      const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.round(((ev.clientX - r.left) - L) / (W - L - R) * (n - 1))));
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
      o.series.forEach((s, k) => { const v = s.values[i]; if (v === null || !isFinite(v)) dots[k].setAttribute("visibility", "hidden"); else { dots[k].setAttribute("cx", X(i)); dots[k].setAttribute("cy", Y(v)); dots[k].setAttribute("visibility", "visible"); } });
      showTip(`<b>${dlab(o.dates[i])}${o.extraLabel ? o.extraLabel(i) : ""}</b>` + o.series.filter((s) => s.values[i] !== null && isFinite(s.values[i])).map((s) => `<div><i style="background:${s.color}"></i>${s.name}<span>${o.yFmt ? o.yFmt(s.values[i]) : it(s.values[i], s.dec || 0)}</span></div>`).join(""), ev);
    });
    hit.addEventListener("mouseleave", () => { cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); hideTip(); });
  }

  // barre impilate per categoria (settimane × sport). opts: {labels, stacks:[{name,color,values}], line:{name,values}, yFmt, h}
  function stackChart(host, o) {
    host.innerHTML = "";
    const W = host.clientWidth || 600, H = o.h || 220, L = 40, R = 12, T = 12, B = 26;
    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.label || "grafico" }, host);
    const n = o.labels.length; const tot = o.labels.map((_, i) => o.stacks.reduce((t, s) => t + (s.values[i] || 0), 0));
    const hi = Math.max(...tot, ...(o.refs || []).map((r) => r.y), 1) * 1.1;
    const bw = (W - L - R) / n, Y = (v) => T + (1 - v / hi) * (H - T - B);
    for (let i = 0; i <= 4; i++) { const v = hi * i / 4; el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "grid" }, svg); const t = el("text", { x: L - 6, y: Y(v) + 4, class: "ax", "text-anchor": "end" }, svg); t.textContent = o.yFmt ? o.yFmt(v) : it(v); }
    o.labels.forEach((lab, i) => {
      let base = 0; const x = L + i * bw + bw * 0.15, w = bw * 0.7;
      o.stacks.forEach((s, k) => { const v = s.values[i] || 0; if (!v) return; const y1 = Y(base + v), y0 = Y(base); el("rect", { x, y: y1 + 1, width: w, height: Math.max(0, y0 - y1 - 2), rx: 3, fill: s.color, opacity: o.dim && o.dim(i) ? 0.45 : 1 }, svg); base += v; });
      if (i % Math.max(1, Math.round(n / 8)) === 0) { const t = el("text", { x: x + w / 2, y: H - 6, class: "ax", "text-anchor": "middle" }, svg); t.textContent = lab; }
      const hit = el("rect", { x: L + i * bw, y: T, width: bw, height: H - T - B, fill: "transparent" }, svg);
      hit.addEventListener("mousemove", (ev) => showTip(`<b>${o.tipTitle ? o.tipTitle(i) : lab}</b>` + o.stacks.map((s) => `<div><i style="background:${s.color}"></i>${s.name}<span>${o.yFmt ? o.yFmt(s.values[i] || 0) : it(s.values[i])}</span></div>`).join("") + `<div class="tt"><i></i>Totale<span>${o.yFmt ? o.yFmt(tot[i]) : it(tot[i])}</span></div>` + (o.extra ? o.extra(i) : ""), ev));
      hit.addEventListener("mouseleave", hideTip);
    });
    (o.refs || []).forEach((r) => { el("line", { x1: L, x2: W - R, y1: Y(r.y), y2: Y(r.y), class: "ref" }, svg); const t = el("text", { x: W - R - 4, y: Y(r.y) - 4, class: "ax", "text-anchor": "end" }, svg); t.textContent = r.label; });
    if (o.line) { let d = ""; o.line.values.forEach((v, i) => { if (v === null) return; d += (d ? "L" : "M") + (L + i * bw + bw / 2) + " " + Y(v); }); el("path", { d, fill: "none", stroke: o.line.color, "stroke-width": 2, "stroke-dasharray": "5 4" }, svg); }
  }

  // dispersione nel tempo. opts: {pts:[{d, v, c, tip, r}], line:[{d,v}], yFmt, invert, h}
  function scatterChart(host, o) {
    host.innerHTML = "";
    const W = host.clientWidth || 600, H = o.h || 220, L = 46, R = 12, T = 12, B = 26;
    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.label || "grafico" }, host);
    if (o.pts.length < 2) { host.innerHTML = '<div class="empty">Dati insufficienti</div>'; return; }
    const xs = o.pts.map((p) => (o.xNum ? p.x : parseYMD(p.d).getTime())), vs = o.pts.map((p) => p.v);
    const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1, lo0 = Math.min(...vs), hi0 = Math.max(...vs), pd = (hi0 - lo0) * 0.1 || 1, lo = lo0 - pd, hi = hi0 + pd;
    const X = (t) => L + ((t - x0) / (x1 - x0 || 1)) * (W - L - R), Y = (v) => o.invert ? T + ((v - lo) / (hi - lo)) * (H - T - B) : T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4; el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "grid" }, svg); const t = el("text", { x: L - 6, y: Y(v) + 4, class: "ax", "text-anchor": "end" }, svg); t.textContent = o.yFmt ? o.yFmt(v) : it(v, 1); }
    if (o.xNum) { for (let i = 0; i <= 4; i++) { const v = x0 + (x1 - x0) * i / 4; const t = el("text", { x: X(v), y: H - 6, class: "ax", "text-anchor": "middle" }, svg); t.textContent = o.xFmt ? o.xFmt(v) : it(v, 1); } }
    else { const span = (x1 - x0) / 5; for (let i = 0; i <= 5; i++) { const v = x0 + span * i; const t = el("text", { x: X(v), y: H - 6, class: "ax", "text-anchor": i === 0 ? "start" : i === 5 ? "end" : "middle" }, svg); t.textContent = dlab(ymd(new Date(v))); } }
    if (o.line && o.line.length > 1) { const d = o.line.map((p, i) => (i ? "L" : "M") + X(o.xNum ? p.x : parseYMD(p.d).getTime()).toFixed(1) + " " + Y(p.v).toFixed(1)).join(""); el("path", { d, fill: "none", stroke: o.lineColor || "var(--ink)", "stroke-width": 2.5, "stroke-linejoin": "round" }, svg); }
    o.pts.forEach((p, i) => {
      const c = el("circle", { cx: X(xs[i]), cy: Y(p.v), r: p.r || 4, fill: p.c, stroke: "var(--card)", "stroke-width": 1.5, opacity: p.op ?? 0.9 }, svg);
      const h = el("circle", { cx: X(xs[i]), cy: Y(p.v), r: 9, fill: "transparent" }, svg);
      h.addEventListener("mousemove", (ev) => showTip(p.tip, ev)); h.addEventListener("mouseleave", hideTip);
    });
  }

  // ---------------------------------------------------------- analisi aggiuntive per il PC
  function weeksBack(now, n) { const m = mondayOf(now); return Array.from({ length: n }, (_, i) => addDays(m, -7 * (n - 1 - i))); }
  function inWeek(a, mon) { const d = parseYMD(a.start_date_local.slice(0, 10)); return d >= mon && d < addDays(mon, 7); }
  const durS = (a) => num(a.moving_time) ?? num(a.elapsed_time) ?? 0;

  function analisiPC(raw, A, now) {
    const acts = (raw.activities || []).filter((a) => a && a.start_date_local).sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));
    const weeks = weeksBack(now, 26);
    const vol = { nuoto: [], bici: [], corsa: [], forza: [] }, tss = [], easy = [], hard = [], tm = [];
    for (const mon of weeks) {
      const wa = acts.filter((a) => inWeek(a, mon));
      for (const sp of Object.keys(vol)) vol[sp].push(wa.filter((a) => sportOf(a.type) === sp).reduce((t, a) => t + durS(a), 0) / 3600);
      tss.push(wa.reduce((t, a) => t + (num(a.icu_training_load) || 0), 0));
      // intensità: dai tempi in zona se ci sono, altrimenti dalla FC media rispetto alla soglia
      let e = 0, h = 0;
      for (const a of wa) {
        const z = a.icu_hr_zone_times;
        if (Array.isArray(z) && z.length >= 3) { e += z.slice(0, 2).reduce((t, x) => t + (x || 0), 0); h += z.slice(2).reduce((t, x) => t + (x || 0), 0); }
        else if (num(a.average_heartrate)) { const lt = sportOf(a.type) === "bici" ? CONFIG.bici.sogliaFC : CONFIG.corsa.lthr; if (a.average_heartrate / lt > 0.88 || isQualityAct(a)) h += durS(a) * (isQualityAct(a) ? 0.35 : 1), e += isQualityAct(a) ? durS(a) * 0.65 : 0; else e += durS(a); }
      }
      easy.push(e / 3600); hard.push(h / 3600);
      const runs = wa.filter((a) => sportOf(a.type) === "corsa"); const rt = runs.reduce((t, a) => t + durS(a), 0);
      tm.push(rt ? runs.filter(isTreadmill).reduce((t, a) => t + durS(a), 0) / rt : null);
    }
    const imp = weeks.slice(-12).map((mon) => acts.filter((a) => sportOf(a.type) === "corsa" && inWeek(a, mon)).reduce((t, a) => t + impactOf(a), 0));
    const impChronic = imp.map((_, i) => { const p = imp.slice(Math.max(0, i - 4), i); return p.length ? mean(p) : null; });
    return { acts, weeks, vol, tss, easy, hard, tm, imp, impChronic };
  }

  // ---------------------------------------------------------- render
  function kpi(lbl, val, sub, col) { return `<div class="kpi"><span>${lbl}</span><b style="${col ? "color:" + col : ""}">${val}</b><small>${sub || ""}</small></div>`; }

  function render() {
    const now = new Date();
    const A = analyze(SRC.raw, now, SRC.diary);
    const I = A.ins, M = A.metrics, P = analisiPC(SRC.raw, A, now);
    window.__A = A; window.__P = P;
    $("#src").textContent = SRC.label;
    $("#today").textContent = `${GIORNI[now.getDay()]} ${now.getDate()} ${MESI[now.getMonth()]} ${now.getFullYear()}`;
    $("#race").textContent = A.raceDays !== null && CONFIG.obiettivo ? `${A.raceDays} giorni a ${CONFIG.obiettivo.nome}` : "";
    const fz = formZone(M.tsb), stc = { verde: "var(--good)", giallo: "var(--warn)", rosso: "var(--bad)" }[A.worst];
    const sl = A.sleep;
    $("#kpis").innerHTML = [
      kpi("Prontezza", STATE_WORD[A.worst], esc(SYS_WORD[A.sys.state] + " · tessuti " + TIS_WORD[A.tis.state].toLowerCase()), stc),
      kpi("Forma", signed(M.tsb), fz.name, fz.c),
      kpi("Fitness", it(M.ctl), "CTL", "var(--s-nuoto)"),
      kpi("Fatica", it(M.atl), "ATL", "var(--violet)"),
      kpi("Ramp rate", it(M.ramp, 1), "punti/settimana"),
      kpi("HRV", it(M.hrv), M.hrvMean ? "media " + it(M.hrvMean) : "ms"),
      kpi("FC riposo", it(M.rhr), M.rhrMean ? "media " + it(M.rhrMean) : "bpm"),
      kpi("Sonno", sl.secs ? `${Math.floor(sl.secs / 3600)}h${String(Math.round((sl.secs % 3600) / 60)).padStart(2, "0")}` : "—", sl.score ? "punteggio " + sl.score : ""),
      kpi("Passo a 145", I.durability.now ? fmtPace(I.durability.now) : "—", "/km, ultime 4 sett."),
      kpi("Impatto corsa", I.impact.ratio ? "×" + it(I.impact.ratio, 2) : "—", { ok: "nella norma", basso: "sotto la media", giallo: "alto", rosso: "troppo alto" }[I.impact.state] || ""),
    ].join("");
    $("#verdict").textContent = A.verdict;
    $("#alerts").innerHTML = [
      I.fatigue ? `<div class="alert ${I.fatigue.level}"><b>Affaticamento periferico</b>${esc(I.fatigue.text)}</div>` : "",
      I.adapt ? `<div class="alert giallo"><b>Proposta per oggi</b>${I.adapt.items.map((x) => esc(x.name + " → " + x.prop)).join("<br>")}${I.adapt.move ? "<br>" + esc(I.adapt.move) : ""}</div>` : "",
      I.confidence.level !== "alta" ? `<div class="alert info"><b>Affidabilità ${I.confidence.level}</b>${esc(I.confidence.missing.join(", "))}</div>` : "",
      I.weight.alert && I.weight.alert.level !== "ok" && I.weight.alert.level !== "info" ? `<div class="alert ${I.weight.alert.level}"><b>Carburante</b>${esc(I.weight.alert.text)}</div>` : "",
    ].join("");

    // ---- fitness
    const all = [...A.fitness.hist, ...A.fitness.proj];
    const rng = +($("#fitRange").value || 180);
    const start = Math.max(0, A.fitness.hist.length - rng);
    const F = all.slice(start);
    const tIdx = F.findIndex((f) => f.d === ymd(now));
    const hEnd = A.fitness.hist.length - start - 1;
    const histOnly = (k) => F.map((f, i) => (i <= hEnd ? f[k] : null));
    const projOnly = (k) => F.map((f, i) => (i >= hEnd ? f[k] : null));
    lineChart($("#chFit"), {
      label: "Fitness, fatica e forma", dates: F.map((f) => f.d), h: 260, todayIdx: tIdx,
      series: [
        { name: "Fitness", color: "var(--s-nuoto)", values: histOnly("ctl"), width: 2.5, area: true },
        { name: "Fitness (piano)", color: "var(--s-nuoto)", values: projOnly("ctl"), dash: "4 4" },
        { name: "Fatica", color: "var(--violet)", values: histOnly("atl"), width: 1.5 },
        { name: "Fatica (piano)", color: "var(--violet)", values: projOnly("atl"), dash: "4 4", width: 1.5 },
      ],
    });
    lineChart($("#chForm"), {
      label: "Forma", dates: F.map((f) => f.d), h: 140, todayIdx: tIdx, zero: true,
      bands: [{ from: 25, to: 99, color: "var(--zone-trans)" }, { from: 5, to: 25, color: "var(--zone-fresh)" }, { from: -10, to: 5, color: "var(--muted)" }, { from: -30, to: -10, color: "var(--good)" }, { from: -99, to: -30, color: "var(--bad)" }],
      series: [{ name: "Forma", color: "var(--ink)", values: F.map((f) => +(f.ctl - f.atl).toFixed(1)), width: 2 }],
      yFmt: (v) => (v > 0 ? "+" : "") + Math.round(v),
    });
    // traiettoria
    const T = I.trajectory;
    if (T) {
      const t0 = parseYMD(T.targets[0].data), t1 = parseYMD(T.race);
      const days = []; for (let d = new Date(t0); d <= t1; d = addDays(d, 3)) days.push(ymd(d));
      const tgt = (ds) => { const t = parseYMD(ds).getTime(); for (let i = 1; i < T.targets.length; i++) { const a = parseYMD(T.targets[i - 1].data).getTime(), b = parseYMD(T.targets[i].data).getTime(); if (t <= b) return T.targets[i - 1].ctl + (T.targets[i].ctl - T.targets[i - 1].ctl) * (t - a) / (b - a); } return T.targets[T.targets.length - 1].ctl; };
      const hmap = Object.fromEntries(all.map((f) => [f.d, f.ctl]));
      const near = (ds) => { for (let k = 0; k < 3; k++) { const x = hmap[ymd(addDays(parseYMD(ds), k))]; if (x !== undefined) return x; } return null; };
      lineChart($("#chTraj"), { label: "Traiettoria", dates: days, h: 220, todayIdx: days.findIndex((d) => d >= ymd(now)), series: [{ name: "Traiettoria", color: "var(--muted)", values: days.map(tgt), dash: "6 5" }, { name: "Fitness", color: "var(--s-nuoto)", values: days.map(near), width: 2.5 }] });
      const st2 = T.diff === null ? "—" : T.diff >= -2 ? "in linea" : `sotto di ${it(-T.diff)} punti`;
      $("#trajTxt").innerHTML = `<b>${it(T.now)} / ${it(T.target)}</b> ${st2}${T.projEnd ? ` · con il piano attuale ${it(T.projEnd.ctl)} il ${dlab(T.projEnd.d)}` : ""}`;
      $("#trajTitle").textContent = "Verso " + (T.name || "l'obiettivo");
    } else { $("#chTraj").innerHTML = '<div class="empty">Nessun obiettivo in CONFIG</div>'; }

    // ---- volume e intensità
    const wl = P.weeks.map((m) => `${m.getDate()} ${MESI_BREVI[m.getMonth()]}`);
    stackChart($("#chVol"), {
      label: "Ore settimanali per sport", labels: wl, h: 240, yFmt: (v) => it(v, 1) + " h",
      stacks: ["nuoto", "bici", "corsa", "forza"].map((sp) => ({ name: SPN[sp], color: SP[sp], values: P.vol[sp] })),
      tipTitle: (i) => "Settimana del " + wl[i], extra: (i) => `<div class="tt"><i></i>Carico<span>${it(P.tss[i])} TSS</span></div>`,
      dim: (i) => i === P.weeks.length - 1,
    });
    const share = P.easy.map((e, i) => (e + P.hard[i] ? (P.hard[i] / (e + P.hard[i])) * 100 : null));
    stackChart($("#chInt"), {
      label: "Distribuzione dell'intensità", labels: wl.slice(-12), h: 240, yFmt: (v) => it(v, 1) + " h",
      stacks: [{ name: "Facile", color: "var(--s-nuoto)", values: P.easy.slice(-12) }, { name: "Intenso", color: "var(--s-bici)", values: P.hard.slice(-12) }],
      extra: (i) => `<div class="tt"><i></i>Quota intensa<span>${it(share.slice(-12)[i])}%</span></div>`,
    });
    const s12 = share.slice(-12).filter((x) => x !== null);
    $("#intTxt").innerHTML = s12.length ? `Ultime 12 settimane: <b>${it(100 - mean(s12))}% facile · ${it(mean(s12))}% intenso</b> (obiettivo circa 80/20)` : "";

    // ---- recupero
    const W90 = (SRC.raw.wellness || []).filter((w) => w && w.id && daysBetween(parseYMD(w.id), now) <= 90).sort((a, b) => a.id.localeCompare(b.id));
    const roll = (arr) => arr.map((_, i) => { const p = arr.slice(Math.max(0, i - 6), i + 1).filter((x) => x !== null); return p.length >= 3 ? mean(p) : null; });
    const hv = W90.map((w) => num(w.hrv) ?? num(w.hrvSDNN)), rh = W90.map((w) => num(w.restingHR));
    const hvOk = hv.filter((x) => x !== null), hvM = hvOk.length ? mean(hvOk) : 0, hvS = hvOk.length ? sd(hvOk) : 0;
    lineChart($("#chHrv"), { label: "HRV", dates: W90.map((w) => w.id), h: 200, bands: [{ from: hvM - hvS, to: hvM + hvS, color: "var(--good)", op: 0.1 }], series: [{ name: "HRV", color: "var(--good)", values: hv, width: 1.2, dots: true }, { name: "Media 7 giorni", color: "var(--ink)", values: roll(hv), width: 2 }] });
    lineChart($("#chRhr"), { label: "FC a riposo", dates: W90.map((w) => w.id), h: 200, series: [{ name: "FC riposo", color: "var(--s-bici)", values: rh, width: 1.2, dots: true }, { name: "Media 7 giorni", color: "var(--ink)", values: roll(rh), width: 2 }] });
    const W60 = W90.slice(-60);
    stackChart($("#chSleep"), { label: "Sonno", labels: W60.map((w) => dlab(w.id)), h: 200, yFmt: (v) => it(v, 1) + " h", stacks: [{ name: "Ore di sonno", color: "var(--violet)", values: W60.map((w) => (num(w.sleepSecs) || 0) / 3600) }], refs: [{ y: CONFIG.soglie.sonnoOreGiallo, label: `${CONFIG.soglie.sonnoOreGiallo} h` }], extra: (i) => `<div class="tt"><i></i>Punteggio<span>${it(num(W60[i].sleepScore))}</span></div>` });

    // ---- corsa: durabilità e impatto
    const D = I.durability;
    const outd = D.pts.filter((p) => !p.tm);
    const rl = outd.map((p) => { const t = parseYMD(p.d).getTime(); return { d: p.d, v: MED(outd.filter((q) => Math.abs(parseYMD(q.d).getTime() - t) <= 14 * 86400000).map((q) => q.p)) }; });
    scatterChart($("#chDur"), { label: "Passo a 145 bpm", h: 240, invert: true, yFmt: (v) => fmtPace(v), lineColor: "var(--s-corsa)", line: rl, pts: D.pts.map((p) => ({ d: p.d, v: p.p, c: p.tm ? "var(--muted)" : "var(--s-corsa)", r: p.tm ? 3 : 4.5, tip: `<b>${dlab(p.d)}</b><div>${fmtPace(p.p)}/km a 145 bpm</div><div>${p.tm ? "tapis" : "all'aperto"}</div>` })) });
    const delta = D.now && D.old ? D.now - D.old : null;
    $("#durTxt").innerHTML = `Ultime 4 settimane: <b>${D.now ? fmtPace(D.now) + "/km" : "—"}</b>${delta !== null ? ` · ${Math.abs(delta) < 3 ? "stabile" : delta < 0 ? Math.round(-delta) + '"/km più veloce' : Math.round(delta) + '"/km più lento'} rispetto a 3–5 mesi fa` : ""}`;
    stackChart($("#chImp"), { label: "Impatto della corsa", labels: wl.slice(-12), h: 240, yFmt: (v) => it(v), stacks: [{ name: "Impatto", color: "var(--s-corsa)", values: P.imp }], line: { color: "var(--ink)", values: P.impChronic }, extra: (i) => `<div class="tt"><i></i>Media 4 sett. prima<span>${it(P.impChronic[i])}</span></div><div class="tt"><i></i>Rapporto<span>${P.impChronic[i] ? "×" + it(P.imp[i] / P.impChronic[i], 2) : "—"}</span></div><div class="tt"><i></i>Tapis<span>${P.tm.slice(-12)[i] === null ? "—" : Math.round(P.tm.slice(-12)[i] * 100) + "%"}</span></div>`, dim: (i) => i === 11 });

    // ---- predittori
    const PR = I.predictors;
    $("#predList").innerHTML = PR.all.map((p) => `<div class="pr"><span>${esc(p.lbl)}</span><div class="pb"><div class="pz"></div>${p.r === null ? "" : `<div class="pv" style="left:${p.r < 0 ? 50 + p.r * 50 : 50}%;width:${Math.abs(p.r) * 50}%;background:${p.r > 0 ? "var(--good)" : "var(--s-nuoto)"}"></div>`}</div><b>${p.r === null ? `${p.n}/12` : (p.r > 0 ? "+" : "") + it(p.r, 2)}</b></div>`).join("") + `<div class="note">r di Pearson tra il segnale del mattino e il passo a parità di battiti (più = corsa migliore della tua norma) · ${PR.nRuns} corse all'aperto</div>`;
    const top = PR.list[0];
    if (top) {
      const pp = PR.pairs.filter((p) => p[top.k] !== null && p[top.k] !== undefined);
      scatterChart($("#chPred"), { label: top.lbl, h: 240, xNum: true, xFmt: (v) => it(v, 0), yFmt: (v) => (v > 0 ? "+" : "") + it(v, 0) + "%", pts: pp.map((p) => ({ x: p[top.k], v: p.out, c: "var(--s-nuoto)", tip: `<b>${dlab(p.d)}</b><div>${esc(top.lbl)}: ${it(p[top.k], 1)}</div><div>Corsa ${p.out > 0 ? "+" : ""}${it(p.out, 1)}% rispetto alla tua norma</div>` })) });
      $("#predTitle").textContent = top.lbl + " → esito della corsa";
    } else $("#chPred").innerHTML = '<div class="empty">Nessun segnale abbastanza forte per ora</div>';

    // ---- peso
    const Wt = I.weight;
    if (Wt && Wt.series.length > 2) lineChart($("#chWeight"), { label: "Peso", dates: Wt.series.map((x) => x.d), h: 200, refs: Wt.target ? [{ y: Wt.target, label: "obiettivo " + it(Wt.target) + " kg" }] : [], series: [{ name: "Peso", color: "var(--violet)", values: Wt.series.map((x) => x.v), width: 2, dec: 1 }], yFmt: (v) => it(v, 1) });
    else $("#chWeight").innerHTML = '<div class="empty">Nessun peso registrato</div>';
    $("#weightTxt").textContent = Wt && Wt.alert ? Wt.alert.text : "";

    // ---- settimana e sedute
    const W = A.weeks[0];
    $("#weekTbl").innerHTML = W.days.map((Dd) => `<tr class="${Dd.isToday ? "today" : ""}"><td>${GIORNI[Dd.date.getDay()].slice(0, 3)} ${Dd.date.getDate()}</td><td>${Dd.evs.map((e) => `<span class="sp" style="--c:${SP[e.sport] || SP.altro}">${esc(e.name)} · ${fmtMin(e.min)}</span>`).join(" ") || (Dd.gym ? `<span class="sp" style="--c:${SP.forza}">Palestra · ${esc(Dd.gym)}</span>` : '<span class="muted">riposo</span>')}</td><td>${Dd.evs.map((e) => (e.exec ? `<b style="color:${e.exec.score >= 85 ? "var(--good)" : e.exec.score >= 65 ? "var(--warn)" : "var(--bad)"}">${e.exec.score}</b>${e.exec.flags.length ? ` <span class="muted">${esc(e.exec.flags.join("; "))}</span>` : ""}` : Dd.isPast ? '<span class="muted">non svolto</span>' : "")).join("<br>")}</td></tr>`).join("");
    const R = I.review;
    $("#reviewTxt").innerHTML = `<b>${R.doneN}/${R.total}</b> sedute · ${fmtMin(R.doneMin)} di ${fmtMin(R.plannedMin)} · ${R.loadDone} TSS · ${esc(R.proposal)}`;

    const rows = P.acts.slice().reverse().slice(0, 60);
    $("#actTbl").innerHTML = rows.map((a) => {
      const sp = sportOf(a.type), p = sp === "corsa" ? pace145(a) : null, km = num(a.distance) ? a.distance / 1000 : null;
      const q = sp === "corsa" && isQualityAct(a), lt = CONFIG.corsa.lthr;
      const flags = [q && num(a.max_heartrate) && a.max_heartrate < 0.97 * lt ? "FC sotto soglia" : null, q && p && D.base && p > D.base * 1.03 ? "passo peggiore" : null, q && isTreadmill(a) ? "qualità su tapis" : null].filter(Boolean);
      return `<tr><td>${dlab(a.start_date_local.slice(0, 10))}</td><td><span class="dot" style="background:${SP[sp] || SP.altro}"></span>${SPN[sp] || a.type}${isTreadmill(a) ? " · tapis" : ""}</td><td>${esc(a.name || "")}</td><td class="n">${fmtMin(Math.round(durS(a) / 60))}</td><td class="n">${km ? it(km, sp === "nuoto" ? 2 : 1) : "—"}</td><td class="n">${it(num(a.icu_training_load))}</td><td class="n">${it(num(a.average_heartrate))}</td><td class="n">${p ? fmtPace(p) : "—"}</td><td class="n">${num(a.decoupling) !== null ? it(a.decoupling, 1) + "%" : "—"}</td><td>${flags.map((f) => `<span class="flag">${f}</span>`).join(" ")}</td></tr>`;
    }).join("");
  }

  // ---------------------------------------------------------- avvio e interazioni
  function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  async function avvia(modo) {
    $("#msg").textContent = "Caricamento…";
    try {
      if (modo === "live") SRC = await caricaLive();
      else if (modo === "demo") SRC = demo();
      $("#msg").textContent = "";
      st("hud_modo", modo); render();
    } catch (e) {
      $("#msg").innerHTML = `Non riesco a leggere Intervals da qui (${esc(e.message)}). Usa <b>Carica file</b> con <i>hud-dati.json</i> da iCloud Drive › Scriptable, oppure la demo.`;
      if (!SRC) { SRC = demo(); render(); }
    }
  }
  $("#btnDemo").addEventListener("click", () => avvia("demo"));
  $("#btnLive").addEventListener("click", () => { if (!st("hud_key")) { $("#keyDlg").showModal(); return; } avvia("live"); });
  $("#btnKey").addEventListener("click", () => $("#keyDlg").showModal());
  $("#keySave").addEventListener("click", (e) => { e.preventDefault(); const v = $("#keyIn").value.trim(); if (v) st("hud_key", v); $("#keyDlg").close(); avvia("live"); });
  $("#keyDel").addEventListener("click", (e) => { e.preventDefault(); st("hud_key", null); $("#keyIn").value = ""; $("#keyDlg").close(); });
  const leggiFile = (f) => { const r = new FileReader(); r.onload = () => { try { SRC = daFile(JSON.parse(r.result)); st("hud_modo", "file"); st("hud_file", r.result); $("#msg").textContent = ""; render(); } catch (e) { $("#msg").textContent = "File non valido: " + e.message; } }; r.readAsText(f); };
  $("#fileIn").addEventListener("change", (e) => e.target.files[0] && leggiFile(e.target.files[0]));
  $("#btnFile").addEventListener("click", () => $("#fileIn").click());
  document.addEventListener("dragover", (e) => { e.preventDefault(); document.body.classList.add("drag"); });
  document.addEventListener("dragleave", (e) => { if (e.target === document.documentElement || e.clientX <= 0) document.body.classList.remove("drag"); });
  document.addEventListener("drop", (e) => { e.preventDefault(); document.body.classList.remove("drag"); const f = e.dataTransfer.files[0]; if (f) leggiFile(f); });
  $("#fitRange").addEventListener("change", render);
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => SRC && render(), 150); });
  $$("nav a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById(a.getAttribute("href").slice(1)).scrollIntoView({ behavior: "smooth", block: "start" }); }));
  const salvato = st("hud_modo") === "file" && st("hud_file");
  if (salvato) { try { SRC = daFile(JSON.parse(salvato)); render(); } catch (e) { avvia("demo"); } }
  else avvia(st("hud_modo") === "live" && st("hud_key") ? "live" : "demo");
})();
