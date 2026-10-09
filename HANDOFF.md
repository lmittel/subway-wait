# For the Claude Code session that manages louismittel.com

This folder is a finished teaching page, **The Inspection Paradox** (inspection paradox on the NYC
subway, with every station on every line), plus a pipeline that refreshes its data from
subwaydata.nyc and publishes it with GitHub Actions and GitHub Pages. It replaces the older
single-file version of the page that is on the site now. Read `README.md` first. The page and the
pipeline are tested; please don't change the page code. If a check fails, send me its output.

1. **Work out how louismittel.com is hosted.** Look at the website repository (a `CNAME` file;
   `gh api repos/OWNER/REPO/pages`).

2. **If it is GitHub Pages with the custom domain on the user site** (the usual setup), give the page
   its own public repository, so its daily deploys never touch the website repo:
   - From inside this folder: `git init`, check that `.gitignore` keeps `raw/ build/ site/ dist/` out,
     make a first commit, then `gh repo create OWNER/subway-wait --public --source . --push`.
     (If `OWNER/subway-wait` already exists from an earlier version of this folder, replace its contents
     with this folder and push instead.)
   - Turn on Pages with GitHub Actions as the source: `gh api -X POST repos/OWNER/subway-wait/pages -f build_type=workflow`
     (if Pages is already on, `gh api -X PUT repos/OWNER/subway-wait/pages -f build_type=workflow`).
   - Run it once by hand: `gh workflow run refresh.yml`, then `gh run watch`. It downloads ten days of
     archives (about 15 MB), builds every station, runs the checks (about 10 minutes in all), and deploys.
   - Project sites inherit the user site's custom domain, so the page should appear at
     `https://www.louismittel.com/subway-wait/`. Check two things there:
     - the bar under the opening screen reads "Uptown A trains at 42 St–Port Authority";
     - `https://www.louismittel.com/subway-wait/#line=A&dir=N&stop=A41&when=pm` opens on
       "Uptown A trains at Jay St–MetroTech", evening rush. That proves the per-line station files load.

   **If it is hosted some other way**, keep the build and check steps of `refresh.yml` and replace its
   last two steps (`upload-pages-artifact` and the `deploy` job) with a step that copies all of `site/`
   (including `site/lines/`) into the website's folder for this page and pushes, using whatever deploy
   method the site already uses (a deploy key or fine-grained token stored as a repository secret).

3. **Retire the old version.** Where the earlier single-file page is posted now, replace that file with
   a small redirect page (a `<meta http-equiv="refresh">` plus a plain link) to the new address, so old
   links keep working. Update any link to it on the website, with the title "The Inspection Paradox".

4. **Leave the daily schedule off.** In `.github/workflows/refresh.yml` the two `schedule:` lines stay
   commented out until I confirm that subwaydata.nyc's maintainer is fine with one automated download
   a day. When I do, uncomment them and push. The monthly timetable workflow can stay on.

5. Tell me the final URL and paste the two summary lines of the first run
   (`data check passed: …` and `render check passed`).
