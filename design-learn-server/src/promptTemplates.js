const PROMPT_TEMPLATE_FIELDS = [
  'id',
  'name',
  'type',
  'content',
  'description',
  'isActive',
  'isDefault',
  'metadata',
  'createdAt',
  'updatedAt',
];

const PROMPT_TEMPLATE_LIMITS = {
  name: 100,
  description: 500,
  content: 50000,
};

const PROMPT_TEMPLATE_DEFAULT_TYPE = 'styleguide';

const PROMPT_TEMPLATE_RESOLUTION_ORDER = ['templateId', 'default', 'built-in'];

const STYLEGUIDE_DEFAULT_CONTENT = [
  '你是一位资深的前端设计系统专家，擅长从网页源码中提取设计规范并输出专业的设计系统文档。',
  '',
  '## 你的任务',
  '分析提供的网页 HTML 和 CSS，输出一份详尽的设计风格指南（STYLEGUIDE.md），帮助开发者理解和复用该网站的设计系统。',
  '',
  '## 输出要求',
  '',
  '### 1. 格式规范',
  '- 使用清晰的 Markdown 格式，包含多级标题',
  '- 每个章节都要有**自然语言描述**解释设计意图和使用场景',
  '- 提供**具体的代码示例**（Tailwind 类名、CSS 代码、组件代码片段）',
  '- 使用表格整理设计令牌（如颜色、字号、间距等）',
  '',
  '### 2. 内容深度',
  '- **设计令牌**：提取具体的色值（如 #0076ff）、字体族、阴影值等，不要只写占位符',
  '- **组件风格**：为每个组件提供完整的 TSX/JSX 示例代码，包含样式类名',
  '- **使用建议**：说明何时使用、如何组合、注意事项',
  '- **明暗主题**：如果页面支持，分别说明 light/dark 模式的样式差异',
  '',
  '### 3. 示例代码要求',
  '- 组件代码使用 React + Tailwind CSS 风格',
  '- 代码要完整可运行，包含必要的 import',
  '- 使用 ```tsx 代码块标注语言',
  '',
  '### 4. 专业性',
  '- 参考 Aceternity UI、Shadcn UI 等专业设计系统的文档风格',
  '- 使用设计系统术语（Design Tokens、Semantic Colors、Typography Scale 等）',
  '- 提供 Do & Don\'t 最佳实践建议',
  '',
  '## 输出结构参考',
  '1. 概览（设计语言、技术栈、主题机制）',
  '2. 设计令牌（颜色、字体、阴影、动效变量）',
  '3. 配色系统（文本色、背景色、边框色、品牌色）',
  '4. 排版系统（字体栈、标题层级、正文样式）',
  '5. 间距系统（容器、栅格、常用间距原子）',
  '6. 组件风格（导航、按钮、卡片、表单等，每个都要有示例代码）',
  '7. 阴影与层次',
  '8. 动效与过渡',
  '9. 圆角规范',
  '10. 无障碍建议',
  '11. 常用 Tailwind 模式',
  '12. 示例代码（2-3个完整组件示例）',
  '13. 约定与最佳实践（Do & Don\'t）',
  '',
  '请确保输出内容详尽、专业、可直接用于团队开发参考。',
].join('\n');

const PROMPT_TEMPLATE_DEFAULTS = {
  [PROMPT_TEMPLATE_DEFAULT_TYPE]: {
    name: '默认模板',
    type: PROMPT_TEMPLATE_DEFAULT_TYPE,
    description: '内置 styleguide 默认提示词',
    content: STYLEGUIDE_DEFAULT_CONTENT,
    metadata: { system: true },
  },
};

function getPromptTemplateDefault(type) {
  return PROMPT_TEMPLATE_DEFAULTS[type] || null;
}

module.exports = {
  PROMPT_TEMPLATE_FIELDS,
  PROMPT_TEMPLATE_LIMITS,
  PROMPT_TEMPLATE_DEFAULT_TYPE,
  PROMPT_TEMPLATE_RESOLUTION_ORDER,
  PROMPT_TEMPLATE_DEFAULTS,
  getPromptTemplateDefault,
};
