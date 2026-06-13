#!/bin/bash
set -e
HOST="${MEILI_HOST:-http://localhost:7700}"
MAX_WAIT=30
INTERVAL=1
elapsed=0
echo "Waiting for Meilisearch at $HOST ..."
while [ $elapsed -lt $MAX_WAIT ]; do
  if curl -sf "$HOST/health" > /dev/null 2>&1; then
    echo "Meilisearch is ready after ${elapsed}s"
    exit 0
  fi
  sleep $INTERVAL
  elapsed=$((elapsed + INTERVAL))
done
echo "Meilisearch did not become ready within ${MAX_WAIT}s"
exit 1