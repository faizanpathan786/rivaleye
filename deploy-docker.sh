#!/usr/bin/env bash
# Docker-based deploy: pull image from GCR and restart with PM2
set -euo pipefail

export PATH="$HOME/.bun/bin:$HOME/.local/share/pnpm:$PATH"

cd "$(dirname "$0")"

# Get GCP project ID
PROJECT_ID=$(gcloud config get-value project)

echo "Pulling latest image from GCR..."
docker pull gcr.io/$PROJECT_ID/rivaleye:latest

echo "Restarting services with PM2..."
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "Deploy complete!"
