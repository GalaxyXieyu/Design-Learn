# 测试与验证计划

## 目标

- 覆盖关键链路：采集 → 上报 → 入库 → 查询。
- 提供可执行的单元/接口/E2E 验证步骤。

## 单元测试（建议）

- Storage：Design/Version/Component/Rule 的 CRUD 行为与索引更新。
- Pipeline：队列状态转换（queued → running → completed/failed）。

## 接口测试（可运行脚本）

- 脚本：`scripts/verify-backend.sh`
- 覆盖项：
  - `GET /api/health`
  - `POST /api/import/browser`
  - `GET /api/import/jobs`

## E2E 测试（手工流程）

1. 启动服务：`node design-learn-server/src/server.js`
2. Chrome 插件设置服务地址并开启“仅采集并上报”。
3. 在浏览器中执行采集任务。
4. 通过 `GET /api/import/jobs` 检查任务记录。
5. 打开 VSCode 扩展，确认服务已启动（状态栏显示 Running）。

## 覆盖清单

- 采集成功/失败路径（content script 异常、网络失败）。
- 服务端入队失败（缺少 URL/JSON 解析失败）。
- Playwright 依赖缺失时的失败提示。
