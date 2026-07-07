function listProjects(db, ownerId) {
  return db.prepare('SELECT id, name, updated_at AS savedAt, client_email AS clientEmail FROM projects WHERE owner_id = ? ORDER BY updated_at DESC').all(ownerId);
}

function getProject(db, id, ownerId) {
  const row = db.prepare('SELECT id, name, data, updated_at AS savedAt, client_email AS clientEmail FROM projects WHERE id = ? AND owner_id = ?').get(id, ownerId);
  if (!row) return null;
  return { id: row.id, name: row.name, savedAt: row.savedAt, clientEmail: row.clientEmail, data: JSON.parse(row.data) };
}

function upsertProject(db, { id, name, data, ownerId }) {
  db.prepare(`
    INSERT INTO projects (id, name, data, owner_id, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at
    WHERE projects.owner_id = excluded.owner_id
  `).run(id, name, JSON.stringify(data), ownerId);
  return getProject(db, id, ownerId);
}

function deleteProject(db, id, ownerId) {
  const result = db.prepare('DELETE FROM projects WHERE id = ? AND owner_id = ?').run(id, ownerId);
  return result.changes > 0;
}

function shareProject(db, id, ownerId, email) {
  const result = db.prepare('UPDATE projects SET client_email = ? WHERE id = ? AND owner_id = ?').run(email, id, ownerId);
  return result.changes > 0;
}

function unshareProject(db, id, ownerId) {
  db.prepare('UPDATE projects SET client_email = NULL WHERE id = ? AND owner_id = ?').run(id, ownerId);
}

function listClientProjects(db, email) {
  return db.prepare('SELECT id, name, updated_at AS savedAt FROM projects WHERE client_email = ? ORDER BY updated_at DESC').all(email);
}

function getClientProject(db, id, email) {
  const row = db.prepare('SELECT id, name, data, updated_at AS savedAt FROM projects WHERE id = ? AND client_email = ?').get(id, email);
  if (!row) return null;
  return { id: row.id, name: row.name, savedAt: row.savedAt, data: JSON.parse(row.data) };
}

module.exports = {
  listProjects, getProject, upsertProject, deleteProject,
  shareProject, unshareProject, listClientProjects, getClientProject,
};
