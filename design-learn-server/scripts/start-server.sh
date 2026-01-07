#!/bin/bash
# 该脚本用于强制使用系统 Node.js 启动 MCP Server，
# 从而避免 Trae 内置 Node 环境与本地编译的 Native Modules 版本不匹配的问题。
# 
# 使用方法：
# 在 Trae 的 MCP Server 配置中，将 Command 设置为该脚本的绝对路径。
# 例如：/Volumes/DATABASE/code/mcp/Design-Learn/design-learn-server/scripts/start-server.sh

# 设置 Node 路径 (根据 `which node` 结果)
NODE_PATH="/opt/homebrew/bin/node"

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 检查 Node 是否存在
if [ ! -x "$NODE_PATH" ]; then
  # 尝试从 PATH 查找
  if command -v node >/dev/null 2>&1; then
    NODE_PATH=$(command -v node)
  else
    echo "Error: Node.js not found at $NODE_PATH and not in PATH" >&2
    exit 1
  fi
fi

# 切换到项目根目录，确保相对路径（如 ./data）正确解析
cd "$PROJECT_ROOT"

# === 自动清理端口逻辑 (默认 3100) ===
TARGET_PORT=3100

# 优先读取环境变量
if [ -n "$PORT" ]; then
  TARGET_PORT=$PORT
elif [ -n "$DESIGN_LEARN_PORT" ]; then
  TARGET_PORT=$DESIGN_LEARN_PORT
fi

# 检查并清理端口占用
if command -v lsof >/dev/null 2>&1; then
  PID=$(lsof -ti :$TARGET_PORT)
  if [ -n "$PID" ]; then
    echo "[start-script] Found process $PID on port $TARGET_PORT. Killing it..." >&2
    kill -9 $PID || true
    sleep 0.5
  fi
else
  echo "[start-script] Warning: 'lsof' not found, cannot auto-kill port $TARGET_PORT" >&2
fi
# ======================================

# 启动 Server (使用 src/stdio.js 以支持 MCP Stdio 通信)
# 使用 exec 替换当前 shell 进程
exec "$NODE_PATH" "src/stdio.js" "$@"
