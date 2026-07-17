const crypto = require('crypto');

async function getOrCreateShareLink(db, projectId, subcontractorId) {
  const existing = await db.execute({
    sql: 'SELECT token FROM subcontractor_share_links WHERE project_id = ? AND subcontractor_id = ?',
    args: [projectId, subcontractorId],
  });
  if (existing.rows[0]) return existing.rows[0].token;

  const token = crypto.randomBytes(24).toString('hex');
  await db.execute({
    sql: 'INSERT INTO subcontractor_share_links (token, project_id, subcontractor_id) VALUES (?, ?, ?)',
    args: [token, projectId, subcontractorId],
  });
  return token;
}

async function getShareLinkTarget(db, token) {
  const result = await db.execute({
    sql: 'SELECT project_id AS projectId, subcontractor_id AS subcontractorId FROM subcontractor_share_links WHERE token = ?',
    args: [token],
  });
  return result.rows[0] || null;
}

module.exports = { getOrCreateShareLink, getShareLinkTarget };
