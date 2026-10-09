  // =====================================================================
  // WHAT CV MEASURES: a spread of lines on the real clock, then each on its own clock
  // =====================================================================
  const CVM = { k: 0, rows: null, key: "" };
  const lcPhrase = (r, d) => (r === "GS" ? "the 42 St Shuttle" : trainsPhrase(r, d).replace(/^(Uptown|Downtown)/, (w) => w.toLowerCase()));
  const looks = (r) => (r === "GS" ? " looks" : " look");
  function cvRows() {
    const key = ST.line + ST.dir + ST.win; if (CVM.key === key && CVM.rows) return CVM.rows; CVM.key = key;
    const all = [];
    LINES.forEach((r) => ["N", "S"].forEach((d) => {
      if (!SER[r][d] || (r === "GS" && d === "S")) return;
      const t = dayArrivals(r, d, MAREY_IDX, ST.win); if (t.length < 8) return;
      const g = []; for (let i = 0; i + 1 < t.length; i++) g.push((t[i + 1] - t[i]) / 60);
      all.push({ r, d, t, s: stats(Float64Array.from(g)) });
    }));
    all.sort((a, b) => a.s.cv - b.s.cv);
    const n = Math.min(8, all.length), pick = new Set(); for (let i = 0; i < n; i++) pick.add(all[Math.round(i * (all.length - 1) / Math.max(1, n - 1))]);
    const me = all.find((q) => q.r === ST.line && q.d === ST.dir); if (me) pick.add(me);
    return (CVM.rows = all.filter((q) => pick.has(q)));
  }
  function drawCV() {
    const cv = $("cv-cvrows"), Wd = cv.clientWidth || 800, narrow = Wd < 560, rows = cvRows(), rowH = narrow ? 34 : 38;
    const { ctx, W, H } = fit(cv, 26 + rows.length * rowH + 8), Wn = WIN[ST.win], k = CVM.k;
    caption(cv, dayLong(MAREY_IDX) + ", " + Wn.lab.toLowerCase() + ". Each mark is a train; the grey bracket is one average gap.");
    if (!rows.length) { text(ctx, "Too few trains in this window that day.", 0, 30, 14, C.muted); return; }
    const lab = narrow ? 30 : 104, x0 = lab, x1 = W - (narrow ? 40 : 58), NG = 22;
    text(ctx, "CV", W - 4, 14, 12, C.muted, "right", 700);
    rows.forEach((q, i) => {
      const y = 26 + i * rowH + rowH * 0.55, isMe = q.r === ST.line && q.d === ST.dir, t0 = q.t[0], span = NG * q.s.mu * 60;
      const X = (t) => lerp(x0 + (t - Wn.a) / (Wn.b - Wn.a) * (x1 - x0), x0 + (t - t0) / span * (x1 - x0), k);
      if (isMe) { ctx.fillStyle = rgba(C.rgb.edge, 0.22); ctx.fillRect(0, y - rowH * 0.55, W, rowH); }
      bulletDraw(ctx, q.r, 11, y - 3, 9.5);
      if (!narrow) text(ctx, DIRSHORT(q.r, q.d), 26, y + 1, 12, C["ink-2"], "left", 520);
      ctx.strokeStyle = C.dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)"; ctx.lineWidth = 1; line(ctx, x0, y + 0.5, x1, y + 0.5);
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 2, y - rowH, x1 - x0 + 4, rowH * 1.5); ctx.clip();
      ctx.fillStyle = lineColor(q.r); q.t.forEach((t) => { const x = X(t); if (x >= x0 - 2 && x <= x1 + 2) ctx.fillRect(x - 1.25, y - 13, 2.5, 13); });
      // one average gap, as a bracket under the first train
      const bx0 = X(t0), bx1 = X(t0 + q.s.mu * 60); ctx.strokeStyle = C.steel; ctx.lineWidth = 2; line(ctx, bx0, y + 6, bx1, y + 6); line(ctx, bx0, y + 3, bx0, y + 9); line(ctx, bx1, y + 3, bx1, y + 9);
      ctx.restore();
      text(ctx, q.s.cv.toFixed(2), W - 4, y + 1, 14, isMe ? C.ink : C["ink-2"], "right", isMe ? 760 : 600);
    });
    const a = rows[0], b = rows[rows.length - 1], w = (q) => ((1 + q.s.cv * q.s.cv) / 2).toFixed(2);
    $("f-cv").innerHTML = MD`\mathrm{CV} = \frac{\sigma}{\mu}` + ' <span class="fnum" style="margin-left:1.4em">' + MD`\frac{E[W]}{\mu} = \frac{1 + \mathrm{CV}^2}{2}` + "</span>";
    $("n-cv").innerHTML = (k > 0.5 ? "On their own clocks, " + lcPhrase(a.r, a.d) + looks(a.r) + " like a metronome and " + lcPhrase(b.r, b.d) + " like Morse code. " : "Switch to each line's own clock to compare them fairly. ") +
      "Doubling every gap doubles " + M`\sigma` + " and " + M`\mu` + " alike and leaves the CV unchanged: it has no units. Measured in average gaps, the average wait depends on the CV alone: " + w(a) + " for the most even line here, " + w(b) + " for the least even.";
  }
  function cvClock(own) { $("cvc-real").setAttribute("aria-pressed", !own); $("cvc-own").setAttribute("aria-pressed", own); tween(CVM, { k: own ? 1 : 0 }, 900, drawCV); }
  $("cvc-real").addEventListener("click", () => cvClock(false));
  $("cvc-own").addEventListener("click", () => cvClock(true));

  // =====================================================================
  // IS THAT GAP REAL? the train graph around the morning's longest gap, and what deleting long gaps would do
  // =====================================================================
  // from the full archive: trains recorded at the stations on both sides of the platform but not at the platform
  const MISSED = META.missed || {};
  function drawHole() {
    const cv = $("cv-hole"), Wd = cv.clientWidth || 800, narrow = Wd < 560, { ctx, W, H } = fit(cv, 320), m = MAR[ST.line][ST.dir];
    const miss = MISSED[ST.line + ST.dir] || 0, missNote = () => "Across all " + (NUMW[WEEKDAYS_N] || WEEKDAYS_N) + " days we found " + (miss ? "only " + miss + " train" + (miss > 1 ? "s" : "") : "no train") + " recorded at the neighbouring station" + (m && m.stops.length > 2 ? "s" : "") + " but missing at " + stationName(ST.line) + ". Gaps that overlap an outage in the data feed are dropped.";
    if (!m || m.trips.length < 2) { caption(cv, "This line's train graph is too short to show a gap with its neighbours."); $("n-hole").innerHTML = missNote(); return; }
    const pt = platformTimes(m); let best = -1, bg = 0;
    for (let i = 0; i + 1 < pt.length; i++) { if (pt[i] < 6 * 3600 + 900 || pt[i + 1] > 10.5 * 3600 - 900) continue; const g = pt[i + 1] - pt[i]; if (g > bg) { bg = g; best = i; } }
    if (best < 0) { caption(cv, "Too few trains on the train graph for this line."); $("n-hole").innerHTML = missNote(); return; }
    const ta = pt[best], tb = pt[best + 1], pad = Math.max(8 * 60, bg * 0.55), A = Math.max(6 * 3600, ta - pad), B = Math.min(10.5 * 3600, tb + pad);
    caption(cv, dayLong(MAREY_IDX) + ", 6–10:30 am: the longest gap at " + stationName(ST.line) + " was " + fmt(bg / 60) + " minutes. Here it is with every station on the line.");
    const x0 = narrow ? 8 : 168, x1 = W - 10, y0 = 10, y1 = H - 30, here = m.here, kmMax = m.km[m.km.length - 1] || 1, up = ST.dir === "N";
    const sx = (t) => x0 + (t - A) / (B - A) * (x1 - x0), sy = (km) => (up ? y1 - km / kmMax * (y1 - y0) : y0 + km / kmMax * (y1 - y0)), ys = m.km.map(sy);
    // stations
    const per = (y1 - y0) / Math.max(1, m.stops.length - 1), step = Math.max(1, Math.ceil(12 / Math.max(per, 0.1)));
    m.stops.forEach((nm, i) => {
      ctx.fillStyle = i === here ? C.edge : C.dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"; ctx.fillRect(x0, Math.round(ys[i]), x1 - x0, i === here ? 2 : 1);
      if (!narrow && i !== here && i % step === 0 && Math.abs(ys[i] - ys[here]) > 11) text(ctx, nm.replace(/-/g, "–"), x0 - 8, ys[i] + 3.5, 10.5, C.muted, "right", 450);
    });
    if (!narrow) text(ctx, stationName(ST.line), x0 - 8, ys[here] + 4, 12, C.ink, "right", 760);
    else halo(ctx, stationName(ST.line), x0 + 4, ys[here] - 7, 12, C.ink, "left", 760);
    // the two trains around the gap, and the empty band between them
    const crossing = (pts) => { const p = pts.find(([k]) => k === here); return p ? p[1] : null; };
    const trA = m.trips.find((pts) => crossing(pts) === ta), trB = m.trips.find((pts) => crossing(pts) === tb);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, H); ctx.clip();
    if (trA && trB) {
      const ka = new Map(trA.map(([k, t]) => [k, t])), kb = new Map(trB.map(([k, t]) => [k, t])), ks = [...ka.keys()].filter((k) => kb.has(k)).sort((p, q) => p - q);
      if (ks.length > 1) { ctx.beginPath(); ks.forEach((k, i) => (i ? ctx.lineTo(sx(ka.get(k)), ys[k]) : ctx.moveTo(sx(ka.get(k)), ys[k]))); ks.slice().reverse().forEach((k) => ctx.lineTo(sx(kb.get(k)), ys[k])); ctx.closePath(); ctx.fillStyle = rgba(C.rgb.led, C.dark ? 0.16 : 0.12); ctx.fill(); }
    }
    // a train hiding in the band would cross the platform between the two trains without a record there
    let ghosts = 0;
    m.trips.forEach((pts) => {
      const isAB = pts === trA || pts === trB;
      ctx.beginPath(); pts.forEach(([k, t], i) => (i ? ctx.lineTo(sx(t), ys[k]) : ctx.moveTo(sx(t), ys[k])));
      ctx.strokeStyle = isAB ? lineColor(ST.line) : rgba(hexRgb(lineColor(ST.line)), 0.45); ctx.lineWidth = isAB ? 3 : 1.5; ctx.stroke();
      if (!isAB && crossing(pts) == null) { const b4 = pts.filter(([k]) => k < here), af = pts.filter(([k]) => k > here); if (b4.length && af.length) { const p1 = b4[b4.length - 1], p2 = af[0], tt = p1[1] + (p2[1] - p1[1]) * (here - p1[0]) / (p2[0] - p1[0]); if (tt > ta && tt < tb) ghosts++; } }
    });
    ctx.restore();
    // the platform's view of it
    ctx.fillStyle = C.edge; [ta, tb].forEach((t) => { ctx.beginPath(); ctx.arc(sx(t), ys[here], 5, 0, 6.283); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.stroke(); });
    const by = ys[here] + (up ? 18 : -14); ctx.strokeStyle = C["led-deep"]; ctx.lineWidth = 2; line(ctx, sx(ta), by, sx(tb), by); line(ctx, sx(ta), by - 4, sx(ta), by + 4); line(ctx, sx(tb), by - 4, sx(tb), by + 4);
    halo(ctx, fmt(bg / 60) + " min with no train", (sx(ta) + sx(tb)) / 2, by + (up ? 16 : -8), 12.5, C["led-deep"], "center", 760);
    for (let t = Math.ceil(A / 600) * 600; t <= B; t += 600) tlab(ctx, hhmm(t), sx(t), y1 + 20, 11.5, C.muted, 500, x0, W);
    const nb = [m.stops[here - 1], m.stops[here + 1]].filter(Boolean).map((s) => s.replace(/-/g, "–"));
    $("n-hole").innerHTML = (ghosts ? "<b>" + ghosts + " train" + (ghosts > 1 ? "s" : "") + " cross the empty band</b> without a record at " + stationName(ST.line) + ": that gap is partly an artifact. " : "No train line crosses the yellow platform line inside the shaded band, and a train that slipped past " + stationName(ST.line) + " unrecorded would have to. <b>This gap is real.</b> ") +
      "Across all " + (NUMW[WEEKDAYS_N] || WEEKDAYS_N) + " days we found " + (miss ? "only " + miss + " trains" : "no train") + " recorded at " + (nb.length > 1 ? nb.join(" and ") : nb[0] || "the next station") + " but missing at " + stationName(ST.line) + ". Gaps that overlap an outage in the data feed are dropped.";
  }
  const TR = { x: null, key: "" };
  function drawTrim() {
    const h = pooled(ST.line, ST.dir, ST.win), s = stats(h); if (!s) return;
    const key = ST.line + ST.dir + ST.win, inp = $("tr-x"), hmax = s.max, lo = Math.max(1, Math.floor(quant(h, 0.5) * 2) / 2), hi = Math.ceil(hmax * 2) / 2 + 0.5;
    if (TR.key !== key) { TR.key = key; TR.x = Math.max(lo, Math.round(quant(h, 0.95) * 2) / 2); }
    inp.min = lo; inp.max = hi; inp.value = TR.x; TR.x = +inp.value; $("tr-x-v").textContent = TR.x >= hmax ? "keep all" : TR.x.toFixed(1) + " min";
    const trimmed = (x) => { let n = 0, a = 0, b = 0; for (const v of h) if (v <= x) { n++; a += v; b += v * v; } return { n, mu: a / n, EW: b / (2 * a) }; };
    const cv = $("cv-trim"), { ctx, W, H } = fit(cv, 230), N = 160, xs = Array.from({ length: N + 1 }, (_, i) => lo + (hi - lo) * i / N), T = xs.map(trimmed);
    caption(cv, "What is left after throwing out the long gaps, as a share of the full data's value");
    const pm = T.map((q) => 100 * q.mu / s.mu), pw = T.map((q) => 100 * q.EW / s.EW), ymin = Math.max(0, Math.floor(Math.min(...pw, ...pm) / 10) * 10);
    const x0 = 46, x1 = W - 12, top = 12, axisY = H - 40, sx = (v) => x0 + (v - lo) / (hi - lo) * (x1 - x0), sy = (v) => axisY - (v - ymin) / (100 - ymin) * (axisY - top);
    const yt = []; for (let v = ymin; v <= 100.01; v += (100 - ymin) <= 30 ? 5 : 10) yt.push(v);
    yGrid(ctx, x0, x1, yt, sy, (v) => v + "%");
    const xst = niceStep(hi - lo, 8), xt = []; for (let v = Math.ceil(lo / xst) * xst; v <= hi + 1e-9; v += xst) xt.push(v);
    xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v)); text(ctx, "throw out gaps longer than this, minutes", x1, axisY + 30, 12, C.muted, "right", 500);
    const curve = (ys, col, lw) => { ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(sx(x), sy(ys[i])) : ctx.moveTo(sx(x), sy(ys[i])))); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); };
    curve(pm, C.steel, 2.4); curve(pw, C.led, 3);
    const q = trimmed(TR.x), xq = sx(TR.x);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); line(ctx, xq, top, xq, axisY); ctx.setLineDash([]);
    [[100 * q.mu / s.mu, C.steel, "mean gap"], [100 * q.EW / s.EW, C.led, "average wait"]].forEach(([v, col, lab], j) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(xq, sy(v), 5.5, 0, 6.283); ctx.fill(); halo(ctx, lab + " " + v.toFixed(0) + "%", xq + (xq > (x0 + x1) / 2 ? -9 : 9), sy(v) + (j ? 16 : -8), 12.5, j ? C["led-deep"] : C.steel, xq > (x0 + x1) / 2 ? "right" : "left", 740); });
    const drop = s.n - q.n; let a2 = 0, b2 = 0; for (const v of h) { b2 += v * v; if (v > TR.x) a2 += v * v; }
    $("ro-trim").innerHTML = '<div class="ro"><div class="v">' + drop + '</div><div class="k">gaps thrown out, of ' + s.n + "</div></div>" +
      '<div class="ro trains"><div class="v">' + fmt(q.mu, 2) + '</div><div class="k">mean gap (really ' + fmt(s.mu, 2) + ")</div></div>" +
      '<div class="ro wait"><div class="v">' + fmt(q.EW, 2) + '</div><div class="k">average wait (really ' + fmt(s.EW, 2) + ")</div></div>";
    $("n-trim").innerHTML = drop ? "Throwing out " + (drop === 1 ? "the one gap" : "the " + drop + " gaps") + " over " + TR.x.toFixed(1) + " min, " + Math.round(100 * drop / s.n) + "% of the gaps, lowers the mean gap by " + Math.round(100 * (1 - q.mu / s.mu)) + "% but the average wait by <b>" + Math.round(100 * (1 - q.EW / s.EW)) + "%</b>. Those gaps held " + Math.round(100 * a2 / b2) + "% of all the time riders spent waiting."
      : "Nothing thrown out yet. Drag the slider left.";
  }
  $("tr-x").addEventListener("input", (e) => { TR.x = +e.target.value; drawTrim(); });
