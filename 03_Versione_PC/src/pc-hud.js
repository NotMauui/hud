// HUD sul computer: carica hud-dati.json, fa girare lo stesso motore dell'iPhone e mostra la pagina
// con un'impaginazione da schermo grande (barra laterale, fogli al centro).
(async function () {
  const $ = (id) => document.getElementById(id);
  const M = {};
  await motore(M);
  const E = M.exports;

  // --- memoria del browser: il file scelto (Chrome) e l'ultima copia dei dati
  const db = () => new Promise((ok, ko) => { const r = indexedDB.open("hud-pc", 1); r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  const leggi = async (k) => { try { const d = await db(); return await new Promise((ok) => { const q = d.transaction("k").objectStore("k").get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); } catch (e) { return null; } };
  const salva = async (k, v) => { try { const d = await db(); await new Promise((ok) => { const t = d.transaction("k", "readwrite"); t.objectStore("k").put(v, k); t.oncomplete = ok; t.onerror = ok; }); } catch (e) {} };

  // --- impaginazione da computer, dentro la pagina dell'app
  const CSS = `@media (min-width: 900px){
  body{padding:28px 48px 64px 280px}
  .wrap{max-width:880px}
  .tabbar{top:0;bottom:0;right:auto;width:232px;flex-direction:column;justify-content:flex-start;gap:4px;padding:88px 14px 120px;border-top:0;border-right:.5px solid var(--sep)}
  .tabbar::before{content:"HUD";position:absolute;top:32px;left:28px;font-size:24px;font-weight:700;letter-spacing:-.02em;color:var(--fg)}
  .tabbar button{flex-direction:row;justify-content:flex-start;gap:12px;min-width:0;width:100%;padding:10px 14px;border-radius:10px;color:var(--fg);cursor:pointer}
  .tabbar button span{font-size:15px;font-weight:500}
  .tabbar button svg{width:20px;height:20px;color:#8E8E93;flex:none}
  .tabbar button.on{background:var(--fill);color:var(--fg)}.tabbar button.on svg{color:var(--acc)}
  .tabbar button:hover{background:var(--fill)}
  #backbtn{display:none!important}
  .sheet{align-items:center;padding:24px}
  .sheetbox{max-width:620px;border-radius:22px;max-height:88vh;padding-bottom:24px}
  .sheetbox::before{display:none}
  .toast{bottom:40px;left:calc(50% + 116px)}
  button,[data-det],[data-goto],.rowb,.mtile,.esrow{cursor:pointer}
  .mtile:hover,.rowb:hover,.esrow:hover,.evrow:hover{background:var(--fill)}
}`;

  let HANDLE = null, ULTIMO = null;
  const quando = (s) => { const d = new Date(s); if (isNaN(d)) return "—"; const o = new Date(), g = Math.round((new Date(o.getFullYear(), o.getMonth(), o.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5), h = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); return g === 0 ? "oggi alle " + h : g === 1 ? "ieri alle " + h : d.getDate() + " " + ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"][d.getMonth()] + ", " + h; };
  const errore = (m) => { $("err").textContent = m; if (document.body.classList.contains("pronto")) $("datiq").textContent = m; };

  function mostra(testo) {
    let d;
    try { d = JSON.parse(testo); } catch (e) { throw new Error("Questo file non è hud-dati.json: scegli quello in iCloud Drive › Scriptable."); }
    if (!d || !d.raw || !Array.isArray(d.raw.activities)) throw new Error("Questo file non ha i dati dell’HUD: scegli hud-dati.json in iCloud Drive › Scriptable.");
    E.imposta(d);
    const A = E.analyze(d.raw, new Date(), d.diary || {});
    const html = E.buildHTML(A).replace("</head>", "<style>" + CSS + "</style></head>");
    $("app").srcdoc = html;
    ULTIMO = d.esportato || d.raw.fetchedAt;
    const vecchi = Date.now() - new Date(ULTIMO) > 36 * 3600e3;
    $("datiq").textContent = "Dati di " + quando(ULTIMO) + (vecchi ? ": apri l’HUD sul telefono per aggiornarli" : "");
    document.body.classList.add("pronto");
    $("err").textContent = "";
  }
  async function usa(testo) { mostra(testo); await salva("testo", testo); }
  async function daHandle(h, chiedi) {
    if (h.queryPermission) { let p = await h.queryPermission({ mode: "read" }); if (p !== "granted") { if (!chiedi) return false; p = await h.requestPermission({ mode: "read" }); if (p !== "granted") return false; } }
    const f = await h.getFile(); await usa(await f.text()); return true;
  }
  async function scegli() {
    if (window.showOpenFilePicker) {
      try { const [h] = await window.showOpenFilePicker({ types: [{ description: "Dati dell’HUD", accept: { "application/json": [".json"] } }] }); HANDLE = h; await salva("handle", h); await daHandle(h, true); }
      catch (e) { if (e && e.name !== "AbortError") errore(e.message || String(e)); }
    } else $("file").click();
  }
  $("scegli").addEventListener("click", scegli);
  $("altro").addEventListener("click", scegli);
  $("aggiorna").addEventListener("click", async () => { try { if (!HANDLE || !(await daHandle(HANDLE, true))) await scegli(); } catch (e) { errore(e.message || String(e)); } });
  $("riapri").addEventListener("click", async () => { try { if (!(await daHandle(HANDLE, true))) errore("Non ho il permesso di leggere il file: sceglilo di nuovo."); } catch (e) { errore(e.message || String(e)); } });
  $("file").addEventListener("change", async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { await usa(await f.text()); } catch (x) { errore(x.message || String(x)); } });
  const zona = $("zona");
  ["dragenter", "dragover"].forEach((t) => zona.addEventListener(t, (e) => { e.preventDefault(); zona.classList.add("sopra"); }));
  ["dragleave", "drop"].forEach((t) => zona.addEventListener(t, () => zona.classList.remove("sopra")));
  zona.addEventListener("drop", async (e) => {
    e.preventDefault();
    try {
      const it = e.dataTransfer.items && e.dataTransfer.items[0];
      if (it && it.getAsFileSystemHandle) { const h = await it.getAsFileSystemHandle(); if (h && h.kind === "file") { HANDLE = h; await salva("handle", h); await daHandle(h, true); return; } }
      const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) await usa(await f.text());
    } catch (x) { errore(x.message || String(x)); }
  });
  const largo = () => document.body.classList.toggle("largo", window.innerWidth >= 900);
  window.addEventListener("resize", largo); largo();

  // --- all'apertura: subito l'ultima copia; con Chrome si rilegge il file se il permesso c'è ancora
  HANDLE = await leggi("handle");
  if (HANDLE) $("riapri").hidden = false;
  const t = await leggi("testo");
  if (t) { try { mostra(t); } catch (e) {} }
  if (HANDLE) { try { await daHandle(HANDLE, false); } catch (e) {} }
})().catch((e) => { const el = document.getElementById("err"); if (el) el.textContent = "La pagina non si è avviata: " + (e && e.message || e); });
