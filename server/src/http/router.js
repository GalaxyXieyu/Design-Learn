function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePath(path) {
  if (path === '/') {
    return { regex: /^\/$/, paramNames: [], score: 0 };
  }

  const segments = path.split('/').filter(Boolean);
  const paramNames = [];
  const pattern = segments
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      return escapeRegExp(segment);
    })
    .join('/');

  const staticCount = segments.filter((segment) => !segment.startsWith(':')).length;
  const score = staticCount * 100 + segments.length;

  return {
    regex: new RegExp(`^/${pattern}$`),
    paramNames,
    score,
  };
}

function createRouter() {
  const routes = [];

  function add(method, path, handler) {
    const compiled = compilePath(path);
    routes.push({
      method,
      path,
      handler,
      regex: compiled.regex,
      paramNames: compiled.paramNames,
      score: compiled.score,
      order: routes.length,
    });
  }

  async function handle(req, res, url, deps) {
    const pathname = url.pathname;
    const matches = [];

    for (const route of routes) {
      const match = route.regex.exec(pathname);
      if (!match) {
        continue;
      }

      const params = {};
      route.paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });

      matches.push({ route, params });
    }

    if (!matches.length) {
      return { handled: false };
    }

    let bestScore = -1;
    for (const match of matches) {
      if (match.route.score > bestScore) {
        bestScore = match.route.score;
      }
    }

    const bestMatches = matches.filter((match) => match.route.score === bestScore);
    const methodCandidates = bestMatches.filter((match) => match.route.method === req.method);
    const methodMatch = methodCandidates.sort((a, b) => a.route.order - b.route.order)[0];

    if (methodMatch) {
      await methodMatch.route.handler(req, res, {
        url,
        params: methodMatch.params,
        deps,
        pathname,
      });
      return { handled: true };
    }

    return { methodNotAllowed: true };
  }

  return { add, handle };
}

module.exports = {
  createRouter,
};
