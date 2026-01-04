#!/bin/bash
# APEX-OmniHub Development Server Stopper

cd "$(dirname "$0")"

if [ -f .dev-server.pid ]; then
    PID=$(cat .dev-server.pid)
    echo "🛑 Stopping dev server (PID: $PID)..."
    kill $PID 2>/dev/null
    rm .dev-server.pid
    echo "✅ Dev server stopped"
else
    echo "⚠️  No dev server PID file found"
    echo "Searching for running vite processes..."
    pkill -f "vite" && echo "✅ Killed vite processes" || echo "No vite processes found"
fi
