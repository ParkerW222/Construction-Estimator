const session = require('express-session');

class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }

  get(sid, cb) {
    try {
      const row = this.db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?').get(sid);
      if (!row || row.expires_at < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.data));
    } catch (e) { cb(e); }
  }

  set(sid, sessionData, cb) {
    try {
      const maxAge = (sessionData.cookie && sessionData.cookie.maxAge) || 1000 * 60 * 60 * 24;
      const expiresAt = Date.now() + maxAge;
      this.db.prepare(`
        INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
      `).run(sid, JSON.stringify(sessionData), expiresAt);
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }

  destroy(sid, cb) {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }

  touch(sid, sessionData, cb) {
    this.set(sid, sessionData, cb);
  }

  pruneExpired() {
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  }
}

module.exports = SqliteSessionStore;
