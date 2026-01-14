# UIPro SQLite/FTS5 导入评估（RFC）

> 目标：在不破坏现有 `search_uipro` 体验的前提下，评估将 UIPro CSV 导入 SQLite（含 FTS5）的可行性、收益与迁移风险。  
> 状态：RFC（本仓库当前仅提供 BM25 + CSV 内置数据；不在本轮改动数据库 schema）

## 1. 背景与动机

当前 UIPro 数据以 CSV 形式内置在 `design-learn-server/src/uipro/data/`，查询使用 Node 版 BM25（`design-learn-server/src/uipro/bm25.js`）。

当出现以下需求时，SQLite/FTS5 可能更合适：

- 数据量显著增长，CSV 解析/内存索引开销变大
- 需要更复杂的过滤/排序/字段级检索（例如限定字段、组合条件、分页、统计）
- 需要更强的可观测性（SQL 可解释、可调优、可持久化索引）

## 2. 目标 / 非目标

**目标**

1. 保持现有 MCP 工具体验一致：`search_uipro` / `search_uipro_stack` 输出结构不变或提供兼容层。
2. 提供一个可回滚的数据导入机制：从 CSV → SQLite，失败不影响现有 BM25 查询。
3. 明确 schema/索引/FTS5 方案与迁移策略，给出可执行 benchmark 方法。

**非目标**

1. 本轮不修改 `design-learn-server/src/storage/sqliteStore.js` 的 `SCHEMA_VERSION`。
2. 本轮不引入线上默认走 SQLite 查询；仍以 BM25 为默认实现。

## 3. 现状（BM25 + CSV）

关键实现：

- 数据目录优先级：`DESIGN_LEARN_UIPRO_DATA_DIR` > `${DESIGN_LEARN_DATA_DIR}/uipro/` > 内置 `src/uipro/data/`
- BM25：`design-learn-server/src/uipro/bm25.js`
- CSV 解析：`design-learn-server/src/uipro/csv.js`
- Domain/Stack 配置：`design-learn-server/src/uipro/config.js`

基线 benchmark：`design-learn-server/scripts/benchmark-uipro.js`

## 4. SQLite/FTS5 方案草案

### 4.1 表设计（建议）

**uipro_records**（结构化字段）

- `id` TEXT PRIMARY KEY（可用 `<domain>:<rowIndex>`）
- `domain` TEXT NOT NULL（9 domains + stack）
- `stack` TEXT NULL（仅 stack domain 使用）
- `source_file` TEXT（相对路径：`styles.csv` / `stacks/nextjs.csv`）
- `payload_json` TEXT（原始行 JSON，便于兼容输出）
- `created_at` TEXT

**uipro_fts**（FTS5）

- `uipro_fts(id, domain, stack, text)` 使用 `content=uipro_records` 或独立表
- `text` 为拼接后的可检索文本（对齐当前 BM25 的 searchColumns 拼接策略）

### 4.2 索引建议

- `CREATE INDEX idx_uipro_domain ON uipro_records(domain);`
- `CREATE INDEX idx_uipro_stack ON uipro_records(stack);`
- FTS5 自带索引

### 4.3 查询策略（兼容层）

建议在 `createUipro().search()` 内部做切换（伪代码）：

1. 若检测到 SQLite 已导入且启用开关（例如 `DESIGN_LEARN_UIPRO_USE_SQLITE=1`），则走 FTS 查询；
2. 否则走 BM25（现状）。

兼容输出：

- 从 `payload_json` 还原字段，保留 `_score`（FTS5 可用 `bm25(uipro_fts)` 或 rank 计算）
- `limit` 语义保持一致

## 5. 导入流程草案（失败安全 + 可回滚）

1. **准备临时表 / 临时库**：先导入到临时库或临时表（例如 `uipro_records_tmp` / `uipro_fts_tmp`）
2. **批量导入**：逐文件读取 CSV（可复用现有 CSV parser），写入 `payload_json` 与 `text`
3. **校验**：校验每个 domain/stack 的记录数 > 0，必要文件存在
4. **原子切换**：将 tmp 表 rename 为正式表（或替换数据库文件）
5. **回滚策略**：保留旧表/旧库备份，失败时不影响 BM25 兜底

## 6. 风险与权衡

- **Schema 迁移风险**：需要处理已有 `SCHEMA_VERSION` 与用户现有数据兼容；建议先用“独立库文件（uipro.sqlite）”减少主库升级压力。
- **性能不确定性**：FTS5 对短文本、字段拼接策略敏感；需要真实 benchmark。
- **一致性风险**：BM25 vs FTS5 排序可能不同；需要定义“兼容度”口径（例如结果非空、字段完整、排序差异可接受）。

## 7. Benchmark 方法（建议）

### 7.1 BM25 基线（当前可跑）

运行：

```bash
node design-learn-server/scripts/benchmark-uipro.js
```

可选：

```bash
DESIGN_LEARN_UIPRO_DATA_DIR=./data/uipro node design-learn-server/scripts/benchmark-uipro.js --iterations 30
```

### 7.2 FTS5 对比（未来实现后）

对比维度建议：

- 冷启动（首次构建/首次查询） vs 热查询（缓存/索引已就绪）
- 多 domain/stack 覆盖
- 输出一致性校验（字段、非空、错误处理）

## 8. 参考

- `design-learn-server/src/uipro/index.js:1`
- `design-learn-server/src/uipro/config.js:1`
- `design-learn-server/src/storage/sqliteStore.js:1`
- `design-learn-server/scripts/benchmark-uipro.js:1`

