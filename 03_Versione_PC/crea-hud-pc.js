// Costruisce HUD-PC.html: la stessa app dell'iPhone (versione personale) da aprire nel browser del computer.
// Uso: node crea-hud-pc.js [script dell'app] [uscita]
const fs = require("fs"), path = require("path");
const qui = __dirname;
const srcPath = process.argv[2] || path.join(qui, "../02_App_iPhone/HUD-70.3.js");
const outPath = process.argv[3] || path.join(qui, "HUD-PC.html");
const cerca = (n) => [path.join(qui, "src", n), path.join(qui, n)].find((p) => fs.existsSync(p));
let src = fs.readFileSync(srcPath, "utf8");
const exp = "module.exports = { analyze, buildHTML, CONFIG };";
if (!src.includes(exp)) throw new Error("Nello script manca l'esportazione del motore");
// sul computer i grafici delle attività arrivano dal file dei dati
src = src.replace(exp, "module.exports = { analyze, buildHTML, CONFIG, imposta: (d) => { DETTAGLI = (d && d.dettagli) || {}; } };");
src = src.replace(/<\/script/gi, "<\\/script");
const tpl = fs.readFileSync(cerca("template-pc.html"), "utf8"), app = fs.readFileSync(cerca("pc-hud.js"), "utf8");
const out = tpl.replace("/*__MOTORE__*/", () => src).replace("/*__APP__*/", () => app.replace(/<\/script/gi, "<\\/script"));
fs.writeFileSync(outPath, out);
const v = (src.match(/const VERSIONE = "([^"]+)"/) || [])[1];
console.log(`${path.basename(outPath)} creato: versione ${v}, ${Math.round(out.length / 1024)} KB`);
