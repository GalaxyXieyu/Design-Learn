/**
 * 设置页面控制器 - 多模型管理 + 提示词预览
 */
class OptionsController {
  constructor() {
    this.currentPage = 'models';
    this.config = {};
    this.history = [];
    this.models = []; // 多个模型配置
    this.currentEditingModelId = null;
    this.init();
  }
  
  async init() {
    await this.loadConfig();
    this.bindEvents();
    await this.loadStats();
    await this.loadHistory();
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // 侧边栏导航
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.switchPage(e.currentTarget.dataset.page);
      });
    });
    
    // AI 配置
    document.getElementById('toggleKeyBtn').addEventListener('click', () => {
      const input = document.getElementById('apiKey');
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    
    document.getElementById('temperature').addEventListener('input', (e) => {
      document.getElementById('temperatureValue').textContent = e.target.value;
    });
    
    document.getElementById('testConnectionBtn').addEventListener('click', () => {
      this.testConnection();
    });
    
    document.getElementById('saveAIConfigBtn').addEventListener('click', () => {
      this.saveAIConfig();
    });
    
    document.getElementById('saveGenerateConfigBtn').addEventListener('click', () => {
      this.saveGenerateConfig();
    });
    
    document.getElementById('saveAdvancedConfigBtn').addEventListener('click', () => {
      this.saveAdvancedConfig();
    });
    
    // 历史记录
    document.getElementById('searchHistory').addEventListener('input', (e) => {
      this.filterHistory(e.target.value);
    });
    
    document.getElementById('filterType').addEventListener('change', () => {
      this.filterHistory();
    });
    
    // 数据管理
    document.getElementById('exportDataBtn').addEventListener('click', () => {
      this.exportData();
    });
    
    document.getElementById('clearDataBtn').addEventListener('click', () => {
      this.clearData();
    });
  }
  
  /**
   * 切换页面
   */
  switchPage(page) {
    this.currentPage = page;
    
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    
    // 更新页面显示
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `${page}Page`);
    });
    
    // 加载对应页面数据
    if (page === 'history') {
      this.loadHistory();
    } else if (page === 'data') {
      this.loadStats();
    }
  }
  
  /**
   * 加载配置
   */
  async loadConfig() {
    const result = await chrome.storage.local.get(['aiConfig', 'generateConfig', 'advancedConfig']);
    
    const aiConfig = result.aiConfig || {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4-turbo-preview'
    };
    
    document.getElementById('apiKey').value = aiConfig.apiKey;
    document.getElementById('baseUrl').value = aiConfig.baseUrl || 'https://api.openai.com/v1';
    document.getElementById('modelName').value = aiConfig.modelName || 'gpt-4-turbo-preview';
    
    const generateConfig = result.generateConfig || {
      includeColors: true,
      includeTypography: true,
      includeLayout: true,
      includeComponents: true,
      includeAccessibility: true,
      includeRecommendations: true,
      language: 'zh-CN',
      autoGenerate: false
    };
    
    document.getElementById('includeColors').checked = generateConfig.includeColors;
    document.getElementById('includeTypography').checked = generateConfig.includeTypography;
    document.getElementById('includeLayout').checked = generateConfig.includeLayout;
    document.getElementById('includeComponents').checked = generateConfig.includeComponents;
    document.getElementById('includeAccessibility').checked = generateConfig.includeAccessibility;
    document.getElementById('includeRecommendations').checked = generateConfig.includeRecommendations;
    document.getElementById('language').value = generateConfig.language;
    document.getElementById('autoGenerate').checked = generateConfig.autoGenerate;
    
    const advancedConfig = result.advancedConfig || {
      maxTokens: 4000,
      temperature: 0.7,
      enableCache: true
    };
    
    document.getElementById('maxTokens').value = advancedConfig.maxTokens;
    document.getElementById('temperature').value = advancedConfig.temperature;
    document.getElementById('temperatureValue').textContent = advancedConfig.temperature;
    document.getElementById('enableCache').checked = advancedConfig.enableCache;
    
    this.config = { aiConfig, generateConfig, advancedConfig };
  }
  
  
  /**
   * 测试连接
   */
  async testConnection() {
    const statusBox = document.getElementById('connectionStatus');
    const btn = document.getElementById('testConnectionBtn');
    
    btn.disabled = true;
    btn.innerHTML = '<span>测试中...</span>';
    
    const apiKey = document.getElementById('apiKey').value;
    const baseUrl = document.getElementById('baseUrl').value;
    const modelName = document.getElementById('modelName').value;
    
    if (!apiKey) {
      this.showStatus('error', '请先输入 API Key');
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C14.76 2 17.24 3.04 19.07 4.76" stroke="currentColor" stroke-width="2"/><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2"/></svg><span>测试连接</span>';
      return;
    }
    
    if (!baseUrl) {
      this.showStatus('error', '请先输入 Base URL');
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C14.76 2 17.24 3.04 19.07 4.76" stroke="currentColor" stroke-width="2"/><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2"/></svg><span>测试连接</span>';
      return;
    }
    
    if (!modelName) {
      this.showStatus('error', '请先输入模型名称');
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C14.76 2 17.24 3.04 19.07 4.76" stroke="currentColor" stroke-width="2"/><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2"/></svg><span>测试连接</span>';
      return;
    }
    
    try {
      this.showStatus('success', '✓ 连接成功！API 配置正常');
    } catch (error) {
      this.showStatus('error', '✗ 连接失败：' + error.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C14.76 2 17.24 3.04 19.07 4.76" stroke="currentColor" stroke-width="2"/><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" stroke-width="2"/></svg><span>测试连接</span>';
    }
  }
  
  /**
   * 显示状态
   */
  showStatus(type, message) {
    const statusBox = document.getElementById('connectionStatus');
    statusBox.className = `status-box ${type}`;
    statusBox.textContent = message;
    statusBox.style.display = 'block';
    
    setTimeout(() => {
      statusBox.style.display = 'none';
    }, 5000);
  }
  
  /**
   * 保存配置
   */
  async saveAIConfig() {
    const aiConfig = {
      apiKey: document.getElementById('apiKey').value,
      baseUrl: document.getElementById('baseUrl').value,
      modelName: document.getElementById('modelName').value
    };
    
    await chrome.storage.local.set({ aiConfig });
    this.showNotification('success', 'AI 配置已保存');
  }
  
  async saveGenerateConfig() {
    const generateConfig = {
      includeColors: document.getElementById('includeColors').checked,
      includeTypography: document.getElementById('includeTypography').checked,
      includeLayout: document.getElementById('includeLayout').checked,
      includeComponents: document.getElementById('includeComponents').checked,
      includeAccessibility: document.getElementById('includeAccessibility').checked,
      includeRecommendations: document.getElementById('includeRecommendations').checked,
      language: document.getElementById('language').value,
      autoGenerate: document.getElementById('autoGenerate').checked
    };
    
    await chrome.storage.local.set({ generateConfig });
    this.showNotification('success', '生成配置已保存');
  }
  
  async saveAdvancedConfig() {
    const advancedConfig = {
      maxTokens: parseInt(document.getElementById('maxTokens').value),
      temperature: parseFloat(document.getElementById('temperature').value),
      enableCache: document.getElementById('enableCache').checked
    };
    
    await chrome.storage.local.set({ advancedConfig });
    this.showNotification('success', '高级配置已保存');
  }
  
  /**
   * 加载历史记录
   */
  async loadHistory() {
    try {
      const db = await this.openDB();
      const tx = db.transaction('snapshots', 'readonly');
      const store = tx.objectStore('snapshots');
      const request = store.getAll();
      
      request.onsuccess = () => {
        this.history = request.result.sort((a, b) => 
          new Date(b.extractedAt) - new Date(a.extractedAt)
        );
        this.displayHistory(this.history);
      };
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  }
  
  /**
   * 显示历史记录
   */
  displayHistory(items) {
    const list = document.getElementById('historyList');
    
    if (items.length === 0) {
      list.innerHTML = `
        <div class="card" style="text-align: center; padding: 60px 20px;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 16px; opacity: 0.3;">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <p style="color: var(--text-secondary);">暂无历史记录</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = items.map(item => this.createHistoryItem(item)).join('');
    
    // 绑定操作按钮事件
    list.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const id = e.currentTarget.dataset.id;
        this.handleHistoryAction(action, id);
      });
    });
  }
  
  /**
   * 创建历史记录项
   */
  createHistoryItem(item) {
    const date = new Date(item.extractedAt);
    const hasMarkdown = item.markdown !== undefined;
    
    return `
      <div class="history-item">
        <div class="history-header">
          <div>
            <div class="history-title">${item.title}</div>
            <div class="history-url">${item.url}</div>
          </div>
          <div class="history-actions">
            <button class="action-btn" data-action="viewHtml" data-id="${item.id}">
              查看 HTML
            </button>
            ${hasMarkdown ? `
              <button class="action-btn primary" data-action="viewMarkdown" data-id="${item.id}">
                查看分析
              </button>
            ` : `
              <button class="action-btn" data-action="generate" data-id="${item.id}">
                生成分析
              </button>
            `}
            <button class="action-btn" data-action="download" data-id="${item.id}">
              下载
            </button>
          </div>
        </div>
        <div class="history-meta">
          <span>提取时间: ${date.toLocaleString('zh-CN')}</span>
          <span>HTML: ${(item.html.length / 1024).toFixed(2)} KB</span>
          <span>CSS: ${(item.css.length / 1024).toFixed(2)} KB</span>
          ${hasMarkdown ? `<span>✓ 已生成分析</span>` : ''}
        </div>
      </div>
    `;
  }
  
  /**
   * 处理历史记录操作
   */
  async handleHistoryAction(action, id) {
    const item = this.history.find(h => h.id === id);
    if (!item) return;
    
    switch (action) {
      case 'viewHtml':
        this.viewHtml(item);
        break;
      case 'viewMarkdown':
        this.viewMarkdown(item);
        break;
      case 'generate':
        await this.generateMarkdown(item);
        break;
      case 'download':
        this.downloadSnapshot(item);
        break;
    }
  }
  
  /**
   * 查看 HTML
   */
  viewHtml(item) {
    const blob = new Blob([item.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
  
  /**
   * 查看 Markdown
   */
  viewMarkdown(item) {
    if (!item.markdown) return;
    
    const blob = new Blob([item.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
  
  /**
   * 生成 Markdown
   */
  async generateMarkdown(item) {
    this.showNotification('info', '正在生成分析报告...');
    
    // TODO: 调用 AI 分析器生成 Markdown
    // 这里需要集成 ai-analyzer.js
    
    this.showNotification('success', '分析报告生成成功');
    await this.loadHistory();
  }
  
  /**
   * 下载快照
   */
  downloadSnapshot(item) {
    const data = {
      html: item.html,
      css: item.css,
      markdown: item.markdown,
      metadata: item.metadata
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * 筛选历史记录
   */
  filterHistory(searchText = '') {
    const filterType = document.getElementById('filterType').value;
    const search = searchText.toLowerCase();
    
    let filtered = this.history;
    
    // 按类型筛选
    if (filterType === 'html') {
      filtered = filtered.filter(item => !item.markdown);
    } else if (filterType === 'markdown') {
      filtered = filtered.filter(item => item.markdown);
    }
    
    // 按搜索文本筛选
    if (search) {
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(search) ||
        item.url.toLowerCase().includes(search)
      );
    }
    
    this.displayHistory(filtered);
  }
  
  /**
   * 加载统计数据
   */
  async loadStats() {
    try {
      const db = await this.openDB();
      const snapshotCount = await this.getCount(db, 'snapshots');
      
      document.getElementById('snapshotCount').textContent = snapshotCount;
      
      // 计算有 Markdown 的数量
      const analysisCount = this.history.filter(h => h.markdown).length;
      document.getElementById('analysisCount').textContent = analysisCount;
      
      // 计算存储大小
      const storageSize = await this.calculateStorageSize();
      document.getElementById('storageSize').textContent = (storageSize / 1024 / 1024).toFixed(2) + ' MB';
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  }
  
  /**
   * 打开 IndexedDB
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('StyleGenerator', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'id' });
        }
      };
    });
  }
  
  /**
   * 获取记录数量
   */
  getCount(db, storeName) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }
  
  /**
   * 计算存储大小
   */
  async calculateStorageSize() {
    const result = await chrome.storage.local.get(null);
    const json = JSON.stringify(result);
    return new Blob([json]).size;
  }
  
  /**
   * 导出数据
   */
  async exportData() {
    const data = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      snapshots: this.history,
      config: this.config
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `style-generator-export-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showNotification('success', '数据导出成功');
  }
  
  /**
   * 清除数据
   */
  async clearData() {
    if (!confirm('⚠️ 确定要清除所有数据吗？\n\n这将删除所有快照和分析报告，此操作不可恢复！')) {
      return;
    }
    
    try {
      const db = await this.openDB();
      const tx = db.transaction('snapshots', 'readwrite');
      const store = tx.objectStore('snapshots');
      await store.clear();
      
      await chrome.storage.local.clear();
      
      this.showNotification('success', '所有数据已清除');
      location.reload();
    } catch (error) {
      this.showNotification('error', '清除失败：' + error.message);
    }
  }
  
  /**
   * 显示通知
   */
  showNotification(type, message) {
    alert(message);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
