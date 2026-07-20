// Mirrors client/js/data.js's CSI_ITEMS division names — kept server-side only for labeling
// the public subcontractor share-view page. If you add/rename a division on the client, update
// it here too (worst case of drift is a missing/stale label, not a functional bug).
const CSI_DIVISION_NAMES = {
  '01': 'General Requirements',
  '02': 'Existing Conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood & Plastics',
  '07': 'Thermal & Moisture',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '12': 'Furnishings',
  '13': 'Special Construction',
  '14': 'Conveying Equipment',
  '21': 'Fire Suppression',
  '22': 'Plumbing',
  '23': 'HVAC',
  '25': 'Integrated Automation',
  '26': 'Electrical',
  '27': 'Communications',
  '28': 'Electronic Safety & Security',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities',
  '34': 'Transportation',
  '44': 'Pollution & Waste Control',
};

module.exports = { CSI_DIVISION_NAMES };
