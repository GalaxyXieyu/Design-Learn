# Design-Learn Server (Skeleton)

A minimal single-process server entry that registers REST, WebSocket, and MCP (SSE) routes.

## Start

```bash
node src/server.js
```

## Quick start (npx)

```bash
npx design-learn-server --port 3000 --data-dir ./data
```

Optional flags:
- `--auth-token <token>` for MCP auth
- `--server-name <name>` / `--server-version <ver>`
- `--no-health-check` to disable startup health check

Optional port override:

```bash
PORT=3000 node src/server.js
```

## Endpoints

- `GET /api/health` -> health check JSON
- `POST /api/import/browser` -> enqueue browser plugin import (alias: `/api/designs/import`)
- `POST /api/import/url` -> enqueue Playwright URL extraction
- `GET /api/import/jobs` -> list import jobs
- `GET /api/import/jobs/:id` -> fetch job status
- `GET /api/import/stream` -> SSE progress stream (optional `jobId=...`)
- `GET /mcp` / `POST /mcp` / `DELETE /mcp` -> MCP Streamable HTTP (SSE streaming)
- `WS /ws` -> WebSocket upgrade endpoint (handshake only)

## Extraction pipeline

### Browser plugin import

```bash
curl -X POST http://localhost:3000/api/import/browser \\
  -H 'Content-Type: application/json' \\
  -d '{\"source\":\"browser-extension\",\"website\":{\"url\":\"https://example.com\",\"title\":\"Example\"},\"snapshot\":{\"html\":\"<html></html>\",\"css\":\"body{}\"}}'
```

### URL extraction (Playwright)

```bash
curl -X POST http://localhost:3000/api/import/url \\
  -H 'Content-Type: application/json' \\
  -d '{\"url\":\"https://example.com\"}'
```

If `playwright` or `scripts/lib/extractor.js` is missing, the job will fail with `playwright_not_installed` or `extractor_script_missing`.

### Progress stream

```bash
curl -N http://localhost:3000/api/import/stream
```

## Data storage

- SQLite metadata: `<dataDir>/database.sqlite`
- File storage: `<dataDir>/designs`
- `dataDir` defaults to `./data`, override with `DESIGN_LEARN_DATA_DIR` or `DATA_DIR` (supports `~` expansion)

## Migrations

- Schema version is tracked via SQLite `PRAGMA user_version` (current: 1).
- For breaking changes, back up `database.sqlite` and the `designs/` folder before upgrading.

## MCP auth & versioning

- Auth: set `MCP_AUTH_TOKEN` to require `Authorization: Bearer <token>` on MCP requests.
- Version: `MCP_SERVER_VERSION` controls the MCP server version advertised to clients (default `0.1.0`).
- Compatibility: prefer additive changes (new tools/resources/prompts) and keep existing contracts stable.
