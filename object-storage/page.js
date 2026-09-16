/* ---------------- calculation engine ---------------- */
const S = { stored:100, egress:10, put:2, get:20, hours:730, unitMode:"decimal", panel:"actuel" };
const TIB = 1024; // GiB per TiB

function storageCost(r, storedGiB){
  if(!r.tiers) return null;
  const h = r.bill === "h" ? S.hours : 1;
  const units = storedGiB * uf(r.unit);
  if(r.base){
    const over = Math.max(0, units - r.base.inclUnits);
    return (r.base.fee + over * r.tiers[0].r * h) * FX[r.cur];
  }
  return tierCost(units, r.tiers.map(t => ({ upTo: t.upTo === Infinity ? Infinity : t.upTo * uf(r.unit), r: t.r })))
         * h * FX[r.cur];
}
function unitPrice(r){
  if(!r.tiers) return null;
  const h = r.bill === "h" ? S.hours : 1;
  return r.tiers[0].r * h * uf(r.unit) * FX[r.cur];
}
function freeAllowance(r, storedGiB){
  const f = r.egress.free;
  if(f === Infinity) return Infinity;
  if(f === "stored") return storedGiB;
  if(f === "3xstored") return 3 * storedGiB;
  if(f === "base") return r.base.inclUnits / uf(r.egress.unit);
  return f / uf(r.egress.unit);   // allowance expressed in the vendor's own unit
}
function egressCost(r, egressGiB, storedGiB){
  if(!r.egress.tiers) return null;
  const free = freeAllowance(r, storedGiB);
  const billable = Math.max(0, egressGiB - (free === Infinity ? egressGiB : free));
  if(billable === 0) return 0;
  const f = uf(r.egress.unit);
  return tierCost(billable, r.egress.tiers) * f * FX[r.egress.cur];
}
function reqCost(r){
  if(r.put === null || r.get === null) return null;
  return ((S.put * 1e6 / 1000) * r.put + (S.get * 1e6 / 1000) * r.get) * FX[r.cur];
}
function retrievalCost(r, egressGiB){
  if(!r.retrieval) return 0;
  return egressGiB * r.retrieval * uf(r.retrievalUnit || "GiB") * FX[r.retrievalCur || r.cur];
}
function scenario(r){
  const storedGiB = S.stored * TIB, egressGiB = S.egress * TIB;
  const parts = [storageCost(r, storedGiB), egressCost(r, egressGiB, storedGiB), reqCost(r), retrievalCost(r, egressGiB)];
  const partial = parts.some(p => p === null);
  const total = parts.reduce((a, p) => a + (p || 0), 0);
  return { total, partial, hasPrice: r.tiers !== null };
}

/* ---------------- formatting ---------------- */
const UNKNOWN_UNIT = u => u === "GB?";

function publishedRate(r){
  if(!r.tiers) return '<span class="np">not published</span>';
  const u = r.unit === "GiB" ? "GiB" : "GB";
  return r.base
    ? "€" + r.base.fee.toFixed(2) + "/mo + €" + r.tiers[0].r.toFixed(7) + "/" + u + "·h"
    : r.tiers[0].r + " " + sym(r.cur) + "/" + u + (r.bill === "h" ? "·h" : "-month");
}
function egressCell(r){
  if(!r.egress.tiers) return '<span class="np">not published</span>';
  const first = r.egress.tiers[0].r;
  if(first === 0) return '<span class="free">free</span>';
  return (first * uf(r.egress.unit) * FX[r.egress.cur]).toFixed(4) + " €";
}

/* ---------------- rendering ---------------- */
const SORT = { col:null, dir:1 };
function render(){
  const panel = PANELS[S.panel];
  let rows = panel.ids.map(id => ROWS.find(r => r.id === id));
  document.getElementById("panel-sub").textContent = panel.sub;
  document.getElementById("stamp-hours").textContent = S.hours + " h/month";

  // ranking
  renderRanking("rank", rows.filter(r => r.tiers)
    .map(r => ({ vendor:r.vendor, cls:r.cls, value:unitPrice(r), exo:r.brand }))
    .sort((a, b) => a.value - b.value));

  // sorting
  const sortVal = {
    vendor:  r => r.vendor + " " + r.cls,
    cls:     r => r.cls,
    unit:    r => unitPrice(r),
    egress:  r => r.egress.tiers ? r.egress.tiers[0].r * uf(r.egress.unit) * FX[r.egress.cur] : null,
    put:     r => r.put === null ? null : r.put * FX[r.cur],
    retr:    r => r.tiers === null ? null : (r.retrieval || 0) * uf(r.retrievalUnit || "GiB") * FX[r.retrievalCur || r.cur],
    mindays: r => r.minDays,
    cost:    r => { const sc = scenario(r); return sc.hasPrice ? sc.total : null; }
  };
  rows = sortRows(rows, sortVal, SORT);
  applyAriaSort(SORT);

  // table
  document.getElementById("tbody").innerHTML = rows.map(r => {
    const sc = scenario(r);
    const exo = r.brand ? ' class="is-exo"' : "";
    const flag = UNKNOWN_UNIT(r.unit)
      ? ' <span class="flag" title="Unit not stated by the vendor — converted according to the selector at the top of the page">&#9651;</span>' : "";
    const req = (r.put === null)
      ? '<span class="np">not published</span>'
      : (r.put === 0 && r.get === 0
          ? '<span class="free">free</span>'
          : (r.put * FX[r.cur]).toFixed(4) + " / " + (r.get * FX[r.cur]).toFixed(5) + " €");
    const retr = r.retrieval
      ? (r.retrieval * uf(r.retrievalUnit || "GiB") * FX[r.retrievalCur || r.cur]).toFixed(4) + " €"
      : (r.tiers ? '<span class="free">—</span>' : "—");
    const cost = !sc.hasPrice
      ? '<span class="np">n/a</span>'
      : (sc.partial ? '<span class="np">≥</span> ' : "") + "<b>" + fmtE(sc.total) + "</b>";
    return "<tr" + exo + ">"
      + '<td class="key">' + esc(r.vendor) + (r.planned ? '<span class="sub">' + esc(r.planned) + "</span>" : "") + "</td>"
      + '<td class="cls">' + esc(r.cls) + '<span class="sub">' + esc(r.region) + "</span></td>"
      + "<td>" + publishedRate(r) + flag + (r.tierNote ? '<span class="sub">' + esc(r.tierNote) + "</span>" : "") + "</td>"
      + '<td class="num big">' + fmtU(unitPrice(r)) + "</td>"
      + '<td class="num">' + egressCell(r) + (r.egress.note ? '<span class="sub" style="text-align:left">' + esc(r.egress.note) + "</span>" : "") + "</td>"
      + '<td class="num">' + req + (r.reqNote ? '<span class="sub" style="text-align:left">' + esc(r.reqNote) + "</span>" : "") + "</td>"
      + '<td class="num">' + retr + (r.retrievalNote ? '<span class="sub" style="text-align:left">' + esc(r.retrievalNote) + "</span>" : "") + "</td>"
      + '<td class="num">' + (r.minDays ? r.minDays + " d" : "—") + '<span class="sub" style="text-align:left">' + esc(r.minObj) + "</span></td>"
      + "<td>" + esc(r.az) + (r.sla ? '<span class="sub">SLA ' + esc(r.sla) + "</span>" : "") + "</td>"
      + '<td class="num">' + cost + "</td>"
      + "</tr>";
  }).join("");
}

/* ---------------- interface ---------------- */
const DEFAULTS = { "in-stored":100, "in-egress":10, "in-put":2, "in-get":20,
                   "in-hours":730, "in-unit":"decimal" };
const RESET_STATE = { stored:100, egress:10, put:2, get:20, hours:730, unitMode:"decimal" };

stampFx();
wireTabs(render);
wireSort(SORT, render);
bindControls({
  "in-stored": ["stored", true], "in-egress": ["egress", true],
  "in-put":    ["put",    true], "in-get":    ["get",    true],
  "in-hours":  ["hours",  true], "in-unit":   ["unitMode", false]
}, render);
wireReset(DEFAULTS, RESET_STATE, render);
render();
