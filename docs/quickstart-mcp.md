# 克隆后的联调流程（MCP 自动启动 + 插件自动连接）

## 1. 克隆并安装依赖

```bash
git clone <your-repo-url>
cd Design-Learn
cd design-learn-server && npm install
```

## 2. 启动服务（两种方式）

### 方式 A：本地路径启动（推荐联调）

```bash
node design-learn-server/src/cli.js --port 3000 --data-dir ./data
```

### 方式 B：npx 本地模拟（打包后启动）

```bash
cd design-learn-server && npm pack
cd ..
npx ./design-learn-server/design-learn-server-0.1.0.tgz --port 3000 --data-dir ./data
```

## 3. 配置 MCP 自动启动

- 将 MCP 配置写入客户端的 `mcp.json`（位置由客户端决定）。
- 示例模板：`docs/mcp-config.md`

## 4. 安装插件并自动连接

1. 安装 Chrome 插件（开发者模式加载 `chrome-extension/`）。
2. 安装 VSCode 插件（运行 `vscode-extension/` 或安装 `.vsix`）。
3. 打开插件设置，保持“自动检测本地服务”开启。
4. 若未检测到，按提示启动服务或手动填写 URL。

## 5. 连接验证（至少执行一条）

```bash
curl http://localhost:3000/api/health
```

```bash
node design-learn-server/scripts/verify-mcp.js --url http://localhost:3000/mcp
```
