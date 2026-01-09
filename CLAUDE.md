# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Design-Learn is a web design extraction and analysis system with three main components:
1. **Chrome Extension** - Zero-dependency browser plugin for extracting page snapshots (HTML/CSS/images/fonts)
2. **VSCode Extension** - Management UI and local server launcher
3. **Design-Learn Server** - Node.js backend providing REST API, MCP tools, and data storage

The system enables users to capture web design snapshots, analyze them with AI, and manage design resources through multiple interfaces.

## Architecture

### Multi-Client Single-Server Model

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

1. **Browser Extraction**: Chrome extension captures page snapshot → sends to `/api/import/browser`
2. **Server Processing**: Extraction pipeline processes snapshot → stores in SQLite + file system
3. **MCP Access**: Claude Code queries designs via MCP tools (`list_designs`, `get_design`, etc.)
4. **VSCode Management**: VSCode extension manages server lifecycle and displays snapshots

### Storage Architecture

- **SQLite Database** (`data/database.sqlite`): Metadata for designs, versions, components, rules, tasks
- **File System** (`data/designs/`): JSON metadata, styleguides, snapshots, component code
- **Hybrid Approach**: SQLite for queries, files for large content

## Development Commands

### Server Development

```bash
# Install dependencies (must be in design-learn-server directory)
cd design-learn-server
npm install

# Rebuild native modules if needed
npm rebuild better-sqlite3

# Start server (default port 3100)
node design-learn-server/src/server.js

# Start with custom port
PORT=3200 node design-learn-server/src/server.js

# Start via CLI
node design-learn-server/src/cli.js

# MCP stdio mode (for Claude Code integration)
node design-learn-server/src/stdio.js
```

### VSCode Extension Development

```bash
cd vscode-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Package extension (warnings about LICENSE and file count are expected and can be ignored)
npx vsce package --out ../dist/design-learn-1.0.2.vsix

# Install extension
code --install-extension ../dist/design-learn-1.0.2.vsix --force

# CRITICAL: VSCode caches webview content. After reinstalling:
# 1. Completely quit VSCode (Cmd+Q on macOS, not just close window)
# 2. Reopen VSCode
# 3. Failure to do this will result in old cached code running

# Development mode (recommended for testing - no need to package)
# 1. Open vscode-extension folder in VSCode
# 2. Press F5 to launch Extension Development Host
# 3. Test in the new window, set breakpoints in original window
```

### Chrome Extension Development

No build step required - load directly in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension/` directory

### Testing & Verification

```bash
# Backend verification (from repository root)
./scripts/verify-backend.sh

# Custom port verification
PORT=3100 ./scripts/verify-backend.sh

# Manual API testing
curl http://localhost:3100/api/health
curl http://localhost:3100/api/designs
```

## Key Technical Patterns

### Server Entry Points

- **HTTP Server** (`src/server.js`): Main entry point, handles all HTTP/WebSocket/MCP traffic
- **MCP Stdio** (`src/stdio.js`): Stdio transport for Claude Code MCP integration
- **CLI** (`src/cli.js`): Command-line interface for server management

### MCP Tool Implementation

MCP tools are defined in [design-learn-server/src/mcp/index.js](design-learn-server/src/mcp/index.js):

```javascript
// Tool registration pattern
server.registerTool(toolName, schema, handler);

// Available tools:
// - ping: Health check
// - list_designs: List all designs with optional limit
// - search_designs: Search by keyword/tags/URL
// - get_design: Fetch design metadata by ID
// - get_rules: Fetch version rules (colors/typography/spacing)
// - list_versions, get_version: Version management
// - list_components, get_component, get_component_preview: Component access
```

### Storage Layer Pattern

Storage operations follow a consistent pattern in [design-learn-server/src/storage/index.js](design-learn-server/src/storage/index.js):

```javascript
// 1. Normalize input data
const design = normalizeDesign(input);

// 2. Write to file system
await writeJson(designPath, design);

// 3. Insert/update SQLite metadata
db.prepare('INSERT INTO designs ...').run(...);

// 4. Update indexes
await writeDesignIndex(db, dataDir);
```

### Extraction Pipeline

The extraction pipeline ([design-learn-server/src/pipeline/index.js](design-learn-server/src/pipeline/index.js)) handles:
- Job queue management with status tracking
- SSE progress streaming to clients
- Browser import (from Chrome extension)
- URL import (with optional Playwright for server-side extraction)

### Task Management System

Task management API ([design-learn-server/src/server.js](design-learn-server/src/server.js:361-473)):
- Create tasks for URL extraction
- Track status: pending → running → completed/failed
- Group tasks by domain
- Retry failed tasks
- Clear completed tasks

## Important Constraints

### Port Management

- **Default Port**: 3100 (configurable via `PORT` or `DESIGN_LEARN_PORT` env vars)
- **Port Conflict Handling**: Server attempts to kill existing processes on port before starting
- **Auto-detection**: Chrome extension auto-detects local server at `localhost:3100`

### Playwright Dependency

- **Optional**: Playwright is NOT required for basic operation
- **Used For**: Server-side URL extraction (`/api/import/url`) and route scanning (`/api/scan-routes`)
- **Fallback**: Returns `playwright_not_installed` error if not available
- **Installation**: `npm install playwright` in `design-learn-server/` if needed

### Database Schema

Key tables in SQLite:
- `designs`: Design metadata with JSON stats/metadata columns
- `versions`: Version tracking with file paths to styleguides/rules/snapshots
- `components`: Component metadata with code paths
- `rules`: Design rules (colors, typography, spacing)
- `tasks`: Task queue for extraction jobs

### File Path Conventions

All file paths use helper functions from [design-learn-server/src/storage/paths.js](design-learn-server/src/storage/paths.js):
- `getDesignDir(dataDir, designId)` → `data/designs/{designId}/`
- `getVersionDir(dataDir, designId, versionNumber)` → `data/designs/{designId}/versions/{versionNumber}/`
- `getComponentCodePath(...)` → `data/designs/{designId}/versions/{versionNumber}/components/{componentId}/code.json`

## Chrome Extension Architecture

### Component Structure

- **Manifest V3**: Uses Service Worker instead of background pages
- **Content Script** ([chrome-extension/content/extractor.js](chrome-extension/content/extractor.js)): Injected into pages for DOM extraction
- **Service Worker** ([chrome-extension/background/service-worker.js](chrome-extension/background/service-worker.js)): Background task coordination
- **Popup** ([chrome-extension/popup/](chrome-extension/popup/)): User interface for extraction
- **Options** ([chrome-extension/options/](chrome-extension/options/)): Settings and configuration UI

### Key Features

- **Zero Dependencies**: No build process, runs directly in browser
- **Local Storage**: Uses Chrome Storage API and IndexedDB
- **AI Integration**: Built-in AI analyzer with customizable prompt templates
- **Server Sync**: Optional sync to local Design-Learn server

## VSCode Extension Architecture

### Main Components

- **Extension Entry** ([vscode-extension/src/extension.ts](vscode-extension/src/extension.ts)): Activation and command registration
- **Server Manager** ([vscode-extension/src/serverManager.ts](vscode-extension/src/serverManager.ts)): Lifecycle management for Design-Learn server
- **Sidebar Panel** ([vscode-extension/src/webview/SidebarPanel.ts](vscode-extension/src/webview/SidebarPanel.ts)): Main UI webview
- **Settings Panel** ([vscode-extension/src/webview/SettingsPanel.ts](vscode-extension/src/webview/SettingsPanel.ts)): Configuration UI

### Server Management

The VSCode extension can start/stop the Design-Learn server:
- Command: `Design-Learn: 启动/停止 Design-Learn 服务`
- Configuration: `designLearn.server` settings
- Auto-start: Configurable via `designLearn.server.autoStart`

### VSCode Extension 开发规范（重要教训）

**CRITICAL**: 以下规范来自实际踩坑经验，必须严格遵守。

#### 开发流程规范

1. **必须使用 Extension Development Host 测试**
   - 打开 `vscode-extension/` 文件夹
   - 按 F5 或 `Cmd+Shift+P` → `Debug: Start Debugging`
   - 在新窗口测试功能
   - 修改后按 `Cmd+R` 重新加载
   - **禁止**：每次改动都打包安装测试

2. **版本号管理**
   - 每次打包必须递增版本号（VSCode 不允许覆盖安装同版本）
   - 格式：`1.0.x` 递增 patch 版本

3. **安装后必须完全重启**
   - macOS: `Cmd+Q` 完全退出（不是关闭窗口）
   - 然后重新打开 VSCode/Cursor

#### TypeScript 代码规范

**http 模块加载**：
```typescript
// ❌ 错误 - 顶层 import 可能在 webview 环境出问题
import * as http from 'http';

// ✅ 正确 - 运行时动态加载
private async _checkServerStatus() {
  const http = require('http');
  // ...
}
```

**数据加载模式**：
```typescript
// ✅ 正确 - 独立加载，互不阻塞，任何一个失败不影响其他
private _loadData() {
  setImmediate(() => {
    this._loadModels();       // 本地配置
    this._loadSnapshots();    // 本地文件
    this._loadConfig();       // 本地配置
    this._loadTasks();        // 服务器请求（失败静默）
    this._checkServerStatus(); // 服务器检测（失败静默）
  });
}

// ❌ 错误 - 服务器请求失败会阻断后续加载
private async _loadData() {
  await this._checkServerStatus(); // 失败会抛异常
  this._loadSnapshots(); // 永远执行不到
}
```

**错误处理**：
```typescript
// ✅ 正确 - 网络请求失败静默处理，返回空数据
private async _loadTasks() {
  try {
    const result = await this._serverRequest(...);
    this._view?.webview.postMessage({ type: 'updateTasks', ...result });
  } catch {
    this._view?.webview.postMessage({ type: 'updateTasks', tasks: [] });
  }
}

// ❌ 错误 - 日志写入可能抛异常阻断流程
function log(msg: string) {
  fs.appendFileSync(LOG_FILE, msg); // 权限问题会抛异常
}
```

#### 架构原则

- **本地优先**：快照列表、模型配置从本地读取，不依赖服务器
- **服务器可选**：服务器功能失败不影响基础功能
- **静默降级**：网络请求失败返回空数据，不阻断 UI

### VSCode Webview Development Best Practices

**CRITICAL**: VSCode webviews have strict security requirements and specific patterns that must be followed to avoid common errors.

#### Common Pitfalls and Solutions

**1. Quote Escaping in HTML Template Strings**

❌ **BAD** - Causes "Failed to execute 'write' on 'Document'" error:
```typescript
'<button onclick="testModel(\\'' + id + '\\')">Test</button>'
```

✅ **GOOD** - Use data attributes + addEventListener:
```typescript
// In HTML generation
'<button data-action="test" data-id="' + id + '">Test</button>'

// In JavaScript (event delegation)
container.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (btn?.dataset.action === 'test') {
    testModel(btn.dataset.id);
  }
});
```

**2. Event Handling Patterns**

❌ **BAD** - Inline handlers violate CSP:
```html
<button onclick="handleClick()">Click</button>
<div onclick="document.getElementById('modal').classList.add('show')">Open</div>
```

✅ **GOOD** - Use addEventListener:
```javascript
// For static elements
document.getElementById('btn').addEventListener('click', handleClick);

// For dynamic content (event delegation)
document.getElementById('list').addEventListener('click', (e) => {
  const item = e.target.closest('[data-action]');
  if (!item) return;

  const action = item.dataset.action;
  const id = item.dataset.id;

  if (action === 'edit') editItem(id);
  else if (action === 'delete') deleteItem(id);
});
```

**3. Webview Caching Issues**

VSCode aggressively caches webview content. After installing a .vsix:

```bash
# CRITICAL: Must completely quit VSCode
# macOS: Cmd+Q (not just close window)
# Windows/Linux: File > Exit

# Then reopen VSCode
```

**Development Mode** (recommended):
1. Open `vscode-extension/` folder in VSCode
2. Press F5 to launch Extension Development Host
3. Changes reload automatically with breakpoint support

**4. Debugging Webview Issues**

Enable Developer Tools:
1. Open Command Palette (Cmd/Ctrl+Shift+P)
2. Run: "Developer: Open Webview Developer Tools"
3. Check Console for errors

Common errors:
- "Failed to execute 'write' on 'Document'" → Quote escaping issue
- "Refused to execute inline event handler" → CSP violation
- "togglePanel is not defined" → Script failed to load due to syntax error

**5. Best Practices Checklist**

HTML Generation:
- ✅ Use data attributes instead of inline event handlers
- ✅ Escape user-provided content
- ✅ Avoid mixing quote types in attributes
- ✅ Use template literals for readability

Event Handling:
- ✅ Use `addEventListener` exclusively
- ✅ Implement event delegation for dynamic content
- ✅ Expose functions to global scope only when necessary

Security:
- ✅ Never use inline `onclick`, `onload`, etc.
- ✅ Validate all user input before rendering
- ✅ Use CSP-compliant patterns

**6. Quick Reinstall Script**

Use the provided script for reliable reinstallation:
```bash
./scripts/reinstall-vscode-extension.sh
```

This script:
1. Compiles TypeScript
2. Deletes old .vsix
3. Packages new .vsix
4. Uninstalls old version
5. Installs new version
6. Restarts VSCode

**References**:
- [VSCode Webview Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [addEventListener vs onclick](https://stackoverflow.com/questions/6348494/addeventlistener-vs-onclick)
- [Webview Caching Issues](https://stackoverflow.com/questions/52712362/weird-caching-in-a-webview-vscode-extension)

## MCP Integration for Claude Code

### Configuration

Add to Claude Code MCP configuration:

```bash
# Install dependencies first
cd design-learn-server && npm install

# Add MCP server
claude mcp add -s user design-learn -- node /YOUR/PATH/Design-Learn/design-learn-server/src/stdio.js

# Verify
claude mcp list
```

### Available MCP Tools

When configured, Claude Code can use these tools:
- `ping`: Check server status
- `list_designs`: Browse stored designs
- `search_designs`: Search by keyword/tags/URL
- `get_design`: Fetch full design metadata
- `get_rules`: Access design system rules
- `list_versions`, `get_version`: Version history
- `list_components`, `get_component`: Component library access

### MCP Resources

- `design-learn://info`: Server metadata
- `design://{designId}`: Design metadata by ID

## Common Development Scenarios

### Adding a New MCP Tool

1. Define tool schema in [design-learn-server/src/mcp/index.js](design-learn-server/src/mcp/index.js) `tools` object
2. Implement handler in `createToolHandlers()` function
3. Register tool with `server.registerTool(toolName, schema, handler)`

### Adding a New REST Endpoint

1. Add route handler function in [design-learn-server/src/server.js](design-learn-server/src/server.js)
2. Add routing logic in `handleRequest()` function
3. Update root endpoint documentation in `handleRoot()`

### Extending Storage Schema

1. Update SQLite schema in [design-learn-server/src/storage/sqliteStore.js](design-learn-server/src/storage/sqliteStore.js)
2. Add normalization function in [design-learn-server/src/storage/index.js](design-learn-server/src/storage/index.js)
3. Implement CRUD operations following existing patterns
4. Update index generation if needed

### Debugging Server Issues

1. Check server logs for `[http]`, `[mcp]`, `[ws]` prefixed messages
2. Verify SQLite database: `sqlite3 data/database.sqlite`
3. Inspect file storage: `ls -la data/designs/`
4. Test endpoints: `curl http://localhost:3100/api/health`
5. Check MCP connection: Use `ping` tool from Claude Code

## Environment Variables

- `PORT` or `DESIGN_LEARN_PORT`: Server port (default: 3100)
- `DESIGN_LEARN_DATA_DIR`: Data directory path (default: `./data`)
- `DESIGN_LEARN_USE_INDEX`: Enable index file usage (default: false)
- `MCP_SERVER_NAME`: MCP server name (default: "design-learn")
- `MCP_SERVER_VERSION`: MCP server version (default: "0.1.0")
- `MCP_AUTH_TOKEN`: Optional MCP authentication token

## Project Structure Notes

- **No Root package.json**: Dependencies are managed per-component
- **Three Independent Components**: Chrome extension, VSCode extension, and server are separate
- **Shared Data Format**: All components use compatible snapshot/design data structures
- **Optional Integration**: Components can work independently or together
