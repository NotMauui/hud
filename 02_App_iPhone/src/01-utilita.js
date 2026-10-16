// ------------------------------------------------------------
//  Utilità
// ------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parseYMD = (s) => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const daysBetween = (a, b) => Math.round((parseYMD(ymd(b)) - parseYMD(ymd(a))) / 86400000);
const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };
const GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const GG = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

const fmtDur = (sec) => { if (!sec) return "0h00"; const m = Math.round(sec / 60); return `${Math.floor(m / 60)}h${pad(m % 60)}`; };
const fmtMin = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${pad(min % 60)}` : `${min}'`);
const fmtStepDur = (s) => { s = Math.round(s); if (s < 60) return `${s}"`; const m = Math.floor(s / 60), r = s % 60; return r ? `${m}'${pad(r)}"` : (m >= 60 ? fmtMin(m) : `${m}'`); };
const fmtDist = (m, sport) => (sport === "nuoto" || m < 1000 ? `${Math.round(m)} m` : `${fmtIt(m / 1000, m % 1000 ? 1 : 0)} km`);
const toSec = (mmss) => { const [m, s] = String(mmss).split(":").map(Number); return m * 60 + (s || 0); };
const fmtPace = (sec) => { sec = Math.round(sec); return `${Math.floor(sec / 60)}:${pad(sec % 60)}`; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const fmtIt = (v, dec = 0) => v.toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const kgIt = (v) => fmtIt(v, Math.abs(v % 1) > 0.01 ? 1 : 0); // 59 kg, 58,5 kg
const signed = (v) => (v === null ? "—" : (v < 0 ? "−" : v > 0 ? "+" : "") + fmtIt(Math.abs(Math.round(v))));

function sportOf(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("swim")) return "nuoto";
  if (t.includes("run")) return "corsa";
  if (t.includes("ride") || t.includes("bike") || t.includes("cycl")) return "bici";
  if (t.includes("weight") || t.includes("strength") || t === "workout") return "forza";
  return "altro";
}

// Zone di forma come su Intervals.icu
function formZone(tsb) {
  if (tsb === null) return { name: "—", c: "#8E8E93" };
  if (tsb > 25) return { name: "Transizione", c: "#FFD60A" };
  if (tsb > 5) return { name: "Fresco", c: "#64D2FF" };
  if (tsb > -10) return { name: "Zona grigia", c: "#8E8E93" };
  if (tsb > -30) return { name: "Ottimale", c: "#30D158" };
  return { name: "Rischio alto", c: "#FF453A" };
}

