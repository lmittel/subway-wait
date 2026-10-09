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
        b.addEventListener("click", () => choose({ line: r }));
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
    // the station list for this line, in the order a train meets them
    const sel = $("pk-stop"), list = stopsOf(ST.line), key = ST.line + "|" + list.length;
    if (sel.dataset.key !== key) {
      sel.dataset.key = key; sel.innerHTML = "";
      list.forEach(([pid]) => { const o = document.createElement("option"); o.value = pid; o.textContent = niceName(stopName(pid)) + (pid === META.home[ST.line] ? "  (default)" : ""); sel.appendChild(o); });
    }
    sel.value = ST.stop;
    $("pk-msg").textContent = BUSY.on ? "Loading the " + sym(BUSY.on) + " line's stations…" : BUSY.err || "";
    const W = WIN[ST.win];
    if (BUSY.on) { $("dest-txt").innerHTML = "Loading the " + sym(BUSY.on) + " line's stations…<small>&nbsp;</small>"; return; }
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
  HOOKS.busy = syncPicker;
  $("pk-stop").addEventListener("change", (e) => choose({ stop: e.target.value }));
  $("hero-own").addEventListener("click", () => { if (!$("picker").classList.contains("open")) $("dest-now").click(); $("dest").scrollIntoView({ block: "start", behavior: RM ? "auto" : "smooth" }); setTimeout(() => $("pk-q").focus({ preventScroll: true }), RM ? 0 : 400); });

  // ---------- find your station: every station, every line ----------
  const NORM = [[/[–\-\/.,']/g, " "], [/\b(\d+)(st|nd|rd|th)\b/g, "$1"], [/\bstreet\b/g, "st"], [/\bavenue\b|\bave\b/g, "av"], [/\bboulevard\b/g, "blvd"], [/\bsquare\b/g, "sq"],
    [/\bparkway\b/g, "pkwy"], [/\broad\b/g, "rd"], [/\bplace\b/g, "pl"], [/\bsaint\b/g, "st"], [/\bhighway\b/g, "hwy"], [/\bheights\b/g, "hts"], [/\s+/g, " "]];
  const norm = (s) => NORM.reduce((a, [re, to]) => a.replace(re, to), s.toLowerCase()).trim();
  const FIND = [];
  { const byPid = {};
    LINES.forEach((r) => stopsOf(r).forEach(([pid]) => { (byPid[pid] = byPid[pid] || []).push(r); }));
    Object.keys(byPid).forEach((pid) => { const nm = stopName(pid); if (nm) FIND.push({ pid, nm, key: norm(nm), toks: norm(nm).split(" "), lines: byPid[pid] }); }); }
  function findStations(q) {
    const qt = norm(q).split(" ").filter(Boolean); if (!qt.length) return [];
    const hits = FIND.filter((s) => qt.every((t) => s.toks.some((w) => w.startsWith(t))));
    const lead = norm(q);
    return hits.sort((a, b) => (b.key.startsWith(lead) - a.key.startsWith(lead)) || (b.lines.length - a.lines.length) || a.nm.localeCompare(b.nm)).slice(0, 8);
  }
  function pickHit(s, r) { $("pk-q").value = ""; $("pk-res").innerHTML = ""; choose({ line: r || (s.lines.includes(ST.line) ? ST.line : s.lines[0]), stop: s.pid }); }
  $("pk-q").addEventListener("input", () => {
    const res = $("pk-res"), q = $("pk-q").value, hits = findStations(q); res.innerHTML = "";
    if (q.trim() && !hits.length) { res.innerHTML = '<div class="pk-none">No station matches. Try part of the name, like "Bedford" or "Times".</div>'; return; }
    hits.forEach((s) => {
      const row = document.createElement("div"); row.className = "pk-hit"; row.setAttribute("role", "listitem");
      const nm = document.createElement("button"); nm.type = "button"; nm.className = "nm"; nm.textContent = niceName(s.nm); nm.addEventListener("click", () => pickHit(s)); row.appendChild(nm);
      const bl = document.createElement("span"); bl.className = "bl";
      s.lines.forEach((r) => { const b = document.createElement("button"); b.type = "button"; b.className = "bullet"; b.textContent = sym(r); b.style.setProperty("--bc", lineColor(r)); b.style.setProperty("--bt", lineText(r));
        b.setAttribute("aria-label", niceName(s.nm) + ", " + (r === "GS" ? "42 St Shuttle" : r + " train")); b.addEventListener("click", () => pickHit(s, r)); bl.appendChild(b); });
      row.appendChild(bl); res.appendChild(row);
    });
  });
  $("pk-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { const h = findStations($("pk-q").value); if (h.length) { pickHit(h[0]); e.preventDefault(); } } else if (e.key === "Escape") { $("pk-q").value = ""; $("pk-res").innerHTML = ""; } });
