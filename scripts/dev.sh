#!/bin/bash
set -e

# Kill stale lingsou dev processes (api, web, vite, meili child of lingsou)
# so concurrently can bind the ports cleanly.
# We SIGTERM (graceful) — never SIGKILL — so child cleanup runs.
# Excludes any concurrently children because they don't exist yet
# (we run pkill BEFORE the re-exec below).
echo "[dev] killing stale lingsou processes..."
pkill -f "tsx.*src/api/server.ts" 2>/dev/null || true
pkill -f "tsx watch src/api/server.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
# Note: we intentionally do NOT kill meilisearch here.
# start-meili.sh detects an already-running meili via PID file and
# just tails its logs in foreground — that's what we want.

# Brief settle so ports close before concurrently tries to bind them.
sleep 1

# Re-exec concurrently with the original args
exec npx concurrently -k -n meili,api,web -c blue,green,magenta "npm:dev:meili" "npm:dev:api" "npm:dev:web" "$@"