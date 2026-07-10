// ── STATE ──────────────────────────────────────────────────────────
let project = { id: 'proj_' + Date.now(), name: 'New Project', region: 'midwest', items: [], nextId: 1 };
let activeDiv = '03';
let estMu = { oh: 10, profit: 8, cont: 5, matTax: 0, permit: 1.0 };
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
function fmtC(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
function rm() { return REGION_MULT[project.region].mult; }
function divItems(d) { return project.items.filter(i => i.div === d); }
function divTotal(d) {
  const m = rm();
  return divItems(d).reduce((sum, i) => sum + i.qty * (i.unitCost * m), 0);
}
function grandTotal() {
  return Object.keys(CSI_ITEMS).reduce((sum, d) => sum + divTotal(d), 0);
}

function renderAll() { renderDivNav(); renderTable(); renderSum(); }

function renderDivNav() {
  gid('div-nav').innerHTML = Object.entries(CSI_ITEMS).map(([d, info]) => {
    const sub = divTotal(d);
    return `<div class="dni${d === activeDiv ? ' active' : ''}" onclick="setDiv('${d}')">
      <span class="dni-num">${d}</span>
      <span class="dni-name">${info.name}</span>
      ${sub > 0 ? `<span class="dni-sub">${fmt(sub)}</span>` : ''}
    </div>`;
  }).join('');
}

function renderTable() {
  gid('center-title').textContent = `Division ${activeDiv} — ${CSI_ITEMS[activeDiv].name}`;
  const items = divItems(activeDiv);
  const m = rm();

  if (!items.length) {
    gid('items-tbody').innerHTML = `<tr><td colspan="6" class="empty-msg">No items yet — add from the library or create a custom item.</td></tr>`;
    return;
  }

  gid('items-tbody').innerHTML = items.map(i => {
    const ext = i.qty * (i.unitCost * m);
    const descCell = i.custom
      ? `<input type="text" value="${i.desc.replace(/"/g, '&quot;')}" style="width:100%;border:1px solid var(--border);border-radius:4px;padding:.18rem .35rem;font-size:.8rem" onchange="updateField(${i.id},'desc',this.value)">`
      : i.desc;
    return `<tr>
      <td style="min-width:170px;font-weight:500">${descCell}</td>
      <td>${i.unit}</td>
      <td style="width:78px;text-align:right"><input class="inp-qty" type="number" value="${i.qty}" min="0" step="0.01" oninput="updQty(${i.id},this.value)"></td>
      <td style="width:88px;text-align:right"><input class="inp-cost" type="number" value="${i.unitCost}" min="0" step="0.01" oninput="updCost(${i.id},this.value)"></td>
      <td style="width:88px;text-align:right" class="ext-cost" id="ext-${i.id}">${fmt(ext)}</td>
      <td style="width:34px;text-align:center"><button class="btn btn-red" style="padding:.2rem .4rem;font-size:.72rem" onclick="delItem(${i.id})">✕</button></td>
    </tr>`;
  }).join('');
}

function renderSum() {
  const direct = grandTotal();
  const ohAmt  = direct * estMu.oh / 100;
  const prAmt  = (direct + ohAmt) * estMu.profit / 100;
  const coAmt  = (direct + ohAmt + prAmt) * estMu.cont / 100;
  const taxAmt = direct * 0.55 * estMu.matTax / 100;
  const permitAmt = (direct + ohAmt + prAmt + coAmt + taxAmt) * estMu.permit / 100;
  const bid = direct + ohAmt + prAmt + coAmt + taxAmt + permitAmt;

  let html = `<div class="sum-head">Division Subtotals</div>`;
  Object.entries(CSI_ITEMS).forEach(([d, info]) => {
    const sub = divTotal(d);
    if (sub > 0) html += `<div class="sum-row"><span class="sum-row-label">${d} ${info.name}</span><span class="sum-row-val">${fmt(sub)}</span></div>`;
  });

  html += `
    <hr class="sum-sep">
    <div class="sum-total"><span>Direct Cost</span><span>${fmt(direct)}</span></div>
    <hr class="sum-sep">
    <div class="sum-head" style="margin-top:.4rem">Markup</div>
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
    <div class="sum-mu-row">
      <span class="sum-mu-label">Contingency %</span>
      <input class="sum-pct" type="number" value="${estMu.cont}" min="0" step="0.5" oninput="updMu('cont',this.value)">
      <span class="sum-pct-sym">%</span><span class="sum-pct-amt" id="sum-co-amt">${fmt(coAmt)}</span>
    </div>
    <hr class="sum-sep" style="margin:.55rem 0">
    <div class="sum-head" style="margin-top:.2rem;font-size:.66rem;letter-spacing:.06em">Taxes &amp; Fees</div>
    <div class="sum-mu-row">
      <span class="sum-mu-label" title="Applied to ~55% of direct cost (materials portion)">Mat. Sales Tax %</span>
      <input class="sum-pct" type="number" value="${estMu.matTax}" min="0" step="0.5" oninput="updMu('matTax',this.value)">
      <span class="sum-pct-sym">%</span><span class="sum-pct-amt" id="sum-tax-amt">${taxAmt > 0 ? fmt(taxAmt) : '—'}</span>
    </div>
    <div class="sum-mu-row">
      <span class="sum-mu-label" title="Applied to total bid; typical range 0.5–2%">Permit Fees %</span>
      <input class="sum-pct" type="number" value="${estMu.permit}" min="0" step="0.25" oninput="updMu('permit',this.value)">
      <span class="sum-pct-sym">%</span><span class="sum-pct-amt" id="sum-permit-amt">${permitAmt > 0 ? fmt(permitAmt) : '—'}</span>
    </div>
    <div class="bid-box">
      <div class="bid-box-lbl">Bid Price</div>
      <div class="bid-box-val" id="sum-bid">${fmt(bid)}</div>
    </div>`;

  gid('est-sum').innerHTML = html;
  gid('top-total').textContent = fmt(bid);
}

function updMu(field, val) {
  estMu[field] = +val || 0;
  const direct = grandTotal();
  const oh  = direct * estMu.oh / 100;
  const pr  = (direct + oh) * estMu.profit / 100;
  const co  = (direct + oh + pr) * estMu.cont / 100;
  const tax = direct * 0.55 * estMu.matTax / 100;
  const permit = (direct + oh + pr + co + tax) * estMu.permit / 100;
  const bid = direct + oh + pr + co + tax + permit;
  if (gid('sum-oh-amt'))     gid('sum-oh-amt').textContent     = fmt(oh);
  if (gid('sum-pr-amt'))     gid('sum-pr-amt').textContent     = fmt(pr);
  if (gid('sum-co-amt'))     gid('sum-co-amt').textContent     = fmt(co);
  if (gid('sum-tax-amt'))    gid('sum-tax-amt').textContent    = tax > 0 ? fmt(tax) : '—';
  if (gid('sum-permit-amt')) gid('sum-permit-amt').textContent = permit > 0 ? fmt(permit) : '—';
  if (gid('sum-bid'))        gid('sum-bid').textContent        = fmt(bid);
  gid('top-total').textContent = fmt(bid);
}

function updQty(id, val) {
  const item = project.items.find(i => i.id === id);
  if (!item) return;
  item.qty = +val || 0;
  const el = gid('ext-' + id);
  if (el) el.textContent = fmt(item.qty * (item.unitCost * rm()));
  refreshTotals();
}

function updCost(id, val) {
  const item = project.items.find(i => i.id === id);
  if (!item) return;
  item.unitCost = +val || 0;
  const el = gid('ext-' + id);
  if (el) el.textContent = fmt(item.qty * (item.unitCost * rm()));
  refreshTotals();
}

function updateField(id, field, val) {
  const item = project.items.find(i => i.id === id);
  if (item) item[field] = val;
  saveProject();
}

function refreshTotals() { renderDivNav(); renderSum(); saveProject(); }

function exportEstimatePDF() {
  const m       = rm();
  const direct  = grandTotal();
  const ohAmt   = direct * estMu.oh / 100;
  const prAmt   = (direct + ohAmt) * estMu.profit / 100;
  const coAmt   = (direct + ohAmt + prAmt) * estMu.cont / 100;
  const taxAmt  = direct * 0.55 * estMu.matTax / 100;
  const permitAmt = (direct + ohAmt + prAmt + coAmt + taxAmt) * estMu.permit / 100;
  const bid     = direct + ohAmt + prAmt + coAmt + taxAmt + permitAmt;
  const retAmt  = bid * estMu.ret / 100;
  const regionLabel = (REGION_MULT[project.region] || {}).label || project.region;
  const today   = new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  let divSections = '';
  Object.entries(CSI_ITEMS).forEach(([d, info]) => {
    const items = divItems(d);
    if (!items.length) return;
    const rows = items.map(i => {
      const ext = i.qty * (i.unitCost * m);
      return `<tr>
        <td>${i.desc}</td><td class="c">${i.unit}</td>
        <td class="r">${fmtN(i.qty)}</td><td class="r">$${fmtN(i.unitCost)}</td>
        <td class="r">${fmt(ext)}</td>
      </tr>`;
    }).join('');
    divSections += `<div class="ds">
      <div class="dh">Division ${d} — ${info.name}</div>
      <table><thead><tr><th>Description</th><th class="c">Unit</th><th class="r">Qty</th><th class="r">Unit Cost</th><th class="r">Extended</th></tr></thead>
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

  const summaryRows = [
    ['Direct Cost', fmt(direct)],
    [`Overhead (${estMu.oh}%)`, fmt(ohAmt)],
    [`Profit (${estMu.profit}%)`, fmt(prAmt)],
    [`Contingency (${estMu.cont}%)`, fmt(coAmt)],
    ...(estMu.matTax > 0 ? [[`Material Sales Tax (${estMu.matTax}%)`, fmt(taxAmt)]] : []),
    ...(estMu.permit  > 0 ? [[`Permit Fees (${estMu.permit}%)`, fmt(permitAmt)]]    : []),
  ].map(([l,v]) => `<tr><td>${l}</td><td class="r">${v}</td></tr>`).join('');

  const ratesRows = [
    ['Overhead', estMu.oh + '%'],
    ['Profit', estMu.profit + '%'],
    ['Contingency', estMu.cont + '%'],
    ['Bond / Insurance', estMu.bond + '%'],
    ...(estMu.matTax > 0 ? [['Material Sales Tax', estMu.matTax + '%']] : []),
    ...(estMu.permit  > 0 ? [['Permit Fees', estMu.permit + '%']]        : []),
    ['Regional Multiplier', m.toFixed(2) + '×'],
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
  <div class="pm"><div class="pn">${project.name||'New Project'}</div><div class="ps">Region: ${regionLabel} &nbsp;|&nbsp; ${today}</div></div>
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

function delItem(id) { project.items = project.items.filter(i => i.id !== id); renderAll(); saveProject(); }
function setDiv(d) { activeDiv = d; renderAll(); }

function addLibItem(d, idx) {
  const info = CSI_ITEMS[d].items[idx];
  project.items.push({ id: project.nextId++, div: d, desc: info.desc, unit: info.unit, qty: 1, unitCost: info.cost, custom: false });
  if (activeDiv !== d) setDiv(d); else renderAll();
  saveProject();
  closeLib();
}

function addCustom() {
  project.items.push({ id: project.nextId++, div: activeDiv, desc: 'Custom Item', unit: 'EA', qty: 1, unitCost: 0, custom: true });
  renderAll();
  saveProject();
}

function toggleLib() {
  const dd = gid('lib-dd');
  if (dd.classList.contains('open')) {
    closeLib();
  } else {
    dd.classList.add('open');
    buildLibList('');
    gid('lib-search').value = '';
    gid('lib-search').focus();
  }
}
function closeLib() { gid('lib-dd').classList.remove('open'); }
function filterLib(q) { buildLibList(q); }

function buildLibList(q) {
  const ql = q.toLowerCase();
  let html = '';
  Object.entries(CSI_ITEMS).forEach(([d, info]) => {
    const filtered = info.items.filter(i => !q || i.desc.toLowerCase().includes(ql));
    if (filtered.length) {
      html += `<div class="lib-sec">${d} — ${info.name}</div>`;
      filtered.forEach(item => {
        const idx = info.items.indexOf(item);
        html += `<div class="lib-item" onclick="addLibItem('${d}',${idx})">
          <span class="li-desc">${item.desc}</span>
          <span class="li-unit">${item.unit}</span>
          <span class="li-cost">${fmtC(item.cost)}</span>
        </div>`;
      });
    }
  });
  gid('lib-list').innerHTML = html || '<div style="padding:.7rem;color:var(--muted);font-size:.8rem">No items found.</div>';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.lib-wrap')) closeLib();
  if (!e.target.closest('#proj-dd-wrap')) closeProjectsDropdown();
  if (!e.target.closest('.nav-dropdown-wrap')) closeToolsMenu();
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
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    if (bpMeasurements.length) {
      bpMeasurements.pop();
      bpRenderQtyPanel();
      bpRedraw();
    }
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
  project = { id: 'proj_' + Date.now(), name: 'New Project', region: 'midwest', items: [], nextId: 1 };
  gid('proj-name').value = 'New Project';
  gid('proj-region').value = 'midwest';
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
  project.bpState = {
    conditions: bpConditions,
    condNextId: bpCondNextId,
    activeCondId: bpActiveCondId,
    pageData: bpPageData,
    pageNum: bpPageNum,
    isImg: bpIsImg,
    zoomPct: bpZoomPct,
    fileName: gid('bp-file-lbl') ? gid('bp-file-lbl').textContent : '',
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
      gid('proj-name').value = project.name || 'New Project';
      gid('proj-region').value = project.region || 'midwest';
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

async function apiSaveProject(id, name, data) {
  try {
    await fetch(PROJECTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, data }),
    });
  } catch (e) {}
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
  await apiSaveProject(project.id, project.name, project);
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

async function switchToProject(id) {
  saveProject();
  const entry = await apiGetProject(id);
  if (!entry) return;
  bpResetAll();
  project = entry.data;
  project.id = entry.id;
  gid('proj-name').value = project.name || 'New Project';
  gid('proj-region').value = project.region || 'midwest';
  const bpn = gid('bp-proj-name');
  if (bpn) bpn.value = project.name || 'New Project';
  const bbn = gid('bld-proj-name');
  if (bbn) bbn.value = project.name || 'New Project';
  activeDiv = '03';
  renderAll();
  renderBudgetBuilder();
  try { localStorage.setItem(bcProjKey(), JSON.stringify(project)); } catch(e) {}
  updateNavProjectName();
  bpRestoreFromProject();
  closeProjectsDropdown();
}

function startNewProjectFromDD() {
  autoSaveCurrentToList();
  if (!confirm('Start a new project? Current items will be cleared.')) return;
  bpResetAll();
  project = { id: 'proj_' + Date.now(), name: 'New Project', region: 'midwest', items: [], nextId: 1 };
  gid('proj-name').value = 'New Project';
  gid('proj-region').value = 'midwest';
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
      gid('proj-name').value = project.name || 'New Project';
      gid('proj-region').value = project.region || 'midwest';
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
      <button class="proj-dd-del-btn" onclick="deleteProjectEntry('${p.id}')" title="Delete">&#10005;</button>
    </div>`;
  }).join('');
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
const BP_DEFAULT_CONDITIONS = [
  { id:  1, name: 'Slab',                  color: '#94a3b8', type: 'area',   unit: 'SF' },
  { id:  2, name: 'Framing & Cornice',     color: '#d97706', type: 'area',   unit: 'SF' },
  { id:  3, name: 'Windows',               color: '#0ea5e9', type: 'count',  unit: 'EA' },
  { id:  4, name: 'Exterior Doors',        color: '#0d9488', type: 'count',  unit: 'EA' },
  { id:  5, name: 'Roofing',               color: '#dc2626', type: 'area',   unit: 'SF' },
  { id:  6, name: 'Plumbing (Rough)',       color: '#3b82f6', type: 'linear', unit: 'LF' },
  { id:  7, name: 'Electrical (Rough)',     color: '#eab308', type: 'linear', unit: 'LF' },
  { id:  8, name: 'HVAC (Rough)',           color: '#22d3ee', type: 'linear', unit: 'LF' },
  { id:  9, name: 'Alarm System (Rough)',   color: '#fb923c', type: 'linear', unit: 'LF' },
  { id: 10, name: 'Insulation',            color: '#f472b6', type: 'area',   unit: 'SF' },
  { id: 11, name: 'Sheetrock',             color: '#e2e8f0', type: 'area',   unit: 'SF' },
  { id: 12, name: 'Trim',                  color: '#c2975f', type: 'linear', unit: 'LF' },
  { id: 13, name: 'Paint Interior',        color: '#a78bfa', type: 'area',   unit: 'SF' },
  { id: 14, name: 'Paint Exterior',        color: '#f87171', type: 'area',   unit: 'SF' },
  { id: 15, name: 'Tile',                  color: '#10b981', type: 'area',   unit: 'SF' },
  { id: 16, name: 'Cabinets',              color: '#f97316', type: 'linear', unit: 'LF' },
  { id: 17, name: 'Counters',              color: '#6366f1', type: 'linear', unit: 'LF' },
  { id: 18, name: 'Plumbing (Trim Out)',   color: '#1d4ed8', type: 'count',  unit: 'EA' },
  { id: 19, name: 'Electrical (Trim Out)', color: '#ca8a04', type: 'count',  unit: 'EA' },
  { id: 20, name: 'HVAC (Trim Out)',       color: '#0e7490', type: 'count',  unit: 'EA' },
  { id: 21, name: 'Alarm System (Trim Out)', color: '#ea580c', type: 'count', unit: 'EA' },
  { id: 22, name: 'Hardwood Floors',       color: '#92400e', type: 'area',   unit: 'SF' },
  { id: 23, name: 'Shower Glass',          color: '#67e8f9', type: 'linear', unit: 'LF' },
  { id: 24, name: 'Garage Door',           color: '#7c3aed', type: 'count',  unit: 'EA' },
  { id: 25, name: 'Appliances',            color: '#64748b', type: 'count',  unit: 'EA' },
  { id: 26, name: 'Landscape',             color: '#16a34a', type: 'area',   unit: 'SF' },
  { id: 27, name: 'Fence',                 color: '#713f12', type: 'linear', unit: 'LF' },
  { id: 28, name: 'Doorknobs',             color: '#fbbf24', type: 'count',  unit: 'EA' },
  { id: 29, name: 'Cabinet Hardware',      color: '#9ca3af', type: 'count',  unit: 'EA' },
  { id: 30, name: 'Light Fixtures',        color: '#fde047', type: 'count',  unit: 'EA' },
  { id: 31, name: 'Fans',                  color: '#4ade80', type: 'count',  unit: 'EA' },
  { id: 32, name: 'Faucets',               color: '#c084fc', type: 'count',  unit: 'EA' },
];
let bpConditions = BP_DEFAULT_CONDITIONS.map(c => ({ ...c }));
let bpCondNextId = 33;
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

function bpRestoreFromProject() {
  const state = project.bpState;
  // Restore conditions immediately — don't gate on file existence
  if (state) {
    if (state.conditions)   bpConditions   = state.conditions;
    if (state.condNextId)   bpCondNextId   = state.condNextId;
    if (state.activeCondId) bpActiveCondId = state.activeCondId;
  }
  bpRenderConditions();
  bpUpdateActiveIndicator();
  if (!state || !project.id) return;
  bpLoadStoredFile(project.id).then(stored => {
    if (!stored) return;
    bpPageData = state.pageData || {};
    bpZoomPct  = state.zoomPct  || 100;
    bpIsImg    = state.isImg    || false;
    bpPageNum  = state.pageNum  || 1;
    const zSlider = gid('bp-zoom'), zInp = gid('bp-zoom-inp');
    if (zSlider) zSlider.value = bpZoomPct;
    if (zInp) zInp.value = bpZoomPct;
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
  }).catch(() => {});
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
  bpCondNextId = 33; bpActiveCondId = 1;
  const trashBtnReset = gid('bp-trash-btn'); if (trashBtnReset) trashBtnReset.classList.remove('active');
  const hideBtnReset = gid('bp-hide-btn'); if (hideBtnReset) hideBtnReset.classList.remove('active-hide');
  const upload = gid('bp-upload'), wrap = gid('bp-canvas-wrap');
  if (upload) upload.style.display = '';
  if (wrap) wrap.style.display = 'none';
  const fileLbl = gid('bp-file-lbl');
  if (fileLbl) { fileLbl.style.display = 'none'; fileLbl.textContent = ''; }
  const fileInput = gid('bp-file-input');
  if (fileInput) fileInput.value = '';
  const zSlider = gid('bp-zoom'), zInp = gid('bp-zoom-inp');
  if (zSlider) zSlider.value = 100;
  if (zInp) zInp.value = 100;
  bpUpdateScaleBadge();
  bpRenderConditions();
  bpRenderQtyPanel();
  bpUpdateActiveIndicator();
}

function bpGetCond(id) { return bpConditions.find(c => c.id === id); }
function bpGetActiveCond() { return bpGetCond(bpActiveCondId); }

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

function bpDeleteCond(id) {
  if (!confirm('Delete this condition and all its measurements?')) return;
  bpConditions = bpConditions.filter(c => c.id !== id);
  bpMeasurements = bpMeasurements.filter(m => m.condId !== id);
  if (bpActiveCondId === id) bpActiveCondId = bpConditions.length ? bpConditions[0].id : null;
  bpRenderConditions();
  bpUpdateActiveIndicator();
  bpRenderQtyPanel();
  bpRedraw();
}

function bpToggleCondVis(id) {
  const c = bpGetCond(id);
  if (!c) return;
  c.hidden = !c.hidden;
  bpRenderConditions();
  bpRedraw();
  saveProject();
}

function bpCondMeasurements(condId) { return bpMeasurements.filter(m => m.condId === condId); }

function bpCondTotal(condId) {
  return bpCondMeasurements(condId).reduce((s, m) => s + m.value, 0);
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
    const count = bpCondMeasurements(c.id).length;
    return `<div class="bp-qty-row">
      <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.25rem">
        <span style="width:10px;height:10px;border-radius:2px;background:${c.color};display:inline-block;flex-shrink:0"></span>
        <span style="font-weight:600;font-size:.82rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
      </div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:.35rem">
        <span style="font-size:1.05rem;font-weight:700;color:var(--navy)">${fmtN(Math.round(total * 10) / 10)} <span style="font-size:.74rem;font-weight:400;color:var(--muted)">${c.unit}</span></span>
        <span style="font-size:.72rem;color:var(--muted)">${count} item${count !== 1 ? 's' : ''}</span>
      </div>
      <button class="to-send-btn" onclick="bpSendCondToEst(${c.id})">→ Send to Estimator</button>
    </div>`;
  }).join('<hr style="border:none;border-top:1px solid var(--border);margin:.5rem 0">');
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
  gid('modal-div').innerHTML = Object.entries(CSI_ITEMS)
    .map(([d, info]) => `<option value="${d}"${d === guessedDiv ? ' selected' : ''}>${d} — ${info.name}</option>`)
    .join('');
  bpModalPickDiv(guessedDiv);
  gid('modal-desc').value = existing ? existing.desc : cond.name;
  gid('modal-cost').value = existing ? existing.unitCost : '';
  gid('send-modal').style.display = 'flex';
}

function bpModalPickDiv(d) {
  gid('modal-lib').innerHTML = CSI_ITEMS[d].items.map((li, idx) => `
    <div class="modal-lib-item" id="mli-${idx}" onclick="bpModalPickLib('${d}',${idx})">
      <span class="modal-lib-name">${li.desc}</span>
      <span class="modal-lib-cost">${li.unit} &mdash; ${fmtC(li.cost)}</span>
    </div>`).join('');
  gid('modal-cost').value = '';
  gid('modal-lib').querySelectorAll('.modal-lib-item').forEach(el => el.classList.remove('selected'));
}

function bpModalPickLib(d, idx) {
  const li = CSI_ITEMS[d].items[idx];
  gid('modal-desc').value = li.desc;
  gid('modal-cost').value = li.cost;
  gid('modal-lib').querySelectorAll('.modal-lib-item').forEach((el, i) => el.classList.toggle('selected', i === idx));
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
    const divOpts = Object.entries(CSI_ITEMS).map(([d, info]) => `<option value="${d}"${d === guessed ? ' selected' : ''}>${d} — ${info.name}</option>`).join('');
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
        <input type="number" min="0" step="0.01" value="${bpPaRows[i].cost}" id="pa-cost-${i}" onchange="bpPaRows[${i}].cost=+this.value" style="width:76px;font-size:.83rem;padding:.22rem .4rem;border:1px solid var(--border);border-radius:4px">
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
  }

  const fileLbl = gid('bp-file-lbl');
  if (fileLbl) { fileLbl.textContent = file.name; fileLbl.style.display = 'inline'; }
  bpIsImg = file.type.startsWith('image/');

  if (bpIsImg) {
    const imgReader = new FileReader();
    imgReader.onload = ie => {
      const dataUrl = ie.target.result;
      bpStoreFile(project.id, { type: 'image', dataUrl, fileName: file.name });
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
      bpStoreFile(project.id, { type: 'pdf', data: ab.slice(0), fileName: file.name });
      pdfjsLib.getDocument({ data: ab }).promise.then(pdf => {
        bpPdf = pdf;
        bpPageCount = pdf.numPages;
        bpPageNum = 1;
        bpShowCanvas();
        bpRenderPage();
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
  const slider = gid('bp-zoom'); if (slider) slider.value = pct;
  const inp = gid('bp-zoom-inp'); if (inp) inp.value = pct;
  if (bpIsImg && bpImg) bpRenderImg(); else bpRenderPage();
}
function bpZoom(pct) { bpSetZoom(pct); }

function bpPrevPage() {
  if (bpPageNum <= 1) return;
  bpSavePage();
  bpPageNum--;
  gid('bp-page-lbl').textContent = `${bpPageNum} / ${bpPageCount}`;
  bpLoadPage();
  bpRenderPage();
}
function bpNextPage() {
  if (bpPageNum >= bpPageCount) return;
  bpSavePage();
  bpPageNum++;
  gid('bp-page-lbl').textContent = `${bpPageNum} / ${bpPageCount}`;
  bpLoadPage();
  bpRenderPage();
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
        bpScalePxPerFt = px / +ans;
      }
      bpScalePts = [];
      bpScaleMode = false;
      bpUpdateScaleBadge();
      const c = gid('markup-canvas');
      if (c) c.style.cursor = 'crosshair';
    }
    return;
  }

  const cond = bpGetActiveCond();
  if (!cond) return;

  if (cond.type === 'count') {
    bpMeasurements.push({ id: bpMeasNextId++, condId: cond.id, type: 'count', pts: [bpCanvasXY(e)], value: 1 });
    bpRenderQtyPanel();
    bpRedraw();
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

function bpMouseMove(e) {
  if (bpSpaceDown) return;
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

  bpMeasurements.push({ id: bpMeasNextId++, condId: cond.id, type: cond.type, pts, value: Math.round(value * 10) / 10 });
  bpCurrentPts = [];
  bpRenderQtyPanel();
  bpRedraw();
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
const BLD_PHASES = [
  { id: 'demo',       label: 'Demo / Site Prep' },
  { id: 'excavation', label: 'Excavation & Earthwork' },
  { id: 'foundation', label: 'Foundation & Concrete' },
  { id: 'framing',    label: 'Framing' },
  { id: 'roofing',    label: 'Roofing' },
  { id: 'envelope',   label: 'Windows, Doors & Exterior' },
  { id: 'plumbing_r', label: 'Rough Plumbing' },
  { id: 'hvac_r',     label: 'Rough HVAC / Mechanical' },
  { id: 'elec_r',     label: 'Rough Electrical' },
  { id: 'insulation', label: 'Insulation' },
  { id: 'drywall',    label: 'Drywall' },
  { id: 'tile_paint', label: 'Tile & Paint' },
  { id: 'millwork',   label: 'Millwork & Cabinets' },
  { id: 'plumbing_f', label: 'Finish Plumbing & Fixtures' },
  { id: 'hvac_f',     label: 'Finish HVAC & Controls' },
  { id: 'elec_f',     label: 'Finish Electrical & Lighting' },
  { id: 'flooring',   label: 'Flooring' },
  { id: 'appliances', label: 'Appliances & Equipment' },
  { id: 'exterior',   label: 'Exterior & Flatwork' },
];

const BLD_OVERHEAD = [
  { id: 'taxes',       label: 'Taxes' },
  { id: 'loan',        label: 'Bank Loan Interest' },
  { id: 'insurance',   label: 'Insurance' },
  { id: 'contingency', label: 'Contingency' },
];

const BLD_SOFT = [
  { id: 'permits',    label: 'Permits & Fees' },
  { id: 'architect',  label: 'Architect / Designer' },
  { id: 'geotech',    label: 'Geotech / Survey' },
  { id: 'struct',     label: 'Structural Engineer' },
  { id: 'consultant', label: 'Project Consultant' },
];

const BLD_OTHER = [
  { id: 'tips',        label: 'Tips / Gratuity' },
  { id: 'trash',       label: 'Trash / Dumpster' },
  { id: 'maids',       label: 'Final Cleaning' },
  { id: 'pole',        label: 'Electrical Pole / Temp Power' },
  { id: 'fence',       label: 'Temporary Fence' },
  { id: 'toilet',      label: 'Portable Toilet' },
  { id: 'inspections', label: 'Third Party Inspections' },
];

const BLD_STATUSES = ['Not Started', 'Bid Needed', 'In Progress', 'Complete'];
const BLD_STATUS_CLASS = { 'Not Started': 'bs-ns', 'Bid Needed': 'bs-bid', 'In Progress': 'bs-ip', 'Complete': 'bs-cp' };

function getBudgetSheet() {
  if (!project.budgetSheet) {
    project.budgetSheet = {
      buildType: 'custom',
      stories: '1',
      phases: {},
      overhead: {},
      soft: {},
      other: {},
    };
  }
  return project.budgetSheet;
}

function bldGetRow(section, id) {
  const bs = getBudgetSheet();
  if (!bs[section][id]) bs[section][id] = { mat: '', labor: '', combined: '', startDate: '', endDate: '', status: 'Not Started', byOthers: false, note: '' };
  return bs[section][id];
}

function bldCalcTotals() {
  const bs = getBudgetSheet();
  const sections = ['phases', 'overhead', 'soft', 'other'];
  let grand = 0, byOthersTotal = 0;
  const sectionTotals = {};
  sections.forEach(sec => {
    let t = 0;
    Object.values(bs[sec] || {}).forEach(row => {
      const mat = parseFloat(row.mat) || 0;
      const labor = parseFloat(row.labor) || 0;
      const combined = parseFloat(row.combined) || (mat + labor);
      if (row.byOthers) { byOthersTotal += combined; } else { t += combined; grand += combined; }
    });
    sectionTotals[sec] = t;
  });
  let projectStart = null, projectEnd = null;
  BLD_PHASES.forEach(ph => {
    const row = bldGetRow('phases', ph.id);
    if (row.startDate) { const d = new Date(row.startDate + 'T12:00:00'); if (!projectStart || d < projectStart) projectStart = d; }
    if (row.endDate)   { const d = new Date(row.endDate   + 'T12:00:00'); if (!projectEnd   || d > projectEnd)   projectEnd   = d; }
  });
  return { grand, byOthersTotal, sectionTotals, projectStart, projectEnd };
}

function renderBudgetBuilder() {
  const bs = getBudgetSheet();
  bldRenderTable();
  bldRenderSummary();
  // Restore build type toggle
  const bt = bs.buildType || 'custom';
  document.querySelectorAll('[data-bt]').forEach(b => b.classList.toggle('active', b.dataset.bt === bt));
  // Restore stories toggle
  const stories = String(bs.stories || '1');
  ['bld-s1','bld-s2','bld-s3'].forEach((id, i) => {
    const btn = gid(id);
    if (btn) btn.classList.toggle('active', String(i + 1) === stories);
  });
  const projNameEl = gid('bld-proj-name');
  if (projNameEl) projNameEl.value = project.name || 'New Project';
  // Restore project type select
  const ptEl = gid('bld-proj-type');
  if (ptEl) ptEl.value = bs.projectType || 'residential';
  bldUpdatePrintHeader();
}

function bldRenderTable() {
  const bs = getBudgetSheet();
  let html = '';

  const renderSection = (title, sectionKey, items, startNum, hasDuration) => {
    html += `<tr class="bld-section-hdr"><td colspan="9">${title}</td></tr>`;
    items.forEach((item, i) => {
      const row = bldGetRow(sectionKey, item.id);
      const num = startNum !== null ? (startNum + i) : '';
      const matV  = row.mat      || '';
      const labV  = row.labor    || '';
      const combV = row.combined || '';
      const stCls = BLD_STATUS_CLASS[row.status] || 'bs-ns';
      const byOCls = row.byOthers ? ' by-others' : '';
      const durCell = hasDuration
        ? `<td class="bld-dur-cell">
            <input type="date" class="bld-date-inp" value="${row.startDate||''}" title="Start date"
              onchange="bldUpdateItem('${sectionKey}','${item.id}','startDate',this.value)">
            <input type="date" class="bld-date-inp" value="${row.endDate||''}" title="End date"
              onchange="bldUpdateItem('${sectionKey}','${item.id}','endDate',this.value)">
           </td>`
        : `<td class="bld-dur-cell"></td>`;
      html += `<tr class="bld-row${byOCls}" data-section="${sectionKey}" data-id="${item.id}">
        <td class="bld-num">${num}</td>
        <td class="bld-label">${item.label}</td>
        <td class="bld-cell"><input type="number" min="0" step="100" placeholder="—"
          value="${matV}"
          onchange="bldUpdateItem('${sectionKey}','${item.id}','mat',this.value)"
          class="bld-inp"></td>
        <td class="bld-cell"><input type="number" min="0" step="100" placeholder="—"
          value="${labV}"
          onchange="bldUpdateItem('${sectionKey}','${item.id}','labor',this.value)"
          class="bld-inp"></td>
        <td class="bld-cell"><input type="number" min="0" step="100" placeholder="—"
          value="${combV}"
          onchange="bldUpdateItem('${sectionKey}','${item.id}','combined',this.value)"
          class="bld-inp bld-combined-inp"></td>
        <td class="bld-status-cell">
          <select class="bld-status-sel ${stCls}" onchange="bldSetStatus('${sectionKey}','${item.id}',this.value)">
            ${BLD_STATUSES.map(s => `<option value="${s}"${row.status===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        ${durCell}
        <td class="bld-bo-cell">
          <label class="bld-bo-tgl" title="By Others — tracked but excluded from your total">
            <input type="checkbox" onchange="bldToggleByOthers('${sectionKey}','${item.id}',this.checked)"${row.byOthers?' checked':''}>
            <span class="bld-bo-chk"></span>
          </label>
        </td>
        <td class="bld-note-cell">
          <input type="text" class="bld-note-inp" placeholder="Note…"
            value="${(row.note||'').replace(/"/g,'&quot;')}"
            onchange="bldUpdateItem('${sectionKey}','${item.id}','note',this.value)">
        </td>
      </tr>`;
    });
  };

  renderSection('Construction Phases', 'phases', BLD_PHASES, 1, true);
  renderSection('Overhead', 'overhead', BLD_OVERHEAD, null, false);
  renderSection('Soft Costs', 'soft', BLD_SOFT, null, false);
  renderSection('Other', 'other', BLD_OTHER, null, false);

  gid('bld-tbody').innerHTML = html;
  bldRenderSummary();
}

function bldSchedBars() {
  const COLOR = { 'Not Started': '#cbd5e1', 'Bid Needed': '#7c3aed', 'In Progress': '#f97316', 'Complete': '#16a34a' };
  const phases = BLD_PHASES.map(ph => {
    const row = bldGetRow('phases', ph.id);
    if (!row.startDate || !row.endDate) return null;
    const s = new Date(row.startDate + 'T12:00:00');
    const e = new Date(row.endDate   + 'T12:00:00');
    if (e <= s) return null;
    return { label: ph.label, status: row.status, s, e };
  }).filter(Boolean);
  if (!phases.length) return '';
  const min = Math.min(...phases.map(p => p.s));
  const max = Math.max(...phases.map(p => p.e));
  const span = max - min;
  if (span <= 0) return '';
  const bars = phases.map(p => {
    const left  = (p.s - min) / span * 100;
    const width = Math.max((p.e - p.s) / span * 100, 1);
    return `<div class="bld-seg" style="left:${left}%;width:${width}%;background:${COLOR[p.status]||'#cbd5e1'}" title="${p.label}"></div>`;
  }).join('');
  return `<div class="bld-seg-track">${bars}</div>`;
}

function bldRenderGantt() {
  const el = gid('bld-gantt');
  if (!el) return;
  const COLOR = { 'Not Started': '#cbd5e1', 'Bid Needed': '#7c3aed', 'In Progress': '#f97316', 'Complete': '#16a34a' };

  const phases = BLD_PHASES.map(ph => {
    const row = bldGetRow('phases', ph.id);
    if (!row.startDate || !row.endDate) return null;
    const s = new Date(row.startDate + 'T12:00:00');
    const e = new Date(row.endDate   + 'T12:00:00');
    if (e <= s) return null;
    return { label: ph.label, status: row.status, s, e };
  }).filter(Boolean);

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

  const rowsHtml = phases.map(p => {
    const left  = ((p.s.getTime() - minT) / span * 100).toFixed(2);
    const width = Math.max((p.e.getTime() - p.s.getTime()) / span * 100, 1).toFixed(2);
    const color = COLOR[p.status] || '#cbd5e1';
    return `
      <div class="bld-gantt-row">
        <div class="bld-gantt-lbl" title="${p.label}">${p.label}</div>
        <div class="bld-gantt-trk">
          <div class="bld-gantt-bar" style="left:${left}%;width:${width}%;background:${color}"
               title="${p.label} · ${fmtShort(p.s)} – ${fmtShort(p.e)}"></div>
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

function bldRenderSummary() {
  const { grand, byOthersTotal, sectionTotals, projectStart, projectEnd } = bldCalcTotals();
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

  el.innerHTML = `
    <div class="bld-sum-block">
      <div class="bld-sum-row"><span>Construction</span><span>${fmt(sectionTotals.phases||0)}</span></div>
      <div class="bld-sum-row"><span>Overhead</span><span>${fmt(sectionTotals.overhead||0)}</span></div>
      <div class="bld-sum-row"><span>Soft Costs</span><span>${fmt(sectionTotals.soft||0)}</span></div>
      <div class="bld-sum-row"><span>Other</span><span>${fmt(sectionTotals.other||0)}</span></div>
      <div class="bld-sum-divider"></div>
      <div class="bld-sum-row bld-sum-total"><span>Total Budget</span><span>${fmt(grand)}</span></div>
      ${byOthersTotal ? `<div class="bld-sum-row bld-sum-bo"><span>By Others</span><span>${fmt(byOthersTotal)}</span></div>` : ''}
      ${schedHtml}
    </div>`;
  bldRenderGantt();
}

function bldUpdateItem(section, id, field, val) {
  const row = bldGetRow(section, id);
  row[field] = val;
  const tr = document.querySelector(`.bld-row[data-section="${section}"][data-id="${id}"]`);
  if (field === 'mat' || field === 'labor') {
    const row2 = bldGetRow(section, id);
    if (!row2.combined) {
      const sum = (parseFloat(row2.mat) || 0) + (parseFloat(row2.labor) || 0);
      if (sum > 0) {
        row2.combined = String(sum);
        const combInp = tr && tr.querySelector('.bld-combined-inp');
        if (combInp) combInp.value = sum;
      }
    }
  }
  if (field === 'mat' || field === 'labor' || field === 'combined' || field === 'startDate' || field === 'endDate') {
    bldRenderSummary();
  }
  saveProject();
}

function bldSetStatus(section, id, val) {
  const row = bldGetRow(section, id);
  row.status = val;
  const sel = document.querySelector(`.bld-row[data-section="${section}"][data-id="${id}"] .bld-status-sel`);
  if (sel) sel.className = 'bld-status-sel ' + (BLD_STATUS_CLASS[val] || 'bs-ns');
  bldRenderSummary();
  saveProject();
}

function bldToggleByOthers(section, id, checked) {
  const row = bldGetRow(section, id);
  row.byOthers = checked;
  const tr = document.querySelector(`.bld-row[data-section="${section}"][data-id="${id}"]`);
  if (tr) tr.classList.toggle('by-others', checked);
  bldRenderSummary();
  saveProject();
}

function bldSetProjName(val) {
  project.name = val.trim() || 'New Project';
  updateNavProjectName();
  saveProject();
}

function bldSetBuildType(val) {
  getBudgetSheet().buildType = val;
  document.querySelectorAll('[data-bt]').forEach(b => b.classList.toggle('active', b.dataset.bt === val));
  bldUpdatePrintHeader();
  saveProject();
}

function bldSetStories(val) {
  getBudgetSheet().stories = String(val);
  ['bld-s1','bld-s2','bld-s3'].forEach((id, i) => {
    const btn = gid(id);
    if (btn) btn.classList.toggle('active', (i + 1) === +val);
  });
  bldUpdatePrintHeader();
  saveProject();
}

function bldUpdatePrintHeader() {
  const bs = getBudgetSheet();
  const typeLabels = { residential: 'Residential', commercial: 'Commercial', industrial: 'Industrial', multifamily: 'Multifamily' };
  const titleEl = gid('bld-ph-title');
  const metaEl  = gid('bld-ph-meta');
  if (titleEl) titleEl.textContent = project.name || 'New Project';
  if (metaEl) {
    const parts = [];
    if (bs.projectType) parts.push(typeLabels[bs.projectType] || bs.projectType);
    if (bs.buildType)   parts.push(bs.buildType.charAt(0).toUpperCase() + bs.buildType.slice(1));
    if (bs.stories)     parts.push(bs.stories === '3' ? '3+ Stories' : bs.stories + (bs.stories === '1' ? ' Story' : ' Stories'));
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
  const sections = ['phases', 'overhead', 'soft', 'other'];
  const sectionLabels = { phases: 'Construction', overhead: 'Overhead', soft: 'Soft Costs', other: 'Other' };
  let grand = 0;
  const sectionTotals = {};
  sections.forEach(sec => {
    let t = 0;
    Object.values(bs[sec] || {}).forEach(row => {
      const mat = parseFloat(row.mat) || 0;
      const labor = parseFloat(row.labor) || 0;
      const combined = parseFloat(row.combined) || (mat + labor);
      if (!row.byOthers) { t += combined; grand += combined; }
    });
    sectionTotals[sec] = t;
  });

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
  renderAll();
  renderBudgetBuilder();
  bpRestoreFromProject();
  showPage('blueprint');
  updateNavProjectName();
}

document.addEventListener('DOMContentLoaded', checkAuth);
window.addEventListener('afterprint', () => {
  // Force the browser to re-apply screen styles cleanly after the print dialog closes
  document.body.style.display = 'none';
  void document.body.offsetHeight;
  document.body.style.display = '';
});
