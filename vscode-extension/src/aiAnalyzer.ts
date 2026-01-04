import * as vscode from 'vscode';
import { Snapshot } from './extractor';

export interface AnalysisResult {
    analysis: {
        raw: boolean;
        content: string;
    };
    markdown: string;
    format: string;
}

export class AIAnalyzer {
    private config: {
        apiKey: string;
        baseUrl: string;
        modelId: string;
        temperature?: number;
        maxTokens?: number;
    } | null = null;

    /**
     * 加载配置
     */
    private loadConfig() {
        const config = vscode.workspace.getConfiguration('designLearn');
        const models = config.get<any[]>('aiModels', []);
        const selectedModelId = config.get<string>('selectedModel', '');

        let aiModel = models.find(m => m.id === selectedModelId);
        if (!aiModel && models.length > 0) {
            aiModel = models[0];
        }

        if (!aiModel || !aiModel.apiKey || !aiModel.modelId) {
            throw new Error('请先在设置中配置 AI 模型（运行命令：Design-Learn: 配置 AI 模型）');
        }

        const baseUrl = aiModel.baseUrl || (aiModel.provider === 'anthropic'
            ? 'https://api.anthropic.com/v1'
            : 'https://api.openai.com/v1');

        this.config = {
            apiKey: aiModel.apiKey,
            baseUrl: baseUrl,
            modelId: aiModel.modelId,
            temperature: aiModel.temperature || 0.3,
            maxTokens: aiModel.maxTokens || 8000
        };
    }

    /**
     * 分析快照
     */
    async analyze(snapshot: Snapshot): Promise<AnalysisResult> {
        this.loadConfig();

        if (!this.config) {
            throw new Error('AI 配置未加载');
        }

        const systemPrompt = this.getSystemPrompt();
        const userPrompt = this.buildUserPrompt(snapshot);

        const response = await this.callAI(systemPrompt, userPrompt);
        const markdown = this.wrapMarkdownReport(snapshot, response);

        return {
            analysis: { raw: true, content: response },
            markdown,
            format: 'markdown'
        };
    }

    /**
     * 获取 System Prompt
     */
    private getSystemPrompt(): string {
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
    }

    /**
     * 构建 User Prompt
     */
    private buildUserPrompt(snapshot: Snapshot): string {
        const vp = `${snapshot.metadata.viewport.width}x${snapshot.metadata.viewport.height}`;
        const sections: string[] = [];

        sections.push(`## 页面信息\n- 标题: ${snapshot.title}\n- URL: ${snapshot.url}\n- 视口: ${vp}`);
        sections.push('');

        sections.push('## 请分析以下内容：');
        sections.push('');
        sections.push(`### 1. 配色系统
- 主色调、辅助色、中性色
- 明暗主题的颜色映射
- 品牌色使用规范
- 具体色值和 Tailwind 类名

### 2. 字体系统
- 字体族（主字体、等宽字体）
- 标题层级（页标题、分节标题、副标题）
- 正文样式（字号、行高、字重）
- 具体的 font-family 和 Tailwind 类名

### 3. 布局与间距
- 容器宽度和内边距
- 栅格系统（列数、间距）
- 垂直间距规范
- 响应式断点

### 4. 组件风格
- 导航栏样式
- 按钮样式（主要、次要、品牌）
- 卡片样式
- 表单输入框
- 徽章/标签
- 每个组件请提供示例代码片段

### 5. 无障碍与对比度
- 文本与背景对比度
- 焦点状态样式
- WCAG 标准符合度

### 6. 改进建议
- 设计一致性建议
- 最佳实践推荐
- 潜在问题和优化方向

### 7. 其他设计令牌
- 阴影与层次
- 动效与过渡
- 圆角规范
- 透明度与磨砂效果`);
        sections.push('');

        sections.push('## 输出格式要求\n请以 Markdown 格式输出，包含：\n- 清晰的章节结构\n- 自然语言描述（不要只输出 JSON）\n- 具体的代码示例（Tailwind 类名、CSS 代码）\n- 可复用的组件代码片段');
        sections.push('');

        sections.push('---');
        sections.push('');
        sections.push('## 页面快照数据');
        sections.push('');
        sections.push('### HTML（截断）');
        sections.push('```html');
        sections.push(snapshot.html.substring(0, 8000));
        sections.push('```');
        sections.push('');
        sections.push('### CSS（截断）');
        sections.push('```css');
        sections.push(snapshot.css.substring(0, 12000));
        sections.push('```');

        return sections.join('\n');
    }

    /**
     * 包装 Markdown 报告
     */
    private wrapMarkdownReport(snapshot: Snapshot, content: string): string {
        const lines: string[] = [];
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
        lines.push(`*本报告由 Design-Learn VSCode 插件自动生成*`);
        lines.push(`*生成时间: ${new Date().toLocaleString('zh-CN')}*`);
        return lines.join('\n');
    }

    /**
     * 调用 AI API
     */
    private async callAI(systemPrompt: string, userPrompt: string): Promise<string> {
        if (!this.config) {
            throw new Error('AI 配置未加载');
        }

        const endpoint = `${this.config.baseUrl}/chat/completions`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.modelId,
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
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = 'AI 请求失败';
            try {
                const errorData = JSON.parse(errorText) as { error?: { message?: string }; message?: string };
                errorMsg = errorData.error?.message || errorData.message || errorMsg;
            } catch {
                if (errorText) {
                    errorMsg = errorText;
                }
            }
            throw new Error(errorMsg);
        }

        const data = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('AI 响应为空');
        }
        return content;
    }
}

