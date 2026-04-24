#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

START="${PORT:-9000}"
MAX_TRIES="${MAX_TRIES:-40}"
PORT="$START"
FOUND=""

for ((i = 0; i < MAX_TRIES; i++)); do
  if python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',$PORT)); s.close()" 2>/dev/null; then
    FOUND=1
    break
  fi
  if [[ "$i" -eq 0 ]]; then
    echo "Port ${START} is already in use (another server may be running)." >&2
    echo "Trying the next free port…" >&2
  fi
  PORT=$((PORT + 1))
done

if [[ -z "$FOUND" ]]; then
  echo "Could not find a free port after ${MAX_TRIES} tries (from ${START})." >&2
  exit 1
fi

echo "PathwayAI: http://127.0.0.1:${PORT}/pathwayai.html"
echo "Press Ctrl+C to stop."
exec python3 -m http.server "$PORT"
