---
mode: plan
cwd: /Volumes/DATABASE/code/mcp/Design-Learn
task: stylemarkdown prompt templates in DB with CRUD + VSCode selection
complexity: complex
planning_method: builtin
created_at: 2026-01-20T14:39:53+08:00
---

# Plan: stylemarkdown prompt templates in DB

Task overview
Move the stylemarkdown (styleguide) prompt from hardcoded strings to database-backed templates. Expose CRUD APIs in the server and wire VSCode UI to list/edit/select templates. Add a default prompt field that can be auto-set, and ensure MCP falls back to the default when no template is selected. Keep backward compatibility with existing hardcoded defaults and local template configs.

Execution plan
1. Map current prompt usage and template data flows across VSCode and Chrome extension, and define a single template schema (fields + active + default). Confirm prompt resolution order (request -> default -> built-in).
2. Add a new SQLite table (e.g., prompt_templates) and bump schema version. Include columns for id, name, type, content, description, is_active, is_default, metadata_json, created_at, updated_at, plus indexes on type/is_active/is_default.
3. Extend storage layer to expose list/get/create/update/delete and setActive/setDefault helpers. Normalize input, enforce type/name/content validation, and ensure only one active/default template per type.
4. Add REST endpoints in server.js for CRUD and default activation. Reuse existing request/response helpers and follow current error patterns.
5. Add server-side defaults: when no templates exist, seed or return a built-in default and auto-set it as is_default so MCP has a stable fallback.
6. Update VSCode SettingsPanel + webview script to fetch templates from server, display list, and route add/update/delete/activate/default actions to the new API. Provide graceful fallback to local config when server is unavailable.
7. Update VSCode AIAnalyzer to load selected template from server (or local config) and replace hardcoded system prompt. If no template is selected, use server default (or built-in).
8. (Optional) Align Chrome extension template shape if the API is shared; otherwise document the divergence and keep Chrome extension behavior unchanged.
9. Add verification steps: API CRUD via curl, default selection behavior, and VSCode UI manual checks. Ensure styleguide generation still works with default templates.

Business logic
- Template types include at least: styleguide (stylemarkdown). Future types can be added without breaking API.
- Only one active template per type. If a new template is created/updated with active=true, deactivate others of the same type.
- Only one default template per type. If a new template is created/updated with is_default=true, unset others of the same type.
- If the default template is deleted, auto-set the most recently updated template as default; if none exist, fall back to built-in default.
- Prompt resolution order for analysis (including MCP): request.templateId (if provided) -> default template for type -> built-in default.

API boundaries
- GET /api/prompt-templates
  - Query: type (optional), active (optional boolean), limit (1-100), offset (>=0)
  - Output: { items: Template[], total: number }
  - Errors: 400 for invalid query params
- GET /api/prompt-templates/:id
  - Output: Template
  - Errors: 404 if not found
- POST /api/prompt-templates
  - Input: { name: string(1-100), type: enum, content: string(1-50000), description?: string(0-500), active?: boolean, is_default?: boolean, metadata?: object }
  - Output: Template
  - Errors: 400 invalid payload, 409 duplicate name (if enforced)
- PATCH /api/prompt-templates/:id
  - Input: partial of POST fields; empty body -> 400
  - Output: Template
  - Errors: 400 invalid payload, 404 not found
- DELETE /api/prompt-templates/:id
  - Output: { id } or 204
  - Errors: 404 not found

Test scope and boundaries
- CRUD happy paths for each endpoint (create/list/get/update/delete)
- Activation logic: only one active/default per type, deletion of active/default template
- Validation: empty name/content, overly long fields, invalid type, invalid query params
- VSCode UI: list templates, create, delete, activate, and ensure selection is used by AIAnalyzer
- Backward compatibility: no templates in DB -> built-in default prompt still used

Risks and notes
- Template schema mismatch between VSCode (prompt) and Chrome extension (content/config); decide on a unified shape or keep adapters.
- If server is unavailable, VSCode must fail silently and keep local template config usable.
- DB migration must not break existing data; ensure schema version bump is safe.
- Active vs default semantics need clear UX to avoid user confusion (e.g., "当前默认模板" vs "当前启用模板").

References
- vscode-extension/src/aiAnalyzer.ts:125
- vscode-extension/src/aiAnalyzer.ts:221
- vscode-extension/src/webview/SettingsPanel.ts:141
- vscode-extension/media/webview/main.js:244
- chrome-extension/lib/ai-analyzer.js:306
- chrome-extension/options/js/components/PromptTemplateManager.js:25
- design-learn-server/src/server.js:273
- design-learn-server/src/server.js:1050
- design-learn-server/src/storage/sqliteStore.js:128
- design-learn-server/src/storage/index.js:22
