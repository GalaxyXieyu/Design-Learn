(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.ui = app.ui || {};

  function getEl(id) {
    return document.getElementById(id);
  }

  function openServerModal() {
    const modal = getEl('serverModal');
    if (modal) modal.classList.add('show');
  }

  function closeServerModal() {
    const modal = getEl('serverModal');
    if (modal) modal.classList.remove('show');
  }

  function saveServerUrl() {
    const input = getEl('serverUrlInput');
    const url = input ? input.value.trim() : '';
    if (url) {
      app.postMessage({ type: 'updateServerUrl', url: url });
      closeServerModal();
    }
  }

  function updateServerStatus(connected, url) {
    const dot = getEl('serverDot');
    if (dot) {
      dot.className = 'server-dot ' + (connected ? 'connected' : 'disconnected');
      dot.title = connected ? '服务器已连接: ' + url : '服务器未连接';
    }
    const input = getEl('serverUrlInput');
    if (input) input.value = url;
  }

  app.ui.openServerModal = openServerModal;
  app.ui.closeServerModal = closeServerModal;
  app.ui.saveServerUrl = saveServerUrl;
  app.ui.updateServerStatus = updateServerStatus;
})();
