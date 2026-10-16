// Crea report-validazione.html dai risultati dei test
const fs = require("fs");
const { risultati, CONTROLLI } = require("./test-generatore.js");
const { REGOLE } = require("./generatore.js");

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tot = risultati.length * CONTROLLI.length;
const ko = risultati.reduce((t, r) => t + r.esiti.filter((e) => !e.pass).length, 0);
const COL = { nuoto: "#0A84FF", bici: "#FF453A", corsa: "#E0A800", forza: "#30A14E", gara: "#8E44AD" };

const griglia = `<table class="grid"><thead><tr><th>Profilo</th>${CONTROLLI.map((c, i) => `<th title="${esc(c[0])}">${i + 1}</th>`).join("")}</tr></thead><tbody>${risultati.map((r) => `<tr><td>${esc(r.profilo.nome)}</td>${r.esiti.map((e) => `<td class="${e.pass ? "ok" : "ko"}" title="${esc(e.nome + (e.dettaglio ? " · " + e.dettaglio : ""))}">${e.pass ? "✓" : "✗"}</td>`).join("")}</tr>`).join("")}</tbody></table>
<ol class="legend">${CONTROLLI.map((c) => `<li>${esc(c[0])}</li>`).join("")}</ol>`;

const M = risultati.find((r) => r.profilo.nome.startsWith("Atleta reale"));
const settimana = (s) => {
  const giorni = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((g, i) => {
    const ss = s.sedute.filter((x) => x.giorno === i);
    return `<div class="day"><div class="dn">${g}</div>${ss.map((x) => `<div class="ses" style="border-left-color:${COL[x.sport]}"><b>${esc(x.nome)}</b><span>${x.sport} · ${x.min}'${x.qualita ? " · qualità" : ""}</span></div>`).join("") || '<div class="rest">riposo</div>'}</div>`;
  }).join("");
  return `<div class="week"><div class="wh"><b>Settimana ${s.n}</b> · ${s.lunedi} · ${s.fase}${s.scarico ? " · scarico" : ""}<span>${(s.minuti / 60).toFixed(1)} h · ${s.carico} TSS · fitness ${s.ctlFine} (${s.ramp > 0 ? "+" : ""}${s.ramp})</span></div><div class="days">${giorni}</div></div>`;
};

const reale = M.profilo.pianoReale;
const gen = M.piano.settimane;
const confronto = `<table class="cmp"><thead><tr><th></th><th>Piano reale (Intervals)</th><th>Generatore v0.1</th><th>Lettura</th></tr></thead><tbody>
<tr><td>Lungo di corsa</td><td>${reale.lunghiCorsa.map((x) => (x === null ? "scarico" : x + "'")).join(" → ")}</td><td>${gen.map((s) => s.lungoCorsa + "'").join(" → ")}</td><td>Il tuo piano cresce di 10–15' a settimana; la regola del generatore di 10' ogni due. Da decidere quale delle due è giusta, soprattutto dopo una gara dura come Camogli.</td></tr>
<tr><td>Qualità di corsa</td><td>${reale.qualitaCorsa.join(", ")}</td><td>${gen.map((s) => s.sedute.filter((x) => x.sport === "corsa" && x.qualita).map((x) => x.giornoNome + " " + x.nome).join(", ") || "—").join(" · ")}</td><td>In base il generatore alterna una sola qualità a settimana tra corsa e bici; il tuo piano ne ha due di corsa. Coerente con la fase, più prudente.</td></tr>
<tr><td>Palestra</td><td>${reale.palestra.join(", ")}</td><td>${gen.map((s) => s.sedute.filter((x) => x.sport === "forza").map((x) => x.giornoNome + " " + (x.tipo === "gambe" ? "gambe" : "alto")).join(", ")).join(" · ")}</td><td>Le gambe del lunedì nel tuo piano sono adiacenti alla soglia del martedì: viola una delle tue regole. Il generatore le sposta al venerdì quando c'è qualità di corsa il martedì.</td></tr>
<tr><td>Nuoto</td><td>circa 10 km/settimana</td><td>${gen.map((s) => (s.sedute.filter((x) => x.sport === "nuoto").reduce((t, x) => t + (x.metri || 0), 0) / 1000).toFixed(1) + " km").join(" · ")}</td><td>Dopo la correzione tiene conto dello storico, ma la stima dei metri usa un passo prudente (2:00/100 m con pause). Va legata al tuo CSS.</td></tr>
</tbody></table>`;

const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Validazione del generatore · v0.1</title>
<style>
:root{--ink:#1d1d1f;--mut:#6e6e73;--line:#e5e5ea;--bg:#f5f5f7;--card:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#f5f5f7;--mut:#a1a1a6;--line:#38383a;--bg:#000;--card:#1c1c1e}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif}
main{max-width:1180px;margin:0 auto;padding:40px 24px 80px}
h1{font-size:34px;letter-spacing:-.02em;margin:0 0 4px}h2{font-size:22px;margin:40px 0 12px}
.sub{color:var(--mut)}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}
.kpi{background:var(--card);border-radius:16px;padding:16px}.kpi b{display:block;font-size:30px;letter-spacing:-.02em}.kpi span{color:var(--mut);font-size:13px}
.card{background:var(--card);border-radius:16px;padding:16px;overflow-x:auto}
table{border-collapse:collapse;width:100%}th,td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.grid td,.grid th{text-align:center;font-size:13px}.grid td:first-child{text-align:left;white-space:nowrap}
.ok{color:#30a14e;font-weight:700}.ko{color:#ff3b30;font-weight:700;background:rgba(255,59,48,.08)}
.legend{columns:2;color:var(--mut);font-size:13px;margin:12px 0 0;padding-left:20px}
.week{background:var(--card);border-radius:16px;padding:14px;margin-bottom:12px}
.wh{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}.wh span{color:var(--mut);font-size:13px}
.days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.day{display:flex;flex-direction:column;gap:6px}.dn{font-size:12px;color:var(--mut);font-weight:600}
.ses{border-left:4px solid;border-radius:6px;background:var(--bg);padding:6px 8px;font-size:12px;display:flex;flex-direction:column}.ses span{color:var(--mut)}
.rest{font-size:12px;color:var(--mut)}
.cmp td:first-child{font-weight:600;white-space:nowrap}
.rules{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.rules div{background:var(--card);border-radius:12px;padding:12px;font-size:13px}.rules b{display:block;font-size:18px}
@media (max-width:800px){.kpis,.rules{grid-template-columns:1fr 1fr}.days{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main>
<h1>Validazione del generatore · v0.1</h1>
<div class="sub">Generato il ${new Date().toLocaleDateString("it-IT")} · ${risultati.length} profili (${risultati.length - 1} inventati + Atleta reale) · ${CONTROLLI.length} controlli ciascuno</div>
<div class="kpis">
<div class="kpi"><b>${tot - ko}/${tot}</b><span>controlli superati</span></div>
<div class="kpi"><b>${risultati.filter((r) => r.ok).length}/${risultati.length}</b><span>profili senza violazioni</span></div>
<div class="kpi"><b>${CONTROLLI.length}</b><span>regole verificate per ogni piano</span></div>
<div class="kpi"><b>6</b><span>difetti trovati e corretti in questa sessione</span></div>
</div>

<h2>Esito per profilo</h2>
<div class="card">${griglia}</div>

<h2>Cosa hanno trovato i test (e cosa è stato corretto)</h2>
<div class="card"><table><thead><tr><th>Difetto</th><th>Chi colpiva</th><th>Correzione</th></tr></thead><tbody>
<tr><td>Le durate minime delle sedute sforavano il tetto di ore</td><td>Principianti con 5–6 h</td><td>Tetto settimanale applicato dopo la generazione: prima si accorciano le facili, poi i lunghi</td></tr>
<tr><td>Lo scarico non scendeva sotto l'85%</td><td>Volumi bassi e tetti di ore</td><td>Scarico calcolato sul volume reale della settimana precedente (×0,68)</td></tr>
<tr><td>Qualità oltre il 25% con poche ore</td><td>Chi ha 4–5 h</td><td>Se la quota sfora, la qualità di bici e poi di corsa diventa facile, con avviso</td></tr>
<tr><td>Chi aveva meno di 4 settimane di storico riceveva soglia e VO2</td><td>Atleti nuovi</td><td>Settimana d'ingresso con test a gradini e test CSS, nessuna qualità dura nel blocco</td></tr>
<tr><td>Sedute facili ammassate nei giorni di qualità, oltre i minuti disponibili</td><td>12 profili su 21</td><td>Fase di collocazione: ogni seduta va nel giorno con più spazio libero, rispettando piscina, palestra e vincoli</td></tr>
<tr><td>Sotto 3,5 h a settimana non ci stanno 2 sedute per sport</td><td>Atleti nuovi</td><td>Limite fisico, non un errore: il piano lo dichiara all'utente con un avviso</td></tr>
</tbody></table></div>

<h2>Il tuo blocco generato</h2>
<div class="sub" style="margin-bottom:12px">Profilo confermato con i dati reali del 9 ottobre: fitness 36, 8 h/settimana di endurance, rientro di corsa (lungo da 50'), nuoto lun/mer/ven, palestra lun/ven, bici solo indoor, 70.3 il 30 maggio 2027. Il confronto con le settimane reali è in confronto-reale.html.</div>
${M.piano.settimane.map(settimana).join("")}

<h2>Confronto con il tuo piano reale</h2>
<div class="card">${confronto}</div>

<h2>Regole attuali (modificabili in generatore.js)</h2>
<div class="rules">
<div><b>${REGOLE.rampMax}</b>punti di fitness massimi a settimana</div>
<div><b>${REGOLE.quotaQualitaMax * 100}%</b>tempo massimo in qualità</div>
<div><b>+${REGOLE.lungoCorsaPassoMin}' / ${REGOLE.lungoCorsaOgniSett} sett.</b>crescita del lungo di corsa</div>
<div><b>${REGOLE.lungoCorsaQuotaMax * 100}%</b>tetto del lungo sul tempo di corsa (alzato da 30%: con 3 uscite era irrealistico)</div>
<div><b>×${REGOLE.scarico}</b>volume della settimana di scarico</div>
<div><b>3 + 1</b>settimane di carico e di scarico per blocco</div>
</div>

<h2>Prossimi passi della validazione</h2>
<div class="card"><ol>
<li><s>Confermare il tuo profilo con i numeri reali</s>: fatto il 9 ottobre (confronto-reale.html).</li>
<li>Far leggere regole e 5–6 piani d'esempio a un allenatore di triathlon certificato.</li>
<li><s>Rigenerare i blocchi da settembre e confrontarli con quanto fatto</s>: fatto, ha portato la regola del rientro e l'esclusione di gare e uscite camminate.</li>
<li>Prova sul campo: tu e 10 tester per 8 settimane.</li>
</ol></div>
</main></body></html>`;

fs.writeFileSync(__dirname + "/report-validazione.html", html);
console.log("report-validazione.html creato");
