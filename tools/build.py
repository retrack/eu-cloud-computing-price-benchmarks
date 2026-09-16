#!/usr/bin/env python3
"""Compose each benchmark page from the shared shell and its own parts.

A benchmark is any top-level directory holding `meta.json`, `data.js`, `page.html` and
`page.js`. The build fills `shared/shell.html` and writes `index.html` beside them:

    shared/shell.html   document skeleton
    shared/base.css     tokens, layout, controls, tabs, ranking, table  (every page)
    <dir>/style.css     product-specific CSS                            (optional)
    <dir>/page.html     the body markup
    shared/ui.js        units, formatting, ranking, sorting, wiring     (every page)
    <dir>/data.js       the dataset
    <dir>/page.js       the cost model, the renderers, the wiring calls

Script order matters: ui.js first, then data.js, then page.js. Helpers in ui.js read `S`,
`GIB` and `FX` from the later files, which is fine because none of it runs at load time.

Usage
  python3 tools/build.py                    build every benchmark
  python3 tools/build.py object-storage      build one, by directory name
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHARED = ROOT / "shared"
PARTS = ("meta.json", "data.js", "page.html", "page.js")


def benchmarks():
    for d in sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith(".")):
        if all((d / f).is_file() for f in PARTS):
            yield d


def build(d: pathlib.Path) -> pathlib.Path:
    meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
    for key in ("title", "description"):
        if not meta.get(key):
            sys.exit(f"{d.name}/meta.json is missing '{key}'")

    style = d / "style.css"
    page_css = f"<style>\n{style.read_text(encoding='utf-8').strip()}\n</style>" if style.is_file() else ""

    html = (SHARED / "shell.html").read_text(encoding="utf-8")
    for token, value in {
        "{{TITLE}}": meta["title"],
        "{{DESCRIPTION}}": meta["description"].replace('"', "&quot;"),
        "{{BASE_CSS}}": (SHARED / "base.css").read_text(encoding="utf-8").strip(),
        "{{PAGE_CSS}}": page_css,
        "{{BODY}}": (d / "page.html").read_text(encoding="utf-8").strip(),
        "{{UI_JS}}": (SHARED / "ui.js").read_text(encoding="utf-8").strip(),
        "{{DATA_JS}}": (d / "data.js").read_text(encoding="utf-8").strip(),
        "{{PAGE_JS}}": (d / "page.js").read_text(encoding="utf-8").strip(),
    }.items():
        if token not in html:
            sys.exit(f"shared/shell.html has no {token} placeholder")
        html = html.replace(token, value)

    out = d / "index.html"
    out.write_text(html, encoding="utf-8")
    return out


def main():
    wanted = [a for a in sys.argv[1:] if not a.startswith("-")]
    found = list(benchmarks())
    if wanted:
        names = {d.name for d in found}
        missing = [w for w in wanted if w not in names]
        if missing:
            sys.exit(f"no benchmark named {', '.join(missing)} (have: {', '.join(sorted(names))})")
        found = [d for d in found if d.name in wanted]
    if not found:
        sys.exit(f"no benchmark directories found (each needs {', '.join(PARTS)})")
    for d in found:
        out = build(d)
        print(f"{out.relative_to(ROOT)} — {out.stat().st_size} bytes")


if __name__ == "__main__":
    main()
