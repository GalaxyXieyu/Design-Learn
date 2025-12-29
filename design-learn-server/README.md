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
