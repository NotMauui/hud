// Copia nell'app i blocchi condivisi con il generatore, così il codice esiste in un solo posto.
// Uso: node sincronizza-app.js [percorso di un file dell'app] [--controlla]
// Senza percorso lavora sui file di ../02_App_iPhone/src/ (il blocco va nel file che lo contiene) e poi ricostruisce
// HUD-70.3.js con costruisci.js. Con un percorso lavora su quel file soltanto (per esempio una copia di prova).
// Blocchi: VERIFICHE (verifiche.js), SOGLIE (soglie.js), GENERATORE (generatore.js), PROFILO (dati-reali.js).
const fs = require("fs");
const path = require("path");

const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const SRC = path.join(__dirname, "../02_App_iPhone/src");
const usaSrc = !arg && fs.existsSync(SRC);
const bersagli = usaSrc ? fs.readdirSync(SRC).filter((f) => /^\d\d-.+\.js$/.test(f)).sort().map((f) => path.join(SRC, f)) : [arg || path.join(__dirname, "../02_App_iPhone/HUD-70.3.js")];
const BLOCCHI = [["VERIFICHE", "verifiche.js"], ["SOGLIE", "soglie.js"], ["GENERATORE", "generatore.js"], ["PROFILO", "dati-reali.js"]];

const estrai = (s, nome) => {
  const a = s.indexOf(`// >>> ${nome}`), b = s.indexOf(`// <<< ${nome}`);
  if (a < 0 || b < 0) return null;
  return s.slice(a, b + `// <<< ${nome}`.length);
};

const testi = new Map(bersagli.map((f) => [f, fs.readFileSync(f, "utf8")]));
const diversi = [], toccati = new Set();
for (const [nome, file] of BLOCCHI) {
  const blk = estrai(fs.readFileSync(path.join(__dirname, file), "utf8"), nome);
  if (!blk) throw new Error(`Marcatori ${nome} mancanti in ${file}`);
  const dove = bersagli.find((f) => estrai(testi.get(f), nome) !== null) || bersagli.find((f) => testi.get(f).includes(`// @@${nome}@@`));
  if (!dove) throw new Error(`Nell'app manca il posto per il blocco ${nome} (// @@${nome}@@)`);
  const src = testi.get(dove), cur = estrai(src, nome);
  if (cur !== null) { if (cur !== blk) { testi.set(dove, src.replace(cur, () => blk)); diversi.push(nome); toccati.add(dove); } }
  else { testi.set(dove, src.replace(`// @@${nome}@@`, () => blk)); diversi.push(nome); toccati.add(dove); }
}
if (process.argv.includes("--controlla")) {
  console.log(diversi.length ? `Da sincronizzare: ${diversi.join(", ")}` : "App allineata");
  process.exit(diversi.length ? 1 : 0);
}
for (const f of toccati) fs.writeFileSync(f, testi.get(f));
console.log(diversi.length ? `Aggiornati nell'app: ${diversi.join(", ")}` : "App già allineata");
if (usaSrc) require("child_process").execFileSync(process.execPath, [path.join(SRC, "../costruisci.js")], { stdio: "inherit" });
