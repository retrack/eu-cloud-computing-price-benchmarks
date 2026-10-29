# File storage — Europe

Managed shared file systems — the AWS EFS shape, mounted over NFS or SMB by several instances
at once — normalised to **euros per stored GiB per month on a 730-hour basis**, Frankfurt
region or the closest each vendor operates. 31 vendor × class rows across 10 vendors.

Open [`index.html`](index.html). Prices observed **29 October 2026**.

**There is no Exoscale row.** Exoscale sells object storage and block storage but no managed
shared file system, and a product a vendor does not offer is absent, not free and not a zero
in a ranking. This is the only benchmark in the repository with no highlighted brand row.

## What the page does

Three panels — Core set, Hyperscalers, European providers — ranked on the **effective** price
of the scenario: capacity plus provisioned IOPS and throughput plus per-GiB read and write
charges, divided by the GiB you asked to hold. A toggle switches the chart to capacity alone.

| Control | Default | Effect |
|---|---|---|
| Data held | 2,048 GiB | what you need to store; vendors with a higher floor bill the floor |
| Read | 1,024 GiB/month | drives the per-GiB access charges, which on EFS are most of the bill |
| Written | 256 GiB/month | likewise, and written GiB cost more than read GiB on EFS |
| IOPS wanted | 3,000 | exactly Azure's SSD floor, so the comparison starts where Azure starts |
| MiB/s wanted | 100 | exactly Azure's SSD floor, and what 2 TiB of EFS Standard already includes |
| Hours per month | 730 | 720, 730 or 744 |
| Unit assumption | decimal | for vendors that never define their "GB" — or, at IONOS, their "TB" |
| Chart metric | Effective | switches the bar chart between the effective price and capacity alone |

Four behaviours are specific to this page:

- **Capacity floors are modelled.** Google Filestore Basic SSD will not sell a share below
  2.5 TiB; Basic HDD, Zonal and Enterprise stop at 1 TiB; IONOS starts at 2 TB; DigitalOcean's
  high-performance tier at 500 GiB and STACKIT's resource pool at 500 GB; UpCloud at 250 GiB;
  OVHcloud at 150 GiB; Azure's provisioned tiers at 32 GiB; Scaleway at 25 GB. Ask for less and the row is
  marked ▲, its bar hatched, and the cost is what the vendor would actually invoice. Both
  chart metrics divide by the GiB you *asked for*, not the GiB billed, so a floor shows up as
  a higher price per gigabyte instead of disappearing into the denominator.
- **Performance floors are modelled separately from allowances.** Azure Files provisioned v2
  includes nothing and will not sell fewer than 3,000 IOPS and 100 MiB/s on SSD, so a small
  share is dominated by its performance floor. AWS, by contrast, includes 50 MiB/s per TiB of
  Standard storage and bills Provisioned Throughput only above it — at the default 2 TiB and
  100 MiB/s that charge is zero.
- **Rows that cannot deliver the scenario are marked ⚠.** Google Filestore Basic HDD publishes
  600 read IOPS between 1 and 10 TiB and 1,000 above it, so it is flagged at the default 3,000
  and cannot reach it at any size Google sells; OVHcloud tops out at 128 MiB/s and DigitalOcean
  Standard at 119. A flagged row is costed at the most the vendor does offer rather than being
  dropped or ranked first for being cheap.
- **Published limits are a column, and most of them move.** The capacity range each vendor sells
  sits beside the performance ceiling for one share. Those ceilings are rarely flat numbers:
  OVHcloud sells 24 IOPS and 0.25 MiB/s per provisioned GiB, Scaleway 12 IOPS and 0.1 MB/s per GB
  above a 25 GB baseline, Google quotes every scalable tier per TiB, and DigitalOcean's high
  performance tier adds 1 Gbps per TiB above the first. The column shows each one **at the size
  being billed**, so it moves with the capacity control instead of quoting a maximum reached only
  at 100 TiB. AWS is the only vendor here publishing no capacity ceiling at all.

## Conventions specific to this benchmark

- The capacity control is **data held**, not share size. Vendors that bill provisioned
  capacity are charged on `max(held, their minimum)`; vendors that bill consumption are
  charged on what is held. Which of the two a row does is a column.
- Snapshots are shown per GiB but **not** costed into the scenario — snapshot volume needs a
  change rate specific to the workload.
- Per-operation charges (Azure's pay-as-you-go tiers) are published but cannot be monetised
  without assuming an average I/O size. They are shown, marked `+ops`, the scenario total is
  prefixed `≥`, and the bar is hatched — an unhatched bar would be quietly treating the
  missing component as zero.
- Minimum storage durations (EFS Archive, 90 days) and minimum billable file sizes (EFS IA and
  Archive, 128 KiB) are shown but not monetised.
- Published limits come from the documentation, not the price pages, and are recorded as the
  vendor states them: where a vendor splits read from write, the figure checked is the read side
  and the note carries both. A default quota that can be raised on request (AWS) is recorded at
  its default. A measured benchmark is not a limit — IONOS's iozone figures are shown and nothing
  is checked against them.
- EFS is costed in its default Elastic Throughput mode; the Provisioned Throughput row shows
  the alternative, where throughput is bought up front and nothing is charged per GiB moved.

## Known gaps and contradictions

| Item | Status |
|---|---|
| T Cloud Public SFS | no rate card — calculator and console only. The pricing-model page says only that SFS follows the EVS model and that, unlike EVS, "only the actual stored data is billed". It publishes no capacity range and no performance ceiling either. |
| STACKIT performance | Standard, Premium and Ultra are priced at €0.22, €0.36 and €0.65 per GB-month with no IOPS or throughput figure published for any of them — nothing on the price list says what the extra 62 % or 188 % buys, and the limits page offers only an expected backend latency under 2 ms |
| STACKIT "Metro" | the product page advertises a two-zone synchronous version that does not appear in the price list at all |
| IONOS performance | published as iozone benchmark results — ≈24,000 read and ≈18,000 write IOPS on a 4 TiB cluster, ≈370 MB/s read per TiB, scaling linearly — rather than as a ceiling IONOS undertakes to hold. Shown in the Performance column; no ⚠ check is made against it |
| IONOS unit | quoted per TB without stating which TB, so both the TB→GB and the GiB→GB conversions follow the unit selector — while the cluster size the same vendor publishes is stated in TiB |
| Scaleway | the price table prints "€0.000221/HOUR" with no unit; that it is per GB follows from the legal notice beneath it, not from the number. Its throughput ceiling is published in MB/s and is not converted here, so the 200 shown are 191 MiB/s |
| Capacity ranges in GB | Scaleway (25 GB – 50 TB), STACKIT (500 GB – 20 TB) and UpCloud (250 GB – 25 TB) state their capacity ranges in decimal units; the page holds them in its GiB fields unconverted, so those three ranges are read about 7 % high |
| Azure pay-as-you-go | transaction charges published but not monetisable without an I/O-size assumption; those rows are floors |
| Azure Files reservations | up to 36 % off storage, not modelled — like every other commitment discount on these pages |
| UpCloud | no IOPS or throughput figure published anywhere — the capacity range, "250 GB to 25 TB per instance", is the whole of it. The price table writes "250 GB" in the size column beside "per GiB" in the price column, and the product page's "from 250 GiB" is what is used |
| DigitalOcean | throughput published in Gbps, converted here at 119 MiB/s per Gbps; the high performance tier's ceiling grows by 1 Gbps per TiB above the first. Its only European region for this product is Amsterdam — there is no Frankfurt equivalent. |
| Hetzner, Infomaniak, Cloudflare | no managed shared file system; absent by design. Hetzner's Storage Box is a standalone product on fixed plans, not a file system instances mount inside a region. |

## Rebuilding

```bash
python3 ../tools/build.py file-storage
```

`data.js`, `page.html` and `page.js` are the sources, composed with `shared/` into
`index.html`. See the repository `AGENTS.md` for the row shape and the collection procedure.
