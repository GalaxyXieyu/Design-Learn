(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.handlers = app.handlers || {};

  function initMessages() {
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (!msg || !msg.type) return;
      if (msg.type === 'updateModels') {
        app.ui.updateModels(msg.models || [], msg.selectedModelId || '');
      }
      if (msg.type === 'updateDesigns') app.ui.renderDesigns(msg.items || []);
      if (msg.type === 'updateConfig') app.ui.updateConfig(msg.config || {});
      if (msg.type === 'extracting') app.ui.setExtracting(!!msg.status);
      if (msg.type === 'serverStatus') app.ui.updateServerStatus(msg.connected, msg.url);
      if (msg.type === 'routesScanned') {
        const routes = Array.isArray(msg.routes) ? msg.routes : [];
        const total = msg.total || routes.length;
        app.routes.setRoutes(msg.baseUrl || '', { routes: routes, total: total, error: msg.error || null });
        app.ui.filterHistory();
      }
      if (msg.type === 'batchImportStarted') {
        app.state.batchTask = {
          baseUrl: msg.baseUrl,
          routes: msg.routes || [],
          total: msg.total || 0,
          current: 0,
          currentRoute: ''
        };
        app.ui.filterHistory();
      }
      if (msg.type === 'batchImportProgress') {
        if (app.state.batchTask) {
          app.state.batchTask.current = msg.current || 0;
          app.state.batchTask.currentRoute = msg.route || '';
          app.ui.filterHistory();
        }
      }
      if (msg.type === 'batchImportCompleted') {
        app.state.batchTask = null;
        app.ui.filterHistory();
      }
      if (msg.type === 'designSnapshots') {
        app.ui.updateRouteList(msg.designId, msg.snapshots || []);
      }
      if (msg.type === 'uiproMeta' && app.ui.updateUiproMeta) {
        app.ui.updateUiproMeta(msg.domains || [], msg.stacks || []);
      }
      if (msg.type === 'uiproSearchResult' && app.ui.renderUiproSearchResult) {
        app.ui.renderUiproSearchResult(msg.result);
      }
      if (msg.type === 'uiproSearchStackResult' && app.ui.renderUiproSearchStackResult) {
        app.ui.renderUiproSearchStackResult(msg.result);
      }
    });
  }

  app.handlers.initMessages = initMessages;
})();
