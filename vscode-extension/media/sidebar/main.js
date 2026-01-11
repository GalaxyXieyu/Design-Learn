(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  if (app.handlers && app.handlers.initMessages) app.handlers.initMessages();
  if (app.handlers && app.handlers.initEvents) app.handlers.initEvents();
  if (app.ui && app.ui.setMode) app.ui.setMode(app.state.currentMode || 'current');
  app.postMessage({ type: 'loadData' });
})();
