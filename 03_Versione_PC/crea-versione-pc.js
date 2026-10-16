// Costruisce HUD-Analisi.html: motore condiviso con l'app iPhone + interfaccia desktop
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../02_App_iPhone/HUD-70.3.js"), "utf8");
const lines = src.split("\n");
const stop = lines.findIndex((l) => l.includes("//  HTML (iOS, dark)")) - 1;
let engine = lines.slice(0, stop).join("\n");
const c0 = src.indexOf("const COL = {"), c1 = src.indexOf("const CHECK = ");
engine += "\n" + src.slice(c0, c1);
const tpl = fs.readFileSync(path.join(__dirname, "src/template.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "src/pc-app.js"), "utf8");
const out = tpl.replace("/*__ENGINE__*/", () => engine.replace(/<\/script/gi, "<\\/script")).replace("/*__APP__*/", () => app);
fs.writeFileSync(path.join(__dirname, "HUD-Analisi.html"), out);
console.log("HUD-Analisi.html creato (" + Math.round(out.length / 1024) + " KB)");
