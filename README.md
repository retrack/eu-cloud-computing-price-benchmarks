# EU Storage Price Benchmarks

Two single-page, dependency-free comparisons of **cloud storage list prices in Europe**,
normalised so the numbers are actually comparable: **euros per GiB per month, 730 hours**,
Frankfurt region or the closest each vendor operates.

| Benchmark | Page | Covers |
|---|---|---|
| **Object storage** | `eu-object-storage-benchmark.html` | S3-compatible buckets — 36 vendor × class rows, from AWS S3 Standard to Glacier Deep Archive |
| **Block storage** | `eu-block-storage-benchmark.html` | EBS-shaped volumes — attachable, resizable, snapshottable — 37 vendor × class rows |

Published readings: **https://retrack.github.io/eu-object-storage-benchmark/**

Or open either HTML file from a clone in a browser. Nothing to install, no build step required
to view them, no network calls beyond a web font.

Object storage prices observed **7 September 2026**; block storage prices observed
**10 September 2026**. See *Refreshing the data* below — a reading more than a month old
should not be trusted.

## Why normalisation is the point

Published storage prices are not comparable as printed. Three things differ between vendors
and quietly move the figure by 10 % or more:

1. **The unit.** AWS, Azure, Google, Exoscale and Wasabi bill in binary units
   (1 GB = 2³⁰ bytes) while printing "GB". Hetzner, Backblaze, Scaleway, IONOS,
   Cloudflare, Infomaniak and STACKIT state no basis at all. Decimal versus binary is a
   7.4 % difference on the same physical bytes. OVHcloud prints `GiB` for object storage
   and `GB` for block storage, defining neither.
2. **The month.** Vendors that bill hourly extrapolate to a month using 720, 730 or 744
   hours depending on who is doing the extrapolating. That is a 3 % spread on its own.
   IONOS and STACKIT publish a 30-day month; OVHcloud publishes a 730-hour one.
3. **What the headline excludes.** For object storage: egress, requests, retrieval fees,
   minimum durations and minimum billable object sizes. For block storage: provisioned
   IOPS, provisioned throughput and snapshots — which at AWS io2 can cost four times the
   capacity itself.

Both benchmarks fix all three: one hour basis, one unit, one currency, and a total-cost
scenario alongside the per-GiB figure.

## What the object storage page does

Three tabbed panels — **Core set**, **Hyperscalers**, **European providers** — each with a
ranked bar chart of normalised storage price and a sortable detail table covering storage,
egress, requests, retrieval, minimum duration and redundancy.

| Control | Default | Effect |
|---|---|---|
| Stored | 100 TiB | drives storage cost through each vendor's volume tiers |
| Egress | 10 TiB/month | applied against free allowances and egress tiers |
| PUT / GET | 2 M / 20 M per month | request charges |
| Hours per month | 730 | 720, 730 or 744 for hourly-billed vendors |
| Unit assumption | decimal | how to treat vendors that never define their "GB" |

## What the block storage page does

The same three panels, but the ranking is the **effective** price of the scenario — capacity
plus provisioned IOPS plus provisioned throughput plus snapshots, divided by the provisioned
GiB. Bare capacity has its own column beside it, and the two diverge sharply: AWS io2 at
3,000 IOPS per volume costs four times its capacity rate.

| Control | Default | Effect |
|---|---|---|
| Provisioned | 2,048 GiB | total capacity across all volumes |
| Volumes | 4 | free IOPS baselines and Azure's size ladder are **per disk**, so this matters |
| IOPS per volume | 3,000 | exactly the AWS and Azure free baseline, so the comparison starts at capacity-only |
| MB/s per volume | 125 | likewise |
| Snapshot data | 1,024 GiB | snapshot storage held |
| Hours per month | 730 | 720, 730 or 744 |
| Unit assumption | decimal | for vendors that never define their "GB" |
| Storage medium | all four on | filters the chart and the table to HDD & magnetic, SSD, Premium SSD, or medium not stated |
| Chart metric | Effective | switches the bar chart between the effective price and capacity alone |

The **Capacity only** chart toggle separates the shelf price from the bill. STACKIT is second
cheapest on capacity and ninth once its per-disk performance class is added; AWS io2 moves
further still. The table always shows both columns.

The **storage medium** shown under each class is the vendor's own words, never an inference.
The filter groups them into HDD & magnetic, SSD, and Premium SSD — the last being each
vendor's own top-performance flash tier, not a claim about the hardware. Google's Hyperdisk
Throughput sits with the HDDs because Google itself compares its latency to a hard disk.
IONOS Essential is listed as "HDD/SSD" and appears under both. STACKIT states no medium
anywhere and gets its own bucket.

Two further behaviours are specific to this page:

- **Azure's size ladder is modelled.** Premium SSD, Standard SSD and Standard HDD are sold
  in fixed disk sizes, so a 600 GiB disk is billed as a 1,024 GiB P30. Change the volume
  count and the rounding moves the row.
- **Rows that cannot deliver the scenario are marked ⚠** and their bar is hatched. A 500-IOPS
  OVHcloud Classic Volume is not a substitute for a 25,000-IOPS io2, and the page says so
  rather than ranking it first for being cheap.

**STACKIT's per-disk performance classes are modelled too**: the page picks the cheapest of
its 18 classes that meets both the IOPS and the MB/s target, and shows which one.

On both pages, rows whose vendor does not state a unit basis carry a △ marker and follow the
unit selector. Components a vendor does not publish are shown as *not published*, and the
scenario total for that row is prefixed `≥` rather than silently treated as zero.

## Conventions

- Basis 730 h/month (annual average), €/GiB-month, excluding VAT.
- Decimal-GB vendors are multiplied by 1.073741824, so the comparison is per unit of
  *physical* storage rather than per unit of billing.
- Volume tiers are applied tier by tier, not at an average rate.
- Object storage: retrieval fees are applied to the month's egress volume, since taking data
  out of a cold class means restoring it first.
- Block storage: capacity is billed on what is **provisioned**, not what is stored — that is
  the model every vendor here uses.
- Minimum storage durations, minimum billable object sizes and per-I/O request charges are
  shown but **not** monetised — each needs a churn rate or an I/O profile specific to a
  workload.
- FX is a fixed ECB reference rate, stamped in each page header.

## Known gaps and contradictions

These are left visible rather than filled with estimates.

**Object storage**

| Item | Status |
|---|---|
| STACKIT egress and request pricing | absent from the official price list v1.0.43 |
| T Cloud Public (ex-Open Telekom Cloud) storage price | calculator/console only, nothing public |
| IONOS | DE page €0.007/GB/30 d vs US page $0.00487/GB/30 d — a ~44 % gap FX does not explain |
| Hetzner base fee | price API returns €6.49 + €0.0087/TB·h; the launch press release still says €4.99 + €0.0067. The API is used. |
| Unit basis | not stated by 7 of the vendors listed |
| Redundancy model | not published by Wasabi, Backblaze, Hetzner, Cloudflare, Infomaniak, STACKIT |
| OVHcloud One Zone Standard / IA | EUR rates not found; converted from the USD page |

**Block storage**

| Item | Status |
|---|---|
| T Cloud Public EVS rate | no rate card; the pricing-model page uses 4.6 ct/GB-month in a worked example, which is an illustration, not a price |
| Azure snapshots | the retail feed carries $0.145/GiB-month against Premium SSD, $0.05 against Standard HDD, and hourly instant-access meters for Premium SSD v2 and Ultra. Incremental snapshots land on standard storage, so $0.05 is used for the P, E and S rows. |
| STACKIT `-m` SKUs | every SKU is listed twice, with and without an `-m` suffix at roughly double the price. The suffix is never defined; the non-`-m` EU01 rates are used. |
| IONOS | DE page €0.04/GB/30 d for Essential vs US page $0.0533 — the same unexplained gap as its object storage pricing |
| Hetzner snapshots | none offered for volumes, so the row carries no snapshot cost. That is a missing capability, not a discount. |
| Redundancy model | not published for block storage by Scaleway, IONOS or STACKIT |
| Storage medium | STACKIT states none, on the product page or in the price list |
| Wasabi, Backblaze, Cloudflare | no block storage product; absent by design |

Region equivalence is also imperfect and is labelled per row: OVHcloud's 3-AZ storage exists
only in its 3-AZ regions (Paris, Milan), Backblaze's European region is Amsterdam, Infomaniak
is Swiss, and STACKIT is Germany South.

## Repository layout

| Path | Role |
|---|---|
| `eu-object-storage-benchmark.html` | the built object storage page |
| `eu-block-storage-benchmark.html` | the built block storage page |
| `data.js` | object storage dataset; one entry per vendor × storage class |
| `block-data.js` | block storage dataset; one entry per vendor × volume class |
| `page.template.html` | object storage HTML/CSS/JS shell, with a `/*__DATA__*/` marker |
| `block-page.template.html` | block storage shell, same marker |
| `tools/build.py` | assembles each dataset + template into its page |
| `tools/update_fx.py` | refreshes the EUR/USD and EUR/CHF rates in both datasets |
| `AGENTS.md` | maintenance guide: data models, collection procedure, conventions |

```bash
python3 tools/build.py            # rebuild both pages
python3 tools/build.py block      # or just one
```

## Refreshing the data

`AGENTS.md` documents the full procedure. In short:

```bash
python3 tools/update_fx.py                              # latest ECB rates, both datasets
python3 tools/update_fx.py --usd 1.1652 --chf 0.9404 --date 2026-09-09   # or set them by hand
python3 tools/build.py
```

Prices must be re-read from the vendors' own pricing pages with the region explicitly
selected. Most vendors render prices client-side, so a plain HTTP fetch returns empty
placeholders — `AGENTS.md` lists the price feeds those pages consume, including the AWS
Price List Bulk API, the Azure Retail Prices API, the OVHcloud order catalogue and
Exoscale's own pricing API. Anything that cannot be confirmed at the source is recorded as
*not published*, never estimated.

## Caveats

Maintained by someone who works at Exoscale, and Exoscale's rows are highlighted in the
tables. The figures are taken from competitors' own published pages and every source is
listed at the bottom of each page — but treat this as a starting point for your own
verification, not as an authority. List prices ignore negotiated discounts and commitment
terms, which are where large deals are actually decided.

## Licence

[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
(CC BY 4.0) — see `LICENSE`. Reuse, adapt and redistribute the datasets and the pages, including
commercially, as long as you give credit:

> EU Storage Price Benchmarks, Antoine Coetsier — https://github.com/retrack/eu-object-storage-benchmark — CC BY 4.0

If you adapt the figures or change the normalisation basis, say so, so a reader does not
attribute your numbers to this reading.

The licence covers this repository's own content. It does not cover the vendors' published
prices themselves, which are facts, nor any vendor trademark named in the tables.
