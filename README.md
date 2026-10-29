# gh-pages — published readings

This branch is the published site. It carries **no source**: the datasets, the templates and the
build tooling live on `main`. Everything here is generated output plus the index that lists it.

https://retrack.github.io/eu-object-storage-benchmark/

Three independent series are published: **object storage**, priced on the data you store,
**block storage**, priced on the capacity you provision, and **file storage**, priced on the data
you hold on a shared file system — which several vendors bill as provisioned capacity with a
floor. They are not comparable and must never share an axis.

## Layout

| Path | Role |
|---|---|
| `index.html` | landing page — the run listings, hand-edited |
| `runs/<YYYY-MM-DD>/index.html` | one published **object storage** reading |
| `runs/block/<YYYY-MM-DD>/index.html` | one published **block storage** reading |
| `runs/file/<YYYY-MM-DD>/index.html` | one published **file storage** reading |
| `runs.json` | machine-readable manifest: two series, one entry per run |
| `.nojekyll` | serve the files as-is, no Jekyll processing |

The object storage runs sit directly under `runs/` rather than `runs/object/` because that is
where the first one was published. Those URLs may already have been cited, so they stay put; the
asymmetry is deliberate.

## Publishing a new run

From a clone with `main` checked out, once the dataset has been refreshed and the pages rebuilt:

```bash
DATE=$(date +%F)
git worktree add ../ghp gh-pages          # first time: git worktree add --orphan -b gh-pages ../ghp

# object storage
mkdir -p ../ghp/runs/$DATE
cp object-storage/index.html ../ghp/runs/$DATE/index.html

# block storage
mkdir -p ../ghp/runs/block/$DATE
cp block-storage/index.html ../ghp/runs/block/$DATE/index.html

# file storage
mkdir -p ../ghp/runs/file/$DATE
cp file-storage/index.html ../ghp/runs/file/$DATE/index.html
```

Source paths changed when the repository was restructured: each benchmark is now a folder with
its own generated `index.html`, not a single file at the repository root.

Publish only the series whose prices you actually re-read. A run is a reading, not a rebuild:
copying an unchanged page under a new date claims a freshness it does not have.

Then, on the `gh-pages` worktree:

1. Add an `<a class="run">` block at the top of that series' run list in `index.html`, move its
   `Latest` tag onto it, and update that series' date in the masthead stamp.
2. Append an entry to `series.<name>.runs` in `runs.json` — `date`, `path`, `commit` (the `main`
   commit the page was built from), `observed`, `fx`, `rows`, `vendors` and `prices`.

`prices` is the substrate for the trend dashboard, so it has to be produced the same way every
time. Both generators below read the dataset directly and reproduce the page's own defaults;
run them from the `main` worktree.

### Object storage `prices`

One normalised storage unit price per dataset row id, at 730 h/month, decimal unit assumption,
excluding VAT.

```bash
node -e '
  const fs=require("fs");
  const {ROWS,PANELS,FX,GIB}=new Function(fs.readFileSync("data.js","utf8")+"\nreturn {ROWS,PANELS,FX,GIB};")();
  const uf=u=>u==="GiB"?1:GIB;                      // "GB" and unstated both follow the decimal default
  const p={};
  for(const r of ROWS) p[r.id]=r.tiers ? Number((r.tiers[0].r*(r.bill==="h"?730:1)*uf(r.unit)*FX[r.cur]).toFixed(6)) : null;
  console.log(JSON.stringify(p,null,1));
'
```

### Block storage `prices`

Two figures per row — `capacity` alone and `effective` (capacity plus provisioned IOPS,
throughput and snapshots) — both in EUR per **provisioned** GiB-month. Block storage prices
depend on the scenario, because free IOPS baselines and Azure's fixed disk sizes are per volume,
so the generator hard-codes the page defaults and `runs.json` records them under
`series.block.basis.scenario`. Change the defaults on `main` and this block has to change with
them, or the history stops being one series.

```bash
node -e '
  const fs=require("fs");
  const {ROWS,FX}=new Function(fs.readFileSync("block-data.js","utf8")+"\nreturn {ROWS,FX};")();
  const S={gib:2048,vols:4,iops:3000,mbs:125,snap:1024,hours:730};   // page defaults
  const GIB=1.073741824, uf=u=>u==="GiB"?1:GIB, hf=b=>b==="h"?S.hours:b==="d30"?S.hours/720:1;
  const perVol=()=>S.gib/S.vols;
  const tier=(q,ts)=>{let c=0,p=0;for(const t of ts){const u=Math.min(t.upTo,q);if(u>p){c+=(u-p)*t.r;p=u;}if(p>=q)break;}return c;};
  const lad=r=>r.ladder.find(l=>l.size>=perVol()*uf(r.unit))||r.ladder[r.ladder.length-1];
  const pc=r=>{const f=r.classes.filter(c=>c.iops>=S.iops&&c.mbs>=S.mbs);
    return (f.length?f:r.classes.filter(c=>c.iops===r.max.iops&&c.mbs===r.max.mbs)).sort((a,b)=>a.fee-b.fee)[0]||null;};
  const cap=r=>{if(r.ladder)return S.vols*lad(r).fee*FX[r.cur]; if(r.rate===null)return null;
    let u=r.rate*hf(r.bill); if(r.capM!=null)u=Math.min(u,r.capM); return S.gib*uf(r.unit)*u*FX[r.cur];};
  const io=r=>!r.iops?0:S.vols*tier(Math.max(0,Math.min(S.iops,r.max.iops==null?S.iops:r.max.iops)-r.iops.free),r.iops.tiers)*hf(r.iops.per)*FX[r.cur];
  const tp=r=>!r.tput?0:S.vols*Math.max(0,Math.min(S.mbs,r.max.mbs==null?S.mbs:r.max.mbs)-r.tput.free)*r.tput.rate*hf(r.tput.per)*FX[r.cur];
  const cl=r=>{const c=r.classes?pc(r):null; return c?S.vols*c.fee*S.hours*FX[r.cur]:0;};
  const sn=r=>{if(!r.snap)return r.snapNote&&/not published/i.test(r.snapNote)?null:0;
    let u=r.snap.rate*hf(r.snap.bill); if(r.snap.capM!=null)u=Math.min(u,r.snap.capM);
    return S.snap*uf(r.snap.unit)*u*FX[r.snap.cur];};
  const sh=r=>(r.max.iops!=null&&S.iops>r.max.iops)||(r.max.mbs!=null&&S.mbs>r.max.mbs)||(r.max.size!=null&&perVol()>r.max.size);
  const n=v=>v===null?null:Number((v/S.gib).toFixed(6));
  const p={};
  for(const r of ROWS){const c=cap(r), parts=[c,io(r),tp(r),cl(r),sn(r)], priced=r.rate!==null||!!r.ladder;
    p[r.id]={capacity:n(c), effective:priced?n(parts.reduce((a,x)=>a+(x||0),0)):null,
             partial:parts.some(x=>x===null)||!priced, short:sh(r), media:r.media};}
  console.log(JSON.stringify(p,null,1));
'
```

Spot-check the output against the rendered page before committing: open the run at its defaults
and compare a handful of rows against the **Capacity €/GiB-month** and **Effective €/GiB-month**
columns. If they disagree, the generator has drifted from the page and the manifest is wrong.

### File storage `prices`

Per row: `capacity` alone and `effective` (capacity plus provisioned IOPS and throughput plus
per-GiB read and write charges), both EUR per GiB **held**, plus the flags the page uses. Several
vendors will not sell a share below a minimum, so `billedGiB` can exceed the data held while both
price figures still divide by the data held — that is deliberate, and it is how a capacity floor
shows up as a worse price per gigabyte instead of vanishing into the denominator.

```bash
node -e '
  const fs=require("fs");
  const {ROWS,FX}=new Function(fs.readFileSync("file-storage/data.js","utf8")+"\nreturn {ROWS,FX};")();
  const S={stored:2048,read:1024,written:256,iops:3000,mbs:100,hours:730};   // page defaults
  const GIB=1.073741824;
  const uf=u=>u==="GiB"?1:u==="GB"?GIB:(u==="TB"||u==="TB?")?GIB/1000:GIB;   // decimal assumption
  const hf=b=>b==="h"?S.hours:b==="d30"?S.hours/720:1;
  const billed=r=>Math.max(S.stored, r.minGiB||0);
  const cap=r=>{ if(r.rate===null) return null;
    const base=r.baseFee? r.baseFee.fee*hf(r.baseFee.bill)*FX[r.baseFee.cur] : 0;
    return base + billed(r)*uf(r.unit)*r.rate*hf(r.bill)*FX[r.cur]; };
  const incl=(s,r)=>s&&s.freePerGiB? s.freePerGiB*billed(r):0;
  const perf=(s,t,r)=>!s?0:Math.max(t-incl(s,r), s.min||0, 0)*s.rate*hf(s.per)*FX[r.cur];
  const acc=r=>{ if(!r.access) return 0; const f=uf(r.access.unit);
    return (S.read*f*r.access.read + S.written*f*r.access.write)*FX[r.access.cur||r.cur]; };
  const short=r=>(r.max.iops!=null&&S.iops>r.max.iops)||(r.max.mbs!=null&&S.mbs>r.max.mbs)||(r.max.size!=null&&S.stored>r.max.size);
  const n=v=>v===null?null:Number((v/S.stored).toFixed(6));
  const p={};
  for(const r of ROWS){ const c=cap(r), parts=[c,perf(r.iops,S.iops,r),perf(r.tput,S.mbs,r),acc(r)];
    const priced=r.rate!==null;
    p[r.id]={capacity:n(c), effective:priced?n(parts.reduce((a,x)=>a+(x||0),0)):null,
             billedGiB:priced?billed(r):null, billedOn:r.billedOn, floor:(r.minGiB||0)>S.stored,
             partial:parts.some(x=>x===null)||!!r.ops, short:short(r)};}
  console.log(JSON.stringify(p,null,1));
'
```

## Trend dashboard

Deliberately absent until there are enough readings to draw a line through. When it arrives it
reads `runs.json` — no other data source is needed, which is why the manifest is filled in from
the first run onward. It must plot the three series on separate axes, and for block and file
storage it should plot `capacity` and `effective` as separate lines: the gap between them is the
story.
