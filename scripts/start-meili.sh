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

# Check if already running
if [[ -f "$PID_FILE" ]]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Meilisearch is already running (PID: $PID)"
        echo "To stop: bash scripts/stop-meili.sh"
        exit 0
    else
        rm -f "$PID_FILE"
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

# Start Meilisearch in background
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
