// ------------------------------------------------------------
//  Dati: Intervals.icu (o demo)
// ------------------------------------------------------------
// Scarica da Intervals. Con i dati dell'ultima apertura (prev) prende solo quello che può essere cambiato:
// benessere degli ultimi 3 giorni e attività degli ultimi 7 (sync in ritardo, modifiche, cancellazioni).
// Una volta a settimana riscarica tutto, così niente resta indietro.
const RAW_VER = 3;
async function fetchIntervals(key, now, prev) {
  const auth = "Basic " + Data.fromString("API_KEY:" + key).toBase64String();
  const get = async (path) => {
    const r = new Request(BASE + path);
    r.headers = { Authorization: auth, Accept: "application/json", "User-Agent": "Mozilla/5.0 (iPhone) HUD703" };
    r.timeoutInterval = 25;
    const j = await r.loadJSON();
    const code = r.response && r.response.statusCode;
    if (code && code >= 400) throw new Error(`Intervals ha risposto ${code} su ${path.split("?")[0]}`);
    return j;
  };
  const mon = mondayOf(now);
  const wOld = addDays(now, -365), aOld = addDays(now, -180);
  const pieno = !prev || prev.v !== RAW_VER || prev.stale || !prev.fullAt || !Array.isArray(prev.wellness) || !Array.isArray(prev.activities) || (now - new Date(prev.fullAt)) > 7 * 864e5 || (now - new Date(prev.fetchedAt || 0)) < -36e5;
  const wDa = pieno ? wOld : addDays(new Date(prev.fetchedAt), -3), aDa = pieno ? aOld : addDays(new Date(prev.fetchedAt), -7);
  const [wNew, events, aNew, atl] = await Promise.all([
    get(`/wellness?oldest=${ymd(wDa)}&newest=${ymd(now)}`),
    get(`/events?oldest=${ymd(mon)}&newest=${ymd(addDays(mon, 13))}&resolve=true`),
    get(`/activities?oldest=${ymd(aDa)}&newest=${ymd(now)}`),
    get("").catch(() => null),
  ]);
  // delle impostazioni dell'atleta tengo solo le soglie per sport (niente altro finisce nella cache)
  const impostazioni = atl && Array.isArray(atl.sportSettings) ? atl.sportSettings.map((x) => ({ id: x.id, types: x.types || [], lthr: x.lthr ?? null, max_hr: x.max_hr ?? null, threshold_pace: x.threshold_pace ?? null, ftp: x.ftp ?? null })) : (prev && prev.impostazioni) || null;
  if (pieno) return { v: RAW_VER, wellness: wNew, events, activities: aNew, impostazioni, fetchedAt: now.toISOString(), fullAt: now.toISOString(), nuove: null };
  // unisci: il benessere per giorno, le attività per id (quelle sparite nella finestra riscaricata sono state cancellate)
  const W = new Map((prev.wellness || []).filter((w) => w && w.id && w.id >= ymd(wOld)).map((w) => [w.id, w]));
  for (const w of wNew || []) if (w && w.id) W.set(w.id, w);
  const daA = ymd(aDa), nuoveIds = new Set((aNew || []).map((a) => String(a.id)));
  const vecchie = (prev.activities || []).filter((a) => a && a.start_date_local && a.start_date_local.slice(0, 10) >= ymd(aOld) && a.start_date_local.slice(0, 10) < daA && !nuoveIds.has(String(a.id)));
  const prima = new Set((prev.activities || []).map((a) => String(a.id)));
  const activities = [...vecchie, ...(aNew || [])].sort((a, b) => b.start_date_local.localeCompare(a.start_date_local));
  return { v: RAW_VER, wellness: [...W.values()].sort((a, b) => a.id.localeCompare(b.id)), events, activities, impostazioni, fetchedAt: now.toISOString(), fullAt: prev.fullAt, nuove: (aNew || []).filter((a) => !prima.has(String(a.id))).map((a) => a.id) };
}

// Scrive gli orari del rifornimento nei lunghi da fare (oggi e dopo) su Intervals, da lì all'orologio.
// Tocca solo il testo dei passi; se Intervals lo legge con una durata diversa, rimette subito il testo di prima.
async function scriviAvvisi(raw, A, key, now) {
  const RF = A && A.nutrition && A.nutrition.rif;
  if (!CONFIG.rifornimento.avvisiOrologio || !RF || !key || raw.stale) return [];
  const auth = "Basic " + Data.fromString("API_KEY:" + key).toBase64String();
  const put = async (id, description) => {
    const r = new Request(`${BASE}/events/${id}`);
    r.method = "PUT";
    r.headers = { Authorization: auth, Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (iPhone) HUD703" };
    r.body = JSON.stringify({ description });
    r.timeoutInterval = 20;
    const txt = await r.loadString();
    const code = r.response && r.response.statusCode;
    if (code && code >= 400) throw new Error(`Intervals ha risposto ${code}`);
    try { return JSON.parse(txt); } catch (e) { return null; }
  };
  const oggi = ymd(now), acts = raw.activities || [], out = [];
  const accoppiate = new Set(acts.map((a) => a.paired_event_id).filter((x) => x !== null && x !== undefined).map(String));
  for (const e of raw.events || []) {
    if ((e.category || "WORKOUT") !== "WORKOUT" || e.id === undefined || !e.start_date_local) continue;
    if (!String(e.external_id || "").startsWith("hud-")) continue; // solo le sedute del piano dell'app: quelle dell'allenatore non si toccano
    const d = e.start_date_local.slice(0, 10), sp = sportOf(e.type), desc = String(e.description || "");
    if (d < oggi || (sp !== "bici" && sp !== "corsa") || !desc.trim() || /senza avvisi/i.test(desc)) continue;
    if (accoppiate.has(String(e.id)) || (d === oggi && acts.some((a) => (a.start_date_local || "").slice(0, 10) === d && sportOf(a.type) === sp))) continue; // già fatta
    const min = Math.round((num(e.moving_time) ?? num(e.elapsed_time) ?? num(e.duration) ?? 0) / 60);
    const indoor = e.trainer === true || /virtual/i.test(e.type || "") || /tapis|treadmill|indoor|rulli|spinning|cyclette/i.test(e.name || "");
    // bici senza misuratore di potenza: «Z2» da solo Intervals lo legge come zona di potenza, quindi diventa «Z2 HR»
    const base = sp === "bici" && CONFIG.bici && CONFIG.bici.potenza === false ? zoneFC(desc) : desc;
    const r = testoConAvvisi(base, schemaRifornimento(sp, min, RF, indoor));
    if (r.testo === desc) continue;
    try {
      const nuovo = await put(e.id, r.testo);
      const prima = e.workout_doc && num(e.workout_doc.duration), dopo = nuovo && nuovo.workout_doc && num(nuovo.workout_doc.duration);
      if (prima && dopo && Math.abs(prima - dopo) > 60) {
        await put(e.id, desc); // letta male: torna com'era
        registro(`avvisi tolti da ${e.name}: Intervals leggeva ${Math.round(dopo / 60)}' invece di ${Math.round(prima / 60)}'`);
        continue;
      }
      e.description = r.testo; // i passi nuovi si leggono dalla prossima apertura
      out.push({ id: e.id, nome: e.name || "Seduta", d, n: r.inseriti.length, zone: base !== desc, avvisi: r.testo !== base });
      registro(`avvisi di rifornimento su ${e.name} (${d}): ${r.inseriti.length}`);
    } catch (err) { registro(`avvisi non scritti su ${e.name}: ${err && err.message ? err.message : err}`); }
  }
  return out;
}


