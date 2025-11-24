/**
 * Popup 控制器 - 苹果风格
 */
class PopupController {
  constructor() {
    this.currentTab = null;
    this.currentMode = 'current'; // 'current' or 'all'
    this.tasks = [];
    this.domainCollapse = {};
    this.init();
  }
  
  async init() {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tab;
    
    // 显示页面信息
    this.displayPageInfo(tab);
    
    // 加载配置和模型选项
    await this.loadConfig();
    
    // 绑定事件
    this.bindEvents();
    
    // 加载任务列表
    await this.loadTasks();
    
    // 监听后台任务更新
    this.listenTaskUpdates();
  }
  
  /**
   * 显示页面信息
   */
  displayPageInfo(tab) {
    document.getElementById('pageTitle').textContent = tab.title || '未命名页面';
    try {
      const url = new URL(tab.url);
      document.getElementById('pageUrl').textContent = url.hostname;
    } catch {
      document.getElementById('pageUrl').textContent = tab.url;
    }
  }
  
  /**
   * 加载配置
   */
  async loadConfig() {
    const result = await chrome.storage.local.get(['aiModels']);
    const aiModels = result.aiModels || [];
    
    // 获取默认模型
    const defaultModel = aiModels.find(m => m.isDefault) || aiModels[0] || null;
    
    this.displayModelSelector(defaultModel, aiModels);
  }
  
  /**
   * 显示模型选择器
   */
  displayModelSelector(defaultModel, allModels) {
    const container = document.getElementById('modelSelectorContainer');
    
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
      document.getElementById('goToSettingsBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
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
    // 设置按钮
    document.getElementById('settingsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    
    // 任务队列按钮
    document.getElementById('tasksBtn').addEventListener('click', () => {
      this.openTasksModal();
    });
    
    // 关闭弹窗
    document.getElementById('closeModalBtn').addEventListener('click', () => {
      this.closeTasksModal();
    });
    
    // 点击弹窗背景关闭
    document.querySelector('.modal-overlay')?.addEventListener('click', () => {
      this.closeTasksModal();
    });
    
    // 模式切换
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchMode(e.currentTarget.dataset.mode);
      });
    });
    
    // 立即提取按钮
    document.getElementById('extractBtn').addEventListener('click', () => {
      this.extract();
    });
    
    // 清除已完成任务
    document.getElementById('clearCompletedBtn').addEventListener('click', () => {
      this.clearCompleted();
    });
    
    // 模型选择变化时保存
    document.getElementById('modelSelect').addEventListener('change', async (e) => {
      const result = await chrome.storage.local.get(['aiConfig']);
      const aiConfig = result.aiConfig || {};
      aiConfig.modelName = e.target.value;
      await chrome.storage.local.set({ aiConfig });
    });
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
    document.getElementById('tasksModal').style.display = 'flex';
    this.loadTasks();
  }
  
  /**
   * 关闭任务队列弹窗
   */
  closeTasksModal() {
    document.getElementById('tasksModal').style.display = 'none';
  }
  
  /**
   * 提取
   */
  async extract() {
    const options = {
      inlineCSS: document.getElementById('inlineCSS').checked,
      collectImages: document.getElementById('collectImages').checked,
      collectFonts: document.getElementById('collectFonts').checked
    };
    
    if (this.currentMode === 'current') {
      await this.extractCurrent(options);
    } else {
      await this.extractAll(options);
    }
  }
  
  /**
   * 提取当前页面
   */
  async extractCurrent(options) {
    try {
      // 添加到后台任务
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_TASK',
        url: this.currentTab.url,
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
  async extractAll(options) {
    try {
      // 先扫描路由
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
          this.showNotification('success', `已添加 ${urls.length} 个任务到队列`);
        }
      } else {
        this.showNotification('error', '未找到可提取的页面');
      }
    } catch (error) {
      this.showNotification('error', '扫描失败：' + error.message);
    }
  }
  
  /**
   * 加载任务列表
   */
  async loadTasks() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TASKS'
      });
      
      if (response.success) {
        this.tasks = response.tasks;
        this.displayTasks(response.tasks);
        this.updateStats();
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    }
  }
  
  /**
   * 显示任务列表
   */
  displayTasks(tasks) {
    const list = document.getElementById('tasksList');
    
    if (tasks.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>暂无任务</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = '';
    const groups = {};
    tasks.forEach(t => {
      const domain = (() => { try { return new URL(t.url).hostname; } catch { return '未知域名'; } })();
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(t);
    });

    Object.entries(groups).forEach(([domain, domainTasks]) => {
      const group = document.createElement('div');
      const header = document.createElement('div');
      const arrow = document.createElement('span');
      const count = document.createElement('span');
      const body = document.createElement('div');

      group.style.marginBottom = '8px';
      header.style.cssText = 'padding:10px 8px; border-radius:8px; background:#f8fafc; display:flex; align-items:center; gap:8px; cursor:pointer;';
      arrow.textContent = '▶';
      arrow.style.cssText = 'display:inline-block; transition:transform .2s; color: var(--text-secondary);';
      header.appendChild(arrow);
      const title = document.createElement('span');
      title.textContent = domain;
      title.style.cssText = 'font-weight:600; font-size:12px; color: var(--text-secondary);';
      header.appendChild(title);
      count.textContent = domainTasks.length;
      count.style.cssText = 'margin-left:auto; font-size:12px; color: var(--text-secondary);';
      header.appendChild(count);

      const collapsed = this.domainCollapse[domain] !== false;
      if (!collapsed) arrow.style.transform = 'rotate(90deg)';

      body.style.cssText = 'margin-top:8px;';
      body.style.display = collapsed ? 'none' : 'block';
      domainTasks.forEach(task => body.appendChild(this.createTaskItem(task)));

      header.addEventListener('click', () => {
        const isCollapsed = body.style.display === 'none';
        body.style.display = isCollapsed ? 'block' : 'none';
        arrow.style.transform = isCollapsed ? 'rotate(90deg)' : 'rotate(0deg)';
        this.domainCollapse[domain] = isCollapsed ? false : true;
      });

      group.appendChild(header);
      group.appendChild(body);
      list.appendChild(group);
    });
  }
  
  /**
   * 创建任务项
   */
  createTaskItem(task) {
    const item = document.createElement('div');
    item.className = `task-item ${task.status}`;
    
    const statusIcons = {
      pending: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>',
      running: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2"/>',
      analyzing: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8a4 4 0 1 0 4 4" stroke="currentColor" stroke-width="2"/>',
      completed: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2"/>',
      failed: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2"/>'
    };
    
    const statusTexts = {
      pending: '等待中',
      running: '进行中',
      analyzing: '分析中',
      completed: '已完成',
      failed: '失败'
    };
    
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          ${statusIcons[task.status]}
        </svg>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${task.title}
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${task.url}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; font-size: 12px; font-weight: 600; color: var(--text-secondary);">
          <span>${statusTexts[task.status]}</span>
          <span>${task.progress}%</span>
        </div>
      </div>
      ${task.progress > 0 && task.progress < 100 ? `
        <div style="margin-top: 12px; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%); width: ${task.progress}%; transition: width 0.3s;"></div>
        </div>
      ` : ''}
    `;
    
    return item;
  }
  
  /**
   * 更新统计信息
   */
  async updateStats() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATS'
      });
      
      if (response.success) {
        const stats = response.stats;
        
        document.getElementById('totalTasks').textContent = stats.total;
        document.getElementById('runningTasks').textContent = stats.running;
        document.getElementById('completedTasks').textContent = stats.completed;
        document.getElementById('failedTasks').textContent = stats.failed;
        
        // 更新任务徽章
        const badge = document.getElementById('taskBadge');
        if (stats.running > 0) {
          badge.textContent = stats.running;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
        
        // 显示/隐藏统计
        const summary = document.getElementById('tasksSummary');
        summary.style.display = stats.total > 0 ? 'grid' : 'none';
      }
    } catch (error) {
      console.error('更新统计失败:', error);
    }
  }
  
  /**
   * 清除已完成任务
   */
  async clearCompleted() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CLEAR_COMPLETED'
      });
      
      if (response.success) {
        await this.loadTasks();
        this.showNotification('success', '已清除完成的任务');
      }
    } catch (error) {
      this.showNotification('error', '清除失败');
    }
  }
  
  /**
   * 监听任务更新
   */
  listenTaskUpdates() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TASKS_UPDATED') {
        this.loadTasks();
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
