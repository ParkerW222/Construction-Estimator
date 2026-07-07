const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'buildcalc.sqlite');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function createDbClient() {
  if (process.env.TURSO_DATABASE_URL) {
    return createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: 'number',
    });
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return createClient({ url: `file:${DB_PATH.replace(/\\/g, '/')}`, intMode: 'number' });
}

async function migrate(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const result = await db.execute('SELECT version FROM schema_migrations');
  const applied = new Set(result.rows.map(r => r.version));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.executeMultiple(sql);
    await db.execute({ sql: 'INSERT INTO schema_migrations (version) VALUES (?)', args: [file] });
    console.log(`Applied migration: ${file}`);
  }
}

async function getDb() {
  const db = createDbClient();
  await migrate(db);
  return db;
}

module.exports = { getDb, DB_PATH };

if (require.main === module) {
  (async () => {
    const db = await getDb();
    console.log(`Database ready at ${process.env.TURSO_DATABASE_URL || DB_PATH}`);
    db.close();
  })();
}
