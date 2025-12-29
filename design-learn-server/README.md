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
- `GET /mcp` / `POST /mcp` / `DELETE /mcp` -> MCP Streamable HTTP (SSE streaming)
- `WS /ws` -> WebSocket upgrade endpoint (handshake only)

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
