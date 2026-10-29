/* ---------------- calculation engine ----------------
 *
 * One scenario: you need to hold `stored` GiB on a shared file system, read `read` GiB and
 * write `written` GiB a month out of it, and you want `iops` IOPS and `mbs` MiB/s.
 *
 * What each vendor then charges splits four ways:
 *   capacity    — on the bytes held, or on the size of the share, whichever the vendor bills
 *   performance — IOPS and throughput, where they are a separate line item with their own floor
 *   access      — per-GiB read and write charges (AWS calls this Elastic Throughput)
 *   snapshots   — where the vendor sells them
 *
 * A vendor that will not sell a share smaller than its minimum bills that minimum, which is
 * the single biggest thing the headline rate hides on this page.
 */
const S = { stored:2048, read:1024, written:256, iops:3000, mbs:100,
            hours:730, unitMode:"decimal", panel:"actuel", metric:"eff" };

/* uf() in shared/ui.js covers GiB, GB and an unstated GB. IONOS quotes a price per TB and
   never says which TB, so both the TB→GB step and the GiB→GB step follow the same selector. */
function ufc(unit){
  if(unit === "TB")  return GIB / 1000;
  if(unit === "TB?") return S.unitMode === "decimal" ? GIB / 1000 : 1 / 1024;
  return uf(unit);
}

/* The capacity a vendor actually bills: the bytes held, or the share size, never below the
   smallest share they sell. */
function billedGiB(r){
  const floor = r.minGiB || 0;
  return Math.max(S.stored, floor);
}
function overMinimum(r){
  return (r.minGiB || 0) > S.stored;
}

function capacityCost(r){
  if(r.rate === null) return null;
  const base = r.baseFee ? r.baseFee.fee * hf(r.baseFee.bill) * FX[r.baseFee.cur] : 0;
  return base + billedGiB(r) * ufc(r.unit) * r.rate * hf(r.bill) * FX[r.cur];
}
/* Performance charged separately is bought at the target, less whatever the stored volume
   already entitles you to, and never below the vendor's floor. `min` is the least they will
   sell; `freePerGiB` is a real allowance that grows with the data held — AWS includes
   50 MiB/s per TiB of Standard storage and bills Provisioned Throughput only above it. */
function perfCost(spec, target, r){
  if(!spec) return 0;
  const bought = Math.max(target - includedPerf(spec, r), spec.min || 0, 0);
  return bought * spec.rate * hf(spec.per) * FX[r.cur];
}
function includedPerf(spec, r){
  return spec && spec.freePerGiB ? spec.freePerGiB * billedGiB(r) : 0;
}
function accessCost(r){
  if(!r.access) return 0;
  const f = ufc(r.access.unit);
  return (S.read * f * r.access.read + S.written * f * r.access.write) * FX[r.access.cur || r.cur];
}
function snapCost(r){ return 0; }   // snapshots are shown per GiB, not costed into the scenario

function scenario(r){
  const parts = [capacityCost(r), perfCost(r.iops, S.iops, r), perfCost(r.tput, S.mbs, r), accessCost(r)];
  const unpriced = parts.some(p => p === null);
  const total = parts.reduce((a, p) => a + (p || 0), 0);
  return {
    total, hasPrice: r.rate !== null,
    /* a floor, not a price: either a component is unpublished, or a published per-operation
       charge cannot be monetised without assuming an I/O size */
    partial: unpriced || !!r.ops,
    short: shortfall(r)
  };
}
/* A published ceiling is a plain number, INF where the vendor publishes none, null where it
   publishes nothing at all, an object that grows with the capacity provisioned, or a ladder of
   C(upTo, …) bands where the vendor publishes a different rule in each capacity range. The
   growing ones are the common case here: OVHcloud and Scaleway sell performance with the
   gigabytes, and Google quotes every scalable tier per TiB. */
function ceilAt(spec, gib){
  if(spec === null || spec === undefined) return null;
  if(typeof spec === "number") return spec;
  if(Array.isArray(spec)) return ceilAt((spec.find(b => gib <= b.upTo) || spec[spec.length - 1]).v, gib);
  const over = Math.max(0, gib - (spec.from || 0));
  const grown = (spec.base || 0) + (spec.perGiB || 0) * over + (spec.perTiB || 0) * over / 1024;
  return spec.cap != null ? Math.min(grown, spec.cap) : grown;
}
const scales = spec => spec !== null && typeof spec === "object";

/* Capacity ceilings read better in TiB. A vendor quoting an undefined "GB" is converted like
   every other figure on the page, and its own wording is in the note beneath. */
function gibLabel(v){
  if(v === null || v === undefined) return "not published";
  if(v === INF) return "no published ceiling";
  return v < 1024 ? num(v) + " GiB" : num(Math.round(v / 102.4) / 10) + " TiB";
}

function shortfall(r){
  const out = [], gib = billedGiB(r);
  const at = spec => scales(spec) ? " at " + num(gib) + " GiB" : "";
  const iops = ceilAt(r.max.iops, gib), mbs = ceilAt(r.max.mbs, gib);
  if(iops != null && S.iops > iops) out.push("tops out at " + num(Math.round(iops)) + " IOPS" + at(r.max.iops));
  if(mbs  != null && S.mbs  > mbs)  out.push("tops out at " + num(Math.round(mbs))  + " MiB/s" + at(r.max.mbs));
  if(r.maxGiB != null && S.stored > r.maxGiB) out.push("largest share is " + gibLabel(r.maxGiB));
  return out;
}

/* Both chart metrics are per GiB *asked for*, not per GiB billed — otherwise a vendor's
   capacity floor would vanish into the denominator instead of showing up as a higher price. */
const capUnit = r => { const c = capacityCost(r); return c === null ? null : c / S.stored; };
const effUnit = r => { const sc = scenario(r); return sc.hasPrice ? sc.total / S.stored : null; };

/* ---------------- formatting ---------------- */
function publishedRate(r){
  if(r.rate === null) return '<span class="np">not published</span>';
  const u = r.unit === "GiB" ? "GiB" : r.unit.startsWith("TB") ? "TB" : "GB";
  const suffix = r.bill === "h" ? "·h" : r.bill === "d30" ? "/30 d" : "-month";
  const head = r.rate + " " + sym(r.cur) + "/" + u + suffix;
  return r.baseFee ? head + " + " + sym(r.baseFee.cur) + r.baseFee.fee.toFixed(2) + "/instance-month" : head;
}
function billedCell(r){
  if(r.rate === null) return "—";
  const on = r.billedOn === "stored" ? "bytes held" : "share size";
  const floor = r.minGiB ? num(r.minGiB) + " GiB minimum" : (r.minGiB === 0 ? "no minimum" : "not published");
  const warn = overMinimum(r) ? ' <span class="short" title="The scenario asks for less than this vendor will sell, so the minimum is what gets billed">&#9650;</span>' : "";
  return '<span class="chip">' + esc(on) + "</span>" + warn
       + '<span class="sub" style="text-align:left">' + esc(floor)
       + (overMinimum(r) ? " — billing " + num(billedGiB(r)) + " GiB" : "") + "</span>";
}
function perfChargeCell(spec, r, unitLabel){
  if(!spec) return '<span class="free">included</span>';
  const perMonth = spec.rate * hf(spec.per) * FX[r.cur];
  const incl = includedPerf(spec, r);
  const qualifier = incl ? num(Math.round(incl)) + " included with the data held"
                   : spec.min ? num(spec.min) + " minimum"
                   : "no minimum";
  return perMonth.toFixed(4) + " €"
       + '<span class="sub" style="text-align:left">per ' + unitLabel + ", " + esc(qualifier) + "</span>";
}
function accessCell(r){
  if(!r.access) return '<span class="free">included</span>';
  const f = ufc(r.access.unit), fx = FX[r.access.cur || r.cur];
  return (r.access.read * f * fx).toFixed(4) + " / " + (r.access.write * f * fx).toFixed(4) + " €";
}
function perfCell(r){
  const p = r.perf || {};
  const word = { elastic:"scales automatically", provisioned:"bought up front",
                 fixed:"fixed by the tier", size:"follows the share size", burst:"bursting only" };
  const one = v => v === null || v === undefined ? "—"
    : typeof v === "string" ? (word[v] || v)
    : v === 0 ? "none included" : num(v);
  const line = (typeof p.iops === "string" && p.iops === p.mbs)
    ? one(p.iops)
    : one(p.iops) + (typeof p.iops === "number" ? " IOPS" : "") + " · "
      + one(p.mbs) + (typeof p.mbs === "number" ? " MiB/s" : "");
  return '<span class="chip">' + esc(line) + "</span>"
       + (p.note ? '<span class="sub" style="text-align:left">' + esc(p.note) + "</span>" : "");
}
/* What the vendor will not go past: the capacity range it sells, and the performance ceilings
   for one share. Ceilings that grow with capacity are shown at the size being billed, so the
   figure moves with the control rather than quoting a maximum reached only at 100 TiB. */
function limitsCell(r){
  const gib = billedGiB(r);
  const range = (r.minGiB == null && r.maxGiB == null)
    ? '<span class="np">not published</span>'
    : '<span class="chip">' + esc((r.minGiB === 0 ? "no minimum" : gibLabel(r.minGiB))
                                  + " – " + gibLabel(r.maxGiB)) + "</span>";
  const iops = ceilAt(r.max.iops, gib), mbs = ceilAt(r.max.mbs, gib);
  const one = (v, label) => v === null ? '<span class="np">' + label + " not published</span>"
            : v === INF ? "no " + label + " ceiling"
            : num(Math.round(v)) + " " + label;
  const grows = scales(r.max.iops) || scales(r.max.mbs);
  const perfLine = (iops === null && mbs === null) ? ""
    : '<span class="sub" style="text-align:left">' + one(iops, "IOPS") + " · " + one(mbs, "MiB/s")
      + (grows ? " at " + num(gib) + " GiB" : "") + "</span>";
  return range + perfLine
       + (r.maxNote ? '<span class="sub" style="text-align:left">' + esc(r.maxNote) + "</span>" : "");
}

/* ---------------- rendering ---------------- */
const SORT = { col:null, dir:1 };
function render(){
  const panel = PANELS[S.panel];
  let rows = panel.ids.map(id => ROWS.find(r => r.id === id));
  document.getElementById("panel-sub").textContent = panel.sub;
  document.getElementById("stamp-hours").textContent = S.hours + " h/month";

  const cap = S.metric === "cap";
  document.getElementById("rank-title").textContent =
    (cap ? "Capacity alone — € per stored GiB per month, "
         : "Effective price of the scenario — € per stored GiB per month, ")
    + num(S.stored) + " GiB held"
    + (cap ? ", performance and access charges excluded"
           : " at " + num(S.iops) + " IOPS and " + num(S.mbs) + " MiB/s, "
             + num(S.read) + " GiB read and " + num(S.written) + " GiB written");

  /* A bar is hatched when its number is not like-for-like with the rest: the vendor cannot
     deliver the scenario, will not sell a share this small, or has a published charge that
     cannot be monetised — in which case the bar is a floor and an unhatched one would be
     quietly treating the missing component as zero. */
  const notLikeForLike = r => shortfall(r).length > 0 || overMinimum(r) || scenario(r).partial;

  // ranking
  const metric = cap ? capUnit : effUnit;
  renderRanking("rank", rows.filter(r => r.rate !== null)
    .map(r => ({ vendor:r.vendor, cls:r.cls, value:metric(r), exo:r.brand, short:notLikeForLike(r) }))
    .sort((a, b) => a.value - b.value));

  const flagged = rows.filter(r => r.rate !== null && notLikeForLike(r)).length;
  const metricNote = cap
    ? "Capacity alone. IOPS, throughput and per-GiB access charges are excluded, so the vendors that bill performance separately look cheaper here than they invoice."
    : "Capacity plus provisioned IOPS and throughput plus per-GiB read and write charges, divided by the GiB you asked to hold.";
  document.getElementById("legend").innerHTML = metricNote + (flagged
    ? " <b>Hatched bars</b> are not like-for-like: the vendor either cannot deliver the requested performance, will not sell a share this small, or charges per operation on top of what is shown. Those bars are floors."
    : " Every row shown can deliver the requested configuration.");

  // sorting
  const sortVal = {
    vendor:  r => r.vendor + " " + r.cls,
    cls:     r => r.cls,
    capunit: r => capUnit(r),
    effunit: r => effUnit(r),
    billed:  r => r.rate === null ? null : billedGiB(r),
    limits:  r => ceilAt(r.max.iops, billedGiB(r)),
    iops:    r => r.iops ? r.iops.rate * hf(r.iops.per) * FX[r.cur] : 0,
    tput:    r => r.tput ? r.tput.rate * hf(r.tput.per) * FX[r.cur] : 0,
    access:  r => r.access ? (r.access.read + r.access.write) * ufc(r.access.unit) * FX[r.access.cur || r.cur] : 0,
    snap:    r => r.snap ? r.snap.rate * hf(r.snap.bill) * ufc(r.snap.unit) * FX[r.snap.cur] : null,
    cost:    r => { const sc = scenario(r); return sc.hasPrice ? sc.total : null; }
  };
  rows = sortRows(rows, sortVal, SORT);
  applyAriaSort(SORT);

  // table
  document.getElementById("tbody").innerHTML = rows.map(r => {
    const sc = scenario(r);
    const trCls = [r.brand ? "is-exo" : "", (sc.short.length || overMinimum(r)) ? "is-short" : ""]
      .filter(Boolean).join(" ");
    const tr = trCls ? ' class="' + trCls + '"' : "";
    const flag = (r.unit === "GB?" || r.unit === "TB?")
      ? ' <span class="flag" title="Unit not stated by the vendor — converted according to the selector at the top of the page">&#9651;</span>' : "";
    const snapCell = r.snap
      ? (r.snap.rate * hf(r.snap.bill) * ufc(r.snap.unit) * FX[r.snap.cur]).toFixed(4) + " €"
      : '<span class="np">' + esc(r.snapNote || "not offered") + "</span>";
    const ops = r.ops ? ' <span class="np" title="' + esc(r.ops.note) + '">+ops</span>' : "";
    const cost = !sc.hasPrice
      ? '<span class="np">n/a</span>'
      : (sc.partial ? '<span class="np">≥</span> ' : "") + "<b>" + fmtE(sc.total) + "</b>" + ops;
    const shortMark = sc.short.length
      ? ' <span class="short" title="' + esc(sc.short.join("; ")) + '">&#9888;</span>' : "";
    return "<tr" + tr + ">"
      + '<td class="key">' + esc(r.vendor) + "</td>"
      + '<td class="cls">' + esc(r.cls) + shortMark + '<span class="sub">' + esc(r.region) + "</span>"
        + '<span class="sub">' + esc(r.proto) + "</span></td>"
      + "<td>" + publishedRate(r) + flag
        + (r.rateNote ? '<span class="sub">' + esc(r.rateNote) + "</span>" : "") + "</td>"
      + "<td>" + billedCell(r) + "</td>"
      + '<td class="num">' + fmtU(capUnit(r)) + "</td>"
      + '<td class="num big">' + fmtU(effUnit(r)) + "</td>"
      + "<td>" + perfCell(r) + "</td>"
      + "<td>" + limitsCell(r) + "</td>"
      + '<td class="num">' + perfChargeCell(r.iops, r, "IOPS-month") + "</td>"
      + '<td class="num">' + perfChargeCell(r.tput, r, "MiB/s-month") + "</td>"
      + '<td class="num">' + accessCell(r)
        + (r.access && r.access.note ? '<span class="sub" style="text-align:left">' + esc(r.access.note) + "</span>" : "") + "</td>"
      + '<td class="num">' + snapCell
        + (r.snap && r.snap.note ? '<span class="sub" style="text-align:left">' + esc(r.snap.note) + "</span>" : "") + "</td>"
      + "<td>" + esc(r.az) + (r.sla ? '<span class="sub">SLA ' + esc(r.sla) + "</span>" : "") + "</td>"
      + '<td class="num">' + cost + "</td>"
      + "</tr>";
  }).join("");
}

/* ---------------- interface ---------------- */
const DEFAULTS = { "in-stored":2048, "in-read":1024, "in-written":256, "in-iops":3000,
                   "in-mbs":100, "in-hours":730, "in-unit":"decimal" };
const RESET_STATE = { stored:2048, read:1024, written:256, iops:3000, mbs:100,
                      hours:730, unitMode:"decimal", metric:"eff" };

stampFx();
wireTabs(render);
wireSort(SORT, render);
bindControls({
  "in-stored":  ["stored",  true], "in-read":    ["read",    true],
  "in-written": ["written", true], "in-iops":    ["iops",    true],
  "in-mbs":     ["mbs",     true], "in-hours":   ["hours",   true],
  "in-unit":    ["unitMode", false]
}, render);

document.getElementById("metric").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  S.metric = b.dataset.x;
  [...e.currentTarget.children].forEach(x => x.setAttribute("aria-pressed", x === b));
  render();
});

wireReset(DEFAULTS, RESET_STATE, render, () => {
  [...document.getElementById("metric").children]
    .forEach(b => b.setAttribute("aria-pressed", b.dataset.x === "eff"));
});
render();
