async function createUser(db, { id, email, passwordHash, role }) {
  await db.execute({ sql: 'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', args: [id, email, passwordHash, role] });
  return getUserById(db, id);
}

async function getUserByEmail(db, email) {
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  return result.rows[0] || null;
}

async function getUserById(db, id) {
  const result = await db.execute({ sql: 'SELECT id, email, role, created_at FROM users WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}

module.exports = { createUser, getUserByEmail, getUserById };
