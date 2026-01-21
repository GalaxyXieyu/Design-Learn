# Design-Learn 冗余梳理与共享模块改造方案

目标：以 MCP 启动为主线，统一数据目录；抽取重复逻辑为共享模块，降低维护成本；不合并 `Agents.md` 与 `CLAUDE.md`（不同 agent 使用）。

## 一、当前冗余点与影响

### 1) 数据目录重复落盘
- 现象：仓库内存在 `data/` 与 `server/data/` 两套数据库。
- 原因：不同入口的默认数据目录不一致（MCP stdio 默认 `~/.design-learn/data`，其他入口可能走 `process.cwd()/data`）。
- 影响：同一数据被分裂到不同目录，MCP 与 HTTP/脚本看到的数据不一致。

涉及文件：
- `server/src/stdio.js`（默认 `~/.design-learn/data`）
- `server/src/storage/paths.js`（`resolveDataDir` 仍是 `process.cwd()/data`）
- `scripts/verify-backend.sh`（调用 `createStorage()` 默认落在 cwd）

### 2) 路由扫描逻辑重复
- `server/src/server.js` 内部实现一套路由扫描与 sitemap 解析。
- `scripts/lib/route-scanner.js` 有另一套 Playwright 扫描 + sitemap 解析。
- `chrome-extension/content/route-scanner.js` 还有一套内容脚本版本。

影响：规则更新、过滤逻辑、排序策略不一致，容易出现结果差异。

### 3) 页面提取器重复
- `scripts/lib/extractor.js`（Playwright 版本）与 `chrome-extension/content/extractor.js`（Content Script 版本）存在重复。

影响：快照字段/细节差异导致后续 AI 分析或服务端存储不一致。

### 4) AI 分析器重复
- `scripts/lib/ai-analyzer.js` 与 `chrome-extension/lib/ai-analyzer.js` 各自维护一套配置加载、token 估算、提示词构建逻辑。

影响：输出风格/字段差异，排查问题困难。

## 二、改造总策略

### 核心原则
- 以 **MCP 启动的数据目录**为唯一默认值，其他入口全部对齐。
- 抽取 **纯逻辑** 为共享模块，平台相关（Chrome/Node）只保留薄适配层。
- 保持 **Chrome 扩展零依赖**，不引入构建工具。
- **不合并** `Agents.md` 与 `CLAUDE.md`（不同 agent 使用）。

### 共享模块建议目录（不新增构建）
建议新增 `shared/` 目录，放置“纯逻辑”文件（无 Node/Chrome API 依赖）。

```
shared/
├── dom/
│   ├── extractor-core.js        # DOM 侧 HTML/CSS/资源提取逻辑
│   └── route-scan-core.js       # DOM 侧链接/导航提取 + 过滤/排序
├── sitemap/
│   └── sitemap-parser.js        # sitemap XML 解析 -> routes
└── ai/
    ├── token-estimate.js        # token 估算
    └── prompt-builder.js        # prompt 组装/裁剪策略
```

## 三、具体修改点与原因

### A. 统一数据目录（以 MCP 为主）

**目标**：无论从哪里启动，默认都落在 `~/.design-learn/data`。

改动建议：
1. `server/src/storage/paths.js`
   - 修改 `resolveDataDir()` 默认值为 `~/.design-learn/data`。
   - 原因：`createStorage()` 被多处直接调用，统一默认值可以彻底消除分裂。
2. `scripts/verify-backend.sh`
   - 在脚本开头统一设置 `DESIGN_LEARN_DATA_DIR=~/.design-learn/data`，确保验证脚本读取同一数据。
3. `README.md`
   - 补充“数据目录说明”，强调 MCP 为主目录与 `DESIGN_LEARN_DATA_DIR` 可覆盖。

### B. 抽取路由扫描共享逻辑

**目标**：统一路由扫描的过滤/排序/分组策略，避免三套逻辑分叉。

改动建议：
1. 新增 `shared/dom/route-scan-core.js`
   - 仅包含 DOM 层逻辑：抓取链接、导航区链接、过滤/排序。
2. 新增 `shared/sitemap/sitemap-parser.js`
   - 解析 sitemap XML（DOMParser/regex 两种可兼容），输出 pathname 列表。
3. 更新 `chrome-extension/content/route-scanner.js`
   - 仅保留 Chrome 消息监听与页面环境调用，核心逻辑改为调用 shared。
4. 更新 `scripts/lib/route-scanner.js`
   - Playwright 的 `page.evaluate()` 调用 shared 逻辑，sitemap 解析复用 shared。
5. 更新 `server/src/server.js`
   - 保留 Playwright/HTTP 调度，但排序、过滤、sitemap 解析统一用 shared。

### C. 抽取页面提取器共享逻辑

**目标**：让 Playwright 与 Content Script 的快照结构一致。

改动建议：
1. 新增 `shared/dom/extractor-core.js`
   - 提取 HTML/CSS/资源/元数据的纯 DOM 逻辑（不含 Chrome/Node API）。
2. 更新 `chrome-extension/content/extractor.js`
   - 薄适配层：调用 shared 输出快照。
3. 更新 `scripts/lib/extractor.js`
   - `page.evaluate()` 直接执行 shared 的 DOM 逻辑。
4. `server/src/pipeline/index.js`
   - 继续走 `scripts/lib/extractor.js`，无感升级。

### D. 抽取 AI 分析器共享逻辑

**目标**：统一 token 估算、prompt 裁剪、消息结构。

改动建议：
1. 新增 `shared/ai/token-estimate.js`
   - 当前两端都在做 token 估算，可复用。
2. 新增 `shared/ai/prompt-builder.js`
   - 统一 prompt 组合与超限裁剪策略。
3. 更新 `chrome-extension/lib/ai-analyzer.js`
   - 保留“从 Chrome storage 加载配置”的部分，其余调用 shared。
4. 更新 `scripts/lib/ai-analyzer.js`
   - 保留“从 env/CLI 加载配置”的部分，其余调用 shared。

## 四、迁移顺序（建议）

1. **统一数据目录**
   - 改 `server/src/storage/paths.js`
   - 改 `scripts/verify-backend.sh`
   - 更新 `README.md` 数据目录说明
2. **抽取 shared 目录（只写新文件）**
   - `shared/dom/extractor-core.js`
   - `shared/dom/route-scan-core.js`
   - `shared/sitemap/sitemap-parser.js`
   - `shared/ai/token-estimate.js`
   - `shared/ai/prompt-builder.js`
3. **接入 shared（保留旧接口）**
   - 先改 `scripts/lib/extractor.js` / `scripts/lib/route-scanner.js`
   - 再改 `chrome-extension/content/extractor.js` / `chrome-extension/content/route-scanner.js`
   - 再改 `server/src/server.js` / `chrome-extension/lib/ai-analyzer.js` / `scripts/lib/ai-analyzer.js`
4. **验证与对齐**
   - 对比快照结构字段、路由扫描结果、AI prompt 输出一致性
5. **删除冗余实现**
   - 删除旧逻辑中与 shared 重复的函数或文件段
   - 只保留薄适配层与入口逻辑

## 五、验证清单

- MCP 启动后，HTTP/VSCode/Chrome 使用同一数据源（无双数据库）。
- Playwright 与 Content Script 提取快照结构一致。
- 路由扫描结果在三端排序/过滤一致。
- AI 分析的 prompt/裁剪策略一致。

## 六、不做事项（明确约束）

- 不合并 `Agents.md` 与 `CLAUDE.md`（不同 agent 使用）。
- 暂不引入构建系统（保持插件零依赖）。
