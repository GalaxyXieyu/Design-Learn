const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_VERSION = 1;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function openDatabase(dbPath) {
  ensureDir(path.dirname(dbPath));
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

function migrate(db) {
  const version = db.pragma('user_version', { simple: true });
  if (version === SCHEMA_VERSION) {
    return;
  }

  if (version !== 0) {
    throw new Error(`Unsupported schema version ${version}`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS designs (
      id TEXT PRIMARY KEY,
      name TEXT,
      url TEXT,
      source TEXT,
      category TEXT,
      description TEXT,
      thumbnail TEXT,
      stats_json TEXT,
      metadata_json TEXT,
      design_path TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      styleguide_path TEXT,
      rules_path TEXT,
      snapshots_path TEXT,
      created_at TEXT,
      created_by TEXT,
      FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      name TEXT,
      type TEXT,
      structure_json TEXT,
      code_path TEXT,
      preview_path TEXT,
      created_at TEXT,
      FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE CASCADE,
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL,
      type TEXT,
      name TEXT,
      value TEXT,
      raw_path TEXT,
      created_at TEXT,
      FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_versions_design_id ON versions(design_id);
    CREATE INDEX IF NOT EXISTS idx_components_design_id ON components(design_id);
    CREATE INDEX IF NOT EXISTS idx_components_version_id ON components(version_id);
    CREATE INDEX IF NOT EXISTS idx_rules_version_id ON rules(version_id);
    CREATE INDEX IF NOT EXISTS idx_designs_updated_at ON designs(updated_at);
  `);

  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

module.exports = {
  openDatabase,
  SCHEMA_VERSION,
};
