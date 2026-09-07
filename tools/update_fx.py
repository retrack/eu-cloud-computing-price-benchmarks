#!/usr/bin/env python3
"""Refresh the EUR/USD and EUR/CHF rates inside data.js.

Usage
  python3 tools/update_fx.py                          fetch the latest ECB rates
  python3 tools/update_fx.py --usd 1.1622 --chf 0.9405 --date 2026-09-04
                                                      set them by hand
  add --dry-run to print the new lines without writing

Rates are quoted the ECB way: units of foreign currency per 1 EUR. The script inverts
them into the EUR-per-unit factors the page multiplies by, then rewrites the `FX` and
`FX_NOTE` lines in data.js in place. Run tools/build.py afterwards.

If the fetch fails with a proxy or egress error, read the rates off
https://www.ecb.europa.eu/stats/eurofxref/ (or api.frankfurter.dev/v1/latest?base=EUR)
and pass them with --usd / --chf / --date.
"""
import argparse, datetime, json, pathlib, re, sys, urllib.request

API = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,CHF"
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data.js"


def fetch():
    with urllib.request.urlopen(API, timeout=30) as r:
        return json.loads(r.read().decode())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="print the new lines, write nothing")
    ap.add_argument("--usd", type=float, help="USD per 1 EUR (skips the fetch)")
    ap.add_argument("--chf", type=float, help="CHF per 1 EUR (skips the fetch)")
    ap.add_argument("--date", help="reference date YYYY-MM-DD, used with --usd/--chf")
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

    src = DATA.read_text(encoding="utf-8")
    new = re.sub(r"^const FX = \{.*$", fx_line, src, count=1, flags=re.M)
    new = re.sub(r"^const FX_NOTE = .*$", note_line, new, count=1, flags=re.M)
    if new == src:
        sys.exit("data.js unchanged — check that the FX / FX_NOTE lines still match the patterns")
    DATA.write_text(new, encoding="utf-8")
    print(f"\n{DATA} updated. Now run: python3 tools/build.py")


if __name__ == "__main__":
    main()
