// ============================================================
//  Generatore del piano — v0.1
//  Dato un profilo (obiettivo, disponibilità, sport, livello)
//  produce un blocco di 4 settimane: 3 di carico + 1 di scarico.
//  Nessuna dipendenza esterna: gira in Node, nel browser e in Swift
//  (porting 1:1 previsto nella Fase 2).
// ============================================================

// >>> GENERATORE
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYMD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const nextMonday = (d) => addDays(d, ((8 - d.getDay()) % 7) || 7);
const r5 = (m) => Math.max(5, Math.round(m / 5) * 5);
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// ------------------------------------------------------------
//  Parametri delle regole (tutti in un posto, per la revisione)
// ------------------------------------------------------------
const REGOLE = {
  ripartizione: { // quota del tempo di endurance per sport
    sprint: { nuoto: 0.25, bici: 0.35, corsa: 0.40 },
    olimpico: { nuoto: 0.22, bici: 0.40, corsa: 0.38 },
    "70.3": { nuoto: 0.20, bici: 0.45, corsa: 0.35 },
    ironman: { nuoto: 0.18, bici: 0.52, corsa: 0.30 },
    "duathlon-sprint": { bici: 0.45, corsa: 0.55 },
    duathlon: { bici: 0.50, corsa: 0.50 },
    aquathlon: { nuoto: 0.40, corsa: 0.60 },
    "5k": { corsa: 1 }, "10k": { corsa: 1 }, mezza: { corsa: 1 }, maratona: { corsa: 1 },
    mediofondo: { bici: 1 }, granfondo: { bici: 1 },
    "nuoto-3k": { nuoto: 1 }, "nuoto-10k": { nuoto: 1 },
    migliorare: { nuoto: 0.25, bici: 0.40, corsa: 0.35 },
  },
  // lungo massimo verso cui crescere (minuti): oltre non serve per quella gara; chi fa già di più lo mantiene
  // (solo per chi sceglie uno o due sport: il triathlon resta con le sue regole)
  lungoMax: {
    "duathlon-sprint": { corsa: 75, bici: 120 }, duathlon: { corsa: 100, bici: 180 }, aquathlon: { corsa: 80, bici: 120 },
    "5k": { corsa: 75 }, "10k": { corsa: 95 }, mezza: { corsa: 120 }, maratona: { corsa: 170 },
    mediofondo: { bici: 240 }, granfondo: { bici: 330 },
    migliorare: { corsa: 120, bici: 240 },
  },
  triathlon: ["sprint", "olimpico", "70.3", "ironman"],
  quotaSportExtra: 0.15,                   // sport scelto che la gara non prevede: solo mantenimento
  sedutaNuotoMax: 100,                     // minuti: oltre, meglio una seduta in più
  sedutaFacileMax: 75,                     // corsa facile per chi fa solo corsa (90' per mezza e maratona)
  uscitaFacileMax: 120,                    // bici facile per chi fa solo bici
  ctlDueQualita: 30,                       // fitness minima per due qualità a settimana (chi fa un solo sport)
  crescitaSettimanale: [1.0, 1.07, 1.14],  // settimane di carico del blocco
  scarico: 0.65,                           // volume della 4ª settimana rispetto alla 3ª
  rampMax: 6,                              // punti di fitness (CTL) a settimana
  quotaQualitaMax: 0.25,                   // tempo in qualità sul totale (80/20 con tolleranza)
  lungoCorsaPassoMin: 10,                  // +10' ...
  lungoCorsaOgniSett: 2,                   // ... ogni 2 settimane
  volumeSportMin: 0.85,
  quotaOreDichiarate: 0.75,                // il piano parte almeno da questa quota delle ore indicate nella configurazione                    // quota minima dei minuti abituali di ogni sport da mantenere
  lungoRientroMax: 50,                    // lungo massimo alla ripresa dopo una pausa di corsa
  lungoCorsaQuotaMax: 0.40,                // del tempo di corsa settimanale (calibrato: 30% era irrealistico con 3 uscite)
  minSeduta: 20,
  palestraMin: 45,
  IF: { recupero: 0.55, facile: 0.68, lungo: 0.70, tecnica: 0.65, tempo: 0.82, soglia: 0.95, vo2: 1.02, gara: 0.85, forza: 0.6 },
};

// ------------------------------------------------------------
//  Libreria di sedute: modelli parametrici, l'utente vede solo il risultato
// ------------------------------------------------------------
function seduta(sport, tipo, min, fase, k, maxMin) {
  if (maxMin && ["soglia", "vo2", "tempo"].includes(tipo)) {
    for (let kk = k; kk >= 0; kk--) { const s = seduta(sport, tipo, min, fase, kk); if (s.min <= maxMin) return s; }
    const corta = seduta(sport, tipo, min, fase, 0); // ultima risorsa: meno ripetute, stesso schema
    const blocco = corta.passi.find((p) => p.ripeti);
    while (blocco && blocco.ripeti > 3 && corta.min > maxMin) { blocco.ripeti--; corta.min -= blocco.passi.reduce((t, p) => t + p.min, 0); }
    corta.min = r5(corta.min); corta.nome = corta.nome.replace(/\d+×/, blocco.ripeti + "×");
    corta.minQualita = Math.round(blocco.ripeti * blocco.passi[0].min);
    return corta;
  }
  // k = indice di progressione 0..2 nel blocco
  const S = { sport, tipo, min: r5(min), passi: [] };
  const P = S.passi;
  const add = (min, cosa, intensita) => P.push({ min, cosa, intensita });
  if (sport === "corsa") {
    if (tipo === "soglia") {
      const rep = [5, 6, 6][k] || 6, dur = [5, 5, 6][k] || 5;
      S.nome = `Soglia ${rep}×${dur}'`; const core = rep * dur + (rep - 1);
      add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: dur, cosa: "Soglia", intensita: "100% soglia" }, { min: 1, cosa: "Recupero", intensita: "camminata/corsa lenta" }] }); add(10, "Defaticamento", "Z1–Z2");
      S.min = r5(25 + core);
    } else if (tipo === "vo2") {
      const rep = [5, 6, 6][k] || 5, dur = [2, 2, 3][k] || 3;
      S.nome = `VO2 ${rep}×${dur}'`; add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: dur, cosa: "VO2", intensita: "108% soglia" }, { min: dur, cosa: "Recupero", intensita: "Z1" }] }); add(10, "Defaticamento", "Z1–Z2");
      S.min = r5(25 + rep * dur * 2);
    } else if (tipo === "tempo") {
      // medio: blocchi lunghi poco sotto la soglia, la qualità di chi prepara mezza e maratona
      const rep = [2, 2, 3][k] || 2, dur = [12, 15, 12][k] || 12;
      S.nome = `Medio ${rep}×${dur}'`; add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: dur, cosa: "Medio", intensita: "90% soglia" }, { min: 3, cosa: "Recupero", intensita: "corsa lenta" }] }); add(10, "Defaticamento", "Z1–Z2");
      S.min = r5(25 + rep * (dur + 3));
    } else if (tipo === "lungo") {
      S.nome = `Lungo ${S.min}'`;
      if (fase === "picco" && S.min >= 70) { add(S.min - 20, "Lungo", "Z2"); add(20, "Finale a ritmo gara", "ritmo gara"); }
      else add(S.min, "Lungo costante", "Z2");
    } else if (tipo === "allunghi") {
      S.nome = `Facile ${S.min}' + allunghi`; add(S.min - 4, "Facile", "Z2"); P.push({ ripeti: 6, passi: [{ min: 0.33, cosa: "Allungo", intensita: "veloce, rilassato" }, { min: 0.67, cosa: "Recupero", intensita: "passo" }] });
    } else if (tipo === "test") {
      S.nome = "Test a gradini"; add(10, "Riscaldamento", "Z1–Z2"); P.push({ ripeti: 5, passi: [{ min: 4, cosa: "Gradino", intensita: "ogni gradino +0,5 km/h" }] }); add(5, "Defaticamento", "Z1");
      S.min = 35;
    } else { S.nome = `Facile ${S.min}'`; add(S.min, "Facile", "Z2"); }
  }
  if (sport === "bici") {
    if (tipo === "soglia") {
      const rep = [3, 4, 4][k] || 4, dur = [8, 8, 10][k] || 8;
      S.nome = `Soglia ${rep}×${dur}'`; add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: dur, cosa: "Soglia", intensita: "95–100% FTP" }, { min: 4, cosa: "Recupero", intensita: "Z1" }] }); add(10, "Defaticamento", "Z1");
      S.min = r5(25 + rep * (dur + 4));
    } else if (tipo === "tempo") {
      const rep = [3, 3, 4][k] || 3; S.nome = `Sweet spot ${rep}×12'`; add(15, "Riscaldamento", "Z2"); P.push({ ripeti: rep, passi: [{ min: 12, cosa: "Sweet spot", intensita: "88–92% FTP" }, { min: 4, cosa: "Recupero", intensita: "Z1" }] }); add(10, "Defaticamento", "Z1");
      S.min = r5(25 + rep * 16);
    } else if (tipo === "lungo") {
      S.nome = `Lungo ${Math.floor(S.min / 60)}h${pad(S.min % 60)}`;
      if (fase === "picco" && S.min >= 120) { add(S.min - 60, "Lungo", "Z2"); add(40, "Blocco a ritmo gara", "ritmo gara"); add(20, "Sciolto", "Z1–Z2"); }
      else add(S.min, "Lungo costante", "Z2");
    } else { S.nome = `Z2 ${S.min}'`; add(S.min, "Resistenza", "Z2"); }
  }
  if (sport === "nuoto") {
    const metri = Math.round((S.min * 1000 / 30) / 100) * 100; // ~3 km/h con pause
    S.metri = metri;
    // le ripetute stanno nel tempo della seduta: 10' di riscaldamento e almeno 5' di defaticamento
    if (tipo === "soglia") { const rep = Math.max(4, Math.min([8, 10, 12][k] || 10, Math.floor((S.min - 15) / 2.08))); S.nome = `Soglia ${rep}×100 · ${metri} m`; add(10, "Riscaldamento misto", "facile"); P.push({ ripeti: rep, passi: [{ min: 1.75, cosa: "100 a CSS", intensita: "CSS" }, { min: 0.33, cosa: "Recupero 20\"", intensita: "fermo" }] }); add(Math.max(5, Math.round(S.min - 10 - rep * 2.08)), "Tecnica + defaticamento", "facile"); }
    else if (tipo === "lungo") { S.nome = `Lungo continuo · ${metri} m`; add(10, "Riscaldamento", "facile"); add(S.min - 15, "Continuo", "CSS +8\""); add(5, "Defaticamento", "facile"); }
    else if (tipo === "tempo") { const rep = Math.max(3, Math.min(8, Math.floor((S.min - 15) / 3.93))); S.nome = `Ritmo ${rep}×200 · ${metri} m`; add(10, "Riscaldamento", "facile"); P.push({ ripeti: rep, passi: [{ min: 3.6, cosa: "200 a CSS +3\"", intensita: "CSS +3\"" }, { min: 0.33, cosa: "Recupero 20\"", intensita: "fermo" }] }); add(Math.max(5, Math.round(S.min - 10 - rep * 3.93)), "Tecnica + defaticamento", "facile"); }
    else if (tipo === "test") { S.nome = "Test CSS · 400 + 200"; add(10, "Riscaldamento", "facile"); add(8, "400 a tutta", "massimo"); add(5, "Recupero", "fermo"); add(4, "200 a tutta", "massimo"); add(S.min - 27, "Defaticamento", "facile"); }
    else { S.nome = `Tecnica · ${metri} m`; add(S.min, "Drill e nuotata facile", "facile"); }
  }
  if (sport === "nuoto") {
    // metri dai passi: le ripetute hanno la loro distanza, il resto ~40 m al minuto (passo facile), le pause da fermo nulla
    const dist = (p) => { const d = /^(\d{2,4}) a /.exec(p.cosa || ""); return d ? +d[1] : /fermo/.test(p.intensita || "") ? 0 : p.min * 40; };
    const m = P.reduce((t, p) => t + (p.ripeti ? p.ripeti * p.passi.reduce((u, q) => u + dist(q), 0) : dist(p)), 0);
    const nuovi = Math.max(100, Math.round(m / 100) * 100);
    S.nome = S.nome.replace(/· \d+ m$/, `· ${nuovi} m`); S.metri = nuovi;
  }
  if (sport === "forza") { S.nome = tipo === "gambe" ? "Forza gambe" : "Forza parte alta e core"; add(S.min, S.nome, "moderata"); }
  const ifKey = { soglia: "soglia", vo2: "vo2", tempo: "tempo", lungo: "lungo", allunghi: "facile", facile: "facile", tecnica: "tecnica", gambe: "forza", alto: "forza" }[tipo] || "facile";
  S.qualita = ["soglia", "vo2", "tempo", "test"].includes(tipo);
  S.carico = Math.round((S.min / 60) * REGOLE.IF[ifKey] ** 2 * 100);
  S.minQualita = tipo === "test" ? 15 : S.qualita ? Math.round(P.reduce((t, p) => t + (p.ripeti ? p.ripeti * p.passi[0].min : 0), 0)) : (S.tipo === "lungo" && P.some((p) => p.intensita && /ritmo gara/.test(p.intensita)) ? 20 : 0);
  return S;
}

// ------------------------------------------------------------
//  Fase in base alle settimane mancanti alla gara
// ------------------------------------------------------------
function faseDi(settimaneAllaGara, indiceBlocco) {
  if (settimaneAllaGara === null) return indiceBlocco % 2 ? "costruzione" : "base";
  if (settimaneAllaGara < 0) return "recupero";
  if (settimaneAllaGara <= 2) return "gara";
  if (settimaneAllaGara <= 6) return "picco";
  if (settimaneAllaGara <= 16) return "costruzione";
  return "base";
}

// ------------------------------------------------------------
//  Generazione del blocco
// ------------------------------------------------------------
// Gli sport che la persona fa: corsa, bici, nuoto (uno, due o tutti e tre)
// I profili senza "discipline" (prima versione) seguono le regole del triathlon con bici e piscina facoltative
function discipline(profilo) {
  const s = profilo.sport || {};
  let d = Array.isArray(s.discipline) && s.discipline.length ? s.discipline.filter((x) => ["nuoto", "bici", "corsa"].includes(x)) : ["nuoto", "bici", "corsa"];
  if (s.bici === false) d = d.filter((x) => x !== "bici");
  if (s.piscina === false) d = d.filter((x) => x !== "nuoto");
  return d.length ? d : ["corsa"];
}
const parziale = (profilo) => Array.isArray((profilo.sport || {}).discipline) && discipline(profilo).length < 3;

function generaBlocco(profilo, opzioni = {}) {
  const oggi = parseYMD(profilo.oggi);
  const inizio = opzioni.inizio ? parseYMD(opzioni.inizio) : nextMonday(oggi);
  const gara = profilo.obiettivo && profilo.obiettivo.data ? parseYMD(profilo.obiettivo.data) : null;
  const tipo = (profilo.obiettivo && profilo.obiettivo.tipo) || "migliorare";
  const scelti = discipline(profilo), parz = parziale(profilo);
  const rip = REGOLE.ripartizione[tipo] || REGOLE.ripartizione.migliorare;
  const split0 = { nuoto: 0, bici: 0, corsa: 0 };
  const avvisi = [];
  if (parz) {
    // uno o due sport scelti: solo quelli, con le quote della gara
    for (const sp of scelti) split0[sp] = rip[sp] ?? REGOLE.quotaSportExtra;
    if (REGOLE.triathlon.includes(tipo)) avvisi.push("Per un triathlon servono nuoto, bici e corsa: il piano prepara solo gli sport che hai scelto.");
    if (!(split0.nuoto + split0.bici + split0.corsa)) split0[scelti[0]] = 1;
    const somma = split0.nuoto + split0.bici + split0.corsa;
    for (const sp of ["nuoto", "bici", "corsa"]) split0[sp] /= somma;
  } else {
    // triathlon (e profili della prima versione): bici e piscina possono mancare
    Object.assign(split0, rip);
    if (!scelti.includes("bici")) { split0.corsa += split0.bici * 0.6; split0.nuoto += split0.bici * 0.4; split0.bici = 0; avvisi.push("Senza bici il piano non prepara la frazione ciclistica: consigliata almeno una bici da indoor."); }
    if (!scelti.includes("nuoto")) { split0.corsa += split0.nuoto * 0.5; split0.bici += split0.nuoto * 0.5; split0.nuoto = 0; avvisi.push("Senza piscina il nuoto è escluso: servono almeno 2 accessi a settimana per una gara di triathlon."); }
  }

  const L = profilo.livello;
  // mescola la ripartizione standard con quella dello storico: chi nuota molto non deve smettere
  if (L.minPerSport) {
    const h = L.minPerSport, tot = (h.nuoto || 0) + (h.bici || 0) + (h.corsa || 0);
    if (tot > 0) for (const sp of ["nuoto", "bici", "corsa"]) if (split0[sp] > 0) split0[sp] = 0.5 * split0[sp] + 0.5 * ((h[sp] || 0) / tot);
    const somma = split0.nuoto + split0.bici + split0.corsa;
    for (const sp of ["nuoto", "bici", "corsa"]) split0[sp] /= somma;
  }
  const storicoCorto = (L.settimaneStorico ?? 12) < 4;
  if (storicoCorto) avvisi.push("Storico inferiore a 4 settimane: blocco d'ingresso prudente con test di soglia.");
  // chi fa uno o due sport parte dai minuti abituali di quegli sport, non dalle ore totali
  // (un triatleta che prepara una maratona non deve trasformare in corsa le ore di bici e nuoto)
  let abituali = (L.oreSett || 4) * 60;
  if (parz && L.minPerSport) {
    const m = scelti.reduce((t, sp) => t + (L.minPerSport[sp] || 0), 0);
    abituali = Math.min(abituali, Math.max(150, m * 1.05) + (profilo.sport.palestra ? 2 * REGOLE.palestraMin : 0));
  }
  // ore indicate nella configurazione: il piano parte almeno dal 75% (scelta di prodotto: subito vicino a quello che la persona vuole fare);
  // il limite di crescita della fitness (rampMax) resta e, se serve, riduce il volume
  const dich = profilo.disponibilita.oreDichiarate;
  if (dich) abituali = Math.max(abituali, REGOLE.quotaOreDichiarate * dich * 60);
  const base = Math.min(profilo.disponibilita.oreMax * 60, Math.max(parz ? 150 : 180, abituali)) * (storicoCorto ? 0.85 : 1);
  if (base < 210 && tipo !== "migliorare" && !parz) avvisi.push("Con meno di 3,5 ore a settimana non c'è spazio per due sedute per sport: il piano tiene 2 corse e 2 nuotate, la bici una volta. Il volume crescerà con la fitness.");

  let scala = 1, piano;
  for (let tentativo = 0; tentativo < 25; tentativo++) { // si riduce finché la fitness non cresce più di rampMax a settimana
    piano = costruisci(profilo, inizio, gara, tipo, split0, base * scala, opzioni);
    const ramp = Math.max(...piano.settimane.map((s) => s.ramp));
    if (ramp <= REGOLE.rampMax) break;
    scala *= 0.93;
  }
  piano.avvisi = [...avvisi, ...piano.avvisi];
  piano.profilo = profilo.nome;
  return piano;
}

function costruisci(profilo, inizio, gara, tipo, split, baseMin, opzioni) {
  const L = profilo.livello, D = profilo.disponibilita;
  const avvisi = [];
  const settimane = [];
  const scelti = discipline(profilo), parz = parziale(profilo);
  const solo = parz && scelti.length === 1 ? scelti[0] : null; // chi fa un solo sport
  const LMAX = parz ? REGOLE.lungoMax[tipo] || REGOLE.lungoMax.migliorare : {}; // nel triathlon il lungo cresce senza tetto per gara
  const lunga = tipo === "mezza" || tipo === "maratona"; // gare lunghe di corsa: il medio conta più delle ripetute brevi
  let ctl = L.ctl, atl = L.atl ?? L.ctl;
  let lungoCorsa = L.lungoCorsaMin || 40;
  // Rientro dopo una pausa di corsa: il lungo riparte basso e cresce con la regola normale
  if (L.rientro && L.rientro.corsa && lungoCorsa > REGOLE.lungoRientroMax) { lungoCorsa = REGOLE.lungoRientroMax; avvisi.push(`Rientro dopo una pausa di corsa: il lungo riparte da ${REGOLE.lungoRientroMax}' e cresce di ${REGOLE.lungoCorsaPassoMin}' ogni ${REGOLE.lungoCorsaOgniSett} settimane.`); }
  let lungoBici = L.lungoBiciMin || 60;
  const indiceBlocco = opzioni.indiceBlocco || 0;
  let volPrec = null;

  for (let w = 0; w < 4; w++) {
    const lun = addDays(inizio, 7 * w);
    const settGara = gara ? Math.floor((gara - lun) / (7 * DAY)) : null;
    const fase = faseDi(settGara, indiceBlocco);
    const scaricoSett = w === 3;
    let fattore = scaricoSett ? REGOLE.crescitaSettimanale[2] * REGOLE.scarico : REGOLE.crescitaSettimanale[w];
    if (fase === "gara") fattore = settGara <= 0 ? 0.45 : settGara === 1 ? 0.6 : 0.75;
    if (fase === "recupero") fattore = 0.5;
    let T = Math.min(D.oreMax * 60, baseMin * fattore);
    if (scaricoSett && volPrec && fase !== "gara" && fase !== "recupero") T = Math.min(T, volPrec * 0.68);

    // palestra: fuori dal tempo di endurance
    const nPal = !profilo.sport.palestra ? 0 : fase === "picco" || fase === "gara" || fase === "recupero" || T < 300 ? 1 : 2;
    const palestraMin = nPal * REGOLE.palestraMin;
    const E = Math.max(90, T - palestraMin);
    const mins = { nuoto: E * split.nuoto, bici: E * split.bici, corsa: E * split.corsa };
    // Non togliere volume allo sport che l'atleta già fa: almeno l'85% dei suoi minuti abituali
    // (chi arriva dalla corsa e aggiunge il nuoto non deve dimezzare la corsa). Il rientro dopo una pausa fa eccezione.
    if (L.minPerSport) {
      const rid = scaricoSett ? 0.7 : fase === "gara" || fase === "recupero" ? 0.6 : 1;
      for (const sp of ["nuoto", "bici", "corsa"]) {
        if (!mins[sp] || (sp === "corsa" && L.rientro && L.rientro.corsa)) continue;
        mins[sp] = Math.max(mins[sp], (L.minPerSport[sp] || 0) * REGOLE.volumeSportMin * rid);
      }
      const tetto = D.oreMax * 60 - palestraMin, tot = mins.nuoto + mins.bici + mins.corsa;
      if (tot > tetto) for (const sp of ["nuoto", "bici", "corsa"]) mins[sp] *= tetto / tot;
    }

    // qualità per fase
    let qual = { base: ["corsa"], costruzione: ["corsa", "bici"], picco: ["corsa", "bici"], gara: settGara <= 0 ? [] : ["corsa"], recupero: [] }[fase].slice();
    if (scaricoSett) qual.splice(1);

    if (fase === "base" && w % 2 === 1 && mins.bici > 0) qual[0] = "bici";
    if (!mins.corsa && mins.bici > 0 && qual[0] === "corsa") qual[0] = "bici"; // chi fa nuoto e bici: la qualità va alla bici
    // un solo sport (corsa o bici): una qualità in base, due in costruzione e picco
    // un solo sport (corsa o bici): una qualità in base; due in costruzione e picco se il livello e le sedute lo permettono
    if (solo === "corsa" || solo === "bici") {
      const sedSett = solo === "corsa" ? Math.round(mins.corsa / 50) : Math.round(mins.bici / 70);
      const due = (L.ctl || 0) >= REGOLE.ctlDueQualita && sedSett >= 5;
      const n = { base: 1, costruzione: due ? 2 : 1, picco: due ? 2 : 1, gara: settGara <= 0 ? 0 : 1, recupero: 0 }[fase];
      qual = Array(scaricoSett ? Math.min(1, n) : n).fill(solo);
    }
    qual = qual.filter((sp) => mins[sp] > 0);
    const ingresso = (L.settimaneStorico ?? 12) < 4;
    if (ingresso) qual.length = 0;
    const k = Math.min(w, 2);

    // lungo di corsa: +10' ogni 2 settimane fino al lungo che serve per la gara, scarico −25%, tetto 40% del tempo di corsa
    if (w > 0 && w % REGOLE.lungoCorsaOgniSett === 0 && !scaricoSett && fase !== "gara" && lungoCorsa < (LMAX.corsa || 999)) lungoCorsa = Math.min(LMAX.corsa || 999, lungoCorsa + REGOLE.lungoCorsaPassoMin);
    let lungoC = scaricoSett || fase === "gara" ? lungoCorsa * 0.75 : lungoCorsa;
    lungoC = Math.min(lungoC, mins.corsa * REGOLE.lungoCorsaQuotaMax);
    if (lungoC < 30) lungoC = Math.min(30, mins.corsa);

    const gLungo = profilo.giornoLungo ?? 6; // 0 = lunedì
    // lungo di bici nel weekend se c'è tempo, altrimenti nel giorno libero con più minuti; senza corsa prende il giorno del lungo
    const gLungoBici = !mins.corsa && D.minutiGiorno[gLungo] > 0 ? gLungo
      : [gLungo === 6 ? 5 : 6, 6, 5, 4, 3, 2, 1, 0].find((g) => g !== gLungo && D.minutiGiorno[g] > 0) ?? (gLungo === 6 ? 5 : 6);

    // lungo di bici: 40% del tempo di bici, crescita max +15' a settimana fino al lungo che serve per la gara, dentro il suo giorno
    const capB = LMAX.bici || 9999;
    let lungoB = Math.min(mins.bici * 0.42, scaricoSett || lungoBici >= capB ? lungoBici : Math.min(capB, lungoBici + 15));
    if (D.minutiGiorno[gLungoBici] > 0) lungoB = Math.min(lungoB, D.minutiGiorno[gLungoBici]);
    if (!scaricoSett && fase !== "gara") lungoBici = Math.max(lungoBici, lungoB);
    if (scaricoSett) lungoB *= 0.75;

    // ---- sedute
    const sedute = []; // {giorno, ...seduta}
    const push = (g, s) => sedute.push({ giorno: g, ...s });
    let piscina = profilo.piscinaGiorni || [0, 2, 4];
    // chi fa solo nuoto: il lungo in acqua nel giorno del lungo, se è un giorno di piscina
    if (solo === "nuoto" && piscina.includes(gLungo)) piscina = [gLungo, ...piscina.filter((g) => g !== gLungo)];
    const nQ = (sp) => qual.filter((x) => x === sp).length;
    const giornoLibero = (pref, evita, obbligatorio) => pref.find((g) => D.minutiGiorno[g] > 0 && !evita.includes(g)) ?? (obbligatorio ? pref.find((g) => D.minutiGiorno[g] > 0) ?? pref[0] : null);
    // chi fa un solo sport: le uscite facili il più distanti possibile dal lungo, dalle qualità e tra loro
    const distanziati = (n, occupati, pref) => {
      const out = [];
      const d = (g) => [...occupati, ...out].map((o) => Math.min(Math.abs(o - g), 7 - Math.abs(o - g)));
      const dist = (g) => Math.min(7, ...d(g)), somma = (g) => d(g).reduce((t, x) => t + x, 0);
      for (let i = 0; i < n; i++) {
        const c = pref.filter((g) => !occupati.includes(g) && !out.includes(g) && D.minutiGiorno[g] > 0).sort((a, b) => dist(b) - dist(a) || somma(b) - somma(a) || pref.indexOf(a) - pref.indexOf(b));
        if (!c.length) break;
        out.push(c[0]);
      }
      return out;
    };

    // corsa
    if (mins.corsa > 0) {
      push(gLungo, seduta("corsa", "lungo", lungoC, fase, k));
      let resto = mins.corsa - lungoC;
      let tipoQ = fase === "base" ? "soglia" : fase === "picco" ? (w % 2 ? "soglia" : "vo2") : fase === "gara" ? "soglia" : (w % 2 ? "vo2" : "soglia");
      if (lunga && tipoQ === "vo2") tipoQ = "tempo";
      const giorniQ = [];
      // giorni di qualità: martedì e giovedì; per chi fa uno o due sport, se non sono liberi, i primi giorni liberi non vicini al lungo né tra loro
      const gq1 = !parz ? 1 : giornoLibero([1, 2, 3, 0, 4], [gLungo, gLungo - 1], true);
      const gq2 = !parz ? 3 : giornoLibero([3, 4, 2, 0, 1], [gLungo, gLungo - 1, gq1 - 1, gq1, gq1 + 1]); // nessun giorno adatto: la seconda qualità salta
      if (nQ("corsa") >= 1) { const s = seduta("corsa", tipoQ, 0, fase, scaricoSett ? 0 : k, D.minutiGiorno[gq1]); push(gq1, s); giorniQ.push(gq1); resto -= s.min; }
      if (nQ("corsa") >= 2 && gq2 !== null) {
        const t2 = tipoQ === "soglia" ? (lunga ? "tempo" : "vo2") : "soglia";
        const s = seduta("corsa", t2, 0, fase, k, D.minutiGiorno[gq2]); push(gq2, s); giorniQ.push(gq2); resto -= s.min;
      }
      if (ingresso && w === 0) { const s = seduta("corsa", "test", 0, fase, 0); push(gq1, s); giorniQ.push(gq1); resto -= s.min; }
      // facili: mai più lunghe del lungo. Chi fa solo corsa: quante servono per stare nel tempo, da 3 a 6 uscite in tutto
      // (sempre almeno un giorno di riposo)
      const capF = !parz && !D.oreDichiarate ? 999 : Math.max(REGOLE.minSeduta + 10, Math.min(lungoC, solo === "corsa" ? (lunga ? 90 : REGOLE.sedutaFacileMax) : 999));
      const maxUscite = (L.ctl || 0) < 20 ? 4 : (L.ctl || 0) < 35 ? 5 : 6; // chi parte da poca fitness corre meno spesso
      const nFacili = solo === "corsa"
        ? Math.max(1, 3 - 1 - giorniQ.length, Math.min(maxUscite - 1 - giorniQ.length, Math.ceil(resto / capF)))
        : Math.max(1, Math.min(3, Math.max(Math.round(resto / 40), parz || D.oreDichiarate ? Math.ceil(resto / capF) : 0)));
      const giorniFacili = solo === "corsa" ? distanziati(nFacili, [gLungo, ...giorniQ], [3, 4, 2, 0, 5, 6, 1]) : [3, 4, 2, 0, 5, 6].filter((g) => g !== gLungo && !giorniQ.includes(g)).slice(0, nFacili);
      giorniFacili.forEach((g, i) => { const m = Math.max(REGOLE.minSeduta + 5, Math.min(capF, resto / giorniFacili.length)); push(g, seduta("corsa", i === 0 && fase !== "gara" ? "allunghi" : "facile", m, fase, k)); });
    }
    // bici
    if (mins.bici > 0) {
      push(gLungoBici, seduta("bici", "lungo", Math.max(60, lungoB), fase, k));
      let resto = mins.bici - Math.max(60, lungoB);
      const giorniQ = [];
      const occ = sedute.filter((x) => x.qualita || x.tipo === "lungo").map((x) => x.giorno);
      const gb1 = !parz ? 3 : giornoLibero([3, 2, 4, 1, 0, 5], [gLungoBici, ...occ], true);
      const gb2 = !parz ? 1 : giornoLibero([1, 0, 2, 4, 5], [gLungoBici, ...occ, gb1 - 1, gb1, gb1 + 1]);
      if (nQ("bici") >= 1) { const t1 = fase === "costruzione" && w === 0 ? "tempo" : "soglia"; const s = seduta("bici", t1, 0, fase, scaricoSett ? 0 : k, D.minutiGiorno[gb1]); push(gb1, s); giorniQ.push(gb1); resto -= s.min;
        if (nQ("bici") >= 2 && gb2 !== null) { const s2 = seduta("bici", t1 === "soglia" ? "tempo" : "soglia", 0, fase, k, D.minutiGiorno[gb2]); push(gb2, s2); giorniQ.push(gb2); resto -= s2.min; } }
      // le uscite facili restano più corte del lungo: se il tempo avanza diventano tre (quattro per chi fa solo bici)
      const lungoEff = Math.max(60, lungoB);
      const maxFacile = Math.max(30, Math.min(lungoEff - 10, solo === "bici" ? REGOLE.uscitaFacileMax : 999));
      const maxN = solo === "bici" ? Math.max(1, Math.min(4, 5 - giorniQ.length)) : 3; // chi fa solo bici: al massimo 6 uscite, un giorno di riposo
      const n = Math.max(1, Math.min(maxN, Math.max(Math.min(2, Math.round(resto / 60)), Math.ceil(resto / maxFacile))));
      const giorniB = solo === "bici" ? distanziati(n, [gLungoBici, ...giorniQ], [2, 4, 0, 5, 6, 1, 3]) : parz ? [2, 4, 0, 5, 6, 1].filter((g) => g !== gLungoBici && !giorniQ.includes(g)).slice(0, n) : [2, 4, 0].slice(0, n);
      giorniB.forEach((g) => push(g, seduta("bici", "facile", Math.max(30, Math.min(maxFacile, resto / giorniB.length)), fase, k)));
    }
    // nuoto
    if (mins.nuoto > 0) {
      // chi fa solo nuoto: fino a 5 sedute (una per giorno di piscina), non più lunghe di 100'
      const n = solo === "nuoto" ? Math.min(piscina.length, Math.max(2, Math.min(5, Math.ceil(mins.nuoto / 75)))) : Math.min(piscina.length, mins.nuoto < 100 ? 2 : 3);
      const giorni = piscina.slice(0, n);
      const per = mins.nuoto / n;
      const facileN = fase === "base" || ingresso;
      const testCSS = ingresso || !!(profilo.test && profilo.test.css); // CSS sconosciuto (nessuna nuotata): test 400 + 200 nella prima settimana
      const iTest = giorni.length > 1 || !(profilo.test && profilo.test.css) ? 1 : 0; // con una sola nuotata il test prende il suo posto
      giorni.forEach((g, i) => {
        let t = testCSS && w === 0 && i === iTest ? "test" : i === 0 ? "lungo" : i === 1 ? (facileN ? (solo === "nuoto" && !ingresso ? "tempo" : "tecnica") : "tempo") : i === 2 ? (facileN ? "tecnica" : solo === "nuoto" ? "tecnica" : "soglia") : i === 3 ? (facileN || scaricoSett ? "tecnica" : "soglia") : "tecnica";
        let m = Math.max(30, i === 0 ? per * 1.2 : per * 0.9);
        if (solo === "nuoto") m = Math.min(m, REGOLE.sedutaNuotoMax + (i === 0 ? 20 : 0));
        if (parz && D.minutiGiorno[g] > 0) m = Math.max(REGOLE.minSeduta + 10, Math.min(m, D.minutiGiorno[g]));
        push(g, seduta("nuoto", t, m, fase, k));
      });
      // due qualità di nuoto in giorni consecutivi: la seconda diventa tecnica
      const qn = !parz ? [] : sedute.filter((s) => s.sport === "nuoto" && s.qualita && s.tipo !== "test").sort((a, b) => a.giorno - b.giorno);
      for (let i = 1; i < qn.length; i++) if (qn[i].giorno - qn[i - 1].giorno === 1 && qn[i - 1].qualita) Object.assign(qn[i], seduta("nuoto", "tecnica", qn[i].min, fase, k));
    }
    // palestra: gambe solo lontano dalla qualità di corsa
    if (nPal) {
      const gQ = sedute.filter((s) => s.sport === "corsa" && s.qualita).map((s) => s.giorno);
      const giorniPal = profilo.palestraGiorni || [0, 4];
      const lontano = (g) => gQ.every((q) => Math.abs(q - g) > 1);
      const gambe = giorniPal.find(lontano);
      giorniPal.slice(0, nPal).forEach((g, i) => {
        const t = g === gambe && i === giorniPal.indexOf(gambe) ? "gambe" : "alto";
        push(g, seduta("forza", t, REGOLE.palestraMin, fase, k));
      });
      if (gambe === undefined) avvisi.push(`Settimana ${w + 1}: nessun giorno di palestra lontano dalla qualità di corsa, forza solo parte alta.`);
    }

    // collocazione: ogni giorno entro i minuti disponibili, rispettando i vincoli
    const cap = (g) => D.minutiGiorno[g];
    const usato = (g) => sedute.filter((s) => s.giorno === g).reduce((t, s) => t + s.min, 0);
    const libero = (g) => cap(g) - usato(g);
    const qualGiorni = (sp) => sedute.filter((s) => s.qualita && s.sport === sp).map((s) => s.giorno);
    const ammesso = (s, g) => {
      if (cap(g) <= 0) return false;
      if (s.sport === "nuoto" && !piscina.includes(g)) return false;
      if (s.sport === "forza") return (profilo.palestraGiorni || [0, 4]).includes(g) && !sedute.some((x) => x !== s && x.giorno === g && x.sport === "forza");
      if (sedute.some((x) => x !== s && x.giorno === g && x.sport === s.sport)) return false; // una seduta per sport al giorno
      if (s.qualita) {
        if (qualGiorni(s.sport).some((q) => q !== s.giorno && Math.abs(q - g) <= 1)) return false;
        if ((parz || D.oreDichiarate) && sedute.some((x) => x !== s && x.giorno === g && x.tipo === "lungo" && x.sport !== "nuoto")) return false; // niente qualità nel giorno di un lungo di corsa o bici
        if (s.sport === "corsa" && g === gLungo - 1) return false;
        if (s.sport === "corsa" && sedute.some((x) => x.sport === "forza" && x.tipo === "gambe" && Math.abs(x.giorno - g) <= 1)) return false;
      }
      if (s.tipo === "lungo") return false; // i lunghi restano nel loro giorno
      return true;
    };
    // prima le qualità (scelgono il giorno migliore), poi le facili
    const ordine = sedute.slice().sort((a, b) => (b.qualita - a.qualita) || (b.min - a.min));
    for (const s of ordine) {
      if (s.tipo === "lungo" || s.sport === "gara") continue;
      if (usato(s.giorno) <= cap(s.giorno) && cap(s.giorno) > 0 && !sedute.some((x) => x !== s && x.giorno === s.giorno && x.sport === s.sport)) continue;
      const dest = [0, 1, 2, 3, 4, 5, 6].filter((g) => g !== s.giorno && ammesso(s, g)).sort((a, b) => libero(b) - libero(a))[0];
      if (dest !== undefined && libero(dest) >= Math.min(s.min, REGOLE.minSeduta + 10)) s.giorno = dest;
    }
    // ciò che ancora sfora: accorcia (qualità con meno ripetute, facili più brevi), poi elimina le facili in eccesso
    for (let g = 0; g < 7; g++) {
      let guardia = 0;
      while (usato(g) > cap(g) + 5 && guardia++ < 20) {
        const qs = sedute.find((s) => s.giorno === g && s.qualita && s.tipo !== "test");
        const altri = usato(g) - (qs ? qs.min : 0);
        if (qs && qs.min > cap(g) - altri) {
          const nuova = seduta(qs.sport, qs.tipo, qs.min, fase, 0, Math.max(30, cap(g) - altri));
          if (nuova.min < qs.min) { Object.assign(qs, nuova); continue; }
        }
        const facile = sedute.filter((s) => s.giorno === g && !s.qualita && s.tipo !== "lungo").sort((a, b) => b.min - a.min)[0];
        if (!facile) break;
        const eccesso = usato(g) - cap(g);
        if (facile.min - eccesso >= REGOLE.minSeduta + 5) facile.min = r5(facile.min - eccesso);
        else if (facile.min > REGOLE.minSeduta + 5) facile.min = REGOLE.minSeduta + 5;
        else {
          const dest = [0, 1, 2, 3, 4, 5, 6].filter((x) => x !== g && ammesso(facile, x) && libero(x) >= facile.min)[0];
          if (dest !== undefined) facile.giorno = dest; else sedute.splice(sedute.indexOf(facile), 1);
        }
      }
      if (usato(g) > cap(g) + 5) avvisi.push(`Settimana ${w + 1}, ${GIORNI[g]}: ${usato(g)}' pianificati oltre i ${cap(g)}' disponibili.`);
    }

    // gara nella settimana
    if (gara && gara >= lun && gara < addDays(lun, 7)) {
      const g = (gara.getDay() + 6) % 7;
      for (let i = sedute.length - 1; i >= 0; i--) if (sedute[i].giorno >= g - 1 && sedute[i].giorno <= g) sedute.splice(i, 1);
      push(g, { sport: "gara", tipo: "gara", nome: `Gara · ${tipo}`, min: 0, passi: [], qualita: false, carico: 0, minQualita: 0 });
    }

    // tetti: volume della settimana e quota di qualità (le durate minime non devono sforare)
    const tetto = Math.min(D.oreMax * 60, Math.max(T, mins.nuoto + mins.bici + mins.corsa + palestraMin) * 1.05); // il volume protetto dello sport abituale conta nel tetto
    const tot = () => sedute.reduce((t, s) => t + s.min, 0);
    const priorita = (s) => (s.qualita || s.tipo === "lungo" || s.sport === "gara" ? 99 : s.sport === "forza" ? 3 : s.sport === "bici" ? 1 : s.sport === "corsa" ? 2 : 4);
    // il lungo di corsa abituale non si accorcia per far posto agli sport nuovi (salvo rientro): si taglia prima il resto
    const lungoAbituale = L.rientro && L.rientro.corsa ? 30 : Math.max(30, Math.min(lungoC, (L.lungoCorsaMin || 0) * 0.8));
    const minLungo = (s) => (s.sport === "bici" ? 45 : s.sport === "corsa" ? r5(lungoAbituale) : 30);
    let guard = 0;
    while (tot() > tetto && guard++ < 60) {
      const facili = sedute.filter((s) => priorita(s) < 99).sort((a, b) => priorita(a) - priorita(b) || b.min - a.min);
      if (!facili.length) {
        const lunghi = sedute.filter((s) => s.tipo === "lungo" && s.min > minLungo(s)).sort((a, b) => (b.min - minLungo(b)) - (a.min - minLungo(a)));
        if (!lunghi.length) break;
        lunghi[0].min = r5(lunghi[0].min - 5); continue;
      }
      const f = facili[0];
      const eccesso = tot() - tetto;
      if (f.min - eccesso >= REGOLE.minSeduta + 5) f.min = r5(f.min - eccesso);
      else if (f.sport === "forza" || sedute.filter((s) => s.sport === f.sport).length > (f.sport === solo ? 3 : 2)) sedute.splice(sedute.indexOf(f), 1); // chi fa un solo sport tiene almeno 3 sedute
      else {
        // prima di scendere sotto 2 sedute per sport, accorcia i lunghi
        const lungo = sedute.filter((s) => s.tipo === "lungo" && s.min > minLungo(s)).sort((a, b) => (b.min - minLungo(b)) - (a.min - minLungo(a)))[0];
        if (lungo) { lungo.min = r5(lungo.min - 5); continue; }
        if (f.min > REGOLE.minSeduta + 5) { f.min = r5(f.min - 5); continue; }
        sedute.splice(sedute.indexOf(f), 1);
      }
    }
    const qmin = () => sedute.reduce((t, s) => t + (s.minQualita || 0), 0);
    for (const sp of solo ? ["bici", "corsa", "bici", "corsa"] : ["bici", "corsa"]) { // due giri: chi fa un solo sport può avere due qualità
      if (qmin() <= tot() * REGOLE.quotaQualitaMax) break;
      const q = sedute.find((s) => s.qualita && s.sport === sp && (!solo || s.tipo !== "test"));
      if (q) { const lb = sedute.find((x) => x.sport === sp && x.tipo === "lungo"); const m = lb ? Math.min(q.min, Math.max(30, lb.min - 10)) : q.min; const nuova = seduta(sp, sp === "corsa" ? "allunghi" : "facile", m, fase, k); Object.assign(q, nuova); avvisi.push(`Settimana ${w + 1}: qualità di ${sp} trasformata in seduta facile per restare nell'80/20 con poche ore.`); }
    }

    // le sedute accorciate o allungate dopo la creazione: nome e passi rifatti sulla durata finale
    for (const s of sedute) if (!s.qualita && ["corsa", "bici", "nuoto"].includes(s.sport) && ["facile", "allunghi", "lungo", "tecnica"].includes(s.tipo)) Object.assign(s, seduta(s.sport, s.tipo, s.min, fase, k), { giorno: s.giorno });
    // ricalcolo carico e fitness giorno per giorno
    for (const s of sedute) if (s.sport !== "gara") { const ifk = s.qualita ? (s.tipo === "vo2" ? "vo2" : s.tipo === "tempo" ? "tempo" : "soglia") : s.sport === "forza" ? "forza" : s.tipo === "lungo" ? "lungo" : "facile"; s.carico = Math.round((s.min / 60) * REGOLE.IF[ifk] ** 2 * 100); }
    const ctl0 = ctl;
    for (let g = 0; g < 7; g++) {
      const load = sedute.filter((s) => s.giorno === g).reduce((t, s) => t + s.carico, 0);
      ctl += (load - ctl) / 42; atl += (load - atl) / 7;
    }
    const vol = sedute.reduce((t, s) => t + s.min, 0);
    sedute.sort((a, b) => a.giorno - b.giorno || (b.qualita - a.qualita));
    settimane.push({
      n: w + 1, lunedi: ymd(lun), fase, scarico: scaricoSett, settAllaGara: settGara,
      minuti: vol, carico: sedute.reduce((t, s) => t + s.carico, 0),
      minQualita: sedute.reduce((t, s) => t + (s.minQualita || 0), 0),
      perSport: ["nuoto", "bici", "corsa", "forza"].reduce((o, sp) => (o[sp] = sedute.filter((s) => s.sport === sp).reduce((t, s) => t + s.min, 0), o), {}),
      ctlFine: +ctl.toFixed(1), atlFine: +atl.toFixed(1), ramp: +(ctl - ctl0).toFixed(1),
      lungoCorsa: (sedute.find((s) => s.sport === "corsa" && s.tipo === "lungo") || {}).min || 0,
      sedute: sedute.map((s) => ({ ...s, data: ymd(addDays(lun, s.giorno)), giornoNome: GIORNI[s.giorno] })),
    });
    volPrec = vol;
  }
  return { inizio: ymd(inizio), tipo, settimane, avvisi, ctlInizio: L.ctl };
}

// <<< GENERATORE

if (typeof module !== "undefined") module.exports = { generaBlocco, REGOLE, seduta, faseDi, discipline, ymd, parseYMD, addDays, GIORNI };
