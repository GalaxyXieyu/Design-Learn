# 开发与运维说明

## 运行方式

```bash
# 本地启动
node design-learn-server/src/server.js

# 指定端口
PORT=3000 node design-learn-server/src/server.js
```

## 配置示例

```bash
# 数据目录
DESIGN_LEARN_DATA_DIR=./data

# MCP 鉴权
MCP_AUTH_TOKEN=your-token

# MCP 版本
MCP_SERVER_VERSION=0.1.0

# 服务端口
PORT=3000
```

## 数据路径说明

- SQLite 元数据：`<dataDir>/database.sqlite`
- 文件存储：`<dataDir>/designs/`
- 默认数据目录：`./data`（可通过 `DESIGN_LEARN_DATA_DIR` 覆盖）

## 回滚/降级策略

1. 发布前备份 `database.sqlite` 与 `designs/` 目录。
2. 若升级失败：恢复备份文件并回退到上一个稳定标签。
3. 若 Playwright 依赖缺失：保持仅插件导入路径可用。
