(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.utils = app.utils || {};

  const progressLabelMap = {
    queued: '排队中',
    started: '开始处理',
    normalizing: '解析数据',
    installing_playwright: '安装 Playwright',
    ai_pending: '等待 AI 分析',
    ai_analyzing: 'AI 分析',
    ai_completed: 'AI 分析完成',
    launching_browser: '启动浏览器',
    browser_launched: '浏览器已启动',
    page_loaded: '页面已加载',
    snapshot_ready: '快照完成',
    extracted: '已提取',
    storing_design: '保存设计',
    storing_version: '保存版本',
    stored: '保存完成',
    completed: '已完成',
    failed: '失败'
  };

  const errorLabelMap = {
    playwright_not_installed: '服务端未安装 Playwright',
    url_required: '缺少 URL',
    snapshot_required: '缺少快照数据'
  };

  app.utils.formatProgress = function(message, progress) {
    const label = progressLabelMap[message] || message || '处理中';
    if (typeof progress === 'number') return label + ' · ' + Math.round(progress) + '%';
    return label;
  };

  app.utils.formatErrorMessage = function(error) {
    if (!error) return '';
    const key = String(error).trim();
    return errorLabelMap[key] || key;
  };
})();
