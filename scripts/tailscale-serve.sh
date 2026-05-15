#!/usr/bin/env bash
# Build, start the production server, and expose it on your Tailscale net
# at a stable HTTPS URL via `tailscale serve`. The URL stays the same
# across restarts (no need to re-add to the iPhone home screen).
#
# Requirements:
#   - tailscaled is running on this Mac and you're signed in.
#   - The Tailscale iPhone app is installed and signed into the same
#     tailnet (otherwise the URL won't resolve on the phone).
#
# By default this uses `tailscale serve` which makes the app reachable
# from devices on your tailnet only (private). To expose it on the public
# internet too, set TS_FUNNEL=1 — Funnel must be enabled on your account
# at https://login.tailscale.com/admin/settings/general .

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale CLI not found. Install Tailscale from https://tailscale.com/download" >&2
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
SERVER_LOG="$LOG_DIR/rq-server.log"
TS_FUNNEL="${TS_FUNNEL:-0}"

SERVER_PID=""

cleanup() {
  echo ""
  echo "Shutting down..."
  # Tear down the serve config so the URL stops proxying when this script exits.
  # `serve --https 443 off` works on older releases; modern releases use
  # `serve reset`. Try both, swallow errors.
  tailscale serve --https=443 off 2>/dev/null || true
  tailscale serve reset 2>/dev/null || true
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ---------- Build ----------
echo "Building production bundle..."
npm run build >/dev/null

# ---------- Server ----------
echo "Starting server on port $PORT..."
NODE_ENV=production node server/index.js >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

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

# ---------- Tailscale serve ----------
echo "Configuring tailscale serve -> http://127.0.0.1:$PORT ..."
# Clear any stale serve config first so we don't double-register.
tailscale serve reset 2>/dev/null || tailscale serve --https=443 off 2>/dev/null || true

# Modern (1.56+) syntax. Falls back to the legacy two-arg form if needed.
if ! tailscale serve --bg --https=443 "http://127.0.0.1:$PORT" 2>/dev/null; then
  tailscale serve https / "http://127.0.0.1:$PORT"
fi

# Optionally make it public via Funnel.
if [ "$TS_FUNNEL" = "1" ]; then
  echo "Enabling Tailscale Funnel (public)..."
  tailscale funnel --bg --https=443 on 2>/dev/null \
    || tailscale funnel 443 on 2>/dev/null \
    || echo "  (funnel command failed — make sure it's enabled in the admin console)"
fi

# ---------- Resolve the URL ----------
TS_URL=""

# Pull from `tailscale serve status` first — that's the canonical source.
SERVE_STATUS="$(tailscale serve status 2>/dev/null || true)"
TS_URL="$(printf '%s' "$SERVE_STATUS" | grep -Eo 'https://[a-zA-Z0-9.-]+\.ts\.net' | head -n1 || true)"

# Fallback: build the URL from the DNS name in `tailscale status --json`.
if [ -z "$TS_URL" ] && command -v python3 >/dev/null 2>&1; then
  TS_URL="$(tailscale status --json 2>/dev/null \
    | python3 -c '
import json, sys
try:
  d = json.load(sys.stdin)
  name = d.get("Self", {}).get("DNSName", "").rstrip(".")
  if name: print("https://" + name)
except Exception:
  pass' || true)"
fi

if [ -z "$TS_URL" ]; then
  echo "Could not auto-detect the Tailscale URL." >&2
  echo "Run \`tailscale serve status\` to see it, or check \`tailscale status\`." >&2
  TS_URL="(see tailscale serve status)"
fi

if [ -n "$ACCESS_CODE" ] && [[ "$TS_URL" == https://* ]]; then
  PHONE_URL="${TS_URL}/?access=${ACCESS_CODE}"
else
  PHONE_URL="$TS_URL"
fi

# Copy URL to clipboard on macOS
CLIPBOARD_NOTE=""
if command -v pbcopy >/dev/null 2>&1 && [[ "$PHONE_URL" == https://* ]]; then
  printf '%s' "$PHONE_URL" | pbcopy
  CLIPBOARD_NOTE=" (copied to clipboard)"
fi

cat <<EOF

ReadQuest is live on your tailnet.

  Tailscale URL : $TS_URL
  Phone URL     : $PHONE_URL$CLIPBOARD_NOTE

On your iPhone:
  1. Make sure the Tailscale app is signed in to the same tailnet.
  2. Open the Phone URL above in Safari (text it to yourself, AirDrop it,
     or paste — it's already on your clipboard if you're on macOS).
  3. The first time, you'll send ?access=... once. After that the
     7-day cookie keeps you signed in.
  4. Share -> Add to Home Screen to install as a fullscreen PWA.
  5. Future launches: just run \`npm run go\` again — the URL stays the
     same, so the home-screen icon keeps working.

Logs:
  Server : $SERVER_LOG

Press Ctrl-C to stop the server. The serve config will be torn down on exit.
EOF

# Stay foreground until the server exits or the user hits Ctrl-C.
while kill -0 "$SERVER_PID" 2>/dev/null; do
  sleep 1
done
