"""Open the built page in a headless browser and drive every state: every line, direction and time
window, every distribution in the size-bias machine, and the give-up section at several fallbacks.
Fails on any script error, any NaN / undefined / Infinity in the page's text, or sideways overflow
on a phone-width screen.

    python pipeline/check_render.py
(set CHROMIUM_PATH to use a specific browser binary)
"""
import asyncio, json, os, shutil, sys
from playwright.async_api import async_playwright
import config as C

HOOK = ('  window.__T = { setState, ST, LINES, WINS, SER, valid, drawAll: () => DRAW.forEach((f) => f()), startRain, '
        'MX, MXF, mxGo, mxReset, GU, drawGiveup };\n')

SWEEP = """() => {
  const T = window.__T, bad = []; let n = 0;
  const scan = (tag) => { const txt = Array.from(document.querySelectorAll('.readout,.note,.cap,.keys,#hero-q,#dest-txt,#guess-out,#marey-cap,#led-sr,#mx-name,#gu-board,#credits')).map((e) => e.textContent).join(' | ');
    const m = txt.match(/.{0,60}(NaN|undefined|Infinity|null).{0,30}/); if (m) bad.push([tag, m[0]]); };
  T.MX.fam = "line"; T.mxReset();
  for (const r of T.LINES) for (const d of ["N", "S"]) for (const w of T.WINS) {
    if (!T.SER[r][d] || !T.valid(r, d, w.id)) continue;
    try { T.setState({ line: r, dir: d, win: w.id }); T.mxGo(1); T.drawAll(); T.startRain(); } catch (e) { bad.push([r + d + w.id, String(e) + " " + e.stack]); continue; }
    n++; scan(r + d + w.id);
    for (const c of [3, 10, 30]) for (const t of [0, 99]) { T.GU.c = c; T.GU.t = t;
      try { T.drawGiveup(); } catch (e) { bad.push([r + d + w.id + " giveup", String(e)]); } scan(r + d + w.id + " c" + c + " t" + t); }
  }
  T.setState({ line: "A", dir: "N", win: "am" });
  for (const fam of Object.keys(T.MXF)) for (let L = 0; L <= 4; L++) {
    try { T.MX.fam = fam; T.mxReset(); T.MX.level = L; T.MX.shown = L; T.MX.xmax = null; T.MX.wait = L % 2 === 1; T.drawAll(); } catch (e) { bad.push([fam + L, String(e)]); }
    scan(fam + L);
  }
  const dates = document.getElementById('dest-txt').textContent;
  return { states: n, bad: bad.slice(0, 12), nbad: bad.length, dates };
}"""


async def main():
    work = C.BUILD / "render"; work.mkdir(parents=True, exist_ok=True)
    html = (C.SITE / "index.html").read_text(encoding="utf-8")
    anchor = "  setState({});\n"
    if html.count(anchor) != 1:
        sys.exit("could not find where to attach the test hook")
    (work / "index.html").write_text(html.replace(anchor, anchor + HOOK), encoding="utf-8")
    shutil.copyfile(C.SITE / "data.js", work / "data.js")
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
