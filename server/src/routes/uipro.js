const { sendJson } = require('../http/response');
const { parseLimitOffset } = require('../http/request');

function handleUiproDomains(res, uipro) {
  sendJson(res, 200, {
    source: 'ui-ux-pro-max',
    domains: uipro.domains,
  });
}

function handleUiproStacks(res, uipro) {
  sendJson(res, 200, {
    source: 'ui-ux-pro-max',
    stacks: uipro.stacks,
  });
}

function handleUiproSearch(res, url, uipro) {
  const query = url.searchParams.get('query') || url.searchParams.get('q') || '';
  const domain = url.searchParams.get('domain') || undefined;
  const limitRaw = url.searchParams.get('limit');
  const limitParsed = limitRaw ? Number(limitRaw) : undefined;
  const limit = Number.isFinite(limitParsed) ? limitParsed : 10;

  let data;
  try {
    data = uipro.search({ query, domain, limit });
  } catch {
    data = {
      error: 'uipro_data_unavailable',
      hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
    };
  }

  sendJson(res, 200, data);
}

function handleUiproSearchStack(res, url, uipro) {
  const query = url.searchParams.get('query') || url.searchParams.get('q') || '';
  const stack = url.searchParams.get('stack') || undefined;
  const limitRaw = url.searchParams.get('limit');
  const limitParsed = limitRaw ? Number(limitRaw) : undefined;
  const limit = Number.isFinite(limitParsed) ? limitParsed : 10;

  let data;
  try {
    data = uipro.searchStack({ query, stack, limit });
  } catch {
    data = {
      error: 'uipro_data_unavailable',
      hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
    };
  }

  sendJson(res, 200, data);
}

function handleUiproBrowse(res, url, uipro) {
  const domain = url.searchParams.get('domain') || undefined;
  const { limit, offset } = parseLimitOffset(url);

  let data;
  try {
    data = uipro.browse({ domain, limit, offset });
  } catch {
    data = {
      error: 'uipro_data_unavailable',
      hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
    };
  }

  sendJson(res, 200, data);
}

function handleUiproSuggest(res, url, uipro) {
  const domain = url.searchParams.get('domain') || undefined;
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

  let data;
  try {
    data = uipro.suggest({ domain, limit });
  } catch {
    data = {
      error: 'uipro_data_unavailable',
      hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
    };
  }

  sendJson(res, 200, data);
}

function handleUiproBrowseStack(res, url, uipro) {
  const stack = url.searchParams.get('stack') || undefined;
  const { limit, offset } = parseLimitOffset(url);

  let data;
  try {
    data = uipro.browseStack({ stack, limit, offset });
  } catch {
    data = {
      error: 'uipro_data_unavailable',
      hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
    };
  }

  sendJson(res, 200, data);
}

function handleUiproSuggestStack(res, url, uipro) {
  const stack = url.searchParams.get('stack') || undefined;
  const limitRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

  let data;
  try {
    data = uipro.suggestStack({ stack, limit });
  } catch {
    data = {
      error: 'uipro_data_unavailable',
      hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
    };
  }

  sendJson(res, 200, data);
}

function registerUiproRoutes(router, deps) {
  const { uipro } = deps;
  router.add('GET', '/api/uipro/domains', (req, res) => handleUiproDomains(res, uipro));
  router.add('GET', '/api/uipro/stacks', (req, res) => handleUiproStacks(res, uipro));
  router.add('GET', '/api/uipro/search', (req, res, ctx) => handleUiproSearch(res, ctx.url, uipro));
  router.add('GET', '/api/uipro/search-stack', (req, res, ctx) => handleUiproSearchStack(res, ctx.url, uipro));
  router.add('GET', '/api/uipro/browse', (req, res, ctx) => handleUiproBrowse(res, ctx.url, uipro));
  router.add('GET', '/api/uipro/suggest', (req, res, ctx) => handleUiproSuggest(res, ctx.url, uipro));
  router.add('GET', '/api/uipro/browse-stack', (req, res, ctx) => handleUiproBrowseStack(res, ctx.url, uipro));
  router.add('GET', '/api/uipro/suggest-stack', (req, res, ctx) => handleUiproSuggestStack(res, ctx.url, uipro));
}

module.exports = {
  registerUiproRoutes,
};
