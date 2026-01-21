# Server Refactor Plan: server/src/server.js

## Context and goals
- server.js is ~1600+ lines and mixes routing, handlers, utilities, pipeline wiring, MCP, and WebSocket logic.
- Goal: split by responsibility without changing API paths, status codes, or data shapes.
- No new dependencies. Keep current behavior stable and backwards compatible.

## Target architecture (minimal, no new deps)

### Directory layout
```
server/src/
  server.js                     # entrypoint only
  http/
    createServer.js             # http server + upgrade wiring
    router.js                   # tiny router (exact + prefix + :param)
    request.js                  # readJsonBody, parse helpers
    response.js                 # sendJson, sendNoContent, sendMethodNotAllowed
  routes/
    index.js                    # register all routes
    root.js                     # / and /api/health
    import.js                   # /api/import/* and /api/designs/import
    designs.js                  # /api/designs + /api/designs/:id
    versions.js                 # /api/versions/:id
    snapshots.js                # /api/snapshots/*
    previews.js                 # /api/previews/*
    tasks.js                    # /api/tasks/*
    config.js                   # /api/config
    promptTemplates.js          # /api/prompt-templates/*
    uipro.js                    # /api/uipro/*
    scanRoutes.js               # /api/scan-routes
  services/
    scanRoutes.js               # Playwright + sitemap crawling
    promptTemplates.js          # ensurePromptTemplateDefault + normalize helpers
    importProgress.js           # importJobDesignMap + pipeline progress update
  ws/
    upgrade.js                  # handleWebSocketUpgrade
```

### Responsibilities
- server.js: build dependencies and call `createServer({ deps })`, then `listen`. No request logic.
- http/createServer.js: wires HTTP server, handles upgrade, delegates to router.
- http/router.js: small routing table with helpers to register routes and match params.
- routes/*.js: group endpoints by domain; each file exports `registerXRoutes(router, deps)` with handlers inside.
- services/*.js: shared logic extracted from handlers to avoid duplication and keep handlers thin.
- ws/upgrade.js: websocket handshake only (no behavior change).

### Dependency injection shape
Use a single `deps` object (no global mutable state):
```
{
  storage,
  dataDir,
  uipro,
  extractionPipeline,
  previewPipeline,
  mcpHandler,
  importJobs
}
```
`importJobs` can expose methods for registerProgressHandlers, getJobDesignId, setJobDesignId, clearJobDesignId.

## Route mapping (current -> target)
- /, /api/health -> routes/root.js
- /api/import/* and /api/designs/import -> routes/import.js
- /api/designs, /api/designs/:id -> routes/designs.js
- /api/versions/:id -> routes/versions.js
- /api/snapshots/* -> routes/snapshots.js
- /api/previews/* -> routes/previews.js
- /api/tasks/* -> routes/tasks.js
- /api/config -> routes/config.js
- /api/prompt-templates/* -> routes/promptTemplates.js
- /api/uipro/* -> routes/uipro.js
- /api/scan-routes -> routes/scanRoutes.js
- /mcp, /ws -> handled in http/createServer.js

## Refactor order (safe, incremental)
1. Extract HTTP helpers: move sendJson/sendNoContent/sendMethodNotAllowed/readJsonBody/parseLimitOffset into `src/http/`. Update server.js imports only.
2. Introduce router: create `router.js` with `add()`, `addPrefix()`, and `addParam()` or `add('/api/designs/:id')`. Replace the if/else chain but keep same ordering and error responses.
3. Move domain routes: create `routes/*.js` one domain at a time. Keep handlers inside the same file initially.
4. Extract services: move `scanWebsiteRoutes` and sitemap helpers into `services/scanRoutes.js`; move prompt template normalization/default logic into `services/promptTemplates.js`; move import progress mapping into `services/importProgress.js`.
5. Trim server.js: keep only dependency creation and server start/shutdown wiring.

## Compatibility guardrails
- Keep all paths, methods, status codes, and error strings identical.
- Preserve existing logging lines and error handling semantics.
- Maintain the same dataDir resolution and env variables.
- Preserve special cases such as `/api/tasks/retry/:id` handling and `/api/tasks/clear-completed`.
- No change to MCP or WebSocket endpoints.

## Verification plan
1. Run existing smoke script:
   - `./scripts/verify-backend.sh`
2. Basic API checks (manual):
   - `curl http://localhost:3100/api/health`
   - `curl http://localhost:3100/api/designs`
   - `curl http://localhost:3100/api/config`
3. Import flow spot check (if Playwright installed):
   - `curl -X POST http://localhost:3100/api/import/url -H 'Content-Type: application/json' -d '{\"url\":\"https://example.com\"}'`
4. SSE endpoint still streams:
   - `curl -N http://localhost:3100/api/import/stream`
5. WebSocket fallback unchanged:
   - `curl -i http://localhost:3100/ws` should return 426.
6. MCP still responds (via existing MCP client / Claude tool ping).

## Rollback strategy
- Keep refactor steps isolated in small commits so each phase can be reverted without losing later changes.
- For each phase, compare outputs of key endpoints before/after.

## References
- server/src/server.js
