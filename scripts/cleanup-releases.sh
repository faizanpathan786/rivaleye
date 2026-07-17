#!/usr/bin/env bash
# Prune old release directories, keeping the newest N by mtime. Never removes
# the release that `current` points at (regardless of age).
#
# Usage: cleanup-releases.sh [keep]
#   keep  default 5  (number of most-recent releases to retain)
#
# RIVALEYE_BASE overrides the base dir (default: <this release>/../.. ).
set -euo pipefail

KEEP="${1:-5}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$(dirname "$SCRIPT_DIR")"
RELEASES_DIR="$(dirname "$RELEASE_DIR")"
BASE="${RIVALEYE_BASE:-$(dirname "$RELEASES_DIR")}"
RELEASES_DIR="$BASE/releases"
CURRENT="$BASE/current"

[[ -d "$RELEASES_DIR" ]] || exit 0

current_target=""
if [[ -L "$CURRENT" ]]; then
  current_target="$(readlink -f "$CURRENT" || true)"
fi

# Newest-first list of release dirs, skip the first $KEEP, delete the rest
# (except whatever `current` points at).
mapfile -t stale < <(ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | tail -n +$((KEEP + 1)) || true)

for d in "${stale[@]}"; do
  full="$(readlink -f "${d%/}")"
  if [[ -n "$current_target" && "$full" == "$current_target" ]]; then
    continue
  fi
  echo "cleanup-releases: removing old release $full"
  rm -rf "$full"
done
