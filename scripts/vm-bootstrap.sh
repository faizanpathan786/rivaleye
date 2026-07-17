#!/usr/bin/env bash
# Runs ON THE VM, invoked by cloudbuild.yaml over IAP SSH. This is the only
# piece Cloud Build uploads directly (scp'd from the checked-out commit), so it
# stays deliberately small: it just materialises the pinned commit into a fresh
# release directory, wires in the shared .env + logs, then hands off to that
# release's own (vetted) deploy.sh for install/build/migrate/flip/health.
#
# Usage: vm-bootstrap.sh <sha> <tarball>
#   sha      the exact commit being deployed (release dir name)
#   tarball  path to a gzipped `git archive` of that commit
#
# Idempotent: safe to re-run for the same SHA (release is re-extracted clean)
# and safe on a fresh VM with no releases yet.
#
# RIVALEYE_BASE overrides the base dir (default: $HOME/rivaleye).
set -euo pipefail

SHA="${1:?usage: vm-bootstrap.sh <sha> <tarball>}"
TARBALL="${2:?usage: vm-bootstrap.sh <sha> <tarball>}"

# The gcloud-ssh non-interactive shell lacks bun / pnpm global bin on PATH.
export PATH="$HOME/.bun/bin:$HOME/.local/share/pnpm:$PATH"

BASE="${RIVALEYE_BASE:-$HOME/rivaleye}"
RELEASES_DIR="$BASE/releases"
SHARED_DIR="$BASE/shared"
CURRENT="$BASE/current"
RELEASE_DIR="$RELEASES_DIR/$SHA"

mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$SHARED_DIR/logs"

# The .env lives in shared/ so secrets survive every release. It must be
# provisioned once, out of band, before the first deploy — we never generate it.
if [[ ! -f "$SHARED_DIR/.env" ]]; then
  echo "FATAL: $SHARED_DIR/.env not found." >&2
  echo "Provision it once before the first deploy, e.g.:" >&2
  echo "  cp \"\$HOME/rivaleye-v3/.env\" \"$SHARED_DIR/.env\"   # from the old layout" >&2
  exit 1
fi

if [[ ! -f "$TARBALL" ]]; then
  echo "FATAL: release tarball not found: $TARBALL" >&2
  exit 1
fi

# Extract the pinned commit into a clean release dir (out-of-line; the live
# release keeps serving untouched).
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$TARBALL" -C "$RELEASE_DIR"

# Wire the shared .env + logs into this release. The api/worker start scripts
# read `--env-file=../../.env` (relative to each package -> release root), so
# .env must sit at the release root.
ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
rm -rf "$RELEASE_DIR/logs"
ln -sfn "$SHARED_DIR/logs" "$RELEASE_DIR/logs"

# Best-effort cleanup of the uploaded tarball (staging dir is reused).
rm -f "$TARBALL" 2>/dev/null || true

# Hand off to the vetted per-release deploy script.
exec bash "$RELEASE_DIR/deploy.sh" "$SHA"
