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

