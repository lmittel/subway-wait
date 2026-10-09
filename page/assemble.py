"""Assemble the page from its parts.

    python page/assemble.py            # site/index.html, reading site/data.js beside it
    python page/assemble.py --single   # also dist/inspection_paradox.html: one file with every station's data inside
"""
import base64, hashlib, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SITE, DIST = ROOT / "site", ROOT / "dist"
CODE = ["part_tex.js", "part_core.js", "part_ui.js", "part_s1.js", "part_s2.js", "part_sb.js", "part_new.js", "part_cloud.js", "part_proof.js", "part_down.js", "part_s3.js"]


def rd(name):
    return (HERE / name).read_text(encoding="utf-8")


def page(data_tag):
    font = base64.b64encode((HERE / "stix_math_sub.woff2").read_bytes()).decode()
    head = rd("part_head.html"); assert "/*__MATHFONT__*/" in head
    parts = [head.replace("/*__MATHFONT__*/", font), rd("part_body.html"), data_tag,
             '<script>\n(function () {\n  "use strict";\n  if (typeof MTA === "undefined") { document.body.insertAdjacentHTML("afterbegin", "<p style=\\"padding:16px;font:16px sans-serif\\">The train data did not load. Reload the page to try again.</p>"); return; }\n'] + [rd(n) for n in CODE]
    return "".join(p if p.endswith("\n") else p + "\n" for p in parts)


def main():
    data = (SITE / "data.js").read_text(encoding="utf-8")
    stamp = hashlib.sha1(data.encode()).hexdigest()[:10]
    html = page(f'<script src="data.js?v={stamp}"></script>\n')
    (SITE / "index.html").write_text(html, encoding="utf-8")
    print("site/index.html", len(html.encode()) // 1024, "KB + data.js", len(data.encode()) // 1024, "KB")
    if "--single" in sys.argv:
        DIST.mkdir(exist_ok=True)
        lines = "".join("<script>\n" + f.read_text(encoding="utf-8") + "</script>\n" for f in sorted((SITE / "lines").glob("*.js")))
        one = page("<script>\n" + data + "\n</script>\n" + lines)
        for old in DIST.glob("*.html"): old.unlink()
        (DIST / "inspection_paradox.html").write_text(one, encoding="utf-8")
        print("dist/inspection_paradox.html", len(one.encode()) // 1024, "KB")


if __name__ == "__main__":
    main()
