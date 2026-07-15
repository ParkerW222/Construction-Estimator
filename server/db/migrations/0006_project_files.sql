CREATE TABLE IF NOT EXISTS project_files (
  project_id TEXT PRIMARY KEY,
  file_name TEXT,
  mime_type TEXT,
  data BLOB NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
