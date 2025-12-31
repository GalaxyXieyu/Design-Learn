#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${ROOT_DIR}/design-learn-server"
PORT="${PORT:-3000}"
DATA_DIR="${DESIGN_LEARN_DATA_DIR:-$ROOT_DIR/data}"
KEEP_TARBALL="${KEEP_TARBALL:-}"
TARBALL_PATH=""

if ! command -v npm >/dev/null 2>&1; then
  echo "[verify-npx] npm not found"
  exit 1
fi
if ! command -v npx >/dev/null 2>&1; then
  echo "[verify-npx] npx not found"
  exit 1
fi

TARBALL_NAME="$(cd "$SERVER_DIR" && npm pack --silent)"
TARBALL_PATH="${SERVER_DIR}/${TARBALL_NAME}"

echo "[verify-npx] tarball=${TARBALL_NAME}"

npx --yes "$TARBALL_PATH" --port "$PORT" --data-dir "$DATA_DIR" &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
  if [ -z "$KEEP_TARBALL" ] && [ -n "$TARBALL_PATH" ]; then
    rm -f "$TARBALL_PATH"
  fi
}
trap cleanup EXIT

sleep 1

curl -fsS "http://localhost:${PORT}/api/health" > /tmp/design-learn-npx-health.json
python3 - <<'PY'
import json
with open('/tmp/design-learn-npx-health.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print('[verify-npx] health:', data.get('status'))
PY

echo "[verify-npx] done"
