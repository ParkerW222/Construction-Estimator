# BuildCalc — Codebase Documentation

## Overview

BuildCalc is a single HTML file (`index.html`) that runs entirely in the browser with no server, no database, and no external dependencies except PDF.js (loaded from a CDN for the Blueprint tool). Everything — the layout, styles, data, and logic — lives in one file.

---

## File Structure

```
index.html
  ├── <style>        All CSS styles
  ├── <body>
  │    ├── <nav>     Top navigation bar
  │    ├── #pg-estimator    Page 1: Project Estimator
  │    ├── #pg-budget       Page 2: Budget Calculator
  │    ├── #pg-schedule     Page 3: Schedule Estimator
  │    ├── #pg-bids         Page 4: Bid Comparison
  │    ├── #pg-markup       Page 5: Markup & Overhead
  │    └── #pg-blueprint    Page 6: Blueprint Takeoff
  └── <script>       All JavaScript (data + functions)
```

---

## How the SPA (Single-Page Application) Works

All six pages exist in the HTML at the same time. CSS hides them with `display:none` by default. When you click a nav link, `showPage('name')` runs — it removes the `.active` class from the current page, then adds it to the new one. CSS then shows that page with `display:block` (or `display:flex` for the full-height pages).

```
.page         { display: none }       ← hidden by default
.page.active  { display: block }      ← shown when active
```

The one exception: the Estimator and Blueprint pages use `display:flex` (not block) because they need a side-by-side panel layout, so they get their own override rule:
```
#pg-estimator.active { display: flex }
#pg-blueprint.active { display: flex }
```

---

## Design System

All colors and sizes are defined as CSS custom properties (variables) at the top of the `<style>` block:

| Variable       | Value     | Usage                          |
|----------------|-----------|--------------------------------|
| `--navy`       | `#1e3a5f` | Primary color, headers, nav    |
| `--navy-d`     | `#162e4d` | Darker navy (estimator sidebar)|
| `--orange`     | `#f97316` | Accent, buttons, highlights    |
| `--bg`         | `#f0f4f8` | Page background (light gray)   |
| `--surface`    | `#ffffff` | Card/panel backgrounds         |
| `--border`     | `#e2e8f0` | Borders, dividers              |
| `--muted`      | `#64748b` | Secondary text, labels         |

Using variables means you can change the entire color scheme by editing six lines.

---

## Utility Functions

These are used everywhere across all tools:

```javascript
gid(id)      // shorthand for document.getElementById(id)
fmt(n)       // formats a number as currency: $1,234 or $1.23M
fmtC(n)      // formats with cents: $8.50
fmtN(n)      // formats as plain number with commas: 10,000
```

---

## Tool 1: Project Estimator (`#pg-estimator`)

**What it does:** Line-item cost estimator organized by CSI MasterFormat divisions. You pick items from a library (or add custom ones), enter quantities, and it calculates costs adjusted for your region.

### Layout
Three fixed panels side by side:
- **Left (192px):** Division nav — the 15 CSI divisions as a clickable list
- **Center (flex):** Line item table for the active division
- **Right (262px):** Summary panel with markup inputs and bid price

### Key Data

**`CSI_ITEMS`** — the item library. An object keyed by division number. Each division has a `name` and an array of `items`, each with a description, unit, and base unit cost (RSMeans-style national average).

```javascript
CSI_ITEMS['03'] = {
  name: 'Concrete',
  items: [
    { desc: 'Slab on grade, 4" thick', unit: 'SF', cost: 8.50 },
    ...
  ]
}
```

**`REGION_MULT`** — regional cost multipliers. Each of 13 US regions has a multiplier (e.g., 1.45× for New York, 0.85× for Southeast). The multiplier is applied to every unit cost at calculation time — the stored `unitCost` is always the national base price.

**`project`** — the live state object saved to `localStorage`:
```javascript
project = {
  name: 'New Project',
  region: 'midwest',
  items: [],    // all line items across all divisions
  nextId: 1     // auto-incrementing ID for new items
}
```

Each item in `project.items` looks like:
```javascript
{ id: 5, div: '03', desc: 'Slab on grade, 4"', unit: 'SF', qty: 5000, unitCost: 8.50, custom: false }
```

**`estMu`** — the markup percentages stored separately from `project`:
```javascript
estMu = { oh: 10, profit: 8, cont: 5 }
```

### Key Functions

| Function | What it does |
|----------|--------------|
| `renderAll()` | Re-renders all three panels |
| `renderDivNav()` | Rebuilds the left division list with current subtotals |
| `renderTable()` | Rebuilds the line item table for the active division |
| `renderSum()` | Rebuilds the right summary panel with totals and markup |
| `updQty(id, val)` | Updates a single item's qty, recalculates just that row's extended cost (no full re-render — avoids losing focus) |
| `updCost(id, val)` | Same as above for unit cost |
| `updMu(field, val)` | Updates a markup % and recalculates just the dollar amounts in the summary (no re-render) |
| `refreshTotals()` | Calls `renderDivNav()` + `renderSum()` without re-rendering the table |
| `addLibItem(div, idx)` | Adds an item from the library to `project.items` |
| `addCustom()` | Adds a blank editable row |
| `delItem(id)` | Removes an item and re-renders |
| `setDiv(div)` | Changes the active CSI division and re-renders the table |
| `toggleLib()` / `buildLibList(q)` | Shows/hides and filters the library dropdown |
| `saveProject()` | Serializes `project` to `localStorage` as JSON |
| `loadProject()` | Restores `project` from `localStorage` on page load |

### How Extended Cost Works
```
Extended = qty × (unitCost × regionMultiplier)
```
The region multiplier is applied at display time, not stored. So if you change regions, all costs update immediately.

---

## Tool 2: Budget Calculator (`#pg-budget`)

**What it does:** Parametric (rough order of magnitude) estimate. You pick a project type, enter SF and stories, pick region and quality — it returns a cost range based on national construction cost data.

### Key Data

**`B_BASE`** — base cost ranges ($/SF) by project type, plus the labor ratio for each type:
```javascript
B_BASE['office'] = { lo: 180, hi: 280, lr: 0.42 }
// lo/hi = $/SF range, lr = labor ratio (42% of cost is labor)
```

**`B_QUAL`** — quality multipliers: `economy: 0.82`, `standard: 1.0`, `premium: 1.28`

**`B_STORY`** — story premium multipliers: `[1.0, 1.02, 1.05, 1.08, 1.12, 1.18, 1.25]` for 1–7+ stories

**`B_DIV`** — CSI division weights for the breakdown chart (how the total splits across divisions)

### How It Calculates
```
Cost = (base $/SF) × SF × region multiplier × quality multiplier × story multiplier
```

### State Variables
- `bType` — selected project type string (e.g. `'office'`)
- `bQual` — selected quality string (e.g. `'standard'`)

---

## Tool 3: Schedule Estimator (`#pg-schedule`)

**What it does:** Generates a phased Gantt chart schedule based on project type, size, quality, and start date.

### Key Data

**`S_BASE`** — duration ranges in weeks by project type:
```javascript
S_BASE['office'] = { lo: 8, hi: 14 }
```

**`S_QUAL`** — quality duration multipliers

**`S_STORY`** — story duration multipliers (taller = longer)

**`S_PHASES`** — the 7 phases with their percentage of total duration:
```javascript
{ name: 'Structure', pct: 0.22 }  // 22% of total schedule
```

### How the Gantt Renders
Each phase bar is an absolutely-positioned `<div>` inside a relative-positioned track. The `left` and `width` CSS properties are set as percentages of the total duration — so the bars stack automatically.

```
Phase bar position: left = (cumulative % complete) × 100%
Phase bar width:    width = (phase %) × 100%
```

---

## Tool 4: Bid Comparison (`#pg-bids`)

**What it does:** Side-by-side comparison of 2–6 contractor bids. Calculates spread, ranks bidders, and compares to an engineer's estimate.

### Key Logic

`analyzeBids()` collects all bid amounts, sorts them low to high, then calculates:
- **Spread** = `(high - low) / low × 100%`
- **Spread assessment**: Tight <5%, Normal 5–15%, Wide 15–30%, Very Wide >30%
- **vs. Estimate** = `(low bid - estimate) / estimate × 100%`

`BID_COLORS` is an array of 6 colors — each bidder card gets a unique color for its top border.

---

## Tool 5: Markup & Overhead (`#pg-markup`)

**What it does:** Two calculators in one — project markup (to get from direct cost to bid price) and labor burden (to get the fully burdened hourly rate).

### Tab Switching
`switchTab(btn, paneId)` — scoped to `#pg-markup` so it doesn't interfere with any other tab groups. Removes `.active` from all tab buttons and panes in the markup page, then adds it to the clicked button and target pane.

### Project Markup Logic
```
Direct cost = labor + material + subs + equipment
Overhead    = direct × OH%
Profit      = (direct + overhead) × profit%       ← compounding
Contingency = (direct + oh + profit) × cont%      ← compounding
Bond        = (subtotal) × bond%
Bid price   = all of the above added together
```

**Markup vs. Margin** — two different ways to express the same thing:
- **Markup** = profit as a % of cost (on-cost)
- **Margin** = profit as a % of selling price (on-price)

### Labor Burden Logic
```
Burden rate = FICA% + FUTA/SUTA% + Workers Comp% + GL% + Benefits%
Burdened rate = base wage × (1 + burden rate)
```

---

## Tool 6: Blueprint Takeoff (`#pg-blueprint`)

**What it does:** Upload a PDF or image of a drawing, calibrate the scale, then measure lengths (LF), areas (SF), and counts directly on the drawing. Measurements can be sent to the Project Estimator.

### How It Works Technically

The viewer uses two `<canvas>` elements stacked on top of each other:
1. **`#pdf-canvas`** — PDF.js renders the drawing onto this (read-only)
2. **`#markup-canvas`** — transparent overlay that captures all mouse events and draws the measurement shapes

PDF.js is loaded from a CDN (`cdnjs.cloudflare.com`) — the only external dependency in the app.

### Key State Variables

| Variable | What it holds |
|----------|--------------|
| `bpPdf` | The loaded PDF.js document object |
| `bpTool` | Active tool: `'select'`, `'linear'`, `'area'`, `'count'`, `'scale'` |
| `bpScalePxPerFt` | Pixels per foot ratio (set during scale calibration) |
| `bpCurrentPts` | Points being drawn for the in-progress shape |
| `bpItems` | Array of completed takeoff measurements |

### Scale Calibration
User clicks two points → pixel distance is calculated with the Pythagorean theorem → user enters real-world distance in feet → `pxPerFt = pixelDistance / feet`. All subsequent measurements divide by this ratio.

### Area Calculation
Uses the **Shoelace formula** — a standard algorithm for computing the area of any polygon from its vertex coordinates:
```
Area = |Σ(x[i] × y[i+1] - x[i+1] × y[i])| / 2
```
The result in pixels² is then divided by `pxPerFt²` to get SF.

### Sending to Estimator
`bpSendToEst(id)` takes the measured quantity, prompts for a description, pushes a new item into `project.items` with the measured quantity and `unitCost: 0`, then navigates to the Estimator. The user fills in the unit cost from there.

---

## localStorage Persistence

Only the Project Estimator auto-saves. `saveProject()` runs after every change (add item, change qty, delete, etc.) and serializes the `project` object to the browser's `localStorage` under the key `'bc_proj'`. `loadProject()` runs once on page load to restore it.

The other tools don't save state — they reset on page refresh. This is intentional since budget/schedule/bid inputs are typically one-off calculations.

---

## Adding a New Tool (Pattern)

1. Add a nav link in `<nav>`: `<a href="#" onclick="showPage('newtool');return false" id="nl-newtool">Tool Name</a>`
2. Add a page div: `<div class="page" id="pg-newtool">...</div>`
3. Add any new CSS (follow existing naming conventions)
4. Add JS functions in the `<script>` block
5. Call any initialization inside the `(function(){...})()` init block at the bottom
