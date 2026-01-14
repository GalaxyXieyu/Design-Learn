# Design-Learn + UI UX Pro Max 整合方案

**版本**: v1.2  
**优先级**: 基础工具优先（先可搜索/可用，再谈推荐）  
**数据策略**: 内置 CSV 作为默认基础数据（可被用户数据目录覆盖）  
**检索策略**: Node 版 BM25（不依赖 Python）  
**使用模式**: 用户主导搜索，AI 组合调用工具

## 一、我们要达成什么

将 UI UX Pro Max 的“设计知识库数据”作为 Design-Learn 的默认基础数据使用，并保持 Design-Learn 的 MCP 工具体验一致：

- 用户依然用 Design-Learn 的工具习惯去查（query/limit/JSON 输出）
- UIPro 数据只是“默认内置知识库”，不强行变成 designs/versions/components 的一部分
- AI 可以组合调用：`search_designs`（用户采集库）+ `search_uipro`（内置知识库）

## 二、UI UX Pro Max 的真实数据结构（关键事实）

UI UX Pro Max 的知识库不是 JSON/SQLite，而是 **CSV + 搜索脚本**（我们已将其数据与检索逻辑内置到 Design-Learn Server）。

- CSV 数据位置（内置默认）：`design-learn-server/src/uipro/data/`
- CSV 数据位置（上游参考）：`.shared/ui-ux-pro-max/data/*.csv`、`.shared/ui-ux-pro-max/data/stacks/*.csv`
- Domain（9 类）：`style`、`prompt`、`color`、`chart`、`landing`、`product`、`ux`、`typography`、`icons`
- Stack（11 类）：`html-tailwind`、`react`、`nextjs`、`vue`、`nuxtjs`、`nuxt-ui`、`svelte`、`swiftui`、`react-native`、`flutter`、`shadcn`

Domain/Stack 配置（源自上游 CSV 约定）以本仓库实现为准：`design-learn-server/src/uipro/config.js:1`

## 三、整合策略（保持体验一致）

### 3.1 “默认基础数据”怎么落地

- 默认内置一份 UIPro CSV：`design-learn-server/src/uipro/data/`
- 运行时允许覆盖（便于以后做同步）：
  1. `DESIGN_LEARN_UIPRO_DATA_DIR`（最高优先级）
  2. `${DESIGN_LEARN_DATA_DIR}/uipro/`（用户数据目录下的 uipro）
  3. 内置 `design-learn-server/src/uipro/data/`

实现参考：`design-learn-server/src/uipro/index.js:18`

### 3.2 BM25 迁移到 Node（不依赖 Python）

迁移范围：

- BM25 算法：`design-learn-server/src/uipro/bm25.js:1`
- CSV 解析（含引号/逗号/换行）：`design-learn-server/src/uipro/csv.js:1`
- domain/stack 配置与 domain 自动检测：`design-learn-server/src/uipro/config.js:1`

## 四、MCP 工具（P0：能用、可组合）

在现有 Design-Learn MCP 基础上新增 UIPro 工具：

| 工具名 | 功能 | 入参 |
|---|---|---|
| `list_uipro_domains` | 列出可用 domain | 无 |
| `list_uipro_stacks` | 列出可用 stack | 无 |
| `search_uipro` | 搜索 UIPro（BM25） | `query`, `domain?`, `limit?` |
| `search_uipro_stack` | 搜索 stack 指南（BM25） | `query`, `stack`, `limit?` |

实现位置（两套 MCP 传输保持一致）：

- HTTP MCP：`design-learn-server/src/mcp/index.js:10`
- stdio MCP：`design-learn-server/src/stdio.js:150`

## 五、与现有 Design-Learn 工具如何“结合起来一起用”

这是关键点：不是做一个“UIPro 独立系统”，而是让它变成 Design-Learn 的内置知识库。

推荐用法（AI 侧组合调用）：

1. `search_designs(query)`：先查本地用户采集的 designs（更贴近项目/团队风格）
2. `search_uipro(query, domain?)`：补充 UI 风格/配色/排版/UX guidelines（默认基础数据兜底）
3. 需要技术栈约束时用 `search_uipro_stack(query, stack)`

这样工具入口、参数习惯、返回结构都一致，但数据来源有边界、不会互相污染。

## 六、后续增强（P1/P2）

- 同步脚本：从 GitHub Release 下载 zip，把 `.shared/ui-ux-pro-max/data/` 同步到 `${DESIGN_LEARN_DATA_DIR}/uipro/`
- 聚合搜索工具（可选）：新增 `search_library` 一次返回 designs + uipro（保持旧工具不破坏）
- SQLite/FTS5（可选）：当数据量变大或需要复杂过滤时再引入（需要完善 schema 迁移逻辑）

---

## 参考文件

- `design-learn-server/src/uipro/index.js:1`
- `design-learn-server/src/mcp/index.js:1`
- `design-learn-server/src/stdio.js:1`
- `design-learn-server/src/uipro/config.js:1`
