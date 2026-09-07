#!/usr/bin/env python3
"""Assemble data.js + page.template.html -> eu-object-storage-benchmark.html"""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
tpl = (root / "page.template.html").read_text(encoding="utf-8")
data = (root / "data.js").read_text(encoding="utf-8")
out = root / "eu-object-storage-benchmark.html"
out.write_text(tpl.replace("/*__DATA__*/", data), encoding="utf-8")
print(f"{out} — {out.stat().st_size} octets")
