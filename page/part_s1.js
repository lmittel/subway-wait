  // =====================================================================
  // HERO: the question, the guess, and the train graph of one real morning
  // =====================================================================
  const HERO = { prog: 1, revealed: false, touched: false, key: "" };
  // after the reveal, riders rain onto the platform: each orange stroke is one rider's wait, growing until a train comes
  const RAIN = { t: 0, list: [], key: "", raf: 0 };
  function platformTimes(m) { const out = []; m.trips.forEach((pts) => { const p = pts.find(([k]) => k === m.here); if (p) out.push(p[1]); }); return out.sort((a, b) => a - b); }
  function startRain() {
    const m = MAR[ST.line][ST.dir]; if (!m) return;
    const pt = platformTimes(m); if (pt.length < 3) return;
    const rng = mulberry(7), a = pt[0], b = pt[pt.length - 1];
    RAIN.list = Array.from({ length: 280 }, () => { const t = a + rng() * (b - a); let j = 0; while (j < pt.length - 1 && pt[j] <= t) j++; return { t, nx: pt[j], d: rng() * 0.8 }; }).sort((p, q) => p.t - q.t);
    // stack the waits: each rider takes the lowest free lane, so the stack's height is the crowd on the platform
    const ends = []; RAIN.list.forEach((r) => { let k = 0; while (ends[k] != null && ends[k] > r.t) k++; r.lane = k; ends[k] = r.nx; });
    RAIN.lanes = ends.length;
    RAIN.key = ST.line + ST.dir + ST.stop; cancelAnimationFrame(RAIN.raf);
    if (RM) { RAIN.t = 99; drawMarey(); return; }
    const t0 = performance.now(), end = 0.8 + Math.max(...RAIN.list.map((r) => r.nx - r.t)) / RAIN_SPEED + 0.1;
    const step = (now) => { RAIN.t = (now - t0) / 1000; drawMarey(); if (RAIN.t < end) RAIN.raf = requestAnimationFrame(step); };
    RAIN.raf = requestAnimationFrame(step);
  }
  const RAIN_SPEED = 12 * 60;   // seconds of waiting shown per second of animation
  const lighten = (hex, t) => { const c = hexRgb(hex); return "rgb(" + c.map((v) => Math.round(v + (255 - v) * t)).join(",") + ")"; };
  function drawMarey() {
    const cv = $("cv-marey"), box = cv.parentElement, H = Math.max(300, Math.round(box.clientHeight || 420));
    const { ctx, W } = fit(cv, H);
    const m = MAR[ST.line][ST.dir];
    if (!m || !m.trips.length) { text(ctx, "No train graph for this platform on " + dayLong(MAREY_IDX) + " morning.", 16, 40, 14, "#9aa1a6", "left", 500); $("marey-cap").textContent = ""; return; }
    const narrow = W < 560, x0 = narrow ? 6 : Math.min(200, Math.round(W * 0.25)), x1 = W - 8, y0 = 12, y1 = H - 34;
    const tA = 6 * 3600, tB = 10.5 * 3600, sx = (t) => x0 + (t - tA) / (tB - tA) * (x1 - x0);
    const kmMax = m.km[m.km.length - 1] || 1, up = ST.dir === "N";
    const sy = (km) => (up ? y1 - km / kmMax * (y1 - y0) : y0 + km / kmMax * (y1 - y0));
    const ys = m.km.map(sy), here = m.here;
    // the chosen time window, if it falls in the morning
    const Wn = WIN[ST.win];
    if (Wn.a < tB && Wn.b > tA) { const a = sx(Math.max(Wn.a, tA)), b = sx(Math.min(Wn.b, tB)); ctx.fillStyle = "rgba(255,255,255,.045)"; ctx.fillRect(a, y0, b - a, y1 - y0); }
    ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1;
    for (let h = 6; h <= 10; h++) { const x = Math.round(sx(h * 3600)) + 0.5; line(ctx, x, y0, x, y1); tlab(ctx, h + " am", x, y1 + 18, 12, "#7f878d", 500, 0, W); }
    // stations
    const per = (y1 - y0) / Math.max(1, m.stops.length - 1), step = Math.max(1, Math.ceil(12 / Math.max(per, 0.1)));
    m.stops.forEach((name, i) => {
      const y = ys[i];
      ctx.fillStyle = i === here ? C.edge : "rgba(255,255,255,.18)"; ctx.fillRect(x0 - 4, Math.round(y) - 0.5, 4, 1);
      if (!narrow && (i % step === 0 || i === here || i === m.stops.length - 1) && (i === here || Math.abs(y - ys[here]) > 11)) {
        const isH = i === here, nm = isH ? stationName(ST.line) : name.replace(/-/g, "–"), wt = isH ? 700 : 450;
        let px = isH ? 12.5 : 10.5; while (px > 8 && tw(ctx, nm, px, wt) > x0 - 14) px -= 0.5;
        text(ctx, nm, x0 - 9, y + 3.5, px, isH ? C.edge : "#737b81", "right", wt);
      }
    });
    // every train: one string, drawn in as time unrolls
    const clipX = x0 + HERO.prog * (x1 - x0);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, clipX - x0 + 1, H); ctx.clip();
    ctx.strokeStyle = lighten(lineColor(ST.line), C.dark ? 0.18 : 0.22); ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.globalAlpha = 0.92;
    m.trips.forEach((pts) => { ctx.beginPath(); pts.forEach(([k, t], i) => { const x = sx(t), y = ys[k]; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); });
    ctx.restore();
    // riders' waits, drawn just above the platform
    if (RAIN.list.length && RAIN.key === ST.line + ST.dir + ST.stop) {
      const lh = Math.min(3, Math.max(1.6, Math.min(90, (ys[here] - y0) * 0.7) / Math.max(1, RAIN.lanes))), live = [];
      RAIN.list.forEach((r) => { const el = (RAIN.t - r.d) * RAIN_SPEED; if (el > 0) live.push([sx(r.t), sx(Math.min(r.nx, r.t + el)), ys[here] - 4 - (r.lane + 0.5) * lh]); });
      ctx.lineCap = "butt"; ctx.lineWidth = Math.max(1, lh - 0.7); ctx.strokeStyle = "rgba(255,138,51,.95)"; ctx.beginPath();
      live.forEach(([xa, xb, y]) => { ctx.moveTo(xa, y); ctx.lineTo(Math.max(xb, xa + 0.8), y); }); ctx.stroke();
      ctx.fillStyle = C.edge; ctx.beginPath(); live.forEach(([xa, , y]) => { ctx.rect(xa - 0.8, y - lh / 2 + 0.3, 1.6, lh - 0.6); }); ctx.fill();
    }
    // your platform
    ctx.strokeStyle = C.edge; ctx.lineWidth = 2; ctx.globalAlpha = 1; line(ctx, x0, ys[here], x1, ys[here]);
    ctx.fillStyle = C.edge;
    m.trips.forEach((pts) => { const p = pts.find(([k]) => k === here); if (p && sx(p[1]) <= clipX) { ctx.beginPath(); ctx.arc(sx(p[1]), ys[here], 3.3, 0, 6.283); ctx.fill(); } });
    if (narrow) halo(ctx, stationName(ST.line), x0 + 4, ys[here] + 17, 12, C.edge, "left", 700, C.tunnel);
    $("marey-cap").textContent = "Every " + trainsPhrase(ST.line, ST.dir).replace(" trains", " train").replace(/^(Uptown|Downtown)/, (w) => w.toLowerCase()) + ", " + dayLong(MAREY_IDX) + ", " + dateOf(MAREY_DAY).getFullYear() + ", 6–10:30 am. Yellow: your platform." + (RAIN.list.length && RAIN.key === ST.line + ST.dir + ST.stop ? " Orange: each stroke is one rider's wait; stacked, they are the crowd on the platform." : "");
  }
  function animateMarey() {
    if (RM) { HERO.prog = 1; drawMarey(); return; }
    HERO.prog = 0; tween(HERO, { prog: 1 }, 1700, drawMarey);
  }
  function drawRuler() {
    const cv = $("cv-ruler"), { ctx, W, H } = fit(cv, 54), s = S(); if (!s) return;
    const inp = $("guess"), mx = +inp.max, sx = (v) => 9 + v / mx * (W - 18), base = 30;
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1; line(ctx, 9, base + 0.5, W - 9, base + 0.5);
    for (let v = 0; v <= mx + 1e-9; v += 0.5) {
      const x = Math.round(sx(v)) + 0.5, big = Math.abs(v - Math.round(v)) < 1e-9;
      ctx.strokeStyle = "rgba(255,255,255," + (big ? 0.5 : 0.25) + ")"; line(ctx, x, base, x, base + (big ? 7 : 4));
      if (big) text(ctx, String(v), x, base + 20, 11, "#8d959a", "center", 500);
    }
    if (HERO.revealed) {
      // half the gap, labelled to its left; the riders' average wait, labelled to its right
      const hx = sx(s.half), ax = sx(s.EW), l1 = "half the gap " + fmt(s.half), l2 = "riders wait " + fmt(s.EW);
      ctx.fillStyle = "#cfd4d8"; ctx.fillRect(hx - 1, 4, 2, base - 4);
      text(ctx, l1, Math.max(hx - 6, tw(ctx, l1, 11.5, 600) + 2), 13, 11.5, "#c4cace", "right", 600);
      ctx.fillStyle = C.edge; ctx.fillRect(ax - 2, 4, 4, base - 4);
      text(ctx, l2, Math.min(ax + 7, W - tw(ctx, l2, 11.5, 750) - 2), 13, 11.5, C.edge, "left", 750);
    }
    const g = +inp.value, gx = sx(g);
    ctx.fillStyle = C.led; ctx.shadowColor = "rgba(255,122,26,.6)"; ctx.shadowBlur = 8; ctx.fillRect(gx - 2, 18, 4, base - 18); ctx.beginPath(); ctx.arc(gx, base, 6.5, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
  }
  function heroSync() {
    const s = S(); if (!s) return;
    $("hero-q").innerHTML = "<b>" + trainsPhrase(ST.line, ST.dir) + "</b> reach " + stationName(ST.line) + " every <b>" + fmt(s.mu) + " minutes</b> on average, " + WINPHRASE[ST.win] + ". You step onto the platform at a random moment. How long do you wait, on average?";
    const inp = $("guess"), mx = Math.max(6, Math.ceil(Math.max(s.EW, s.mu) * 1.5));
    inp.max = mx; if (!HERO.touched) inp.value = (Math.round(s.half * 10) / 10).toFixed(1);
    $("guess-v").textContent = (+inp.value).toFixed(1) + " min";
    HERO.revealed = false; $("guess-out").innerHTML = ""; $("guess-go").textContent = "Check my guess";
    RAIN.list = []; cancelAnimationFrame(RAIN.raf);
    drawRuler();
  }
  $("guess").addEventListener("input", () => { HERO.touched = true; $("guess-v").textContent = (+$("guess").value).toFixed(1) + " min"; drawRuler(); });
  $("guess-go").addEventListener("click", () => {
    const s = S(); if (!s) return; HERO.revealed = true; drawRuler(); startRain();
    const g = +$("guess").value, pct = Math.round((s.EW / s.half - 1) * 100);
    const verdict = Math.abs(g - s.EW) < 0.25 ? "You got it." : g < s.EW ? "Your guess is " + fmt(s.EW - g) + " min short." : "Your guess is " + fmt(g - s.EW) + " min long.";
    $("guess-out").innerHTML = "On average you wait <b>" + fmt(s.EW) + " minutes</b>, " + pct + "% more than half the average gap. " + verdict + " The gap you walk into tends to be one of the long ones.";
  });

  // =====================================================================
  // ASK THE TRAINS: one day's platform, then every gap from ten weekdays
  // =====================================================================
  function drawStrip() {
    const SD = showDay(), cv = $("cv-strip"), { ctx, W, H } = fit(cv, 106), arr = dayArrivals(ST.line, ST.dir, SD, ST.win);
    caption(cv, dayLong(SD) + ": each mark is a train reaching " + stationName(ST.line) + ". Numbers are the gaps, in minutes.");
    if (arr.length < 2) { text(ctx, "No trains recorded in this window that day.", 0, 40, 14, C.muted); return; }
    const Wn = WIN[ST.win], x0 = 4, x1 = W - 4, sx = (t) => x0 + (t - Wn.a) / (Wn.b - Wn.a) * (x1 - x0), yP = 62;
    ctx.fillStyle = pattern(ctx, "riders"); ctx.fillRect(x0, yP, x1 - x0, 8);
    const s = S();
    for (let i = 0; i + 1 < arr.length; i++) {
      const a = sx(arr[i]), b = sx(arr[i + 1]), g = (arr[i + 1] - arr[i]) / 60;
      if (b - a >= 22) text(ctx, g < 10 ? g.toFixed(1) : Math.round(g) + "", (a + b) / 2, 42, 11.5, g > s.mu ? C.ink : C.muted, "center", g > s.mu ? 700 : 450);
    }
    arr.forEach((t) => { const x = sx(t); ctx.fillStyle = lineColor(ST.line); ctx.fillRect(x - 2, 16, 4, 44); ctx.strokeStyle = C.ink; ctx.lineWidth = 0.8; ctx.strokeRect(x - 2, 16, 4, 44); });
    const step = (Wn.b - Wn.a) > 4 * 3600 ? 3600 : 1800;
    for (let t = Math.ceil(Wn.a / step) * step; t <= Wn.b; t += step) tlab(ctx, hhmm(t).replace(":00", ""), sx(t), 92, 12, C.muted, 500, 0, W);
  }
  function histBins(h, bw, xmax, weight) {
    const nb = Math.ceil(xmax / bw), c = new Float64Array(nb); let tot = 0;
    for (const x of h) { const k = Math.min(nb - 1, Math.floor(x / bw)), w = weight ? x : 1; c[k] += w; tot += w; }
    for (let k = 0; k < nb; k++) c[k] /= tot || 1;
    return c;
  }
  function binWidth(s) { return s.mu < 3.2 ? 0.5 : s.mu < 9 ? 1 : 2; }
  function drawGapHist() {
    const cv = $("cv-hgaps"), { ctx, W, H } = fit(cv, 250), h = pooled(ST.line, ST.dir, ST.win), s = stats(h);
    if (!s) return;
    const bw = binWidth(s), xmax = Math.ceil((quant(h, 0.995) + bw) / bw) * bw, c = histBins(h, bw, xmax);
    const x0 = 46, x1 = W - 12, top = 30, axisY = H - 34, ymax = Math.max(...c) * 1.18;
    const sx = (v) => x0 + v / xmax * (x1 - x0), sy = (v) => axisY - v / ymax * (axisY - top);
    text(ctx, "Share of the " + s.n + " gaps", 0, 14, 13, C["ink-2"], "left", 500);
    const yst = niceStep(ymax * 100, 4) / 100, yt = []; for (let v = 0; v <= ymax + 1e-9; v += yst) yt.push(v);
    yGrid(ctx, x0, x1, yt, sy, (v) => Math.round(v * 100) + "%");
    ctx.fillStyle = C.steel;
    c.forEach((v, k) => { if (!v) return; const a = sx(k * bw), b = sx((k + 1) * bw); ctx.fillRect(a + 0.5, sy(v), Math.max(1, b - a - 1.5), axisY - sy(v)); });
    if (s.max >= xmax) halo(ctx, (xmax - bw) + "+", sx(xmax - bw / 2), sy(c[c.length - 1]) - 6, 11.5, C.muted, "center", 650);
    const xs = niceStep(xmax, 8), xt = []; for (let v = 0; v <= xmax + 1e-9; v += xs) xt.push(v);
    xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v));
    text(ctx, "minutes between trains", x1, axisY + 30, 12.5, C.muted, "right", 500);
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; line(ctx, sx(s.mu), top - 6, sx(s.mu), axisY); ctx.restore();
    halo(ctx, "average gap " + fmt(s.mu) + " min", sx(s.mu) + 6, top + 4, 13, C.ink, "left", 700);
    $("ro-trains").innerHTML =
      '<div class="ro trains"><div class="v">' + fmt(s.mu, 2) + '</div><div class="k">average (mean) gap, minutes</div></div>' +
      '<div class="ro"><div class="v">' + fmt(s.sd, 2) + '</div><div class="k">standard deviation, minutes</div></div>' +
      '<div class="ro"><div class="v">' + fmt(s.cv, 2) + '</div><div class="k">CV = standard deviation ÷ average</div></div>';
    let long = 0; for (const x of h) if (x > s.mu) long++;
    $("n-trains").innerHTML = "These are " + s.n + " gaps from " + daysWord(ST.win) + " " + WINPHRASE[ST.win] + ". <b>" + Math.round(100 * long / s.n) + "% of the gaps are longer than the average</b>; the longest was " + Math.round(s.max) + " minutes.";
  }

  // =====================================================================
  // ASK THE RIDERS: riders arrive at random and stack above the train that takes them
  // =====================================================================
  const RID = { key: "", rows: [], total: 0, n: 0, running: false, fly: [], rng: mulberry(11), rate: 0, last: 0, raf: 0, mode: "moment", gaps: 0 };
  function ridersSetup(force) {
    const key = ST.line + ST.dir + ST.stop + ST.win; if (!force && key === RID.key) return; RID.key = key;
    RID.rows = []; RID.total = 0; RID.gaps = 0; RID.n = 0; RID.fly = []; RID.rng = mulberry(11); RID.rate = 0;
    DAYINFO.forEach((di, k) => {
      if (!di.weekday) return;
      const t = dayArrivals(ST.line, ST.dir, k, ST.win); if (t.length < 2) return;
      const len = t[t.length - 1] - t[0];
      RID.rows.push({ di, t, len, off: RID.total, goff: RID.gaps, cnt: new Float64Array(t.length - 1) });
      RID.total += len; RID.gaps += t.length - 1;
    });
  }
  function riderLand(row, x) {
    const t = row.t; let lo = 0, hi = t.length - 1;            // gap g holds x: t[g] <= x < t[g+1]
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= x) lo = m; else hi = m; }
    return lo;
  }
  function addRiders(k, animate) {
    for (let j = 0; j < k; j++) {
      let row = RID.rows[0], x, g;
      if (RID.mode === "train") {
        // a rider who picks a train: every train equally likely, arriving in the minute before it
        const u = Math.floor(RID.rng() * RID.gaps);
        for (const r of RID.rows) { if (u >= r.goff && u < r.goff + r.cnt.length) { row = r; break; } }
        g = u - row.goff; const t1 = row.t[g + 1], gap = t1 - row.t[g]; x = t1 - RID.rng() * Math.min(60, gap);
      } else {
        // a dart: every moment equally likely
        const u = RID.rng() * RID.total;
        for (const r of RID.rows) { if (u >= r.off && u < r.off + r.len) { row = r; break; } }
        x = row.t[0] + (u - row.off); g = riderLand(row, x);
      }
      if (animate && RID.fly.length < 240) RID.fly.push({ row, x, g, age: 0 });
      else { row.cnt[g]++; RID.n++; }
    }
  }
  function wallGeo(W) {
    const narrow = W < 640, labW = narrow ? 40 : 62, rowH = narrow ? 36 : 46, top = 8;
    const Wn = WIN[ST.win], x0 = labW, x1 = W - 6;
    return { narrow, labW, rowH, top, x0, x1, sx: (t) => x0 + (t - Wn.a) / (Wn.b - Wn.a) * (x1 - x0) };
  }
  function drawWall() {
    const cv = $("cv-wall"), Wd = cv.clientWidth || 800, g0 = wallGeo(Wd), H = g0.top + RID.rows.length * g0.rowH + 26;
    const { ctx, W } = fit(cv, H), g = wallGeo(W);
    if (!RID.rows.length) { text(ctx, "No trains in this window.", 0, 30, 14, C.muted); return; }
    let mx = 1; RID.rows.forEach((r) => { for (const c of r.cnt) if (c > mx) mx = c; });
    const colMax = g.rowH - 13, unit = colMax / mx, pat = pattern(ctx, "riders");
    RID.rows.forEach((r, i) => {
      const yb = g.top + (i + 1) * g.rowH - 6;
      text(ctx, g.narrow ? r.di.label.split(" ")[0] : r.di.label, 0, yb - 2, g.narrow ? 11 : 12.5, C["ink-2"], "left", 560);
      ctx.fillStyle = C.dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"; ctx.fillRect(g.x0, yb, g.x1 - g.x0, 1);
      // crowds: the riders each train picked up, stacked above it
      ctx.fillStyle = pat;
      for (let k = 0; k < r.cnt.length; k++) { const c = r.cnt[k]; if (!c) continue; const x = g.sx(r.t[k + 1]), hh = c * unit; ctx.fillRect(x - 2.5, yb - 2 - hh, 5, hh); }
      ctx.fillStyle = lineColor(ST.line);
      r.t.forEach((t) => { const x = g.sx(t); ctx.fillRect(x - 1.25, yb - 2, 2.5, 5); });
    });
    // riders in flight: fall onto the platform, then walk to the next train
    ctx.fillStyle = C.edge; ctx.strokeStyle = C.dark ? "#000" : "#5a4a00"; ctx.lineWidth = 0.8;
    RID.fly.forEach((f) => {
      const i = RID.rows.indexOf(f.row), yb = g.top + (i + 1) * g.rowH - 6, xa = g.sx(f.x), xb = g.sx(f.row.t[f.g + 1]);
      const fall = Math.min(1, f.age / 0.35), walk = clamp((f.age - 0.35) / 0.45, 0, 1);
      const x = lerp(xa, xb, ease(walk)), y = lerp(yb - g.rowH + 8, yb - 4, fall * fall);
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.283); ctx.fill(); ctx.stroke();
    });
    const Wn = WIN[ST.win], step = (Wn.b - Wn.a) > 4 * 3600 ? 3600 : 1800, yl = g.top + RID.rows.length * g.rowH + 14;
    for (let t = Math.ceil(Wn.a / step) * step; t <= Wn.b; t += step) tlab(ctx, hhmm(t).replace(":00", ""), g.sx(t), yl, 11.5, C.muted, 500, g.x0 - 30, W);
    $("r-count").textContent = fmtN(RID.n) + " riders so far";
  }
  function ridersTick(now) {
    const dt = Math.min(0.05, (now - (RID.last || now)) / 1000); RID.last = now;
    if (RID.running) {
      RID.rate = Math.min(2400, RID.rate * (1 + 1.4 * dt) + 30 * dt + (RID.rate < 6 ? 6 : 0));
      RID.acc = (RID.acc || 0) + RID.rate * dt;
      const k = Math.floor(RID.acc); RID.acc -= k;
      if (k) addRiders(k, true);
    }
    RID.fly.forEach((f) => { f.age += dt; });
    const done = RID.fly.filter((f) => f.age >= 0.8); done.forEach((f) => { f.row.cnt[f.g]++; RID.n++; });
    RID.fly = RID.fly.filter((f) => f.age < 0.8);
    drawWall();
    if (RID.n % 7 === 0 || !RID.running) drawPair(); else if (now - (RID.pairT || 0) > 120) { RID.pairT = now; drawPair(); }
    if ((RID.running || RID.fly.length) && VISIBLE.has("riders")) RID.raf = requestAnimationFrame(ridersTick);
    else { RID.raf = 0; drawPair(); }
  }
  function ridersKick() { if (!RID.raf) { RID.last = 0; RID.raf = requestAnimationFrame(ridersTick); } }
  $("r-go").addEventListener("click", () => { RID.running = !RID.running; if (RID.running && RM) { addRiders(3000, false); RID.running = false; } $("r-go").textContent = RID.running ? "Pause" : "Let riders in"; drawWall(); drawPair(); ridersKick(); });
  $("r-more").addEventListener("click", () => { addRiders(5000, false); drawWall(); drawPair(); drawCrowd(); });
  function ridersMode(m) {
    RID.mode = m; $("r-moment").setAttribute("aria-pressed", m === "moment"); $("r-train").setAttribute("aria-pressed", m === "train");
    ridersSetup(true); RID.running = false; $("r-go").textContent = "Let riders in"; drawWall(); drawPair();
  }
  $("r-moment").addEventListener("click", () => ridersMode("moment"));
  $("r-train").addEventListener("click", () => ridersMode("train"));
  $("r-reset").addEventListener("click", () => { ridersSetup(true); RID.running = false; $("r-go").textContent = "Let riders in"; drawWall(); drawPair(); drawCrowd(); });
  function drawPair() {
    const cv = $("cv-hpair"), Wd = cv.clientWidth || 800, two = Wd >= 640, H = two ? 270 : 488, { ctx, W } = fit(cv, H);
    const allGaps = []; RID.rows.forEach((r) => { for (let k = 0; k + 1 < r.t.length; k++) allGaps.push((r.t[k + 1] - r.t[k]) / 60); });
    const h = Float64Array.from(allGaps), s = stats(h); if (!s) return;
    const bw = binWidth(s), xmax = Math.ceil((quant(h, 0.995) + bw) / bw) * bw, nb = Math.ceil(xmax / bw);
    const byTrain = RID.mode === "train", cT = histBins(h, bw, xmax), cE = byTrain ? cT : histBins(h, bw, xmax, true), cR = new Float64Array(nb);
    let rn = 0, rs = 0;
    RID.rows.forEach((r) => { for (let k = 0; k < r.cnt.length; k++) { const c = r.cnt[k]; if (!c) continue; const x = (r.t[k + 1] - r.t[k]) / 60; cR[Math.min(nb - 1, Math.floor(x / bw))] += c; rn += c; rs += c * x; } });
    if (rn) for (let k = 0; k < nb; k++) cR[k] /= rn;
    const ymax = Math.max(Math.max(...cT), Math.max(...cE), rn ? Math.max(...cR) : 0) * 1.15;
    const panels = two ? [[0, W / 2 - 10], [W / 2 + 10, W]] : [[0, W], [0, W]];
    const tops = two ? [0, 0] : [0, 236], extra = two ? [0, 0] : [0, 18];
    const titles = ["Ask the trains: one vote per gap", "Ask the riders: one vote per rider"];
    panels.forEach(([a, b], p) => {
      const x0 = a + 42, x1 = b - 8, top = tops[p] + 34 + extra[p], axisY = tops[p] + (two ? H : 236 + extra[p]) - 34;
      const sx = (v) => x0 + v / xmax * (x1 - x0), sy = (v) => axisY - v / ymax * (axisY - top);
      text(ctx, titles[p], a, tops[p] + 15, 14, C.ink, "left", 680);
      const yst = niceStep(ymax * 100, 4) / 100, yt = []; for (let v = 0; v <= ymax + 1e-9; v += yst) yt.push(v);
      yGrid(ctx, x0, x1, yt, sy, (v) => Math.round(v * 100) + "%");
      const c = p === 0 ? cT : cR;
      ctx.fillStyle = p === 0 ? C.steel : pattern(ctx, "riders");
      c.forEach((v, k) => { if (!v) return; const l = sx(k * bw), r = sx((k + 1) * bw); ctx.fillRect(l + 0.5, sy(v), Math.max(1, r - l - 1.5), axisY - sy(v)); });
      if (p === 1) {
        // what the riders' answers settle to: each gap weighted by its length
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]); ctx.beginPath();
        cE.forEach((v, k) => { const l = sx(k * bw), r = sx((k + 1) * bw), y = sy(v); if (k) ctx.lineTo(l, y); else ctx.moveTo(l, y); ctx.lineTo(r, y); });
        ctx.stroke(); ctx.setLineDash([]);
      }
      const cl = p === 0 ? cT : rn ? cR : null;
      if (cl && s.max >= xmax && cl[nb - 1] > 0) halo(ctx, (xmax - bw) + "+", sx(xmax - bw / 2), sy(cl[nb - 1]) - 6, 11, C.muted, "center", 650);
      const xs = niceStep(xmax, two ? 6 : 8), xt = []; for (let v = 0; v <= xmax + 1e-9; v += xs) xt.push(v);
      xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v));
      text(ctx, "gap, minutes", x1, axisY + 30, 12, C.muted, "right", 500);
      const mv = p === 0 ? s.mu : rn ? rs / rn : NaN;
      if (Number.isFinite(mv)) {
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; line(ctx, sx(mv), top - 4, sx(mv), axisY);
        halo(ctx, "average " + fmt(mv, 2), sx(mv) + 5, top + 6, 13, C.ink, "left", 720);
      }
      if (p === 1 && !rn) text(ctx, "Let riders in to fill this.", (x0 + x1) / 2, (top + axisY) / 2, 14, C.muted, "center", 500);
      if (p === 1) { if (two) text(ctx, "dashed: where the riders' answers settle", x1, top - 2, 11.5, C.muted, "right", 500); else text(ctx, "dashed: where the riders' answers settle", a, tops[p] + 33, 11.5, C.muted, "left", 500); }
    });
    $("ro-riders").innerHTML =
      '<div class="ro trains"><div class="v">' + fmt(s.mu, 2) + '</div><div class="k">average gap, asking the trains</div></div>' +
      '<div class="ro riders"><div class="v">' + (rn ? fmt(rs / rn, 2) : "–") + '</div><div class="k">average gap, asking ' + fmtN(Math.round(rn)) + ' riders</div></div>' +
      (byTrain ? '<div class="ro"><div class="v">' + fmt(s.mu, 2) + '</div><div class="k">where it settles: ' + M`E[H] = \mu` + ", the trains' answer</div></div>"
        : '<div class="ro"><div class="v">' + fmt(s.EL, 2) + '</div><div class="k">where it settles: ' + M`E[H^2]/E[H] = \mu(1 + \mathrm{CV}^2)` + '</div></div>');
    let wl = 0, gl = 0; for (const x of h) if (x > s.mu) { wl += x; gl++; }
    $("n-riders").innerHTML = byTrain ? "Riders who pick a train instead of a moment are spread evenly over the trains, so every gap is reported equally often: the riders' histogram settles onto the trains', and their answers average " + fmt(s.mu, 2) + ". No paradox. It needs darts: moments chosen without regard to the trains."
      : "A gap twice as long catches, on average, twice as many riders. So if " + M`f` + " describes the gaps, the riders' answers follow " + M`h\,f(h)/\mu` + ": the <b>size-biased</b> version of " + M`f` + ". Here <b>" + Math.round(100 * wl / s.sum) + "% of riders</b> wait in a gap longer than the average gap, though only " + Math.round(100 * gl / s.n) + "% of gaps are that long.";
  }

  // =====================================================================
  // THE CROWDED CAR: the train that ends a long gap carries the crowd
  // =====================================================================
  const LAMBDA = 10;
  function drawCrowd() {
    const SD = showDay(), cv = $("cv-crowd"), Wd = cv.clientWidth || 800, arr = dayArrivals(ST.line, ST.dir, SD, ST.win);
    const narrow = Wd < 640, H = narrow ? 268 : 226, { ctx, W } = fit(cv, H), s = S();
    caption(cv, "Every train on " + dayLong(SD) + " and the riders it picked up here, if " + LAMBDA + " riders arrive per minute");
    if (arr.length < 2 || !s) { text(ctx, "No trains in this window.", 0, 30, 14, C.muted); return; }
    const gaps = []; for (let i = 0; i + 1 < arr.length; i++) gaps.push((arr[i + 1] - arr[i]) / 60);
    // the same day's trains give both averages, so every number here can be checked against the picture
    let sg = 0, sg2 = 0; gaps.forEach((g) => { sg += g; sg2 += g * g; });
    const dm = sg / gaps.length, dEL = sg2 / sg;
    const gmax = Math.max(...gaps, dEL) * 1.05, pat = pattern(ctx, "riders");
    const n = gaps.length, gap = narrow ? 2 : 4, cw = Math.min(46, (W - 8) / n - gap), ch = narrow ? 64 : 84, y0 = cw >= 17 ? 20 : 4;
    if (cw >= 17) gaps.forEach((g, i) => text(ctx, String(Math.round(LAMBDA * g)), 4 + i * (cw + gap) + cw / 2, y0 - 6, cw >= 24 ? 11 : 9.5, C["ink-2"], "center", 600));
    const car = (x, y, w, h, frac, color) => {
      const rr = Math.min(4, w / 4);
      ctx.fillStyle = C.dark ? "#22262b" : "#fff"; ctx.strokeStyle = C.ink; ctx.lineWidth = w < 10 ? 0.8 : 1.2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, rr) : ctx.rect(x, y, w, h); ctx.fill();
      const fh = (h - 4) * clamp(frac, 0, 1), inset = w < 10 ? 1 : 2; ctx.fillStyle = pat; ctx.fillRect(x + inset, y + h - 2 - fh, w - 2 * inset, fh);
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, rr) : ctx.rect(x, y, w, h); ctx.stroke();
      ctx.fillStyle = color; ctx.fillRect(x, y + h + 2, w, 3);
    };
    gaps.forEach((g, i) => car(4 + i * (cw + gap), y0, cw, ch, g / gmax, lineColor(ST.line)));
    // the two averages, as two big cars: side by side on a wide screen, stacked on a phone
    const by = y0 + ch + 26, bw2 = narrow ? Math.min(150, W * 0.36) : 120, bh = narrow ? 64 : 74;
    const sets = [[dm, "the average train", "carries " + fmt(LAMBDA * dm)], [dEL, "the average rider's train", "carries " + fmt(LAMBDA * dEL)]];
    sets.forEach(([v, lab, sub], k) => {
      const x = narrow ? 4 : 4 + k * (bw2 + 150), y = narrow ? by + k * (bh + 18) : by;
      car(x, y, bw2, bh, v / gmax, lineColor(ST.line));
      text(ctx, lab, x + bw2 + 12, y + 24, 14, C.ink, "left", 680);
      text(ctx, sub, x + bw2 + 12, y + 44, 13.5, C["ink-2"], "left", 500);
    });
    $("ro-crowd").innerHTML =
      '<div class="ro trains"><div class="v">' + fmt(LAMBDA * dm) + '</div><div class="k">riders on the average train</div></div>' +
      '<div class="ro riders"><div class="v">' + fmt(LAMBDA * dEL) + '</div><div class="k">on the train the average rider boards</div></div>' +
      '<div class="ro"><div class="v">×' + fmt(dEL / dm, 2) + '</div><div class="k">' + M`1 + \mathrm{CV}^2` + ' for that day</div></div>';
    const big = Math.round(LAMBDA * Math.max(...gaps));
    $("n-crowd").innerHTML = "Same size bias, new costume. Ask the trains and every load counts once. Ask the riders and the day's biggest load, " + big + ", is reported " + big + " times. Only riders boarding at this platform are counted.";
  }
