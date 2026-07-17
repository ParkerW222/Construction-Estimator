// Mirrors client/js/data.js's CSI_ITEMS division names — kept server-side only for labeling
// the public subcontractor share-view page. If you add/rename a division on the client, update
// it here too (worst case of drift is a missing/stale label, not a functional bug).
const CSI_DIVISION_NAMES = {
  '02': 'Existing Conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood & Plastics',
  '07': 'Thermal & Moisture',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '22': 'Plumbing',
  '23': 'HVAC',
  '26': 'Electrical',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities',
};

module.exports = { CSI_DIVISION_NAMES };
