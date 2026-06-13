#!/bin/bash
set -e

# Ensure meili is running
bash scripts/start-meili.sh || true

# Wait for meili to be ready
bash scripts/wait-for-meili.sh

# Start API in background
nohup npx tsx src/api/server.ts > /tmp/api.log 2>&1 &
echo $! > /tmp/api.pid
sleep 3

# Verify API
curl -sf http://localhost:3001/api/health > /dev/null || { echo "API failed to start"; cat /tmp/api.log; exit 1; }

# Start web in background
cd web && nohup npm run dev > /tmp/web.log 2>&1 &
echo $! > /tmp/web.pid
cd ..

sleep 5

# Verify web
curl -sf http://localhost:5173/ > /dev/null || { echo "Web failed to start"; cat /tmp/web.log; exit 1; }

# Cleanup function
cleanup() {
  kill $(cat /tmp/api.pid 2>/dev/null) 2>/dev/null || true
  kill $(cat /tmp/web.pid 2>/dev/null) 2>/dev/null || true
}
trap cleanup EXIT

echo "[e2e-stack] All services ready"

# Keep running until killed
sleep infinity
