// BuildCalc server
const express = require('express');
const session = require('express-session');
const path = require('path');
const { getDb, DB_PATH } = require('./db/migrate');
const projectsRepo = require('./db/projects');
const projectFilesRepo = require('./db/projectFiles');
const subcontractorsRepo = require('./db/subcontractors');
const subShareLinksRepo = require('./db/subShareLinks');
const { CSI_DIVISION_NAMES } = require('./csiDivisions');
const adminRepo = require('./db/admin');
const { registerAuthRoutes, requireAuth, requireAdmin } = require('./auth');
const SqliteSessionStore = require('./sessionStore');

function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — Blueprint PDF/image files stored for cross-device sync

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
      const { id, name, data, createVersion } = req.body || {};
      if (!id || !name || !data) return res.status(400).json({ error: 'id, name, and data are required' });
      const project = await projectsRepo.upsertProject(db, { id, name, data, ownerId: req.session.userId });
      if (createVersion) await projectsRepo.createVersion(db, { projectId: id, name, data });
      res.json(project);
    } catch (err) { fail(res, err); }
  });

  app.get('/api/projects/:id/versions', requireAuth, async (req, res) => {
    try {
      const project = await projectsRepo.getProject(db, req.params.id, req.session.userId);
      if (!project) return res.status(404).json({ error: 'Not found' });
      res.json(await projectsRepo.listVersions(db, req.params.id));
    } catch (err) { fail(res, err); }
  });

  app.post('/api/projects/:id/versions/:versionId/restore', requireAuth, async (req, res) => {
    try {
      const project = await projectsRepo.getProject(db, req.params.id, req.session.userId);
      if (!project) return res.status(404).json({ error: 'Not found' });
      const version = await projectsRepo.getVersion(db, req.params.versionId, req.params.id);
      if (!version) return res.status(404).json({ error: 'Version not found' });
      await projectsRepo.createVersion(db, { projectId: req.params.id, name: project.name, data: project.data });
      const restored = await projectsRepo.upsertProject(db, { id: req.params.id, name: version.name, data: version.data, ownerId: req.session.userId });
      res.json(restored);
    } catch (err) { fail(res, err); }
  });

  app.put('/api/projects/:id/file', requireAuth, express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
    try {
      const project = await projectsRepo.getProject(db, req.params.id, req.session.userId);
      if (!project) return res.status(404).json({ error: 'Not found' });
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No file data received' });
      if (req.body.length > MAX_FILE_BYTES) return res.status(413).json({ error: `File too large — max ${MAX_FILE_BYTES / (1024 * 1024)}MB` });
      const fileName = req.get('X-File-Name') ? decodeURIComponent(req.get('X-File-Name')) : 'drawing';
      const mimeType = req.get('Content-Type') || 'application/octet-stream';
      await projectFilesRepo.upsertProjectFile(db, { projectId: req.params.id, fileName, mimeType, data: req.body });
      res.status(204).end();
    } catch (err) { fail(res, err); }
  });

  app.get('/api/projects/:id/file', requireAuth, async (req, res) => {
    try {
      const project = await projectsRepo.getProject(db, req.params.id, req.session.userId);
      if (!project) return res.status(404).json({ error: 'Not found' });
      const file = await projectFilesRepo.getProjectFile(db, req.params.id);
      if (!file) return res.status(404).json({ error: 'No file stored' });
      res.set('Content-Type', file.mimeType || 'application/octet-stream');
      res.set('X-File-Name', encodeURIComponent(file.fileName || 'drawing'));
      res.send(Buffer.from(file.data));
    } catch (err) { fail(res, err); }
  });

  app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const ok = await projectsRepo.deleteProject(db, req.params.id, req.session.userId);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      await projectFilesRepo.deleteProjectFile(db, req.params.id);
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

  app.get('/api/subcontractors', requireAuth, async (req, res) => {
    try { res.json(await subcontractorsRepo.listSubcontractors(db, req.session.userId)); }
    catch (err) { fail(res, err); }
  });

  app.post('/api/subcontractors', requireAuth, async (req, res) => {
    try {
      const { name, trade, contactName, contactEmail, contactPhone, notes } = req.body || {};
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
      const sub = await subcontractorsRepo.createSubcontractor(db, {
        ownerId: req.session.userId, name: name.trim(), trade, contactName, contactEmail, contactPhone, notes,
      });
      res.json(sub);
    } catch (err) { fail(res, err); }
  });

  app.put('/api/subcontractors/:id', requireAuth, async (req, res) => {
    try {
      const { name, trade, contactName, contactEmail, contactPhone, notes } = req.body || {};
      if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
      const ok = await subcontractorsRepo.updateSubcontractor(db, req.params.id, req.session.userId, {
        name: name.trim(), trade, contactName, contactEmail, contactPhone, notes,
      });
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    } catch (err) { fail(res, err); }
  });

  app.delete('/api/subcontractors/:id', requireAuth, async (req, res) => {
    try {
      const ok = await subcontractorsRepo.deleteSubcontractor(db, req.params.id, req.session.userId);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.status(204).end();
    } catch (err) { fail(res, err); }
  });

  app.post('/api/projects/:id/subcontractor-link', requireAuth, async (req, res) => {
    try {
      const project = await projectsRepo.getProject(db, req.params.id, req.session.userId);
      if (!project) return res.status(404).json({ error: 'Not found' });
      const { subcontractorId } = req.body || {};
      if (!subcontractorId) return res.status(400).json({ error: 'subcontractorId is required' });
      const token = await subShareLinksRepo.getOrCreateShareLink(db, req.params.id, subcontractorId);
      res.json({ token });
    } catch (err) { fail(res, err); }
  });

  // Public — deliberately not behind requireAuth. The token itself is the access control,
  // the same way any "share link" works, so a subcontractor never needs a BuildCalc account.
  app.get('/api/sub-view/:token', async (req, res) => {
    try {
      const link = await subShareLinksRepo.getShareLinkTarget(db, req.params.token);
      if (!link) return res.status(404).json({ error: 'Link not found' });
      const project = await projectsRepo.getProjectRawById(db, link.projectId);
      const sub = await subcontractorsRepo.getSubcontractorRawById(db, link.subcontractorId);
      if (!project || !sub) return res.status(404).json({ error: 'Not found' });

      const bs = project.data.budgetSheet || {};
      const items = project.data.items || [];
      const phases = Object.entries(bs.phases || {})
        .filter(([, row]) => row.subcontractorId === link.subcontractorId)
        .map(([divCode, row]) => {
          const total = items.filter(i => i.div === divCode).reduce((s, i) => s + i.qty * i.unitCost, 0);
          const payments = row.payments || [];
          const paid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
          return {
            div: divCode,
            label: `${divCode} — ${CSI_DIVISION_NAMES[divCode] || 'Division ' + divCode}`,
            total, paid, remaining: total - paid, payments,
          };
        });

      res.json({ projectName: project.name, subcontractorName: sub.name, subcontractorTrade: sub.trade, phases });
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

  // Catches body-parser errors (e.g. oversized file uploads) thrown before a route handler
  // runs, so they come back as JSON instead of Express's default HTML error page.
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: `File too large — max ${MAX_FILE_BYTES / (1024 * 1024)}MB` });
    }
    fail(res, err);
  });

  app.listen(PORT, () => {
    console.log(`BuildCalc server running at http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
