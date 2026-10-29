# Object storage — Europe

S3-compatible object storage list prices, normalised to **euros per GiB per month on a
730-hour basis**, Frankfurt region or the closest each vendor operates. 40 vendor × class
rows across 16 vendors.

Open [`index.html`](index.html). Prices observed **29 October 2026**.

Exoscale SOS · AWS S3 · Azure Blob Storage · Google Cloud Storage · Wasabi · Hetzner ·
Backblaze B2 · OVHcloud · Scaleway · IONOS · Cloudflare R2 · UpCloud · DigitalOcean ·
Infomaniak · STACKIT · T Cloud Public (formerly Open Telekom Cloud)

## What the page does

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

## Conventions specific to this benchmark

- Retrieval fees are applied to the month's egress volume: taking data out of a cold class
  means restoring it first.
- Minimum storage durations and minimum billable object sizes are shown but **not**
  monetised — both need a churn rate and an object-size profile specific to a workload.
- Vendors that quote a 30-day month (IONOS, UpCloud) carry `bill:"d30"` and are rescaled by
  `hours / 720`, the same as on the other benchmarks.
- Vendors that bundle a base fee (Hetzner, DigitalOcean Spaces Standard) are costed with the
  fee plus the overage, but the **€/GiB-month column and the chart show the marginal rate** —
  what the next gigabyte costs once the bundle is used up. At the default 100 TiB the bundle
  is a rounding error; at 100 GiB it is the whole bill.
- A retrieval fee waived up to a volume that grows with the data held (DigitalOcean Cold
  Storage) is modelled as an allowance, not charged flat. At the default scenario that waiver
  covers the entire month's egress, so the row shows no retrieval cost.

## Who states their unit, and who doesn't

**Binary, stated in writing** — AWS ("1 GB is 2³⁰ bytes"), Azure, Google ("JEDEC binary
gigabytes"), Exoscale (billed per GiB-hour), OVHcloud (GiB column), Wasabi (1 TB = 1,024 GB).

**Binary, stated in writing** also covers DigitalOcean, whose Spaces and Volumes prices are
quoted per GiB throughout.

**Not stated** — Hetzner, Backblaze, Scaleway, IONOS, Cloudflare, UpCloud, Infomaniak,
STACKIT, and OVHcloud's One Zone classes as the catalogue quotes them. Those rows carry a △
marker and follow the page's unit selector.

## Known gaps and contradictions

Left visible rather than filled with estimates:

| Item | Status |
|---|---|
| STACKIT egress and request pricing | absent from the official price list v1.0.44 (06.10.2026) |
| T Cloud Public (ex-Open Telekom Cloud) storage price | calculator/console only, nothing public |
| IONOS | DE page €0.007/GB/30 d vs US page $0.00487/GB/30 d — a ~44 % gap FX does not explain |
| Hetzner base fee | price API returns €6.49 + €0.0087/TB·h; the launch press release still says €4.99 + €0.0067. The API is used. |
| Unit basis | not stated by 7 of the vendors listed |
| Redundancy model | not published by Wasabi, Backblaze, Hetzner, Cloudflare, Infomaniak, STACKIT |
| OVHcloud One Zone Standard / IA | now published in the DE public cloud catalogue in EUR, per GB·hour — €0.00000972 and €0.00000548. The September reading took Standard off the USD price page at $0.0081103/GiB-month; the catalogue is the better source and the unit it quotes is an undefined "GB", so the row moved from GiB to △. |
| UpCloud object storage | sold in 250 GB steps at €5 per step: the page costs it at the implied €0.02/GB per 30 days, which is exact above one step and understates a 100 GB bucket. No request, redundancy or AZ figure is published. |
| DigitalOcean Spaces | no request line item at all on the price list — storage, transfer and (on Cold) retrieval are the only meters. Redundancy model not published. |
| DigitalOcean Spaces Cold Storage | has no subscription of its own: the $5 and its 1,024 GiB transfer allowance sit on the Standard row, and the page shows the allowance on both. |

Region equivalence is imperfect and is labelled per row: OVHcloud's 3-AZ multi-zone storage
exists only in Paris and Milan (Frankfurt/Limburg is single-zone), Backblaze's European region
is Amsterdam, Infomaniak is Swiss, and STACKIT is Germany South.

## Rebuilding

```bash
python3 ../tools/build.py object-storage
```

`data.js`, `page.html` and `page.js` are the sources, composed with `shared/` into
`index.html`. See the repository `AGENTS.md` for the row shape and the collection procedure.
