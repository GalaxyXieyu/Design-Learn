const { sendJson, sendNoContent } = require('../http/response');
const { parseLimitOffset, paginate } = require('../http/request');

async function handleSnapshotsList(res, url, storage) {
  const { limit, offset } = parseLimitOffset(url);
  const filters = {};
  const designId = url.searchParams.get('designId');
  const versionId = url.searchParams.get('versionId');
  if (designId) {
    filters.designId = designId;
  }
  if (versionId) {
    filters.versionId = versionId;
  }
  const snapshots = await storage.listSnapshots(filters);
  const { items, total } = paginate(snapshots, limit, offset);
  return sendJson(res, 200, { items, limit, offset, total });
}

async function handleSnapshotGet(res, storage, snapshotId) {
  const snapshot = await storage.getSnapshot(snapshotId);
  if (!snapshot) {
    return sendJson(res, 404, { error: 'snapshot_not_found' });
  }
  return sendJson(res, 200, snapshot);
}

async function handleSnapshotDelete(res, storage, snapshotId) {
  const snapshot = await storage.deleteSnapshot(snapshotId);
  if (!snapshot) {
    return sendJson(res, 404, { error: 'snapshot_not_found' });
  }
  return sendNoContent(res);
}

function registerSnapshotRoutes(router, deps) {
  const { storage } = deps;
  router.add('GET', '/api/snapshots', (req, res, ctx) => handleSnapshotsList(res, ctx.url, storage));
  router.add('GET', '/api/snapshots/:snapshotId', (req, res, ctx) =>
    handleSnapshotGet(res, storage, ctx.params.snapshotId)
  );
  router.add('DELETE', '/api/snapshots/:snapshotId', (req, res, ctx) =>
    handleSnapshotDelete(res, storage, ctx.params.snapshotId)
  );
}

module.exports = {
  registerSnapshotRoutes,
};
