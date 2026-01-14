(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.ui = app.ui || {};

  function getEl(id) {
    return document.getElementById(id);
  }

  function ensureState() {
    if (!app.state) app.state = {};
    if (!app.state.uipro) {
      app.state.uipro = {
        domains: [],
        stacks: [],
        mode: 'domain',
        domain: 'auto',
        stack: 'react',
        query: '',
        lastResult: null,
        lastStackResult: null,
        itemsByKey: {},
      };
    }
    if (!app.state.uipro.itemsByKey) app.state.uipro.itemsByKey = {};
  }

  function setUiproMode(mode) {
    ensureState();
    app.state.uipro.mode = mode === 'stack' ? 'stack' : 'domain';

    const domainEl = getEl('uiproDomain');
    const stackEl = getEl('uiproStack');
    if (domainEl) domainEl.classList.toggle('uipro-hidden', app.state.uipro.mode === 'stack');
    if (stackEl) stackEl.classList.toggle('uipro-hidden', app.state.uipro.mode !== 'stack');
  }

  function updateUiproMeta(domains, stacks) {
    ensureState();
    app.state.uipro.domains = Array.isArray(domains) ? domains : [];
    app.state.uipro.stacks = Array.isArray(stacks) ? stacks : [];

    const domainEl = getEl('uiproDomain');
    if (domainEl) {
      const items = ['auto'].concat(app.state.uipro.domains || []);
      domainEl.innerHTML = items
        .map((d) => {
          const label = d === 'auto' ? '自动识别 Domain' : d;
          return '<option value="' + app.utils.escapeHtml(d) + '">' + app.utils.escapeHtml(label) + '</option>';
        })
        .join('');
      domainEl.value = app.state.uipro.domain || 'auto';
    }

    const stackEl = getEl('uiproStack');
    if (stackEl) {
      const items = app.state.uipro.stacks || [];
      stackEl.innerHTML = items
        .map((s) => '<option value="' + app.utils.escapeHtml(s) + '">' + app.utils.escapeHtml(s) + '</option>')
        .join('');
      if (!items.includes(app.state.uipro.stack)) {
        app.state.uipro.stack = items[0] || '';
      }
      stackEl.value = app.state.uipro.stack || '';
    }

    const modeEl = getEl('uiproMode');
    if (modeEl) modeEl.value = app.state.uipro.mode || 'domain';
    setUiproMode(app.state.uipro.mode);
  }

  function renderUiproEmpty(text) {
    const container = getEl('uiproResults');
    if (!container) return;
    container.innerHTML =
      '<div class="uipro-empty">' + app.utils.escapeHtml(text || '暂无结果') + '</div>';
    const countEl = getEl('uiproResultCount');
    if (countEl) countEl.textContent = '0';
  }

  function renderUiproLoading() {
    const container = getEl('uiproResults');
    if (!container) return;
    container.innerHTML = '<div class="uipro-empty">搜索中...</div>';
    const countEl = getEl('uiproResultCount');
    if (countEl) countEl.textContent = '0';
  }

  function pickTitle(row) {
    const candidates = [
      'Pattern Name',
      'Product Type',
      'Font Pairing Name',
      'Icon Name',
      'Data Type',
      'Style Category',
      'Category',
      'Guideline',
      'Issue',
      'Type',
    ];
    for (const key of candidates) {
      if (typeof row?.[key] === 'string' && row[key].trim()) return row[key].trim();
    }
    for (const [k, v] of Object.entries(row || {})) {
      if (k === '_score') continue;
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '结果';
  }

  function pickSummaryLines(row, maxLines) {
    const lines = [];
    for (const [k, v] of Object.entries(row || {})) {
      if (k === '_score') continue;
      if (typeof v !== 'string') continue;
      const trimmed = v.trim();
      if (!trimmed) continue;
      const compact = trimmed.length > 120 ? trimmed.slice(0, 117) + '...' : trimmed;
      lines.push(k + ': ' + compact);
      if (lines.length >= maxLines) break;
    }
    return lines;
  }

  function findFirstUrl(row) {
    for (const v of Object.values(row || {})) {
      if (typeof v !== 'string') continue;
      const trimmed = v.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    }
    return null;
  }

  function renderUiproResultCommon(result, kind) {
    ensureState();
    app.state.uipro.itemsByKey = {};

    const container = getEl('uiproResults');
    if (!container) return;

    if (!result || typeof result !== 'object') {
      renderUiproEmpty('结果为空');
      return;
    }

    if (result.error) {
      const msg = result.hint || result.message || result.reason || result.error;
      renderUiproEmpty(String(msg));
      return;
    }

    const rows = Array.isArray(result.results) ? result.results : [];
    const countEl = getEl('uiproResultCount');
    if (countEl) countEl.textContent = String(rows.length);

    if (!rows.length) {
      renderUiproEmpty('无匹配结果');
      return;
    }

    const html = rows
      .map((row, i) => {
        const key = kind + ':' + i;
        app.state.uipro.itemsByKey[key] = row;
        const title = pickTitle(row);
        const score = typeof row?._score === 'number' ? row._score : null;
        const summary = pickSummaryLines(row, 3);
        const url = findFirstUrl(row);
        const actions =
          '<button class="uipro-action" data-action="uipro-copy" data-key="' +
          app.utils.escapeHtml(key) +
          '">复制 JSON</button>' +
          (url
            ? '<button class="uipro-action" data-action="uipro-open" data-key="' +
              app.utils.escapeHtml(key) +
              '">打开链接</button>'
            : '');

        return (
          '<div class="uipro-item" data-key="' +
          app.utils.escapeHtml(key) +
          '">' +
          '<div class="uipro-item-title">' +
          app.utils.escapeHtml(title) +
          '</div>' +
          (score !== null
            ? '<div class="uipro-item-meta">score ' + app.utils.escapeHtml(String(score)) + '</div>'
            : '') +
          (summary.length
            ? '<div class="uipro-item-summary">' +
              summary.map((line) => '<div>' + app.utils.escapeHtml(line) + '</div>').join('') +
              '</div>'
            : '') +
          '<div class="uipro-item-actions">' +
          actions +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    container.innerHTML = html;
  }

  function renderUiproSearchResult(result) {
    ensureState();
    app.state.uipro.lastResult = result;
    renderUiproResultCommon(result, 'domain');
  }

  function renderUiproSearchStackResult(result) {
    ensureState();
    app.state.uipro.lastStackResult = result;
    renderUiproResultCommon(result, 'stack');
  }

  function uiproSearch() {
    ensureState();
    const queryEl = getEl('uiproQuery');
    const query = queryEl ? queryEl.value.trim() : '';
    app.state.uipro.query = query;

    if (!query) {
      renderUiproEmpty('请输入关键词');
      return;
    }

    const limit = 10;
    renderUiproLoading();

    if (app.state.uipro.mode === 'stack') {
      const stackEl = getEl('uiproStack');
      const stack = stackEl ? stackEl.value : app.state.uipro.stack;
      app.state.uipro.stack = stack || '';
      app.postMessage({ type: 'searchUiproStack', query, stack, limit });
      return;
    }

    const domainEl = getEl('uiproDomain');
    const domainValue = domainEl ? domainEl.value : app.state.uipro.domain;
    app.state.uipro.domain = domainValue || 'auto';

    const domain = domainValue === 'auto' ? undefined : domainValue;
    app.postMessage({ type: 'searchUipro', query, domain, limit });
  }

  function handleUiproResultsClick(e) {
    ensureState();
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const key = btn.dataset.key;
    if (!action || !key) return;

    const item = app.state.uipro.itemsByKey ? app.state.uipro.itemsByKey[key] : null;
    if (!item) return;

    if (action === 'uipro-copy') {
      const text = JSON.stringify(item, null, 2);
      app.postMessage({ type: 'copyText', text });
      btn.textContent = '已复制';
      setTimeout(() => {
        btn.textContent = '复制 JSON';
      }, 1200);
      return;
    }

    if (action === 'uipro-open') {
      const url = findFirstUrl(item);
      if (url) {
        app.postMessage({ type: 'openExternal', url });
      }
    }
  }

  app.ui.setUiproMode = setUiproMode;
  app.ui.updateUiproMeta = updateUiproMeta;
  app.ui.renderUiproSearchResult = renderUiproSearchResult;
  app.ui.renderUiproSearchStackResult = renderUiproSearchStackResult;
  app.ui.uiproSearch = uiproSearch;
  app.ui.handleUiproResultsClick = handleUiproResultsClick;

  ensureState();
})();

