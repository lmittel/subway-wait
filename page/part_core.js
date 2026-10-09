  const $ = (id) => document.getElementById(id);
  const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // =====================================================================
  // data: decode the packed arrival series, timetable and morning train graphs
  // =====================================================================
  const META = MTA.meta, LINES = META.lines, DAYS = META.days;
  function bytes(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function reader(u) {
    let p = 0;
    const uv = () => { let x = 0, m = 1, b; do { b = u[p++]; x += (b & 127) * m; m *= 128; } while (b & 128); return x; };
    const sv = () => { const q = uv(); return q % 2 ? -(q + 1) / 2 : q / 2; };
    return { uv, sv };
  }
  const dateOf = (d) => new Date(d + "T12:00:00");
  const DAYINFO = DAYS.map((d) => {
    const dt = dateOf(d), prev = new Date(dt.getTime() - 86400000), ps = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0") + "-" + String(prev.getDate()).padStart(2, "0");
    return { day: d, dow: dt.getDay(), weekday: dt.getDay() >= 1 && dt.getDay() <= 5, earlyOk: DAYS.includes(ps),
      label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()] + " " + (dt.getMonth() + 1) + "/" + dt.getDate() };
  });
  const SER = {};
  { const R = reader(bytes(MTA.ser));
    for (const r of LINES) { SER[r] = {}; for (const d of ["N", "S"]) {
      if (!R.uv()) continue;
      SER[r][d] = DAYS.map((day) => {
        const n = R.uv(), t = new Int32Array(n); let prev = 0;
        for (let i = 0; i < n; i++) { prev += R.sv(); t[i] = prev; }
        const nb = R.uv(), brk = new Set(); let pb = 0;
        for (let i = 0; i < nb; i++) { pb += R.uv(); brk.add(pb); }
        return { day, t, brk };
      });
    } }
  }
  const SCH = {};
  { const R = reader(bytes(MTA.sch));
    for (const r of LINES) { SCH[r] = {}; for (const d of ["N", "S"]) { SCH[r][d] = {}; for (const svc of ["Weekday", "Sunday"]) {
      const n = R.uv(), t = new Int32Array(n); let prev = 0; for (let i = 0; i < n; i++) { prev += R.sv(); t[i] = prev; } SCH[r][d][svc] = t;
    } } }
  }
  const MAR = {};
  { const R = reader(bytes(MTA.mar));
    for (const r of LINES) { MAR[r] = {}; for (const d of ["N", "S"]) {
      if (!R.uv()) continue;
      const ns = R.uv(), stops = []; for (let i = 0; i < ns; i++) stops.push(META.names[R.uv()]);
      const km = []; let pk = 0; for (let i = 0; i < ns; i++) { pk += R.uv(); km.push(pk / 100); }
      const here = R.uv(), nt = R.uv(), trips = [];
      for (let j = 0; j < nt; j++) { const np = R.uv(), pts = []; let k = 0, t = 6 * 3600; for (let i = 0; i < np; i++) { k += R.sv(); t += R.sv(); pts.push([k, t]); } trips.push(pts); }
      MAR[r][d] = { stops, km, here, trips };
    } }
  }
  const MAREY_DAY = META.mareyDay, MAREY_IDX = DAYS.indexOf(MAREY_DAY);

  // =====================================================================
  // words for lines, stations, directions and time windows
  // =====================================================================
  const WINS = [
    { id: "am", lab: "Morning rush", sub: "7–9:30 am", a: 7 * 3600, b: 9.5 * 3600 },
    { id: "mid", lab: "Midday", sub: "10 am–3 pm", a: 10 * 3600, b: 15 * 3600 },
    { id: "pm", lab: "Evening rush", sub: "4:30–7 pm", a: 16.5 * 3600, b: 19 * 3600 },
    { id: "eve", lab: "Evening", sub: "8–11 pm", a: 20 * 3600, b: 23 * 3600 },
    { id: "late", lab: "Late night", sub: "1–5 am", a: 1 * 3600, b: 5 * 3600 },
  ];
  const WIN = Object.fromEntries(WINS.map((w) => [w.id, w]));
  const GROUPS = [["1", "2", "3"], ["4", "5", "6"], ["7"], ["A", "C", "E"], ["B", "D", "F", "M"], ["G"], ["J"], ["L"], ["N", "Q", "R", "W"], ["GS"]];
  const SHORT = { "42 St-Port Authority Bus Terminal": "42 St–Port Authority" };
  const stationName = (r) => (SHORT[META.station[r]] || META.station[r]).replace(/-/g, "–");
  const sym = (r) => (r === "GS" ? "S" : r);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function trainsPhrase(r, d) {
    const dl = META.dirlab[r][d];
    if (r === "GS") return "42 St Shuttle trains";
    if (dl === "uptown" || dl === "downtown") return cap(dl) + " " + sym(r) + " trains";
    return sym(r) + " trains " + dl;
  }
  // how many days feed a window: the ten weekdays, or for late nights only those whose previous day is also in the archive
  const NUMW = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const daysWord = (w, r = ST.line, d = ST.dir) => { const n = pooled(r, d, w).days; return NUMW[n] || String(n); };
  const fmt = (v, k = 1) => (Number.isFinite(v) ? v.toFixed(k) : "–");
  const fmtN = (n) => n.toLocaleString("en-US");
  const hhmm = (s) => { s = ((s % 86400) + 86400) % 86400; let h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); const ap = h < 12 ? "am" : "pm"; h = h % 12 || 12; return h + ":" + String(m).padStart(2, "0") + " " + ap; };
  const hourLab = (s) => { let h = Math.round(s / 3600) % 24; const ap = h < 12 ? "am" : "pm"; h = h % 12 || 12; return h + " " + ap; };

  // =====================================================================
  // headways: pooled over the ten weekdays, or one day's sequence
  // =====================================================================
  const CACHE = new Map();
  function dayArrivals(r, d, dayIdx, w) {
    const per = SER[r][d]; if (!per) return [];
    const p = per[dayIdx], W = WIN[w];
    if (w === "late" && !DAYINFO[dayIdx].earlyOk) return [];
    const out = []; let seg = [];
    for (let i = 0; i < p.t.length; i++) {
      const t = p.t[i]; if (t < W.a || t > W.b) continue;
      if (seg.length && p.brk.has(i - 1)) { if (seg.length > out.length) out.splice(0, out.length, ...seg); seg = []; }
      seg.push(t);
    }
    return seg.length >= out.length ? seg : out;
  }
  function pooled(r, d, w) {
    const key = r + d + w; if (CACHE.has(key)) return CACHE.get(key);
    const g = []; const per = SER[r][d]; let days = 0;
    if (per) DAYINFO.forEach((di, k) => {
      if (!di.weekday) return;
      if (w === "late" && !di.earlyOk) return;
      const p = per[k], W = WIN[w], n0 = g.length;
      for (let i = 0; i + 1 < p.t.length; i++) {
        if (p.brk.has(i)) continue;
        if (p.t[i] >= W.a && p.t[i + 1] <= W.b) g.push((p.t[i + 1] - p.t[i]) / 60);
      }
      if (g.length > n0) days++;
    });
    const h = Float64Array.from(g); h.days = days; CACHE.set(key, h); return h;
  }
  function schedGaps(r, d, w) {
    // the timetable writes trips that run past midnight as 25:00, 26:00 ...; fold them back onto the clock
    const raw = SCH[r][d].Weekday, W = WIN[w];
    const t = Array.from(raw, (x) => (x >= 86400 ? x - 86400 : x)).sort((x, y) => x - y), g = [];
    for (let i = 0; i + 1 < t.length; i++) if (t[i] >= W.a && t[i + 1] <= W.b && t[i + 1] > t[i]) g.push((t[i + 1] - t[i]) / 60);
    return Float64Array.from(g);
  }
  function stats(h) {
    const n = h.length; if (n < 2) return null;
    let s = 0, s2 = 0, mx = 0; for (const x of h) { s += x; s2 += x * x; if (x > mx) mx = x; }
    const mu = s / n, v = s2 / n - mu * mu, sd = Math.sqrt(Math.max(v, 0));
    return { n, mu, sd, cv: sd / mu, EL: s2 / s, EW: s2 / (2 * s), half: mu / 2, max: mx, sum: s };
  }
  const quant = (h, q) => { const a = Array.from(h).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; };

  // =====================================================================
  // shared state: the line, direction and time window ride along through every stop
  // =====================================================================
  const ST = { line: "A", dir: "N", win: "am" };
  const listeners = [];
  const onState = (f) => listeners.push(f);
  function valid(r, d, w) { return SER[r] && SER[r][d] && pooled(r, d, w).length >= 12; }
  function setState(p) {
    Object.assign(ST, p);
    if (!SER[ST.line][ST.dir]) ST.dir = SER[ST.line].N ? "N" : "S";
    if (!valid(ST.line, ST.dir, ST.win)) { const alt = WINS.find((w) => valid(ST.line, ST.dir, w.id)); if (alt) ST.win = alt.id; }
    listeners.forEach((f) => f());
  }
  const S = () => stats(pooled(ST.line, ST.dir, ST.win));
  // single-day views show the day of the train graph unless that day has too few trains in the window
  function showDay() {
    if (dayArrivals(ST.line, ST.dir, MAREY_IDX, ST.win).length >= 6) return MAREY_IDX;
    let best = MAREY_IDX, bn = 0;
    DAYINFO.forEach((di, k) => { if (!di.weekday) return; const n = dayArrivals(ST.line, ST.dir, k, ST.win).length; if (n > bn || (n === bn && Math.abs(k - MAREY_IDX) < Math.abs(best - MAREY_IDX))) { bn = n; best = k; } });
    return best;
  }
  const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  // the weekdays in the window as a phrase, e.g. "Sept 14–18 and Sept 28–Oct 2, 2026"
  const WEEKDAYS_N = DAYINFO.filter((d) => d.weekday).length;
  const DATESPAN = (() => {
    const ds = DAYINFO.filter((d) => d.weekday).map((d) => dateOf(d.day)), runs = [];
    ds.forEach((x) => { const r = runs[runs.length - 1]; if (r && (x - r[1]) / 86400000 < 1.5) r[1] = x; else runs.push([x, x]); });
    const md = (d) => MONTH[d.getMonth()] + " " + d.getDate();
    const txt = runs.map(([a, b]) => (+a === +b ? md(a) : a.getMonth() === b.getMonth() ? md(a) + "–" + b.getDate() : md(a) + "–" + md(b)));
    if (!ds.length) return "";
    const y0 = ds[0].getFullYear(), y1 = ds[ds.length - 1].getFullYear();
    return (txt.length <= 2 ? txt.join(" and ") : txt.slice(0, -1).join(", ") + " and " + txt[txt.length - 1]) + ", " + (y0 === y1 ? y0 : y0 + "–" + y1);
  })();
  const dayLong = (k) => { const dt = dateOf(DAYS[k]); return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dt.getDay()] + " " + MONTH[dt.getMonth()] + " " + dt.getDate(); };

  // =====================================================================
  // theme, canvas and drawing helpers
  // =====================================================================
  const C = {};
  function hexRgb(h) { h = h.trim().replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    ["tile", "panel", "grout", "ink", "ink-2", "muted", "enamel", "on-enamel", "edge", "edge-ink", "led", "led-deep", "steel", "tunnel", "tunnel-ink"].forEach((k) => { C[k] = s.getPropertyValue("--" + k).trim(); });
    C.rgb = {}; ["ink", "edge", "led", "steel", "tile", "panel"].forEach((k) => { C.rgb[k] = hexRgb(C[k]); });
    C.dark = hexRgb(C.tile)[0] < 90;
  }
  readTheme();
  const rgba = (rgb, a) => "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
  const lineColor = (r) => META.color[r];
  const lineText = (r) => META.textc[r];
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2.5);
  function fit(cv, h) {
    const dpr = DPR(), w = Math.max(10, cv.clientWidth || cv.parentElement.clientWidth || 600);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + "px";
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    cv._w = w; cv._h = h;
    return { ctx, W: w, H: h, dpr };
  }
  const FNT = (px, wt, cond) => (wt || 500) + " " + px + 'px Archivo, "Helvetica Neue", Arial, sans-serif';
  function text(ctx, s, x, y, px, color, align, wt, base, cond) {
    ctx.font = FNT(px, wt); if ("fontStretch" in ctx) ctx.fontStretch = cond ? "condensed" : "normal";
    ctx.fillStyle = color; ctx.textAlign = align || "left"; ctx.textBaseline = base || "alphabetic"; ctx.fillText(s, x, y);
  }
  function halo(ctx, s, x, y, px, color, align, wt, bg, base) {
    ctx.font = FNT(px, wt); if ("fontStretch" in ctx) ctx.fontStretch = "normal";
    ctx.textAlign = align || "left"; ctx.textBaseline = base || "alphabetic"; ctx.lineJoin = "round"; ctx.lineWidth = 4;
    ctx.strokeStyle = bg || C.panel; ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  const tw = (ctx, s, px, wt) => { ctx.font = FNT(px, wt); return ctx.measureText(s).width; };
  // captions live in the page rather than the canvas, so they wrap on a phone
  function caption(cv, s) { let el = cv.previousElementSibling; if (!el || !el.classList.contains("cap")) { el = document.createElement("div"); el.className = "cap"; cv.parentNode.insertBefore(el, cv); } if (el.textContent !== s) el.textContent = s; }
  // labels for marks on an axis, in rows above a plot: a label slides right, or drops a row, to dodge its neighbours
  function placeLabels(ctx, marks, sx, x0, x1, y0) {
    const ends = [], put = marks.slice().sort((a, b) => a[0] - b[0]).map(([v, lab, col]) => {
      const x = sx(v), w = tw(ctx, lab, 12.5, 760), want = clamp(x - w / 2, x0, x1 - w);
      let r = 0, lx = want;
      for (; r < 4; r++) { lx = Math.max(want, (ends[r] == null ? -1e9 : ends[r]) + 8); if (lx + w <= x1 && lx - want <= 36) break; }
      if (r === 4) { r = 3; lx = want; }
      ends[r] = lx + w; return { x, lx, ly: y0 + 16 * r, lab, col };
    });
    return { put, rows: Math.max(1, ends.length) };
  }
  // a centred label that never runs off the canvas
  function tlab(ctx, s, x, y, px, color, wt, xmin, xmax) { const w = tw(ctx, s, px, wt); text(ctx, s, clamp(x, xmin + w / 2 + 1, xmax - w / 2 - 1), y, px, color, "center", wt); }
  function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  // the three textures: platform-edge dots for riders, LED dots for waits
  function pattern(ctx, kind) {
    const dpr = DPR(), s = 5, c = document.createElement("canvas"); c.width = Math.round(s * dpr); c.height = Math.round(s * dpr);
    const g = c.getContext("2d"); g.scale(dpr, dpr);
    if (kind === "riders") { g.fillStyle = C.edge; g.fillRect(0, 0, s, s); g.fillStyle = "rgba(40,30,0,.5)"; g.beginPath(); g.arc(s / 2, s / 2, 1.05, 0, 6.283); g.fill(); }
    else { g.fillStyle = rgba(C.rgb.led, C.dark ? 0.2 : 0.16); g.fillRect(0, 0, s, s); g.fillStyle = C.led; g.beginPath(); g.arc(s / 2, s / 2, 1.25, 0, 6.283); g.fill(); }
    const p = ctx.createPattern(c, "repeat"); if (p.setTransform) p.setTransform(new DOMMatrix().scale(1 / dpr)); return p;
  }
  function bulletDraw(ctx, r, x, y, rad, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = lineColor(r); ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill();
    ctx.fillStyle = lineText(r); ctx.font = FNT(Math.round(rad * 1.15), 760); if ("fontStretch" in ctx) ctx.fontStretch = "normal";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(sym(r), x, y + rad * 0.06); ctx.restore();
  }
  function yGrid(ctx, x0, x1, ticks, sy, labf, color) {
    ctx.strokeStyle = C.dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)"; ctx.lineWidth = 1;
    ticks.forEach((v) => { const y = Math.round(sy(v)) + 0.5; line(ctx, x0, y, x1, y); if (labf) text(ctx, labf(v), x0 - 6, y + 4, 11.5, color || C.muted, "right", 500); });
  }
  function xAxis(ctx, x0, x1, y, ticks, sx, labf) {
    ctx.strokeStyle = C.muted; ctx.lineWidth = 1; line(ctx, x0, y + 0.5, x1, y + 0.5);
    ticks.forEach((v) => { const x = Math.round(sx(v)) + 0.5; line(ctx, x, y, x, y + 4); text(ctx, labf(v), x, y + 17, 12, C.muted, "center", 500); });
  }
  function niceStep(span, target) { const raw = span / (target || 5), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function onDrag(el, h) {
    const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    el.addEventListener("pointerdown", (e) => { if (h.down(pos(e), e) === false) return; el._dragging = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    el.addEventListener("pointermove", (e) => { if (el._dragging) h.move(pos(e), e); else if (h.hover) h.hover(pos(e), e); });
    const end = (e) => { if (!el._dragging) return; el._dragging = false; if (h.up) h.up(pos(e), e); };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    if (h.leave) el.addEventListener("pointerleave", (e) => { if (!el._dragging) h.leave(e); });
  }
  function tween(obj, target, ms, frame, done) {
    cancelAnimationFrame(obj._tw);
    if (RM || !ms) { Object.assign(obj, target); frame(); if (done) done(); return; }
    const from = {}; for (const k in target) from[k] = obj[k];
    const t0 = performance.now();
    const step = (now) => { const t = Math.min(1, (now - t0) / ms), e = ease(t); for (const k in target) obj[k] = from[k] + (target[k] - from[k]) * e; frame(); if (t < 1) obj._tw = requestAnimationFrame(step); else if (done) done(); };
    obj._tw = requestAnimationFrame(step);
  }
  // seeded random numbers, so a reset replays the same riders
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // =====================================================================
  // redraw only what is on screen; everything else redraws when it scrolls in
  // =====================================================================
  const DRAW = new Map(), VISIBLE = new Set(), DIRTY = new Set();
  function register(id, fn) { DRAW.set(id, fn); DIRTY.add(id); }
  function redraw(id) { if (VISIBLE.has(id)) { DIRTY.delete(id); DRAW.get(id)(); } else DIRTY.add(id); }
  function redrawAll() { DRAW.forEach((_, id) => redraw(id)); }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const id = e.target.dataset.draw; if (!id) return;
    if (e.isIntersecting) { VISIBLE.add(id); if (DIRTY.has(id)) { DIRTY.delete(id); DRAW.get(id)(); } } else VISIBLE.delete(id);
  }), { rootMargin: "200px 0px" });
  function watch(el, id) { el.dataset.draw = id; io.observe(el); }
