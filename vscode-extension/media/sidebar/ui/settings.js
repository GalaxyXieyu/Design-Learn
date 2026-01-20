(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.ui = app.ui || {};

  function getEl(id) {
    return document.getElementById(id);
  }

  function toggleSettingsMenu() {
    const dropdown = getEl('settingsDropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('show');
  }

  function closeSettingsMenu() {
    const dropdown = getEl('settingsDropdown');
    if (dropdown) dropdown.classList.remove('show');
  }

  function openPromptTemplateConfig() {
    closeSettingsMenu();
    app.postMessage({ type: 'openSettingsPanel', section: 'promptTemplates' });
  }

  function setMode(mode) {
    app.state.currentMode = mode;
    const currentBtn = getEl('modeCurrent');
    const allBtn = getEl('modeAll');
    if (currentBtn) currentBtn.classList.toggle('active', mode === 'current');
    if (allBtn) allBtn.classList.toggle('active', mode === 'all');
  }

  function updateConfig(cfg) {
    const inlineCSS = getEl('inlineCSS');
    const includeImages = getEl('includeImages');
    const includeFonts = getEl('includeFonts');
    const analyzeColors = getEl('analyzeColors');
    const analyzeTypography = getEl('analyzeTypography');
    const analyzeLayout = getEl('analyzeLayout');
    const analyzeComponents = getEl('analyzeComponents');
    if (inlineCSS) inlineCSS.checked = !!cfg.inlineCSS;
    if (includeImages) includeImages.checked = !!cfg.includeImages;
    if (includeFonts) includeFonts.checked = !!cfg.includeFonts;
    if (analyzeColors) analyzeColors.checked = !!cfg.analyzeColors;
    if (analyzeTypography) analyzeTypography.checked = !!cfg.analyzeTypography;
    if (analyzeLayout) analyzeLayout.checked = !!cfg.analyzeLayout;
    if (analyzeComponents) analyzeComponents.checked = !!cfg.analyzeComponents;
  }

  function saveConfig() {
    const inlineCSS = getEl('inlineCSS');
    const includeImages = getEl('includeImages');
    const includeFonts = getEl('includeFonts');
    const analyzeColors = getEl('analyzeColors');
    const analyzeTypography = getEl('analyzeTypography');
    const analyzeLayout = getEl('analyzeLayout');
    const analyzeComponents = getEl('analyzeComponents');
    app.postMessage({
      type: 'saveConfig',
      config: {
        inlineCSS: inlineCSS ? inlineCSS.checked : true,
        includeImages: includeImages ? includeImages.checked : true,
        includeFonts: includeFonts ? includeFonts.checked : true,
        analyzeColors: analyzeColors ? analyzeColors.checked : true,
        analyzeTypography: analyzeTypography ? analyzeTypography.checked : true,
        analyzeLayout: analyzeLayout ? analyzeLayout.checked : true,
        analyzeComponents: analyzeComponents ? analyzeComponents.checked : true
      }
    });
  }

  function setExtracting(status) {
    app.state.isExtracting = status;
    const btn = getEl('analyzeBtn');
    if (!btn) return;
    btn.disabled = status;
    btn.innerHTML = status
      ? '<div class="spinner"></div><span>分析中...</span>'
      : '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg><span>分析</span>';
  }

  app.ui.toggleSettingsMenu = toggleSettingsMenu;
  app.ui.closeSettingsMenu = closeSettingsMenu;
  app.ui.openPromptTemplateConfig = openPromptTemplateConfig;
  app.ui.setMode = setMode;
  app.ui.updateConfig = updateConfig;
  app.ui.saveConfig = saveConfig;
  app.ui.setExtracting = setExtracting;
})();
