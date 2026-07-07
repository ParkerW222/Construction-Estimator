CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'builder',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id);
