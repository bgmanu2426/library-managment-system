#!/bin/bash

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Cleanup function to kill both processes
cleanup() {
    echo "Shutting down..."
    kill $CLIENT_PID $SERVER_PID 2>/dev/null || true
    exit 0
}

# Set trap to catch Ctrl+C and exit signals
trap cleanup SIGINT SIGTERM

# Start client
cd "$PROJECT_ROOT/client"
npm run dev -- --port 3000 &
CLIENT_PID=$!
echo "Client started (PID: $CLIENT_PID)"

# Start server
cd "$PROJECT_ROOT/server"
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
SERVER_PID=$!
echo "Server started (PID: $SERVER_PID)"

echo "Client: http://localhost:3000"
echo "Server: http://localhost:8000"
echo "Press Ctrl+C to stop"

# Wait for both processes
wait