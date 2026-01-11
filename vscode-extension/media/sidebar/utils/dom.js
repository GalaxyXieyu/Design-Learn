(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.utils = app.utils || {};

  app.utils.findButtonFromEventTarget = function(target, stopAtEl) {
    let el = target;
    while (el && el !== stopAtEl) {
      if (el.tagName === 'BUTTON') return el;
      el = el.parentNode;
    }
    return null;
  };

  app.utils.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
})();
