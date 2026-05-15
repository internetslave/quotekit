#!/usr/bin/env bash
# Build, start the production server, open a Cloudflare quick tunnel,
# and print a phone-ready URL with the access code already appended.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install it with: brew install cloudflared" >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PORT="${PORT:-4173}"
ACCESS_CODE="${APP_ACCESS_CODE:-}"
LOG_DIR="${TMPDIR:-/tmp}"
SERVER_LOG="$LOG_DIR/rmf-server.log"
TUNNEL_LOG="$LOG_DIR/rmf-tunnel.log"

SERVER_PID=""
TUNNEL_PID=""

cleanup() {
  echo ""
  echo "Shutting down..."
  if [ -n "$TUNNEL_PID" ] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Building production bundle..."
npm run build >/dev/null

echo "Starting server on port $PORT..."
NODE_ENV=production node server/index.js >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# Wait for the server to be reachable
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/ai-status" \
      -H "Cookie: rmf_access=${ACCESS_CODE}"; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server failed to start. Recent log:" >&2
    tail -n 40 "$SERVER_LOG" >&2 || true
    exit 1
  fi
  sleep 0.25
done

echo "Starting Cloudflare quick tunnel..."
: >"$TUNNEL_LOG"
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# Wait for the trycloudflare.com URL to appear in the log
TUNNEL_URL=""
for _ in $(seq 1 120); do
  TUNNEL_URL="$(grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -n1 || true)"
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "cloudflared exited unexpectedly. Recent log:" >&2
    tail -n 40 "$TUNNEL_LOG" >&2 || true
    exit 1
  fi
  sleep 0.5
done

if [ -z "$TUNNEL_URL" ]; then
  echo "Could not detect a Cloudflare URL within 60s. Recent log:" >&2
  tail -n 40 "$TUNNEL_LOG" >&2 || true
  exit 1
fi

if [ -n "$ACCESS_CODE" ]; then
  PHONE_URL="${TUNNEL_URL}/?access=${ACCESS_CODE}"
else
  PHONE_URL="$TUNNEL_URL"
fi

# Copy URL to clipboard on macOS
if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$PHONE_URL" | pbcopy
  CLIPBOARD_NOTE=" (copied to clipboard)"
else
  CLIPBOARD_NOTE=""
fi

cat <<EOF

ReadingMadeFun is live.

  Tunnel URL : $TUNNEL_URL
  Phone URL  : $PHONE_URL$CLIPBOARD_NOTE

On your iPhone:
  1. Open the Phone URL above (text it to yourself, AirDrop it, or paste).
  2. Tap Share, then Add to Home Screen, to install it as a PWA.
  3. Launch it from the home screen for a fullscreen, app-like experience.

Logs:
  Server : $SERVER_LOG
  Tunnel : $TUNNEL_LOG

Press Ctrl-C to stop the server and the tunnel.
EOF

# Stay in the foreground until either process exits or the user hits Ctrl-C.
while kill -0 "$SERVER_PID" 2>/dev/null && kill -0 "$TUNNEL_PID" 2>/dev/null; do
  sleep 1
done
