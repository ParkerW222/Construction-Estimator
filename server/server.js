// BuildCalc server
const express = require('express');
const session = require('express-session');
const path = require('path');
const { getDb, DB_PATH } = require('./db/migrate');
const projectsRepo = require('./db/projects');
const adminRepo = require('./db/admin');
const { registerAuthRoutes, requireAuth, requireAdmin } = require('./auth');
const SqliteSessionStore = require('./sessionStore');

const db = getDb();
console.log(`Database ready at ${DB_PATH}`);

const sessionStore = new SqliteSessionStore(db);
sessionStore.pruneExpired();

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

registerAuthRoutes(app, db);

app.get('/api/projects', requireAuth, (req, res) => {
  res.json(projectsRepo.listProjects(db, req.session.userId));
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const project = projectsRepo.getProject(db, req.params.id, req.session.userId);
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json(project);
});

app.post('/api/projects', requireAuth, (req, res) => {
  const { id, name, data } = req.body || {};
  if (!id || !name || !data) return res.status(400).json({ error: 'id, name, and data are required' });
  res.json(projectsRepo.upsertProject(db, { id, name, data, ownerId: req.session.userId }));
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const ok = projectsRepo.deleteProject(db, req.params.id, req.session.userId);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

app.post('/api/projects/:id/share', requireAuth, (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.trim()) return res.status(400).json({ error: 'Client email is required' });
  const ok = projectsRepo.shareProject(db, req.params.id, req.session.userId, email.trim());
  if (!ok) return res.status(404).json({ error: 'Project not found' });
  res.json({ clientEmail: email.trim() });
});

app.delete('/api/projects/:id/share', requireAuth, (req, res) => {
  projectsRepo.unshareProject(db, req.params.id, req.session.userId);
  res.status(204).end();
});

app.get('/api/client/projects', requireAuth, (req, res) => {
  res.json(projectsRepo.listClientProjects(db, req.session.email));
});

app.get('/api/client/projects/:id', requireAuth, (req, res) => {
  const project = projectsRepo.getClientProject(db, req.params.id, req.session.email);
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json(project);
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json(adminRepo.getStats(db));
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json(adminRepo.listAllUsers(db));
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  if (req.params.id === req.session.userId) return res.status(400).json({ error: "You can't delete your own account" });
  adminRepo.deleteUser(db, req.params.id);
  res.status(204).end();
});

app.get('/api/admin/projects', requireAdmin, (req, res) => {
  res.json(adminRepo.listAllProjects(db));
});

app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
  adminRepo.deleteAnyProject(db, req.params.id);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`BuildCalc server running at http://localhost:${PORT}`);
});
