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
AKIRA_FONT_SOURCE_DIR="$CLIENT_DIR/assets/akira_expanded"
AKIRA_FONT_TARGET_NAME="akira_expanded"
CUSTOM_HTML_TMP_DIR=""
CUSTOM_HTML_FILES=()

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
if [[ -d "$PUBLIC_DIR" ]]; then
  CUSTOM_HTML_TMP_DIR="$(mktemp -d)"
  while IFS= read -r -d '' html_file; do
    base_name="$(basename "$html_file")"
    if [[ "$base_name" == "index.html" ]]; then
      continue
    fi
    cp "$html_file" "$CUSTOM_HTML_TMP_DIR/$base_name"
    CUSTOM_HTML_FILES+=("$base_name")
  done < <(find "$PUBLIC_DIR" -maxdepth 1 -type f -name '*.html' -print0)
fi

rm -rf "$PUBLIC_DIR"
mkdir -p "$PUBLIC_DIR"
cp -r "$RELEASE_DIR/public/." "$PUBLIC_DIR/"

if [[ -n "$CUSTOM_HTML_TMP_DIR" ]]; then
  for base_name in "${CUSTOM_HTML_FILES[@]}"; do
    cp "$CUSTOM_HTML_TMP_DIR/$base_name" "$PUBLIC_DIR/$base_name"
    cp "$CUSTOM_HTML_TMP_DIR/$base_name" "$RELEASE_DIR/public/$base_name"
  done
  rm -rf "$CUSTOM_HTML_TMP_DIR"
fi

if [[ -d "$AKIRA_FONT_SOURCE_DIR" ]]; then
  rm -rf "$PUBLIC_DIR/$AKIRA_FONT_TARGET_NAME" "$RELEASE_DIR/public/$AKIRA_FONT_TARGET_NAME"
  cp -R "$AKIRA_FONT_SOURCE_DIR" "$PUBLIC_DIR/$AKIRA_FONT_TARGET_NAME"
  cp -R "$AKIRA_FONT_SOURCE_DIR" "$RELEASE_DIR/public/$AKIRA_FONT_TARGET_NAME"
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
