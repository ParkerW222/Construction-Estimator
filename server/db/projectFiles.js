async function getProjectFile(db, projectId) {
  const result = await db.execute({
    sql: 'SELECT file_name AS fileName, mime_type AS mimeType, data FROM project_files WHERE project_id = ?',
    args: [projectId],
  });
  return result.rows[0] || null;
}

async function upsertProjectFile(db, { projectId, fileName, mimeType, data }) {
  await db.execute({
    sql: `
      INSERT INTO project_files (project_id, file_name, mime_type, data, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(project_id) DO UPDATE SET file_name = excluded.file_name, mime_type = excluded.mime_type, data = excluded.data, updated_at = excluded.updated_at
    `,
    args: [projectId, fileName, mimeType, data],
  });
}

async function deleteProjectFile(db, projectId) {
  await db.execute({ sql: 'DELETE FROM project_files WHERE project_id = ?', args: [projectId] });
}

module.exports = { getProjectFile, upsertProjectFile, deleteProjectFile };
