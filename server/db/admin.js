async function listAllUsers(db) {
  const result = await db.execute(`
    SELECT u.id, u.email, u.role, u.created_at AS createdAt,
      (SELECT COUNT(*) FROM projects p WHERE p.owner_id = u.id) AS projectCount
    FROM users u
    ORDER BY u.created_at DESC
  `);
  return result.rows;
}

async function deleteUser(db, id) {
  await db.batch([
    { sql: 'DELETE FROM projects WHERE owner_id = ?', args: [id] },
    { sql: 'DELETE FROM users WHERE id = ?', args: [id] },
  ], 'write');
}

async function listAllProjects(db) {
  const result = await db.execute(`
    SELECT p.id, p.name, p.updated_at AS savedAt, p.client_email AS clientEmail,
      u.email AS ownerEmail
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    ORDER BY p.updated_at DESC
  `);
  return result.rows;
}

async function deleteAnyProject(db, id) {
  await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [id] });
}

async function getStats(db) {
  const usersResult = await db.execute('SELECT role, COUNT(*) AS n FROM users GROUP BY role');
  const projectCountResult = await db.execute('SELECT COUNT(*) AS n FROM projects');
  const sharedCountResult = await db.execute('SELECT COUNT(*) AS n FROM projects WHERE client_email IS NOT NULL');
  const stats = {
    builders: 0, clients: 0, admins: 0, totalUsers: 0,
    totalProjects: projectCountResult.rows[0].n,
    sharedProjects: sharedCountResult.rows[0].n,
  };
  usersResult.rows.forEach(r => {
    if (r.role === 'builder') stats.builders = r.n;
    else if (r.role === 'client') stats.clients = r.n;
    else if (r.role === 'admin') stats.admins = r.n;
    stats.totalUsers += r.n;
  });
  return stats;
}

module.exports = { listAllUsers, deleteUser, listAllProjects, deleteAnyProject, getStats };
