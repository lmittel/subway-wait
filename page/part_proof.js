  // =====================================================================
  // WHERE THE FORMULA COMES FROM: the derivation, one move at a time, each line of algebra beside its picture
  // =====================================================================
  const PF = { i: 0, t: 1, key: "", D: null, txtKey: "" };
  const PF_GROUPS = [["the gap you land in", 0, 4, "edge"], ["your wait", 5, 7, "led"], ["its average", 8, 9, "led"]];
  const pfClock = (s) => { const h = Math.floor(s / 3600) % 24, m = Math.round((s % 3600) / 60); return (h % 12 || 12) + ":" + String(m).padStart(2, "0"); };
  const pfE = (t) => ease(clamp(t, 0, 1));
  // canvas text that wraps at word boundaries (captions inside the pictures)
  function pfWrap(ctx, s, x, y, maxW, px, color, wt, lh) {
    const words = s.split(" "); let ln = "", yy = y;
    words.forEach((w) => { const t = ln ? ln + " " + w : w; if (tw(ctx, t, px, wt) > maxW && ln) { text(ctx, ln, x, yy, px, color, "left", wt); ln = w; yy += lh || px * 1.35; } else ln = t; });
    if (ln) text(ctx, ln, x, yy, px, color, "left", wt);
    return yy;
  }

  // everything the steps need, for the current line, direction and time window
  function pfData() {
    const key = ST.line + ST.dir + ST.stop + ST.win; if (PF.key === key && PF.D) return PF.D;
    const h = pooled(ST.line, ST.dir, ST.win), s = stats(h); if (!s) return null;
    const di = showDay(), arr = dayArrivals(ST.line, ST.dir, di, ST.win), g = [], cum = [];
    let T = 0; for (let k = 0; k + 1 < arr.length; k++) { const v = (arr[k + 1] - arr[k]) / 60; cum.push(T); g.push(v); T += v; }
    const sorted = Float64Array.from(h).sort(), xmax = Math.ceil(quant(h, 0.99) * 1.06 + 0.5);
    const ell = Math.max(1, Math.round(s.mu)), le = Array.from(h).filter((v) => v <= ell);
    const pc = le.length / h.length, pt = le.reduce((a, b) => a + b, 0) / s.sum;
    const dle = g.filter((v) => v <= ell), dpc = g.length ? dle.length / g.length : 0, dpt = T ? dle.reduce((a, b) => a + b, 0) / T : 0;
    const dEW = T ? g.reduce((a, b) => a + b * b, 0) / (2 * T) : NaN, dmu = g.length ? T / g.length : NaN;
    const surv = (w) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= w) lo = m + 1; else hi = m; } return (sorted.length - lo) / sorted.length; };
    PF.key = key; PF.D = { h, s, di, g, cum, T, t0: arr[0], sorted, min: sorted[0], xmax, ell, pc, pt, dpc, dpt, dEW, dmu, surv };
    return PF.D;
  }

  // ---------- the ten steps ----------
  const PF_STEPS = [
    { title: "Lay the gaps end to end", eq: () => [String.raw`T = H_1 + H_2 + \cdots + H_n`],
      why: (D) => dayLong(D.di) + ", " + WIN[ST.win].sub + ", " + lcPhrase(ST.line, ST.dir) + ": " + D.g.length + " gaps covering " + fmt(D.T, 0) + " minutes. A rider who turns up at a random moment lands somewhere on this strip." },
    { title: "Throw a dart", eq: () => [String.raw`P(\text{land in gap } i) = \frac{\cls{hl}{H_i}}{H_1 + H_2 + \cdots + H_n}`],
      why: () => "A dart thrown at the strip lands in gap " + M`i` + " with probability equal to that gap's share of the length. A gap twice as long is twice as likely to be hit: <b>gaps are picked by length, not by count.</b>" },
    { title: "Count the gaps no longer than ℓ", eq: () => [String.raw`P(L \le \ell) = \frac{\sum_i \cls{hl}{H_i}\, 1\{H_i \le \ell\}}{\sum_i H_i}`],
      why: (D) => M`L` + " is the length of the gap the dart lands in. On this strip, " + Math.round(100 * D.dpc) + "% of the gaps are " + D.ell + " minutes or shorter, but they cover only " + Math.round(100 * D.dpt) + "% of the time, so only " + Math.round(100 * D.dpt) + "% of darts land in one." },
    { title: "Many mornings: averages become expectations",
      eq: () => [String.raw`P(L \le \ell) = \frac{\frac{1}{n}\sum_i H_i\, 1\{H_i \le \ell\}}{\frac{1}{n}\sum_i H_i}`, String.raw`\to\; \frac{E[H\,1\{H \le \ell\}]}{E[H]} = \frac{1}{\mu}\int_0^{\ell} \cls{hl}{x}\, f(x)\,dx`],
      why: (D) => "Divide top and bottom by the number of gaps " + M`n` + ". As " + M`n` + " grows, each average settles to its expectation (the law of large numbers). In the bars, each gap's count is reweighted by its length: over all " + (NUMW[D.h.days] || D.h.days) + " days, " + Math.round(100 * D.pc) + "% of gaps are " + D.ell + " minutes or shorter, but only " + Math.round(100 * D.pt) + "% of riders' gaps." },
    { title: "Differentiate: the size-biased density", eq: () => [String.raw`f_L(\ell) = \frac{\cls{hl}{\ell}\; f(\ell)}{\mu}`],
      why: (D) => "The gap you land in has the gaps' density, reweighted by " + M`\ell/\mu` + ": less than 1 for gaps shorter than average, more than 1 for longer ones. So the two curves cross exactly at " + M`\ell = \mu` + " = " + fmt(D.s.mu, 2) + " minutes." },
    { title: "Where in the gap?", eq: () => [String.raw`f_{W \mid L}(w \mid \ell) = \frac{1}{\ell}, \qquad 0 < w < \ell`],
      why: () => "Given the gap, the dart is equally likely to be anywhere inside it. Your wait " + M`W` + " is the time left until the train that ends the gap, so it is uniform from 0 up to the whole gap." },
    { title: "Average over the gap you land in", eq: () => [String.raw`f_W(w) = \int_{\cls{hl}{w}}^{\infty} \frac{1}{\ell}\cdot \frac{\ell\, f(\ell)}{\mu}\; d\ell`],
      why: () => "Multiply the two densities and integrate out " + M`\ell` + ". Only gaps longer than " + M`w` + " can leave you waiting " + M`w` + ", so the integral starts at " + M`\ell = w` + ": it is the slice of the picture at height " + M`w` + "." },
    { title: "The ℓ cancels", eq: () => [String.raw`f_W(w) = \frac{1}{\mu}\int_w^{\infty} f(\ell)\, d\ell = \frac{\cls{hl}{P(H > w)}}{\mu}`],
      why: (D) => "Size bias multiplied by " + M`\ell` + "; the uniform spot divided by " + M`\ell` + ". What is left is the share of gaps longer than " + M`w` + ", over " + M`\mu` + ". <b>Every gap here is longer than " + fmt(D.min, 1) + " minutes, so for shorter waits the density is flat at " + M`1/\mu` + " = " + (1 / D.s.mu).toFixed(2) + " per minute</b>: each train offers exactly one moment to arrive " + M`w` + " minutes early." },
    { title: "The average wait", eq: () => [String.raw`E[W] = \int_0^{\infty} w\, \frac{P(H > w)}{\mu}\, dw = \frac{\cls{hl}{E[H^2]}}{2\mu}`],
      why: (D) => "Swap the integral and the expectation: " + M`\int_0^\infty w\,P(H > w)\,dw = E\bigl[\int_0^H w\,dw\bigr] = E[H^2]/2` + ". On the strip it is geometry: after each train the wait falls from " + M`h` + " to 0, a triangle of area " + M`h^2/2` + ", so the morning's average wait is " + M`\sum h^2 / (2 \sum h)` + " = " + fmt(D.dEW, 2) + " minutes." },
    { title: "Write E[H²] with the mean and the spread",
      eq: () => [String.raw`E[H^2] = \mu^2 + \mathrm{Var}\,H = \mu^2\bigl(1 + \mathrm{CV}^2\bigr)`, String.raw`E[W] = \cls{hl}{\frac{\mu}{2}\bigl(1 + \mathrm{CV}^2\bigr)}`],
      why: (D) => "On " + lcPhrase(ST.line, ST.dir) + ", " + WINPHRASE[ST.win] + ": " + M`\mu` + " = " + fmt(D.s.mu, 2) + " and CV = " + fmt(D.s.cv, 2) + ", so " + M`E[W]` + " = " + fmt(D.s.mu / 2, 2) + " × (1 + " + fmt(D.s.cv * D.s.cv, 2) + ") = <b>" + fmt(D.s.EW, 2) + " minutes</b>: half an average gap, plus a penalty for unevenness. This is the formula at the end of the line." }
  ];

  // ---------- pictures ----------
  const pfYel = () => (C.dark ? C.edge : "#8a6a00");
  function pfStripGeom(W, D) { const x0 = 18, x1 = W - 18; return { x0, x1, sx: (m) => x0 + m / D.T * (x1 - x0) }; }
  function pfStripAxis(ctx, W, D, y) {
    const { x0, x1, sx } = pfStripGeom(W, D), a = D.t0, b = D.t0 + D.T * 60, step = D.T > 200 ? 3600 : 1800;
    ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, y + 0.5, x1, y + 0.5);
    for (let s = Math.ceil(a / step) * step; s <= b; s += step) { const x = sx((s - a) / 60); line(ctx, x, y, x, y + 4); text(ctx, pfClock(s), x, y + 17, 11.5, C.muted, "center", 500); }
  }
  function pfStrip(ctx, W, D, y, bh, fillFor, upto) {
    const { sx } = pfStripGeom(W, D), lim = upto == null ? D.T : upto;
    D.g.forEach((h, k) => { const a = D.cum[k]; if (a >= lim) return; const b = Math.min(a + h, lim); ctx.fillStyle = fillFor(k, h); ctx.fillRect(sx(a), y - bh / 2, sx(b) - sx(a), bh); });
    ctx.fillStyle = C.ink;
    for (let k = 0; k <= D.g.length; k++) { const m = k < D.g.length ? D.cum[k] : D.T; if (m > lim + 1e-9) break; ctx.fillRect(Math.round(sx(m)) - 1, y - bh / 2 - 5, 2, bh + 10); }
  }
  const PF_PICS = [
    // 1. the strip builds up, train by train
    (ctx, W, H, D, t) => {
      const y = H * 0.46, bh = 36, { sx } = pfStripGeom(W, D), upto = pfE(t) * D.T;
      pfStrip(ctx, W, D, y, bh, (k) => rgba(C.rgb.steel, k % 2 ? 0.26 : 0.46), upto);
      pfStripAxis(ctx, W, D, y + bh / 2 + 16);
      if (t > 0.98) {
        const yb = y - bh / 2 - 22; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; line(ctx, sx(0), yb, sx(D.T), yb); line(ctx, sx(0), yb, sx(0), yb + 6); line(ctx, sx(D.T), yb, sx(D.T), yb + 6);
        halo(ctx, "T = " + fmt(D.T, 0) + " minutes, " + D.g.length + " gaps", (sx(0) + sx(D.T)) / 2, yb - 7, 13, C.ink, "center", 700);
        let km = 0; D.g.forEach((v, k) => { if (v > D.g[km]) km = k; });
        const xm = sx(D.cum[km] + D.g[km] / 2); halo(ctx, "longest gap " + fmt(D.g[km]) + " min", xm, y + 5, 12, C.ink, "center", 700);
      }
      pfWrap(ctx, "Each black tick is a train at the platform; each block is the gap after it.", 18, y + bh / 2 + 62, W - 36, 12.5, C["ink-2"], 500);
    },
    // 2. darts fall; long gaps catch more of them
    (ctx, W, H, D, t) => {
      const y = H * 0.66, bh = 30, { sx } = pfStripGeom(W, D), N = 60, rng = mulberry(11), hits = new Array(D.g.length).fill(0), drops = [];
      for (let j = 0; j < N; j++) { const u = rng() * D.T; let k = 0; while (k + 1 < D.g.length && D.cum[k + 1] <= u) k++; drops.push([u, k, hits[k]++]); }
      const shown = new Array(D.g.length).fill(0), top = 16, dot = 6.5;
      drops.forEach(([u, k, n], j) => { const p = clamp((t * 1.6 - j / N) / 0.6, 0, 1); if (p <= 0) return; if (p >= 1) shown[k]++;
        const xa = sx(u), xb = sx(D.cum[k] + D.g[k] / 2), ye = y - bh / 2 - 9 - n * dot, e = pfE(p);
        ctx.fillStyle = pfYel(); ctx.beginPath(); ctx.arc(lerp(xa, xb, e * e), lerp(top, ye, e), 2.7, 0, 6.283); ctx.fill(); });
      pfStrip(ctx, W, D, y, bh, (k, h) => (shown[k] ? rgba(C.rgb.edge, Math.min(0.85, 0.25 + 0.6 * shown[k] / Math.max(...hits))) : rgba(C.rgb.steel, 0.22)));
      let km = 0; D.g.forEach((v, k) => { if (v > D.g[km]) km = k; });
      if (t > 0.98) pfWrap(ctx, "The longest gap (" + fmt(D.g[km]) + " min) caught " + hits[km] + " of " + N + " darts; shared evenly among " + D.g.length + " gaps, each would get " + fmt(N / D.g.length, 1) + ".", 18, y + bh / 2 + 30, W - 36, 12.5, C["ink-2"], 500);
    },
    // 3. the gaps no longer than l, counted two ways
    (ctx, W, H, D, t) => {
      const y = H * 0.3, bh = 32, { x0, x1, sx } = pfStripGeom(W, D), e = pfE(t);
      pfStrip(ctx, W, D, y, bh, (k, h) => (h <= D.ell ? rgba(C.rgb.steel, 0.62) : rgba(C.rgb.steel, 0.14)));
      halo(ctx, "solid: gaps of " + D.ell + " minutes or less", x0, y - bh / 2 - 12, 12.5, C.ink, "left", 700);
      const bar = (yb, frac, fill, lab) => { text(ctx, lab, x0, yb - 8, 12.5, C.ink, "left", 650); ctx.fillStyle = rgba(C.rgb.steel, 0.1); ctx.fillRect(x0, yb, x1 - x0, 18); ctx.fillStyle = fill; ctx.fillRect(x0, yb, (x1 - x0) * frac * e, 18); text(ctx, Math.round(100 * frac * e) + "%", x0 + (x1 - x0) * frac * e + 6, yb + 14, 13, C.ink, "left", 760); };
      bar(H * 0.56, D.dpc, rgba(C.rgb.steel, 0.62), "share of gaps (count each gap once)");
      bar(H * 0.78, D.dpt, pattern(ctx, "riders"), "share of time, which is what a dart sees");
    },
    // 4. histogram: counts reweighted by length
    (ctx, W, H, D, t) => {
      const s = D.s, bw = binWidth(s), nb = Math.ceil(D.xmax / bw), c = new Float64Array(nb), l = new Float64Array(nb), e = pfE(t);
      for (const v of D.h) { const k = Math.floor(v / bw); if (k < nb) { c[k] += 1 / D.h.length; l[k] += v / s.sum; } }
      const x0 = 44, x1 = W - 12, top = 40, axisY = H - 40, ymax = Math.max(...c, ...l) / bw * 1.1, sx = (v) => x0 + v / D.xmax * (x1 - x0), sy = (v) => axisY - v / ymax * (axisY - top);
      yGrid(ctx, x0, x1, [0, ymax / 2.2, ymax / 1.1].map((v) => +v.toFixed(2)), sy, (v) => v.toFixed(2));
      for (let k = 0; k < nb; k++) {
        const v = lerp(c[k], l[k], e) / bw, a = sx(k * bw) + 0.5, b = sx((k + 1) * bw) - 1;
        ctx.globalAlpha = 1 - e; ctx.fillStyle = rgba(C.rgb.steel, (k + 1) * bw <= D.ell + 1e-9 ? 0.75 : 0.35); ctx.fillRect(a, sy(v), b - a, axisY - sy(v));
        ctx.globalAlpha = e; ctx.fillStyle = pattern(ctx, "riders"); ctx.fillRect(a, sy(v), b - a, axisY - sy(v));
        if ((k + 1) * bw <= D.ell + 1e-9) { ctx.globalAlpha = e * 0.35; ctx.fillStyle = C.ink; ctx.fillRect(a, sy(v), b - a, axisY - sy(v)); }
        ctx.globalAlpha = 1;
      }
      const xl = sx(D.ell); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); line(ctx, xl, top - 6, xl, axisY); ctx.setLineDash([]);
      halo(ctx, "ℓ = " + D.ell, xl + 5, top + 6, 12.5, C.ink, "left", 700);
      const share = lerp(D.pc, D.pt, e);
      text(ctx, "share at or left of ℓ: " + Math.round(100 * share) + "%  (" + (e < 0.5 ? "counting gaps" : "counting riders") + ")", x0, 18, 13, C.ink, "left", 700);
      const xst = niceStep(D.xmax, W < 500 ? 5 : 8), xt = []; for (let v = 0; v <= D.xmax + 1e-9; v += xst) xt.push(v);
      xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v)); text(ctx, "gap, minutes", x1, axisY + 32, 12, C.muted, "right", 500);
    },
    // 5. the two densities, crossing at the mean
    (ctx, W, H, D, t) => {
      const N = 220, xs = Array.from({ length: N + 1 }, (_, i) => D.xmax * i / N), f = kde(D.h, xs), fb = xs.map((x, i) => x * f[i] / D.s.mu), e = pfE(t);
      const x0 = 44, x1 = W - 12, top = 30, axisY = H - 40, ymax = Math.max(...f, ...fb) * 1.12, sx = (v) => x0 + v / D.xmax * (x1 - x0), sy = (v) => axisY - v / ymax * (axisY - top);
      const yst = niceStep(ymax, 4), yt = []; for (let v = 0; v <= ymax + 1e-9; v += yst) yt.push(v); yGrid(ctx, x0, x1, yt, sy, (v) => v.toFixed(2));
      const path = (ys) => { ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(sx(x), sy(ys[i])) : ctx.moveTo(sx(x), sy(ys[i])))); };
      path(f); ctx.lineTo(x1, axisY); ctx.lineTo(x0, axisY); ctx.closePath(); ctx.fillStyle = rgba(C.rgb.steel, 0.18); ctx.fill(); path(f); ctx.strokeStyle = C.steel; ctx.lineWidth = 2.2; ctx.stroke();
      const g = fb.map((v, i) => lerp(f[i], v, e)); path(g); ctx.lineTo(x1, axisY); ctx.lineTo(x0, axisY); ctx.closePath(); ctx.globalAlpha = 0.55 * e; ctx.fillStyle = pattern(ctx, "riders"); ctx.fill(); ctx.globalAlpha = 1; path(g); ctx.strokeStyle = pfYel(); ctx.lineWidth = 2.4; ctx.stroke();
      const xm = sx(D.s.mu), fm = f[Math.round(D.s.mu / D.xmax * N)];
      ctx.strokeStyle = C.ink; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; line(ctx, xm, top - 8, xm, axisY); ctx.setLineDash([]);
      if (e > 0.9) { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(xm, sy(fm), 4.5, 0, 6.283); ctx.fill(); halo(ctx, "they cross at ℓ = μ = " + fmt(D.s.mu), xm + 8, sy(fm) - 10, 12.5, C.ink, "left", 700); }
      halo(ctx, "f(ℓ): the gaps", sx(D.s.mu * 0.45), top + 2, 12.5, C.steel, "center", 700);
      if (e > 0.5) halo(ctx, "ℓ f(ℓ) / μ: the gap you land in", Math.min(sx(D.s.mu * 1.6), x1 - 90), top + 20, 12.5, pfYel(), "center", 700);
      const xst = niceStep(D.xmax, W < 500 ? 5 : 8), xt = []; for (let v = 0; v <= D.xmax + 1e-9; v += xst) xt.push(v);
      xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v)); text(ctx, "ℓ, minutes", x1, axisY + 32, 12, C.muted, "right", 500);
    },
    // 6. one gap, the dart anywhere in it
    (ctx, W, H, D, t) => {
      let k0 = 0; D.g.forEach((v, k) => { if (Math.abs(v - D.s.EL) < Math.abs(D.g[k0] - D.s.EL)) k0 = k; });
      const L = D.g[k0], xa = 56, xb = W - 56, y = H * 0.32, u = 0.1 + 0.5 * pfE(t), xd = lerp(xa, xb, u), w = L * (1 - u);
      ctx.fillStyle = rgba(C.rgb.edge, 0.3); ctx.fillRect(xa, y - 14, xb - xa, 28);
      bulletDraw(ctx, ST.line, xa, y, 13); bulletDraw(ctx, ST.line, xb, y, 13);
      text(ctx, "a train", xa, y + 32, 12, C.muted, "center", 500); text(ctx, "the next train", xb, y + 32, 12, C.muted, "center", 500);
      halo(ctx, "a gap of ℓ = " + fmt(L) + " minutes", (xa + xb) / 2, y - 44, 13, C.ink, "center", 700);
      ctx.fillStyle = pfYel(); ctx.beginPath(); ctx.arc(xd, y, 6, 0, 6.283); ctx.fill();
      ctx.strokeStyle = C["led-deep"]; ctx.lineWidth = 2.4; line(ctx, xd + 8, y, xb - 17, y); ctx.beginPath(); ctx.moveTo(xb - 17, y); ctx.lineTo(xb - 25, y - 5); ctx.lineTo(xb - 25, y + 5); ctx.closePath(); ctx.fillStyle = C["led-deep"]; ctx.fill();
      halo(ctx, "you wait w = " + fmt(w) + " min", (xd + xb) / 2, y - 20, 12.5, C["led-deep"], "center", 760);
      // the uniform density of the wait, 0 < w < l
      const ay = H - 40, top = H * 0.62, sw = (v) => xa + v / L * (xb - xa), hgt = (ay - top) * 0.75;
      ctx.fillStyle = pattern(ctx, "wait"); ctx.fillRect(xa, ay - hgt, xb - xa, hgt); ctx.strokeStyle = C.led; ctx.lineWidth = 2; line(ctx, xa, ay - hgt, xb, ay - hgt);
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, xa - 10, ay + 0.5, xb + 10, ay + 0.5);
      text(ctx, "0", xa, ay + 16, 12, C.muted, "center", 500); text(ctx, "ℓ", xb, ay + 16, 12, C.muted, "center", 600); text(ctx, "wait w", xb + 12, ay + 16, 12, C.muted, "left", 500);
      halo(ctx, "density 1/ℓ = " + (1 / L).toFixed(3) + " per minute, flat", (xa + xb) / 2, ay - hgt - 8, 12.5, C["led-deep"], "center", 700);
      ctx.fillStyle = C["led-deep"]; ctx.beginPath(); ctx.arc(sw(w), ay - hgt, 5, 0, 6.283); ctx.fill();
    },
    // 7. the (l, w) plane: joint density f(l)/mu below the diagonal; a slice at height w
    (ctx, W, H, D, t) => {
      const N = 160, xs = Array.from({ length: N + 1 }, (_, i) => D.xmax * i / N), f = kde(D.h, xs), fmax = Math.max(...f);
      const x0 = 44, x1 = W - (W < 560 ? 70 : 120), top = 18, axisY = H - 40, ymax = D.xmax * 0.72, sx = (v) => x0 + v / D.xmax * (x1 - x0), sy = (v) => axisY - v / ymax * (axisY - top);
      for (let i = 0; i < N; i++) { const a = sx(xs[i]), b = sx(xs[i + 1]) + 0.6, hi = Math.min(xs[i], ymax); ctx.fillStyle = rgba(C.rgb.edge, 0.08 + 0.8 * f[i] / fmax); ctx.fillRect(a, sy(hi), b - a, axisY - sy(hi)); }
      ctx.save(); ctx.beginPath(); ctx.rect(x0, top, x1 - x0, axisY - top); ctx.clip(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.3; line(ctx, sx(0), sy(0), sx(ymax), sy(ymax)); ctx.restore();
      halo(ctx, "w = ℓ", sx(ymax * 0.86) - 8, sy(ymax * 0.86), 12, C.ink, "right", 700);
      const w0 = lerp(0.18, 1.1, pfE(t)) * D.s.mu, yw = sy(w0);
      ctx.fillStyle = C.led; ctx.fillRect(sx(w0), yw - 3, x1 - sx(w0), 6);
      { const lab = W < 560 ? "slice at w = " + fmt(w0) : "slice at w = " + fmt(w0) + ": every gap ℓ > w", lw = tw(ctx, lab, 12.5, 700), fits = sx(w0) + 8 + lw < x1;
        halo(ctx, lab, fits ? sx(w0) + 8 : x1 - 4, yw - 9, 12.5, C["led-deep"], fits ? "left" : "right", 700); }
      const xst = niceStep(D.xmax, W < 500 ? 5 : 8), xt = []; for (let v = 0; v <= D.xmax + 1e-9; v += xst) xt.push(v);
      xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v)); text(ctx, "ℓ, the gap you land in", x1, axisY + 32, 12, C.muted, "right", 500);
      const yt = []; for (let v = 0; v <= ymax + 1e-9; v += niceStep(ymax, 4)) yt.push(v); yGrid(ctx, x0, x1, yt, sy, (v) => String(v));
      ctx.save(); ctx.translate(12, (top + axisY) / 2); ctx.rotate(-Math.PI / 2); text(ctx, "w, your wait", 0, 0, 12, C.muted, "center", 500); ctx.restore();
      // right edge: the resulting density of the wait, with this slice marked
      const rx0 = x1 + 12, rx1 = W - 6, fw = (w) => D.surv(w) / D.s.mu, wx = (v) => rx0 + v * D.s.mu * (rx1 - rx0 - 4);
      ctx.strokeStyle = C.led; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 120; i++) { const w = ymax * i / 120; const p = [wx(fw(w)), sy(w)]; i ? ctx.lineTo(...p) : ctx.moveTo(...p); } ctx.stroke();
      ctx.fillStyle = C["led-deep"]; ctx.beginPath(); ctx.arc(wx(fw(w0)), yw, 4.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = C.muted; ctx.fillRect(rx0, top, 1, axisY - top); text(ctx, "f_W(w)", rx1, axisY + 17, 12, C["led-deep"], "right", 700);
    },
    // 8. the share of gaps longer than w, traced out as w grows
    (ctx, W, H, D, t) => {
      const x0 = 44, x1 = W - 12, sx = (v) => x0 + v / D.xmax * (x1 - x0), s = D.s, far = D.xmax * 0.96,
        w = t < 0.75 ? pfE(t / 0.75) * far : lerp(far, s.mu, pfE((t - 0.75) / 0.25)), reach = t < 0.75 ? w : far;
      // top: the gaps' histogram, the part longer than w shaded
      const bw = binWidth(s) / 2, nb = Math.ceil(D.xmax / bw), c = new Float64Array(nb); for (const v of D.h) { const k = Math.floor(v / bw); if (k < nb) c[k] += 1 / D.h.length / bw; }
      const tTop = 26, tAx = H * 0.42, cmax = Math.max(...c) * 1.1, ty = (v) => tAx - v / cmax * (tAx - tTop);
      for (let k = 0; k < nb; k++) { const a = sx(k * bw), b = sx((k + 1) * bw) - 0.8, cut = clamp(sx(w), a, b);
        ctx.fillStyle = rgba(C.rgb.steel, 0.2); ctx.fillRect(a, ty(c[k]), cut - a, tAx - ty(c[k])); ctx.fillStyle = rgba(C.rgb.steel, 0.75); ctx.fillRect(cut, ty(c[k]), b - cut, tAx - ty(c[k])); }
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, tAx + 0.5, x1, tAx + 0.5);
      text(ctx, "the gaps; solid: longer than w, P(H > w) = " + Math.round(100 * D.surv(w)) + "%", x0, 14, 13, C.ink, "left", 700);
      // bottom: f_W(w) = P(H > w) / mu, traced up to w
      const bTop = H * 0.55, bAx = H - 40, ymax = 1 / s.mu * 1.25, by = (v) => bAx - v / ymax * (bAx - bTop);
      ctx.strokeStyle = C.dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"; ctx.setLineDash([3, 3]); line(ctx, x0, by(1 / s.mu), x1, by(1 / s.mu)); ctx.setLineDash([]);
      text(ctx, "1/μ = " + (1 / s.mu).toFixed(2), x1, by(1 / s.mu) - 5, 11.5, C.muted, "right", 600);
      ctx.beginPath(); ctx.moveTo(sx(0), bAx); const M2 = 260; for (let i = 0; i <= M2; i++) { const v = reach * i / M2; ctx.lineTo(sx(v), by(D.surv(v) / s.mu)); } ctx.lineTo(sx(reach), bAx); ctx.closePath(); ctx.fillStyle = pattern(ctx, "wait"); ctx.fill();
      ctx.beginPath(); for (let i = 0; i <= M2; i++) { const v = reach * i / M2, p = [sx(v), by(D.surv(v) / s.mu)]; i ? ctx.lineTo(...p) : ctx.moveTo(...p); } ctx.strokeStyle = C.led; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); line(ctx, sx(w), tTop, sx(w), bAx); ctx.setLineDash([]);
      ctx.fillStyle = C["led-deep"]; ctx.beginPath(); ctx.arc(sx(w), by(D.surv(w) / s.mu), 4.5, 0, 6.283); ctx.fill();
      if (reach > D.min) { const xm = sx(D.min), yb = by(1 / s.mu) - 12; ctx.strokeStyle = C["led-deep"]; ctx.lineWidth = 1.2; line(ctx, sx(0), yb, xm, yb); line(ctx, sx(0), yb, sx(0), yb + 5); line(ctx, xm, yb, xm, yb + 5);
        halo(ctx, "flat until the shortest gap, " + fmt(D.min) + " min", xm + 6, yb + 4, 12, C["led-deep"], "left", 700); }
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, bAx + 0.5, x1, bAx + 0.5);
      text(ctx, "your wait's density, f_W(w) = P(H > w) / μ", x0, bTop - 8, 13, C["led-deep"], "left", 700);
      const xst = niceStep(D.xmax, W < 500 ? 5 : 8); for (let v = 0; v <= D.xmax + 1e-9; v += xst) { const x = Math.round(sx(v)) + 0.5; ctx.strokeStyle = C.muted; line(ctx, x, bAx, x, bAx + 4); text(ctx, String(v), x, bAx + 17, 12, C.muted, "center", 500); }
      text(ctx, "w, minutes", x1, bAx + 32, 12, C.muted, "right", 500);
    },
    // 9. the sawtooth: each gap a triangle of waits, area h^2/2
    (ctx, W, H, D, t) => {
      const { x0, x1, sx } = pfStripGeom(W, D), axisY = H - 52, top = 34, hm = Math.max(...D.g) * 1.08, sy = (v) => axisY - v / hm * (axisY - top), upto = pfE(t) * D.T;
      let km = 0; D.g.forEach((v, k) => { if (v > D.g[km]) km = k; });
      D.g.forEach((h, k) => { const a = D.cum[k]; if (a >= upto) return;
        const b = Math.min(a + h, upto), hb = h - (b - a);
        ctx.beginPath(); ctx.moveTo(sx(a), axisY); ctx.lineTo(sx(a), sy(h)); ctx.lineTo(sx(b), sy(hb)); ctx.lineTo(sx(b), axisY); ctx.closePath();
        ctx.fillStyle = pattern(ctx, "wait"); ctx.fill(); ctx.strokeStyle = C.led; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx(a), axisY); ctx.lineTo(sx(a), sy(h)); ctx.lineTo(sx(b), sy(hb)); ctx.stroke(); });
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, axisY + 0.5, x1, axisY + 0.5);
      if (t > 0.98) {
        ctx.strokeStyle = C["led-deep"]; ctx.lineWidth = 2; line(ctx, x0, sy(D.dEW), x1, sy(D.dEW));
        ctx.strokeStyle = C.steel; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6; line(ctx, x0, sy(D.dmu / 2), x1, sy(D.dmu / 2)); ctx.setLineDash([]);
        halo(ctx, "average wait " + fmt(D.dEW, 2), x1, sy(D.dEW) - 6, 12.5, C["led-deep"], "right", 760);
        halo(ctx, "half the average gap " + fmt(D.dmu / 2, 2), x1, sy(D.dmu / 2) + 15, 12.5, C.steel, "right", 700);
        const xa = sx(D.cum[km]); halo(ctx, "area " + fmt(D.g[km]) + "² / 2", xa + 4, sy(D.g[km]) - 6, 12.5, C.ink, xa > W * 0.7 ? "right" : "left", 700);
      }
      text(ctx, "your wait, if you arrived at that moment", x0, 16, 13, C.ink, "left", 700);
      pfStripAxis(ctx, W, D, axisY);
    },
    // 10. half a gap, plus the unevenness penalty
    (ctx, W, H, D, t) => {
      const s = D.s, x0 = 30, x1 = W - 30, vmax = Math.max(s.mu, s.EW) * 1.12, sx = (v) => x0 + v / vmax * (x1 - x0), y = H * 0.42, bh = 40, e = pfE(t);
      const half = s.mu / 2, pen = s.mu / 2 * s.cv * s.cv * e;
      ctx.fillStyle = rgba(C.rgb.steel, 0.55); ctx.fillRect(sx(0), y - bh / 2, sx(half) - sx(0), bh);
      ctx.fillStyle = pattern(ctx, "wait"); ctx.fillRect(sx(half), y - bh / 2, sx(half + pen) - sx(half), bh); ctx.strokeStyle = C.led; ctx.lineWidth = 2; ctx.strokeRect(sx(half), y - bh / 2, sx(half + pen) - sx(half), bh);
      halo(ctx, "μ/2 = " + fmt(half, 2), (sx(0) + sx(half)) / 2, y + 5, 13, C.ink, "center", 760);
      if (e > 0.6) { const xc = (sx(half) + sx(half + pen)) / 2; tlab(ctx, "unevenness penalty μ/2 · CV² = " + fmt(s.mu / 2 * s.cv * s.cv, 2), xc, y - bh / 2 - 10, 13, C["led-deep"], 760, 0, W); }
      text(ctx, "half the average gap", (sx(0) + sx(half)) / 2, y + bh / 2 + 18, 12.5, C["ink-2"], "center", 600);
      const ay = H * 0.78; ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, ay + 0.5, x1, ay + 0.5);
      [[half, "clockwork (CV 0)", C.steel], [s.mu, "Poisson (CV 1)", C.ink], [half + pen, "your line " + fmt(half + pen, 2), C["led-deep"]]].forEach(([v, lab, col], i) => {
        const x = sx(v); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, ay, 4.5, 0, 6.283); ctx.fill(); tlab(ctx, lab, x, ay + (i === 2 ? -10 : 20), 12.5, col, 700, 0, W); });
      pfWrap(ctx, "E[W] = (μ/2)(1 + CV²): the same average gap, spaced three ways", x0, 18, W - 2 * x0, 13, C.ink, 700);
    }
  ];

  // ---------- the controls: a strip map of the ten steps ----------
  function pfMap() {
    const box = $("pf-map"); box.innerHTML = "";
    PF_GROUPS.forEach(([lab, a, b, col]) => {
      const g = document.createElement("div"); g.className = "pf-seg " + col; g.style.flexGrow = b - a + 1;
      const row = document.createElement("div"); row.className = "pf-row";
      for (let i = a; i <= b; i++) { const s = document.createElement("button"); s.type = "button"; s.className = "pf-stop"; s.dataset.i = i; s.setAttribute("aria-label", "Step " + (i + 1) + ": " + PF_STEPS[i].title); s.innerHTML = "<span>" + (i + 1) + "</span>"; s.addEventListener("click", () => pfGo(i)); row.appendChild(s); }
      g.appendChild(row); const l = document.createElement("div"); l.className = "pf-seglab"; l.textContent = lab; g.appendChild(l); box.appendChild(g);
    });
  }
  function pfText() {
    const D = pfData(); if (!D) return;
    const st = PF_STEPS[PF.i], key = PF.i + "|" + PF.key; if (PF.txtKey === key) return; PF.txtKey = key;
    $("pf-title").textContent = (PF.i + 1) + ". " + st.title;
    $("pf-eq").innerHTML = st.eq(D).map((e) => '<div class="formula">' + tex(e, { display: true }) + "</div>").join("");
    $("pf-why").innerHTML = st.why(D);
    $("cv-proof").setAttribute("aria-label", "Step " + (PF.i + 1) + ": " + st.title);
    document.querySelectorAll("#pf-map .pf-stop").forEach((b) => { const i = +b.dataset.i; b.classList.toggle("done", i < PF.i); if (i === PF.i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
    $("pf-back").disabled = PF.i === 0; $("pf-next").textContent = PF.i === PF_STEPS.length - 1 ? "Start again" : "Next step";
    if (PF.all) pfAll();
  }
  function pfAll() {
    const D = pfData(); if (!D) return;
    $("pf-list").innerHTML = PF_STEPS.map((st, i) => "<li><b>" + st.title + "</b>" + st.eq(D).map((e) => '<div class="formula">' + tex(e, { display: true }) + "</div>").join("") + "</li>").join("");
  }
  function drawProof() {
    const D = pfData(); if (!D) return; pfText();
    const cv = $("cv-proof"), Wd = cv.clientWidth || 600, { ctx, W, H } = fit(cv, Wd < 560 ? 300 : 330);
    PF_PICS[PF.i](ctx, W, H, D, PF.t);
  }
  function pfGo(i) {
    PF.i = (i + PF_STEPS.length) % PF_STEPS.length; PF.t = 0; pfText();
    tween(PF, { t: 1 }, PF.i === 7 ? 3400 : PF.i === 1 ? 1800 : 1100, drawProof);
  }
  pfMap();
  $("pf-next").addEventListener("click", () => pfGo(PF.i + 1));
  $("pf-back").addEventListener("click", () => { if (PF.i > 0) pfGo(PF.i - 1); });
  $("pf-all").addEventListener("click", () => { PF.all = !PF.all; $("pf-all").setAttribute("aria-pressed", PF.all); $("pf-list").hidden = !PF.all; if (PF.all) pfAll(); });
  $("s-proof").addEventListener("keydown", (e) => { if (e.target.closest("input, select, textarea")) return; if (e.key === "ArrowRight") { pfGo(PF.i + 1); e.preventDefault(); } else if (e.key === "ArrowLeft" && PF.i > 0) { pfGo(PF.i - 1); e.preventDefault(); } });
  onState(() => { PF.txtKey = ""; if (PF.all) pfAll(); });
  register("proof", drawProof); watch($("cv-proof"), "proof");
