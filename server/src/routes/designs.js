const { sendJson, sendNoContent } = require('../http/response');
const { readJsonBody, parseLimitOffset, paginate } = require('../http/request');

function handleDesignList(res, url, storage) {
  const { limit, offset } = parseLimitOffset(url);
  const designs = storage.listDesigns();
  const { items, total } = paginate(designs, limit, offset);
  sendJson(res, 200, { items, limit, offset, total });
}

async function handleDesignCreate(req, res, storage) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const design = await storage.createDesign(body);
  sendJson(res, 201, design);
}

async function handleDesignGet(res, storage, designId) {
  const design = await storage.getDesign(designId);
  if (!design) {
    return sendJson(res, 404, { error: 'design_not_found' });
  }
  return sendJson(res, 200, design);
}

async function handleDesignPatch(req, res, storage, designId) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const design = await storage.updateDesign(designId, body);
  if (!design) {
    return sendJson(res, 404, { error: 'design_not_found' });
  }
  return sendJson(res, 200, design);
}

async function handleDesignDelete(res, storage, designId) {
  const design = await storage.getDesign(designId);
  if (!design) {
    return sendJson(res, 404, { error: 'design_not_found' });
  }
  await storage.deleteDesign(designId);
  return sendNoContent(res);
}

function registerDesignRoutes(router, deps) {
  const { storage } = deps;
  router.add('GET', '/api/designs', (req, res, ctx) => handleDesignList(res, ctx.url, storage));
  router.add('POST', '/api/designs', (req, res) => handleDesignCreate(req, res, storage));
  router.add('GET', '/api/designs/:designId', (req, res, ctx) =>
    handleDesignGet(res, storage, ctx.params.designId)
  );
  router.add('PATCH', '/api/designs/:designId', (req, res, ctx) =>
    handleDesignPatch(req, res, storage, ctx.params.designId)
  );
  router.add('DELETE', '/api/designs/:designId', (req, res, ctx) =>
    handleDesignDelete(res, storage, ctx.params.designId)
  );
}

module.exports = {
  registerDesignRoutes,
};
