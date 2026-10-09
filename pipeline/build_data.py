"""raw/ archives + static/static.json  ->  site/data.js (what the page reads) and build/summary.json (what the checks read).

For each day, a train's time at a stop is the feed's last estimate before the stop dropped off its
schedule; records where a train's planned stops vanished without it continuing down the line are
dropped. Gaps that overlap an outage of the realtime feed are flagged (the page leaves them out).
"""
import base64, datetime as dt, io, json, tarfile
import numpy as np, pandas as pd
import config as C

WINS = {"am": (7 * 3600, 9.5 * 3600), "mid": (10 * 3600, 15 * 3600), "pm": (16.5 * 3600, 19 * 3600), "eve": (20 * 3600, 23 * 3600), "late": (1 * 3600, 5 * 3600)}


def local_midnight(day):
    return int(pd.Timestamp(day + " 00:00", tz=C.TZ).timestamp())


def load_day(day):
    with tarfile.open(C.RAW / f"subwaydatanyc_{day}_csv.tar.xz") as tf:
        names = {m.name.rsplit("/", 1)[-1]: m for m in tf.getmembers()}
        rd = lambda suffix, **kw: pd.read_csv(io.BytesIO(tf.extractfile(names[f"subwaydatanyc_{day}_{suffix}.csv"]).read()), **kw)
        trips = rd("trips", dtype={"route_id": str, "vehicle_id": str})
        st = rd("stop_times", dtype={"stop_id": str, "track": str})
    st = st.merge(trips[["trip_uid", "route_id", "direction_id", "start_time", "num_schedule_rewrites"]], on="trip_uid", how="left")
    return st


def arrivals(days):
    frames, outs = [], []
    for day in days:
        st = load_day(day)
        st["route"] = st.route_id.replace(C.ROUTEMAP)
        st["feed"] = st.route_id.map(C.FEED)
        # an outage: the feed went quiet for more than ten minutes
        for f, g in st.groupby("feed"):
            obs = np.sort(np.unique(g.last_observed.dropna().values.astype(np.int64)))
            d = np.diff(obs)
            for i in np.where(d > 600)[0]:
                outs.append((f, int(obs[i]), int(obs[i + 1])))
        tmax = st.groupby("trip_uid").last_observed.transform("max")
        a = st.arrival_time.where(st.arrival_time.notna(), st.departure_time)
        lo, mp = st.last_observed, st.marked_past
        good = a.notna() & ((lo - a) >= -60)
        cont = mp.notna() & (tmax > mp + 60)
        st["t"] = np.where(good, a, np.where(cont, mp - 30, np.nan))
        st["file_day"] = day
        frames.append(st[st.t.notna()][["file_day", "trip_uid", "route", "route_id", "feed", "stop_id", "t", "direction_id"]])
        print("loaded", day, flush=True)
    st = pd.concat(frames, ignore_index=True)
    st["t"] = st.t.astype(np.int64)
    return st, pd.DataFrame(outs, columns=["feed", "a", "b"])


def dedupe(t):
    t = np.sort(t)
    if len(t) == 0: return t
    return t[np.concatenate([[True], np.diff(t) >= 30])]


def build_series(st, OUT, days):
    day_set = set(days)
    prev_ok = {d: (dt.date.fromisoformat(d) - dt.timedelta(days=1)).isoformat() in day_set for d in days}
    series = {}
    for r in C.LINES:
        sid = C.CHOICE[r]
        for dr in "NS":
            tt = dedupe(st[(st.route == r) & (st.stop_id == sid + dr)].t.values)
            if len(tt) < 50: continue
            per = []
            for day in days:
                m0 = local_midnight(day)
                x = tt[(tt >= m0) & (tt < m0 + 86400)]
                o = OUT[OUT.feed == C.FEED[r]]
                brk = np.zeros(max(len(x) - 1, 0), bool)
                for ob in o.itertuples():
                    brk |= (x[1:] > ob.a - 120) & (x[:-1] < ob.b + 120)
                per.append(dict(day=day, t=(x - m0).tolist(), brk=np.where(brk)[0].tolist(), early_ok=prev_ok[day]))
            series[(r, dr)] = per
    return series


def build_marey(st, S, day):
    m0 = local_midnight(day); A, B = m0 + C.MAREY_A, m0 + C.MAREY_B
    day_st = st[(st.t >= A - 3600) & (st.t <= B + 3600)]
    mar = {}
    for r in C.LINES:
        for dr in "NS":
            p = S["pattern"].get(f"{r}|{dr}")
            if not p: continue
            idx = {s: i for i, s in enumerate(p["ids"])}
            d = day_st[(day_st.route == r) & (day_st.stop_id.isin(idx))]
            trips = []
            for _, g in d.groupby("trip_uid"):
                g = g.assign(k=g.stop_id.map(idx)).sort_values("k")
                pts = [(int(k), int(t - m0)) for k, t in zip(g.k, g.t) if A <= t <= B]
                if len(pts) >= 3: trips.append(pts)
            mar[(r, dr)] = dict(stops=p["names"], km=p["km"], here=p["here"], trips=trips)
    return mar


def hidden_trains(st, S, series):
    """Trains recorded at the stations on both sides of the platform but never at the platform itself."""
    out = {}
    for (r, dr) in series:
        p = S["pattern"].get(f"{r}|{dr}")
        if not p: continue
        i, ids = p["here"], p["ids"]; target = ids[i]
        nb = [s for s in (ids[i - 1] if i > 0 else None, ids[i + 1] if i + 1 < len(ids) else None) if s]
        g = st[(st.route == r) & (st.stop_id.isin(nb + [target]))]
        piv = g.pivot_table(index="trip_uid", columns="stop_id", values="t", aggfunc="min")
        has_t = piv[target].notna() if target in piv else pd.Series(False, index=piv.index)
        cols = [s for s in nb if s in piv]
        if not cols: continue
        both = piv[cols].notna().all(axis=1) if len(nb) == 2 and len(cols) == 2 else piv[cols[0]].notna()
        n = int((both & ~has_t).sum())
        if n: out[r + dr] = n
    return out


def coverage(series, S, days):
    """Share of timetabled weekday trains (6 am to midnight) with no arrival recorded at the platform."""
    sch = obs = 0
    for (r, dr), per in series.items():
        x = np.array(S["sched"].get(f"{r}|{dr}|Weekday", []))
        n_s = int(((x >= 6 * 3600) & (x < 24 * 3600)).sum())
        for p in per:
            if not dt.date.fromisoformat(p["day"]).weekday() < 5: continue
            t = np.array(p["t"]); n_o = int(((t >= 6 * 3600) & (t < 24 * 3600)).sum())
            sch += n_s; obs += min(n_o, n_s)
    return round(1 - obs / max(sch, 1), 4)


def gaps(per, w):
    lo, hi = WINS[w]; out = []
    for p in per:
        if dt.date.fromisoformat(p["day"]).weekday() >= 5: continue
        if w == "late" and not p["early_ok"]: continue
        t, b = p["t"], set(p["brk"])
        for i in range(len(t) - 1):
            if i in b: continue
            if t[i] >= lo and t[i + 1] <= hi: out.append((t[i + 1] - t[i]) / 60)
    return np.array(out)


# ---------- packing (the page decodes the same varints) ----------
def uv(buf, x):
    x = int(x); assert x >= 0
    while True:
        b = x & 0x7F; x >>= 7
        if x: buf.append(b | 0x80)
        else: buf.append(b); return


def sv(buf, x):
    x = int(x); uv(buf, (x << 1) if x >= 0 else ((-x << 1) - 1))


def encode(series, S, mar, days, meta_extra):
    ser = bytearray()
    for r in C.LINES:
        for dr in "NS":
            per = series.get((r, dr)); uv(ser, 1 if per else 0)
            if not per: continue
            for p in per:
                t = p["t"]; uv(ser, len(t)); prev = 0
                for x in t: sv(ser, x - prev); prev = x
                uv(ser, len(p["brk"])); prev = 0
                for b in p["brk"]: uv(ser, b - prev); prev = b
    sch = bytearray()
    for r in C.LINES:
        for dr in "NS":
            for svc in ["Weekday", "Sunday"]:
                x = S["sched"].get(f"{r}|{dr}|{svc}", []); uv(sch, len(x)); prev = 0
                for v in x: sv(sch, v - prev); prev = v
    names, nidx = [], {}
    def ni(s):
        if s not in nidx: nidx[s] = len(names); names.append(s)
        return nidx[s]
    mb = bytearray()
    for r in C.LINES:
        for dr in "NS":
            m = mar.get((r, dr)); uv(mb, 1 if m else 0)
            if not m: continue
            uv(mb, len(m["stops"]))
            for s in m["stops"]: uv(mb, ni(s))
            prev = 0
            for k in m["km"]: v = int(round(k * 100)); uv(mb, v - prev); prev = v
            uv(mb, m["here"]); uv(mb, len(m["trips"]))
            for tr in m["trips"]:
                uv(mb, len(tr)); pk, pt = 0, 6 * 3600
                for k, t in tr: sv(mb, k - pk); sv(mb, t - pt); pk, pt = k, t
    L = S["lines"]
    meta = dict(lines=C.LINES, days=days, dirlab={r: C.DIRLAB[r] for r in C.LINES}, color={r: L[r]["color"] for r in C.LINES},
                textc={r: L[r]["text"] for r in C.LINES}, station={r: L[r]["station"] for r in C.LINES},
                longname={r: L[r]["longname"] for r in C.LINES}, names=names, **meta_extra)
    b64 = lambda b: base64.b64encode(bytes(b)).decode()
    return "const MTA=" + json.dumps(dict(meta=meta, ser=b64(ser), sch=b64(sch), mar=b64(mb)), separators=(",", ":"), ensure_ascii=False) + ";"


def main():
    days = json.loads((C.RAW / "days.json").read_text())
    S = json.loads(C.STATIC.read_text())
    st, OUT = arrivals(days)
    series = build_series(st, OUT, days)
    tues = [d for d in days if dt.date.fromisoformat(d).weekday() == 1]
    marey_day = (tues or days)[-1]          # the most recent Tuesday in the window
    mar = build_marey(st, S, marey_day)
    missed = hidden_trains(st, S, series)
    cov = coverage(series, S, days)
    js = encode(series, S, mar, days, dict(mareyDay=marey_day, missed=missed, coverage=cov,
                                          built=dt.date.today().isoformat(), timetable=S.get("feed_info", {})))
    C.SITE.mkdir(parents=True, exist_ok=True); C.BUILD.mkdir(parents=True, exist_ok=True)
    (C.SITE / "data.js").write_text(js, encoding="utf-8")
    summ = dict(days=days, mareyDay=marey_day, missed=missed, coverage=cov, outages=len(OUT),
                marey_trips={f"{r}|{d}": len(m["trips"]) for (r, d), m in mar.items()}, lines={})
    for (r, dr), per in series.items():
        for w in WINS:
            h = gaps(per, w)
            if len(h) < 2: continue
            summ["lines"][f"{r}|{dr}|{w}"] = dict(n=len(h), mu=round(h.mean(), 4), cv=round(h.std() / h.mean(), 4),
                                                   EW=round((h ** 2).sum() / (2 * h.sum()), 4), mx=round(h.max(), 2),
                                                   brk=sum(len(p["brk"]) for p in per))
    (C.BUILD / "summary.json").write_text(json.dumps(summ, indent=1))
    # keep the decoded series for the round-trip check
    (C.BUILD / "series.json").write_text(json.dumps({f"{r}|{d}": [dict(t=p["t"], brk=p["brk"]) for p in per] for (r, d), per in series.items()}))
    print("data.js", len(js) // 1024, "KB;", len(series), "line-directions;", "train graph day", marey_day, "; hidden trains", missed, "; missing from record", cov)


if __name__ == "__main__":
    main()
