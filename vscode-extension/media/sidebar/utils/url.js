(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.utils = app.utils || {};

  app.utils.normalizeUrlInput = function(rawValue) {
    const value = (rawValue || '').trim();
    if (!value) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) return value;
    if (value.startsWith('//')) return 'https:' + value;
    return 'https://' + value;
  };

  app.utils.normalizeBaseUrlKey = function(url) {
    try {
      const u = new URL(url);
      const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
      return u.origin + path;
    } catch {
      return (url || '').replace(/\/$/, '');
    }
  };
})();
