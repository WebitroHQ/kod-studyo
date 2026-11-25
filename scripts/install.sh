#!/usr/bin/env bash
# Kod Studyo installer for macOS (and Linux, from source).
# macOS: downloads the latest release for your CPU (Apple Silicon or Intel), copies the app to
#        /Applications (or ~/Applications), clears the quarantine flag (the app is not notarized)
#        and, if the Claude Code CLI is present, registers the MCP server so AI agents can use it.
# Linux: clones the repository to ~/.local/share/kod-studyo and installs it with npm (needs git, Node 20+).
# If the GitHub CLI is signed in, it is used for downloads, so this also works while the repo is private.
#
#   curl -fsSL https://raw.githubusercontent.com/WebitroHQ/kod-studyo/main/scripts/install.sh | bash
#
# Environment: KOD_STUDYO_NO_MCP=1 skips MCP registration; KOD_STUDYO_VERSION=v0.2.0 picks a release.
set -euo pipefail

REPO="WebitroHQ/kod-studyo"
VERSION="${KOD_STUDYO_VERSION:-latest}"

register_mcp() { # $1 command, $2 script, $3 "electron" to run the app's own Node
  if [ -n "${KOD_STUDYO_NO_MCP:-}" ] || ! command -v claude >/dev/null 2>&1; then
    echo
    echo "To connect an AI agent (MCP), use:"
    echo "  command: $1"
    echo "  args:    $2 mcp"
    if [ "${3:-}" = electron ]; then echo "  env:     ELECTRON_RUN_AS_NODE=1"; fi
    return
  fi
  claude mcp remove kod-studyo -s user >/dev/null 2>&1 || true
  if [ "${3:-}" = electron ]; then
    claude mcp add kod-studyo -s user -e ELECTRON_RUN_AS_NODE=1 -- "$1" "$2" mcp
  else
    claude mcp add kod-studyo -s user -- "$1" "$2" mcp
  fi
  echo 'Registered the "kod-studyo" MCP server with Claude Code.'
}

if [ "$(uname -s)" = "Darwin" ]; then
  case "$(uname -m)" in arm64) ARCH=arm64 ;; *) ARCH=x64 ;; esac
  echo "Kod Studyo: downloading the macOS build ($VERSION, $ARCH)..."
  TMP=$(mktemp -d)
  GOT=""
  if command -v gh >/dev/null 2>&1; then
    if [ "$VERSION" = latest ]; then
      gh release download --repo "$REPO" --pattern "*-$ARCH.zip" --dir "$TMP" >/dev/null 2>&1 && GOT=1 || true
    else
      gh release download "$VERSION" --repo "$REPO" --pattern "*-$ARCH.zip" --dir "$TMP" >/dev/null 2>&1 && GOT=1 || true
    fi
  fi
  if [ -n "$GOT" ]; then
    mv "$TMP"/*-"$ARCH".zip "$TMP/app.zip"
  else
    if [ "$VERSION" = latest ]; then API="https://api.github.com/repos/$REPO/releases/latest"; else API="https://api.github.com/repos/$REPO/releases/tags/$VERSION"; fi
    URL=$(curl -fsSL "$API" | grep -o "\"browser_download_url\": *\"[^\"]*-$ARCH\.zip\"" | head -1 | sed 's/.*"\(https[^"]*\)"/\1/' || true)
    if [ -z "$URL" ]; then echo "No macOS ($ARCH) build found. If the repository is private, sign in first: gh auth login" >&2; exit 1; fi
    curl -fL --progress-bar "$URL" -o "$TMP/app.zip"
  fi
  ditto -x -k "$TMP/app.zip" "$TMP"
  APP_SRC=$(find "$TMP" -maxdepth 2 -name "*.app" | head -1)
  DEST=/Applications
  [ -w "$DEST" ] || { DEST="$HOME/Applications"; mkdir -p "$DEST"; }
  APP="$DEST/$(basename "$APP_SRC")"
  rm -rf "$APP"
  ditto "$APP_SRC" "$APP"
  xattr -cr "$APP" || true
  rm -rf "$TMP"
  echo "Installed: $APP"
  EXE="$APP/Contents/MacOS/$(defaults read "$APP/Contents/Info" CFBundleExecutable)"
  register_mcp "$EXE" "$APP/Contents/Resources/app/bin/kod-studyo.mjs" electron
  echo
  echo "Done. Open it with: open \"$APP\""
else
  command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
  command -v node >/dev/null || { echo "Node.js 20+ is required" >&2; exit 1; }
  DIR="${KOD_STUDYO_DIR:-$HOME/.local/share/kod-studyo}"
  if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only
  elif command -v gh >/dev/null 2>&1; then gh repo clone "$REPO" "$DIR" -- --depth 1
  else git clone --depth 1 "https://github.com/$REPO.git" "$DIR"; fi
  (cd "$DIR" && npm install --omit=dev --no-audit --no-fund)
  echo "Installed: $DIR"
  register_mcp "$(command -v node)" "$DIR/bin/kod-studyo.mjs"
  echo
  echo "Done. Start it with: node \"$DIR/bin/kod-studyo.mjs\" serve   (renders need Chrome, Edge or Chromium)"
fi
