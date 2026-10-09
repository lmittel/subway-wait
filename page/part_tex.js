  const TEXSYM = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", varepsilon: "ε", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ", chi: "χ", omega: "ω", Phi: "Φ", Sigma: "Σ", infty: "∞", partial: "∂", ell: "ℓ" };
  const TEXOP = { Rightarrow: "⇒", mid: "∣", times: "×", cdot: "·", approx: "≈", sim: "∼", le: "≤", ge: "≥", leq: "≤", geq: "≥", to: "→", propto: "∝", pm: "±", int: "∫", sum: "∑", ne: "≠", div: "÷", in: "∈", cap: "∩", cup: "∪", ldots: "…", cdots: "⋯" };
  const TEXSP = { ",": "0.1667em", ";": "0.2778em", " ": "0.25em", quad: "1em", qquad: "2em" };
  const OPCH = "+−=<>,/|:;!·×≈∼≤≥→∝±∫∑÷∈…'⇒∣";
  function tex(src, opts) {
    let i = 0;
    const esc = (c) => c.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const wrap = (a) => (a.length === 1 ? a[0] : "<mrow>" + a.join("") + "</mrow>");
    const cmd = () => { i++; if (!/[A-Za-z]/.test(src[i])) return src[i++]; let n = ""; while (i < src.length && /[A-Za-z]/.test(src[i])) n += src[i++]; return n; };
    const raw = () => { ws(); if (src[i] !== "{") return src[i++]; let d = 1, s = ""; i++; while (i < src.length) { const c = src[i++]; if (c === "{") d++; else if (c === "}" && !--d) break; s += c; } return s; };
    function arg() { ws(); if (src[i] === "{") { i++; return wrap(list("}")); } return atom(); }
    function list(end) {
      const out = [];
      while (i < src.length) {
        ws(); if (i >= src.length) break;
        if (end && src.startsWith(end, i)) { i += end.length; break; }
        let a = atom(); if (a === null) continue;
        if (a === "<mo>−</mo>" && (!out.length || out[out.length - 1].startsWith("<mo"))) a = '<mo form="prefix">−</mo>';
        let sub = null, sup = null;
        for (;;) { ws(); if (src[i] === "^" && sup === null) { i++; sup = arg(); } else if (src[i] === "_" && sub === null) { i++; sub = arg(); } else break; }
        if (sub && a.startsWith("<mi")) a = '<mpadded depth="0">' + a + "</mpadded>";
        if (sub && sup) a = "<msubsup>" + a + sub + sup + "</msubsup>"; else if (sup) a = "<msup>" + a + sup + "</msup>"; else if (sub) a = "<msub>" + a + sub + "</msub>";
        out.push(a);
      }
      return out;
    }
    function atom() {
      const c = src[i];
      if (c === "{") { i++; return wrap(list("}")); }
      if (c === "(" || c === "[") { const cl = c === "(" ? ")" : "]"; i++; return '<mrow><mo stretchy="false">' + c + "</mo>" + list(cl).join("") + '<mo stretchy="false">' + cl + "</mo></mrow>"; }
      if (c === "\\") {
        const n = cmd();
        if (n === "left") { const o = src[i++]; const inner = list("\\right"); const cl = src[i++]; return "<mrow><mo>" + esc(o) + "</mo>" + inner.join("") + "<mo>" + esc(cl) + "</mo></mrow>"; }
        if (n === "bigl") { const o = src[i++]; const inner = list("\\bigr"); const cl = src[i++], bo = (d) => '<mo stretchy="true" symmetric="true" minsize="1.2em" maxsize="1.2em">' + esc(d) + "</mo>"; return "<mrow>" + bo(o) + inner.join("") + bo(cl) + "</mrow>"; }
        if (n === "frac") { const a = arg(), b = arg(); return "<mfrac>" + a + b + "</mfrac>"; }
        if (n === "sqrt") return "<msqrt>" + arg() + "</msqrt>";
        if (n === "text") return "<mtext>" + esc(raw()).replace(/ /g, "&#160;") + "</mtext>";
        if (n === "mathrm") return '<mi mathvariant="normal">' + esc(raw()) + "</mi>";
        if (n === "eqd") return '<mover><mo>=</mo><mi>d</mi></mover>';
        if (n === "prime") return '<mo lspace="0" rspace="0">′</mo>';
        if (n === "ln" || n === "log" || n === "exp" || n === "min" || n === "max") return "<mi>" + n + "</mi><mo>&#x2061;</mo><mspace width=\"0.1667em\"/>";
        if (n === "cls") { const k = raw(); ws(); i++; return '<mrow class="' + k + '">' + list("}").join("") + "</mrow>"; }
        if (TEXSP[n]) return '<mspace width="' + TEXSP[n] + '"/>';
        if (n === "{" || n === "}") return '<mo stretchy="false">' + n + "</mo>";
        if (TEXSYM[n]) return "<mi>" + TEXSYM[n] + "</mi>";
        if (TEXOP[n]) return n === "int" || n === "sum" ? '<mo class="bigop">' + TEXOP[n] + "</mo>" : "<mo>" + TEXOP[n] + "</mo>";
        return "<mtext>" + esc(n) + "</mtext>";
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) { let n = ""; while (i < src.length && /[0-9.]/.test(src[i]) && !(src[i] === "." && !/[0-9]/.test(src[i + 1] || ""))) n += src[i++]; return "<mn>" + n + "</mn>"; }
      i++;
      if (c === "-") return "<mo>−</mo>";
      if (c === "*") return '<mo lspace="0" rspace="0">∗</mo>';
      if (c === "/") return '<mo lspace="0" rspace="0">/</mo>';
      if (c === ",") return '<mo rspace="0.25em">,</mo>';
      if (c === "|") return '<mo lspace="0" rspace="0" stretchy="false">|</mo>';
      if (OPCH.includes(c)) return "<mo>" + esc(c === "'" ? "′" : c) + "</mo>";
      if (c === "∞") return "<mi>∞</mi>";
      if (c === "." ) return "<mo>.</mo>";
      return "<mi>" + esc(c) + "</mi>";
    }
    const body = list(null).join("");
    return "<math" + (opts && opts.display ? ' displaystyle="true"' : "") + ">" + body + "</math>";
  }
  const M = (s, ...v) => tex(String.raw(s, ...v));
  const MD = (s, ...v) => tex(String.raw(s, ...v), { display: true });

  // the page's static formulas are written as TeX in .tx spans; render them as MathML
  document.querySelectorAll(".tx").forEach((el) => { el.innerHTML = tex(el.textContent); });
  // Chrome leaves a gap after a square root; measure it once and close it (other engines are left alone)
  function fixRadicals() {
    const pr = document.createElement("span"); pr.style.cssText = "position:absolute;left:-999px;top:0;visibility:hidden;font-size:40px"; pr.innerHTML = tex("\\sqrt{x}"); document.body.appendChild(pr);
    const r = pr.querySelector("msqrt"), k = r && r.firstElementChild;
    if (r && k) { const gap = r.getBoundingClientRect().right - k.getBoundingClientRect().right, em = parseFloat(getComputedStyle(r).fontSize) || 40; document.documentElement.style.setProperty("--radfix", gap > 0.15 * em ? (0.06 - gap / em).toFixed(3) + "em" : "0px"); }
    pr.remove();
  }
  fixRadicals(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fixRadicals);
