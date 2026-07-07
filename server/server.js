// BuildCalc server
const express = require('express');
const session = require('express-session');
const path = require('path');
const { getDb, DB_PATH } = require('./db/migrate');
const projectsRepo = require('./db/projects');
const adminRepo = require('./db/admin');
const { registerAuthRoutes, requireAuth, requireAdmin } = require('./auth');
const SqliteSessionStore = require('./sessionStore');

function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

async function main() {
  const db = await getDb();
  console.log(`Database ready at ${process.env.TURSO_DATABASE_URL || DB_PATH}`);

  const sessionStore = new SqliteSessionStore(db);
  await sessionStore.pruneExpired();

  if (!process.env.SESSION_SECRET) {
    console.warn('WARNING: SESSION_SECRET is not set. Using an insecure default — set this before deploying anywhere real.');
  }

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
  }));
  app.use(express.static(path.join(__dirname, '..', 'client')));

  // TEMPORARY — remove after diagnosing env var issue
  app.get('/api/debug-env', (req, res) => {
    res.json({
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      tursoUrlPrefix: process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.slice(0, 15) : null,
    });
  });

  registerAuthRoutes(app, db);

  app.get('/api/projects', requireAuth, async (req, res) => {
    try { res.json(await projectsRepo.listProjects(db, req.session.userId)); }
    catch (err) { fail(res, err); }
  });

  app.get('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const project = await projectsRepo.getProject(db, req.params.id, req.session.userId);
      if (!project) return res.status(404).json({ error: 'Not found' });
      res.json(project);
    } catch (err) { fail(res, err); }
  });

  app.post('/api/projects', requireAuth, async (req, res) => {
    try {
      const { id, name, data } = req.body || {};
      if (!id || !name || !data) return res.status(400).json({ error: 'id, name, and data are required' });
      res.json(await projectsRepo.upsertProject(db, { id, name, data, ownerId: req.session.userId }));
    } catch (err) { fail(res, err); }
  });

  app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const ok = await projectsRepo.deleteProject(db, req.params.id, req.session.userId);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    } catch (err) { fail(res, err); }
  });

  app.post('/api/projects/:id/share', requireAuth, async (req, res) => {
    try {
      const { email } = req.body || {};
      if (!email || !email.trim()) return res.status(400).json({ error: 'Client email is required' });
      const ok = await projectsRepo.shareProject(db, req.params.id, req.session.userId, email.trim());
      if (!ok) return res.status(404).json({ error: 'Project not found' });
      res.json({ clientEmail: email.trim() });
    } catch (err) { fail(res, err); }
  });

  app.delete('/api/projects/:id/share', requireAuth, async (req, res) => {
    try {
      await projectsRepo.unshareProject(db, req.params.id, req.session.userId);
      res.status(204).end();
    } catch (err) { fail(res, err); }
  });

  app.get('/api/client/projects', requireAuth, async (req, res) => {
    try { res.json(await projectsRepo.listClientProjects(db, req.session.email)); }
    catch (err) { fail(res, err); }
  });

  app.get('/api/client/projects/:id', requireAuth, async (req, res) => {
    try {
      const project = await projectsRepo.getClientProject(db, req.params.id, req.session.email);
      if (!project) return res.status(404).json({ error: 'Not found' });
      res.json(project);
    } catch (err) { fail(res, err); }
  });

  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try { res.json(await adminRepo.getStats(db)); }
    catch (err) { fail(res, err); }
  });

  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try { res.json(await adminRepo.listAllUsers(db)); }
    catch (err) { fail(res, err); }
  });

  app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
      if (req.params.id === req.session.userId) return res.status(400).json({ error: "You can't delete your own account" });
      await adminRepo.deleteUser(db, req.params.id);
      res.status(204).end();
    } catch (err) { fail(res, err); }
  });

  app.get('/api/admin/projects', requireAdmin, async (req, res) => {
    try { res.json(await adminRepo.listAllProjects(db)); }
    catch (err) { fail(res, err); }
  });

  app.delete('/api/admin/projects/:id', requireAdmin, async (req, res) => {
    try {
      await adminRepo.deleteAnyProject(db, req.params.id);
      res.status(204).end();
    } catch (err) { fail(res, err); }
  });

  app.listen(PORT, () => {
    console.log(`BuildCalc server running at http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
