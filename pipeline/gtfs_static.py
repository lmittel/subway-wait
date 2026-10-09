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
    missing = [r for r in C.LINES if f"{r}|N" not in out["pattern"] and f"{r}|S" not in out["pattern"]]
    if missing:
        sys.exit(f"no weekday trips found at the chosen platform for {missing}")
    C.STATIC.parent.mkdir(parents=True, exist_ok=True)
    C.STATIC.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print("wrote", C.STATIC, "patterns", len(out["pattern"]), "timetables", len(out["sched"]), out["feed_info"])


if __name__ == "__main__":
    main(sys.argv[1])
