(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.vscode = app.vscode || acquireVsCodeApi();
  app.state = app.state || {
    isExtracting: false,
    models: [],
    selectedModelId: '',
    currentMode: 'current',
    allDesigns: [],
    libraryItemsByKey: {},
    libraryGroupCollapsed: { processing: false, failed: false, completed: false },
    batchTask: null,
    uipro: {
      domains: [],
      stacks: [],
      mode: 'domain',
      domain: 'auto',
      stack: 'react',
      query: '',
      lastResult: null,
      lastStackResult: null,
      itemsByKey: {},
    },
  };

  const routesByBaseUrl = new Map();

  app.postMessage = function(message) {
    app.vscode.postMessage(message);
  };

  function restoreRoutesState() {
    try {
      const state = app.vscode.getState() || {};
      const saved = state.routesByBaseUrl || {};
      Object.keys(saved).forEach((key) => {
        routesByBaseUrl.set(key, saved[key]);
      });
    } catch {}
  }

  function persistRoutesState() {
    try {
      const state = app.vscode.getState() || {};
      const saved = {};
      routesByBaseUrl.forEach((value, key) => {
        saved[key] = value;
      });
      app.vscode.setState({ ...state, routesByBaseUrl: saved });
    } catch {}
  }

  app.routes = {
    getRoutesForUrl: function(url) {
      const key = app.utils.normalizeBaseUrlKey(url);
      return routesByBaseUrl.get(key) || null;
    },
    setRoutes: function(baseUrl, data) {
      const key = app.utils.normalizeBaseUrlKey(baseUrl);
      if (!key) return;
      routesByBaseUrl.set(key, data);
      persistRoutesState();
    },
    restore: restoreRoutesState
  };

  restoreRoutesState();
})();
