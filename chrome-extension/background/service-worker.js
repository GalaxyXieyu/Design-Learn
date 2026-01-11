/**
 * Background Service Worker
 * 处理后台任务和消息转发
 */

// 导入任务管理器和 AI 分析器
importScripts('task-manager.js');
importScripts('../lib/ai-analyzer.js');

// 安装事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[StyleGenerator] Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // 首次安装，显示欢迎页面
    chrome.tabs.create({
      url: 'https://github.com/GalaxyXieyu/frontend-style-generator'
    });
  }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('[StyleGenerator] Tab loaded:', tab.url);
  }
});

// 使用 chrome.alarms 保持 Service Worker 活跃（任务运行时）
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // 检查是否有运行中的任务
    if (typeof taskManager !== 'undefined' && taskManager.running) {
      console.log('[StyleGenerator] Keep-alive ping (task running)');
    } else {
      // 没有任务运行，停止保活
      chrome.alarms.clear('keepAlive');
    }
  }
});

// 在任务开始时启动保活
function startKeepAlive() {
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 }); // 每 24 秒 ping 一次
}

// 导出给 task-manager 使用
self.startKeepAlive = startKeepAlive;

console.log('[StyleGenerator] Background service worker loaded');
