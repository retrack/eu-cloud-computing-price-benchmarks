# gh-pages — published readings

This branch is the published site. It carries **no source**: `data.js`, the template and the
build tooling live on `main`. Everything here is generated output plus the index that lists it.

https://retrack.github.io/eu-object-storage-benchmark/

## Layout

| Path | Role |
|---|---|
| `index.html` | landing page — the run listing, hand-edited |
| `runs/<YYYY-MM-DD>/index.html` | one published reading, a copy of the built page at that date |
| `runs.json` | machine-readable manifest: one entry per run, with the normalised storage price of every dataset row |
| `.nojekyll` | serve the files as-is, no Jekyll processing |

## Publishing a new run

From a clone with `main` checked out, once `data.js` has been refreshed and the page rebuilt:

```bash
DATE=$(date +%F)
git worktree add ../ghp gh-pages          # first time: git worktree add --orphan -b gh-pages ../ghp
mkdir -p ../ghp/runs/$DATE
cp eu-object-storage-benchmark.html ../ghp/runs/$DATE/index.html
```

Then, on the `gh-pages` worktree:

1. Add a `<a class="run">` block at the top of the run list in `index.html`, move the
   `Latest` tag onto it, and update the reading date in the masthead stamp.
2. Append an entry to `runs` in `runs.json` — `date`, `path`, `commit` (the `main` commit the
   page was built from), `fx`, `rows`, `vendors`, and `prices`.

`prices` holds the normalised storage unit price per dataset row id, at the page's default
basis: 730 h/month, decimal unit assumption, excluding VAT. It is the substrate for the trend
dashboard, so it has to be produced the same way every time:

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

## Trend dashboard

Deliberately absent until there are enough readings to draw a line through. When it arrives it
reads `runs.json` — no other data source is needed, which is why the manifest is filled in from
the first run onward.
