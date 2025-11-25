/**
 * AI 风格分析器
 * 调用 AI API 分析页面设计风格
 */
class AIAnalyzer {
  constructor() {
    this.config = null;
  }
  
  /**
   * 加载配置
   */
  async loadConfig() {
    const result = await chrome.storage.local.get(['aiModels', 'sg_aiModels', 'generateConfig', 'sg_generateConfig']);
    console.log('[AIAnalyzer] Storage 原始数据:', JSON.stringify(result, null, 2));
    
    const aiModels = result.sg_aiModels || result.aiModels || [];
    console.log('[AIAnalyzer] 找到的 AI 模型列表:', aiModels.length, '个');
    
    const defaultModel = aiModels.find(m => m.isDefault) || aiModels[0] || null;
    console.log('[AIAnalyzer] 默认模型:', defaultModel ? `${defaultModel.name} (${defaultModel.modelId})` : '未配置');
    
    this.config = {
      ai: defaultModel || {},
      generate: result.sg_generateConfig || result.generateConfig || {}
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
  
  /**
   * 分析快照
   */
  async analyze(snapshot) {
    await this.loadConfig();

    if (!this.config.ai.apiKey) {
      throw new Error('请先在设置中配置 AI API Key');
    }

    // 构建 Prompt
    const prompt = this.buildPrompt(snapshot);

    // 调用 AI
    const response = await this.callAI(prompt);

    // 解析响应
    const analysis = this.parseResponse(response);
    const markdown = this.generateMarkdown(snapshot, analysis);
    const format = analysis && analysis.raw ? 'raw' : 'json';
    return { analysis, markdown, format };
  }

  /**
   * 批量分析多个快照
   */
  async analyzeBatch(snapshots) {
    await this.loadConfig();

    if (!this.config.ai.apiKey) {
      throw new Error('请先在设置中配置 AI API Key');
    }

    const prompt = this.buildBatchPrompt(snapshots);
    const response = await this.callAI(prompt);
    const analysis = this.parseResponse(response);
    const markdown = this.generateBatchMarkdown(snapshots, analysis);
    const format = analysis && analysis.raw ? 'raw' : 'json';
    return { analysis, markdown, format };
  }
  
  /**
   * 构建分析 Prompt
   */
  buildPrompt(snapshot) {
    const sections = [];
    const vp = `${snapshot.metadata.viewport.width}x${snapshot.metadata.viewport.height}`;
    const lang = this.config.generate.language || 'zh-CN';
    const preferZh = lang === 'zh-CN';
    const intro = preferZh ? '你是一位资深的前端设计系统专家，请根据提供的页面快照输出高精度的风格分析。' : 'You are a senior design system expert. Produce a high-fidelity style analysis.';
    sections.push(intro);
    sections.push(preferZh ? `页面: ${snapshot.title} | URL: ${snapshot.url} | 视口: ${vp}` : `Page: ${snapshot.title} | URL: ${snapshot.url} | Viewport: ${vp}`);

    sections.push(preferZh ? `请严格按以下 JSON Schema 输出（不要包含除 JSON 以外的任何文本）：` : `Output strictly as JSON (no extra text), following this schema:`);
    sections.push(`\n\`\`\`json`);
    sections.push(JSON.stringify({
      overview: {
        design_language: '',
        tech_stack: '',
        theme_mechanism: '',
        components_pattern: ''
      },
      design_tokens: {
        fonts: { primary: [], mono: [] },
        colors: { base: {}, brand: '', mapping: { light: {}, dark: {} }, tailwind_expose: [] },
        shadows: [],
        backgrounds: [],
        motions: []
      },
      color_palette: {
        text: { primary: '', secondary: [], brand: '' },
        backgrounds: { page: {}, card: {}, overlay: {}, accent: {} },
        borders: { divide: '' }
      },
      typography: {
        fonts: { primary: '', mono: '' },
        headings: { page: {}, section: {}, sub: {}, kicker: {} },
        body: { prose: '', weights: {}, tracking: 'tracking-tight' }
      },
      spacing_system: {
        container: { max: 'max-w-7xl', padding: ['px-4','md:px-8'], vertical: ['py-16','py-20','py-40'] },
        grid: { cols: ['grid-cols-1','md:grid-cols-2','lg:grid-cols-3'], gaps: ['gap-4','gap-6','gap-10','gap-20'] },
        atoms: { sizes: [], minH: [] }
      },
      components: {
        navbar: {},
        button: {},
        card: {},
        table: {},
        badge: {},
        input: {}
      },
      shadows_elevation: [],
      animations_transitions: [],
      border_radius: {},
      opacity_transparency: {},
      tailwind_usage: [],
      examples: {},
      a11y: { contrast: '>=4.5:1', focus: '' },
      summary: ''
    }, null, 2));
    sections.push(`\n\`\`\``);

    sections.push(preferZh ? `输入快照（截断）HTML:` : `Snapshot (truncated) HTML:`);
    sections.push('```html');
    sections.push(snapshot.html.substring(0, 8000));
    sections.push('```');
    sections.push(preferZh ? `输入快照（截断）CSS:` : `Snapshot (truncated) CSS:`);
    sections.push('```css');
    sections.push(snapshot.css.substring(0, 12000));
    sections.push('```');
    return sections.join('\n');
  }

  /**
   * 构建批量分析 Prompt
   */
  buildBatchPrompt(snapshots) {
    const lang = this.config.generate.language || 'zh-CN';
    const preferZh = lang === 'zh-CN';
    const sections = [];

    sections.push(preferZh
      ? `你是一位资深的前端设计系统专家。现在有 ${snapshots.length} 个同一网站的不同页面快照，请综合分析它们的统一设计风格。`
      : `You are a senior design system expert. Analyze ${snapshots.length} pages from the same website to extract unified design patterns.`
    );

    sections.push(preferZh ? `请严格按以下 JSON Schema 输出（不要包含除 JSON 以外的任何文本）：` : `Output strictly as JSON (no extra text), following this schema:`);
    sections.push(`\n\`\`\`json`);
    sections.push(JSON.stringify({
      overview: { design_language: '', tech_stack: '', theme_mechanism: '', components_pattern: '' },
      design_tokens: { fonts: {}, colors: {}, shadows: [], backgrounds: [], motions: [] },
      color_palette: { text: {}, backgrounds: {}, borders: {} },
      typography: { fonts: {}, headings: {}, body: {} },
      spacing_system: { container: {}, grid: {}, atoms: {} },
      components: { navbar: {}, button: {}, card: {}, table: {}, badge: {}, input: {} },
      shadows_elevation: [],
      animations_transitions: [],
      border_radius: {},
      opacity_transparency: {},
      tailwind_usage: [],
      a11y: {},
      summary: ''
    }, null, 2));
    sections.push(`\n\`\`\``);

    snapshots.forEach((snapshot, i) => {
      sections.push(`\n## ${preferZh ? '页面' : 'Page'} ${i + 1}: ${snapshot.title}`);
      sections.push(`URL: ${snapshot.url}`);
      sections.push('```html');
      sections.push(snapshot.html.substring(0, 5000));
      sections.push('```');
      sections.push('```css');
      sections.push(snapshot.css.substring(0, 8000));
      sections.push('```');
    });

    return sections.join('\n');
  }
  
  /**
   * 调用 AI API
   */
  async callAI(prompt) {
    const { apiKey, baseUrl, modelId, temperature, maxTokens } = this.config.ai;
    
    console.log('[AIAnalyzer] 准备调用 AI API');
    console.log('[AIAnalyzer] baseUrl:', baseUrl);
    console.log('[AIAnalyzer] modelId:', modelId);
    console.log('[AIAnalyzer] apiKey 存在:', !!apiKey);
    
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
              content: '你是一位专业的前端设计系统分析专家。严格输出 JSON（不可包含除 JSON 外任何文本），遵循给定 schema。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens || 4000,
          temperature: (typeof temperature === 'number' ? temperature : 0.2)
          // 某些提供商可能支持：response_format: { type: 'json_object' }
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
  
  /**
   * 解析 AI 响应
   */
  parseResponse(response) {
    const fenced = response.match(/```json\s*([\s\S]*?)```/i);
    if (fenced) {
      try { return JSON.parse(fenced[1]); } catch {}
    }
    try {
      const trimmed = response.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return JSON.parse(trimmed);
      }
    } catch {}
    const brace = response.match(/\{[\s\S]*\}/);
    if (brace) {
      try { return JSON.parse(brace[0]); } catch {}
    }
    return { summary: response, raw: true };
  }
  
  /**
   * 生成批量分析 Markdown 报告
   */
  generateBatchMarkdown(snapshots, analysis) {
    const lines = [];
    lines.push(`# 批量设计风格分析报告`);
    lines.push('');
    lines.push(`> **分析时间**: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`> **页面数量**: ${snapshots.length}`);
    lines.push('');
    lines.push('## 分析页面列表');
    lines.push('');
    snapshots.forEach((s, i) => {
      lines.push(`${i + 1}. [${s.title}](${s.url})`);
    });
    lines.push('');
    lines.push('---');
    lines.push('');

    const pushKV = (obj) => {
      Object.entries(obj || {}).forEach(([k,v]) => {
        if (v == null) return;
        if (typeof v === 'object') {
          lines.push(`- ${k}:`);
          lines.push('');
          lines.push('```json');
          lines.push(JSON.stringify(v, null, 2));
          lines.push('```');
        } else {
          lines.push(`- ${k}: ${v}`);
        }
      });
    };

    if (analysis.overview) {
      lines.push(`## 概览`);
      pushKV(analysis.overview);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.design_tokens) {
      lines.push(`## 设计令牌`);
      pushKV(analysis.design_tokens);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.color_palette) {
      lines.push(`## 配色系统`);
      pushKV(analysis.color_palette);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.typography) {
      lines.push(`## 排版`);
      pushKV(analysis.typography);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.spacing_system) {
      lines.push(`## 间距系统`);
      pushKV(analysis.spacing_system);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.components) {
      lines.push(`## 组件风格`);
      Object.entries(analysis.components).forEach(([name, style]) => {
        lines.push(`### ${name}`);
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(style, null, 2));
        lines.push('```');
        lines.push('');
      });
      lines.push('---');
      lines.push('');
    }

    if (analysis.shadows_elevation) {
      lines.push(`## 阴影与层次`);
      lines.push('```json');
      lines.push(JSON.stringify(analysis.shadows_elevation, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (analysis.animations_transitions) {
      lines.push(`## 动效与过渡`);
      lines.push('```json');
      lines.push(JSON.stringify(analysis.animations_transitions, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (analysis.border_radius) {
      lines.push(`## 圆角`);
      pushKV(analysis.border_radius);
      lines.push('');
    }

    if (analysis.opacity_transparency) {
      lines.push(`## 透明度与磨砂`);
      pushKV(analysis.opacity_transparency);
      lines.push('');
    }

    if (analysis.tailwind_usage) {
      lines.push(`## 常用 Tailwind 使用模式`);
      if (Array.isArray(analysis.tailwind_usage)) {
        analysis.tailwind_usage.forEach(i => lines.push(`- ${i}`));
      }
      lines.push('');
    }

    if (analysis.a11y) {
      lines.push(`## 无障碍与对比度`);
      pushKV(analysis.a11y);
      lines.push('');
    }

    if (analysis.summary) {
      lines.push('---');
      lines.push('');
      lines.push(analysis.summary);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push(`*本报告由 Frontend Style Generator AI 自动生成*`);
    lines.push(`*生成时间: ${new Date().toLocaleString('zh-CN')}*`);
    return lines.join('\n');
  }

  /**
   * 生成 Markdown 报告
   */
  generateMarkdown(snapshot, analysis) {
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

    const pushKV = (obj) => {
      Object.entries(obj || {}).forEach(([k,v]) => {
        if (v == null) return;
        if (typeof v === 'object') {
          lines.push(`- ${k}:`);
          lines.push('');
          lines.push('```json');
          lines.push(JSON.stringify(v, null, 2));
          lines.push('```');
        } else {
          lines.push(`- ${k}: ${v}`);
        }
      });
    };

    if (analysis.overview) {
      lines.push(`## 概览`);
      pushKV(analysis.overview);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.design_tokens) {
      lines.push(`## 设计令牌`);
      pushKV(analysis.design_tokens);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.color_palette) {
      lines.push(`## 配色系统`);
      pushKV(analysis.color_palette);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.typography) {
      lines.push(`## 排版`);
      pushKV(analysis.typography);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.spacing_system) {
      lines.push(`## 间距系统`);
      pushKV(analysis.spacing_system);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (analysis.components) {
      lines.push(`## 组件风格`);
      Object.entries(analysis.components).forEach(([name, style]) => {
        lines.push(`### ${name}`);
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(style, null, 2));
        lines.push('```');
        lines.push('');
      });
      lines.push('---');
      lines.push('');
    }

    if (analysis.shadows_elevation) {
      lines.push(`## 阴影与层次`);
      lines.push('```json');
      lines.push(JSON.stringify(analysis.shadows_elevation, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (analysis.animations_transitions) {
      lines.push(`## 动效与过渡`);
      lines.push('```json');
      lines.push(JSON.stringify(analysis.animations_transitions, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (analysis.border_radius) {
      lines.push(`## 圆角`);
      pushKV(analysis.border_radius);
      lines.push('');
    }

    if (analysis.opacity_transparency) {
      lines.push(`## 透明度与磨砂`);
      pushKV(analysis.opacity_transparency);
      lines.push('');
    }

    if (analysis.tailwind_usage) {
      lines.push(`## 常用 Tailwind 使用模式`);
      if (Array.isArray(analysis.tailwind_usage)) {
        analysis.tailwind_usage.forEach(i => lines.push(`- ${i}`));
      }
      lines.push('');
    }

    if (analysis.a11y) {
      lines.push(`## 无障碍与对比度`);
      pushKV(analysis.a11y);
      lines.push('');
    }

    if (analysis.summary) {
      lines.push('---');
      lines.push('');
      lines.push(analysis.summary);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push(`*本报告由 Frontend Style Generator AI 自动生成*`);
    lines.push(`*生成时间: ${new Date().toLocaleString('zh-CN')}*`);
    return lines.join('\n');
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIAnalyzer;
}
