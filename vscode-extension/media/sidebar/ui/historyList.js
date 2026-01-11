(function() {
  const app = window.DesignLearnSidebar = window.DesignLearnSidebar || {};
  app.ui = app.ui || {};

  function getEl(id) {
    return document.getElementById(id);
  }

  function renderDesigns(designList) {
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
    const searchEl = getEl('historySearch');
    const filterEl = getEl('historyFilter');
    const sortEl = getEl('historySort');
    const search = (searchEl ? searchEl.value : '').toLowerCase();
    const filter = filterEl ? filterEl.value : 'all';
    const sort = sortEl ? sortEl.value : 'newest';

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
      if (filter === 'all') return true;
      if (filter === 'completed') return it.statusGroup === 'completed';
      if (filter === 'failed') return it.statusGroup === 'failed';
      if (filter === 'processing') return it.statusGroup === 'processing';
      return true;
    });

    const countEl = getEl('snapshotCount');
    if (countEl) countEl.textContent = String(items.length);

    const getDateValue = (v) => {
      const t = Date.parse(v || '');
      return Number.isFinite(t) ? t : 0;
    };

    if (sort === 'oldest') {
      items = items.slice().sort((a, b) => getDateValue(a.date) - getDateValue(b.date));
    } else if (sort === 'grouped') {
      items = items.slice().sort((a, b) => {
        const hostA = a.url ? new URL(a.url).hostname : '';
        const hostB = b.url ? new URL(b.url).hostname : '';
        return hostA.localeCompare(hostB);
      });
    } else {
      items = items.slice().sort((a, b) => getDateValue(b.date) - getDateValue(a.date));
    }

    renderHistoryList(items, sort);
  }

  function renderHistoryList(items, sortMode) {
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

    // 按域名分组模式
    if (sortMode === 'grouped') {
      const domainGroups = {};
      items.forEach((it) => {
        const host = it.url ? new URL(it.url).hostname : '未知域名';
        if (!domainGroups[host]) domainGroups[host] = [];
        domainGroups[host].push(it);
      });

      const renderItemCompact = (it) => {
        app.state.libraryItemsByKey[it.key] = it;
        const path = it.url ? new URL(it.url).pathname : '';
        const statusClass = it.statusGroup === 'processing' ? 'processing' : (it.statusGroup === 'failed' ? 'failed' : 'completed');
        const actions =
          '<button data-action="viewDesign" title="查看分析"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg></button>' +
          '<button data-action="viewDesignHtml" title="查看 HTML"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" stroke-width="2"/></svg></button>' +
          '<button data-action="deleteDesign" title="删除"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2"/></svg></button>';
        return (
          '<div class="history-item domain-item" data-key="' + escapeHtml(it.key) + '">' +
          '<div class="history-item-title" style="font-size:12px;">' + escapeHtml(path || '/') + '</div>' +
          '<div class="history-item-meta"><span class="history-item-status ' + statusClass + '" style="font-size:10px;">' + escapeHtml(it.title || '') + '</span></div>' +
          '<div class="history-item-actions">' + actions + '</div>' +
          '</div>'
        );
      };

      const renderDomainGroup = (domain, list) => {
        const collapsed = !!app.state.libraryGroupCollapsed['domain:' + domain];
        return (
          '<div class="library-group" data-group="domain:' + escapeHtml(domain) + '">' +
          '<div class="library-group-header" data-action="toggleGroup" data-group="domain:' + escapeHtml(domain) + '">' +
          '<div class="library-group-title">' + escapeHtml(domain) + '<span class="panel-badge">' + list.length + '</span></div>' +
          '<svg class="library-group-arrow' + (collapsed ? ' collapsed' : '') + '" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
          '</div>' +
          '<div class="library-group-body' + (collapsed ? ' collapsed' : '') + '" data-group-body="domain:' + escapeHtml(domain) + '">' +
          list.map(renderItemCompact).join('') +
          '</div></div>'
        );
      };

      container.innerHTML = Object.keys(domainGroups).sort().map(domain => renderDomainGroup(domain, domainGroups[domain])).join('');
      return;
    }

    // 默认按状态分组
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
      // 使用服务器返回的 versionCount 显示子路由数量
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
  app.ui.handleDetailsToggle = handleDetailsToggle;
  app.ui.updateRouteList = updateRouteList;
})();
