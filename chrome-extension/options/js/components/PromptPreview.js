/**
 * AI 提示词预览组件
 * 根据配置生成和显示提示词，支持模板编辑
 */
import { StorageManager } from '../utils/storage.js';
import { Notification } from '../utils/notification.js';

export class PromptPreview {
  constructor(templateManager) {
    this.storage = new StorageManager();
    this.templateManager = templateManager;
    this.config = {};
    this.isEditing = false;
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.bindEvents();
    this.generatePrompt();
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    const { generateConfig } = await this.storage.getConfig(['generateConfig']);
    this.config = generateConfig || {
      includeColors: true,
      includeTypography: true,
      includeLayout: true,
      includeComponents: true,
      includeAccessibility: true,
      includeRecommendations: true,
      language: 'zh-CN',
      autoGenerate: true // 默认自动生成
    };
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 刷新按钮
    document.getElementById('refreshPromptBtn')?.addEventListener('click', () => {
      this.refreshPrompt();
    });

    // 编辑按钮
    document.getElementById('editPromptBtn')?.addEventListener('click', () => {
      this.toggleEdit();
    });

    // 保存编辑按钮
    document.getElementById('savePromptEditBtn')?.addEventListener('click', () => {
      this.savePromptEdit();
    });

    // 取消编辑按钮
    document.getElementById('cancelPromptEditBtn')?.addEventListener('click', () => {
      this.cancelEdit();
    });

    // 另存为模板按钮
    document.getElementById('saveAsTemplateBtn')?.addEventListener('click', () => {
      this.saveAsTemplate();
    });

    // 监听所有复选框变化
    const checkboxes = [
      'includeColors',
      'includeTypography',
      'includeLayout',
      'includeComponents',
      'includeAccessibility',
      'includeRecommendations'
    ];

    checkboxes.forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        if (!this.isEditing) {
          this.generatePrompt();
        }
      });
    });

    // 监听语言选择变化
    document.getElementById('language')?.addEventListener('change', () => {
      if (!this.isEditing) {
        this.generatePrompt();
      }
    });

    // 监听模板切换事件
    window.addEventListener('templateChanged', () => {
      this.generatePrompt();
    });
  }

  /**
   * 刷新提示词
   */
  async refreshPrompt() {
    await this.loadConfig();
    this.generatePrompt();
  }

  /**
   * 切换编辑模式
   */
  toggleEdit() {
    this.isEditing = !this.isEditing;
    const previewContainer = document.getElementById('promptPreview');
    const editContainer = document.getElementById('promptEdit');
    const normalActions = document.getElementById('promptNormalActions');
    const editActions = document.getElementById('promptEditActions');

    if (this.isEditing) {
      // 进入编辑模式
      const currentContent = document.getElementById('promptContent')?.textContent || '';
      document.getElementById('promptEditArea').value = currentContent;
      
      previewContainer.style.display = 'none';
      editContainer.style.display = 'block';
      normalActions.style.display = 'none';
      editActions.style.display = 'flex';
    } else {
      // 退出编辑模式
      previewContainer.style.display = 'block';
      editContainer.style.display = 'none';
      normalActions.style.display = 'flex';
      editActions.style.display = 'none';
    }
  }

  /**
   * 保存编辑
   */
  async savePromptEdit() {
    const editedContent = document.getElementById('promptEditArea')?.value.trim();
    
    if (!editedContent) {
      Notification.error('提示词内容不能为空');
      return;
    }

    // 更新当前模板
    if (this.templateManager) {
      const currentTemplate = this.templateManager.getCurrentTemplate();
      if (currentTemplate) {
        currentTemplate.content = editedContent;
        currentTemplate.updatedAt = new Date().toISOString();
        await this.templateManager.saveTemplates();
        Notification.success('提示词已更新');
      }
    }

    this.displayPrompt(editedContent);
    this.toggleEdit();
  }

  /**
   * 取消编辑
   */
  cancelEdit() {
    this.toggleEdit();
  }

  /**
   * 另存为新模板
   */
  saveAsTemplate() {
    const editedContent = document.getElementById('promptEditArea')?.value.trim();
    
    if (!editedContent) {
      Notification.error('提示词内容不能为空');
      return;
    }

    // 填充内容并显示新建模板对话框
    if (this.templateManager) {
      this.templateManager.showTemplateModal();
      setTimeout(() => {
        document.getElementById('templateContent').value = editedContent;
      }, 100);
    }
  }

  /**
   * 生成提示词
   */
  generatePrompt() {
    // 优先使用当前模板的内容
    if (this.templateManager) {
      const currentTemplate = this.templateManager.getCurrentTemplate();
      if (currentTemplate) {
        this.displayPrompt(currentTemplate.content);
        return;
      }
    }

    // 如果没有模板，使用配置生成
    const config = this.getCurrentConfig();
    const prompt = this.buildPrompt(config);
    this.displayPrompt(prompt);
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
   * 构建提示词
   */
  buildPrompt(config) {
    const sections = [];

    // 系统角色
    sections.push(config.language === 'zh-CN' 
      ? '你是一位专业的前端设计分析师，擅长分析网页设计风格和提供专业建议。'
      : 'You are a professional frontend design analyst, skilled at analyzing web design styles and providing expert recommendations.'
    );

    sections.push('');
    sections.push(config.language === 'zh-CN' ? '请分析以下网页的设计风格，包括：' : 'Please analyze the design style of the following webpage, including:');
    sections.push('');

    // 分析内容
    const analysisItems = [];
    
    if (config.includeColors) {
      analysisItems.push(config.language === 'zh-CN' 
        ? '1. **色彩方案**：主色调、辅助色、中性色的使用和配色原理'
        : '1. **Color Scheme**: Primary colors, secondary colors, neutral colors usage and color theory'
      );
    }

    if (config.includeTypography) {
      analysisItems.push(config.language === 'zh-CN'
        ? '2. **字体系统**：字体族、字号层级、行高、字重的使用规范'
        : '2. **Typography System**: Font families, size hierarchy, line height, font weight standards'
      );
    }

    if (config.includeLayout) {
      analysisItems.push(config.language === 'zh-CN'
        ? '3. **布局设计**：栅格系统、间距规范、响应式断点'
        : '3. **Layout Design**: Grid system, spacing standards, responsive breakpoints'
      );
    }

    if (config.includeComponents) {
      analysisItems.push(config.language === 'zh-CN'
        ? '4. **组件风格**：按钮、卡片、表单等常用组件的设计特点'
        : '4. **Component Styles**: Design characteristics of buttons, cards, forms and other common components'
      );
    }

    if (config.includeAccessibility) {
      analysisItems.push(config.language === 'zh-CN'
        ? '5. **可访问性**：对比度、可读性、WCAG 标准符合度评估'
        : '5. **Accessibility**: Contrast, readability, WCAG standards compliance assessment'
      );
    }

    if (config.includeRecommendations) {
      analysisItems.push(config.language === 'zh-CN'
        ? '6. **改进建议**：基于最佳实践的设计优化建议'
        : '6. **Recommendations**: Design optimization suggestions based on best practices'
      );
    }

    sections.push(...analysisItems);
    sections.push('');

    // 输出格式要求
    sections.push(config.language === 'zh-CN' 
      ? '请以 Markdown 格式输出分析报告，结构清晰，内容专业。'
      : 'Please output the analysis report in Markdown format with clear structure and professional content.'
    );

    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push(config.language === 'zh-CN' 
      ? '网页 HTML 和 CSS 数据将在实际调用时附加在此提示词之后。'
      : 'Webpage HTML and CSS data will be appended after this prompt during actual API calls.'
    );

    return sections.join('\n');
  }

  /**
   * 显示提示词
   */
  displayPrompt(prompt) {
    const container = document.getElementById('promptContent');
    if (container) {
      container.textContent = prompt;
    }
  }
}
