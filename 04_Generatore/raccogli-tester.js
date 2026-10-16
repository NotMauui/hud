// Raccoglie i dati di tutti i tester dal tuo gruppo di allenamento su Intervals.icu e li verifica uno per uno.
// Uso: INTERVALS_KEY=la-tua-chiave node raccogli-tester.js
//   oppure metti la chiave nel file .chiave-intervals in questa cartella (non condividerlo).
// I tester sono gli atleti che seguono il tuo gruppo come coach: Intervals li elenca da solo.
// Se l'elenco non arriva, scrivili in tester.json: [{ "id": "i12345", "nome": "Luca" }].
// Crea verifiche-utenti/tester.html (riepilogo) e un rapporto per ogni tester. Dati personali: restano in locale.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BASE = process.env.INTERVALS_BASE || "https://intervals.icu/api/v1";
const fileChiave = path.join(__dirname, ".chiave-intervals");
const KEY = process.env.INTERVALS_KEY || (fs.existsSync(fileChiave) ? fs.readFileSync(fileChiave, "utf8").trim() : "");
if (!KEY) { console.error("Manca la chiave API di Intervals: INTERVALS_KEY=... node raccogli-tester.js"); process.exit(1); }
const AUTH = "Basic " + Buffer.from("API_KEY:" + KEY).toString("base64");

const DIR = path.join(__dirname, "verifiche-utenti");
const DATI = path.join(DIR, "dati");
fs.mkdirSync(DATI, { recursive: true });
const oggi = new Date();
const ymd = (d) => d.toISOString().slice(0, 10);
const giorni = (n) => ymd(new Date(oggi.getTime() + n * 86400000));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function get(p) {
  const r = await fetch(BASE + p, { headers: { Authorization: AUTH, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${r.status} su ${p}`);
  return r.json();
}

// Quanto sono completi i dati di un tester: serve a capire chi va aiutato a collegare meglio l'orologio
function qualita(raw) {
  const A = raw.activities || [], W = raw.wellness || [];
  const da28 = giorni(-28);
  const W28 = W.filter((w) => w.id > da28 && w.id <= giorni(0));
  const A28 = A.filter((a) => String(a.start_date_local).slice(0, 10) >= da28);
  const primo = A.map((a) => String(a.start_date_local).slice(0, 10)).sort()[0];
  const fonti = {};
  for (const a of A28) { const f = String(a.source || a.device_name || "non indicata").toUpperCase(); fonti[f] = (fonti[f] || 0) + 1; }
  const pct = (n, d) => (d ? Math.round((100 * n) / d) : null);
  const q = {
    settimane: primo ? Math.floor((oggi - new Date(primo)) / (7 * 86400000)) : 0,
    hrv: pct(W28.filter((w) => typeof w.hrv === "number").length, 28),
    sonno: pct(W28.filter((w) => typeof w.sleepSecs === "number" || typeof w.sleepScore === "number").length, 28),
    attivita: A28.length,
    conFC: pct(A28.filter((a) => typeof a.average_heartrate === "number").length, A28.length),
    conGiri: pct(A28.filter((a) => Array.isArray(a.interval_summary) && a.interval_summary.length).length, A28.length),
    fonti,
  };
  const da = [];
  if (!A28.length) da.push("nessuna attività nelle ultime 4 settimane: orologio non collegato?");
  if (Object.keys(fonti).some((f) => f.includes("STRAVA"))) da.push("attività arrivate da Strava: collegare l'orologio direttamente");
  if (q.hrv !== null && q.hrv < 50) da.push("HRV in meno di metà delle notti: attivare i dati di benessere");
  if (q.sonno !== null && q.sonno < 50) da.push("sonno in meno di metà delle notti");
  if (q.settimane < 8) da.push("storico corto: scaricare lo storico dall'orologio");
  q.daFare = da;
  return q;
}

(async () => {
  // 1. Chi sono i tester
  let tester = [];
  try {
    const L = await get("/athletes");
    tester = (Array.isArray(L) ? L : []).map((a) => ({ id: a.id, nome: a.name || a.firstname || a.id }));
  } catch (e) { console.log("Elenco dal gruppo non disponibile (" + e.message + "), uso tester.json"); }
  const fileT = path.join(__dirname, "tester.json");
  if (!tester.length && fs.existsSync(fileT)) tester = JSON.parse(fs.readFileSync(fileT, "utf8"));
  if (!tester.length) { console.error("Nessun tester trovato: controlla che abbiano accettato l'invito del gruppo, oppure compila tester.json"); process.exit(1); }

  // 2. Dati di ognuno, nello stesso formato dell'esportazione dell'app
  const righe = [];
  for (const t of tester) {
    const P = `/athlete/${encodeURIComponent(t.id)}`;
    try {
      const [wellness, activities, events] = await Promise.all([
        get(`${P}/wellness?oldest=${giorni(-365)}&newest=${giorni(0)}`),
        get(`${P}/activities?oldest=${giorni(-365)}&newest=${giorni(0)}`),
        get(`${P}/events?oldest=${giorni(-56)}&newest=${giorni(365)}`),
      ]);
      // obiettivo: la prima gara A futura nel calendario del tester (poi la B)
      const gare = (events || []).filter((e) => /RACE/.test(e.category || "") && String(e.start_date_local) >= giorni(0)).sort((a, b) => String(a.start_date_local).localeCompare(String(b.start_date_local)));
      const g = gare.find((e) => e.category === "RACE_A") || gare[0];
      const raw = { wellness, activities, events, fetchedAt: oggi.toISOString() };
      const exp = { versione: 3, esportato: oggi.toISOString(), nome: t.nome, config: { obiettivo: g ? { nome: g.name, data: String(g.start_date_local).slice(0, 10) } : null }, raw };
      const f = path.join(DATI, `${slug(t.nome)}-${slug(t.id)}.json`);
      fs.writeFileSync(f, JSON.stringify(exp));
      const out = execFileSync(process.execPath, [path.join(__dirname, "verifica-utente.js"), f], { encoding: "utf8" });
      const rapporto = out.split("\n")[0].trim();
      const agg = (out.match(/\[aggiorna\]/g) || []).length, ctr = (out.match(/\[controlla\]/g) || []).length;
      righe.push({ t, q: qualita(raw), rapporto: path.basename(rapporto), agg, ctr, gara: g ? `${g.name} · ${String(g.start_date_local).slice(0, 10)}` : "" });
      console.log(`ok  ${t.nome}: ${activities.length} attività, ${wellness.length} giorni di benessere`);
    } catch (e) {
      righe.push({ t, errore: e.message });
      console.log(`NO  ${t.nome}: ${e.message}`);
    }
  }

  // 3. Riepilogo
  const v = (x, suf = "%") => (x === null || x === undefined ? "—" : x + suf);
  const cls = (x, soglia) => (x === null || x === undefined ? "" : x >= soglia ? "ok" : "ko");
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tester · riepilogo</title>
<style>
:root{--ink:#1d1d1f;--mut:#6e6e73;--line:#e5e5ea;--bg:#f5f5f7;--card:#fff;--ok:#1F8F4E;--ko:#C26A00}
@media (prefers-color-scheme:dark){:root{--ink:#f5f5f7;--mut:#a1a1a6;--line:#38383a;--bg:#000;--card:#1c1c1e;--ok:#30D158;--ko:#FF9F0A}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif}
main{max-width:1180px;margin:0 auto;padding:40px 16px 80px}h1{font-size:34px;letter-spacing:-.02em;margin:0 0 4px}.sub{color:var(--mut)}
.card{background:var(--card);border-radius:16px;padding:8px 16px;overflow-x:auto;margin-top:20px}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:10px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap;vertical-align:top}
th{font-size:12px;color:var(--mut);font-weight:600}.l{text-align:left}td.l{white-space:normal}.ok{color:var(--ok)}.ko{color:var(--ko);font-weight:600}a{color:inherit}small{color:var(--mut)}
</style></head><body><main>
<h1>Tester</h1>
<div class="sub">${righe.length} tester · dati raccolti il ${ymd(oggi)} · ultime 4 settimane</div>
<div class="card"><table><thead><tr><th class="l">Tester</th><th>Storico</th><th>Notti con HRV</th><th>Notti con sonno</th><th>Attività</th><th>Con FC</th><th>Con giri</th><th class="l">Fonti</th><th>Da aggiornare</th><th class="l">Cosa chiedergli</th></tr></thead><tbody>
${righe.map((r) => r.errore ? `<tr><td class="l"><b>${esc(r.t.nome)}</b></td><td colspan="9" class="l ko">Non posso leggere i suoi dati: probabilmente non ha ancora accettato l'invito del gruppo. <small>(${esc(r.errore)})</small></td></tr>` : `<tr>
<td class="l"><b><a href="${esc(r.rapporto)}">${esc(r.t.nome)}</a></b>${r.gara ? `<br><small>${esc(r.gara)}</small>` : ""}</td>
<td class="${cls(r.q.settimane, 8)}">${r.q.settimane} sett.</td><td class="${cls(r.q.hrv, 50)}">${v(r.q.hrv)}</td><td class="${cls(r.q.sonno, 50)}">${v(r.q.sonno)}</td>
<td>${r.q.attivita}</td><td class="${cls(r.q.conFC, 80)}">${v(r.q.conFC)}</td><td>${v(r.q.conGiri)}</td>
<td class="l"><small>${esc(Object.entries(r.q.fonti).map(([k, n]) => `${k.toLowerCase()} ${n}`).join(", ") || "—")}</small></td>
<td>${r.agg ? `<span class="ko">${r.agg}</span>` : "0"}${r.ctr ? ` <small>+${r.ctr} da controllare</small>` : ""}</td>
<td class="l"><small>${esc(r.q.daFare.join(" · ") || "niente")}</small></td></tr>`).join("")}
</tbody></table></div>
</main></body></html>`;
  fs.writeFileSync(path.join(DIR, "tester.html"), html);
  console.log("\n" + path.join(DIR, "tester.html"));
})();
