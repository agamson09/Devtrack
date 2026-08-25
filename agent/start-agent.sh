#!/bin/bash
cd "$(dirname "$0")"
echo "========================================"
echo "  DevTrack Remote Desktop Agent"
echo "========================================"
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found!"
    echo "Install via: brew install node"
    exit 1
fi
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies..."
    npm install
fi
echo "[INFO] Starting agent..."
node agent.js --server http://localhost:3000
