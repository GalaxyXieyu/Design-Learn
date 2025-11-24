/**
 * Storage 管理工具
 * 统一管理 Chrome Storage 和 IndexedDB
 */
export class StorageManager {
  constructor() {
    this.dbName = 'StyleGenerator';
    this.dbVersion = 1;
  }

  /**
   * Chrome Storage - 获取配置
   */
  async getConfig(keys) {
    return await chrome.storage.local.get(keys);
  }

  /**
   * Chrome Storage - 保存配置
   */
  async setConfig(data) {
    return await chrome.storage.local.set(data);
  }

  /**
   * Chrome Storage - 清除所有配置
   */
  async clearConfig() {
    return await chrome.storage.local.clear();
  }

  /**
   * Chrome Storage - 删除指定键
   */
  async removeKeys(keys) {
    if (!Array.isArray(keys)) return;
    return await chrome.storage.local.remove(keys);
  }

  /**
   * IndexedDB - 打开数据库
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
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
   * IndexedDB - 获取所有快照
   */
  async getAllSnapshots() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readonly');
      const store = tx.objectStore('snapshots');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * IndexedDB - 获取快照数量
   */
  async getSnapshotCount() {
    const db = await this.openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('snapshots', 'readonly');
        const store = tx.objectStore('snapshots');
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }

  /**
   * IndexedDB - 清除所有快照
   */
  async clearSnapshots() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      const store = tx.objectStore('snapshots');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 计算存储大小
   */
  async calculateStorageSize() {
    const config = await chrome.storage.local.get(null);
    const json = JSON.stringify(config);
    return new Blob([json]).size;
  }
}
