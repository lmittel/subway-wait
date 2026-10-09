  // =====================================================================
  // THE RIDER CLOUD: one dot per rider, at (the gap they landed in, their wait)
  // s = 0: everyone waits exactly half their gap; s = 1: riders land anywhere, W = U L
  // =====================================================================
  const CL = { s: 0, key: "", pts: null, played: false, h: null };
  function cloudSetup() {
    const key = ST.line + ST.dir + ST.stop + ST.win; if (CL.key === key && CL.pts) return; CL.key = key;
    const h = pooled(ST.line, ST.dir, ST.win), n = h.length; CL.h = h;
    if (n < 2) { CL.pts = []; return; }
    // riders pick moments, so a gap is picked in proportion to its length
    const cum = new Float64Array(n); let a = 0; for (let i = 0; i < n; i++) { a += h[i]; cum[i] = a; }
    const rng = mulberry(23), N = 1800;
    CL.pts = Array.from({ length: N }, () => { const u = rng() * a; let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < u) lo = m + 1; else hi = m; } return { L: h[lo], U: rng(), j: rng() - 0.5 }; });
  }
  // exact share of riders whose wait falls in [w0, w1], for a given spread s
  function cloudMass(w0, w1, s) {
    const h = CL.h; let tot = 0, m = 0;
    for (const v of h) {
      tot += v;
      if (s < 1e-4) { const w = v / 2; if (w >= w0 && w < w1) m += v; continue; }
      const a = v * (1 - s) / 2, b = v * (1 + s) / 2, ov = Math.max(0, Math.min(b, w1) - Math.max(a, w0));
      m += v * ov / (b - a);
    }
    return m / tot;
  }
  function drawCloud() {
    cloudSetup();
    const cv = $("cv-cloud"), Wd = cv.clientWidth || 800, narrow = Wd < 560, { ctx, W, H } = fit(cv, narrow ? 430 : 470), s = stats(CL.h || []);
    caption(cv, fmtN(CL.pts.length) + " riders on " + lcPhrase(ST.line, ST.dir) + ", " + WINPHRASE[ST.win] + ": across, the gap each one landed in; up, how long each one waits");
    if (!s || !CL.pts.length) return;
    const sp = CL.s, yel = C.dark ? C.edge : "#8a6a00";
    const sortedL = CL.pts.map((p) => p.L).sort((a, b) => a - b), xmax = Math.ceil(sortedL[Math.floor(0.99 * (sortedL.length - 1))] * 1.05), ymax = Math.ceil(xmax * 0.7);
    const x0 = 46, x1 = W - (narrow ? 66 : 150), mT = narrow ? 64 : 78, top = mT + 12, axisY = H - 42, rx0 = x1 + 12, rx1 = W - 4;
    const sx = (v) => x0 + v / xmax * (x1 - x0), sy = (v) => axisY - v / ymax * (axisY - top);
    // the plot: gridlines, the two guide lines
    const yt = []; for (let v = 0; v <= ymax + 1e-9; v += niceStep(ymax, 4)) yt.push(v);
    yGrid(ctx, x0, x1, yt, sy, (v) => String(v));
    const xst = niceStep(xmax, narrow ? 5 : 8), xt = []; for (let v = 0; v <= xmax + 1e-9; v += xst) xt.push(v);
    xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v));
    text(ctx, "the gap you land in, minutes", x1, axisY + 32, 12, C.muted, "right", 500);
    ctx.save(); ctx.translate(12, (top + axisY) / 2); ctx.rotate(-Math.PI / 2); text(ctx, "your wait, minutes", 0, 0, 12, C.muted, "center", 500); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x0, top - 2, x1 - x0, axisY - top + 2); ctx.clip();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; line(ctx, sx(0), sy(0), sx(ymax), sy(ymax));
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.steel; ctx.lineWidth = 1.6; line(ctx, sx(0), sy(0), sx(xmax), sy(xmax / 2)); ctx.setLineDash([]);
    // the riders
    ctx.fillStyle = C.dark ? "rgba(245,191,18,.62)" : "rgba(160,118,0,.5)";
    CL.pts.forEach((p) => { const w = p.L * (0.5 + sp * (p.U - 0.5)), x = sx(p.L + p.j * 0.12), y = sy(w); ctx.fillRect(x - 1.3, y - 1.3, 2.6, 2.6); });
    ctx.restore();
    const labDiag = "wait = the whole gap", labHalf = "wait = half the gap";
    halo(ctx, labDiag, sx(ymax * 0.82) - 6, sy(ymax * 0.82) - 2, 12, C.ink, "right", 680);
    halo(ctx, labHalf, sx(xmax * 0.86), sy(xmax * 0.43) - 8, 12, C.steel, "right", 680);
    // top shadow: the gap riders land in (yellow), with the trains' gaps for reference (grey outline)
    const bw = binWidth(s), nb = Math.ceil(xmax / bw), bT = new Float64Array(nb), bR = new Float64Array(nb);
    for (const v of CL.h) { const k = Math.floor(v / bw); if (k < nb) { bT[k] += 1 / CL.h.length; bR[k] += v / s.sum; } }
    const tmax = Math.max(...bT, ...bR) || 1, ty = (v) => mT - v / tmax * (mT - 8);
    // the trains' histogram: a light shape with an outline, so where it rises above the yellow, the difference reads as area
    const stepT = () => { ctx.beginPath(); ctx.moveTo(sx(0), mT); for (let k = 0; k < nb; k++) { const y = ty(bT[k]); ctx.lineTo(sx(k * bw), y); ctx.lineTo(sx((k + 1) * bw), y); } ctx.lineTo(sx(nb * bw), mT); };
    stepT(); ctx.fillStyle = rgba(C.rgb.steel, C.dark ? 0.22 : 0.16); ctx.fill();
    for (let k = 0; k < nb; k++) { const a = sx(k * bw) + 0.5, b = sx((k + 1) * bw) - 1; ctx.fillStyle = pattern(ctx, "riders"); ctx.fillRect(a, ty(bR[k]), b - a, mT - ty(bR[k])); }
    stepT(); ctx.strokeStyle = C.steel; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = C.muted; ctx.fillRect(x0, mT, x1 - x0, 1);
    const eL = s.EL; ctx.strokeStyle = yel; ctx.lineWidth = 2; line(ctx, sx(eL), 6, sx(eL), mT); halo(ctx, "average " + fmt(eL), sx(eL) + 5, 16, 12, yel, "left", 740);
    // the sparse tail: past the first empty minute, the few long gaps stand alone, one block each
    { const mode = bT.indexOf(Math.max(...bT)); let k0 = -1; for (let k = mode + 1; k < nb; k++) if (bT[k] === 0) { k0 = k; break; }
      const tail = k0 > 0 ? Array.from(CL.h).filter((v) => v >= k0 * bw) : [];
      if (tail.length >= 2 && tail.length <= 15) {
        const ts = tail.reduce((q, v) => q + v, 0), pg = (100 * tail.length / CL.h.length).toFixed(1), pr = (100 * ts / s.sum).toFixed(1);
        const per = new Map(); tail.forEach((v) => { const k = Math.floor(v / bw); per.set(k, (per.get(k) || 0) + 1); });
        const single = [...per.values()].every((c) => c === 1), lab = single ? "each block here is one gap" : "the " + tail.length + " gaps out here";
        let ymin = mT; for (let k = k0; k < nb; k++) ymin = Math.min(ymin, ty(bR[k]));
        const bx0 = sx(k0 * bw), bx1 = Math.min(x1, sx(Math.min(xmax, Math.floor(Math.max(...tail) / bw + 1) * bw))), by = ymin - 6;
        ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, bx0, by, bx1, by); line(ctx, bx0, by, bx0, by + 4); line(ctx, bx1, by, bx1, by + 4);
        // a solid backing keeps the label clear of the average line behind it
        const tag = (str, y, px) => { const w = tw(ctx, str, px, 650); ctx.fillStyle = C.panel; ctx.fillRect(bx1 - w - 3, y - px, w + 6, px + 4); text(ctx, str, bx1, y, px, C["ink-2"], "right", 650); };
        if (narrow) { tag(lab + ":", by - 18, 11); tag(pg + "% of gaps, " + pr + "% of riders", by - 5, 11); }
        else tag(lab + ": " + pg + "% of gaps, " + pr + "% of riders", by - 5, 11.5);
      } }
    // right shadow: the wait, exactly, for the current spread
    const wb = ymax / (narrow ? 24 : 36), nw = Math.ceil(ymax / wb), mw = [];
    for (let k = 0; k < nw; k++) mw.push(cloudMass(k * wb, (k + 1) * wb, sp));
    const wmx = Math.max(...mw, 1e-9), wx = (v) => rx0 + v / wmx * (rx1 - rx0 - 4);
    for (let k = 0; k < nw; k++) { const y0 = sy((k + 1) * wb), y1 = sy(k * wb); ctx.fillStyle = pattern(ctx, "wait"); ctx.fillRect(rx0, y0 + 0.5, wx(mw[k]) - rx0, Math.max(1, y1 - y0 - 1)); }
    ctx.strokeStyle = C.led; ctx.lineWidth = 1.6; ctx.beginPath(); for (let k = 0; k < nw; k++) { const x = wx(mw[k]), ya = sy(k * wb), yb = sy((k + 1) * wb); if (k) ctx.lineTo(x, ya); else ctx.moveTo(x, ya); ctx.lineTo(x, yb); } ctx.stroke();
    ctx.fillStyle = C.muted; ctx.fillRect(rx0, top, 1, axisY - top);
    const eW = s.EW; ctx.strokeStyle = C.led; ctx.lineWidth = 2; line(ctx, rx0 - 4, sy(eW), rx1, sy(eW));
    if (!narrow) halo(ctx, "average " + fmt(eW), rx1, sy(eW) - 6, 12, C["led-deep"], "right", 740);
    const under2 = cloudMass(0, 2, sp);
    $("ro-cloud").innerHTML = '<div class="ro riders"><div class="v">' + fmt(eL, 2) + '</div><div class="k">the gap riders land in, on average</div></div>' +
      '<div class="ro wait"><div class="v">' + fmt(eW, 2) + '</div><div class="k">their wait, on average, in both pictures</div></div>' +
      '<div class="ro"><div class="v">' + Math.round(100 * under2) + '%</div><div class="k">of riders wait under 2 minutes ' + (sp > 0.5 ? "" : "in this picture") + "</div></div>";
    $("n-cloud").innerHTML = "Same average, different shape. If everyone waited exactly half their gap, every dot would sit on the dashed line, and the wait would be the yellow curve squeezed to half its width. But riders land anywhere in their gap, so each column of dots fills evenly from zero up to the whole gap. Slice the cloud at a height " + M`w` + ": everyone whose gap is longer than " + M`w` + " can be in that slice, so the slices can only thin out as " + M`w` + " grows.";
  }
  function cloudTo(any) { $("cl-half").setAttribute("aria-pressed", !any); $("cl-any").setAttribute("aria-pressed", any); tween(CL, { s: any ? 1 : 0 }, RM ? 0 : 1600, drawCloud); }
  $("cl-half").addEventListener("click", () => { CL.played = true; cloudTo(false); });
  $("cl-any").addEventListener("click", () => { CL.played = true; cloudTo(true); });
  // the first time the cloud comes into view, let the riders spread out once
  new IntersectionObserver((es, ob) => es.forEach((e) => { if (e.isIntersecting && !CL.played) { CL.played = true; ob.disconnect(); setTimeout(() => cloudTo(true), 900); } }), { threshold: 0.6 }).observe($("cv-cloud"));
