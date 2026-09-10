# EU storage price benchmarks — working notes

## Deliverables

Two self-contained HTML pages. Open either directly; there is no runtime dependency beyond a
web font.

- **`eu-object-storage-benchmark.html`** — S3-compatible object storage.
- **`eu-block-storage-benchmark.html`** — EBS-shaped block storage: volumes that attach to an
  instance, resize, and snapshot.

They are deliberately **separate pages**, not two tabs of one page. The two products are
bought by different people for different reasons, the cost drivers do not overlap (egress and
requests versus provisioned IOPS and throughput), and merging the scenarios would produce a
control panel nobody could read. They share the CSS, the tab/sort/ranking machinery and the
build tooling; they do not share a dataset or a calculation engine.

Each page has three tabbed panels — **Core set**, **Hyperscalers**, **European providers** —
with a ranked bar chart and a sortable detail table that recalculates from the controls at
the top.

`README.md` is the public repository README. Internal commentary — what the benchmarks change
for our own slide, how to use them in a customer conversation — lives in `NOTES-internal.md`,
which is gitignored and never leaves the folder.

## Files

| Path | Role |
|---|---|
| `data.js` | object storage dataset — one row = one vendor × one storage class |
| `block-data.js` | block storage dataset — one row = one vendor × one volume class |
| `page.template.html` | object storage HTML/CSS/JS shell, contains the `/*__DATA__*/` marker |
| `block-page.template.html` | block storage shell, same marker |
| `tools/build.py` | assembles each dataset + template → its page |
| `tools/update_fx.py` | refreshes the EUR/USD and EUR/CHF rates inside both datasets |
| `README.md` | public repository README |
| `LICENSE` | CC BY 4.0 |
| `NOTES-internal.md` | internal commentary — gitignored, stays local |
| `archive/` | superseded versions, including the original French edition |

## Build

```bash
python3 tools/build.py            # both pages
python3 tools/build.py block      # or object — just that one
```

The datasets and templates are the sources; the HTML is generated and committed so the pages
can be opened straight from a clone.

---

## Refreshing the FX rates

Rates live in two lines at the top of each dataset:

```js
const FX = { EUR: 1, USD: 0.858222, CHF: 1.063377 }; // EUR per 1 unit
const FX_NOTE = "ECB 09.09.2026: 1 EUR = 1.1652 USD = 0.9404 CHF";
```

`FX` holds **EUR per one unit of foreign currency** — the inverse of the way the ECB quotes
them. `FX_NOTE` is the human-readable stamp shown in the page header. Keep them consistent:
`FX.USD` must equal `1 / (USD per EUR)`.

```bash
python3 tools/update_fx.py                 # fetch the latest ECB rates, rewrite both datasets
python3 tools/update_fx.py --dry-run       # print what it would write, change nothing
python3 tools/update_fx.py --only block-data.js
python3 tools/build.py
```

FX is independent of the prices, so refreshing it without re-reading the prices is legitimate
— but do both datasets together, or the two pages will quote different rates on the same day.

If the fetch fails (a filtered network, a proxy 403), read the rates off
https://www.ecb.europa.eu/stats/eurofxref/ (or
`api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,CHF`) and pass them by hand:

```bash
python3 tools/update_fx.py --usd 1.1652 --chf 0.9404 --date 2026-09-09
```

FX moves a few percent a year — enough to reorder adjacent rows. Refresh it whenever the
prices are refreshed.

---

## Refreshing the prices

Rates go stale silently: vendors change them without announcement, and a reading more than a
month old should not be relied on.

### 1. Collect

For each vendor, open the **official pricing page only** — never a blog, a comparison site,
or a cached copy — with the region selector set to **Frankfurt or the closest region the
vendor actually operates**.

Most vendors render prices client-side, so a plain HTML fetch returns empty placeholders.
Read the rendered DOM with the region selected, or go straight to the feed the page consumes.
The feeds that worked on 10 September 2026:

| Vendor | Feed |
|---|---|
| AWS | Price List Bulk API: `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/eu-central-1/index.csv` (280 MB — stream it through `grep`). Object storage: `https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/s3/USD/current/*.json`, key `regions["EU (Frankfurt)"]` |
| Azure | Retail Prices API, `https://prices.azure.com/api/retail/prices?currencyCode=USD&$filter=armRegionName eq 'germanywestcentral' and priceType eq 'Consumption' and productName eq '<product>'` |
| Google | the pricing tables are serialised inside the HTML of `cloud.google.com/compute/disks-image-pricing`; split on the `"Frankfurt (europe-west3)",[2]` marker to get the monthly table |
| OVHcloud | `https://eu.api.ovh.com/v1/order/catalog/public/cloud?ovhSubsidiary=DE` — `addons[].planCode` matching `volume`/`snapshot`, prices in units of 1e-8 EUR, net of the `taxRate` in `locale` |
| Exoscale | `https://portal.exoscale.com/api/pricing/<product>` — the endpoint the price page's Angular controller calls. `blockstorage`, `sos`, and so on |
| Hetzner | object storage: `website-price-api.hetzner.com`. Block storage: the price is an attribute on the `<ho-block-storage-calculator>` element of `hetzner.com/cloud/block-storage/`, and only appears when the page is fetched with a European locale |
| STACKIT | the price list PDF linked from `stackit.com/en/prices` — run it through `pdftotext -layout` |

Anything you cannot confirm is `null` or `"not published"` — never an estimate. The pages
render those as `not published` and mark the scenario cost with `≥`.

### 2a. Update `data.js` (object storage)

One object per vendor × class. Shape:

```js
{ id:"aws-ia", vendor:"AWS S3", cls:"Standard-IA", region:"eu-central-1 · Frankfurt",
  cur:"USD",            // "EUR" | "USD" | "CHF" — must exist as a key in FX
  unit:"GiB",           // "GiB" binary confirmed | "GB" decimal confirmed | "GB?" not stated
  bill:"m",             // "h" billed per hour | "m" billed per month
  tiers:[T(INF, 0.0135)],          // cumulative GiB thresholds, ascending; null = no public price
  egress:{ free:100, unit:"GiB", cur:"USD", tiers:[T(10240,0.09), T(INF,0.05)] },
  put:0.01, get:0.001,             // per 1,000 requests, in `cur`; null = not published
  retrieval:0.01, retrievalCur:"USD", retrievalUnit:"GiB",
  minDays:30, minObj:"128 KB", az:"≥3 AZ", src:"aws.amazon.com/s3/pricing" }
```

Conventions that must hold:

- `T(upTo, rate)` thresholds are **cumulative, in GiB**, ascending, last one `INF`.
- `egress.free` accepts a number (in the vendor's own unit), `"stored"`, `"3xstored"`,
  `"base"` (a bundled allowance, with a `base` object), or `INF` for free egress.
- A vendor with a bundled base fee uses `base:{ fee, inclUnits }`; `inclUnits` is expressed
  in the vendor's own unit.
- `tiers:null` means no public storage price — the row still shows its other fields.

### 2b. Update `block-data.js` (block storage)

Block storage prices split into as many as four line items, so the row shape is wider.

```js
{ id:"aws-gp3", vendor:"AWS EBS", cls:"gp3", region:"eu-central-1 · Frankfurt",
  cur:"USD", unit:"GiB",
  bill:"m",             // "h" per hour | "m" per month | "d30" price list quotes a 30-day month
  rate:0.0952,          // capacity, per unit, per `bill` period; null = no public price
  capM:null,            // optional monthly cap on the hourly rate (OVHcloud)
  ladder:null,          // OR a fixed-size disk ladder, see below (Azure)
  iops:{ free:3000, per:"m", tiers:[T(INF,0.006)] },   // null = IOPS included in `rate`
  tput:{ free:125, per:"m", rate:0.0476 },             // null = throughput included
  classes:null,         // OR per-disk performance classes, see below (STACKIT)
  io:null,              // an unmonetised per-request charge, e.g. { rate, per:"10K", note }
  perf:{ iops:3000, mbs:125, iopsNote:"…" },           // what the capacity rate includes
  max:{ iops:80000, mbs:2000, size:65536 },            // published ceilings for one volume
  minSize:1,
  media:"ssd",          // "hdd" | "ssd" | "premium" | "?" not published, or an array
  medium:"General Purpose SSD",   // the vendor's own words — never our inference
  snap:{ rate:0.054, cur:"USD", unit:"GiB", bill:"m", note:"…" },  // null = none offered
  az:"1 AZ · replicated inside the AZ", sla:"99.9 %", src:"aws.amazon.com/ebs/pricing" }
```

The three non-obvious shapes:

- **`ladder`** — Azure sells fixed disk sizes, so the price is a flat fee per disk chosen by
  rounding the volume up: `ladder:[L(512, 80.54), L(1024, 148.68), …]`, size in the vendor's
  unit, fee per month. `rate` is then unused. The page picks the first entry whose `size` is
  at least the per-volume size.
- **`classes`** — STACKIT sells performance per disk rather than per GB:
  `classes:[{ iops, mbs, fee, name }, …]`, fee in €/disk·hour, on top of `rate`. The page
  picks the cheapest class meeting **both** the IOPS and the MB/s target.
- **`max`** — used to flag rows that cannot deliver the scenario. Any of `iops`, `mbs`,
  `size` may be `null` for "not published", which suppresses that check. Getting these right
  matters: they are what stops a 500-IOPS volume from topping the ranking against an io2.

`perf.iops` and `perf.mbs` accept a number, `null`, the string `"tier"` (Azure — set by the
disk size), the string `"class"` (STACKIT), or a per-GB expression such as `"30/GB"`. They are
display-only; the arithmetic uses `max`, `iops`, `tput` and `classes`.

**`media` and `medium`** drive the storage-medium filter. `medium` is a quotation: write what
the vendor calls the medium and nothing else, and use `"not published"` with `media:"?"` when
they never say. `media` is the bucket the filter groups the row into — `"premium"` means the
vendor's *own* top-performance flash tier, not our opinion of the hardware, so a vendor with
one class is never `"premium"` on our say-so. Use an array when a class genuinely spans
several, as IONOS Essential does ("HDD/SSD") and T Cloud Public's five EVS classes do. Every
row must carry both fields or it will vanish from the filter.

For both files: add a new row's `id` to the right panel(s) in `PANELS` at the bottom, or it
will not appear anywhere.

### 3. Update the reading date

Three places per page carry it: the `// observed` comment at the top of the dataset, the
`Observed` stamp in the page header, and the sources heading — both in the template.

### 4. Verify before publishing

- Recompute a handful of unit prices by hand and compare against the `€/GiB-month` column.
  Object storage: `rate × (730 if hourly) × (1.073741824 if decimal) × FX`. Block storage,
  same for capacity, then add `volumes × max(0, IOPS − free) × iopsRate` and the throughput
  and snapshot equivalents.
- Sanity-check the scenario totals on a row you know well.
- On the block page, set the IOPS control above and below a vendor's published ceiling and
  confirm the ⚠ marker appears and disappears.
- Update the "Known gaps" tables in `README.md` if a vendor's status changed — a rate that
  became public, a contradiction that got resolved, a region that moved.

---

## Publishing

The site lives on the `gh-pages` branch, served at
https://retrack.github.io/eu-object-storage-benchmark/ — an `index.html` listing the runs,
one `runs/<YYYY-MM-DD>/index.html` per published reading, and `runs.json` holding every row's
normalised storage price so a trend dashboard has a history to draw from. That branch carries
no source; its own `README.md` documents the step-by-step publish procedure, including the
one-liner that regenerates the `prices` block so every run is computed the same way.

```bash
git worktree add ../ghp gh-pages
cp eu-object-storage-benchmark.html ../ghp/runs/$(date +%F)/index.html
```

The block storage page is a second series and needs its own path on that branch —
`runs/block/<YYYY-MM-DD>/index.html` — and its own entry in `runs.json`, keyed so a trend
dashboard does not mix provisioned-GiB prices with stored-GiB prices. They are not
comparable numbers and must never share an axis.

Publish a run only after the verification step above — the site is the public face of the
reading, and a run cannot be silently corrected once someone has cited its date.

---

## Normalisation conventions

Shared by both pages:

- Basis **730 h/month** (annual average), prices in **€/GiB-month**, excluding VAT.
- Vendors that price in decimal GB are multiplied by 1.073741824 so the comparison is per
  unit of *physical* storage, not per unit of billing.
- Vendors whose price list quotes a 30-day month (IONOS, STACKIT) carry `bill:"d30"` and are
  rescaled by `hours / 720`.
- Volume tiers are applied tier by tier, not at an average rate.

Object storage only:

- Retrieval fees are applied to the month's egress volume: pulling data out of a cold class
  means restoring it first.
- Minimum storage durations and minimum billable object sizes are shown but **not**
  monetised — both need a churn rate and an object-size profile specific to the workload.

Block storage only:

- Capacity is billed on what is **provisioned**, not what is stored. Every vendor here works
  that way; it is the single biggest difference from the object storage page.
- The capacity, IOPS and throughput controls are **per volume**. Free IOPS baselines and
  Azure's size ladder are per disk, so the volume count changes the answer.
- The ranking is the **effective** price — capacity plus IOPS plus throughput plus snapshots,
  divided by provisioned GiB. Bare capacity gets its own column beside it.
- Per-I/O charges (Azure Standard SSD/HDD transactions, AWS magnetic) are shown but not
  monetised; those rows are marked `+io`.
- A row whose published ceiling cannot meet the scenario is marked ⚠ and costed at the most
  the vendor does offer, rather than being dropped or silently ranked first for being cheap.
- The chart's **Capacity only** toggle drops IOPS, throughput and snapshots. It exists to show
  how far the shelf price sits from the bill, so keep both metrics on the same axis label and
  never present the capacity ranking without saying what it excludes.
