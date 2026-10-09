  // =====================================================================
  // DOWN THE LINE: the average wait and half the average gap at every stop on the route
  // =====================================================================
  const DL = { hover: -1, pts: [], key: "", rows: null, pat: null };
  function downRows() {
    const L = decodeLine(ST.line); if (!L) return null;
    const key = ST.line + ST.dir + ST.stop + ST.win; if (DL.key === key && DL.rows) return DL.rows; DL.key = key;
    const row = L.rows[ST.dir][ST.stop];
    // the stop pattern through your station (a branch line uses the branch you are on)
    let p = row && row.pat >= 0 ? L.pats[ST.dir][row.pat] : null;
    if (!p || !p.pids.length) p = L.pats[ST.dir].find((q) => q.pids.includes(ST.stop)) || L.pats[ST.dir][0];
    DL.pat = p;
    if (!p) return (DL.rows = []);
    return (DL.rows = p.pids.map((pid, i) => {
      const per = L.ser[ST.dir][pid] || (pid === META.home[ST.line] ? HOME.SER[ST.line][ST.dir] : null), h = per ? poolSeries(per, ST.win) : null, s = h && h.length >= 30 ? stats(h) : null;
      return { pid, i, name: niceName(p.stops[i] || stopName(pid)), s };
    }));
  }
  function drawDown() {
    const cv = $("cv-down"), Wd = cv.clientWidth || 800, narrow = Wd < 600;
    if (!decodeLine(ST.line)) {
      const { ctx } = fit(cv, 120); caption(cv, "Loading every stop on the " + sym(ST.line) + " line…");
      loadLine(ST.line).then(() => redraw("down")).catch(() => { caption(cv, "The stops for this line could not be loaded."); $("n-down").textContent = ""; });
      return;
    }
    const rows = downRows(), ok = rows.filter((q) => q.s);
    const { ctx, W, H } = fit(cv, narrow ? 360 : 440);
    if (ok.length < 3) { caption(cv, "Too few trains at the stops on this route in this time window."); $("n-down").textContent = ""; return; }
    const first = rows[0].name, last = rows[rows.length - 1].name;
    caption(cv, trainsPhrase(ST.line, ST.dir) + ", " + WINPHRASE[ST.win] + ", every stop from " + first + " to " + last + ". " + (narrow ? "Tap" : "Click") + " a stop to make it your station.");
    const x0 = 46, x1 = W - 14, top = 26, axisY = H - (narrow ? 64 : 112), n = rows.length, sx = (i) => x0 + (n > 1 ? i / (n - 1) : 0.5) * (x1 - x0);
    const ymax = Math.max(...ok.map((q) => Math.max(q.s.EW, q.s.half))) * 1.15, sy = (v) => axisY - v / ymax * (axisY - top);
    const yst = niceStep(ymax, 4), yt = []; for (let v = 0; v <= ymax + 1e-9; v += yst) yt.push(v);
    yGrid(ctx, x0, x1, yt, sy, (v) => v + " min");
    // your station
    const me = rows.find((q) => q.pid === ST.stop);
    if (me) { ctx.fillStyle = rgba(C.rgb.edge, C.dark ? 0.22 : 0.3); ctx.fillRect(sx(me.i) - 7, top - 10, 14, axisY - top + 10); }
    // the unevenness penalty between the two curves, in runs of consecutive stops with data
    const runs = []; let cur = [];
    rows.forEach((q) => { if (q.s) cur.push(q); else if (cur.length) { runs.push(cur); cur = []; } }); if (cur.length) runs.push(cur);
    runs.forEach((rn) => {
      if (rn.length < 2) return;
      ctx.beginPath(); rn.forEach((q, k) => (k ? ctx.lineTo(sx(q.i), sy(q.s.EW)) : ctx.moveTo(sx(q.i), sy(q.s.EW))));
      for (let k = rn.length - 1; k >= 0; k--) ctx.lineTo(sx(rn[k].i), sy(rn[k].s.half)); ctx.closePath(); ctx.fillStyle = pattern(ctx, "wait"); ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
      ctx.setLineDash([6, 4]); ctx.strokeStyle = C.steel; ctx.lineWidth = 2; ctx.beginPath(); rn.forEach((q, k) => (k ? ctx.lineTo(sx(q.i), sy(q.s.half)) : ctx.moveTo(sx(q.i), sy(q.s.half)))); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = C.led; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.beginPath(); rn.forEach((q, k) => (k ? ctx.lineTo(sx(q.i), sy(q.s.EW)) : ctx.moveTo(sx(q.i), sy(q.s.EW)))); ctx.stroke();
    });
    DL.pts = [];
    rows.forEach((q) => {
      const x = sx(q.i); DL.pts.push({ x, q });
      ctx.fillStyle = q.s ? C.led : C.muted;
      if (q.s) { ctx.beginPath(); ctx.arc(x, sy(q.s.EW), q.pid === ST.stop ? 6 : 3.4, 0, 6.283); ctx.fill(); if (q.pid === ST.stop) { ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke(); } }
      ctx.fillStyle = q.s ? C.ink : C.muted; ctx.fillRect(Math.round(x) - 0.5, axisY, 1, 5);
    });
    ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, axisY + 0.5, x1, axisY + 0.5);
    // stop names: as many as fit, always the ends and your station
    const every = Math.max(1, Math.ceil((narrow ? 999 : 15) / ((x1 - x0) / Math.max(1, n - 1))));
    rows.forEach((q) => {
      const isMe = q.pid === ST.stop, show = isMe || q.i === 0 || q.i === n - 1 || (!narrow && q.i % every === 0 && Math.abs(q.i - (me ? me.i : -99)) * (x1 - x0) / Math.max(1, n - 1) > 14);
      if (!show) return;
      if (narrow) { const al = q.i === 0 ? "left" : q.i === n - 1 ? "right" : "center"; if (!isMe && me && Math.abs(sx(q.i) - sx(me.i)) < 90) return; text(ctx, q.name, sx(q.i), axisY + 18 + (isMe ? 16 : 0), 11.5, isMe ? C.ink : C.muted, al, isMe ? 760 : 500); return; }
      ctx.save(); ctx.translate(sx(q.i) + 3, axisY + 10); ctx.rotate(-Math.PI / 3.2); text(ctx, q.name, 0, 0, isMe ? 12 : 10.5, isMe ? C.ink : C.muted, "right", isMe ? 760 : 450); ctx.restore();
    });
    if (me && me.s) { const lab = "your station: wait " + fmt(me.s.EW) + ", half the gap " + fmt(me.s.half); halo(ctx, lab, clamp(sx(me.i), x0 + tw(ctx, lab, 12.5, 760) / 2, x1 - tw(ctx, lab, 12.5, 760) / 2), top - 12 + 10, 12.5, C.ink, "center", 760); }
    // hover: the stop's numbers
    if (DL.hover >= 0 && rows[DL.hover]) {
      const q = rows[DL.hover], x = sx(q.i), y = q.s ? sy(q.s.EW) : axisY - 20;
      const ln = [q.name].concat(q.s ? ["average wait " + fmt(q.s.EW) + " min", "average gap " + fmt(q.s.mu) + ", CV " + fmt(q.s.cv, 2)] : ["too few trains in this window"]);
      ctx.font = FNT(13, 560); const w = Math.max(...ln.map((l) => ctx.measureText(l).width)) + 18, h = ln.length * 18 + 12, bx = clamp(x + 12, 4, W - w - 4), by = clamp(y - h - 12, 4, H - h - 4);
      ctx.fillStyle = C.enamel; ctx.fillRect(bx, by, w, h); ln.forEach((l, i) => text(ctx, l, bx + 9, by + 20 + i * 18, 13, i ? "#d5d9dc" : "#fff", "left", i ? 500 : 700));
    }
    // the note: what happens along this route
    const a = ok[0], rest = ok.slice(Math.floor(ok.length / 2)), peak = ok.reduce((m, q) => (q.s.cv > m.s.cv ? q : m), ok[0]);
    const late = rest.reduce((s, q) => s + q.s.cv, 0) / rest.length, mus = ok.map((q) => q.s.mu).sort((x, y) => x - y), muMed = mus[Math.floor(ok.length / 2)], muLo = mus[0], muHi = mus[mus.length - 1];
    let nt;
    if (peak.s.cv - a.s.cv > 0.08 && late > a.s.cv + 0.05)
      nt = (muHi / muLo < 1.25 ? "Trains pass about every " + fmt(muMed) + " minutes all along the route, but they get less even as they go"
        : "Trains pass every " + fmt(muLo) + " to " + fmt(muHi) + " minutes along the route (some trips start or end partway), and they get less even as they go") + ": the CV climbs from " + fmt(a.s.cv, 2) + " at " + a.name + " to " + fmt(peak.s.cv, 2) + " at " + peak.name + ", and the average wait from " + fmt(a.s.EW) + " to " + fmt(peak.s.EW) + " minutes. <b>The orange band is the cost of that unevenness</b>: the difference between your average wait and half an average gap.";
    else
      nt = "On this route the unevenness stays about the same from end to end (CV between " + fmt(Math.min(...ok.map((q) => q.s.cv)), 2) + " and " + fmt(Math.max(...ok.map((q) => q.s.cv)), 2) + "). <b>The orange band is the cost of that unevenness</b>: the difference between your average wait and half an average gap.";
    if (me && me.s) nt += " At " + me.name + " you wait " + fmt(me.s.EW) + " minutes on average, against " + fmt(me.s.half) + " if the trains were evenly spaced.";
    $("n-down").innerHTML = nt;
  }
  onDrag($("cv-down"), {
    down: (pt) => { const i = downHit(pt); if (i < 0) return false; const q = DL.rows[i]; if (q && q.pid !== ST.stop) choose({ stop: q.pid }); return false; },
    move: () => {},
    hover: (pt) => { const i = downHit(pt); if (i !== DL.hover) { DL.hover = i; drawDown(); } $("cv-down").style.cursor = i >= 0 ? "pointer" : "default"; },
    leave: () => { if (DL.hover !== -1) { DL.hover = -1; drawDown(); } }
  });
  function downHit(pt) {
    if (!DL.pts.length) return -1;
    let best = -1, bd = 1e9; DL.pts.forEach((p, k) => { const d = Math.abs(p.x - pt.x); if (d < bd) { bd = d; best = k; } });
    return bd < 16 ? best : -1;
  }
  register("down", drawDown); watch($("cv-down"), "down");
