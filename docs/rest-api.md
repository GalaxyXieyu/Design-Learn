# REST API 契约（MVP）

本文定义 `designs` / `snapshots` / `config` 的 REST API 最小契约，作为后续实现的边界与验收依据。

## 通用约定

- Base URL: `http://localhost:<port>`
- Content-Type: `application/json; charset=utf-8`
- 错误格式：`{ "error": "<code>", "message": "<optional>" }`
- 分页参数：`limit`（默认 20，最大 100）、`offset`（默认 0）

## 数据结构

### Design

```json
{
  "id": "uuid",
  "name": "string",
  "url": "string",
  "source": "import|browser|script",
  "category": "string",
  "description": "string",
  "thumbnail": "string",
  "stats": {
    "components": 0,
    "versions": 0,
    "lastAnalyzedAt": "ISO8601|null"
  },
  "metadata": {
    "extractedFrom": "string",
    "extractorVersion": "string",
    "tags": ["string"]
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### Snapshot

```json
{
  "id": "string",
  "designId": "uuid",
  "versionId": "uuid",
  "url": "string",
  "title": "string",
  "html": "string",
  "css": "string",
  "metadata": {},
  "createdAt": "ISO8601"
}
```

说明：若原始快照未提供 `id`，服务端可使用 `versionId:offset` 形式生成稳定标识。

### Config

```json
{
  "model": {
    "name": "string",
    "version": "string",
    "provider": "string"
  },
  "templates": {
    "styleguide": "string",
    "components": "string"
  },
  "extractOptions": {
    "includeRules": true,
    "includeComponents": true
  },
  "updatedAt": "ISO8601"
}
```

## Endpoints

### Designs

- `GET /api/designs?limit=&offset=`
  - Response: `{ "items": [Design], "limit": 20, "offset": 0, "total": 0 }`

- `POST /api/designs`
  - Body: `Design`（可省略 `id/createdAt/updatedAt`）
  - Response: `201` + `Design`

- `GET /api/designs/:id`
  - Response: `200` + `Design`

- `PATCH /api/designs/:id`
  - Body: `partial Design`
  - Response: `200` + `Design`

- `DELETE /api/designs/:id`
  - Response: `204`

### Snapshots

- `GET /api/snapshots?designId=&versionId=&limit=&offset=`
  - Response: `{ "items": [Snapshot], "limit": 20, "offset": 0, "total": 0 }`

- `GET /api/snapshots/:id`
  - Response: `200` + `Snapshot`

- `POST /api/snapshots/import`
  - Body: `{ "designId": "uuid?", "snapshot": { ... } }`
  - Response: `202` + `{ "jobId": "string" }`（可复用 `/api/import/*` 逻辑）

- `DELETE /api/snapshots/:id`
  - Response: `204`

### Config

- `GET /api/config`
  - Response: `200` + `Config`

- `PUT /api/config`
  - Body: `Config`
  - Response: `200` + `Config`

### Previews

- `POST /api/previews`
  - Body: `{ "componentId": "string" }`
  - Response: `202` + `{ "job": { ... } }`

- `GET /api/previews/:componentId`
  - Response: `200` + `{ "componentId": "...", "preview": { ... } | null }`

- `GET /api/previews/jobs`
  - Response: `200` + `{ "jobs": [ ... ] }`

- `GET /api/previews/jobs/:id`
  - Response: `200` + `{ "job": { ... } }`

## 示例

### Create Design

```bash
curl -X POST http://localhost:3100/api/designs \
  -H "Content-Type: application/json" \
  -d name:Example
```

```json
{
  "id": "uuid",
  "name": "Example",
  "url": "https://example.com",
  "source": "import",
  "category": "",
  "description": "",
  "thumbnail": "",
  "stats": {"components": 0, "versions": 0, "lastAnalyzedAt": null},
  "metadata": {"extractedFrom": "unknown", "extractorVersion": "", "tags": []},
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```
