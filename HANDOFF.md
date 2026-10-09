# For the Claude Code session that manages louismittel.com

Paste this into that session along with the `subway-wait` folder (unzipped into the working directory).

---

This folder is a finished teaching page, "Longer Than Average", plus a pipeline that refreshes its
data every weekday from subwaydata.nyc and publishes it with GitHub Actions and GitHub Pages.
Read `README.md` first. The page and pipeline are tested; please don't change the page code.

1. **Work out how louismittel.com is hosted.** Look at the website repository (a `CNAME` file;
   `gh api repos/OWNER/REPO/pages`).

2. **If it is GitHub Pages with the custom domain on the user site** (the usual setup), give this
   its own public repository, so its daily deploys never touch the website repo:
   - `gh repo create OWNER/subway-wait --public --source . --push` (from inside the folder, after `git init`, a first commit, and checking that `.gitignore` keeps `raw/ build/ site/ dist/` out)
   - Turn on Pages with GitHub Actions as the source: `gh api -X POST repos/OWNER/subway-wait/pages -f build_type=workflow`
   - Run it once by hand: `gh workflow run refresh.yml`, then `gh run watch`. It downloads ten
     days (about 15 MB), builds, runs the checks, and deploys.
   - Project sites inherit the user site's custom domain, so the page should appear at
     `https://www.louismittel.com/subway-wait/`. Open it and confirm the dates in the bar under the hero.

   **If it is hosted some other way**, keep the build and check steps of `refresh.yml` and replace its
   last two steps (`upload-pages-artifact` and the `deploy` job) with a step that copies `site/` into the
   website's folder for this page and pushes, using whatever deploy method the site already uses
   (a deploy key or fine-grained token stored as a repository secret).

3. **Link it from the website** where the earlier single-file version (`mind_the_gap.html`) was
   posted, and replace that copy with a redirect or a link to the new address, so old links keep working.

4. **Leave the daily schedule off.** In `.github/workflows/refresh.yml` the two `schedule:` lines stay
   commented out until I confirm that subwaydata.nyc's maintainer is fine with one automated download
   a day. When I do, uncomment them and push. The monthly timetable workflow can stay on.

5. Tell me the final URL and paste the summary line of the first run (`data check passed: …`).
