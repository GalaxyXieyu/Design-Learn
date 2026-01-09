/**
 * Design-Learn VSCode Extension - Webview Main Script
 * Handles UI interactions and communication with the extension
 */

// VSCode API
const vscode = acquireVsCodeApi();

// State
let currentPage = 'models';
let models = [];
let templates = [];
let config = {
  inlineCSS: true,
  includeImages: true,
  includeFonts: true,
  analyzeColors: true,
  analyzeTypography: true,
  analyzeLayout: true,
  analyzeComponents: true,
  analyzeAccessibility: true,
  reportLanguage: 'zh'
};

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
  document.getElementById('saveConfigBtn')?.addEventListener('click', saveConfig);
  document.getElementById('addTemplateBtn')?.addEventListener('click', openAddTemplateForm);

  // Config page checkboxes
  document.getElementById('inlineCSS')?.addEventListener('change', (e) => {
    config.inlineCSS = e.target.checked;
  });
  document.getElementById('includeImages')?.addEventListener('change', (e) => {
    config.includeImages = e.target.checked;
  });
  document.getElementById('includeFonts')?.addEventListener('change', (e) => {
    config.includeFonts = e.target.checked;
  });
  document.getElementById('analyzeColors')?.addEventListener('change', (e) => {
    config.analyzeColors = e.target.checked;
  });
  document.getElementById('analyzeTypography')?.addEventListener('change', (e) => {
    config.analyzeTypography = e.target.checked;
  });
  document.getElementById('analyzeLayout')?.addEventListener('change', (e) => {
    config.analyzeLayout = e.target.checked;
  });
  document.getElementById('analyzeComponents')?.addEventListener('change', (e) => {
    config.analyzeComponents = e.target.checked;
  });
  document.getElementById('analyzeAccessibility')?.addEventListener('change', (e) => {
    config.analyzeAccessibility = e.target.checked;
  });
  document.getElementById('reportLanguage')?.addEventListener('change', (e) => {
    config.reportLanguage = e.target.value;
  });

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

function setActiveTemplate(templateId) {
  templates.forEach(t => t.active = (t.id === templateId));
  vscode.postMessage({ type: 'saveTemplates', templates });
  renderTemplates();
}

// ============================================================================
// 4. Templates Management
// ============================================================================

function openAddTemplateForm() {
  const html = `
    <div class="card">
      <h3 class="card-title">添加新模板</h3>
      <div class="form-group">
        <label>模板名称</label>
        <input type="text" id="templateName" class="input" placeholder="例如: 完整分析, 快速分析">
      </div>
      <div class="form-group">
        <label>提示词内容</label>
        <textarea id="templatePrompt" class="prompt-edit-area" placeholder="输入您的提示词..."></textarea>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="templateActive">
          <span class="checkbox-custom"></span>
          <span>设为活跃模板</span>
        </label>
      </div>
      <div class="form-actions">
        <button class="btn-primary" id="saveTemplateBtn">保存模板</button>
        <button class="btn-secondary" id="cancelTemplateBtn">取消</button>
      </div>
    </div>`;
  document.getElementById('templatesContainer').innerHTML = html;
  document.getElementById('saveTemplateBtn').addEventListener('click', saveTemplate);
  document.getElementById('cancelTemplateBtn').addEventListener('click', loadData);
}

function saveTemplate() {
  const template = {
    id: Date.now().toString(),
    name: document.getElementById('templateName').value,
    prompt: document.getElementById('templatePrompt').value,
    active: document.getElementById('templateActive').checked,
    createdAt: new Date().toISOString()
  };

  if (!template.name || !template.prompt) {
    alert('请填写必填项');
    return;
  }

  vscode.postMessage({
    type: 'saveTemplate',
    template: template
  });
}

function renderTemplates() {
  const container = document.getElementById('templatesContainer');
  if (templates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
        <p>还没有自定义模板</p>
        <p style="font-size:14px;color:var(--text-secondary);">点击右上角按钮创建提示词模板</p>
      </div>`;
    return;
  }
  container.innerHTML = templates.map(template => `
    <div class="template-card${template.active ? ' active' : ''}">
      <div class="template-header">
        <div class="template-info">
          <div class="template-name">${template.name}</div>
          <div class="template-desc">${template.prompt.substring(0, 100)}...</div>
        </div>
        ${template.active ? '<span class="template-badge">使用中</span>' : ''}
      </div>
      <div class="template-actions">
        <button class="btn-secondary btn-sm" onclick="setActiveTemplate('${template.id}')">${template.active ? '已启用' : '启用'}</button>
        <button class="btn-secondary btn-sm" onclick="deleteTemplate('${template.id}')">删除</button>
      </div>
    </div>`).join('');
}

function deleteTemplate(templateId) {
  if (confirm('确定要删除这个模板吗?')) {
    vscode.postMessage({
      type: 'deleteTemplate',
      templateId: templateId
    });
  }
}

function editTemplate(templateId) {
  console.log('Edit template:', templateId);
  // TODO: Implement edit functionality
}

// ============================================================================
// 5. Configuration
// ============================================================================

function saveConfig() {
  vscode.postMessage({
    type: 'saveConfig',
    config: config
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
      templates = message.templates || [];
      config = message.config || config;
      renderModels();
      renderTemplates();
      updateConfigUI();
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

function updateConfigUI() {
  const inlineCSS = document.getElementById('inlineCSS');
  const includeImages = document.getElementById('includeImages');
  const includeFonts = document.getElementById('includeFonts');
  const analyzeColors = document.getElementById('analyzeColors');
  const analyzeTypography = document.getElementById('analyzeTypography');
  const analyzeLayout = document.getElementById('analyzeLayout');
  const analyzeComponents = document.getElementById('analyzeComponents');
  const analyzeAccessibility = document.getElementById('analyzeAccessibility');
  const reportLanguage = document.getElementById('reportLanguage');

  if (inlineCSS) inlineCSS.checked = config.inlineCSS;
  if (includeImages) includeImages.checked = config.includeImages;
  if (includeFonts) includeFonts.checked = config.includeFonts;
  if (analyzeColors) analyzeColors.checked = config.analyzeColors;
  if (analyzeTypography) analyzeTypography.checked = config.analyzeTypography;
  if (analyzeLayout) analyzeLayout.checked = config.analyzeLayout;
  if (analyzeComponents) analyzeComponents.checked = config.analyzeComponents;
  if (analyzeAccessibility) analyzeAccessibility.checked = config.analyzeAccessibility;
  if (reportLanguage) reportLanguage.value = config.reportLanguage;
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
