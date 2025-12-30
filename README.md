# Design-Learn

> 一键提取网页设计风格，AI 智能分析，插件零依赖 + 可选本地服务联动

## 🎯 项目简介

这是一个**插件端零依赖**的 Chrome 浏览器插件，用户无需安装额外软件即可完成页面提取（HTML、CSS、图片、字体等）。如需与 VSCode 或服务端同步，可选启动 `design-learn-server` 进行本地联动。

### 核心特性

- ✅ **插件端零依赖**: 无需 Node.js、Playwright 等任何依赖
- ✅ **一键提取**: 点击插件图标即可提取当前页面
- ✅ **完整快照**: HTML + CSS + 图片 + 字体 + 元数据
- ✅ **AI 分析**: 集成 AI 模型，自动生成设计分析报告
- ✅ **提示词模板**: 可编辑、多版本管理的 AI 提示词系统
- ✅ **本地存储**: 使用 Chrome Storage 本地保存，无需后端
- ✅ **本地服务同步（可选）**: 支持上报到 `design-learn-server`，与 VSCode 联动
- ✅ **即时预览**: 在新标签页预览提取的页面
- ✅ **一键下载**: 导出为完整的 HTML 文件
- ✅ **历史记录**: 按域名分组，批量分析

## 🧭 当前架构（已实现）

```
Chrome Extension (采集/上报) ──┐
                               ├─> Design-Learn Server (REST/MCP/队列)
VSCode Extension (管理/启动) ──┘
```

- **Chrome 插件**：采集页面快照，可选上报到本地服务
- **Design-Learn Server**：单进程服务，提供 /api、/mcp、/ws 与队列/进度推送
- **VSCode 插件**：提供管理 UI，并可启动/停止本地服务

## ✅ PRD 功能落地清单（当前实现）

- ✅ 单进程服务入口与 REST/WS/MCP 路由（/api/health、/mcp、/ws）
- ✅ SQLite + 文件存储的统一数据层（Design/Version/Component/Rule CRUD）
- ✅ MCP tools/resources/prompts 注册与 SSE 交互
- ✅ 提取队列与进度推送（/api/import/* + /api/import/stream）
- ✅ Chrome 插件“仅采集并上报”同步设置
- ✅ VSCode 插件本地服务启动/停止
- ✅ 测试计划/性能基线文档 + 后端验证脚本
- ✅ issues CSV 快照脚本

## 🗺️ 里程碑与成功指标（v2.x 一键启动 & 自动连接）

### 里程碑清单

- **MVP：一键启动 + 自动发现**
  - 依赖：Node.js 18+；端口可用；已安装 Chrome/VSCode 插件
  - 验收：`npx @design-learn/server` 可启动服务并 `GET /api/health` 返回 healthy；插件自动检测本地服务，未检测到时提示启动并保留手动 URL 兜底
- **迭代 1：联调可观测与稳定性**
  - 依赖：服务启动参数（端口/数据目录/鉴权）可配置；日志可定位
  - 验收：连接状态在插件 UI 可见；导入链路可通过脚本验证；失败场景有明确提示
- **迭代 2：分发与回滚**
  - 依赖：打包产物与版本管理规范
  - 验收：发布清单与回滚步骤可执行；新旧客户端兼容策略写清

### 成功指标（可量化）

- 首次安装后 5 分钟内完成服务联通（含 npx 启动 + 插件检测）
- 自动检测成功率 ≥ 90%（本地回环环境）
- npx 启动成功率 ≥ 95%（同平台同版本）

## 📍 插件与扩展位置

- **Chrome 插件源码**：`chrome-extension/`
- **VSCode 插件源码**：`vscode-extension/`

## 📦 打包产物（可选）

- **Chrome 插件 zip**：`dist/design-learn-chrome-extension.zip`
- **VSCode 插件 vsix**：`dist/design-learn-vscode-1.0.0.vsix`

安装 VSCode 插件：
- VSCode UI：命令面板 → `Extensions: Install from VSIX...`
- 命令行：`code --install-extension dist/design-learn-vscode-1.0.0.vsix`

重新打包：

```bash
# Chrome 插件 zip
(cd chrome-extension && zip -r ../dist/design-learn-chrome-extension.zip . -x '*.DS_Store' -x '__MACOSX/*')

# VSCode 插件 vsix
(cd vscode-extension && vsce package --skip-license --allow-package-all-secrets --allow-package-env-file -o ../dist/design-learn-vscode-1.0.0.vsix)
```

## 🚀 快速开始

### 安装插件（1 分钟）

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 在弹出的目录选择器中，选择项目内的 `chrome-extension` 文件夹（确保其中存在 `manifest.json`）
5. 安装成功后，扩展页会出现“Design-Learn”，浏览器工具栏显示插件图标

提示：
- 选择子目录（如 `chrome-extension/popup`）会导致安装失败，请务必选择 `chrome-extension` 根目录
- Edge 使用 `edge://extensions/`，Brave 使用 `brave://extensions/`，其余步骤一致

#### 选择哪个文件夹？
- 克隆或下载本仓库后，必须选择仓库中的 `chrome-extension/` 目录作为“已解压的扩展程序”目录
- 快速自检：选中的目录内应包含文件 `manifest.json`

路径示例（macOS）：
- `~/.../Design-Learn/chrome-extension`

常见错误目录（不要选择）
- 仓库根目录：`~/.../Design-Learn/`（错误）
- 子模块目录：`~/.../Design-Learn/chrome-extension/popup`（错误）
- 子模块目录：`~/.../Design-Learn/chrome-extension/background`（错误）
- 单个文件或压缩包：`Design-Learn-3.0.0.zip`（错误，开发模式需选择文件夹）

### 使用插件（5 秒）

1. 访问任意网页（如 https://stripe.com）
2. 点击浏览器工具栏的插件图标
3. 点击"提取页面风格"按钮
4. 等待 2-5 秒，提取完成
5. 可以预览、下载或查看历史记录

### 本地服务与同步（可选）

1. 启动本地服务：
   - 方式 A：`node design-learn-server/src/server.js`
   - 方式 B：VSCode 扩展命令 `Design-Learn: 启动/停止 Design-Learn 服务`
2. 点击插件 Popup 右上角齿轮打开设置页 → “生成配置” → “同步设置”
3. 保持“自动检测本地服务”开启；未检测到时再手动填写服务地址
4. 触发一次采集任务，服务端 `/api/import/jobs` 可看到记录

## 🧩 本地安装详细指南

### 前提条件
- Chrome 115+，支持 Manifest V3
- 可选：Microsoft Edge（Chromium）或 Brave（同样支持加载已解压扩展）

### 安装步骤（详细）
1. 进入扩展管理页面：`chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择项目中的 `chrome-extension` 目录（包含 `manifest.json`）
5. 安装完成后，看到 `Design-Learn` 条目与工具栏图标

### 安装验证
- 在扩展页面确认名称与版本号：应显示 `Design-Learn v3.0.0`
- 点击工具栏图标应弹出插件 Popup 窗口
- 扩展详情 → 背景页/Service Worker 应显示为“活动”状态

### 首次使用配置
1. 打开插件的设置页（Options）
2. 在“AI 模型”中配置 `API Key`、`Base URL`、`Model Id` 等
3. 在“生成配置”中设置语言与分析偏好
4. 返回网页，点击提取并触发 AI 分析生成 Markdown 报告

### 更新与重载
- 修改源码后，可在 `chrome://extensions/` 点击“重新加载”，Service Worker 将重启
- 内容脚本更新后，需刷新目标页面以重新注入
- 若遇到旧状态，可在扩展详情中停止/启动后台页以刷新

### 权限说明
- `activeTab`：读取当前活动标签页内容用于提取
- `storage`：使用 Chrome Storage 保存本地配置与快照
- `downloads`：支持将提取结果导出为 HTML 文件
- `host_permissions`：允许上报到 `http://localhost/*` 与 `http://127.0.0.1/*`

### 常见问题与排错
- 未显示图标或安装失败：确认选择的是 `chrome-extension` 根目录并已开启开发者模式
- `Manifest` 报错：检查 `chrome-extension/manifest.json` 是否存在且为 `manifest_version: 3`
- 内容脚本不生效：刷新目标页面；特殊页面（如 `chrome://`、扩展商店页面）不支持注入
- AI 调用失败：在设置页正确配置 `API Key`、`Base URL`、`Model Id`；检查网络与配额
- 后台未运行：在扩展详情查看 Service Worker 状态或点击“重新加载”

### 其他浏览器
- Edge：地址栏输入 `edge://extensions/`，步骤同 Chrome
- Brave：地址栏输入 `brave://extensions/`，步骤同 Chrome

## 📦 项目结构

```
Design-Learn/
├── chrome-extension/              # Chrome 插件
│   ├── manifest.json             # 插件配置
│   ├── popup/                    # 弹出窗口 UI
│   ├── content/                  # 页面提取器
│   ├── background/               # 后台服务
│   ├── lib/                      # AI 分析器
│   ├── options/                  # 设置页面
│   └── icons/                    # 图标文件
│
├── design-learn-server/          # 本地服务
├── vscode-extension/             # VSCode 扩展
├── scripts/                      # 提取与验证脚本
└── docs/                         # 项目文档
```

## 🎨 功能展示

### 1. AI 提示词模板管理 ⭐️ 新功能

```
提示词模板系统支持：
✅ 可编辑提示词内容
✅ 多版本模板保存
✅ 模板快速切换
✅ 模板复制和删除
✅ 内置默认模板
✅ 自定义模板描述
```

**核心功能：**
- **模板管理**: 创建、编辑、删除、复制多个提示词模板
- **在线编辑**: 直接在界面上编辑和保存提示词
- **版本控制**: 保存多个版本，随时切换使用
- **模板分类**: 支持内置模板和自定义模板
- **实时预览**: 编辑时实时预览提示词效果



### 2. 页面提取

```javascript
// 提取结果示例
{
  id: "snapshot_1700000000000_abc123",
  url: "https://stripe.com",
  title: "Stripe | Payment Processing Platform",
  html: "<!DOCTYPE html>...",      // 完整 HTML
  css: "/* 内联的 CSS */",          // 所有样式
  assets: {
    images: [...],                 // 图片列表
    fonts: [...]                   // 字体列表
  },
  metadata: {
    viewport: { width: 1920, height: 1080 },
    performance: { loadTime: 2500 },
    stats: { totalElements: 1523 }
  },
  extractedAt: "2025-11-23T11:56:00.000Z",
  extractionTime: 2345  // ms
}
```

### 3. UI 界面

**弹出窗口：**
```
┌─────────────────────────────────┐
│  🎨 Design-Learn                │
│  一键提取页面设计风格            │
├─────────────────────────────────┤
│  📄 当前页面                     │
│  Stripe                         │
│  stripe.com                     │
├─────────────────────────────────┤
│  ⚙️ 提取选项                     │
│  ☑ 内联 CSS 样式                │
│  ☑ 收集图片资源                 │
│  ☑ 收集字体文件                 │
├─────────────────────────────────┤
│  [🎨 提取页面风格]              │
├─────────────────────────────────┤
│  📊 最近任务 (3)                │
│  • stripe.com - 进行中          │
│  • linear.app - 已完成          │
└─────────────────────────────────┘
```

**设置页面：**
```
┌─────────────────────────────────────────┐
│  侧边栏                                  │
│  • AI 模型                              │
│  • 生成配置                    ⭐️       │
│  • 历史与数据                            │
└─────────────────────────────────────────┘

生成配置页面包含：
1. 提取选项（内联CSS、图片、字体）
2. 分析内容（色彩、字体、布局、组件等）
3. 提示词模板管理 ⭐️
   - 模板列表（支持使用/编辑/复制/删除）
   - 当前使用标识
4. AI 提示词预览/编辑 ⭐️
   - 预览模式（查看当前提示词）
   - 编辑模式（直接修改提示词）
   - 另存为新模板
```

## 🔧 技术栈

### Chrome 插件
- **Manifest V3**: Chrome 扩展最新标准
- **纯 JavaScript**: 无需构建工具
- **IndexedDB**: 本地数据库
- **Content Script**: 页面内容提取
- **Service Worker**: 后台任务处理

### 本地服务（可选）
- **Node.js**: 单进程 HTTP 服务
- **SQLite**: 元数据存储（better-sqlite3）
- **MCP**: SSE 交互与工具注册

## 🧪 验证与排错

- 后端验证脚本：`scripts/verify-backend.sh`（从仓库根目录执行）
- 说明：验证脚本会**启动服务并在完成后自动退出**，需要手工 `curl` 时请单独启动服务
- 如遇到 `better-sqlite3` 版本不匹配，请在 `design-learn-server` 下执行：

```bash
npm install
npm rebuild better-sqlite3
```

- 提示：仓库根目录没有 `package.json`，请务必在 `design-learn-server/` 目录执行依赖安装

- 自定义端口示例：

```bash
PORT=3100 ./scripts/verify-backend.sh
```

- 同步配置说明：默认自动检测 `localhost:3000/3100`，仅在检测失败时手动填写 URL

### 手工接口验证示例

```bash
curl http://localhost:3000/api/health

cat <<'JSON' | curl -X POST http://localhost:3000/api/import/browser \\
  -H 'Content-Type: application/json' \\
  -d @-
{"source":"browser-extension","website":{"url":"https://example.com","title":"Example"},"snapshot":{"id":"snapshot_test","url":"https://example.com","title":"Example","html":"<html></html>","css":"body{}"}}
JSON

curl http://localhost:3000/api/import/jobs
```

### 未来计划（Next.js 后台）
- Drizzle ORM + PostgreSQL
- Shadcn UI + Tailwind CSS
- Vercel AI SDK（风格分析）

## 📊 性能指标

- **提取速度**: 2-5 秒（普通页面）
- **内存占用**: < 50MB
- **存储大小**: 每个快照 500KB - 2MB
- **支持页面**: 95% 的常见网站

## 📝 开发进度

### ✅ Phase 1: Chrome 插件核心功能（已完成）
- [x] 页面提取器
- [x] Popup UI
- [x] 本地存储
- [x] 预览功能
- [x] 下载功能
- [x] 历史记录

### ✅ Phase 2: AI 分析功能（已完成）
- [x] AI 模型管理（多模型配置）
- [x] 设置页面（完整的选项配置）
- [x] 批量分析（按域名批量处理）
- [x] Markdown 报告生成
- [x] 任务队列系统
- [x] **提示词模板管理** ⭐️ 新增
  - [x] 多模板版本管理
  - [x] 可编辑提示词内容
  - [x] 模板快速切换
  - [x] 模板复制和删除

### 🔄 Phase 3: 优化与完善（进行中）
- [x] 添加插件图标
- [x] 优化错误处理
- [ ] 性能优化
- [ ] 国际化支持
- [ ] 更多 AI 模型支持

### 📅 Phase 4: Next.js 后台（计划中）
- [ ] 用户认证系统
- [ ] 云端存储
- [ ] 高级 AI 分析
- [ ] 团队协作功能
- [ ] 数据可视化

## 🎯 使用场景

### 适用场景
- ✅ 收集设计灵感
- ✅ 学习优秀网站设计
- ✅ AI 驱动的设计分析（⭐️ 新增）
- ✅ 自定义分析模板（⭐️ 新增）
- ✅ 保存页面快照
- ✅ 离线查看网页
- ✅ 批量分析网站（⭐️ 新增）
- ✅ 生成设计分析报告

### 典型工作流程 ⭐️
1. **配置 AI 模型**：在设置页面添加你的 AI API 密钥
2. **创建提示词模板**：根据需求创建专用分析模板
   - 例如：电商网站分析模板、SaaS 产品分析模板
3. **提取页面**：访问目标网站，点击提取按钮
4. **自动分析**：AI 自动生成详细的设计分析报告
5. **查看报告**：在历史记录中查看 Markdown 格式报告
6. **批量处理**：对同一域名下的多个页面批量分析

### 不适用场景
- ❌ 需要 JavaScript 交互的页面
- ❌ 需要登录的私密内容
- ❌ 实时更新的数据
- ❌ 视频/音频流媒体

## 🐛 已知限制

1. **跨域资源**: 某些跨域的 CSS/图片可能无法提取
2. **动态内容**: JavaScript 动态生成的内容可能不完整
3. **大型页面**: 超过 10MB 的页面可能较慢
4. **特殊页面**: chrome:// 等特殊页面无法提取

## 📖 文档

- 安装与使用：见本文档"安装插件"与"本地安装详细指南"章节
- 更多文档：见 `docs/` 目录
## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 最新更新 ⭐️
**v3.0 (2025-11-27)**
- ✅ 新增提示词模板管理系统
- ✅ 支持多版本模板保存
- ✅ 可编辑提示词内容
- ✅ 模板快速切换功能
- ✅ 优化批量分析流程
- ✅ 改进历史记录展示

### 可以改进的方向
1. 添加更多 AI 模型支持（Claude、Gemini 等）
2. 优化提取算法（更好的 CSS 提取）
3. 改进 UI/UX（更现代化的界面）
4. 添加更多分析维度
5. 支持导出为多种格式（PDF、JSON 等）
6. 添加提示词模板市场
7. 完善文档和教程

## 📄 许可证

MIT License

## 👨‍💻 作者

**GalaxyXieyu**

- 版本: 3.0.0
- 更新日期: 2025-11-27

---

## 🎉 立即开始

```bash
# 1. 进入插件目录
cd chrome-extension

# 2. 在 Chrome 中加载插件
# chrome://extensions/ → 开发者模式 → 加载已解压的扩展程序

# 3. 开始使用！
# 访问任意网页，点击插件图标，提取页面风格
```

**插件端零依赖，开箱即用！** 🚀
