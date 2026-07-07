const bcrypt = require('bcryptjs');
const usersRepo = require('./db/users');

function registerAuthRoutes(app, db) {
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, role } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      if (await usersRepo.getUserByEmail(db, email)) return res.status(409).json({ error: 'An account with that email already exists' });

      const id = 'user_' + Date.now();
      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await usersRepo.createUser(db, { id, email, passwordHash, role: role === 'client' ? 'client' : 'builder' });
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.role = user.role;
      res.json(user);
    } catch (err) {
      console.error('signup error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const row = await usersRepo.getUserByEmail(db, email);
      if (!row || !bcrypt.compareSync(password || '', row.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      req.session.userId = row.id;
      req.session.email = row.email;
      req.session.role = row.role;
      res.json({ id: row.id, email: row.email, role: row.role });
    } catch (err) {
      console.error('login error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.status(204).end());
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      const user = req.session.userId && await usersRepo.getUserById(db, req.session.userId);
      if (!user) return res.status(401).json({ error: 'Not logged in' });
      res.json(user);
    } catch (err) {
      console.error('me error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  });
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { registerAuthRoutes, requireAuth, requireAdmin };
