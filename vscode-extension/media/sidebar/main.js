const vscode = acquireVsCodeApi();
let isExtracting = false;
let models = [];
let selectedModelId = '';
let editingModelId = null;
let currentMode = 'current';
let allDesigns = [];
let libraryItemsByKey = {};
const libraryGroupCollapsed = { processing: false, failed: false, completed: false };
const routesByBaseUrl = new Map();
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

function restoreRoutesState() {
  try {
    const state = vscode.getState() || {};
    const saved = state.routesByBaseUrl || {};
    Object.keys(saved).forEach((key) => {
      routesByBaseUrl.set(key, saved[key]);
    });
  } catch {}
}

function persistRoutesState() {
  try {
    const state = vscode.getState() || {};
    const saved = {};
    routesByBaseUrl.forEach((value, key) => {
      saved[key] = value;
    });
    vscode.setState({ ...state, routesByBaseUrl: saved });
  } catch {}
}

restoreRoutesState();

function formatProgress(message, progress) {
  const label = progressLabelMap[message] || message || '处理中';
  if (typeof progress === 'number') return label + ' · ' + Math.round(progress) + '%';
  return label;
}

function formatErrorMessage(error) {
  if (!error) return '';
  const key = String(error).trim();
  return errorLabelMap[key] || key;
}

function normalizeUrlInput(rawValue) {
  const value = (rawValue || '').trim();
  if (!value) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) return value;
  if (value.startsWith('//')) return 'https:' + value;
  return 'https://' + value;
}

function normalizeBaseUrlKey(url) {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    return u.origin + path;
  } catch {
    return (url || '').replace(/\/$/, '');
  }
}

function getRoutesForUrl(url) {
  const key = normalizeBaseUrlKey(url);
  return routesByBaseUrl.get(key) || null;
}

// 全局事件委托处理所有 data-action
document.addEventListener('click', function(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case 'toggleSettings':
      e.stopPropagation();
      toggleSettingsMenu();
      break;
    case 'openServerModal':
      document.getElementById('serverModal').classList.add('show');
      break;
    case 'closeServerModal':
      document.getElementById('serverModal').classList.remove('show');
      break;
    case 'saveServerUrl':
      saveServerUrl();
      break;
    case 'openModelConfig':
      openModelConfig();
      break;
    case 'openServerConfig':
      document.getElementById('serverModal').classList.add('show');
      closeSettingsMenu();
      break;
    case 'setMode':
      setMode(el.dataset.mode);
      break;
    case 'edit-modal-model':
      editModelInModal(el.dataset.id);
      break;
    case 'delete-modal-model':
      deleteModelFromModal(el.dataset.id);
      break;
    case 'edit-model':
      e.stopPropagation();
      editModel(el.dataset.id);
      break;
    case 'delete-model':
      e.stopPropagation();
      deleteModel(el.dataset.id);
      break;
  }
});

// 搜索和筛选事件
document.getElementById('historySearch').addEventListener('input', filterHistory);
document.getElementById('historyFilter').addEventListener('change', filterHistory);
document.getElementById('historySort').addEventListener('change', filterHistory);

function findButtonFromEventTarget(target, stopAtEl) {
  let el = target;
  while (el && el !== stopAtEl) {
    if (el.tagName === 'BUTTON') return el;
    el = el.parentNode;
  }
  return null;
}

(function initActionDelegates() {
  const modalCloseBtn = document.getElementById('modelModalCloseBtn');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModelModal);
  const modalAddBtn = document.getElementById('modelModalAddBtn');
  if (modalAddBtn) modalAddBtn.addEventListener('click', showModelFormInModal);
  const modalSaveBtn = document.getElementById('modelModalSaveBtn');
  if (modalSaveBtn) modalSaveBtn.addEventListener('click', saveModelFromModal);

  const modalList = document.getElementById('modelModalList');
  if (modalList) {
    modalList.addEventListener('click', function(e) {
      const btn = findButtonFromEventTarget(e && e.target, modalList);
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (!action || !id) return;
      if (action === 'edit-modal-model') editModelInModal(id);
      if (action === 'delete-modal-model') deleteModelFromModal(id);
    });
  }

  const modelList = document.getElementById('modelList');
  if (modelList) {
    modelList.addEventListener('click', function(e) {
      const btn = findButtonFromEventTarget(e && e.target, modelList);
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (!action || !id) return;
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (action === 'edit-model') editModel(id);
      if (action === 'delete-model') deleteModel(id);
    });
  }
})();

function toggleSettingsMenu() {
  const dropdown = document.getElementById('settingsDropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('show');
}

function closeSettingsMenu() {
  document.getElementById('settingsDropdown').classList.remove('show');
}

function openModelConfig() {
  closeSettingsMenu();
  renderModelListInModal();
  document.getElementById('modelModal').classList.add('show');
}

function closeModelModal() {
  document.getElementById('modelModal').classList.remove('show');
  document.getElementById('modelModalForm').style.display = 'none';
  document.getElementById('modelModalList').style.display = 'block';
  document.getElementById('modelModalSaveBtn').style.display = 'none';
  document.getElementById('modelModalAddBtn').style.display = 'inline-block';
}

function renderModelListInModal() {
  const container = document.getElementById('modelModalList');
  if (!models.length) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--vscode-descriptionForeground);">暂无模型</div>';
    return;
  }
  const editIcon = '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>';
  const deleteIcon = '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  container.innerHTML = models.map(m =>
    '<div class="modal-model-item">' +
    '<div class="modal-model-info"><div class="modal-model-name">' + m.name + '</div>' +
    '<div class="modal-model-id">' + m.modelId + '</div></div>' +
    '<div class="modal-model-actions">' +
    '<button class="modal-icon-btn" type="button" title="编辑" data-action="edit-modal-model" data-id="' + m.id + '">' + editIcon + '</button>' +
    '<button class="modal-icon-btn delete" type="button" title="删除" data-action="delete-modal-model" data-id="' + m.id + '">' + deleteIcon + '</button>' +
    '</div></div>'
  ).join('');
}

let editingModalModelId = null;

function showModelFormInModal() {
  editingModalModelId = null;
  document.getElementById('modelModalForm').style.display = 'block';
  document.getElementById('modelModalList').style.display = 'none';
  document.getElementById('modelModalSaveBtn').style.display = 'inline-block';
  document.getElementById('modelModalAddBtn').style.display = 'none';
  document.getElementById('modalModelName').value = '';
  document.getElementById('modalModelApiKey').value = '';
  document.getElementById('modalModelBaseUrl').value = '';
  document.getElementById('modalModelId').value = '';
}

function showModelListInModal() {
  document.getElementById('modelModalForm').style.display = 'none';
  document.getElementById('modelModalList').style.display = 'block';
  document.getElementById('modelModalSaveBtn').style.display = 'none';
  document.getElementById('modelModalAddBtn').style.display = 'inline-block';
}

function upsertLocalModel(model) {
  const idx = models.findIndex(x => x.id === model.id);
  if (idx >= 0) {
    models[idx] = model;
  } else {
    models.push(model);
  }
  if (!selectedModelId && models.length === 1) selectedModelId = model.id;
}

function editModelInModal(id) {
  const m = models.find(x => x.id === id);
  if (!m) return;
  editingModalModelId = id;
  document.getElementById('modelModalForm').style.display = 'block';
  document.getElementById('modelModalList').style.display = 'none';
  document.getElementById('modelModalSaveBtn').style.display = 'inline-block';
  document.getElementById('modelModalAddBtn').style.display = 'none';
  document.getElementById('modalModelName').value = m.name || '';
  document.getElementById('modalModelProvider').value = m.provider || 'openai';
  document.getElementById('modalModelApiKey').value = m.apiKey || '';
  document.getElementById('modalModelBaseUrl').value = m.baseUrl || '';
  document.getElementById('modalModelId').value = m.modelId || '';
}

function saveModelFromModal() {
  const model = {
    id: editingModalModelId || Date.now().toString(),
    name: document.getElementById('modalModelName').value.trim(),
    provider: document.getElementById('modalModelProvider').value,
    apiKey: document.getElementById('modalModelApiKey').value.trim(),
    baseUrl: document.getElementById('modalModelBaseUrl').value.trim() || null,
    modelId: document.getElementById('modalModelId').value.trim()
  };
  if (!model.name || !model.apiKey || !model.modelId) {
    alert('请填写名称、API Key 和 Model ID');
    return;
  }
  upsertLocalModel(model);
  vscode.postMessage({type:'saveModel', model});
  renderModelListInModal();
  showModelListInModal();
}

function deleteModelFromModal(id) {
  models = models.filter(m => m.id !== id);
  if (selectedModelId === id) selectedModelId = '';
  vscode.postMessage({type:'deleteModel', modelId: id});
  renderModelListInModal();
}

document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('settingsDropdown');
  const btn = document.getElementById('settingsBtn');
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

function togglePanel(id) {
  document.getElementById(id).classList.toggle('collapsed');
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById('modeCurrent').classList.toggle('active', mode === 'current');
  document.getElementById('modeAll').classList.toggle('active', mode === 'all');
}

function renderDesigns(designList) {
  allDesigns = designList || [];
  const hasActive = (allDesigns || []).some(d => {
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
  vscode.postMessage({ type: hasActive ? 'startDesignPolling' : 'stopDesignPolling' });
  filterHistory();
}

function stripOriginFromUrl(url) {
  if (!url) return '';
  const idx = url.indexOf('://');
  if (idx < 0) return url;
  const rest = url.slice(idx + 3);
  const slash = rest.indexOf('/');
  if (slash < 0) return '/';
  return rest.slice(slash);
}

function deleteDesign(id) { vscode.postMessage({type:'deleteDesign', designId: id}); }

document.getElementById('analyzeBtn').onclick = () => {
  if (isExtracting) return;
  const inputEl = document.getElementById('urlInput');
  const rawUrl = inputEl.value.trim();
  const url = normalizeUrlInput(rawUrl);
  if (!url) {
    inputEl.focus();
    inputEl.placeholder = '请先输入 URL';
    setTimeout(() => { inputEl.placeholder = '输入网页 URL，回车提取'; }, 2000);
    return;
  }
  if (url !== rawUrl) inputEl.value = url;
  if (currentMode === 'all') {
    vscode.postMessage({type:'extractAll', url, useAI: true});
  } else {
    vscode.postMessage({type:'extractWithAI', url});
  }
};

document.getElementById('urlInput').onkeypress = (e) => {
  if (e.key === 'Enter') document.getElementById('analyzeBtn').click();
};

function saveServerUrl() {
  const url = document.getElementById('serverUrlInput').value.trim();
  if (url) {
    vscode.postMessage({type:'updateServerUrl', url});
    document.getElementById('serverModal').classList.remove('show');
  }
}

function updateServerStatus(connected, url) {
  const dot = document.getElementById('serverDot');
  if (dot) {
    dot.className = 'server-dot ' + (connected ? 'connected' : 'disconnected');
    dot.title = connected ? '服务器已连接: ' + url : '服务器未连接';
  }
  const input = document.getElementById('serverUrlInput');
  if (input) input.value = url;
}

function renderModels() {
  const container = document.getElementById('modelList');
  if (!models.length) {
    container.innerHTML = '<div class="empty-state"><p>尚未配置 AI 模型</p></div>';
    return;
  }
  container.innerHTML = models.map(m => {
    const isSelected = m.id === selectedModelId;
    const initial = (m.name || 'AI')[0].toUpperCase();
    return '<div class="model-item' + (isSelected ? ' selected' : '') + '" data-id="' + m.id + '">' +
      '<div class="model-icon">' + initial + '</div>' +
      '<div class="model-info"><div class="model-name">' + m.name + '</div><div class="model-id">' + m.modelId + '</div></div>' +
      '<div class="model-actions">' +
      '<button data-action="edit-model" data-id="' + m.id + '"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg></button>' +
      '<button class="delete" data-action="delete-model" data-id="' + m.id + '"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
      '</div></div>';
  }).join('');

  container.querySelectorAll('.model-item').forEach(el => {
    el.addEventListener('click', () => {
      vscode.postMessage({type:'selectModel', modelId: el.dataset.id});
    });
  });
}

function showModelForm(model) {
  editingModelId = model ? model.id : null;
  document.getElementById('addModelBtn').style.display = 'none';
  document.getElementById('modelForm').style.display = 'block';
  document.getElementById('modelForm').innerHTML =
    '<div class="model-form">' +
    '<div class="form-row"><div class="form-group"><label>名称</label><input type="text" id="mName" value="' + (model?.name || '') + '" placeholder="如 GPT-4"></div>' +
    '<div class="form-group"><label>类型</label><select id="mProvider"><option value="openai"' + (model?.provider === 'openai' ? ' selected' : '') + '>OpenAI</option><option value="anthropic"' + (model?.provider === 'anthropic' ? ' selected' : '') + '>Anthropic</option><option value="custom"' + (model?.provider === 'custom' ? ' selected' : '') + '>自定义</option></select></div></div>' +
    '<div class="form-group"><label>API Key</label><input type="password" id="mApiKey" value="' + (model?.apiKey || '') + '" placeholder="sk-..."></div>' +
    '<div class="form-row"><div class="form-group"><label>Base URL (可选)</label><input type="text" id="mBaseUrl" value="' + (model?.baseUrl || '') + '" placeholder="自定义 API 地址"></div>' +
    '<div class="form-group"><label>模型 ID</label><input type="text" id="mModelId" value="' + (model?.modelId || '') + '" placeholder="如 gpt-4"></div></div>' +
    '<div class="form-actions"><button class="cancel" onclick="hideModelForm()">取消</button><button class="save" onclick="saveModel()">保存</button></div>' +
    '</div>';
}

function hideModelForm() {
  editingModelId = null;
  document.getElementById('addModelBtn').style.display = 'flex';
  document.getElementById('modelForm').style.display = 'none';
}

function saveModel() {
  const model = {
    id: editingModelId || Date.now().toString(),
    name: document.getElementById('mName').value.trim(),
    provider: document.getElementById('mProvider').value,
    apiKey: document.getElementById('mApiKey').value.trim(),
    baseUrl: document.getElementById('mBaseUrl').value.trim() || null,
    modelId: document.getElementById('mModelId').value.trim()
  };
  if (!model.name || !model.apiKey || !model.modelId) {
    alert('请填写名称、API Key 和模型 ID');
    return;
  }
  vscode.postMessage({type:'saveModel', model});
  hideModelForm();
}

function editModel(id) {
  const model = models.find(m => m.id === id);
  if (model) showModelForm(model);
}

function deleteModel(id) {
  if (confirm('确定删除这个模型？')) {
    vscode.postMessage({type:'deleteModel', modelId: id});
  }
}

function filterHistory() {
  const search = (document.getElementById('historySearch').value || '').toLowerCase();
  const filter = document.getElementById('historyFilter').value;
  const sort = document.getElementById('historySort').value;

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

  let items = (allDesigns || [])
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
      versionId: d.metadata ? d.metadata.lastImportVersionId : null
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

  document.getElementById('snapshotCount').textContent = String(items.length);

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

  renderHistoryList(items);
}

function renderHistoryList(items) {
  const c = document.getElementById('historyList');
  libraryItemsByKey = {};
  if (!items.length) {
    c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--vscode-descriptionForeground);">暂无记录</div>';
    return;
  }

  const groups = { processing: [], failed: [], completed: [] };
  items.forEach((it) => {
    if (!groups[it.statusGroup]) groups[it.statusGroup] = [];
    groups[it.statusGroup].push(it);
  });

  const renderItem = (it) => {
    libraryItemsByKey[it.key] = it;
    const statusText = it.statusGroup === 'processing' ? '处理中' : (it.statusGroup === 'failed' ? '失败' : '已完成');
    const statusClass = it.statusGroup === 'processing' ? 'processing' : (it.statusGroup === 'failed' ? 'failed' : 'completed');
    const metaLeft = it.date ? it.date : '';
    const routeInfo = it.url ? getRoutesForUrl(it.url) : null;
    const routeList = routeInfo && Array.isArray(routeInfo.routes) ? routeInfo.routes : [];
    const routeSummary = routeList.length ? `子路由 ${routeList.length}` : '';
    const routeBlock = routeList.length
      ? '<details class="route-details"><summary>' + routeSummary + '</summary>' +
        '<div class="route-list">' + routeList.map(r => '<div class="route-item">' + r + '</div>').join('') + '</div>' +
        '</details>'
      : '';
    const subline =
      (it.url ? '<div class="history-item-url">' + it.url + '</div>' : '') +
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
      '<button data-action="viewDesign" title="查看详情"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg><span>查看</span></button>' +
      '<button data-action="copyMcp" title="复制 MCP URI"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>复制</span></button>' +
      '<button data-action="deleteDesign" title="删除记录"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>删除</span></button>';

    return (
      '<div class="history-item" data-key="' + it.key + '">' +
      '<div class="history-item-title">' + (it.title || '') + '</div>' +
      subline +
      '<div class="history-item-meta">' +
      '<span class="history-item-meta-left">' + metaLeft + '</span>' +
      '<span class="history-item-status ' + statusClass + '">' + statusText + '</span>' +
      '</div>' +
      '<div class="history-item-actions">' + actions + '</div>' +
      '</div>'
    );
  };

  const renderGroup = (key, title) => {
    const list = groups[key] || [];
    if (!list.length) return '';
    const collapsed = !!libraryGroupCollapsed[key];
    return (
      '<div class="library-group" data-group="' + key + '">' +
      '<div class="library-group-header" data-action="toggleGroup" data-group="' + key + '">' +
      '<div class="library-group-title">' + title + '<span class="panel-badge">' + list.length + '</span></div>' +
      '<svg class="library-group-arrow' + (collapsed ? ' collapsed' : '') + '" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</div>' +
      '<div class="library-group-body' + (collapsed ? ' collapsed' : '') + '" data-group-body="' + key + '">' +
      list.map(renderItem).join('') +
      '</div></div>'
    );
  };

  c.innerHTML =
    renderGroup('processing', '处理中') +
    renderGroup('failed', '失败') +
    renderGroup('completed', '已完成');
}

const historyListEl = document.getElementById('historyList');
if (historyListEl) {
  historyListEl.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.dataset.action;
    if (action === 'toggleGroup') {
      const group = btn.dataset.group;
      if (!group) return;
      libraryGroupCollapsed[group] = !libraryGroupCollapsed[group];
      filterHistory();
      return;
    }

    const itemEl = btn.closest('.history-item');
    if (!itemEl) return;
    const key = itemEl.dataset.key;
    const it = key ? libraryItemsByKey[key] : null;
    if (!it) return;

    if (action === 'viewDesign' && it.type === 'design') {
      vscode.postMessage({type:'viewDesign', designId: it.id});
    } else if (action === 'copyMcp' && it.type === 'design') {
      vscode.postMessage({type:'copyDesignMcpUri', designId: it.id});
      btn.textContent = '已复制';
      setTimeout(() => btn.textContent = '复制MCP', 1500);
    } else if (action === 'retryDesign' && it.type === 'design') {
      vscode.postMessage({type:'extract', url: it.url});
    } else if (action === 'deleteDesign' && it.type === 'design') {
      deleteDesign(it.id);
    }
  });
}

function saveConfig() {
  vscode.postMessage({
    type: 'saveConfig',
    config: {
      inlineCSS: document.getElementById('inlineCSS').checked,
      includeImages: document.getElementById('includeImages').checked,
      includeFonts: document.getElementById('includeFonts').checked,
      analyzeColors: document.getElementById('analyzeColors').checked,
      analyzeTypography: document.getElementById('analyzeTypography').checked,
      analyzeLayout: document.getElementById('analyzeLayout').checked,
      analyzeComponents: document.getElementById('analyzeComponents').checked
    }
  });
}

function updateConfig(cfg) {
  document.getElementById('inlineCSS').checked = cfg.inlineCSS;
  document.getElementById('includeImages').checked = cfg.includeImages;
  document.getElementById('includeFonts').checked = cfg.includeFonts;
  document.getElementById('analyzeColors').checked = cfg.analyzeColors;
  document.getElementById('analyzeTypography').checked = cfg.analyzeTypography;
  document.getElementById('analyzeLayout').checked = cfg.analyzeLayout;
  document.getElementById('analyzeComponents').checked = cfg.analyzeComponents;
}

function setExtracting(status) {
  isExtracting = status;
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = status;
  btn.innerHTML = status
    ? '<div class="spinner"></div><span>分析中...</span>'
    : '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg><span>分析</span>';
}

window.addEventListener('message', e => {
  const msg = e.data;
  if (msg.type === 'updateModels') {
    models = msg.models || [];
    selectedModelId = msg.selectedModelId || '';
    renderModels();
    const modal = document.getElementById('modelModal');
    const modalList = document.getElementById('modelModalList');
    const modalForm = document.getElementById('modelModalForm');
    if (modal?.classList?.contains?.('show') && modalList && modalForm && modalForm.style.display !== 'block') {
      renderModelListInModal();
    }
  }
  if (msg.type === 'updateDesigns') renderDesigns(msg.items || []);
  if (msg.type === 'updateConfig') updateConfig(msg.config);
  if (msg.type === 'extracting') setExtracting(msg.status);
  if (msg.type === 'serverStatus') updateServerStatus(msg.connected, msg.url);
  if (msg.type === 'routesScanned') {
    const key = normalizeBaseUrlKey(msg.baseUrl || '');
    if (key) {
      routesByBaseUrl.set(key, {
        routes: Array.isArray(msg.routes) ? msg.routes : [],
        total: msg.total || (Array.isArray(msg.routes) ? msg.routes.length : 0),
        error: msg.error || null
      });
      persistRoutesState();
      filterHistory();
    }
  }
});

(function initModalButtons() {
  const modalCloseBtn = document.getElementById('modelModalCloseBtn');
  const modalAddBtn = document.getElementById('modelModalAddBtn');
  const modalSaveBtn = document.getElementById('modelModalSaveBtn');
  if (modalCloseBtn) modalCloseBtn.onclick = closeModelModal;
  if (modalAddBtn) modalAddBtn.onclick = showModelFormInModal;
  if (modalSaveBtn) modalSaveBtn.onclick = saveModelFromModal;
})();

vscode.postMessage({type:'loadData'});
