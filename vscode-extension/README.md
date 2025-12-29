# Design-Learn VSCode 插件

在 VSCode 内直接提取网页设计风格、保存快照并可选调用 AI 生成 STYLEGUIDE，所有数据会落在当前工作区根目录下的 `.designlearn` 文件夹。

## ✨ 主要特性

- 🎨 **网页设计提取** - 使用 Puppeteer 完整抓取 HTML/CSS/资源文件
- 🤖 **AI 智能分析** - 集成多个 AI 模型，自动生成设计分析报告
- ⚙️ **灵活配置** - 内置设置面板，支持多模型管理和提示词模板
- 📁 **本地存储** - 所有提取的快照和报告存放在 `.designlearn/` 目录
- 🔄 **快照管理** - 侧边栏快照浏览，快速打开和管理提取的内容
- 🧩 **本地服务管理** - 一键启动/停止 Design-Learn 服务，配合浏览器插件同步
- 🌍 **多语言支持** - 生成报告支持中英日韩等多种语言

## 📦 安装

在 VSCode 扩展市场搜索 `Design-Learn` 并安装，或者从源代码构建：

```bash
cd vscode-extension
npm install
npm run compile
npm install -g @vscode/vsce
vsce package
```

## 🚀 使用方法

### 基础使用

1. 在 VSCode 中打开一个项目工作区
2. 点击左侧活动栏的 "Design-Learn" 图标打开面板
3. 运行以下命令（按 `⇧⌘P` 打开命令面板）：
   - `Design-Learn: 打开设置面板` - 配置 AI 模型和提取选项
   - `Design-Learn: 提取网页设计风格` - 提取网页快照（无 AI 分析）
   - `Design-Learn: 提取并分析网页设计风格（AI）` - 提取并用 AI 分析
   - `Design-Learn: 启动/停止 Design-Learn 服务` - 管理本地服务（供浏览器插件同步）

### 设置面板

打开设置面板（命令：`Design-Learn: 打开设置面板`），您可以：

#### 🤖 AI 模型管理
- 添加和管理多个 AI 模型配置
- 支持 OpenAI、Anthropic 以及自定义 API 端点
- 设置 API Key、Base URL、Model ID
- 测试模型连接

#### ⚙️ 生成配置
- **提取选项**：选择是否内联 CSS、包含图片和字体
- **分析内容**：选择要分析的设计元素（颜色、排版、布局、组件、无障碍）
- **报告语言**：选择分析报告的输出语言

#### 📋 提示词模板
- 创建自定义提示词模板
- 管理多个模板版本
- 设置活跃模板用于分析

#### 📊 历史记录
- 查看提取历史统计
- 统计信息：总提取数、分析报告数、存储大小
- 快速操作：重新分析、打开文件夹、删除快照

## 📁 目录结构

第一次提取时会自动创建以下目录：

```
.designlearn/
├── snapshots/          # 提取的快照（按域名分组）
│   ├── example.com/
│   │   ├── snapshot-1.html
│   │   ├── snapshot-1.css
│   │   ├── snapshot-1.json
│   │   └── snapshot-1.md
│   └── ...
├── templates/          # 自定义静态页面模板
└── rules/              # 规则和提示词配置
```

## ⚙️ 配置说明

### VS Code Settings

在 `settings.json` 中可以配置以下选项：

```json
{
  "designLearn.savePath": "${workspaceFolder}/.designlearn",

  "designLearn.extraction": {
    "inlineCSS": true,
    "includeImages": true,
    "includeFonts": true
  },

  "designLearn.analysis": {
    "colors": true,
    "typography": true,
    "layout": true,
    "components": true,
    "accessibility": true
  },

  "designLearn.reportLanguage": "zh",

  "designLearn.server": {
    "entry": "${workspaceFolder}/design-learn-server/src/server.js",
    "cwd": "${workspaceFolder}/design-learn-server",
    "port": 3000,
    "autoStart": true
  }
}
```

### 通过界面配置

使用设置面板进行所有配置更加方便，界面中的更改会自动保存到 VS Code 配置中。

## 🧪 开发与调试

### 环境要求
- Node.js 16+
- VSCode 1.80.0+

### 本地开发

```bash
cd vscode-extension

# 安装依赖
npm install

# 开发模式（监听文件变化编译）
npm run watch

# 打包
npm run vscode:prepublish
npm run package
```

在 VSCode 中按 `F5` 启动扩展宿主调试窗口进行测试。

## 📊 工作流示例

### 场景 1：快速提取
1. 打开命令面板 (`⇧⌘P`)
2. 运行 `Design-Learn: 提取网页设计风格`
3. 输入网页 URL
4. 快照自动保存到 `.designlearn/snapshots/`

### 场景 2：AI 分析工作流
1. 打开设置面板，配置 OpenAI 或其他 AI 模型
2. 根据需要调整分析选项和报告语言
3. 运行 `Design-Learn: 提取并分析网页设计风格（AI）`
4. 输入网页 URL
5. 等待 AI 分析完成，自动生成 Markdown 报告

### 场景 3：Chrome 插件同步
1. 在 VSCode 中执行 `Design-Learn: 启动/停止 Design-Learn 服务`
2. 打开 Chrome 扩展设置页，在“同步设置”中保持“自动检测本地服务”开启；未检测到时再手动填写服务地址
3. 在 Chrome 插件中完成采集任务，插件会自动上报到本地服务

### 场景 4：使用自定义模板
1. 将您的提示词模板创建在设置面板
2. 标记为"活跃"状态
3. AI 分析会使用该模板生成报告

## 🎯 快捷键

- `⇧⌘P` + `Design-Learn` - 快速查看所有命令
- 点击快照中心的快照项 - 打开该快照文件夹
- 右键快照 - 额外操作菜单

## 📝 支持的 AI 模型

- **OpenAI** - GPT-4、GPT-4o、GPT-3.5-turbo 等
- **Anthropic** - Claude 3 系列
- **自定义 API** - 兼容 OpenAI API 格式的任何服务

## 🔗 相关项目

- [Chrome 扩展版本](https://github.com/GalaxyXieyu/Design-Learn) - Design-Learn Chrome 浏览器扩展
- 两个版本共享 `.designlearn` 数据目录，可以无缝切换

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**提示**：如需在不同项目间共享快照数据，可将 `.designlearn` 目录复制到其他项目工作区中。
