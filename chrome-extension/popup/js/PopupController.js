/**
 * Popup 控制器 - 苹果风格
 * 主控制器，协调各个模块
 */
class PopupController {
  constructor() {
    this.currentTab = null;
    this.currentMode = 'current'; // 'current' or 'all'
    this.tasks = [];
    this.domainCollapse = {};
    this.selectedTasks = new Set(); // 选中的任务ID
    this.queuePaused = false;
    
    // 初始化子模块
    this.taskManager = new TaskManager(this);
    this.queueController = new QueueController(this);
    
    this.init();
  }
  
  async init() {
    try {
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      
      // 显示页面信息
      this.displayPageInfo(tab);
      
      // 绑定事件（先绑定事件，确保 DOM 元素存在）
      this.bindEvents();
      
      // 加载配置和模型选项
      await this.loadConfig();

      // 显示同步状态
      await this.initSyncStatus();
      
      // 加载任务列表
      await this.taskManager.loadTasks();
      
      // 监听后台任务更新
      this.listenTaskUpdates();
    } catch (error) {
      console.error('初始化失败:', error);
    }
  }
  
  /**
   * 显示页面信息
   */
  displayPageInfo(tab) {
    const pageTitle = document.getElementById('pageTitle');
    const pageUrl = document.getElementById('pageUrl');
    
    if (pageTitle) {
      pageTitle.textContent = tab.title || '未命名页面';
    }
    
    if (pageUrl) {
      try {
        const url = new URL(tab.url);
        pageUrl.textContent = url.hostname;
      } catch {
        pageUrl.textContent = tab.url;
      }
    }
  }
  
  /**
   * 加载配置
   */
  async loadConfig() {
    const result = await chrome.storage.local.get(['aiModels', 'sg_aiModels', 'generateConfig', 'sg_generateConfig']);
    const aiModels = result.sg_aiModels || result.aiModels || [];
    
    // 获取默认模型
    const defaultModel = aiModels.find(m => m.isDefault) || aiModels[0] || null;
    
    this.displayModelSelector(defaultModel, aiModels);
  }

  async initSyncStatus() {
    const refreshBtn = document.getElementById('syncStatusRefresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshSyncStatus();
      });
    }

    const actionBtn = document.getElementById('syncStatusAction');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        const action = actionBtn.dataset.action || 'start';
        if (action === 'settings') {
          chrome.runtime.openOptionsPage();
          return;
        }
        this.startLocalServer();
      });
    }

    await this.refreshSyncStatus();
  }

  async refreshSyncStatus() {
    const container = document.getElementById('syncStatus');
    const textEl = document.getElementById('syncStatusText');
    const actionBtn = document.getElementById('syncStatusAction');

    if (!container || !textEl) {
      return;
    }

    container.classList.remove('is-connected', 'is-disconnected');
    textEl.textContent = '服务状态：检测中...';
    if (actionBtn) {
      actionBtn.style.display = 'none';
    }

    const syncConfig = await this.getSyncConfig();
    const result = await this.resolveSyncStatus(syncConfig);

    if (result.connected) {
      container.classList.add('is-connected');
      textEl.textContent = `服务状态：已连接 ${this.formatServerLabel(result.url)}`;
    } else {
      container.classList.add('is-disconnected');
      textEl.textContent = `服务状态：未连接（${result.reason}）`;
      if (actionBtn) {
        actionBtn.style.display = 'inline-flex';
        actionBtn.textContent = result.actionLabel || '启动服务';
        actionBtn.dataset.action = result.action || 'start';
      }
    }
  }

  formatServerLabel(serverUrl) {
    if (!serverUrl) return '';
    try {
      const url = new URL(serverUrl);
      return `${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
    } catch {
      return serverUrl;
    }
  }

  async getSyncConfig() {
    const stored = await chrome.storage.local.get(['sg_syncConfig', 'syncConfig']);
    const syncConfig = stored.sg_syncConfig || stored.syncConfig || {};
    return {
      serverUrl: typeof syncConfig.serverUrl === 'string' ? syncConfig.serverUrl.trim() : '',
      autoDetect: syncConfig.autoDetect !== false
    };
  }

  async saveSyncConfig(syncConfig) {
    await chrome.storage.local.set({ sg_syncConfig: syncConfig });
  }

  async resolveSyncStatus(syncConfig) {
    if (syncConfig.serverUrl) {
      const ok = await this.pingServer(syncConfig.serverUrl);
      if (ok) {
        return { connected: true, url: syncConfig.serverUrl };
      }
      if (!syncConfig.autoDetect) {
        return {
          connected: false,
          reason: '手动地址不可用，请检查服务是否启动',
          action: 'settings',
          actionLabel: '去设置'
        };
      }
    }

    if (!syncConfig.autoDetect) {
      return {
        connected: false,
        reason: '未开启自动检测，请先配置服务地址',
        action: 'settings',
        actionLabel: '去设置'
      };
    }

    const detected = await this.detectServerUrl();
    if (detected) {
      await this.saveSyncConfig({ ...syncConfig, serverUrl: detected });
      return { connected: true, url: detected };
    }

    return {
      connected: false,
      reason: '自动检测未找到本地服务，请启动服务',
      action: 'start',
      actionLabel: '启动服务'
    };
  }

  async startLocalServer() {
    try {
      await chrome.tabs.create({ url: 'vscode://command/design-learn.toggleServer' });
    } catch {
      // noop: 可能未安装 VSCode
    }
  }

  async detectServerUrl() {
    const candidates = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3100',
      'http://127.0.0.1:3100'
    ];

    for (const candidate of candidates) {
      const ok = await this.pingServer(candidate);
      if (ok) {
        return candidate;
      }
    }

    return null;
  }

  async pingServer(serverUrl) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch(`${serverUrl.replace(/\/+$/, '')}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
  
  /**
   * 显示模型选择器
   */
  displayModelSelector(defaultModel, allModels) {
    const container = document.getElementById('modelSelectorContainer');
    
    if (!container) {
      return;
    }
    
    if (!defaultModel || !defaultModel.apiKey || !defaultModel.modelId) {
      // 显示空状态
      container.innerHTML = `
        <div class="model-empty">
          <div class="model-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="model-empty-text">
            还没有配置 AI 模型<br>
            请先在设置中添加模型配置
          </div>
          <button class="model-empty-btn" id="goToSettingsBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>前往设置</span>
          </button>
        </div>
      `;
      
      // 绑定前往设置按钮
      const goToSettingsBtn = document.getElementById('goToSettingsBtn');
      if (goToSettingsBtn) {
        goToSettingsBtn.addEventListener('click', () => {
          chrome.runtime.openOptionsPage();
        });
      }
    } else {
      // 显示模型卡片
      const modelInitial = defaultModel.name.substring(0, 2).toUpperCase();
      const provider = defaultModel.baseUrl.includes('openai') ? 'OpenAI' : 
                      defaultModel.baseUrl.includes('anthropic') ? 'Anthropic' : '自定义';
      
      container.innerHTML = `
        <div class="model-card">
          <div class="model-icon">${modelInitial}</div>
          <div class="model-info">
            <div class="model-name">${defaultModel.name}</div>
            <div class="model-provider">${provider}</div>
          </div>
          <svg class="model-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
      
      // 点击卡片打开设置
      container.querySelector('.model-card').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }
  }
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // URL 输入框事件
    const urlInput = document.getElementById('customUrlInput');
    const clearBtn = document.getElementById('clearUrlBtn');
    
    if (urlInput && clearBtn) {
      urlInput.addEventListener('input', () => {
        clearBtn.style.display = urlInput.value ? 'flex' : 'none';
      });
      
      clearBtn.addEventListener('click', () => {
        urlInput.value = '';
        clearBtn.style.display = 'none';
        urlInput.focus();
      });
    }
    
    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }
    
    // 任务队列按钮
    const tasksBtn = document.getElementById('tasksBtn');
    if (tasksBtn) {
      tasksBtn.addEventListener('click', () => {
        this.openTasksModal();
      });
    } else {
      console.warn('未找到任务按钮元素 (tasksBtn)');
    }
    
    // 关闭弹窗
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        this.closeTasksModal();
      });
    }
    
    // 点击弹窗背景关闭
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', () => {
        this.closeTasksModal();
      });
    }
    
    // 模式切换
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchMode(e.currentTarget.dataset.mode);
      });
    });
    
    // 立即提取按钮
    const extractBtn = document.getElementById('extractBtn');
    if (extractBtn) {
      extractBtn.addEventListener('click', () => {
        this.extract();
      });
    }
    
    // 清除已完成任务按钮事件已移至 QueueController.js 中动态绑定
    
    // 全选/取消全选
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        this.queueController.toggleSelectAll();
      });
    }
    
    // 暂停队列
    const pauseQueueBtn = document.getElementById('pauseQueueBtn');
    if (pauseQueueBtn) {
      pauseQueueBtn.addEventListener('click', () => {
        this.queueController.pauseQueue();
      });
    }
    
    // 继续队列
    const resumeQueueBtn = document.getElementById('resumeQueueBtn');
    if (resumeQueueBtn) {
      resumeQueueBtn.addEventListener('click', () => {
        this.queueController.resumeQueue();
      });
    }
  }
  
  /**
   * 切换模式
   */
  switchMode(mode) {
    this.currentMode = mode;
    
    // 更新按钮状态
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }
  
  /**
   * 打开任务队列弹窗
   */
  openTasksModal() {
    const modal = document.getElementById('tasksModal');
    if (modal) {
      modal.style.display = 'flex';
      this.taskManager.loadTasks();
    }
  }
  
  /**
   * 关闭任务队列弹窗
   */
  closeTasksModal() {
    const modal = document.getElementById('tasksModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  /**
   * 提取
   */
  async extract() {
    // 从存储中获取配置，如果没有则使用默认值（全选）
    const result = await chrome.storage.local.get(['extractOptions']);
    const options = result.extractOptions || {
      inlineCSS: true,
      collectImages: true,
      collectFonts: true
    };
    
    // 获取自定义 URL（如果有）
    const customUrl = document.getElementById('customUrlInput').value.trim();
    
    if (this.currentMode === 'current') {
      await this.extractCurrent(options, customUrl);
    } else {
      await this.extractAll(options, customUrl);
    }
  }
  
  /**
   * 提取当前页面
   */
  async extractCurrent(options, customUrl) {
    try {
      // 使用自定义 URL 或当前标签页 URL
      const targetUrl = customUrl || this.currentTab?.url;
      
      if (!targetUrl) {
        this.showNotification('error', '无法获取目标 URL');
        return;
      }
      
      // 验证 URL
      if (customUrl) {
        try {
          new URL(customUrl);
        } catch (e) {
          this.showNotification('error', '请输入有效的 URL');
          return;
        }
      }
      
      // 添加到后台任务
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_TASK',
        url: targetUrl,
        options
      });
      
      if (response.success) {
        // 打开任务队列弹窗
        this.openTasksModal();
        this.showNotification('success', '任务已添加到队列，可以关闭此窗口');
      }
    } catch (error) {
      this.showNotification('error', '添加任务失败：' + error.message);
    }
  }
  
  /**
   * 提取所有页面
   */
  async extractAll(options, customUrl) {
    try {
      // 如果有自定义 URL，只提取该 URL，忽略扫描路由
      if (customUrl) {
        try {
          new URL(customUrl);
        } catch (e) {
          this.showNotification('error', '请输入有效的 URL');
          return;
        }
        
        const response = await chrome.runtime.sendMessage({
          type: 'ADD_TASK',
          url: customUrl,
          options
        });
        
        if (response.success) {
          this.openTasksModal();
          this.showNotification('success', '任务已添加到队列');
        }
        return;
      }
      
      // 先扫描路由
      if (!this.currentTab?.id || !this.currentTab?.url) {
        this.showNotification('error', '无法获取当前标签页信息');
        return;
      }
      
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'scanRoutes'
      });
      
      if (response && response.success && response.routes.length > 0) {
        const baseUrl = new URL(this.currentTab.url);
        const urls = response.routes.map(route => new URL(route, baseUrl).toString());
        
        // 批量添加任务
        const batchResponse = await chrome.runtime.sendMessage({
          type: 'ADD_BATCH_TASKS',
          urls,
          options
        });
        
        if (batchResponse.success) {
          this.openTasksModal();
          let message = `已添加 ${urls.length} 个任务到队列`;
          if (response.totalFound && response.totalFound > urls.length) {
            message += `（共发现 ${response.totalFound} 个页面，已按深度排序并限制为前 ${urls.length} 个）`;
          }
          this.showNotification('success', message);
        }
      } else {
        this.showNotification('error', '未找到可提取的页面');
      }
    } catch (error) {
      this.showNotification('error', '扫描失败：' + error.message);
    }
  }
  
  /**
   * 监听任务更新
   */
  listenTaskUpdates() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TASKS_UPDATED') {
        this.taskManager.loadTasks();
      }
    });
  }
  
  /**
   * 显示通知
   */
  showNotification(type, message) {
    // 简单的 alert，可以后续改为更优雅的通知
    const icons = {
      success: '✓',
      error: '✗'
    };
    alert(`${icons[type]} ${message}`);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
