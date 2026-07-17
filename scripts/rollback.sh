#!/usr/bin/env bash
# Manually roll `current` back to a previous release and reload PM2.
#
# Usage: rollback.sh [target_sha]
#   target_sha  release dir under <base>/releases to switch to.
#               If omitted, picks the newest release that is NOT current.
#
# Run it from any release, e.g.:
#   bash /home/<user>/rivaleye/current/scripts/rollback.sh <sha>
#
# RIVALEYE_BASE overrides the base dir.
set -euo pipefail

# The non-interactive shell does not pick up bun / pnpm global bin.
export PATH="$HOME/.bun/bin:$HOME/.local/share/pnpm:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$(dirname "$SCRIPT_DIR")"
RELEASES_DIR="$(dirname "$RELEASE_DIR")"
BASE="${RIVALEYE_BASE:-$(dirname "$RELEASES_DIR")}"
RELEASES_DIR="$BASE/releases"
CURRENT="$BASE/current"
SHARED_DIR="$BASE/shared"

current_target=""
if [[ -L "$CURRENT" ]]; then
  current_target="$(readlink -f "$CURRENT" || true)"
fi

target_sha="${1:-}"
if [[ -z "$target_sha" ]]; then
  # Newest release dir that is not the current target.
  while read -r d; do
    full="$(readlink -f "${d%/}")"
    if [[ "$full" != "$current_target" ]]; then
      target_sha="$(basename "$full")"
      break
    fi
  done < <(ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null || true)
fi

if [[ -z "$target_sha" ]]; then
  echo "rollback: no candidate release found. Available:" >&2
  ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | sed 's#/*$##;s#.*/##' >&2 || true
  exit 1
fi

TARGET_DIR="$RELEASES_DIR/$target_sha"
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "rollback: release $target_sha not found at $TARGET_DIR" >&2
  echo "Available releases:" >&2
  ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | sed 's#/*$##;s#.*/##' >&2 || true
  exit 1
fi

echo "rollback: flipping current -> $TARGET_DIR"
ln -sfn "$TARGET_DIR" "$CURRENT"

pm2 startOrReload "$CURRENT/ecosystem.config.cjs" --update-env
pm2 save

if bash "$TARGET_DIR/scripts/health-check.sh" "http://localhost:4000/health" 60 3; then
  echo "rollback: complete — $target_sha is now current and healthy."
else
  echo "rollback: WARNING — $target_sha is current but did not pass the health check." >&2
  exit 1
fi
