#!/usr/bin/env python3
"""Assemble each dataset + its template into a self-contained page.

  python3 tools/build.py              build every page
  python3 tools/build.py object       build only the object storage page
  python3 tools/build.py block        build only the block storage page
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

PAGES = {
    "object": ("data.js", "page.template.html", "eu-object-storage-benchmark.html"),
    "block": ("block-data.js", "block-page.template.html", "eu-block-storage-benchmark.html"),
}


def build(name):
    data_name, tpl_name, out_name = PAGES[name]
    tpl = (ROOT / tpl_name).read_text(encoding="utf-8")
    data = (ROOT / data_name).read_text(encoding="utf-8")
    if "/*__DATA__*/" not in tpl:
        sys.exit(f"{tpl_name} has no /*__DATA__*/ marker")
    out = ROOT / out_name
    out.write_text(tpl.replace("/*__DATA__*/", data), encoding="utf-8")
    print(f"{out} — {out.stat().st_size} octets")


def main():
    wanted = sys.argv[1:] or list(PAGES)
    for name in wanted:
        if name not in PAGES:
            sys.exit(f"unknown page {name!r} — pick from {', '.join(PAGES)}")
        build(name)


if __name__ == "__main__":
    main()
