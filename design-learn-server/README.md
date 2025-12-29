# Design-Learn Server (Skeleton)

A minimal single-process server entry that registers REST, WebSocket, and MCP (SSE) routes.

## Start

```bash
node src/server.js
```

Optional port override:

```bash
PORT=3000 node src/server.js
```

## Endpoints

- `GET /api/health` -> health check JSON
- `GET /mcp` or `/mcp/*` -> MCP over SSE (sends a ready event and keeps the connection alive)
- `WS /ws` -> WebSocket upgrade endpoint (handshake only)

## Data storage

- SQLite metadata: `<dataDir>/database.sqlite`
- File storage: `<dataDir>/designs`
- `dataDir` defaults to `./data`, override with `DESIGN_LEARN_DATA_DIR` or `DATA_DIR` (supports `~` expansion)

## Migrations

- Schema version is tracked via SQLite `PRAGMA user_version` (current: 1).
- For breaking changes, back up `database.sqlite` and the `designs/` folder before upgrading.
