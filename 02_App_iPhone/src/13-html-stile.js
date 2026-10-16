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

