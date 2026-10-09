  // =====================================================================
  // EVERY LINE: average gap against unevenness, with curves of equal wait
  // =====================================================================
  const LN = { sched: false, hover: null, pts: [], rows: [] };
  const DIRSHORT = (r, d) => { const l = META.dirlab[r][d]; return l === "uptown" ? "up" : l === "downtown" ? "down" : l === "shuttle" ? "" : l.replace("toward ", "to "); };
  function lineSet() {
    const out = [];
    LINES.forEach((r) => ["N", "S"].forEach((d) => {
      if (!HOME.SER[r][d] || (r === "GS" && d === "S")) return;
      const s = stats(pooled(r, d, ST.win, true)); if (!s || s.n < 12) return;
      out.push({ r, d, s, ss: stats(schedGaps(r, d, ST.win, true)) });
    }));
    return out;
  }
  function drawLines() {
    const cv = $("cv-lines"), Wd = cv.clientWidth || 800, narrow = Wd < 640, { ctx, W, H } = fit(cv, narrow ? 400 : 480), set = lineSet();
    if (!set.length) return;
    const x0 = 50, x1 = W - 14, top = 18, axisY = H - 48;
    let xmax = 0, ymax = 0.9; set.forEach((p) => { xmax = Math.max(xmax, p.s.mu, LN.sched && p.ss ? p.ss.mu : 0); ymax = Math.max(ymax, p.s.cv); });
    xmax = Math.ceil(xmax * 1.12); ymax = Math.ceil(ymax * 11) / 10;
    const sx = (v) => x0 + v / xmax * (x1 - x0), sy = (v) => axisY - v / ymax * (axisY - top);
    const yt = []; for (let v = 0; v <= ymax + 1e-9; v += 0.2) yt.push(Math.round(v * 10) / 10);
    yGrid(ctx, x0, x1, yt, sy, (v) => v.toFixed(1));
    const xst = niceStep(xmax, narrow ? 5 : 9), xt = []; for (let v = 0; v <= xmax + 1e-9; v += xst) xt.push(v);
    xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v));
    text(ctx, "average gap between trains, minutes", x1, axisY + 32, 12.5, C.muted, "right", 500);
    ctx.save(); ctx.translate(13, (top + axisY) / 2); ctx.rotate(-Math.PI / 2); text(ctx, "unevenness of the gaps (CV)", 0, 0, 12.5, C.muted, "center", 500); ctx.restore();
    // curves of equal average wait: (mu/2)(1 + CV^2) = E
    const levels = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20].filter((E) => 2 * E / (1 + ymax * ymax) < xmax);
    let lastLab = -1e9;
    levels.forEach((E) => {
      ctx.beginPath(); let started = false;
      for (let i = 0; i <= 120; i++) { const c = ymax * i / 120, mu = 2 * E / (1 + c * c); if (mu > xmax) continue; const x = sx(mu), y = sy(c); if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; } }
      ctx.strokeStyle = rgba(C.rgb.led, C.dark ? 0.5 : 0.55); ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      const lab = (lastLab < 0 || !narrow ? "wait " : "") + E + " min", lw = tw(ctx, lab, 11.5, 650);
      if (2 * E <= xmax && sx(2 * E) + 3 > lastLab + 6 && sx(2 * E) + 3 + lw < x1) { halo(ctx, lab, sx(2 * E) + 3, axisY - 5, 11.5, C["led-deep"], "left", 650); lastLab = sx(2 * E) + 3 + lw; }
    });
    LN.pts = [];
    const rad = narrow ? 9.5 : 12.5;
    if (LN.sched) set.forEach((p) => {
      if (!p.ss) return; const xa = sx(p.ss.mu), ya = sy(p.ss.cv), xb = sx(p.s.mu), yb = sy(p.s.cv);
      ctx.strokeStyle = rgba(C.rgb.ink, 0.35); ctx.lineWidth = 1.2; line(ctx, xa, ya, xb, yb);
      ctx.strokeStyle = lineColor(p.r); ctx.lineWidth = 2; ctx.fillStyle = C.panel; ctx.beginPath(); ctx.arc(xa, ya, rad * 0.55, 0, 6.283); ctx.fill(); ctx.stroke();
    });
    const sel = set.filter((p) => p.r === ST.line && p.d === ST.dir), rest = set.filter((p) => !(p.r === ST.line && p.d === ST.dir));
    rest.concat(sel).forEach((p) => {
      const x = sx(p.s.mu), y = sy(p.s.cv), isSel = p.r === ST.line && p.d === ST.dir;
      if (isSel) { ctx.strokeStyle = C.edge; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, rad + 4, 0, 6.283); ctx.stroke(); }
      bulletDraw(ctx, p.r, x, y, rad, isSel || LN.hover === p ? 1 : 0.9);
      ctx.fillStyle = C.ink; ctx.beginPath();
      if (p.d === "N") { ctx.moveTo(x + rad * 0.75, y - rad - 1); ctx.lineTo(x + rad * 0.75 + 4, y - rad + 5); ctx.lineTo(x + rad * 0.75 - 4, y - rad + 5); }
      else { ctx.moveTo(x + rad * 0.75, y + rad + 1); ctx.lineTo(x + rad * 0.75 + 4, y + rad - 5); ctx.lineTo(x + rad * 0.75 - 4, y + rad - 5); }
      ctx.closePath(); ctx.fill();
      LN.pts.push({ p, x, y, rad });
    });
    if (ST.stop !== META.home[ST.line]) {
      const me = S(), hp = sel[0];
      if (me) { const x = sx(Math.min(me.mu, xmax)), y = sy(Math.min(me.cv, ymax));
        if (hp) { ctx.strokeStyle = rgba(C.rgb.ink, 0.5); ctx.setLineDash([3, 3]); ctx.lineWidth = 1.3; line(ctx, sx(hp.s.mu), sy(hp.s.cv), x, y); ctx.setLineDash([]); }
        ctx.fillStyle = C.edge; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rad * 0.62, 0, 6.283); ctx.fill(); ctx.stroke();
        halo(ctx, "your station: " + stationName(ST.line), x + (x > W * 0.6 ? -rad : rad), y - rad - 2, 12.5, C.ink, x > W * 0.6 ? "right" : "left", 740); }
    }
    if (LN.hover) {
      const p = LN.hover, x = sx(p.s.mu), y = sy(p.s.cv);
      const lines = [trainsPhrase(p.r, p.d), "gap " + fmt(p.s.mu) + " min, CV " + fmt(p.s.cv, 2), "average wait " + fmt(p.s.EW) + " (half the gap: " + fmt(p.s.half) + ")"];
      if (LN.sched && p.ss) lines.push("timetable: gap " + fmt(p.ss.mu) + ", CV " + fmt(p.ss.cv, 2) + ", wait " + fmt(p.ss.EW));
      ctx.font = FNT(13, 560); const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18, h = lines.length * 18 + 12;
      const bx = clamp(x + 18, 4, W - w - 4), by = clamp(y - h - 10, 4, H - h - 4);
      ctx.fillStyle = C.enamel; ctx.fillRect(bx, by, w, h);
      lines.forEach((l, i) => text(ctx, l, bx + 9, by + 20 + i * 18, 13, i ? "#d5d9dc" : "#fff", "left", i ? 500 : 700));
    }
  }
  function drawRank() {
    const cv = $("cv-rank"), Wd = cv.clientWidth || 800, two = Wd >= 760, all = lineSet().sort((a, b) => (b.s.EW - b.s.half) - (a.s.EW - a.s.half));
    caption(cv, "Extra wait from uneven gaps: average wait minus half the average gap" + (LN.sched ? " (thin grey bars: what the timetable alone would cause)" : ""));
    // on a phone: the twelve worst, your line, and the three best
    let set = all;
    if (!two && all.length > 18) { const keep = new Set(all.slice(0, 12).concat(all.slice(-3))); all.forEach((p) => { if (p.r === ST.line && p.d === ST.dir) keep.add(p); }); set = all.filter((p) => keep.has(p)); }
    // row positions: two balanced columns on a wide screen; one column with a gap row wherever lines were skipped
    const rowH = 21, per = two ? Math.ceil(set.length / 2) : set.length, slots = []; let row = 0;
    set.forEach((p, i) => {
      if (two) { slots.push({ col: Math.floor(i / per), j: i % per, gapAbove: false }); return; }
      const jump = i > 0 && all.indexOf(p) - all.indexOf(set[i - 1]) > 1; if (jump) row++;
      slots.push({ col: 0, j: row++, gapAbove: jump });
    });
    const nRows = two ? per : row, H = 4 + nRows * rowH + 8, { ctx, W } = fit(cv, H);
    const colW = two ? (W - 24) / 2 : W, mx = Math.max(...set.map((p) => p.s.EW - p.s.half), 0.5), pat = pattern(ctx, "wait");
    LN.rows = [];
    const labW = Math.max(...set.map((p) => tw(ctx, DIRSHORT(p.r, p.d), 12, 520))) + 34;
    set.forEach((p, i) => {
      const sl = slots[i], x = sl.col * (colW + 24), y = 4 + sl.j * rowH;
      if (sl.gapAbove) text(ctx, "⋯", x + 10, y - rowH / 2 + 4, 15, C.muted, "center", 700);
      const isSel = p.r === ST.line && p.d === ST.dir;
      if (isSel) { ctx.fillStyle = rgba(C.rgb.edge, 0.28); ctx.fillRect(x, y - 2, colW, rowH - 1); }
      bulletDraw(ctx, p.r, x + 10, y + rowH / 2 - 1, 8.5);
      text(ctx, DIRSHORT(p.r, p.d), x + 24, y + rowH / 2 + 3.5, 12, C["ink-2"], "left", 520);
      const bx = x + labW, bw = colW - labW - 66, tax = p.s.EW - p.s.half, L = Math.max(1, bw * tax / mx);
      ctx.fillStyle = pat; ctx.fillRect(bx, y + 3, L, rowH - 9); ctx.strokeStyle = C.led; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, y + 3.5, L - 1, rowH - 10);
      if (LN.sched && p.ss) { const ts = Math.max(0, p.ss.EW - p.ss.half); ctx.fillStyle = C.steel; ctx.fillRect(bx, y + rowH - 6, Math.max(1, bw * ts / mx), 3); }
      text(ctx, "+" + fmt(tax, 2) + " min", bx + L + 6, y + rowH / 2 + 3.5, 12, C.ink, "left", 650);
      LN.rows.push({ p, x, y, w: colW, h: rowH });
    });
    const W0 = WIN[ST.win], worst = all[0], best = all[all.length - 1];
    const lc = (x) => x.replace(/^(Uptown|Downtown)/, (w) => w.toLowerCase());
    const bestX = best.s.EW - best.s.half;
    $("n-lines").innerHTML = W0.lab + ", " + W0.sub + ". The biggest penalty: <b>" + lc(trainsPhrase(worst.r, worst.d)) + ", +" + fmt(worst.s.EW - worst.s.half, 2) + " min</b>, an average wait of " + fmt(worst.s.EW, 2) + " minutes where evenly spaced trains with the same average gap would give " + fmt(worst.s.half, 2) + ". The smallest: " + trainsPhrase(best.r, best.d).replace(/ trains$/, "") + ", +" + fmt(bestX, 2) + " min" + (bestX < 0.1 ? ", small enough to be timing error" : "") + "." + (LN.sched ? (() => { const me = set.find((p) => p.r === ST.line && p.d === ST.dir); return " Hollow circles: the published weekday timetable at the same platform." + (me && me.ss ? " For " + lc(trainsPhrase(me.r, me.d)) + ", the timetable's gaps have a CV of " + fmt(me.ss.cv, 2) + "; the trains that ran, " + fmt(me.s.cv, 2) + "." : ""); })() : " The MTA reports a related measure, additional platform time, which compares waits with the timetable rather than with even spacing.");
  }
  onDrag($("cv-lines"), {
    down: (p) => { const hit = LN.pts.slice().reverse().find((q) => Math.hypot(q.x - p.x, q.y - p.y) <= q.rad + 3); if (!hit) return false; setState({ line: hit.p.r, dir: hit.p.d }); },
    move: () => {},
    hover: (p) => { const hit = LN.pts.slice().reverse().find((q) => Math.hypot(q.x - p.x, q.y - p.y) <= q.rad + 3); const h = hit ? hit.p : null; if (h !== LN.hover) { LN.hover = h; $("cv-lines").style.cursor = h ? "pointer" : "default"; drawLines(); } },
    leave: () => { if (LN.hover) { LN.hover = null; drawLines(); } }
  });
  $("cv-rank").addEventListener("click", (e) => { const r = $("cv-rank").getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; const hit = LN.rows.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y - 2 && y <= q.y + q.h); if (hit) setState({ line: hit.p.r, dir: hit.p.d }); });
  $("ln-sched").addEventListener("click", () => { LN.sched = !LN.sched; $("ln-sched").setAttribute("aria-pressed", LN.sched); drawLines(); drawRank(); });

  // =====================================================================
  // WHY TRAINS BUNCH: a simulated loop line with a dwell-time feedback
  // =====================================================================
  const BS = { N: 6, S: 12, travel: 90, d0: 20, lam: 3 / 60, b: 1.2, hold: false, running: true, raf: 0, last: 0 };
  function bunchReset() {
    BS.t = 0; BS.rng = mulberry(5); BS.gaps = []; BS.trace = [];
    BS.w = new Float64Array(BS.S); BS.lastArr = new Float64Array(BS.S).fill(NaN); BS.lastDep = new Float64Array(BS.S).fill(NaN);
    const h0 = (BS.S * (BS.travel + BS.d0)) / (BS.N - BS.S * BS.b * BS.lam);
    for (let s = 0; s < BS.S; s++) BS.w[s] = BS.lam * h0 * 0.5;
    BS.trains = Array.from({ length: BS.N }, (_, i) => ({ pos: (BS.S - i * BS.S / BS.N) % BS.S, st: "move", left: 0, speed: 1 + (BS.rng() - 0.5) * 0.04 }));
  }
  // holding aims for the gap an evenly spaced line settles at, plus 6% slack so that a late train can make up time
  function bunchTarget() { return 1.06 * (BS.S * (BS.travel + BS.d0)) / Math.max(0.5, BS.N - BS.S * BS.b * BS.lam); }
  function bunchStep(dt) {
    BS.t += dt;
    for (let s = 0; s < BS.S; s++) BS.w[s] += BS.lam * dt;
    const order = BS.trains.map((tr, i) => i).sort((a, b) => BS.trains[a].pos - BS.trains[b].pos);
    BS.trains.forEach((tr, i) => {
      const s = Math.round(tr.pos) % BS.S;
      if (tr.st === "dwell") {
        tr.left -= dt; tr.left += BS.b * BS.w[s]; BS.w[s] = 0;
        if (tr.left <= 0) {
          const since = BS.t - BS.lastDep[s];
          if (BS.hold && Number.isFinite(since) && since < bunchTarget()) return;   // hold the train until the gap ahead is long enough
          BS.lastDep[s] = BS.t; tr.st = "move"; tr.speed = 1 + (BS.rng() - 0.5) * 0.06;
        }
        return;
      }
      // the train ahead blocks the track
      const k = order.indexOf(i), ahead = BS.trains[order[(k + 1) % BS.N]];
      let gapAhead = (ahead.pos - tr.pos + BS.S) % BS.S; if (gapAhead === 0) gapAhead = BS.S;
      const step = dt / BS.travel * tr.speed, room = Math.max(0, gapAhead - 0.22);
      const next = Math.floor(tr.pos + 1e-9) + 1, toStation = next - tr.pos;
      const mv = Math.min(step, room);
      if (mv >= toStation - 1e-9) {
        tr.pos = next % BS.S; const st = tr.pos;
        if (Number.isFinite(BS.lastArr[st])) { BS.gaps.push(BS.t - BS.lastArr[st]); if (BS.gaps.length > BS.S * BS.N * 3) BS.gaps.shift(); }
        BS.lastArr[st] = BS.t; tr.st = "dwell"; tr.left = BS.d0 + BS.b * BS.w[st]; BS.w[st] = 0;
      } else tr.pos = (tr.pos + mv) % BS.S;
    });
  }
  function bunchStats() {
    const g = BS.gaps.slice(-BS.S * BS.N); if (g.length < 12) return null;   // the last lap's worth of gaps
    let s = 0, s2 = 0; for (const x of g) { s += x; s2 += x * x; } const n = g.length, mu = s / n;
    return { mu: mu / 60, cv: Math.sqrt(Math.max(0, s2 / n - mu * mu)) / mu, EW: s2 / (2 * s) / 60 };
  }
  function drawRing() {
    const cv = $("cv-ring"), Wd = cv.clientWidth || 400, H = Math.min(380, Math.max(300, Wd * 0.9)), { ctx, W } = fit(cv, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 46;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
    const ang = (p) => -Math.PI / 2 + p / BS.S * 2 * Math.PI, pat = pattern(ctx, "riders");
    for (let s = 0; s < BS.S; s++) {
      const a = ang(s), x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      ctx.fillStyle = C.panel; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.fill(); ctx.stroke();
      const n = Math.min(BS.w[s], 40), L = n * 1.1;   // waiting riders, as a bar pointing outward
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = pat; ctx.fillRect(10, -3.5, L, 7); ctx.restore();
    }
    BS.trains.forEach((tr) => {
      const a = ang(tr.pos), x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.fillStyle = lineColor(ST.line); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-11, -5, 22, 10, 3) : ctx.rect(-11, -5, 22, 10); ctx.fill(); ctx.stroke(); ctx.restore();
    });
    text(ctx, Math.floor(BS.t / 3600) + "h " + String(Math.floor((BS.t % 3600) / 60)).padStart(2, "0") + "m of simulated time", cx, cy + 5, 13, C.muted, "center", 560);
  }
  function drawBunchChart() {
    const cv = $("cv-bunch"), { ctx, W, H } = fit(cv, 176), tr = BS.trace;
    caption(cv, "Unevenness of the gaps (CV), last two simulated hours");
    const x0 = 40, x1 = W - 8, top = 10, axisY = H - 26, span = 120 * 60, tB = Math.max(BS.t, span), tA = tB - span;
    const sx = (t) => x0 + (t - tA) / span * (x1 - x0), sy = (v) => axisY - Math.min(v, 2) / 2 * (axisY - top);
    yGrid(ctx, x0, x1, [0, 0.5, 1, 1.5, 2], sy, (v) => v.toFixed(1));
    text(ctx, BS.t > span ? "2 h ago" : "start", x0, axisY + 17, 11.5, C.muted, "left", 500); text(ctx, "now", x1, axisY + 17, 11.5, C.muted, "right", 500);
    ctx.beginPath(); let on = false; tr.forEach(([t, v]) => { if (t < tA) return; if (on) ctx.lineTo(sx(t), sy(v)); else { ctx.moveTo(sx(t), sy(v)); on = true; } });
    ctx.strokeStyle = C.steel; ctx.lineWidth = 2.4; ctx.stroke();
    const st = bunchStats();
    $("ro-bunch").innerHTML = st ? '<div class="ro"><div class="v">' + fmt(st.cv, 2) + '</div><div class="k">CV of recent gaps</div></div><div class="ro wait"><div class="v">' + fmt(st.EW, 1) + '</div><div class="k">average wait, min</div></div><div class="ro trains"><div class="v">' + fmt(st.mu / 2, 1) + '</div><div class="k">half the average gap</div></div>' : "";
  }
  function bunchTick(now) {
    const dt = Math.min(0.05, (now - (BS.last || now)) / 1000); BS.last = now;
    if (BS.running) {
      const simdt = dt * 360; let left = simdt; while (left > 0) { const h = Math.min(0.5, left); bunchStep(h); left -= h; }
      if (!BS.trace.length || BS.t - BS.trace[BS.trace.length - 1][0] > 60) { const st = bunchStats(); if (st) BS.trace.push([BS.t, st.cv]); if (BS.trace.length > 600) BS.trace.shift(); }
    }
    drawRing(); drawBunchChart();
    if (BS.running && VISIBLE.has("bunch")) BS.raf = requestAnimationFrame(bunchTick); else BS.raf = 0;
  }
  function bunchKick() { if (!BS.raf) { BS.last = 0; BS.raf = requestAnimationFrame(bunchTick); } }
  $("b-board").addEventListener("input", (e) => { BS.b = +e.target.value; $("b-board-v").textContent = BS.b.toFixed(2) + " s"; bunchNote(); });
  $("b-run").addEventListener("click", () => { BS.running = !BS.running; $("b-run").textContent = BS.running ? "Pause" : "Run"; bunchKick(); });
  $("b-kick").addEventListener("click", () => { const tr = BS.trains[0]; if (tr.st === "dwell") tr.left += 90; else { tr.st = "dwell"; tr.left = 90; } bunchKick(); });
  $("b-hold").addEventListener("click", () => { BS.hold = !BS.hold; $("b-hold").setAttribute("aria-pressed", BS.hold); bunchNote(); });
  $("b-reset").addEventListener("click", () => { bunchReset(); drawRing(); drawBunchChart(); bunchKick(); });
  function bunchNote() {
    $("n-bunch").innerHTML = BS.hold
      ? "Holding: no train leaves a platform until the train ahead left a full gap earlier. Trains run a little slower, a late train is never held, and the gaps even out, so the average wait falls."
      : BS.b === 0 ? "With no time spent boarding, nothing pushes the gaps apart; only small random speed differences remain." : BS.b < 0.4 ? "With quick boarding the feedback is weak, so the gaps drift apart slowly, but they still drift." : "Each boarding rider adds " + BS.b.toFixed(2) + " s to the stop. Small delays grow on their own until the trains run in bunches: same number of trains, longer waits.";
  }
  $("b-board-v").textContent = BS.b.toFixed(2) + " s"; bunchReset(); bunchNote();
  if (RM) { BS.running = false; $("b-run").textContent = "Run"; }   // with reduced motion the simulation waits for a tap

  // =====================================================================
  // END OF THE LINE
  // =====================================================================
  $("f-end").innerHTML = MD`E[W] = \frac{E[H^2]}{2\,E[H]} = \frac{\mu}{2}\bigl(1 + \mathrm{CV}^2\bigr)`;
  $("end-lines").innerHTML = "Ask the trains how long the gaps are and the average answer is " + M`\mu` + ". Ask the riders and it is " + M`\mu(1 + \mathrm{CV}^2)` + ", because long gaps hold more of them. Your average wait is half of that. The same bias shows up whenever you sample by being there: the class the average student sits in is bigger than the average class.";
  $("credits").innerHTML = "<b>Data.</b> Arrival times are from <a href='https://subwaydata.nyc' target='_blank' rel='noopener'>subwaydata.nyc</a>, which archives the MTA's realtime subway feeds and records when each train reached each stop. " + cap(NUMW[WEEKDAYS_N] || String(WEEKDAYS_N)) + " weekdays (" + DATESPAN + ") at every station each line serves (the page opens at one busy station per line, and comparisons between lines use those stations). A train's time at a stop is the feed's last estimate before the stop dropped off its schedule, accurate to roughly half a minute. Records where a train's planned stops vanished before it got there, without the train continuing down the line, are dropped. Gaps that overlap an outage in the feed, or that run past either end of the time window, are left out; long gaps are likelier to do either, so this trims a few long gaps. About " + Math.round(100 * (META.coverage ?? 0.06)) + "% of the trains in the timetable do not appear in the record: some were cancelled, and others ran but were missed by the tracking, so the measured gaps may run slightly long. The train graph shows one morning, " + dayLong(MAREY_IDX) + "." + (META.built ? " Data through " + dayLong(DAYS.length - 1) + ", " + dateOf(DAYS[DAYS.length - 1]).getFullYear() + "." : "") + " The timetable is the MTA's published weekday GTFS schedule in effect for these dates. <b>Model.</b> Riders are assumed to arrive like darts: at a steady rate, at moments that have nothing to do with the trains. For the trains that actually ran, the average wait of such riders is exactly " + M`\sum h^2 / (2 \sum h)` + ", and nothing about how the trains behave has to be assumed; the trains' steadiness (stationarity) matters only when ten days are used to predict an eleventh. A countdown clock lets a rider spend less of the wait on the platform, but a rider who becomes ready to leave at a random moment still catches the train that ends the gap they became ready in; only riders who pick a train in advance escape the bias. Standard deviations divide by <i>n</i>, so that the average gap times (1 + CV²) equals the riders' average exactly. The loop line in “Why trains bunch” is a simulation, not data.";

  // =====================================================================
  // wiring
  // =====================================================================
  register("strip", drawStrip); watch($("cv-strip"), "strip");
  register("hgaps", drawGapHist); watch($("cv-hgaps"), "hgaps");
  register("riders", () => { drawWall(); drawPair(); if (RID.running || RID.fly.length) ridersKick(); }); watch($("cv-wall"), "riders");
  register("pair", drawPair); watch($("cv-hpair"), "pair");
  register("crowd", drawCrowd); watch($("cv-crowd"), "crowd");
  register("saw", drawSaw); watch($("cv-saw"), "saw");
  register("three", drawThree); watch($("cv-three"), "three");
  register("chaos", drawChaos); watch($("cv-chaos"), "chaos");
  register("giveup", drawGiveup); watch($("cv-giveup"), "giveup");
  register("lines", () => { drawLines(); drawRank(); }); watch($("cv-lines"), "lines");
  register("cvrows", drawCV); watch($("cv-cvrows"), "cvrows");
  register("machine", mxDraw); watch($("cv-mx"), "machine");
  register("hole", drawHole); watch($("cv-hole"), "hole");
  register("trim", drawTrim); watch($("cv-trim"), "trim");
  register("cloud", drawCloud); watch($("cv-cloud"), "cloud");
  register("bunch", () => { drawRing(); drawBunchChart(); if (BS.running) bunchKick(); }); watch($("cv-ring"), "bunch");
  let lastLD = "";
  onState(() => {
    const ld = ST.line + ST.dir + ST.stop;
    heroSync();
    if (ld !== lastLD) { lastLD = ld; animateMarey(); } else drawMarey();
    ridersSetup(); sawSetup(); CHAOS.user = false; GU.t = 0;
    if (MX.fam === "line") { MX.level = 0; MX.shown = 0; MX.xmax = null; mxParams(); }
    ["strip", "hgaps", "riders", "pair", "crowd", "saw", "three", "chaos", "giveup", "lines", "cvrows", "machine", "hole", "trim", "cloud", "proof", "down"].forEach(redraw);
  });
  let rz = 0;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { drawMarey(); drawRuler(); redrawAll(); }, 120); });
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!document.documentElement.getAttribute("data-theme")) { readTheme(); drawMarey(); drawRuler(); redrawAll(); } });
  // open on the station in the address (a shared link), or the default
  { const q = readHash(), { stop, ...rest } = q; setState(rest); STATE_READY = true;
    if (stop && stop !== ST.stop) choose({ stop }); else writeHash(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawMarey(); drawRuler(); redrawAll(); });
})();
</script>
</body>
</html>
