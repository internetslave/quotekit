#!/usr/bin/env bash
# One-shot: pull the newest ReadQuest code from the canonical
# quotekit/readquest-import branch, install fresh deps, kill any prior
# server bound to PORT, then build + run the production server behind
# a Cloudflare quick tunnel (delegated to scripts/tunnel.sh).
#
# Usage on your Mac:
#   npm run go
#
# Environment overrides:
#   QUOTEKIT_REMOTE  default: https://github.com/internetslave/quotekit.git
#   SOURCE_BRANCH    default: readquest-import
#   PORT             default: from .env or 4173

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d .git ]; then
  echo "Run this from inside the ReadQuest git checkout." >&2
  exit 1
fi

QUOTEKIT_REMOTE="${QUOTEKIT_REMOTE:-https://github.com/internetslave/quotekit.git}"
SOURCE_BRANCH="${SOURCE_BRANCH:-readquest-import}"

# ---------- Sync step ----------

# Make sure the canonical remote is wired up. Idempotent.
if ! git remote get-url quotekit >/dev/null 2>&1; then
  echo "Adding quotekit remote -> $QUOTEKIT_REMOTE"
  git remote add quotekit "$QUOTEKIT_REMOTE"
fi

echo "Fetching latest from quotekit/$SOURCE_BRANCH..."
git fetch quotekit "$SOURCE_BRANCH"

# Stash any in-progress work so the merge doesn't fight you.
STASH_REF=""
if [ -n "$(git status --porcelain)" ]; then
  echo "Local changes detected — stashing them under 'auto-stash-update'..."
  git stash push -u -m "auto-stash-update $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null
  STASH_REF="$(git rev-parse stash@{0})"
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "On branch '$CURRENT_BRANCH' — merging quotekit/$SOURCE_BRANCH..."

# Fast-forward when possible (normal updates). Fall back to a true merge
# with --allow-unrelated-histories on the very first sync when the local
# repo was created via GitHub import.
if ! git merge --ff-only "quotekit/$SOURCE_BRANCH" 2>/dev/null; then
  echo "  (fast-forward not possible — performing a normal merge)"
  git merge --allow-unrelated-histories --no-edit \
    -m "Sync latest from quotekit/$SOURCE_BRANCH" \
    "quotekit/$SOURCE_BRANCH"
fi

# Push back to the user's own remote (origin = ReadQuest) so opencode and
# GitHub see the same code. Non-fatal if the push fails (offline, no auth).
if git remote get-url origin >/dev/null 2>&1; then
  echo "Pushing $CURRENT_BRANCH to origin..."
  git push origin "$CURRENT_BRANCH" || \
    echo "  (push failed — your local checkout is still up-to-date)"
fi

# Restore your in-progress work if we stashed anything.
if [ -n "$STASH_REF" ]; then
  echo "Restoring your stashed changes..."
  if ! git stash pop "$STASH_REF" 2>/dev/null; then
    echo "  (stash conflict — your changes are preserved. List with: git stash list)"
  fi
fi

# ---------- Install step ----------

echo ""
echo "Installing dependencies..."
npm install --no-audit --no-fund

# ---------- Free the port before tunnel.sh tries to claim it ----------

# Source .env so PORT picks up the user's override.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
PORT="${PORT:-4173}"

if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -i ":$PORT" -t 2>/dev/null || true)"
  if [ -n "$PIDS" ]; then
    echo "Port $PORT busy — stopping previous process(es): $PIDS"
    echo "$PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 1
    # If anything's still there, force it.
    PIDS_STILL="$(lsof -i ":$PORT" -t 2>/dev/null || true)"
    if [ -n "$PIDS_STILL" ]; then
      echo "$PIDS_STILL" | xargs kill -KILL 2>/dev/null || true
    fi
  fi
fi

# ---------- Launch ----------

echo ""
echo "Launching production server + Tailscale serve..."
# Calls `npm run phone`, which by default runs scripts/tailscale-serve.sh.
# To use the legacy Cloudflare quick-tunnel path instead, run:
#   npm run phone:cloudflare
exec npm run phone
