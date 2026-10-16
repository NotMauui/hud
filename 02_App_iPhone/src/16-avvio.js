// ------------------------------------------------------------
//  Avvio
// ------------------------------------------------------------
function cacheIO() {
  const fm = FileManager.local();
  const p = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
  return {
    read: () => (fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null),
    write: (o) => fm.writeString(p, JSON.stringify(o)),
  };
}

// Ponte tra la pagina e iOS: condivisione, diario, configurazione, piano, commenti
// Ascolta i pulsanti della pagina. La pagina mette i messaggi in coda (window.__q) e qui si leggono ogni 250 ms:
// una chiamata con callback lasciata in sospeso, come prima, su iOS 26 lascia la WebView nera.
const attesa = (ms) => new Promise((r) => Timer.schedule(ms, false, r));
async function shareLoop(wv, ctx) {
  ctx = ctx || {};
  const js = (code) => wv.evaluateJavaScript(code, false).catch(() => {});
  const ricarica = async (msgToast) => {
    const A = analyze(ctx.raw, ctx.now, ctx.key ? diaryIO().read() : ctx.raw.diary);
    await wv.loadHTML(buildHTML(A), "https://intervals.icu");
    await js("window.__inScriptable=true");
    if (msgToast) await js(`window.__toast(${JSON.stringify(msgToast)})`);
  };
  await attesa(600); // prima lascia disegnare la pagina
  for (;;) {
    if (ctx.chiusa && ctx.chiusa()) return;
    let msg;
    try { msg = await wv.evaluateJavaScript("(window.__q && window.__q.length) ? window.__q.shift() : ''", false); } catch (e) { return; }
    if (!msg) { await attesa(250); continue; }
    const i = msg.indexOf(":");
    const kind = msg.slice(0, i), b64 = msg.slice(i + 1);
    if (kind === "save") {
      try { diaryIO().write(JSON.parse(b64)); } catch (e) { console.log("Diario non salvato: " + e); }
      continue;
    }
    if (kind.startsWith("salute")) {
      // infortunio o malattia: salva, applica o annulla le sedute adattate, rientro, guarito
      try {
        const dia = diaryIO().read(), oggi = ymd(new Date());
        let msg = null, riapri = true;
        if (kind === "salute") {
          const o = JSON.parse(b64), S0 = saluteDi(dia);
          const S = { tipo: o.tipo === "malattia" ? "malattia" : "infortunio", dal: /^\d{4}-\d\d-\d\d$/.test(o.dal || "") && o.dal <= oggi ? o.dal : oggi, aggiornato: new Date().toISOString() };
          if (S.tipo === "infortunio") { S.zona = ZONE_INF[o.zona] ? o.zona : "altro"; S.dolore = Math.max(0, Math.min(10, Math.round(+o.dolore || 0))); S.riposo = !!o.riposo; }
          else { S.sintomi = o.sintomi === "sotto" ? "sotto" : "sopra"; S.febbre = !!o.febbre; }
          // stesso episodio: le sedute già cambiate restano tracciate (si possono rimettere)
          if (S0 && S0.tipo === S.tipo) { S.modifiche = S0.modifiche || []; if (S0.applicata) S.applicata = S0.applicata; if (S0.passati && S.tipo === "malattia") S.passati = S0.passati; }
          dia.salute = S; msg = "Salvato";
        } else if (kind === "saluteMeglio") {
          if (dia.salute && !dia.salute.guarito) { dia.salute.passati = oggi; delete dia.salute.applicata; msg = "Rientro graduale"; }
        } else if (kind === "saluteFine") {
          if (dia.salute) { dia.salute.guarito = oggi; dia.saluteStoria = [...(dia.saluteStoria || []), { ...dia.salute, modifiche: undefined }].slice(-20); delete dia.salute; }
          msg = "Bentornato: piano normale"; riapri = false;
        } else if (kind === "saluteApplica" || kind === "saluteAnnulla") {
          if (!ctx.key || ctx.raw.stale) msg = "Serve internet per cambiare le sedute";
          else if (kind === "saluteAnnulla") { const n = await annullaSalute(ctx.key, ctx.raw, dia); msg = `Rimesse ${n} sedute com'erano`; }
          else {
            const A0 = analyze(ctx.raw, ctx.now, dia), K = A0.salute;
            const n = K && K.puoApplicare && K.proposta.length ? await applicaSalute(ctx.key, K, K.proposta, ctx.raw, dia) : 0;
            msg = n ? `Sedute adattate su Intervals: ${n}` : "Nessuna seduta cambiata";
          }
          try { cacheIO().write(ctx.raw); } catch (e) {}
        }
        diaryIO().write(dia);
        await ricarica(msg);
        if (riapri) await js("window.__salute && window.__salute()");
      } catch (e) { console.log("Salute: " + e); await js(`window.__toast(${JSON.stringify("Non riuscito: " + (e.message || e))})`); }
      continue;
    }
    if (kind === "apri") {
      // solo le ricerche dei video degli esercizi su YouTube
      if (/^https:\/\/www\.youtube\.com\/results\?search_query=[^\s]{1,200}$/.test(b64)) { try { Safari.open(b64); } catch (e) {} }
      continue;
    }
    if (kind === "gymPiano") {
      try {
        if (!ctx.key || ctx.raw.stale) throw new Error("serve internet");
        if (ctx.raw.demo || (PROF && PROF.pianoApp === false)) throw new Error("con il tuo piano l'app non scrive su Intervals");
        const r = await palestraNelPiano(ctx.key, JSON.parse(b64), ctx.raw);
        try { cacheIO().write(ctx.raw); } catch (e) {}
        const q = parseYMD(r.data);
        await ricarica(`${r.nuovo ? "Aggiunta" : "Aggiornata"} su Intervals: ${GIORNI[q.getDay()].toLowerCase()} ${q.getDate()}`);
      } catch (e) { console.log("Palestra nel piano: " + e); await js(`window.__toast(${JSON.stringify("Non aggiunta: " + (e.message || e))})`); await js("var b=document.getElementById('gp-ok');if(b){b.disabled=false;b.textContent='Aggiungi a Intervals'}"); }
      continue;
    }
    if (kind === "campana" || kind === "domani") {
      // campana aperta: tutto letto; foglio di domani visto: stasera non si ripropone
      try {
        const io = campanaIO(), C = io.read(), t = new Date();
        if (kind === "campana") campanaSegnaLette(C, t);
        else {
          // visto nell'app: la notifica di stasera non serve più
          C.domaniVisto = ymd(t); campanaSegnaLette(C, t, (x) => x.tipo === "domani");
          C.lista = C.lista.filter((x) => !(x.tipo === "domani" && new Date(x.t) > t));
          try { await Notification.removePending([`domani-${ymd(t)}`]); } catch (e) {}
        }
        io.write(C); CAMPANA = C;
      } catch (e) { console.log("Campana: " + e); }
      continue;
    }
    if (kind === "cibo") {
      try {
        const dia = diaryIO().read(), r = registraCibo(dia, b64, new Date());
        if (r.voce) { diaryIO().write(dia); await ricarica(`Segnato · ${fmtIt(totaleCibo([r.voce]).kcal)} kcal`); }
        else { await js(`window.__toast(${JSON.stringify("Non ho riconosciuto cibi")})`); await js("var b=document.getElementById('cibook');if(b){b.disabled=false;b.textContent='Segna'}"); }
      } catch (e) { console.log("Cibo non salvato: " + e); }
      continue;
    }
    if (kind === "attg") {
      // la scheda Attività chiede un giorno che non era nella pagina
      try {
        const D = datiAttivita(ctx.raw, diaryIO().read(), ctx.now, DETTAGLI, [b64]);
        await js(`window.__giornoAtt && window.__giornoAtt(${JSON.stringify({ g: b64, att: D.att[b64] || [], ctx: D.ctx[b64] || {}, det: D.det })})`);
      } catch (e) { console.log("Giorno non caricato: " + e); }
      continue;
    }
    if (kind === "att") {
      // la scheda Attività chiede grafici, percorso e giri: dal file, sennò da Intervals
      try {
        const ids = b64.split(",").filter(Boolean), acts = (ctx.raw.activities || []).filter((a) => ids.includes(String(a.id)));
        if (ctx.key && !ctx.raw.stale) { const n = await scaricaDettagli(ctx.key, acts, DETTAGLI); if (n) { potaDettagli(DETTAGLI, ctx.raw, ctx.now); dettagliIO().write(DETTAGLI); registro(`dettagli di ${n} attività`); } }
        const out = {}; for (const a of acts) out[a.id] = DETTAGLI[a.id] || { v: DET_VER, id: a.id, s: {}, vuoto: true };
        await js(`window.__dettagli && window.__dettagli(${JSON.stringify(out)})`);
      } catch (e) { console.log("Dettagli non scaricati: " + e); }
      continue;
    }
    if (kind === "cibodel") {
      try {
        const dia = diaryIO().read(), g = ymd(new Date());
        if (dia.cibo && dia.cibo[g]) dia.cibo[g] = dia.cibo[g].filter((e) => e.id !== b64);
        diaryIO().write(dia); await ricarica("Tolto");
      } catch (e) { console.log("Cibo non tolto: " + e); }
      continue;
    }
    if (kind === "lungo") {
      // lungo segnato: stomaco e sudore cambiano dosi, acqua e sodio dei prossimi
      try { diaryIO().write(JSON.parse(b64)); await ricarica("Lungo salvato: rifornimento aggiornato"); } catch (e) { console.log("Lungo non salvato: " + e); }
      continue;
    }
    if (kind === "gear") {
      try { const dia = diaryIO().read(); dia.gear = pulisciGear(JSON.parse(b64)); diaryIO().write(dia); await ricarica("Attrezzatura salvata"); } catch (e) { console.log("Attrezzatura non salvata: " + e); }
      continue;
    }
    if (kind === "peso") {
      // pesata del giorno: nel diario e subito nel piano (media, ritmo, calorie)
      try { diaryIO().write(JSON.parse(b64)); await ricarica("Peso salvato: piano aggiornato"); } catch (e) { console.log("Peso non salvato: " + e); }
      continue;
    }
    if (kind === "setup") {
      try {
        const nuovo = JSON.parse(b64);
        const vecchio = PROF || {};
        const P = { ...vecchio, ...nuovo, versione: 1, aggiornato: new Date().toISOString() };
        // i campi che il modulo non mostra (per esempio ctlGara) restano; se cambia la distanza si ricalcola
        if (vecchio.gara && nuovo.gara) { P.gara = { ...vecchio.gara, ...nuovo.gara }; if (vecchio.gara.tipo !== nuovo.gara.tipo) delete P.gara.ctlGara; }
        if (vecchio.corpo && nuovo.corpo) P.corpo = { ...vecchio.corpo, ...nuovo.corpo };
        if (!P.creato) P.creato = P.aggiornato;
        if (ctx.atleta && !P.intervals) P.intervals = ctx.atleta;
        const primaVolta = !PROF;
        let tolte = 0;
        if (P.pianoApp === false && vecchio.pianoApp !== false && ctx.key) {
          const oggi = ymd(ctx.now || new Date());
          try {
            const cal = await ivRichiesta(ctx.key, "GET", `/events?oldest=${oggi}&newest=${ymd(addDays(parseYMD(oggi), 140))}`);
            tolte = await togliSedute(ctx.key, seduteDaTogliere(cal, { oggi, tutte: true }));
          } catch (e) { console.log("Sedute dell'app non tolte: " + e); }
          if (P.piano && Array.isArray(P.piano.ids)) P.piano = { ...P.piano, ids: P.piano.ids.filter((id) => !(String(id).startsWith("hud-") && String(id).slice(4, 14) >= oggi)) };
        }
        scriviProfilo(P);
        applicaProfilo(P);
        // con il profilo pronto le soglie stimate vanno su Intervals prima del piano: le sedute nascono con gli obiettivi giusti
        if (ctx.key && ctx.raw) {
          try { const f = await aggiornaSoglie(ctx.key, ctx.raw, ctx.now); if (f.length) { ctx.raw.soglieAggiornate = f.filter((c) => c.testo).map((c) => c.testo); completaSoglieDi(ctx.raw); } }
          catch (e) { console.log("Soglie: " + (e.message || e)); }
        }
        if (primaVolta && P.pianoApp !== false && ctx.key) {
          // prima volta: niente giri, si passa subito all'anteprima del piano
          await ricarica(null);
          try {
            ctx.piano = creaPiano(PROF, ctx.raw, ctx.now, false);
            let conflitti = 0;
            try { conflitti = await contaConflitti(ctx.key, ctx.piano); } catch (e) {}
            await js(`window.__planPreview(${JSON.stringify(anteprimaPiano(ctx.piano, conflitti)).replace(/</g, "\\u003c")})`);
          } catch (e) { await js(`window.__toast(${JSON.stringify("Fatto. Crea il piano dalla scheda Settimana")})`); }
        } else await ricarica(primaVolta && P.pianoApp !== false ? "Fatto. Crea il piano dalla scheda Settimana"
          : P.pianoApp === false && primaVolta ? "Fatto: l'app legge il tuo piano. In Impostazioni tocca Avvisa"
          : tolte ? `Impostazioni salvate: tolte ${tolte} sedute future dell'app` : "Impostazioni salvate");
      } catch (e) { await js(`window.__setupError(${JSON.stringify("Non sono riuscito a salvare: " + (e.message || e))})`); }
      continue;
    }
    if (kind === "plan") {
      if (!ctx.key || !PROF) { await js(`window.__planError(${JSON.stringify("Serve la chiave di Intervals e la configurazione completata.")})`); continue; }
      try {
        if (b64 === "scrivi") {
          if (!ctx.piano) throw new Error("Prima crea l'anteprima del piano.");
          const n = await scriviPiano(ctx.key, PROF, ctx.piano, ctx.now);
          ctx.piano = null;
          try { ctx.raw = await fetchIntervals(ctx.key, ctx.now); cacheIO().write(ctx.raw); } catch (e) { console.log("Rilettura dopo il piano: " + e); }
          await ricarica(`${n} sedute scritte nel calendario`);
          if (!PROF.avvisato) await js("window.__avvisa && window.__avvisa()");
        } else {
          ctx.piano = creaPiano(PROF, ctx.raw, ctx.now, b64 === "prossimo");
          let conflitti = 0;
          try { conflitti = await contaConflitti(ctx.key, ctx.piano); } catch (e) { console.log("Calendario non letto: " + e); }
          await js(`window.__planPreview(${JSON.stringify(anteprimaPiano(ctx.piano, conflitti)).replace(/</g, "\\u003c")})`);
        }
      } catch (e) { await js(`window.__planError(${JSON.stringify(String(e.message || e))})`); }
      continue;
    }
    if (kind === "avvisa") {
      try {
        let at = ctx.atleta || (PROF && PROF.intervals) || null;
        if (!at && ctx.key) { try { const r = await ivRichiesta(ctx.key, "GET", ""); if (r && r.id) at = { id: r.id, nome: r.name || "" }; } catch (e) {} }
        const m = new Mail();
        m.toRecipients = CONFIG.feedbackEmail ? [CONFIG.feedbackEmail] : [];
        m.subject = `${CONFIG.nomeApp} · ${PROF && PROF.nome ? PROF.nome : "nuovo tester"} è pronto`;
        m.body = `Ciao! Ho installato l'app e scritto il mio piano.\n\nSu Intervals sono: ${at ? `${at.nome || "—"} (id ${at.id})` : "—"}\nAggiungimi al gruppo dei tester.\n\n—\nVersione ${VERSIONE}`;
        await m.send();
        if (PROF) { PROF.avvisato = new Date().toISOString(); if (at) PROF.intervals = at; scriviProfilo(PROF); }
        await js(`window.__toast(${JSON.stringify("Fatto. Quando ti aggiunge, accetta l'invito su Intervals")})`);
      } catch (e) { await js(`window.__toast(${JSON.stringify(CONFIG.feedbackEmail ? "Mail non disponibile: scrivi a " + CONFIG.feedbackEmail : "Mail non disponibile su questo iPhone")})`); }
      continue;
    }
    if (kind === "feedback") {
      try {
        const m = new Mail();
        m.toRecipients = CONFIG.feedbackEmail ? [CONFIG.feedbackEmail] : [];
        m.subject = `${CONFIG.nomeApp} · commento (versione ${VERSIONE})`;
        m.body = `Scrivi qui cosa ti piace, cosa non funziona o cosa manca:\n\n\n\n—\nVersione ${VERSIONE} · ${PROF && PROF.nome ? PROF.nome : "tester"} · ${ymd(new Date())}\n${infoDispositivo()}\nIn allegato il registro dell'ultima apertura e i tempi (nessuna chiave, nessun dato di salute).`;
        try { m.addDataAttachment(Data.fromString(diagnosticaTesto()), "text/plain", "hud-diagnostica.txt"); } catch (e) {}
        await m.send();
      } catch (e) { await js(`window.__toast(${JSON.stringify(CONFIG.feedbackEmail ? "Mail non disponibile: scrivi a " + CONFIG.feedbackEmail : "Mail non disponibile su questo iPhone")})`); }
      continue;
    }
    if (kind === "segnala") {
      // Segnalazione pubblica su GitHub: solo versione, iOS, modello e tempi, mai dati personali o di salute
      try {
        const t = leggiTempi().slice(-3).map((x) => `${x.t.slice(0, 16)} ${x.dove}: ${x.fasi.map((f) => f[0] + " " + f[1] + " ms").join(", ")}`).join("\n");
        const body = `**Cosa è successo**\n\n\n**Cosa ti aspettavi**\n\n\n---\nVersione ${VERSIONE} · ${infoDispositivo()}\nTempi delle ultime aperture:\n${t || "—"}`;
        Safari.open(`${CONFIG.repository}/issues/new?title=${encodeURIComponent("")}&body=${encodeURIComponent(body)}`);
      } catch (e) { await js(`window.__toast(${JSON.stringify("Non riesco ad aprire GitHub")})`); }
      continue;
    }
    if (kind === "photo") {
      // Foto dalla galleria, ritagliata a 1080×1920 qui per non passare 12 MP alla pagina
      try {
        const img = await Photos.fromLibrary();
        const W = 1080, H = 1920, s = Math.max(W / img.size.width, H / img.size.height);
        const w = img.size.width * s, h = img.size.height * s;
        const dc = new DrawContext(); dc.size = new Size(W, H); dc.opaque = true; dc.respectScreenScale = false;
        dc.drawImageInRect(img, new Rect((W - w) / 2, (H - h) / 2, w, h));
        const jpg = Data.fromJPEG(dc.getImage()).toBase64String();
        await wv.evaluateJavaScript(`window.__setBg('data:image/jpeg;base64,${jpg}')`, false);
      } catch (e) { console.log("Foto non scelta: " + e); }
      continue;
    }
    if (kind === "mp4" || kind === "webm") {
      // Video per la storia: anteprima con il pulsante Condividi (Salva video / Instagram)
      try {
        const fm = FileManager.local();
        const vp = fm.joinPath(fm.temporaryDirectory(), `HUD-attivita-${ymd(new Date())}.${kind}`);
        fm.write(vp, Data.fromBase64String(b64));
        await QuickLook.present(vp, true);
      } catch (e) { console.log("Video non condiviso: " + e); }
      continue;
    }
    try {
      const data = Data.fromBase64String(b64);
      const fm = FileManager.local();
      const path = fm.joinPath(fm.temporaryDirectory(), `HUD-${ymd(new Date())}.png`);
      fm.write(path, data);
      const img = Image.fromFile(path);
      if (kind === "gif") {
        const gp = fm.joinPath(fm.temporaryDirectory(), `HUD-attivita-${ymd(new Date())}.gif`);
        fm.write(gp, data);
        await QuickLook.present(gp, true); // anteprima animata con il pulsante Condividi di iOS
        continue;
      }
      if (kind === "copy") {
        Pasteboard.copyImage(img);
        await wv.evaluateJavaScript("window.__toast('Copiata · incollala nella storia')", false);
      } else {
        await ShareSheet.present([img]);
      }
    } catch (e) { console.log("Condivisione non riuscita: " + e); }
  }
}

// Pesate da Salute, passate dal Comando Rapido «Peso HUD»: testo, numeri, liste o dizionari, come arrivano.
// Ogni voce: una data (9 ott 2026, 09/10/2026, 2026-10-09, oggi, ieri; senza data vale oggi) e un peso tra 40 e 200 kg.
// Più pesate nello stesso giorno: vale la prima del mattino.
const MESI_IN = { gen: 0, jan: 0, feb: 1, mar: 2, apr: 3, mag: 4, may: 4, giu: 5, jun: 5, lug: 6, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, ott: 9, oct: 9, nov: 10, dic: 11, dec: 11 };
function leggiPesi(input, now) {
  const oggi0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const perGiorno = {};
  const voce = (testo) => {
    let s = String(testo).toLowerCase().replace(/[\u00a0\u202f]/g, " ").replace(/(\d)t(\d)/g, "$1 $2");
    let d = null, preso = null;
    const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    const num = s.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
    const mese = s.match(/\b(\d{1,2})\s+([a-z\u00e0-\u00f9]{3,})\.?(?:\s+(\d{4}))?/);
    const meseEn = s.match(/\b([a-z]{3,})\.?\s+(\d{1,2}),?(?:\s+(\d{4}))?/);
    const giornoDi = (g, m, a) => { let x = new Date(a ? +a : now.getFullYear(), m, +g); if (!a && x > oggi0) x = new Date(x.getFullYear() - 1, x.getMonth(), x.getDate()); return x; };
    if (iso) { d = new Date(+iso[1], +iso[2] - 1, +iso[3]); preso = iso[0]; }
    else if (num) { d = new Date(+num[3] < 100 ? 2000 + +num[3] : +num[3], +num[2] - 1, +num[1]); preso = num[0]; }
    else if (mese && MESI_IN[mese[2].slice(0, 3)] !== undefined) { d = giornoDi(mese[1], MESI_IN[mese[2].slice(0, 3)], mese[3]); preso = mese[0]; }
    else if (meseEn && MESI_IN[meseEn[1].slice(0, 3)] !== undefined) { d = giornoDi(meseEn[2], MESI_IN[meseEn[1].slice(0, 3)], meseEn[3]); preso = meseEn[0]; }
    else if (/\b(ieri|yesterday)\b/.test(s)) d = addDays(oggi0, -1);
    else d = oggi0; // «oggi», o nessuna data
    if (preso) s = s.replace(preso, " ");
    s = s.replace(/\b(oggi|ieri|today|yesterday)\b/g, " ");
    const ore = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?\b/);
    const minuti = ore ? +ore[1] * 60 + +ore[2] : null;
    s = s.replace(/\b(?:[01]?\d|2[0-3])[:.][0-5]\d(?::[0-5]\d)?\b/g, " ");
    // il primo numero che può essere un peso (40–200 kg, o in libbre se lo dice)
    const re = /(^|[^\d.,])(\d{2,3}(?:[.,]\d{1,3})?)(?!\d)\s*(kg|lbs?|libbre)?/g;
    let kg = null, k;
    while ((k = re.exec(s))) {
      const v = parseFloat(k[2].replace(",", ".")) * (k[3] && k[3] !== "kg" ? 0.45359237 : 1);
      if (v >= 40 && v <= 200) { kg = v; break; }
    }
    if (kg === null || isNaN(d)) return;
    const giorni = Math.round((oggi0 - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    if (!(kg >= 40 && kg <= 200) || giorni < 0 || giorni > 120) return;
    const g = ymd(d), prima = perGiorno[g];
    if (!prima || (minuti !== null && (prima.minuti === null || minuti < prima.minuti))) perGiorno[g] = { d: g, kg: Math.round(kg * 100) / 100, minuti };
  };
  const visita = (x) => {
    if (x === null || x === undefined || x === "") return;
    if (Array.isArray(x)) return x.forEach(visita);
    if (typeof x === "object") {
      const ks = Object.keys(x), kd = ks.find((k) => /^(data|date|giorno|day|start|inizio)/i.test(k)), kv = ks.find((k) => /^(peso|weight|valore|value|kg)/i.test(k));
      if (kv) return voce(`${kd ? x[kd] : ""} ${x[kv]}`);
      return ks.forEach((k) => voce(`${k} ${x[k]}`));
    }
    if (typeof x === "number") return voce(String(x));
    String(x).split(/[\n;|]+/).forEach((r) => r.trim() && voce(r));
  };
  visita(input);
  return Object.values(perGiorno).sort((a, b) => (a.d < b.d ? -1 : 1));
}

// Salva le pesate nel diario: la bilancia vale più di quella scritta a mano lo stesso giorno
function importaPesi(dia, input, now) {
  const xs = leggiPesi(input, now);
  dia.pesi = dia.pesi || {};
  for (const x of xs) dia.pesi[x.d] = x.kg;
  if (xs.length) dia.pesiSync = { ts: now.toISOString(), ultimo: xs[xs.length - 1].d, n: xs.length };
  return xs;
}

