/* Shared machinery for every benchmark page.
 *
 * The build concatenates this file, then <product>/data.js, then <product>/page.js, into one
 * <script>. Functions here read `S` (the page state), `GIB` and `FX`, all declared by those
 * later files — that is safe because nothing here runs at load time. The wiring helpers at the
 * bottom are called by each page.js once its own state and render() exist.
 */

/* ---------------- units and money ---------------- */

/* Billable units per physical unit. "GiB" binary confirmed, "GB" decimal confirmed,
   anything else the vendor never stated — those follow the page's selector. */
function uf(unit){
  if(unit === "GiB") return 1;
  if(unit === "GB")  return GIB;
  return S.unitMode === "decimal" ? GIB : 1;
}

/* Months' worth of a rate quoted per hour, per 30-day month, or per month. */
function hf(bill){
  if(bill === "h")   return S.hours;
  if(bill === "d30") return S.hours / 720;
  return 1;
}

/* Cost of `qty` against a cumulative tier ladder, charged tier by tier. */
function tierCost(qty, tiers){
  let cost = 0, prev = 0;
  for(const t of tiers){
    const upTo = Math.min(t.upTo, qty);
    if(upTo > prev){ cost += (upTo - prev) * t.r; prev = upTo; }
    if(prev >= qty) break;
  }
  return cost;
}

/* ---------------- formatting ---------------- */
const fmtU = v => v === null ? "—" : (v < 0.01 ? v.toFixed(5) : v.toFixed(4));
const fmtE = v => Math.round(v).toLocaleString("en-GB");
const num  = n => n.toLocaleString("en-GB");
const sym  = c => c === "EUR" ? "€" : c === "USD" ? "$" : "CHF";
const esc  = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

/* ---------------- ranking chart ---------------- */

/* items: [{ vendor, cls, value, exo, short }] — already filtered and sorted ascending.
   `short` hatches the bar: the row cannot deliver what the scenario asked for. */
function renderRanking(elId, items){
  const el = document.getElementById(elId);
  if(!items.length){ el.innerHTML = ""; return; }
  const max = Math.max(...items.map(i => i.value));
  el.innerHTML = items.map(i => {
    const exo = i.exo ? " is-exo" : "";
    const w = Math.max(1.5, i.value / max * 100);
    return '<div class="rk-name' + exo + '">' + esc(i.vendor) + " · " + esc(i.cls) + "</div>"
      + '<div class="rk-track"><div class="rk-bar' + exo + (i.short ? " is-short" : "")
      + '" style="width:' + w.toFixed(2) + '%"></div></div>'
      + '<div class="rk-val' + exo + '">' + fmtU(i.value) + " €</div>";
  }).join("");
}

/* ---------------- sorting ---------------- */

/* Rows a vendor does not price sort last in both directions; ties fall back to the name,
   so the order is stable whichever column is chosen. */
function sortRows(rows, sortVal, SORT){
  if(!SORT.col) return rows;
  const get = sortVal[SORT.col];
  if(!get) return rows;
  return rows.slice().sort((a, b) => {
    const x = get(a), y = get(b);
    if(typeof x === "string") return SORT.dir * x.localeCompare(y);
    const xa = x === null || x === undefined ? Infinity : x;
    const ya = y === null || y === undefined ? Infinity : y;
    if(xa === ya) return (a.vendor + a.cls).localeCompare(b.vendor + b.cls);
    return SORT.dir * (xa - ya);
  });
}

function applyAriaSort(SORT){
  [...document.querySelectorAll("th.sortable")].forEach(th => {
    th.setAttribute("aria-sort",
      th.dataset.sort === SORT.col ? (SORT.dir === 1 ? "ascending" : "descending") : "none");
  });
}

/* ---------------- wiring ---------------- */

function stampFx(){
  document.getElementById("stamp-fx").textContent = FX_NOTE.replace(/^ECB [\d.]+: /, "");
}

function wireTabs(render){
  const tabsEl = document.getElementById("tabs");
  tabsEl.innerHTML = Object.entries(PANELS).map(([k, p], i) =>
    '<button class="tab" role="tab" data-k="' + k + '" aria-selected="' + (i === 0) + '">'
    + esc(p.label) + "</button>").join("");
  tabsEl.addEventListener("click", e => {
    const b = e.target.closest(".tab"); if(!b) return;
    S.panel = b.dataset.k;
    [...tabsEl.children].forEach(t => t.setAttribute("aria-selected", t === b));
    render();
  });
}

/* Click a header to sort ascending, again to reverse, a third time to restore panel order. */
function wireSort(SORT, render){
  const head = document.getElementById("thead-row");
  [...document.querySelectorAll("th.sortable")].forEach(th => { th.tabIndex = 0; });
  head.addEventListener("keydown", e => {
    if(e.key !== "Enter" && e.key !== " ") return;
    const th = e.target.closest("th.sortable"); if(!th) return;
    e.preventDefault(); th.click();
  });
  head.addEventListener("click", e => {
    const th = e.target.closest("th.sortable"); if(!th) return;
    const col = th.dataset.sort;
    if(SORT.col === col && SORT.dir === 1)        SORT.dir = -1;
    else if(SORT.col === col && SORT.dir === -1){ SORT.col = null; SORT.dir = 1; }
    else                                        { SORT.col = col; SORT.dir = 1; }
    render();
  });
  document.getElementById("unsort").addEventListener("click", () => {
    SORT.col = null; SORT.dir = 1; render();
  });
}

/* bindings: { inputId: [stateKey, isNumber] } */
function bindControls(bindings, render){
  for(const [id, [key, isNum]] of Object.entries(bindings)){
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      S[key] = isNum ? (parseFloat(el.value) || 0) : el.value;
      render();
    });
  }
}

/* defaults: { inputId: value } for the form; state: the matching slice of S.
   `extra` restores anything that is not a plain input (segmented buttons, filters). */
function wireReset(defaults, state, render, extra){
  document.getElementById("reset").addEventListener("click", () => {
    for(const [id, v] of Object.entries(defaults)) document.getElementById(id).value = v;
    Object.assign(S, JSON.parse(JSON.stringify(state)));
    if(extra) extra();
    render();
  });
}
