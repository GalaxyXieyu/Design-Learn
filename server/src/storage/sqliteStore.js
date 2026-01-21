const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const SCHEMA_VERSION = 3;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readDatabaseFile(dbPath) {
  try {
    return fs.readFileSync(dbPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function wrapDatabase(rawDb, dbPath) {
  let closed = false;

  function persist() {
    if (closed) {
      return;
    }
    const data = rawDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }

  function prepare(sql) {
    const stmt = rawDb.prepare(sql);
    const normalizeParams = (params) => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
    const finalize = () => {
      try {
        stmt.free();
      } catch {
        return;
      }
    };

    return {
      run: (...params) => {
        const bound = normalizeParams(params);
        stmt.run(bound);
        const changes = typeof rawDb.getRowsModified === 'function' ? rawDb.getRowsModified() : 0;
        finalize();
        persist();
        return { changes };
      },
      get: (...params) => {
        const bound = normalizeParams(params);
        stmt.bind(bound);
        if (!stmt.step()) {
          finalize();
          return undefined;
        }
        const row = stmt.getAsObject();
        finalize();
        return row;
      },
      all: (...params) => {
        const bound = normalizeParams(params);
        const rows = [];
        stmt.bind(bound);
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        finalize();
        return rows;
      },
    };
  }

  function exec(sql) {
    rawDb.exec(sql);
    persist();
  }

  function pragma(statement, options = {}) {
    const trimmed = statement.trim();
    if (trimmed.includes('=')) {
      rawDb.exec(`PRAGMA ${statement}`);
      persist();
      return undefined;
    }
    const result = rawDb.exec(`PRAGMA ${statement}`);
    if (options.simple) {
      return result?.[0]?.values?.[0]?.[0] ?? 0;
    }
    return result;
  }

  function close() {
    if (closed) {
      return;
    }
    persist();
    rawDb.close();
    closed = true;
  }

  return {
    prepare,
    exec,
    pragma,
    close,
  };
}

async function openDatabase(dbPath) {
  ensureDir(path.dirname(dbPath));
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });
  const fileBuffer = readDatabaseFile(dbPath);
  const rawDb = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
  const db = wrapDatabase(rawDb, dbPath);
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

function migrate(db) {
  const version = db.pragma('user_version', { simple: true });
  if (version === SCHEMA_VERSION) {
    return;
  }

  if (version !== 0 && version !== 1 && version !== 2) {
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

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      metadata_json TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_versions_design_id ON versions(design_id);
    CREATE INDEX IF NOT EXISTS idx_components_design_id ON components(design_id);
    CREATE INDEX IF NOT EXISTS idx_components_version_id ON components(version_id);
    CREATE INDEX IF NOT EXISTS idx_rules_version_id ON rules(version_id);
    CREATE INDEX IF NOT EXISTS idx_designs_updated_at ON designs(updated_at);
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_type ON prompt_templates(type);
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(type, is_active);
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_default ON prompt_templates(type, is_default);

    -- 任务队列表
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      domain TEXT,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      stage TEXT,
      error TEXT,
      options_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_domain ON tasks(domain);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
  `);

  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

module.exports = {
  openDatabase,
  SCHEMA_VERSION,
};
