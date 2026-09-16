# Block storage — Europe

EBS-shaped block volumes — attachable, resizable, snapshottable — normalised to **euros per
provisioned GiB per month on a 730-hour basis**, Frankfurt region or the closest each vendor
operates. 37 vendor × class rows.

Open [`index.html`](index.html). Prices observed **10 September 2026**.

## What the page does

The same three panels as the object storage benchmark, but the ranking is the **effective**
price of the scenario — capacity plus provisioned IOPS plus provisioned throughput plus
snapshots, divided by the provisioned GiB. Bare capacity has its own column beside it, and the
two diverge sharply: AWS io2 at 3,000 IOPS per volume costs four times its capacity rate.

| Control | Default | Effect |
|---|---|---|
| Provisioned | 2,048 GiB | total capacity across all volumes |
| Volumes | 4 | free IOPS baselines and Azure's size ladder are **per disk**, so this matters |
| IOPS per volume | 3,000 | exactly the AWS and Azure free baseline, so the comparison starts at capacity-only |
| MB/s per volume | 125 | likewise |
| Snapshot data | 1,024 GiB | snapshot storage held |
| Hours per month | 730 | 720, 730 or 744 |
| Unit assumption | decimal | for vendors that never define their "GB" |
| Storage medium | all four on | filters chart and table to HDD & magnetic, SSD, Premium SSD, or medium not stated |
| Chart metric | Effective | switches the bar chart between the effective price and capacity alone |

The **Capacity only** toggle separates the shelf price from the bill. STACKIT is second
cheapest on capacity and ninth once its per-disk performance class is added; AWS io2 moves
further still. The table always shows both columns.

The **storage medium** under each class is the vendor's own words, never an inference. The
filter groups them into HDD & magnetic, SSD, and Premium SSD — the last being each vendor's
own top-performance flash tier, not a claim about the hardware. Google's Hyperdisk Throughput
sits with the HDDs because Google itself compares its latency to a hard disk. IONOS Essential
is listed as "HDD/SSD" and appears under both. STACKIT states no medium anywhere and gets its
own bucket.

Three behaviours are specific to this page:

- **Azure's size ladder is modelled.** Premium SSD, Standard SSD and Standard HDD are sold in
  fixed disk sizes, so a 600 GiB disk is billed as a 1,024 GiB P30. Change the volume count
  and the rounding moves the row.
- **STACKIT's per-disk performance classes are modelled.** The page picks the cheapest of its
  18 classes meeting both the IOPS and the MB/s target, and shows which one.
- **Rows that cannot deliver the scenario are marked ⚠** and their bar is hatched. A 500-IOPS
  OVHcloud Classic Volume is not a substitute for a 25,000-IOPS io2, and the page says so
  rather than ranking it first for being cheap.

## Conventions specific to this benchmark

- Capacity is billed on what is **provisioned**, not what is stored. Every vendor here works
  that way; it is the single biggest difference from the object storage page.
- The capacity, IOPS and throughput controls are **per volume**, because free baselines and
  Azure's ladder are per disk.
- Per-I/O charges (Azure Standard SSD/HDD transactions, AWS magnetic) are shown but not
  monetised; those rows are marked `+io`.
- A row whose published ceiling cannot meet the scenario is costed at the most the vendor does
  offer, rather than dropped.

## Known gaps and contradictions

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

## Rebuilding

```bash
python3 ../tools/build.py block-storage
```

`data.js`, `page.html`, `page.js` and `style.css` are the sources, composed with `shared/`
into `index.html`. See the repository `AGENTS.md` for the row shape and the collection
procedure.
