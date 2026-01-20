/**
 * Design-Learn VSCode Extension - Webview Main Script
 * Handles UI interactions and communication with the extension
 */

// VSCode API
const vscode = acquireVsCodeApi();

// State
let currentPage = 'models';
let models = [];

// ============================================================================
// 1. Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  loadData();
});

function initializeEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', switchPage);
  });

  // Close button
  document.getElementById('closeBtn')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'closeWebview' });
  });

  // Models page
  document.getElementById('addModelBtn')?.addEventListener('click', openAddModelForm);

  // Listen for messages from extension
  window.addEventListener('message', handleExtensionMessage);
}

// ============================================================================
// 2. Page Navigation
// ============================================================================

function switchPage(e) {
  const page = e.currentTarget.dataset.page;
  if (!page) return;

  // Update navigation
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  e.currentTarget.classList.add('active');

  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.querySelector(`.page[data-page="${page}"]`);
  if (targetPage) targetPage.classList.add('active');

  currentPage = page;
}

// ============================================================================
// 3. AI Models Management
// ============================================================================

function openAddModelForm() {
  const html = `
    <div class="card" style="grid-column: 1/-1;">
      <h3 class="card-title">添加新模型</h3>
      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label>模型名称</label>
          <input type="text" id="modelName" class="input" placeholder="例如: GPT-4, Claude 3">
        </div>
        <div class="form-group" style="flex:1;">
          <label>API 类型</label>
          <select id="modelProvider" class="input">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">自定义</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>API 密钥</label>
        <input type="password" id="modelApiKey" class="input" placeholder="输入您的 API 密钥">
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label>Base URL (可选)</label>
          <input type="url" id="modelBaseUrl" class="input" placeholder="自定义 API 基址">
        </div>
        <div class="form-group" style="flex:1;">
          <label>模型 ID</label>
          <input type="text" id="modelId" class="input" placeholder="例如: gpt-4, claude-3-opus">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-primary" id="saveModelBtn">保存模型</button>
        <button class="btn-secondary" id="cancelModelBtn">取消</button>
      </div>
    </div>`;
  document.getElementById('modelsContainer').innerHTML = html;
  document.getElementById('saveModelBtn').addEventListener('click', saveModel);
  document.getElementById('cancelModelBtn').addEventListener('click', loadData);
}

function saveModel() {
  const model = {
    id: Date.now().toString(),
    name: document.getElementById('modelName').value,
    provider: document.getElementById('modelProvider').value,
    apiKey: document.getElementById('modelApiKey').value,
    baseUrl: document.getElementById('modelBaseUrl').value || null,
    modelId: document.getElementById('modelId').value,
    isDefault: models.length === 0,
    createdAt: new Date().toISOString()
  };

  if (!model.name || !model.apiKey || !model.modelId) {
    alert('请填写必填项');
    return;
  }

  vscode.postMessage({
    type: 'saveModel',
    model: model
  });
}

function renderModels() {
  const container = document.getElementById('modelsContainer');
  if (models.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>
        <p>还没有添加 AI 模型</p>
        <p style="font-size:14px;color:var(--text-secondary);">点击右上角按钮添加您的第一个模型</p>
      </div>`;
    return;
  }
  container.innerHTML = models.map(model => `
    <div class="model-card-item${model.isDefault ? ' default' : ''}">
      <div class="model-card-header">
        ${model.isDefault ? '<span class="model-card-badge">默认</span>' : '<span></span>'}
        <div class="model-card-actions">
          <button title="删除" onclick="deleteModel('${model.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="model-card-name">${model.name}</div>
      <div class="model-card-info">
        <div class="model-card-info-item"><span class="label">类型</span><span class="value">${model.provider}</span></div>
        <div class="model-card-info-item"><span class="label">模型</span><span class="value">${model.modelId}</span></div>
      </div>
      <div class="model-card-footer">
        <button onclick="setDefaultModel('${model.id}')">设为默认</button>
        <button class="primary" onclick="testModel('${model.id}')">测试连接</button>
      </div>
    </div>`).join('');
}

function deleteModel(modelId) {
  if (confirm('确定要删除这个模型吗?')) {
    vscode.postMessage({
      type: 'deleteModel',
      modelId: modelId
    });
  }
}

function editModel(modelId) {
  console.log('Edit model:', modelId);
}

function setDefaultModel(modelId) {
  models.forEach(m => m.isDefault = (m.id === modelId));
  vscode.postMessage({ type: 'saveModels', models });
  renderModels();
}

function testModel(modelId) {
  const model = models.find(m => m.id === modelId);
  if (!model) {
    alert('未找到模型');
    return;
  }
  
  // 显示测试中状态
  const btn = document.querySelector(`button[onclick="testModel('${modelId}')"]`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '测试中...';
  }
  
  vscode.postMessage({
    type: 'testConnection',
    model: model
  });
}


// ============================================================================
// 6. Data Loading & Communication
// ============================================================================

function loadData() {
  vscode.postMessage({
    type: 'loadData'
  });
}

function handleExtensionMessage(event) {
  const message = event.data;

  switch (message.type) {
    case 'updateData':
      models = message.models || [];
      renderModels();
      break;

    case 'showMessage':
      alert(message.text);
      break;

    case 'testResult':
      // 恢复按钮状态
      const testBtns = document.querySelectorAll('.model-card-footer button.primary');
      testBtns.forEach(btn => {
        btn.disabled = false;
        btn.textContent = '测试连接';
      });
      
      if (message.success) {
        alert('✅ 连接成功！\n\n' + (message.message || 'API 响应正常'));
      } else {
        alert('❌ 连接失败\n\n' + (message.error || '未知错误'));
      }
      break;

    case 'updateHistoryStats':
      const totalExtractsEl = document.getElementById('totalExtracts');
      const totalAnalysisEl = document.getElementById('totalAnalysis');
      const storageSizeEl = document.getElementById('storageSize');
      if (totalExtractsEl) totalExtractsEl.textContent = message.totalExtracts || 0;
      if (totalAnalysisEl) totalAnalysisEl.textContent = message.totalAnalysis || 0;
      if (storageSizeEl) storageSizeEl.textContent = message.storageSize || '0 KB';
      break;

    case 'error':
      console.error('Extension error:', message.error);
      alert('错误: ' + message.error);
      break;
  }
}

// ============================================================================
// 7. Utilities
// ============================================================================

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Load data on startup
loadData();
