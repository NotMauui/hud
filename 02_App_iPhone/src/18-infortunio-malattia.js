// ------------------------------------------------------------
//  Infortunio e malattia: consigli, Carburante adattato e proposta per le prossime sedute.
//  Le sedute su Intervals cambiano solo con «Applica»; «Annulla» le rimette com'erano.
//  Indicazioni generali, non un parere medico.
// ------------------------------------------------------------
// per zona: cosa si può fare (no = in pausa, facile = solo facile e senza dolore, si = come da piano)
const ZONE_INF = {
  piede: { nome: "Piede o caviglia", corsa: "no", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Bici con la pressione sul mezzo piede, nuoto con il pull buoy se calciare fa male. In palestra parte alta e core, niente salti.",
    esercizi: "Ogni giorno, se non fa male: cerchi con la caviglia, alfabeto con il piede, equilibrio su una gamba (30\" per 3)." },
  polpaccio: { nome: "Polpaccio o tendine d'Achille", corsa: "no", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Bici facile senza salite pesanti, nuoto con il pull buoy se il calcio tira. Niente salti né corsa in salita.",
    esercizi: "Dopo i primi giorni, se il dolore resta sotto 3 su 10: sollevamenti sulle punte lenti (3 secondi in su, 3 in giù), 3 serie da 15, prima a due gambe poi a una." },
  ginocchio: { nome: "Ginocchio", corsa: "no", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Bici agile (cadenza alta, rapporti leggeri, niente salite seduto). In acqua stile e dorso, niente rana. In palestra niente squat profondi né affondi se fanno male.",
    esercizi: "Rinforzo di anca e glutei: ponte, abduzioni sul fianco, mostri laterali con l'elastico, 3 serie da 12." },
  anca: { nome: "Anca o inguine", corsa: "facile", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Corsa solo facile, in piano e se il dolore resta sotto 3 su 10. In acqua niente rana.",
    esercizi: "Ponte su due gambe, adduttori in isometria con un cuscino tra le ginocchia (10\" per 10), plank laterale." },
  femorali: { nome: "Dietro la coscia (femorali)", corsa: "facile", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Niente velocità, allunghi e salite: si strappano lì. Corsa solo lenta e solo se non zoppichi. In palestra niente stacchi pesanti.",
    esercizi: "Ponte con i talloni lontani e camminate a passi lunghi lenti; quando non fa più male, ponte su una gamba." },
  quadricipite: { nome: "Davanti alla coscia", corsa: "facile", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Corsa facile in piano se il dolore resta sotto 3 su 10, niente discese.",
    esercizi: "Estensioni lente della gamba e mezzi squat a corpo libero, senza dolore." },
  schiena: { nome: "Schiena", corsa: "facile", bici: "facile", nuoto: "si", forza: "facile",
    cosa: "Corsa piano su fondo morbido se non fa male. Bici con il manubrio più alto e uscite brevi. In acqua stile e dorso, niente delfino. In palestra niente carichi sulla schiena.",
    esercizi: "Gatto-mucca, dead bug, bird dog: 2 serie lente ogni giorno. Cammina: aiuta." },
  spalla: { nome: "Spalla", corsa: "si", bici: "si", nuoto: "no", forza: "facile",
    cosa: "Corsa e bici vanno bene. Nuoto in pausa (al massimo solo gambe con la tavoletta, se non fa male). In palestra niente esercizi sopra la testa.",
    esercizi: "Rotazioni esterne con l'elastico, gomito al fianco, e spalle indietro: 3 serie da 15, leggere." },
  altro: { nome: "Altro", corsa: "facile", bici: "facile", nuoto: "facile", forza: "facile",
    cosa: "Fai solo quello che non fa male: dolore al massimo 3 su 10 durante e nessun peggioramento il giorno dopo.",
    esercizi: "" },
};
const SINTOMI_MAL = { sopra: "Sopra il collo: naso chiuso, raffreddore, gola", sotto: "Sotto il collo: tosse profonda, petto, dolori, stomaco" };

// L'episodio in corso (uno alla volta): nel diario
function saluteDi(dia) { const S = dia && dia.salute; return S && S.tipo && !S.guarito ? S : null; }

function consigliSalute(S, now) {
  if (!S) return null;
  const giorni = Math.max(0, daysBetween(parseYMD(S.dal), now));
  const sport = { corsa: "si", bici: "si", nuoto: "si", forza: "si" };
  const consigli = [], allarmi = [];
  let titolo, sotto, stop = false, livello = "cautela", fase = null, carb;
  if (S.tipo === "malattia") {
    const febbre = !!S.febbre, giu = S.sintomi === "sotto";
    const passati = S.passati || null; // giorno in cui i sintomi sono spariti
    const malGiorni = Math.max(1, daysBetween(parseYMD(S.dal), passati ? parseYMD(passati) : now) + 1);
    titolo = febbre ? "Malattia con febbre" : giu ? "Malattia · sotto il collo" : "Raffreddore · sopra il collo";
    if (!passati && (febbre || giu)) {
      fase = "stop"; stop = true; livello = "stop";
      ["corsa", "bici", "nuoto", "forza"].forEach((k) => { sport[k] = "no"; });
      sotto = "Riposo completo finché non passa";
      consigli.push(["Riposa davvero", "Con febbre o sintomi sotto il collo allenarsi allunga la malattia e affatica il cuore. Dormi, bevi, mangia normale."]);
      consigli.push(["Quando ripartire", "Da 24 ore senza febbre (senza antipiretici) e senza sintomi sotto il collo: tocca «Sto meglio» e l'app prepara il rientro."]);
    } else if (!passati) {
      fase = "lieve";
      ["corsa", "bici", "nuoto"].forEach((k) => { sport[k] = "facile"; });
      sport.forza = "facile";
      sotto = "Solo sedute facili, al massimo 45'";
      consigli.push(["La regola del collo", "Sintomi solo sopra il collo e niente febbre: puoi muoverti piano, in Z1–Z2, al massimo 45'. Niente intensità né lunghi."]);
      consigli.push(["Prova di 10 minuti", "Parti piano: se dopo 10 minuti ti senti peggio, fermati e riposa. Se ti senti meglio, finisci la seduta facile."]);
    } else {
      fase = "rientro";
      const rientro = Math.min(7, Math.max(2, malGiorni)), fatti = Math.max(0, daysBetween(parseYMD(passati), now));
      sotto = fatti < rientro ? `Rientro graduale · giorno ${fatti + 1} di ${rientro}` : "Rientro completato";
      ["corsa", "bici", "nuoto", "forza"].forEach((k) => { sport[k] = fatti < rientro ? "facile" : "si"; });
      consigli.push(["Tanti giorni quanti di malattia", `Sei stato male ${malGiorni} ${malGiorni === 1 ? "giorno" : "giorni"}: rientra in ${rientro}. Primi giorni a metà durata in Z1–Z2, poi tre quarti; l'intensità solo dopo due giorni normali senza sintomi.`]);
      if (febbre) consigli.push(["Dopo la febbre", "I battiti possono restare alti per qualche giorno: guarda la FC più del passo e resta basso."]);
      if (fatti >= rientro) { consigli.push(["Puoi tornare al piano", "Tocca «Guarito» per chiudere: torna tutto come prima."]); livello = "ok"; }
    }
    carb = { deficit: "zero", testo: "Niente deficit finché sei malato e durante il rientro: mangiare a sufficienza aiuta a guarire. Bevi di più." };
    allarmi.push("Febbre sopra 38,5 o che dura più di 3 giorni", "Dolore al petto, palpitazioni o fiato corto che non c'era", "Sintomi che peggiorano invece di migliorare");
  } else {
    const Z = ZONE_INF[S.zona] || ZONE_INF.altro, d = +S.dolore || 0;
    titolo = `Infortunio · ${Z.nome.toLowerCase()}`;
    const grave = !!S.riposo || d >= 7;
    for (const k of ["corsa", "bici", "nuoto", "forza"]) sport[k] = Z[k];
    if (grave) {
      stop = true; livello = "stop"; fase = "stop";
      for (const k of ["corsa", "bici", "nuoto", "forza"]) if (sport[k] !== "si") sport[k] = "no";
      sotto = "Fermo con la parte che fa male";
      consigli.push(["Prima un controllo", S.riposo ? "Dolore a riposo, gonfiore o zoppia: fermati con tutto quello che carica la zona e fatti vedere da un medico o da un fisioterapista." : `Dolore ${d} su 10: troppo per allenarsi su quella parte. Fermati e fatti vedere.`]);
    } else {
      fase = "adatta";
      sotto = sport.corsa === "no" ? "Corsa in pausa, il resto con giudizio" : "Allenamento adattato";
      consigli.push(["Cosa puoi fare", Z.cosa]);
      consigli.push(["La regola del 3", "Dolore al massimo 3 su 10 durante, e il giorno dopo non peggiora: puoi continuare. Se sale, torna indietro di un passo."]);
    }
    if (Z.esercizi) consigli.push(["Esercizi per la zona", Z.esercizi]);
    if (sport.corsa !== "si") consigli.push(["Tornare a correre", "Quando cammini senza dolore e fai 10 saltelli su una gamba senza fastidio: corsa e cammino alternati (1' e 1', 10 volte) a giorni alterni, poi allunghi la corsa di 1' ogni volta."]);
    carb = { deficit: "metà", testo: "Metà deficit e proteine piene: i tessuti guariscono meglio con energia sufficiente." };
    allarmi.push("Non riesci a caricare il peso o la zona è molto gonfia", "Dolore di notte o che cresce giorno dopo giorno", "Formicolio, intorpidimento o una caduta, una storta forte");
  }
  return { tipo: S.tipo, titolo, sotto, stop, livello, fase, sport, consigli, allarmi, carb, giorni, dal: S.dal };
}

// Sedute dei prossimi 7 giorni: cosa cambia (tieni, leggera, sostituisci, riposo)
function propostaSalute(K, evs, now, opz = {}) {
  if (!K) return [];
  // malattia: i prossimi 3 giorni (poi si rivede con «Sto meglio»); infortunio: la settimana
  const oggi = ymd(now), fine = ymd(addDays(now, K.tipo === "malattia" ? 2 : 6));
  const alt = (sp) => ["bici", "nuoto", "corsa"].find((k) => k !== sp && K.sport[k] !== "no" && (opz.sport || CONFIG.sport || []).includes(k)) || null;
  const out = [];
  for (const e of evs) {
    if (!e || e.done || !e.date || e.date < oggi || e.date > fine || (e.category || "WORKOUT") !== "WORKOUT") continue;
    if (opz.soloApp && !String(e.external_id || "").startsWith("hud-")) continue;
    const sp = e.sport, min = e.min || 0, reg = K.sport[sp] || "si", q = isQualityEv(e) || (sp === "corsa" && min >= 75) || (sp === "bici" && min >= 120);
    if (sp === "altro" || (sp === "forza" && reg !== "no")) continue; // la palestra si adatta con i consigli, non si riscrive
    let azione = "tieni", nuovo = null, motivo = "";
    const leggera = (spN, m, perche) => ({ sport: spN, min: Math.max(15, Math.round(m / 5) * 5), perche });
    if (reg === "no") {
      const a = K.stop ? null : alt(sp);
      if (a) { azione = "sostituisci"; nuovo = leggera(a, a === "bici" && sp === "corsa" ? Math.min(150, min * 1.2) : a === "nuoto" ? Math.min(60, min) : min, `${SPORT[sp].label.toLowerCase()} in pausa`); motivo = `${SPORT[sp].label} in pausa: ${SPORT[a].label.toLowerCase()} facile`; }
      else { azione = "riposo"; motivo = K.tipo === "malattia" ? "riposo finché non passa" : `${SPORT[sp].label.toLowerCase()} in pausa`; }
    } else if (reg === "facile") {
      // infortunio: via l'intensità e un po' di durata dai lunghi, le sedute facili restano; malattia: più corte
      const cap = K.tipo === "infortunio" ? (q ? Math.max(30, Math.round(min * 0.8)) : min) : K.fase === "lieve" ? 45 : Math.round(min * 0.6);
      if (q || min > cap) { azione = "leggera"; nuovo = leggera(sp, Math.min(min, cap), "solo facile"); motivo = q ? (cap < min ? `niente intensità, al massimo ${fmtMin(cap)}` : "niente intensità") : `al massimo ${fmtMin(cap)}`; }
    }
    if (azione !== "tieni") out.push({ id: e.id, data: e.date, sport: sp, nome: e.name || SPORT[sp].label, min, azione, nuovo, motivo, ext: e.external_id || null });
  }
  return out;
}
// Il testo della seduta nuova su Intervals (passi a zone di frequenza cardiaca; il nuoto senza passi)
function testoSalute(n, titolo) {
  const nota = `Proposta dall'HUD (${titolo}): ${n.perche}. Dolore massimo 3 su 10.`;
  if (n.sport === "nuoto") return `${nota}\n\nNuoto facile ${n.min}': bracciate lunghe, niente intensità.`;
  const centro = Math.max(5, n.min - 15);
  return `${nota}\n\n- 10m Z1 HR\n- ${centro}m Z2 HR\n- 5m Z1 HR`;
}
const TIPO_IV = { corsa: "Run", nuoto: "Swim", forza: "WeightTraining" };
// Applica la proposta: copia di ogni seduta prima di cambiarla, così «Annulla» la rimette com'era
async function applicaSalute(key, K, prop, raw, dia) {
  const prima = [];
  const tipoBici = (() => { const L = (raw.activities || []).filter((a) => sportOf(a.type) === "bici").slice(0, 10); return L.filter((a) => /virtual/i.test(a.type || "")).length > L.length / 2 ? "VirtualRide" : "Ride"; })();
  let fatte = 0;
  for (const p of prop) {
    const e = (raw.events || []).find((x) => String(x.id) === String(p.id));
    if (!e) continue;
    const copia = { id: e.id, category: e.category || "WORKOUT", start_date_local: e.start_date_local, type: e.type, name: e.name, description: e.description || "", moving_time: e.moving_time ?? null, icu_training_load: e.icu_training_load ?? null, external_id: e.external_id || null };
    try {
      if (p.azione === "riposo") await ivRichiesta(key, "DELETE", `/events/${e.id}`);
      else {
        const n = p.nuovo, body = { name: `${n.sport === p.sport ? e.name : SPORT[n.sport].label + " facile"} · adattata`, description: testoSalute(n, K.titolo), moving_time: n.min * 60, icu_training_load: null };
        if (n.sport !== p.sport) body.type = n.sport === "bici" ? tipoBici : TIPO_IV[n.sport] || e.type;
        const r = await ivRichiesta(key, "PUT", `/events/${e.id}`, body);
        Object.assign(e, body, r && typeof r === "object" ? { workout_doc: r.workout_doc } : {});
      }
      prima.push({ ...copia, azione: p.azione });
      fatte++;
    } catch (err) { registro(`seduta ${e.id} non adattata: ${err.message || err}`); }
  }
  if (prima.length) {
    const tolte = new Set(prima.filter((x) => x.azione === "riposo").map((x) => String(x.id)));
    raw.events = (raw.events || []).filter((x) => !tolte.has(String(x.id)));
    dia.salute.modifiche = [...(dia.salute.modifiche || []), ...prima];
    dia.salute.applicata = new Date().toISOString();
  }
  return fatte;
}
async function annullaSalute(key, raw, dia) {
  const L = (dia.salute && dia.salute.modifiche) || [];
  let rimesse = 0;
  for (const c of L.slice().reverse()) {
    try {
      if (c.azione === "riposo") {
        const { id, azione, ...ev } = c;
        if (!ev.external_id) delete ev.external_id;
        const r = await ivRichiesta(key, "POST", "/events/bulk?upsert=true", [ev]);
        const nuovo = Array.isArray(r) && r[0] ? r[0] : { ...ev, id: c.id };
        raw.events = [...(raw.events || []), nuovo];
      } else {
        const body = { name: c.name, description: c.description, moving_time: c.moving_time, type: c.type, icu_training_load: c.icu_training_load };
        const r = await ivRichiesta(key, "PUT", `/events/${c.id}`, body);
        const e = (raw.events || []).find((x) => String(x.id) === String(c.id));
        if (e) Object.assign(e, body, r && typeof r === "object" ? { workout_doc: r.workout_doc } : {});
      }
      rimesse++;
    } catch (err) { registro(`seduta ${c.id} non rimessa: ${err.message || err}`); }
  }
  if (dia.salute) { dia.salute.modifiche = []; delete dia.salute.applicata; }
  return rimesse;
}

