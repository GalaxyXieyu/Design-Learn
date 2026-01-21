# CLAUDE.md

> Claude Code guidance for Design-Learn repository

## TODO

- [ ] **集成 ui-uxpro** - 将 ui-uxpro 项目整合到 Design-Learn 系统中
  - [ ] 评估 ui-uxpro 的核心功能和 API
  - [ ] 设计集成架构（作为独立模块 or 合并到现有组件）
  - [ ] 实现数据格式兼容
  - [ ] 更新 MCP tools 支持 ui-uxpro 功能

---

## Quick Start

```bash
# Server
cd server && npm install
node src/server.js                    # HTTP server (port 3100)
node src/stdio.js                     # MCP stdio mode

# VSCode Extension
cd vscode-extension && npm install
npm run compile                       # Build
# Press F5 in VSCode for dev mode

# Chrome Extension
# Load unpacked from chrome://extensions/
```

---

## Project Overview

Design-Learn 是一个 Web 设计提取和分析系统，包含三个主要组件：

| 组件 | 描述 | 技术栈 |
|------|------|--------|
| Chrome Extension | 浏览器插件，提取页面快照 | Manifest V3, 零依赖 |
| VSCode Extension | 管理 UI 和服务器启动器 | TypeScript, Webview |
| Design-Learn Server | 后端服务，REST API + MCP | Node.js, SQLite |

---

## Architecture

### System Diagram

```
Chrome Extension ──┐
                   ├──> HTTP API (port 3100)
VSCode Extension ──┤    - /api/health
                   │    - /api/import/*
Claude Code ───────┘    - /mcp (SSE)
                        - /api/designs
                        - /api/tasks

                   Design-Learn Server
                   (SQLite + File Storage)
```

### Data Flow

1. **Browser Extraction**: Chrome extension → `/api/import/browser`
2. **Server Processing**: Pipeline → SQLite + file system
3. **MCP Access**: Claude Code → MCP tools
4. **VSCode Management**: Server lifecycle + UI

### Storage

| 类型 | 路径 | 用途 |
|------|------|------|
| SQLite | `data/database.sqlite` | 元数据、索引 |
| File System | `data/designs/` | JSON、快照、组件代码 |

---

## Development

### Server

```bash
cd server
npm install
npm rebuild better-sqlite3           # 如需重建原生模块

# 启动方式
node src/server.js                    # HTTP server
PORT=3200 node src/server.js          # 自定义端口
node src/cli.js                       # CLI 模式
node src/stdio.js                     # MCP stdio 模式
```

### VSCode Extension

```bash
cd vscode-extension
npm install
npm run compile                       # 编译
npm run watch                         # 监听模式

# 打包安装
npx vsce package --out ../dist/design-learn-1.0.2.vsix
code --install-extension ../dist/design-learn-1.0.2.vsix --force
```

> **CRITICAL**: 安装后必须完全退出 VSCode (Cmd+Q)，否则会使用缓存的旧代码

**推荐开发方式**: 按 F5 启动 Extension Development Host

### Chrome Extension

无需构建，直接加载：
1. `chrome://extensions/` → 开发者模式
2. 加载已解压的扩展程序 → 选择 `chrome-extension/`

### Testing

```bash
./scripts/verify-backend.sh           # 后端验证
curl http://localhost:3100/api/health # 健康检查
```

---

## MCP Integration

### Setup

```bash
cd server && npm install
claude mcp add -s user design-learn -- node /YOUR/PATH/Design-Learn/server/src/stdio.js
claude mcp list
```

### Available Tools

| Tool | 描述 |
|------|------|
| `ping` | 健康检查 |
| `list_designs` | 列出所有设计 |
| `search_designs` | 按关键词/标签/URL 搜索 |
| `get_design` | 获取设计详情 |
| `get_rules` | 获取设计规则 |
| `list_versions` / `get_version` | 版本管理 |
| `list_components` / `get_component` | 组件访问 |

---

## Key Files

### Server Entry Points

| 文件 | 用途 |
|------|------|
| `src/server.js` | HTTP/WebSocket/MCP 主入口 |
| `src/stdio.js` | MCP stdio 传输 |
| `src/cli.js` | CLI 接口 |

### Core Modules

- **MCP Tools**: [server/src/mcp/index.js](server/src/mcp/index.js)
- **Storage**: [server/src/storage/index.js](server/src/storage/index.js)
- **Pipeline**: [server/src/pipeline/index.js](server/src/pipeline/index.js)

---

## Environment Variables

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `PORT` / `DESIGN_LEARN_PORT` | 3100 | 服务器端口 |
| `DESIGN_LEARN_DATA_DIR` | `./data` | 数据目录 |
| `MCP_SERVER_NAME` | design-learn | MCP 服务器名称 |
| `MCP_AUTH_TOKEN` | - | MCP 认证令牌（可选） |

---

## VSCode Extension 开发规范

> **CRITICAL**: 以下规范来自实际踩坑经验

### 开发流程

1. **使用 Extension Development Host** - 按 F5 启动，修改后 Cmd+R 重载
2. **版本号递增** - 每次打包必须递增版本号
3. **完全重启** - 安装后 Cmd+Q 完全退出再打开

### TypeScript 规范

```typescript
// ❌ 错误 - 顶层 import 可能在 webview 环境出问题
import * as http from 'http';

// ✅ 正确 - 运行时动态加载
private async _checkServerStatus() {
  const http = require('http');
}
```

```typescript
// ✅ 正确 - 独立加载，互不阻塞
private _loadData() {
  setImmediate(() => {
    this._loadModels();
    this._loadSnapshots();
    this._loadTasks();        // 失败静默
  });
}

// ❌ 错误 - 服务器请求失败会阻断后续
private async _loadData() {
  await this._checkServerStatus(); // 失败抛异常
  this._loadSnapshots();           // 永远执行不到
}
```

### 架构原则

- **本地优先**: 快照、配置从本地读取
- **服务器可选**: 服务器失败不影响基础功能
- **静默降级**: 网络请求失败返回空数据

### Webview 安全规范

```typescript
// ❌ 错误 - 违反 CSP
'<button onclick="handleClick()">Click</button>'

// ✅ 正确 - 使用 data 属性 + addEventListener
'<button data-action="test" data-id="' + id + '">Test</button>'

container.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (btn?.dataset.action === 'test') {
    testModel(btn.dataset.id);
  }
});
```

---

## Common Tasks

### 添加新 MCP Tool

1. 在 `src/mcp/index.js` 的 `tools` 对象中定义 schema
2. 在 `createToolHandlers()` 中实现 handler
3. 调用 `server.registerTool(toolName, schema, handler)`

### 添加新 REST Endpoint

1. 在 `src/server.js` 中添加路由处理函数
2. 在 `handleRequest()` 中添加路由逻辑
3. 更新 `handleRoot()` 中的文档

### 调试服务器

```bash
sqlite3 data/database.sqlite          # 检查数据库
ls -la data/designs/                  # 检查文件存储
curl http://localhost:3100/api/health # 测试端点
```

---

## Project Structure

```
Design-Learn/
├── chrome-extension/     # 浏览器插件（零依赖）
├── vscode-extension/     # VSCode 扩展
├── server/  # 后端服务
├── data/                 # 数据存储
│   ├── database.sqlite
│   └── designs/
└── scripts/              # 工具脚本
```

**注意**: 无根目录 package.json，各组件独立管理依赖
