#!/usr/bin/env bash
# export.sh — Build server, export Godot web build, assemble /release
set -euo pipefail
alias godot4="/Applications/Godot4.app/Contents/MacOS/Godot"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
CLIENT_DIR="$SCRIPT_DIR/client"
RELEASE_DIR="$SCRIPT_DIR/release"
PUBLIC_DIR="$SERVER_DIR/public"
ZIP_FILE="$SCRIPT_DIR/legend-trade-app.zip"
ADMIN_FILE="$PUBLIC_DIR/admin.html"
TMP_ADMIN_FILE=""

# ── 1. Build server ────────────────────────────────────────────────────────────
echo "==> [1/5] Building server …"
cd "$SERVER_DIR"
npm ci
npm run build

# ── 2. Export Godot web build ──────────────────────────────────────────────────
echo "==> [2/5] Exporting Godot web build …"
GODOT_BIN="${GODOT_BIN:-godot4}"   # override: GODOT_BIN=/path/to/godot4 ./export.sh
mkdir -p "$RELEASE_DIR/public"
"/Applications/Godot4.app/Contents/MacOS/Godot" --headless \
  --path "$CLIENT_DIR" \
  --export-release "Web" \
  "$RELEASE_DIR/public/index.html"

# ── 3. Copy web export into server/public ─────────────────────────────────────
echo "==> [3/5] Copying web export into server/public …"
if [[ -f "$ADMIN_FILE" ]]; then
  TMP_ADMIN_FILE="$(mktemp)"
  cp "$ADMIN_FILE" "$TMP_ADMIN_FILE"
fi

rm -rf "$PUBLIC_DIR"
mkdir -p "$PUBLIC_DIR"
cp -r "$RELEASE_DIR/public/." "$PUBLIC_DIR/"

if [[ -n "$TMP_ADMIN_FILE" ]]; then
  cp "$TMP_ADMIN_FILE" "$ADMIN_FILE"
  cp "$TMP_ADMIN_FILE" "$RELEASE_DIR/public/admin.html"
  rm -f "$TMP_ADMIN_FILE"
fi

# ── 4. Assemble /release/server ───────────────────────────────────────────────
echo "==> [4/5] Assembling /release/server …"
rm -rf "$RELEASE_DIR/server"
mkdir -p "$RELEASE_DIR/server"
cp -r "$SERVER_DIR/dist/." "$RELEASE_DIR/server/"
cp -r "$PUBLIC_DIR" "$RELEASE_DIR/server/public"

# ── 5. Package release archive ────────────────────────────────────────────────
echo "==> [5/5] Creating release archive …"
rm -f "$ZIP_FILE"
cd "$SCRIPT_DIR"
zip -rq "$ZIP_FILE" release

echo ""
echo "Done. Release layout:"
echo "  $RELEASE_DIR/server/         — Node server (run: node index.js)"
echo "  $RELEASE_DIR/public/         — Raw Godot web export"
echo "  $ZIP_FILE                    — Zipped release bundle"
echo "  $RELEASE_DIR/start_server.bat — Double-click on Windows to start"
