#!/bin/bash
set -e

# Kill stale lingsou dev processes (api, web, vite) so concurrently can bind
# the ports cleanly. We SIGTERM (graceful) — never SIGKILL — so child cleanup
# runs. Excludes any concurrently children because they don't exist yet
# (we run pkill BEFORE the re-exec below).
#
# Note: we intentionally do NOT kill meilisearch here. start-meili.sh detects
# an already-running meili via PID file (and port-7700 health check) and just
# tails its logs in foreground — that's what we want under concurrently.
echo "[dev] killing stale lingsou processes..."
pkill -f "tsx.*src/api/server.ts" 2>/dev/null || true
pkill -f "tsx watch src/api/server.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Brief settle so ports close before concurrently tries to bind them.
sleep 1

# Re-exec concurrently with the original args.
#
# Why --kill-others-on-fail instead of -k:
#   `-k` (alias: --kill-others) tears down siblings on ANY child exit — including
#   a clean exit, a SIGTERM exit, AND a normal "restart" exit from `tsx watch`.
#   When `tsx watch` reloads after a file change, the OLD tsx process exits with
#   signal-style exit code, and `-k` would interpret that as "api finished" and
#   SIGTERM meili + web. Result: cascade wipe on every code edit.
#
#   `--kill-others-on-fail` is narrower: it only kills siblings on a NON-ZERO
#   exit code (i.e. an actual crash). A signal-killed tsx watch restart reports
#   as the watcher spawning a fresh process; the watcher's parent (concurrently)
#   sees the child PID replaced via process group, not the original exiting.
#   Even if the original tsx exits with a non-zero signal-coded code, `tsx
#   watch` itself stays alive (it's the supervisor), so the concurrently child
#   never reports as "failed".
#
# Net: Ctrl+C still tears down the whole tree (via signal forwarding to the
# process group), but normal `tsx watch` restarts and routine child exits
# leave the other services running.
exec npx concurrently \
  --kill-others-on-fail \
  --names meili,api,web \
  --prefix-colors blue,green,magenta \
  "npm:dev:meili" "npm:dev:api" "npm:dev:web" "$@"