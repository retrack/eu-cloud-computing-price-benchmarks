#!/usr/bin/env python3
"""Refresh the EUR/USD and EUR/CHF rates inside every dataset.

Usage
  python3 tools/update_fx.py                          fetch the latest ECB rates
  python3 tools/update_fx.py --usd 1.1622 --chf 0.9405 --date 2026-09-04
                                                      set them by hand
  python3 tools/update_fx.py --only block-storage      rewrite one benchmark only
  add --dry-run to print the new lines without writing

Rates are quoted the ECB way: units of foreign currency per 1 EUR. The script inverts
them into the EUR-per-unit factors the pages multiply by, then rewrites the `FX` and
`FX_NOTE` lines in every <benchmark>/data.js in place. Run tools/build.py afterwards.

A dataset carries the FX rate that was current when its prices were read. Refreshing FX
without re-reading the prices is legitimate — the rates are independent — but do it for
every dataset at once, or two pages will quote different rates on the same day.

If the fetch fails with a proxy or egress error, read the rates off
https://www.ecb.europa.eu/stats/eurofxref/ (or api.frankfurter.dev/v1/latest?base=EUR)
and pass them with --usd / --chf / --date.
"""
import argparse, datetime, json, pathlib, re, sys, urllib.request

API = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,CHF"
ROOT = pathlib.Path(__file__).resolve().parent.parent
def datasets(only=None):
    """Every <benchmark>/data.js, or just the named benchmark's."""
    found = sorted(d / "data.js" for d in ROOT.iterdir()
                   if d.is_dir() and not d.name.startswith(".") and (d / "data.js").is_file())
    if only:
        found = [p for p in found if p.parent.name == only]
        if not found:
            sys.exit(f"no benchmark named {only}")
    return found


def fetch():
    with urllib.request.urlopen(API, timeout=30) as r:
        return json.loads(r.read().decode())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print the new lines, write nothing")
    ap.add_argument("--usd", type=float, help="USD per 1 EUR (skips the fetch)")
    ap.add_argument("--chf", type=float, help="CHF per 1 EUR (skips the fetch)")
    ap.add_argument("--date", help="reference date YYYY-MM-DD, used with --usd/--chf")
    ap.add_argument("--only", help="rewrite one benchmark instead of all of them")
    args = ap.parse_args()

    if args.usd and args.chf:
        usd, chf = args.usd, args.chf
        date = args.date or datetime.date.today().isoformat()
    else:
        try:
            payload = fetch()
        except Exception as exc:
            sys.exit(
                f"could not fetch the rates ({exc}).\n"
                "Read them off https://www.ecb.europa.eu/stats/eurofxref/ and rerun with\n"
                "  python3 tools/update_fx.py --usd <USD per EUR> --chf <CHF per EUR> --date YYYY-MM-DD"
            )
        date = payload["date"]                  # e.g. 2026-09-04
        usd = payload["rates"]["USD"]           # USD per 1 EUR
        chf = payload["rates"]["CHF"]           # CHF per 1 EUR
    d, m, y = date[8:10], date[5:7], date[0:4]

    fx_line = (
        f"const FX = {{ EUR: 1, USD: {1/usd:.6f}, CHF: {1/chf:.6f} }};"
        f" // EUR per 1 unit — ECB {date} (frankfurter.dev)"
    )
    note_line = f'const FX_NOTE = "ECB {d}.{m}.{y}: 1 EUR = {usd} USD = {chf} CHF";'

    print(fx_line)
    print(note_line)
    if args.dry_run:
        return

    targets = datasets(args.only)
    print()
    for path in targets:
        src = path.read_text(encoding="utf-8")
        out, n1 = re.subn(r"^const FX = \{.*$", fx_line, src, count=1, flags=re.M)
        out, n2 = re.subn(r"^const FX_NOTE = .*$", note_line, out, count=1, flags=re.M)
        if not (n1 and n2):
            # a missing line is a real problem; already carrying these rates is not
            sys.exit(f"{path.relative_to(ROOT)}: could not find the FX / FX_NOTE lines to rewrite")
        if out == src:
            print(f"{path.relative_to(ROOT)} already on these rates")
            continue
        path.write_text(out, encoding="utf-8")
        print(f"{path.relative_to(ROOT)} updated")
    print("\nNow run: python3 tools/build.py")


if __name__ == "__main__":
    main()
