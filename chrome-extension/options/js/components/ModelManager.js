/**
 * AI 模型管理组件
 * 负责多模型的增删改查和UI渲染
 */
import { StorageManager } from '../utils/storage.js';
import { Notification } from '../utils/notification.js';

export class ModelManager {
  constructor() {
    this.storage = new StorageManager();
    this.models = [];
    this.currentEditingId = null;
    this.init();
  }

  async init() {
    await this.loadModels();
    this.bindEvents();
    this.render();
  }

  /**
   * 加载模型配置
   */
  async loadModels() {
    // 优先从服务端获取
    try {
      const serverUrl = await this.detectServerUrl();
      if (serverUrl) {
        const response = await fetch(`${serverUrl}/api/config`);
        if (response.ok) {
          const config = await response.json();
          if (Array.isArray(config.aiModels) && config.aiModels.length) {
            this.models = config.aiModels;
            return;
          }
        }
      }
    } catch {
      // 服务端不可用，回退到本地存储
    }

    const { aiModels } = await this.storage.getConfig(['aiModels']);
    this.models = aiModels || [];
  }

  async detectServerUrl() {
    const candidates = ['http://localhost:3100', 'http://127.0.0.1:3100'];
    for (const url of candidates) {
      try {
        const response = await fetch(`${url}/api/health`, { method: 'GET' });
        if (response.ok) return url;
      } catch {}
    }
    return null;
  }

  /**
   * 保存模型配置
   */
  async saveModels() {
    await this.storage.setConfig({ aiModels: this.models });
    // 同步到服务端
    try {
      const serverUrl = await this.detectServerUrl();
      if (serverUrl) {
        await fetch(`${serverUrl}/api/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiModels: this.models })
        });
      }
    } catch {}
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 添加模型按钮
    document.getElementById('addModelBtn')?.addEventListener('click', () => {
      this.openModal();
    });

    // 关闭按钮
    document.getElementById('closeModalBtn')?.addEventListener('click', () => {
      this.closeModal();
    });

    // 取消按钮
    document.getElementById('cancelModalBtn')?.addEventListener('click', () => {
      this.closeModal();
    });

    // 点击背景关闭
    document.getElementById('modalOverlay')?.addEventListener('click', () => {
      this.closeModal();
    });

    // 模态框相关
    document.getElementById('modalToggleKeyBtn')?.addEventListener('click', () => {
      const input = document.getElementById('modalApiKey');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('modalTemperature')?.addEventListener('input', (e) => {
      document.getElementById('modalTemperatureValue').textContent = e.target.value;
    });

    document.getElementById('saveModelBtn')?.addEventListener('click', () => {
      this.saveModel();
    });
  }

  /**
   * 渲染模型列表
   */
  render() {
    const container = document.getElementById('modelsList');
    const emptyState = document.getElementById('modelsEmpty');

    if (this.models.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = this.models.map(model => this.createModelCard(model)).join('');

    // 绑定卡片事件
    this.bindCardEvents();
  }

  /**
   * 创建模型卡片
   */
  createModelCard(model) {
    const isDefault = model.isDefault || false;
    const temperature = model.temperature ?? 0.7;
    const maxTokens = model.maxTokens ?? 4000;
    const maxInputTokens = model.maxInputTokens ?? 128000;
    return `
      <div class="model-card-item ${isDefault ? 'default' : ''}" data-id="${model.id}">
        <div class="model-card-header">
          ${isDefault ? '<span class="model-card-badge">默认</span>' : ''}
          <div class="model-card-actions">
            <button class="edit-model-btn" data-id="${model.id}" title="编辑">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.50023C18.8978 2.1024 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.1024 21.5 2.50023C21.8978 2.89805 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.1024 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="delete-model-btn" data-id="${model.id}" title="删除">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="model-card-name">${model.name || '未命名'}</div>

        <div class="model-card-info">
          <div class="model-card-info-item">
            <span class="label">模型 ID</span>
            <span class="value">${model.modelId || '-'}</span>
          </div>
          <div class="model-card-info-item">
            <span class="label">Temperature</span>
            <span class="value">${temperature}</span>
          </div>
          <div class="model-card-info-item">
            <span class="label">Max Tokens</span>
            <span class="value">${maxTokens}</span>
          </div>
          <div class="model-card-info-item">
            <span class="label">输入上限</span>
            <span class="value">${(maxInputTokens / 1000).toFixed(0)}K</span>
          </div>
        </div>

        <div class="model-card-footer">
          ${!isDefault ? `<button class="set-default-btn" data-id="${model.id}">设为默认</button>` : ''}
          ${model.baseUrl ? `<button class="test-model-btn" data-id="${model.id}">测试连接</button>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 绑定卡片事件
   */
  bindCardEvents() {
    // 编辑按钮
    document.querySelectorAll('.edit-model-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.editModel(id);
      });
    });

    // 删除按钮
    document.querySelectorAll('.delete-model-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.deleteModel(id);
      });
    });

    // 设为默认按钮
    document.querySelectorAll('.set-default-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.setDefault(id);
      });
    });

    // 测试连接按钮
    document.querySelectorAll('.test-model-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const model = this.models.find(m => m.id === id);
        if (model) {
          const btn = e.currentTarget;
          const originalText = btn.textContent;
          btn.disabled = true;
          btn.textContent = '测试中...';
          
          const result = await this.testModelConnection(model);
          
          btn.disabled = false;
          btn.textContent = originalText;
          
          if (result.success) {
            Notification.success('连接测试成功');
          } else {
            Notification.error('连接测试失败：' + result.error);
          }
        }
      });
    });
  }

  /**
   * 打开模态框
   */
  openModal(model = null) {
    this.currentEditingId = model?.id || null;
    const modal = document.getElementById('modelModal');
    const title = document.getElementById('modalTitle');

    title.textContent = model ? '编辑 AI 模型' : '添加 AI 模型';

    if (model) {
      document.getElementById('modalModelName').value = model.name;
      document.getElementById('modalApiKey').value = model.apiKey;
      document.getElementById('modalBaseUrl').value = model.baseUrl;
      document.getElementById('modalModelId').value = model.modelId;
      document.getElementById('modalTemperature').value = model.temperature;
      document.getElementById('modalTemperatureValue').textContent = model.temperature;
      document.getElementById('modalMaxTokens').value = model.maxTokens;
      document.getElementById('modalMaxInputTokens').value = model.maxInputTokens || 128000;
    } else {
      document.getElementById('modalModelName').value = '';
      document.getElementById('modalApiKey').value = '';
      document.getElementById('modalBaseUrl').value = 'https://api.openai.com/v1';
      document.getElementById('modalModelId').value = '';
      document.getElementById('modalTemperature').value = 0.7;
      document.getElementById('modalTemperatureValue').textContent = '0.7';
      document.getElementById('modalMaxTokens').value = 4000;
      document.getElementById('modalMaxInputTokens').value = 128000;
    }

    modal.style.display = 'flex';
  }

  /**
   * 关闭模态框
   */
  closeModal() {
    document.getElementById('modelModal').style.display = 'none';
    this.currentEditingId = null;
  }

  /**
   * 保存模型
   */
  async saveModel() {
    const name = document.getElementById('modalModelName').value.trim();
    const apiKey = document.getElementById('modalApiKey').value.trim();
    const baseUrl = document.getElementById('modalBaseUrl').value.trim();
    const modelId = document.getElementById('modalModelId').value.trim();
    const temperature = parseFloat(document.getElementById('modalTemperature').value);
    const maxTokens = parseInt(document.getElementById('modalMaxTokens').value);
    const maxInputTokens = parseInt(document.getElementById('modalMaxInputTokens').value) || 128000;

    // 验证
    if (!name || !apiKey || !baseUrl || !modelId) {
      Notification.error('请填写所有必填项');
      return;
    }

    // 检查名称重复
    const isDuplicate = this.models.some(m => m.name === name && m.id !== this.currentEditingId);
    if (isDuplicate) {
      Notification.error('模型名称不能重复');
      return;
    }

    const modelData = {
      id: this.currentEditingId || Date.now().toString(),
      name,
      apiKey,
      baseUrl,
      modelId,
      temperature,
      maxTokens,
      maxInputTokens,
      isDefault: this.models.length === 0 // 第一个模型自动设为默认
    };

    // 保存模型
    if (this.currentEditingId) {
      // 编辑
      const index = this.models.findIndex(m => m.id === this.currentEditingId);
      this.models[index] = { ...this.models[index], ...modelData };
    } else {
      // 新增
      this.models.push(modelData);
    }

    await this.saveModels();
    this.render();
    this.closeModal();
    
    Notification.success('模型配置已保存');
  }

  /**
   * 编辑模型
   */
  editModel(id) {
    const model = this.models.find(m => m.id === id);
    if (model) {
      this.openModal(model);
    }
  }

  /**
   * 删除模型
   */
  async deleteModel(id) {
    if (!confirm('确定要删除这个模型配置吗？')) {
      return;
    }

    this.models = this.models.filter(m => m.id !== id);

    // 如果删除的是默认模型，设置第一个为默认
    if (this.models.length > 0 && !this.models.some(m => m.isDefault)) {
      this.models[0].isDefault = true;
    }

    await this.saveModels();
    this.render();
    Notification.success('模型已删除');
  }

  /**
   * 设为默认
   */
  async setDefault(id) {
    this.models.forEach(m => {
      m.isDefault = m.id === id;
    });

    await this.saveModels();
    this.render();
    Notification.success('已设为默认模型');
  }

  /**
   * 测试模型连接
   */
  async testModelConnection(modelData) {
    try {
      // 发送简单的 chat completion 请求测试连接
      const response = await fetch(modelData.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${modelData.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelData.modelId,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5
        })
      });

      if (response.ok) {
        return { success: true };
      } else {
        const data = await response.json().catch(() => ({}));
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || '网络连接失败'
      };
    }
  }
}
