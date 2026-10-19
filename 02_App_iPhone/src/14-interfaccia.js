// ------------------------------------------------------------
//  Blocchi UI v3
// ------------------------------------------------------------
const LV = { ok: "#30D158", verde: "#30D158", giallo: "#FF9F0A", rosso: "#FF453A", info: "#64D2FF", basso: "#64D2FF" };
const WARN_ICO = (c) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5h.01"/></svg>`;
const scoreCol = (s) => (s >= 85 ? "#30D158" : s >= 65 ? "#FF9F0A" : "#FF453A");

// Vista Essenziale (per tutti) e Completa (solo chi ha vista: "completa" nel profilo): xc = si vede solo in Completa
const xc = (h) => (h ? String(h).replace(/^(\s*<[a-z0-9]+ class=")/, "$1xc ") : "");
const xcB = (h) => (h && String(h).trim() ? `<div class="xc xblk">${h}</div>` : ""); // più elementi insieme (titolo e card)
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
function mangiatoCard(N, A) {
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
    ${A ? (() => { const W = acquaDi(A), l = (ml) => fmtIt(ml / 1000, 1); return `<div><div class="hstack" style="justify-content:space-between"><span class="t15">Acqua</span><span class="t15"><span class="semi" id="acq-v">${l(W.ml)}</span><span class="muted"> / ${l(W.obiettivo)} l</span></span></div><div class="pbar" style="height:6px;margin-top:6px"><div id="acq-b" style="width:${Math.min(100, (W.ml / Math.max(1, W.obiettivo)) * 100).toFixed(0)}%;background:#64D2FF"></div></div>
    <div class="hstack" style="gap:8px;margin-top:8px;align-items:center"><button class="acqb" type="button" data-acq="-250" aria-label="Togli un bicchiere">−</button><button class="acqb piu" type="button" data-acq="250">+ un bicchiere</button><span class="t13 muted grow" style="text-align:right">${W.min ? `${l(W.base)} l più ${l(W.obiettivo - W.base)} per l'allenamento` : "un bicchiere è 250 ml"}</span></div></div>`; })() : ""}
    <div class="t13 muted">${T.kcal ? (resto >= 0 ? `Ti restano ${fmtIt(resto)} kcal e ${fmtIt(Math.max(0, PN.C - T.C))} g di carboidrati.` : `Sei ${fmtIt(-resto)} kcal sopra l'obiettivo di oggi.`) : "Ancora niente: dillo a Siri («Ho mangiato») o scrivilo qui sotto."}</div>
    ${righe ? `<div>${righe}</div>` : ""}
    <div class="hstack" style="gap:10px;align-items:center;border-top:.5px solid var(--sep);padding-top:12px">
      <input id="ciboin" type="text" placeholder="Es. 180 g di pasta, o il codice a barre" style="flex:1;min-width:0;font:inherit;font-size:16px;color:var(--fg);background:var(--fill);border:0;border-radius:10px;padding:9px 10px">
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
// Curva dei migliori: durata (o distanza) in scala logaritmica, 12 settimane in arancio sopra l'ultimo anno in blu
const CURVA_COL = { ora: "#C2410C", anno: "#0A84FF" };
function curvaGrafico(a, b, o) {
  const Wd = 326, Hh = 140, xs = a.map((p) => p[0]), vs = a.concat(b).map((p) => o.y(p[1]));
  const lx0 = Math.log(Math.min(...xs)), lx1 = Math.log(Math.max(...xs)) || lx0 + 1;
  let lo = Math.min(...vs), hi = Math.max(...vs); const pd = (hi - lo) * 0.12 || 1; lo -= pd; hi += pd;
  const X = (x) => 6 + ((Math.log(x) - lx0) / Math.max(1e-6, lx1 - lx0)) * (Wd - 50), Y = (v) => 8 + ((hi - v) / (hi - lo)) * (Hh - 22);
  const linea = (P, c) => P.length >= 2 ? `<path d="${P.filter((p) => p[0] >= Math.exp(lx0) && p[0] <= Math.exp(lx1)).map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(o.y(p[1])).toFixed(1)).join(" ")}" fill="none" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>` : "";
  const yt = [hi - pd, lo + pd].map((v) => `<text x="${Wd - 40}" y="${(Y(v) + 4).toFixed(1)}" fill="#8E8E93" font-size="10">${esc(o.fmtY(v))}</text>`).join("");
  const anno = new Map(b.map((p) => [p[0], p[1]]));
  const tip = a.map((p) => [X(p[0]) / Wd, Y(o.y(p[1])) / Hh, o.fmtX(p[0]), `${o.fmt(p[1])}${anno.has(p[0]) ? ` · anno ${o.fmt(anno.get(p[0]))}` : ""}`, CURVA_COL.ora]);
  const tick = o.ticks.filter((t) => t[0] >= Math.exp(lx0) * 0.99 && t[0] <= Math.exp(lx1) * 1.01);
  return `${scrub(`<svg width="100%" height="${Hh}" viewBox="0 0 ${Wd} ${Hh}" preserveAspectRatio="none">${yt}${linea(b, CURVA_COL.anno)}${linea(a, CURVA_COL.ora)}</svg>`, tip)}
    <div class="cxs">${tick.map((t) => `<span style="left:${((X(t[0]) / Wd) * 100).toFixed(1)}%">${esc(t[1])}</span>`).join("")}</div>`;
}
function curveCard(C) {
  if (!C || (!C.potenza && !C.passo)) return "";
  const durata = (s) => (s < 60 ? `${s}"` : s < 3600 ? `${Math.round(s / 60)}'` : `${fmtIt(s / 3600, s % 3600 ? 1 : 0)}h`);
  const dist = (m) => (m === 1609 ? "1 miglio" : m < 1000 ? `${m} m` : `${fmtIt(m / 1000, m % 1000 ? 1 : 0)} km`);
  const leg = `<div class="legend"><span><i style="background:${CURVA_COL.ora}"></i>Ultime 12 settimane</span><span><i style="background:${CURVA_COL.anno}"></i>Ultimo anno</span></div>`;
  const sez = [];
  const P = C.potenza;
  if (P) sez.push(`<div class="card pad" style="gap:8px"><div><div class="t17 semi">Potenza in bici</div><div class="t13 muted">${P.cp ? `potenza critica ${P.cp} W${P.wp ? ` · W′ ${fmtIt(P.wp / 1000, 1)} kJ` : ""}` : ""}</div></div>
    ${curvaGrafico(P.p84, P.p1y || [], { y: (w) => w, fmt: (w) => `${w} W`, fmtY: (v) => `${Math.round(v)} W`, fmtX: durata, ticks: [[5, "5\""], [60, "1'"], [300, "5'"], [1200, "20'"], [3600, "1h"], [7200, "2h"]] })}${leg}</div>`);
  const R = C.passo;
  if (R) sez.push(`<div class="card pad" style="gap:8px"><div><div class="t17 semi">Passo in corsa</div><div class="t13 muted">${R.cs ? `velocità critica ${fmtPace(1000 / R.cs)}/km${R.dp ? ` · D′ ${R.dp} m` : ""}` : ""}</div></div>
    ${curvaGrafico(R.p84, R.p1y || [], { y: (s) => -s, fmt: (s) => `${fmtPace(s)}`, fmtY: (v) => `${fmtPace(-v)}`, fmtX: dist, ticks: [[400, "400 m"], [1000, "1 km"], [5000, "5 km"], [10000, "10 km"], [21097, "21 km"], [42195, "42 km"]] })}${leg}
    <div class="t13 muted">Il tempo totale su ogni distanza: più in alto è più veloce.</div></div>`);
  return `<h2 class="ih">Curva dei migliori<button class="info" data-info="curve" aria-label="Cosa significa">i</button></h2>${sez.join("")}`;
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
    <div class="t13 muted" style="line-height:1.4">Tutta la nuotata, recuperi compresi: conta come si muove nel tempo. La linea tratteggiata è il tuo CSS.</div>
    ${n.swolf && n.swolf.pts.length ? `<div style="height:14px"></div>${progTesta("SWOLF · secondi + bracciate per vasca", Math.round(n.swolf.ora ?? ult(n.swolf.pts)), "", n.swolf.diff, { meglioBasso: true, soglia: 1, dt: (d) => `${Math.round(Math.abs(d))} punti ${d < 0 ? "in meno" : "in più"} di due mesi fa` })}
    ${progGrafico(n.swolf.pts, { c: "#64D2FF", meglioBasso: true, h: 90, fmt: (v) => String(Math.round(v)), tip: (p) => `SWOLF ${p.v} · ${fmtIt(p.bv, 1)} bracciate`, lbl: (p) => `${dGiorno(p.d)} · vasca ${p.L} m` })}
    <div class="t13 muted" style="line-height:1.4">Se scende a parità di passo, nuoti più lungo con meno bracciate: è la tecnica che migliora. Si confronta solo nella stessa vasca.</div>` : ""}`;
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
function detStats(cells) { return `<div class="dstats">${cells.filter((c) => c && c[1] !== null && c[1] !== undefined && c[1] !== "").map((c) => `<div${c[0] === "Carico" ? ' class="xc"' : ""}><div class="label">${c[0]}</div><div class="num20">${c[1]}</div></div>`).join("")}</div>`; }
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
    ${hint ? `<div class="t13 muted">${esc(hint)}</div>` : ""}
    ${zofflineHTML(e)}`;
}
// Bici al chiuso con zoffline (solo se il profilo ha "zoffline"): la seduta del giorno arriva in Zwift da Intervals
const alChiusoEv = (e) => e.trainer === true || /virtual/i.test(e.type || "") || /indoor|rulli|zwift|spinning|cyclette/i.test(e.name || "");
function zofflineHTML(e) {
  if (!PROF || PROF.zoffline === undefined || e.sport !== "bici" || !alChiusoEv(e) || e.done) return "";
  const ind = String(PROF.zoffline || "").trim();
  return `<h3>In Zwift con zoffline</h3>
    <div class="icard"><span>Con zoffline acceso sul Mac e collegato a Intervals, il giorno della seduta la trovi in Zwift tra gli allenamenti personali; a fine giro l'attività torna su Intervals abbinata a questa seduta. Se quel giorno hai più sedute, zoffline prende la prima ancora da fare.</span></div>
    <button class="secondary" type="button" data-act="zoffline:apri">${ind ? `Apri zoffline sul Mac (${esc(ind)})` : "Apri zoffline sul Mac"}</button>
    <div class="t13 muted">Si apre la pagina di zoffline per Intervals. La prima volta Safari avvisa che il certificato non è verificato: è quello di zoffline, che lavora solo nella rete di casa.</div>`;
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
    <button class="lrow rowlink" type="button" data-act="feedback:impostazioni"><span>${CONFIG.feedbackEmail ? "Invia un commento a chi ti ha dato l'app" : "Invia un commento"}</span><span class="chev2">›</span></button>
    <div class="sep l16"></div>
    ${CONFIG.repository ? `<button class="lrow rowlink" type="button" data-act="segnala:impostazioni"><span>Segnala un problema su GitHub</span><span class="chev2">›</span></button>
    <div class="sep l16"></div>` : ""}
    ${A.tempi ? (DETS.set("diagnostica", diagnosticaHTML(A.tempi)), `<button class="lrow rowlink" type="button" data-det="diagnostica" data-dt="Diagnostica"><span>Diagnostica · tempi di apertura</span><span class="chev2">›</span></button>
    <div class="sep l16"></div>`) : ""}
    <div class="lrow"><span class="muted">Versione</span><span class="muted">${esc(VERSIONE)}</span></div>
  </div>`}
  ${!first && P.zoffline !== undefined ? `<div class="card list"><button class="lrow rowlink" type="button" data-act="zoffline:indirizzo"><span>zoffline sul Mac</span><span class="muted">${esc(String(P.zoffline || "") || "da impostare")} ›</span></button></div>` : ""}
  ${!first && P.vista ? `<h2>Vista dell'app</h2>
  <div class="card pad form">
    ${segB("f-vista", "seg2", [["essenziale", "Essenziale"], ["completa", "Completa"]], P.vista === "completa" ? "completa" : "essenziale")}
    <p class="t13 muted" style="margin:0">Solo sul tuo profilo. Essenziale è quella che vedono tutti; Completa aggiunge carico, fitness e fatica, soglie, revisione della settimana e tutti i dati delle attività.</p>
  </div>` : ""}
  </div>`;
}

// ---- Diagnostica: quanto ci mette ogni fase dell'apertura (ultime aperture), per capire dove l'app è lenta
function diagnosticaHTML(T) {
  const durate = (f) => f.map((x, i) => [x[0], x[1] - (i ? f[i - 1][1] : 0)]);
  const ora = durate(T.ora || []), tot = (T.ora || []).length ? T.ora[T.ora.length - 1][1] : 0;
  const app = (T.storico || []).filter((x) => x.dove === "app").slice(-10).reverse();
  const MED = (v) => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const fasi = ["profilo", "dati", "analisi", "pagina", "mostrata"];
  const med = fasi.map((f) => [f, MED(app.map((x) => { const d = durate(x.fasi).find((y) => y[0] === f); return d ? d[1] : null; }).filter((v) => v !== null))]);
  const NOMI = { profilo: "Profilo", dati: "Dati da Intervals", analisi: "Calcoli", pagina: "Costruzione della pagina", mostrata: "Pagina sullo schermo", widget: "Widget" };
  const riga = (a, b) => `<div class="lrow"><span>${esc(NOMI[a] || a)}</span><span class="num20" style="white-space:nowrap">${b === null || b === undefined ? "—" : fmtIt(b) + '<span class="unit"> ms</span>'}</span></div>`;
  return `<h3>Questa apertura</h3><p class="t15 muted" style="margin:0 0 10px">Il tempo di ogni fase. Se l'app ti sembra lenta, manda un commento: i tempi sono allegati da soli.</p>
  <div class="card list">${ora.map((x, i) => (i ? '<div class="sep l16"></div>' : "") + riga(x[0], x[1])).join("")}${ora.length ? '<div class="sep l16"></div>' : ""}${riga("Totale", tot)}</div>
  ${app.length ? `<h3>${app.length === 1 ? "L'apertura precedente" : `Mediana delle ultime ${app.length} aperture`}</h3><div class="card list">${med.map((x, i) => (i ? '<div class="sep l16"></div>' : "") + riga(x[0], x[1])).join("")}</div>` : ""}`;
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
    <button class="primary" type="button" data-act="plan:prossimo">Prepara il prossimo blocco</button>${dove === "sett" ? `
    <button class="secondary" type="button" data-riscrivi>Riscrivi il piano</button>` : ""}` : `<div class="t15 muted">Le sedute sono nel tuo calendario. Se cambiano impegni o sensazioni, riscrivilo quando vuoi: le sedute fatte e quelle di oggi restano.</div>
    <button class="secondary" type="button" data-riscrivi>Riscrivi il piano</button>`}
  </div>`;
}

// Le date del foglio «Riscrivi il piano»: domani e il lunedì dopo oggi (se domani è lunedì coincidono)
function riscriviInfo(A) {
  const P = A.prof;
  if (!P || P.pianoApp === false || A.demo || !P.piano) return null;
  const d = new Date(A.now.getFullYear(), A.now.getMonth(), A.now.getDate()), dom = addDays(d, 1), lun = addDays(d, (8 - d.getDay()) % 7 || 7);
  const nome = (x) => `${GIORNI[x.getDay()].toLowerCase()} ${x.getDate()} ${MESI[x.getMonth()]}`;
  return { dom: nome(dom), lun: nome(lun), stesso: dom.getDay() === 1 };
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
    <div class="hstack" style="align-items:baseline;gap:12px;flex-wrap:wrap;padding-right:30px">${rd !== null ? `<span class="bignum xc">${rd}</span>` : ""}<span class="stw ${A.worst}">${STATE_WORD[A.worst]}.</span></div>
    ${rd !== null ? `<div class="meter xc" aria-label="Prontezza ${rd} su 100"><div style="width:${Math.max(2, Math.min(100, rd))}%"></div></div>` : ""}
    <div class="verdict">${esc(A.verdict)}</div>
    ${I.confidence.level !== "alta" ? `<div class="conf">Affidabilità ${I.confidence.level}: ${esc(I.confidence.missing.join(", "))}. Orologio non indossato o sincronizzazione in corso?</div>` : ""}
    ${I.adapt && !I.adapt.accepted ? `<button class="linkrow" data-goto="sett" data-sub="pi-sett">Vedi la proposta per oggi ›</button>` : ""}
    ${sedutaOggi}
  </div>
  ${pianoCard(A, "oggi")}
  ${I.fatigue ? banner(I.fatigue.level, "Affaticamento periferico", I.fatigue.text) : ""}
  ${A.soglieOggi && A.soglieOggi.length ? xc(banner("ok", "Soglie aggiornate su Intervals", `${A.soglieOggi.join(", ").replace(/^./, (c) => c.toUpperCase())}. Zone e obiettivi delle sedute usano i nuovi valori.`)) : ""}
  ${xc(checksRow(A))}
  <div class="card mstrip xc">
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
        const meta = [e.min ? fmtMin(e.min) : null, num(e.distance) ? fmtDist(e.distance, e.sport) : null, carbo].filter(Boolean).join(" · ");
        const tss = e.load ? `<span class="xc"> · ${Math.round(e.load)} TSS</span>` : "";
        const ex = e.exec;
        const status = ex ? `<span class="spill" style="color:${scoreCol(ex.score)};background:${scoreCol(ex.score)}22">${ex.flags.length ? "!" : "✓"} ${ex.score}</span>` : D.isPast ? `<span class="badge miss">non svolto</span>` : "";
        return `<button class="ev evrow" data-det="${regEv(e)}">
            <span class="evbar" style="background:${s.c}"></span>
            <div class="grow"><div class="t15 semi">${esc(e.name || s.label)}</div><div class="sub">${esc(meta || s.label)}${tss}</div></div>
            ${status}${CHEV}
          </button>`;
      }).join("");
      const extra = D.extra.map((a) => `<button class="ev evrow" data-det="${regAct(a)}"><div class="summary" style="padding:0;flex:1"><span class="evbar" style="background:${(SPORT[sportOf(a.type)] || SPORT.altro).c}"></span><div class="grow"><div class="t15">${esc(a.name || (SPORT[sportOf(a.type)] || SPORT.altro).label)}</div><div class="sub">Fuori piano · ${fmtMin(Math.round((num(a.moving_time) || 0) / 60))}</div></div><span class="badge ok">${CHECK}</span>${CHEV}</div></button>`).join("");
      const gym = D.gym ? `<div class="ev"><div class="summary"><span class="evbar" style="background:${SPORT.forza.c}"></span><div class="grow"><div class="t15">Palestra</div><div class="sub">Pausa pranzo · ${esc(D.gym)}</div></div></div></div>` : "";
      const empty = !D.evs.length && !D.extra.length && !D.gym ? `<div class="ev"><div class="summary"><div class="grow sub" style="padding-left:14px">Riposo</div></div></div>` : "";
      return `<div class="day${D.isPast ? " past" : ""}">${head}<div class="card list">${items}${extra}${gym}${empty}</div></div>`;
    }).join("");
    const lc = idx === 0 && A.ladderCheck ? `<div class="note xc" style="color:${A.ladderCheck.ok ? COL.verde : COL.giallo}">${A.ladderCheck.ok ? "✓" : "!"} ${esc(A.ladderCheck.text)}</div>` : "";
    return `<div class="wk${idx === 0 ? " on" : ""}" id="wk${idx}">
      ${idx === 0 ? adaptCard(I.adapt) : ""}
      <div class="card pad">
        <div class="hstack" style="justify-content:space-between;align-items:baseline">
          <div class="t15 muted">${range}</div>
          <div class="t15 muted">${W.n} sedute<span class="xc"> · ${Math.round(W.loadPlanned)} TSS</span></div>
        </div>
        <div class="hstack" style="align-items:baseline;gap:6px"><div class="num34">${fmtDur(idx === 0 ? W.doneSec : W.plannedSec)}</div><div class="t15 muted">${idx === 0 ? `di ${fmtDur(W.plannedSec)} pianificate` : "pianificate"}</div></div>
        <div class="tbar">${totalBar}</div>
        <div class="grid${spW.length}">${spW.map((s) => `<div class="hstack" style="gap:6px"><span class="dot" style="background:${SPORT[s].c}"></span><span class="t13">${SPORT[s].label} ${fmtDur(W.per[s].planned)}</span></div>`).join("")}</div>
      </div>
      ${xc(tramaCard(W))}
      ${lc}
      ${idx === 0 ? (() => { const [mk, mw] = mobDelGiorno(A), R = MOB[mk]; return `<button class="card rowbtn" data-mob="${mk}" style="gap:12px">${`<span class="rico" style="background:#5E5CE6"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="1.8"/><path d="M5 9l7 1.5L19 9M12 10.5V15l-3.5 6M12 15l3.5 6"/></svg></span>`}<div class="grow"><div class="t17 semi">Mobilità · ${esc(R[0].toLowerCase())}</div><div class="t13 muted">${mobMin(R)}' · ${esc(mw)}</div></div><span class="t15 semi acc">Inizia</span></button>`; })() : ""}
      <h2 class="ih">Giorno per giorno<button class="info" data-info="giorni" aria-label="Cosa significa">i</button></h2>
      ${days}
      ${idx === 0 ? (DETS.set("mrev", impactCard(I.impact) + reviewCard(I.review)), `<button class="card rowbtn xc" data-det="mrev" data-dt="La settimana" style="gap:12px"><span class="rico" style="background:#BF5AF2"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"><path d="M5 19V11M10 19V6M15 19v-5M20 19V9"/></svg></span><div class="grow"><div class="t17 semi">${I.review.final ? "Revisione della settimana" : "Riepilogo e revisione"}</div><div class="t13 muted">carico, impatto della corsa, settimana prossima</div></div>${CHEV}</button>`) : ""}
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
    <div class="t13 muted xc" style="line-height:1.45">${fmtIt(PN.base)} di base + ${fmtIt(PN.esercizio)} di allenamento${PN.deficit ? ` − ${fmtIt(PN.deficit)} di deficit` : ""}${PN.surplus ? ` + ${fmtIt(PN.surplus)} di carico` : ""}</div>
    <div class="tbar" style="height:10px">
      <div style="flex:${kc.c} 1 0;background:#FF9F0A"></div><div style="flex:${kc.p} 1 0;background:#64D2FF"></div><div style="flex:${kc.g} 1 0;background:#BF5AF2"></div>
    </div>
    <div class="grid3">${[["Carboidrati", N.carbo, "#FF9F0A"], ["Proteine", N.proteine, "#64D2FF"], ["Grassi", N.grassi, "#BF5AF2"]].map(([l, g, c]) => `<div><div class="hstack" style="gap:6px"><span class="dot" style="background:${c}"></span><span class="label">${l}</span></div><div class="num20">${g}<span class="unit"> g</span></div></div>`).join("")}</div>
    <div class="t13 muted xc" style="line-height:1.4">Carboidrati ${fmtIt(PN.gkg, 1)} g per kg${PN.durante ? `, di cui ${PN.durante} g durante le sedute` : ""}. Proteine ${fmtIt(PN.P / PN.peso, 1)} g/kg, grassi ${fmtIt(PN.G / PN.peso, 1)} g/kg.</div>
    ${PN.motivi.length ? `<div class="vstack" style="gap:6px">${PN.motivi.map((m) => `<div class="t13" style="color:var(--warn)">${esc(m)}</div>`).join("")}</div>` : ""}
    <div class="vstack xc" style="gap:8px;border-top:.5px solid var(--sep);padding-top:12px">${sessLine}</div>
    <div class="t13 muted">${esc(FASE_TXT)}</div>
  </div>
  ${mangiatoCard(N, A)}
  ${lungoCard(N.rif)}
  ${(DETS.set("mpasti", `<div class="card list">${N.meals.map(([k, t], i) => `${i ? '<div class="sep l16"></div>' : ""}<div class="lrow" style="align-items:flex-start"><div class="mk" style="padding-top:2px">${esc(k)}</div><div class="mt grow">${esc(t)}</div></div>`).join("")}</div><div class="t13 muted" style="line-height:1.4">Pasta, riso e cereali pesati a crudo. Sono indicazioni generali: se hai un nutrizionista, vale il suo piano.</div>${N.chips.length ? `<h3>Da ricordare</h3><div class="chips">${N.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>` : ""}`), "")}
  ${N.rif && rifornimentoCard(N.rif) ? (DETS.set("mrif", rifornimentoCard(N.rif)), "") : ""}
  ${N.modo === "auto" && N.consumi && N.consumi.length ? (DETS.set("mbruci", `<div class="card list">${N.consumi.filter((c) => (CONFIG.sport.includes(c.sport) || (c.sport === "forza" && PROF && PROF.palestra) || c.fonte !== "stima") && (c.fonte !== "stima" || c.classe === "facile")).map((c, i) => `${i ? '<div class="sep l16"></div>' : ""}<div class="lrow"><div><div>${esc((SPORT[c.sport] || SPORT.altro).label)} ${c.sport === "forza" ? "" : CLASSI[c.classe]}</div><div class="sub">${c.fonte === "tue" ? `dalle tue ${c.n} sedute` : c.fonte === "sport" ? `dalle tue sedute di ${esc((SPORT[c.sport] || SPORT.altro).label.toLowerCase())}` : "stima dal peso, finché non ci sono tue sedute"}</div></div><div><span class="num20">${fmtIt(c.kpm, 1)}</span><span class="unit"> kcal/min</span></div></div>`).join("")}</div>`), "") : ""}
  <div class="card list">
    <button class="lrow rowb" data-det="mpasti" data-dt="Pasti di oggi"><span class="rico" style="background:#FF9F0A"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-2 2-2.5 5-2.5 8h3V21"/></svg></span><div class="grow"><div class="t17">Pasti di oggi</div><div class="t13 muted">${N.meals.length} pasti · ${esc(N.meals.map(([k]) => k.toLowerCase()).slice(0, 3).join(", "))}</div></div>${CHEV}</button>
    ${N.rif && rifornimentoCard(N.rif) && CONFIG.sport.some((x) => x === "bici" || x === "corsa") ? `<div class="sep" style="margin-left:60px"></div><button class="lrow rowb" data-det="mrif" data-dt="Rifornimento"><span class="rico" style="background:#64D2FF"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/></svg></span><div class="grow"><div class="t17">Rifornimento e sudore</div><div class="t13 muted">${["bici", "corsa"].filter((x) => CONFIG.sport.includes(x)).map((x) => `${x} ${N.rif.gh[x]} g/h`).join(" · ") || "acqua e sali"}${["bici", "corsa"].some((x) => CONFIG.sport.includes(x)) ? " di carboidrati" : ""}</div></div>${CHEV}</button>` : ""}
    ${N.modo === "auto" && N.consumi && N.consumi.length ? `<div class="sep xc" style="margin-left:60px"></div><button class="lrow rowb xc" data-det="mbruci" data-dt="Quanto bruci"><span class="rico" style="background:#FF453A"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-4.3 4.5-6.3 4-11.3 3.4 2 7 5.7 7 10.6 0 4.2-1.8 6.9-4.5 6.9z"/></svg></span><div class="grow"><div class="t17">Quanto bruci</div><div class="t13 muted">calorie al minuto per sport, dalle tue attività</div></div>${CHEV}</button>` : ""}
  </div>
  </div>
  <div class="subv" id="co-peso">${weightCard(I.weight) || `<div class="card pad"><div class="t15 muted">Ancora nessuna pesata: scrivila qui ogni mattina o dalla bilancia.</div></div>`}</div>
  <div class="subv" id="co-sal">${saluteCorpo}</div>`;
  const tr = `
  <div class="seg seg3 subseg" id="seg-trend"><button class="on" data-s="pr-forma">Forma</button><button data-s="pr-rec">Record</button><button class="xc" data-s="pr-sog">Soglie</button></div>
  <div class="subv on" id="pr-forma">
  ${seasonCard(A)}
  <h2 class="ih xc">Fitness e fatica<button class="info" data-info="fitness" aria-label="Come si legge">i</button></h2>
  <div class="seg seg4 xc" id="rgseg">
    <button data-r="42">6 sett.</button>
    <button class="on" data-r="90">3 mesi</button>
    <button data-r="180">6 mesi</button>
    <button data-r="365">1 anno</button>
  </div>
  <div class="card pad xc" style="gap:4px">
    <div id="fitread" class="fitread"></div>
    <div id="fitchart" class="fitchart"></div>
    <div class="legend">
      <span><i style="background:#0A84FF"></i>Fitness</span>
      <span><i style="background:#BF5AF2"></i>Fatica</span>
      <span><i style="background:#fff"></i>Forma</span>
      <span><i class="dash"></i>Piano</span>
    </div>
  </div>
  <div class="t13 muted xc" style="padding:0 16px;line-height:1.4">Tieni premuto e scorri per leggere un giorno. Il tratteggio è quello che succede se fai le sedute in programma. Come si legge: tocca la i.</div>
  ${xcB(trajectoryCard(I.trajectory))}
  <button class="secondary" data-shlay="stagione">Condividi la stagione</button>
  </div>
  <div class="subv" id="pr-rec">
  ${recordCard(A.record, A.now)}
  ${A.prof && A.prof.vista === "completa" ? xcB(curveCard(A.curve)) : ""}
  ${xcB(progressiCard(A.prog, I.durability))}
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
.route{background:var(--fill);border-radius:14px;padding:6px;position:relative;cursor:pointer}
.mlmini{position:absolute;inset:0;border-radius:14px;overflow:hidden;opacity:0;transition:opacity .35s;pointer-events:none}.route.conmappa .mlmini{opacity:1}
.mlin{width:100%;height:100%}.mapfs{position:fixed;inset:0;z-index:40;background:var(--bg);display:none}.mapfs.on{display:block}.mfmap{position:absolute;inset:0}
.mftop{position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top) + 10px) 16px 0;display:flex;gap:12px;align-items:center;pointer-events:none}.mftop>*{pointer-events:auto}
.mfx{width:40px;height:40px;border-radius:20px;border:0;background:var(--card);color:var(--fg);display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 2px 12px rgba(0,0,0,.2)}
.mfseg{flex:1;max-width:220px;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,.2)}.mfsp{width:40px;flex:none}
.mfmsg{position:absolute;top:44%;left:24px;right:24px;text-align:center;color:var(--mut)}
.mfbot{position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 12px);background:var(--card);border-radius:20px;padding:14px 16px 10px;display:flex;flex-direction:column;gap:8px;box-shadow:0 6px 24px rgba(0,0,0,.22)}
.mfrow{display:flex;align-items:center;gap:12px}.mfinfo{flex:1;min-width:0}.mfplay{padding:12px 18px;flex:none}.mfattr{font-size:10px;color:var(--mut2);line-height:1.3}
body.noscroll{overflow:hidden}
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
.xblk{display:flex;flex-direction:column;gap:14px}
.cxs{position:relative;height:16px;font-size:10px;color:#8E8E93;margin-top:2px}.cxs span{position:absolute;transform:translateX(-50%);white-space:nowrap}
.acqb{border:0;border-radius:10px;background:var(--fill);color:var(--fg);font:inherit;font-size:15px;font-weight:600;padding:8px 14px;min-width:44px}.acqb.piu{color:#0A84FF}
.serie{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:10px}.stp{display:flex;align-items:center;justify-content:space-between;background:var(--fill);border-radius:14px;padding:6px}.stpb{width:44px;height:44px;border-radius:12px;border:0;background:var(--card);font:inherit;font-size:24px;font-weight:600;color:var(--fg)}.stpv{display:flex;flex-direction:column;align-items:center;line-height:1.1}.rirw{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.recb{font-size:12px;font-weight:700;color:#fff;background:#FF6A1A;border-radius:6px;padding:1px 6px;margin-left:8px;vertical-align:2px}body.ess .xc{display:none!important}body.ess #seg-trend{grid-template-columns:repeat(2,1fr)}
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
.esimg.no{background:var(--fill)}.esimg.no img{display:none}.esimg.cop{background:#030304}
.esvid{width:100%;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#030304 center/cover no-repeat}.esvid video,.esvid img{width:100%;height:100%;object-fit:cover;display:block}
.mus{gap:6px}.musr{display:flex;align-items:baseline;gap:8px;font-size:15px;line-height:1.35}.musr b{flex:none;font-weight:600}.musr span:last-child{color:var(--mut)}.musd{width:9px;height:9px;border-radius:50%;flex:none;transform:translateY(-1px)}
.esrow{display:flex;gap:12px;align-items:center;padding:10px 12px;cursor:pointer}
.mobfs{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mobf{margin:0;display:flex;flex-direction:column;gap:6px;cursor:pointer}.mobf .esimg{width:100%;height:auto;aspect-ratio:4/3}
.riscp{display:flex;gap:12px;align-items:center;background:var(--card);border-radius:14px;padding:10px 12px}.riscp .esimg{width:72px;height:54px}
.riscl .rr{display:flex;gap:10px;align-items:baseline;justify-content:space-between;padding:8px 0;border-top:.5px solid var(--sep)}.riscl .rr:first-child{border-top:0}.riscl .rr span:last-child{text-align:right;max-width:48%}
.esimg.rnum{background:var(--fill);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:var(--mut)}
.gdt{font-size:64px;font-weight:700;letter-spacing:-.04em;text-align:center;font-variant-numeric:tabular-nums}
</style></head><body class="${[A.needSetup ? "first" : "", A.prof && A.prof.vista === "completa" ? "" : "ess"].filter(Boolean).join(" ")}"><div class="wrap">
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
<div id="mapfs" class="mapfs" role="dialog" aria-label="Mappa del percorso"></div>
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
function indietro(){if(MFS){mappaChiudi();return true}var s=foglioAperto();if(s){chiudiFoglio(s);return true}if(document.body.classList.contains('first'))return false;var p=NAV.pop();if(!p)return false;CUR={v:p.v,t:p.t};showView(p.v,p.t);window.scrollTo(0,p.y||0);aggiornaBack();salvaNav();return true}
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
 IC("Sistemico","Cuore e sistema nervoso: HRV della settimana sotto la tua fascia normale, FC a riposo più alta del solito, poco sonno o forma molto negativa lo fanno scendere a cautela o riposo.")+
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
 IC("Conta la settimana","Il semaforo guarda la media degli ultimi 7 giorni e la confronta con la tua fascia normale dei 60 giorni prima. Una notte storta da sola accende il giallo solo se anche FC a riposo o sonno dicono lo stesso. Servono almeno 3 notti nella settimana e 20 nei 60 giorni; prima vale il confronto semplice con la media.")+
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
curve:["Curva dei migliori",
 "<p>Il meglio che hai fatto su ogni durata (in bici, la potenza media) o su ogni distanza (in corsa, il tempo), nelle ultime 12 settimane e nell'ultimo anno. La calcola Intervals dalle tue attività.</p>"+
 IC("Come si legge","Dove l'arancio tocca il blu, sei al tuo meglio dell'anno su quella durata. Dove sta sotto, lì c'è margine: sono le durate da allenare se servono alla tua gara.")+
 IC("Potenza critica e W′","La potenza che puoi tenere a lungo e la riserva di energia sopra quella (in kJ). Nelle uscite con la potenza il grafico W′bal mostra quanto di quella riserva hai speso e ricaricato.")+
 IC("Velocità critica e D′","Lo stesso per la corsa: il passo sostenibile a lungo e i metri che puoi fare più veloce prima di doverti fermare.")],
cibo:["Mangiato oggi",
 "<p>Di' a Siri «Ho mangiato» e poi cosa, oppure scrivilo qui: per esempio «180 g di pasta, 150 di pollo e un cucchiaio d'olio». L'app riconosce i cibi più comuni e le quantità, anche a cucchiai, fette, vasetti o pezzi.</p>"+
 IC("Quantità","Pasta, riso e cereali si contano a crudo, come nel piano. Se non dici quanto, vale una porzione normale.")+
 IC("Calorie e macro","Valori medi per 100 g: sono una stima, utile per non andare troppo sopra o sotto l'obiettivo del giorno.")+
 IC("Correggere","Tocca × accanto a una voce per toglierla. Se qualcosa non lo conosce te lo dice: riscrivilo con un nome più semplice.")+
 "<p><b>Con Siri.</b> Un Comando Rapido chiede cosa hai mangiato e lo passa all'HUD. Si fa una volta:</p>"+
 IC("1. Domanda","Comandi Rapidi › + › «Chiedi input»: Testo, domanda «Cosa hai mangiato?». Poi «Codifica URL» con dentro Testo fornito.")+
 IC("2. Link","«URL»: scrivi scriptable:///run/${encodeURIComponent(nomeScript())}?cibo= e subito dopo inserisci la variabile Testo codificato URL. Poi «Apri URL».")+
 IC("3. Nome","Chiamalo Ho mangiato. Dici «Ehi Siri, ho mangiato», rispondi e l'HUD si apre su Carburante con la voce segnata e il totale del giorno.")+
 "<p><b>Codice a barre.</b> Per gli alimenti confezionati: i valori arrivano da Open Food Facts e scegli tu i grammi. Puoi scrivere le cifre del codice nel campo qui sopra, oppure farti un Comando Rapido che lo inquadra:</p>"+
 IC("1. Inquadra","Comandi Rapidi › + › «Scansiona codice QR o a barre».")+
 IC("2. Link","«URL»: scrivi scriptable:///run/${encodeURIComponent(nomeScript())}?codice= e subito dopo inserisci la variabile Codice QR/a barre. Poi «Apri URL».")+
 IC("3. Nome","Chiamalo Codice HUD e mettilo nella schermata Home o sul tasto Azione: inquadri la confezione e l'HUD si apre con il prodotto da segnare.")],
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
// ---- Palestra, mobilità e riscaldamenti: esercizi con il video 3D di HUD (senza rete la foto del primo fotogramma)
var ESL=${JSON.stringify(ESL).replace(/</g, "\\u003c")};
var MUSC=${JSON.stringify(MUSC).replace(/</g, "\\u003c")},MOB_ZONE=${JSON.stringify(MOB_ZONE)},MOB_ZONA=${JSON.stringify(MOB_ZONA)},MOB_INFO=${JSON.stringify(MOB_INFO)},VIDEO_ES=${JSON.stringify(VIDEO_ES)},VID_BASE=${JSON.stringify(String(CONFIG.repository || "").replace("https://github.com/", "https://cdn.jsdelivr.net/gh/") + "@main/11_Omini_3D/video/")};
var ES={};ESL.forEach(function(e){ES[e[0]]={k:e[0],n:e[1],id:e[2],a:e[3],g:e[4],r:e[5],c:e[6]}});
// ---- Il motore della progressione (19-palestra-progressione.js), lo stesso di Scriptable
var PROG=(function(){var CONFIG={progressione:${JSON.stringify(CONFIG.progressione)}};var parseYMD=${parseYMD.toString()},arrotonda=${arrotonda.toString()},numOk=${numOk.toString()},fmtKg=${fmtKg.toString()};
var PROG_TIPO=${JSON.stringify(PROG_TIPO)},PROG_VARIANTE=${JSON.stringify(PROG_VARIANTE)};
${[tipoProgressione, leggiDose, registraSerie, stima1RM, migliore1RM, prossimaDose, fasciaDi].map(String).join("\n")}
var PASSI={bilGambe:'bilanciereGambe',bilAlto:'bilanciereAlto',legpress:'legPress',macchina:'macchina',manubri:'manubri'};
return {prossimaDose:prossimaDose,registraSerie:registraSerie,migliore1RM:migliore1RM,leggiDose:leggiDose,tipo:tipoProgressione,passo:function(es,dose){var t=tipoProgressione(es,dose);return PASSI[t]?CONFIG.progressione.passi[PASSI[t]]:null}};})();
// ---- Registro delle serie: kg e ripetizioni nella guida, partendo dal carico proposto
var KG0={bilGambe:20,bilAlto:20,legpress:40,macchina:20,manubri:6};
function serieDose(e,giri){return (giri||1)+' × '+e.r}
function serieKg(x){return itN(x,x%1?1:0)}
function serieCtx(){return {oggi:TODAY,semaforo:SEMAFORO}}
function serieLog(k){return ((DIARY.palestra&&DIARY.palestra.log)||[]).filter(function(v){return v.es===k})}
function serieUltima(k){var L=serieLog(k),v=L[L.length-1];if(!v)return '';var kg=Math.max.apply(null,v.serie.map(function(s){return s.kg||0})),rp=v.serie.map(function(s){return s.rip}).filter(function(x){return x!==null&&x!==undefined});
  return v.serie.length+' × '+(rp.length&&rp.every(function(x){return x===rp[0]})?rp[0]:rp.join('-'))+(kg?' a '+serieKg(kg)+' kg':'')+' ('+lab(v.data)+')'}
function propTesto(p){var r=[];if(p.serie)r.push(p.serie+' × '+(p.sec?p.sec+'"':(p.rip||'')));if(p.kg)r.push('a '+serieKg(p.kg)+' kg');if(p.variante&&ES[p.variante])r.push('versione più dura: '+ES[p.variante].n);return r.join(' ')}
function serieTipo(P){var dose=P.dose||P.e.r,D=PROG.leggiDose(dose);if(D.sec||D.metri)return null;var t=PROG.tipo(P.e.k,dose);if(t==='fermo'||t==='tempo')return null;var pa=PROG.passo(P.e.k,dose);return {kg:!!pa,passo:pa||1,k0:KG0[t]||10}}
function serieHTML(G,P){var T=serieTipo(P);if(!T)return '';var k=P.e.k,dose=P.dose||P.e.r;G.prop=G.prop||{};if(!G.prop[k])G.prop[k]=PROG.prossimaDose(DIARY,k,dose,serieCtx());
  var pr=G.prop[k],L=(G.log&&G.log[k])||[],ult=L[L.length-1];
  var kg=T.kg?(ult&&ult.kg!==null?ult.kg:(pr.kg!==null&&pr.kg!==undefined?pr.kg:null)):null,rip=ult?ult.rip:(pr.rip||PROG.leggiDose(dose).rip||10);
  G.cur={k:k,kg:kg,rip:rip,rir:null,passo:T.passo,conKg:T.kg,k0:T.k0};
  var st=function(id,val,u){return '<div class="stp"><button type="button" class="stpb" data-stp="'+id+'" data-d="-1" aria-label="Meno">−</button><div class="stpv"><span class="t22 bold" id="gd-'+id+'">'+val+'</span><span class="t13 muted">'+u+'</span></div><button type="button" class="stpb" data-stp="'+id+'" data-d="1" aria-label="Più">+</button></div>'};
  var prima=serieUltima(k);
  return '<div class="serie">'+(T.kg?st('kg',kg===null?'—':serieKg(kg),'kg'):'')+st('rip',rip,'ripetizioni')+'</div>'+
    '<div class="rirw xc"><span class="t13 muted">Ripetizioni di riserva</span>'+[0,1,2,3].map(function(n){return '<button type="button" class="chipb" data-rir="'+n+'">'+(n===3?'3+':n)+'</button>'}).join('')+'</div>'+
    '<div class="t13 muted">'+escH(pr.motivo||'')+(prima?(pr.motivo?' · ':'')+'La volta scorsa '+escH(prima)+'.':'')+'</div>'}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-stp]');var C=GUIDA&&GUIDA.cur;if(b&&C){var id=b.getAttribute('data-stp'),d=+b.getAttribute('data-d');
    if(id==='kg'){C.kg=C.kg===null?C.k0:Math.max(0,Math.round((C.kg+d*C.passo)*100)/100);document.getElementById('gd-kg').textContent=serieKg(C.kg)}
    else{C.rip=Math.max(1,Math.min(100,C.rip+d));document.getElementById('gd-rip').textContent=C.rip}return}
  var r=e.target.closest&&e.target.closest('[data-rir]');if(r&&C){C.rir=+r.getAttribute('data-rir');document.querySelectorAll('[data-rir]').forEach(function(x){x.classList.toggle('on',x===r)})}});
// A fine guida: si salvano le serie, si segnano i record (1RM stimato più alto di prima) e il carico della volta dopo
function serieFine(G){var L=G.log||{},ks=Object.keys(L).filter(function(k){return L[k].length&&ES[k]});if(!ks.length)return '';var voci=[],righe=[];
  ks.forEach(function(k){var prima=PROG.migliore1RM(DIARY,k),v=PROG.registraSerie(DIARY,{data:TODAY,es:k,serie:L[k]});if(!v)return;voci.push(v);
    var dopo=PROG.migliore1RM(DIARY,k),rec=!!(prima&&dopo&&dopo.valore>prima.valore),kg=Math.max.apply(null,v.serie.map(function(s){return s.kg||0}));
    var pr=PROG.prossimaDose(DIARY,k,(G.dose&&G.dose[k])||serieDose(ES[k],v.serie.length),serieCtx());
    righe.push('<div class="lrow" style="align-items:flex-start"><div class="grow"><div class="t15 semi">'+escH(ES[k].n)+(rec?'<span class="recb">Record</span>':'')+'</div><div class="t13 muted">'+v.serie.length+(v.serie.length===1?' serie':' serie')+(kg?' · fino a '+serieKg(kg)+' kg':'')+(dopo?'<span class="xc"> · 1RM stimato '+itN(dopo.valore,1)+' kg</span>':'')+'</div><div class="t13" style="margin-top:2px">Prossima volta: '+escH(propTesto(pr))+(pr.motivo?' · '+escH(pr.motivo):'')+'</div></div></div>')});
  if(voci.length)hudSend('serie',JSON.stringify(voci));
  return righe.length?'<div class="card list" style="align-self:stretch;text-align:left">'+righe.join('<div class="sep l16"></div>')+'</div>':''}
// Nella scheda dell'esercizio: ultima volta, carico proposto e (vista completa) 1RM stimato
function esDati(k){var L=serieLog(k),v=L[L.length-1];if(!v)return '';var b=PROG.migliore1RM(DIARY,k),pr=PROG.prossimaDose(DIARY,k,serieDose(ES[k],v.serie.length),serieCtx());
  return '<div class="icard"><b>I tuoi dati</b><span>Ultima volta '+escH(serieUltima(k))+'. Prossima: '+escH(propTesto(pr))+'.'+(b?'<span class="xc"> 1RM stimato '+itN(b.valore,1)+' kg ('+lab(b.data)+').</span>':'')+'</span></div>'}

var ATTR_L={libero:0,elastico:1,manubri:2,palestra:3},ATTR_OK={libero:['libero'],elastico:['libero','elastico'],manubri:['libero','manubri'],palestra:['libero','elastico','manubri','palestra']},GR_FORZA={gambe:1,post:1,mono:1,spinta:1,tirata:1,polpacci:1};
function esImg(id,n){return 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'+id+'/'+n+'.jpg'}
function esNo(i){i.parentNode.classList.add('no')}
function esNo2(i){i.style.display='none'}
function esFoto(e,cls){if(VIDEO_ES[e.k]&&VID_BASE)return '<div class="esimg cop'+(cls?' '+cls:'')+'"><img src="'+VID_BASE+e.k+'.jpg" alt="'+escH(e.n)+'" loading="lazy" onerror="esNo(this)"></div>';
  if(!e.id)return '<div class="esimg no'+(cls?' '+cls:'')+'"></div>';
  return '<div class="esimg'+(cls?' '+cls:'')+'"><img src="'+esImg(e.id,0)+'" alt="'+escH(e.n)+'" loading="lazy" onerror="esNo(this)"><img class="f2" src="'+esImg(e.id,1)+'" alt="" loading="lazy" onerror="esNo2(this)"></div>'}
// Video 3D: la figura fa l'esercizio, i muscoli si accendono (rosso lavorano, rosa aiutano, azzurro si allungano). Senza rete torna la foto.
function esMedia(e,cls){var f=VIDEO_ES[e.k];if(cls!=='big'||!f||!VID_BASE)return esFoto(e,cls);
  if(f==='webp')return '<div class="esvid" data-k="'+e.k+'" style="background-image:url('+VID_BASE+e.k+'.jpg)"><img src="'+VID_BASE+e.k+'.webp" alt="'+escH(e.n)+' in 3D" onerror="esVidNo(this)"></div>';
  return '<div class="esvid" data-k="'+e.k+'"><video src="'+VID_BASE+e.k+'.mp4" poster="'+VID_BASE+e.k+'.jpg" autoplay loop muted playsinline preload="auto" onerror="esVidNo(this)"></video></div>'}
function esVidNo(v){var b=v.parentNode,e=ES[b.getAttribute('data-k')];if(e)b.outerHTML=esFoto(e,'big')}
function esMuscoli(k){var m=MUSC[k];if(!m)return '';var R=[['Lavorano','#FF3B30',m[0]],['Aiutano','#FF8A80',m[1]],['Si allungano','#0A84FF',m[2]]].filter(function(r){return r[2].length});
  return R.length?'<div class="icard mus">'+R.map(function(r){return '<div class="musr"><span class="musd" style="background:'+r[1]+'"></span><b>'+r[0]+'</b><span>'+escH(r[2].join(', '))+'</span></div>'}).join('')+'</div>':''}
function esScheda(k){var e=ES[k];if(!e)return;var v3=!!VIDEO_ES[k];var mi=MOB_INFO[k],TIPI={dinamica:'Dinamica',attiva:'Attiva',statica:'Statica',pnf:'Contrai e rilascia',rullo:'Rullo e pallina'};
  openP(e.n,(v3||e.id?esMedia(e,'big'):'')+(mi?'<div class="t15 muted">'+escH([TIPI[mi[0]]||mi[0],mi[1]==='libero'?'Senza attrezzi':'Serve: '+mi[1],mi[2].split(' ').map(function(x){return x.charAt(0).toUpperCase()+x.slice(1)}).join(', ')].join(' · '))+'</div>':'')+esMuscoli(k)+esDati(k)+'<div class="icard"><b>Come si fa</b><span>'+escH(e.c)+'</span></div><div class="t15 muted">Dose: '+escH(e.r)+'</div><div class="t13 muted">'+(v3?'Animazione 3D di HUD (figura MakeHuman, CC0).':e.id?'Foto: Free Exercise DB (pubblico dominio).':'Il video 3D di questo esercizio arriva con il prossimo aggiornamento.')+'</div>')}
document.addEventListener('click',function(e){var s=e.target.closest&&e.target.closest('[data-es]');if(s){e.preventDefault();esScheda(s.getAttribute('data-es'))}},true);
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
    '<div class="card list">'+L.map(function(r,i){return (i?'<div class="sep" style="margin-left:124px"></div>':'')+'<div class="esrow" data-es="'+r.e.k+'">'+esFoto(r.e)+'<div class="grow"><div class="t16 semi">'+escH(r.e.n)+'</div><div class="t13 muted">'+r.giri+' × '+escH(r.e.r)+(function(){var p=serieLog(r.e.k).length?PROG.prossimaDose(DIARY,r.e.k,serieDose(r.e,r.giri),serieCtx()):null;return p&&p.kg?' · '+serieKg(p.kg)+' kg':''})()+' · recupero '+r.rec+'"</div></div><span class="chev2" aria-hidden="true">›</span></div>'}).join('')+'</div>'+
    (SCRIVE?'<div class="btnrow" style="grid-template-columns:1fr 1fr"><button class="secondary" id="gy-piano">Metti nel piano</button><button class="primary" id="gy-via">Inizia ora</button></div>':'<button class="primary" id="gy-via">Inizia ora</button>')+'<div class="t13 muted" style="padding:0 4px;line-height:1.4">Tocca un esercizio per come si fa, ▶ per il video. Carichi che lasciano 2 ripetizioni di riserva. Foto: Free Exercise DB, pubblico dominio.</div>';
  [['gy-ob','ob'],['gy-at','at'],['gy-t','t']].forEach(function(p){box.querySelectorAll('#'+p[0]+' .chipb').forEach(function(b){b.addEventListener('click',function(){GYM[p[1]]=p[1]==='t'?+b.getAttribute('data-v'):b.getAttribute('data-v');try{localStorage.setItem('hud_gym',JSON.stringify(GYM))}catch(e){}gymVista()})})});
  var gp=document.getElementById('gy-piano');if(gp)gp.addEventListener('click',function(){gymPiano(L)});
  document.getElementById('gy-via').addEventListener('click',function(){var passi=[];for(var g=1;g<=(L[0]?L[0].giri:0);g++)L.forEach(function(r){passi.push({e:r.e,testo:'Giro '+g+' di '+r.giri+' · '+r.e.r,rec:r.rec,dose:serieDose(r.e,r.giri)})});guida('Palestra · '+GYM.t+' min',passi,false)})}
// Il passo per passo: foto grande, dose o timer, recupero; per palestra si va avanti a mano, per la mobilità a tempo
var GUIDA=null;
function guidaStop(){if(GUIDA&&GUIDA.tm)clearInterval(GUIDA.tm);GUIDA=null}
function guida(tit,passi,aTempo){guidaStop();GUIDA={p:passi,i:0,tit:tit,tempo:aTempo,riposo:false,tm:null,log:{},prop:{},dose:{},cur:null};passi.forEach(function(p){if(p.e&&p.dose)GUIDA.dose[p.e.k]=p.dose});guidaMostra()}
function guidaMostra(){var G=GUIDA;if(!G)return;if(G.tm){clearInterval(G.tm);G.tm=null}
  if(G.i>=G.p.length){if(G.fine===undefined)G.fine=G.tempo?'':serieFine(G);openP(G.tit,'<div class="vstack" style="gap:12px;align-items:center;padding:30px 0"><div class="t28 bold">Fatto</div><div class="t15 muted">'+G.p.length+' passi completati. Bravo.</div>'+G.fine+'<button class="primary" style="align-self:stretch" id="gd-fine">Chiudi</button></div>');document.getElementById('gd-fine').addEventListener('click',function(){guidaStop();closeP()});return}
  var P=G.p[G.i],sec=G.riposo?P.rec:(G.tempo?P.sec:0),fino=Date.now()+sec*1000;
  var h=G.riposo?'<div class="label caps">Recupero</div><div class="gdt" id="gd-t">'+sec+'"</div><div class="t15 muted">Dopo: '+escH((G.p[G.i+1]||{e:{n:'fine'}}).e.n)+'</div><button class="secondary" id="gd-ok">Salta</button>'
    :esMedia(P.e,'big')+'<div class="hstack" style="justify-content:space-between;align-items:baseline"><span class="t22 bold">'+escH(P.e.n)+'</span><span class="t13 muted">'+(G.i+1)+' di '+G.p.length+'</span></div><div class="t17 semi">'+escH(P.testo)+'</div>'+(sec?'<div class="gdt" id="gd-t">'+sec+'"</div>':'')+(G.tempo||G.riposo?'':serieHTML(G,P))+'<div class="t15 muted">'+escH(P.e.c)+'</div>'+
      '<button class="primary" id="gd-ok">'+(sec?'Avanti':'Fatto')+'</button>';
  openP(G.tit,'<div class="vstack" style="gap:12px">'+h+'<div class="pbar"><div style="width:'+Math.round(G.i/G.p.length*100)+'%;background:var(--accbg)"></div></div></div>');
  function avanti(){if(!GUIDA)return;var C=G.cur;if(!G.riposo&&C&&C.k===P.e.k)(G.log[C.k]=G.log[C.k]||[]).push({kg:C.conKg?C.kg:null,rip:C.rip,rir:C.rir});G.cur=null;if(!G.riposo&&P.rec&&G.i<G.p.length-1){G.riposo=true}else{G.riposo=false;G.i++}guidaMostra()}
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
    '<div class="t20 bold" style="padding:0 4px">Tutti gli esercizi</div><div id="mobcat"></div>'+
    '<div class="t20 bold" style="padding:0 4px">Riscaldamento prima della seduta</div><div class="card list">'+Object.keys(RISC).map(function(x,i){var r=RISC[x];return (i?'<div class="sep l16"></div>':'')+'<button class="lrow rowb" data-risc="'+x+'"><span class="evbar" style="background:'+(SPC[r.sp]||'#8E8E93')+'"></span><div class="grow"><div class="t16 semi">'+escH(r.t)+'</div><div class="t13 muted">'+r.min+'’ · '+escH(r.passi.map(function(p){return p[1]}).slice(0,2).join(', '))+'</div></div>'+CHEVJ+'</button>'}).join('')+'</div>';mobCatalogo()}
// Catalogo per zona del corpo: chip in alto, la lista sotto; ogni esercizio apre la sua scheda (video 3D, muscoli, come si fa)
var MOBZ=null;try{MOBZ=localStorage.getItem('hud_mobz')}catch(e){}
function mobCatalogo(){var box=document.getElementById('mobcat');if(!box)return;var zone=Object.keys(MOB_ZONE);if(!MOB_ZONE[MOBZ])MOBZ=zone[0];
  var L=Object.keys(MOB_ZONA).filter(function(k){return MOB_ZONA[k]===MOBZ&&ES[k]}).map(function(k){return ES[k]});
  box.innerHTML='<div class="chipw" id="mz">'+zone.map(function(z){var n=Object.keys(MOB_ZONA).filter(function(k){return MOB_ZONA[k]===z&&ES[k]}).length;return '<button type="button" class="chipb'+(z===MOBZ?' on':'')+'" data-z="'+z+'">'+escH(MOB_ZONE[z])+' '+n+'</button>'}).join('')+'</div>'+
    '<div class="card list" style="margin-top:10px">'+L.map(function(e,i){var mi=MOB_INFO[e.k];return (i?'<div class="sep" style="margin-left:124px"></div>':'')+'<div class="esrow" data-es="'+e.k+'">'+esFoto(e)+'<div class="grow"><div class="t16 semi">'+escH(e.n)+'</div><div class="t13 muted">'+escH(e.r)+(mi&&mi[1]!=='libero'?' · '+escH(mi[1]):'')+'</div></div>'+CHEVJ+'</div>'}).join('')+'</div>';
  box.querySelectorAll('#mz .chipb').forEach(function(b){b.addEventListener('click',function(){MOBZ=b.getAttribute('data-z');try{localStorage.setItem('hud_mobz',MOBZ)}catch(e){}mobCatalogo()})})}
function riscScheda(k){var r=RISC[k];if(!r)return;
  var h='<div class="label caps">'+r.min+' minuti</div>'+r.passi.map(function(p){var e=p[0]?ES[p[0]]:null;return '<div class="riscp'+(e?'" data-es="'+e.k:'')+'">'+(e?esFoto(e):'<div class="esimg rnum">'+(r.passi.indexOf(p)+1)+'</div>')+'<div class="grow"><div class="t16 semi">'+escH(p[1])+'</div><div class="t13 muted">'+escH(p[2]||'')+'</div></div>'+(e?'<span class="chev2" aria-hidden="true">›</span>':'')+'</div>'}).join('')+(r.nota?'<div class="icard"><b>Perché</b><span>'+escH(r.nota)+'</span></div>':'');
  openP('Riscaldamento · '+r.t,'<div class="vstack" style="gap:10px">'+h+'</div>')}
document.addEventListener('click',function(e){var m=e.target.closest&&e.target.closest('[data-mob]');if(m){var R=MOB[m.getAttribute('data-mob')];if(R)guida(R[0],mobPassi(R),true);return}
  var r=e.target.closest&&e.target.closest('[data-risc]');if(r){riscScheda(r.getAttribute('data-risc'))}});
// Le sedute di palestra del piano: righe con foto e video, e la guida passo passo
function esLista(v){return String(v||'').split(',').map(function(x){var p=x.split(':');return {e:ES[p[0]],d:(p[1]||'').trim()}}).filter(function(x){return x.e})}
function esIdrata(){document.querySelectorAll('#pbody .esl[data-esl]').forEach(function(b){var L=esLista(b.getAttribute('data-esl'));
  b.innerHTML=L.map(function(x,i){return (i?'<div class="sep" style="margin-left:124px"></div>':'')+'<div class="esrow" data-es="'+x.e.k+'">'+esFoto(x.e)+'<div class="grow"><div class="t16 semi">'+escH(x.e.n)+'</div><div class="t13 muted">'+escH(x.d||x.e.r)+'</div></div><span class="chev2" aria-hidden="true">›</span></div>'}).join('');b.removeAttribute('data-esl')})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-gymgo]');if(!b)return;var L=esLista(b.getAttribute('data-gymgo')),giri=1;
  L.forEach(function(x){var m=/^([0-9]+) *×/.exec(x.d);if(m)giri=Math.max(giri,+m[1])});var passi=[];
  for(var g=1;g<=giri;g++)L.forEach(function(x){var m=/^([0-9]+) *× *(.+)$/.exec(x.d);if(m&&+m[1]<g)return;passi.push({e:x.e,testo:(giri>1?'Giro '+g+' di '+giri+' · ':'')+(m?m[2]:x.d||x.e.r),rec:x.e.g==='core'?30:75,dose:x.d||x.e.r})});
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
  if(sp==='nuoto'){var nuS=aNuoto(A);if(nuS)add('SWOLF',nuS.swolf,'')}
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
// Nuoto: dalla frequenza di bracciata (Intervals la chiama cadenza) e dalla vasca. SWOLF = secondi + bracciate per vasca, più basso è meglio
function aNuoto(a){if(!a||a.sp!=='nuoto'||!a.cad||!a.m||!a.sec)return null;var L=a.vasca||(a.vasche?a.m/a.vasche:0);if(!(L>=15&&L<=100))return null;
  var v=a.m/a.sec,tl=L/v,bv=a.cad*tl/60;if(!(bv>3&&bv<80))return null;return{L:L,tl:tl,bv:bv,dps:v*60/a.cad,swolf:Math.round(tl+bv)}}
var A_ESS={'Durata':1,'Distanza':1,'Passo medio':1,'Velocità media':1,'FC media':1,'Calorie':1,'Dislivello +':1,'Vasche':1};
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
  if(a.cad)add(a.sp==='corsa'?'Cadenza':a.sp==='nuoto'?'Frequenza bracciata':'Cadenza',a.sp==='corsa'?Math.round(a.cad*2):Math.round(a.cad),a.sp==='corsa'?'passi/min':a.sp==='nuoto'?'/min':'rpm');
  if(a.w)add('Potenza media',a.w,'W');if(a.np)add('Potenza normalizzata',a.np,'W');
  if(a.stride)add('Lunghezza passo',itN(a.stride,2),'m');if(a.gct)add('Contatto al suolo',Math.round(a.gct),'ms');if(a.vo)add('Oscillazione verticale',itN(a.vo>30?a.vo/10:a.vo,1),'cm');
  if(a.vasche)add('Vasche',a.vasche+(a.vasca?' da '+a.vasca+' m':''),'');
  var nu=aNuoto(a);if(nu){add('Bracciate per vasca',itN(nu.bv,1),'');add('Metri per bracciata',itN(nu.dps,2),'m');add('SWOLF',nu.swolf,'')}
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
  return '<div class="gch'+(o.xc?' xc':'')+'" data-k="'+(CHS.length-1)+'"><div class="gtop"><span class="t15 semi">'+escH(o.t)+'</span><span class="t13 muted gval">'+escH(o.sub||'')+'</span></div>'+
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
  if(s.alt&&!a.indoor)out+=aGrafico({dist:s.d,sp:a.sp,xc:1,t:'Quota',s:s.alt,c:'#30D158',sec:sec,f:function(v){return Math.round(v)+' m'},sub:a.dplus?'+'+itN(a.dplus)+' m':''});
  if(s.w)out+=aGrafico({dist:s.d,sp:a.sp,xc:1,t:'Potenza',s:s.w,c:'#FFD60A',sec:sec,f:function(v){return Math.round(v)+' W'},sub:a.w?'media '+a.w+' W':''});
  if(s.cad)out+=aGrafico({dist:s.d,sp:a.sp,xc:1,t:a.sp==='nuoto'?'Bracciate':'Cadenza',s:s.cad,c:'#BF5AF2',sec:sec,map:function(v){return a.sp==='corsa'?v*2:v},f:function(v){return Math.round(v)+(a.sp==='corsa'?' passi/min':a.sp==='nuoto'?'/min':' rpm')}});
  if(s.temp)out+=aGrafico({dist:s.d,sp:a.sp,xc:1,t:a.meteo?'Temperatura':'Temperatura al polso',s:s.temp,c:'#FF9F0A',sec:sec,f:function(v){return itN(v,1)+' °C'}});
  if(s.wbal&&d.wbal)out+=aGrafico({dist:s.d,sp:a.sp,xc:1,t:'W′bal',s:s.wbal,c:'#FF375F',sec:sec,f:function(v){return itN(v/1000,1)+' kJ'},sub:'minimo '+itN(d.wbal.min/1000,1)+' di '+itN(d.wbal.wp/1000,1)+' kJ'});
  if(s.resp)out+=aGrafico({dist:s.d,sp:a.sp,xc:1,t:'Respirazione',s:s.resp,c:'#5E5CE6',sec:sec,f:function(v){return Math.round(v)+' atti/min'}});
  return out?'<div class="gwrap">'+out+'</div>':''}
function aZone(a){if(!a.z||!a.z.some(function(v){return v>0}))return '';var tot=a.z.reduce(function(x,y){return x+y},0),zl=a.zl||[];
  var bar=a.z.map(function(v,i){return v>0?'<div style="flex:'+v+' 1 0;background:'+ZC[i]+'"></div>':''}).join('');
  var rows=a.z.map(function(v,i){var rg=i===0?'sotto '+(zl[0]||'—'):(zl[i-1]||'—')+'–'+(zl[i]||'—');return '<div class="zrow"><span class="zdot" style="background:'+ZC[i]+'"></span><span class="t15 semi" style="width:30px">Z'+(i+1)+'</span><span class="t13 muted grow">'+rg+' bpm</span><span class="t15" style="font-variant-numeric:tabular-nums">'+aHm(v)+'</span><span class="t13 muted" style="width:44px;text-align:right">'+Math.round(v/tot*100)+'%</span></div>'}).join('');
  return '<div class="asec"><div class="t15 semi">Zone di frequenza cardiaca</div><div class="zbar">'+bar+'</div>'+rows+'</div>'}
// ---- Mappa del percorso: MapLibre GL con le mappe di OpenFreeMap e il rilievo di AWS Terrain Tiles per il 3D.
// Si scarica solo quando una card con percorso è sullo schermo; se manca la rete resta il disegno qui sotto.
var ML_URL='https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/',ML_P=null,MAPS=[],MFS=null;
var DEM_URL='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
var ML_ATTR='Mappa OpenFreeMap © OpenMapTiles · dati © OpenStreetMap';
function mlCarica(){if(window.maplibregl)return Promise.resolve(window.maplibregl);if(ML_P)return ML_P;
  ML_P=new Promise(function(ok,ko){var l=document.createElement('link');l.rel='stylesheet';l.href=ML_URL+'maplibre-gl.css';document.head.appendChild(l);
    var s=document.createElement('script');s.src=ML_URL+'maplibre-gl.js';s.onload=function(){if(window.maplibregl)ok(window.maplibregl);else{ML_P=null;ko(new Error('mappa'))}};
    s.onerror=function(){ML_P=null;ko(new Error('rete'))};document.head.appendChild(s)});
  return ML_P}
function mlScuro(){return !!(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)}
function mlStile(){return 'https://tiles.openfreemap.org/styles/'+(mlScuro()?'dark':'positron')}
function mlPunti(R){return R.lat.map(function(la,i){return [R.lng[i],la]})}
function mlLimiti(R){return [[Math.min.apply(null,R.lng),Math.min.apply(null,R.lat)],[Math.max.apply(null,R.lng),Math.max.apply(null,R.lat)]]}
function mlLinea(cs){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:cs}}}
function mlDist(a,b){var k=Math.cos((a[1]+b[1])/2*Math.PI/180),x=(b[0]-a[0])*k,y=b[1]-a[1];return Math.sqrt(x*x+y*y)*111320}
function mlRotta(a,b){var k=Math.cos(a[1]*Math.PI/180);return Math.atan2((b[0]-a[0])*k,b[1]-a[1])*180/Math.PI}
// la traccia: bordo chiaro, linea arancio, partenza (cerchio vuoto) e arrivo (punto pieno), come nel disegno
function mlTraccia(map,R){var cs=mlPunti(R),sc=mlScuro();
  map.addSource('trk',{type:'geojson',data:mlLinea(cs)});
  map.addSource('trkp',{type:'geojson',data:{type:'FeatureCollection',features:[{type:'Feature',properties:{k:'a'},geometry:{type:'Point',coordinates:cs[0]}},{type:'Feature',properties:{k:'b'},geometry:{type:'Point',coordinates:cs[cs.length-1]}}]}});
  map.addLayer({id:'trk-b',type:'line',source:'trk',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':sc?'#000000':'#FFFFFF','line-width':8,'line-opacity':0.85}});
  map.addLayer({id:'trk',type:'line',source:'trk',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#FF6A1A','line-width':4}});
  map.addLayer({id:'trk-p',type:'circle',source:'trkp',paint:{'circle-radius':['match',['get','k'],'a',5,6],'circle-color':['match',['get','k'],'a',sc?'#1C1C1E':'#FFFFFF','#FF6A1A'],'circle-stroke-color':['match',['get','k'],'a','#FF6A1A',sc?'#000000':'#FFFFFF'],'circle-stroke-width':2.5}})}
// anteprima nella card: mappa ferma (si scorre la pagina, non la mappa); un tocco apre la mappa grande
function mlMini(el){var id=el.getAttribute('data-mappa'),d=ATT.det[id];if(!d||!d.route||el.getAttribute('data-ml'))return;el.setAttribute('data-ml','1');
  mlCarica().then(function(ml){if(!document.body.contains(el))return;var box=document.createElement('div');box.className='mlmini';el.appendChild(box);var inn=document.createElement('div');inn.className='mlin';box.appendChild(inn);
    var map=new ml.Map({container:inn,style:mlStile(),interactive:false,attributionControl:false,bounds:mlLimiti(d.route),fitBoundsOptions:{padding:26},fadeDuration:0});MAPS.push(map);
    map.on('load',function(){try{mlTraccia(map,d.route)}catch(e){}map.once('idle',function(){el.classList.add('conmappa')})});
    map.on('error',function(){})}).catch(function(){})}
function mlMiniature(){var L=Array.prototype.slice.call(document.querySelectorAll('#attbox .route[data-mappa]'));if(!L.length)return;
  if(!('IntersectionObserver' in window)){L.forEach(mlMini);return}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);mlMini(e.target)}})},{rootMargin:'200px'});L.forEach(function(x){io.observe(x)})}
function mlPulisci(){MAPS.forEach(function(m){try{m.remove()}catch(e){}});MAPS=[]}
// mappa grande: Mappa (dall'alto) o 3D (rilievo e inclinazione); Ripercorri vola lungo il percorso
function mappaApri(id){var d=ATT.det[id];if(!d||!d.route)return;var a=null;
  Object.keys(ATT.att||{}).forEach(function(g){(ATT.att[g]||[]).forEach(function(x){if(String(x.id)===String(id))a=x})});
  var info=a?[a.m?(a.sp==='nuoto'?itN(a.m)+' m':itN(a.m/1000,1)+' km'):null,a.dplus?'+'+itN(a.dplus)+' m':null,a.sec?aDur(a.sec):null].filter(Boolean).join(' · '):'';
  var fs=document.getElementById('mapfs');if(!fs)return;
  fs.innerHTML='<div class="mfmap"><div id="mfmap" class="mlin"></div></div>'+
    '<div class="mftop"><button class="mfx" id="mfx" type="button" aria-label="Chiudi"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>'+
    '<div class="seg seg2 mfseg" id="mfseg"><button class="on" type="button" data-m="2d">Mappa</button><button type="button" data-m="3d">3D</button></div><span class="mfsp"></span></div>'+
    '<div class="mfmsg t15" id="mfmsg">Carico la mappa…</div>'+
    '<div class="mfbot"><div class="mfrow"><div class="mfinfo"><div class="t17 semi">'+escH(a?(a.nome||aSport(a.sp).label):'Percorso')+'</div><div class="t13 muted">'+escH(info)+'</div></div><button class="primary mfplay" id="mfplay" type="button">Ripercorri</button></div>'+
    '<div class="mfattr">'+ML_ATTR+' · rilievo Mapzen, AWS · senza i primi e gli ultimi 250 m</div></div>';
  fs.classList.add('on');document.body.classList.add('noscroll');
  MFS={map:null,anim:0,R:d.route,m:'2d',brg:0};
  document.getElementById('mfx').addEventListener('click',mappaChiudi);
  document.getElementById('mfseg').addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button[data-m]');if(b)mappaModo(b.getAttribute('data-m'))});
  document.getElementById('mfplay').addEventListener('click',ripercorri);
  mlCarica().then(function(ml){if(!MFS)return;
    var map=new ml.Map({container:'mfmap',style:mlStile(),bounds:mlLimiti(d.route),fitBoundsOptions:{padding:{top:96,bottom:170,left:36,right:36}},attributionControl:false,maxPitch:75,fadeDuration:0,dragRotate:true});
    MFS.map=map;map.touchZoomRotate.enableRotation();
    map.on('load',function(){if(!MFS)return;mlTraccia(map,d.route);
      map.addSource('fatto',{type:'geojson',data:mlLinea([mlPunti(d.route)[0],mlPunti(d.route)[0]])});
      map.addLayer({id:'fatto',type:'line',source:'fatto',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':mlScuro()?'#FFFFFF':'#1D1D1F','line-width':5}});
      map.addSource('punto',{type:'geojson',data:{type:'Point',coordinates:mlPunti(d.route)[0]}});
      map.addLayer({id:'punto',type:'circle',source:'punto',paint:{'circle-radius':7,'circle-color':'#FF6A1A','circle-stroke-color':'#FFFFFF','circle-stroke-width':3}});
      map.setLayoutProperty('fatto','visibility','none');map.setLayoutProperty('punto','visibility','none');MFS.pronto=true;
      var m=document.getElementById('mfmsg');if(m)m.style.display='none';if(MFS.m==='3d')mappaModo('3d',true)});
    map.on('error',function(){})
  }).catch(function(){var m=document.getElementById('mfmsg');if(m)m.textContent='Senza rete la mappa non si carica: il disegno del percorso resta nella card.'})}
function mappaModo(m,forza){var M=MFS;if(!M)return;
  document.querySelectorAll('#mfseg button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-m')===m)});
  var cambia=M.m!==m;M.m=m;var map=M.map;if(!map||!M.pronto||(!cambia&&!forza))return;
  if(m==='3d'){if(!map.getSource('dem')){map.addSource('dem',{type:'raster-dem',tiles:[DEM_URL],tileSize:256,maxzoom:15,encoding:'terrarium'});
      map.addSource('demh',{type:'raster-dem',tiles:[DEM_URL],tileSize:256,maxzoom:15,encoding:'terrarium'});
      map.addLayer({id:'hs',type:'hillshade',source:'demh',paint:{'hillshade-exaggeration':0.35,'hillshade-shadow-color':mlScuro()?'#000000':'#5A4A30'}},'trk-b')}
    map.setLayoutProperty('hs','visibility','visible');map.setTerrain({source:'dem',exaggeration:1.5});map.easeTo({pitch:62,bearing:-25,duration:1200})}
  else{fermaVolo();map.setTerrain(null);if(map.getLayer('hs'))map.setLayoutProperty('hs','visibility','none');map.fitBounds(mlLimiti(M.R),{padding:{top:96,bottom:170,left:36,right:36},pitch:0,bearing:0,duration:900})}}
function fermaVolo(){var M=MFS;if(!M||!M.anim)return;cancelAnimationFrame(M.anim);M.anim=0;var b=document.getElementById('mfplay');if(b)b.textContent='Ripercorri'}
function ripercorri(){var M=MFS;if(!M||!M.map||!M.pronto)return;if(M.anim){fermaVolo();return}
  if(M.m!=='3d')mappaModo('3d');var map=M.map,cs=mlPunti(M.R),cum=[0];for(var i=1;i<cs.length;i++)cum.push(cum[i-1]+mlDist(cs[i-1],cs[i]));
  var tot=cum[cum.length-1]||1,dur=Math.max(12000,Math.min(40000,tot/1000*1600)),z=tot<4000?15.2:tot<15000?14.4:tot<40000?13.6:12.8,av=Math.max(120,tot*0.03),t0=0,j=0;
  function avanza(dd){while(j<cs.length-2&&cum[j+1]<dd)j++;var k=cum[j+1]>cum[j]?(dd-cum[j])/(cum[j+1]-cum[j]):0;k=Math.max(0,Math.min(1,k));return [cs[j][0]+(cs[j+1][0]-cs[j][0])*k,cs[j][1]+(cs[j+1][1]-cs[j][1])*k]}
  function dove(dd){var jj=0;while(jj<cs.length-2&&cum[jj+1]<dd)jj++;var k=cum[jj+1]>cum[jj]?(dd-cum[jj])/(cum[jj+1]-cum[jj]):0;k=Math.max(0,Math.min(1,k));return [cs[jj][0]+(cs[jj+1][0]-cs[jj][0])*k,cs[jj][1]+(cs[jj+1][1]-cs[jj][1])*k]}
  map.setLayoutProperty('fatto','visibility','visible');map.setLayoutProperty('punto','visibility','visible');
  M.brg=mlRotta(cs[0],dove(av));document.getElementById('mfplay').textContent='Ferma';
  function passo(ts){if(MFS!==M||!M.anim)return;if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/dur),dd=k*tot,p=avanza(dd),q=dove(Math.min(tot,dd+av));
    var r=mlRotta(p,q),dlt=((r-M.brg+540)%360)-180;M.brg+=dlt*0.06;
    map.getSource('fatto').setData(mlLinea(cs.slice(0,j+1).concat([p])));map.getSource('punto').setData({type:'Point',coordinates:p});
    map.jumpTo({center:p,bearing:M.brg,pitch:62,zoom:z});
    if(k<1)M.anim=requestAnimationFrame(passo);else{M.anim=0;var b=document.getElementById('mfplay');if(b)b.textContent='Ripercorri';map.fitBounds(mlLimiti(M.R),{padding:{top:96,bottom:170,left:36,right:36},pitch:55,bearing:M.brg,duration:1600})}}
  M.anim=requestAnimationFrame(passo)}
function mappaChiudi(){var M=MFS;MFS=null;if(M){if(M.anim)cancelAnimationFrame(M.anim);if(M.map)try{M.map.remove()}catch(e){}}
  var fs=document.getElementById('mapfs');if(fs){fs.classList.remove('on');fs.innerHTML=''}document.body.classList.remove('noscroll')}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-mappa]');if(b){e.preventDefault();mappaApri(b.getAttribute('data-mappa'))}});
function aPercorso(d,c,id){if(!d||!d.route)return '';var r=d.route,la=r.lat,lo=r.lng,mnA=Math.min.apply(null,la),mxA=Math.max.apply(null,la),mnO=Math.min.apply(null,lo),mxO=Math.max.apply(null,lo),k=Math.cos((mnA+mxA)/2*Math.PI/180);
  var w=(mxO-mnO)*k||1e-6,h=(mxA-mnA)||1e-6,W=340,H=Math.max(160,Math.min(300,W*h/w)),s=Math.min((W-24)/w,(H-24)/h),ox=(W-w*s)/2,oy=(H-h*s)/2;
  var P=la.map(function(a,i){return [(ox+(lo[i]-mnO)*k*s).toFixed(1),(oy+(mxA-a)*s).toFixed(1)]}),pts=P.map(function(p){return p.join(',')}).join(' '),a0=P[0],a1=P[P.length-1];
  var mid=escH(String(id));
  return '<div class="asec"><div class="hstack" style="justify-content:space-between"><span class="t15 semi">Percorso</span><button class="linkbtn" type="button" data-mappa="'+mid+'">Mappa e 3D ›</button></div><div class="route" data-mappa="'+mid+'"><svg viewBox="0 0 '+W+' '+H.toFixed(0)+'" width="100%"><polyline points="'+pts+'" fill="none" stroke="'+c+'" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="'+a0[0]+'" cy="'+a0[1]+'" r="5" fill="var(--card)" stroke="'+c+'" stroke-width="2.5"/><circle cx="'+a1[0]+'" cy="'+a1[1]+'" r="6" fill="#FF6A1A"/></svg></div><div class="t13 muted">Senza i primi e gli ultimi 250 m, così non si vede da dove parti. '+ML_ATTR+'.</div></div>'}
function aKm(d){if(!d||!d.km||!d.km.length)return '';var ps=d.km.map(function(k){return k.passo}),mn=Math.min.apply(null,ps),mx=Math.max.apply(null,ps);
  var rows=d.km.map(function(k){var w=mx>mn?30+70*(mx-k.passo)/(mx-mn):100;return '<div class="krow"><span class="t15 semi" style="width:40px">'+(k.parz?itN(k.km,2):k.km)+'</span><span class="kbar"><span style="width:'+w.toFixed(0)+'%"></span></span><span class="t15" style="width:50px;text-align:right">'+paceS(k.passo)+'</span><span class="t13 muted" style="width:62px;text-align:right;white-space:nowrap">'+(k.hr?k.hr+' bpm':'')+'</span><span class="t13 muted" style="width:38px;text-align:right">'+(k.su!==null&&k.su!==undefined?'+'+k.su:'')+'</span></div>'}).join('');
  return '<div class="asec xc"><div class="hstack" style="justify-content:space-between"><span class="t15 semi">Parziali al km</span><span class="t13 muted">passo · FC · D+</span></div>'+rows+'</div>'}
function aGiri(a,d){var G=d&&d.giri&&d.giri.length?d.giri:null;
  if(!G){if(!a.giri||!a.giri.length)return '';return '<div class="asec xc"><div class="t15 semi">Giri</div><div class="chips">'+a.giri.map(function(g){return '<span class="chip">'+escH(g)+'</span>'}).join('')+'</div></div>'}
  var corsaLike=a.sp==='corsa'||a.sp==='altro';
  var rows=G.map(function(g){var vel=g.v&&g.m?(a.sp==='bici'?itN(g.v*3.6,1)+' km/h':a.sp==='nuoto'?paceS(100/g.v)+'/100':corsaLike?paceS(1000/g.v)+'/km':''):'';
    return '<div class="lrow2'+(/RECOVERY|REST/i.test(g.tipo)?' rec':'')+'"><span class="t13 muted" style="width:22px">'+g.n+'</span><span class="t15" style="width:62px">'+aDur(g.sec)+'</span><span class="t13 muted" style="width:62px">'+(g.m?(a.sp==='nuoto'||g.m<1000?Math.round(g.m)+' m':itN(g.m/1000,2)+' km'):'')+'</span><span class="t15 grow">'+vel+'</span><span class="t13 muted" style="text-align:right">'+(g.hr?Math.round(g.hr)+' bpm':'')+(g.w?' · '+Math.round(g.w)+' W':'')+'</span></div>'}).join('');
  return '<div class="asec xc"><div class="t15 semi">Giri</div>'+rows+'</div>'}
function aCard(a){var d=ATT.det[a.id],S=aSport(a.sp),M=aMetriche(a,d),hero=M.slice(0,3),rest=M.slice(3);
  var head='<div class="atth"><span class="evbar" style="background:'+S.c+'"></span><div class="grow"><div class="t17 semi">'+escH(a.nome||S.label)+'</div><div class="sub">'+S.label+(a.indoor?' al chiuso':'')+' · '+a.ora+'–'+a.fine+(a.device?' · '+escH(a.device):'')+(a.gear?' · '+escH(a.gear):'')+'</div></div><button class="sharebtn" data-shatt="'+escH(a.id)+'" aria-label="Condividi"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg></button></div>';
  var heroH='<div class="ahero">'+hero.map(function(m){return '<div><div class="label caps">'+m[0]+'</div><div class="num34" style="font-size:26px">'+escH(m[1])+'<span class="unit"> '+m[2]+'</span></div></div>'}).join('')+'</div>';
  var grid=rest.length?'<div class="agrid">'+rest.map(function(m){return '<div'+(A_ESS[m[0]]?'':' class="xc"')+'><div class="label">'+m[0]+'</div><div class="num20">'+escH(m[1])+'<span class="unit"> '+m[2]+'</span></div></div>'}).join('')+'</div>':'';
  var piano=a.piano?'<div class="exbox"><span class="t15 semi">Piano: '+escH(a.piano.nome)+'</span><span class="t13 muted">'+(a.piano.min?aHm(a.piano.min*60)+' previsti':'')+(a.piano.tss?'<span class="xc"> · '+a.piano.tss+' TSS</span>':'')+(a.comp?' · fatto al '+Math.round(a.comp)+'%':'')+'</span></div>':'';
  var attesa=!d&&window.__inScriptable?'<div class="t13 muted">Carico grafici, percorso e giri…</div>':'';
  return '<div class="card attc">'+head+heroH+grid+piano+attesa+aGrafici(a,d)+aZone(a)+aPercorso(d,S.c,a.id)+aKm(d)+aGiri(a,d)+'</div>'}
function attRender(){var box=document.getElementById('attbox');if(!box)return;CHS=[];mlPulisci();
  if(!ATT.att[ATTG]&&ATTG!==ATT.oggi){var j=ATT.giorni.indexOf(ATTG);box.innerHTML='<div class="attnav"><button class="navb" id="attprev"'+(j>=ATT.giorni.length-1?' disabled':'')+'>‹</button><div style="text-align:center"><div class="t22 bold">'+aGiorno(ATTG)+'</div><div class="sub">'+GIOL[aD(ATTG).getDay()]+'</div></div><button class="navb" id="attnext"'+(j<=0?' disabled':'')+'>›</button></div><div class="card pad"><div class="t15 muted">'+(window.__inScriptable?'Carico il giorno…':'Apri l’HUD da Scriptable per vedere questo giorno.')+'</div></div>';
    document.getElementById('attprev').addEventListener('click',function(){attVai(1)});document.getElementById('attnext').addEventListener('click',function(){attVai(-1)});
    if(window.__inScriptable&&!ATTREQ['g'+ATTG]){ATTREQ['g'+ATTG]=1;hudSend('attg',ATTG)}return}
  var i=ATT.giorni.indexOf(ATTG),L=ATT.att[ATTG]||[],C=ATT.ctx[ATTG]||{};
  var tot={sec:0,kcal:0,tss:0,m:0};L.forEach(function(a){tot.sec+=a.sec||0;tot.kcal+=a.kcal||0;tot.tss+=a.tss||0;if(a.sp!=='nuoto')tot.m+=a.m||0});
  var nav='<div class="attnav"><button class="navb" id="attprev"'+(i>=ATT.giorni.length-1?' disabled':'')+' aria-label="Giorno prima">‹</button><div style="text-align:center"><div class="t22 bold">'+aGiorno(ATTG)+'</div><div class="sub">'+(/^(Oggi|Ieri)$/.test(aGiorno(ATTG))?aData(ATTG):GIOL[aD(ATTG).getDay()])+' · '+(L.length===1?'1 attività':L.length+' attività')+'</div></div><button class="navb" id="attnext"'+(i<=0?' disabled':'')+' aria-label="Giorno dopo">›</button></div>';
  var tl='';if(L.length){tl='<div class="tline xc">'+L.map(function(a){var h0=+a.ora.slice(0,2)+a.ora.slice(3)/60,h1=+a.fine.slice(0,2)+a.fine.slice(3)/60;if(h1<h0)h1=24;return '<span style="left:'+(h0/24*100).toFixed(2)+'%;width:'+Math.max(0.8,(h1-h0)/24*100).toFixed(2)+'%;background:'+aSport(a.sp).c+'"></span>'}).join('')+'</div><div class="tlx xc"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>'}
  var sum='<div class="card pad"><div class="ahero">'+[['Tempo',aHm(tot.sec),''],['Calorie',itN(tot.kcal),'kcal'],['Carico',Math.round(tot.tss),'TSS']].map(function(m){return '<div'+(m[0]==='Carico'?' class="xc"':'')+'><div class="label caps">'+m[0]+'</div><div class="num34" style="font-size:28px">'+m[1]+'<span class="unit"> '+m[2]+'</span></div></div>'}).join('')+'</div>'+(tot.m?'<div class="t13 muted">'+itN(tot.m/1000,1)+' km tra corsa, bici e camminate</div>':'')+tl+'</div>';
  var cx=[['Sonno',C.sonno?aHm(C.sonno)+(C.voto?' · '+C.voto:''):null],['HRV',C.hrv?Math.round(C.hrv)+' ms':null],['FC a riposo',C.rhr?C.rhr+' bpm':null],['Peso',C.peso?itN(C.peso,1)+' kg':null],['Forma',C.ctl!==null&&C.ctl!==undefined&&C.atl!==null&&C.atl!==undefined?((C.ctl-C.atl>0?'+':'')+Math.round(C.ctl-C.atl)):null],['Mangiato',C.kcal?itN(C.kcal)+' kcal':null]].filter(function(c){return c[1]});
  var ctx=cx.length?'<h2 class="xc">La giornata</h2><div class="card pad xc"><div class="agrid">'+cx.map(function(c){return '<div><div class="label">'+c[0]+'</div><div class="num20">'+c[1]+'</div></div>'}).join('')+'</div>'+(C.lungo&&C.lungo.carbo>=0?'<div class="t13 muted">Lungo segnato: '+C.lungo.carbo+' g di carboidrati, stomaco '+escH(C.lungo.stomaco||'—')+'</div>':'')+'</div>':'';
  var cards=L.length?'<h2>'+(L.length===1?'L’attività':'Le attività')+'</h2>'+L.slice().reverse().map(aCard).join(''):'<div class="card pad"><div class="t17 semi">Nessuna attività</div><div class="t15 muted">'+(ATTG===ATT.oggi?'Quando l’orologio sincronizza una seduta con Intervals, la trovi qui con tutti i dati.':'In questo giorno non c’è niente di registrato.')+'</div></div>';
  box.innerHTML=nav+sum+ctx+cards;mlMiniature();
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
var DIARY=${JSON.stringify(A.diary || {}).replace(/</g, "\\u003c")},TODAY='${ymd(d)}',ACQ=${JSON.stringify(acquaDi(A))},SEMAFORO='${A.worst}',RISCR=${JSON.stringify(riscriviInfo(A))};
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
  function segna(){var t=String(inp.value||'').trim(),c=t.split(' ').join('');if(t.length<3){toast('Scrivi cosa hai mangiato');return}
    if(/^[0-9]{8,14}$/.test(c)){if(!hudSend('codice',c))toast('Funziona nell’app su iPhone');else{b.disabled=true;b.textContent='…'}return}
    if(!hudSend('cibo',t))toast('Funziona nell’app su iPhone');else{b.disabled=true;b.textContent='…'}}
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
  if(p.palestra){var AT={libero:'a corpo libero',elastico:'con l’elastico',manubri:'con manubri e kettlebell',palestra:'in palestra'},hp='<div class="pv"><p>'+pvDal(p)+'. '+p.palestra.n+(p.palestra.n===1?' seduta':' sedute')+' a settimana da '+hm(p.palestra.min)+', '+(AT[p.palestra.attrezzi]||'')+': tre schede che si alternano (gambe e glutei, parte alta e core, tutto il corpo). La quarta settimana è più leggera.</p>';
    p.settimane.forEach(function(w){var ss=w.sedute.slice().sort(function(a,b){return a.g-b.g});hp+='<div class="pvw"><div class="pvh"><span>Settimana '+w.n+(w.scarico?' · più leggera':'')+'</span><span>'+hm(w.minuti)+'</span></div>';
      ss.forEach(function(s){hp+='<div class="pvr"><span class="muted">'+GL[s.g]+'</span><span class="dot" style="background:#30D158"></span><span>'+escH(s.nome)+'</span><span class="muted">'+hm(s.min)+'</span></div>'});hp+='</div>'});
    hp+='<p class="q">Ogni seduta ha gli esercizi con il video 3D: tocca la seduta nell’app. Carichi che lasciano 2 ripetizioni di riserva.</p><div class="pvbtn"><button class="secondary" type="button" onclick="closeP()">Annulla</button><button class="primary" type="button" data-act="plan:scrivi">Scrivi nel calendario</button></div></div>';
    openP('Il tuo piano',hp);return}
  var L=p.livello||{},sp=p.sport||['nuoto','bici','corsa'],ha=function(x){return sp.indexOf(x)>=0},
    lg=ha('corsa')&&L.lungo?' e un lungo di corsa tipico di '+L.lungo+' minuti':!ha('corsa')&&ha('bici')&&L.lungoBici?' e un lungo in bici tipico di '+hm(L.lungoBici):'',
    h='<div class="pv"><p>'+pvDal(p)+'. Parto da fitness '+(L.ctl||0)+(lg?', ':' e ')+String(L.ore||0).replace('.',',')+' ore a settimana nell’ultimo mese'+lg+'.'+(L.rientro?' Hai corso poco di recente, quindi il lungo riparte basso.':'')+'</p>';
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
// Riscrivi il piano: da domani o da lunedì, poi l’anteprima. Con cambiate=1 arriva dalle Impostazioni appena salvate
window.__riscrivi=function(cambiate){var R=RISCR;if(!R)return;
  var riga=function(act,tit,sub){return '<button class="lrow rowlink" type="button" data-act="'+act+'"><span><span class="t17 semi" style="display:block">'+tit+'</span><span class="t13 muted" style="display:block;margin-top:2px">'+escH(sub)+'</span></span><span class="chev2">›</span></button>'};
  var h='<div class="vstack" style="gap:14px">'+(cambiate?'<div class="t17 semi">Le tue risposte sono cambiate</div><div class="t15 muted">Il piano nel calendario è ancora quello di prima: riscrivilo per usare le risposte nuove.</div>':'<div class="t15 muted">Lo rifaccio dalle tue risposte e da quello che hai fatto finora. Le sedute già fatte e quelle di oggi restano.</div>')+
    '<div class="card list">'+riga('plan:domani','Da domani',R.dom+(R.stesso?'':' · cambia anche il resto di questa settimana'))+(R.stesso?'':'<div class="sep l16"></div>'+riga('plan:lunedi','Da lunedì',R.lun+' · questa settimana resta com’è'))+'</div>'+
    '<div class="t13 muted">Prima di scriverlo nel calendario vedi l’anteprima.</div>'+(cambiate?'':'<button class="secondary" type="button" id="rs-imp">Prima cambia ore, giorni o gara</button>')+'</div>';
  openP('Riscrivi il piano',h);var b=document.getElementById('rs-imp');if(b)b.addEventListener('click',function(){closeP();vai('setup','Impostazioni')})};
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-riscrivi]');if(b){e.preventDefault();window.__riscrivi(0)}});
function pvDal(p){return p.dal?art('Dal',p.dal)+' (domani) '+art('al',p.fine):art('Dal',p.inizio)+' '+art('al',p.fine)}
(function(){var b=document.getElementById('f-vista');if(!b)return;b.addEventListener('click',function(e){var x=e.target.closest&&e.target.closest('button[data-v]');if(!x)return;var v=x.getAttribute('data-v');
  b.querySelectorAll('button').forEach(function(y){y.classList.toggle('on',y===x)});document.body.classList.toggle('ess',v!=='completa');
  try{if(typeof attRender==='function')attRender()}catch(err){}try{if(typeof drawFit==='function')drawFit()}catch(err){}
  if(!hudSend('vista',v))toast(v==='completa'?'Vista completa':'Vista essenziale');else toast(v==='completa'?'Vista completa':'Vista essenziale')})})();
// Acqua: un tocco per bicchiere, si salva subito nel diario
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-acq]');if(!b)return;ACQ.ml=Math.max(0,Math.min(8000,ACQ.ml+(+b.getAttribute('data-acq'))));
  var v=document.getElementById('acq-v'),br=document.getElementById('acq-b');if(v)v.textContent=itN(ACQ.ml/1000,1);if(br)br.style.width=Math.min(100,ACQ.ml/Math.max(1,ACQ.obiettivo)*100).toFixed(0)+'%';
  DIARY.acqua=DIARY.acqua||{};DIARY.acqua[TODAY]=ACQ.ml;if(!hudSend('acqua',JSON.stringify({d:TODAY,ml:ACQ.ml})))toast('Funziona nell’app su iPhone')});
// Codice a barre (Open Food Facts): nome, valori per 100 g e i grammi da segnare
window.__prodotto=function(p){var b=document.getElementById('cibook');if(b){b.disabled=false;b.textContent='Segna'}
  if(!p||!p.nome){toast(p&&p.errore?p.errore:'Prodotto non trovato');return}var g=p.porzione||100;
  var h='<div class="vstack" style="gap:12px"><div><div class="t20 bold">'+escH(p.nome)+'</div><div class="t13 muted">'+escH([p.marca,p.codice].filter(Boolean).join(' · '))+'</div></div>'+
    '<div class="icard"><b>Per 100 g</b><span>'+itN(p.kcal)+' kcal · carboidrati '+itN(p.C,1)+' g · proteine '+itN(p.P,1)+' g · grassi '+itN(p.G,1)+' g</span></div>'+
    '<div class="stp"><button type="button" class="stpb" data-pg="-10" aria-label="Meno">−</button><div class="stpv"><span class="t22 bold" id="pg-v">'+g+'</span><span class="t13 muted">grammi</span></div><button type="button" class="stpb" data-pg="10" aria-label="Più">+</button></div>'+
    '<div class="t15" id="pg-t"></div><div class="pvbtn"><button class="secondary" type="button" onclick="closeP()">Annulla</button><button class="primary" type="button" id="pg-ok">Segna</button></div>'+
    '<div class="t13 muted">Dati di Open Food Facts (ODbL), inseriti da chi li usa: se qualcosa non torna, controlla l’etichetta.</div></div>';
  openP('Codice a barre',h);
  function tot(){document.getElementById('pg-v').textContent=g;document.getElementById('pg-t').textContent='Segni '+itN(p.kcal*g/100)+' kcal e '+itN(p.C*g/100)+' g di carboidrati.'}tot();
  document.querySelectorAll('[data-pg]').forEach(function(x){x.addEventListener('click',function(){g=Math.max(5,Math.min(2000,g+(+x.getAttribute('data-pg'))));tot()})});
  document.getElementById('pg-ok').addEventListener('click',function(){var o=this;if(!hudSend('ciboOFF',JSON.stringify({codice:p.codice,nome:p.nome,g:g,kcal:p.kcal,C:p.C,P:p.P,G:p.G})))toast('Funziona nell’app su iPhone');else{o.disabled=true;o.textContent='…'}})};
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

