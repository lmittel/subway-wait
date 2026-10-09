"""Make static/static.json from the MTA's static subway GTFS: colours, station names, the weekday and
Sunday timetable at each chosen platform, and each line's usual stop pattern (for the train graph).

    python pipeline/gtfs_static.py path/to/gtfs_subway.zip      (or an unzipped folder)
"""
import io, json, math, sys, zipfile
import numpy as np, pandas as pd
import config as C


def reader(src):
    if src.endswith(".zip"):
        z = zipfile.ZipFile(src)
        return lambda name: pd.read_csv(io.BytesIO(z.read(name)), dtype=str)
    return lambda name: pd.read_csv(f"{src}/{name}", dtype=str)


def hms(x):
    h, m, s = map(int, x.split(":")); return h * 3600 + m * 60 + s


def main(src):
    rd = reader(src)
    stops, routes = rd("stops.txt"), rd("routes.txt").set_index("route_id")
    NAME = dict(zip(stops.stop_id, stops.stop_name))
    LAT = dict(zip(stops.stop_id, stops.stop_lat.astype(float))); LON = dict(zip(stops.stop_id, stops.stop_lon.astype(float)))
    tr = rd("trips.txt"); tr["route"] = tr.route_id.replace(C.ROUTEMAP)
    stt = rd("stop_times.txt")
    try:
        fi = rd("feed_info.txt").iloc[0].to_dict()
    except Exception:
        fi = {}
    svc_ids = set(tr.service_id)
    if "Weekday" not in svc_ids:
        sys.exit(f"GTFS service ids changed (found {sorted(svc_ids)[:8]}); update gtfs_static.py")

    out = dict(feed_info={k: fi.get(k) for k in ("feed_version", "feed_start_date", "feed_end_date")},
               lines={}, sched={}, pattern={})
    for r in C.LINES:
        out["lines"][r] = dict(color="#" + routes.loc[r, "route_color"], text="#" + routes.loc[r, "route_text_color"],
                               longname=routes.loc[r, "route_long_name"], station=NAME[C.CHOICE[r]])
    for svc in ["Weekday", "Sunday"]:
        ids = set(tr[tr.service_id == svc].trip_id)
        s2 = stt[stt.trip_id.isin(ids)].merge(tr[["trip_id", "route"]], on="trip_id")
        for r in C.LINES:
            for dr in "NS":
                x = np.sort(s2[(s2.route == r) & (s2.stop_id == C.CHOICE[r] + dr)].arrival_time.map(hms).values)
                if len(x): out["sched"][f"{r}|{dr}|{svc}"] = [int(v) for v in x]

    wk = set(tr[tr.service_id == "Weekday"].trip_id)
    stw = stt[stt.trip_id.isin(wk)].merge(tr[["trip_id", "route"]], on="trip_id")
    stw["stop_sequence"] = stw.stop_sequence.astype(int)

    def hav(a, b):
        la1, lo1, la2, lo2 = map(math.radians, [LAT[a], LON[a], LAT[b], LON[b]])
        h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
        return 2 * 6371 * math.asin(math.sqrt(h))

    for r in C.LINES:
        for dr in "NS":
            target = C.CHOICE[r] + dr
            here = stw[(stw.route == r) & (stw.stop_id == target)].trip_id.unique()
            if len(here) == 0: continue
            # the most common stop pattern among weekday trips that serve the platform
            pats = stw[stw.trip_id.isin(here)].sort_values(["trip_id", "stop_sequence"]).groupby("trip_id").stop_id.agg(tuple)
            pat = list(pats.value_counts().index[0])
            km = [0.0]
            for a_, b_ in zip(pat[:-1], pat[1:]): km.append(km[-1] + hav(a_, b_))
            out["pattern"][f"{r}|{dr}"] = dict(ids=pat, names=[NAME[s[:-1]] for s in pat], km=[round(k, 3) for k in km], here=pat.index(target))
    # ---------- every station each line serves ----------
    # For each line and direction: the weekday stop patterns (most common first), a small set of patterns
    # that between them cover every stop served by at least 5 weekday trips, and each stop's timetable.
    out["served"], out["pats"], out["sched_all"], out["order"], out["stations"] = {}, {}, {}, {}, {}
    stw = stw.sort_values(["trip_id", "stop_sequence"])
    by_trip = stw.groupby("trip_id").agg(route=("route", "first"), stops=("stop_id", tuple))
    wk_times = stw.assign(sec=stw.arrival_time.map(hms))
    for r in C.LINES:
        for dr in "NS":
            pc = by_trip[(by_trip.route == r) & by_trip.stops.map(lambda s: len(s) > 0 and s[0].endswith(dr))].stops.value_counts()
            if pc.empty: continue
            cnt = {}
            for pat, n in pc.items():
                for s in pat: cnt[s] = cnt.get(s, 0) + n
            ok = {s for s, n in cnt.items() if n >= 5}
            cover, covered = [], set()
            for pat, n in pc.items():
                if n < 3: break
                if any(s in ok and s not in covered for s in pat):
                    cover.append(list(pat)); covered |= set(pat)
                if ok <= covered: break
            pats = []
            for pat in cover:
                km = [0.0]
                for a_, b_ in zip(pat[:-1], pat[1:]): km.append(km[-1] + hav(a_, b_))
                pats.append(dict(ids=pat, names=[NAME[s[:-1]] for s in pat], km=[round(k, 3) for k in km]))
            served = [s for s in dict.fromkeys(s for p in cover for s in p) if s in ok]
            out["pats"][f"{r}|{dr}"] = pats
            out["served"][f"{r}|{dr}"] = served
            sub = wk_times[(wk_times.route == r) & wk_times.stop_id.isin(served)]
            sch = {}
            for sid, g in sub.groupby("stop_id"):
                x = np.sort(g.sec.values); d = np.diff(np.concatenate([[0], x]))
                sch[sid] = [int(v) for v in d]          # stored as differences; the build adds them back up
            out["sched_all"][f"{r}|{dr}"] = sch
        # one list of stations per line, in the order a northbound (or Manhattan-bound) train meets them
        seqs = [[s[:-1] for s in p["ids"]] for p in out["pats"].get(f"{r}|N", [])]
        seqs += [[s[:-1] for s in reversed(p["ids"])] for p in out["pats"].get(f"{r}|S", [])]
        rank, nodes, edges, indeg = {}, [], {}, {}
        for seq in seqs:
            for s in seq:
                if s not in rank: rank[s] = len(rank); nodes.append(s); edges[s] = set(); indeg[s] = 0
            for a_, b_ in zip(seq[:-1], seq[1:]):
                if b_ not in edges[a_]: edges[a_].add(b_); indeg[b_] += 1
        servedP = {s[:-1] for dr in "NS" for s in out["served"].get(f"{r}|{dr}", [])}
        order, ready = [], sorted([s for s in nodes if indeg[s] == 0], key=rank.get)
        while ready:
            s = ready.pop(0); order.append(s)
            for b_ in sorted(edges[s], key=rank.get):
                indeg[b_] -= 1
                if indeg[b_] == 0: ready.append(b_); ready.sort(key=rank.get)
        order += [s for s in nodes if s not in order]           # a loop in the patterns: keep first-seen order
        out["order"][r] = [s for s in order if s in servedP]
        for s in out["order"][r]:
            e = out["stations"].setdefault(s, [NAME[s], round(LAT[s], 5), round(LON[s], 5), []])
            if r not in e[3]: e[3].append(r)
    missing = [r for r in C.LINES if f"{r}|N" not in out["pattern"] and f"{r}|S" not in out["pattern"]]
    if missing:
        sys.exit(f"no weekday trips found at the chosen platform for {missing}")
    C.STATIC.parent.mkdir(parents=True, exist_ok=True)
    C.STATIC.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print("wrote", C.STATIC, f"({C.STATIC.stat().st_size // 1024} KB)", "home patterns", len(out["pattern"]), "stations", len(out["stations"]),
          "platform timetables", sum(len(v) for v in out["sched_all"].values()), out["feed_info"])


if __name__ == "__main__":
    main(sys.argv[1])
