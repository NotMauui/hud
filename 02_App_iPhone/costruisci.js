// Costruisce l'app per Scriptable dai file in src/: li unisce in ordine (00-…, 01-…) in un unico HUD-70.3.js
// e ne mette una copia identica in ../07_Tester/HUD.js.
// Uso:
//   node costruisci.js              ricostruisce HUD-70.3.js e la copia per i tester
//   node costruisci.js --controlla  dice solo se HUD-70.3.js è allineato con src/ (esce con 1 se non lo è)
// Si modifica sempre src/; HUD-70.3.js è il risultato da incollare in Scriptable e non va toccato a mano.
const fs = require("fs"), path = require("path");
const qui = __dirname, SRC = path.join(qui, "src"), OUT = path.join(qui, "HUD-70.3.js"), TESTER = path.join(qui, "../07_Tester/HUD.js");
const file = fs.readdirSync(SRC).filter((f) => /^\d\d-.+\.js$/.test(f)).sort();
if (!file.length) throw new Error("Nessun file in src/");
const testo = file.map((f) => fs.readFileSync(path.join(SRC, f), "utf8")).join("");
if (process.argv.includes("--controlla")) {
  const ok = fs.existsSync(OUT) && fs.readFileSync(OUT, "utf8") === testo;
  console.log(ok ? `HUD-70.3.js allineato con src/ (${file.length} file)` : "HUD-70.3.js diverso da src/: lancia node costruisci.js (o è stato modificato a mano?)");
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(OUT, testo);
const tester = fs.existsSync(path.dirname(TESTER));
if (tester) fs.writeFileSync(TESTER, testo);
const v = (testo.match(/const VERSIONE = "([^"]+)"/) || [])[1];
console.log(`HUD-70.3.js costruito da ${file.length} file: versione ${v}, ${testo.split("\n").length} righe, ${Math.round(testo.length / 1024)} KB${tester ? " (copia in 07_Tester/HUD.js)" : ""}`);
