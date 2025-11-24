/**
 * 提示词模板管理器
 * 支持多个模板版本的创建、编辑、删除和切换
 */
import { StorageManager } from '../utils/storage.js';
import { Notification } from '../utils/notification.js';

export class PromptTemplateManager {
  constructor() {
    this.storage = new StorageManager();
    this.templates = [];
    this.currentTemplateId = null;
    this.init();
  }

  async init() {
    await this.loadTemplates();
    this.bindEvents();
    this.renderTemplateList();
  }

  /**
   * 加载模板列表
   */
  async loadTemplates() {
    const data = await this.storage.getConfig(['promptTemplates', 'currentTemplateId']);
    
    this.templates = data.promptTemplates || this.getDefaultTemplates();
    this.currentTemplateId = data.currentTemplateId || (this.templates[0]?.id);
    
    // 如果没有模板，创建默认模板
    if (this.templates.length === 0) {
      this.templates = this.getDefaultTemplates();
      await this.saveTemplates();
    }
  }

  /**
   * 获取默认模板
   */
  getDefaultTemplates() {
    return [
      {
        id: this.generateId(),
        name: '默认模板',
        description: '基础的设计分析模板',
        content: this.getDefaultPromptContent(),
        config: {
          includeColors: true,
          includeTypography: true,
          includeLayout: true,
          includeComponents: true,
          includeAccessibility: true,
          includeRecommendations: true,
          language: 'zh-CN'
        },
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  /**
   * 获取默认提示词内容
   */
  getDefaultPromptContent() {
    return `你是一位专业的前端设计分析师，擅长分析网页设计风格和提供专业建议。

请分析以下网页的设计风格，包括：

1. **色彩方案**：主色调、辅助色、中性色的使用和配色原理
2. **字体系统**：字体族、字号层级、行高、字重的使用规范
3. **布局设计**：栅格系统、间距规范、响应式断点
4. **组件风格**：按钮、卡片、表单等常用组件的设计特点
5. **可访问性**：对比度、可读性、WCAG 标准符合度评估
6. **改进建议**：基于最佳实践的设计优化建议

请以 Markdown 格式输出分析报告，结构清晰，内容专业。

---

网页 HTML 和 CSS 数据将在实际调用时附加在此提示词之后。`;
  }

  /**
   * 保存模板列表
   */
  async saveTemplates() {
    await this.storage.setConfig({
      promptTemplates: this.templates,
      currentTemplateId: this.currentTemplateId
    });
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 新建模板按钮
    document.getElementById('addTemplateBtn')?.addEventListener('click', () => {
      this.showTemplateModal();
    });

    // 模板模态框关闭
    document.getElementById('closeTemplateModalBtn')?.addEventListener('click', () => {
      this.hideTemplateModal();
    });

    document.getElementById('templateModalOverlay')?.addEventListener('click', () => {
      this.hideTemplateModal();
    });

    document.getElementById('cancelTemplateModalBtn')?.addEventListener('click', () => {
      this.hideTemplateModal();
    });

    // 保存模板
    document.getElementById('saveTemplateBtn')?.addEventListener('click', () => {
      this.saveTemplate();
    });
  }

  /**
   * 渲染模板列表
   */
  renderTemplateList() {
    const container = document.getElementById('templatesList');
    if (!container) return;

    if (this.templates.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>暂无模板</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.templates.map(template => {
      const isActive = template.id === this.currentTemplateId;
      return `
        <div class="template-card ${isActive ? 'active' : ''}" data-template-id="${template.id}">
          <div class="template-header">
            <div class="template-info">
              <div class="template-name">${this.escapeHtml(template.name)}</div>
              ${template.description ? `<div class="template-desc">${this.escapeHtml(template.description)}</div>` : ''}
            </div>
            ${isActive ? '<span class="template-badge">当前使用</span>' : ''}
          </div>
          <div class="template-meta">
            <span>更新: ${new Date(template.updatedAt).toLocaleDateString('zh-CN')}</span>
            ${template.isBuiltIn ? '<span class="built-in-badge">内置</span>' : ''}
          </div>
          <div class="template-actions">
            ${!isActive ? `<button class="btn-secondary btn-sm" data-action="use" data-template-id="${template.id}">使用</button>` : ''}
            <button class="btn-secondary btn-sm" data-action="edit" data-template-id="${template.id}">编辑</button>
            <button class="btn-secondary btn-sm" data-action="duplicate" data-template-id="${template.id}">复制</button>
            ${!template.isBuiltIn ? `<button class="btn-danger btn-sm" data-action="delete" data-template-id="${template.id}">删除</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    this.bindTemplateCardEvents();
  }

  /**
   * 绑定模板卡片事件
   */
  bindTemplateCardEvents() {
    document.querySelectorAll('.template-card [data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.currentTarget.dataset.action;
        const templateId = e.currentTarget.dataset.templateId;
        this.handleTemplateAction(action, templateId);
      });
    });
  }

  /**
   * 处理模板操作
   */
  async handleTemplateAction(action, templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    switch (action) {
      case 'use':
        await this.useTemplate(templateId);
        break;
      case 'edit':
        this.editTemplate(templateId);
        break;
      case 'duplicate':
        await this.duplicateTemplate(templateId);
        break;
      case 'delete':
        await this.deleteTemplate(templateId);
        break;
    }
  }

  /**
   * 使用模板
   */
  async useTemplate(templateId) {
    this.currentTemplateId = templateId;
    await this.saveTemplates();
    this.renderTemplateList();
    
    // 触发提示词更新事件
    window.dispatchEvent(new CustomEvent('templateChanged', { 
      detail: { templateId } 
    }));
    
    Notification.success('已切换到该模板');
  }

  /**
   * 编辑模板
   */
  editTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    this.showTemplateModal(template);
  }

  /**
   * 复制模板
   */
  async duplicateTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    const newTemplate = {
      ...template,
      id: this.generateId(),
      name: `${template.name} (副本)`,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.push(newTemplate);
    await this.saveTemplates();
    this.renderTemplateList();
    Notification.success('模板已复制');
  }

  /**
   * 删除模板
   */
  async deleteTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    if (template.isBuiltIn) {
      Notification.error('内置模板不能删除');
      return;
    }

    if (!confirm(`确定要删除模板"${template.name}"吗？`)) {
      return;
    }

    // 如果删除的是当前模板，切换到第一个模板
    if (this.currentTemplateId === templateId) {
      this.currentTemplateId = this.templates.find(t => t.id !== templateId)?.id;
    }

    this.templates = this.templates.filter(t => t.id !== templateId);
    await this.saveTemplates();
    this.renderTemplateList();
    
    window.dispatchEvent(new CustomEvent('templateChanged', { 
      detail: { templateId: this.currentTemplateId } 
    }));
    
    Notification.success('模板已删除');
  }

  /**
   * 显示模板编辑模态框
   */
  showTemplateModal(template = null) {
    const modal = document.getElementById('templateModal');
    if (!modal) return;

    const isEdit = !!template;
    
    // 设置标题
    document.getElementById('templateModalTitle').textContent = isEdit ? '编辑模板' : '新建模板';
    
    // 填充表单
    if (isEdit) {
      document.getElementById('editTemplateId').value = template.id;
      document.getElementById('templateName').value = template.name;
      document.getElementById('templateDescription').value = template.description || '';
      document.getElementById('templateContent').value = template.content;
    } else {
      document.getElementById('editTemplateId').value = '';
      document.getElementById('templateName').value = '';
      document.getElementById('templateDescription').value = '';
      document.getElementById('templateContent').value = this.getDefaultPromptContent();
    }

    modal.style.display = 'flex';
  }

  /**
   * 隐藏模板编辑模态框
   */
  hideTemplateModal() {
    const modal = document.getElementById('templateModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * 保存模板
   */
  async saveTemplate() {
    const templateId = document.getElementById('editTemplateId').value;
    const name = document.getElementById('templateName').value.trim();
    const description = document.getElementById('templateDescription').value.trim();
    const content = document.getElementById('templateContent').value.trim();

    // 验证
    if (!name) {
      Notification.error('请输入模板名称');
      return;
    }

    if (!content) {
      Notification.error('请输入提示词内容');
      return;
    }

    const now = new Date().toISOString();

    if (templateId) {
      // 编辑现有模板
      const template = this.templates.find(t => t.id === templateId);
      if (template) {
        template.name = name;
        template.description = description;
        template.content = content;
        template.updatedAt = now;
      }
    } else {
      // 创建新模板
      const newTemplate = {
        id: this.generateId(),
        name,
        description,
        content,
        config: this.getCurrentConfig(),
        isBuiltIn: false,
        createdAt: now,
        updatedAt: now
      };
      this.templates.push(newTemplate);
      this.currentTemplateId = newTemplate.id;
    }

    await this.saveTemplates();
    this.renderTemplateList();
    this.hideTemplateModal();
    
    window.dispatchEvent(new CustomEvent('templateChanged', { 
      detail: { templateId: this.currentTemplateId } 
    }));
    
    Notification.success(templateId ? '模板已更新' : '模板已创建');
  }

  /**
   * 获取当前模板
   */
  getCurrentTemplate() {
    return this.templates.find(t => t.id === this.currentTemplateId);
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig() {
    return {
      includeColors: document.getElementById('includeColors')?.checked ?? true,
      includeTypography: document.getElementById('includeTypography')?.checked ?? true,
      includeLayout: document.getElementById('includeLayout')?.checked ?? true,
      includeComponents: document.getElementById('includeComponents')?.checked ?? true,
      includeAccessibility: document.getElementById('includeAccessibility')?.checked ?? true,
      includeRecommendations: document.getElementById('includeRecommendations')?.checked ?? true,
      language: document.getElementById('language')?.value ?? 'zh-CN'
    };
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 转义 HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
