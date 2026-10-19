// ------------------------------------------------------------
//  Campana: le notifiche dell'app. Sono le stesse che arrivano sul telefono (all'ora in cui arrivano),
//  più i record, gli avvisi scritti sull'orologio e le sedute sincronizzate. Restano 30 giorni.
// ------------------------------------------------------------
const CAMP_FILE = "hud-campana.json";
let CAMPANA = { lista: [] };
function campanaIO() {
  const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), CAMP_FILE);
  return {
    read: () => { try { const o = fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; return o && Array.isArray(o.lista) ? o : { lista: [] }; } catch (e) { return { lista: [] }; } },
    write: (o) => { try { fm.writeString(p, JSON.stringify(o)); } catch (e) { console.log("Campana non salvata: " + e); } },
  };
}
// aggiunge una voce o, con lo stesso id, ne aggiorna il testo (se era già letta resta letta)
function campanaMetti(C, v, now) {
  const i = C.lista.findIndex((x) => x.id === v.id);
  if (i >= 0) C.lista[i] = { ...C.lista[i], ...v, letta: !!(v.letta || C.lista[i].letta) };
  else C.lista.push({ letta: false, ...v });
  const lim = addDays(now, -30).toISOString();
  C.lista = C.lista.filter((x) => x.t >= lim).sort((a, b) => b.t.localeCompare(a.t)).slice(0, 40);
}
// quelle già arrivate (le programmate compaiono all'ora della notifica)
const campanaArrivate = (C, now) => (C.lista || []).filter((x) => new Date(x.t) <= now);
function campanaSegnaLette(C, now, filtro) { for (const x of C.lista || []) if (new Date(x.t) <= now && (!filtro || filtro(x))) x.letta = true; }

// ------------------------------------------------------------
//  Domani: la sera prima, l'allenamento nel dettaglio (notifica sul telefono e foglio nell'app)
// ------------------------------------------------------------
const TESTO_RICARICA = "Stasera cena di ricarica: un piatto abbondante di pasta o riso, poca fibra.";
const oraEv = (e) => { const h = String(e.start_date_local || "").slice(11, 16); return h && h !== "00:00" ? h : null; };
// i passi in una riga: «15' Z1 · 6× 5' 4:55/km / 2' Z1 · 10' Z1»
function passiBrevi(parsed, max = 6) {
  const R = (parsed && parsed.rows) || [], out = [];
  const uno = (r) => `${r.len || ""}${r.targets && r.targets[0] ? " " + r.targets[0].t : ""}`.trim();
  for (let i = 0; i < R.length && out.length < max; i++) {
    const r = R[i];
    if (r.plain) continue;
    if (r.header) {
      const sub = []; let j = i + 1;
      while (j < R.length && R[j].indent) { sub.push(uno(R[j])); j++; }
      out.push(`${r.header} ${sub.filter(Boolean).join(" / ")}`.trim()); i = j - 1; continue;
    }
    if (uno(r)) out.push(uno(r));
  }
  return out.join(" · ");
}
// cosa prendere: «4 gel (100 g)», con la borraccia se è nei prodotti
function rifBreve(S) {
  if (!S) return "";
  const conta = new Map();
  for (const v of S.voci) if (v.tipo === "mangia") conta.set(v.nome, (conta.get(v.nome) || 0) + 1);
  if (!conta.size) return "";
  const pr = [...conta].map(([n, k]) => `${k} ${n}`).join(" + ");
  return `${S.borraccia ? S.borraccia.nome + " in borraccia + " : ""}${pr} (${S.g} g di carboidrati)`;
}
// la borsa: dipende dagli sport, dal chiuso o fuori e dal rifornimento
function daPreparare(A) {
  const evs = (A.tomorrowEv || []).filter((e) => !e.done), out = [];
  const add = (x) => { if (x && !out.includes(x)) out.push(x); };
  for (const e of evs) {
    const indoor = e.trainer === true || /virtual/i.test(e.type || "") || /tapis|treadmill|indoor|rulli|spinning|cyclette/i.test(e.name || "");
    if (e.sport === "nuoto") { add("costume, cuffia e occhialini"); add("asciugamano e ciabatte"); }
    if (e.sport === "forza") add("borsa della palestra");
    if (e.sport === "corsa") { const g = gearPer(e, (A.diary || {}).gear); add(g ? `le ${g.nome}` : null); if (indoor) add("asciugamano"); }
    if (e.sport === "bici") { if (indoor) { add("ventilatore e asciugamano"); add(e.min >= 60 ? "2 borracce" : "una borraccia"); } else { add("casco e luci"); add("2 borracce"); } }
    if (e.rif) { const r = rifBreve(e.rif); if (r) add(r.replace(/ \(\d+ g di carboidrati\)$/, "").replace(" in borraccia", "")); else if (e.rif.voci.length) add("acqua"); }
  }
  if (A.domani && A.domani.palestra) add("borsa della palestra");
  return out.slice(0, 6);
}
function promemoriaDomani(A) {
  const D = A.domani;
  if (!D) return null;
  const evs = (A.tomorrowEv || []).filter((e) => !e.done);
  if (!evs.length && !D.palestra) return null;
  const nomi = evs.map((e) => `${e.name || (SPORT[e.sport] || SPORT.altro).label}${e.min ? " " + fmtMin(e.min) : ""}`);
  if (D.palestra) nomi.push("Palestra");
  const righe = [];
  for (const e of evs) {
    const s = SPORT[e.sport] || SPORT.altro, ora = oraEv(e), p = passiBrevi(e.parsed) || keyLine(e.parsed) || (e.min ? fmtMin(e.min) : "");
    righe.push(`${evs.length > 1 || ora ? `${s.label}${ora ? " alle " + ora : ""}: ` : ""}${p}`);
    if (e.rif && e.rif.voci.some((v) => v.tipo === "mangia")) righe.push(`Durante: ${rifBreve(e.rif)}`);
  }
  if (D.palestra) righe.push(`Palestra: ${D.palestra}`);
  if (D.chiave && (CONFIG.notifiche || {}).ricarica !== false) righe.push(TESTO_RICARICA);
  const prep = daPreparare(A);
  if (prep.length) righe.push(`Prepara: ${prep.join(", ")}`);
  return { titolo: `Domani · ${nomi.join(" + ")}`, testo: righe.filter(Boolean).join("\n"), data: D.data };
}
// il foglio «Domani» nell'app: sedute con i passi, cosa prendere, la borsa, il carburante del giorno
function domaniHTML(A) {
  const D = A.domani, evs = (A.tomorrowEv || []).filter((e) => !e.done), d = parseYMD(D.data), P = D.piano;
  const TIPO = { lungo: "Giorno lungo", duro: "Giorno duro", medio: "Giorno medio", riposo: "Giorno di riposo" };
  const testa = `<div class="domh"><div class="t28 bold">${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}</div>
    ${P ? `<div class="hstack" style="gap:8px;flex-wrap:wrap"><span class="pill" style="background:var(--fill)">${TIPO[P.tipo] || ""}</span><span class="t15 muted">${fmtIt(P.kcal)} kcal · ${fmtIt(P.C)} g di carboidrati</span></div>` : ""}</div>`;
  const sedute = evs.map((e) => {
    const s = SPORT[e.sport] || SPORT.altro, ora = oraEv(e), key = keyLine(e.parsed), steps = stepsList(e.parsed, e.sport);
    const indoor = e.trainer === true || /virtual/i.test(e.type || "") || /tapis|treadmill|indoor|rulli|spinning|cyclette/i.test(e.name || "");
    const orologio = e.rif && e.rif.voci.some((v) => v.tipo === "mangia") && haAvvisi(e.description) ? `<div class="t13 muted" style="line-height:1.4">Avvia la seduta dall'allenamento del giorno sull'orologio: gli avvisi arrivano da soli.</div>` : "";
    return `<div class="dcard">
      <div class="dhead"><span class="evbar" style="background:${s.c}"></span><div class="grow"><div class="t17 semi">${esc(e.name || s.label)}</div><div class="sub">${s.label}${indoor ? " al chiuso" : ""}${ora ? ` · alle ${ora}` : ""}</div></div></div>
      ${detStats([["Durata", e.min ? fmtMin(e.min) : null], ["Distanza", num(e.distance) ? fmtDist(e.distance, e.sport) : null], ["Carico", e.load ? `${Math.round(e.load)} TSS` : null]])}
      ${riscHTML(e)}
      ${e.sport === "forza" && eserciziDi(e).length >= 2 ? eserciziHTML(e) : steps ? `<div class="label caps" style="margin:2px 2px -4px">I passi</div>${steps}` : key ? `<div class="keyline">${esc(key)}</div>` : ""}
      ${e.rif ? rifSedutaHTML(e) : ""}${orologio}
    </div>`;
  }).join("");
  const gym = D.palestra ? `<div class="dcard"><div class="dhead"><span class="evbar" style="background:${SPORT.forza.c}"></span><div class="grow"><div class="t17 semi">Palestra</div><div class="sub">${esc(D.palestra)}</div></div></div>${riscHTML({ sport: "forza" })}</div>` : "";
  const prep = daPreparare(A), cena = D.chiave && (CONFIG.notifiche || {}).ricarica !== false ? TESTO_RICARICA : null;
  const stasera = prep.length || cena ? `<h3>Stasera</h3><div class="card list">${cena ? `<div class="lrow"><span class="t15" style="line-height:1.4;white-space:normal">${esc(cena)}</span></div>${prep.length ? '<div class="sep l16"></div>' : ""}` : ""}${prep.map((x) => `<label class="lrow prep"><input type="checkbox"><span class="t15 grow" style="white-space:normal">Prepara ${esc(x)}</span></label>`).join('<div class="sep l16"></div>')}</div>` : "";
  const carb = P ? `<h3>Carburante di domani</h3>${detStats([["Calorie", `${fmtIt(P.kcal)} kcal`], ["Carboidrati", `${fmtIt(P.C)} g`], ["Proteine", `${fmtIt(P.P)} g`], ["Grassi", `${fmtIt(P.G)} g`]])}` : "";
  return `${testa}${sedute}${gym}${stasera}${carb}<button class="primary" id="domok">Ok, a domani</button>`;
}

// Le sedute arrivate da Intervals dopo l'ultima apertura: nella campana e, ad app chiusa (widget), anche sul telefono
async function campanaAttivita(raw, C, now, interattivo, primaVolta) {
  if (primaVolta || !Array.isArray(raw.nuove) || !raw.nuove.length) return 0;
  const N = CONFIG.notifiche || {};
  let n = 0;
  for (const id of raw.nuove.slice(0, 5)) {
    const a = (raw.activities || []).find((x) => String(x.id) === String(id));
    if (!a || !a.start_date_local || (now - new Date(a.start_date_local)) / 36e5 > 36) continue;
    const sp = sportOf(a.type), sec = num(a.moving_time) ?? num(a.elapsed_time) ?? 0, tss = num(a.icu_training_load);
    if (sec < 300 || (sp === "altro" && (tss || 0) < 5)) continue;
    const cid = `att-${a.id}`;
    if (C.lista.some((x) => x.id === cid)) continue;
    const s = SPORT[sp] || SPORT.altro, m = num(a.distance), v = num(a.average_speed);
    const txt = [fmtMin(Math.round(sec / 60)), m && sp !== "forza" ? fmtDist(m, sp) : null,
      sp === "corsa" && v ? `${fmtPace(1000 / v)}/km` : sp === "bici" && v ? `${fmtIt(v * 3.6, 1)} km/h` : sp === "nuoto" && v ? `${fmtPace(100 / v)}/100 m` : null,
      num(a.average_heartrate) ? `FC ${Math.round(a.average_heartrate)}` : null, tss ? `${Math.round(tss)} TSS` : null,
      num(a.compliance) ? `piano al ${Math.round(a.compliance)}%` : null].filter(Boolean).join(" · ");
    const tit = `${a.name || s.label}`, g = a.start_date_local.slice(0, 10);
    campanaMetti(C, { id: cid, t: now.toISOString(), tit, txt, tipo: "att", sp, az: "att:" + g }, now);
    n++;
    if (!interattivo && N.attivita && typeof Notification !== "undefined") {
      try {
        const no = new Notification();
        no.identifier = cid; no.threadIdentifier = "hud"; no.title = `Fatto: ${tit}`; no.body = `${txt}\nTocca per grafici, giri e percorso.`;
        try { no.openURL = `scriptable:///run/${encodeURIComponent(Script.name())}?att=${g}`; } catch (e) {}
        no.setTriggerDate(new Date(now.getTime() + 2000));
        await no.schedule();
      } catch (e) { console.log("Notifica attività: " + e); }
    }
  }
  return n;
}

// Notifiche sul telefono: solo quando c'è qualcosa da fare, al massimo una per tipo al giorno.
// Ognuna finisce anche nella campana, all'ora in cui arriva.
async function scheduleNotifs(A, C, interattivo) {
  if (typeof Notification === "undefined") return;
  C = C || { lista: [] };
  const N = CONFIG.notifiche || {};
  const now = new Date();
  const fm = FileManager.local();
  const p = fm.joinPath(fm.documentsDirectory(), "hud-notifiche.json");
  let sent = {};
  try { if (fm.fileExists(p)) sent = JSON.parse(fm.readString(p)); } catch (e) {}
  const nome = (() => { try { return encodeURIComponent(Script.name()); } catch (e) { return "HUD"; } })();
  const programma = async (id, title, body, date, o = {}) => {
    const n = new Notification();
    n.identifier = id; n.threadIdentifier = "hud"; n.title = title; n.body = body;
    if (o.q) { try { n.openURL = `scriptable:///run/${nome}?${o.q}`; } catch (e) {} }
    n.setTriggerDate(date);
    await n.schedule();
    sent[id] = 1;
    campanaMetti(C, { id, t: date.toISOString(), tit: title, txt: body, tipo: o.tipo || "info", az: o.az || null }, now);
  };
  const once = async (key, title, body, date, o) => { const id = `${key}-${ymd(now)}`; if (sent[id] || date <= now) return; await programma(id, title, body, date, o); };
  // la sera prima: l'allenamento di domani nel dettaglio (si riprogramma a ogni apertura, così il testo resta aggiornato)
  if (N.domani) {
    const [hh, mm] = String(N.domani).split(":").map(Number);
    const quando = new Date(now.getFullYear(), now.getMonth(), now.getDate(), isFinite(hh) ? hh : 19, isFinite(mm) ? mm : 30);
    const id = `domani-${ymd(now)}`, P = C.domaniVisto === ymd(now) ? null : promemoriaDomani(A); // già visto nell'app stasera: niente notifica
    if (!P) {
      if (quando > now) { try { await Notification.removePending([id]); } catch (e) {} C.lista = C.lista.filter((x) => x.id !== id); delete sent[id]; }
    } else if (quando > now) await programma(id, P.titolo, P.testo, quando, { q: "domani=1", tipo: "domani", az: "domani" });
    else if (!sent[id] && now.getHours() < 23) {
      // ora è già passata: con l'app aperta lo mostra il foglio, ad app chiusa arriva adesso
      if (interattivo) { sent[id] = 1; campanaMetti(C, { id, t: now.toISOString(), tit: P.titolo, txt: P.testo, tipo: "domani", az: "domani" }, now); }
      else await programma(id, P.titolo, P.testo, new Date(Date.now() + 60 * 1000), { q: "domani=1", tipo: "domani", az: "domani" });
    }
  }
  if (N.affaticamento && A.ins.fatigue && A.ins.fatigue.level === "rosso") {
    await once("fatica", "Segnale di affaticamento", "Ultime due qualità con FC soppressa e passo peggiore. Apri l'HUD per la proposta.", new Date(Date.now() + 60 * 1000), { tipo: "fatica", az: "oggi" });
  }
  // domenica sera: la settimana è fatta, il riepilogo è pronto da condividere
  if (N.settimana !== false) {
    const dom = addDays(mondayOf(now), 6), quando = new Date(dom.getFullYear(), dom.getMonth(), dom.getDate(), 20, 30), id = `settimana-${ymd(dom)}`;
    if (!sent[id] && quando > now) await programma(id, "La tua settimana", "Ore, km e carico in un'immagine: tocca per vederla e condividerla.", quando, { q: "settimana=1", tipo: "settimana", az: "settimana" });
  }
  // tieni solo le ultime due settimane
  Object.keys(sent).forEach((k) => { if (k.slice(-10) < ymd(addDays(now, -14))) delete sent[k]; });
  fm.writeString(p, JSON.stringify(sent));
}

function siriText(A) {
  const s = A.sleep.secs ? `${Math.floor(A.sleep.secs / 3600)} ore e ${Math.round((A.sleep.secs % 3600) / 60)} minuti` : "dato non disponibile";
  const ses = A.todayEv.length ? A.todayEv.map((e) => `${e.name}, ${e.min} minuti`).join("; ") : A.gymToday ? "palestra" : "nessuna seduta";
  const ad = A.ins.adapt ? ` Proposta: ${A.ins.adapt.items.map((x) => x.prop).join("; ")}.` : "";
  return `${STATE_WORD[A.worst]}. ${A.verdict} Forma ${A.metrics.tsb === null ? "non disponibile" : Math.round(A.metrics.tsb)}. Sonno ${s}. Oggi: ${ses}.${ad}`;
}

// ---- Primo collegamento a Intervals: una pagina guidata dentro l'app, niente messaggi a comparsa
function onboardingHTML(stato) {
  stato = stato || {};
  const tab = (id, on, txt) => `<button type="button" data-w="${id}" class="${on ? "on" : ""}">${txt}</button>`;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="color-scheme" content="light dark">
<style>
:root{--bg:#F2F2F7;--card:#FFFFFF;--fill:#EFEFF4;--fg:#1D1D1F;--mut:rgba(60,60,67,.64);--acc:#E8590C;--accbg:#FF6A1A;--bad:#D70015;--good:#1F8F4E}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1C1C1E;--fill:#2C2C2E;--fg:#F5F5F7;--mut:rgba(235,235,245,.64);--acc:#FF9F45;--bad:#FF453A;--good:#30D158}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:560px;margin:0 auto;padding:calc(env(safe-area-inset-top) + 28px) 16px 48px;display:flex;flex-direction:column;gap:16px}
h1{font-size:34px;letter-spacing:-.02em;margin:0}h2{font-size:20px;margin:0;letter-spacing:-.01em}.lede{color:var(--mut);margin:0 2px;font-size:17px}
.card{background:var(--card);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px}
.num{font-size:13px;font-weight:600;color:var(--mut)}p{margin:0}.mut{color:var(--mut);font-size:14px}
ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px}b{font-weight:600}
.seg{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:2px;background:var(--fill);border-radius:10px}
.seg button{border:0;border-radius:8px;padding:8px 0;font:inherit;font-size:14px;font-weight:600;color:var(--fg);background:transparent}
.seg button.on{background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.btn{border:0;border-radius:14px;font:inherit;font-size:17px;font-weight:600;padding:15px;width:100%}
.pri{background:var(--accbg);color:#fff}.sec{background:var(--fill);color:var(--fg)}
.link{background:none;border:0;color:var(--acc);font:inherit;font-size:15px;padding:6px 0}
input{font:inherit;font-size:16px;color:var(--fg);background:var(--fill);border:0;border-radius:12px;padding:12px;width:100%}
.err{color:var(--bad);font-size:15px}.ok{color:var(--good);font-size:15px}
[hidden]{display:none!important}
</style></head><body><div class="wrap">
<h1>Benvenuto</h1>
<p class="lede">Colleghiamo il tuo orologio: due minuti, una volta sola. Poi l'app fa il resto.</p>
<div class="card">
  <div class="num">1 di 2</div><h2>Account Intervals e orologio</h2>
  <p>Intervals.icu è gratuito e raccoglie i dati del tuo orologio per l'app. Ti serve solo adesso.</p>
  <div class="seg" id="w">${tab("garmin", true, "Garmin")}${tab("coros", false, "COROS")}${tab("apple", false, "Apple Watch")}</div>
  <ol id="w-garmin"><li>Tocca <b>Apri Intervals</b> e registrati (o accedi).</li><li>Nella pagina Settings, sezione Garmin, tocca <b>Connect</b> e accetta.</li><li>Spunta <b>Download activities</b> e i dati di benessere (wellness), poi <b>Download Old Data</b>. Se c'è l'opzione per mandare gli allenamenti pianificati a Garmin, attivala.</li></ol>
  <ol id="w-coros" hidden><li>Tocca <b>Apri Intervals</b> e registrati (o accedi).</li><li>Nella pagina Settings trova COROS e collegalo, con il download delle attività attivo.</li></ol>
  <ol id="w-apple" hidden><li>Tocca <b>Apri Intervals</b> e registrati (o accedi).</li><li>Installa <b>Intervals.icu Companion</b> dall'App Store, accedi e consenti la lettura di allenamenti, battiti, variabilità cardiaca e sonno.</li></ol>
  <p class="mut">Collega l'orologio direttamente, non passando da Strava: quelle attività l'app non le può leggere.</p>
  <button class="btn sec" type="button" data-act="apri:https://intervals.icu/settings">Apri Intervals</button>
</div>
<div class="card">
  <div class="num">2 di 2</div><h2>Copia la tua chiave</h2>
  <p>Nella stessa pagina Settings scorri fino a <b>Developer Settings</b> e copia la <b>API Key</b> (se non c'è, generala). Poi torna qui.</p>
  <button class="btn pri" type="button" id="incolla" data-act="chiave:appunti">Ho copiato la chiave</button>
  <div id="stato" class="${stato.errore ? "err" : "mut"}" role="status">${esc(stato.errore || "La chiave resta solo nel Portachiavi di questo iPhone.")}</div>
  <button class="link" type="button" id="amano">Preferisco scriverla</button>
  <div id="manuale" hidden><input id="k" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="API Key"><button class="btn sec" type="button" id="kgo" style="margin-top:8px">Collega</button></div>
</div>
<button class="link" type="button" data-act="demo:">Prima voglio vedere la demo</button>
</div>
<script>
window.__q=[];
function send(m){window.__q.push(m)}
document.querySelectorAll('#w button').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('#w button').forEach(function(x){x.classList.toggle('on',x===b)});['garmin','coros','apple'].forEach(function(w){document.getElementById('w-'+w).hidden=w!==b.getAttribute('data-w')})})});
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;var a=b.getAttribute('data-act');if(a.indexOf('chiave:')===0){var s=document.getElementById('stato');s.className='mut';s.textContent='Controllo la chiave…'}send(a)});
document.getElementById('amano').addEventListener('click',function(){document.getElementById('manuale').hidden=false;document.getElementById('k').focus()});
document.getElementById('kgo').addEventListener('click',function(){var v=document.getElementById('k').value.trim();if(!v)return;var s=document.getElementById('stato');s.className='mut';s.textContent='Controllo la chiave…';send('chiave:'+v)});
window.__stato=function(t,ok){var s=document.getElementById('stato');s.className=ok?'ok':'err';s.textContent=t};
</script></body></html>`;
}

// Resta in ascolto della pagina di benvenuto finché la chiave funziona (o si sceglie la demo)
async function collegaIntervals(wv, chiusa) {
  const js = (code) => wv.evaluateJavaScript(code, false).catch(() => {});
  for (;;) {
    if (chiusa && chiusa()) return null;
    let msg;
    try { msg = await wv.evaluateJavaScript("(window.__q && window.__q.length) ? window.__q.shift() : ''", false); } catch (e) { return null; }
    if (!msg) { await attesa(250); continue; }
    const i = msg.indexOf(":"), kind = msg.slice(0, i), val = msg.slice(i + 1);
    if (kind === "apri") { Safari.open(val); continue; }
    if (kind === "demo") return null;
    if (kind !== "chiave") continue;
    let k = val;
    if (val === "appunti") { try { k = (Pasteboard.paste() || "").trim(); } catch (e) { k = ""; } }
    k = String(k || "").trim();
    if (!/^\S{8,200}$/.test(k)) {
      await js(`window.__stato(${JSON.stringify(val === "appunti" ? "Negli appunti non c'è una chiave. In Intervals copia la API Key e tocca di nuovo il pulsante." : "Non sembra una chiave di Intervals: controlla di averla copiata tutta.")})`);
      continue;
    }
    try {
      const atleta = await ivRichiesta(k, "GET", ""); // l'atleta della chiave: conferma che funziona
      Keychain.set(KEY_NAME, k);
      await js(`window.__stato(${JSON.stringify("Collegato" + (atleta && atleta.name ? " come " + atleta.name : "") + ". Carico i tuoi dati…")}, true)`);
      return { key: k, atleta: atleta && atleta.id ? { id: atleta.id, nome: atleta.name || "" } : null };
    } catch (e) {
      await js(`window.__stato(${JSON.stringify(/\b(401|403)\b/.test(String(e.message || e)) ? "Intervals non ha accettato la chiave: copiala di nuovo e riprova." : "Intervals non risponde: controlla la connessione e riprova.")})`);
    }
  }
}

// Registro dell'ultima apertura in iCloud › Scriptable › hud-log.txt: dice dove si ferma se qualcosa va storto
const REG = [];
// Tempi dell'apertura, fase per fase: le ultime 20 aperture in hud-tempi.json (sul telefono), visibili in Impostazioni › Diagnostica
const PERF = { t0: Date.now(), fasi: [] };
function tempo(fase) { const ms = Date.now() - PERF.t0; PERF.fasi.push([fase, ms]); registro(`${fase}: ${ms} ms`); }
const TEMPI_FILE = "hud-tempi.json";
function leggiTempi() { try { const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), TEMPI_FILE); return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : []; } catch (e) { return []; } }
function salvaTempi(dove) {
  try {
    const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), TEMPI_FILE);
    const L = leggiTempi(); L.push({ t: new Date().toISOString(), v: VERSIONE, dove, fasi: PERF.fasi });
    fm.writeString(p, JSON.stringify(L.slice(-20)));
  } catch (e) {}
}
function registro(m) {
  if (typeof config !== "undefined" && config.runsInWidget) return; // il widget non sovrascrive il registro dell'app
  REG.push(`${new Date().toISOString().slice(11, 19)} ${m}`);
  try { const fm = FileManager.iCloud(); fm.writeString(fm.joinPath(fm.documentsDirectory(), "hud-log.txt"), REG.join("\n") + "\n"); } catch (e) {}
}

// Versione di iOS e modello: per i commenti e le segnalazioni
function infoDispositivo() { try { return `iOS ${Device.systemVersion()} · ${Device.model()}`; } catch (e) { return "iOS sconosciuto"; } }
// Il testo allegato ai commenti: registro dell'ultima apertura e tempi delle ultime 20 (senza chiavi né dati di salute)
function diagnosticaTesto() {
  const t = leggiTempi().map((x) => `${x.t} ${x.v} ${x.dove}: ${x.fasi.map((f) => f[0] + "=" + f[1]).join(" ")}`).join("\n");
  return `HUD ${VERSIONE} · ${infoDispositivo()}\n\nRegistro dell'ultima apertura\n${REG.join("\n")}\n\nTempi (ms dall'avvio)\n${t}`;
}

async function run() {
  const now = new Date();
  registro(`avvio ${VERSIONE}${config.runsInWidget ? " (widget)" : config.runsWithSiri ? " (Comandi Rapidi)" : ""}`);
  try { registro(`iOS ${Device.systemVersion()}`); } catch (e) {}
  // Comando Rapido «Peso HUD»: riceve le pesate da Salute, le salva e chiude (niente Intervals, niente voce)
  const par = typeof args !== "undefined" && args ? args.shortcutParameter : null;
  if (par !== null && par !== undefined && par !== "") {
    const io = diaryIO(), dia = io.read();
    const xs = importaPesi(dia, par, now);
    if (xs.length) io.write(dia);
    const u = xs[xs.length - 1];
    const out = u ? `Peso salvato nell'HUD: ${fmtIt(u.kg, 1)} kg del ${parseYMD(u.d).getDate()} ${MESI_BREVI[parseYMD(u.d).getMonth()]}${xs.length > 1 ? ` (${xs.length} pesate)` : ""}.` : `Nessun peso trovato in quello che ho ricevuto: ${String(JSON.stringify(par)).slice(0, 120)}`;
    console.log(out);
    registro(out);
    Script.setShortcutOutput(out);
    Script.complete();
    return;
  }
  applicaProfilo(await leggiProfilo());
  tempo("profilo");
  if (CONFIG.resetChiave && Keychain.contains(KEY_NAME)) Keychain.remove(KEY_NAME);
  let key = Keychain.contains(KEY_NAME) ? Keychain.get(KEY_NAME) : null;
  const interattivo = !config.runsInWidget && !config.runsWithSiri;
  let wv = null, presenting = null, atleta = null, chiusa = false;
  const mostra = async (html) => {
    if (!wv) {
      wv = new WebView(); await wv.loadHTML(html, "https://intervals.icu");
      await wv.evaluateJavaScript("window.__inScriptable=true", false).catch(() => {});
      presenting = wv.present(true);
      presenting.then(() => { chiusa = true; }, () => { chiusa = true; });
    } else {
      await wv.loadHTML(html, "https://intervals.icu");
      await wv.evaluateJavaScript("window.__inScriptable=true", false).catch(() => {});
    }
  };
  const collega = async (stato) => {
    await mostra(onboardingHTML(stato));
    const r = await collegaIntervals(wv, () => chiusa);
    if (r) { key = r.key; atleta = r.atleta; } else key = null;
  };

  // Prima volta: pagina di benvenuto per collegare Intervals
  if (!key && interattivo) await collega({});

  let raw, primaVolta = true;
  if (!key) raw = demoData(now);
  else {
    const cache = cacheIO();
    let prev = null; try { prev = cache.read(); } catch (e) {}
    primaVolta = !prev;
    try {
      try { raw = await fetchIntervals(key, now, prev); }
      catch (err) {
        // chiave non più valida: si ricollega dalla pagina di benvenuto
        if (interattivo && /\b(401|403)\b/.test(String(err.message || err))) {
          Keychain.remove(KEY_NAME);
          await collega({ errore: "La chiave salvata non funziona più: copiala di nuovo da Intervals." });
          if (!key) throw err;
          raw = await fetchIntervals(key, now, null);
        } else throw err;
      }
      if (prev && prev.curve && !raw.curve) raw.curve = prev.curve; // le curve si rileggono una volta al giorno
      cache.write(raw);
    } catch (err) {
      const old = cache.read();
      if (old) raw = { ...old, stale: true };
      else if (interattivo && key) {
        const a = new Alert();
        a.title = "Intervals non raggiungibile";
        a.message = String(err.message || err) + "\n\nControlla la connessione e riapri l'app.";
        a.addAction("Mostra demo");
        await a.presentAlert();
        raw = demoData(now);
      } else raw = demoData(now);
    }
  }
  // chi è su Intervals: serve per "Avvisa chi ti ha dato l'app" e per proporre il nome
  if (atleta) { raw.atleta = atleta; if (PROF) { PROF.intervals = atleta; scriviProfilo(PROF); } }
  // soglie: le stime migliori vanno su Intervals prima di tutto il resto, così pagina e sedute usano i valori nuovi
  if (interattivo && key) {
    try { const fatti = await aggiornaSoglie(key, raw, now); if (fatti.length) { cacheIO().write(raw); raw.soglieAggiornate = fatti.filter((c) => c.testo).map((c) => c.testo); } }
    catch (e) { console.log("Soglie: " + (e.message || e)); }
  }
  // curve dei migliori: solo per la vista completa, una volta al giorno
  if (interattivo && key && !raw.stale && !raw.demo && PROF && PROF.vista === "completa" && (!raw.curve || raw.curve.d !== ymd(now))) {
    try { raw.curve = await curveIntervals(key, now); cacheIO().write(raw); } catch (e) { console.log("Curve: " + (e.message || e)); }
  }
  CURVA_CP = raw.curve && raw.curve.potenza && raw.curve.potenza.cp && raw.curve.potenza.wp ? { cp: raw.curve.potenza.cp, wp: raw.curve.potenza.wp } : null;
  // Comandi Rapidi che aprono l'HUD con un link: ?cibo=… (quello che hai detto a Siri), ?pesi=… (Salute), ?settimana=1 (notifica)
  const qp = (typeof args !== "undefined" && args && args.queryParameters) || {};
  let apertura = null;
  if (qp.settimana) apertura = { vista: "trend", toast: "La tua settimana", condividi: "riepilogo" };
  if (qp.domani) apertura = { domani: true }; // dalla notifica della sera
  if (qp.att && /^\d{4}-\d\d-\d\d$/.test(qp.att)) apertura = { att: qp.att }; // dalla notifica di una seduta sincronizzata
  // Comando Rapido «Codice HUD»: ?codice=… (il codice a barre inquadrato), il prodotto da Open Food Facts
  if (key && qp.codice) apertura = { vista: "fuel", prodotto: await prodottoOFF(qp.codice), toast: "Codice letto" };
  if (key && (qp.pesi || qp.cibo)) {
    const io = diaryIO(), dia = io.read();
    if (qp.pesi) {
      const xs = importaPesi(dia, qp.pesi, now);
      if (xs.length) io.write(dia);
      const u = xs[xs.length - 1];
      apertura = { vista: "fuel", toast: u ? `Peso salvato: ${fmtIt(u.kg, 1)} kg` : "Nessun peso trovato in Salute" };
    }
    if (qp.cibo) {
      const r = registraCibo(dia, qp.cibo, now);
      if (r.voce) io.write(dia);
      apertura = { vista: "fuel", cibo: r, toast: r.voce ? `Segnato · ${fmtIt(totaleCibo([r.voce]).kcal)} kcal` : "Non ho riconosciuto cibi" };
    }
  }
  tempo("dati");
  registro(`dati ${raw.demo ? "demo" : raw.stale ? "dalla cache" : raw.fullAt === raw.fetchedAt ? "da Intervals (completi)" : "da Intervals (solo le novità)"}: ${(raw.activities || []).length} attività`);
  DETTAGLI = key ? dettagliIO().read() : {};
  // attività appena arrivate: corse e nuotate in piscina si leggono subito, così un record si vede già a questa apertura
  if (key && !config.runsInWidget && !config.runsWithSiri && !raw.stale && !raw.demo && Array.isArray(raw.nuove) && raw.nuove.length) {
    const nuove = (raw.activities || []).filter((a) => raw.nuove.includes(a.id) && !DETTAGLI[a.id] && ((sportOf(a.type) === "corsa" && (num(a.distance) || 0) >= 1000) || (a.type === "Swim" && (num(a.distance) || 0) >= 100))).slice(0, 3);
    if (nuove.length) { try { const n = await scaricaDettagli(key, nuove, DETTAGLI, true); if (n) { potaDettagli(DETTAGLI, raw, now); dettagliIO().write(DETTAGLI); } } catch (e) { registro("nuove attività: " + e); } }
  }
  // Sedute dell'app doppie o di un piano vecchio: via dal calendario (alla prima apertura del giorno si legge tutto il piano)
  let doppie = [];
  if (key && PROF && interattivo && !raw.stale && !raw.demo) {
    try {
      const C0 = campanaIO().read(), oggi = ymd(now);
      let cal = raw.events || [];
      if (C0.pulizia !== oggi) { try { cal = await ivRichiesta(key, "GET", `/events?oldest=${oggi}&newest=${ymd(addDays(now, 140))}`, undefined, 20); } catch (e) { registro("calendario non letto: " + (e.message || e)); } }
      doppie = await pulisciCalendario(key, PROF, cal, now);
      if (C0.pulizia !== oggi) { C0.pulizia = oggi; campanaIO().write(C0); }
      if (doppie.length) {
        const via = new Set(doppie.map((e) => String(e.id)));
        raw.events = (raw.events || []).filter((e) => !via.has(String(e.id)));
        try { cacheIO().write(raw); } catch (e) {}
      }
    } catch (e) { registro("pulizia del calendario: " + (e.message || e)); }
  }
  let A = analyze(raw, now, key ? diaryIO().read() : raw.diary);
  tempo("analisi");

  // Orari del rifornimento nei lunghi su Intervals, e da lì sull'orologio (solo quando apri l'app)
  let avvisiScritti = [];
  if (!config.runsInWidget && !config.runsWithSiri) {
    try { avvisiScritti = await scriviAvvisi(raw, A, key, now); } catch (e) { registro("avvisi: " + e); }
    if (avvisiScritti.length) { try { cacheIO().write(raw); } catch (e) {} A = analyze(raw, now, diaryIO().read()); }
  }

  if (key && !raw.stale && !config.runsInWidget && consolidaGear(A.diary, raw, now)) { try { diaryIO().write(A.diary); } catch (e) {} }
  // Record: si ricordano, così ci si accorge del prossimo miglioramento (alla prima apertura senza festeggiare)
  let nuoviRecord = [];
  if (key && A.record && !config.runsInWidget && !raw.stale) {
    nuoviRecord = A.record.nuovi || [];
    if (JSON.stringify(A.diary.record || null) !== JSON.stringify(A.record.mappa)) { A.diary.record = A.record.mappa; try { diaryIO().write(A.diary); } catch (e) {} }
    if (nuoviRecord.length) registro(`nuovi record: ${nuoviRecord.map((r) => r.nome).join(", ")}`);
  }

  // Esporta i dati in iCloud Drive › Scriptable › hud-dati.json per la versione da PC
  if (key && !raw.stale) {
    try {
      const ic = FileManager.iCloud(), fx = ic.joinPath(ic.documentsDirectory(), "hud-dati.json");
      const recente = (() => { try { return ic.fileExists(fx) && now - ic.modificationDate(fx) < 30 * 60000; } catch (e) { return false; } })();
      if (!recente) ic.writeString(fx, JSON.stringify({ versione: 4, esportato: new Date().toISOString(), nome: PROF && PROF.nome, config: CONFIG, profilo: PROF, diary: A.diary, raw }));
    } catch (e) { console.log("Esportazione per il PC non riuscita: " + e); }
  }

  // Campana: notifiche del telefono, record, avvisi sull'orologio, sedute arrivate, scarpe da cambiare
  const C = key ? campanaIO().read() : { lista: [] }; CAMPANA = C;
  try {
    if (key && !raw.stale && !raw.demo) await campanaAttivita(raw, C, now, interattivo, primaVolta);
    if (doppie.length) campanaMetti(C, { id: `doppie-${ymd(now)}-${doppie.length}`, t: now.toISOString(), tit: "Calendario sistemato", txt: `Tolte ${doppie.length} ${doppie.length === 1 ? "seduta dell'app doppia" : "sedute dell'app doppie"} o di un piano vecchio. Le tue sedute non sono state toccate.`, tipo: "info", az: "sett" }, now);
    for (const r of nuoviRecord) campanaMetti(C, { id: `rec-${r.k}-${r.d || ""}`, t: now.toISOString(), tit: `Nuovo record: ${r.nome}`, txt: `${fmtDur2(r.sec)}${r.meglio ? ` · ${fmtStepDur(r.meglio)} meglio di prima` : ""}${r.att ? ` · ${r.att}` : ""}`, tipo: "record", az: "record" }, now);
    const conAvv = avvisiScritti.filter((x) => x.avvisi);
    if (conAvv.length) campanaMetti(C, { id: `orologio-${ymd(now)}-${conAvv.map((x) => x.id).join("-")}`, t: now.toISOString(), tit: "Rifornimento sull'orologio", txt: conAvv.map((x) => { const q = parseYMD(x.d); return `${x.nome} (${GIORNI[q.getDay()].slice(0, 3).toLowerCase()} ${q.getDate()}): ${x.n} avvisi`; }).join("\n"), tipo: "orologio", az: "sett" }, now);
    for (const g of (A.gear || []).filter((x) => !x.ritirata && x.pct !== null && x.pct >= 1)) if (!C.lista.some((x) => x.id === `gear-${g.id}`)) campanaMetti(C, { id: `gear-${g.id}`, t: now.toISOString(), tit: `${g.tipo === "bici" ? "Bici" : "Scarpe"} da controllare: ${g.nome}`, txt: `${fmtIt(g.km)} km su ${fmtIt(g.limite)} previsti.`, tipo: "gear", az: "trend" }, now);
  } catch (e) { registro("campana: " + e); }
  if (key && !raw.demo && !A.needSetup) { try { await scheduleNotifs(A, C, interattivo); } catch (e) { console.log("Notifiche: " + e); } }
  if (key) campanaIO().write(C);
  // la sera (dalle 18), alla prima apertura: il foglio con l'allenamento di domani
  const sera = !!key && interattivo && !apertura && !A.needSetup && !raw.demo && now.getHours() >= 18 && C.domaniVisto !== ymd(now) && !!promemoriaDomani(A);

  if (config.runsWithSiri) {
    const txt = siriText(A);
    Speech.speak(txt);
    Script.setShortcutOutput(txt);
    Script.complete();
    return;
  }

  if (config.runsInWidget) {
    Script.setWidget(buildWidget(A));
    tempo("widget");
    salvaTempi("widget");
  } else {
    let html;
    A.tempi = { ora: PERF.fasi.slice(), storico: leggiTempi() };
    try { html = buildHTML(A); tempo("pagina"); registro(`pagina: ${html.length} caratteri`); }
    catch (e) {
      registro(`ERRORE nella pagina: ${e && e.stack ? e.stack : e}`);
      const a = new Alert(); a.title = "Errore nell'HUD"; a.message = String(e && e.message ? e.message : e).slice(0, 400); a.addAction("OK"); await a.presentAlert();
      Script.complete();
      return;
    }
    await mostra(html);
    tempo("mostrata");
    salvaTempi("app");
    if (apertura && (apertura.domani || apertura.att)) {
      await attesa(400);
      if (apertura.domani) await wv.evaluateJavaScript("window.__domani && window.__domani()", false).catch(() => {});
      else await wv.evaluateJavaScript(`window.__apriAtt && window.__apriAtt(${JSON.stringify(apertura.att)})`, false).catch(() => {});
    } else if (apertura) {
      // aperto da Siri o da un'automazione: Carburante, con il riepilogo detto a voce
      await attesa(500);
      await wv.evaluateJavaScript(`window.__apri && window.__apri(${JSON.stringify(apertura.vista)}); window.__toast && window.__toast(${JSON.stringify(apertura.toast)})`, false).catch(() => {});
      if (apertura.prodotto) await wv.evaluateJavaScript(`window.__prodotto && window.__prodotto(${JSON.stringify(apertura.prodotto).replace(/</g, "\\u003c")})`, false).catch(() => {});
      if (apertura.condividi) await wv.evaluateJavaScript(`OPT.week=0;OPT.rec=null;setLayout(${JSON.stringify(apertura.condividi)});openSheet()`, false).catch(() => {});
      if (apertura.cibo) {
        const T = A.nutrition.cibo.tot, PN = A.nutrition.piano, r = apertura.cibo;
        const frase = r.voce ? `Segnato ${fmtIt(totaleCibo([r.voce]).kcal)} chilocalorie. Oggi sei a ${fmtIt(T.kcal)} su ${fmtIt(PN.kcal)}, con ${fmtIt(T.C)} grammi di carboidrati su ${fmtIt(PN.C)}.${r.ignoti.length ? ` Non ho capito: ${r.ignoti.join(", ")}.` : ""}` : "Non ho riconosciuto i cibi. Riprova dicendo, per esempio, centottanta grammi di pasta.";
        try { Speech.speak(frase); } catch (e) {}
      }
    }
    if (!apertura && doppie.length && !nuoviRecord.length) {
      await attesa(500);
      await wv.evaluateJavaScript(`window.__toast && window.__toast(${JSON.stringify(`Calendario sistemato: tolte ${doppie.length} sedute doppie`)})`, false).catch(() => {});
    } else if (!apertura && nuoviRecord.length) {
      await attesa(500);
      const r0 = nuoviRecord[0], msg = `Nuovo record: ${r0.nome} in ${fmtDur2(r0.sec)}${nuoviRecord.length > 1 ? ` (+${nuoviRecord.length - 1})` : ""}`;
      await wv.evaluateJavaScript(`window.__toast && window.__toast(${JSON.stringify(msg)})`, false).catch(() => {});
    } else if (!apertura && avvisiScritti.length) {
      await attesa(500);
      const conAvv = avvisiScritti.filter((x) => x.avvisi), soloZone = avvisiScritti.filter((x) => x.zone && !x.avvisi);
      const msg = conAvv.length ? (conAvv.length === 1 ? `Rifornimento sull'orologio: ${conAvv[0].nome}` : `Rifornimento sull'orologio: ${conAvv.length} sedute`) : `Bici sull'orologio: zone di frequenza cardiaca${soloZone.length > 1 ? ` (${soloZone.length} sedute)` : ""}`;
      await wv.evaluateJavaScript(`window.__toast && window.__toast(${JSON.stringify(msg)})`, false).catch(() => {});
    }
    if (sera) { await attesa(nuoviRecord.length || avvisiScritti.length ? 900 : 400); await wv.evaluateJavaScript("window.__domani && window.__domani()", false).catch(() => {}); }
    if (key && !raw.stale) completaStorico(key, raw, now).catch((e) => registro("storico: " + e)); // in sottofondo, mentre guardi la pagina
    shareLoop(wv, { key, raw, now, atleta, chiusa: () => chiusa }); // non bloccante: resta in ascolto dei pulsanti della pagina
    await presenting;
  }
  Script.complete();
}

if (typeof Script !== "undefined") {
  await run();
} else if (typeof module !== "undefined") {
  module.exports = { analyze, buildHTML, demoData, CONFIG };
}
