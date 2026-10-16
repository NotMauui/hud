// Verifica di un utente qualsiasi partendo dalla sua esportazione dell'app (hud-dati.json).
// Uso: node verifica-utente.js <hud-dati.json> [profilo.json]
//   profilo.json (facoltativo) = le risposte dell'onboarding: obiettivo, disponibilita, sport, piscinaGiorni, palestraGiorni, giornoLungo.
//   Senza, le ricava dai dati. Nessun valore personale è scritto in questo file.
// Crea verifiche-utenti/verifica-<nome>.html (dati personali: resta in locale).
const fs = require("fs");
const path = require("path");
const { generaBlocco, parseYMD, addDays, ymd } = require("./generatore.js");
const { carica, profiloAl, settimanaReale } = require("./dati-reali.js");
const { verificaProfilo } = require("./verifiche.js");

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error("Uso: node verifica-utente.js <hud-dati.json> [profilo.json]"); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const D = carica(file);
const oggi = String(D.esportato || new Date().toISOString()).slice(0, 10);
const now = new Date(parseYMD(oggi).getTime() + 10 * 3600000);
const h = (m) => (m / 60).toFixed(1).replace(".", ",") + " h";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ggm = (s) => { const d = parseYMD(s); return `${d.getDate()} ${["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"][d.getMonth()]}`; };
const GG = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// ---- Profilo di base: dall'onboarding se c'è, altrimenti ricavato dai dati delle ultime 8 settimane
function baseDaiDati() {
  const cfg = D.config || {}, ob = cfg.obiettivo || null;
  const da = ymd(addDays(parseYMD(oggi), -56));
  const rec = D.acts.filter((a) => a.data >= da && a.data <= oggi);
  const dow = (s) => (parseYMD(s).getDay() + 6) % 7;
  const freq = (sp) => { const c = [0, 0, 0, 0, 0, 0, 0]; rec.filter((a) => a.sport === sp).forEach((a) => c[dow(a.data)]++); return c; };
  const top = (c, n, min) => c.map((v, i) => [v, i]).filter(([v]) => v >= min).sort((a, b) => b[0] - a[0]).slice(0, n).map(([, i]) => i).sort();
  const nuoto = freq("nuoto"), forza = freq("forza");
  const lunghi = [0, 0, 0, 0, 0, 0, 0]; rec.filter((a) => a.sport === "corsa" && a.min >= 60).forEach((a) => lunghi[dow(a.data)]++);
  const bici = rec.filter((a) => a.sport === "bici");
  const sett = [1, 2, 3, 4].map((k) => settimanaReale(D, addDays(parseYMD(oggi), -7 * k)).minuti);
  const oreMax = Math.max(6, Math.round((Math.max(...sett) / 60) * 1.2));
  const tipo = !ob ? "migliorare" : /ironman|140\.6|full/i.test(ob.nome || "") ? "ironman" : /70\.3|half|medio/i.test(ob.nome || "") ? "70.3" : /olimp|standard/i.test(ob.nome || "") ? "olimpico" : /sprint/i.test(ob.nome || "") ? "sprint" : "70.3";
  const giornoLungo = lunghi.some((v) => v) ? lunghi.indexOf(Math.max(...lunghi)) : 6;
  return {
    nome: raw.nome || "Utente " + ggm(oggi),
    obiettivo: ob && ob.data ? { tipo, data: ob.data } : { tipo: "migliorare" },
    disponibilita: { oreMax, minutiGiorno: GG.map((_, i) => (i >= 5 ? 180 : 120)) },
    sport: { piscina: nuoto.some((v) => v), bici: !bici.length ? true : bici.filter((a) => /virtual|cyclette|rulli|indoor/i.test(a.nome)).length > bici.length / 2 ? "indoor" : true, palestra: forza.some((v) => v) },
    piscinaGiorni: top(nuoto, 3, 2).length ? top(nuoto, 3, 2) : [0, 2, 4],
    palestraGiorni: top(forza, 2, 2),
    giornoLungo,
    ricavato: true,
  };
}
const onboarding = process.argv[3] && fs.existsSync(process.argv[3]) ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : null;
const base = { ...(onboarding || baseDaiDati()), oggi };

// ---- Verifica delle soglie e dei dati
const checks = verificaProfilo(raw.raw, raw.config, now);

// ---- Piano contro realtà: due blocchi passati (6 e 2 settimane fa) e il prossimo, tutti dal lunedì dopo l'esportazione
const prossimoLun = (() => { let d = addDays(parseYMD(oggi), 1); while (d.getDay() !== 1) d = addDays(d, 1); return ymd(d); })();
const primoDato = D.acts.map((a) => a.data).sort()[0] || oggi;
function genSett(s) {
  const per = { nuoto: 0, bici: 0, corsa: 0, forza: 0 };
  for (const x of s.sedute) if (per[x.sport] !== undefined) per[x.sport] += x.min;
  return { per, minuti: per.nuoto + per.bici + per.corsa, lungoCorsa: s.lungoCorsa, qualita: s.sedute.filter((x) => x.qualita).length, carico: s.carico, fase: s.fase, scarico: s.scarico };
}
const blocchi = [];
for (const k of [6, 2]) {
  const inizio = ymd(addDays(parseYMD(prossimoLun), -7 * k));
  if (ymd(addDays(parseYMD(inizio), -28)) < primoDato) continue; // servono 4 settimane di storico prima del blocco
  const prof = profiloAl(D, inizio, base);
  const piano = generaBlocco(prof, { inizio });
  const righe = piano.settimane.map((s, i) => {
    const lun = addDays(parseYMD(inizio), 7 * i), r = settimanaReale(D, lun), futura = ymd(lun) > oggi;
    return { lun: ymd(lun), g: genSett(s), r, futura, parziale: !futura && ymd(addDays(lun, 6)) >= oggi };
  });
  blocchi.push({ inizio, prof, piano, righe });
}
const profOggi = profiloAl(D, prossimoLun, base);
const prossimo = generaBlocco(profOggi, { inizio: prossimoLun });

// ---- Letture automatiche del confronto
const note = [];
for (const B of blocchi) for (const x of B.righe) {
  if (x.futura || x.parziale) continue;
  const endR = x.r.per.nuoto + x.r.per.bici + x.r.per.corsa;
  if (endR < x.g.minuti * 0.6) note.push(`Settimana del ${ggm(x.lun)}: fatte ${h(endR)} di endurance su ${h(x.g.minuti)} proposte.`);
  else if (endR > x.g.minuti * 1.4) note.push(`Settimana del ${ggm(x.lun)}: fatte ${h(endR)} di endurance, molto più delle ${h(x.g.minuti)} proposte.`);
  if (x.r.lungoCorsa > x.g.lungoCorsa * 1.6 && x.r.lungoCorsa >= 90) note.push(`Settimana del ${ggm(x.lun)}: corsa da ${x.r.lungoCorsa}' contro un lungo previsto di ${x.g.lungoCorsa}'. Se era una gara, va segnata come tale.`);
  if (x.r.per.forza > 180 && x.r.per.forza > x.g.per.forza * 1.8) note.push(`Settimana del ${ggm(x.lun)}: ${h(x.r.per.forza)} di palestra, più di quanto il piano preveda (${h(x.g.per.forza)}).`);
}
// palestra fissa contro posizione della qualità di corsa
const sett0 = prossimo.settimane[0];
const gambeGen = sett0.sedute.filter((x) => x.sport === "forza").map((x) => x.giorno);
if (base.palestraGiorni && base.palestraGiorni.length && gambeGen.length && JSON.stringify(gambeGen.slice().sort()) !== JSON.stringify(base.palestraGiorni.slice().sort()))
  note.push(`Palestra: di solito vai ${base.palestraGiorni.map((i) => GG[i].toLowerCase()).join(" e ")}, il generatore la mette ${gambeGen.map((i) => GG[i].toLowerCase()).join(" e ")} per tenerla lontana dalla qualità di corsa. Da decidere quale delle due regole vince.`);

// ---- Pagina
const tag = { aggiorna: ["Aggiorna", "var(--warn)"], controlla: ["Controlla", "var(--ink)"], info: ["Da sapere", "var(--mut)"] };
const profRow = (p) => `Fitness (CTL) ${p.livello.ctl} · fatica ${p.livello.atl} · ${String(p.livello.oreSett).replace(".", ",")} h/sett. nelle 4 settimane prima · lungo tipico di corsa ${p.livello.lungoCorsaMin}', di bici ${p.livello.lungoBiciMin}'${p.livello.rientro && p.livello.rientro.corsa ? " · rientro di corsa" : ""}`;
const tabBlocco = (B) => `<table><thead><tr><th class="l">Settimana</th><th class="l">Fase</th><th></th><th>Endurance</th><th>Nuoto</th><th>Bici</th><th>Corsa</th><th>Palestra</th><th>Lungo corsa</th><th>Qualità</th><th>Carico</th></tr></thead><tbody>
${B.righe.map((x) => `<tr class="g"><td class="l" rowspan="2"><b>${ggm(x.lun)}</b>${x.futura ? "<br><small>da fare</small>" : x.parziale ? "<br><small>in corso</small>" : ""}</td><td class="l" rowspan="2">${x.g.fase}${x.g.scarico ? " · scarico" : ""}</td>
  <td class="who">Generatore</td><td>${h(x.g.minuti)}</td><td>${h(x.g.per.nuoto)}</td><td>${h(x.g.per.bici)}</td><td>${h(x.g.per.corsa)}</td><td>${h(x.g.per.forza)}</td><td>${x.g.lungoCorsa}'</td><td>${x.g.qualita}</td><td>${x.g.carico}</td></tr>
  <tr class="r"><td class="who">Fatto</td>${x.futura ? `<td colspan="8" class="mut">—</td>` : `<td>${h(x.r.per.nuoto + x.r.per.bici + x.r.per.corsa)}</td><td>${h(x.r.per.nuoto)}</td><td>${h(x.r.per.bici)}</td><td>${h(x.r.per.corsa)}</td><td>${h(x.r.per.forza)}</td><td>${x.r.lungoCorsa}'</td><td title="${esc(x.r.qualita.join("\n"))}">${x.r.qualita.length}</td><td>${x.r.carico}</td>`}</tr>`).join("")}
</tbody></table>`;
const COLS = { nuoto: "#0A84FF", bici: "#FF453A", corsa: "#E0A800", forza: "#30A14E" };
const giorni = GG.map((g, i) => `<div class="day"><div class="dn">${g}</div>${sett0.sedute.filter((x) => x.giorno === i).map((x) => `<div class="ses" style="border-left-color:${COLS[x.sport]}"><b>${esc(x.nome)}</b><span>${x.sport} · ${x.min}'${x.qualita ? " · qualità" : ""}</span></div>`).join("") || '<div class="rest">riposo</div>'}</div>`).join("");

const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verifica · ${esc(base.nome)}</title>
<style>
:root{--ink:#1d1d1f;--mut:#6e6e73;--line:#e5e5ea;--bg:#f5f5f7;--card:#fff;--warn:#C26A00}
@media (prefers-color-scheme:dark){:root{--ink:#f5f5f7;--mut:#a1a1a6;--line:#38383a;--bg:#000;--card:#1c1c1e;--warn:#FF9F0A}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif}
main{max-width:1180px;margin:0 auto;padding:40px 16px 80px}h1{font-size:34px;letter-spacing:-.02em;margin:0 0 4px}h2{font-size:22px;margin:36px 0 10px}
.sub{color:var(--mut)}.card{background:var(--card);border-radius:16px;padding:16px;overflow-x:auto}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.l,.who{text-align:left}
tr.g td{border-bottom:0}.who{color:var(--mut);font-size:13px}tr.r td{font-weight:600}small,.mut{color:var(--mut);font-weight:400}
ul{margin:0;padding-left:20px}li{margin:6px 0}
.chk{padding:12px 0;border-bottom:1px solid var(--line)}.chk:last-child{border-bottom:0}.chk .t{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}.chk b{display:block;font-size:16px}.chk p{margin:2px 0 0}
.days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.day{display:flex;flex-direction:column;gap:6px}.dn{font-size:12px;color:var(--mut);font-weight:600}
.ses{border-left:4px solid;border-radius:6px;background:var(--bg);padding:6px 8px;font-size:12px;display:flex;flex-direction:column}.ses span{color:var(--mut)}.rest{font-size:12px;color:var(--mut)}
@media (max-width:800px){.days{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main>
<h1>Verifica · ${esc(base.nome)}</h1>
<div class="sub">Dati esportati il ${ggm(oggi)} · attività dal ${ggm(primoDato)} · ${D.acts.length} attività, ${D.well.length} giorni di benessere${base.ricavato ? " · disponibilità e giorni ricavati dai dati, senza onboarding" : ""}</div>

<h2>Soglie e dati</h2>
<div class="card">${checks.length ? checks.map((c) => `<div class="chk"><span class="t" style="color:${tag[c.liv][1]}">${tag[c.liv][0]}</span><b>${esc(c.titolo)}</b><p class="sub">${esc(c.testo)}</p><p>${esc(c.azione)}</p></div>`).join("") : "Nessuna correzione: soglie e dati coerenti con gli allenamenti."}</div>

<h2>Piano contro realtà</h2>
<div class="card">${note.length ? `<ul>${note.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : blocchi.length ? "Le settimane fatte sono in linea con quelle che il generatore avrebbe proposto." : "Storico troppo corto per confrontare blocchi passati: servono almeno 10 settimane di dati."}</div>
${blocchi.map((B, i) => `<h2>Blocco ${i + 1} · dal ${ggm(B.inizio)}</h2>
<div class="sub" style="margin-bottom:10px">${profRow(B.prof)}</div>
<div class="card">${tabBlocco(B)}</div>
${B.piano.avvisi.length ? `<div class="sub" style="margin-top:8px">Avvisi del generatore: ${B.piano.avvisi.map(esc).join(" · ")}</div>` : ""}`).join("")}

<h2>Il prossimo blocco</h2>
<div class="sub" style="margin-bottom:10px">${profRow(profOggi)}</div>
<div class="card"><table><thead><tr><th class="l">Settimana</th><th class="l">Fase</th><th>Endurance</th><th>Lungo corsa</th><th>Qualità</th><th>Carico</th><th>Fitness a fine settimana</th></tr></thead><tbody>
${prossimo.settimane.map((s) => { const g = genSett(s); return `<tr><td class="l"><b>${ggm(s.lunedi)}</b></td><td class="l">${s.fase}${s.scarico ? " · scarico" : ""}</td><td>${h(g.minuti)}</td><td>${s.lungoCorsa}'</td><td>${g.qualita}</td><td>${s.carico}</td><td>${s.ctlFine} (${s.ramp > 0 ? "+" : ""}${s.ramp})</td></tr>`; }).join("")}
</tbody></table></div>
${prossimo.avvisi.length ? `<div class="sub" style="margin-top:8px">Avvisi del generatore: ${prossimo.avvisi.map(esc).join(" · ")}</div>` : ""}
<h2>Settimana del ${ggm(sett0.lunedi)}, seduta per seduta</h2>
<div class="card"><div class="days">${giorni}</div></div>
</main></body></html>`;

const sorgente = path.basename(file, ".json");
const slug = String(onboarding && onboarding.nome ? onboarding.nome : sorgente === "hud-dati" ? "utente-" + oggi : sorgente).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "utente";
const dir = path.join(__dirname, "verifiche-utenti");
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `verifica-${slug}.html`);
fs.writeFileSync(out, html);
console.log(out);
console.log(`${checks.length} verifiche · ${note.length} note · ${blocchi.length} blocchi confrontati · prossimo blocco dal ${prossimoLun}: lunghi ${prossimo.settimane.map((s) => s.lungoCorsa).join(" → ")}`);
for (const c of checks) console.log(`  [${c.liv}] ${c.titolo}`);
for (const n of note) console.log(`  · ${n}`);
