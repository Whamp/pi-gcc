#!/usr/bin/env bash
# gcc-init.sh — One-time GCC project initialization
# Creates .gcc/ directory structure and appends GCC section to root AGENTS.md
# Idempotent: safe to run multiple times without clobbering existing content.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../templates"

GCC_DIR=".gcc"
BRANCHES_DIR="$GCC_DIR/branches/main"
STATE_FILE="$GCC_DIR/state.yaml"
GCC_AGENTS_FILE="$GCC_DIR/AGENTS.md"
MAIN_MD_FILE="$GCC_DIR/main.md"
ROOT_AGENTS_FILE="AGENTS.md"
GITIGNORE_FILE=".gitignore"
LOG_IGNORE_PATTERN=".gcc/branches/*/log.md"

# --- Create .gcc directory structure (skip if already exists) ---

if [ ! -d "$BRANCHES_DIR" ]; then
  mkdir -p "$BRANCHES_DIR"
fi

if [ ! -f "$BRANCHES_DIR/log.md" ]; then
  touch "$BRANCHES_DIR/log.md"
fi

if [ ! -f "$BRANCHES_DIR/commits.md" ]; then
  cat > "$BRANCHES_DIR/commits.md" <<'EOF'
# main

**Purpose:** Main project memory branch
EOF
fi

if [ ! -f "$BRANCHES_DIR/metadata.yaml" ]; then
  touch "$BRANCHES_DIR/metadata.yaml"
fi

if [ ! -f "$MAIN_MD_FILE" ]; then
  touch "$MAIN_MD_FILE"
fi

# --- Write state.yaml (skip if already exists) ---

if [ ! -f "$STATE_FILE" ]; then
  cat > "$STATE_FILE" <<EOF
active_branch: main
initialized: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EOF
fi

# --- Write .gcc/AGENTS.md from template (always overwrite — it's a reference doc) ---

if [ -f "$TEMPLATES_DIR/agents-md.md" ]; then
  cp "$TEMPLATES_DIR/agents-md.md" "$GCC_AGENTS_FILE"
fi

# --- Append GCC section to root AGENTS.md (idempotent) ---

if [ ! -f "$ROOT_AGENTS_FILE" ]; then
  touch "$ROOT_AGENTS_FILE"
fi

if ! grep -q "## GCC" "$ROOT_AGENTS_FILE" 2>/dev/null; then
  if [ -s "$ROOT_AGENTS_FILE" ]; then
    echo "" >> "$ROOT_AGENTS_FILE"
  fi
  cat "$TEMPLATES_DIR/root-agents-section.md" >> "$ROOT_AGENTS_FILE"
fi

# --- Ignore transient branch logs in git (idempotent) ---

if [ ! -f "$GITIGNORE_FILE" ]; then
  touch "$GITIGNORE_FILE"
fi

if ! grep -Fxq "$LOG_IGNORE_PATTERN" "$GITIGNORE_FILE"; then
  if [ -s "$GITIGNORE_FILE" ]; then
    echo "" >> "$GITIGNORE_FILE"
  fi
  echo "$LOG_IGNORE_PATTERN" >> "$GITIGNORE_FILE"
fi

echo "GCC initialized successfully."
