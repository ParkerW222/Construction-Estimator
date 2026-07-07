const bcrypt = require('bcryptjs');
const { getDb } = require('../db/migrate');
const usersRepo = require('../db/users');

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

(async () => {
  const db = await getDb();
  const existing = await usersRepo.getUserByEmail(db, email);

  if (existing) {
    const passwordHash = bcrypt.hashSync(password, 10);
    await db.execute({ sql: 'UPDATE users SET role = ?, password_hash = ? WHERE id = ?', args: ['admin', passwordHash, existing.id] });
    console.log(`Set admin role and reset password for existing account "${email}".`);
  } else {
    const id = 'user_' + Date.now();
    const passwordHash = bcrypt.hashSync(password, 10);
    await usersRepo.createUser(db, { id, email, passwordHash, role: 'admin' });
    console.log(`Created new admin account "${email}".`);
  }

  db.close();
})();
