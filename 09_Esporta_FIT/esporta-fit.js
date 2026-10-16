// Esporta le sedute di nuoto dell'HUD come file FIT di allenamento (formato Garmin), con l'SDK FIT ufficiale di Garmin.
// Le sedute arrivano dal generatore (04_Generatore): passi, ripetute, nomi e note restano come nell'app.
// Uso:
//   node esporta-fit.js                         una seduta d'esempio per ogni tipo (tecnica, lungo, soglia, ritmo, test)
//   node esporta-fit.js --blocco [profilo]      le sedute di nuoto del prossimo blocco di 4 settimane (profilo di profili.js, predefinito: reale)
//   opzioni: --vasca 25|50 (lunghezza della vasca, predefinita 25)
// I file finiscono in fit/. Per metterli sull'orologio vedi LEGGIMI.md.
const fs = require("fs"), path = require("path");
const { Encoder, Profile } = require("@garmin/fitsdk");
const G = require("../04_Generatore/generatore.js");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d; };
const VASCA = +arg("--vasca", 25) === 50 ? 50 : 25;
const OUT = path.join(__dirname, "fit");

// un passo dell'HUD → un passo FIT. Distanza se il nome comincia con i metri ("200 a CSS +3\""), altrimenti tempo
function passoFit(p, i) {
  const m = String(p.cosa || "").match(/^(\d{2,4})\b/);
  const cosa = String(p.cosa || "Nuota"), ints = String(p.intensita || "");
  const intensity = /riscald/i.test(cosa) ? "warmup" : /defatic/i.test(cosa) ? "cooldown" : /recuper|fermo|riposo/i.test(cosa + " " + ints) ? "rest" : "active";
  const step = { messageIndex: i, wktStepName: cosa.slice(0, 40), targetType: "open", intensity, notes: ints.slice(0, 50) || undefined };
  if (m && intensity !== "rest") { step.durationType = "distance"; step.durationValue = +m[1] * 100; } // centimetri
  else { step.durationType = "time"; step.durationValue = Math.round(p.min * 60) * 1000; } // millisecondi
  return step;
}
function passiFit(S) {
  const out = [];
  for (const p of S.passi) {
    if (p.ripeti) {
      const primo = out.length;
      for (const q of p.passi) out.push(passoFit(q, out.length));
      out.push({ messageIndex: out.length, durationType: "repeatUntilStepsCmplt", durationValue: primo, targetType: "open", targetValue: p.ripeti });
    } else out.push(passoFit(p, out.length));
  }
  return out;
}
function fileFit(S, data) {
  const e = new Encoder();
  e.onMesg(Profile.MesgNum.FILE_ID, { type: "workout", manufacturer: "development", product: 0, timeCreated: new Date(), serialNumber: 70300 });
  const passi = passiFit(S);
  e.onMesg(Profile.MesgNum.WORKOUT, { wktName: `HUD ${S.nome}`.slice(0, 40), sport: "swimming", subSport: "lapSwimming", numValidSteps: passi.length, poolLength: VASCA, poolLengthUnit: "metric" });
  for (const p of passi) e.onMesg(Profile.MesgNum.WORKOUT_STEP, p);
  return { bytes: e.close(), passi };
}
const nomeFile = (S, d) => `${d ? d + "-" : ""}nuoto-${S.tipo}-${S.min}min.fit`.replace(/[^\w.\-]/g, "");

function sedute() {
  if (!process.argv.includes("--blocco")) {
    return [["tecnica", 40], ["lungo", 55], ["soglia", 45], ["tempo", 50], ["test", 40]].map(([t, min]) => ({ S: G.seduta("nuoto", t, min, "costruzione", 1), data: null }));
  }
  const P = require("../04_Generatore/profili.js");
  const nome = arg("--blocco", "reale"), base = P[nome] || P.reale;
  const prof = typeof base === "function" ? base() : base;
  const lun = new Date(); lun.setDate(lun.getDate() + ((8 - lun.getDay()) % 7 || 7)); // il prossimo lunedì
  const B = G.generaBlocco(prof, lun);
  return B.settimane.flatMap((w) => w.sedute.filter((s) => s.sport === "nuoto").map((s) => ({ S: s, data: s.data })));
}

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  const L = sedute();
  for (const { S, data } of L) {
    const { bytes, passi } = fileFit(S, data);
    const f = nomeFile(S, data);
    fs.writeFileSync(path.join(OUT, f), Buffer.from(bytes));
    console.log(`${f.padEnd(40)} ${S.nome} · ${passi.length} passi`);
  }
  console.log(`${L.length} file in fit/ (vasca da ${VASCA} m)`);
}
module.exports = { fileFit, passiFit, passoFit };
