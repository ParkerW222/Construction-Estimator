// ── STATE ──────────────────────────────────────────────────────────
let project = { name: 'New Project', region: 'midwest', items: [], nextId: 1 };
let activeDiv = '03';
let estMu = { oh: 10, profit: 8, cont: 5 };
let bType = 'office', bQual = 'standard';
let sType = 'office', sQual = 'standard';
let bidCount = 3;

// ── UTILITIES ──────────────────────────────────────────────────────
function gid(id) { return document.getElementById(id); }

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
  gid('nl-' + p).classList.add('active');
  if (p === 'changes') renderCOPage();
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
  const ohAmt = direct * estMu.oh / 100;
  const prAmt = (direct + ohAmt) * estMu.profit / 100;
  const coAmt = (direct + ohAmt + prAmt) * estMu.cont / 100;
  const bid = direct + ohAmt + prAmt + coAmt;

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
  const oh = direct * estMu.oh / 100;
  const pr = (direct + oh) * estMu.profit / 100;
  const co = (direct + oh + pr) * estMu.cont / 100;
  const bid = direct + oh + pr + co;
  const ohEl = gid('sum-oh-amt'), prEl = gid('sum-pr-amt');
  const coEl = gid('sum-co-amt'), bidEl = gid('sum-bid');
  if (ohEl) ohEl.textContent = fmt(oh);
  if (prEl) prEl.textContent = fmt(pr);
  if (coEl) coEl.textContent = fmt(co);
  if (bidEl) bidEl.textContent = fmt(bid);
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

document.addEventListener('click', e => { if (!e.target.closest('.lib-wrap')) closeLib(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && bpCurrentPts.length) {
    bpCurrentPts = [];
    bpRedraw();
  }
});

function newProject() {
  if (!confirm('Start a new project? Current items will be cleared.')) return;
  project = { name: 'New Project', region: 'midwest', items: [], nextId: 1, changeOrders: [], nextCoId: 1, rfis: [], nextRfiId: 1, submittals: [], nextSubId: 1 };
  gid('proj-name').value = 'New Project';
  gid('proj-region').value = 'midwest';
  activeDiv = '03';
  renderAll();
  renderCOPage();
  renderRFIPane();
  renderSubPane();
  saveProject();
}

function saveProject() {
  try { localStorage.setItem('bc_proj', JSON.stringify(project)); } catch (e) {}
}

function loadProject() {
  try {
    const s = localStorage.getItem('bc_proj');
    if (s) {
      project = JSON.parse(s);
      gid('proj-name').value = project.name || 'New Project';
      gid('proj-region').value = project.region || 'midwest';
    }
  } catch (e) {}
  project.changeOrders = project.changeOrders || [];
  project.nextCoId    = project.nextCoId    || 1;
  project.rfis        = project.rfis        || [];
  project.nextRfiId   = project.nextRfiId   || 1;
  project.submittals  = project.submittals  || [];
  project.nextSubId   = project.nextSubId   || 1;
}

// ── BUDGET CALCULATOR ──────────────────────────────────────────────
function pickBType(el, t) {
  bType = t;
  el.closest('.type-grid').querySelectorAll('.q-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  calcBudget();
}

function pickBQual(el, q) {
  bQual = q;
  el.closest('.type-grid').querySelectorAll('.q-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  calcBudget();
}

function calcBudget() {
  const sf = +(gid('b-sqft').value) || 0;
  if (!sf) return;
  const stories = Math.min(+(gid('b-stories').value) || 1, 7);
  const rmv = REGION_MULT[gid('b-region').value].mult;
  const qm = B_QUAL[bQual];
  const sm = B_STORY[Math.min(stories - 1, 6)];
  const base = B_BASE[bType];
  const lo = base.lo * sf * rmv * qm * sm;
  const hi = base.hi * sf * rmv * qm * sm;
  const mid = (lo + hi) / 2;
  const lr = base.lr;

  gid('b-results').style.display = 'block';
  gid('b-range').textContent = `${fmt(lo)} – ${fmt(hi)}`;
  gid('b-psf').textContent = `${fmtC((lo / sf + hi / sf) / 2)} / SF`;
  gid('b-sadj').textContent = `+${((sm - 1) * 100).toFixed(0)}% for ${stories} ${stories === 1 ? 'story' : 'stories'}`;
  gid('b-lbar').style.width = (lr * 100) + '%';
  gid('b-lpct').textContent = (lr * 100).toFixed(0) + '%';
  gid('b-mpct').textContent = ((1 - lr) * 100).toFixed(0) + '%';
  gid('b-lamt').textContent = fmtN(mid * lr);
  gid('b-mamt').textContent = fmtN(mid * (1 - lr));
  gid('b-csi').innerHTML = B_DIV.map(d => `
    <div class="csi-row">
      <span class="csi-name">${d.n}</span>
      <div class="csi-bar-wrap"><div class="csi-bar-fill" style="width:${(d.w / 0.18) * 100}%"></div></div>
      <span class="csi-pct">${(d.w * 100).toFixed(0)}%</span>
      <span class="csi-amt">${fmt(mid * d.w)}</span>
    </div>`).join('');
}

// ── SCHEDULE ESTIMATOR ─────────────────────────────────────────────
function pickSType(el, t) {
  sType = t;
  el.closest('.type-grid').querySelectorAll('.q-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  autoSched();
}

function pickSQual(el, q) {
  sQual = q;
  el.closest('.type-grid').querySelectorAll('.q-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  autoSched();
}

function autoSched() {
  const sf = +(gid('s-sqft').value) || 0;
  const sdVal = gid('s-start').value;
  if (!sf || !sdVal) return;

  const stories = Math.min(+(gid('s-stories').value) || 1, 7);
  const base = S_BASE[sType];
  const qm = S_QUAL[sQual];
  const sm = S_STORY[Math.min(stories - 1, 6)];
  const sfm = sf < 5000 ? 0.8 : sf < 20000 ? 1 : sf < 50000 ? 1.15 : sf < 100000 ? 1.3 : 1.45;
  const wks = Math.round(((base.lo + base.hi) / 2) * qm * sm * sfm);

  const start = new Date(sdVal + 'T12:00:00');
  function addW(d, w) { const r = new Date(d); r.setDate(r.getDate() + w * 7); return r; }
  function fmtD(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

  const end = addW(start, wks);
  const final = addW(end, 2);

  gid('s-summary').style.display = 'block';
  gid('s-gantt-card').style.display = 'block';
  gid('s-dur').textContent = wks + ' weeks';
  gid('s-start-lbl').textContent = fmtD(start);
  gid('s-end').textContent = fmtD(end);
  gid('s-final').textContent = fmtD(final);

  let cum = 0;
  const cols = '200px 1fr 58px';
  let html = `<div class="gantt-hdr" style="grid-template-columns:${cols}"><span>Phase</span><span>Timeline</span><span style="text-align:right">Dur.</span></div>`;
  S_PHASES.forEach(ph => {
    const phWks = Math.round(wks * ph.pct);
    html += `<div class="gantt-row" style="grid-template-columns:${cols}">
      <span class="gantt-label">${ph.name}</span>
      <div class="gantt-track"><div class="gantt-bar" style="left:${cum * 100}%;width:${ph.pct * 100}%"></div></div>
      <span class="gantt-dur">${phWks}w</span>
    </div>`;
    cum += ph.pct;
  });
  gid('s-gantt').innerHTML = html;
}

// ── BID COMPARISON ─────────────────────────────────────────────────
function renderBidCards() {
  const n = bidCount;
  gid('bid-cards').style.gridTemplateColumns = n <= 3 ? `repeat(${n},1fr)` : 'repeat(3,1fr)';
  gid('bid-cards').innerHTML = Array.from({ length: n }, (_, i) => `
    <div class="bid-card" style="border-top-color:${BID_COLORS[i]}">
      <h3 style="color:${BID_COLORS[i]}">Bidder ${i + 1}</h3>
      <label class="fl">Company Name</label>
      <input type="text" id="bn-${i}" placeholder="Contractor name" style="width:100%;border:1.5px solid var(--border);border-radius:6px;padding:.45rem .6rem;font-size:.84rem;margin-bottom:.6rem">
      <label class="fl">Bid Amount ($)</label>
      <input type="number" id="ba-${i}" placeholder="0" oninput="analyzeBids()" style="width:100%;border:1.5px solid var(--border);border-radius:6px;padding:.45rem .6rem;font-size:.84rem;margin-bottom:.6rem">
      <label class="fl">Notes</label>
      <input type="text" id="bnote-${i}" placeholder="Exceptions, qualifications…" style="width:100%;border:1.5px solid var(--border);border-radius:6px;padding:.45rem .6rem;font-size:.84rem">
    </div>`).join('');
  gid('bid-analysis').style.display = 'none';
}

function analyzeBids() {
  const bids = [];
  for (let i = 0; i < bidCount; i++) {
    const a = +(gid('ba-' + i).value) || 0;
    const n = gid('bn-' + i).value || `Bidder ${i + 1}`;
    if (a > 0) bids.push({ i, name: n, amt: a });
  }
  if (bids.length < 2) { gid('bid-analysis').style.display = 'none'; return; }

  bids.sort((a, b) => a.amt - b.amt);
  const lo = bids[0].amt, hi = bids[bids.length - 1].amt;
  const avg = bids.reduce((s, b) => s + b.amt, 0) / bids.length;
  const spread = (hi - lo) / lo * 100;
  const spreadLbl = spread < 5 ? 'Tight (<5%)' : spread < 15 ? 'Normal (5–15%)' : spread < 30 ? 'Wide (15–30%)' : 'Very Wide (>30%)';

  gid('bid-analysis').style.display = 'block';
  gid('ba-low').textContent = fmt(lo);
  gid('ba-high').textContent = fmt(hi);
  gid('ba-avg').textContent = fmt(Math.round(avg));
  gid('ba-spread').textContent = spread.toFixed(1) + '%';
  gid('ba-spread-lbl').textContent = spreadLbl;

  const eng = +(gid('bid-est').value) || 0;
  if (eng > 0) {
    gid('ba-est-col').style.display = 'block';
    gid('ba-eng').textContent = fmt(eng);
    const diff = (lo - eng) / eng * 100;
    gid('ba-vs-est').textContent = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '% vs. estimate';
  } else {
    gid('ba-est-col').style.display = 'none';
  }

  gid('bid-rank').innerHTML = bids.map((b, r) => `
    <div class="rank-card${r === 0 ? ' r1' : ''}">
      <div class="rank-num">#${r + 1}${r === 0 ? ' — LOW BID' : ''}</div>
      <div class="rank-name">${b.name}</div>
      <div class="rank-price">${fmt(b.amt)}</div>
      ${r > 0 ? `<div class="rank-diff">+${fmt(b.amt - lo)} above low</div>` : ''}
    </div>`).join('');
}

// ── MARKUP & OVERHEAD ──────────────────────────────────────────────
function switchTab(btn, paneId) {
  gid('pg-markup').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  gid('pg-markup').querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  gid(paneId).classList.add('active');
}

function calcMarkup() {
  const labor = +(gid('mu-labor').value) || 0;
  const mat   = +(gid('mu-mat').value)   || 0;
  const sub   = +(gid('mu-sub').value)   || 0;
  const equip = +(gid('mu-equip').value) || 0;
  const direct = labor + mat + sub + equip;

  const oh     = +(gid('mu-oh').value)     || 0;
  const profit = +(gid('mu-profit').value) || 0;
  const cont   = +(gid('mu-cont').value)   || 0;
  const bond   = +(gid('mu-bond').value)   || 0;

  const ohA  = direct * oh / 100;
  const prA  = (direct + ohA) * profit / 100;
  const coA  = (direct + ohA + prA) * cont / 100;
  const boA  = (direct + ohA + prA + coA) * bond / 100;
  const total = direct + ohA + prA + coA + boA;

  gid('mu-r-direct').textContent = fmt(direct);
  gid('mu-r-oh').textContent     = fmt(ohA);
  gid('mu-r-profit').textContent = fmt(prA);
  gid('mu-r-cont').textContent   = fmt(coA);
  gid('mu-r-bond').textContent   = fmt(boA);
  gid('mu-r-total').textContent  = fmt(total);
  if (direct > 0) {
    gid('mu-r-mu').textContent = ((total / direct - 1) * 100).toFixed(1) + '%';
    gid('mu-r-mg').textContent = ((1 - direct / total) * 100).toFixed(1) + '%';
  }
}

function calcBurden() {
  const wage = +(gid('lb-wage').value) || 0;
  const hrs  = +(gid('lb-hrs').value)  || 2080;
  const r = (
    parseFloat(gid('lb-fica').value || 0) +
    parseFloat(gid('lb-futa').value || 0) +
    parseFloat(gid('lb-wc').value   || 0) +
    parseFloat(gid('lb-gl').value   || 0) +
    parseFloat(gid('lb-ben').value  || 0)
  ) / 100;
  const burdened = wage * (1 + r);

  gid('lb-r-base').textContent        = fmtC(wage) + '/hr';
  gid('lb-r-burden').textContent      = fmtC(wage * r) + '/hr';
  gid('lb-r-rate').textContent        = (r * 100).toFixed(1) + '%';
  gid('lb-r-total').textContent       = fmtC(burdened) + ' / hr';
  gid('lb-r-annual').textContent      = fmt(burdened * hrs);
  gid('lb-r-base-annual').textContent = fmt(wage * hrs);
}

// ── BLUEPRINT TAKEOFF ──────────────────────────────────────────────
let bpConditions = [
  { id: 1, name: 'Concrete Slab', color: '#f97316', type: 'area',   unit: 'SF' },
  { id: 2, name: 'Exterior Wall', color: '#1e3a5f', type: 'linear', unit: 'LF' },
  { id: 3, name: 'Door',          color: '#7c3aed', type: 'count',  unit: 'EA' },
];
let bpCondNextId = 4;
let bpActiveCondId = 1;
let bpMeasurements = [];
let bpMeasNextId = 1;
let bpNewCondType = 'linear';
let bpNewCondColor = BP_COLORS[0];
let bpPdf = null, bpPageNum = 1, bpPageCount = 0, bpZoomPct = 100;
let bpScalePxPerFt = null, bpScalePts = [], bpScaleMode = false;
let bpCurrentPts = [];
let bpIsImg = false, bpImg = null;

function bpGetCond(id) { return bpConditions.find(c => c.id === id); }
function bpGetActiveCond() { return bpGetCond(bpActiveCondId); }

function bpSelectCond(id) {
  bpActiveCondId = id;
  bpCurrentPts = [];
  bpScaleMode = false;
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
    <div class="bp-cond-item${c.id === bpActiveCondId ? ' active' : ''}" onclick="bpSelectCond(${c.id})">
      <span style="width:12px;height:12px;border-radius:3px;background:${c.color};flex-shrink:0;display:inline-block"></span>
      <span style="flex:1;font-size:.82rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</span>
      <span style="font-size:.72rem;color:rgba(255,255,255,.5);flex-shrink:0">${c.unit}</span>
      <button onclick="event.stopPropagation();bpDeleteCond(${c.id})" title="Delete" style="background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:.75rem;padding:0 0 0 .3rem;line-height:1">✕</button>
    </div>`).join('');
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
  const form = gid('bp-add-cond-form');
  if (form) { form.style.display = 'block'; gid('bpnc-name').focus(); }
  bpNewCondType = 'linear';
  bpNewCondColor = BP_COLORS[0];
  bpSyncTypeButtons();
  bpRenderColorPicker();
}

function bpHideAddCond() {
  const form = gid('bp-add-cond-form');
  if (form) form.style.display = 'none';
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
  el.innerHTML = BP_COLORS.map(c => `
    <div class="bp-color-dot${c === bpNewCondColor ? ' sel' : ''}" style="background:${c}" onclick="bpSelectNewColor('${c}')"></div>`).join('');
}

function bpConfirmAddCond() {
  const name = (gid('bpnc-name').value || '').trim();
  if (!name) { gid('bpnc-name').focus(); return; }
  const unit = bpNewCondType === 'area' ? 'SF' : bpNewCondType === 'linear' ? 'LF' : 'EA';
  bpConditions.push({ id: bpCondNextId, name, color: bpNewCondColor, type: bpNewCondType, unit });
  bpActiveCondId = bpCondNextId;
  bpCondNextId++;
  gid('bpnc-name').value = '';
  bpHideAddCond();
  bpRenderConditions();
  bpUpdateActiveIndicator();
  bpRenderQtyPanel();
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

function bpSendCondToEst(condId) {
  const cond = bpGetCond(condId);
  if (!cond) return;
  bpPendingCondId = condId;
  const total = bpCondTotal(condId);
  gid('modal-meas-lbl').textContent = `${cond.name} — ${fmtN(Math.round(total * 10) / 10)} ${cond.unit}`;
  gid('modal-div').innerHTML = Object.entries(CSI_ITEMS)
    .map(([d, info]) => `<option value="${d}"${d === activeDiv ? ' selected' : ''}>${d} — ${info.name}</option>`)
    .join('');
  gid('modal-desc').value = cond.name;
  gid('modal-cost').value = '';
  bpModalPickDiv(activeDiv);
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
  project.items.push({ id: project.nextId++, div, desc, unit: cond.unit, qty: Math.round(total * 10) / 10, unitCost: cost, custom: true });
  saveProject();
  bpModalClose();
  activeDiv = div;
  showPage('estimator');
  renderAll();
}

function bpModalClose() { gid('send-modal').style.display = 'none'; bpPendingCondId = null; }

// ── PUSH ALL TO ESTIMATOR ─────────────────────────────────────────
let bpPaRows = [];

function bpPushAllToEst() {
  if (!bpConditions.length) { alert('No conditions to push.'); return; }
  bpPaRows = bpConditions.map(c => ({ condId: c.id, div: activeDiv, cost: 0 }));
  const tbody = gid('push-all-rows');
  const divOpts = Object.entries(CSI_ITEMS).map(([d, info]) => `<option value="${d}"${d === activeDiv ? ' selected' : ''}>${d} — ${info.name}</option>`).join('');
  tbody.innerHTML = bpConditions.map((c, i) => {
    const total = bpCondTotal(c.id);
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
        <input type="number" min="0" step="0.01" value="0" id="pa-cost-${i}" onchange="bpPaRows[${i}].cost=+this.value" style="width:76px;font-size:.83rem;padding:.22rem .4rem;border:1px solid var(--border);border-radius:4px">
      </td>
    </tr>`;
  }).join('');
  gid('push-all-modal').style.display = 'flex';
}

function bpPushAllConfirm() {
  bpConditions.forEach((c, i) => {
    const total = bpCondTotal(c.id);
    if (total <= 0 && c.type !== 'count') return;
    const row = bpPaRows[i];
    project.items.push({ id: project.nextId++, div: row.div, desc: c.name, unit: c.unit, qty: Math.round(total * 10) / 10, unitCost: row.cost, custom: true });
  });
  saveProject();
  bpClosePushAll();
  showPage('estimator');
  renderAll();
}

function bpClosePushAll() { gid('push-all-modal').style.display = 'none'; }

// ── BLUEPRINT CANVAS / RENDER ─────────────────────────────────────
function bpLoadFile(input) {
  const file = input.files[0];
  if (!file) return;
  bpIsImg = file.type.startsWith('image/');

  if (bpIsImg) {
    const url = URL.createObjectURL(file);
    bpImg = new Image();
    bpImg.onload = () => { bpPageCount = 1; bpPageNum = 1; bpShowCanvas(); bpRenderImg(); };
    bpImg.src = url;
  } else {
    if (typeof pdfjsLib === 'undefined') { alert('PDF.js failed to load. Check your internet connection.'); return; }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const reader = new FileReader();
    reader.onload = e => {
      pdfjsLib.getDocument({ data: e.target.result }).promise.then(pdf => {
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

function bpRenderPage() {
  if (!bpPdf) return;
  bpPdf.getPage(bpPageNum).then(page => {
    const viewport = page.getViewport({ scale: bpZoomPct / 100 * 1.5 });
    const pdfC = gid('pdf-canvas'), mkC = gid('markup-canvas');
    pdfC.width = mkC.width = viewport.width;
    pdfC.height = mkC.height = viewport.height;
    page.render({ canvasContext: pdfC.getContext('2d'), viewport }).promise.then(() => bpRedraw());
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

function bpZoom(pct) {
  bpZoomPct = pct;
  gid('bp-zoom-lbl').textContent = pct + '%';
  if (bpIsImg && bpImg) bpRenderImg(); else bpRenderPage();
}

function bpPrevPage() {
  if (bpPageNum > 1) { bpPageNum--; gid('bp-page-lbl').textContent = `${bpPageNum} / ${bpPageCount}`; bpRenderPage(); }
}
function bpNextPage() {
  if (bpPageNum < bpPageCount) { bpPageNum++; gid('bp-page-lbl').textContent = `${bpPageNum} / ${bpPageCount}`; bpRenderPage(); }
}

function bpSetScale() {
  bpScalePts = [];
  bpScaleMode = true;
  bpCurrentPts = [];
  const c = gid('markup-canvas');
  if (c) c.style.cursor = 'crosshair';
  alert("Click point A on the drawing, then click point B. You'll be asked for the real-world distance.");
}

function bpCanvasXY(e) {
  const r = gid('markup-canvas').getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function bpClick(e) {
  if (bpScaleMode) {
    const pt = bpCanvasXY(e);
    bpScalePts.push(pt);
    if (bpScalePts.length === 1) { bpRedraw(); return; }
    if (bpScalePts.length === 2) {
      const dx = bpScalePts[1].x - bpScalePts[0].x;
      const dy = bpScalePts[1].y - bpScalePts[0].y;
      const px = Math.sqrt(dx * dx + dy * dy);
      const ans = prompt('Distance between the two points (in feet):');
      if (ans && +ans > 0) {
        bpScalePxPerFt = px / +ans;
        const badge = gid('bp-scale-badge');
        badge.textContent = `Scale: 1 ft = ${bpScalePxPerFt.toFixed(1)} px`;
        badge.className = 'scale-badge';
      }
      bpScalePts = [];
      bpScaleMode = false;
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
  if (!bpCurrentPts.length && !bpScaleMode) return;
  bpRedraw();
  const pt = bpCanvasXY(e);
  const ctx = gid('markup-canvas').getContext('2d');
  const cond = bpGetActiveCond();
  const color = cond ? cond.color : '#f97316';

  if (bpScaleMode && bpScalePts.length === 1) {
    ctx.save();
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(bpScalePts[0].x, bpScalePts[0].y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
    ctx.restore();
  }

  if (bpCurrentPts.length) {
    const last = bpCurrentPts[bpCurrentPts.length - 1];
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
    ctx.restore();
  }
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

  bpMeasurements.forEach(m => {
    const cond = bpGetCond(m.condId);
    if (!cond) return;
    const color = cond.color;
    const unit = m.type === 'linear' ? (bpScalePxPerFt ? 'LF' : 'px') : (bpScalePxPerFt ? 'SF' : 'px²');
    ctx.save();

    if (m.type === 'linear') {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      m.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.stroke();
      m.pts.forEach(p => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      });
      const mid = m.pts[Math.floor(m.pts.length / 2)];
      ctx.fillStyle = color; ctx.font = 'bold 11px sans-serif'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${m.value} ${unit}`, mid.x + 5, mid.y - 5);

    } else if (m.type === 'area') {
      ctx.fillStyle = color + '33'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      m.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      const cx = m.pts.reduce((s, p) => s + p.x, 0) / m.pts.length;
      const cy = m.pts.reduce((s, p) => s + p.y, 0) / m.pts.length;
      ctx.fillStyle = color; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${m.value} ${unit}`, cx, cy);

    } else if (m.type === 'count') {
      ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(m.pts[0].x, m.pts[0].y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✓', m.pts[0].x, m.pts[0].y);
    }
    ctx.restore();
  });

  if (bpScalePts.length === 1) {
    ctx.save();
    ctx.fillStyle = '#f97316';
    ctx.beginPath(); ctx.arc(bpScalePts[0].x, bpScalePts[0].y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (bpCurrentPts.length) {
    const cond = bpGetActiveCond();
    const color = cond ? cond.color : '#f97316';
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    bpCurrentPts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    ctx.globalAlpha = 1;
    bpCurrentPts.forEach(p => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
}

function bpClearAll() {
  if (bpMeasurements.length && !confirm('Clear all measurements? Conditions will be kept.')) return;
  bpMeasurements = [];
  bpCurrentPts = [];
  bpRedraw();
  bpRenderQtyPanel();
}

// ── CHANGE ORDERS ─────────────────────────────────────────────────
function getBidPrice() {
  const direct = grandTotal();
  const oh = direct * estMu.oh / 100;
  const pr = (direct + oh) * estMu.profit / 100;
  const co = (direct + oh + pr) * estMu.cont / 100;
  return direct + oh + pr + co;
}

function renderCOPage() {
  const base      = getBidPrice();
  const approved  = project.changeOrders.filter(c => c.status === 'approved');
  const pending   = project.changeOrders.filter(c => c.status === 'pending');
  const appTotal  = approved.reduce((s, c) => s + c.cost, 0);
  const penTotal  = pending.reduce((s, c) => s + c.cost, 0);
  const revised   = base + appTotal;

  const bEl = gid('co-base');        if (bEl) bEl.textContent = fmt(base);
  const aEl = gid('co-approved-amt'); if (aEl) aEl.textContent = (appTotal >= 0 ? '+' : '') + fmt(appTotal);
  const acEl = gid('co-approved-count'); if (acEl) acEl.textContent = approved.length + ' approved';
  const rEl = gid('co-revised');      if (rEl) rEl.textContent = fmt(revised);
  const pEl = gid('co-pending-amt');  if (pEl) pEl.textContent = (penTotal >= 0 ? '+' : '') + fmt(penTotal);
  const pcEl = gid('co-pending-count'); if (pcEl) pcEl.textContent = pending.length + ' awaiting approval';

  const tbody = gid('co-tbody');
  if (!tbody) return;
  if (!project.changeOrders.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1.5rem;font-size:.83rem">No change orders yet. Click <strong>+ Add Change Order</strong> to begin.</td></tr>`;
    return;
  }
  tbody.innerHTML = project.changeOrders.map(c => `
    <tr>
      <td style="white-space:nowrap;font-weight:700">${c.num}</td>
      <td style="white-space:nowrap;color:var(--muted)">${c.date}</td>
      <td>
        <strong style="font-size:.85rem">${c.desc}</strong>
        ${c.scope ? `<div style="font-size:.75rem;color:var(--muted);margin-top:.1rem">${c.scope}</div>` : ''}
      </td>
      <td style="text-align:right;font-weight:700;font-size:.95rem;color:${c.cost >= 0 ? '#16a34a' : '#dc2626'};white-space:nowrap">
        ${c.cost >= 0 ? '+' : ''}${fmt(c.cost)}
      </td>
      <td><span class="st-badge st-${c.status}">${coLabel(c.status)}</span></td>
      <td style="white-space:nowrap">
        <select onchange="updateCOStatus(${c.id},this.value)" style="font-size:.75rem;border:1px solid var(--border);border-radius:4px;padding:.15rem .3rem;margin-right:.25rem">
          <option value="pending"${c.status==='pending'?' selected':''}>Pending</option>
          <option value="approved"${c.status==='approved'?' selected':''}>Approved</option>
          <option value="rejected"${c.status==='rejected'?' selected':''}>Rejected</option>
        </select>
        <button onclick="deleteCO(${c.id})" title="Delete" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.85rem;line-height:1;padding:.1rem .2rem">✕</button>
      </td>
    </tr>`).join('');
}

function coLabel(s) { return s === 'approved' ? 'Approved' : s === 'rejected' ? 'Rejected' : 'Pending'; }

function showAddCOForm() {
  gid('co-add-form').style.display = 'block';
  const t = new Date();
  gid('co-f-date').value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  gid('co-f-desc').focus();
}
function hideAddCOForm() {
  gid('co-add-form').style.display = 'none';
  ['co-f-desc','co-f-scope','co-f-cost'].forEach(id => { const el = gid(id); if (el) el.value = ''; });
}
function submitCO() {
  const desc = (gid('co-f-desc').value || '').trim();
  if (!desc) { gid('co-f-desc').focus(); return; }
  const id = project.nextCoId++;
  project.changeOrders.push({
    id,
    num:   'CO-' + String(id).padStart(3, '0'),
    date:  gid('co-f-date').value || '—',
    desc,
    scope: (gid('co-f-scope').value || '').trim(),
    cost:  +(gid('co-f-cost').value) || 0,
    status: 'pending',
  });
  saveProject();
  hideAddCOForm();
  renderCOPage();
}
function deleteCO(id) {
  if (!confirm('Delete this change order?')) return;
  project.changeOrders = project.changeOrders.filter(c => c.id !== id);
  saveProject();
  renderCOPage();
}
function updateCOStatus(id, status) {
  const c = project.changeOrders.find(c => c.id === id);
  if (c) { c.status = status; saveProject(); renderCOPage(); }
}

// ── PROJECT LOGS ──────────────────────────────────────────────────
function switchLogsTab(btn, paneId) {
  gid('pg-logs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  gid('pg-logs').querySelectorAll('.tab-pane').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
  btn.classList.add('active');
  const pane = gid(paneId);
  pane.classList.add('active');
  pane.style.display = 'block';
}

// RFI
function renderRFIPane() {
  const tbody = gid('rfi-tbody');
  if (!tbody) return;
  if (!project.rfis.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:1.5rem;font-size:.83rem">No RFIs logged yet. Click <strong>+ Log RFI</strong> to begin.</td></tr>`;
    return;
  }
  tbody.innerHTML = project.rfis.map(r => `
    <tr>
      <td style="white-space:nowrap;font-weight:700">${r.num}</td>
      <td style="white-space:nowrap;color:var(--muted)">${r.date}</td>
      <td><strong style="font-size:.85rem">${r.desc}</strong></td>
      <td>${r.sentTo || '—'}</td>
      <td style="white-space:nowrap;color:${r.dueDate ? 'var(--text)' : 'var(--muted)'}">${r.dueDate || '—'}</td>
      <td><span class="st-badge st-${r.status}">${rfiLabel(r.status)}</span></td>
      <td style="white-space:nowrap">
        <select onchange="updateRFIStatus(${r.id},this.value)" style="font-size:.75rem;border:1px solid var(--border);border-radius:4px;padding:.15rem .3rem;margin-right:.25rem">
          <option value="open"${r.status==='open'?' selected':''}>Open</option>
          <option value="answered"${r.status==='answered'?' selected':''}>Answered</option>
          <option value="hold"${r.status==='hold'?' selected':''}>On Hold</option>
        </select>
        <button onclick="deleteRFI(${r.id})" title="Delete" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.85rem;line-height:1;padding:.1rem .2rem">✕</button>
      </td>
    </tr>`).join('');
}
function rfiLabel(s) { return s === 'answered' ? 'Answered' : s === 'hold' ? 'On Hold' : 'Open'; }

function showAddRFIForm() {
  gid('rfi-add-form').style.display = 'block';
  const t = new Date();
  gid('rfi-f-date').value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  gid('rfi-f-desc').focus();
}
function hideAddRFIForm() {
  gid('rfi-add-form').style.display = 'none';
  ['rfi-f-desc','rfi-f-sentto','rfi-f-due'].forEach(id => { const el = gid(id); if (el) el.value = ''; });
}
function submitRFI() {
  const desc = (gid('rfi-f-desc').value || '').trim();
  if (!desc) { gid('rfi-f-desc').focus(); return; }
  const id = project.nextRfiId++;
  project.rfis.push({
    id,
    num:     'RFI-' + String(id).padStart(3, '0'),
    date:    gid('rfi-f-date').value || '—',
    desc,
    sentTo:  (gid('rfi-f-sentto').value || '').trim(),
    dueDate: gid('rfi-f-due').value || '',
    status:  'open',
  });
  saveProject();
  hideAddRFIForm();
  renderRFIPane();
}
function deleteRFI(id) {
  if (!confirm('Delete this RFI?')) return;
  project.rfis = project.rfis.filter(r => r.id !== id);
  saveProject();
  renderRFIPane();
}
function updateRFIStatus(id, status) {
  const r = project.rfis.find(r => r.id === id);
  if (r) { r.status = status; saveProject(); renderRFIPane(); }
}

// Submittals
function renderSubPane() {
  const tbody = gid('sub-tbody');
  if (!tbody) return;
  if (!project.submittals.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:1.5rem;font-size:.83rem">No submittals logged yet. Click <strong>+ Log Submittal</strong> to begin.</td></tr>`;
    return;
  }
  const subLabel = s => ({'pending':'Pending','approved':'Approved','approved-noted':'Approved as Noted','revise':'Revise & Resubmit','rejected':'Rejected'}[s] || s);
  tbody.innerHTML = project.submittals.map(s => `
    <tr>
      <td style="white-space:nowrap;font-weight:700">${s.num}</td>
      <td style="font-size:.78rem;color:var(--muted)">${s.spec || '—'}</td>
      <td><strong style="font-size:.85rem">${s.desc}</strong></td>
      <td>${s.submittedBy || '—'}</td>
      <td style="white-space:nowrap;color:var(--muted)">${s.date || '—'}</td>
      <td><span class="st-badge st-${s.status}">${subLabel(s.status)}</span></td>
      <td style="white-space:nowrap">
        <select onchange="updateSubStatus(${s.id},this.value)" style="font-size:.75rem;border:1px solid var(--border);border-radius:4px;padding:.15rem .3rem;margin-right:.25rem">
          <option value="pending"${s.status==='pending'?' selected':''}>Pending</option>
          <option value="approved"${s.status==='approved'?' selected':''}>Approved</option>
          <option value="approved-noted"${s.status==='approved-noted'?' selected':''}>Approved as Noted</option>
          <option value="revise"${s.status==='revise'?' selected':''}>Revise &amp; Resubmit</option>
          <option value="rejected"${s.status==='rejected'?' selected':''}>Rejected</option>
        </select>
        <button onclick="deleteSub(${s.id})" title="Delete" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.85rem;line-height:1;padding:.1rem .2rem">✕</button>
      </td>
    </tr>`).join('');
}

function showAddSubForm() {
  const specEl = gid('sub-f-spec');
  if (specEl && specEl.options.length <= 1) {
    Object.entries(CSI_ITEMS).forEach(([d, info]) => {
      const opt = document.createElement('option');
      opt.value = `Div ${d} — ${info.name}`;
      opt.textContent = `${d} — ${info.name}`;
      specEl.appendChild(opt);
    });
  }
  gid('sub-add-form').style.display = 'block';
  const t = new Date();
  gid('sub-f-date').value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  gid('sub-f-desc').focus();
}
function hideAddSubForm() {
  gid('sub-add-form').style.display = 'none';
  ['sub-f-desc','sub-f-by'].forEach(id => { const el = gid(id); if (el) el.value = ''; });
}
function submitSub() {
  const desc = (gid('sub-f-desc').value || '').trim();
  if (!desc) { gid('sub-f-desc').focus(); return; }
  const id = project.nextSubId++;
  project.submittals.push({
    id,
    num:         'SUB-' + String(id).padStart(3, '0'),
    spec:        gid('sub-f-spec').value || '',
    desc,
    submittedBy: (gid('sub-f-by').value || '').trim(),
    date:        gid('sub-f-date').value || '—',
    status:      'pending',
  });
  saveProject();
  hideAddSubForm();
  renderSubPane();
}
function deleteSub(id) {
  if (!confirm('Delete this submittal?')) return;
  project.submittals = project.submittals.filter(s => s.id !== id);
  saveProject();
  renderSubPane();
}
function updateSubStatus(id, status) {
  const s = project.submittals.find(s => s.id === id);
  if (s) { s.status = status; saveProject(); renderSubPane(); }
}

// ── INIT ───────────────────────────────────────────────────────────
(function init() {
  const t = new Date();
  gid('s-start').value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  loadProject();
  renderAll();
  calcBudget();
  autoSched();
  calcMarkup();
  calcBurden();
  renderBidCards();
  bpRenderConditions();
  bpUpdateActiveIndicator();
  bpRenderQtyPanel();
  bpRenderColorPicker();
  bpSyncTypeButtons();
  renderCOPage();
  renderRFIPane();
  renderSubPane();
})();
