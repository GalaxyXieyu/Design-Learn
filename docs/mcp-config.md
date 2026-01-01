# MCP 自动启动配置模板

## 配置位置（通用）

- 将以下 JSON 写入 MCP 客户端的配置文件（通常命名为 `mcp.json`）。
- 配置文件所在路径由客户端决定（例如 Cursor/Claude Desktop 等），请以客户端文档为准。
- 若客户端支持 workspace 级配置，可在项目根目录放置配置文件并在客户端启用。

## 模式 A：本地路径启动（推荐本地联调）

```json
{
  "mcpServers": {
    "design-learn": {
      "command": "node",
      "args": [
        "/ABS/PATH/Design-Learn/design-learn-server/src/cli.js",
        "--port",
        "3100",
        "--data-dir",
        "/ABS/PATH/Design-Learn/data"
      ]
    }
  }
}
```

## 模式 B：npx 启动（发布后或本地打包）

```json
{
  "mcpServers": {
    "design-learn": {
      "command": "npx",
      "args": ["design-learn-server", "--port", "3100", "--data-dir", "./data"]
    }
  }
}
```

> 说明：若尚未发布 npm 包，可通过本地打包产物用 npx 启动（见联调脚本/文档）。

## 参数边界（与 CLI 保持一致）

- `--port <number>`：服务端口（默认 3100）
- `--data-dir <path>`：数据目录（默认 `./data`）
- `--auth-token <token>`：MCP 鉴权令牌（可选）
- `--server-name <name>`：MCP Server Name（可选）
- `--server-version <ver>`：MCP Server Version（可选）
- `--no-health-check`：关闭启动后的健康检查

## 插件自动连接说明

- Chrome/VSCode 插件会自动检测本地服务（端口 3100 和 3000）。
- 若未检测到，将提示启动服务并保留手动 URL 兜底。

## 模式 C：Claude Code stdio 模式（推荐）

Claude Code 使用 stdio 传输协议，MCP 启动时会同时启动 HTTP 服务供 Chrome/VSCode 插件使用。

```bash
# 添加 MCP 服务器
claude mcp add -s user design-learn -- node /ABS/PATH/Design-Learn/design-learn-server/src/stdio.js

# 验证配置
claude mcp list
```

此模式的优势：
- Claude Code 启动时自动运行 MCP 服务
- 同时启动 HTTP 服务（端口 3100），供 Chrome/VSCode 插件通信
- 无需手动启动服务器
