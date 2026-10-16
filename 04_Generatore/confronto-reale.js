// Confronta i blocchi del generatore con quello che Atleta reale ha fatto davvero.
// Uso: node confronto-reale.js <percorso di hud-dati.json>
// Crea confronto-reale.html (dati personali: resta in questa cartella).
const fs = require("fs");
const { generaBlocco, parseYMD, addDays, ymd } = require("./generatore.js");
const { carica, profiloAl, settimanaReale } = require("./dati-reali.js");
const { reale } = require("./profili.js");

const file = process.argv[2] || "/mnt/user-data/uploads/Documents/hud-dati.json";
const D = carica(file);
const h = (m) => (m / 60).toFixed(1).replace(".", ",") + " h";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ggm = (s) => { const d = parseYMD(s); return `${d.getDate()} ${["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"][d.getMonth()]}`; };
const oggi = D.esportato.slice(0, 10);

function genSett(s) {
  const per = { nuoto: 0, bici: 0, corsa: 0, forza: 0 };
  for (const x of s.sedute) if (per[x.sport] !== undefined) per[x.sport] += x.min;
  return { per, minuti: per.nuoto + per.bici + per.corsa, lungoCorsa: s.lungoCorsa, qualita: s.sedute.filter((x) => x.qualita).map((x) => `${x.sport} · ${x.nome}`), carico: s.carico, fase: s.fase, scarico: s.scarico, sedute: s.sedute };
}

const blocchi = [];
for (const inizio of ["2026-08-31", "2026-09-28"]) {
  const prof = profiloAl(D, inizio, reale);
  const piano = generaBlocco(prof, { inizio });
  const righe = piano.settimane.map((s, i) => {
    const lun = addDays(parseYMD(inizio), 7 * i);
    const r = settimanaReale(D, lun);
    const futura = ymd(lun) > oggi;
    return { lun: ymd(lun), g: genSett(s), r, futura, parziale: !futura && ymd(addDays(lun, 6)) >= oggi };
  });
  blocchi.push({ inizio, prof, piano, righe });
}
// Il prossimo blocco, con il profilo di oggi
const prossimo = generaBlocco(profiloAl(D, "2026-10-12", reale), { inizio: "2026-10-12" });

// ---- Letture automatiche
const note = [];
for (const B of blocchi) for (const x of B.righe) {
  if (x.futura) continue;
  const endR = x.r.per.nuoto + x.r.per.bici + x.r.per.corsa;
  if (endR < x.g.minuti * 0.6) note.push(`Settimana del ${ggm(x.lun)}: fatte ${h(endR)} di endurance su ${h(x.g.minuti)} che il generatore avrebbe proposto.`);
  if (x.r.lungoCorsa > x.g.lungoCorsa * 1.6 && x.r.lungoCorsa >= 90) note.push(`Settimana del ${ggm(x.lun)}: uscita di corsa da ${x.r.lungoCorsa}' contro un lungo previsto di ${x.g.lungoCorsa}'. Gare e trail fanno salire molto l'impatto.`);
}

const tabBlocco = (B) => `<table><thead><tr><th class="l">Settimana</th><th class="l">Fase</th><th></th><th>Endurance</th><th>Nuoto</th><th>Bici</th><th>Corsa</th><th>Palestra</th><th>Lungo corsa</th><th>Qualità</th><th>Carico</th></tr></thead><tbody>
${B.righe.map((x) => `<tr class="g"><td class="l" rowspan="2"><b>${ggm(x.lun)}</b>${x.futura ? "<br><small>da fare</small>" : x.parziale ? "<br><small>in corso</small>" : ""}</td><td class="l" rowspan="2">${x.g.fase}${x.g.scarico ? " · scarico" : ""}</td>
  <td class="who">Generatore</td><td>${h(x.g.minuti)}</td><td>${h(x.g.per.nuoto)}</td><td>${h(x.g.per.bici)}</td><td>${h(x.g.per.corsa)}</td><td>${h(x.g.per.forza)}</td><td>${x.g.lungoCorsa}'</td><td>${x.g.qualita.length}</td><td>${x.g.carico}</td></tr>
  <tr class="r"><td class="who">Fatto</td>${x.futura ? `<td colspan="8" class="mut">—</td>` : `<td>${h(x.r.per.nuoto + x.r.per.bici + x.r.per.corsa)}</td><td>${h(x.r.per.nuoto)}</td><td>${h(x.r.per.bici)}</td><td>${h(x.r.per.corsa)}</td><td>${h(x.r.per.forza)}</td><td>${x.r.lungoCorsa}'</td><td title="${esc(x.r.qualita.join("\n"))}">${x.r.qualita.length}</td><td>${x.r.carico}</td>`}</tr>`).join("")}
</tbody></table>`;

const profRow = (p) => `Fitness (CTL) ${p.livello.ctl} · fatica ${p.livello.atl} · ${String(p.livello.oreSett).replace(".", ",")} h/sett. nelle 4 settimane prima · lungo tipico di corsa ${p.livello.lungoCorsaMin}', di bici ${p.livello.lungoBiciMin}' · minuti a settimana: nuoto ${p.livello.minPerSport.nuoto}, bici ${p.livello.minPerSport.bici}, corsa ${p.livello.minPerSport.corsa}`;

const GG = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const COLS = { nuoto: "#0A84FF", bici: "#FF453A", corsa: "#E0A800", forza: "#30A14E" };
const sett0 = prossimo.settimane[0];
const giorni = GG.map((g, i) => `<div class="day"><div class="dn">${g}</div>${sett0.sedute.filter((x) => x.giorno === i).map((x) => `<div class="ses" style="border-left-color:${COLS[x.sport]}"><b>${esc(x.nome)}</b><span>${x.sport} · ${x.min}'${x.qualita ? " · qualità" : ""}</span></div>`).join("") || '<div class="rest">riposo</div>'}</div>`).join("");

const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Generatore contro realtà</title>
<style>
:root{--ink:#1d1d1f;--mut:#6e6e73;--line:#e5e5ea;--bg:#f5f5f7;--card:#fff;--acc:#E8590C}
@media (prefers-color-scheme:dark){:root{--ink:#f5f5f7;--mut:#a1a1a6;--line:#38383a;--bg:#000;--card:#1c1c1e;--acc:#FF9F45}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif}
main{max-width:1180px;margin:0 auto;padding:40px 24px 80px}h1{font-size:34px;letter-spacing:-.02em;margin:0 0 4px}h2{font-size:22px;margin:36px 0 10px}
.sub{color:var(--mut)}.card{background:var(--card);border-radius:16px;padding:16px;overflow-x:auto}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.l,.who{text-align:left}
tr.g td{border-bottom:0}.who{color:var(--mut);font-size:13px}tr.r td{font-weight:600}small,.mut{color:var(--mut);font-weight:400}
ul{margin:0;padding-left:20px}li{margin:6px 0}
.days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.day{display:flex;flex-direction:column;gap:6px}.dn{font-size:12px;color:var(--mut);font-weight:600}
.ses{border-left:4px solid;border-radius:6px;background:var(--bg);padding:6px 8px;font-size:12px;display:flex;flex-direction:column}.ses span{color:var(--mut)}.rest{font-size:12px;color:var(--mut)}
@media (max-width:800px){.days{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main>
<h1>Il generatore contro la realtà</h1>
<div class="sub">Dati esportati dall'app il ${ggm(oggi)} · attività dal ${ggm(D.acts.map((a) => a.data).sort()[0])} · ogni blocco è rigenerato con il profilo calcolato dai dati veri del giorno prima</div>

<h2>Cosa emerge</h2>
<div class="card"><ul>
<li><b>Il profilo vero è molto diverso da quello ipotizzato.</b> Il generatore partiva da fitness 55 e 10 h a settimana; i dati dicono fitness intorno a 36 e 7–10 h di endurance, con la corsa che ha fatto quasi tutto il volume fino ad agosto e nuoto e bici entrati solo a settembre.</li>
<li><b>La palestra fino a settembre pesava 3–5 ore a settimana</b>, più di quanto il generatore metta (2 sedute, circa 1,5 h). Dall'8 ottobre hai scelto 2 sedute: ora piano e generatore coincidono.</li>
<li><b>Il rientro di corsa ora è una regola.</b> Dopo più di 10 giorni senza corsa, o meno di un'ora nelle ultime 2 settimane, il lungo riparte da 50' e cresce di 10' ogni 2 settimane. Con i tuoi dati di oggi il generatore propone 50' → 50' → 60' → scarico: lo stesso "lungo rientro 50 min" che hai già in Intervals per domenica.</li>
<li><b>Il generatore non può prevedere le pause.</b> Il blocco del 28 settembre era costruito su 3 settimane di corsa regolare; la settimana dopo la corsa si è fermata. Per questo il piano è vivo: il motore quotidiano adatta le sedute e il blocco successivo riparte dai dati veri.</li>
<li><b>Gare e trail falsavano il punto di partenza.</b> Uscite da 2,5–4 ore (gara, trail camminato) facevano sembrare il lungo tipico di 150–250'. Ora il generatore usa la mediana delle 3 uscite più lunghe, esclude quelle segnate come gara in Intervals e quelle più lente di circa 7'15"/km (camminate). Conviene segnare sempre le gare come tali.</li>
<li><b>Le settimane reali sono irregolari:</b> si alternano picchi (12–13 h) e cali forti (una settimana a zero ad agosto, 3,7 h la settimana scorsa). Il generatore propone una crescita regolare: la differenza più grande non è nel tipo di sedute ma nella continuità.</li>
${note.map((n) => `<li>${esc(n)}</li>`).join("")}
</ul></div>

${blocchi.map((B, i) => `<h2>Blocco ${i + 1} · dal ${ggm(B.inizio)}</h2>
<div class="sub" style="margin-bottom:10px">${profRow(B.prof)}</div>
<div class="card">${tabBlocco(B)}</div>
${B.piano.avvisi.length ? `<div class="sub" style="margin-top:8px">Avvisi del generatore: ${B.piano.avvisi.map(esc).join(" · ")}</div>` : ""}`).join("")}

<h2>Il prossimo blocco, con i tuoi dati di oggi</h2>
<div class="sub" style="margin-bottom:10px">${profRow(profiloAl(D, "2026-10-12", reale))}</div>
<div class="card"><table><thead><tr><th class="l">Settimana</th><th class="l">Fase</th><th>Endurance</th><th>Lungo corsa</th><th>Qualità</th><th>Carico</th><th>Fitness a fine settimana</th></tr></thead><tbody>
${prossimo.settimane.map((s) => { const g = genSett(s); return `<tr><td class="l"><b>${ggm(s.lunedi)}</b></td><td class="l">${s.fase}${s.scarico ? " · scarico" : ""}</td><td>${h(g.minuti)}</td><td>${s.lungoCorsa}'</td><td>${g.qualita.length}</td><td>${s.carico}</td><td>${s.ctlFine} (${s.ramp > 0 ? "+" : ""}${s.ramp})</td></tr>`; }).join("")}
</tbody></table></div>
<h2>Settimana del ${ggm(sett0.lunedi)}, seduta per seduta</h2>
<div class="card"><div class="days">${giorni}</div></div>
<div class="sub" style="margin-top:8px">Da confrontare con quella che hai già in Intervals per la stessa settimana. Punto aperto: il generatore mette la soglia di corsa il martedì e quindi sposta la palestra gambe al venerdì, mentre tu hai fissato gambe il lunedì e trazione il venerdì. Va deciso se i giorni di palestra fissi vincono sulla posizione della qualità (allora la soglia va al giovedì).</div>
</main></body></html>`;
fs.writeFileSync(__dirname + "/confronto-reale.html", html);
console.log("confronto-reale.html creato");
for (const B of blocchi) for (const x of B.righe) console.log(x.lun, "gen", h(x.g.minuti), "lungo", x.g.lungoCorsa, "Q", x.g.qualita.length, "| fatto", x.futura ? "-" : h(x.r.per.nuoto + x.r.per.bici + x.r.per.corsa), x.r.lungoCorsa, x.r.qualita.length);
console.log(prossimo.settimane.map((s) => `${s.lunedi} ${s.fase} ${h(genSett(s).minuti)} lungo ${s.lungoCorsa} ctl ${s.ctlFine}`).join("\n"));
