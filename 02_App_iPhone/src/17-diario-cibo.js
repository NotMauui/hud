// ------------------------------------------------------------
//  Diario del cibo: "180 g di pasta, 150 di pollo e un cucchiaio d'olio" → grammi, calorie e macro
// ------------------------------------------------------------
// Per 100 g (pasta, riso e cereali crudi, come nel piano): kcal, carboidrati, proteine, grassi.
// pz = grammi di un pezzo · por = porzione quando non dici quanto · cuc = grammi di un cucchiaio · fetta = grammi di una fetta
const CIBI = [
  [["pasta integrale", "spaghetti integrali", "penne integrali"], "pasta integrale", 340, 66, 13, 2.5, { por: 100 }],
  [["gnocchi"], "gnocchi", 150, 33, 4, 0.3, { por: 250 }],
  [["pasta", "spaghetti", "penne", "fusilli", "rigatoni", "maccheroni", "linguine", "farfalle", "paccheri", "tagliatelle", "orecchiette", "pastasciutta"], "pasta", 353, 72, 12.5, 1.5, { por: 100 }],
  [["risotto", "riso basmati", "riso integrale", "riso"], "riso", 350, 79, 7, 0.6, { por: 90 }],
  [["cous cous", "couscous"], "cous cous", 360, 72, 12, 1.5, { por: 80 }],
  [["farro", "orzo", "quinoa", "cereali in chicco"], "farro o quinoa", 340, 67, 13, 2.5, { por: 80 }],
  [["fette biscottate", "fetta biscottata", "fette biscottata"], "fette biscottate", 410, 76, 11, 6, { pz: 10, fetta: 10, por: 40 }],
  [["fiocchi d avena", "fiocchi di avena", "avena", "porridge"], "avena", 370, 60, 13, 7, { por: 50, cuc: 10 }],
  [["corn flakes", "cornflakes", "cereali", "muesli", "granola"], "cereali", 375, 78, 8, 3, { por: 40, cuc: 8 }],
  [["gallette", "galletta", "gallette di riso"], "gallette", 380, 80, 8, 3, { pz: 8, por: 24 }],
  [["crackers", "cracker", "grissini", "taralli"], "crackers", 430, 70, 10, 11, { pz: 25, por: 25 }],
  [["biscotti", "biscotto", "frollini"], "biscotti", 450, 70, 7, 16, { pz: 9, por: 36 }],
  [["cornetto", "cornetti", "brioche", "croissant"], "cornetto", 410, 48, 7, 21, { pz: 60 }],
  [["focaccia"], "focaccia", 300, 45, 7, 10, { pz: 100, fetta: 80, por: 100 }],
  [["pizza"], "pizza", 250, 33, 10, 9, { pz: 320, fetta: 110, por: 320 }],
  [["piadina", "piadine", "tortilla", "wrap"], "piadina", 300, 50, 8, 8, { pz: 100 }],
  [["panino", "panini", "rosetta", "baguette"], "panino", 275, 56, 9, 1.5, { pz: 80 }],
  [["pane integrale", "pane", "pan carre", "pancarre", "bruschetta", "bruschette"], "pane", 270, 55, 8.5, 1.5, { fetta: 30, pz: 50, por: 60 }],
  [["patatine fritte", "patate fritte", "patatine"], "patatine fritte", 312, 41, 3.4, 15, { por: 150 }],
  [["patate", "patata"], "patate", 77, 17, 2, 0.1, { pz: 150, por: 200 }],
  [["lasagne", "lasagna", "parmigiana"], "lasagne", 160, 13, 9, 8, { por: 300 }],
  [["ceci"], "ceci", 120, 17, 7, 2.5, { por: 150, cuc: 20 }],
  [["lenticchie"], "lenticchie", 110, 17, 9, 0.5, { por: 150 }],
  [["fagioli", "piselli", "legumi", "edamame"], "legumi", 100, 15, 7, 0.5, { por: 150 }],
  [["petto di pollo", "pollo", "fesa di tacchino", "tacchino"], "pollo o tacchino", 110, 0, 23, 1.5, { por: 150 }],
  [["hamburger", "burger", "polpette", "salsiccia", "salsicce"], "hamburger", 230, 2, 18, 17, { pz: 120, por: 150 }],
  [["bistecca", "manzo", "vitello", "carne", "tagliata", "filetto", "maiale", "lonza"], "carne", 150, 0, 21, 7, { por: 150 }],
  [["bresaola"], "bresaola", 150, 0, 32, 2, { fetta: 10, por: 50 }],
  [["prosciutto crudo", "crudo", "speck", "salame", "salumi", "mortadella"], "prosciutto crudo", 250, 0, 26, 16, { fetta: 12, por: 50 }],
  [["prosciutto cotto", "cotto", "prosciutto"], "prosciutto cotto", 140, 1, 20, 6, { fetta: 15, por: 50 }],
  [["salmone"], "salmone", 200, 0, 20, 13, { por: 150 }],
  [["tonno sott olio", "tonno all olio"], "tonno sott'olio", 190, 0, 25, 10, { pz: 80, por: 80 }],
  [["tonno"], "tonno", 120, 0, 26, 1.5, { pz: 80, por: 80 }],
  [["gamberi", "gamberetti", "calamari", "polpo", "cozze", "vongole"], "gamberi o molluschi", 85, 1, 17, 1.2, { por: 150 }],
  [["merluzzo", "orata", "branzino", "spigola", "pesce", "sogliola", "platessa", "nasello"], "pesce", 90, 0, 19, 1.5, { por: 200 }],
  [["sushi", "uramaki", "nigiri", "sashimi", "poke"], "sushi", 150, 28, 6, 1.5, { pz: 30, por: 250 }],
  [["albume", "albumi", "chiare"], "albume", 50, 0.7, 11, 0.2, { pz: 33, por: 100 }],
  [["frittata", "uova", "uovo"], "uova", 130, 0.7, 12.5, 9.5, { pz: 60, por: 120 }],
  [["yogurt greco", "skyr", "greco"], "yogurt greco", 57, 4, 10, 0.2, { pz: 150, por: 150, cuc: 20 }],
  [["yogurt", "yogurth", "jogurt"], "yogurt", 65, 4.5, 3.5, 3.5, { pz: 125, por: 125 }],
  [["kefir", "latte", "cappuccino"], "latte", 46, 5, 3.3, 1.6, { por: 250 }],
  [["ricotta"], "ricotta", 140, 3.5, 9, 10, { por: 100, cuc: 20 }],
  [["fiocchi di latte", "cottage"], "fiocchi di latte", 100, 3, 12, 4.5, { pz: 150, por: 150 }],
  [["mozzarella", "mozzarelle", "burrata"], "mozzarella", 250, 1, 18, 19, { pz: 125, por: 125 }],
  [["parmigiano", "grana", "pecorino"], "parmigiano", 390, 0, 33, 28, { por: 20, cuc: 10 }],
  [["formaggio", "formaggi", "stracchino", "fontina", "emmental"], "formaggio", 350, 1, 25, 28, { fetta: 20, por: 50 }],
  [["olio", "olio d oliva", "olio extravergine"], "olio", 900, 0, 0, 100, { por: 10, cuc: 10, filo: 5 }],
  [["burro"], "burro", 720, 0, 1, 82, { por: 10, cuc: 10 }],
  [["burro di arachidi", "burro d arachidi", "crema di arachidi"], "burro di arachidi", 590, 18, 25, 50, { por: 15, cuc: 15 }],
  [["frutta secca", "noci", "noce", "mandorle", "nocciole", "anacardi", "pistacchi", "arachidi"], "frutta secca", 600, 10, 18, 52, { pz: 4, por: 20, manciata: 25 }],
  [["cioccolato fondente", "fondente", "cioccolato", "cioccolata"], "cioccolato fondente", 550, 35, 8, 40, { pz: 10, quadratino: 10, por: 20 }],
  [["miele"], "miele", 304, 82, 0.3, 0, { por: 10, cuc: 20 }],
  [["marmellata", "confettura", "nutella"], "marmellata", 250, 60, 0.5, 0, { por: 20, cuc: 20 }],
  [["zucchero"], "zucchero", 400, 100, 0, 0, { por: 5, cuc: 15 }],
  [["datteri", "dattero"], "datteri", 280, 75, 2.5, 0.4, { pz: 8, por: 24 }],
  [["banana", "banane"], "banana", 90, 21, 1.1, 0.3, { pz: 120 }],
  [["frutti di bosco", "mirtilli", "fragole", "lamponi"], "frutti di bosco", 45, 10, 1, 0.4, { por: 125 }],
  [["mela", "mele", "pera", "pere", "pesca", "pesche", "arancia", "arance", "mandarini", "mandarino", "kiwi", "albicocche", "prugne", "uva", "ananas", "melone", "anguria", "frutta"], "frutta", 50, 12, 0.5, 0.2, { pz: 160 }],
  [["insalata", "verdure", "verdura", "zucchine", "zucchina", "pomodori", "pomodoro", "broccoli", "spinaci", "carote", "carota", "peperoni", "melanzane", "fagiolini", "cavolfiore", "minestrone", "passata", "funghi", "rucola", "finocchi"], "verdure", 25, 4, 1.5, 0.2, { por: 200 }],
  [["barretta proteica", "barrette proteiche", "protein bar"], "barretta proteica", 360, 30, 33, 12, { pz: 50 }],
  [["barretta", "barrette"], "barretta", 380, 65, 8, 8, { pz: 40 }],
  [["gel"], "gel", 250, 62.5, 0, 0, { pz: 40 }],
  [["proteine in polvere", "proteine", "whey", "shake proteico", "frullato proteico"], "proteine in polvere", 380, 6, 78, 6, { por: 30, misurino: 30 }],
  [["gelato", "gelati"], "gelato", 200, 25, 3.5, 10, { pz: 120, por: 120 }],
  [["tiramisu", "dolce", "torta", "crostata", "dessert"], "dolce", 320, 40, 5, 15, { fetta: 100, por: 100 }],
  [["birra", "birre"], "birra", 43, 3.5, 0.5, 0, { pz: 330, por: 330 }],
  [["vino", "prosecco", "spritz"], "vino", 85, 2.6, 0.1, 0, { por: 125 }],
  [["succo", "spremuta"], "succo", 48, 11, 0.5, 0, { por: 200 }],
  [["coca cola", "cola", "aranciata", "bibita"], "bibita", 42, 10.6, 0, 0, { pz: 330, por: 330 }],
  [["caffe", "espresso", "te", "tisana", "acqua", "sali", "elettroliti"], "caffè, tè o acqua", 1, 0, 0, 0, { por: 30 }],
];
const NUMERI_IT = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, mezzo: 0.5, mezza: 0.5, paio: 2, qualche: 2 };
const UNITA_PESO = { kg: 1000, chili: 1000, chilo: 1000, kilo: 1000, g: 1, gr: 1, grammi: 1, grammo: 1, etti: 100, etto: 100, ml: 1, millilitri: 1, cl: 10, l: 1000, litri: 1000, litro: 1000 };
const UNITA_CASA = {
  cucchiaio: "cuc", cucchiai: "cuc", cucchiaino: "cucn", cucchiaini: "cucn", tazza: 250, tazze: 250, tazzina: 30, tazzine: 30, bicchiere: 200, bicchieri: 200,
  vasetto: "pz", vasetti: "pz", fetta: "fetta", fette: "fetta", manciata: "manciata", manciate: "manciata", pezzo: "pz", pezzi: "pz", porzione: "por", porzioni: "por",
  piatto: "por", piatti: "por", scatoletta: 80, scatolette: 80, lattina: 330, lattine: 330, bottiglia: 500, bottiglie: 500, quadratino: "quadratino", quadratini: "quadratino",
  misurino: "misurino", misurini: "misurino", filo: "filo", spicchio: "pz", spicchi: "pz",
};
const senzaAccenti = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "");
const CHIAVI_CIBO = CIBI.flatMap((c) => c[0].map((k) => [senzaAccenti(k), c])).sort((a, b) => b[0].length - a[0].length);
function leggiCibo(testo) {
  let s = senzaAccenti(String(testo || "").toLowerCase()).replace(/[’'`]/g, " ").replace(/\s+/g, " ");
  s = s.replace(/\b(ho mangiato|ho bevuto|mangiato|bevuto|per colazione|a colazione|a pranzo|a cena|come spuntino|per spuntino|a merenda|stamattina|stasera|oggi|adesso|appena)\b/g, " ");
  const pezzi = s.split(/,|;|\.\s|\be poi\b|\bpoi\b|\bed\b|\be\b|\bpiu\b|\bcon\b|\binsieme a\b|\boltre a\b|\binsieme\b/).map((x) => x.trim()).filter(Boolean);
  const voci = [], ignoti = [];
  const NUM = "(\\d+(?:[.,]\\d+)?|un paio di|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|mezzo|mezza|qualche)";
  for (const p of pezzi) {
    // il cibo nominato per primo (in "pasta al pomodoro" conta la pasta); a pari posizione la parola più lunga
    let hit = null, pos = Infinity;
    for (const kc of CHIAVI_CIBO) {
      const mm = new RegExp(`(^|[^a-z])${kc[0].replace(/ /g, "\\s+")}([^a-z]|$)`).exec(p);
      if (mm && mm.index < pos) { pos = mm.index; hit = kc; }
    }
    if (!hit) { const resto = p.replace(/\b(un|uno|una|di|del|della|dello|dei|delle|degli|il|lo|la|i|gli|le|al|alla|po|poco|anche|qualche|d)\b/g, " ").replace(/[\d.,]+/g, " ").trim(); if (resto.length >= 3) ignoti.push(p); continue; }
    const c = hit[1], [, nome, kcal, C, P, G, u] = c;
    const n = (x) => (x === undefined || x === null ? null : /^\d/.test(x) ? parseFloat(x.replace(",", ".")) : x === "un paio di" ? 2 : NUMERI_IT[x] ?? null);
    let g = null, m;
    if ((m = p.match(new RegExp(`${NUM}?\\s*(${Object.keys(UNITA_PESO).join("|")})\\b`))) && (m[1] || /\d/.test(p.slice(0, m.index + 1)))) {
      const q = n(m[1]) ?? 1; g = q * UNITA_PESO[m[2]];
    } else if ((m = p.match(new RegExp(`${NUM}?\\s*(${Object.keys(UNITA_CASA).join("|")})\\b`)))) {
      const q = n(m[1]) ?? 1, tipo = UNITA_CASA[m[2]];
      const base = typeof tipo === "number" ? tipo
        : tipo === "cuc" ? u.cuc || 15 : tipo === "cucn" ? (u.cuc || 15) / 3 : tipo === "fetta" ? u.fetta || u.pz || 30
        : tipo === "manciata" ? u.manciata || 25 : tipo === "quadratino" ? u.quadratino || 10 : tipo === "misurino" ? u.misurino || 30
        : tipo === "filo" ? u.filo || 5 : tipo === "por" ? u.por || u.pz || 100 : u.pz || u.por || 100;
      g = q * base;
    } else if ((m = p.match(new RegExp(`(^|\\s)${NUM}(\\s|$)`)))) {
      const q = n(m[2]);
      if (q !== null) g = /^\d/.test(m[2]) && q >= 15 ? q : q * (u.pz || u.por || 100);
    }
    if (g === null) g = u.por || u.pz || 100;
    g = Math.round(g);
    const k = g / 100;
    voci.push({ n: nome, g, kcal: Math.round(kcal * k), C: Math.round(C * k), P: Math.round(P * k), G: Math.round(G * k) });
  }
  return { voci, ignoti };
}
// Segna nel diario quello che hai mangiato (oggi); tiene due mesi
function registraCibo(dia, testo, now) {
  const r = leggiCibo(testo);
  if (!r.voci.length) return { ...r, voce: null };
  const giorno = ymd(now);
  dia.cibo = dia.cibo || {};
  const voce = { id: `${now.getTime().toString(36)}-${((dia.cibo[giorno] || []).length + 1)}-${Math.floor(Math.random() * 1e6).toString(36)}`, ora: `${pad(now.getHours())}:${pad(now.getMinutes())}`, testo: String(testo).trim().slice(0, 200), voci: r.voci, ignoti: r.ignoti };
  (dia.cibo[giorno] = dia.cibo[giorno] || []).push(voce);
  const limite = ymd(addDays(now, -60));
  for (const d of Object.keys(dia.cibo)) if (d < limite) delete dia.cibo[d];
  return { ...r, voce };
}
function totaleCibo(lista) {
  const t = { kcal: 0, C: 0, P: 0, G: 0 };
  for (const e of lista || []) for (const v of e.voci || []) { t.kcal += v.kcal; t.C += v.C; t.P += v.P; t.G += v.G; }
  return t;
}
// Open Food Facts (dati ODbL, inseriti da chi li usa): il prodotto dal codice a barre, valori per 100 g
async function prodottoOFF(codice) {
  const c = String(codice || "").replace(/\D/g, "");
  if (!/^\d{8,14}$/.test(c)) return { errore: "Il codice a barre ha da 8 a 14 cifre" };
  try {
    const r = new Request(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,product_name_it,brands,nutriments,serving_quantity&lc=it`);
    r.headers = { "User-Agent": `HUD/${VERSIONE} (${CONFIG.repository || "app personale"})`, Accept: "application/json" };
    r.timeoutInterval = 15;
    const j = await r.loadJSON();
    const p = j && j.status === 1 && j.product;
    if (!p) return { errore: "Prodotto non trovato su Open Food Facts: scrivilo a mano", codice: c };
    const n = p.nutriments || {};
    const kcal = num(n["energy-kcal_100g"]) ?? (num(n.energy_100g) !== null ? n.energy_100g / 4.184 : null);
    if (kcal === null) return { errore: "Su Open Food Facts mancano le calorie di questo prodotto: scrivilo a mano", codice: c };
    const v = (k) => Math.round((num(n[k]) || 0) * 10) / 10, porz = num(p.serving_quantity);
    return { codice: c, nome: String(p.product_name_it || p.product_name || "Prodotto").trim().slice(0, 80) || "Prodotto", marca: String(p.brands || "").split(",")[0].trim().slice(0, 40),
      kcal: Math.round(kcal), C: v("carbohydrates_100g"), P: v("proteins_100g"), G: v("fat_100g"), porzione: porz && porz > 0 && porz < 2000 ? Math.round(porz) : 100 };
  } catch (e) { return { errore: "Open Food Facts non risponde: serve la rete", codice: c }; }
}
// Segna un prodotto confezionato (grammi scelti nella pagina) come una voce del diario del cibo
function registraProdotto(dia, x, now) {
  const ok = (v, max) => typeof v === "number" && isFinite(v) && v >= 0 && v <= max, g = Math.round(+x.g);
  if (!(g > 0 && g <= 2000) || !ok(x.kcal, 950) || !ok(x.C, 100) || !ok(x.P, 100) || !ok(x.G, 100)) return null;
  const nome = String(x.nome || "Prodotto").slice(0, 80), k = g / 100, giorno = ymd(now);
  dia.cibo = dia.cibo || {};
  const voce = { id: `${now.getTime().toString(36)}-${((dia.cibo[giorno] || []).length + 1)}-${Math.floor(Math.random() * 1e6).toString(36)}`, ora: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    testo: `${nome} ${g} g`, voci: [{ n: nome, g, kcal: Math.round(x.kcal * k), C: Math.round(x.C * k), P: Math.round(x.P * k), G: Math.round(x.G * k) }], ignoti: [], codice: String(x.codice || "").replace(/\D/g, "").slice(0, 14) };
  (dia.cibo[giorno] = dia.cibo[giorno] || []).push(voce);
  return voce.voci[0];
}
// Acqua da bere: EFSA 2010 (acqua totale 2,5 l uomini, 2,0 l donne, circa l'80% dalle bevande) più mezzo litro
// per ogni ora di allenamento di oggi; il resto del sudore si beve durante la seduta, con le dosi del Rifornimento
function acquaDi(A) {
  const base = PROF && PROF.corpo && PROF.corpo.sesso === "F" ? 1600 : 2000;
  const min = (A.todayEv || []).filter((e) => e.sport !== "forza").reduce((t, e) => t + (e.done ? Math.round((num(e.done.moving_time) || 0) / 60) : e.min || 0), 0);
  return { ml: Math.max(0, Math.min(8000, +(((A.diary || {}).acqua || {})[ymd(A.now)]) || 0)), obiettivo: Math.round((base + (500 * min) / 60) / 50) * 50, base, min };
}
const descriviVoci = (voci) => voci.map((v) => `${v.n} ${v.g} g`).join(", ");

const nomeScript = () => { try { return typeof Script !== "undefined" && Script.name ? Script.name() || "HUD" : "HUD"; } catch (e) { return "HUD"; } };

