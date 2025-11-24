/**
 * 后台任务管理器
 * 在 Service Worker 中运行，持久化任务队列
 */
class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.queue = [];
    this.running = false;
    this.maxConcurrent = 1; // 一次只处理一个任务
    this.init();
  }
  
  async init() {
    // 从存储中恢复任务
    const stored = await chrome.storage.local.get('tasks');
    if (stored.tasks) {
      this.tasks = new Map(Object.entries(stored.tasks));
      this.queue = Array.from(this.tasks.keys()).filter(id => {
        const task = this.tasks.get(id);
        return task.status === 'pending' || task.status === 'running';
      });
    }
    
    // 恢复运行中的任务为待处理
    this.tasks.forEach(task => {
      if (task.status === 'running') {
        task.status = 'pending';
      }
    });
    
    await this.saveTasks();
    
    // 如果有待处理的任务，继续执行
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }
  
  /**
   * 添加任务
   */
  async addTask(url, options = {}) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task = {
      id: taskId,
      url,
      domain: new URL(url).hostname,
      title: new URL(url).pathname,
      options,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      result: null
    };
    
    this.tasks.set(taskId, task);
    this.queue.push(taskId);
    
    await this.saveTasks();
    this.notifyUpdate();
    
    // 开始处理队列
    if (!this.running) {
      this.processQueue();
    }
    
    return taskId;
  }
  
  /**
   * 批量添加任务
   */
  async addBatchTasks(urls, options = {}) {
    const taskIds = [];
    
    for (const url of urls) {
      const taskId = await this.addTask(url, options);
      taskIds.push(taskId);
    }
    
    return taskIds;
  }
  
  /**
   * 处理任务队列
   */
  async processQueue() {
    if (this.running || this.queue.length === 0) return;
    
    this.running = true;
    
    while (this.queue.length > 0) {
      const taskId = this.queue.shift();
      const task = this.tasks.get(taskId);
      
      if (!task || task.status === 'completed' || task.status === 'failed') {
        continue;
      }
      
      await this.executeTask(taskId);
    }
    
    this.running = false;
  }
  
  /**
   * 执行单个任务
   */
  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    try {
      // 更新状态为运行中
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      task.progress = 10;
      await this.saveTasks();
      this.notifyUpdate();
      
      // 创建新标签页
      const tab = await chrome.tabs.create({
        url: task.url,
        active: false
      });
      
      task.progress = 30;
      await this.saveTasks();
      this.notifyUpdate();
      
      // 等待页面加载
      await this.waitForTabLoad(tab.id);
      
      task.progress = 50;
      await this.saveTasks();
      this.notifyUpdate();
      
      // 提取页面
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extract',
        options: task.options
      });
      
      task.progress = 80;
      await this.saveTasks();
      this.notifyUpdate();
      
      if (response && response.success) {
        // 保存快照
        await this.saveSnapshot(response.snapshot);
        
        task.progress = 85;
        task.status = 'analyzing';
        await this.saveTasks();
        this.notifyUpdate();
        
        // 自动进行 AI 分析
        try {
          const analysis = await this.analyzeSnapshot(response.snapshot);
          
      task.progress = 95;
      await this.saveTasks();
      this.notifyUpdate();
      
      // 自动下载 Markdown
          if (analysis && analysis.markdown) {
            await this.downloadMarkdown(analysis.markdown, response.snapshot.title, false);
          }
          
          task.status = 'completed';
          task.progress = 100;
          task.result = {
            snapshotId: response.snapshot.id,
            size: response.snapshot.html.length + response.snapshot.css.length,
            hasAnalysis: !!analysis,
            analysisFormat: analysis && analysis.format ? analysis.format : (analysis && analysis.raw ? 'raw' : 'json')
          };
        } catch (analysisError) {
          console.error('[TaskManager] AI 分析失败:', analysisError);
          // 即使分析失败，任务也标记为完成（快照已保存）
          task.status = 'completed';
          task.progress = 100;
          task.result = {
            snapshotId: response.snapshot.id,
            size: response.snapshot.html.length + response.snapshot.css.length,
            analysisError: analysisError.message
          };
        }
      } else {
        throw new Error(response?.error || '提取失败');
      }
      
      // 关闭标签页
      await chrome.tabs.remove(tab.id);
      
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      console.error('[TaskManager] 任务失败:', taskId, error);
    } finally {
      task.completedAt = new Date().toISOString();
      await this.saveTasks();
      this.notifyUpdate();
    }
  }
  
  /**
   * 等待标签页加载完成
   */
  waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('页面加载超时'));
      }, 30000);
      
      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          // 额外等待确保 content script 加载
          setTimeout(resolve, 1000);
        }
      };
      
      chrome.tabs.onUpdated.addListener(listener);
    });
  }
  
  /**
   * 保存快照到 IndexedDB
   */
  async saveSnapshot(snapshot) {
    return new Promise((resolve) => {
      const request = indexedDB.open('StyleGenerator', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('snapshots', 'readwrite');
        const store = tx.objectStore('snapshots');
        store.add(snapshot);
        tx.oncomplete = () => resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * 更新快照（写入 Markdown 等）
   */
  async updateSnapshot(snapshot) {
    return new Promise((resolve) => {
      const request = indexedDB.open('StyleGenerator', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('snapshots', 'readwrite');
        const store = tx.objectStore('snapshots');
        store.put(snapshot);
        tx.oncomplete = () => resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'id' });
        }
      };
    });
  }
  
  /**
   * AI 分析快照
   */
  async analyzeSnapshot(snapshot) {
    try {
      // 使用全局的 AIAnalyzer 类（已通过 importScripts 加载）
      const analyzer = new AIAnalyzer();
      
      // 执行分析
      const result = await analyzer.analyze(snapshot);
      
      return result;
    } catch (error) {
      console.error('[TaskManager] AI 分析错误:', error);
      throw error;
    }
  }
  
  /**
   * 下载 Markdown 文件
   */
  async downloadMarkdown(markdown, title, saveAs = false) {
    try {
      // 生成文件名
      const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_style.md`;
      
      // 使用 data URL（MV3 service worker 不支持 createObjectURL）
      const url = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdown);

      await chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs
      });

      console.log('[TaskManager] Markdown 已下载:', filename);
    } catch (error) {
      console.error('[TaskManager] Markdown 下载失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取任务状态
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }
  
  /**
   * 获取所有任务
   */
  getAllTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }
  
  /**
   * 获取任务统计
   */
  getStats() {
    const tasks = this.getAllTasks();
    const runningCount = tasks.filter(t => t.status === 'running' || t.status === 'analyzing').length;
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: runningCount,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length
    };
  }
  
  /**
   * 清除已完成的任务
   */
  async clearCompleted() {
    const toRemove = [];
    this.tasks.forEach((task, id) => {
      if (task.status === 'completed') {
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => this.tasks.delete(id));
    await this.saveTasks();
    this.notifyUpdate();
  }
  
  /**
   * 取消任务
   */
  async cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task && (task.status === 'pending' || task.status === 'running')) {
      task.status = 'failed';
      task.error = '用户取消';
      task.completedAt = new Date().toISOString();
      
      // 从队列中移除
      const index = this.queue.indexOf(taskId);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
      
      await this.saveTasks();
      this.notifyUpdate();
    }
  }
  
  /**
   * 保存任务到存储
   */
  async saveTasks() {
    const tasksObj = Object.fromEntries(this.tasks);
    await chrome.storage.local.set({ tasks: tasksObj });
  }
  
  /**
   * 通知更新
   */
  notifyUpdate() {
    // 发送消息到所有打开的 popup
    chrome.runtime.sendMessage({
      type: 'TASKS_UPDATED',
      stats: this.getStats()
    }).catch(() => {
      // Popup 可能未打开，忽略错误
    });
  }
}

// 创建全局实例
const taskManager = new TaskManager();

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ADD_TASK') {
    taskManager.addTask(request.url, request.options)
      .then(taskId => sendResponse({ success: true, taskId }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'ADD_BATCH_TASKS') {
    taskManager.addBatchTasks(request.urls, request.options)
      .then(taskIds => sendResponse({ success: true, taskIds }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'GET_TASKS') {
    sendResponse({ success: true, tasks: taskManager.getAllTasks() });
    return true;
  }
  
  if (request.type === 'GET_STATS') {
    sendResponse({ success: true, stats: taskManager.getStats() });
    return true;
  }
  
  if (request.type === 'CLEAR_COMPLETED') {
    taskManager.clearCompleted()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'CANCEL_TASK') {
    taskManager.cancelTask(request.taskId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'ANALYZE_SNAPSHOT') {
    (async () => {
      try {
        const snapshot = request.snapshot;
        const analysis = await taskManager.analyzeSnapshot(snapshot);
        const updated = { ...snapshot, markdown: analysis.markdown };
        await taskManager.updateSnapshot(updated);
        if (analysis && analysis.markdown) {
          await taskManager.downloadMarkdown(analysis.markdown, snapshot.title, true);
        }
        sendResponse({ success: true, markdown: analysis.markdown, format: analysis.format });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

console.log('[TaskManager] Task manager initialized');
