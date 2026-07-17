#!/usr/bin/env bash
# Per-release build + atomic-flip step of the VM deploy. This script lives
# INSIDE each release (releases/<sha>/deploy.sh) and is invoked by
# scripts/vm-bootstrap.sh once the commit has been extracted. Because it ships
# with the code it deploys, `current` is only ever flipped by the vetted
# version of this script for that exact SHA.
#
# Flow (nothing that reaches users changes until the symlink flip):
#   1. acquire a cross-deploy lock (no interleaving git/flip)          [fix #6]
#   2. pnpm install --frozen-lockfile in THIS release                 [fix #4]
#   3. type-check gate, then build gate — against the NEW release,
#      out-of-line, so the live release keeps serving its own dist    [fix #1,#3]
#   4. run migrations once (before the flip; forward-only)
#   5. flip the `current` symlink to this release + pm2 reload        [fix #1]
#   6. health-gate on /health; on failure flip back + reload          [fix #2]
#
# Usage: deploy.sh [sha]   (sha defaults to this release dir's basename)
# RIVALEYE_BASE overrides the base dir.
set -euo pipefail

# The gcloud-ssh non-interactive shell does not pick up bun (~/.bun/bin) or the
# pnpm global bin, so add them explicitly. This also propagates to child shells.
export PATH="$HOME/.bun/bin:$HOME/.local/share/pnpm:$PATH"

# Cap Node heap so vite/astro don't get OOM-killed on a small VM.
export NODE_OPTIONS="--max-old-space-size=2048"

RELEASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASES_DIR="$(dirname "$RELEASE_DIR")"
BASE="${RIVALEYE_BASE:-$(dirname "$RELEASES_DIR")}"
RELEASES_DIR="$BASE/releases"
SHARED_DIR="$BASE/shared"
CURRENT="$BASE/current"
SHA="${1:-$(basename "$RELEASE_DIR")}"

mkdir -p "$SHARED_DIR"

# ---------------------------------------------------------------------------
# 1. Concurrency lock — serialize overlapping deploys so two runs can never
#    interleave build/migrate/flip. Waits up to 30m for an in-flight deploy.
# ---------------------------------------------------------------------------
LOCK_FILE="$SHARED_DIR/deploy.lock"
exec 9>"$LOCK_FILE"
if ! flock -w 1800 9; then
  echo "deploy: could not acquire lock ($LOCK_FILE) — another deploy is running." >&2
  exit 1
fi

echo "deploy: releasing $SHA from $RELEASE_DIR"
cd "$RELEASE_DIR"

# ---------------------------------------------------------------------------
# 2. Install — frozen so prod cannot drift from the committed lockfile.
# ---------------------------------------------------------------------------
pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# 3. Gates against the NEW release (out-of-line). `set -e` aborts here on any
#    failure WITHOUT flipping the symlink, so the old release stays live and
#    unvetted code is never what `current` points at.
# ---------------------------------------------------------------------------
pnpm exec turbo run type-check --concurrency=1
pnpm exec turbo run build --concurrency=1

# ---------------------------------------------------------------------------
# 4. Migrations — once per deploy, after build, before the flip. drizzle-kit
#    reads CONNECTION_STRING from the release-root .env (symlinked to shared).
#    Forward-only; migrations MUST stay backward-compatible with the still-
#    running old release during the flip window (see docs/deploy-runbook.md).
# ---------------------------------------------------------------------------
set -a
# shellcheck disable=SC1091
source "$RELEASE_DIR/.env"
set +a
pnpm db:migrate

# ---------------------------------------------------------------------------
# 5. Atomic flip — record the currently-live release, point `current` at the
#    new one, then reload PM2. ecosystem cwd is the literal `current` path, so
#    reloading re-execs every app against the freshly-flipped target.
# ---------------------------------------------------------------------------
PREV=""
if [[ -L "$CURRENT" ]]; then
  PREV="$(readlink -f "$CURRENT" || true)"
fi

echo "deploy: flipping current -> $RELEASE_DIR (was: ${PREV:-none})"
ln -sfn "$RELEASE_DIR" "$CURRENT"

# startOrReload starts apps if none exist (fresh VM / post-reboot) and
# zero-downtime reloads them otherwise. --update-env refreshes env.
pm2 startOrReload "$CURRENT/ecosystem.config.cjs" --update-env
pm2 save

# Idempotent pm2 log rotation.
if ! pm2 describe pm2-logrotate > /dev/null 2>&1; then
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 50M
  pm2 set pm2-logrotate:retain 14
  pm2 set pm2-logrotate:compress true
fi

# ---------------------------------------------------------------------------
# 6. Health gate + auto-rollback.
# ---------------------------------------------------------------------------
if bash "$RELEASE_DIR/scripts/health-check.sh" "http://localhost:4000/health" 60 3; then
  echo "deploy: $SHA is live and healthy."
  bash "$RELEASE_DIR/scripts/cleanup-releases.sh" 5 || true
  exit 0
fi

echo "deploy: health gate FAILED for $SHA." >&2
if [[ -n "$PREV" && "$PREV" != "$RELEASE_DIR" && -d "$PREV" ]]; then
  echo "deploy: rolling back current -> $PREV" >&2
  ln -sfn "$PREV" "$CURRENT"
  pm2 startOrReload "$CURRENT/ecosystem.config.cjs" --update-env
  pm2 save
  if bash "$PREV/scripts/health-check.sh" "http://localhost:4000/health" 60 3; then
    echo "deploy: rolled back to previous release ($(basename "$PREV")), which is healthy." >&2
  else
    echo "deploy: CRITICAL — rollback target ($(basename "$PREV")) is ALSO unhealthy. Manual intervention required." >&2
  fi
else
  echo "deploy: no previous healthy release to roll back to; leaving $SHA current (UNHEALTHY)." >&2
fi
exit 1
