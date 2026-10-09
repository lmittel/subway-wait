  // =====================================================================
  // YOUR WAIT: the sawtooth. Every gap is a triangle; the average height is the average wait
  // =====================================================================
  const SAW = { key: "", t: [], t0: [], drag: -1, ymax: 1, back: 0, backOn: false };
  function sawSetup(force) {
    const key = ST.line + ST.dir + ST.win; if (!force && key === SAW.key) return; SAW.key = key;
    SAW.day = showDay(); SAW.t0 = dayArrivals(ST.line, ST.dir, SAW.day, ST.win).slice(); SAW.t = SAW.t0.slice();
    let mx = 0; for (let i = 0; i + 1 < SAW.t0.length; i++) mx = Math.max(mx, (SAW.t0[i + 1] - SAW.t0[i]) / 60);
    SAW.ymax = mx * 1.12;
  }
  function sawStats(t) {
    let s = 0, s2 = 0, n = 0; for (let i = 0; i + 1 < t.length; i++) { const g = (t[i + 1] - t[i]) / 60; s += g; s2 += g * g; n++; }
    const mu = s / n; return { n, mu, EW: s2 / (2 * s), half: mu / 2, cv: Math.sqrt(Math.max(0, s2 / n - mu * mu)) / mu, max: 0 };
  }
  function sawGeo(W, H) {
    const Wn = WIN[ST.win], wide = W >= 640, x0 = 46, x1 = W - (wide ? 136 : 12), top = 14, axisY = H - 62;
    return { wide, x0, x1, top, axisY, hy: axisY + 34, sx: (t) => x0 + (t - Wn.a) / (Wn.b - Wn.a) * (x1 - x0), tx: (x) => Wn.a + (x - x0) / (x1 - x0) * (Wn.b - Wn.a) };
  }
  function drawSaw() {
    const cv = $("cv-saw"), { ctx, W, H } = fit(cv, 316), t = SAW.t;
    const bk = SAW.back, looking = bk > 0.5;
    caption(cv, (looking ? "If you arrived at this moment, the last train left this long ago (" : "If you arrived at this moment, you would wait this long (") + dayLong(SAW.day) + ")");
    if (t.length < 3) { text(ctx, "Too few trains in this window that day.", 0, 30, 14, C.muted); return; }
    const g = sawGeo(W, H), st = sawStats(t);
    let mx = 0; for (let i = 0; i + 1 < t.length; i++) mx = Math.max(mx, (t[i + 1] - t[i]) / 60);
    SAW.ymax = Math.max(SAW.ymax, mx * 1.12);
    const sy = (v) => g.axisY - v / SAW.ymax * (g.axisY - g.top);
    const yst = niceStep(SAW.ymax, 4), yt = []; for (let v = 0; v <= SAW.ymax + 1e-9; v += yst) yt.push(v);
    yGrid(ctx, g.x0, g.x1, yt, sy, (v) => v + " min");
    const pat = pattern(ctx, "wait");
    for (let i = 0; i + 1 < t.length; i++) {
      const a = g.sx(t[i]), b = g.sx(t[i + 1]), gg = (t[i + 1] - t[i]) / 60;
      // ahead: the wait falls from the whole gap to zero; behind: the time since the last train rises from zero
      ctx.beginPath(); ctx.moveTo(a, g.axisY); ctx.lineTo(a, sy(gg * (1 - bk))); ctx.lineTo(b, sy(gg * bk)); ctx.lineTo(b, g.axisY); ctx.closePath();
      ctx.fillStyle = pat; ctx.fill(); ctx.strokeStyle = C.led; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, g.x0, g.axisY + 0.5, g.x1, g.axisY + 0.5);
    // the two averages
    ctx.save(); ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    ctx.strokeStyle = C.steel; line(ctx, g.x0, sy(st.half), g.x1, sy(st.half));
    ctx.strokeStyle = C["led-deep"]; line(ctx, g.x0, sy(st.EW), g.x1, sy(st.EW)); ctx.restore();
    if (g.wide) {
      // labels sit in the right margin, pushed apart when the two lines are close
      let ya = sy(st.EW), yb = sy(st.half); const need = 34;
      if (yb - ya < need) { const mid = (ya + yb) / 2; ya = mid - need / 2; yb = mid + need / 2; }
      const lx = g.x1 + 10;
      text(ctx, looking ? "average since" : "average wait", lx, ya - 3, 12.5, C["led-deep"], "left", 720); text(ctx, fmt(st.EW, 2) + " min", lx, ya + 12, 12.5, C["led-deep"], "left", 720);
      text(ctx, "half the average gap", lx, yb - 3, 12, C.steel, "left", 650); text(ctx, fmt(st.half, 2) + " min", lx, yb + 12, 12, C.steel, "left", 650);
    }
    // draggable trains
    t.forEach((tt, i) => {
      const x = g.sx(tt), fixed = i === 0 || i === t.length - 1;
      ctx.strokeStyle = C.dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"; ctx.lineWidth = 1; line(ctx, x, g.axisY, x, g.hy - 9);
      ctx.beginPath(); ctx.arc(x, g.hy, fixed ? 5 : g.wide ? 8 : 6, 0, 6.283);
      ctx.fillStyle = fixed ? C.panel : lineColor(ST.line); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = SAW.drag === i ? 2.6 : 1.3; ctx.stroke();
    });
    text(ctx, "drag the trains", g.x0, g.hy + 24, 12, C.muted, "left", 500);
    const Wn = WIN[ST.win], step = (Wn.b - Wn.a) > 4 * 3600 ? 3600 : 1800;
    for (let tt = Math.ceil(Wn.a / step) * step; tt <= Wn.b; tt += step) tlab(ctx, hhmm(tt).replace(":00", ""), g.sx(tt), g.axisY + 15, 11.5, C.muted, 500, 0, g.x1 + 30);
    $("ro-saw").innerHTML =
      '<div class="ro wait"><div class="v">' + fmt(st.EW, 2) + '</div><div class="k">' + (looking ? "average time since the last train" : "average wait, minutes") + '</div></div>' +
      '<div class="ro trains"><div class="v">' + fmt(st.half, 2) + '</div><div class="k">half the average gap</div></div>' +
      '<div class="ro"><div class="v">×' + fmt(st.EW / st.half, 2) + '</div><div class="k">' + M`1 + \mathrm{CV}^2` + ', with CV = ' + fmt(st.cv, 3) + '</div></div>' +
      '<div class="ro"><div class="v">' + fmt(st.mu, 2) + '</div><div class="k">average gap (never changes here)</div></div>';
    $("saw-key").textContent = looking ? "time since the last train, if you arrived at that moment" : "wait if you arrived at that moment";
    $("n-saw").innerHTML = SAW.backOn ? "Looking back gives the same average as looking ahead: " + fmt(st.EW, 2) + " min since the last train, " + fmt(st.EW, 2) + " min until the next. Together they make the gap you are standing in, which averages " + fmt(2 * st.EW, 2) + " min, not " + fmt(st.mu, 2) + "." : "";
  }
  onDrag($("cv-saw"), {
    down: (p) => {
      const cv = $("cv-saw"), g = sawGeo(cv._w, cv._h); let best = -1, bd = 16;
      SAW.t.forEach((tt, i) => { if (i === 0 || i === SAW.t.length - 1) return; const d = Math.abs(g.sx(tt) - p.x); if (d < bd && p.y > g.top) { bd = d; best = i; } });
      if (best < 0) return false; SAW.drag = best; drawSaw();
    },
    move: (p) => { const cv = $("cv-saw"), g = sawGeo(cv._w, cv._h), i = SAW.drag; SAW.t[i] = clamp(g.tx(p.x), SAW.t[i - 1] + 20, SAW.t[i + 1] - 20); drawSaw(); },
    up: () => { SAW.drag = -1; drawSaw(); }
  });
  function sawTo(target) { const from = SAW.t.slice(), o = { k: 0 }; tween(o, { k: 1 }, 700, () => { SAW.t = from.map((v, i) => lerp(v, target[i], o.k)); drawSaw(); }); }
  $("saw-even").addEventListener("click", () => { const t = SAW.t, n = t.length - 1, a = t[0], b = t[n]; sawTo(t.map((_, i) => a + (b - a) * i / n)); });
  $("saw-bunch").addEventListener("click", () => { const t = SAW.t, n = t.length - 1, a = t[0], b = t[n], d = (b - a) / n; sawTo(t.map((_, i) => (i === 0 || i === n ? t[i] : i % 2 ? a + (i - 1) * d + 0.18 * d : a + i * d))); });
  $("saw-reset").addEventListener("click", () => sawTo(SAW.t0.slice()));
  $("saw-back").addEventListener("click", () => { SAW.backOn = !SAW.backOn; $("saw-back").setAttribute("aria-pressed", SAW.backOn); tween(SAW, { back: SAW.backOn ? 1 : 0 }, 900, drawSaw); });

  // ---------- the three distributions on one axis ----------
  function kde(h, xs) {
    const n = h.length, mu = h.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(h.reduce((a, b) => a + (b - mu) ** 2, 0) / n);
    const iqr = quant(h, 0.75) - quant(h, 0.25), bw = 0.9 * Math.min(sd, iqr / 1.34 || sd) * Math.pow(n, -0.2), k = 1 / (n * bw * Math.sqrt(2 * Math.PI));
    return xs.map((x) => { let s = 0; for (const v of h) { const a = (x - v) / bw, b = (x + v) / bw; s += Math.exp(-0.5 * a * a) + Math.exp(-0.5 * b * b); } return s * k; });   // reflected at 0
  }
  // three densities on one axis: the gaps (steel), the gap a rider lands in (platform yellow), the rider's wait (LED)
  function dens3(ctx, W, H, xs, f, fb, fw, xmax, ymax, marks) {
    const x0 = 46, x1 = W - 12, axisY = H - 40, sx = (v) => x0 + v / xmax * (x1 - x0);
    // the three averages are labelled above the plot; a label slides right, or drops a row, to dodge its neighbours
    const { put, rows } = placeLabels(ctx, marks.filter(([v]) => v <= xmax), sx, x0, x1, 13);
    const top = 13 + 16 * rows + 10, sy = (v) => axisY - Math.min(v, ymax * 1.03) / ymax * (axisY - top);
    const yst = niceStep(ymax, 4), yt = []; for (let v = 0; v <= ymax + 1e-9; v += yst) yt.push(v);
    yGrid(ctx, x0, x1, yt, sy, (v) => v.toFixed(yst < 0.1 ? 2 : 1));
    ctx.save(); ctx.beginPath(); ctx.rect(x0, top - 8, x1 - x0, axisY - top + 8); ctx.clip();
    const path = (ys) => { ctx.beginPath(); xs.forEach((x, i) => { if (i) ctx.lineTo(sx(x), sy(ys[i])); else ctx.moveTo(sx(x), sy(ys[i])); }); };
    const fill = (ys, style, a) => { path(ys); ctx.lineTo(sx(xs[xs.length - 1]), axisY); ctx.lineTo(sx(xs[0]), axisY); ctx.closePath(); ctx.globalAlpha = a; ctx.fillStyle = style; ctx.fill(); ctx.globalAlpha = 1; };
    const yel = C.dark ? C.edge : "#8a6a00";
    fill(f, C.steel, C.dark ? 0.2 : 0.18); fill(fb, pattern(ctx, "riders"), 0.5); fill(fw, pattern(ctx, "wait"), 0.85);
    [[f, C.steel, 2.2], [fb, yel, 2.2], [fw, C.led, 2.8]].forEach(([ys, col, lw]) => { path(ys); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.stroke(); });
    ctx.restore();
    const xst = niceStep(xmax, W < 500 ? 5 : 8), xt = []; for (let v = 0; v <= xmax + 1e-9; v += xst) xt.push(v);
    xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v));
    text(ctx, "minutes", x1, axisY + 30, 12, C.muted, "right", 500);
    put.forEach((p) => { ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = p.col; ctx.lineWidth = 1.5; line(ctx, p.x, p.ly + 4, p.x, axisY); ctx.restore(); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, axisY, 4, 0, 6.283); ctx.fill(); });
    put.forEach((p) => halo(ctx, p.lab, p.lx, p.ly, 12.5, p.col, "left", 760));
  }
  function drawThree() {
    const cv = $("cv-three"), { ctx, W, H } = fit(cv, 310), h = pooled(ST.line, ST.dir, ST.win), s = stats(h); if (!s) return;
    const xmax = Math.ceil(quant(h, 0.99) * 1.08 + 1), N = 260, xs = Array.from({ length: N + 1 }, (_, i) => xmax * i / N);
    const f = kde(h, xs), fb = xs.map((x, i) => x * f[i]); const zb = fb.reduce((a, b) => a + b, 0) * (xmax / N); for (let i = 0; i <= N; i++) fb[i] /= zb;
    const fw = xs.map((x) => { let c = 0; for (const v of h) if (v > x) c++; return c / (h.length * s.mu); });
    caption(cv, cap(daysWord(ST.win)) + " " + WINPHRASE[ST.win] + ", " + s.n + " gaps. Height = probability per minute.");
    dens3(ctx, W, H, xs, f, fb, fw, xmax, Math.max(...f, ...fb, ...fw) * 1.08,
      [[s.EW, "your wait " + fmt(s.EW), C.led], [s.mu, "gap " + fmt(s.mu), C.steel], [s.EL, "your gap " + fmt(s.EL), C.dark ? C.edge : "#8a6a00"]]);
    $("f-three").innerHTML = MD`E[W] = \frac{E[L]}{2} = \frac{E[H^2]}{2E[H]} = \frac{\mu}{2}\bigl(1 + \mathrm{CV}^2\bigr)` + ' <span class="fnum">&nbsp;=&nbsp; ' + M`\frac{${fmt(s.mu, 2)}}{2}(1 + ${fmt(s.cv, 3)}^2) = ${fmt(s.EW, 2)}` + " min</span>";
    $("n-three").innerHTML = "Here <i>H</i> is a gap between trains, with average " + M`\mu` + "; <i>L</i> is the gap a random rider lands in; <i>W</i> is that rider's wait. The wait has density " + M`P(H > w)/\mu` + ", which never increases with <i>w</i>: <b>no wait is more likely than a short one</b>. So the orange is not the yellow squeezed in half; the cloud below shows why.";
  }

  // ---------- the algebra behind the three curves, and behind giving up (written once) ----------
  const FD = (s) => '<div class="formula">' + s + "</div>", FP = (a, b) => '<div class="fpair">' + FD(a) + FD(b) + "</div>", NW = (s) => s.replace(/(<math(?:(?!<\/math>)[\s\S])*<\/math>)([.,;:)]+)/g, '<span class="nw">$1$2</span>');
  $("d-three-b").innerHTML = NW([
    "<p>Grey " + M`H` + " is a gap between trains, with density " + M`f` + ", average " + M`\mu` + " and survival curve " + M`S(x) = P(H > x)` + ". The one assumption about riders: each arrives at a moment chosen uniformly at random over a long run of trains, without looking at them.</p>",
    "<h4>Yellow is grey, size-biased</h4>",
    "<p>Gaps of length near " + M`\ell` + " cover a share " + M`\ell f(\ell)\,d\ell/\mu` + " of all the time, and that is the chance a random moment lands in one. Each gap is sampled in proportion to its length.</p>",
    FP(MD`f_L(\ell) = \frac{\ell\,f(\ell)}{\mu}`, MD`E[L] = \frac{E[H^2]}{\mu} = \mu\bigl(1 + \mathrm{CV}^2\bigr)`),
    "<h4>Orange is a uniform slice of yellow</h4>",
    "<p>Inside the gap it lands in, the rider's spot is uniform: " + M`W = U L` + ", with " + M`U \sim \mathrm{Uniform}(0,1)` + " independent of " + M`L` + ". Average over " + M`L` + ", and the " + M`\ell` + " that size bias put in cancels the " + M`1/\ell` + " from the uniform:</p>",
    FD(MD`f_W(w) = \int_w^\infty \frac{1}{\ell}\,\frac{\ell\,f(\ell)}{\mu}\,d\ell = \frac{S(w)}{\mu}`),
    "<p>Orange is grey's survival curve divided by " + M`\mu` + ": it starts at " + M`1/\mu` + " and never rises. Its moments are grey's, one power up:</p>",
    FP(MD`E[W^n] = E[U^n]\,E[L^n] = \frac{E[H^{n+1}]}{(n+1)\,\mu}`, MD`E[W] = \frac{E[L]}{2} = \frac{\mu}{2}\bigl(1 + \mathrm{CV}^2\bigr)`),
    "<h4>Why orange is not yellow, halved</h4>",
    "<p>" + M`L/2` + " has the same average as " + M`W` + ", but not the same spread: " + M`E[W^2] = E[L^2]/3` + ", while " + M`E[(L/2)^2] = E[L^2]/4` + ". Halving keeps yellow's shape. Multiplying by " + M`U` + " spreads each gap's riders evenly from zero up to the whole gap, as the cloud below shows.</p>",
    "<h4>Read backwards: the gap, given your wait</h4>",
    "<p>The pair " + M`(L, W)` + " has density " + M`f(\ell)/\mu` + " on " + M`0 < w < \ell` + ": within a gap, every wait is equally likely. Hold the wait fixed instead, and the gap is an ordinary gap that happens to be longer than it:</p>",
    FD(MD`L \mid W = w \;\sim\; H \mid H > w`),
    "<p>The time since the last train, " + M`A = L - W` + ", has joint density " + M`f(a + w)/\mu` + " with " + M`W` + ", symmetric in " + M`a` + " and " + M`w` + ". So " + M`A \eqd W` + ": looking back is the same as looking ahead (the <i>Look back instead</i> button above).</p>",
    "<h4>The two textbook ends</h4>",
    "<p>Clockwork, " + M`H = \mu` + " always: " + M`L = \mu` + " and " + M`W \sim \mathrm{Uniform}(0, \mu)` + ", so " + M`E[W] = \mu/2` + ". Exponential gaps: " + M`S(w)/\mu = e^{-w/\mu}/\mu = f(w)` + ", so " + M`W \eqd H` + " and " + M`E[W] = \mu` + ". No other gap law does this: " + M`W \eqd H` + " means " + M`f = S/\mu` + ", that is " + M`S\prime = -S/\mu` + ".</p>",
    "<p>None of this needs the gaps to be independent. Over any stretch of track with gaps " + M`h_1, \ldots, h_n` + ", the wait averaged over every moment is exactly " + M`\sum h_i^2 / (2 \sum h_i)` + "; the formulas above are what that becomes over many days.</p>",
  ].join(""));
  $("d-gu-b").innerHTML = NW([
    "<p>Having waited " + M`t` + " minutes means " + M`W > t` + ". Using " + M`P(W > t) = E[(H-t)_+]/\mu` + " from the density of " + M`W` + ", the wait still ahead and the train's chance per minute are</p>",
    FD(MD`m(t) = E[W - t \mid W > t] = \frac{E[(H-t)_+^2]}{2\,E[(H-t)_+]}`),
    FD(MD`h(t) = \frac{f_W(t)}{P(W > t)} = \frac{1}{E[H - t \mid H > t]}`),
    "<p>The chance per minute is one over a <i>gap's</i> expected remaining length. At " + M`t = 0` + ": " + M`m(0) = E[W] = \frac{\mu}{2}(1 + \mathrm{CV}^2)` + ", which depends on the unevenness (" + M`\mu/2` + " for clockwork, " + M`\mu` + " for Poisson), while " + M`h(0) = 1/\mu` + " for every gap law with average " + M`\mu` + ". That is why the expected-wait curves start apart and the chance-per-minute curves start together.</p>",
    "<h4>The rule</h4>",
    "<p>Plan: wait up to " + M`\tau` + " minutes, then take the fallback, which gets you there " + M`c` + " minutes later than a train arriving at that instant would. Counting minutes on the platform, plus " + M`c` + " if you give up:</p>",
    FP(MD`g(\tau) = E[\min(W, \tau)] + c\,P(W > \tau)`, MD`g\prime(\tau) = P(W > \tau)\,\bigl(1 - c\,h(\tau)\bigr)`),
    "<p>The expected cost falls while " + M`h(\tau) > 1/c` + " and rises while " + M`h(\tau) < 1/c` + ": one more minute costs a minute and, with chance about " + M`h(\tau)` + ", saves " + M`c` + ". Taking the fallback at once costs " + M`g(0) = c` + "; never giving up costs " + M`g(\infty) = E[W]` + ". The page minimises " + M`g` + " on a fine grid, up to the point where only a few gaps are longer, and compares the result with both.</p>",
    "<p><b>A consequence.</b> If " + M`h` + " never falls below its starting value " + M`1/\mu` + " (true on most lines here) and the fallback costs more than an average gap, " + M`c > \mu` + ", then " + M`h > 1/c` + " throughout: " + M`g` + " only falls, and you should never give up.</p>",
  ].join(""));

  // =====================================================================
  // CLOCKWORK TO CHAOS: gamma-distributed gaps with the same mean
  // =====================================================================
  function lnGamma(z) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
  function gammaQ(a, x) {   // upper regularized incomplete gamma Q(a, x)
    if (x <= 0) return 1;
    const gln = lnGamma(a);
    if (x < a + 1) { let ap = a, sum = 1 / a, del = sum; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; } return 1 - sum * Math.exp(-x + a * Math.log(x) - gln); }
    let b = x + 1 - a, c = 1e300, d = 1 / b, hh = d;
    for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; hh *= del; if (Math.abs(del - 1) < 1e-12) break; }
    return Math.exp(-x + a * Math.log(x) - gln) * hh;
  }
  const gpdf = (x, k, th) => (x <= 0 ? 0 : Math.exp((k - 1) * Math.log(x) - x / th - lnGamma(k) - k * Math.log(th)));
  const CHAOS = { cv: 0.5, user: false };
  function drawChaos() {
    const s = S(); if (!s) return;
    if (!CHAOS.user) CHAOS.cv = clamp(s.cv, 0.05, 1.5);
    $("chaos-cv").value = CHAOS.cv; $("chaos-cv-v").textContent = CHAOS.cv.toFixed(2);
    const mu = s.mu, cvv = CHAOS.cv, k = 1 / (cvv * cvv), th = mu / k;
    const cv = $("cv-chaos"), { ctx, W, H } = fit(cv, 300);
    const xmax = mu * Math.min(5, 1.6 + 3.2 * cvv), N = 320, xs = Array.from({ length: N + 1 }, (_, i) => xmax * i / N);
    const f = xs.map((x) => gpdf(x, k, th)), fb = xs.map((x) => gpdf(x, k + 1, th)), fw = xs.map((x) => gammaQ(k, x / th) / mu);
    const cap = Math.max(...fw) * 3.2, ymax = Math.min(Math.max(...f, ...fb, ...fw), cap) * 1.08;
    caption(cv, "Average gap held at " + fmt(mu) + " min (your line). Only the unevenness changes.");
    const EL = mu * (1 + cvv * cvv), EW = EL / 2;
    dens3(ctx, W, H, xs, f, fb, fw, xmax, ymax, [[EW, "your wait " + fmt(EW), C.led], [mu, "gap " + fmt(mu), C.steel], [EL, "your gap " + fmt(EL), C.dark ? C.edge : "#8a6a00"]]);
    $("ro-chaos").innerHTML =
      '<div class="ro trains"><div class="v">' + fmt(mu, 2) + '</div><div class="k">average gap</div></div>' +
      '<div class="ro riders"><div class="v">' + fmt(EL, 2) + '</div><div class="k">the gap you land in</div></div>' +
      '<div class="ro wait"><div class="v">' + fmt(EW, 2) + '</div><div class="k">your wait</div></div>';
    const n = Math.abs(cvv - 1) < 0.015 ? "Exponential gaps: the trains have no memory. The gap you land in averages <b>twice</b> the average gap, and your average wait is one whole average gap. This is the Poisson case."
      : cvv < 0.2 ? "Close to clockwork: every gap is nearly the same, so your average wait is close to half a gap."
      : cvv > 1 ? "More uneven than random arrivals: bunched trains followed by long holes. Your average wait is now longer than an average gap."
      : "These gaps follow a gamma distribution with CV " + cvv.toFixed(2) + ". For gaps of any shape the average wait is " + M`\frac{\mu}{2}(1 + \mathrm{CV}^2)` + ": only the mean and the CV matter.";
    $("n-chaos").innerHTML = n;
    const gs = stats(pooled("GS", "N", ST.win));
    $("chaos-marks").innerHTML = "";
    [["Shuttle", gs ? gs.cv : 0.15], ["Your line", s.cv], ["Poisson", 1]].forEach(([lab, v]) => {
      const b = document.createElement("button"); b.className = "btn"; b.type = "button"; b.textContent = lab + " (CV " + v.toFixed(2) + ")";
      b.addEventListener("click", () => { const o = { v: CHAOS.cv }; CHAOS.user = true; tween(o, { v: clamp(v, 0.05, 1.5) }, 600, () => { CHAOS.cv = o.v; drawChaos(); }); });
      $("chaos-marks").appendChild(b);
    });
  }
  $("chaos-cv").addEventListener("input", (e) => { CHAOS.user = true; CHAOS.cv = +e.target.value; drawChaos(); });

  // =====================================================================
  // SHOULD YOU GIVE UP?
  // after waiting t: expected further wait m(t) = E[((X-t)+)^2] / (2 E[(X-t)+])
  // the train's chance per minute (hazard of the wait): h(t) = P(X > t) / E[(X-t)+] = 1 / E[X - t | X > t]
  // =====================================================================
  const GU = { t: 0, c: 10, key: "", boot: null };
  // gaps sorted, with suffix sums: every quantity at t is one binary search away
  function tailer(h) {
    const a = Float64Array.from(h).sort(), n = a.length, s1 = new Float64Array(n + 1), s2 = new Float64Array(n + 1);
    for (let i = n - 1; i >= 0; i--) { s1[i] = s1[i + 1] + a[i]; s2[i] = s2[i + 1] + a[i] * a[i]; }
    const tot = s1[0], at = (t) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= t) lo = m + 1; else hi = m; } const k = n - lo; return { k, e1: s1[lo] - t * k, e2: s2[lo] - 2 * t * s1[lo] + t * t * k }; };
    return { n, tot, EW: s2[0] / (2 * tot),
      mres: (t) => { const q = at(t); return q.e1 > 1e-12 ? q.e2 / (2 * q.e1) : NaN; },
      haz: (t) => { const q = at(t); return q.e1 > 1e-12 ? q.k / q.e1 : NaN; },
      surv: (t) => at(t).e1 / tot };
  }
  function mres(h, t) { let a = 0, b = 0; for (const x of h) { const d = x - t; if (d > 0) { a += d * d; b += d; } } return b > 0 ? a / (2 * b) : NaN; }
  // stop while a dozen or so gaps are still longer than t; past that, a handful of gaps would be doing the talking
  function guRange(h) {
    const a = Array.from(h).sort((x, y) => y - x), k = Math.max(6, Math.min(12, Math.round(h.length * 0.04)));
    return Math.max(1, Math.floor((a[Math.min(k, a.length) - 1] - 0.05) * 10) / 10);
  }
  // the same gaps, kept day by day, so the days can be resampled
  function pooledDays(r, d, w) {
    const per = SER[r][d], out = []; if (!per) return out;
    DAYINFO.forEach((di, k) => {
      if (!di.weekday || (w === "late" && !di.earlyOk)) return;
      const p = per[k], W = WIN[w], g = [];
      for (let i = 0; i + 1 < p.t.length; i++) { if (p.brk.has(i)) continue; if (p.t[i] >= W.a && p.t[i + 1] <= W.b) g.push((p.t[i + 1] - p.t[i]) / 60); }
      if (g.length) out.push(g);
    });
    return out;
  }
  // how much the curves move when the ten days are resampled with replacement (a 90% band)
  function guBoot(ts) {
    const key = ST.line + ST.dir + ST.win + ts.length + ts[ts.length - 1]; if (GU.key === key && GU.boot) return GU.boot; GU.key = key;
    const days = pooledDays(ST.line, ST.dir, ST.win), B = 200, rng = mulberry(31), M = [], Hz = [];
    for (let b = 0; b < B && days.length > 1; b++) {
      const g = []; for (let i = 0; i < days.length; i++) { for (const v of days[Math.floor(rng() * days.length)]) g.push(v); }
      const T = tailer(g); M.push(ts.map(T.mres)); Hz.push(ts.map(T.haz));
    }
    const band = (R) => ts.map((_, i) => { const v = R.map((r) => r[i]).filter(Number.isFinite).sort((a, b) => a - b); return v.length < Math.max(20, R.length * 0.6) ? null : [v[Math.floor(0.05 * (v.length - 1))], v[Math.ceil(0.95 * (v.length - 1))]]; });
    return (GU.boot = { m: band(M), h: band(Hz) });
  }
  // the plan "wait up to tau minutes, then give up" costs E[min(W, tau)] + c P(W > tau); never giving up costs E[W]
  function guPlan(T, tmax, c) {
    const N = 400, dt = tmax / N; let cum = 0, best = c, tau = 0, prev = T.surv(0);
    for (let i = 1; i <= N; i++) { const t = i * dt, sv = T.surv(t); cum += 0.5 * (prev + sv) * dt; prev = sv; const g = cum + c * sv; if (g < best - 1e-9) { best = g; tau = t; } }
    if (T.EW <= best + 0.05) return { kind: "never", cost: T.EW, EW: T.EW };
    if (tau === 0) return { kind: "walk", cost: c, EW: T.EW };
    if (tau >= tmax - 1.5 * dt) return { kind: "never", cost: T.EW, EW: T.EW, edge: true };
    return { kind: "quit", tau, cost: best, EW: T.EW };
  }

  // ---------- a countdown clock, in a 5-by-7 dot font like the platform signs ----------
  const LEDF = {
    "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.|.....", "1": "..#..|.##..|..#..|..#..|..#..|..#..|.###.|.....", "2": ".###.|#...#|....#|...#.|..#..|.#...|#####|.....",
    "3": "#####|...#.|..#..|...#.|....#|#...#|.###.|.....", "4": "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.|.....", "5": "#####|#....|####.|....#|....#|#...#|.###.|.....",
    "6": "..##.|.#...|#....|####.|#...#|#...#|.###.|.....", "7": "#####|....#|...#.|..#..|.#...|.#...|.#...|.....", "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.|.....",
    "9": ".###.|#...#|#...#|.####|....#|...#.|.##..|.....", ".": "..|..|..|..|..|##|##|..", ":": "..|..|##|##|..|##|##|..", "'": "#|#|.|.|.|.|.|.", "-": "....|....|....|####|....|....|....|....", " ": "...|...|...|...|...|...|...|...",
    a: ".....|.....|.###.|....#|.####|#...#|.####|.....", b: "#....|#....|#.##.|##..#|#...#|#...#|####.|.....", c: ".....|.....|.###.|#....|#....|#...#|.###.|.....",
    d: "....#|....#|.##.#|#..##|#...#|#...#|.####|.....", e: ".....|.....|.###.|#...#|#####|#....|.###.|.....", f: "..##.|.#..#|.#...|###..|.#...|.#...|.#...|.....",
    g: ".....|.....|.####|#...#|#...#|.####|....#|.###.", h: "#....|#....|#.##.|##..#|#...#|#...#|#...#|.....", i: ".#.|...|##.|.#.|.#.|.#.|###|...",
    j: "...#|....|..##|...#|...#|...#|#..#|.##.", k: "#...|#...|#..#|#.#.|##..|#.#.|#..#|....", l: "##.|.#.|.#.|.#.|.#.|.#.|###|...",
    m: ".....|.....|##.#.|#.#.#|#.#.#|#.#.#|#...#|.....", n: ".....|.....|#.##.|##..#|#...#|#...#|#...#|.....", o: ".....|.....|.###.|#...#|#...#|#...#|.###.|.....",
    p: ".....|.....|####.|#...#|#...#|####.|#....|#....", q: ".....|.....|.####|#...#|#...#|.####|....#|....#", r: ".....|.....|#.##.|##..#|#....|#....|#....|.....",
    s: ".....|.....|.####|#....|.###.|....#|####.|.....", t: ".#..|.#..|###.|.#..|.#..|.#.#|..#.|....", u: ".....|.....|#...#|#...#|#...#|#..##|.##.#|.....",
    v: ".....|.....|#...#|#...#|#...#|.#.#.|..#..|.....", w: ".....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.|.....", x: ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#|.....",
    y: ".....|.....|#...#|#...#|#...#|.####|....#|.###.", z: ".....|.....|#####|...#.|..#..|.#...|#####|....."
  };
  function ledGlyphs(s) { // lit dots of a string, and its width in dots
    const on = []; let x = 0;
    for (const ch of s) { const g = (LEDF[ch] || LEDF[" "]).split("|"); g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === "#") on.push([x + i, j]); }); x += g[0].length + 1; }
    return { on, w: Math.max(0, x - 1) };
  }
  const RASTER = new Map();
  function ledRaster(s, fh) {
    const key = s + "|" + fh; if (RASTER.has(key)) return RASTER.get(key);
    const o = document.createElement("canvas"), g = o.getContext("2d"), font = "700 " + fh + "px Archivo, Arial, sans-serif";
    g.font = font; const w = Math.ceil(g.measureText(s).width) + 2; o.width = w; o.height = Math.ceil(fh * 1.3);
    g.font = font; g.fillStyle = "#fff"; g.textBaseline = "top"; g.fillText(s, 1, 1);
    const d = g.getImageData(0, 0, o.width, o.height).data, on = [];
    for (let j = 0; j < o.height; j++) for (let i = 0; i < o.width; i++) if (d[(j * o.width + i) * 4 + 3] > 110) on.push([i, j]);
    const R = { w, h: o.height, on }; if (RASTER.size > 400) RASTER.clear(); RASTER.set(key, R); return R;
  }
  function drawLed(T, plan) {
    const m = T.mres(GU.t), cv = $("cv-led"), wrap = Math.max(220, cv.parentElement.clientWidth - 36);
    // three lines: how long you have waited, how much longer to expect, and what to do
    const adv = !plan ? ["", ""] : plan.kind === "walk" ? ["walk now", "#ff5a4a"] : plan.kind === "never" ? ["keep waiting", "#46d36f"] : GU.t >= plan.tau - 1e-9 ? ["give up now", "#ff5a4a"] : ["give up at " + plan.tau.toFixed(1), "#ffb02a"];
    const rowsTxt = [["waited", GU.t.toFixed(1) + " min", "#ff8a2a"], ["expect", Number.isFinite(m) ? m.toFixed(1) + " more" : "no data", "#ffb02a"], ["plan", adv[0], adv[1]]];
    const G = rowsTxt.map(([a, b]) => [ledGlyphs(a), ledGlyphs(b)]), need = 34 + Math.max(...G.map((g) => g[0].w)) + 6 + Math.max(...G.map((g) => g[1].w)) + 2;
    const cell = clamp(wrap / Math.max(need, 150), 1.5, 4.4), rowsN = 30, H = Math.round(cell * rowsN);
    const dpr = DPR(); cv.width = Math.round(wrap * dpr); cv.height = Math.round(H * dpr); cv.style.width = wrap + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, wrap, H);
    const cols = Math.floor(wrap / cell), r = cell * 0.37, P = (i, j) => [(i + 0.5) * cell, (j + 0.5) * cell];
    const dots = (list, col, glow) => { ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = glow ? cell * 1.3 : 0; ctx.beginPath(); list.forEach(([i, j]) => { const [x, y] = P(i, j); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.283); }); ctx.fill(); ctx.shadowBlur = 0; };
    const lit = new Set(), key = (i, j) => i * 1000 + j;
    // the route bullet, in dots, with its letter left dark
    const bc = 15, bj = 14.5, br = 14, letter = ledRaster(sym(ST.line), 17), li = Math.round(bc - letter.w / 2), lj = Math.round(bj - letter.h / 2) + 1, dark = new Set(letter.on.map(([i, j]) => key(i + li, j + lj))), bullet = [];
    for (let j = 0; j < rowsN; j++) for (let i = 0; i < 31; i++) if ((i - bc) ** 2 + (j - bj) ** 2 <= br * br && !dark.has(key(i, j))) { bullet.push([i, j]); lit.add(key(i, j)); }
    const lines = [];
    rowsTxt.forEach(([, , col], k) => {
      const j0 = 1 + k * 10, [A, B] = G[k], ia = 34, ib = Math.max(ia + A.w + 6, cols - B.w - 1), pts = [];
      A.on.forEach(([i, j]) => { pts.push([i + ia, j + j0]); lit.add(key(i + ia, j + j0)); });
      B.on.forEach(([i, j]) => { pts.push([i + ib, j + j0]); lit.add(key(i + ib, j + j0)); });
      lines.push([pts, col]);
    });
    const off = []; for (let j = 0; j < rowsN; j++) for (let i = 0; i < cols; i++) if (!lit.has(key(i, j))) off.push([i, j]);
    dots(off, "rgba(255,122,26,.07)", false);
    dots(bullet, lineColor(ST.line), true);
    lines.forEach(([pts, col]) => dots(pts, col, true));
    $("led-sr").textContent = "After waiting " + GU.t.toFixed(1) + " minutes, expect " + (Number.isFinite(m) ? m.toFixed(1) : "–") + " more minutes. " + (adv[0] ? "Plan: " + adv[0] + "." : "");
  }

  // ---------- the expected further wait, with the two textbook extremes for the same average gap ----------
  function drawGiveup() {
    const h = pooled(ST.line, ST.dir, ST.win), s = stats(h); if (!s) return;
    const T = tailer(h), tmax = guRange(h); $("gu-t").max = tmax; GU.t = Math.min(GU.t, tmax); $("gu-t").value = GU.t; $("gu-t-v").textContent = GU.t.toFixed(1) + " min";
    const N = 240, ts = Array.from({ length: N + 1 }, (_, i) => tmax * i / N), ms = ts.map(T.mres), boot = guBoot(ts), plan = guPlan(T, tmax, GU.c);
    drawLed(T, plan);
    $("gu-keys").innerHTML = '<span><i class="sw solid-led"></i>' + lcPhrase(ST.line, ST.dir).replace(/^the /, "") + ", real gaps: starts at " + fmt(s.EW) + "</span>" +
      '<span><i class="sw dash steel"></i>clockwork, every gap exactly ' + fmt(s.mu) + " min: starts at half, " + fmt(s.mu / 2) + "</span>" +
      '<span><i class="sw dot"></i>Poisson, random gaps averaging ' + fmt(s.mu) + " min: stays at " + fmt(s.mu) + "</span>";
    const cv = $("cv-giveup"), { ctx, W, H } = fit(cv, 270);
    caption(cv, "Expected further wait, by how long you have already waited. Shading: how far the curve moves when the " + (NUMW[WEEKDAYS_N] || WEEKDAYS_N) + " days are resampled.");
    const ymax = Math.max(s.mu * 1.08, ...ms.filter(Number.isFinite)) * 1.12;
    const x0 = 50, x1 = W - 12, top = 12, axisY = H - 44, sx = (v) => x0 + v / tmax * (x1 - x0), sy = (v) => axisY - Math.min(v, ymax) / ymax * (axisY - top);
    const yst = niceStep(ymax, 4), yt = []; for (let v = 0; v <= ymax + 1e-9; v += yst) yt.push(v);
    yGrid(ctx, x0, x1, yt, sy, (v) => v + " min");
    // the band from resampled days
    const band = (B, f) => { ctx.beginPath(); let on = false; const pts = []; ts.forEach((t, i) => { if (B[i]) pts.push([t, B[i]]); }); if (pts.length < 2) return; pts.forEach(([t, b], i) => (i ? ctx.lineTo(sx(t), sy(b[1])) : ctx.moveTo(sx(t), sy(b[1])))); for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(sx(pts[i][0]), sy(pts[i][1][0])); ctx.closePath(); ctx.fillStyle = f; ctx.fill(); };
    band(boot.m, rgba(C.rgb.led, C.dark ? 0.2 : 0.16));
    // the two textbook extremes
    ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = C.steel; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(0), sy(s.mu / 2)); ctx.lineTo(sx(Math.min(s.mu, tmax)), sy(Math.max(0, (s.mu - Math.min(s.mu, tmax)) / 2))); ctx.stroke();
    ctx.setLineDash([2, 4]); ctx.strokeStyle = C.ink; line(ctx, sx(0), sy(s.mu), sx(tmax), sy(s.mu)); ctx.restore();
    halo(ctx, "clockwork", sx(Math.min(s.mu, tmax) * 0.62) + 4, sy((s.mu - Math.min(s.mu, tmax) * 0.62) / 2) - 9, 12, C.steel, "left", 650);
    halo(ctx, "Poisson", sx(tmax) - 4, sy(s.mu) - 7, 12, C.ink, "right", 650);
    // where you started: the expected wait the moment you arrived
    let tmin = 0, vmin = Infinity; ts.forEach((t, i) => { if (ms[i] < vmin) { vmin = ms[i]; tmin = t; } });
    let tcross = NaN; for (let i = 1; i < ts.length; i++) if (ts[i] > tmin && ms[i] > ms[0]) { tcross = ts[i]; break; }
    ctx.save(); ctx.setLineDash([1, 3]); ctx.strokeStyle = C.led; ctx.lineWidth = 1.4; line(ctx, sx(0), sy(ms[0]), Number.isFinite(tcross) ? sx(tcross) : x1, sy(ms[0])); ctx.restore();
    ctx.beginPath(); let on = false; ts.forEach((t, i) => { const v = ms[i]; if (!Number.isFinite(v)) return; if (on) ctx.lineTo(sx(t), sy(v)); else { ctx.moveTo(sx(t), sy(v)); on = true; } });
    ctx.strokeStyle = C.led; ctx.lineWidth = 3.4; ctx.lineJoin = "round"; ctx.stroke();
    // the three starting points: the inspection paradox, read off at t = 0
    [[s.mu / 2, C.steel], [ms[0], C.led], [s.mu, C.ink]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx(0), sy(v), 4.5, 0, 6.283); ctx.fill(); });
    if (Number.isFinite(tcross)) {
      const x = sx(tcross), y = sy(ms[0]); ctx.strokeStyle = C["led-deep"]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.283); ctx.stroke();
      halo(ctx, "worse off than when you arrived", x + 10, y + 18, 12, C["led-deep"], x > (x0 + x1) / 2 ? "right" : "left", 680);
    }
    const xst = niceStep(tmax, 8), xt = []; for (let v = 0; v <= tmax + 1e-9; v += xst) xt.push(v);
    xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v));
    text(ctx, "minutes already waited", x1, axisY + 30, 12, C.muted, "right", 500);
    const mt = T.mres(GU.t);
    if (Number.isFinite(mt)) { const x = sx(GU.t), y = sy(mt); ctx.fillStyle = C.led; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 6.283); ctx.fill(); ctx.stroke(); }
    const rises = ms.some((v, i) => ts[i] > tmin && v > vmin + 0.15), dip = tmin > 0.3;
    let tback = NaN; if (Number.isFinite(tcross)) for (let i = 0; i < ts.length; i++) if (ts[i] > tcross + 0.5 && ms[i] < ms[0]) { tback = ts[i]; break; }
    const why = "a long wait is evidence that you are in one of the long gaps";
    let note = "The three curves start apart because of the inspection paradox itself: same average gap, different unevenness. ";
    if (dip && Number.isFinite(tcross)) { const fm = fmt(Math.max(tmin, 0.5), tmin < 1 ? 1 : 0); note += "On the real line the curve dips, then climbs. For about the first " + (fm === "1" ? "minute" : fm + " minutes") + ", the expected further wait shrinks. <b>" + (Number.isFinite(tback) ? "Between about " + fmt(tcross, 0) + " and " + fmt(tback, 0) + " minutes" : "After about " + fmt(tcross, 0) + (fmt(tcross, 0) === "1" ? " minute" : " minutes")) + " it is longer than when you arrived</b>" + (Number.isFinite(tback) ? "" : ", as far as the data reach") + ": " + why + "."; }
    else if (dip && rises) note += "On the real line the curve dips, then climbs: after about " + fmt(tmin, 0) + " minutes, each extra minute of waiting makes the expected further wait longer, because " + why + ".";
    else if (rises) note += "On the real line the curve climbs from the start: the longer you have waited, the longer you should expect to wait, because " + why + ".";
    else note += "On the real line the expected further wait mostly shrinks as you wait.";
    $("n-giveup").innerHTML = note + " Clockwork trains always get closer; Poisson trains never do.";
    drawHazard(T, s, tmax, plan, boot);
  }

  // ---------- when to give up: the train's chance per minute against your fallback ----------
  function drawHazard(T, s, tmax, plan, boot) {
    const c = GU.c, N = 240, ts = Array.from({ length: N + 1 }, (_, i) => tmax * i / N), hs = ts.map(T.haz);
    const cv = $("cv-hazard"), { ctx, W, H } = fit(cv, 270);
    caption(cv, "The chance per minute that the train comes, if it hasn't yet. Above the line, one more minute of waiting is a good bet.");
    const ymax = Math.min(1, Math.max(1.25 / c, ...hs.filter(Number.isFinite), 1 / s.mu) * 1.15);
    const x0 = 50, x1 = W - 12, top = 12, axisY = H - 44, sx = (v) => x0 + v / tmax * (x1 - x0), sy = (v) => axisY - Math.min(v, ymax * 1.02) / ymax * (axisY - top);
    const yst = niceStep(ymax * 100, 4) / 100, yt = []; for (let v = 0; v <= ymax + 1e-9; v += yst) yt.push(v);
    yGrid(ctx, x0, x1, yt, sy, (v) => Math.round(v * 100) + "%");
    // where giving up wins
    if (plan.kind === "quit" || plan.kind === "walk") { const a = plan.kind === "walk" ? 0 : plan.tau; ctx.fillStyle = rgba(C.rgb.led, C.dark ? 0.1 : 0.08); ctx.fillRect(sx(a), top, x1 - sx(a), axisY - top); }
    ctx.save(); ctx.beginPath(); ctx.rect(x0, top - 2, x1 - x0, axisY - top + 2); ctx.clip();
    // band, extremes, real curve
    const pts = []; ts.forEach((t, i) => { if (boot.h[i]) pts.push([t, boot.h[i]]); });
    if (pts.length > 1) { ctx.beginPath(); pts.forEach(([t, b], i) => (i ? ctx.lineTo(sx(t), sy(b[1])) : ctx.moveTo(sx(t), sy(b[1])))); for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(sx(pts[i][0]), sy(pts[i][1][0])); ctx.closePath(); ctx.fillStyle = rgba(C.rgb.led, C.dark ? 0.2 : 0.16); ctx.fill(); }
    ctx.setLineDash([6, 4]); ctx.strokeStyle = C.steel; ctx.lineWidth = 2; ctx.beginPath(); let st = false; ts.forEach((t) => { if (t >= s.mu) return; const v = 1 / (s.mu - t); if (st) ctx.lineTo(sx(t), sy(v)); else { ctx.moveTo(sx(t), sy(v)); st = true; } }); ctx.stroke();
    ctx.setLineDash([2, 4]); ctx.strokeStyle = C.ink; line(ctx, sx(0), sy(1 / s.mu), sx(tmax), sy(1 / s.mu)); ctx.setLineDash([]);
    ctx.beginPath(); let on = false; ts.forEach((t, i) => { const v = hs[i]; if (!Number.isFinite(v)) return; if (on) ctx.lineTo(sx(t), sy(v)); else { ctx.moveTo(sx(t), sy(v)); on = true; } });
    ctx.strokeStyle = C.led; ctx.lineWidth = 3.2; ctx.lineJoin = "round"; ctx.stroke();
    ctx.restore();
    // all three start at 1/mu, whatever the gaps look like
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(sx(0), sy(1 / s.mu), 5, 0, 6.283); ctx.fill(); ctx.fillStyle = C.led; ctx.beginPath(); ctx.arc(sx(0), sy(1 / s.mu), 2.6, 0, 6.283); ctx.fill();
    $("gu-keys2").innerHTML = '<span><i class="sw solid-led"></i>' + lcPhrase(ST.line, ST.dir).replace(/^the /, "") + ", real gaps</span>" +
      '<span><i class="sw dash steel"></i>clockwork: certain by ' + fmt(s.mu) + " min</span>" +
      '<span><i class="sw dot"></i>Poisson: always 1 in ' + fmt(s.mu) + "</span>" +
      '<span><i class="sw solid-ink"></i>your fallback: 1 in ' + fmtC(c) + "</span>";
    // your fallback: 1 in c per minute
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; line(ctx, x0, sy(1 / c), x1, sy(1 / c));
    { const lab = "1 in " + fmtC(c) + " per minute: your fallback", lw = tw(ctx, lab, 12, 700), xt = plan.kind === "quit" && sx(plan.tau) > x1 - lw - 24 ? sx(plan.tau) - 10 : x1 - 4;
      const yp = sy(1 / s.mu), yc = sy(1 / c), yb = yp > yc && yp - yc < 22 ? yp + 15 : yc + 17;
      halo(ctx, lab, xt, xt < x1 - 4 ? yb : yc - 7, 12, C.ink, "right", 700); }
    halo(ctx, "clockwork", sx(Math.min(tmax, s.mu) * 0.7), sy(Math.min(ymax * 0.95, 1 / (s.mu - Math.min(tmax, s.mu) * 0.7))) - 8, 12, C.steel, "center", 650);
    halo(ctx, "Poisson", x0 + 12, sy(1 / s.mu) + (1 / s.mu > ymax * 0.85 ? 16 : -7), 12, C.ink, "left", 650);
    if (plan.kind === "quit") { const x = sx(plan.tau); ctx.strokeStyle = C["led-deep"]; ctx.lineWidth = 2.4; line(ctx, x, top, x, axisY); halo(ctx, "give up at " + fmt(plan.tau) + " min", x - 6, top + 12, 12.5, C["led-deep"], x > (x0 + x1) * 0.6 ? "right" : "left", 760); }
    const xst = niceStep(tmax, 8), xt = []; for (let v = 0; v <= tmax + 1e-9; v += xst) xt.push(v);
    xAxis(ctx, x0, x1, axisY, xt, sx, (v) => String(v));
    text(ctx, "minutes already waited", x1, axisY + 30, 12, C.muted, "right", 500);
    // the note: the rule, and why
    const why = "Each extra minute on the platform costs you a minute, and saves you " + fmtC(c) + " if the train comes in it. So waiting one more minute pays while the train's chance per minute is above 1 in " + fmtC(c) + ".";
    const at0 = T.haz(0), hmin = Math.min(...hs.filter(Number.isFinite)), lowestAtStart = hmin >= at0 * 0.98, above = hs.every((v) => !Number.isFinite(v) || v > 1 / c);
    let n;
    if (plan.kind === "walk") n = "<b>Don't wait: take your fallback now.</b> It costs " + fmtC(c) + " minutes; waiting for this train costs " + fmt(plan.EW, 1) + " on average, and no plan that starts by waiting does better. ";
    else if (plan.kind === "never") n = "<b>Keep waiting, at least for the first " + fmt(tmax) + " minutes.</b> " + why + (above ? " On this line it stays above 1 in " + fmtC(c) + " that whole time." : " On this line it dips below 1 in " + fmtC(c) + " only briefly, too briefly for giving up to pay.") + " Past " + fmt(tmax) + " minutes only a few gaps last longer, too few to judge. ";
    else n = "<b>Give up after about " + fmt(plan.tau) + " minutes.</b> " + why + " On this line, after " + fmt(plan.tau) + " minutes the chance per minute drops below 1 in " + fmtC(c) + ". The rule costs " + fmt(plan.cost, 2) + " minutes on average, against " + fmt(plan.EW, 2) + " if you never give up. ";
    n += "All three curves start at 1 in " + fmt(s.mu) + ": the moment you arrive, only the average gap matters. (The expected waits above start apart because they also depend on the unevenness.)";
    if (lowestAtStart && plan.kind !== "walk") n += " On this line the chance never drops below that start: if waiting was worth starting, it is worth continuing.";
    $("n-hazard").innerHTML = n;
    // every line, same fallback
    const groups = { quit: [], never: [], walk: [] };
    lineSet().forEach((p) => { const hh = pooled(p.r, p.d, ST.win), TT = tailer(hh), pl = guPlan(TT, guRange(hh), c); groups[pl.kind].push([p, pl]); });
    groups.quit.sort((a, b) => a[1].tau - b[1].tau);
    const chip = ([p, pl]) => '<button type="button" class="gu-chip" data-r="' + p.r + '" data-d="' + p.d + '"><span class="bullet sm" style="--bc:' + lineColor(p.r) + ";--bt:" + lineText(p.r) + '">' + sym(p.r) + "</span>" + (DIRSHORT(p.r, p.d) ? '<span class="gu-d">' + DIRSHORT(p.r, p.d) + "</span>" : "") + (pl.kind === "quit" ? '<span class="gu-t">' + fmt(pl.tau) + "</span>" : "") + "</button>";
    $("gu-board").innerHTML = [["quit", "Give up after (minutes)"], ["never", "Keep waiting (as far as the data reach)"], ["walk", "Don't wait at all"]].filter(([k]) => groups[k].length)
      .map(([k, lab]) => '<div class="gu-row"><span class="gu-lab">' + lab + '</span><div class="gu-chips">' + groups[k].map(chip).join("") + "</div></div>").join("");
  }
  const fmtC = (c) => (Math.abs(c - Math.round(c)) < 1e-9 ? String(Math.round(c)) : c.toFixed(1));
  $("gu-board").addEventListener("click", (e) => { const b = e.target.closest(".gu-chip"); if (b) setState({ line: b.dataset.r, dir: b.dataset.d }); });
  $("gu-t").addEventListener("input", (e) => { GU.t = +e.target.value; $("gu-t-v").textContent = GU.t.toFixed(1) + " min"; drawGiveup(); });
  $("gu-c").addEventListener("input", (e) => { GU.c = +e.target.value; $("gu-c-v").textContent = fmtC(GU.c) + " min"; drawGiveup(); });
