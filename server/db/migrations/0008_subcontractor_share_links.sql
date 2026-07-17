CREATE TABLE IF NOT EXISTS subcontractor_share_links (
  token TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  subcontractor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, subcontractor_id)
);
