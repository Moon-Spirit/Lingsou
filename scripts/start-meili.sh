#!/bin/bash
set -e

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)

if [[ "$OS" != "Linux" ]] || [[ "$ARCH" != "aarch64" ]]; then
    echo "Error: This script only supports Linux aarch64. Detected: $OS $ARCH"
    exit 1
fi

# Set directories (absolute paths)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BIN_DIR="$PROJECT_DIR/.bin/meili"
DATA_DIR="$PROJECT_DIR/data/meili"
PID_FILE="$PROJECT_DIR/.bin/meili.pid"
LOG_FILE="$PROJECT_DIR/.bin/meili.log"
MASTER_KEY="lingsou-dev-key"
VERSION="v1.10.0"
BIN_PATH="$BIN_DIR/meilisearch"

# Check if already running — two layers:
#   1. PID file (our own previous launch)
#   2. port 7700 health check (a meili launched MANUALLY by the user on a
#      different --db-path would not match our PID file but would still bind
#      7700 and cause our start to fail with EADDRINUSE)
EXISTING_PID=""
if [[ -f "$PID_FILE" ]]; then
    EXISTING_PID=$(cat "$PID_FILE")
    if kill -0 "$EXISTING_PID" 2>/dev/null; then
        echo "Meilisearch is already running (PID: $EXISTING_PID, managed by us)"
        echo "To stop: bash scripts/stop-meili.sh"
    else
        rm -f "$PID_FILE"
        EXISTING_PID=""
    fi
fi

# Port-7700 fallback: if we don't have a PID but the port answers /health,
# there's an externally-launched meili (e.g. user ran `meilisearch` directly
# with a custom --db-path). Adopt it instead of trying to spawn a second one.
#
# IMPORTANT: do NOT write the adopted PID to $PID_FILE. The PID file is the
# "managed by us" marker for stop-meili.sh — overwriting it would cause
# `bash scripts/stop-meili.sh` to kill a process the user launched themselves,
# which is not our place to do.
if [[ -z "$EXISTING_PID" ]]; then
    HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 1 http://127.0.0.1:7700/health 2>/dev/null || echo "000")
    if [[ "$HEALTH_CODE" == "200" ]]; then
        # Find the PID owning port 7700 via /proc (no lsof/fuser dep).
        EXTERNAL_PID=$(ss -ltnp 'sport = :7700' 2>/dev/null | sed -n 's/.*pid=\([0-9]*\),.*/\1/p' | head -n1)
        if [[ -z "$EXTERNAL_PID" ]] && command -v fuser >/dev/null 2>&1; then
            EXTERNAL_PID=$(fuser 7700/tcp 2>/dev/null | awk '{print $1}')
        fi
        if [[ -n "$EXTERNAL_PID" ]] && kill -0 "$EXTERNAL_PID" 2>/dev/null; then
            EXISTING_PID="$EXTERNAL_PID"
            echo "[meili] found externally-launched meilisearch on :7700 (PID: $EXTERNAL_PID), adopting it"
            echo "[meili] (it may use a different --db-path; data won't land in $DATA_DIR)"
        fi
    fi
fi

# Create directories
mkdir -p "$BIN_DIR"
mkdir -p "$DATA_DIR"

# Download binary if not exists
if [[ ! -f "$BIN_PATH" ]]; then
    echo "Downloading Meilisearch $VERSION for Linux aarch64..."
    DOWNLOAD_URL="https://github.com/meilisearch/meilisearch/releases/download/${VERSION}/meilisearch-linux-aarch64"
    curl -L -o "$BIN_PATH" "$DOWNLOAD_URL"
    chmod +x "$BIN_PATH"
    echo "Binary downloaded successfully"
fi

# Only start a fresh meilisearch if one isn't already alive.
PID=""
if [[ -z "$EXISTING_PID" ]]; then
    echo "Starting Meilisearch..."
    nohup "$BIN_PATH" \
        --master-key "$MASTER_KEY" \
        --db-path "$DATA_DIR" \
        --http-addr "127.0.0.1:7700" \
        --env "development" \
        > "$LOG_FILE" 2>&1 &

    PID=$!
    echo "$PID" > "$PID_FILE"
    echo "Meilisearch started with PID: $PID"
    echo "Log file: $LOG_FILE"

    # Wait for startup and health check
    echo "Waiting for Meilisearch to be ready..."
    sleep 3

    # Health check
    HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:7700/health 2>/dev/null || echo "000")
    if [[ "$HEALTH_RESPONSE" == "200" ]]; then
        echo ""
        echo "=========================================="
        echo "Meilisearch is running on http://localhost:7700"
        echo "Master Key: $MASTER_KEY"
        echo "Data Directory: $DATA_DIR"
        echo "PID File: $PID_FILE"
        echo "=========================================="
    else
        echo "Warning: Health check returned status $HEALTH_RESPONSE"
        echo "Check logs at: $LOG_FILE"
    fi
fi

# ----------------------------------------------------------------------
# Block in foreground so `npm run dev` (concurrently) sees a live process.
# Without this, the script exits after `nohup ... &`, and concurrently
# interprets that as "meili finished successfully" and SIGTERMs the other
# children (api, web). Trap signals so we exit cleanly on Ctrl+C / SIGTERM.
# ----------------------------------------------------------------------
trap 'echo "[meili] stopping (PID ${PID:-$EXISTING_PID})..."; exit 0' SIGTERM SIGINT

if [[ -n "$PID" ]]; then
    wait "$PID" 2>/dev/null || true
elif [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "[meili] following meilisearch logs (PID $EXISTING_PID). Send SIGTERM to stop."
    tail --pid="$EXISTING_PID" -n +1 -f "$LOG_FILE" 2>/dev/null || true
fi

exit 0
