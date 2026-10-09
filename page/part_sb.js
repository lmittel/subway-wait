  // =====================================================================
  // THE SIZE-BIAS MACHINE: any distribution on [0, ∞), each value weighted by its own size
  // level L means L presses: density x^L f(x) / E[X^L]
  // =====================================================================
  function erf(x) { const sg = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return sg * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const gammaP = (a, x) => (x <= 0 ? 0 : 1 - gammaQ(a, x));
  const lgam = (z) => lnGamma(z);
  // the families; continuous ones give a density, the moments E[X^n], and the CDF after n presses
  const MXF = {
    line: { lab: "Your line's gaps", kind: "g", ps: [] },
    exp: { lab: "Exponential", kind: "c", ps: [["lam", "Rate λ", 0.2, 3, 0.05, 1]],
      pdf: (x, p) => (x < 0 ? 0 : p.lam * Math.exp(-p.lam * x)), mom: (n, p) => Math.exp(lgam(n + 1)) / Math.pow(p.lam, n), cdf: (x, n, p) => gammaP(1 + n, p.lam * x),
      name: (L) => [String.raw`X \sim \mathrm{Exponential}(\lambda)`, String.raw`X^* \sim \mathrm{Gamma}(2,\ \lambda)`, String.raw`X^{**} \sim \mathrm{Gamma}(3,\ \lambda)`, String.raw`\mathrm{Gamma}(L + 1,\ \lambda)`] },
    gamma: { lab: "Gamma", kind: "c", ps: [["k", "Shape k", 0.3, 8, 0.1, 2], ["lam", "Rate λ", 0.2, 3, 0.05, 1]],
      pdf: (x, p) => (x <= 0 ? 0 : Math.exp((p.k - 1) * Math.log(x) - p.lam * x + p.k * Math.log(p.lam) - lgam(p.k))), mom: (n, p) => Math.exp(lgam(p.k + n) - lgam(p.k)) / Math.pow(p.lam, n), cdf: (x, n, p) => gammaP(p.k + n, p.lam * x),
      name: () => [String.raw`X \sim \mathrm{Gamma}(k,\ \lambda)`, String.raw`X^* \sim \mathrm{Gamma}(k+1,\ \lambda)`, String.raw`X^{**} \sim \mathrm{Gamma}(k+2,\ \lambda)`] },
    lognorm: { lab: "Lognormal", kind: "c", ps: [["m", "Log-mean m", -1, 2, 0.05, 0.5], ["s", "Log-sd s", 0.1, 1.4, 0.02, 0.6]],
      pdf: (x, p) => (x <= 0 ? 0 : Math.exp(-((Math.log(x) - p.m) ** 2) / (2 * p.s * p.s)) / (x * p.s * Math.sqrt(2 * Math.PI))), mom: (n, p) => Math.exp(n * p.m + n * n * p.s * p.s / 2), cdf: (x, n, p) => (x <= 0 ? 0 : Phi((Math.log(x) - p.m - n * p.s * p.s) / p.s)),
      name: () => [String.raw`X \sim \mathrm{Lognormal}(m,\ s^2)`, String.raw`X^* \sim \mathrm{Lognormal}(m + s^2,\ s^2)`, String.raw`X^{**} \sim \mathrm{Lognormal}(m + 2s^2,\ s^2)`] },
    weibull: { lab: "Weibull", kind: "c", ps: [["k", "Shape k", 0.4, 5, 0.05, 1.5], ["lam", "Scale λ", 0.3, 4, 0.05, 1.5]],
      pdf: (x, p) => (x <= 0 ? 0 : (p.k / p.lam) * Math.pow(x / p.lam, p.k - 1) * Math.exp(-Math.pow(x / p.lam, p.k))), mom: (n, p) => Math.pow(p.lam, n) * Math.exp(lgam(1 + n / p.k)), cdf: (x, n, p) => gammaP(1 + n / p.k, Math.pow(Math.max(x, 0) / p.lam, p.k)),
      name: () => [String.raw`X \sim \mathrm{Weibull}(k,\ \lambda)`, String.raw`f^*(x) \propto x^{k} e^{-(x/\lambda)^k}`, String.raw`f^{**}(x) \propto x^{k+1} e^{-(x/\lambda)^k}`] },
    unif: { lab: "Uniform", kind: "c", ps: [["a", "From a", 0, 6, 0.1, 0], ["b", "To b", 0.5, 10, 0.1, 4]],
      fix: (p) => { if (p.b < p.a + 0.3) p.b = Math.min(10, p.a + 0.3); if (p.a > p.b - 0.3) p.a = Math.max(0, p.b - 0.3); },
      lo: (p) => p.a, pdf: (x, p) => (x >= p.a && x <= p.b ? 1 / (p.b - p.a) : 0), mom: (n, p) => (Math.pow(p.b, n + 1) - Math.pow(p.a, n + 1)) / ((n + 1) * (p.b - p.a)), cdf: (x, n, p) => clamp((Math.pow(clamp(x, p.a, p.b), n + 1) - Math.pow(p.a, n + 1)) / (Math.pow(p.b, n + 1) - Math.pow(p.a, n + 1)), 0, 1),
      name: () => [String.raw`X \sim \mathrm{Uniform}(a,\ b)`, String.raw`f^*(x) = \frac{2x}{b^2 - a^2},\ a \le x \le b`, String.raw`f^{**}(x) = \frac{3x^2}{b^3 - a^3}`] },
    pareto: { lab: "Pareto", kind: "c", ps: [["al", "Tail α", 1.1, 6, 0.05, 3]],
      lo: () => 1, pdf: (x, p) => (x < 1 ? 0 : p.al * Math.pow(x, -p.al - 1)), mom: (n, p) => (p.al > n ? p.al / (p.al - n) : Infinity), cdf: (x, n, p) => (x < 1 ? 0 : 1 - Math.pow(x, -(p.al - n))),
      name: () => [String.raw`X \sim \mathrm{Pareto}(\alpha),\ x \ge 1`, String.raw`X^* \sim \mathrm{Pareto}(\alpha - 1)`, String.raw`X^{**} \sim \mathrm{Pareto}(\alpha - 2)`] },
    halfn: { lab: "Half-normal", kind: "c", ps: [["sg", "Scale σ", 0.2, 3, 0.05, 1]],
      pdf: (x, p) => (x < 0 ? 0 : Math.sqrt(2 / Math.PI) / p.sg * Math.exp(-x * x / (2 * p.sg * p.sg))), mom: (n, p) => Math.pow(p.sg, n) * Math.pow(2, n / 2) * Math.exp(lgam((n + 1) / 2)) / Math.sqrt(Math.PI), cdf: (x, n, p) => gammaP((n + 1) / 2, x * x / (2 * p.sg * p.sg)),
      name: () => [String.raw`X \sim \text{Half-normal}(\sigma)`, String.raw`X^* \sim \mathrm{Rayleigh}(\sigma)`, String.raw`X^{**} \sim \mathrm{Maxwell}(\sigma)`] },
    drawc: { lab: "Draw a density", kind: "g", ps: [] },
    pois: { lab: "Poisson", kind: "d", ps: [["lam", "Mean λ", 0.2, 15, 0.1, 3]], pmf: (k, p) => Math.exp(k * Math.log(p.lam) - p.lam - lgam(k + 1)),
      name: () => [String.raw`X \sim \mathrm{Poisson}(\lambda)`, String.raw`X^* \sim 1 + \mathrm{Poisson}(\lambda)`, String.raw`X^{**}\ \text{has}\ P(k) \propto k^2 P(X = k)`] },
    geom: { lab: "Geometric", kind: "d", ps: [["p", "Success p", 0.05, 0.95, 0.01, 0.3]], pmf: (k, p) => p.p * Math.pow(1 - p.p, k),
      name: () => [String.raw`X \sim \mathrm{Geometric}(p)\ \text{on}\ 0, 1, 2, \ldots`, String.raw`X^* \sim 1 + \mathrm{NegBin}(2,\ p)`, String.raw`X^{**}\ \text{has}\ P(k) \propto k^2 (1-p)^k`] },
    negbin: { lab: "Negative binomial", kind: "d", ps: [["r", "Successes r", 1, 10, 1, 3], ["p", "Success p", 0.05, 0.95, 0.01, 0.4]],
      pmf: (k, p) => Math.exp(lgam(k + p.r) - lgam(k + 1) - lgam(p.r) + p.r * Math.log(p.p) + k * Math.log(1 - p.p)),
      name: () => [String.raw`X \sim \mathrm{NegBin}(r,\ p)\ \text{on}\ 0, 1, 2, \ldots`, String.raw`X^* \sim 1 + \mathrm{NegBin}(r+1,\ p)`, String.raw`X^{**}\ \text{has}\ P(k) \propto k^2 P(X = k)`] },
    binom: { lab: "Binomial", kind: "d", ps: [["n", "Trials n", 1, 40, 1, 10], ["p", "Success p", 0.02, 0.98, 0.01, 0.3]],
      pmf: (k, p) => (k > p.n ? 0 : Math.exp(lgam(p.n + 1) - lgam(k + 1) - lgam(p.n - k + 1) + k * Math.log(p.p) + (p.n - k) * Math.log(1 - p.p))),
      name: () => [String.raw`X \sim \mathrm{Binomial}(n,\ p)`, String.raw`X^* \sim 1 + \mathrm{Binomial}(n-1,\ p)`, String.raw`X^{**}\ \text{has}\ P(k) \propto k^2 P(X = k)`] },
    bern: { lab: "Bernoulli", kind: "d", ps: [["p", "Success p", 0.02, 0.98, 0.01, 0.4]], pmf: (k, p) => (k === 0 ? 1 - p.p : k === 1 ? p.p : 0),
      name: () => [String.raw`X \sim \mathrm{Bernoulli}(p)`, String.raw`X^* = 1\ \text{for every}\ p`, String.raw`X^{**} = 1`] },
    drawd: { lab: "Draw a PMF", kind: "e", ps: [] },
  };
  const MXGROUPS = [["Data", ["line"]], ["Continuous", ["exp", "gamma", "lognorm", "weibull", "unif", "pareto", "halfn", "drawc"]], ["Discrete", ["pois", "geom", "negbin", "binom", "bern", "drawd"]]];
  const MX = { fam: "exp", p: {}, level: 0, shown: 0, wait: false, xmax: null, drawC: null, drawD: null, painting: false };
  Object.keys(MXF).forEach((id) => { MX.p[id] = {}; MXF[id].ps.forEach(([k, , , , , v]) => { MX.p[id][k] = v; }); });
  // a hand-drawn density: heights at 121 points on [0, 10]; a hand-drawn PMF: 16 bars on 0..15
  const DRAWX = 10, DRAWN = 121, DRAWK = 16;
  MX.drawC = Float64Array.from({ length: DRAWN }, (_, i) => { const x = i / (DRAWN - 1) * DRAWX; return 0.9 * Math.exp(-((x - 2) ** 2) / 1.2) + 0.45 * Math.exp(-((x - 6.5) ** 2) / 2.2); });
  MX.drawD = Float64Array.from({ length: DRAWK }, (_, k) => [0.15, 0.6, 0.9, 0.55, 0.3, 0.15, 0.08, 0.05, 0.1, 0.2, 0.25, 0.15, 0.06, 0.03, 0.01, 0][k]);

  // ---------- one object that answers every question about the chosen distribution ----------
  function mxDist() {
    const F = MXF[MX.fam], p = MX.p[MX.fam];
    if (F.kind === "c") {
      const lo = F.lo ? F.lo(p) : 0;
      return { kind: "c", lo, mom: (n) => (n === 0 ? 1 : F.mom(n, p)), dens: (L) => { const m = F.mom(L, p) || 1; return (x) => (L ? Math.pow(Math.max(x, 0), L) : 1) * F.pdf(x, p) / (L ? m : 1); }, cdf: (L) => (x) => F.cdf(x, L, p) };
    }
    if (MX.fam === "line") {
      // every observed gap is an atom; pressing reweights the atoms by their size, so the numbers match the rest of the page
      const h = pooled(ST.line, ST.dir, ST.win), s = stats(h); if (!s) return { kind: "c", lo: 0, top: 1, mom: () => 1, dens: () => () => 0, cdf: () => () => 0 };
      const bw = binWidth(s), xm = (Math.ceil(s.max / bw) + 1) * bw, nb = Math.round(xm / bw), M = [];
      for (let n = 0; n <= 6; n++) { let a = 0; for (const v of h) a += Math.pow(v, n); M.push(a / h.length); }
      const sorted = Array.from(h).sort((a, b) => a - b), dc = {}, cc = {};
      const hist = (L) => dc[L] || (dc[L] = (() => { const c = new Float64Array(nb); let tot = 0; for (const v of h) { const w = Math.pow(v, L); c[Math.min(nb - 1, Math.floor(v / bw))] += w; tot += w; } return c.map((x) => x / tot / bw); })());
      const cum = (L) => cc[L] || (cc[L] = (() => { let a = 0; const tot = sorted.reduce((q, v) => q + Math.pow(v, L), 0); return sorted.map((v) => (a += Math.pow(v, L)) / tot); })());
      return { kind: "c", lo: 0, top: xm, mom: (n) => M[n], dens: (L) => { const c = hist(L); return (x) => (x < 0 || x >= xm ? 0 : c[Math.min(nb - 1, Math.floor(x / bw))]); },
        cdf: (L) => { const c = cum(L); return (x) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= x) lo = m + 1; else hi = m; } return lo ? c[lo - 1] : 0; }; } };
    }
    if (F.kind === "g") {
      // a density known on a grid: from the data, or drawn by hand; size-biasing is done on a fine grid
      let xs, ys;
      {
        const N = 800; xs = Float64Array.from({ length: N + 1 }, (_, i) => DRAWX * i / N);
        ys = xs.map((x) => { const u = x / DRAWX * (DRAWN - 1), i = Math.min(DRAWN - 2, Math.floor(u)), f = u - i; return Math.max(0, MX.drawC[i] * (1 - f) + MX.drawC[i + 1] * f); });
      }
      const dx = xs[1] - xs[0], integ = (fn) => { let s = 0; for (let i = 0; i + 1 < xs.length; i++) s += 0.5 * (fn(i) + fn(i + 1)) * dx; return s; };
      const M = [], z = integ((i) => ys[i]) || 1; for (let n = 0; n <= 6; n++) M.push(integ((i) => Math.pow(xs[i], n) * ys[i]) / z);
      const at = (arr, x) => { if (x <= 0) return arr[0]; const u = x / dx, i = Math.floor(u); if (i >= arr.length - 1) return arr[arr.length - 1]; return arr[i] + (arr[i + 1] - arr[i]) * (u - i); };
      const dcache = {}, ccache = {};
      const densArr = (L) => dcache[L] || (dcache[L] = xs.map((x, i) => Math.pow(x, L) * ys[i] / z / M[L]));
      const cdfArr = (L) => { if (ccache[L]) return ccache[L]; const d = densArr(L), c = new Float64Array(xs.length); for (let i = 1; i < xs.length; i++) c[i] = c[i - 1] + 0.5 * (d[i] + d[i - 1]) * dx; return (ccache[L] = c); };
      return { kind: "c", lo: 0, top: xs[xs.length - 1], mom: (n) => M[n], dens: (L) => { const a = densArr(L); return (x) => (x > xs[xs.length - 1] ? 0 : at(a, x)); }, cdf: (L) => { const a = cdfArr(L); return (x) => Math.min(1, at(a, x)); } };
    }
    // discrete: probabilities on 0..K, K large enough that the tail is negligible
    let pk;
    if (F.kind === "e") pk = Array.from(MX.drawD);
    else { pk = []; let tot = 0; for (let k = 0; k < 3000; k++) { const v = F.pmf(k, p); pk.push(v); tot += v; if (tot > 1 - 1e-13 && k > 2) break; } }
    const z = pk.reduce((a, b) => a + b, 0) || 1; pk = pk.map((v) => v / z);
    const M = []; for (let n = 0; n <= 6; n++) M.push(pk.reduce((a, v, k) => a + Math.pow(k, n) * v, 0));
    return { kind: "d", lo: 0, pk, mom: (n) => M[n], pmf: (L) => pk.map((v, k) => (L ? Math.pow(k, L) : 1) * v / M[L]), cdf: (L) => { const q = pk.map((v, k) => (L ? Math.pow(k, L) : 1) * v / M[L]); let c = 0; const cs = q.map((v) => (c += v)); return (x) => (x < 0 ? 0 : cs[Math.min(cs.length - 1, Math.floor(x + 1e-9))]); } };
  }
  // how far right to look: far enough to see the most-biased level shown, never absurdly far
  function mxRange(D, L) {
    if (D.top) return D.top;
    const q = (lev, pr) => { if (D.kind === "d") { const P = D.pmf(lev); let c = 0; for (let k = 0; k < P.length; k++) { c += P[k]; if (c >= pr) return k; } return P.length - 1; } const C = D.cdf(lev); let a = D.lo, b = Math.max(D.lo + 1, 1); while (C(b) < pr && b < 1e7) b *= 2; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (C(m) < pr) a = m; else b = m; } return b; };
    const base = q(0, 0.99), Lm = Math.min(Math.max(L, 1), 4);
    let top = base; for (let l = 1; l <= Lm; l++) { if (!Number.isFinite(D.mom(l))) break; top = Math.max(top, q(l, 0.97)); }
    top = Math.min(top, base * 6, q(0, 0.95) * 5);
    return D.kind === "d" ? Math.max(4, Math.ceil(top) + 1) : top * 1.04;
  }
  const mxMaxLevel = (D) => { let L = 0; while (L < 4 && Number.isFinite(D.mom(L + 1)) && D.mom(L + 1) > 0) L++; return L; };

  // ---------- the controls ----------
  function mxBuild() {
    const box = $("mx-fams"); box.innerHTML = "";
    MXGROUPS.forEach(([g, ids]) => {
      const row = document.createElement("div"); row.className = "mx-group"; row.innerHTML = '<span class="mx-glab">' + g + "</span>";
      ids.forEach((id) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.fam = id; b.textContent = MXF[id].lab; b.addEventListener("click", () => { MX.fam = id; mxReset(); }); row.appendChild(b); });
      box.appendChild(row);
    });
  }
  function mxParams() {
    const F = MXF[MX.fam], p = MX.p[MX.fam], box = $("mx-params"); box.innerHTML = "";
    document.querySelectorAll("#mx-fams .chip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.fam === MX.fam));
    if (MX.fam === "drawc" || MX.fam === "drawd") { box.innerHTML = '<p class="sub" style="margin:2px 0">' + (MX.fam === "drawc" ? "Drag across the plot to draw a density on [0, 10]." : "Drag the bars up and down to draw probabilities on 0, 1, …, 15.") + " It is rescaled to total 1.</p>"; return; }
    if (MX.fam === "line") { box.innerHTML = '<p class="sub" style="margin:2px 0">The gaps of ' + trainsPhrase(ST.line, ST.dir).replace(/^(Uptown|Downtown)/, (w) => w.toLowerCase()) + ", " + WINPHRASE[ST.win] + ". Size-biasing them gives the riders' view.</p>"; return; }
    F.ps.forEach(([k, lab, mn, mx, st]) => {
      const d = document.createElement("div"); d.className = "slider";
      d.innerHTML = '<label for="mx-' + k + '">' + lab + '</label><input type="range" id="mx-' + k + '" min="' + mn + '" max="' + mx + '" step="' + st + '" value="' + p[k] + '"><output>' + (+p[k]).toFixed(st < 0.1 ? 2 : st < 1 ? 1 : 0) + "</output>";
      const inp = d.querySelector("input"), out = d.querySelector("output");
      inp.addEventListener("input", () => { p[k] = +inp.value; if (F.fix) F.fix(p); box.querySelectorAll("input").forEach((el) => { const kk = el.id.slice(3); el.value = p[kk]; el.nextElementSibling.textContent = (+p[kk]).toFixed(+el.step < 0.1 ? 2 : +el.step < 1 ? 1 : 0); }); MX.xmax = null; mxDraw(); });
      box.appendChild(d);
    });
  }
  const MXA = { s: 0, x: 0 };
  function mxReset() { cancelAnimationFrame(MXA._tw); MX.level = 0; MX.shown = 0; MX.xmax = null; mxParams(); mxDraw(); }
  function mxGo(to) {
    const D = mxDist(), top = mxMaxLevel(D); to = clamp(to, 0, top);
    if (to === MX.level && MX.shown === to) { mxDraw(); return; }
    MX.level = to; const nx = mxRange(D, Math.max(to, 1)); MXA.s = MX.shown; MXA.x = MX.xmax || nx;
    tween(MXA, { s: to, x: nx }, 900, () => { MX.shown = MXA.s; MX.xmax = MXA.x; mxDraw(); });
  }
  $("mx-go").addEventListener("click", () => mxGo(Math.max(1, MX.level)));
  $("mx-again").addEventListener("click", () => mxGo(MX.level + 1));
  $("mx-undo").addEventListener("click", () => mxGo(0));
  $("mx-wait").addEventListener("click", () => { MX.wait = !MX.wait; $("mx-wait").setAttribute("aria-pressed", MX.wait); mxDraw(); });

  // ---------- drawing ----------
  const MXG = (W, H, rows) => ({ x0: 46, x1: W - 12, top: 13 + 16 * rows + 12, axisY: H - 40 });
  function mxDraw() {
    const cv = $("cv-mx"), { ctx, W, H } = fit(cv, 330), D = mxDist(), F = MXF[MX.fam];
    const isDraw = MX.fam === "drawc" || MX.fam === "drawd";
    cv.style.touchAction = isDraw ? "none" : "pan-y"; cv.style.cursor = isDraw ? "crosshair" : "default";
    if (MX.xmax == null) MX.xmax = mxRange(D, Math.max(MX.level, 1));
    const xmax = MX.xmax, sh = MX.shown, lo = Math.floor(sh + 1e-9), hi = Math.min(lo + 1, 4), fr = sh - lo;
    const yel = C.dark ? C.edge : "#8a6a00";
    // the means, labelled above the plot
    const marks = [[D.mom(1), "E X = " + fmtS(D.mom(1)), C.steel]];
    for (let l = 1; l <= MX.level; l++) { const m = D.mom(l + 1) / D.mom(l); marks.push([Number.isFinite(m) ? m : xmax * 2, "E X" + "*".repeat(l) + " = " + (Number.isFinite(m) ? fmtS(m) : "∞"), yel]); }
    if (MX.wait) { const ew = D.mom(2) / (2 * D.mom(1)); marks.push([Number.isFinite(ew) ? ew : xmax * 2, "E W = " + (Number.isFinite(ew) ? fmtS(ew) : "∞"), C.led]); }
    const x0 = 46, x1 = W - 12, Kd = Math.max(1, Math.round(xmax)), slotD = (x1 - x0) / (Kd + 1);
    const sx = D.kind === "d" ? (v) => x0 + (v + 0.5) * slotD : (v) => x0 + v / xmax * (x1 - x0);
    const vis = marks.filter(([v]) => v <= xmax * 1.001), { put, rows } = placeLabels(ctx, vis, sx, x0, x1, 13);
    const g = MXG(W, H, rows), axisY = g.axisY, top = g.top;
    if (D.kind === "c") {
      const N = 360, xs = Array.from({ length: N + 1 }, (_, i) => xmax * i / N);
      const curve = (L) => { const f = D.dens(L); return xs.map((x) => f(x)); };
      const base = curve(0), cur = fr > 0 || lo > 0 ? (() => { const a = curve(lo), b = curve(hi); return a.map((v, i) => v * (1 - fr) + b[i] * fr); })() : base;
      const hist = []; for (let l = 1; l < lo; l++) hist.push(curve(l));
      const wait = MX.wait ? xs.map((x) => (1 - D.cdf(0)(x)) / D.mom(1)) : null;
      // y range from the curves away from x = 0, where some densities blow up
      const pool = [...base, ...cur, ...(wait || [])].filter((v, i) => Number.isFinite(v) && (i % (N + 1)) > N / 80);
      let ymax = Math.max(...pool, 1e-9) * 1.1; if (isDraw && MX.level === 0 && sh === 0) ymax = Math.max(...base) * 1.15 || 1;
      const sy = (v) => axisY - Math.min(v, ymax * 1.03) / ymax * (axisY - top);
      const yst = niceStep(ymax, 4), yt = []; for (let v = 0; v <= ymax + 1e-9; v += yst) yt.push(v);
      yGrid(ctx, x0, x1, yt, sy, (v) => (isDraw && MX.level === 0 && sh === 0 ? "" : v.toFixed(yst < 0.01 ? 3 : yst < 0.1 ? 2 : 1)));
      ctx.save(); ctx.beginPath(); ctx.rect(x0, top - 8, x1 - x0, axisY - top + 8); ctx.clip();
      const path = (ys) => { ctx.beginPath(); xs.forEach((x, i) => { const y = sy(ys[i]); if (i) ctx.lineTo(sx(x), y); else ctx.moveTo(sx(x), y); }); };
      const fill = (ys, style, a) => { path(ys); ctx.lineTo(sx(xmax), axisY); ctx.lineTo(sx(0), axisY); ctx.closePath(); ctx.globalAlpha = a; ctx.fillStyle = style; ctx.fill(); ctx.globalAlpha = 1; };
      fill(base, C.steel, sh > 0 ? 0.16 : 0.32);
      hist.forEach((ys, j) => { path(ys); ctx.strokeStyle = rgba(hexRgb(C.dark ? C.edge : "#8a6a00"), 0.35 + 0.15 * j); ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); });
      if (sh > 0) fill(cur, pattern(ctx, "riders"), 0.55);
      if (wait) { fill(wait, pattern(ctx, "wait"), 0.6); path(wait); ctx.strokeStyle = C.led; ctx.lineWidth = 2.4; ctx.stroke(); }
      path(base); ctx.strokeStyle = C.steel; ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.stroke();
      if (sh > 0) { path(cur); ctx.strokeStyle = yel; ctx.lineWidth = 2.6; ctx.stroke(); }
      ctx.restore();
      if (isDraw && MX.level === 0 && sh === 0) text(ctx, MX.fam === "drawc" ? "drag across the plot to draw" : "", x1, top + 4, 12, C.muted, "right", 600);
    } else {
      // bars: X in steel, the size-biased version in platform yellow on top
      const K = Kd, P0 = D.pmf(0), Pl = D.pmf(lo), Ph = D.pmf(hi), cur = Pl.map((v, k) => v * (1 - fr) + (Ph[k] || 0) * fr);
      let ymax = 0; for (let k = 0; k <= K; k++) ymax = Math.max(ymax, P0[k] || 0, sh > 0 ? cur[k] || 0 : 0); ymax *= 1.12; if (!ymax) ymax = 1;
      if (MX.fam === "drawd" && MX.level === 0 && sh === 0) ymax = 1;
      const slot = slotD, bx = sx, sy = (v) => axisY - Math.min(v, ymax) / ymax * (axisY - top);
      const yst = niceStep(ymax, 4), yt = []; for (let v = 0; v <= ymax + 1e-9; v += yst) yt.push(v);
      yGrid(ctx, x0, x1, yt, sy, (v) => (MX.fam === "drawd" && MX.level === 0 && sh === 0 ? "" : v.toFixed(yst < 0.01 ? 3 : yst < 0.1 ? 2 : 1)));
      const raw = MX.fam === "drawd" && MX.level === 0 && sh === 0 ? MX.drawD : null, mxr = raw ? Math.max(...raw, 1e-9) : 1;
      for (let k = 0; k <= K; k++) {
        const v0 = raw ? (raw[k] || 0) / mxr * ymax * 0.95 : P0[k] || 0, w = Math.max(2, slot * (sh > 0 ? 0.78 : 0.62));
        ctx.globalAlpha = sh > 0 ? 0.45 : 1; ctx.fillStyle = C.steel; ctx.fillRect(bx(k) - w / 2, sy(v0), w, axisY - sy(v0)); ctx.globalAlpha = 1;
        if (sh > 0) { const v = cur[k] || 0, w2 = Math.max(1.5, slot * 0.46); ctx.fillStyle = pattern(ctx, "riders"); ctx.fillRect(bx(k) - w2 / 2, sy(v), w2, axisY - sy(v)); ctx.strokeStyle = yel; ctx.lineWidth = 1.2; ctx.strokeRect(bx(k) - w2 / 2 + 0.5, sy(v) + 0.5, w2 - 1, Math.max(0, axisY - sy(v) - 1)); }
      }
      if (MX.wait) { // the wait for gaps of k minutes, arrival uniform: density P(X > w)/E X on the real line
        const C0 = D.cdf(0); ctx.beginPath(); for (let i = 0; i <= 400; i++) { const w = (K + 0.5) * i / 400, y = sy((1 - C0(Math.floor(w))) / D.mom(1)); if (i) ctx.lineTo(sx(w), y); else ctx.moveTo(sx(w), y); } ctx.strokeStyle = C.led; ctx.lineWidth = 2.4; ctx.stroke();
      }
      const step = Math.max(1, Math.ceil((K + 1) / 14));
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, axisY + 0.5, x1, axisY + 0.5);
      for (let k = 0; k <= K; k += step) text(ctx, String(k), bx(k), axisY + 17, 12, C.muted, "center", 500);
      text(ctx, "value", x1, axisY + 32, 12, C.muted, "right", 500);
      MX._bars = { x0, x1, slot, K, axisY, top };
    }
    if (D.kind === "c") {
      const xst = niceStep(xmax, W < 500 ? 5 : 8), xt = []; for (let v = 0; v <= xmax + 1e-9; v += xst) xt.push(+v.toFixed(6));
      xAxis(ctx, x0, x1, axisY, xt, sx, (v) => fmtS(v));
      text(ctx, "value", x1, axisY + 32, 12, C.muted, "right", 500);
      MX._plot = { x0, x1, top, axisY, xmax };
    }
    put.forEach((q) => { ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = q.col; ctx.lineWidth = 1.4; line(ctx, q.x, q.ly + 4, q.x, axisY); ctx.restore(); ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, axisY, 3.5, 0, 6.283); ctx.fill(); });
    put.forEach((q) => halo(ctx, q.lab, q.lx, q.ly, 12.5, q.col, "left", 760));
    mxSide(D); mxPanels(D);
  }
  const fmtS = (v) => (Number.isNaN(v) ? "–" : !Number.isFinite(v) ? "∞" : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

  // ---------- the name of what you get, the numbers, and a note ----------
  function mxSide(D) {
    const F = MXF[MX.fam], m1 = D.mom(1), m2 = D.mom(2), v = m2 - m1 * m1, sd = Math.sqrt(Math.max(v, 0)), es = m1 > 0 ? m2 / m1 : NaN;
    const nm = F.name ? F.name(MX.level) : null;
    // one math chunk per step, so the chain can wrap on a phone
    const steps = [nm && nm[0], nm && MX.level >= 1 ? nm[1] : null, nm && MX.level >= 2 ? nm[2] : null].filter(Boolean);
    $("mx-name").innerHTML = steps.map((t, i) => '<span class="fnum">' + (i ? tex(String.raw`\Rightarrow\;`) + " " : "") + tex(t) + "</span>").join(" ") + (nm && MX.level >= 3 ? ' <span class="fnum">' + tex(String.raw`\Rightarrow\;\cdots`) + "</span>" : "");
    const ro = (cls, val, lab) => '<div class="ro ' + cls + '"><div class="v">' + val + '</div><div class="k">' + lab + "</div></div>";
    $("ro-mx").innerHTML = ro("trains", fmtS(m1), "mean of " + M`X`) + ro("", Number.isFinite(sd) ? fmtS(sd) : "∞", "standard deviation") + ro("", Number.isFinite(sd) ? (sd / m1).toFixed(2) : "∞", "CV") +
      ro("riders", fmtS(es), "mean of " + M`X^*` + " = " + M`E X + \mathrm{Var}\,X / E X`) + (MX.wait ? ro("wait", fmtS(es / 2), "mean wait = " + M`E X^* / 2`) : "");
    let n;
    const p0 = D.kind === "d" ? D.pk[0] : 0;
    if (MX.fam === "pareto" && MX.p.pareto.al <= 2) n = "Here Var " + M`X` + " is infinite, so " + M`E X^*` + " is infinite: the size-biased value has no finite mean even though " + M`X` + " does.";
    else if (MX.fam === "bern") n = M`X^*` + " is always 1. Size bias wipes out the zeros, so every Bernoulli, whatever its " + M`p` + ", has the same " + M`X^*` + ": you cannot recover " + M`X` + " from " + M`X^*` + ".";
    else if (D.kind === "d" && p0 > 0.001) n = M`X` + " is 0 with probability " + p0.toFixed(2) + ", but " + M`X^*` + " is never 0: a zero carries no weight. So distributions that differ only in their chance of 0 share the same " + M`X^*` + ".";
    else if (MX.fam === "exp") n = "The Poisson bus: " + M`X^*` + " averages twice " + M`E X` + (MX.wait ? ", and the wait has exactly the distribution of " + M`X` + " itself, so it averages a whole " + M`E X` + ". No memory." : ".");
    else if (MX.fam === "line") n = "Size-biasing your line's gaps reproduces the riders' histogram from the stop before; the wait curve is the one from “Your wait.”";
    else n = "Each press multiplies the density by " + M`x` + " and rescales. Below: every press makes the distribution larger in all three senses at once.";
    $("n-mx").innerHTML = n;
  }

  // ---------- three senses of "larger", comparing the last two levels ----------
  function mxPanels(D) {
    const a = Math.max(MX.level - 1, 0), b = Math.max(MX.level, 1), xmax = MX.xmax, yel = C.dark ? C.edge : "#8a6a00";
    const nmA = "X" + "*".repeat(a), nmB = "X" + "*".repeat(b), tA = a ? "X^{" + "*".repeat(a) + "}" : "X", tB = "X^{" + "*".repeat(b) + "}", ma = D.mom(a + 1) / D.mom(a), mb = D.mom(b + 1) / D.mom(b);
    $("mx-pair").innerHTML = "Comparing " + tex(tA) + " with " + tex(tB) + (MX.level ? "" : ", before you press");
    // 1. the means
    { const cv = $("cv-mx-mean"), { ctx, W, H } = fit(cv, 150), x0 = 10, x1 = W - 10, top = 34, sx = (v) => x0 + clamp(v / xmax, 0, 1.02) * (x1 - x0);
      text(ctx, "Larger on average", 0, 14, 13, C.ink, "left", 700);
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, 96.5, x1, 96.5);
      const xa = sx(ma), xb = Number.isFinite(mb) ? sx(mb) : x1 + 4;
      ctx.fillStyle = rgba(C.rgb.edge, 0.35); ctx.fillRect(xa, 84, Math.max(1, xb - xa), 12);
      ctx.fillStyle = C.steel; ctx.beginPath(); ctx.arc(xa, 96.5, 5, 0, 6.283); ctx.fill();
      ctx.fillStyle = yel; ctx.beginPath(); ctx.arc(Math.min(xb, x1), 96.5, 5, 0, 6.283); ctx.fill();
      tlab(ctx, "E " + nmA + " = " + fmtS(ma), xa, 76, 12, C.steel, 700, 0, W); tlab(ctx, "E " + nmB + " = " + fmtS(mb), Math.min(xb, x1), 122, 12, yel, 700, 0, W);
      const vr = D.mom(a + 2) / D.mom(a) - ma * ma;
      text(ctx, "gap = Var " + nmA + " / E " + nmA + " = " + (Number.isFinite(vr / ma) ? fmtS(vr / ma) : "∞"), 0, 143, 12, C["ink-2"], "left", 500); }
    // 2. survival functions: the biased one is above everywhere
    { const cv = $("cv-mx-cdf"), { ctx, W, H } = fit(cv, 150), x0 = 30, x1 = W - 6, top = 26, axisY = 128, sx = (v) => x0 + v / xmax * (x1 - x0), sy = (v) => axisY - v * (axisY - top);
      text(ctx, "Larger in every tail: P(" + nmB + " > t) ≥ P(" + nmA + " > t)", 0, 14, 13, C.ink, "left", 700);
      yGrid(ctx, x0, x1, [0, 0.5, 1], sy, (v) => String(v));
      const N = 220, ts = Array.from({ length: N + 1 }, (_, i) => xmax * i / N), Ca = D.cdf(a), Cb = D.cdf(b), Sa = ts.map((t) => 1 - Ca(t)), Sb = ts.map((t) => 1 - Cb(t));
      ctx.beginPath(); ts.forEach((t, i) => (i ? ctx.lineTo(sx(t), sy(Sb[i])) : ctx.moveTo(sx(t), sy(Sb[i])))); for (let i = N; i >= 0; i--) ctx.lineTo(sx(ts[i]), sy(Sa[i])); ctx.closePath(); ctx.fillStyle = rgba(C.rgb.edge, 0.3); ctx.fill();
      const stroke = (S, col) => { ctx.beginPath(); ts.forEach((t, i) => (i ? ctx.lineTo(sx(t), sy(S[i])) : ctx.moveTo(sx(t), sy(S[i])))); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); };
      stroke(Sa, a ? yel : C.steel); stroke(Sb, yel);
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, axisY + 0.5, x1, axisY + 0.5); text(ctx, "t", x1, axisY + 16, 12, C.muted, "right", 500); }
    // 3. likelihood ratio: f_b / f_a = x / E[X_a], a straight line through 0
    { const cv = $("cv-mx-ratio"), { ctx, W, H } = fit(cv, 150), x0 = 30, x1 = W - 6, top = 26, axisY = 128, rmax = 3, sx = (v) => x0 + v / xmax * (x1 - x0), sy = (v) => axisY - Math.min(v, rmax) / rmax * (axisY - top);
      text(ctx, "Larger in likelihood ratio: f" + "*".repeat(b) + "(x) / f" + "*".repeat(a) + "(x) = x / E " + nmA, 0, 14, 13, C.ink, "left", 700);
      yGrid(ctx, x0, x1, [0, 1, 2, 3], sy, (v) => String(v));
      ctx.strokeStyle = C.muted; ctx.setLineDash([3, 3]); line(ctx, x0, sy(1), x1, sy(1)); ctx.setLineDash([]);
      // the ratio is defined where the "before" distribution has mass; below 1 a value gets rarer, above 1 commoner
      if (D.kind === "d") { const P = D.pmf(a); for (let k = 0; k <= Math.round(xmax); k++) { if (!(P[k] > 1e-12)) continue; const x = x0 + k / xmax * (x1 - x0), r = k / ma, up = r >= 1;
          ctx.strokeStyle = up ? yel : C.steel; ctx.lineWidth = 2; line(ctx, x, sy(1), x, sy(r)); ctx.fillStyle = up ? yel : C.steel; ctx.beginPath(); ctx.arc(x, sy(r), 3, 0, 6.283); ctx.fill(); } }
      else { const f = D.dens(a), pts = []; for (let i = 0; i <= 200; i++) { const x = xmax * i / 200; if (f(x) > 1e-12 && x / ma <= rmax * 1.02) pts.push(x); }
        if (pts.length > 1) {
          const lo = pts[0], hi = pts[pts.length - 1];
          if (lo < ma) { ctx.beginPath(); ctx.moveTo(sx(lo), sy(1)); ctx.lineTo(sx(lo), sy(lo / ma)); ctx.lineTo(sx(Math.min(ma, hi)), sy(Math.min(ma, hi) / ma)); ctx.lineTo(sx(Math.min(ma, hi)), sy(1)); ctx.closePath(); ctx.fillStyle = rgba(C.rgb.steel, 0.2); ctx.fill(); }
          if (hi > ma) { ctx.beginPath(); ctx.moveTo(sx(Math.max(ma, lo)), sy(1)); ctx.lineTo(sx(Math.max(ma, lo)), sy(Math.max(ma, lo) / ma)); ctx.lineTo(sx(hi), sy(hi / ma)); ctx.lineTo(sx(hi), sy(1)); ctx.closePath(); ctx.fillStyle = rgba(C.rgb.edge, 0.35); ctx.fill(); }
          ctx.strokeStyle = yel; ctx.lineWidth = 2.4; ctx.beginPath(); let on = false; for (let i = 0; i <= 200; i++) { const x = xmax * i / 200; if (f(x) > 1e-12 && x / ma <= rmax * 1.02) { if (on) ctx.lineTo(sx(x), sy(x / ma)); else { ctx.moveTo(sx(x), sy(x / ma)); on = true; } } else on = false; } ctx.stroke(); } }
      const xm = sx(ma); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(xm, sy(1), 4, 0, 6.283); ctx.fill();
      { const lab = "1 at x = E " + nmA + ": the densities cross", lw = tw(ctx, lab, 11.5, 600); halo(ctx, lab, clamp(xm, x0 + lw / 2 + 1, x1 - lw / 2 - 1), sy(1) - 9, 11.5, C["ink-2"], "center", 600); }
      if (xm - x0 > 70) text(ctx, "rarer", x0 + 4, sy(1) + 15, 11.5, C.steel, "left", 700);
      if (x1 - xm > 70) text(ctx, "commoner", x1 - 2, sy(1) + 15, 11.5, yel, "right", 700);
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, axisY + 0.5, x1, axisY + 0.5); text(ctx, "x", x1, axisY + 16, 12, C.muted, "right", 500); }
  }

  // ---------- drawing your own ----------
  onDrag($("cv-mx"), {
    down: (pt) => { if (MX.fam !== "drawc" && MX.fam !== "drawd") return false; if (MX.level || MX.shown) { MX.level = 0; MX.shown = 0; } MX.last = null; mxPaint(pt); },
    move: (pt) => mxPaint(pt),
    up: () => { MX.last = null; MX.xmax = null; mxDraw(); }
  });
  function mxPaint(pt) {
    const cv = $("cv-mx");
    if (MX.fam === "drawc" && MX._plot) {
      const g = MX._plot, xv = (pt.x - g.x0) / (g.x1 - g.x0) * g.xmax, h = clamp((g.axisY - pt.y) / (g.axisY - g.top), 0, 1) * Math.max(...MX.drawC, 0.2) / 0.87;
      const i1 = Math.round(xv / DRAWX * (DRAWN - 1)), prev = MX.last || [i1, h];
      const [i0, h0] = prev, lo = Math.min(i0, i1), hi = Math.max(i0, i1);
      for (let i = Math.max(0, lo); i <= Math.min(DRAWN - 1, hi); i++) { const f = hi === lo ? 1 : (i - i0) / (i1 - i0); MX.drawC[i] = Math.max(0, h0 + (h - h0) * f); }
      MX.last = [i1, h]; MX.xmax = DRAWX; mxDraw();
    } else if (MX.fam === "drawd" && MX._bars) {
      const g = MX._bars, k = Math.floor((pt.x - g.x0) / g.slot); if (k < 0 || k >= DRAWK) return;
      MX.drawD[k] = clamp((g.axisY - pt.y) / (g.axisY - g.top) / 0.95, 0, 1); mxDraw();
    }
    if (cv) cv.style.cursor = "crosshair";
  }
  mxBuild(); mxParams();
