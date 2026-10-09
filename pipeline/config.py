"""Settings shared by every step of the pipeline: which lines, which platform, which days."""
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"                 # downloaded archives (cached between runs, never committed)
STATIC = ROOT / "static" / "static.json"   # timetable, stop patterns and colours, made from the MTA's GTFS
SITE = ROOT / "site"               # what gets published: index.html + data.js
BUILD = ROOT / "build"             # scratch: summaries the checks read

TZ = "America/New_York"
WINDOW_DAYS = 10                   # rolling window of weekdays
MAX_DOWNLOADS_PER_RUN = 12         # be polite: never fetch more than this in one run
LOOKBACK_DAYS = 40                 # how far back to look for weekdays to fill the window

# subwaydata.nyc posts each day's archive the next morning, around 7 am New York time
ARCHIVE_URL = "https://subwaydata.nyc/data/subwaydatanyc_{day}_csv.tar.xz"
# the MTA's static subway GTFS (timetable); only used by the occasional timetable refresh
GTFS_URL = "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip"

LINES = ["1", "2", "3", "4", "5", "6", "7", "A", "C", "E", "B", "D", "F", "M", "G", "J", "L", "N", "Q", "R", "W", "GS"]
# one busy platform per line (GTFS parent stop ids; N/S suffix is the direction)
CHOICE = {"1": "127", "2": "127", "3": "127", "4": "631", "5": "631", "6": "631", "7": "723", "A": "A27", "C": "A27", "E": "A27",
          "B": "D17", "D": "D17", "F": "D17", "M": "D17", "N": "R17", "Q": "R17", "R": "R17", "W": "R17", "G": "G29", "J": "M16",
          "L": "L08", "GS": "902"}
DIRLAB = {r: {"N": "uptown", "S": "downtown"} for r in CHOICE}
DIRLAB["7"] = {"N": "toward Flushing", "S": "toward Hudson Yards"}
DIRLAB["G"] = {"N": "toward Court Sq", "S": "toward Church Av"}
DIRLAB["J"] = {"N": "toward Jamaica", "S": "toward Manhattan"}
DIRLAB["L"] = {"N": "toward Manhattan", "S": "toward Canarsie"}
DIRLAB["GS"] = {"N": "shuttle", "S": "shuttle"}

# realtime feed each route arrives in (an outage in a feed blanks every route in it)
FEED = {}
for r in ["A", "C", "E", "H", "FS"]: FEED[r] = "ACE"
for r in ["B", "D", "F", "FX", "M"]: FEED[r] = "BDFM"
FEED["G"] = "G"
for r in ["J", "Z"]: FEED[r] = "JZ"
for r in ["N", "Q", "R", "W"]: FEED[r] = "NQRW"
FEED["L"] = "L"
for r in ["1", "2", "3", "4", "5", "6", "6X", "7", "7X", "GS"]: FEED[r] = "1-7"
for r in ["SI", "SS"]: FEED[r] = "SI"
ROUTEMAP = {"6X": "6", "7X": "7", "FX": "F"}   # express variants count as their line

# the train graph shows 6:00 to 10:30 am on one day
MAREY_A, MAREY_B = 6 * 3600, int(10.5 * 3600)


def holidays(year):
    """Weekdays when the subway does not run a normal weekday schedule (kept out of the window).
    Federal holidays, the day after Thanksgiving, and the week between Christmas Eve and New Year."""
    out = set()
    def nth(month, weekday, n):          # n-th given weekday of a month (n = -1: last)
        if n > 0:
            d = dt.date(year, month, 1)
            d += dt.timedelta(days=(weekday - d.weekday()) % 7)
            return d + dt.timedelta(weeks=n - 1)
        d = dt.date(year, month + 1, 1) - dt.timedelta(days=1) if month < 12 else dt.date(year, 12, 31)
        return d - dt.timedelta(days=(d.weekday() - weekday) % 7)
    def observed(d):
        return d + dt.timedelta(days=1) if d.weekday() == 6 else d - dt.timedelta(days=1) if d.weekday() == 5 else d
    for d in [dt.date(year, 1, 1), dt.date(year, 6, 19), dt.date(year, 7, 4), dt.date(year, 11, 11), dt.date(year, 12, 25)]:
        out.add(observed(d))
    out |= {nth(1, 0, 3), nth(2, 0, 3), nth(5, 0, -1), nth(9, 0, 1), nth(10, 0, 2)}   # MLK, Presidents, Memorial, Labor, Columbus
    thanks = nth(11, 3, 4); out |= {thanks, thanks + dt.timedelta(days=1)}
    out |= {dt.date(year, 12, d) for d in range(24, 32)}
    out |= {dt.date(year, 1, d) for d in (1, 2)}
    return out


def is_normal_weekday(d):
    return d.weekday() < 5 and d not in holidays(d.year)
