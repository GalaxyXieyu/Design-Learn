---
mode: plan
cwd: /Volumes/DATABASE/code/mcp/Design-Learn
task: npx MCP 自动启动与插件自动连接联调方案
complexity: medium
planning_method: builtin
created_at: 2025-12-31T15:08:58+08:00
---

# Plan: npx MCP 自动启动与插件自动连接联调方案

🎯 任务概述
面向“用户从 GitHub 克隆后可一键启动并自动连接”的体验，补齐 MCP JSON 配置模板、npx 本地模拟流程与联调验证路径。目标是让 MCP 客户端自动拉起服务后，Chrome/VSCode 插件无需手动配置即可连接，同时保留手动 URL 兜底。

📋 执行计划
1. 明确 MCP 自动启动配置模板：补充 MCP JSON 示例与使用说明，覆盖 npx 与本地路径两种模式。
2. 提供 npx 本地模拟脚本：产出可执行脚本，支持本地打包并用 npx 启动服务，含健康检查。
3. 完整用户流程文档：补齐“克隆 → 安装 → MCP 配置 → 插件联调”的端到端步骤。
4. 测试与发布检查补齐：将 MCP 自动启动与插件自动连接纳入测试计划与发布清单。

⚠️ 风险与注意事项
- MCP 客户端对 JSON 配置字段支持差异较大，需要给出通用模板与兼容说明。
- npx 本地模拟依赖 npm pack 与可执行权限，脚本需考虑失败提示与清理行为。
- 插件自动连接仍需依赖服务已启动，需保留手动 URL 兜底。

📎 参考
- `design-learn-server/src/cli.js:1`
- `docs/test-plan.md:1`
- `docs/ops-guide.md:1`
