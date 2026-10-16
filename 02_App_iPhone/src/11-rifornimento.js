// ------------------------------------------------------------
//  Rifornimento sull'orologio
//  Per ogni lungo: cosa prendere e quando. Gli orari finiscono nella seduta su Intervals: il passo
//  viene spezzato all'ora giusta e la nota del passo nuovo dice cosa prendere ("Mangia gel e bevi").
//  A ogni cambio di passo l'orologio vibra e mostra la nota.
// ------------------------------------------------------------
const AVVISO_RE = /^(?:mangia|bevi)\b[^,]*(?:,\s*)?/i;
const r5min = (v) => Math.round(v / 5) * 5;

// Le dosi sono per tutta la durata: 150 g in 2h30 sono 60 g all'ora.
function schemaRifornimento(sport, min, RF, indoor) {
  if (!RF || !min || (sport !== "bici" && sport !== "corsa")) return null;
  const PR = CONFIG.rifornimento.prodotti || {};
  const gel = PR.gel && PR.gel.g ? PR.gel : { nome: "gel", g: 25 };
  const ex = PR.extra && PR.extra.g ? PR.extra : null;
  const I = idratazione(RF, sport, indoor);
  const voci = [];
  let gh = 0, borraccia = null;
  const distribuisci = (k, t0, t1) => Array.from({ length: k }, (_, i) => (k === 1 ? r5min((t0 + t1) / 2) : r5min(t0 + (i * (t1 - t0)) / (k - 1))));
  if (sport === "bici" && min >= 90) {
    gh = min >= 150 ? RF.gh.bici : Math.min(RF.gh.bici, 60);
    borraccia = PR.borraccia && PR.borraccia.g ? PR.borraccia : null;
    const resto = (gh * min) / 60 - (borraccia ? borraccia.g : 0);
    // quanti gel e quanti "extra" (mai più extra che gel) per arrivare più vicino ai grammi
    let best = null;
    for (let a = 1; a <= 12; a++) for (let b = 0; b <= (ex ? a : 0); b++) {
      const d = Math.abs(gel.g * a + (ex ? ex.g * b : 0) - resto);
      if (!best || d < best.d - 0.01 || (Math.abs(d - best.d) < 0.01 && a + b < best.a + best.b)) best = { a, b, d };
    }
    const k = best.a + best.b;
    const conExtra = new Set(Array.from({ length: best.b }, (_, j) => 1 + Math.floor((j * (k - 1)) / best.b)));
    distribuisci(k, 20, Math.max(20, min - 20)).forEach((t, i) => { const p = conExtra.has(i) ? ex : gel; voci.push({ t, tipo: "mangia", nome: p.nome, g: p.g }); });
  } else if (sport === "corsa" && min >= 75) {
    gh = min >= 90 ? RF.gh.corsa : Math.min(RF.gh.corsa, 45);
    const n = Math.max(1, Math.round((gh * min) / 60 / gel.g));
    distribuisci(n, 30, Math.max(30, min - 15)).forEach((t) => voci.push({ t, tipo: "mangia", nome: gel.nome, g: gel.g }));
  }
  // in bici si beve anche tra un rifornimento e l'altro; al chiuso o col caldo anche nelle uscite da un'ora
  if (sport === "bici" && min >= 60) {
    if (voci.length) {
      const punti = [...voci.map((v) => v.t), min - 10];
      for (let i = 0; i < punti.length - 1; i++) if (punti[i + 1] - punti[i] >= 25) voci.push({ t: r5min((punti[i] + punti[i + 1]) / 2), tipo: "bevi" });
    } else if (indoor || I.T >= 22) for (let t = 15; t <= min - 10; t += 20) voci.push({ t, tipo: "bevi" });
  }
  if (!voci.length) return null;
  voci.sort((a, b) => a.t - b.t);
  for (const v of voci) v.avviso = v.tipo === "bevi" ? "Bevi" : `Mangia ${v.nome}${sport === "bici" ? " e bevi" : ""}`;
  const g = voci.reduce((t, v) => t + (v.g || 0), 0) + (borraccia ? borraccia.g : 0);
  return { sport, min, gh, g, borraccia, voci, acqua: I };
}

// "gel a 20', 1h05 e 1h50 (75 g, 45 g all'ora)"
function descriviSchema(S) {
  const cibo = S.voci.filter((v) => v.tipo === "mangia");
  if (!cibo.length) return "";
  const nomi = [...new Set(cibo.map((v) => v.nome))];
  const parti = nomi.map((n) => `${n} a ${elencoIt(cibo.filter((v) => v.nome === n).map((v) => fmtMin(v.t)))}`);
  if (S.borraccia) parti.unshift(`${S.borraccia.nome} nella borraccia, a sorsi`);
  return `${parti.join(", ")} (${S.g} g di carboidrati, ${Math.round((S.g * 60) / S.min)} g all'ora)`;
}

// ---- Il testo delle sedute di Intervals: "- [nota] durata [obiettivi]"
function secDurata(tok) {
  const t = String(tok).replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  let m = /^(\d+)'(?:(\d+)")?$/.exec(t); if (m) return +m[1] * 60 + +(m[2] || 0);
  m = /^(\d+)"$/.exec(t); if (m) return +m[1];
  m = /^(\d+)h(\d+)$/i.exec(t); if (m) return +m[1] * 3600 + +m[2] * 60;
  m = /^(\d+)m(\d+)$/i.exec(t); if (m) return +m[1] * 60 + +m[2];
  m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i.exec(t);
  if (m && (m[1] || m[2] || m[3])) return Math.round(+(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0));
  return null;
}
function leggiPasso(riga) {
  const m = /^(\s*-\s*)(.*)$/.exec(riga);
  if (!m) return null;
  const corpo = m[2], re = /\S+/g;
  let t;
  while ((t = re.exec(corpo))) {
    const tok = t[0];
    if (/^\d+(?:\.\d+)?(?:km|mi|mtr|yd)$/i.test(tok)) return { pre: m[1], dist: true };
    if (/^\d+(?:\.\d+)?$/.test(tok) && /^\s*(?:km|mi|mtr|m|yd)\b/i.test(corpo.slice(re.lastIndex))) return { pre: m[1], dist: true };
    const s = secDurata(tok);
    if (s) return { pre: m[1], nota: corpo.slice(0, t.index).trim(), sec: s, resto: corpo.slice(re.lastIndex).trim() };
  }
  return { pre: m[1], vuoto: true };
}
const durTok = (s) => (s % 3600 === 0 ? `${s / 3600}h` : s % 60 === 0 ? `${s / 60}m` : s > 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`);
const rigaPasso = (p) => `${p.pre.replace(/-\s*$/, "- ")}${p.nota ? p.nota + " " : ""}${durTok(p.sec)}${p.resto ? " " + p.resto : ""}`;
const RIP_RE = /(?:^|\s)\d+\s*x$/i;

// Toglie gli avvisi scritti dall'HUD e ricuce i passi spezzati
function rimuoviAvvisi(testo) {
  const out = [];
  let prev = null, inRip = false;
  for (const r of String(testo).split("\n")) {
    if (!r.trim()) { out.push(r); prev = null; inRip = false; continue; }
    const p = leggiPasso(r);
    if (!p) { out.push(r); prev = null; inRip = RIP_RE.test(r.trim()); continue; }
    if (p.sec && !inRip && AVVISO_RE.test(p.nota)) {
      const nota = p.nota.replace(AVVISO_RE, "").trim();
      if (!nota && prev && prev.p.resto === p.resto) { prev.p.sec += p.sec; out[prev.i] = rigaPasso(prev.p); continue; }
      const q = { ...p, nota };
      out.push(rigaPasso(q)); prev = { i: out.length - 1, p: q }; continue;
    }
    out.push(r); prev = p.sec && !inRip ? { i: out.length - 1, p: { ...p } } : null;
  }
  return out.join("\n");
}

// Spezza i passi agli orari di rifornimento. voci = [{ t (minuti dall'inizio), tipo, nome, avviso }]
function aggiungiAvvisi(testo, voci) {
  const righe = String(testo).split("\n");
  const unita = [];
  let t = 0, rip = null;
  const chiudi = () => { if (rip) { rip.t1 = rip.t0 + rip.n * rip.giro; t = rip.t1; unita.push(rip); rip = null; } };
  for (let i = 0; i < righe.length; i++) {
    const r = righe[i];
    if (!r.trim()) { chiudi(); continue; }
    const p = leggiPasso(r);
    if (!p) { chiudi(); const mr = /(?:^|\s)(\d+)\s*x$/i.exec(r.trim()); if (mr) rip = { tipo: "blocco", n: +mr[1], giro: 0, t0: t }; continue; }
    if (!p.sec) return { testo: String(testo), inseriti: [], motivo: p.dist ? "seduta a distanza" : "passo senza durata" };
    if (rip) { rip.giro += p.sec; continue; }
    unita.push({ tipo: "passo", i, p, t0: t, t1: t + p.sec, pezzi: [{ off: 0, nota: p.nota }], divisibile: !/\bramp\b/i.test(p.resto) });
    t += p.sec;
  }
  chiudi();
  const tot = t, MIN = 120, inseriti = [];
  if (!unita.some((u) => u.tipo === "passo")) return { testo: String(testo), inseriti, motivo: "nessun passo" };
  const metti = (u, off, v) => {
    let pz = u.pezzi.find((x) => x.off === off);
    if (!pz) { pz = { off, nota: "" }; u.pezzi.push(pz); u.pezzi.sort((a, b) => a.off - b.off); }
    if (!pz.av) { pz.av = v.avviso; pz.tipo = v.tipo; }
    else if (v.tipo === "mangia" && pz.tipo === "bevi") { pz.av = v.avviso; pz.tipo = "mangia"; }
    else if (v.tipo === "mangia" && pz.tipo === "mangia" && !pz.av.includes(v.nome)) pz.av = pz.av.replace(/^Mangia (\S+)/, `Mangia $1 e ${v.nome}`);
    u.cambiata = true;
    inseriti.push({ t: Math.round((u.t0 + off) / 60), tipo: v.tipo, avviso: v.avviso, nome: v.nome });
  };
  for (const v of voci) {
    const s = v.t * 60;
    if (s <= 0 || s >= tot - 180) continue;
    const k = unita.findIndex((u) => s >= u.t0 && s < u.t1);
    if (k < 0) continue;
    const u = unita[k];
    if (u.tipo === "passo" && u.divisibile && s - u.t0 >= MIN && u.t1 - s >= MIN) { metti(u, s - u.t0, v); continue; }
    if (u.tipo === "passo" && (s - u.t0 < MIN || (!u.divisibile && s - u.t0 <= u.t1 - s))) { metti(u, 0, v); continue; }
    // dentro le ripetute o alla fine di un passo: all'inizio del passo che viene dopo
    const nx = unita.slice(k + 1).find((w) => w.tipo === "passo");
    if (nx && nx.t0 < tot - 180) metti(nx, 0, v);
  }
  for (const u of unita) {
    if (!u.cambiata) continue;
    righe[u.i] = u.pezzi.map((pz, j) => {
      const fine = j + 1 < u.pezzi.length ? u.pezzi[j + 1].off : u.p.sec;
      return rigaPasso({ pre: u.p.pre, nota: pz.av ? (pz.nota ? `${pz.av}, ${pz.nota}` : pz.av) : pz.nota, sec: fine - pz.off, resto: u.p.resto });
    }).join("\n");
  }
  return { testo: righe.join("\n"), inseriti, tot };
}
// Il testo che la seduta deve avere: senza i vecchi avvisi, con quelli di oggi
function testoConAvvisi(desc, S) {
  const base = rimuoviAvvisi(desc);
  if (!S) return { testo: base, inseriti: [] };
  return aggiungiAvvisi(base, S.voci);
}
// «Z2» senza tipo diventa «Z2 HR» in ogni passo (anche nelle ripetute); i passi con HR, passo, potenza o % restano come sono
function zoneFC(testo) {
  return String(testo).split("\n").map((r) => {
    const p = leggiPasso(r);
    if (!p || !p.sec || !/\bZ\d\b/i.test(p.resto) || /\b(?:HR|LTHR|Pace|Power|bpm|FTP)\b|%|\d\s*W\b/i.test(p.resto)) return r;
    return rigaPasso({ ...p, resto: p.resto.replace(/\b(Z\d(?:-Z\d)?)\b/i, "$1 HR") });
  }).join("\n");
}
const haAvvisi = (desc) => /^\s*-\s*(?:mangia|bevi)\b/im.test(String(desc || ""));

