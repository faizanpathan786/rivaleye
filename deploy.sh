#!/usr/bin/env bash
# Build + restart step of the VM deploy. Invoked by cloudbuild.yaml after the
# repo has been updated. Kept as a committed script so the deploy doesn't depend
# on fragile nested SSH quoting, and so PATH setup lives in one place.
set -euo pipefail

# The non-interactive login shell used by `gcloud compute ssh` does not pick up
# bun (installed in ~/.bun/bin) or the pnpm global bin, so add them explicitly.
export PATH="$HOME/.bun/bin:$HOME/.local/share/pnpm:$PATH"

cd "$(dirname "$0")"

# Cap Node heap so vite/astro don't get OOM-killed on a small VM.
export NODE_OPTIONS="--max-old-space-size=2048"

pnpm install
# Build one package at a time. Running vite + astro check + bun build in
# parallel starves a small VM and the build hangs.
pnpm exec turbo run build --concurrency=1

# Start the apps if they're not running, or zero-downtime reload if they are.
# `pm2 restart all` fails when no processes exist (e.g. after a VM reboot), so
# use startOrReload against the ecosystem file, then persist the process list.
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
