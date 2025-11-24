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

console.log('[StyleGenerator] Background service worker loaded');
