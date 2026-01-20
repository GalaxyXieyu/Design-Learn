# Design-Learn

> 让 AI 写出好看的前端界面



## TODO（规划中）

- 同步所有模板到本地（包含 `template/` 目录）
- 在 VSCode 插件中可配置“抽取提示词”（用于提取/分析的提示词模板管理）

## 解决什么问题？

**Vibe Coding 的痛点**：用 AI 写代码很爽，但让 AI 写出好看、稳定的前端界面很难控制。AI 生成的 UI 往往：
- 风格不一致，每次生成都不一样
- 缺乏设计感，看起来像"AI 味"
- 难以复用优秀网站的设计语言

**Design-Learn 的解决方案**：
1. **一键提取**：看到好看的网站？一键提取它的设计风格（颜色、字体、间距、组件）
2. **AI 分析**：自动生成设计规范文档，让 AI 理解这套设计语言
3. **MCP 集成**：Claude Code 可以直接查询你收集的设计库，生成风格一致的代码

**简单说**：把优秀网站的设计"喂"给 AI，让它照着写。

---

## 功能详解

### 🎨 一键提取页面设计

浏览任意网站，点击插件图标，2-5 秒完成提取：

- **完整快照**：HTML + CSS + 图片 + 字体
- **设计元素**：颜色、字体、间距、阴影、圆角
- **组件识别**：按钮、卡片、导航、表单等
- **元数据**：视口尺寸、性能指标、元素统计

```javascript
// 提取结果示例
{
  url: "https://stripe.com",
  css: "/* 所有样式 */",
  assets: {
    images: ["logo.svg", "hero.png"],
    fonts: ["Inter", "SF Pro"]
  },
  designTokens: {
    colors: ["#635BFF", "#0A2540", "#425466"],
    typography: { fontFamily: "Inter", sizes: [14, 16, 24, 48] },
    spacing: [4, 8, 16, 24, 32, 48]
  }
}
```

### 🤖 AI 智能分析

提取后自动调用 AI 生成设计规范文档：

- **色彩系统**：主色、辅助色、语义色、渐变
- **字体排版**：字体族、字号层级、行高、字重
- **间距系统**：基础单位、常用间距值
- **组件规范**：按钮样式、卡片阴影、输入框状态
- **设计风格**：整体调性、设计语言描述

**提示词模板系统**：
- 内置多种分析模板（通用、电商、SaaS、落地页）
- 支持自定义模板，保存多个版本
- 在线编辑，实时预览效果

### 🔗 MCP 集成 Claude Code

配置后，Claude Code 可以直接查询你的设计库：

```bash
# Claude Code 中使用
> 用 stripe.com 的设计风格写一个定价页面
# AI 会自动查询你提取的 Stripe 设计规范，生成风格一致的代码
```

**可用的 MCP 工具**：
| 工具 | 用途 |
|------|------|
| `list_designs` | 列出所有已提取的设计 |
| `search_designs` | 按关键词/URL 搜索 |
| `get_design` | 获取完整设计详情 |
| `get_rules` | 获取设计规则（颜色/字体/间距） |
| `get_styleguide` | 获取 AI 生成的设计规范文档 |

### 📦 多端协同

```
Chrome Extension ──┐
                   ├──> Design-Learn Server (port 3100)
VSCode Extension ──┤    - REST API
                   │    - MCP (SSE/stdio)
Claude Code ───────┘    - SQLite + 文件存储
```

| 组件 | 功能 |
|------|------|
| **Chrome 插件** | 提取页面、AI 分析、本地存储、历史管理 |
| **VSCode 插件** | 查看快照、管理设计库、启停服务 |
| **本地服务** | 数据持久化、MCP 工具、多端同步 |

---

## Quick Start
## Cursor/Claude Code 快速配置（npx）

`~/.cursor/mcp.json` 示例：

```json
{
  "mcpServers": {
    "design-learn": {
      "command": "npx",
      "args": ["-y", "design-learn-server", "design-learn-mcp"]
    }
  }
}
```

### 2. 安装 Chrome 插件

```
chrome://extensions/ → 开发者模式 → 加载已解压的扩展程序 → 选择 chrome-extension/
```
### 3. 配置 AI 分析（可选）

1. 点击插件设置图标
2. 配置 AI 模型（API Key、Base URL、Model）
3. 选择或创建提示词模板
4. 提取时自动生成设计分析报告

### 4. 提取页面

1. 访问目标网站（如 https://stripe.com）
2. 点击工具栏插件图标
3. 点击"提取页面风格"
4. 等待 2-5 秒，完成！


---

## 安装详情

### Chrome 插件

1. `chrome://extensions/` → 开启开发者模式
2. 加载已解压的扩展程序 → 选择 `chrome-extension/`
3. 验证：工具栏出现图标

> Edge: `edge://extensions/` | Brave: `brave://extensions/`

提示词模板当前使用插件本地存储（`promptTemplates` / `content`），不与服务端模板自动同步。


## 项目结构

```
Design-Learn/
├── chrome-extension/      # Chrome 插件（零依赖）
├── vscode-extension/      # VSCode 扩展
├── design-learn-server/   # 后端服务（Node.js + SQLite）
├── data/                  # 服务端数据
└── scripts/               # 工具脚本
```

---

## 技术栈

| 组件 | 技术 |
|------|------|
| Chrome 插件 | Manifest V3, 纯 JS, IndexedDB, Service Worker |
| 本地服务 | Node.js, SQLite (better-sqlite3), MCP SSE |
| VSCode 插件 | TypeScript, Webview |

---

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 插件未显示 | 确认选择 `chrome-extension/` 根目录，开启开发者模式 |
| AI 调用失败 | 检查 API Key、Base URL、Model Id 配置 |
| better-sqlite3 错误 | `npm rebuild better-sqlite3` |
| MCP 连接失败 | 确认服务已启动：`curl http://localhost:3100/api/health` |

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` / `DESIGN_LEARN_PORT` | 3100 | 服务端口 |
| `DESIGN_LEARN_DATA_DIR` | `~/.design-learn/data` | 数据目录 |

---

## 更新日志

**v3.0 (2025-11-27)**
- 新增提示词模板管理系统
- 支持多版本模板保存
- 可编辑提示词内容
- 优化批量分析流程

---

## TODO

- [ ] **集成 ui-uxpro** - 将 ui-uxpro 项目整合到 Design-Learn 系统中
  - [ ] 评估 ui-uxpro 的核心功能和 API
  - [ ] 设计集成架构
  - [ ] 实现数据格式兼容
  - [ ] 更新 MCP tools

---

## License

MIT License

## Author

**GalaxyXieyu** | v3.0.0 | 2025-11-27
