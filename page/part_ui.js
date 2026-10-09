  // =====================================================================
  // destination sign, line picker, strip-map rail, express/local, theme
  // =====================================================================
  const WINPHRASE = { am: "weekday mornings", mid: "weekday middays", pm: "weekday evening rushes", eve: "weekday evenings", late: "weeknights, 1–5 am" };
  function buildPicker() {
    const L = $("pk-lines"); L.innerHTML = "";
    GROUPS.forEach((g) => {
      const box = document.createElement("div"); box.className = "pk-group";
      g.forEach((r) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "bullet"; b.textContent = sym(r);
        b.style.setProperty("--bc", lineColor(r)); b.style.setProperty("--bt", lineText(r));
        b.setAttribute("aria-label", (r === "GS" ? "42 St Shuttle" : r + " train")); b.dataset.line = r;
        b.addEventListener("click", () => setState({ line: r }));
        box.appendChild(b);
      });
      L.appendChild(box);
    });
    const Wn = $("pk-win"); Wn.innerHTML = "";
    WINS.forEach((w) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.dataset.win = w.id;
      b.innerHTML = w.lab + ' <span style="opacity:.7">' + w.sub + "</span>"; b.addEventListener("click", () => setState({ win: w.id })); Wn.appendChild(b);
    });
  }
  function syncPicker() {
    document.querySelectorAll("#pk-lines .bullet").forEach((b) => b.setAttribute("aria-pressed", b.dataset.line === ST.line));
    const D = $("pk-dir"); D.innerHTML = "";
    ["N", "S"].forEach((d) => {
      if (!SER[ST.line][d] || (ST.line === "GS" && d === "S")) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.textContent = cap(META.dirlab[ST.line][d]);
      b.setAttribute("aria-pressed", ST.dir === d); b.addEventListener("click", () => setState({ dir: d })); D.appendChild(b);
    });
    document.querySelectorAll("#pk-win .pill").forEach((b) => { const ok = valid(ST.line, ST.dir, b.dataset.win); b.disabled = !ok; b.style.opacity = ok ? 1 : 0.35; b.setAttribute("aria-pressed", b.dataset.win === ST.win); });
    const db = $("dest-bullet"); db.textContent = sym(ST.line); db.style.setProperty("--bc", lineColor(ST.line)); db.style.setProperty("--bt", lineText(ST.line));
    const W = WIN[ST.win];
    $("dest-txt").innerHTML = trainsPhrase(ST.line, ST.dir) + " at " + stationName(ST.line) + "<small>" + W.lab + ", " + W.sub + '<span class="dates"> · ' + daysWord(ST.win) + (ST.win === "late" ? " weeknights" : " weekdays") + " in " + DATESPAN + "</span></small>";
  }
  $("dest-now").addEventListener("click", () => { const p = $("picker"), o = !p.classList.contains("open"); p.classList.toggle("open", o); $("dest").classList.toggle("open", o); $("dest-now").setAttribute("aria-expanded", o); });
  $("ride-local").addEventListener("click", () => { document.body.classList.remove("express"); $("ride-local").setAttribute("aria-pressed", true); $("ride-express").setAttribute("aria-pressed", false); railSync(); });
  $("ride-express").addEventListener("click", () => { document.body.classList.add("express"); $("ride-local").setAttribute("aria-pressed", false); $("ride-express").setAttribute("aria-pressed", true); railSync(); });
  $("theme-b").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark"); readTheme(); redrawAll();
  });
  // the rail: the page drawn as a subway line
  const RAILSECS = [{ id: "top", name: "Platform", exp: true }].concat(Array.from(document.querySelectorAll("main [data-rail]")).map((s) => ({ id: s.id, name: s.dataset.rail, exp: s.classList.contains("express") })));
  { const ol = $("rail-list");
    RAILSECS.forEach((s) => {
      const li = document.createElement("li"); li.className = s.exp ? "express" : "local";
      li.innerHTML = '<a href="#' + s.id + '"><span class="stop ' + (s.exp ? "exp" : "loc") + '"><i></i></span><span>' + s.name + "</span></a>";
      ol.appendChild(li); s.a = li.querySelector("a");
    });
  }
  let railCur = "top";
  function railSync() {
    const idx = RAILSECS.findIndex((s) => s.id === railCur);
    RAILSECS.forEach((s, i) => { s.a.classList.toggle("on", i === idx); s.a.classList.toggle("passed", i < idx); });
  }
  const railIO = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { railCur = e.target.id; railSync(); } });
  }, { rootMargin: "-35% 0px -60% 0px" });
  RAILSECS.forEach((s) => railIO.observe($(s.id)));
  // the strip map appears once you leave the tunnel
  new IntersectionObserver((es) => es.forEach((e) => document.body.classList.toggle("past-hero", e.intersectionRatio < 0.2)), { threshold: [0, 0.2, 0.4] }).observe($("top"));
  buildPicker();
  onState(syncPicker);
