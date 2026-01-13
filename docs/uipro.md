# Design-Learn + UI UX Pro Max 整合方案

**版本**: v1.1
**优先级**: 基础工具优先
**数据策略**: 自动抓取
**使用模式**: 用户主导

## 一、概述

### 1.1 整合目标
将 UI UX Pro Max 的设计知识库与 Design-Learn MCP 结合，实现：
- **基础工具优先**：先实现搜索功能，再考虑智能推荐
- **自动数据同步**：从 UI UX Pro Max 仓库自动抓取最新数据
- **用户主导**：用户主动搜索，AI 辅助选择

### 1.2 整合架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI 编程助手 (Claude Code / Cursor)          │
├─────────────────────────────────────────────────────────────────┤
│                     Design-Learn MCP Server                      │
│  ┌──────────────────┐  ┌─────────────────────────────────────┐  │
│  │  现有功能模块     │  │  UI UX Pro Max 整合模块 (新增)       │  │
│  │                  │  │                                     │  │
│  │ • designs        │  │ • design_recommendations            │  │
│  │ • versions       │  │ • style_templates                   │  │
│  │ • components     │  │ • color_palettes                    │  │
│  │ • rules          │  │ • typography_pairs                  │  │
│  │ • previews       │  │ • ux_guidelines                     │  │
│  │                  │  │ • component_patterns                │  │
│  └──────────────────┘  └─────────────────────────────────────┘  │
│                               │                                   │
│  ┌────────────────────────────▼────────────────────────────────┐ │
│  │                    统一数据层 (SQLite + 文件)                │ │
│  │  ┌────────────────┐  ┌─────────────────────────────────┐   │ │
│  │  │ 用户收集的设计  │  │ UI UX Pro Max 内置知识库         │   │ │
│  │  │ (Design-Learn) │  │ (SQLite 存储)                   │   │ │
│  │  └────────────────┘  └─────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、数据获取策略

### 2.1 自动抓取脚本

创建一个数据同步脚本，定期从 UI UX Pro Max 仓库获取最新数据：

```javascript
// scripts/sync-uipro-data.js
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

async function syncUiproData() {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { data } = await octokit.repos.getContent({
        owner: 'nextlevelbuilder',
        repo: 'ui-ux-pro-max-skill',
        path: 'data', // 假设数据在 data 目录
    });

    // 下载 styles.json, palettes.json 等文件
    for (const file of data) {
        if (['styles.json', 'palettes.json', 'typography.json', 'guidelines.json'].includes(file.name)) {
            const { data: content } = await octokit.repos.getContent({
                owner: 'nextlevelbuilder',
                repo: 'ui-ux-pro-max-skill',
                path: `data/${file.name}`,
            });

            const decoded = Buffer.from(content.content, 'base64').toString('utf-8');
            fs.writeFileSync(path.join(__dirname, `../src/uipro/data/${file.name}`), decoded);
            console.log(`Synced ${file.name}`);
        }
    }
}

syncUiproData();
```

### 2.2 本地缓存策略

- 首次启动时检查远程版本
- 有新版本时提示更新
- 支持手动刷新数据

---

## 三、MCP 工具实现（第一阶段）

### 3.1 工具列表（基础版）

| 工具名 | 功能 | 输入参数 | 优先级 |
|--------|------|----------|--------|
| `search_ui_styles` | 搜索 UI 风格 | query, category, tech_stack, limit | P0 |
| `search_color_palettes` | 搜索配色方案 | industry, style, limit | P0 |
| `search_typography` | 搜索字体搭配 | category, limit | P0 |
| `get_component_template` | 获取组件模板 | componentType, style, tech_stack | P0 |
| `get_ux_guideline` | 获取 UX 指南 | category, keyword | P1 |

### 3.2 数据结构（SQLite）

内置知识库使用 SQLite 存储，支持索引和查询：

```sql
-- uipro_styles: UI 风格库
CREATE TABLE uipro_styles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,           -- 'ui-style', 'animation', 'layout'
    description TEXT,
    css_properties TEXT,              -- JSON
    tech_stacks TEXT,                 -- JSON array
    tags TEXT,                        -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- uipro_palettes: 配色方案库
CREATE TABLE uipro_palettes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT,                    -- 'saas', 'ecommerce', 'healthcare'
    colors TEXT NOT NULL,             -- JSON
    dark_mode TEXT,                   -- JSON
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- uipro_typography: 字体搭配库
CREATE TABLE uipro_typography (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    heading_font TEXT,
    body_font TEXT,
    font_weights TEXT,                -- JSON
    scale_ratio REAL DEFAULT 1.25,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- uipro_components: 组件模板库
CREATE TABLE uipro_components (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,               -- 'button', 'card', 'input', etc.
    style_id TEXT,                    -- 关联的 style
    code_template TEXT,               -- 代码模板
    variants TEXT,                    -- JSON
    tech_stack TEXT,
    FOREIGN KEY (style_id) REFERENCES uipro_styles(id)
);

-- uipro_guidelines: UX 指南库
CREATE TABLE uipro_guidelines (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,           -- 'accessibility', 'usability', 'design'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT                         -- JSON array
);

-- 索引
CREATE INDEX idx_uipro_styles_category ON uipro_styles(category);
CREATE INDEX idx_uipro_styles_tags ON uipro_styles(tags);
CREATE INDEX idx_uipro_palettes_industry ON uipro_palettes(industry);
CREATE INDEX idx_uipro_components_type ON uipro_components(type);
CREATE INDEX idx_uipro_guidelines_category ON uipro_guidelines(category);
```

### 3.3 数据同步流程

```
GitHub UI UX Pro Max 仓库
         │
         ▼
┌─────────────────┐
│ sync-uipro-data │  脚本下载 JSON
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   import-json   │  解析并导入 SQLite
└────────┬────────┘
         │
         ▼
   SQLite 数据库
   (uipro_* 表)
```

### 3.4 数据格式示例

```json
// styles.json 格式
{
    "id": "glassmorphism",
    "name": "Glassmorphism",
    "category": "ui-style",
    "description": "Translucent background with blur effect",
    "css_properties": {
        "backdropFilter": "blur(10px)",
        "background": "rgba(255, 255, 255, 0.2)",
        "borderRadius": "16px"
    },
    "tech_stacks": ["react", "vue", "nextjs"],
    "tags": ["modern", "translucent"]
}

// palettes.json 格式
{
    "id": "saas-primary",
    "name": "SaaS Primary",
    "industry": "saas",
    "colors": {
        "primary": "#6366f1",
        "background": "#f8fafc"
    },
    "dark_mode": {
        "primary": "#818cf8",
        "background": "#0f172a"
    }
}
```

---

## 四、核心模块设计

### 4.1 新增文件结构

```
src/
├── mcp/
│   └── index.js              # 扩展工具注册
├── uipro/                    # 新增：UI UX Pro Max 整合模块
│   ├── index.js              # 入口文件
│   ├── loader.js             # 加载内置知识库
│   ├── styles.js             # UI 风格搜索
│   ├── palettes.js           # 配色方案搜索
│   ├── typography.js         # 字体搭配搜索
│   ├── components.js         # 组件模板搜索
│   ├── guidelines.js         # UX 指南
│   └── data/
│       ├── styles.json       # 57 种 UI 风格
│       ├── palettes.json     # 95 套配色
│       ├── typography.json   # 56 组字体
│       ├── components.json   # 常用组件模板
│       └── guidelines.json   # UX 指南
└── ...
```

### 4.2 核心模块代码结构

```javascript
// src/uipro/index.js - 入口文件
const loader = require('./loader');
const styles = require('./styles');
const palettes = require('./palettes');
const typography = require('./typography');
const components = require('./components');
const guidelines = require('./guidelines');

module.exports = {
    create(db) {
        return {
            styles: styles.create(db),
            palettes: palettes.create(db),
            typography: typography.create(db),
            components: components.create(db),
            guidelines: guidelines.create(db),
        };
    },
};
```

```javascript
// src/uipro/styles.js - UI 风格搜索（SQLite）
function create(db) {
    return {
        search({ query, category, tech_stack, limit = 20 }) {
            let sql = 'SELECT * FROM uipro_styles WHERE 1=1';
            const params = [];

            if (query) {
                sql += ' AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)';
                const pattern = `%${query}%`;
                params.push(pattern, pattern, pattern);
            }

            if (category) {
                sql += ' AND category = ?';
                params.push(category);
            }

            if (tech_stack) {
                // SQLite JSON 搜索
                sql += ' AND tech_stacks LIKE ?';
                params.push(`%"${tech_stack}"%`);
            }

            sql += ' ORDER BY name LIMIT ?';
            params.push(limit);

            const stmt = db.prepare(sql);
            const rows = stmt.all(...params);
            return rows.map(row => ({
                ...row,
                css_properties: JSON.parse(row.css_properties || '{}'),
                tech_stacks: JSON.parse(row.tech_stacks || '[]'),
                tags: JSON.parse(row.tags || '[]'),
            }));
        },

        getById(id) {
            const stmt = db.prepare('SELECT * FROM uipro_styles WHERE id = ?');
            const row = stmt.get(id);
            if (row) {
                return {
                    ...row,
                    css_properties: JSON.parse(row.css_properties || '{}'),
                    tech_stacks: JSON.parse(row.tech_stacks || '[]'),
                    tags: JSON.parse(row.tags || '[]'),
                };
            }
            return null;
        },
    };
}
```

---

## 五、实现步骤

### Phase 1: 数据库扩展 (0.5 天)

1. **扩展 SQLite schema**
   - [ ] 修改 `src/storage/sqliteStore.js` 添加 `uipro_*` 表
   - [ ] 添加 `ensureUiproTables()` 方法
   - [ ] 添加版本迁移逻辑（user_version = 2）

2. **创建数据同步脚本**
   - [ ] `scripts/sync-uipro-data.js` - 从 GitHub 下载 JSON
   - [ ] `scripts/import-uipro-data.js` - 导入 SQLite
   - [ ] 添加 `sync-uipro` npm script

### Phase 2: 核心模块实现 (1-2 天)

3. **创建 uipro 模块**
   - [ ] `src/uipro/index.js` - 入口文件
   - [ ] `src/uipro/styles.js` - 风格搜索（SQLite）
   - [ ] `src/uipro/palettes.js` - 配色搜索（SQLite）
   - [ ] `src/uipro/typography.js` - 字体搜索（SQLite）
   - [ ] `src/uipro/components.js` - 组件模板（SQLite）
   - [ ] `src/uipro/guidelines.js` - UX 指南（SQLite）

4. **运行数据同步**
   - [ ] 执行 `npm run sync-uipro` 导入数据

### Phase 3: MCP 工具注册 (1 天)

5. **注册新工具**
   - [ ] 在 `src/mcp/index.js` 中添加工具定义
   - [ ] 实现各工具的 handler
   - [ ] 更新 server capabilities

### Phase 4: 测试与文档 (0.5 天)

6. **测试**
   - [ ] 使用 `node scripts/verify-mcp.js` 验证
   - [ ] 手动测试各搜索功能
   - [ ] 验证 SQLite 索引生效

7. **文档**
   - [ ] 更新 README.md
   - [ ] 编写使用示例

---

## 六、使用示例

### 示例 1: 搜索 Glassmorphism 风格

```json
// MCP 请求
{
    "tool": "search_ui_styles",
    "params": {
        "query": "glass",
        "tech_stack": "react",
        "limit": 5
    }
}

// 返回
{
    "results": [
        {
            "id": "glassmorphism",
            "name": "Glassmorphism",
            "css_properties": {
                "backdropFilter": "blur(10px)",
                "background": "rgba(255, 255, 255, 0.2)"
            },
            "tech_stacks": ["react", "vue", "nextjs"]
        }
    ]
}
```

### 示例 2: 搜索 SaaS 配色方案

```json
// MCP 请求
{
    "tool": "search_color_palettes",
    "params": {
        "industry": "saas"
    }
}

// 返回
{
    "results": [
        {
            "id": "saas-primary",
            "name": "SaaS Primary",
            "colors": {
                "primary": "#6366f1",
                "background": "#f8fafc"
            }
        }
    ]
}
```

---

## 七、文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/sync-uipro-data.js` | 新增 | 从 GitHub 下载 JSON 数据 |
| `scripts/import-uipro-data.js` | 新增 | 导入数据到 SQLite |
| `src/uipro/` | 新增 | UI UX Pro Max 整合模块 |
| `src/uipro/index.js` | 新增 | 模块入口 |
| `src/uipro/styles.js` | 新增 | UI 风格搜索 |
| `src/uipro/palettes.js` | 新增 | 配色搜索 |
| `src/uipro/typography.js` | 新增 | 字体搜索 |
| `src/uipro/components.js` | 新增 | 组件模板 |
| `src/uipro/guidelines.js` | 新增 | UX 指南 |
| `src/storage/sqliteStore.js` | 修改 | 添加 uipro_* 表和迁移 |
| `src/mcp/index.js` | 修改 | 添加新工具注册 |
| `README.md` | 修改 | 更新文档 |
| `package.json` | 修改 | 添加 sync-uipro script |

---

## 八、关键文件路径

| 文件 | 路径 |
|------|------|
| SQLite Store | `src/storage/sqliteStore.js` |
| MCP Server | `src/mcp/index.js` |
| 存储工厂 | `src/storage/index.js` |
| 服务器入口 | `src/server.js` |

---

## 九、下一步计划

完成第一阶段（基础工具）后，可选的后续增强：

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 智能推荐引擎 | P1 | 根据项目风格自动推荐 |
| 设计一致性检查 | P1 | 检查组件是否符合规范 |
| 用户收藏功能 | P2 | 保存喜欢的设计资源 |
| 自动数据更新 | P2 | 定时同步 UI UX Pro Max |
