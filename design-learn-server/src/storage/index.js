const crypto = require('crypto');
const path = require('path');

const {
  resolveDataDir,
  getDatabasePath,
  getDesignDir,
  getDesignMetaPath,
  getDesignIndexPath,
  getVersionDir,
  getStyleguidePath,
  getRulesPath,
  getSnapshotsPath,
  getComponentCodePath,
  getComponentsIndexPath,
  getRulePath,
  getRulesIndexPath,
} = require('./paths');
const { ensureDir, writeJson, readJson, writeText, readText, removePath } = require('./fileStore');
const { openDatabase } = require('./sqliteStore');

function createStorage(options = {}) {
  const dataDir = resolveDataDir(options.dataDir);
  const db = openDatabase(getDatabasePath(dataDir));

  return {
    dataDir,
    close: () => db.close(),
    rebuildIndexes: () => rebuildIndexes(db, dataDir),
    createDesign: (input) => createDesign(db, dataDir, input),
    listDesigns: () => listDesigns(db),
    getDesign: (designId) => getDesign(db, dataDir, designId),
    updateDesign: (designId, patch) => updateDesign(db, dataDir, designId, patch),
    deleteDesign: (designId) => deleteDesign(db, dataDir, designId),
    createVersion: (input) => createVersion(db, dataDir, input),
    listVersions: (designId) => listVersions(db, designId),
    getVersion: (versionId) => getVersion(db, dataDir, versionId),
    deleteVersion: (versionId) => deleteVersion(db, dataDir, versionId),
    listSnapshots: (filters) => listSnapshots(db, dataDir, filters),
    getSnapshot: (snapshotId) => getSnapshot(db, dataDir, snapshotId),
    deleteSnapshot: (snapshotId) => deleteSnapshot(db, dataDir, snapshotId),
    createComponent: (input) => createComponent(db, dataDir, input),
    listComponents: (filters) => listComponents(db, dataDir, filters),
    getComponent: (componentId) => getComponent(db, dataDir, componentId),
    deleteComponent: (componentId) => deleteComponent(db, dataDir, componentId),
    createRule: (input) => createRule(db, dataDir, input),
    listRules: (versionId) => listRules(db, dataDir, versionId),
    getRule: (ruleId) => getRule(db, dataDir, ruleId),
    deleteRule: (ruleId) => deleteRule(db, dataDir, ruleId),
  };
}

function normalizeDesign(input) {
  const now = new Date().toISOString();
  const stats = input.stats || {};
  const metadata = input.metadata || {};
  return {
    id: input.id || crypto.randomUUID(),
    name: input.name || '',
    url: input.url || '',
    source: input.source || 'import',
    category: input.category || '',
    description: input.description || '',
    thumbnail: input.thumbnail || '',
    stats: {
      components: stats.components ?? 0,
      versions: stats.versions ?? 0,
      lastAnalyzedAt: stats.lastAnalyzedAt ?? null,
    },
    metadata: {
      extractedFrom: metadata.extractedFrom || 'unknown',
      extractorVersion: metadata.extractorVersion || '',
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    },
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function mapDesignRow(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    source: row.source,
    category: row.category,
    description: row.description,
    thumbnail: row.thumbnail,
    stats: JSON.parse(row.stats_json || '{}'),
    metadata: JSON.parse(row.metadata_json || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function writeDesignIndex(db, dataDir) {
  const rows = db
    .prepare('SELECT id, name, url, category, updated_at FROM designs ORDER BY updated_at DESC')
    .all();
  await writeJson(getDesignIndexPath(dataDir), rows);
}

function shouldUseIndex() {
  const flag = (process.env.DESIGN_LEARN_USE_INDEX || '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

async function readIndexFile(indexPath) {
  try {
    const data = await readJson(indexPath);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeComponentIndex(db, dataDir) {
  const rows = db.prepare('SELECT * FROM components ORDER BY created_at DESC').all();
  const items = rows.map((row) => ({
    id: row.id,
    designId: row.design_id,
    versionId: row.version_id,
    name: row.name,
    type: row.type,
    createdAt: row.created_at,
  }));
  await writeJson(getComponentsIndexPath(dataDir), items);
}

async function writeRuleIndex(db, dataDir) {
  const rows = db.prepare('SELECT * FROM rules ORDER BY created_at DESC').all();
  const items = rows.map((row) => ({
    id: row.id,
    versionId: row.version_id,
    type: row.type,
    name: row.name,
    value: row.value,
    createdAt: row.created_at,
  }));
  await writeJson(getRulesIndexPath(dataDir), items);
}

async function rebuildIndexes(db, dataDir) {
  await writeDesignIndex(db, dataDir);
  await writeComponentIndex(db, dataDir);
  await writeRuleIndex(db, dataDir);
}

async function createDesign(db, dataDir, input) {
  const design = normalizeDesign(input);
  const designPath = getDesignMetaPath(dataDir, design.id);

  await writeJson(designPath, design);
  db.prepare(
    `INSERT INTO designs (
      id, name, url, source, category, description, thumbnail,
      stats_json, metadata_json, design_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    design.id,
    design.name,
    design.url,
    design.source,
    design.category,
    design.description,
    design.thumbnail,
    JSON.stringify(design.stats),
    JSON.stringify(design.metadata),
    designPath,
    design.createdAt,
    design.updatedAt
  );

  await writeDesignIndex(db, dataDir);
  return design;
}

function listDesigns(db) {
  const rows = db.prepare('SELECT * FROM designs ORDER BY updated_at DESC').all();
  return rows.map(mapDesignRow);
}

async function getDesign(db, dataDir, designId) {
  const row = db.prepare('SELECT * FROM designs WHERE id = ?').get(designId);
  if (!row) {
    return null;
  }

  try {
    return await readJson(getDesignMetaPath(dataDir, designId));
  } catch (error) {
    return mapDesignRow(row);
  }
}

async function updateDesign(db, dataDir, designId, patch) {
  const existing = await getDesign(db, dataDir, designId);
  if (!existing) {
    return null;
  }

  const updated = normalizeDesign({ ...existing, ...patch, id: designId, createdAt: existing.createdAt });
  updated.updatedAt = new Date().toISOString();

  await writeJson(getDesignMetaPath(dataDir, designId), updated);
  db.prepare(
    `UPDATE designs SET
      name = ?, url = ?, source = ?, category = ?, description = ?, thumbnail = ?,
      stats_json = ?, metadata_json = ?, updated_at = ?
    WHERE id = ?`
  ).run(
    updated.name,
    updated.url,
    updated.source,
    updated.category,
    updated.description,
    updated.thumbnail,
    JSON.stringify(updated.stats),
    JSON.stringify(updated.metadata),
    updated.updatedAt,
    designId
  );

  await writeDesignIndex(db, dataDir);
  return updated;
}

async function deleteDesign(db, dataDir, designId) {
  db.prepare('DELETE FROM designs WHERE id = ?').run(designId);
  await removePath(getDesignDir(dataDir, designId));
  await writeDesignIndex(db, dataDir);
}

async function createVersion(db, dataDir, input) {
  const designId = input.designId;
  if (!designId) {
    throw new Error('designId is required');
  }

  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(designId);
  if (!design) {
    throw new Error(`design ${designId} not found`);
  }

  const now = new Date().toISOString();
  const versionNumber =
    input.versionNumber ??
    (db.prepare('SELECT MAX(version_number) as max FROM versions WHERE design_id = ?').get(designId)
      .max || 0) +
      1;
  const versionId = input.id || crypto.randomUUID();
  const versionDir = getVersionDir(dataDir, designId, versionNumber);
  await ensureDir(versionDir);

  const styleguidePath = getStyleguidePath(dataDir, designId, versionNumber);
  const rulesPath = getRulesPath(dataDir, designId, versionNumber);
  const snapshotsPath = getSnapshotsPath(dataDir, designId, versionNumber);

  await writeText(styleguidePath, input.styleguideMarkdown || '');
  await writeJson(rulesPath, input.rules || {});
  await writeJson(snapshotsPath, input.snapshots || []);

  db.prepare(
    `INSERT INTO versions (
      id, design_id, version_number, styleguide_path, rules_path, snapshots_path, created_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    versionId,
    designId,
    versionNumber,
    styleguidePath,
    rulesPath,
    snapshotsPath,
    now,
    input.createdBy || 'user'
  );

  const designMeta = await getDesign(db, dataDir, designId);
  if (designMeta) {
    designMeta.stats.versions = (designMeta.stats.versions || 0) + 1;
    await updateDesign(db, dataDir, designId, designMeta);
  }

  return {
    id: versionId,
    designId,
    versionNumber,
    styleguideMarkdown: input.styleguideMarkdown || '',
    rules: input.rules || {},
    snapshots: input.snapshots || [],
    createdAt: now,
    createdBy: input.createdBy || 'user',
  };
}

function listVersions(db, designId) {
  const rows = db
    .prepare('SELECT * FROM versions WHERE design_id = ? ORDER BY version_number DESC')
    .all(designId);
  return rows.map((row) => ({
    id: row.id,
    designId: row.design_id,
    versionNumber: row.version_number,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

async function getVersion(db, dataDir, versionId) {
  const row = db.prepare('SELECT * FROM versions WHERE id = ?').get(versionId);
  if (!row) {
    return null;
  }

  const rules = await readJson(row.rules_path);
  const snapshots = await readJson(row.snapshots_path);
  const styleguideMarkdown = await readText(row.styleguide_path);

  return {
    id: row.id,
    designId: row.design_id,
    versionNumber: row.version_number,
    styleguideMarkdown,
    rules,
    snapshots,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

async function deleteVersion(db, dataDir, versionId) {
  const row = db.prepare('SELECT * FROM versions WHERE id = ?').get(versionId);
  if (!row) {
    return;
  }

  db.prepare('DELETE FROM versions WHERE id = ?').run(versionId);
  await removePath(getVersionDir(dataDir, row.design_id, row.version_number));

  const designMeta = await getDesign(db, dataDir, row.design_id);
  if (designMeta) {
    designMeta.stats.versions = Math.max(0, (designMeta.stats.versions || 1) - 1);
    await updateDesign(db, dataDir, row.design_id, designMeta);
  }
}

function normalizeSnapshot(snapshot, versionRow, index) {
  const snapshotId =
    snapshot && snapshot.id != null ? String(snapshot.id) : `${versionRow.id}:${index}`;
  return {
    id: snapshotId,
    designId: versionRow.design_id,
    versionId: versionRow.id,
    versionNumber: versionRow.version_number,
    url: snapshot?.url || '',
    title: snapshot?.title || '',
    html: snapshot?.html || '',
    css: snapshot?.css || '',
    metadata: snapshot?.metadata || {},
    createdAt: snapshot?.createdAt || versionRow.created_at,
  };
}

function parseSnapshotId(snapshotId) {
  if (!snapshotId || typeof snapshotId !== 'string') {
    return null;
  }
  const parts = snapshotId.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const index = Number(parts[1]);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }
  return { versionId: parts[0], index };
}

async function readSnapshotsFile(versionRow) {
  try {
    const snapshots = await readJson(versionRow.snapshots_path);
    return Array.isArray(snapshots) ? snapshots : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function listSnapshots(db, dataDir, filters = {}) {
  const clauses = [];
  const args = [];

  if (filters.designId) {
    clauses.push('design_id = ?');
    args.push(filters.designId);
  }

  if (filters.versionId) {
    clauses.push('id = ?');
    args.push(filters.versionId);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM versions ${whereClause} ORDER BY created_at DESC`)
    .all(...args);

  const items = [];
  for (const row of rows) {
    const snapshots = await readSnapshotsFile(row);
    snapshots.forEach((snapshot, index) => {
      items.push(normalizeSnapshot(snapshot, row, index));
    });
  }

  return items;
}

async function getSnapshot(db, dataDir, snapshotId) {
  const parsed = parseSnapshotId(snapshotId);
  if (parsed) {
    const row = db.prepare('SELECT * FROM versions WHERE id = ?').get(parsed.versionId);
    if (!row) {
      return null;
    }
    const snapshots = await readSnapshotsFile(row);
    const snapshot = snapshots[parsed.index];
    if (!snapshot) {
      return null;
    }
    return normalizeSnapshot(snapshot, row, parsed.index);
  }

  const snapshots = await listSnapshots(db, dataDir);
  return snapshots.find((snapshot) => snapshot.id === snapshotId) || null;
}

async function deleteSnapshot(db, dataDir, snapshotId) {
  const parsed = parseSnapshotId(snapshotId);
  if (parsed) {
    const row = db.prepare('SELECT * FROM versions WHERE id = ?').get(parsed.versionId);
    if (!row) {
      return null;
    }
    const snapshots = await readSnapshotsFile(row);
    if (!snapshots[parsed.index]) {
      return null;
    }
    const [removed] = snapshots.splice(parsed.index, 1);
    await writeJson(row.snapshots_path, snapshots);
    return normalizeSnapshot(removed, row, parsed.index);
  }

  const rows = db.prepare('SELECT * FROM versions ORDER BY created_at DESC').all();
  for (const row of rows) {
    const snapshots = await readSnapshotsFile(row);
    const index = snapshots.findIndex(
      (snapshot) => snapshot && String(snapshot.id || '') === snapshotId
    );
    if (index === -1) {
      continue;
    }
    const [removed] = snapshots.splice(index, 1);
    await writeJson(row.snapshots_path, snapshots);
    return normalizeSnapshot(removed, row, index);
  }

  return null;
}

async function createComponent(db, dataDir, input) {
  const versionRow = db.prepare('SELECT * FROM versions WHERE id = ?').get(input.versionId);
  if (!versionRow) {
    throw new Error(`version ${input.versionId} not found`);
  }

  const componentId = input.id || crypto.randomUUID();
  const componentPath = getComponentCodePath(
    dataDir,
    versionRow.design_id,
    versionRow.version_number,
    componentId
  );

  const payload = {
    html: input.html || '',
    css: input.css || '',
    structure: input.structure || {},
    preview: input.preview || {},
  };

  await writeJson(componentPath, payload);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO components (
      id, design_id, version_id, name, type, structure_json, code_path, preview_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    componentId,
    versionRow.design_id,
    versionRow.id,
    input.name || '',
    input.type || '',
    JSON.stringify(payload.structure),
    componentPath,
    input.preview?.imageUrl || '',
    now
  );

  const designMeta = await getDesign(db, dataDir, versionRow.design_id);
  if (designMeta) {
    designMeta.stats.components = (designMeta.stats.components || 0) + 1;
    await updateDesign(db, dataDir, versionRow.design_id, designMeta);
  }

  await writeComponentIndex(db, dataDir);

  return {
    id: componentId,
    designId: versionRow.design_id,
    versionId: versionRow.id,
    name: input.name || '',
    type: input.type || '',
    html: payload.html,
    css: payload.css,
    structure: payload.structure,
    preview: payload.preview,
    createdAt: now,
  };
}

async function listComponents(db, dataDir, filters = {}) {
  const applyFilters = (items) =>
    items.filter((item) => {
      if (filters.designId && item.designId !== filters.designId) {
        return false;
      }
      if (filters.versionId && item.versionId !== filters.versionId) {
        return false;
      }
      if (filters.type && item.type !== filters.type) {
        return false;
      }
      return true;
    });

  if (shouldUseIndex()) {
    const indexData = await readIndexFile(getComponentsIndexPath(dataDir));
    if (indexData) {
      return applyFilters(indexData);
    }
  }

  const clauses = [];
  const args = [];

  if (filters.designId) {
    clauses.push('design_id = ?');
    args.push(filters.designId);
  }

  if (filters.versionId) {
    clauses.push('version_id = ?');
    args.push(filters.versionId);
  }

  if (filters.type) {
    clauses.push('type = ?');
    args.push(filters.type);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM components ${whereClause} ORDER BY created_at DESC`).all(...args);
  return rows.map((row) => ({
    id: row.id,
    designId: row.design_id,
    versionId: row.version_id,
    name: row.name,
    type: row.type,
    createdAt: row.created_at,
  }));
}

async function getComponent(db, dataDir, componentId) {
  const row = db.prepare('SELECT * FROM components WHERE id = ?').get(componentId);
  if (!row) {
    return null;
  }

  const payload = await readJson(row.code_path);
  return {
    id: row.id,
    designId: row.design_id,
    versionId: row.version_id,
    name: row.name,
    type: row.type,
    html: payload.html,
    css: payload.css,
    structure: payload.structure,
    preview: payload.preview,
    createdAt: row.created_at,
  };
}

async function deleteComponent(db, dataDir, componentId) {
  const row = db.prepare('SELECT * FROM components WHERE id = ?').get(componentId);
  if (!row) {
    return;
  }

  db.prepare('DELETE FROM components WHERE id = ?').run(componentId);
  await removePath(path.dirname(row.code_path));

  const designMeta = await getDesign(db, dataDir, row.design_id);
  if (designMeta) {
    designMeta.stats.components = Math.max(0, (designMeta.stats.components || 1) - 1);
    await updateDesign(db, dataDir, row.design_id, designMeta);
  }

  await writeComponentIndex(db, dataDir);
}

async function createRule(db, dataDir, input) {
  const versionRow = db.prepare('SELECT * FROM versions WHERE id = ?').get(input.versionId);
  if (!versionRow) {
    throw new Error(`version ${input.versionId} not found`);
  }

  const ruleId = input.id || crypto.randomUUID();
  const rulePath = getRulePath(
    dataDir,
    versionRow.design_id,
    versionRow.version_number,
    ruleId
  );

  await writeJson(rulePath, input.rawData || {});

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO rules (
      id, version_id, type, name, value, raw_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    ruleId,
    versionRow.id,
    input.type || '',
    input.name || '',
    input.value || '',
    rulePath,
    now
  );

  await writeRuleIndex(db, dataDir);

  return {
    id: ruleId,
    versionId: versionRow.id,
    type: input.type || '',
    name: input.name || '',
    value: input.value || '',
    rawData: input.rawData || {},
    createdAt: now,
  };
}

async function listRules(db, dataDir, versionId) {
  if (shouldUseIndex()) {
    const indexData = await readIndexFile(getRulesIndexPath(dataDir));
    if (indexData) {
      return indexData.filter((item) => item.versionId === versionId);
    }
  }

  const rows = db
    .prepare('SELECT * FROM rules WHERE version_id = ? ORDER BY created_at DESC')
    .all(versionId);
  return rows.map((row) => ({
    id: row.id,
    versionId: row.version_id,
    type: row.type,
    name: row.name,
    value: row.value,
    createdAt: row.created_at,
  }));
}

async function getRule(db, dataDir, ruleId) {
  const row = db.prepare('SELECT * FROM rules WHERE id = ?').get(ruleId);
  if (!row) {
    return null;
  }

  const rawData = await readJson(row.raw_path);
  return {
    id: row.id,
    versionId: row.version_id,
    type: row.type,
    name: row.name,
    value: row.value,
    rawData,
    createdAt: row.created_at,
  };
}

async function deleteRule(db, dataDir, ruleId) {
  const row = db.prepare('SELECT * FROM rules WHERE id = ?').get(ruleId);
  if (!row) {
    return;
  }

  db.prepare('DELETE FROM rules WHERE id = ?').run(ruleId);
  await removePath(row.raw_path);

  await writeRuleIndex(db, dataDir);
}

module.exports = {
  createStorage,
};
