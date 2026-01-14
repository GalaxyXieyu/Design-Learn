(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.ui = app.ui || {};

  function getEl(id) {
    return document.getElementById(id);
  }

  function ensureLibraryState() {
    if (!app.state) app.state = {};
    if (!app.state.library) {
      app.state.library = {
        source: 'designs',
        domain: 'auto',
        stack: '',
        sortBy: 'latest',
        lastResult: null,
        suggest: null,
      };
    }
    if (!app.state.libraryGroupCollapsed) app.state.libraryGroupCollapsed = {};
    if (!app.state.libraryItemsByKey) app.state.libraryItemsByKey = {};
  }

  function setLibrarySource(source) {
    ensureLibraryState();
    const normalized =
      source === 'uipro-domain' || source === 'uipro-stack' || source === 'designs' ? source : 'designs';
    app.state.library.source = normalized;
    syncLibraryControls();
    refreshLibrary();
  }

  function setLibraryDomain(domain) {
    ensureLibraryState();
    app.state.library.domain = domain || 'auto';
    refreshLibrary();
  }

  function setLibraryStack(stack) {
    ensureLibraryState();
    app.state.library.stack = stack || '';
    refreshLibrary();
  }

  function syncLibraryControls() {
    ensureLibraryState();
    const source = app.state.library.source;
    const sortBy = app.state.library.sortBy;
    const domainEl = getEl('libraryDomain');
    const stackEl = getEl('libraryStack');
    const controlsEl = getEl('libraryControls');
    const toolbarEl = document.querySelector('.history-toolbar');

    // 清理旧版本遗留的“最新”下拉框（VSCode webview 强缓存时可能残留旧 DOM）
    try {
      document.querySelectorAll('.history-toolbar select').forEach((sel) => {
        const id = sel.id || '';
        if (id === 'librarySource' || id === 'libraryDomain' || id === 'libraryStack') return;
        const hasLatest = Array.from(sel.options || []).some((opt) => (opt.textContent || '').trim() === '最新');
        if (hasLatest) sel.remove();
      });
    } catch {
      // ignore
    }

    // 更新筛选器可见性
    if (domainEl) domainEl.classList.toggle('library-hidden', source !== 'uipro-domain');
    if (stackEl) stackEl.classList.toggle('library-hidden', source !== 'uipro-stack');

    const searchEl = getEl('historySearch');
    if (searchEl) {
      searchEl.placeholder =
        source === 'designs'
          ? '搜索模板 / 网站...'
          : source === 'uipro-stack'
            ? '搜索 Stack 指南（button / modal / 表单...）'
            : '搜索 UIPro（dashboard / landing / 配色 / 排版...）';
    }
  }

  function librarySearch() {
    ensureLibraryState();
    const source = app.state.library.source;
    const queryEl = getEl('historySearch');
    const query = queryEl ? queryEl.value.trim() : '';
    if (source === 'designs') {
      filterHistory();
      return;
    }

    // UIPro 模式：无 query 则 browse
    if (!query) {
      refreshLibrary();
      return;
    }

    const limit = 20;
    if (source === 'uipro-stack') {
      const stack = app.state.library.stack || '';
      if (!stack) {
        const container = getEl('historyList');
        if (container) {
          container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--vscode-descriptionForeground);">请先选择 Stack</div>';
        }
        return;
      }
      app.postMessage({ type: 'searchUiproStack', query, stack, limit });
      return;
    }
    const domainValue = app.state.library.domain;
    const domain = domainValue === 'auto' ? undefined : domainValue;
    app.postMessage({ type: 'searchUipro', query, domain, limit });
  }

  function onLibraryQueryInput() {
    ensureLibraryState();
    if (app.state.library.source === 'designs') filterHistory();
  }

  function onLibraryFilterChange() {
    ensureLibraryState();
    if (app.state.library.source === 'designs') filterHistory();
  }

  function refreshLibrary() {
    ensureLibraryState();
    const source = app.state.library.source;
    const queryEl = getEl('historySearch');
    const query = queryEl ? queryEl.value.trim() : '';

    // Designs 仍走本地过滤
    if (source === 'designs') {
      filterHistory();
      const suggestEl = getEl('librarySuggest');
      if (suggestEl) suggestEl.innerHTML = '';
      return;
    }

    // 先拉建议关键词，再拉 browse（query 为空时）
    if (source === 'uipro-stack') {
      const stack = app.state.library.stack || '';
      if (stack) {
        app.postMessage({ type: 'suggestUiproStack', stack, limit: 20 });
        if (!query) app.postMessage({ type: 'browseUiproStack', stack, limit: 20, offset: 0 });
      }
      return;
    }

    const domainValue = app.state.library.domain;
    const domain = domainValue === 'auto' ? undefined : domainValue;
    app.postMessage({ type: 'suggestUipro', domain, limit: 20 });
    if (!query) app.postMessage({ type: 'browseUipro', domain, limit: 20, offset: 0 });
  }

  function updateLibraryUiproMeta(domains, stacks) {
    ensureLibraryState();
    const domainEl = getEl('libraryDomain');
    if (domainEl) {
      const items = ['auto'].concat(Array.isArray(domains) ? domains : []);
      domainEl.innerHTML = items
        .map((d) => {
          const label = d === 'auto' ? '自动识别 Domain' : d;
          return '<option value="' + app.utils.escapeHtml(d) + '">' + app.utils.escapeHtml(label) + '</option>';
        })
        .join('');
      domainEl.value = app.state.library.domain || 'auto';
    }

    const stackEl = getEl('libraryStack');
    if (stackEl) {
      const items = Array.isArray(stacks) ? stacks : [];
      stackEl.innerHTML = items
        .map((s) => '<option value="' + app.utils.escapeHtml(s) + '">' + app.utils.escapeHtml(s) + '</option>')
        .join('');
      if (!items.includes(app.state.library.stack)) {
        app.state.library.stack = items[0] || '';
      }
      stackEl.value = app.state.library.stack || '';
    }

    const sourceEl = getEl('librarySource');
    if (sourceEl) sourceEl.value = app.state.library.source || 'designs';
    syncLibraryControls();
    refreshLibrary();
  }

  function updateLibrarySuggest(result) {
    ensureLibraryState();
    app.state.library.suggest = result;
    const container = getEl('librarySuggest');
    if (!container) return;

    if (!result || typeof result !== 'object' || result.error) {
      container.innerHTML = '';
      return;
    }
    const keywords = Array.isArray(result.keywords) ? result.keywords : [];
    if (!keywords.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = keywords
      .slice(0, 20)
      .map((k) => '<span class="library-chip" data-action="library-chip" data-value="' + app.utils.escapeHtml(k) + '">' + app.utils.escapeHtml(k) + '</span>')
      .join('');
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

  function pickSummary(row, maxLines) {
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
    return '';
  }

  function renderLibraryUiproResult(result) {
    ensureLibraryState();
    app.state.library.lastResult = result;
    renderLibraryUiproCommon(result, { kind: 'domain' });
  }

  function renderLibraryUiproStackResult(result) {
    ensureLibraryState();
    app.state.library.lastResult = result;
    renderLibraryUiproCommon(result, { kind: 'stack' });
  }

  function renderLibraryUiproBrowseResult(result) {
    ensureLibraryState();
    renderLibraryUiproCommon(result, { kind: 'domain', isBrowse: true });
  }

  function renderLibraryUiproBrowseStackResult(result) {
    ensureLibraryState();
    renderLibraryUiproCommon(result, { kind: 'stack', isBrowse: true });
  }

  function renderLibraryUiproCommon(result, options) {
    const container = getEl('historyList');
    if (!container) return;
    const countEl = getEl('snapshotCount');

    app.state.libraryItemsByKey = {};

    if (!result || typeof result !== 'object') {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--vscode-descriptionForeground);">结果为空</div>';
      if (countEl) countEl.textContent = '0';
      return;
    }
    if (result.error) {
      const msg = result.hint || result.message || result.reason || result.error;
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--vscode-descriptionForeground);">' +
        app.utils.escapeHtml(String(msg)) +
        '</div>';
      if (countEl) countEl.textContent = '0';
      return;
    }

    const rows = Array.isArray(result.results) ? result.results : [];
    if (countEl) countEl.textContent = String(rows.length);
    if (!rows.length) {
      const hint = result.hint ? ('<div style="margin-top:6px;color:var(--vscode-descriptionForeground);">' + app.utils.escapeHtml(String(result.hint)) + '</div>') : '';
      container.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--vscode-descriptionForeground);">无匹配结果' + hint + '</div>';
      return;
    }

    const escapeHtml = app.utils.escapeHtml;
    const domainText = options.kind === 'stack' ? ('stack: ' + (result.stack || '')) : ('domain: ' + (result.domain || 'auto'));

    container.innerHTML = rows
      .map((row, i) => {
        const key = 'u:' + (options.kind || 'domain') + ':' + i;
        app.state.libraryItemsByKey[key] = {
          type: 'uipro',
          key,
          kind: options.kind || 'domain',
          domain: result.domain,
          stack: result.stack,
          url: findFirstUrl(row),
          row,
        };

        const title = pickTitle(row);
        const summary = pickSummary(row, 3);
        const score = typeof row?._score === 'number' ? row._score : null;
        const metaLeft = escapeHtml(domainText + (options.isBrowse ? ' · browse' : ''));
        const metaRight = score !== null ? ('score ' + escapeHtml(String(score))) : '';

        const actions =
          '<button data-action="uiproCopy" title="复制 JSON"><span>复制</span></button>' +
          (findFirstUrl(row) ? '<button data-action="uiproOpen" title="打开链接"><span>打开</span></button>' : '');

        return (
          '<div class="history-item" data-key="' + escapeHtml(key) + '">' +
          '<div class="history-item-title">' + escapeHtml(title) + '</div>' +
          (summary.length ? '<div class="history-item-url">' + escapeHtml(summary.join(' | ')) + '</div>' : '') +
          '<div class="history-item-meta">' +
          '<span class="history-item-meta-left">' + metaLeft + '</span>' +
          (metaRight ? '<span class="history-item-status completed">' + metaRight + '</span>' : '<span class="history-item-status completed">UIPro</span>') +
          '</div>' +
          '<div class="history-item-actions">' + actions + '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderDesigns(designList) {
    ensureLibraryState();
    app.state.allDesigns = designList || [];
    const hasActive = (app.state.allDesigns || []).some(d => {
      const meta = d && d.metadata ? d.metadata : null;
      const status = meta ? meta.processingStatus : null;
      if (status === 'processing' || status === 'analyzing') return true;
      const msg = meta ? meta.processingMessage : null;
      if (msg === 'ai_analyzing') return true;
      const aiRequested = meta ? meta.aiRequested : false;
      const aiCompleted = meta ? (meta.processingMessage === 'ai_completed' || meta.aiCompleted) : false;
      if (aiRequested && !aiCompleted) return true;
      const jobStatus = meta ? meta.processingJobStatus : null;
      return jobStatus === 'running' || jobStatus === 'queued';
    });
    app.postMessage({ type: hasActive ? 'startDesignPolling' : 'stopDesignPolling' });
    filterHistory();
  }

  function filterHistory() {
    ensureLibraryState();
    // 非本地模板模式：不走本地过滤
    if (app.state.library.source !== 'designs') {
      return;
    }
    const searchEl = getEl('historySearch');
    const search = (searchEl ? searchEl.value : '').toLowerCase();

    const statusGroupOf = (d) => {
      const meta = d && d.metadata ? d.metadata : null;
      const status = meta ? meta.processingStatus : null;
      if (status === 'failed') return 'failed';
      if (status === 'processing' || status === 'analyzing') return 'processing';
      if (status === 'completed') return 'completed';
      const msgStatus = meta ? meta.processingMessage : null;
      if (msgStatus === 'failed') return 'failed';
      if (msgStatus === 'completed' || msgStatus === 'ai_completed') return 'completed';
      const jobStatus = meta ? meta.processingJobStatus : null;
      if (jobStatus === 'failed') return 'failed';
      if (jobStatus === 'running' || jobStatus === 'queued') return 'processing';
      if (jobStatus === 'completed') return 'completed';
      return 'completed';
    };

    let items = (app.state.allDesigns || [])
      .filter(d => d && d.id)
      .map(d => ({
        key: 'd:' + d.id,
        type: 'design',
        id: d.id,
        title: d.name || (d.url ? (new URL(d.url).hostname || '未命名') : '未命名'),
        url: d.url || '',
        date: d.updatedAt || d.createdAt || '',
        statusGroup: statusGroupOf(d),
        jobId: d.metadata ? d.metadata.processingJobId : null,
        progress: d.metadata ? d.metadata.processingProgress : null,
        progressMessage: d.metadata ? d.metadata.processingMessage : null,
        error: d.metadata ? d.metadata.processingError : null,
        versionId: d.metadata ? d.metadata.lastImportVersionId : null,
        versionCount: d.stats && d.stats.versions ? d.stats.versions : 0
      }));

    items = items.filter(it => {
      if (search) {
        const title = (it.title || '').toLowerCase();
        const url = (it.url || '').toLowerCase();
        const error = (it.error || '').toLowerCase();
        const versionId = (it.versionId || '').toLowerCase();
        if (!title.includes(search) && !url.includes(search) && !error.includes(search) && !versionId.includes(search)) return false;
      }
      return true;
    });

    const countEl = getEl('snapshotCount');
    if (countEl) countEl.textContent = String(items.length);

    const getDateValue = (v) => {
      const t = Date.parse(v || '');
      return Number.isFinite(t) ? t : 0;
    };

    // 默认按日期倒序（最新在前）
    items = items.slice().sort((a, b) => getDateValue(b.date) - getDateValue(a.date));

    renderHistoryList(items);
  }

  function renderHistoryList(items) {
    const container = getEl('historyList');
    if (!container) return;
    app.state.libraryItemsByKey = {};
    if (!items.length && !app.state.batchTask) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--vscode-descriptionForeground);">暂无记录</div>';
      return;
    }

    const escapeHtml = app.utils.escapeHtml;
    const formatProgress = app.utils.formatProgress;
    const formatErrorMessage = app.utils.formatErrorMessage;

    // 按状态分组
    const groups = { processing: [], failed: [], completed: [] };
    items.forEach((it) => {
      if (!groups[it.statusGroup]) groups[it.statusGroup] = [];
      groups[it.statusGroup].push(it);
    });

    const renderItem = (it) => {
      app.state.libraryItemsByKey[it.key] = it;
      const statusText = it.statusGroup === 'processing' ? '处理中' : (it.statusGroup === 'failed' ? '失败' : '已完成');
      const statusClass = it.statusGroup === 'processing' ? 'processing' : (it.statusGroup === 'failed' ? 'failed' : 'completed');
      const metaLeft = it.date ? escapeHtml(it.date) : '';
      const routeCount = it.versionCount > 1 ? it.versionCount : 0;
      const routeBlock = routeCount
        ? '<details class="route-details" data-design-id="' + escapeHtml(it.id) + '">' +
          '<summary>子路由 ' + routeCount + '</summary>' +
          '<div class="route-list" data-routes-for="' + escapeHtml(it.id) + '">加载中...</div>' +
          '</details>'
        : '';
      const subline =
        (it.url ? '<div class="history-item-url">' + escapeHtml(it.url) + '</div>' : '') +
        (it.statusGroup === 'processing'
          ? '<div class="task-progress" style="margin-top:4px;">' + formatProgress(it.progressMessage, it.progress) + '</div>'
          : '') +
        (it.statusGroup === 'failed' && it.error
          ? '<div class="task-progress" style="margin-top:4px;color:#ef4444;">' + formatErrorMessage(it.error) + '</div>'
          : '') +
        (routeBlock ? '<div style="margin-top:6px;">' + routeBlock + '</div>' : '');

      const actions =
        (it.statusGroup === 'failed'
          ? '<button data-action="retryDesign" title="重试导入"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M21 12a9 9 0 10-3.3 6.9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 3v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>重试</span></button>'
          : '') +
        '<button data-action="viewDesign" title="查看分析"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg><span>查看</span></button>' +
        '<button data-action="viewDesignHtml" title="查看 HTML"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>HTML</span></button>' +
        '<button data-action="copyMcp" title="复制 MCP URI"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>复制</span></button>' +
        '<button data-action="deleteDesign" title="删除记录"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>删除</span></button>';

      return (
        '<div class="history-item" data-key="' + escapeHtml(it.key) + '">' +
        '<div class="history-item-title">' + escapeHtml(it.title || '') + '</div>' +
        subline +
        '<div class="history-item-meta">' +
        '<span class="history-item-meta-left">' + metaLeft + '</span>' +
        '<span class="history-item-status ' + statusClass + '">' + statusText + '</span>' +
        '</div>' +
        '<div class="history-item-actions">' + actions + '</div>' +
        '</div>'
      );
    };

    const renderBatchTaskCard = () => {
      const bt = app.state.batchTask;
      if (!bt) return '';
      const title = bt.baseUrl ? (new URL(bt.baseUrl).hostname || '批量导入') : '批量导入';
      const progressText = bt.current + '/' + bt.total + ' 路由';
      const currentRoute = bt.currentRoute ? escapeHtml(bt.currentRoute) : '';
      const routeListHtml = bt.routes.map(r => '<div class="route-item">' + escapeHtml(r) + '</div>').join('');
      return (
        '<div class="history-item batch-task-card">' +
        '<div class="history-item-title">' + escapeHtml(title) + '</div>' +
        '<div class="history-item-url">' + escapeHtml(bt.baseUrl || '') + '</div>' +
        '<div class="task-progress" style="margin-top:4px;">' + progressText + (currentRoute ? ' - ' + currentRoute : '') + '</div>' +
        '<details class="route-details" style="margin-top:6px;"><summary>子路由 ' + bt.routes.length + '</summary>' +
        '<div class="route-list">' + routeListHtml + '</div></details>' +
        '<div class="history-item-meta"><span class="history-item-meta-left"></span><span class="history-item-status processing">处理中</span></div>' +
        '</div>'
      );
    };

    const renderGroup = (key, title) => {
      const list = groups[key] || [];
      const batchCard = (key === 'processing') ? renderBatchTaskCard() : '';
      if (!list.length && !batchCard) return '';
      const collapsed = !!app.state.libraryGroupCollapsed[key];
      const count = list.length + (batchCard ? 1 : 0);
      return (
        '<div class="library-group" data-group="' + key + '">' +
        '<div class="library-group-header" data-action="toggleGroup" data-group="' + key + '">' +
        '<div class="library-group-title">' + title + '<span class="panel-badge">' + count + '</span></div>' +
        '<svg class="library-group-arrow' + (collapsed ? ' collapsed' : '') + '" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</div>' +
        '<div class="library-group-body' + (collapsed ? ' collapsed' : '') + '" data-group-body="' + key + '">' +
        batchCard +
        list.map(renderItem).join('') +
        '</div></div>'
      );
    };

    container.innerHTML =
      renderGroup('processing', '处理中') +
      renderGroup('failed', '失败') +
      renderGroup('completed', '已完成');
  }

  function handleHistoryListClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.dataset.action;
    if (action === 'toggleGroup') {
      const group = btn.dataset.group;
      if (!group) return;
      app.state.libraryGroupCollapsed[group] = !app.state.libraryGroupCollapsed[group];
      filterHistory();
      return;
    }

    const itemEl = btn.closest('.history-item');
    if (!itemEl) return;
    const key = itemEl.dataset.key;
    const it = key ? app.state.libraryItemsByKey[key] : null;
    if (!it) return;

    if (action === 'uiproCopy' && it.type === 'uipro') {
      const text = JSON.stringify(it.row || {}, null, 2);
      app.postMessage({ type: 'copyText', text });
      return;
    }
    if (action === 'uiproOpen' && it.type === 'uipro') {
      const url = it.url || '';
      if (url) app.postMessage({ type: 'openExternal', url });
      return;
    }

    if (action === 'viewDesign' && it.type === 'design') {
      app.postMessage({ type: 'viewDesign', designId: it.id });
    } else if (action === 'viewDesignHtml' && it.type === 'design') {
      app.postMessage({ type: 'viewDesignHtml', designId: it.id });
    } else if (action === 'copyMcp' && it.type === 'design') {
      app.postMessage({ type: 'copyDesignMcpUri', designId: it.id });
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = '复制MCP'; }, 1500);
    } else if (action === 'retryDesign' && it.type === 'design') {
      app.postMessage({ type: 'extract', url: it.url });
    } else if (action === 'deleteDesign' && it.type === 'design') {
      app.postMessage({ type: 'deleteDesign', designId: it.id });
    }
  }

  function handleLibrarySuggestClick(e) {
    const chip = e.target.closest('[data-action="library-chip"]');
    if (!chip) return;
    const value = chip.dataset.value || '';
    const queryEl = getEl('historySearch');
    if (queryEl) queryEl.value = value;
    librarySearch();
  }

  // 处理 details 展开时加载子路由
  function handleDetailsToggle(e) {
    const details = e.target;
    if (!details.open) return;
    const designId = details.dataset.designId;
    if (!designId) return;
    const routeList = details.querySelector('.route-list');
    if (!routeList || routeList.dataset.loaded === 'true') return;

    // 请求加载子路由
    app.postMessage({ type: 'loadDesignSnapshots', designId: designId });
  }

  // 更新子路由列表
  function updateRouteList(designId, snapshots) {
    const routeList = document.querySelector('[data-routes-for="' + designId + '"]');
    if (!routeList) return;
    routeList.dataset.loaded = 'true';

    if (!snapshots || !snapshots.length) {
      routeList.innerHTML = '<div class="route-item" style="color:var(--vscode-descriptionForeground);">无子路由</div>';
      return;
    }

    const escapeHtml = app.utils.escapeHtml;
    routeList.innerHTML = snapshots.map(snap => {
      const path = snap.url ? new URL(snap.url).pathname : '/';
      return '<div class="route-item">' + escapeHtml(path) + '</div>';
    }).join('');
  }

  app.ui.renderDesigns = renderDesigns;
  app.ui.filterHistory = filterHistory;
  app.ui.handleHistoryListClick = handleHistoryListClick;
  app.ui.handleLibrarySuggestClick = handleLibrarySuggestClick;
  app.ui.handleDetailsToggle = handleDetailsToggle;
  app.ui.updateRouteList = updateRouteList;
  app.ui.setLibrarySource = setLibrarySource;
  app.ui.setLibraryDomain = setLibraryDomain;
  app.ui.setLibraryStack = setLibraryStack;
  app.ui.syncLibraryControls = syncLibraryControls;
  app.ui.librarySearch = librarySearch;
  app.ui.onLibraryQueryInput = onLibraryQueryInput;
  app.ui.onLibraryFilterChange = onLibraryFilterChange;
  app.ui.updateLibraryUiproMeta = updateLibraryUiproMeta;
  app.ui.updateLibrarySuggest = updateLibrarySuggest;
  app.ui.renderLibraryUiproResult = renderLibraryUiproResult;
  app.ui.renderLibraryUiproStackResult = renderLibraryUiproStackResult;
  app.ui.renderLibraryUiproBrowseResult = renderLibraryUiproBrowseResult;
  app.ui.renderLibraryUiproBrowseStackResult = renderLibraryUiproBrowseStackResult;
})();
