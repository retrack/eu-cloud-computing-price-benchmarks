# EU Cloud Computing Price Benchmarks — maintenance guide

## Shape of the repository

A benchmark is a top-level directory holding `meta.json`, `data.js`, `page.html` and
`page.js`. `tools/build.py` finds them by that signature and composes them with `shared/`
into `index.html` — there is no registry to update.

Everything generic lives in `shared/`; everything product-specific lives in the benchmark's
folder. The pages are deliberately **separate pages, not tabs of one**: the products are
bought by different people for different reasons, the cost drivers do not overlap (egress and
requests versus provisioned IOPS and throughput), and merging the scenarios would produce a
control panel nobody could read. They share the look, the machinery and the tooling; they do
not share a dataset or a cost model.

| Path | Role |
|---|---|
| `shared/shell.html` | document skeleton with `{{TITLE}}`, `{{BASE_CSS}}`, `{{BODY}}`, `{{UI_JS}}` … placeholders |
| `shared/base.css` | tokens, layout, controls, tabs, ranking chart, table — used by every page |
| `shared/ui.js` | `uf`/`hf`/`tierCost`, formatting, `renderRanking`, `sortRows`, `wireTabs`/`wireSort`/`bindControls`/`wireReset` |
| `<benchmark>/meta.json` | `title`, `description`, `observed` |
| `<benchmark>/data.js` | the dataset — one entry per vendor × class, plus `FX`, `FX_NOTE`, `PANELS` |
| `<benchmark>/page.html` | the body markup: header, controls, table head, notes, sources |
| `<benchmark>/page.js` | the cost model, the renderers, the wiring calls |
| `<benchmark>/style.css` | product-specific CSS (optional; none of the benchmarks needs one today) |
| `<benchmark>/index.html` | generated; committed so a clone opens without a build |
| `<benchmark>/README.md` | what it covers, its conventions, its known gaps |
| `README.md` | public repository README and benchmark index |
| `LICENSE` | CC BY 4.0 |
| `NOTES-internal.md` | internal commentary — gitignored, stays local |

```bash
python3 tools/build.py                 # every benchmark
python3 tools/build.py block-storage   # just one
```

**Script order matters.** The build concatenates `shared/ui.js`, then `<benchmark>/data.js`,
then `<benchmark>/page.js` into one `<script>`. Helpers in `ui.js` read `S`, `GIB`, `FX`,
`FX_NOTE` and `PANELS`, which the later files declare — safe because nothing in `ui.js` runs
at load time. Each `page.js` therefore ends by calling `stampFx()`, `wireTabs(render)`,
`wireSort(SORT, render)`, `bindControls({...}, render)`, `wireReset(...)` and then `render()`.

Anything a second benchmark would also want belongs in `shared/`, not copied into both — the
ranking-metric toggle, the hatched-bar marking and the filter chips started life in
`block-storage/style.css` and moved to `shared/base.css` the moment file storage wanted them.
If a change to `ui.js` or `base.css` is only wanted on one page, that is a sign it belongs in
the benchmark's own `page.js` or `style.css` instead.

---

## Refreshing the FX rates

Two lines at the top of each `<benchmark>/data.js`:

```js
const FX = { EUR: 1, USD: 0.858222, CHF: 1.063377 }; // EUR per 1 unit
const FX_NOTE = "ECB 09.09.2026: 1 EUR = 1.1652 USD = 0.9404 CHF";
```

`FX` holds **EUR per one unit of foreign currency** — the inverse of the way the ECB quotes
them. `FX_NOTE` is the human-readable stamp shown in the page header. Keep them consistent:
`FX.USD` must equal `1 / (USD per EUR)`. The script handles the inversion; never edit the line
by hand and invert it yourself.

```bash
python3 tools/update_fx.py                        # fetch the latest ECB rates, every dataset
python3 tools/update_fx.py --dry-run              # print what it would write, change nothing
python3 tools/update_fx.py --only block-storage   # one benchmark
python3 tools/build.py                            # regenerate the pages
```

A dataset carries the FX rate that was current when its prices were read. Refreshing FX
without re-reading the prices is legitimate — the rates are independent — but do it for every
dataset at once, or two pages will quote different rates on the same day. A dataset already
carrying the requested rates is reported and skipped, not treated as an error.

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
| AWS | Price List Bulk API: `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/eu-central-1/index.csv` (280 MB — stream it through `grep`). File storage is the same API with the `AmazonEFS` offer code and is only a few kB. Object storage: `https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/s3/USD/current/*.json`, key `regions["EU (Frankfurt)"]` |
| Azure | Retail Prices API, `https://prices.azure.com/api/retail/prices?currencyCode=USD&$filter=armRegionName eq 'germanywestcentral' and priceType eq 'Consumption' and productName eq '<product>'` |
| Google | the pricing tables are serialised inside the HTML of `cloud.google.com/compute/disks-image-pricing` and `cloud.google.com/filestore/pricing`; split on the `"Frankfurt (europe-west3)",[2]` marker to get the monthly table. Filestore capacity floors come from `cloud.google.com/filestore/docs/service-tiers`, not from the price page |
| OVHcloud | `https://eu.api.ovh.com/v1/order/catalog/public/cloud?ovhSubsidiary=DE` — `addons[].planCode` matching `volume`/`snapshot`/`share`, prices in units of 1e-8 EUR, net of the `taxRate` in `locale` |
| Exoscale | `https://portal.exoscale.com/api/pricing/<product>` — the endpoint the price page's Angular controller calls. `blockstorage`, `sos`, and so on |
| Hetzner | object storage: `website-price-api.hetzner.com`. Block storage: the price is an attribute on the `<ho-block-storage-calculator>` element of `hetzner.com/cloud/block-storage/`, and only appears when the page is fetched with a European locale |
| STACKIT | the price list PDF linked from `stackit.com/en/prices` — run it through `pdftotext -layout` |
| Scaleway | the price pages now answer a plain fetch with a bot challenge; read the rendered DOM, and open the per-product “Legal notice” before trusting a unit |
| IONOS | `cloud.ionos.de/preise` renders server-side; the German page carries line items the English one does not |

Anything you cannot confirm is `null` or `"not published"` — never an estimate. The pages
render those as `not published` and mark the scenario cost with `≥`.

### 2a. Update `object-storage/data.js`

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

### 2b. Update `block-storage/data.js`

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

### 2c. Update `file-storage/data.js`

Managed shared file systems split differently again: the fight is over what the capacity rate
is applied to, and what the vendor will refuse to sell you.

```js
{ id:"azf-ssd-lrs", vendor:"Azure Files", cls:"Provisioned v2 SSD LRS", region:"Germany West Central",
  cur:"USD", unit:"GiB",
  bill:"h",             // "h" per hour | "m" per month | "d30" the price list quotes a 30-day month
  rate:0.000196,        // capacity, per unit, per `bill` period; null = no public price
  billedOn:"provisioned",          // "stored" = the bytes held | "provisioned" = the share, empty or full
  minGiB:32,            // smallest share the vendor sells; 0 = none, null = not published
  maxGiB:262144,
  baseFee:null,         // OR a flat per-instance charge, e.g. Google custom performance
  iops:{ min:3000, per:"h", rate:0.000053 },   // null = IOPS included in `rate`
  tput:{ min:100, per:"h", rate:0.000077 },    // null = throughput included
  access:null,          // OR per-GiB read/write charges, e.g. { read, write, cur, unit, note }
  ops:null,             // a published per-operation charge that cannot be monetised
  perf:{ iops:0, mbs:0, note:"…" },            // what the capacity rate includes, for display
  max:{ iops:102400, mbs:10340, size:262144 }, // published ceilings, for the ⚠ check
  snap:{ rate:0.000196, cur:"USD", unit:"GiB", bill:"h" },   // null = none offered
  proto:"SMB · NFSv4.1", az:"single datacentre", src:"azure.microsoft.com/pricing/details/storage/files" }
```

The shapes that matter:

- **`billedOn` and `minGiB` together are the headline of this page.** A vendor billing
  `provisioned` capacity charges `max(data held, minGiB)`, so asking for less than the floor
  does not make the row cheaper — it makes the price per gigabyte worse, which is exactly how
  the chart shows it. Both chart metrics divide by the GiB *asked for*, never the GiB billed.
- **`min` on `iops`/`tput` is a floor, not an allowance.** It is the least the vendor will
  sell. Azure Files provisioned v2 includes nothing and will not sell fewer than 3,000 IOPS
  on SSD, so a 32 GiB share is dominated by its performance floor.
- **`freePerGiB` on `iops`/`tput` is the opposite**: a real allowance that grows with the data
  held. AWS includes 50 MiB/s per TiB of Standard storage and bills Provisioned Throughput
  only above it — at 2 TiB and 100 MiB/s that charge is zero, and a model without
  `freePerGiB` would overcharge AWS by the whole line.
- **`unit` accepts `"TB?"`** for IONOS, which quotes per TB and never says which TB. Both the
  TB→GB step and the GiB→GB step then follow the unit selector, which is why that row moves
  10 % between the two assumptions rather than 7.4 %. The helper lives in `file-storage/page.js`,
  not in `shared/ui.js`, because no other page has a TB-quoted vendor.
- **`ops`** marks a published per-operation charge that cannot be turned into a monthly figure
  without assuming an average I/O size. Those rows show `+ops`, their total is prefixed `≥`,
  and their bar is hatched — an unhatched bar would be quietly treating the charge as zero.

For every dataset: add a new row's `id` to the right panel(s) in `PANELS` at the bottom, or it
will not appear anywhere.

### 3. Update the reading date

Four places per page carry it: the `// observed` comment at the top of `data.js`, the
`observed` field in `meta.json`, the `Observed` stamp in the page header and the sources
heading (both in `page.html`). The benchmark's `README.md` and the index table in the root
`README.md` state it too.

### 4. Verify before publishing

- Recompute a handful of unit prices by hand and compare against the `€/GiB-month` column.
  Object storage: `rate × (730 if hourly) × (1.073741824 if decimal) × FX`. Block storage,
  same for capacity, then add `volumes × max(0, IOPS − free) × iopsRate` and the throughput
  and snapshot equivalents.
- Sanity-check the scenario totals on a row you know well.
- On the block page, set the IOPS control above and below a vendor's published ceiling and
  confirm the ⚠ marker appears and disappears.
- Update the "Known gaps" table in that benchmark's `README.md` if a vendor's status changed
  — a rate that became public, a contradiction that got resolved, a region that moved.

---


---

## Adding a new benchmark

1. `mkdir <name>` at the repository root — name it for the thing being priced: `compute`,
   `egress`, `managed-kubernetes`.
2. Write `<name>/meta.json` with `title`, `description` and `observed`.
3. Copy the nearest existing `page.html` and `page.js` as a starting point and adapt the
   controls, the columns and the cost model. Keep the shared machinery — the tab, sort,
   ranking and reset wiring should come from `shared/ui.js`, not be re-implemented.
4. Write `<name>/data.js` following the collection procedure above, with its own `FX`,
   `FX_NOTE` and `PANELS`. Copy the FX lines from an existing dataset so every page agrees.
5. Add `<name>/style.css` only for CSS that genuinely belongs to that product; anything the
   other pages would also want goes in `shared/base.css`.
6. `python3 tools/build.py <name>`.
7. Write `<name>/README.md` — what it covers, its conventions, its known gaps — and add a row
   to the benchmark index table in the root `README.md`.
8. Give it its own `runs/<name>/` series on `gh-pages` when you publish it.

Whatever is being priced, the house rules in the root `README.md` apply: one stated basis,
physical units rather than billing units, tiers applied tier by tier, nothing estimated,
regions labelled, assumptions adjustable on the page, and capability gaps marked rather than
rewarded.

---

## Publishing

The site lives on the `gh-pages` branch, served at
https://retrack.github.io/eu-cloud-computing-price-benchmarks/ — an `index.html` listing the runs,
one `runs/<YYYY-MM-DD>/index.html` per published reading, and `runs.json` holding every row's
normalised storage price so a trend dashboard has a history to draw from. That branch carries
no source; its own `README.md` documents the step-by-step publish procedure, including the
one-liner that regenerates the `prices` block so every run is computed the same way.

```bash
git worktree add ../ghp gh-pages
mkdir -p ../ghp/runs/$(date +%F)
cp object-storage/index.html ../ghp/runs/$(date +%F)/index.html
mkdir -p ../ghp/runs/block/$(date +%F)
cp block-storage/index.html ../ghp/runs/block/$(date +%F)/index.html
mkdir -p ../ghp/runs/file/$(date +%F)
cp file-storage/index.html ../ghp/runs/file/$(date +%F)/index.html
```

Each benchmark is its own series on that branch — object storage at
`runs/<YYYY-MM-DD>/index.html`, block storage at `runs/block/<YYYY-MM-DD>/index.html`, file
storage at `runs/file/<YYYY-MM-DD>/index.html` — with its own entry under `series` in
`runs.json`, keyed so a trend dashboard does not mix a euro per GiB *stored* with a euro per
GiB *provisioned*. They are not comparable numbers and must never share an axis. A benchmark
added later gets its own `runs/<name>/` prefix on the same pattern.

Publish only the series whose prices you actually re-read. A run is a reading, not a rebuild:
copying an unchanged page under a new date claims a freshness it does not have. Refreshing FX
across every dataset does not make the other pages new readings.

The repository was renamed from `eu-object-storage-benchmark`; GitHub redirects both the old
repository URL and the old Pages URL, but new links should use the current name.

Publish a run only after the verification step above — the site is the public face of the
reading, and a run cannot be silently corrected once someone has cited its date.

---

## Normalisation conventions

Shared by every page:

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

File storage only:

- The capacity control is **data held**, not share size. A vendor billing provisioned capacity
  is charged on `max(held, its minimum)`; one billing consumption is charged on what is held.
  Which of the two a row does is a column on the page, not a footnote.
- Both chart metrics divide by the GiB **asked for**, never the GiB billed, so a capacity floor
  reads as a worse price per gigabyte instead of vanishing into the denominator.
- Performance floors (`min`) and performance allowances (`freePerGiB`) are different fields and
  must not be conflated. Azure sells no IOPS below its floor; AWS gives throughput away in
  proportion to the data held.
- Snapshots are shown per GiB but not costed into the scenario — snapshot volume needs a change
  rate specific to the workload.
- This is the one benchmark with no Exoscale row, because Exoscale has no file storage product.
  Say so on the page rather than leaving a reader to wonder; an absent product is not a zero.
