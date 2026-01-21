const { URL } = require('url');

const { sendJson } = require('../http/response');
const { readJsonBody } = require('../http/request');
const { scanWebsiteRoutes } = require('../services/scanRoutes');

async function handleScanRoutes(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  const url = body.url;
  if (!url) {
    return sendJson(res, 400, { error: 'url_required' });
  }

  try {
    new URL(url);
  } catch {
    return sendJson(res, 400, { error: 'invalid_url' });
  }

  try {
    const routes = await scanWebsiteRoutes(url, body.limit || 10);
    sendJson(res, 200, {
      routes,
      total: routes.length,
      baseUrl: url,
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

function registerScanRoutes(router) {
  router.add('POST', '/api/scan-routes', (req, res) => handleScanRoutes(req, res));
}

module.exports = {
  registerScanRoutes,
};
