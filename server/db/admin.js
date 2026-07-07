function listAllUsers(db) {
  return db.prepare(`
    SELECT u.id, u.email, u.role, u.created_at AS createdAt,
      (SELECT COUNT(*) FROM projects p WHERE p.owner_id = u.id) AS projectCount
    FROM users u
    ORDER BY u.created_at DESC
  `).all();
}

function deleteUser(db, id) {
  const del = db.transaction(() => {
    db.prepare('DELETE FROM projects WHERE owner_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  del();
}

function listAllProjects(db) {
  return db.prepare(`
    SELECT p.id, p.name, p.updated_at AS savedAt, p.client_email AS clientEmail,
      u.email AS ownerEmail
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    ORDER BY p.updated_at DESC
  `).all();
}

function deleteAnyProject(db, id) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

function getStats(db) {
  const users = db.prepare(`SELECT role, COUNT(*) AS n FROM users GROUP BY role`).all();
  const projectCount = db.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
  const sharedCount = db.prepare('SELECT COUNT(*) AS n FROM projects WHERE client_email IS NOT NULL').get().n;
  const stats = { builders: 0, clients: 0, admins: 0, totalUsers: 0, totalProjects: projectCount, sharedProjects: sharedCount };
  users.forEach(r => {
    if (r.role === 'builder') stats.builders = r.n;
    else if (r.role === 'client') stats.clients = r.n;
    else if (r.role === 'admin') stats.admins = r.n;
    stats.totalUsers += r.n;
  });
  return stats;
}

module.exports = { listAllUsers, deleteUser, listAllProjects, deleteAnyProject, getStats };
