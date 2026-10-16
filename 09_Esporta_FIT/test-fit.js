// Test dell'esportazione FIT: ogni seduta di nuoto del generatore deve diventare un file FIT valido
// che, riletto con il decoder ufficiale, ha gli stessi passi, ripetute e durate dell'HUD.
// Uso: node test-fit.js
const { Decoder, Stream } = require("@garmin/fitsdk");
const G = require("../04_Generatore/generatore.js");
const { fileFit } = require("./esporta-fit.js");
let ko = 0, n = 0;
for (const tipo of ["tecnica", "lungo", "soglia", "tempo", "test"]) for (const min of [30, 45, 60, 75]) for (const k of [0, 1, 2]) {
  const S = G.seduta("nuoto", tipo, min, "costruzione", k);
  const { bytes } = fileFit(S);
  const d = new Decoder(Stream.fromByteArray(bytes));
  const err = [];
  if (!d.isFIT() || !d.checkIntegrity()) err.push("file non valido");
  const { messages, errors } = d.read();
  if (errors.length) err.push("errori di lettura: " + errors.join(", "));
  const W = (messages.workoutMesgs || [])[0], P = messages.workoutStepMesgs || [];
  if (!W || W.sport !== "swimming" || W.numValidSteps !== P.length) err.push("intestazione dell'allenamento");
  // tempo totale: i passi a tempo, ripetuti quante volte serve, contro i minuti dei passi a tempo nell'HUD
  const atteso = S.passi.reduce((t, p) => t + (p.ripeti ? p.ripeti * p.passi.filter((q) => !/^\d{2,4}\b/.test(q.cosa) || /recuper|fermo/i.test(q.cosa)).reduce((u, q) => u + Math.round(q.min * 60), 0) : !/^\d{2,4}\b/.test(p.cosa) || /recuper|fermo/i.test(p.cosa) ? Math.round(p.min * 60) : 0), 0);
  let tot = 0;
  for (let i = 0; i < P.length; i++) {
    const s = P[i];
    if (s.durationType === "repeatUntilStepsCmplt") { const giro = P.slice(s.durationStep, i).reduce((t, q) => t + (q.durationType === "time" ? q.durationTime : 0), 0); tot += giro * (s.repeatSteps - 1); }
    else if (s.durationType === "time") tot += s.durationTime;
  }
  if (Math.abs(tot - atteso) > 1) err.push(`tempo ${tot}s invece di ${atteso}s`);
  const rip = S.passi.filter((p) => p.ripeti).map((p) => p.ripeti), ripF = P.filter((s) => s.durationType === "repeatUntilStepsCmplt").map((s) => s.repeatSteps);
  if (JSON.stringify(rip) !== JSON.stringify(ripF)) err.push(`ripetute ${ripF} invece di ${rip}`);
  n++;
  if (err.length) { ko++; console.log(`KO ${S.nome} (${min}', k=${k}): ${err.join("; ")}`); }
}
console.log(ko ? `${ko} su ${n} sedute sbagliate` : `${n} sedute di nuoto esportate e rilette: tutte corrette`);
process.exit(ko ? 1 : 0);
