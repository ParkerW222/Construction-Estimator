// ── REGIONAL COST MULTIPLIERS ─────────────────────────────────────
// Applied to every unit cost at calculation time (national base × multiplier)
const REGION_MULT = {
  'new-england':  { mult: 1.22, label: 'New England' },
  'new-york':     { mult: 1.45, label: 'New York Metro' },
  'mid-atlantic': { mult: 1.18, label: 'Mid-Atlantic' },
  'southeast':    { mult: 0.85, label: 'Southeast' },
  'florida':      { mult: 0.90, label: 'Florida' },
  'appalachian':  { mult: 0.88, label: 'TN / KY' },
  'texas':        { mult: 0.88, label: 'Texas' },
  'midwest':      { mult: 1.02, label: 'Midwest' },
  'plains':       { mult: 0.92, label: 'Plains' },
  'mountain':     { mult: 0.96, label: 'Mountain West' },
  'pacific-nw':   { mult: 1.14, label: 'Pacific Northwest' },
  'california':   { mult: 1.32, label: 'California' },
  'hawaii':       { mult: 1.48, label: 'Hawaii / Alaska' },
};

// ── CSI MASTERFORMAT ITEM LIBRARY ─────────────────────────────────
// Unit costs are RSMeans-style national averages ($/unit before regional adjustment)
const CSI_ITEMS = {
  '02': { name: 'Existing Conditions', items: [
    { desc: 'Demolition, selective interior',  unit: 'SF',  cost: 8    },
    { desc: 'Demolition, full building',        unit: 'SF',  cost: 15   },
    { desc: 'Asbestos / hazmat abatement',      unit: 'SF',  cost: 25   },
    { desc: 'Site clearing and grubbing',       unit: 'AC',  cost: 4200 },
  ]},
  '03': { name: 'Concrete', items: [
    { desc: 'Slab on grade, 4" thick',          unit: 'SF',  cost: 8.50  },
    { desc: 'Slab on grade, 6" thick',          unit: 'SF',  cost: 11.00 },
    { desc: 'Elevated concrete deck, 6"',       unit: 'SF',  cost: 18.00 },
    { desc: 'Strip footing, 12"×24"',           unit: 'LF',  cost: 85    },
    { desc: "Spread footing, 3'×3'×12\"",       unit: 'EA',  cost: 850   },
    { desc: 'Foundation wall, 8" thick',        unit: 'SF',  cost: 32    },
    { desc: 'Concrete column, 12" dia.',        unit: 'LF',  cost: 125   },
    { desc: 'Grade beam, 12"×18"',              unit: 'LF',  cost: 95    },
  ]},
  '04': { name: 'Masonry', items: [
    { desc: 'CMU block wall, 8"',               unit: 'SF',  cost: 28 },
    { desc: 'CMU block wall, 12"',              unit: 'SF',  cost: 34 },
    { desc: 'Brick veneer',                     unit: 'SF',  cost: 42 },
    { desc: 'Brick + CMU cavity wall',          unit: 'SF',  cost: 62 },
    { desc: 'Stone veneer, natural',            unit: 'SF',  cost: 85 },
  ]},
  '05': { name: 'Metals', items: [
    { desc: 'Structural steel, light frame',    unit: 'TON', cost: 3200 },
    { desc: 'Structural steel, heavy frame',    unit: 'TON', cost: 2800 },
    { desc: 'Steel deck, 1.5" type B',          unit: 'SF',  cost: 4.50 },
    { desc: 'Steel deck, 3" type B',            unit: 'SF',  cost: 5.50 },
    { desc: 'Steel stud framing, 3-5/8"',       unit: 'SF',  cost: 7    },
    { desc: 'Miscellaneous steel / embeds',     unit: 'TON', cost: 3800 },
  ]},
  '06': { name: 'Wood & Plastics', items: [
    { desc: 'Wood frame walls, 2×6 @ 16"',      unit: 'SF',  cost: 12   },
    { desc: 'Wood frame floor, TJI joists',     unit: 'SF',  cost: 9    },
    { desc: 'Plywood sheathing, 5/8"',          unit: 'SF',  cost: 4.50 },
    { desc: 'Rough carpentry, misc.',           unit: 'MBF', cost: 1800 },
    { desc: 'Finish carpentry, cabinets',       unit: 'LF',  cost: 285  },
    { desc: 'Millwork, reception desk',         unit: 'EA',  cost: 4500 },
  ]},
  '07': { name: 'Thermal & Moisture', items: [
    { desc: 'EPDM roofing, 60 mil',             unit: 'SF',  cost: 9    },
    { desc: 'TPO roofing, 60 mil',              unit: 'SF',  cost: 8    },
    { desc: 'Metal standing seam roof',         unit: 'SF',  cost: 18   },
    { desc: 'Spray foam insulation, 3"',        unit: 'SF',  cost: 4.50 },
    { desc: 'Batt insulation, R-19',            unit: 'SF',  cost: 1.80 },
    { desc: 'Exterior waterproofing',           unit: 'SF',  cost: 8    },
    { desc: 'Building wrap / air barrier',      unit: 'SF',  cost: 1.20 },
  ]},
  '08': { name: 'Openings', items: [
    { desc: "Hollow metal door, 3'×7'",         unit: 'EA',  cost: 1200 },
    { desc: "Solid wood door, 3'×7'",           unit: 'EA',  cost: 950  },
    { desc: 'Aluminum storefront, 1" IGU',      unit: 'SF',  cost: 75   },
    { desc: 'Curtain wall, thermally broken',   unit: 'SF',  cost: 140  },
    { desc: "Overhead coiling door, 10'×10'",   unit: 'EA',  cost: 3800 },
    { desc: "Sliding glass door, 6'×8'",        unit: 'EA',  cost: 2200 },
  ]},
  '09': { name: 'Finishes', items: [
    { desc: 'Drywall, 5/8" GWB painted',        unit: 'SF',  cost: 5.50 },
    { desc: 'Acoustic ceiling tile, 2×4',       unit: 'SF',  cost: 7    },
    { desc: 'Gypsum plaster, 3-coat',           unit: 'SF',  cost: 18   },
    { desc: 'Carpet, commercial grade',         unit: 'SY',  cost: 55   },
    { desc: 'VCT tile',                         unit: 'SF',  cost: 6    },
    { desc: 'Ceramic tile floor',               unit: 'SF',  cost: 18   },
    { desc: 'Epoxy floor coating',              unit: 'SF',  cost: 5    },
    { desc: 'Interior paint',                   unit: 'SF',  cost: 1.80 },
    { desc: 'Exterior paint / coating',         unit: 'SF',  cost: 3.50 },
  ]},
  '10': { name: 'Specialties', items: [
    { desc: 'Toilet compartments, FRP',         unit: 'EA',  cost: 1800 },
    { desc: 'Lockers, metal, 12"×72"',          unit: 'EA',  cost: 450  },
    { desc: 'Fire extinguisher + cabinet',      unit: 'EA',  cost: 320  },
    { desc: 'Signage, interior wayfinding',     unit: 'LS',  cost: 4500 },
    { desc: 'Loading dock equipment',           unit: 'EA',  cost: 8500 },
  ]},
  '22': { name: 'Plumbing', items: [
    { desc: 'Plumbing, complete system',        unit: 'SF',  cost: 14   },
    { desc: 'Restroom group, 2 fixtures',       unit: 'EA',  cost: 9500 },
    { desc: 'Floor drain, 4"',                  unit: 'EA',  cost: 850  },
    { desc: 'Water heater, 50 gal elec.',       unit: 'EA',  cost: 1800 },
    { desc: 'Grease trap, 50 GPM',              unit: 'EA',  cost: 6500 },
  ]},
  '23': { name: 'HVAC', items: [
    { desc: 'HVAC system, office',              unit: 'SF',  cost: 28    },
    { desc: 'HVAC system, warehouse',           unit: 'SF',  cost: 12    },
    { desc: 'RTU, 5-ton',                       unit: 'EA',  cost: 8500  },
    { desc: 'RTU, 10-ton',                      unit: 'EA',  cost: 16000 },
    { desc: 'VAV system, per zone',             unit: 'EA',  cost: 3800  },
    { desc: 'Exhaust fan, roof',                unit: 'EA',  cost: 1200  },
  ]},
  '26': { name: 'Electrical', items: [
    { desc: 'Electrical, complete system',      unit: 'SF',  cost: 22    },
    { desc: 'Service entrance, 400A',           unit: 'EA',  cost: 18000 },
    { desc: 'Lighting, LED office',             unit: 'SF',  cost: 12    },
    { desc: 'Lighting, LED warehouse',          unit: 'SF',  cost: 5     },
    { desc: 'Emergency / exit lighting',        unit: 'SF',  cost: 2.50  },
    { desc: 'Fire alarm system',                unit: 'SF',  cost: 4.50  },
  ]},
  '31': { name: 'Earthwork', items: [
    { desc: 'Mass excavation, 4 ft deep',       unit: 'CY',  cost: 18   },
    { desc: 'Trench excavation',                unit: 'LF',  cost: 28   },
    { desc: 'Structural fill, compacted',       unit: 'CY',  cost: 22   },
    { desc: 'Rough grading, fine',              unit: 'SF',  cost: 1.20 },
    { desc: 'Soil stabilization, lime',         unit: 'SY',  cost: 8    },
  ]},
  '32': { name: 'Exterior Improvements', items: [
    { desc: 'Asphalt parking, 3" binder + 2" top', unit: 'SF', cost: 7.50 },
    { desc: 'Concrete sidewalk, 4"',            unit: 'SF',  cost: 9    },
    { desc: 'Concrete curb & gutter',           unit: 'LF',  cost: 28   },
    { desc: 'Landscape, basic seed/sod',        unit: 'SF',  cost: 1.50 },
    { desc: 'Site lighting, pole-mounted',      unit: 'EA',  cost: 4500 },
  ]},
  '33': { name: 'Utilities', items: [
    { desc: 'Water service, 4"',                unit: 'LF',  cost: 55  },
    { desc: 'Sanitary sewer, 8" PVC',           unit: 'LF',  cost: 75  },
    { desc: 'Storm sewer, 12" RCP',             unit: 'LF',  cost: 90  },
    { desc: 'Gas service, 2"',                  unit: 'LF',  cost: 45  },
    { desc: 'Site electrical duct bank',        unit: 'LF',  cost: 120 },
  ]},
};

// ── BUDGET CALCULATOR DATA ─────────────────────────────────────────
// lo/hi = $/SF range, lr = labor ratio
const B_BASE = {
  office:      { lo: 180, hi: 280, lr: 0.42 },
  retail:      { lo: 140, hi: 210, lr: 0.38 },
  warehouse:   { lo: 60,  hi: 110, lr: 0.35 },
  multifamily: { lo: 160, hi: 240, lr: 0.45 },
  industrial:  { lo: 80,  hi: 140, lr: 0.36 },
  medical:     { lo: 350, hi: 600, lr: 0.48 },
};
const B_QUAL  = { economy: 0.82, standard: 1.0, premium: 1.28 };
const B_STORY = [1, 1.02, 1.05, 1.08, 1.12, 1.18, 1.25]; // index = stories - 1
const B_DIV = [
  { n: 'Concrete / Structure',   w: 0.18 },
  { n: 'Masonry',                w: 0.05 },
  { n: 'Metals',                 w: 0.08 },
  { n: 'Wood & Finishes',        w: 0.12 },
  { n: 'Thermal / Envelope',     w: 0.08 },
  { n: 'Openings',               w: 0.06 },
  { n: 'Finishes',               w: 0.12 },
  { n: 'Mechanical / Plumbing',  w: 0.12 },
  { n: 'Electrical',             w: 0.10 },
  { n: 'Site Work',              w: 0.09 },
];

// ── SCHEDULE ESTIMATOR DATA ────────────────────────────────────────
// Duration ranges in weeks by project type
const S_BASE = {
  office:      { lo: 8,  hi: 14 },
  retail:      { lo: 6,  hi: 10 },
  warehouse:   { lo: 5,  hi: 8  },
  multifamily: { lo: 10, hi: 18 },
  industrial:  { lo: 6,  hi: 12 },
  medical:     { lo: 16, hi: 28 },
};
const S_QUAL  = { economy: 0.88, standard: 1.0, premium: 1.18 };
const S_STORY = [1, 1.08, 1.16, 1.25, 1.35, 1.45, 1.58];
const S_PHASES = [
  { name: 'Pre-Construction',          pct: 0.08 },
  { name: 'Site Work & Foundation',    pct: 0.18 },
  { name: 'Structure',                 pct: 0.22 },
  { name: 'Envelope',                  pct: 0.15 },
  { name: 'MEP Rough-In',              pct: 0.15 },
  { name: 'Interior Finishes',         pct: 0.14 },
  { name: 'Closeout & Commissioning',  pct: 0.08 },
];

// ── BID COMPARISON ─────────────────────────────────────────────────
const BID_COLORS = ['#1e3a5f', '#f97316', '#0891b2', '#16a34a', '#7c3aed', '#dc2626'];
