#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
DATA_DIR="${DESIGN_LEARN_DATA_DIR:-$ROOT_DIR/data}"
VERIFY_URL="${VERIFY_URL:-}"

node "$ROOT_DIR/design-learn-server/src/server.js" &
SERVER_PID=$!

echo "[verify] server pid=${SERVER_PID}"
cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 1

curl -fsS "http://localhost:${PORT}/api/health" > /tmp/design-learn-health.json
python3 - <<'PY'
import json
with open('/tmp/design-learn-health.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print('[verify] health:', data.get('status'))
PY

curl -fsS -X POST "http://localhost:${PORT}/api/import/browser" \
  -H 'Content-Type: application/json' \
  -d '{"source":"browser-extension","website":{"url":"https://example.com","title":"Example"},"snapshot":{"id":"snapshot_test","url":"https://example.com","title":"Example","html":"<html></html>","css":"body{}"}}' \
  > /tmp/design-learn-import.json

python3 - <<'PY'
import json
with open('/tmp/design-learn-import.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print('[verify] job:', data.get('job', {}).get('id'))
PY

curl -fsS "http://localhost:${PORT}/api/import/jobs" > /tmp/design-learn-jobs.json
python3 - <<'PY'
import json
with open('/tmp/design-learn-jobs.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print('[verify] jobs:', len(data.get('jobs', [])))
PY

if [ -n "$VERIFY_URL" ]; then
  curl -sS -X POST "http://localhost:${PORT}/api/import/url" \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"${VERIFY_URL}\"}" \
    > /tmp/design-learn-import-url.json

  python3 - <<'PY'
import json
with open('/tmp/design-learn-import-url.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
job = data.get('job') or {}
error = data.get('error')
if job.get('id'):
    print('[verify] import-url job:', job.get('id'))
else:
    print('[verify] import-url error:', error)
PY
fi

echo "[verify] done"
