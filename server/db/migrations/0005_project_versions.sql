CREATE TABLE IF NOT EXISTS project_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);
