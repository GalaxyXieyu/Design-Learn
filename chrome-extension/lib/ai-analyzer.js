/**
 * AI 风格分析器
 * 调用 AI API 分析页面设计风格
 */
class AIAnalyzer {
  constructor() {
    this.config = null;
    // 默认的最大输入 token 限制（如果模型未配置）
    this.DEFAULT_MAX_INPUT_TOKENS = 128000;
    // 留给输出的安全边界（token）
    this.OUTPUT_TOKEN_RESERVE = 8000;
    // 留给 system prompt 的安全边界（token）
    this.SYSTEM_PROMPT_RESERVE = 3000;
  }

  /**
   * 估算文本的 token 数量
   * 使用简化的估算方法：英文约 4 字符/token，中文约 1.5 字符/token
   */
  estimateTokens(text) {
    if (!text) return 0;
    
    // 统计中文字符数
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    // 非中文字符数
    const otherChars = text.length - chineseChars;
    
    // 中文约 1.5 字符/token，英文/代码约 4 字符/token
    const tokens = Math.ceil(chineseChars / 1.5) + Math.ceil(otherChars / 4);
    return tokens;
  }
  
  /**
   * 加载配置
   */
  async loadConfig() {
    let aiModels = [];

    // 优先从服务端获取模型配置
    try {
      const serverUrl = await this.detectServerUrl();
      if (serverUrl) {
        const response = await fetch(`${serverUrl}/api/config`);
        if (response.ok) {
          const config = await response.json();
          if (Array.isArray(config.aiModels) && config.aiModels.length) {
            aiModels = config.aiModels;
          }
        }
      }
    } catch {}

    // 回退到本地存储
    if (!aiModels.length) {
      const result = await chrome.storage.local.get(['aiModels', 'sg_aiModels']);
      aiModels = result.sg_aiModels || result.aiModels || [];
    }

    // 加载其他本地配置
    const result = await chrome.storage.local.get([
      'generateConfig', 'sg_generateConfig',
      'promptTemplates', 'sg_promptTemplates',
      'currentTemplateId', 'sg_currentTemplateId'
    ]);

    console.log('[AIAnalyzer] 找到的 AI 模型列表:', aiModels.length, '个');

    const defaultModel = aiModels.find(m => m.isDefault) || aiModels[0] || null;
    console.log('[AIAnalyzer] 默认模型:', defaultModel ? `${defaultModel.name} (${defaultModel.modelId})` : '未配置');

    // 加载提示词模板
    const templates = result.sg_promptTemplates || result.promptTemplates || [];
    const currentTemplateId = result.sg_currentTemplateId || result.currentTemplateId;
    const currentTemplate = templates.find(t => t.id === currentTemplateId) || templates[0] || null;
    console.log('[AIAnalyzer] 当前模板:', currentTemplate ? currentTemplate.name : '使用默认');

    this.config = {
      ai: defaultModel || {},
      generate: result.sg_generateConfig || result.generateConfig || {},
      template: currentTemplate
    };

    // 检查关键配置
    if (!this.config.ai.apiKey) {
      console.error('[AIAnalyzer] 警告: apiKey 未配置');
    }
    if (!this.config.ai.baseUrl) {
      console.error('[AIAnalyzer] 警告: baseUrl 未配置');
    }
    if (!this.config.ai.modelId) {
      console.error('[AIAnalyzer] 警告: modelId 未配置');
    }

    return this.config;
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
   * 分析快照
   */
  async analyze(snapshot) {
    await this.loadConfig();

    if (!this.config.ai.apiKey) {
      throw new Error('请先在设置中配置 AI API Key');
    }

    // 构建 System Prompt（来自用户模板）和 User Prompt（来自勾选项）
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(snapshot);

    // 调用 AI
    const response = await this.callAI(systemPrompt, userPrompt);

    // 直接使用 AI 返回的 Markdown 作为报告
    const markdown = this.wrapMarkdownReport(snapshot, response);
    
    return { analysis: { raw: true, content: response }, markdown, format: 'markdown' };
  }

  /**
   * 包装 Markdown 报告（添加头部信息）
   */
  wrapMarkdownReport(snapshot, content) {
    const lines = [];
    lines.push(`# ${snapshot.title} - 设计风格分析报告`);
    lines.push('');
    lines.push(`> **分析时间**: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`> **页面 URL**: ${snapshot.url}`);
    lines.push(`> **采集时间**: ${new Date(snapshot.extractedAt).toLocaleString('zh-CN')}`);
    lines.push(`> **视口尺寸**: ${snapshot.metadata.viewport.width} x ${snapshot.metadata.viewport.height}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(content);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`*本报告由 Frontend Style Generator AI 自动生成*`);
    lines.push(`*使用模板: ${this.config.template?.name || '默认模板'}*`);
    lines.push(`*生成时间: ${new Date().toLocaleString('zh-CN')}*`);
    return lines.join('\n');
  }

  /**
   * 批量分析多个快照
   * 会自动计算 token 并调整页数以避免超限
   */
  async analyzeBatch(snapshots) {
    await this.loadConfig();

    if (!this.config.ai.apiKey) {
      throw new Error('请先在设置中配置 AI API Key');
    }

    const systemPrompt = this.getSystemPrompt();
    
    // 获取模型的最大输入 token 限制
    const maxInputTokens = this.config.ai.maxInputTokens || this.DEFAULT_MAX_INPUT_TOKENS;
    
    // 计算可用于页面数据的 token 预算
    const systemPromptTokens = this.estimateTokens(systemPrompt);
    const availableTokens = maxInputTokens - this.OUTPUT_TOKEN_RESERVE - this.SYSTEM_PROMPT_RESERVE - systemPromptTokens;
    
    console.log(`[AIAnalyzer] 模型最大输入: ${maxInputTokens}, 可用于页面数据: ${availableTokens}`);
    
    // 动态计算每个页面的分配和实际使用的页面数
    const { selectedSnapshots, htmlLimit, cssLimit } = this.calculateBatchLimits(snapshots, availableTokens);
    
    if (selectedSnapshots.length < snapshots.length) {
      console.log(`[AIAnalyzer] 由于 token 限制，从 ${snapshots.length} 个页面减少到 ${selectedSnapshots.length} 个`);
    }
    console.log(`[AIAnalyzer] 每页 HTML 截断: ${htmlLimit} 字符, CSS 截断: ${cssLimit} 字符`);
    
    const userPrompt = this.buildBatchPrompt(selectedSnapshots, htmlLimit, cssLimit);
    
    // 验证最终 token 数
    const totalTokens = systemPromptTokens + this.estimateTokens(userPrompt);
    console.log(`[AIAnalyzer] 估算总输入 token: ${totalTokens}`);
    
    const response = await this.callAI(systemPrompt, userPrompt);
    
    // 直接使用 AI 返回的 Markdown
    const markdown = this.wrapBatchMarkdownReport(selectedSnapshots, response, snapshots.length !== selectedSnapshots.length ? snapshots.length : null);
    return { 
      analysis: { raw: true, content: response }, 
      markdown, 
      format: 'markdown',
      stats: {
        originalCount: snapshots.length,
        analyzedCount: selectedSnapshots.length,
        htmlLimit,
        cssLimit,
        estimatedTokens: totalTokens
      }
    };
  }

  /**
   * 计算批量分析的限制参数
   * 根据可用 token 动态调整页面数量和每页的内容截断长度
   */
  calculateBatchLimits(snapshots, availableTokens) {
    // 每个页面的固定开销（标题、URL、标记等）约 200 token
    const FIXED_OVERHEAD_PER_PAGE = 200;
    // 批量分析的固定开销（分析要求、输出格式等）约 1000 token
    const BATCH_FIXED_OVERHEAD = 1000;
    
    // 默认的 HTML/CSS 截断长度
    const DEFAULT_HTML_LIMIT = 5000;
    const DEFAULT_CSS_LIMIT = 8000;
    // 最小截断长度（保证有意义的内容）
    const MIN_HTML_LIMIT = 1500;
    const MIN_CSS_LIMIT = 2000;
    
    let selectedSnapshots = [...snapshots];
    let htmlLimit = DEFAULT_HTML_LIMIT;
    let cssLimit = DEFAULT_CSS_LIMIT;
    
    // 计算当前配置下的估算 token
    const estimateConfigTokens = (count, html, css) => {
      const perPageTokens = FIXED_OVERHEAD_PER_PAGE + this.estimateTokens('x'.repeat(html)) + this.estimateTokens('x'.repeat(css));
      return BATCH_FIXED_OVERHEAD + count * perPageTokens;
    };
    
    // 策略 1: 尝试使用默认截断长度
    let estimatedTokens = estimateConfigTokens(selectedSnapshots.length, htmlLimit, cssLimit);
    
    if (estimatedTokens <= availableTokens) {
      // 默认配置已经满足，直接返回
      return { selectedSnapshots, htmlLimit, cssLimit };
    }
    
    // 策略 2: 先尝试减少每页的内容长度
    while (estimatedTokens > availableTokens && (htmlLimit > MIN_HTML_LIMIT || cssLimit > MIN_CSS_LIMIT)) {
      // 按比例减少
      htmlLimit = Math.max(MIN_HTML_LIMIT, Math.floor(htmlLimit * 0.8));
      cssLimit = Math.max(MIN_CSS_LIMIT, Math.floor(cssLimit * 0.8));
      estimatedTokens = estimateConfigTokens(selectedSnapshots.length, htmlLimit, cssLimit);
    }
    
    // 策略 3: 如果还是超限，减少页面数量
    while (estimatedTokens > availableTokens && selectedSnapshots.length > 1) {
      selectedSnapshots = selectedSnapshots.slice(0, selectedSnapshots.length - 1);
      estimatedTokens = estimateConfigTokens(selectedSnapshots.length, htmlLimit, cssLimit);
    }
    
    // 策略 4: 如果只剩一个页面还是超限，继续减少内容长度
    while (estimatedTokens > availableTokens && (htmlLimit > 500 || cssLimit > 500)) {
      htmlLimit = Math.max(500, Math.floor(htmlLimit * 0.7));
      cssLimit = Math.max(500, Math.floor(cssLimit * 0.7));
      estimatedTokens = estimateConfigTokens(selectedSnapshots.length, htmlLimit, cssLimit);
    }
    
    return { selectedSnapshots, htmlLimit, cssLimit };
  }

  /**
   * 包装批量分析 Markdown 报告
   * @param {Array} snapshots - 实际分析的快照
   * @param {string} content - AI 返回的内容
   * @param {number|null} originalCount - 原始页面数量（如果有减少）
   */
  wrapBatchMarkdownReport(snapshots, content, originalCount = null) {
    const lines = [];
    lines.push(`# 批量设计风格分析报告`);
    lines.push('');
    lines.push(`> **分析时间**: ${new Date().toLocaleString('zh-CN')}`);
    if (originalCount && originalCount > snapshots.length) {
      lines.push(`> **页面数量**: ${snapshots.length}（原始 ${originalCount} 个，因 token 限制自动调整）`);
    } else {
      lines.push(`> **页面数量**: ${snapshots.length}`);
    }
    lines.push('');
    lines.push('## 分析页面列表');
    lines.push('');
    snapshots.forEach((s, i) => {
      lines.push(`${i + 1}. [${s.title}](${s.url})`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(content);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`*本报告由 Frontend Style Generator AI 自动生成*`);
    lines.push(`*使用模板: ${this.config.template?.name || '默认模板'}*`);
    lines.push(`*生成时间: ${new Date().toLocaleString('zh-CN')}*`);
    return lines.join('\n');
  }
  
  /**
   * 获取 System Prompt（来自用户模板）
   */
  getSystemPrompt() {
    // 优先使用用户模板
    if (this.config.template && this.config.template.content) {
      return this.config.template.content;
    }
    
    // 默认 system prompt
    const lang = this.config.generate.language || 'zh-CN';
    const preferZh = lang === 'zh-CN';
    
    if (preferZh) {
      return `你是一位资深的前端设计系统专家，擅长从网页源码中提取设计规范并输出专业的设计系统文档。

## 你的任务
分析提供的网页 HTML 和 CSS，输出一份详尽的设计风格指南（STYLEGUIDE.md），帮助开发者理解和复用该网站的设计系统。

## 输出要求

### 1. 格式规范
- 使用清晰的 Markdown 格式，包含多级标题
- 每个章节都要有**自然语言描述**解释设计意图和使用场景
- 提供**具体的代码示例**（Tailwind 类名、CSS 代码、组件代码片段）
- 使用表格整理设计令牌（如颜色、字号、间距等）

### 2. 内容深度
- **设计令牌**：提取具体的色值（如 #0076ff）、字体族、阴影值等，不要只写占位符
- **组件风格**：为每个组件提供完整的 TSX/JSX 示例代码，包含样式类名
- **使用建议**：说明何时使用、如何组合、注意事项
- **明暗主题**：如果页面支持，分别说明 light/dark 模式的样式差异

### 3. 示例代码要求
- 组件代码使用 React + Tailwind CSS 风格
- 代码要完整可运行，包含必要的 import
- 使用 \`\`\`tsx 代码块标注语言

### 4. 专业性
- 参考 Aceternity UI、Shadcn UI 等专业设计系统的文档风格
- 使用设计系统术语（Design Tokens、Semantic Colors、Typography Scale 等）
- 提供 Do & Don't 最佳实践建议

## 输出结构参考
1. 概览（设计语言、技术栈、主题机制）
2. 设计令牌（颜色、字体、阴影、动效变量）
3. 配色系统（文本色、背景色、边框色、品牌色）
4. 排版系统（字体栈、标题层级、正文样式）
5. 间距系统（容器、栅格、常用间距原子）
6. 组件风格（导航、按钮、卡片、表单等，每个都要有示例代码）
7. 阴影与层次
8. 动效与过渡
9. 圆角规范
10. 无障碍建议
11. 常用 Tailwind 模式
12. 示例代码（2-3个完整组件示例）
13. 约定与最佳实践（Do & Don't）

请确保输出内容详尽、专业、可直接用于团队开发参考。`;
    } else {
      return `You are a senior frontend design system expert, skilled at extracting design specifications from web source code and producing professional design system documentation.

## Your Task
Analyze the provided HTML and CSS, and output a comprehensive STYLEGUIDE.md that helps developers understand and reuse the website's design system.

## Output Requirements

### 1. Format Standards
- Use clear Markdown format with multi-level headings
- Each section should have **natural language descriptions** explaining design intent and use cases
- Provide **specific code examples** (Tailwind classes, CSS code, component snippets)
- Use tables to organize design tokens (colors, font sizes, spacing, etc.)

### 2. Content Depth
- **Design Tokens**: Extract specific values (e.g., #0076ff), font families, shadow values - no placeholders
- **Component Styles**: Provide complete TSX/JSX example code for each component with style classes
- **Usage Guidelines**: Explain when to use, how to combine, and important notes
- **Light/Dark Themes**: If supported, describe style differences for both modes

### 3. Code Example Requirements
- Use React + Tailwind CSS style for component code
- Code should be complete and runnable, including necessary imports
- Use \`\`\`tsx code blocks with language annotation

### 4. Professionalism
- Reference documentation style from Aceternity UI, Shadcn UI, and other professional design systems
- Use design system terminology (Design Tokens, Semantic Colors, Typography Scale, etc.)
- Provide Do & Don't best practice recommendations

## Output Structure Reference
1. Overview (design language, tech stack, theme mechanism)
2. Design Tokens (colors, fonts, shadows, motion variables)
3. Color System (text, background, border, brand colors)
4. Typography System (font stack, heading hierarchy, body styles)
5. Spacing System (container, grid, common spacing atoms)
6. Component Styles (navbar, button, card, form, etc. - each with example code)
7. Shadows & Elevation
8. Animations & Transitions
9. Border Radius
10. Accessibility Guidelines
11. Common Tailwind Patterns
12. Example Code (2-3 complete component examples)
13. Conventions & Best Practices (Do & Don't)

Ensure the output is comprehensive, professional, and directly usable as a team development reference.`;
    }
  }

  /**
   * 构建 User Prompt（基于勾选项动态生成）
   */
  buildUserPrompt(snapshot) {
    const sections = [];
    const vp = `${snapshot.metadata.viewport.width}x${snapshot.metadata.viewport.height}`;
    const lang = this.config.generate.language || 'zh-CN';
    const preferZh = lang === 'zh-CN';
    const gen = this.config.generate || {};
    
    // 页面信息
    sections.push(preferZh 
      ? `## 页面信息\n- 标题: ${snapshot.title}\n- URL: ${snapshot.url}\n- 视口: ${vp}`
      : `## Page Info\n- Title: ${snapshot.title}\n- URL: ${snapshot.url}\n- Viewport: ${vp}`);
    sections.push('');
    
    // 根据勾选项构建分析要求
    sections.push(preferZh ? '## 请分析以下内容：' : '## Please analyze the following:');
    sections.push('');
    
    const analysisItems = [];
    
    if (gen.includeColors !== false) {
      analysisItems.push(preferZh 
        ? '### 1. 配色系统\n- 主色调、辅助色、中性色\n- 明暗主题的颜色映射\n- 品牌色使用规范\n- 具体色值和 Tailwind 类名'
        : '### 1. Color System\n- Primary, secondary, neutral colors\n- Light/dark theme color mapping\n- Brand color usage\n- Specific color values and Tailwind classes');
    }
    
    if (gen.includeTypography !== false) {
      analysisItems.push(preferZh
        ? '### 2. 字体系统\n- 字体族（主字体、等宽字体）\n- 标题层级（页标题、分节标题、副标题）\n- 正文样式（字号、行高、字重）\n- 具体的 font-family 和 Tailwind 类名'
        : '### 2. Typography\n- Font families (primary, mono)\n- Heading hierarchy (page, section, sub)\n- Body styles (size, line-height, weight)\n- Specific font-family and Tailwind classes');
    }
    
    if (gen.includeLayout !== false) {
      analysisItems.push(preferZh
        ? '### 3. 布局与间距\n- 容器宽度和内边距\n- 栅格系统（列数、间距）\n- 垂直间距规范\n- 响应式断点'
        : '### 3. Layout & Spacing\n- Container width and padding\n- Grid system (columns, gaps)\n- Vertical spacing\n- Responsive breakpoints');
    }
    
    if (gen.includeComponents !== false) {
      analysisItems.push(preferZh
        ? '### 4. 组件风格\n- 导航栏样式\n- 按钮样式（主要、次要、品牌）\n- 卡片样式\n- 表单输入框\n- 徽章/标签\n- 每个组件请提供示例代码片段'
        : '### 4. Component Styles\n- Navbar styles\n- Button styles (primary, secondary, brand)\n- Card styles\n- Form inputs\n- Badges/tags\n- Provide example code snippets for each');
    }
    
    if (gen.includeAccessibility !== false) {
      analysisItems.push(preferZh
        ? '### 5. 无障碍与对比度\n- 文本与背景对比度\n- 焦点状态样式\n- WCAG 标准符合度'
        : '### 5. Accessibility\n- Text/background contrast\n- Focus state styles\n- WCAG compliance');
    }
    
    if (gen.includeRecommendations !== false) {
      analysisItems.push(preferZh
        ? '### 6. 改进建议\n- 设计一致性建议\n- 最佳实践推荐\n- 潜在问题和优化方向'
        : '### 6. Recommendations\n- Design consistency suggestions\n- Best practice recommendations\n- Potential issues and optimization');
    }
    
    // 额外分析项：阴影、动效、圆角、透明度
    analysisItems.push(preferZh
      ? '### 7. 其他设计令牌\n- 阴影与层次\n- 动效与过渡\n- 圆角规范\n- 透明度与磨砂效果'
      : '### 7. Other Design Tokens\n- Shadows & elevation\n- Animations & transitions\n- Border radius\n- Opacity & blur effects');
    
    sections.push(analysisItems.join('\n\n'));
    sections.push('');
    
    // 输出格式要求
    sections.push(preferZh 
      ? '## 输出格式要求\n请以 Markdown 格式输出，包含：\n- 清晰的章节结构\n- 自然语言描述（不要只输出 JSON）\n- 具体的代码示例（Tailwind 类名、CSS 代码）\n- 可复用的组件代码片段'
      : '## Output Format\nPlease output in Markdown format, including:\n- Clear section structure\n- Natural language descriptions (not just JSON)\n- Specific code examples (Tailwind classes, CSS code)\n- Reusable component code snippets');
    sections.push('');
    
    // 附加页面数据
    sections.push('---');
    sections.push('');
    sections.push(preferZh ? '## 页面快照数据' : '## Page Snapshot Data');
    sections.push('');
    sections.push(preferZh ? '### HTML（截断）' : '### HTML (truncated)');
    sections.push('```html');
    sections.push(snapshot.html.substring(0, 8000));
    sections.push('```');
    sections.push('');
    sections.push(preferZh ? '### CSS（截断）' : '### CSS (truncated)');
    sections.push('```css');
    sections.push(snapshot.css.substring(0, 12000));
    sections.push('```');
    
    return sections.join('\n');
  }

  /**
   * 构建批量分析 User Prompt
   * @param {Array} snapshots - 快照数组
   * @param {number} htmlLimit - 每页 HTML 截断长度
   * @param {number} cssLimit - 每页 CSS 截断长度
   */
  buildBatchPrompt(snapshots, htmlLimit = 5000, cssLimit = 8000) {
    const lang = this.config.generate.language || 'zh-CN';
    const preferZh = lang === 'zh-CN';
    const gen = this.config.generate || {};
    const sections = [];

    sections.push(preferZh
      ? `## 批量分析任务\n现在有 ${snapshots.length} 个同一网站的不同页面快照，请综合分析它们的**统一设计系统**。`
      : `## Batch Analysis Task\nAnalyze ${snapshots.length} pages from the same website to extract the **unified design system**.`
    );
    sections.push('');

    // 根据勾选项构建分析要求
    sections.push(preferZh ? '## 请分析以下内容：' : '## Please analyze the following:');
    sections.push('');
    
    const analysisItems = [];
    
    if (gen.includeColors !== false) {
      analysisItems.push(preferZh 
        ? '### 1. 统一配色系统\n- 跨页面一致的主色调、辅助色、中性色\n- 明暗主题的颜色映射\n- 品牌色使用规范'
        : '### 1. Unified Color System\n- Consistent primary, secondary, neutral colors across pages\n- Light/dark theme color mapping\n- Brand color usage');
    }
    
    if (gen.includeTypography !== false) {
      analysisItems.push(preferZh
        ? '### 2. 统一字体系统\n- 字体族（主字体、等宽字体）\n- 标题层级规范\n- 正文样式规范'
        : '### 2. Unified Typography\n- Font families (primary, mono)\n- Heading hierarchy\n- Body styles');
    }
    
    if (gen.includeLayout !== false) {
      analysisItems.push(preferZh
        ? '### 3. 统一布局系统\n- 容器宽度和内边距\n- 栅格系统\n- 间距规范'
        : '### 3. Unified Layout System\n- Container width and padding\n- Grid system\n- Spacing');
    }
    
    if (gen.includeComponents !== false) {
      analysisItems.push(preferZh
        ? '### 4. 通用组件风格\n- 导航栏、按钮、卡片、表单等\n- 每个组件提供示例代码'
        : '### 4. Common Component Styles\n- Navbar, button, card, form, etc.\n- Provide example code for each');
    }
    
    if (gen.includeAccessibility !== false) {
      analysisItems.push(preferZh
        ? '### 5. 无障碍建议\n- 对比度、焦点状态、WCAG 符合度'
        : '### 5. Accessibility\n- Contrast, focus states, WCAG compliance');
    }
    
    if (gen.includeRecommendations !== false) {
      analysisItems.push(preferZh
        ? '### 6. 设计一致性建议\n- 跨页面的设计差异\n- 统一改进建议'
        : '### 6. Design Consistency\n- Cross-page design differences\n- Unified improvement suggestions');
    }
    
    sections.push(analysisItems.join('\n\n'));
    sections.push('');
    
    // 输出格式要求
    sections.push(preferZh 
      ? '## 输出格式\n请以 Markdown 格式输出统一的设计系统文档，包含具体的代码示例和组件代码片段。'
      : '## Output Format\nPlease output a unified design system document in Markdown format, including specific code examples and component snippets.');
    sections.push('');

    // 附加页面数据
    sections.push('---');
    sections.push('');
    sections.push(preferZh ? '## 页面快照数据' : '## Page Snapshot Data');

    snapshots.forEach((snapshot, i) => {
      const vp = snapshot.metadata?.viewport ? `${snapshot.metadata.viewport.width}x${snapshot.metadata.viewport.height}` : 'unknown';
      sections.push('');
      sections.push(`### ${preferZh ? '页面' : 'Page'} ${i + 1}: ${snapshot.title}`);
      sections.push(`- URL: ${snapshot.url}`);
      sections.push(`- ${preferZh ? '视口' : 'Viewport'}: ${vp}`);
      sections.push('');
      sections.push('#### HTML');
      sections.push('```html');
      sections.push(snapshot.html.substring(0, htmlLimit));
      sections.push('```');
      sections.push('');
      sections.push('#### CSS');
      sections.push('```css');
      sections.push(snapshot.css.substring(0, cssLimit));
      sections.push('```');
    });

    return sections.join('\n');
  }
  
  /**
   * 调用 AI API
   */
  async callAI(systemPrompt, userPrompt) {
    const { apiKey, baseUrl, modelId, temperature, maxTokens } = this.config.ai;
    
    console.log('[AIAnalyzer] 准备调用 AI API');
    console.log('[AIAnalyzer] baseUrl:', baseUrl);
    console.log('[AIAnalyzer] modelId:', modelId);
    console.log('[AIAnalyzer] apiKey 存在:', !!apiKey);
    console.log('[AIAnalyzer] 使用模板:', this.config.template?.name || '默认');
    
    if (!apiKey || !baseUrl || !modelId) {
      const missing = [];
      if (!apiKey) missing.push('apiKey');
      if (!baseUrl) missing.push('baseUrl');
      if (!modelId) missing.push('modelId');
      throw new Error(`请先在设置中配置 AI 模型，缺少: ${missing.join(', ')}`);
    }
    
    const endpoint = baseUrl + '/chat/completions';
    console.log('[AIAnalyzer] 请求端点:', endpoint);
    
    // 使用 OpenAI 兼容格式
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          max_tokens: maxTokens || 8000,
          temperature: (typeof temperature === 'number' ? temperature : 0.3)
        })
      });
      
      if (!response.ok) {
        let errorMsg = 'AI 请求失败';
        try {
          const error = await response.json();
          errorMsg = error.error?.message || error.message || errorMsg;
        } catch (e) {
          const text = await response.text();
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('=== AI API 调用失败 ===', error.message);
      throw error;
    }
  }
  
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIAnalyzer;
}
