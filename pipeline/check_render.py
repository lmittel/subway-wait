"""Open the built page in a headless browser and drive every state: every line, direction and time
window, every distribution in the size-bias machine, every step of the derivation, the give-up section
at several ride and other-way times, and every station platform on every line.
Fails on any script error, any NaN / undefined / Infinity in the page's text, or sideways overflow
on a phone-width screen.

    python pipeline/check_render.py
(set CHROMIUM_PATH to use a specific browser binary)
"""
import asyncio, json, os, shutil, sys
from playwright.async_api import async_playwright
import config as C

HOOK = ('  window.__T = { setState, ST, LINES, WINS, SER, valid, drawAll: () => DRAW.forEach((f) => f()), startRain, '
        'MX, MXF, mxGo, mxReset, GU, drawGiveup, PF, drawProof, loadLine, stopsOf, HOME, META };\n')

SWEEP = """() => {
  const T = window.__T, bad = []; let n = 0;
  const scan = (tag) => { const txt = Array.from(document.querySelectorAll('.readout,.note,.cap,.keys,#hero-q,#dest-txt,#guess-out,#marey-cap,#led-sr,#mx-name,#gu-board,#credits,#pf-title,#pf-why')).map((e) => e.textContent).join(' | ');
    const m = txt.match(/.{0,60}(NaN|undefined|Infinity|null).{0,30}/); if (m) bad.push([tag, m[0]]); };
  T.MX.fam = "line"; T.mxReset();
  for (const r of T.LINES) for (const d of ["N", "S"]) for (const w of T.WINS) {
    if (!T.SER[r][d] || !T.valid(r, d, w.id)) continue;
    try { T.setState({ line: r, dir: d, win: w.id }); T.mxGo(1); T.drawAll(); T.startRain(); } catch (e) { bad.push([r + d + w.id, String(e) + " " + e.stack]); continue; }
    n++; scan(r + d + w.id);
    for (let i = 0; i < 10; i++) { T.PF.i = i; T.PF.t = 1; T.PF.txtKey = "";
      try { T.drawProof(); } catch (e) { bad.push([r + d + w.id + " proof " + (i + 1), String(e) + " " + e.stack]); } scan(r + d + w.id + " proof " + (i + 1)); }
    for (const [ride, alt] of [[15, 18], [15, 25], [10, 40], [20, 15]]) for (const t of [0, 99]) { T.GU.ride = ride; T.GU.alt = alt; T.GU.t = t;
      try { T.drawGiveup(); } catch (e) { bad.push([r + d + w.id + " giveup", String(e)]); } scan(r + d + w.id + " ride" + ride + " alt" + alt + " t" + t); }
  }
  T.setState({ line: "A", dir: "N", win: "am" });
  for (const fam of Object.keys(T.MXF)) for (let L = 0; L <= 4; L++) {
    try { T.MX.fam = fam; T.mxReset(); T.MX.level = L; T.MX.shown = L; T.MX.xmax = null; T.MX.wait = L % 2 === 1; T.drawAll(); } catch (e) { bad.push([fam + L, String(e)]); }
    scan(fam + L);
  }
  const dates = document.getElementById('dest-txt').textContent;
  return { states: n, bad: bad.slice(0, 12), nbad: bad.length, dates };
}"""

# every station on every line: load the line's file, then draw every module for each platform
STATIONS = """async (every) => {
  const T = window.__T, bad = []; let n = 0, k = 0;
  const scan = (tag) => { const txt = Array.from(document.querySelectorAll('.readout,.note,.cap,.keys,#hero-q,#dest-txt,#marey-cap,#led-sr,#pf-title,#pf-why,#n-down')).map((e) => e.textContent).join(' | ');
    const m = txt.match(/.{0,60}(NaN|undefined|Infinity|null).{0,30}/); if (m) bad.push([tag, m[0]]); };
  for (const r of T.LINES) {
    try { await T.loadLine(r); } catch (e) { bad.push([r, "could not load lines/" + r + ".js"]); continue; }
    for (const [pid] of T.stopsOf(r)) {
      if (k++ % every) continue;
      for (const d of ["N", "S"]) {
        try { T.setState({ line: r, stop: pid, dir: d }); if (window.__T.ST.dir !== d) continue; T.drawAll(); n++; scan(r + " " + pid + " " + d + " " + T.ST.win); }
        catch (e) { bad.push([r + " " + pid + " " + d, String(e) + " " + (e.stack || "").slice(0, 300)]); }
      }
    }
  }
  T.setState({ line: "A", dir: "N", stop: T.META.home.A, win: "am" });
  return { n, bad: bad.slice(0, 12), nbad: bad.length };
}"""


async def main():
    work = C.BUILD / "render"; work.mkdir(parents=True, exist_ok=True)
    html = (C.SITE / "index.html").read_text(encoding="utf-8")
    anchor = "  // open on the station in the address (a shared link), or the default\n"
    if html.count(anchor) != 1:
        sys.exit("could not find where to attach the test hook")
    (work / "index.html").write_text(html.replace(anchor, HOOK + anchor), encoding="utf-8")
    shutil.copyfile(C.SITE / "data.js", work / "data.js")
    if (work / "lines").exists(): shutil.rmtree(work / "lines")
    shutil.copytree(C.SITE / "lines", work / "lines")
    url = (work / "index.html").as_uri()
    fail = []
    async with async_playwright() as p:
        kw = {"executable_path": os.environ["CHROMIUM_PATH"]} if os.environ.get("CHROMIUM_PATH") else {}
        b = await p.chromium.launch(**kw)
        for W in (1280, 390):
            ctx = await b.new_context(viewport={"width": W, "height": 900})
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.route("https://fonts.googleapis.com/**", lambda r: r.abort())
            await pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
            await pg.goto(url); await pg.wait_for_timeout(1200)
            # scroll the whole page so every lazily drawn chart draws once
            h = await pg.evaluate("document.body.scrollHeight")
            for y in range(0, h, 700):
                await pg.evaluate(f"window.scrollTo(0,{y})"); await pg.wait_for_timeout(60)
            await pg.evaluate("document.querySelectorAll('details').forEach((d) => d.open = true)")
            over = await pg.evaluate("""() => { const W = document.documentElement.clientWidth, out = [];
              document.querySelectorAll('body *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.right > W + 1 && r.width > 0 && !e.closest('.formula')) out.push(e.tagName + '#' + e.id + '.' + (e.className.baseVal === undefined ? e.className : '')); });
              return out.slice(0, 8); }""")
            res = await pg.evaluate(SWEEP)
            print(W, "px:", res["states"], "states,", res["nbad"], "problems; dates:", res["dates"][-60:], flush=True)
            stn = await pg.evaluate(STATIONS, 1 if W > 600 else 4)
            print(W, "px:", stn["n"], "station platforms drawn,", stn["nbad"], "problems", flush=True)
            if stn["nbad"]: fail.append(f"{W}px station problems: {stn['bad']}")
            if stn["n"] < (1300 if W > 600 else 300): fail.append(f"{W}px only {stn['n']} station platforms drew")
            if errs: fail.append(f"{W}px script errors: {errs[:3]}")
            if res["nbad"]: fail.append(f"{W}px bad text or errors: {res['bad']}")
            if res["states"] < 150: fail.append(f"{W}px only {res['states']} line/window states drew (expected about 200)")
            if over: fail.append(f"{W}px content wider than the screen: {over}")
            await ctx.close()
        await b.close()
    if fail:
        print("\n".join(fail)); sys.exit("render check failed")
    print("render check passed")


if __name__ == "__main__":
    asyncio.run(main())
