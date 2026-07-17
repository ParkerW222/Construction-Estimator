function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    trade: row.trade || '',
    contactName: row.contactName || '',
    contactEmail: row.contactEmail || '',
    contactPhone: row.contactPhone || '',
    notes: row.notes || '',
  };
}

async function listSubcontractors(db, ownerId) {
  const result = await db.execute({
    sql: `SELECT id, name, trade, contact_name AS contactName, contact_email AS contactEmail,
                 contact_phone AS contactPhone, notes
          FROM subcontractors WHERE owner_id = ? ORDER BY name COLLATE NOCASE`,
    args: [ownerId],
  });
  return result.rows.map(mapRow);
}

async function createSubcontractor(db, { ownerId, name, trade, contactName, contactEmail, contactPhone, notes }) {
  const id = 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  await db.execute({
    sql: `INSERT INTO subcontractors (id, owner_id, name, trade, contact_name, contact_email, contact_phone, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, ownerId, name, trade || null, contactName || null, contactEmail || null, contactPhone || null, notes || null],
  });
  return { id, name, trade: trade || '', contactName: contactName || '', contactEmail: contactEmail || '', contactPhone: contactPhone || '', notes: notes || '' };
}

async function updateSubcontractor(db, id, ownerId, { name, trade, contactName, contactEmail, contactPhone, notes }) {
  const result = await db.execute({
    sql: `UPDATE subcontractors SET name = ?, trade = ?, contact_name = ?, contact_email = ?, contact_phone = ?, notes = ?, updated_at = datetime('now')
          WHERE id = ? AND owner_id = ?`,
    args: [name, trade || null, contactName || null, contactEmail || null, contactPhone || null, notes || null, id, ownerId],
  });
  return result.rowsAffected > 0;
}

async function deleteSubcontractor(db, id, ownerId) {
  const result = await db.execute({ sql: 'DELETE FROM subcontractors WHERE id = ? AND owner_id = ?', args: [id, ownerId] });
  return result.rowsAffected > 0;
}

// Not owner-scoped — only for routes gated by a separate unguessable token (e.g. the
// subcontractor share-view link), never expose this to a normal authenticated request.
async function getSubcontractorRawById(db, id) {
  const result = await db.execute({ sql: 'SELECT id, name, trade FROM subcontractors WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}

module.exports = { listSubcontractors, createSubcontractor, updateSubcontractor, deleteSubcontractor, getSubcontractorRawById };
