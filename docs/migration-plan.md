# 现有实现盘点与迁移策略

## 盘点范围

- Chrome Extension：采集与上报路径
- VSCode Extension：管理 UI 与本地服务启动
- scripts：Playwright 批处理与提取脚本

## 模块复用/淘汰清单

### Chrome Extension

**复用**
- `chrome-extension/content/extractor.js`：页面静态资源提取逻辑
- `chrome-extension/background/task-manager.js`：任务队列与进度管理
- `chrome-extension/options/*`：配置 UI 与本地配置存储

**淘汰/降级**
- `chrome-extension/popup/*.bak`：历史备份文件，保持只读归档
- 本地 AI 分析与 Markdown 导出：迁移为可选/默认关闭（服务侧处理）

### VSCode Extension

**复用**
- `vscode-extension/src/webview/*`：管理 UI 入口
- `vscode-extension/src/extension.ts`：命令与面板注册

**淘汰/降级**
- `vscode-extension/src/extractor.ts` 仅作为本地兜底，不作为默认采集路径

### scripts

**复用**
- `scripts/lib/extractor.js`：Playwright 提取逻辑（服务端可选调用）
- `scripts/batch-process.js`：批量提取脚本（保留离线能力）

**淘汰/降级**
- `scripts/node_modules` 不纳入服务端运行时依赖，避免耦合

## 迁移分支策略

- `main`：稳定分支，仅合并已验证的 MVP 与迭代功能。
- `release/mvp`：MVP 集成分支，集中处理服务端/客户端联调。
- `feature/*`：单一主题分支（例如 `feature/client-sync`）。

## 回滚路径

1. 关键发布前对 `main` 打标签（例如 `pre-mvp-YYYYMMDD`）。
2. 数据回滚：备份 `design-learn-server/data/` 与 `data/` 目录。
3. 客户端回滚：保留旧版扩展构建产物与 manifest 版本号。

## 兼容性与风险标注

- better-sqlite3 依赖编译环境，迁移前需验证构建链路。
- Playwright 为可选依赖，服务端需明确缺省行为与错误提示。
