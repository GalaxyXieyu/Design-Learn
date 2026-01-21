const { sendJson } = require('../http/response');

function handleRoot(req, res) {
  sendJson(res, 200, {
    name: 'design-learn-server',
    status: 'ready',
    endpoints: {
      health: '/api/health',
      importBrowser: '/api/import/browser',
      importUrl: '/api/import/url',
      importJobs: '/api/import/jobs',
      importStream: '/api/import/stream',
      designs: '/api/designs',
      versions: '/api/versions/:id',
      snapshots: '/api/snapshots',
      config: '/api/config',
      promptTemplates: '/api/prompt-templates',
      previews: '/api/previews',
      tasks: '/api/tasks',
      uiproDomains: '/api/uipro/domains',
      uiproStacks: '/api/uipro/stacks',
      uiproSearch: '/api/uipro/search',
      uiproSearchStack: '/api/uipro/search-stack',
      uiproBrowse: '/api/uipro/browse',
      uiproSuggest: '/api/uipro/suggest',
      uiproBrowseStack: '/api/uipro/browse-stack',
      uiproSuggestStack: '/api/uipro/suggest-stack',
      mcp: '/mcp',
      ws: '/ws',
    },
  });
}

function handleHealth(req, res) {
  sendJson(res, 200, {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

function registerRootRoutes(router) {
  router.add('GET', '/', handleRoot);
  router.add('GET', '/api/health', handleHealth);
}

module.exports = {
  registerRootRoutes,
};
