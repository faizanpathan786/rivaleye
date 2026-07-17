#!/usr/bin/env bash
# Poll the API readiness probe until it reports healthy or the timeout expires.
#
# Usage: health-check.sh [url] [timeout_seconds] [interval_seconds]
#   url      default http://localhost:4000/health
#   timeout  default 60  (total seconds to keep polling before giving up)
#   interval default 3   (seconds between polls)
#
# Exit 0 = healthy (HTTP 200 AND body contains "ok":true).
# Exit 1 = still unhealthy after the timeout.
#
# The /health route returns 200 {ok:true,...} when Postgres is reachable and
# 503 {ok:false,db:"down"} when it is not. A "stalled" queue is still reported
# with HTTP 200 (a live-but-busy worker looks the same as a dead one over a
# short window), so a stalled queue alone is NOT treated as a deploy failure —
# only a non-200 response or a missing ok:true is.
set -euo pipefail

URL="${1:-http://localhost:4000/health}"
TIMEOUT="${2:-60}"
INTERVAL="${3:-3}"

deadline=$(( $(date +%s) + TIMEOUT ))
code=""
payload=""

while :; do
  resp="$(curl -sS -m 5 -w $'\n%{http_code}' "$URL" 2>/dev/null)" || resp=""
  if [[ -n "$resp" ]]; then
    code="$(printf '%s' "$resp" | tail -n1)"
    payload="$(printf '%s' "$resp" | sed '$d')"
    if [[ "$code" == "200" && "$payload" == *'"ok":true'* ]]; then
      echo "health-check: healthy ($URL) -> $payload"
      exit 0
    fi
  fi

  if (( $(date +%s) >= deadline )); then
    echo "health-check: UNHEALTHY after ${TIMEOUT}s ($URL) -> code=${code:-none} body=${payload:-none}" >&2
    exit 1
  fi
  sleep "$INTERVAL"
done
