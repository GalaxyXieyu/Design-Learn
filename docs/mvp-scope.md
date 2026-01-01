# MVP 范围清单（未完成功能盘查）

目的：冻结最小可交付范围，作为后续实现与验收的边界。

## 1) REST API（MVP）

范围内：
- /api/designs：列表/详情/创建/更新/删除
- /api/snapshots：列表/详情/导入/删除（导入保留现有接口）
- /api/config：模型/模板/提取选项的读取/写入

范围外（本轮不做）：
- 复杂筛选/高级搜索/跨资源聚合视图
- 破坏性变更现有导入链路或返回结构

## 2) MCP 工具（MVP）

范围内：
- search_*：按关键词/标签/URL 搜索 designs/components
- get_rules：获取 design/version 的规则（colors/typography/spacing/components…）
- list_versions / get_version：按版本查询
- list_components / get_component：组件级检索与获取结构化数据

范围外（本轮不做）：
- import_* / extract_* 的主动触发型工具
- 写入/修改类工具（仅检索 + 读取）

## 3) 组件预览（Nanobanana）

范围内：
- 预览生成任务/队列与 worker
- 预览产物存储（image/url）与查询接口（REST/MCP）
- 失败重试与基础配额/成本控制（可配置）

范围外（本轮不做）：
- 复杂的多级缓存或智能预取
- 高级成本优化策略（仅基础限流）

## 4) 依赖与未知项

- 数据模型：components/versions 的结构与 preview 字段回填规则需确认
- 存储：预览产物的存储位置与生命周期策略待定
- 鉴权：REST/MCP 的权限策略需与现有服务统一

## 5) 验收与评审记录

- 评审口径：本清单作为 MVP 边界合同，评审确认后进入实现
- 记录方式：评审结论写入 issue/PR 备注（由执行人补充）
