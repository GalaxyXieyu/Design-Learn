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

JOB_ID=$(python3 - <<'PY'
import json
with open('/tmp/design-learn-import.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
job_id = (data.get('job') or {}).get('id') or ''
print(job_id)
PY
)

if [ -z "$JOB_ID" ]; then
  echo "[verify] job id missing"
  exit 1
fi

echo "[verify] job: ${JOB_ID}"

for _ in {1..20}; do
  STATUS=$(curl -fsS "http://localhost:${PORT}/api/import/jobs/${JOB_ID}" | python3 - <<'PY'
import json, sys
data = json.load(sys.stdin)
job = data.get('job') or {}
print(job.get('status') or '')
PY
  )
  if [ -n "$STATUS" ]; then
    echo "[verify] import status: ${STATUS}"
  fi
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 0.3
done

curl -fsS "http://localhost:${PORT}/api/import/jobs" > /tmp/design-learn-jobs.json
python3 - <<'PY'
import json
with open('/tmp/design-learn-jobs.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print('[verify] jobs:', len(data.get('jobs', [])))
PY

curl -fsS "http://localhost:${PORT}/api/designs" > /tmp/design-learn-designs.json
DESIGN_ID=$(python3 - <<'PY'
import json
with open('/tmp/design-learn-designs.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
items = data.get('items') or []
print(items[0].get('id') if items else '')
PY
)

if [ -n "$DESIGN_ID" ]; then
  curl -fsS "http://localhost:${PORT}/api/designs/${DESIGN_ID}" > /tmp/design-learn-design.json
  curl -fsS -X PATCH "http://localhost:${PORT}/api/designs/${DESIGN_ID}" \
    -H 'Content-Type: application/json' \
    -d '{"description":"verified-by-script"}' \
    > /tmp/design-learn-design-update.json

  curl -fsS "http://localhost:${PORT}/api/snapshots?designId=${DESIGN_ID}" \
    > /tmp/design-learn-snapshots.json
  SNAPSHOT_ID=$(python3 - <<'PY'
import json
with open('/tmp/design-learn-snapshots.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
items = data.get('items') or []
print(items[0].get('id') if items else '')
PY
  )

  if [ -n "$SNAPSHOT_ID" ]; then
    curl -fsS "http://localhost:${PORT}/api/snapshots/${SNAPSHOT_ID}" \
      > /tmp/design-learn-snapshot.json
  fi
fi

curl -fsS -X PUT "http://localhost:${PORT}/api/config" \
  -H 'Content-Type: application/json' \
  -d '{"model":{"name":"stub","version":"local","provider":"nanobanana"},"templates":{"styleguide":"default","components":"default"},"extractOptions":{"includeRules":true,"includeComponents":true}}' \
  > /tmp/design-learn-config.json
curl -fsS "http://localhost:${PORT}/api/config" > /tmp/design-learn-config-get.json

COMPONENT_ID=$(ROOT_DIR="$ROOT_DIR" node - <<'NODE'
const { createStorage } = require(process.env.ROOT_DIR + '/design-learn-server/src/storage');

async function main() {
  const storage = createStorage({
    dataDir: process.env.DESIGN_LEARN_DATA_DIR || process.env.DATA_DIR,
  });
  try {
    const designs = storage.listDesigns();
    if (!designs.length) {
      console.log('');
      return;
    }
    const versions = storage.listVersions(designs[0].id);
    if (!versions.length) {
      console.log('');
      return;
    }
    const component = await storage.createComponent({
      versionId: versions[0].id,
      name: 'verify-preview',
      type: 'test',
      html: '<div>preview</div>',
      css: 'div{color:#000}',
    });
    console.log(component.id);
  } finally {
    storage.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
)

if [ -n "$COMPONENT_ID" ]; then
  curl -fsS -X POST "http://localhost:${PORT}/api/previews" \
    -H 'Content-Type: application/json' \
    -d "{\"componentId\":\"${COMPONENT_ID}\"}" \
    > /tmp/design-learn-preview-job.json

  PREVIEW_JOB_ID=$(python3 - <<'PY'
import json
with open('/tmp/design-learn-preview-job.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
job = data.get('job') or {}
print(job.get('id') or '')
PY
  )

  if [ -n "$PREVIEW_JOB_ID" ]; then
    for _ in {1..20}; do
      STATUS=$(curl -fsS "http://localhost:${PORT}/api/previews/jobs/${PREVIEW_JOB_ID}" | python3 - <<'PY'
import json, sys
data = json.load(sys.stdin)
job = data.get('job') or {}
print(job.get('status') or '')
PY
      )
      if [ -n "$STATUS" ]; then
        echo "[verify] preview status: ${STATUS}"
      fi
      if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
        break
      fi
      sleep 0.2
    done
  fi

  curl -fsS "http://localhost:${PORT}/api/previews/${COMPONENT_ID}" \
    > /tmp/design-learn-preview.json
fi

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
