# 性能指标与基线

## 目标

- 为关键路径提供可重复测量的基线。
- 为回归验证提供最小可用阈值。

## 关键指标

| 指标 | 目标基线 | 测量方法 |
| --- | --- | --- |
| /api/health 响应时间 | P50 < 50ms | `curl -w` 采样 30 次 |
| 导入入队耗时 | P50 < 200ms | `POST /api/import/browser` 返回时间 |
| 队列完成时间 | < 5s (单任务) | SSE 观察 progress → completed |

## 测量步骤

1. 启动服务：`node design-learn-server/src/server.js`
2. 运行脚本：`scripts/verify-backend.sh`
3. 记录响应耗时与队列完成耗时

## 备注

- better-sqlite3/Playwright 依赖需要与本地 Node 版本匹配。
- 若环境不同，需重新记录基线并更新本文件。
