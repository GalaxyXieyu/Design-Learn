/**
 * 任务管理模块
 * 负责任务列表的显示、创建和更新
 */
class TaskManager {
  constructor(controller) {
    this.controller = controller;
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
        this.controller.tasks = response.tasks;
        this.displayTasks(response.tasks);
        await this.updateStats();
        await this.controller.queueController.updateQueueState();
        this.controller.queueController.updateClearButton();
        this.controller.queueController.updateSelectAllButton();
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
      title.style.cssText = 'font-weight:600; font-size:12px; color: var(--text-secondary); flex: 1;';
      header.appendChild(title);

      // 计算分组状态
      const runningCount = domainTasks.filter(t => t.status === 'running' || t.status === 'analyzing').length;
      const completedCount = domainTasks.filter(t => t.status === 'completed').length;
      const failedCount = domainTasks.filter(t => t.status === 'failed').length;
      
      // 状态摘要
      const summary = document.createElement('div');
      summary.style.cssText = 'font-size: 11px; color: var(--text-tertiary); margin-right: 8px; display: flex; align-items: center; gap: 6px;';
      
      if (runningCount > 0) {
        summary.innerHTML = `
          <div class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></div>
          <span style="color: var(--accent-color);">处理中 ${runningCount}/${domainTasks.length}</span>
        `;
      } else if (completedCount === domainTasks.length) {
        summary.innerHTML = `<span style="color: var(--success-color);">全部完成</span>`;
      } else {
        const parts = [];
        if (completedCount > 0) parts.push(`${completedCount} 完成`);
        if (failedCount > 0) parts.push(`${failedCount} 失败`);
        if (domainTasks.length - completedCount - failedCount > 0) parts.push(`${domainTasks.length - completedCount - failedCount} 等待`);
        summary.textContent = parts.join(' · ');
      }
      header.appendChild(summary);

      count.textContent = domainTasks.length;
      count.style.cssText = 'margin-left:auto; font-size:12px; color: var(--text-secondary);';
      header.appendChild(count);

      const collapsed = this.controller.domainCollapse[domain] !== false;
      if (!collapsed) arrow.style.transform = 'rotate(90deg)';

      body.style.cssText = 'margin-top:8px;';
      body.style.display = collapsed ? 'none' : 'block';
      
      // 添加新增任务输入框（在任务列表之前）
      const addTaskSection = this.createAddTaskInput(domain);
      body.appendChild(addTaskSection);
      
      // 添加任务列表
      domainTasks.forEach(task => body.appendChild(this.createTaskItem(task)));

      header.addEventListener('click', () => {
        const isCollapsed = body.style.display === 'none';
        body.style.display = isCollapsed ? 'block' : 'none';
        arrow.style.transform = isCollapsed ? 'rotate(90deg)' : 'rotate(0deg)';
        this.controller.domainCollapse[domain] = isCollapsed ? false : true;
      });

      group.appendChild(header);
      group.appendChild(body);
      list.appendChild(group);
    });
  }
  
  /**
   * 创建新增任务输入框
   */
  createAddTaskInput(domain) {
    const section = document.createElement('div');
    section.className = 'add-task-section-inline';
    section.style.cssText = 'margin-bottom: 12px;';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'add-task-input-wrapper';
    wrapper.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      transition: all 0.2s;
    `;
    
    // 图标
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.style.cssText = 'color: var(--text-secondary); flex-shrink: 0;';
    icon.innerHTML = `
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `;
    
    // 输入框
    const input = document.createElement('input');
    input.type = 'url';
    input.className = 'add-task-input';
    input.placeholder = '输入 URL 添加新任务...';
    input.dataset.domain = domain;
    input.style.cssText = `
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 13px;
      color: var(--text-primary);
      font-family: inherit;
    `;
    
    // 添加按钮
    const button = document.createElement('button');
    button.className = 'add-task-btn';
    button.dataset.domain = domain;
    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: var(--primary-gradient);
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    `;
    
    const btnIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    btnIcon.setAttribute('width', '16');
    btnIcon.setAttribute('height', '16');
    btnIcon.setAttribute('viewBox', '0 0 24 24');
    btnIcon.setAttribute('fill', 'none');
    btnIcon.innerHTML = `<path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
    button.appendChild(btnIcon);
    
    // 事件监听
    wrapper.addEventListener('focusin', () => {
      wrapper.style.borderColor = 'var(--accent-color)';
      wrapper.style.boxShadow = '0 0 0 3px rgba(107, 157, 214, 0.1)';
    });
    
    wrapper.addEventListener('focusout', () => {
      wrapper.style.borderColor = 'var(--border-color)';
      wrapper.style.boxShadow = 'none';
    });
    
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 4px 12px rgba(107, 157, 214, 0.3)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = 'none';
    });
    
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.addNewTask(domain, input);
    });
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        this.addNewTask(domain, input);
      }
    });
    
    wrapper.appendChild(icon);
    wrapper.appendChild(input);
    wrapper.appendChild(button);
    section.appendChild(wrapper);
    
    return section;
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
      extracted: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2"/>',
      analyzing: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8a4 4 0 1 0 4 4" stroke="currentColor" stroke-width="2"/>',
      completed: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2"/>',
      failed: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2"/>'
    };

    const statusTexts = {
      pending: '等待中',
      running: '进行中',
      extracted: '已提取',
      analyzing: '分析中',
      completed: '已完成',
      failed: '失败'
    };
    
    const isSelected = this.controller.selectedTasks.has(task.id);
    
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" ${isSelected ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 13px; font-weight: 500; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${task.title}
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 6px;">
            <span style="opacity: 0.7;">${task.url}</span>
            ${task.stage ? `<span style="background: ${task.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.05)'}; padding: 1px 5px; border-radius: 3px; font-size: 10px; color: ${task.status === 'failed' ? '#ef4444' : 'var(--text-primary)'};">${task.stage}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px; font-size: 11px; font-weight: 600; color: var(--text-secondary); flex-shrink: 0;">
          <svg class="task-status-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
            ${statusIcons[task.status]}
          </svg>
          <span>${statusTexts[task.status]}</span>
          <span>${task.progress}%</span>
        </div>
      </div>
      ${task.progress > 0 && task.progress < 100 ? `
        <div style="margin-top: 8px; height: 3px; background: #e5e7eb; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%); width: ${task.progress}%; transition: width 0.3s;"></div>
        </div>
      ` : ''}
    `;
    
    // 绑定复选框事件
    const checkbox = item.querySelector('.task-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (e.target.checked) {
          this.controller.selectedTasks.add(task.id);
        } else {
          this.controller.selectedTasks.delete(task.id);
        }
        this.controller.queueController.updateClearButton();
        this.controller.queueController.updateSelectAllButton();
      });
    }
    
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
        
        const totalTasks = document.getElementById('totalTasks');
        const runningTasks = document.getElementById('runningTasks');
        const completedTasks = document.getElementById('completedTasks');
        const failedTasks = document.getElementById('failedTasks');
        
        if (totalTasks) totalTasks.textContent = stats.total;
        if (runningTasks) runningTasks.textContent = stats.running;
        if (completedTasks) completedTasks.textContent = stats.completed;
        if (failedTasks) failedTasks.textContent = stats.failed;
        
        // 更新任务徽章
        const badge = document.getElementById('taskBadge');
        if (badge) {
          if (stats.running > 0) {
            badge.textContent = stats.running;
            badge.style.display = 'flex';
          } else {
            badge.style.display = 'none';
          }
        }
        
        // 显示/隐藏统计
        const summary = document.getElementById('tasksSummary');
        if (summary) {
          summary.style.display = stats.total > 0 ? 'grid' : 'none';
        }
      }
    } catch (error) {
      console.error('更新统计失败:', error);
    }
  }

  /**
   * 新增任务
   */
  async addNewTask(domain, inputElement) {
    let urlValue = inputElement.value.trim();
    
    if (!urlValue) {
      this.controller.showNotification('error', '请输入 URL');
      return;
    }
    
    // 如果输入的不是完整 URL，尝试补全域名
    let fullUrl = urlValue;
    if (!urlValue.startsWith('http://') && !urlValue.startsWith('https://')) {
      // 如果只是路径，补全域名和协议
      if (urlValue.startsWith('/')) {
        fullUrl = `https://${domain}${urlValue}`;
      } else {
        // 尝试作为完整 URL
        fullUrl = `https://${urlValue}`;
      }
    }
    
    // 验证 URL
    try {
      const parsedUrl = new URL(fullUrl);
      // 检查域名是否匹配（如果输入的是完整URL，允许不同域名）
      if (urlValue.startsWith('/') && parsedUrl.hostname !== domain) {
        parsedUrl.hostname = domain;
        fullUrl = parsedUrl.toString();
      }
    } catch (e) {
      this.controller.showNotification('error', '请输入有效的 URL');
      return;
    }
    
    try {
      // 获取当前提取选项
      const result = await chrome.storage.local.get(['extractOptions']);
      const options = result.extractOptions || {
        inlineCSS: true,
        collectImages: true,
        collectFonts: true
      };
      
      // 添加任务到队列
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_TASK',
        url: fullUrl,
        options
      });
      
      if (response.success) {
        // 清空输入框
        inputElement.value = '';
        
        // 刷新任务列表
        await this.loadTasks();
        
        // 显示成功提示
        const message = this.controller.queuePaused 
          ? '任务已添加到队列（队列已暂停）' 
          : '任务已添加到队列';
        this.controller.showNotification('success', message);
      } else {
        this.controller.showNotification('error', response.error || '添加任务失败');
      }
    } catch (error) {
      this.controller.showNotification('error', '添加任务失败：' + error.message);
    }
  }

  /**
   * 编辑任务
   */
  async editTask(task) {
    const newUrl = prompt('请输入新的 URL：', task.url);
    
    if (newUrl && newUrl !== task.url) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'EDIT_TASK_URL',
          taskId: task.id,
          newUrl
        });
        
        if (response.success) {
          await this.loadTasks();
          this.controller.showNotification('success', '任务已更新');
        } else {
          this.controller.showNotification('error', response.error || '编辑失败');
        }
      } catch (error) {
        this.controller.showNotification('error', '编辑失败：' + error.message);
      }
    }
  }
}
