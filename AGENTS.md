# EU Object Storage Benchmark — working notes

## Deliverable

`eu-object-storage-benchmark.html` — a self-contained HTML page. Open it directly; there is
no runtime dependency beyond a web font.

Three tabbed panels — **Core set**, **Hyperscalers**, **European providers** — each with a
ranked bar chart of normalised storage price and a sortable detail table. The scenario cost
recalculates from the controls at the top (stored TiB, egress TiB/month, PUT/GET volumes,
hours per month, and the unit assumption for vendors that never define their "GB").

`README.md` is the public repository README. Internal commentary — what the benchmark
changes for our own slide, how to use it in a customer conversation — lives in
`NOTES-internal.md`, which is gitignored and never leaves the folder.

## Files

| Path | Role |
|---|---|
| `data.js` | pricing dataset — the source of truth. One row = one vendor × one storage class. |
| `page.template.html` | HTML/CSS/JS shell, contains the `/*__DATA__*/` marker |
| `tools/build.py` | assembles `data.js` + template → `eu-object-storage-benchmark.html` |
| `tools/update_fx.py` | refreshes the EUR/USD and EUR/CHF rates inside `data.js` |
| `README.md` | public repository README |
| `LICENSE` | CC BY 4.0 |
| `NOTES-internal.md` | internal commentary — gitignored, stays local |
| `archive/` | superseded versions, including the original French edition |

## Build

```bash
python3 tools/build.py
```

`data.js` and `page.template.html` are the sources; the HTML is generated and committed so
the page can be opened straight from a clone.

---

## Refreshing the FX rates

Rates live in two lines at the top of `data.js`:

```js
const FX = { EUR: 1, USD: 0.860437, CHF: 1.063264 }; // EUR per 1 unit
const FX_NOTE = "ECB 04.09.2026: 1 EUR = 1.1622 USD = 0.9405 CHF";
```

`FX` holds **EUR per one unit of foreign currency** — the inverse of the way the ECB quotes
them. `FX_NOTE` is the human-readable stamp shown in the page header. Keep them consistent:
`FX.USD` must equal `1 / (USD per EUR)`.

```bash
python3 tools/update_fx.py                 # fetch the latest ECB rates and rewrite both lines
python3 tools/update_fx.py --dry-run       # print what it would write, change nothing
python3 tools/build.py                     # regenerate the HTML
```

If the fetch fails (a filtered network, a proxy 403), read the rates off https://www.ecb.europa.eu/stats/eurofxref/ (or
`api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,CHF`) and pass them by hand:

```bash
python3 tools/update_fx.py --usd 1.1622 --chf 0.9405 --date 2026-09-04
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
vendor actually operates**. For each storage class record:

- storage rate, its currency, its unit (per GB or per GiB), and whether it is billed per hour
  or per month
- **the vendor's own definition of "GB"** — decimal 10⁹ or binary 2³⁰. Quote it if you find
  it. This is the single most contested field in the whole table.
- egress price per unit, plus any free allowance and its volume tiers
- API request pricing (PUT/COPY/POST/LIST and GET, per 1,000)
- retrieval fee per unit for cold and archive classes
- minimum storage duration in days, minimum billable object size
- redundancy: single zone, single datacentre, multi-AZ, replica count
- whether prices exclude VAT

AWS, Azure, Google, Hetzner and Exoscale render prices client-side, so a plain HTML fetch
returns empty placeholders. Read the rendered DOM with the region selected, or go to the
price feed the page consumes:

- AWS — `https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/s3/USD/current/*.json`,
  key `regions["EU (Frankfurt)"]`
- Azure — the Retail Prices API, `armRegionName eq 'germanywestcentral'`
- Hetzner — `website-price-api.hetzner.com` (its press release is stale; the API is not)

Anything you cannot confirm is `null` or `"not published"` — never an estimate. The page
renders those as `not published` and marks the scenario cost with `≥`.

### 2. Update `data.js`

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
- `unit:"GB?"` makes the row follow the page's unit selector and adds the △ marker. Use it
  whenever the vendor does not state a basis — do not guess on their behalf.
- `egress.free` accepts a number (in the vendor's own unit), `"stored"`, `"3xstored"`,
  `"base"` (a bundled allowance, with a `base` object), or `INF` for free egress.
- A vendor with a bundled base fee uses `base:{ fee, inclUnits }`; `inclUnits` is expressed
  in the vendor's own unit.
- `tiers:null` means no public storage price — the row still shows its other fields.
- Add a new row's `id` to the right panel(s) in `PANELS` at the bottom of the file, or it
  will not appear anywhere.

### 3. Update the reading date

Three places carry it: the `// observed` comment at the top of `data.js`, the `Observed`
stamp in the page header, and the sources heading — all in `page.template.html`.

### 4. Verify before publishing

- Recompute a handful of unit prices by hand and compare against the `€/GiB-month` column.
  `rate × (730 if hourly) × (1.073741824 if the unit is decimal) × FX` is the whole formula.
- Sanity-check the scenario totals on a row you know well.
- Update the "Known gaps" table in `README.md` if a vendor's status changed — a rate that
  became public, a contradiction that got resolved, a region that moved.

---

## Normalisation conventions

- Basis **730 h/month** (annual average), prices in **€/GiB-month**, excluding VAT.
- Vendors that price in decimal GB are multiplied by 1.073741824 so the comparison is per
  unit of *physical* storage, not per unit of billing.
- Retrieval fees are applied to the month's egress volume: pulling data out of a cold class
  means restoring it first.
- Storage and egress volume tiers are applied tier by tier, not at an average rate.
- Minimum storage durations and minimum billable object sizes are shown but **not**
  monetised — both need a churn rate and an object-size profile specific to the workload.
