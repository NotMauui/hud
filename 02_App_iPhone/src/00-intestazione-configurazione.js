// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: heartbeat;
// SPDX-License-Identifier: AGPL-3.0-only
// HUD · app di allenamento per atleti di endurance. Codice libero sotto licenza GNU AGPL 3.0: vedi LICENSE nel repository.

// ============================================================
//  HUD  ·  v4 (versione per i tester)
//  Controllo quotidiano da iPhone su dati di Intervals.icu.
//  La chiave API resta nel Portachiavi dell'iPhone, mai nel codice.
//  I dati di ogni persona stanno nel file hud-profilo.json (iCloud › Scriptable),
//  creato dalla configurazione al primo avvio: qui sotto ci sono solo valori generici.
// ============================================================

const VERSIONE = "1.6";

// ------------------------------------------------------------
//  CONFIGURAZIONE — valori di partenza uguali per tutti
// ------------------------------------------------------------
const CONFIG = {
  nomeApp: "HUD",
  sport: ["nuoto", "bici", "corsa"], // gli sport della persona, dal profilo
  soglieAutomatiche: true, // le soglie stimate dalle attività vanno su Intervals da sole, tranne quelle fissate nel profilo
  soglieFissate: [],
  feedbackEmail: "", // dove arrivano i commenti dei tester (vuoto: la mail si apre senza destinatario)

  // Obiettivo: arriva dal profilo ({ nome, data, tipo, ctlGara }) oppure null.
  obiettivo: null,

  peso: null,                                // { partenza, obiettivo } in kg, dal profilo
  // record di prima dell'app per distanza (es. c5000: "22:30"): li batte solo chi fa meglio
  record: {},
  // domani: la sera prima, l'allenamento nel dettaglio; settimana: domenica alle 20:30; attivita: quando una seduta arriva
  // da Intervals ad app chiusa (serve il widget). Tutte finiscono anche nella campana dell'app.
  notifiche: { domani: "19:30", ricarica: true, affaticamento: true, settimana: true, attivita: true },

  // Soglie: se restano null le legge dalle attività di Intervals
  corsa: { lthr: null, fcMax: null, passoSoglia: null, zoneFC: {} },
  nuoto: { css: null, recuperoBlocchi: '20"' },
  bici: { sogliaFC: null, ftp: null, daVerificare: true },

  volumeObiettivo: null,

  // Scala del lungo di corsa (minuti): con il piano dell'app la decide il generatore
  scalaLungo: [],
  tolleranzaLungoMin: 5,

  // Palestra fuori da Intervals (0 = domenica…): con il piano dell'app è nel calendario
  palestra: {},

  // Soglie del semaforo
  soglie: {
    fcRiposoGiallo: 5,     // bpm sopra la media dei 7 giorni
    fcRiposoRosso: 8,
    sonnoGiallo: 60,       // sleep score
    sonnoOreGiallo: 6,     // ore dormite
    tsbRosso: -30,         // forma (CTL − ATL)
    dislivelloCorsa: 400,  // m D+ in una corsa → tessuti gialli per 72 h
    caricoOltrePiano: 1.5, // carico effettivo / pianificato
  },

  riegelK: null, // { valore, obiettivo } se lo misuri

  // Carburante: calorie = base (metabolismo a riposo × fattoreBase) + allenamento − deficit.
  // Ordine dei macro: proteine per kg → carboidrati per kg secondo il carico del giorno → grassi con un minimo.
  // Il deficit c'è solo con un peso obiettivo più basso di quello attuale, si misura in % del peso a settimana,
  // è più forte nei giorni leggeri e si ferma qualche settimana prima della gara. I limiti di sicurezza vincono su tutto.
  nutrizione: {
    metabolismo: "tenHaaf",                          // "tenHaaf" (ten Haaf 2014, la più precisa negli atleti) o "mifflin"
    fattoreBase: 1.3,                                // la giornata senza allenamento: metabolismo a riposo × 1,3
    ritmoCalo: 0.5,                                  // % del peso a settimana mentre dimagrisci (0,25–0,75; mai oltre 1)
    pesoDeficit: { riposo: 1.5, medio: 1.5, duro: 0.7, lungo: 0.3, carico: 0 }, // quanto del deficit medio cade in ogni tipo di giorno
    deficitMaxQuota: 0.25,                           // mai più del 25% delle calorie del giorno
    energiaMin: { M: 25, F: 30 },                    // kcal per kg di massa magra che restano tolto l'allenamento
    kcalMin: { M: 1800, F: 1500 },                   // mai sotto, in nessun giorno
    proteineGkg: { dimagrimento: 2.0, mantenimento: 1.8 },
    carboGkg: { riposo: 3, medio: 4.5, duro: 6, lungo: 7, carico: 10 }, carboVigilia: 1, carboMinGkg: 3,
    grassiMinGkg: 0.8, grassiMinQuota: 0.2, grassiMaxQuota: 0.35, // grassi: almeno 0,8 g/kg e il 20% delle calorie, al massimo il 35%
    caricoPreGara: true,
    calorieAdattive: true, maxCorrezioneAdattiva: 300, // la base impara dalle pesate e dal cibo registrato (±300 kcal al massimo)                             // i 2 giorni prima di una gara lunga: carico di carboidrati
    stopPrimaDellaGara: 12,                          // settimane prima della gara senza deficit
    ritmo: { lento: 0.25, veloce: 0.9 },             // % del peso a settimana: sotto si stringe, sopra si mangia di più
    correzione: { piuCibo: 250, menoCibo: 150 },     // kcal al giorno
    lungoMin: 75, integratori: [],
  },

  // Rifornimento nelle sedute lunghe: le dosi salgono verso quelle della gara solo se lo stomaco le regge
  rifornimento: {
    bici: { da: 60, a: 90 }, corsa: { da: 40, a: 60 }, // g di carboidrati all'ora: partenza e gara
    gareLunghe: ["70.3", "ironman", "maratona", "mezza", "granfondo"],
    settimane: [26, 5],                              // la dose sale da 26 a 5 settimane prima della gara lunga
    sudore: { corsa: 1.0, bici: 0.9 },               // litri all'ora a 18 °C per 75 kg: stima, si tara con le pesate
    sodioMgL: 1000,                                  // sodio perso per litro di sudore (media)
    // cosa porti: un gel da 25 g (il nome compare sull'orologio: corto, senza numeri)
    prodotti: { gel: { nome: "gel", g: 25 } },
    // scrive gli orari del rifornimento nei lunghi creati dall'app su Intervals: l'orologio vibra e dice cosa prendere
    avvisiOrologio: true,
  },

  resetChiave: false, // metti true e lancia lo script per reinserire la chiave
};

// Fitness (CTL) di riferimento al picco, per tipo di gara, quando il profilo non ne indica una
// Gare per combinazione di sport (chiave: sport in ordine alfabetico). ctl = fitness di riferimento al picco,
// indicativa, usata solo se il profilo non ne indica una
const GARE = {
  "bici+corsa+nuoto": [["sprint", "Sprint", 45], ["olimpico", "Olimpico", 55], ["70.3", "70.3", 70], ["ironman", "Ironman", 85]],
  corsa: [["5k", "5 km", 35], ["10k", "10 km", 42], ["mezza", "Mezza", 50], ["maratona", "Maratona", 60]],
  bici: [["mediofondo", "Mediofondo", 55], ["granfondo", "Granfondo", 65]],
  nuoto: [["nuoto-3k", "Fino a 3 km", 30], ["nuoto-10k", "5–10 km", 40]],
  "bici+corsa": [["duathlon-sprint", "Sprint", 45], ["duathlon", "Standard", 55]],
  "corsa+nuoto": [["aquathlon", "Aquathlon", 40]],
};
const TUTTE_GARE = Object.values(GARE).flat();
const ctlGaraDi = (tipo) => (TUTTE_GARE.find((g) => g[0] === tipo) || [])[2] || null;
const chiaveSport = (sp) => sp.slice().sort().join("+");
// Gli sport della persona: dalla configurazione, oppure (profili della prima versione) da piscina e bici
function sportDi(P) {
  const ok = ["nuoto", "bici", "corsa"];
  if (P && P.soloPalestra) return [];
  if (P && Array.isArray(P.sport) && P.sport.some((x) => ok.includes(x))) return ok.filter((x) => P.sport.includes(x));
  if (!P) return ok.slice();
  return ok.filter((x) => x === "corsa" || (x === "bici" && P.bici !== "no") || (x === "nuoto" && P.piscina !== false));
}

const KEY_NAME = "hud703_intervals_key";
const BASE = "https://intervals.icu/api/v1/athlete/0";
const CACHE_FILE = "hud703-cache-v2.json";
let DETTAGLI = {}; // grafici, percorso e giri delle attività già scaricati (hud703-dettagli.json)

