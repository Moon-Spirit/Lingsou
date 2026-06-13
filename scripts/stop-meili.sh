#!/bin/bash

# Set directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.bin/meili.pid"
LOG_FILE="$PROJECT_DIR/.bin/meili.log"

# Check if PID file exists
if [[ ! -f "$PID_FILE" ]]; then
    echo "No PID file found. Meilisearch may not be running."
    # Check if something is listening on port 7700
    if lsof -i :7700 >/dev/null 2>&1; then
        echo "Something is listening on port 7700. Attempting to find and kill..."
        PID=$(lsof -t -i :7700)
        if [[ -n "$PID" ]]; then
            kill "$PID" 2>/dev/null || true
            echo "Killed process $PID"
        fi
    fi
    exit 0
fi

# Read PID and kill
PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping Meilisearch (PID: $PID)..."
    kill "$PID" 2>/dev/null || true

    # Wait 2 seconds
    sleep 2

    # Check if process is gone
    if kill -0 "$PID" 2>/dev/null; then
        echo "Process still running, force killing..."
        kill -9 "$PID" 2>/dev/null || true
        sleep 1
    fi

    echo "Meilisearch process stopped"
else
    echo "Process $PID is not running"
fi

# Remove PID file
rm -f "$PID_FILE"

# Verify port 7700 is released
echo "Checking if port 7700 is released..."
if lsof -i :7700 >/dev/null 2>&1; then
    echo "Warning: Port 7700 is still in use"
    lsof -i :7700
else
    echo "Port 7700 is now free"
fi

echo "Stop complete"
