/* ---------------- calculation engine ---------------- */
const S = { gib:2048, vols:4, iops:3000, mbs:125, snap:1024, hours:730, unitMode:"decimal", panel:"actuel",
            media:{ hdd:true, ssd:true, premium:true, unk:true }, metric:"eff" };
const MEDIA_LABEL = { hdd:"HDD & magnetic", ssd:"SSD", premium:"Premium SSD", unk:"medium not stated" };
/* a row may span several media; "?" means the vendor never states one */
const mediaKeys = r => (Array.isArray(r.media) ? r.media : [r.media]).map(m => m === "?" ? "unk" : m);
const mediaShown = r => mediaKeys(r).some(k => S.media[k]);

function perVolume(){ return S.gib / Math.max(1, S.vols); }

/* the Azure ladder: a disk is billed at the first fixed size that fits it */
function ladderTier(r){
  if(!r.ladder) return null;
  const per = perVolume() * uf(r.unit);
  return r.ladder.find(l => l.size >= per) || r.ladder[r.ladder.length - 1];
}
/* the STACKIT ladder: the cheapest performance class that meets both targets */
function perfClass(r){
  if(!r.classes) return null;
  const fits = r.classes.filter(c => c.iops >= S.iops && c.mbs >= S.mbs);
  const pool = fits.length ? fits : r.classes.filter(c => c.iops === r.max.iops && c.mbs === r.max.mbs);
  return pool.sort((a, b) => a.fee - b.fee)[0] || null;
}

function capacityCost(r){
  if(r.ladder){
    const t = ladderTier(r);
    return S.vols * t.fee * FX[r.cur];
  }
  if(r.rate === null) return null;
  let perUnit = r.rate * hf(r.bill);
  if(r.capM != null) perUnit = Math.min(perUnit, r.capM);
  return S.gib * uf(r.unit) * perUnit * FX[r.cur];
}
function iopsCost(r){
  if(!r.iops) return 0;
  const over = Math.max(0, Math.min(S.iops, r.max.iops == null ? S.iops : r.max.iops) - r.iops.free);
  return S.vols * tierCost(over, r.iops.tiers) * hf(r.iops.per) * FX[r.cur];
}
function tputCost(r){
  if(!r.tput) return 0;
  const over = Math.max(0, Math.min(S.mbs, r.max.mbs == null ? S.mbs : r.max.mbs) - r.tput.free);
  return S.vols * over * r.tput.rate * hf(r.tput.per) * FX[r.cur];
}
function classCost(r){
  const c = perfClass(r);
  return c ? S.vols * c.fee * S.hours * FX[r.cur] : 0;
}
function snapCost(r){
  if(!r.snap) return r.snapNote && /not published/i.test(r.snapNote) ? null : 0;
  let perUnit = r.snap.rate * hf(r.snap.bill);
  if(r.snap.capM != null) perUnit = Math.min(perUnit, r.snap.capM);
  return S.snap * uf(r.snap.unit) * perUnit * FX[r.snap.cur];
}
function shortfall(r){
  const out = [];
  if(r.max.iops != null && S.iops > r.max.iops) out.push("caps at " + r.max.iops.toLocaleString("en-GB") + " IOPS");
  if(r.max.mbs  != null && S.mbs  > r.max.mbs)  out.push("caps at " + r.max.mbs + " MB/s");
  if(r.max.size != null && perVolume() > r.max.size) out.push("largest volume is " + r.max.size.toLocaleString("en-GB") + " GiB");
  return out;
}
function scenario(r){
  const parts = [capacityCost(r), iopsCost(r), tputCost(r), classCost(r), snapCost(r)];
  const partial = parts.some(p => p === null);
  const total = parts.reduce((a, p) => a + (p || 0), 0);
  return { total, partial, hasPrice: r.rate !== null || !!r.ladder, short: shortfall(r) };
}
const capUnit = r => { const c = capacityCost(r); return c === null ? null : c / S.gib; };
const effUnit = r => { const sc = scenario(r); return sc.hasPrice ? sc.total / S.gib : null; };

/* ---------------- formatting ---------------- */

function publishedRate(r){
  if(r.ladder){
    const t = ladderTier(r);
    return sym(r.cur) + t.fee.toFixed(2) + " per " + num(t.size) + " GiB disk-month";
  }
  if(r.rate === null) return '<span class="np">not published</span>';
  const u = r.unit === "GiB" ? "GiB" : "GB";
  const suffix = r.bill === "h" ? "·h" : r.bill === "d30" ? "/30 d" : "-month";
  return r.rate + " " + sym(r.cur) + "/" + u + suffix;
}
function perfCell(r){
  const p = r.perf || {};
  const fmt = (v, unit) => v === null || v === undefined ? "—"
    : typeof v === "string" ? v
    : v === 0 ? "none" : num(v) + " " + unit;
  const line = p.iops === "tier"  ? "fixed by the disk tier"
             : p.iops === "class" ? "bought per disk, by class"
             : fmt(p.iops, "IOPS") + " · " + fmt(p.mbs, "MB/s");
  const cap = "max " + (r.max.iops == null ? "—" : num(r.max.iops) + " IOPS")
            + " · " + (r.max.mbs == null ? "—" : num(r.max.mbs) + " MB/s");
  return '<span class="chip">' + esc(line) + "</span>"
       + '<span class="sub" style="text-align:left">' + esc(cap) + (p.iopsNote ? " — " + esc(p.iopsNote) : "") + "</span>";
}
function chargeCell(spec, r, unitLabel){
  if(!spec) return '<span class="free">included</span>';
  const rate = spec.tiers ? spec.tiers[0].r : spec.rate;
  const perMonth = rate * hf(spec.per) * FX[r.cur];
  return perMonth.toFixed(4) + " €"
       + '<span class="sub" style="text-align:left">per ' + unitLabel
       + (spec.free ? ", first " + num(spec.free) + " free" : ", none free") + "</span>";
}

/* ---------------- rendering ---------------- */
const SORT = { col:null, dir:1 };
function render(){
  const panel = PANELS[S.panel];
  let rows = panel.ids.map(id => ROWS.find(r => r.id === id)).filter(mediaShown);
  document.getElementById("panel-sub").textContent = panel.sub;
  document.getElementById("empty").hidden = rows.length > 0;
  document.getElementById("stamp-hours").textContent = S.hours + " h/month";
  const cap = S.metric === "cap";
  document.getElementById("rank-title").textContent =
    (cap ? "Capacity alone — € per provisioned GiB per month, "
         : "Effective price of the scenario — € per provisioned GiB per month, ")
    + num(Math.round(perVolume())) + " GiB × " + S.vols + " volumes"
    + (cap ? ", IOPS, throughput and snapshots excluded"
           : " at " + num(S.iops) + " IOPS and " + num(S.mbs) + " MB/s each");

  // ranking
  const metric = cap ? capUnit : effUnit;
  const priced = rows.filter(r => r.rate !== null || r.ladder)
                     .map(r => ({ vendor:r.vendor, cls:r.cls, value:metric(r),
                                  exo:r.brand, short:shortfall(r).length > 0 }))
                     .sort((a, b) => a.value - b.value);
  renderRanking("rank", priced);
  const shortCount = priced.filter(p => p.short).length;
  const hatched = shortCount
    ? "<b>Hatched bars</b> cannot deliver the requested performance or volume size — their cost is what the vendor charges for the most they do offer."
    : "Every row shown can deliver the requested configuration.";
  const metricNote = cap
    ? "Capacity alone. Provisioned IOPS, throughput and snapshots are excluded, so the rows that charge for performance separately look cheaper here than they bill."
    : "Capacity plus provisioned IOPS, throughput and snapshots, divided by the provisioned GiB.";
  const off = Object.keys(S.media).filter(k => !S.media[k]);
  const filterNote = off.length
    ? " Hiding " + off.map(k => MEDIA_LABEL[k]).join(", ") + "."
    : "";
  document.getElementById("legend").innerHTML = metricNote + " " + hatched + esc(filterNote);

  // sorting
  const sortVal = {
    vendor:  r => r.vendor + " " + r.cls,
    cls:     r => r.cls,
    capunit: r => capUnit(r),
    effunit: r => effUnit(r),
    iops:    r => r.iops ? (r.iops.tiers[0].r * hf(r.iops.per) * FX[r.cur]) : 0,
    tput:    r => r.tput ? (r.tput.rate * hf(r.tput.per) * FX[r.cur]) : 0,
    snap:    r => r.snap ? r.snap.rate * hf(r.snap.bill) * uf(r.snap.unit) * FX[r.snap.cur] : null,
    cost:    r => { const sc = scenario(r); return sc.hasPrice ? sc.total : null; }
  };
  rows = sortRows(rows, sortVal, SORT);
  applyAriaSort(SORT);

  // table
  document.getElementById("tbody").innerHTML = rows.map(r => {
    const sc = scenario(r);
    const cls = [r.brand ? "is-exo" : "", sc.short.length ? "is-short" : ""].filter(Boolean).join(" ");
    const tr = cls ? ' class="' + cls + '"' : "";
    const flag = r.unit === "GB?"
      ? ' <span class="flag" title="Unit not stated by the vendor — converted according to the selector at the top of the page">&#9651;</span>' : "";
    const pc = perfClass(r);
    const snapCell = r.snap
      ? (r.snap.rate * hf(r.snap.bill) * uf(r.snap.unit) * FX[r.snap.cur]).toFixed(4) + " €"
      : '<span class="np">' + esc(r.snapNote || "not offered") + "</span>";
    const io = r.io ? ' <span class="np" title="' + esc(r.io.note) + '">+io</span>' : "";
    const cost = !sc.hasPrice
      ? '<span class="np">n/a</span>'
      : (sc.partial ? '<span class="np">≥</span> ' : "") + "<b>" + fmtE(sc.total) + "</b>" + io;
    const shortMark = sc.short.length
      ? ' <span class="short" title="' + esc(sc.short.join("; ")) + '">&#9888;</span>' : "";
    return "<tr" + tr + ">"
      + '<td class="key">' + esc(r.vendor) + "</td>"
      + '<td class="cls">' + esc(r.cls) + shortMark + '<span class="sub">' + esc(r.region) + "</span>"
        + '<span class="sub">' + esc(r.medium) + "</span></td>"
      + "<td>" + publishedRate(r) + flag
        + (r.rateNote ? '<span class="sub">' + esc(r.rateNote) + "</span>" : "")
        + (r.ladderNote ? '<span class="sub">' + esc(r.ladderNote) + "</span>" : "")
        + (pc ? '<span class="sub">+ ' + esc(pc.name) + " — €" + pc.fee.toFixed(5) + "/disk·h</span>" : "")
        + (r.classesNote ? '<span class="sub">' + esc(r.classesNote) + "</span>" : "") + "</td>"
      + '<td class="num">' + fmtU(capUnit(r)) + "</td>"
      + '<td class="num big">' + fmtU(effUnit(r)) + "</td>"
      + "<td>" + perfCell(r) + "</td>"
      + '<td class="num">' + chargeCell(r.iops, r, "IOPS-month") + "</td>"
      + '<td class="num">' + chargeCell(r.tput, r, "MB/s-month") + "</td>"
      + '<td class="num">' + snapCell + (r.snap && r.snap.note ? '<span class="sub" style="text-align:left">' + esc(r.snap.note) + "</span>" : "") + "</td>"
      + "<td>" + esc(r.az) + (r.sla ? '<span class="sub">SLA ' + esc(r.sla) + "</span>" : "") + "</td>"
      + '<td class="num">' + cost + "</td>"
      + "</tr>";
  }).join("");
}

/* ---------------- interface ---------------- */
const DEFAULTS = { "in-gib":2048, "in-vols":4, "in-iops":3000, "in-mbs":125,
                   "in-snap":1024, "in-hours":730, "in-unit":"decimal" };
const RESET_STATE = { gib:2048, vols:4, iops:3000, mbs:125, snap:1024, hours:730,
                      unitMode:"decimal", media:{ hdd:true, ssd:true, premium:true, unk:true },
                      metric:"eff" };

stampFx();
wireTabs(render);
wireSort(SORT, render);
bindControls({
  "in-gib":   ["gib",   true], "in-vols": ["vols", true],
  "in-iops":  ["iops",  true], "in-mbs":  ["mbs",  true],
  "in-snap":  ["snap",  true], "in-hours":["hours", true],
  "in-unit":  ["unitMode", false]
}, render);

/* the medium filter never leaves the chart empty: the last one on cannot be switched off */
document.getElementById("media").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  const k = b.dataset.m, on = Object.keys(S.media).filter(x => S.media[x]);
  if(on.length === 1 && on[0] === k) return;
  S.media[k] = !S.media[k];
  b.setAttribute("aria-pressed", S.media[k]);
  render();
});
document.getElementById("metric").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  S.metric = b.dataset.x;
  [...e.currentTarget.children].forEach(x => x.setAttribute("aria-pressed", x === b));
  render();
});

wireReset(DEFAULTS, RESET_STATE, render, () => {
  [...document.getElementById("media").children].forEach(b => b.setAttribute("aria-pressed", "true"));
  [...document.getElementById("metric").children].forEach(b => b.setAttribute("aria-pressed", b.dataset.x === "eff"));
});
render();
