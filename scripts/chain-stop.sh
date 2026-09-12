#!/usr/bin/env bash
# Stop the local dev chains started by chain-local.sh.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.chain-pids"

if [ ! -f "$PID_FILE" ]; then
  echo "No .chain-pids — nothing to stop."
  exit 0
fi

while read -r pid; do
  [ -n "${pid:-}" ] || continue
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null && echo "stopped pid $pid" || true
  fi
done < "$PID_FILE"

rm -f "$PID_FILE"
echo "Done."