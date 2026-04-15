const { sendJson } = require('../http/response');
const { readJsonBody } = require('../http/request');
const { saveDesignAnalysis } = require('../services/designAnalysis');

async function handleAnalysisSave(req, res, storage) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  try {
    const result = await saveDesignAnalysis(storage, body);
    return sendJson(res, 200, result);
  } catch (error) {
    const statusCode = /not found|No versions found/i.test(error.message) ? 404 : 400;
    return sendJson(res, statusCode, { error: error.message });
  }
}

function registerAnalysisRoutes(router, deps) {
  const { storage } = deps;
  router.add('POST', '/api/analysis/save', (req, res) => handleAnalysisSave(req, res, storage));
}

module.exports = {
  registerAnalysisRoutes,
};
