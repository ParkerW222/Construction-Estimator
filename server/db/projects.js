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

// Not owner-scoped — only for routes gated by a separate unguessable token (e.g. the
// subcontractor share-view link), never expose this to a normal authenticated request.
async function getProjectRawById(db, id) {
  const result = await db.execute({ sql: 'SELECT id, name, data FROM projects WHERE id = ?', args: [id] });
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, data: JSON.parse(row.data) };
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

const MAX_VERSIONS_PER_PROJECT = 20;

async function createVersion(db, { projectId, name, data }) {
  const id = 'ver_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  await db.execute({
    sql: 'INSERT INTO project_versions (id, project_id, name, data) VALUES (?, ?, ?, ?)',
    args: [id, projectId, name, JSON.stringify(data)],
  });
  await pruneOldVersions(db, projectId);
  return id;
}

async function pruneOldVersions(db, projectId, keep = MAX_VERSIONS_PER_PROJECT) {
  await db.execute({
    sql: `
      DELETE FROM project_versions
      WHERE project_id = ?
      AND id NOT IN (
        SELECT id FROM project_versions WHERE project_id = ? ORDER BY saved_at DESC LIMIT ?
      )
    `,
    args: [projectId, projectId, keep],
  });
}

async function listVersions(db, projectId) {
  const result = await db.execute({
    sql: 'SELECT id, name, saved_at AS savedAt FROM project_versions WHERE project_id = ? ORDER BY saved_at DESC',
    args: [projectId],
  });
  return result.rows;
}

async function getVersion(db, versionId, projectId) {
  const result = await db.execute({
    sql: 'SELECT id, name, data, saved_at AS savedAt FROM project_versions WHERE id = ? AND project_id = ?',
    args: [versionId, projectId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, savedAt: row.savedAt, data: JSON.parse(row.data) };
}

module.exports = {
  listProjects, getProject, getProjectRawById, upsertProject, deleteProject,
  shareProject, unshareProject, listClientProjects, getClientProject,
  createVersion, listVersions, getVersion,
};
