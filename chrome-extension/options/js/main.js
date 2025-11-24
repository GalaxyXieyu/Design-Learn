/**
 * 主控制器
 * 整合所有模块和组件
 */
import { StorageManager } from './utils/storage.js';
import { Notification } from './utils/notification.js';
import { ModelManager } from './components/ModelManager.js';
import { PromptPreview } from './components/PromptPreview.js';

class OptionsApp {
  constructor() {
    this.storage = new StorageManager();
    this.currentPage = 'models';
    this.modelManager = null;
    this.promptPreview = null;
    this.history = [];
    this.init();
  }

  async init() {
    await this.initComponents();
    this.bindGlobalEvents();
    await this.loadStats();
  }

  /**
   * 初始化组件
   */
  async initComponents() {
    // 初始化模型管理器
    this.modelManager = new ModelManager();

    // 初始化提示词预览
    this.promptPreview = new PromptPreview();
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
    document.getElementById('saveGenerateConfigBtn')?.addEventListener('click', () => {
      this.saveGenerateConfig();
    });

    // 历史记录搜索
    document.getElementById('searchHistory')?.addEventListener('input', (e) => {
      this.filterHistory(e.target.value);
    });

    document.getElementById('filterType')?.addEventListener('change', () => {
      this.filterHistory();
    });

    // 数据管理
    document.getElementById('exportDataBtn')?.addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('clearDataBtn')?.addEventListener('click', () => {
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
      this.loadStats();
    }
  }

  /**
   * 保存生成配置
   */
  async saveGenerateConfig() {
    const config = {
      includeColors: document.getElementById('includeColors').checked,
      includeTypography: document.getElementById('includeTypography').checked,
      includeLayout: document.getElementById('includeLayout').checked,
      includeComponents: document.getElementById('includeComponents').checked,
      includeAccessibility: document.getElementById('includeAccessibility').checked,
      includeRecommendations: document.getElementById('includeRecommendations').checked,
      language: document.getElementById('language').value,
      autoGenerate: true // 默认总是自动生成
    };

    await this.storage.setConfig({ generateConfig: config });
    Notification.success('生成配置已保存');
  }

  /**
   * 加载历史记录
   */
  async loadHistory() {
    try {
      const snapshots = await this.storage.getAllSnapshots();
      this.history = snapshots.sort((a, b) => 
        new Date(b.extractedAt) - new Date(a.extractedAt)
      );
      this.displayHistory(this.history);
    } catch (error) {
      console.error('加载历史记录失败:', error);
      Notification.error('加载历史记录失败');
    }
  }

  /**
   * 显示历史记录
   */
  displayHistory(items) {
    const list = document.getElementById('historyList');
    
    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <p>暂无历史记录</p>
        </div>
      `;
      return;
    }

    list.innerHTML = items.map(item => this.createHistoryItem(item)).join('');
    this.bindHistoryEvents();
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
   * 绑定历史记录事件
   */
  bindHistoryEvents() {
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const id = e.currentTarget.dataset.id;
        this.handleHistoryAction(action, id);
      });
    });
  }

  /**
   * 处理历史记录操作
   */
  handleHistoryAction(action, id) {
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
        this.generateMarkdown(item);
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
    try {
      const btn = document.querySelector(`.action-btn.primary[data-action="viewMarkdown"][data-id="${item.id}"]`) ||
                  document.querySelector(`.action-btn[data-action="generate"][data-id="${item.id}"]`);
      if (btn) {
        btn.disabled = true;
      }

      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_SNAPSHOT',
        snapshot: item
      });

      if (response.success) {
        item.markdown = response.markdown;
        this.displayHistory(this.history);
        this.loadStats();
        const fmt = response.format === 'json' ? '（结构化）' : '（文本）';
        Notification.success('分析已生成并弹出下载 ' + fmt);
      } else {
        Notification.error('分析失败：' + response.error);
      }
    } catch (error) {
      Notification.error('分析失败：' + (error.message || '未知错误'));
    } finally {
      const btn = document.querySelector(`.action-btn[data-action="generate"][data-id="${item.id}"]`);
      if (btn) btn.disabled = false;
    }
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
   * 加载统计数据
   */
  async loadStats() {
    try {
      const snapshotCount = await this.storage.getSnapshotCount();
      const analysisCount = this.history.filter(h => h.markdown).length;
      const storageSize = await this.storage.calculateStorageSize();

      document.getElementById('snapshotCount').textContent = snapshotCount;
      document.getElementById('analysisCount').textContent = analysisCount;
      document.getElementById('storageSize').textContent = (storageSize / 1024 / 1024).toFixed(2) + ' MB';
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  }

  /**
   * 导出数据
   */
  async exportData() {
    const config = await this.storage.getConfig(null);
    const data = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      snapshots: this.history,
      config
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `style-generator-export-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    Notification.success('数据导出成功');
  }

  /**
   * 清除数据
   */
  async clearData() {
    if (!confirm('⚠️ 确定要清除任务与快照吗？\n\n这将删除所有任务记录与页面快照，模型与生成配置将被保留。此操作不可恢复！')) {
      return;
    }
    
    try {
      await this.storage.clearSnapshots();
      await this.storage.removeKeys(['tasks']);
      
      Notification.success('所有数据已清除');
      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      Notification.error('清除失败：' + error.message);
    }
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new OptionsApp();
});
