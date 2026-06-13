#!/bin/bash
set -e

# 1. Check Meilisearch
echo "[smoke] checking meilisearch..."
bash scripts/wait-for-meili.sh

# 2. Start API in background
echo "[smoke] starting API..."
nohup npx tsx src/api/server.ts > /tmp/api.log 2>&1 &
API_PID=$!
trap "kill $API_PID 2>/dev/null || true" EXIT
sleep 3

# 3. Check API health
echo "[smoke] checking API health..."
API_HEALTH=$(curl -s -w "\n%{http_code}" http://localhost:3001/api/health)
echo "$API_HEALTH"
HTTP_CODE=$(echo "$API_HEALTH" | tail -1)
if [ "$HTTP_CODE" != "200" ]; then
  echo "API health check failed: HTTP $HTTP_CODE"
  exit 1
fi

# 4. Try a search
echo "[smoke] testing search..."
SEARCH_RESULT=$(curl -s -w "\n%{http_code}" 'http://localhost:3001/api/search?q=test&limit=1')
HTTP_CODE=$(echo "$SEARCH_RESULT" | tail -1)
if [ "$HTTP_CODE" != "200" ]; then
  echo "Search test failed: HTTP $HTTP_CODE"
  exit 1
fi
echo "[smoke] search returned 200, hits: $(echo "$SEARCH_RESULT" | head -1 | python3 -c 'import json,sys; print(json.load(sys.stdin).get("total", 0))')"

# 5. Cleanup
kill $API_PID 2>/dev/null || true
echo "[smoke] all checks passed"