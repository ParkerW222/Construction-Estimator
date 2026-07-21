// ── STATE ──────────────────────────────────────────────────────────
let project = { id: 'proj_' + Date.now(), name: 'New Project', items: [], nextId: 1 };
let activeDiv = '03';
function defaultEstMu() { return { oh: 10, profit: 8, cont: 5, bond: 0, ret: 0 }; }
let estMu = defaultEstMu();
let currentUser = null;
let authMode = 'login';
let authRole = 'builder';

// ── UTILITIES ──────────────────────────────────────────────────────
function gid(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + Math.round(n).toLocaleString();
}
function fmtN(n) { return Math.round(n).toLocaleString(); }

// ── HELP MODAL ─────────────────────────────────────────────────────
function showHelp() { gid('help-modal').style.display = 'flex'; }
function closeHelp() { gid('help-modal').style.display = 'none'; }

// ── SPA NAVIGATION ─────────────────────────────────────────────────
function showPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));
  gid('pg-' + p).classList.add('active');
  const link = gid('nl-' + p);
  if (link) link.classList.add('active');
  if (p === 'builder') renderBudgetBuilder();
  if (p === 'blueprint') {
    const bpn = gid('bp-proj-name');
    if (bpn) bpn.value = project.name || 'New Project';
  }
}

// ── ESTIMATOR ──────────────────────────────────────────────────────
function divItems(d) { return project.items.filter(i => i.div === d); }
function divTotal(d) {
  return divItems(d).reduce((sum, i) => sum + i.qty * i.unitCost, 0);
}
// Object key order isn't reliable here — JS always iterates numeric-looking keys ("10", "44")
// in ascending numeric order ahead of any key with a leading zero ("01"-"09"), regardless of
// insertion order, so this needs an explicit sort to display in true division-number order.
function sortedCsiCodes() {
  return Object.keys(CSI_ITEMS).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

// A project can add its own divisions on top of the standard CSI list (e.g. for a scope of
// work the CSI MasterFormat doesn't cover cleanly) — stored per-project as { code: name }.
function allDivCodes() {
  return [...sortedCsiCodes(), ...Object.keys(project.customDivisions || {})];
}
function isCustomDivision(d) {
  return !!(project.customDivisions && project.customDivisions[d] !== undefined);
}

function grandTotal() {
  return allDivCodes().reduce((sum, d) => sum + divTotal(d), 0);
}

// A project can rename any division's label — shown in place of the CSI default everywhere
// that division appears (Estimator sidebar, Payments & Scheduling phases, PDFs, receipts).
function divName(d) {
  if (project.divisionNames && project.divisionNames[d]) return project.divisionNames[d];
  if (CSI_ITEMS[d]) return CSI_ITEMS[d].name;
  if (project.customDivisions && project.customDivisions[d]) return project.customDivisions[d];
  return d;
}

function renameDivision(d, event) {
  if (event) event.stopPropagation();
  const current = divName(d);
  const next = prompt('Rename this division — shown in the Estimator and Payments & Scheduling:', current);
  if (next === null) return;
  const trimmed = next.trim();
  if (!project.divisionNames) project.divisionNames = {};
  if (trimmed) project.divisionNames[d] = trimmed;
  else delete project.divisionNames[d];
  saveProject();
  renderAll();
  bldRenderTable();
}

function addCustomDivision() {
  const name = prompt('Name for the new division:', '');
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (!project.customDivisions) project.customDivisions = {};
  if (!project.nextCustomDivId) project.nextCustomDivId = 1;
  const code = 'C' + project.nextCustomDivId++;
  project.customDivisions[code] = trimmed;
  saveProject();
  activeDiv = code;
  renderAll();
}

function deleteCustomDivision(d, event) {
  if (event) event.stopPropagation();
  if (!isCustomDivision(d)) return;
  const itemCount = divItems(d).length;
  const msg = itemCount > 0
    ? `Delete "${divName(d)}"? This will also delete its ${itemCount} item${itemCount === 1 ? '' : 's'}.`
    : `Delete "${divName(d)}"?`;
  if (!confirm(msg)) return;
  project.items = project.items.filter(i => i.div !== d);
  delete project.customDivisions[d];
  if (project.divisionNames) delete project.divisionNames[d];
  const bs = getBudgetSheet();
  if (bs.phases && bs.phases[d]) delete bs.phases[d];
  if (bs.phaseOrder) bs.phaseOrder = bs.phaseOrder.filter(x => x !== d);
  if (activeDiv === d) activeDiv = 'ALL';
  saveProject();
  renderAll();
  bldRenderTable();
}

const COMMON_UNITS = ['EA', 'SF', 'LF'];
function unitCell(i) {
  if (!i.custom) return i.unit;
  const opts = COMMON_UNITS.includes(i.unit) ? COMMON_UNITS : [i.unit, ...COMMON_UNITS];
  return `<select class="unit-sel" onchange="updateField(${i.id},'unit',this.value)">
    ${opts.map(u => `<option value="${u}"${u === i.unit ? ' selected' : ''}>${u}</option>`).join('')}
  </select>`;
}

function renderAll() { renderDivNav(); renderTable(); renderSum(); }

function renderDivNav() {
  const allTotal = grandTotal();
  const seeAllRow = `<div class="dni${activeDiv === 'ALL' ? ' active' : ''}" onclick="setDiv('ALL')">
    <span class="dni-num">&#9776;</span>
    <span class="dni-name">See All</span>
    ${allTotal > 0 ? `<span class="dni-sub">${fmt(allTotal)}</span>` : ''}
  </div><div class="dni-sep"></div>`;
  const divRow = d => {
    const sub = divTotal(d);
    return `<div class="dni${d === activeDiv ? ' active' : ''}" onclick="setDiv('${d}')"
      ondragover="estDivDragOver(event)" ondragleave="estDivDragLeave(event)" ondrop="estDivDrop(event,'${d}')">
      <span class="dni-num">${d}</span>
      <span class="dni-name">${esc(divName(d))}</span>
      <button class="dni-edit" title="Rename this division" onclick="renameDivision('${d}',event)">&#9998;</button>
      ${isCustomDivision(d) ? `<button class="dni-edit" title="Delete this division" onclick="deleteCustomDivision('${d}',event)">&#128465;</button>` : ''}
      ${sub > 0 ? `<span class="dni-sub">${fmt(sub)}</span>` : ''}
    </div>`;
  };
  const customRows = Object.keys(project.customDivisions || {}).map(divRow).join('');
  const addRow = `<div class="dni-sep"></div><div class="dni dni-add" onclick="addCustomDivision()">
    <span class="dni-num">+</span>
    <span class="dni-name">Add Division</span>
  </div>`;
  gid('div-nav').innerHTML = seeAllRow + sortedCsiCodes().map(divRow).join('') + customRows + addRow;
}

function renderTable() {
  const addCustomBtn = gid('add-custom-btn');
  if (addCustomBtn) {
    addCustomBtn.disabled = activeDiv === 'ALL';
    addCustomBtn.title = activeDiv === 'ALL' ? 'Select a specific division to add a custom item' : '';
  }

  if (activeDiv === 'ALL') {
    gid('center-title').textContent = 'All Divisions — Every Item';
    renderAllItemsTable();
    return;
  }

  gid('items-thead').innerHTML = `<tr>
    <th>Description</th>
    <th style="width:50px">Unit</th>
    <th style="min-width:100px;text-align:right">Qty</th>
    <th style="min-width:108px;text-align:right">Unit Cost</th>
    <th style="min-width:108px;text-align:right">Total</th>
    <th style="width:34px"></th>
  </tr>`;
  gid('center-title').textContent = `Division ${activeDiv} — ${divName(activeDiv)}`;
  const items = divItems(activeDiv);

  if (!items.length) {
    gid('items-tbody').innerHTML = `<tr><td colspan="6" class="empty-msg">No items yet — click + Custom to add one.</td></tr>`;
    return;
  }

  gid('items-tbody').innerHTML = items.map(i => {
    const ext = i.qty * i.unitCost;
    const descCell = i.custom
      ? `<input type="text" value="${i.desc.replace(/"/g, '&quot;')}" style="width:100%;border:1px solid var(--border);border-radius:4px;padding:.18rem .35rem;font-size:.8rem" onchange="updateField(${i.id},'desc',this.value)">`
      : i.desc;
    return `<tr draggable="true" data-id="${i.id}" title="Drag to reorder, or drop onto another division to move it there"
      ondragstart="estItemDragStart(event,${i.id})" ondragover="estItemDragOver(event)"
      ondragleave="estItemDragLeave(event)" ondrop="estItemDrop(event,${i.id})" ondragend="estItemDragEnd(event)">
      <td style="min-width:170px;font-weight:500">${descCell}</td>
      <td>${unitCell(i)}</td>
      <td style="min-width:100px;text-align:right"><input class="inp-qty" type="number" value="${i.qty}" min="0" step="0.01" oninput="updQty(${i.id},this.value)"></td>
      <td style="min-width:108px;text-align:right"><input class="inp-cost" type="number" value="${i.unitCost}" min="0" step="0.01" oninput="updCost(${i.id},this.value)"></td>
      <td style="min-width:108px;text-align:right" class="ext-cost" id="ext-${i.id}">${fmt(ext)}</td>
      <td style="width:34px;text-align:center"><button class="btn btn-red" style="padding:.2rem .4rem;font-size:.72rem" onclick="delItem(${i.id})">✕</button></td>
    </tr>`;
  }).join('');
}

function renderAllItemsTable() {
  gid('items-thead').innerHTML = `<tr>
    <th style="width:60px">Div</th>
    <th>Description</th>
    <th style="width:50px">Unit</th>
    <th style="min-width:100px;text-align:right">Qty</th>
    <th style="min-width:108px;text-align:right">Unit Cost</th>
    <th style="min-width:108px;text-align:right">Total</th>
    <th style="width:34px"></th>
  </tr>`;
  const items = [...project.items].sort((a, b) => a.div.localeCompare(b.div));

  if (!items.length) {
    gid('items-tbody').innerHTML = `<tr><td colspan="7" class="empty-msg">No items yet — select a division and click + Custom to add one.</td></tr>`;
    return;
  }

  gid('items-tbody').innerHTML = items.map(i => {
    const ext = i.qty * i.unitCost;
    const descCell = i.custom
      ? `<input type="text" value="${i.desc.replace(/"/g, '&quot;')}" style="width:100%;border:1px solid var(--border);border-radius:4px;padding:.18rem .35rem;font-size:.8rem" onchange="updateField(${i.id},'desc',this.value)">`
      : i.desc;
    return `<tr draggable="true" data-id="${i.id}" title="Drag to reorder, or drop onto a row from another division to move it there"
      ondragstart="estItemDragStart(event,${i.id})" ondragover="estItemDragOver(event)"
      ondragleave="estItemDragLeave(event)" ondrop="estItemDrop(event,${i.id})" ondragend="estItemDragEnd(event)">
      <td style="width:60px;font-size:.72rem;color:var(--muted);cursor:pointer" title="${esc(divName(i.div))} — click to open this division" onclick="setDiv('${i.div}')">${i.div}</td>
      <td style="min-width:170px;font-weight:500">${descCell}</td>
      <td>${unitCell(i)}</td>
      <td style="min-width:100px;text-align:right"><input class="inp-qty" type="number" value="${i.qty}" min="0" step="0.01" oninput="updQty(${i.id},this.value)"></td>
      <td style="min-width:108px;text-align:right"><input class="inp-cost" type="number" value="${i.unitCost}" min="0" step="0.01" oninput="updCost(${i.id},this.value)"></td>
      <td style="min-width:108px;text-align:right" class="ext-cost" id="ext-${i.id}">${fmt(ext)}</td>
      <td style="width:34px;text-align:center"><button class="btn btn-red" style="padding:.2rem .4rem;font-size:.72rem" onclick="delItem(${i.id})">✕</button></td>
    </tr>`;
  }).join('');
}

// ── ESTIMATOR ITEM DRAG-AND-DROP ────────────────────────────────────
// Drop an item onto another item's row to reorder it there (same division) or move it to
// that item's division (different division). Drop onto a division in the left sidebar to
// move it there directly without needing to open the "See All" view.
let estDragItemId = null;

function estItemDragStart(e, id) {
  estDragItemId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}
function estItemDragOver(e) {
  if (estDragItemId == null) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function estItemDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function estItemDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (estDragItemId == null || estDragItemId === targetId) return;
  const items = project.items;
  const fromIdx = items.findIndex(i => i.id === estDragItemId);
  const toIdx = items.findIndex(i => i.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  const targetDiv = items[toIdx].div;
  const [moved] = items.splice(fromIdx, 1);
  moved.div = targetDiv;
  items.splice(toIdx, 0, moved);
  saveProject();
  renderAll();
}
function estItemDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.items tbody tr.drag-over').forEach(el => el.classList.remove('drag-over'));
  estDragItemId = null;
}

function estDivDragOver(e) {
  if (estDragItemId == null) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function estDivDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function estDivDrop(e, targetDiv) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (estDragItemId == null) return;
  const item = project.items.find(i => i.id === estDragItemId);
  if (item && item.div !== targetDiv) {
    item.div = targetDiv;
    saveProject();
    renderAll();
  }
  estDragItemId = null;
}

// Soft costs: real fixed dollar costs that don't scale with the size of the job (unlike
// Overhead/Profit/Contingency/etc., which are all percentage-based rates) — moved here from
// Payments & Scheduling so every cost that feeds into the bid price lives in one place.
const EST_SOFT_COST_ITEMS = [
  { id: 'permit',     label: 'Permit Fees' },
  { id: 'loan',       label: 'Bank Loan Interest' },
  { id: 'insurance',  label: 'Insurance' },
  { id: 'architect',  label: 'Architect / Designer' },
  { id: 'geotech',    label: 'Geotech / Survey' },
  { id: 'struct',     label: 'Structural Engineer' },
  { id: 'consultant', label: 'Project Consultant' },
];

function getSoftCosts() {
  if (!project.softCosts) project.softCosts = {};
  const sc = project.softCosts;
  // One-time migration: Permit Fees moved from a %-of-bid markup fee to a flat dollar Soft
  // Cost — estimate the old dollar amount from the last-known % and current costs so an
  // already-set fee doesn't just silently disappear.
  if (sc.permit === undefined && project.estMu && parseFloat(project.estMu.permit) > 0) {
    const d = grandTotal();
    const oh = d * (parseFloat(project.estMu.oh) || 0) / 100;
    const pr = (d + oh) * (parseFloat(project.estMu.profit) || 0) / 100;
    const co = (d + oh + pr) * (parseFloat(project.estMu.cont) || 0) / 100;
    const tax = d * 0.55 * (parseFloat(project.estMu.matTax) || 0) / 100;
    const permitAmt = (d + oh + pr + co + tax) * parseFloat(project.estMu.permit) / 100;
    sc.permit = String(Math.round(permitAmt));
  }
  return sc;
}

function estSoftCostsTotal() {
  const sc = getSoftCosts();
  return EST_SOFT_COST_ITEMS.reduce((s, item) => s + (parseFloat(sc[item.id]) || 0), 0);
}

// Shared by the Estimator's own summary panel, the exported PDF, and Payments & Scheduling's
// "Estimator Bid Price" reference line.
function estimatorMarkupBreakdown() {
  const rawDirect = grandTotal();
  const coAmt  = rawDirect * estMu.cont / 100;
  const direct = rawDirect + coAmt; // Total Direct Cost — Contingency is the last item folded into it
  const ohAmt  = direct * estMu.oh / 100;
  const prAmt  = (direct + ohAmt) * estMu.profit / 100;
  const softCostsAmt = estSoftCostsTotal();
  const bid = direct + ohAmt + prAmt + softCostsAmt;
  return { rawDirect, coAmt, direct, ohAmt, prAmt, softCostsAmt, bid };
}

function renderSum() {
  const { coAmt, direct, ohAmt, prAmt, softCostsAmt, bid } = estimatorMarkupBreakdown();
  const sc = getSoftCosts();

  let html = `<div class="sum-head">Division Subtotals</div>`;
  allDivCodes().forEach(d => {
    const sub = divTotal(d);
    if (sub > 0) html += `<div class="sum-row"><span class="sum-row-label">${d} ${esc(divName(d))}</span><span class="sum-row-val">${fmt(sub)}</span></div>`;
  });

  html += `
    <hr class="sum-sep">
    <div class="sum-mu-row">
      <span class="sum-mu-label">Contingency %</span>
      <input class="sum-pct" type="number" value="${estMu.cont}" min="0" step="0.5" oninput="updMu('cont',this.value)">
      <span class="sum-pct-sym">%</span><span class="sum-pct-amt" id="sum-co-amt">${fmt(coAmt)}</span>
    </div>
    <div class="sum-total"><span>Total Direct Cost</span><span id="sum-direct-total">${fmt(direct)}</span></div>
    <hr class="sum-sep">
    <div class="sum-head" style="margin-top:.4rem">Markup &amp; Fees <span class="sum-head-unit">%</span></div>
    <div class="sum-mu-row">
      <span class="sum-mu-label">Overhead %</span>
      <input class="sum-pct" type="number" value="${estMu.oh}" min="0" step="0.5" oninput="updMu('oh',this.value)">
      <span class="sum-pct-sym">%</span><span class="sum-pct-amt" id="sum-oh-amt">${fmt(ohAmt)}</span>
    </div>
    <div class="sum-mu-row">
      <span class="sum-mu-label">Profit %</span>
      <input class="sum-pct" type="number" value="${estMu.profit}" min="0" step="0.5" oninput="updMu('profit',this.value)">
      <span class="sum-pct-sym">%</span><span class="sum-pct-amt" id="sum-pr-amt">${fmt(prAmt)}</span>
    </div>
    <div class="sum-total"><span>Total Markup &amp; Fees</span><span id="sum-markup-total">${fmt(ohAmt + prAmt)}</span></div>
    <hr class="sum-sep" style="margin:.55rem 0">
    <div class="sum-head" style="margin-top:.2rem">Soft Costs <span class="sum-head-unit">$</span></div>
    ${EST_SOFT_COST_ITEMS.map(item => `
    <div class="sum-mu-row">
      <span class="sum-mu-label">${item.label}</span>
      <input class="sum-cost-inp" type="number" value="${sc[item.id] || ''}" min="0" step="100" placeholder="—" oninput="updSoftCost('${item.id}',this.value)">
    </div>`).join('')}
    <div class="sum-total"><span>Total Soft Costs</span><span id="sum-softcosts-total">${fmt(softCostsAmt)}</span></div>
    <div class="bid-box">
      <div class="bid-box-lbl">Bid Price</div>
      <div class="bid-box-val" id="sum-bid">${fmt(bid)}</div>
    </div>`;

  gid('est-sum').innerHTML = html;
  gid('top-total').textContent = fmt(bid);
}

function updMu(field, val) {
  estMu[field] = +val || 0;
  const rawDirect = grandTotal();
  const co     = rawDirect * estMu.cont / 100;
  const direct = rawDirect + co;
  const oh     = direct * estMu.oh / 100;
  const pr     = (direct + oh) * estMu.profit / 100;
  const bid    = direct + oh + pr + estSoftCostsTotal();
  if (gid('sum-co-amt'))       gid('sum-co-amt').textContent       = fmt(co);
  if (gid('sum-direct-total')) gid('sum-direct-total').textContent = fmt(direct);
  if (gid('sum-oh-amt'))       gid('sum-oh-amt').textContent       = fmt(oh);
  if (gid('sum-pr-amt'))       gid('sum-pr-amt').textContent       = fmt(pr);
  if (gid('sum-markup-total')) gid('sum-markup-total').textContent = fmt(oh + pr);
  if (gid('sum-bid'))          gid('sum-bid').textContent          = fmt(bid);
  gid('top-total').textContent = fmt(bid);
  saveProject();
}

function updSoftCost(id, val) {
  getSoftCosts()[id] = val;
  const b = estimatorMarkupBreakdown();
  if (gid('sum-softcosts-total')) gid('sum-softcosts-total').textContent = fmt(b.softCostsAmt);
  if (gid('sum-bid')) gid('sum-bid').textContent = fmt(b.bid);
  gid('top-total').textContent = fmt(b.bid);
  saveProject();
}

function updQty(id, val) {
  const item = project.items.find(i => i.id === id);
  if (!item) return;
  item.qty = +val || 0;
  const el = gid('ext-' + id);
  if (el) el.textContent = fmt(item.qty * item.unitCost);
  refreshTotals();
}

function updCost(id, val) {
  const item = project.items.find(i => i.id === id);
  if (!item) return;
  item.unitCost = +val || 0;
  const el = gid('ext-' + id);
  if (el) el.textContent = fmt(item.qty * item.unitCost);
  refreshTotals();
}

function updateField(id, field, val) {
  const item = project.items.find(i => i.id === id);
  if (item) item[field] = val;
  saveProject();
}

function refreshTotals() { renderDivNav(); renderSum(); saveProject(); }

function exportEstimatePDF() {
  const { rawDirect, ohAmt, prAmt, coAmt, direct, bid } = estimatorMarkupBreakdown();
  const retAmt  = bid * estMu.ret / 100;
  const today   = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  let divSections = '';
  allDivCodes().forEach(d => {
    const items = divItems(d);
    if (!items.length) return;
    const rows = items.map(i => {
      const ext = i.qty * i.unitCost;
      return `<tr>
        <td>${i.desc}</td><td class="c">${i.unit}</td>
        <td class="r">${fmtN(i.qty)}</td><td class="r">$${fmtN(i.unitCost)}</td>
        <td class="r">${fmt(ext)}</td>
      </tr>`;
    }).join('');
    divSections += `<div class="ds">
      <div class="dh">Division ${d} — ${esc(divName(d))}</div>
      <table><thead><tr><th>Description</th><th class="c">Unit</th><th class="r">Qty</th><th class="r">Unit Cost</th><th class="r">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4" class="r fw">Division Total</td><td class="r fw">${fmt(divTotal(d))}</td></tr></tfoot>
      </table></div>`;
  });

  const approvedCOs = (project.changeOrders || []).filter(c => c.status === 'approved');
  let coSection = '';
  if (approvedCOs.length) {
    const coTotal = approvedCOs.reduce((s, c) => s + (+c.cost || 0), 0);
    coSection = `<div class="ds">
      <div class="dh">Approved Change Orders</div>
      <table><thead><tr><th>CO #</th><th>Date</th><th>Description</th><th class="r">Cost Impact</th></tr></thead>
      <tbody>${approvedCOs.map(c => `<tr>
        <td>CO-${String(c.id).padStart(3,'0')}</td><td>${c.date||'—'}</td><td>${c.desc}</td>
        <td class="r" style="color:${(+c.cost||0)>=0?'#16a34a':'#dc2626'}">${(+c.cost||0)>=0?'+':''}${fmt(Math.abs(+c.cost||0))}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3" class="r fw">Total CO Impact</td>
        <td class="r fw" style="color:${coTotal>=0?'#16a34a':'#dc2626'}">${coTotal>=0?'+':''}${fmt(Math.abs(coTotal))}</td>
      </tr></tfoot></table></div>`;
  }

  const sc = getSoftCosts();
  const summaryRows = [
    ['Direct Cost', fmt(rawDirect)],
    [`Contingency (${estMu.cont}%)`, fmt(coAmt)],
    ['Total Direct Cost', fmt(direct)],
    [`Overhead (${estMu.oh}%)`, fmt(ohAmt)],
    [`Profit (${estMu.profit}%)`, fmt(prAmt)],
    ...EST_SOFT_COST_ITEMS.filter(item => (parseFloat(sc[item.id]) || 0) > 0)
      .map(item => [item.label, fmt(parseFloat(sc[item.id]))]),
  ].map(([l,v]) => `<tr><td>${l}</td><td class="r">${v}</td></tr>`).join('');

  const ratesRows = [
    ['Contingency', estMu.cont + '%'],
    ['Overhead', estMu.oh + '%'],
    ['Profit', estMu.profit + '%'],
    ...(estMu.bond > 0 ? [['Bond / Insurance', estMu.bond + '%']] : []),
  ].map(([l,v]) => `<tr><td>${l}</td><td class="r">${v}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>${project.name||'Project'} — Estimate</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#1a1a2e;background:#fff;padding:32px 40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2.5px solid #1e3a5f;margin-bottom:20px}
.brand{font-size:21px;font-weight:800;color:#1e3a5f;letter-spacing:-.4px}.brand span{color:#f97316}
.pm{text-align:right}.pn{font-size:15px;font-weight:700;color:#1e3a5f}.ps{font-size:10px;color:#777;margin-top:3px}
.ds{margin-bottom:18px}.dh{background:#1e3a5f;color:#fff;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;padding:5px 9px;border-radius:4px 4px 0 0}
table{width:100%;border-collapse:collapse}
thead th{background:#f0f2f6;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#555;padding:5px 8px;border-bottom:1px solid #dde}
tbody td{padding:5px 8px;border-bottom:1px solid #eee;font-size:10.5px}
tbody tr:nth-child(even) td{background:#fafbfc}
tfoot td{background:#f0f2f6;border-top:1.5px solid #ccc;padding:5px 8px;font-size:10.5px}
.c{text-align:center}.r{text-align:right;font-variant-numeric:tabular-nums}.fw{font-weight:700;color:#1e3a5f}
.sw{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:6px}
.sb .st{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#777;margin-bottom:6px}
.sb table{border:1px solid #dde;border-radius:4px;overflow:hidden}
.sb tbody td{padding:5px 10px;font-size:11px}.sb tbody tr:last-child td{border-bottom:none}
.bid td{background:#1e3a5f!important;color:#fff!important;font-weight:700!important;font-size:13px!important;padding:9px 10px!important;border:none!important}
.ret td{color:#999;font-size:10px;font-style:italic}
.foot{margin-top:24px;padding-top:10px;border-top:1px solid #dde;font-size:9px;color:#bbb;display:flex;justify-content:space-between}
@media print{body{padding:16px 24px}.ds{page-break-inside:avoid}}
</style></head><body>
<div class="header">
  <div><div class="brand">Build<span>Calc</span></div><div style="font-size:10px;color:#999;margin-top:3px">Construction Cost Estimate</div></div>
  <div class="pm"><div class="pn">${project.name||'New Project'}</div><div class="ps">${today}</div></div>
</div>
${divSections}${coSection}
<div class="sw">
  <div class="sb"><div class="st">Cost Summary</div>
    <table><tbody>${summaryRows}</tbody>
    <tbody><tr class="bid"><td>BID PRICE</td><td class="r">${fmt(bid)}</td></tr>
    ${estMu.ret>0?`<tr class="ret"><td>Retainage withheld (${estMu.ret}%)</td><td class="r">(${fmt(retAmt)})</td></tr>
    <tr class="ret"><td>Net at substantial completion</td><td class="r">${fmt(bid-retAmt)}</td></tr>`:''}</tbody></table>
  </div>
  <div class="sb"><div class="st">Markup Rates Applied</div>
    <table><tbody>${ratesRows}</tbody></table>
  </div>
</div>
<div class="foot"><span>BuildCalc &mdash; Construction Management Tools</span><span>${project.name||'Project'} &mdash; ${today}</span></div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups for this site to export PDF.'); return; }
  w.document.write(html);
  w.document.close();
}

function delItem(id) {
  project.items = project.items.filter(i => i.id !== id);
  // Since each item is its own phase by default, clean up any schedule/subcontractor/payment
  // data left on its dedicated phase row too — that item id will never come back.
  const bs = getBudgetSheet();
  const phaseId = 'item:' + id;
  if (bs.phases && bs.phases[phaseId]) delete bs.phases[phaseId];
  if (bs.phaseOrder) bs.phaseOrder = bs.phaseOrder.filter(x => x !== phaseId);
  renderAll();
  bldRenderTable();
  saveProject();
}
function setDiv(d) { activeDiv = d; renderAll(); }

function addCustom() {
  if (activeDiv === 'ALL') return;
  project.items.push({ id: project.nextId++, div: activeDiv, desc: 'Custom Item', unit: 'EA', qty: 1, unitCost: 0, custom: true });
  renderAll();
  saveProject();
}

document.addEventListener('click', e => {
  if (!e.target.closest('#proj-dd-wrap')) closeProjectsDropdown();
});
document.addEventListener('keydown', e => {
  const typing = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
  if (e.key === 'Shift' && !typing) {
    if (!bpSpaceDown) {
      bpSpaceDown = true;
      const area = gid('bp-canvas-area'), mkC = gid('markup-canvas');
      if (area) area.style.cursor = 'grab';
      if (mkC) mkC.style.cursor = 'grab';
    }
  }
  if (e.key === 'Escape' && bpCurrentPts.length) {
    bpCurrentPts = [];
    bpRedraw();
  }
  if (e.key === 'Backspace' && !typing && bpCurrentPts.length) {
    e.preventDefault();
    bpCurrentPts.pop();
    bpRedraw();
  }
  if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) bpRedo(); else bpUndo();
  }
  if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    bpRedo();
  }
});
document.addEventListener('keyup', e => {
  if (e.key === 'Shift') {
    bpSpaceDown = false;
    bpPanActive = false;
    const area = gid('bp-canvas-area'), mkC = gid('markup-canvas');
    if (area) area.style.cursor = '';
    if (mkC) mkC.style.cursor = bpScaleMode ? 'crosshair' : 'default';
  }
});

function newProject() {
  if (!confirm('Start a new project? Current items will be cleared.')) return;
  project = { id: 'proj_' + Date.now(), name: 'New Project', items: [], nextId: 1 };
  estMu = defaultEstMu();
  gid('proj-name').value = 'New Project';
  const bpn = gid('bp-proj-name');
  if (bpn) bpn.value = 'New Project';
  const bbn = gid('bld-proj-name');
  if (bbn) bbn.value = 'New Project';
  activeDiv = '03';
  renderAll();
  renderBudgetBuilder();
  saveProject();
}

function bcProjKey() {
  return currentUser ? `bc_proj_${currentUser.id}` : 'bc_proj';
}

function saveProject() {
  if (bpPdf || bpImg) bpSavePage();
  project.estMu = estMu;
  project.bpState = {
    conditions: bpConditions,
    condNextId: bpCondNextId,
    activeCondId: bpActiveCondId,
    pageData: bpPageData,
    pageNum: bpPageNum,
    isImg: bpIsImg,
    zoomPct: bpZoomPct,
    fileName: gid('bp-file-lbl') ? gid('bp-file-lbl').textContent : '',
    fileVersion: bpFileVersion,
  };
  try { localStorage.setItem(bcProjKey(), JSON.stringify(project)); } catch (e) {}
  autoSaveCurrentToList();
  updateNavProjectName();
}

function loadProject() {
  try {
    const s = localStorage.getItem(bcProjKey());
    if (s) {
      project = JSON.parse(s);
      estMu = project.estMu || defaultEstMu();
      gid('proj-name').value = project.name || 'New Project';
      const bpn = gid('bp-proj-name');
      if (bpn) bpn.value = project.name || 'New Project';
      const bbn = gid('bld-proj-name');
      if (bbn) bbn.value = project.name || 'New Project';
    }
  } catch (e) {}
  if (!project.id) project.id = 'proj_' + Date.now();
}

// ── MULTI-PROJECT MANAGEMENT (server-backed via /api/projects) ──────
const PROJECTS_API = '/api/projects';

async function getSavedProjects() {
  try {
    const res = await fetch(PROJECTS_API);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) { return []; }
}

async function apiGetProject(id) {
  try {
    const res = await fetch(`${PROJECTS_API}/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

async function apiSaveProject(id, name, data, createVersion) {
  try {
    await fetch(PROJECTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, data, createVersion: !!createVersion }),
    });
  } catch (e) {}
}

// ── SUBCONTRACTOR DIRECTORY ──────────────────────────────────────────
// Subcontractors are reusable across every project (unlike everything else in Payments &
// Scheduling, which lives inside one project's data), so they're their own small API + table.
let bldSubcontractors = [];

async function apiListSubcontractors() {
  try {
    const res = await fetch('/api/subcontractors');
    bldSubcontractors = res.ok ? await res.json() : [];
  } catch (e) { bldSubcontractors = []; }
  return bldSubcontractors;
}

async function apiCreateSubcontractor(sub) {
  const res = await fetch('/api/subcontractors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub),
  });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || 'Could not save subcontractor'); }
  return res.json();
}

async function apiUpdateSubcontractor(id, sub) {
  const res = await fetch(`/api/subcontractors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub),
  });
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || 'Could not save subcontractor'); }
}

async function apiDeleteSubcontractor(id) {
  await fetch(`/api/subcontractors/${id}`, { method: 'DELETE' });
}

function bldGetSubcontractor(id) {
  return bldSubcontractors.find(s => s.id === id) || null;
}

async function apiDeleteProject(id) {
  try { await fetch(`${PROJECTS_API}/${id}`, { method: 'DELETE' }); } catch (e) {}
}

function updateNavProjectName() {
  const name = project.name || 'New Project';
  const navEl = gid('proj-nav-name');
  const curEl = gid('proj-dd-current-name');
  const bbn   = gid('bld-proj-name');
  if (navEl) navEl.textContent = name;
  if (curEl) curEl.textContent = name;
  if (bbn)   bbn.value = name;
}

function toggleProjectsDropdown(e) {
  e.stopPropagation();
  const panel = gid('proj-dd-panel');
  const isOpen = panel.classList.contains('open');
  if (!isOpen) {
    renderProjectsDropdown();
    panel.classList.add('open');
  } else {
    panel.classList.remove('open');
  }
}

function closeProjectsDropdown() {
  const panel = gid('proj-dd-panel');
  if (panel) panel.classList.remove('open');
}

async function saveCurrentProject() {
  const name = project.name && project.name !== 'New Project'
    ? project.name
    : prompt('Name this project:', 'My Project');
  if (!name || !name.trim()) return;
  project.name = name.trim();
  gid('proj-name').value = project.name;
  const bpn = gid('bp-proj-name');
  if (bpn) bpn.value = project.name;
  const bbn = gid('bld-proj-name');
  if (bbn) bbn.value = project.name;
  const list = await getSavedProjects();
  const dupIdx = list.findIndex(p => p.name === project.name && p.id !== project.id);
  if (dupIdx >= 0 && !confirm(`A project named "${project.name}" already exists. Save anyway as a separate project?`)) return;
  if (!project.id) project.id = 'proj_' + Date.now();
  await apiSaveProject(project.id, project.name, project, true);
  saveProject();
  renderProjectsDropdown();
  const btn = gid('proj-dd-btn');
  if (btn) { btn.classList.add('saved-flash'); setTimeout(() => btn.classList.remove('saved-flash'), 900); }
}

async function autoSaveCurrentToList() {
  if (!project.name || project.name === 'New Project') return;
  if (!project.id) project.id = 'proj_' + Date.now();
  await apiSaveProject(project.id, project.name, project);
}

function bpApplyLoadedProject(entry) {
  bpResetAll();
  project = entry.data;
  project.id = entry.id;
  estMu = project.estMu || defaultEstMu();
  gid('proj-name').value = project.name || 'New Project';
  const bpn = gid('bp-proj-name');
  if (bpn) bpn.value = project.name || 'New Project';
  const bbn = gid('bld-proj-name');
  if (bbn) bbn.value = project.name || 'New Project';
  activeDiv = '03';
  // Estimator/Payments & Scheduling rendering and Blueprint restoration are independent —
  // a bug in one (e.g. an unexpected shape in older project data) must never be able to stop
  // the other from running, since that would silently hide Blueprint markups that are
  // actually saved and fine.
  try { renderAll(); } catch (e) { console.error('renderAll failed:', e); }
  try { renderBudgetBuilder(); } catch (e) { console.error('renderBudgetBuilder failed:', e); }
  try { localStorage.setItem(bcProjKey(), JSON.stringify(project)); } catch(e) {}
  updateNavProjectName();
  bpRestoreFromProject();
}

async function switchToProject(id) {
  saveProject();
  const entry = await apiGetProject(id);
  if (!entry) return;
  bpApplyLoadedProject(entry);
  closeProjectsDropdown();
}

function startNewProjectFromDD() {
  autoSaveCurrentToList();
  if (!confirm('Start a new project? Current items will be cleared.')) return;
  bpResetAll();
  project = { id: 'proj_' + Date.now(), name: 'New Project', items: [], nextId: 1 };
  estMu = defaultEstMu();
  gid('proj-name').value = 'New Project';
  const bpn = gid('bp-proj-name');
  if (bpn) bpn.value = 'New Project';
  const bbn = gid('bld-proj-name');
  if (bbn) bbn.value = 'New Project';
  activeDiv = '03';
  renderAll();
  renderBudgetBuilder();
  saveProject();
  closeProjectsDropdown();
}

async function deleteProjectEntry(id) {
  if (!confirm('Delete this saved project? This cannot be undone.')) return;
  await apiDeleteProject(id);
  bpDeleteStoredFile(id);
  renderProjectsDropdown();
}

function exportProject() {
  const filename = (project.name || 'project').replace(/[^a-z0-9]/gi, '_') + '.buildcalc';
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  closeProjectsDropdown();
}

function importProject(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm('Load "' + (data.name || 'Untitled') + '"? This will replace your current project.')) {
        input.value = ''; return;
      }
      project = data;
      estMu = project.estMu || defaultEstMu();
      gid('proj-name').value = project.name || 'New Project';
      const bpn = gid('bp-proj-name');
      if (bpn) bpn.value = project.name || 'New Project';
      const bbn = gid('bld-proj-name');
      if (bbn) bbn.value = project.name || 'New Project';
      activeDiv = '03';
      renderAll();
      renderBudgetBuilder();
      saveProject();
      closeProjectsDropdown();
    } catch(err) {
      alert('Could not read file. Make sure it is a valid .buildcalc file.');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

async function renderProjectsDropdown() {
  updateNavProjectName();
  refreshShareStatus();
  const list = await getSavedProjects();
  const el = gid('proj-dd-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="proj-dd-empty-msg">No saved projects yet. Click <strong>Save</strong> to save the current project.</div>';
    return;
  }
  el.innerHTML = list.map(p => {
    const d = new Date(p.savedAt);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const isCurrent = p.id === project.id;
    return `<div class="proj-dd-item${isCurrent ? ' current' : ''}">
      <div class="proj-dd-item-info">
        <div class="proj-dd-item-name">${esc(p.name)}${isCurrent ? ' <span class="proj-dd-badge">active</span>' : ''}</div>
        <div class="proj-dd-item-date">${dateStr}</div>
      </div>
      ${isCurrent ? '' : `<button class="proj-dd-load-btn" onclick="switchToProject('${p.id}')">Load</button>`}
      <button class="proj-dd-history-btn" onclick="openVersionHistory('${p.id}')" title="Version history"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 3"/></svg></button>
      <button class="proj-dd-del-btn" onclick="deleteProjectEntry('${p.id}')" title="Delete">&#10005;</button>
    </div>`;
  }).join('');
}

// ── PROJECT VERSION HISTORY ────────────────────────────────────────
let versionHistoryProjectId = null;

async function openVersionHistory(projectId) {
  versionHistoryProjectId = projectId;
  const listEl = gid('version-history-list');
  listEl.innerHTML = '<div style="padding:1rem 0;color:var(--muted);font-size:.85rem">Loading…</div>';
  gid('version-history-modal').style.display = 'flex';
  closeProjectsDropdown();
  try {
    const res = await fetch(`${PROJECTS_API}/${projectId}/versions`);
    const versions = res.ok ? await res.json() : [];
    if (!versions.length) {
      listEl.innerHTML = '<div style="padding:1rem 0;color:var(--muted);font-size:.85rem">No saved versions yet. Versions are created each time you click Save.</div>';
      return;
    }
    listEl.innerHTML = versions.map(v => {
      const d = new Date(v.savedAt);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .1rem;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:600;font-size:.85rem;color:var(--text)">${esc(v.name)}</div>
          <div style="font-size:.75rem;color:var(--muted)">${dateStr}</div>
        </div>
        <button class="btn btn-ghost" style="font-size:.76rem;padding:.3rem .7rem" onclick="restoreVersion('${v.id}')">Restore</button>
      </div>`;
    }).join('');
  } catch (e) {
    listEl.innerHTML = '<div style="padding:1rem 0;color:var(--muted);font-size:.85rem">Could not load version history.</div>';
  }
}

function closeVersionHistory() {
  gid('version-history-modal').style.display = 'none';
  versionHistoryProjectId = null;
}

async function restoreVersion(versionId) {
  const projectId = versionHistoryProjectId;
  if (!projectId) return;
  if (!confirm('Restore this version? Your current saved state for this project will be saved as a new version first, so nothing is lost — but anything since your last Save will be replaced.')) return;
  try {
    const res = await fetch(`${PROJECTS_API}/${projectId}/versions/${versionId}/restore`, { method: 'POST' });
    if (!res.ok) { alert('Could not restore this version.'); return; }
    const restored = await res.json();
    closeVersionHistory();
    if (project.id === projectId) {
      const entry = await apiGetProject(projectId);
      if (entry) bpApplyLoadedProject(entry);
    } else {
      alert(`Restored "${restored.name}". Open it from the project list to see the restored version.`);
    }
  } catch (e) {
    alert('Could not reach the server.');
  }
}

// ── DIVISION GUESSER ───────────────────────────────────────────────
function bpGuessDivision(name) {
  const n = (name || '').toLowerCase();
  if (/demo|demolit|abate|hazmat|clear|grub/.test(n))                         return '02';
  if (/concrete|slab|footing|foundation|grade beam|pour|topping/.test(n))     return '03';
  if (/masonry|brick|cmu|block|stone|veneer/.test(n))                         return '04';
  if (/steel|metal stud|deck|embed|anchor bolt|struct/.test(n))               return '05';
  if (/wood|lumber|fram|plywood|sheathing|cabinet|millwork|carpentry|blocking|cornice|trim|counter/.test(n)) return '06';
  if (/roof|insul|waterproof|membrane|tpo|epdm|wrap|foam|moisture|thermal/.test(n))    return '07';
  if (/door|window|glaz|storefront|curtain wall|overhead|opening|glass|doorknob|hardware/.test(n)) return '08';
  if (/drywall|sheetrock|paint|tile|carpet|floor|ceiling|finish|gypsum|plaster|vct|epoxy/.test(n)) return '09';
  if (/toilet|locker|extinguisher|signage|dock|specialt/.test(n))             return '10';
  if (/plumb|drain|water heat|restroom|bathroom|fixture|grease|sanitary|faucet/.test(n)) return '22';
  if (/hvac|mechanical|duct|rtu|ahu|exhaust|heat|cool|ventil|air handl|fan/.test(n)) return '23';
  if (/electric|light|panel|wiring|conduit|outlet|switch|alarm/.test(n))      return '26';
  if (/excavat|grading|fill|soil|earthwork|backfill/.test(n))                 return '31';
  if (/paving|parking|sidewalk|curb|landscape|asphalt|pavement/.test(n))      return '32';
  if (/sewer|water main|storm|gas line|duct bank|underground util/.test(n))   return '33';
  return '03';
}

// ── BLUEPRINT TAKEOFF ──────────────────────────────────────────────
// Full library of conditions available via "+ Add from Library" — grouped by category.
// New projects start with only BP_DEFAULT_CONDITIONS (the shell basics below); everything
// else here is opt-in, so the sidebar starts clean but nothing useful is out of reach.
const BP_CONDITION_LIBRARY = [
  { id:  1, name: 'Slab',                  color: '#94a3b8', type: 'area',   unit: 'SF', category: 'Foundation & Structure' },
  { id:  2, name: 'Framing & Cornice',     color: '#d97706', type: 'area',   unit: 'SF', category: 'Foundation & Structure' },

  { id: 34, name: 'Masonry / Stone Veneer', color: '#a8a29e', type: 'area',  unit: 'SF', category: 'Exterior Envelope' },
  { id:  5, name: 'Roofing',               color: '#dc2626', type: 'area',   unit: 'SF', category: 'Exterior Envelope' },
  { id: 35, name: 'Rain Gutters',          color: '#38bdf8', type: 'linear', unit: 'LF', category: 'Exterior Envelope' },
  { id:  3, name: 'Windows',               color: '#0ea5e9', type: 'count',  unit: 'EA', category: 'Exterior Envelope' },
  { id:  4, name: 'Exterior Doors',        color: '#0d9488', type: 'count',  unit: 'EA', category: 'Exterior Envelope' },
  { id: 24, name: 'Garage Door',           color: '#7c3aed', type: 'count',  unit: 'EA', category: 'Exterior Envelope' },
  { id: 14, name: 'Paint Exterior',        color: '#f87171', type: 'area',   unit: 'SF', category: 'Exterior Envelope' },

  { id:  6, name: 'Plumbing (Rough)',      color: '#3b82f6', type: 'linear', unit: 'LF', category: 'Rough MEP & Insulation' },
  { id:  7, name: 'Electrical (Rough)',    color: '#eab308', type: 'linear', unit: 'LF', category: 'Rough MEP & Insulation' },
  { id:  8, name: 'HVAC (Rough)',          color: '#22d3ee', type: 'linear', unit: 'LF', category: 'Rough MEP & Insulation' },
  { id:  9, name: 'Alarm System (Rough)',  color: '#fb923c', type: 'linear', unit: 'LF', category: 'Rough MEP & Insulation' },
  { id: 10, name: 'Insulation',            color: '#f472b6', type: 'area',   unit: 'SF', category: 'Rough MEP & Insulation' },

  { id: 11, name: 'Sheetrock',             color: '#e2e8f0', type: 'area',   unit: 'SF', category: 'Interior Finishes' },
  { id: 12, name: 'Trim',                  color: '#c2975f', type: 'linear', unit: 'LF', category: 'Interior Finishes' },
  { id: 13, name: 'Paint Interior',        color: '#a78bfa', type: 'area',   unit: 'SF', category: 'Interior Finishes' },
  { id: 15, name: 'Tile',                  color: '#10b981', type: 'area',   unit: 'SF', category: 'Interior Finishes' },
  { id: 22, name: 'Hardwood Floors',       color: '#92400e', type: 'area',   unit: 'SF', category: 'Interior Finishes' },
  { id: 39, name: 'Carpet',                color: '#818cf8', type: 'area',   unit: 'SF', category: 'Interior Finishes' },
  { id: 36, name: 'Fireplace',             color: '#b45309', type: 'count',  unit: 'EA', category: 'Interior Finishes' },
  { id: 33, name: 'Interior Doors',        color: '#14b8a6', type: 'count',  unit: 'EA', category: 'Interior Finishes' },

  { id: 16, name: 'Cabinets',              color: '#f97316', type: 'linear', unit: 'LF', category: 'Cabinets & Counters' },
  { id: 17, name: 'Counters',              color: '#6366f1', type: 'linear', unit: 'LF', category: 'Cabinets & Counters' },

  { id: 18, name: 'Plumbing (Trim Out)',   color: '#1d4ed8', type: 'count',  unit: 'EA', category: 'Trim-Out MEP & Fixtures' },
  { id: 19, name: 'Electrical (Trim Out)', color: '#ca8a04', type: 'count',  unit: 'EA', category: 'Trim-Out MEP & Fixtures' },
  { id: 20, name: 'HVAC (Trim Out)',       color: '#0e7490', type: 'count',  unit: 'EA', category: 'Trim-Out MEP & Fixtures' },
  { id: 21, name: 'Alarm System (Trim Out)', color: '#ea580c', type: 'count', unit: 'EA', category: 'Trim-Out MEP & Fixtures' },
  { id: 30, name: 'Light Fixtures',        color: '#fde047', type: 'count',  unit: 'EA', category: 'Trim-Out MEP & Fixtures' },
  { id: 31, name: 'Fans',                  color: '#4ade80', type: 'count',  unit: 'EA', category: 'Trim-Out MEP & Fixtures' },
  { id: 32, name: 'Faucets',               color: '#c084fc', type: 'count',  unit: 'EA', category: 'Trim-Out MEP & Fixtures' },
  { id: 28, name: 'Doorknobs',             color: '#fbbf24', type: 'count',  unit: 'EA', category: 'Trim-Out MEP & Fixtures' },
  { id: 29, name: 'Cabinet Hardware',      color: '#9ca3af', type: 'count',  unit: 'EA', category: 'Trim-Out MEP & Fixtures' },
  { id: 23, name: 'Shower Glass',          color: '#67e8f9', type: 'linear', unit: 'LF', category: 'Trim-Out MEP & Fixtures' },
  { id: 25, name: 'Appliances',            color: '#64748b', type: 'count',  unit: 'EA', category: 'Trim-Out MEP & Fixtures' },

  { id: 26, name: 'Landscape',             color: '#16a34a', type: 'area',   unit: 'SF', category: 'Sitework' },
  { id: 27, name: 'Fence',                 color: '#713f12', type: 'linear', unit: 'LF', category: 'Sitework' },
  { id: 37, name: 'Flatwork (Driveway/Walks)', color: '#a3a3a3', type: 'area', unit: 'SF', category: 'Sitework' },
  { id: 38, name: 'Sprinklers',            color: '#0891b2', type: 'linear', unit: 'LF', category: 'Sitework' },
];

const BP_STARTER_IDS = [1, 2, 3, 4, 5];
const BP_DEFAULT_CONDITIONS = BP_CONDITION_LIBRARY.filter(c => BP_STARTER_IDS.includes(c.id));

let bpConditions = BP_DEFAULT_CONDITIONS.map(c => ({ ...c }));
let bpCondNextId = 40;
let bpActiveCondId = 1;
let bpMeasurements = [];
let bpMeasNextId = 1;
let bpNewCondType = 'linear';
let bpNewCondColor = BP_COLORS[0];
let bpEditingCondId = null;
let bpPdf = null, bpPageNum = 1, bpPageCount = 0, bpZoomPct = 100;
let bpRenderToken = 0, bpRenderTask = null;
let bpPageData = {}; // per-page { measurements, scalePxPerFt }
let bpSpaceDown = false, bpPanActive = false, bpPanMouseStart = null, bpPanScrollStart = null;
let bpScalePxPerFt = null, bpScalePts = [], bpScaleMode = false, bpTrashMode = false, bpHideMode = false;
let bpCurrentPts = [];
let bpDragCondId = null;
let bpIsImg = false, bpImg = null;
let bpUndoStack = [], bpRedoStack = [];
const BP_UNDO_LIMIT = 50;
let bpFileVersion = null; // server's updated_at for the currently-loaded file — used to detect a stale local cache

// ── BLUEPRINT INDEXEDDB PERSISTENCE ────────────────────────────────
const BP_DB_NAME = 'buildcalc_bp', BP_DB_VERSION = 1, BP_STORE = 'files';

function bpGetDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BP_DB_NAME, BP_DB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(BP_STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function bpStoreFile(projId, payload) {
  if (!projId) return;
  bpGetDB().then(db => {
    const tx = db.transaction(BP_STORE, 'readwrite');
    tx.objectStore(BP_STORE).put(payload, projId);
  }).catch(() => {});
}

function bpLoadStoredFile(projId) {
  return bpGetDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(BP_STORE, 'readonly').objectStore(BP_STORE).get(projId);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror = e => reject(e.target.error);
  }));
}

function bpDeleteStoredFile(projId) {
  if (!projId) return;
  bpGetDB().then(db => {
    db.transaction(BP_STORE, 'readwrite').objectStore(BP_STORE).delete(projId);
  }).catch(() => {});
}

// ── BLUEPRINT SERVER FILE SYNC ─────────────────────────────────────
// The file itself only ever lived in this browser's IndexedDB, so opening a project on a
// different computer showed the markup but not the drawing underneath it. Uploading a copy to
// the server (kept out of the JSON project-data blob and its version snapshots — see
// migration 0006 — so it doesn't bloat storage) lets any device pull it down on demand.
const BP_MAX_FILE_BYTES = 20 * 1024 * 1024; // keep in sync with server.js's MAX_FILE_BYTES

function bpSetFileSyncStatus(text, warn) {
  const el = gid('bp-file-sync');
  if (!el) return;
  if (!text) { el.style.display = 'none'; return; }
  el.textContent = text;
  el.className = 'bp-file-sync' + (warn ? ' warn' : '');
  el.style.display = 'inline';
}

function bpSetLocalFileVersion(projId, version) {
  bpLoadStoredFile(projId).then(stored => {
    if (!stored) return;
    bpStoreFile(projId, { ...stored, version });
  }).catch(() => {});
}

function bpUploadFileToServer(projId, file) {
  if (!projId || !file) return;
  if (file.size > BP_MAX_FILE_BYTES) {
    bpSetFileSyncStatus(`⚠ too large to sync across devices (max ${BP_MAX_FILE_BYTES / (1024 * 1024)}MB)`, true);
    return;
  }
  bpSetFileSyncStatus('Syncing…');
  fetch(`/api/projects/${projId}/file`, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name || 'drawing'),
    },
    body: file,
  }).then(async res => {
    if (!res.ok) { bpSetFileSyncStatus('⚠ sync failed', true); return; }
    const body = await res.json().catch(() => ({}));
    if (body.updatedAt) {
      bpSetLocalFileVersion(projId, body.updatedAt);
      // Only stamp the in-memory project/global version if we're still looking at the same
      // project this upload was for — the user may have switched projects while it was in
      // flight, and saveProject() would otherwise persist this file's version onto whatever
      // project happens to be active now.
      if (project.id === projId) {
        bpFileVersion = body.updatedAt;
        saveProject();
      }
    }
    bpSetFileSyncStatus('✓ synced');
  }).catch(() => bpSetFileSyncStatus('⚠ sync failed', true));
}

function bpDownloadFileFromServer(projId) {
  if (!projId) return Promise.resolve(null);
  return fetch(`/api/projects/${projId}/file`).then(async res => {
    if (!res.ok) return null;
    const contentType = res.headers.get('Content-Type') || '';
    const fileNameHeader = res.headers.get('X-File-Name');
    const fileName = fileNameHeader ? decodeURIComponent(fileNameHeader) : '';
    const updatedAt = res.headers.get('X-Updated-At') || null;
    if (contentType.startsWith('image/')) {
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      return { type: 'image', dataUrl, fileName, updatedAt };
    }
    const data = await res.arrayBuffer();
    return { type: 'pdf', data, fileName, updatedAt };
  }).catch(() => null);
}

// Bumped on every call so overlapping restores (e.g. init()'s immediate local-cache restore
// racing its own background server reconciliation) can tell whether they've been superseded
// before touching shared canvas state — mirrors the bpRenderToken pattern used for page renders.
let bpRestoreToken = 0;

function bpRestoreFromProject() {
  const myToken = ++bpRestoreToken;
  const state = project.bpState;
  // Restore conditions AND page/measurement data immediately — none of this is gated on the
  // drawing file itself successfully loading below. It's plain JSON that was saved correctly
  // regardless of whether the file load/download that follows succeeds, fails, or is slow —
  // it used to live inside bpRenderStoredFile() and would silently never get applied if that
  // file step didn't complete, even though the markups had nothing to do with the file itself.
  if (state) {
    if (state.conditions)   bpConditions   = state.conditions;
    if (state.condNextId)   bpCondNextId   = state.condNextId;
    if (state.activeCondId) bpActiveCondId = state.activeCondId;
    bpPageData = state.pageData || {};
    bpZoomPct  = state.zoomPct  || 100;
    bpIsImg    = state.isImg    || false;
    bpPageNum  = state.pageNum  || 1;
    // Sync bpMeasurements (the active page's working array) from bpPageData right away, in
    // the same tick. bpSavePage()/saveProject() always writes bpMeasurements back into
    // bpPageData[bpPageNum] on every save, no matter what triggered it — so if anything saves
    // during the gap before the drawing file finishes loading (which is when this used to run),
    // it would silently overwrite the current page's real measurements with an empty array.
    // This is the actual mechanism that corrupted individual pages' data in the past.
    bpLoadPage();
    const zoomReadout = gid('bp-zoom-pct');
    if (zoomReadout) zoomReadout.textContent = bpZoomPct + '%';
  }
  bpFileVersion = (state && state.fileVersion) || null;
  bpRenderConditions();
  bpUpdateActiveIndicator();
  bpResetUndoHistory();
  if (!state || !project.id) return;
  const projId = project.id;
  bpLoadStoredFile(projId).then(stored => {
    if (myToken !== bpRestoreToken) return; // superseded by a newer restore
    // Only trust the local cache if it's stamped with the same version last synced to the
    // server. Otherwise it's stale — e.g. left over from testing, or from before the file was
    // replaced on a different computer — so re-download the current copy instead.
    if (stored && bpFileVersion && stored.version === bpFileVersion) {
      bpRenderStoredFile(stored);
      return;
    }
    bpSetFileSyncStatus('Downloading drawing…');
    bpDownloadFileFromServer(projId).then(downloaded => {
      if (myToken !== bpRestoreToken) return; // superseded by a newer restore
      if (!downloaded) {
        // Server has nothing (or is unreachable) — fall back to whatever's cached locally.
        if (stored) { bpSetFileSyncStatus(null); bpRenderStoredFile(stored); }
        else bpSetFileSyncStatus(null);
        return;
      }
      bpSetFileSyncStatus('✓ synced');
      const forStorage = downloaded.type === 'pdf'
        ? { ...downloaded, data: downloaded.data.slice(0), version: downloaded.updatedAt }
        : { ...downloaded, version: downloaded.updatedAt };
      bpStoreFile(projId, forStorage);
      bpRenderStoredFile(downloaded);
      if (downloaded.updatedAt && project.id === projId) { bpFileVersion = downloaded.updatedAt; saveProject(); }
    }).catch(() => bpSetFileSyncStatus(null));
  }).catch(() => {});
}

// Just the drawing file itself (PDF/image) — bpPageData/conditions/zoom/page are already
// restored by bpRestoreFromProject() before this is ever called, independent of whether this
// succeeds, so a slow or failed file load never costs you your actual markups.
function bpRenderStoredFile(stored) {
  if (stored.type === 'image') {
    bpImg = new Image();
    bpImg.onload = () => {
      bpPageCount = 1;
      bpLoadPage();
      bpShowCanvas();
      const fileLbl = gid('bp-file-lbl');
      if (fileLbl) { fileLbl.textContent = stored.fileName || ''; fileLbl.style.display = stored.fileName ? '' : 'none'; }
      bpRenderImg();
    };
    bpImg.src = stored.dataUrl;
  } else if (stored.type === 'pdf') {
    if (typeof pdfjsLib === 'undefined') return;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfjsLib.getDocument({ data: stored.data }).promise.then(pdf => {
      bpPdf = pdf;
      bpPageCount = pdf.numPages;
      bpPageNum = Math.min(bpPageNum, bpPageCount);
      bpLoadPage();
      bpShowCanvas();
      const fileLbl = gid('bp-file-lbl');
      if (fileLbl) { fileLbl.textContent = stored.fileName || ''; fileLbl.style.display = stored.fileName ? '' : 'none'; }
      const pageLbl = gid('bp-page-lbl');
      if (pageLbl) pageLbl.textContent = `${bpPageNum} / ${bpPageCount}`;
      bpRenderPage();
    }).catch(() => {});
  }
}

function bpResetAll() {
  if (bpRenderTask) { try { bpRenderTask.cancel(); } catch(e) {} bpRenderTask = null; }
  bpRenderToken++;
  bpPdf = null; bpImg = null; bpIsImg = false;
  bpPageNum = 1; bpPageCount = 0; bpZoomPct = 100;
  bpMeasurements = []; bpMeasNextId = 1; bpCurrentPts = [];
  bpScalePxPerFt = null; bpScalePts = []; bpScaleMode = false; bpTrashMode = false; bpHideMode = false;
  bpPageData = {}; bpPanActive = false;
  bpConditions = BP_DEFAULT_CONDITIONS.map(c => ({ ...c }));
  bpCondNextId = 40; bpActiveCondId = 1;
  const trashBtnReset = gid('bp-trash-btn'); if (trashBtnReset) trashBtnReset.classList.remove('active');
  const hideBtnReset = gid('bp-hide-btn'); if (hideBtnReset) hideBtnReset.classList.remove('active-hide');
  const upload = gid('bp-upload'), wrap = gid('bp-canvas-wrap');
  if (upload) upload.style.display = '';
  if (wrap) wrap.style.display = 'none';
  const fileLbl = gid('bp-file-lbl');
  if (fileLbl) { fileLbl.style.display = 'none'; fileLbl.textContent = ''; }
  bpSetFileSyncStatus(null);
  const fileInput = gid('bp-file-input');
  if (fileInput) fileInput.value = '';
  const zoomReadout = gid('bp-zoom-pct');
  if (zoomReadout) zoomReadout.textContent = '100%';
  bpUpdateScaleBadge();
  bpRenderConditions();
  bpRenderQtyPanel();
  bpUpdateActiveIndicator();
  bpResetUndoHistory();
}

function bpGetCond(id) { return bpConditions.find(c => c.id === id); }
function bpGetActiveCond() { return bpGetCond(bpActiveCondId); }

// ── UNDO / REDO ────────────────────────────────────────────────────
function bpSnapshotState() {
  return JSON.stringify({
    conditions: bpConditions,
    measurements: bpMeasurements,
    activeCondId: bpActiveCondId,
    scalePxPerFt: bpScalePxPerFt,
    pageData: bpPageData,
  });
}

function bpPushUndo() {
  bpUndoStack.push(bpSnapshotState());
  if (bpUndoStack.length > BP_UNDO_LIMIT) bpUndoStack.shift();
  bpRedoStack = [];
  bpUpdateUndoRedoButtons();
}

function bpRestoreSnapshot(json) {
  const s = JSON.parse(json);
  bpConditions = s.conditions;
  bpMeasurements = s.measurements;
  bpActiveCondId = s.activeCondId;
  bpScalePxPerFt = s.scalePxPerFt;
  bpPageData = s.pageData || {};
  bpRenderConditions();
  bpUpdateActiveIndicator();
  bpRenderQtyPanel();
  bpUpdateScaleBadge();
  bpRedraw();
}

function bpUndo() {
  if (!bpUndoStack.length) return;
  bpRedoStack.push(bpSnapshotState());
  bpRestoreSnapshot(bpUndoStack.pop());
  saveProject();
  bpUpdateUndoRedoButtons();
}

function bpRedo() {
  if (!bpRedoStack.length) return;
  bpUndoStack.push(bpSnapshotState());
  bpRestoreSnapshot(bpRedoStack.pop());
  saveProject();
  bpUpdateUndoRedoButtons();
}

function bpUpdateUndoRedoButtons() {
  const undoBtn = gid('bp-undo-btn');
  const redoBtn = gid('bp-redo-btn');
  if (undoBtn) undoBtn.disabled = !bpUndoStack.length;
  if (redoBtn) redoBtn.disabled = !bpRedoStack.length;
}

function bpResetUndoHistory() {
  bpUndoStack = [];
  bpRedoStack = [];
  bpUpdateUndoRedoButtons();
}

function bpSelectCond(id) {
  bpActiveCondId = id;
  bpCurrentPts = [];
  bpScaleMode = false;
  bpTrashMode = false;
  bpHideMode = false;
  const trashBtn = gid('bp-trash-btn');
  if (trashBtn) trashBtn.classList.remove('active');
  const hideBtn = gid('bp-hide-btn');
  if (hideBtn) hideBtn.classList.remove('active-hide');
  bpRenderConditions();
  bpUpdateActiveIndicator();
  const c = gid('markup-canvas');
  if (c) c.style.cursor = 'crosshair';
  bpRedraw();
}

function bpRenderConditions() {
  const list = gid('bp-cond-list');
  if (!list) return;
  list.innerHTML = bpConditions.map(c => `
    <div class="bp-cond-item${c.id === bpActiveCondId ? ' active' : ''}${c.hidden ? ' bp-cond-hidden' : ''}"
         draggable="true" data-cond-id="${c.id}"
         ondragstart="bpCondDragStart(event, ${c.id})"
         ondragover="bpCondDragOver(event)"
         ondragleave="bpCondDragLeave(event)"
         ondrop="bpCondDrop(event, ${c.id})"
         ondragend="bpCondDragEnd(event)"
         onclick="${c.hidden ? `bpToggleCondVis(${c.id})` : `bpSelectCond(${c.id})`}"
         title="${c.hidden ? 'Hidden — click to show' : ''}">
      <span style="width:12px;height:12px;border-radius:3px;background:${c.color};flex-shrink:0;display:inline-block"></span>
      <span style="flex:1;font-size:.82rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</span>
      <span style="font-size:.72rem;color:rgba(255,255,255,.5);flex-shrink:0">${c.unit}</span>
      <button onclick="event.stopPropagation();bpEditCond(${c.id})" title="Edit" style="background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:.72rem;padding:0 0 0 .25rem;line-height:1">✏</button>
      <button onclick="event.stopPropagation();bpDeleteCond(${c.id})" title="Delete" style="background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:.75rem;padding:0 0 0 .25rem;line-height:1">✕</button>
    </div>`).join('');
}

function bpCondDragStart(e, id) {
  bpDragCondId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}

function bpCondDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (+e.currentTarget.dataset.condId !== bpDragCondId) e.currentTarget.classList.add('drag-over');
}

function bpCondDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function bpCondDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (bpDragCondId == null || bpDragCondId === targetId) return;
  const fromIdx = bpConditions.findIndex(c => c.id === bpDragCondId);
  const toIdx = bpConditions.findIndex(c => c.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  bpPushUndo();
  const [moved] = bpConditions.splice(fromIdx, 1);
  bpConditions.splice(toIdx, 0, moved);
  bpRenderConditions();
  bpRenderQtyPanel();
  saveProject();
}

function bpCondDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.bp-cond-item.drag-over').forEach(el => el.classList.remove('drag-over'));
  bpDragCondId = null;
}

function bpUpdateActiveIndicator() {
  const el = gid('bp-active-cond');
  if (!el) return;
  const c = bpGetActiveCond();
  if (c) {
    el.textContent = c.name;
    el.style.borderColor = c.color;
    el.style.color = c.color;
  } else {
    el.textContent = 'No condition selected';
    el.style.borderColor = 'rgba(255,255,255,.2)';
    el.style.color = 'rgba(255,255,255,.5)';
  }
}

function bpShowAddCond() {
  bpEditingCondId = null;
  bpNewCondType = 'linear';
  bpNewCondColor = BP_COLORS[0];
  const form = gid('bp-add-cond-form');
  if (form) {
    form.style.display = 'block';
    const btn = form.querySelector('.btn-orange');
    if (btn) btn.textContent = 'Add';
    gid('bpnc-name').value = '';
    gid('bpnc-name').focus();
  }
  bpSyncTypeButtons();
  bpRenderColorPicker();
}

function bpHideAddCond() {
  bpEditingCondId = null;
  const form = gid('bp-add-cond-form');
  if (form) {
    form.style.display = 'none';
    const btn = form.querySelector('.btn-orange');
    if (btn) btn.textContent = 'Add';
  }
}

function bpEditCond(id) {
  const c = bpGetCond(id);
  if (!c) return;
  bpEditingCondId = id;
  bpNewCondType = c.type;
  bpNewCondColor = c.color;
  const form = gid('bp-add-cond-form');
  if (form) {
    form.style.display = 'block';
    const btn = form.querySelector('.btn-orange');
    if (btn) btn.textContent = 'Save';
    const nameInp = gid('bpnc-name');
    if (nameInp) { nameInp.value = c.name; nameInp.focus(); nameInp.select(); }
  }
  bpSyncTypeButtons();
  bpRenderColorPicker();
}

function bpSelectNewType(type) {
  bpNewCondType = type;
  bpSyncTypeButtons();
}

function bpSyncTypeButtons() {
  ['linear', 'area', 'count'].forEach(t => {
    const btn = gid('bpnc-' + t);
    if (btn) btn.classList.toggle('active', t === bpNewCondType);
  });
}

function bpSelectNewColor(color) {
  bpNewCondColor = color;
  bpRenderColorPicker();
}

function bpRenderColorPicker() {
  const el = gid('bpnc-colors');
  if (!el) return;
  const isCustom = !BP_COLORS.includes(bpNewCondColor);
  const wheel = gid('bpnc-color-wheel');
  if (wheel) wheel.value = bpNewCondColor;
  el.innerHTML = BP_COLORS.map(c =>
    `<div class="bp-color-dot${c === bpNewCondColor ? ' sel' : ''}" style="background:${c}" onclick="bpSelectNewColor('${c}')"></div>`
  ).join('') +
  `<label class="bp-color-dot bp-color-wheel${isCustom ? ' sel' : ''}" for="bpnc-color-wheel"
    title="Custom color" ${isCustom ? `style="background:${bpNewCondColor}"` : ''}></label>`;
}

function bpConfirmAddCond() {
  const name = (gid('bpnc-name').value || '').trim();
  if (!name) { gid('bpnc-name').focus(); return; }
  const unit = bpNewCondType === 'area' ? 'SF' : bpNewCondType === 'linear' ? 'LF' : 'EA';
  bpPushUndo();
  if (bpEditingCondId !== null) {
    const c = bpGetCond(bpEditingCondId);
    if (c) { c.name = name; c.color = bpNewCondColor; c.type = bpNewCondType; c.unit = unit; }
    bpCurrentPts = [];
  } else {
    bpConditions.push({ id: bpCondNextId, name, color: bpNewCondColor, type: bpNewCondType, unit });
    bpActiveCondId = bpCondNextId;
    bpCondNextId++;
  }
  bpHideAddCond();
  bpRenderConditions();
  bpUpdateActiveIndicator();
  bpRenderQtyPanel();
  bpRedraw();
  saveProject();
  const c = gid('markup-canvas');
  if (c) c.style.cursor = 'crosshair';
}

function openCondLib() {
  gid('cond-lib-search').value = '';
  buildCondLibList('');
  gid('cond-lib-modal').style.display = 'flex';
  setTimeout(() => gid('cond-lib-search').focus(), 50);
}

function closeCondLib() {
  gid('cond-lib-modal').style.display = 'none';
}

function filterCondLib(q) {
  buildCondLibList(q);
}

function buildCondLibList(q) {
  const ql = q.toLowerCase();
  const el = gid('cond-lib-list');
  const byCategory = {};
  BP_CONDITION_LIBRARY.forEach(c => {
    if (q && !c.name.toLowerCase().includes(ql)) return;
    (byCategory[c.category] = byCategory[c.category] || []).push(c);
  });
  const cats = Object.keys(byCategory);
  if (!cats.length) {
    el.innerHTML = '<div style="padding:1rem 0;color:var(--muted);font-size:.85rem">No matching conditions.</div>';
    return;
  }
  el.innerHTML = cats.map(cat => `
    <div style="font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:.7rem 0 .35rem">${cat}</div>
    ${byCategory[cat].map(c => {
      const already = bpConditions.some(bc => bc.id === c.id);
      return `<div class="modal-lib-item${already ? ' selected' : ''}" onclick="${already ? '' : `addCondFromLib(${c.id})`}" style="cursor:${already ? 'default' : 'pointer'}">
        <span style="display:flex;align-items:center;gap:.5rem">
          <span style="width:10px;height:10px;border-radius:2px;background:${c.color};display:inline-block;flex-shrink:0"></span>
          <span class="modal-lib-name">${esc(c.name)}</span>
        </span>
        <span class="modal-lib-cost">${already ? 'Added' : c.unit}</span>
      </div>`;
    }).join('')}
  `).join('');
}

function addCondFromLib(id) {
  if (bpConditions.some(c => c.id === id)) return;
  const source = BP_CONDITION_LIBRARY.find(c => c.id === id);
  if (!source) return;
  bpPushUndo();
  const { category, ...cond } = source;
  bpConditions.push({ ...cond });
  bpActiveCondId = id;
  bpRenderConditions();
  bpUpdateActiveIndicator();
  bpRenderQtyPanel();
  saveProject();
  buildCondLibList(gid('cond-lib-search').value);
}

function bpDeleteCond(id) {
  const cond = bpGetCond(id);
  const linkedItem = cond && cond.estItemId ? project.items.find(i => i.id === cond.estItemId) : null;
  const msg = linkedItem
    ? 'Delete this condition, its measurements, and the matching Estimator line item?'
    : 'Delete this condition and all its measurements?';
  if (!confirm(msg)) return;
  bpPushUndo();
  if (linkedItem) project.items = project.items.filter(i => i.id !== linkedItem.id);
  bpConditions = bpConditions.filter(c => c.id !== id);
  bpMeasurements = bpMeasurements.filter(m => m.condId !== id);
  if (bpActiveCondId === id) bpActiveCondId = bpConditions.length ? bpConditions[0].id : null;
  bpRenderConditions();
  bpUpdateActiveIndicator();
  bpRenderQtyPanel();
  bpRedraw();
  renderAll();
  saveProject();
}

function bpToggleCondVis(id) {
  const c = bpGetCond(id);
  if (!c) return;
  bpPushUndo();
  c.hidden = !c.hidden;
  bpRenderConditions();
  bpRedraw();
  saveProject();
}

function bpCondMeasurements(condId) { return bpMeasurements.filter(m => m.condId === condId); }

// Conditions are shared across every page of a Blueprint file, but measurements are stored
// per page — so a condition's real total is whatever's marked up on THIS page (live, possibly
// not yet flushed to bpPageData) plus whatever's stored for every OTHER page.
function bpCondAllPagesMeasurements(condId) {
  let all = bpCondMeasurements(condId);
  Object.keys(bpPageData).forEach(pn => {
    if (+pn === bpPageNum) return; // current page's live bpMeasurements already covers this one
    const pd = bpPageData[pn];
    if (pd && pd.measurements) all = all.concat(pd.measurements.filter(m => m.condId === condId));
  });
  return all;
}

function bpCondTotal(condId) {
  return bpCondAllPagesMeasurements(condId).reduce((s, m) => s + m.value, 0);
}

function bpCondCopyMeas(condId) { return bpCondAllPagesMeasurements(condId).find(m => m.type === 'copy'); }

// Removes any existing "copied value" measurement for a condition, on every page — so
// re-copying from a new source replaces the old copy instead of stacking across pages.
function bpRemoveCopyMeasEverywhere(condId) {
  bpMeasurements = bpMeasurements.filter(m => !(m.condId === condId && m.type === 'copy'));
  Object.keys(bpPageData).forEach(pn => {
    if (+pn === bpPageNum) return;
    const pd = bpPageData[pn];
    if (pd && pd.measurements) pd.measurements = pd.measurements.filter(m => !(m.condId === condId && m.type === 'copy'));
  });
}

function bpRenderQtyPanel() {
  const panel = gid('bp-qty-list');
  if (!panel) return;
  if (!bpConditions.length) {
    panel.innerHTML = '<div class="bp-qty-empty">Add a condition on the left to start measuring.</div>';
    return;
  }
  panel.innerHTML = bpConditions.map(c => {
    const total = bpCondTotal(c.id);
    const count = bpCondAllPagesMeasurements(c.id).length;
    const copyMeas = bpCondCopyMeas(c.id);
    return `<div class="bp-qty-row">
      <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.25rem">
        <span style="width:10px;height:10px;border-radius:2px;background:${c.color};display:inline-block;flex-shrink:0"></span>
        <span style="font-weight:600;font-size:.82rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
      </div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:.35rem">
        <span style="font-size:1.05rem;font-weight:700;color:var(--navy)">${fmtN(Math.round(total * 10) / 10)} <span style="font-size:.74rem;font-weight:400;color:var(--muted)">${c.unit}</span></span>
        <span style="font-size:.72rem;color:var(--muted)">${count} item${count !== 1 ? 's' : ''}</span>
      </div>
      ${copyMeas ? `<div style="display:flex;align-items:center;gap:.3rem;font-size:.7rem;color:var(--muted);margin-bottom:.35rem">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">↳ copied from ${esc(copyMeas.sourceName)}</span>
        <span style="cursor:pointer;font-weight:700" title="Remove copied value" onclick="bpRemoveCopyVal(${c.id})">&#10005;</span>
      </div>` : ''}
      <div style="display:flex;gap:.4rem">
        <button class="to-send-btn" style="flex:1" onclick="bpSendCondToEst(${c.id})">→ Send to Estimator</button>
        <button class="bp-copy-val-btn" onclick="openCopyVal(${c.id})" title="Copy a value from another condition">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="bp-clear-cond-btn" onclick="bpClearCondMeasurements(${c.id})" title="Clear all measurements for this condition">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>
        </button>
      </div>
    </div>`;
  }).join('<hr style="border:none;border-top:1px solid var(--border);margin:.5rem 0">');
}

// ── COPY VALUE BETWEEN CONDITIONS ───────────────────────────────────
let bpCopyTargetId = null;

function bpCopySourceCandidates(targetId) {
  const target = bpGetCond(targetId);
  if (!target) return [];
  return bpConditions.filter(c => c.id !== targetId && c.unit === target.unit && bpCondTotal(c.id) > 0);
}

function openCopyVal(condId) {
  bpCopyTargetId = condId;
  const target = bpGetCond(condId);
  if (!target) return;
  gid('copy-val-title').textContent = `Copy Value into "${target.name}"`;
  const candidates = bpCopySourceCandidates(condId);
  if (!candidates.length) {
    gid('copy-val-hint').textContent = `No other measured conditions use "${target.unit}" yet.`;
    gid('copy-val-list').innerHTML = '';
  } else {
    gid('copy-val-hint').textContent = `Pick a condition to copy its current total into "${target.name}".`;
    gid('copy-val-list').innerHTML = candidates.map(c => `
      <div class="modal-lib-item" style="cursor:pointer" onclick="bpApplyCopyVal(${c.id})">
        <span style="display:flex;align-items:center;gap:.5rem">
          <span style="width:10px;height:10px;border-radius:2px;background:${c.color};display:inline-block;flex-shrink:0"></span>
          <span class="modal-lib-name">${esc(c.name)}</span>
        </span>
        <span class="modal-lib-cost">${fmtN(Math.round(bpCondTotal(c.id) * 10) / 10)} ${c.unit}</span>
      </div>`).join('');
  }
  gid('copy-val-modal').style.display = 'flex';
}

function closeCopyVal() { gid('copy-val-modal').style.display = 'none'; bpCopyTargetId = null; }

function bpApplyCopyVal(sourceId) {
  const targetId = bpCopyTargetId;
  const target = bpGetCond(targetId);
  const source = bpGetCond(sourceId);
  if (!target || !source) { closeCopyVal(); return; }
  bpPushUndo();
  bpRemoveCopyMeasEverywhere(targetId);
  bpMeasurements.push({
    id: bpMeasNextId++, condId: targetId, type: 'copy', pts: [],
    value: bpCondTotal(sourceId), sourceCondId: sourceId, sourceName: source.name,
  });
  bpRenderQtyPanel();
  saveProject();
  closeCopyVal();
}

function bpRemoveCopyVal(condId) {
  bpPushUndo();
  bpRemoveCopyMeasEverywhere(condId);
  bpRenderQtyPanel();
  saveProject();
}

function bpClearCondMeasurements(condId) {
  const cond = bpGetCond(condId);
  if (!cond) return;
  if (!bpCondAllPagesMeasurements(condId).length) return;
  if (!confirm(`Clear all measurements for "${cond.name}"? This removes everything measured for it on every page — the condition itself stays.`)) return;
  bpPushUndo();
  bpMeasurements = bpMeasurements.filter(m => m.condId !== condId);
  Object.keys(bpPageData).forEach(pn => {
    if (+pn === bpPageNum) return;
    const pd = bpPageData[pn];
    if (pd && pd.measurements) pd.measurements = pd.measurements.filter(m => m.condId !== condId);
  });
  bpRenderQtyPanel();
  bpRedraw();
  saveProject();
}

// ── SEND TO ESTIMATOR MODAL ────────────────────────────────────────
let bpPendingCondId = null;
let bpPaRows = [];
let bpPaConds = [];

function bpSendCondToEst(condId) {
  const cond = bpGetCond(condId);
  if (!cond) return;
  bpPendingCondId = condId;
  const total = bpCondTotal(condId);
  gid('modal-meas-lbl').textContent = `${cond.name} — ${fmtN(Math.round(total * 10) / 10)} ${cond.unit}`;
  const existing = cond.estItemId ? project.items.find(i => i.id === cond.estItemId) : null;
  const guessedDiv = existing ? existing.div : bpGuessDivision(cond.name);
  gid('modal-div').innerHTML = allDivCodes()
    .map(d => `<option value="${d}"${d === guessedDiv ? ' selected' : ''}>${d} — ${esc(divName(d))}</option>`)
    .join('');
  gid('modal-desc').value = existing ? existing.desc : cond.name;
  gid('modal-cost').value = existing ? existing.unitCost : '';
  gid('send-modal').style.display = 'flex';
}

function bpModalConfirm() {
  const cond = bpGetCond(bpPendingCondId);
  if (!cond) { bpModalClose(); return; }
  const div  = gid('modal-div').value;
  const desc = gid('modal-desc').value.trim() || cond.name;
  const cost = +(gid('modal-cost').value) || 0;
  const total = bpCondTotal(bpPendingCondId);
  const qty = Math.round(total * 10) / 10;

  const existing = cond.estItemId ? project.items.find(i => i.id === cond.estItemId) : null;
  if (existing) {
    existing.div = div;
    existing.desc = desc;
    existing.unit = cond.unit;
    existing.qty = qty;
    existing.unitCost = cost;
  } else {
    const item = { id: project.nextId++, div, desc, unit: cond.unit, qty, unitCost: cost, custom: true };
    project.items.push(item);
    cond.estItemId = item.id;
  }
  saveProject();
  bpModalClose();
  activeDiv = div;
  showPage('estimator');
  renderAll();
}

function bpModalClose() { gid('send-modal').style.display = 'none'; bpPendingCondId = null; }

// ── PUSH ALL TO ESTIMATOR ─────────────────────────────────────────
function bpPushAllToEst() {
  bpPaConds = bpConditions.filter(c => bpCondTotal(c.id) > 0);
  if (!bpPaConds.length) { alert('Nothing measured yet — draw or count some conditions on the drawing first.'); return; }
  bpPaRows = bpPaConds.map(c => {
    const existing = c.estItemId ? project.items.find(i => i.id === c.estItemId) : null;
    return { condId: c.id, div: existing ? existing.div : bpGuessDivision(c.name), cost: existing ? existing.unitCost : 0 };
  });
  gid('push-all-rows').innerHTML = bpPaConds.map((c, i) => {
    const total = bpCondTotal(c.id);
    const guessed = bpPaRows[i].div;
    const divOpts = allDivCodes().map(d => `<option value="${d}"${d === guessed ? ' selected' : ''}>${d} — ${esc(divName(d))}</option>`).join('');
    return `<tr>
      <td style="padding:.45rem .5rem">
        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c.color};vertical-align:middle;margin-right:.35rem"></span>
        <strong style="font-size:.83rem">${c.name}</strong>
      </td>
      <td style="padding:.45rem .5rem;font-size:.83rem;color:var(--muted)">${fmtN(Math.round(total * 10) / 10)} ${c.unit}</td>
      <td style="padding:.45rem .5rem">
        <select onchange="bpPaRows[${i}].div=this.value" style="font-size:.79rem;padding:.22rem .35rem;border:1px solid var(--border);border-radius:4px;width:100%">
          ${divOpts}
        </select>
      </td>
      <td style="padding:.45rem .5rem">
        <input type="number" min="0" step="0.01" value="${bpPaRows[i].cost}" id="pa-cost-${i}" onchange="bpPaRows[${i}].cost=+this.value" class="pa-cost-inp" style="min-width:100px;font-size:.83rem;padding:.22rem .4rem;border:1px solid var(--border);border-radius:4px">
      </td>
    </tr>`;
  }).join('');
  gid('push-all-modal').style.display = 'flex';
}

function bpPushAllConfirm() {
  bpPaConds.forEach((c, i) => {
    const total = bpCondTotal(c.id);
    const row = bpPaRows[i];
    const qty = Math.round(total * 10) / 10;
    const existing = c.estItemId ? project.items.find(it => it.id === c.estItemId) : null;
    if (existing) {
      existing.div = row.div;
      existing.desc = c.name;
      existing.unit = c.unit;
      existing.qty = qty;
      existing.unitCost = row.cost;
    } else {
      const item = { id: project.nextId++, div: row.div, desc: c.name, unit: c.unit, qty, unitCost: row.cost, custom: true };
      project.items.push(item);
      c.estItemId = item.id;
    }
  });
  saveProject();
  bpClosePushAll();
  showPage('estimator');
  renderAll();
}

function bpClosePushAll() { gid('push-all-modal').style.display = 'none'; }

// ── BLUEPRINT CANVAS / RENDER ─────────────────────────────────────
function bpLoadFile(input) {
  const file = input.files ? input.files[0] : input;
  if (!file) return;

  const replacing = bpPdf !== null || bpImg !== null;
  if (replacing && bpMeasurements.length) {
    if (!confirm('Load new blueprint?\n\nYour current measurements will be cleared. Any estimator items you already pushed are preserved — remove them from the Estimator manually if needed.')) return;
  }
  if (replacing) {
    bpMeasurements = [];
    bpCurrentPts = [];
    bpScalePxPerFt = null;
    bpScalePts = [];
    bpScaleMode = false;
    bpPageData = {};
    bpRenderQtyPanel();
    bpResetUndoHistory();
  }

  const fileLbl = gid('bp-file-lbl');
  if (fileLbl) { fileLbl.textContent = file.name; fileLbl.style.display = 'inline'; }
  bpIsImg = file.type.startsWith('image/');

  // The file endpoint checks project ownership against a real saved project record, so make
  // sure one exists server-side first — a brand-new unnamed project wouldn't have one yet
  // otherwise (autoSaveCurrentToList skips saving until it's named).
  if (!project.id) project.id = 'proj_' + Date.now();
  // Capture the target project id now — the async work below spans multiple await/callback
  // boundaries, and `project.id` could point at a different project by the time they run if
  // the user switches projects mid-upload.
  const targetProjId = project.id;
  apiSaveProject(targetProjId, project.name, project).then(() => bpUploadFileToServer(targetProjId, file));

  if (bpIsImg) {
    const imgReader = new FileReader();
    imgReader.onload = ie => {
      const dataUrl = ie.target.result;
      bpStoreFile(targetProjId, { type: 'image', dataUrl, fileName: file.name });
      bpImg = new Image();
      bpImg.onload = () => { bpPageCount = 1; bpPageNum = 1; bpShowCanvas(); bpRenderImg(); };
      bpImg.src = dataUrl;
    };
    imgReader.readAsDataURL(file);
  } else {
    if (typeof pdfjsLib === 'undefined') { alert('PDF.js failed to load. Check your internet connection.'); return; }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const reader = new FileReader();
    reader.onload = e => {
      const ab = e.target.result;
      bpStoreFile(targetProjId, { type: 'pdf', data: ab.slice(0), fileName: file.name });
      pdfjsLib.getDocument({ data: ab }).promise.then(pdf => {
        bpPdf = pdf;
        bpPageCount = pdf.numPages;
        bpPageNum = 1;
        bpShowCanvas();
        bpRenderPage();
        bpTryAutoDetectScale();
      }).catch(err => alert('Could not load PDF: ' + err.message));
    };
    reader.readAsArrayBuffer(file);
  }
}

function bpShowCanvas() {
  gid('bp-upload').style.display = 'none';
  gid('bp-canvas-wrap').style.display = 'inline-block';
  gid('bp-page-lbl').textContent = `${bpPageNum} / ${bpPageCount}`;
}

function bpDragOver(e) {
  e.preventDefault();
  gid('bp-canvas-area').classList.add('drag-over');
}
function bpDragLeave(e) {
  if (!gid('bp-canvas-area').contains(e.relatedTarget)) {
    gid('bp-canvas-area').classList.remove('drag-over');
  }
}
function bpDrop(e) {
  e.preventDefault();
  gid('bp-canvas-area').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) bpLoadFile(file);
}

function bpUpdateScaleBadge() {
  const badge = gid('bp-scale-badge');
  if (!badge) return;
  if (bpScaleMode) {
    badge.textContent = bpScalePts.length === 0 ? 'Click point A…' : 'Now click point B…';
    badge.className = 'scale-badge setting';
  } else if (bpScalePxPerFt) {
    badge.textContent = `Scale: 1 ft = ${bpScalePxPerFt.toFixed(1)} px`;
    badge.className = 'scale-badge';
  } else {
    badge.textContent = 'Scale: not set';
    badge.className = 'scale-badge unset';
  }
}

function bpSavePage() {
  bpPageData[bpPageNum] = { measurements: bpMeasurements, scalePxPerFt: bpScalePxPerFt };
}

function bpLoadPage() {
  const d = bpPageData[bpPageNum];
  bpMeasurements = d ? d.measurements : [];
  bpScalePxPerFt = d ? d.scalePxPerFt : null;
  bpCurrentPts = [];
  bpScalePts = [];
  bpScaleMode = false;
  bpUpdateScaleBadge();
  bpRenderQtyPanel();
}

function bpRenderPage() {
  if (!bpPdf) return;
  const token = ++bpRenderToken;
  if (bpRenderTask) { try { bpRenderTask.cancel(); } catch(e) {} bpRenderTask = null; }
  bpPdf.getPage(bpPageNum).then(page => {
    if (token !== bpRenderToken) return;
    const viewport = page.getViewport({ scale: bpZoomPct / 100 * 1.5 });
    const pdfC = gid('pdf-canvas'), mkC = gid('markup-canvas');
    pdfC.width = mkC.width = viewport.width;
    pdfC.height = mkC.height = viewport.height;
    bpRenderTask = page.render({ canvasContext: pdfC.getContext('2d'), viewport });
    bpRenderTask.promise.then(() => {
      if (token !== bpRenderToken) return;
      bpRenderTask = null;
      bpRedraw();
    }).catch(() => {});
  });
}

function bpRenderImg() {
  const pdfC = gid('pdf-canvas'), mkC = gid('markup-canvas');
  const z = bpZoomPct / 100;
  pdfC.width = mkC.width = Math.round(bpImg.naturalWidth * z);
  pdfC.height = mkC.height = Math.round(bpImg.naturalHeight * z);
  pdfC.getContext('2d').drawImage(bpImg, 0, 0, pdfC.width, pdfC.height);
  bpRedraw();
}

function bpSetZoom(pct) {
  pct = Math.min(300, Math.max(25, Math.round(+pct) || 100));
  bpZoomPct = pct;
  const readout = gid('bp-zoom-pct'); if (readout) readout.textContent = pct + '%';
  if (bpIsImg && bpImg) bpRenderImg(); else bpRenderPage();
}

function bpPrevPage() {
  if (bpPageNum <= 1) return;
  bpSavePage();
  bpPageNum--;
  gid('bp-page-lbl').textContent = `${bpPageNum} / ${bpPageCount}`;
  bpLoadPage();
  bpRenderPage();
  bpTryAutoDetectScale();
}
function bpNextPage() {
  if (bpPageNum >= bpPageCount) return;
  bpSavePage();
  bpPageNum++;
  gid('bp-page-lbl').textContent = `${bpPageNum} / ${bpPageCount}`;
  bpLoadPage();
  bpRenderPage();
  bpTryAutoDetectScale();
}

// ── AUTO SCALE DETECTION ─────────────────────────────────────────────
// Looks for a printed scale note (e.g. 1/4" = 1'-0") in the PDF's text layer
// and converts it to px-per-foot in the same coordinate space bpRenderPage
// uses (PDF points * the 1.5 base render multiplier, independent of zoom).
const BP_RENDER_PT_MULT = 1.5;
let bpDetectedScalePxPerFt = null;

function bpScaleFromRatio(paperInches, realFeet, label) {
  if (!paperInches || !realFeet) return null;
  const pointsPerRealFoot = 72 * (paperInches / realFeet);
  const pxPerFt = pointsPerRealFoot * BP_RENDER_PT_MULT;
  if (!isFinite(pxPerFt) || pxPerFt < 2 || pxPerFt > 600) return null;
  return { pxPerFt, label };
}

function bpParseScaleNote(rawText) {
  const text = rawText
    .replace(/[′’]/g, "'")
    .replace(/[″”]/g, '"')
    .replace(/\s+/g, ' ');

  // Fractional-inch form: 1/4" = 1'-0"
  let m = text.match(/(\d+)\s*\/\s*(\d+)\s*"?\s*=\s*(\d+)\s*'(?:\s*-?\s*(\d+)\s*")?/);
  if (m) {
    const paperInches = (+m[1]) / (+m[2]);
    const realFeet = +m[3] + (+(m[4] || 0)) / 12;
    return bpScaleFromRatio(paperInches, realFeet, `${m[1]}/${m[2]}" = ${m[3]}'${m[4] ? `-${m[4]}"` : ''}`);
  }

  // Whole-inch form: 1" = 20'-0"
  m = text.match(/(\d+)\s*"\s*=\s*(\d+)\s*'(?:\s*-?\s*(\d+)\s*")?/);
  if (m) {
    const paperInches = +m[1];
    const realFeet = +m[2] + (+(m[3] || 0)) / 12;
    return bpScaleFromRatio(paperInches, realFeet, `${m[1]}" = ${m[2]}'${m[3] ? `-${m[3]}"` : ''}`);
  }

  // OCR often drops the tiny foot-mark apostrophe (e.g. reads 1'-0" as 1-0"). These
  // fallbacks anchor on the closing inches quote instead, which OCR reads far more reliably.
  m = text.match(/(\d+)\s*\/\s*(\d+)\s*"?\s*=\s*(\d+)\s*'?-\s*(\d+)\s*"/);
  if (m) {
    const paperInches = (+m[1]) / (+m[2]);
    const realFeet = +m[3] + (+m[4]) / 12;
    return bpScaleFromRatio(paperInches, realFeet, `${m[1]}/${m[2]}" = ${m[3]}'-${m[4]}"`);
  }

  m = text.match(/(\d+)\s*"\s*=\s*(\d+)\s*'?-\s*(\d+)\s*"/);
  if (m) {
    const paperInches = +m[1];
    const realFeet = +m[2] + (+m[3]) / 12;
    return bpScaleFromRatio(paperInches, realFeet, `${m[1]}" = ${m[2]}'-${m[3]}"`);
  }

  return null;
}

function bpTryAutoDetectScale() {
  if (!bpPdf || bpScalePxPerFt) return;
  const page = bpPageNum;
  bpPdf.getPage(page).then(p => p.getTextContent()).then(content => {
    if (bpScalePxPerFt || page !== bpPageNum) return;
    const text = content.items.map(i => i.str).join(' ');
    const found = bpParseScaleNote(text);
    if (found) { bpShowScaleDetectModal(found, false); return; }
    // No match in the text layer — could be a scanned page with no usable text at all, or a
    // born-digital page whose scale note just isn't in a format we matched. Either way, fall
    // back to OCR rather than assuming "has some text" means "scale note must be readable".
    bpTryOcrDetectScale();
  }).catch(() => {});
}

let bpOcrWorker = null;
async function bpGetOcrWorker() {
  if (!bpOcrWorker) bpOcrWorker = await Tesseract.createWorker('eng');
  return bpOcrWorker;
}

async function bpTryOcrDetectScale() {
  if (!bpPdf || bpScalePxPerFt || typeof Tesseract === 'undefined') return;
  const pageNum = bpPageNum;
  const badge = gid('bp-scale-badge');
  let showedNotFound = false;
  try {
    const page = await bpPdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const full = document.createElement('canvas');
    full.width = viewport.width;
    full.height = viewport.height;
    await page.render({ canvasContext: full.getContext('2d'), viewport }).promise;

    if (badge) { badge.textContent = 'Scanning for scale…'; badge.className = 'scale-badge setting'; }
    const worker = await bpGetOcrWorker();

    // Try the title-block band first (fast, usually where scale notes live).
    const bandH = Math.round(full.height * 0.22);
    const crop = document.createElement('canvas');
    crop.width = full.width;
    crop.height = bandH;
    crop.getContext('2d').drawImage(full, 0, full.height - bandH, full.width, bandH, 0, 0, full.width, bandH);
    let { data } = await worker.recognize(crop);
    if (pageNum !== bpPageNum || bpScalePxPerFt) return;
    let found = bpParseScaleNote(data.text || '');

    // Fall back to OCR-ing the whole sheet — slower, but catches notes outside that band
    // or ones the tighter crop degraded past legibility.
    if (!found) {
      ({ data } = await worker.recognize(full));
      if (pageNum !== bpPageNum || bpScalePxPerFt) return;
      found = bpParseScaleNote(data.text || '');
    }

    if (found) {
      bpShowScaleDetectModal(found, true);
    } else if (badge && pageNum === bpPageNum && !bpScalePxPerFt) {
      showedNotFound = true;
      badge.textContent = 'No scale note found — set manually';
      badge.className = 'scale-badge unset';
      setTimeout(() => { if (pageNum === bpPageNum && !bpScalePxPerFt) bpUpdateScaleBadge(); }, 3000);
    }
  } catch (e) {
    // OCR failures are non-fatal — fall back to manual Set Scale silently
  } finally {
    if (badge && !bpScalePxPerFt && !showedNotFound) bpUpdateScaleBadge();
  }
}

function bpShowScaleDetectModal(found, viaOcr) {
  bpDetectedScalePxPerFt = found.pxPerFt;
  gid('scale-detect-label').textContent = found.label;
  gid('scale-detect-pxft').textContent = `1 ft = ${found.pxPerFt.toFixed(1)} px`;
  const note = gid('scale-detect-ocr-note');
  if (note) note.style.display = viaOcr ? 'block' : 'none';
  gid('scale-detect-modal').style.display = 'flex';
}

function closeScaleDetectModal() { gid('scale-detect-modal').style.display = 'none'; }

function bpConfirmDetectedScale() {
  if (!bpDetectedScalePxPerFt) { closeScaleDetectModal(); return; }
  bpScalePxPerFt = bpDetectedScalePxPerFt;
  bpUpdateScaleBadge();
  bpRedraw();
  saveProject();
  closeScaleDetectModal();
}

function bpRejectDetectedScale() {
  closeScaleDetectModal();
  bpSetScale();
}

function bpSetScale() {
  if (bpScaleMode) {
    bpScaleMode = false;
    bpScalePts = [];
    bpUpdateScaleBadge();
    return;
  }
  bpScalePts = [];
  bpScaleMode = true;
  bpTrashMode = false;
  bpHideMode = false;
  bpCurrentPts = [];
  const trashBtn = gid('bp-trash-btn');
  if (trashBtn) trashBtn.classList.remove('active');
  const hideBtn = gid('bp-hide-btn');
  if (hideBtn) hideBtn.classList.remove('active-hide');
  const c = gid('markup-canvas');
  if (c) c.style.cursor = 'crosshair';
  bpUpdateScaleBadge();
}

function bpCanvasXY(e) {
  const r = gid('markup-canvas').getBoundingClientRect();
  const z = bpZoomPct / 100;
  return { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z };
}

function bpPointerDown(e) {
  if (!bpSpaceDown || e.button !== 0) return;
  e.preventDefault();
  bpPanActive = true;
  bpPanMouseStart = { x: e.clientX, y: e.clientY };
  e.currentTarget.setPointerCapture(e.pointerId);
  const area = gid('bp-canvas-area');
  area.style.cursor = 'grabbing';
  e.currentTarget.style.cursor = 'grabbing';
}

function bpPointerMove(e) {
  if (!bpPanActive) return;
  const area = gid('bp-canvas-area');
  area.scrollLeft -= e.clientX - bpPanMouseStart.x;
  area.scrollTop  -= e.clientY - bpPanMouseStart.y;
  bpPanMouseStart = { x: e.clientX, y: e.clientY };
}

function bpPointerUp(e) {
  if (!bpPanActive) return;
  bpPanActive = false;
  const area = gid('bp-canvas-area');
  if (bpSpaceDown) {
    area.style.cursor = 'grab';
    e.currentTarget.style.cursor = 'grab';
  } else {
    area.style.cursor = '';
    e.currentTarget.style.cursor = bpScaleMode ? 'crosshair' : 'default';
  }
}

function bpWheel(e) {
  if (!bpSpaceDown) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -10 : 10;
  bpSetZoom(bpZoomPct + delta);
}

function bpClick(e) {
  if (bpSpaceDown) return;
  if (bpTrashMode) { bpDeleteMeasurementAt(bpCanvasXY(e)); return; }
  if (bpHideMode) {
    const m = bpFindMeasurementAt(bpCanvasXY(e));
    if (m) bpToggleCondVis(m.condId);
    return;
  }
  if (bpScaleMode) {
    const pt = bpCanvasXY(e);
    bpScalePts.push(pt);
    if (bpScalePts.length === 1) { bpUpdateScaleBadge(); bpRedraw(); return; }
    if (bpScalePts.length === 2) {
      const dx = bpScalePts[1].x - bpScalePts[0].x;
      const dy = bpScalePts[1].y - bpScalePts[0].y;
      const px = Math.sqrt(dx * dx + dy * dy);
      const ans = prompt('Distance between the two points (in feet):');
      if (ans && +ans > 0) {
        bpPushUndo();
        bpScalePxPerFt = px / +ans;
      }
      bpScalePts = [];
      bpScaleMode = false;
      bpUpdateScaleBadge();
      const c = gid('markup-canvas');
      if (c) c.style.cursor = 'crosshair';
      saveProject();
    }
    return;
  }

  const cond = bpGetActiveCond();
  if (!cond) return;

  if (cond.type === 'count') {
    bpPushUndo();
    bpMeasurements.push({ id: bpMeasNextId++, condId: cond.id, type: 'count', pts: [bpCanvasXY(e)], value: 1 });
    bpRenderQtyPanel();
    bpRedraw();
    saveProject();
    return;
  }

  bpCurrentPts.push(bpCanvasXY(e));
  bpRedraw();
}

function bpDblClick(e) {
  const cond = bpGetActiveCond();
  if (!cond) return;
  if (cond.type === 'linear' && bpCurrentPts.length >= 2) bpFinishShape();
  if (cond.type === 'area'   && bpCurrentPts.length >= 3) bpFinishShape();
}

let bpHoverMeasId = null;

function bpShowHoverTip(cond, clientX, clientY) {
  const tip = gid('bp-hover-tip');
  if (!tip) return;
  tip.innerHTML = `<span class="bp-hover-tip-dot" style="background:${cond.color}"></span>${esc(cond.name)}`;
  tip.style.left = (clientX + 14) + 'px';
  tip.style.top = (clientY + 16) + 'px';
  tip.style.display = 'flex';
}

function bpHideHoverTip() {
  bpHoverMeasId = null;
  const tip = gid('bp-hover-tip');
  if (tip) tip.style.display = 'none';
}

function bpMouseMove(e) {
  if (bpSpaceDown) { bpHideHoverTip(); return; }

  // Hover tooltip: show which condition a marked-up measurement belongs to,
  // as long as we're not mid-draw or mid-scale-pick (those have their own overlay).
  if (!bpCurrentPts.length && !(bpScaleMode && bpScalePts.length)) {
    const hoverPt = bpCanvasXY(e);
    const hit = bpFindMeasurementAt(hoverPt);
    const cond = hit ? bpGetCond(hit.condId) : null;
    if (cond) {
      bpHoverMeasId = hit.id;
      bpShowHoverTip(cond, e.clientX, e.clientY);
    } else if (bpHoverMeasId !== null) {
      bpHideHoverTip();
    }
  } else if (bpHoverMeasId !== null) {
    bpHideHoverTip();
  }

  if (!bpCurrentPts.length && !bpScaleMode) return;
  bpRedraw();
  const pt = bpCanvasXY(e);
  const ctx = gid('markup-canvas').getContext('2d');
  const cond = bpGetActiveCond();
  const color = cond ? cond.color : '#f97316';
  const z = bpZoomPct / 100;

  if (bpScaleMode && bpScalePts.length === 1) {
    ctx.save();
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(bpScalePts[0].x*z, bpScalePts[0].y*z); ctx.lineTo(pt.x*z, pt.y*z); ctx.stroke();
    ctx.restore();
  }

  if (bpCurrentPts.length) {
    const last = bpCurrentPts[bpCurrentPts.length - 1];
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(last.x*z, last.y*z); ctx.lineTo(pt.x*z, pt.y*z); ctx.stroke();
    ctx.restore();
  }
}

function bpToggleTrash() {
  bpTrashMode = !bpTrashMode;
  if (bpTrashMode) {
    bpScaleMode = false; bpHideMode = false; bpCurrentPts = []; bpRedraw();
    const hideBtn = gid('bp-hide-btn');
    if (hideBtn) hideBtn.classList.remove('active-hide');
  }
  const btn = gid('bp-trash-btn');
  if (btn) btn.classList.toggle('active', bpTrashMode);
  const c = gid('markup-canvas');
  if (c) c.style.cursor = bpTrashMode ? 'pointer' : 'crosshair';
}

function bpToggleHideMode() {
  bpHideMode = !bpHideMode;
  if (bpHideMode) {
    bpScaleMode = false; bpTrashMode = false; bpCurrentPts = []; bpRedraw();
    const trashBtn = gid('bp-trash-btn');
    if (trashBtn) trashBtn.classList.remove('active');
  }
  const btn = gid('bp-hide-btn');
  if (btn) btn.classList.toggle('active-hide', bpHideMode);
  const c = gid('markup-canvas');
  if (c) c.style.cursor = bpHideMode ? 'pointer' : 'crosshair';
}

function bpFindMeasurementAt(pt) {
  const z = bpZoomPct / 100;
  const HIT_DOT  = 12 / z;
  const HIT_LINE = 8  / z;
  for (let i = bpMeasurements.length - 1; i >= 0; i--) {
    const m = bpMeasurements[i];
    const cond = bpGetCond(m.condId);
    if (!cond || cond.hidden) continue;
    let hit = false;
    if (m.type === 'count') {
      const dx = pt.x - m.pts[0].x, dy = pt.y - m.pts[0].y;
      hit = Math.sqrt(dx*dx + dy*dy) <= HIT_DOT;
    } else if (m.type === 'linear') {
      for (let j = 1; j < m.pts.length; j++) {
        if (bpDistToSeg(pt, m.pts[j-1], m.pts[j]) <= HIT_LINE) { hit = true; break; }
      }
    } else if (m.type === 'area') {
      hit = bpPointInPoly(pt, m.pts);
    }
    if (hit) return m;
  }
  return null;
}

function bpDeleteMeasurementAt(pt) {
  const m = bpFindMeasurementAt(pt);
  if (!m) return;
  bpPushUndo();
  bpMeasurements.splice(bpMeasurements.indexOf(m), 1);
  bpRenderQtyPanel();
  bpRedraw();
  saveProject();
}

function bpDistToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / lenSq));
  return Math.hypot(p.x - (a.x + t*dx), p.y - (a.y + t*dy));
}

function bpPointInPoly(pt, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > pt.y) !== (yj > pt.y) && pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function bpFinishShape() {
  const pts = bpCurrentPts.slice();
  if (!pts.length) return;
  const cond = bpGetActiveCond();
  if (!cond) return;
  let value = 0;

  if (cond.type === 'linear') {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    value = bpScalePxPerFt ? len / bpScalePxPerFt : len;
  } else {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    area = Math.abs(area) / 2;
    value = bpScalePxPerFt ? area / (bpScalePxPerFt * bpScalePxPerFt) : area;
  }

  bpPushUndo();
  bpMeasurements.push({ id: bpMeasNextId++, condId: cond.id, type: cond.type, pts, value: Math.round(value * 10) / 10 });
  bpCurrentPts = [];
  bpRenderQtyPanel();
  bpRedraw();
  saveProject();
}

function bpRedraw() {
  const c = gid('markup-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const z = bpZoomPct / 100;

  bpMeasurements.forEach(m => {
    const cond = bpGetCond(m.condId);
    if (!cond || cond.hidden) return;
    const color = cond.color;
    const unit = m.type === 'linear' ? (bpScalePxPerFt ? 'LF' : 'px') : (bpScalePxPerFt ? 'SF' : 'px²');
    ctx.save();

    if (m.type === 'linear') {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      m.pts.forEach((p, i) => i ? ctx.lineTo(p.x*z, p.y*z) : ctx.moveTo(p.x*z, p.y*z));
      ctx.stroke();
      m.pts.forEach(p => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p.x*z, p.y*z, 4, 0, Math.PI * 2); ctx.fill();
      });
      const mid = m.pts[Math.floor(m.pts.length / 2)];
      ctx.fillStyle = color; ctx.font = 'bold 11px sans-serif'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${m.value} ${unit}`, mid.x*z + 5, mid.y*z - 5);

    } else if (m.type === 'area') {
      ctx.fillStyle = color + '33'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      m.pts.forEach((p, i) => i ? ctx.lineTo(p.x*z, p.y*z) : ctx.moveTo(p.x*z, p.y*z));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      const cx = m.pts.reduce((s, p) => s + p.x, 0) / m.pts.length;
      const cy = m.pts.reduce((s, p) => s + p.y, 0) / m.pts.length;
      ctx.fillStyle = color; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${m.value} ${unit}`, cx*z, cy*z);

    } else if (m.type === 'count') {
      ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(m.pts[0].x*z, m.pts[0].y*z, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✓', m.pts[0].x*z, m.pts[0].y*z);
    }
    ctx.restore();
  });

  if (bpScalePts.length === 1) {
    ctx.save();
    ctx.fillStyle = '#f97316';
    ctx.beginPath(); ctx.arc(bpScalePts[0].x*z, bpScalePts[0].y*z, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (bpCurrentPts.length) {
    const cond = bpGetActiveCond();
    const color = cond ? cond.color : '#f97316';
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    bpCurrentPts.forEach((p, i) => i ? ctx.lineTo(p.x*z, p.y*z) : ctx.moveTo(p.x*z, p.y*z));
    ctx.stroke();
    ctx.globalAlpha = 1;
    bpCurrentPts.forEach(p => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x*z, p.y*z, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
}

function bpClearAll() {
  if (bpMeasurements.length && !confirm('Clear all measurements on this page? Conditions will be kept.')) return;
  bpMeasurements = [];
  bpCurrentPts = [];
  bpRedraw();
  bpRenderQtyPanel();
  const fileLbl = gid('bp-file-lbl');
  if (fileLbl) { fileLbl.style.display = 'none'; fileLbl.textContent = ''; }
}

// ── BUDGET BUILDER ─────────────────────────────────────────────────
// Construction Phases are driven live by whatever's been costed in the Estimator (see
// bldPhaseDivisions) — this tab has no other manually-maintained sections anymore. Overhead
// and Soft Costs both moved to the Estimator (see EST_SOFT_COST_ITEMS/estSoftCostsTotal
// above): Overhead because it's a bid-price markup, not an actual bill, and Soft Costs because
// splitting real costs that feed the bid price across two tabs was more confusing than useful.

const BLD_STATUSES = ['Not Started', 'Bid Needed', 'In Progress', 'Complete'];
const BLD_STATUS_CLASS = { 'Not Started': 'bs-ns', 'Bid Needed': 'bs-bid', 'In Progress': 'bs-ip', 'Complete': 'bs-cp' };

function getBudgetSheet() {
  if (!project.budgetSheet) {
    project.budgetSheet = {
      phases: {},
      overhead: {},
      soft: {},
    };
  }
  const bs = project.budgetSheet;
  // One-time migration: the manual Overhead section was folded into Soft Costs — move any
  // already-entered rows over instead of leaving them stranded and invisible.
  if (bs.overhead && Object.keys(bs.overhead).length) {
    Object.entries(bs.overhead).forEach(([id, row]) => {
      if (!bs.soft[id]) bs.soft[id] = row;
    });
    bs.overhead = {};
  }
  // One-time migration: Soft Costs itself moved to the Estimator as flat dollar fields
  // (project.softCosts) — carry over anything already entered. Contingency didn't move; it's
  // redundant with the Estimator's Contingency % (same precedent as Overhead), so any old
  // manual Contingency value is simply dropped here rather than carried forward.
  if (bs.soft && Object.keys(bs.soft).length) {
    if (!project.softCosts) project.softCosts = {};
    Object.entries(bs.soft).forEach(([id, row]) => {
      if (id === 'contingency') return;
      if (project.softCosts[id] === undefined) {
        const mat = parseFloat(row.mat) || 0;
        const labor = parseFloat(row.labor) || 0;
        const combined = parseFloat(row.combined) || (mat + labor);
        if (combined > 0) project.softCosts[id] = String(combined);
      }
    });
    bs.soft = {};
  }
  return bs;
}

// Grouping by CSI division didn't hold up in practice — e.g. Roofing and Insulation can share
// a division but run on totally different schedules with different subs. So Payments &
// Scheduling no longer groups by division at all: every costed item is its own phase by
// default, and a named custom phase (tagged via the phase drill-down or All Items view) is the
// only way multiple items ever share one row — items keep their own division for Estimator
// purposes regardless, that's now purely an Estimator organizational concept.
function itemsForPhase(phaseId) {
  if (project.customPhases && project.customPhases[phaseId] !== undefined) {
    return project.items.filter(i => i.phaseKey === phaseId);
  }
  if (typeof phaseId === 'string' && phaseId.startsWith('item:')) {
    const itemId = parseInt(phaseId.slice(5), 10);
    return project.items.filter(i => i.id === itemId && !i.phaseKey);
  }
  return [];
}
function phaseTotal(phaseId) {
  return itemsForPhase(phaseId).reduce((s, i) => s + i.qty * i.unitCost, 0);
}
function phaseLabel(phaseId) {
  if (project.customPhases && project.customPhases[phaseId] !== undefined) {
    return project.customPhases[phaseId];
  }
  const items = itemsForPhase(phaseId);
  return items.length ? items[0].desc : phaseId;
}
function isCustomPhase(phaseId) {
  return !!(project.customPhases && project.customPhases[phaseId] !== undefined);
}

// Active phases: one per costed, untagged item (in the order items were created) plus one per
// used custom phase. Display order is user-customizable (drag-and-drop) via bs.phaseOrder; new
// phases land at the end until dragged somewhere.
function bldPhaseDivisions() {
  const bs = getBudgetSheet();
  const itemIds = project.items.filter(i => !i.phaseKey && i.qty * i.unitCost > 0).map(i => 'item:' + i.id);
  const customIds = Object.keys(project.customPhases || {}).filter(id => phaseTotal(id) > 0);
  const active = [...itemIds, ...customIds];
  const order = bs.phaseOrder || [];
  const ordered = order.filter(id => active.includes(id));
  const remaining = active.filter(id => !ordered.includes(id));
  return [...ordered, ...remaining];
}

// ── TAG AN ITEM INTO A CUSTOM PHASE (or back to its own, default phase) ──────────────
function bldItemGroupingOptions(item) {
  const currentPhaseKey = item.phaseKey || '';
  let opts = `<option value=""${!currentPhaseKey ? ' selected' : ''}>— Its own phase —</option>`;
  const phases = project.customPhases || {};
  Object.entries(phases).forEach(([key, name]) => {
    opts += `<option value="${key}"${currentPhaseKey === key ? ' selected' : ''}>${esc(name)}</option>`;
  });
  opts += '<option value="__new__">+ New Phase…</option>';
  return opts;
}

function bldRefreshOpenPhaseViews() {
  if (bldPhaseDetailDiv) bldOpenPhaseDetail(bldPhaseDetailDiv);
  if (bldAllItemsModalOpen) bldRenderAllItemsModal();
}

function bldSetItemGrouping(itemId, value) {
  const item = project.items.find(i => i.id === itemId);
  if (!item) return;
  if (value === '__new__') {
    const name = prompt('Name for the new phase (it can include more than one item):', '');
    const trimmed = name == null ? '' : name.trim();
    if (!trimmed) { bldRefreshOpenPhaseViews(); return; } // re-render to reset the dropdown
    if (!project.customPhases) project.customPhases = {};
    if (!project.nextCustomPhaseId) project.nextCustomPhaseId = 1;
    const key = 'P' + project.nextCustomPhaseId++;
    project.customPhases[key] = trimmed;
    item.phaseKey = key;
  } else if (value === '') {
    delete item.phaseKey;
  } else {
    item.phaseKey = value;
  }
  saveProject();
  bldRenderTable();
  bldRefreshOpenPhaseViews();
}

// ── ALL ITEMS MODAL (Payments & Scheduling) ───────────────────────────
let bldAllItemsModalOpen = false;

function bldOpenAllItemsModal() {
  bldAllItemsModalOpen = true;
  bldRenderAllItemsModal();
  gid('bld-all-items-modal').style.display = 'flex';
}

function closeBldAllItemsModal() {
  gid('bld-all-items-modal').style.display = 'none';
  bldAllItemsModalOpen = false;
}

function bldRenderAllItemsModal() {
  const items = [...project.items].sort((a, b) => a.div.localeCompare(b.div));
  const grand = items.reduce((s, i) => s + i.qty * i.unitCost, 0);
  gid('bld-all-items-list').innerHTML = !items.length
    ? `<div class="empty-msg">No items yet — add some in the Estimator first.</div>`
    : `<table class="items" style="width:100%">
        <thead><tr>
          <th style="width:50px">Div</th>
          <th>Description</th>
          <th style="width:50px">Unit</th>
          <th style="min-width:70px;text-align:right">Qty</th>
          <th style="min-width:85px;text-align:right">Unit Cost</th>
          <th style="min-width:85px;text-align:right">Total</th>
          <th style="min-width:170px">Phase</th>
        </tr></thead>
        <tbody>${items.map(i => `<tr>
          <td style="font-size:.72rem;color:var(--muted)" title="${esc(divName(i.div))} — set in the Estimator">${i.div}</td>
          <td>${esc(i.desc)}</td>
          <td>${i.unit}</td>
          <td style="text-align:right">${fmtN(i.qty)}</td>
          <td style="text-align:right">${fmt(i.unitCost)}</td>
          <td style="text-align:right;font-weight:600">${fmt(i.qty * i.unitCost)}</td>
          <td><select class="form-sel" style="font-size:.75rem;padding:.2rem .3rem;width:100%" onchange="bldSetItemGrouping(${i.id},this.value)">${bldItemGroupingOptions(i)}</select></td>
        </tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700">Grand Total</td><td style="text-align:right;font-weight:700">${fmt(grand)}</td><td></td></tr></tfoot>
      </table>`;
}

function bldRenamePhase(phaseId, event) {
  if (event) event.stopPropagation();
  if (isCustomPhase(phaseId)) {
    const next = prompt('Rename this phase:', project.customPhases[phaseId]);
    if (next === null) return;
    const trimmed = next.trim();
    if (trimmed) project.customPhases[phaseId] = trimmed;
    saveProject();
    bldRenderTable();
    if (bldAllItemsModalOpen) bldRenderAllItemsModal();
  } else if (phaseId.startsWith('item:')) {
    // A default (untagged) phase's label IS the item's own description — renaming it
    // renames the item, same as editing its description in the Estimator.
    const itemId = parseInt(phaseId.slice(5), 10);
    const item = project.items.find(i => i.id === itemId);
    if (!item) return;
    const next = prompt('Rename this item:', item.desc);
    if (next === null) return;
    const trimmed = next.trim();
    if (trimmed) item.desc = trimmed;
    saveProject();
    renderAll();
    bldRenderTable();
    if (bldAllItemsModalOpen) bldRenderAllItemsModal();
  }
}

function bldDeletePhase(phaseId, event) {
  if (event) event.stopPropagation();
  if (!isCustomPhase(phaseId)) return;
  const itemCount = itemsForPhase(phaseId).length;
  const msg = itemCount > 0
    ? `Delete "${project.customPhases[phaseId]}"? Its ${itemCount} item${itemCount === 1 ? '' : 's'} will move back to their own individual phase.`
    : `Delete "${project.customPhases[phaseId]}"?`;
  if (!confirm(msg)) return;
  project.items.forEach(i => { if (i.phaseKey === phaseId) delete i.phaseKey; });
  delete project.customPhases[phaseId];
  const bs = getBudgetSheet();
  if (bs.phases && bs.phases[phaseId]) delete bs.phases[phaseId];
  if (bs.phaseOrder) bs.phaseOrder = bs.phaseOrder.filter(x => x !== phaseId);
  saveProject();
  bldRenderTable();
  if (bldAllItemsModalOpen) bldRenderAllItemsModal();
}

// ── PHASE DRAG-AND-DROP REORDERING ────────────────────────────────────
let bldDragPhaseDiv = null;

function bldPhaseDragStart(e, d) {
  bldDragPhaseDiv = d;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}

function bldPhaseDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (e.currentTarget.dataset.id !== bldDragPhaseDiv) e.currentTarget.classList.add('drag-over');
}

function bldPhaseDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function bldPhaseDrop(e, targetDiv) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (bldDragPhaseDiv == null || bldDragPhaseDiv === targetDiv) return;
  const order = bldPhaseDivisions();
  const fromIdx = order.indexOf(bldDragPhaseDiv);
  const toIdx = order.indexOf(targetDiv);
  if (fromIdx === -1 || toIdx === -1) return;
  const newOrder = [...order];
  const [moved] = newOrder.splice(fromIdx, 1);
  newOrder.splice(toIdx, 0, moved);
  getBudgetSheet().phaseOrder = newOrder;
  bldRenderTable();
  saveProject();
}

function bldPhaseDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.bld-row.drag-over').forEach(el => el.classList.remove('drag-over'));
  bldDragPhaseDiv = null;
}

function bldGetRow(section, id) {
  const bs = getBudgetSheet();
  if (!bs[section][id]) {
    bs[section][id] = section === 'phases'
      ? { startDate: '', endDate: '', status: 'Not Started', note: '', subcontractorId: null, payments: [], contractAmount: '' }
      : { combined: '', startDate: '', endDate: '', status: 'Not Started', note: '' };
  }
  if (section === 'phases' && !bs[section][id].payments) bs[section][id].payments = [];
  return bs[section][id];
}

function bldPhasePaidTotal(row) {
  return (row.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
}

// The Estimator total is a takeoff-based estimate — once a subcontractor gives a real number,
// that contracted amount (not the estimate) is what should drive payments/progress tracking.
// Leaving it blank keeps the phase fully Estimator-driven, same as before this existed.
function bldPhaseAmount(phaseId) {
  const contract = parseFloat(bldGetRow('phases', phaseId).contractAmount);
  return contract > 0 ? contract : phaseTotal(phaseId);
}

// ── PHASE DETAIL MODAL ─────────────────────────────────────────────────
let bldPhaseDetailDiv = null;

function bldOpenPhaseDetail(d) {
  bldPhaseDetailDiv = d;
  gid('phase-detail-title').textContent = phaseLabel(d);
  const items = itemsForPhase(d);
  const row = bldGetRow('phases', d);
  const hasContract = parseFloat(row.contractAmount) > 0;
  let noteHtml = '';
  if (hasContract) {
    noteHtml += `<p style="font-size:.78rem;color:var(--muted);margin-bottom:.5rem">This phase is using a <strong>Contract Amount</strong> of ${fmt(bldPhaseAmount(d))} for payments — the total below is the original estimate it's based on.</p>`;
  }
  gid('phase-detail-list').innerHTML = noteHtml + (!items.length
    ? `<div class="empty-msg">No line items in this phase yet.</div>`
    : `<table class="items" style="width:100%">
        <thead><tr>
          <th>Description</th>
          <th style="width:50px">Unit</th>
          <th style="min-width:80px;text-align:right">Qty</th>
          <th style="min-width:90px;text-align:right">Unit Cost</th>
          <th style="min-width:90px;text-align:right">Total</th>
          <th style="min-width:170px">Phase</th>
        </tr></thead>
        <tbody>${items.map(i => `<tr>
          <td>${esc(i.desc)}</td>
          <td>${i.unit}</td>
          <td style="text-align:right">${fmtN(i.qty)}</td>
          <td style="text-align:right">${fmt(i.unitCost)}</td>
          <td style="text-align:right;font-weight:600">${fmt(i.qty * i.unitCost)}</td>
          <td><select class="form-sel" style="font-size:.75rem;padding:.2rem .3rem;width:100%" onchange="bldSetItemGrouping(${i.id},this.value)">${bldItemGroupingOptions(i)}</select></td>
        </tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="4" style="text-align:right;font-weight:700">Total</td><td style="text-align:right;font-weight:700">${fmt(phaseTotal(d))}</td><td></td></tr></tfoot>
      </table>`);
  gid('phase-detail-modal').style.display = 'flex';
}

function closePhaseDetailModal() {
  gid('phase-detail-modal').style.display = 'none';
  bldPhaseDetailDiv = null;
}

function bldGoToPhaseInEstimator() {
  const d = bldPhaseDetailDiv;
  if (!d) return;
  closePhaseDetailModal();
  showPage('estimator');
  if (isCustomPhase(d)) {
    // A custom phase can span multiple items/divisions, so there's no single division to
    // jump to — show every item instead.
    setDiv('ALL');
    return;
  }
  const items = itemsForPhase(d);
  setDiv(items.length ? items[0].div : 'ALL');
}

// ── SUBCONTRACTOR PAYMENTS MODAL ──────────────────────────────────────
let bldPaymentsTargetDiv = null;

function bldOpenPaymentsModal(d) {
  bldPaymentsTargetDiv = d;
  gid('payments-modal-title').textContent = `Payments — ${phaseLabel(d)}`;
  bldRenderPaymentsModal();
  gid('pay-add-date').value = new Date().toISOString().slice(0, 10);
  gid('pay-add-amount').value = '';
  gid('pay-add-note').value = '';
  gid('payments-modal').style.display = 'flex';
}

function closePaymentsModal() {
  gid('payments-modal').style.display = 'none';
  bldPaymentsTargetDiv = null;
}

function bldRenderPaymentsModal() {
  const d = bldPaymentsTargetDiv;
  if (!d) return;
  const row = bldGetRow('phases', d);

  const selEl = gid('payments-sub-sel');
  selEl.innerHTML = '<option value="">— No subcontractor assigned —</option>' +
    bldSubcontractors.map(s => `<option value="${s.id}"${s.id === row.subcontractorId ? ' selected' : ''}>${esc(s.name)}${s.trade ? ` (${esc(s.trade)})` : ''}</option>`).join('');
  if (row.subcontractorId && !bldGetSubcontractor(row.subcontractorId)) {
    selEl.innerHTML += `<option value="${row.subcontractorId}" selected>(deleted subcontractor)</option>`;
  }

  const shareBtn = gid('pay-share-link-btn');
  if (shareBtn) shareBtn.disabled = !row.subcontractorId;

  const estTotal = phaseTotal(d);
  gid('pay-contract-amount').value = row.contractAmount || '';
  gid('pay-contract-note').textContent = parseFloat(row.contractAmount) > 0
    ? `Estimator estimate for this phase: ${fmt(estTotal)}`
    : `Currently using the Estimator total (${fmt(estTotal)}) — enter an amount above once you have a real quote.`;

  const total = bldPhaseAmount(d);
  const paid = bldPhasePaidTotal(row);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  gid('payments-summary').innerHTML = `
    <div class="pay-sum-row"><span>Phase Total</span><span>${fmt(total)}</span></div>
    <div class="pay-sum-row"><span>Paid</span><span>${fmt(paid)}</span></div>
    <div class="pay-sum-row pay-sum-remaining"><span>Remaining</span><span>${fmt(total - paid)}</span></div>
    <div class="pay-progress-track"><div class="pay-progress-fill" style="width:${pct}%"></div></div>
    <div class="pay-progress-pct">${pct}% paid</div>
  `;

  const payments = [...(row.payments || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  gid('payments-list').innerHTML = payments.length
    ? payments.map(p => `
      <div class="pay-hist-row">
        <span class="pay-hist-date">${p.date ? new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
        <span class="pay-hist-amt">${fmt(parseFloat(p.amount) || 0)}</span>
        <span class="pay-hist-note">${esc(p.note || '')}</span>
        <span class="pay-hist-del" title="Delete payment" onclick="bldDeletePayment('${p.id}')">&#10005;</span>
      </div>`).join('')
    : '<div class="bp-qty-empty" style="padding:.75rem 0">No payments logged yet.</div>';
}

function bldAssignSubcontractor(subId) {
  const row = bldGetRow('phases', bldPaymentsTargetDiv);
  row.subcontractorId = subId || null;
  const shareBtn = gid('pay-share-link-btn');
  if (shareBtn) shareBtn.disabled = !row.subcontractorId;
  bldRenderTable();
  saveProject();
}

function bldUpdateContractAmount(val) {
  const row = bldGetRow('phases', bldPaymentsTargetDiv);
  row.contractAmount = val;
  bldRenderPaymentsModal();
  bldRenderTable();
  saveProject();
}

function bldAddPayment() {
  const amount = parseFloat(gid('pay-add-amount').value);
  if (!amount || amount <= 0) { alert('Enter a payment amount greater than 0.'); return; }
  const date = gid('pay-add-date').value || new Date().toISOString().slice(0, 10);
  const note = gid('pay-add-note').value.trim();
  const row = bldGetRow('phases', bldPaymentsTargetDiv);
  row.payments.push({ id: 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), amount, date, note });
  bldRenderPaymentsModal();
  bldRenderTable();
  saveProject();
  gid('pay-add-amount').value = '';
  gid('pay-add-note').value = '';
}

function bldDeletePayment(paymentId) {
  const row = bldGetRow('phases', bldPaymentsTargetDiv);
  row.payments = (row.payments || []).filter(p => p.id !== paymentId);
  bldRenderPaymentsModal();
  bldRenderTable();
  saveProject();
}

function bldPrintPaymentReceipt() {
  const d = bldPaymentsTargetDiv;
  if (!d) return;
  const row = bldGetRow('phases', d);
  const sub = row.subcontractorId ? bldGetSubcontractor(row.subcontractorId) : null;
  const total = bldPhaseAmount(d);
  const paid = bldPhasePaidTotal(row);
  const today = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const payments = [...(row.payments || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const rows = payments.map(p => `<tr>
    <td>${p.date ? new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
    <td>${esc(p.note || '')}</td>
    <td class="r">${fmt(parseFloat(p.amount) || 0)}</td>
  </tr>`).join('') || `<tr><td colspan="3" style="color:#999;text-align:center">No payments logged yet.</td></tr>`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>${project.name || 'Project'} — Payment Record</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#1a1a2e;background:#fff;padding:32px 40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2.5px solid #1e3a5f;margin-bottom:20px}
.brand{font-size:21px;font-weight:800;color:#1e3a5f;letter-spacing:-.4px}.brand span{color:#f97316}
.pm{text-align:right}.pn{font-size:15px;font-weight:700;color:#1e3a5f}.ps{font-size:10px;color:#777;margin-top:3px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;font-size:11px}
.meta div span{display:block;color:#777;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
table{width:100%;border-collapse:collapse;margin-top:6px}
thead th{background:#f0f2f6;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#555;padding:6px 8px;border-bottom:1px solid #dde;text-align:left}
tbody td{padding:6px 8px;border-bottom:1px solid #eee;font-size:10.5px}
.r{text-align:right;font-variant-numeric:tabular-nums}
.sw{margin-top:16px;border:1px solid #dde;border-radius:4px;overflow:hidden;width:260px;margin-left:auto}
.sw .row{display:flex;justify-content:space-between;padding:6px 10px;font-size:11px;border-bottom:1px solid #eee}
.sw .row:last-child{border-bottom:none;background:#1e3a5f;color:#fff;font-weight:700}
.foot{margin-top:24px;padding-top:10px;border-top:1px solid #dde;font-size:9px;color:#bbb;display:flex;justify-content:space-between}
</style></head><body>
<div class="header">
  <div><div class="brand">Build<span>Calc</span></div><div style="font-size:10px;color:#999;margin-top:3px">Subcontractor Payment Record</div></div>
  <div class="pm"><div class="pn">${esc(project.name || 'Project')}</div><div class="ps">${today}</div></div>
</div>
<div class="meta">
  <div><span>Subcontractor</span>${esc(sub ? sub.name : 'Not assigned')}${sub && sub.trade ? ` — ${esc(sub.trade)}` : ''}</div>
  <div><span>Phase</span>${esc(phaseLabel(d))}</div>
</div>
<table><thead><tr><th>Date</th><th>Note</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sw">
  <div class="row"><span>Phase Total</span><span>${fmt(total)}</span></div>
  <div class="row"><span>Paid to Date</span><span>${fmt(paid)}</span></div>
  <div class="row"><span>REMAINING</span><span>${fmt(total - paid)}</span></div>
</div>
<div class="foot"><span>BuildCalc &mdash; Payments &amp; Scheduling</span><span>This is a payment tracking record, not a financial transaction receipt.</span></div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups for this site to print the receipt.'); return; }
  w.document.write(html);
  w.document.close();
}

async function bldCopySubShareLink() {
  const d = bldPaymentsTargetDiv;
  if (!d) return;
  const row = bldGetRow('phases', d);
  if (!row.subcontractorId) { alert('Assign a subcontractor first, then you can copy their share link.'); return; }

  // Mirrors the same fix needed for Blueprint file sync: the link endpoint checks project
  // ownership against a real saved project record, so make sure one exists first.
  if (!project.id) project.id = 'proj_' + Date.now();
  // Capture the id now — if the user switches projects during the awaits below, we still want
  // this link created against the project the phase/subcontractor actually belong to.
  const projId = project.id;
  let url;
  try {
    await apiSaveProject(projId, project.name, project);
    const res = await fetch(`/api/projects/${projId}/subcontractor-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subcontractorId: row.subcontractorId }),
    });
    if (!res.ok) throw new Error();
    const { token } = await res.json();
    url = `${location.origin}/sub-view.html?token=${token}`;
  } catch (e) {
    alert('Could not create the share link. Please try again.');
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    alert('Share link copied to clipboard — send it to your subcontractor:\n\n' + url);
  } catch (e) {
    alert('Here is the share link (copy it manually):\n\n' + url);
  }
}

// ── SUBCONTRACTOR DIRECTORY MODAL ─────────────────────────────────────
function openManageSubs() {
  bldRenderManageSubsList();
  gid('manage-subs-modal').style.display = 'flex';
}

function closeManageSubs() { gid('manage-subs-modal').style.display = 'none'; }

function bldRenderManageSubsList() {
  const el = gid('manage-subs-list');
  if (!bldSubcontractors.length) {
    el.innerHTML = '<div class="bp-qty-empty" style="padding:.75rem 0">No subcontractors yet — add one below.</div>';
    return;
  }
  el.innerHTML = bldSubcontractors.map(s => `
    <div class="sub-row">
      <div class="sub-row-main">
        <strong>${esc(s.name)}</strong>${s.trade ? ` <span class="sub-row-trade">${esc(s.trade)}</span>` : ''}
      </div>
      <div class="sub-row-contact">${[s.contactPhone, s.contactEmail].filter(Boolean).map(esc).join(' · ')}</div>
      <span class="sub-row-del" title="Delete subcontractor" onclick="bldDeleteSubcontractor('${s.id}')">&#10005;</span>
    </div>`).join('');
}

async function bldAddSubcontractor() {
  const name = gid('new-sub-name').value.trim();
  if (!name) { alert('Subcontractor name is required.'); return; }
  const sub = {
    name,
    trade: gid('new-sub-trade').value.trim(),
    contactPhone: gid('new-sub-phone').value.trim(),
    contactEmail: gid('new-sub-email').value.trim(),
  };
  try {
    const created = await apiCreateSubcontractor(sub);
    bldSubcontractors.push(created);
    gid('new-sub-name').value = ''; gid('new-sub-trade').value = ''; gid('new-sub-phone').value = ''; gid('new-sub-email').value = '';
    bldRenderManageSubsList();
    if (bldPaymentsTargetDiv) bldRenderPaymentsModal();
  } catch (e) {
    alert(e.message || 'Could not add subcontractor.');
  }
}

async function bldDeleteSubcontractor(id) {
  if (!confirm('Delete this subcontractor? Phases they were assigned to will show as unassigned.')) return;
  await apiDeleteSubcontractor(id);
  bldSubcontractors = bldSubcontractors.filter(s => s.id !== id);
  bldRenderManageSubsList();
  bldRenderTable();
  if (bldPaymentsTargetDiv) bldRenderPaymentsModal();
}

// Mirrors estimatorMarkupBreakdown(), but sources Direct Cost from each phase's actual
// bldPhaseAmount() (a subcontractor's real Contract Amount where one's been entered, falling
// back to the Estimator's number otherwise) instead of the Estimator's own item costs. That
// way overriding a Contract Amount here updates this tab's own summary without ever touching
// the Estimator tab's estimate-based figures.
function bldMarkupBreakdown() {
  const rawDirect = bldPhaseDivisions().reduce((s, d) => s + bldPhaseAmount(d), 0);
  const coAmt  = rawDirect * estMu.cont / 100;
  const direct = rawDirect + coAmt;
  const ohAmt  = direct * estMu.oh / 100;
  const prAmt  = (direct + ohAmt) * estMu.profit / 100;
  const softCostsAmt = estSoftCostsTotal();
  const bid = direct + ohAmt + prAmt + softCostsAmt;
  return { rawDirect, coAmt, direct, ohAmt, prAmt, softCostsAmt, bid };
}

function getSpecData() {
  if (!project.specData) project.specData = {};
  const sd = project.specData;
  if (sd.realtorPct === undefined) sd.realtorPct = 3;
  if (sd.titlePct === undefined) sd.titlePct = 1;
  return sd;
}

// Spec-build math: unlike the Custom total above (built cost + your own markup), this treats
// the job as a spec home sold at a market Sales Price — Profit is just whatever's left after
// every real cost (land, the build itself, and selling costs) comes out of that sale price.
function bldSpecBreakdown() {
  const sd = getSpecData();
  const landCost   = parseFloat(sd.landCost) || 0;
  const salesPrice = parseFloat(sd.salesPrice) || 0;
  const realtorPct = parseFloat(sd.realtorPct) || 0;
  const titlePct   = parseFloat(sd.titlePct) || 0;
  const realtorAmt = salesPrice * realtorPct / 100;
  const titleAmt   = salesPrice * titlePct / 100;
  const { direct, softCostsAmt } = bldMarkupBreakdown();
  const totalBudget = direct + softCostsAmt;
  const profit = salesPrice - landCost - realtorAmt - titleAmt - totalBudget;
  const base = totalBudget + landCost;
  const profitPct = base > 0 ? profit / base * 100 : 0;
  return { landCost, salesPrice, realtorPct, realtorAmt, titlePct, titleAmt, totalBudget, profit, profitPct };
}

function updSpecField(field, val) {
  const sd = getSpecData();
  sd[field] = val;
  const b = bldSpecBreakdown();
  if (gid('bld-realtor-amt'))     gid('bld-realtor-amt').textContent     = fmt(b.realtorAmt);
  if (gid('bld-title-amt'))       gid('bld-title-amt').textContent       = fmt(b.titleAmt);
  if (gid('bld-spec-profit'))     gid('bld-spec-profit').textContent     = fmt(b.profit);
  if (gid('bld-spec-profit-pct')) gid('bld-spec-profit-pct').textContent = `(${b.profitPct.toFixed(1)}%)`;
  saveProject();
}

function bldCalcTotals() {
  let paidTotal = 0;
  bldPhaseDivisions().forEach(d => {
    const row = bldGetRow('phases', d);
    paidTotal += bldPhasePaidTotal(row);
  });

  let projectStart = null, projectEnd = null;
  bldPhaseDivisions().forEach(d => {
    const row = bldGetRow('phases', d);
    if (row.startDate) { const dt = new Date(row.startDate + 'T12:00:00'); if (!projectStart || dt < projectStart) projectStart = dt; }
    if (row.endDate)   { const dt = new Date(row.endDate   + 'T12:00:00'); if (!projectEnd   || dt > projectEnd)   projectEnd   = dt; }
  });
  return { projectStart, projectEnd, paidTotal };
}

function renderBudgetBuilder() {
  bldRenderTable();
  bldRenderSummary();
  apiListSubcontractors().then(() => bldRenderTable());
  const projNameEl = gid('bld-proj-name');
  if (projNameEl) projNameEl.value = project.name || 'New Project';
  bldUpdatePrintHeader();
}

function bldRenderTable() {
  let html = '';

  const phaseDivs = bldPhaseDivisions();
  html += `<tr class="bld-section-hdr"><td colspan="7">Construction Phases</td></tr>`;
  if (!phaseDivs.length) {
    html += `<tr><td colspan="7" class="bld-empty-msg">No costed items yet — push conditions or add line items in the Estimator, and they'll show up here as phases automatically.</td></tr>`;
  } else {
    phaseDivs.forEach((d, i) => {
      const row = bldGetRow('phases', d);
      const stCls = BLD_STATUS_CLASS[row.status] || 'bs-ns';
      const sub = row.subcontractorId ? bldGetSubcontractor(row.subcontractorId) : null;
      const paid = bldPhasePaidTotal(row);
      const payLabel = sub ? esc(sub.name) : (row.subcontractorId ? '(deleted subcontractor)' : '+ Assign Sub');
      const effTotal = bldPhaseAmount(d);
      const estTotal = phaseTotal(d);
      const hasContract = parseFloat(row.contractAmount) > 0;
      const payAmt = (paid > 0 || sub) ? `${fmt(paid)} / ${fmt(effTotal)}` : '';
      const phaseItems = itemsForPhase(d);
      const divTag = !isCustomPhase(d) && phaseItems.length
        ? `<span class="bld-auto-tag" title="${esc(divName(phaseItems[0].div))} — set in the Estimator">${phaseItems[0].div}</span>`
        : '';
      html += `<tr class="bld-row" data-section="phases" data-id="${d}"
        draggable="true" ondragstart="bldPhaseDragStart(event,'${d}')" ondragover="bldPhaseDragOver(event)"
        ondragleave="bldPhaseDragLeave(event)" ondrop="bldPhaseDrop(event,'${d}')" ondragend="bldPhaseDragEnd(event)">
        <td class="bld-num" title="Drag to reorder">${i + 1}</td>
        <td class="bld-label bld-label-click" title="Click to see the line items behind this total" onclick="bldOpenPhaseDetail('${d}')">${esc(phaseLabel(d))}${divTag}<button class="dni-edit bld-label-edit" title="Rename this phase" onclick="bldRenamePhase('${d}',event)">&#9998;</button>${isCustomPhase(d) ? `<button class="dni-edit bld-label-edit" title="Delete this phase" onclick="bldDeletePhase('${d}',event)">&#128465;</button>` : ''}</td>
        <td class="bld-cell bld-cost-readonly" title="${hasContract ? 'Contract amount — click to see the estimate this phase is based on' : 'Click to see the line items behind this total'}" onclick="bldOpenPhaseDetail('${d}')">
          ${fmt(effTotal)}${hasContract ? `<span class="bld-cost-est">Est. ${fmt(estTotal)}</span>` : ''}
        </td>
        <td class="bld-status-cell">
          <select class="bld-status-sel ${stCls}" onchange="bldSetStatus('phases','${d}',this.value)">
            ${BLD_STATUSES.map(s => `<option value="${s}"${row.status===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td class="bld-dur-cell">
          <input type="date" class="bld-date-inp" value="${row.startDate||''}" title="Start date"
            onchange="bldUpdateItem('phases','${d}','startDate',this.value)">
          <input type="date" class="bld-date-inp" value="${row.endDate||''}" title="End date"
            onchange="bldUpdateItem('phases','${d}','endDate',this.value)">
        </td>
        <td class="bld-note-cell">
          <input type="text" class="bld-note-inp" placeholder="Note…"
            value="${(row.note||'').replace(/"/g,'&quot;')}"
            onchange="bldUpdateItem('phases','${d}','note',this.value)">
          <button class="bld-note-expand" title="View/edit full note" onclick="bldOpenNoteModal('phases','${d}')">&#9974;</button>
        </td>
        <td class="bld-pay-cell">
          <button class="bld-pay-btn" onclick="bldOpenPaymentsModal('${d}')">
            <span class="bld-pay-sub">${payLabel}</span>
            ${payAmt ? `<span class="bld-pay-amt">${payAmt}</span>` : ''}
          </button>
        </td>
      </tr>`;
    });
  }

  gid('bld-tbody').innerHTML = html;
  bldRenderSummary();
}

function bldGanttPhases() {
  return bldPhaseDivisions().map(d => {
    const row = bldGetRow('phases', d);
    if (!row.startDate || !row.endDate) return null;
    const s = new Date(row.startDate + 'T12:00:00');
    const e = new Date(row.endDate   + 'T12:00:00');
    if (e <= s) return null;
    return { div: d, label: phaseLabel(d), status: row.status, s, e };
  }).filter(Boolean);
}

function bldSchedBars() {
  const COLOR = { 'Not Started': '#cbd5e1', 'Bid Needed': '#7c3aed', 'In Progress': '#f97316', 'Complete': '#16a34a' };
  const phases = bldGanttPhases();
  if (!phases.length) return '';
  const min = Math.min(...phases.map(p => p.s));
  const max = Math.max(...phases.map(p => p.e));
  const span = max - min;
  if (span <= 0) return '';
  const bars = phases.map(p => {
    const left  = (p.s - min) / span * 100;
    const width = Math.max((p.e - p.s) / span * 100, 1);
    return `<div class="bld-seg" style="left:${left}%;width:${width}%;background:${COLOR[p.status]||'#cbd5e1'}" title="${esc(p.label)}"></div>`;
  }).join('');
  return `<div class="bld-seg-track">${bars}</div>`;
}

function bldRenderGantt() {
  const el = gid('bld-gantt');
  if (!el) return;
  const COLOR = { 'Not Started': '#cbd5e1', 'Bid Needed': '#7c3aed', 'In Progress': '#f97316', 'Complete': '#16a34a' };

  const phases = bldGanttPhases();

  if (!phases.length) { el.classList.remove('has-data', 'open'); return; }
  const wasOpen = el.classList.contains('open');
  el.classList.add('has-data');

  const minT = Math.min(...phases.map(p => p.s.getTime()));
  const maxT = Math.max(...phases.map(p => p.e.getTime()));
  const span = maxT - minT;
  if (span <= 0) { el.classList.remove('has-data', 'open'); return; }

  const fmtShort = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtMo    = d => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

  const tickDate = new Date(minT);
  tickDate.setDate(1);
  const ticks = [];
  while (tickDate.getTime() <= maxT) {
    const pct = Math.max(0, Math.min(100, (tickDate.getTime() - minT) / span * 100));
    ticks.push({ pct, label: fmtMo(tickDate) });
    tickDate.setMonth(tickDate.getMonth() + 1);
  }

  const tickHtml = `
    <div class="bld-gantt-tick-row">
      <div></div>
      <div class="bld-gantt-tick-track">
        ${ticks.map(t => `<div class="bld-gantt-tick" style="left:${t.pct}%">${t.label}</div>`).join('')}
      </div>
    </div>`;

  bldGanttMinT = minT;
  bldGanttSpan = span;

  const rowsHtml = phases.map(p => {
    const left  = ((p.s.getTime() - minT) / span * 100).toFixed(2);
    const width = Math.max((p.e.getTime() - p.s.getTime()) / span * 100, 1).toFixed(2);
    const color = COLOR[p.status] || '#cbd5e1';
    return `
      <div class="bld-gantt-row">
        <div class="bld-gantt-lbl" title="${esc(p.label)}">${esc(p.label)}</div>
        <div class="bld-gantt-trk">
          <div class="bld-gantt-bar" style="left:${left}%;width:${width}%;background:${color}"
               title="${esc(p.label)} · ${fmtShort(p.s)} – ${fmtShort(p.e)} (drag to reschedule)"
               onmousedown="bldGanttBarMouseDown(event,'${p.div}','move')">
            <div class="bld-gantt-handle bld-gantt-handle-l" onmousedown="bldGanttBarMouseDown(event,'${p.div}','resize-left')"></div>
            <div class="bld-gantt-handle bld-gantt-handle-r" onmousedown="bldGanttBarMouseDown(event,'${p.div}','resize-right')"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  const legendHtml = Object.entries(COLOR).map(([k, v]) =>
    `<div class="bld-gantt-leg-item"><div class="bld-gantt-leg-dot" style="background:${v}"></div>${k}</div>`
  ).join('');

  el.innerHTML = `
    <div class="bld-gantt-hdr" onclick="bldToggleGantt()">
      <div class="bld-gantt-hdr-left">
        <span class="bld-gantt-hdr-title">Schedule</span>
        <span class="bld-gantt-chevron">▾</span>
      </div>
      <div class="bld-gantt-legend">${legendHtml}</div>
    </div>
    <div class="bld-gantt-area">
      ${tickHtml}
      ${rowsHtml}
    </div>`;
  if (wasOpen) el.classList.add('open');
}

function bldToggleGantt() {
  const el = gid('bld-gantt');
  if (el) el.classList.toggle('open');
}

// ── GANTT DRAG-TO-RESCHEDULE ─────────────────────────────────────────
const BLD_DAY_MS = 86400000;
let bldGanttMinT = 0, bldGanttSpan = 0;
let bldDrag = null;

function bldFmtISODate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function bldGanttBarMouseDown(e, div, mode) {
  e.preventDefault();
  e.stopPropagation();
  const bar = e.currentTarget.classList.contains('bld-gantt-bar') ? e.currentTarget : e.currentTarget.closest('.bld-gantt-bar');
  const trk = bar.closest('.bld-gantt-trk');
  const row = bldGetRow('phases', div);
  bldDrag = {
    div, mode, bar,
    startClientX: e.clientX,
    origStart: new Date(row.startDate + 'T12:00:00').getTime(),
    origEnd: new Date(row.endDate + 'T12:00:00').getTime(),
    trackWidth: trk.getBoundingClientRect().width,
    previewStart: null, previewEnd: null,
  };
  bar.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', bldGanttMouseMove);
  document.addEventListener('mouseup', bldGanttMouseUp);
}

function bldGanttMouseMove(e) {
  if (!bldDrag || !bldGanttSpan) return;
  const deltaPx = e.clientX - bldDrag.startClientX;
  const deltaMsRaw = deltaPx / bldDrag.trackWidth * bldGanttSpan;
  const deltaMs = Math.round(deltaMsRaw / BLD_DAY_MS) * BLD_DAY_MS;

  let newStart = bldDrag.origStart, newEnd = bldDrag.origEnd;
  if (bldDrag.mode === 'move') {
    newStart = bldDrag.origStart + deltaMs;
    newEnd   = bldDrag.origEnd + deltaMs;
  } else if (bldDrag.mode === 'resize-left') {
    newStart = Math.min(bldDrag.origStart + deltaMs, bldDrag.origEnd - BLD_DAY_MS);
  } else if (bldDrag.mode === 'resize-right') {
    newEnd = Math.max(bldDrag.origEnd + deltaMs, bldDrag.origStart + BLD_DAY_MS);
  }
  bldDrag.previewStart = newStart;
  bldDrag.previewEnd = newEnd;

  const left  = (newStart - bldGanttMinT) / bldGanttSpan * 100;
  const width = Math.max((newEnd - newStart) / bldGanttSpan * 100, 1);
  bldDrag.bar.style.left = left + '%';
  bldDrag.bar.style.width = width + '%';
}

function bldGanttMouseUp() {
  if (!bldDrag) return;
  const { div, previewStart, previewEnd, bar } = bldDrag;
  document.body.style.userSelect = '';
  if (bar) bar.classList.remove('dragging');
  document.removeEventListener('mousemove', bldGanttMouseMove);
  document.removeEventListener('mouseup', bldGanttMouseUp);
  bldDrag = null;

  if (previewStart != null && previewEnd != null) {
    const row = bldGetRow('phases', div);
    row.startDate = bldFmtISODate(new Date(previewStart));
    row.endDate = bldFmtISODate(new Date(previewEnd));
    saveProject();
  }
  bldRenderSummary();
}

function bldRenderSummary() {
  const { projectStart, projectEnd, paidTotal } = bldCalcTotals();
  const el = gid('bld-summary');
  if (!el) return;

  let schedHtml = '';
  if (projectStart && projectEnd) {
    const fmtD = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const weeks = Math.round((projectEnd - projectStart) / (7 * 24 * 60 * 60 * 1000));
    schedHtml = `
      <div class="bld-sum-divider"></div>
      <div class="bld-sum-sched-lbl">Schedule</div>
      <div class="bld-sum-row"><span>Start</span><span>${fmtD(projectStart)}</span></div>
      <div class="bld-sum-row"><span>Completion</span><span>${fmtD(projectEnd)}</span></div>
      <div class="bld-sum-row"><span>Total Span</span><span>~${weeks} wks</span></div>
      ${bldSchedBars()}`;
  }

  // Direct Cost (incl. Contingency) + Soft Cost = Total Budget (the real cost of the job, no
  // markup), and Profit (Overhead + Profit combined) on top of Total Budget is the bid/sales
  // price. Uses bldMarkupBreakdown(), not estimatorMarkupBreakdown() — so a Contract Amount
  // override on a phase here updates this summary live without touching the Estimator tab.
  const { direct, softCostsAmt, ohAmt, prAmt, bid } = bldMarkupBreakdown();
  const totalBudget = direct + softCostsAmt;
  const profitCombined = ohAmt + prAmt;

  const sd = getSpecData();
  const spec = bldSpecBreakdown();

  el.innerHTML = `
    <div class="bld-sum-block">
      <div class="bld-sum-sec-lbl">Custom</div>
      <div class="bld-sum-row"><span>Direct Cost</span><span>${fmt(direct)}</span></div>
      <div class="bld-sum-row"><span>Soft Cost</span><span>${fmt(softCostsAmt)}</span></div>
      <div class="bld-sum-row bld-sum-total"><span>Total Budget</span><span>${fmt(totalBudget)}</span></div>
      <div class="bld-sum-row"><span>Profit</span><span>${fmt(profitCombined)}</span></div>
      ${paidTotal > 0 ? `<div class="bld-sum-row bld-sum-paid"><span>Paid to Subs</span><span>${fmt(paidTotal)}</span></div>` : ''}
      <div class="bld-sum-row bld-sum-ref" onclick="showPage('estimator')" title="Profit + Total Budget, using each phase's real Contract Amount where set — click to view the Estimator">
        <span>Estimator Bid Price</span><span>${fmt(bid)}</span>
      </div>

      <div class="bld-sum-divider"></div>
      <div class="bld-sum-sec-lbl">Spec</div>
      <div class="bld-sum-row">
        <span>Land Cost</span>
        <input class="bld-sum-cost-inp" type="number" value="${sd.landCost || ''}" min="0" step="1000" placeholder="—" oninput="updSpecField('landCost',this.value)">
      </div>
      <div class="bld-sum-row">
        <span>Sales Price</span>
        <input class="bld-sum-cost-inp" type="number" value="${sd.salesPrice || ''}" min="0" step="1000" placeholder="—" oninput="updSpecField('salesPrice',this.value)">
      </div>
      <div class="bld-sum-row">
        <span>Realtor Fee</span>
        <span class="bld-sum-pct-wrap">
          <input class="bld-sum-pct-inp" type="number" value="${sd.realtorPct}" min="0" step="0.25" oninput="updSpecField('realtorPct',this.value)">
          <span class="bld-sum-pct-sym">%</span><span class="bld-sum-pct-amt" id="bld-realtor-amt">${fmt(spec.realtorAmt)}</span>
        </span>
      </div>
      <div class="bld-sum-row">
        <span>Title Insurance</span>
        <span class="bld-sum-pct-wrap">
          <input class="bld-sum-pct-inp" type="number" value="${sd.titlePct}" min="0" step="0.25" oninput="updSpecField('titlePct',this.value)">
          <span class="bld-sum-pct-sym">%</span><span class="bld-sum-pct-amt" id="bld-title-amt">${fmt(spec.titleAmt)}</span>
        </span>
      </div>
      <div class="bld-sum-row bld-sum-total">
        <span>Spec Profit</span>
        <span><span id="bld-spec-profit">${fmt(spec.profit)}</span> <span class="bld-sum-profit-pct" id="bld-spec-profit-pct">(${spec.profitPct.toFixed(1)}%)</span></span>
      </div>
      ${schedHtml}
    </div>`;
  bldRenderGantt();
}

function bldUpdateItem(section, id, field, val) {
  const row = bldGetRow(section, id);
  row[field] = val;
  if (field === 'combined' || field === 'startDate' || field === 'endDate') {
    bldRenderSummary();
  }
  saveProject();
}

// ── NOTE MODAL (Payments & Scheduling) — the inline field is one line, so long notes get
// cut off; this shows/edits the full text in a resizable textarea instead. ──────────────
let bldNoteModalTarget = null;

function bldOpenNoteModal(section, id) {
  bldNoteModalTarget = { section, id };
  gid('bld-note-modal-textarea').value = bldGetRow(section, id).note || '';
  gid('bld-note-modal').style.display = 'flex';
  gid('bld-note-modal-textarea').focus();
}

function closeBldNoteModal() {
  gid('bld-note-modal').style.display = 'none';
  bldNoteModalTarget = null;
}

function bldSaveNoteModal() {
  if (!bldNoteModalTarget) return;
  const { section, id } = bldNoteModalTarget;
  bldUpdateItem(section, id, 'note', gid('bld-note-modal-textarea').value);
  bldRenderTable();
  closeBldNoteModal();
}

function bldSetStatus(section, id, val) {
  const row = bldGetRow(section, id);
  row.status = val;
  const sel = document.querySelector(`.bld-row[data-section="${section}"][data-id="${id}"] .bld-status-sel`);
  if (sel) sel.className = 'bld-status-sel ' + (BLD_STATUS_CLASS[val] || 'bs-ns');
  bldRenderSummary();
  saveProject();
}

function bldSetProjName(val) {
  project.name = val.trim() || 'New Project';
  updateNavProjectName();
  saveProject();
}

function bldUpdatePrintHeader() {
  const titleEl = gid('bld-ph-title');
  const metaEl  = gid('bld-ph-meta');
  if (titleEl) titleEl.textContent = project.name || 'New Project';
  if (metaEl) {
    const parts = [];
    const { projectStart, projectEnd } = bldCalcTotals();
    if (projectStart) parts.push('Start: ' + projectStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    if (projectEnd)   parts.push('Est. Completion: ' + projectEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    metaEl.textContent = parts.join('  ·  ');
  }
}


// ── AUTH ───────────────────────────────────────────────────────────
function showAuthGate() {
  gid('auth-gate').style.display = 'flex';
  gid('auth-user-wrap').style.display = 'none';
}

function hideAuthGate() {
  gid('auth-gate').style.display = 'none';
  gid('auth-user-wrap').style.display = 'flex';
  gid('auth-user-email').textContent = currentUser.email;
}

function setAuthRole(role) {
  authRole = role;
  gid('auth-role-builder').classList.toggle('active', role === 'builder');
  gid('auth-role-client').classList.toggle('active', role === 'client');
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  const isLogin = authMode === 'login';
  gid('auth-title').textContent = isLogin ? 'Log In' : 'Sign Up';
  gid('auth-submit-btn').textContent = isLogin ? 'Log In' : 'Sign Up';
  gid('auth-switch-text').textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
  gid('auth-switch-link').textContent = isLogin ? 'Sign up' : 'Log in';
  gid('auth-err').style.display = 'none';
  gid('auth-role-toggle').style.display = isLogin ? 'none' : 'flex';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = gid('auth-email').value.trim();
  const password = gid('auth-password').value;
  const errEl = gid('auth-err');
  errEl.style.display = 'none';
  try {
    const res = await fetch(`/api/auth/${authMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: authMode === 'signup' ? authRole : undefined }),
    });
    const body = await res.json();
    if (!res.ok) { errEl.textContent = body.error || 'Something went wrong'; errEl.style.display = 'block'; return; }
    currentUser = body;
    hideAuthGate();
    enterApp();
  } catch (err) {
    errEl.textContent = 'Could not reach the server. Please try again.';
    errEl.style.display = 'block';
  }
}

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.reload();
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { showAuthGate(); return; }
    currentUser = await res.json();
    hideAuthGate();
    enterApp();
  } catch (err) {
    showAuthGate();
  }
}

function enterApp() {
  document.body.classList.remove('client-mode', 'admin-mode');
  if (currentUser.role === 'admin') {
    document.body.classList.add('admin-mode');
    gid('admin-user-email').textContent = currentUser.email;
    renderAdminDashboard();
  } else if (currentUser.role === 'client') {
    document.body.classList.add('client-mode');
    gid('client-user-email').textContent = currentUser.email;
    renderClientList();
  } else {
    init();
  }
}

// ── CLIENT DASHBOARD (read-only) ─────────────────────────────────────
async function renderClientList() {
  gid('client-detail-view').style.display = 'none';
  gid('client-list-view').style.display = 'block';
  const list = await fetch('/api/client/projects').then(r => r.ok ? r.json() : []);
  const el = gid('client-project-list');
  if (!list.length) {
    el.innerHTML = '<div class="client-empty">No projects have been shared with you yet. Ask your builder to share one.</div>';
    return;
  }
  el.innerHTML = list.map(p => `
    <div class="client-project-card" onclick="clientShowProject('${p.id}')">
      <div class="client-project-name">${esc(p.name)}</div>
      <div class="client-project-date">Updated ${new Date(p.savedAt).toLocaleDateString()}</div>
    </div>
  `).join('');
}

function clientShowList() {
  renderClientList();
}

async function clientShowProject(id) {
  const res = await fetch(`/api/client/projects/${id}`);
  if (!res.ok) { alert('Could not load this project.'); return; }
  const entry = await res.json();
  const data = entry.data;

  gid('client-list-view').style.display = 'none';
  gid('client-detail-view').style.display = 'block';
  gid('client-detail-name').textContent = data.name || 'Project';

  const bs = data.budgetSheet || {};
  const sections = ['phases'];
  const sectionLabels = { phases: 'Construction' };
  let grand = 0;
  const sectionTotals = {};

  // Construction Phases are Estimator-driven — their cost is the phase's items, not fields
  // stored on the phase row itself, so this section is computed separately. A "phase" is
  // either a single costed item (the default — divisions are no longer a grouping level) or a
  // custom phase some items were explicitly tagged into (project.customPhases / item.phaseKey).
  const customPhases = data.customPhases || {};
  const itemsForPhaseData = phaseId => {
    if (customPhases[phaseId] !== undefined) return (data.items || []).filter(i => i.phaseKey === phaseId);
    if (phaseId.startsWith('item:')) {
      const itemId = parseInt(phaseId.slice(5), 10);
      return (data.items || []).filter(i => i.id === itemId && !i.phaseKey);
    }
    return [];
  };
  const itemIdsWithCost = (data.items || []).filter(i => !i.phaseKey && i.qty * i.unitCost > 0).map(i => 'item:' + i.id);
  const customIdsWithItems = Object.keys(customPhases).filter(id => itemsForPhaseData(id).length);
  const phaseDivisions = [...itemIdsWithCost, ...customIdsWithItems];
  let phasesTotal = 0;
  phaseDivisions.forEach(d => {
    const row = (bs.phases || {})[d] || {};
    const estCost = itemsForPhaseData(d).reduce((s, i) => s + i.qty * i.unitCost, 0);
    const contractAmt = parseFloat(row.contractAmount);
    const cost = contractAmt > 0 ? contractAmt : estCost;
    phasesTotal += cost; grand += cost;
  });
  sectionTotals.phases = phasesTotal;

  gid('client-summary-grid').innerHTML = `
    <div class="client-summary-card client-summary-total">
      <div class="client-summary-lbl">Total Budget</div>
      <div class="client-summary-val">${fmt(grand)}</div>
    </div>
    ${sections.map(sec => `
      <div class="client-summary-card">
        <div class="client-summary-lbl">${sectionLabels[sec]}</div>
        <div class="client-summary-val">${fmt(sectionTotals[sec])}</div>
      </div>
    `).join('')}
  `;
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────
async function renderAdminDashboard() {
  const [stats, users, projects] = await Promise.all([
    fetch('/api/admin/stats').then(r => r.json()),
    fetch('/api/admin/users').then(r => r.json()),
    fetch('/api/admin/projects').then(r => r.json()),
  ]);

  gid('admin-stats-grid').innerHTML = `
    <div class="client-summary-card client-summary-total">
      <div class="client-summary-lbl">Total Users</div>
      <div class="client-summary-val">${stats.totalUsers}</div>
    </div>
    <div class="client-summary-card">
      <div class="client-summary-lbl">Builders</div>
      <div class="client-summary-val">${stats.builders}</div>
    </div>
    <div class="client-summary-card">
      <div class="client-summary-lbl">Clients</div>
      <div class="client-summary-val">${stats.clients}</div>
    </div>
    <div class="client-summary-card">
      <div class="client-summary-lbl">Total Projects</div>
      <div class="client-summary-val">${stats.totalProjects}</div>
    </div>
    <div class="client-summary-card">
      <div class="client-summary-lbl">Shared Projects</div>
      <div class="client-summary-val">${stats.sharedProjects}</div>
    </div>
  `;

  const usersBody = gid('admin-users-tbody');
  usersBody.innerHTML = !users.length ? '<tr class="admin-empty-row"><td colspan="5">No users yet.</td></tr>' : users.map(u => `
    <tr>
      <td>${esc(u.email)}</td>
      <td><span class="admin-role-pill ${esc(u.role)}">${esc(u.role)}</span></td>
      <td>${u.projectCount}</td>
      <td>${new Date(u.createdAt).toLocaleDateString()}</td>
      <td>${u.id === currentUser.id ? '' : `<button class="admin-del-btn" onclick="adminDeleteUser('${u.id}')">Delete</button>`}</td>
    </tr>
  `).join('');

  const projectsBody = gid('admin-projects-tbody');
  projectsBody.innerHTML = !projects.length ? '<tr class="admin-empty-row"><td colspan="5">No projects yet.</td></tr>' : projects.map(p => `
    <tr>
      <td>${esc(p.name)}</td>
      <td>${esc(p.ownerEmail || '—')}</td>
      <td>${p.clientEmail ? esc(p.clientEmail) : '—'}</td>
      <td>${new Date(p.savedAt).toLocaleDateString()}</td>
      <td><button class="admin-del-btn" onclick="adminDeleteProject('${p.id}')">Delete</button></td>
    </tr>
  `).join('');
}

async function adminDeleteUser(id) {
  if (!confirm('Delete this user and all of their projects? This cannot be undone.')) return;
  const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  if (!res.ok) { const body = await res.json().catch(() => ({})); alert(body.error || 'Could not delete user.'); return; }
  renderAdminDashboard();
}

async function adminDeleteProject(id) {
  if (!confirm('Delete this project? This cannot be undone.')) return;
  await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
  renderAdminDashboard();
}

// ── BUILDER: SHARE PROJECT WITH A CLIENT ──────────────────────────────
async function refreshShareStatus() {
  const statusEl = gid('proj-dd-share-status');
  if (!statusEl) return;
  if (!project.id || !project.name || project.name === 'New Project') {
    statusEl.textContent = 'Save this project to enable sharing';
    return;
  }
  const entry = await apiGetProject(project.id);
  statusEl.textContent = (entry && entry.clientEmail) ? `Shared with ${entry.clientEmail}` : 'Not shared with a client';
}

async function shareCurrentProject() {
  if (!project.id || !project.name || project.name === 'New Project') {
    alert('Save this project first, then you can share it with a client.');
    return;
  }
  const email = prompt('Client email to share this project with (leave blank to unshare):', '');
  if (email === null) return;
  const trimmed = email.trim();
  try {
    if (!trimmed) {
      await fetch(`${PROJECTS_API}/${project.id}/share`, { method: 'DELETE' });
    } else {
      const res = await fetch(`${PROJECTS_API}/${project.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) { const body = await res.json(); alert(body.error || 'Could not share project.'); return; }
    }
    refreshShareStatus();
  } catch (e) {
    alert('Could not reach the server.');
  }
}

// ── INIT ───────────────────────────────────────────────────────────
function init() {
  loadProject();
  // Estimator/Payments & Scheduling rendering and Blueprint restoration are independent — a
  // bug in one (e.g. an unexpected shape in older project data) must never be able to stop
  // the other from running, since that would silently hide Blueprint markups that are
  // actually saved and fine.
  try { renderAll(); } catch (e) { console.error('renderAll failed:', e); }
  try { renderBudgetBuilder(); } catch (e) { console.error('renderBudgetBuilder failed:', e); }
  bpRestoreFromProject();
  showPage('blueprint');
  updateNavProjectName();

  // The project above came from this browser's own local cache, which only reflects whatever
  // was last open here — it can go stale if the same account was used elsewhere since. Once
  // logged in, reconcile with the account's authoritative copy on the server. Guarded against
  // the user already having made an edit (or switched projects) while this fetch was in
  // flight — applying a same-vintage server copy over a newer local edit would silently
  // revert it, and a later save would then push that reverted state back to the server.
  if (project.id) {
    const idAtFetchStart = project.id;
    const snapshotAtFetchStart = JSON.stringify(project);
    apiGetProject(idAtFetchStart).then(fresh => {
      if (!fresh) return;
      if (project.id !== idAtFetchStart) return;
      if (JSON.stringify(project) !== snapshotAtFetchStart) return;
      bpApplyLoadedProject(fresh);
    });
  }
}

document.addEventListener('DOMContentLoaded', checkAuth);
window.addEventListener('afterprint', () => {
  // Force the browser to re-apply screen styles cleanly after the print dialog closes
  document.body.style.display = 'none';
  void document.body.offsetHeight;
  document.body.style.display = '';
});
