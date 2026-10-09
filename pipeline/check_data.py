"""Checks on the rebuilt data. Any failure stops the publish, so yesterday's page stays up.

1. site/data.js decodes (the same way the page does) back to exactly the series that were built.
2. Enough days, and every line and direction present with a sensible amount of data.
3. Averages and unevenness in plausible ranges (catches a changed file format or a broken feed day).
4. The train graph has trains on most lines.
"""
import base64, json, sys
import config as C

fails, warns = [], []


def decode(js):
    j = json.loads(js[len("const MTA="):-1])
    u, p = base64.b64decode(j["ser"]), [0]
    def uv():
        x, m = 0, 1
        while True:
            b = u[p[0]]; p[0] += 1; x += (b & 127) * m; m *= 128
            if not b & 128: return x
    def sv():
        q = uv(); return -(q + 1) // 2 if q % 2 else q // 2
    out = {}
    for r in j["meta"]["lines"]:
        for d in "NS":
            if not uv(): continue
            per = []
            for _ in j["meta"]["days"]:
                n = uv(); t, prev = [], 0
                for _ in range(n): prev += sv(); t.append(prev)
                nb = uv(); brk, pb = [], 0
                for _ in range(nb): pb += uv(); brk.append(pb)
                per.append(dict(t=t, brk=brk))
            out[f"{r}|{d}"] = per
    assert p[0] == len(u), "trailing bytes in the series"
    return j["meta"], out


def decode_line(txt, ndays):
    """Decode one site/lines/<line>.js the way the page does: {"N|A27": [days...]}, plus timetable and train-graph counts."""
    j = json.loads(txt[txt.index("] = ") + 4: txt.rstrip().rindex(";")])
    def rd(b64):
        u, p = base64.b64decode(b64), [0]
        def uv():
            x, m = 0, 1
            while True:
                b = u[p[0]]; p[0] += 1; x += (b & 127) * m; m *= 128
                if not b & 128: return x
        def sv():
            q = uv(); return -(q + 1) // 2 if q % 2 else q // 2
        return uv, sv, lambda: p[0] == len(u)
    uv, sv, end = rd(j["ser"]); ser = {}
    for d in "NS":
        for row in j["dirs"][d]:
            per = []
            for _ in range(ndays):
                n = uv(); t, prev = [], 0
                for _ in range(n): prev += sv(); t.append(prev)
                nb = uv(); brk, pb = [], 0
                for _ in range(nb): pb += uv(); brk.append(pb)
                per.append(dict(t=t, brk=brk))
            ser[d + "|" + row[0]] = per
    assert end(), "trailing bytes in a line's series"
    uv, sv, end = rd(j["sch"]); nsch = 0
    for d in "NS":
        for row in j["dirs"][d]:
            n = uv(); nsch += n
            for _ in range(n): sv()
    assert end(), "trailing bytes in a line's timetable"
    uv, sv, end = rd(j["mar"]); trips = 0
    for d in "NS":
        for _ in range(uv()):
            ns = uv()
            for _ in range(ns): uv()
            for _ in range(ns): uv()
            for _ in range(uv()):
                trips += 1
                for _ in range(uv()): sv(); sv()
    assert end(), "trailing bytes in a line's train graphs"
    return j, ser, nsch, trips


def main():
    meta, got = decode((C.SITE / "data.js").read_text(encoding="utf-8"))
    want = json.loads((C.BUILD / "series.json").read_text())
    if got != want: fails.append("data.js does not decode back to the built series")
    S = json.loads((C.BUILD / "summary.json").read_text())
    days = S["days"]
    if len(days) < 8: fails.append(f"only {len(days)} days")
    for r in C.LINES:
        for d in "NS":
            k = f"{r}|{d}|am"
            if k not in S["lines"]:
                fails.append(f"no morning data for {r} {d}"); continue
            x = S["lines"][k]
            if x["n"] < 40: fails.append(f"{r} {d} mornings: only {x['n']} gaps")
            if not 1.5 <= x["mu"] <= 20: fails.append(f"{r} {d} mornings: average gap {x['mu']:.2f} min is implausible")
            if not 0.03 <= x["cv"] <= 2.0: fails.append(f"{r} {d} mornings: CV {x['cv']:.2f} is implausible")
            if x["mx"] > 90: warns.append(f"{r} {d} mornings: a {x['mx']:.0f}-minute gap")
    full = sum(1 for v in S["marey_trips"].values() if v >= 5)
    if full < 30: fails.append(f"the train graph has trains on only {full} line-directions")
    if S["coverage"] > 0.25: fails.append(f"{S['coverage']:.0%} of timetabled trains missing from the record")
    if meta["mareyDay"] not in days: fails.append("train graph day is not in the window")
    # drift against the previous build, if the cache kept one: report, don't block (service changes are real)
    prev = C.RAW / "summary_prev.json"   # kept in the archive cache between runs
    if prev.exists():
        P = json.loads(prev.read_text())["lines"]
        for k, x in S["lines"].items():
            if k.endswith("|am") and k in P and abs(x["mu"] / P[k]["mu"] - 1) > 0.35:
                warns.append(f"{k}: average gap moved from {P[k]['mu']:.2f} to {x['mu']:.2f} min since the last build")
    # every station: each line's file decodes back to exactly what was built, and the picker lists match the files
    allw = json.loads((C.BUILD / "all_series.json").read_text())
    nst = 0
    for r in C.LINES:
        f = C.SITE / "lines" / f"{r}.js"
        if not f.exists(): fails.append(f"missing lines/{r}.js"); continue
        try:
            j, ser, nsch, trips = decode_line(f.read_text(encoding="utf-8"), len(days))
        except Exception as e:
            fails.append(f"lines/{r}.js does not decode: {e}"); continue
        for k, per in ser.items():
            d, pid = k.split("|")
            if allw.get(f"{r}|{d}|{pid}{d}") != per: fails.append(f"lines/{r}.js: {pid} {d} differs from the build"); break
        listed = {x[0] for x in meta["stops"][r]}
        have = {row[0] for d in "NS" for row in j["dirs"][d]}
        if not listed <= have: fails.append(f"{r}: picker lists stations with no data: {sorted(listed - have)[:5]}")
        if meta["home"][r] not in listed: fails.append(f"{r}: home station missing from the picker")
        if trips < 5 and r != "GS": fails.append(f"{r}: train graphs nearly empty")   # the shuttle has two stops, so no graph
        nst += len(listed)
    if nst < 600: fails.append(f"only {nst} station choices")
    for w in warns: print("note:", w)
    if fails:
        print("\n".join("FAIL: " + f for f in fails)); sys.exit("data check failed")
    prev.write_text((C.BUILD / "summary.json").read_text())
    print(f"data check passed: {len(days)} days ({days[0]} to {days[-1]}), {len(got)} line-directions at the home stations, {nst} station choices, train graph {meta['mareyDay']}")


if __name__ == "__main__":
    main()
