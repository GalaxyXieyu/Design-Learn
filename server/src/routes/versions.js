const { sendJson } = require('../http/response');
const { readJsonBody } = require('../http/request');

async function handleVersionGet(res, storage, versionId) {
  const version = await storage.getVersion(versionId);
  if (!version) {
    return sendJson(res, 404, { error: 'version_not_found' });
  }
  return sendJson(res, 200, version);
}

async function handleVersionPatch(req, res, storage, versionId) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'styleguideMarkdown')) {
    patch.styleguideMarkdown = body.styleguideMarkdown;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'rules')) {
    patch.rules = body.rules;
  }

  const version = await storage.updateVersion(versionId, patch);
  if (!version) {
    return sendJson(res, 404, { error: 'version_not_found' });
  }
  return sendJson(res, 200, version);
}

function registerVersionRoutes(router, deps) {
  const { storage } = deps;
  router.add('GET', '/api/versions/:versionId', (req, res, ctx) =>
    handleVersionGet(res, storage, ctx.params.versionId)
  );
  router.add('PATCH', '/api/versions/:versionId', (req, res, ctx) =>
    handleVersionPatch(req, res, storage, ctx.params.versionId)
  );
  router.add('PUT', '/api/versions/:versionId', (req, res, ctx) =>
    handleVersionPatch(req, res, storage, ctx.params.versionId)
  );
}

module.exports = {
  registerVersionRoutes,
};
