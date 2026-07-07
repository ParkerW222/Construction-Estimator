function createUser(db, { id, email, passwordHash, role }) {
  db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(id, email, passwordHash, role);
  return getUserById(db, id);
}

function getUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(db, id) {
  return db.prepare('SELECT id, email, role, created_at FROM users WHERE id = ?').get(id);
}

module.exports = { createUser, getUserByEmail, getUserById };
