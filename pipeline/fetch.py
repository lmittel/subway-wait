"""Keep raw/ holding the archives for the newest WINDOW_DAYS normal weekdays.

Only days not already in raw/ are downloaded (one or two on a normal morning), at most
MAX_DOWNLOADS_PER_RUN successful downloads per run (a missing day costs one small request). Archives for days that have left the window are deleted.
Writes raw/days.json with the chosen days.

    python pipeline/fetch.py                 # from subwaydata.nyc
    python pipeline/fetch.py --local DIR     # copy from a folder of archives instead (for testing)
"""
import argparse, datetime as dt, json, os, shutil, sys, time, urllib.error, urllib.request
from zoneinfo import ZoneInfo
import config as C


def archive_name(day):
    return f"subwaydatanyc_{day}_csv.tar.xz"


def download(day, dest, local=None):
    if local:
        src = os.path.join(local, archive_name(day))
        if not os.path.exists(src):
            return "missing"
        shutil.copyfile(src, dest); return "ok"
    repo = os.environ.get("GITHUB_REPOSITORY", "local run")
    req = urllib.request.Request(C.ARCHIVE_URL.format(day=day), headers={
        "User-Agent": f"subway-wait teaching page (github.com/{repo}); one archive per day"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r, open(dest + ".part", "wb") as f:
            shutil.copyfileobj(r, f)
    except urllib.error.HTTPError as e:
        if e.code in (403, 404):
            return "missing"
        raise
    os.replace(dest + ".part", dest)
    return "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", help="folder of subwaydatanyc_YYYY-MM-DD_csv.tar.xz files to copy from instead of downloading")
    ap.add_argument("--until", help="newest day to consider (YYYY-MM-DD); default: yesterday in New York")
    a = ap.parse_args()
    C.RAW.mkdir(parents=True, exist_ok=True)
    today = dt.datetime.now(ZoneInfo(C.TZ)).date()
    newest = dt.date.fromisoformat(a.until) if a.until else today - dt.timedelta(days=1)
    have = {f.name[len("subwaydatanyc_"):len("subwaydatanyc_") + 10] for f in C.RAW.glob("subwaydatanyc_*_csv.tar.xz")}
    chosen, fetched, missing = [], 0, []
    d = newest
    while len(chosen) < C.WINDOW_DAYS and (newest - d).days <= C.LOOKBACK_DAYS:
        if C.is_normal_weekday(d):
            day = d.isoformat()
            if day in have:
                chosen.append(day)
            elif fetched < C.MAX_DOWNLOADS_PER_RUN and len(missing) < 25:
                st = download(day, str(C.RAW / archive_name(day)), a.local)
                print(day, st, flush=True)
                if st == "ok": chosen.append(day); fetched += 1
                else: missing.append(day)
                if not a.local: time.sleep(2)
        d -= dt.timedelta(days=1)
    chosen.sort()
    for f in C.RAW.glob("subwaydatanyc_*_csv.tar.xz"):
        if f.name[len("subwaydatanyc_"):len("subwaydatanyc_") + 10] not in chosen:
            f.unlink(); print("dropped", f.name)
    (C.RAW / "days.json").write_text(json.dumps(chosen))
    print("window:", chosen[0] if chosen else None, "to", chosen[-1] if chosen else None, f"({len(chosen)} days; {fetched} fetched; not yet posted or missing: {missing})")
    if len(chosen) < 8:
        sys.exit("fewer than 8 weekdays available; not building")


if __name__ == "__main__":
    main()
