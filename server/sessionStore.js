const session = require('express-session');

class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }

  async get(sid, cb) {
    try {
      const result = await this.db.execute({ sql: 'SELECT data, expires_at FROM sessions WHERE sid = ?', args: [sid] });
      const row = result.rows[0];
      if (!row || row.expires_at < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.data));
    } catch (e) { cb(e); }
  }

  async set(sid, sessionData, cb) {
    try {
      const maxAge = (sessionData.cookie && sessionData.cookie.maxAge) || 1000 * 60 * 60 * 24;
      const expiresAt = Date.now() + maxAge;
      await this.db.execute({
        sql: `
          INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
        `,
        args: [sid, JSON.stringify(sessionData), expiresAt],
      });
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }

  async destroy(sid, cb) {
    try {
      await this.db.execute({ sql: 'DELETE FROM sessions WHERE sid = ?', args: [sid] });
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }

  touch(sid, sessionData, cb) {
    this.set(sid, sessionData, cb);
  }

  async pruneExpired() {
    await this.db.execute({ sql: 'DELETE FROM sessions WHERE expires_at < ?', args: [Date.now()] });
  }
}

module.exports = SqliteSessionStore;
