/**
 * 后台任务管理器
 * 在 Service Worker 中运行，持久化任务队列
 */

// IndexedDB 配置常量
const DB_NAME = 'StyleGenerator';

// 动态获取数据库版本
async function getDBVersion() {
  try {
    const databases = await indexedDB.databases();
    const db = databases.find(d => d.name === DB_NAME);
    return db?.version || 1;
  } catch (e) {
    // 旧版浏览器不支持 indexedDB.databases()，返回默认版本
    return 2;
  }
}

class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.queue = [];
    this.running = false;
    this.paused = false; // 队列是否暂停
    this.maxConcurrent = 1; // 一次只处理一个任务
    this.currentTaskId = null; // 当前正在执行的任务 ID
    this.abortedTasks = new Set(); // 被中止的任务 ID
    this.batchGroups = new Map(); // 批次分组 Map<batchId, taskIds[]>
    this.init();
  }
  
  async init() {
    const stored = await chrome.storage.local.get(['tasks', 'queuePaused']);
    if (stored.tasks) {
      this.tasks = new Map(Object.entries(stored.tasks));
      // 仅将 pending 任务加入队列，避免因后台重启导致 running 任务重复执行
      this.queue = Array.from(this.tasks.keys()).filter(id => {
        const task = this.tasks.get(id);
        return task.status === 'pending';
      });
      // 将运行中任务标记为失败，防止自动重跑
      this.tasks.forEach(task => {
        if (task.status === 'running') {
          task.status = 'failed';
          task.error = '后台重启导致任务中断';
          task.completedAt = new Date().toISOString();
        }
      });
    }
    this.paused = stored.queuePaused || false;
    await this.saveTasks();
    if (this.queue.length > 0 && !this.paused) {
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
    const batchId = `batch_${Date.now()}`;
    const taskIds = [];

    for (const url of urls) {
      const taskId = await this.addTask(url, { ...options, batchId });
      taskIds.push(taskId);
    }

    this.batchGroups.set(batchId, taskIds);
    return taskIds;
  }
  
  /**
   * 处理任务队列
   */
  async processQueue() {
    if (this.running || this.queue.length === 0) return;

    this.running = true;

    while (this.queue.length > 0 && !this.paused) {
      const taskId = this.queue.shift();
      const task = this.tasks.get(taskId);

      if (!task || task.status === 'completed' || task.status === 'failed') {
        continue;
      }

      await this.executeTask(taskId);

      // 检查批次任务是否全部完成提取
      if (task.options?.batchId) {
        await this.checkBatchCompletion(task.options.batchId);
      }

      // 检查是否暂停
      if (this.paused) {
        // 把任务放回队列开头
        this.queue.unshift(taskId);
        break;
      }
    }

    this.running = false;
  }
  
  /**
   * 执行单个任务
   */
  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    this.currentTaskId = taskId;
    let tab = null;
    
    // 检查任务是否已被中止
    const checkAborted = () => {
      if (this.abortedTasks.has(taskId)) {
        this.abortedTasks.delete(taskId);
        throw new Error('任务已被删除');
      }
    };
    
    try {
      checkAborted();
      // 更新状态为运行中
      task.status = 'running';
      task.stage = '正在初始化任务...';
      task.startedAt = new Date().toISOString();
      task.progress = 10;
      await this.saveTasks();
      this.notifyUpdate();
      
      // 创建新标签页
      task.stage = '正在打开目标页面...';
      await this.saveTasks();
      this.notifyUpdate();
      
      tab = await chrome.tabs.create({
        url: task.url,
        active: false
      });
      
      task.progress = 30;
      task.stage = '等待页面加载...';
      await this.saveTasks();
      this.notifyUpdate();
      
      // 等待页面加载
      await this.waitForTabLoad(tab.id);
      checkAborted();
      
      task.progress = 50;
      task.stage = '正在提取页面静态资源...';
      await this.saveTasks();
      this.notifyUpdate();
      
      // 提取页面
      console.log('[TaskManager] 发送提取消息到 tab:', tab.id);
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          action: 'extract',
          options: task.options
        });
        console.log('[TaskManager] 收到 content script 响应');
      } catch (msgError) {
        console.error('[TaskManager] 发送消息失败:', msgError.message);
        throw new Error('无法与页面通信，可能 content script 未加载: ' + msgError.message);
      }
      
      task.progress = 80;
      task.stage = '提取完成，正在保存...';
      await this.saveTasks();
      this.notifyUpdate();

      console.log('[TaskManager] 收到提取响应:', response ? 'success=' + response.success : 'null');

      if (response && response.success) {
        checkAborted();

        // 保存快照
        console.log('[TaskManager] 开始保存快照...');
        await this.saveSnapshot(response.snapshot);
        console.log('[TaskManager] 快照保存完成');
        checkAborted();

        // 如果是批次任务，只标记为已提取，不立即分析
        if (task.options?.batchId) {
          task.status = 'extracted';
          task.stage = '已提取，等待批次分析';
          task.progress = 90;
          task.result = {
            snapshotId: response.snapshot.id,
            size: response.snapshot.html.length + response.snapshot.css.length
          };
        } else {
          // 单个任务立即分析
          task.progress = 85;
          task.status = 'analyzing';
          task.stage = '正在进行 AI 风格分析...';
          await this.saveTasks();
          this.notifyUpdate();

          try {
            console.log('[TaskManager] 开始 AI 分析...');
            const analysis = await this.analyzeSnapshot(response.snapshot);
            console.log('[TaskManager] AI 分析完成:', analysis ? '有结果' : '无结果');

            task.progress = 95;
            task.stage = '分析完成，正在生成文件...';
            await this.saveTasks();
            this.notifyUpdate();

            if (analysis && analysis.markdown) {
              await this.downloadMarkdown(analysis.markdown, response.snapshot.title, false);
            }

            task.status = 'completed';
            task.stage = '已完成';
            task.progress = 100;
            task.result = {
              snapshotId: response.snapshot.id,
              size: response.snapshot.html.length + response.snapshot.css.length,
              hasAnalysis: !!analysis,
              analysisFormat: analysis && analysis.format ? analysis.format : (analysis && analysis.raw ? 'raw' : 'json')
            };
          } catch (analysisError) {
            console.error('=== AI 分析失败 ===');
            console.error('错误信息:', analysisError.message);
            console.error('错误堆栈:', analysisError.stack);
            task.status = 'completed';
            task.progress = 100;
            task.stage = `分析失败: ${analysisError.message}`;
            task.result = {
              snapshotId: response.snapshot.id,
              size: response.snapshot.html.length + response.snapshot.css.length,
              analysisError: analysisError.message
            };
          }
        }
      } else {
        throw new Error(response?.error || '提取失败');
      }
      
      // 关闭标签页
      if (tab && tab.id) {
        await chrome.tabs.remove(tab.id);
      }
      
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      console.error('=== 任务执行失败 ===');
      console.error('错误信息:', error.message);
      console.error('错误堆栈:', error.stack);
    } finally {
      // 确保失败情况下也关闭标签页，避免残留导致重复执行
      try {
        if (tab && tab.id) {
          await chrome.tabs.remove(tab.id);
        }
      } catch {}
      task.completedAt = new Date().toISOString();
      await this.saveTasks();
      this.notifyUpdate();
    }
  }
  
  /**
   * 检查批次任务是否全部完成提取
   */
  async checkBatchCompletion(batchId) {
    const taskIds = this.batchGroups.get(batchId);
    if (!taskIds) return;

    const tasks = taskIds.map(id => this.tasks.get(id)).filter(Boolean);
    const allExtracted = tasks.every(t => t.status === 'extracted' || t.status === 'completed' || t.status === 'failed');

    if (!allExtracted) return;

    console.log(`[TaskManager] 批次 ${batchId} 全部提取完成，开始统一分析`);

    // 获取所有成功提取的快照
    const extractedTasks = tasks.filter(t => t.status === 'extracted');
    if (extractedTasks.length === 0) {
      console.log('[TaskManager] 没有成功提取的任务');
      return;
    }

    // 从 IndexedDB 读取所有快照
    const snapshots = await this.loadSnapshots(extractedTasks.map(t => t.result.snapshotId));

    // 统一进行 AI 分析
    for (const task of extractedTasks) {
      task.status = 'analyzing';
      task.stage = '正在进行批次 AI 分析...';
      task.progress = 92;
    }
    await this.saveTasks();
    this.notifyUpdate();

    try {
      console.log(`[TaskManager] 开始批次分析 ${snapshots.length} 个页面`);
      const analysis = await this.analyzeBatchSnapshots(snapshots);
      console.log('[TaskManager] 批次分析完成');

      // 更新所有任务状态
      for (let i = 0; i < extractedTasks.length; i++) {
        const task = extractedTasks[i];
        task.status = 'completed';
        task.stage = '已完成';
        task.progress = 100;
        task.result.hasAnalysis = !!analysis;
        task.result.analysisFormat = analysis?.format || 'json';
      }

      // 下载统一的 Markdown
      if (analysis && analysis.markdown) {
        const batchTitle = `batch_${new Date().toISOString().split('T')[0]}`;
        await this.downloadMarkdown(analysis.markdown, batchTitle, false);
      }
    } catch (error) {
      console.error('[TaskManager] 批次分析失败:', error);
      for (const task of extractedTasks) {
        task.status = 'completed';
        task.stage = `批次分析失败: ${error.message}`;
        task.progress = 100;
        task.result.analysisError = error.message;
      }
    }

    await this.saveTasks();
    this.notifyUpdate();
    this.batchGroups.delete(batchId);
  }

  /**
   * 从 IndexedDB 加载多个快照
   */
  async loadSnapshots(snapshotIds) {
    const dbVersion = await getDBVersion();
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, dbVersion);

      request.onerror = () => reject(new Error('IndexedDB 打开失败'));

      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('snapshots', 'readonly');
        const store = tx.objectStore('snapshots');
        const snapshots = [];

        let pending = snapshotIds.length;
        snapshotIds.forEach(id => {
          const getRequest = store.get(id);
          getRequest.onsuccess = () => {
            if (getRequest.result) snapshots.push(getRequest.result);
            if (--pending === 0) resolve(snapshots);
          };
          getRequest.onerror = () => {
            if (--pending === 0) resolve(snapshots);
          };
        });
      };
    });
  }

  /**
   * 批次分析多个快照
   */
  async analyzeBatchSnapshots(snapshots) {
    const analyzer = new AIAnalyzer();
    return await analyzer.analyzeBatch(snapshots);
  }

  /**
   * 等待标签页加载完成
   */
  waitForTabLoad(tabId) {
    return new Promise(async (resolve, reject) => {
      console.log('[TaskManager] 等待页面加载, tabId:', tabId);
      
      // 先检查页面是否已经加载完成
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          console.log('[TaskManager] 页面已加载完成');
          setTimeout(resolve, 1000);
          return;
        }
      } catch (e) {
        console.error('[TaskManager] 获取 tab 状态失败:', e.message);
      }
      
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        console.error('[TaskManager] 页面加载超时 (60s)');
        reject(new Error('页面加载超时'));
      }, 60000); // 增加到 60 秒
      
      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          console.log('[TaskManager] 页面加载完成事件触发');
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          // 额外等待确保 content script 加载
          setTimeout(resolve, 1500);
        }
      };
      
      chrome.tabs.onUpdated.addListener(listener);
    });
  }
  
  /**
   * 保存快照到 IndexedDB
   */
  async saveSnapshot(snapshot) {
    const dbVersion = await getDBVersion();
    return new Promise((resolve, reject) => {
      console.log('[TaskManager] 打开 IndexedDB, 版本:', dbVersion);
      const request = indexedDB.open(DB_NAME, dbVersion);
      
      request.onerror = (event) => {
        console.error('[TaskManager] IndexedDB 打开失败:', event.target.error);
        reject(new Error('IndexedDB 打开失败: ' + (event.target.error?.message || '未知错误')));
      };
      
      request.onsuccess = () => {
        console.log('[TaskManager] IndexedDB 打开成功');
        const db = request.result;
        const tx = db.transaction('snapshots', 'readwrite');
        const store = tx.objectStore('snapshots');
        const addRequest = store.add(snapshot);
        
        addRequest.onerror = (event) => {
          console.error('[TaskManager] 快照写入失败:', event.target.error);
          reject(new Error('快照写入失败: ' + (event.target.error?.message || '未知错误')));
        };
        
        tx.oncomplete = () => {
          console.log('[TaskManager] 快照保存成功');
          resolve();
        };
        
        tx.onerror = (event) => {
          console.error('[TaskManager] 事务失败:', event.target.error);
          reject(new Error('事务失败: ' + (event.target.error?.message || '未知错误')));
        };
      };
      
      request.onupgradeneeded = (event) => {
        console.log('[TaskManager] 创建 IndexedDB 存储...');
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
    const dbVersion = await getDBVersion();
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, dbVersion);
      
      request.onerror = (event) => {
        reject(new Error('IndexedDB 打开失败: ' + (event.target.error?.message || '未知错误')));
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('snapshots', 'readwrite');
        const store = tx.objectStore('snapshots');
        const putRequest = store.put(snapshot);
        
        putRequest.onerror = (event) => {
          reject(new Error('快照更新失败: ' + (event.target.error?.message || '未知错误')));
        };
        
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => {
          reject(new Error('事务失败: ' + (event.target.error?.message || '未知错误')));
        };
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
   * 暂停任务队列
   */
  async pauseQueue() {
    this.paused = true;
    await chrome.storage.local.set({ queuePaused: true });
    this.notifyUpdate();
  }
  
  /**
   * 继续任务队列
   */
  async resumeQueue() {
    this.paused = false;
    await chrome.storage.local.set({ queuePaused: false });
    this.notifyUpdate();
    
    // 继续处理队列
    if (this.queue.length > 0 && !this.running) {
      this.processQueue();
    }
  }
  
  /**
   * 获取队列状态
   */
  getQueueState() {
    return {
      paused: this.paused,
      running: this.running,
      queueLength: this.queue.length
    };
  }
  
  /**
   * 编辑任务 URL
   */
  async editTaskUrl(taskId, newUrl) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }
    
    // 只能编辑待处理的任务
    if (task.status !== 'pending') {
      throw new Error('只能编辑待处理的任务');
    }
    
    // 验证 URL
    try {
      const url = new URL(newUrl);
      task.url = newUrl;
      task.domain = url.hostname;
      task.title = url.pathname;
      
      await this.saveTasks();
      this.notifyUpdate();
    } catch (e) {
      throw new Error('无效的 URL');
    }
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
   * 删除任务
   */
  async deleteTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      // 从队列中移除
      const index = this.queue.indexOf(taskId);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
      
      // 从任务列表中删除
      this.tasks.delete(taskId);
      
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
  
  if (request.type === 'PAUSE_QUEUE') {
    taskManager.pauseQueue()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'RESUME_QUEUE') {
    taskManager.resumeQueue()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'GET_QUEUE_STATE') {
    sendResponse({ success: true, state: taskManager.getQueueState() });
    return true;
  }
  
  if (request.type === 'EDIT_TASK_URL') {
    taskManager.editTaskUrl(request.taskId, request.newUrl)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'DELETE_TASK') {
    taskManager.deleteTask(request.taskId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

console.log('[TaskManager] Task manager initialized');
