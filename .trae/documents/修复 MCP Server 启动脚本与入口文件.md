1.  **修改 `scripts/start-server.sh`**：
    *   **关键修正**：将所有 `echo` 输出重定向到 stderr (`>&2`)，避免破坏 MCP 协议的 Stdout 通道。
    *   **更换入口**：将启动命令从 `src/cli.js` 更改为 `src/stdio.js`。Trae 使用 Stdio 模式与 Server 通信，必须连接到支持 `StdioServerTransport` 的入口。
    *   `src/stdio.js` 内部会通过 `spawn` 自动启动 HTTP Server，所以我们不需要手动启动两个。

2.  **验证**：
    *   修改完成后，通知用户刷新 Trae 的 MCP Server 列表。
    *   这次 Trae 应该能正确解析到 `src/stdio.js` 发出的 MCP 握手信号，状态将变为 "Connected"。