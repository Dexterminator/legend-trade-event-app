#!/usr/bin/env bash
# export.sh — Build server, export Godot web build, assemble /release
set -euo pipefail
alias godot4="/Applications/Godot4.app/Contents/MacOS/Godot"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
CLIENT_DIR="$SCRIPT_DIR/client"
RELEASE_DIR="$SCRIPT_DIR/release"
PUBLIC_DIR="$SERVER_DIR/public"

# ── 1. Build server ────────────────────────────────────────────────────────────
echo "==> [1/4] Building server …"
cd "$SERVER_DIR"
npm ci
npm run build

# ── 2. Export Godot web build ──────────────────────────────────────────────────
echo "==> [2/4] Exporting Godot web build …"
GODOT_BIN="${GODOT_BIN:-godot4}"   # override: GODOT_BIN=/path/to/godot4 ./export.sh
mkdir -p "$RELEASE_DIR/public"
"/Applications/Godot4.app/Contents/MacOS/Godot" --headless \
  --path "$CLIENT_DIR" \
  --export-release "Web" \
  "$RELEASE_DIR/public/index.html"

# ── 3. Copy web export into server/public ─────────────────────────────────────
echo "==> [3/4] Copying web export into server/public …"
rm -rf "$PUBLIC_DIR"
mkdir -p "$PUBLIC_DIR"
cp -r "$RELEASE_DIR/public/." "$PUBLIC_DIR/"

# ── 4. Assemble /release/server ───────────────────────────────────────────────
echo "==> [4/4] Assembling /release/server …"
rm -rf "$RELEASE_DIR/server"
mkdir -p "$RELEASE_DIR/server"
cp -r "$SERVER_DIR/dist/." "$RELEASE_DIR/server/"
cp -r "$PUBLIC_DIR" "$RELEASE_DIR/server/public"

echo ""
echo "Done. Release layout:"
echo "  $RELEASE_DIR/server/         — Node server (run: node index.js)"
echo "  $RELEASE_DIR/public/         — Raw Godot web export"
echo "  $RELEASE_DIR/start_server.bat — Double-click on Windows to start"
