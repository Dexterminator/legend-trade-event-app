#!/usr/bin/env bash
# start_server.sh — Start the built server on port 5050
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/server"

if [[ ! -f "index.js" ]]; then
    echo "ERROR: release/server/index.js not found."
    echo "Run export.sh first to build the project."
    exit 1
fi

echo "Starting server on http://localhost:5050 ..."
node index.js
