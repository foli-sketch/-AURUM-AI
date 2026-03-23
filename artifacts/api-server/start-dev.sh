#!/usr/bin/env bash
set -e

export NODE_ENV=development
export PYTHON_PORT=${PYTHON_PORT:-8082}

WORKSPACE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_PATH="$WORKSPACE_ROOT/artifacts/api-server/python/trading_server.py"

echo "Starting Python trading server on port $PYTHON_PORT..."
PYTHON_PORT=$PYTHON_PORT python3 "$SCRIPT_PATH" &
PYTHON_PID=$!

echo "Building Node.js server..."
pnpm run build

echo "Starting Node.js API server..."
node --enable-source-maps ./dist/index.mjs &
NODE_PID=$!

cleanup() {
    echo "Shutting down..."
    kill $PYTHON_PID 2>/dev/null || true
    kill $NODE_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait $NODE_PID
