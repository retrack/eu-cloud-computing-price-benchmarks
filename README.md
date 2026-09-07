# EU Object Storage Benchmark

A single-page, dependency-free comparison of **object storage list prices in Europe**,
normalised so the numbers are actually comparable: **euros per GiB per month, 730 hours**,
Frankfurt region or the closest each vendor operates.

Open `eu-object-storage-benchmark.html` in a browser. Nothing to install, no build step
required to view it, no network calls beyond a web font.

Prices observed **7 September 2026**. See *Refreshing the data* below — a reading more
than a month old should not be trusted.

## Why normalisation is the point

Published object storage prices are not comparable as printed. Three things differ
between vendors and quietly move the figure by 10 % or more:

1. **The unit.** AWS, Azure, Google, Exoscale, OVHcloud and Wasabi bill in binary units
   (1 GB = 2³⁰ bytes) while printing "GB". Hetzner, Backblaze, Scaleway, IONOS,
   Cloudflare, Infomaniak and STACKIT state no basis at all. Decimal versus binary is a
   7.4 % difference on the same physical bytes.
2. **The month.** Vendors that bill hourly extrapolate to a month using 720, 730 or 744
   hours depending on who is doing the extrapolating. That is a 3 % spread on its own.
3. **What the headline excludes.** Egress, requests, retrieval fees, minimum storage
   durations and minimum billable object sizes are where the money often actually is.

This benchmark fixes all three: one hour basis, one unit, one currency, and a total-cost
scenario alongside the per-GiB figure.

## What the page does

Three tabbed panels — **Core set**, **Hyperscalers**, **European providers** — each with a
ranked bar chart of normalised storage price and a sortable detail table covering storage,
egress, requests, retrieval, minimum duration and redundancy.

Controls at the top recalculate every row live:

| Control | Default | Effect |
|---|---|---|
| Stored | 100 TiB | drives storage cost through each vendor's volume tiers |
| Egress | 10 TiB/month | applied against free allowances and egress tiers |
| PUT / GET | 2 M / 20 M per month | request charges |
| Hours per month | 730 | 720, 730 or 744 for hourly-billed vendors |
| Unit assumption | decimal | how to treat vendors that never define their "GB" |

Rows whose vendor does not state a unit basis carry a △ marker and follow that selector.
Components a vendor does not publish are shown as *not published*, and the scenario total
for that row is prefixed `≥` rather than silently treated as zero.

## Conventions

- Basis 730 h/month (annual average), €/GiB-month, excluding VAT.
- Decimal-GB vendors are multiplied by 1.073741824, so the comparison is per unit of
  *physical* storage rather than per unit of billing.
- Retrieval fees are applied to the month's egress volume: taking data out of a cold class
  means restoring it first.
- Storage and egress volume tiers are applied tier by tier, not at an average rate.
- Minimum storage durations and minimum billable object sizes are shown but **not**
  monetised — both need a churn rate and object-size profile specific to a workload.
- FX is a fixed ECB reference rate, stamped in the page header.

## Known gaps and contradictions

These are left visible rather than filled with estimates:

| Item | Status |
|---|---|
| STACKIT egress and request pricing | absent from the official price list v1.0.43 |
| T Cloud Public (ex-Open Telekom Cloud) storage price | calculator/console only, nothing public |
| IONOS | DE page €0.007/GB/30 d vs US page $0.00487/GB/30 d — a ~44 % gap FX does not explain |
| Hetzner base fee | price API returns €6.49 + €0.0087/TB·h; the launch press release still says €4.99 + €0.0067. The API is used. |
| Unit basis | not stated by 7 of the vendors listed |
| Redundancy model | not published by Wasabi, Backblaze, Hetzner, Cloudflare, Infomaniak, STACKIT |
| OVHcloud One Zone Standard / IA | EUR rates not found; converted from the USD page |

Region equivalence is also imperfect and is labelled per row: OVHcloud's 3-AZ multi-zone
storage exists only in Paris and Milan (Frankfurt/Limburg is single-zone), Backblaze's
European region is Amsterdam, Infomaniak is Swiss, and STACKIT is Germany South.

## Repository layout

| Path | Role |
|---|---|
| `eu-object-storage-benchmark.html` | the built page — this is the deliverable |
| `data.js` | the pricing dataset; one entry per vendor × storage class |
| `page.template.html` | HTML/CSS/JS shell, with a `/*__DATA__*/` marker |
| `tools/build.py` | assembles `data.js` + template into the page |
| `tools/update_fx.py` | refreshes the EUR/USD and EUR/CHF rates in `data.js` |
| `AGENTS.md` | maintenance guide: data model, collection procedure, conventions |

```bash
python3 tools/build.py     # rebuild the page after editing data.js or the template
```

## Refreshing the data

`AGENTS.md` documents the full procedure. In short:

```bash
python3 tools/update_fx.py                              # latest ECB rates
python3 tools/update_fx.py --usd 1.16 --chf 0.94 --date 2026-09-04   # or set them by hand
python3 tools/build.py
```

Prices must be re-read from the vendors' own pricing pages with the region explicitly
selected. AWS, Azure, Google, Hetzner and Exoscale render prices client-side, so a plain
HTTP fetch returns empty placeholders — `AGENTS.md` lists the price feeds those pages
consume. Anything that cannot be confirmed at the source is recorded as *not published*,
never estimated.

## Caveats

Maintained by someone who works at Exoscale, and Exoscale's rows are highlighted in the
tables. The figures are taken from competitors' own published pages and every source is
listed at the bottom of the page — but treat this as a starting point for your own
verification, not as an authority. List prices ignore negotiated discounts and commitment
terms, which are where large deals are actually decided.

## Licence

[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
(CC BY 4.0) — see `LICENSE`. Reuse, adapt and redistribute the dataset and the page, including
commercially, as long as you give credit:

> EU Object Storage Benchmark, Antoine Coetsier — https://github.com/retrack/eu-object-storage-benchmark — CC BY 4.0

If you adapt the figures or change the normalisation basis, say so, so a reader does not
attribute your numbers to this reading.

The licence covers this repository's own content. It does not cover the vendors' published
prices themselves, which are facts, nor any vendor trademark named in the tables.
