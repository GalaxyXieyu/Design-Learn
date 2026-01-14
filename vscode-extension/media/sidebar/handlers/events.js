(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.handlers = app.handlers || {};

  function getEl(id) {
    return document.getElementById(id);
  }

  function initEvents() {
    const historySearch = getEl('historySearch');
    const historyFilter = getEl('historyFilter');
    const historySort = getEl('historySort');
    if (historySearch) historySearch.addEventListener('input', app.ui.filterHistory);
    if (historyFilter) historyFilter.addEventListener('change', app.ui.filterHistory);
    if (historySort) historySort.addEventListener('change', app.ui.filterHistory);

    const historyList = getEl('historyList');
    if (historyList) {
      historyList.addEventListener('click', app.ui.handleHistoryListClick);
      // 监听 details 展开事件加载子路由
      historyList.addEventListener('toggle', (e) => {
        if (e.target.tagName === 'DETAILS' && app.ui.handleDetailsToggle) {
          app.ui.handleDetailsToggle(e);
        }
      }, true);
    }

    const uiproQuery = getEl('uiproQuery');
    const uiproMode = getEl('uiproMode');
    const uiproDomain = getEl('uiproDomain');
    const uiproStack = getEl('uiproStack');
    const uiproSearchBtn = getEl('uiproSearchBtn');
    const uiproResults = getEl('uiproResults');

    if (uiproMode && app.ui.setUiproMode) {
      uiproMode.addEventListener('change', () => app.ui.setUiproMode(uiproMode.value));
    }

    if (uiproDomain) {
      uiproDomain.addEventListener('change', () => {
        app.state.uipro.domain = uiproDomain.value || 'auto';
      });
    }

    if (uiproStack) {
      uiproStack.addEventListener('change', () => {
        app.state.uipro.stack = uiproStack.value || '';
      });
    }

    if (uiproSearchBtn && app.ui.uiproSearch) {
      uiproSearchBtn.addEventListener('click', () => app.ui.uiproSearch());
    }

    if (uiproQuery && app.ui.uiproSearch) {
      uiproQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') app.ui.uiproSearch();
      });
    }

    if (uiproResults && app.ui.handleUiproResultsClick) {
      uiproResults.addEventListener('click', app.ui.handleUiproResultsClick);
    }

    const analyzeBtn = getEl('analyzeBtn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => {
        if (app.state.isExtracting) return;
        const inputEl = getEl('urlInput');
        const rawUrl = inputEl ? inputEl.value.trim() : '';
        const url = app.utils.normalizeUrlInput(rawUrl);
        if (!url) {
          if (inputEl) {
            inputEl.focus();
            inputEl.placeholder = '请先输入 URL';
            setTimeout(() => { inputEl.placeholder = '输入网页 URL，回车提取'; }, 2000);
          }
          return;
        }
        if (inputEl && url !== rawUrl) inputEl.value = url;
        if (app.state.currentMode === 'all') {
          app.postMessage({ type: 'extractAll', url: url, useAI: true });
        } else {
          app.postMessage({ type: 'extractWithAI', url: url });
        }
      });
    }

    const urlInput = getEl('urlInput');
    if (urlInput) {
      urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && analyzeBtn) analyzeBtn.click();
      });
    }

    const modelModalCloseBtn = getEl('modelModalCloseBtn');
    if (modelModalCloseBtn) modelModalCloseBtn.addEventListener('click', app.ui.closeModelModal);
    const modelModalAddBtn = getEl('modelModalAddBtn');
    if (modelModalAddBtn) modelModalAddBtn.addEventListener('click', app.ui.showModelFormInModal);
    const modelModalSaveBtn = getEl('modelModalSaveBtn');
    if (modelModalSaveBtn) modelModalSaveBtn.addEventListener('click', app.ui.saveModelFromModal);

    const configInputs = ['inlineCSS', 'includeImages', 'includeFonts', 'analyzeColors', 'analyzeTypography', 'analyzeLayout', 'analyzeComponents'];
    configInputs.forEach((id) => {
      const el = getEl(id);
      if (el) el.addEventListener('change', app.ui.saveConfig);
    });

    document.addEventListener('click', (e) => {
      const dropdown = getEl('settingsDropdown');
      const btn = getEl('settingsBtn');
      try {
        if (!dropdown || !btn) return;
        const target = e && e.target ? e.target : null;
        if (!target) {
          dropdown.classList.remove('show');
          return;
        }
        if (!dropdown.contains(target) && !btn.contains(target)) {
          dropdown.classList.remove('show');
        }
      } catch {
        dropdown?.classList?.remove?.('show');
      }
    });

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;

      switch (action) {
        case 'toggleSettings':
          e.stopPropagation();
          app.ui.toggleSettingsMenu();
          break;
        case 'openServerModal':
          app.ui.openServerModal();
          break;
        case 'closeServerModal':
          app.ui.closeServerModal();
          break;
        case 'saveServerUrl':
          app.ui.saveServerUrl();
          break;
        case 'openModelConfig':
          app.ui.openModelConfig();
          break;
        case 'openServerConfig':
          app.ui.openServerModal();
          app.ui.closeSettingsMenu();
          break;
        case 'setMode':
          app.ui.setMode(el.dataset.mode);
          break;
        case 'edit-modal-model':
          app.ui.editModelInModal(el.dataset.id);
          break;
        case 'delete-modal-model':
          app.ui.deleteModelFromModal(el.dataset.id);
          break;
        default:
          break;
      }
    });
  }

  app.handlers.initEvents = initEvents;
})();
