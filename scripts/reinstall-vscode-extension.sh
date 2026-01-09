#!/bin/bash

# VSCode 插件一键重装脚本
# 确保每次都安装最新编译的版本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXTENSION_DIR="$PROJECT_ROOT/vscode-extension"
VERSION="$(node -p "require('${EXTENSION_DIR}/package.json').version" 2>/dev/null || echo "")"
if [ -z "$VERSION" ]; then
  echo "❌ 无法读取版本号：$EXTENSION_DIR/package.json"
  exit 1
fi
VSIX_FILE="$EXTENSION_DIR/design-learn-$VERSION.vsix"
EXT_ID="design-learn.design-learn"

echo "=== VSCode 插件一键重装 ==="
echo ""

# 1. 编译 TypeScript
echo "1️⃣  编译 TypeScript..."
cd "$EXTENSION_DIR"
npm run compile
echo "✅ 编译完成"
echo ""

# 2. 验证编译结果包含 LOG_FILE
echo "2️⃣  验证编译结果..."
if [ -f "$EXTENSION_DIR/out/extension.js" ] && [ -f "$EXTENSION_DIR/out/webview/SidebarPanel.js" ]; then
    echo "✅ 编译输出已生成（out/extension.js, out/webview/SidebarPanel.js）"
else
    echo "❌ 错误: 编译输出不存在，请检查 tsc 输出目录"
    exit 1
fi
echo ""

# 3. 删除旧的 .vsix 文件
echo "3️⃣  删除旧的 .vsix 文件..."
rm -f "$VSIX_FILE"
echo "✅ 已删除"
echo ""

# 4. 打包新的 .vsix
echo "4️⃣  打包新的 .vsix..."
if command -v vsce &> /dev/null; then
  vsce package --skip-license --allow-package-all-secrets --allow-package-env-file --out "design-learn-$VERSION.vsix" 2>&1 | grep -E "(DONE|ERROR|Packaged)" || true
else
  npx vsce package --skip-license --allow-package-all-secrets --allow-package-env-file --out "design-learn-$VERSION.vsix" 2>&1 | grep -E "(DONE|ERROR|Packaged)" || true
fi
echo "✅ 打包完成"
echo ""

# 检测使用 Cursor 还是 VSCode
if command -v cursor &> /dev/null; then
  CLI_CMD="cursor"
  APP_NAME="Cursor"
  VSCODE_EXT_DIR="$HOME/.cursor/extensions"
elif command -v code &> /dev/null; then
  CLI_CMD="code"
  APP_NAME="Visual Studio Code"
  VSCODE_EXT_DIR="$HOME/.vscode/extensions"
else
  echo "❌ 未找到 code 或 cursor 命令"
  exit 1
fi

echo "检测到: $APP_NAME"
echo "扩展目录: $VSCODE_EXT_DIR"
echo ""

# 5. 卸载旧版本
echo "5️⃣  卸载旧版本..."
$CLI_CMD --uninstall-extension $EXT_ID 2>&1 || echo "未安装旧版本"
sleep 1
echo "✅ 卸载完成"
echo ""

# 6. 清理扩展缓存目录 (关键步骤!)
echo "6️⃣  清理扩展缓存目录..."
rm -rf "$VSCODE_EXT_DIR/$EXT_ID"* 2>/dev/null || true
echo "✅ 缓存已清理"
echo ""

# 7. 安装新版本
echo "7️⃣  安装新版本..."
$CLI_CMD --install-extension "$VSIX_FILE" --force
echo "✅ 安装完成"
echo ""

# 8. 验证安装结果
echo "8️⃣  验证安装结果..."
INSTALLED_PKG="$VSCODE_EXT_DIR/$EXT_ID-$VERSION/package.json"
if [ -f "$INSTALLED_PKG" ]; then
    INSTALLED_VERSION="$(node -p "require('${INSTALLED_PKG}').version" 2>/dev/null || echo "")"
    if [ "$INSTALLED_VERSION" = "$VERSION" ]; then
        echo "✅ 验证通过！已安装版本: $INSTALLED_VERSION"
    else
        echo "❌ 验证失败: 期望版本 $VERSION，但读取到 $INSTALLED_VERSION"
        exit 1
    fi
else
    echo "⚠️  警告: 安装的扩展文件不存在，可能需要等待"
fi
echo ""

# 9. 重启编辑器
echo "9️⃣  重启 $APP_NAME..."
echo "正在关闭 $APP_NAME..."
osascript -e "tell application \"$APP_NAME\" to quit" 2>/dev/null || killall "$APP_NAME" 2>/dev/null || true
sleep 2

echo "正在打开 $APP_NAME..."
open -a "$APP_NAME" "$PROJECT_ROOT"
echo "✅ VSCode 已重启"
echo ""

echo "=== 重装完成 ==="
echo ""
echo "📝 提示："
echo "1. 等待 VSCode 完全启动"
echo "2. 打开 Design-Learn 侧边栏"
echo "3. 日志文件位置: $PROJECT_ROOT/extension.log"
echo ""
echo "🔍 如果还有问题，打开开发者工具查看日志："
echo "   Cmd+Option+I → Console 标签页"
