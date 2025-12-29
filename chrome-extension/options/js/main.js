/**
 * 主控制器 v2 - 组件化版本
 * 整合所有模块和组件，支持动态加载 HTML 组件
 */
import { componentLoader } from './utils/ComponentLoader.js';
import { StorageManager } from './utils/storage.js';
import { Notification } from './utils/notification.js';
import { ModelManager } from './components/ModelManager.js';
import { PromptPreview } from './components/PromptPreview.js';
import { PromptTemplateManager } from './components/PromptTemplateManager.js';

class OptionsApp {
  constructor() {
    this.storage = new StorageManager();
    this.currentPage = 'models';
    this.modelManager = null;
    this.templateManager = null;
    this.promptPreview = null;
    this.history = [];
    this.init();
  }

  async init() {
    console.log('[OptionsApp] 初始化开始...');
    
    // 1. 先加载所有 HTML 组件
    await this.loadComponents();
    
    // 2. 初始化 JS 组件
    await this.initJsComponents();
    
    // 3. 绑定事件
    this.bindGlobalEvents();
    
    // 4. 加载数据
    await this.loadExtractOptions();
    await this.loadGenerateConfig();
    await this.loadStats();
    
    console.log('[OptionsApp] ✓ 初始化完成');
  }

  /**
   * 加载所有 HTML 组件
   */
  async loadComponents() {
    console.log('[OptionsApp] 加载 HTML 组件...');
    
    const components = [
      // 侧边栏
      { path: 'components/sidebar.html', target: '#sidebarContainer' },
      
      // 页面
      { path: 'components/models-page.html', target: '#modelsPageContainer' },
      { path: 'components/generate-page.html', target: '#generatePageContainer' },
      { path: 'components/history-page.html', target: '#historyPageContainer' },
      
      // 弹窗
      { path: 'components/model-modal.html', target: '#modelModalContainer' },
      { path: 'components/template-modal.html', target: '#templateModalContainer' }
    ];

    try {
      await componentLoader.loadComponents(components);
      console.log('[OptionsApp] ✓ HTML 组件加载完成');
    } catch (error) {
      console.error('[OptionsApp] ✗ HTML 组件加载失败:', error);
      Notification.error('页面组件加载失败，请刷新重试');
    }
  }

  /**
   * 初始化 JS 组件
   */
  async initJsComponents() {
    console.log('[OptionsApp] 初始化 JS 组件...');
    
    try {
      // 初始化模型管理器
      this.modelManager = new ModelManager();

      // 初始化模板管理器
      this.templateManager = new PromptTemplateManager();

      // 初始化提示词预览（传入模板管理器）
      this.promptPreview = new PromptPreview(this.templateManager);
      
      console.log('[OptionsApp] ✓ JS 组件初始化完成');
    } catch (error) {
      console.error('[OptionsApp] ✗ JS 组件初始化失败:', error);
      Notification.error('功能模块初始化失败，请刷新重试');
    }
  }

  /**
   * 绑定全局事件
   */
  bindGlobalEvents() {
    // 侧边栏导航
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.switchPage(e.currentTarget.dataset.page);
      });
    });

    // 生成配置保存
    const saveGenerateBtn = document.getElementById('saveGenerateConfigBtn');
    if (saveGenerateBtn) {
      saveGenerateBtn.addEventListener('click', () => {
        this.saveGenerateConfig();
      });
    }

    // 提取选项
    ['extractInlineCSS', 'extractCollectImages', 'extractCollectFonts'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => {
          this.saveExtractOptions();
        });
      }
    });

    // 历史记录搜索和筛选
    const searchHistory = document.getElementById('searchHistory');
    if (searchHistory) {
      searchHistory.addEventListener('input', (e) => {
        this.filterHistory(e.target.value);
      });
    }

    const filterType = document.getElementById('filterType');
    if (filterType) {
      filterType.addEventListener('change', () => {
        this.filterHistory();
      });
    }

    // 数据管理按钮
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    const importBtn = document.getElementById('importDataBtn');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.importData());
    }

    const viewBackupsBtn = document.getElementById('viewBackupsBtn');
    if (viewBackupsBtn) {
      viewBackupsBtn.addEventListener('click', () => this.viewBackups());
    }

    const clearBtn = document.getElementById('clearDataBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearData());
    }
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
    }
  }

  /**
   * 加载提取选项
   */
  async loadExtractOptions() {
    const options = await this.storage.getConfig(['extractOptions']);
    const extractOptions = options.extractOptions || {
      inlineCSS: true,
      collectImages: true,
      collectFonts: true
    };

    const inlineCSS = document.getElementById('extractInlineCSS');
    const collectImages = document.getElementById('extractCollectImages');
    const collectFonts = document.getElementById('extractCollectFonts');

    if (inlineCSS) inlineCSS.checked = extractOptions.inlineCSS;
    if (collectImages) collectImages.checked = extractOptions.collectImages;
    if (collectFonts) collectFonts.checked = extractOptions.collectFonts;
  }

  /**
   * 保存提取选项
   */
  async saveExtractOptions() {
    const extractOptions = {
      inlineCSS: document.getElementById('extractInlineCSS')?.checked || false,
      collectImages: document.getElementById('extractCollectImages')?.checked || false,
      collectFonts: document.getElementById('extractCollectFonts')?.checked || false
    };

    await this.storage.setConfig({ extractOptions });
  }

  /**
   * 加载生成配置
   */
  async loadGenerateConfig() {
    const config = await this.storage.getConfig(['generateConfig']);
    const generateConfig = config.generateConfig || {
      includeColors: true,
      includeTypography: true,
      includeLayout: true,
      includeComponents: true,
      includeAccessibility: true,
      includeRecommendations: true,
      language: 'zh-CN'
    };

    const fields = [
      'includeColors',
      'includeTypography',
      'includeLayout',
      'includeComponents',
      'includeAccessibility',
      'includeRecommendations'
    ];

    fields.forEach(field => {
      const element = document.getElementById(field);
      if (element) element.checked = generateConfig[field];
    });

    const language = document.getElementById('language');
    if (language) language.value = generateConfig.language;

    const syncConfigResult = await this.storage.getConfig(['syncConfig']);
    const syncConfig = syncConfigResult.syncConfig || {
      serverUrl: '',
      reportOnly: true,
      autoDetect: true
    };
    const serverUrl = document.getElementById('serverUrl');
    if (serverUrl) serverUrl.value = syncConfig.serverUrl || '';
    const reportOnly = document.getElementById('reportOnly');
    if (reportOnly) reportOnly.checked = syncConfig.reportOnly !== false;
    const autoDetectServer = document.getElementById('autoDetectServer');
    if (autoDetectServer) autoDetectServer.checked = syncConfig.autoDetect !== false;
  }

  /**
   * 保存生成配置
   */
  async saveGenerateConfig() {
    const generateConfig = {
      includeColors: document.getElementById('includeColors')?.checked || false,
      includeTypography: document.getElementById('includeTypography')?.checked || false,
      includeLayout: document.getElementById('includeLayout')?.checked || false,
      includeComponents: document.getElementById('includeComponents')?.checked || false,
      includeAccessibility: document.getElementById('includeAccessibility')?.checked || false,
      includeRecommendations: document.getElementById('includeRecommendations')?.checked || false,
      language: document.getElementById('language')?.value || 'zh-CN'
    };

    const rawServerUrl = document.getElementById('serverUrl')?.value;
    const syncConfig = {
      serverUrl: typeof rawServerUrl === 'string' ? rawServerUrl.trim() : '',
      reportOnly: document.getElementById('reportOnly')?.checked !== false,
      autoDetect: document.getElementById('autoDetectServer')?.checked !== false
    };

    await this.storage.setConfig({ generateConfig, syncConfig });
    Notification.success('生成配置与同步设置已保存');
  }

  /**
   * 加载统计数据
   */
  async loadStats() {
    const snapshotCount = await this.storage.getSnapshotCount();
    const storageSize = await this.storage.calculateStorageSize();

    const snapshotEl = document.getElementById('snapshotCount');
    const storageSizeEl = document.getElementById('storageSize');
    const analysisCountEl = document.getElementById('analysisCount');

    if (snapshotEl) snapshotEl.textContent = snapshotCount;
    if (storageSizeEl) storageSizeEl.textContent = `${(storageSize / 1024 / 1024).toFixed(2)} MB`;
    if (analysisCountEl) analysisCountEl.textContent = '0'; // TODO: 实现分析数量统计
  }

  /**
   * 加载历史记录
   */
  async loadHistory() {
    this.history = await this.storage.getAllSnapshots();
    this.displayHistory(this.history);
  }

  /**
   * 显示历史记录
   */
  displayHistory(items) {
    const list = document.getElementById('historyList');
    if (!list) return;

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
    this.bindHistoryItemEvents(list);
  }

  /**
   * 绑定历史记录项事件（事件委托）
   */
  bindHistoryItemEvents(container) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'viewHtml':
          this.viewHtml(id);
          break;
        case 'viewMarkdown':
          this.viewMarkdown(id);
          break;
        case 'generateMarkdown':
          this.generateMarkdown(id);
          break;
        case 'downloadSnapshot':
          this.downloadSnapshot(id);
          break;
      }
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
              <button class="action-btn" data-action="generateMarkdown" data-id="${item.id}">
                生成分析
              </button>
            `}
            <button class="action-btn" data-action="downloadSnapshot" data-id="${item.id}">
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
   * 筛选历史记录
   */
  filterHistory(searchText = '') {
    const filterType = document.getElementById('filterType')?.value || 'all';
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
   * 导出数据
   */
  async exportData() {
    const data = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      snapshots: await this.storage.getAllSnapshots(),
      config: await this.storage.getConfig(null)
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `design-learn-export-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    Notification.success('数据导出成功');
  }

  /**
   * 导入数据
   */
  importData() {
    const input = document.getElementById('importFileInput');
    if (input) {
      input.click();
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            // TODO: 实现数据导入逻辑
            Notification.success('数据导入成功');
          } catch (error) {
            Notification.error('数据导入失败：' + error.message);
          }
        }
      };
    }
  }

  /**
   * 查看自动备份
   */
  viewBackups() {
    Notification.info('自动备份功能开发中...');
  }

  /**
   * 清除所有数据
   */
  async clearData() {
    if (!confirm('⚠️ 确定要清除所有数据吗？\n\n这将删除所有快照和分析报告，此操作不可恢复！')) {
      return;
    }

    try {
      await this.storage.clearAllData();
      Notification.success('所有数据已清除');
      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      Notification.error('清除失败：' + error.message);
    }
  }

  // 历史记录操作方法
  viewHtml(id) {
    const item = this.history.find(h => h.id === id);
    if (!item) return;
    const blob = new Blob([item.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  viewMarkdown(id) {
    const item = this.history.find(h => h.id === id);
    if (!item || !item.markdown) return;
    const blob = new Blob([item.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  async generateMarkdown(id) {
    Notification.info('正在生成分析报告...');
    // TODO: 实现 AI 分析生成
  }

  downloadSnapshot(id) {
    const item = this.history.find(h => h.id === id);
    if (!item) return;

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
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new OptionsApp();
});
