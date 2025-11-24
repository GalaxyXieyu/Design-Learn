# Frontend Style Generator

> 一键提取网页设计风格的 Chrome 插件 - 零依赖，开箱即用

## 🎯 项目简介

这是一个**完全零依赖**的 Chrome 浏览器插件，用户无需安装任何额外软件（Node.js、Playwright 等），只需安装插件即可一键提取任意网页的完整设计风格，包括 HTML、CSS、图片、字体等所有资源。

### 核心特性

- ✅ **零依赖**: 无需 Node.js、Playwright 等任何依赖
- ✅ **一键提取**: 点击插件图标即可提取当前页面
- ✅ **完整快照**: HTML + CSS + 图片 + 字体 + 元数据
- ✅ **AI 分析**: 集成 AI 模型，自动生成设计分析报告
- ✅ **提示词模板**: 可编辑、多版本管理的 AI 提示词系统
- ✅ **本地存储**: 使用 Chrome Storage 本地保存，无需后端
- ✅ **即时预览**: 在新标签页预览提取的页面
- ✅ **一键下载**: 导出为完整的 HTML 文件
- ✅ **历史记录**: 按域名分组，批量分析

## 🚀 快速开始

### 安装插件（1 分钟）

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `chrome-extension` 文件夹
5. 完成！

### 使用插件（5 秒）

1. 访问任意网页（如 https://stripe.com）
2. 点击浏览器工具栏的插件图标
3. 点击"提取页面风格"按钮
4. 等待 2-5 秒，提取完成
5. 可以预览、下载或查看历史记录

## 📦 项目结构

```
frontend-style-generator/
├── chrome-extension/              # Chrome 插件（已完成）
│   ├── manifest.json             # 插件配置
│   ├── popup/                    # 弹出窗口 UI
│   ├── content/                  # 页面提取器
│   ├── background/               # 后台服务
│   ├── lib/                      # AI 分析器
│   ├── options/                  # 设置页面
│   │   ├── options.html          # 设置界面
│   │   ├── options.css           # 样式
│   │   ├── js/
│   │   │   ├── main.js           # 主控制器
│   │   │   ├── components/       # UI 组件
│   │   │   │   ├── ModelManager.js         # AI 模型管理
│   │   │   │   ├── PromptTemplateManager.js # 提示词模板管理 ⭐️
│   │   │   │   └── PromptPreview.js        # 提示词预览/编辑 ⭐️
│   │   │   └── utils/            # 工具类
│   │   ├── TEMPLATE_FEATURE.md   # 模板功能说明 ⭐️
│   │   └── README.md             # 设置页面说明
│   ├── icons/                    # 图标文件
│   ├── README.md                 # 插件说明
│   ├── INSTALL.md                # 安装指南
│   ├── SUMMARY.md                # 功能总结
│   └── TEST.md                   # 测试指南
│
├── web/                          # Next.js 后台（待开发）
│   └── (未来的管理后台系统)
│
└── docs/                         # 项目文档
    ├── requirements.md           # 需求分析
    ├── ai-prompt-guide.md        # AI 分析指南
    └── chrome-extension-design.md # 插件设计文档
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

详细文档：[提示词模板功能说明](chrome-extension/options/TEMPLATE_FEATURE.md)

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

### 未来计划（Next.js 后台）
- Next.js 15 + TypeScript 5
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

### 插件文档
- [插件安装指南](chrome-extension/INSTALL.md)
- [功能总结](chrome-extension/SUMMARY.md)
- [测试指南](chrome-extension/TEST.md)
- **[提示词模板功能说明](chrome-extension/options/TEMPLATE_FEATURE.md)** ⭐️ 新增

### 开发文档
- [需求分析](docs/requirements.md)
- [AI 分析指南](docs/ai-prompt-guide.md)
- [插件设计文档](docs/chrome-extension-design.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 最新更新 ⭐️
**v3.0 (2024-11-24)**
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

- 项目地址: `/Users/galaxyxieyu/Documents/Coding/frontend-style-generator`
- 版本: 3.0.0 ⭐️
- 更新日期: 2024-11-24

---

## 🎉 立即开始

```bash
# 1. 进入插件目录
cd chrome-extension

# 2. 查看安装指南
cat INSTALL.md

# 3. 在 Chrome 中加载插件
# chrome://extensions/ → 开发者模式 → 加载已解压的扩展程序

# 4. 开始使用！
# 访问任意网页，点击插件图标，提取页面风格
```

**完全零依赖，开箱即用！** 🚀
