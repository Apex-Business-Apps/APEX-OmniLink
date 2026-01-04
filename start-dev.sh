#!/bin/bash
# APEX-OmniHub Development Server Launcher
# Starts the dev server in the background

echo "🚀 Starting APEX-OmniHub development server..."

# Change to project directory
cd "$(dirname "$0")"

# Start dev server in background
nohup npm run dev > dev-server.log 2>&1 &

# Get the process ID
DEV_PID=$!

# Save PID to file for later stopping
echo $DEV_PID > .dev-server.pid

echo "✅ Dev server started!"
echo "📝 Process ID: $DEV_PID"
echo "📋 Logs: dev-server.log"
echo ""
echo "🌐 Server will be available at: http://localhost:5173"
echo ""
echo "To stop the server, run: ./stop-dev.sh"
