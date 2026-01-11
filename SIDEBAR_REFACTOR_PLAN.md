# Sidebar 插件代码拆分与复用建议（分析 + 方案）

> 目标：把侧边栏相关代码拆成可复用、职责清晰的模块；每个文件不超过 800 行；保持“本地优先 / 服务器可选 / 静默降级”的现有行为。

## 1. 现状快速盘点

**主要文件**
- `vscode-extension/src/webview/SidebarPanel.ts`（约 1793 行）
- `vscode-extension/media/sidebar/main.js`（约 743 行）
- `vscode-extension/media/sidebar/sidebar.js`（约 245 行，当前 `index.html` 未引用，疑似旧版本）
- `vscode-extension/media/sidebar/index.html`, `styles.css`

**SidebarPanel.ts 当前职责混杂**
- Webview 初始化与 HTML 注入
- 消息分发（`onDidReceiveMessage`）
- 服务端 API 请求（`_serverRequest` / `_checkServerStatus`）
- 设计列表加载 + AI 任务状态合并
- AI 分析流程（含 job 轮询 & 设计更新）
- URL 规范化 / Snapshot 映射
- 本地快照读写 + UI 操作（复制、删除、查看）
- 模型配置读写（VSCode config）
- 全局轮询控制

**main.js 当前职责混杂**
- 全局状态管理（models、designs、routes、UI 模式、路由缓存）
- UI 渲染（历史列表、模型列表、弹窗、设置、配置表单）
- 全局事件绑定（按钮、列表、弹窗）
- 过滤、排序、格式化
- 与 extension 的消息通信

**潜在问题**
- 单文件过大，修改时认知成本高。
- 多处逻辑重复（URL 正规化、状态映射）。
- UI 事件和渲染深度耦合，难以复用或单元化。
- `SidebarPanel.ts` 中保留了 `_getHtmlForWebview_OLD` 大段字符串，且不会被调用，徒增体积。

## 2. 拆分目标

1. **每个文件 < 800 行**；核心类不再“一把梭”。
2. **解耦三层职责**：
   - Extension 后端（Node）逻辑
   - Webview UI 层逻辑
   - 纯工具层（格式化、转换、状态映射）
3. **复用优先**：抽出公共工具与服务，减少重复逻辑。
4. **不破坏现有行为**：接口/消息协议保持兼容。

## 3. 推荐拆分结构（建议稿）

### 3.1 Extension 侧（TypeScript）

```
vscode-extension/src/webview/
  SidebarPanel.ts                # 保留 WebviewViewProvider 外壳（精简到 200-300 行）
  messageRouter.ts               # 处理 message.type -> handler 的映射
  services/
    serverClient.ts              # 统一 HTTP 请求封装（动态 require http）
    designService.ts             # /api/designs + /api/versions + AI meta 更新
    importService.ts             # /api/import/url + /api/scan-routes + 批量导入
    aiAnalysisService.ts         # AIAnalyzer 触发逻辑 + pending jobs 管理
    snapshotService.ts           # 本地 snapshots 读写/删除/打开/复制
    modelService.ts              # VSCode config 模型读写
    configService.ts             # extraction/analysis 配置读写
    pollingService.ts            # design 轮询控制
  utils/
    url.ts                        # normalizeUrlInput / encode helpers
    snapshotMapper.ts            # server snapshot -> AIAnalyzer Snapshot
    webview.ts                    # postMessage wrapper / 类型
  types/
    webviewMessages.ts            # message type 常量 + payload 类型
```

**拆分要点**
- `SidebarPanel.ts` 只负责：
  - 初始化 webview
  - 注入 HTML
  - 创建 router & services
- `messageRouter.ts`：
  - 将 `message.type` 映射到对应 service 的方法
  - 统一处理异常（静默降级）
- `serverClient.ts`：
  - 集中处理 `_serverRequest` 和 `_checkServerStatus`
  - 避免顶层 `import * as http from 'http'`，在函数内 `require('http')`
- `aiAnalysisService.ts`：
  - 管理 `_pendingAiJobs` + `_analysisInFlight`
  - 与 `designService` 协作更新元数据

### 3.2 Webview 侧（JS/CSS/HTML）

```
vscode-extension/media/sidebar/
  index.html
  styles.css
  main.js                         # 入口，只做初始化和模块拼装
  state/
    store.js                      # 全局 state + setters
  ui/
    historyList.js                # 设计列表渲染 + 分组折叠 + 过滤排序
    models.js                     # 模型列表 + 模态框 UI
    settings.js                   # 右上角设置 UI
    serverModal.js                # 服务器配置 modal
  handlers/
    events.js                     # 事件绑定与委托
    messages.js                   # 与 extension 的 message 通信
  utils/
    format.js                     # progress/status/error 文案
    url.js                        # normalizeUrlInput / normalizeBaseUrlKey
    dom.js                        # 常用 DOM helpers
```

**拆分要点**
- `main.js` 只做：`import/init`（或在无模块环境下顺序加载）
- `events.js` 处理所有 UI 事件，不在 HTML 字符串里塞 `onclick`
- `historyList.js` 专注列表渲染与筛选逻辑
- `models.js` 处理模型管理 UI（弹窗、列表渲染、编辑状态）
- `messages.js` 处理 `window.addEventListener('message')` 与 `vscode.postMessage`

> 如果不引入 bundler，可在 `index.html` 里按顺序引入多个 `script`。每个文件保持 200~400 行以内。

## 4. 拆分步骤（推荐执行顺序）

### Step 1: “无风险瘦身”
- 删除或迁出 `SidebarPanel.ts` 中的 `_getHtmlForWebview_OLD`（当前未被调用）。
- 这一步即可显著缩短文件体积，降低后续拆分成本。

### Step 2: 抽工具层（最稳）
- 把 `normalizeUrlInput`、`_toAnalyzerSnapshot`、`format/label mapping` 抽成工具函数。
- 把 `_serverRequest` 抽到 `serverClient.ts`，后续其他服务直接复用。

### Step 3: 拆服务层（功能拆分）
- 以功能维度划分 service：
  - `DesignService`：设计列表加载/删除/查看
  - `ImportService`：URL 导入/扫描路由/批量导入
  - `AiAnalysisService`：AI 分析流程 & 状态更新
  - `SnapshotService`：本地快照 CRUD
  - `ConfigService / ModelService`
- `SidebarPanel` 只保留路由器 + service 初始化

### Step 4: 拆 Webview UI 逻辑
- `main.js` 只做初始化
- `historyList.js` 负责渲染 & 过滤
- `models.js` 负责模型配置 UI
- `settings.js` / `serverModal.js` 负责弹窗 & 配置

### Step 5: 统一消息协议
- 定义 `types/webviewMessages.ts`（TS） + `media/sidebar/messages.js`（JS）
- 统一 message payload 格式，减少 hardcode string

### Step 6: 删除旧文件 + 校验
- 确认 `sidebar.js` 未被引用后移除
- 手动测试：导入、AI 分析、轮询、配置、历史筛选

## 5. 拆分后的代码结构（落地样例）

```
vscode-extension/src/webview/
  SidebarPanel.ts
  messageRouter.ts
  services/
    serverClient.ts
    designService.ts
    importService.ts
    aiAnalysisService.ts
    snapshotService.ts
    modelService.ts
    configService.ts
    pollingService.ts
  utils/
    url.ts
    snapshotMapper.ts
    webview.ts
  types/
    webviewMessages.ts

vscode-extension/media/sidebar/
  index.html
  styles.css
  main.js
  state/
    store.js
  ui/
    historyList.js
    models.js
    settings.js
    serverModal.js
  handlers/
    events.js
    messages.js
  utils/
    format.js
    url.js
    dom.js
```

## 6. 细节建议（避免踩坑）

- **保持“本地优先，服务器可选”**：请求失败要静默降级，避免阻断 UI。
- **避免 inline onclick**：从 HTML 拼接中移除 `onclick`，改用 event delegation。
- **AI 任务状态**：`DesignService` 只负责加载/合并状态，`AiAnalysisService` 执行分析，职责分离。
- **共享状态**：Webview 端用简单 store 管理 `models/designs/routes`，避免全局变量散落。
- **模块化脚本加载顺序**：`utils` → `state` → `ui` → `handlers` → `main`。

## 7. 验收清单（改造时使用）

- [ ] URL 导入 & AI 分析流程完整
- [ ] 路由扫描与批量导入正常
- [ ] 设计列表刷新与轮询正常
- [ ] 模型配置弹窗可用、保存生效
- [ ] 服务器状态检测正常
- [ ] 配置开关保存生效
- [ ] 本地快照打开/删除/复制无回归

---

如果你确认方案方向，我可以按这个结构逐步重构。建议先做 Step 1 + Step 2（风险最低），然后再分模块拆 UI。
