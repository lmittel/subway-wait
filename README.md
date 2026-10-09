# The Inspection Paradox

An interactive page about the inspection paradox on the New York subway: why riders wait longer than
half the gap between trains, measured from real arrival records at every station on every line.

© 2026 Louis Mittel · [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)

## What gets published

`site/` is the whole website:

| File | What it is |
|---|---|
| `site/index.html` | the page (about 330 KB) |
| `site/data.js` | the data for each line's default station, plus the list of every station (about 470 KB) |
| `site/lines/<line>.js` | every station on one line, loaded only when a reader picks a station on that line (30–500 KB each) |

Readers can search for their own station ("Use your own station" on the opening screen, or "Change"
in the bar). The address bar then remembers the choice, so a link like
`…/#line=L&dir=S&stop=L08&when=am` opens on that station.

`dist/inspection_paradox.html` is the same page as a single file with every station inside (about
7.5 MB), for offline use or class. It is built on request and not published.

## How it stays current

Each weekday's arrival records are posted by [subwaydata.nyc](https://subwaydata.nyc) the next morning,
around 7 am New York time. A scheduled GitHub Action then:

1. downloads the new day (yesterday's archives are cached, so it is one download on a normal day),
   keeping the newest ten normal weekdays (holidays are skipped: see `pipeline/config.py`);
2. rebuilds `site/data.js` and `site/lines/`;
3. checks the data (`pipeline/check_data.py`: every file decodes back to exactly what was built), then
   opens the page in a headless browser and draws every module for every line, direction and time
   window, and for every one of the roughly 1,700 station platforms (`pipeline/check_render.py`);
4. publishes `site/` to GitHub Pages, **only if every check passed**. Otherwise yesterday's page stays up
   and GitHub emails the repository owner about the failed run.

The page itself never changes on a data refresh. Dates, the day shown in the train graph, and the data
notes in the credits all come from the data.

A second workflow re-reads the MTA's published timetable (static GTFS) once a month and commits
`static/static.json` if it changed. That monthly commit also keeps GitHub from switching off the
daily schedule, which it does in public repositories after 60 days without commits. The timetable in
the repository now runs to October 31, 2026, so the November 2 run will pick up the next one (or start
it by hand: Actions → Refresh timetable → Run workflow).

Cost: nothing. Actions and Pages are free for public repositories; a daily run takes about 10 minutes.

## Before switching on the daily schedule

subwaydata.nyc does not state a license for its data. Ask its maintainer before automating downloads,
for example:

> I teach probability at NYU and built a teaching page on the inspection paradox from your archived
> arrival data (credited and linked on the page). Would you be OK with a GitHub Action downloading one
> daily archive each morning to keep the page current? It caches everything, so it is one request a
> day. Happy to credit the project however you prefer.

Then remove the `#` in front of the two `schedule:` lines in `.github/workflows/refresh.yml`.
Until then the workflow runs only when started by hand (Actions → Refresh subway data and publish → Run workflow).

## Running it locally

```
pip install -r requirements.txt
python -m playwright install chromium
python pipeline/fetch.py                  # or: --local FOLDER_OF_ARCHIVES --until 2026-10-02
python pipeline/build_data.py
python pipeline/check_data.py
python page/assemble.py --single          # site/ and dist/inspection_paradox.html
python pipeline/check_render.py
```

Opening `site/index.html` straight from disk works, station choice included.

## Layout

| Path | What it is |
|---|---|
| `page/part_*.html`, `page/part_*.js` | the page, in parts; `page/assemble.py` joins them |
| `pipeline/config.py` | lines, default stations, window length, holidays, URLs |
| `pipeline/fetch.py` | keeps `raw/` holding the newest ten weekdays |
| `pipeline/build_data.py` | archives + timetable → `site/data.js` and `site/lines/` |
| `pipeline/gtfs_static.py` | MTA GTFS → `static/static.json` (timetables, stop patterns, stations, colours) |
| `pipeline/check_data.py`, `pipeline/check_render.py` | the checks that gate publishing |
| `.github/workflows/refresh.yml` | daily: fetch, build, check, publish |
| `.github/workflows/timetable.yml` | monthly: refresh the timetable |

The data pipeline was checked against the hand-built version of the page: on the same ten days it
reproduces every arrival series, timetable and train graph at the default stations byte for byte.
