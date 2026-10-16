// Test della regola dell'HRV (semaforo sistemico): tendenza di 7 giorni contro la fascia normale dei 60 giorni prima.
// Uso: node test-hrv.js [percorso dell'app]   — senza percorso usa ../02_App_iPhone/HUD-70.3.js
const fs = require("fs"), path = require("path");
const app = process.argv[2] || path.join(__dirname, "../02_App_iPhone/HUD-70.3.js");
(async () => {
  let src = fs.readFileSync(app, "utf8");
  src = src.slice(0, src.lastIndexOf('if (typeof Script !== "undefined")')) + "\nreturn { analyze, demoData, ymd, addDays };";
  const M = await new (Object.getPrototypeOf(async function () {}).constructor)(src)();
  const now = new Date(2026, 9, 16, 8);
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const g = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  // 70 notti: HRV attorno a 60 ms (±8%), FC a riposo 45, sonno buono; poi la settimana finale modificata da ogni caso
  function caso(ultimi, opz = {}) {
    const raw = M.demoData(now), W = [];
    for (let k = 69; k >= 0; k--) {
      const d = M.ymd(M.addDays(now, -k));
      let hrv = Math.round(60 * Math.exp(g() * 0.08)), rhr = 45, sleepScore = 82;
      if (k <= 6 && ultimi) { const u = ultimi(6 - k, k); if (u.hrv !== undefined) hrv = u.hrv; if (u.rhr !== undefined) rhr = u.rhr; if (u.sleep !== undefined) sleepScore = u.sleep; }
      W.push({ id: d, hrv, restingHR: rhr, sleepScore, sleepSecs: 27000, ctl: 50, atl: opz.atl ?? 52 });
    }
    raw.wellness = opz.pochi ? W.slice(-12) : W;
    return M.analyze(raw, now, {});
  }
  const casi = [
    ["Settimana normale", caso(null), (A) => !A.sys.reasons.some((r) => /HRV/.test(r))],
    ["Una sola notte bassa (40 ms), il resto a posto", caso((i, k) => (k === 0 ? { hrv: 40 } : {})), (A) => !A.sys.reasons.some((r) => /HRV/.test(r))],
    ["Una notte bassa con FC a riposo +6", caso((i, k) => (k === 0 ? { hrv: 40, rhr: 51 } : {})), (A) => A.sys.reasons.includes("HRV di stanotte bassa") || A.sys.reasons.some((r) => /sotto la tua fascia/.test(r))],
    ["Settimana intera giù (50 ms)", caso(() => ({ hrv: 50 })), (A) => A.sys.reasons.includes("HRV della settimana sotto la tua fascia") && A.sys.state !== "verde"],
    ["Settimana molto giù (42 ms) con sonno scarso: rosso", caso(() => ({ hrv: 42, sleep: 50 })), (A) => A.sys.state === "rosso" && A.sys.reasons.includes("HRV della settimana sotto la tua fascia")],
    ["Settimana alta (80 ms) con carico molto alto", caso(() => ({ hrv: 80 }), { atl: 80 }), (A) => A.sys.reasons.includes("HRV insolitamente alta con molto carico")],
    ["Settimana alta senza carico: niente avviso", caso(() => ({ hrv: 80 })), (A) => !A.sys.reasons.some((r) => /HRV/.test(r))],
    ["Storico corto (12 notti): regola semplice", caso((i, k) => (k === 0 ? { hrv: 35 } : {}), { pochi: true }), (A) => A.metrics.hrvTrend === null && A.sys.reasons.some((r) => /HRV (molto bassa|sotto la media)/.test(r))],
  ];
  let ko = 0;
  for (const [n, A, ok] of casi) { const v = ok(A); if (!v) ko++; console.log(`${v ? "ok" : "KO"}  ${n.padEnd(52)} ${A.sys.state.padEnd(7)} ${A.sys.reasons.join(" · ")}`); }
  console.log(ko ? `${ko} casi sbagliati` : `${casi.length}/${casi.length} casi corretti`);
  process.exit(ko ? 1 : 0);
})();
