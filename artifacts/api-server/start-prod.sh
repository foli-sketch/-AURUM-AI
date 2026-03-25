#!/usr/bin/env bash
set -e

export PYTHON_PORT=${PYTHON_PORT:-8082}
export NODE_ENV=production

WORKSPACE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_PATH="$WORKSPACE_ROOT/artifacts/api-server/python/trading_server.py"

echo "[start-prod] Starting Python trading server on port $PYTHON_PORT..."
PYTHON_PORT=$PYTHON_PORT python3 "$SCRIPT_PATH" &
PYTHON_PID=$!

# Give Python a moment to bind
sleep 2
echo "[start-prod] Python PID: $PYTHON_PID"

echo "[start-prod] Starting Node.js API server..."
node --enable-source-maps "$WORKSPACE_ROOT/artifacts/api-server/dist/index.mjs" &
NODE_PID=$!

cleanup() {
    echo "[start-prod] Shutting down..."
    kill $PYTHON_PID 2>/dev/null || true
    kill $NODE_PID  2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait $NODE_PID
