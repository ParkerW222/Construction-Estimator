async function listProjects(db, ownerId) {
  const result = await db.execute({ sql: 'SELECT id, name, updated_at AS savedAt, client_email AS clientEmail FROM projects WHERE owner_id = ? ORDER BY updated_at DESC', args: [ownerId] });
  return result.rows;
}

async function getProject(db, id, ownerId) {
  const result = await db.execute({ sql: 'SELECT id, name, data, updated_at AS savedAt, client_email AS clientEmail FROM projects WHERE id = ? AND owner_id = ?', args: [id, ownerId] });
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, savedAt: row.savedAt, clientEmail: row.clientEmail, data: JSON.parse(row.data) };
}

async function upsertProject(db, { id, name, data, ownerId }) {
  await db.execute({
    sql: `
      INSERT INTO projects (id, name, data, owner_id, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at
      WHERE projects.owner_id = excluded.owner_id
    `,
    args: [id, name, JSON.stringify(data), ownerId],
  });
  return getProject(db, id, ownerId);
}

async function deleteProject(db, id, ownerId) {
  const result = await db.execute({ sql: 'DELETE FROM projects WHERE id = ? AND owner_id = ?', args: [id, ownerId] });
  return result.rowsAffected > 0;
}

async function shareProject(db, id, ownerId, email) {
  const result = await db.execute({ sql: 'UPDATE projects SET client_email = ? WHERE id = ? AND owner_id = ?', args: [email, id, ownerId] });
  return result.rowsAffected > 0;
}

async function unshareProject(db, id, ownerId) {
  await db.execute({ sql: 'UPDATE projects SET client_email = NULL WHERE id = ? AND owner_id = ?', args: [id, ownerId] });
}

async function listClientProjects(db, email) {
  const result = await db.execute({ sql: 'SELECT id, name, updated_at AS savedAt FROM projects WHERE client_email = ? ORDER BY updated_at DESC', args: [email] });
  return result.rows;
}

async function getClientProject(db, id, email) {
  const result = await db.execute({ sql: 'SELECT id, name, data, updated_at AS savedAt FROM projects WHERE id = ? AND client_email = ?', args: [id, email] });
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, savedAt: row.savedAt, data: JSON.parse(row.data) };
}

module.exports = {
  listProjects, getProject, upsertProject, deleteProject,
  shareProject, unshareProject, listClientProjects, getClientProject,
};
