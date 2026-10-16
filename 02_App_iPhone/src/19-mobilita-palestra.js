// ------------------------------------------------------------
//  Riscaldamento prima della seduta, mobilità del giorno e palestra nel piano.
//  Gli esercizi (foto e come si fanno) sono nella libreria della pagina: qui solo le chiavi.
// ------------------------------------------------------------
const RISC = {
  "corsa-facile": { t: "Corsa facile o lunga", sp: "corsa", min: 5, passi: [["caviglie", "Cerchi con le caviglie", "10 per verso"], ["cerchianca", "Cerchi con l’anca", "8 per lato"], ["wgs", "Affondo con rotazione", "3 per lato"], [null, "I primi 10 minuti più piano", "lascia salire i battiti da soli"]], nota: "Per le uscite facili basta poco: il vero riscaldamento sono i primi minuti lenti." },
  "corsa-qualita": { t: "Corsa di qualità", sp: "corsa", min: 15, passi: [[null, "8–10 minuti di corsa facile", "gli ultimi 2 un po’ più svelti"], ["wgs", "Affondo con rotazione", "3 per lato"], ["skip", "Skip", "2 × 20 m"], ["calciata", "Calciata", "2 × 20 m"], [null, "3 allunghi di 20 secondi", "veloci ma sciolti, ritorno camminando"]], nota: "Prima delle ripetute il corpo deve arrivare già caldo: i battiti salgono prima e la prima ripetuta non va sprecata." },
  "bici": { t: "Bici facile o lunga", sp: "bici", min: 5, passi: [[null, "5 minuti agili", "cadenza 85–95, battiti bassi"], [null, "Poi entra nel ritmo della seduta", "senza strappi in salita nei primi 15 minuti"]], nota: "In bici il riscaldamento si fa pedalando: niente esercizi a terra." },
  "bici-qualita": { t: "Bici di qualità", sp: "bici", min: 12, passi: [[null, "5 minuti agili", "cadenza 85–95, battiti bassi"], [null, "3 minuti con la cadenza che sale", "ogni minuto 5 pedalate in più"], [null, "3 accelerazioni di 30 secondi", "1 minuto facile tra una e l’altra"], [null, "2 minuti facili", "poi parte la prima ripetuta"]], nota: "Le prime ripetute vengono meglio con le gambe già sveglie: le accelerazioni servono a questo." },
  "nuoto": { t: "Nuoto", sp: "nuoto", min: 8, passi: [["cerchibraccia", "Cerchi con le braccia", "30\" avanti e indietro"], ["apertura", "Apertura con elastico", "15"], ["rotest", "Rotazione esterna con elastico", "10 per lato"], [null, "In acqua: 200–400 m facili", "misti, poi 4 × 25 m in progressione"]], nota: "Le spalle sono la parte che soffre di più nel nuoto: 5 minuti a bordo vasca evitano fastidi." },
  "palestra": { t: "Palestra", sp: "forza", min: 6, passi: [["gattomucca", "Gatto-mucca", "45\""], ["inchworm", "Inchworm", "5"], ["ponte", "Ponte glutei", "10"], [null, "2 serie leggere del primo esercizio", "metà carico, 8 ripetizioni"]], nota: "Le serie leggere servono a provare il movimento prima di caricare." },
};
function riscDi(e) {
  if (!e) return null;
  const q = e.parsed ? isQualityEv(e) : false;
  if (e.sport === "corsa") return q ? "corsa-qualita" : "corsa-facile";
  if (e.sport === "bici") return q ? "bici-qualita" : "bici";
  if (e.sport === "nuoto") return "nuoto";
  if (e.sport === "forza") return "palestra";
  return null;
}
// Il blocco «Prima di partire» nel dettaglio della seduta e nel foglio di domani
function riscHTML(e) {
  const k = riscDi(e), R = k && RISC[k];
  if (!R) return "";
  return `<div class="label caps" style="margin:2px 2px -4px">Prima di partire · ${R.min}'</div>
  <div class="steps riscl">${R.passi.map((p) => `<div class="rr"><span class="t15 grow">${esc(p[1])}</span><span class="t13 muted">${esc(p[2] || "")}</span></div>`).join("")}</div>
  ${R.passi.some((p) => p[0]) ? `<button class="linkbtn" data-risc="${k}" style="align-self:flex-start">Guarda come si fanno ›</button>` : ""}`;
}

// La libreria degli esercizi: [chiave, nome, id nel Free Exercise DB, attrezzo, gruppo, dose, come si fa]
const ESL = [
 ['squat','Squat a corpo libero','Bodyweight_Squat','libero','gambe','12','Piedi larghi come le spalle, scendi come per sederti, ginocchia nella direzione delle punte, schiena dritta.'],
 ['goblet','Goblet squat','Goblet_Squat','manubri','gambe','10','Peso al petto, gomiti dentro le ginocchia in basso. Scendi lento, spingi dai talloni.'],
 ['squatbil','Squat con bilanciere','Barbell_Squat','palestra','gambe','8','Bilanciere sui trapezi, petto alto, scendi fino a cosce parallele. Carico che lascia 2 ripetizioni di riserva.'],
 ['legpress','Leg press','Leg_Press','palestra','gambe','10','Piedi a metà pedana, scendi finché la schiena resta appoggiata, non bloccare le ginocchia in alto.'],
 ['affondo','Affondi in camminata','Bodyweight_Walking_Lunge','libero','mono','8 per lato','Passo lungo, ginocchio dietro quasi a terra, busto dritto. Spingi con il tallone davanti.'],
 ['affondoman','Affondo indietro con manubri','Dumbbell_Rear_Lunge','manubri','mono','8 per lato','Fai un passo indietro, scendi in verticale, torna spingendo con la gamba davanti.'],
 ['bulgaro','Split squat con manubri','Split_Squat_with_Dumbbells','manubri','mono','8 per lato','Gambe a forbice, scendi dritto in basso, peso sulla gamba davanti.'],
 ['stepup','Step-up con manubri','Dumbbell_Step_Ups','manubri','mono','8 per lato','Sali su una panca o un gradino alto spingendo solo con la gamba sopra, scendi lento.'],
 ['stepupl','Step-up con ginocchio alto','Step-up_with_Knee_Raise','libero','mono','10 per lato','Sali sul gradino e porta su l’altro ginocchio, come in corsa. Scendi controllato.'],
 ['rdl','Stacco rumeno','Romanian_Deadlift','palestra','post','8','Ginocchia appena piegate, scendi spingendo il bacino indietro, bilanciere vicino alle gambe, schiena dritta.'],
 ['rdl1','Stacco su una gamba','Kettlebell_One-Legged_Deadlift','manubri','post','8 per lato','In equilibrio su una gamba, busto avanti e gamba dietro in linea. Il peso scende vicino alla gamba.'],
 ['ponte','Ponte glutei','Butt_Lift_Bridge','libero','post','15','Schiena a terra, piedi vicini ai glutei: alza il bacino stringendo i glutei, 2 secondi su.'],
 ['ponte1','Ponte su una gamba','Single_Leg_Glute_Bridge','libero','glutei','12 per lato','Come il ponte, ma su una gamba. Il bacino resta dritto, non ruota.'],
 ['hipthrust','Hip thrust','Barbell_Hip_Thrust','palestra','post','10','Schiena sulla panca, bilanciere sul bacino: spingi in alto fino ad allineare busto e cosce.'],
 ['polpacci','Sollevamenti sulle punte','Standing_Dumbbell_Calf_Raise','libero','polpacci','15','Su un gradino, sali in punta in 1 secondo e scendi in 3 sotto il gradino. Anche su una gamba sola.'],
 ['polpaccim','Sollevamenti sulle punte con manubri','Standing_Dumbbell_Calf_Raise','manubri','polpacci','12','Manubri in mano, su un gradino: su veloce, giù lento in 3 secondi.'],
 ['polpaccip','Polpacci alla macchina','Standing_Calf_Raises','palestra','polpacci','12','Spalle sotto i cuscinetti, scendi bene con i talloni, sali in punta e tieni 1 secondo.'],
 ['legcurl','Leg curl','Lying_Leg_Curls','palestra','post','10','Piega le ginocchia portando i talloni verso i glutei, torna giù lento.'],
 ['mostro','Camminata laterale con elastico','Monster_Walk','elastico','glutei','12 passi per lato','Elastico sopra le ginocchia o alle caviglie, mezzo piegamento, passi laterali senza far cedere le ginocchia.'],
 ['adduttori','Adduttori con elastico','Band_Hip_Adductions','elastico','glutei','12 per lato','Elastico alla caviglia, porta la gamba verso l’interno davanti all’altra, lento.'],
 ['swing','Swing con kettlebell','One-Arm_Kettlebell_Swings','manubri','plio','15','Spinta del bacino, non delle braccia: il peso sale fino al petto, schiena dritta.'],
 ['squatjump','Squat jump','Freehand_Jump_Squat','libero','plio','8','Mezzo squat e salto, atterra morbido sulle punte e riparti. Solo se senza dolori.'],
 ['skip','Skip veloce','Fast_Skipping','libero','plio','2 × 20 m','Passi corti e rapidi sull’avampiede, ginocchia su, braccia che lavorano.'],
 ['balzilat','Balzi laterali','Lateral_Bound','libero','plio','6 per lato','Salta di lato su una gamba e atterra stabile sull’altra, tieni 1 secondo.'],
 ['plank','Plank','Plank','libero','core','40"','Gomiti sotto le spalle, corpo in linea, glutei e addome stretti. Respira.'],
 ['plankl','Plank laterale','Side_Bridge','libero','core','30" per lato','Su un gomito, bacino alto in linea con spalle e piedi.'],
 ['deadbug','Dead bug','Dead_Bug','libero','core','8 per lato','Schiena incollata a terra: allunga braccio e gamba opposti, torna, cambia lato.'],
 ['superman','Superman','Superman','libero','core','10','A pancia in giù, alza insieme braccia e gambe di pochi centimetri, tieni 2 secondi.'],
 ['pallof','Pallof press','Pallof_Press','palestra','core','10 per lato','Cavo o elastico al fianco: spingi le mani avanti e non lasciarti ruotare.'],
 ['russian','Russian twist','Russian_Twist','libero','core','12 per lato','Seduto, busto inclinato indietro, ruota le spalle da un lato all’altro.'],
 ['mountain','Mountain climber','Mountain_Climbers','libero','core','30"','In posizione di piegamento, porta le ginocchia al petto alternando, bacino basso.'],
 ['piegamenti','Piegamenti','Pushups','libero','spinta','10','Mani sotto le spalle, corpo in linea, petto a un pugno dal pavimento. Sulle ginocchia se serve.'],
 ['panca','Panca piana','Barbell_Bench_Press_-_Medium_Grip','palestra','spinta','8','Scapole strette sulla panca, il bilanciere scende a metà petto, spingi in su.'],
 ['spinte','Spinte sopra la testa','Dumbbell_Shoulder_Press','manubri','spinta','10','Manubri all’altezza delle spalle, spingi in alto senza inarcare la schiena.'],
 ['rematore','Rematore con manubri','Bent_Over_Two-Dumbbell_Row','manubri','tirata','10','Busto inclinato, schiena dritta: porta i gomiti indietro vicino ai fianchi.'],
 ['rematorebil','Rematore con bilanciere','Bent_Over_Barbell_Row','palestra','tirata','8','Busto a 45 gradi, tira il bilanciere verso l’ombelico, scapole strette.'],
 ['lat','Lat machine','Wide-Grip_Lat_Pulldown','palestra','tirata','10','Tira la barra al petto portando i gomiti in basso, petto alto, niente slanci.'],
 ['trazioni','Trazioni','Chin-Up','libero','tirata','5','Alla sbarra, tira il mento sopra la barra. Con l’elastico se servono aiuti.'],
 ['facepull','Face pull','Face_Pull','palestra','spalle','12','Corda al cavo alto: tira verso il viso aprendo i gomiti, scapole indietro.'],
 ['rotest','Rotazione esterna con elastico','External_Rotation_with_Band','elastico','spalle','15 per lato','Gomito attaccato al fianco a 90 gradi, ruota l’avambraccio verso l’esterno. Lento.'],
 ['apertura','Apertura con elastico','Band_Pull_Apart','elastico','spalle','15','Braccia tese davanti, apri l’elastico fino al petto stringendo le scapole.'],
 ['alzatepost','Alzate posteriori','Seated_Bent-Over_Rear_Delt_Raise','manubri','spalle','12','Seduto e piegato in avanti, apri le braccia di lato con i gomiti morbidi.'],
 ['contadino','Camminata del contadino','Farmers_Walk','manubri','core','40 m','Due pesi pesanti ai lati, cammina dritto con le spalle basse e l’addome stretto.'],
 ['gattomucca','Gatto-mucca','Cat_Stretch','libero','mob','60"','A quattro zampe: inarca e arrotonda la schiena con il respiro, lento.'],
 ['wgs','Affondo con rotazione','Worlds_Greatest_Stretch','libero','mob','5 per lato','Affondo lungo, gomito verso il piede davanti, poi ruota il busto aprendo il braccio al cielo.'],
 ['flessori','Flessori dell’anca in ginocchio','Kneeling_Hip_Flexor','libero','mob','45" per lato','Un ginocchio a terra, bacino in avanti e glutei stretti: senti tirare davanti all’anca.'],
 ['caviglie','Cerchi con le caviglie','Ankle_Circles','libero','mob','10 per verso','Disegna cerchi ampi con la punta del piede, nei due versi.'],
 ['polpaccimuro','Polpacci al muro','Calf_Stretch_Hands_Against_Wall','libero','mob','45" per lato','Mani al muro, gamba dietro tesa e tallone a terra; poi ginocchio piegato per il soleo.'],
 ['femorali','Allungamento dei femorali','Hamstring_Stretch','libero','mob','45" per lato','Gamba tesa, porta il busto in avanti dalla piega dell’anca, schiena lunga.'],
 ['quad','Quadricipite in piedi','Standing_Elevated_Quad_Stretch','libero','mob','45" per lato','Piede dietro appoggiato in alto, ginocchio verso il basso, bacino in avanti.'],
 ['bambino','Posizione del bambino','Childs_Pose','libero','mob','60"','Seduto sui talloni, braccia avanti e fronte a terra. Respira nella schiena.'],
 ['ginpetto','Ginocchio al petto','One_Knee_To_Chest','libero','mob','45" per lato','Sdraiato, porta un ginocchio al petto, l’altra gamba resta lunga.'],
 ['torsione','Torsione della schiena','Spinal_Stretch','libero','mob','45" per lato','Seduto o sdraiato, ruota il busto da un lato tenendo il bacino fermo.'],
 ['groiners','Groiners','Groiners','libero','mob','6 per lato','Da piegamento, porta un piede accanto alla mano e spingi il bacino giù, poi cambia.'],
 ['inchworm','Inchworm','Inchworm','libero','mob','5','Piegati e cammina con le mani fino al piegamento, poi torna con i piedi verso le mani.'],
 ['cerchibraccia','Cerchi con le braccia','Arm_Circles','libero','mob','30"','Braccia tese di lato, cerchi piccoli che diventano grandi, avanti e indietro.'],
 ['petto','Apertura del petto','Dynamic_Chest_Stretch','libero','mob','30"','Apri e chiudi le braccia davanti al petto, ampie e senza strappi.'],
 ['cerchianca','Cerchi con l’anca','Standing_Hip_Circles','libero','mob','8 per lato','In piedi, ginocchio su e disegna un cerchio grande con l’anca.'],
 ['calciata','Calciata','Double_Leg_Butt_Kick','libero','plio','2 × 20 m','Corsa sul posto o avanzando, talloni ai glutei, passi rapidi.'],
 ['rullopiri','Piriforme con il rullo','Piriformis-SMR','palestra','mob','60" per lato','Seduto sul rullo, caviglia sul ginocchio opposto, rotola piano sul gluteo.'],
 ['rulloquad','Quadricipiti con il rullo','Quadriceps-SMR','palestra','mob','60"','A pancia in giù sul rullo, rotola dall’anca al ginocchio, lento.']
];
const ES_NOME = new Map(ESL.map((x) => [x[1].toLowerCase(), x[0]]));
// Gli esercizi scritti nella descrizione di una seduta di palestra («Goblet squat · 3 × 10»)
function eserciziDi(e) {
  const out = [];
  for (const riga of String((e && e.description) || "").split("\n")) {
    const [nome, dose] = riga.replace(/^[-•*\s]+/, "").split(" · ");
    const k = ES_NOME.get((nome || "").trim().toLowerCase());
    if (k && !out.some((x) => x[0] === k)) out.push([k, (dose || "").trim()]);
  }
  return out;
}
function eserciziHTML(e) {
  const L = eserciziDi(e);
  if (L.length < 2) return "";
  const dati = L.map(([k, d]) => `${k}:${d.replace(/[,:"<>]/g, " ")}`).join(",");
  return `<h3>Gli esercizi</h3><div class="card list esl" data-esl="${esc(dati)}"></div><button class="primary" data-gymgo="${esc(dati)}">Inizia con la guida</button>`;
}

// Le routine di mobilità: [esercizio, secondi, lati]
const MOB = {
  anche: ["Anche e caviglie", [["polpaccimuro", 45, 2], ["flessori", 45, 2], ["femorali", 45, 2], ["ginpetto", 45, 2], ["gattomucca", 60, 1], ["bambino", 60, 1]]],
  schiena: ["Schiena e spalle", [["gattomucca", 60, 1], ["bambino", 60, 1], ["torsione", 45, 2], ["petto", 45, 1], ["cerchibraccia", 30, 1], ["inchworm", 60, 1]]],
  risveglio: ["Risveglio", [["caviglie", 30, 1], ["cerchianca", 30, 2], ["wgs", 45, 2], ["inchworm", 45, 1], ["gattomucca", 45, 1], ["cerchibraccia", 30, 1]]],
  sera: ["Prima di dormire", [["bambino", 90, 1], ["ginpetto", 45, 2], ["torsione", 45, 2], ["femorali", 45, 2], ["quad", 45, 2]]],
};
// l'app può scrivere sedute su Intervals? (no in demo, senza chiave o con un piano proprio)
const SCRIVE_APP = (A) => !A.demo && !A.needSetup && !(typeof PROF !== "undefined" && PROF && PROF.pianoApp === false);
function mobMin(R) { return Math.round(R[1].reduce((t, x) => t + x[1] * x[2] + 10 * x[2], 0) / 60); }
// La routine consigliata oggi: dopo corsa o bici anche e caviglie, dopo nuoto o palestra schiena e spalle
function mobDelGiorno(A) {
  const h = A.now.getHours(), sp = new Set((A.todayEv || []).map((e) => e.sport));
  if (A.gymToday) sp.add("forza");
  if (h >= 21) return ["sera", "prima di dormire"];
  if (h < 9) return ["risveglio", "per iniziare la giornata"];
  if (sp.has("corsa")) return ["anche", "dopo la corsa"];
  if (sp.has("bici")) return ["anche", "dopo la bici"];
  if (sp.has("nuoto")) return ["schiena", "dopo il nuoto"];
  if (sp.has("forza")) return ["schiena", "dopo la palestra"];
  return [Math.floor(A.now.getTime() / 864e5) % 2 ? "anche" : "schiena", "giorno di riposo"];
}

// «Metti nel piano»: la seduta di palestra scelta diventa una seduta su Intervals (una sola per giorno: se c'è già, si aggiorna)
async function palestraNelPiano(key, o, raw) {
  const oggi = ymd(new Date()), fino = ymd(addDays(new Date(), 13));
  if (!/^\d{4}-\d\d-\d\d$/.test(o.data || "") || o.data < oggi || o.data > fino) throw new Error("giorno non valido");
  const min = Math.max(10, Math.min(120, Math.round(+o.min || 30)));
  const righe = (Array.isArray(o.righe) ? o.righe : []).slice(0, 14).map((r) => String(r).replace(/[\r\n]+/g, " ").replace(/(\d+)\s*["″]/g, "$1 secondi").replace(/(\d+)\s*['′]/g, "$1 minuti").slice(0, 90));
  const nome = String(o.nome || "Palestra").replace(/[\r\n]+/g, " ").slice(0, 60);
  const ext = `hudgym-${o.data}`;
  const corpo = { category: "WORKOUT", type: "WeightTraining", name: nome, moving_time: min * 60, description: [`${nome} · ${min}'`, ...righe, "", "Dall'HUD: foto e video degli esercizi nella scheda Piano › Palestra."].join("\n") };
  const gia = await ivRichiesta(key, "GET", `/events?oldest=${o.data}&newest=${o.data}`);
  const stesso = (Array.isArray(gia) ? gia : []).find((e) => e.external_id === ext);
  let ev;
  if (stesso) ev = await ivRichiesta(key, "PUT", `/events/${stesso.id}`, corpo);
  else ev = await ivRichiesta(key, "POST", "/events", { ...corpo, start_date_local: `${o.data}T18:00:00`, external_id: ext });
  if (ev && ev.id && Array.isArray(raw.events)) raw.events = [...raw.events.filter((e) => String(e.id) !== String(ev.id)), ev];
  return { nuovo: !stesso, data: o.data };
}

// Diario locale: check-in e proposte accettate (solo su questo iPhone)
function diaryIO() {
  const fm = FileManager.local();
  const p = fm.joinPath(fm.documentsDirectory(), "hud-diario.json");
  return {
    read: () => { try { return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : {}; } catch (e) { return {}; } },
    write: (o) => fm.writeString(p, JSON.stringify(o)),
  };
}

// >>> MUSCOLI (generato da 11_Omini_3D/sincronizza_app.py: non modificare a mano)
// per ogni esercizio: [muscoli che lavorano, che aiutano, che si allungano]; VIDEO_ES = esercizi con il video 3D e il formato
const MUSC = {"squat":[["Quadricipite","Grande gluteo"],["Adduttori","Femorali","Erettori della schiena","Soleo"],[]],"goblet":[["Quadricipite","Grande gluteo"],["Adduttori","Erettori della schiena","Retto dell'addome","Deltoide anteriore","Bicipite"],[]],"squatbil":[["Quadricipite","Grande gluteo"],["Adduttori","Femorali","Erettori della schiena","Trapezio","Retto dell'addome"],[]],"legpress":[["Quadricipite","Grande gluteo"],["Adduttori","Femorali"],[]],"affondo":[["Quadricipite","Grande gluteo"],["Medio gluteo","Adduttori","Femorali","Gastrocnemio"],["Flessori dell'anca"]],"affondoman":[["Quadricipite","Grande gluteo"],["Medio gluteo","Adduttori","Avambraccio"],["Flessori dell'anca"]],"bulgaro":[["Quadricipite","Grande gluteo"],["Medio gluteo","Adduttori"],["Flessori dell'anca"]],"stepup":[["Quadricipite","Grande gluteo"],["Medio gluteo","Gastrocnemio","Avambraccio"],[]],"stepupl":[["Grande gluteo","Quadricipite"],["Flessori dell'anca","Medio gluteo","Gastrocnemio"],[]],"rdl":[["Femorali","Grande gluteo"],["Erettori della schiena","Adduttori","Avambraccio","Trapezio"],[]],"rdl1":[["Femorali","Grande gluteo"],["Medio gluteo","Erettori della schiena","Obliqui"],[]],"ponte":[["Grande gluteo"],["Femorali","Erettori della schiena"],["Flessori dell'anca"]],"ponte1":[["Grande gluteo"],["Medio gluteo","Femorali","Obliqui"],["Flessori dell'anca"]],"hipthrust":[["Grande gluteo"],["Femorali","Quadricipite","Adduttori"],[]],"polpacci":[["Gastrocnemio","Soleo"],["Tibiale anteriore"],[]],"polpaccim":[["Gastrocnemio","Soleo"],["Avambraccio","Trapezio"],[]],"polpaccip":[["Gastrocnemio","Soleo"],["Trapezio"],[]],"legcurl":[["Femorali"],["Gastrocnemio"],[]],"mostro":[["Medio gluteo"],["Grande gluteo","Quadricipite"],[]],"adduttori":[["Adduttori"],["Flessori dell'anca","Obliqui"],[]],"swing":[["Grande gluteo","Femorali"],["Erettori della schiena","Retto dell'addome","Deltoide anteriore","Avambraccio"],[]],"squatjump":[["Quadricipite","Grande gluteo","Gastrocnemio"],["Femorali","Soleo"],[]],"skip":[["Flessori dell'anca","Gastrocnemio"],["Quadricipite","Soleo","Retto dell'addome"],[]],"balzilat":[["Medio gluteo","Quadricipite"],["Grande gluteo","Adduttori","Gastrocnemio"],[]],"plank":[["Retto dell'addome","Obliqui"],["Deltoide anteriore","Grande pettorale","Quadricipite","Dentato anteriore"],[]],"plankl":[["Obliqui","Medio gluteo"],["Retto dell'addome","Deltoide laterale","Erettori della schiena"],[]],"deadbug":[["Retto dell'addome","Obliqui"],["Flessori dell'anca"],[]],"superman":[["Erettori della schiena","Grande gluteo"],["Femorali","Deltoide posteriore","Romboidi e trapezio medio"],[]],"pallof":[["Obliqui","Retto dell'addome"],["Grande pettorale","Deltoide anteriore","Tricipite"],[]],"russian":[["Obliqui","Retto dell'addome"],["Flessori dell'anca"],[]],"mountain":[["Retto dell'addome","Flessori dell'anca"],["Deltoide anteriore","Grande pettorale","Quadricipite"],[]],"piegamenti":[["Grande pettorale","Tricipite"],["Deltoide anteriore","Dentato anteriore","Retto dell'addome"],[]],"panca":[["Grande pettorale","Tricipite"],["Deltoide anteriore"],[]],"spinte":[["Deltoide anteriore","Deltoide laterale"],["Tricipite","Trapezio","Dentato anteriore"],[]],"rematore":[["Gran dorsale","Romboidi e trapezio medio"],["Deltoide posteriore","Bicipite","Erettori della schiena","Avambraccio"],[]],"rematorebil":[["Gran dorsale","Romboidi e trapezio medio"],["Deltoide posteriore","Bicipite","Erettori della schiena","Avambraccio"],[]],"lat":[["Gran dorsale"],["Bicipite","Romboidi e trapezio medio","Deltoide posteriore","Avambraccio"],[]],"trazioni":[["Gran dorsale","Bicipite"],["Romboidi e trapezio medio","Avambraccio","Retto dell'addome"],[]],"facepull":[["Deltoide posteriore","Romboidi e trapezio medio"],["Cuffia dei rotatori","Trapezio"],[]],"rotest":[["Cuffia dei rotatori"],["Deltoide posteriore"],[]],"apertura":[["Deltoide posteriore","Romboidi e trapezio medio"],["Cuffia dei rotatori","Trapezio"],["Grande pettorale"]],"alzatepost":[["Deltoide posteriore"],["Romboidi e trapezio medio","Cuffia dei rotatori","Trapezio"],[]],"contadino":[["Avambraccio","Trapezio"],["Obliqui","Retto dell'addome","Erettori della schiena","Grande gluteo","Quadricipite"],[]],"gattomucca":[[],[],["Erettori della schiena","Retto dell'addome","Trapezio"]],"wgs":[[],["Quadricipite"],["Flessori dell'anca","Femorali","Adduttori","Grande pettorale"]],"flessori":[["Grande gluteo"],[],["Flessori dell'anca","Quadricipite"]],"caviglie":[["Tibiale anteriore"],["Gastrocnemio","Soleo"],[]],"polpaccimuro":[[],[],["Gastrocnemio","Soleo"]],"femorali":[[],[],["Femorali"]],"quad":[[],["Medio gluteo"],["Quadricipite","Flessori dell'anca"]],"bambino":[[],[],["Gran dorsale","Erettori della schiena","Grande gluteo"]],"ginpetto":[[],[],["Grande gluteo","Erettori della schiena","Femorali"]],"torsione":[[],[],["Obliqui","Erettori della schiena","Gran dorsale","Grande gluteo"]],"groiners":[[],["Deltoide anteriore","Grande pettorale"],["Adduttori","Flessori dell'anca"]],"inchworm":[["Retto dell'addome","Deltoide anteriore"],["Grande pettorale","Tricipite"],["Femorali","Gastrocnemio"]],"cerchibraccia":[["Deltoide laterale","Deltoide anteriore","Deltoide posteriore"],["Cuffia dei rotatori","Trapezio"],[]],"petto":[["Romboidi e trapezio medio","Deltoide posteriore"],[],["Grande pettorale","Deltoide anteriore"]],"cerchianca":[["Flessori dell'anca","Medio gluteo"],["Adduttori","Grande gluteo"],[]],"calciata":[["Femorali"],["Gastrocnemio","Soleo","Quadricipite"],[]],"rullopiri":[[],[],["Grande gluteo","Medio gluteo"]],"rulloquad":[[],[],["Quadricipite"]]};
const VIDEO_ES = {"bambino": "webp", "gattomucca": "webp", "piegamenti": "webp", "plank": "webp", "polpacci": "webp", "ponte": "webp", "squat": "webp"};
// <<< MUSCOLI
